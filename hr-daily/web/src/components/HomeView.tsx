"use client";
import Link from "next/link";
import type { FeedResponse } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { PaperCard, SourceNote } from "./PaperCard";
import { SignupCta } from "./SignupCta";
import { ViewerBanner } from "./ViewerBanner";
import { useLang } from "./useLang";

export function HomeView({ feed }: { feed: FeedResponse }) {
  const [lang, setLang] = useLang();
  const today = feed.today;
  const past = feed.items.filter((it) => it.id !== today?.id);
  const hasLocked = feed.items.some((it) => it.locked);
  const loggedOut = feed.viewer.kind === "anon";

  return (
    <>
      <ViewerBanner viewer={feed.viewer} />

      <section>
        <div className="sec-head" style={{ marginTop: 20 }}>
          <span className="eyebrow">{today ? `${today.featured_date} · ${today.source_name}` : " "}</span>
          <h2 className="sec">오늘의 아티클</h2>
        </div>
        {today ? (
          <>
            <PaperCard card={today} lang={lang} onLang={setLang} detailAction={{ href: `/a/${today.id}` }} />
            <SourceNote url={today.url} sourceName={today.source_name} />
          </>
        ) : (
          <div className="note">
            <b>아직 요약된 글이 없습니다.</b>
            <br />
            매일 아침 6시(KST)에 한 편이 요약되어 여기에 나타납니다.
          </div>
        )}
      </section>

      <section>
        <div className="sec-head" style={{ marginTop: 30 }}>
          <span className="eyebrow">지난 아티클 · {Math.max(feed.total - (today ? 1 : 0), 0)}편</span>
          <h2 className="sec">지난 아티클</h2>
        </div>
        {past.length ? (
          <ul className="lib">
            {past.map((a) => (
              <li key={a.id} className={a.locked ? "locked" : undefined}>
                <Link href={`/a/${a.id}`} className="row">
                  <span className="date">{shortDate(a.featured_date)}</span>
                  <span>
                    <span className="t">
                      {a.locked ? <span aria-hidden="true">🔒 </span> : null}
                      {a.title}
                    </span>
                    <span className="m">
                      {a.source_name}
                      {a.kind === "paper" ? (
                        <>
                          <span className="dot">·</span>논문
                        </>
                      ) : null}
                      <span className="dot">·</span>
                      {a.locked ? <span className="lock">가입 후 열람</span> : <span className="w">단어 {a.vocab_count}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note" style={{ marginTop: 0 }}>
            지난 아티클이 아직 없습니다.
          </p>
        )}
        {hasLocked || (loggedOut && feed.total > feed.free_limit) ? (
          <SignupCta viewer={feed.viewer} freeLimit={feed.free_limit} />
        ) : null}
      </section>
    </>
  );
}
