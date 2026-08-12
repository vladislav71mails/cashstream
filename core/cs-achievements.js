// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Достижения и обучение ----
// ============================================================================
// Система достижений / ачивок
// ============================================================================

CS.ACHIEVEMENTS = [
  {
    id: 'first_tap',
    title: 'Первый клик',
    desc: 'Сделайте первый клик в рабочей зоне',
    icon: '👆',
    condition: (s) => (s.lifetime && s.lifetime.taps >= 1),
    reward: { cash: 15 }
  },
  {
    id: 'taps_50',
    title: 'Разгон',
    desc: 'Сделайте 50 кликов',
    icon: '⌨️',
    condition: (s) => (s.lifetime && s.lifetime.taps >= 50),
    reward: { cash: 40 }
  },
  {
    id: 'taps_500',
    title: 'Машина кликов',
    desc: 'Сделайте 500 кликов',
    icon: '🖱️',
    condition: (s) => (s.lifetime && s.lifetime.taps >= 500),
    reward: { cash: 120, focus: 15 }
  },
  {
    id: 'taps_1000',
    title: '1000 кликов',
    desc: 'Сделайте 1000 кликов за всё время',
    icon: '💯',
    condition: (s) => (s.lifetime && s.lifetime.taps >= 1000),
    reward: { cash: 250 }
  },
  {
    id: 'first_chain',
    title: 'Первый заказ',
    desc: 'Завершите первую цепочку заданий',
    icon: '📋',
    condition: (s) => (s.lifetime && s.lifetime.chains >= 1),
    reward: { cash: 50, focus: 10 }
  },
  {
    id: 'chains_5',
    title: 'Надёжный исполнитель',
    desc: 'Завершите 5 цепочек заданий',
    icon: '✅',
    condition: (s) => (s.lifetime && s.lifetime.chains >= 5),
    reward: { cash: 100 }
  },
  {
    id: 'first_purchase',
    title: 'Первая покупка',
    desc: 'Купите оборудование, кофе или наймите стажёра',
    icon: '🛒',
    condition: (s) => (s.lifetime && s.lifetime.purchases >= 1),
    reward: { cash: 30 }
  },
  {
    id: 'equip_3',
    title: 'Прокачанное место',
    desc: 'Доведите оборудование до 3 уровня',
    icon: '🛠️',
    condition: (s) => (s.equipLevel >= 3),
    reward: { cash: 80 }
  },
  {
    id: 'intern_1',
    title: 'Наставник',
    desc: 'Наймите первого стажёра',
    icon: '🧑‍💼',
    condition: (s) => (s.interns >= 1),
    reward: { cash: 40 }
  },
  {
    id: 'level_3',
    title: 'Рост',
    desc: 'Достигните 3 уровня',
    icon: '📈',
    condition: (s) => (s.level >= 3),
    reward: { cash: 70, focus: 20 }
  },
  {
    id: 'level_5',
    title: 'Опытный фрилансер',
    desc: 'Достигните 5 уровня',
    icon: '⭐',
    condition: (s) => (s.level >= 5),
    reward: { cash: 150 }
  },
  {
    id: 'cash_500',
    title: 'Первая подушка',
    desc: 'Накопите 500💰 на счету',
    icon: '💰',
    condition: (s) => (s.cash >= 500),
    reward: { focus: 15 }
  },
  {
    id: 'cash_2000',
    title: 'Капитал',
    desc: 'Накопите 2000💰 на счету',
    icon: '🏦',
    condition: (s) => (s.cash >= 2000),
    reward: { cash: 100 }
  },
  {
    id: 'combo_max',
    title: 'В огне',
    desc: 'Достигните максимального комбо x3',
    icon: '🔥',
    condition: (s, ctx) => (ctx && ctx.event === 'tap' && (ctx.combo || 0) >= CS.CONFIG.COMBO_MAX),
    reward: { cash: 25, focus: 10 }
  },
  {
    id: 'casino_first',
    title: 'Перерыв',
    desc: 'Сыграйте хотя бы один раунд в казино',
    icon: '🎰',
    condition: (s) => (s.lifetime && s.lifetime.casinoPlays >= 1),
    reward: { cash: 20 }
  },
  {
    id: 'debt_100',
    title: 'В минусе',
    desc: 'Наберите долг от 100💰',
    icon: '💳',
    condition: (s) => ((s.debt || 0) >= 100),
    reward: { cash: 10 }
  },
  {
    id: 'bankrupt',
    title: 'Банкрот',
    desc: 'Долг ≥ 500 при нулевом кэше',
    icon: '💀',
    condition: (s) => ((s.debt || 0) >= 500 && (s.cash || 0) < 1),
    reward: { cash: 50, focus: 25 }
  },
  {
    id: 'economy_started',
    title: 'Офис открыт',
    desc: 'Экономика (аренда) активирована',
    icon: '🏠',
    condition: (s) => !!s.economyActive,
    reward: { cash: 20 }
  },
  {
    id: 'tutorial_done',
    title: 'Выпускник',
    desc: 'Пройдите короткое обучение',
    icon: '🎓',
    condition: (s) => !!s.tutorialDone,
    reward: { cash: 35, focus: 15 }
  },
  {
    id: 'earned_1000',
    title: 'Тысячник',
    desc: 'Заработайте суммарно 1000💰 за всё время',
    icon: '📊',
    condition: (s) => (s.lifetime && s.lifetime.cashEarned >= 1000),
    reward: { cash: 60 }
  },
  {
    id: 'crisis_1',
    title: 'Первый кризис',
    desc: 'Переживите первое случайное событие',
    icon: '⚡',
    condition: (s) => (s.lifetime && s.lifetime.eventsHandled >= 1),
    reward: { cash: 25, focus: 10 }
  },
  {
    id: 'crisis_5',
    title: 'Закалённый',
    desc: 'Переживите 5 случайных событий',
    icon: '🛡️',
    condition: (s) => (s.lifetime && s.lifetime.eventsHandled >= 5),
    reward: { cash: 100 }
  },
  {
    id: 'crisis_15',
    title: 'Ветеран хаоса',
    desc: 'Переживите 15 случайных событий',
    icon: '🧯',
    condition: (s) => (s.lifetime && s.lifetime.eventsHandled >= 15),
    reward: { cash: 200, focus: 20 }
  }
];

