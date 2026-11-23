import {
  DISTANCE_SPIKE_PERCENT,
  MIN_REST_DAYS_PER_WEEK,
  TAPER_FINAL_REDUCTION_PERCENT,
  TAPER_START_DAYS,
} from "@/lib/rules/constants";
import { findDiagnosisAssertions } from "@/lib/rules/diagnosis";
import type { PlanDay } from "@/lib/rules/planTypes";
import { addDaysIso, daysBetween } from "@/lib/schemas/date";

// Design Ref: §7.5 규칙 검증기, PRD M1 "계획 검증" — AI가 만든 계획을 코드가 검사한다.
// Plan SC: AI 계획 규칙 통과율 — 사용자에게 보이는 계획의 100%가 이 검증을 통과해야 한다.
// 코드가 만든 기본 계획도 같은 검증을 통과한다. (시험으로 확인)
// 건강정보 보호: 위험 증상이 체크된 날짜는 오류 기록에 남기지 않는다. (CLAUDE.md, 서버 로그에 건강정보 금지)

export type PlanViolationCode =
  | "empty_plan" // 계획이 비어 있음
  | "not_contiguous" // 날짜가 하루씩 이어지지 않음(빠졌거나 겹침)
  | "invalid_distance" // 훈련 거리가 0 이하이거나 숫자가 아님
  | "past_date" // 오늘 이전 날짜가 있음
  | "after_race" // 대회 날짜 뒤의 날짜가 있음
  | "no_rest_in_week" // 7일 안에 휴식일이 없음
  | "distance_spike" // 직전까지의 최장 거리보다 10% 이상 긴 훈련
  | "taper_not_decreasing" // 감량 구간에서 주간 훈련량이 줄지 않음
  | "taper_out_of_range" // 대회 직전 주 감량 폭이 범위 밖
  | "training_on_danger_day" // 위험 증상이 체크된 날에 훈련이 배정됨
  | "diagnosis_assertion"; // 진단·병명 단정 표현

export type PlanViolation = {
  code: PlanViolationCode;
  /** 사람이 읽는 한국어 설명 (건강정보는 담지 않는다) */
  message: string;
  /** 문제가 있는 날짜 (위험 증상 관련은 담지 않는다) */
  date?: string;
};

/** 검사할 계획: 날짜별 훈련 + (선택) 계획에 붙은 설명 글 */
export type PlanCandidate = {
  days: readonly PlanDay[];
  texts?: readonly string[];
};

export type PlanValidationContext = {
  /** 오늘 날짜(한국 시간). 이보다 앞선 날짜는 거부한다. */
  today: string;
  /** 10% 검사의 출발 기준 거리(km): 최근 30일 최장 거리(없으면 시작 설정 거리 등) */
  baselineKm: number;
  /** 가장 가까운 미래 대회 날짜. 없으면 null */
  raceDate?: string | null;
  /**
   * 감량의 기준이 되는 "평소" 주간 훈련 거리(km).
   * 주지 않으면 감량 시작 직전 7일이 계획 안에 있을 때만 그 합계로 계산한다.
   */
  regularWeeklyKm?: number | null;
  /** 위험 증상이 체크된 날짜들. 이 날에는 훈련을 배정할 수 없다. */
  dangerDates?: readonly string[];
};

// 부동소수점 오차를 피하려는 아주 작은 허용 오차
const EPSILON = 1e-9;

function trainingKm(day: PlanDay): number {
  return day.kind === "rest" ? 0 : day.distanceKm;
}

/** 시작일부터 7일 단위 블록(대회 N일 전 ~ M일 전)의 거리 합. 블록이 계획에 다 없으면 null */
function blockTotal(
  km: ReadonlyMap<string, number>,
  firstDate: string,
  lastDate: string,
): number | null {
  let total = 0;
  for (let date = firstDate; date <= lastDate; date = addDaysIso(date, 1)) {
    const value = km.get(date);
    if (value === undefined) return null;
    total += value;
  }
  return total;
}

/**
 * 계획을 검사해 규칙을 어긴 곳을 모두 돌려준다. 빈 목록이면 통과다.
 * 검사 항목: 날짜 이어짐·오늘 이후·대회 날짜 이내, 7일마다 휴식, 10% 이상 긴 훈련 없음,
 * 대회 3주 전부터 감량, 위험 증상 날 훈련 없음, 진단 단정 표현 없음.
 */
