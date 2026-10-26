"use client";
// 카카오 로그인 버튼. Supabase OAuth(provider: kakao) → /auth/callback 으로 돌아온다.
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function KakaoButton({ next, label = "카카오로 계속하기" }: { next: string; label?: string }) {
  const { supabase } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supabase) return null;

  const go = async () => {
    setBusy(true);
    setError(null);
    const origin = window.location.origin;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Supabase 기본값은 profile_image 까지 요청한다. 카카오 앱 동의항목에 없는 scope 를 보내면 KOE205 가 나므로
        // 닉네임·이메일만 요청한다.
        scopes: "profile_nickname account_email",
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
    // 성공하면 카카오 페이지로 이동하므로 busy 를 풀지 않는다
  };

  return (
    <div className="kakao-wrap">
      <button type="button" className="btn kakao" onClick={go} disabled={busy} aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
          <path
            fill="currentColor"
            d="M12 3C6.48 3 2 6.52 2 10.86c0 2.8 1.86 5.26 4.66 6.65l-.95 3.5a.33.33 0 0 0 .5.36l4.1-2.72c.55.07 1.11.11 1.69.11 5.52 0 10-3.52 10-7.9S17.52 3 12 3z"
          />
        </svg>
        {busy ? "카카오로 이동 중…" : label}
      </button>
      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}
