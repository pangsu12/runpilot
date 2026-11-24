"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { runExclusive } from "@/lib/inflight";
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
const BUSY = "계획을 이미 만드는 중이에요. 끝날 때까지 잠시 기다려 주세요.";
const SUSPENDED = "직전 체크인에서 위험 증상이 있어 훈련 제안을 멈췄습니다. 다음 체크인에서 위험 증상이 없다고 확인한 뒤 계획을 만들 수 있어요.";
const NEED_PROFILE ="시작 설정을 먼저 마쳐 주세요. 나이대·경험·최근 최장 거리·목표가 필요합니다.";

export async function createPlan(_previous: PlanActionState, _formData: FormData): Promise<PlanActionState> {
  void _formData;
  let message: string | undefined;
  let loggedOut = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      loggedOut = true;
    } else {
      // AI 호출 비용을 막기 위해 한 시간에 만들 수 있는 계획 수를 제한하고, 한 사용자가 동시에 여러 개를 만들지 못하게 한다.
      const run = await runExclusive(`plan:${userId}`, async () => {
        if ((await countRecentPlans(supabase)) >= PLAN_CREATE_LIMIT_PER_HOUR) return "too_often" as const;
        return generateAndSavePlan(supabase, todayInKorea());
      });
      if (run.busy) message = BUSY;
      else if (run.value === "too_often") message = TOO_OFTEN;
      else if (run.value === "profile_incomplete") message = NEED_PROFILE;
      else if (run.value === "suspended") message = SUSPENDED;
      else if (run.value === "failed") message = FAILED;
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
    const userId = data?.claims?.sub;
    if (!userId) {
      loggedOut = true;
    } else {
      // 계획 만들기와 같은 자물쇠를 쓴다. 이미 만드는 중이면 새로 시작하지 않는다. (여러 탭에서 동시에 열어도 중복 생성·중복 AI 호출 없음)
      const run = await runExclusive(`plan:${userId}`, async () => {
        const createdAt = await readLatestPlanCreatedAt(supabase);
        // 계획이 아직 없으면 갱신이 아니라 "계획 만들기"의 일이다.
        if (!createdAt || !needsWeeklyRefresh(createdAt, new Date())) return "skipped" as const;
        if ((await countRecentPlans(supabase)) >= PLAN_CREATE_LIMIT_PER_HOUR) return "skipped" as const;
        return generateAndSavePlan(supabase, todayInKorea());
      });
      if (!run.busy && run.value !== "skipped" && run.value !== "suspended") status = run.value === "ok" ? "refreshed" : "failed";
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
