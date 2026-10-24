"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Article } from "@/lib/types";
import { stripTags } from "@/lib/format";
import { PaperCard, SourceNote } from "./PaperCard";
import { useLang } from "./useLang";
import { ReadBar, useReadAloud } from "./useReadAloud";
import { WordPopup, useWordPopup } from "./WordPopup";

function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 상세 섹션 HTML. 1세대와 같은 구조(h3 + .l-ko/.l-en) 라서 읽어주기 이식이 그대로 맞는다. */
function detailHtml(article: Article): string {
  return article.detail
    .map(
      (s) =>
        `<h3><span class="l-ko">${esc(s.h.ko)}</span><span class="l-en">${esc(s.h.en)}</span></h3>` +
        `<div class="l-ko">${s.body.ko}</div><div class="l-en">${s.body.en}</div>`,
    )
    .join("");
}

export function ArticleView({ article }: { article: Article }) {
  const router = useRouter();
  const [lang, setLang] = useLang();
  const [open, setOpen] = useState(true);
  const detailRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => detailHtml(article), [article]);
  const tts = useReadAloud(detailRef, lang, article.id);
  const pop = useWordPopup(detailRef, article.vocab);

  const toggleDetail = () => {
    const next = !open;
    setOpen(next);
    if (!next) tts.stop();
  };
  useEffect(() => {
    if (!open) pop.close();
  }, [open, pop]);

  return (
    <>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">
          {article.featured_date} · {article.source_name}
        </span>
        <h2 className="sec">{article.kind === "paper" ? "오늘의 논문" : "오늘의 아티클"}</h2>
      </div>

      <PaperCard
        card={{ ...article, vocab_count: article.vocab.length }}
        lang={lang}
        onLang={setLang}
        detailAction={article.detail.length ? { onClick: toggleDetail, open } : null}
      >
        {article.detail.length ? (
          <div className="detail" id="detail" hidden={!open}>
            <div className="detail-in">
              <ReadBar
                lang={lang}
                ui={tts.ui}
                onToggle={tts.toggle}
                onStop={tts.stop}
                onRate={tts.setRate}
                onVoice={tts.setVoice}
              />
              <div ref={detailRef} dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        ) : null}
      </PaperCard>

      <SourceNote url={article.url} sourceName={article.source_name} />

      {pop.popup ? (
        <WordPopup
          item={pop.popup.item}
          anchor={pop.popup.anchor}
          onSay={() => tts.sayWord(pop.popup!.item.w, stripTags(pop.popup!.item.ex))}
          onGo={() => {
            const w = pop.popup!.item.w;
            pop.close();
            router.push(`/vocab?article=${encodeURIComponent(article.id)}&w=${encodeURIComponent(w)}`);
          }}
          onEnter={pop.keepOpen}
          onLeave={pop.scheduleClose}
        />
      ) : null}
    </>
  );
}
