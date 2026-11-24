import type { SupabaseClient } from "@supabase/supabase-js";

// Design Ref: §7.7 설정 — 건강정보(체크인의 컨디션·위험 증상, 통증)를 지운다. 본인 행만 지워진다(RLS).
// 거리·시간 기록, 대회, 계획은 건강정보가 아니므로 지우지 않는다.

/** 저장된 건강정보(checkins, pains)를 모두 지운다. 실패하면 오류를 던진다. 지운 값은 로그에 남기지 않는다. */
export async function deleteHealthData(supabase: SupabaseClient, userId: string): Promise<void> {
  const checkins = await supabase.from("checkins").delete().eq("user_id", userId);
  if (checkins.error) throw checkins.error;
  const pains = await supabase.from("pains").delete().eq("user_id", userId);
  if (pains.error) throw pains.error;
}

/**
 * 동의를 철회한다. 건강정보를 먼저 지우고, 지우기에 성공했을 때만 동의를 "안 함"으로 바꾼다.
 * (지우기에 실패했는데 동의만 철회되어 건강정보가 남는 일이 없게 한다)
 */
export async function withdrawConsent(supabase: SupabaseClient, userId: string): Promise<void> {
  await deleteHealthData(supabase, userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ health_consent: false, health_consent_at: null })
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw error;
  if (!data || data.length !== 1) throw new Error("consent_withdraw_no_row");
}
