import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OnboardingForm } from "@/app/onboarding/OnboardingForm";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { profileToFormValues, type ProfileFormValues } from "@/lib/profile/forms";
import { logServerError } from "@/lib/safeLog";

export const metadata: Metadata = { title: "시작 설정 · RunPilot" };

// Design Ref: §5.3 시작 설정 — 이미 저장한 값이 있으면 처음 값으로 채워서 고칠 수 있게 한다.

async function readInitialValues(): Promise<ProfileFormValues> {
  await connection();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return {};
    const { data } = await supabase
      .from("profiles")
      .select("age_band, experience, longest_run_km, goal")
      .eq("user_id", userId)
      .maybeSingle();
    return profileToFormValues(data);
  } catch (error) {
    unstable_rethrow(error);
    logServerError("onboarding.read", error);
    return {};
  }
}

async function OnboardingBody() {
  return <OnboardingForm initial={await readInitialValues()} />;
}

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">시작 설정</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          무리하지 않는 4주 계획을 만들기 위한 기본 정보입니다. 정확한 생년월일은 받지 않습니다.
        </p>
      </div>
      {/* 저장된 값은 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <OnboardingBody />
      </Suspense>
    </div>
  );
}
