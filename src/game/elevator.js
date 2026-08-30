import * as THREE from "three";
import { WALL_HEIGHT, ELEVATOR_INTERACT_RADIUS, ELEVATOR_MAX_FLOOR, ELEVATOR_DIGIT_GRACE } from "./constants.js";

// 엘리베이터 모양: 문 프레임 + 닫힌 금속 문 두 짝 + 위쪽에 은은히 빛나는
// 표시판. 가까이 가서 숫자키를 누르면 그 층으로 순간이동한다.
export function buildElevatorMesh() {
  const group = new THREE.Group();
  const height = Math.min(3.1, WALL_HEIGHT - 0.4);
  const width = 1.8;
  const depth = 0.32;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8891a0, roughness: 0.35, metalness: 0.65 });
  const postGeo = new THREE.BoxGeometry(0.16, height, depth);
  const postL = new THREE.Mesh(postGeo, frameMat);
  postL.position.set(-width / 2, height / 2, 0);
  group.add(postL);
  const postR = new THREE.Mesh(postGeo, frameMat);
  postR.position.set(width / 2, height / 2, 0);
  group.add(postR);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.16, 0.18, depth), frameMat);
  lintel.position.set(0, height, 0);
  group.add(lintel);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cf, roughness: 0.3, metalness: 0.7 });
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(width / 2 - 0.04, height - 0.1, 0.08), doorMat);
    door.position.set((side * width) / 4, (height - 0.1) / 2, 0);
    group.add(door);
  }

  // 안내 표시판 - 층 이동이 가능함을 알리는 은은한 파란빛.
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x4fb0ff, emissiveIntensity: 1.2, roughness: 0.3 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.06), panelMat);
  panel.position.set(0, height + 0.32, depth / 2 + 0.02);
  group.add(panel);

  const light = new THREE.PointLight(0x4fb0ff, 5, 7, 1.6);
  light.position.set(0, height * 0.6, 0.6);
  group.add(light);

  group.userData.panelMat = panelMat;
  return group;
}

// 플레이어가 엘리베이터에 가까이 있을 때 숫자키 입력을 받아 층을 조합한다.
// 한 자리(1~9)는 바로 그 층, 두 자리는 십의자리/일의자리를 짧은 시간
// 안에 함께 눌러서 입력한다 (예: '1'과 '2'를 함께 눌러 12층).
export class ElevatorSystem {
  constructor() {
    this.digits = [];
    this.graceTimer = 0;
    this.activeElevator = null;
  }

  update(dt, playerPos, elevators, digitQueue) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const el of elevators) {
      const d = Math.hypot(playerPos.x - el.x, playerPos.z - el.z);
      if (d < ELEVATOR_INTERACT_RADIUS && d < nearestDist) {
        nearestDist = d;
        nearest = el;
      }
    }
    if (nearest !== this.activeElevator) {
      this.activeElevator = nearest;
      this.digits = [];
      this.graceTimer = 0;
    }

    let selectedFloor = null;
    if (this.activeElevator) {
      for (const d of digitQueue) {
        this.digits.push(d);
        this.graceTimer = ELEVATOR_DIGIT_GRACE;
        if (this.digits.length >= 2) {
          selectedFloor = this._finalize();
          break;
        }
      }
      if (selectedFloor === null && this.digits.length === 1) {
        this.graceTimer -= dt;
        if (this.graceTimer <= 0) {
          selectedFloor = this._finalize();
        }
      }
    } else if (digitQueue.length > 0) {
      // 엘리베이터 근처가 아니면 숫자키는 그냥 버린다.
    }

    return { activeElevator: this.activeElevator, pendingDigits: [...this.digits], selectedFloor };
  }

  _finalize() {
    const floor = this.digits.length === 1 ? this.digits[0] : this.digits[0] * 10 + this.digits[1];
    this.digits = [];
    this.graceTimer = 0;
    if (floor < 1 || floor > ELEVATOR_MAX_FLOOR) return null;
    return floor;
  }

  reset() {
    this.digits = [];
    this.graceTimer = 0;
    this.activeElevator = null;
  }
}
