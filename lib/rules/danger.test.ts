import { describe, expect, it } from "vitest";
import { assessDanger, EMERGENCY_GUIDANCE_TEXT, isTrainingSuspended } from "@/lib/rules/danger";
import { DANGER_SYMPTOMS } from "@/lib/schemas/lists";

describe("assessDanger: 위험 증상 판정", () => {
  it("체크된 증상이 없으면 일반이다", () => {
    expect(assessDanger([])).toEqual({
      hasDanger: false,
      symptoms: [],
      stopTrainingSuggestions: false,
    });
  });

  it("세 가지 위험 증상은 각각 하나만 있어도 긴급이고 훈련 제안을 멈춘다", () => {
    for (const symptom of DANGER_SYMPTOMS) {
      const result = assessDanger([symptom]);
      expect(result.hasDanger).toBe(true);
      expect(result.stopTrainingSuggestions).toBe(true);
      expect(result.symptoms).toEqual([symptom]);
    }
  });

  it("여러 증상이 함께 체크돼도 중복 없이 목록 순서대로 돌려준다", () => {
    const result = assessDanger([
      "fainting_or_severe_dizziness",
      "chest_pain",
      "chest_pain",
    ]);
    expect(result.symptoms).toEqual(["chest_pain", "fainting_or_severe_dizziness"]);
  });
});

describe("긴급 안내 문구", () => {
  it("PRD 원문과 같고, 운동 중단과 119·응급실 안내를 모두 담는다", () => {
    expect(EMERGENCY_GUIDANCE_TEXT).toBe(
      "운동을 즉시 중단하고, 증상이 계속되거나 심하면 119에 연락하거나 가까운 응급실을 방문하세요",
    );
    expect(EMERGENCY_GUIDANCE_TEXT).toContain("즉시 중단");
    expect(EMERGENCY_GUIDANCE_TEXT).toContain("119");
    expect(EMERGENCY_GUIDANCE_TEXT).toContain("응급실");
  });
});

describe("isTrainingSuspended: 위험 증상 후 훈련 제안 중단", () => {
  it("체크인 기록이 없으면 중단하지 않는다", () => {
    expect(isTrainingSuspended([])).toBe(false);
  });

  it("가장 최근 체크인에 위험 증상이 있으면 중단 중이다", () => {
    expect(
      isTrainingSuspended([
        { date: "2026-11-21", dangerSymptoms: [] },
        { date: "2026-11-22", dangerSymptoms: ["chest_pain"] },
      ]),
    ).toBe(true);
  });

  it("그 뒤 체크인에서 위험 증상이 없다고 확인하면 다시 제안한다", () => {
    expect(
      isTrainingSuspended([
        { date: "2026-11-22", dangerSymptoms: ["severe_shortness_of_breath"] },
        { date: "2026-11-23", dangerSymptoms: [] },
      ]),
    ).toBe(false);
  });

  it("목록 순서와 상관없이 날짜가 가장 최근인 체크인으로 판단한다", () => {
    expect(
      isTrainingSuspended([
        { date: "2026-11-23", dangerSymptoms: ["chest_pain"] },
        { date: "2026-11-21", dangerSymptoms: [] },
      ]),
    ).toBe(true);
  });

  it("옛날에 위험 증상이 있었더라도 최근 체크인이 정상이면 중단하지 않는다", () => {
    expect(
      isTrainingSuspended([
        { date: "2026-10-01", dangerSymptoms: ["chest_pain"] },
        { date: "2026-11-23", dangerSymptoms: [] },
      ]),
    ).toBe(false);
  });

  it("같은 날 체크인이 여러 번이면 목록에서 뒤에 있는 것을 더 최근으로 본다", () => {
    expect(
      isTrainingSuspended([
        { date: "2026-11-23", dangerSymptoms: ["chest_pain"] },
        { date: "2026-11-23", dangerSymptoms: [] },
      ]),
    ).toBe(false);
    expect(
      isTrainingSuspended([
        { date: "2026-11-23", dangerSymptoms: [] },
        { date: "2026-11-23", dangerSymptoms: ["chest_pain"] },
      ]),
    ).toBe(true);
  });
});
