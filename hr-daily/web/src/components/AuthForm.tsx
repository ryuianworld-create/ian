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
  const [chEmail, setChEmail] = useState(true);
  const [chKakao, setChKakao] = useState(true);
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
            // 수신 채널 선택은 가입 트리거가 profiles 로 옮긴다. 이메일 가입은 카카오 토큰이 없으니 카카오톡 채널은 끈다.
            data: { display_name: name.trim() || undefined, email_opt_in: chEmail, kakao_opt_in: false },
            emailRedirectTo: SITE_URL ? `${SITE_URL}/pending` : undefined,
          },
        });
        if (err) throw err;
        if (!data.session) {
          // 이메일 확인이 켜진 프로젝트: 세션이 없으므로 안내만 한다
          setInfo(
            "확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 완료되고 승인 대기 상태가 됩니다. 몇 분 안에 오지 않으면 스팸함을 확인해 주세요. 회사 메일은 보안 정책으로 차단되는 경우가 있어 개인 메일이나 카카오 가입을 권합니다.",
          );
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
      {mode === "signup" ? (
        <fieldset className="channels">
          <legend>매일 아침 7시, 어디로 받을까요?</legend>
          <label className="check">
            <input type="checkbox" checked={chEmail} onChange={(e) => setChEmail(e.target.checked)} />
            이메일로 받기
          </label>
          <label className="check">
            <input type="checkbox" checked={chKakao} onChange={(e) => setChKakao(e.target.checked)} />
            카카오톡으로 받기 <span className="help">카카오로 가입할 때만 · 내 &quot;나와의 채팅&quot;으로 옵니다</span>
          </label>
          <span className="help muted">나중에 내 정보에서 언제든 바꿀 수 있습니다.</span>
        </fieldset>
      ) : null}
      <KakaoButton
        next={mode === "signup" ? "/pending" : nextPath}
        pref={mode === "signup" ? [chEmail ? "email" : "", chKakao ? "kakao" : ""].filter(Boolean).join(",") || "none" : undefined}
        label={mode === "signup" ? "카카오로 3초 만에 가입" : "카카오로 로그인"}
      />
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
        {mode === "signup" ? (
          <span className="help">
            회사 메일은 확인 메일이 보안 정책으로 차단될 수 있습니다. 개인 메일(Gmail·네이버 등)이나 위의 카카오 가입을 권합니다.
          </span>
        ) : null}
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
