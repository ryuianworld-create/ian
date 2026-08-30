// 방향키 이동/회전 + Enter(색 채우기) + G(ㅎ, 긴급 정지 아이템) + 마우스 시점
// 회전을 담당하는 입력 매니저.
const TRACKED_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "KeyG"];

// 한글 2벌식에서 ㅎ은 물리적으로 G 키 위치이므로, 키보드 배열이 한글이든
// 영문이든 상관없이 code(물리적 위치) 기준인 KeyG로 판정한다. 혹시 code가
// 잡히지 않는 환경을 대비해 key 값이 "ㅎ"/"g"/"G"인 경우도 함께 허용한다.
function normalizeKey(e) {
  if (e.code === "Enter" || e.key === "Enter") return "Enter";
  if (e.code === "KeyG" || e.key === "ㅎ" || e.key === "g" || e.key === "G") return "KeyG";
  return e.code;
}

export class InputManager {
  constructor(canvas) {
    this.down = new Set();
    this._enterPressedThisFrame = false;
    this._freezePressedThisFrame = false;
    this._mouseDeltaX = 0;
    this.canvas = canvas;

    this._onKeyDown = (e) => {
      const key = normalizeKey(e);
      if (!TRACKED_KEYS.includes(key)) return;
      e.preventDefault();
      if (!this.down.has(key)) {
        if (key === "Enter") this._enterPressedThisFrame = true;
        if (key === "KeyG") this._freezePressedThisFrame = true;
      }
      this.down.add(key);
    };
    this._onKeyUp = (e) => {
      this.down.delete(normalizeKey(e));
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

  // 이번 프레임에 G(ㅎ, 긴급 정지)가 새로 눌렸는지 확인 (호출 시 소비됨).
  consumeFreezePressed() {
    const v = this._freezePressedThisFrame;
    this._freezePressedThisFrame = false;
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
