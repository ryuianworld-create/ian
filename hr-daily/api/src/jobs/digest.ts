// digest — 오늘(KST) 아티클(없으면 최신)을 approved 회원에게 보낸다.
// 채널: 이메일(email_opt_in, Resend) · 카카오톡(kakao_opt_in, 카카오 로그인 "나에게 보내기").
// 같은 (user, article, channel) 은 한 번만 (email_log 의 부분 유니크 인덱스).
// 오늘 아티클이 없으면(06:17 요약 잡이 실패한 날) 먼저 요약을 한 번 더 시도하고, 그래도 없으면 최신 글을 보낸다.
import { normalizeFindings } from "../lib/cards.js";
import { digestEmail, emailEnabled, sendEmail } from "../lib/email.js";
import { webUrl } from "../lib/env.js";
import { KakaoError, digestTemplate, kakaoEnabled, refreshAccessToken, sendMemo } from "../lib/kakao.js";
import { digestPushPayload, pushEnabled, sendPush } from "../lib/push.js";
import { kstToday } from "../lib/kst.js";
import { db, unwrap, unwrapMaybe } from "../lib/supabase.js";
import type { Article, ArticleRow, KakaoLinkRow, PushSubscriptionRow } from "../types.js";
import type { Log } from "./run.js";
import { summarizeJob } from "./summarize.js";

export type DigestResult = {
  article_id: string | null;
  featured_date: string | null;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  kakao: { recipients: number; sent: number; failed: number; skipped: number };
  push: { recipients: number; sent: number; failed: number; skipped: number };
};

type Recipient = { id: string; email: string; display_name: string | null; email_opt_in: boolean; kakao_opt_in: boolean };
type Status = "sent" | "failed" | "skipped";
type Channel = "email" | "kakao" | "push";

const ARTICLE_COLUMNS = "id,source_id,source_name,kind,title,url,published,category,featured_date,summary,findings,detail,vocab";
const ACCESS_SKEW_MS = 60_000;

