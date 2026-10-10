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

// 바닥에 떨어진 마법봉/망치 아이템의 모양. 화살/검과 같은 비콘 처리로
// 멀리서도 눈에 띄게 한다.
export function buildToolPickupMesh(kind) {
  const group = new THREE.Group();
  const glowColor = kind === "wand" ? 0xffcf5e : 0xff8a3d;
  if (kind === "wand") {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2c5c, roughness: 0.4 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 8), mat);
    rod.rotation.z = Math.PI / 2.6;
    group.add(rod);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0xffe9ac, emissive: 0xffcf5e, emissiveIntensity: 1.6, roughness: 0.2 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), orbMat);
    orb.position.set(0.42, 0.36, 0);
    group.add(orb);
  } else {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 0.6 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), mat);
    handle.rotation.z = Math.PI / 2.3;
    group.add(handle);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffab5e, emissive: 0xff8a3d, emissiveIntensity: 1.2, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.26), headMat);
    head.position.set(0.36, 0.2, 0);
    group.add(head);
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

// 마법봉을 쓸 때 플레이어 발밑에서 퍼져나가는 황금빛 소환 원.
export function buildWandEffectMesh(radius) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.55, radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffcf5e, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// 망치로 벽/먼지를 부술 때 생기는 충격파 원.
export function buildHammerEffectMesh(radius) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// 마법봉에 갇힌 졸라맨을 둘러싸는 형광 보라색 감옥. 먼지가 닿기 전까지는
// 계속 보인다. 기본적으로 숨겨진 채로 만들어지고, 갇혔을 때만 켠다.
export function buildCageMesh() {
  const group = new THREE.Group();
  const barCount = 8;
  const radius = 0.55;
  const height = 3.3;
  const mat = new THREE.MeshBasicMaterial({ color: 0xc060ff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, height, 6), mat);
    bar.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    group.add(bar);
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc060ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.028, 6, 16), ringMat);
  topRing.rotation.x = Math.PI / 2;
  topRing.position.y = height;
  group.add(topRing);
  const bottomRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.028, 6, 16), ringMat);
  bottomRing.rotation.x = Math.PI / 2;
  bottomRing.position.y = 0.05;
  group.add(bottomRing);
  const light = new THREE.PointLight(0xc060ff, 4, 5, 1.8);
  light.position.y = height / 2;
  group.add(light);
  group.visible = false;
  return group;
}
