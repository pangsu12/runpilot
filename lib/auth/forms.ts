// Design Ref: §7.1 — 화면의 폼(FormData)을 입력 검사에 넣을 수 있는 모양으로 바꾼다.
// 비밀번호는 어디에도 되돌려 보내거나 기록하지 않는다. 이 파일은 값을 옮기기만 한다.

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** 가입 폼 → 입력 검사용 값. 체크박스는 체크되면 "on"이 오므로 true/false로 바꾼다. */
export function readSignupForm(formData: FormData) {
  return {
    email: text(formData, "email"),
    password: text(formData, "password"),
    adultConfirmed: formData.get("adultConfirmed") === "on",
  };
}

/** 로그인 폼 → 입력 검사용 값 */
export function readLoginForm(formData: FormData) {
  return {
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
}
