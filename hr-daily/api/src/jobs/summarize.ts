// summarize — 대상 날짜(KST 오늘 또는 지정일)에 아티클이 없으면 inbox 에서 한 편 골라 Claude 로 요약한다.
// 실패하면 그 inbox 는 failed 로 두고 다음 후보로 1회 재시도.
// 시간 예산(기본 280초, Vercel maxDuration 300초 안)을 지켜서 함수가 통째로 죽어 로그·상태가 안 남는 일을 막는다.
import { isValidDate, kstToday, weekdayOf } from "../lib/kst.js";
import { paperWeekdays } from "../lib/settings.js";
import { TransientSummarizeError, summarizeText } from "../lib/summarizer.js";
import { env } from "../lib/env.js";
import { db, unwrap, unwrapMaybe } from "../lib/supabase.js";
import type { InboxRow, Kind } from "../types.js";
import type { Log } from "./run.js";

export type SummarizeParams = { inbox_id?: string; featured_date?: string; budgetMs?: number };
export type SummarizeResult =
  | { status: "skipped"; reason: string; featured_date: string }
  | { status: "done"; featured_date: string; article_id: string; inbox_id: string; model: string }
  | { status: "failed"; featured_date: string; tried: string[] };

type Candidate = Pick<InboxRow, "id" | "source_id" | "source_name" | "kind" | "title" | "url" | "category" | "published" | "raw_text" | "chars" | "score">;
const CANDIDATE_COLUMNS = "id,source_id,source_name,kind,title,url,category,published,raw_text,chars,score";

async function pickCandidate(opts: { preferPaper: boolean; exclude: string[] }): Promise<Candidate | null> {
  // 상위 몇 건을 받아 제외 목록(실패한 후보)은 메모리에서 거른다
  const top = async (kind?: Kind): Promise<Candidate | null> => {
    const rows = unwrap(
      await db()
        .from("inbox")
        .select(CANDIDATE_COLUMNS)
        .match({ status: "pending", ...(kind ? { kind } : {}) })
        .not("raw_text", "is", null)
        .order("score", { ascending: false })
        .order("collected_at", { ascending: false })
        .limit(opts.exclude.length + 3),
      `inbox.pick(${kind ?? "any"})`,
    ) as Candidate[];
    return rows.find((r) => !opts.exclude.includes(r.id)) ?? null;
  };
  if (opts.preferPaper) {
    const paper = await top("paper");
    if (paper) return paper;
  }
  return top();
}

/** articles.id 가 겹치면 -2, -3 … 을 붙인다 (legacy 와 같은 slug 가 다시 수집된 경우 등) */
async function uniqueArticleId(base: string): Promise<string> {
  let id = base;
  for (let i = 2; i < 50; i++) {
    const hit = unwrapMaybe(await db().from("articles").select("id").eq("id", id).maybeSingle<{ id: string }>(), "articles.id");
    if (!hit) return id;
    id = `${base}-${i}`;
  }
  throw new Error(`article id 를 만들 수 없다: ${base}`);
}

/** 잡 전체 시간 예산(ms). SUMMARIZE_BUDGET_MS 로 조정. 로컬 실행 등 제한이 없으면 크게 잡는다 */
function budgetMs(): number {
  const n = Number(env("SUMMARIZE_BUDGET_MS"));
  return Number.isFinite(n) && n > 0 ? n : 280_000;
}
const MIN_ATTEMPT_MS = 90_000; // 이보다 적게 남으면 새 시도를 시작하지 않는다
const MAX_ATTEMPT_MS = 240_000;

