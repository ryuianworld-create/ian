// 2D(XZ 평면) 충돌 및 가시선(line of sight) 계산 유틸리티.
// 미로의 벽은 x1,z1 -> x2,z2 선분(두께 포함)으로 표현된다.

const WALL_THICKNESS = 0.3;

// 원(플레이어/적, 반지름 radius)이 두꺼운 선분 벽과 겹치면 밀어내는 보정 벡터를 반환.
export function resolveCircleVsSegment(px, pz, radius, seg) {
  const { x1, z1, x2, z2 } = seg;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz || 1e-6;
  let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestZ = z1 + t * dz;
  const distX = px - closestX;
  const distZ = pz - closestZ;
  const distSq = distX * distX + distZ * distZ;
  const minDist = radius + WALL_THICKNESS / 2;
  if (distSq < minDist * minDist) {
    const dist = Math.sqrt(distSq) || 0.0001;
    const push = (minDist - dist) / dist;
    return { x: distX * push, z: distZ * push };
  }
  return null;
}

function resolveCircleVsCircle(px, pz, radius, ox, oz, oradius) {
  const dx = px - ox;
  const dz = pz - oz;
  const distSq = dx * dx + dz * dz;
  const minDist = radius + oradius;
  if (distSq < minDist * minDist) {
    const dist = Math.sqrt(distSq) || 0.0001;
    const push = (minDist - dist) / dist;
    return { x: dx * push, z: dz * push };
  }
  return null;
}

// position(x,z)를 반지름 radius로 모든 벽/장애물에 대해 밀어내며 보정한 새 위치 반환.
export function collideAndSlide(x, z, radius, wallSegments, circleObstacles = []) {
  let px = x;
  let pz = z;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const seg of wallSegments) {
      const push = resolveCircleVsSegment(px, pz, radius, seg);
      if (push) {
        px += push.x;
        pz += push.z;
        moved = true;
      }
    }
    for (const obs of circleObstacles) {
      const push = resolveCircleVsCircle(px, pz, radius, obs.x, obs.z, obs.radius);
      if (push) {
        px += push.x;
        pz += push.z;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

// 점(px,pz)에서 선분 seg까지의 최단 거리.
export function pointToSegmentDistance(px, pz, seg) {
  const { x1, z1, x2, z2 } = seg;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz || 1e-6;
  let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cz = z1 + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

// 선분 A(a->b) 위에서 선분 B(c->d)와 처음 교차하는 지점의 매개변수 t(0~1)를
// 반환한다. 교차하지 않으면 null. 카메라가 벽을 뚫고 들어가지 않도록 뒤로
// 당겨줄 때 사용.
function segmentIntersectionT(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax;
  const rZ = bz - az;
  const sX = dx - cx;
  const sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / denom;
  const u = ((cx - ax) * rZ - (cz - az) * rX) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}

// 시작점에서 끝점 방향으로 벽에 처음 부딪히는 지점까지의 비율(0~1)을 구한다.
// 부딪히는 벽이 없으면 1을 반환한다(끝점까지 완전히 트여 있음).
export function raycastNearestWallT(x1, z1, x2, z2, wallSegments) {
  let nearest = 1;
  for (const seg of wallSegments) {
    const t = segmentIntersectionT(x1, z1, x2, z2, seg.x1, seg.z1, seg.x2, seg.z2);
    if (t !== null && t < nearest) nearest = t;
  }
  return nearest;
}

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = cross(dx - cx, dz - cz, ax - cx, az - cz);
  const d2 = cross(dx - cx, dz - cz, bx - cx, bz - cz);
  const d3 = cross(bx - ax, bz - az, cx - ax, cz - az);
  const d4 = cross(bx - ax, bz - az, dx - ax, dz - az);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function cross(ax, az, bx, bz) {
  return ax * bz - az * bx;
}

function segmentBlockedByCircle(x1, z1, x2, z2, ox, oz, oradius) {
  return pointToSegmentDistance(ox, oz, { x1, z1, x2, z2 }) < oradius;
}

// 두 점 사이에 벽/장애물이 가로막고 있지 않으면 true (시야가 트여 있음).
export function hasLineOfSight(x1, z1, x2, z2, wallSegments, circleObstacles = []) {
  for (const seg of wallSegments) {
    if (segmentsIntersect(x1, z1, x2, z2, seg.x1, seg.z1, seg.x2, seg.z2)) {
      return false;
    }
  }
  for (const obs of circleObstacles) {
    if (segmentBlockedByCircle(x1, z1, x2, z2, obs.x, obs.z, obs.radius)) {
      return false;
    }
  }
  return true;
}
