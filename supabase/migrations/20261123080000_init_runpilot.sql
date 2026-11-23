-- RunPilot 초기 표와 "본인 기록만 보기" 접근 규칙
-- Design Ref: §6.1 저장하는 표, §9 보안과 개인정보 (PRD 7번)
--
-- 원칙
--   1) 모든 표에 행 단위 보안(RLS)을 켜고, 로그인한 사용자는 "자기 사용자 ID의 행"만 읽고 쓴다.
--   2) 로그인하지 않은 사용자(anon)는 이 표들에 접근할 수 없다.
--   3) 건강정보(checkins, pains)는 "건강정보 수집·이용에 동의한 사용자"만 저장할 수 있다.
--   4) 계정이 삭제되면(auth.users 행 삭제) 그 사용자의 모든 행이 함께 지워진다. (탈퇴 시 삭제)
--   5) 이름·연락처·주소·생년월일, 글로 쓴 증상 원문은 저장하는 칸이 아예 없다.

-- ───────────────────────── 도우미 ─────────────────────────

-- 수정할 때 updated_at을 자동으로 갱신한다.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────── 표 ─────────────────────────

-- 프로필 + 건강정보 동의 상태 (사용자당 1행)
-- 동의 화면(작업 8)이 시작 설정(작업 9)보다 먼저라서, 프로필 칸은 처음에는 비어 있을 수 있다.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  age_band text check (age_band in ('19-29', '30-39', '40-49', '50-59', '60+')),
  experience text check (experience in ('beginner', 'intermediate', 'advanced')),
  longest_run_km numeric(6, 2) check (longest_run_km >= 0 and longest_run_km <= 100),
  goal text check (goal in ('fitness', 'record', 'pace')),
  adult_confirmed_at timestamptz,
  health_consent boolean not null default false,
  health_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 건강정보 동의 여부를 정책에서 확인하는 함수 (본인 프로필만 읽는다)
create function public.has_health_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.health_consent from public.profiles p where p.user_id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.has_health_consent() from public, anon;
grant execute on function public.has_health_consent() to authenticated;

-- 대회 (고러닝에서 고르거나 직접 입력)
create table public.races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  race_date date not null,
  location text check (location is null or char_length(location) <= 200),
  distance_label text check (distance_label is null or char_length(distance_label) <= 100),
  -- 접수 기간. 모르면 비워 두고 화면에는 "신청 마감일 미확인"이라고 보여준다.
  registration_start date,
  registration_end date,
  official_url text check (official_url is null or char_length(official_url) <= 500),
  source text not null check (source in ('gorunning', 'manual')),
  created_at timestamptz not null default now()
);

-- 러닝 기록 (거리·시간)
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  run_date date not null,
  distance_km numeric(6, 2) not null check (distance_km > 0 and distance_km <= 100),
  duration_minutes numeric(7, 2) not null check (duration_minutes >= 1 and duration_minutes <= 1440),
  created_at timestamptz not null default now()
);

-- 훈련 전 체크인 — 건강정보 (동의자만 저장)
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  checkin_date date not null,
  condition text not null check (condition in ('good', 'normal', 'bad')),
  -- 위험 증상은 고정 목록의 항목만 저장한다. 글로 쓴 증상은 저장하지 않는다.
  danger_symptoms text[] not null default '{}'
    check (danger_symptoms <@ array['chest_pain', 'severe_shortness_of_breath', 'fainting_or_severe_dizziness']::text[]),
  created_at timestamptz not null default now()
);

-- 통증 입력 — 건강정보 (동의자만 저장, 부위와 강도는 고정 목록만)
create table public.pains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  pain_date date not null,
  part text not null check (part in ('knee', 'ankle', 'calf', 'thigh', 'sole', 'lower_back')),
  intensity text not null check (intensity in ('mild', 'moderate', 'severe')),
  created_at timestamptz not null default now()
);

-- 훈련계획 (4주 단위)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  start_date date not null,
  weeks smallint not null default 4 check (weeks between 1 and 8),
  source text not null check (source in ('ai', 'default')),
  -- 기본 계획으로 바꾼 이유 (건강정보가 아니다)
  fallback_reason text check (fallback_reason is null or fallback_reason in ('ai_failed', 'validation_failed', 'timeout')),
  created_at timestamptz not null default now()
);

-- 하루치 계획. 컨디션·증상 때문에 바뀐 경우에도 "변경 사유"는 저장하지 않는다. (건강정보 최소화)
create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  day_date date not null,
  kind text not null check (kind in ('rest', 'easy', 'pace', 'long')),
  distance_km numeric(6, 2) not null default 0 check (distance_km >= 0 and distance_km <= 100),
  unique (plan_id, day_date)
);

-- 자주 쓰는 조회를 빠르게 한다.
create index races_user_date_idx on public.races (user_id, race_date);
create index runs_user_date_idx on public.runs (user_id, run_date desc);
create index checkins_user_date_idx on public.checkins (user_id, checkin_date desc);
create index pains_user_date_idx on public.pains (user_id, pain_date desc, part);
create index plans_user_created_idx on public.plans (user_id, created_at desc);
create index plan_days_plan_idx on public.plan_days (plan_id);

-- ───────────────────────── 접근 규칙 (RLS) ─────────────────────────

-- 로그인하지 않은 사용자(anon)에게는 이 표들의 권한 자체를 주지 않는다. (이중 방어)
revoke all on public.profiles, public.races, public.runs, public.checkins, public.pains,
  public.plans, public.plan_days from anon;

alter table public.profiles enable row level security;
alter table public.races enable row level security;
alter table public.runs enable row level security;
alter table public.checkins enable row level security;
alter table public.pains enable row level security;
alter table public.plans enable row level security;
alter table public.plan_days enable row level security;

-- 건강정보가 아닌 표: 본인 행만 읽고, 만들고, 고치고, 지운다.
create policy "profiles: 본인 행만" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "races: 본인 행만" on public.races
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "runs: 본인 행만" on public.runs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "plans: 본인 행만" on public.plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 하루치 계획: 본인 행이면서, 연결한 계획도 본인 것이어야 한다.
create policy "plan_days: 본인 행만" on public.plan_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

-- 건강정보 표(checkins, pains): 읽기·고치기·지우기는 본인 행만,
-- 새로 저장하는 것은 "건강정보 동의"를 한 사용자만 할 수 있다.
create policy "checkins: 본인 행만 보기" on public.checkins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "checkins: 동의한 본인만 저장" on public.checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_health_consent());

create policy "checkins: 본인 행만 고치기" on public.checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "checkins: 본인 행만 지우기" on public.checkins
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "pains: 본인 행만 보기" on public.pains
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "pains: 동의한 본인만 저장" on public.pains
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_health_consent());

create policy "pains: 본인 행만 고치기" on public.pains
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pains: 본인 행만 지우기" on public.pains
  for delete to authenticated
  using (user_id = (select auth.uid()));
