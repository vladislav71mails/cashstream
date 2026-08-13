// ============================================================================
// Рабочая зона: три типа мини-игр (tap / find / puzzle), комбо, floaty,
// кнопки стажёра / оборудования / кофе.
// ============================================================================

let lastTapTime = 0;
let combo = 1;
let renderedStepKey = null;

function renderWorkZone() {
  const zone = document.getElementById('workZone');
  if (!zone) return;
  zone.innerHTML = '';

  if (!state.freelance || !state.freelance.active) {
    const box = document.createElement('div');
    box.className = 'work-chat-hint bevel-out';
    box.innerHTML = '<div style="font-size:28px;margin-bottom:8px;">📋</div>' +
      (CS.t ? CS.t('work.hint_open_board_html') : '');
    zone.appendChild(box);
    setHint(CS.t ? CS.t('work.hint_open_board') : '');
    return;
  }
  if (state.freelance.active.status === 'negotiating') {
    const box = document.createElement('div');
    box.className = 'work-chat-hint bevel-out';
    box.innerHTML = '<div style="font-size:28px;margin-bottom:8px;">💬</div>' +
      (CS.t ? CS.t('work.hint_nego_html') : '');
    zone.appendChild(box);
    setHint(CS.t ? CS.t('work.hint_nego_wait') : '');
    return;
  }

  const step = CS.currentStep(state);

  if (step.type === 'tap') {
    const btn = document.createElement('button');
    btn.className = 'win95-btn bevel-out tap-btn-big';
    btn.id = 'tapBtn';
    btn.textContent = CS.t ? CS.t('work.tap') : 'Work';
    btn.addEventListener('click', onTap);
    zone.appendChild(btn);
    setHint('Кликайте ритмично, чтобы держать комбо-множитель 🔥');
  } else if (step.type === 'chat') {
    const box = document.createElement('div');
    box.className = 'work-chat-hint bevel-out';
    const isLast = state.freelance.active.stepIndex >= state.freelance.active.steps.length - 1;
    box.innerHTML = '<div style="font-size:28px;margin-bottom:8px;">✉️</div>' +
      (CS.t ? CS.t('work.hint_mail_html') : '') +
      (isLast ? (CS.t ? CS.t('m.a55b0bb019') : '<br><strong>На финале любой ответ сдаёт заказ.</strong>') : '') + '</div>';
    zone.appendChild(box);
    setHint(isLast
      ? (CS.t ? CS.t('m.36a9f21bd2') : 'Финальный этап: письмо в Почте → любой вариант сдачи.')
      : (CS.t ? CS.t('m.237f03dc63') : 'Кнопки ответа — в письме заказчика.'));
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
    setHint((CS.t ? CS.t('m.585410e684') : 'Нажимайте на ❌ — это ошибки в задаче.'));
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
    setHint((CS.t ? CS.t('m.a156dfc569') : 'Собирайте цены по возрастанию — от самой дешёвой к самой дорогой.'));
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
      tap: (CS.t ? CS.t('m.4628e55328') : 'Кликайте ритмично, чтобы держать комбо-множитель 🔥'),
      find: (CS.t ? CS.t('m.585410e684') : 'Нажимайте на ❌ — это ошибки в задаче.'),
      puzzle: (CS.t ? CS.t('m.a156dfc569') : 'Собирайте цены по возрастанию — от самой дешёвой к самой дорогой.'),
      chat: (CS.t ? CS.t('m.b25ac4ceed') : 'Ответьте заказчику в переписке окна «Биржа.exe».')
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
  if (state.focus <= 0) { flashHint((CS.t ? CS.t('m.43331e0171') : 'Фокус на нуле — сходите на перерыв в казино.')); return; }
  if (state.burnout >= CS.CONFIG.MAX_BURNOUT) { flashHint((CS.t ? CS.t('m.65854b4b95') : 'Выгорание критично! Нужен перерыв.')); return; }

  const now = Date.now();
  const comboWin = (typeof CS.comboWindowMs === 'function') ? CS.comboWindowMs(state) : CS.CONFIG.COMBO_WINDOW_MS;
  combo = (now - lastTapTime < comboWin) ? Math.min(CS.CONFIG.COMBO_MAX, combo + CS.CONFIG.COMBO_STEP) : 1;
  lastTapTime = now;

  const result = CS.registerTap(state, combo);
  CS.saveState(state);

  const zone = document.getElementById('workZone');
  const rect = zone.getBoundingClientRect();

  if (result.failed) {
    combo = 1;
    lastTapTime = 0;
    if (CS.Audio) CS.Audio.play(state, 'click_fail');
    spawnFloaty(result.gained < 0 ? String(result.gained) : '✘', e.clientX - rect.left, e.clientY - rect.top);
    shakeZone();
    const pct = Math.round((result.failChance || 0) * 100);
    flashHint((CS.t ? CS.t('m.59e7af36c7') : 'Выгорание: клик сорвался') + (result.gained < 0 ? ' (−' + Math.abs(result.gained) + '💰)' : '') + (pct ? (CS.t ? CS.t('m.f3184979d2') : ' · риск ~') + pct + '%' : ''));
  } else {
    if (CS.Audio) CS.Audio.play(state, result.chainCompleted || result.stepCompleted ? 'success' : 'click');
    spawnFloaty('+' + result.gained, e.clientX - rect.left, e.clientY - rect.top);
    shakeZone();
    if (result.chainCompleted) flashHint((CS.t ? CS.t('m.ecb2d26449') : 'Квест выполнен! Новое задание уже в деле 🎉'));
    else if (result.stepCompleted) flashHint((CS.t ? CS.t('m.dfe845c524') : 'Этап закрыт — переходим дальше.'));
  }

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
    if (CS.Audio) CS.Audio.play(state, result.chainCompleted || result.stepCompleted ? 'success' : 'click');
    const rect = el.getBoundingClientRect();
    const zoneRect = document.getElementById('workZone').getBoundingClientRect();
    spawnFloaty('+' + result.bonus, rect.left - zoneRect.left + 20, rect.top - zoneRect.top);
    if (result.chainCompleted) flashHint((CS.t ? CS.t('m.ecb2d26449') : 'Квест выполнен! Новое задание уже в деле 🎉'));
    else if (result.stepCompleted) flashHint((CS.t ? CS.t('m.4caae07736') : 'Все ошибки найдены — этап закрыт.'));
    renderAll(false);
  } else {
    CS.registerMistake(state);
    CS.saveState(state);
    shakeZone();
    flashHint((CS.t ? CS.t('m.f51e31fea9') : 'Это не ошибка — присмотритесь внимательнее.'));
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
    if (result.chainCompleted) flashHint((CS.t ? CS.t('m.ecb2d26449') : 'Квест выполнен! Новое задание уже в деле 🎉'));
    else if (result.stepCompleted) flashHint((CS.t ? CS.t('m.b96b2af9bb') : 'Смета собрана верно — этап закрыт.'));
    renderAll(false);
  } else {
    CS.registerMistake(state);
    CS.saveState(state);
    shakeZone();
    flashHint((CS.t ? CS.t('m.6defdc3517') : 'Не тот порядок — ищите цену подешевле.'));
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
