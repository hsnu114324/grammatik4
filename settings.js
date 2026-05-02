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

  let active = new Set(loadActiveGroups());
  let difficulty = loadDifficulty();
  let mode = loadQuestionMode();
  let sfxOn = loadSfxOn();

  // ── 題庫群組 ──
  function renderGroups() {
    groupBar.innerHTML = "";
    data.groups.forEach((grp, idx) => {
      const sampleRows = grp.slice(0, 2);
      const sampleItems = [];
      for (const r of sampleRows) {
        const arr = parseRowForGroup(r, idx);
        if (arr.length) sampleItems.push(arr[0].zh);
        else sampleItems.push(String(r).split(",")[0]);
      }
      const sample = sampleItems.join("、");
      // 預估展開後的題數（只算一個 sample 平均，以免預覽太慢）
      let rowCount = grp.length;
      if (idx >= 2) {
        let total = 0;
        for (const r of grp) total += parseRowForGroup(r, idx).length;
        rowCount = total;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "group-btn" + (active.has(idx) ? " active" : "");
      btn.dataset.group = String(idx);
      btn.innerHTML = `<div>群組 ${idx + 1}（${rowCount} 筆）</div><small>${escapeHtml(sample)}…</small>`;
      btn.addEventListener("click", () => {
        if (active.has(idx)) active.delete(idx);
        else active.add(idx);
        if (active.size === 0) {
          // 不允許全空
          active.add(idx);
        }
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
    active = new Set([0, 1]);
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
