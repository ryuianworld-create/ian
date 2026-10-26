-- 카카오 등 OAuth 가입: email 이 비어 있어도 profiles 행을 만들고, 이름은 공급자 메타데이터에서 가져온다.
-- (0003 의 settings.admin_emails 자동 승인은 운영 DB 에 적용하지 않았다. 관리자는 SQL 로 직접 지정한다.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text := coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data->>'email', ''), '');
  v_name  text := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'nickname', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'preferred_username', ''),
    nullif(split_part(v_email, '@', 1), ''),
    '회원'
  );
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, v_email, v_name)
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
