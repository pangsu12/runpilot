"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabaseServer";
import { logServerError } from "@/lib/safeLog";

// Design Ref: PLAN 성공 기준 "만족도" — 계획이 "내 몸에 맞는 것 같다"는지 예/아니오로 한 번 묻는다. 사용자당 한 건(다시 누르면 바뀐다).
// 건강정보가 아니며 글로 쓴 의견은 받지 않는다.

export type SurveyState = { answered?: boolean; fits?: boolean; message?: string } | undefined;

export async function submitSurvey(_previous: SurveyState, formData: FormData): Promise<SurveyState> {
  const answer = formData.get("fits");
  if (answer !== "yes" && answer !== "no") return { message: "예 또는 아니오를 골라 주세요." };
  const fits = answer === "yes";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return { message: "로그인이 필요합니다." };
    const { error } = await supabase
      .from("survey_responses")
      .upsert({ user_id: userId, fits, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  } catch (error) {
    unstable_rethrow(error);
    logServerError("survey.submit", error);
    return { message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  revalidatePath("/plan");
  return { answered: true, fits };
}
