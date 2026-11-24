"use client";

import { useActionState } from "react";
import { createPlan, type PlanActionState } from "@/app/plan/actions";

// Design Ref: §5.3 훈련계획 — "계획 만들기" 버튼. 실패하면 이유를 한국어로 안내한다.

export function CreatePlanForm({ label }: { label: string }) {
  const [state, action, pending] = useActionState<PlanActionState, FormData>(createPlan, undefined);

  return (
    <form action={action} className="flex flex-col gap-2">
      {state?.message ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-violet-600 dark:text-white dark:hover:bg-violet-500"
      >
        {pending ? "만드는 중..." : label}
      </button>
    </form>
  );
}
