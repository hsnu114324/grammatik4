/* game.js - Raiden style top-down shooter with German quiz */

const THREE = window.THREE;
if (!THREE) {
  throw new Error("window.THREE not ready: Three.js may have failed to load");
}

// ==================== Constants ====================
const WORLD = {
  LANE_X_MIN: -6.5,
  LANE_X_MAX: 6.5,
  PLAYER_Z: 8,
  PLAYER_Y: 1.6,
  SPAWN_Z: -22,
  DESPAWN_Z: 13,
  // 火圈（能量環）設定：戰機要穿越其中一個
  GATE_Y: 2.0,
  GATE_LEFT_X: -3.0,
  GATE_RIGHT_X: 3.0,
  GATE_RADIUS: 1.7,
  GATE_TUBE: 0.22,
  GATE_SIGN_W: 4.4,
  GATE_SIGN_H: 2.2,
};

const BULLET_SPEED = 44;
const BULLET_LIFE = 2.5;
const DOOR_MISS_DMG = 6;

// ==================== 頭目定義 ====================
// 每答對 BOSS_TRIGGER_CORRECTS 題觸發下一個頭目；擊敗第 4 個（魅魔女皇）= 通關
const BOSS_TRIGGER_CORRECTS = 5;
const BOSSES = [
  {
    id: 1, zhName: "\u683c\u4f4d\u5b88\u885b", deName: "Kasusw\u00e4chter",
    subtitle: "Nom. \u00b7 Gen. \u00b7 Dat. \u00b7 Akk. \u56db\u683c\u7684\u9435\u7532\u5b88\u8b77\u8005",
    hp: 180,
    color: 0x5ac8ff, accent: 0xffd166,
    pattern: "circle",        // 四方放射圓彈幕
    shootInterval: 1.6, bulletSpeed: 9, bulletDamage: 8,
    moveAmp: 4.5, moveFreq: 0.55,
    scale: 1.25,
  },
  {
    id: 2, zhName: "\u51a0\u8a5e\u9b54\u50cf", deName: "Artikel-Golem",
    subtitle: "der \u00b7 die \u00b7 das \u4e09\u982d\u77f3\u5de8\u50cf",
    hp: 260,
    color: 0x7f6a4a, accent: 0xffc07a,
    pattern: "trident",        // 三叉放射
    shootInterval: 1.3, bulletSpeed: 10, bulletDamage: 9,
    moveAmp: 3.0, moveFreq: 0.42,
    scale: 1.35,
  },
  {
    id: 3, zhName: "\u5f62\u5bb9\u8a5e\u5e7b\u8853\u5e2b", deName: "Adjektiv-Hexer",
    subtitle: "\u8a5e\u5c3e\u8b8a\u5f62\u7684\u87ba\u65cb\u9b54\u5f48 \u00b7 -e / -en / -er",
    hp: 360,
    color: 0xaa77ff, accent: 0xff66cc,
    pattern: "spiral",         // 連續旋轉螺旋
    shootInterval: 0.38, bulletSpeed: 9, bulletDamage: 7,
    moveAmp: 5.0, moveFreq: 0.78,
    scale: 1.25,
  },
  {
    id: 4, zhName: "\u9b45\u9b54\u5973\u7687", deName: "Sukkubus-K\u00f6nigin",
    subtitle: "\u6700\u7d42\u9b54\u738b \u00b7 \u5fc3\u5f62\u5f48\u5e55 \u00b7 \u8e20\u60d1\u773e\u751f",
    hp: 520,
    color: 0xcc3366, accent: 0xffb5da,
    pattern: "heart",          // 心形彈幕
    shootInterval: 1.0, bulletSpeed: 10, bulletDamage: 11,
    moveAmp: 5.5, moveFreq: 0.52,
    scale: 1.6,
    isFinal: true,
  },
];
const TOTAL_BOSSES = BOSSES.length;

// ==================== Audio ====================
let audioCtx = null;
function ensureAudio() {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  } catch (_) { audioCtx = null; }
  return audioCtx;
}
function playBlip(type, freq, dur, vol) {
  if (vol === undefined) vol = 0.15;
  if (!state.sfxOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}
function playSweep(type, fStart, fEnd, dur, vol) {
  if (vol === undefined) vol = 0.2;
  if (!state.sfxOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fStart, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(fEnd, 30), now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}
const SFX = {
  shoot: function () { playBlip("square", 900 + Math.random() * 200, 0.06, 0.04); },
  hitEnemy: function () { playBlip("triangle", 320, 0.08, 0.12); },
  kill: function () { playSweep("sawtooth", 560, 140, 0.22, 0.16); setTimeout(function () { playBlip("square", 120, 0.2, 0.15); }, 40); },
  correct: function () { playSweep("sine", 440, 880, 0.18, 0.18); setTimeout(function () { playSweep("sine", 660, 1320, 0.18, 0.16); }, 90); },
  wrong: function () { playSweep("square", 300, 80, 0.35, 0.18); },
  heal: function () { playSweep("sine", 520, 780, 0.15, 0.12); },
  damage: function () { playSweep("sawtooth", 240, 80, 0.28, 0.22); },
  miss: function () { playBlip("triangle", 180, 0.18, 0.1); },
  gameOver: function () { playSweep("square", 420, 90, 0.55, 0.22); setTimeout(function () { playSweep("sawtooth", 220, 60, 0.6, 0.22); }, 180); },
  bossSpawn: function () {
    playSweep("sawtooth", 120, 420, 0.55, 0.25);
    setTimeout(function () { playSweep("square", 400, 180, 0.5, 0.2); }, 180);
    setTimeout(function () { playBlip("triangle", 85, 0.4, 0.2); }, 400);
  },
  bossHit: function () { playBlip("square", 240, 0.1, 0.18); },
  bossBigHit: function () { playSweep("triangle", 780, 320, 0.3, 0.2); },
  bossBullet: function () { playBlip("triangle", 380, 0.08, 0.08); },
  bossDefeat: function () {
    playSweep("sine", 520, 1050, 0.3, 0.22);
    setTimeout(function () { playSweep("sine", 740, 1500, 0.35, 0.2); }, 100);
    setTimeout(function () { playSweep("sawtooth", 200, 80, 0.6, 0.22); }, 260);
  },
  win: function () {
    playSweep("sine", 440, 880, 0.25, 0.22);
    setTimeout(function () { playSweep("sine", 554, 1108, 0.25, 0.22); }, 180);
    setTimeout(function () { playSweep("sine", 660, 1320, 0.35, 0.24); }, 360);
    setTimeout(function () { playSweep("sine", 880, 1760, 0.6, 0.22); }, 600);
  },
};

// ==================== Game State ====================
const state = {
  mode: "start",
  hp: 100,
  maxHp: 100,
  firepower: 1,
  maxFirepower: 5,
  score: 0,
  combo: 0,
  kills: 0,
  lastFire: 0,
  lastDoorSpawn: 0,
  lastEnemySpawn: 0,
  currentPair: null,
  bestScore: loadBestScore(),
  sfxOn: loadSfxOn(),
  difficulty: loadDifficulty(),
  activeGroups: (function () {
    try {
      const p = new URLSearchParams(location.search).get("groups");
      if (p) {
        const arr = p.split(",").map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n >= 0);
        if (arr.length) return arr;
      }
    } catch (e) { /* ignore */ }
    return loadActiveGroups();
  })(),
  // ── Boss / 頭目系統 ──
  boss: null,                 // 目前活著的 Boss 物件（null = 沒有 Boss）
  nextBossIdx: 0,             // 下一次要 spawn 的 Boss 索引
  correctsSinceBoss: 0,       // 自上個 Boss 以來答對了多少題
  gameWon: false,             // 是否已擊敗最終 Boss
};

let DIFF = DIFFICULTY_PRESETS[state.difficulty];
state.maxHp = DIFF.playerMaxHp;
state.hp = DIFF.playerMaxHp;

// ==================== Three.js setup ====================
const canvas = document.getElementById("renderCanvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#02040f");
scene.fog = new THREE.Fog(0x050a1e, 30, 85);

const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  220
);
camera.position.set(0, 14, 16);
camera.lookAt(0, 1.5, -2);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const clock = new THREE.Clock();

// ==================== Lights ====================
const ambient = new THREE.AmbientLight(0x5560a0, 0.55);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xdce6ff, 0.6);
dirLight.position.set(3, 10, 6);
scene.add(dirLight);

const playerLight = new THREE.PointLight(0x9bb1ff, 1.0, 18, 2);
playerLight.position.set(0, 5, WORLD.PLAYER_Z);
scene.add(playerLight);

// ==================== Starfield dome ====================
(function buildStarfield() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d");

  const grd = ctx.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, "#01021a");
  grd.addColorStop(0.4, "#040b24");
  grd.addColorStop(1, "#030713");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 1.8 + 0.3;
    const a = 0.4 + Math.random() * 0.6;
    const r2 = (220 + Math.random() * 35) | 0;
    const g2 = (230 + Math.random() * 25) | 0;
    ctx.fillStyle = "rgba(" + r2 + "," + g2 + ",255," + a + ")";
    ctx.fillRect(x, y, r, r);
  }
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const grd2 = ctx.createRadialGradient(x, y, 0, x, y, 14);
    grd2.addColorStop(0, "rgba(255,255,255,1)");
    grd2.addColorStop(0.4, "rgba(160,200,255,0.6)");
    grd2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd2;
    ctx.fillRect(x - 14, y - 14, 28, 28);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 256 + 60;
    const grd3 = ctx.createRadialGradient(x, y, 0, x, y, 200);
    const hue = Math.random() * 90 + 200;
    grd3.addColorStop(0, "hsla(" + hue + ", 80%, 55%, 0.18)");
    grd3.addColorStop(1, "hsla(" + hue + ", 80%, 55%, 0)");
    ctx.fillStyle = grd3;
    ctx.fillRect(x - 200, y - 200, 400, 400);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(140, 32, 16);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI;
  scene.add(mesh);
})();

// ==================== Ground (scrolling grid) ====================
let groundTex = null;
(function buildGround() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#040815");
  grd.addColorStop(1, "#091228");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "rgba(110, 160, 255, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(120, 170, 255, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 220, 120, 0.35)";
  ctx.lineWidth = 3;
  ctx.setLineDash([40, 20]);
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.repeat.set(4, 16);
  groundTex = tex;

  const geo = new THREE.PlaneGeometry(40, 160);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    emissive: 0x0a1532,
    emissiveIntensity: 0.25,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -50);
  scene.add(mesh);
})();

