import { describe, expect, it } from "vitest";
import { readLoginForm, readSignupForm } from "@/lib/auth/forms";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

describe("readSignupForm", () => {
  it('체크박스가 체크되면("on") true, 체크되지 않으면 false다', () => {
    expect(readSignupForm(form({ email: "a@b.com", password: "pw", adultConfirmed: "on" })).adultConfirmed).toBe(true);
    expect(readSignupForm(form({ email: "a@b.com", password: "pw" })).adultConfirmed).toBe(false);
  });

  it("값이 없는 칸은 빈 문자열이 된다", () => {
    expect(readSignupForm(new FormData())).toEqual({ email: "", password: "", adultConfirmed: false });
  });

  it("파일 같은 문자열이 아닌 값은 빈 문자열로 본다", () => {
    const data = new FormData();
    data.set("email", new File(["x"], "x.txt"));
    expect(readSignupForm(data).email).toBe("");
  });
});

describe("readLoginForm", () => {
  it("이메일과 비밀번호만 읽는다", () => {
    expect(readLoginForm(form({ email: "a@b.com", password: "pw", extra: "무시" }))).toEqual({
      email: "a@b.com",
      password: "pw",
    });
  });
});
