# HR Daily — 설계 명세 (프론트·백엔드 공통 계약)

「HR 아티클 한 편」의 2세대. 매일 HR 아티클·논문 한 편을 한글·영문 요약 + 단어장으로 배달하는 서비스.
기존 정적 사이트(`../english-tutoring/docs/index.html`)의 룩앤필과 데이터 형식을 계승하되,
백엔드(API)와 프론트(Web)를 분리하고 Supabase(Postgres + Auth)를 저장소로 쓴다.

```
hr-daily/
  supabase/migrations/   스키마 (0001_init.sql 이 단일 진실)
  api/                   백엔드. Hono + TypeScript, Vercel Functions, Vercel Cron
  web/                   프론트. Next.js 15 App Router + Tailwind, Vercel
  scripts/               운영 스크립트
```

## 역할 분담

| 구성요소 | 책임 |
|---|---|
| Supabase | Postgres(스키마는 migrations), Auth(이메일+비밀번호). RLS 로 프론트의 직접 접근은 자기 프로필·단어 진도만 허용 |
| api | 모든 읽기·쓰기 비즈니스 로직. service role 키 보유. 크론(수집→요약→메일). 관리자 승인. 이메일 발송 |
| web | 화면. supabase-js 는 **Auth 전용**(가입·로그인·세션). 데이터는 전부 api 를 호출. 요청마다 `Authorization: Bearer <access_token>` |

## 접근 등급 (viewer)

api 가 요청마다 계산한다.

| viewer | 조건 | 볼 수 있는 것 |
|---|---|---|
| `anon` | 토큰 없음 | 최신 `free_article_limit`(기본 5)편 전체 + 나머지는 제목만(locked). 6편째부터 가입 안내 |
| `pending` | 가입했지만 미승인 | anon 과 동일 + "승인 대기 중" 안내. 단어 진도는 저장됨 |
| `rejected` | 거절 | anon 과 동일 + 안내 |
| `approved` | 승인 | 전체 아티클, 서재, 매일 아침 메일 |
| `admin` | `ADMIN_EMAILS` 에 포함된 이메일 또는 profiles.role='admin' | approved + 관리자 화면 |

관리자 이메일은 DB `settings.admin_emails`(JSON 배열, 기본 `["rchworld@gmail.com"]`)에 둔다. 가입 트리거가 그 이메일을 `role='admin', status='approved'` 로 만든다. api 의 `ADMIN_EMAILS` 환경변수는 선택 사항(같은 역할의 보조 경로).

## 데이터 형식 (기존 articles.json 과 호환)

```ts
type Lang = { ko: string; en: string };
type Finding = { k: string; ko: string; en: string };           // k: "64%", "$1.6M" 같은 핵심 수치
type DetailSection = { h: Lang; body: Lang };                   // body 는 HTML. 단어는 <span class="vw" data-w="operating model">operating model</span>
type VocabEntry = { w: string; pos: string; ko: string; en: string; ex: string };  // ex 는 HTML(<b>word</b>)

type Article = {
  id: string; source_id: string; source_name: string; kind: 'article' | 'paper';
  title: string; url: string; published: string | null; category: string | null;
  featured_date: string;                 // YYYY-MM-DD (KST). 하루 한 편, 유일
  summary: Lang; findings: Finding[]; detail: DetailSection[]; vocab: VocabEntry[];
};

type ArticleCard = Pick<Article, 'id'|'source_name'|'kind'|'title'|'url'|'published'|'category'|'featured_date'> & {
  summary?: Lang; findings?: Finding[]; vocab_count: number; locked: boolean;   // locked=true 면 summary/findings 없음
};

type Viewer = { kind: 'anon'|'pending'|'rejected'|'approved'|'admin'; email?: string; display_name?: string };

type Profile = { id: string; email: string; display_name: string|null; status: 'pending'|'approved'|'rejected';
                 role: 'user'|'admin'; email_opt_in: boolean; created_at: string; approved_at: string|null; note: string|null };

type IndexItem = { url: string; source_name: string; kind: 'article'|'paper'; title: string; published: string|null; article_id: string|null };
```

