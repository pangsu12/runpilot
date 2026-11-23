"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { readRaceForm, readRaceId, type RaceFormValues } from "@/lib/races/forms";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";
import { toFieldErrors, type FieldErrors } from "@/lib/schemas/inputs";
import { createRaceSchema, raceToRow } from "@/lib/schemas/race";

// Design Ref: §7.9 대회 입력 — 직접 입력한 대회를 검사(zod)한 뒤 본인 races 행으로 저장한다. (RLS, 출처: manual)
// 대회 정보는 건강정보가 아니다. 그래도 서버 로그에는 대회명·장소를 남기지 않는다.

export type RaceFormState =
  | { errors?: FieldErrors; message?: string; values?: RaceFormValues; saved?: boolean }
  | undefined;

const SAVE_FAILED = "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

export async function addRace(_previous: RaceFormState, formData: FormData): Promise<RaceFormState> {
  const raw = readRaceForm(formData);
  const parsed = createRaceSchema(todayInKorea()).safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error).fieldErrors, values: raw };

  let failure: RaceFormState;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      loggedOut = true;
    } else {
      // user_id는 데이터베이스가 로그인한 본인 값으로 채운다. (default auth.uid(), RLS가 남의 값은 거부)
      const { error } = await supabase.from("races").insert(raceToRow(parsed.data));
      if (error) {
        logServerError("races.add", error);
        failure = { message: SAVE_FAILED, values: raw };
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("races.add", error);
    failure = { message: SAVE_FAILED, values: raw };
  }

  if (loggedOut) redirect(LOGIN_PATH);
  if (failure) return failure;
  revalidatePath("/races");
  return { saved: true };
}

export async function deleteRace(formData: FormData): Promise<void> {
  const id = readRaceId(formData);
  if (!id) return;
  try {
    const supabase = await createSupabaseServerClient();
    // 본인 행만 지워진다. (RLS)
    const { error } = await supabase.from("races").delete().eq("id", id);
    if (error) logServerError("races.delete", error);
  } catch (error) {
    unstable_rethrow(error);
    logServerError("races.delete", error);
  }
  revalidatePath("/races");
}
