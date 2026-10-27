-- 웹 푸시 구독 (홈 화면 앱 알림, 2026-10-28). 기기(endpoint) 단위, service role 만 접근
create table if not exists public.push_subscriptions (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_error    text,
  last_error_at timestamptz,
  disabled_at   timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id) where disabled_at is null;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

alter table public.email_log drop constraint if exists email_log_channel_check;
alter table public.email_log add constraint email_log_channel_check check (channel in ('email', 'kakao', 'push'));
