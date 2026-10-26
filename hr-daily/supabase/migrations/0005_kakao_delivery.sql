-- 카카오톡 "나에게 보내기" 수신 채널 (2026-10-27)
-- 1) profiles.kakao_opt_in: 아침 아티클을 카카오톡(나와의 채팅)으로도 받을지
-- 2) kakao_links: 카카오 로그인 토큰 보관 (service role 만 접근). talk_message 동의 여부 포함
-- 3) email_log.channel: email | kakao — 같은 (user, article, kind, channel) 은 한 번만
-- 4) handle_new_user: 가입 폼에서 고른 수신 채널(raw_user_meta_data) 반영

alter table public.profiles add column if not exists kakao_opt_in boolean not null default false;
grant update (display_name, email_opt_in, kakao_opt_in) on public.profiles to authenticated;

create table if not exists public.kakao_links (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  access_token       text,
  access_expires_at  timestamptz,
  refresh_token      text not null,
  refresh_expires_at timestamptz,
  talk_message       boolean not null default false,
  scopes             text,
  linked_at          timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_error         text,
  last_error_at      timestamptz
);
alter table public.kakao_links enable row level security; -- 정책 없음: service role 만 읽고 쓴다
revoke all on public.kakao_links from anon, authenticated;

alter table public.email_log add column if not exists channel text not null default 'email';
alter table public.email_log drop constraint if exists email_log_channel_check;
alter table public.email_log add constraint email_log_channel_check check (channel in ('email', 'kakao'));
drop index if exists public.email_log_once_idx;
create unique index if not exists email_log_once_idx
  on public.email_log (user_id, article_id, kind, channel) where status = 'sent';

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
  v_email_opt boolean := coalesce((new.raw_user_meta_data->>'email_opt_in')::boolean, true);
  v_kakao_opt boolean := coalesce((new.raw_user_meta_data->>'kakao_opt_in')::boolean, false);
begin
  insert into public.profiles (id, email, display_name, email_opt_in, kakao_opt_in)
  values (new.id, v_email, v_name, v_email_opt, v_kakao_opt)
  on conflict (id) do nothing;
  return new;
exception when others then
  -- 메타데이터 값이 이상해도 가입 자체는 막지 않는다
  insert into public.profiles (id, email, display_name) values (new.id, v_email, v_name) on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
