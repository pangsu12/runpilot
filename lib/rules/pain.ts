import { PAIN_STREAK_DAYS } from "@/lib/rules/constants";
import { addDaysIso } from "@/lib/schemas/date";
import { PAIN_PARTS, type PainPart } from "@/lib/schemas/lists";

// Design Ref: §7.4 ② — 같은 부위 통증이 달력상 3일 연속인가.
// Plan SC: 증상 반영 — 같은 부위 통증 3일 연속이면 휴식 권고 표시 (이 함수가 판단하고, 화면은 결과를 보여준다)
// 통증 기록은 훈련 전 체크인과 훈련 후 기록 어느 쪽에서 입력했든 "그날 입력"으로 똑같이 센다.

/** 통증 입력 한 건: 입력한 날짜와 부위. 강도는 따지지 않으므로 받지 않는다. */
export type PainLog = { date: string; part: PainPart };

export type PainStreak = {
  part: PainPart;
  /** 기준일까지 이어진 연속 일수 */
  days: number;
};

/**
 * 기준일(보통 방금 통증을 입력한 날)에 끝나는 "같은 부위 연속 입력 일수"를 부위별로 세어,
 * 연속 일수가 minDays 이상인 부위를 돌려준다.
 *
 * - 강도가 약함이어도 센다.
 * - 입력이 없는 날이 하루라도 있으면 연속이 끊긴 것으로 본다.
 * - 기준일에 입력이 없는 부위는 연속 일수가 0이므로 돌려주지 않는다.
 * - 기준일 이후(미래) 기록은 무시하고, 같은 날 같은 부위를 두 번 입력해도 하루로 센다.
 * - 결과는 PAIN_PARTS 순서로 정렬한다.
 */
export function findPainStreaks(
  logs: readonly PainLog[],
  asOfDate: string,
  minDays: number = PAIN_STREAK_DAYS,
): PainStreak[] {
  const datesByPart = new Map<PainPart, Set<string>>();
  for (const log of logs) {
    const dates = datesByPart.get(log.part) ?? new Set<string>();
    dates.add(log.date);
    datesByPart.set(log.part, dates);
  }

  const streaks: PainStreak[] = [];
  for (const part of PAIN_PARTS) {
    const dates = datesByPart.get(part);
    if (!dates) continue;

    let days = 0;
    let day = asOfDate;
    while (dates.has(day)) {
      days += 1;
      day = addDaysIso(day, -1);
    }
    if (days >= minDays) streaks.push({ part, days });
  }
  return streaks;
}
