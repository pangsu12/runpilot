import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanDay } from "@/lib/rules/planTypes";
import type { TrainingKind } from "@/lib/schemas/lists";
import { TRAINING_KINDS } from "@/lib/schemas/lists";

// Design Ref: §6.1 plans / plan_days — 가장 최근 계획 1개와 그 하루치 계획을 읽는다. (본인 행만 보이는 RLS가 적용된다)

export type StoredPlan = {
  id: string;
  startDate: string;
  source: "ai" | "default";
  fallbackReason: string | null;
  days: PlanDay[];
};

/** 가장 최근에 만든 계획. 없으면 null. 읽기에 실패하면 오류를 던진다. */
export async function readLatestPlan(supabase: SupabaseClient): Promise<StoredPlan | null> {
  const { data: plan, error } = await supabase
    .from("plans")
    .select("id, start_date, source, fallback_reason")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!plan) return null;

  const { data: rows, error: daysError } = await supabase
    .from("plan_days")
    .select("day_date, kind, distance_km")
    .eq("plan_id", plan.id)
    .order("day_date", { ascending: true });
  if (daysError) throw daysError;

  const days: PlanDay[] = (rows ?? [])
    .filter((row) => (TRAINING_KINDS as readonly string[]).includes(row.kind))
    .map((row) => ({ date: row.day_date, kind: row.kind as TrainingKind, distanceKm: Number(row.distance_km) }));

  return {
    id: plan.id,
    startDate: plan.start_date,
    source: plan.source === "ai" ? "ai" : "default",
    fallbackReason: plan.fallback_reason,
    days,
  };
}

/** 계획과 하루치 계획을 저장한다. 하루치 저장에 실패하면 만들어 둔 계획 행을 지우고 오류를 던진다. */
export async function savePlan(
  supabase: SupabaseClient,
  plan: { startDate: string; weeks: number; days: readonly PlanDay[] },
): Promise<void> {
  const { data: created, error } = await supabase
    .from("plans")
    .insert({ start_date: plan.startDate, weeks: plan.weeks, source: "default" })
    .select("id")
    .single();
  if (error) throw error;

  const { error: daysError } = await supabase.from("plan_days").insert(
    plan.days.map((day) => ({
      plan_id: created.id,
      day_date: day.date,
      kind: day.kind,
      distance_km: day.distanceKm,
    })),
  );
  if (daysError) {
    await supabase.from("plans").delete().eq("id", created.id);
    throw daysError;
  }
}
