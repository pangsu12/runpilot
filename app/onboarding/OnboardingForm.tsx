"use client";

import { useActionState } from "react";
import { saveProfile, type OnboardingFormState } from "@/app/onboarding/actions";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import type { ProfileFormValues } from "@/lib/profile/forms";
import { PROFILE_LONGEST_RUN_KM } from "@/lib/rules/constants";
import {
  AGE_BAND_LABELS,
  AGE_BANDS,
  EXPERIENCE_LEVEL_LABELS,
  EXPERIENCE_LEVELS,
  GOAL_LABELS,
  GOALS,
} from "@/lib/schemas/lists";

// Design Ref: §5.3 시작 설정 — 나이대, 경험 3단계, 최근 최장 거리(0 가능, 상한 100km), 목표 3개

const toOptions = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export function OnboardingForm({ initial }: { initial: ProfileFormValues }) {
  const [state, action, pending] = useActionState<OnboardingFormState, FormData>(saveProfile, undefined);
  // 오류가 난 뒤에는 방금 입력한 값을, 처음에는 저장된 값을 보여준다.
  const values = state?.values ?? initial;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {/* 선택칸은 제출 뒤 폼이 초기화될 때 값이 사라지므로, 값이 바뀌면 다시 그려 입력한 값을 유지한다. */}
      <SelectField
        key={`ageBand-${values.ageBand ?? ""}`}
        id="ageBand"
        name="ageBand"
        label="나이대"
        options={toOptions(AGE_BANDS, AGE_BAND_LABELS)}
        defaultValue={values.ageBand}
        errors={state?.errors?.ageBand}
      />
      <SelectField
        key={`experience-${values.experience ?? ""}`}
        id="experience"
        name="experience"
        label="러닝 경험"
        options={toOptions(EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS)}
        defaultValue={values.experience}
        errors={state?.errors?.experience}
      />
      <TextField
        id="longestRunKm"
        name="longestRunKm"
        label="최근 가장 길게 달린 거리 (km)"
        inputMode="decimal"
        defaultValue={values.longestRunKm}
        hint={`달려본 적이 없으면 0을 입력해 주세요. 최대 ${PROFILE_LONGEST_RUN_KM.max}km까지 입력할 수 있습니다.`}
        errors={state?.errors?.longestRunKm}
      />
      <SelectField
        key={`goal-${values.goal ?? ""}`}
        id="goal"
        name="goal"
        label="목표"
        options={toOptions(GOALS, GOAL_LABELS)}
        defaultValue={values.goal}
        errors={state?.errors?.goal}
      />

      {/* 대회 선택은 PLAN 10번에서 이 자리에 연결한다. */}
      <p className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        대회 선택(선택 사항)은 다음 단계에서 추가됩니다.
      </p>

      {state?.message ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "저장하는 중..." : "저장하고 시작하기"}
      </button>
    </form>
  );
}
