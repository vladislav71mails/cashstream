// ==========================================================================
// КЭШ.СТРИМ — общее ядро игры.
// Состояние живёт в chrome.storage.local и синхронизируется между
// popup.html и fullpage.html через chrome.storage.onChanged.
// ==========================================================================

const CS = {};

// ---- Константы баланса ---------------------------------------------------
CS.CONFIG = {
  STORAGE_KEY: 'csState',
  MAX_FOCUS: 100,
  MAX_BURNOUT: 100,
  FOCUS_COST_PER_TAP: 1.4,
  BURNOUT_GAIN_PER_TAP: 1.1,
  FOCUS_REGEN_PER_TICK: 0.6,      // восстановление фокуса в простое (раз в TICK_MS)
  BURNOUT_DECAY_PER_TICK: 0.25,   // естественное снижение выгорания в простое
  CASINO_BURNOUT_RELIEF: 9,       // снижение выгорания за один раунд в казино
  TICK_MS: 1000,
  COMBO_WINDOW_MS: 900,           // окно между кликами, чтобы сохранить комбо
  COMBO_MAX: 3,
  COMBO_STEP: 0.25,
  BASE_CLICK_VALUE: 2,
  XP_PER_STEP: 12,
  XP_PER_CHAIN: 40,
  LEVEL_XP_BASE: 100,
  LEVEL_XP_GROWTH: 1.35,
  INTERN_BASE_COST: 400,
  INTERN_COST_GROWTH: 1.55,
  INTERN_INCOME_PER_TICK: 1.4   // кэш в секунду с одного стажёра
};

CS.TASK_ICONS = ['🔧', '✏️', '📎', '📊', '💻', '📞', '📁', '🖨️'];

// ---- Квестовые цепочки -----------------------------------------------------
// Каждая цепочка — 3 шага разных типов: tap / find / puzzle
CS.QUEST_POOL = [
  {
    title: 'Странный заказчик',
    steps: [
      { type: 'find',   text: 'Найдите 3 ошибки в техзадании', target: 3 },
      { type: 'tap',    text: 'Позвоните заказчику и обсудите правки', target: 45 },
      { type: 'puzzle', text: 'Соберите коммерческое предложение по возрастанию цены', target: 4 }
    ]
  },
  {
    title: 'Дедлайн горит',
    steps: [
      { type: 'tap',    text: 'Доверстайте лендинг до полуночи', target: 60 },
      { type: 'find',   text: 'Найдите баг во вёрстке', target: 3 },
      { type: 'tap',    text: 'Отправьте отчёт руководителю', target: 30 }
    ]
  },
  {
    title: 'Новый стажёр',
    steps: [
      { type: 'puzzle', text: 'Проверьте прайс стажёра по возрастанию', target: 4 },
      { type: 'tap',    text: 'Проведите инструктаж', target: 35 },
      { type: 'find',   text: 'Найдите лишнюю скобку в коде', target: 3 }
    ]
  },
  {
    title: 'Годовой отчёт',
    steps: [
      { type: 'tap',    text: 'Сведите таблицы Excel', target: 50 },
      { type: 'puzzle', text: 'Соберите смету по возрастанию', target: 4 },
      { type: 'find',   text: 'Найдите опечатку в презентации', target: 3 }
    ]
  },
  {
    title: 'Срочная планёрка',
    steps: [
      { type: 'find',   text: 'Найдите свободный переговорный слот', target: 3 },
      { type: 'tap',    text: 'Подготовьте слайды', target: 40 },
      { type: 'tap',    text: 'Разошлите протокол встречи', target: 25 }
    ]
  }
];

CS.DEFAULT_STATE = {
  cash: 150,
  focus: 100,
  burnout: 0,
  level: 1,
  xp: 0,
  clickValue: CS.CONFIG.BASE_CLICK_VALUE,
  chainId: null,
  chainIndex: 0,
  stepIndex: 0,
  stepProgress: 0,
  puzzleOrder: [],
  findLayout: [],
  interns: 0,
  history: [],
  totalsToday: { cash: 0, taps: 0, chains: 0 }
};

// ---- Хранилище --------------------------------------------------------
// Если страница открыта как часть расширения — используем chrome.storage.local
// (общее состояние для popup/fullpage/казино). Если страница открыта как
// обычная веб-страница (без chrome.*), откатываемся на localStorage —
// так игра остаётся играбельной и вне расширения.
CS._hasChromeStorage = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);

