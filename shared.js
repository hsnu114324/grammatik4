/* ═══════════════════════════════════════════════════════
   shared.js — 德文 3D 射擊遊戲共用工具
   ═══════════════════════════════════════════════════════ */

// ── localStorage 鍵值 ──
const STORAGE_KEYS = {
  ACTIVE_GROUPS: "ger_shooter_active_groups_v1",
  DIFFICULTY: "ger_shooter_difficulty_v1",
  QUESTION_MODE: "ger_shooter_question_mode_v1", // "zh2de" | "de2zh"
  SFX_ON: "ger_shooter_sfx_v1",
  BEST_SCORE: "ger_shooter_best_score_v1",
  STATS: "ger_shooter_stats_v1",
};

// ── CJK 偵測 ──
const CJK_REGEX = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef\u2600-\u27ff\u30a0-\u30ff\u3040-\u309f？！。，、：；「」『』─－]/;
// 拉丁字母（含德文變音符號）
const LATIN_REGEX = /[A-Za-zÄÖÜäöüß]/;

/**
 * 解析一列資料：
 *   "中文,German1,German2,..."        → { zh, de }
 *   "中文German1,German2,..."          → { zh, de }   ← 中文與德文緊貼
 *   "中文/別名,German1,German2,..."    → { zh, de }   ← 中文內部含 / 或 空格
 * 底線會被視為空格（例如 "ich_bin_ein"）。
 */
function parseRow(row) {
  if (typeof row !== "string") return null;
  const cleaned = row.replace(/_/g, " ").trim();
  if (!cleaned) return null;
  const rawParts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (rawParts.length < 2) return null;

  const first = rawParts[0];
  // 第一個拉丁字母的位置（德文一定以拉丁字母開頭）
  const latinIdx = first.search(LATIN_REGEX);
  let zh, firstGerman;
  if (latinIdx < 0) {
    // 第一欄沒有拉丁字母：純中文
    zh = first;
    firstGerman = "";
  } else if (latinIdx === 0) {
    // 第一欄沒有中文，不是合法題目
    return null;
  } else {
    zh = first.slice(0, latinIdx).trim().replace(/[,，;；\/／]+$/, "").trim();
    firstGerman = first.slice(latinIdx).trim();
  }

  // 若切出來的 zh 完全沒有 CJK，也視為不合法
  if (!zh || !CJK_REGEX.test(zh)) return null;

  const germanParts = [];
  if (firstGerman) germanParts.push(firstGerman);
  for (let i = 1; i < rawParts.length; i++) {
    germanParts.push(rawParts[i]);
  }
  if (!germanParts.length) return null;

  // 判斷「動詞變化表」vs「完整句子」：
  //   · 動詞變化表：任一子欄位自帶空格（例如 "fährt ab"、"ist gegangen"），
  //     此時只取第一欄（原形）當作顯示答案。
  //   · 完整句子：每個子欄位都是單字，拼回成完整句子。
  const isConjugationTable = germanParts.some((p) => /\s/.test(p));
  let de;
  if (isConjugationTable) {
    de = germanParts[0].trim();
  } else {
    de = germanParts.join(" ").replace(/\s+/g, " ").trim();
  }
  if (!de) return null;
  return { zh, de };
}

// ── 變格表展開 ──────────────────────────────────────────
// 群組 3/4/5 的資料格式是「標籤,Nom.,Gen.,Dat.,Akk.」，
// 這是德文的四格變化表（Kasusdeklination）。直接當成單題會讓題目模糊，
// 所以把每一行展開成「四個格 × 去重 × 過濾空/-」的多個題目。

const DECLENSION_CASES = [
  { key: "Nom.", zh: "\u7b2c1\u683c Nominativ" },
  { key: "Gen.", zh: "\u7b2c2\u683c Genitiv" },
  { key: "Dat.", zh: "\u7b2c3\u683c Dativ" },
  { key: "Akk.", zh: "\u7b2c4\u683c Akkusativ" },
];

// 物主代詞：標籤第一字 = 名詞陰陽性（der/das/die/pl.），第二字 = 擁有者
const POSSESSIVE_OWNER_ZH = {
  ich: "\u6211\u7684", du: "\u4f60\u7684",
  er: "\u4ed6\u7684", sie: "\u5979\u7684 / \u4ed6\u5011\u7684",
  es: "\u5b83\u7684", wir: "\u6211\u5011\u7684",
  ihr: "\u4f60\u5011\u7684", Sie: "\u60a8\u7684",
};

const GENDER_ZH = {
  der: "\u967d\u6027\u540d\u8a5e", das: "\u4e2d\u6027\u540d\u8a5e",
  die: "\u9670\u6027\u540d\u8a5e", "pl.": "\u8907\u6578\u540d\u8a5e",
  "\u967d\u6027": "\u967d\u6027\u540d\u8a5e", "\u4e2d\u6027": "\u4e2d\u6027\u540d\u8a5e",
  "\u9670\u6027": "\u9670\u6027\u540d\u8a5e", "\u8907\u6578": "\u8907\u6578\u540d\u8a5e",
};

