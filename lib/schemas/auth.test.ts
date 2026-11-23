import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";
import { toFieldErrors } from "@/lib/schemas/inputs";

// 시험에는 가짜 이메일·비밀번호만 쓴다.
const validSignup = { email: "runner@example.com", password: "fake-password-1", adultConfirmed: true };

describe("signupSchema: 가입 입력", () => {
  it("정상 입력은 통과한다", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("이메일은 앞뒤 공백을 지우고 소문자로 맞춘다", () => {
    const result = signupSchema.safeParse({ ...validSignup, email: "  Runner@Example.COM " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("runner@example.com");
  });

  it("이메일 모양이 아니면 한국어 오류를 돌려준다", () => {
    for (const email of ["runner", "runner@", "@example.com", "runner example.com", ""]) {
      const result = signupSchema.safeParse({ ...validSignup, email });
      expect(result.success, `이메일 "${email}"`).toBe(false);
      if (!result.success) {
        expect(toFieldErrors(result.error).fieldErrors.email?.length).toBeGreaterThan(0);
      }
    }
  });

  it("비밀번호는 8자 이상이어야 하고, 7자는 거부한다", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "1234567" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, password: "12345678" }).success).toBe(true);
  });

  it("비밀번호가 72자를 넘으면 거부한다 (72자는 통과)", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "a".repeat(72) }).success).toBe(true);
    expect(signupSchema.safeParse({ ...validSignup, password: "a".repeat(73) }).success).toBe(false);
  });

  it('"만 19세 이상" 확인란에 체크하지 않으면 가입할 수 없다', () => {
    const result = signupSchema.safeParse({ ...validSignup, adultConfirmed: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).fieldErrors.adultConfirmed?.[0]).toBe(
        "만 19세 이상이어야 가입할 수 있습니다. 확인란에 체크해 주세요.",
      );
    }
  });

  it("확인란 값이 없어도 가입할 수 없다", () => {
    const withoutConfirm: Record<string, unknown> = { ...validSignup };
    delete withoutConfirm.adultConfirmed;
    expect(signupSchema.safeParse(withoutConfirm).success).toBe(false);
  });

  it("정해진 칸 밖의 값(생년월일 등)은 받지 않는다", () => {
    expect(signupSchema.safeParse({ ...validSignup, birthDate: "1990-01-01" }).success).toBe(false);
  });
});

describe("loginSchema: 로그인 입력", () => {
  it("정상 입력은 통과한다", () => {
    expect(loginSchema.safeParse({ email: "runner@example.com", password: "x" }).success).toBe(true);
  });

  it("로그인에는 비밀번호 길이 규칙을 적용하지 않는다 (예전 비밀번호도 입력할 수 있게)", () => {
    expect(loginSchema.safeParse({ email: "runner@example.com", password: "abc" }).success).toBe(true);
  });

  it("이메일이 틀리거나 비밀번호가 비어 있으면 거부한다", () => {
    expect(loginSchema.safeParse({ email: "runner", password: "x" }).success).toBe(false);
    const empty = loginSchema.safeParse({ email: "runner@example.com", password: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(toFieldErrors(empty.error).fieldErrors.password?.[0]).toBe("비밀번호를 입력해 주세요.");
    }
  });
});
