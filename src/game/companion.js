import * as THREE from "three";
import { buildHumanMesh } from "./humanMesh.js";
import { animateStickFigure, setStickFigureColor } from "./stickFigure.js";
import { PathMover } from "./pathMover.js";
import { isCamouflaged } from "./camo.js";
import { pointToSegmentDistance, collideAndSlide } from "./collision.js";
import { PLAYER_RADIUS, CAMO_TOUCH_DISTANCE, forwardVector } from "./constants.js";

const SYNC_FORMATION_SPEED = 9;

const FRIEND_NEUTRAL_COLOR = 0x8fc9ff;
const FOLLOW_SPEED = 5.6;
const HIDE_SPEED = 6.6;
const DANGER_RADIUS = 15;
const SAFE_RADIUS = 20;
const RESPAWN_DELAY = 7;

export class Companion {
  constructor(startPosition, offset, opts = {}) {
    this.mesh = buildHumanMesh({ color: FRIEND_NEUTRAL_COLOR, height: 1.75 });
    this.mesh.position.copy(startPosition).add(new THREE.Vector3(offset.x, 0, offset.z));
    this.position = this.mesh.position;
    this.facing = 0;
    this.radius = PLAYER_RADIUS * 0.95;
    this.bodyColor = null;
    this.alive = true;
    this.state = "follow"; // follow | hide | flee
    this.deadTimer = 0;
    this.mover = new PathMover();
    this.speed01 = 0;

    // 레벨1: 플레이어를 둘러싼 원형 대형으로 딱 붙어 다니며, 색/무기를
    // 플레이어와 그대로 공유하는 "동기화" 동료. formationAngle이 플레이어
    // 기준 상대 각도, formationRadius가 대형 반지름.
    this.syncMode = !!opts.syncMode;
    this.formationAngle = opts.formationAngle || 0;
    this.formationRadius = opts.formationRadius || 2.2;

    this.hasArrow = false;
    this.hasSword = false;
    this.hasWand = false;
    this.hasHammer = false;
    this.arrowCooldown = 0;
    this.swordCooldown = 0;

    // 어두운 곳에서도 적(검은 졸라맨)과 헷갈리지 않도록 은은한 파란빛을 낸다.
    this.friendGlow = new THREE.PointLight(0x8fd6ff, 5, 6, 1.6);
    this.friendGlow.position.set(0, 1.6, 0);
    this.mesh.add(this.friendGlow);
  }

  stripColor() {
    if (!this.bodyColor) return;
    this.bodyColor = null;
    setStickFigureColor(this.mesh, FRIEND_NEUTRAL_COLOR);
  }

  kill(respawnAnchor) {
    if (!this.alive) return;
    this.alive = false;
    this.mesh.visible = false;
    this.deadTimer = RESPAWN_DELAY;
    this._respawnAnchor = respawnAnchor;
  }

  isCamouflaged(camoWallSegments) {
    return isCamouflaged(this, camoWallSegments);
  }

