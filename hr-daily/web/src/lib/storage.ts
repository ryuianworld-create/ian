// localStorage 래퍼. 1세대와 같은 키(hrp.*)를 써서 기존 사용자의 설정·단어 진도를 이어받는다.
export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 사생활 모드 등에서 실패해도 무시
  }
}

export const KEYS = {
  lang: "hrp.lang",
  known: "hrp.known",
  rate: "hrp.rate",
  voice: (lang: "ko" | "en") => `hrp.voice.${lang}`,
} as const;
