-- 가입하면 프로필 행을 자동으로 만들고, "만 19세 이상" 확인 시각을 함께 저장한다.
-- Design Ref: §6.1 profiles(만 19세 확인 시각), §7.1 가입과 동의 (PRD 연령: 만 19세 이상만 가입)
--
-- 가입 화면이 signUp을 부를 때 사용자 정보(user_metadata)에 adult_confirmed = true를 담아 보낸다.
-- 그 값이 true이면 가입 시각을 adult_confirmed_at에 저장한다.
-- 가입과 프로필 생성이 같은 순간에 일어나므로, "계정은 있는데 프로필이 없는" 상태가 생기지 않는다.
-- (본인이 체크한 확인란이며, 나이를 실제로 검증하는 방법은 PRD의 공개 전 과제다.)

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, adult_confirmed_at)
  values (
    new.id,
    case when (new.raw_user_meta_data ->> 'adult_confirmed') = 'true' then now() else null end
  );
  return new;
end;
$$;

-- 트리거 전용 함수라서 화면(API)에서 직접 부를 수 없게 한다.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
