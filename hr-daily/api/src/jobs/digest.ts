// digest — 오늘(KST) 아티클(없으면 최신)을 approved & email_opt_in 회원에게 보낸다. 같은 (user, article) 은 한 번만.
import { digestEmail, emailEnabled, sendEmail } from "../lib/email";
import { kstToday } from "../lib/kst";
import { db, unwrap, unwrapMaybe } from "../lib/supabase";
import type { Article, ArticleRow } from "../types";
import type { Log } from "./run";

export type DigestResult = {
  article_id: string | null;
  featured_date: string | null;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
};

const ARTICLE_COLUMNS = "id,source_id,source_name,kind,title,url,published,category,featured_date,summary,findings,detail,vocab";

export async function digestJob(log: Log): Promise<DigestResult> {
  const today = kstToday();
  let article = unwrapMaybe(
    await db().from("articles").select(ARTICLE_COLUMNS).eq("featured_date", today).maybeSingle<ArticleRow>(),
    "articles.today",
  );
  if (!article) {
    article = unwrapMaybe(
      await db().from("articles").select(ARTICLE_COLUMNS).order("featured_date", { ascending: false }).limit(1).maybeSingle<ArticleRow>(),
      "articles.latest",
    );
    if (article) log(`오늘(${today}) 아티클이 없어 최신(${article.featured_date}) 을 보낸다`);
  }
  if (!article) {
    log("보낼 아티클이 없다");
    return { article_id: null, featured_date: null, recipients: 0, sent: 0, failed: 0, skipped: 0 };
  }
  log(`아티클: ${article.title} (${article.featured_date})`);

  const recipients = unwrap(
    await db().from("profiles").select("id,email,display_name").eq("status", "approved").eq("email_opt_in", true).order("created_at"),
    "profiles.recipients",
  ) as { id: string; email: string; display_name: string | null }[];

  const already = unwrap(
    await db().from("email_log").select("user_id").eq("article_id", article.id).eq("kind", "digest").eq("status", "sent"),
    "email_log.sent",
  ) as { user_id: string | null }[];
  const done = new Set(already.map((r) => r.user_id).filter((x): x is string => Boolean(x)));

  const targets = recipients.filter((r) => !done.has(r.id));
  log(`수신 대상 ${recipients.length}명 중 미발송 ${targets.length}명`);

  const result: DigestResult = { article_id: article.id, featured_date: article.featured_date, recipients: targets.length, sent: 0, failed: 0, skipped: 0 };
  if (!targets.length) return result;

  if (!emailEnabled()) log("RESEND_API_KEY 가 없어 발송하지 않고 skipped 로 기록한다");
  const mail = digestEmail(article as Article);

  for (const r of targets) {
    const res = await sendEmail({ to: r.email, subject: mail.subject, html: mail.html });
    result[res.status]++;
    const { error } = await db().from("email_log").insert({
      user_id: r.id,
      article_id: article.id,
      kind: "digest",
      status: res.status,
      provider_id: res.status === "sent" ? res.provider_id : null,
      error: res.status === "sent" ? null : res.error.slice(0, 500),
    });
    if (error) log(`  ⚠ email_log 기록 실패(${r.email}): ${error.message}`);
    log(`  ${res.status === "sent" ? "✓" : res.status === "skipped" ? "–" : "✗"} ${r.email}${res.status !== "sent" ? ` (${res.error})` : ""}`);
  }
  log(`발송 ${result.sent} · 실패 ${result.failed} · 건너뜀 ${result.skipped}`);
  return result;
}
