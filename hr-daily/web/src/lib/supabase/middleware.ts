// @supabase/ssr 권장 패턴: 요청마다 세션을 갱신해 쿠키에 다시 쓴다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "./env";

const PROTECTED = ["/account", "/admin"];

// 대표 도메인(NEXT_PUBLIC_SITE_URL)이 설정돼 있고 요청 호스트가 *.vercel.app 이면 대표 도메인으로 보낸다
const SITE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host;
  } catch {
    return "";
  }
})();

export async function updateSession(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (SITE_HOST && host.endsWith(".vercel.app") && host !== SITE_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = SITE_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // createServerClient 와 getUser 사이에 다른 코드를 넣지 말 것 (세션 갱신 타이밍).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}
