import * as THREE from "three";
import { PathMover } from "../pathMover.js";

const WANDER_SPEED = 2.6;
const SEEK_SPEED = 4.3;
const DETECT_RADIUS = 12;
const STRIP_RADIUS = 0.85;

function buildDustMesh() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9a9488,
    roughness: 1,
    transparent: true,
    opacity: 0.82,
  });
  const count = 7;
  for (let i = 0; i < count; i++) {
    const r = 0.12 + Math.random() * 0.14;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.32;
    s.position.set(Math.cos(ang) * rad, 0.5 + (Math.random() - 0.5) * 0.35, Math.sin(ang) * rad);
    group.add(s);
  }
  const light = new THREE.PointLight(0xbdb8a8, 0.5, 4);
  light.position.y = 0.5;
  group.add(light);
  return group;
}

// 색깔을 먹는 먼지. 평소엔 미로를 배회하다가, 색이 채워진 대상(위장 여부와
// 무관하게)을 감지하면 다가가 닿아서 색을 지워버린다.
export class DustEnemy {
  constructor(position) {
    this.mesh = buildDustMesh();
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.5;
    this.position = this.mesh.position;
    this.facing = 0;
    this.radius = 0.45;
    this.mover = new PathMover();
    this.wanderTarget = null;
    this.spinPhase = Math.random() * 10;
  }

  pickWanderTarget(world) {
    const cell = world.openCells[Math.floor(Math.random() * world.openCells.length)];
    this.wanderTarget = { x: cell.x, z: cell.z };
  }

  update(dt, world, candidates) {
    let target = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (!c.entity.alive || !c.entity.bodyColor) continue;
      const d = Math.hypot(c.entity.position.x - this.position.x, c.entity.position.z - this.position.z);
      if (d < DETECT_RADIUS && d < bestDist) {
        bestDist = d;
        target = c.entity;
      }
    }

    if (target) {
      this.mover.moveToward(
        this,
        dt,
        world,
        { x: target.position.x, z: target.position.z },
        SEEK_SPEED,
        { repathInterval: 0.5 }
      );
      if (bestDist < STRIP_RADIUS + this.radius + target.radius) {
        target.stripColor();
      }
    } else {
      if (!this.wanderTarget) this.pickWanderTarget(world);
      const dist = this.mover.moveToward(this, dt, world, this.wanderTarget, WANDER_SPEED, {
        repathInterval: 1.6,
      });
      if (dist < 1.2) this.pickWanderTarget(world);
    }

    this.spinPhase += dt * 1.5;
    this.mesh.rotation.y = this.spinPhase;
    this.mesh.position.y = 0.5 + Math.sin(this.spinPhase * 1.3) * 0.08;
  }
}
