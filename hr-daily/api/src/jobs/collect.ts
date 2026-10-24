// collect — sources(enabled) 를 순회하며 RSS/Atom 을 읽어 index_items 와 inbox 를 채운다.
// 한 소스가 실패해도 다른 소스는 계속한다. 요청 사이 2초 대기.
import {
  LOGIN_WALL_RE, PAPER_SKIP_TITLE_RE, cleanUrl, extractPageText, get, htmlToText, parseFeed, sleep, slugOf,
  type FeedItem,
} from "../lib/feed.js";
import { toDate } from "../lib/kst.js";
import { computeScore } from "../lib/score.js";
import { db, unwrap, unwrapMaybe } from "../lib/supabase.js";
import type { InboxRow, SourceRow } from "../types.js";
import type { Log } from "./run.js";

const POLITE_DELAY_MS = 2000;
const MAX_NEW_PER_SOURCE = 10;
const RAW_TEXT_LIMIT = 45_000;
// Vercel 함수 한도(300초) 안에서 반드시 끝나도록 전체 시간 예산을 둔다. 넘기면 남은 소스는 다음 실행으로 미룬다.
const BUDGET_MS = Number(process.env.COLLECT_BUDGET_MS) || 220_000;
const PAGE_FETCH_TIMEOUT_MS = 12_000;      // 글 페이지 보충 요청. 봇을 막는 사이트(McKinsey 등)가 40초씩 잡아먹지 않게
const MAX_PAGE_FAILURES_PER_SOURCE = 3;   // 연속 실패하면 그 소스는 페이지 보충을 포기

class BudgetExceeded extends Error { constructor() { super("시간 예산 초과"); this.name = "BudgetExceeded"; } }
const deadline = { at: 0 };
const timeLeft = () => deadline.at - Date.now();
function checkBudget(): void { if (timeLeft() <= 0) throw new BudgetExceeded(); }

export type CollectResult = {
  sources: { id: string; feed_items: number; indexed: number; added: number; skipped: number; error: string | null }[];
  added: number;
};

type Prepared = { text: string; chars: number } | { skip: string };

/** 단어 경계로 맞춘다. 부분 문자열 매칭은 "hr"∈"three", "work"∈"network" 같은 오탐을 낸다 */
function titleMatchesKeywords(title: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const t = title.toLowerCase();
  return keywords.some((k) => {
    const esc = k.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return esc.length > 0 && new RegExp(`(^|[^a-z0-9])${esc}(?=$|[^a-z0-9])`).test(t);
  });
}