CS.loadState = function () {
  if (CS._hasChromeStorage) {
    return new Promise((resolve) => {
      chrome.storage.local.get(CS.CONFIG.STORAGE_KEY, (res) => {
        const stored = res[CS.CONFIG.STORAGE_KEY];
        if (!stored) {
          const fresh = CS.freshState();
          CS.saveState(fresh);
          resolve(fresh);
        } else {
          resolve(stored);
        }
      });
    });
  }
  return new Promise((resolve) => {
    try {
      const raw = localStorage.getItem(CS.CONFIG.STORAGE_KEY);
      if (raw) { resolve(JSON.parse(raw)); return; }
    } catch (e) { /* ignore corrupt storage, fall through to fresh state */ }
    const fresh = CS.freshState();
    CS.saveState(fresh);
    resolve(fresh);
  });
};

CS.saveState = function (state) {
  if (CS._hasChromeStorage) {
    chrome.storage.local.set({ [CS.CONFIG.STORAGE_KEY]: state });
    return;
  }
  try {
    localStorage.setItem(CS.CONFIG.STORAGE_KEY, JSON.stringify(state));
    // localStorage's native 'storage' event doesn't fire in the tab that
    // wrote it, so dispatch a synthetic one for same-tab widgets (casino iframe).
    window.dispatchEvent(new CustomEvent('cs-storage-sync', { detail: state }));
  } catch (e) { /* storage unavailable — state just won't persist */ }
};

CS.onStateChanged = function (callback) {
  if (CS._hasChromeStorage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[CS.CONFIG.STORAGE_KEY]) {
        callback(changes[CS.CONFIG.STORAGE_KEY].newValue);
      }
    });
    return;
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== CS.CONFIG.STORAGE_KEY) return;
    try { callback(JSON.parse(e.newValue)); } catch (err) { /* ignore */ }
  });
  window.addEventListener('cs-storage-sync', (e) => callback(e.detail));
  if (window.parent && window.parent !== window) {
    window.parent.addEventListener('cs-storage-sync', (e) => callback(e.detail));
  }
};

// Видимый баннер вместо тихого зависания, если что-то пошло не так при инициализации
CS.reportFatalError = function (err) {
  console.error('КЭШ.СТРИМ:', err);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
    'background:#7a1c1c;color:#fff;font:12px Tahoma,sans-serif;padding:8px 12px;';
  banner.textContent = '⚠ Ошибка запуска игры: ' + (err && err.message ? err.message : err) +
    ' — откройте консоль разработчика (F12) для подробностей.';
  document.body.appendChild(banner);
};

CS.freshState = function () {
  const state = JSON.parse(JSON.stringify(CS.DEFAULT_STATE));
  CS.assignChain(state, Math.floor(Math.random() * CS.QUEST_POOL.length));
  return state;
};

CS.assignChain = function (state, poolIndex) {
  state.chainId = poolIndex;
  state.stepIndex = 0;
  state.stepProgress = 0;
  const step = CS.QUEST_POOL[poolIndex].steps[0];
  CS.prepareStepLayout(state, step);
};

// Готовит вспомогательные данные интерфейса под тип текущего шага
CS.prepareStepLayout = function (state, step) {
  state.puzzleOrder = [];
  state.findLayout = [];
  if (step.type === 'puzzle') {
    state.puzzleOrder = CS.makePuzzle(step.target);
  } else if (step.type === 'find') {
    state.findLayout = CS.makeFindLayout(step.target);
  }
};

// Раскладка мини-игры "найдите ошибки": сетка из 9 иконок, часть из них — цели
CS.makeFindLayout = function (targetCount) {
  const totalSlots = 9;
  const positions = Array.from({ length: totalSlots }, (_, i) => i);
  positions.sort(() => Math.random() - 0.5);
  const targetPositions = new Set(positions.slice(0, targetCount));

  const layout = [];
  for (let i = 0; i < totalSlots; i++) {
    const isTarget = targetPositions.has(i);
    const icon = isTarget
      ? '❌'
      : CS.TASK_ICONS[Math.floor(Math.random() * CS.TASK_ICONS.length)];
    layout.push({ icon, isTarget, found: false });
  }
  return layout;
};

CS.currentChain = function (state) {
  return CS.QUEST_POOL[state.chainId];
};

CS.currentStep = function (state) {
  return CS.currentChain(state).steps[state.stepIndex];
};

// ---- Пазл "собери цены по возрастанию" ---------------------------------
CS.makePuzzle = function (n) {
  const prices = [];
  while (prices.length < n) {
    const p = Math.floor(Math.random() * 950) + 50;
    if (!prices.includes(p)) prices.push(p);
  }
  // перемешать порядок отображения
  return prices
    .map((p) => ({ price: p, picked: false }))
    .sort(() => Math.random() - 0.5);
};

// ---- Уровни -------------------------------------------------------------
CS.xpToNextLevel = function (level) {
  return Math.round(CS.CONFIG.LEVEL_XP_BASE * Math.pow(CS.CONFIG.LEVEL_XP_GROWTH, level - 1));
};

