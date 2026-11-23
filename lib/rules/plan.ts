import {
  DISTANCE_RATIO_OF_LONG,
  DISTANCE_SPIKE_PERCENT,
  DISTANCE_UNITS_PER_KM,
  PLAN_WEEKS,
  TAPER_START_DAYS,
  TAPER_STEP_MULTIPLIERS,
  TRAINING_DAY_SLOTS,
  WEEKLY_LONG_GROWTH_PERCENT,
  WEEKLY_PACE_RUNS,
  WEEKLY_TRAINING_COUNT,
} from "@/lib/rules/constants";
import type { PlanDay } from "@/lib/rules/planTypes";
import { addDaysIso, daysBetween } from "@/lib/schemas/date";
import type { ExperienceLevel, Goal, TrainingKind } from "@/lib/schemas/lists";

/** 실제로 달리는 훈련 종류 (휴식 제외) */
export type RunKind = Exclude<TrainingKind, "rest">;

// Design Ref: §6.3 기본 4주 계획 구성 규칙, §7.2 — AI 없이 코드가 만드는 안전한 기본 계획.
// Plan SC: AI 계획 규칙 통과율 — AI가 실패하거나 규칙을 어기면 이 기본 계획으로 대체한다.
// 이 계획은 lib/rules/planValidator.ts의 검증을 항상 통과하도록 만든다. (시험으로 확인)

export type DefaultPlanInput = {
  /** 계획 시작일 ("YYYY-MM-DD") */
  startDate: string;
  experience: ExperienceLevel;
  goal: Goal;
  /** 장거리의 출발점이 되는 기준 거리(km). resolveBaseline이 정한 값을 넘긴다. */
  baselineKm: number;
  /** 가장 가까운 미래 대회 날짜. 없으면 null */
  raceDate?: string | null;
  /** 계획 기간(주). 기본 4주 */
  weeks?: number;
};

export type DefaultPlan = {
  days: PlanDay[];
  raceDate: string | null;
  /** 이 계획 안에서 감량이 시작되는 날. 감량 구간이 계획에 없으면 null */
  taperStartDate: string | null;
  /** 대회까지 권장 준비 기간(3주)보다 짧은지. true면 "권장 준비 기간보다 짧다"고 안내한다. */
  shortNotice: boolean;
  /** 감량의 기준이 되는 "평소" 주간 훈련 거리(km). 검증기의 regularWeeklyKm으로 쓴다. */
  regularWeeklyKm: number;
};

/** 0.01km(10m) 단위로 내린다. 내림은 거리를 줄이는 방향이다. */
function floorToStep(km: number): number {
  return Math.floor(km * DISTANCE_UNITS_PER_KM + 1e-9) / DISTANCE_UNITS_PER_KM;
}

/**
 * 한 주 동안의 훈련 종류 순서를 정한다. 마지막 훈련은 장거리(주 1회)이고,
 * 페이스 달리기는 나머지 훈련 사이에 고르게 흩어 놓으며, 그 밖은 가벼운 달리기다.
 */
export function weeklyKinds(experience: ExperienceLevel, goal: Goal): RunKind[] {
  const nonLongCount = WEEKLY_TRAINING_COUNT[experience] - 1;
  const paceRuns = Math.min(WEEKLY_PACE_RUNS[goal], nonLongCount);
  const kinds: RunKind[] = Array.from({ length: nonLongCount }, () => "easy");
  for (let i = 0; i < paceRuns; i += 1) {
    kinds[Math.floor((i * nonLongCount) / paceRuns)] = "pace";
  }
  return [...kinds, "long"];
}

/** 감량 구간의 배율. 대회 21~15일 전 0.8 / 14~8일 전 0.65 / 7~1일 전 0.5 / 그 전에는 1 */
function taperMultiplier(daysToRace: number | null): number {
  if (daysToRace === null || daysToRace > TAPER_START_DAYS) return 1;
  if (daysToRace >= 15) return TAPER_STEP_MULTIPLIERS[0];
  if (daysToRace >= 8) return TAPER_STEP_MULTIPLIERS[1];
  return TAPER_STEP_MULTIPLIERS[2];
}

/**
 * 안전한 기본 훈련계획을 만든다. (기본 4주, 대회가 가까우면 대회 날짜까지)
 *
 * - 훈련하는 날은 경험 단계별 7일 주기(TRAINING_DAY_SLOTS)로 정하고, 나머지 날은 모두 휴식이다.
 * - 장거리는 기준 거리에서 시작해 주마다 조금씩 늘린다. (늘리는 폭은 항상 10% 미만)
 * - 대회가 있으면 대회 약 3주 전부터 훈련량을 3단계로 줄이고, 대회 날짜까지만 계획한다.
 *   대회 당일은 훈련하지 않는 휴식 칸으로 둔다.
 * - 대회까지 3주가 안 남았으면 남은 기간 안에서만 줄인다(shortNotice).
 */
