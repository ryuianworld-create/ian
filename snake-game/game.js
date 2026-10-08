/* ===================== 구렁이의 저택 — game logic ===================== */
(function(){
'use strict';

/* ---------- constants ---------- */
const LEVEL_Y = [0, 3.4, 6.8];
const WALL_T = 0.25, WALL_H = 3.0;
const PLAYER_SPEED = 5.2, PLAYER_RADIUS = 0.34;
const SNAKE_SPEED = 3.3, SNAKE_SLOW_SPEED = 1.55, SNAKE_RADIUS = 0.4;
const JUMP_SPEED = 6.4, GRAVITY = 19;
const CATCH_RADIUS = 1.05, KEY_RADIUS = 0.75, SAFE_RADIUS = 1.3, DOOR_RADIUS = 1.6;
const SPRAY_RADIUS = 4.4, SPRAY_COS = 0.42, SPRAY_COOLDOWN = 1.5;
const CATCH_SLOW_TIME = 5.5, DRAWER_RADIUS = 1.4, HOLE_RADIUS = 0.95;
const AI_TICK = 0.35;
const POOP_RADIUS = 0.55, POOP_COOLDOWN = 5, POOP_LIFETIME = 35, MAX_POOPS = 40;
const GIANT_POOP_HOLD = 10, GIANT_POOP_COOLDOWN = 10, GIANT_POOP_RADIUS = 2.0, GIANT_POOP_LIFETIME = Infinity;
const GAS_STUN_TIME = 3, GAS_STUN_COOLDOWN = 6;
const FOOD_RADIUS = 0.9, FOOD_RESPAWN = 6, FOOD_MAX = 3;
const HUNGER_RATE = 100/150; // reaches 100% after 150s (2.5min) with no food
const LOAN_AMOUNT = 10000, LOAN_GAIN = 2000, SHOP_COST = 3000, UPGRADE_COST = 5000, MART_FOOD_PRICE = 1000, BREAD_PRICE = 100, CAR_PRICE = 10000;
const CAR_SPEED = 8, CAR_TURN = 2.2, KNOCK_TIME = 3;
const RAPID_EAT_WINDOW = 4, HOSPITAL_TIME = 30;
const VACUUM_RADIUS = 1.2, TOILET_RADIUS = 1.1;
const TOTAL_PLAYERS = 10; // + 1 snake = 11 entities total (human occupies one slot, random role)
const NAMES = ['민준','서연','도윤','하은','시우','지안','예준','수아','주원','다인'];
const COLORS = [0x5f7d95,0xb5674f,0x7a8f5a,0xc9a13b,0x8a5fa8,0x4f9e8f,0xc75b7a,0xd98c3f,0x4f74c9,0x9e4f4f];
const SPAWN_SPOTS = [
  {x:4,z:3},{x:9,z:2},{x:3,z:8},{x:9,z:8},{x:15,z:2},{x:18,z:5},
  {x:14,z:9},{x:18,z:13},{x:14,z:14},{x:3,z:12},{x:9,z:14},
];

const clock = new THREE.Clock();
let renderer, scene, camera;
const keyState = {};
let mouseYaw = -0.6, mousePitch = 0.18;

/* ---------- dom ---------- */
const $ = (id)=>document.getElementById(id);
const startScreen = $('start-screen'), endScreen = $('end-screen');
const startBtn = $('start-btn'), restartBtn = $('restart-btn');
const rolePanel = $('role-panel'), roleName = $('role-name'), roleObjective = $('role-objective');
const slotIron = $('slot-iron'), slotGold = $('slot-gold'), slotSpray = $('slot-spray');
const aliveCountEl = $('alive-count'), totalCountEl = $('total-count');
const hungerFillEl = $('hunger-bar-fill'), hungerValueEl = $('hunger-value');
const moneyValueEl = $('money-value');
const eatenValueEl = $('eaten-value');
const carryPanel = $('carry-panel'), carryValueEl = $('carry-value');
function updateEatenHUD(p){
  if(p.kind!=='human') return;
  eatenValueEl.textContent = (p.totalEaten||0)+'개';
}
function registerEat(p, amount){
  p.food += amount;
  p.totalEaten = (p.totalEaten||0) + amount;
  p.hunger = 0;
  const now = performance.now();
  const tooFast = amount>=3 || (p.lastEatAt && now-p.lastEatAt < RAPID_EAT_WINDOW*1000);
  p.lastEatAt = now;
  if(p.kind==='human') updateEatenHUD(p);
  if(tooFast && !p.sick) makeSick(p);
}
function makeSick(p){
  p.sick = true;
  p.hospitalTimer = HOSPITAL_TIME;
  if(p.mesh && p.mesh.skin) p.mesh.skin.color.setHex(0x7fcf6a);
  const h = interactables.hospital;
  if(h){ p.pos.x = h.x; p.pos.z = h.z; }
  showBanner(p.kind==='human' ? '너무 급하게 먹어서 속이 안 좋다... 병원으로 이송됐다!' : `${p.name}이(가) 급체해서 병원에 실려갔다!`, 'danger', 2600);
}
function recoverFromSick(p){
  p.sick = false;
  p.hospitalTimer = 0;
  if(p.mesh && p.mesh.skin) p.mesh.skin.color.setHex(0xd8b58e);
  showBanner(p.kind==='human' ? '다 나았다! 병원에서 나갈 수 있다' : `${p.name}이(가) 회복했다`, 'good', 2000);
}
function updateCarryHUD(p){
  if(p.kind!=='human') return;
  if(p.carriedFood>0){
    carryPanel.classList.add('show');
    carryValueEl.textContent = p.carriedFood+'개'+(p.carriedPos?' (내려놓음 — 그 자리에서 Backspace)':'');
  } else {
    carryPanel.classList.remove('show');
  }
}
let dropMarkerMesh = null;
function updateDropMarker(p){
  if(p.kind!=='human') return;
  if(p.carriedFood>0 && p.carriedPos){
    if(!dropMarkerMesh){
      dropMarkerMesh = makeFoodMesh();
      dropMarkerMesh.scale.set(1.6,1.6,1.6);
      scene.add(dropMarkerMesh);
    }
    dropMarkerMesh.visible = true;
    dropMarkerMesh.position.set(p.carriedPos.x, LEVEL_Y[levelOf(p.pos.y)]+0.3, p.carriedPos.z);
  } else if(dropMarkerMesh){
    dropMarkerMesh.visible = false;
  }
}
let tablePile = [];
function pileFoodOnTable(n){
  const y0 = LEVEL_Y[0];
  for(let i=0;i<n;i++){
    const mesh = makeFoodMesh();
    mesh.scale.set(0.8,0.8,0.8);
    const a = Math.random()*Math.PI*2, r = Math.random()*0.32;
    mesh.position.set(16+Math.cos(a)*r, y0+1.02+tablePile.length*0.02, 3+Math.sin(a)*r);
    scene.add(mesh);
    tablePile.push(mesh);
  }
  while(tablePile.length > 10){
    const old = tablePile.shift();
    scene.remove(old);
  }
}
const quizOverlay = $('quiz-overlay'), quizProgress = $('quiz-progress'), quizQuestion = $('quiz-question'), quizAnswers = $('quiz-answers'), quizFeedback = $('quiz-feedback');
const promptBar = $('prompt-bar'), promptKey = $('prompt-key'), promptText = $('prompt-text');
const banner = $('banner'), bannerMsg = $('banner-msg');
const sprayFlash = $('spray-flash');

/* ---------- textures ---------- */
function makeCanvasTexture(draw, size){
  size = size || 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const floorTex = makeCanvasTexture((ctx,s)=>{
  ctx.fillStyle = '#3b2a1d'; ctx.fillRect(0,0,s,s);
  for(let i=0;i<10;i++){
    ctx.fillStyle = `rgba(${20+Math.random()*18|0},${14+Math.random()*10|0},${8+Math.random()*8|0},0.5)`;
    ctx.fillRect(0, i*(s/10), s, s/10 - 2);
  }
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
  for(let i=0;i<=10;i++){ ctx.beginPath(); ctx.moveTo(0,i*s/10); ctx.lineTo(s,i*s/10); ctx.stroke(); }
});
floorTex.repeat.set(6,5);
const wallTex = makeCanvasTexture((ctx,s)=>{
  ctx.fillStyle = '#5b4a3a'; ctx.fillRect(0,0,s,s);
  const img = ctx.getImageData(0,0,s,s);
  for(let i=0;i<img.data.length;i+=4){
    const n = (Math.random()-0.5)*14;
    img.data[i]+=n; img.data[i+1]+=n*0.9; img.data[i+2]+=n*0.8;
  }
  ctx.putImageData(img,0,0);
});
wallTex.repeat.set(3,1);
const roofFloorTex = makeCanvasTexture((ctx,s)=>{
  ctx.fillStyle = '#2c2420'; ctx.fillRect(0,0,s,s);
  ctx.strokeStyle='rgba(0,0,0,0.3)';
  for(let i=0;i<8;i++){ for(let j=0;j<8;j++){ ctx.strokeRect(i*s/8,j*s/8,s/8,s/8); } }
});
roofFloorTex.repeat.set(3,3);

const matWall = new THREE.MeshStandardMaterial({map:wallTex, roughness:0.95});
const matFloor = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
const matRoofFloor = new THREE.MeshStandardMaterial({map:roofFloorTex, roughness:0.85});
const matWood = new THREE.MeshStandardMaterial({color:0x5a4127, roughness:0.8});
const matFabric = new THREE.MeshStandardMaterial({color:0x6b4a4a, roughness:1});
const matMetal = new THREE.MeshStandardMaterial({color:0x8a8f94, roughness:0.4, metalness:0.7});

/* ---------- collision registries (per level index 0/1/2) ---------- */
const WALL_BOXES = [[],[],[]];
const FURN_BOXES = [[],[],[]];
let holes = [];
let poops = [];

/* ---------- fart / room gas ---------- */
const ROOM_DEFS = [
  {key:'bathroom', name:'화장실', x1:17,z1:12.5,x2:20,z2:16},
  {key:'kitchen', name:'주방', x1:12,z1:0,x2:20,z2:7},
  {key:'bedroom', name:'안방', x1:12,z1:7,x2:20,z2:16},
  {key:'living', name:'거실', x1:0,z1:0,x2:12,z2:10},
  {key:'landing', name:'계단참', x1:0,z1:10,x2:12,z2:16},
];
const ROOF_DEF = {key:'roof', name:'옥상', x1:0,z1:10,x2:12,z2:16};
const SHOP_ROOM_DEF = {key:'shop', name:'가게', x1:10.5,z1:-7.5,x2:13.5,z2:-4};
function getRoomDef(x,z,level){
  if(level===2) return (x>=ROOF_DEF.x1&&x<=ROOF_DEF.x2&&z>=ROOF_DEF.z1&&z<=ROOF_DEF.z2) ? ROOF_DEF : null;
  if(level===0 && interactables.shopBuilt && x>=SHOP_ROOM_DEF.x1&&x<=SHOP_ROOM_DEF.x2&&z>=SHOP_ROOM_DEF.z1&&z<=SHOP_ROOM_DEF.z2) return SHOP_ROOM_DEF;
  for(const r of ROOM_DEFS){ if(x>=r.x1&&x<=r.x2&&z>=r.z1&&z<=r.z2) return r; }
  return null;
}
const gassedRooms = {};
function fartInRoom(ent){
  const level = levelOf(ent.pos.y);
  const def = getRoomDef(ent.pos.x, ent.pos.z, level);
  if(!def) return;
  const id = level+':'+def.key;
  if(gassedRooms[id]){
    showBanner(ent.kind==='human'?'이미 이 방은 노랗다':`${ent.name}이(가) 방귀를 뀌었다`, 'good', 1400);
    return;
  }
  gassedRooms[id] = true;
  const y0 = LEVEL_Y[level];
  const w = def.x2-def.x1, d = def.z2-def.z1;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, WALL_H-0.08, d),
    new THREE.MeshBasicMaterial({color:0xdccb3f, transparent:true, opacity:0.16, depthWrite:false, side:THREE.DoubleSide})
  );
  mesh.position.set((def.x1+def.x2)/2, y0+WALL_H/2, (def.z1+def.z2)/2);
  mesh.renderOrder = 5;
  scene.add(mesh);
  showBanner(ent.kind==='human' ? `방귀를 뀌었다... ${def.name}의 공기가 영원히 노래졌다` : `${ent.name}이(가) ${def.name}에서 방귀를 뀌었다`, 'good', 2400);
}
function checkGasExposure(snake, dt){
  if(snake.gasCooldown>0) snake.gasCooldown -= dt;
  if(snake.gasCooldown>0) return;
  const level = levelOf(snake.pos.y);
  const def = getRoomDef(snake.pos.x, snake.pos.z, level);
  if(!def) return;
  if(!gassedRooms[level+':'+def.key]) return;
  snake.stunTimer = Math.max(snake.stunTimer, GAS_STUN_TIME);
  snake.gasCooldown = GAS_STUN_COOLDOWN;
  showBanner(snake.kind==='human' ? `${def.name}의 방귀 냄새에 잠시 쓰러졌다` : `뱀이 ${def.name}의 방귀 냄새에 쓰러졌다`, 'good', 1800);
}
/* ---------- quiz ---------- */
const QUIZ_BANK_QUESTIONS = [
  {q:'뱀은 몇 개의 다리를 가지고 있을까?', choices:['0개','2개','4개'], correct:0},
  {q:'뱀이 절대 할 수 없는 행동은?', choices:['계단 오르기','점프하기','걷기'], correct:1},
  {q:'뱀을 처치할 수 있는 아이템은?', choices:['황금 열쇠','뱀 스프레이','쇠 열쇠'], correct:1},
  {q:'뱀은 바닥에 뚫린 구멍에 들어갈 수 있을까?', choices:['들어갈 수 있다','못 들어간다','가끔 들어간다'], correct:1},
  {q:'뱀이 노란 방귀 방에 들어가면?', choices:['빨라진다','잠시 쓰러진다','투명해진다'], correct:1},
  {q:'뱀이 오를 수 없는 것은?', choices:['계단','사다리가 아닌 점프','문'], correct:1},
];
const QUIZ_KOREAN_QUESTIONS = [
  {q:"'맑다'의 반대말은?", choices:['흐리다','밝다','깨끗하다'], correct:0},
  {q:"'크다'의 반대말은?", choices:['많다','작다','넓다'], correct:1},
  {q:"다음 중 명사가 아닌 것은?", choices:['사과','달리다','하늘'], correct:1},
];
let quizState = null;
function startQuiz(questions, count, onSuccess, onFail){
  const pool = questions.slice();
  for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  quizState = {questions: pool.slice(0,Math.min(count,pool.length)), idx:0, onSuccess, onFail};
  quizOverlay.classList.remove('hidden');
  renderQuizQuestion();
}
function renderQuizQuestion(){
  if(!quizState) return;
  quizProgress.textContent = `문제 ${quizState.idx+1} / ${quizState.questions.length}`;
  const item = quizState.questions[quizState.idx];
  quizQuestion.textContent = item.q;
  quizFeedback.textContent = '';
  quizFeedback.className = '';
  quizAnswers.innerHTML = '';
  item.choices.forEach((c,i)=>{
    const btn = document.createElement('button');
    btn.className = 'quiz-answer';
    btn.textContent = c;
    btn.onclick = ()=>answerQuiz(i);
    quizAnswers.appendChild(btn);
  });
}
function answerQuiz(i){
  if(!quizState) return;
  const item = quizState.questions[quizState.idx];
  if(i===item.correct){
    quizState.idx++;
    if(quizState.idx>=quizState.questions.length){
      const onSuccess = quizState.onSuccess;
      quizOverlay.classList.add('hidden');
      quizState = null;
      onSuccess();
    } else {
      quizFeedback.textContent = '정답!';
      quizFeedback.className = 'good';
      setTimeout(renderQuizQuestion, 500);
    }
  } else {
    quizFeedback.textContent = '틀렸다... 처음부터 다시 도전해야 한다.';
    quizFeedback.className = 'danger';
    const onFail = quizState.onFail;
    setTimeout(()=>{ quizOverlay.classList.add('hidden'); quizState=null; if(onFail) onFail(); }, 1100);
  }
}

/* ---------- customers (shop) ---------- */
let customers = [];
const CUSTOMER_LOOP = {cx:12, cz:-5.5, r:3.6};
let customerBreadTimer = 0;
function spawnCustomers(){
  if(customers.length) return;
  const colors = [0x9a5a4a,0x5a7a9a,0x8a9a5a];
  for(let i=0;i<3;i++){
    const hum = makeHumanoid(colors[i], false);
    const angle = (i/3)*Math.PI*2;
    scene.add(hum.group);
    customers.push({mesh:hum, pos:{x:0,z:0}, yaw:0, angle, speed: 0.5+Math.random()*0.2});
  }
}
function updateCustomers(dt){
  customers.forEach(c=>{
    c.angle += c.speed*dt/CUSTOMER_LOOP.r;
    c.pos.x = CUSTOMER_LOOP.cx + Math.cos(c.angle)*CUSTOMER_LOOP.r;
    c.pos.z = CUSTOMER_LOOP.cz + Math.sin(c.angle)*CUSTOMER_LOOP.r;
    c.yaw = c.angle + Math.PI/2; // face the direction of travel around the loop
    c.mesh.group.position.set(c.pos.x, LEVEL_Y[0], c.pos.z);
    c.mesh.group.rotation.y = c.yaw;
  });
  if(customers.length){
    customerBreadTimer -= dt;
    if(customerBreadTimer<=0){
      customerBreadTimer = 6+Math.random()*4;
      humanEntity.money += BREAD_PRICE;
      updateMoneyHUD(humanEntity);
      showBanner(`손님이 빵을 먹었다 — 매출 ${BREAD_PRICE}원`, 'gold', 1600);
    }
  }
}
function makePoopMesh(giant){
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: giant?0x5a3f1e:0x4a3420, roughness:0.85});
  const sizes = giant ? [0.5,0.4,0.3,0.2] : [0.22,0.17,0.12];
  const step = giant ? 0.34 : 0.16;
  sizes.forEach((r,i)=>{
    const m = new THREE.Mesh(new THREE.SphereGeometry(r,12,10), mat);
    m.position.y = i*step;
    m.scale.y = 0.75;
    m.castShadow = true;
    g.add(m);
  });
  if(giant){
    const glow = new THREE.PointLight(0xd8ad5f, 0.8, 4.5, 2);
    glow.position.y = 1.0;
    g.add(glow);
  }
  return g;
}
function dropPoop(ent, giant){
  if(giant){ if(ent.giantPoopCooldown>0) return; ent.giantPoopCooldown = GIANT_POOP_COOLDOWN; }
  else { if(ent.poopCooldown>0) return; ent.poopCooldown = POOP_COOLDOWN; }
  const level = levelOf(ent.pos.y);
  const mesh = makePoopMesh(giant);
  mesh.position.set(ent.pos.x, LEVEL_Y[level], ent.pos.z);
  scene.add(mesh);
  const entry = {x:ent.pos.x, z:ent.pos.z, level, r: giant?GIANT_POOP_RADIUS:POOP_RADIUS, mesh, born:performance.now(), lifetime: giant?GIANT_POOP_LIFETIME:POOP_LIFETIME};
  poops.push(entry);
  if(poops.length > MAX_POOPS){
    const old = poops.shift();
    scene.remove(old.mesh);
  }
  if(giant) showBanner(ent.kind==='human'?'대왕 똥을 쌌다!':`${ent.name}이(가) 대왕 똥을 쌌다!`, 'gold', 2200);
  const hitCustomer = customers.find(c=>Math.hypot(c.pos.x-ent.pos.x,c.pos.z-ent.pos.z)<1.1);
  if(hitCustomer) showBanner('손님이 똥을 맞고 화들짝 놀랐다!', 'danger', 1800);
}
function cleanupPoops(){
  const now = performance.now();
  for(let i=poops.length-1;i>=0;i--){
    if(now - poops[i].born > poops[i].lifetime*1000){
      scene.remove(poops[i].mesh);
      poops.splice(i,1);
    }
  }
}

