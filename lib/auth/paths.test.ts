import { describe, expect, it } from "vitest";
import {
  AFTER_LOGIN_PATH,
  isAuthPagePath,
  isPublicPath,
  LOGIN_PATH,
  redirectTarget,
} from "@/lib/auth/paths";

describe("isPublicPath: 로그인 없이 볼 수 있는 화면", () => {
  it("첫 화면, 로그인, 가입만 공개다", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
  });

  it("끝에 /가 붙어도 같은 화면으로 본다", () => {
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("")).toBe(true);
  });

  it("DESIGN의 나머지 화면은 모두 로그인이 필요하다", () => {
    for (const path of [
      "/consent",
      "/onboarding",
      "/dashboard",
      "/plan",
      "/checkin",
      "/log",
      "/races",
      "/settings",
      "/anything-else",
    ]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });

  it("공개 화면 이름으로 시작하는 다른 주소는 공개가 아니다 (/login-admin, /signup/x)", () => {
    expect(isPublicPath("/login-admin")).toBe(false);
    expect(isPublicPath("/signup/extra")).toBe(false);
  });
});

describe("isAuthPagePath", () => {
  it("로그인·가입 화면만 해당한다", () => {
    expect(isAuthPagePath("/login")).toBe(true);
    expect(isAuthPagePath("/signup")).toBe(true);
    expect(isAuthPagePath("/")).toBe(false);
    expect(isAuthPagePath("/plan")).toBe(false);
  });
});

describe("redirectTarget: 요청을 어디로 보낼지", () => {
  it("로그인 안 했는데 로그인이 필요한 화면이면 로그인 화면으로 보낸다", () => {
    expect(redirectTarget("/dashboard", false)).toBe(LOGIN_PATH);
    expect(redirectTarget("/settings", false)).toBe(LOGIN_PATH);
  });

  it("로그인 안 했어도 공개 화면은 그대로 보여준다", () => {
    expect(redirectTarget("/", false)).toBeNull();
    expect(redirectTarget("/login", false)).toBeNull();
    expect(redirectTarget("/signup", false)).toBeNull();
  });

  it("로그인했으면 로그인이 필요한 화면을 그대로 보여준다", () => {
    expect(redirectTarget("/dashboard", true)).toBeNull();
    expect(redirectTarget("/", true)).toBeNull();
  });

  it("이미 로그인했는데 로그인·가입 화면이면 첫 화면으로 보낸다", () => {
    expect(redirectTarget("/login", true)).toBe(AFTER_LOGIN_PATH);
    expect(redirectTarget("/signup", true)).toBe(AFTER_LOGIN_PATH);
  });
});
