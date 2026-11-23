"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitRun, type LogFormState } from "@/app/log/actions";
import { adjustmentText, cautionText } from "@/lib/caution/text";
import { TextField } from "@/components/TextField";
import { painFieldName } from "@/lib/checkin/forms";
import { PAIN_INTENSITIES, PAIN_INTENSITY_LABELS, PAIN_PART_LABELS, PAIN_PARTS } from "@/lib/schemas/lists";

// Design Ref: §5.3 훈련 후 기록 — 거리·시간 입력(비정상 값은 오류 표시), 통증 부위·강도 3단계, 통증 없음 선택
// 동의하지 않은 사용자는 통증 입력이 비활성이고 거리·시간만 기록할 수 있다.

export function LogForm({ today, consent }: { today: string; consent: boolean }) {
  const [state, action, pending] = useActionState<LogFormState, FormData>(submitRun, undefined);
  // 저장에 성공하면 칸을 비우고, 오류가 나면 방금 입력한 값을 유지한다.
  const values = state?.saved ? {} : (state?.values ?? {});
  const resetKey = state?.saved ? "saved" : JSON.stringify(values);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <TextField key={`date-${resetKey}`} id="date" name="date" label="달린 날짜" type="date" max={today} defaultValue={values.date ?? today} errors={state?.errors?.date} />
      <TextField key={`distance-${resetKey}`} id="distanceKm" name="distanceKm" label="거리 (km)" inputMode="decimal" defaultValue={values.distanceKm} errors={state?.errors?.distanceKm} />
      <TextField key={`duration-${resetKey}`} id="durationMinutes" name="durationMinutes" label="시간 (분)" inputMode="decimal" defaultValue={values.durationMinutes} errors={state?.errors?.durationMinutes} />

      <fieldset disabled={!consent} className="flex flex-col gap-2 disabled:opacity-50">
        <legend className="text-sm font-medium">달리면서 통증이 있었나요? 있는 부위만 강도를 고르세요. (모두 &quot;없음&quot;이면 통증 없음)</legend>
        {PAIN_PARTS.map((part) => (
          <div key={part} className="flex items-center justify-between gap-3 text-sm">
            <label htmlFor={`log-${painFieldName(part)}`}>{PAIN_PART_LABELS[part]}</label>
            <select
              key={`${part}-${resetKey}`}
              id={`log-${painFieldName(part)}`}
              name={painFieldName(part)}
              defaultValue=""
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">없음</option>
              {PAIN_INTENSITIES.map((intensity) => (
                <option key={intensity} value={intensity}>
                  {PAIN_INTENSITY_LABELS[intensity]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {state?.errors?.pains ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.errors.pains[0]}</p> : null}
      </fieldset>

      {!consent ? (
        <p className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          건강정보 수집에 동의하지 않아 통증 입력은 사용할 수 없습니다. 거리와 시간만 기록합니다. 원하면{" "}
          <Link href="/consent" className="font-medium underline">
            동의 화면
          </Link>
          에서 바꿀 수 있습니다.
        </p>
      ) : null}

      {state?.caution && state.caution.cautions.length > 0 ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
          {state.caution.cautions.map((caution) => {
            const text = cautionText(caution);
            return (
              <div key={caution.kind === "pain_streak" ? `pain-${caution.part}` : "spike"}>
                <p className="font-semibold">주의: {text.title}</p>
                <p>{text.body}</p>
              </div>
            );
          })}
          <p className="font-medium">조정안: {adjustmentText(state.caution.cautions, state.caution.change, state.caution.persisted)}</p>
        </div>
      ) : null}

      {state?.message ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      {state?.saved ? (
        <p role="status" className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          기록을 저장했습니다.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "저장하는 중..." : "기록 저장"}
      </button>
    </form>
  );
}