function addWallBox(level, x1,z1,x2,z2){
  WALL_BOXES[level].push({minX:Math.min(x1,x2),maxX:Math.max(x1,x2),minZ:Math.min(z1,z2),maxZ:Math.max(z1,z2)});
}
function addFurnBox(level, x1,z1,x2,z2){
  FURN_BOXES[level].push({minX:Math.min(x1,x2),maxX:Math.max(x1,x2),minZ:Math.min(z1,z2),maxZ:Math.max(z1,z2)});
}

function buildWallRun(level, axis, fixed, a1, a2, y0, doorA1, doorA2, group){
  const segs = [];
  if(doorA1 == null){ segs.push([a1,a2]); }
  else{
    if(doorA1 - a1 > 0.05) segs.push([a1, doorA1]);
    if(a2 - doorA2 > 0.05) segs.push([doorA2, a2]);
  }
  segs.forEach(([s,e])=>{
    const len = e - s;
    if(len <= 0.02) return;
    let x1,z1,x2,z2, mesh;
    const geo = new THREE.BoxGeometry(axis==='x'?len:WALL_T, WALL_H, axis==='x'?WALL_T:len);
    mesh = new THREE.Mesh(geo, matWall);
    if(axis==='x'){ mesh.position.set(s+len/2, y0+WALL_H/2, fixed); x1=s; x2=s+len; z1=fixed-WALL_T/2; z2=fixed+WALL_T/2; }
    else{ mesh.position.set(fixed, y0+WALL_H/2, s+len/2); x1=fixed-WALL_T/2; x2=fixed+WALL_T/2; z1=s; z2=s+len; }
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    addWallBox(level, x1,z1,x2,z2);
  });
}

function makeDrawer(group, x, z, y0, level, dir, w, h, d){
  w = w||1.2; h = h||0.5; d = d||0.12;
  const dr = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color:0x3d2c1c, roughness:0.7}));
  const sign = dir==='z+' ? 1 : -1;
  dr.position.set(x, y0+0.55, z);
  dr.userData.closedZ = z;
  dr.userData.openZ = z + sign*0.45;
  dr.userData.open = false;
  group.add(dr);
  const entry = {mesh:dr, x, z, level};
  interactables.drawers.push(entry);
  return entry;
}
function buildFurniture(level, y0, group){
  function box(x1,z1,x2,z2,topY,mat,solid){
    const w=Math.abs(x2-x1), d=Math.abs(z2-z1), h=topY;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set((x1+x2)/2, y0+h/2, (z1+z2)/2);
    m.castShadow=m.receiveShadow=true;
    group.add(m);
    if(solid!==false) addFurnBox(level, x1,z1,x2,z2);
    return m;
  }
  // living room
  box(1,7.5,4,9,0.75, matFabric);
  box(1.5,4.7,3.5,5.5,0.5, matWood);
  // kitchen counter + drawers
  const counter = box(14,2,18,4,0.95, matWood);
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.04,20), new THREE.MeshStandardMaterial({color:0xe8c07a, emissive:0x8a5a20, emissiveIntensity:0.4, roughness:0.5}));
  mat.position.set(16, y0+0.97, 3);
  group.add(mat);
  const matTag = makeNameSprite('식탁', '#e8c07a');
  matTag.position.set(16, y0+1.5, 3);
  matTag.scale.set(1.2,0.32,1);
  group.add(matTag);
  [15,17].forEach(dx=>{
    makeDrawer(group, dx, 1.9, y0, level, 'z-');
  });
  if(level===0){
    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(0.9,1.9,0.85), new THREE.MeshStandardMaterial({color:0xe8e2d8, roughness:0.35, metalness:0.2}));
    fridgeBody.position.set(12.6, y0+0.95, 2.5);
    fridgeBody.castShadow = fridgeBody.receiveShadow = true;
    group.add(fridgeBody);
    addFurnBox(level, 12.15,2.07,13.05,2.93);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.5,0.05), matMetal);
    handle.position.set(13.05, y0+1.1, 2.3);
    group.add(handle);
    const fridgeTag = makeNameSprite('냉장고', '#bfe3f0');
    fridgeTag.position.set(12.6, y0+2.15, 2.5);
    fridgeTag.scale.set(1.2,0.32,1);
    group.add(fridgeTag);
    interactables.fridge = {x:12.6, z:2.5, level:0};
  }
  // bathroom (toilet, sink, cabinet drawer)
  box(17.3,13.2,18.1,14, 0.42, new THREE.MeshStandardMaterial({color:0xe7e2d8, roughness:0.35}));
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.5,0.22), new THREE.MeshStandardMaterial({color:0xf1ede4, roughness:0.3}));
  tank.position.set(17.7, y0+0.65, 13.35); group.add(tank);
  box(19,15,19.9,15.7, 0.85, matWood);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.12,0.5), new THREE.MeshStandardMaterial({color:0xe7e2d8, roughness:0.3}));
  basin.position.set(19.45, y0+0.9, 15.35); group.add(basin);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.7,0.6), new THREE.MeshStandardMaterial({color:0x9fb8c4, roughness:0.1, metalness:0.3}));
  mirror.position.set(19.95, y0+1.55, 15.35); group.add(mirror);
  makeDrawer(group, 19.45, 14.85, y0, level, 'z-', 0.55,0.35,0.1);
  // bed + nightstand + lamp
  box(13.5,8.7,17,11.3,0.6, matFabric);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1,0.2,0.6), new THREE.MeshStandardMaterial({color:0xe9ded0}));
  pillow.position.set(14.1, y0+0.72, 9.2); group.add(pillow);
  box(17.3,9.6,18.3,10.6,0.65, matWood);
  makeDrawer(group, 17.8, 9.65, y0, level, 'z-', 0.85,0.25,0.1);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,0.35,10), matMetal);
  lampBase.position.set(17.8, y0+0.83, 10.1); group.add(lampBase);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.28,12,1,true), new THREE.MeshStandardMaterial({color:0xe8c07a, emissive:0xd8ad5f, emissiveIntensity:0.9, side:THREE.DoubleSide}));
  lampShade.position.set(17.8, y0+1.05, 10.1); group.add(lampShade);
  const lampLight = new THREE.PointLight(0xf2c98a, 1.1, 7, 2);
  lampLight.position.set(17.8, y0+1.05, 10.1);
  group.add(lampLight);
}

/* ---------- interactable registries ---------- */
const interactables = {
  keys: [], drawers: [], safe:null, door:null, food: [],
  bank:null, construction:null, vacuum:null, toilet:null,
  shopBuilt:false, upgraded:false, loanTaken:false, fridge:null, fridgeStock:0,
};

function makeFoodMesh(){
  const g = new THREE.Group();
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10), new THREE.MeshStandardMaterial({color:0xc23b3b, roughness:0.4}));
  apple.scale.set(1,0.92,1);
  g.add(apple);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.1,6), new THREE.MeshStandardMaterial({color:0x5a3f1e}));
  stem.position.y = 0.17;
  g.add(stem);
  return g;
}
function spawnFood(){
  // the house only ever has the one starting apple — no respawn. after that,
  // everyone has to buy food at the mart and carry it home.
  const spot = {x:16,z:2.5,level:0};
  const mesh = makeFoodMesh();
  mesh.position.set(spot.x, LEVEL_Y[spot.level]+1.0, spot.z);
  scene.add(mesh);
  interactables.food.push({x:spot.x, z:spot.z, level:spot.level, mesh, available:true, oneTime:true});
}

function makeKeyMesh(type){
  const g = new THREE.Group();
  const mat = type==='gold'
    ? new THREE.MeshStandardMaterial({color:0xd8ad5f, emissive:0x8a6a24, emissiveIntensity:0.5, metalness:0.8, roughness:0.25})
    : new THREE.MeshStandardMaterial({color:0xa9b7bd, emissive:0x445055, emissiveIntensity:0.4, metalness:0.9, roughness:0.3});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13,0.035,8,16), mat);
  ring.rotation.x = Math.PI/2; g.add(ring);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.4,8), mat);
  shaft.position.y = -0.24; g.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.06,0.06), mat);
  tooth.position.set(0.08,-0.42,0); g.add(tooth);
  const light = new THREE.PointLight(type==='gold'?0xd8ad5f:0x9fb2bd, 0.6, 2.4, 2);
  g.add(light);
  g.rotation.z = Math.PI/2;
  return g;
}

function spawnKeys(){
  const floorSpots = [
    {x:2.2,z:7.6,level:0},{x:19.2,z:1.2,level:0},{x:1.0,z:14.5,level:0},
    {x:2.2,z:7.6,level:1},{x:10.5,z:15.2,level:1},
  ];
  // drawers are also valid hiding spots — the key stays hidden until that drawer is opened
  const drawerSpots = interactables.drawers.map(d=>({x:d.x, z:d.z, level:d.level, drawer:d}));
  const candidates = floorSpots.concat(drawerSpots);
  for(let i=candidates.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [candidates[i],candidates[j]]=[candidates[j],candidates[i]]; }
  const spots = candidates.slice(0,2);
  ['iron','gold'].forEach((type,i)=>{
    const spot = spots[i];
    const mesh = makeKeyMesh(type);
    const hidden = !!spot.drawer;
    mesh.position.set(spot.x, LEVEL_Y[spot.level]+(hidden?0.35:0.45), spot.z);
    mesh.visible = !hidden;
    scene.add(mesh);
    const entry = {type, mesh, x:spot.x, z:spot.z, level:spot.level, taken:false, baseY:mesh.position.y, hidden};
    interactables.keys.push(entry);
    if(spot.drawer) spot.drawer.hiddenKey = entry;
  });
}

