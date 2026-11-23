import { describe, expect, it } from "vitest";
import { requestAiPlan, type CompletionFn } from "@/lib/ai/client";
import { buildAiPayload, type AiPayloadSource } from "@/lib/ai/payload";
import { AI_SYSTEM_PROMPT, buildUserMessage } from "@/lib/ai/prompt";
import { regionFromLocation } from "@/lib/ai/region";
import { AI_RESPONSE_JSON_SCHEMA, aiPlanResponseSchema } from "@/lib/ai/schema";
import { EnvError } from "@/lib/env";

// 시험에는 가짜 값만 쓴다.
const source: AiPayloadSource = {
  profile: { age_band: "30-39", experience: "beginner", goal: "fitness", longest_run_km: "5.00" },
  recentRuns: [{ date: "2026-11-20", distanceKm: 5 }],
  consent: true,
  condition: "normal",
  pains: [{ part: "knee", intensity: "mild" }],
  race: { race_date: "2027-01-10", distance_label: "하프 마라톤(21.0975km)", location: "서울 여의도 한강공원 3번 게이트" },
  today: "2026-11-23",
};

describe("buildAiPayload: 보내는 값 고르기 (허용 목록)", () => {
  it("허용된 값만 담는다", () => {
    const payload = buildAiPayload(source);
    expect(payload).toEqual({
      profile: { ageBand: "30-39", experience: "beginner", goal: "fitness", longestRunKm: 5 },
      recentRuns: [{ date: "2026-11-20", distanceKm: 5 }],
      condition: "normal",
      pains: [{ part: "knee", intensity: "mild" }],
      race: { date: "2027-01-10", distance: "하프 마라톤(21.0975km)", region: "서울" },
      plan: { startDate: "2026-11-23", weeks: 4 },
      rules: {
        distanceSpikePercent: 10,
        taperStartDaysBeforeRace: 21,
        taperFinalWeekReductionPercent: { min: 41, max: 60 },
      },
    });
  });

  it("이메일·계정 ID·이름 같은 다른 칸이 들어와도 결과에 나타나지 않는다", () => {
    const polluted = {
      ...source,
      profile: { ...source.profile, email: "fake@example.com", user_id: "fake-user-id", name: "홍길동", birth_date: "1990-01-01" },
      race: { ...source.race!, official_url: "https://fake.example.com", name: "가짜 마라톤" },
    } as unknown as AiPayloadSource;
    const text = buildUserMessage(buildAiPayload(polluted)!);
    for (const secret of ["fake@example.com", "fake-user-id", "홍길동", "1990-01-01", "fake.example.com", "가짜 마라톤"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("대회 장소의 세부 내용(공원 이름 등)은 보내지 않고 시·도만 보낸다", () => {
    const text = buildUserMessage(buildAiPayload(source)!);
    expect(text).not.toContain("여의도");
    expect(text).not.toContain("게이트");
    expect(text).toContain("서울");
  });

  it("동의하지 않은 사용자의 컨디션·통증은 값이 들어와도 보내지 않는다", () => {
    const payload = buildAiPayload({ ...source, consent: false })!;
    expect(payload.condition).toBeNull();
    expect(payload.pains).toEqual([]);
  });

  it("대회가 없으면 race는 null이다", () => {
    expect(buildAiPayload({ ...source, race: null })!.race).toBeNull();
  });

  it("프로필이 덜 채워졌으면 만들지 않는다", () => {
    expect(buildAiPayload({ ...source, profile: { ...source.profile, goal: null } })).toBeNull();
    expect(buildAiPayload({ ...source, profile: { ...source.profile, longest_run_km: null } })).toBeNull();
    expect(buildAiPayload({ ...source, profile: { ...source.profile, age_band: "10-18" } })).toBeNull();
  });
});

describe("regionFromLocation", () => {
  it("시·도 이름을 찾는다", () => {
    expect(regionFromLocation("서울 여의도")).toBe("서울");
    expect(regionFromLocation("경기도 수원시 월드컵경기장")).toBe("경기");
    expect(regionFromLocation("제주특별자치도 서귀포")).toBe("제주");
    expect(regionFromLocation("충청남도 천안")).toBe("충남");
  });

  it("가장 앞에 나온 시·도를 쓴다", () => {
    expect(regionFromLocation("부산에서 출발해 서울까지")).toBe("부산");
  });

  it("못 찾으면 null이다", () => {
    expect(regionFromLocation("한강공원")).toBeNull();
    expect(regionFromLocation("")).toBeNull();
    expect(regionFromLocation(null)).toBeNull();
  });
});

describe("지시문", () => {
  it('"대회 날짜·종목·지역 외 정보는 추측하지 말 것"을 포함한다', () => {
    expect(AI_SYSTEM_PROMPT).toContain("추측하지");
    expect(AI_SYSTEM_PROMPT).toContain("진단");
  });
});

const payload = buildAiPayload(source)!;
const goodResponse = JSON.stringify({
  days: [
    { date: "2026-11-23", kind: "rest", distanceKm: 0 },
    { date: "2026-11-24", kind: "easy", distanceKm: 3 },
  ],
  notes: "무리하지 않는 계획입니다.",
});
const fake = (impl: CompletionFn) => ({ completion: impl });

describe("requestAiPlan", () => {
  it("정상 응답은 날짜별 훈련 목록으로 돌려준다", async () => {
    const result = await requestAiPlan(payload, fake(async () => goodResponse));
    expect(result).toEqual({
      ok: true,
      notes: "무리하지 않는 계획입니다.",
      days: [
        { date: "2026-11-23", kind: "rest", distanceKm: 0 },
        { date: "2026-11-24", kind: "easy", distanceKm: 3 },
      ],
    });
  });

  it("AI에는 허용 목록으로 고른 값만 보낸다", async () => {
    let seen = "";
    await requestAiPlan(payload, fake(async ({ user }) => ((seen = user), goodResponse)));
    expect(JSON.parse(seen)).toEqual(payload);
  });

  it("JSON이 아니면 bad_format", async () => {
    expect(await requestAiPlan(payload, fake(async () => "계획입니다"))).toEqual({ ok: false, reason: "bad_format" });
    expect(await requestAiPlan(payload, fake(async () => null))).toEqual({ ok: false, reason: "bad_format" });
  });

  it("모양이 다르면 bad_format: 칸 누락·잘못된 종류·음수 거리·없는 날짜·정해지지 않은 칸", async () => {
    const bad = [
      { days: [], notes: "" },
      { days: [{ date: "2026-11-23", kind: "sprint", distanceKm: 3 }], notes: "" },
      { days: [{ date: "2026-11-23", kind: "easy", distanceKm: -1 }], notes: "" },
      { days: [{ date: "2026-02-30", kind: "easy", distanceKm: 3 }], notes: "" },
      { days: [{ date: "2026-11-23", kind: "easy", distanceKm: 3, hr: 150 }], notes: "" },
      { days: [{ date: "2026-11-23", kind: "easy", distanceKm: 3 }] },
      { days: [{ date: "2026-11-23", kind: "easy", distanceKm: 3 }], notes: "가".repeat(501) },
    ];
    for (const value of bad) {
      expect(await requestAiPlan(payload, fake(async () => JSON.stringify(value))), JSON.stringify(value)).toEqual({
        ok: false,
        reason: "bad_format",
      });
    }
  });

  it("시간이 지나면 timeout", async () => {
    const slow: CompletionFn = ({ signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    expect(await requestAiPlan(payload, { completion: slow, timeoutMs: 20 })).toEqual({ ok: false, reason: "timeout" });
  });

  it("호출 오류는 api_error, 환경변수 없음은 config", async () => {
    expect(await requestAiPlan(payload, fake(async () => { throw new Error("boom"); }))).toEqual({ ok: false, reason: "api_error" });
    expect(await requestAiPlan(payload, fake(async () => { throw new EnvError(["OPENAI_API_KEY"]); }))).toEqual({ ok: false, reason: "config" });
  });
});

describe("응답 모양 정의", () => {
  it("OpenAI에 알려 주는 JSON 모양의 칸이 zod 모양과 같다", () => {
    expect([...AI_RESPONSE_JSON_SCHEMA.required].sort()).toEqual(["days", "notes"]);
    expect([...AI_RESPONSE_JSON_SCHEMA.properties.days.items.required].sort()).toEqual(["date", "distanceKm", "kind"]);
    expect(AI_RESPONSE_JSON_SCHEMA.properties.days.items.properties.kind.enum).toEqual(["rest", "easy", "pace", "long"]);
    expect(aiPlanResponseSchema.safeParse(JSON.parse(goodResponse)).success).toBe(true);
  });
});
