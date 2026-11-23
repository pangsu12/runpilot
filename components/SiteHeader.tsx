import Link from "next/link";

// Design Ref: §5.2 — 모든 화면 맨 위에 서비스 이름을 보여준다. (설정 버튼 등은 이후 작업에서 추가)

/** 모든 화면 맨 위의 머리글 */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          RunPilot
        </Link>
      </div>
    </header>
  );
}
