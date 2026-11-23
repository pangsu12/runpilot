import { generateDefaultPlan, type DefaultPlan } from "@/lib/rules/plan";
import { resolveBaseline, type RunLog } from "@/lib/rules/distance";
import { validatePlan } from "@/lib/rules/planValidator";
import { nearestUpcomingRace, type RaceSummary } from "@/lib/races/select";
import { EXPERIENCE_LEVELS, GOALS, type ExperienceLevel, type Goal } from "@/lib/schemas/lists";

// Design Ref: §7.2 기본 계획 — 프로필·최근 기록·가장 가까운 대회로 코드가 안전한 기본 4주 계획을 만든다. (AI 없이)
// 만든 계획은 계획 검증기를 한 번 더 통과해야만 저장한다. (코드가 만든 계획이어도 방어적으로 확인)

/** 계획 생성에 필요한 프로필 칸. 비어 있으면(시작 설정을 마치지 않음) 계획을 만들 수 없다. */
export type PlanProfile = {
  experience: string | null;
  goal: string | null;
  longest_run_km: number | string | null;
};

export type BuildPlanResult =
  | { ok: true; plan: DefaultPlan; baselineKm: number; raceDate: string | null }
  | { ok: false; reason: "profile_incomplete" | "invalid_plan" };

function isExperience(value: string | null): value is ExperienceLevel {
  return value !== null && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}
function isGoal(value: string | null): value is Goal {
  return value !== null && (GOALS as readonly string[]).includes(value);
}

/**
 * 기본 계획을 만든다. 시작일은 오늘(한국 시간)이다.
 * @param runs 러닝 기록 (최근 30일 최장 거리를 기준으로 쓴다. 없으면 시작 설정 거리)
 * @param races 저장된 대회 (오늘 이후 가장 가까운 1개만 쓴다)
 */
export function buildDefaultPlan(input: {
  profile: PlanProfile | null;
  runs: readonly RunLog[];
  races: readonly RaceSummary[];
  today: string;
}): BuildPlanResult {
  const { profile, runs, races, today } = input;
  if (!profile || !isExperience(profile.experience) || !isGoal(profile.goal) || profile.longest_run_km === null) {
    return { ok: false, reason: "profile_incomplete" };
  }
  const profileLongestKm = Number(profile.longest_run_km);
  if (!Number.isFinite(profileLongestKm)) return { ok: false, reason: "profile_incomplete" };

  const baseline = resolveBaseline({ otherRuns: runs, asOfDate: today, profileLongestKm });
  const raceDate = nearestUpcomingRace(races, today)?.race_date ?? null;

  const plan = generateDefaultPlan({
    startDate: today,
    experience: profile.experience,
    goal: profile.goal,
    baselineKm: baseline.km,
    raceDate,
  });

  const violations = validatePlan(
    { days: plan.days },
    { today, baselineKm: baseline.km, raceDate, regularWeeklyKm: plan.regularWeeklyKm },
  );
  if (violations.length > 0) return { ok: false, reason: "invalid_plan" };

  return { ok: true, plan, baselineKm: baseline.km, raceDate };
}
