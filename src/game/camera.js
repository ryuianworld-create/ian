import * as THREE from "three";
import { forwardVector } from "./constants.js";
import { raycastNearestWallT as raycastWalls } from "./collision.js";

// 플레이어를 뒤에서 따라가는 3인칭 추적 카메라. 부드러운 보간(damping)으로
// 회전/이동 시 카메라가 자연스럽게 따라오도록 하고, 벽 뒤로 카메라가 뚫고
// 들어가지 않도록 벽에 부딪히면 앞으로 당겨준다.
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.currentPos = new THREE.Vector3();
    this.currentLook = new THREE.Vector3();
    this.initialized = false;
  }

  update(dt, target, wallSegments) {
    const fwd = forwardVector(target.facing);
    const backDist = 6.4;
    const height = 3.5;

    let clampedDist = backDist;
    if (wallSegments) {
      const t = raycastWalls(
        target.position.x,
        target.position.z,
        target.position.x - fwd.x * backDist,
        target.position.z - fwd.z * backDist,
        wallSegments
      );
      if (t < 1) clampedDist = Math.max(1.4, backDist * t - 0.35);
    }

    const desiredPos = new THREE.Vector3(
      target.position.x - fwd.x * clampedDist,
      target.position.y + height,
      target.position.z - fwd.z * clampedDist
    );
    const desiredLook = new THREE.Vector3(
      target.position.x + fwd.x * 2,
      target.position.y + 1.3,
      target.position.z + fwd.z * 2
    );

    if (!this.initialized) {
      this.currentPos.copy(desiredPos);
      this.currentLook.copy(desiredLook);
      this.initialized = true;
    } else {
      const posT = 1 - Math.pow(0.00002, dt);
      const lookT = 1 - Math.pow(0.00001, dt);
      this.currentPos.lerp(desiredPos, Math.min(1, posT));
      this.currentLook.lerp(desiredLook, Math.min(1, lookT));
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }
}
