// 만족도 설문 결과 집계 (PLAN 성공 기준: "내 몸에 맞는 것 같다" 80% 이상).
// 실행: npm run survey:summary — 서버 전용 관리자 키로 읽으며, 계정 ID나 이메일은 출력하지 않고 개수와 비율만 보여준다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env에 필요합니다.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.from("survey_responses").select("fits");
if (error) {
  console.error("설문을 읽지 못했습니다.");
  process.exit(1);
}

const total = data.length;
const yes = data.filter((row) => row.fits).length;
const percent = total === 0 ? 0 : Math.round((yes / total) * 100);
console.log(`응답 ${total}명 중 "맞는 것 같아요" ${yes}명 (${percent}%)`);
console.log(total < 10 ? "※ 응답이 10명 미만이라 참고용입니다. (목표 인원은 확정 필요)" : percent >= 80 ? "목표(80%)를 넘었습니다." : "목표(80%)에 못 미칩니다.");
