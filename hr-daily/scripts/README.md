# 운영 메모

- 스키마는 `supabase/migrations/*.sql` 순서대로 적용한다. 2026-10-24 에 0001·0002 를 프로젝트 `dvfucocsgwpqafgcgtqw`(ap-northeast-1) 에 적용했다.
- 1세대 데이터(요약 6편, 목록 1,368건, 대기열 33건+원문)는 2026-10-24 에 DB 로 이관 완료. 다시 할 일이 생기면 `api/scripts/import-legacy.ts`(멱등) 를 쓴다.
- Vercel 프로젝트: `hr-daily-api`(root `hr-daily/api`), `hr-daily-web`(root `hr-daily/web`). 둘 다 GitHub `ryuianworld-create/ian` main 자동 배포.
