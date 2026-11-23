"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { buildDefaultPlan } from "@/lib/plans/build";
import { savePlan } from "@/lib/plans/store";
import { logServerError } from "@/lib/safeLog";
import { RECENT_RUNS_WINDOW_DAYS } from "@/lib/rules/constants";
import { addDaysIso, todayInKorea } from "@/lib/schemas/date";

// Design Ref: §7.2 기본 계획 — 프로필·최근 기록·가장 가까운 대회로 코드가 기본 4주 계획을 만들어 저장한다.
// 건강정보(컨디션·통증)는 읽지도 보내지도 않는다. AI 생성은 PLAN 15~16번에서 이어 붙인다.

export type PlanActionState = { message?: string } | undefined;

const FAILED = "계획을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
const NEED_PROFILE = "시작 설정을 먼저 마쳐 주세요. 나이대·경험·최근 최장 거리·목표가 필요합니다.";

export async function createPlan(_previous: PlanActionState, _formData: FormData): Promise<PlanActionState> {
  void _formData;
  let message: string | undefined;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      loggedOut = true;
    } else {
      const today = todayInKorea();
      const [profileResult, runsResult, racesResult] = await Promise.all([
        supabase.from("profiles").select("experience, goal, longest_run_km").maybeSingle(),
        supabase.from("runs").select("run_date, distance_km").gte("run_date", addDaysIso(today, -RECENT_RUNS_WINDOW_DAYS)),
        supabase.from("races").select("id, name, race_date"),
      ]);
      if (profileResult.error || runsResult.error || racesResult.error) {
        logServerError("plan.create.read", profileResult.error ?? runsResult.error ?? racesResult.error);
        message = FAILED;
      } else {
        const built = buildDefaultPlan({
          profile: profileResult.data,
          runs: (runsResult.data ?? []).map((run) => ({ date: run.run_date, distanceKm: Number(run.distance_km) })),
          races: racesResult.data ?? [],
          today,
        });
        if (!built.ok) {
          message = built.reason === "profile_incomplete" ? NEED_PROFILE : FAILED;
          if (built.reason === "invalid_plan") logServerError("plan.create.invalid", new Error("invalid_plan"));
        } else {
          await savePlan(supabase, {
            startDate: today,
            weeks: Math.ceil(built.plan.days.length / 7),
            days: built.plan.days,
          });
        }
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("plan.create", error);
    message = FAILED;
  }

  if (loggedOut) redirect(LOGIN_PATH);
  if (message) return { message };
  revalidatePath("/plan");
  revalidatePath("/");
  redirect("/plan");
}
