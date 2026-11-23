import { describe, expect, it } from "vitest";
import { adjustRestOfWeek } from "@/lib/caution/adjust";
import { assessCautions, type Caution } from "@/lib/caution/assess";
import { adjustmentText, cautionText } from "@/lib/caution/text";
import { processCheckin } from "@/lib/checkin/process";
import type { PlanDay } from "@/lib/rules/planTypes";

const spike: Caution = { kind: "distance_spike", baselineKm: 5, percentOver: 20 };
const streak: Caution = { kind: "pain_streak", part: "knee", days: 3 };

describe("assessCautions", () => {
  const base = { otherRuns: [{ date: "2026-11-10", distanceKm: 5 }], profileLongestKm: 3, pains: [], painAsOf: "2026-11-23" };

  it("최근 30일 최장 거리보다 10% 이상 길면 거리 주의를 낸다 (정확히 10%도 포함)", () => {
    expect(assessCautions({ ...base, run: { date: "2026-11-23", distanceKm: 5.5 } })).toEqual([
      expect.objectContaining({ kind: "distance_spike", baselineKm: 5 }),
    ]);
    expect(assessCautions({ ...base, run: { date: "2026-11-23", distanceKm: 5.49 } })).toEqual([]);
  });

  it("최근 기록이 없으면 시작 설정 거리를 기준으로 한다", () => {
    const result = assessCautions({ ...base, otherRuns: [], run: { date: "2026-11-23", distanceKm: 3.3 } });
    expect(result).toEqual([expect.objectContaining({ kind: "distance_spike", baselineKm: 3 })]);
  });

  it("같은 부위 통증이 3일 연속이면 통증 주의를 낸다 (2일은 아님)", () => {
    const pains = [
      { date: "2026-11-21", part: "knee" as const },
      { date: "2026-11-22", part: "knee" as const },
      { date: "2026-11-23", part: "knee" as const },
    ];
    expect(assessCautions({ ...base, run: null, pains })).toEqual([{ kind: "pain_streak", part: "knee", days: 3 }]);
    expect(assessCautions({ ...base, run: null, pains: pains.slice(1) })).toEqual([]);
  });

  it("다른 부위가 섞이면 연속이 아니다", () => {
    const pains = [
      { date: "2026-11-21", part: "knee" as const },
      { date: "2026-11-22", part: "ankle" as const },
      { date: "2026-11-23", part: "knee" as const },
    ];
    expect(assessCautions({ ...base, run: null, pains })).toEqual([]);
  });
});

describe("adjustRestOfWeek: 이번 주 남은 일정 조정", () => {
  // 2026-11-23은 월요일. 이번 주 일요일은 11-29.
  const days: PlanDay[] = [
    { date: "2026-11-23", kind: "easy", distanceKm: 9 }, // 오늘 — 바꾸지 않는다
    { date: "2026-11-24", kind: "easy", distanceKm: 3 },
    { date: "2026-11-26", kind: "pace", distanceKm: 4 },
    { date: "2026-11-28", kind: "long", distanceKm: 6 },
    { date: "2026-11-30", kind: "long", distanceKm: 20 }, // 다음 주 — 바꾸지 않는다
  ];

  it("주의가 없으면 바꾸지 않는다", () => {
    expect(adjustRestOfWeek(days, "2026-11-23", [])).toBeNull();
  });

  it("거리 주의: 오늘 이후 이번 주 가장 긴 훈련을 가벼운 달리기로 바꾸고 거리를 줄인다", () => {
    const change = adjustRestOfWeek(days, "2026-11-23", [spike]);
    expect(change?.date).toBe("2026-11-28");
    expect(change?.after).toEqual({ date: "2026-11-28", kind: "easy", distanceKm: 4.2 });
    expect(change!.after.distanceKm).toBeLessThan(change!.before.distanceKm);
  });

  it("통증 주의: 같은 훈련을 휴식으로 바꾼다 (거리 주의와 함께여도)", () => {
    expect(adjustRestOfWeek(days, "2026-11-23", [streak])?.after).toEqual({ date: "2026-11-28", kind: "rest", distanceKm: 0 });
    expect(adjustRestOfWeek(days, "2026-11-23", [spike, streak])?.after.kind).toBe("rest");
  });

  it("거리가 같으면 더 이른 날의 훈련을 바꾼다", () => {
    const tie: PlanDay[] = [
      { date: "2026-11-25", kind: "easy", distanceKm: 4 },
      { date: "2026-11-27", kind: "easy", distanceKm: 4 },
    ];
    expect(adjustRestOfWeek(tie, "2026-11-23", [spike])?.date).toBe("2026-11-25");
  });

  it("이번 주에 남은 훈련이 없으면 null이다 (일요일이 오늘이면 다음 주는 바꾸지 않는다)", () => {
    expect(adjustRestOfWeek(days, "2026-11-29", [spike])).toBeNull();
    expect(adjustRestOfWeek(days.filter((d) => d.kind === "rest"), "2026-11-23", [spike])).toBeNull();
  });

  it("휴식일은 대상이 아니다", () => {
    const withRest: PlanDay[] = [{ date: "2026-11-25", kind: "rest", distanceKm: 0 }, { date: "2026-11-27", kind: "easy", distanceKm: 3 }];
    expect(adjustRestOfWeek(withRest, "2026-11-23", [spike])?.date).toBe("2026-11-27");
  });
});

