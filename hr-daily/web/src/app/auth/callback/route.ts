// OAuth(카카오 등) 콜백. Supabase 가 ?code= 로 돌려보내면 세션으로 바꿔 쿠키에 싣고 목적지로 보낸다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  if (providerError) return fail(providerError);
  if (!code || !hasSupabaseEnv) return fail("카카오 로그인에 실패했습니다. 다시 시도해 주세요.");

  const pending: CookieToSet[] = [];
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => cookies.forEach((c) => pending.push(c as CookieToSet)),
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return fail(error?.message ?? "세션을 만들지 못했습니다.");

  // 승인 대기 회원은 안내 화면으로. (api 가 이 요청에서 profiles 행을 만들어 준다)
  let dest = next;
  try {
    const me = await api.me(data.session.access_token);
    if (me.viewer.kind === "pending") dest = "/pending";
  } catch {
    // api 가 잠시 안 되더라도 로그인 자체는 성공시킨다
  }

  const res = NextResponse.redirect(new URL(dest, url.origin));
  for (const c of pending) res.cookies.set(c.name, c.value, c.options as Parameters<typeof res.cookies.set>[2]);
  return res;
}
