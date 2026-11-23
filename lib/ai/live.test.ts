import { describe, expect, it } from "vitest";
import { requestAiPlan } from "@/lib/ai/client";
import { buildAiPayload } from "@/lib/ai/payload";

// 실제 OpenAI 호출 확인용 시험. 평소 `npm test`에서는 .env를 읽지 않아 키가 없으므로 건너뛴다.
// 실행: npm run verify:ai  (.env의 키로 가짜 프로필만 보내 1회 호출한다. 키와 응답 내용은 출력하지 않는다.)
const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);

describe.skipIf(!hasKey)("실제 OpenAI 호출 (가짜 프로필)", () => {
  it("계획 후보를 받고 모양 검사를 통과한다", async () => {
    const payload = buildAiPayload({
      profile: { age_band: "30-39", experience: "beginner", goal: "fitness", longest_run_km: 5 },
      recentRuns: [],
      consent: false,
      condition: null,
      pains: [],
      race: null,
      today: "2026-11-23",
    })!;
    const result = await requestAiPlan(payload);
    // 결과 내용은 출력하지 않고, 성공 여부와 일수만 확인한다.
    expect(result.ok, ok(result)).toBe(true);
    if (result.ok) {
      expect(result.days.length).toBeGreaterThanOrEqual(7);
      expect(result.days[0].date).toBe("2026-11-23");
    }
  }, 60_000);
});

function ok(result: { ok: boolean; reason?: string }) {
  return result.ok ? "ok" : `실패 이유: ${result.reason}`;
}
