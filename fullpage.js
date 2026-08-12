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
    stats:   { title: '📊 Отчетность',       tpl: 'tpl-stats',  w: 680, h: 600 },
    bank:    { title: '🏦 Банк',             tpl: 'tpl-bank',   w: 600, h: 540 },
    store:   { title: '🛒 Магазин приложений', tpl: 'tpl-store', w: 640, h: 560 },
    crypto:  { title: '🔐 ЭЦП и СКЗИ',        tpl: 'tpl-crypto', w: 480, h: 480 },
    browser: { title: '🌐 Браузер',          tpl: 'tpl-browser', w: 640, h: 520 },
    mail:    { title: '✉️ Почта',            tpl: 'tpl-mail',   w: 720, h: 520 },
    achievements: { title: '🏆 Достижения', tpl: 'tpl-achievements', w: 420, h: 520 },
    settings: { title: '⚙️ Настройка компьютера', tpl: 'tpl-settings', w: 420, h: 420 }
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
    btn.dataset.windowId = id;
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
    const wasOpen = w.opened && !w.minimized;
    w.el.classList.remove('hidden-window');
    w.opened = true;
    w.minimized = false;
    focus(id);
    if (!wasOpen && typeof CS !== 'undefined' && CS.Audio) CS.Audio.play(state, 'open');
    // мини-анимация «загрузки» приложения
    w.el.classList.remove('app-booting');
    void w.el.offsetWidth;
    w.el.classList.add('app-booting');
    setTimeout(() => w.el.classList.remove('app-booting'), 450);
    if (id === 'settings') setTimeout(bindSettingsUI, 0);
  }

  function close(id) {
    const w = windows[id];
    if (!w) return;
    w.el.classList.add('hidden-window');
    w.opened = false;
    w.minimized = false;
    w.taskbarBtn.classList.remove('focused');
    if (focused === id) focused = null;
    if (typeof CS !== 'undefined' && CS.Audio) CS.Audio.play(state, 'close');
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
// Значки установленных приложений: после установки программы в
// Магазин.exe (store.html) на рабочем столе должен появиться её значок —
// без перезагрузки страницы, сразу по приходу нового состояния.
// ============================================================================
function syncInstalledAppIcons() {
  if (!state) return;
  const container = document.getElementById('desktopIcons');
  const hint = container.querySelector('.desktop-hint');
  const installed = (state.apps && state.apps.installed) || [];

  installed.forEach((id) => {
    const def = CS.APP_CATALOG.find((a) => a.id === id);
    if (!def || !def.addsIcon) return;
    if (container.querySelector(`.desktop-icon[data-window="${id}"]`)) return;

    const btn = document.createElement('button');
    btn.className = 'desktop-icon';
    btn.dataset.window = id;
    btn.setAttribute('tabindex', '0');
    btn.innerHTML = `<span class="icon-glyph">${def.icon}</span><span class="icon-label">${def.name}.exe</span>`;

    btn.addEventListener('dblclick', () => WM.open(id));
    btn.addEventListener('click', () => {
      container.querySelectorAll('.desktop-icon').forEach((i) => i.classList.remove('selected'));
      btn.classList.add('selected');
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); WM.open(id); }
    });

    container.insertBefore(btn, hint);
  });

  syncMailBadge();
}

// ============================================================================
// Почта: бейдж непрочитанных + пуш-уведомления
// ============================================================================
const _shownMailPushIds = new Set();

function syncMailBadge() {
  if (!state) return;
  const unread = CS.unreadMailCount(state, 'inbox');
  const mailInstalled = CS.isAppInstalled(state, 'mail');

  // Бейдж на иконке рабочего стола
  const icon = document.querySelector('.desktop-icon[data-window="mail"]');
  if (icon) {
    let badge = icon.querySelector('.mail-badge');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mail-badge';
        icon.appendChild(badge);
      }
      badge.hidden = false;
      badge.textContent = unread > 99 ? '99+' : String(unread);
    } else if (badge) {
      badge.hidden = true;
    }
  }

  // Иконка в трее
  const tray = document.getElementById('trayMail');
  const trayBadge = document.getElementById('trayMailBadge');
  if (tray && trayBadge) {
    if (mailInstalled && unread > 0) {
      tray.hidden = false;
      trayBadge.textContent = unread > 99 ? '99+' : String(unread);
      tray.title = `Почта: ${unread} непрочитанн${unread === 1 ? 'ое' : 'ых'}`;
    } else {
      tray.hidden = true;
    }
  }

  // Подпись кнопки в таскбаре
  document.querySelectorAll('#taskbarWindows .taskbar-win-btn').forEach((btn) => {
    if (btn.textContent.indexOf('Почта') !== -1 || btn.dataset.windowId === 'mail') {
      btn.textContent = unread > 0 ? `✉️ Почта (${unread})` : '✉️ Почта';
    }
  });
}

