// settings 테이블 읽기. 함수 인스턴스 안에서 60초 캐시(크론·요청마다 다시 읽지 않도록).
import { db, unwrapMaybe } from "./supabase";

type Cached = { value: unknown; at: number };
const cache = new Map<string, Cached>();
const TTL_MS = 60_000;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const row = unwrapMaybe(
    await db().from("settings").select("value").eq("key", key).maybeSingle<{ value: unknown }>(),
    `settings.${key}`,
  );
  const value = row ? (row.value as T) : fallback;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function freeArticleLimit(): Promise<number> {
  const v = await getSetting<unknown>("free_article_limit", 5);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5;
}

/** 논문 우선 요일 (KST, 0=일). 기본 화·금 */
export async function paperWeekdays(): Promise<number[]> {
  const v = await getSetting<unknown>("paper_weekdays", [2, 5]);
  return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6) : [2, 5];
}
