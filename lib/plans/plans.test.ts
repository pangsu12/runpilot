import { describe, expect, it } from "vitest";
import { buildDefaultPlan } from "@/lib/plans/build";
import { currentWeek, findToday, groupByWeek, isTaperDay, weekdayLabel } from "@/lib/plans/view";
import { validatePlan } from "@/lib/rules/planValidator";

const TODAY = "2026-11-23"; // 월요일
const profile = { experience: "beginner", goal: "fitness", longest_run_km: "5.00" };

describe("buildDefaultPlan: 기본 계획 만들기", () => {
  it("시작 설정을 마치지 않았으면 만들지 않는다", () => {
    expect(buildDefaultPlan({ profile: null, runs: [], races: [], today: TODAY })).toEqual({ ok: false, reason: "profile_incomplete" });
    for (const missing of ["experience", "goal", "longest_run_km"] as const) {
      const result = buildDefaultPlan({ profile: { ...profile, [missing]: null }, runs: [], races: [], today: TODAY });
      expect(result, missing).toEqual({ ok: false, reason: "profile_incomplete" });
    }
  });

  it("대회가 없으면 오늘부터 4주(28일) 계획을 만들고 검증기를 통과한다", () => {
    const result = buildDefaultPlan({ profile, runs: [], races: [], today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.days).toHaveLength(28);
      expect(result.plan.days[0].date).toBe(TODAY);
      expect(result.raceDate).toBeNull();
      expect(result.baselineKm).toBe(5);
      expect(validatePlan({ days: result.plan.days }, { today: TODAY, baselineKm: 5, raceDate: null, regularWeeklyKm: result.plan.regularWeeklyKm })).toEqual([]);
    }
  });

  it("0km(달려본 적 없음)이면 임시 시작 기준 거리(2km)에서 시작한다", () => {
    const result = buildDefaultPlan({ profile: { ...profile, longest_run_km: 0 }, runs: [], races: [], today: TODAY });
    expect(result.ok && result.baselineKm).toBe(2);
  });

  it("최근 30일 기록이 있으면 그 최장 거리가 기준이 된다", () => {
    const result = buildDefaultPlan({ profile, runs: [{ date: "2026-11-20", distanceKm: 8 }], races: [], today: TODAY });
    expect(result.ok && result.baselineKm).toBe(8);
  });

  it("가장 가까운 미래 대회까지만 계획하고 지난 대회는 무시한다", () => {
    const races = [
      { id: "1", name: "지난", race_date: "2026-11-01" },
      { id: "2", name: "먼", race_date: "2027-06-01" },
      { id: "3", name: "가까운", race_date: "2026-12-20" },
    ];
    const result = buildDefaultPlan({ profile, runs: [], races, today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.raceDate).toBe("2026-12-20");
      expect(result.plan.days.at(-1)?.date).toBe("2026-12-20");
      expect(result.plan.days.at(-1)?.kind).toBe("rest"); // 대회 당일은 훈련하지 않는 칸
    }
  });

  it("대회가 3주 미만으로 남았으면 shortNotice를 알린다", () => {
    const result = buildDefaultPlan({ profile, runs: [], races: [{ id: "1", name: "곧", race_date: "2026-12-05" }], today: TODAY });
    expect(result.ok && result.plan.shortNotice).toBe(true);
  });

  it("모든 경험·목표 조합에서 검증기를 통과한다", () => {
    for (const experience of ["beginner", "intermediate", "advanced"]) {
      for (const goal of ["fitness", "record", "pace"]) {
        const result = buildDefaultPlan({
          profile: { experience, goal, longest_run_km: 3 },
          runs: [],
          races: [{ id: "1", name: "대회", race_date: "2027-01-10" }],
          today: TODAY,
        });
        expect(result.ok, `${experience}/${goal}`).toBe(true);
      }
    }
  });
});

describe("계획 화면 도우미", () => {
  const built = buildDefaultPlan({ profile, runs: [], races: [], today: TODAY });
  const days = built.ok ? built.plan.days : [];

  it("요일 이름을 돌려준다", () => {
    expect(weekdayLabel("2026-11-23")).toBe("월");
    expect(weekdayLabel("2026-11-29")).toBe("일");
  });

  it("28일 계획은 7일씩 4주로 묶인다", () => {
    const weeks = groupByWeek(days);
    expect(weeks).toHaveLength(4);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("오늘 칸을 찾고, 계획 밖의 날짜는 null이다", () => {
    expect(findToday(days, TODAY)?.date).toBe(TODAY);
    expect(findToday(days, "2027-03-01")).toBeNull();
  });

  it("이번 주는 월요일부터 일요일까지 7칸이고, 일요일이 오늘이어도 같은 주다", () => {
    const week = currentWeek(days, TODAY);
    expect(week.map((cell) => cell.date)[0]).toBe("2026-11-23");
    expect(week).toHaveLength(7);
    const sunday = currentWeek(days, "2026-11-29");
    expect(sunday[0].date).toBe("2026-11-23");
    expect(sunday[6].date).toBe("2026-11-29");
    // 계획 시작 전 날짜는 null 칸
    expect(currentWeek(days, "2026-11-25").every((cell) => cell.day !== null)).toBe(true);
  });

  it("감량 구간은 대회 21일 전부터 전날까지다 (대회 당일·22일 전은 아님)", () => {
    expect(isTaperDay("2026-12-20", "2027-01-10")).toBe(true); // 21일 전
    expect(isTaperDay("2026-12-19", "2027-01-10")).toBe(false); // 22일 전
    expect(isTaperDay("2027-01-09", "2027-01-10")).toBe(true);
    expect(isTaperDay("2027-01-10", "2027-01-10")).toBe(false);
    expect(isTaperDay("2026-12-25", null)).toBe(false);
  });
});

import { currentWeekIndex, summarizePlan } from "@/lib/plans/view";

describe("summarizePlan / currentWeekIndex", () => {
  const days = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-12-${String(i + 1).padStart(2, "0")}`,
    kind: i % 7 === 6 ? ("rest" as const) : ("easy" as const),
    distanceKm: i % 7 === 6 ? 0 : 3,
  }));

  it("총 거리, 훈련·휴식 일수, 주차별 거리를 센다", () => {
    expect(summarizePlan(days)).toEqual({ totalKm: 36, trainingDays: 12, restDays: 2, weekKm: [18, 18] });
  });

  it("오늘이 몇 주차인지 알려 주고, 계획 밖이면 null", () => {
    expect(currentWeekIndex(days, "2026-12-01")).toBe(0);
    expect(currentWeekIndex(days, "2026-12-09")).toBe(1);
    expect(currentWeekIndex(days, "2026-11-30")).toBeNull();
  });
});
