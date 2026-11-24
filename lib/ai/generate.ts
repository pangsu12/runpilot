import { requestAiPlan, type AiPlanResult } from "@/lib/ai/client";
import type { AiPayload } from "@/lib/ai/payload";
import { capDistanceSpikes } from "@/lib/ai/repair";
import { AI_MAX_RETRIES, AI_TOTAL_BUDGET_MS } from "@/lib/rules/constants";
import type { PlanDay } from "@/lib/rules/planTypes";
import { validatePlan, type PlanValidationContext, type PlanViolationCode } from "@/lib/rules/planValidator";
import { daysBetween } from "@/lib/schemas/date";

// Design Ref: §7.5 AI 계획 생성 — AI가 만든 계획은 코드 검증을 통과한 것만 쓴다.
// 위반하면 위반한 규칙의 일반 설명을 붙여 최대 AI_MAX_RETRIES번 다시 요청하고, 그래도 안 되면 호출한 쪽이 기본 계획으로 대체한다.
// Plan SC: 사용자에게 보이는 계획의 100%가 검증을 통과한다.
// 기록(violation_codes)에는 규칙 이름(코드)만 남긴다. 건강정보, AI 응답 글, 날짜는 남기지 않는다.

/** 검증 코드 + 이 파일에서 직접 확인하는 항목 */
export type AiViolationCode = PlanViolationCode | "bad_format" | "incomplete_plan" | "distance_spike_repaired";

export type AiFallbackReason = "ai_failed" | "validation_failed" | "timeout";

export type GeneratedPlan =
  | { ok: true; days: PlanDay[]; attempts: number; violationCodes: AiViolationCode[] }
  | { ok: false; fallbackReason: AiFallbackReason; attempts: number; violationCodes: AiViolationCode[] };

/** 다시 요청할 때 AI에 알려 주는 일반 설명 (건강정보·날짜를 담지 않는다) */
const PROBLEM_TEXT: Record<AiViolationCode, string> = {
  empty_plan: "계획이 비어 있었습니다.",
  not_contiguous: "날짜가 하루씩 빠짐없이 이어지지 않았습니다.",
  invalid_distance: "훈련 거리는 0보다 커야 합니다.",
  past_date: "plan.startDate보다 앞선 날짜가 있었습니다.",
  after_race: "대회 날짜 뒤의 날짜가 있었습니다.",
  no_rest_in_week: "어느 7일 안에 휴식일이 없었습니다.",
  distance_spike: "직전까지의 최장 거리보다 너무 긴 훈련이 있었습니다.",
  taper_not_decreasing: "대회가 가까워지는데 주간 훈련량이 줄지 않았습니다.",
  taper_out_of_range: "대회 직전 7일의 감량 폭이 정해진 범위를 벗어났습니다.",
  training_on_danger_day: "훈련을 배정하면 안 되는 날에 훈련이 있었습니다.",
  diagnosis_assertion: "notes에 진단이나 병명을 단정하는 표현이 있었습니다.",
  bad_format: "응답이 정해진 JSON 모양이 아니었습니다.",
  incomplete_plan: "계획이 plan.startDate에서 시작하지 않았거나 필요한 기간을 다 채우지 못했습니다.",
  distance_spike_repaired: "일부 훈련 거리가 직전 최장 거리보다 10% 이상 늘어 있어 줄였습니다.",
};

/** 시작일부터 필요한 기간을 채우는지 (대회가 계획 안에 있으면 대회 날짜까지) */
function isComplete(days: readonly PlanDay[], context: PlanValidationContext, weeks: number): boolean {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0 || sorted[0].date !== context.today) return false;
  let needed = weeks * 7;
  const raceDate = context.raceDate ?? null;
  if (raceDate !== null && raceDate >= context.today) needed = Math.min(needed, daysBetween(context.today, raceDate) + 1);
  return sorted.length >= needed;
}

export type GenerateOptions = {
  /** 시험에서 가짜 AI로 바꿔 끼운다. */
  request?: (payload: AiPayload, options: { feedback?: readonly string[] }) => Promise<AiPlanResult>;
  /** 시험에서 시계를 바꿔 끼운다. */
  now?: () => number;
};

/**
 * AI에 계획을 요청하고 코드 검증을 통과한 것만 돌려준다.
 * 실패하면 이유를 돌려주고(ok: false), 호출한 쪽이 기본 계획으로 대체한다.
 */
export async function generateVerifiedPlan(
  payload: AiPayload,
  context: PlanValidationContext,
  options: GenerateOptions = {},
): Promise<GeneratedPlan> {
  const request = options.request ?? ((p, o) => requestAiPlan(p, o));
  const now = options.now ?? Date.now;
  const startedAt = now();
  const codes = new Set<AiViolationCode>();
  let attempts = 0;
  let feedback: string[] = [];

  while (attempts <= AI_MAX_RETRIES) {
    if (attempts > 0 && now() - startedAt >= AI_TOTAL_BUDGET_MS) {
      return { ok: false, fallbackReason: "timeout", attempts, violationCodes: [...codes] };
    }
    attempts += 1;
    const result = await request(payload, { feedback });

    if (!result.ok) {
      if (result.reason === "timeout") return { ok: false, fallbackReason: "timeout", attempts, violationCodes: [...codes] };
      // 설정 없음·호출 오류는 다시 해도 같을 가능성이 높아 바로 대체한다.
      if (result.reason !== "bad_format") return { ok: false, fallbackReason: "ai_failed", attempts, violationCodes: [...codes] };
      codes.add("bad_format");
      feedback = [PROBLEM_TEXT.bad_format];
      continue;
    }

    // 날짜순으로 정리한 뒤 검증한다. 설명 글(notes)에도 진단 단정 표현이 없어야 한다.
    const sorted = [...result.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    // 거리 증가 한도를 넘긴 훈련은 코드가 한도까지 줄여 고친다. 고쳤다는 사실만 기록에 남기고, 고친 계획도 아래에서 전체 검증한다.
    const repaired = capDistanceSpikes(sorted, context.baselineKm);
    const days = repaired.days;
    if (repaired.changed) codes.add("distance_spike_repaired");
    const found = new Set<AiViolationCode>(
      validatePlan({ days, texts: [result.notes] }, context).map((violation) => violation.code),
    );
    if (!isComplete(days, context, payload.plan.weeks)) found.add("incomplete_plan");

    if (found.size === 0) return { ok: true, days, attempts, violationCodes: [...codes] };

    for (const code of found) codes.add(code);
    feedback = [...found].map((code) => PROBLEM_TEXT[code]);
  }

  return { ok: false, fallbackReason: "validation_failed", attempts, violationCodes: [...codes] };
}