CS.addXp = function (state, amount) {
  state.xp += amount;
  let need = CS.xpToNextLevel(state.level);
  let leveledUp = false;
  while (state.xp >= need) {
    state.xp -= need;
    state.level += 1;
    leveledUp = true;
    need = CS.xpToNextLevel(state.level);
  }
  return leveledUp;
};

// ---- Основные игровые действия ------------------------------------------

// Обычный тап по рабочей зоне (для шагов типа tap, и как "успешный клик" в find/puzzle)
CS.registerTap = function (state, comboMultiplier) {
  const step = CS.currentStep(state);
  const gained = Math.round(state.clickValue * (comboMultiplier || 1));
  state.cash += gained;
  state.focus = Math.max(0, state.focus - CS.CONFIG.FOCUS_COST_PER_TAP);
  state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + CS.CONFIG.BURNOUT_GAIN_PER_TAP);
  state.totalsToday.cash += gained;
  state.totalsToday.taps += 1;

  let stepCompleted = false;
  let chainCompleted = false;

  state.stepProgress += 1;
  if (state.stepProgress >= step.target) {
    stepCompleted = true;
  }

  if (stepCompleted) {
    chainCompleted = CS.advanceStep(state);
  }

  return { gained, stepCompleted, chainCompleted };
};

// Клик по элементу find/puzzle-мини-игры
CS.registerStepClick = function (state) {
  const step = CS.currentStep(state);
  state.stepProgress += 1;
  const bonus = 20 + state.level * 4;
  state.cash += bonus;
  state.totalsToday.cash += bonus;

  let stepCompleted = false;
  let chainCompleted = false;
  if (state.stepProgress >= step.target) {
    stepCompleted = true;
    chainCompleted = CS.advanceStep(state);
  }
  return { bonus, stepCompleted, chainCompleted };
};

CS.advanceStep = function (state) {
  CS.addXp(state, CS.CONFIG.XP_PER_STEP);
  const chain = CS.currentChain(state);
  let chainCompleted = false;

  if (state.stepIndex + 1 < chain.steps.length) {
    state.stepIndex += 1;
    state.stepProgress = 0;
    const nextStep = chain.steps[state.stepIndex];
    CS.prepareStepLayout(state, nextStep);
  } else {
    // цепочка завершена — награда и новая цепочка
    const reward = 250 + state.level * 60;
    state.cash += reward;
    state.totalsToday.cash += reward;
    state.totalsToday.chains += 1;
    CS.addXp(state, CS.CONFIG.XP_PER_CHAIN);
    state.history.unshift({
      type: 'quest',
      text: `Квест «${chain.title}» завершён (+${reward})`,
      time: new Date().toLocaleTimeString()
    });
    state.history = state.history.slice(0, 20);
    const nextPool = Math.floor(Math.random() * CS.QUEST_POOL.length);
    CS.assignChain(state, nextPool);
    chainCompleted = true;
  }
  return chainCompleted;
};

// ---- Стажёры: авто-клики (пассивный доход) -------------------------------
CS.internCost = function (state) {
  return Math.round(CS.CONFIG.INTERN_BASE_COST * Math.pow(CS.CONFIG.INTERN_COST_GROWTH, state.interns));
};

CS.hireIntern = function (state) {
  const cost = CS.internCost(state);
  if (state.cash < cost) return { success: false, cost };
  state.cash -= cost;
  state.interns += 1;
  state.history.unshift({
    type: 'business',
    text: `Нанят стажёр №${state.interns} (-${cost})`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, cost };
};

// Естественное восстановление / затухание в простое (вызывается таймером)
CS.tick = function (state) {
  state.focus = Math.min(CS.CONFIG.MAX_FOCUS, state.focus + CS.CONFIG.FOCUS_REGEN_PER_TICK);
  state.burnout = Math.max(0, state.burnout - CS.CONFIG.BURNOUT_DECAY_PER_TICK);
  if (state.interns > 0) {
    const income = state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK;
    state.cash += income;
    state.totalsToday.cash += income;
  }
};

// Результат раунда в казино прилетает сюда, чтобы обновить общий кэш/выгорание
CS.applyCasinoResult = function (state, cashDelta, historyText, win) {
  state.cash = Math.max(0, state.cash + cashDelta);
  state.burnout = Math.max(0, state.burnout - CS.CONFIG.CASINO_BURNOUT_RELIEF);
  state.history.unshift({
    type: 'casino',
    text: historyText,
    win,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
};

CS.canAfford = function (state, amount) {
  return state.cash >= amount;
};

// Небольшой штраф фокуса за ошибочный клик в мини-играх find/puzzle
CS.registerMistake = function (state) {
  state.focus = Math.max(0, state.focus - 2);
};
