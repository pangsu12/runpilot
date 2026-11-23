import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, redactSensitive, safeErrorInfo } from "@/lib/safeLog";

// 시험에는 가짜 값만 쓴다.
afterEach(() => vi.restoreAllMocks());

/** console.error에 넘어간 모든 인자를 하나의 글로 이어 붙인다 */
function loggedText(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((call: unknown[]) => JSON.stringify(call)).join("\n");
}

describe("redactSensitive: 민감한 칸 가리기", () => {
  it("건강정보 칸의 값을 가린다 (컨디션, 통증, 위험 증상)", () => {
    const result = redactSensitive({
      condition: "bad",
      pains: [{ part: "knee", intensity: "severe" }],
      dangerSymptoms: ["chest_pain"],
      danger_symptoms: ["chest_pain"],
      runId: "run-1",
    }) as Record<string, unknown>;

    expect(result.condition).toBe("[가림]");
    expect(result.pains).toBe("[가림]");
    expect(result.dangerSymptoms).toBe("[가림]");
    expect(result.danger_symptoms).toBe("[가림]");
    expect(result.runId).toBe("run-1");
  });

  it("비밀번호·토큰·이메일 칸도 가린다", () => {
    const result = redactSensitive({
      password: "fake-pw",
      accessToken: "fake-token",
      email: "runner@example.com",
      Authorization: "Bearer fake",
      page: "signup",
    }) as Record<string, unknown>;
    expect(result.password).toBe("[가림]");
    expect(result.accessToken).toBe("[가림]");
    expect(result.email).toBe("[가림]");
    expect(result.Authorization).toBe("[가림]");
    expect(result.page).toBe("signup");
  });

  it("객체 안쪽 깊은 곳과 배열 안의 칸도 가린다", () => {
    const result = redactSensitive({
      outer: [{ inner: { condition: "bad", note: "ok" } }],
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain("bad");
    expect(text).toContain("ok");
  });

  it("칸 이름의 대소문자·밑줄이 달라도 가린다 (healthConsent / health_consent)", () => {
    const result = redactSensitive({ healthConsent: true, health_consent: true }) as Record<string, unknown>;
    expect(result.healthConsent).toBe("[가림]");
    expect(result.health_consent).toBe("[가림]");
  });

  it("원본 객체는 바꾸지 않는다", () => {
    const original = { condition: "bad" };
    redactSensitive(original);
    expect(original.condition).toBe("bad");
  });

  it("문자열·숫자·null은 그대로 돌려준다", () => {
    expect(redactSensitive("글")).toBe("글");
    expect(redactSensitive(3)).toBe(3);
    expect(redactSensitive(null)).toBeNull();
  });
});

describe("safeErrorInfo: 오류에서 안전한 정보만 뽑기", () => {
  it("종류·코드·상태만 뽑고 메시지는 뽑지 않는다", () => {
    const error = Object.assign(new Error('Failing row contains (chest_pain, knee, severe)'), {
      code: "23514",
      status: 400,
    });
    const info = safeErrorInfo(error);
    expect(info).toEqual({ name: "Error", code: "23514", status: 400 });
    expect(JSON.stringify(info)).not.toContain("chest_pain");
  });

  it("오류 객체가 아닌 값도 안전하게 처리한다", () => {
    expect(safeErrorInfo("문자열 오류")).toEqual({ name: "string" });
    expect(safeErrorInfo(null)).toEqual({ name: "object" });
    expect(safeErrorInfo(undefined)).toEqual({ name: "undefined" });
  });
});

describe("logServerError: 서버 오류 기록", () => {
  it("오류 메시지에 건강정보가 들어 있어도 기록에는 나오지 않는다", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = Object.assign(
      new Error('new row for relation "pains" violates check constraint. Failing row contains (knee, severe, chest_pain)'),
      { code: "23514" },
    );

    logServerError("checkin.save", dbError);

    const text = loggedText(spy);
    expect(text).toContain("checkin.save");
    expect(text).toContain("23514");
    expect(text).not.toContain("chest_pain");
    expect(text).not.toContain("knee");
    expect(text).not.toContain("severe");
  });

  it("함께 넘긴 정보의 건강정보 칸은 가려서 기록한다", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError("checkin.save", new Error("x"), {
      condition: "bad",
      dangerSymptoms: ["chest_pain"],
      step: "insert",
    });
    const text = loggedText(spy);
    expect(text).not.toContain("bad");
    expect(text).not.toContain("chest_pain");
    expect(text).toContain("insert");
  });
});
