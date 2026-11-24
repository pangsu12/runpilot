import { describe, expect, it } from "vitest";
import { adjustRestOfWeek } from "@/lib/caution/adjust";
import { assessCautions } from "@/lib/caution/assess";
import { adjustmentText, cautionText } from "@/lib/caution/text";
import type { PlanDay } from "@/lib/rules/planTypes";

// PLAN 성공 기준(DESIGN 10.1) "주의 사례 20건": 기준보다 10% 이상 긴 기록을 넣으면 100% 주의가 뜨고, 모두 조정안이 함께 나온다.
// 시험에는 가짜 값만 쓴다.

const TODAY = "2026-11-23"; // 월요일
const week: PlanDay[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  date: `2026-11-${23 + n}`,
  kind: n % 2 === 0 ? "rest" : "easy",
  distanceKm: n % 2 === 0 ? 0 : 5,
}));

// [기준 거리(최근 최장), 이번 거리] — 모두 기준보다 10% 이상 김
const SPIKE_CASES: [number, number][] = [
  [10, 11], [10, 12], [10, 15], [5, 5.5], [5, 6], [5, 8], [3, 3.3], [3, 4], [2, 2.2], [2, 3],
  [8, 8.8], [8, 9], [12, 13.2], [12, 20], [4.5, 5], [6, 6.6], [7, 7.7], [15, 16.5], [20, 22], [1, 1.1],
];
// 기준 이하이거나 10% 미만인 경우
const NORMAL_CASES: [number, number][] = [[10, 10], [10, 10.9], [10, 5], [5, 5.4], [8, 8.7]];

describe("주의 사례 20건: 10% 이상 긴 기록은 100% 주의와 조정안이 함께 나온다", () => {
  it.each(SPIKE_CASES)("기준 %skm → 이번 %skm", (baseline, distance) => {
    const cautions = assessCautions({
      run: { date: TODAY, distanceKm: distance },
      otherRuns: [{ date: "2026-11-10", distanceKm: baseline }],
      profileLongestKm: baseline,
      pains: [],
      painAsOf: TODAY,
    });
    expect(cautions.map((c) => c.kind)).toEqual(["distance_spike"]);
    expect(cautionText(cautions[0]).title).not.toBe("");
    // 조정안: 이번 주 남은 훈련이 있으면 바꾸고, 거리는 절대 늘리지 않으며, 설명 글은 항상 나온다.
    const change = adjustRestOfWeek(week, TODAY, cautions);
    expect(change).not.toBeNull();
    expect(change!.after.distanceKm).toBeLessThanOrEqual(change!.before.distanceKm);
    expect(adjustmentText(cautions, change, true)).toContain("바꿨습니다");
  });

  it.each(NORMAL_CASES)("주의 아님: 기준 %skm → 이번 %skm", (baseline, distance) => {
    const cautions = assessCautions({
      run: { date: TODAY, distanceKm: distance },
      otherRuns: [{ date: "2026-11-10", distanceKm: baseline }],
      profileLongestKm: baseline,
      pains: [],
      painAsOf: TODAY,
    });
    expect(cautions).toEqual([]);
  });

  it("남은 훈련이 없는 날에도 주의 안내에는 조정 문구가 나온다", () => {
    const cautions = assessCautions({
      run: { date: "2026-11-29", distanceKm: 12 },
      otherRuns: [{ date: "2026-11-20", distanceKm: 10 }],
      profileLongestKm: 10,
      pains: [],
      painAsOf: "2026-11-29",
    });
    expect(cautions).toHaveLength(1);
    const change = adjustRestOfWeek(week, "2026-11-29", cautions);
    expect(change).toBeNull();
    expect(adjustmentText(cautions, change, true)).toContain("다음 훈련은");
  });
});
