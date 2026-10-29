// 모의(mock) 모드: NEXT_PUBLIC_API_URL 이 없을 때 api.ts 가 이 픽스처를 돌려준다.
// 실제 데이터 2편(../english-tutoring/docs/data/articles.json 의 앞 두 항목)을 SPEC 형식으로 바꾼 것.
import articlesJson from "@/fixtures/articles.json";
import libraryJson from "@/fixtures/library.json";
import type {
  Article,
  ArticleCard,
  ArticleResponse,
  FeedResponse,
  IndexItem,
  LibraryResponse,
  StatsResponse,
  Viewer,
} from "./types";
import { ApiError } from "./errors";

const ARTICLES = articlesJson as Article[];
const LIBRARY = libraryJson as IndexItem[];
const FREE_LIMIT = 5;
const VIEWER: Viewer = { kind: "anon" };

function toCard(a: Article, locked: boolean): ArticleCard {
  const card: ArticleCard = {
    id: a.id,
    source_name: a.source_name,
    kind: a.kind,
    title: a.title,
    url: a.url,
    published: a.published,
    category: a.category,
    team: a.team ?? null,
    featured_date: a.featured_date,
    vocab_count: a.vocab.length,
    locked,
  };
  if (!locked) {
    card.summary = a.summary;
    card.findings = a.findings;
  }
  return card;
}

export const mock = {
  feed(): FeedResponse {
    const items = ARTICLES.map((a, i) => toCard(a, i >= FREE_LIMIT));
    return { today: items[0] ?? null, items, free_limit: FREE_LIMIT, viewer: VIEWER, total: items.length };
  },
  article(id: string): ArticleResponse {
    const idx = ARTICLES.findIndex((a) => a.id === id);
    if (idx < 0) throw new ApiError(404, "not_found", "아티클을 찾을 수 없습니다.");
    if (idx >= FREE_LIMIT) {
      throw new ApiError(403, "signup_required", "가입 후 승인되면 읽을 수 있습니다.", {
        error: { code: "signup_required", message: "가입 후 승인되면 읽을 수 있습니다." },
        preview: toCard(ARTICLES[idx], true),
      });
    }
    return { article: ARTICLES[idx], viewer: VIEWER };
  },
  library(params: { cursor?: string | null; limit?: number; q?: string }): LibraryResponse {
    const q = (params.q ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const all = q ? LIBRARY.filter((e) => e.title.toLowerCase().includes(q)) : LIBRARY;
    const start = params.cursor ? Number(params.cursor) || 0 : 0;
    const items = all.slice(start, start + limit);
    const next = start + limit < all.length ? String(start + limit) : null;
    return {
      items,
      next_cursor: next,
      summarized_count: LIBRARY.filter((e) => e.article_id).length,
      total: LIBRARY.length,
    };
  },
  stats(): StatsResponse {
    return {
      articles: ARTICLES.length,
      vocab: ARTICLES.reduce((n, a) => n + a.vocab.length, 0),
      index: LIBRARY.length,
      latest_date: ARTICLES[0]?.featured_date ?? null,
    };
  },
  unauthorized(): never {
    throw new ApiError(401, "mock_mode", "모의 모드에서는 로그인 기능을 사용할 수 없습니다.");
  },
};
