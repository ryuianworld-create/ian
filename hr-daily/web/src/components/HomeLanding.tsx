"use client";
// 홈 — 밝은 페이퍼 배경·흰 라운드 카드·따뜻한 노랑(#FFC800)·Pretendard 의 랜딩 톤 (제미나이 시안 참조, 2026-10-27 확정).
// 이전 저널 톤 홈(HomeJournal)은 git 태그 design-a-journal 에 있다.
// 시안의 목업 콘텐츠(가짜 수치·후기·알림톡)는 쓰지 않고, 피드·통계·오늘 글의 실제 데이터만 보여준다.
import Link from "next/link";
import { useState } from "react";
import type { ArticleCard, FeedResponse, StatsResponse } from "@/lib/types";
import { SOURCES, longDateKo, longDateEn } from "@/lib/journal";
import { shortDate, stripTags } from "@/lib/format";
import { KakaoButton } from "./KakaoButton";
import { PushToggle } from "./PushToggle";
import { ViewerBanner } from "./ViewerBanner";
import { LangToggle, useLang } from "./useLang";

type Props = { feed: FeedResponse; stats: StatsResponse | null };
type Filter = "all" | "paper" | "article";

function excerpt(html: string, n: number): string {
  const t = stripTags(html).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
}

function KindPill({ kind }: { kind: ArticleCard["kind"] }) {
  return kind === "paper" ? (
    <span className="inline-block text-[11px] font-black text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full">논문</span>
  ) : (
    <span className="inline-block text-[11px] font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-full">아티클</span>
  );
}

