// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- 1С / регистрация / apps ----
// ============================================================================
// Бизнес и регистрация — статус влияет на риски, наём стажёров и банк.
// Центральное место для всех программ (Отчетность.exe, Банк.exe, рабочий
// стол), чтобы не дублировать логику и не расходиться в данных.
// ============================================================================

CS.DEFAULT_ONEC = {
  installed: false,
  version: '8.3.10',
  targetVersion: '8.3.27',
  updated: false,
  patchesInstalled: 0,
  patchesNeeded: 3,
  directoriesLoaded: false,
  licensePaid: false,
  itsPaid: false,
  reportingPaid: false,
  tokenBought: false,
  cryptoproInstalled: false,
  edsDrivers: false,
  skziLicense: false,
  agentInstalled: false,
  registration: {
    type: null,          // self | ip | ooo
    name: '',
    inn: '',
    ogrn: '',
    registered: false,
    lifetimeIncome: 0,   // накопленный доход самозанятого — для проверки лимита
    capWarned: false     // лимит самозанятого уже превышен
  },
  reportsSubmitted: 0,
  lastReportAt: null,
  taxes: { totalIncome: 0, totalPaid: 0, rate: 0.13 }
};

CS.ensureOnec = function (state) {
  if (!state.stats) state.stats = { history: [], transactions: [] };
  if (!state.stats.onec) state.stats.onec = JSON.parse(JSON.stringify(CS.DEFAULT_ONEC));
  if (!state.stats.onec.registration) {
    state.stats.onec.registration = JSON.parse(JSON.stringify(CS.DEFAULT_ONEC.registration));
  }
  return state.stats.onec;
};

// 'none' | 'self' | 'ip' | 'ooo'
CS.businessType = function (state) {
  const onec = CS.ensureOnec(state);
  return onec.registration.registered ? onec.registration.type : 'none';
};

CS.internCap = function (state) {
  const type = CS.businessType(state);
  return (type === 'ip' || type === 'ooo') ? Infinity : CS.CONFIG.INTERN_CAP_UNREGISTERED;
};

// null = без ограничений по рейтингу, иначе — метка максимально доступного рейтинга
CS.creditRatingCap = function (state) {
  const type = CS.businessType(state);
  if (type === 'ip' || type === 'ooo') return null;
  if (type === 'self') return 'A';
  return 'C';
};

// Раз в тик: копим/сбрасываем риск внеплановой проверки ФНС.
// - Без регистрации — риск всегда растёт от пассивного дохода.
// - Самозанятый — риска нет, пока не превышен лимит дохода; после —
//   деятельность становится «рискованной» точно так же, как без регистрации.
// - ИП/ООО — риска нет никогда.
CS.businessTick = function (state) {
  const onec = CS.ensureOnec(state);
  const reg = onec.registration;
  const type = CS.businessType(state);

  const passiveIncome = state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK +
    Math.max(0, CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state));

  let risky = (type === 'none');

  if (type === 'self') {
    // Лимит самозанятого считается по реальному заработку, а не по эвристике
    reg.lifetimeIncome = (state.lifetime && state.lifetime.cashEarned) || reg.lifetimeIncome || 0;
    if (!reg.capWarned && reg.lifetimeIncome > CS.CONFIG.SELF_EMPLOYED_INCOME_CAP) {
      reg.capWarned = true;
      state.history.unshift({
        type: 'debt',
        text: '⚠️ Доход превысил лимит самозанятого! Дальше — риск проверки ФНС, как без регистрации. Оформите ИП в Отчетность.exe.',
        time: new Date().toLocaleTimeString()
      });
      state.history = state.history.slice(0, 20);
    }
    risky = !!reg.capWarned;
  }

  if (risky) {
    state.taxRisk = (state.taxRisk || 0) + passiveIncome + 0.4;
    const chance = Math.min(
      CS.CONFIG.UNREG_AUDIT_MAX_CHANCE,
      CS.CONFIG.UNREG_AUDIT_BASE_CHANCE * (state.taxRisk / CS.CONFIG.UNREG_AUDIT_RISK_SCALE)
    );
    if (state.taxRisk > 5 && Math.random() < chance) {
      const fine = Math.round(Math.max(CS.CONFIG.UNREG_FINE_MIN, state.taxRisk * CS.CONFIG.UNREG_FINE_SHARE));
      if (state.cash >= fine) {
        state.cash -= fine;
      } else {
        const shortfall = fine - state.cash;
        state.cash = 0;
        state.debt = (state.debt || 0) + shortfall;
      }
      state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + CS.CONFIG.UNREG_BURNOUT_PENALTY);
      state.taxRisk = 0;
      CS.notifyMail(state, 'tax_fine', `Вам начислен штраф ${fine}💰 за незарегистрированную деятельность. Стресс +${CS.CONFIG.UNREG_BURNOUT_PENALTY}. Рекомендуем оформить ИП/ООО в «Отчетность.exe».`);
      state.history.unshift({
        type: 'debt',
        text: `🚨 Внеплановая проверка ФНС! Незарегистрированная деятельность — штраф ${fine}💰, стресс +${CS.CONFIG.UNREG_BURNOUT_PENALTY}`,
        time: new Date().toLocaleTimeString()
      });
      state.history = state.history.slice(0, 20);
    }
  } else {
    state.taxRisk = Math.max(0, (state.taxRisk || 0) - CS.CONFIG.UNREG_RISK_DECAY);
  }
};

