// GET /v1/library?cursor=&limit=50&q= — 서재(index_items 전체 + 요약 여부). 누구나.
// cursor 는 오프셋(정수 문자열). 다음 페이지가 없으면 next_cursor=null.
import { Hono } from "hono";
import type { AppEnv } from "../lib/auth.js";
import { badRequest, parseLimit } from "../lib/http.js";
import { db, unwrap } from "../lib/supabase.js";
import type { IndexItem, IndexItemRow } from "../types.js";

export const library = new Hono<AppEnv>();

library.get("/", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 50, 200);
  const cursorRaw = c.req.query("cursor");
  const offset = cursorRaw ? Number(cursorRaw) : 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) throw badRequest("cursor 가 올바르지 않습니다");
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);

  let query = db()
    .from("index_items")
    .select("url,source_id,source_name,kind,title,published,collected_at", { count: "exact" })
    .order("published", { ascending: false, nullsFirst: false })
    .order("collected_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (q) {
    // PostgREST ilike 패턴 문자 이스케이프
    const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    query = query.ilike("title", pattern);
  }
  const res = await query;
  const rows = unwrap(res, "index_items.list") as IndexItemRow[];
  const total = res.count ?? rows.length;

  // 요약된 글 연결 (url 기준)
  const urls = rows.map((r) => r.url);
  const [linked, summarized] = await Promise.all([
    urls.length
      ? db().from("articles").select("id,url").in("url", urls).then((r) => unwrap(r, "articles.byUrls") as { id: string; url: string }[])
      : Promise.resolve([] as { id: string; url: string }[]),
    db().from("articles").select("id", { count: "exact", head: true }).then((r) => unwrap({ data: r.count ?? 0, error: r.error }, "articles.count")),
  ]);
  const byUrl = new Map(linked.map((a) => [a.url, a.id]));

  const items: IndexItem[] = rows.map((r) => ({
    url: r.url,
    source_name: r.source_name,
    kind: r.kind,
    title: r.title,
    published: r.published,
    article_id: byUrl.get(r.url) ?? null,
  }));
  const next = offset + rows.length;
  return c.json({ items, next_cursor: next < total && rows.length === limit ? String(next) : null, summarized_count: summarized, total });
});
