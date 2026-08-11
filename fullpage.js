let state = null;
let lastTapTime = 0;
let combo = 1;
let renderedStepKey = null;

async function init() {
  try {
    state = await CS.loadState();
    renderAll(true);
    setInterval(tick, CS.CONFIG.TICK_MS);
    setInterval(updateClock, 1000);
    updateClock();

    CS.onStateChanged((newState) => {
      state = newState;
      renderAll(false);
    });

    if (location.hash === '#casino') {
      document.querySelector('.col-casino')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    document.getElementById('hireIntern').addEventListener('click', onHireIntern);
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

  document.getElementById('comboValue').textContent = combo.toFixed(1);
  document.getElementById('todayCash').textContent = Math.floor(state.totalsToday.cash);
  document.getElementById('todayChains').textContent = state.totalsToday.chains;
}

function renderQuestPanel() {
  const chain = CS.currentChain(state);
  document.getElementById('questTitle').textContent = '📋 ' + chain.title;

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

  document.getElementById('workInstruction').textContent = step.text;

  document.getElementById('internCount').textContent = state.interns;
  document.getElementById('internIncome').textContent = (state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1);
  const cost = CS.internCost(state);
  document.getElementById('internCost').textContent = cost;
  document.getElementById('hireIntern').disabled = state.cash < cost;
}

function renderHistory() {
  const log = document.getElementById('historyLog');
  log.innerHTML = '';
  state.history.slice(0, 15).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item' + (item.type === 'casino' ? (item.win ? ' casino-win' : ' casino-loss') : '');
    div.textContent = `[${item.time}] ${item.text}`;
    log.appendChild(div);
  });
}

// ---------------------------------------------------------------------
// Рабочая зона: три типа мини-игр
// ---------------------------------------------------------------------
function renderWorkZone() {
  const zone = document.getElementById('workZone');
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
  document.getElementById('workHint').textContent = text;
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
  zone.classList.add('shake');
  setTimeout(() => zone.classList.remove('shake'), 130);
}

function spawnFloaty(text, x, y) {
  const zone = document.getElementById('workZone');
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

init();
