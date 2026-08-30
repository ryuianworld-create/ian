import * as THREE from "three";
import { collideAndSlide } from "./collision.js";
import { isCamouflaged } from "./camo.js";
import { buildHumanMesh } from "./humanMesh.js";
import { animateStickFigure, setStickFigureColor } from "./stickFigure.js";
import { PLAYER_RADIUS, PLAYER_SPEED, PLAYER_TURN_SPEED, forwardVector } from "./constants.js";

export const NEUTRAL_BODY_COLOR = 0xb7bcc4;
const MOUSE_SENSITIVITY = 0.0026;

export class Player {
  constructor(startPosition) {
    this.mesh = buildHumanMesh({ color: NEUTRAL_BODY_COLOR });
    this.mesh.position.copy(startPosition);
    this.position = this.mesh.position;
    this.facing = Math.PI; // 시작 시 통로 안쪽(출발점에서 미로 쪽)을 바라보도록
    this.radius = PLAYER_RADIUS;

    this.tank = null; // { name, hex } | null
    this.bodyColor = null; // { name, hex } | null
    this.alive = true;
    this.speed01 = 0;

    // 손전등(헤드램프) - 아주 어두운 공장에서 시야를 확보해준다.
    // 몸 바깥쪽에 살짝 띄워 배치해 자기 몸이 과다 노출(하얗게 뜨는 현상)되지 않도록 한다.
    this.headlamp = new THREE.SpotLight(0xfff2d0, 110, 26, Math.PI / 4.6, 0.4, 1.05);
    this.headlamp.position.set(0, 1.55, 0.55);
    this.headlampTarget = new THREE.Object3D();
    this.headlampTarget.position.set(0, 1.1, 3); // forwardVector 규칙과 맞춤 (+Z = 정면)
    this.mesh.add(this.headlamp, this.headlampTarget);
    this.headlamp.target = this.headlampTarget;
  }

  fillTank(color) {
    this.tank = color;
  }

  applyTankToBody() {
    if (!this.tank) return false;
    this.bodyColor = this.tank;
    this.tank = null;
    setStickFigureColor(this.mesh, this.bodyColor.hex);
    return true;
  }

  stripColor() {
    if (!this.bodyColor) return;
    this.bodyColor = null;
    setStickFigureColor(this.mesh, NEUTRAL_BODY_COLOR);
  }

  kill() {
    this.alive = false;
  }

  update(dt, input, world) {
    if (!this.alive) return;

    if (input.turnLeft) this.facing += PLAYER_TURN_SPEED * dt;
    if (input.turnRight) this.facing -= PLAYER_TURN_SPEED * dt;
    if (input.consumeMouseDeltaX) {
      const mouseDeltaX = input.consumeMouseDeltaX();
      if (mouseDeltaX) this.facing -= mouseDeltaX * MOUSE_SENSITIVITY;
    }
    this.mesh.rotation.y = this.facing;

    let move = 0;
    if (input.forward) move += 1;
    if (input.backward) move -= 0.65;
    this.speed01 = Math.min(1, Math.abs(move));

    if (move !== 0) {
      const fwd = forwardVector(this.facing);
      const dx = fwd.x * move * PLAYER_SPEED * dt;
      const dz = fwd.z * move * PLAYER_SPEED * dt;
      const resolved = collideAndSlide(
        this.position.x + dx,
        this.position.z + dz,
        this.radius,
        world.wallSegments,
        world.crateObstacles
      );
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    }

    animateStickFigure(this.mesh, dt, this.speed01);

    if (input.consumeEnterPressed()) {
      this.applyTankToBody();
    }
  }

  isCamouflaged(camoWallSegments) {
    return isCamouflaged(this, camoWallSegments);
  }
}
