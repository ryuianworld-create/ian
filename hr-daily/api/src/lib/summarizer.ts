// OpenAI 요약기. Responses API 의 Structured Outputs(text.format = json_schema, strict) 로 SPEC 의 출력 스키마를 그대로 받는다.
//  - openai SDK: client.responses.create({ model, instructions, input, text: { format }, reasoning, max_output_tokens, store: false })
//  - status !== "completed" 이면 실패 처리. 응답은 zod 로 다시 검증한다(개수 제한 등은 strict 스키마가 표현하지 못하므로).
//  - 후처리: body HTML 정리, data-w ↔ vocab 대조(없으면 span 을 벗김), 개수 검증(vocab 8개 미만이면 실패)
import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env.js";
import { EXAMPLE_OUTPUT, EXAMPLE_TITLE } from "./example.js";
import { AREAS, AREA_ORDER, isArea, type Area } from "./areas.js";
import type { DetailSection, Finding, Kind, Lang, VocabEntry } from "../types.js";

export const DEFAULT_MODEL = "gpt-5.4"; // OPENAI_MODEL 로 변경. 비용을 낮추려면 gpt-5.4-mini
export const DEFAULT_FALLBACK_MODEL = "gpt-5.4-mini"; // 기본 모델이 일시 오류(429·5xx·시간 초과)일 때 한 번 더 시도할 모델. OPENAI_FALLBACK_MODEL=none 이면 같은 모델로 경량 재시도

// ---- 출력 스키마 (SPEC「잡 상세 > summarize」). 개수 제한은 API 가 지원하지 않으므로 후처리에서 검증한다 ----
const LangSchema = z.object({
  ko: z.string().describe("Korean"),
  en: z.string().describe("English"),
});

export const SummarySchema = z.object({
  category: z.string().describe('Short English topic label, e.g. "HR Strategy", "Talent Acquisition", "Organizational Behavior"'),
  area: z
    .enum(["hiring", "comp", "performance", "learning", "leadership", "culture", "wellbeing", "strategy", "tech", "labor", "work", "careers"])
    .describe("Primary HR area of the text (see the AREA LIST in the instructions). Judge from the whole text, not the title."),
  area2: z
    .enum(["hiring", "comp", "performance", "learning", "leadership", "culture", "wellbeing", "strategy", "tech", "labor", "work", "careers", "none"])
    .describe('Secondary HR area if the text clearly spans two areas, otherwise "none".'),
  summary: LangSchema.describe("ko: 500-800 Korean characters. en: 180-280 words. Plain text, no HTML."),
  findings: z
    .array(
      z.object({
        k: LangSchema.describe(
          'Key figure or short label. For a number, ko and en are identical ("64%", "$1.6M", "n=1,204"). For a text label, ko is at most 8 Korean characters and en at most 3 English words with the same meaning.',
        ),
        ko: z.string().describe("One or two Korean sentences explaining the figure"),
        en: z.string().describe("One or two English sentences explaining the figure"),
      }),
    )
    .describe("2 to 4 key numbers/facts from the text"),
  detail: z
    .array(
      z.object({
        h: LangSchema.describe("Section heading"),
        body: LangSchema.describe(
          'Section body as HTML. Allowed tags only: <ul><li><b><i><br> and <span class="vw" data-w="WORD">…</span> around vocabulary words.',
        ),
      }),
    )
    .describe('4 to 6 sections. The last one must be "HR 시사점" / "Takeaway for HR".'),
  vocab: z
    .array(
      z.object({
        w: z.string().describe("The term, lowercase unless a proper noun/acronym, exactly as used in data-w"),
        pos: z.string().describe('Part of speech: "n.", "v.", "adj.", "adv.", "phr."'),
        ko: z.string().describe("Korean gloss — 뜻 + 짧은 설명"),
        en: z.string().describe("Plain-English definition, one sentence"),
        ex: z.string().describe("Example sentence as HTML with the term wrapped in <b>…</b>"),
      }),
    )
    .describe("8 to 12 HR/management terms that actually appear in the text"),
});

