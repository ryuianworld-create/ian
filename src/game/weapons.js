import * as THREE from "three";

// 바닥에 떨어진 화살/검 아이템의 모양.
export function buildItemPickupMesh(kind) {
  const group = new THREE.Group();
  if (kind === "arrow") {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe8ff,
      emissive: 0x6fa8ff,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6), mat);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), mat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 0.36;
    group.add(tip);
    const light = new THREE.PointLight(0x6fa8ff, 3, 5, 1.6);
    group.add(light);
  } else {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd7b6ff,
      emissive: 0x9a4fff,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.6, 0.02), mat);
    blade.position.y = 0.32;
    group.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.05), mat);
    guard.position.y = 0.02;
    group.add(guard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), mat);
    handle.position.y = -0.12;
    group.add(handle);
    const light = new THREE.PointLight(0x9a4fff, 3, 5, 1.6);
    group.add(light);
  }
  group.position.y = 0.6;
  return group;
}

// 날아가는 화살(투사체)의 모양. 낚시하는 졸라맨의 낚싯줄처럼 곧게 날아간다.
export function buildArrowProjectileMesh() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), mat);
  shaft.rotation.x = Math.PI / 2;
  group.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), mat);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.33;
  group.add(tip);
  return group;
}

// 검을 쓸 때 바닥에 나타나는 보라색 범위 원.
export function buildSwordEffectMesh(radius) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ color: 0xb060ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
