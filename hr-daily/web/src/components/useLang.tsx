"use client";
import { useCallback, useEffect, useState } from "react";
import { KEYS, load, save } from "@/lib/storage";

export type UiLang = "ko" | "en";

/** 요약·상세의 한글⇄ENG 토글. 1세대와 같은 키(hrp.lang)로 저장한다. */
export function useLang(): [UiLang, (v: UiLang) => void] {
  const [lang, setLangState] = useState<UiLang>("ko");
  useEffect(() => {
    const saved = load<UiLang>(KEYS.lang, "ko");
    if (saved === "ko" || saved === "en") setLangState(saved);
  }, []);
  const setLang = useCallback((v: UiLang) => {
    setLangState(v);
    save(KEYS.lang, v);
  }, []);
  return [lang, setLang];
}

export function LangToggle({ lang, onChange }: { lang: UiLang; onChange: (v: UiLang) => void }) {
  return (
    <div className="seg" role="group" aria-label="요약 언어 선택">
      <button type="button" aria-pressed={lang === "ko"} onClick={() => onChange("ko")}>
        한글
      </button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => onChange("en")}>
        ENG
      </button>
    </div>
  );
}
