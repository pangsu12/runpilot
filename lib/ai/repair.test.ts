import { describe, expect, it } from "vitest";
import { capDistanceSpikes } from "@/lib/ai/repair";
import { validatePlan } from "@/lib/rules/planValidator";
import type { PlanDay } from "@/lib/rules/planTypes";

const day = (n: number, km: number, kind: PlanDay["kind"] = "easy"): PlanDay => ({
  date: `2026-12-${String(n).padStart(2, "0")}`,
  kind: km === 0 ? "rest" : kind,
  distanceKm: km,
});

describe("capDistanceSpikes", () => {
  it("한도 안이면 그대로 둔다", () => {
    const days = [day(1, 3), day(2, 0), day(3, 3.2)];
    expect(capDistanceSpikes(days, 5)).toEqual({ days, changed: false });
  });

  it("직전 최장 거리의 110% 미만으로 줄인다 (정확히 10%도 위반이므로 한 칸 아래)", () => {
    const { days, changed } = capDistanceSpikes([day(1, 5.5), day(2, 9)], 5);
    expect(changed).toBe(true);
    expect(days[0].distanceKm).toBe(5.49); // 5 × 1.1 = 5.5 미만
    expect(days[1].distanceKm).toBeLessThan(5.49 * 1.1);
  });

  it("앞선 훈련이 단계적으로 기준을 올린다", () => {
    const { days, changed } = capDistanceSpikes([day(1, 5.4), day(2, 5.9), day(3, 6.4)], 5);
    expect(changed).toBe(false);
    expect(days.map((d) => d.distanceKm)).toEqual([5.4, 5.9, 6.4]);
  });

  it("휴식 날과 종류는 건드리지 않는다", () => {
    const { days } = capDistanceSpikes([day(1, 0), day(2, 20, "long")], 5);
    expect(days[0].kind).toBe("rest");
    expect(days[1].kind).toBe("long");
  });

  it("고친 계획은 계획 검증기의 거리 규칙을 통과한다", () => {
    const messy = [day(1, 12), day(2, 0), day(3, 30, "long"), day(4, 0), day(5, 2), day(6, 0), day(7, 1)];
    const { days } = capDistanceSpikes(messy, 5);
    const violations = validatePlan({ days }, { today: "2026-12-01", baselineKm: 5, raceDate: null });
    expect(violations.some((v) => v.code === "distance_spike")).toBe(false);
  });
});
