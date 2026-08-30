import * as THREE from "three";
import { buildFactory, MAZE_W, MAZE_H } from "./factory.js";
import { InputManager } from "./input.js";
import { Player } from "./player.js";
import { Companion } from "./companion.js";
import { ThirdPersonCamera } from "./camera.js";
import { ChaserEnemy } from "./enemies/chaser.js";
import { FisherEnemy } from "./enemies/fisher.js";
import { DustEnemy } from "./enemies/dust.js";
import { GAME_DURATION_SECONDS, FREEZE_DURATION_SECONDS } from "./constants.js";

const CHASER_COUNT = 6;
const FISHER_COUNT = 3;
const DUST_COUNT = 9;
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
    }

    const factory = buildFactory(Math.random);
    this.factory = factory;
    this.scene.add(factory.group);

    // 긴급 정지 아이템: 게임당 1회, 사용하면 20초간 벽/바닥이 하늘색으로
    // 물들며 졸라맨들의 움직임과 공격이 멈춘다.
    this.hasFreezeItem = true;
    this.freezeTimer = 0;
    this._freezeWallOrigColor = factory.wallMat.color.getHex();
    this._freezeFloorOrigColor = factory.floorMat.color.getHex();

    this.world = {
      cells: factory.cells,
      mazeW: MAZE_W,
      mazeH: MAZE_H,
      wallSegments: factory.wallSegments,
      crateObstacles: factory.crateObstacles,
      camoWallSegments: factory.camoWallSegments,
      colorRooms: factory.colorRooms,
      openCells: factory.openCells,
    };

    this.player = new Player(factory.startPosition);
    this.scene.add(this.player.mesh);

    this.companions = COMPANION_OFFSETS.map((offset) => {
      const c = new Companion(factory.startPosition, offset);
      this.scene.add(c.mesh);
      return c;
    });

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
  }

  activateFreeze() {
    if (!this.hasFreezeItem || this.freezeTimer > 0) return;
    this.hasFreezeItem = false;
    this.freezeTimer = FREEZE_DURATION_SECONDS;
    this.factory.wallMat.color.setHex(FREEZE_TINT);
    this.factory.wallMat.emissive.setHex(FREEZE_TINT_EMISSIVE);
    this.factory.wallMat.emissiveIntensity = 0.55;
    this.factory.floorMat.color.setHex(FREEZE_TINT);
    this.factory.floorMat.emissive.setHex(FREEZE_TINT_EMISSIVE);
    this.factory.floorMat.emissiveIntensity = 0.35;
  }

  deactivateFreeze() {
    this.factory.wallMat.color.setHex(this._freezeWallOrigColor);
    this.factory.wallMat.emissive.setHex(0x000000);
    this.factory.wallMat.emissiveIntensity = 1;
    this.factory.floorMat.color.setHex(this._freezeFloorOrigColor);
    this.factory.floorMat.emissive.setHex(0x000000);
    this.factory.floorMat.emissiveIntensity = 1;
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

    if (this.input.consumeFreezePressed()) this.activateFreeze();
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.freezeTimer = 0;
        this.deactivateFreeze();
      }
    }

    for (const room of this.world.colorRooms) {
      const d = Math.hypot(this.player.position.x - room.x, this.player.position.z - room.z);
      const inside = d < 1.6;
      // 문에 "닿는 순간"에만 채워지도록 rising-edge로 처리한다.
      // (계속 머물러도 매 프레임 다시 채워 넣지 않음 - Enter로 비운 직후
      //  같은 문 앞에 서 있다고 즉시 재충전되는 것을 방지)
      if (inside && !room._playerWasInside) this.player.fillTank(room.color);
      room._playerWasInside = inside;
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

    if (this.state !== "playing") {
      this.updateHud();
      return;
    }

    const exitDist = Math.hypot(
      this.player.position.x - this.factory.exitPosition.x,
      this.player.position.z - this.factory.exitPosition.z
    );
    if (exitDist < 2.4) {
      this.endGame(true, "5분 안에 공장을 탈출했다! 최후의 생존자!");
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
    });
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.input.dispose();
    window.removeEventListener("resize", this._onResize);
  }
}
