import { describe, expect, it } from "vitest";
import {
  DISTANCE_SPIKE_PERCENT,
  PLAN_WEEKS,
  TAPER_FINAL_REDUCTION_PERCENT,
  TRAINING_DAY_SLOTS,
  WEEKLY_LONG_GROWTH_PERCENT,
  WEEKLY_PACE_RUNS,
  WEEKLY_TRAINING_COUNT,
} from "@/lib/rules/constants";
import { generateDefaultPlan, weeklyKinds } from "@/lib/rules/plan";
import { validatePlan } from "@/lib/rules/planValidator";
import { addDaysIso } from "@/lib/schemas/date";
import { EXPERIENCE_LEVELS, GOALS } from "@/lib/schemas/lists";

// 시험에는 가짜 입력만 쓴다. 계획 시작일: 2026-11-23
const START = "2026-11-23";
const at = (offset: number) => addDaysIso(START, offset);

describe("구성 규칙 숫자 점검", () => {
  it("경험 단계별 훈련하는 날의 수가 주당 훈련 횟수와 같고, 순번이 0~6 안에서 겹치지 않는다", () => {
    for (const experience of EXPERIENCE_LEVELS) {
      const slots = TRAINING_DAY_SLOTS[experience];
      expect(slots).toHaveLength(WEEKLY_TRAINING_COUNT[experience]);
      expect(new Set(slots).size).toBe(slots.length);
      for (const slot of slots) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThanOrEqual(6);
      }
      // 주 1일 이상 휴식
      expect(slots.length).toBeLessThanOrEqual(6);
    }
  });

  it("장거리를 늘리는 비율은 모두 10%보다 작다 (검증기의 10% 기준을 넘지 않게)", () => {
    for (const goal of GOALS) {
      expect(WEEKLY_LONG_GROWTH_PERCENT[goal]).toBeLessThan(DISTANCE_SPIKE_PERCENT);
    }
  });
});

describe("weeklyKinds: 한 주의 훈련 종류", () => {
  for (const experience of EXPERIENCE_LEVELS) {
    for (const goal of GOALS) {
      it(`${experience} · ${goal}: 장거리 1회, 페이스 ${WEEKLY_PACE_RUNS[goal]}회, 나머지는 가벼운 달리기`, () => {
        const kinds = weeklyKinds(experience, goal);
        expect(kinds).toHaveLength(WEEKLY_TRAINING_COUNT[experience]);
        expect(kinds.at(-1)).toBe("long");
        expect(kinds.filter((kind) => kind === "long")).toHaveLength(1);
        expect(kinds.filter((kind) => kind === "pace")).toHaveLength(WEEKLY_PACE_RUNS[goal]);
        // 휴식은 이 목록에 없다 (훈련하지 않는 날은 7일 주기 순번으로 정한다)
        expect(kinds.every((kind) => kind === "easy" || kind === "pace" || kind === "long")).toBe(true);
      });
    }
  }

  it("페이스 달리기가 연달아 붙지 않도록 흩어 놓는다 (중급·페이스 조절: 2회가 서로 떨어짐)", () => {
    expect(weeklyKinds("advanced", "pace")).toEqual(["pace", "easy", "pace", "easy", "long"]);
  });
});

