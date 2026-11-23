import OpenAI from "openai";
import { readEnv, EnvError } from "@/lib/env";
import { buildUserMessage, AI_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import type { AiPayload } from "@/lib/ai/payload";
import { aiPlanResponseSchema, AI_RESPONSE_JSON_SCHEMA } from "@/lib/ai/schema";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/rules/constants";
import { logServerError } from "@/lib/safeLog";
import type { PlanDay } from "@/lib/rules/planTypes";

// Design Ref: §7.5 AI 계획 생성 — 서버에서만 OpenAI를 부른다. 키는 .env에서 읽고, 브라우저로 내보내지 않는다.
// 이 파일은 "요청하고 모양 검사까지" 한다. 규칙 검증·재요청·기본 계획 대체는 PLAN 16번에서 이어 붙인다.
// 요청 내용(허용 목록 값)과 AI 응답은 로그에 남기지 않는다. 오류는 이름·코드만 남긴다.

export type AiPlanResult =
  | { ok: true; days: PlanDay[]; notes: string }
  | { ok: false; reason: "config" | "timeout" | "api_error" | "bad_format" };

/** 한 번의 AI 호출. 시험에서는 가짜 함수로 바꿔 끼운다. 글(JSON 문자열)을 돌려준다. */
export type CompletionFn = (args: { system: string; user: string; signal: AbortSignal }) => Promise<string | null>;

/** 실제 OpenAI 호출. 키·모델 이름이 없으면 EnvError를 던진다. */
export const openAiCompletion: CompletionFn = async ({ system, user, signal }) => {
  const env = readEnv("openai");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0 });
  const response = await client.chat.completions.create(
    {
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "training_plan", strict: true, schema: AI_RESPONSE_JSON_SCHEMA },
      },
    },
    { signal },
  );
  return response.choices[0]?.message?.content ?? null;
};

function isTimeout(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" || name === "APIUserAbortError" || name === "APIConnectionTimeoutError";
}

/**
 * 허용 목록으로 고른 값(AiPayload)만 AI에 보내 훈련계획 후보를 받는다.
 * 실패하면 이유를 돌려주며, 호출한 쪽이 기본 계획으로 대체한다. (PLAN 16번)
 */
export async function requestAiPlan(
  payload: AiPayload,
  options: { completion?: CompletionFn; timeoutMs?: number; feedback?: readonly string[] } = {},
): Promise<AiPlanResult> {
  const completion = options.completion ?? openAiCompletion;
  const signal = AbortSignal.timeout(options.timeoutMs ?? AI_REQUEST_TIMEOUT_MS);

  let text: string | null;
  try {
    text = await completion({ system: AI_SYSTEM_PROMPT, user: buildUserMessage(payload, options.feedback), signal });
  } catch (error) {
    if (error instanceof EnvError) return { ok: false, reason: "config" };
    if (isTimeout(error) || signal.aborted) return { ok: false, reason: "timeout" };
    logServerError("ai.request", error);
    return { ok: false, reason: "api_error" };
  }
  if (!text) return { ok: false, reason: "bad_format" };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "bad_format" };
  }
  const parsed = aiPlanResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "bad_format" };

  return {
    ok: true,
    notes: parsed.data.notes,
    days: parsed.data.days.map((day) => ({ date: day.date, kind: day.kind, distanceKm: day.distanceKm })),
  };
}
