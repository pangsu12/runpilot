"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { AFTER_CONSENT_PATH, LOGIN_PATH } from "@/lib/auth/paths";
import { consentColumns, parseConsentChoice } from "@/lib/consent/choice";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";
import { withdrawConsent } from "@/lib/settings/health";

// Design Ref: §7.1 — 동의하면 profiles에 동의 여부·시각을 저장하고, 거부하면 동의 안 함으로 저장한다.
// 본인 행만 고칠 수 있다(RLS). 건강정보 값은 다루지 않고 동의 여부만 저장한다.

export type ConsentFormState = { message?: string } | undefined;

export async function saveConsent(_previous: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  const choice = parseConsentChoice(formData.get("choice"));
  if (!choice) return { message: "동의 여부를 선택해 주세요." };

  let failure: ConsentFormState;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      loggedOut = true;
    } else {
      if (choice === "decline") {
        // 이미 동의한 사람이 "동의하지 않고 계속"을 눌러도 저장된 건강정보가 남지 않게, 철회와 똑같이 먼저 지우고 바꾼다.
        await withdrawConsent(supabase, userId);
      } else {
        const { data: rows, error } = await supabase
          .from("profiles")
          .update(consentColumns(choice, new Date()))
          .eq("user_id", userId)
          .select("user_id");
        if (error || !rows || rows.length !== 1) {
          if (error) logServerError("consent.save", error);
          failure = { message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
        }
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("consent.save", error);
    failure = { message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  if (loggedOut) redirect(LOGIN_PATH);
  if (failure) return failure;
  // 모든 화면 아래의 안내 문구(동의 거부 사용자용)가 바로 바뀌도록 공통 레이아웃을 새로 그린다.
  revalidatePath("/", "layout");
  redirect(AFTER_CONSENT_PATH);
}
