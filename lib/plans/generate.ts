import type { SupabaseClient } from "@supabase/supabase-js";
import { generateVerifiedPlan } from "@/lib/ai/generate";
import { buildAiPayload } from "@/lib/ai/payload";
import { buildDefaultPlan } from "@/lib/plans/build";
import { savePlan } from "@/lib/plans/store";
import { RECENT_RUNS_WINDOW_DAYS } from "@/lib/rules/constants";
import { isTrainingSuspended } from "@/lib/rules/danger";
import { logServerError } from "@/lib/safeLog";
import { addDaysIso } from "@/lib/schemas/date";
import {
  CONDITIONS,
  DANGER_SYMPTOMS,
  PAIN_INTENSITIES,
  PAIN_PARTS,
  type Condition,
  type DangerSymptom,
  type PainIntensity,
  type PainPart,
} from "@/lib/schemas/lists";

// Design Ref: §7.2·§7.5·§7.7 계획 만들기 — 직접 만들기(계획 화면)와 주간 갱신이 함께 쓴다.
// 코드가 만든 기본 4주 계획을 항상 먼저 만들어 두고, 가능하면 AI 계획을 요청해 코드 검증을 통과하면 그것을, 아니면 기본 계획을 저장한다.
// 건강정보(컨디션·통증)는 동의한 사용자의 저장된 값만 AI 요청용으로 읽는다. 값은 로그에 남기지 않고, 위험 증상이 있으면 AI를 부르지 않는다.

export type GeneratePlanResult = "ok" | "profile_incomplete" | "failed";

const isCondition = (value: unknown): value is Condition => (CONDITIONS as readonly string[]).includes(value as string);

/** 최근 7일 통증을 부위별로 가장 최근 값 하나씩 읽는다. 동의한 사용자만 호출한다. */
async function readPainsForAi(supabase: SupabaseClient, today: string): Promise<{ part: PainPart; intensity: PainIntensity }[]> {
  const { data, error } = await supabase
    .from("pains")
    .select("pain_date, part, intensity")
    .gte("pain_date", addDaysIso(today, -7))
    .lte("pain_date", today)
    .order("pain_date", { ascending: false });
  if (error) throw error;
  const latest = new Map<PainPart, PainIntensity>();
  for (const row of data ?? []) {
    if (!(PAIN_PARTS as readonly string[]).includes(row.part) || !(PAIN_INTENSITIES as readonly string[]).includes(row.intensity)) continue;
    if (!latest.has(row.part as PainPart)) latest.set(row.part as PainPart, row.intensity as PainIntensity);
  }
  return [...latest].map(([part, intensity]) => ({ part, intensity }));
}

/** 오늘부터 새 4주 계획을 만들어 저장한다. 로그인 확인은 호출한 쪽이 한다. 실패하면 오류 이름만 로그에 남긴다. */
export async function generateAndSavePlan(supabase: SupabaseClient, today: string): Promise<GeneratePlanResult> {
  const [profileResult, runsResult, racesResult, checkinsResult] = await Promise.all([
    supabase.from("profiles").select("experience, goal, longest_run_km, age_band, health_consent").maybeSingle(),
    supabase.from("runs").select("run_date, distance_km").gte("run_date", addDaysIso(today, -RECENT_RUNS_WINDOW_DAYS)),
    supabase.from("races").select("id, name, race_date, location, distance_label"),
    // 동의하지 않은 사용자는 저장된 체크인이 없다. 있는 값 중 가장 최근 것만 쓴다.
    supabase.from("checkins").select("checkin_date, condition, danger_symptoms").order("checkin_date", { ascending: false }).limit(1),
  ]);
  const readError = profileResult.error ?? runsResult.error ?? racesResult.error ?? checkinsResult.error;
  if (readError) {
    logServerError("plan.create.read", readError);
    return "failed";
  }

  const runs = (runsResult.data ?? []).map((run) => ({ date: run.run_date as string, distanceKm: Number(run.distance_km) }));
  const races = racesResult.data ?? [];
  const built = buildDefaultPlan({ profile: profileResult.data, runs, races, today });
  if (!built.ok) {
    if (built.reason === "invalid_plan") {
      logServerError("plan.create.invalid", new Error("invalid_plan"));
      return "failed";
    }
    return "profile_incomplete";
  }

  const consent = profileResult.data?.health_consent === true;
  const latest = checkinsResult.data?.[0];
  const dangerSymptoms = ((latest?.danger_symptoms ?? []) as string[]).filter((s): s is DangerSymptom =>
    (DANGER_SYMPTOMS as readonly string[]).includes(s),
  );
  // 위험 증상이 있으면 AI를 부르지 않는다. 판단은 코드의 고정 규칙이다. (이 사용자에게는 기본 계획만 만든다)
  const suspended = consent && isTrainingSuspended(latest ? [{ date: latest.checkin_date, dangerSymptoms }] : []);

  let outcome: Awaited<ReturnType<typeof generateVerifiedPlan>> | null = null;
  if (!suspended) {
    const pains = consent ? await readPainsForAi(supabase, today) : [];
    const race = built.raceDate ? races.find((item) => item.race_date === built.raceDate) : undefined;
    const payload = buildAiPayload({
      profile: profileResult.data!,
      recentRuns: runs,
      consent,
      condition: consent && isCondition(latest?.condition) ? latest.condition : null,
      pains,
      race: race ? { race_date: race.race_date, distance_label: race.distance_label, location: race.location } : null,
      today,
    });
    if (payload) {
      outcome = await generateVerifiedPlan(payload, { today, baselineKm: built.baselineKm, raceDate: built.raceDate });
    }
  }

  const days = outcome?.ok ? outcome.days : built.plan.days;
  await savePlan(supabase, {
    startDate: today,
    weeks: Math.ceil(days.length / 7),
    days,
    source: outcome?.ok ? "ai" : "default",
    fallbackReason: outcome && !outcome.ok ? outcome.fallbackReason : null,
    aiAttempts: outcome?.attempts ?? 0,
    violationCodes: outcome?.violationCodes ?? [],
  });
  return "ok";
}
