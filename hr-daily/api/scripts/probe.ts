// 피드 파서 점검 — DB 없이 실제 피드를 받아 파싱 결과만 출력한다.
//   npm run probe            기본 두 피드(AIHR, Wiley HRM)
//   npm run probe -- <url…>  임의 피드
import { PAPER_SKIP_TITLE_RE, get, htmlToText, parseFeed } from "../src/lib/feed";
import { toDate } from "../src/lib/kst";
import { computeScore } from "../src/lib/score";

const DEFAULT = [
  { url: "https://www.aihr.com/feed/", kind: "article" as const, weight: 1.0 },
  { url: "https://onlinelibrary.wiley.com/feed/1099050x/most-recent", kind: "paper" as const, weight: 1.3 },
];
const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((url) => ({ url, kind: /wiley|doi/i.test(url) ? ("paper" as const) : ("article" as const), weight: 1 }))
  : DEFAULT;

for (const t of targets) {
  console.log(`\n=== ${t.url}  (${t.kind})`);
  let xml: string;
  try {
    xml = await get(t.url);
  } catch (e) {
    console.log(`  ✗ 요청 실패: ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }
  const items = parseFeed(xml);
  console.log(`  ${xml.length.toLocaleString()} bytes → ${items.length}건`);
  for (const it of items) {
    const text = htmlToText(it.html || "");
    const published = toDate(it.published);
    const flags: string[] = [];
    if (t.kind === "paper") {
      if (PAPER_SKIP_TITLE_RE.test(it.title)) flags.push("skip:제목");
      if (text.length < 400) flags.push("skip:초록<400");
    } else {
      if (text.length < 1200) flags.push("page-fetch(<1200)");
      if (text.length < 800) flags.push("skip:<800");
    }
    const score = computeScore({ weight: t.weight, published, title: it.title, chars: text.length });
    console.log(
      `  · ${published ?? "----------"}  ${String(text.length).padStart(6)}자  score ${String(score).padStart(5)}  ${it.title.slice(0, 70)}` +
        (it.category ? `  [${it.category.slice(0, 24)}]` : "") +
        (flags.length ? `  {${flags.join(",")}}` : ""),
    );
    if (!it.url.startsWith("http")) console.log(`    ⚠ url 이상: ${it.url}`);
  }
  const first = items[0];
  if (first) {
    console.log(`\n  --- 첫 항목 미리보기 (${first.url}) ---`);
    console.log("  " + htmlToText(first.html || "").slice(0, 600).replace(/\n/g, "\n  "));
  }
}
