import { DANGER_SYMPTOMS, type DangerSymptom } from "@/lib/schemas/lists";

// Design Ref: §7.3, §9 — 위험 증상 판단은 AI가 아니라 서비스 코드의 고정 규칙이 한다. (AI 호출 이전에 처리)
// Plan SC: 위험 증상 안내 — 위험 증상 체크 시 100% 훈련 제안 중단과 긴급 안내 표시

/**
 * 위험 증상이 있을 때 보여주는 긴급 안내 문구 (PRD M2).
 * 의사 상담 문구만 표시하지 않고, 운동 중단과 119·응급실 안내를 함께 보여준다.
 * 안내 문구는 전문가 검토 필요.
 */
export const EMERGENCY_GUIDANCE_TEXT =
  "운동을 즉시 중단하고, 증상이 계속되거나 심하면 119에 연락하거나 가까운 응급실을 방문하세요";

export type DangerAssessment = {
  /** 위험 증상이 하나라도 있는지 */
  hasDanger: boolean;
  /** 체크된 위험 증상 (중복 없이 DANGER_SYMPTOMS 순서) */
  symptoms: DangerSymptom[];
  /** true이면 훈련 제안을 멈추고 긴급 안내를 보여준다 */
  stopTrainingSuggestions: boolean;
};

/** 체크된 위험 증상 중 하나라도 있으면 긴급으로 판정한다. 없으면 일반이다. */
export function assessDanger(checked: readonly DangerSymptom[]): DangerAssessment {
  const symptoms = DANGER_SYMPTOMS.filter((symptom) => checked.includes(symptom));
  const hasDanger = symptoms.length > 0;
  return { hasDanger, symptoms, stopTrainingSuggestions: hasDanger };
}

/** 지난 체크인 한 건: 날짜와 그날 체크한 위험 증상 */
export type CheckinHistoryItem = {
  date: string;
  dangerSymptoms: readonly DangerSymptom[];
};

/**
 * 위험 증상을 체크한 뒤에는, 다음 체크인에서 위험 증상이 없다고 확인하기 전까지 훈련 제안을 중단한다.
 * (PRD M2, 재개 기준은 전문가 검토 필요) → 가장 최근 체크인이 위험이면 중단 중, 아니면 중단 아님.
 * 날짜가 같은 체크인이 여럿이면 목록에서 뒤에 있는 것을 더 최근으로 본다.
 * 저장된 체크인만 알 수 있으므로, 동의를 거부한 사용자(저장 안 함)에게는 그 화면에서만 적용한다.
 */
export function isTrainingSuspended(history: readonly CheckinHistoryItem[]): boolean {
  let latest: CheckinHistoryItem | null = null;
  for (const item of history) {
    if (latest === null || item.date >= latest.date) latest = item;
  }
  return latest !== null && assessDanger(latest.dangerSymptoms).hasDanger;
}
