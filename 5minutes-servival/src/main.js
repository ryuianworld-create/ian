import "./style.css";
import { Game } from "./game/game.js";

const canvas = document.getElementById("scene");
const timerEl = document.getElementById("timer");
const tankSwatch = document.getElementById("tankSwatch");
const bodySwatch = document.getElementById("bodySwatch");
const camoBadge = document.getElementById("camoBadge");
const freezeBadge = document.getElementById("freezeBadge");
const arrowBadge = document.getElementById("arrowBadge");
const swordBadge = document.getElementById("swordBadge");
const wandBadge = document.getElementById("wandBadge");
const hammerBadge = document.getElementById("hammerBadge");
const floorBadge = document.getElementById("floorBadge");
const elevatorPrompt = document.getElementById("elevatorPrompt");
const elevatorDigits = document.getElementById("elevatorDigits");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const endTitle = document.getElementById("endTitle");
const endMessage = document.getElementById("endMessage");
const levelBtns = document.querySelectorAll(".levelBtn");
const restartBtn = document.getElementById("restartBtn");
const deathFlash = document.getElementById("deathFlash");
const pickupFlash = document.getElementById("pickupFlash");
const pickupToast = document.getElementById("pickupToast");

const COLOR_NAMES_KO = {
  red: "빨강",
  orange: "주황",
  yellow: "노랑",
  green: "초록",
  blue: "파랑",
  indigo: "남색",
  violet: "보라",
};

function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function setSwatch(el, color) {
  if (color) {
    el.style.background = hexToCss(color.hex);
    el.classList.remove("empty");
  } else {
    el.style.background = "";
    el.classList.add("empty");
  }
}

const hud = {
  onTick(data) {
    timerEl.textContent = formatTime(data.timeLeft);
    timerEl.classList.toggle("warn", data.timeLeft <= 60);
    setSwatch(tankSwatch, data.tank);
    setSwatch(bodySwatch, data.bodyColor);
    camoBadge.classList.toggle("hidden", !data.camouflaged);

    if (data.freezeTimer > 0) {
      freezeBadge.className = "freeze-active";
      freezeBadge.textContent = `정지 중: ${Math.ceil(data.freezeTimer)}초`;
    } else if (data.hasFreezeItem) {
      freezeBadge.className = "freeze-ready";
      freezeBadge.textContent = "ㅎ: 긴급 정지(1회)";
    } else {
      freezeBadge.className = "freeze-used";
    }
    arrowBadge.classList.toggle("hidden", !data.hasArrow);
    swordBadge.classList.toggle("hidden", !data.hasSword);
    wandBadge.classList.toggle("hidden", !data.hasWand);
    hammerBadge.classList.toggle("hidden", !data.hasHammer);

    elevatorPrompt.classList.toggle("hidden", !data.elevatorActive);
    if (data.elevatorActive) {
      elevatorDigits.textContent = data.elevatorDigits && data.elevatorDigits.length ? data.elevatorDigits.join("") : "";
    }
  },
  onItemPickup(kind) {
    const ITEM_TOAST = {
      arrow: "화살 획득! (Space로 쏘기)",
      sword: "검 획득! (F로 사용)",
      wand: "마법봉 획득! (Q로 사용)",
      hammer: "망치 획득! (E로 사용)",
    };
    const ITEM_BADGE = { arrow: arrowBadge, sword: swordBadge, wand: wandBadge, hammer: hammerBadge };
    pickupToast.textContent = ITEM_TOAST[kind];
    pickupToast.classList.remove("hidden");
    pickupToast.classList.add("show");
    clearTimeout(pickupToast._hideTimer);
    pickupToast._hideTimer = setTimeout(() => pickupToast.classList.remove("show"), 1400);
    const badge = ITEM_BADGE[kind];
    badge.classList.add("pop");
    setTimeout(() => badge.classList.remove("pop"), 160);
  },
  onFloorChange(floorNumber, themeLabel) {
    floorBadge.textContent = `${floorNumber}층 · ${themeLabel}`;
    pickupToast.textContent = `${floorNumber}층(${themeLabel}) 도착!`;
    pickupToast.classList.remove("hidden");
    pickupToast.classList.add("show");
    clearTimeout(pickupToast._hideTimer);
    pickupToast._hideTimer = setTimeout(() => pickupToast.classList.remove("show"), 1400);
  },
  onPickup(color) {
    flashPickup(color);
    tankSwatch.classList.add("pop");
    setTimeout(() => tankSwatch.classList.remove("pop"), 160);
    pickupToast.textContent = `${COLOR_NAMES_KO[color.name] || color.name} 색 획득! (Enter로 몸에 채우기)`;
    pickupToast.classList.remove("hidden");
    pickupToast.classList.add("show");
    clearTimeout(pickupToast._hideTimer);
    pickupToast._hideTimer = setTimeout(() => pickupToast.classList.remove("show"), 1400);
  },
  onEnd(won, message) {
    endScreen.classList.remove("hidden");
    endTitle.textContent = won ? "탈출 성공!" : "탈출 실패...";
    endTitle.className = won ? "win" : "lose";
    endMessage.textContent = message;
    if (!won) flashDeath();
  },
};

function flashDeath() {
  deathFlash.classList.add("hit");
  setTimeout(() => deathFlash.classList.remove("hit"), 450);
}

function flashPickup(color) {
  const css = hexToCss(color.hex);
  pickupFlash.classList.add("hit");
  pickupFlash.style.transition = "none";
  pickupFlash.style.boxShadow = `inset 0 0 140px 20px ${css}`;
  // 강제 리플로우 후 서서히 사라지도록 트랜지션을 다시 건다.
  void pickupFlash.offsetWidth;
  pickupFlash.style.transition = "box-shadow 0.6s ease";
  pickupFlash.style.boxShadow = "inset 0 0 0 0 transparent";
}

const game = new Game({ canvas, hud });

levelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    startScreen.classList.add("hidden");
    game.start(Number(btn.dataset.level));
  });
});

restartBtn.addEventListener("click", () => {
  endScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

if (import.meta.env.DEV) {
  window.__game = game;
  import("./game/visibility.js").then((m) => {
    window.__canSeeTarget = m.canSeeTarget;
  });
}
