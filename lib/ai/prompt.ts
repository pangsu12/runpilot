import type { AiPayload } from "@/lib/ai/payload";
import { AI_NOTES_MAX_LENGTH } from "@/lib/ai/schema";

// Design Ref: §7.5 — AI에 주는 지시문. "대회 날짜·종목·지역 외 정보는 추측하지 말 것"을 반드시 포함한다.
// 지시문은 AI가 규칙을 어길 확률을 줄이는 용도다. 규칙 통과 여부는 항상 코드(검증기)가 다시 확인한다.

export const AI_SYSTEM_PROMPT = [
  "당신은 러닝 훈련계획 초안을 만드는 도우미입니다. 의사가 아니며, 진단이나 치료 조언을 하지 않습니다.",
  "입력으로 받은 JSON의 값만 근거로 삼고, 대회의 날짜·종목·지역 외 정보(코스 특성, 날씨, 신청 마감일 등)는 추측하지 마세요.",
  "반드시 JSON 한 개만 출력하세요. 형식: { days: [{ date, kind, distanceKm }], notes }.",
  "kind는 rest(휴식), easy(가벼운 달리기), pace(페이스 달리기), long(장거리) 중 하나이고, 휴식이면 distanceKm은 0입니다.",
  "계획은 plan.startDate부터 하루도 빠짐없이 날짜순으로 이어지는 plan.weeks주(일수는 7 × weeks)입니다. 대회가 plan 기간 안에 있으면 대회 날짜까지만 만드세요.",
  "규칙: (1) 어느 7일 안에도 휴식일이 1일 이상 있어야 합니다. (2) 각 훈련 거리는 그 훈련 직전까지의 최장 거리(처음에는 recentRuns의 최장 거리, 없으면 profile.longestRunKm, 그것도 0이면 2km)보다 rules.distanceSpikePercent% 이상 길면 안 됩니다. 앞선 훈련을 수행한다고 가정하고 단계적으로 늘리세요. (3) 대회가 있으면 대회 rules.taperStartDaysBeforeRace일 전부터 훈련량을 점진적으로 줄이고, 대회 직전 7일의 총 거리가 감량 시작 직전 7일 총 거리보다 rules.taperFinalWeekReductionPercent 범위(최소~최대 %)만큼 줄어든 수준이 되게 하세요. 대회 당일은 휴식으로 두세요. (4) 대회가 없으면 감량하지 않습니다.",
  "pains나 condition이 있으면 그 부위·상태를 고려해 무리하지 않게 강도를 낮추세요. 병명을 단정하거나 진단하는 표현은 절대 쓰지 마세요.",
  "입력에 previousProblems가 있으면 직전에 만든 계획이 어긴 규칙의 설명입니다. 그 규칙을 지키도록 고쳐서 처음부터 다시 만드세요.",
  `notes는 한국어 ${AI_NOTES_MAX_LENGTH}자 이내의 쉬운 설명입니다. 개인을 식별하는 내용은 쓰지 마세요.`,
].join("\n");

/**
 * 사용자 메시지: 허용 목록으로 고른 값(AiPayload)만 JSON으로 보낸다.
 * 다시 요청할 때는 직전 계획이 어긴 규칙의 일반 설명(previousProblems)을 덧붙인다. (건강정보·날짜 없음)
 */
export function buildUserMessage(payload: AiPayload, previousProblems?: readonly string[]): string {
  if (!previousProblems || previousProblems.length === 0) return JSON.stringify(payload);
  return JSON.stringify({ ...payload, previousProblems: [...previousProblems] });
}