export async function summarizeJob(log: Log, params: SummarizeParams = {}): Promise<SummarizeResult> {
  const startedAt = Date.now();
  const deadline = startedAt + (params.budgetMs ?? budgetMs());
  const featured_date = params.featured_date ?? kstToday();
  if (!isValidDate(featured_date)) throw new Error(`featured_date 가 올바르지 않다: ${featured_date}`);
  log(`대상 날짜 ${featured_date}${params.inbox_id ? `, 지정 inbox ${params.inbox_id}` : ""}`);

  const existing = unwrapMaybe(
    await db().from("articles").select("id,title").eq("featured_date", featured_date).maybeSingle<{ id: string; title: string }>(),
    "articles.byDate",
  );
  if (existing) {
    log(`이미 아티클이 있다: ${existing.id} — 건너뜀`);
    return { status: "skipped", reason: `article exists: ${existing.id}`, featured_date };
  }

  const weekday = weekdayOf(featured_date);
  const preferPaper = (await paperWeekdays()).includes(weekday);
  log(`요일 ${weekday} → ${preferPaper ? "논문 우선" : "전체 점수순"}`);

  const tried: string[] = [];
  let transient = false;
  const MAX_ATTEMPTS = params.inbox_id ? 1 : 2; // 지정 글이면 재시도 없음, 아니면 다음 후보로 1회

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let cand: Candidate | null;
    if (params.inbox_id) {
      cand = unwrapMaybe(
        await db().from("inbox").select(CANDIDATE_COLUMNS).eq("id", params.inbox_id).maybeSingle<Candidate>(),
        "inbox.byId",
      );
      if (!cand) throw new Error(`inbox ${params.inbox_id} 가 없다`);
      if (!cand.raw_text) throw new Error(`inbox ${params.inbox_id} 에 raw_text 가 없다(이미 처리됨)`);
    } else {
      cand = await pickCandidate({ preferPaper, exclude: tried });
    }
    if (!cand) {
      log(tried.length ? "다음 후보가 없다" : "요약할 pending 글이 없다");
      break;
    }
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      log(`남은 시간 ${Math.round(remaining / 1000)}초 — 추가 시도 없이 종료`);
      break;
    }
    tried.push(cand.id);
    const timeoutMs = Math.min(MAX_ATTEMPT_MS, remaining - 10_000);
    log(`[${attempt}/${MAX_ATTEMPTS}] ${cand.kind} · ${cand.source_name} · ${cand.title} (score ${cand.score}, ${cand.chars ?? 0}자, 제한 ${Math.round(timeoutMs / 1000)}초)`);

    try {
      const r = await summarizeText(
        {
          title: cand.title, url: cand.url, source_name: cand.source_name, kind: cand.kind,
          published: cand.published, category: cand.category, raw_text: cand.raw_text ?? "",
        },
        log,
        { timeoutMs },
      );

      const article_id = await uniqueArticleId(cand.id);
      unwrap(
        await db()
          .from("articles")
          .insert({
            id: article_id,
            source_id: cand.source_id,
            source_name: cand.source_name,
            kind: cand.kind,
            title: cand.title,
            url: cand.url,
            published: cand.published,
            category: r.output.category || cand.category,
            summary: r.output.summary,
            findings: r.output.findings,
            detail: r.output.detail,
            vocab: r.output.vocab,
            featured_date,
            model: r.model,
            tokens_in: r.tokens_in,
            tokens_out: r.tokens_out,
          })
          .select("id")
          .single(),
        "articles.insert",
      );
      // 원문은 요약이 끝나면 지운다(저작권)
      const { error } = await db()
        .from("inbox")
        .update({ status: "done", raw_text: null, processed_at: new Date().toISOString(), error: null })
        .eq("id", cand.id);
      if (error) log(`  ⚠ inbox 상태 갱신 실패: ${error.message}`);

      log(`✓ 저장: articles/${article_id} (${featured_date}), 단어 ${r.output.vocab.length}개`);
      return { status: "done", featured_date, article_id, inbox_id: cand.id, model: r.model };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof TransientSummarizeError) {
        // 모델 쪽 일시 오류: 후보 글은 pending 으로 남겨 다음 실행에서 다시 쓴다
        transient = true;
        log(`  ✗ 일시 오류(후보 유지): ${msg}`);
        await db().from("inbox").update({ error: msg.slice(0, 1000) }).eq("id", cand.id);
        if (attempt < MAX_ATTEMPTS && deadline - Date.now() > MIN_ATTEMPT_MS + 20_000) {
          log("  20초 뒤 다음 후보로 재시도");
          await new Promise((r) => setTimeout(r, 20_000));
        }
      } else {
        log(`  ✗ 실패: ${msg}`);
        await db().from("inbox").update({ status: "failed", error: msg.slice(0, 1000), processed_at: new Date().toISOString() }).eq("id", cand.id);
      }
    }
  }

  if (tried.length) throw new Error(`요약 실패${transient ? " (모델 일시 오류 — 후보는 유지됨)" : ""} (시도: ${tried.join(", ")})`);
  return { status: "skipped", reason: "no pending candidates", featured_date };
}
