"use client";
// 홈 = 오늘의 호(issue). 학술지 느낌의 스프레드 + 지난 호 그리드 + 구독 안내 + 출처 소개.
import Link from "next/link";
import type { Article, ArticleCard, FeedResponse, StatsResponse } from "@/lib/types";
import { SOURCES, longDateEn, longDateKo } from "@/lib/journal";
import { shortDate, stripTags } from "@/lib/format";
import { SignupCta } from "./SignupCta";
import { ViewerBanner } from "./ViewerBanner";
import { LangToggle, useLang } from "./useLang";

type Props = { feed: FeedResponse; stats: StatsResponse | null; today: Article | null };

function KindBadge({ kind }: { kind: ArticleCard["kind"] }) {
  return <span className={`kind ${kind}`}>{kind === "paper" ? "논문" : "아티클"}</span>;
}

export function HomeJournal({ feed, stats, today }: Props) {
  const [lang, setLang] = useLang();
  const card = feed.today;
  const past = feed.items.filter((it) => it.id !== card?.id);
  const hasLocked = feed.items.some((it) => it.locked);
  const loggedOut = feed.viewer.kind === "anon";
  const issueNo = stats?.articles ?? feed.total;
  const vocabPreview = today?.vocab.slice(0, 6) ?? [];

  return (
    <div className="jr" data-lang={lang}>
      <ViewerBanner viewer={feed.viewer} />

      {/* ===== 오늘의 호 ===== */}
      <section className="jr-hero">
        <div className="jr-issue">
          <span className="eyebrow">Today&apos;s issue · No. {issueNo}</span>
          <span className="jr-date">
            <span className="l-ko">{longDateKo(card?.featured_date)}</span>
            <span className="l-en">{longDateEn(card?.featured_date)}</span>
          </span>
        </div>

        {card ? (
          <div className="jr-spread">
            <div className="jr-main">
              <div className="jr-meta">
                <KindBadge kind={card.kind} />
                {card.category ? <span className="tag">{card.category}</span> : null}
                <span className="src">{card.source_name}</span>
                {card.published ? (
                  <>
                    <span className="dot">·</span>
                    <span className="src">{card.published}</span>
                  </>
                ) : null}
              </div>
              <h1 className="jr-title">
                <Link href={`/a/${card.id}`}>{card.title}</Link>
              </h1>

              {card.summary ? (
                <>
                  <div className="jr-sumhead">
                    <span className="eyebrow">{lang === "ko" ? "요약" : "Summary"}</span>
                    <LangToggle lang={lang} onChange={setLang} />
                  </div>
                  <p className="jr-lead l-ko">{stripTags(card.summary.ko)}</p>
                  <p className="jr-lead l-en">{stripTags(card.summary.en)}</p>
                </>
              ) : null}

              {card.findings?.length ? (
                <ul className="jr-stats" aria-label="핵심 수치">
                  {card.findings.slice(0, 3).map((f, i) => (
                    <li key={i}>
                      <span className="k l-ko">{f.k.ko}</span>
                      <span className="k l-en">{f.k.en}</span>
                      <span className="v l-ko">{stripTags(f.ko)}</span>
                      <span className="v l-en">{stripTags(f.en)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="jr-actions">
                <Link href={`/a/${card.id}`} className="btn primary">
                  상세 읽기
                </Link>
                <Link href={`/vocab?article=${encodeURIComponent(card.id)}`} className="btn">
                  단어 {card.vocab_count}개
                </Link>
                <a href={card.url} target="_blank" rel="noopener noreferrer" className="btn ghost">
                  원문 보기 ↗
                </a>
              </div>
            </div>

            <aside className="jr-side">
              {vocabPreview.length ? (
                <div className="jr-box">
                  <div className="jr-boxhead">
                    <span className="eyebrow">오늘의 단어</span>
                    <Link href={`/vocab?article=${encodeURIComponent(card.id)}`} className="more">
                      전체 {today?.vocab.length ?? card.vocab_count}개 →
                    </Link>
                  </div>
                  <ol className="jr-vocab">
                    {vocabPreview.map((v) => (
                      <li key={v.w}>
                        <Link href={`/vocab?article=${encodeURIComponent(card.id)}&w=${encodeURIComponent(v.w)}`}>
                          <span className="w">{v.w}</span>
                          <span className="pos">{v.pos}</span>
                          <span className="ko">{v.ko.split(" — ")[0]}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="jr-box soft">
                <span className="eyebrow">읽는 방법</span>
                <ul className="jr-tips">
                  <li>
                    <b>한글 ⇄ ENG</b> 같은 내용을 두 언어로. 토글은 기억됩니다.
                  </li>
                  <li>
                    <b>읽어주기</b> 상세 화면에서 문장 단위로 들려줍니다.
                  </li>
                  <li>
                    <b>점선 단어</b> 누르면 뜻·발음, 바로 단어장으로.
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        ) : (
          <div className="note">
            <b>아직 요약된 글이 없습니다.</b>
            <br />
            매일 아침 6시(KST)에 한 편이 요약되어 여기에 나타납니다.
          </div>
        )}
      </section>

      {/* ===== 통계 띠 ===== */}
      <section className="jr-strip" aria-label="현황">
        <div>
          <span className="n">{issueNo}</span>
          <span className="l">호 발행</span>
        </div>
        <div>
          <span className="n">{stats?.vocab ?? "—"}</span>
          <span className="l">학습 단어</span>
        </div>
        <div>
          <span className="n">{stats?.index?.toLocaleString() ?? "—"}</span>
          <span className="l">서재에 모인 글</span>
        </div>
        <div>
          <span className="n">{SOURCES.length}</span>
          <span className="l">학술지·매체</span>
        </div>
      </section>

      {/* ===== 지난 호 ===== */}
      <section className="jr-archive">
        <div className="jr-sechead">
          <div>
            <span className="eyebrow">Back issues</span>
            <h2 className="sec">지난 호</h2>
          </div>
          <Link href="/library" className="more">
            서재 전체 보기 →
          </Link>
        </div>
        {past.length ? (
          <ul className="jr-grid">
            {past.map((a) => (
              <li key={a.id} className={a.locked ? "locked" : undefined}>
                <Link href={`/a/${a.id}`}>
                  <div className="top">
                    <span className="d">{shortDate(a.featured_date)}</span>
                    <KindBadge kind={a.kind} />
                  </div>
                  <h3>{a.title}</h3>
                  <div className="foot">
                    <span>{a.source_name}</span>
                    {a.locked ? <span className="lock">🔒 가입 후 열람</span> : <span>단어 {a.vocab_count}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note" style={{ marginTop: 0 }}>
            지난 호가 아직 없습니다.
          </p>
        )}
      </section>

      {/* ===== 구독 안내 ===== */}
      {hasLocked || (loggedOut && feed.total > feed.free_limit) ? (
        <section className="jr-sub">
          <div className="jr-subcard">
            <span className="eyebrow">Subscribe</span>
            <h2>매일 아침 7시, HR 연구 한 편을 메일로</h2>
            <p>
              비로그인으로 최신 {feed.free_limit}편을 읽을 수 있습니다. 가입하고 관리자 승인을 받으면 지난 호 전체가
              열리고, 그날의 요약과 단어가 아침 메일로 옵니다. 단어 진도는 기기 간에 이어집니다.
            </p>
            <SignupCta viewer={feed.viewer} freeLimit={feed.free_limit} compact />
          </div>
        </section>
      ) : null}

      {/* ===== 출처 ===== */}
      <section className="jr-sources">
        <div className="jr-sechead">
          <div>
            <span className="eyebrow">Sources</span>
            <h2 className="sec">이런 출처를 읽습니다</h2>
          </div>
        </div>
        <ul className="jr-srcgrid">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <a href={s.home} target="_blank" rel="noopener noreferrer">
                <KindBadge kind={s.kind} />
                <b>{s.name}</b>
                <span>{s.desc}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== 운영 흐름 ===== */}
      <section className="jr-how" aria-label="매일 이렇게 돌아갑니다">
        <div className="jr-sechead">
          <div>
            <span className="eyebrow">Every morning</span>
            <h2 className="sec">매일 이렇게 돌아갑니다</h2>
          </div>
        </div>
        <ol className="jr-steps">
          <li>
            <span className="t">05:30</span>
            <b>수집</b>
            <span>학술지·매체 피드에서 새 글을 모읍니다. 화·금은 논문을 먼저 고릅니다.</span>
          </li>
          <li>
            <span className="t">06:00</span>
            <b>요약</b>
            <span>한 편을 골라 한글·영문 요약, 핵심 수치, 단어장을 만듭니다.</span>
          </li>
          <li>
            <span className="t">07:00</span>
            <b>배달</b>
            <span>승인 회원에게 메일로 보냅니다. 앱에서는 읽어주기와 단어 복습을 이어갑니다.</span>
          </li>
        </ol>
      </section>

      <footer className="jr-foot">
        <div>
          <b>DailyHR</b> · 하루 한 편, HR 아티클·논문
        </div>
        <div className="small">
          원문은 저장하지 않습니다. 요약·단어 정의·예문은 직접 작성한 것이며 각 글에 원문 링크를 붙입니다.
        </div>
        <div className="links">
          <Link href="/library">서재</Link>
          <Link href="/vocab">단어장</Link>
          <Link href={loggedOut ? "/login" : "/account"}>{loggedOut ? "로그인" : "내 정보"}</Link>
        </div>
      </footer>
    </div>
  );
}
