"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseAdminClient } from "@/lib/db/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";
import { deleteHealthData, withdrawConsent } from "@/lib/settings/health";

// Design Ref: §7.7 설정 — 건강정보 삭제, 동의 철회(건강정보 삭제 포함), 탈퇴(모든 기록과 로그인 계정 삭제).
// 확인 창은 화면(SettingsForms)에서 띄우고, 여기서는 로그인한 본인 계정에만 동작한다.

export type SettingsState = { message?: string; done?: string } | undefined;

const FAILED = "처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

async function currentUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

/** 저장된 컨디션·통증·위험 증상 체크를 모두 지운다. 동의 상태는 그대로 둔다. */
export async function removeHealthData(): Promise<SettingsState> {
  let result: SettingsState;
  let loggedOut = false;
  try {
    const { supabase, userId } = await currentUserId();
    if (!userId) loggedOut = true;
    else {
      await deleteHealthData(supabase, userId);
      result = { done: "저장된 건강정보(컨디션, 통증, 위험 증상 체크)를 모두 지웠습니다." };
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("settings.health.delete", error);
    result = { message: FAILED };
  }
  if (loggedOut) redirect(LOGIN_PATH);
  revalidatePath("/");
  return result;
}

/** 동의를 철회한다. 저장된 건강정보를 지운 뒤 "동의 안 함" 상태로 바꾼다. */
export async function revokeConsent(): Promise<SettingsState> {
  let result: SettingsState;
  let loggedOut = false;
  try {
    const { supabase, userId } = await currentUserId();
    if (!userId) loggedOut = true;
    else {
      await withdrawConsent(supabase, userId);
      result = { done: "동의를 철회했고 저장된 건강정보를 지웠습니다. 이제 컨디션·통증 입력은 사용할 수 없습니다." };
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("settings.consent.withdraw", error);
    result = { message: FAILED };
  }
  if (loggedOut) redirect(LOGIN_PATH);
  revalidatePath("/settings");
  revalidatePath("/");
  return result;
}

/** 탈퇴: 로그인 계정을 지우면 연결된 모든 기록(프로필, 대회, 기록, 건강정보, 계획)이 함께 지워진다. */
export async function deleteAccount(): Promise<SettingsState> {
  let failure: SettingsState;
  let loggedOut = false;
  let deleted = false;
  try {
    const { supabase, userId } = await currentUserId();
    if (!userId) loggedOut = true;
    else {
      // 건강정보를 먼저 지워 둔다. 계정 삭제가 연쇄 삭제를 하더라도, 중간에 실패했을 때 건강정보가 남지 않게 한다.
      await deleteHealthData(supabase, userId);
      const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);
      if (error) throw error;
      deleted = true;
      // 계정은 이미 없으므로 서버에 알리지 않고 이 브라우저의 로그인 정보만 지운다.
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("settings.account.delete", error);
    failure = { message: FAILED };
  }
  if (loggedOut) redirect(LOGIN_PATH);
  if (failure && !deleted) return failure;
  redirect("/");
}
