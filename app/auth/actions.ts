"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { readLoginForm, readSignupForm } from "@/lib/auth/forms";
import { authErrorMessage, GENERIC_AUTH_ERROR } from "@/lib/auth/messages";
import { AFTER_LOGIN_PATH, AFTER_SIGNUP_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";
import { toFieldErrors, type FieldErrors } from "@/lib/schemas/inputs";
import { logServerError } from "@/lib/safeLog";

// Design Ref: §7.1 가입과 동의 — 만 19세 확인 → 이메일·비밀번호 → 입력 검사(zod) → 서버에서 Supabase 가입·로그인 → 쿠키로 로그인 유지
// 폼 상태에는 비밀번호를 담지 않는다. 오류는 쉬운 한국어 안내만 돌려주고, 서버 오류 내용은 안전하게만 기록한다.

export type AuthFormState =
  | {
      /** 칸별 오류 (입력 검사에 걸린 경우) */
      errors?: FieldErrors;
      /** 폼 전체에 대한 안내 (가입·로그인 자체가 실패한 경우) */
      message?: string;
      /** 다시 입력하지 않도록 이메일만 되돌려준다 */
      email?: string;
    }
  | undefined;

/** 회원가입: 성공하면 바로 로그인된 상태로 건강정보 동의 화면으로 이동한다. */
export async function signup(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readSignupForm(formData);
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error).fieldErrors, email: raw.email };
  }

  let failure: AuthFormState;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      // 가입과 함께 프로필 행이 만들어지고 "만 19세 이상 확인" 시각이 저장된다. (데이터베이스 트리거)
      options: { data: { adult_confirmed: true } },
    });
    if (error) {
      failure = { message: authErrorMessage(error), email: raw.email };
    } else if (!data.session) {
      // 이메일 확인이 켜진 설정에서는 세션이 바로 생기지 않는다.
      failure = { message: "가입했습니다. 이메일로 보낸 확인 링크를 누른 뒤 로그인해 주세요.", email: raw.email };
    }
  } catch (error) {
    unstable_rethrow(error); // Next.js 내부 신호는 삼키지 않는다
    logServerError("auth.signup", error);
    failure = { message: GENERIC_AUTH_ERROR, email: raw.email };
  }

  if (failure) return failure;
  revalidatePath("/", "layout");
  redirect(AFTER_SIGNUP_PATH);
}

/** 로그인: 성공하면 첫 화면으로 이동한다. 실패 이유는 이메일·비밀번호 중 무엇이 틀렸는지 알려주지 않는다. */
export async function login(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readLoginForm(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: toFieldErrors(parsed.error).fieldErrors, email: raw.email };
  }

  let failure: AuthFormState;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) failure = { message: authErrorMessage(error), email: raw.email };
  } catch (error) {
    unstable_rethrow(error);
    logServerError("auth.login", error);
    failure = { message: GENERIC_AUTH_ERROR, email: raw.email };
  }

  if (failure) return failure;
  revalidatePath("/", "layout");
  redirect(AFTER_LOGIN_PATH);
}

/** 로그아웃: 로그인 쿠키를 지우고 첫 화면으로 이동한다. */
export async function logout(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    unstable_rethrow(error);
    logServerError("auth.logout", error);
  }
  revalidatePath("/", "layout");
  redirect("/");
}
