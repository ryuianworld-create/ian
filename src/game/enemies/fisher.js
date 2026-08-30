import * as THREE from "three";
import { buildStickFigure, animateStickFigure } from "../stickFigure.js";
import { canSeeTarget } from "../visibility.js";
import { forwardVector, facingFromDelta } from "../constants.js";

const VISION_RANGE = 15;
const VISION_HALF_ANGLE = Math.PI * 0.55; // 넓게 훑어봄 (~100도)
const TELEGRAPH_TIME = 0.65;
const CAST_TIME = 0.4;
const COOLDOWN_TIME = 2.6;
const LINE_HIT_RADIUS = 0.7;

const UP = new THREE.Vector3(0, 1, 0);

// 낚시하는 졸라맨. 제자리에서 대상을 발견하면 낚싯줄을 던지고, 줄(훅)이
// 대상에 닿으면 즉사시킨다. 위장한 대상은 애초에 발견하지 못한다.
export class FisherEnemy {
  constructor(position, sceneGroup) {
    this.mesh = buildStickFigure({ color: 0x3a2c1c, height: 1.85, eyeColor: 0xff9a2a });
    this.mesh.position.copy(position);
    this.position = this.mesh.position;
    this.facing = Math.random() * Math.PI * 2;
    this.radius = 0.4;
    this.alive = true;
    this.state = "idle";
    this.timer = 0;
    this.aimTarget = null;
    this.castEnd = null;
    this.speed01 = 0.12;

    const rodMat = new THREE.MeshStandardMaterial({ color: 0x8a6135, roughness: 0.7 });
    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 1.5, 5), rodMat);
    this.rod.position.set(0, -0.7, 0.05);
    this.rod.rotation.z = Math.PI / 2.3;
    this.mesh.userData.limbs.armR.add(this.rod);

    this.line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 4),
      new THREE.MeshBasicMaterial({ color: 0xe8e8e8 })
    );
    this.line.visible = false;
    this.hook = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b3b })
    );
    this.hook.visible = false;
    sceneGroup.add(this.line, this.hook);
  }

  getCastOrigin() {
    const fwd = forwardVector(this.facing);
    return { x: this.position.x + fwd.x * 0.35, y: 1.5, z: this.position.z + fwd.z * 0.35 };
  }

  updateLineMesh(start, end) {
    const s = new THREE.Vector3(start.x, start.y, start.z);
    const e = new THREE.Vector3(end.x, end.y, end.z);
    const dir = new THREE.Vector3().subVectors(e, s);
    const len = Math.max(0.001, dir.length());
    const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
    this.line.position.copy(mid);
    this.line.scale.set(1, len, 1);
    this.line.quaternion.setFromUnitVectors(UP, dir.normalize());
    this.hook.position.copy(e);
  }

  update(dt, world, candidates, onKill) {
    if (this.state === "idle") {
      let found = null;
      for (const c of candidates) {
        if (canSeeTarget(this.position, this.facing, c.entity, world, { range: VISION_RANGE, halfAngle: VISION_HALF_ANGLE })) {
          found = c.entity;
          break;
        }
      }
      if (found) {
        this.aimTarget = found;
        this.facing = facingFromDelta(found.position.x - this.position.x, found.position.z - this.position.z);
        this.state = "telegraph";
        this.timer = TELEGRAPH_TIME;
      }
    } else if (this.state === "telegraph") {
      this.timer -= dt;
      if (this.aimTarget && this.aimTarget.alive) {
        this.facing = facingFromDelta(
          this.aimTarget.position.x - this.position.x,
          this.aimTarget.position.z - this.position.z
        );
      }
      if (this.timer <= 0) {
        this.state = "cast";
        this.timer = CAST_TIME;
        this.castEnd = this.aimTarget
          ? { x: this.aimTarget.position.x, z: this.aimTarget.position.z }
          : { x: this.position.x, z: this.position.z };
      }
    } else if (this.state === "cast") {
      this.timer -= dt;
      this.line.visible = true;
      this.hook.visible = true;
      const origin = this.getCastOrigin();
      const t = Math.min(1, (1 - this.timer / CAST_TIME) * 1.5);
      const reach = {
        x: origin.x + (this.castEnd.x - origin.x) * t,
        y: 0.95,
        z: origin.z + (this.castEnd.z - origin.z) * t,
      };
      this.updateLineMesh(origin, reach);

      if (this.aimTarget && this.aimTarget.alive) {
        const d = Math.hypot(this.aimTarget.position.x - reach.x, this.aimTarget.position.z - reach.z);
        if (d < LINE_HIT_RADIUS) {
          onKill(this.aimTarget);
        }
      }
      if (this.timer <= 0) {
        this.state = "cooldown";
        this.timer = COOLDOWN_TIME;
        this.line.visible = false;
        this.hook.visible = false;
        this.aimTarget = null;
      }
    } else if (this.state === "cooldown") {
      this.timer -= dt;
      if (this.timer <= 0) this.state = "idle";
    }

    this.mesh.rotation.y = this.facing;
    this.speed01 = this.state === "cast" ? 0.55 : 0.1;
    animateStickFigure(this.mesh, dt, this.speed01);
  }
}
