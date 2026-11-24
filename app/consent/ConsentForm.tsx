"use client";

import { useActionState } from "react";
import { saveConsent, type ConsentFormState } from "@/app/consent/actions";

// Design Ref: §5.3 건강정보 동의 — "동의" / "동의하지 않고 계속" 두 버튼
// 두 버튼은 같은 폼에서 서로 다른 값(choice)을 보낸다. 미리 선택된 값은 없다.

export function ConsentForm() {
  const [state, action, pending] = useActionState<ConsentFormState, FormData>(saveConsent, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.message ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        name="choice"
        value="agree"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-violet-600 dark:text-white dark:hover:bg-violet-500"
      >
        동의
      </button>
      <button
        type="submit"
        name="choice"
        value="decline"
        disabled={pending}
        className="rounded-md border border-zinc-400 px-4 py-2 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        동의하지 않고 계속
      </button>
    </form>
  );
}
