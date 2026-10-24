"use client";
/* 읽어주기 (Web Speech API)
   - 지금 보고 있는 언어로 읽는다. 한글 화면이면 한국어, ENG 화면이면 미국식 영어.
   - 문장 단위로 끊어 읽는다. 읽는 문장을 하이라이트하고, 문장을 누르면 거기서부터 읽는다.
   - 본문 DOM(dangerouslySetInnerHTML) 을 직접 .rd 단위로 감싼다. 1세대 setupSpeech 의 이식. */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  langTag,
  loadRate,
  pickVoices,
  preferredVoice,
  rememberVoice,
  saveRate,
  sayWord as sayWordRaw,
  sentencesOf,
  ttsSupported,
  type TtsLang,
  type VoiceSet,
} from "@/lib/tts";

type Unit = { el: HTMLElement; text: string };

type Internal = {
  q: Record<TtsLang, Unit[]>;
  qi: number;
  playing: boolean;
  rate: number;
  lang: TtsLang;
  voices: VoiceSet;
  voice: Record<TtsLang, SpeechSynthesisVoice | null>;
};

export type ReadAloudUi = {
  supported: boolean | null; // null = 아직 모름(SSR)
  playing: boolean;
  qi: number;
  total: number;
  rate: number;
  voices: SpeechSynthesisVoice[];
  voiceName: string;
};

// 본문 블록을 읽기 단위로 감싼다. 목록 항목은 그 자체가 한 단위다.
function wrapUnits(container: HTMLElement, units: HTMLElement[]) {
  const kids = Array.from(container.childNodes);
  let buf: ChildNode[] = [];
  const flush = () => {
    if (!buf.length) return;
    const text = buf.map((n) => n.textContent ?? "").join("").trim();
    if (!text) {
      buf = [];
      return;
    }
    const span = document.createElement("span");
    span.className = "rd";
    container.insertBefore(span, buf[0]);
    buf.forEach((n) => span.appendChild(n));
    units.push(span);
    buf = [];
  };
  kids.forEach((n) => {
    if (n.nodeType === 1 && ((n as Element).tagName === "UL" || (n as Element).tagName === "OL")) {
      flush();
      Array.from((n as Element).children).forEach((li) => {
        if ((li.textContent ?? "").trim()) {
          li.classList.add("rd");
          units.push(li as HTMLElement);
        }
      });
    } else if (n.nodeType === 1 && (n as Element).tagName === "BR") {
      flush();
    } else {
      buf.push(n);
    }
  });
  flush();
}

