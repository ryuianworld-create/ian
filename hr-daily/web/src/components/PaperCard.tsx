"use client";
// 「오늘의 아티클」 카드. 1세대 .paper 카드의 React 판.
// 홈에서는 ArticleCard(요약·핵심 수치만), 상세 화면에서는 Article(상세 포함) 을 받는다.
import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleCard, Finding, Lang } from "@/lib/types";
import { LangToggle, type UiLang } from "./useLang";

type Props = {
  card: Pick<ArticleCard, "id" | "source_name" | "kind" | "title" | "url" | "published" | "category" | "vocab_count"> & {
    summary?: Lang;
    findings?: Finding[];
  };
  lang: UiLang;
  onLang: (v: UiLang) => void;
  /** 상세 보기 버튼: 링크(홈) 또는 토글(상세 화면) */
  detailAction?: { href: string } | { onClick: () => void; open: boolean } | null;
  children?: ReactNode; // 카드 하단에 붙는 상세 영역
};

export function PaperCard({ card, lang, onLang, detailAction, children }: Props) {
  const findings = card.findings ?? [];
  return (
    <article className="paper" data-lang={lang} id="paperCard">
      <div className="paper-top">
        <div className="venue">
          {card.category ? <span className="tag">{card.category}</span> : null}
          {card.kind === "paper" ? <span className="tag">논문</span> : null}
          <span>{card.source_name}</span>
          <span>·</span>
          <span>{card.published ?? ""}</span>
        </div>
        <h1>{card.title}</h1>
      </div>

      {card.summary ? (
        <>
          <div className="toggle-row">
            <span className="eyebrow">요약</span>
            <LangToggle lang={lang} onChange={onLang} />
          </div>
          <div className="summary">
            <p className="l-ko" dangerouslySetInnerHTML={{ __html: card.summary.ko }} />
            <p className="l-en" dangerouslySetInnerHTML={{ __html: card.summary.en }} />
            {findings.length ? (
              <ul className="findings">
                {findings.map((f, i) => (
                  <li key={i}>
                    <span className="k l-ko">{f.k.ko}</span>
                    <span className="k l-en">{f.k.en}</span>
                    <span className="v l-ko" dangerouslySetInnerHTML={{ __html: f.ko }} />
                    <span className="v l-en" dangerouslySetInnerHTML={{ __html: f.en }} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="paper-foot">
        {detailAction && "href" in detailAction ? (
          <Link href={detailAction.href} className="btn primary">
            상세 보기
          </Link>
        ) : detailAction && "onClick" in detailAction ? (
          <button type="button" className="btn primary" onClick={detailAction.onClick}>
            {detailAction.open ? "접기" : "상세 보기"}
          </button>
        ) : null}
        <Link href={`/vocab?article=${encodeURIComponent(card.id)}`} className="btn">
          단어 {card.vocab_count}개 <span style={{ opacity: 0.6 }}>→</span>
        </Link>
      </div>

      {children}
    </article>
  );
}

export function SourceNote({ url, sourceName }: { url: string; sourceName: string }) {
  return (
    <div className="note">
      원문은 저장하지 않습니다. 위 요약과 단어는 이 글을 읽고 작성한 것이며, 전문은{" "}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {sourceName} 원문
      </a>
      에서 보세요.
    </div>
  );
}
