import { buildStickFigure, animateStickFigure } from "../stickFigure.js";
import { PathMover } from "../pathMover.js";
import { canSeeTarget } from "../visibility.js";
import { buildCageMesh } from "../weapons.js";

const VISION_RANGE = 17;
const VISION_HALF_ANGLE = Math.PI * 0.32; // 약 58도
const PATROL_SPEED = 3.1;
const CHASE_SPEED = 7.8; // 플레이어(7.2)보다 살짝 빠름 - 긴장감
const KILL_DISTANCE = 0.75;
const LOSE_SIGHT_TIME = 2.4;

function distTo(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

const PATROL_HOME_RADIUS = 5; // 자기 출발 지점 근처(셀 단위)를 벗어나지 않고 순찰

// 우리를 쫓아다니는 졸라맨. 시야에 들어온(그리고 위장하지 않은) 대상 중
// 가장 가까운 쪽으로 목표를 바꿔가며 추격하고, 닿으면 즉사시킨다.
export class ChaserEnemy {
  constructor(position, homeCell = null) {
    // 완전한 검정은 어두운 공장에서 아예 안 보일 수 있어 살짝 밝은 회색으로 한다.
    this.mesh = buildStickFigure({ color: 0x2b2b30, height: 2.9 });
    this.mesh.position.copy(position);
    this.position = this.mesh.position;
    this.facing = Math.random() * Math.PI * 2;
    this.radius = 0.42;
    this.mover = new PathMover();
    this.state = "patrol";
    this.patrolTarget = null;
    this.target = null;
    this.loseSightTimer = 0;
    this.speed01 = 0;
    this.homeCell = homeCell;

    // 마법봉에 갇히면 완전히 멈춘다. 먼지가 닿아야 풀려난다.
    this.caged = false;
    this.cageMesh = buildCageMesh();
    this.mesh.add(this.cageMesh);
  }

  pickPatrolTarget(world) {
    let pool = world.openCells;
    if (this.homeCell) {
      const nearby = world.openCells.filter(
        (c) =>
          Math.max(Math.abs(c.cellX - this.homeCell.cellX), Math.abs(c.cellY - this.homeCell.cellY)) <=
          PATROL_HOME_RADIUS
      );
      if (nearby.length > 0) pool = nearby;
    }
    const cell = pool[Math.floor(Math.random() * pool.length)];
    this.patrolTarget = { x: cell.x, z: cell.z };
  }

  update(dt, world, candidates, onKill) {
    if (this.caged) return;

    let nearestVisible = null;
    let nearestDist = Infinity;
    for (const c of candidates) {
      if (canSeeTarget(this.position, this.facing, c.entity, world, { range: VISION_RANGE, halfAngle: VISION_HALF_ANGLE })) {
        const d = distTo(this, c.entity);
        if (d < nearestDist) {
          nearestDist = d;
          nearestVisible = c.entity;
        }
      }
    }

    if (nearestVisible) {
      this.target = nearestVisible;
      this.state = "chase";
      this.loseSightTimer = LOSE_SIGHT_TIME;
    } else if (this.target) {
      this.loseSightTimer -= dt;
      if (this.loseSightTimer <= 0) {
        this.target = null;
        this.state = "patrol";
        this.mover.reset();
      }
    }

    if (this.state === "chase" && this.target) {
      const dist = this.mover.moveToward(
        this,
        dt,
        world,
        { x: this.target.position.x, z: this.target.position.z },
        CHASE_SPEED,
        { repathInterval: 0.35 }
      );
      this.speed01 = 1;
      if (dist < KILL_DISTANCE + this.radius + this.target.radius) {
        onKill(this.target);
      }
    } else {
      if (!this.patrolTarget) this.pickPatrolTarget(world);
      const dist = this.mover.moveToward(this, dt, world, this.patrolTarget, PATROL_SPEED, {
        repathInterval: 1.4,
      });
      this.speed01 = 0.4;
      if (dist < 1.2) this.pickPatrolTarget(world);
    }

    this.mesh.rotation.y = this.facing;
    animateStickFigure(this.mesh, dt, this.speed01);
  }
}
