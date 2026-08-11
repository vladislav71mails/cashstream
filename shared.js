// ==========================================================================
// КЭШ.СТРИМ — общее ядро игры.
// Состояние живёт в chrome.storage.local и синхронизируется между
// popup.html, fullpage.html, casino.html и invest.html через
// chrome.storage.onChanged.
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
  INTERN_INCOME_PER_TICK: 1.4,   // кэш в секунду с одного стажёра

  // ---- Экономика: аренда офиса (обязательный расход) ----
  RENT_INTERVAL_TICKS: 30,        // раз в 30 секунд прилетает счёт за аренду
  RENT_BASE: 70,                  // база аренды
  RENT_PER_LEVEL: 12,             // аренда растёт вместе с уровнем игрока
  RENT_LATE_BURNOUT: 14,          // штраф выгорания, если нечем платить
  DEBT_INTEREST_PER_TICK: 0.004,  // проценты по долгу (за тик простоя)
  DEBT_AUTOPAY_SHARE: 0.22,       // доля свободного кэша, уходящая на списание долга

  // ---- Апгрейды оборудования (тратим кэш, чтобы не залипать на тапе) ----
  EQUIP_BASE_COST: 260,
  EQUIP_COST_GROWTH: 1.62,
  EQUIP_CLICK_BONUS: 1.4,         // прибавка к clickValue за уровень
  COFFEE_BASE_COST: 220,
  COFFEE_COST_GROWTH: 1.5,
  COFFEE_FOCUS_SAVE: 0.16,        // снижение стоимости фокуса за тап на уровень
  COFFEE_MIN_FOCUS_COST: 0.35,

  // ---- Биржа «Рынок Айти» ----
  STOCK_NEWS_CHANCE: 0.05,        // шанс резкого новостного скачка за тик
  STOCK_NEWS_MAGNITUDE: [0.10, 0.28],
  STOCK_TRADE_FEE: 0.01,          // комиссия брокера 1% — ещё один денежный сток
  STOCK_HISTORY_LEN: 28,

  // ---- Недвижимость ----
  PROPERTY_COST_GROWTH: 1.28      // рост цены за каждый следующий такой же объект
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

// ---- Биржа «Рынок Айти»: список бумаг -------------------------------------
CS.STOCKS = [
  { id: 'byte',  name: 'ByteCorp',      ticker: 'BYTE', basePrice: 120, volatility: 0.035 },
  { id: 'neon',  name: 'NeonSoft',      ticker: 'NEON', basePrice: 58,  volatility: 0.055 },
  { id: 'quant', name: 'КвантТех',      ticker: 'QTEH', basePrice: 310, volatility: 0.028 },
  { id: 'pix',   name: 'ПиксельЛаб',    ticker: 'PIXL', basePrice: 24,  volatility: 0.075 },
  { id: 'cloud', name: 'ОблакоНет',     ticker: 'CLDN', basePrice: 155, volatility: 0.045 }
];

// ---- Недвижимость: объекты для пассивного дохода ---------------------------
CS.PROPERTIES = [
  { id: 'flat',      name: 'Студия у МКАД',        cost: 1800,  income: 0.7,  upkeep: 0.12, icon: '🏚️' },
  { id: 'office',    name: 'Мини-офис',             cost: 5200,  income: 2.2,  upkeep: 0.4,  icon: '🏢' },
  { id: 'coworking', name: 'Коворкинг-этаж',        cost: 13500, income: 5.6,  upkeep: 1.0,  icon: '🏬' },
  { id: 'tower',     name: 'Бизнес-центр',          cost: 36000, income: 15.5, upkeep: 2.8,  icon: '🌆' }
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
  totalsToday: { cash: 0, taps: 0, chains: 0 },

  // экономика
  equipLevel: 0,
  coffeeLevel: 0,
  rentTimer: 0,
  debt: 0,
  stockPrices: {},
  stockHistory: {},
  portfolio: {},
  properties: {}
};

// ---- Хранилище --------------------------------------------------------
// Если страница открыта как часть расширения — используем chrome.storage.local
// (общее состояние для popup/fullpage/казино/биржи). Если страница открыта как
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
          const normalized = CS.normalizeState(stored);
          if (normalized !== stored) CS.saveState(normalized);
          resolve(normalized);
        }
      });
    });
  }
  return new Promise((resolve) => {
    try {
      const raw = localStorage.getItem(CS.CONFIG.STORAGE_KEY);
      if (raw) {
        const normalized = CS.normalizeState(JSON.parse(raw));
        CS.saveState(normalized);
        resolve(normalized);
        return;
      }
    } catch (e) { /* ignore corrupt storage, fall through to fresh state */ }
    const fresh = CS.freshState();
    CS.saveState(fresh);
    resolve(fresh);
  });
};

