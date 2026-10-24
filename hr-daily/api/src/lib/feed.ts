// RSS/Atom 파서 + HTML→텍스트. ../english-tutoring/scripts/collect.mjs 의 로직을 TypeScript 로 이식.
// 외부 XML 라이브러리 없이 정규식으로 처리한다(피드는 구조가 단순하고, 의존성을 줄이기 위해).

export const USER_AGENT = "hr-daily/0.1 (personal study reader; +https://github.com/rchworld/english-tutoring)";

export type FeedItem = {
  title: string;
  url: string;
  published: string; // 원문 문자열(pubDate / dc:date / updated). 날짜 변환은 호출부에서
  category: string;
  html: string; // content:encoded > description > content > summary
};

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function get(url: string, timeoutMs = 40_000): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** CDATA 제거 + HTML 엔티티 디코드 */
export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .trim();
}

/** <name>…</name> 첫 번째 블록의 내용(디코드됨). 없으면 "" */
export function pick(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m && m[1] !== undefined ? decode(m[1]) : "";
}

/** 본문 HTML → 읽을 수 있는 텍스트. 제목은 #, 목록은 "- " 로 */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h([1-6])[^>]*>/gi, (_, n: string) => "\n" + "#".repeat(+n) + " ")
    .replace(/<[^>]+>/g, " ");
  return decode(body)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** RSS 2.0 <item> 과 Atom <entry> 모두 처리 */
export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  const blocks = [
    ...(xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []),
  ];
  for (const b of blocks) {
    const title = pick(b, "title").replace(/\s+/g, " ");
    // RSS: <link>url</link>  / Atom: <link href="url" rel="alternate"/>
    let url = pick(b, "link");
    if (!url) {
      const alt =
        b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ??
        b.match(/<link[^>]*href=["']([^"']+)["']/i);
      url = alt && alt[1] ? decode(alt[1]) : "";
    }
    if (!url) url = pick(b, "guid").startsWith("http") ? pick(b, "guid") : "";
    if (!title || !url) continue;
    const cat = b.match(/<category[^>]*>([\s\S]*?)<\/category>/i);
    const catTerm = b.match(/<category[^>]*term=["']([^"']+)["']/i);
    out.push({
      title,
      url: url.trim(),
      published: pick(b, "pubDate") || pick(b, "dc:date") || pick(b, "published") || pick(b, "updated"),
      category: cat && cat[1] !== undefined ? decode(cat[1]) : catTerm && catTerm[1] ? decode(catTerm[1]) : "",
      html: pick(b, "content:encoded") || pick(b, "description") || pick(b, "content") || pick(b, "summary"),
    });
  }
  return out;
}

/** 글 페이지에서 <article> 또는 <main> 만 떼어 텍스트로 */
export function extractPageText(page: string): string {
  const main = page.match(/<article[\s>][\s\S]*?<\/article>/i) ?? page.match(/<main[\s>][\s\S]*?<\/main>/i);
  return htmlToText(main ? main[0] : page);
}

export const LOGIN_WALL_RE = /members?\s*only|sign in to (?:read|continue)|log ?in to (?:read|continue)|subscribe to (?:read|continue)/i;

/** 추적용 쿼리(utm_*, af=R 등)와 해시를 떼어 같은 글이 다른 URL 로 두 번 들어오지 않게 한다 */
export function cleanUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|af$|fbclid$|gclid$|mc_cid$|mc_eid$|ref$)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function slugOf(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "article";
}

/** 이 제목은 요약 대상이 아니다(논문 피드의 잡지 안내문 등) */
export const PAPER_SKIP_TITLE_RE = /issue information|erratum|correction|editorial board/i;
