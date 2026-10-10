import { CAMO_TOUCH_DISTANCE } from "./constants.js";
import { pointToSegmentDistance } from "./collision.js";

// 몸에 색이 채워져 있고, 같은 색의 위장 벽에 붙어 있으면 위장 상태로 간주한다.
export function isCamouflaged(entity, camoWallSegments) {
  if (!entity.bodyColor) return false;
  for (const seg of camoWallSegments) {
    if (seg.color.name !== entity.bodyColor.name) continue;
    if (pointToSegmentDistance(entity.position.x, entity.position.z, seg) < CAMO_TOUCH_DISTANCE) {
      return true;
    }
  }
  return false;
}
