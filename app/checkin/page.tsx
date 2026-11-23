import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckinForm } from "@/app/checkin/CheckinForm";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";

export const metadata: Metadata = { title: "훈련 전 체크인 · RunPilot" };

// Design Ref: §5.3 훈련 전 체크인 — 건강정보 동의 상태에 따라 컨디션·통증 입력을 켜거나 끈다.

async function CheckinBody() {
  await connection();
  let consent = false; // 읽지 못하면 동의하지 않은 것으로 보고 건강정보 입력을 막는다.
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("profiles").select("health_consent").maybeSingle();
    consent = data?.health_consent === true;
  } catch (error) {
    unstable_rethrow(error);
    logServerError("checkin.read", error);
  }
  return <CheckinForm consent={consent} />;
}

export default function CheckinPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">훈련 전 체크인</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          오늘 몸 상태를 알려 주세요. 통증은 정해진 부위와 강도로만 입력하고, 글로 쓴 내용은 받지 않습니다. 의학적 진단이 아닙니다.
        </p>
      </div>
      {/* 동의 상태는 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <CheckinBody />
      </Suspense>
    </div>
  );
}
