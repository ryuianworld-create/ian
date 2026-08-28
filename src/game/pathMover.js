import { cellCenter, worldToCell } from "./factory.js";
import { bfsPath } from "./pathfinding.js";
import { collideAndSlide } from "./collision.js";
import { facingFromDelta } from "./constants.js";

// 미로 셀 그래프를 따라 목표 지점까지 자연스럽게(모퉁이를 돌면서) 이동시키는
// 헬퍼. AI 친구와 추격 졸라맨이 공통으로 사용한다.
export class PathMover {
  constructor() {
    this.path = [];
    this.repathTimer = 0;
  }

  // entity: { position: THREE.Vector3, radius, facing }
  // world: { cells, mazeW, mazeH, wallSegments, crateObstacles }
  // 반환값: 목표까지 남은 직선 거리
  moveToward(entity, dt, world, targetWorld, speed, opts = {}) {
    const repathInterval = opts.repathInterval ?? 0.5;
    this.repathTimer -= dt;
    const fromCell = worldToCell(entity.position.x, entity.position.z);
    const toCell = worldToCell(targetWorld.x, targetWorld.z);

    if (this.repathTimer <= 0 || this.path.length === 0) {
      this.path = bfsPath(world.cells, world.mazeW, world.mazeH, fromCell, toCell);
      this.repathTimer = repathInterval;
    }

    while (this.path.length > 1) {
      const wp = this.path[0];
      if (wp.cellX === fromCell.cellX && wp.cellY === fromCell.cellY) {
        this.path.shift();
      } else break;
    }

    let aimX = targetWorld.x;
    let aimZ = targetWorld.z;
    if (this.path.length > 0) {
      const nextCell = this.path[0];
      const c = cellCenter(nextCell.cellX, nextCell.cellY);
      aimX = c.wx;
      aimZ = c.wz;
      if (this.path.length === 1) {
        const dToTarget = Math.hypot(
          targetWorld.x - entity.position.x,
          targetWorld.z - entity.position.z
        );
        if (dToTarget < 6) {
          aimX = targetWorld.x;
          aimZ = targetWorld.z;
        }
      }
    }

    const dx = aimX - entity.position.x;
    const dz = aimZ - entity.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const nx = dx / dist;
      const nz = dz / dist;
      const moveDist = Math.min(dist, speed * dt);
      const resolved = collideAndSlide(
        entity.position.x + nx * moveDist,
        entity.position.z + nz * moveDist,
        entity.radius,
        world.wallSegments,
        world.crateObstacles
      );
      entity.position.x = resolved.x;
      entity.position.z = resolved.z;
      entity.facing = facingFromDelta(nx, nz);
    }
    return Math.hypot(targetWorld.x - entity.position.x, targetWorld.z - entity.position.z);
  }

  reset() {
    this.path = [];
    this.repathTimer = 0;
  }
}
