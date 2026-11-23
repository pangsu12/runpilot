import { z } from "zod";
import { isValidIsoDate } from "@/lib/schemas/date";
import { TRAINING_KINDS } from "@/lib/schemas/lists";

// Design Ref: §7.5 — AI 응답은 모양 검사(zod)를 통과한 뒤에만 규칙 검증기(PLAN 16번)로 넘어간다.
// 모양이 다르면(칸이 빠졌거나 종류가 다르면) 그대로 버린다. 정해진 칸 밖의 값은 받지 않는다.

export const AI_MAX_DAYS = 62; // 8주(56일) + 여유
export const AI_NOTES_MAX_LENGTH = 500;

export const aiPlanResponseSchema = z.strictObject({
  days: z
    .array(
      z.strictObject({
        date: z.string().refine(isValidIsoDate, { error: "날짜 형식이 올바르지 않습니다." }),
        kind: z.enum(TRAINING_KINDS),
        distanceKm: z.number().finite().min(0).max(100),
      }),
    )
    .min(1)
    .max(AI_MAX_DAYS),
  /** 계획에 대한 짧은 설명. 진단·병명 단정 표현이 없는지는 규칙 검증기가 확인한다. */
  notes: z.string().max(AI_NOTES_MAX_LENGTH),
});
export type AiPlanResponse = z.infer<typeof aiPlanResponseSchema>;

/** OpenAI "구조화된 출력"에 알려 주는 JSON 모양. 위 zod 모양과 같아야 한다. (시험으로 확인) */
export const AI_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["days", "notes"],
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "kind", "distanceKm"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          kind: { type: "string", enum: [...TRAINING_KINDS] },
          distanceKm: { type: "number", description: "휴식이면 0" },
        },
      },
    },
    notes: { type: "string", description: "계획 설명 (한국어, 짧게)" },
  },
} as const;