## API 계약 (base: `NEXT_PUBLIC_API_URL`, 예 `https://hr-daily-api.vercel.app`)

공통: JSON. 오류는 `{ error: { code: string, message: string } }` 와 HTTP 상태. CORS 는 `WEB_URL` 오리진 허용(+ localhost:3000).
인증: `Authorization: Bearer <supabase access_token>` (선택). api 는 `supabase.auth.getUser(token)` 으로 검증.

### 공개·회원
| Method | Path | 설명 | 응답 |
|---|---|---|---|
| GET | `/v1/feed` | 아티클 목록(최신순). viewer 에 따라 locked 처리 | `{ today: ArticleCard\|null, items: ArticleCard[], free_limit: number, viewer: Viewer, total: number }` — `today` 는 items[0] |
| GET | `/v1/articles/:id` | 아티클 전체 | `{ article: Article, viewer }`. 권한 없으면 403 `code: 'signup_required' \| 'approval_pending' \| 'rejected'` + `{ preview: ArticleCard }` |
| GET | `/v1/library?cursor=&limit=50&q=` | 서재(전체 글 목록, 요약 여부 포함). 누구나 | `{ items: IndexItem[], next_cursor: string\|null, summarized_count: number, total: number }` |
| GET | `/v1/me` | 내 프로필 | `{ profile: Profile, viewer }` / 401 |
| PATCH | `/v1/me` | `{ display_name?, email_opt_in? }` | `{ profile }` |
| GET | `/v1/vocab/progress?article_id=` | 외운 단어 | `{ learned: string[] }` (로그인 필요, 승인 불문) |
| PUT | `/v1/vocab/progress` | `{ article_id, word, learned }` | `{ ok: true }` |
| GET | `/v1/stats` | 공개 통계 | `{ articles: number, vocab: number, index: number, latest_date: string\|null }` |

