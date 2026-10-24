import Link from "next/link";
import type { ArticleCard, ForbiddenCode, Viewer } from "@/lib/types";
import { SignupCta } from "./SignupCta";

/** 403 일 때: 제목·출처만 보여주고 가입/승인 안내를 붙인다. */
export function ArticlePreview({ preview, code, viewer }: { preview: ArticleCard; code: ForbiddenCode; viewer: Viewer }) {
  return (
    <>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">
          {preview.featured_date} · {preview.source_name}
        </span>
        <h2 className="sec">지난 아티클</h2>
      </div>
      <article className="paper" data-lang="ko">
        <div className="paper-top" style={{ paddingBottom: 20 }}>
          <div className="venue">
            {preview.category ? <span className="tag">{preview.category}</span> : null}
            <span>{preview.source_name}</span>
            <span>·</span>
            <span>{preview.published ?? ""}</span>
          </div>
          <h1>
            <span aria-hidden="true">🔒 </span>
            {preview.title}
          </h1>
          <div className="authors">
            <em>단어 {preview.vocab_count}개 · 요약과 단어장은 가입 후 승인되면 열립니다.</em>
          </div>
        </div>
      </article>
      <SignupCta code={code} viewer={viewer} compact />
      <p className="page-note">
        <Link href="/">← 오늘의 아티클로</Link>
      </p>
    </>
  );
}
