// articles 행 → ArticleCard (SPEC). locked 면 summary/findings 를 뺀다.
import type { ArticleCard, ArticleRow } from "../types";

export const CARD_COLUMNS = "id,source_name,kind,title,url,published,category,featured_date,summary,findings,vocab";
export const ARTICLE_COLUMNS =
  "id,source_id,source_name,kind,title,url,published,category,featured_date,summary,findings,detail,vocab";

export type CardRow = Pick<
  ArticleRow,
  "id" | "source_name" | "kind" | "title" | "url" | "published" | "category" | "featured_date" | "summary" | "findings" | "vocab"
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
    featured_date: row.featured_date,
    vocab_count: Array.isArray(row.vocab) ? row.vocab.length : 0,
    locked,
  };
  if (!locked) {
    base.summary = row.summary;
    base.findings = Array.isArray(row.findings) ? row.findings : [];
  }
  return base;
}