type RawSummary = z.infer<typeof SummarySchema>;
export type SummaryOutput = Omit<RawSummary, "area" | "area2"> & { area: Area | null; area2: Area | null };

export type SummarizeInput = {
  title: string;
  url: string;
  source_name: string;
  kind: Kind;
  published: string | null;
  category: string | null;
  raw_text: string;
};

export type SummarizeResult = {
  output: SummaryOutput;
  model: string;
  tokens_in: number;
  tokens_out: number;
  warnings: string[];
};

// ---- 프롬프트 ----

const SYSTEM_PROMPT = `You write the daily issue of "dailyHR": a Korean HR professional reads one HR article or academic paper a day, in Korean and in English, and learns the HR vocabulary in it.

Produce a JSON object matching the provided schema. Requirements:

1. summary.ko: 500–800 Korean characters (공백 포함), 자연스러운 한국어 해요체가 아닌 서술체(~다). summary.en: 180–280 words. Both must stand alone: what the piece argues, the key evidence, and what it means for HR.
2. findings: 2–4 items. k.ko / k.en is the number or short label. For numbers, both are the same string as it appears ("64%", "$1.6M", "n=1,204"); for text labels, k.ko is Korean (≤ 8 chars) and k.en is English (≤ 3 words) with the same meaning — never mix languages in one label. If the text has no numbers, use short labels for the central claims.
3. detail: 4–6 sections, each with ko and en versions of the same content. body is HTML using ONLY <ul>, <li>, <b>, <i>, <br> and the vocabulary span described below. No <p>, no headings, no links. Use <ul><li> for lists and <b> for emphasis, like the example.
   - For an article: follow the structure of the argument (why it matters → the core idea → how to apply → pitfalls → takeaway).
   - For a paper (kind=paper): 연구 질문 → 방법·표본 → 핵심 결과 → 실무 시사점 (research question, method & sample, key results, implications for practice), then the takeaway.
   - The LAST section must be titled exactly "HR 시사점" (ko) / "Takeaway for HR" (en): 3–5 concrete points an HR practitioner in Korea can act on.
4. vocab: 8–12 HR / management / research terms that actually occur in the text and are worth learning (prefer multi-word HR terms like "operating model", "center of expertise", "psychological safety"; avoid trivial words). w is the canonical form (singular, lowercase unless acronym/proper noun). pos is "n.", "v.", "adj.", "adv." or "phr.". ko = Korean meaning + short gloss. en = one-sentence plain-English definition. ex = one example sentence as HTML with the term in <b>…</b>; write a fresh sentence, do not copy the source.
5. Vocabulary spans: inside detail.body (BOTH ko and en), wrap the place where each vocab term occurs as <span class="vw" data-w="{w}">{text as it appears}</span>, with data-w exactly equal to vocab.w. In the Korean body, use the English term itself at that spot (e.g. 'HR <span class="vw" data-w="operating model">operating model</span>은 …'). Every vocab term should appear in at least one span; do not create spans for words that are not in vocab. Wrap each occurrence at most once per section.
6. Summarize and restate in your own words. Do not copy sentences from the source verbatim. Do not invent numbers that are not in the text. Keep company and author names as they are.
7. category: a short English topic label (2–3 words).
8. area / area2: classify the text into the HR AREA LIST below. area is the single area that best describes what the text is mainly about, judged from the whole text (research question, findings, recommendations), never from the title or the source alone. area2 is a second area only when the text genuinely spans two (e.g. a paper on parental leave policy and its effect on wellbeing → area "labor", area2 "wellbeing"); otherwise "none".

AREA LIST:
${AREA_ORDER.map((id) => `- "${id}" = ${AREAS[id].en} (${AREAS[id].ko}): ${AREAS[id].desc}`).join("\n")}

Match the tone, depth and length of the example below. The example is trimmed (one section, two vocab entries) — your output must have the full counts above.`;

function exampleBlock(): string {
  return `<example title=${JSON.stringify(EXAMPLE_TITLE)}>\n${JSON.stringify(EXAMPLE_OUTPUT, null, 2)}\n</example>`;
}

