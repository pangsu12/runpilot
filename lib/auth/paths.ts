// Design Ref: §4 proxy.ts, §8 오류 처리 — 로그인 안 했으면 로그인 화면으로 보낸다.
// 로그인 없이 볼 수 있는 화면은 이 목록뿐이고, 나머지 화면은 모두 로그인이 필요하다.

/** 로그인 없이 볼 수 있는 화면 */
export const PUBLIC_PATHS = ["/", "/login", "/signup"] as const;

/** 로그인한 사람에게는 필요 없는 화면 (이미 로그인했으면 첫 화면으로 보낸다) */
export const AUTH_PAGE_PATHS = ["/login", "/signup"] as const;

export const LOGIN_PATH = "/login";

/** 로그인에 성공한 뒤 가는 화면 */
export const AFTER_LOGIN_PATH = "/";

/** 가입에 성공한 뒤 가는 화면: 건강정보 동의 화면 (Design §7.1). 시작 설정은 작업 9번에서 이어 붙인다. */
export const AFTER_SIGNUP_PATH = "/consent";

/** 동의 화면에서 선택을 마친 뒤 가는 화면 */
export const AFTER_CONSENT_PATH = "/";

/** 끝의 "/"를 없애 같은 화면으로 본다. ("/login/" → "/login", 빈 경로 → "/") */
function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** 로그인 없이 볼 수 있는 화면인지 */
export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(normalize(pathname));
}

/** 로그인·가입 화면인지 */
export function isAuthPagePath(pathname: string): boolean {
  return (AUTH_PAGE_PATHS as readonly string[]).includes(normalize(pathname));
}

/**
 * 이 요청을 어디로 보내야 하는지 정한다. 보낼 곳이 없으면 null(그대로 보여준다).
 * - 로그인 안 했는데 로그인이 필요한 화면 → 로그인 화면
 * - 이미 로그인했는데 로그인·가입 화면 → 첫 화면
 */
export function redirectTarget(pathname: string, isLoggedIn: boolean): string | null {
  if (!isLoggedIn && !isPublicPath(pathname)) return LOGIN_PATH;
  if (isLoggedIn && isAuthPagePath(pathname)) return AFTER_LOGIN_PATH;
  return null;
}
