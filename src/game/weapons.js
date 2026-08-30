import * as THREE from "three";

// 바닥에 떨어진 화살/검 아이템의 모양. 아주 크고 어두운 공장에서도 멀리서
// 눈에 띄도록 실제 모형보다 크게 만들고, 위로 솟은 빛 기둥(비콘)을 세운다.
export function buildItemPickupMesh(kind) {
  const group = new THREE.Group();
  const glowColor = kind === "arrow" ? 0x6fa8ff : 0x9a4fff;
  if (kind === "arrow") {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe8ff,
      emissive: 0x6fa8ff,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6), mat);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), mat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 0.62;
    group.add(tip);
  } else {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd7b6ff,
      emissive: 0x9a4fff,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.035), mat);
    blade.position.y = 0.56;
    group.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.09), mat);
    guard.position.y = 0.03;
    group.add(guard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 6), mat);
    handle.position.y = -0.21;
    group.add(handle);
  }
  const light = new THREE.PointLight(glowColor, 6, 8, 1.6);
  group.add(light);

  const beaconHeight = 3.2;
  const beaconMat = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, beaconHeight, 10, 1, true), beaconMat);
  beacon.position.y = beaconHeight / 2 - 0.6;
  group.add(beacon);

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
