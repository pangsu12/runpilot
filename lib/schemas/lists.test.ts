import { describe, expect, it } from "vitest";
import {
  AGE_BAND_LABELS,
  AGE_BANDS,
  CONDITION_LABELS,
  CONDITIONS,
  DANGER_SYMPTOM_LABELS,
  DANGER_SYMPTOMS,
  EXPERIENCE_LEVEL_LABELS,
  EXPERIENCE_LEVELS,
  GOAL_LABELS,
  GOALS,
  PAIN_INTENSITIES,
  PAIN_INTENSITY_LABELS,
  PAIN_PART_LABELS,
  PAIN_PARTS,
  TRAINING_KIND_LABELS,
  TRAINING_KINDS,
} from "@/lib/schemas/lists";

// 각 고정 목록과 이름표가 서로 어긋나지 않는지 확인한다.
const lists = [
  { name: "통증 부위", values: PAIN_PARTS, labels: PAIN_PART_LABELS },
  { name: "통증 강도", values: PAIN_INTENSITIES, labels: PAIN_INTENSITY_LABELS },
  { name: "컨디션", values: CONDITIONS, labels: CONDITION_LABELS },
  { name: "위험 증상", values: DANGER_SYMPTOMS, labels: DANGER_SYMPTOM_LABELS },
  { name: "훈련 종류", values: TRAINING_KINDS, labels: TRAINING_KIND_LABELS },
  { name: "러닝 경험", values: EXPERIENCE_LEVELS, labels: EXPERIENCE_LEVEL_LABELS },
  { name: "목표", values: GOALS, labels: GOAL_LABELS },
  { name: "나이대", values: AGE_BANDS, labels: AGE_BAND_LABELS },
] as const;

describe("고정 목록", () => {
  for (const { name, values, labels } of lists) {
    it(`${name}: 모든 값에 한국어 이름표가 있고 값이 중복되지 않는다`, () => {
      const labelMap = labels as Record<string, string>;
      expect(new Set(values).size).toBe(values.length);
      for (const value of values) {
        expect(labelMap[value]).toBeTruthy();
      }
      expect(Object.keys(labelMap).sort()).toEqual([...values].sort());
    });
  }

  it("통증 부위는 PRD 목록(무릎·발목·종아리·허벅지·발바닥·허리) 그대로다", () => {
    expect(PAIN_PARTS.map((part) => PAIN_PART_LABELS[part])).toEqual([
      "무릎",
      "발목",
      "종아리",
      "허벅지",
      "발바닥",
      "허리",
    ]);
  });

  it("위험 증상은 가슴 통증·심한 호흡곤란·실신 또는 심한 어지러움 세 가지다", () => {
    expect(DANGER_SYMPTOMS.map((symptom) => DANGER_SYMPTOM_LABELS[symptom])).toEqual([
      "가슴 통증",
      "심한 호흡곤란",
      "실신 또는 심한 어지러움",
    ]);
  });

  it("통증 강도·컨디션·경험·목표는 각각 3가지다", () => {
    expect(PAIN_INTENSITIES).toHaveLength(3);
    expect(CONDITIONS).toHaveLength(3);
    expect(EXPERIENCE_LEVELS).toHaveLength(3);
    expect(GOALS).toHaveLength(3);
  });

  it("나이대는 만 19세 이상부터 시작한다", () => {
    expect(AGE_BANDS[0]).toBe("19-29");
  });
});
