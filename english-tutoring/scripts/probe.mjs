// 정찰 스크립트 — 소스 사이트가 무엇을 제공하는지 확인만 한다.
// 수집기를 짜기 전에 RSS/사이트맵/목록 페이지 중 무엇이 살아 있는지 알아내는 용도.
// 아무것도 저장하지 않는다.

const UA = "hr-paper-daily/0.1 (personal study reader; +https://github.com/rchworld/english-tutoring)";

const CANDIDATES = [
  "https://www.aihr.com/robots.txt",
  "https://www.aihr.com/feed/",
  "https://www.aihr.com/blog/feed/",
  "https://www.aihr.com/sitemap_index.xml",
  "https://www.aihr.com/sitemap.xml",
  "https://www.aihr.com/post-sitemap.xml",
  "https://www.aihr.com/blog/",
  "https://www.aihr.com/",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function snippet(text, n = 700) {
  return text.replace(/\s+/g, " ").slice(0, n);
}

async function probe(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const body = await res.text();
    return {
      url,
      status: res.status,
      finalUrl: res.url,
      type: res.headers.get("content-type") || "",
      bytes: body.length,
      ms: Date.now() - t0,
      body,
    };
  } catch (err) {
    return { url, status: 0, error: String(err && err.message || err), ms: Date.now() - t0 };
  }
}

// 피드/사이트맵에서 링크가 몇 개나 나오는지 세어 본다.
function countLinks(body, type) {
  if (!body) return null;
  const isXml = /xml/i.test(type) || body.trimStart().startsWith("<?xml");
  if (isXml) {
    const items = (body.match(/<item[\s>]/gi) || []).length;
    const entries = (body.match(/<entry[\s>]/gi) || []).length;
    const locs = (body.match(/<loc>/gi) || []).length;
    return { rssItems: items, atomEntries: entries, sitemapLocs: locs };
  }
  const hrefs = body.match(/href="https?:\/\/(?:www\.)?aihr\.com\/[^"]+"/gi) || [];
  const uniq = [...new Set(hrefs.map((h) => h.slice(6, -1)))];
  return { htmlLinks: uniq.length, sample: uniq.slice(0, 8) };
}

console.log("=".repeat(70));
console.log("AIHR 소스 정찰  —  " + new Date().toISOString());
console.log("=".repeat(70));

for (const url of CANDIDATES) {
  const r = await probe(url);
  console.log("\n" + "-".repeat(70));
  console.log(`URL    ${r.url}`);
  if (r.error) {
    console.log(`실패   ${r.error}  (${r.ms}ms)`);
    await sleep(1500);
    continue;
  }
  console.log(`상태   ${r.status}   ${r.type}   ${r.bytes} bytes   ${r.ms}ms`);
  if (r.finalUrl !== r.url) console.log(`리다이렉트 → ${r.finalUrl}`);

  const links = countLinks(r.body, r.type);
  if (links) console.log("링크   " + JSON.stringify(links, null, 0));

  // robots.txt 는 전문을 본다. 크롤링 허용 범위를 확인해야 하므로.
  if (r.url.endsWith("robots.txt")) {
    console.log("--- robots.txt 전문 ---");
    console.log(r.body.slice(0, 3000));
    console.log("--- 끝 ---");
  } else {
    console.log("본문   " + snippet(r.body));
  }
  await sleep(1500); // 예의상 간격
}

console.log("\n" + "=".repeat(70));
console.log("정찰 완료");