const ARTICLE_ZH = {
  der: "\u5b9a\u51a0\u8a5e der", das: "\u5b9a\u51a0\u8a5e das", die: "\u5b9a\u51a0\u8a5e die",
  ein: "\u4e0d\u5b9a\u51a0\u8a5e ein", eine: "\u4e0d\u5b9a\u51a0\u8a5e eine",
  kein: "\u5426\u5b9a\u51a0\u8a5e kein", keine: "\u5426\u5b9a\u51a0\u8a5e keine",
  welcher: "\u7591\u554f\u51a0\u8a5e welcher", welches: "\u7591\u554f\u51a0\u8a5e welches", welche: "\u7591\u554f\u51a0\u8a5e welche",
  dieser: "\u6307\u793a\u4ee3\u8a5e dieser", dieses: "\u6307\u793a\u4ee3\u8a5e dieses", diese: "\u6307\u793a\u4ee3\u8a5e diese",
  "-": "\u7121\u51a0\u8a5e",
};

function splitDeclensionRow(row) {
  if (typeof row !== "string") return null;
  const cleaned = row.replace(/_/g, " ").trim();
  if (!cleaned) return null;
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 5) return null;
  return parts;
}

function buildDeclensionZh(label, caseZh, kind) {
  const lbl = String(label).trim();
  if (kind === "possessive") {
    // "der ich" / "das du" / "die er" / "pl. sie"
    const m = lbl.match(/^(der|das|die|pl\.)\s+(\S+)$/);
    if (!m) return lbl + " \u00b7 " + caseZh;
    const gender = GENDER_ZH[m[1]] || m[1];
    const owner = POSSESSIVE_OWNER_ZH[m[2]] || (m[2] + "\u7684");
    return `${owner} \u00b7 ${gender} \u00b7 ${caseZh}`;
  }
  if (kind === "article_noun" || kind === "adjective_ending") {
    // "陽性 der" / "中性 ein" / "陰性 keine" / "複數 die"
    const m = lbl.match(/^(\u967d\u6027|\u4e2d\u6027|\u9670\u6027|\u8907\u6578)\s+(\S+)$/);
    if (!m) return lbl + " \u00b7 " + caseZh;
    const gender = GENDER_ZH[m[1]] || m[1];
    const art = ARTICLE_ZH[m[2]] || m[2];
    if (kind === "adjective_ending") {
      return `${gender} \u00b7 ${art} + \u5f62\u5bb9\u8a5e\u8a5e\u5c3e \u00b7 ${caseZh}`;
    }
    return `${gender} \u00b7 ${art} \u00b7 ${caseZh}`;
  }
  return lbl + " \u00b7 " + caseZh;
}

function expandDeclensionRow(row, kind) {
  const parts = splitDeclensionRow(row);
  if (!parts) return [];
  const label = parts[0];
  const answers = [parts[1], parts[2], parts[3], parts[4]];
  const result = [];
  const seenAnswers = new Set();
  for (let i = 0; i < 4; i++) {
    const de = (answers[i] || "").trim();
    if (!de || de === "-") continue;
    if (seenAnswers.has(de)) continue;
    seenAnswers.add(de);
    const zh = buildDeclensionZh(label, DECLENSION_CASES[i].zh, kind);
    // caseIdx: 0=Nom, 1=Gen, 2=Dat, 3=Akk；caseKey: "Nom." / "Gen." / "Dat." / "Akk."
    result.push({
      zh,
      de,
      caseIdx: i,
      caseKey: DECLENSION_CASES[i].key,
    });
  }
  return result;
}

// ── 群組 index → 解析策略 ─────────────────────────────────
// 群組 1 (idx 0)、群組 2 (idx 1)：一般句子／動詞變化表，用 parseRow
// 群組 3 (idx 2)：物主代詞變格
// 群組 4 (idx 3)：冠詞 + 名詞變格
// 群組 5 (idx 4)：形容詞詞尾變格
function parseRowForGroup(row, groupIdx) {
  if (groupIdx === 2) return expandDeclensionRow(row, "possessive");
  if (groupIdx === 3) return expandDeclensionRow(row, "article_noun");
  if (groupIdx === 4) return expandDeclensionRow(row, "adjective_ending");
  const parsed = parseRow(row);
  return parsed ? [parsed] : [];
}

/**
 * 從所有啟用群組中產生題目池（平坦陣列）。
 */
