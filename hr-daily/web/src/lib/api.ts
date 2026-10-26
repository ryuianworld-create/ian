// API 클라이언트. SPEC.md 「API 계약」의 모든 엔드포인트를 타입과 함께 감싼다.
// 서버 컴포넌트·클라이언트 컴포넌트 양쪽에서 쓴다. 토큰은 호출자가 넘긴다
// (서버: lib/supabase/server.getServerToken, 클라이언트: AuthProvider 의 token).
import type {
  AdminOverview,
  ArticleResponse,
  FeedResponse,
  InboxItem,
  JobName,
  JobRun,
  LibraryResponse,
  KakaoStatus,
  MeResponse,
  Profile,
  ProfileStatus,
  ProgressResponse,
  StatsResponse,
  ApiErrorBody,
} from "./types";
import { ApiError } from "./errors";
import { mock } from "./mock";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const isMock = API_URL === "";

type Token = string | null | undefined;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: Token;
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiError(0, "network", `API 에 연결하지 못했습니다 (${(e as Error).message})`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = (data ?? null) as ApiErrorBody | null;
    const code = body?.error?.code ?? `http_${res.status}`;
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message, body);
  }
  return data as T;
}

export const api = {
  // ---------- 공개·회원 ----------
  feed(token?: Token): Promise<FeedResponse> {
    if (isMock) return Promise.resolve(mock.feed());
    return request<FeedResponse>("/v1/feed", { token });
  },

  article(id: string, token?: Token): Promise<ArticleResponse> {
    if (isMock) return Promise.resolve().then(() => mock.article(id));
    return request<ArticleResponse>(`/v1/articles/${encodeURIComponent(id)}`, { token });
  },

  library(params: { cursor?: string | null; limit?: number; q?: string } = {}): Promise<LibraryResponse> {
    if (isMock) return Promise.resolve(mock.library(params));
    return request<LibraryResponse>("/v1/library", {
      query: { cursor: params.cursor, limit: params.limit ?? 50, q: params.q },
    });
  },

  me(token: Token): Promise<MeResponse> {
    if (isMock) return Promise.resolve().then(() => mock.unauthorized());
    return request<MeResponse>("/v1/me", { token });
  },

  updateMe(patch: { display_name?: string; email_opt_in?: boolean; kakao_opt_in?: boolean }, token: Token): Promise<{ profile: Profile; kakao?: KakaoStatus }> {
    if (isMock) return Promise.resolve().then(() => mock.unauthorized());
    return request<{ profile: Profile; kakao?: KakaoStatus }>("/v1/me", { method: "PATCH", token, body: patch });
  },
  /** 카카오 로그인 직후 공급자 토큰을 API 에 맡긴다 (카카오톡 나에게 보내기용) */
  kakaoLink(tokens: { provider_token: string; provider_refresh_token: string }, token: Token): Promise<{ kakao: KakaoStatus }> {
    if (isMock) return Promise.resolve({ kakao: { linked: false, talk_message: false, last_error: null, linked_at: null } });
    return request<{ kakao: KakaoStatus }>("/v1/me/kakao/link", { method: "POST", token, body: tokens });
  },

  // article_id 를 생략하면 전체 외운 단어(누적)를 돌려준다고 가정한다.
  vocabProgress(articleId: string | null, token: Token): Promise<ProgressResponse> {
    if (isMock) return Promise.resolve().then(() => mock.unauthorized());
    return request<ProgressResponse>("/v1/vocab/progress", { token, query: { article_id: articleId } });
  },

  setVocabProgress(
    body: { article_id: string; word: string; learned: boolean },
    token: Token,
  ): Promise<{ ok: true }> {
    if (isMock) return Promise.resolve().then(() => mock.unauthorized());
    return request<{ ok: true }>("/v1/vocab/progress", { method: "PUT", token, body });
  },

  stats(): Promise<StatsResponse> {
    if (isMock) return Promise.resolve(mock.stats());
    return request<StatsResponse>("/v1/stats");
  },

  // ---------- 관리자 ----------
  admin: {
    overview(token: Token): Promise<AdminOverview> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<AdminOverview>("/v1/admin/overview", { token });
    },
    users(token: Token, status?: ProfileStatus): Promise<{ users: Profile[] }> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<{ users: Profile[] }>("/v1/admin/users", { token, query: { status } });
    },
    approve(id: string, token: Token): Promise<{ profile: Profile }> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<{ profile: Profile }>(`/v1/admin/users/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        token,
      });
    },
    reject(id: string, note: string | undefined, token: Token): Promise<{ profile: Profile }> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<{ profile: Profile }>(`/v1/admin/users/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        token,
        body: note ? { note } : {},
      });
    },
    inbox(token: Token, status = "pending", limit = 50): Promise<{ items: InboxItem[] }> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<{ items: InboxItem[] }>("/v1/admin/inbox", { token, query: { status, limit } });
    },
    runJob(
      job: JobName,
      token: Token,
      body?: { inbox_id?: string; featured_date?: string },
    ): Promise<{ run: JobRun }> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<{ run: JobRun }>(`/v1/admin/jobs/${job}`, { method: "POST", token, body: body ?? {} });
    },
    runs(token: Token, job?: JobName, limit = 20): Promise<{ runs: JobRun[] }> {
      if (isMock) return Promise.resolve().then(() => mock.unauthorized());
      return request<{ runs: JobRun[] }>("/v1/admin/runs", { token, query: { job, limit } });
    },
  },
};