/** kind 별 본문 확보 규칙 (SPEC collect) */
async function prepareText(src: SourceRow, item: FeedItem, log: Log, pageFailures: { n: number }): Promise<Prepared> {
  if (src.kind === "paper") {
    if (PAPER_SKIP_TITLE_RE.test(item.title)) return { skip: "잡지 안내문" };
    const text = htmlToText(item.html || "");
    if (text.length < 400) return { skip: `초록 짧음(${text.length}자)` };
    return { text, chars: text.length };
  }

  // article
  let text = htmlToText(item.html || "");
  if (text.length < 1200) {
    if (pageFailures.n >= MAX_PAGE_FAILURES_PER_SOURCE) return { skip: "페이지 보충 포기(연속 실패)" };
    checkBudget();
    await sleep(POLITE_DELAY_MS);
    try {
      text = extractPageText(await get(item.url, Math.min(PAGE_FETCH_TIMEOUT_MS, Math.max(1000, timeLeft() - 5000))));
      pageFailures.n = 0;
      log(`  · 본문을 글 페이지에서 보충 (${text.length}자)`);
    } catch (e) {
      pageFailures.n++;
      return { skip: `페이지 요청 실패: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  if (text.length < 800) return { skip: `본문 짧음(${text.length}자)` };
  if (LOGIN_WALL_RE.test(text.slice(0, 3000))) return { skip: "로그인 필요" };
  return { text, chars: text.length };
}

/** inbox.id 는 `${source}-${slug}`. 다른 URL 과 겹치면 짧은 해시를 붙인다 */
async function uniqueInboxId(base: string, url: string): Promise<string> {
  const id = base.slice(0, 90);
  const existing = unwrapMaybe(
    await db().from("inbox").select("id,url").eq("id", id).maybeSingle<{ id: string; url: string }>(),
    "inbox.select(id)",
  );
  if (!existing || existing.url === url) return id;
  let h = 0;
  for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${id.slice(0, 82)}-${h.toString(36).slice(0, 6)}`;
}

async function collectSource(src: SourceRow, log: Log): Promise<CollectResult["sources"][number]> {
  const stat = { id: src.id, feed_items: 0, indexed: 0, added: 0, skipped: 0, error: null as string | null };
  const feeds = Array.isArray(src.feeds) ? src.feeds : [];
  const keywords = Array.isArray(src.keywords) ? src.keywords : [];

  // 1) 피드: 첫 번째로 성공한 피드만 쓴다
  let items: FeedItem[] = [];
  for (const feed of feeds) {
    try {
      items = parseFeed(await get(feed));
      if (items.length) { log(`  피드 ${feed} → ${items.length}건`); break; }
      log(`  피드 ${feed} → 0건`);
    } catch (e) {
      log(`  피드 ${feed} 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(POLITE_DELAY_MS);
  }
  if (!items.length) { stat.error = "피드에서 아무것도 얻지 못했다"; log(`  ✗ ${stat.error}`); return stat; }
  stat.feed_items = items.length;

  // 2) 키워드 필터 + URL 정리
  const filtered = items
    .map((i) => ({ ...i, url: cleanUrl(i.url) }))
    .filter((i) => /^https?:\/\//i.test(i.url))
    .filter((i) => titleMatchesKeywords(i.title, keywords));
  if (keywords.length) log(`  키워드 필터 → ${filtered.length}건`);

  // 3) index_items upsert (url 기준)
  const seenUrl = new Set<string>();
  const indexRows = filtered
    .filter((i) => (seenUrl.has(i.url) ? false : (seenUrl.add(i.url), true)))
    .map((i) => ({
      url: i.url,
      source_id: src.id,
      source_name: src.name,
      kind: src.kind,
      title: i.title.slice(0, 500),
      published: toDate(i.published),
    }));
  if (indexRows.length) {
    const { error } = await db().from("index_items").upsert(indexRows, { onConflict: "url" });
    if (error) log(`  index_items upsert 실패: ${error.message}`);
    else stat.indexed = indexRows.length;
  }

  // 4) 이미 inbox / articles 에 있는 URL 제외
  const urls = indexRows.map((r) => r.url);
  const [inInbox, inArticles] = await Promise.all([
    db().from("inbox").select("url").in("url", urls),
    db().from("articles").select("url").in("url", urls),
  ]);
  const known = new Set<string>([
    ...((inInbox.data ?? []) as { url: string }[]).map((r) => r.url),
    ...((inArticles.data ?? []) as { url: string }[]).map((r) => r.url),
  ]);
  const fresh = filtered.filter((i) => !known.has(i.url));
  log(`  신규 후보 ${fresh.length}건 (최대 ${MAX_NEW_PER_SOURCE}건 수집)`);

  // 5) 본문 확보 → inbox insert
  const pageFailures = { n: 0 };
  for (const item of fresh) {
    if (stat.added >= MAX_NEW_PER_SOURCE) break;
    checkBudget();
    const prepared = await prepareText(src, item, log, pageFailures);
    if ("skip" in prepared) { stat.skipped++; log(`  ✗ ${prepared.skip}: ${item.title.slice(0, 60)}`); continue; }

    const published = toDate(item.published);
    const row: Omit<InboxRow, "collected_at" | "processed_at" | "error"> = {
      id: await uniqueInboxId(`${src.id}-${slugOf(item.url)}`, item.url),
      source_id: src.id,
      source_name: src.name,
      kind: src.kind,
      title: item.title.slice(0, 500),
      url: item.url,
      category: item.category ? item.category.slice(0, 120) : null,
      published,
      raw_text: prepared.text.slice(0, RAW_TEXT_LIMIT),
      chars: prepared.chars,
      score: computeScore({ weight: src.weight, published, title: item.title, chars: prepared.chars }),
      status: "pending",
    };
    const { error } = await db().from("inbox").insert(row);
    if (error) { log(`  ✗ inbox insert 실패(${error.code ?? ""}): ${error.message}`); stat.skipped++; continue; }
    stat.added++;
    log(`  ✓ ${item.title.slice(0, 64)}  (${prepared.chars}자, score ${row.score})`);
    known.add(item.url);
  }
  return stat;
}

export async function collectJob(log: Log): Promise<CollectResult> {
  const sources = unwrap(
    await db().from("sources").select("*").eq("enabled", true).order("id"),
    "sources.select",
  ) as SourceRow[];
  deadline.at = Date.now() + BUDGET_MS;
  log(`소스 ${sources.length}개 · 시간 예산 ${Math.round(BUDGET_MS / 1000)}초`);

  const result: CollectResult = { sources: [], added: 0 };
  for (const src of sources) {
    if (timeLeft() < 15_000) { log(`⏱ 시간 예산 소진 — ${src.name} 부터는 다음 실행에`); break; }
    log(`=== ${src.name} (${src.kind})`);
    try {
      const stat = await collectSource(src, log);
      result.sources.push(stat);
      result.added += stat.added;
    } catch (e) {
      if (e instanceof BudgetExceeded) { log(`  ⏱ 시간 예산 초과 — ${src.name} 은 여기까지`); continue; }
      // 한 소스의 실패가 전체를 멈추지 않도록
      const msg = e instanceof Error ? e.message : String(e);
      result.sources.push({ id: src.id, feed_items: 0, indexed: 0, added: 0, skipped: 0, error: msg });
      log(`  ✗ 소스 실패: ${msg}`);
    }
    await sleep(POLITE_DELAY_MS);
  }
  log(`수집 완료 — 신규 ${result.added}건`);
  return result;
}
