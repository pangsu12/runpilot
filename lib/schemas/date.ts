// Design Ref: §6.2 주간 갱신 기준 — 날짜는 한국 시간 기준으로 다룬다.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" 모양이면서 실제로 있는 날짜인지 확인한다 (예: 2026-02-30은 거부). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** 날짜("YYYY-MM-DD")에 일수를 더하거나 뺀 날짜를 돌려준다. 음수는 이전 날짜다. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 두 날짜 사이의 일수를 돌려준다. 뒤 날짜가 더 늦으면 양수, 앞서면 음수다. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = new Date(`${fromIsoDate}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** 한국 시간 기준 오늘 날짜를 "YYYY-MM-DD"로 돌려준다. 시험에서는 now를 넘겨 고정할 수 있다. */
export function todayInKorea(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
