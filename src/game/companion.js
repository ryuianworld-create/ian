import * as THREE from "three";
import { buildHumanMesh } from "./humanMesh.js";
import { animateStickFigure, setStickFigureColor } from "./stickFigure.js";
import { PathMover } from "./pathMover.js";
import { isCamouflaged } from "./camo.js";
import { pointToSegmentDistance } from "./collision.js";
import { PLAYER_RADIUS, CAMO_TOUCH_DISTANCE } from "./constants.js";

const FRIEND_NEUTRAL_COLOR = 0x8fc9ff;
const FOLLOW_SPEED = 5.6;
const HIDE_SPEED = 6.6;
const DANGER_RADIUS = 15;
const SAFE_RADIUS = 20;
const RESPAWN_DELAY = 7;

export class Companion {
  constructor(startPosition, offset) {
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
        const anchor = this._respawnAnchor || playerEntity.position;
        this.position.set(anchor.x + (Math.random() - 0.5) * 3, 0, anchor.z + (Math.random() - 0.5) * 3);
        this.mover.reset();
        this.state = "follow";
      }
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
      this.speed01 = d > 2.2 ? 1 : Math.max(0, (d - 0.6) / 1.6);
      if (d > 2.2) this.mover.moveToward(this, dt, world, target, FOLLOW_SPEED);
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
}
