"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { generateAndSavePlan } from "@/lib/plans/generate";
import { needsWeeklyRefresh } from "@/lib/plans/weekly";
import { countRecentPlans, readLatestPlanCreatedAt } from "@/lib/plans/store";
import { PLAN_CREATE_LIMIT_PER_HOUR } from "@/lib/rules/constants";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";

// Design Ref: §7.2·§7.5·§7.7 계획 만들기와 주간 갱신. 계획을 만드는 과정은 lib/plans/generate.ts가 맡는다.

export type PlanActionState = { message?: string } | undefined;

const FAILED = "계획을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
const TOO_OFTEN = "계획을 너무 자주 만들었어요. 한 시간에 최대 5번까지 만들 수 있으니 잠시 뒤에 다시 시도해 주세요.";
const NEED_PROFILE ="시작 설정을 먼저 마쳐 주세요. 나이대·경험·최근 최장 거리·목표가 필요합니다.";

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
      // AI 호출 비용을 막기 위해 한 시간에 만들 수 있는 계획 수를 제한한다.
      if ((await countRecentPlans(supabase)) >= PLAN_CREATE_LIMIT_PER_HOUR) {
        message = TOO_OFTEN;
      } else {
        const result = await generateAndSavePlan(supabase, todayInKorea());
        if (result === "profile_incomplete") message = NEED_PROFILE;
        else if (result === "failed") message = FAILED;
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

export type WeeklyRefreshState = { status: "refreshed" | "skipped" | "failed" };

/**
 * 주간 갱신: 이번 주(월요일 시작, 한국 시간)에 계획을 만든 기록이 없으면 새 4주 계획을 만든다.
 * 이미 이번 주에 만들었으면 아무것도 하지 않는다. (화면이 여러 번 호출해도 계획이 중복으로 생기지 않게 서버에서 다시 확인한다)
 */
export async function refreshWeeklyPlan(): Promise<WeeklyRefreshState> {
  let loggedOut = false;
  let status: WeeklyRefreshState["status"] = "skipped";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      loggedOut = true;
    } else {
      const createdAt = await readLatestPlanCreatedAt(supabase);
      // 계획이 아직 없으면 갱신이 아니라 "계획 만들기"의 일이다.
      if (createdAt && needsWeeklyRefresh(createdAt, new Date()) && (await countRecentPlans(supabase)) < PLAN_CREATE_LIMIT_PER_HOUR) {
        const result = await generateAndSavePlan(supabase, todayInKorea());
        status = result === "ok" ? "refreshed" : "failed";
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("plan.weekly", error);
    status = "failed";
  }
  if (loggedOut) redirect(LOGIN_PATH);
  if (status === "refreshed") {
    revalidatePath("/plan");
    revalidatePath("/");
  }
  return { status };
}
