import Link from "next/link";
import { Suspense } from "react";
import { AuthStatus } from "@/components/AuthStatus";

// Design Ref: §5.2 — 모든 화면 맨 위에 서비스 이름과 메뉴(로그인 상태에 따라 달라짐)를 보여준다.

/** 모든 화면 맨 위의 머리글. 위에 붙어 있어 스크롤해도 메뉴를 쓸 수 있다. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-background/85 px-4 py-3 backdrop-blur dark:border-zinc-800/70">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-600 text-sm text-white">
            R
          </span>
          RunPilot
        </Link>
        {/* 로그인 상태는 요청마다 달라서 Suspense로 감싼다. 불러오는 동안 같은 크기의 빈 칸을 둔다. */}
        <Suspense fallback={<div className="h-8 w-40" aria-hidden="true" />}>
          <AuthStatus />
        </Suspense>
      </div>
    </header>
  );
}
