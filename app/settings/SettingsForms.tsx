"use client";

import { useActionState } from "react";
import { deleteAccount, removeHealthData, revokeConsent, type SettingsState } from "@/app/settings/actions";

// Design Ref: §5.8 설정 — 되돌릴 수 없는 동작이므로 실행 전에 반드시 확인 창을 띄운다.

function Result({ state }: { state: SettingsState }) {
  if (state?.message) {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        {state.message}
      </p>
    );
  }
  if (state?.done) {
    return (
      <p role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        {state.done}
      </p>
    );
  }
  return null;
}

function ConfirmForm({
  action,
  confirmText,
  label,
  danger,
}: {
  action: () => Promise<SettingsState>;
  confirmText: string;
  label: string;
  danger?: boolean;
}) {
  const [state, run, pending] = useActionState<SettingsState, FormData>(async () => action(), undefined);
  return (
    <form
      action={run}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <Result state={state} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-4 py-2 font-medium disabled:opacity-60 ${
          danger
            ? "bg-red-700 text-white hover:bg-red-800"
            : "border border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-900"
        }`}
      >
        {pending ? "처리 중..." : label}
      </button>
    </form>
  );
}

export function HealthDataForm() {
  return (
    <ConfirmForm
      action={removeHealthData}
      label="저장된 건강정보 지우기"
      confirmText="저장된 컨디션·통증·위험 증상 체크를 모두 지웁니다. 되돌릴 수 없습니다. 계속할까요?"
    />
  );
}

export function WithdrawConsentForm() {
  return (
    <ConfirmForm
      action={revokeConsent}
      label="동의 철회하기"
      confirmText="동의를 철회하면 저장된 건강정보(컨디션·통증·위험 증상 체크)가 모두 지워지고, 이후 컨디션·통증 입력을 쓸 수 없습니다. 계속할까요?"
    />
  );
}

export function DeleteAccountForm() {
  return (
    <ConfirmForm
      action={deleteAccount}
      danger
      label="탈퇴하고 모든 기록 지우기"
      confirmText="탈퇴하면 계정과 모든 기록(프로필, 대회, 러닝 기록, 건강정보, 훈련계획)이 즉시 지워지고 되돌릴 수 없습니다. 정말 탈퇴할까요?"
    />
  );
}