// ==================== Player fighter jet ====================
const player = (function buildPlayerPlane() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2e5fb8, metalness: 0.75, roughness: 0.3,
    emissive: 0x173463, emissiveIntensity: 0.3,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x7ea6ff, metalness: 0.7, roughness: 0.3,
    emissive: 0x3b82f6, emissiveIntensity: 0.2,
  });

  const bodyGeo = new THREE.BoxGeometry(0.55, 0.3, 1.8);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Nose cone points toward -z (forward)
  const noseGeo = new THREE.ConeGeometry(0.24, 0.8, 10);
  const nose = new THREE.Mesh(noseGeo, wingMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -1.2);
  group.add(nose);

  // Main wings
  const wingGeo = new THREE.BoxGeometry(2.7, 0.08, 0.7);
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, -0.02, -0.05);
  group.add(wings);

  // Wingtip lights (left red, right white)
  const lightPositions = [
    { x: -1.32, color: 0xff5577 },
    { x: 1.32, color: 0xffffff },
  ];
  for (let i = 0; i < lightPositions.length; i++) {
    const lp = lightPositions[i];
    const lg = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 5),
      new THREE.MeshBasicMaterial({ color: lp.color })
    );
    lg.position.set(lp.x, 0.03, 0);
    group.add(lg);
  }

  // Tail wings
  const tailGeo = new THREE.BoxGeometry(0.9, 0.05, 0.35);
  const tail = new THREE.Mesh(tailGeo, wingMat);
  tail.position.set(0, 0.1, 0.8);
  group.add(tail);

  // Vertical stabilizer
  const stabGeo = new THREE.BoxGeometry(0.05, 0.32, 0.3);
  const stab = new THREE.Mesh(stabGeo, wingMat);
  stab.position.set(0, 0.22, 0.85);
  group.add(stab);

  // Cockpit dome
  const cockGeo = new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cockMat = new THREE.MeshStandardMaterial({
    color: 0x0c1a3a, metalness: 0.2, roughness: 0.1,
    emissive: 0x9bb1ff, emissiveIntensity: 0.4,
  });
  const cock = new THREE.Mesh(cockGeo, cockMat);
  cock.position.set(0, 0.17, -0.3);
  group.add(cock);

  // Engine exhaust glow (sphere so it looks right from any angle)
  const glowGeo = new THREE.SphereGeometry(0.28, 10, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffb86b, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 0.05, 1.0);
  group.add(glow);

  const engineLight = new THREE.PointLight(0xffa050, 1.6, 4, 2);
  engineLight.position.set(0, 0.05, 1.0);
  group.add(engineLight);

  group.position.set(0, WORLD.PLAYER_Y, WORLD.PLAYER_Z);
  scene.add(group);

  return {
    group: group,
    x: 0,
    targetX: 0,
    hoverPhase: 0,
    engineGlow: glow,
    engineLight: engineLight,
  };
})();

// ==================== Entity pools ====================
const doors = [];
const enemies = [];
const bullets = [];
const sparks = [];
const bossBullets = [];
const trail = [];

// ==================== Question pool ====================
let questionPool = [];
(function initPool() {
  questionPool = buildQuestionPool(state.activeGroups);
  if (questionPool.length < 2) {
    const groups = (window.GERMAN_WORDS_DATA && window.GERMAN_WORDS_DATA.groups) || [];
    const all = groups.map(function (_, i) { return i; });
    questionPool = buildQuestionPool(all);
  }
})();

// ==================== Utility: text drawing ====================
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function anyLineTooWide(ctx, lines, maxW) {
  for (let i = 0; i < lines.length; i++) {
    if (ctx.measureText(lines[i]).width > maxW) return true;
  }
  return false;
}

function drawMultilineCentered(ctx, lines, cx, cy, lineH) {
  const total = lines.length * lineH;
  let y = cy - total / 2 + lineH / 2;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ctx.strokeText(line, cx, y);
    ctx.fillText(line, cx, y);
    y += lineH;
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeGateTexture(text) {
  const w = 1024, h = 512;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "rgba(28, 40, 100, 0.94)");
  grd.addColorStop(1, "rgba(10, 16, 55, 0.94)");
  ctx.fillStyle = grd;
  roundedRect(ctx, 24, 24, w - 48, h - 48, 42);
  ctx.fill();

  ctx.strokeStyle = "#7ea6ff";
  ctx.lineWidth = 10;
  roundedRect(ctx, 24, 24, w - 48, h - 48, 42);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 46, 46, w - 92, h - 92, 34);
  ctx.stroke();

  ctx.fillStyle = "#9bb1ff";
  ctx.font = "bold 56px 'Noto Sans TC', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2726", 88, h / 2);
  ctx.fillText("\u2726", w - 88, h / 2);

  let fontSize = 132;
  ctx.font = "bold " + fontSize + "px 'Noto Sans TC', 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 10;
  const maxW = w - 260;
  let lines = wrapLines(ctx, text, maxW);
  while ((lines.length > 2 || anyLineTooWide(ctx, lines, maxW)) && fontSize > 40) {
    fontSize -= 8;
    ctx.font = "bold " + fontSize + "px 'Noto Sans TC', 'Segoe UI', sans-serif";
    lines = wrapLines(ctx, text, maxW);
  }
  drawMultilineCentered(ctx, lines, w / 2, h / 2, fontSize * 1.15);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 產生火焰光暈 sprite 貼圖（發散的橘紅光球）
function makeFlameGlowTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0.0, "rgba(255, 240, 200, 1)");
  grd.addColorStop(0.15, "rgba(255, 180, 70, 0.95)");
  grd.addColorStop(0.4, "rgba(255, 100, 40, 0.55)");
  grd.addColorStop(0.75, "rgba(200, 40, 20, 0.18)");
  grd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 產生火圈上文字看板的貼圖（放大 + 自動換行）
function makeGateSignTexture(text, isCorrect) {
  const w = 1024, h = 512;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const borderHue = isCorrect === true
    ? ["rgba(255, 180, 90, 0.95)", "rgba(210, 90, 40, 0.95)"]
    : ["rgba(255, 140, 90, 0.95)", "rgba(180, 60, 50, 0.95)"];

  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "rgba(12, 16, 38, 0.93)");
  grd.addColorStop(1, "rgba(8, 10, 26, 0.95)");
  ctx.fillStyle = grd;
  roundedRect(ctx, 20, 20, w - 40, h - 40, 48);
  ctx.fill();

  ctx.strokeStyle = borderHue[0];
  ctx.lineWidth = 12;
  roundedRect(ctx, 20, 20, w - 40, h - 40, 48);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 40, 40, w - 80, h - 80, 36);
  ctx.stroke();

  let fontSize = 168;
  ctx.font = "bold " + fontSize + "px 'Noto Sans TC', 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 12;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = w - 120;
  let lines = wrapLines(ctx, text, maxW);
  // 允許最多 3 行，盡量維持大字體（最小 88）
  while ((lines.length > 3 || anyLineTooWide(ctx, lines, maxW)) && fontSize > 88) {
    fontSize -= 10;
    ctx.font = "bold " + fontSize + "px 'Noto Sans TC', 'Segoe UI', sans-serif";
    lines = wrapLines(ctx, text, maxW);
  }
  drawMultilineCentered(ctx, lines, w / 2, h / 2, fontSize * 1.1);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHpSprite(currentHp, maxHp, tint) {
  if (!tint) tint = "#ff5577";
  const w = 256, h = 96;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  roundedRect(ctx, 6, 6, w - 12, h - 12, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 6, 6, w - 12, h - 12, 20);
  ctx.stroke();

  const pct = Math.max(0, currentHp / maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundedRect(ctx, 18, 18, w - 36, 22, 10);
  ctx.fill();
  ctx.fillStyle = tint;
  roundedRect(ctx, 18, 18, (w - 36) * pct, 22, 10);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 30px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 4;
  const label = "HP " + Math.max(0, Math.ceil(currentHp)) + "/" + maxHp;
  ctx.strokeText(label, w / 2, h - 28);
  ctx.fillText(label, w / 2, h - 28);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ==================== Word gate (火圈 / ring of fire) ====================
function createGate(opts) {
  const text = opts.text, isCorrect = opts.isCorrect, side = opts.side;
  const group = new THREE.Group();

  // 火圈主體（雙層 Torus：外層金色、內層紅橙）
  const R = WORLD.GATE_RADIUS;
  const T = WORLD.GATE_TUBE;
  const outerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(R, T, 18, 56),
    new THREE.MeshStandardMaterial({
      color: 0xffb060,
      emissive: 0xffa040,
      emissiveIntensity: 1.4,
      metalness: 0.35,
      roughness: 0.35,
    })
  );
  group.add(outerTorus);

  const innerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(R - T * 0.55, T * 0.42, 14, 48),
    new THREE.MeshStandardMaterial({
      color: 0xff5a1e,
      emissive: 0xff3a10,
      emissiveIntensity: 1.6,
      metalness: 0.2,
      roughness: 0.55,
    })
  );
  innerTorus.position.z = 0.05;
  group.add(innerTorus);

  // 旋轉火焰光暈圈（大 sprite，additive blending）
  const glowTex = makeFlameGlowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffa050,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(R * 3.2, R * 3.2, 1);
  group.add(glow);
  group.userData.glow = glow;

  // 環心微光（幫助看到火圈所在的洞）
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(R - T, 48),
    new THREE.MeshBasicMaterial({
      color: isCorrect ? 0xffd080 : 0xff8850,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(halo);
  group.userData.halo = halo;

  // 環周圍散出的小火花 sprite
  const sparkMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffd060,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.75,
  });
  const sparkList = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(sparkMat.clone());
    const ang = (i / 8) * Math.PI * 2;
    s.userData.angle = ang;
    s.userData.phase = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0.1);
    s.scale.set(0.55, 0.55, 1);
    group.add(s);
    sparkList.push(s);
  }
  group.userData.sparks = sparkList;

  // 文字看板（火圈上方的大招牌，貼近火圈頂部，避免與畫面頂部的題目板重疊）
  const signH = WORLD.GATE_SIGN_H;
  const poleLen = 0.22;
  const signBottomY = R + poleLen;
  const signCenterY = signBottomY + signH * 0.5;

  const signTex = makeGateSignTexture(text, isCorrect);
  const signGeo = new THREE.PlaneGeometry(WORLD.GATE_SIGN_W, signH);
  const signMat = new THREE.MeshBasicMaterial({
    map: signTex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, signCenterY, 0);
  group.add(sign);

  // 招牌與火圈之間的細支柱
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, poleLen, 8),
    new THREE.MeshStandardMaterial({
      color: 0x8c6a3a,
      emissive: 0xffa040,
      emissiveIntensity: 0.6,
    })
  );
  pole.position.set(0, R + poleLen * 0.5, 0);
  group.add(pole);

  // 中央火光
  const light = new THREE.PointLight(0xffb060, 2.4, 9, 2);
  light.position.set(0, 0, 0.6);
  group.add(light);

  group.position.set(
    side === "left" ? WORLD.GATE_LEFT_X : WORLD.GATE_RIGHT_X,
    WORLD.GATE_Y,
    WORLD.SPAWN_Z
  );

  scene.add(group);

  return {
    group: group,
    outerTorus: outerTorus,
    innerTorus: innerTorus,
    sign: sign,
    text: text,
    isCorrect: isCorrect,
    side: side,
    dead: false,
    pairId: 0,
    lastZ: WORLD.SPAWN_Z,
    spinPhase: Math.random() * Math.PI * 2,
    // passed 狀態：null（尚未越過戰機 z）/ "through"（穿過環）/ "missed"（從旁邊過去）
    passed: null,
  };
}