function processMailPush() {
  if (!state) return;
  const mail = CS.ensureMail(state);
  if (!mail.pushQueue || !mail.pushQueue.length) return;

  const queue = CS.consumeMailPush(state);
  const fresh = queue.filter((item) => {
    if (_shownMailPushIds.has(item.id)) return false;
    _shownMailPushIds.add(item.id);
    return true;
  });
  // Не раздуваем Set
  if (_shownMailPushIds.size > 80) {
    const arr = Array.from(_shownMailPushIds);
    arr.slice(0, arr.length - 40).forEach((id) => _shownMailPushIds.delete(id));
  }

  if (!fresh.length) return;

  // Сохраняем очищенную очередь
  CS.saveState(state);

  fresh.forEach((item, i) => {
    setTimeout(() => showMailToast(item), i * 350);
  });
  syncMailBadge();
}

function showMailToast(item) {
  const stack = document.getElementById('mailToastStack');
  if (!stack) return;

  const el = document.createElement('div');
  el.className = 'mail-toast';
  el.innerHTML = `
    <div class="toast-titlebar">
      <span>✉️ Новое сообщение</span>
      <span class="toast-close" title="Закрыть">×</span>
    </div>
    <div class="toast-body">
      <div class="toast-from">${escapeToast(item.from || '')}</div>
      <div class="toast-subj">${escapeToast(item.subject || '(без темы)')}</div>
    </div>`;

  const close = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };

  el.querySelector('.toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  el.addEventListener('click', () => {
    close();
    if (CS.isAppInstalled(state, 'mail')) {
      WM.open('mail');
    }
  });

  stack.appendChild(el);
  setTimeout(close, 6000);
}

