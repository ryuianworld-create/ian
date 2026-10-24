-- HR Daily — 초기 스키마
-- 모든 데이터 접근은 백엔드 API(service role)를 거친다. 프론트는 Auth 에만 supabase-js 를 쓴다.

create extension if not exists pgcrypto;

do $$ begin
  create type user_status as enum ('pending','approved','rejected');
  create type user_role   as enum ('user','admin');
  create type item_kind   as enum ('article','paper');
  create type inbox_status as enum ('pending','done','skipped','failed');
exception when duplicate_object then null; end $$;

-- 수집 소스 --------------------------------------------------------------
create table if not exists public.sources (
  id         text primary key,
  name       text not null,
  kind       item_kind not null default 'article',
  home       text,
  feeds      jsonb not null default '[]'::jsonb,
  weight     numeric not null default 1,
  keywords   jsonb not null default '[]'::jsonb,   -- 제목 필터(비어 있으면 전체)
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

-- 전체 글 목록(서재). URL·제목·날짜만 보관 — 저작물 아님 ------------------
create table if not exists public.index_items (
  url          text primary key,
  source_id    text references public.sources(id) on delete set null,
  source_name  text not null,
  kind         item_kind not null default 'article',
  title        text not null,
  published    date,
  collected_at timestamptz not null default now()
);
create index if not exists index_items_published_idx on public.index_items (published desc nulls last);

-- 요약 대기열. raw_text 는 요약이 끝나면 null 로 지운다(저작권) -----------
create table if not exists public.inbox (
  id           text primary key,
  source_id    text references public.sources(id) on delete set null,
  source_name  text not null,
  kind         item_kind not null default 'article',
  title        text not null,
  url          text not null unique,
  category     text,
  published    date,
  raw_text     text,
  chars        int,
  score        numeric not null default 0,
  status       inbox_status not null default 'pending',
  error        text,
  collected_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists inbox_status_score_idx on public.inbox (status, score desc);

-- 완성된 요약. 하루 한 편 = featured_date 유일 -----------------------------
create table if not exists public.articles (
  id            text primary key,
  source_id     text,
  source_name   text not null,
  kind          item_kind not null default 'article',
  title         text not null,
  url           text not null,
  published     date,
  category      text,
  summary       jsonb not null,                     -- {ko,en}
  findings      jsonb not null default '[]'::jsonb, -- [{k,ko,en}]
  detail        jsonb not null default '[]'::jsonb, -- [{h:{ko,en}, body:{ko,en}}]  body 는 HTML, <span class="vw" data-w="word">
  vocab         jsonb not null default '[]'::jsonb, -- [{w,pos,ko,en,ex}]
  featured_date date not null unique,
  model         text,
  tokens_in     int,
  tokens_out    int,
  created_at    timestamptz not null default now()
);
create index if not exists articles_featured_idx on public.articles (featured_date desc);

-- 회원 ------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  status        user_status not null default 'pending',
  role          user_role not null default 'user',
  email_opt_in  boolean not null default true,
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  approved_by   uuid,
  note          text
);
create index if not exists profiles_status_idx on public.profiles (status, created_at);

create table if not exists public.vocab_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  article_id text not null references public.articles(id) on delete cascade,
  word       text not null,
  learned    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id, word)
);

create table if not exists public.email_log (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  article_id  text references public.articles(id) on delete set null,
  kind        text not null,      -- digest | approved | rejected
  status      text not null,      -- sent | failed | skipped
  provider_id text,
  error       text,
  sent_at     timestamptz not null default now()
);
create unique index if not exists email_log_once_idx
  on public.email_log (user_id, article_id, kind) where status = 'sent';

create table if not exists public.job_runs (
  id          bigserial primary key,
  job         text not null,       -- collect | summarize | digest
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  log         jsonb not null default '[]'::jsonb
);
create index if not exists job_runs_job_idx on public.job_runs (job, started_at desc);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values
  ('free_article_limit', '5'),
  ('paper_weekdays', '[2,5]'),        -- KST 요일(0=일). 화·금은 논문 우선
  ('timezone', '"Asia/Seoul"')
on conflict (key) do nothing;

-- 가입 시 profiles 자동 생성 ------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: 프론트(anon/authenticated)는 자기 프로필·단어 진도만. 나머지는 API(service role) 전용.
alter table public.sources        enable row level security;
alter table public.index_items    enable row level security;
alter table public.inbox          enable row level security;
alter table public.articles       enable row level security;
alter table public.profiles       enable row level security;
alter table public.vocab_progress enable row level security;
alter table public.email_log      enable row level security;
alter table public.job_runs       enable row level security;
alter table public.settings       enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: update own prefs" on public.profiles;
create policy "profiles: update own prefs" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant  update (display_name, email_opt_in) on public.profiles to authenticated;

drop policy if exists "vocab: own rows" on public.vocab_progress;
create policy "vocab: own rows" on public.vocab_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 소스 시드 ---------------------------------------------------------------
insert into public.sources (id, name, kind, home, feeds, weight, keywords) values
  ('aihr', 'AIHR', 'article', 'https://www.aihr.com/',
     '["https://www.aihr.com/feed/"]', 1.0, '[]'),
  ('wiley-hrm', 'Human Resource Management (Wiley)', 'paper', 'https://onlinelibrary.wiley.com/journal/1099050x',
     '["https://onlinelibrary.wiley.com/feed/1099050x/most-recent"]', 1.3, '[]'),
  ('wiley-hrmj', 'Human Resource Management Journal', 'paper', 'https://onlinelibrary.wiley.com/journal/17488583',
     '["https://onlinelibrary.wiley.com/feed/17488583/most-recent"]', 1.3, '[]'),
  ('wiley-job', 'Journal of Organizational Behavior', 'paper', 'https://onlinelibrary.wiley.com/journal/10991379',
     '["https://onlinelibrary.wiley.com/feed/10991379/most-recent"]', 1.1, '[]'),
  ('joshbersin', 'Josh Bersin', 'article', 'https://joshbersin.com/',
     '["https://joshbersin.com/feed/"]', 0.9, '[]'),
  ('mckinsey', 'McKinsey Insights', 'article', 'https://www.mckinsey.com/',
     '["https://www.mckinsey.com/insights/rss"]', 0.8,
     '["talent","workforce","people","hr","human resources","organization","organisation","leadership","skills","employee","culture","hiring","work"]')
on conflict (id) do nothing;
