// 방향키 이동/회전 + Enter(색 채우기) + 마우스 시점 회전을 담당하는 입력 매니저.
const TRACKED_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];

export class InputManager {
  constructor(canvas) {
    this.down = new Set();
    this._enterPressedThisFrame = false;
    this._mouseDeltaX = 0;
    this.canvas = canvas;

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

    // 캔버스를 클릭하면 포인터 락을 걸어 마우스로 시점을 회전할 수 있게 한다.
    this._onCanvasClick = () => {
      if (canvas && document.pointerLockElement !== canvas) canvas.requestPointerLock();
    };
    this._onMouseMove = (e) => {
      if (canvas && document.pointerLockElement === canvas) {
        this._mouseDeltaX += e.movementX || 0;
      }
    };
    if (canvas) canvas.addEventListener("click", this._onCanvasClick);
    window.addEventListener("mousemove", this._onMouseMove);
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
  get mouseLocked() {
    return !!this.canvas && document.pointerLockElement === this.canvas;
  }

  // 이번 프레임에 Enter가 새로 눌렸는지 확인 (호출 시 소비됨).
  consumeEnterPressed() {
    const v = this._enterPressedThisFrame;
    this._enterPressedThisFrame = false;
    return v;
  }

  // 마지막으로 확인한 이후 누적된 마우스 좌우 이동량(px)을 반환하고 초기화한다.
  consumeMouseDeltaX() {
    const v = this._mouseDeltaX;
    this._mouseDeltaX = 0;
    return v;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("mousemove", this._onMouseMove);
    if (this.canvas) this.canvas.removeEventListener("click", this._onCanvasClick);
  }
}