let pairCounter = 0;

function spawnDoorPair() {
  if (!questionPool.length) return;

  const q = randomChoice(questionPool);
  let wrong = null;

  // 若正確題是變格題（有 caseIdx），優先從「同群組 + 同格位」的題目中選 wrong，
  // 讓兩個火圈都是同一個格位（例如都是第3格 Dativ），
  // 玩家必須根據題目的陰陽性 / 冠詞 / 擁有者判斷，而不是靠格位名就能瞎猜。
  if (q.caseIdx !== undefined && q.caseIdx !== null) {
    const sameSlot = questionPool.filter(function (x) {
      return x.group === q.group
        && x.caseIdx === q.caseIdx
        && x.de && x.de !== q.de
        && x.zh !== q.zh;
    });
    if (sameSlot.length) wrong = randomChoice(sameSlot);
  }
  // fallback：退回原本「整個 pool 中隨便挑一個不同 de 的」
  if (!wrong) {
    for (let i = 0; i < 12; i++) {
      const cand = randomChoice(questionPool);
      if (cand.de && cand.de !== q.de) { wrong = cand; break; }
    }
  }
  if (!wrong || wrong.de === q.de) return;

  const correctSide = Math.random() < 0.5 ? "left" : "right";
  const left = (correctSide === "left")
    ? createGate({ text: q.de, isCorrect: true, side: "left" })
    : createGate({ text: wrong.de, isCorrect: false, side: "left" });
  const right = (correctSide === "right")
    ? createGate({ text: q.de, isCorrect: true, side: "right" })
    : createGate({ text: wrong.de, isCorrect: false, side: "right" });

  pairCounter++;
  left.pairId = pairCounter;
  right.pairId = pairCounter;

  doors.push(left, right);
  state.currentPair = { pairId: pairCounter, question: q };
  updateQuestionBoard();
}

// ==================== 德文語法分析（幫助理解題目） ====================
// 根據德文答案推斷需要的語法結構，顯示在題目板下方作為學習提示。
// 僅推斷「通用結構」：陰陽性冠詞、主詞人稱、第3/4格代詞、動詞原形、問句等。
function analyzeGerman(de) {
  if (!de) return [];
  const raw = String(de).trim();
  const rawParts = raw.split(/\s+/).filter(Boolean);
  if (!rawParts.length) return [];
  const lowerParts = rawParts.map(function (p) {
    return p.toLowerCase().replace(/[.,!?？！]$/, "");
  });
  const first = lowerParts[0];
  const hints = [];

  // 句型
  if (/[?？]$/.test(raw)) hints.push("\u53e5\u578b\uff1a\u554f\u53e5");
  else if (/[!！]$/.test(raw)) hints.push("\u53e5\u578b\uff1a\u7948\u4f7f\u53e5");

  // 動詞原形（單字且以 -en 結尾，長度至少 4；少數例外：sein, tun）
  if (rawParts.length === 1) {
    const w = rawParts[0];
    const wl = w.toLowerCase();
    const isInfinitive =
      (w.length >= 4 && /en$/i.test(w)) ||
      wl === "sein" || wl === "tun";
    if (isInfinitive) hints.push("\u52d5\u8a5e\u539f\u5f62 Infinitiv");
  }

  // 定冠詞 / 不定冠詞（只有後面跟著大寫開頭的名詞才算是冠詞用法，
  // 例如 "Ich brauche das" 的 das 是代名詞，不標成中性冠詞）
  const articleMap = {
    der: "\u967d\u6027 der (m. Nom.)",
    die: "\u9670\u6027 \u6216 \u8907\u6578 die",
    das: "\u4e2d\u6027 das (n.)",
    den: "\u7b2c4\u683c den (m. Akk.)",
    dem: "\u7b2c3\u683c dem (m./n. Dat.)",
    ein: "\u4e0d\u5b9a\u51a0\u8a5e ein (m./n.)",
    eine: "\u4e0d\u5b9a\u51a0\u8a5e eine (f.)",
    einen: "\u7b2c4\u683c einen (m. Akk.)",
    einem: "\u7b2c3\u683c einem (m./n. Dat.)",
    einer: "\u7b2c3\u683c einer (f. Dat.)",
  };
  for (let i = 0; i < lowerParts.length - 1; i++) {
    if (articleMap[lowerParts[i]]) {
      const next = rawParts[i + 1] || "";
      if (/^[A-Z\u00c4\u00d6\u00dc]/.test(next)) {
        hints.push(articleMap[lowerParts[i]]);
        break;
      }
    }
  }

  // 物主代詞（句首且後面還有字 → 標注物主）
  const possessiveRoots = {
    mein: "\u6211\u7684",
    dein: "\u4f60\u7684",
    sein: "\u4ed6/\u5b83\u7684",
    unser: "\u6211\u5011\u7684",
    euer: "\u4f60\u5011\u7684",
  };
  let possessiveFound = false;
  for (const k in possessiveRoots) {
    if (first === k || first.startsWith(k) && first.length > k.length) {
      if (lowerParts.length >= 2) {
        hints.push("\u7269\u4e3b\u4ee3\u8a5e\uff1a" + possessiveRoots[k] + " (" + rawParts[0] + ")");
        possessiveFound = true;
        break;
      }
    }
  }
  // 特別處理 ihr：句首＋後接名詞看起來時標成物主「她的/他們的」
  if (!possessiveFound && first === "ihr" && lowerParts.length >= 2) {
    const next = rawParts[1] || "";
    if (/^[A-ZÄÖÜ]/.test(next)) {
      hints.push("\u7269\u4e3b\u4ee3\u8a5e\uff1a\u5979\u7684/\u4ed6\u5011\u7684/\u60a8\u7684 (ihr)");
      possessiveFound = true;
    }
  }

  // 主詞（主格代詞）：句首、或倒裝問句的第二位
  const nomSubj = {
    ich: "\u4e3b\u8a5e\uff1a\u6211 (ich, 1st sg.)",
    du: "\u4e3b\u8a5e\uff1a\u4f60 (du, 2nd sg.)",
    er: "\u4e3b\u8a5e\uff1a\u4ed6 (er, 3rd sg. m.)",
    es: "\u4e3b\u8a5e\uff1a\u5b83 (es, 3rd sg. n.)",
    wir: "\u4e3b\u8a5e\uff1a\u6211\u5011 (wir, 1st pl.)",
  };
  function findSubject(p) {
    if (nomSubj[p]) return nomSubj[p];
    if (p === "sie") return "\u4e3b\u8a5e\uff1a\u5979 / \u4ed6\u5011 / \u60a8 (sie/Sie)";
    if (p === "ihr") return "\u4e3b\u8a5e\uff1a\u4f60\u5011 (ihr, 2nd pl.)";
    return null;
  }
  if (!possessiveFound) {
    let subjHint = findSubject(first);
    if (!subjHint && lowerParts.length >= 2) {
      const s2 = findSubject(lowerParts[1]);
      if (s2) subjHint = s2 + "\uff08\u5012\u88dd\uff09";
    }
    if (subjHint) hints.push(subjHint);
  }

  // 第3格代詞 Dativ
  const datPron = ["mir", "dir", "ihm", "uns", "euch", "ihnen"];
  for (let i = 0; i < lowerParts.length; i++) {
    if (datPron.indexOf(lowerParts[i]) >= 0) {
      hints.push("\u7b2c3\u683c Dativ\uff08" + lowerParts[i] + "\uff09");
      break;
    }
  }
  // 第4格代詞 Akkusativ
  const akkPron = ["mich", "dich", "ihn"];
  for (let i = 0; i < lowerParts.length; i++) {
    if (akkPron.indexOf(lowerParts[i]) >= 0) {
      hints.push("\u7b2c4\u683c Akkusativ\uff08" + lowerParts[i] + "\uff09");
      break;
    }
  }

  // 可分離動詞優先：最後一字若是前綴，就不把它當介系詞
  const sepPrefixes = ["an", "ab", "auf", "aus", "ein", "mit", "nach", "vor", "zu", "zur\u00fcck", "weg", "fern", "fest", "los", "hin", "her"];
  const isSeparable = rawParts.length >= 2 && sepPrefixes.indexOf(lowerParts[lowerParts.length - 1]) >= 0;

  // 介系詞（各類只抓第一個；若最後字是可分離前綴，掃描時忽略該位置）
  const datPreps = ["mit", "nach", "bei", "von", "zu", "aus", "seit"];
  const akkPreps = ["durch", "für", "gegen", "ohne", "um"];
  const wechselPreps = ["an", "auf", "in", "\u00fcber", "unter", "vor", "hinter", "neben", "zwischen"];
  const prepScanEnd = isSeparable ? lowerParts.length - 1 : lowerParts.length;
  let prepNoted = false;
  for (let i = 0; i < prepScanEnd && !prepNoted; i++) {
    const p = lowerParts[i];
    if (datPreps.indexOf(p) >= 0) { hints.push("\u4ecb\u7cfb\u8a5e " + p + "\uff08\u63a5 Dativ\uff09"); prepNoted = true; }
    else if (akkPreps.indexOf(p) >= 0) { hints.push("\u4ecb\u7cfb\u8a5e " + p + "\uff08\u63a5 Akkusativ\uff09"); prepNoted = true; }
    else if (wechselPreps.indexOf(p) >= 0 && i > 0) { hints.push("\u4ecb\u7cfb\u8a5e " + p + "\uff08\u96d9\u683c\uff09"); prepNoted = true; }
  }

  if (isSeparable) hints.push("\u53ef\u5206\u96e2\u52d5\u8a5e");

  // 去重 + 最多 5 個
  const seen = {};
  const out = [];
  for (let i = 0; i < hints.length && out.length < 5; i++) {
    if (!seen[hints[i]]) { seen[hints[i]] = 1; out.push(hints[i]); }
  }
  return out;
}

function renderQuestionTags(hints) {
  const tagsEl = document.getElementById("questionTags");
  if (!tagsEl) return;
  tagsEl.innerHTML = "";
  if (!hints || !hints.length) return;
  for (let i = 0; i < hints.length; i++) {
    const span = document.createElement("span");
    span.className = "qtag";
    span.textContent = hints[i];
    tagsEl.appendChild(span);
  }
}

function updateQuestionBoard() {
  const q = state.currentPair && state.currentPair.question;
  const textEl = document.getElementById("questionText");
  const promptEl = document.getElementById("questionPrompt");
  if (!q) {
    textEl.textContent = "\u8f09\u5165\u4e2d\u2026";
    promptEl.textContent = "\u6e96\u5099\u4e2d";
    renderQuestionTags([]);
    return;
  }
  textEl.textContent = q.zh;
  promptEl.textContent = "\u7a7f\u904e\u5beb\u8457\u6b63\u78ba\u5fb7\u6587\u7684\u80fd\u91cf\u706b\u5708";
  // 變格表群組（群組 3/4/5 = idx 2/3/4）：題目本身已含陰陽性/主詞/格位，
  // 只掛一個「類型」標籤，避免重複或誤判。
  if (q.group === 2) {
    renderQuestionTags(["\u7269\u4e3b\u4ee3\u8a5e\u8b8a\u683c Possessivpronomen"]);
  } else if (q.group === 3) {
    renderQuestionTags(["\u51a0\u8a5e + \u540d\u8a5e\u8b8a\u683c Nomen-Deklination"]);
  } else if (q.group === 4) {
    renderQuestionTags(["\u5f62\u5bb9\u8a5e\u8a5e\u5c3e\u8b8a\u5316 Adjektivendungen"]);
  } else {
    renderQuestionTags(analyzeGerman(q.de));
  }
}