function buildSafeAndDoor(roofGroup){
  const safeGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1,1.1,0.9), new THREE.MeshStandardMaterial({color:0x2c2f33, roughness:0.5, metalness:0.6}));
  body.position.y = 0.55; safeGroup.add(body);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.06,16), matMetal);
  dial.rotation.x = Math.PI/2; dial.position.set(0,0.65,0.48); safeGroup.add(dial);
  const glow = new THREE.PointLight(0x7ec850, 0, 3, 2);
  glow.position.set(0,0.9,0.6); safeGroup.add(glow);
  safeGroup.position.set(10, LEVEL_Y[2], 12);
  roofGroup.add(safeGroup);
  interactables.safe = { group:safeGroup, glow, x:10, z:12, level:2, unlocked:false, taken:false };

  const doorGroup = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.14,2.6,2.1), new THREE.MeshStandardMaterial({color:0x4a3524, roughness:0.7}));
  slab.position.set(0,1.3,-1.05);
  doorGroup.add(slab);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), matMetal);
  handle.position.set(0.1,1.3,-0.2); doorGroup.add(handle);
  doorGroup.position.set(12, LEVEL_Y[2], 13);
  roofGroup.add(doorGroup);
  interactables.door = { group:doorGroup, x:12, z:13, level:2, opened:false };
}

/* ---------- build house ---------- */
const rootGroup = new THREE.Group();
function buildLevel(level){
  const y0 = LEVEL_Y[level];
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20,0.2,16), matFloor);
  floor.position.set(10, y0-0.1, 8);
  floor.receiveShadow = true;
  g.add(floor);
  buildWallRun(level,'x',0, 0,20, y0, level===0?8:null, level===0?11:null, g); // front door on the ground floor only
  buildWallRun(level,'x',16,0,20, y0, null,null, g);
  buildWallRun(level,'z',0, 0,16, y0, null,null, g);
  buildWallRun(level,'z',20,0,16, y0, null,null, g);
  buildWallRun(level,'z',12, 0,7, y0, 2.5,4.5, g);
  buildWallRun(level,'x',7, 12,20, y0, 14,16, g);
  buildWallRun(level,'x',10, 0,12, y0, 3,5.5, g);
  buildWallRun(level,'z',12, 10,16, y0, 12,14, g);
  // bathroom, carved out of the bedroom's SE corner (clear of the bed/nightstand)
  buildWallRun(level,'z',17, 12.5,16, y0, 13.5,15, g);
  buildWallRun(level,'x',12.5, 17,20, y0, null,null, g);
  buildFurniture(level, y0, g);
  rootGroup.add(g);
}
function buildMartShelves(g){
  const y0 = LEVEL_Y[0];
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.4,0.9,0.5), new THREE.MeshStandardMaterial({color:0x6b4a2c, roughness:0.7}));
  shelf.position.set(3.5, y0+0.45, -8.4);
  shelf.castShadow = shelf.receiveShadow = true;
  g.add(shelf);
  const items = [
    {name:'바나나', color:0xe8d23a, geo:()=>new THREE.CylinderGeometry(0.07,0.1,0.4,8)},
    {name:'사과', color:0xc23b3b, geo:()=>new THREE.SphereGeometry(0.18,10,8)},
    {name:'키위', color:0x7a9a3a, geo:()=>new THREE.SphereGeometry(0.15,10,8)},
    {name:'채소', color:0x4a8a3a, geo:()=>new THREE.ConeGeometry(0.14,0.36,8)},
    {name:'볶음밥', color:0xd8ad5f, geo:()=>new THREE.CylinderGeometry(0.2,0.16,0.16,12)},
  ];
  items.forEach((it,i)=>{
    const x = 1.7 + i*0.9;
    const mesh = new THREE.Mesh(it.geo(), new THREE.MeshStandardMaterial({color:it.color, roughness:0.5}));
    mesh.position.set(x, y0+0.98, -8.4);
    mesh.castShadow = true;
    g.add(mesh);
    const tag = makeNameSprite(it.name, '#e8c07a');
    tag.position.set(x, y0+1.35, -8.4);
    tag.scale.set(1.0,0.28,1);
    g.add(tag);
  });
}
function makeCarMesh(color){
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color: color||0xc23b3b, roughness:0.4, metalness:0.3});
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.5,2.2), bodyMat);
  body.position.y = 0.45; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.95,0.42,1.15), new THREE.MeshStandardMaterial({color:0xbfe3f0, roughness:0.2, transparent:true, opacity:0.6}));
  cabin.position.set(0,0.9,-0.05); cabin.castShadow = true; g.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({color:0x1a1714, roughness:0.8});
  [[-0.58,0.75],[0.58,0.75],[-0.58,-0.75],[0.58,-0.75]].forEach(([x,z])=>{
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.22,14), wheelMat);
    wheel.rotation.z = Math.PI/2; wheel.position.set(x,0.26,z); wheel.castShadow = true;
    g.add(wheel);
  });
  const lightMat = new THREE.MeshStandardMaterial({color:0xfff3c9, emissive:0xfff3c9, emissiveIntensity:1});
  [-0.4,0.4].forEach(x=>{
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6), lightMat);
    hl.position.set(x,0.45,1.08); g.add(hl);
  });
  return g;
}
function buildDealershipCars(g){
  const y0 = LEVEL_Y[0];
  [[4,-15,0x3a6ab0],[7.5,-15,0xd8ad5f]].forEach(([x,z,color])=>{
    const car = makeCarMesh(color);
    car.position.set(x, y0, z);
    car.rotation.y = Math.PI/2;
    g.add(car);
  });
}
function buildHospitalInterior(g){
  const y0 = LEVEL_Y[0];
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1,0.5,2), new THREE.MeshStandardMaterial({color:0xf1ede4, roughness:0.6}));
  bed.position.set(14.5, y0+0.25, -15);
  bed.castShadow = bed.receiveShadow = true;
  g.add(bed);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.25,1,0.1), new THREE.MeshStandardMaterial({color:0xc23b3b, emissive:0xc23b3b, emissiveIntensity:0.6}));
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1,0.25,0.1), new THREE.MeshStandardMaterial({color:0xc23b3b, emissive:0xc23b3b, emissiveIntensity:0.6}));
  crossV.position.set(14.75, y0+2.2, -18.9);
  crossH.position.set(14.75, y0+2.2, -18.9);
  g.add(crossV); g.add(crossH);
}
function spawnCar(){
  const y0 = LEVEL_Y[0];
  const mesh = makeCarMesh(0x2f7ac0);
  mesh.position.set(10.5, y0, -12.5);
  rootGroup.add(mesh);
  interactables.car = {x:10.5, z:-12.5, yaw:0, mesh, speed:0, bought:false, level:0};
}
const AMUSEMENT_PARK_DEF = {x1:1, z1:-32.5, x2:19, z2:-22};
function buildAmusementPark(){
  const y0 = LEVEL_Y[0];
  const ground = new THREE.Mesh(new THREE.BoxGeometry(20,0.12,11), new THREE.MeshStandardMaterial({color:0x3a4a2a, roughness:1}));
  ground.position.set(10, y0-0.02, -27.5);
  rootGroup.add(ground);
  const sign = makeNameSprite('놀이공원', '#e8c07a');
  sign.position.set(10, y0+3.4, -22.3);
  sign.scale.set(3,0.7,1);
  rootGroup.add(sign);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4,0.18,10,20,Math.PI), new THREE.MeshStandardMaterial({color:0xd8ad5f, roughness:0.5}));
  arch.position.set(10, y0+0.2, -22.5);
  rootGroup.add(arch);

  // carousel
  const carousel = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.2,20), new THREE.MeshStandardMaterial({color:0xd8ad5f, roughness:0.5}));
  carousel.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.2,8), matMetal);
  pole.position.y = 1.1; carousel.add(pole);
  const roofM = new THREE.Mesh(new THREE.ConeGeometry(2.4,0.9,16), new THREE.MeshStandardMaterial({color:0xc23b3b, roughness:0.5}));
  roofM.position.y = 2.5; carousel.add(roofM);
  for(let i=0;i<6;i++){
    const a = (i/6)*Math.PI*2;
    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.5,0.9), new THREE.MeshStandardMaterial({color:[0xe8c07a,0xbfe3f0,0x9a5a4a][i%3], roughness:0.5}));
    horse.position.set(Math.cos(a)*1.5, 0.5, Math.sin(a)*1.5);
    horse.rotation.y = a;
    carousel.add(horse);
  }
  carousel.position.set(4.5, y0, -27.5);
  rootGroup.add(carousel);

  // ferris wheel
  const ferris = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.6,0.14,10,24), new THREE.MeshStandardMaterial({color:0xe8c07a, roughness:0.4, emissive:0x5a3a10, emissiveIntensity:0.3}));
  ferris.add(wheel);
  const cabins = [];
  for(let i=0;i<8;i++){
    const a = (i/8)*Math.PI*2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.4), new THREE.MeshStandardMaterial({color:0xbfe3f0, transparent:true, opacity:0.7}));
    cab.position.set(Math.cos(a)*2.6, Math.sin(a)*2.6, 0);
    ferris.add(cab);
    cabins.push(cab);
  }
  const legMat = new THREE.MeshStandardMaterial({color:0x6b6b6b, roughness:0.6});
  [-0.9,0.9].forEach(x=>{
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,3.4,8), legMat);
    leg.position.set(x,1.7,0); leg.rotation.z = x>0?-0.4:0.4;
    ferris.add(leg);
  });
  ferris.position.set(10, y0+2.8, -30.5);
  ferris.rotation.y = Math.PI/2;
  rootGroup.add(ferris);

  // roller coaster — a banked oval loop with a cart that runs around it
  const coaster = new THREE.Group();
  const trackPts = [];
  const rx=3.6, rz=2.2;
  for(let i=0;i<=48;i++){
    const t = (i/48)*Math.PI*2;
    trackPts.push(new THREE.Vector3(Math.cos(t)*rx, Math.sin(t*2)*0.9+1.4, Math.sin(t)*rz));
  }
  const trackCurve = new THREE.CatmullRomCurve3(trackPts, true);
  const trackGeo = new THREE.TubeGeometry(trackCurve, 96, 0.07, 6, true);
  const track = new THREE.Mesh(trackGeo, new THREE.MeshStandardMaterial({color:0x8a8a8a, roughness:0.5, metalness:0.4}));
  coaster.add(track);
  [-1.6,1.6].forEach(x=>{
    for(let z=-1.6;z<=1.6;z+=1.6){
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,1.4,6), new THREE.MeshStandardMaterial({color:0x5a5a5a,roughness:0.7}));
      leg.position.set(x,0.7,z); coaster.add(leg);
    }
  });
  const cart = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.6), new THREE.MeshStandardMaterial({color:0xff4a3a, roughness:0.4, emissive:0x7a1c14, emissiveIntensity:0.5}));
  coaster.add(cart);
  coaster.position.set(15.5, y0, -27.5);
  rootGroup.add(coaster);

  rides = {carousel, ferris, ferrisCabins:cabins, coasterCurve:trackCurve, cart, coasterT:0};
}
let rides = null;
function updateRides(dt){
  if(!rides) return;
  rides.carousel.rotation.y += dt*0.6;
  rides.ferris.rotation.z += dt*0.25;
  rides.coasterT = (rides.coasterT + dt*0.12) % 1;
  const pos = rides.coasterCurve.getPointAt(rides.coasterT);
  rides.cart.position.copy(pos);
  const tangent = rides.coasterCurve.getTangentAt(rides.coasterT);
  rides.cart.lookAt(pos.clone().add(tangent));
}
function buildOutside(){
  const y0 = LEVEL_Y[0];
  const g = new THREE.Group();
  const yard = new THREE.Mesh(new THREE.BoxGeometry(20,0.2,34), new THREE.MeshStandardMaterial({color:0x2a2f22, roughness:1}));
  yard.position.set(10, y0-0.1, -17);
  yard.receiveShadow = true;
  g.add(yard);
  const path = new THREE.Mesh(new THREE.BoxGeometry(3.4,0.22,32), new THREE.MeshStandardMaterial({color:0x4a4235, roughness:0.9}));
  path.position.set(9.5, y0-0.08, -18);
  g.add(path);

  function building(x1,z1,x2,z2,color,label){
    const h = 3.0, doorW = 1.8;
    const cx=(x1+x2)/2, cz=(z1+z2)/2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(x2-x1,0.15,z2-z1), new THREE.MeshStandardMaterial({color:0x4a4235, roughness:0.9}));
    floor.position.set(cx, y0-0.05, cz); floor.receiveShadow = true; g.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({color, roughness:0.7});
    function wall(wx1,wz1,wx2,wz2){
      const w=Math.abs(wx2-wx1)||0.2, d=Math.abs(wz2-wz1)||0.2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
      m.position.set((wx1+wx2)/2, y0+h/2, (wz1+wz2)/2);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      addWallBox(0, wx1,wz1,wx2,wz2);
    }
    wall(x1,z1,x2,z1+0.2);       // south (back) wall
    wall(x1,z1,x1+0.2,z2);       // west wall
    wall(x2-0.2,z1,x2,z2);       // east wall
    const doorA = cx-doorW/2, doorB = cx+doorW/2;
    wall(x1,z2-0.2,doorA,z2);    // north wall, left of door
    wall(doorB,z2-0.2,x2,z2);    // north wall, right of door — leaves an open doorway
    const roof = new THREE.Mesh(new THREE.BoxGeometry(x2-x1,0.15,z2-z1), wallMat);
    roof.position.set(cx, y0+h+0.05, cz); g.add(roof);
    const sign = makeNameSprite(label, '#1a1410');
    sign.position.set(cx, y0+h+0.6, z2);
    sign.scale.set(2.4,0.6,1);
    g.add(sign);
    // interior light so the inside isn't pitch black
    const lamp = new THREE.PointLight(0xfff0d0, 1.3, Math.max(x2-x1,z2-z1)*1.8, 2);
    lamp.position.set(cx, y0+h-0.3, cz);
    g.add(lamp);
    return {x:cx, z:z1+1.2, level:0, doorX:cx, doorZ:z2, x1,z1,x2,z2};
  }

  interactables.mart = building(1,-9,6,-2, 0xb05a3a, '마트');
  interactables.bank = building(8,-9,13,-2, 0x3a6ab0, '은행');
  interactables.construction = building(15,-9,19.5,-2, 0x5a8a4a, '건설회사');
  interactables.dealership = building(2,-19,9.5,-11, 0x3a3a4a, '자동차 매장');
  interactables.hospital = building(11,-19,18.5,-11, 0xe8e2d8, '병원');
  buildMartShelves(g);
  buildDealershipCars(g);
  buildHospitalInterior(g);
  buildAmusementPark();
  spawnCar();

  rootGroup.add(g);
}
function makeVacuumMesh(){
  const vac = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color:0xff4a3a, roughness:0.35, emissive:0xb02818, emissiveIntensity:0.7});
  const vacBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.44,1.15,16), bodyMat);
  vacBody.position.y = 0.58; vacBody.castShadow = true; vac.add(vacBody);
  const vacHead = new THREE.Mesh(new THREE.SphereGeometry(0.3,14,12), new THREE.MeshStandardMaterial({color:0x2c2a28, roughness:0.6}));
  vacHead.position.set(0.3,0.2,0); vac.add(vacHead);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.38,0.045,8,20), new THREE.MeshStandardMaterial({color:0xf1e6d3, roughness:0.4}));
  stripe.rotation.x = Math.PI/2; stripe.position.y = 0.95; vac.add(stripe);
  const glow = new THREE.PointLight(0xff6b5a, 2, 5.5, 2);
  glow.position.y = 1.0; vac.add(glow);
  // a bright floating marker so it reads at a glance, same trick used for the snake
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16,0), new THREE.MeshStandardMaterial({color:0x4ad0ff, emissive:0x4ad0ff, emissiveIntensity:1.4, roughness:0.3}));
  marker.position.y = 1.75;
  vac.add(marker);
  const markerLight = new THREE.PointLight(0x4ad0ff, 1.1, 4.5, 2);
  markerLight.position.y = 1.75;
  vac.add(markerLight);
  return vac;
}
function buildVacuum(){
  const y0 = LEVEL_Y[0];
  const vac = makeVacuumMesh();
  vac.position.set(9.5, y0, 8.4);
  rootGroup.add(vac);
  interactables.vacuum = {x:9.5, z:8.4, homeX:9.5, homeZ:8.4, level:0, mesh:vac};
}
function buildHole(x,z,level){
  const y0 = LEVEL_Y[level];
  const disc = new THREE.Mesh(new THREE.CircleGeometry(HOLE_RADIUS,24), new THREE.MeshStandardMaterial({color:0x050403, roughness:1}));
  disc.rotation.x = -Math.PI/2; disc.position.set(x, y0+0.002, z);
  rootGroup.add(disc);
  // a splintered wood rim so the floor clearly reads as torn open, not just a dark patch
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE_RADIUS*0.95,0.06,8,24), new THREE.MeshStandardMaterial({color:0x6b4a2c, roughness:0.9}));
  rim.rotation.x = Math.PI/2; rim.position.set(x, y0+0.02, z);
  rootGroup.add(rim);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(HOLE_RADIUS*0.92,HOLE_RADIUS*0.92,2.6,20,1,true), new THREE.MeshStandardMaterial({color:0x0a0705, side:THREE.BackSide}));
  shaft.position.set(x, y0-1.3, z);
  rootGroup.add(shaft);
  holes.push({x,z,level,r:HOLE_RADIUS});
}
function buildRoof(){
  const y0 = LEVEL_Y[2];
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12,0.2,6), matRoofFloor);
  floor.position.set(6, y0-0.1, 13);
  floor.receiveShadow = true;
  g.add(floor);
  buildWallRun(2,'z',0, 10,16, y0, null,null, g);
  buildWallRun(2,'x',16,0,12, y0, null,null, g);
  buildWallRun(2,'x',10,0,12, y0, null,null, g);
  buildWallRun(2,'z',12, 10,16, y0, 12,14, g);
  buildSafeAndDoor(g);
  rootGroup.add(g);
}
function buildStairs(){
  function ramp(x1,x2,z1,z2,yA,yB){
    const w=x2-x1, len=z2-z1;
    const steps = 12;
    for(let i=0;i<steps;i++){
      const t0=i/steps, t1=(i+1)/steps;
      const sz1=z1+len*t0, sz2=z1+len*t1;
      const sy = yA + (yB-yA)*((t0+t1)/2);
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, (sz2-sz1)+0.02), matWood);
      step.position.set((x1+x2)/2, sy, (sz1+sz2)/2);
      step.receiveShadow = step.castShadow = true;
      rootGroup.add(step);
    }
  }
  ramp(1,4,10,16, LEVEL_Y[0], LEVEL_Y[1]);
  ramp(6,9,10,16, LEVEL_Y[1], LEVEL_Y[2]);
}

