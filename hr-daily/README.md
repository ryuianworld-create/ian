# HR Daily — 하루 한 편, HR 아티클·논문

매일 아침 HR 아티클 또는 꼭 읽어야 할 HR 논문 한 편을 한글·영문 요약과 단어장으로 받아보는 서비스.
`../english-tutoring`(정적 1세대)을 백엔드/프론트 분리 구조로 다시 만든 2세대.

- **web/** — Next.js 프론트 (Vercel)
- **api/** — Hono 백엔드 + Vercel Cron (Vercel). 수집 → Claude 요약 → 메일 발송 자동화, 회원 승인
- **supabase/** — Postgres 스키마·RLS (Supabase)

설계 전체는 [SPEC.md](SPEC.md). 각 패키지의 실행법은 각 폴더의 README.

## 운영 흐름

```
05:30 KST  collect    소스 RSS 수집 → inbox (원문은 요약 때까지만 보관)
06:00 KST  summarize  오늘 한 편 선정 → Claude 요약·단어장 → articles
07:00 KST  digest     승인 회원에게 메일
```

비로그인: 최신 5편 열람 → 그 이후 가입 안내. 가입 → 관리자 승인 → 전체 열람 + 매일 메일.
