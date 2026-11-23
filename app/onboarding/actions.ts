"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { readProfileForm, type ProfileFormValues } from "@/lib/profile/forms";
import { profileToColumns } from "@/lib/profile/rows";
import { logServerError } from "@/lib/safeLog";
import { profileSchema, toFieldErrors, type FieldErrors } from "@/lib/schemas/inputs";

// Design Ref: §5.3 시작 설정 — 나이대·경험·최근 최장 거리·목표를 검사(zod)한 뒤 본인 프로필 행에 저장한다. (RLS)
// 정확한 생년월일은 받지 않는다. 이 값은 건강정보가 아니라 계획 생성용 기준값이다.

export type OnboardingFormState =
  | {
      errors?: FieldErrors;
      message?: string;
      /** 오류가 났을 때 입력한 값을 그대로 되돌려준다 */
      values?: ProfileFormValues;
    }
  | undefined;

const SAVE_FAILED = "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

export async function saveProfile(_previous: OnboardingFormState, formData: FormData): Promise<OnboardingFormState> {
  const raw = readProfileForm(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error).fieldErrors, values: raw };

  let failure: OnboardingFormState;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      loggedOut = true;
    } else {
      const { data: rows, error } = await supabase
        .from("profiles")
        .update(profileToColumns(parsed.data))
        .eq("user_id", userId)
        .select("user_id");
      if (error || !rows || rows.length !== 1) {
        if (error) logServerError("onboarding.save", error);
        failure = { message: SAVE_FAILED, values: raw };
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("onboarding.save", error);
    failure = { message: SAVE_FAILED, values: raw };
  }

  if (loggedOut) redirect(LOGIN_PATH);
  if (failure) return failure;
  // 대시보드(작업 11)가 생기면 그쪽으로 보낸다. 지금은 첫 화면.
  redirect("/");
}
