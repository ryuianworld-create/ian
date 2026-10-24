"use client";
/* 본문 속 단어 툴팁. PC 는 마우스를 올리면, 폰은 누르면 뜻이 뜬다.
   읽던 자리를 잃지 않는 것이 목적이라, 단어장으로 보내지 않고 그 자리에서 보여준다. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { VocabEntry } from "@/lib/types";

type Popup = { item: VocabEntry; anchor: HTMLElement };

export function useWordPopup(ref: RefObject<HTMLElement | null>, vocab: VocabEntry[]) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const close = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (popupRef.current) popupRef.current.anchor.classList.remove("on");
    popupRef.current = null;
    setPopup(null);
  }, []);

  const show = useCallback(
    (btn: HTMLElement) => {
      const item = vocab.find((v) => v.w === btn.dataset.w);
      if (!item) return;
      if (popupRef.current?.anchor === btn) return;
      close();
      btn.classList.add("on");
      const p = { item, anchor: btn };
      popupRef.current = p;
      setPopup(p);
    },
    [vocab, close],
  );

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const vwOf = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const b = t?.closest ? t.closest<HTMLElement>(".vw") : null;
      return b && root.contains(b) ? b : null;
    };

    const onClick = (e: MouseEvent) => {
      const b = vwOf(e);
      if (b) {
        e.preventDefault();
        if (popupRef.current?.anchor === b) close();
        else show(b); // 다시 누르면 닫힌다
        return;
      }
      const t = e.target as HTMLElement | null;
      if (popupRef.current && !t?.closest(".wpop")) close();
    };
    const onOver = (e: MouseEvent) => {
      const b = vwOf(e);
      if (!b || popupRef.current?.anchor === b) return;
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => show(b), 160);
    };
    const onOut = (e: MouseEvent) => {
      const b = vwOf(e);
      if (!b) return;
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(close, 220);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    if (canHover) {
      document.addEventListener("mouseover", onOver);
      document.addEventListener("mouseout", onOut);
    }
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      if (canHover) {
        document.removeEventListener("mouseover", onOver);
        document.removeEventListener("mouseout", onOut);
      }
      close();
    };
  }, [ref, show, close]);

  const keepOpen = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);
  const scheduleClose = useCallback(() => {
    hoverTimer.current = window.setTimeout(close, 220);
  }, [close]);

  return { popup, close, keepOpen, scheduleClose };
}

export function WordPopup({
  item,
  anchor,
  onSay,
  onGo,
  onEnter,
  onLeave,
}: {
  item: VocabEntry;
  anchor: HTMLElement;
  onSay: () => void;
  onGo: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const r = anchor.getBoundingClientRect();
    const w = node.offsetWidth,
      h = node.offsetHeight,
      pad = 14;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
    let top = r.top - h - 9;
    if (top < 64) top = r.bottom + 9; // 위가 좁으면 아래로
    top = Math.min(top, window.innerHeight - h - 76); // 탭바를 피한다
    setPos({ left: Math.round(left), top: Math.round(top) });
  }, [anchor, item]);

  return (
    <div
      ref={el}
      className="wpop"
      role="dialog"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div>
        <span className="w">{item.w}</span>
        <span className="p">{item.pos}</span>
      </div>
      <div className="ko">{item.ko}</div>
      <p className="en">{item.en}</p>
      <div className="acts">
        <button
          type="button"
          className="say"
          aria-label="발음 듣기"
          onClick={(e) => {
            e.stopPropagation();
            onSay();
          }}
        >
          🔊 발음
        </button>
        <button
          type="button"
          className="go"
          onClick={(e) => {
            e.stopPropagation();
            onGo();
          }}
        >
          단어장 →
        </button>
      </div>
    </div>
  );
}