/** 모델에 넣는 본문 상한(자). 긴 아티클은 앞부분만으로도 요약이 충분하고, 전체를 넣으면 응답이 4분을 넘긴다 */
const RAW_INPUT_LIMIT = Number(process.env.SUMMARIZE_INPUT_LIMIT) > 0 ? Number(process.env.SUMMARIZE_INPUT_LIMIT) : 14_000;

function userPrompt(input: SummarizeInput): string {
  const meta = [
    `kind: ${input.kind}`,
    `source: ${input.source_name}`,
    `title: ${input.title}`,
    `url: ${input.url}`,
    input.published ? `published: ${input.published}` : null,
    input.category ? `feed category: ${input.category}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const text = input.raw_text.length > RAW_INPUT_LIMIT ? `${input.raw_text.slice(0, RAW_INPUT_LIMIT)}\n\n[text truncated at ${RAW_INPUT_LIMIT} characters]` : input.raw_text;
  return `Summarize the following ${input.kind === "paper" ? "academic paper (abstract/text)" : "article"} for dailyHR.\n\n<meta>\n${meta}\n</meta>\n\n<text>\n${text}\n</text>`;
}

// ---- 후처리 ----

const VW_OPEN_RE = /<span\s+class="vw"\s+data-w="([^"]*)"\s*>/gi;

/** 허용 태그만 남긴다: ul li b i br + vw span. strong→b, em→i. 나머지 태그는 제거(내용은 유지) */
export function sanitizeBody(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(\/?)strong\b[^>]*>/gi, "<$1b>")
    .replace(/<(\/?)em\b[^>]*>/gi, "<$1i>")
    .replace(/<\/?(p|div)\b[^>]*>/gi, "")
    .replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (tag: string, close: string, name: string, attrs: string) => {
      const n = name.toLowerCase();
      if (n === "br") return "<br>";
      if (n === "ul" || n === "li" || n === "b" || n === "i") return `<${close}${n}>`;
      if (n === "span") {
        if (close) return "</span>";
        const m = attrs.match(/data-w\s*=\s*"([^"]*)"/i) ?? attrs.match(/data-w\s*=\s*'([^']*)'/i);
        if (/class\s*=\s*["']vw["']/i.test(attrs) && m && m[1] !== undefined) {
          return `<span class="vw" data-w="${m[1].replace(/"/g, "&quot;")}">`;
        }
        return ""; // 알 수 없는 span 은 벗긴다. 짝이 되는 </span> 은 아래에서 정리
      }
      return "";
    })
    .replace(/<\/span>/gi, (m, offset: number, s: string) => {
      // 여는 span 수보다 닫는 span 이 많으면 잉여 닫는 태그 제거
      const before = s.slice(0, offset);
      const opens = (before.match(/<span class="vw"/g) ?? []).length;
      const closes = (before.match(/<\/span>/gi) ?? []).length;
      return opens > closes ? m : "";
    });
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** data-w 가 vocab 에 없으면 span 을 벗기고, 있으면 data-w 를 vocab.w 의 표기로 맞춘다 */
export function reconcileSpans(html: string, canonical: Map<string, string>, warnings: string[]): string {
  const out = html.replace(VW_OPEN_RE, (_m, w: string) => {
    const c = canonical.get(norm(w));
    if (c) return `<span class="vw" data-w="${c}">`;
    warnings.push(`vocab 에 없는 data-w 제거: ${w}`);
    return "<span data-strip>";
  });
  // <span data-strip>…</span> 을 내용만 남기고 벗긴다 (중첩 없음 가정)
  return out.replace(/<span data-strip>([\s\S]*?)<\/span>/g, "$1");
}