// ============================================================================
// Магазин приложений — устанавливаемые программы. Часть из них добавляет
// значок на рабочий стол (fullpage.html подхватывает state.apps.installed
// и рисует иконки динамически), часть — просто снимает флаг-зависимость
// у уже существующих программ (например, КриптоПро CSP нужен Отчетность.exe).
// Основные программы (Задачи/Работа/Перерыв/Инвестиции/Банк/Статистика/
// Магазин) системные и всегда доступны — они не проходят через этот список.
// ============================================================================

CS.APP_CATALOG = [
  {
    id: 'browser',
    name: 'Браузер',
    icon: '🌐',
    tagline: 'Сайты для найма сотрудников, апгрейда офиса и заказов',
    price: 0,
    status: 'available',
    addsIcon: true
  },
  {
    id: 'mail',
    name: 'Почта',
    icon: '✉️',
    tagline: 'Системные уведомления, налоговая, трудоустройство и спам',
    price: 0,
    status: 'available',
    addsIcon: true
  },
  {
    id: 'crypto',
    name: 'ЭЦП и СКЗИ',
    icon: '🔐',
    tagline: 'Токен, драйверы и лицензия СКЗИ для электронной подписи',
    price: 150,
    status: 'available',
    addsIcon: true
  },
  {
    id: 'cryptopro',
    name: 'КриптоПро CSP',
    icon: '🧩',
    tagline: 'Криптопровайдер — нужен для сдачи отчётности в Отчетность.exe',
    price: 90,
    status: 'available',
    addsIcon: false,
    onInstall: function (state) { CS.ensureOnec(state).cryptoproInstalled = true; }
  },
  {
    id: 'achievements',
    name: 'Достижения',
    icon: '🏆',
    tagline: 'Трофеи и цели за игровой прогресс',
    price: 0,
    status: 'available',
    addsIcon: true
  },
  { id: 'startup',      name: 'Стартап',    icon: '🚀', tagline: 'Открой свой бизнес: кофейня, студия, агентство', status: 'soon' },
  { id: 'scripts',      name: 'Скрипты',    icon: '🤖', tagline: 'Автоматизация кликов и рутинных задач',          status: 'soon' },
  { id: 'guild',        name: 'Гильдия',    icon: '🤝', tagline: 'Совместные проекты с другими фрилансерами',       status: 'soon' },
  { id: 'blog',         name: 'Блог',       icon: '📝', tagline: 'Портфолио и подписчики — пассивный доход',        status: 'soon' },
  { id: 'news',         name: 'Новости',    icon: '📰', tagline: 'Игровые новости, влияющие на рынки',              status: 'soon' },
  { id: 'perks',        name: 'Навыки',     icon: '🌳', tagline: 'Дерево прокачки и пассивные бонусы',              status: 'soon' },
  { id: 'events',       name: 'События',    icon: '⚡', tagline: 'Случайные кризисы и как на них реагировать',      status: 'soon' }
];

CS.ensureApps = function (state) {
  if (!state.apps) state.apps = { installed: [] };
  if (!Array.isArray(state.apps.installed)) state.apps.installed = [];
  return state.apps;
};

CS.isAppInstalled = function (state, id) {
  return CS.ensureApps(state).installed.includes(id);
};

// Покупка/установка приложения из каталога. Возвращает { success, reason?, price? }.
CS.installApp = function (state, id) {
  const def = CS.APP_CATALOG.find((a) => a.id === id);
  if (!def) return { success: false, reason: 'unknown' };
  if (def.status === 'soon') return { success: false, reason: 'soon' };

  const apps = CS.ensureApps(state);
  if (apps.installed.includes(id)) return { success: false, reason: 'already' };

  const price = def.price || 0;
  if (state.cash < price) return { success: false, reason: 'cash', price };

  state.cash -= price;
  apps.installed.push(id);
  if (typeof def.onInstall === 'function') def.onInstall(state);

  state.history.unshift({
    type: 'business',
    text: `Установлено приложение «${def.name}»${price ? ` (-${price})` : ''}`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);

  return { success: true, price };
};
