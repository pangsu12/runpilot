import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreatePlanForm } from "@/app/plan/CreatePlanForm";
import { SurveyCard } from "@/app/plan/SurveyCard";
import { DOCTOR_ADVICE_TEXT } from "@/components/DisclaimerFooter";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { groupByWeek, isTaperDay, weekdayLabel } from "@/lib/plans/view";
import { readLatestPlan, type StoredPlan } from "@/lib/plans/store";
import { nearestUpcomingRace } from "@/lib/races/select";
import { isShortNotice } from "@/lib/rules/planValidator";
import { logServerError } from "@/lib/safeLog";
import { todayInKorea } from "@/lib/schemas/date";
import { TRAINING_KIND_LABELS } from "@/lib/schemas/lists";

export const metadata: Metadata = { title: "훈련계획 · RunPilot" };

// 계획 만들기(서버 동작)가 AI를 최대 3번 부르므로 실행 시간을 넉넉히 둔다. (배포 요금제의 한도를 넘으면 낮춰야 한다)
export const maxDuration = 90;

// Design Ref: §5.3 훈련계획 — 4주 달력형 표(날짜·훈련 종류·거리·휴식일), 계획 출처 표시, 감량 구간 표시, 의사 상담 안내
// 이 화면의 계획은 AI가 만들고 코드 검증을 통과한 계획이거나, 코드의 안전 규칙으로 만든 기본 계획이다. 출처와 대체 이유를 표시한다.

// 기본 계획으로 바꾼 이유 (사용자에게 보이는 안내. 건강정보와 무관하다)
const FALLBACK_TEXT: Record<string, string> = {
  timeout: "AI 응답이 늦어져 기본 계획으로 바꿨습니다.",
  ai_failed: "AI 계획을 받지 못해 기본 계획으로 바꿨습니다.",
  validation_failed: "AI 계획이 안전 규칙을 통과하지 못해 기본 계획으로 바꿨습니다.",
};

type PageData = { plan: StoredPlan | null; raceDate: string | null; today: string; survey: boolean | null } | "error";

async function readPageData(): Promise<PageData> {
  await connection();
  const today = todayInKorea();
  try {
    const supabase = await createSupabaseServerClient();
    const [plan, races, survey] = await Promise.all([
      readLatestPlan(supabase),
      supabase.from("races").select("id, name, race_date"),
      supabase.from("survey_responses").select("fits").maybeSingle(),
    ]);
    if (races.error) throw races.error;
    // 설문은 부가 기능이라 읽지 못해도 계획 화면은 보여준다.
    return { plan, raceDate: nearestUpcomingRace(races.data ?? [], today)?.race_date ?? null, today, survey: survey.error ? null : (survey.data?.fits ?? null) };
  } catch (error) {
    unstable_rethrow(error);
    logServerError("plan.read", error);
    return "error";
  }
}

async function PlanBody() {
  const data = await readPageData();

  if (data === "error") {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        계획을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  }

  const { plan, raceDate, today, survey } = data;
  if (!plan || plan.days.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          아직 만든 계획이 없습니다. 시작 설정에 입력한 값과 가장 가까운 대회를 바탕으로 무리하지 않는 4주 계획을 만듭니다.
        </p>
        <CreatePlanForm label="4주 계획 만들기" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          시작 설정을 아직 마치지 않았다면{" "}
          <Link href="/onboarding" className="font-medium underline">
            시작 설정
          </Link>
          부터 해 주세요.
        </p>
      </div>
    );
  }

  const weeks = groupByWeek(plan.days);
  const hasTaper = raceDate !== null && plan.days.some((day) => day.kind !== "rest" && isTaperDay(day.date, raceDate));
  const shortNotice = raceDate !== null && isShortNotice(plan.days[0].date, raceDate);

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        {plan.source === "ai"
          ? "AI가 만들고 코드 규칙으로 검증한 계획입니다."
          : "기본 계획입니다. 코드의 안전 규칙으로 만들었습니다."}
        {plan.fallbackReason ? ` ${FALLBACK_TEXT[plan.fallbackReason] ?? FALLBACK_TEXT.ai_failed}` : null}
      </p>

      {raceDate && hasTaper ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          대회({raceDate}) 약 3주 전부터 훈련량을 줄이는 <strong>감량 구간</strong>이 표시됩니다.
        </p>
      ) : null}
      {shortNotice ? (
        <p role="status" className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          대회까지 권장 준비 기간(3주)보다 짧습니다. 남은 기간 안에서만 훈련량을 줄입니다.
        </p>
      ) : null}

      {weeks.map((week, index) => (
        <section key={week[0].date} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">{index + 1}주차</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              주간 합계 <strong className="text-rose-700 dark:text-rose-300">{week.reduce((sum, day) => sum + (day.kind === "rest" ? 0 : day.distanceKm), 0).toFixed(1)} km</strong>
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-1 pr-2 font-medium">날짜</th>
                <th className="py-1 pr-2 font-medium">훈련</th>
                <th className="py-1 text-right font-medium">거리</th>
              </tr>
            </thead>
            <tbody>
              {week.map((day) => {
                const taper = isTaperDay(day.date, raceDate);
                const isRaceDay = raceDate === day.date;
                return (
                  <tr
                    key={day.date}
                    className={`border-b border-zinc-100 dark:border-zinc-900 ${day.date === today ? "font-semibold" : ""} ${taper ? "bg-yellow-50 dark:bg-yellow-950/40" : ""}`}
                  >
                    <td className="py-1 pr-2">
                      {day.date.slice(5)} ({weekdayLabel(day.date)})
                      {day.date === today ? " · 오늘" : ""}
                    </td>
                    <td className="py-1 pr-2">
                      {isRaceDay ? "대회 당일" : TRAINING_KIND_LABELS[day.kind]}
                      {taper && day.kind !== "rest" ? " (감량)" : ""}
                    </td>
                    <td className="py-1 text-right">{day.kind === "rest" ? "-" : `${day.distanceKm.toFixed(2)} km`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <SurveyCard previous={survey} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">{DOCTOR_ADVICE_TEXT}</p>
      <div className="flex flex-col gap-1">
        <CreatePlanForm label="계획 다시 만들기" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          시작 설정이나 대회를 바꿨다면 다시 만들어 주세요. 오늘부터 새 4주 계획이 만들어지고, 가장 최근 계획이 표시됩니다.
        </p>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">훈련계획</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          참고용 계획입니다. 통증이나 이상이 있으면 즉시 중단하고 의사와 상담하세요.
        </p>
      </div>
      {/* 계획과 오늘 날짜는 요청마다 달라서 Suspense로 감싼다. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <PlanBody />
      </Suspense>
    </div>
  );
}
