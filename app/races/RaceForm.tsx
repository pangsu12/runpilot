"use client";

import { useActionState } from "react";
import { addRace, type RaceFormState } from "@/app/races/actions";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { RACE_INPUT_LIMITS } from "@/lib/rules/constants";
import { RACE_DISTANCE_LABELS, RACE_DISTANCES } from "@/lib/schemas/lists";

// Design Ref: §5.3 대회 — 직접 입력 폼(대회명, 날짜(지난 날짜 선택 불가), 장소, 종목)

const DISTANCE_OPTIONS = RACE_DISTANCES.map((value) => ({ value, label: RACE_DISTANCE_LABELS[value] }));

/** @param today 한국 시간 기준 오늘 날짜. 날짜 선택기에서 지난 날짜를 고를 수 없게 한다. (서버에서도 다시 검사한다) */
export function RaceForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<RaceFormState, FormData>(addRace, undefined);
  // 저장에 성공하면 칸을 비우고, 오류가 나면 방금 입력한 값을 유지한다.
  const values = state?.saved ? {} : (state?.values ?? {});
  const resetKey = state?.saved ? "saved" : JSON.stringify(values);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <TextField
        key={`name-${resetKey}`}
        id="name"
        name="name"
        label="대회명"
        defaultValue={values.name}
        errors={state?.errors?.name}
      />
      <TextField
        key={`date-${resetKey}`}
        id="date"
        name="date"
        label="대회 날짜"
        type="date"
        min={today}
        defaultValue={values.date}
        errors={state?.errors?.date}
      />
      <TextField
        key={`location-${resetKey}`}
        id="location"
        name="location"
        label="장소 (선택)"
        defaultValue={values.location}
        hint="예: 서울 여의도. 모르면 비워 두세요."
        errors={state?.errors?.location}
      />
      <SelectField
        key={`distance-${resetKey}`}
        id="distance"
        name="distance"
        label="종목"
        options={DISTANCE_OPTIONS}
        defaultValue={values.distance}
        errors={state?.errors?.distance}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        입력한 정보만 사용합니다. 코스 특성과 신청 마감일은 입력받지 않으며 추측하지 않습니다. 날짜는 오늘부터{" "}
        {RACE_INPUT_LIMITS.maxDaysAhead}일 이내만 입력할 수 있습니다.
      </p>

      {state?.message ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      {state?.saved ? (
        <p role="status" className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          대회를 저장했습니다.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "저장하는 중..." : "대회 저장"}
      </button>
    </form>
  );
}
