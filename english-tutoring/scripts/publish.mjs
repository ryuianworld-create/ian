// data/ 의 작업 데이터를 docs/ 로 옮긴다.
// GitHub Pages 는 docs/ 만 서빙하므로, 화면이 읽을 파일은 여기 있어야 한다.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs", "data");
fs.mkdirSync(OUT, { recursive: true });

// 슬러그에서 만든 제목의 약어를 바로잡는다. "Hr Skills" → "HR Skills"
const ACRONYMS = {
  Hr: "HR", Kpi: "KPI", Kpis: "KPIs", Roi: "ROI", Ai: "AI", Hris: "HRIS",
  Hrbp: "HRBP", Dei: "DEI", Ceo: "CEO", Chro: "CHRO", Okr: "OKR", Okrs: "OKRs",
  Us: "US", Uk: "UK", Faq: "FAQ", Pto: "PTO", Ats: "ATS", Lms: "LMS", Enps: "eNPS",
};
const fixTitle = (t) => t.split(" ").map((w) => ACRONYMS[w] || w).join(" ");

const index = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "index.json"), "utf8"));
const slim = index.map((e) => ({
  url: e.url,
  title: fixTitle(e.title),
  published: e.published,
  source: e.source,
}));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(slim) + "\n");

const articlesPath = path.join(OUT, "articles.json");
const articles = fs.existsSync(articlesPath) ? JSON.parse(fs.readFileSync(articlesPath, "utf8")) : [];

fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({
  updatedAt: new Date().toISOString().slice(0, 10),
  // 화면에 찍어 두면 지금 보는 것이 어느 빌드인지 바로 알 수 있다
  builtAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  indexCount: slim.length,
  articleCount: articles.length,
  vocabCount: articles.reduce((n, a) => n + (a.vocab?.length || 0), 0),
}, null, 2) + "\n");

console.log(`목록 ${slim.length}건, 요약 ${articles.length}건 → docs/data/`);
