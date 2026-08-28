import * as THREE from "three";
import { generateMaze } from "./maze.js";
import { RAINBOW_PALETTE, CELL_SIZE, WALL_HEIGHT } from "./constants.js";

export const MAZE_W = 15;
export const MAZE_H = 15;
const WALL_THICK = 0.35;
const HALF = CELL_SIZE / 2;

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cellDegree(cell) {
  return (cell.N ? 0 : 1) + (cell.E ? 0 : 1) + (cell.S ? 0 : 1) + (cell.W ? 0 : 1);
}

export function cellCenter(x, y) {
  return {
    wx: (x - (MAZE_W - 1) / 2) * CELL_SIZE,
    wz: (y - (MAZE_H - 1) / 2) * CELL_SIZE,
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function worldToCell(x, z) {
  const cellX = clamp(Math.round(x / CELL_SIZE + (MAZE_W - 1) / 2), 0, MAZE_W - 1);
  const cellY = clamp(Math.round(z / CELL_SIZE + (MAZE_H - 1) / 2), 0, MAZE_H - 1);
  return { cellX, cellY };
}

function edgeMidpoint(x, y, dir) {
  const { wx, wz } = cellCenter(x, y);
  switch (dir) {
    case "N":
      return { x: wx, z: wz - HALF };
    case "S":
      return { x: wx, z: wz + HALF };
    case "E":
      return { x: wx + HALF, z: wz };
    case "W":
      return { x: wx - HALF, z: wz };
    default:
      return { x: wx, z: wz };
  }
}

function edgeSegment(x, y, dir) {
  const { wx, wz } = cellCenter(x, y);
  switch (dir) {
    case "N":
      return { x1: wx - HALF, z1: wz - HALF, x2: wx + HALF, z2: wz - HALF };
    case "S":
      return { x1: wx - HALF, z1: wz + HALF, x2: wx + HALF, z2: wz + HALF };
    case "E":
      return { x1: wx + HALF, z1: wz - HALF, x2: wx + HALF, z2: wz + HALF };
    case "W":
      return { x1: wx - HALF, z1: wz - HALF, x2: wx - HALF, z2: wz + HALF };
    default:
      return { x1: wx, z1: wz, x2: wx, z2: wz };
  }
}

function bfsDistances(cells, sx, sy) {
  const dist = Array.from({ length: MAZE_H }, () => new Array(MAZE_W).fill(-1));
  const queue = [[sx, sy]];
  dist[sy][sx] = 0;
  let qi = 0;
  while (qi < queue.length) {
    const [x, y] = queue[qi++];
    const cell = cells[y][x];
    const d = dist[y][x];
    const neighbors = [];
    if (!cell.N) neighbors.push([x, y - 1]);
    if (!cell.S) neighbors.push([x, y + 1]);
    if (!cell.E) neighbors.push([x + 1, y]);
    if (!cell.W) neighbors.push([x - 1, y]);
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= MAZE_W || ny < 0 || ny >= MAZE_H) continue;
      if (dist[ny][nx] !== -1) continue;
      dist[ny][nx] = d + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function assignColorsRoundRobin(count, rng) {
  const palette = shuffle(RAINBOW_PALETTE, rng);
  const colors = [];
  for (let i = 0; i < count; i++) colors.push(palette[i % palette.length]);
  return shuffle(colors, rng);
}

function chebyshev(a, b) {
  return Math.max(Math.abs(a.cellX - b.cellX), Math.abs(a.cellY - b.cellY));
}

function spreadSelect(candidates, targetCount, rng) {
  const shuffled = shuffle(candidates, rng);
  let minSep = 3;
  let picked = [];
  while (picked.length < Math.min(targetCount, candidates.length) && minSep >= 0) {
    picked = [];
    for (const c of shuffled) {
      if (picked.length >= targetCount) break;
      if (picked.every((p) => chebyshev(p, c) >= minSep)) picked.push(c);
    }
    minSep--;
  }
  return picked;
}

function makeCanvasTextSprite(text, { color = "#7dffb0", fontSize = 220 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 40;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6, 1.5, 1);
  return sprite;
}

export function buildFactory(rng = Math.random) {
  const cells = generateMaze(MAZE_W, MAZE_H, rng);
  const group = new THREE.Group();

  const startCell = { x: 0, y: 0 };
  const dist = bfsDistances(cells, startCell.x, startCell.y);

  // 출구: 시작점에서 가장 멀리 떨어진 '경계' 셀을 선택한다.
  let exitCell = null;
  let bestDist = -1;
  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      const onBoundary = x === 0 || y === 0 || x === MAZE_W - 1 || y === MAZE_H - 1;
      if (!onBoundary) continue;
      if (x === startCell.x && y === startCell.y) continue;
      if (dist[y][x] > bestDist) {
        bestDist = dist[y][x];
        exitCell = { x, y };
      }
    }
  }
  const exitDir = exitCell.x === 0 ? "W" : exitCell.x === MAZE_W - 1 ? "E" : exitCell.y === 0 ? "N" : "S";

  // 모든 벽 항목 생성 (중복 없이 N/W + 경계 S/E)
  const wallEntries = [];
  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      const cell = cells[y][x];
      if (cell.N) wallEntries.push({ cellX: x, cellY: y, dir: "N", boundary: y === 0, ...edgeSegment(x, y, "N") });
      if (cell.W) wallEntries.push({ cellX: x, cellY: y, dir: "W", boundary: x === 0, ...edgeSegment(x, y, "W") });
      if (y === MAZE_H - 1 && cell.S) wallEntries.push({ cellX: x, cellY: y, dir: "S", boundary: true, ...edgeSegment(x, y, "S") });
      if (x === MAZE_W - 1 && cell.E) wallEntries.push({ cellX: x, cellY: y, dir: "E", boundary: true, ...edgeSegment(x, y, "E") });
    }
  }

  // 출구가 있는 경계 벽은 실제 벽 목록에서 제거해 열린 통로로 만든다.
  const exitEntryIndex = wallEntries.findIndex(
    (w) => w.cellX === exitCell.x && w.cellY === exitCell.y && w.dir === exitDir
  );
  if (exitEntryIndex !== -1) wallEntries.splice(exitEntryIndex, 1);

  // 막다른 방(색깔 방) 후보: degree === 1, 시작/출구 제외
  const deadEnds = [];
  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      if (x === startCell.x && y === startCell.y) continue;
      if (x === exitCell.x && y === exitCell.y) continue;
      const cell = cells[y][x];
      if (cellDegree(cell) === 1) {
        let openDir = "N";
        if (!cell.N) openDir = "N";
        else if (!cell.E) openDir = "E";
        else if (!cell.S) openDir = "S";
        else if (!cell.W) openDir = "W";
        deadEnds.push({ cellX: x, cellY: y, openDir });
      }
    }
  }
  const roomTargets = spreadSelect(deadEnds, Math.min(deadEnds.length, 14), rng);
  const roomColors = assignColorsRoundRobin(roomTargets.length, rng);

  // 위장용 색깔 벽 후보: 경계가 아닌 내부 벽
  const interiorEntries = wallEntries.filter((w) => !w.boundary);
  const camoTargets = spreadSelect(
    interiorEntries.map((w) => ({ ...w, cellX: w.cellX, cellY: w.cellY })),
    Math.min(interiorEntries.length, 16),
    rng
  );
  const camoColors = assignColorsRoundRobin(camoTargets.length, rng);
  const camoKeySet = new Map();
  camoTargets.forEach((t, i) => {
    camoKeySet.set(`${t.cellX},${t.cellY},${t.dir}`, camoColors[i]);
  });

  // ---------- 머티리얼 ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x35373f, roughness: 0.92, metalness: 0.12 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c2e34, roughness: 0.96, metalness: 0.05 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x16171c, roughness: 1 });

  // 바닥/천장
  const spanX = MAZE_W * CELL_SIZE + 20;
  const spanZ = MAZE_H * CELL_SIZE + 20;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), floorMat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT + 0.1;
  group.add(ceiling);

  // 벽: 일반 벽은 InstancedMesh 하나로 묶어 드로우콜을 아끼고, 위장용
  // 색깔 벽(개수가 적음)만 각각 고유 머티리얼의 개별 메쉬로 만든다.
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const wallSegments = [];
  const camoWallSegments = [];
  const plainTransforms = [];

  for (const w of wallEntries) {
    const key = `${w.cellX},${w.cellY},${w.dir}`;
    const camoColor = camoKeySet.get(key);
    const length = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
    const midx = (w.x1 + w.x2) / 2;
    const midz = (w.z1 + w.z2) / 2;
    const angle = Math.atan2(w.z2 - w.z1, w.x2 - w.x1);

    if (camoColor) {
      const mat = new THREE.MeshStandardMaterial({
        color: camoColor.hex,
        emissive: camoColor.hex,
        emissiveIntensity: 0.55,
        roughness: 0.5,
      });
      const mesh = new THREE.Mesh(unitBox, mat);
      mesh.scale.set(length, WALL_HEIGHT, WALL_THICK);
      mesh.position.set(midx, WALL_HEIGHT / 2, midz);
      mesh.rotation.y = -angle;
      group.add(mesh);
      camoWallSegments.push({ ...w, color: camoColor });
    } else {
      plainTransforms.push({ length, midx, midz, angle });
    }

    wallSegments.push({ x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2 });
  }

  if (plainTransforms.length > 0) {
    const plainWalls = new THREE.InstancedMesh(unitBox, wallMat, plainTransforms.length);
    const dummy = new THREE.Object3D();
    plainTransforms.forEach((t, i) => {
      dummy.position.set(t.midx, WALL_HEIGHT / 2, t.midz);
      dummy.rotation.set(0, -t.angle, 0);
      dummy.scale.set(t.length, WALL_HEIGHT, WALL_THICK);
      dummy.updateMatrix();
      plainWalls.setMatrixAt(i, dummy.matrix);
    });
    plainWalls.instanceMatrix.needsUpdate = true;
    group.add(plainWalls);
  }

  // ---------- 색깔 방 문 (통과 가능, 반투명) ----------
  const colorRooms = [];
  roomTargets.forEach((room, i) => {
    const color = roomColors[i];
    const mid = edgeMidpoint(room.cellX, room.cellY, room.openDir);
    const vertical = room.openDir === "N" || room.openDir === "S";

    const doorMat = new THREE.MeshStandardMaterial({
      color: color.hex,
      emissive: color.hex,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.38,
      roughness: 0.15,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.82, WALL_HEIGHT * 0.72), doorMat);
    door.position.set(mid.x, WALL_HEIGHT * 0.4, mid.z);
    if (!vertical) door.rotation.y = Math.PI / 2;
    group.add(door);

    // 실시간 조명 예산을 아끼기 위해 처음엔 꺼두고, 플레이어가 가까이
    // 왔을 때만(게임 루프에서) 켠다.
    const light = new THREE.PointLight(color.hex, 20, 10, 1.6);
    light.position.set(mid.x, 2.2, mid.z);
    light.visible = false;
    group.add(light);

    colorRooms.push({ x: mid.x, z: mid.z, color, light });
  });

  // ---------- 출구 게이트 ----------
  const exitMid = edgeMidpoint(exitCell.x, exitCell.y, exitDir);
  const outward = { x: exitMid.x, z: exitMid.z };
  const dirVec = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[exitDir];
  const gateGlowMat = new THREE.MeshStandardMaterial({
    color: 0x37ff8a,
    emissive: 0x37ff8a,
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });
  const postGeo = new THREE.BoxGeometry(0.4, WALL_HEIGHT, 0.4);
  const perpX = dirVec[1] !== 0 ? 1 : 0;
  const perpZ = dirVec[0] !== 0 ? 1 : 0;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, gateGlowMat);
    post.position.set(
      outward.x + perpX * side * HALF,
      WALL_HEIGHT / 2,
      outward.z + perpZ * side * HALF
    );
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE * (perpX ? 1 : 0.4), 0.4, CELL_SIZE * (perpZ ? 1 : 0.4)), gateGlowMat);
  beam.position.set(outward.x, WALL_HEIGHT, outward.z);
  group.add(beam);
  const exitLight = new THREE.PointLight(0x37ff8a, 45, 20, 1.6);
  exitLight.position.set(outward.x, 2.4, outward.z);
  group.add(exitLight);
  const exitSprite = makeCanvasTextSprite("EXIT");
  exitSprite.position.set(outward.x - dirVec[0] * 2, 2.6, outward.z - dirVec[1] * 2);
  group.add(exitSprite);
  const exitPad = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshBasicMaterial({ color: 0x37ff8a, transparent: true, opacity: 0.25 })
  );
  exitPad.rotation.x = -Math.PI / 2;
  exitPad.position.set(outward.x, 0.03, outward.z);
  group.add(exitPad);

  const exitPosition = new THREE.Vector3(
    outward.x + dirVec[0] * (HALF + 1.5),
    0,
    outward.z + dirVec[1] * (HALF + 1.5)
  );

  // ---------- 장식용 원기둥 기둥/상자 (시야 차단 + 분위기) ----------
  const crateObstacles = [];
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.9 });
  const specialCells = new Set([`${startCell.x},${startCell.y}`, `${exitCell.x},${exitCell.y}`]);
  roomTargets.forEach((r) => specialCells.add(`${r.cellX},${r.cellY}`));

  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      if (specialCells.has(`${x},${y}`)) continue;
      if (rng() > 0.16) continue;
      const { wx, wz } = cellCenter(x, y);
      const ox = wx + (rng() - 0.5) * CELL_SIZE * 0.5;
      const oz = wz + (rng() - 0.5) * CELL_SIZE * 0.5;
      const size = 1.1 + rng() * 0.6;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size * 1.4, size), crateMat);
      crate.position.set(ox, (size * 1.4) / 2, oz);
      crate.rotation.y = rng() * Math.PI;
      group.add(crate);
      crateObstacles.push({ x: ox, z: oz, radius: size * 0.62 });
    }
  }

  // ---------- 조명 ----------
  const ambient = new THREE.AmbientLight(0x454f6e, 1.1);
  group.add(ambient);
  const hemi = new THREE.HemisphereLight(0x3d4566, 0x0a0a0c, 0.7);
  group.add(hemi);

  // 실시간 조명 개수는 렌더 성능에 큰 영향을 주므로, 천장 램프는 빛을 내지
  // 않는 전구 모양(발광 머티리얼)만 배치해 분위기를 내고, 실제 밝기는
  // ambient/hemisphere + 플레이어 헤드램프가 담당한다.
  const bulbGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  for (let y = 1; y < MAZE_H; y += 3) {
    for (let x = 1; x < MAZE_W; x += 3) {
      const { wx, wz } = cellCenter(x, y);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(wx, WALL_HEIGHT - 0.3, wz);
      group.add(bulb);
    }
  }

  const startPos = (() => {
    const { wx, wz } = cellCenter(startCell.x, startCell.y);
    return new THREE.Vector3(wx, 0, wz);
  })();

  const openCells = [];
  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      const { wx, wz } = cellCenter(x, y);
      openCells.push({ x: wx, z: wz, cellX: x, cellY: y });
    }
  }

  return {
    group,
    cells,
    wallSegments,
    camoWallSegments,
    crateObstacles,
    colorRooms,
    exitPosition,
    startPosition: startPos,
    startCell,
    exitCell,
    openCells,
    bounds: { minX: -spanX / 2, maxX: spanX / 2, minZ: -spanZ / 2, maxZ: spanZ / 2 },
  };
}