const Icon = {
  check: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M12 4h6.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H12" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

export function HomeLanding({ feed, stats }: Props) {
  const [lang, setLang] = useLang();
  const [filter, setFilter] = useState<Filter>("all");

  const card = feed.today;
  const past = feed.items.filter((it) => it.id !== card?.id);
  const shown = past.filter((a) => filter === "all" || a.kind === filter);
  const viewer = feed.viewer;
  const anon = viewer.kind === "anon";
  const full = viewer.kind === "approved" || viewer.kind === "admin";
  const issueNo = stats?.articles ?? feed.total;
  const vocabCount = card?.vocab_count ?? 0;
  const findings = (card?.findings ?? []).slice(0, 2);

  return (
    <div className="ld" data-lang={lang}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ViewerBanner viewer={viewer} />
      </div>

      {/* ================= HERO ================= */}
      <section className="relative pt-10 pb-16 lg:pt-16 lg:pb-24 overflow-hidden">
        <div className="absolute -top-32 right-1/4 w-[500px] h-[500px] bg-brand/25 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] bg-amber-100/70 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* ---- 왼쪽: 카피 + 시작 카드 ---- */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-amber-100/90 border border-amber-300 text-amber-950 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span>
                  매일 아침 7시 발행 · 오늘 No. {issueNo} · 학술지 {SOURCES.filter((s) => s.kind === "paper").length}종 · 매체{" "}
                  {SOURCES.filter((s) => s.kind === "article").length}곳
                </span>
              </div>

              <h1 className="m-0 text-3xl sm:text-5xl font-black tracking-tight text-ink leading-[1.2]">
                하루 한 편, HR 논문·아티클을
                <br />
                <span className="ld-mark mt-1">
                  <span className="relative z-10">출근길 3분 루틴으로</span>
                </span>
              </h1>

              <p className="m-0 text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
                학술지 3종과 매체 3곳에서 꼭 읽어야 할 글을 골라 <strong className="text-ink">한글·영문 요약</strong>, 핵심 수치,
                본문 속 <strong className="text-ink">HR 단어장</strong>으로 정리합니다. 비로그인으로 최신 {feed.free_limit}편을 읽을
                수 있고, 가입 승인 후에는 지난 호 전체와 매일 아침 메일이 열립니다.
              </p>

              {/* 시작 카드 */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-brand shadow-soft">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                  <span className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <span className="text-brand-dark">{Icon.bolt}</span> {full ? "오늘 바로 이어서" : "3초면 시작합니다"}
                  </span>
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    100% 무료
                  </span>
                </div>

                {full ? (
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {card ? (
                      <Link
                        href={`/a/${card.id}`}
                        className="flex-1 no-underline bg-brand hover:bg-brand-dark/90 text-ink! font-black px-6 py-3.5 rounded-2xl shadow-glow text-center text-base transition-all hover:-translate-y-0.5"
                      >
                        오늘 글 읽기 →
                      </Link>
                    ) : null}
                    <Link
                      href="/vocab"
                      className="flex-1 no-underline bg-ink hover:bg-slate-900 text-white! font-black px-6 py-3.5 rounded-2xl text-center text-base transition-all"
                    >
                      단어장 복습
                    </Link>
                  </div>
                ) : viewer.kind === "pending" ? (
                  <div className="space-y-3">
                    <p className="m-0 text-sm text-slate-700 font-semibold">
                      가입 요청이 접수됐습니다. 관리자가 승인하면 메일로 알려드리고, 그때부터 지난 호 전체와 아침 메일이 열립니다.
                    </p>
                    <Link
                      href="/pending"
                      className="inline-flex no-underline bg-ink text-white! font-black px-6 py-3 rounded-2xl text-sm"
                    >
                      승인 안내 보기
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <KakaoButton next="/" label="카카오로 3초 만에 가입" />
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <Link
                        href="/signup"
                        className="flex-1 no-underline bg-ink hover:bg-slate-900 text-white! font-black px-6 py-3 rounded-2xl text-center text-sm transition-all"
                      >
                        이메일로 가입
                      </Link>
                      <Link
                        href="/login"
                        className="flex-1 no-underline bg-slate-100 hover:bg-slate-200 text-slate-800! font-black px-6 py-3 rounded-2xl text-center text-sm transition-all"
                      >
                        이미 회원이면 로그인
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-4 mt-4 border-t border-slate-100 gap-2">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                    {Icon.check} 최신 {feed.free_limit}편은 로그인 없이 · 광고 없음
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-slate-600">
                    {Icon.check} 메일 수신은 내 정보에서 한 번에 끄기
                  </span>
                </div>
              </div>

              {!anon ? <PushToggle compact /> : null}

              {/* 미니 배지 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { t: "오전 7시 정각", s: "그날의 요약을 메일로", i: Icon.clock },
                  { t: "한글 ⇄ ENG", s: "같은 내용을 두 언어로", i: Icon.globe },
                  { t: `단어 ${stats?.vocab ?? "—"}개`, s: "본문 단어 그대로 외우기", i: Icon.book },
                ].map((b) => (
                  <div key={b.t} className="bg-white/80 p-3 rounded-2xl border border-amber-100 flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0">
                      <span className="[&>svg]:w-4 [&>svg]:h-4">{b.i}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-black text-ink truncate">{b.t}</p>
                      <p className="m-0 text-[11px] text-slate-500 truncate">{b.s}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ---- 오른쪽: 오늘 글이 담긴 폰 목업 ---- */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute -top-6 left-0 sm:-left-6 z-20 bg-white rounded-2xl p-3.5 shadow-xl border border-amber-200 flex items-center gap-3 ld-float">
                  <div className="w-9 h-9 rounded-xl bg-brand text-ink flex items-center justify-center font-black text-xs shadow-sm">07:00</div>
                  <div>
                    <p className="m-0 text-xs font-black text-ink">오늘의 아티클 도착!</p>
                    <p className="m-0 text-[10px] text-slate-500">{card ? card.source_name : "매일 아침 한 편"}</p>
                  </div>
                </div>
                <div className="absolute -bottom-6 right-0 sm:-right-6 z-20 bg-ink text-white rounded-2xl p-3.5 shadow-2xl border border-slate-800 flex items-center gap-2.5">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-extrabold text-slate-100">
                    요약 {issueNo}편 · 단어 {stats?.vocab ?? "—"}개
                  </span>
                </div>

                <div className="bg-ink p-3 sm:p-4 rounded-[44px] shadow-device border-4 border-slate-800">
                  <div className="bg-white rounded-[34px] overflow-hidden border border-slate-200 flex flex-col h-[560px]">
                    <div className="bg-ink text-white px-6 pt-3 pb-2 flex justify-between items-center text-xs">
                      <span className="font-extrabold tracking-wider">07:00</span>
                      <div className="w-16 h-3 bg-slate-800 rounded-full" />
                      <span className="font-bold text-slate-400">DailyHR</span>
                    </div>
                    <div className="bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                      <span className="text-[11px] font-black text-slate-700">요약 언어</span>
                      <LangToggle lang={lang} onChange={setLang} />
                    </div>

                    {card ? (
                      <div className="flex-1 bg-amber-50/60 p-3.5 overflow-y-auto space-y-3">
                        <div className="text-center">
                          <span className="bg-ink/10 text-slate-700 text-[10px] px-3 py-0.5 rounded-full font-bold">
                            <span className="l-ko">{longDateKo(card.featured_date)}</span>
                            <span className="l-en">{longDateEn(card.featured_date)}</span>
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/logo-owl-160.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full flex-shrink-0 shadow-sm" />
                          <div className="max-w-[90%] bg-white rounded-2xl rounded-tl-none p-3.5 shadow-sm text-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-2">
                              <span className="font-black text-slate-900">[DailyHR] 아침 7시 브리핑</span>
                              <span className="text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">No. {issueNo}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <KindPill kind={card.kind} />
                              {card.category ? <span className="text-[10px] font-bold text-slate-500">{card.category}</span> : null}
                            </div>
                            <p className="m-0 font-extrabold text-slate-900 text-[13px] leading-snug">{card.title}</p>
                            {card.summary ? (
                              <>
                                <p className="m-0 text-slate-600 text-[11px] leading-relaxed l-ko">{excerpt(card.summary.ko, 150)}</p>
                                <p className="m-0 text-slate-600 text-[11px] leading-relaxed l-en">{excerpt(card.summary.en, 230)}</p>
                              </>
                            ) : null}
                            {findings.length ? (
                              <div className="bg-amber-50 p-2.5 rounded-xl text-[11px] text-amber-950 border border-amber-200/60 space-y-1.5">
                                <p className="m-0 font-black">📌 핵심 수치</p>
                                {findings.map((f, i) => (
                                  <p key={i} className="m-0 leading-snug">
                                    <b className="l-ko">{f.k.ko}</b>
                                    <b className="l-en">{f.k.en}</b>
                                    <span className="text-slate-600"> — </span>
                                    <span className="l-ko">{excerpt(f.ko, 60)}</span>
                                    <span className="l-en">{excerpt(f.en, 80)}</span>
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            <Link
                              href={`/a/${card.id}`}
                              className="block no-underline w-full bg-brand hover:bg-brand-dark/90 text-ink! font-black py-2 rounded-xl text-center text-xs transition shadow-sm"
                            >
                              전문 아티클 3분 읽기 →
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 bg-amber-50/60 p-6 flex items-center justify-center text-center text-xs text-slate-600 font-semibold">
                        아직 요약된 글이 없습니다. 매일 아침 6시에 한 편이 요약되어 여기에 나타납니다.
                      </div>
                    )}

                    <div className="py-2 flex justify-center bg-white border-t border-slate-100">
                      <div className="w-28 h-1 bg-slate-300 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 현황 ================= */}
      <section className="border-y border-amber-200 bg-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="m-0 text-center text-xs font-black text-slate-500 tracking-wider uppercase mb-8">
            {SOURCES.map((s) => s.name).join(" · ")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            {[
              { n: issueNo, suf: "호", l: "지금까지 발행" },
              { n: stats?.vocab ?? "—", suf: "개", l: "학습 단어" },
              { n: stats?.index?.toLocaleString() ?? "—", suf: "편", l: "서재에 모인 글" },
              { n: SOURCES.length, suf: "곳", l: "학술지·매체" },
            ].map((s) => (
              <div key={s.l} className="p-4 rounded-2xl bg-paper border border-amber-100">
                <p className="m-0 text-2xl sm:text-4xl font-black text-ink">
                  {s.n}
                  <span className="text-brand-dark">{s.suf}</span>
                </p>
                <p className="m-0 text-xs sm:text-sm text-slate-600 font-bold mt-1.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 지난 호 ================= */}
      <section id="articles" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <span className="text-xs font-black text-amber-900 bg-amber-100 px-3.5 py-1 rounded-full uppercase tracking-wider">Back issues</span>
            <h2 className="m-0 text-2xl sm:text-4xl font-black text-ink mt-3">지난 호 아카이브</h2>
            <p className="m-0 text-sm text-slate-600 mt-1.5">
              카드를 누르면 한글·영문 요약과 단어장으로 갑니다.{" "}
              {anon ? `최신 ${feed.free_limit}편은 바로 열리고, 그 이전 호는 가입 승인 후 열립니다.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "전체보기"],
                ["paper", "논문"],
                ["article", "아티클"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold transition cursor-pointer border ${
                  filter === k ? "bg-ink text-white border-ink shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {shown.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {shown.map((a) => (
              <Link
                key={a.id}
                href={`/a/${a.id}`}
                className={`group no-underline bg-white rounded-3xl p-6 border shadow-sm hover:shadow-soft transition-all duration-300 flex flex-col justify-between ${
                  a.locked ? "border-dashed border-slate-300" : "border-slate-200 hover:border-brand"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <KindPill kind={a.kind} />
                    <span className="text-xs text-slate-500 font-bold flex items-center gap-1">{shortDate(a.featured_date)}</span>
                  </div>
                  <h3 className="m-0 text-base font-black text-ink group-hover:text-amber-800 transition leading-snug line-clamp-3">{a.title}</h3>
                  {a.locked ? (
                    <p className="m-0 text-xs text-slate-500 mt-2.5 leading-relaxed">🔒 가입 승인 후 읽을 수 있는 지난 호입니다.</p>
                  ) : a.summary ? (
                    <p className="m-0 text-xs text-slate-600 mt-2.5 line-clamp-3 leading-relaxed">{excerpt(a.summary.ko, 140)}</p>
                  ) : null}
                </div>
                <div className="pt-5 border-t border-slate-100 mt-5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 truncate">{a.source_name}</span>
                  <span className="text-xs font-black text-amber-700 group-hover:text-amber-900 flex items-center gap-1 whitespace-nowrap">
                    {a.locked ? "가입 후 열람" : `요약 읽기 · 단어 ${a.vocab_count}`} {Icon.arrow}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm text-slate-500">해당하는 지난 호가 아직 없습니다.</p>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 no-underline bg-white border border-slate-200 hover:border-brand text-ink! font-black px-6 py-3 rounded-full text-sm transition shadow-sm"
          >
            서재에서 전체 {stats?.index?.toLocaleString() ?? ""}편 보기 {Icon.arrow}
          </Link>
        </div>
      </section>

      {/* ================= 왜 DailyHR ================= */}
      <section id="why-us" className="py-16 lg:py-20 bg-amber-50/70 border-y border-amber-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black text-amber-900 bg-amber-200 px-3.5 py-1 rounded-full uppercase tracking-wider">Why DailyHR</span>
            <h2 className="m-0 text-2xl sm:text-4xl font-black text-ink mt-3">읽기만 하고 끝나지 않게 만들었습니다</h2>
            <p className="m-0 text-sm text-slate-600 mt-2">요약·수치·단어·메일이 한 흐름으로 이어집니다.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { i: Icon.globe, t: "학술지 3종 · 매체 3곳 엄선", d: "Wiley HR 저널 3종과 AIHR·Josh Bersin·McKinsey 를 매일 수집하고, 화·금은 논문을 먼저 고릅니다." },
              { i: Icon.bolt, t: "한글 ⇄ 영문 3분 요약", d: "같은 내용을 두 언어로 읽고, 핵심 수치 카드와 섹션별 상세로 바로 내려갑니다. 읽어주기도 됩니다." },
              { i: Icon.book, t: "본문 단어 그대로 단어장", d: "글에서 실제로 쓰인 HR 용어 8~12개를 뜻·정의·예문과 함께 외우고, 진도는 기기 간에 이어집니다." },
              { i: Icon.mail, t: "매일 아침 7시 메일", d: "승인 회원에게 그날의 요약과 단어를 보냅니다. 수신 여부는 내 정보에서 언제든 바꿀 수 있습니다." },
            ].map((v) => (
              <div key={v.t} className="bg-white rounded-3xl p-7 border border-amber-100 shadow-sm hover:shadow-soft transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-brand text-ink flex items-center justify-center mb-6 shadow-sm">{v.i}</div>
                <h3 className="m-0 text-lg font-black text-ink">{v.t}</h3>
                <p className="m-0 text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 매일 이렇게 + 출처 ================= */}
      <section id="how" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-ink rounded-[36px] lg:rounded-[44px] text-white p-7 sm:p-12 lg:p-16 overflow-hidden relative shadow-2xl">
          <div className="absolute -right-20 -bottom-20 w-[450px] h-[450px] bg-brand/20 rounded-full blur-3xl pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start relative">
            <div className="lg:col-span-6 space-y-5">
              <span className="inline-block bg-brand text-ink text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">Every morning</span>
              <h2 className="m-0 text-2xl sm:text-4xl font-black leading-tight">
                매일 이렇게
                <br />
                돌아갑니다
              </h2>
              <ol className="list-none m-0 p-0 space-y-4 pt-2">
                {[
                  ["05:30", "수집", "학술지·매체 피드에서 새 글을 모읍니다."],
                  ["06:00", "요약", "한 편을 골라 한글·영문 요약, 핵심 수치, 단어장을 만듭니다."],
                  ["07:00", "배달", "승인 회원에게 메일로 보냅니다. 앱에서는 읽어주기와 단어 복습을 이어갑니다."],
                ].map(([t, b, d]) => (
                  <li key={t} className="flex gap-4 items-start">
                    <span className="w-16 flex-shrink-0 font-black text-brand text-lg tabular-nums">{t}</span>
                    <div>
                      <b className="block text-base">{b}</b>
                      <span className="text-slate-300 text-sm leading-relaxed">{d}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lg:col-span-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 text-slate-900 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-700">이런 출처를 읽습니다</span>
                  <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded">원문 링크 제공</span>
                </div>
                <ul className="list-none m-0 p-0 divide-y divide-slate-100">
                  {SOURCES.map((s) => (
                    <li key={s.name} className="py-3">
                      <a href={s.home} target="_blank" rel="noopener noreferrer" className="no-underline flex items-start gap-3 group">
                        <span className="pt-0.5">
                          <KindPill kind={s.kind} />
                        </span>
                        <span className="min-w-0">
                          <b className="block text-sm text-ink group-hover:text-amber-800">{s.name}</b>
                          <span className="block text-xs text-slate-600 leading-snug">{s.desc}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 마지막 CTA ================= */}
      {!full ? (
        <section className="py-16 lg:py-20 bg-brand text-ink text-center relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-white/20 rounded-full blur-2xl pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative">
            <div className="inline-flex items-center gap-2 bg-ink text-brand px-4 py-1.5 rounded-full text-xs font-black tracking-wide shadow-sm">
              ☕ 내일 아침 7시, No. {issueNo + 1} 이 발행됩니다
            </div>
            <h2 className="m-0 text-3xl sm:text-5xl font-black leading-tight tracking-tight">
              내일 아침 출근길,
              <br className="hidden sm:block" /> HR 읽기 루틴을 시작하세요
            </h2>
            <p className="m-0 text-base sm:text-lg font-bold text-slate-900 max-w-xl mx-auto leading-relaxed">
              가입은 무료이고, 관리자 승인 후 지난 호 전체와 아침 메일이 열립니다.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={viewer.kind === "pending" ? "/pending" : "/signup"}
                className="no-underline bg-ink hover:bg-slate-900 text-white! font-black text-base sm:text-lg px-9 py-4 rounded-full shadow-2xl transition-all hover:scale-105 inline-flex items-center justify-center gap-3"
              >
                {viewer.kind === "pending" ? "승인 안내 보기" : "지금 무료로 가입하기"} {Icon.arrow}
              </Link>
              {anon ? (
                <Link
                  href="/login"
                  className="no-underline bg-white/70 hover:bg-white text-ink! font-black text-base px-8 py-4 rounded-full inline-flex items-center justify-center"
                >
                  로그인
                </Link>
              ) : null}
            </div>
            <p className="m-0 text-xs font-black text-amber-950/80">결제 정보 없음 · 카카오 또는 이메일 · 메일은 언제든 끄기</p>
          </div>
        </section>
      ) : null}

      {/* ================= FOOTER ================= */}
      <footer className="bg-slate-950 text-slate-400 py-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">
                  Daily<span className="text-brand">HR</span>
                </span>
                <span className="text-[10px] bg-slate-800 text-brand font-extrabold px-2 py-0.5 rounded-full">dailyhr.co.kr</span>
              </div>
              <p className="m-0 leading-relaxed">하루 한 편, HR 아티클·논문을 한글과 영어로 읽는 아침 루틴.</p>
              <p className="m-0 leading-relaxed text-slate-500">
                원문은 저장하지 않습니다. 요약·단어 정의·예문은 직접 작성한 것이며 각 글에 원문 링크를 붙입니다. 수집하는
                논문·아티클은 공개된 자료만 다루며, AI가 읽고 학습에 필요한 HR 용어와 요약으로 다시 쓰기 때문에 저작권 문제가
                생기지 않습니다.
              </p>
            </div>
            <div>
              <h4 className="m-0 font-black text-white text-sm mb-4">바로가기</h4>
              <ul className="list-none m-0 p-0 space-y-2.5 font-medium">
                <li>
                  <Link href="/" className="no-underline text-slate-400! hover:text-brand! transition">
                    오늘의 아티클
                  </Link>
                </li>
                <li>
                  <Link href="/library" className="no-underline text-slate-400! hover:text-brand! transition">
                    서재
                  </Link>
                </li>
                <li>
                  <Link href="/vocab" className="no-underline text-slate-400! hover:text-brand! transition">
                    단어장
                  </Link>
                </li>
                <li>
                  <Link href={anon ? "/login" : "/account"} className="no-underline text-slate-400! hover:text-brand! transition">
                    {anon ? "로그인" : "내 정보"}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="m-0 font-black text-white text-sm mb-4">발행</h4>
              <p className="m-0 leading-relaxed">
                매일 05:30 수집 · 06:00 요약 · 07:00 메일 (KST)
                <br />
                출처: {SOURCES.map((s) => s.name).join(", ")}
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-500 gap-3">
            <p className="m-0">© 2026 DailyHR (dailyhr.co.kr)</p>
            <p className="m-0">
              오늘 No. {issueNo} · {card ? longDateKo(card.featured_date) : ""}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