function updateQuestionBoardWaiting() {
  document.getElementById("questionText").textContent = "\u4e0b\u4e00\u984c\u6e96\u5099\u4e2d\u2026";
  document.getElementById("questionPrompt").textContent = "\u2026";
  renderQuestionTags([]);
}

function removeDoor(door) {
  door.dead = true;
  scene.remove(door.group);
  door.group.traverse(function (o) {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) {
        for (let i = 0; i < o.material.length; i++) {
          const m = o.material[i];
          if (m.map && m.map.dispose) m.map.dispose();
          if (m.dispose) m.dispose();
        }
      } else {
        if (o.material.map && o.material.map.dispose) o.material.map.dispose();
        if (o.material.dispose) o.material.dispose();
      }
    }
  });
}

function removeDoorPair(pairId) {
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.pairId === pairId && !d.dead) removeDoor(d);
  }
}

// ==================== Enemy fighter ====================
function createEnemy() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7a1a2e,
    emissive: 0xc63a55,
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.5,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x5e1524,
    emissive: 0xff4070,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.4,
  });

  // Body (forward is +z, toward player)
  const bodyGeo = new THREE.BoxGeometry(0.8, 0.35, 1.3);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Cockpit at +z front
  const cockGeo = new THREE.SphereGeometry(0.2, 10, 6);
  const cockMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const cock = new THREE.Mesh(cockGeo, cockMat);
  cock.position.set(0, 0.2, 0.35);
  group.add(cock);

  const wingGeo = new THREE.BoxGeometry(2.0, 0.09, 0.65);
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, -0.02, -0.05);
  group.add(wings);

  const wingTipXs = [-0.95, 0.95];
  for (let i = 0; i < wingTipXs.length; i++) {
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff6a85 })
    );
    g.position.set(wingTipXs[i], 0.04, -0.05);
    group.add(g);
  }

  const finGeo = new THREE.BoxGeometry(0.05, 0.28, 0.3);
  const fin = new THREE.Mesh(finGeo, wingMat);
  fin.position.set(0, 0.18, -0.55);
  group.add(fin);

  const hp = DIFF.enemyHp + Math.floor(Math.random() * 10);
  const spriteMat = new THREE.SpriteMaterial({
    map: makeHpSprite(hp, hp),
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.7, 0.6, 1);
  sprite.position.set(0, 1.0, 0);
  group.add(sprite);

  const glow = new THREE.PointLight(0xff5577, 1.0, 4, 2);
  glow.position.set(0, 0.2, 0);
  group.add(glow);

  // Spawn X position, avoiding direct center if possible
  const spawnRange = (WORLD.LANE_X_MAX - WORLD.LANE_X_MIN) - 2.0;
  const lx = WORLD.LANE_X_MIN + 1.0 + Math.random() * spawnRange;
  group.position.set(lx, 1.6, WORLD.SPAWN_Z - Math.random() * 8);

  scene.add(group);

  return {
    group: group,
    hp: hp,
    maxHp: hp,
    spriteMat: spriteMat,
    speed: DIFF.enemySpeed * (0.85 + Math.random() * 0.35),
    dead: false,
    weaveT: Math.random() * Math.PI * 2,
    weaveX: (Math.random() - 0.5) * 0.35,
  };
}

function removeEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  scene.remove(enemy.group);
  enemy.group.traverse(function (o) {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if (m.map && m.map.dispose) m.map.dispose();
        if (m.dispose) m.dispose();
      }
    }
  });
}

function updateEnemyHpSprite(enemy) {
  if (enemy.spriteMat.map && enemy.spriteMat.map.dispose) enemy.spriteMat.map.dispose();
  enemy.spriteMat.map = makeHpSprite(enemy.hp, enemy.maxHp);
  enemy.spriteMat.needsUpdate = true;
}

// ==================== 頭目（Boss） ====================
function makeBossNameTexture(zh, de) {
  const w = 1024, h = 256;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 8;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 120px 'Noto Sans TC', 'Segoe UI', sans-serif";
  ctx.strokeText(zh, w / 2, h / 2 - 20);
  ctx.fillText(zh, w / 2, h / 2 - 20);
  ctx.fillStyle = "#ffd6e8";
  ctx.font = "bold 58px 'Segoe UI', sans-serif";
  ctx.strokeText(de, w / 2, h / 2 + 80);
  ctx.fillText(de, w / 2, h / 2 + 80);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBossModel(bossData) {
  const group = new THREE.Group();
  const mainColor = bossData.color;
  const accent = bossData.accent;
  const s = bossData.scale || 1.0;

  const pivot = new THREE.Group();
  group.add(pivot);
  group.userData.pivot = pivot;

  if (bossData.id === 1) {
    // 格位守衛 Kasuswächter：中央鐵甲 + 四個盾牌（代表四格）
    const core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.1 * s, 0),
      new THREE.MeshStandardMaterial({
        color: mainColor, emissive: accent, emissiveIntensity: 0.45,
        roughness: 0.35, metalness: 0.7,
      })
    );
    pivot.add(core);
    group.userData.core = core;

    const shieldMat = new THREE.MeshStandardMaterial({
      color: mainColor, emissive: accent, emissiveIntensity: 0.7,
      roughness: 0.25, metalness: 0.85,
    });
    const shields = [];
    const labels = ["N.", "G.", "D.", "A."];
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 1.3 * s, 0.18 * s), shieldMat);
      sh.position.set(Math.cos(ang) * 2.0 * s, Math.sin(ang) * 0.6, Math.sin(ang) * 1.1 * s);
      sh.lookAt(pivot.position);
      shields.push(sh);
      pivot.add(sh);
    }
    group.userData.shields = shields;

    // 中央皇冠環
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.35 * s, 0.12 * s, 8, 24),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.2 })
    );
    ring.rotation.x = Math.PI / 2;
    pivot.add(ring);
    group.userData.ring = ring;
  } else if (bossData.id === 2) {
    // 冠詞魔像 Artikel-Golem：圓柱身體 + 三顆頭
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2 * s, 1.5 * s, 1.9 * s, 16),
      new THREE.MeshStandardMaterial({
        color: mainColor, emissive: accent, emissiveIntensity: 0.25,
        roughness: 0.75, metalness: 0.3,
      })
    );
    body.position.y = 0;
    pivot.add(body);
    group.userData.body = body;

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xcaa16a, emissive: accent, emissiveIntensity: 0.5,
      roughness: 0.6, metalness: 0.2,
    });
    const heads = [];
    const headLabels = ["der", "das", "die"];
    const headColors = [0x5ac8ff, 0x7fffa8, 0xff88c8];
    for (let i = 0; i < 3; i++) {
      const ang = ((i - 1) * 0.7);
      const head = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 * s, 14, 10),
        headMat
      );
      head.add(sphere);
      // 頭頂標籤
      const cvs = document.createElement("canvas");
      cvs.width = 128; cvs.height = 64;
      const cx = cvs.getContext("2d");
      cx.fillStyle = "rgba(0,0,0,0.8)";
      cx.fillRect(0, 0, 128, 64);
      cx.fillStyle = "#fff";
      cx.font = "bold 48px 'Segoe UI', sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(headLabels[i], 64, 32);
      const labelTex = new THREE.CanvasTexture(cvs);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true }));
      label.scale.set(0.9, 0.45, 1);
      label.position.set(0, 0.8 * s, 0);
      head.add(label);
      // 頭上眼睛
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 * s, 8, 6),
        new THREE.MeshBasicMaterial({ color: headColors[i] })
      );
      eye.position.set(0, 0, 0.5 * s);
      head.add(eye);
      head.position.set(Math.sin(ang) * 1.4 * s, 1.3 * s, Math.cos(ang) * 0.3 * s);
      heads.push(head);
      pivot.add(head);
    }
    group.userData.heads = heads;
  } else if (bossData.id === 3) {
    // 形容詞幻術師 Adjektiv-Hexer：浮動法師 + 三個魔法環
    const robe = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * s, 1.8 * s, 16),
      new THREE.MeshStandardMaterial({
        color: mainColor, emissive: accent, emissiveIntensity: 0.4,
        roughness: 0.4, metalness: 0.35,
      })
    );
    robe.position.y = -0.2;
    pivot.add(robe);
    group.userData.robe = robe;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.45 * s, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xf0d4ff, emissive: accent, emissiveIntensity: 0.7 })
    );
    head.position.y = 0.85 * s;
    pivot.add(head);

    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.5 * s, 1.1 * s, 12),
      new THREE.MeshStandardMaterial({ color: 0x551a8b, emissive: accent, emissiveIntensity: 0.5 })
    );
    hat.position.y = 1.7 * s;
    pivot.add(hat);

    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(1.4 * s + i * 0.25 * s, 0.05 * s, 8, 48),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? accent : 0x55ffdd,
          transparent: true, opacity: 0.75,
        })
      );
      r.rotation.x = Math.PI / 2.2 + i * 0.2;
      r.rotation.y = i * 0.4;
      rings.push(r);
      pivot.add(r);
    }
    group.userData.rings = rings;
  } else {
    // 魅魔女皇 Sukkubus-Königin：核心球 + 翅膀 + 王冠 + 玫瑰光環
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.95 * s, 20, 14),
      new THREE.MeshStandardMaterial({
        color: mainColor, emissive: accent, emissiveIntensity: 0.55,
        roughness: 0.3, metalness: 0.4,
      })
    );
    pivot.add(body);
    group.userData.body = body;

    // 翅膀（canvas texture：羽毛狀紫紅漸層）
    const wingCvs = document.createElement("canvas");
    wingCvs.width = 512; wingCvs.height = 512;
    const wcx = wingCvs.getContext("2d");
    const grd = wcx.createRadialGradient(256, 256, 10, 256, 256, 256);
    grd.addColorStop(0, "rgba(255, 150, 200, 0.95)");
    grd.addColorStop(0.5, "rgba(180, 40, 110, 0.85)");
    grd.addColorStop(1, "rgba(40, 0, 30, 0.0)");
    wcx.fillStyle = grd;
    // 羽翼形狀
    wcx.beginPath();
    wcx.moveTo(256, 256);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = Math.PI * 0.95 * (t - 0.5);
      const r = 220 - Math.abs(t - 0.5) * 80;
      wcx.lineTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r * 0.9);
    }
    wcx.closePath();
    wcx.fill();
    for (let i = 0; i < 80; i++) {
      const x = 240 + Math.random() * 260;
      const y = 100 + Math.random() * 300;
      wcx.fillStyle = "rgba(255,220,240,0.35)";
      wcx.beginPath();
      wcx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
      wcx.fill();
    }
    const wingTex = new THREE.CanvasTexture(wingCvs);
    wingTex.colorSpace = THREE.SRGBColorSpace;
    const wingMat = new THREE.MeshBasicMaterial({
      map: wingTex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * s, 2.4 * s), wingMat);
    wingL.position.set(-1.6 * s, 0.6, -0.2);
    wingL.rotation.y = Math.PI * 0.1;
    pivot.add(wingL);
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * s, 2.4 * s), wingMat.clone());
    wingR.position.set(1.6 * s, 0.6, -0.2);
    wingR.rotation.y = -Math.PI * 0.1;
    wingR.scale.x = -1;
    pivot.add(wingR);
    group.userData.wings = [wingL, wingR];

    // 王冠（5 根小尖刺）
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffdf7a, emissive: 0xffb347, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.25 });
    for (let i = -2; i <= 2; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.4 * s + (i === 0 ? 0.22 : 0), 8), crownMat);
      sp.position.set(i * 0.22 * s, 1.0 * s, 0);
      pivot.add(sp);
    }
    // 王冠主環
    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.55 * s, 0.08 * s, 8, 18), crownMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = 0.85 * s;
    pivot.add(crownRing);

    // 心形魅惑光環（Sprite）
    const auraCvs = document.createElement("canvas");
    auraCvs.width = 256; auraCvs.height = 256;
    const acx = auraCvs.getContext("2d");
    const agrd = acx.createRadialGradient(128, 128, 10, 128, 128, 120);
    agrd.addColorStop(0, "rgba(255, 120, 180, 0.95)");
    agrd.addColorStop(0.6, "rgba(180, 40, 120, 0.35)");
    agrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    acx.fillStyle = agrd;
    acx.beginPath();
    acx.arc(128, 128, 120, 0, Math.PI * 2);
    acx.fill();
    const auraTex = new THREE.CanvasTexture(auraCvs);
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    aura.scale.set(4.5 * s, 4.5 * s, 1);
    aura.position.set(0, 0.2, 0.01);
    pivot.add(aura);
    group.userData.aura = aura;

    // 雙眼（紫紅發光）
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a6a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 8, 6), eyeMat);
    eyeL.position.set(-0.25 * s, 0.1 * s, 0.9 * s);
    pivot.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 8, 6), eyeMat);
    eyeR.position.set(0.25 * s, 0.1 * s, 0.9 * s);
    pivot.add(eyeR);
  }

  // 共通：Boss 腳下光影 + 頭頂名牌
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.6 * s, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.3 * s;
  group.add(shadow);

  const nameTex = makeBossNameTexture(bossData.zhName, bossData.deName);
  const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: nameTex, depthTest: false, depthWrite: false, transparent: true,
  }));
  nameSprite.scale.set(5.2 * s, 1.3 * s, 1);
  nameSprite.position.set(0, 2.5 * s, 0);
  group.add(nameSprite);
  group.userData.nameSprite = nameSprite;

  // Boss 的光源（讓它自發光強一些）
  const light = new THREE.PointLight(bossData.accent, 1.6, 10, 2);
  light.position.set(0, 0.8, 0);
  group.add(light);

  return { group, pivot };
}

