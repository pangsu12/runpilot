import type { Caution } from "@/lib/caution/assess";
import { CAUTION_LIGHT_RUN_RATIO, DISTANCE_UNITS_PER_KM } from "@/lib/rules/constants";
import type { PlanDay } from "@/lib/rules/planTypes";
import { addDaysIso } from "@/lib/schemas/date";

// Design Ref: §7.4 이번 주 남은 일정 조정 — 주의 안내가 뜨면 오늘 이후 이번 주 계획 중 가장 긴 훈련을 가벼운 달리기나 휴식으로 바꾼다.
// 조정 폭은 임시값이며 전문가 검토가 필요하다. (CAUTION_LIGHT_RUN_RATIO)

export type ScheduleChange = { date: string; before: PlanDay; after: PlanDay };

/** 이번 주(월요일~일요일)의 마지막 날(일요일) */
function weekEnd(today: string): string {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일
  return addDaysIso(today, weekday === 0 ? 0 : 7 - weekday);
}

/**
 * 주의가 있으면 오늘 이후 이번 주에 남은 훈련 중 가장 긴 것(같으면 더 이른 날)을 하나만 바꾼다.
 * - 통증 3일 연속 주의가 있으면 휴식으로 바꾼다. (가장 강한 조정이 우선)
 * - 거리 급증 주의만 있으면 가벼운 달리기로 바꾸고 거리를 줄인다. 거리는 절대 늘리지 않는다.
 * - 남은 훈련이 없거나 주의가 없으면 null이다.
 */
export function adjustRestOfWeek(days: readonly PlanDay[], today: string, cautions: readonly Caution[]): ScheduleChange | null {
  if (cautions.length === 0) return null;
  const end = weekEnd(today);
  const remaining = days.filter((day) => day.date > today && day.date <= end && day.kind !== "rest");
  if (remaining.length === 0) return null;

  const target = remaining.reduce((best, day) =>
    day.distanceKm > best.distanceKm || (day.distanceKm === best.distanceKm && day.date < best.date) ? day : best,
  );

  if (cautions.some((caution) => caution.kind === "pain_streak")) {
    return { date: target.date, before: target, after: { date: target.date, kind: "rest", distanceKm: 0 } };
  }

  const reduced = Math.floor(target.distanceKm * CAUTION_LIGHT_RUN_RATIO * DISTANCE_UNITS_PER_KM + 1e-9) / DISTANCE_UNITS_PER_KM;
  if (reduced <= 0) {
    return { date: target.date, before: target, after: { date: target.date, kind: "rest", distanceKm: 0 } };
  }
  return { date: target.date, before: target, after: { date: target.date, kind: "easy", distanceKm: reduced } };
}
