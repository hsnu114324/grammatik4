/* ═══════════════════════════════════════════════════════
   settings.js — 德文題庫設定頁
   ═══════════════════════════════════════════════════════ */

(function init() {
  preventZoom();

  const groupBar = document.getElementById("groupBtnBar");
  const diffBar = document.getElementById("difficultyBar");
  const modeBar = document.getElementById("modeBar");
  const previewBox = document.getElementById("previewBox");
  const poolCountEl = document.getElementById("poolCount");
  const sfxSwitch = document.getElementById("sfxSwitch");
  const bestScoreEl = document.getElementById("bestScoreText");
  const messageEl = document.getElementById("message");
  const resetBtn = document.getElementById("resetBtn");

  const data = window.GERMAN_WORDS_DATA;
  if (!data || !Array.isArray(data.groups)) {
    setMessage("⚠️ 無法讀取德文題庫檔（data/words-data.js）。", "warn");
    return;
  }

  // 設定頁只露出變格練習（群組 3/4/5）。把舊 active 中 <2 的部分過濾掉。
  const VISIBLE_GROUP_IDX = [2, 3, 4];
  const GROUP_META = {
    2: { title: "\u7fa4\u7d44 3\uff1a\u7269\u4e3b\u4ee3\u8a5e\u8b8a\u683c", subtitle: "Possessivpronomen \u00b7 mein / dein / sein\u2026" },
    3: { title: "\u7fa4\u7d44 4\uff1a\u51a0\u8a5e + \u540d\u8a5e\u8b8a\u683c", subtitle: "Nomen-Deklination \u00b7 der / ein / kein / dieser\u2026" },
    4: { title: "\u7fa4\u7d44 5\uff1a\u5f62\u5bb9\u8a5e\u8a5e\u5c3e\u8b8a\u5316", subtitle: "Adjektivendungen \u00b7 -e / -en / -er \u00b7 \u5f37 / \u5f31 / \u6df7\u5408" },
  };

  let active = new Set(loadActiveGroups().filter((n) => VISIBLE_GROUP_IDX.includes(n)));
  if (active.size === 0) active = new Set([2]);
  saveActiveGroups([...active]);
  let difficulty = loadDifficulty();
  let mode = loadQuestionMode();
  let sfxOn = loadSfxOn();

  // ── 題庫群組 ──
  function renderGroups() {
    groupBar.innerHTML = "";
    VISIBLE_GROUP_IDX.forEach((idx) => {
      const grp = data.groups[idx];
      if (!grp) return;
      const meta = GROUP_META[idx] || { title: `\u7fa4\u7d44 ${idx + 1}`, subtitle: "" };
      const sampleRows = grp.slice(0, 3);
      const sampleItems = [];
      for (const r of sampleRows) {
        const arr = parseRowForGroup(r, idx);
        if (arr.length) sampleItems.push(arr[0].zh);
      }
      const sample = sampleItems.join("\u3001");
      let total = 0;
      for (const r of grp) total += parseRowForGroup(r, idx).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "group-btn" + (active.has(idx) ? " active" : "");
      btn.dataset.group = String(idx);
      btn.innerHTML = `<div>${escapeHtml(meta.title)}<span class="group-count">（${total} 題）</span></div>`
        + `<small class="group-subtitle">${escapeHtml(meta.subtitle)}</small>`
        + `<small>${escapeHtml(sample)}\u2026</small>`;
      btn.addEventListener("click", () => {
        if (active.has(idx)) active.delete(idx);
        else active.add(idx);
        if (active.size === 0) active.add(idx);
        saveActiveGroups([...active]);
        renderGroups();
        renderPreview();
      });
      groupBar.appendChild(btn);
    });
  }

  // ── 難度 ──
  function renderDifficulty() {
    diffBar.querySelectorAll(".pill-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.diff === difficulty);
    });
  }
  diffBar.querySelectorAll(".pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      difficulty = btn.dataset.diff;
      saveDifficulty(difficulty);
      renderDifficulty();
    });
  });

  // ── 模式 ──
  function renderMode() {
    modeBar.querySelectorAll(".pill-btn").forEach((btn) => {
      if (btn.disabled) return;
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }
  modeBar.querySelectorAll(".pill-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      saveQuestionMode(mode);
      renderMode();
    });
  });

  // ── 音效開關 ──
  function renderSfx() {
    sfxSwitch.classList.toggle("on", !!sfxOn);
    sfxSwitch.setAttribute("aria-checked", String(!!sfxOn));
  }
  sfxSwitch.addEventListener("click", () => {
    sfxOn = !sfxOn;
    saveSfxOn(sfxOn);
    renderSfx();
  });

  // ── 預覽 ──
  function renderPreview() {
    const pool = buildQuestionPool([...active]);
    poolCountEl.textContent = pool.length;
    previewBox.innerHTML = "";
    if (pool.length === 0) {
      previewBox.textContent = "（尚未啟用任何群組）";
      return;
    }
    const picks = shuffle(pool).slice(0, 20);
    picks.forEach((q) => {
      const row = document.createElement("div");
      row.className = "preview-row";
      row.innerHTML = `<span class="zh">${escapeHtml(q.zh)}</span><span class="de">${escapeHtml(q.de)}</span>`;
      previewBox.appendChild(row);
    });
  }

  // ── 還原預設 ──
  resetBtn.addEventListener("click", () => {
    if (!confirm("確定要還原為預設設定嗎？")) return;
    active = new Set(VISIBLE_GROUP_IDX);
    difficulty = "normal";
    mode = "zh2de";
    sfxOn = true;
    saveActiveGroups([...active]);
    saveDifficulty(difficulty);
    saveQuestionMode(mode);
    saveSfxOn(sfxOn);
    renderGroups();
    renderDifficulty();
    renderMode();
    renderSfx();
    renderPreview();
    setMessage("已還原為預設設定。", "ok");
  });

  // ── 訊息 ──
  function setMessage(text, tone = "ok") {
    messageEl.textContent = text;
    messageEl.className = "message" + (tone === "ok" ? " ok" : "");
    if (text) {
      clearTimeout(setMessage._t);
      setMessage._t = setTimeout(() => { messageEl.textContent = ""; }, 2500);
    }
  }

  // ── 工具 ──
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  // ── 啟動渲染 ──
  bestScoreEl.textContent = loadBestScore();
  renderGroups();
  renderDifficulty();
  renderMode();
  renderSfx();
  renderPreview();
})();
