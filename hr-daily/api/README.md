# HR Daily API

Hono + TypeScript 백엔드. Vercel Functions 하나(`api/index.ts`)로 모든 경로를 받고, Vercel Cron 이 수집→요약→메일을 돌린다.
계약은 [`../SPEC.md`](../SPEC.md), 스키마는 [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).

```
api/index.ts          Vercel 진입점 (hono/vercel)
src/app.ts            Hono 앱: CORS, /v1/*, /cron/*, GET /
src/lib/              supabase(service role) · auth(viewer) · settings · kst · feed 파서 · score · summarizer(Claude) · email(Resend)
src/jobs/             collect · summarize · digest · run(job_runs 기록)
src/routes/           feed · articles · library · me · vocab · stats · admin · cron
scripts/dev.ts        로컬 서버 (8787)
scripts/probe.ts      피드 파서 점검 (DB 불필요)
scripts/import-legacy.ts  1세대 데이터 이관
```

## 준비

1. Supabase 프로젝트에 `../supabase/migrations/0001_init.sql` 을 적용한다 (SQL Editor 또는 `supabase db push`).
2. `cp .env.example .env` 후 값을 채운다. 변수 설명은 `.env.example` 참고.

| 변수 | 필수 | 용도 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 예 | DB·Auth 검증 |
| `GEMINI_API_KEY` | summarize 에 필요 | Gemini 요약 (Google AI Studio 에서 발급) |
| `GEMINI_MODEL` | 아니오 | 기본 `gemini-3.8-flash` (무료 등급 가능). 품질 우선이면 `gemini-4-argon` |
| `RESEND_API_KEY`, `EMAIL_FROM` | 아니오 | 없으면 메일은 `skipped` 로 기록 |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` | 아니오 | 카카오톡 "나에게 보내기" 채널. REST API 키(=OAuth client_id)와 카카오 로그인 클라이언트 시크릿(콘솔 → 플랫폼 키 → 대표 REST 키 수정). 없으면 카카오톡은 `skipped` 로 기록 |
| `CRON_SECRET` | 예 | `/cron/*` 보호. Vercel 이 자동으로 `Authorization: Bearer` 로 보냄 |
| `ADMIN_EMAILS` | 예 | 쉼표 구분. 자동 admin 승격 |
| `WEB_URL` | 예 | CORS 허용 오리진 + 메일 링크 |

## 로컬 실행

```bash
npm install
npm run typecheck        # tsc --noEmit
npm run probe            # 피드 파서가 실제 피드를 잘 읽는지 (DB 없이)
npm run dev              # http://localhost:8787

curl localhost:8787/v1/feed
curl -H "Authorization: Bearer $CRON_SECRET" localhost:8787/cron/collect
curl -H "Authorization: Bearer <supabase access_token>" -X POST localhost:8787/v1/admin/jobs/summarize \
     -H 'content-type: application/json' -d '{"featured_date":"2026-10-25"}'
```

## 1세대 데이터 이관

```bash
npm run import:legacy    # ../../english-tutoring 기준. 다른 위치면 LEGACY_DIR=/path npm run import:legacy
```

articles 6편(featured_date = 발행일, 겹치면 하루씩 앞으로), index_items 1,368건, inbox pending 33건(원문 포함)을 upsert 한다. 여러 번 실행해도 된다.

## Vercel 배포

```bash
npm i -g vercel
vercel link                         # 이 폴더(api)를 프로젝트 루트로
for v in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY GEMINI_API_KEY CRON_SECRET ADMIN_EMAILS WEB_URL RESEND_API_KEY EMAIL_FROM KAKAO_REST_API_KEY KAKAO_CLIENT_SECRET; do
  vercel env add $v production
done
vercel --prod
```

- `vercel.json` 이 크론 3개(UTC 20:30 / 21:00 / 22:00 = KST 05:30 / 06:00 / 07:00)와 `maxDuration: 300` 을 선언한다. 300초는 Pro 플랜(또는 Fluid compute) 기준이며, Hobby 라면 60 으로 낮춘다 — 요약 한 편은 보통 1~3분.
- Vercel Cron 은 `CRON_SECRET` 환경변수가 있으면 자동으로 `Authorization: Bearer <CRON_SECRET>` 를 붙인다.
- 배포 후 확인: `curl https://<project>.vercel.app/` → `{ ok: true }`.

## 잡 수동 실행

관리자 토큰으로 `POST /v1/admin/jobs/{collect|summarize|digest}` (summarize 는 `{ inbox_id?, featured_date? }`). 결과 `run.log` 에 실행 로그가 들어 있고, `GET /v1/admin/runs` 로 지난 실행을 본다.

## Vercel 배포 메모

- 프레임워크 프리셋은 **Other** 로 둔다. Hono 프리셋은 TS 를 확장자 없는 ESM 으로 올려 런타임에 모듈을 못 찾는다.
- `build` 스크립트를 두지 않는다. 두면 Vercel 이 정적 사이트로 간주해 `public/` 출력 폴더를 요구한다. 함수는 `api/index.ts` 하나이고 `vercel.json` 의 rewrite 로 모든 경로를 받는다.
- 진입점은 `getRequestListener(app.fetch)`(@hono/node-server) 를 쓴다. `hono/vercel` 은 Web Request 전용이라 Vercel Node 런타임의 (req, res) 에서는 `headers.get is not a function` 으로 응답 없이 타임아웃된다.
- 상대 import 는 반드시 `.js` 확장자를 붙인다. Vercel 은 TS 를 파일 단위 ESM 으로 올리므로 확장자가 없으면 런타임에 `ERR_MODULE_NOT_FOUND`.
- 운영 주소: https://hr-daily-api.vercel.app (프로젝트 `hr-daily-api`, 팀 ian19-49ed). 웹: https://hr-daily-web-ian19-49ed.vercel.app
