import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readEnv } from "@/lib/env";

// Design Ref: §4 서버 기능 → Supabase, §7.1 — 서버에서만 Supabase에 접속하고, 로그인 상태는 쿠키로 유지한다.
// 키는 NEXT_PUBLIC_ 없이 서버 전용 환경변수로 읽는다. (CLAUDE.md: 키는 브라우저에 노출하지 않는다)
// 요청마다 새로 만든다. 여러 요청이 하나의 클라이언트를 같이 쓰면 안 된다.

/** 서버 기능(서버 액션, 서버 컴포넌트)에서 쓰는 Supabase 클라이언트를 만든다. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = readEnv("supabase");

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 로그인 상태 갱신은 proxy.ts가 맡는다.
        }
      },
    },
  });
}
