import { z } from "zod";
import { EMAIL_MAX_LENGTH, PASSWORD_LENGTH } from "@/lib/rules/constants";

// Design Ref: §5.3 로그인/가입, §8 오류 처리 — 이메일·비밀번호와 "만 19세 이상입니다" 확인.
// 입력이 양식과 다르면 해당 칸에 한국어 오류를 보여주고, 서버에 보내지 않는다.

/** 앞뒤 공백을 지우고 소문자로 맞춘 뒤 이메일 모양인지 검사한다. */
const email = z
  .string({ error: "이메일을 입력해 주세요." })
  .trim()
  .toLowerCase()
  .min(1, { error: "이메일을 입력해 주세요." })
  .max(EMAIL_MAX_LENGTH, { error: "이메일이 너무 깁니다." })
  .pipe(z.email({ error: "올바른 이메일 주소를 입력해 주세요." }));

/** 가입: 이메일 + 비밀번호 + 만 19세 이상 확인(체크해야 가입 가능) */
export const signupSchema = z.strictObject({
  email,
  password: z
    .string({ error: "비밀번호를 입력해 주세요." })
    .min(PASSWORD_LENGTH.min, { error: `비밀번호는 ${PASSWORD_LENGTH.min}자 이상이어야 합니다.` })
    .max(PASSWORD_LENGTH.max, { error: `비밀번호는 ${PASSWORD_LENGTH.max}자 이하여야 합니다.` }),
  adultConfirmed: z.literal(true, {
    error: "만 19세 이상이어야 가입할 수 있습니다. 확인란에 체크해 주세요.",
  }),
});
export type SignupInput = z.infer<typeof signupSchema>;

/** 로그인: 이메일 + 비밀번호 (비밀번호 길이 규칙은 가입 때만 확인한다) */
export const loginSchema = z.strictObject({
  email,
  password: z
    .string({ error: "비밀번호를 입력해 주세요." })
    .min(1, { error: "비밀번호를 입력해 주세요." })
    .max(PASSWORD_LENGTH.max, { error: "비밀번호가 너무 깁니다." }),
});
export type LoginInput = z.infer<typeof loginSchema>;
