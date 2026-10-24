// GET/PATCH /v1/me — 내 프로필
import { Hono } from "hono";
import { PROFILE_COLUMNS, requireUser, toProfile, type AppEnv } from "../lib/auth.js";
import { badRequest, readJson } from "../lib/http.js";
import { db, unwrap } from "../lib/supabase.js";
import type { Profile } from "../types.js";

export const me = new Hono<AppEnv>();

me.get("/", (c) => {
  const a = requireUser(c);
  return c.json({ profile: toProfile(a.profile), viewer: a.viewer });
});

me.patch("/", async (c) => {
  const a = requireUser(c);
  const body = await readJson(c);
  const patch: { display_name?: string | null; email_opt_in?: boolean } = {};

  if ("display_name" in body) {
    const v = body.display_name;
    if (v !== null && typeof v !== "string") throw badRequest("display_name 은 문자열이어야 합니다");
    const name = typeof v === "string" ? v.trim().slice(0, 60) : null;
    patch.display_name = name || null;
  }
  if ("email_opt_in" in body) {
    if (typeof body.email_opt_in !== "boolean") throw badRequest("email_opt_in 은 true/false 여야 합니다");
    patch.email_opt_in = body.email_opt_in;
  }
  if (!Object.keys(patch).length) throw badRequest("바꿀 항목이 없습니다 (display_name, email_opt_in)");

  const profile = unwrap(
    await db().from("profiles").update(patch).eq("id", a.userId).select(PROFILE_COLUMNS).single<Profile>(),
    "profiles.update",
  );
  return c.json({ profile: toProfile(profile) });
});
