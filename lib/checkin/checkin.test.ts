import { describe, expect, it } from "vitest";
import { readCheckinForm } from "@/lib/checkin/forms";
import { processCheckin } from "@/lib/checkin/process";
import { checkinSchema } from "@/lib/schemas/inputs";

const easy = { kind: "easy", distanceKm: 3 } as const;

describe("processCheckin: 체크인 결과", () => {
  it("위험 증상이 있으면 오늘 훈련을 없애고 긴급으로 본다 (컨디션이 좋아도)", () => {
    const result = processCheckin({ condition: "good", dangerSymptoms: ["chest_pain"] }, easy);
    expect(result).toMatchObject({ hasDanger: true, symptoms: ["chest_pain"], changed: true, reason: "danger", offerLightAlternative: false });
    expect(result.workout).toEqual({ kind: "rest", distanceKm: 0 });
  });

  it("세 가지 위험 증상 각각이 긴급으로 판정된다", () => {
    for (const symptom of ["chest_pain", "severe_shortness_of_breath", "fainting_or_severe_dizziness"] as const) {
      expect(processCheckin({ condition: "normal", dangerSymptoms: [symptom] }, easy).hasDanger, symptom).toBe(true);
    }
  });

  it("위험 증상과 컨디션 나쁨이 함께면 이유는 위험 증상이고 가벼운 대체는 권하지 않는다", () => {
    const result = processCheckin({ condition: "bad", dangerSymptoms: ["fainting_or_severe_dizziness"] }, easy);
    expect(result.reason).toBe("danger");
    expect(result.offerLightAlternative).toBe(false);
  });

  it("컨디션이 나쁨이면 오늘 훈련을 휴식으로 바꾸고 가벼운 대체를 안내한다", () => {
    const result = processCheckin({ condition: "bad", dangerSymptoms: [] }, easy);
    expect(result).toMatchObject({ hasDanger: false, changed: true, reason: "condition", offerLightAlternative: true });
    expect(result.workout).toEqual({ kind: "rest", distanceKm: 0 });
  });

  it("컨디션이 좋음·보통이면 훈련을 그대로 둔다", () => {
    for (const condition of ["good", "normal"] as const) {
      const result = processCheckin({ condition, dangerSymptoms: [] }, easy);
      expect(result.changed).toBe(false);
      expect(result.workout).toEqual(easy);
      expect(result.reason).toBeNull();
    }
  });

  it("이미 휴식인 날은 바꿀 것이 없다", () => {
    const rest = { kind: "rest", distanceKm: 0 } as const;
    expect(processCheckin({ condition: "bad", dangerSymptoms: [] }, rest)).toMatchObject({ changed: false, offerLightAlternative: false });
    expect(processCheckin({ condition: "good", dangerSymptoms: ["chest_pain"] }, rest)).toMatchObject({ hasDanger: true, changed: false });
  });

  it("오늘 계획이 없어도 위험 증상은 알린다", () => {
    expect(processCheckin({ condition: "good", dangerSymptoms: ["chest_pain"] }, null)).toMatchObject({ hasDanger: true, workout: null, changed: false });
    expect(processCheckin({ condition: "bad", dangerSymptoms: [] }, null)).toMatchObject({ hasDanger: false, workout: null });
  });
});

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("readCheckinForm + checkinSchema", () => {
  it("동의한 사용자: 컨디션·통증·위험 증상을 읽는다", () => {
    const raw = readCheckinForm(
      form([["condition", "bad"], ["pain_knee", "mild"], ["pain_ankle", ""], ["danger", "chest_pain"]]),
      true,
    );
    const parsed = checkinSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pains).toEqual([{ part: "knee", intensity: "mild" }]);
      expect(parsed.data.dangerSymptoms).toEqual(["chest_pain"]);
    }
  });

  it("컨디션을 고르지 않으면 오류다", () => {
    expect(checkinSchema.safeParse(readCheckinForm(form([]), true)).success).toBe(false);
  });

  it("동의하지 않은 사용자: 컨디션·통증 값이 와도 무시하고 위험 증상만 읽는다", () => {
    const raw = readCheckinForm(form([["condition", "bad"], ["pain_knee", "severe"], ["danger", "chest_pain"]]), false);
    expect(raw).toEqual({ condition: "normal", pains: [], dangerSymptoms: ["chest_pain"] });
    expect(checkinSchema.safeParse(raw).success).toBe(true);
  });

  it("목록에 없는 통증 강도·위험 증상은 거부한다", () => {
    expect(checkinSchema.safeParse(readCheckinForm(form([["condition", "good"], ["pain_knee", "huge"]]), true)).success).toBe(false);
    expect(checkinSchema.safeParse(readCheckinForm(form([["condition", "good"], ["danger", "headache"]]), true)).success).toBe(false);
  });

  it("같은 위험 증상을 두 번 보내도 거부한다", () => {
    expect(checkinSchema.safeParse(readCheckinForm(form([["condition", "good"], ["danger", "chest_pain"], ["danger", "chest_pain"]]), true)).success).toBe(false);
  });
});
