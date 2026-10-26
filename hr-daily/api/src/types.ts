// SPEC.md 「데이터 형식」 과 0001_init.sql 의 행 타입. 프론트와 공유하는 응답 모양의 단일 진실.

export type Kind = "article" | "paper";
export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";
export type InboxStatus = "pending" | "done" | "skipped" | "failed";
export type JobName = "collect" | "summarize" | "digest";

export type Lang = { ko: string; en: string };
export type Finding = { k: Lang; ko: string; en: string }; // k: "64%" 같은 수치는 ko=en, 글자 라벨은 번역
export type DetailSection = { h: Lang; body: Lang };
export type VocabEntry = { w: string; pos: string; ko: string; en: string; ex: string };

export type Article = {
  id: string;
  source_id: string;
  source_name: string;
  kind: Kind;
  title: string;
  url: string;
  published: string | null;
  category: string | null;
  featured_date: string;
  summary: Lang;
  findings: Finding[];
  detail: DetailSection[];
  vocab: VocabEntry[];
};

export type ArticleCard = Pick<
  Article,
  "id" | "source_name" | "kind" | "title" | "url" | "published" | "category" | "featured_date"
> & { summary?: Lang; findings?: Finding[]; vocab_count: number; locked: boolean };

export type ViewerKind = "anon" | "pending" | "rejected" | "approved" | "admin";
export type Viewer = { kind: ViewerKind; email?: string; display_name?: string };

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  status: UserStatus;
  role: UserRole;
  email_opt_in: boolean;
  kakao_opt_in: boolean;
  created_at: string;
  approved_at: string | null;
  note: string | null;
};

/** 카카오 로그인 토큰 연결 상태 (GET /v1/me) */
export type KakaoStatus = { linked: boolean; talk_message: boolean; last_error: string | null; linked_at: string | null };

export type IndexItem = {
  url: string;
  source_name: string;
  kind: Kind;
  title: string;
  published: string | null;
  article_id: string | null;
};

export type JobRun = {
  id: number;
  job: JobName;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  log: string[];
};

// ---- DB 행 (service role 로 읽는 원본 모양) ----

export type SourceRow = {
  id: string;
  name: string;
  kind: Kind;
  home: string | null;
  feeds: string[];
  weight: number | string; // numeric 은 문자열로 올 수 있다
  keywords: string[];
  enabled: boolean;
  created_at: string;
};

export type IndexItemRow = {
  url: string;
  source_id: string | null;
  source_name: string;
  kind: Kind;
  title: string;
  published: string | null;
  collected_at: string;
};

export type InboxRow = {
  id: string;
  source_id: string | null;
  source_name: string;
  kind: Kind;
  title: string;
  url: string;
  category: string | null;
  published: string | null;
  raw_text: string | null;
  chars: number | null;
  score: number | string;
  status: InboxStatus;
  error: string | null;
  collected_at: string;
  processed_at: string | null;
};

export type ArticleRow = Article & {
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};

export type ProfileRow = Profile & { approved_by: string | null };

export type KakaoLinkRow = {
  user_id: string;
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string;
  refresh_expires_at: string | null;
  talk_message: boolean;
  scopes: string | null;
  linked_at: string;
  updated_at: string;
  last_error: string | null;
  last_error_at: string | null;
};

export type EmailLogRow = {
  id: number;
  user_id: string | null;
  article_id: string | null;
  channel: "email" | "kakao";
  kind: "digest" | "approved" | "rejected";
  status: "sent" | "failed" | "skipped";
  provider_id: string | null;
  error: string | null;
  sent_at: string;
};
