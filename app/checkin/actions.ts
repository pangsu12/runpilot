"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { readCheckinForm } from "@/lib/checkin/forms";
import { processCheckin, type CheckinOutcome } from "@/lib/checkin/process";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { findToday } from "@/lib/plans/view";
import { readLatestPlan } from "@/lib/plans/store";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";
import { checkinSchema, toFieldErrors, type FieldErrors } from "@/lib/schemas/inputs";
import { revalidatePath } from "next/cache";

// Design Ref: §7.3 훈련 전 체크인 — 검사(zod) → (동의자만 저장) → 규칙 코드 → 결과 표시. AI는 호출하지 않는다.
// 건강정보(컨디션·통증·위험 증상)는 동의한 사용자만 저장하고, 서버 로그에는 값을 남기지 않는다. (오류는 이름·코드만 기록)
// 같은 날 다시 제출하면 그날 체크인과 통증은 마지막 입력으로 바뀐다.

export type CheckinFormState =
  | {
      errors?: FieldErrors;
      message?: string;
      result?: { outcome: CheckinOutcome; saved: boolean };
    }
  | undefined;

const SAVE_FAILED = "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

export async function submitCheckin(_previous: CheckinFormState, formData: FormData): Promise<CheckinFormState> {
  let state: CheckinFormState;
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

      const parsed = checkinSchema.safeParse(readCheckinForm(formData, consent));
      if (!parsed.success) {
        state = { errors: toFieldErrors(parsed.error).fieldErrors };
      } else {
        const today = todayInKorea();
        const plan = await readLatestPlan(supabase);
        const todayDay = plan ? findToday(plan.days, today) : null;
        const outcome = processCheckin(
          parsed.data,
          todayDay ? { kind: todayDay.kind, distanceKm: todayDay.distanceKm } : null,
        );

        if (!consent) {
          // 동의하지 않은 사용자: 저장하지 않고 이 화면에서만 계산한다.
          state = { result: { outcome, saved: false } };
        } else {
          // 같은 날 다시 제출하면 마지막 입력으로 바꾼다. (user_id는 데이터베이스가 본인 값으로 채우고 RLS가 확인한다)
          const del1 = await supabase.from("checkins").delete().eq("checkin_date", today);
          if (del1.error) throw del1.error;
          const ins1 = await supabase
            .from("checkins")
            .insert({ checkin_date: today, condition: parsed.data.condition, danger_symptoms: parsed.data.dangerSymptoms });
          if (ins1.error) throw ins1.error;

          const del2 = await supabase.from("pains").delete().eq("pain_date", today);
          if (del2.error) throw del2.error;
          if (parsed.data.pains.length > 0) {
            const ins2 = await supabase
              .from("pains")
              .insert(parsed.data.pains.map((pain) => ({ pain_date: today, part: pain.part, intensity: pain.intensity })));
            if (ins2.error) throw ins2.error;
          }

          // 바뀐 오늘 훈련을 계획에 반영한다. 바꾼 이유(컨디션·증상)는 저장하지 않는다.
          if (outcome.changed && plan && outcome.workout) {
            const upd = await supabase
              .from("plan_days")
              .update({ kind: outcome.workout.kind, distance_km: outcome.workout.distanceKm })
              .eq("plan_id", plan.id)
              .eq("day_date", today);
            if (upd.error) throw upd.error;
          }
          state = { result: { outcome, saved: true } };
        }
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("checkin.submit", error);
    state = { message: SAVE_FAILED };
  }

  if (loggedOut) redirect(LOGIN_PATH);
  if (state?.result) {
    revalidatePath("/");
    revalidatePath("/plan");
  }
  return state;
}
