// 서버 컴포넌트·라우트 핸들러용 Supabase 클라이언트. 세션은 쿠키에서 읽는다.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "./env";

export async function createClient() {
  if (!hasSupabaseEnv) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 middleware 가 맡는다.
        }
      },
    },
  });
}

/** 현재 요청의 access_token. API 호출의 Authorization 헤더에 쓴다. 검증은 api 가 한다. */
export async function getServerToken(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
