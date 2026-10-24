"use client";
/* 관리자: 대시보드, 대기 회원 승인/거절, 전체 회원, inbox, 잡 즉시 실행(결과 로그). admin 이 아니면 / 로. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, isMock } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { AdminOverview, InboxItem, JobName, JobRun, Profile } from "@/lib/types";
import { useAuth } from "./AuthProvider";

const JOBS: { job: JobName; label: string; desc: string }[] = [
  { job: "collect", label: "지금 수집", desc: "학술지·매체 피드 → 대기열" },
  { job: "summarize", label: "지금 요약", desc: "오늘 한 편 선정 → Gemini 요약" },
  { job: "digest", label: "지금 메일", desc: "승인 회원에게 발송" },
];

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

function logText(run: JobRun): string {
  const parts: string[] = [];
  parts.push(`[${run.job}] ${run.ok === null ? "실행 중" : run.ok ? "성공" : "실패"} · ${fmt(run.started_at)} → ${fmt(run.finished_at)}`);
  if (run.error) parts.push(`error: ${run.error}`);
  if (Array.isArray(run.log)) parts.push(...run.log.map(String));
  else if (typeof run.log === "string") parts.push(run.log);
  else if (run.log) parts.push(JSON.stringify(run.log, null, 2));
  return parts.join("\n");
}

export function AdminView() {
  const router = useRouter();
  const { ready, token } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [pending, setPending] = useState<Profile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [inboxStatus, setInboxStatus] = useState("pending");
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [running, setRunning] = useState<JobName | null>(null);
  const [lastRun, setLastRun] = useState<JobRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "users" | "inbox" | "runs">("pending");

  const reload = useCallback(async () => {
    if (!token) return;
    const [ov, pend, all, inb, rn] = await Promise.all([
      api.admin.overview(token),
      api.admin.users(token, "pending"),
      api.admin.users(token),
      api.admin.inbox(token, inboxStatus, 50),
      api.admin.runs(token, undefined, 20),
    ]);
    setOverview(ov);
    setPending(pend.users);
    setUsers(all.users);
    setInbox(inb.items);
    setRuns(rn.runs);
  }, [token, inboxStatus]);

  // 권한 확인
  useEffect(() => {
    if (!ready) return;
    if (isMock) {
      setAllowed(false);
      return;
    }
    if (!token) {
      router.replace("/login?next=/admin");
      return;
    }
    let alive = true;
    api
      .me(token)
      .then((m) => {
        if (!alive) return;
        if (m.viewer.kind !== "admin") router.replace("/");
        else setAllowed(true);
      })
      .catch(() => alive && router.replace("/"));
    return () => {
      alive = false;
    };
  }, [ready, token, router]);

  useEffect(() => {
    if (!allowed) return;
    reload().catch((e) => setError(errorMessage(e)));
  }, [allowed, reload]);

  const act = async (id: string, kind: "approve" | "reject") => {
    if (!token) return;
    let note: string | undefined;
    if (kind === "reject") {
      const v = window.prompt("거절 사유 (선택). 회원 메모로 남습니다.", "");
      if (v === null) return;
      note = v.trim() || undefined;
    }
    setBusyUser(id);
    setError(null);
    try {
      if (kind === "approve") await api.admin.approve(id, token);
      else await api.admin.reject(id, note, token);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyUser(null);
    }
  };

  const runJob = async (job: JobName) => {
    if (!token || running) return;
    setRunning(job);
    setError(null);
    setLastRun(null);
    try {
      const { run } = await api.admin.runJob(job, token);
      setLastRun(run);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(null);
    }
  };

  if (isMock) {
    return (
      <div className="note" style={{ marginTop: 18 }}>
        <b>모의 모드</b>에서는 관리자 기능을 사용할 수 없습니다. <code>NEXT_PUBLIC_API_URL</code> 과 Supabase 환경변수를
        설정하고 관리자 계정으로 로그인하세요. <Link href="/">← 오늘의 아티클로</Link>
      </div>
    );
  }
  if (allowed === null) {
    return <div className="note" style={{ marginTop: 18 }}>권한을 확인하는 중입니다…</div>;
  }

  const runState = (j: JobName) => {
    const r = overview?.last_runs?.[j];
    if (!r) return { text: "기록 없음", cls: "" };
    if (r.ok === null) return { text: `실행 중 · ${fmt(r.started_at)}`, cls: "" };
    return { text: `${r.ok ? "성공" : "실패"} · ${fmt(r.finished_at ?? r.started_at)}`, cls: r.ok ? "ok" : "bad" };
  };

  return (
    <div className="jr-admin">
      {error ? <div className="err" style={{ marginTop: 14 }}>{error}</div> : null}

      {/* 대시보드 */}
      <div className="jr-strip" aria-label="현황">
        <div>
          <span className="n">{overview?.users.total ?? "—"}</span>
          <span className="l">회원</span>
        </div>
        <div>
          <span className={`n${(overview?.users.pending ?? 0) > 0 ? " accent" : ""}`}>{overview?.users.pending ?? "—"}</span>
          <span className="l">승인 대기</span>
        </div>
        <div>
          <span className="n">{overview?.articles ?? "—"}</span>
          <span className="l">발행 호</span>
        </div>
        <div>
          <span className="n">{overview?.inbox_pending ?? "—"}</span>
          <span className="l">요약 대기열</span>
        </div>
      </div>

      {/* 운영 */}
      <div className="jr-sechead">
        <div>
          <span className="eyebrow">Operations</span>
          <h2 className="sec">즉시 실행</h2>
        </div>
        <span className="jr-hint">다음 발행일 {overview?.next_featured_date ?? "—"}</span>
      </div>
      <ul className="jr-jobs">
        {JOBS.map((j) => {
          const st = runState(j.job);
          return (
            <li key={j.job}>
              <div className="top">
                <b>{j.label}</b>
                <span className="desc">{j.desc}</span>
              </div>
              <div className={`last ${st.cls}`}>마지막 실행 · {st.text}</div>
              <button type="button" className="btn primary" disabled={!!running} onClick={() => runJob(j.job)}>
                {running === j.job ? "실행 중…" : j.label}
              </button>
            </li>
          );
        })}
      </ul>
      {lastRun ? <pre className="log">{logText(lastRun)}</pre> : null}

      {/* 목록 */}
      <div className="jr-sechead" style={{ marginBottom: 4 }}>
        <div>
          <span className="eyebrow">Records</span>
          <h2 className="sec">회원과 대기열</h2>
        </div>
      </div>
      <div className="subtabs">
        <button type="button" aria-pressed={tab === "pending"} onClick={() => setTab("pending")}>
          대기 {pending.length}
        </button>
        <button type="button" aria-pressed={tab === "users"} onClick={() => setTab("users")}>
          전체 회원 {users.length}
        </button>
        <button type="button" aria-pressed={tab === "inbox"} onClick={() => setTab("inbox")}>
          inbox {inbox.length}
        </button>
        <button type="button" aria-pressed={tab === "runs"} onClick={() => setTab("runs")}>
          실행 기록
        </button>
      </div>

      {tab === "pending" ? (
        pending.length ? (
          <ul className="ulist">
            {pending.map((u) => (
              <li key={u.id}>
                <div className="who">
                  <div className="e">
                    {u.email}
                    {u.display_name ? ` · ${u.display_name}` : ""}
                  </div>
                  <div className="d">가입 {fmt(u.created_at)}</div>
                </div>
                <div className="acts">
                  <button type="button" className="btn sm primary" disabled={busyUser === u.id} onClick={() => act(u.id, "approve")}>
                    승인
                  </button>
                  <button type="button" className="btn sm danger" disabled={busyUser === u.id} onClick={() => act(u.id, "reject")}>
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">대기 중인 회원이 없습니다.</p>
        )
      ) : null}

      {tab === "users" ? (
        <ul className="ulist">
          {users.map((u) => (
            <li key={u.id}>
              <div className="who">
                <div className="e">
                  {u.email}
                  {u.display_name ? ` · ${u.display_name}` : ""}
                </div>
                <div className="d">
                  가입 {fmt(u.created_at)}
                  {u.approved_at ? ` · 승인 ${fmt(u.approved_at)}` : ""}
                  {u.note ? ` · ${u.note}` : ""}
                  {u.email_opt_in ? "" : " · 메일 수신 안 함"}
                </div>
              </div>
              <span className={`pill ${u.role === "admin" ? "admin" : u.status}`}>{u.role === "admin" ? "admin" : u.status}</span>
              {u.status !== "approved" ? (
                <div className="acts">
                  <button type="button" className="btn sm" disabled={busyUser === u.id} onClick={() => act(u.id, "approve")}>
                    승인
                  </button>
                </div>
              ) : u.role !== "admin" ? (
                <div className="acts">
                  <button type="button" className="btn sm danger" disabled={busyUser === u.id} onClick={() => act(u.id, "reject")}>
                    거절
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "inbox" ? (
        <>
          <div className="subtabs">
            {["pending", "done", "failed", "skipped"].map((s) => (
              <button key={s} type="button" aria-pressed={inboxStatus === s} onClick={() => setInboxStatus(s)}>
                {s}
              </button>
            ))}
          </div>
          {inbox.length ? (
            <ul className="ulist">
              {inbox.map((it) => (
                <li key={it.id}>
                  <div className="who">
                    <div className="e">
                      <a href={it.url} target="_blank" rel="noopener noreferrer">
                        {it.title}
                      </a>
                    </div>
                    <div className="d">
                      {it.source_name ?? it.source_id ?? ""} · {it.kind}
                      {typeof it.score === "number" ? ` · score ${it.score}` : ""}
                      {it.published ? ` · ${it.published}` : ""}
                      {it.error ? ` · ${it.error}` : ""}
                    </div>
                  </div>
                  <span className={`pill ${it.status}`}>{it.status}</span>
                  {it.status === "pending" ? (
                    <div className="acts">
                      <button
                        type="button"
                        className="btn sm"
                        disabled={!!running}
                        onClick={async () => {
                          if (!token) return;
                          setRunning("summarize");
                          setError(null);
                          try {
                            const { run } = await api.admin.runJob("summarize", token, { inbox_id: it.id });
                            setLastRun(run);
                            await reload();
                          } catch (e) {
                            setError(errorMessage(e));
                          } finally {
                            setRunning(null);
                          }
                        }}
                      >
                        이 글 요약
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="note">해당 상태의 inbox 항목이 없습니다.</p>
          )}
        </>
      ) : null}

      {tab === "runs" ? (
        runs.length ? (
          <ul className="ulist">
            {runs.map((r) => (
              <li key={r.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`pill ${r.ok === null ? "" : r.ok ? "approved" : "pending"}`}>{r.job}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>
                    {fmt(r.started_at)}
                  </span>
                  <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setLastRun(r)}>
                    로그
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">실행 기록이 없습니다.</p>
        )
      ) : null}
    </div>
  );
}
