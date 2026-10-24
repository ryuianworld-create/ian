// Web Speech API 보조 함수. 1세대의 음성 선택 규칙을 그대로 옮겼다.
import { KEYS, load, save } from "./storage";

export type TtsLang = "ko" | "en";
export type VoiceSet = Record<TtsLang, SpeechSynthesisVoice[]>;

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis && !!window.SpeechSynthesisUtterance;
}

export function langTag(lang: TtsLang): string {
  return lang === "ko" ? "ko-KR" : "en-US";
}

const PREFER_EN = ["Samantha", "Ava", "Allison", "Susan", "Alex", "Aaron", "Nicky", "Google US English"];
const PREFER_KO = ["Yuna", "Sora", "Google 한국의", "Google 한국어"];

function sortByPreference(list: SpeechSynthesisVoice[], prefer: string[]) {
  const rank = (v: SpeechSynthesisVoice) => {
    const i = prefer.findIndex((n) => v.name.indexOf(n) === 0);
    return i < 0 ? 99 : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/** 기기의 음성 목록을 ko/en 으로 나눠 선호 순으로 정렬한다. 영어는 미국식 우선. */
export function pickVoices(): VoiceSet {
  if (!ttsSupported()) return { ko: [], en: [] };
  const all = window.speechSynthesis.getVoices() || [];
  let en = all.filter((v) => /^en[-_]US/i.test(v.lang));
  if (!en.length) en = all.filter((v) => /^en/i.test(v.lang));
  const ko = all.filter((v) => /^ko/i.test(v.lang));
  return { ko: sortByPreference(ko, PREFER_KO), en: sortByPreference(en, PREFER_EN) };
}

/** 저장된 이름의 음성이 있으면 그것, 없으면 첫 번째. */
export function preferredVoice(voices: VoiceSet, lang: TtsLang): SpeechSynthesisVoice | null {
  const saved = load<string | null>(KEYS.voice(lang), null);
  return voices[lang].find((v) => v.name === saved) || voices[lang][0] || null;
}

export function rememberVoice(lang: TtsLang, name: string) {
  save(KEYS.voice(lang), name);
}

export function loadRate(): number {
  const r = load<number>(KEYS.rate, 1);
  return typeof r === "number" && r > 0 ? r : 1;
}

export function saveRate(rate: number) {
  save(KEYS.rate, rate);
}

/** 단어는 영어이므로 언제나 영어로 읽는다 (단어 → 예문). 단어는 조금 천천히. */
export function sayWord(word: string, example?: string, rate = loadRate(), voice?: SpeechSynthesisVoice | null) {
  if (!ttsSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const v = voice === undefined ? preferredVoice(pickVoices(), "en") : voice;
  window.setTimeout(() => {
    [word, example].filter(Boolean).forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text as string);
      u.lang = "en-US";
      u.rate = i === 0 ? Math.min(rate, 0.85) : rate;
      if (v) u.voice = v;
      synth.speak(u);
    });
  }, 80);
}

/** 문장 단위로 쪼갠다. 한 덩어리는 180자를 넘기지 않는다 (iOS 가 긴 문단을 중간에 끊는다). */
export function sentencesOf(text: string): string[] {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]+["'’)\]]*\s*|[^.!?]+$/g) || [clean];
  const out: string[] = [];
  let cur = "";
  for (let s of parts) {
    s = s.trim();
    if (!s) continue;
    if (cur && (cur + " " + s).length > 180) {
      out.push(cur);
      cur = s;
    } else cur = cur ? cur + " " + s : s;
  }
  if (cur) out.push(cur);
  return out;
}