function stairRampY(x,z){
  // padded a little past the visible steps so a small sideways drift while
  // climbing eases back onto the ramp instead of snapping to full floor height
  if(x>=0.5&&x<=4.5&&z>=10&&z<=16) return LEVEL_Y[0] + (LEVEL_Y[1]-LEVEL_Y[0])*((z-10)/6);
  if(x>=5.5&&x<=9.5&&z>=10&&z<=16) return LEVEL_Y[1] + (LEVEL_Y[2]-LEVEL_Y[1])*((z-10)/6);
  return null;
}
function levelOf(y){
  if(y < (LEVEL_Y[0]+LEVEL_Y[1])/2) return 0;
  if(y < (LEVEL_Y[1]+LEVEL_Y[2])/2) return 1;
  return 2;
}
function groundHeight(x,z,y){
  const r = stairRampY(x,z);
  if(r!=null) return r;
  return LEVEL_Y[levelOf(y)];
}

/* ---------- waypoint graph ---------- */
const graph = { nodes:{}, edges:[] };
function node(id,x,z,level){ graph.nodes[id]={id,x,z,y:LEVEL_Y[level],level}; return id; }
function edge(a,b){ graph.edges.push([a,b]); }
function buildGraph(){
  [0,1].forEach(level=>{
    const p = level===0?'A_':'B_';
    node(p+'LR_c',6,5,level); node(p+'LR_sofa',2.4,7.2,level);
    node(p+'LR_doorK',11.5,3.5,level); node(p+'LR_doorLand',4.25,9.6,level);
    node(p+'K_c',16,3,level); node(p+'K_doorB',15,6.6,level);
    node(p+'B_c',15.5,12,level); node(p+'B_doorLand',12.4,13,level);
    node(p+'Land_c',6,13,level);
    edge(p+'LR_c',p+'LR_sofa'); edge(p+'LR_c',p+'LR_doorK'); edge(p+'LR_doorK',p+'K_c');
    edge(p+'K_c',p+'K_doorB'); edge(p+'K_doorB',p+'B_c'); edge(p+'B_c',p+'B_doorLand');
    edge(p+'B_doorLand',p+'Land_c'); edge(p+'Land_c',p+'LR_doorLand'); edge(p+'LR_doorLand',p+'LR_c');
  });
  node('S1_bot',2.5,10.3,0); node('S1_top',2.5,15.7,1);
  node('S2_bot',7.5,10.3,1); node('S2_top',7.5,15.7,2);
  node('Roof_c',9,12,2); node('Safe_n',10,12.2,2); node('Door_n',11.3,13,2);
  edge('A_Land_c','S1_bot'); edge('S1_bot','S1_top'); edge('S1_top','B_Land_c');
  edge('B_Land_c','S2_bot'); edge('S2_bot','S2_top'); edge('S2_top','Roof_c');
  edge('Roof_c','Safe_n'); edge('Roof_c','Door_n');
  graph.adj = {};
  Object.keys(graph.nodes).forEach(id=>graph.adj[id]=[]);
  graph.edges.forEach(([a,b])=>{
    const d = dist2d(graph.nodes[a],graph.nodes[b]);
    graph.adj[a].push({to:b,d}); graph.adj[b].push({to:a,d});
  });
}
function dist2d(a,b){ return Math.hypot(a.x-b.x,a.z-b.z); }
function nearestNode(x,z,level){
  let best=null,bd=Infinity;
  Object.values(graph.nodes).forEach(n=>{
    if(n.level!==level) return;
    const d = Math.hypot(n.x-x,n.z-z);
    if(d<bd){bd=d;best=n.id;}
  });
  return best;
}
function aStar(startId,goalId){
  if(startId===goalId) return [startId];
  const open = new Set([startId]);
  const cameFrom = {};
  const g = {[startId]:0};
  const h = id=>dist2d(graph.nodes[id],graph.nodes[goalId]);
  const f = {[startId]:h(startId)};
  while(open.size){
    let cur=null,cf=Infinity;
    open.forEach(id=>{ if((f[id]??Infinity)<cf){cf=f[id];cur=id;} });
    if(cur===goalId){
      const path=[cur];
      while(cameFrom[cur]){ cur=cameFrom[cur]; path.unshift(cur); }
      return path;
    }
    open.delete(cur);
    (graph.adj[cur]||[]).forEach(({to,d})=>{
      const tentative = g[cur]+d;
      if(tentative < (g[to]??Infinity)){
        cameFrom[to]=cur; g[to]=tentative; f[to]=tentative+h(to); open.add(to);
      }
    });
  }
  return null;
}

/* ---------- characters ---------- */
function makeHumanoid(color, isSnakeRole){
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({color:0xd8b58e, roughness:0.8});
  const cloth = new THREE.MeshStandardMaterial({color, roughness:0.75});
  // each leg is a hip-pivot (thigh) + knee-pivot (shin) so sitting can actually
  // bend the knees instead of just sinking the whole body into the floor
  const legMat = new THREE.MeshStandardMaterial({color:0x2c2a28,roughness:0.9});
  const hipPivots = [], kneePivots = [];
  [-1,1].forEach(s=>{
    const hip = new THREE.Object3D();
    hip.position.set(s*0.11, 0.58, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.3,0.2), legMat);
    thigh.position.y = -0.15; thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Object3D();
    knee.position.y = -0.3;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.28,0.18), legMat);
    shin.position.y = -0.14; shin.castShadow = true;
    knee.add(shin);
    hip.add(knee);
    g.add(hip);
    hipPivots.push(hip); kneePivots.push(knee);
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48,0.62,0.28), cloth);
  torso.position.y = 0.9; torso.castShadow=true; g.add(torso);
  // the shirt itself puffs up over a growing belly when fed — same cloth
  // color as the torso so it reads as clothing stretching, not a bare gut
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3,18,14), cloth);
  belly.position.set(0,0.78,0.06);
  belly.scale.set(0.01,0.01,0.01);
  belly.visible = false;
  belly.castShadow = true;
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,14,12), skin);
  head.position.y = 1.35; head.castShadow=true; g.add(head);
  [-1,1].forEach(s=>{
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.55,8), cloth);
    arm.position.set(s*0.31,0.92,0); arm.castShadow=true; g.add(arm);
  });
  const hand = new THREE.Object3D();
  hand.position.set(0.34,0.72,0.22);
  g.add(hand);
  // a little grocery bag so carried food is actually visible in the player's hand
  const carryIcon = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.2,0.12), new THREE.MeshStandardMaterial({color:0xc9a86a, roughness:0.8}));
  bag.position.set(0,-0.14,0);
  carryIcon.add(bag);
  const poke = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6), new THREE.MeshStandardMaterial({color:0xc23b3b, roughness:0.5}));
  poke.position.set(0,0.02,0);
  carryIcon.add(poke);
  carryIcon.visible = false;
  hand.add(carryIcon);
  const speech = makeSpeechBubble();
  g.add(speech);
  return {group:g, hand, cloth, belly, hipPivots, kneePivots, carryIcon, speech, skin};
}
function makeNameSprite(text,color){
  const c = document.createElement('canvas'); c.width=256; c.height=64;
  const ctx = c.getContext('2d');
  ctx.font='600 34px Manrope, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(10,7,5,0.55)'; ctx.fillRect(0,0,256,64);
  ctx.fillStyle = color;
  ctx.fillText(text,128,34);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  spr.scale.set(1.3,0.32,1);
  spr.position.y = 1.85;
  return spr;
}
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function makeSpeechBubble(){
  const c = document.createElement('canvas'); c.width=320; c.height=110;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  spr.scale.set(1.5,0.52,1);
  spr.position.y = 2.15;
  spr.visible = false;
  spr.userData.setText = (text)=>{
    ctx.clearRect(0,0,320,110);
    roundRectPath(ctx,4,4,312,78,16);
    ctx.fillStyle='rgba(250,244,232,0.96)'; ctx.fill();
    ctx.strokeStyle='rgba(40,30,20,0.45)'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(144,80); ctx.lineTo(176,80); ctx.lineTo(158,104); ctx.closePath();
    ctx.fillStyle='rgba(250,244,232,0.96)'; ctx.fill();
    ctx.fillStyle='#2a1f14';
    ctx.font='600 26px Manrope, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const words = String(text).split(' ');
    const lines = [''];
    let li = 0;
    words.forEach(w=>{
      const test = lines[li] ? lines[li]+' '+w : w;
      if(ctx.measureText(test).width > 288 && lines[li]){ li++; lines[li]=w; } else lines[li]=test;
    });
    const lh = 30, startY = 43 - (lines.length-1)*lh/2;
    lines.forEach((l,i)=>ctx.fillText(l, 160, startY+i*lh));
    tex.needsUpdate = true;
  };
  return spr;
}
const SPEECH_HUNGRY = ['배고프다', '빨리 밥줘', '아 배고파 죽겠다'];
const SPEECH_DANGER = ['으악 뱀이다!', '도망쳐!', '살려줘!'];
const SPEECH_IDLE = ['우리 뭐하고 놀까?', '심심하다', '이 집 왜 이렇게 크냐', '옥상 문 어디였지'];
function botSpeak(ent, danger){
  if(!ent.mesh.speech) return;
  let pool, text;
  if(danger) pool = SPEECH_DANGER;
  else if(ent.food<=0) pool = SPEECH_HUNGRY;
  else pool = SPEECH_IDLE;
  text = pool[(Math.random()*pool.length)|0];
  if(pool===SPEECH_IDLE && Math.random()<0.5){
    const others = entities.filter(e=>e!==ent && e.role==='player');
    if(others.length){ const who = others[(Math.random()*others.length)|0]; text = `${who.name}아, ${text}`; }
  }
  ent.mesh.speech.userData.setText(text);
  ent.mesh.speech.visible = true;
  ent.speechUntil = performance.now() + 3200;
}
function makeSpray(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.22,10), new THREE.MeshStandardMaterial({color:0x2f6e2f,roughness:0.5}));
  g.add(body);
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.08,8), matMetal);
  nozzle.position.y = 0.15; g.add(nozzle);
  g.rotation.z = Math.PI/2.4;
  g.visible = false;
  return g;
}
function makeSnake(){
  const segCount = 11;
  const g = new THREE.Group();
  const segs = [];
  // bright, emissive so it reads clearly even in the house's dim lighting/fog
  const mat = new THREE.MeshStandardMaterial({color:0x8dff4a, roughness:0.4, emissive:0x2f7a1a, emissiveIntensity:0.75});
  const matStun = new THREE.MeshStandardMaterial({color:0xbdffa0, roughness:0.4, emissive:0x5a9a2a, emissiveIntensity:1});
  for(let i=0;i<segCount;i++){
    const r = 0.56 - (i/segCount)*0.3;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r,10,8), mat);
    m.castShadow = true;
    g.add(m); segs.push(m);
  }
  [-1,1].forEach(s=>{
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), new THREE.MeshStandardMaterial({color:0xffe14c, emissive:0xffaa00, emissiveIntensity:1}));
    eye.position.set(0.16,0.1,s*0.15);
    segs[0].add(eye);
  });
  const glow = new THREE.PointLight(0x8fe85a, 0.9, 6, 2);
  glow.position.set(0,0.3,0);
  segs[0].add(glow);
  // a bright marker floating above the head so the snake reads at a glance
  // even through furniture, dim lighting, or fog
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16,0), new THREE.MeshStandardMaterial({color:0xff3b30, emissive:0xff3b30, emissiveIntensity:1.4, roughness:0.3}));
  marker.position.set(0,1.15,0);
  segs[0].add(marker);
  const markerLight = new THREE.PointLight(0xff5b40, 1.1, 5, 2);
  markerLight.position.set(0,1.15,0);
  segs[0].add(markerLight);
  return {group:g, segs, mat, matStun, glow, marker};
}

