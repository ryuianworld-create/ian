# HR Daily — web

「HR 아티클 한 편」 2세대의 프론트엔드. Next.js 15(App Router, TypeScript) + Tailwind v4.
데이터는 전부 `api/`(Hono) 를 호출하고, Supabase 는 **Auth 전용**(이메일+비밀번호) 이다.
계약은 [`../SPEC.md`](../SPEC.md).

## 실행

```bash
# Node 24, npm
npm install
cp .env.example .env.local   # 값을 채운다 (아래 참고)
npm run dev                  # http://localhost:3000
```

- `npm run build` / `npm run start` — 프로덕션 빌드·실행
- `npm run lint` — ESLint

### 모의(mock) 모드

`NEXT_PUBLIC_API_URL` 이 비어 있으면 `src/lib/api.ts` 가 백엔드 대신 내장 픽스처(`src/fixtures/`, 실제 아티클 2편, anon viewer, free_limit 5)를 돌려준다.
백엔드 없이 화면을 확인할 때 쓴다. 이때 `/login`·`/signup`·`/account`·`/admin` 은 "설정되지 않음" 안내로 바뀐다.

```bash
npm run dev          # .env.local 이 없으면 그대로 모의 모드
```

## 환경변수

| 이름 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (Auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(public) 키 (Auth) |
| `NEXT_PUBLIC_API_URL` | api 베이스 URL, 예 `https://hr-daily-api.vercel.app`. 비우면 모의 모드 |
| `NEXT_PUBLIC_SITE_URL` | 이 사이트의 공개 URL. 가입 확인 메일의 리다이렉트와 metadata 에 쓴다 |

비밀키(service role 등)는 프론트에 넣지 않는다.

## 구조

```
src/
  app/
    layout.tsx            <html lang="ko">, 폰트(next/font), PWA 메타, 헤더·탭바
    page.tsx              /          오늘의 아티클 + 지난 아티클(잠금·가입 CTA·viewer 배너)
    a/[id]/page.tsx       /a/:id     아티클 상세. 403 이면 미리보기 + 가입/승인 안내
    vocab/page.tsx        /vocab     단어장 (?article=, ?w=)
    library/page.tsx      /library   서재 (검색 q, 무한 스크롤 cursor)
    login/ signup/        Supabase 이메일+비밀번호
    pending/              승인 대기 안내
    account/              이름·메일 수신 여부·로그아웃
    admin/                관리자 (admin 이 아니면 / 로)
    globals.css           1세대 CSS 를 그대로 옮긴 전역 스타일 + 2세대 추가분
  components/
    AuthProvider.tsx      Supabase 세션 → token/email 컨텍스트
    TopBar.tsx TabBar.tsx 헤더(DAY N · 요약 편수 · 단어 수), 하단 탭(오늘·단어장·서재·내 정보)
    PaperCard.tsx         아티클 카드 (한글⇄ENG 토글, 핵심 수치, 상세 보기, 단어 N개)
    ArticleView.tsx       상세 섹션 + 읽어주기 + 단어 툴팁
    useReadAloud.tsx      Web Speech API. 문장 단위, ko-KR/en-US, 속도·음성 선택, 하이라이트
    WordPopup.tsx         본문 점선 단어 → 뜻·발음·단어장 이동 툴팁
    VocabView.tsx         단어장. 로그인 시 api 저장, 아니면 localStorage(hrp.known)
    LibraryView.tsx       서재
    AuthForm.tsx AccountView.tsx AdminView.tsx
  lib/
    api.ts                SPEC 의 모든 엔드포인트. Bearer 토큰은 호출자가 넘긴다. 모의 모드 분기
    types.ts              SPEC 의 타입
    mock.ts               픽스처 기반 모의 응답
    supabase/{client,server,middleware,env}.ts   @supabase/ssr 패턴
    tts.ts storage.ts format.ts errors.ts
  middleware.ts           세션 갱신 + /account, /admin 비로그인 접근 시 /login 으로
public/
  icon-180.png icon-512.png manifest.webmanifest
```

토큰 흐름: 서버 컴포넌트는 `getServerToken()`(쿠키) 으로, 클라이언트 컴포넌트는 `useAuth().token` 으로 access_token 을 얻어 `api.*` 에 넘긴다. 검증은 api 가 한다.

### 백엔드에 기대는 점(확인 필요)

- `GET /v1/vocab/progress` 를 `article_id` **없이** 부르면 전체 외운 단어를 돌려준다고 가정하고 "누적" 숫자에 쓴다. 지원하지 않으면 현재 아티클 기준으로 폴백한다.
- `JobRun.log` 는 문자열 또는 문자열 배열로 가정(둘 다 표시). inbox 행의 컬럼은 `id,url,title,kind,status,score,published,source_name,error` 만 쓴다.
- 403 응답에는 `viewer` 가 없으므로 `error.code` 로 안내 문구를 고른다.

## Vercel 배포

1. Vercel 에서 이 저장소를 Import, **Root Directory** 를 `hr-daily/web` 으로 지정.
2. Framework Preset: Next.js (자동 감지). Node.js 24.
3. Environment Variables 에 위 4개를 등록 (`NEXT_PUBLIC_SITE_URL` 은 배포 도메인).
4. api 쪽 `WEB_URL` 을 이 도메인으로 맞춰 CORS 를 연다.
5. Supabase Auth → URL Configuration 의 Site URL / Redirect URLs 에 `https://<도메인>/pending` 을 추가한다 (이메일 확인을 켠 경우).
