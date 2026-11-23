import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConsentForm } from "@/app/consent/ConsentForm";
import { CONSENT_TEXT } from "@/lib/consent/choice";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";

export const metadata: Metadata = { title: "건강정보 동의 · RunPilot" };

// Design Ref: §5.3 건강정보 동의 — 수집 항목, 사용 목적, 보관 기간, 삭제 방법, 두 버튼, 거부해도 거리 기록 사용 가능 안내
// 문구는 임시 초안이며 법적 검토 후 확정한다. (PRD 7번 공개 전 과제)

/** 이미 동의한 사용자인지 읽어 온다. 읽지 못하면 null(아직 동의 안 함으로 보고 선택 화면을 보여준다). */
async function readConsentState(): Promise<boolean | null> {
  await connection();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return null;
    const { data } = await supabase.from("profiles").select("health_consent").eq("user_id", userId).maybeSingle();
    return data ? data.health_consent === true : null;
  } catch (error) {
    unstable_rethrow(error);
    logServerError("consent.read", error);
    return null;
  }
}

async function ConsentBody() {
  const consented = await readConsentState();

  return (
    <>
      {consented ? (
        <p className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          현재 건강정보 수집·이용에 동의한 상태입니다. 동의 철회는 설정 화면에서 할 수 있도록 이후 단계에서 제공됩니다.
        </p>
      ) : null}
      <ConsentForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{CONSENT_TEXT.declineNote}</p>
      <Link href="/" className="text-sm font-medium underline">
        나중에 하기
      </Link>
    </>
  );
}

export default function ConsentPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">건강정보 수집·이용 동의</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          더 안전한 훈련 안내를 위해 러닝 중 느낀 통증과 컨디션을 저장할지 선택해 주세요. 선택하지 않으면 저장하지 않습니다.
        </p>
      </div>

      <dl className="flex flex-col gap-4 text-sm">
        <div>
          <dt className="font-semibold">수집 항목</dt>
          <dd>
            <ul className="list-disc pl-5">
              {CONSENT_TEXT.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="font-semibold">사용 목적</dt>
          <dd>{CONSENT_TEXT.purpose}</dd>
        </div>
        <div>
          <dt className="font-semibold">보관 기간</dt>
          <dd>{CONSENT_TEXT.retention}</dd>
        </div>
        <div>
          <dt className="font-semibold">삭제 방법</dt>
          <dd>{CONSENT_TEXT.deletion}</dd>
        </div>
      </dl>

      {/* 현재 동의 상태는 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-32" aria-hidden="true" />}>
        <ConsentBody />
      </Suspense>
    </div>
  );
}
