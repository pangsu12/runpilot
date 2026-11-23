import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";

// Design Ref: §5.2 공통 — 건강정보 동의를 거부한 사용자에게는 모든 화면에 "통증이나 이상이 있으면 즉시 중단하고 의사와 상담하세요"를 함께 보여준다.
// 로그인했고 동의하지 않은 사용자에게만 추가 문구를 붙인다. 읽지 못하면 안전하게 추가 문구를 붙이는 쪽이 아니라 기본 문구만 보여준다.

async function ConsentFooter() {
  await connection();
  let noHealthConsent = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (userId) {
      const { data } = await supabase.from("profiles").select("health_consent").eq("user_id", userId).maybeSingle();
      noHealthConsent = data !== null && data.health_consent !== true;
    }
  } catch (error) {
    unstable_rethrow(error);
    logServerError("footer.consent", error);
  }
  return <DisclaimerFooter noHealthConsent={noHealthConsent} />;
}

/** 모든 화면 맨 아래 안내. 기본 문구는 즉시 보이고, 동의 거부 문구는 확인되는 대로 붙는다. */
export function ConsentAwareFooter() {
  return (
    <Suspense fallback={<DisclaimerFooter />}>
      <ConsentFooter />
    </Suspense>
  );
}
