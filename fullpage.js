let state = null;
let lastTapTime = 0;
let combo = 1;
let renderedStepKey = null;

// ============================================================================
// Менеджер окон: каждая «программа» (Задачи/Работа/Перерыв/Инвестиции)
// открывается как перетаскиваемое окно поверх рабочего стола, сворачивается
// в таскбар и закрывается независимо от остальных — как настоящие .exe.
// ============================================================================
const WM = (function () {
  const DEFS = {
    quests:  { title: '📋 Квесты дня',      tpl: 'tpl-quests', w: 300, h: 480 },
    work:    { title: '💻 Рабочая зона',     tpl: 'tpl-work',   w: 420, h: 480 },
    casino:  { title: '🎰 Перерыв',          tpl: 'tpl-casino', w: 480, h: 560 },
    invest:  { title: '📈 Инвестиции',       tpl: 'tpl-invest', w: 560, h: 520 },
    bank:    { title: '🏦 Банк',             tpl: 'tpl-bank',   w: 600, h: 540 }
  };
  const ORDER = ['quests', 'work', 'casino', 'invest'];
  const AUTO_OPEN = ['quests', 'work'];

  const windows = {}; // id -> { el, taskbarBtn, minimized, opened }
  let topZ = 10;
  let focused = null;
  let cascadeIndex = 0;

  function layer() { return document.getElementById('windowLayer'); }
  function taskbarRow() { return document.getElementById('taskbarWindows'); }

  function nextRect(w, h) {
    const root = document.getElementById('desktopRoot');
    const bounds = root.getBoundingClientRect();
    const step = 30;
    const maxCols = Math.max(1, Math.floor((bounds.width - w - 40) / (step * 4)) + 1);
    const col = cascadeIndex % maxCols;
    const row = Math.floor(cascadeIndex / maxCols) % 5;
    cascadeIndex++;
    const left = 20 + col * (step * 4) + row * step;
    const top = 16 + row * step;
    return { left, top };
  }

  function build(id) {
    const def = DEFS[id];
    const tpl = document.getElementById(def.tpl);
    const el = document.createElement('div');
    el.className = 'win95-window floating-window hidden-window';
    el.dataset.windowId = id;
    el.style.width = def.w + 'px';
    el.style.height = def.h + 'px';

    const rect = nextRect(def.w, def.h);
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';

    const titlebar = document.createElement('div');
    titlebar.className = 'win95-titlebar';
    titlebar.innerHTML = `<span>${def.title}</span>
      <div class="dots">
        <span data-act="min" title="Свернуть">_</span>
        <span data-act="max" title="Во весь экран">▢</span>
        <span data-act="close" title="Закрыть">×</span>
      </div>`;
    el.appendChild(titlebar);

    const body = tpl.content.cloneNode(true);
    el.appendChild(body);

    layer().appendChild(el);

    titlebar.querySelector('[data-act="close"]').addEventListener('click', (e) => { e.stopPropagation(); close(id); });
    titlebar.querySelector('[data-act="min"]').addEventListener('click', (e) => { e.stopPropagation(); minimize(id); });
    titlebar.querySelector('[data-act="max"]').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(id); });
    titlebar.addEventListener('mousedown', (e) => startDrag(id, e));
    el.addEventListener('mousedown', () => focus(id));

    const btn = document.createElement('button');
    btn.className = 'win95-btn bevel-out taskbar-win-btn';
    btn.textContent = def.title;
    btn.addEventListener('click', () => {
      const w = windows[id];
      if (w.minimized || !w.opened) { open(id); }
      else if (focused === id) { minimize(id); }
      else { focus(id); }
    });
    taskbarRow().appendChild(btn);

    windows[id] = { el, taskbarBtn: btn, minimized: false, opened: false, maximized: false, prevRect: null };
    return windows[id];
  }

  function get(id) { return windows[id] || build(id); }

  function open(id) {
    const w = get(id);
    w.el.classList.remove('hidden-window');
    w.opened = true;
    w.minimized = false;
    focus(id);
  }

  function close(id) {
    const w = windows[id];
    if (!w) return;
    w.el.classList.add('hidden-window');
    w.opened = false;
    w.minimized = false;
    w.taskbarBtn.classList.remove('focused');
    if (focused === id) focused = null;
  }

  function minimize(id) {
    const w = windows[id];
    if (!w) return;
    w.el.classList.add('hidden-window');
    w.minimized = true;
    w.taskbarBtn.classList.remove('focused');
    if (focused === id) focused = null;
  }

  function toggleMaximize(id) {
    const w = windows[id];
    if (!w) return;
    const root = document.getElementById('desktopRoot');
    if (!w.maximized) {
      w.prevRect = { left: w.el.style.left, top: w.el.style.top, width: w.el.style.width, height: w.el.style.height };
      w.el.style.left = '4px';
      w.el.style.top = '4px';
      w.el.style.width = (root.clientWidth - 8) + 'px';
      w.el.style.height = (root.clientHeight - 8) + 'px';
      w.maximized = true;
    } else {
      Object.assign(w.el.style, w.prevRect);
      w.maximized = false;
    }
  }

  function focus(id) {
    const w = windows[id];
    if (!w || !w.opened) return;
    topZ += 1;
    w.el.style.zIndex = topZ;
    focused = id;
    Object.keys(windows).forEach((k) => windows[k].taskbarBtn.classList.toggle('focused', k === id));
  }

  function startDrag(id, e) {
    if (e.target.closest('.dots')) return;
    const w = windows[id];
    if (!w) return;
    focus(id);
    const el = w.el;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(el.style.left, 10) || 0;
    const startTop = parseInt(el.style.top, 10) || 0;
    el.classList.add('dragging');

    function onMove(ev) {
      const root = document.getElementById('desktopRoot');
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let left = startLeft + dx;
      let top = startTop + dy;
      left = Math.max(-40, Math.min(left, root.clientWidth - 60));
      top = Math.max(0, Math.min(top, root.clientHeight - 40));
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    }
    function onUp() {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function initIcons() {
    document.querySelectorAll('.desktop-icon').forEach((icon) => {
      const id = icon.dataset.window;
      icon.addEventListener('dblclick', () => open(id));
      icon.addEventListener('click', () => {
        document.querySelectorAll('.desktop-icon').forEach((i) => i.classList.remove('selected'));
        icon.classList.add('selected');
      });
      icon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(id); }
      });
      icon.setAttribute('tabindex', '0');
    });
  }

  function autoOpenDefaults() {
    AUTO_OPEN.forEach((id) => open(id));
    if (location.hash === '#casino') { open('casino'); focus('casino'); }
    if (location.hash === '#invest') { open('invest'); focus('invest'); }
  }

  return { open, close, minimize, focus, initIcons, autoOpenDefaults };
})();

