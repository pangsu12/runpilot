import { createClient } from "@supabase/supabase-js";
import { readEnv } from "@/lib/env";

// Design Ref: §9 — 관리자 키(SUPABASE_SERVICE_ROLE_KEY)는 탈퇴 처리(로그인 계정 삭제)에서만 쓴다.
// 일반 기록 조회·저장에는 쓰지 않고, 브라우저로 내보내지 않는다. 값은 .env에서만 읽고 출력하지 않는다.

/** 로그인 계정 삭제 전용 관리자 클라이언트. 서버 기능에서만 호출한다. */
export function createSupabaseAdminClient() {
  const { SUPABASE_URL } = readEnv("supabase");
  const { SUPABASE_SERVICE_ROLE_KEY } = readEnv("supabaseAdmin");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
