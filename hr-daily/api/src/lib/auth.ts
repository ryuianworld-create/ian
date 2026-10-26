// 요청마다 viewer 를 계산한다 (SPEC 「접근 등급」).
//  - Bearer 토큰 → supabase.auth.getUser(token) 으로 검증
//  - profiles 행을 읽고(없으면 만들고), ADMIN_EMAILS 면 admin/approved 로 부트스트랩
import type { Context, MiddlewareHandler } from "hono";
import { adminEmails } from "./env.js";
import { forbidden, unauthorized } from "./http.js";
import { db, unwrapMaybe } from "./supabase.js";
import type { Profile, ProfileRow, Viewer, ViewerKind } from "../types.js";

export type AuthContext = {
  viewer: Viewer;
  userId: string | null;
  profile: Profile | null;
  tokenError: string | null; // 토큰이 왔지만 검증 실패한 경우(공개 API 는 anon 으로 계속)
};

export type AppEnv = { Variables: { auth: AuthContext } };

export const PROFILE_COLUMNS =
  "id,email,display_name,status,role,email_opt_in,kakao_opt_in,created_at,approved_at,note";

export const ANON: AuthContext = { viewer: { kind: "anon" }, userId: null, profile: null, tokenError: null };

function viewerOf(p: Profile): Viewer {
  const kind: ViewerKind = p.role === "admin" ? "admin" : p.status;
  return { kind, email: p.email, display_name: p.display_name ?? undefined };
}

export function isFullAccess(v: Viewer): boolean {
  return v.kind === "approved" || v.kind === "admin";
}

export function toProfile(row: ProfileRow | Profile): Profile {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    status: row.status,
    role: row.role,
    email_opt_in: row.email_opt_in,
    kakao_opt_in: row.kakao_opt_in ?? false,
    created_at: row.created_at,
    approved_at: row.approved_at,
    note: row.note,
  };
}

function bearer(c: Context): string | null {
  const h = c.req.header("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m && m[1] ? m[1].trim() : null;
}

export async function computeAuth(c: Context): Promise<AuthContext> {
  const token = bearer(c);
  if (!token) return ANON;

  const supa = db();
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) {
    return { ...ANON, tokenError: error?.message ?? "invalid token" };
  }
  const user = data.user;
  const email = (user.email ?? "").toLowerCase();

  // 프로필 조회. 트리거가 못 만들었으면 여기서 만든다.
  let profile = unwrapMaybe(
    await supa.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle<Profile>(),
    "profiles.select",
  );
  if (!profile) {
    // OAuth(카카오 등) 는 display_name 대신 name / nickname / preferred_username 을 준다
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const display = ["display_name", "name", "nickname", "full_name", "preferred_username"]
      .map((k) => meta[k])
      .find((v): v is string => typeof v === "string" && v.trim() !== "");
    profile = unwrapMaybe(
      await supa
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email,
            display_name: display ?? (email ? email.split("@")[0] : null) ?? "회원",
          },
          { onConflict: "id" },
        )
        .select(PROFILE_COLUMNS)
        .single<Profile>(),
      "profiles.upsert",
    );
  }
  if (!profile) return { ...ANON, tokenError: "profile unavailable" };

  // ADMIN_EMAILS 부트스트랩
  if (email && adminEmails().has(email) && (profile.role !== "admin" || profile.status !== "approved")) {
    const patch = {
      role: "admin" as const,
      status: "approved" as const,
      approved_at: profile.approved_at ?? new Date().toISOString(),
    };
    const updated = unwrapMaybe(
      await supa.from("profiles").update(patch).eq("id", user.id).select(PROFILE_COLUMNS).single<Profile>(),
      "profiles.bootstrap",
    );
    if (updated) profile = updated;
  }

  return { viewer: viewerOf(profile), userId: profile.id, profile, tokenError: null };
}

/** 모든 /v1/* 에 건다. 실패해도 요청을 막지 않고 anon 으로 둔다(토큰 만료 등). */
export const withAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    c.set("auth", await computeAuth(c));
  } catch (e) {
    console.error("auth error", e);
    c.set("auth", { ...ANON, tokenError: e instanceof Error ? e.message : String(e) });
  }
  await next();
};

/** 로그인 필수(승인 여부 불문) */
export function requireUser(c: Context<AppEnv>): AuthContext & { userId: string; profile: Profile } {
  const a = c.get("auth");
  if (!a.userId || !a.profile) {
    throw unauthorized(a.tokenError ? `토큰이 유효하지 않습니다: ${a.tokenError}` : "로그인이 필요합니다");
  }
  return a as AuthContext & { userId: string; profile: Profile };
}

/** 관리자 필수 */
export function requireAdmin(c: Context<AppEnv>): AuthContext & { userId: string; profile: Profile } {
  const a = requireUser(c);
  if (a.viewer.kind !== "admin") throw forbidden("관리자만 접근할 수 있습니다", "admin_only");
  return a;
}