### 관리자 (viewer.kind === 'admin')
| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/admin/overview` | `{ users: {pending,approved,rejected,total}, articles, inbox_pending, last_runs: {collect,summarize,digest}: {started_at,finished_at,ok}\|null, next_featured_date }` |
| GET | `/v1/admin/users?status=pending` | `{ users: Profile[] }` (status 생략 시 전체, 최신 가입순) |
| POST | `/v1/admin/users/:id/approve` | 승인 + 승인 안내 메일(Resend). `{ profile }` |
| POST | `/v1/admin/users/:id/reject` | body `{ note? }`. `{ profile }` |
| GET | `/v1/admin/inbox?status=pending&limit=50` | `{ items: (inbox row without raw_text)[] }` |
| POST | `/v1/admin/jobs/:job` | `job ∈ collect \| summarize \| digest`. 즉시 실행. `{ run: JobRun }` (log 포함). summarize 는 body `{ inbox_id?: string, featured_date?: 'YYYY-MM-DD' }` 로 특정 글·날짜 지정 가능 |
| GET | `/v1/admin/runs?job=&limit=20` | `{ runs: JobRun[] }` |

### 크론 (Vercel Cron → `Authorization: Bearer ${CRON_SECRET}`)
| Path | 스케줄(UTC) | 역할 |
|---|---|---|
| GET `/cron/collect` | `30 20 * * *` (KST 05:30) | 소스 피드 수집 → index_items, inbox(raw_text 포함) |
| GET `/cron/summarize` | `0 21 * * *` (KST 06:00) | 오늘(KST) featured_date 가 비어 있으면 inbox 에서 한 편 골라 Gemini 로 요약 → articles. raw_text null 처리 |
| GET `/cron/digest` | `0 22 * * *` (KST 07:00) | 오늘 아티클을 approved & email_opt_in 회원에게 메일. 같은 (user, article) 는 한 번만 |

크론 핸들러와 관리자 `/v1/admin/jobs/:job` 은 같은 job 함수를 호출한다. 각 실행은 `job_runs` 에 기록.

## 잡 상세

**collect** — `sources` 중 enabled 를 순회. RSS/Atom 파싱(기존 `../english-tutoring/scripts/collect.mjs` 의 파서 로직 이식). 요청 간 2초. 각 아이템:
- `index_items` upsert(url 기준).
- 이미 `inbox` 나 `articles` 에 있는 url 은 건너뜀.
- kind=article: `content:encoded` 본문 → 텍스트. 1,200자 미만이면 글 페이지 `<article>`/`<main>` 보충. 800자 미만·로그인 필요 글은 skipped.
- kind=paper: 피드 `description`(초록) 을 raw_text 로. 400자 미만이면 skip. 제목에 "Issue Information", "Erratum", "Correction", "Editorial Board" 포함 시 skip.
- sources.keywords 가 비어 있지 않으면 제목에 키워드 하나 이상 포함해야 수집.
- score 계산: `weight*10 + recency(≤7일:5, ≤30일:3, 그 외 0) + 제목 키워드 보너스(ai, strategy, strategic, evidence, meta-analysis, workforce, skills, retention, performance, future, operating model, analytics, burnout, remote, hybrid → 각 +1, 최대 +3) + (chars>8000 ? 1 : 0)`.
- 소스당 한 번 실행에 최대 10건 신규.

**summarize** — 대상 날짜 = KST 오늘(또는 body 의 featured_date). 그 날짜의 article 이 이미 있으면 skip.
- 후보 선정: `inbox.status='pending' and raw_text is not null`. `settings.paper_weekdays` 에 오늘 요일(KST, 0=일)이 포함되고 pending 논문이 있으면 논문 중 score 최상위, 아니면 전체 score 최상위.
- Google Gen AI SDK(`@google/genai`) `ai.interactions.create` 에 `response_format`(JSON Schema) 을 넘겨 아래 스키마를 받는다. 모델 `GEMINI_MODEL`(기본 `gemini-3.8-flash`), `generation_config: { max_output_tokens: 32000, thinking_level: 'high' }`, `store: false`. `status !== 'completed'` 이거나 빈 응답이면 실패 처리하고, 결과는 zod 로 재검증한다.
- 출력 스키마: `{ category, summary:{ko,en}, findings:[{k:{ko,en},ko,en}] (2~4개; k 는 "64%" 같은 수치면 ko=en, 글자 라벨이면 언어별), detail:[{h:{ko,en}, body:{ko,en}}] (4~6개 섹션, body 는 HTML <ul><li><b><i><br> 만), vocab:[{w,pos,ko,en,ex}] (8~12개) }`.
- 프롬프트 요구사항: 한글 요약 500~800자, 영문 180~280단어. 본문에 나온 HR 전문 용어를 vocab 으로 뽑고, detail.body 안에서 그 단어가 나오는 자리를 `<span class="vw" data-w="{w}">…</span>` 로 감쌀 것(ko·en 모두). 마지막 섹션에 "HR 시사점/Takeaway for HR" 포함. 논문이면 연구 질문·방법·표본·핵심 결과·실무 시사점 구조. 원문 문장을 그대로 베끼지 말 것(요약·재서술). 기존 예시는 `../english-tutoring/docs/data/articles.json` 첫 항목 — 톤·분량·형식의 기준.
- 후처리 검증: 모든 `data-w` 가 vocab.w 에 있어야 한다(없으면 span 을 벗긴다). vocab 8개 미만이면 실패→ status='failed', error 기록, 다음 후보로 1회 재시도.
- 성공: `articles` insert(featured_date, model, tokens), inbox `status='done', raw_text=null, processed_at`.

**digest** — 대상 = 오늘(KST) featured_date 의 article(없으면 최신). 수신자 = `profiles.status='approved' and email_opt_in`. `email_log`(kind='digest', status='sent') 에 없는 사람만. Resend(`resend` npm) 로 발송. 제목: `[HR Daily] {title}`. 본문(HTML): 출처·날짜, 한글 요약, 핵심 수치, 단어 목록(단어 + 한글 뜻), "앱에서 읽기" 버튼(`${WEB_URL}/a/${id}`), 수신 거부 안내(`${WEB_URL}/account`). 결과를 email_log 에 기록. `RESEND_API_KEY` 가 없으면 전부 `skipped` 로 기록하고 실패로 치지 않는다.

**approve 메일** — 승인 시 1통: "승인되었습니다. 매일 아침 7시에 그날의 아티클을 보내드립니다" + 앱 링크.

## 환경변수

api: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`(opt, 기본 gemini-3.8-flash), `RESEND_API_KEY`(opt), `EMAIL_FROM`(예 `HR Daily <daily@yourdomain>`), `CRON_SECRET`, `ADMIN_EMAILS`, `WEB_URL`
web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`

## 프론트 화면

모바일 우선, 홈 화면 추가(PWA manifest, 아이콘은 `../english-tutoring/docs/icon-*.png` 복사). 디자인 토큰은 기존 사이트를 계승:
- 종이색 `#F7F6F2`, 표면 `#FFFFFF`/`#EFEDE7`, 잉크 `#17181C`/`#4A4C54`, 보조 `#7C7E86`, 선 `#E0DED6`, 포인트 `#7A2E3E`(소프트 `#F0E2E4`), 슬레이트 `#2F4858`, ok `#3E6B4F`. 다크 모드: `#131418`/`#1B1D23`/`#23262E`, 잉크 `#E9E7E1`, 포인트 `#D08C99`.
- 폰트: 제목 Newsreader(serif), 본문 Noto Sans KR, 숫자/라벨 IBM Plex Mono.

