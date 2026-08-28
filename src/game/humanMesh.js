import * as THREE from "three";

// 플레이어/AI 친구용 사람 모양 메쉬 (졸라맨보다 통통한 캡슐 몸통).
// stickFigure.js 의 animateStickFigure/setStickFigureColor 와 호환되는
// userData.limbs / userData.material 구조를 갖는다.
export function buildHumanMesh({ color = 0xb7bcc4, height = 1.85 } = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08 });

  const hipY = height * 0.5;
  const shoulderY = height * 0.82;
  const headRadius = 0.24;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, shoulderY - hipY, 4, 8), material);
  torso.position.y = (hipY + shoulderY) / 2;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 14, 12), material);
  head.position.y = shoulderY + headRadius + 0.08;
  group.add(head);

  function makeLimb(length, radius) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length * 0.68, 4, 6), material);
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    return pivot;
  }

  const legLength = hipY;
  const armLength = shoulderY - hipY;

  const legL = makeLimb(legLength, 0.13);
  legL.position.set(-0.15, hipY, 0);
  const legR = makeLimb(legLength, 0.13);
  legR.position.set(0.15, hipY, 0);
  const armL = makeLimb(armLength * 0.92, 0.1);
  armL.position.set(-0.35, shoulderY, 0);
  const armR = makeLimb(armLength * 0.92, 0.1);
  armR.position.set(0.35, shoulderY, 0);

  group.add(legL, legR, armL, armR);

  group.userData.limbs = { legL, legR, armL, armR };
  group.userData.material = material;
  group.userData.walkPhase = Math.random() * Math.PI * 2;

  return group;
}
