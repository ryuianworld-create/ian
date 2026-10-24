// /cron/:job — Vercel Cron 전용. Authorization: Bearer ${CRON_SECRET} 가 아니면 거절.
import { Hono } from "hono";
import { env } from "../lib/env";
import { badRequest, fail } from "../lib/http";
import { isJobName, runNamedJob } from "../jobs";

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

cron.on(["GET", "POST"], "/:job", async (c) => {
  const job = c.req.param("job");
  if (!isJobName(job)) throw badRequest("job 은 collect|summarize|digest 중 하나여야 합니다");
  const { run, result, error } = await runNamedJob(job);
  return c.json({ run, result, error }, run.ok ? 200 : 500);
});