export async function digestJob(log: Log): Promise<DigestResult> {
  const today = kstToday();
  let row = unwrapMaybe(
    await db().from("articles").select(ARTICLE_COLUMNS).eq("featured_date", today).maybeSingle<ArticleRow>(),
    "articles.today",
  );
  if (!row) {
    // 요약 잡이 실패한 날: 발송 전에 한 번 더 요약을 시도한다 (예산 230초, 발송 시간은 남겨 둔다)
    log(`오늘(${today}) 아티클이 없다 — 요약을 다시 시도한다`);
    try {
      const r = await summarizeJob((m) => log(`  [summarize] ${m}`), { featured_date: today, budgetMs: 230_000 });
      if (r.status === "done") {
        row = unwrapMaybe(
          await db().from("articles").select(ARTICLE_COLUMNS).eq("featured_date", today).maybeSingle<ArticleRow>(),
          "articles.today.retry",
        );
      }
    } catch (e) {
      log(`  [summarize] ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!row) {
    row = unwrapMaybe(
      await db().from("articles").select(ARTICLE_COLUMNS).order("featured_date", { ascending: false }).limit(1).maybeSingle<ArticleRow>(),
      "articles.latest",
    );
    if (row) log(`오늘(${today}) 아티클이 없어 최신(${row.featured_date}) 을 보낸다`);
  }
  const empty: DigestResult = {
    article_id: null,
    featured_date: null,
    recipients: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    kakao: { recipients: 0, sent: 0, failed: 0, skipped: 0 },
    push: { recipients: 0, sent: 0, failed: 0, skipped: 0 },
  };
  if (!row) {
    log("보낼 아티클이 없다");
    return empty;
  }
  const article: Article = { ...(row as Article), findings: normalizeFindings(row.findings) };
  log(`아티클: ${article.title} (${article.featured_date})`);

  const recipients = unwrap(
    await db()
      .from("profiles")
      .select("id,email,display_name,email_opt_in,kakao_opt_in")
      .eq("status", "approved")
      .or("email_opt_in.eq.true,kakao_opt_in.eq.true")
      .order("created_at"),
    "profiles.recipients",
  ) as Recipient[];

  const already = unwrap(
    await db().from("email_log").select("user_id,channel").eq("article_id", article.id).eq("kind", "digest").eq("status", "sent"),
    "email_log.sent",
  ) as { user_id: string | null; channel: string }[];
  const done = new Set(already.filter((r) => r.user_id).map((r) => `${r.channel}:${r.user_id}`));

  const emailTargets = recipients.filter((r) => r.email_opt_in && !done.has(`email:${r.id}`));
  const kakaoTargets = recipients.filter((r) => r.kakao_opt_in && !done.has(`kakao:${r.id}`));
  log(`이메일 대상 ${emailTargets.length}명 · 카카오톡 대상 ${kakaoTargets.length}명 (승인 회원 ${recipients.length}명)`);

  const result: DigestResult = {
    ...empty,
    article_id: article.id,
    featured_date: article.featured_date,
    recipients: emailTargets.length,
    kakao: { recipients: kakaoTargets.length, sent: 0, failed: 0, skipped: 0 },
  };

  const record = async (userId: string, channel: Channel, status: Status, providerId: string | null, error: string | null) => {
    const { error: e } = await db().from("email_log").insert({
      user_id: userId,
      article_id: article.id,
      kind: "digest",
      channel,
      status,
      provider_id: providerId,
      error: error ? error.slice(0, 500) : null,
    });
    if (e) log(`  ⚠ email_log 기록 실패(${channel}/${userId}): ${e.message}`);
  };
  const mark = (s: Status) => (s === "sent" ? "✓" : s === "skipped" ? "–" : "✗");

  // ---- 이메일 ----
  if (emailTargets.length) {
    if (!emailEnabled()) log("RESEND_API_KEY 가 없어 메일은 skipped 로 기록한다");
    const mail = digestEmail(article);
    for (const r of emailTargets) {
      const res = await sendEmail({ to: r.email, subject: mail.subject, html: mail.html });
      result[res.status]++;
      await record(r.id, "email", res.status, res.status === "sent" ? res.provider_id : null, res.status === "sent" ? null : res.error);
      log(`  ${mark(res.status)} 메일 ${r.email}${res.status !== "sent" ? ` (${res.error})` : ""}`);
    }
    log(`메일 발송 ${result.sent} · 실패 ${result.failed} · 건너뜀 ${result.skipped}`);
  }

  // ---- 카카오톡 (나에게 보내기) ----
  if (kakaoTargets.length) {
    if (!kakaoEnabled()) log("KAKAO_REST_API_KEY 가 없어 카카오톡은 skipped 로 기록한다");
    const countRes = await db().from("articles").select("id", { count: "exact", head: true }).lte("featured_date", today);
    const issueNo = countRes.error ? null : (countRes.count ?? null);
    const template = digestTemplate(article, { webUrl: webUrl(), issueNo });
    const links = unwrap(
      await db()
        .from("kakao_links")
        .select("*")
        .in(
          "user_id",
          kakaoTargets.map((r) => r.id),
        ),
      "kakao_links.select",
    ) as KakaoLinkRow[];
    const byUser = new Map(links.map((l) => [l.user_id, l]));

    for (const r of kakaoTargets) {
      const who = r.display_name || r.email;
      const link = byUser.get(r.id);
      let status: Status;
      let err: string | null = null;
      if (!kakaoEnabled()) {
        status = "skipped";
        err = "KAKAO_REST_API_KEY 없음";
      } else if (!link) {
        status = "skipped";
        err = "카카오 연결 없음 (카카오로 다시 로그인 필요)";
      } else if (!link.talk_message) {
        status = "skipped";
        err = "카카오톡 메시지 전송 동의 없음";
      } else {
        try {
          const token = await freshAccessToken(link);
          await sendMemo(token, template);
          status = "sent";
          await db().from("kakao_links").update({ last_error: null, last_error_at: null }).eq("user_id", r.id);
        } catch (e) {
          status = "failed";
          const ke = e instanceof KakaoError ? e : null;
          err = ke ? `kakao ${ke.status}${ke.code != null ? `/${ke.code}` : ""}: ${ke.message}` : (e as Error).message;
          await db()
            .from("kakao_links")
            .update({
              last_error: err.slice(0, 300),
              last_error_at: new Date().toISOString(),
              ...(ke?.needsRelink ? { talk_message: false } : {}),
            })
            .eq("user_id", r.id);
          if (ke?.needsRelink) err += " → 다시 로그인 필요";
        }
      }
      result.kakao[status]++;
      await record(r.id, "kakao", status, null, err);
      log(`  ${mark(status)} 카카오톡 ${who}${err ? ` (${err})` : ""}`);
    }
    log(`카카오톡 발송 ${result.kakao.sent} · 실패 ${result.kakao.failed} · 건너뜀 ${result.kakao.skipped}`);
  }

  // ---- 웹 푸시 (홈 화면 앱·브라우저). 오늘 글은 누구나 읽을 수 있으므로 거절 회원만 제외한다 ----
  const subs = unwrap(
    await db().from("push_subscriptions").select("*, profiles!inner(status)").is("disabled_at", null).neq("profiles.status", "rejected"),
    "push_subscriptions.select",
  ) as (PushSubscriptionRow & { profiles: { status: string } })[];
  const pushByUser = new Map<string, PushSubscriptionRow[]>();
  for (const s of subs) {
    if (done.has(`push:${s.user_id}`)) continue;
    const list = pushByUser.get(s.user_id) ?? [];
    list.push(s);
    pushByUser.set(s.user_id, list);
  }
  result.push.recipients = pushByUser.size;
  if (pushByUser.size) {
    log(`푸시 대상 ${pushByUser.size}명 · 기기 ${[...pushByUser.values()].reduce((n, l) => n + l.length, 0)}대`);
    if (!pushEnabled()) log("VAPID 키가 없어 푸시는 skipped 로 기록한다");
    const countRes = await db().from("articles").select("id", { count: "exact", head: true }).lte("featured_date", today);
    const payload = digestPushPayload(article, { webUrl: webUrl(), issueNo: countRes.error ? null : (countRes.count ?? null) });
    for (const [userId, list] of pushByUser) {
      let status: Status = "skipped";
      const errs: string[] = [];
      if (pushEnabled()) {
        let okCount = 0;
        for (const s of list) {
          const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload);
          if (r.ok) {
            okCount++;
            await db().from("push_subscriptions").update({ last_seen_at: new Date().toISOString(), last_error: null, last_error_at: null }).eq("id", s.id);
          } else {
            errs.push(`${r.status}: ${r.message}`);
            await db()
              .from("push_subscriptions")
              .update({ last_error: `${r.status}: ${r.message}`.slice(0, 300), last_error_at: new Date().toISOString(), ...(r.gone ? { disabled_at: new Date().toISOString() } : {}) })
              .eq("id", s.id);
          }
        }
        status = okCount > 0 ? "sent" : "failed";
      }
      result.push[status]++;
      const err = status === "sent" ? null : status === "skipped" ? "VAPID 키 없음" : errs.join(" | ");
      await record(userId, "push", status, null, err);
      log(`  ${mark(status)} 푸시 ${userId.slice(0, 8)}… (${list.length}대)${err ? ` (${err})` : ""}`);
    }
    log(`푸시 발송 ${result.push.sent} · 실패 ${result.push.failed} · 건너뜀 ${result.push.skipped}`);
  }

  return result;
}

/** 저장된 액세스 토큰이 아직 유효하면 그대로, 아니면 리프레시해서 저장하고 돌려준다 */
async function freshAccessToken(link: KakaoLinkRow): Promise<string> {
  const exp = link.access_expires_at ? Date.parse(link.access_expires_at) : 0;
  if (link.access_token && exp - ACCESS_SKEW_MS > Date.now()) return link.access_token;
  const t = await refreshAccessToken(link.refresh_token);
  const now = Date.now();
  const patch: Partial<KakaoLinkRow> = {
    access_token: t.access_token,
    access_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
  if (t.refresh_token) {
    patch.refresh_token = t.refresh_token;
    if (t.refresh_token_expires_in) patch.refresh_expires_at = new Date(now + t.refresh_token_expires_in * 1000).toISOString();
  }
  const { error } = await db().from("kakao_links").update(patch).eq("user_id", link.user_id);
  if (error) throw new Error(`kakao_links 갱신 실패: ${error.message}`);
  return t.access_token;
}
