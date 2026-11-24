import { z } from "zod";
import { isSafeDistanceLabel, safeHttpsUrl } from "@/lib/events/search";
import { RACE_INPUT_LIMITS } from "@/lib/rules/constants";
import { addDaysIso, isValidIsoDate } from "@/lib/schemas/date";

// Design Ref: §7.9 — 검색 결과에서 고른 대회를 저장할 때, 브라우저가 보낸 값을 서버에서 다시 검사한다. (화면 값은 믿지 않는다)
// 출처는 항상 gorunning이다. 직접 입력(manual)은 lib/schemas/race.ts가 맡는다.


const optionalDate = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || isValidIsoDate(value), { error: "날짜 형식이 올바르지 않습니다." });

/** @param today 한국 시간 기준 오늘 날짜 */
export function searchedRaceSchema(today: string) {
  const lastDate = addDaysIso(today, RACE_INPUT_LIMITS.maxDaysAhead);
  return z.strictObject({
    name: z.string().trim().min(1).max(RACE_INPUT_LIMITS.nameMaxLength),
    date: z
      .string()
      .refine(isValidIsoDate)
      .refine((date) => date >= today && date <= lastDate, { error: "대회 날짜가 올바른 범위가 아닙니다." }),
    location: z.string().trim().max(RACE_INPUT_LIMITS.locationMaxLength).optional(),
    // 종목 표시: 고러닝의 "10km", "하프 마라톤(21.0975km)" 같은 종목 이름 모양만 받는다. 문장은 거부한다. (AI 요청에 들어가므로 길거나 이상한 글은 거부, SEC-007)
    distance: z.string().trim().max(30).refine(isSafeDistanceLabel, { error: "종목 형식이 올바르지 않습니다." }).optional(),
    registrationStart: optionalDate,
    registrationEnd: optionalDate,
    officialUrl: z
      .string()
      .optional()
      .transform((value) => (value ? safeHttpsUrl(value) : null)),
  });
}
export type SearchedRaceInput = z.infer<ReturnType<typeof searchedRaceSchema>>;

/** 검사를 통과한 값 → races 표에 저장할 칸. 모르는 값은 null로 두고 추측하지 않는다. */
export function searchedRaceToRow(input: SearchedRaceInput) {
  return {
    name: input.name,
    race_date: input.date,
    location: input.location ? input.location : null,
    distance_label: input.distance ? input.distance : null,
    registration_start: input.registrationStart ?? null,
    registration_end: input.registrationEnd ?? null,
    official_url: input.officialUrl ?? null,
    source: "gorunning" as const,
  };
}
