// Claude 요약기. Structured Outputs(zodOutputFormat) 로 SPEC 의 출력 스키마를 그대로 받는다.
//  - beta 경로: client.beta.messages.parse + fallbacks:"default" (server-side-fallback-2026-07-01)
//  - stop_reason === "refusal" 이면 실패 처리. temperature·prefill 은 쓰지 않는다.
//  - 후처리: body HTML 정리, data-w ↔ vocab 대조(없으면 span 을 벗김), 개수 검증(vocab 8개 미만이면 실패)
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "./env";
import { EXAMPLE_OUTPUT, EXAMPLE_TITLE } from "./example";
import type { DetailSection, Finding, Kind, Lang, VocabEntry } from "../types";

export const DEFAULT_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// ---- 출력 스키마 (SPEC「잡 상세 > summarize」). 개수 제한은 API 가 지원하지 않으므로 후처리에서 검증한다 ----
const LangSchema = z.object({
  ko: z.string().describe("Korean"),
  en: z.string().describe("English"),
});

export const SummarySchema = z.object({
  category: z.string().describe('Short English topic label, e.g. "HR Strategy", "Talent Acquisition", "Organizational Behavior"'),
  summary: LangSchema.describe("ko: 500-800 Korean characters. en: 180-280 words. Plain text, no HTML."),
  findings: z
    .array(
      z.object({
        k: z.string().describe('Key figure or short label, e.g. "64%", "$1.6M", "n=1,204"'),
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

export type SummaryOutput = z.infer<typeof SummarySchema>;

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

const SYSTEM_PROMPT = `You write the daily issue of "HR Daily": a Korean HR professional reads one HR article or academic paper a day, in Korean and in English, and learns the HR vocabulary in it.

Produce a JSON object matching the provided schema. Requirements:

1. summary.ko: 500–800 Korean characters (공백 포함), 자연스러운 한국어 해요체가 아닌 서술체(~다). summary.en: 180–280 words. Both must stand alone: what the piece argues, the key evidence, and what it means for HR.
2. findings: 2–4 items. k is the number or short label as it appears ("64%", "$1.6M", "n=1,204", "9단계"). If the text has no numbers, use short labels for the central claims.
3. detail: 4–6 sections, each with ko and en versions of the same content. body is HTML using ONLY <ul>, <li>, <b>, <i>, <br> and the vocabulary span described below. No <p>, no headings, no links. Use <ul><li> for lists and <b> for emphasis, like the example.
   - For an article: follow the structure of the argument (why it matters → the core idea → how to apply → pitfalls → takeaway).
   - For a paper (kind=paper): 연구 질문 → 방법·표본 → 핵심 결과 → 실무 시사점 (research question, method & sample, key results, implications for practice), then the takeaway.
   - The LAST section must be titled exactly "HR 시사점" (ko) / "Takeaway for HR" (en): 3–5 concrete points an HR practitioner in Korea can act on.
4. vocab: 8–12 HR / management / research terms that actually occur in the text and are worth learning (prefer multi-word HR terms like "operating model", "center of expertise", "psychological safety"; avoid trivial words). w is the canonical form (singular, lowercase unless acronym/proper noun). pos is "n.", "v.", "adj.", "adv." or "phr.". ko = Korean meaning + short gloss. en = one-sentence plain-English definition. ex = one example sentence as HTML with the term in <b>…</b>; write a fresh sentence, do not copy the source.
5. Vocabulary spans: inside detail.body (BOTH ko and en), wrap the place where each vocab term occurs as <span class="vw" data-w="{w}">{text as it appears}</span>, with data-w exactly equal to vocab.w. In the Korean body, use the English term itself at that spot (e.g. 'HR <span class="vw" data-w="operating model">operating model</span>은 …'). Every vocab term should appear in at least one span; do not create spans for words that are not in vocab. Wrap each occurrence at most once per section.
6. Summarize and restate in your own words. Do not copy sentences from the source verbatim. Do not invent numbers that are not in the text. Keep company and author names as they are.
7. category: a short English topic label (2–3 words).

Match the tone, depth and length of the example below. The example is trimmed (one section, two vocab entries) — your output must have the full counts above.`;

function exampleBlock(): string {
  return `<example title=${JSON.stringify(EXAMPLE_TITLE)}>\n${JSON.stringify(EXAMPLE_OUTPUT, null, 2)}\n</example>`;
}

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
  return `Summarize the following ${input.kind === "paper" ? "academic paper (abstract/text)" : "article"} for HR Daily.\n\n<meta>\n${meta}\n</meta>\n\n<text>\n${input.raw_text}\n</text>`;
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

export function postValidate(raw: SummaryOutput): { output: SummaryOutput; warnings: string[] } {
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
    .map((f) => ({ k: f.k.trim(), ko: f.ko.trim(), en: f.en.trim() }))
    .filter((f) => f.k && (f.ko || f.en));
  if (findings.length > 4) { warnings.push(`findings ${findings.length}개 → 4개로 자름`); findings.length = 4; }
  if (findings.length < 2) warnings.push(`findings 가 ${findings.length}개 (2개 미만)`);

  const koLen = summary.ko.length;
  const enWords = summary.en.split(/\s+/).filter(Boolean).length;
  if (koLen < 400 || koLen > 1000) warnings.push(`summary.ko ${koLen}자 (권장 500~800)`);
  if (enWords < 150 || enWords > 320) warnings.push(`summary.en ${enWords}단어 (권장 180~280)`);

  // 사용되지 않은 단어 경고(실패는 아님)
  const allBody = detail.map((d) => d.body.ko + d.body.en).join(" ");
  for (const v of vocab) if (!allBody.includes(`data-w="${v.w}"`)) warnings.push(`본문에 span 없는 단어: ${v.w}`);

  return { output: { category: raw.category.trim(), summary, findings, detail, vocab }, warnings };
}

// ---- 호출 ----

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: env("ANTHROPIC_API_KEY"), // 없으면 SDK 가 명확한 인증 에러를 낸다
      timeout: 270_000, // Vercel maxDuration 300s 안에서 끝나도록
      maxRetries: 1,
    });
  }
  return anthropic;
}

export function modelName(): string {
  return env("ANTHROPIC_MODEL") ?? DEFAULT_MODEL;
}

export async function summarizeText(input: SummarizeInput, log?: (m: string) => void): Promise<SummarizeResult> {
  const model = modelName();
  const format = zodOutputFormat(SummarySchema);

  const res = await client().beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default", // 분류기 거절 시 Anthropic 권장 모델로 서버측 재시도
    system: [
      { type: "text", text: SYSTEM_PROMPT + "\n\n" + exampleBlock(), cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt(input) }],
    output_config: { effort: "high", format },
  });

  if (res.stop_reason === "refusal") {
    const d = res.stop_details as { category?: string | null; explanation?: string | null } | null | undefined;
    throw new Error(`모델이 거절함(refusal${d?.category ? `: ${d.category}` : ""})${d?.explanation ? ` — ${d.explanation}` : ""}`);
  }
  if (res.stop_reason === "max_tokens") throw new Error("출력이 max_tokens 에서 잘림");
  if (!res.parsed_output) throw new Error(`구조화 출력 파싱 실패 (stop_reason=${res.stop_reason})`);

  const usage = res.usage;
  const tokens_in = usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const tokens_out = usage.output_tokens;
  log?.(`  모델 ${res.model} — in ${tokens_in} / out ${tokens_out} 토큰`);

  const { output, warnings } = postValidate(res.parsed_output);
  for (const w of warnings) log?.(`  ⚠ ${w}`);
  return { output, model: res.model, tokens_in, tokens_out, warnings };
}