| 경로 | 내용 |
|---|---|
| `/` | 오늘의 아티클 카드(출처·날짜·제목·한글⇄ENG 토글 요약·핵심 수치·"상세 보기"·단어 N개) + 지난 아티클 목록. locked 항목은 자물쇠와 가입 CTA. 상단에 viewer 상태 배너(pending: 승인 대기 중, rejected 안내) |
| `/a/[id]` | 아티클 상세: 요약 토글, 핵심 수치, 섹션별 상세(한글⇄ENG), 본문 점선 단어 탭→툴팁(뜻·발음 🔊·단어장 이동), 읽어주기(Web Speech API, 문장 단위, ko-KR/en-US, 속도), 원문 링크. 403 이면 미리보기 + 가입/승인 안내 |
| `/vocab` | 단어장: 오늘(최신) 아티클의 단어 → 아티클 선택 가능. 카드 펼치면 뜻·영영·예문·🔊. "외웠어요" 토글. 로그인 시 서버 저장(api), 아니면 localStorage |
| `/library` | 서재: 요약 완료 글(링크) + 수집 목록 검색(`q`), 무한 스크롤 |
| `/login`, `/signup` | Supabase 이메일+비밀번호. 가입 후 `/pending` 로 |
| `/pending` | 승인 대기 안내(관리자가 승인하면 메일로 알림) |
| `/account` | 이름·매일 메일 수신 여부·로그아웃 |
| `/admin` | admin 만. 대시보드(회원 수, 대기 인원, 다음 날짜, 최근 잡 실행), 대기 회원 승인/거절 목록, 전체 회원, inbox 보기, "지금 수집/요약/메일" 버튼(결과 로그 표시) |

하단 탭: 오늘 · 단어장 · 서재 · (로그인 시) 내 정보. 상단 헤더에 `DAY N`(= articles 수) 와 요약 편수·단어 수.
