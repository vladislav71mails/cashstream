// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Аренда, долг, tick, grace, казино-результат ----
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
    if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + income;
  }

  const propertyNet = CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state);
  if (propertyNet !== 0) {
    state.cash = Math.max(0, state.cash + propertyNet);
    if (propertyNet > 0) {
      state.totalsToday.cash += propertyNet;
      if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + propertyNet;
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
    subject: 'Добро пожаловать в офис — аренда активирована',
    body: `С этого момента каждые ${CS.CONFIG.RENT_INTERVAL_TICKS} сек. будет списываться аренда офиса.\nТекущая ставка: ~${CS.currentRentAmount(state)}💰.\nДержите запас кэша, чтобы не уходить в долг.\n\n— Управляющая компания`,
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
