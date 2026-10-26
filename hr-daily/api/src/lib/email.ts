// Resend 로 메일 발송. RESEND_API_KEY 가 없으면 보내지 않고 'skipped' 를 돌려준다(실패 아님).
import { Resend } from "resend";
import { env, webUrl } from "./env.js";
import { formatKoDate } from "./kst.js";
import type { Article } from "../types.js";

export type SendResult =
  | { status: "sent"; provider_id: string | null }
  | { status: "skipped"; error: string }
  | { status: "failed"; error: string };

let resend: Resend | null = null;

export function emailEnabled(): boolean {
  return Boolean(env("RESEND_API_KEY"));
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<SendResult> {
  const key = env("RESEND_API_KEY");
  if (!key) return { status: "skipped", error: "RESEND_API_KEY not set" };
  const from = env("EMAIL_FROM") ?? "dailyHR <onboarding@resend.dev>";
  try {
    resend ??= new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? htmlToPlain(opts.html),
    });
    if (error) return { status: "failed", error: `${error.name}: ${error.message}` };
    return { status: "sent", provider_id: data?.id ?? null };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- 템플릿 ----

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 기존 사이트의 디자인 토큰(SPEC 「프론트 화면」)을 메일에서도 쓴다
const C = { paper: "#FFFCF2", surface: "#FFFFFF", ink: "#0F172A", ink2: "#3B4453", muted: "#6B7280", line: "#ECE6D2", accent: "#A16207", accentSoft: "#FFF1B8", brand: "#FFD60A", mono: "'IBM Plex Mono', Menlo, monospace" };

function layout(title: string, inner: string, footer: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:${C.paper};font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.surface};border:1px solid ${C.line};border-radius:12px;">
<tr><td style="padding:20px 24px 0;font-family:${C.mono};font-size:12px;letter-spacing:.08em;color:${C.accent};">DAILYHR</td></tr>
<tr><td style="padding:12px 24px 24px;">${inner}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.muted};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;background:${C.brand};color:#0B1222;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${esc(label)}</a>`;
}

/** digest 메일: 출처·날짜, 한글 요약, 핵심 수치, 단어 목록, 앱에서 읽기, 수신 거부 안내 */
export function digestEmail(article: Article): { subject: string; html: string } {
  const base = webUrl();
  const readUrl = `${base}/a/${encodeURIComponent(article.id)}`;
  const kindLabel = article.kind === "paper" ? "논문" : "아티클";

  const findings = article.findings.length
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:${C.ink2};">핵심 수치</h3>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${article.findings
        .map(
          (f) => `<tr><td style="padding:8px 0;border-top:1px solid ${C.line};vertical-align:top;width:88px;font-family:${C.mono};font-size:15px;color:${C.accent};font-weight:600;">${esc(f.k.ko)}</td><td style="padding:8px 0;border-top:1px solid ${C.line};font-size:14px;line-height:1.6;color:${C.ink2};">${esc(f.ko)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const vocab = article.vocab.length
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:${C.ink2};">오늘의 단어 ${article.vocab.length}개</h3>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${article.vocab
        .map(
          (v) => `<tr><td style="padding:6px 0;border-top:1px solid ${C.line};vertical-align:top;width:45%;font-size:14px;font-weight:600;">${esc(v.w)} <span style="font-weight:400;color:${C.muted};font-size:12px;">${esc(v.pos)}</span></td><td style="padding:6px 0;border-top:1px solid ${C.line};font-size:13px;line-height:1.5;color:${C.ink2};">${esc(v.ko)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const inner = `
<div style="font-family:${C.mono};font-size:12px;color:${C.muted};">${esc(article.source_name)} · ${kindLabel}${article.published ? ` · ${esc(article.published)}` : ""}</div>
<h1 style="margin:8px 0 4px;font-family:Newsreader,Georgia,serif;font-size:24px;line-height:1.3;font-weight:600;">${esc(article.title)}</h1>
<div style="font-family:${C.mono};font-size:12px;color:${C.muted};">${esc(formatKoDate(article.featured_date))}</div>
<p style="margin:20px 0 0;font-size:15px;line-height:1.8;color:${C.ink};">${esc(article.summary.ko)}</p>
${findings}
${vocab}
<div style="margin:28px 0 8px;">${button(readUrl, "앱에서 읽기")}</div>
<div style="font-size:12px;color:${C.muted};">영문 요약·상세·단어 발음은 앱에서 볼 수 있습니다. 원문: <a href="${esc(article.url)}" style="color:${C.accent};">${esc(article.source_name)}</a></div>`;

  const footer = `매일 아침 7시(KST)에 그날의 HR 아티클·논문 한 편을 보내드립니다.<br>
더 받고 싶지 않으면 <a href="${esc(base)}/account" style="color:${C.accent};">내 정보</a>에서 "매일 메일 받기"를 끄면 됩니다.`;

  return { subject: `[dailyHR] ${article.title}`, html: layout(`[dailyHR] ${article.title}`, inner, footer) };
}

/** 승인 안내 메일 */
export function approvedEmail(displayName: string | null): { subject: string; html: string } {
  const base = webUrl();
  const inner = `
<h1 style="margin:8px 0 12px;font-family:Newsreader,Georgia,serif;font-size:22px;line-height:1.3;font-weight:600;">승인되었습니다</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.8;">${displayName ? esc(displayName) + "님, " : ""}dailyHR 회원으로 승인되었습니다. 이제 모든 아티클과 서재를 볼 수 있습니다.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.8;">매일 아침 7시에 그날의 아티클을 보내드립니다.</p>
<div>${button(base, "앱 열기")}</div>`;
  const footer = `메일 수신 여부는 <a href="${esc(base)}/account" style="color:${C.accent};">내 정보</a>에서 바꿀 수 있습니다.`;
  return { subject: "[dailyHR] 가입이 승인되었습니다", html: layout("[dailyHR] 가입이 승인되었습니다", inner, footer) };
}
