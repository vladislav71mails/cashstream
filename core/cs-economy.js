// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Аренда, долг, tick, grace, казино-результат ----
// ============================================================================
// Аренда офиса — обязательный периодический расход. Без дохода игрок уходит
// в долг под проценты и получает штраф к выгоранию — стимул не залипать
// на пассивном ожидании и активно зарабатывать/инвестировать.
// ============================================================================

CS.currentRentAmount = function (state) {
  let rent = CS.CONFIG.RENT_BASE + state.level * CS.CONFIG.RENT_PER_LEVEL;
  if (typeof CS.getBoosterEffects === 'function') {
    const fx = CS.getBoosterEffects(state);
    if (fx && fx.rentMult) rent *= fx.rentMult;
  }
  return Math.round(rent);
};

CS.chargeRent = function (state) {
  const rent = CS.currentRentAmount(state);
  if (state.cash >= rent) {
    state.cash -= rent;
    if (typeof CS.recordExpense === 'function') CS.recordExpense(state, 'rent', rent);
    state.history.unshift({ type: 'rent', text: (CS.t ? CS.t('eco.rent_paid', { n: rent }) : ('rent -'+rent)), time: new Date().toLocaleTimeString() });
  } else {
    const shortfall = rent - state.cash;
    if (typeof CS.recordExpense === 'function') CS.recordExpense(state, 'rent', state.cash);
    if (typeof CS.recordExpense === 'function') CS.recordExpense(state, 'debt', shortfall);
    state.cash = 0;
    state.debt += shortfall;
    state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + CS.CONFIG.RENT_LATE_BURNOUT);
    state.history.unshift({ type: 'debt', text: (CS.t ? CS.t('eco.rent_debt', { n: Math.round(shortfall) }) : ('debt '+shortfall)), time: new Date().toLocaleTimeString() });
  }
  state.history = state.history.slice(0, 20);
};

// Естественное восстановление / затухание в простое (вызывается таймером)
CS.tick = function (state) {
  // Бустеры тикаются первыми — эффекты применяются к доходу ниже
  if (typeof CS.tickBoosters === 'function') CS.tickBoosters(state);
  if (typeof CS.tickFreelance === 'function') CS.tickFreelance(state);
  const fx = typeof CS.getBoosterEffects === 'function' ? CS.getBoosterEffects(state) : null;

  const focusRegen = CS.CONFIG.FOCUS_REGEN_PER_TICK * (fx && fx.focusRegenMult ? fx.focusRegenMult : 1);
  state.focus = Math.min(CS.CONFIG.MAX_FOCUS, state.focus + focusRegen);
  let burnoutDecay = CS.CONFIG.BURNOUT_DECAY_PER_TICK;
  // Кресло ускоряет естественное снижение выгорания
  burnoutDecay += (state.chairLevel || 0) * (CS.CONFIG.CHAIR_BURNOUT_DECAY_BONUS || 0);
  state.burnout = Math.max(0, state.burnout - burnoutDecay);

  // Стажёры помогают на заказах (CS.tickInternOrderHelp). Пассив — только ИП/ООО (заготовка штата).
  if (state.interns > 0) {
    var bizType = null;
    try {
      if (state.stats && state.stats.onec && state.stats.onec.registration) {
        bizType = state.stats.onec.registration.type;
      }
    } catch (e) { /* ignore */ }
    if (bizType === 'ip' || bizType === 'ooo') {
      let income = state.interns * (CS.CONFIG.INTERN_INCOME_PER_TICK * 0.25);
      if (fx) {
        income *= (fx.internIncomeMult || 1) * (fx.incomeMult || 1);
      }
      state.cash += income;
      state.totalsToday.cash += income;
      if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + income;
      if (typeof CS.recordIncome === 'function') CS.recordIncome(state, 'intern', income);
    }
  }

  let propertyNet = CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state);
  if (propertyNet > 0 && fx && fx.incomeMult) propertyNet *= fx.incomeMult;
  if (propertyNet !== 0) {
    state.cash = Math.max(0, state.cash + propertyNet);
    if (propertyNet > 0) {
      state.totalsToday.cash += propertyNet;
      if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + propertyNet;
      if (typeof CS.recordIncome === 'function') CS.recordIncome(state, 'property', propertyNet);
    }
  }

  CS.tickMarket(state);
  if (typeof CS.tickCrypto === 'function') CS.tickCrypto(state);
  if (typeof CS.tickDividends === 'function') CS.tickDividends(state);
  if (typeof CS.tickOptions === 'function') CS.tickOptions(state);
  if (typeof CS.tickMarketIndex === 'function') CS.tickMarketIndex(state);

  // ---- Мягкий старт экономики ----
  if (!state.economyActive) {
    if (typeof state.graceTicksLeft !== 'number') state.graceTicksLeft = CS.CONFIG.GRACE_TICKS;
    state.graceTicksLeft = Math.max(0, state.graceTicksLeft - 1);
    if (state.graceTicksLeft <= 0) {
      CS.activateEconomy(state, 'time');
    }
    // Во время льготы аренда и проценты не крутятся
  } else {
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
  }

  // риск незарегистрированной/сверхлимитной деятельности (только после старта экономики)
  if (state.economyActive) {
    CS.businessTick(state);
  }
  if (typeof CS.tickAccounting === 'function') CS.tickAccounting(state);

  // системные письма (налоги, долг, спам)
  CS.maybeGenerateSystemMail(state);

  // случайные кризисные / удачные события (только после старта экономики)
  CS.maybeTriggerEvent(state);

  // проверка достижений по lifetime-метрикам
  CS.checkAchievements(state);
};

