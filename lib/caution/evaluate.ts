import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustRestOfWeek, type ScheduleChange } from "@/lib/caution/adjust";
import { assessCautions, type Caution } from "@/lib/caution/assess";
import { readLatestPlan } from "@/lib/plans/store";
import { PAIN_STREAK_DAYS, RECENT_RUNS_WINDOW_DAYS } from "@/lib/rules/constants";
import { addDaysIso } from "@/lib/schemas/date";
import { PAIN_PARTS, type PainPart } from "@/lib/schemas/lists";

// Design Ref: §7.4 훈련 후 기록 — 저장한 뒤 규칙 코드로 주의를 판단하고, 이번 주 남은 일정을 조정한다.
// 건강정보(통증)는 동의한 사용자의 저장된 값만 읽는다. 읽은 값은 로그에 남기지 않는다.

export type CautionResult = { cautions: Caution[]; change: ScheduleChange | null; persisted: boolean };

/** 최근 통증 기록을 읽는다. (동의하지 않은 사용자는 저장된 것이 없으므로 빈 목록) */
export async function readRecentPains(supabase: SupabaseClient, asOf: string) {
  const from = addDaysIso(asOf, -(PAIN_STREAK_DAYS + 1));
  const { data, error } = await supabase.from("pains").select("pain_date, part").gte("pain_date", from).lte("pain_date", asOf);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => (PAIN_PARTS as readonly string[]).includes(row.part))
    .map((row) => ({ date: row.pain_date as string, part: row.part as PainPart }));
}

/**
 * 방금 저장한 기록에 대한 주의와 일정 조정을 계산한다.
 * - 방금 입력한 기록은 이미 저장되어 있을 수 있으므로, 같은 날짜·거리 기록 1건을 비교 대상에서 뺀다.
 * - 일정 조정은 기록 날짜가 오늘일 때만 한다. 지난 날짜 기록을 입력했다고 오늘 이후 계획을 바꾸지 않는다.
 * - 동의한 사용자만 조정을 저장한다. 동의하지 않았으면 화면에서만 보여준다.
 */
export async function evaluateAfterRecord(
  supabase: SupabaseClient,
  input: { run: { date: string; distanceKm: number }; consent: boolean; today: string; profileLongestKm: number },
): Promise<CautionResult> {
  const { run, consent, today } = input;

  const from = addDaysIso(run.date, -RECENT_RUNS_WINDOW_DAYS);
  const { data: rows, error } = await supabase.from("runs").select("run_date, distance_km").gte("run_date", from).lte("run_date", run.date);
  if (error) throw error;
  const all = (rows ?? []).map((row) => ({ date: row.run_date as string, distanceKm: Number(row.distance_km) }));
  const index = all.findIndex((other) => other.date === run.date && other.distanceKm === run.distanceKm);
  const otherRuns = index === -1 ? all : all.filter((_, i) => i !== index);

  const pains = consent ? await readRecentPains(supabase, run.date) : [];
  const cautions = assessCautions({ run, otherRuns, profileLongestKm: input.profileLongestKm, pains, painAsOf: run.date });
  if (cautions.length === 0 || run.date !== today) return { cautions, change: null, persisted: false };

  const plan = await readLatestPlan(supabase);
  if (!plan) return { cautions, change: null, persisted: false };
  const change = adjustRestOfWeek(plan.days, today, cautions);
  if (!change) return { cautions, change: null, persisted: false };

  if (consent) {
    const { error: updateError } = await supabase
      .from("plan_days")
      .update({ kind: change.after.kind, distance_km: change.after.distanceKm })
      .eq("plan_id", plan.id)
      .eq("day_date", change.date);
    if (updateError) throw updateError;
  }
  return { cautions, change, persisted: consent };
}
