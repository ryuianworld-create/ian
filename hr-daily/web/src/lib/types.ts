// SPEC.md 「데이터 형식」·「API 계약」에서 복사한 타입. 백엔드와의 단일 계약이다.

export type Lang = { ko: string; en: string };
export type Finding = { k: Lang; ko: string; en: string }; // k: "64%" 같은 수치는 ko=en, 글자 라벨은 언어별
export type DetailSection = { h: Lang; body: Lang }; // body 는 HTML. <span class="vw" data-w="...">
export type VocabEntry = { w: string; pos: string; ko: string; en: string; ex: string }; // ex 는 HTML

export type ArticleKind = "article" | "paper";

import type { Team } from "./teams";
export type { Team };

export type Article = {
  id: string;
  source_id: string;
  source_name: string;
  kind: ArticleKind;
  title: string;
  url: string;
  published: string | null;
  category: string | null;
  team: Team | null;
  featured_date: string; // YYYY-MM-DD (KST)
  summary: Lang;
  findings: Finding[];
  detail: DetailSection[];
  vocab: VocabEntry[];
};

export type ArticleCard = Pick<
  Article,
  "id" | "source_name" | "kind" | "title" | "url" | "published" | "category" | "team" | "featured_date"
> & {
  summary?: Lang;
  findings?: Finding[];
  vocab_count: number;
  locked: boolean; // locked=true 면 summary/findings 없음
};

export type ViewerKind = "anon" | "pending" | "rejected" | "approved" | "admin";
export type Viewer = { kind: ViewerKind; email?: string; display_name?: string };

export type ProfileStatus = "pending" | "approved" | "rejected";
export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  status: ProfileStatus;
  role: "user" | "admin";
  email_opt_in: boolean;
  kakao_opt_in: boolean;
  created_at: string;
  approved_at: string | null;
  note: string | null;
};

export type KakaoStatus = { linked: boolean; talk_message: boolean; last_error: string | null; linked_at: string | null };

export type IndexItem = {
  url: string;
  source_name: string;
  kind: ArticleKind;
  title: string;
  published: string | null;
  article_id: string | null;
};

// ---------- 응답 ----------
export type FeedResponse = {
  today: ArticleCard | null;
  items: ArticleCard[];
  free_limit: number;
  viewer: Viewer;
  total: number;
  duty?: { date: string; team: Team };
};

export type ArticleResponse = { article: Article; viewer: Viewer };

export type ForbiddenCode = "signup_required" | "approval_pending" | "rejected";

export type LibraryResponse = {
  items: IndexItem[];
  next_cursor: string | null;
  summarized_count: number;
  total: number;
};

export type PushTestDevice = { id: number; device: string; host: string; created_at: string; ok: boolean; status: number; message: string; gone: boolean };

export type MeResponse = { profile: Profile; viewer: Viewer; kakao?: KakaoStatus; push?: { devices: number } };
export type ProgressResponse = { learned: string[] };
export type StatsResponse = {
  articles: number;
  vocab: number;
  index: number;
  latest_date: string | null;
};

export type ApiErrorBody = {
  error: { code: string; message: string };
  preview?: ArticleCard;
};

// ---------- 관리자 ----------
export type JobName = "collect" | "summarize" | "digest";

export type RunSummary = { started_at: string; finished_at: string | null; ok: boolean | null };

export type AdminOverview = {
  users: { pending: number; approved: number; rejected: number; total: number };
  articles: number;
  inbox_pending: number;
  last_runs: Record<JobName, RunSummary | null>;
  next_featured_date: string;
};

// job_runs 행. SPEC 은 "log 포함" 만 명시하므로 나머지는 느슨하게 둔다.
export type JobRun = {
  id: string;
  job: JobName;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  log: string | string[] | null;
  error?: string | null;
  trigger?: string | null;
  [key: string]: unknown;
};

// inbox 행 (raw_text 제외). 컬럼은 migrations 가 진실이므로 알려진 것만 적고 나머지는 열어 둔다.
export type InboxItem = {
  id: string;
  url: string;
  title: string;
  source_id?: string;
  source_name?: string;
  kind: ArticleKind;
  status: "pending" | "done" | "failed" | "skipped" | string;
  score?: number | null;
  published?: string | null;
  created_at?: string;
  processed_at?: string | null;
  error?: string | null;
  [key: string]: unknown;
};
