"use client";

import { useActionState } from "react";
import { submitSurvey, type SurveyState } from "@/app/plan/survey";

// Design Ref: PLAN 성공 기준 "만족도" — 이 계획이 내 몸에 맞는 것 같은지 묻는다.

export function SurveyCard({ previous }: { previous: boolean | null }) {
  const [state, action, pending] = useActionState<SurveyState, FormData>(submitSurvey, undefined);
  const answered = state?.answered ? state.fits : previous;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 dark:border-rose-900 dark:bg-rose-950">
      <h2 className="font-semibold">이 계획이 내 몸에 맞는 것 같나요?</h2>
      <form action={action} className="flex gap-2">
        {(["yes", "no"] as const).map((value) => {
          const selected = answered === (value === "yes");
          return (
            <button
              key={value}
              type="submit"
              name="fits"
              value={value}
              disabled={pending}
              aria-pressed={answered === null || answered === undefined ? false : selected}
              className={`flex-1 rounded-full border px-4 py-2 font-semibold disabled:opacity-60 ${
                selected && answered !== null && answered !== undefined
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-rose-300 bg-white hover:bg-rose-100 dark:border-rose-700 dark:bg-transparent dark:hover:bg-rose-900"
              }`}
            >
              {value === "yes" ? "맞는 것 같아요" : "잘 모르겠어요"}
            </button>
          );
        })}
      </form>
      {state?.message ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      {answered !== null && answered !== undefined ? <p className="text-xs text-zinc-600 dark:text-zinc-400">응답해 주셔서 고맙습니다. 다시 누르면 바뀝니다.</p> : null}
    </section>
  );
}
