import { DISTANCE_SPIKE_PERCENT, DISTANCE_UNITS_PER_KM } from "@/lib/rules/constants";
import type { PlanDay } from "@/lib/rules/planTypes";

// Design Ref: §7.5 — AI는 거리 계산(직전 최장 거리보다 10% 미만으로 늘리기)을 자주 틀린다.
// 틀린 훈련은 코드가 허용 한도까지만 줄여 고친다. 거리를 줄이는 방향이라 더 위험해지지 않으며,
// 고친 계획도 반드시 전체 규칙 검증을 다시 통과해야 사용자에게 보인다. (검증기는 그대로다)

/**
 * 어느 훈련도 "직전까지의 최장 거리"의 (100 + DISTANCE_SPIKE_PERCENT)% 미만이 되도록 거리를 줄인다.
 * 줄인 결과가 0.01km 이하이면 휴식으로 바꾼다. 날짜순으로 정렬된 계획을 받는다.
 * @returns 고친 계획과 고친 훈련이 있었는지
 */
export function capDistanceSpikes(days: readonly PlanDay[], baselineKm: number): { days: PlanDay[]; changed: boolean } {
  let runningMax = baselineKm;
  let changed = false;
  const result = days.map((day): PlanDay => {
    if (day.kind === "rest" || !(day.distanceKm > 0)) return day;
    // 허용 한도(미만)를 0.01km 단위로 계산: 한도 바로 아래 값
    const limitUnits = Math.ceil(runningMax * DISTANCE_UNITS_PER_KM * (1 + DISTANCE_SPIKE_PERCENT / 100) - 1e-9) - 1;
    const maxKm = limitUnits / DISTANCE_UNITS_PER_KM;
    if (day.distanceKm <= maxKm) {
      if (day.distanceKm > runningMax) runningMax = day.distanceKm;
      return day;
    }
    changed = true;
    if (maxKm <= 0) return { date: day.date, kind: "rest", distanceKm: 0 };
    runningMax = Math.max(runningMax, maxKm);
    return { date: day.date, kind: day.kind, distanceKm: maxKm };
  });
  return { days: result, changed };
}