describe("generateDefaultPlan: 대회가 없을 때", () => {
  const plan = generateDefaultPlan({
    startDate: START,
    experience: "intermediate",
    goal: "record",
    baselineKm: 10,
  });

  it("시작일부터 28일(4주)을 하루씩 이어서 만든다", () => {
    expect(plan.days).toHaveLength(PLAN_WEEKS * 7);
    expect(plan.days[0].date).toBe(START);
    expect(plan.days.at(-1)?.date).toBe(at(27));
    plan.days.forEach((day, index) => expect(day.date).toBe(at(index)));
    expect(plan.raceDate).toBeNull();
    expect(plan.taperStartDate).toBeNull();
    expect(plan.shortNotice).toBe(false);
  });

  it("매주 경험 단계의 훈련 횟수만큼 훈련하고, 나머지는 휴식이다 (주 1일 이상 휴식)", () => {
    for (let week = 0; week < PLAN_WEEKS; week += 1) {
      const block = plan.days.slice(week * 7, week * 7 + 7);
      const trainings = block.filter((day) => day.kind !== "rest");
      expect(trainings).toHaveLength(WEEKLY_TRAINING_COUNT.intermediate);
      expect(block.filter((day) => day.kind === "rest").length).toBeGreaterThanOrEqual(1);
      expect(block.filter((day) => day.kind === "long")).toHaveLength(1);
      expect(block.filter((day) => day.kind === "pace")).toHaveLength(WEEKLY_PACE_RUNS.record);
    }
  });

  it("휴식일의 거리는 0이고, 훈련일의 거리는 0보다 크다", () => {
    for (const day of plan.days) {
      if (day.kind === "rest") expect(day.distanceKm).toBe(0);
      else expect(day.distanceKm).toBeGreaterThan(0);
    }
  });

  it("첫 주 장거리는 기준 거리에서 시작하고, 주마다 조금씩 늘어난다 (기록 향상)", () => {
    const longs = plan.days.filter((day) => day.kind === "long").map((day) => day.distanceKm);
    expect(longs).toHaveLength(4);
    expect(longs[0]).toBeLessThanOrEqual(10);
    for (let i = 1; i < longs.length; i += 1) {
      expect(longs[i]).toBeGreaterThanOrEqual(longs[i - 1]);
    }
    expect(longs[3]).toBeGreaterThan(longs[0]);
  });

  it("어떤 훈련도 장거리보다 길지 않고, 가벼운 달리기는 장거리보다 짧다", () => {
    for (let week = 0; week < PLAN_WEEKS; week += 1) {
      const block = plan.days.slice(week * 7, week * 7 + 7);
      const long = block.find((day) => day.kind === "long")!.distanceKm;
      for (const day of block) expect(day.distanceKm).toBeLessThanOrEqual(long);
      for (const day of block.filter((d) => d.kind === "easy")) expect(day.distanceKm).toBeLessThan(long);
    }
  });

  it("거리는 0.01km(10m) 단위다", () => {
    for (const day of plan.days) {
      expect(Math.abs(day.distanceKm * 100 - Math.round(day.distanceKm * 100))).toBeLessThan(1e-9);
    }
  });

  it("체력 증진 목표에는 페이스 달리기가 없고, 페이스 조절 목표에는 주 2회 있다", () => {
    const fitness = generateDefaultPlan({
      startDate: START,
      experience: "intermediate",
      goal: "fitness",
      baselineKm: 10,
    });
    const pace = generateDefaultPlan({
      startDate: START,
      experience: "intermediate",
      goal: "pace",
      baselineKm: 10,
    });
    expect(fitness.days.filter((day) => day.kind === "pace")).toHaveLength(0);
    expect(pace.days.filter((day) => day.kind === "pace")).toHaveLength(2 * PLAN_WEEKS);
  });

  it("같은 입력이면 항상 같은 계획이 나온다", () => {
    const again = generateDefaultPlan({
      startDate: START,
      experience: "intermediate",
      goal: "record",
      baselineKm: 10,
    });
    expect(again).toEqual(plan);
  });
});

