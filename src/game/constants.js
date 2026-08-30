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

export const FREEZE_DURATION_SECONDS = 20;

// 화살(원거리 무기) - 한번 주우면 무제한으로 쓸 수 있다.
export const ARROW_SPEED = 24;
export const ARROW_MAX_RANGE = 30;
export const ARROW_HIT_RADIUS = 0.6;
export const ARROW_COOLDOWN = 0.4;
export const ARROW_AI_RANGE = 14;

// 검(범위 무기) - 발밑에 반경 3짜리 보라색 원이 생기며 그 안의 적을 제거한다.
export const SWORD_RADIUS = 3;
export const SWORD_COOLDOWN = 1.2;
export const SWORD_EFFECT_DURATION = 0.5;

// 마법봉 - 쓰면 살아있는 모든 졸라맨(쫓아오는 졸라맨 + 낚시하는 졸라맨)이
// 플레이어 주변으로 끌려와서 곧장 위협해온다. 강력한 만큼 재사용 대기시간이 길다.
export const WAND_COOLDOWN = 10;
export const WAND_LURE_DURATION = 14;
export const WAND_TELEPORT_RADIUS = 5;
export const WAND_EFFECT_DURATION = 0.6;

// 망치 - 가까운 먼지를 부수고, 가까운 벽(테두리 제외) 하나를 부숴 새 길을 낸다.
export const HAMMER_RADIUS = 2.4;
export const HAMMER_COOLDOWN = 1.6;
export const HAMMER_EFFECT_DURATION = 0.5;

// 엘리베이터 - 미로 곳곳에 서 있으며, 가까이 가서 층 번호(1~21)를 누르면
// 그 층으로 순간이동한다. 두 자리 층은 십의자리/일의자리를 짧은 시간 안에
// 함께 눌러서 입력한다.
export const ELEVATOR_COUNT = 10;
export const ELEVATOR_MAX_FLOOR = 21;
export const ELEVATOR_INTERACT_RADIUS = 2.2;
export const ELEVATOR_DIGIT_GRACE = 0.35;

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
