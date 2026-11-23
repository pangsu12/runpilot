import { describe, expect, it } from "vitest";
import { START_BASELINE_KM } from "@/lib/rules/constants";
import { assessDistanceSpike, longestRecentRunKm, resolveBaseline } from "@/lib/rules/distance";

// 시험에는 가짜 기록만 쓴다. 기준일: 2026-11-23
const TODAY = "2026-11-23";

describe("longestRecentRunKm: 최근 30일 최장 거리", () => {
  it("기록이 없으면 null이다", () => {
    expect(longestRecentRunKm([], TODAY)).toBeNull();
  });

  it("최근 30일 안에서 가장 긴 거리를 돌려준다", () => {
    const runs = [
      { date: "2026-11-01", distanceKm: 8 },
      { date: "2026-11-10", distanceKm: 12 },
      { date: "2026-11-20", distanceKm: 5 },
    ];
    expect(longestRecentRunKm(runs, TODAY)).toBe(12);
  });

  it("기준일을 포함해 30일이므로, 29일 전은 포함하고 30일 전은 제외한다", () => {
    expect(longestRecentRunKm([{ date: "2026-10-25", distanceKm: 20 }], TODAY)).toBe(20); // 29일 전
    expect(longestRecentRunKm([{ date: "2026-10-24", distanceKm: 20 }], TODAY)).toBeNull(); // 30일 전
  });

  it("기준일과 같은 날 기록은 포함하고, 기준일 이후(미래) 기록은 무시한다", () => {
    expect(longestRecentRunKm([{ date: TODAY, distanceKm: 7 }], TODAY)).toBe(7);
    expect(longestRecentRunKm([{ date: "2026-11-24", distanceKm: 30 }], TODAY)).toBeNull();
  });
});

describe("resolveBaseline: 비교 기준 거리", () => {
  it("최근 30일 기록이 있으면 그 최장 거리를 쓴다", () => {
    const result = resolveBaseline({
      otherRuns: [{ date: "2026-11-10", distanceKm: 10 }],
      asOfDate: TODAY,
      profileLongestKm: 3,
    });
    expect(result).toEqual({ km: 10, source: "recent_runs" });
  });

  it("최근 30일 기록이 없으면 시작 설정 거리를 쓴다", () => {
    const result = resolveBaseline({
      otherRuns: [{ date: "2026-09-01", distanceKm: 15 }], // 30일보다 오래된 기록
      asOfDate: TODAY,
      profileLongestKm: 8,
    });
    expect(result).toEqual({ km: 8, source: "profile" });
  });

  it("시작 설정 거리가 0km(달려본 적 없음)이면 임시 시작 기준 거리를 쓴다", () => {
    const result = resolveBaseline({ otherRuns: [], asOfDate: TODAY, profileLongestKm: 0 });
    expect(result).toEqual({ km: START_BASELINE_KM, source: "start_default" });
  });
});

describe("assessDistanceSpike: 10% 주의 판정", () => {
  const otherRuns = [{ date: "2026-11-10", distanceKm: 10 }]; // 기준 10km

  const assess = (distanceKm: number) =>
    assessDistanceSpike({ run: { date: TODAY, distanceKm }, otherRuns, profileLongestKm: 0 });

  it("정확히 10% 더 길면(10km → 11km) 주의다", () => {
    const result = assess(11);
    expect(result.caution).toBe(true);
    expect(result.baselineKm).toBe(10);
    expect(result.baselineSource).toBe("recent_runs");
  });

  it("10%보다 조금 덜 길면(10.99km) 주의가 아니다", () => {
    expect(assess(10.99).caution).toBe(false);
  });

  it("기준과 같거나 짧으면 주의가 아니다", () => {
    expect(assess(10).caution).toBe(false);
    expect(assess(6).caution).toBe(false);
  });

  it("10%를 크게 넘으면 주의이고, 몇 % 더 긴지 알려준다", () => {
    const result = assess(15);
    expect(result.caution).toBe(true);
    expect(result.percentOver).toBeCloseTo(50);
  });

  it("소수점 경계에서도 오차 없이 판정한다 (3.3km → 3.63km)", () => {
    const base = [{ date: "2026-11-10", distanceKm: 3.3 }];
    const at = assessDistanceSpike({
      run: { date: TODAY, distanceKm: 3.63 },
      otherRuns: base,
      profileLongestKm: 0,
    });
    const below = assessDistanceSpike({
      run: { date: TODAY, distanceKm: 3.62 },
      otherRuns: base,
      profileLongestKm: 0,
    });
    expect(at.caution).toBe(true);
    expect(below.caution).toBe(false);
  });

  it("기록이 없으면 시작 설정 거리를 기준으로 판정한다 (8km → 8.8km)", () => {
    const at = assessDistanceSpike({
      run: { date: TODAY, distanceKm: 8.8 },
      otherRuns: [],
      profileLongestKm: 8,
    });
    expect(at.caution).toBe(true);
    expect(at.baselineSource).toBe("profile");
    expect(
      assessDistanceSpike({ run: { date: TODAY, distanceKm: 8.7 }, otherRuns: [], profileLongestKm: 8 })
        .caution,
    ).toBe(false);
  });

  it("달려본 적 없음(0km)이면 시작 기준 거리(2km)의 10%인 2.2km부터 주의다", () => {
    const at = assessDistanceSpike({
      run: { date: TODAY, distanceKm: 2.2 },
      otherRuns: [],
      profileLongestKm: 0,
    });
    expect(at.caution).toBe(true);
    expect(at.baselineSource).toBe("start_default");
    expect(
      assessDistanceSpike({ run: { date: TODAY, distanceKm: 2.19 }, otherRuns: [], profileLongestKm: 0 })
        .caution,
    ).toBe(false);
  });

  it("같은 날 여러 번 달린 기록은 합산하지 않고 각각 한 번으로 비교한다", () => {
    // 같은 날 5km + 6km 두 번: 합산(11km)하면 주의지만, 각각 비교하면 둘 다 기준(10km) 이하다.
    const first = { date: TODAY, distanceKm: 5 };
    const second = { date: TODAY, distanceKm: 6 };
    expect(
      assessDistanceSpike({ run: second, otherRuns: [...otherRuns, first], profileLongestKm: 0 }).caution,
    ).toBe(false);
    expect(
      assessDistanceSpike({ run: first, otherRuns: [...otherRuns, second], profileLongestKm: 0 }).caution,
    ).toBe(false);
  });

  it("미래 날짜의 다른 기록은 기준에 영향을 주지 않는다", () => {
    const result = assessDistanceSpike({
      run: { date: TODAY, distanceKm: 11 },
      otherRuns: [...otherRuns, { date: "2026-11-30", distanceKm: 40 }],
      profileLongestKm: 0,
    });
    expect(result.baselineKm).toBe(10);
    expect(result.caution).toBe(true);
  });
});
