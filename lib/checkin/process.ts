import { adjustForCondition, type Workout } from "@/lib/rules/condition";
import { assessDanger } from "@/lib/rules/danger";
import type { PainStreak } from "@/lib/rules/pain";
import type { CheckinInput } from "@/lib/schemas/inputs";
import type { DangerSymptom } from "@/lib/schemas/lists";

// Design Ref: §7.3 훈련 전 체크인 — 위험 증상이 있으면 훈련 제안 중단(AI 호출 없음), 컨디션 나쁨이면 오늘 훈련을 휴식으로 바꾼다.
// 판단은 전부 코드의 고정 규칙이다. 이 파일은 계산만 하며 저장·화면과 섞이지 않는다.

export type CheckinOutcome = {
  hasDanger: boolean;
  symptoms: DangerSymptom[];
  /** 오늘 계획이 있으면 체크인을 반영한 오늘 훈련, 오늘 계획이 없으면 null */
  workout: Workout | null;
  /** 원래 오늘 훈련에서 바뀌었는지 */
  changed: boolean;
  /** 바뀐 이유. 바뀌지 않았으면 null. 위험 증상이 컨디션보다 먼저다. */
  reason: "danger" | "condition" | "pain" | null;
  /** 같은 부위 통증이 3일 연속이라 휴식을 권고하는 부위 (있을 때만) */
  painStreaks: PainStreak[];
  /** 컨디션 때문에 쉬게 된 경우, 가벼운 걷기·조깅으로 대체할 수 있다고 안내할지 */
  offerLightAlternative: boolean;
};

const REST: Workout = { kind: "rest", distanceKm: 0 };

/**
 * 체크인 결과를 계산한다.
 * 1) 위험 증상이 하나라도 있으면 오늘 훈련을 없애고(휴식) 긴급 안내를 보여준다. 컨디션은 보지 않는다.
 * 2) 위험 증상이 없고 컨디션이 "나쁨"이면 오늘 훈련을 휴식으로 바꾼다.
 * 3) 그 외에는 오늘 훈련을 그대로 둔다.
 */
export function processCheckin(
  input: Pick<CheckinInput, "condition" | "dangerSymptoms">,
  todayWorkout: Workout | null,
  painStreaks: readonly PainStreak[] = [],
): CheckinOutcome {
  const danger = assessDanger(input.dangerSymptoms);

  if (danger.hasDanger) {
    return {
      hasDanger: true,
      symptoms: danger.symptoms,
      workout: todayWorkout ? REST : null,
      changed: todayWorkout !== null && todayWorkout.kind !== "rest",
      reason: "danger",
      painStreaks: [...painStreaks],
      offerLightAlternative: false,
    };
  }

  if (todayWorkout === null) {
    return { hasDanger: false, symptoms: [], workout: null, changed: false, reason: null, painStreaks: [...painStreaks], offerLightAlternative: false };
  }

  // 같은 부위 통증 3일 연속이면 오늘 훈련을 쉬게 한다. (컨디션이 나쁠 때와 같은 휴식 처리)
  if (painStreaks.length > 0 && todayWorkout.kind !== "rest") {
    return { hasDanger: false, symptoms: [], workout: REST, changed: true, reason: "pain", painStreaks: [...painStreaks], offerLightAlternative: false };
  }

  const adjustment = adjustForCondition(input.condition, todayWorkout);
  return {
    hasDanger: false,
    symptoms: [],
    workout: adjustment.workout,
    changed: adjustment.changed,
    reason: adjustment.changed ? "condition" : null,
    painStreaks: [...painStreaks],
    offerLightAlternative: adjustment.offerLightAlternative,
  };
}
