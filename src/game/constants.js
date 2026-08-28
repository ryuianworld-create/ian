// 무지개색 팔레트 (빨주노초파남보) - 색깔 방/벽/위장 시스템에서 공용으로 사용
export const RAINBOW_PALETTE = [
  { name: "red", hex: 0xe8342a },
  { name: "orange", hex: 0xff8a1e },
  { name: "yellow", hex: 0xf5e034 },
  { name: "green", hex: 0x3ecb5a },
  { name: "blue", hex: 0x3a8bf0 },
  { name: "indigo", hex: 0x4b3ec9 },
  { name: "violet", hex: 0xa347d1 },
];

export const CELL_SIZE = 8;
export const WALL_HEIGHT = 5.2;

export const GAME_DURATION_SECONDS = 5 * 60;

export const PLAYER_RADIUS = 0.45;
export const PLAYER_SPEED = 6.2;
export const PLAYER_TURN_SPEED = 2.6;

export const COMPANION_COUNT = 1;

export const CAMO_TOUCH_DISTANCE = 1.9;

export function randomColor() {
  return RAINBOW_PALETTE[Math.floor(Math.random() * RAINBOW_PALETTE.length)];
}

// facing(라디안) 각도를 이동/시야 방향 단위벡터로 변환. 모든 캐릭터/카메라가
// 동일한 규칙을 써야 방향이 어긋나지 않는다.
export function forwardVector(facing) {
  return { x: Math.sin(facing), z: Math.cos(facing) };
}

export function facingFromDelta(dx, dz) {
  return Math.atan2(dx, dz);
}
