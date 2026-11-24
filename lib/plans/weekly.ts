import { addDaysIso, todayInKorea } from "@/lib/schemas/date";

// Design Ref: §6.2 주간 갱신 기준 (설계 결정, 임시) — 한 주는 월요일 시작, 한국 시간.
// 그 주에 계획을 만든 기록이 없으면(마지막 계획이 이번 주 월요일 0시 이전에 만들어졌으면) 이번 주 첫 접속에서 새로 만든다.

/** 날짜("YYYY-MM-DD")가 속한 주의 월요일 */
export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  return addDaysIso(date, weekday === 0 ? -6 : 1 - weekday);
}

/**
 * 마지막 계획을 만든 시각이 이번 주 월요일(한국 시간) 이전이면 갱신이 필요하다.
 * @param lastCreatedAt 마지막 계획의 생성 시각(ISO 문자열)
 * @param now 지금 (시험에서는 고정값을 넘긴다)
 */
export function needsWeeklyRefresh(lastCreatedAt: string, now: Date = new Date()): boolean {
  const created = new Date(lastCreatedAt);
  if (Number.isNaN(created.getTime())) return false;
  const createdDay = todayInKorea(created);
  return createdDay < mondayOf(todayInKorea(now));
}
