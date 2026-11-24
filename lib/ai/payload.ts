import { regionFromLocation } from "@/lib/ai/region";
import { DISTANCE_SPIKE_PERCENT, PLAN_WEEKS, TAPER_FINAL_REDUCTION_PERCENT, TAPER_START_DAYS } from "@/lib/rules/constants";
import type { PlanProfile } from "@/lib/plans/build";
import { addDaysIso } from "@/lib/schemas/date";
import type { RunLog } from "@/lib/rules/distance";
import type { Condition, PainIntensity, PainPart } from "@/lib/schemas/lists";
import { CONDITIONS, EXPERIENCE_LEVELS, GOALS, AGE_BANDS, type AgeBand, type ExperienceLevel, type Goal } from "@/lib/schemas/lists";

// Design Ref: §7.6 AI에 보내는 값(허용 목록), CLAUDE.md 서비스 안전 규칙.
// "보낼 값을 고르는 함수"는 이 파일의 buildAiPayload 하나뿐이다. AI 요청에는 이 함수의 결과만 들어간다.
// 이 함수는 허용 목록에 있는 값만 새 객체에 하나씩 옮겨 담는다. (받은 객체를 통째로 넘기지 않으므로 다른 값이 섞일 수 없다)
// 이메일, 이름, 계정 ID, 정확한 생년월일·주소는 입력으로 받지도 않는다.

/** AI에 보내는 값 전체. 이 모양 밖의 값은 보내지 않는다. */
export type AiPayload = {
  profile: { ageBand: AgeBand; experience: ExperienceLevel; goal: Goal; longestRunKm: number };
  /** 최근 30일 러닝 거리 기록 (날짜와 거리만) */
  recentRuns: { date: string; distanceKm: number }[];
  /** 가장 최근 컨디션 3단계 값. 건강정보 동의자의 저장된 값만 */
  condition: Condition | null;
  /** 최근 통증 부위·강도. 건강정보 동의자의 저장된 값만 */
  pains: { part: PainPart; intensity: PainIntensity }[];
  /** 가장 가까운 미래 대회 1개: 날짜·종목·지역(시·도). 장소의 세부 내용은 보내지 않는다. */
  race: { date: string; distance: string | null; region: string | null } | null;
  plan: { startDate: string; weeks: number; dates: string[] };
  /** 계획이 지켜야 할 규칙. 코드 상수에서 가져온 값이다. */
  rules: {
    distanceSpikePercent: number;
    taperStartDaysBeforeRace: number;
    taperFinalWeekReductionPercent: { min: number; max: number };
  };
};

export type AiPayloadSource = {
  profile: PlanProfile & { age_band: string | null };
  recentRuns: readonly RunLog[];
  /** 건강정보 동의 여부. false이면 컨디션·통증은 어떤 값이 들어와도 보내지 않는다. */
  consent: boolean;
  condition: Condition | null;
  pains: readonly { part: PainPart; intensity: PainIntensity }[];
  race: { race_date: string; distance_label: string | null; location: string | null } | null;
  today: string;
};

/** 시작일부터 weeks주 동안의 날짜. 대회가 그 안에 있으면 대회 날짜까지만 */
function planDates(startDate: string, weeks: number, raceDate: string | null): string[] {
  const dates = Array.from({ length: weeks * 7 }, (_, i) => addDaysIso(startDate, i));
  return raceDate !== null && raceDate >= startDate ? dates.filter((date) => date <= raceDate) : dates;
}

const asAgeBand = (v: string | null): AgeBand | null => (AGE_BANDS as readonly string[]).includes(v ?? "") ? (v as AgeBand) : null;
const asExperience = (v: string | null): ExperienceLevel | null =>
  (EXPERIENCE_LEVELS as readonly string[]).includes(v ?? "") ? (v as ExperienceLevel) : null;
const asGoal = (v: string | null): Goal | null => (GOALS as readonly string[]).includes(v ?? "") ? (v as Goal) : null;

/**
 * AI에 보낼 값을 고른다. 프로필이 덜 채워졌으면 null(AI 요청을 하지 않는다).
 * 소스 객체에 이메일 같은 다른 칸이 있어도 아래에서 이름 붙여 꺼낸 값 외에는 결과에 들어가지 않는다.
 */
export function buildAiPayload(source: AiPayloadSource): AiPayload | null {
  const ageBand = asAgeBand(source.profile.age_band);
  const experience = asExperience(source.profile.experience);
  const goal = asGoal(source.profile.goal);
  const longestRunKm = Number(source.profile.longest_run_km);
  if (!ageBand || !experience || !goal || source.profile.longest_run_km === null || !Number.isFinite(longestRunKm)) return null;

  const condition = source.consent && source.condition && (CONDITIONS as readonly string[]).includes(source.condition) ? source.condition : null;

  return {
    profile: { ageBand, experience, goal, longestRunKm },
    recentRuns: source.recentRuns.map((run) => ({ date: run.date, distanceKm: run.distanceKm })),
    condition,
    pains: source.consent ? source.pains.map((pain) => ({ part: pain.part, intensity: pain.intensity })) : [],
    race: source.race
      ? {
          date: source.race.race_date,
          distance: source.race.distance_label,
          region: regionFromLocation(source.race.location),
        }
      : null,
    plan: {
      startDate: source.today,
      weeks: PLAN_WEEKS,
      // 만들어야 할 날짜 목록. AI가 일수를 잘못 세는 것을 막기 위해 직접 알려 준다. (대회가 있으면 대회 날짜까지)
      dates: planDates(source.today, PLAN_WEEKS, source.race?.race_date ?? null),
    },
    rules: {
      distanceSpikePercent: DISTANCE_SPIKE_PERCENT,
      taperStartDaysBeforeRace: TAPER_START_DAYS,
      taperFinalWeekReductionPercent: { ...TAPER_FINAL_REDUCTION_PERCENT },
    },
  };
}