describe("안내 문구", () => {
  it("거리 주의 문구는 진단 표현 없이 기준과 비율을 보여준다", () => {
    const text = cautionText(spike);
    expect(text.body).toContain("5.0km");
    expect(text.body).toContain("20%");
    expect(text.body).not.toMatch(/진단(합니다|됩니다)/);
  });

  it("통증 주의 문구는 부위와 일수, 의사 상담, 진단 아님을 담는다", () => {
    const text = cautionText(streak);
    expect(text.title).toContain("무릎");
    expect(text.title).toContain("3일");
    expect(text.body).toContain("의사와 상담");
    expect(text.body).toContain("의학적 진단이 아닙니다");
  });

  it("조정안은 항상 한 줄 안내를 포함한다 (조정할 일정이 없어도)", () => {
    expect(adjustmentText([spike], null, false)).toContain("거리나 강도를 낮추고");
    expect(adjustmentText([streak], null, false)).toContain("쉬고");
  });

  it("동의하지 않아 저장하지 않았다면 그렇게 알려준다", () => {
    const change = adjustRestOfWeek([{ date: "2026-11-26", kind: "long", distanceKm: 6 }], "2026-11-23", [spike]);
    expect(adjustmentText([spike], change, false)).toContain("저장하지 않았습니다");
    expect(adjustmentText([spike], change, true)).not.toContain("저장하지 않았습니다");
  });
});

describe("processCheckin + 통증 3일 연속", () => {
  const easy = { kind: "easy", distanceKm: 3 } as const;
  const knee = [{ part: "knee" as const, days: 3 }];

  it("통증이 3일 연속이면 컨디션이 좋아도 오늘 훈련을 휴식으로 바꾼다", () => {
    const result = processCheckin({ condition: "good", dangerSymptoms: [] }, easy, knee);
    expect(result).toMatchObject({ changed: true, reason: "pain", painStreaks: knee });
    expect(result.workout).toEqual({ kind: "rest", distanceKm: 0 });
  });

  it("위험 증상이 있으면 이유는 위험 증상이다", () => {
    expect(processCheckin({ condition: "good", dangerSymptoms: ["chest_pain"] }, easy, knee).reason).toBe("danger");
  });

  it("이미 휴식인 날은 바꾸지 않지만 주의는 남긴다", () => {
    const rest = { kind: "rest", distanceKm: 0 } as const;
    expect(processCheckin({ condition: "good", dangerSymptoms: [] }, rest, knee)).toMatchObject({ changed: false, painStreaks: knee });
  });
});
