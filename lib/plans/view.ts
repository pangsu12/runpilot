import { TAPER_START_DAYS } from "@/lib/rules/constants";
import type { PlanDay } from "@/lib/rules/planTypes";
import { addDaysIso, daysBetween } from "@/lib/schemas/date";

// Design Ref: §5.3 훈련계획·대시보드 — 계획을 화면에 보여주기 좋은 모양(주 단위, 오늘 칸, 감량 구간)으로 바꾼다.

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 날짜("YYYY-MM-DD")의 요일 이름 */
export function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** 계획을 7일씩 끊어 주 단위로 묶는다. (계획 시작일이 1주차의 첫날) */
export function groupByWeek(days: readonly PlanDay[]): PlanDay[][] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const weeks: PlanDay[][] = [];
  sorted.forEach((day, index) => {
    const week = Math.floor(index / 7);
    (weeks[week] ??= []).push(day);
  });
  return weeks;
}

/** 오늘 계획. 계획이 오늘을 포함하지 않으면 null. */
export function findToday(days: readonly PlanDay[], today: string): PlanDay | null {
  return days.find((day) => day.date === today) ?? null;
}

/** 오늘이 속한 달력 주(월요일~일요일)의 계획 칸들. 계획에 없는 날은 null이다. (화면의 "이번 주 계획"용) */
export function currentWeek(days: readonly PlanDay[], today: string): { date: string; day: PlanDay | null }[] {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addDaysIso(today, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(monday, i);
    return { date, day: days.find((day) => day.date === date) ?? null };
  });
}

/** 대회가 있을 때, 이 날이 감량 구간(대회 21일 전 ~ 전날)인지 */
export function isTaperDay(date: string, raceDate: string | null): boolean {
  if (raceDate === null) return false;
  const daysToRace = daysBetween(date, raceDate);
  return daysToRace >= 1 && daysToRace <= TAPER_START_DAYS;
}

/** 계획의 마지막 날짜. 비어 있으면 null. */
export function planEndDate(days: readonly PlanDay[]): string | null {
  return days.reduce<string | null>((end, day) => (end === null || day.date > end ? day.date : end), null);
}

/** 계획 한눈에 보기: 총 거리, 훈련·휴식 일수, 주차별 거리 (화면의 요약 카드와 주차 막대용) */
export function summarizePlan(days: readonly PlanDay[]): {
  totalKm: number;
  trainingDays: number;
  restDays: number;
  weekKm: number[];
} {
  const training = days.filter((day) => day.kind !== "rest");
  const weekKm = groupByWeek(days).map((week) => week.reduce((sum, day) => sum + (day.kind === "rest" ? 0 : day.distanceKm), 0));
  return {
    totalKm: training.reduce((sum, day) => sum + day.distanceKm, 0),
    trainingDays: training.length,
    restDays: days.length - training.length,
    weekKm,
  };
}

/** 오늘이 계획의 몇 주차인지(0부터). 계획 밖이면 null */
export function currentWeekIndex(days: readonly PlanDay[], today: string): number | null {
  const weeks = groupByWeek(days);
  const index = weeks.findIndex((week) => week.some((day) => day.date === today));
  return index === -1 ? null : index;
}
