// service role 클라이언트. RLS 를 우회하므로 이 모듈은 서버(api)에서만 import 한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, requireEnv } from "./env.js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  // 서비스 키는 두 이름 중 먼저 설정된 것을 쓴다 (대시보드에서 SUPABASE_SERVICE_ROLE_KEY2 로 넣은 경우 대응)
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY2") ?? requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  client = createClient(requireEnv("SUPABASE_URL"), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "hr-daily-api" } },
  });
  return client;
}

/** supabase-js 의 { data, error } 를 풀어 에러면 throw. 호출부를 짧게 만든다. */
export function unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}${res.error.code ? ` (${res.error.code})` : ""}`);
  if (res.data === null || res.data === undefined) throw new Error(`${what}: no data`);
  return res.data;
}

/** data 가 null 이어도 되는 경우(단건 maybeSingle 등) */
export function unwrapMaybe<T>(res: { data: T | null; error: { message: string } | null }, what: string): T | null {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
