-- 동의 기록의 무결성 (보안 검토 SEC-001, SEC-008)
-- 1) 동의 → 거부로 바뀌면 저장된 건강정보(checkins, pains)를 DB가 직접 지운다. (화면 코드가 빠뜨려도 남지 않는다)
-- 2) 동의 시각은 서버 시계로만 정하고, 만 19세 확인 시각은 한 번 저장되면 바꿀 수 없다.
-- 3) 건강정보를 고치는 것도 "동의한 본인"만 할 수 있다. (저장은 이미 그렇다)

create function public.guard_profile_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 만 19세 확인 시각은 한 번 저장되면 그대로 둔다.
  if old.adult_confirmed_at is not null then
    new.adult_confirmed_at := old.adult_confirmed_at;
  end if;

  -- 동의 시각: 새로 동의할 때만 지금 시각, 이미 동의 중이면 기존 값 유지, 거부면 비운다.
  if new.health_consent then
    if old.health_consent and old.health_consent_at is not null then
      new.health_consent_at := old.health_consent_at;
    else
      new.health_consent_at := now();
    end if;
  else
    new.health_consent_at := null;
  end if;

  -- 동의를 거두면 저장된 건강정보를 지운다.
  if old.health_consent and not new.health_consent then
    delete from public.checkins where user_id = new.user_id;
    delete from public.pains where user_id = new.user_id;
  end if;

  return new;
end;
$$;

-- 트리거 전용 함수라서 화면(API)에서 직접 부를 수 없게 한다.
revoke all on function public.guard_profile_consent() from public, anon, authenticated;

create trigger profiles_guard_consent
  before update on public.profiles
  for each row execute function public.guard_profile_consent();

-- 건강정보 고치기도 동의한 본인만
drop policy "checkins: 본인 행만 고치기" on public.checkins;
create policy "checkins: 동의한 본인만 고치기" on public.checkins
  for update to authenticated
  using (user_id = (select auth.uid()) and public.has_health_consent())
  with check (user_id = (select auth.uid()) and public.has_health_consent());

drop policy "pains: 본인 행만 고치기" on public.pains;
create policy "pains: 동의한 본인만 고치기" on public.pains
  for update to authenticated
  using (user_id = (select auth.uid()) and public.has_health_consent())
  with check (user_id = (select auth.uid()) and public.has_health_consent());
