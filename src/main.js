import "./style.css";
import { Game } from "./game/game.js";

const canvas = document.getElementById("scene");
const timerEl = document.getElementById("timer");
const tankSwatch = document.getElementById("tankSwatch");
const bodySwatch = document.getElementById("bodySwatch");
const camoBadge = document.getElementById("camoBadge");
const freezeBadge = document.getElementById("freezeBadge");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const endTitle = document.getElementById("endTitle");
const endMessage = document.getElementById("endMessage");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const deathFlash = document.getElementById("deathFlash");

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

const game = new Game({ canvas, hud });

startBtn.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  game.start();
});

restartBtn.addEventListener("click", () => {
  endScreen.classList.add("hidden");
  game.start();
});

if (import.meta.env.DEV) {
  window.__game = game;
  import("./game/visibility.js").then((m) => {
    window.__canSeeTarget = m.canSeeTarget;
  });
}