function escapeToast(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Инициализация игры
// ============================================================================
async function init() {
  try {
    // Разблокировка AudioContext по первому жесту
    document.addEventListener('pointerdown', () => { if (CS.Audio) CS.Audio.unlock(); }, { once: true });

    state = await CS.loadState();
    CS.ensureSettings(state);

    const prefs = CS.ensureSettings(state);
    const runBoot = prefs.bootAnim !== false;

    const afterBoot = () => {
      WM.initIcons();
      WM.autoOpenDefaults();
      syncInstalledAppIcons();
      syncMailBadge();
      setupStartMenu();

      const trayMail = document.getElementById('trayMail');
      if (trayMail) {
        trayMail.addEventListener('click', () => {
          if (CS.isAppInstalled(state, 'mail')) WM.open('mail');
        });
      }

      if (!CS.isAppInstalled(state, 'achievements')) {
        CS.installApp(state, 'achievements');
        CS.saveState(state);
        syncInstalledAppIcons();
      }

      renderAll(true);
      setInterval(tick, CS.CONFIG.TICK_MS);
      setInterval(updateClock, 1000);
      updateClock();

      setupTutorialUI();
      if (!state.tutorialDone) {
        showTutorial();
      }

      CS.onStateChanged((newState) => {
        state = newState;
        renderAll(false);
        syncInstalledAppIcons();
        processMailPush();
        syncMailBadge();
        flushAchievementToasts();
      });
    };

    if (runBoot) {
      runBootSequence().then(afterBoot);
    } else {
      const boot = document.getElementById('bootScreen');
      if (boot) boot.hidden = true;
      afterBoot();
    }
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
  processMailPush();
  syncMailBadge();
  syncEventOverlay();
}

// ---------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------
function renderAll(forceWorkZone) {
  if (!state) return;
  renderPanel();
  renderQuestPanel();
  renderHistory();
  syncMailBadge();
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

  const rentGaugeLabel = document.getElementById('rentGaugeLabel');
  const graceBadge = document.getElementById('graceBadge');
  if (!state.economyActive) {
    const left = Math.max(0, state.graceTicksLeft || 0);
    if (rentGaugeLabel) {
      rentGaugeLabel.innerHTML = 'Льготный период · <span id="rentCountdown">' + left + '</span>с';
    } else {
      document.getElementById('rentCountdown').textContent = left;
    }
    document.getElementById('rentFill').style.width = Math.round((1 - left / Math.max(1, CS.CONFIG.GRACE_TICKS)) * 100) + '%';
    document.getElementById('rentLabel').textContent = 'нет аренды';
    if (graceBadge) {
      graceBadge.hidden = false;
      document.getElementById('graceValue').textContent = left;
    }
  } else {
    const rentTicksLeft = CS.CONFIG.RENT_INTERVAL_TICKS - (state.rentTimer || 0);
    const rentPct = Math.round(((state.rentTimer || 0) / CS.CONFIG.RENT_INTERVAL_TICKS) * 100);
    if (rentGaugeLabel) {
      rentGaugeLabel.innerHTML = 'Аренда через <span id="rentCountdown">' + Math.max(0, rentTicksLeft) + '</span>с';
    } else {
      document.getElementById('rentCountdown').textContent = Math.max(0, rentTicksLeft);
    }
    document.getElementById('rentFill').style.width = rentPct + '%';
    document.getElementById('rentLabel').textContent = CS.currentRentAmount(state) + '💰';
    if (graceBadge) graceBadge.hidden = true;
  }

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

  renderAchievementsWindow();
  flushAchievementToasts();
  syncEventOverlay();
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

  if (result.failed) {
    combo = 1; // провал сбрасывает комбо
    lastTapTime = 0;
    if (CS.Audio) CS.Audio.play(state, 'click_fail');
    spawnFloaty(result.gained < 0 ? String(result.gained) : '✘', e.clientX - rect.left, e.clientY - rect.top);
    shakeZone();
    const pct = Math.round((result.failChance || 0) * 100);
    flashHint('Выгорание: клик сорвался' + (result.gained < 0 ? ' (−' + Math.abs(result.gained) + '💰)' : '') + (pct ? ' · риск ~' + pct + '%' : ''));
  } else {
    if (CS.Audio) CS.Audio.play(state, result.chainCompleted || result.stepCompleted ? 'success' : 'click');
    spawnFloaty('+' + result.gained, e.clientX - rect.left, e.clientY - rect.top);
    shakeZone();
    if (result.chainCompleted) flashHint('Квест выполнен! Новое задание уже в деле 🎉');
    else if (result.stepCompleted) flashHint('Этап закрыт — переходим дальше.');
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

// ============================================================================
// Достижения — окно и тосты
// ============================================================================

function renderAchievementsWindow() {
  const list = document.getElementById('achList');
  const countEl = document.getElementById('achCount');
  if (!list || !state) return;
  const items = CS.achievementProgressList(state);
  const unlockedN = items.filter((i) => i.unlocked).length;
  if (countEl) countEl.textContent = unlockedN + ' / ' + items.length;
  list.innerHTML = items.map((a) => {
    const cls = a.unlocked ? 'ach-item unlocked' : 'ach-item locked';
    let prog = '';
    if (!a.unlocked && a.progress) {
      const pct = Math.min(100, Math.round((a.progress.current / Math.max(1, a.progress.need)) * 100));
      prog = `<div class="ach-progress bevel-in"><i style="width:${pct}%"></i><span>${Math.min(a.progress.current, a.progress.need)} / ${a.progress.need}</span></div>`;
    }
    const rewardParts = [];
    if (a.reward.cash) rewardParts.push('+' + a.reward.cash + '💰');
    if (a.reward.focus) rewardParts.push('+' + a.reward.focus + '⭐');
    const rewardStr = rewardParts.length ? `<span class="ach-reward">${rewardParts.join(' ')}</span>` : '';
    return `<div class="${cls}" data-id="${a.id}">
      <span class="ach-icon">${a.icon}</span>
      <div class="ach-meta">
        <div class="ach-title">${a.title}${a.unlocked ? ' ✓' : ''}</div>
        <div class="ach-desc">${a.desc}</div>
        ${prog}
      </div>
      ${rewardStr}
    </div>`;
  }).join('');
}

function flushAchievementToasts() {
  if (!state || !state._achievementQueue || !state._achievementQueue.length) return;
  const stack = document.getElementById('achToastStack');
  if (!stack) return;
  while (state._achievementQueue.length) {
    const item = state._achievementQueue.shift();
    if (CS.Audio) CS.Audio.play(state, 'notify');
    const el = document.createElement('div');
    el.className = 'ach-toast bevel-out';
    const rewardParts = [];
    if (item.reward && item.reward.cash) rewardParts.push('+' + item.reward.cash + '💰');
    if (item.reward && item.reward.focus) rewardParts.push('+' + item.reward.focus + '⭐');
    el.innerHTML = `<span class="ach-toast-icon">${item.icon || '🏆'}</span>
      <div><strong>Достижение!</strong><br>${escapeToast(item.title)}
      ${rewardParts.length ? '<br><span class="ach-toast-reward">' + rewardParts.join(' ') + '</span>' : ''}</div>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 400);
    }, 4500);
  }
}

// ============================================================================
// Обучение
// ============================================================================

function setupTutorialUI() {
  const nextBtn = document.getElementById('tutorialNextBtn');
  const skipBtn = document.getElementById('tutorialSkipBtn');
  const skipTitle = document.getElementById('tutorialSkipTitle');
  if (nextBtn) nextBtn.addEventListener('click', onTutorialNext);
  if (skipBtn) skipBtn.addEventListener('click', onTutorialSkip);
  if (skipTitle) skipTitle.addEventListener('click', onTutorialSkip);
}

function showTutorial() {
  const overlay = document.getElementById('tutorialOverlay');
  if (!overlay || !state || state.tutorialDone) return;
  const step = CS.currentTutorialStep(state);
  if (!step) {
    overlay.hidden = true;
    return;
  }
  const total = CS.TUTORIAL_STEPS.length;
  const idx = (state.tutorialStep || 0) + 1;
  document.getElementById('tutorialStepNum').textContent = 'Шаг ' + idx + ' / ' + total;
  document.getElementById('tutorialTitle').textContent = step.title;
  document.getElementById('tutorialText').textContent = step.body;
  const nextBtn = document.getElementById('tutorialNextBtn');
  if (nextBtn) nextBtn.textContent = idx >= total ? 'Готово' : 'Далее';
  overlay.hidden = false;
}

function onTutorialNext() {
  if (!state) return;
  const result = CS.advanceTutorial(state);
  CS.saveState(state);
  if (result.done) {
    document.getElementById('tutorialOverlay').hidden = true;
    flushAchievementToasts();
    renderPanel();
  } else {
    showTutorial();
  }
}

function onTutorialSkip() {
  if (!state) return;
  CS.skipTutorial(state);
  CS.saveState(state);
  document.getElementById('tutorialOverlay').hidden = true;
  flushAchievementToasts();
  renderPanel();
}

// ============================================================================
// Случайные события — модальный выбор реакции
// ============================================================================

function syncEventOverlay() {
  const overlay = document.getElementById('eventOverlay');
  if (!overlay || !state) return;

  // Не перекрываем обучение
  const tut = document.getElementById('tutorialOverlay');
  if (tut && !tut.hidden) {
    overlay.hidden = true;
    return;
  }

  const ev = state.activeEvent;
  if (!ev) {
    overlay.hidden = true;
    return;
  }

  if (!overlay.hidden && overlay.dataset.eventId === ev.id) return;

  overlay.dataset.eventId = ev.id;
  const isLucky = ev.kind === 'lucky';
  if (CS.Audio) CS.Audio.play(state, isLucky ? 'event_lucky' : 'event');
  document.getElementById('eventWinTitle').textContent = (ev.icon || '⚡') + ' ' + (isLucky ? 'Удача.exe' : 'Кризис.exe');
  document.getElementById('eventKind').textContent = isLucky ? '✨ Удачное событие' : '⚠️ Кризис';
  document.getElementById('eventKind').className = 'event-kind ' + (isLucky ? 'lucky' : 'crisis');
  document.getElementById('eventIcon').textContent = ev.icon || '⚡';
  document.getElementById('eventTitle').textContent = ev.title || '';
  document.getElementById('eventText').textContent = ev.body || '';
  document.getElementById('eventHint').textContent = '';

  const box = document.getElementById('eventChoices');
  box.innerHTML = '';
  (ev.choices || []).forEach((ch) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'win95-btn bevel-out event-choice-btn';
    const need = ch.requiresCash || 0;
    const can = need <= 0 || state.cash >= need;
    let label = ch.label;
    if (ch.costLabel) label += ' (' + ch.costLabel + ')';
    btn.textContent = label;
    if (!can) {
      btn.disabled = true;
      btn.title = 'Нужно ' + need + '💰 (у вас ' + Math.floor(state.cash) + ')';
      btn.classList.add('disabled');
    }
    btn.addEventListener('click', () => onEventChoice(ch.id));
    box.appendChild(btn);
  });

  overlay.hidden = false;
}

function onEventChoice(choiceId) {
  if (!state || !state.activeEvent) return;
  const result = CS.resolveEventChoice(state, choiceId);
  if (!result.success) {
    const hint = document.getElementById('eventHint');
    if (result.reason === 'cash') {
      hint.textContent = 'Не хватает денег: нужно ' + result.need + '💰';
    }
    // обновить доступность кнопок
    syncEventOverlay();
    document.getElementById('eventOverlay').dataset.eventId = '';
    syncEventOverlay();
    return;
  }
  CS.saveState(state);
  document.getElementById('eventOverlay').hidden = true;
  document.getElementById('eventOverlay').dataset.eventId = '';
  renderAll(false);
  flushAchievementToasts();
  if (result.resultText) {
    // краткий тост через ach-стек
    const stack = document.getElementById('achToastStack');
    if (stack) {
      const el = document.createElement('div');
      el.className = 'ach-toast bevel-out event-result-toast';
      el.innerHTML = `<span class="ach-toast-icon">${result.icon || '⚡'}</span>
        <div><strong>${escapeToast(result.title || 'Событие')}</strong><br>${escapeToast(result.resultText)}</div>`;
      stack.appendChild(el);
      setTimeout(() => {
        el.classList.add('fade');
        setTimeout(() => el.remove(), 400);
      }, 4500);
    }
  }
}


// ============================================================================
// Загрузка Win95 + Старт + Настройки + звуки событий
// ============================================================================

function runBootSequence() {
  return new Promise((resolve) => {
    const screen = document.getElementById('bootScreen');
    const fill = document.getElementById('bootFill');
    const log = document.getElementById('bootLog');
    if (!screen) { resolve(); return; }
    screen.hidden = false;
    screen.classList.remove('boot-done');
    const steps = [
      'POST: memory OK',
      'Detecting mouse…',
      'Loading HIMEM.SYS',
      'Starting KESH.STREAM…',
      'Initializing desktop…',
      'Welcome'
    ];
    let i = 0;
    if (CS.Audio) CS.Audio.play(state, 'boot');
    const tickBoot = () => {
      if (log) log.textContent = steps[Math.min(i, steps.length - 1)];
      if (fill) fill.style.width = Math.round(((i + 1) / steps.length) * 100) + '%';
      i += 1;
      if (i >= steps.length) {
        setTimeout(() => {
          screen.classList.add('boot-done');
          setTimeout(() => {
            screen.hidden = true;
            resolve();
          }, 350);
        }, 280);
        return;
      }
      setTimeout(tickBoot, 280 + Math.random() * 120);
    };
    tickBoot();
  });
}

function setupStartMenu() {
  const btn = document.getElementById('startBtn');
  const menu = document.getElementById('startMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    if (open && CS.Audio) CS.Audio.play(state, 'ui');
  });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', (e) => e.stopPropagation());
  menu.querySelectorAll('.start-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.start;
      menu.hidden = true;
      if (id) WM.open(id);
    });
  });
}

let _settingsBound = false;
function bindSettingsUI() {
  const sound = document.getElementById('setSound');
  const volume = document.getElementById('setVolume');
  const volLabel = document.getElementById('setVolumeLabel');
  const bootAnim = document.getElementById('setBootAnim');
  const testBtn = document.getElementById('setTestSound');
  const replay = document.getElementById('setReplayBoot');
  if (!sound || !state) return;

  const s = CS.ensureSettings(state);
  sound.checked = s.sound !== false;
  if (volume) {
    volume.value = Math.round((s.volume != null ? s.volume : 0.45) * 100);
    if (volLabel) volLabel.textContent = volume.value + '%';
  }
  if (bootAnim) bootAnim.checked = s.bootAnim !== false;

  if (_settingsBound) return;
  _settingsBound = true;

  function persist() {
    CS.ensureSettings(state);
    state.settings.sound = sound.checked;
    if (volume) state.settings.volume = Number(volume.value) / 100;
    if (bootAnim) state.settings.bootAnim = bootAnim.checked;
    CS.saveState(state);
  }

  sound.addEventListener('change', () => { persist(); if (CS.Audio) CS.Audio.play(state, 'ui'); });
  if (volume) {
    volume.addEventListener('input', () => {
      if (volLabel) volLabel.textContent = volume.value + '%';
      persist();
    });
  }
  if (bootAnim) bootAnim.addEventListener('change', persist);
  if (testBtn) testBtn.addEventListener('click', () => {
    persist();
    if (CS.Audio) { CS.Audio.unlock(); CS.Audio.play(state, 'success'); }
  });
  if (replay) replay.addEventListener('click', () => {
    runBootSequence().then(() => { if (CS.Audio) CS.Audio.play(state, 'notify'); });
  });
}
