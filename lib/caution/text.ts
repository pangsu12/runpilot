import type { Caution } from "@/lib/caution/assess";
import type { ScheduleChange } from "@/lib/caution/adjust";
import { DISTANCE_SPIKE_PERCENT, PAIN_STREAK_DAYS } from "@/lib/rules/constants";
import { PAIN_PART_LABELS, TRAINING_KIND_LABELS } from "@/lib/schemas/lists";

// Design Ref: §5.2 주의 안내 — 진단이나 병명을 단정하지 않는 쉬운 한국어. 안내 문구는 전문가 검토 필요.

/** 주의 안내 제목과 설명 */
export function cautionText(caution: Caution): { title: string; body: string } {
  if (caution.kind === "distance_spike") {
    return {
      title: "거리가 최근보다 많이 늘었습니다",
      body: `이번 거리가 최근 기준(${caution.baselineKm.toFixed(1)}km)보다 ${Math.round(caution.percentOver)}% 길었습니다. 최근 최장 거리보다 ${DISTANCE_SPIKE_PERCENT}% 이상 늘어난 경우 주의가 필요하다는 참고 기준이며, 개인차가 있습니다.`,
    };
  }
  return {
    title: `${PAIN_PART_LABELS[caution.part]} 통증이 ${caution.days}일 연속 입력되었습니다`,
    body: `같은 부위 통증이 ${PAIN_STREAK_DAYS}일 연속 입력되면 쉬는 것을 권합니다. 통증이 계속되거나 심해지면 운동을 멈추고 의사와 상담하세요. 이 안내는 의학적 진단이 아닙니다.`,
  };
}

/** 조정안 한 줄 (주의가 있을 때 항상 함께 보여준다) */
export function adjustmentText(cautions: readonly Caution[], change: ScheduleChange | null, persisted: boolean): string {
  const advice = cautions.some((c) => c.kind === "pain_streak")
    ? "다음 훈련은 쉬고 몸 상태를 살펴보세요."
    : "다음 훈련은 거리나 강도를 낮추고 무리하지 않도록 하세요.";
  if (!change) return `${advice} (이번 주에 조정할 남은 훈련이 없습니다.)`;
  const after = change.after.kind === "rest" ? "휴식" : `${TRAINING_KIND_LABELS[change.after.kind]} ${change.after.distanceKm.toFixed(2)} km`;
  const before = `${TRAINING_KIND_LABELS[change.before.kind]} ${change.before.distanceKm.toFixed(2)} km`;
  const saved = persisted ? "" : " (동의하지 않아 저장하지 않았습니다. 새로고침하면 원래 계획이 다시 보입니다.)";
  return `${advice} 이번 주 ${change.date.slice(5)}의 ${before}을(를) ${after}(으)로 바꿨습니다.${saved}`;
}
