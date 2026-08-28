// 방향키 이동/회전 + Enter(색 채우기)를 담당하는 간단한 입력 매니저.
const TRACKED_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];

export class InputManager {
  constructor() {
    this.down = new Set();
    this._enterPressedThisFrame = false;
    this._onKeyDown = (e) => {
      if (!TRACKED_KEYS.includes(e.code) && !TRACKED_KEYS.includes(e.key)) return;
      const key = e.code === "Enter" || e.key === "Enter" ? "Enter" : e.code;
      if (TRACKED_KEYS.includes(key)) {
        e.preventDefault();
        if (key === "Enter" && !this.down.has("Enter")) this._enterPressedThisFrame = true;
        this.down.add(key);
      }
    };
    this._onKeyUp = (e) => {
      const key = e.code === "Enter" || e.key === "Enter" ? "Enter" : e.code;
      this.down.delete(key);
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  get forward() {
    return this.down.has("ArrowUp");
  }
  get backward() {
    return this.down.has("ArrowDown");
  }
  get turnLeft() {
    return this.down.has("ArrowLeft");
  }
  get turnRight() {
    return this.down.has("ArrowRight");
  }

  // 이번 프레임에 Enter가 새로 눌렸는지 확인 (호출 시 소비됨).
  consumeEnterPressed() {
    const v = this._enterPressedThisFrame;
    this._enterPressedThisFrame = false;
    return v;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }
}
