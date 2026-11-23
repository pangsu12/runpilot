// Design Ref: §6 데이터 — profiles 표에서 시작 설정 칸만 다룬다. (건강정보 동의 칸은 다루지 않는다)

import type { ProfileInput } from "@/lib/schemas/inputs";

/** profiles 표의 시작 설정 칸 (저장 전에는 비어 있다) */
export type Profile = {
  age_band: string | null;
  experience: string | null;
  longest_run_km: number | string | null;
  goal: string | null;
};

/** 검사를 통과한 입력 → profiles 표에 저장할 칸 */
export function profileToColumns(input: ProfileInput) {
  return {
    age_band: input.ageBand,
    experience: input.experience,
    longest_run_km: input.longestRunKm,
    goal: input.goal,
  };
}
