"use client";
// 브라우저용 Supabase 클라이언트 (Auth 전용). 환경변수가 없으면 null.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseEnv } from "./env";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!hasSupabaseEnv) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
