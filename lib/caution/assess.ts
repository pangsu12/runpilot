import { assessDistanceSpike, type RunLog } from "@/lib/rules/distance";
import { findPainStreaks, type PainLog } from "@/lib/rules/pain";
import type { PainPart } from "@/lib/schemas/lists";

// Design Ref: §7.4 훈련 후 기록 — 규칙 코드: ① 이번 거리가 기준보다 10% 이상 긴가 ② 같은 부위 통증이 3일 연속인가
// Plan SC: 주의 안내 — 해당하면 주의 안내와 조정안을 함께 보여준다. 판단은 코드 규칙이 하고 AI는 쓰지 않는다.

export type Caution =
  | { kind: "distance_spike"; baselineKm: number; percentOver: number }
  | { kind: "pain_streak"; part: PainPart; days: number };

/**
 * 주의가 필요한 경우를 모두 돌려준다. 없으면 빈 목록이다.
 * @param run 방금 입력한 기록(이미 저장했더라도 otherRuns에는 넣지 않는다)
 * @param otherRuns 방금 입력한 기록을 뺀 나머지 기록
 * @param pains 통증 입력 기록. 동의하지 않은 사용자는 저장하지 않으므로 빈 목록을 넘긴다.
 * @param painAsOf 통증 연속 일수를 세는 기준일
 */
export function assessCautions(input: {
  run: RunLog | null;
  otherRuns: readonly RunLog[];
  profileLongestKm: number;
  pains: readonly PainLog[];
  painAsOf: string;
}): Caution[] {
  const cautions: Caution[] = [];

  if (input.run) {
    const spike = assessDistanceSpike({
      run: input.run,
      otherRuns: input.otherRuns,
      profileLongestKm: input.profileLongestKm,
    });
    if (spike.caution) {
      cautions.push({ kind: "distance_spike", baselineKm: spike.baselineKm, percentOver: spike.percentOver });
    }
  }

  for (const streak of findPainStreaks(input.pains, input.painAsOf)) {
    cautions.push({ kind: "pain_streak", part: streak.part, days: streak.days });
  }
  return cautions;
}
