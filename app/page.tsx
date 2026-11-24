import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GuestLanding } from "@/app/GuestLanding";
import { WeeklyRefresh } from "@/app/WeeklyRefresh";
import { EMERGENCY_GUIDANCE_TEXT, isTrainingSuspended } from "@/lib/rules/danger";
import { DANGER_SYMPTOMS, type DangerSymptom } from "@/lib/schemas/lists";
import { assessCautions, type Caution } from "@/lib/caution/assess";
import { readRecentPains } from "@/lib/caution/evaluate";
import { cautionText } from "@/lib/caution/text";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { currentWeek, findToday, weekdayLabel } from "@/lib/plans/view";
import { readLatestPlan, type StoredPlan } from "@/lib/plans/store";
import { mondayOf, needsWeeklyRefresh } from "@/lib/plans/weekly";
import { daysUntilRace, nearestUpcomingRace } from "@/lib/races/select";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";
import { TRAINING_KIND_LABELS } from "@/lib/schemas/lists";

// Design Ref: §5.2 대시보드 — 오늘의 훈련 카드, 이번 주 계획, 대회 D-day, 바로가기. 로그인 전에는 서비스 소개만 보여준다.
// 색의 의미: 일반 안내 회색·파랑, 주의 노랑, 긴급 빨강. 로즈 색은 꾸밈과 강조에만 쓴다.

type Home =
  | { kind: "guest" }
  | { kind: "error" }
  | {
      kind: "member";
      plan: StoredPlan | null;
      today: string;
      suspended: boolean;
      painCautions: Caution[];
      race: { name: string; daysLeft: number } | null;
      /** 이번 주 첫 접속이라 새 4주 계획을 만들 때인지 (위험 증상으로 훈련을 멈춘 중에는 만들지 않는다) */
      weeklyRefresh: boolean;
      /** 이번 주(월요일부터 오늘까지) 실제로 달린 거리(km) */
      doneKm: number;
    };

async function readHome(): Promise<Home> {
  await connection();
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return { kind: "guest" };

    const today = todayInKorea();
    const [plan, races, weekRuns, checkins] = await Promise.all([
      readLatestPlan(supabase),
      supabase.from("races").select("id, name, race_date"),
      // 이번 주(월요일부터 오늘까지) 달린 거리: 진행률 표시용. 거리 기록은 건강정보가 아니다.
      supabase.from("runs").select("distance_km").gte("run_date", mondayOf(today)).lte("run_date", today),
      supabase.from("checkins").select("checkin_date, danger_symptoms").order("checkin_date", { ascending: false }).limit(3),
    ]);
    if (races.error || checkins.error) throw races.error ?? checkins.error;
    const doneKm = weekRuns.error ? 0 : (weekRuns.data ?? []).reduce((sum, run) => sum + Number(run.distance_km), 0);
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
      weeklyRefresh: plan !== null && !suspended && needsWeeklyRefresh(plan.createdAt),
      doneKm,
    };
  } catch (error) {
    unstable_rethrow(error);
    logServerError("home.read", error);
    return { kind: "error" };
  }
}

const card = "flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const cardTitle = "text-sm font-semibold text-zinc-500 dark:text-zinc-400";
const primaryButton =
  "rounded-full bg-zinc-900 px-5 py-3 text-center font-semibold text-white shadow-sm hover:bg-zinc-700 dark:bg-violet-600 dark:text-white dark:hover:bg-violet-500";
const softButton =
  "rounded-full border border-zinc-300 bg-white/70 px-5 py-3 text-center font-semibold hover:bg-white dark:border-zinc-700 dark:bg-transparent dark:hover:bg-zinc-800";

// 로그인 전 첫 화면: 위쪽은 GuestLanding(Zapline 구성을 옮긴 어두운 히어로), 아래는 크림·로즈 톤의 시작 안내와 기능 소개.
const FEATURES = [
  { icon: "🗓", title: "무리 없는 4주 계획", body: "휴식일과 거리 증가 한도를 코드 규칙으로 지키는 훈련계획을 만들어 줍니다." },
  { icon: "🔔", title: "기록으로 보는 주의 안내", body: "거리가 갑자기 늘었거나 같은 부위 통증이 이어지면 쉬어 가라고 알려 줍니다." },
  { icon: "🏁", title: "대회까지 차근차근", body: "고러닝에서 대회를 찾고, 3주 전부터 훈련량을 줄이는 계획과 D-day를 보여 줍니다." },
] as const;

const STEPS = ["가입하고 시작 설정", "4주 계획 받기", "체크인·기록하기"] as const;

