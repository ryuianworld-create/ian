// 카카오 REST API — 카카오 로그인 토큰 확인·갱신, "나에게 보내기"(카카오톡 메시지 API, talk_message 동의 필요).
// 비즈니스 채널·알림톡이 아니다: 사용자가 카카오 로그인 때 동의한 자기 자신의 "나와의 채팅" 방으로만 보낼 수 있다.
import { env } from "./env.js";
import { TEAMS, type Team } from "./teams.js";
import type { Article } from "../types.js";

const KAUTH = "https://kauth.kakao.com";
const KAPI = "https://kapi.kakao.com";
const TIMEOUT_MS = 10_000;

export class KakaoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: number | null,
  ) {
    super(message);
    this.name = "KakaoError";
  }
  /** 토큰이 죽었거나(만료·탈퇴·연결 해제) 동의가 없어 다시 로그인해야 하는 경우 */
  get needsRelink(): boolean {
    return this.status === 401 || this.code === -401 || this.code === -402 || this.code === -406 || this.code === -101;
  }
}

export function kakaoEnabled(): boolean {
  return Boolean(env("KAKAO_REST_API_KEY"));
}

async function kakaoFetch<T>(url: string, init: RequestInit): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    if (!res.ok) {
      const d = (data ?? {}) as { code?: number; msg?: string; error?: string; error_description?: string; error_code?: string };
      const msg = d.msg ?? d.error_description ?? d.error ?? `HTTP ${res.status}`;
      const code = typeof d.code === "number" ? d.code : d.error_code ? Number(d.error_code.replace(/\D/g, "")) * -1 || null : null;
      throw new KakaoError(`${msg}${d.error_code ? ` (${d.error_code})` : ""}`, res.status, code);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 액세스 토큰이 살아 있는지 + 남은 수명(초) */
export async function accessTokenInfo(accessToken: string): Promise<{ id: number; expires_in: number; app_id: number }> {
  return kakaoFetch(`${KAPI}/v1/user/access_token_info`, { headers: { Authorization: `Bearer ${accessToken}` } });
}

/** 사용자가 동의한 scope id 목록 (예: profile_nickname, account_email, talk_message) */
export async function agreedScopes(accessToken: string): Promise<string[]> {
  const data = await kakaoFetch<{ scopes?: { id: string; agreed: boolean }[] }>(`${KAPI}/v2/user/scopes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (data.scopes ?? []).filter((s) => s.agreed).map((s) => s.id);
}

export type RefreshedToken = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

/** 리프레시 토큰으로 액세스 토큰 재발급. 클라이언트 시크릿이 켜진 앱은 KAKAO_CLIENT_SECRET 이 필요하다. */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
  const clientId = env("KAKAO_REST_API_KEY");
  if (!clientId) throw new KakaoError("KAKAO_REST_API_KEY 가 설정되지 않았다", 0, null);
  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken });
  const secret = env("KAKAO_CLIENT_SECRET");
  if (secret) body.set("client_secret", secret);
  return kakaoFetch(`${KAUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
}

/** 나에게 보내기 (기본 템플릿). 성공하면 result_code 0 */
export async function sendMemo(accessToken: string, templateObject: Record<string, unknown>): Promise<void> {
  const body = new URLSearchParams({ template_object: JSON.stringify(templateObject) });
  await kakaoFetch<{ result_code: number }>(`${KAPI}/v2/api/talk/memo/default/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
}

const strip = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/** 아침 아티클 피드 메시지 (카카오 feed 템플릿) */
export function digestTemplate(article: Article, opts: { webUrl: string; issueNo: number | null; duty?: Team }): Record<string, unknown> {
  const url = `${opts.webUrl}/a/${encodeURIComponent(article.id)}`;
  const kind = article.kind === "paper" ? "논문" : "아티클";
  const no = opts.issueNo ? `No. ${opts.issueNo} · ` : "";
  const d = opts.duty ? TEAMS[opts.duty] : null;
  const findings = article.findings
    .slice(0, 2)
    .map((f) => `${f.k.ko} ${cut(strip(f.ko), 40)}`)
    .join("\n");
  const description = cut(
    [`${no}${kind} · ${article.source_name}`, d ? `오늘 당번 ${d.cat} (${d.team})` : "", cut(strip(article.summary.ko), 100), findings, `단어 ${article.vocab.length}개`]
      .filter(Boolean)
      .join("\n"),
    200,
  );
  return {
    object_type: "feed",
    content: {
      title: cut(`[DailyHR] ${article.title}`, 90),
      description,
      image_url: `${opts.webUrl}/icon-512.png`,
      image_width: 512,
      image_height: 512,
      link: { web_url: url, mobile_web_url: url },
    },
    buttons: [{ title: "아티클 읽기", link: { web_url: url, mobile_web_url: url } }],
  };
}
