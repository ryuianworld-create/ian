// /cron/:job — Vercel Cron 전용. Authorization: Bearer ${CRON_SECRET} 가 아니면 거절.
import { Hono } from "hono";
import { env } from "../lib/env.js";
import { badRequest, fail } from "../lib/http.js";
import { isJobName, runNamedJob } from "../jobs/index.js";
import { addDays, kstToday } from "../lib/kst.js";
import { db, unwrapMaybe } from "../lib/supabase.js";

export const cron = new Hono();

/** 길이가 달라도 시간차가 안 나게 비교 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

cron.use("*", async (c, next) => {
  const secret = env("CRON_SECRET");
  if (!secret) return fail(c, 500, "misconfigured", "CRON_SECRET 이 설정되지 않았습니다");
  const header = c.req.header("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) return fail(c, 401, "unauthorized", "크론 인증 실패");
  await next();
});

// summarize-retry: 06:17 요약이 실패한 날을 위한 두 번째 시도(06:40). 같은 잡이며 이미 글이 있으면 건너뛴다.
const ALIASES: Record<string, string> = { "summarize-retry": "summarize" };

/** 앞으로 AHEAD_DAYS 일 안에서 글이 없는 가장 이른 날짜. 모두 있으면 null */
const AHEAD_DAYS = 2;
async function firstMissingDate(): Promise<string | null> {
  const today = kstToday();
  for (let i = 1; i <= AHEAD_DAYS; i++) {
    const d = addDays(today, i);
    const hit = unwrapMaybe(await db().from("articles").select("id").eq("featured_date", d).maybeSingle<{ id: string }>(), "articles.ahead");
    if (!hit) return d;
  }
  return null;
}

// summarize-ahead: 전날 저녁(한국 21시·22시)에 내일·모레 글을 미리 만들어 둔다. Gemini 가 붐비는 새벽을 피하고,
// 아침 크론(06:17·06:40·07:15)은 이미 글이 있으면 건너뛰므로 안전망으로 남는다.
cron.on(["GET", "POST"], ["/summarize-ahead", "/summarize-ahead-2"], async (c) => {
  const date = await firstMissingDate();
  if (!date) return c.json({ skipped: true, reason: `앞으로 ${AHEAD_DAYS}일치 글이 이미 있다` });
  const { run, result, error } = await runNamedJob("summarize", { featured_date: date });
  return c.json({ run, result, error }, run.ok ? 200 : 500);
});

cron.on(["GET", "POST"], "/:job", async (c) => {
  const job = ALIASES[c.req.param("job")] ?? c.req.param("job");
  if (!isJobName(job)) throw badRequest("job 은 collect|summarize|digest 중 하나여야 합니다");
  const { run, result, error } = await runNamedJob(job);
  return c.json({ run, result, error }, run.ok ? 200 : 500);
});
