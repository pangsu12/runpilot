"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitCheckin, type CheckinFormState } from "@/app/checkin/actions";
import { cautionText } from "@/lib/caution/text";
import { painFieldName } from "@/lib/checkin/forms";
import { EMERGENCY_GUIDANCE_TEXT } from "@/lib/rules/danger";
import {
  CONDITION_LABELS,
  CONDITIONS,
  DANGER_SYMPTOM_LABELS,
  DANGER_SYMPTOMS,
  PAIN_INTENSITIES,
  PAIN_INTENSITY_LABELS,
  PAIN_PART_LABELS,
  PAIN_PARTS,
  TRAINING_KIND_LABELS,
} from "@/lib/schemas/lists";

// Design Ref: §5.2 체크인, §5.3 훈련 전 체크인 — 컨디션 3단계, 통증(없으면 건너뜀), 위험 증상 3개(없으면 건너뜀)
// 동의하지 않은 사용자는 컨디션·통증이 비활성이고 위험 증상 체크만 할 수 있다. (저장하지 않고 안내만 한다)
// 위험 증상이 체크되면 훈련 제안 대신 빨간 긴급 안내를 보여준다.

const box = "rounded-md border px-3 py-2 text-sm";

export function CheckinForm({ consent }: { consent: boolean }) {
  const [state, action, pending] = useActionState<CheckinFormState, FormData>(submitCheckin, undefined);
  const result = state?.result;

  return (
    <div className="flex flex-col gap-5">
      {result?.outcome.hasDanger ? (
        <div role="alert" className={`${box} border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100`}>
          <p className="font-semibold">{EMERGENCY_GUIDANCE_TEXT}</p>
          <p className="mt-1">오늘 훈련 제안을 멈춥니다. 증상이 사라졌더라도 다음 체크인에서 위험 증상이 없다고 확인하기 전까지는 훈련을 제안하지 않습니다.</p>
        </div>
      ) : null}

      {result && !result.outcome.hasDanger ? (
        <div role="status" className={`${box} border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100`}>
          {result.outcome.workout === null ? (
            <p>오늘 계획된 훈련이 없습니다.</p>
          ) : result.outcome.changed ? (
            <p>
              {result.outcome.reason === "pain" ? "같은 부위 통증이 연속 입력되어" : "컨디션이 좋지 않아"} 오늘 훈련을 <strong>휴식</strong>으로 바꿨습니다.
              {result.saved ? "" : " (동의하지 않아 저장하지 않았습니다. 새로고침하면 원래 계획이 다시 보입니다.)"}
            </p>
          ) : (
            <p>
              오늘 훈련은 그대로입니다:{" "}
              {result.outcome.workout.kind === "rest"
                ? "휴식"
                : `${TRAINING_KIND_LABELS[result.outcome.workout.kind]} ${result.outcome.workout.distanceKm.toFixed(2)} km`}
            </p>
          )}
          {result.outcome.offerLightAlternative ? (
            <p className="mt-1">원하면 아주 가벼운 걷기나 조깅으로 대신할 수 있습니다. (강도 기준은 전문가 검토 후 정합니다.)</p>
          ) : null}
        </div>
      ) : null}

      {result && result.outcome.painStreaks.length > 0 ? (
        <div role="alert" className={`${box} border-yellow-400 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100`}>
          {result.outcome.painStreaks.map((streak) => {
            const text = cautionText({ kind: "pain_streak", part: streak.part, days: streak.days });
            return (
              <div key={streak.part}>
                <p className="font-semibold">주의: {text.title}</p>
                <p>{text.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {result?.outcome.hasDanger && result.outcome.workout !== null && !result.saved ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">동의하지 않아 기록은 저장하지 않았습니다.</p>
      ) : null}

      {state?.message ? (
        <p role="alert" className={`${box} border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300`}>
          {state.message}
        </p>
      ) : null}

      <form action={action} className="flex flex-col gap-5">
        <fieldset disabled={!consent} className="flex flex-col gap-2 disabled:opacity-50">
          <legend className="text-sm font-medium">오늘 컨디션은 어떤가요?</legend>
          <div className="flex gap-4">
            {CONDITIONS.map((condition) => (
              <label key={condition} className="flex items-center gap-1 text-sm">
                <input type="radio" name="condition" value={condition} />
                {CONDITION_LABELS[condition]}
              </label>
            ))}
          </div>
          {state?.errors?.condition ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.errors.condition[0]}</p>
          ) : null}
        </fieldset>

        <fieldset disabled={!consent} className="flex flex-col gap-2 disabled:opacity-50">
          <legend className="text-sm font-medium">통증이 있나요? 있는 부위만 강도를 고르세요. (없으면 건너뛰기)</legend>
          {PAIN_PARTS.map((part) => (
            <div key={part} className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor={painFieldName(part)}>{PAIN_PART_LABELS[part]}</label>
              <select
                id={painFieldName(part)}
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
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">아래 증상이 있나요? (없으면 건너뛰기)</legend>
          {DANGER_SYMPTOMS.map((symptom) => (
            <label key={symptom} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="danger" value={symptom} />
              {DANGER_SYMPTOM_LABELS[symptom]}
            </label>
          ))}
        </fieldset>

        {!consent ? (
          <p className={`${box} border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300`}>
            건강정보 수집에 동의하지 않아 컨디션·통증 입력은 사용할 수 없습니다. 위험 증상 체크는 저장 없이 안내만 합니다. 원하면{" "}
            <Link href="/consent" className="font-medium underline">
              동의 화면
            </Link>
            에서 바꿀 수 있습니다.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "확인하는 중..." : "제출"}
        </button>
      </form>
    </div>
  );
}
