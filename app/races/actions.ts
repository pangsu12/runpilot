"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { createRateLimiter } from "@/lib/rateLimit";
import { RACE_SEARCH_LIMIT_PER_MINUTE } from "@/lib/rules/constants";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { searchedRaceSchema, searchedRaceToRow } from "@/lib/events/save";
import { searchRaces, SEARCH_QUERY_MAX_LENGTH, type RaceCandidate } from "@/lib/events/search";
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

const searchLimiter = createRateLimiter({ max: RACE_SEARCH_LIMIT_PER_MINUTE, windowMs: 60_000 });

export type RaceSearchState =
  | { query?: string; items?: RaceCandidate[]; failed?: boolean; message?: string; savedName?: string }
  | undefined;

/** 고러닝에서 대회를 검색한다. 검색어는 조회 결과를 거르는 데만 쓰고 외부에 보내지 않는다. 실패하면 직접 입력을 안내한다. */
export async function searchRaceAction(_previous: RaceSearchState, formData: FormData): Promise<RaceSearchState> {
  const raw = formData.get("query");
  const query = typeof raw === "string" ? raw.trim() : "";
  if (!query) return { message: "검색어를 입력해 주세요. 예: 서울, 하프" };
  if (query.length > SEARCH_QUERY_MAX_LENGTH) return { query, message: `검색어는 ${SEARCH_QUERY_MAX_LENGTH}자 이하로 입력해 주세요.` };

  let loggedOut = false;
  let userId: string | undefined;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub;
    if (!userId) loggedOut = true;
  } catch (error) {
    unstable_rethrow(error);
    logServerError("races.search.auth", error);
    return { query, failed: true };
  }
  if (loggedOut || !userId) redirect(LOGIN_PATH);
  // 외부 사이트를 여러 번 읽는 무거운 조회라서 한 사람이 짧은 시간에 반복하지 못하게 한다.
  if (!searchLimiter.allow(userId)) return { query, message: "검색을 너무 자주 하셨어요. 잠시 뒤에 다시 시도해 주세요." };

  await connection();
  const outcome = await searchRaces(query, todayInKorea());
  if (!outcome.ok) return { query, failed: true };
  return { query, items: outcome.items };
}

/** 검색 결과에서 고른 대회를 저장한다. 브라우저가 보낸 값은 서버에서 다시 검사한다. (출처: gorunning) */
export async function addSearchedRace(_previous: RaceSearchState, formData: FormData): Promise<RaceSearchState> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const parsed = searchedRaceSchema(todayInKorea()).safeParse({
    name: text("name"),
    date: text("date"),
    location: text("location"),
    distance: text("distance"),
    registrationStart: text("registrationStart"),
    registrationEnd: text("registrationEnd"),
    officialUrl: text("officialUrl"),
  });
  if (!parsed.success) return { message: "이 대회를 저장할 수 없습니다. 직접 입력으로 추가해 주세요." };

  let failure: RaceSearchState;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      loggedOut = true;
    } else {
      const { error } = await supabase.from("races").insert(searchedRaceToRow(parsed.data));
      if (error) {
        logServerError("races.addSearched", error);
        failure = { message: SAVE_FAILED };
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("races.addSearched", error);
    failure = { message: SAVE_FAILED };
  }
  if (loggedOut) redirect(LOGIN_PATH);
  if (failure) return failure;
  revalidatePath("/races");
  return { savedName: parsed.data.name };
}

/** 저장한 대회의 이름·날짜·장소를 고친다. 종목과 접수 정보는 그대로 둔다. 본인 대회만 고쳐진다(RLS). */
export async function updateRace(_previous: RaceFormState, formData: FormData): Promise<RaceFormState> {
  const id = readRaceId(formData);
  if (!id) return { message: SAVE_FAILED };
  const raw = readRaceForm(formData);
  // 종목은 고치지 않으므로 검사용으로 임의의 허용값을 넣는다. 저장 칸에는 쓰지 않는다.
  const parsed = createRaceSchema(todayInKorea()).safeParse({ ...raw, distance: "other" });
  if (!parsed.success) return { errors: toFieldErrors(parsed.error).fieldErrors, values: raw };

  let failure: RaceFormState;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      loggedOut = true;
    } else {
      const { data: rows, error } = await supabase
        .from("races")
        .update({
          name: parsed.data.name,
          race_date: parsed.data.date,
          location: parsed.data.location ? parsed.data.location : null,
        })
        .eq("id", id)
        .select("id");
      if (error || !rows || rows.length !== 1) {
        if (error) logServerError("races.update", error);
        failure = { message: SAVE_FAILED, values: raw };
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("races.update", error);
    failure = { message: SAVE_FAILED, values: raw };
  }
  if (loggedOut) redirect(LOGIN_PATH);
  if (failure) return failure;
  revalidatePath("/races");
  revalidatePath("/");
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