describe("generateDefaultPlan: 대회가 있을 때", () => {
  const base = { startDate: START, experience: "intermediate", goal: "record", baselineKm: 10 } as const;

  it("대회가 계획 기간보다 멀면 28일을 모두 만들고, 대회 3주 전부터 감량이 시작된다", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: at(40) });
    expect(plan.days).toHaveLength(28);
    expect(plan.taperStartDate).toBe(at(19)); // 대회 21일 전
    expect(plan.shortNotice).toBe(false);
  });

  it("대회가 아주 멀어서 감량 구간이 계획에 없으면 감량 시작일은 null이다", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: at(60) });
    expect(plan.days).toHaveLength(28);
    expect(plan.taperStartDate).toBeNull();
  });

  it("대회가 계획 안에 있으면 대회 날짜까지만 만들고, 대회 당일은 휴식 칸이다", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: at(27) });
    expect(plan.days).toHaveLength(28);
    expect(plan.days.at(-1)).toEqual({ date: at(27), kind: "rest", distanceKm: 0 });
    expect(plan.days.every((day) => day.date <= at(27))).toBe(true);
    expect(plan.taperStartDate).toBe(at(6));
  });

  it("대회가 3주 안으로 남았으면 남은 기간만 만들고 짧은 준비 기간임을 알린다", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: at(10) });
    expect(plan.days).toHaveLength(11);
    expect(plan.days.at(-1)?.date).toBe(at(10));
    expect(plan.shortNotice).toBe(true);
    expect(plan.taperStartDate).toBe(START); // 남은 기간 전체가 감량 구간
  });

  it("준비 기간이 정확히 21일이면 짧지 않고, 20일이면 짧다", () => {
    expect(generateDefaultPlan({ ...base, raceDate: at(21) }).shortNotice).toBe(false);
    expect(generateDefaultPlan({ ...base, raceDate: at(20) }).shortNotice).toBe(true);
  });

  it("대회가 시작일 당일이면 휴식 하루짜리 계획이다", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: START });
    expect(plan.days).toEqual([{ date: START, kind: "rest", distanceKm: 0 }]);
  });

  it("대회 날짜가 시작일보다 앞이면 오류를 던진다", () => {
    expect(() => generateDefaultPlan({ ...base, raceDate: at(-1) })).toThrow(RangeError);
  });

  it("대회 직전 주 훈련량이 평소 대비 41~60% 줄어든다", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: at(27) });
    const finalWeek = plan.days
      .filter((day) => day.date >= at(20) && day.date <= at(26))
      .reduce((sum, day) => sum + day.distanceKm, 0);
    const reduction = (1 - finalWeek / plan.regularWeeklyKm) * 100;
    expect(reduction).toBeGreaterThanOrEqual(TAPER_FINAL_REDUCTION_PERCENT.min);
    expect(reduction).toBeLessThanOrEqual(TAPER_FINAL_REDUCTION_PERCENT.max);
  });

  it("감량 3단계가 점차 줄어든다 (21~15일 전 ≥ 14~8일 전 ≥ 7~1일 전)", () => {
    const plan = generateDefaultPlan({ ...base, raceDate: at(27) });
    const total = (from: number, to: number) =>
      plan.days
        .filter((day) => day.date >= at(from) && day.date <= at(to))
        .reduce((sum, day) => sum + day.distanceKm, 0);
    const block1 = total(6, 12); // 대회 21~15일 전
    const block2 = total(13, 19); // 14~8일 전
    const block3 = total(20, 26); // 7~1일 전
    expect(block1).toBeGreaterThan(block2);
    expect(block2).toBeGreaterThan(block3);
  });
});

describe("기준 거리가 아주 작아도 10% 기준은 넘지 않는다", () => {
  it("0.05km~0.4km 같은 극단적인 기준 거리에서도 10% 이상 긴 훈련이 없다", () => {
    const failures: string[] = [];
    for (const experience of EXPERIENCE_LEVELS) {
      for (const goal of GOALS) {
        for (const baselineKm of [0.05, 0.1, 0.2, 0.3, 0.4]) {
          const plan = generateDefaultPlan({ startDate: START, experience, goal, baselineKm });
          const spikes = validatePlan({ days: plan.days }, { today: START, baselineKm }).filter(
            (violation) => violation.code === "distance_spike",
          );
          if (spikes.length > 0) failures.push(`${experience}/${goal}/기준 ${baselineKm}km`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("기본 계획은 어떤 입력에서도 계획 검증기를 통과한다", () => {
  const baselines = [0.5, 1, 2, 3.3, 5, 8, 10.55, 21, 42];
  // 대회 없음, 아주 가까움, 3주 미만, 정확히 3주, 계획 끝, 계획 끝 직후, 계획 뒤 감량 구간, 아주 먼 대회
  const raceOffsets: Array<number | null> = [null, 0, 2, 6, 10, 14, 20, 21, 27, 28, 34, 35, 60];

  it("모든 경험·목표·기준 거리·대회 날짜 조합이 위반 없이 통과한다", () => {
    const failures: string[] = [];

    for (const experience of EXPERIENCE_LEVELS) {
      for (const goal of GOALS) {
        for (const baselineKm of baselines) {
          for (const offset of raceOffsets) {
            const raceDate = offset === null ? null : at(offset);
            const plan = generateDefaultPlan({ startDate: START, experience, goal, baselineKm, raceDate });
            const violations = validatePlan(
              { days: plan.days },
              { today: START, baselineKm, raceDate, regularWeeklyKm: plan.regularWeeklyKm },
            );
            if (violations.length > 0) {
              failures.push(
                `${experience}/${goal}/기준 ${baselineKm}km/대회 ${offset ?? "없음"}: ${violations
                  .map((v) => v.code)
                  .join(", ")}`,
              );
            }
          }
        }
      }
    }

    // 실패한 조합이 있으면 목록 전체가 오류 메시지로 보이도록 한다.
    expect(failures).toEqual([]);
  });
});