function spawnBoss(idx) {
  if (idx < 0 || idx >= BOSSES.length) return;
  const data = BOSSES[idx];
  const model = createBossModel(data);
  // 從畫面外高空降臨
  model.group.position.set(0, 2.5, WORLD.SPAWN_Z - 4);
  scene.add(model.group);

  const boss = {
    data: data,
    group: model.group,
    pivot: model.pivot,
    hp: data.hp,
    maxHp: data.hp,
    shootTimer: 1.2,           // 第 1.2 秒後第一次射擊
    moveT: 0,
    spinT: 0,
    spiralPhase: 0,
    phase: "intro",            // intro → battle → dying
    introElapsed: 0,
    dyingElapsed: 0,
    targetZ: -4.5,             // 最終定位的 z（較近，視覺更震撼）
    bulletCooldown: data.shootInterval,
  };
  state.boss = boss;

  // HUD 顯示
  ui.bossHud.classList.remove("hidden");
  ui.bossZh.textContent = data.zhName;
  ui.bossDe.textContent = data.deName;
  ui.bossSubtitle.textContent = data.subtitle;
  ui.bossBarFill.style.width = "100%";
  ui.bossProgress.classList.add("boss-active");
  ui.bossProgressCount.textContent = "BOSS";
  ui.bossProgressTotal.textContent = String(TOTAL_BOSSES);

  showBossBanner(data);
  SFX.bossSpawn();
}

function showBossBanner(data) {
  ui.bannerZh.textContent = data.zhName;
  ui.bannerDe.textContent = data.deName;
  ui.bannerSubtitle.textContent = data.subtitle;
  ui.bossBanner.classList.remove("show");
  void ui.bossBanner.offsetWidth;
  ui.bossBanner.classList.add("show");
  clearTimeout(showBossBanner._t);
  showBossBanner._t = setTimeout(function () {
    ui.bossBanner.classList.remove("show");
  }, 2200);
}

function updateBoss(dt) {
  const boss = state.boss;
  if (!boss) return;
  boss.moveT += dt;
  boss.spinT += dt;

  // 出場動畫：從遠處滑到目標 z
  if (boss.phase === "intro") {
    boss.introElapsed += dt;
    const target = boss.targetZ;
    boss.group.position.z += (target - boss.group.position.z) * Math.min(1, dt * 1.8);
    boss.group.position.y = 2.5 - 0.8 * Math.min(1, boss.introElapsed / 1.5);
    if (boss.introElapsed >= 1.6) {
      boss.phase = "battle";
    }
  } else if (boss.phase === "battle") {
    const amp = boss.data.moveAmp;
    const freq = boss.data.moveFreq;
    boss.group.position.x = Math.sin(boss.moveT * freq * Math.PI * 2) * amp;
    boss.group.position.z = boss.targetZ + Math.sin(boss.moveT * freq * 1.7) * 0.8;
    boss.group.position.y = 1.7 + Math.sin(boss.moveT * 1.1) * 0.25;
  } else if (boss.phase === "dying") {
    boss.dyingElapsed += dt;
    boss.pivot.rotation.z += dt * 6;
    boss.pivot.rotation.y += dt * 4;
    const s = Math.max(0, 1 - boss.dyingElapsed * 0.8);
    boss.pivot.scale.set(s, s, s);
    boss.group.position.y += dt * 0.3;
    if (Math.random() < 0.3) {
      const off = new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2);
      spawnHitSparks(boss.group.position.clone().add(off), boss.data.accent, 14);
    }
    if (boss.dyingElapsed >= 1.4) {
      finalizeBossDefeat();
    }
    return;
  }

  // 旋轉動畫（不同 Boss 不同效果）
  if (boss.data.id === 1) {
    if (boss.pivot) boss.pivot.rotation.y = boss.spinT * 0.6;
  } else if (boss.data.id === 2) {
    const heads = boss.group.userData.heads;
    if (heads) {
      heads.forEach(function (h, i) {
        h.rotation.y = Math.sin(boss.spinT * 1.2 + i) * 0.3;
      });
    }
  } else if (boss.data.id === 3) {
    const rings = boss.group.userData.rings;
    if (rings) {
      rings.forEach(function (r, i) {
        r.rotation.z = boss.spinT * (1.2 + i * 0.4) * (i % 2 === 0 ? 1 : -1);
      });
    }
    if (boss.pivot) boss.pivot.rotation.y = boss.spinT * 0.4;
  } else if (boss.data.id === 4) {
    const wings = boss.group.userData.wings;
    if (wings) {
      const flap = Math.sin(boss.spinT * 3.0) * 0.3;
      wings[0].rotation.z = -0.2 + flap;
      wings[1].rotation.z = 0.2 - flap;
    }
    const aura = boss.group.userData.aura;
    if (aura) {
      const p = 1.0 + Math.sin(boss.spinT * 1.8) * 0.12;
      aura.scale.set(4.5 * p, 4.5 * p, 1);
      aura.material.opacity = 0.75 + Math.sin(boss.spinT * 2.2) * 0.2;
    }
  }

  // 射擊
  if (boss.phase === "battle") {
    boss.shootTimer -= dt;
    if (boss.shootTimer <= 0) {
      boss.shootTimer = boss.data.shootInterval;
      bossShoot(boss);
    }
  }
}

function bossShoot(boss) {
  const data = boss.data;
  const pp = player.group.position;
  const bp = boss.group.position;
  const dx = pp.x - bp.x;
  const dz = pp.z - bp.z;
  const baseAngle = Math.atan2(dx, dz);

  if (data.pattern === "circle") {
    // 8 發圓形放射
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spawnBossBullet(boss, Math.sin(a), Math.cos(a), data.bulletSpeed, data.accent);
    }
  } else if (data.pattern === "trident") {
    // 三叉向玩家 + 三發連射
    for (const spread of [-0.32, 0, 0.32]) {
      const a = baseAngle + spread;
      spawnBossBullet(boss, Math.sin(a), Math.cos(a), data.bulletSpeed, data.accent);
    }
  } else if (data.pattern === "spiral") {
    // 螺旋：每次 2 顆，角度遞增
    boss.spiralPhase = (boss.spiralPhase + 0.42) % (Math.PI * 2);
    for (let k = 0; k < 2; k++) {
      const a = boss.spiralPhase + k * Math.PI;
      spawnBossBullet(boss, Math.sin(a), Math.cos(a), data.bulletSpeed, data.accent);
    }
  } else if (data.pattern === "heart") {
    // 心形曲線的 12 個點（向玩家方向）
    // parametric heart: x = 16 sin^3 t, y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t
    const points = [];
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      const hx = Math.pow(Math.sin(t), 3);
      const hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
      points.push([hx, hy]);
    }
    for (let i = 0; i < points.length; i++) {
      const [hx, hy] = points[i];
      const a = baseAngle + hx * 0.55;
      const vx = Math.sin(a);
      const vz = Math.cos(a);
      const speedMul = 0.75 + Math.abs(hy) * 0.35;
      spawnBossBullet(boss, vx, vz, data.bulletSpeed * speedMul, data.accent);
    }
  }
  SFX.bossBullet();
}

function spawnBossBullet(boss, vxN, vzN, speed, color) {
  const bp = boss.group.position;
  const geo = new THREE.SphereGeometry(0.22, 10, 8);
  const mat = new THREE.MeshBasicMaterial({ color: color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(bp.x, 1.7, bp.z + 0.5);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.45, depthWrite: false })
  );
  mesh.add(glow);
  scene.add(mesh);

  bossBullets.push({
    mesh: mesh,
    velocity: new THREE.Vector3(vxN * speed, 0, vzN * speed),
    life: 4.0,
    damage: boss.data.bulletDamage,
    dead: false,
  });
}

function removeBossBullet(b) {
  if (b.dead) return;
  b.dead = true;
  scene.remove(b.mesh);
  b.mesh.traverse(function (o) {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material && o.material.dispose) o.material.dispose();
  });
}

