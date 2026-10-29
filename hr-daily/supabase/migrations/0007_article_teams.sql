-- HR 팀(고양이 당번) 분류 (2026-10-30): ta=TA팀 냥헌터, ops=HR운영팀 츄르정, strategy=HR전략팀 캣브레인, culture=인재성장문화팀 꾹꾹이
alter table public.articles add column if not exists team text check (team in ('ta','ops','strategy','culture'));
create index if not exists articles_team_idx on public.articles (team);
-- 기존 글은 제목·카테고리 키워드로 백필했다. 새 글은 요약 단계에서 Gemini 가 정한다 (api/src/lib/summarizer.ts).