export function useReadAloud(ref: RefObject<HTMLElement | null>, lang: TtsLang, contentKey: string) {
  const st = useRef<Internal>({
    q: { ko: [], en: [] },
    qi: 0,
    playing: false,
    rate: 1,
    lang,
    voices: { ko: [], en: [] },
    voice: { ko: null, en: null },
  });
  const [ui, setUi] = useState<ReadAloudUi>({
    supported: null,
    playing: false,
    qi: 0,
    total: 0,
    rate: 1,
    voices: [],
    voiceName: "",
  });

  const sync = useCallback(() => {
    const s = st.current;
    setUi({
      supported: ttsSupported(),
      playing: s.playing,
      qi: s.qi,
      total: s.q[s.lang].length,
      rate: s.rate,
      voices: s.voices[s.lang],
      voiceName: s.voice[s.lang]?.name ?? "",
    });
  }, []);

  const clearHighlight = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    root.classList.remove("speaking");
    root.querySelectorAll(".rd.active").forEach((n) => n.classList.remove("active"));
  }, [ref]);

  const highlight = useCallback(
    (el: HTMLElement) => {
      const root = ref.current;
      if (!root) return;
      root.classList.add("speaking");
      root.querySelectorAll(".rd.active").forEach((n) => n.classList.remove("active"));
      el.classList.add("active");
      const r = el.getBoundingClientRect();
      if (r.top < 120 || r.bottom > window.innerHeight - 140) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [ref],
  );

  const stop = useCallback(() => {
    const s = st.current;
    s.playing = false;
    s.qi = 0;
    if (ttsSupported()) window.speechSynthesis.cancel();
    clearHighlight();
    sync();
  }, [clearHighlight, sync]);

  const pause = useCallback(() => {
    const s = st.current;
    s.playing = false;
    if (ttsSupported()) window.speechSynthesis.cancel(); // iOS 의 pause/resume 은 불안정해 문장 단위로 재개한다
    sync();
  }, [sync]);

  const speakNext = useCallback(() => {
    const s = st.current;
    if (!s.playing) return;
    const q = s.q[s.lang];
    if (s.qi >= q.length) {
      stop();
      return;
    }
    const item = q[s.qi];
    highlight(item.el);
    sync();
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = langTag(s.lang);
    u.rate = s.rate;
    const v = s.voice[s.lang];
    if (v) u.voice = v;
    const advance = () => {
      if (!s.playing) return;
      s.qi++;
      speakNext();
    };
    u.onend = advance;
    u.onerror = advance;
    window.speechSynthesis.speak(u);
  }, [highlight, stop, sync]);

  const speakFrom = useCallback(
    (qi: number) => {
      const s = st.current;
      const q = s.q[s.lang];
      if (!ttsSupported() || !q.length) return;
      window.speechSynthesis.cancel();
      s.qi = Math.max(0, Math.min(qi, q.length - 1));
      s.playing = true;
      sync();
      window.setTimeout(speakNext, 80); // iOS: cancel 직후 speak 는 씹힌다
    },
    [speakNext, sync],
  );

  const toggle = useCallback(() => {
    const s = st.current;
    if (s.playing) pause();
    else speakFrom(s.qi || 0);
  }, [pause, speakFrom]);

  const setRate = useCallback(
    (rate: number) => {
      const s = st.current;
      s.rate = rate || 1;
      saveRate(s.rate);
      if (s.playing) speakFrom(s.qi);
      else sync();
    },
    [speakFrom, sync],
  );

  const setVoice = useCallback(
    (name: string) => {
      const s = st.current;
      const v = s.voices[s.lang].find((x) => x.name === name);
      if (v) {
        s.voice[s.lang] = v;
        rememberVoice(s.lang, v.name);
      }
      if (s.playing) speakFrom(s.qi);
      else sync();
    },
    [speakFrom, sync],
  );

  const sayWord = useCallback((word: string, example?: string) => {
    const s = st.current;
    s.playing = false;
    sayWordRaw(word, example, s.rate, s.voice.en);
  }, []);

  // 음성 목록·속도 초기화
  useEffect(() => {
    const s = st.current;
    s.rate = loadRate();
    if (!ttsSupported()) {
      sync();
      return;
    }
    const refresh = () => {
      s.voices = pickVoices();
      s.voice = { ko: preferredVoice(s.voices, "ko"), en: preferredVoice(s.voices, "en") };
      sync();
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [sync]);

  // 본문을 읽기 단위로 쪼개 큐를 만든다 (본문이 바뀔 때마다 한 번)
  useEffect(() => {
    const root = ref.current;
    const s = st.current;
    if (!root) return;
    if (!root.dataset.rdReady) {
      root.dataset.rdReady = "1";
      const units: Record<TtsLang, HTMLElement[]> = { ko: [], en: [] };
      Array.from(root.children).forEach((node) => {
        if (node.tagName === "H3") {
          (["ko", "en"] as TtsLang[]).forEach((k) => {
            const el = node.querySelector<HTMLElement>(".l-" + k);
            if (el && (el.textContent ?? "").trim()) {
              el.classList.add("rd");
              units[k].push(el);
            }
          });
        } else if (node.classList.contains("l-ko")) wrapUnits(node as HTMLElement, units.ko);
        else if (node.classList.contains("l-en")) wrapUnits(node as HTMLElement, units.en);
      });
      s.q = { ko: [], en: [] };
      (["ko", "en"] as TtsLang[]).forEach((k) => {
        units[k].forEach((el) => sentencesOf(el.textContent ?? "").forEach((text) => s.q[k].push({ el, text })));
      });
    }
    sync();

    // 문장을 누르면 거기서부터 (단어 버튼은 툴팁으로)
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.closest(".vw")) return;
      const el = t.closest<HTMLElement>(".rd");
      if (!el) return;
      const at = s.q[s.lang].findIndex((q) => q.el === el);
      if (at >= 0) speakFrom(at);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [ref, contentKey, speakFrom, sync]);

  // 언어를 바꾸면 읽던 자리가 달라지므로 멈추고 컨트롤을 다시 맞춘다
  useEffect(() => {
    const s = st.current;
    if (s.lang === lang) return;
    s.lang = lang;
    if (s.playing || s.qi) stop();
    else sync();
  }, [lang, stop, sync]);

  // 화면을 떠나면 멈춘다
  useEffect(() => {
    const s = st.current;
    return () => {
      s.playing = false;
      if (ttsSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  return { ui, toggle, stop, setRate, setVoice, sayWord, speakFrom };
}

/** 읽어주기 컨트롤 바 */
export function ReadBar({
  lang,
  ui,
  onToggle,
  onStop,
  onRate,
  onVoice,
}: {
  lang: TtsLang;
  ui: ReadAloudUi;
  onToggle: () => void;
  onStop: () => void;
  onRate: (r: number) => void;
  onVoice: (name: string) => void;
}) {
  if (ui.supported === null) return null;
  if (!ui.supported) {
    return <div className="no-tts">이 브라우저는 음성 읽기를 지원하지 않습니다. 아이폰 사파리나 크롬에서 열어 보세요.</div>;
  }
  if (!ui.total) return null;
  const has = ui.voices.length > 0;
  const hint =
    lang === "ko"
      ? has
        ? "한국어로 읽습니다. 문장을 누르면 그 문장부터 다시 읽습니다."
        : "이 기기에 한국어 음성이 없습니다. 설정 → 손쉬운 사용 → 음성 콘텐츠에서 내려받을 수 있습니다."
      : has
        ? "미국식 영어로 읽습니다. 문장을 누르면 그 문장부터 다시 읽습니다."
        : "이 기기에 영어 음성이 없습니다.";
  const active = ui.playing || ui.qi > 0;
  return (
    <div className="readbar">
      <button type="button" className="play" onClick={onToggle}>
        {ui.playing ? (
          <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
            <rect x="1" y="1" width="3.5" height="11" fill="currentColor" />
            <rect x="7.5" y="1" width="3.5" height="11" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
            <path d="M1 1.2v10.6L11 6.5z" fill="currentColor" />
          </svg>
        )}{" "}
        {ui.playing ? "일시정지" : ui.qi ? "이어서 읽기" : "읽어주기"}
      </button>
      {active ? (
        <button type="button" className="ghost" onClick={onStop}>
          정지
        </button>
      ) : null}
      <select aria-label="읽기 속도" value={String(ui.rate)} onChange={(e) => onRate(parseFloat(e.target.value))}>
        <option value="0.7">0.7×</option>
        <option value="0.85">0.85×</option>
        <option value="1">1.0×</option>
        <option value="1.15">1.15×</option>
        <option value="1.3">1.3×</option>
      </select>
      <select aria-label="음성 선택" value={ui.voiceName} onChange={(e) => onVoice(e.target.value)}>
        {has ? (
          ui.voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name.replace(/\s*\(.*\)$/, "")}
            </option>
          ))
        ) : (
          <option value="">기기 기본 음성</option>
        )}
      </select>
      <span className="prog">{active ? `${ui.qi + 1} / ${ui.total}` : `${ui.total} 문장`}</span>
      <span className="hint">{hint}</span>
    </div>
  );
}
