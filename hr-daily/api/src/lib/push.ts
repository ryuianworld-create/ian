// 웹 푸시 (VAPID). 홈 화면에 추가한 웹앱·브라우저로 "새 글" 알림을 보낸다. 구독은 push_subscriptions (service role 전용).
import webpush from "web-push";
import { env, requireEnv } from "./env.js";
import { TEAMS, type Team } from "./teams.js";
import type { Article } from "../types.js";

export type PushKeys = { endpoint: string; p256dh: string; auth: string };
export type PushResult = { ok: true } | { ok: false; status: number; gone: boolean; message: string };

export function pushEnabled(): boolean {
  return Boolean(env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY"));
}

let configured = false;
function setup(): void {
  if (configured) return;
  webpush.setVapidDetails(env("VAPID_SUBJECT") ?? "mailto:rchworld@gmail.com", requireEnv("VAPID_PUBLIC_KEY"), requireEnv("VAPID_PRIVATE_KEY"));
  configured = true;
}

/** 한 기기에 보낸다. 404/410 이면 구독이 사라진 것(gone) — 호출 측에서 비활성화한다. */
export async function sendPush(sub: PushKeys, payload: Record<string, unknown>, ttlSeconds = 12 * 60 * 60): Promise<PushResult> {
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: ttlSeconds, urgency: "normal" },
    );
    return { ok: true };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const status = err.statusCode ?? 0;
    const body = (err.body ?? "").toString().slice(0, 200);
    return { ok: false, status, gone: status === 404 || status === 410, message: body || err.message || `HTTP ${status}` };
  }
}

const strip = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/** 아침 아티클 알림 본문. 서비스 워커(web/public/sw.js)가 그대로 표시한다. */
export function digestPushPayload(article: Article, opts: { webUrl: string; issueNo: number | null; duty?: Team }): Record<string, unknown> {
  const kind = article.kind === "paper" ? "논문" : "아티클";
  const no = opts.issueNo ? `No. ${opts.issueNo} · ` : "";
  const d = opts.duty ? TEAMS[opts.duty] : null;
  return {
    title: d ? `${no}${d.cat}의 오늘의 HR ${kind}` : `${no}오늘의 HR ${kind}`,
    body: `${cut(article.title, 80)}\n${cut(strip(article.summary.ko), 90)}`,
    url: `${opts.webUrl}/a/${encodeURIComponent(article.id)}`,
    tag: `digest-${article.featured_date}`,
    icon: `${opts.webUrl}/icon-180.png`,
  };
}