// Дополняет старые сохранённые состояния недостающими полями (например,
// после добавления новых механик вроде биржи или недвижимости) и лечит NaN,
// если он уже успел просочиться в сохранённое состояние.
CS.normalizeState = function (stored) {
  let changed = false;
  const state = Object.assign({}, CS.DEFAULT_STATE, stored);
  state.totalsToday = Object.assign({}, CS.DEFAULT_STATE.totalsToday, stored.totalsToday || {});

  const numericFields = ['cash', 'focus', 'burnout', 'level', 'xp', 'clickValue', 'stepProgress', 'interns',
    'equipLevel', 'coffeeLevel', 'rentTimer', 'debt'];
  numericFields.forEach((key) => {
    if (typeof state[key] !== 'number' || Number.isNaN(state[key])) {
      state[key] = CS.DEFAULT_STATE[key];
      changed = true;
    }
  });
  ['taps', 'chains', 'cash'].forEach((key) => {
    if (typeof state.totalsToday[key] !== 'number' || Number.isNaN(state.totalsToday[key])) {
      state.totalsToday[key] = 0;
      changed = true;
    }
  });

  if (!Array.isArray(state.history)) { state.history = []; changed = true; }
  if (!Array.isArray(state.puzzleOrder)) { state.puzzleOrder = []; changed = true; }
  if (!Array.isArray(state.findLayout)) { state.findLayout = []; changed = true; }
  if (!state.stockPrices || typeof state.stockPrices !== 'object') { state.stockPrices = {}; changed = true; }
  if (!state.stockHistory || typeof state.stockHistory !== 'object') { state.stockHistory = {}; changed = true; }
  if (!state.portfolio || typeof state.portfolio !== 'object') { state.portfolio = {}; changed = true; }
  if (!state.properties || typeof state.properties !== 'object') { state.properties = {}; changed = true; }

  if (CS.initMarket(state)) changed = true;
  if (CS.recomputeDerived(state)) changed = true;

  if (state.chainId === null || state.chainId === undefined || !CS.QUEST_POOL[state.chainId]) {
    CS.assignChain(state, Math.floor(Math.random() * CS.QUEST_POOL.length));
    changed = true;
  } else if (!CS.currentChain(state).steps[state.stepIndex]) {
    state.stepIndex = 0;
    state.stepProgress = 0;
    CS.prepareStepLayout(state, CS.currentChain(state).steps[0]);
    changed = true;
  }

  return changed ? state : stored;
};

