// Design Ref: §5.3 대회 — 가장 가까운 미래 대회 1개를 고른다. (계획 생성·대시보드가 사용)

import { daysBetween } from "@/lib/schemas/date";

export type RaceSummary = { id: string; name: string; race_date: string };

/** 오늘 이후(오늘 포함)의 대회 중 가장 가까운 것. 없으면 null. */
export function nearestUpcomingRace<T extends RaceSummary>(races: readonly T[], today: string): T | null {
  const upcoming = races.filter((race) => race.race_date >= today).sort((a, b) => a.race_date.localeCompare(b.race_date));
  return upcoming[0] ?? null;
}

/** 대회까지 남은 일수 (오늘이면 0). 이미 지났으면 음수. */
export function daysUntilRace(raceDate: string, today: string): number {
  return daysBetween(today, raceDate);
}
