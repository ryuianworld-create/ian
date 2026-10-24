"use client";
// Supabase 세션을 한 곳에서 관리한다. 데이터는 전부 api 로 가므로 여기서는 토큰·이메일만 꺼내 쓴다.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type AuthState = {
  /** Supabase 환경변수가 있는가 (없으면 로그인 기능 비활성) */
  configured: boolean;
  /** 최초 세션 확인이 끝났는가 */
  ready: boolean;
  session: Session | null;
  token: string | null;
  email: string | null;
  supabase: SupabaseClient | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  configured: false,
  ready: false,
  session: null,
  token: null,
  email: null,
  supabase: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthState>(
    () => ({
      configured: hasSupabaseEnv,
      ready,
      session,
      token: session?.access_token ?? null,
      email: session?.user?.email ?? null,
      supabase,
      signOut,
    }),
    [ready, session, supabase, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
