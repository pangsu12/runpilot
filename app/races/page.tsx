import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { deleteRace } from "@/app/races/actions";
import { RaceForm } from "@/app/races/RaceForm";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { daysUntilRace, nearestUpcomingRace } from "@/lib/races/select";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";

export const metadata: Metadata = { title: "대회 · RunPilot" };

// Design Ref: §5.3 대회 — 내가 저장한 대회 목록, 가장 가까운 미래 대회 표시, 직접 입력 폼
// 이 화면은 직접 입력만 지원한다. (고러닝 검색은 우선순위 B)

type RaceRow = {
  id: string;
  name: string;
  race_date: string;
  location: string | null;
  distance_label: string | null;
  registration_end: string | null;
};

async function readRaces(): Promise<RaceRow[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("races")
      .select("id, name, race_date, location, distance_label, registration_end")
      .order("race_date", { ascending: true });
    if (error) {
      logServerError("races.read", error);
      return null;
    }
    return data;
  } catch (error) {
    unstable_rethrow(error);
    logServerError("races.read", error);
    return null;
  }
}

async function RacesBody() {
  await connection();
  const today = todayInKorea();
  const races = await readRaces();
  const nearest = races ? nearestUpcomingRace(races, today) : null;

  return (
    <>
      {races === null ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          저장된 대회를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">내 대회</h2>
          {nearest ? (
            <p className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              가장 가까운 대회: {nearest.name} · {daysUntilRace(nearest.race_date, today) === 0 ? "D-day" : `D-${daysUntilRace(nearest.race_date, today)}`}
            </p>
          ) : null}
          {races.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">저장한 대회가 없습니다. 대회가 없어도 훈련계획은 만들 수 있습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {races.map((race) => (
                <li key={race.id} className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                  <div className="flex flex-col">
                    <span className="font-medium">{race.name}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {race.race_date}
                      {race.distance_label ? ` · ${race.distance_label}` : ""}
                      {race.location ? ` · ${race.location}` : ""}
                      {race.race_date < today ? " · 지난 대회" : ""}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {race.registration_end ? `신청 마감 ${race.registration_end}` : "신청 마감일 미확인"}
                    </span>
                  </div>
                  <form action={deleteRace}>
                    <input type="hidden" name="id" value={race.id} />
                    <button type="submit" className="text-sm font-medium underline">
                      삭제
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">대회 직접 입력</h2>
        <RaceForm today={today} />
      </section>
    </>
  );
}

export default function RacesPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">대회</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          준비 중인 대회를 입력하면 대회 약 3주 전부터 훈련량을 줄이는 계획을 만들 수 있습니다. 대회 참가가 걱정되면 미리 의사와 상담하세요.
        </p>
      </div>
      {/* 저장된 대회와 오늘 날짜는 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <RacesBody />
      </Suspense>
    </div>
  );
}
