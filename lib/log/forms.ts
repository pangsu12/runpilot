import { readPainFields } from "@/lib/checkin/forms";

// Design Ref: §5.3 훈련 후 기록 — 거리·시간 입력과 통증 입력(동의자만)을 입력 검사에 넣을 수 있는 모양으로 바꾼다.

/** 화면에 되돌려줄 거리·시간 입력값 */
export type LogFormValues = { date?: string; distanceKm?: string; durationMinutes?: string };

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  // 빈 칸은 undefined로 넘겨 "숫자로 입력해 주세요" 오류가 나게 한다. (빈 칸이 0으로 바뀌지 않게)
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** 훈련 후 기록 폼 → { 거리·시간 값, 통증 값 }. 동의하지 않았으면 통증 칸은 읽지 않는다. */
export function readLogForm(formData: FormData, consent: boolean) {
  const run: LogFormValues = {
    date: field(formData, "date"),
    distanceKm: field(formData, "distanceKm"),
    durationMinutes: field(formData, "durationMinutes"),
  };
  return { run, pains: consent ? readPainFields(formData) : [] };
}
