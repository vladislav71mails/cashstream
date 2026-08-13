// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Квесты, клики, XP, апгрейды, стажёры ----
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

// currentChain / currentStep переопределяются в cs-freelance.js (активный заказ биржи)
CS.currentChain = function (state) {
  var q = CS.QUEST_POOL[state.chainId] || CS.QUEST_POOL[0];
  return CS.localizeQuest ? CS.localizeQuest(q) : q;
};

CS.currentStep = function (state) {
  const chain = CS.currentChain(state);
  const idx = Math.min(state.stepIndex || 0, chain.steps.length - 1);
  return chain.steps[idx];
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
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.equipLevel += 1;
  CS.recomputeDerived(state);
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  let hist = `Обновлено оборудование (ур. ${state.equipLevel}), -${cost}`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({ type: 'business', text: hist, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  CS.notifyMail(state, 'equip');
  if (!state.economyActive) CS.activateEconomy(state, 'purchase');
  CS.checkAchievements(state, { event: 'purchase', kind: 'equip' });
  return { success: true, cost, cashback };
};

CS.buyCoffee = function (state) {
  const cost = CS.coffeeCost(state);
  if (state.cash < cost) return { success: false, cost };
  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.coffeeLevel += 1;
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  let hist = `Куплена кофемашина (ур. ${state.coffeeLevel}), -${cost}`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({ type: 'business', text: hist, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  CS.notifyMail(state, 'coffee');
  if (!state.economyActive) CS.activateEconomy(state, 'purchase');
  CS.checkAchievements(state, { event: 'purchase', kind: 'coffee' });
  return { success: true, cost, cashback };
};

CS.chairCost = function (state) {
  return Math.round(CS.CONFIG.CHAIR_BASE_COST * Math.pow(CS.CONFIG.CHAIR_COST_GROWTH, state.chairLevel || 0));
};
CS.monitorCost = function (state) {
  return Math.round(CS.CONFIG.MONITOR_BASE_COST * Math.pow(CS.CONFIG.MONITOR_COST_GROWTH, state.monitorLevel || 0));
};

CS.buyChair = function (state) {
  const cost = CS.chairCost(state);
  if (state.cash < cost) return { success: false, cost };
  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.chairLevel = (state.chairLevel || 0) + 1;
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  let hist = `Кресло руководителя (ур. ${state.chairLevel}), -${cost}`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({ type: 'business', text: hist, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  if (!state.economyActive) CS.activateEconomy(state, 'purchase');
  CS.checkAchievements(state, { event: 'purchase', kind: 'chair' });
  return { success: true, cost, cashback };
};

CS.buyMonitor = function (state) {
  const cost = CS.monitorCost(state);
  if (state.cash < cost) return { success: false, cost };
  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.monitorLevel = (state.monitorLevel || 0) + 1;
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  let hist = `Второй монитор (ур. ${state.monitorLevel}), -${cost}`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({ type: 'business', text: hist, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  if (!state.economyActive) CS.activateEconomy(state, 'purchase');
  CS.checkAchievements(state, { event: 'purchase', kind: 'monitor' });
  return { success: true, cost, cashback };
};

/** Эффективное окно комбо с учётом мониторов */
CS.comboWindowMs = function (state) {
  const base = CS.CONFIG.COMBO_WINDOW_MS || 700;
  const bonus = (state.monitorLevel || 0) * (CS.CONFIG.MONITOR_COMBO_WINDOW_BONUS || 0);
  return base + bonus;
};

// Пересчитывает производные величины (стоимость клика, стоимость фокуса за тап)
// после покупки апгрейдов или загрузки старого сохранения. Возвращает true,
// если что-то изменилось (полезно для normalizeState).
CS.recomputeDerived = function (state) {
  let base = CS.CONFIG.BASE_CLICK_VALUE + state.equipLevel * CS.CONFIG.EQUIP_CLICK_BONUS;
  if (typeof CS.getBoosterEffects === 'function') {
    const fx = CS.getBoosterEffects(state);
    if (fx && fx.clickFlat) base += fx.clickFlat;
  }
  const newClickValue = base;
  const changed = state.clickValue !== newClickValue;
  state.clickValue = newClickValue;
  return changed;
};

CS.focusCostPerTap = function (state) {
  const saved = state.coffeeLevel * CS.CONFIG.COFFEE_FOCUS_SAVE;
  let cost = Math.max(CS.CONFIG.COFFEE_MIN_FOCUS_COST, CS.CONFIG.FOCUS_COST_PER_TAP - saved);
  if (typeof CS.getBoosterEffects === 'function') {
    const fx = CS.getBoosterEffects(state);
    if (fx && fx.focusCostMult) cost *= fx.focusCostMult;
  }
  return cost;
};

// ---- Основные игровые действия ------------------------------------------

/** Шанс провала клика из‑за выгорания (0…BURNOUT_FAIL_MAX_CHANCE). */
CS.burnoutFailChance = function (state) {
  const start = CS.CONFIG.BURNOUT_FAIL_START || 40;
  const maxC = CS.CONFIG.BURNOUT_FAIL_MAX_CHANCE || 0.55;
  const b = state.burnout || 0;
  if (b <= start) return 0;
  const t = (b - start) / Math.max(1, CS.CONFIG.MAX_BURNOUT - start);
  return Math.min(maxC, t * maxC);
};

/** Множитель дохода успешного клика при высоком выгорании (1 → меньше). */
CS.burnoutSuccessMult = function (state) {
  const penalty = CS.CONFIG.BURNOUT_SUCCESS_PENALTY || 0.35;
  const b = (state.burnout || 0) / CS.CONFIG.MAX_BURNOUT;
  return Math.max(0.4, 1 - penalty * b);
};

// Обычный тап по рабочей зоне (для шагов типа tap, и как "успешный клик" в find/puzzle)
CS.registerTap = function (state, comboMultiplier) {
  const step = CS.currentStep(state);
  const combo = comboMultiplier || 1;
  const fx = typeof CS.getBoosterEffects === 'function' ? CS.getBoosterEffects(state) : null;
  const clickMult = fx && fx.clickMult ? fx.clickMult : 1;
  const incomeMult = fx && fx.incomeMult ? fx.incomeMult : 1;
  const baseGain = state.clickValue * combo * clickMult * incomeMult;

  // Фокус и выгорание всегда: даже неудачный клик утомляет
  state.focus = Math.max(0, state.focus - CS.focusCostPerTap(state));
  let burnoutGain = CS.CONFIG.BURNOUT_GAIN_PER_TAP;
  // Кресло снижает набор выгорания за тап
  const chairSave = (state.chairLevel || 0) * (CS.CONFIG.CHAIR_BURNOUT_GAIN_SAVE || 0);
  if (chairSave > 0) burnoutGain *= Math.max(0.35, 1 - chairSave);
  if (fx && fx.burnoutGainMult) burnoutGain *= fx.burnoutGainMult;
  state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + burnoutGain);
  state.totalsToday.taps += 1;
  if (state.lifetime) state.lifetime.taps = (state.lifetime.taps || 0) + 1;

  let failChance = CS.burnoutFailChance(state);
  if (fx && fx.failChanceMult) failChance *= fx.failChanceMult;
  const failed = failChance > 0 && Math.random() < failChance;

  let gained = 0;
  if (failed) {
    // Провал: нет дохода, возможна потеря денег (опечатки, откат, штраф клиенту)
    const lossShare = CS.CONFIG.BURNOUT_FAIL_CASH_LOSS_SHARE || 0.5;
    const loss = Math.min(state.cash, Math.max(1, Math.round(baseGain * lossShare)));
    state.cash = Math.max(0, state.cash - loss);
    gained = -loss;
  } else {
    gained = Math.max(0, Math.round(baseGain * CS.burnoutSuccessMult(state)));
    state.cash += gained;
    state.totalsToday.cash += gained;
    if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + gained;
  }

  let stepCompleted = false;
  let chainCompleted = false;

  // Прогресс шага только при удачном клике — иначе «работа» не двигается
  if (!failed) {
    state.stepProgress += 1;
    if (state.freelance && state.freelance.active) {
      state.freelance.active.stepProgress = state.stepProgress;
    }
    if (state.stepProgress >= step.target) {
      stepCompleted = true;
    }
    if (stepCompleted) {
      chainCompleted = CS.advanceStep(state);
    }
  }

  CS.checkAchievements(state, { event: 'tap', combo, failed });
  return { gained, stepCompleted, chainCompleted, failed, failChance };
};

// Клик по элементу find/puzzle-мини-игры
CS.registerStepClick = function (state) {
  const step = CS.currentStep(state);
  state.stepProgress += 1;
  if (state.freelance && state.freelance.active) {
    state.freelance.active.stepProgress = state.stepProgress;
  }
  const bonus = 10 + state.level * 2;
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
  // Активный заказ с биржи
  if (state.freelance && state.freelance.active) {
    state.freelance.active.stepProgress = state.stepProgress;
    state.freelance.active.stepIndex = state.stepIndex;
    return CS.advanceFreelanceStep(state);
  }

  CS.addXp(state, CS.CONFIG.XP_PER_STEP);
  const chain = CS.currentChain(state);
  let chainCompleted = false;

  if (state.stepIndex + 1 < chain.steps.length) {
    state.stepIndex += 1;
    state.stepProgress = 0;
    const nextStep = chain.steps[state.stepIndex];
    CS.prepareStepLayout(state, nextStep);
  } else {
    const reward = 140 + state.level * 35;
    state.cash += reward;
    state.totalsToday.cash += reward;
    state.totalsToday.chains += 1;
    if (state.lifetime) {
      state.lifetime.chains = (state.lifetime.chains || 0) + 1;
      state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + reward;
    }
    CS.addXp(state, CS.CONFIG.XP_PER_CHAIN);
    state.history.unshift({
      type: 'quest',
      text: (CS.t ? CS.t('quest.done', { title: chain.title, n: reward }) : (`Квест «${chain.title}» (+${reward})`)),
      time: new Date().toLocaleTimeString()
    });
    state.history = state.history.slice(0, 20);
    const nextPool = Math.floor(Math.random() * CS.QUEST_POOL.length);
    CS.assignChain(state, nextPool);
    chainCompleted = true;

    if (!state.economyActive && CS.CONFIG.GRACE_END_ON_CHAIN) {
      CS.activateEconomy(state, 'chain');
    }
    CS.checkAchievements(state, { event: 'chain' });
  }
  return chainCompleted;
};

// ---- Стажёры: авто-клики (пассивный доход) -------------------------------
// Наём стажёров сверх одного «неофициального» требует легальной регистрации
// бизнеса (ИП/ООО) — см. секцию «Бизнес и регистрация» ниже.
CS.internCost = function (state) {
  return Math.round(CS.CONFIG.INTERN_BASE_COST * Math.pow(CS.CONFIG.INTERN_COST_GROWTH, state.interns));
};

CS.hireIntern = function (state) {
  const cap = CS.internCap(state);
  if (state.interns >= cap) {
    return { success: false, reason: 'cap', cap };
  }
  const cost = CS.internCost(state);
  if (state.cash < cost) return { success: false, reason: 'cash', cost };
  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.interns += 1;
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  let hist = `Нанят стажёр №${state.interns} (-${cost})`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({
    type: 'business',
    text: hist,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  CS.notifyMail(state, 'hire');
  if (!state.economyActive) CS.activateEconomy(state, 'purchase');
  CS.checkAchievements(state, { event: 'purchase', kind: 'intern' });
  return { success: true, cost };
};

// ---- Менеджеры проектов ---------------------------------------------------
CS.pmCost = function (state) {
  const n = state.projectManagers || 0;
  return Math.round(CS.CONFIG.PM_BASE_COST * Math.pow(CS.CONFIG.PM_COST_GROWTH, n));
};

CS.pmCap = function (state) {
  const type = CS.businessType(state);
  if (type === 'ip' || type === 'ooo') return Infinity;
  return CS.CONFIG.PM_CAP_UNREGISTERED || 0;
};

CS.hireProjectManager = function (state) {
  if (typeof state.projectManagers !== 'number') state.projectManagers = 0;
  const cap = CS.pmCap(state);
  if (state.projectManagers >= cap) {
    return { success: false, reason: 'cap', cap };
  }
  const cost = CS.pmCost(state);
  if (state.cash < cost) return { success: false, reason: 'cash', cost };
  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.projectManagers += 1;
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  let hist = `Нанят PM №${state.projectManagers} (-${cost})`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({
    type: 'business',
    text: hist,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  CS.notifyMail(state, 'hire_pm');
  if (!state.economyActive) CS.activateEconomy(state, 'purchase');
  CS.checkAchievements(state, { event: 'purchase', kind: 'pm' });
  return { success: true, cost };
};
