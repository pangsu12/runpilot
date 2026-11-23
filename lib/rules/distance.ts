import {
  DISTANCE_SPIKE_PERCENT,
  RECENT_RUNS_WINDOW_DAYS,
  START_BASELINE_KM,
} from "@/lib/rules/constants";
import { addDaysIso } from "@/lib/schemas/date";

// Design Ref: §7.4 ① — 이번 거리가 최근 30일 최장 거리보다 10% 이상 더 긴가.
// Plan SC: 주의 안내 — 10% 이상 긴 기록 입력 시 100% 주의 안내 표시 (이 함수가 판단하고, 화면은 결과를 보여준다)
// 이 파일은 화면·저장소·AI와 섞이지 않는 "계산만 하는 코드"다. 숫자는 constants.ts에서 가져온다.

/** 러닝 기록 한 건: 날짜("YYYY-MM-DD")와 거리(km) */
export type RunLog = { date: string; distanceKm: number };

/** 기준 거리를 어디서 가져왔는지 */
export type BaselineSource = "recent_runs" | "profile" | "start_default";

export type DistanceSpikeResult = {
  /** 주의 안내를 보여줘야 하는지 */
  caution: boolean;
  /** 비교 기준이 된 거리(km) */
  baselineKm: number;
  baselineSource: BaselineSource;
  /** 기준보다 몇 % 더 긴지 (기준보다 짧으면 음수) */
  percentOver: number;
};

// 부동소수점 계산 오차(예: 1.1 * 10)로 경계값을 잘못 판정하지 않도록 아주 작은 허용 오차를 둔다.
const EPSILON = 1e-9;

/**
 * 기준일을 포함한 최근 N일(기본 30일) 안의 가장 긴 달리기 거리를 돌려준다. 기록이 없으면 null.
 * 기준일 이후(미래) 기록은 무시한다.
 */
export function longestRecentRunKm(runs: readonly RunLog[], asOfDate: string): number | null {
  const fromDate = addDaysIso(asOfDate, -(RECENT_RUNS_WINDOW_DAYS - 1));
  let longest: number | null = null;

  for (const run of runs) {
    if (run.date < fromDate || run.date > asOfDate) continue;
    if (longest === null || run.distanceKm > longest) longest = run.distanceKm;
  }
  return longest;
}

/**
 * 비교 기준 거리를 정한다. (PRD M2)
 * 1) 최근 30일 기록이 있으면 그중 가장 긴 거리
 * 2) 없으면 시작 설정 때 입력한 "최근 가장 길게 달린 거리"
 * 3) 그 값이 0km(달려본 적 없음)이면 임시 시작 기준 거리
 */
export function resolveBaseline(input: {
  otherRuns: readonly RunLog[];
  asOfDate: string;
  profileLongestKm: number;
}): { km: number; source: BaselineSource } {
  const recent = longestRecentRunKm(input.otherRuns, input.asOfDate);
  if (recent !== null) return { km: recent, source: "recent_runs" };
  if (input.profileLongestKm > 0) return { km: input.profileLongestKm, source: "profile" };
  return { km: START_BASELINE_KM, source: "start_default" };
}

/**
 * 한 번의 달리기가 기준보다 10% 이상 길면 주의(caution)로 판정한다.
 * - `otherRuns`에는 방금 입력한 기록을 뺀 나머지 기록을 넘긴다.
 * - 같은 날 여러 번 달린 기록은 합산하지 않고, 각각 한 번의 달리기로 비교한다.
 */
export function assessDistanceSpike(input: {
  run: RunLog;
  otherRuns: readonly RunLog[];
  profileLongestKm: number;
}): DistanceSpikeResult {
  const baseline = resolveBaseline({
    otherRuns: input.otherRuns,
    asOfDate: input.run.date,
    profileLongestKm: input.profileLongestKm,
  });

  const percentOver = ((input.run.distanceKm - baseline.km) / baseline.km) * 100;
  // 거리 * 100 >= 기준 * (100 + 10) 으로 비교한다. "10% 이상"이므로 정확히 10%도 주의다.
  const caution =
    input.run.distanceKm * 100 >= baseline.km * (100 + DISTANCE_SPIKE_PERCENT) - EPSILON;

  return { caution, baselineKm: baseline.km, baselineSource: baseline.source, percentOver };
}