function updateBossBullets(dt) {
  const pp = player.group.position;
  for (let i = 0; i < bossBullets.length; i++) {
    const b = bossBullets[i];
    if (b.dead) continue;
    b.mesh.position.addScaledVector(b.velocity, dt);
    b.life -= dt;

    // 出場外
    if (b.life <= 0 || b.mesh.position.z > WORLD.DESPAWN_Z + 2 ||
        b.mesh.position.z < WORLD.SPAWN_Z - 8 ||
        Math.abs(b.mesh.position.x) > WORLD.LANE_X_MAX + 4) {
      removeBossBullet(b);
      continue;
    }

    // 擊中玩家
    const dx = b.mesh.position.x - pp.x;
    const dz = b.mesh.position.z - pp.z;
    if (dx * dx + dz * dz < 1.1 * 1.1 && b.mesh.position.z >= WORLD.PLAYER_Z - 1.5 && b.mesh.position.z <= WORLD.PLAYER_Z + 1.5) {
      dealDamageToPlayer(b.damage, "\u9b54\u5f48");
      spawnHitSparks(b.mesh.position.clone(), 0xff88c8, 14);
      removeBossBullet(b);
    }
  }
  for (let i = bossBullets.length - 1; i >= 0; i--) if (bossBullets[i].dead) bossBullets.splice(i, 1);
}

function damageBoss(amount, reason) {
  const boss = state.boss;
  if (!boss || boss.phase !== "battle") return;
  boss.hp = Math.max(0, boss.hp - amount);
  updateBossHud();
  // 小型視覺回饋
  spawnHitSparks(boss.group.position.clone().add(new THREE.Vector3(0, 0.4, 0.6)), boss.data.accent, reason === "big" ? 22 : 6);
  if (reason === "big") SFX.bossBigHit();
  else SFX.bossHit();
  if (boss.hp <= 0) {
    beginBossDefeat();
  }
}

function healBoss(amount) {
  const boss = state.boss;
  if (!boss || boss.phase !== "battle") return;
  boss.hp = Math.min(boss.maxHp, boss.hp + amount);
  updateBossHud();
  spawnHitSparks(boss.group.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff99cc, 10);
}

function updateBossHud() {
  const boss = state.boss;
  if (!boss) return;
  const pct = Math.max(0, boss.hp / boss.maxHp);
  ui.bossBarFill.style.width = (pct * 100) + "%";
}

function beginBossDefeat() {
  const boss = state.boss;
  if (!boss) return;
  boss.phase = "dying";
  SFX.bossDefeat();
  // 清除 Boss 子彈
  for (let i = 0; i < bossBullets.length; i++) removeBossBullet(bossBullets[i]);
  bossBullets.length = 0;
}

function finalizeBossDefeat() {
  const boss = state.boss;
  if (!boss) return;
  // 移除 3D 模型
  scene.remove(boss.group);
  boss.group.traverse(function (o) {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (let j = 0; j < mats.length; j++) {
        if (mats[j].map && mats[j].map.dispose) mats[j].map.dispose();
        if (mats[j].dispose) mats[j].dispose();
      }
    }
  });
  // 獎勵：分數、回血、火力
  const bonus = 500 + boss.data.id * 200;
  addScore(bonus);
  state.hp = Math.min(state.maxHp, state.hp + Math.round(state.maxHp * 0.4));
  updateHpUI();
  for (let k = 0; k < 2; k++) increaseFirepower();
  showFloatText("\u64ca\u6557 " + boss.data.zhName + " \uff01 +" + bonus, "good");

  state.boss = null;
  state.nextBossIdx++;
  state.correctsSinceBoss = 0;
  updateBossProgressUI();

  if (state.nextBossIdx >= TOTAL_BOSSES) {
    triggerGameWin();
  } else {
    ui.bossHud.classList.add("hidden");
  }
}

function triggerGameWin() {
  state.gameWon = true;
  state.mode = "won";
  ui.bossHud.classList.add("hidden");
  ui.winFinalScore.textContent = state.score;
  ui.winFinalBest.textContent = state.bestScore;
  ui.winFinalKills.textContent = state.kills;
  ui.winPanel.classList.remove("hidden");
  SFX.win();
}

function updateBossProgressUI() {
  if (state.boss) {
    ui.bossProgress.classList.add("boss-active");
    ui.bossProgressCount.textContent = "BOSS";
    return;
  }
  ui.bossProgress.classList.remove("boss-active");
  if (state.nextBossIdx >= TOTAL_BOSSES) {
    ui.bossProgressCount.textContent = "\u2713";
    ui.bossProgressTotal.textContent = TOTAL_BOSSES;
  } else {
    ui.bossProgressCount.textContent = state.correctsSinceBoss;
    ui.bossProgressTotal.textContent = BOSS_TRIGGER_CORRECTS;
  }
}

function clearBossEntities() {
  for (let i = 0; i < bossBullets.length; i++) removeBossBullet(bossBullets[i]);
  bossBullets.length = 0;
  if (state.boss) {
    scene.remove(state.boss.group);
    state.boss.group.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (let j = 0; j < mats.length; j++) {
          if (mats[j].map && mats[j].map.dispose) mats[j].map.dispose();
          if (mats[j].dispose) mats[j].dispose();
        }
      }
    });
    state.boss = null;
  }
  ui.bossHud.classList.add("hidden");
}

// ==================== Bullets ====================
function spawnBullet(x, y, z, vx) {
  if (vx === undefined) vx = 0;
  const geo = new THREE.CapsuleGeometry(0.09, 0.4, 4, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);

  const glowGeo = new THREE.SphereGeometry(0.26, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd280, transparent: true, opacity: 0.55, depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  mesh.add(glow);

  scene.add(mesh);

  const velocity = new THREE.Vector3(vx, 0, -BULLET_SPEED);
  bullets.push({
    mesh: mesh,
    velocity: velocity,
    life: BULLET_LIFE,
    dead: false,
    damage: 10 + (state.firepower - 1) * 2,
  });
}

function fireShots() {
  const fp = state.firepower;
  const px = player.group.position.x;
  const py = player.group.position.y + 0.1;
  const pz = player.group.position.z - 1.2;

  if (fp === 1) {
    spawnBullet(px, py, pz, 0);
  } else if (fp === 2) {
    spawnBullet(px - 0.22, py, pz, 0);
    spawnBullet(px + 0.22, py, pz, 0);
  } else if (fp === 3) {
    spawnBullet(px, py, pz, 0);
    spawnBullet(px - 0.35, py, pz, 0);
    spawnBullet(px + 0.35, py, pz, 0);
  } else if (fp === 4) {
    spawnBullet(px, py, pz, 0);
    spawnBullet(px - 0.22, py, pz, -3.0);
    spawnBullet(px + 0.22, py, pz, 3.0);
  } else {
    spawnBullet(px, py, pz, 0);
    spawnBullet(px - 0.3, py, pz, -2.8);
    spawnBullet(px + 0.3, py, pz, 2.8);
    spawnBullet(px - 0.55, py, pz, -6.0);
    spawnBullet(px + 0.55, py, pz, 6.0);
  }
  SFX.shoot();
}

function removeBullet(b) {
  if (b.dead) return;
  b.dead = true;
  scene.remove(b.mesh);
  if (b.mesh.geometry && b.mesh.geometry.dispose) b.mesh.geometry.dispose();
  if (b.mesh.material && b.mesh.material.dispose) b.mesh.material.dispose();
  for (let i = 0; i < b.mesh.children.length; i++) {
    const c = b.mesh.children[i];
    if (c.geometry && c.geometry.dispose) c.geometry.dispose();
    if (c.material && c.material.dispose) c.material.dispose();
  }
}

// ==================== Particles ====================
function spawnHitSparks(position, color, count) {
  if (color === undefined) color = 0xffd280;
  if (count === undefined) count = 10;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 5, 4);
    const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(position);
    const speed = 3 + Math.random() * 4;
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.2) * 2,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed);
    scene.add(m);
    sparks.push({ mesh: m, velocity: dir, life: 0.45 });
  }
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.mesh.position.addScaledVector(s.velocity, dt);
    s.velocity.y -= 9 * dt;
    s.life -= dt;
    s.mesh.material.opacity = Math.max(0, s.life / 0.45);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      if (s.mesh.geometry.dispose) s.mesh.geometry.dispose();
      if (s.mesh.material.dispose) s.mesh.material.dispose();
      sparks.splice(i, 1);
    }
  }
}

function updateEngineTrail(dt) {
  if (state.mode === "playing" && Math.random() < 0.7) {
    const geo = new THREE.SphereGeometry(0.09 + Math.random() * 0.05, 5, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.35 ? 0xff6040 : 0xffb86b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      player.group.position.x + (Math.random() - 0.5) * 0.12,
      player.group.position.y + 0.05,
      player.group.position.z + 1.2
    );
    scene.add(m);
    trail.push({
      mesh: m,
      life: 0.4 + Math.random() * 0.2,
      maxLife: 0.5,
      vz: 8 + Math.random() * 3,
    });
  }

  for (let i = trail.length - 1; i >= 0; i--) {
    const t = trail[i];
    t.mesh.position.z += t.vz * dt;
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / t.maxLife);
    t.mesh.scale.multiplyScalar(0.97);
    if (t.life <= 0 || t.mesh.position.z > WORLD.DESPAWN_Z + 4) {
      scene.remove(t.mesh);
      if (t.mesh.geometry.dispose) t.mesh.geometry.dispose();
      if (t.mesh.material.dispose) t.mesh.material.dispose();
      trail.splice(i, 1);
    }
  }
}

// ==================== Player update ====================
function getVisibleHalfWidthAtPlayer() {
  const aspect = window.innerWidth / window.innerHeight;
  // Approximate camera-forward distance from camera to player
  const distForward = 13.5;
  const halfHeight = distForward * Math.tan((camera.fov * Math.PI / 180) / 2);
  return halfHeight * aspect;
}

function clampPlayerX(x) {
  const visBound = getVisibleHalfWidthAtPlayer() - 0.9;
  const bound = Math.min(WORLD.LANE_X_MAX, Math.max(2.0, visBound));
  return Math.max(-bound, Math.min(bound, x));
}

function updatePlayer(dt) {
  const lerp = Math.min(1, 12 * dt);
  const before = player.x;
  player.x += (player.targetX - player.x) * lerp;
  const vx = player.targetX - before;
  player.group.position.x = player.x;

  player.hoverPhase += dt * 3;
  player.group.position.y = WORLD.PLAYER_Y + Math.sin(player.hoverPhase) * 0.06;

  const tilt = Math.max(-0.5, Math.min(0.5, -vx * 0.35));
  player.group.rotation.z += (tilt - player.group.rotation.z) * Math.min(1, 10 * dt);
  const yaw = Math.max(-0.2, Math.min(0.2, -vx * 0.15));
  player.group.rotation.y += (yaw - player.group.rotation.y) * Math.min(1, 10 * dt);

  if (player.engineGlow) {
    player.engineGlow.material.opacity = 0.7 + Math.random() * 0.25;
    player.engineGlow.scale.setScalar(0.9 + Math.random() * 0.2);
  }

  playerLight.position.set(player.x, 4, WORLD.PLAYER_Z);
}

