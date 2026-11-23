import { describe, expect, it } from "vitest";
import { adjustForCondition, type Workout } from "@/lib/rules/condition";
import { CONDITIONS, TRAINING_KINDS } from "@/lib/schemas/lists";

const longRun: Workout = { kind: "long", distanceKm: 12 };
const restDay: Workout = { kind: "rest", distanceKm: 0 };

describe("adjustForCondition: 컨디션에 따른 오늘 훈련 조정", () => {
  it('컨디션이 "나쁨"이면 오늘 훈련을 휴식으로 바꾸고 가벼운 대체를 권할 수 있다', () => {
    expect(adjustForCondition("bad", longRun)).toEqual({
      workout: { kind: "rest", distanceKm: 0 },
      changed: true,
      offerLightAlternative: true,
    });
  });

  it('컨디션이 "좋음"·"보통"이면 훈련을 그대로 둔다', () => {
    for (const condition of ["good", "normal"] as const) {
      expect(adjustForCondition(condition, longRun)).toEqual({
        workout: longRun,
        changed: false,
        offerLightAlternative: false,
      });
    }
  });

  it("이미 휴식인 날은 컨디션이 나빠도 바꿀 것이 없다", () => {
    expect(adjustForCondition("bad", restDay)).toEqual({
      workout: restDay,
      changed: false,
      offerLightAlternative: false,
    });
  });

  it("휴식이 아닌 모든 훈련 종류가 컨디션 나쁨에서 휴식으로 바뀐다", () => {
    for (const kind of TRAINING_KINDS.filter((k) => k !== "rest")) {
      const result = adjustForCondition("bad", { kind, distanceKm: 5 });
      expect(result.workout).toEqual({ kind: "rest", distanceKm: 0 });
      expect(result.changed).toBe(true);
    }
  });

  it("모든 컨디션 값에 대해 오류 없이 결과를 돌려준다", () => {
    for (const condition of CONDITIONS) {
      expect(adjustForCondition(condition, longRun).workout).toBeDefined();
    }
  });
});
