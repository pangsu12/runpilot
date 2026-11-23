import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { redirectTarget } from "@/lib/auth/paths";
import { readEnv } from "@/lib/env";
import { logServerError } from "@/lib/safeLog";

// Design Ref: §4 proxy.ts — 로그인 안 했으면 로그인 화면으로 보낸다. (Next.js 16에서는 middleware 대신 proxy)
// Next.js 문서 안내: proxy는 모든 화면 앞에서 실행되므로 쿠키만 읽는 가벼운 검사(낙관적 확인)만 한다.
// 실제 데이터 접근 권한은 데이터베이스의 RLS(본인 기록만 보기)가 한 번 더 지킨다.

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let isLoggedIn = false;

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = readEnv("supabase");
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // 로그인 상태가 갱신되면 새 쿠키를 요청과 응답 양쪽에 반영한다.
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // 쿠키의 로그인 증명서를 확인한다 (만료됐으면 갱신한다).
    const { data } = await supabase.auth.getClaims();
    isLoggedIn = Boolean(data?.claims?.sub);
  } catch (error) {
    // 설정이 빠졌거나 확인에 실패하면 "로그인 안 함"으로 본다. 공개 화면은 계속 볼 수 있다.
    logServerError("proxy.auth", error);
  }

  const target = redirectTarget(request.nextUrl.pathname, isLoggedIn);
  if (target) {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    // 갱신된 로그인 쿠키가 있으면 이동하는 응답에도 실어 보낸다.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

// 정적 파일(이미지, 아이콘 등)에는 실행하지 않는다.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
