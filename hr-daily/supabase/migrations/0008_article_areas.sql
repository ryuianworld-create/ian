-- HR 분야 분류(area, area2)로 팀(team) 분류를 대체 (2026-11-01). 목록: api/src/lib/areas.ts
alter table public.articles add column if not exists area text
  check (area in ('hiring','comp','performance','learning','leadership','culture','wellbeing','strategy','tech','labor','work','careers'));
alter table public.articles add column if not exists area2 text
  check (area2 in ('hiring','comp','performance','learning','leadership','culture','wellbeing','strategy','tech','labor','work','careers'));
create index if not exists articles_area_idx on public.articles (area);
drop index if exists public.articles_team_idx;
alter table public.articles drop column if exists team;
-- 기존 13편은 내용 기준으로 수동 지정했다. 새 글은 요약 단계에서 Gemini 가 본문을 읽고 정한다.
