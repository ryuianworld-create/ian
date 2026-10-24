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
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">{counts ? `요약 ${counts.summarized}편 · 수집 ${counts.total}건` : " "}</span>
        <h2 className="sec">서재</h2>
      </div>

      <div className="search">
        <input
          type="search"
          placeholder="제목으로 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="서재 검색"
          autoComplete="off"
        />
      </div>

      {error ? <div className="err" style={{ marginTop: 10 }}>{error}</div> : null}

      {summarized.length ? (
        <>
          <div className="sec-head" style={{ margin: "14px 0 0" }}>
            <span className="eyebrow">요약 완료</span>
          </div>
          <ul className="lib">
            {summarized.map((e) => (
              <li key={e.url}>
                <Link href={`/a/${e.article_id}`} className="row">
                  <span className="date">{shortDate(e.published)}</span>
                  <span>
                    <span className="t">{e.title}</span>
                    <span className="m">
                      {e.source_name}
                      {e.kind === "paper" ? (
                        <>
                          <span className="dot">·</span>논문
                        </>
                      ) : null}
                      <span className="dot">·</span>
                      <span className="ok">요약 읽기 →</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pending.length ? (
        <>
          <div className="sec-head" style={{ margin: "22px 0 0" }}>
            <span className="eyebrow">아직 요약하지 않은 글</span>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            제목을 누르면 원문으로 갑니다. 아침마다 이 중 한 편이 요약됩니다.
          </p>
          <ul className="lib">
            {pending.map((e) => (
              <li key={e.url}>
                <a className="row" href={e.url} target="_blank" rel="noopener noreferrer">
                  <span className="date">{shortDate(e.published)}</span>
                  <span>
                    <span className="t">{e.title}</span>
                    <span className="m">
                      {e.source_name}
                      {e.kind === "paper" ? (
                        <>
                          <span className="dot">·</span>논문
                        </>
                      ) : null}
                    </span>
                  </span>
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