/* ---------- game state ---------- */
let entities = []; // {kind:'human'|'bot'|'snake', ...}
let humanEntity = null, snakeEntity = null;
let gameStarted = false, gameEnded = false;
let spectateTarget = null;
let lastPromptText = '';

function makeCommonPhysics(x,z,level){
  return {
    pos: new THREE.Vector3(x, LEVEL_Y[level], z),
    velY: 0, yaw: 0, grounded:true, inHole:false, hasIron:false, hasGold:false, hasSpray:false,
    caught:false, escaped:false, sprayCooldown:0, poopCooldown:0, giantPoopCooldown:0, enterHoldTime:0, giantFired:false, gasCooldown:0, food:0, hunger:0, foodMax:FOOD_MAX, money:0, sitting:false, vacuuming:false, totalEaten:0, carriedFood:0, carriedPos:null, carryKeyWasDown:false, driving:false, knockedTimer:0, atPark:false, sick:false, hospitalTimer:0, lastEatAt:0,
  };
}

function initGame(){
  const total = TOTAL_PLAYERS + 1;
  const shuffled = Array.from({length: total}, (_,i)=>i);
  for(let i=shuffled.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  const snakeSlot = shuffled[0];

  entities = [];
  let botIdx = 0;
  for(let i=0;i<total;i++){
    const isSnakeSlot = i===snakeSlot;
    const isHuman = i===0;
    const sp = SPAWN_SPOTS[i % SPAWN_SPOTS.length];
    const botName = isHuman ? null : NAMES[botIdx % NAMES.length];
    if(!isHuman) botIdx++;
    if(isSnakeSlot){
      const sn = makeSnake();
      // segments are positioned in absolute world space every frame (see
      // updateSnakeMesh), so the group itself must stay at the origin —
      // offsetting it here would double-count the spawn position.
      scene.add(sn.group);
      const nameTag = makeNameSprite(isHuman?'나 (뱀)':botName+' (뱀)', '#e08a7d');
      nameTag.position.set(0,1.55,0);
      sn.segs[0].add(nameTag);
      const ent = Object.assign(makeCommonPhysics(sp.x,sp.z,0), {
        kind: isHuman?'human':'bot', role:'snake', mesh: sn, name:isHuman?'나':botName,
        stunTimer:0, slowTimer:0, aiTimer:0, path:null, pathIdx:0, wanderTarget:null,
      });
      entities.push(ent);
      if(isHuman) humanEntity = ent;
    } else {
      const color = COLORS[(isHuman?0:botIdx-1) % COLORS.length];
      const hum = makeHumanoid(color,false);
      hum.group.position.set(sp.x, LEVEL_Y[0], sp.z);
      const spray = makeSpray();
      hum.hand.add(spray);
      const nameTag = makeNameSprite(isHuman?'나':botName, '#f1e6d3');
      hum.group.add(nameTag);
      scene.add(hum.group);
      const ent = Object.assign(makeCommonPhysics(sp.x,sp.z,0), {
        kind: isHuman?'human':'bot', role:'player', mesh: hum, name:isHuman?'나':botName,
        sprayMesh: spray, aiTimer:Math.random()*AI_TICK, path:null, pathIdx:0, wanderTarget:null, fleeing:false,
      });
      entities.push(ent);
      if(isHuman) humanEntity = ent;
    }
  }
  snakeEntity = entities.find(e=>e.role==='snake');

  // HUD role panel
  rolePanel.classList.remove('is-snake','is-player');
  if(humanEntity.role==='snake'){
    rolePanel.classList.add('is-snake');
    roleName.textContent = '뱀';
    roleObjective.textContent = '모든 생존자를 사냥하라. 계단은 오를 수 있지만 점프는 못 한다. 뱀 스프레이를 맞으면 즉사한다.';
    showBanner('당신은 뱀입니다', 'danger', 2600);
  } else {
    rolePanel.classList.add('is-player');
    roleName.textContent = '생존자';
    roleObjective.textContent = '쇠 열쇠로 금고를 열어 스프레이를 챙기고, 황금 열쇠로 옥상 문을 열어 탈출하라. 스프레이로 뱀을 명중시켜 처치해도 승리한다.';
    showBanner('당신은 생존자입니다', 'good', 2600);
  }
  totalCountEl.textContent = String(entities.filter(e=>e.role==='player').length);
  updateAliveCount();
  spawnKeys();
  spawnFood();

}

function updateAliveCount(){
  const alive = entities.filter(e=>e.role==='player' && !e.caught && !e.escaped).length;
  aliveCountEl.textContent = String(alive);
}

/* ---------- input ----------
   Rely on e.key (not e.code) for the canonical name: some embedding/automation
   contexts dispatch synthetic key events with an empty e.code but a correct e.key. */
function keyName(e){
  const k = e.key;
  if(k==='ArrowUp'||k==='Up') return 'Up';
  if(k==='ArrowDown'||k==='Down') return 'Down';
  if(k==='ArrowLeft'||k==='Left') return 'Left';
  if(k==='ArrowRight'||k==='Right') return 'Right';
  if(k===' '||k==='Spacebar'||k==='Space'||e.code==='Space') return 'Space';
  if(k==='Shift') return 'Shift';
  if(k==='Control') return 'Control';
  if(k==='Enter') return 'Enter';
  if(k==='1') return 'Fart';
  if(k==='2') return 'BuildShop';
  if(k==='3') return 'Upgrade';
  if(k==='Backspace') return 'Carry';
  if(k==='4') return 'Car';
  if(k==='t'||k==='T') return 'Fridge';
  return null;
}
window.addEventListener('keydown', (e)=>{
  if(quizState) return; // pause player input while a quiz modal is open
  const name = keyName(e);
  if(!name) return;
  keyState[name] = true;
  e.preventDefault();
  if(!gameStarted || gameEnded) return;
  if(name==='Space') tryJump();
  if(name==='Shift') tryShiftAction();
  if(name==='Control'){ tryGrabSpray(); tryToggleSit(); }
  if(name==='Enter') tryPoop();
  if(name==='Fart') tryFart();
  if(name==='BuildShop') tryBuildShop();
  if(name==='Upgrade') tryUpgrade();
  if(name==='Car') tryEnterCar();
  if(name==='Carry') tryToggleCarry();
  if(name==='Fridge') tryFridge();
});
window.addEventListener('keyup',(e)=>{ const name = keyName(e); if(name) keyState[name]=false; });

function tryJump(){
  const p = humanEntity;
  if(p.role==='snake') return;
  if(p.grounded && !p.inHole) p.velY = JUMP_SPEED;
}
function nearestDrawer(p){
  let best=null,bd=Infinity;
  interactables.drawers.forEach(d=>{
    if(levelOf(p.pos.y)!==d.level) return;
    const dist = Math.hypot(p.pos.x-d.x,p.pos.z-d.z);
    if(dist<DRAWER_RADIUS && dist<bd){bd=dist;best=d;}
  });
  return best;
}
function tryShiftAction(){
  const p = humanEntity;
  if(p.role==='snake') return;
  const drawer = nearestDrawer(p);
  if(drawer){ openDrawer(drawer); return; }
  if(insideBuilding(p, interactables.mart)){ tryBuyFood(p); return; }
  if(insideBuilding(p, interactables.dealership)){ tryBuyCar(p); return; }
  const vac = interactables.vacuum;
  if(p.vacuuming){
    p.vacuuming = false;
    vac.x = p.pos.x; vac.z = p.pos.z; vac.level = levelOf(p.pos.y);
    vac.mesh.position.set(vac.x, LEVEL_Y[vac.level], vac.z);
    showBanner('청소기를 내려놓았다', 'good', 1400);
    return;
  }
  if(vac && levelOf(p.pos.y)===vac.level && Math.hypot(p.pos.x-vac.x,p.pos.z-vac.z)<VACUUM_RADIUS){
    p.vacuuming = true;
    showBanner('청소기를 들었다! 돌아다니며 똥을 치우자', 'good', 1800);
    return;
  }
  if(p.hasSpray && p.sprayCooldown<=0){ doSpray(p); }
}
function tryBuyFood(p){
  if(p.money < MART_FOOD_PRICE){ showBanner(`돈이 부족하다 (필요: ${MART_FOOD_PRICE.toLocaleString()}원)`, 'danger', 1600); return; }
  p.money -= MART_FOOD_PRICE;
  p.carriedFood = (p.carriedFood||0) + 1;
  p.carriedPos = null;
  showBanner('마트에서 음식을 샀다 — Backspace로 들고 식탁까지 가져가자', 'good', 2000);
  updateMoneyHUD(p);
  updateCarryHUD(p);
}
function tryBuyCar(p){
  const car = interactables.car;
  if(car.bought){ showBanner('이미 차가 있다', 'good', 1400); return; }
  if(p.money < CAR_PRICE){ showBanner(`돈이 부족하다 (필요: ${CAR_PRICE.toLocaleString()}원)`, 'danger', 1600); return; }
  p.money -= CAR_PRICE;
  car.bought = true;
  showBanner('자동차를 샀다! 차 앞에서 4번 키로 탈 수 있다', 'gold', 2400);
  updateMoneyHUD(p);
}
function tryToggleCarry(){
  const p = humanEntity;
  if(p.carriedFood<=0) return;
  if(p.carriedPos){
    const dd = Math.hypot(p.pos.x-p.carriedPos.x, p.pos.z-p.carriedPos.z);
    if(dd < 1.2){ p.carriedPos = null; showBanner('내려놓은 음식을 다시 들었다', 'good', 1400); }
    else showBanner('음식을 내려놓은 자리로 가야 다시 들 수 있다', 'danger', 1600);
  } else {
    p.carriedPos = {x:p.pos.x, z:p.pos.z};
    showBanner('음식을 내려놓았다 — 다시 그 자리에서 Backspace를 누르면 든다', 'danger', 1800);
  }
  updateCarryHUD(p);
  updateDropMarker(p);
}
function tryFridge(){
  const p = humanEntity;
  const f = interactables.fridge;
  if(!f || levelOf(p.pos.y)!==f.level || Math.hypot(p.pos.x-f.x,p.pos.z-f.z)>=1.5){
    showBanner('냉장고 앞에서 눌러야 한다', 'danger', 1600);
    return;
  }
  if(p.carriedFood>0){
    interactables.fridgeStock += p.carriedFood;
    showBanner(`냉장고에 음식 ${p.carriedFood}개를 넣었다`, 'good', 1800);
    p.carriedFood = 0;
    p.carriedPos = null;
    updateCarryHUD(p);
    updateDropMarker(p);
  } else if(interactables.fridgeStock > 0){
    const n = interactables.fridgeStock;
    interactables.fridgeStock = 0;
    registerEat(p, n);
    pileFoodOnTable(n);
    showBanner(`냉장고 속 음식 ${n}개를 접시로 옮겼다!`, 'gold', 2200);
  } else {
    showBanner('냉장고가 비어있다 — 마트에서 음식을 사 오자', 'danger', 1800);
  }
}
function tryEnterCar(){
  const p = humanEntity;
  if(p.role==='snake') return;
  const car = interactables.car;
  if(!car.bought){ showBanner('아직 차가 없다 — 자동차 매장에서 구매하자', 'danger', 1800); return; }
  if(p.driving){
    p.driving = false;
    p.pos.x = car.x; p.pos.z = car.z;
    showBanner('차에서 내렸다', 'good', 1400);
    return;
  }
  if(levelOf(p.pos.y)!==car.level || Math.hypot(p.pos.x-car.x,p.pos.z-car.z)>=2.2){
    showBanner('차 근처에서 4번을 눌러야 한다', 'danger', 1600);
    return;
  }
  p.driving = true;
  showBanner('차에 탔다 — 화살표 키로 운전하자', 'good', 1800);
}
function openDrawer(d){
  if(d.mesh.userData.open) return;
  d.mesh.userData.open = true;
  const start = performance.now();
  function anim(){
    const t = Math.min(1,(performance.now()-start)/300);
    d.mesh.position.z = d.mesh.userData.closedZ + (d.mesh.userData.openZ-d.mesh.userData.closedZ)*t;
    if(t<1) requestAnimationFrame(anim);
  }
  anim();
  if(d.hiddenKey){
    d.hiddenKey.hidden = false;
    d.hiddenKey.mesh.visible = true;
    showBanner('서랍에서 열쇠를 발견했다!', d.hiddenKey.type==='gold'?'gold':'good', 1800);
  }
}
function doSpray(p){
  p.sprayCooldown = SPRAY_COOLDOWN;
  sprayFlash.classList.add('show');
  setTimeout(()=>sprayFlash.classList.remove('show'),260);
  if(snakeEntity && !snakeEntity.caught){
    const dx = snakeEntity.pos.x-p.pos.x, dz = snakeEntity.pos.z-p.pos.z;
    const dist = Math.hypot(dx,dz);
    if(dist < SPRAY_RADIUS){
      const fwd = {x:Math.sin(p.yaw), z:Math.cos(p.yaw)};
      const nx=dx/(dist||1), nz=dz/(dist||1);
      const dot = fwd.x*nx+fwd.z*nz;
      if(dot > SPRAY_COS || dist < 1.8){
        killSnake();
      }
    }
  }
}
function tryGrabSpray(){
  const p = humanEntity;
  if(p.role==='snake') return;
  const s = interactables.safe;
  if(!s || !s.unlocked || p.hasSpray) return;
  const dist = Math.hypot(p.pos.x-s.x, p.pos.z-s.z);
  if(dist < SAFE_RADIUS && levelOf(p.pos.y)===s.level){
    grantSpray(p);
  }
}
function tryPoop(){
  const p = humanEntity;
  if(p.role==='snake') return;
  if(p.poopCooldown>0) return;
  if(p.food<=0){ showBanner('먹은 게 없어서 안 나온다 — 주방에서 밥을 먹자', 'danger', 1800); return; }
  p.food--;
  dropPoop(p);
  showBanner('똥을 쌌다', 'good', 1200);
}
function tryFart(){
  const p = humanEntity;
  if(p.role==='snake') return;
  if(p.food<=0){ showBanner('먹은 게 없어서 안 나온다 — 주방에서 밥을 먹자', 'danger', 1800); return; }
  p.food--;
  fartInRoom(p);
}
function finishBuildShop(){
  interactables.shopBuilt = true;
  buildShopVisual();
  spawnCustomers();
  showBanner('가게를 지었다! 손님들이 몰려온다', 'gold', 2600);
  updateMoneyHUD(humanEntity);
}
function tryBuildShop(){
  const p = humanEntity;
  if(p.role==='snake' || quizState) return;
  if(!insideBuilding(p, interactables.construction)){ showBanner('건설회사 안에서만 지을 수 있다', 'danger', 1600); return; }
  if(interactables.shopBuilt){ showBanner('이미 가게를 지었다', 'good', 1400); return; }
  if(p.money >= SHOP_COST){
    p.money -= SHOP_COST;
    finishBuildShop();
  } else {
    showBanner(`돈이 부족하다 — 국어 문제를 풀면 무료로 지어준다`, 'gold', 2000);
    startQuiz(QUIZ_KOREAN_QUESTIONS, 1, finishBuildShop);
  }
}
function tryUpgrade(){
  const p = humanEntity;
  if(p.role==='snake' || quizState) return;
  if(!insideBuilding(p, interactables.construction)){ showBanner('건설회사 안에서만 업그레이드할 수 있다', 'danger', 1600); return; }
  if(interactables.upgraded){ showBanner('이미 업그레이드했다', 'good', 1400); return; }
  if(p.money < UPGRADE_COST){ showBanner(`돈이 부족하다 (필요: ${UPGRADE_COST.toLocaleString()}원)`, 'danger', 1800); return; }
  p.money -= UPGRADE_COST;
  interactables.upgraded = true;
  buildKitchenGlass();
  showBanner('주방을 업그레이드했다! 유리 천장과 투명 문이 생겼다', 'gold', 2400);
  updateMoneyHUD(p);
}
function buildShopVisual(){
  const y0 = LEVEL_Y[0];
  const stall = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.8,1.6), new THREE.MeshStandardMaterial({color:0xd8ad5f, roughness:0.6}));
  stall.position.set(12, y0+0.9, -5.5);
  stall.castShadow = stall.receiveShadow = true;
  rootGroup.add(stall);
  const sign = makeNameSprite('내 가게', '#e8c07a');
  sign.position.set(12, y0+2.5, -5.5);
  sign.scale.set(2,0.5,1);
  rootGroup.add(sign);
}
function buildKitchenGlass(){
  // low opacity + physical material so the wall reads as see-through glass, not a solid panel
  const glassMat = new THREE.MeshPhysicalMaterial({color:0xbfe3f0, transparent:true, opacity:0.14, roughness:0.03, transmission:0.4, side:THREE.DoubleSide});
  interactables.kitchenDoors = [];
  [0,1].forEach(level=>{
    const y0 = LEVEL_Y[level];
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(8,0.08,7), glassMat);
    ceil.position.set(16, y0+WALL_H-0.05, 3.5);
    rootGroup.add(ceil);
    const doorPane = new THREE.Mesh(new THREE.BoxGeometry(1.9,WALL_H-0.35,0.06), glassMat);
    const closedY = y0+WALL_H/2-0.1;
    doorPane.position.set(15, closedY, 7);
    rootGroup.add(doorPane);
    interactables.kitchenDoors.push({mesh:doorPane, x:15, z:7, level, closedY, openY: closedY+(WALL_H-0.4)});
  });
}
function updateKitchenDoors(dt){
  const doors = interactables.kitchenDoors;
  if(!doors) return;
  doors.forEach(d=>{
    const near = entities.some(e=>!e.caught && !e.escaped && !e.dead && levelOf(e.pos.y)===d.level && Math.hypot(e.pos.x-d.x,e.pos.z-d.z)<2.2);
    const target = near ? d.openY : d.closedY;
    d.mesh.position.y += (target-d.mesh.position.y)*Math.min(1,dt*6);
  });
}
function tryToggleSit(){
  const p = humanEntity;
  if(p.role==='snake') return;
  const t = interactables.toilet.find(t=>t.level===levelOf(p.pos.y));
  if(!t || Math.hypot(p.pos.x-t.x,p.pos.z-t.z)>=TOILET_RADIUS){
    if(p.sitting){ p.sitting = false; }
    return;
  }
  p.sitting = !p.sitting;
  if(p.sitting){
    // snap onto the seat and face forward (away from the tank) so it reads
    // as actually sitting on the toilet, not just crouching wherever you stood
    p.pos.x = t.x; p.pos.z = t.z;
    p.yaw = 0; mouseYaw = 0;
  }
  showBanner(p.sitting?'변기에 앉았다':'변기에서 일어났다', 'good', 1400);
}
function grantSpray(p){
  p.hasSpray = true;
  if(p.sprayMesh) p.sprayMesh.visible = true;
  updateInventoryIfHuman(p);
  showBanner(p.kind==='human'?'뱀 스프레이 획득!':'스프레이를 챙겼다', 'good', 1600);
}

