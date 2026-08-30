import * as THREE from "three";
import { buildFactory, MAZE_W, MAZE_H } from "./factory.js";
import { InputManager } from "./input.js";
import { Player } from "./player.js";
import { Companion } from "./companion.js";
import { ThirdPersonCamera } from "./camera.js";
import { ChaserEnemy } from "./enemies/chaser.js";
import { FisherEnemy, TELEGRAPH_TIME } from "./enemies/fisher.js";
import { DustEnemy } from "./enemies/dust.js";
import { collideAndSlide, hasLineOfSight, pointToSegmentDistance } from "./collision.js";
import { buildItemPickupMesh, buildArrowProjectileMesh, buildSwordEffectMesh, buildToolPickupMesh, buildWandEffectMesh, buildHammerEffectMesh } from "./weapons.js";
import { ElevatorSystem } from "./elevator.js";
import {
  GAME_DURATION_SECONDS,
  FREEZE_DURATION_SECONDS,
  forwardVector,
  facingFromDelta,
  ARROW_SPEED,
  ARROW_MAX_RANGE,
  ARROW_HIT_RADIUS,
  ARROW_COOLDOWN,
  ARROW_AI_RANGE,
  SWORD_RADIUS,
  SWORD_COOLDOWN,
  SWORD_EFFECT_DURATION,
  WAND_COOLDOWN,
  WAND_LURE_DURATION,
  WAND_TELEPORT_RADIUS,
  WAND_EFFECT_DURATION,
  HAMMER_RADIUS,
  HAMMER_COOLDOWN,
  HAMMER_EFFECT_DURATION,
} from "./constants.js";

const CHASER_COUNT = 10;
const FISHER_COUNT = 5;
const DUST_COUNT = 9;
const ARROW_ITEM_COUNT = 10;
const SWORD_ITEM_COUNT = 10;
const WAND_ITEM_COUNT = 5;
const HAMMER_ITEM_COUNT = 5;
const ITEM_PICKUP_RADIUS = 1.4;
const FREEZE_TINT = 0x8fe0ff;
const FREEZE_TINT_EMISSIVE = 0x2a8fc7;
const MIN_SPAWN_DIST_FROM_START = 4; // 셀 단위(체비셰프 거리)
const COMPANION_OFFSETS = [
  { x: 1.7, z: 1.1 },
  { x: -1.6, z: 1.4 },
];

