// GET /v1/articles/:id — 아티클 전체. 권한 없으면 403 + preview 카드.
import { Hono } from "hono";
import { isFullAccess, type AppEnv } from "../lib/auth.js";
import { ARTICLE_COLUMNS, toCard } from "../lib/cards.js";
import { errorBody, notFound } from "../lib/http.js";
import { kstToday } from "../lib/kst.js";
import { freeArticleLimit } from "../lib/settings.js";
import { db, unwrap, unwrapMaybe } from "../lib/supabase.js";
import type { Article } from "../types.js";

export const articles = new Hono<AppEnv>();

articles.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id || id.length > 120) throw notFound("아티클을 찾을 수 없습니다");
  const { viewer } = c.get("auth");

  const article = unwrapMaybe(
    await db().from("articles").select(ARTICLE_COLUMNS).eq("id", id).maybeSingle<Article>(),
    "articles.byId",
  );
  if (!article) throw notFound("아티클을 찾을 수 없습니다");
  const today = kstToday();
  if (article.featured_date > today && viewer.kind !== "admin") throw notFound("아티클을 찾을 수 없습니다");

  if (isFullAccess(viewer)) return c.json({ article, viewer });

  // 무료 구간인지: 이 글보다 최신인 글의 수 < free_limit
  const [free_limit, newer] = await Promise.all([
    freeArticleLimit(),
    db()
      .from("articles")
      .select("id", { count: "exact", head: true })
      .gt("featured_date", article.featured_date)
      .lte("featured_date", today)
      .then((r) => unwrap({ data: r.count ?? 0, error: r.error }, "articles.rank")),
  ]);
  if (newer < free_limit) return c.json({ article, viewer });

  const code = viewer.kind === "pending" ? "approval_pending" : viewer.kind === "rejected" ? "rejected" : "signup_required";
  const message =
    code === "approval_pending"
      ? "가입 승인 대기 중입니다. 승인되면 모든 아티클을 볼 수 있습니다."
      : code === "rejected"
        ? "가입이 승인되지 않았습니다."
        : `최신 ${free_limit}편은 무료로 볼 수 있습니다. 더 보려면 가입하세요.`;
  return c.json({ ...errorBody(code, message), preview: toCard(article, true), viewer }, 403);
});