/* ---------- drag-to-look camera (no Pointer Lock — works inside sandboxed frames) ---------- */
const canvasRootEl = $('canvas-root');
let dragging = false, lastMX = 0, lastMY = 0;
canvasRootEl.addEventListener('mousedown', (e)=>{
  if(!gameStarted || gameEnded) return;
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
  e.preventDefault();
});
window.addEventListener('mousemove',(e)=>{
  if(!dragging) return;
  const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
  lastMX = e.clientX; lastMY = e.clientY;
  mouseYaw -= dx * 0.0038;
  mousePitch = Math.max(-0.45, Math.min(0.95, mousePitch - dy * 0.0032));
});
window.addEventListener('mouseup', ()=>{ dragging = false; });
canvasRootEl.addEventListener('mouseleave', ()=>{ dragging = false; });
canvasRootEl.style.cursor = 'grab';
canvasRootEl.addEventListener('mousedown', ()=>{ canvasRootEl.style.cursor='grabbing'; });
window.addEventListener('mouseup', ()=>{ canvasRootEl.style.cursor='grab'; });

const raycaster = new THREE.Raycaster();
function updateCamera(){
  const p = humanEntity;
  const targetY = p.pos.y + (p.role==='snake'?0.5:1.4);
  const target = new THREE.Vector3(p.pos.x, targetY, p.pos.z);
  const dist = p.role==='snake'?5.2:5.6;
  let camX = target.x - dist*Math.cos(mousePitch)*Math.sin(mouseYaw);
  let camZ = target.z - dist*Math.cos(mousePitch)*Math.cos(mouseYaw);
  let camY = target.y + 1.1 + dist*Math.sin(mousePitch);
  const dir = new THREE.Vector3(camX-target.x,camY-target.y,camZ-target.z);
  const full = dir.length();
  dir.normalize();
  raycaster.set(target, dir);
  raycaster.far = full;
  const level = levelOf(p.pos.y);
  // simple clamp using furniture+wall boxes (cheap sphere test along ray sampled)
  let clamped = full;
  const steps = 10;
  for(let i=1;i<=steps;i++){
    const t = full*i/steps;
    const tx = target.x+dir.x*t, tz = target.z+dir.z*t;
    if(pointInBoxes(tx,tz,WALL_BOXES[level],0.25) || pointInBoxes(tx,tz,FURN_BOXES[level],0.2)){ clamped = Math.max(1.4,t-0.3); break; }
  }
  camera.position.set(target.x+dir.x*clamped, target.y+dir.y*clamped, target.z+dir.z*clamped);
  camera.lookAt(target);
}
function pointInBoxes(x,z,boxes,pad){
  for(const b of boxes){ if(x>b.minX-pad&&x<b.maxX+pad&&z>b.minZ-pad&&z<b.maxZ+pad) return true; }
  return false;
}

/* ---------- physics helpers ---------- */
function resolveCollision(pos, radius, level, extraBlockHoles){
  const boxes = WALL_BOXES[level].concat(FURN_BOXES[level]);
  boxes.forEach(b=>{
    const cx = Math.max(b.minX,Math.min(pos.x,b.maxX));
    const cz = Math.max(b.minZ,Math.min(pos.z,b.maxZ));
    const dx = pos.x-cx, dz = pos.z-cz;
    const d = Math.hypot(dx,dz);
    if(d < radius && d>0.0001){
      const push = (radius-d);
      pos.x += dx/d*push; pos.z += dz/d*push;
    } else if(d<=0.0001){
      pos.x += radius; // degenerate: inside box, push out arbitrarily
    }
  });
  if(extraBlockHoles){
    holes.forEach(h=>{
      if(h.level!==level) return;
      const dx=pos.x-h.x, dz=pos.z-h.z, d=Math.hypot(dx,dz);
      if(d < h.r+radius && d>0.0001){
        const push=(h.r+radius-d);
        pos.x += dx/d*push; pos.z += dz/d*push;
      }
    });
    poops.forEach(p=>{
      if(p.level!==level) return;
      const dx=pos.x-p.x, dz=pos.z-p.z, d=Math.hypot(dx,dz);
      if(d < p.r+radius && d>0.0001){
        const push=(p.r+radius-d);
        pos.x += dx/d*push; pos.z += dz/d*push;
      }
    });
    if(level===0 || level===1){
      // the snake is banned from the bathroom entirely
      const b = ROOM_DEFS.find(r=>r.key==='bathroom');
      const cx = Math.max(b.x1,Math.min(pos.x,b.x2));
      const cz = Math.max(b.z1,Math.min(pos.z,b.z2));
      const dx = pos.x-cx, dz = pos.z-cz, d = Math.hypot(dx,dz);
      if(d < radius && d>0.0001){
        const push = (radius-d);
        pos.x += dx/d*push; pos.z += dz/d*push;
      } else if(d<=0.0001){
        pos.x = b.x1 - radius - 0.05;
      }
    }
  }
  pos.x = Math.max(0.3,Math.min(19.7,pos.x));
  const zMin = level===0 ? -33.7 : 0.3; // ground floor extends south into the yard, car lot and amusement park
  pos.z = Math.max(zMin,Math.min(15.7,pos.z));
}

function applyGravityAndGround(ent, dt){
  ent.velY -= GRAVITY*dt;
  ent.pos.y += ent.velY*dt;
  const gy = groundHeight(ent.pos.x, ent.pos.z, ent.pos.y);
  if(ent.pos.y <= gy){ ent.pos.y = gy; ent.velY = 0; ent.grounded = true; }
  else ent.grounded = false;
}

function checkHole(ent){
  if(ent.role==='snake'){ ent.inHole=false; return; }
  const lvl = levelOf(ent.pos.y);
  ent.inHole = holes.some(h=>h.level===lvl && Math.hypot(ent.pos.x-h.x,ent.pos.z-h.z) < h.r);
}

