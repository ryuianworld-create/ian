// /v1/admin/* — viewer.kind === 'admin' 만.
import { Hono } from "hono";
import { PROFILE_COLUMNS, requireAdmin, toProfile, type AppEnv } from "../lib/auth.js";
import { approvedEmail, sendEmail } from "../lib/email.js";
import { DATE_RE, UUID_RE, badRequest, notFound, parseLimit, readJson } from "../lib/http.js";
import { addDays, isValidDate, kstToday } from "../lib/kst.js";
import { db, unwrap, unwrapMaybe } from "../lib/supabase.js";
import { isJobName, runNamedJob } from "../jobs/index.js";
import type { SummarizeParams } from "../jobs/summarize.js";
import type { InboxStatus, JobName, Profile, UserStatus } from "../types.js";

export const admin = new Hono<AppEnv>();

admin.use("*", async (c, next) => {
  requireAdmin(c);
  await next();
});

const USER_STATUSES: UserStatus[] = ["pending", "approved", "rejected"];
const INBOX_STATUSES: InboxStatus[] = ["pending", "done", "skipped", "failed"];

async function countWhere(table: string, eq: Record<string, string> = {}): Promise<number> {
  const r = await db().from(table).select("*", { count: "exact", head: true }).match(eq);
  if (r.error) throw new Error(`${table}.count: ${r.error.message}`);
  return r.count ?? 0;
}

async function lastRun(job: JobName) {
  return unwrapMaybe(
    await db().from("job_runs").select("started_at,finished_at,ok").eq("job", job).order("started_at", { ascending: false }).limit(1)
      .maybeSingle<{ started_at: string; finished_at: string | null; ok: boolean | null }>(),
    `job_runs.last(${job})`,
  );
}

// 다음에 채워질 featured_date: 오늘부터 아티클이 없는 첫 날짜
async function nextFeaturedDate(): Promise<string> {
  let d = kstToday();
  for (let i = 0; i < 30; i++) {
    const hit = unwrapMaybe(await db().from("articles").select("id").eq("featured_date", d).maybeSingle<{ id: string }>(), "articles.next");
    if (!hit) return d;
    d = addDays(d, 1);
  }
  return d;
}

admin.get("/overview", async (c) => {
  const [pending, approved, rejected, articles, inbox_pending, collect, summarize, digest, next_featured_date] = await Promise.all([
    countWhere("profiles", { status: "pending" }),
    countWhere("profiles", { status: "approved" }),
    countWhere("profiles", { status: "rejected" }),
    countWhere("articles"),
    countWhere("inbox", { status: "pending" }),
    lastRun("collect"),
    lastRun("summarize"),
    lastRun("digest"),
    nextFeaturedDate(),
  ]);
  return c.json({
    users: { pending, approved, rejected, total: pending + approved + rejected },
    articles,
    inbox_pending,
    last_runs: { collect, summarize, digest },
    next_featured_date,
  });
});

admin.get("/users", async (c) => {
  const status = c.req.query("status");
  if (status !== undefined && status !== "" && !(USER_STATUSES as string[]).includes(status)) {
    throw badRequest("status 는 pending|approved|rejected 중 하나여야 합니다");
  }
  let q = db().from("profiles").select(PROFILE_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  const users = (unwrap(await q, "profiles.list") as Profile[]).map(toProfile);
  return c.json({ users });
});

function userIdParam(c: { req: { param: (k: string) => string | undefined } }): string {
  const id = c.req.param("id") ?? "";
  if (!UUID_RE.test(id)) throw badRequest("id 가 uuid 형식이 아닙니다");
  return id;
}

admin.post("/users/:id/approve", async (c) => {
  const a = requireAdmin(c);
  const id = userIdParam(c);
  const target = unwrapMaybe(await db().from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle<Profile>(), "profiles.get");
  if (!target) throw notFound("회원을 찾을 수 없습니다");

  const profile = unwrap(
    await db()
      .from("profiles")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: a.userId })
      .eq("id", id)
      .select(PROFILE_COLUMNS)
      .single<Profile>(),
    "profiles.approve",
  );

  // 승인 안내 메일 (키 없으면 skipped 로 기록)
  const mail = approvedEmail(profile.display_name);
  const res = await sendEmail({ to: profile.email, subject: mail.subject, html: mail.html });
  await db().from("email_log").insert({
    user_id: profile.id,
    article_id: null,
    kind: "approved",
    status: res.status,
    provider_id: res.status === "sent" ? res.provider_id : null,
    error: res.status === "sent" ? null : res.error.slice(0, 500),
  });
  return c.json({ profile: toProfile(profile), email: res.status });
});

admin.post("/users/:id/reject", async (c) => {
  const id = userIdParam(c);
  const body = await readJson(c);
  if ("note" in body && body.note !== null && typeof body.note !== "string") throw badRequest("note 는 문자열이어야 합니다");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const target = unwrapMaybe(await db().from("profiles").select("id,role").eq("id", id).maybeSingle<{ id: string; role: string }>(), "profiles.get");
  if (!target) throw notFound("회원을 찾을 수 없습니다");
  if (target.role === "admin") throw badRequest("관리자는 거절할 수 없습니다");

  const profile = unwrap(
    await db().from("profiles").update({ status: "rejected", note }).eq("id", id).select(PROFILE_COLUMNS).single<Profile>(),
    "profiles.reject",
  );
  return c.json({ profile: toProfile(profile) });
});

admin.get("/inbox", async (c) => {
  const status = c.req.query("status") ?? "pending";
  if (status && !(INBOX_STATUSES as string[]).includes(status)) throw badRequest("status 는 pending|done|skipped|failed 중 하나여야 합니다");
  const limit = parseLimit(c.req.query("limit"), 50, 200);
  let q = db()
    .from("inbox")
    .select("id,source_id,source_name,kind,title,url,category,published,chars,score,status,error,collected_at,processed_at") // raw_text 제외
    .order("score", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);
  return c.json({ items: unwrap(await q, "inbox.list") });
});

admin.post("/jobs/:job", async (c) => {
  const job = c.req.param("job");
  if (!isJobName(job)) throw badRequest("job 은 collect|summarize|digest 중 하나여야 합니다");
  const body = await readJson(c);
  const params: SummarizeParams = {};
  if (job === "summarize") {
    if ("inbox_id" in body && body.inbox_id !== undefined && body.inbox_id !== null) {
      if (typeof body.inbox_id !== "string" || !body.inbox_id.trim() || body.inbox_id.length > 120) throw badRequest("inbox_id 가 올바르지 않습니다");
      params.inbox_id = body.inbox_id.trim();
    }
    if ("featured_date" in body && body.featured_date !== undefined && body.featured_date !== null) {
      if (typeof body.featured_date !== "string" || !DATE_RE.test(body.featured_date) || !isValidDate(body.featured_date)) {
        throw badRequest("featured_date 는 YYYY-MM-DD 여야 합니다");
      }
      params.featured_date = body.featured_date;
    }
  }
  const { run, result, error } = await runNamedJob(job, params);
  return c.json({ run, result, error }, run.ok ? 200 : 500);
});

admin.get("/runs", async (c) => {
  const job = c.req.query("job");
  if (job && !isJobName(job)) throw badRequest("job 은 collect|summarize|digest 중 하나여야 합니다");
  const limit = parseLimit(c.req.query("limit"), 20, 100);
  let q = db().from("job_runs").select("id,job,started_at,finished_at,ok,log").order("started_at", { ascending: false }).limit(limit);
  if (job) q = q.eq("job", job);
  return c.json({ runs: unwrap(await q, "job_runs.list") });
});