export function generateDefaultPlan(input: DefaultPlanInput): DefaultPlan {
  const { startDate, experience, goal, baselineKm } = input;
  const raceDate = input.raceDate ?? null;
  const totalDays = (input.weeks ?? PLAN_WEEKS) * 7;

  let dayCount = totalDays;
  if (raceDate !== null) {
    const daysToRaceFromStart = daysBetween(startDate, raceDate);
    if (daysToRaceFromStart < 0) {
      throw new RangeError("대회 날짜가 계획 시작일보다 앞입니다.");
    }
    dayCount = Math.min(totalDays, daysToRaceFromStart + 1);
  }
  const planEndDate = addDaysIso(startDate, dayCount - 1);

  // 이 계획 안에서 감량이 시작되는 날 (대회 21일 전, 단 계획 시작일보다 이르면 시작일)
  let taperStartDate: string | null = null;
  if (raceDate !== null) {
    const candidate = addDaysIso(raceDate, -TAPER_START_DAYS);
    const start = candidate < startDate ? startDate : candidate;
    if (start <= planEndDate) taperStartDate = start;
  }

  const kinds = weeklyKinds(experience, goal);
  const slots = TRAINING_DAY_SLOTS[experience];
  const growth = 1 + WEEKLY_LONG_GROWTH_PERCENT[goal] / 100;

  // 몇 번째 주의 장거리 기준 거리(km). 감량이 시작되면 더 늘리지 않고 그 주 값에 멈춘다.
  const growthWeekOf = (date: string): number => {
    const frozen = taperStartDate !== null && date > taperStartDate ? taperStartDate : date;
    return Math.floor(daysBetween(startDate, frozen) / 7);
  };
  const longKmOfWeek = (week: number): number => baselineKm * growth ** week;

  // 앞선 훈련이 수행된다고 보고 올려 가는 "직전까지의 최장 거리". 출발은 기준 거리다.
  let runningMaxKm = baselineKm;

  const days: PlanDay[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDaysIso(startDate, i);
    const slotIndex = slots.indexOf(i % 7);
    const daysToRace = raceDate === null ? null : daysBetween(date, raceDate);

    // 훈련하지 않는 날이거나 대회 당일이면 휴식이다.
    if (slotIndex === -1 || daysToRace === 0) {
      days.push({ date, kind: "rest", distanceKm: 0 });
      continue;
    }

    const kind = kinds[slotIndex];
    let distanceKm = floorToStep(
      longKmOfWeek(growthWeekOf(date)) * DISTANCE_RATIO_OF_LONG[kind] * taperMultiplier(daysToRace),
    );

    // 안전 상한: 어떤 기준 거리에서도 직전 최장 거리보다 10% 이상 길어지지 않게 한다.
    // (아주 작은 거리에서는 내림해도 정확히 +10%가 될 수 있어서 한 칸 더 낮춘다)
    if (distanceKm * 100 >= runningMaxKm * (100 + DISTANCE_SPIKE_PERCENT) - 1e-9) {
      distanceKm = floorToStep(
        (runningMaxKm * (100 + DISTANCE_SPIKE_PERCENT)) / 100 - 1 / DISTANCE_UNITS_PER_KM,
      );
    }

    // 거리가 0이 되면(기준 거리가 아주 작은 경우) 그날은 쉰다.
    if (distanceKm <= 0) {
      days.push({ date, kind: "rest", distanceKm: 0 });
      continue;
    }
    if (distanceKm > runningMaxKm) runningMaxKm = distanceKm;
    days.push({ date, kind, distanceKm });
  }

  // "평소" 주간 거리: 감량 시작 직전 주의 훈련 거리 (감량이 없으면 첫 주 거리)
  const taperWeek = taperStartDate === null ? 0 : Math.floor(daysBetween(startDate, taperStartDate) / 7);
  const referenceWeek = Math.max(0, taperWeek - 1);
  const regularWeeklyKm = kinds.reduce(
    (sum, kind) => sum + floorToStep(longKmOfWeek(referenceWeek) * DISTANCE_RATIO_OF_LONG[kind]),
    0,
  );

  const shortNotice = raceDate !== null && daysBetween(startDate, raceDate) < TAPER_START_DAYS;
  return { days, raceDate, taperStartDate, shortNotice, regularWeeklyKm };
}