/* ---------- human update ---------- */
function isInAmusementPark(x,z){
  return x>=AMUSEMENT_PARK_DEF.x1 && x<=AMUSEMENT_PARK_DEF.x2 && z>=AMUSEMENT_PARK_DEF.z1 && z<=AMUSEMENT_PARK_DEF.z2;
}
function updateCarDriving(p, dt){
  const car = interactables.car;
  let throttle = 0, turn = 0;
  if(keyState['Up']) throttle += 1;
  if(keyState['Down']) throttle -= 1;
  if(keyState['Left']) turn += 1;
  if(keyState['Right']) turn -= 1;
  car.speed += throttle*dt*10;
  car.speed = Math.max(-CAR_SPEED*0.5, Math.min(CAR_SPEED, car.speed));
  if(Math.abs(throttle)<0.01) car.speed *= Math.max(0,1-dt*1.5);
  if(Math.abs(car.speed)>0.05) car.yaw += turn*CAR_TURN*dt*Math.sign(car.speed);
  car.x += Math.sin(car.yaw)*car.speed*dt;
  car.z += Math.cos(car.yaw)*car.speed*dt;
  car.x = Math.max(0.5,Math.min(19.5,car.x));
  car.z = Math.max(-33.5,Math.min(15.5,car.z));
  car.mesh.position.set(car.x, LEVEL_Y[0], car.z);
  car.mesh.rotation.y = car.yaw;
  p.pos.x = car.x; p.pos.z = car.z; p.pos.y = LEVEL_Y[0]; p.yaw = car.yaw;
  mouseYaw = car.yaw;

  if(Math.abs(car.speed) > 1.5){
    entities.forEach(o=>{
      if(o===p || o.role==='snake' || o.caught || o.escaped || o.knockedTimer>0) return;
      const d = Math.hypot(o.pos.x-car.x, o.pos.z-car.z);
      if(d < 1.1){
        o.knockedTimer = KNOCK_TIME;
        showBanner(`${o.kind==='human'?'내가':o.name+'이(가)'} 차에 치여 쓰러졌다!`, 'danger', 1800);
      }
    });
  }

  const inPark = isInAmusementPark(car.x, car.z);
  if(inPark && !car.wasInPark){
    const near = entities.filter(o=>o!==p && o.role==='player' && !o.caught && !o.escaped && Math.hypot(o.pos.x-car.x,o.pos.z-car.z)<6);
    near.forEach(o=>{ o.atPark=true; o.pos.x = car.x+(Math.random()-0.5)*4; o.pos.z = car.z+(Math.random()-0.5)*4; });
    showBanner(near.length>0 ? `놀이공원에 도착했다! ${near.length}명과 함께 왔다` : '놀이공원에 도착했다', 'gold', 2400);
  }
  car.wasInPark = inPark;
}
function updateHuman(dt){
  const p = humanEntity;
  if(p.caught||p.escaped){ syncMeshFromEnt(p); return; }
  if(p.driving){ if(p.mesh && p.mesh.group) p.mesh.group.visible = false; updateCarDriving(p, dt); return; }
  if(p.knockedTimer>0){ p.knockedTimer -= dt; syncMeshFromEnt(p); return; }
  let ix=0, iz=0;
  if(keyState['Up']) iz+=1;
  if(keyState['Down']) iz-=1;
  if(keyState['Right']) ix+=1;
  if(keyState['Left']) ix-=1;
  p.yaw = mouseYaw;
  const speed = p.role==='snake' ? (snakeCurrentSpeed(p)) : PLAYER_SPEED;
  if(p.sitting && (ix!==0||iz!==0)) p.sitting = false; // walking off the toilet stands you up
  if((ix!==0||iz!==0) && !p.sitting){
    const len = Math.hypot(ix,iz); ix/=len; iz/=len;
    const fx = Math.sin(mouseYaw), fz = Math.cos(mouseYaw);
    const rx = Math.sin(mouseYaw+Math.PI/2), rz = Math.cos(mouseYaw+Math.PI/2);
    const mx = fx*iz + rx*ix, mz = fz*iz + rz*ix;
    const mlen = Math.hypot(mx,mz)||1;
    p.pos.x += (mx/mlen)*speed*dt;
    p.pos.z += (mz/mlen)*speed*dt;
  }
  const level = levelOf(p.pos.y);
  resolveCollision(p.pos, p.role==='snake'?SNAKE_RADIUS:PLAYER_RADIUS, level, p.role==='snake');
  applyGravityAndGround(p, dt);
  checkHole(p);
  if(p.sprayCooldown>0) p.sprayCooldown -= dt;
  if(p.poopCooldown>0) p.poopCooldown -= dt;
  if(p.giantPoopCooldown>0) p.giantPoopCooldown -= dt;
  if(p.role!=='snake' && p.food<=0 && !isInAmusementPark(p.pos.x,p.pos.z)) p.hunger = Math.min(100, p.hunger + HUNGER_RATE*dt);
  if(p.role!=='snake' && p.hunger>=100) dieOfHunger(p);
  if(p.sick){ p.hospitalTimer -= dt; if(p.hospitalTimer<=0) recoverFromSick(p); }
  if(p.kind==='human'){
    hungerFillEl.style.width = p.hunger.toFixed(0)+'%';
    hungerValueEl.textContent = p.hunger.toFixed(0)+'%';
  }
  if(p.vacuuming){
    const vac = interactables.vacuum;
    vac.mesh.position.set(p.pos.x+0.4*Math.sin(p.yaw), LEVEL_Y[levelOf(p.pos.y)], p.pos.z+0.4*Math.cos(p.yaw));
    for(let i=poops.length-1;i>=0;i--){
      if(Math.hypot(p.pos.x-poops[i].x,p.pos.z-poops[i].z)<1.3){
        scene.remove(poops[i].mesh);
        poops.splice(i,1);
      }
    }
  }
  if(p.kind==='human' && p.carriedFood>0){
    // carrying is the default state right after buying — no key needed. Bring
    // it to the fridge and press T (ㅅ) to store it, then T again to move it
    // from the fridge onto the plate. Backspace still lets you set it down
    // deliberately anywhere (see tryToggleCarry).
    updateCarryHUD(p);
    updateDropMarker(p);
  } else {
    updateDropMarker(p);
  }
  if(p.role!=='snake'){
    if(keyState['Enter']){
      p.enterHoldTime += dt;
      if(p.enterHoldTime >= GIANT_POOP_HOLD && !p.giantFired){
        p.giantFired = true;
        if(p.food<=0) showBanner('먹은 게 없어서 안 나온다 — 주방에서 밥을 먹자', 'danger', 1800);
        else { p.food--; dropPoop(p, true); }
      }
    } else {
      p.enterHoldTime = 0;
      p.giantFired = false;
    }
  }
  if(p.role==='snake'){
    if(p.stunTimer>0) p.stunTimer -= dt;
    if(p.slowTimer>0) p.slowTimer -= dt;
    checkGasExposure(p, dt);
  } else {
    handlePlayerPickups(p);
  }
  syncMeshFromEnt(p);
  updatePromptForHuman(p);
}
function snakeCurrentSpeed(ent){
  if(ent.stunTimer>0) return 0;
  if(ent.slowTimer>0) return SNAKE_SLOW_SPEED;
  return SNAKE_SPEED;
}

function updateFood(p){
  const now = performance.now();
  interactables.food.forEach(f=>{
    if(!f.available && !f.oneTime && now >= f.respawnAt){ f.available = true; f.mesh.visible = true; }
    if(!f.available) return;
    if(levelOf(p.pos.y)!==f.level) return;
    if(Math.hypot(p.pos.x-f.x,p.pos.z-f.z) < FOOD_RADIUS){
      f.available = false; f.mesh.visible = false;
      if(!f.oneTime) f.respawnAt = now + FOOD_RESPAWN*1000;
      registerEat(p, 1);
      if(p.kind==='human') showBanner('밥을 먹었다', 'good', 1200);
    }
  });
}
function updateMoneyHUD(p){
  if(p.kind!=='human') return;
  moneyValueEl.textContent = p.money.toLocaleString()+'원';
}
function insideBuilding(p, b){
  return !!b && levelOf(p.pos.y)===b.level && p.pos.x>=b.x1 && p.pos.x<=b.x2 && p.pos.z>=b.z1 && p.pos.z<=b.z2;
}
function updateEconomy(p){
  if(p.kind!=='human') return;
  const bank = interactables.bank;
  if(bank && !interactables.loanTaken && !quizState && insideBuilding(p,bank)){
    const now = performance.now();
    if(!bank.retryAt || now>bank.retryAt){
      startQuiz(QUIZ_BANK_QUESTIONS, 3, ()=>{
        interactables.loanTaken = true;
        p.money += LOAN_AMOUNT + LOAN_GAIN;
        showBanner(`퀴즈 성공! 은행에서 ${LOAN_AMOUNT.toLocaleString()}원 대출 + 이자 ${LOAN_GAIN.toLocaleString()}원을 받았다!`, 'gold', 3200);
        updateMoneyHUD(p);
      }, ()=>{ bank.retryAt = performance.now() + 4000; });
    }
  }
  const cons = interactables.construction;
  if(cons && !interactables.shopBuilt && !quizState && insideBuilding(p,cons)){
    const now = performance.now();
    if(!cons.retryAt || now>cons.retryAt){
      startQuiz(QUIZ_KOREAN_QUESTIONS, 1, finishBuildShop, ()=>{ cons.retryAt = performance.now() + 4000; });
    }
  }
}
function handlePlayerPickups(p){
  updateFood(p);
  updateEconomy(p);
  if(p.kind!=='human'){
    // bots have no "shift to open" button — they open a drawer just by reaching it
    interactables.drawers.forEach(d=>{
      if(d.mesh.userData.open) return;
      if(levelOf(p.pos.y)!==d.level) return;
      if(Math.hypot(p.pos.x-d.x,p.pos.z-d.z) < DRAWER_RADIUS) openDrawer(d);
    });
  }
  interactables.keys.forEach(k=>{
    if(k.taken || k.hidden) return;
    if(levelOf(p.pos.y)!==k.level) return;
    if(Math.hypot(p.pos.x-k.x,p.pos.z-k.z) < KEY_RADIUS){
      k.taken = true; k.mesh.visible = false;
      if(k.type==='iron') p.hasIron = true; else p.hasGold = true;
      updateInventoryIfHuman(p);
      showBanner(p.kind==='human' ? (k.type==='iron'?'쇠 열쇠 획득':'황금 열쇠 획득!') : `${p.name}이(가) 열쇠를 주웠다`, k.type==='gold'?'gold':'good', 1600);
    }
  });
  const s = interactables.safe;
  if(s && !s.unlocked && p.hasIron && levelOf(p.pos.y)===s.level){
    if(Math.hypot(p.pos.x-s.x,p.pos.z-s.z) < SAFE_RADIUS){
      s.unlocked = true; s.glow.intensity = 1.4;
      showBanner('금고가 열렸다', 'gold', 1800);
    }
  }
  if(p.kind!=='human' && s && s.unlocked && !p.hasSpray && levelOf(p.pos.y)===s.level){
    if(Math.hypot(p.pos.x-s.x,p.pos.z-s.z) < SAFE_RADIUS) grantSpray(p);
  }
  const d = interactables.door;
  if(d && !d.opened && p.hasGold && levelOf(p.pos.y)===d.level){
    if(Math.hypot(p.pos.x-d.x,p.pos.z-d.z) < DOOR_RADIUS){
      openRoofDoor();
      p.escaped = true;
      onPlayersWin(p);
    }
  }
}
function openRoofDoor(){
  const d = interactables.door;
  d.opened = true;
  const start = performance.now();
  function anim(){
    const t = Math.min(1,(performance.now()-start)/700);
    d.group.rotation.y = -1.7*t;
    if(t<1) requestAnimationFrame(anim);
  }
  anim();
}
function killSnake(){
  if(!snakeEntity || snakeEntity.dead || gameEnded) return;
  snakeEntity.dead = true;
  snakeEntity.mesh.group.visible = false;
  if(!interactables.door.opened) openRoofDoor();
  showBanner('뱀을 처치했다! 옥상 문이 열렸다', 'good', 3000);
  onPlayersWin(null, 'killed');
}

function updateInventoryIfHuman(p){
  if(p.kind!=='human') return;
  slotIron.classList.toggle('owned', !!p.hasIron);
  slotGold.classList.toggle('owned', !!p.hasGold);
  slotSpray.classList.toggle('owned', !!p.hasSpray);
}

function updatePromptForHuman(p){
  let text = '';
  if(p.role!=='snake'){
    const drawer = nearestDrawer(p);
    if(drawer && !drawer.mesh.userData.open) text = 'Shift · 서랍 열기';
    else if(p.hasSpray && p.sprayCooldown<=0) text = 'Shift · 스프레이 분사';
    const s = interactables.safe;
    if(s && s.unlocked && !p.hasSpray && levelOf(p.pos.y)===s.level && Math.hypot(p.pos.x-s.x,p.pos.z-s.z)<SAFE_RADIUS){
      text = 'Ctrl · 스프레이 손에 쥐기';
    }
    if(p.enterHoldTime>0 && !p.giantFired && p.giantPoopCooldown<=0){
      const remain = Math.max(0, GIANT_POOP_HOLD - p.enterHoldTime);
      text = 'Enter · 대왕 똥까지 ' + remain.toFixed(1) + '초';
    }
    if(!text && p.carriedFood>0 && !p.carriedPos){
      text = '이동 · 주방 냉장고 앞에서 T';
    }
    const fr = interactables.fridge;
    if(!text && fr && levelOf(p.pos.y)===fr.level && Math.hypot(p.pos.x-fr.x,p.pos.z-fr.z)<1.5){
      if(p.carriedFood>0) text = 'T · 냉장고에 넣기';
      else if(interactables.fridgeStock>0) text = 'T · 냉장고 속 음식을 접시로 옮기기';
    }
  }
  if(text!==lastPromptText){
    lastPromptText = text;
    if(text){ promptText.textContent = text.split(' · ')[1]; promptKey.textContent = text.split(' · ')[0]; promptBar.classList.add('show'); }
    else promptBar.classList.remove('show');
  }
}

/* ---------- mesh sync ---------- */
function syncMeshFromEnt(ent){
  if(ent.role==='snake'){
    updateSnakeMesh(ent);
  } else {
    ent.mesh.group.position.set(ent.pos.x, ent.pos.y - (ent.inHole?0.5:0) - (ent.sitting?0.18:0) - (ent.knockedTimer>0?0.35:0), ent.pos.z);
    ent.mesh.group.rotation.y = ent.yaw;
    ent.mesh.group.rotation.x = ent.knockedTimer>0 ? Math.PI/2 : 0;
    ent.mesh.group.visible = !ent.caught && !ent.escaped;
    if(ent.mesh.belly) ent.mesh.belly.visible = false; // disabled per request — hunger is shown via the HUD gauge instead
    if(ent.mesh.hipPivots){
      const target = ent.sitting ? 1 : 0;
      ent.mesh.hipPivots.forEach(h=>{ h.rotation.x += (-Math.PI/2*target - h.rotation.x)*0.3; });
      ent.mesh.kneePivots.forEach(k=>{ k.rotation.x += (Math.PI/2*target - k.rotation.x)*0.3; });
    }
    if(ent.mesh.carryIcon) ent.mesh.carryIcon.visible = !!(ent.carriedFood>0 && !ent.carriedPos);
    if(ent.mesh.speech && ent.speechUntil && performance.now()>ent.speechUntil){ ent.mesh.speech.visible = false; ent.speechUntil = 0; }
  }
}
function updateSnakeMesh(ent){
  ent.pathHistory = ent.pathHistory || [];
  ent.pathHistory.push({x:ent.pos.x,y:ent.pos.y+0.28,z:ent.pos.z});
  if(ent.pathHistory.length>400) ent.pathHistory.shift();
  const spacing = 4;
  ent.mesh.segs.forEach((seg,i)=>{
    const idx = Math.max(0, ent.pathHistory.length-1-i*spacing);
    const h = ent.pathHistory[idx];
    if(h) seg.position.set(h.x,h.y,h.z);
    seg.material = ent.stunTimer>0 ? ent.mesh.matStun : ent.mesh.mat;
  });
  ent.mesh.group.visible = !ent.caught;
}

/* ---------- AI ---------- */
function pathTo(ent, targetX, targetZ, targetLevel){
  const from = nearestNode(ent.pos.x, ent.pos.z, levelOf(ent.pos.y));
  const to = nearestNode(targetX, targetZ, targetLevel);
  if(!from||!to) return null;
  const nodePath = aStar(from,to);
  if(!nodePath) return null;
  const pts = nodePath.map(id=>graph.nodes[id]);
  pts.push({x:targetX,z:targetZ,y:LEVEL_Y[targetLevel]});
  return pts;
}
function steerAlongPath(ent, dt, speed){
  if(!ent.path || ent.pathIdx>=ent.path.length){ return false; }
  const wp = ent.path[ent.pathIdx];
  const dx = wp.x-ent.pos.x, dz = wp.z-ent.pos.z;
  const d = Math.hypot(dx,dz);
  if(d < 0.5){ ent.pathIdx++; return true; }
  const nx=dx/d, nz=dz/d;
  ent.pos.x += nx*speed*dt; ent.pos.z += nz*speed*dt;
  ent.yaw = Math.atan2(nx,nz);
  return true;
}
function randomRoomTarget(level){
  const spots = [[6,5],[16,3],[15.5,12],[6,13],[2.5,7.5],[9,12]];
  const s = spots[(Math.random()*spots.length)|0];
  return {x:s[0]+  (Math.random()-0.5)*1.4, z:s[1]+(Math.random()-0.5)*1.4, level};
}

