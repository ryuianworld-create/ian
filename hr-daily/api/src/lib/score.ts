// inbox.score — SPEC 「잡 상세 > collect」 의 공식. collect 와 import-legacy 가 같은 함수를 쓴다.
import { daysBetween, kstToday } from "./kst";

export const TITLE_BONUS_KEYWORDS = [
  "ai", "strategy", "strategic", "evidence", "meta-analysis", "workforce", "skills",
  "retention", "performance", "future", "operating model", "analytics", "burnout", "remote", "hybrid",
];

export type ScoreInput = {
  weight: number | string;
  published: string | null; // YYYY-MM-DD
  title: string;
  chars: number;
  today?: string; // 테스트·재현용
};

/** 제목에 키워드가 단어 단위로 포함되는지 ("ai" 가 "training" 에 걸리지 않게) */
function hasKeyword(title: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(title);
}

export function computeScore(input: ScoreInput): number {
  const weight = Number(input.weight) || 0;
  const today = input.today ?? kstToday();

  let recency = 0;
  if (input.published) {
    const age = daysBetween(today, input.published);
    recency = age <= 7 ? 5 : age <= 30 ? 3 : 0;
  }

  let bonus = 0;
  for (const kw of TITLE_BONUS_KEYWORDS) {
    if (hasKeyword(input.title, kw)) bonus++;
    if (bonus >= 3) break;
  }

  const long = input.chars > 8000 ? 1 : 0;
  // numeric 컬럼. 소수 둘째 자리까지
  return Math.round((weight * 10 + recency + bonus + long) * 100) / 100;
}
