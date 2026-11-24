-- 만족도 설문 (PLAN 성공 기준: "내 몸에 맞는 것 같다" 응답 비율). 사용자당 한 건, 본인 행만 읽고 고친다. 건강정보가 아니다.
create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  fits boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.survey_responses from anon;
alter table public.survey_responses enable row level security;

create policy "survey_responses: 본인 행만" on public.survey_responses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
