// /v1/vocab/progress — 외운 단어. 로그인 필요(승인 불문).
import { Hono } from "hono";
import { requireUser, type AppEnv } from "../lib/auth";
import { badRequest, notFound, readJson } from "../lib/http";
import { db, unwrap, unwrapMaybe } from "../lib/supabase";

export const vocab = new Hono<AppEnv>();

function articleIdParam(v: unknown): string {
  if (typeof v !== "string" || !v.trim() || v.length > 120) throw badRequest("article_id 가 필요합니다");
  return v.trim();
}

// article_id 가 없으면 전체 아티클에서 외운 단어(중복 제거)를 돌려준다 — 단어장 "누적" 표시용
vocab.get("/progress", async (c) => {
  const a = requireUser(c);
  const raw = c.req.query("article_id");
  let q = db().from("vocab_progress").select("word").eq("user_id", a.userId).eq("learned", true);
  if (raw !== undefined && raw !== "") q = q.eq("article_id", articleIdParam(raw));
  const rows = unwrap(await q, "vocab_progress.list") as { word: string }[];
  return c.json({ learned: [...new Set(rows.map((r) => r.word))] });
});

vocab.put("/progress", async (c) => {
  const a = requireUser(c);
  const body = await readJson(c);
  const article_id = articleIdParam(body.article_id);
  if (typeof body.word !== "string" || !body.word.trim() || body.word.length > 120) throw badRequest("word 가 필요합니다");
  if (typeof body.learned !== "boolean") throw badRequest("learned 는 true/false 여야 합니다");
  const word = body.word.trim();

  // FK 위반 대신 404 로
  const exists = unwrapMaybe(await db().from("articles").select("id").eq("id", article_id).maybeSingle<{ id: string }>(), "articles.exists");
  if (!exists) throw notFound("아티클을 찾을 수 없습니다");

  const { error } = await db()
    .from("vocab_progress")
    .upsert(
      { user_id: a.userId, article_id, word, learned: body.learned, updated_at: new Date().toISOString() },
      { onConflict: "user_id,article_id,word" },
    );
  if (error) throw new Error(`vocab_progress.upsert: ${error.message}`);
  return c.json({ ok: true });
});
