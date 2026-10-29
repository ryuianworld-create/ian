// GET /v1/feed — 아티클 목록(최신순). viewer 에 따라 free_limit 이후는 locked.
import { Hono } from "hono";
import { isFullAccess, type AppEnv } from "../lib/auth.js";
import { CARD_COLUMNS, toCard, type CardRow } from "../lib/cards.js";
import { kstToday } from "../lib/kst.js";
import { dutyTeam } from "../lib/teams.js";
import { freeArticleLimit } from "../lib/settings.js";
import { db, unwrap } from "../lib/supabase.js";

export const feed = new Hono<AppEnv>();

feed.get("/", async (c) => {
  const { viewer } = c.get("auth");
  const today = kstToday();
  const [free_limit, rows] = await Promise.all([
    freeArticleLimit(),
    db()
      .from("articles")
      .select(CARD_COLUMNS)
      .lte("featured_date", today) // 미래 날짜로 미리 만들어 둔 글은 숨긴다
      .order("featured_date", { ascending: false })
      .then((r) => unwrap(r, "articles.feed") as CardRow[]),
  ]);
  const full = isFullAccess(viewer);
  const items = rows.map((row, i) => toCard(row, !full && i >= free_limit));
  return c.json({ today: items[0] ?? null, items, free_limit, viewer, total: items.length, duty: { date: today, team: dutyTeam(today) } });
});
