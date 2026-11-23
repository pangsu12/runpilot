import Link from "next/link";
import { Suspense } from "react";
import { AuthStatus } from "@/components/AuthStatus";

// Design Ref: §5.2 — 모든 화면 맨 위에 서비스 이름과 로그인 상태 버튼을 보여준다. (설정 버튼 등은 이후 작업에서 추가)

/** 모든 화면 맨 위의 머리글 */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          RunPilot
        </Link>
        {/* 로그인 상태는 요청마다 달라서 Suspense로 감싼다. 불러오는 동안 같은 크기의 빈 칸을 둔다. */}
        <Suspense fallback={<div className="h-5 w-28" aria-hidden="true" />}>
          <AuthStatus />
        </Suspense>
      </div>
    </header>
  );
}