export function postValidate(raw: RawSummary): { output: SummaryOutput; warnings: string[] } {
  const warnings: string[] = [];

  const summary: Lang = { ko: raw.summary.ko.trim(), en: raw.summary.en.trim() };
  if (!summary.ko || !summary.en) throw new Error("summary 가 비어 있다");

  // vocab: 중복 제거, 12개 초과 시 자름
  const seen = new Set<string>();
  const vocab: VocabEntry[] = [];
  for (const v of raw.vocab) {
    const w = v.w.trim().replace(/\s+/g, " ");
    if (!w || seen.has(norm(w))) continue;
    seen.add(norm(w));
    vocab.push({ w, pos: v.pos.trim(), ko: v.ko.trim(), en: v.en.trim(), ex: sanitizeBody(v.ex.trim()) });
  }
  if (vocab.length > 12) { warnings.push(`vocab ${vocab.length}개 → 12개로 자름`); vocab.length = 12; }
  if (vocab.length < 8) throw new Error(`vocab 이 ${vocab.length}개 — 8개 미만`);
  const canonical = new Map(vocab.map((v) => [norm(v.w), v.w] as const));

  const detail: DetailSection[] = raw.detail
    .map((d) => ({
      h: { ko: d.h.ko.trim(), en: d.h.en.trim() },
      body: {
        ko: reconcileSpans(sanitizeBody(d.body.ko.trim()), canonical, warnings),
        en: reconcileSpans(sanitizeBody(d.body.en.trim()), canonical, warnings),
      },
    }))
    .filter((d) => d.body.ko && d.body.en);
  if (detail.length < 1) throw new Error("detail 섹션이 없다");
  if (detail.length > 6) { warnings.push(`detail ${detail.length}개 → 6개로 자름`); detail.length = 6; }
  if (detail.length < 4) warnings.push(`detail 이 ${detail.length}개 (4개 미만)`);

  const findings: Finding[] = raw.findings
    .map((f) => {
      const kko = f.k.ko.trim(), ken = f.k.en.trim();
      return { k: { ko: kko || ken, en: ken || kko }, ko: f.ko.trim(), en: f.en.trim() };
    })
    .filter((f) => f.k.ko && (f.ko || f.en));
  if (findings.length > 4) { warnings.push(`findings ${findings.length}개 → 4개로 자름`); findings.length = 4; }
  if (findings.length < 2) warnings.push(`findings 가 ${findings.length}개 (2개 미만)`);

  const koLen = summary.ko.length;
  const enWords = summary.en.split(/\s+/).filter(Boolean).length;
  if (koLen < 400 || koLen > 1000) warnings.push(`summary.ko ${koLen}자 (권장 500~800)`);
  if (enWords < 150 || enWords > 320) warnings.push(`summary.en ${enWords}단어 (권장 180~280)`);

  // 사용되지 않은 단어 경고(실패는 아님)
  const allBody = detail.map((d) => d.body.ko + d.body.en).join(" ");
  for (const v of vocab) if (!allBody.includes(`data-w="${v.w}"`)) warnings.push(`본문에 span 없는 단어: ${v.w}`);

  const area: Area | null = isArea(raw.area) ? raw.area : null;
  if (!area) warnings.push(`area 값이 올바르지 않음: ${String(raw.area)}`);
  const area2: Area | null = isArea(raw.area2) && raw.area2 !== area ? raw.area2 : null;
  return { output: { category: raw.category.trim(), area, area2, summary, findings, detail, vocab }, warnings };
}

// ---- 호출 ----

let openai: OpenAI | null = null;
function client(): OpenAI {
  if (!openai) {
    // 두 이름 중 먼저 설정된 것을 쓴다 (Vercel 대시보드에 OpenAI_API 로 넣은 경우 대응)
    const apiKey = env("OPENAI_API_KEY") ?? env("OpenAI_API");
    if (!apiKey) throw new Error("환경변수 OPENAI_API_KEY 이(가) 설정되지 않았다");
    // 재시도는 summarizeText 가 시간 예산 안에서 직접 한다 (SDK 기본 재시도 2회는 Vercel 300초 제한을 넘길 수 있다)
    openai = new OpenAI({ apiKey, timeout: 270_000, maxRetries: 0 });
  }
  return openai;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** 모델에 아주 짧은 요청을 보내 응답 시간과 오류를 돌려준다. API 키·모델 이름·요금 한도 확인용 */
export async function pingModel(model: string, timeoutMs = 40_000): Promise<{ model: string; ok: boolean; ms: number; detail: string }> {
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      client().responses.create(
        { model, input: "Reply with the single word: pong", reasoning: { effort: "low" }, max_output_tokens: 256, store: false },
        { timeout: timeoutMs },
      ),
      timeoutMs,
    );
    const text = (res.output_text ?? "").trim().slice(0, 40);
    return { model: res.model || model, ok: res.status === "completed", ms: Date.now() - t0, detail: res.status === "completed" ? `응답: ${text}` : `상태 ${res.status}` };
  } catch (e) {
    return { model, ok: false, ms: Date.now() - t0, detail: errMsg(e).slice(0, 220) };
  }
}

