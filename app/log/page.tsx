import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogForm } from "@/app/log/LogForm";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";

export const metadata: Metadata = { title: "훈련 후 기록 · RunPilot" };

// Design Ref: §5.3 훈련 후 기록 — 거리·시간 기록과 (동의자만) 통증 입력. 최근 기록 5건을 함께 보여준다.

type RunRow = { id: string; run_date: string; distance_km: number | string; duration_minutes: number | string };

async function LogBody() {
  await connection();
  const today = todayInKorea();
  let consent = false; // 읽지 못하면 동의하지 않은 것으로 보고 통증 입력을 막는다.
  let runs: RunRow[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const [profile, recent] = await Promise.all([
      supabase.from("profiles").select("health_consent").maybeSingle(),
      supabase
        .from("runs")
        .select("id, run_date, distance_km, duration_minutes")
        .order("run_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    consent = profile.data?.health_consent === true;
    runs = recent.data ?? [];
  } catch (error) {
    unstable_rethrow(error);
    logServerError("log.read", error);
  }

  return (
    <>
      <LogForm today={today} consent={consent} />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">최근 기록</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">아직 기록이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="flex justify-between border-b border-zinc-100 py-1 dark:border-zinc-900">
                <span>{run.run_date}</span>
                <span>
                  {Number(run.distance_km).toFixed(2)} km · {Number(run.duration_minutes)}분
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function LogPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">훈련 후 기록</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          오늘 달린 거리와 시간을 입력하세요. 통증은 정해진 부위와 강도로만 입력하고, 글로 쓴 내용은 받지 않습니다. 의학적 진단이 아닙니다.
        </p>
      </div>
      {/* 동의 상태와 기록은 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <LogBody />
      </Suspense>
    </div>
  );
}
