import { z } from "zod";
import { RACE_INPUT_LIMITS } from "@/lib/rules/constants";
import { addDaysIso, isValidIsoDate } from "@/lib/schemas/date";
import { RACE_DISTANCE_LABELS, RACE_DISTANCES } from "@/lib/schemas/lists";

// Design Ref: §7.9 대회 입력 — 직접 입력은 대회명·날짜·장소·종목만 받고, 지난 날짜는 입력할 수 없다.
// 없는 정보(코스 특성, 신청 마감일 등)는 입력받지도, 추측하지도 않는다.

const limits = RACE_INPUT_LIMITS;

/**
 * 직접 입력한 대회. 날짜는 한국 시간 기준 오늘부터 입력할 수 있다.
 * @param today 한국 시간 기준 오늘 날짜("YYYY-MM-DD")
 */
export function createRaceSchema(today: string) {
  const lastDate = addDaysIso(today, limits.maxDaysAhead);
  return z.strictObject({
    name: z
      .string({ error: "대회명을 입력해 주세요." })
      .trim()
      .min(1, { error: "대회명을 입력해 주세요." })
      .max(limits.nameMaxLength, { error: `대회명은 ${limits.nameMaxLength}자 이하로 입력해 주세요.` }),
    date: z
      .string({ error: "대회 날짜를 입력해 주세요." })
      .refine(isValidIsoDate, { error: "대회 날짜를 실제 있는 날짜로 입력해 주세요." })
      .refine((date) => date >= today, { error: "지난 날짜의 대회는 입력할 수 없습니다. 오늘 이후 날짜를 입력해 주세요." })
      .refine((date) => date <= lastDate, { error: "너무 먼 날짜입니다. 2년 이내의 날짜를 입력해 주세요." }),
    location: z
      .string()
      .trim()
      .max(limits.locationMaxLength, { error: `장소는 ${limits.locationMaxLength}자 이하로 입력해 주세요.` })
      .optional(),
    distance: z.enum(RACE_DISTANCES, { error: "대회 종목을 골라 주세요." }),
  });
}
export type RaceInput = z.infer<ReturnType<typeof createRaceSchema>>;

/** 검사를 통과한 입력 → races 표에 저장할 칸. 장소를 비워 두면 null, 접수 기간·링크는 모르므로 저장하지 않는다. */
export function raceToRow(input: RaceInput) {
  return {
    name: input.name,
    race_date: input.date,
    location: input.location ? input.location : null,
    distance_label: RACE_DISTANCE_LABELS[input.distance],
    source: "manual" as const,
  };
}
