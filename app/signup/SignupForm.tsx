"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthFormState } from "@/app/auth/actions";
import { TextField } from "@/components/TextField";
import { PASSWORD_LENGTH } from "@/lib/rules/constants";

// Design Ref: §5.3 로그인/가입 — 이메일, 비밀번호, "만 19세 이상입니다" 체크(체크해야 가입 가능), 오류 메시지 영역

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, undefined);
  const adultErrors = state?.errors?.adultConfirmed;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <TextField
        id="email"
        name="email"
        label="이메일"
        type="email"
        autoComplete="email"
        defaultValue={state?.email}
        errors={state?.errors?.email}
      />
      <TextField
        id="password"
        name="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        hint={`${PASSWORD_LENGTH.min}자 이상으로 만들어 주세요.`}
        errors={state?.errors?.password}
      />

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="adultConfirmed"
            aria-invalid={Boolean(adultErrors?.length)}
            aria-describedby={adultErrors?.length ? "adultConfirmed-error" : undefined}
            className="mt-0.5 h-4 w-4"
          />
          <span>만 19세 이상입니다.</span>
        </label>
        {adultErrors?.length ? (
          <p id="adultConfirmed-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {adultErrors[0]}
          </p>
        ) : null}
      </div>

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
        {pending ? "가입하는 중..." : "회원가입"}
      </button>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
