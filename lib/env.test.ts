import { describe, expect, it } from "vitest";
import { ENV_GROUPS, EnvError, readEnv } from "@/lib/env";

// 시험에는 가짜 값만 쓴다. (실제 키는 사용하지 않는다)
const FAKE_SECRET = "fake-secret-value-for-test";

describe("readEnv: 서버 전용 환경변수 읽기", () => {
  it("필요한 값이 모두 있으면 그 값을 돌려준다", () => {
    const env = readEnv("openai", {
      OPENAI_API_KEY: FAKE_SECRET,
      OPENAI_MODEL: "fake-model",
    });
    expect(env.OPENAI_API_KEY).toBe(FAKE_SECRET);
    expect(env.OPENAI_MODEL).toBe("fake-model");
  });

  it("없는 변수는 이름만 알려주는 오류를 던진다", () => {
    expect(() => readEnv("supabase", { SUPABASE_URL: "https://fake.example" })).toThrow(EnvError);

    try {
      readEnv("supabase", { SUPABASE_URL: "https://fake.example" });
    } catch (error) {
      expect((error as EnvError).missing).toEqual(["SUPABASE_ANON_KEY"]);
    }
  });

  it("빈 문자열과 공백만 있는 값은 없는 것으로 본다", () => {
    expect(() => readEnv("supabaseAdmin", { SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(EnvError);
    expect(() => readEnv("supabaseAdmin", { SUPABASE_SERVICE_ROLE_KEY: "   " })).toThrow(EnvError);
  });

  it("오류 메시지에는 값이 들어가지 않는다", () => {
    try {
      // OPENAI_API_KEY는 값이 있고 OPENAI_MODEL만 없다.
      readEnv("openai", { OPENAI_API_KEY: FAKE_SECRET });
      throw new Error("오류가 나야 하는 상황입니다");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("OPENAI_MODEL");
      expect(message).not.toContain(FAKE_SECRET);
    }
  });

  it("묶음마다 따로 검사한다 (다른 묶음이 비어 있어도 영향 없음)", () => {
    expect(() =>
      readEnv("openai", { OPENAI_API_KEY: FAKE_SECRET, OPENAI_MODEL: "fake-model" }),
    ).not.toThrow();
  });
});

describe("환경변수 이름 규칙", () => {
  it("어떤 이름도 NEXT_PUBLIC_으로 시작하지 않는다 (브라우저에 노출 금지)", () => {
    const names = Object.values(ENV_GROUPS).flatMap((schema) => Object.keys(schema.shape));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });
});