CS.ensureAchievements = function (state) {
  if (!state.achievements || typeof state.achievements !== 'object') {
    state.achievements = { unlocked: {}, progress: {} };
  }
  if (!state.achievements.unlocked) state.achievements.unlocked = {};
  if (!state.achievements.progress) state.achievements.progress = {};
  return state.achievements;
};

CS.isAchievementUnlocked = function (state, id) {
  return !!CS.ensureAchievements(state).unlocked[id];
};

/** Попытка разблокировать. Возвращает def или null. Награда применяется сразу. */
CS.tryUnlockAchievement = function (state, id) {
  if (CS.isAchievementUnlocked(state, id)) return null;
  const def = CS.ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return null;
  const bag = CS.ensureAchievements(state);
  bag.unlocked[id] = Date.now();
  const reward = def.reward || {};
  if (reward.cash) {
    state.cash += reward.cash;
    if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + reward.cash;
  }
  if (reward.focus) {
    state.focus = Math.min(CS.CONFIG.MAX_FOCUS, state.focus + reward.focus);
  }
  state.history.unshift({
    type: 'achievement',
    text: `🏆 Достижение: «${def.title}»` + (reward.cash ? ` (+${reward.cash}💰)` : '') + (reward.focus ? ` (+${reward.focus}⭐)` : ''),
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  // очередь тостов для UI
  if (!state._achievementQueue) state._achievementQueue = [];
  state._achievementQueue.push({ id: def.id, title: def.title, icon: def.icon, reward });
  return def;
};

/** Проверить все условия. ctx — опциональный контекст события. */
CS.checkAchievements = function (state, ctx) {
  if (!state) return;
  CS.ensureAchievements(state);
  CS.ACHIEVEMENTS.forEach((def) => {
    if (CS.isAchievementUnlocked(state, def.id)) return;
    try {
      if (def.condition(state, ctx || {})) {
        CS.tryUnlockAchievement(state, def.id);
      }
    } catch (e) { /* ignore bad condition */ }
  });
};

CS.achievementProgressList = function (state) {
  CS.ensureAchievements(state);
  return CS.ACHIEVEMENTS.map((def) => {
    const unlocked = CS.isAchievementUnlocked(state, def.id);
    let progress = null;
    // эвристики прогресса для UI
    if (def.id.startsWith('taps_') || def.id === 'first_tap') {
      const need = def.id === 'first_tap' ? 1 : parseInt(def.id.replace('taps_', ''), 10);
      progress = { current: (state.lifetime && state.lifetime.taps) || 0, need };
    } else if (def.id.startsWith('chains_') || def.id === 'first_chain') {
      const need = def.id === 'first_chain' ? 1 : parseInt(def.id.replace('chains_', ''), 10);
      progress = { current: (state.lifetime && state.lifetime.chains) || 0, need };
    } else if (def.id === 'earned_1000') {
      progress = { current: Math.floor((state.lifetime && state.lifetime.cashEarned) || 0), need: 1000 };
    } else if (def.id === 'crisis_1' || def.id === 'crisis_5' || def.id === 'crisis_15') {
      const need = def.id === 'crisis_1' ? 1 : (def.id === 'crisis_5' ? 5 : 15);
      progress = { current: (state.lifetime && state.lifetime.eventsHandled) || 0, need };
    } else if (def.id === 'level_3' || def.id === 'level_5') {
      progress = { current: state.level || 1, need: def.id === 'level_3' ? 3 : 5 };
    } else if (def.id === 'equip_3') {
      progress = { current: state.equipLevel || 0, need: 3 };
    } else if (def.id === 'cash_500' || def.id === 'cash_2000') {
      progress = { current: Math.floor(state.cash || 0), need: def.id === 'cash_500' ? 500 : 2000 };
    }
    return {
      id: def.id,
      title: def.title,
      desc: def.desc,
      icon: def.icon,
      unlocked,
      unlockedAt: unlocked ? state.achievements.unlocked[def.id] : null,
      reward: def.reward || {},
      progress
    };
  });
};

// ---- Обучение (tutorial) -------------------------------------------------

CS.TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в КЭШ.СТРИМ',
    body: 'Вы — фрилансер в офисе 90-х. Зарабатывайте кликами и квестами, не выгорайте и следите за арендой.\n\nСейчас действует льготный период: аренда ещё не списывается. У вас есть время освоиться.'
  },
  {
    id: 'work',
    title: 'Рабочая зона',
    body: 'Откройте «Работа.exe» (двойной клик по значку) и кликайте по зоне. Чем быстрее клики — тем выше комбо и доход.\n\nСледите за Фокусом: без него эффективность падает.'
  },
  {
    id: 'quests',
    title: 'Задания',
    body: 'В «Задачи.exe» видно текущую цепочку шагов: клики, поиск ошибок, головоломки.\n\nЗавершите первую цепочку — получите награду и запустите экономику офиса (аренду).'
  },
  {
    id: 'upgrades',
    title: 'Апгрейды и стажёры',
    body: 'В окне Задач можно улучшить оборудование (дороже клик), купить кофе (дешевле фокус) и нанять стажёров (пассивный доход).\n\nПервая покупка тоже снимает льготный период.'
  },
  {
    id: 'economy',
    title: 'Экономика',
    body: 'После льготы каждые 30 секунд списывается аренда. Не хватает денег — растёт долг и выгорание.\n\nБанк, инвестиции и казино помогут (или навредят). Удачи!'
  }
];

CS.advanceTutorial = function (state) {
  if (state.tutorialDone) return { done: true };
  state.tutorialStep = (state.tutorialStep || 0) + 1;
  if (state.tutorialStep >= CS.TUTORIAL_STEPS.length) {
    state.tutorialDone = true;
    state.tutorialStep = CS.TUTORIAL_STEPS.length;
    CS.tryUnlockAchievement(state, 'tutorial_done');
    return { done: true };
  }
  return { done: false, step: state.tutorialStep };
};

CS.skipTutorial = function (state) {
  state.tutorialDone = true;
  state.tutorialStep = CS.TUTORIAL_STEPS.length;
  CS.tryUnlockAchievement(state, 'tutorial_done');
};

CS.currentTutorialStep = function (state) {
  if (state.tutorialDone) return null;
  const idx = Math.min(state.tutorialStep || 0, CS.TUTORIAL_STEPS.length - 1);
  return CS.TUTORIAL_STEPS[idx];
};