export function modelName(): string {
  return env("OPENAI_MODEL") ?? DEFAULT_MODEL;
}

export type Effort = "minimal" | "low" | "medium" | "high";

/** 추론 깊이. 기본 medium. OPENAI_REASONING 으로 변경(minimal·low·medium·high). high 는 응답이 길어져 Vercel 300초 제한에 가까워진다 */
export function reasoningEffort(): Effort {
  const v = (env("OPENAI_REASONING") ?? "medium").toLowerCase();
  return v === "minimal" || v === "low" || v === "high" ? v : "medium";
}

/** 예비 모델. OPENAI_FALLBACK_MODEL 이 none/off 이거나 기본 모델과 같으면 null(같은 모델 경량 재시도) */
export function fallbackModelName(): string | null {
  const v = env("OPENAI_FALLBACK_MODEL");
  const name = v === undefined ? DEFAULT_FALLBACK_MODEL : v.trim();
  if (!name || /^(none|off)$/i.test(name) || name === modelName()) return null;
  return name;
}

/** 서버 과부하·요청 한도·네트워크 같은 일시 오류인가 (후보 글의 잘못이 아니므로 failed 로 두지 않는다) */
export function isTransientError(e: unknown): boolean {
  if (e instanceof SummarizeTimeout) return true;
  if (e instanceof OpenAI.APIConnectionError) return true; // 네트워크 끊김·SDK 타임아웃
  if (e instanceof OpenAI.APIError) {
    const s = e.status ?? 0;
    return s === 408 || s === 409 || s === 429 || s >= 500; // 429 는 분당 한도와 결제 한도(insufficient_quota) 모두 — 어느 쪽이든 글 탓이 아니다
  }
  return /^(429|50[0234])\b|overloaded|server_error|rate limit|ECONNRESET|ETIMEDOUT|fetch failed/i.test(errMsg(e));
}

export class TransientSummarizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientSummarizeError";
  }
}

/** zod → JSON Schema (Structured Outputs strict 용). 모든 객체에 additionalProperties:false 와 전 속성 required 를 보장하고 $schema 는 뺀다 */
export function responseJsonSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(SummarySchema, { target: "draft-2020-12" }) as Record<string, unknown>;
  const strict = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strict);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "$schema" || k === "$id") continue;
      // properties 의 키는 필드 이름이므로 값만 재귀한다
      out[k] = k === "properties" && v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, strict(pv)]))
        : strict(v);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as Record<string, unknown>);
    }
    return out;
  };
  return strict(raw) as Record<string, unknown>;
}

export class SummarizeTimeout extends Error {
  constructor(ms: number) {
    super(`OpenAI 응답 ${Math.round(ms / 1000)}초 초과 — 중단`);
    this.name = "SummarizeTimeout";
  }
}

/** p 가 ms 안에 끝나지 않으면 SummarizeTimeout 으로 거부한다. (끝나지 않은 요청은 그대로 버린다) */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SummarizeTimeout(ms)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export type SummarizeOptions = { timeoutMs?: number };

