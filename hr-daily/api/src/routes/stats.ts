// GET /v1/stats — 공개 통계. 60초 캐시.
import { Hono } from "hono";
import type { AppEnv } from "../lib/auth.js";
import { kstToday } from "../lib/kst.js";
import { db, unwrap } from "../lib/supabase.js";

export const stats = new Hono<AppEnv>();

type Stats = { articles: number; vocab: number; index: number; latest_date: string | null };
let cached: { at: number; value: Stats } | null = null;

export async function computeStats(): Promise<Stats> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const today = kstToday();
  const [arts, idx] = await Promise.all([
    db().from("articles").select("featured_date,vocab").lte("featured_date", today).order("featured_date", { ascending: false }),
    db().from("index_items").select("url", { count: "exact", head: true }),
  ]);
  const rows = unwrap(arts, "articles.stats") as { featured_date: string; vocab: unknown[] }[];
  const value: Stats = {
    articles: rows.length,
    vocab: rows.reduce((n, r) => n + (Array.isArray(r.vocab) ? r.vocab.length : 0), 0),
    index: unwrap({ data: idx.count ?? 0, error: idx.error }, "index_items.count"),
    latest_date: rows[0]?.featured_date ?? null,
  };
  cached = { at: Date.now(), value };
  return value;
}

stats.get("/", async (c) => c.json(await computeStats()));
