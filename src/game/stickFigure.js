import * as THREE from "three";

// 졸라맨(스틱맨) 모양의 THREE.Group을 만든다. 얇은 원기둥 팔다리 + 구 머리로 구성.
// group.userData.limbs 에 애니메이션용 팔다리 참조를 담아 둔다.
export function buildStickFigure({ color = 0x111111, height = 1.9 } = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
  });

  const limbRadius = 0.055;
  const headRadius = 0.22;

  const hipY = height * 0.5;
  const shoulderY = height * 0.82;

  // 몸통
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(limbRadius, limbRadius, shoulderY - hipY, 6),
    material
  );
  torso.position.y = (hipY + shoulderY) / 2;
  group.add(torso);

  // 머리
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 10, 8), material);
  head.position.y = shoulderY + headRadius + 0.05;
  group.add(head);

  function makeLimb(length) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(limbRadius, limbRadius, length, 6),
      material
    );
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    return pivot;
  }

  const legLength = hipY;
  const armLength = shoulderY - hipY;

  const legL = makeLimb(legLength);
  legL.position.set(-0.09, hipY, 0);
  const legR = makeLimb(legLength);
  legR.position.set(0.09, hipY, 0);

  const armL = makeLimb(armLength * 0.95);
  armL.position.set(-0.16, shoulderY, 0);
  const armR = makeLimb(armLength * 0.95);
  armR.position.set(0.16, shoulderY, 0);

  group.add(legL, legR, armL, armR);

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  group.userData.limbs = { legL, legR, armL, armR };
  group.userData.material = material;
  group.userData.walkPhase = Math.random() * Math.PI * 2;

  return group;
}

// 걷기/뛰기 팔다리 스윙 애니메이션. speed01: 0(정지)~1(전력질주)
export function animateStickFigure(group, dt, speed01) {
  group.userData.walkPhase += dt * (4 + speed01 * 6);
  const swing = 0.55 * Math.min(1, speed01 + 0.08);
  const { legL, legR, armL, armR } = group.userData.limbs;
  const s = Math.sin(group.userData.walkPhase);
  legL.rotation.x = s * swing;
  legR.rotation.x = -s * swing;
  armL.rotation.x = -s * swing * 0.8;
  armR.rotation.x = s * swing * 0.8;
}

export function setStickFigureColor(group, hex) {
  group.userData.material.color.setHex(hex);
}
