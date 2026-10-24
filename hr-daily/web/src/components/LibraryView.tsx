"use client";
/* 서재: 요약 완료 글(앱 링크) + 수집 목록(원문 링크). 검색(q) + 무한 스크롤(cursor). */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { shortDate } from "@/lib/format";
import type { IndexItem } from "@/lib/types";

export function LibraryView() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<IndexItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ summarized: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // 검색어 디바운스
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(async (qq: string, cur: string | null) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.library({ q: qq, cursor: cur, limit: 50 });
      if (id !== reqId.current) return;
      setItems((prev) => (cur ? [...prev, ...res.items] : res.items));
      setCursor(res.next_cursor);
      setDone(!res.next_cursor);
      setCounts({ summarized: res.summarized_count, total: res.total });
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // 검색어가 바뀌면 처음부터
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setDone(false);
    fetchPage(query, null);
  }, [query, fetchPage]);

  // 무한 스크롤
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting) && !loading && cursor) fetchPage(query, cursor);
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, done, loading, query, fetchPage]);

  const summarized = items.filter((e) => e.article_id);
  const pending = items.filter((e) => !e.article_id);

  return (
    <section className="jr jr-page">
      <div className="jr-issue">
        <span className="eyebrow">Library</span>
        <span className="jr-date">{counts ? `요약 ${counts.summarized}편 · 수집 ${counts.total.toLocaleString()}건` : " "}</span>
      </div>
      <div className="jr-pagehead">
        <h1 className="jr-h1">서재</h1>
        <p className="jr-sub-line">학술지와 매체에서 모은 글 전체입니다. 요약된 글은 앱에서, 나머지는 원문으로 열립니다.</p>
        <div className="jr-search">
          <input
            type="search"
            placeholder="제목으로 검색 — 예: retention, AI, onboarding"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="서재 검색"
            autoComplete="off"
          />
        </div>
      </div>

      {error ? <div className="err" style={{ marginTop: 10 }}>{error}</div> : null}

      {summarized.length ? (
        <>
          <div className="jr-sechead">
            <div>
              <span className="eyebrow">Summarized</span>
              <h2 className="sec">요약 완료</h2>
            </div>
          </div>
          <ul className="jr-grid">
            {summarized.map((e) => (
              <li key={e.url}>
                <Link href={`/a/${e.article_id}`}>
                  <div className="top">
                    <span className="d">{shortDate(e.published)}</span>
                    <span className={`kind ${e.kind}`}>{e.kind === "paper" ? "논문" : "아티클"}</span>
                  </div>
                  <h3>{e.title}</h3>
                  <div className="foot">
                    <span>{e.source_name}</span>
                    <span className="ok">요약 읽기 →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pending.length ? (
        <>
          <div className="jr-sechead">
            <div>
              <span className="eyebrow">Collected</span>
              <h2 className="sec">아직 요약하지 않은 글</h2>
            </div>
            <span className="jr-hint">아침마다 이 중 한 편이 요약됩니다</span>
          </div>
          <ul className="jr-rows">
            {pending.map((e) => (
              <li key={e.url}>
                <a href={e.url} target="_blank" rel="noopener noreferrer">
                  <span className="d">{shortDate(e.published)}</span>
                  <span className={`kind ${e.kind}`}>{e.kind === "paper" ? "논문" : "아티클"}</span>
                  <span className="t">{e.title}</span>
                  <span className="s">{e.source_name}</span>
                  <span className="arrow">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!loading && !items.length && !error ? (
        <p className="note">{query ? `"${query}" 에 맞는 글이 없습니다.` : "수집된 글이 아직 없습니다."}</p>
      ) : null}

      <div ref={sentinel} style={{ height: 1 }} />
      {loading ? (
        <p className="note" style={{ marginTop: 14 }}>
          불러오는 중…
        </p>
      ) : done && items.length ? (
        <p className="muted mono" style={{ fontSize: 11, textAlign: "center", marginTop: 18 }}>
          — 끝 —
        </p>
      ) : null}
    </section>
  );
}
