// Design Ref: §8 오류 처리 — 사용자에게는 쉬운 한국어 안내만 보여준다. (서버 오류 내용은 그대로 보여주지 않는다)

export type AuthErrorLike = { code?: string; status?: number } | null | undefined;

const GENERIC_MESSAGE = "문제가 생겼습니다. 잠시 뒤에 다시 시도해 주세요.";

/**
 * Supabase가 돌려준 오류 코드를 쉬운 한국어 안내로 바꾼다.
 * 로그인 실패는 "이메일이 없는 건지, 비밀번호가 틀린 건지" 알려주지 않는다. (계정 존재 여부를 숨기려고)
 */
export function authErrorMessage(error: AuthErrorLike): string {
  switch (error?.code) {
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "weak_password":
      return "비밀번호가 너무 쉽습니다. 더 길고 복잡하게 만들어 주세요.";
    case "email_address_invalid":
      return "사용할 수 없는 이메일 주소입니다. 다른 이메일로 시도해 주세요.";
    case "signup_disabled":
      return "지금은 가입을 받지 않습니다.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요.";
    default:
      return GENERIC_MESSAGE;
  }
}

export const GENERIC_AUTH_ERROR = GENERIC_MESSAGE;
