import { describe, expect, it } from "vitest";
import type { AiPlanResult } from "@/lib/ai/client";
import { generateVerifiedPlan } from "@/lib/ai/generate";
import { buildAiPayload } from "@/lib/ai/payload";
import { AI_MAX_RETRIES, AI_TOTAL_BUDGET_MS } from "@/lib/rules/constants";
import type { PlanDay } from "@/lib/rules/planTypes";
import { addDaysIso } from "@/lib/schemas/date";

// 시험에는 가짜 값만 쓴다.
const TODAY = "2026-11-23";
const payload = buildAiPayload({
  profile: { age_band: "30-39", experience: "beginner", goal: "fitness", longest_run_km: 5 },
  recentRuns: [],
  consent: false,
  condition: null,
  pains: [],
  race: null,
  today: TODAY,
})!;
const context = { today: TODAY, baselineKm: 5, raceDate: null };

/** 규칙을 지키는 28일 계획: 6일마다 하루 쉬고 훈련은 3km */
function goodDays(): PlanDay[] {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDaysIso(TODAY, i);
    return i % 4 === 3 ? { date, kind: "rest", distanceKm: 0 } : { date, kind: "easy", distanceKm: 3 };
  });
}
const good: AiPlanResult = { ok: true, days: goodDays(), notes: "무리하지 않는 계획입니다." };
const noRest: AiPlanResult = { ok: true, days: goodDays().map((d) => ({ ...d, kind: "easy", distanceKm: 3 })), notes: "" };

/** 순서대로 결과를 돌려주는 가짜 AI */
function sequence(results: AiPlanResult[]) {
  const calls: { feedback?: readonly string[] }[] = [];
  return {
    calls,
    request: async (_p: unknown, options: { feedback?: readonly string[] }) => {
      calls.push(options);
      return results[Math.min(calls.length - 1, results.length - 1)];
    },
  };
}

describe("generateVerifiedPlan", () => {
  it("규칙을 지키는 계획은 한 번에 통과한다", async () => {
    const ai = sequence([good]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.violationCodes).toEqual([]);
    expect(ai.calls).toHaveLength(1);
  });

  it("규칙을 어기면 위반 설명을 붙여 다시 요청하고, 통과하면 그 계획을 쓴다", async () => {
    const ai = sequence([noRest, good]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.violationCodes).toContain("no_rest_in_week");
    expect(ai.calls[0].feedback).toEqual([]);
    expect(ai.calls[1].feedback?.length).toBeGreaterThan(0);
  });

  it("계속 어기면 첫 요청 + 재요청 2번 = 3번만 부르고 validation_failed로 대체한다", async () => {
    const ai = sequence([noRest]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result).toMatchObject({ ok: false, fallbackReason: "validation_failed", attempts: AI_MAX_RETRIES + 1 });
    expect(ai.calls).toHaveLength(3);
  });

  it("10% 이상 늘린 훈련은 걸러낸다", async () => {
    const spiky = goodDays();
    spiky[1] = { date: spiky[1].date, kind: "long", distanceKm: 8 };
    const ai = sequence([{ ok: true, days: spiky, notes: "" }]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result.ok).toBe(false);
    expect(result.violationCodes).toContain("distance_spike");
  });

  it("설명 글에 진단 단정 표현이 있으면 걸러낸다", async () => {
    const ai = sequence([{ ok: true, days: goodDays(), notes: "무릎 통증은 러너스니라고 진단됩니다." }]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result.ok).toBe(false);
    expect(result.violationCodes).toContain("diagnosis_assertion");
  });

  it("시작일에서 시작하지 않거나 기간을 못 채우면 통과시키지 않는다", async () => {
    const short = sequence([{ ok: true, days: goodDays().slice(0, 10), notes: "" }]);
    expect((await generateVerifiedPlan(payload, context, { request: short.request })).violationCodes).toContain("incomplete_plan");
    const late = sequence([{ ok: true, days: goodDays().slice(1), notes: "" }]);
    expect((await generateVerifiedPlan(payload, context, { request: late.request })).ok).toBe(false);
  });

  it("날짜 순서가 섞여 와도 정리해서 검증한다", async () => {
    const ai = sequence([{ ok: true, days: goodDays().reverse(), notes: "" }]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days[0].date).toBe(TODAY);
  });

  it("시간 초과는 다시 요청하지 않고 timeout으로 대체한다", async () => {
    const ai = sequence([{ ok: false, reason: "timeout" }]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    expect(result).toMatchObject({ ok: false, fallbackReason: "timeout", attempts: 1 });
    expect(ai.calls).toHaveLength(1);
  });

  it("설정 없음·호출 오류는 다시 요청하지 않고 ai_failed로 대체한다", async () => {
    for (const reason of ["config", "api_error"] as const) {
      const ai = sequence([{ ok: false, reason }]);
      const result = await generateVerifiedPlan(payload, context, { request: ai.request });
      expect(result).toMatchObject({ ok: false, fallbackReason: "ai_failed", attempts: 1 });
    }
  });

  it("모양이 틀린 응답은 다시 요청하고, 끝까지 틀리면 validation_failed", async () => {
    const ai = sequence([{ ok: false, reason: "bad_format" }, good]);
    expect((await generateVerifiedPlan(payload, context, { request: ai.request })).ok).toBe(true);
    const never = sequence([{ ok: false, reason: "bad_format" }]);
    const result = await generateVerifiedPlan(payload, context, { request: never.request });
    expect(result).toMatchObject({ ok: false, fallbackReason: "validation_failed", violationCodes: ["bad_format"] });
  });

  it("전체 시간 제한을 넘기면 더 요청하지 않는다", async () => {
    let clock = 0;
    const ai = sequence([noRest]);
    const request: typeof ai.request = async (p, o) => {
      clock += AI_TOTAL_BUDGET_MS;
      return ai.request(p, o);
    };
    const result = await generateVerifiedPlan(payload, context, { request, now: () => clock });
    expect(result).toMatchObject({ ok: false, fallbackReason: "timeout", attempts: 1 });
  });

  it("기록에는 규칙 이름만 남고 날짜·설명 글은 없다", async () => {
    const ai = sequence([{ ok: true, days: goodDays(), notes: "홍길동 무릎 진단됩니다" }]);
    const result = await generateVerifiedPlan(payload, context, { request: ai.request });
    const text = JSON.stringify(result.violationCodes);
    expect(text).not.toContain("홍길동");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
