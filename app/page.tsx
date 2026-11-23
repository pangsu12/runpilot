import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EMERGENCY_GUIDANCE_TEXT, isTrainingSuspended } from "@/lib/rules/danger";
import { DANGER_SYMPTOMS, type DangerSymptom } from "@/lib/schemas/lists";
import { assessCautions, type Caution } from "@/lib/caution/assess";
import { readRecentPains } from "@/lib/caution/evaluate";
import { cautionText } from "@/lib/caution/text";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { currentWeek, findToday } from "@/lib/plans/view";
import { readLatestPlan, type StoredPlan } from "@/lib/plans/store";
import { daysUntilRace, nearestUpcomingRace } from "@/lib/races/select";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";
import { TRAINING_KIND_LABELS } from "@/lib/schemas/lists";

// Design Ref: §5.2 대시보드 — 오늘의 훈련 카드, 이번 주 계획, 대회 D-day, 바로가기. 로그인 전에는 서비스 소개만 보여준다.
// 체크인·기록 화면은 PLAN 12·13번에서 만든다. 긴급·주의 안내 영역은 14번에서 연결한다.

type Home =
  | { kind: "guest" }
  | { kind: "error" }
  | { kind: "member"; plan: StoredPlan | null; today: string; suspended: boolean; painCautions: Caution[]; race: { name: string; daysLeft: number } | null };

async function readHome(): Promise<Home> {
  await connection();
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return { kind: "guest" };

    const today = todayInKorea();
    const [plan, races, checkins] = await Promise.all([
      readLatestPlan(supabase),
      supabase.from("races").select("id, name, race_date"),
      supabase.from("checkins").select("checkin_date, danger_symptoms").order("checkin_date", { ascending: false }).limit(3),
    ]);
    if (races.error || checkins.error) throw races.error ?? checkins.error;
    // 가장 최근 체크인에 위험 증상이 있으면, 다음 체크인에서 없다고 확인하기 전까지 훈련 제안을 멈춘다. (동의해서 저장된 체크인만 알 수 있다)
    // 같은 부위 통증이 오늘까지 3일 연속이면 대시보드에도 주의를 보여준다. (동의해서 저장된 통증만 알 수 있다)
    const painCautions = assessCautions({
      run: null,
      otherRuns: [],
      profileLongestKm: 0,
      pains: await readRecentPains(supabase, today),
      painAsOf: today,
    });
    const suspended = isTrainingSuspended(
      (checkins.data ?? []).map((row) => ({
        date: row.checkin_date,
        dangerSymptoms: (row.danger_symptoms as string[]).filter((s): s is DangerSymptom => (DANGER_SYMPTOMS as readonly string[]).includes(s)),
      })),
    );
    const next = nearestUpcomingRace(races.data ?? [], today);
    return {
      kind: "member",
      plan,
      today,
      suspended,
      painCautions,
      race: next ? { name: next.name, daysLeft: daysUntilRace(next.race_date, today) } : null,
    };
  } catch (error) {
    unstable_rethrow(error);
    logServerError("home.read", error);
    return { kind: "error" };
  }
}

const card = "flex flex-col gap-2 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800";
const linkButton =
  "rounded-md border border-zinc-400 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800";

async function HomeBody() {
  const home = await readHome();

  if (home.kind === "guest") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          몸에 무리가 가지 않는 러닝 훈련을 돕는 참고용 가이드입니다.
        </p>
        <p className="text-sm text-zinc-500">로그인하면 4주 훈련계획을 만들고 기록에 따른 주의 안내를 받을 수 있습니다.</p>
      </div>
    );
  }
  if (home.kind === "error") {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        화면을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  }

  const { plan, today, race, suspended, painCautions } = home;
  const todayPlan = plan ? findToday(plan.days, today) : null;
  const week = plan ? currentWeek(plan.days, today) : [];

  return (
    <div className="flex flex-col gap-4">
      {suspended ? (
        <div role="alert" className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
          <p className="font-semibold">{EMERGENCY_GUIDANCE_TEXT}</p>
          <p className="mt-1">직전 체크인에서 위험 증상이 있었습니다. 다음 체크인에서 위험 증상이 없다고 확인하기 전까지 훈련을 제안하지 않습니다.</p>
        </div>
      ) : null}
      {painCautions.length > 0 ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
          {painCautions.map((caution) => {
            const text = cautionText(caution);
            return (
              <div key={caution.kind === "pain_streak" ? caution.part : "spike"}>
                <p className="font-semibold">주의: {text.title}</p>
                <p>{text.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      <section className={card}>
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">오늘의 훈련</h2>
        {suspended ? (
          <p>훈련 제안을 멈췄습니다. 몸 상태를 확인한 뒤 체크인해 주세요.</p>
        ) : !plan ? (
          <>
            <p>아직 훈련계획이 없습니다.</p>
            <Link href="/plan" className={linkButton}>
              4주 계획 만들기
            </Link>
          </>
        ) : todayPlan ? (
          <p className="text-xl font-semibold">
            {todayPlan.kind === "rest" ? "오늘은 휴식일입니다" : `${TRAINING_KIND_LABELS[todayPlan.kind]} ${todayPlan.distanceKm.toFixed(2)} km`}
          </p>
        ) : (
          <>
            <p>계획 기간이 끝났습니다. 새 계획을 만들어 주세요.</p>
            <Link href="/plan" className={linkButton}>
              계획 다시 만들기
            </Link>
          </>
        )}
        <Link href="/checkin" className={linkButton}>
          훈련 전 체크인 하기
        </Link>
        <Link href="/log" className={linkButton}>
          훈련 후 기록하기
        </Link>
      </section>

      {plan && !suspended ? (
        <section className={card}>
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">이번 주 계획</h2>
          <ol className="grid grid-cols-7 gap-1 text-center text-sm">
            {week.map(({ date, day }) => (
              <li key={date} className={`flex flex-col gap-0.5 rounded px-1 py-1 ${date === today ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : ""}`}>
                <span className="text-xs text-zinc-500">{["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T00:00:00Z`).getUTCDay()]}</span>
                <span aria-label={day ? TRAINING_KIND_LABELS[day.kind] : "계획 없음"}>
                  {day === null ? "·" : day.kind === "rest" ? "○" : "●"}
                </span>
                <span className="text-xs">{day && day.kind !== "rest" ? day.distanceKm.toFixed(1) : ""}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">● 훈련 ○ 휴식 · 숫자는 km</p>
        </section>
      ) : null}

      <section className={card}>
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">대회</h2>
        {race ? (
          <p>
            {race.name} · {race.daysLeft === 0 ? "D-day" : `D-${race.daysLeft}`}
          </p>
        ) : (
          <p className="text-sm">등록한 대회가 없습니다. 없어도 계획을 만들 수 있습니다.</p>
        )}
        <Link href="/races" className="text-sm font-medium underline">
          대회 입력·관리
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/plan" className={linkButton}>
          4주 계획 전체 보기
        </Link>
        <Link href="/onboarding" className={linkButton}>
          시작 설정 수정
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">RunPilot</h1>
      {/* 로그인 상태·계획은 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-64" aria-hidden="true" />}>
        <HomeBody />
      </Suspense>
    </div>
  );
}
