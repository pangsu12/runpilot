import { describe, expect, it } from "vitest";
import { authErrorMessage, GENERIC_AUTH_ERROR } from "@/lib/auth/messages";

describe("authErrorMessage: 오류 코드 → 쉬운 한국어 안내", () => {
  it("이미 가입된 이메일인지는 알려 주지 않고 로그인하도록만 안내한다 (계정 존재 여부 숨김)", () => {
    for (const code of ["user_already_exists", "email_exists"]) {
      const message = authErrorMessage({ code });
      expect(message).not.toContain("이미 가입된 이메일");
      expect(message).toContain("로그인");
    }
  });

  it("로그인 실패는 이메일·비밀번호 중 무엇이 틀렸는지 알려주지 않는다", () => {
    const message = authErrorMessage({ code: "invalid_credentials" });
    expect(message).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
  });

  it("요청이 너무 많을 때 잠시 뒤에 다시 하라고 알려준다", () => {
    expect(authErrorMessage({ code: "over_request_rate_limit" })).toContain("잠시 뒤");
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toContain("잠시 뒤");
  });

  it("그 밖의 코드나 오류가 없는 경우는 일반 안내를 보여주고, 서버 오류 내용은 노출하지 않는다", () => {
    expect(authErrorMessage({ code: "something_unexpected" })).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage({})).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
  });

  it("모든 안내 문구는 한국어다 (영어 서버 메시지가 섞이지 않는다)", () => {
    const codes = [
      "user_already_exists",
      "invalid_credentials",
      "weak_password",
      "email_address_invalid",
      "signup_disabled",
      "over_request_rate_limit",
      "unknown",
    ];
    for (const code of codes) {
      expect(authErrorMessage({ code })).toMatch(/[가-힣]/);
    }
  });
});
