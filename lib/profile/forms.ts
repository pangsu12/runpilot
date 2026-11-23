// Design Ref: §5.3 시작 설정 — 화면의 폼(FormData)을 입력 검사(profileSchema)에 넣을 수 있는 모양으로 바꾼다.

import type { Profile } from "@/lib/profile/rows";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** 시작 설정 폼에서 읽은 값. 비어 있는 칸은 undefined로 둬서 "필수 입력" 오류가 나게 한다. */
export type ProfileFormValues = {
  ageBand?: string;
  experience?: string;
  longestRunKm?: string;
  goal?: string;
};

/**
 * 시작 설정 폼 → 입력 검사용 값.
 * 거리 칸이 비어 있을 때 숫자 변환이 0으로 바꿔 "달려본 적 없음"으로 저장되지 않도록, 빈 칸은 undefined로 넘긴다.
 * ("0"을 직접 입력한 경우만 0km로 본다.)
 */
export function readProfileForm(formData: FormData): ProfileFormValues {
  const pick = (name: string) => text(formData, name) || undefined;
  return {
    ageBand: pick("ageBand"),
    experience: pick("experience"),
    longestRunKm: pick("longestRunKm"),
    goal: pick("goal"),
  };
}

/** 저장된 프로필 → 화면 칸의 처음 값 (아직 저장 전이면 빈 값) */
export function profileToFormValues(profile: Profile | null): ProfileFormValues {
  if (!profile) return {};
  return {
    ageBand: profile.age_band ?? undefined,
    experience: profile.experience ?? undefined,
    longestRunKm: profile.longest_run_km === null ? undefined : String(profile.longest_run_km),
    goal: profile.goal ?? undefined,
  };
}