  update(dt, world, playerEntity, dangerPositions) {
    if (!this.alive) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) {
        this.alive = true;
        this.mesh.visible = true;
        this.stripColor();
        this.hasArrow = false;
        this.hasSword = false;
        this.hasWand = false;
        this.hasHammer = false;
        const anchor = this._respawnAnchor || playerEntity.position;
        this.position.set(anchor.x + (Math.random() - 0.5) * 3, 0, anchor.z + (Math.random() - 0.5) * 3);
        this.mover.reset();
        this.state = "follow";
      }
      return;
    }

    if (this.syncMode) {
      this._updateSynced(dt, world, playerEntity);
      return;
    }

    // 색깔 방 문에 닿으면 자동으로 색을 마신다 (색이 없을 때만)
    if (!this.bodyColor) {
      for (const room of world.colorRooms) {
        const d = Math.hypot(this.position.x - room.x, this.position.z - room.z);
        if (d < 1.6) {
          this.bodyColor = room.color;
          setStickFigureColor(this.mesh, room.color.hex);
          break;
        }
      }
    }

    let nearestDanger = null;
    let nearestDist = Infinity;
    for (const p of dangerPositions) {
      const d = Math.hypot(this.position.x - p.x, this.position.z - p.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearestDanger = p;
      }
    }
    const dangerNear = nearestDist < DANGER_RADIUS;
    const dangerGone = nearestDist > SAFE_RADIUS;

    if (this.state === "follow" && dangerNear) {
      this.state = this.bodyColor ? "hide" : "flee";
      this.mover.reset();
    } else if ((this.state === "hide" || this.state === "flee") && dangerGone) {
      this.state = "follow";
      this.mover.reset();
    }
    // 위장 중 색이 지워졌다면 다시 상황 판단
    if (this.state === "hide" && !this.bodyColor) {
      this.state = dangerNear ? "flee" : "follow";
      this.mover.reset();
    }

    let speed = FOLLOW_SPEED;
    if (this.state === "follow") {
      const target = { x: playerEntity.position.x, z: playerEntity.position.z };
      const d = Math.hypot(target.x - this.position.x, target.z - this.position.z);
      if (d > 1.8) {
        this.speed01 = 1;
        this.mover.moveToward(this, dt, world, target, FOLLOW_SPEED);
      } else {
        this.speed01 = 0;
      }
    } else if (this.state === "hide") {
      speed = HIDE_SPEED;
      let best = null;
      let bestDist = Infinity;
      for (const seg of world.camoWallSegments) {
        if (!this.bodyColor || seg.color.name !== this.bodyColor.name) continue;
        const midx = (seg.x1 + seg.x2) / 2;
        const midz = (seg.z1 + seg.z2) / 2;
        const d = Math.hypot(midx - this.position.x, midz - this.position.z);
        if (d < bestDist) {
          bestDist = d;
          best = seg;
        }
      }
      if (best) {
        const midx = (best.x1 + best.x2) / 2;
        const midz = (best.z1 + best.z2) / 2;
        const dNow = pointToSegmentDistance(this.position.x, this.position.z, best);
        this.speed01 = 1;
        if (dNow > CAMO_TOUCH_DISTANCE * 0.7) {
          this.mover.moveToward(this, dt, world, { x: midx, z: midz }, speed);
        } else {
          this.speed01 = 0;
        }
      } else {
        this.state = "flee";
      }
    } else if (this.state === "flee") {
      speed = HIDE_SPEED;
      this.speed01 = 1;
      if (nearestDanger) {
        const awayX = this.position.x - nearestDanger.x;
        const awayZ = this.position.z - nearestDanger.z;
        const len = Math.hypot(awayX, awayZ) || 1;
        const target = {
          x: this.position.x + (awayX / len) * 10,
          z: this.position.z + (awayZ / len) * 10,
        };
        this.mover.moveToward(this, dt, world, target, speed, { repathInterval: 0.8 });
      }
    }

    this.mesh.rotation.y = this.facing;
    animateStickFigure(this.mesh, dt, this.speed01);
  }

  // 레벨1 전용: 플레이어를 중심으로 회전하는 원형 대형 슬롯을 그대로
  // 쫓아가고, 몸 색은 매 프레임 플레이어와 동일하게 맞춘다.
  _updateSynced(dt, world, playerEntity) {
    const pColorName = playerEntity.bodyColor ? playerEntity.bodyColor.name : null;
    const cColorName = this.bodyColor ? this.bodyColor.name : null;
    if (pColorName !== cColorName) {
      if (playerEntity.bodyColor) {
        this.bodyColor = playerEntity.bodyColor;
        setStickFigureColor(this.mesh, this.bodyColor.hex);
      } else {
        this.stripColor();
      }
    }

    const angle = this.formationAngle + playerEntity.facing;
    const fwd = forwardVector(angle);
    const targetX = playerEntity.position.x + fwd.x * this.formationRadius;
    const targetZ = playerEntity.position.z + fwd.z * this.formationRadius;
    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    const dist = Math.hypot(dx, dz);
    this.speed01 = Math.min(1, dist / 2);
    if (dist > 0.05) {
      const nx = dx / dist;
      const nz = dz / dist;
      const moveDist = Math.min(dist, SYNC_FORMATION_SPEED * dt);
      const resolved = collideAndSlide(
        this.position.x + nx * moveDist,
        this.position.z + nz * moveDist,
        this.radius,
        world.wallSegments,
        world.crateObstacles
      );
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    }
    this.facing = playerEntity.facing;
    this.mesh.rotation.y = this.facing;
    animateStickFigure(this.mesh, dt, this.speed01);
  }
}
