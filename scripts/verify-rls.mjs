// "본인 기록만 보기"(RLS) 실제 검증 — 실행: npm run verify:rls
// Design Ref: §9 보안과 개인정보, §10.2 시나리오 8 (다른 사용자의 기록은 보이지 않는다)
//
// 실제 Supabase 프로젝트에 가짜 계정 2개를 만들어 서로의 기록이 보이는지 확인하고, 끝나면 계정을 모두 삭제한다.
// 키 값은 화면에 출력하지 않는다. (.env를 읽어서 사용한다)
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.log("SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 .env에 필요합니다.");
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const results = [];

function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const rand = () => Math.random().toString(36).slice(2, 10);
const randomPassword = () => `Tt-${rand()}${rand()}!9`;

const created = [];

/** 가짜 계정을 만들고 로그인한 클라이언트를 돌려준다. (가짜 이메일 사용) */
async function makeUser(label) {
  const email = `rls-test-${label}-${rand()}@example.com`;
  const password = randomPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`계정 생성 실패: ${error.message}`);
  created.push(data.user.id);
  const client = createClient(url, anonKey, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`로그인 실패: ${signedIn.error.message}`);
  return { id: data.user.id, client };
}

try {
  const A = await makeUser("a");
  const B = await makeUser("b");
  const anon = createClient(url, anonKey, options);

  // 0) 가입하면 프로필이 자동으로 만들어지고, 가입 화면이 보낸 "만 19세 이상" 확인이 시각으로 저장된다 (데이터베이스 트리거)
  const adultEmail = `rls-test-adult-${rand()}@example.com`;
  const adultSignup = await admin.auth.admin.createUser({
    email: adultEmail,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { adult_confirmed: true },
  });
  if (adultSignup.error) throw new Error(`계정 생성 실패: ${adultSignup.error.message}`);
  created.push(adultSignup.data.user.id);
  let profileCheck = await admin.from("profiles").select("adult_confirmed_at").eq("user_id", adultSignup.data.user.id);
  check(
    "가입하면 프로필이 자동으로 만들어지고 만 19세 확인 시각이 저장된다",
    !profileCheck.error && profileCheck.data.length === 1 && profileCheck.data[0].adult_confirmed_at !== null,
    profileCheck.error?.message,
  );
  profileCheck = await admin.from("profiles").select("adult_confirmed_at, health_consent").eq("user_id", A.id);
  check(
    "확인 표시 없이 만든 계정은 프로필만 있고 만 19세 확인 시각이 비어 있다 (건강정보 동의도 아직 아님)",
    !profileCheck.error &&
      profileCheck.data.length === 1 &&
      profileCheck.data[0].adult_confirmed_at === null &&
      profileCheck.data[0].health_consent === false,
    profileCheck.error?.message,
  );

  // 1) 본인 기록 저장·조회
  let r = await A.client.from("runs").insert({ run_date: "2026-11-20", distance_km: 5, duration_minutes: 30 }).select();
  check("A가 자기 러닝 기록을 저장한다", !r.error && r.data?.length === 1, r.error?.message);
  const runId = r.data?.[0]?.id;
  r = await A.client.from("runs").select("*");
  check("A는 자기 기록 1건을 본다", !r.error && r.data.length === 1);

  // 2) 다른 사람 기록은 보이지 않음
  r = await B.client.from("runs").select("*");
  check("B는 A의 기록이 보이지 않는다 (0건)", !r.error && r.data.length === 0, r.error?.message);

  // 3) 로그인하지 않은 사용자
  r = await anon.from("runs").select("*");
  check(
    "로그인하지 않은 사용자는 기록에 접근할 수 없다",
    Boolean(r.error) || (r.data && r.data.length === 0),
    r.error ? r.error.message : "빈 결과",
  );

  // 4) 남의 user_id로 저장 시도
  r = await B.client.from("runs").insert({ user_id: A.id, run_date: "2026-11-21", distance_km: 3, duration_minutes: 20 });
  check("B가 A의 이름으로 기록을 저장하려 하면 거부된다", Boolean(r.error), r.error?.message);

  // 5) 남의 기록 수정·삭제 시도 (0건 처리되고 원본은 그대로)
  r = await B.client.from("runs").update({ distance_km: 99 }).eq("id", runId).select();
  check("B가 A의 기록을 고치려 해도 0건 (변경 안 됨)", !r.error && r.data.length === 0);
  r = await B.client.from("runs").delete().eq("id", runId).select();
  check("B가 A의 기록을 지우려 해도 0건 (삭제 안 됨)", !r.error && r.data.length === 0);
  r = await admin.from("runs").select("distance_km").eq("id", runId);
  check("A의 원본 기록은 그대로다 (5km)", !r.error && r.data.length === 1 && Number(r.data[0].distance_km) === 5);

  // 6) 건강정보: 동의 없이 저장 거부
  r = await A.client.from("pains").insert({ pain_date: "2026-11-20", part: "knee", intensity: "mild" });
  check("건강정보 동의 전에는 통증을 저장할 수 없다", Boolean(r.error), r.error?.message);
  r = await A.client.from("checkins").insert({ checkin_date: "2026-11-20", condition: "good", danger_symptoms: [] });
  check("건강정보 동의 전에는 체크인을 저장할 수 없다", Boolean(r.error), r.error?.message);

  // 7) 동의 후 저장 가능, 남에게는 보이지 않음
  r = await A.client
    .from("profiles")
    .upsert({ user_id: A.id, health_consent: true, health_consent_at: new Date().toISOString() })
    .select();
  check("A가 자기 프로필(동의 상태)을 저장한다", !r.error && r.data?.length === 1, r.error?.message);
  r = await A.client.from("pains").insert({ pain_date: "2026-11-20", part: "knee", intensity: "mild" }).select();
  check("동의한 뒤에는 통증을 저장할 수 있다", !r.error && r.data?.length === 1, r.error?.message);
  r = await A.client
    .from("checkins")
    .insert({ checkin_date: "2026-11-20", condition: "bad", danger_symptoms: ["chest_pain"] })
    .select();
  check("동의한 뒤에는 위험 증상 체크인을 저장할 수 있다", !r.error && r.data?.length === 1, r.error?.message);
  r = await B.client.from("pains").select("*");
  check("B는 A의 통증 기록이 보이지 않는다", !r.error && r.data.length === 0);
  r = await B.client.from("checkins").select("*");
  check("B는 A의 체크인이 보이지 않는다", !r.error && r.data.length === 0);
  r = await B.client.from("profiles").select("*");
  // 가입하면 B에게도 자기 프로필이 생기므로, 보이는 것은 B 자신의 프로필 1건뿐이어야 한다.
  check(
    "B는 자기 프로필만 보이고 A의 프로필(동의 상태)은 보이지 않는다",
    !r.error && r.data.length === 1 && r.data[0].user_id === B.id,
  );

  // 8) A가 동의했어도 동의하지 않은 B는 저장할 수 없음
  r = await B.client.from("pains").insert({ pain_date: "2026-11-20", part: "ankle", intensity: "severe" });
  check("동의하지 않은 B는 A가 동의했어도 통증을 저장할 수 없다", Boolean(r.error), r.error?.message);

  // 9) 고정 목록·범위 밖의 값 거부
  r = await A.client.from("pains").insert({ pain_date: "2026-11-21", part: "chest", intensity: "mild" });
  check("목록에 없는 통증 부위는 저장되지 않는다", Boolean(r.error), r.error?.message);
  r = await A.client.from("checkins").insert({ checkin_date: "2026-11-21", condition: "good", danger_symptoms: ["headache"] });
  check("목록에 없는 위험 증상은 저장되지 않는다", Boolean(r.error), r.error?.message);
  r = await A.client.from("runs").insert({ run_date: "2026-11-21", distance_km: 150, duration_minutes: 600 });
  check("100km를 넘는 거리는 저장되지 않는다", Boolean(r.error), r.error?.message);

  // 10) 계획과 하루치 계획: 남의 계획에 붙일 수 없음
  r = await A.client.from("plans").insert({ start_date: "2026-11-23", source: "default" }).select();
  check("A가 계획을 저장한다", !r.error && r.data?.length === 1, r.error?.message);
  const planId = r.data?.[0]?.id;
  r = await A.client.from("plan_days").insert({ plan_id: planId, day_date: "2026-11-23", kind: "easy", distance_km: 3 }).select();
  check("A가 자기 계획에 하루치 계획을 넣는다", !r.error && r.data?.length === 1, r.error?.message);
  r = await B.client.from("plan_days").insert({ plan_id: planId, day_date: "2026-11-24", kind: "rest", distance_km: 0 });
  check("B가 A의 계획에 하루치 계획을 붙이려 하면 거부된다", Boolean(r.error), r.error?.message);
  r = await B.client.from("plans").select("*");
  check("B는 A의 계획이 보이지 않는다", !r.error && r.data.length === 0);

  // 10-2) 만족도 설문: 본인 응답만 보이고, 사용자당 한 건이며, 로그인하지 않은 사용자는 접근할 수 없다
  r = await A.client.from("survey_responses").insert({ fits: true }).select();
  check("A가 설문에 응답한다", !r.error && r.data?.length === 1, r.error?.message);
  r = await A.client.from("survey_responses").insert({ fits: false });
  check("같은 사용자가 설문에 두 번 응답하면 거부된다(사용자당 한 건)", Boolean(r.error), r.error?.message);
  r = await B.client.from("survey_responses").select("*");
  check("B는 A의 설문 응답이 보이지 않는다", !r.error && r.data.length === 0);
  r = await B.client.from("survey_responses").insert({ user_id: A.id, fits: false });
  check("B가 A의 이름으로 설문을 넣으려 하면 거부된다", Boolean(r.error), r.error?.message);
  r = await anon.from("survey_responses").select("*");
  check("로그인하지 않은 사용자는 설문 표에 접근할 수 없다", Boolean(r.error) || (r.data ?? []).length === 0, r.error?.message);

  // 11) 탈퇴(계정 삭제) 시 모든 기록이 함께 삭제
  const deleted = await admin.auth.admin.deleteUser(A.id);
  check("A 계정을 삭제한다", !deleted.error, deleted.error?.message);
  created.splice(created.indexOf(A.id), 1);
  let left = 0;
  for (const table of ["runs", "pains", "checkins", "plans", "plan_days", "profiles", "races", "survey_responses"]) {
    const counted = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", A.id);
    left += counted.count ?? 0;
  }
  check("계정을 삭제하면 A의 모든 기록이 함께 사라진다 (남은 행 0)", left === 0, `남은 행 ${left}`);
} catch (error) {
  console.log(`FAIL  시험 중 예외: ${error.message}`);
  results.push(false);
} finally {
  // 시험용 계정은 성공·실패와 상관없이 항상 삭제한다.
  for (const id of created) await admin.auth.admin.deleteUser(id);
  const users = await admin.auth.admin.listUsers();
  const leftover = (users.data?.users ?? []).filter((user) => (user.email ?? "").startsWith("rls-test-")).length;
  console.log(`정리: 시험 계정 남은 수 ${leftover}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n결과: ${passed}/${results.length} 통과`);
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