function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function pickSpawnCells(openCells, startCell, count) {
  const filtered = openCells.filter(
    (c) => chebyshev({ x: c.cellX, y: c.cellY }, startCell) >= MIN_SPAWN_DIST_FROM_START
  );
  const pool = filtered.length >= count ? filtered : openCells;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class Game {
  constructor({ canvas, hud }) {
    this.canvas = canvas;
    this.hud = hud;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.017);
    this.scene.background = new THREE.Color(0x030304);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 220);
    this.thirdPerson = new ThirdPersonCamera(this.camera);
    this.input = new InputManager(canvas);
    this.elevatorSystem = new ElevatorSystem();
    this.currentFloor = 1;

    this.state = "menu"; // menu | playing | win | lose
    this.timeLeft = GAME_DURATION_SECONDS;
    this._raf = null;
    this._lastTime = 0;

    this._onResize = () => this.onResize();
    window.addEventListener("resize", this._onResize);
    this.onResize();

    this._loop = this._loop.bind(this);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildWorld() {
    if (this.factory) {
      this.scene.remove(this.factory.group);
      this.scene.remove(this.player.mesh);
      for (const c of this.companions) this.scene.remove(c.mesh);
      for (const e of this.chasers) this.scene.remove(e.mesh);
      for (const e of this.fishers) this.scene.remove(e.mesh);
      for (const e of this.dusts) this.scene.remove(e.mesh);
      for (const item of this.itemPickups) this.scene.remove(item.mesh);
      for (const arrow of this.arrows) this.scene.remove(arrow.mesh);
      for (const eff of this.swordEffects) this.scene.remove(eff.mesh);
      for (const eff of this.wandEffects) this.scene.remove(eff.mesh);
      for (const eff of this.hammerEffects) this.scene.remove(eff.mesh);
    }

    const factory = buildFactory(Math.random, { floorNumber: 1 });
    this.factory = factory;
    this.scene.add(factory.group);

    // 긴급 정지 아이템: 게임당 1회, 사용하면 20초간 벽/바닥이 하늘색으로
    // 물들며 졸라맨들의 움직임과 공격이 멈춘다.
    this.hasFreezeItem = true;
    this.freezeTimer = 0;
    this._elapsed = 0;
    this._freezeWallOrigColor = factory.wallMat.color.getHex();
    this._freezeFloorOrigColor = factory.floorMat.color.getHex();

    this.player = new Player(factory.startPosition);
    this.scene.add(this.player.mesh);

    this.companions = COMPANION_OFFSETS.map((offset) => {
      const c = new Companion(factory.startPosition, offset);
      this.scene.add(c.mesh);
      return c;
    });

    this._spawnFloorContents(factory);
  }

  // 엘리베이터로 층을 옮길 때도 재사용하는 공통 스폰 로직: 현재 층의 적/
  // 아이템/엘리베이터를 새로 채운다. 플레이어와 AI 친구는 여기서 건드리지
  // 않는다(호출하는 쪽에서 위치만 옮긴다).
  _spawnFloorContents(factory) {
    this.world = {
      cells: factory.cells,
      mazeW: MAZE_W,
      mazeH: MAZE_H,
      wallSegments: factory.wallSegments,
      crateObstacles: factory.crateObstacles,
      camoWallSegments: factory.camoWallSegments,
      colorRooms: factory.colorRooms,
      openCells: factory.openCells,
      elevators: factory.elevators,
    };
    this.currentFloor = factory.floorNumber;

    const spawnCells = pickSpawnCells(
      factory.openCells,
      { x: factory.startCell.x, y: factory.startCell.y },
      CHASER_COUNT + FISHER_COUNT + DUST_COUNT
    );

    this.chasers = [];
    this.fishers = [];
    this.dusts = [];
    let idx = 0;

    for (let i = 0; i < CHASER_COUNT; i++) {
      const c = spawnCells[idx++ % spawnCells.length];
      const enemy = new ChaserEnemy(new THREE.Vector3(c.x, 0, c.z), { cellX: c.cellX, cellY: c.cellY });
      this.chasers.push(enemy);
      this.scene.add(enemy.mesh);
    }
    for (let i = 0; i < FISHER_COUNT; i++) {
      const c = spawnCells[idx++ % spawnCells.length];
      const enemy = new FisherEnemy(new THREE.Vector3(c.x, 0, c.z), factory.group);
      this.fishers.push(enemy);
      this.scene.add(enemy.mesh);
    }
    for (let i = 0; i < DUST_COUNT; i++) {
      const c = spawnCells[idx++ % spawnCells.length];
      const enemy = new DustEnemy(new THREE.Vector3(c.x, 0.5, c.z), { cellX: c.cellX, cellY: c.cellY });
      this.dusts.push(enemy);
      this.scene.add(enemy.mesh);
    }

    // 화살/검/마법봉/망치 아이템을 바닥 곳곳에 뿌려둔다.
    const itemCells = pickSpawnCells(
      factory.openCells,
      { x: factory.startCell.x, y: factory.startCell.y },
      ARROW_ITEM_COUNT + SWORD_ITEM_COUNT + WAND_ITEM_COUNT + HAMMER_ITEM_COUNT
    );
    this.itemPickups = [];
    let itemIdx = 0;
    const spawnItems = (kind, count, meshFn) => {
      for (let i = 0; i < count; i++) {
        const c = itemCells[itemIdx++ % itemCells.length];
        const mesh = meshFn(kind);
        mesh.position.set(c.x, 0.6, c.z);
        this.scene.add(mesh);
        this.itemPickups.push({ kind, x: c.x, z: c.z, mesh, spinPhase: Math.random() * Math.PI * 2 });
      }
    };
    spawnItems("arrow", ARROW_ITEM_COUNT, buildItemPickupMesh);
    spawnItems("sword", SWORD_ITEM_COUNT, buildItemPickupMesh);
    spawnItems("wand", WAND_ITEM_COUNT, buildToolPickupMesh);
    spawnItems("hammer", HAMMER_ITEM_COUNT, buildToolPickupMesh);

    this.arrows = [];
    this.swordEffects = [];
    this.wandEffects = [];
    this.hammerEffects = [];
    this.elevatorSystem.reset();
  }

  // 엘리베이터로 다른 층으로 이동한다. 타이머/인벤토리는 그대로 유지하고
  // 현재 층의 미로/적/아이템만 새로 만든다.
  goToFloor(floorNumber) {
    this.scene.remove(this.factory.group);
    for (const e of this.chasers) this.scene.remove(e.mesh);
    for (const e of this.fishers) {
      this.scene.remove(e.mesh);
      this.scene.remove(e.line);
      this.scene.remove(e.hook);
    }
    for (const e of this.dusts) this.scene.remove(e.mesh);
    for (const item of this.itemPickups) this.scene.remove(item.mesh);
    for (const arrow of this.arrows) this.scene.remove(arrow.mesh);
    for (const eff of this.swordEffects) this.scene.remove(eff.mesh);
    for (const eff of this.wandEffects) this.scene.remove(eff.mesh);
    for (const eff of this.hammerEffects) this.scene.remove(eff.mesh);

    const factory = buildFactory(Math.random, { floorNumber });
    this.factory = factory;
    this.scene.add(factory.group);
    this._freezeWallOrigColor = factory.wallMat.color.getHex();
    this._freezeFloorOrigColor = factory.floorMat.color.getHex();
    if (this.freezeTimer > 0) this._applyFreezeTint();

    this.player.position.copy(factory.startPosition);
    this.player.facing = Math.PI;

    this.companions.forEach((c, i) => {
      const offset = COMPANION_OFFSETS[i] || { x: 0, z: 0 };
      c.alive = true;
      c.mesh.visible = true;
      c.position.set(factory.startPosition.x + offset.x, 0, factory.startPosition.z + offset.z);
      c.mover.reset();
      c.state = "follow";
    });

    this._spawnFloorContents(factory);

    if (this.hud.onFloorChange) this.hud.onFloorChange(floorNumber, factory.themeLabel);
  }

  _applyFreezeTint() {
    this.factory.wallMat.color.setHex(FREEZE_TINT);
    this.factory.wallMat.emissive.setHex(FREEZE_TINT_EMISSIVE);
    this.factory.wallMat.emissiveIntensity = 0.55;
    this.factory.floorMat.color.setHex(FREEZE_TINT);
    this.factory.floorMat.emissive.setHex(FREEZE_TINT_EMISSIVE);
    this.factory.floorMat.emissiveIntensity = 0.35;
  }

  activateFreeze() {
    if (!this.hasFreezeItem || this.freezeTimer > 0) return;
    this.hasFreezeItem = false;
    this.freezeTimer = FREEZE_DURATION_SECONDS;
    this._applyFreezeTint();
  }

  deactivateFreeze() {
    this.factory.wallMat.color.setHex(this._freezeWallOrigColor);
    this.factory.wallMat.emissive.setHex(0x000000);
    this.factory.wallMat.emissiveIntensity = 1;
    this.factory.floorMat.color.setHex(this._freezeFloorOrigColor);
    this.factory.floorMat.emissive.setHex(0x000000);
    this.factory.floorMat.emissiveIntensity = 1;
  }

  removeChaser(enemy) {
    const idx = this.chasers.indexOf(enemy);
    if (idx === -1) return;
    this.scene.remove(enemy.mesh);
    this.chasers.splice(idx, 1);
  }

  removeFisher(enemy) {
    const idx = this.fishers.indexOf(enemy);
    if (idx === -1) return;
    this.scene.remove(enemy.mesh);
    this.scene.remove(enemy.line);
    this.scene.remove(enemy.hook);
    this.fishers.splice(idx, 1);
  }

  removeDust(enemy) {
    const idx = this.dusts.indexOf(enemy);
    if (idx === -1) return;
    this.scene.remove(enemy.mesh);
    this.dusts.splice(idx, 1);
  }

  // 망치로 부순 벽을 충돌/위장 목록과 씬에서 모두 제거한다.
  removeWall(id) {
    const idx = this.world.wallSegments.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.scene.remove(this.world.wallSegments[idx].mesh);
      this.world.wallSegments.splice(idx, 1);
    }
    const cidx = this.world.camoWallSegments.findIndex((s) => s.id === id);
    if (cidx !== -1) this.world.camoWallSegments.splice(cidx, 1);
  }

  // 화살처럼 곧게 날아가 맞은 졸라맨/낚시꾼을 제거하는 투사체를 만든다.
  spawnArrow(origin, facing) {
    const mesh = buildArrowProjectileMesh();
    mesh.position.set(origin.x, 1.3, origin.z);
    mesh.rotation.y = facing;
    this.scene.add(mesh);
    this.arrows.push({ x: origin.x, z: origin.z, facing, traveled: 0, mesh });
  }

  // 발 밑에 반경 SWORD_RADIUS짜리 보라색 원을 만들고, 그 안의 졸라맨/낚시꾼/
  // 먼지를 모두 제거한다.
  triggerSword(origin) {
    for (const e of [...this.chasers]) {
      if (Math.hypot(e.position.x - origin.x, e.position.z - origin.z) <= SWORD_RADIUS) this.removeChaser(e);
    }
    for (const e of [...this.fishers]) {
      if (Math.hypot(e.position.x - origin.x, e.position.z - origin.z) <= SWORD_RADIUS) this.removeFisher(e);
    }
    for (const e of [...this.dusts]) {
      if (Math.hypot(e.position.x - origin.x, e.position.z - origin.z) <= SWORD_RADIUS) this.removeDust(e);
    }
    const mesh = buildSwordEffectMesh(SWORD_RADIUS);
    mesh.position.set(origin.x, 0.05, origin.z);
    this.scene.add(mesh);
    this.swordEffects.push({ mesh, timer: SWORD_EFFECT_DURATION });
  }

  // 마법봉: 살아있는 모든 졸라맨(쫓아오는 졸라맨 + 낚시하는 졸라맨)을
  // origin 주변으로 끌어와 곧장 위협해오게 만든다.
  spawnWandEffect(origin) {
    const mesh = buildWandEffectMesh(WAND_TELEPORT_RADIUS);
    mesh.position.set(origin.x, 0.05, origin.z);
    this.scene.add(mesh);
    this.wandEffects.push({ mesh, timer: WAND_EFFECT_DURATION });

    for (const chaser of this.chasers) {
      const angle = Math.random() * Math.PI * 2;
      const px = origin.x + Math.cos(angle) * WAND_TELEPORT_RADIUS;
      const pz = origin.z + Math.sin(angle) * WAND_TELEPORT_RADIUS;
      const resolved = collideAndSlide(px, pz, chaser.radius, this.world.wallSegments, this.world.crateObstacles);
      chaser.position.set(resolved.x, 0, resolved.z);
      chaser.target = this.player;
      chaser.state = "chase";
      chaser.loseSightTimer = WAND_LURE_DURATION;
      chaser.mover.reset();
    }
    for (const fisher of this.fishers) {
      const angle = Math.random() * Math.PI * 2;
      const px = origin.x + Math.cos(angle) * WAND_TELEPORT_RADIUS;
      const pz = origin.z + Math.sin(angle) * WAND_TELEPORT_RADIUS;
      const resolved = collideAndSlide(px, pz, fisher.radius, this.world.wallSegments, this.world.crateObstacles);
      fisher.position.set(resolved.x, 0, resolved.z);
      fisher.facing = facingFromDelta(this.player.position.x - fisher.position.x, this.player.position.z - fisher.position.z);
      fisher.aimTarget = this.player;
      fisher.state = "telegraph";
      fisher.timer = TELEGRAPH_TIME;
    }
  }

  // 망치: 가까운 먼지를 부수고, 가까운 벽(테두리 제외) 하나를 부숴 새 길을
  // 낸다.
  triggerHammer(origin) {
    for (const e of [...this.dusts]) {
      if (Math.hypot(e.position.x - origin.x, e.position.z - origin.z) <= HAMMER_RADIUS) this.removeDust(e);
    }
    let nearestWall = null;
    let nearestDist = Infinity;
    for (const seg of this.world.wallSegments) {
      if (seg.boundary) continue;
      const d = pointToSegmentDistance(origin.x, origin.z, seg);
      if (d < HAMMER_RADIUS && d < nearestDist) {
        nearestDist = d;
        nearestWall = seg;
      }
    }
    let effectPos = origin;
    if (nearestWall) {
      effectPos = { x: (nearestWall.x1 + nearestWall.x2) / 2, z: (nearestWall.z1 + nearestWall.z2) / 2 };
      this.removeWall(nearestWall.id);
    }
    const mesh = buildHammerEffectMesh(HAMMER_RADIUS);
    mesh.position.set(effectPos.x, 0.05, effectPos.z);
    this.scene.add(mesh);
    this.hammerEffects.push({ mesh, timer: HAMMER_EFFECT_DURATION });
  }

  start() {
    this.buildWorld();
    this.state = "playing";
    this.timeLeft = GAME_DURATION_SECONDS;
    this._lastTime = performance.now();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  }

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    let dt = (now - this._lastTime) / 1000;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);
    this._lastTime = now;

    if (this.state === "playing") this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endGame(false, "5분이 다 지나버렸다. 시간 초과로 탈출 실패...");
      this.updateHud();
      return;
    }

    this.player.update(dt, this.input, this.world);

    if (this.input.consumeArrowPressed() && this.player.hasArrow && this.player.arrowCooldown <= 0) {
      this.spawnArrow({ x: this.player.position.x, z: this.player.position.z }, this.player.facing);
      this.player.arrowCooldown = ARROW_COOLDOWN;
    }
    if (this.input.consumeSwordPressed() && this.player.hasSword && this.player.swordCooldown <= 0) {
      this.triggerSword({ x: this.player.position.x, z: this.player.position.z });
      this.player.swordCooldown = SWORD_COOLDOWN;
    }
    if (this.input.consumeWandPressed() && this.player.hasWand && this.player.wandCooldown <= 0) {
      this.spawnWandEffect({ x: this.player.position.x, z: this.player.position.z });
      this.player.wandCooldown = WAND_COOLDOWN;
    }
    if (this.input.consumeHammerPressed() && this.player.hasHammer && this.player.hammerCooldown <= 0) {
      this.triggerHammer({ x: this.player.position.x, z: this.player.position.z });
      this.player.hammerCooldown = HAMMER_COOLDOWN;
    }

    if (this.input.consumeFreezePressed()) this.activateFreeze();
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.freezeTimer = 0;
        this.deactivateFreeze();
      }
    }

    // 엘리베이터: 가까이 있을 때 숫자키(1~21)를 누르면 그 층으로 이동한다.
    const digitQueue = this.input.consumeDigitQueue();
    this._elevatorState = this.elevatorSystem.update(dt, this.player.position, this.world.elevators, digitQueue);
    if (this._elevatorState.selectedFloor !== null) {
      this.goToFloor(this._elevatorState.selectedFloor);
    }

    this._elapsed += dt;
    for (const room of this.world.colorRooms) {
      // 위장 벽이 아주 많아진 뒤로도 "여기가 진짜 픽업 문이다"가 한눈에
      // 보이도록 문을 은은하게 맥동시킨다(정적인 위장 벽과 대비됨).
      if (room.doorMat) {
        room.doorMat.opacity = 0.46 + Math.sin(this._elapsed * 2.4 + room.x) * 0.2;
      }
      const d = Math.hypot(this.player.position.x - room.x, this.player.position.z - room.z);
      const inside = d < 2.0;
      // 문에 "닿는 순간"에만 채워지도록 rising-edge로 처리한다.
      if (inside && !room._playerWasInside) {
        this.player.fillTank(room.color);
        if (this.hud.onPickup) this.hud.onPickup(room.color);
      }
      room._playerWasInside = inside;
    }

    // 화살/검/마법봉/망치 아이템: 플레이어든 AI 친구든 가까이 가면 주워서
    // (품에 안겨) 그때부터 무제한으로 쓸 수 있다.
    const ITEM_FLAG = { arrow: "hasArrow", sword: "hasSword", wand: "hasWand", hammer: "hasHammer" };
    for (let i = this.itemPickups.length - 1; i >= 0; i--) {
      const item = this.itemPickups[i];
      item.spinPhase += dt * 1.4;
      item.mesh.rotation.y = item.spinPhase;
      item.mesh.position.y = 0.6 + Math.sin(item.spinPhase * 1.3) * 0.08;

      let collector = null;
      if (this.player.alive && Math.hypot(this.player.position.x - item.x, this.player.position.z - item.z) < ITEM_PICKUP_RADIUS) {
        collector = this.player;
      }
      if (!collector) {
        for (const c of this.companions) {
          if (!c.alive) continue;
          if (Math.hypot(c.position.x - item.x, c.position.z - item.z) < ITEM_PICKUP_RADIUS) {
            collector = c;
            break;
          }
        }
      }
      if (collector) {
        collector[ITEM_FLAG[item.kind]] = true;
        this.scene.remove(item.mesh);
        this.itemPickups.splice(i, 1);
        if (collector === this.player && this.hud.onItemPickup) this.hud.onItemPickup(item.kind);
      }
    }

    const dangerPositions = this.chasers.map((c) => ({ x: c.position.x, z: c.position.z }));
    for (const c of this.companions) c.update(dt, this.world, this.player, dangerPositions);

    const candidates = [];
    if (this.player.alive) candidates.push({ entity: this.player, kind: "player" });
    for (const c of this.companions) {
      if (c.alive) candidates.push({ entity: c, kind: "companion" });
    }

    const onKill = (entity) => {
      if (entity === this.player) {
        this.player.kill();
        this.endGame(false, "졸라맨에게 붙잡히고 말았다...");
      } else if (this.companions.includes(entity)) {
        entity.kill(this.player.position);
      }
    };

    // 긴급 정지 중에는 졸라맨/낚시꾼이 그대로 멈춰서 아예 움직이지도, 공격하지도
    // 않는다(날아가던 낚싯줄도 그 자리에 멈춤). 먼지는 영향받지 않는다.
    if (this.freezeTimer <= 0) {
      for (const chaser of this.chasers) chaser.update(dt, this.world, candidates, onKill);
      for (const fisher of this.fishers) fisher.update(dt, this.world, candidates, onKill);
    }
    for (const dust of this.dusts) dust.update(dt, this.world, candidates);

    // AI 친구도 무기가 있으면 스스로 위협에 대응한다.
    for (const c of this.companions) {
      if (!c.alive) continue;
      if (c.arrowCooldown > 0) c.arrowCooldown -= dt;
      if (c.swordCooldown > 0) c.swordCooldown -= dt;

      if (c.hasSword && c.swordCooldown <= 0) {
        const threatened = [...this.chasers, ...this.dusts].some(
          (e) => Math.hypot(e.position.x - c.position.x, e.position.z - c.position.z) <= SWORD_RADIUS
        );
        if (threatened) {
          this.triggerSword({ x: c.position.x, z: c.position.z });
          c.swordCooldown = SWORD_COOLDOWN;
        }
      }
      if (c.hasArrow && c.arrowCooldown <= 0) {
        let target = null;
        let bestDist = Infinity;
        for (const e of [...this.chasers, ...this.fishers]) {
          const d = Math.hypot(e.position.x - c.position.x, e.position.z - c.position.z);
          if (
            d < ARROW_AI_RANGE &&
            d < bestDist &&
            hasLineOfSight(c.position.x, c.position.z, e.position.x, e.position.z, this.world.wallSegments, this.world.crateObstacles)
          ) {
            bestDist = d;
            target = e;
          }
        }
        if (target) {
          const facing = facingFromDelta(target.position.x - c.position.x, target.position.z - c.position.z);
          this.spawnArrow({ x: c.position.x, z: c.position.z }, facing);
          c.arrowCooldown = ARROW_COOLDOWN;
        }
      }
    }

    // 날아가는 화살: 벽/졸라맨/낚시꾼과 부딪히면 사라진다.
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      const fwd = forwardVector(arrow.facing);
      const moveDist = ARROW_SPEED * dt;
      const rawX = arrow.x + fwd.x * moveDist;
      const rawZ = arrow.z + fwd.z * moveDist;
      const resolved = collideAndSlide(rawX, rawZ, 0.05, this.world.wallSegments, this.world.crateObstacles);
      const hitWall = Math.hypot(resolved.x - rawX, resolved.z - rawZ) > 0.01;
      arrow.x = rawX;
      arrow.z = rawZ;
      arrow.traveled += moveDist;
      arrow.mesh.position.set(rawX, 1.3, rawZ);

      let hitChaser = this.chasers.find((e) => Math.hypot(rawX - e.position.x, rawZ - e.position.z) < ARROW_HIT_RADIUS);
      let hitFisher = !hitChaser
        ? this.fishers.find((e) => Math.hypot(rawX - e.position.x, rawZ - e.position.z) < ARROW_HIT_RADIUS)
        : null;

      if (hitChaser || hitFisher) {
        if (hitChaser) this.removeChaser(hitChaser);
        else this.removeFisher(hitFisher);
        this.scene.remove(arrow.mesh);
        this.arrows.splice(i, 1);
      } else if (hitWall || arrow.traveled > ARROW_MAX_RANGE) {
        this.scene.remove(arrow.mesh);
        this.arrows.splice(i, 1);
      }
    }

    // 검 범위 표시(보라색 원)는 잠깐 나타났다 서서히 사라진다.
    for (let i = this.swordEffects.length - 1; i >= 0; i--) {
      const eff = this.swordEffects[i];
      eff.timer -= dt;
      eff.mesh.material.opacity = Math.max(0, (eff.timer / SWORD_EFFECT_DURATION) * 0.55);
      if (eff.timer <= 0) {
        this.scene.remove(eff.mesh);
        this.swordEffects.splice(i, 1);
      }
    }
    // 마법봉/망치 이펙트도 같은 방식으로 서서히 사라진다.
    for (let i = this.wandEffects.length - 1; i >= 0; i--) {
      const eff = this.wandEffects[i];
      eff.timer -= dt;
      eff.mesh.material.opacity = Math.max(0, (eff.timer / WAND_EFFECT_DURATION) * 0.7);
      if (eff.timer <= 0) {
        this.scene.remove(eff.mesh);
        this.wandEffects.splice(i, 1);
      }
    }
    for (let i = this.hammerEffects.length - 1; i >= 0; i--) {
      const eff = this.hammerEffects[i];
      eff.timer -= dt;
      eff.mesh.material.opacity = Math.max(0, (eff.timer / HAMMER_EFFECT_DURATION) * 0.5);
      if (eff.timer <= 0) {
        this.scene.remove(eff.mesh);
        this.hammerEffects.splice(i, 1);
      }
    }

    if (this.state !== "playing") {
      this.updateHud();
      return;
    }

    const exitDist = Math.hypot(
      this.player.position.x - this.factory.exitPosition.x,
      this.player.position.z - this.factory.exitPosition.z
    );
    if (exitDist < 2.4) {
      this.endGame(true, "5분 안에 탈출했다! 최후의 생존자!");
      this.updateHud();
      return;
    }

    this.thirdPerson.update(dt, this.player, this.world.wallSegments);
    this.updateHud();
  }

  endGame(won, message) {
    if (this.state !== "playing") return;
    this.state = won ? "win" : "lose";
    this.hud.onEnd(won, message);
  }

  updateHud() {
    this.hud.onTick({
      timeLeft: this.timeLeft,
      tank: this.player.tank,
      bodyColor: this.player.bodyColor,
      camouflaged: this.player.isCamouflaged(this.world.camoWallSegments),
      hasFreezeItem: this.hasFreezeItem,
      freezeTimer: this.freezeTimer,
      hasArrow: this.player.hasArrow,
      hasSword: this.player.hasSword,
      hasWand: this.player.hasWand,
      hasHammer: this.player.hasHammer,
      currentFloor: this.currentFloor,
      elevatorActive: !!this._elevatorState?.activeElevator,
      elevatorDigits: this._elevatorState?.pendingDigits || [],
    });
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.input.dispose();
    window.removeEventListener("resize", this._onResize);
  }
}
