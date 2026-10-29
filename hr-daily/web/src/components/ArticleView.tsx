"use client";
// 상세 = 저널 읽기 화면. 왼쪽 읽기 칼럼(요약·핵심 수치·본문) + 오른쪽 사이드바(목차·단어·원문).
import Link from "next/link";
import { TEAMS } from "@/lib/teams";
import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Article } from "@/lib/types";
import { stripTags } from "@/lib/format";
import { longDateEn, longDateKo } from "@/lib/journal";
import { LangToggle, useLang } from "./useLang";
import { ReadBar, useReadAloud } from "./useReadAloud";
import { WordPopup, useWordPopup } from "./WordPopup";

function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 상세 섹션 HTML. 1세대와 같은 구조(h3 + .l-ko/.l-en) 라서 읽어주기·단어 툴팁 이식이 그대로 맞는다. h3 에 목차용 id 를 단다. */
function detailHtml(article: Article): string {
  return article.detail
    .map(
      (s, i) =>
        `<h3 id="sec-${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="l-ko">${esc(s.h.ko)}</span><span class="l-en">${esc(s.h.en)}</span></h3>` +
        `<div class="l-ko">${s.body.ko}</div><div class="l-en">${s.body.en}</div>`,
    )
    .join("");
}

export function ArticleView({ article }: { article: Article }) {
  const router = useRouter();
  const [lang, setLang] = useLang();
  const detailRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => detailHtml(article), [article]);
  const tts = useReadAloud(detailRef, lang, article.id);
  const pop = useWordPopup(detailRef, article.vocab);
  const vocabHref = (w?: string) =>
    `/vocab?article=${encodeURIComponent(article.id)}${w ? `&w=${encodeURIComponent(w)}` : ""}`;

  return (
    <div className="jr jr-read" data-lang={lang}>
      <div className="jr-issue">
        <span className="eyebrow">
          <Link href="/" className="crumb">
            ← 오늘의 호
          </Link>
          <span className="sep">·</span>
          Issue · {article.featured_date}
        </span>
        <span className="jr-date">
          <span className="l-ko">{longDateKo(article.featured_date)}</span>
          <span className="l-en">{longDateEn(article.featured_date)}</span>
        </span>
      </div>

      <header className="jr-readhead">
        <div className="jr-meta">
          <span className={`kind ${article.kind}`}>{article.kind === "paper" ? "논문" : "아티클"}</span>
          {article.team ? (
            <span className="tag team" style={{ background: TEAMS[article.team].soft, color: TEAMS[article.team].color, borderColor: TEAMS[article.team].color }}>
              {TEAMS[article.team].team} · {TEAMS[article.team].cat}
            </span>
          ) : null}
          {article.category ? <span className="tag">{article.category}</span> : null}
          <span className="src">{article.source_name}</span>
          {article.published ? (
            <>
              <span className="dot">·</span>
              <span className="src">{article.published}</span>
            </>
          ) : null}
        </div>
        <h1 className="jr-title">{article.title}</h1>
        <div className="jr-actions">
          <Link href={vocabHref()} className="btn primary">
            단어 {article.vocab.length}개 외우기
          </Link>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn">
            원문 보기 ↗
          </a>
        </div>
      </header>

      <div className="jr-readgrid">
        <article className="jr-readmain">
          <div className="jr-sumhead">
            <span className="eyebrow">{lang === "ko" ? "요약" : "Summary"}</span>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <p className="jr-lead l-ko">{stripTags(article.summary.ko)}</p>
          <p className="jr-lead l-en">{stripTags(article.summary.en)}</p>

          {article.findings.length ? (
            <ul className="jr-stats" aria-label="핵심 수치" data-n={Math.min(article.findings.length, 4)}>
              {article.findings.slice(0, 4).map((f, i) => (
                <li key={i}>
                  <span className={`k l-ko${f.k.ko.length > 6 ? " long" : ""}`}>{f.k.ko}</span>
                  <span className={`k l-en${f.k.en.length > 8 ? " long" : ""}`}>{f.k.en}</span>
                  <span className="v l-ko">{stripTags(f.ko)}</span>
                  <span className="v l-en">{stripTags(f.en)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {article.detail.length ? (
            <section className="jr-body" aria-label="상세">
              <div className="jr-sumhead">
                <span className="eyebrow">{lang === "ko" ? "상세" : "In depth"}</span>
              </div>
              <ReadBar
                lang={lang}
                ui={tts.ui}
                onToggle={tts.toggle}
                onStop={tts.stop}
                onRate={tts.setRate}
                onVoice={tts.setVoice}
              />
              <div ref={detailRef} className="jr-detail" dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          ) : null}

          <p className="jr-srcnote">
            원문은 저장하지 않습니다. 위 요약과 단어는 이 글을 읽고 작성한 것이며, 전문은{" "}
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              {article.source_name} 원문
            </a>
            에서 보세요.
          </p>
        </article>

        <aside className="jr-readside">
          {article.detail.length ? (
            <nav className="jr-box soft" aria-label="목차">
              <span className="eyebrow">{lang === "ko" ? "목차" : "Contents"}</span>
              <ol className="jr-toc">
                {article.detail.map((s, i) => (
                  <li key={i}>
                    <a href={`#sec-${i}`}>
                      <span className="num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="l-ko">{s.h.ko}</span>
                      <span className="l-en">{s.h.en}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="jr-box">
            <div className="jr-boxhead">
              <span className="eyebrow">{lang === "ko" ? "이 글의 단어" : "Vocabulary"}</span>
              <Link href={vocabHref()} className="more">
                단어장 →
              </Link>
            </div>
            <ol className="jr-vocab">
              {article.vocab.map((v) => (
                <li key={v.w}>
                  <Link href={vocabHref(v.w)}>
                    <span className="w">{v.w}</span>
                    <span className="pos">{v.pos}</span>
                    <span className="ko">{v.ko.split(" — ")[0]}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="jr-box soft">
            <span className="eyebrow">읽는 방법</span>
            <ul className="jr-tips">
              <li>
                <b>읽어주기</b> 문장 단위로 들려주고, 문장을 누르면 거기서부터 읽습니다.
              </li>
              <li>
                <b>점선 단어</b> 누르면 뜻·발음, 바로 단어장으로.
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {pop.popup ? (
        <WordPopup
          item={pop.popup.item}
          anchor={pop.popup.anchor}
          onSay={() => tts.sayWord(pop.popup!.item.w, stripTags(pop.popup!.item.ex))}
          onGo={() => {
            const w = pop.popup!.item.w;
            pop.close();
            router.push(vocabHref(w));
          }}
          onEnter={pop.keepOpen}
          onLeave={pop.scheduleClose}
        />
      ) : null}
    </div>
  );
}
