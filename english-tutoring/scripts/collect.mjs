// 수집기 — AIHR(WordPress) 대상.
//
// 정찰 결과 반영:
//   robots.txt      Allow: /  (수집 허용, /wp-admin/ 만 차단)
//   /feed/          최신 10건. content:encoded 에 본문이 통째로 들어 있어
//                   글 페이지를 따로 요청할 필요가 없다.
//   post-sitemap*.xml  과거 글 1,000건 이상의 URL 목록.
//
// 저장 정책
//   data/index.json   전체 글의 URL·날짜만. 가볍고 저작물이 아니다. 영구 보관.
//   data/inbox.json   요약 대기 목록(제목·URL·날짜). 영구 보관.
//   data/raw/*.md     요약용 본문. 요약이 끝나면 cleanup.mjs 로 지운다.
//   data/articles.json 완성된 요약. 본문은 담지 않는다.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "raw");

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "sources.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fb; } };
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n");
};

async function get(url) {
  const res = await fetch(url, {
    headers: { "user-agent": cfg.userAgent, accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ---------- 파싱 ---------- */

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .trim();
}

const pick = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

function htmlToText(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => "\n" + "#".repeat(+n) + " ")
    .replace(/<[^>]+>/g, " ");
  return decode(body)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseFeed(xml) {
  const out = [];
  for (const b of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    const title = pick(b, "title");
    const url = pick(b, "link");
    if (!title || !url) continue;
    out.push({
      title,
      url,
      published: pick(b, "pubDate"),
      category: (b.match(/<category[^>]*>([\s\S]*?)<\/category>/i) || [, ""])[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
      html: pick(b, "content:encoded") || pick(b, "description"),
    });
  }
  return out;
}

const locsOf = (xml) => [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => decode(m[1]));
const lastmodsOf = (xml) => [...xml.matchAll(/<lastmod>([\s\S]*?)<\/lastmod>/gi)].map((m) => decode(m[1]));

const slugOf = (url) => url.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "article";
const titleFromSlug = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const toDate = (s) => { const d = new Date(s); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };

/* ---------- 1단계: 전체 글 목록(URL만) ---------- */

async function buildIndex(src) {
  const indexPath = path.join(DATA, "index.json");
  const index = readJson(indexPath, []);
  const known = new Set(index.map((e) => e.url));
  const re = new RegExp(src.articlePattern);
  let added = 0;

  let maps = [];
  try {
    const xml = await get(src.sitemapIndex);
    maps = locsOf(xml).filter((u) => /post-sitemap\d*\.xml$/i.test(u));
    console.log(`  사이트맵 인덱스 → 글 사이트맵 ${maps.length}개`);
  } catch (e) {
    console.log(`  사이트맵 인덱스 실패: ${e.message}`);
    return index;
  }

  for (const map of maps) {
    await sleep(cfg.politeDelayMs);
    try {
      const xml = await get(map);
      const locs = locsOf(xml);
      const mods = lastmodsOf(xml);
      let n = 0;
      locs.forEach((url, i) => {
        if (!re.test(url) || known.has(url)) return;
        index.push({
          url,
          slug: slugOf(url),
          title: titleFromSlug(slugOf(url)),
          published: toDate(mods[i] || ""),
          source: src.id,
        });
        known.add(url);
        n++; added++;
      });
      console.log(`  ${map.split("/").pop()} → ${locs.length}건 중 신규 ${n}건`);
    } catch (e) {
      console.log(`  ${map} 실패: ${e.message}`);
    }
  }

  index.sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  writeJson(indexPath, index);
  console.log(`  전체 목록 ${index.length}건 (신규 ${added}건)`);
  return index;
}

/* ---------- 2단계: 최신 글 본문 ---------- */

async function collectRecent(src) {
  const inboxPath = path.join(DATA, "inbox.json");
  const inbox = readJson(inboxPath, []);
  const articles = readJson(path.join(DATA, "articles.json"), []);
  const seen = new Set([...inbox, ...articles].map((a) => a.url));

  let items = [];
  for (const feed of src.feeds) {
    try {
      items = parseFeed(await get(feed));
      if (items.length) { console.log(`  피드 ${feed} → ${items.length}건`); break; }
    } catch (e) { console.log(`  피드 ${feed} 실패: ${e.message}`); }
    await sleep(cfg.politeDelayMs);
  }
  if (!items.length) { console.log("  피드에서 아무것도 얻지 못했다"); return; }

  const fresh = items.filter((i) => !seen.has(i.url)).slice(0, cfg.maxNewPerRun);
  console.log(`  신규 ${fresh.length}건`);

  for (const item of fresh) {
    let text = htmlToText(item.html || "");

    // 피드 본문이 요약본뿐이면 글 페이지를 직접 받는다.
    if (text.length < 1200) {
      await sleep(cfg.politeDelayMs);
      try {
        const page = await get(item.url);
        const main = page.match(/<article[\s>][\s\S]*?<\/article>/i)
                  || page.match(/<main[\s>][\s\S]*?<\/main>/i);
        text = htmlToText(main ? main[0] : page);
        console.log(`  · 본문을 글 페이지에서 보충 (${text.length}자)`);
      } catch (e) { console.log(`  ✗ ${item.url} → ${e.message}`); continue; }
    }

    if (text.length < 800) { console.log(`  ✗ 본문 짧음(${text.length}자): ${item.url}`); continue; }
    if (/members?\s*only|sign in to (?:read|continue)|log ?in to (?:read|continue)/i.test(text.slice(0, 3000))) {
      console.log(`  ✗ 로그인 필요 — 건너뜀: ${item.url}`); continue;
    }

    const id = `${src.id}-${slugOf(item.url)}`.slice(0, 90);
    fs.mkdirSync(RAW, { recursive: true });
    fs.writeFileSync(path.join(RAW, `${id}.md`),
      "<!-- 요약용 임시 원문. 요약 후 삭제한다. 저장소에 영구 보관하지 않는다. -->\n" +
      `<!-- ${item.url} -->\n\n# ${item.title}\n\n${text.slice(0, 45000)}\n`);

    inbox.unshift({
      id,
      source: src.id,
      sourceName: src.name,
      title: item.title,
      url: item.url,
      category: item.category || "",
      published: toDate(item.published),
      collectedAt: new Date().toISOString().slice(0, 10),
      status: "pending",
      raw: `data/raw/${id}.md`,
      chars: text.length,
    });
    seen.add(item.url);
    console.log(`  ✓ ${item.title.slice(0, 64)}  (${text.length}자)`);
  }

  writeJson(inboxPath, inbox);
  if (!fs.existsSync(path.join(DATA, "articles.json"))) writeJson(path.join(DATA, "articles.json"), []);
  console.log(`  요약 대기 ${inbox.filter((a) => a.status === "pending").length}건`);
}

/* ---------- 실행 ---------- */

for (const src of cfg.sources) {
  if (!src.enabled) continue;
  console.log(`\n=== ${src.name}`);
  console.log("[1/2] 전체 글 목록");
  await buildIndex(src);
  await sleep(cfg.politeDelayMs);
  console.log("[2/2] 최신 글 본문");
  await collectRecent(src);
}
console.log("\n수집 완료");
