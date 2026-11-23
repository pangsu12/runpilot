import { describe, expect, it } from "vitest";
import { generateDefaultPlan } from "@/lib/rules/plan";
import type { PlanDay } from "@/lib/rules/planTypes";
import {
  isPlanValid,
  isShortNotice,
  validatePlan,
  type PlanValidationContext,
  type PlanViolationCode,
} from "@/lib/rules/planValidator";
import { addDaysIso } from "@/lib/schemas/date";

// 시험에는 가짜 입력만 쓴다. 계획 시작일: 2026-11-23, 기준 거리 10km
const START = "2026-11-23";
const at = (offset: number) => addDaysIso(START, offset);
const context: PlanValidationContext = { today: START, baselineKm: 10 };

const basePlan = generateDefaultPlan({
  startDate: START,
  experience: "intermediate",
  goal: "record",
  baselineKm: 10,
});

const codes = (days: readonly PlanDay[], ctx: PlanValidationContext = context, texts?: string[]) =>
  validatePlan({ days, texts }, ctx).map((violation) => violation.code);

/** 계획 복사본에서 조건에 맞는 첫 날을 바꾼다 */
const replaceDay = (days: readonly PlanDay[], index: number, patch: Partial<PlanDay>): PlanDay[] =>
  days.map((day, i) => (i === index ? { ...day, ...patch } : day));

const firstIndexOf = (days: readonly PlanDay[], kind: PlanDay["kind"]) =>
  days.findIndex((day) => day.kind === kind);

describe("validatePlan: 정상 계획", () => {
  it("코드가 만든 기본 계획은 통과한다", () => {
    expect(validatePlan({ days: basePlan.days }, context)).toEqual([]);
    expect(isPlanValid({ days: basePlan.days }, context)).toBe(true);
  });

  it("날짜 순서가 섞여 있어도 같은 결과를 낸다", () => {
    const shuffled = [...basePlan.days].reverse();
    expect(validatePlan({ days: shuffled }, context)).toEqual([]);
  });
});

describe("validatePlan: 날짜 검사", () => {
  it("빈 계획은 거부한다", () => {
    expect(codes([])).toEqual(["empty_plan"]);
  });

  it("빠진 날이 있으면 날짜가 이어지지 않는다고 알린다", () => {
    const withGap = basePlan.days.filter((_, index) => index !== 5);
    expect(codes(withGap)).toContain("not_contiguous");
  });

  it("같은 날짜가 두 번 있어도 거부한다", () => {
    expect(codes([basePlan.days[0], ...basePlan.days])).toContain("not_contiguous");
  });

  it("오늘 이전 날짜가 있으면 거부하고, 오늘 날짜는 통과한다", () => {
    expect(codes(basePlan.days, { ...context, today: at(1) })).toContain("past_date");
    expect(codes(basePlan.days, { ...context, today: START })).not.toContain("past_date");
  });

  it("대회 날짜 뒤의 날짜가 있으면 거부한다", () => {
    expect(codes(basePlan.days, { ...context, raceDate: at(5) })).toContain("after_race");
    expect(codes(basePlan.days, { ...context, raceDate: at(27) })).not.toContain("after_race");
  });
});

describe("validatePlan: 휴식일과 훈련 거리", () => {
  it("7일 연속 훈련이면 휴식일이 없다고 알린다", () => {
    const allTraining = basePlan.days.map((day, index) =>
      index < 7 && day.kind === "rest" ? { ...day, kind: "easy" as const, distanceKm: 3 } : day,
    );
    expect(codes(allTraining)).toContain("no_rest_in_week");
  });

  it("어느 7일을 잡아도 휴식이 있으면 통과한다", () => {
    expect(codes(basePlan.days)).not.toContain("no_rest_in_week");
  });

  it("훈련 거리가 0이거나 숫자가 아니면 거부한다", () => {
    const index = firstIndexOf(basePlan.days, "easy");
    expect(codes(replaceDay(basePlan.days, index, { distanceKm: 0 }))).toContain("invalid_distance");
    expect(codes(replaceDay(basePlan.days, index, { distanceKm: Number.NaN }))).toContain("invalid_distance");
    expect(codes(replaceDay(basePlan.days, index, { distanceKm: -2 }))).toContain("invalid_distance");
  });

  it("기준보다 정확히 10% 긴 훈련(10km → 11km)은 거부하고, 10.9km는 통과한다", () => {
    const index = firstIndexOf(basePlan.days, "long");
    expect(codes(replaceDay(basePlan.days, index, { distanceKm: 11 }))).toContain("distance_spike");
    expect(codes(replaceDay(basePlan.days, index, { distanceKm: 10.9 }))).not.toContain("distance_spike");
  });

  it("계획 안에서 앞선 훈련이 수행된다고 보고 기준을 단계적으로 올려 검사한다", () => {
    // 10km → 10.9km(통과) → 11.9km: 처음 기준(10km) 대비로는 19%지만, 직전 최장(10.9km) 대비 9.2%라서 통과
    const days: PlanDay[] = [
      { date: at(0), kind: "long", distanceKm: 10.9 },
      { date: at(1), kind: "rest", distanceKm: 0 },
      { date: at(2), kind: "long", distanceKm: 11.9 },
    ];
    expect(codes(days)).not.toContain("distance_spike");
    // 반대로 한 번에 기준(10km)의 두 배를 뛰면 거부한다
    const jump: PlanDay[] = [
      { date: at(0), kind: "rest", distanceKm: 0 },
      { date: at(1), kind: "long", distanceKm: 20 },
    ];
    expect(codes(jump)).toContain("distance_spike");
  });
});