// ==================== Main update ====================
function update(dt) {
  // Scroll ground forever (even on start panel)
  if (groundTex) groundTex.offset.y -= dt * 0.55;

  // Always let the player plane idle-hover/tilt so the menu looks alive.
  updatePlayer(Math.min(dt, 0.033));
  updateEngineTrail(dt);

  if (state.mode !== "playing") return;

  const fireInterval = getFireInterval();
  state.lastFire += dt;
  if (state.lastFire >= fireInterval) {
    state.lastFire = 0;
    fireShots();
  }

  state.lastDoorSpawn += dt;
  if (state.lastDoorSpawn >= DIFF.doorSpawnInterval && !hasLiveDoor()) {
    state.lastDoorSpawn = 0;
    spawnDoorPair();
  }

  state.lastEnemySpawn += dt;
  // Boss 在場時大幅減少小兵（避免彈幕過度密集）
  const enemyCap = state.boss ? 2 : 8;
  const spawnIntervalMul = state.boss ? 2.2 : 1.0;
  if (state.lastEnemySpawn >= DIFF.enemySpawnInterval * spawnIntervalMul) {
    state.lastEnemySpawn = 0;
    if (enemies.length < enemyCap) enemies.push(createEnemy());
  }

  // 頭目更新 + Boss 子彈
  if (state.boss) updateBoss(dt);
  updateBossBullets(dt);

  // 火圈：朝玩家前進 + 旋轉火焰 + 光暈閃動 + 火花繞行
  const now = performance.now();
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.dead) continue;
    d.lastZ = d.group.position.z;
    d.group.position.z += DIFF.doorSpeed * dt;
    d.spinPhase += dt * 1.2;
    if (d.outerTorus) d.outerTorus.rotation.z = d.spinPhase;
    if (d.innerTorus) d.innerTorus.rotation.z = -d.spinPhase * 1.6;
    const pulse = 0.75 + 0.25 * Math.sin(now * 0.006 + d.pairId);
    if (d.group.userData.glow) {
      d.group.userData.glow.material.opacity = 0.55 * pulse;
    }
    if (d.group.userData.halo) {
      d.group.userData.halo.material.opacity = 0.08 + 0.08 * pulse;
    }
    const sparks = d.group.userData.sparks;
    if (sparks) {
      for (let s = 0; s < sparks.length; s++) {
        const sp = sparks[s];
        const ang = sp.userData.angle + d.spinPhase * 0.6;
        const radialPulse = WORLD.GATE_RADIUS + Math.sin(now * 0.008 + sp.userData.phase) * 0.06;
        sp.position.set(Math.cos(ang) * radialPulse, Math.sin(ang) * radialPulse, 0.1);
        sp.material.opacity = 0.55 + 0.35 * Math.sin(now * 0.012 + sp.userData.phase);
      }
    }
  }

  // Enemies move + weave, and despawn if they fly past the player
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dead) continue;
    e.weaveT += dt * 1.5;
    e.group.position.x += Math.cos(e.weaveT) * e.weaveX * dt * 4;
    e.group.position.x = Math.max(
      WORLD.LANE_X_MIN,
      Math.min(WORLD.LANE_X_MAX, e.group.position.x)
    );
    e.group.position.z += e.speed * dt;
    e.group.position.y = 1.6 + Math.sin(e.weaveT * 0.7) * 0.08;
    e.group.rotation.z = Math.sin(e.weaveT) * 0.12;

    if (e.group.position.z > WORLD.DESPAWN_Z) {
      // Flew past player without colliding — escape, no damage but break combo.
      removeEnemy(e);
      if (state.combo > 0) {
        state.combo = 0;
        updateComboUI();
      }
    }
  }

  // Bullets
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (b.dead) continue;
    b.mesh.position.addScaledVector(b.velocity, dt);
    b.life -= dt;
    if (
      b.life <= 0 ||
      b.mesh.position.z < WORLD.SPAWN_Z - 8 ||
      b.mesh.position.z > WORLD.DESPAWN_Z + 2
    ) {
      removeBullet(b);
    }
  }

  checkBulletCollisions();
  checkPlayerEnemyCollisions();
  checkGatePassage();

  pruneDead(doors);
  pruneDead(enemies);
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead) bullets.splice(i, 1);

  updateSparks(dt);
}

function pruneDead(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].dead) arr.splice(i, 1);
}

function hasLiveDoor() {
  for (let i = 0; i < doors.length; i++) if (!doors[i].dead) return true;
  return false;
}

function getFireInterval() {
  const base = 0.40;
  const fp = Math.max(1, Math.min(state.firepower, state.maxFirepower));
  return Math.max(0.14, base - (fp - 1) * 0.055);
}

// ==================== Collisions ====================
function checkBulletCollisions() {
  // 子彈會直接穿過火圈（不造成傷害），只檢查敵機 / Boss
  const boss = state.boss;
  for (let bi = 0; bi < bullets.length; bi++) {
    const b = bullets[bi];
    if (b.dead) continue;
    const bp = b.mesh.position;
    // 擊中 Boss（優先，Boss 碰撞半徑較大）
    if (boss && boss.phase === "battle") {
      const bx = boss.group.position.x;
      const by = boss.group.position.y;
      const bz = boss.group.position.z;
      const dx = bx - bp.x;
      const dy = by - bp.y;
      const dz = bz - bp.z;
      if (dx * dx + dy * dy + dz * dz < (1.5 * boss.data.scale) * (1.5 * boss.data.scale)) {
        spawnHitSparks(bp.clone(), boss.data.accent, 5);
        removeBullet(b);
        damageBoss(Math.max(2, Math.floor((b.damage || 10) * 0.45)), "small");
        continue;
      }
    }
    for (let ei = 0; ei < enemies.length; ei++) {
      const e = enemies[ei];
      if (e.dead) continue;
      const dx = e.group.position.x - bp.x;
      const dy = e.group.position.y - bp.y;
      const dz = e.group.position.z - bp.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1.0) {
        onBulletHitEnemy(b, e);
        break;
      }
    }
  }
}

function checkPlayerEnemyCollisions() {
  const pp = player.group.position;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dead) continue;
    const dx = e.group.position.x - pp.x;
    const dz = e.group.position.z - pp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.15 && e.group.position.z > WORLD.PLAYER_Z - 2) {
      dealDamageToPlayer(DIFF.enemyContactDmg, "\u78b0\u649e");
      spawnHitSparks(e.group.position.clone(), 0xff8a5c, 18);
      removeEnemy(e);
      state.combo = 0;
      updateComboUI();
      SFX.kill();
    }
  }
}

// 戰機穿越火圈判定：偵測火圈「剛越過玩家 z 平面」的瞬間是否位於環內
function checkGatePassage() {
  const pp = player.group.position;

  // 第一步：幫每扇門標注 passed 狀態（through / missed）
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.dead || d.passed !== null) continue;
    const prevZ = d.lastZ;
    const curZ = d.group.position.z;
    if (prevZ < pp.z && curZ >= pp.z) {
      const dx = pp.x - d.group.position.x;
      const dy = pp.y - d.group.position.y;
      const distSq = dx * dx + dy * dy;
      const R = WORLD.GATE_RADIUS;
      d.passed = distSq < R * R * 1.05 ? "through" : "missed";
    } else if (curZ > WORLD.DESPAWN_Z) {
      d.passed = "missed";
    }
  }

  // 第二步：以 pair 為單位裁決
  const pairMap = {};
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.dead) continue;
    const k = d.pairId;
    if (!pairMap[k]) pairMap[k] = [];
    pairMap[k].push(d);
  }
  for (const k in pairMap) {
    const arr = pairMap[k];
    let through = null;
    let allResolved = true;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].passed === "through") through = arr[i];
      if (arr[i].passed === null) allResolved = false;
    }
    if (through) {
      resolveGatePair(+k, through.isCorrect ? "correct" : "wrong", through.group.position.clone());
    } else if (allResolved) {
      // 全部都在戰機兩側滑過 → 沒選到任何火圈
      resolveGatePair(+k, "miss", null);
    }
  }
}

function resolveGatePair(pairId, outcome, worldPos) {
  if (outcome === "correct") {
    state.combo++;
    addScore(150 + state.combo * 15);
    healPlayer(DIFF.correctDoorHeal);
    increaseFirepower();
    flashQuestion(true);
    showComboToast(state.combo);
    if (worldPos) spawnHitSparks(worldPos, 0xffd060, 28);
    SFX.correct();
    // ── 頭目系統：答對 → 若 Boss 在場，對 Boss 重創；否則累計進度，達標時 spawn 下個 Boss ──
    if (state.boss) {
      damageBoss(Math.round(state.boss.maxHp * 0.22), "big");
    } else if (state.nextBossIdx < TOTAL_BOSSES) {
      state.correctsSinceBoss++;
      updateBossProgressUI();
      if (state.correctsSinceBoss >= BOSS_TRIGGER_CORRECTS) {
        spawnBoss(state.nextBossIdx);
      }
    }
  } else if (outcome === "wrong") {
    state.combo = 0;
    dealDamageToPlayer(DIFF.wrongDoorDmg, "\u932f\u706b\u5708");
    decreaseFirepower();
    flashQuestion(false);
    if (worldPos) spawnHitSparks(worldPos, 0xff5544, 24);
    // Boss 在場 → 穿錯火圈會幫 Boss 回血
    if (state.boss) {
      healBoss(Math.round(state.boss.maxHp * 0.1));
      showFloatText("Boss \u56de\u8840\uff01", "bad");
    }
    SFX.wrong();
  } else {
    // miss：兩個火圈都擦身而過
    state.combo = 0;
    dealDamageToPlayer(DOOR_MISS_DMG, "\u932f\u904e");
    SFX.miss();
  }

  removeDoorPair(pairId);
  state.currentPair = null;
  updateQuestionBoardWaiting();
  updateComboUI();
}

function onBulletHitEnemy(b, e) {
  spawnHitSparks(b.mesh.position.clone(), 0xffc857, 6);
  removeBullet(b);
  e.hp -= b.damage;
  if (e.hp <= 0) {
    spawnHitSparks(e.group.position.clone(), 0xff6a85, 22);
    addScore(60 + state.combo * 4);
    state.combo++;
    state.kills++;
    updateComboUI();
    removeEnemy(e);
    SFX.kill();
  } else {
    updateEnemyHpSprite(e);
    SFX.hitEnemy();
  }
}

// ==================== Player state ====================
function dealDamageToPlayer(amount) {
  if (state.mode !== "playing") return;
  state.hp = Math.max(0, state.hp - amount);
  updateHpUI();
  showDamageVignette();
  showFloatText("-" + amount, "damage");
  SFX.damage();
  if (state.hp <= 0) {
    SFX.gameOver();
    endGame();
  }
}

