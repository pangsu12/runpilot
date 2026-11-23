import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { logout } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";

// Design Ref: §5.2 — 머리글 오른쪽에 로그인 상태에 맞는 버튼을 보여준다.
// 로그인 상태는 요청마다 달라지므로, 이 부품은 반드시 <Suspense>로 감싸서 쓴다. (Next.js 16 캐시 규칙)

/** 로그인했으면 로그아웃 버튼, 아니면 로그인·회원가입 링크를 보여준다. */
export async function AuthStatus() {
  // 로그인 증명서 확인에는 "지금 시각"이 쓰인다. Next.js 16은 시각처럼 요청마다 달라지는 값을
  // 미리 그리는 단계에서 쓰지 못하게 하므로, 실제 요청이 들어온 뒤에 실행되도록 알린다.
  await connection();

  let isLoggedIn = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    isLoggedIn = Boolean(data?.claims?.sub);
  } catch (error) {
    // 쿠키를 읽을 때 Next.js가 던지는 내부 신호(빌드·미리 그리기 중)는 삼키지 않고 그대로 다시 던진다.
    unstable_rethrow(error);
    logServerError("header.auth", error);
  }

  if (isLoggedIn) {
    return (
      <form action={logout}>
        <button type="submit" className="text-sm font-medium underline">
          로그아웃
        </button>
      </form>
    );
  }

  return (
    <nav className="flex items-center gap-4 text-sm font-medium">
      <Link href="/login" className="underline">
        로그인
      </Link>
      <Link href="/signup" className="underline">
        회원가입
      </Link>
    </nav>
  );
}
