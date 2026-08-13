// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Кабинет учёта / регистрация / apps ----
// ============================================================================
// Бизнес и регистрация — статус влияет на риски, наём стажёров и банк.
// Центральное место для всех программ (Отчетность.exe, Банк.exe, рабочий
// стол), чтобы не дублировать логику и не расходиться в данных.
// ============================================================================

// «Кабинет учёта»: подписки, периоды, регистрация
CS.DEFAULT_ONEC = {
  installed: false,
  version: '1.0',
  targetVersion: '1.4',
  updated: false,
  patchesInstalled: 0,
  patchesNeeded: 2,
  directoriesLoaded: false,
  // Подписки: не «навсегда», а до игрового тика
  licensePaid: false,
  itsPaid: false,
  itsUntilTick: 0,
  reportingPaid: false,
  reportingUntilTick: 0,
  dirsUntilTick: 0,
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
    registeredAt: null,
    lifetimeIncome: 0,
    capWarned: false
  },
  // Налоговый период (последовательность сдачи)
  period: {
    id: 1,
    diagnosed: false,
    declared: false,   // декларация сформирована
    taxPaid: false,    // налог за период уплачен
    submitted: false   // отправлено в ФНС
  },
  reportsSubmitted: 0,
  lastReportAt: null,
  taxes: { totalIncome: 0, totalPaid: 0, rate: 0.13 },
  maintenanceLog: []
};

/** Книга учёта: откуда доход / куда расход */
CS.ensureLedger = function (state) {
  if (!state.ledger || typeof state.ledger !== 'object') {
    state.ledger = {
      income: { click: 0, freelance: 0, property: 0, intern: 0, casino: 0, other: 0 },
      expense: { rent: 0, tax: 0, penalty: 0, purchase: 0, debt: 0, other: 0 }
    };
  }
  ['click', 'freelance', 'property', 'intern', 'casino', 'other'].forEach(function (k) {
    if (typeof state.ledger.income[k] !== 'number') state.ledger.income[k] = 0;
  });
  ['rent', 'tax', 'penalty', 'purchase', 'debt', 'other'].forEach(function (k) {
    if (typeof state.ledger.expense[k] !== 'number') state.ledger.expense[k] = 0;
  });
  return state.ledger;
};

CS.recordIncome = function (state, cat, amount) {
  if (!amount || amount <= 0) return;
  var L = CS.ensureLedger(state);
  if (L.income[cat] == null) cat = 'other';
  L.income[cat] += amount;
};

CS.recordExpense = function (state, cat, amount) {
  if (!amount || amount <= 0) return;
  var L = CS.ensureLedger(state);
  if (L.expense[cat] == null) cat = 'other';
  L.expense[cat] += amount;
};

CS.ensureOnec = function (state) {
  if (!state.stats) state.stats = { history: [], transactions: [] };
  if (!state.stats.onec) state.stats.onec = JSON.parse(JSON.stringify(CS.DEFAULT_ONEC));
  var o = state.stats.onec;
  if (!o.registration) {
    o.registration = JSON.parse(JSON.stringify(CS.DEFAULT_ONEC.registration));
  }
  if (!o.period) {
    o.period = JSON.parse(JSON.stringify(CS.DEFAULT_ONEC.period));
  }
  if (typeof o.itsUntilTick !== 'number') o.itsUntilTick = o.itsPaid ? 999999 : 0;
  if (typeof o.reportingUntilTick !== 'number') o.reportingUntilTick = o.reportingPaid ? 999999 : 0;
  if (typeof o.dirsUntilTick !== 'number') o.dirsUntilTick = o.directoriesLoaded ? 999999 : 0;
  CS.ensureLedger(state);
  return o;
};

/** Тик обслуживания кабинета: истечение подписок и справочников */
CS.tickAccounting = function (state) {
  var o = CS.ensureOnec(state);
  var tick = (state.freelance && state.freelance.tick) || 0;
  // fallback: монотонный счётчик
  if (!state._acctTick) state._acctTick = 0;
  state._acctTick += 1;
  tick = state._acctTick;

  if (o.itsPaid && o.itsUntilTick > 0 && tick > o.itsUntilTick) {
    o.itsPaid = false;
    o.updated = false;
    state.history.unshift({
      type: 'debt',
      text: (CS.t ? CS.t('biz.its_expired') : 'ITS expired'),
      time: new Date().toLocaleTimeString()
    });
    state.history = state.history.slice(0, 20);
  }
  if (o.reportingPaid && o.reportingUntilTick > 0 && tick > o.reportingUntilTick) {
    o.reportingPaid = false;
    state.history.unshift({
      type: 'debt',
      text: (CS.t ? CS.t('biz.reporting_expired') : 'Reporting expired'),
      time: new Date().toLocaleTimeString()
    });
    state.history = state.history.slice(0, 20);
  }
  if (o.directoriesLoaded && o.dirsUntilTick > 0 && tick > o.dirsUntilTick) {
    o.directoriesLoaded = false;
  }
};

CS.renameBusiness = function (state, newName) {
  var o = CS.ensureOnec(state);
  if (!o.registration.registered) return { success: false, reason: 'not_registered' };
  newName = String(newName || '').trim();
  if (newName.length < 2) return { success: false, reason: 'name' };
  var cost = o.registration.type === 'ooo' ? 80 : 40;
  if (state.cash < cost) return { success: false, reason: 'cash', cost: cost };
  state.cash -= cost;
  CS.recordExpense(state, 'other', cost);
  o.registration.name = newName;
  state.history.unshift({
    type: 'business',
    text: 'Смена наименования на «' + newName + '» (−' + cost + '💰)',
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, cost: cost, name: newName };
};

CS.startNewTaxPeriod = function (state) {
  var o = CS.ensureOnec(state);
  o.period.id = (o.period.id || 1) + 1;
  o.period.diagnosed = false;
  o.period.declared = false;
  o.period.taxPaid = false;
  o.period.submitted = false;
  return o.period;
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
        text: (CS.t ? CS.t('biz.self_limit') : ''),
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
      CS.notifyMail(state, 'tax_fine', (CS.t ? CS.t('biz.fine', { n: fine, s: CS.CONFIG.AUDIT_STRESS || 10 }) : ('fine '+fine)));
      state.history.unshift({
        type: 'debt',
        text: (CS.t ? CS.t('biz.audit') : 'audit'),
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
// Браузер и Почта тоже предустановлены (см. DEFAULT_STATE.apps + мигра в storage).
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
  }
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
  if (price > 0 && typeof CS.applyCashback === 'function') CS.applyCashback(state, price);
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
