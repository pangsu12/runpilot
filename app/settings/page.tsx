import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeleteAccountForm, HealthDataForm, WithdrawConsentForm } from "@/app/settings/SettingsForms";
import { CONSENT_TEXT } from "@/lib/consent/choice";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";

export const metadata: Metadata = { title: "설정 · RunPilot" };

// Design Ref: §5.8 설정 — 동의 상태 확인, 건강정보 삭제, 동의 철회(건강정보 삭제 포함), 탈퇴. 각 동작은 확인 창을 거친다.

async function readConsent(): Promise<boolean | "error"> {
  await connection();
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("profiles").select("health_consent").maybeSingle();
    if (error) throw error;
    return data?.health_consent === true;
  } catch (error) {
    unstable_rethrow(error);
    logServerError("settings.read", error);
    return "error";
  }
}

async function SettingsBody() {
  const consent = await readConsent();
  if (consent === "error") {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        설정을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">건강정보 동의</h2>
        <p className="text-sm">
          현재 상태: <strong>{consent ? "동의함" : "동의하지 않음"}</strong>
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{CONSENT_TEXT.retention}</p>
        {consent ? (
          <>
            <WithdrawConsentForm />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">철회하면 저장된 컨디션·통증·위험 증상 체크가 모두 지워집니다.</p>
          </>
        ) : (
          <Link href="/consent" className="text-sm font-medium underline">
            건강정보 동의 화면으로 가기
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">건강정보 삭제</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          저장된 컨디션, 통증, 위험 증상 체크를 지웁니다. 러닝 거리·시간 기록, 대회, 훈련계획은 그대로 남습니다. 동의 상태는 바뀌지 않습니다.
        </p>
        <HealthDataForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">탈퇴</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          계정과 모든 기록(프로필, 대회, 러닝 기록, 건강정보, 훈련계획)을 즉시 지웁니다. 되돌릴 수 없습니다.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">건강정보와 계정을 관리합니다.</p>
      </div>
      {/* 동의 상태는 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-64" aria-hidden="true" />}>
        <SettingsBody />
      </Suspense>
    </div>
  );
}
