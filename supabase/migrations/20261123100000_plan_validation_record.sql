-- AI 계획 검증 결과 기록 (PLAN 16번). 건강정보는 담지 않는다.
-- ai_attempts: AI에 요청한 횟수(0~3). violation_codes: 규칙 검증에서 걸린 항목의 코드 이름만 (예: distance_spike).
alter table public.plans
  add column ai_attempts smallint not null default 0 check (ai_attempts between 0 and 3),
  add column violation_codes text[] not null default '{}';
