// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Статические данные: квесты, акции, недвижимость, DEFAULT_STATE ----
CS.TASK_ICONS = ['🔧', '✏️', '📎', '📊', '💻', '📞', '📁', '🖨️'];

// ---- Квестовые цепочки -----------------------------------------------------
// Каждая цепочка — 3 шага разных типов: tap / find / puzzle
CS.QUEST_POOL = [
  {
    id: 'strange_client',
    title: 'Странный заказчик',
    steps: [
      { type: 'find',   text: 'Найдите 3 ошибки в техзадании', target: 3 },
      { type: 'tap',    text: 'Позвоните заказчику и обсудите правки', target: 45 },
      { type: 'puzzle', text: 'Соберите коммерческое предложение по возрастанию цены', target: 4 }
    ]
  },
  {
    id: 'deadline_fire',
    title: 'Дедлайн горит',
    steps: [
      { type: 'tap',    text: 'Доверстайте лендинг до полуночи', target: 60 },
      { type: 'find',   text: 'Найдите баг во вёрстке', target: 3 },
      { type: 'tap',    text: 'Отправьте отчёт руководителю', target: 30 }
    ]
  },
  {
    id: 'new_intern',
    title: 'Новый стажёр',
    steps: [
      { type: 'puzzle', text: 'Проверьте прайс стажёра по возрастанию', target: 4 },
      { type: 'tap',    text: 'Проведите инструктаж', target: 35 },
      { type: 'find',   text: 'Найдите лишнюю скобку в коде', target: 3 }
    ]
  },
  {
    id: 'annual_report',
    title: 'Годовой отчёт',
    steps: [
      { type: 'tap',    text: 'Сведите таблицы Excel', target: 50 },
      { type: 'puzzle', text: 'Соберите смету по возрастанию', target: 4 },
      { type: 'find',   text: 'Найдите опечатку в презентации', target: 3 }
    ]
  },
  {
    id: 'urgent_meeting',
    title: 'Срочная планёрка',
    steps: [
      { type: 'find',   text: 'Найдите свободный переговорный слот', target: 3 },
      { type: 'tap',    text: 'Подготовьте слайды', target: 40 },
      { type: 'tap',    text: 'Разошлите протокол встречи', target: 25 }
    ]
  }
];

/** Локализованная копия цепочки для UI (оригинал QUEST_POOL не мутируем). */
CS.localizeQuest = function (quest) {
  if (!quest) return quest;
  var id = quest.id;
  var out = Object.assign({}, quest);
  if (id && CS._i18nHas && CS._i18nHas('quest.' + id + '.title')) {
    out.title = CS.t('quest.' + id + '.title');
  }
  if (Array.isArray(quest.steps)) {
    out.steps = quest.steps.map(function (s, i) {
      var step = Object.assign({}, s);
      var key = id ? ('quest.' + id + '.s' + i) : null;
      if (key && CS._i18nHas && CS._i18nHas(key)) step.text = CS.t(key);
      return step;
    });
  }
  return out;
};

CS.propertyName = function (propOrId) {
  var id = typeof propOrId === 'string' ? propOrId : (propOrId && propOrId.id);
  var def = typeof propOrId === 'object' ? propOrId : (CS.PROPERTIES || []).find(function (p) { return p.id === id; });
  var key = 'prop.' + id + '.name';
  if (id && CS._i18nHas && CS._i18nHas(key)) return CS.t(key);
  return (def && def.name) || id || '';
};

CS.stockName = function (stockOrId) {
  var id = typeof stockOrId === 'string' ? stockOrId : (stockOrId && stockOrId.id);
  var def = typeof stockOrId === 'object' ? stockOrId : (CS.STOCKS || []).find(function (s) { return s.id === id; });
  var key = 'stock.' + id + '.name';
  if (id && CS._i18nHas && CS._i18nHas(key)) return CS.t(key);
  return (def && def.name) || id || '';
};


// ---- Биржа «Рынок Айти»: список бумаг -------------------------------------
CS.STOCKS = [
  { id: 'byte',  name: 'ByteCorp',      ticker: 'BYTE', basePrice: 120, volatility: 0.035 },
  { id: 'neon',  name: 'NeonSoft',      ticker: 'NEON', basePrice: 58,  volatility: 0.055 },
  { id: 'quant', name: 'КвантТех',      ticker: 'QTEH', basePrice: 310, volatility: 0.028 },
  { id: 'pix',   name: 'ПиксельЛаб',    ticker: 'PIXL', basePrice: 24,  volatility: 0.075 },
  { id: 'cloud', name: 'ОблакоНет',     ticker: 'CLDN', basePrice: 155, volatility: 0.045 }
];

// ---- Недвижимость: объекты для пассивного дохода ---------------------------
// cost — цена первой покупки (UI обязан использовать prop.cost / CS.propertyCost,
// а не basePrice||1000). Доход намеренно скромный относительно цены.
CS.PROPERTIES = [
  { id: 'flat',      name: 'Студия у МКАД',  cost: 2200,  income: 0.45, upkeep: 0.18, icon: '🏚️' },
  { id: 'office',    name: 'Мини-офис',       cost: 6500,  income: 1.4,  upkeep: 0.55, icon: '🏢' },
  { id: 'coworking', name: 'Коворкинг-этаж',  cost: 16000, income: 3.2,  upkeep: 1.3,  icon: '🏬' },
  { id: 'tower',     name: 'Бизнес-центр',    cost: 42000, income: 7.5,  upkeep: 3.2,  icon: '🌆' }
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
  projectManagers: 0,
  history: [],
  totalsToday: { cash: 0, taps: 0, chains: 0 },

  // экономика
  equipLevel: 0,
  coffeeLevel: 0,
  chairLevel: 0,
  monitorLevel: 0,
  rentTimer: 0,
  debt: 0,
  taxRisk: 0,
  stockPrices: {},
  stockHistory: {},
  portfolio: {},
  properties: {},

  // Мягкий старт + обучение
  economyActive: false,     // false = льготный период (нет аренды/процентов)
  graceTicksLeft: 120,      // сколько тиков осталось до авто-старта экономики
  tutorialDone: false,
  tutorialStep: 0,          // 0..N шагов онбординга

  // Достижения: { unlocked: { id: timestamp }, progress: { id: number } }
  achievements: { unlocked: {}, progress: {} },

  // lifetime-счётчики для ачивок (не сбрасываются «сегодня»)
  lifetime: { taps: 0, chains: 0, cashEarned: 0, purchases: 0, casinoPlays: 0, eventsHandled: 0 },

  // Случайные события: активное (ждёт выбора) и кулдаун
  activeEvent: null,          // { id, title, body, icon, choices, ... } или null
  eventCooldown: 0,           // тиков до следующего возможного события

  // Настройки компьютера (звук, загрузка)
  settings: { sound: true, volume: 0.45, bootAnim: true, lang: 'auto' },

  // Почтовый клиент
  mail: {
    messages: [],
    nextId: 1,
    filters: [],
    lastSystemAt: 0,
    pushQueue: []
  },

  // Магазин: браузер и почта предустановлены (системные «бесплатные» приложения)
  apps: { installed: ['browser', 'mail'] },

  // Временные бустеры и коллекционные карточки
  boosters: {
    active: [],
    cards: {},
    adCooldown: 0,
    adsWatched: 0,
    boostersUsed: 0,
    tickCounter: 0
  }
};