describe("validatePlan: 대회 감량", () => {
  const race = at(27);
  const racePlan = generateDefaultPlan({
    startDate: START,
    experience: "intermediate",
    goal: "record",
    baselineKm: 10,
    raceDate: race,
  });
  const raceContext: PlanValidationContext = {
    ...context,
    raceDate: race,
    regularWeeklyKm: racePlan.regularWeeklyKm,
  };

  /** 대회 직전 주(7~1일 전)의 훈련일 거리를 모두 distanceKm으로 바꾼다 */
  const withFinalWeekKm = (distanceKm: number): PlanDay[] =>
    racePlan.days.map((day) =>
      day.date >= at(20) && day.date <= at(26) && day.kind !== "rest" ? { ...day, distanceKm } : day,
    );

  it("감량이 제대로 된 계획은 통과한다", () => {
    expect(codes(racePlan.days, raceContext)).toEqual([]);
  });

  it("대회가 가까워지는데 주간 훈련량이 늘면 거부한다", () => {
    const result = codes(withFinalWeekKm(9), raceContext);
    expect(result).toContain("taper_not_decreasing");
  });

  it("대회 직전 주 감소 폭이 60%를 넘으면 거부한다 (거의 쉬는 경우)", () => {
    expect(codes(withFinalWeekKm(1), raceContext)).toContain("taper_out_of_range");
  });

  it("감소 폭이 41%에 못 미치면 거부한다 (거의 줄이지 않은 경우)", () => {
    // 평소 한 주(약 29km)에 가깝게 유지: 훈련일 4번 × 7km
    expect(codes(withFinalWeekKm(7), raceContext)).toContain("taper_out_of_range");
  });

  it("평소 주간 거리를 알 수 없으면 감량 폭은 검사하지 않는다 (줄어드는 방향만 확인)", () => {
    const shortRace = at(10);
    const plan = generateDefaultPlan({
      startDate: START,
      experience: "intermediate",
      goal: "record",
      baselineKm: 10,
      raceDate: shortRace,
    });
    const result = codes(plan.days, { ...context, raceDate: shortRace });
    expect(result).not.toContain("taper_out_of_range");
  });

  it("대회가 없으면 감량 검사를 하지 않는다", () => {
    expect(codes(basePlan.days, context)).toEqual([]);
  });
});

describe("validatePlan: 위험 증상 날", () => {
  it("위험 증상이 체크된 날에 훈련이 있으면 거부하고, 메시지에 날짜를 담지 않는다", () => {
    const trainingDay = basePlan.days.find((day) => day.kind !== "rest")!;
    const violations = validatePlan(
      { days: basePlan.days },
      { ...context, dangerDates: [trainingDay.date] },
    );
    const danger = violations.find((v) => v.code === "training_on_danger_day");
    expect(danger).toBeDefined();
    expect(danger?.date).toBeUndefined();
    expect(danger?.message).not.toContain(trainingDay.date);
  });

  it("위험 증상이 체크된 날이 휴식이면 통과한다", () => {
    const restDay = basePlan.days.find((day) => day.kind === "rest")!;
    expect(codes(basePlan.days, { ...context, dangerDates: [restDay.date] })).toEqual([]);
  });
});

describe("validatePlan: 진단 단정 표현", () => {
  it("설명 글에 진단·병명 단정 표현이 있으면 거부한다", () => {
    expect(codes(basePlan.days, context, ["이번 주는 가볍게. 무릎 염좌로 진단합니다."])).toContain(
      "diagnosis_assertion",
    );
  });

  it('"의학적 진단이 아닙니다" 같은 안내 문구는 통과한다', () => {
    expect(codes(basePlan.days, context, ["의학적 진단이 아닙니다. 천천히 시작하세요."])).toEqual([]);
  });
});

describe("validatePlan: 여러 위반", () => {
  it("여러 규칙을 동시에 어기면 모두 알려준다", () => {
    const result: PlanViolationCode[] = codes(basePlan.days, {
      ...context,
      today: at(3), // 과거 날짜 포함
      raceDate: at(5), // 대회 뒤 날짜 포함
    });
    expect(result).toContain("past_date");
    expect(result).toContain("after_race");
  });
});

describe("isShortNotice", () => {
  it("대회까지 21일 미만이면 짧은 준비 기간이다", () => {
    expect(isShortNotice(START, at(20))).toBe(true);
    expect(isShortNotice(START, at(21))).toBe(false);
  });
});