// ============================================================================
// Инициализация игры
// ============================================================================
async function init() {
  try {
    state = await CS.loadState();
    WM.initIcons();
    WM.autoOpenDefaults();

    renderAll(true);
    setInterval(tick, CS.CONFIG.TICK_MS);
    setInterval(updateClock, 1000);
    updateClock();

    CS.onStateChanged((newState) => {
      state = newState;
      renderAll(false);
    });
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function updateClock() {
  const d = new Date();
  document.getElementById('clock').textContent =
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function tick() {
  if (!state) return;
  CS.tick(state);
  CS.saveState(state);
  renderPanel();
}

// ---------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------
function renderAll(forceWorkZone) {
  if (!state) return;
  renderPanel();
  renderQuestPanel();
  renderHistory();
  const key = `${state.chainId}-${state.stepIndex}-${CS.currentStep(state).type}`;
  if (forceWorkZone || key !== renderedStepKey) {
    renderedStepKey = key;
    renderWorkZone();
  } else {
    updateWorkZoneDynamic();
  }
}

function renderPanel() {
  document.getElementById('cashValue').textContent = Math.floor(state.cash);
  document.getElementById('levelValue').textContent = state.level;
  document.getElementById('xpValue').textContent = Math.floor(state.xp);
  document.getElementById('xpNeedValue').textContent = CS.xpToNextLevel(state.level);

  const focusPct = Math.round(state.focus);
  document.getElementById('focusFill').style.width = focusPct + '%';
  document.getElementById('focusLabel').textContent = focusPct;

  const burnoutPct = Math.round(state.burnout);
  document.getElementById('burnoutFill').style.width = burnoutPct + '%';
  document.getElementById('burnoutLabel').textContent = burnoutPct;

  const rentTicksLeft = CS.CONFIG.RENT_INTERVAL_TICKS - (state.rentTimer || 0);
  const rentPct = Math.round(((state.rentTimer || 0) / CS.CONFIG.RENT_INTERVAL_TICKS) * 100);
  document.getElementById('rentCountdown').textContent = Math.max(0, rentTicksLeft);
  document.getElementById('rentFill').style.width = rentPct + '%';
  document.getElementById('rentLabel').textContent = CS.currentRentAmount(state) + '💰';

  const debtBadge = document.getElementById('debtBadge');
  if (state.debt > 0) {
    debtBadge.hidden = false;
    document.getElementById('debtValue').textContent = Math.round(state.debt);
  } else {
    debtBadge.hidden = true;
  }

  document.getElementById('comboValue').textContent = combo.toFixed(1);
  document.getElementById('todayCash').textContent = Math.floor(state.totalsToday.cash);
  document.getElementById('todayChains').textContent = state.totalsToday.chains;
}

function renderQuestPanel() {
  const chain = CS.currentChain(state);
  const titleEl = document.getElementById('questTitle');
  if (!titleEl) return; // окно квестов ещё не создано
  titleEl.textContent = '📋 ' + chain.title;

  const list = document.getElementById('questStepsList');
  list.innerHTML = '';
  chain.steps.forEach((step, i) => {
    const li = document.createElement('li');
    li.textContent = step.text;
    if (i < state.stepIndex) li.className = 'done';
    else if (i === state.stepIndex) li.className = 'current';
    else li.className = 'pending';
    list.appendChild(li);
  });

  const step = CS.currentStep(state);
  document.getElementById('questStepText').textContent = step.text;
  const pct = Math.min(100, Math.round((state.stepProgress / step.target) * 100));
  document.getElementById('questFill').style.width = pct + '%';
  document.getElementById('questLabel').textContent = `${state.stepProgress}/${step.target}`;

  const workInstr = document.getElementById('workInstruction');
  if (workInstr) workInstr.textContent = step.text;

  document.getElementById('internCount').textContent = state.interns;
  document.getElementById('internIncome').textContent = (state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1);
  const cost = CS.internCost(state);
  document.getElementById('internCost').textContent = cost;
  const hireBtn = document.getElementById('hireIntern');
  if (hireBtn && !hireBtn.dataset.bound) {
    hireBtn.dataset.bound = '1';
    hireBtn.addEventListener('click', onHireIntern);
  }
  if (hireBtn) hireBtn.disabled = state.cash < cost;

  // апгрейды
  document.getElementById('equipLevel').textContent = state.equipLevel;
  document.getElementById('equipBonus').textContent = (state.equipLevel * CS.CONFIG.EQUIP_CLICK_BONUS).toFixed(1);
  document.getElementById('equipCost').textContent = CS.equipCost(state);
  document.getElementById('coffeeLevel').textContent = state.coffeeLevel;
  document.getElementById('coffeeCost').textContent = CS.coffeeCost(state);

  const equipBtn = document.getElementById('buyEquip');
  if (equipBtn && !equipBtn.dataset.bound) {
    equipBtn.dataset.bound = '1';
    equipBtn.addEventListener('click', onBuyEquip);
  }
  if (equipBtn) equipBtn.disabled = state.cash < CS.equipCost(state);

  const coffeeBtn = document.getElementById('buyCoffee');
  if (coffeeBtn && !coffeeBtn.dataset.bound) {
    coffeeBtn.dataset.bound = '1';
    coffeeBtn.addEventListener('click', onBuyCoffee);
  }
  if (coffeeBtn) coffeeBtn.disabled = state.cash < CS.coffeeCost(state);
}

function renderHistory() {
  const log = document.getElementById('historyLog');
  if (!log) return;
  log.innerHTML = '';
  state.history.slice(0, 15).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item' + (item.type === 'casino' ? (item.win ? ' casino-win' : ' casino-loss') : ' ' + item.type);
    div.textContent = `[${item.time}] ${item.text}`;
    log.appendChild(div);
  });
}

// ---------------------------------------------------------------------
// Рабочая зона: три типа мини-игр
// ---------------------------------------------------------------------
function renderWorkZone() {
  const zone = document.getElementById('workZone');
  if (!zone) return; // окно работы ещё не создано
  zone.innerHTML = '';
  const step = CS.currentStep(state);

  if (step.type === 'tap') {
    const btn = document.createElement('button');
    btn.className = 'win95-btn bevel-out tap-btn-big';
    btn.id = 'tapBtn';
    btn.textContent = '🖱️ Работать';
    btn.addEventListener('click', onTap);
    zone.appendChild(btn);
    setHint('Кликайте ритмично, чтобы держать комбо-множитель 🔥');
  } else if (step.type === 'find') {
    const grid = document.createElement('div');
    grid.className = 'find-grid';
    state.findLayout.forEach((tile, idx) => {
      const el = document.createElement('button');
      el.className = 'win95-btn bevel-out find-tile' + (tile.found ? ' found' : '');
      el.textContent = tile.found ? '✅' : tile.icon;
      el.disabled = tile.found;
      el.addEventListener('click', () => onFindClick(idx, el));
      grid.appendChild(el);
    });
    zone.appendChild(grid);
    setHint('Нажимайте на ❌ — это ошибки в задаче.');
  } else if (step.type === 'puzzle') {
    const row = document.createElement('div');
    row.className = 'puzzle-row';
    state.puzzleOrder.forEach((tag, idx) => {
      const el = document.createElement('button');
      el.className = 'win95-btn bevel-out puzzle-tag' + (tag.picked ? ' picked' : '');
      el.textContent = tag.picked ? '✓ ' + tag.price + '₽' : tag.price + '₽';
      el.disabled = tag.picked;
      el.addEventListener('click', () => onPuzzleClick(idx, el));
      row.appendChild(el);
    });
    zone.appendChild(row);
    setHint('Собирайте цены по возрастанию — от самой дешёвой к самой дорогой.');
  }

  updateWorkZoneDynamic();
}

function updateWorkZoneDynamic() {
  const tapBtn = document.getElementById('tapBtn');
  if (tapBtn) {
    tapBtn.disabled = state.focus <= 0 || state.burnout >= CS.CONFIG.MAX_BURNOUT;
  }
}

function setHint(text) {
  const el = document.getElementById('workHint');
  if (el) el.textContent = text;
}

function flashHint(text) {
  setHint(text);
  clearTimeout(flashHint._t);
  flashHint._t = setTimeout(() => {
    const step = CS.currentStep(state);
    const defaults = {
      tap: 'Кликайте ритмично, чтобы держать комбо-множитель 🔥',
      find: 'Нажимайте на ❌ — это ошибки в задаче.',
      puzzle: 'Собирайте цены по возрастанию — от самой дешёвой к самой дорогой.'
    };
    setHint(defaults[step.type] || '');
  }, 2200);
}

function shakeZone() {
  const zone = document.getElementById('workZone');
  if (!zone) return;
  zone.classList.add('shake');
  setTimeout(() => zone.classList.remove('shake'), 130);
}

function spawnFloaty(text, x, y) {
  const zone = document.getElementById('workZone');
  if (!zone) return;
  const f = document.createElement('div');
  f.className = 'floaty';
  f.textContent = text;
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  zone.appendChild(f);
  setTimeout(() => f.remove(), 700);
}

// ---- tap ----
function onTap(e) {
  if (state.focus <= 0) { flashHint('Фокус на нуле — сходите на перерыв в казино.'); return; }
  if (state.burnout >= CS.CONFIG.MAX_BURNOUT) { flashHint('Выгорание критично! Нужен перерыв.'); return; }

  const now = Date.now();
  combo = (now - lastTapTime < CS.CONFIG.COMBO_WINDOW_MS) ? Math.min(CS.CONFIG.COMBO_MAX, combo + CS.CONFIG.COMBO_STEP) : 1;
  lastTapTime = now;

  const result = CS.registerTap(state, combo);
  CS.saveState(state);

  const zone = document.getElementById('workZone');
  const rect = zone.getBoundingClientRect();
  spawnFloaty('+' + result.gained, e.clientX - rect.left, e.clientY - rect.top);
  shakeZone();

  if (result.chainCompleted) flashHint('Квест выполнен! Новое задание уже в деле 🎉');
  else if (result.stepCompleted) flashHint('Этап закрыт — переходим дальше.');

  renderAll(false);
}

// ---- find ----
function onFindClick(idx, el) {
  const tile = state.findLayout[idx];
  if (tile.found) return;

  if (tile.isTarget) {
    tile.found = true;
    const result = CS.registerStepClick(state);
    CS.saveState(state);
    const rect = el.getBoundingClientRect();
    const zoneRect = document.getElementById('workZone').getBoundingClientRect();
    spawnFloaty('+' + result.bonus, rect.left - zoneRect.left + 20, rect.top - zoneRect.top);
    if (result.chainCompleted) flashHint('Квест выполнен! Новое задание уже в деле 🎉');
    else if (result.stepCompleted) flashHint('Все ошибки найдены — этап закрыт.');
    renderAll(false);
  } else {
    CS.registerMistake(state);
    CS.saveState(state);
    shakeZone();
    flashHint('Это не ошибка — присмотритесь внимательнее.');
    renderPanel();
  }
}

// ---- puzzle ----
function onPuzzleClick(idx, el) {
  const tag = state.puzzleOrder[idx];
  if (tag.picked) return;

  const sortedAsc = state.puzzleOrder.map((t) => t.price).sort((a, b) => a - b);
  const nextExpected = sortedAsc[state.stepProgress];

  if (tag.price === nextExpected) {
    tag.picked = true;
    const result = CS.registerStepClick(state);
    CS.saveState(state);
    const rect = el.getBoundingClientRect();
    const zoneRect = document.getElementById('workZone').getBoundingClientRect();
    spawnFloaty('+' + result.bonus, rect.left - zoneRect.left, rect.top - zoneRect.top);
    if (result.chainCompleted) flashHint('Квест выполнен! Новое задание уже в деле 🎉');
    else if (result.stepCompleted) flashHint('Смета собрана верно — этап закрыт.');
    renderAll(false);
  } else {
    CS.registerMistake(state);
    CS.saveState(state);
    shakeZone();
    flashHint('Не тот порядок — ищите цену подешевле.');
    renderPanel();
  }
}

function onHireIntern() {
  const result = CS.hireIntern(state);
  CS.saveState(state);
  if (!result.success) {
    flashHint(`Не хватает денег: нужно ${result.cost}💰`);
  } else {
    flashHint(`Стажёр №${state.interns} нанят! Теперь приносит доход каждую секунду.`);
  }
  renderQuestPanel();
  renderPanel();
  renderHistory();
}

function onBuyEquip() {
  const result = CS.buyEquip(state);
  CS.saveState(state);
  renderQuestPanel();
  renderPanel();
  renderHistory();
}

function onBuyCoffee() {
  const result = CS.buyCoffee(state);
  CS.saveState(state);
  renderQuestPanel();
  renderPanel();
  renderHistory();
}

init();
