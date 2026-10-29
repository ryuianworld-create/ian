// articles 행 → ArticleCard (SPEC). locked 면 summary/findings 를 뺀다.
import type { ArticleCard, ArticleRow, Finding, Lang } from "../types.js";

export const CARD_COLUMNS = "id,source_name,kind,title,url,published,category,team,featured_date,summary,findings,vocab";
export const ARTICLE_COLUMNS =
  "id,source_id,source_name,kind,title,url,published,category,team,featured_date,summary,findings,detail,vocab";

export type CardRow = Pick<
  ArticleRow,
  "id" | "source_name" | "kind" | "title" | "url" | "published" | "category" | "team" | "featured_date" | "summary" | "findings" | "vocab"
>;

export function toCard(row: CardRow, locked: boolean): ArticleCard {
  const base: ArticleCard = {
    id: row.id,
    source_name: row.source_name,
    kind: row.kind,
    title: row.title,
    url: row.url,
    published: row.published,
    category: row.category,
    team: row.team ?? null,
    featured_date: row.featured_date,
    vocab_count: Array.isArray(row.vocab) ? row.vocab.length : 0,
    locked,
  };
  if (!locked) {
    base.summary = row.summary;
    base.findings = normalizeFindings(row.findings);
  }
  return base;
}

/** 예전 행은 k 가 문자열("64%")이다. 항상 {ko,en} 으로 맞춰 돌려준다. */
export function normalizeFindings(raw: unknown): Finding[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<{ k: unknown; ko?: string; en?: string }>).map((f) => {
    const k =
      typeof f.k === "string"
        ? { ko: f.k, en: f.k }
        : f.k && typeof f.k === "object"
          ? { ko: String((f.k as Lang).ko ?? ""), en: String((f.k as Lang).en ?? "") }
          : { ko: "", en: "" };
    return { k, ko: f.ko ?? "", en: f.en ?? "" };
  });
}
