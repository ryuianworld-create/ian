import Link from "next/link";
import type { ArticleCard, ForbiddenCode, Viewer } from "@/lib/types";
import { longDateKo } from "@/lib/journal";
import { SignupCta } from "./SignupCta";

/** 403 일 때: 제목·출처만 보여주고 가입/승인 안내를 붙인다. */
export function ArticlePreview({ preview, code, viewer }: { preview: ArticleCard; code: ForbiddenCode; viewer: Viewer }) {
  return (
    <div className="jr jr-read" data-lang="ko">
      <div className="jr-issue">
        <span className="eyebrow">
          <Link href="/" className="crumb">
            ← 오늘의 호
          </Link>
          <span className="sep">·</span>
          Back issue · {preview.featured_date}
        </span>
        <span className="jr-date">{longDateKo(preview.featured_date)}</span>
      </div>
      <header className="jr-readhead locked">
        <div className="jr-meta">
          <span className={`kind ${preview.kind}`}>{preview.kind === "paper" ? "논문" : "아티클"}</span>
          {preview.category ? <span className="tag">{preview.category}</span> : null}
          <span className="src">{preview.source_name}</span>
          {preview.published ? (
            <>
              <span className="dot">·</span>
              <span className="src">{preview.published}</span>
            </>
          ) : null}
        </div>
        <h1 className="jr-title">
          <span aria-hidden="true">🔒 </span>
          {preview.title}
        </h1>
        <p className="jr-lockedline">단어 {preview.vocab_count}개 · 요약과 단어장은 가입 후 승인되면 열립니다.</p>
      </header>
      <section className="jr-sub" style={{ marginTop: 10, maxWidth: 760 }}>
        <div className="jr-subcard">
          <span className="eyebrow">Subscribe</span>
          <h2>지난 호는 승인 회원에게 열립니다</h2>
          <p>가입하면 관리자 승인 후 지난 호 전체를 읽고, 매일 아침 7시에 그날의 요약과 단어를 메일로 받습니다.</p>
          <SignupCta code={code} viewer={viewer} compact />
        </div>
      </section>
    </div>
  );
}
