import type { SupabaseClient } from "@supabase/supabase-js";

// Design Ref: §6.1 pains — 통증은 부위·강도 고정 목록만 저장한다. (동의한 사용자만, 데이터베이스 규칙이 다시 확인한다)
// 훈련 전 체크인과 훈련 후 기록이 같은 날 통증을 입력할 수 있으므로, 입력한 부위만 바꾸고 다른 부위는 그대로 둔다.
// 같은 날 같은 부위를 다시 입력하면 마지막 강도로 바뀐다. (3일 연속 판단은 부위와 날짜만 보므로 하루에 한 건이면 충분하다)

export type PainToSave = { part: string; intensity: string };

/** 그날 입력한 통증을 저장한다. 실패하면 오류를 던진다. */
export async function savePains(supabase: SupabaseClient, date: string, pains: readonly PainToSave[]): Promise<void> {
  if (pains.length === 0) return;
  const parts = pains.map((pain) => pain.part);

  const removed = await supabase.from("pains").delete().eq("pain_date", date).in("part", parts);
  if (removed.error) throw removed.error;

  const inserted = await supabase
    .from("pains")
    .insert(pains.map((pain) => ({ pain_date: date, part: pain.part, intensity: pain.intensity })));
  if (inserted.error) throw inserted.error;
}
