"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { KakaoButton } from "./KakaoButton";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

function koreanAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("email not confirmed")) return "이메일 인증이 아직 끝나지 않았습니다. 받은 편지함을 확인하세요.";
  if (m.includes("already registered") || m.includes("already been registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("password should be at least")) return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("rate limit")) return "요청이 너무 잦습니다. 잠시 후 다시 시도하세요.";
  return msg;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { supabase, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => params.get("error"));
  const [info, setInfo] = useState<string | null>(null);
  const nextParam = params.get("next");
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  if (!configured || !supabase) {
    return (
      <div className="note" style={{ marginTop: 18 }}>
        <b>로그인이 아직 설정되지 않았습니다.</b>
        <br />
        <code>NEXT_PUBLIC_SUPABASE_URL</code> 과 <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를 설정하면 이메일 가입·로그인이
        켜집니다. 지금은 비로그인 상태로 최신 아티클을 읽을 수 있습니다.
        <br />
        <br />
        <Link href="/">← 오늘의 아티클로</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() || undefined },
            emailRedirectTo: SITE_URL ? `${SITE_URL}/pending` : undefined,
          },
        });
        if (err) throw err;
        if (!data.session) {
          // 이메일 확인이 켜진 프로젝트: 세션이 없으므로 안내만 한다
          setInfo("확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 완료되고 승인 대기 상태가 됩니다.");
          return;
        }
        router.push("/pending");
        router.refresh();
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        const next = params.get("next");
        router.push(next && next.startsWith("/") ? next : "/");
        router.refresh();
      }
    } catch (err) {
      setError(koreanAuthError((err as Error).message || "실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <KakaoButton next={mode === "signup" ? "/pending" : nextPath} label={mode === "signup" ? "카카오로 3초 만에 가입" : "카카오로 로그인"} />
      <div className="or" role="separator">
        <span>또는 이메일로</span>
      </div>
      {mode === "signup" ? (
        <div className="field">
          <label htmlFor="name">이름 (선택)</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
      </div>
      <div className="field">
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {mode === "signup" ? <span className="help">6자 이상</span> : null}
      </div>
      {error ? <div className="err">{error}</div> : null}
      {info ? <div className="msg">{info}</div> : null}
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? "처리 중…" : mode === "signup" ? "가입하기" : "로그인"}
      </button>
      <p className="page-note" style={{ textAlign: "center" }}>
        {mode === "signup" ? (
          <>
            이미 계정이 있나요? <Link href="/login">로그인</Link>
          </>
        ) : (
          <>
            처음이신가요? <Link href="/signup">가입하기</Link>
          </>
        )}
      </p>
    </form>
  );
}