export function validatePlan(plan: PlanCandidate, context: PlanValidationContext): PlanViolation[] {
  const violations: PlanViolation[] = [];
  const days = [...plan.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (days.length === 0) {
    return [{ code: "empty_plan", message: "계획이 비어 있습니다." }];
  }

  // 1) 날짜가 하루씩 이어지는지 (빠진 날이나 겹친 날이 있으면 아래 검사를 믿을 수 없다)
  for (let i = 1; i < days.length; i += 1) {
    if (days[i].date !== addDaysIso(days[i - 1].date, 1)) {
      violations.push({
        code: "not_contiguous",
        message: "날짜가 하루씩 이어지지 않습니다.",
        date: days[i].date,
      });
      break;
    }
  }

  // 2) 훈련 거리 값이 정상인지
  for (const day of days) {
    if (day.kind !== "rest" && !(Number.isFinite(day.distanceKm) && day.distanceKm > 0)) {
      violations.push({
        code: "invalid_distance",
        message: "훈련 거리는 0보다 큰 숫자여야 합니다.",
        date: day.date,
      });
      break;
    }
  }

  // 3) 모든 날짜가 오늘 이후이고, 대회 날짜를 넘지 않는지
  const pastDay = days.find((day) => day.date < context.today);
  if (pastDay) {
    violations.push({
      code: "past_date",
      message: "오늘 이전 날짜에 계획이 있습니다.",
      date: pastDay.date,
    });
  }
  const raceDate = context.raceDate ?? null;
  if (raceDate !== null) {
    const afterRace = days.find((day) => day.date > raceDate);
    if (afterRace) {
      violations.push({
        code: "after_race",
        message: "대회 날짜 뒤에 계획이 있습니다.",
        date: afterRace.date,
      });
    }
  }

  // 4) 어느 7일을 잡아도 휴식일이 있는지 (주 1일 이상 휴식)
  for (let i = 0; i + 7 <= days.length; i += 1) {
    const restCount = days.slice(i, i + 7).filter((day) => day.kind === "rest").length;
    if (restCount < MIN_REST_DAYS_PER_WEEK) {
      violations.push({
        code: "no_rest_in_week",
        message: "7일 안에 휴식일이 없습니다.",
        date: days[i].date,
      });
      break;
    }
  }

  // 5) 각 훈련이 직전까지의 최장 거리보다 10% 이상 길지 않은지
  //    출발 기준은 최근 30일 최장 거리이고, 계획 안에서 앞선 훈련이 수행된다고 보고 기준을 단계적으로 올린다.
  let runningMaxKm = context.baselineKm;
  for (const day of days) {
    const km = trainingKm(day);
    if (!Number.isFinite(km) || km <= 0) continue;
    if (km * 100 >= runningMaxKm * (100 + DISTANCE_SPIKE_PERCENT) - EPSILON) {
      violations.push({
        code: "distance_spike",
        message: "직전까지의 최장 거리보다 10% 이상 긴 훈련이 있습니다.",
        date: day.date,
      });
      break;
    }
    if (km > runningMaxKm) runningMaxKm = km;
  }

  // 6) 대회가 있으면 약 3주 전부터 훈련량이 줄어드는지
  if (raceDate !== null) {
    const kmByDate = new Map(days.map((day) => [day.date, trainingKm(day)]));

    // 대회 21~15일 전 / 14~8일 전 / 7~1일 전, 이 세 블록 중 계획에 모두 들어 있는 것만 비교한다.
    const blocks = [
      blockTotal(kmByDate, addDaysIso(raceDate, -21), addDaysIso(raceDate, -15)),
      blockTotal(kmByDate, addDaysIso(raceDate, -14), addDaysIso(raceDate, -8)),
      blockTotal(kmByDate, addDaysIso(raceDate, -7), addDaysIso(raceDate, -1)),
    ];
    for (let i = 1; i < blocks.length; i += 1) {
      const before = blocks[i - 1];
      const after = blocks[i];
      if (before !== null && after !== null && after > before + EPSILON) {
        violations.push({
          code: "taper_not_decreasing",
          message: "대회가 가까워지는데 주간 훈련량이 줄지 않습니다.",
        });
        break;
      }
    }

    // 대회 직전 주가 "평소" 대비 41~60% 줄었는지 (평소를 알 수 있을 때만)
    const finalWeekKm = blocks[2];
    let regularKm = context.regularWeeklyKm ?? null;
    if (regularKm === null) {
      const taperStart = addDaysIso(raceDate, -TAPER_START_DAYS);
      regularKm = blockTotal(kmByDate, addDaysIso(taperStart, -7), addDaysIso(taperStart, -1));
    }
    if (finalWeekKm !== null && regularKm !== null && regularKm > 0) {
      const reductionPercent = (1 - finalWeekKm / regularKm) * 100;
      if (
        reductionPercent < TAPER_FINAL_REDUCTION_PERCENT.min - EPSILON ||
        reductionPercent > TAPER_FINAL_REDUCTION_PERCENT.max + EPSILON
      ) {
        violations.push({
          code: "taper_out_of_range",
          message: "대회 직전 주 훈련량의 감소 폭이 정해진 범위(41~60%)를 벗어났습니다.",
        });
      }
    }
  }

  // 7) 위험 증상이 체크된 날에 훈련이 배정되지 않았는지 (날짜는 오류에 담지 않는다)
  const dangerDates = new Set(context.dangerDates ?? []);
  if (days.some((day) => dangerDates.has(day.date) && day.kind !== "rest")) {
    violations.push({
      code: "training_on_danger_day",
      message: "위험 증상이 체크된 날에 훈련이 배정되었습니다.",
    });
  }

  // 8) 설명 글에 진단·병명을 단정하는 표현이 없는지
  if ((plan.texts ?? []).some((text) => findDiagnosisAssertions(text).length > 0)) {
    violations.push({
      code: "diagnosis_assertion",
      message: "진단이나 병명을 단정하는 표현이 있습니다.",
    });
  }

  return violations;
}

/** 규칙을 하나도 어기지 않았는지 */
export function isPlanValid(plan: PlanCandidate, context: PlanValidationContext): boolean {
  return validatePlan(plan, context).length === 0;
}

// 대회까지 남은 일수가 권장 준비 기간보다 짧은지 판단할 때 쓰는 도우미 (안내 문구 표시용)
export function isShortNotice(startDate: string, raceDate: string): boolean {
  return daysBetween(startDate, raceDate) < TAPER_START_DAYS;
}
