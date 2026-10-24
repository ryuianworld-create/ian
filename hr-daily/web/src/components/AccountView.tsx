"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, isMock } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { viewerLabel } from "@/lib/format";
import type { MeResponse } from "@/lib/types";
import { useAuth } from "./AuthProvider";

export function AccountView() {
  const router = useRouter();
  const { ready, token, email, signOut, configured } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login?next=/account");
      return;
    }
    let alive = true;
    api
      .me(token)
      .then((m) => {
        if (!alive) return;
        setMe(m);
        setName(m.profile.display_name ?? "");
        setOptIn(m.profile.email_opt_in);
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [ready, token, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const { profile } = await api.updateMe({ display_name: name.trim(), email_opt_in: optIn }, token);
      setMe((m) => (m ? { ...m, profile } : m));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  if (!configured) {
    return (
      <div className="note" style={{ marginTop: 18 }}>
        로그인이 설정되지 않아 내 정보를 표시할 수 없습니다. <Link href="/login">자세히</Link>
      </div>
    );
  }
  if (!ready || (!me && !error)) {
    return <div className="note" style={{ marginTop: 18 }}>내 정보를 불러오는 중입니다…</div>;
  }

  const statusClass = me ? (me.viewer.kind === "admin" ? "admin" : me.profile.status) : "";

  return (
    <div className="jr-account">
      {error ? (
        <div className="err" style={{ marginTop: 16 }}>
          {error}
          {isMock ? " (모의 모드)" : ""}
        </div>
      ) : null}

      {me ? (
        <div className="jr-accgrid">
          <section className="jr-card">
            <span className="eyebrow">Profile</span>
            <div className="jr-who">
              <span className="avatar" aria-hidden="true">
                {(me.profile.display_name || me.profile.email).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="name">{me.profile.display_name || me.profile.email.split("@")[0]}</div>
                <div className="mail">{me.profile.email}</div>
              </div>
            </div>
            <dl className="jr-dl">
              <dt>상태</dt>
              <dd>
                <span className={`pill ${statusClass}`}>{viewerLabel(me.viewer.kind)}</span>
                {me.viewer.kind === "pending" ? <span className="hint"> 관리자 승인을 기다리고 있습니다.</span> : null}
                {me.viewer.kind === "rejected" && me.profile.note ? <span className="hint"> {me.profile.note}</span> : null}
              </dd>
              <dt>가입일</dt>
              <dd>{me.profile.created_at.slice(0, 10)}</dd>
              {me.profile.approved_at ? (
                <>
                  <dt>승인일</dt>
                  <dd>{me.profile.approved_at.slice(0, 10)}</dd>
                </>
              ) : null}
              <dt>아침 메일</dt>
              <dd>{me.profile.email_opt_in ? "받음 · 매일 07:00" : "받지 않음"}</dd>
            </dl>
            {me.viewer.kind === "admin" ? (
              <Link className="btn" href="/admin">
                관리자 화면 →
              </Link>
            ) : me.viewer.kind === "pending" ? (
              <Link className="btn" href="/pending">
                승인 안내 →
              </Link>
            ) : null}
          </section>

          <section className="jr-card">
            <span className="eyebrow">Settings</span>
            <form className="form" onSubmit={submit}>
              <div className="field">
                <label htmlFor="display_name">이름</label>
                <input id="display_name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <label className="check">
                <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                매일 아침 7시에 그날의 아티클을 메일로 받기
              </label>
              {me.viewer.kind !== "approved" && me.viewer.kind !== "admin" ? (
                <span className="help muted" style={{ fontSize: 12 }}>
                  메일은 승인된 뒤부터 발송됩니다.
                </span>
              ) : null}
              {saved ? <div className="msg">저장했습니다.</div> : null}
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "저장 중…" : "저장"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <div className="jr-signout">
        <button type="button" className="btn danger" onClick={logout}>
          로그아웃{email ? ` (${email})` : ""}
        </button>
      </div>
    </div>
  );
}
