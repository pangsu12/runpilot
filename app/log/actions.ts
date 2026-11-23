"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { savePains } from "@/lib/db/savePains";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { readLogForm, type LogFormValues } from "@/lib/log/forms";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";
import { createRunRecordSchema, painListSchema, toFieldErrors, type FieldErrors } from "@/lib/schemas/inputs";

// Design Ref: §7.4 훈련 후 기록 — 거리·시간 검사(비정상 값은 재입력 요청) → 저장 → (동의자만 통증 저장)
// 주의 안내와 조정안(10% 규칙, 통증 3일 연속)은 PLAN 14번에서 이 저장 뒤에 이어 붙인다.
// 거리·시간은 건강정보가 아니고, 통증은 동의한 사용자만 저장한다. 서버 로그에는 입력값을 남기지 않는다.

export type LogFormState =
  | { errors?: FieldErrors; message?: string; values?: LogFormValues; saved?: boolean }
  | undefined;

const SAVE_FAILED = "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

export async function submitRun(_previous: LogFormState, formData: FormData): Promise<LogFormState> {
  let state: LogFormState;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) {
      loggedOut = true;
    } else {
      const { data: profile, error: profileError } = await supabase.from("profiles").select("health_consent").maybeSingle();
      if (profileError) throw profileError;
      const consent = profile?.health_consent === true;

      const raw = readLogForm(formData, consent);
      const run = createRunRecordSchema(todayInKorea()).safeParse(raw.run);
      const pains = painListSchema.safeParse(raw.pains);
      if (!run.success || !pains.success) {
        const errors: FieldErrors = {
          ...(run.success ? {} : toFieldErrors(run.error).fieldErrors),
          ...(pains.success ? {} : { pains: toFieldErrors(pains.error).formErrors }),
        };
        state = { errors, values: raw.run };
      } else {
        const inserted = await supabase.from("runs").insert({
          run_date: run.data.date,
          distance_km: run.data.distanceKm,
          duration_minutes: run.data.durationMinutes,
        });
        if (inserted.error) throw inserted.error;
        // 통증은 그 기록의 날짜로 저장한다. (동의하지 않은 사용자는 raw.pains가 비어 있다)
        await savePains(supabase, run.data.date, pains.data);
        state = { saved: true };
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("log.submit", error);
    state = { message: SAVE_FAILED };
  }

  if (loggedOut) redirect(LOGIN_PATH);
  if (state?.saved) {
    revalidatePath("/log");
    revalidatePath("/");
  }
  return state;
}
