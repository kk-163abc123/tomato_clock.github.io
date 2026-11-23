(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE = {
    settings: 'pomodoro.settings.v1',
    tasks: 'pomodoro.tasks.v1',
    session: 'pomodoro.session.v1',
    points: 'pomodoro.points.v1',
    inventory: 'pomodoro.inventory.v1',
    equipped: 'pomodoro.equipped.v1'
  };

  const MODE_TEXT = {
    focus: '专注时间',
    short: '短休息',
    long: '长休息'
  };

  const RING_CIRCUMFERENCE = 2 * Math.PI * 166;

  const defaults = {
    focus: 25,
    short: 5,
    long: 15,
    longEvery: 4
  };

  // 10 款番茄样式：价格按稀有度递增，首款免费
  const SKINS = [
    { id: 'classic', name: '经典红', price: 0, preview: 'radial-gradient(circle at 34% 26%, #ff7a63, #e8503a 55%, #cf402e)' },
    { id: 'strawberry', name: '草莓奶霜', price: 30, preview: 'radial-gradient(circle at 34% 26%, #ffa0bd, #ef5f8d 55%, #d24572)' },
    { id: 'tangerine', name: '蜜橘汽水', price: 45, preview: 'radial-gradient(circle at 34% 26%, #ffb35c, #f2872f 55%, #d66e1d)' },
    { id: 'lemon', name: '柠檬硬糖', price: 60, preview: 'radial-gradient(circle at 34% 26%, #ffe574, #e9c73e 55%, #c9a021)' },
    { id: 'lime', name: '青柠苏打', price: 75, preview: 'radial-gradient(circle at 34% 26%, #b9e071, #82b83e 55%, #69a02c)' },
    { id: 'mint', name: '薄荷冰', price: 90, preview: 'radial-gradient(circle at 34% 26%, #73ded0, #2ba89b 55%, #1d8b80)' },
    { id: 'ocean', name: '海盐蓝', price: 110, preview: 'radial-gradient(circle at 34% 26%, #8fc6f5, #4a8fd8 55%, #3476bb)' },
    { id: 'grape', name: '葡萄紫', price: 135, preview: 'radial-gradient(circle at 34% 26%, #bda2f2, #8b67d6 55%, #7150bd)' },
    { id: 'cocoa', name: '可可棕', price: 160, preview: 'radial-gradient(circle at 34% 26%, #c79a78, #96674c 55%, #7a5038)' },
    { id: 'galaxy', name: '午夜星空', price: 200, preview: 'radial-gradient(2px 2px at 28% 22%, #fff 99%, transparent), radial-gradient(circle at 34% 26%, #6f74c7, #3b3f7d 55%, #22254c)' }
  ];

  // 10 款背景主题
  const BACKGROUNDS = [
    { id: 'cream', name: '暖阳奶油', price: 0, preview: 'linear-gradient(135deg, #fff7f2, #ffe3d4)', dark: false },
    { id: 'sakura', name: '樱花雾', price: 30, preview: 'linear-gradient(135deg, #fff9fb, #ffd6e5)', dark: false },
    { id: 'matcha', name: '抹茶清晨', price: 45, preview: 'linear-gradient(135deg, #f8faf2, #dcecc4)', dark: false },
    { id: 'peach', name: '蜜桃日落', price: 60, preview: 'linear-gradient(135deg, #fffaf4, #ffd9b8)', dark: false },
    { id: 'lavender', name: '薰衣草田', price: 75, preview: 'linear-gradient(135deg, #fbfaff, #e2d9fb)', dark: false },
    { id: 'ocean', name: '海洋微风', price: 95, preview: 'linear-gradient(135deg, #f7fcff, #d3ebf8)', dark: false },
    { id: 'caramel', name: '焦糖布丁', price: 120, preview: 'linear-gradient(135deg, #fffaf2, #f5dcb8)', dark: false },
    { id: 'midnight', name: '蓝莓夜蓝', price: 150, preview: 'linear-gradient(135deg, #3b4374, #222747)', dark: true },
    { id: 'aurora', name: '极光渐变', price: 180, preview: 'linear-gradient(125deg, #e7f6f0, #f2ecff 48%, #fff0e7)', dark: false },
    { id: 'stardust', name: '星河夜空', price: 220, preview: 'radial-gradient(1px 1px at 20% 30%, #fff 99%, transparent), linear-gradient(135deg, #2b3566, #11162f)', dark: true }
  ];

  let settings = load(STORE.settings, defaults);
  let state = {
    mode: 'focus',
    total: settings.focus * 60,
    remaining: settings.focus * 60,
    running: false,
    endTime: null,
    ticker: null
  };

  let soundOn = true;
  let audioCtx = null;
  let focusClean = true; // 本轮专注是否完整完成（未跳过/未重置）
  let shopTab = 'skin';
  let toastTimer = null;

  let points = read(STORE.points, 0);
  if (typeof points !== 'number' || !isFinite(points)) points = 0;
  points = Math.max(0, Math.floor(points));

  let inventory = read(STORE.inventory, null);
  if (!inventory || typeof inventory !== 'object') inventory = {};
  if (!Array.isArray(inventory.skins)) inventory.skins = ['classic'];
  if (!Array.isArray(inventory.bgs)) inventory.bgs = ['cream'];
  if (!inventory.skins.includes('classic')) inventory.skins.push('classic');
  if (!inventory.bgs.includes('cream')) inventory.bgs.push('cream');

  let equipped = read(STORE.equipped, null);
  if (!equipped || typeof equipped !== 'object') equipped = {};
  if (!SKINS.some((s) => s.id === equipped.skin) || !inventory.skins.includes(equipped.skin)) equipped.skin = 'classic';
  if (!BACKGROUNDS.some((b) => b.id === equipped.bg) || !inventory.bgs.includes(equipped.bg)) equipped.bg = 'cream';

  // ---------- 工具 ----------
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
    } catch (e) {
      return { ...fallback };
    }
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 忽略存储失败 */ }
  }

  function clampMinutes(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function fmt(sec) {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- 积分与装扮 ----------
  function renderPoints() {
    $('pointsNum').textContent = String(points);
    $('shopPoints').textContent = String(points);
    $('earnPerTomato').textContent = String(settings.focus);
  }

  function awardPoints(amount) {
    points += amount;
    save(STORE.points, points);
    renderPoints();
    const chip = $('shopBtn');
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  }

  const skinClasses = SKINS.map((s) => `skin-${s.id}`);
  const bgClasses = BACKGROUNDS.map((b) => `bg-${b.id}`);

  function applyLook() {
    document.body.classList.remove(...skinClasses, ...bgClasses, 'dark-bg');
    document.body.classList.add(`skin-${equipped.skin}`, `bg-${equipped.bg}`);
    const bg = BACKGROUNDS.find((b) => b.id === equipped.bg);
    if (bg && bg.dark) document.body.classList.add('dark-bg');
  }

  function openShop(tab) {
    shopTab = tab || 'skin';
    document.querySelectorAll('.shop-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === shopTab);
    });
    renderShop();
    $('shopModal').hidden = false;
  }

  function renderShop() {
    const isSkin = shopTab === 'skin';
    const items = isSkin ? SKINS : BACKGROUNDS;
    const owned = isSkin ? inventory.skins : inventory.bgs;
    const activeId = isSkin ? equipped.skin : equipped.bg;

    $('shopGrid').innerHTML = items.map((item) => {
      const isOwned = owned.includes(item.id);
      const isActive = activeId === item.id;
      let btn;
      if (isActive) {
        btn = '<button class="shop-btn active" disabled>使用中</button>';
      } else if (isOwned) {
        btn = `<button class="shop-btn use" data-action="use" data-type="${shopTab}" data-id="${item.id}">使用</button>`;
      } else if (points >= item.price) {
        btn = `<button class="shop-btn buy" data-action="buy" data-type="${shopTab}" data-id="${item.id}">🍅 ${item.price}</button>`;
      } else {
        btn = `<button class="shop-btn poor" disabled>🍅 ${item.price}</button>`;
      }
      return `
        <div class="shop-item ${isActive ? 'equipped' : ''}">
          <div class="shop-preview ${isSkin ? 'skin' : 'bg'}" style="background:${item.preview}"></div>
          <div class="shop-name">${item.name}</div>
          <div class="shop-price">${item.price === 0 ? '免费' : `🍅 ${item.price} 积分`}</div>
          ${btn}
        </div>`;
    }).join('');
  }

  function buyItem(type, id) {
    const isSkin = type === 'skin';
    const item = (isSkin ? SKINS : BACKGROUNDS).find((i) => i.id === id);
    if (!item) return;
    const owned = isSkin ? inventory.skins : inventory.bgs;
    if (owned.includes(id)) return;
    if (points < item.price) {
      toast('积分不够，再完整完成几个番茄吧');
      return;
    }
    points -= item.price;
    owned.push(id);
    save(STORE.points, points);
    save(STORE.inventory, inventory);
    equipped[type] = id;
    save(STORE.equipped, equipped);
    applyLook();
    renderPoints();
    renderShop();
    toast(`已解锁「${item.name}」并启用`);
  }

  function equipItem(type, id) {
    const owned = type === 'skin' ? inventory.skins : inventory.bgs;
    if (!owned.includes(id)) return;
    equipped[type] = id;
    save(STORE.equipped, equipped);
    applyLook();
    renderShop();
    toast('已切换装扮');
  }

  // ---------- 渲染 ----------
  function render() {
    $('timeDisplay').textContent = fmt(state.remaining);
    $('modeLabel').textContent = MODE_TEXT[state.mode];
    const ratio = state.total > 0 ? state.remaining / state.total : 0;
    $('ringProgress').style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
    $('startText').textContent = state.running ? '暂停' : (state.remaining === state.total ? `开始${state.mode === 'focus' ? '专注' : '休息'}` : '继续');
    $('startIcon').innerHTML = state.running
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    $('tomato').classList.toggle('running', state.running);

    document.body.classList.toggle('mode-short', state.mode === 'short');
    document.body.classList.toggle('mode-long', state.mode === 'long');

    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === state.mode);
    });

    document.title = `${fmt(state.remaining)} · ${MODE_TEXT[state.mode]} · 番茄专注`;
    renderSessions();
  }

  function renderSessions() {
    const data = load(STORE.session, { date: todayKey(), count: 0 });
    const count = data.date === todayKey() ? data.count : 0;
    const dots = Math.min(count, 8);
    $('sessionDots').innerHTML = Array.from({ length: Math.max(4, dots) }, (_, i) =>
      `<span class="dot ${i < dots ? 'done' : ''}"></span>`).join('');
    $('sessionCount').textContent = String(count);
  }

  function bumpSession() {
    const data = load(STORE.session, { date: todayKey(), count: 0 });
    const count = data.date === todayKey() ? data.count + 1 : 1;
    save(STORE.session, { date: todayKey(), count });
    renderSessions();
    return count;
  }

  // ---------- 计时控制 ----------
  function start() {
    if (state.running) return;
    state.running = true;
    state.endTime = Date.now() + state.remaining * 1000;
    state.ticker = setInterval(tick, 200);
    render();
  }

  function pause() {
    if (!state.running) return;
    state.remaining = Math.max(0, (state.endTime - Date.now()) / 1000);
    state.running = false;
    clearInterval(state.ticker);
    state.ticker = null;
    render();
  }

  function tick() {
    state.remaining = Math.max(0, (state.endTime - Date.now()) / 1000);
    if (state.remaining <= 0) {
      clearInterval(state.ticker);
      state.ticker = null;
      state.running = false;
      state.remaining = 0;
      render();
      complete();
      return;
    }
    render();
  }

  function reset() {
    if (state.mode === 'focus' && state.remaining < state.total) focusClean = false;
    clearInterval(state.ticker);
    state.ticker = null;
    state.running = false;
    state.remaining = state.total;
    render();
  }

  function setMode(mode, autoStart) {
    clearInterval(state.ticker);
    state.ticker = null;
    state.running = false;
    state.mode = mode;
    state.total = settings[mode] * 60;
    state.remaining = state.total;
    if (mode === 'focus') focusClean = true;
    if (autoStart) start();
    else render();
  }

  function skip() {
    if (state.mode === 'focus') focusClean = false;
    setMode(state.mode === 'focus' ? 'short' : 'focus', false);
  }

  function complete() {
    const tomato = $('tomato');
    tomato.classList.remove('pulse');
    void tomato.offsetWidth;
    tomato.classList.add('pulse');

    if (soundOn) playChime(state.mode === 'focus');

    let completedCount = null;
    let nextMode = 'focus';
    let earned = 0;
    let wasClean = false;

    if (state.mode === 'focus') {
      completedCount = bumpSession();
      wasClean = focusClean;
      if (wasClean) {
        earned = Math.max(1, Math.round(state.total / 60));
        awardPoints(earned);
      }
      nextMode = completedCount % settings.longEvery === 0 ? 'long' : 'short';
    }

    $('modalEmoji').textContent = state.mode === 'focus' ? '🍅' : '🌿';
    $('modalTitle').textContent = state.mode === 'focus' ? '专注完成！' : '休息结束！';
    $('modalDesc').textContent = state.mode === 'focus'
      ? (wasClean
        ? `这是今天第 ${completedCount} 个番茄，起来活动一下吧。`
        : `这次中途跳过或重置，不计积分。今天是第 ${completedCount} 个番茄。`)
      : '状态恢复了，继续下一段专注吧。';
    const pointsBox = $('modalPoints');
    if (earned > 0) {
      pointsBox.textContent = `+${earned} 积分`;
      pointsBox.hidden = false;
    } else {
      pointsBox.hidden = true;
    }
    $('modalNext').textContent = state.mode === 'focus'
      ? (nextMode === 'long' ? '开始长休息' : '开始短休息')
      : '开始专注';
    $('modal').hidden = false;

    // 切到下一阶段但不自动开始，等用户确认
    setMode(nextMode, false);
  }

  // ---------- 提示音 ----------
  function playChime(isFocus) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const notes = isFocus ? [523.25, 659.25, 783.99] : [659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.16);
        gain.gain.linearRampToValueAtTime(0.22, now + i * 0.16 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.55);
      });
    } catch (e) { /* 浏览器不支持音频时静默 */ }
  }

  // ---------- 任务 ----------
  let tasks = load(STORE.tasks, []);
  if (!Array.isArray(tasks)) tasks = [];

  function renderTasks() {
    const list = $('taskList');
    list.innerHTML = tasks.map((t) => `
      <li class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input class="task-check" type="checkbox" ${t.done ? 'checked' : ''} aria-label="标记完成">
        <span class="task-text">${escapeHtml(t.text)}</span>
        <button class="task-del" title="删除任务" aria-label="删除任务">×</button>
      </li>`).join('');
    const done = tasks.filter((t) => t.done).length;
    $('taskProgress').textContent = `${done}/${tasks.length}`;
    $('emptyHint').style.display = tasks.length ? 'none' : 'block';
  }

  $('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('taskInput');
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now() + Math.random().toString(16).slice(2), text, done: false });
    input.value = '';
    save(STORE.tasks, tasks);
    renderTasks();
  });

  $('taskList').addEventListener('click', (e) => {
    const li = e.target.closest('.task-item');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.classList.contains('task-del')) {
      tasks = tasks.filter((t) => t.id !== id);
    } else if (e.target.classList.contains('task-check')) {
      const task = tasks.find((t) => t.id === id);
      if (task) task.done = e.target.checked;
    } else {
      return;
    }
    save(STORE.tasks, tasks);
    renderTasks();
  });

  // ---------- 事件绑定 ----------
  $('startBtn').addEventListener('click', () => (state.running ? pause() : start()));
  $('resetBtn').addEventListener('click', reset);
  $('skipBtn').addEventListener('click', skip);

  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.mode === state.mode) return;
      if (state.mode === 'focus') focusClean = false;
      setMode(tab.dataset.mode, false);
    });
  });

  $('soundToggle').addEventListener('click', () => {
    soundOn = !soundOn;
    $('soundToggle').classList.toggle('muted', !soundOn);
  });

  $('modalClose').addEventListener('click', () => { $('modal').hidden = true; });
  $('modalNext').addEventListener('click', () => {
    $('modal').hidden = true;
    start();
  });

  // 商店
  $('shopBtn').addEventListener('click', () => openShop('skin'));
  $('shopLink').addEventListener('click', () => openShop('skin'));
  $('shopClose').addEventListener('click', () => { $('shopModal').hidden = true; });
  $('shopModal').addEventListener('click', (e) => {
    if (e.target === $('shopModal')) $('shopModal').hidden = true;
  });
  document.querySelectorAll('.shop-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      shopTab = tab.dataset.tab;
      document.querySelectorAll('.shop-tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
      });
      renderShop();
    });
  });
  $('shopGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'buy') buyItem(btn.dataset.type, btn.dataset.id);
    else if (btn.dataset.action === 'use') equipItem(btn.dataset.type, btn.dataset.id);
  });

  ['focusMin', 'shortMin', 'longMin', 'longEvery'].forEach((id) => {
    $(id).addEventListener('change', () => {
      const min = id === 'longEvery' ? 2 : 1;
      const max = id === 'focusMin' ? 120 : (id === 'longEvery' ? 12 : 60);
      const key = id === 'focusMin' ? 'focus' : id === 'shortMin' ? 'short' : id === 'longMin' ? 'long' : 'longEvery';
      settings[key] = clampMinutes($(id).value, min, max, defaults[key]);
      $(id).value = settings[key];
      save(STORE.settings, settings);
      renderPoints();
      if (!state.running) {
        state.total = settings[state.mode] * 60;
        state.remaining = state.total;
        render();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('shopModal').hidden) { $('shopModal').hidden = true; return; }
      if (!$('modal').hidden) { $('modal').hidden = true; return; }
    }
    if (e.target.tagName === 'INPUT') return;
    if (!$('shopModal').hidden || !$('modal').hidden) return;
    if (e.code === 'Space') {
      e.preventDefault();
      state.running ? pause() : start();
    }
  });

  // ---------- 初始化 ----------
  function initSettings() {
    $('focusMin').value = settings.focus;
    $('shortMin').value = settings.short;
    $('longMin').value = settings.long;
    $('longEvery').value = settings.longEvery;
  }

  $('ringProgress').style.strokeDasharray = String(RING_CIRCUMFERENCE);
  initSettings();
  applyLook();
  renderPoints();
  renderTasks();
  render();
})();