CS.saveState = function (state) {
  if (CS._hasChromeStorage) {
    chrome.storage.local.set({ [CS.CONFIG.STORAGE_KEY]: state });
    return;
  }
  try {
    localStorage.setItem(CS.CONFIG.STORAGE_KEY, JSON.stringify(state));
    // localStorage's native 'storage' event doesn't fire in the tab that
    // wrote it, so dispatch a synthetic one for same-tab widgets (casino/invest iframes).
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
  CS.initMarket(state);
  CS.recomputeDerived(state);
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

// ---- Апгрейды: снижают "пустое" ожидание и дают смысл тратить кэш --------
CS.equipCost = function (state) {
  return Math.round(CS.CONFIG.EQUIP_BASE_COST * Math.pow(CS.CONFIG.EQUIP_COST_GROWTH, state.equipLevel));
};
CS.coffeeCost = function (state) {
  return Math.round(CS.CONFIG.COFFEE_BASE_COST * Math.pow(CS.CONFIG.COFFEE_COST_GROWTH, state.coffeeLevel));
};

CS.buyEquip = function (state) {
  const cost = CS.equipCost(state);
  if (state.cash < cost) return { success: false, cost };
  state.cash -= cost;
  state.equipLevel += 1;
  CS.recomputeDerived(state);
  state.history.unshift({ type: 'business', text: `Обновлено оборудование (ур. ${state.equipLevel}), -${cost}`, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  return { success: true, cost };
};

CS.buyCoffee = function (state) {
  const cost = CS.coffeeCost(state);
  if (state.cash < cost) return { success: false, cost };
  state.cash -= cost;
  state.coffeeLevel += 1;
  state.history.unshift({ type: 'business', text: `Куплена кофемашина (ур. ${state.coffeeLevel}), -${cost}`, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  return { success: true, cost };
};

// Пересчитывает производные величины (стоимость клика, стоимость фокуса за тап)
// после покупки апгрейдов или загрузки старого сохранения. Возвращает true,
// если что-то изменилось (полезно для normalizeState).
CS.recomputeDerived = function (state) {
  const newClickValue = CS.CONFIG.BASE_CLICK_VALUE + state.equipLevel * CS.CONFIG.EQUIP_CLICK_BONUS;
  const changed = state.clickValue !== newClickValue;
  state.clickValue = newClickValue;
  return changed;
};

CS.focusCostPerTap = function (state) {
  const saved = state.coffeeLevel * CS.CONFIG.COFFEE_FOCUS_SAVE;
  return Math.max(CS.CONFIG.COFFEE_MIN_FOCUS_COST, CS.CONFIG.FOCUS_COST_PER_TAP - saved);
};

// ---- Основные игровые действия ------------------------------------------

// Обычный тап по рабочей зоне (для шагов типа tap, и как "успешный клик" в find/puzzle)
CS.registerTap = function (state, comboMultiplier) {
  const step = CS.currentStep(state);
  const gained = Math.round(state.clickValue * (comboMultiplier || 1));
  state.cash += gained;
  state.focus = Math.max(0, state.focus - CS.focusCostPerTap(state));
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

// ============================================================================
// Биржа «Рынок Айти» — акции с динамической ценой.
// ============================================================================

CS.initMarket = function (state) {
  let changed = false;
  CS.STOCKS.forEach((s) => {
    if (typeof state.stockPrices[s.id] !== 'number' || Number.isNaN(state.stockPrices[s.id])) {
      state.stockPrices[s.id] = s.basePrice;
      changed = true;
    }
    if (!Array.isArray(state.stockHistory[s.id]) || state.stockHistory[s.id].length === 0) {
      state.stockHistory[s.id] = [state.stockPrices[s.id]];
      changed = true;
    }
    if (!state.portfolio[s.id]) {
      state.portfolio[s.id] = { shares: 0, avgCost: 0 };
      changed = true;
    }
  });
  return changed;
};

// Случайное блуждание цены раз в тик + редкие "новости"
CS.tickMarket = function (state) {
  CS.STOCKS.forEach((s) => {
    let price = state.stockPrices[s.id];
    let delta = (Math.random() * 2 - 1) * s.volatility;

    if (Math.random() < CS.CONFIG.STOCK_NEWS_CHANCE) {
      const [min, max] = CS.CONFIG.STOCK_NEWS_MAGNITUDE;
      const magnitude = min + Math.random() * (max - min);
      delta += (Math.random() < 0.5 ? -1 : 1) * magnitude;
    }

    price = Math.max(1, price * (1 + delta));
    state.stockPrices[s.id] = Math.round(price * 100) / 100;

    const hist = state.stockHistory[s.id];
    hist.push(state.stockPrices[s.id]);
    if (hist.length > CS.CONFIG.STOCK_HISTORY_LEN) hist.shift();
  });
};

CS.stockChangePct = function (state, id) {
  const hist = state.stockHistory[id];
  if (!hist || hist.length < 2) return 0;
  const first = hist[0];
  const last = hist[hist.length - 1];
  if (!first) return 0;
  return ((last - first) / first) * 100;
};

CS.buyStock = function (state, id, qty) {
  const stock = CS.STOCKS.find((s) => s.id === id);
  if (!stock || qty <= 0) return { success: false, reason: 'bad-request' };
  const price = state.stockPrices[id];
  const cost = Math.round(price * qty * (1 + CS.CONFIG.STOCK_TRADE_FEE));
  if (state.cash < cost) return { success: false, reason: 'no-cash', cost };

  state.cash -= cost;
  const holding = state.portfolio[id] || { shares: 0, avgCost: 0 };
  const totalCostBefore = holding.avgCost * holding.shares;
  holding.shares += qty;
  holding.avgCost = (totalCostBefore + price * qty) / holding.shares;
  state.portfolio[id] = holding;

  state.history.unshift({
    type: 'market',
    text: `Куплено ${qty}× ${stock.ticker} по ${price}₽ (-${cost})`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, cost };
};

CS.sellStock = function (state, id, qty) {
  const stock = CS.STOCKS.find((s) => s.id === id);
  const holding = state.portfolio[id];
  if (!stock || !holding || qty <= 0 || holding.shares < qty) return { success: false, reason: 'no-shares' };

  const price = state.stockPrices[id];
  const proceeds = Math.round(price * qty * (1 - CS.CONFIG.STOCK_TRADE_FEE));
  state.cash += proceeds;
  holding.shares -= qty;
  if (holding.shares <= 0) { holding.shares = 0; holding.avgCost = 0; }

  const pnlPerShare = price - holding.avgCost;
  const won = pnlPerShare >= 0 || holding.shares === 0;
  state.history.unshift({
    type: 'market',
    text: `Продано ${qty}× ${stock.ticker} по ${price}₽ (+${proceeds})`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, proceeds, won };
};

CS.portfolioValue = function (state) {
  let total = 0;
  CS.STOCKS.forEach((s) => {
    const h = state.portfolio[s.id];
    if (h && h.shares > 0) total += h.shares * state.stockPrices[s.id];
  });
  return total;
};

// ============================================================================
// Недвижимость — покупка объектов для пассивного дохода (с содержанием).
// ============================================================================

CS.propertyCost = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return Infinity;
  const owned = state.properties[id] || 0;
  return Math.round(prop.cost * Math.pow(CS.CONFIG.PROPERTY_COST_GROWTH, owned));
};

CS.buyProperty = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return { success: false };
  const cost = CS.propertyCost(state, id);
  if (state.cash < cost) return { success: false, cost };

  state.cash -= cost;
  state.properties[id] = (state.properties[id] || 0) + 1;
  state.history.unshift({
    type: 'realty',
    text: `Куплен объект «${prop.name}» №${state.properties[id]} (-${cost})`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, cost };
};

CS.propertyIncomeTotal = function (state) {
  return CS.PROPERTIES.reduce((sum, p) => sum + (state.properties[p.id] || 0) * p.income, 0);
};
CS.propertyUpkeepTotal = function (state) {
  return CS.PROPERTIES.reduce((sum, p) => sum + (state.properties[p.id] || 0) * p.upkeep, 0);
};
CS.propertyCount = function (state) {
  return CS.PROPERTIES.reduce((sum, p) => sum + (state.properties[p.id] || 0), 0);
};

// ============================================================================
// Аренда офиса — обязательный периодический расход. Без дохода игрок уходит
// в долг под проценты и получает штраф к выгоранию — стимул не залипать
// на пассивном ожидании и активно зарабатывать/инвестировать.
// ============================================================================

CS.currentRentAmount = function (state) {
  return Math.round(CS.CONFIG.RENT_BASE + state.level * CS.CONFIG.RENT_PER_LEVEL);
};

CS.chargeRent = function (state) {
  const rent = CS.currentRentAmount(state);
  if (state.cash >= rent) {
    state.cash -= rent;
    state.history.unshift({ type: 'rent', text: `Аренда офиса списана: -${rent}`, time: new Date().toLocaleTimeString() });
  } else {
    const shortfall = rent - state.cash;
    state.cash = 0;
    state.debt += shortfall;
    state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + CS.CONFIG.RENT_LATE_BURNOUT);
    state.history.unshift({ type: 'debt', text: `Не хватило на аренду! Долг +${Math.round(shortfall)}, стресс растёт`, time: new Date().toLocaleTimeString() });
  }
  state.history = state.history.slice(0, 20);
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

  const propertyNet = CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state);
  if (propertyNet !== 0) {
    state.cash = Math.max(0, state.cash + propertyNet);
    if (propertyNet > 0) state.totalsToday.cash += propertyNet;
  }

  CS.tickMarket(state);

  // аренда офиса
  state.rentTimer = (state.rentTimer || 0) + 1;
  if (state.rentTimer >= CS.CONFIG.RENT_INTERVAL_TICKS) {
    state.rentTimer = 0;
    CS.chargeRent(state);
  }

  // проценты и автосписание долга
  if (state.debt > 0) {
    state.debt += state.debt * CS.CONFIG.DEBT_INTEREST_PER_TICK;
    if (state.cash > 0) {
      const payment = Math.min(state.debt, state.cash * CS.CONFIG.DEBT_AUTOPAY_SHARE);
      state.debt -= payment;
      state.cash -= payment;
    }
    if (state.debt < 0.5) state.debt = 0;
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

// ============================================================================
// Банковская система — расширение состояния
// ============================================================================

// Добавляем банковские поля в DEFAULT_STATE
CS.DEFAULT_STATE.bank = {
  deposits: [],
  loans: [],
  mortgages: [],
  history: []
};

// Обновляем normalizeState для банка
const originalNormalize = CS.normalizeState;
CS.normalizeState = function(stored) {
  const state = originalNormalize(stored);
  if (!state.bank) {
    state.bank = JSON.parse(JSON.stringify(CS.DEFAULT_STATE.bank));
  }
  if (!Array.isArray(state.bank.deposits)) state.bank.deposits = [];
  if (!Array.isArray(state.bank.loans)) state.bank.loans = [];
  if (!Array.isArray(state.bank.mortgages)) state.bank.mortgages = [];
  if (!Array.isArray(state.bank.history)) state.bank.history = [];
  return state;
};