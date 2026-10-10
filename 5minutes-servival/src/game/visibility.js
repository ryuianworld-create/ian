import { hasLineOfSight } from "./collision.js";

// 시야각 + 사거리 + 시야 차단(벽/상자) + 위장 여부를 종합해 적이 대상을
// "발견"했는지 판정한다. 위장(같은 색 벽에 붙은 색칠된 몸)된 대상은 절대
// 발견되지 않는다.
export function canSeeTarget(selfPos, selfFacing, entity, world, opts = {}) {
  const { range = 16, halfAngle = Math.PI * 0.32, closeRangeOverride = 1.6 } = opts;
  if (!entity.alive) return false;
  if (entity.isCamouflaged(world.camoWallSegments)) return false;

  const dx = entity.position.x - selfPos.x;
  const dz = entity.position.z - selfPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;

  if (dist > closeRangeOverride) {
    const angleToTarget = Math.atan2(dx, dz);
    let diff = angleToTarget - selfFacing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > halfAngle) return false;
  }

  return hasLineOfSight(selfPos.x, selfPos.z, entity.position.x, entity.position.z, world.wallSegments, world.crateObstacles);
}
