"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { refreshWeeklyPlan } from "@/app/plan/actions";

// Design Ref: §7.7 주간 갱신 — 이번 주 첫 접속이면 새 4주 계획을 자동으로 만들고 화면을 새로 고친다.
// 서버가 "이번 주에 이미 만들었는지" 다시 확인하므로 여러 번 호출돼도 계획이 중복으로 생기지 않는다.

export function WeeklyRefresh() {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<"working" | "failed">("working");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    refreshWeeklyPlan()
      .then((result) => {
        if (result.status === "failed") setStatus("failed");
        else router.refresh();
      })
      .catch(() => setStatus("failed"));
  }, [router]);

  if (status === "failed") {
    return (
      <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        이번 주 새 계획을 만들지 못했습니다. 지금 계획은 그대로 쓸 수 있고, 계획 화면에서 직접 다시 만들 수 있습니다.
      </p>
    );
  }
  return (
    <p role="status" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
      새로운 한 주가 시작됐어요. 이번 주 계획을 새로 만드는 중입니다. (최대 1분 정도 걸릴 수 있습니다)
    </p>
  );
}