/** Включить экономику (аренда, проценты, ФНС). reason: 'time' | 'chain' | 'purchase' | 'manual' */
CS.activateEconomy = function (state, reason) {
  if (state.economyActive) return false;
  state.economyActive = true;
  state.graceTicksLeft = 0;
  state.rentTimer = 0;
  const reasonText = {
    time: 'истёк льготный период',
    chain: 'завершена первая цепочка заданий',
    purchase: 'совершена первая покупка',
    manual: 'обучение завершено'
  }[reason] || 'условия выполнены';
  state.history.unshift({
    type: 'system',
    text: `🏠 Экономика запущена (${reasonText}). Теперь списывается аренда офиса.`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  CS.addMail(state, {
    from: 'arenda@office.cash',
    subject: CS.t ? CS.t('mail.rent_on.subj') : 'Rent on',
    body: CS.t ? CS.t('mail.rent_on.body', { ticks: CS.CONFIG.RENT_INTERVAL_TICKS, amount: CS.currentRentAmount(state) }) : '',
    folder: 'inbox',
    tags: ['rent', 'system']
  });
  CS.tryUnlockAchievement(state, 'economy_started');
  return true;
};

// Результат раунда в казино прилетает сюда, чтобы обновить общий кэш/выгорание
CS.applyCasinoResult = function (state, cashDelta, historyText, win) {
  state.cash = Math.max(0, state.cash + cashDelta);
  state.burnout = Math.max(0, state.burnout - CS.CONFIG.CASINO_BURNOUT_RELIEF);
  if (state.lifetime) {
    state.lifetime.casinoPlays = (state.lifetime.casinoPlays || 0) + 1;
    if (cashDelta > 0) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + cashDelta;
  }
  state.history.unshift({
    type: 'casino',
    text: historyText,
    win,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  CS.checkAchievements(state, { event: 'casino', win: !!win, cashDelta });
};

CS.canAfford = function (state, amount) {
  return state.cash >= amount;
};

// Небольшой штраф фокуса за ошибочный клик в мини-играх find/puzzle
CS.registerMistake = function (state) {
  state.focus = Math.max(0, state.focus - 2);
};