function updateSnakeAI(ent, dt){
  ent.aiTimer -= dt;
  const speed = snakeCurrentSpeed(ent);
  if(ent.stunTimer<=0 && ent.aiTimer<=0){
    ent.aiTimer = AI_TICK;
    let nearest=null, nd=Infinity;
    entities.forEach(o=>{
      if(o.role!=='player'||o.caught||o.escaped||o.inHole) return;
      const d = Math.hypot(o.pos.x-ent.pos.x,o.pos.z-ent.pos.z);
      if(d<nd){nd=d;nearest=o;}
    });
    let target;
    if(nearest && nd < 11){ target = {x:nearest.pos.x, z:nearest.pos.z, level:levelOf(nearest.pos.y)}; }
    else { target = ent.wanderTarget && Math.hypot(ent.pos.x-ent.wanderTarget.x,ent.pos.z-ent.wanderTarget.z)>1 ? ent.wanderTarget : randomRoomTarget(levelOf(ent.pos.y)); }
    ent.wanderTarget = target;
    // only replan from scratch when the target has moved to a meaningfully
    // different waypoint — replanning every tick regardless stalls agents near
    // the first node of a long path (they never build up progress on it).
    const goalKey = nearest ? ('chase:'+nearestNode(target.x,target.z,target.level)) : ('wander:'+nearestNode(target.x,target.z,target.level));
    if(goalKey !== ent.goalKey || !ent.path || ent.pathIdx >= ent.path.length){
      ent.path = pathTo(ent, target.x, target.z, target.level);
      ent.pathIdx = 0;
      ent.goalKey = goalKey;
    }
  }
  if(speed>0){
    const moved = steerAlongPath(ent, dt, speed);
    if(!moved){ ent.path=null; }
  }
  resolveCollision(ent.pos, SNAKE_RADIUS, levelOf(ent.pos.y), true);
  applyGravityAndGround(ent, dt);
  if(ent.stunTimer>0) ent.stunTimer -= dt;
  if(ent.slowTimer>0) ent.slowTimer -= dt;
  checkGasExposure(ent, dt);
  syncMeshFromEnt(ent);

  if(ent.stunTimer<=0){
    entities.forEach(o=>{
      if(o.role!=='player'||o.caught||o.escaped||o.inHole) return;
      const d = Math.hypot(o.pos.x-ent.pos.x,o.pos.z-ent.pos.z);
      if(d < CATCH_RADIUS) catchPlayer(o, ent);
    });
  }
}

function updateBotAI(ent, dt){
  if(ent.knockedTimer>0){ ent.knockedTimer -= dt; syncMeshFromEnt(ent); return; }
  if(ent.sick){ ent.hospitalTimer -= dt; if(ent.hospitalTimer<=0) recoverFromSick(ent); }
  ent.aiTimer -= dt;
  const dSnake = snakeEntity ? Math.hypot(snakeEntity.pos.x-ent.pos.x, snakeEntity.pos.z-ent.pos.z) : 999;
  const danger = dSnake < 6.5 && snakeEntity.stunTimer<=0;
  if(ent.aiTimer<=0){
    ent.aiTimer = AI_TICK + Math.random()*0.15;
    let target=null, goalKey=null, forceReplan=false;
    if(danger){
      const lvl = levelOf(ent.pos.y);
      const hole = holes.filter(h=>h.level===lvl).sort((a,b)=>Math.hypot(ent.pos.x-a.x,ent.pos.z-a.z)-Math.hypot(ent.pos.x-b.x,ent.pos.z-b.z))[0];
      if(hole && Math.hypot(ent.pos.x-hole.x,ent.pos.z-hole.z) < 7){ target = {x:hole.x,z:hole.z,level:lvl}; }
      else{
        const ang = Math.atan2(ent.pos.z-snakeEntity.pos.z, ent.pos.x-snakeEntity.pos.x);
        target = {x:Math.max(0.6,Math.min(19.4,ent.pos.x+Math.cos(ang)*6)), z:Math.max(0.6,Math.min(15.4,ent.pos.z+Math.sin(ang)*6)), level:lvl};
      }
      forceReplan = true; // flee target is reactive — always worth a fresh short plan
    } else if(ent.hasGold){
      target = {x:interactables.door.x, z:interactables.door.z, level:interactables.door.level};
      goalKey = 'door';
    } else if(ent.hasIron && !ent.hasSpray){
      target = {x:interactables.safe.x, z:interactables.safe.z, level:interactables.safe.level};
      goalKey = 'safe';
    } else if(ent.food<=0){
      const nearestFood = interactables.food.filter(f=>f.available).sort((a,b)=>
        Math.hypot(ent.pos.x-a.x,ent.pos.z-a.z)-Math.hypot(ent.pos.x-b.x,ent.pos.z-b.z))[0];
      if(nearestFood){ target = {x:nearestFood.x, z:nearestFood.z, level:nearestFood.level}; goalKey = 'food'; }
      else {
        if(!ent.path || ent.pathIdx>=ent.path.length || !ent.wanderTarget) ent.wanderTarget = randomRoomTarget(levelOf(ent.pos.y));
        target = ent.wanderTarget;
        goalKey = 'wander:'+target.x.toFixed(1)+','+target.z.toFixed(1);
      }
    } else {
      const unclaimed = interactables.keys.find(k=>!k.taken);
      if(unclaimed){ target = {x:unclaimed.x, z:unclaimed.z, level:unclaimed.level}; goalKey = 'key:'+unclaimed.type; }
      else {
        if(!ent.path || ent.pathIdx>=ent.path.length || !ent.wanderTarget) ent.wanderTarget = randomRoomTarget(levelOf(ent.pos.y));
        target = ent.wanderTarget;
        goalKey = 'wander:'+target.x.toFixed(1)+','+target.z.toFixed(1);
      }
    }
    // only replan from scratch when the goal actually changed — replanning
    // every tick regardless stalls agents near the first node of a long path.
    if(forceReplan || goalKey !== ent.goalKey || !ent.path || ent.pathIdx >= ent.path.length){
      ent.path = pathTo(ent, target.x, target.z, target.level);
      ent.pathIdx = 0;
      ent.goalKey = goalKey;
    }
  }
  if(ent.poopCooldown>0) ent.poopCooldown -= dt;
  if(ent.giantPoopCooldown>0) ent.giantPoopCooldown -= dt;
  if(ent.gasCooldown>0) ent.gasCooldown -= dt;
  // same rule as the human: no food, no poop/fart
  if(ent.poopCooldown<=0 && ent.food>0 && Math.random() < (danger?0.35:0.06)){ ent.food--; dropPoop(ent); }
  if(danger && ent.giantPoopCooldown<=0 && ent.food>0 && Math.random()<0.03){ ent.food--; dropPoop(ent, true); }
  if(!danger && ent.gasCooldown<=0 && ent.food>0 && Math.random()<0.03){ ent.gasCooldown=8; ent.food--; fartInRoom(ent); }
  if((!ent.speechUntil || performance.now()>ent.speechUntil+1500) && Math.random() < (danger?0.05:0.01)) botSpeak(ent, danger);
  const speed = PLAYER_SPEED * (danger?1.08:0.82);
  const moved = steerAlongPath(ent, dt, speed);
  if(!moved) ent.path=null;
  resolveCollision(ent.pos, PLAYER_RADIUS, levelOf(ent.pos.y), false);
  applyGravityAndGround(ent, dt);
  checkHole(ent);
  handlePlayerPickups(ent);
  syncMeshFromEnt(ent);
}

function dieOfHunger(p){
  if(p.caught || p.escaped || p.dead) return;
  p.caught = true;
  if(p.mesh && p.mesh.group) p.mesh.group.visible = false;
  updateAliveCount();
  showBanner(p.kind==='human' ? '배고픔을 견디지 못하고 굶어 죽었다' : `${p.name}이(가) 굶어 죽었다`, 'danger', 2600);
  if(p.kind==='human') enterSpectate();
  checkSnakeWin();
}
function catchPlayer(victim, snake){
  victim.caught = true;
  if(victim.mesh && victim.mesh.group) victim.mesh.group.visible = false;
  snake.slowTimer = CATCH_SLOW_TIME;
  updateAliveCount();
  showBanner(`${victim.name}이(가) 잡혔다`, 'danger', 2200);
  if(victim.kind==='human'){
    enterSpectate();
  }
  checkSnakeWin();
}
function enterSpectate(){
  const survivors = entities.filter(e=>e.role==='player' && !e.caught && !e.escaped && e!==humanEntity);
  if(survivors.length===0){ return; }
  spectateTarget = survivors[(Math.random()*survivors.length)|0];
  showBanner(`잡혔다... ${spectateTarget.name}을(를) 지켜본다`, 'danger', 2400);
}
function checkSnakeWin(){
  const survivors = entities.filter(e=>e.role==='player' && !e.caught && !e.escaped);
  if(survivors.length===0){ endGame(false); }
}
function onPlayersWin(escapee, reason){
  endGame(true, escapee, reason);
}

function endGame(playersWon, escapee, reason){
  if(gameEnded) return;
  gameEnded = true;
  const eyebrow = $('end-eyebrow'), title = $('end-title'), desc = $('end-desc');
  if(playersWon){
    eyebrow.textContent = reason==='killed' ? '뱀 처치' : '탈출 성공';
    title.innerHTML = '생존자 <span style="color:var(--toxic)">승리</span>';
    const who = escapee && escapee.kind==='human' ? '내가' : (escapee ? escapee.name+'이(가)' : '누군가');
    desc.textContent = reason==='killed'
      ? '뱀 스프레이로 뱀을 처치했다. 옥상 문이 열렸다.'
      : (humanEntity.role==='snake'
        ? '옥상 문이 열렸다. 생존자들이 빠져나갔다.'
        : (escapee===humanEntity ? '옥상 문을 열고 무사히 탈출했다.' : `${who} 먼저 옥상 문을 열고 탈출했다.`));
  } else {
    eyebrow.textContent = '사냥 종료';
    title.innerHTML = '<span style="color:var(--danger)">뱀</span>의 승리';
    desc.textContent = humanEntity.role==='snake' ? '모든 생존자를 잡아냈다.' : '아무도 탈출하지 못했다. 저택엔 뱀만 남았다.';
  }
  endScreen.classList.remove('hidden');
}

/* ---------- banner ---------- */
let bannerTimer=null;
function showBanner(text,cls,ms){
  bannerMsg.textContent = text;
  bannerMsg.className = 'msg '+(cls||'');
  banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(()=>banner.classList.remove('show'), ms||2000);
}

/* ---------- spectate camera ---------- */
function updateSpectateCamera(){
  if(!spectateTarget || spectateTarget.caught || spectateTarget.escaped){
    const survivors = entities.filter(e=>e.role==='player' && !e.caught && !e.escaped && e!==humanEntity);
    spectateTarget = survivors.length ? survivors[(Math.random()*survivors.length)|0] : null;
  }
  if(!spectateTarget) return;
  const target = new THREE.Vector3(spectateTarget.pos.x, spectateTarget.pos.y+1.4, spectateTarget.pos.z);
  const yaw = spectateTarget.yaw + Math.PI;
  const dist=5.4;
  const camX = target.x - dist*Math.sin(yaw), camZ = target.z - dist*Math.cos(yaw), camY = target.y+2.1;
  camera.position.lerp(new THREE.Vector3(camX,camY,camZ), 0.06);
  camera.lookAt(target);
}

/* ---------- scene setup ---------- */
function setupScene(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0b09);
  scene.fog = new THREE.Fog(0x0e0b09, 13, 42);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 200);
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasRootEl.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0x4a5a6a, 0x1a1410, 0.55);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffe9c2, 0.55);
  dir.position.set(14,20,6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024,1024);
  dir.shadow.camera.left=-14; dir.shadow.camera.right=14; dir.shadow.camera.top=14; dir.shadow.camera.bottom=-14;
  dir.shadow.camera.far = 45;
  scene.add(dir);
  const fill = new THREE.PointLight(0xd8ad5f, 0.5, 24, 2);
  fill.position.set(6,4.4,5); scene.add(fill);
  const fill2 = new THREE.PointLight(0x8fa3c0, 0.35, 24, 2);
  fill2.position.set(16,7.8,10); scene.add(fill2);

  scene.add(rootGroup);
  buildLevel(0); buildLevel(1); buildRoof(); buildStairs();
  buildHole(15.5,12,1); // 1층(level0)엔 구멍이 없다 — 2층에만 있다
  buildOutside();
  buildVacuum();
  interactables.toilet = [{x:17.7,z:13.6,level:0},{x:17.7,z:13.6,level:1}];
  buildGraph();

  window.addEventListener('resize', onResize);
}
function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ---------- main loop ---------- */
let poopCleanupTimer = 0;
function tick(){
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if(gameStarted){
    poopCleanupTimer -= dt;
    if(poopCleanupTimer<=0){ poopCleanupTimer = 2; cleanupPoops(); }
    updateKitchenDoors(dt);
    updateRides(dt);
    updateCustomers(dt);
    if(quizState){
      // hold everything still while a quiz modal is up
    } else if(!(humanEntity.caught||humanEntity.escaped)){
      updateHuman(dt);
      updateCamera();
    } else {
      updateSpectateCamera();
    }
    entities.forEach(ent=>{
      if(ent.kind!=='bot') return;
      if(ent.caught||ent.escaped||ent.dead) return;
      if(ent.role==='snake') updateSnakeAI(ent,dt);
      else updateBotAI(ent,dt);
    });
    // if human isn't the snake, still need snake AI updates handled above (kind bot covers ai snake).
    if(humanEntity.role!=='snake' && !gameEnded) checkSnakeWin();
  }
  renderer.render(scene, camera);
}

/* ---------- boot ---------- */
setupScene();
tick();

startBtn.addEventListener('click', ()=>{
  startScreen.classList.add('hidden');
  gameStarted = true; gameEnded = false;
  initGame();
});
restartBtn.addEventListener('click', ()=>{ location.reload(); });

})();