function healPlayer(amount) {
  state.hp = Math.min(state.maxHp, state.hp + amount);
  updateHpUI();
  showFloatText("+" + amount, "heal");
  SFX.heal();
}

function increaseFirepower() {
  if (state.firepower < state.maxFirepower) {
    state.firepower++;
    showFloatText("\u706b\u529b Lv" + state.firepower, "power-up");
  }
  updateFpUI();
}

function decreaseFirepower() {
  if (state.firepower > 1) {
    state.firepower--;
    showFloatText("\u706b\u529b Lv" + state.firepower, "power-down");
  }
  updateFpUI();
}

function addScore(n) {
  state.score += n;
  updateScoreUI();
}

// ==================== UI ====================
const ui = {
  hp: document.getElementById("hpText"),
  hpMax: document.getElementById("hpMaxText"),
  hpBar: document.getElementById("hpBarInner"),
  fp: document.getElementById("fpText"),
  fpBar: document.getElementById("fpBarInner"),
  score: document.getElementById("scoreText"),
  best: document.getElementById("bestText"),
  combo: document.getElementById("comboText"),
  comboChip: document.getElementById("comboChip"),
  comboToast: document.getElementById("comboToast"),
  questionBoard: document.getElementById("questionBoard"),
  damageVignette: document.getElementById("damageVignette"),
  sfxBtn: document.getElementById("sfxBtn"),
  bossHud: document.getElementById("bossHud"),
  bossZh: document.getElementById("bossZhName"),
  bossDe: document.getElementById("bossDeName"),
  bossBarFill: document.getElementById("bossBarFill"),
  bossSubtitle: document.getElementById("bossSubtitle"),
  bossProgress: document.getElementById("bossProgress"),
  bossProgressCount: document.getElementById("bossProgressCount"),
  bossProgressTotal: document.getElementById("bossProgressTotal"),
  bossBanner: document.getElementById("bossBanner"),
  bannerZh: document.getElementById("bannerZh"),
  bannerDe: document.getElementById("bannerDe"),
  bannerSubtitle: document.getElementById("bannerSubtitle"),
  winPanel: document.getElementById("winPanel"),
  winFinalScore: document.getElementById("winFinalScore"),
  winFinalBest: document.getElementById("winFinalBest"),
  winFinalKills: document.getElementById("winFinalKills"),
  winRetryBtn: document.getElementById("winRetryBtn"),
};

function updateHpUI() {
  ui.hp.textContent = Math.ceil(state.hp);
  ui.hpMax.textContent = state.maxHp;
  const pct = Math.max(0, state.hp / state.maxHp);
  ui.hpBar.style.width = (pct * 100) + "%";
  ui.hpBar.classList.toggle("low", pct < 0.3);
}

function updateFpUI() {
  ui.fp.textContent = state.firepower;
  ui.fpBar.style.width = ((state.firepower / state.maxFirepower) * 100) + "%";
}

function updateScoreUI() {
  ui.score.textContent = state.score;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    ui.best.textContent = state.bestScore;
    saveBestScore(state.bestScore);
  }
}

function updateComboUI() {
  if (state.combo >= 2) {
    ui.comboChip.style.display = "inline-flex";
    ui.combo.textContent = state.combo;
  } else {
    ui.comboChip.style.display = "none";
  }
}

function showComboToast(n) {
  if (n < 2) return;
  ui.comboToast.textContent = "\u9023\u6bba \u00d7 " + n;
  ui.comboToast.classList.remove("show");
  void ui.comboToast.offsetWidth;
  ui.comboToast.classList.add("show");
  clearTimeout(showComboToast._t);
  showComboToast._t = setTimeout(function () {
    ui.comboToast.classList.remove("show");
  }, 900);
}

function flashQuestion(good) {
  ui.questionBoard.classList.remove("flash-good", "flash-bad");
  void ui.questionBoard.offsetWidth;
  ui.questionBoard.classList.add(good ? "flash-good" : "flash-bad");
}

function showDamageVignette() {
  ui.damageVignette.classList.add("show");
  clearTimeout(showDamageVignette._t);
  showDamageVignette._t = setTimeout(function () {
    ui.damageVignette.classList.remove("show");
  }, 200);
}

function showFloatText(text, cls) {
  const el = document.createElement("div");
  el.className = "float-text " + cls;
  el.style.left = (window.innerWidth / 2) + "px";
  el.style.top = (window.innerHeight * 0.58) + "px";
  el.textContent = text;
  document.getElementById("gameRoot").appendChild(el);
  setTimeout(function () { el.remove(); }, 1000);
}

// ==================== Game flow ====================
function startGame() {
  state.mode = "playing";
  state.hp = state.maxHp;
  state.firepower = 1;
  state.score = 0;
  state.kills = 0;
  state.combo = 0;
  state.lastFire = 0;
  state.lastDoorSpawn = DIFF.doorSpawnInterval - 1.8;
  state.lastEnemySpawn = DIFF.enemySpawnInterval - 2.0;
  // 重置 Boss 進度
  state.boss = null;
  state.nextBossIdx = 0;
  state.correctsSinceBoss = 0;
  state.gameWon = false;

  clearEntities();
  clearBossEntities();
  updateHpUI();
  updateFpUI();
  updateScoreUI();
  updateComboUI();
  updateBossProgressUI();
  ui.best.textContent = state.bestScore;
  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("gameOverPanel").classList.add("hidden");
  document.getElementById("pausePanel").classList.add("hidden");
  if (ui.winPanel) ui.winPanel.classList.add("hidden");

  updateQuestionBoardWaiting();
  spawnDoorPair();
}

function pauseGame() {
  if (state.mode !== "playing") return;
  state.mode = "paused";
  document.getElementById("pausePanel").classList.remove("hidden");
}

function resumeGame() {
  if (state.mode !== "paused") return;
  state.mode = "playing";
  document.getElementById("pausePanel").classList.add("hidden");
  clock.getDelta();
}

function endGame() {
  state.mode = "over";
  document.getElementById("finalScore").textContent = state.score;
  document.getElementById("finalBest").textContent = state.bestScore;
  document.getElementById("finalKills").textContent = state.kills;
  document.getElementById("gameOverPanel").classList.remove("hidden");
}

function clearEntities() {
  const doorCopy = doors.slice();
  for (let i = 0; i < doorCopy.length; i++) removeDoor(doorCopy[i]);
  const enemyCopy = enemies.slice();
  for (let i = 0; i < enemyCopy.length; i++) removeEnemy(enemyCopy[i]);
  const bulletCopy = bullets.slice();
  for (let i = 0; i < bulletCopy.length; i++) removeBullet(bulletCopy[i]);
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i];
    scene.remove(s.mesh);
    if (s.mesh.geometry.dispose) s.mesh.geometry.dispose();
    if (s.mesh.material.dispose) s.mesh.material.dispose();
  }
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    scene.remove(t.mesh);
    if (t.mesh.geometry.dispose) t.mesh.geometry.dispose();
    if (t.mesh.material.dispose) t.mesh.material.dispose();
  }
  doors.length = 0;
  enemies.length = 0;
  bullets.length = 0;
  sparks.length = 0;
  trail.length = 0;
  state.currentPair = null;
}

// ==================== Input ====================
function setTargetXFromClient(clientX) {
  const t = Math.max(0, Math.min(1, clientX / window.innerWidth));
  const visBound = getVisibleHalfWidthAtPlayer() - 0.9;
  const bound = Math.min(WORLD.LANE_X_MAX, Math.max(2.0, visBound));
  player.targetX = -bound + t * bound * 2;
}

function onPointerMove(e) {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  setTargetXFromClient(clientX);
}

function onPointerDown(e) {
  if (e.touches) onPointerMove(e);
  if (state.mode === "playing") state.lastFire = getFireInterval(); // fire immediately
}

canvas.addEventListener("mousemove", onPointerMove);
canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("touchstart", function (e) { e.preventDefault(); onPointerDown(e); }, { passive: false });
canvas.addEventListener("touchmove", function (e) { e.preventDefault(); onPointerMove(e); }, { passive: false });

document.getElementById("pauseBtn").addEventListener("click", function () {
  if (state.mode === "playing") pauseGame();
  else if (state.mode === "paused") resumeGame();
});
document.getElementById("resumeBtn").addEventListener("click", resumeGame);
document.getElementById("quitBtn").addEventListener("click", function () {
  state.mode = "start";
  document.getElementById("pausePanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  clearEntities();
});
document.getElementById("startBtn").addEventListener("click", function () {
  const ctx = ensureAudio();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});
  startGame();
});
document.getElementById("retryBtn").addEventListener("click", function () {
  const ctx = ensureAudio();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});
  startGame();
});
if (ui.winRetryBtn) {
  ui.winRetryBtn.addEventListener("click", function () {
    const ctx = ensureAudio();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});
    startGame();
  });
}

ui.sfxBtn.addEventListener("click", function () {
  state.sfxOn = !state.sfxOn;
  saveSfxOn(state.sfxOn);
  ui.sfxBtn.textContent = state.sfxOn ? "\ud83d\udd0a" : "\ud83d\udd07";
});
ui.sfxBtn.textContent = state.sfxOn ? "\ud83d\udd0a" : "\ud83d\udd07";

window.addEventListener("keydown", function (e) {
  if (e.code === "Escape" || e.code === "KeyP") {
    if (state.mode === "playing") pauseGame();
    else if (state.mode === "paused") resumeGame();
  }
  if (e.code === "Space" && state.mode === "start") startGame();
  if (state.mode === "playing") {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      player.targetX = clampPlayerX(player.targetX - 1.3);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      player.targetX = clampPlayerX(player.targetX + 1.3);
    }
  }
});

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  player.targetX = clampPlayerX(player.targetX);
});

// ==================== Init UI ====================
if (questionPool.length < 2) {
  document.getElementById("startMessage").textContent =
    "\u984c\u5eab\u8cc7\u6599\u4e0d\u8db3\uff0c\u8acb\u5148\u81f3\u300c\u8a2d\u5b9a\u300d\u555f\u7528\u81f3\u5c11\u4e00\u7d44\u984c\u76ee\u3002";
}

ui.best.textContent = state.bestScore;
updateHpUI();
updateFpUI();
updateScoreUI();

// ==================== Main loop ====================
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

preventZoom();
tick();

// ==================== Mark ready ====================
(function markReady() {
  const btn = document.getElementById("startBtn");
  const status = document.getElementById("loadStatus");
  const details = document.getElementById("errorDetails");
  const errorLog = document.getElementById("errorLog");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "\u958b\u59cb\u904a\u6232";
  }
  if (status) {
    status.textContent = "";
    status.style.color = "";
  }
  if (details && errorLog) {
    const log = errorLog.textContent || "";
    if (!/\[.*:\d+\]|Promise/.test(log)) {
      details.style.display = "none";
      details.open = false;
      errorLog.textContent = "";
    }
  }
  window.__gameReady = true;

  // Auto-start via URL hint (useful for headless testing / demo links)
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("autostart") === "1" && btn && !btn.disabled) {
      setTimeout(function () { btn.click(); }, 100);
    }
  } catch (_) { /* noop */ }
})();
