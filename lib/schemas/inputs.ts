import { z } from "zod";
import { ABNORMAL_RECORD_LIMITS, PROFILE_LONGEST_RUN_KM } from "@/lib/rules/constants";
import { isValidIsoDate } from "@/lib/schemas/date";
import {
  AGE_BANDS,
  CONDITIONS,
  DANGER_SYMPTOMS,
  EXPERIENCE_LEVELS,
  GOALS,
  PAIN_INTENSITIES,
  PAIN_PARTS,
} from "@/lib/schemas/lists";

// Design Ref: §8 오류 처리, §9 — 입력이 양식과 다르면 해당 칸에 한국어 오류를 보여주고 저장하지 않는다.
// 모든 객체는 strictObject로 만들어, 정해진 칸 밖의 값(예: 글로 쓴 증상 메모)은 받지 않는다.
// 숫자 칸은 coerce를 써서 화면 입력(문자열)도 숫자로 바꿔 검사한다.

const limits = ABNORMAL_RECORD_LIMITS;

/** 한 번의 통증 입력: 고정 목록의 부위 + 강도 3단계 (글로 쓴 원문 없음) */
export const painEntrySchema = z.strictObject({
  part: z.enum(PAIN_PARTS, { error: "목록에 있는 통증 부위를 골라 주세요." }),
  intensity: z.enum(PAIN_INTENSITIES, { error: "통증 강도(약함·보통·심함)를 골라 주세요." }),
});
export type PainEntry = z.infer<typeof painEntrySchema>;

/** 통증 입력 목록: 같은 부위는 한 번만 (체크인과 훈련 후 기록이 함께 쓴다) */
export const painListSchema = z
  .array(painEntrySchema)
  .default([])
  .refine((pains) => new Set(pains.map((pain) => pain.part)).size === pains.length, {
    error: "같은 부위는 한 번만 입력해 주세요.",
  });

/** 훈련 전 체크인: 컨디션 + (선택) 통증 + (선택) 위험 증상 */
export const checkinSchema = z.strictObject({
  condition: z.enum(CONDITIONS, { error: "오늘 컨디션(좋음·보통·나쁨)을 골라 주세요." }),
  pains: painListSchema,
  dangerSymptoms: z
    .array(z.enum(DANGER_SYMPTOMS, { error: "목록에 있는 증상만 고를 수 있습니다." }))
    .default([])
    .refine((symptoms) => new Set(symptoms).size === symptoms.length, {
      error: "같은 증상은 한 번만 체크해 주세요.",
    }),
});
export type CheckinInput = z.infer<typeof checkinSchema>;

const isoDate = z
  .string({ error: "날짜를 입력해 주세요." })
  .refine(isValidIsoDate, { error: "날짜를 YYYY-MM-DD 형식의 실제 있는 날짜로 입력해 주세요." });

/**
 * 훈련 후 러닝 기록 (거리·시간). 비정상 값은 거부해 다시 입력하게 한다. (PRD 예외 2번)
 * @param today 한국 시간 기준 오늘 날짜("YYYY-MM-DD"). 미래 날짜는 입력할 수 없다.
 */
export function createRunRecordSchema(today: string) {
  return z
    .strictObject({
      date: isoDate.refine((date) => date <= today, {
        error: "오늘보다 뒤의 날짜는 입력할 수 없습니다.",
      }),
      distanceKm: z.coerce
        .number({ error: "거리를 숫자(km)로 입력해 주세요." })
        .gt(limits.distanceKm.exclusiveMin, { error: "거리는 0보다 커야 합니다." })
        .lte(limits.distanceKm.max, {
          error: `거리는 ${limits.distanceKm.max}km 이하로 입력해 주세요.`,
        }),
      durationMinutes: z.coerce
        .number({ error: "시간을 숫자(분)로 입력해 주세요." })
        .gte(limits.durationMinutes.min, {
          error: `시간은 ${limits.durationMinutes.min}분 이상으로 입력해 주세요.`,
        })
        .lte(limits.durationMinutes.max, { error: "시간은 24시간(1440분) 이하로 입력해 주세요." }),
    })
    .refine(
      (record) => {
        const pace = record.durationMinutes / record.distanceKm;
        return pace >= limits.paceMinutesPerKm.min && pace <= limits.paceMinutesPerKm.max;
      },
      {
        error: "거리와 시간으로 계산한 페이스가 너무 빠르거나 느립니다. 입력을 확인해 주세요.",
        path: ["durationMinutes"],
      },
    );
}
export type RunRecordInput = z.infer<ReturnType<typeof createRunRecordSchema>>;

/** 시작 설정(프로필): 나이대·경험·최근 최장 거리·목표. 정확한 생년월일은 받지 않는다. */
export const profileSchema = z.strictObject({
  ageBand: z.enum(AGE_BANDS, { error: "나이대를 골라 주세요." }),
  experience: z.enum(EXPERIENCE_LEVELS, { error: "러닝 경험(입문·중급·상급)을 골라 주세요." }),
  longestRunKm: z.coerce
    .number({ error: "거리를 숫자(km)로 입력해 주세요. 달려본 적이 없으면 0을 입력해 주세요." })
    .gte(PROFILE_LONGEST_RUN_KM.min, { error: "거리는 0 이상이어야 합니다." })
    .lte(PROFILE_LONGEST_RUN_KM.max, {
      error: `거리는 ${PROFILE_LONGEST_RUN_KM.max}km 이하로 입력해 주세요.`,
    }),
  goal: z.enum(GOALS, { error: "목표를 골라 주세요." }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** 칸 이름 → 그 칸의 한국어 오류 목록. 오류가 없는 칸은 키가 없다. */
export type FieldErrors = Record<string, string[] | undefined>;

/** 검사에 실패했을 때 화면의 "해당 칸"에 한국어 오류를 붙이기 좋은 모양으로 바꿔 준다. */
export function toFieldErrors(error: z.ZodError): { fieldErrors: FieldErrors; formErrors: string[] } {
  const { fieldErrors, formErrors } = z.flattenError(error);
  return { fieldErrors: fieldErrors as FieldErrors, formErrors };
}