function buildQuestionPool(activeGroups) {
  const pool = [];
  const data = window.GERMAN_WORDS_DATA;
  if (!data || !Array.isArray(data.groups)) return pool;
  const set = new Set(activeGroups);
  data.groups.forEach((group, idx) => {
    if (!set.has(idx)) return;
    group.forEach((row) => {
      const items = parseRowForGroup(row, idx);
      for (const p of items) pool.push({ ...p, group: idx });
    });
  });
  return pool;
}

// ── localStorage helper ──
// 設定頁目前只列出群組 3/4/5（變格練習）。預設全部啟用，確保題庫最豐富。
const DEFAULT_ACTIVE_GROUPS = [2, 3, 4];
function loadActiveGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_GROUPS);
    if (!raw) return DEFAULT_ACTIVE_GROUPS.slice();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ACTIVE_GROUPS.slice();
    // 舊資料如果含 0/1 也過濾掉（設定頁已不顯示它們）
    const filtered = parsed.filter((n) => Number.isInteger(n) && n >= 2);
    return filtered.length ? filtered : DEFAULT_ACTIVE_GROUPS.slice();
  } catch {
    return DEFAULT_ACTIVE_GROUPS.slice();
  }
}

function saveActiveGroups(groups) {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUPS, JSON.stringify(groups));
}

function loadDifficulty() {
  const v = localStorage.getItem(STORAGE_KEYS.DIFFICULTY);
  if (v === "easy" || v === "normal" || v === "hard") return v;
  return "normal";
}

function saveDifficulty(d) {
  localStorage.setItem(STORAGE_KEYS.DIFFICULTY, d);
}

function loadQuestionMode() {
  const v = localStorage.getItem(STORAGE_KEYS.QUESTION_MODE);
  if (v === "zh2de" || v === "de2zh") return v;
  return "zh2de";
}

function saveQuestionMode(m) {
  localStorage.setItem(STORAGE_KEYS.QUESTION_MODE, m);
}

function loadSfxOn() {
  return localStorage.getItem(STORAGE_KEYS.SFX_ON) !== "0";
}

function saveSfxOn(on) {
  localStorage.setItem(STORAGE_KEYS.SFX_ON, on ? "1" : "0");
}

function loadBestScore() {
  const n = parseInt(localStorage.getItem(STORAGE_KEYS.BEST_SCORE) || "0", 10);
  return Number.isNaN(n) ? 0 : n;
}

function saveBestScore(n) {
  localStorage.setItem(STORAGE_KEYS.BEST_SCORE, String(n));
}

// ── 防止手機雙擊縮放 ──
function preventZoom() {
  document.addEventListener(
    "touchmove",
    (e) => { if (e.touches.length > 1) e.preventDefault(); },
    { passive: false }
  );
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
}

// ── 難度參數 ──
const DIFFICULTY_PRESETS = {
  easy: {
    doorSpeed: 3.0,
    doorSpawnInterval: 5.0,
    enemySpeed: 2.0,
    enemySpawnInterval: 4.0,
    enemyHp: 20,
    enemyContactDmg: 10,
    wrongDoorDmg: 12,
    wrongDoorFirepower: 1,
    correctDoorHeal: 12,
    correctDoorFirepower: 1,
    playerMaxHp: 120,
  },
  normal: {
    doorSpeed: 4.0,
    doorSpawnInterval: 4.0,
    enemySpeed: 2.6,
    enemySpawnInterval: 3.2,
    enemyHp: 30,
    enemyContactDmg: 16,
    wrongDoorDmg: 18,
    wrongDoorFirepower: 1,
    correctDoorHeal: 10,
    correctDoorFirepower: 1,
    playerMaxHp: 100,
  },
  hard: {
    doorSpeed: 5.5,
    doorSpawnInterval: 3.2,
    enemySpeed: 3.4,
    enemySpawnInterval: 2.4,
    enemyHp: 40,
    enemyContactDmg: 22,
    wrongDoorDmg: 26,
    wrongDoorFirepower: 1,
    correctDoorHeal: 8,
    correctDoorFirepower: 1,
    playerMaxHp: 80,
  },
};

// ── 洗牌 ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 把 const / 函式暴露到 window，讓 ES module 腳本（game.js）也能存取 ──
// （classic script 的 top-level const 不會自動掛到 window，modules 讀不到）
if (typeof window !== "undefined") {
  Object.assign(window, {
    STORAGE_KEYS,
    CJK_REGEX,
    LATIN_REGEX,
    DIFFICULTY_PRESETS,
    parseRow,
    parseRowForGroup,
    expandDeclensionRow,
    buildDeclensionZh,
    buildQuestionPool,
    loadActiveGroups,
    saveActiveGroups,
    loadDifficulty,
    saveDifficulty,
    loadQuestionMode,
    saveQuestionMode,
    loadSfxOn,
    saveSfxOn,
    loadBestScore,
    saveBestScore,
    preventZoom,
    shuffle,
    randomChoice,
  });
}
