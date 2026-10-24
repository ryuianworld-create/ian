-- 관리자 이메일을 settings 에 두고, 가입 시 자동으로 admin/approved 로 만든다 (Vercel ADMIN_EMAILS 환경변수 대신 DB 에서 처리)
insert into public.settings (key, value) values ('admin_emails', '["rchworld@gmail.com"]')
on conflict (key) do update set value = excluded.value;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_admin boolean;
begin
  select coalesce(bool_or(lower(e) = lower(new.email)), false) into is_admin
  from public.settings s, jsonb_array_elements_text(s.value) as e
  where s.key = 'admin_emails';

  insert into public.profiles (id, email, display_name, status, role, approved_at)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
          case when is_admin then 'approved'::user_status else 'pending'::user_status end,
          case when is_admin then 'admin'::user_role else 'user'::user_role end,
          case when is_admin then now() else null end)
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
