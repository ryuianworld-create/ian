// 1세대(../english-tutoring) 데이터를 Supabase 로 옮긴다. 여러 번 실행해도 안전(upsert).
//   npm run import:legacy
//   LEGACY_DIR=/path/to/english-tutoring npm run import:legacy
//
//  - docs/data/articles.json (6편) → articles. featured_date = published, 겹치면 하루씩 앞으로. 모두 오늘(KST) 이전.
//  - data/index.json (1,368건) → index_items (source aihr)
//  - data/inbox.json 의 pending → inbox. raw_text 는 data/raw/<id>.md (앞의 HTML 주석 2줄 제거)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "../src/lib/env";
import { addDays, kstToday, toDate } from "../src/lib/kst";
import { computeScore } from "../src/lib/score";
import type { DetailSection, Finding, Lang, VocabEntry } from "../src/types";

loadDotEnv();
const { db, unwrap } = await import("../src/lib/supabase");

const here = path.dirname(fileURLToPath(import.meta.url));
const LEGACY = process.env.LEGACY_DIR ?? path.resolve(here, "../../../english-tutoring");

type LegacyArticle = {
  id: string; source: string; sourceName: string; title: string; url: string; published: string;
  category?: string; summary: Lang; findings: Finding[]; detail: DetailSection[]; vocab: VocabEntry[];
};
type LegacyIndex = { url: string; slug: string; title: string; published: string; source: string };
type LegacyInbox = {
  id: string; source: string; sourceName: string; title: string; url: string; category?: string;
  published?: string; collectedAt?: string; status: string; raw?: string; chars?: number;
};

const readJson = <T,>(rel: string): T => JSON.parse(fs.readFileSync(path.join(LEGACY, rel), "utf8")) as T;
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

console.log(`legacy dir: ${LEGACY}`);
const today = kstToday();

// 소스 메타 (weight·이름). DB 의 sources 를 우선 쓰고 없으면 aihr 기본값
const sources = new Map<string, { name: string; weight: number; kind: "article" | "paper" }>();
for (const s of unwrap(await db().from("sources").select("id,name,weight,kind"), "sources") as { id: string; name: string; weight: number | string; kind: "article" | "paper" }[]) {
  sources.set(s.id, { name: s.name, weight: Number(s.weight) || 1, kind: s.kind });
}
const srcOf = (id: string, fallbackName: string) => sources.get(id) ?? { name: fallbackName, weight: 1, kind: "article" as const };

/* ---------- 1. articles ---------- */
{
  const legacy = readJson<LegacyArticle[]>("docs/data/articles.json");
  const existing = unwrap(await db().from("articles").select("id,featured_date"), "articles.existing") as { id: string; featured_date: string }[];
  const byId = new Map(existing.map((a) => [a.id, a.featured_date]));
  const taken = new Set(existing.map((a) => a.featured_date));

  // 최신 글부터 자기 날짜를 먼저 가져가게
  const ordered = [...legacy].sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  let inserted = 0, updated = 0;
  for (const a of ordered) {
    let featured_date = byId.get(a.id);
    if (!featured_date) {
      // 발행일에서 시작해 비어 있고 오늘 이전인 날짜까지 하루씩 뒤로
      featured_date = toDate(a.published) ?? addDays(today, -1);
      while (taken.has(featured_date) || featured_date >= today) featured_date = addDays(featured_date, -1);
      taken.add(featured_date);
    }
    const src = srcOf(a.source, a.sourceName);
    const row = {
      id: a.id,
      source_id: a.source,
      source_name: a.sourceName || src.name,
      kind: src.kind,
      title: a.title,
      url: a.url,
      published: toDate(a.published),
      category: a.category ?? null,
      summary: a.summary,
      findings: a.findings ?? [],
      detail: a.detail ?? [],
      vocab: a.vocab ?? [],
      featured_date,
      model: "legacy-import",
    };
    const { error } = await db().from("articles").upsert(row, { onConflict: "id" });
    if (error) { console.error(`  ✗ articles ${a.id}: ${error.message}`); continue; }
    byId.has(a.id) ? updated++ : inserted++;
    console.log(`  ✓ ${featured_date}  ${a.title.slice(0, 60)}`);
  }
  console.log(`articles: 신규 ${inserted} · 갱신 ${updated}`);
}

/* ---------- 2. index_items ---------- */
{
  const index = readJson<LegacyIndex[]>("data/index.json");
  const seen = new Set<string>();
  const rows = index
    .filter((i) => i.url && !seen.has(i.url) && (seen.add(i.url), true))
    .map((i) => {
      const src = srcOf(i.source || "aihr", "AIHR");
      return {
        url: i.url,
        source_id: sources.has(i.source || "aihr") ? i.source || "aihr" : null,
        source_name: src.name,
        kind: src.kind,
        title: i.title || i.slug,
        published: toDate(i.published),
      };
    });
  let n = 0;
  for (const part of chunk(rows, 500)) {
    const { error } = await db().from("index_items").upsert(part, { onConflict: "url" });
    if (error) { console.error(`  ✗ index_items: ${error.message}`); continue; }
    n += part.length;
  }
  console.log(`index_items: ${n}/${rows.length} upsert`);
}

/* ---------- 3. inbox (pending 만) ---------- */
{
  const inbox = readJson<LegacyInbox[]>("data/inbox.json").filter((i) => i.status === "pending");
  const articleUrls = new Set(
    (unwrap(await db().from("articles").select("url"), "articles.urls") as { url: string }[]).map((r) => r.url),
  );
  let n = 0, noRaw = 0, skippedDone = 0;
  for (const i of inbox) {
    if (articleUrls.has(i.url)) { skippedDone++; continue; } // 이미 요약된 글은 대기열에 넣지 않는다
    let raw_text: string | null = null;
    const rawPath = path.join(LEGACY, i.raw ?? `data/raw/${i.id}.md`);
    if (fs.existsSync(rawPath)) {
      const lines = fs.readFileSync(rawPath, "utf8").split("\n");
      // 앞의 HTML 주석 2줄(안내·URL) 제거
      let k = 0;
      while (k < lines.length && k < 2 && lines[k]!.startsWith("<!--")) k++;
      raw_text = lines.slice(k).join("\n").trim().slice(0, 45_000) || null;
    } else noRaw++;

    const src = srcOf(i.source || "aihr", i.sourceName || "AIHR");
    const published = toDate(i.published);
    const chars = raw_text ? raw_text.length : i.chars ?? 0;
    const row = {
      id: i.id.slice(0, 90),
      source_id: sources.has(i.source) ? i.source : null,
      source_name: i.sourceName || src.name,
      kind: src.kind,
      title: i.title,
      url: i.url,
      category: i.category || null,
      published,
      raw_text,
      chars,
      score: computeScore({ weight: src.weight, published, title: i.title, chars }),
      status: "pending" as const,
      collected_at: i.collectedAt ? `${i.collectedAt}T00:00:00+09:00` : new Date().toISOString(),
    };
    const { error } = await db().from("inbox").upsert(row, { onConflict: "id" });
    if (error) { console.error(`  ✗ inbox ${i.id}: ${error.message}`); continue; }
    n++;
  }
  console.log(`inbox: ${n} upsert (raw 없음 ${noRaw}, 이미 요약됨 ${skippedDone})`);
}

console.log("완료");