function GuestHero() {
  return (
    <>
      <GuestLanding />
    <div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-10">
      <section aria-label="시작하는 방법" className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">이렇게 시작해요</h2>
        <ol className="grid grid-cols-3 gap-2 text-center text-sm">
          {STEPS.map((step, index) => (
            <li key={step} className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-2 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-200">{index + 1}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <ul className="flex flex-col gap-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg dark:bg-violet-950">
              {feature.icon}
            </span>
            <div>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        의학적 진단이나 치료를 대신하지 않는 참고용 서비스입니다. 만 19세 이상만 가입할 수 있습니다.
      </p>
    </div>
    </>
  );
}

function todayHeadline(plan: StoredPlan | null, todayPlan: ReturnType<typeof findToday>, suspended: boolean): { title: string; sub: string } {
  if (suspended) return { title: "훈련을 잠시 멈췄어요", sub: "몸 상태를 확인한 뒤 체크인해 주세요." };
  if (!plan) return { title: "아직 훈련계획이 없어요", sub: "4주 계획을 만들면 오늘 할 훈련이 여기에 나와요." };
  if (!todayPlan) return { title: "계획 기간이 끝났어요", sub: "새 계획을 만들어 이어서 달려 보세요." };
  if (todayPlan.kind === "rest") return { title: "오늘은 푹 쉬는 날", sub: "쉬는 것도 훈련이에요. 가볍게 스트레칭해 보세요." };
  return { title: `${TRAINING_KIND_LABELS[todayPlan.kind]} ${todayPlan.distanceKm.toFixed(2)} km`, sub: "무리하지 말고 편한 속도로 달려요." };
}

async function HomeBody() {
  const home = await readHome();

  if (home.kind === "guest") return <GuestHero />;
  if (home.kind === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="sr-only">RunPilot 홈</h1>
        <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          화면을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  const { plan, today, race, suspended, painCautions, weeklyRefresh, doneKm } = home;
  const todayPlan = plan ? findToday(plan.days, today) : null;
  const week = plan ? currentWeek(plan.days, today) : [];
  // 이번 주 계획 거리(월~일)와 실제 거리. 100%를 넘겨도 막대는 가득까지만 채우고, 더 달리라고 부추기지 않는다.
  const plannedKm = week.reduce((sum, { day }) => sum + (day && day.kind !== "rest" ? day.distanceKm : 0), 0);
  const percent = plannedKm > 0 ? Math.round((doneKm / plannedKm) * 100) : 0;
  const headline = todayHeadline(plan, todayPlan, suspended);
  const needsPlan = !suspended && (!plan || !todayPlan);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="sr-only">RunPilot 홈</h1>
      {weeklyRefresh ? <WeeklyRefresh /> : null}
      {suspended ? (
        <div role="alert" className="rounded-2xl border border-red-400 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
          <p className="text-base font-bold">{EMERGENCY_GUIDANCE_TEXT}</p>
          <p className="mt-1">직전 체크인에서 위험 증상이 있었습니다. 다음 체크인에서 위험 증상이 없다고 확인하기 전까지 훈련을 제안하지 않습니다.</p>
        </div>
      ) : null}
      {painCautions.length > 0 ? (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-yellow-400 bg-yellow-50 px-5 py-4 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
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

      <section aria-label="오늘의 훈련" className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-violet-100 via-violet-50 to-violet-50 px-6 py-6 shadow-sm dark:from-violet-950 dark:via-zinc-900 dark:to-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-violet-700 dark:text-violet-200">오늘의 훈련 · {today.slice(5).replace("-", "/")} ({weekdayLabel(today)})</p>
          {race ? (
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-white/10 dark:text-violet-200">
              {race.daysLeft === 0 ? "D-day" : `D-${race.daysLeft}`}
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-3xl font-extrabold tracking-tight">{headline.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{headline.sub}</p>
        </div>
        {needsPlan ? (
          <Link href="/plan" className={primaryButton}>
            {plan ? "계획 다시 만들기" : "4주 계획 만들기"}
          </Link>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/checkin" className={needsPlan ? softButton : primaryButton}>
            훈련 전 체크인
          </Link>
          <Link href="/log" className={softButton}>
            훈련 후 기록
          </Link>
        </div>
      </section>

      {plan && !suspended ? (
        <section className={card}>
          <h2 className={cardTitle}>이번 주 계획</h2>
          <ol className="grid grid-cols-7 gap-1.5 text-center text-sm">
            {week.map(({ date, day }) => {
              const isToday = date === today;
              const training = day !== null && day.kind !== "rest";
              return (
                <li
                  key={date}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 ${
                    isToday ? "bg-violet-600 text-white shadow-sm" : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                >
                  <span className={`text-xs ${isToday ? "text-violet-100" : "text-zinc-500"}`}>{weekdayLabel(date)}</span>
                  <span aria-label={day ? TRAINING_KIND_LABELS[day.kind] : "계획 없음"} className="text-base leading-none">
                    {day === null ? "·" : training ? "●" : "○"}
                  </span>
                  <span className="text-xs font-medium">{training ? day.distanceKm.toFixed(1) : "-"}</span>
                </li>
              );
            })}
          </ol>
          {plannedKm > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">이번 주 진행</span>
                <span className="font-semibold">
                  {doneKm.toFixed(1)} / {plannedKm.toFixed(1)} km <span className="text-violet-300">({percent}%)</span>
                </span>
              </div>
              <div role="progressbar" aria-label="이번 주 계획 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              <p className="text-xs text-zinc-500">계획보다 더 달리지 않아도 괜찮아요. 몸 상태가 우선이에요.</p>
            </div>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">● 훈련 ○ 휴식 · 숫자는 km · 오늘은 진하게 표시돼요</p>
        </section>
      ) : null}

      <section className={card}>
        <h2 className={cardTitle}>대회</h2>
        {race ? (
          <p className="text-lg font-bold">
            {race.name} <span className="text-violet-700 dark:text-violet-300">· {race.daysLeft === 0 ? "D-day" : `D-${race.daysLeft}`}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">등록한 대회가 없습니다. 없어도 계획을 만들 수 있어요.</p>
        )}
        <Link href="/races" className="text-sm font-semibold text-violet-700 underline dark:text-violet-300">
          {race ? "대회 관리" : "대회 검색·입력"}
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/plan" className={softButton}>
          4주 계획 전체 보기
        </Link>
        <Link href="/onboarding" className={softButton}>
          시작 설정 수정
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  // 로그인 상태·계획은 요청마다 달라서 Suspense로 감싼다.
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-900" aria-hidden="true" />}>
      <HomeBody />
    </Suspense>
  );
}