/** 기본 모델로 시도하고, 일시 오류면 예비 모델로 한 번 더. 둘 다 일시 오류면 TransientSummarizeError */
export async function summarizeText(input: SummarizeInput, log?: (m: string) => void, opts: SummarizeOptions = {}): Promise<SummarizeResult> {
  const started = Date.now();
  const total = opts.timeoutMs ?? 240_000;
  const fallback = fallbackModelName(); // 없으면 같은 모델 경량 재시도
  // 1차에는 전체 시간의 60% 만 준다. 응답이 늦거나 과부하면 남은 40% 로 재시도(예비 모델, 또는 같은 모델에 reasoning low·입력 절반).
  const primaryMs = Math.round(total * 0.6);
  try {
    return await summarizeWith(modelName(), input, log, { timeoutMs: primaryMs });
  } catch (e) {
    if (!isTransientError(e)) throw e;
    const remaining = total - (Date.now() - started);
    const msg = errMsg(e);
    if (remaining < 45_000) throw new TransientSummarizeError(msg);
    const retryModel = fallback ?? modelName();
    const light = !fallback;
    log?.(`  ⚠ 일시 오류(${msg.slice(0, 80)}) → ${light ? `${retryModel} 경량 재시도(reasoning low·입력 절반)` : `예비 모델 ${retryModel}`} (남은 ${Math.round(remaining / 1000)}초)`);
    try {
      const retryInput = light ? { ...input, raw_text: input.raw_text.slice(0, Math.max(4_000, Math.floor(RAW_INPUT_LIMIT / 2))) } : input;
      return await summarizeWith(retryModel, retryInput, log, { timeoutMs: remaining - 5_000, effort: light ? "low" : undefined });
    } catch (e2) {
      const m2 = errMsg(e2);
      if (isTransientError(e2)) throw new TransientSummarizeError(`${msg} / 예비(${retryModel}): ${m2}`);
      throw e2;
    }
  }
}

async function summarizeWith(model: string, input: SummarizeInput, log: ((m: string) => void) | undefined, opts: { timeoutMs: number; effort?: Effort }): Promise<SummarizeResult> {
  const timeoutMs = opts.timeoutMs;

  const res = await withTimeout(
    client().responses.create(
      {
        model,
        instructions: SYSTEM_PROMPT + "\n\n" + exampleBlock(),
        input: userPrompt(input),
        text: { format: { type: "json_schema", name: "dailyhr_summary", schema: responseJsonSchema(), strict: true } },
        reasoning: { effort: opts.effort ?? reasoningEffort() },
        max_output_tokens: 32_000, // 추론 토큰도 여기에 포함된다
        store: false, // 원문을 OpenAI 쪽에 남기지 않는다(저작권·개인정보)
      },
      { timeout: timeoutMs },
    ),
    timeoutMs,
  );

  if (res.status !== "completed") {
    const reason = res.incomplete_details?.reason;
    throw new Error(`OpenAI 응답 상태 ${res.status}${reason ? ` (${reason})` : ""}`);
  }
  const refusal = res.output.flatMap((o) => (o.type === "message" ? o.content : [])).find((c) => c.type === "refusal");
  if (refusal) throw new Error(`모델이 요약을 거부함: ${refusal.refusal.slice(0, 160)}`);
  const text = res.output_text?.trim();
  if (!text) throw new Error("OpenAI 가 빈 응답을 돌려줌");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI 출력이 JSON 이 아님: ${text.slice(0, 120)}…`);
  }
  const parsed = SummarySchema.safeParse(json);
  if (!parsed.success) throw new Error(`구조화 출력 스키마 불일치: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);

  const usage = res.usage;
  const tokens_in = usage?.input_tokens ?? 0;
  const tokens_out = usage?.output_tokens ?? 0; // 추론 토큰 포함
  const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? 0;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const servedModel = res.model || model;
  log?.(`  모델 ${servedModel} — in ${tokens_in} (cached ${cached}) / out ${tokens_out} 토큰 (reasoning ${reasoningTokens})`);

  const { output, warnings } = postValidate(parsed.data);
  for (const w of warnings) log?.(`  ⚠ ${w}`);
  return { output, model: servedModel, tokens_in, tokens_out, warnings };
}
