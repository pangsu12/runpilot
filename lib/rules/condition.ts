import type { Condition, TrainingKind } from "@/lib/schemas/lists";

// Design Ref: §7.3 — 컨디션 나쁨 → 오늘 훈련을 휴식으로 변경 (원하면 가벼운 조깅·걷기로 대체)
// Plan SC: 컨디션 기반 조정 — 훈련 전 체크인에서 "나쁨"이면 당일 훈련을 휴식으로 변경

/** 하루치 훈련: 종류와 거리(km). 휴식이면 거리는 0이다. */
export type Workout = { kind: TrainingKind; distanceKm: number };

export type ConditionAdjustment = {
  /** 컨디션을 반영한 오늘 훈련 */
  workout: Workout;
  /** 원래 훈련에서 바뀌었는지 */
  changed: boolean;
  /**
   * 휴식으로 바꾼 경우, "가벼운 조깅이나 걷기로 대체" 선택 버튼을 보여줘야 하는지.
   * 대체 훈련의 강도 기준은 전문가 검토 후 정한다. (PRD M1)
   */
  offerLightAlternative: boolean;
};

/**
 * 컨디션이 "나쁨"이면 오늘 훈련을 휴식으로 바꾼다. "좋음"·"보통"이면 그대로 둔다.
 * 이미 휴식인 날은 바꿀 것이 없으므로 changed와 offerLightAlternative가 모두 false다.
 */
export function adjustForCondition(condition: Condition, workout: Workout): ConditionAdjustment {
  if (condition !== "bad" || workout.kind === "rest") {
    return { workout, changed: false, offerLightAlternative: false };
  }
  return {
    workout: { kind: "rest", distanceKm: 0 },
    changed: true,
    offerLightAlternative: true,
  };
}
