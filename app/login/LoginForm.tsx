"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "@/app/auth/actions";
import { TextField } from "@/components/TextField";

// Design Ref: §5.3 로그인/가입 — 이메일, 비밀번호 입력칸, 오류 메시지 영역

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, undefined);

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
        autoComplete="current-password"
        errors={state?.errors?.password}
      />

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
        {pending ? "로그인하는 중..." : "로그인"}
      </button>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-medium underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
