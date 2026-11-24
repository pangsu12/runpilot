"use client";

import { useActionState } from "react";
import { updateRace, type RaceFormState } from "@/app/races/actions";
import { TextField } from "@/components/TextField";

// Design Ref: §5.3 대회 — 저장한 대회의 이름·날짜·장소를 고친다. (날짜는 지난 날짜 선택 불가)

export function RaceEdit({ id, name, date, location, today }: { id: string; name: string; date: string; location: string | null; today: string }) {
  const [state, action, pending] = useActionState<RaceFormState, FormData>(updateRace, undefined);
  const values = state?.values;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium underline">수정</summary>
      <form action={action} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="id" value={id} />
        <TextField id={`name-${id}`} name="name" label="대회명" defaultValue={values?.name ?? name} errors={state?.errors?.name} />
        <TextField id={`date-${id}`} name="date" label="대회 날짜" type="date" min={today} defaultValue={values?.date ?? date} errors={state?.errors?.date} />
        <TextField id={`location-${id}`} name="location" label="장소 (선택)" defaultValue={values?.location ?? location ?? ""} errors={state?.errors?.location} />
        {state?.message ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        ) : null}
        {state?.saved ? (
          <p role="status" className="text-sm text-blue-800 dark:text-blue-200">
            수정했습니다.
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="w-fit rounded-full bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
          {pending ? "저장하는 중..." : "수정 저장"}
        </button>
      </form>
    </details>
  );
}
