// GET/PATCH /v1/me — 내 프로필 · POST/DELETE /v1/me/kakao/link — 카카오 토큰 연결 · POST/DELETE /v1/me/push — 웹 푸시 구독
import { Hono } from "hono";
import { PROFILE_COLUMNS, requireUser, toProfile, type AppEnv } from "../lib/auth.js";
import { badRequest, readJson } from "../lib/http.js";
import { KakaoError, accessTokenInfo, agreedScopes } from "../lib/kakao.js";
import { db, unwrap, unwrapMaybe } from "../lib/supabase.js";
import type { KakaoStatus, Profile } from "../types.js";

export const me = new Hono<AppEnv>();

async function kakaoStatus(userId: string): Promise<KakaoStatus> {
  const row = unwrapMaybe(
    await db()
      .from("kakao_links")
      .select("talk_message,last_error,linked_at")
      .eq("user_id", userId)
      .maybeSingle<{ talk_message: boolean; last_error: string | null; linked_at: string }>(),
    "kakao_links.status",
  );
  return {
    linked: Boolean(row),
    talk_message: row?.talk_message ?? false,
    last_error: row?.last_error ?? null,
    linked_at: row?.linked_at ?? null,
  };
}

async function pushStatus(userId: string): Promise<{ devices: number }> {
  const r = await db().from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId).is("disabled_at", null);
  return { devices: r.error ? 0 : (r.count ?? 0) };
}

me.get("/", async (c) => {
  const a = requireUser(c);
  const [kakao, push] = await Promise.all([kakaoStatus(a.userId), pushStatus(a.userId)]);
  return c.json({ profile: toProfile(a.profile), viewer: a.viewer, kakao, push });
});

/** 웹 푸시 구독 저장. body: { endpoint, keys: { p256dh, auth }, user_agent? } */
me.post("/push", async (c) => {
  const a = requireUser(c);
  const body = await readJson(c);
  const endpoint = body.endpoint;
  const keys = (body.keys ?? {}) as { p256dh?: unknown; auth?: unknown };
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 2000) throw badRequest("endpoint 가 올바르지 않습니다");
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || !keys.p256dh || !keys.auth) throw badRequest("keys.p256dh / keys.auth 가 필요합니다");
  const ua = typeof body.user_agent === "string" ? body.user_agent.slice(0, 300) : null;
  const now = new Date().toISOString();
  const { error } = await db().from("push_subscriptions").upsert(
    { user_id: a.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: ua, last_seen_at: now, last_error: null, last_error_at: null, disabled_at: null },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`push_subscriptions.upsert: ${error.message}`);
  return c.json({ push: await pushStatus(a.userId) });
});

/** 웹 푸시 구독 해제. body: { endpoint } (없으면 내 구독 전부) */
me.delete("/push", async (c) => {
  const a = requireUser(c);
  const body = await readJson(c).catch(() => ({}) as Record<string, unknown>);
  let q = db().from("push_subscriptions").delete().eq("user_id", a.userId);
  if (typeof body.endpoint === "string" && body.endpoint) q = q.eq("endpoint", body.endpoint);
  const { error } = await q;
  if (error) throw new Error(`push_subscriptions.delete: ${error.message}`);
  return c.json({ push: await pushStatus(a.userId) });
});

me.patch("/", async (c) => {
  const a = requireUser(c);
  const body = await readJson(c);
  const patch: { display_name?: string | null; email_opt_in?: boolean; kakao_opt_in?: boolean } = {};

  if ("display_name" in body) {
    const v = body.display_name;
    if (v !== null && typeof v !== "string") throw badRequest("display_name 은 문자열이어야 합니다");
    const name = typeof v === "string" ? v.trim().slice(0, 60) : null;
    patch.display_name = name || null;
  }
  for (const key of ["email_opt_in", "kakao_opt_in"] as const) {
    if (key in body) {
      const v = body[key];
      if (typeof v !== "boolean") throw badRequest(`${key} 은 true/false 여야 합니다`);
      patch[key] = v;
    }
  }
  if (!Object.keys(patch).length) throw badRequest("바꿀 항목이 없습니다 (display_name, email_opt_in, kakao_opt_in)");

  const profile = unwrap(
    await db().from("profiles").update(patch).eq("id", a.userId).select(PROFILE_COLUMNS).single<Profile>(),
    "profiles.update",
  );
  return c.json({ profile: toProfile(profile), kakao: await kakaoStatus(a.userId) });
});

/**
 * 카카오 로그인 직후 웹 콜백이 공급자 토큰을 넘겨준다. 토큰이 살아 있는지와 동의 scope 를 카카오에 확인하고 저장한다.
 * body: { provider_token: string, provider_refresh_token: string }
 */
me.post("/kakao/link", async (c) => {
  const a = requireUser(c);
  const body = await readJson(c);
  const access = body.provider_token;
  const refresh = body.provider_refresh_token;
  if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
    throw badRequest("provider_token 과 provider_refresh_token 이 필요합니다");
  }
  let expiresIn: number;
  let scopes: string[];
  try {
    const [info, agreed] = await Promise.all([accessTokenInfo(access), agreedScopes(access)]);
    expiresIn = info.expires_in;
    scopes = agreed;
  } catch (e) {
    const msg = e instanceof KakaoError ? `카카오 토큰 확인 실패: ${e.message}` : (e as Error).message;
    throw badRequest(msg);
  }
  const now = Date.now();
  const { error } = await db().from("kakao_links").upsert(
    {
      user_id: a.userId,
      access_token: access,
      access_expires_at: new Date(now + expiresIn * 1000).toISOString(),
      refresh_token: refresh,
      refresh_expires_at: null,
      talk_message: scopes.includes("talk_message"),
      scopes: scopes.join(" "),
      updated_at: new Date(now).toISOString(),
      last_error: null,
      last_error_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`kakao_links.upsert: ${error.message}`);
  return c.json({ kakao: await kakaoStatus(a.userId) });
});

me.delete("/kakao/link", async (c) => {
  const a = requireUser(c);
  const { error } = await db().from("kakao_links").delete().eq("user_id", a.userId);
  if (error) throw new Error(`kakao_links.delete: ${error.message}`);
  await db().from("profiles").update({ kakao_opt_in: false }).eq("id", a.userId);
  return c.json({ kakao: await kakaoStatus(a.userId) });
});
