"use client";
/* 단어장. 오늘(최신) 아티클의 단어 → 아티클 선택 가능. "외웠어요" 토글.
   로그인 시 서버 저장(api /v1/vocab/progress), 아니면 localStorage(hrp.known, 1세대와 호환). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { stripTags } from "@/lib/format";
import { KEYS, load, save } from "@/lib/storage";
import { sayWord } from "@/lib/tts";
import type { Article, ArticleCard } from "@/lib/types";
import { useAuth } from "./AuthProvider";

export function VocabView() {
  const router = useRouter();
  const params = useSearchParams();
  const wantArticle = params.get("article");
  const wantWord = params.get("w");
  const { token, ready } = useAuth();

  const [cards, setCards] = useState<ArticleCard[] | null>(null);
  const [articleId, setArticleId] = useState<string | null>(wantArticle);
  const [article, setArticle] = useState<Article | null>(null);
  const [learned, setLearned] = useState<string[]>([]); // 현재 아티클 기준 외운 단어
  const [cumulative, setCumulative] = useState<number>(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrolledTo = useRef<string | null>(null);

  // 1) 아티클 목록 (잠기지 않은 것만 선택 가능)
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    api
      .feed(token)
      .then((f) => {
        if (!alive) return;
        const list = f.items.filter((c) => !c.locked);
        setCards(list);
        setArticleId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [ready, token]);

  // 2) 선택한 아티클 전체 + 진도
  useEffect(() => {
    if (!ready || !articleId) {
      if (ready && cards && !articleId) setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { article: a } = await api.article(articleId, token);
        if (!alive) return;
        setArticle(a);
        if (token) {
          const [mine, all] = await Promise.all([
            api.vocabProgress(a.id, token),
            api.vocabProgress(null, token).catch(() => null),
          ]);
          if (!alive) return;
          setLearned(mine.learned);
          setCumulative(all ? new Set(all.learned).size : mine.learned.length);
        } else {
          const known = load<string[]>(KEYS.known, []);
          const list = Array.isArray(known) ? known : [];
          setLearned(a.vocab.filter((v) => list.includes(v.w)).map((v) => v.w));
          setCumulative(list.length);
        }
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, token, articleId, cards]);

  // 3) ?w= 로 들어오면 해당 카드를 펼치고 스크롤
  useEffect(() => {
    if (!article || !wantWord || scrolledTo.current === wantWord) return;
    const idx = article.vocab.findIndex((v) => v.w === wantWord);
    if (idx < 0) return;
    scrolledTo.current = wantWord;
    setOpen((o) => ({ ...o, [wantWord]: true }));
    window.setTimeout(() => {
      document.getElementById(`v-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }, [article, wantWord]);

  const isKnown = useCallback((w: string) => learned.includes(w), [learned]);

  const setKnown = useCallback(
    async (w: string, value: boolean) => {
      if (!article) return;
      const next = value ? Array.from(new Set([...learned, w])) : learned.filter((x) => x !== w);
      setLearned(next);
      if (token) {
        setCumulative((c) => Math.max(0, c + (value ? 1 : -1)));
        try {
          await api.setVocabProgress({ article_id: article.id, word: w, learned: value }, token);
        } catch (e) {
          setError(errorMessage(e));
          setLearned(learned); // 되돌림
        }
      } else {
        const known = load<string[]>(KEYS.known, []);
        const list = Array.isArray(known) ? known : [];
        const all = value ? Array.from(new Set([...list, w])) : list.filter((x) => x !== w);
        save(KEYS.known, all);
        setCumulative(all.length);
      }
    },
    [article, learned, token],
  );

  const vocab = useMemo(() => article?.vocab ?? [], [article]);
  const done = useMemo(() => vocab.filter((v) => isKnown(v.w)).length, [vocab, isKnown]);

  const pick = (id: string) => {
    setArticleId(id);
    setOpen({});
    router.replace(`/vocab?article=${encodeURIComponent(id)}`, { scroll: false });
  };

  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">{article ? `${article.title.slice(0, 48)} 에서` : " "}</span>
        <h2 className="sec">단어장</h2>
      </div>

      {cards && cards.length > 1 ? (
        <div className="picker">
          <select aria-label="아티클 선택" value={articleId ?? ""} onChange={(e) => pick(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.featured_date} · {c.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="vstats">
        <div className="vstat">
          <div className="n">{vocab.length}</div>
          <div className="lbl">오늘 단어</div>
        </div>
        <div className="vstat done">
          <div className="n">{done}</div>
          <div className="lbl">외움</div>
        </div>
        <div className="vstat">
          <div className="n">{cumulative}</div>
          <div className="lbl">누적</div>
        </div>
      </div>

      {error ? <div className="err">{error}</div> : null}

      {loading && !article ? (
        <div className="note">단어를 불러오는 중입니다…</div>
      ) : !article ? (
        <div className="note">아직 단어가 없습니다.</div>
      ) : (
        <div>
          {vocab.map((item, i) => {
            const k = isKnown(item.w);
            const isOpen = !!open[item.w];
            return (
              <div key={item.w} id={`v-${i}`} className={`card${k ? " known" : ""}${isOpen ? " open" : ""}`}>
                <button
                  type="button"
                  className="card-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [item.w]: !isOpen }))}
                >
                  <span>
                    <span className="term">{item.w}</span>
                    <span className="pos">{item.pos}</span>
                  </span>
                  <span className="chev">{k ? "✓" : "▸"}</span>
                </button>
                {isOpen ? (
                  <div className="card-body">
                    <div className="def-ko">{item.ko}</div>
                    <div className="def-en">{item.en}</div>
                    <div className="ex">
                      <span dangerouslySetInnerHTML={{ __html: item.ex }} />
                      <span className="src">
                        {article.source_name} · {article.published}
                      </span>
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="mini say"
                        aria-label="발음 듣기"
                        onClick={() => sayWord(item.w, stripTags(item.ex))}
                      >
                        🔊
                      </button>
                      <button type="button" className="mini again" onClick={() => setKnown(item.w, false)}>
                        다시 볼래요
                      </button>
                      <button type="button" className="mini yes" onClick={() => setKnown(item.w, true)}>
                        외웠어요
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <p className="note">
        {token
          ? "외운 단어는 계정에 저장되어 다른 기기에서도 이어집니다."
          : "외운 단어는 이 기기에만 저장됩니다. 가입하면 계정에 저장되어 기기 간에 이어집니다."}
      </p>
    </section>
  );
}
