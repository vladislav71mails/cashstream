var CS = window.CS || (window.CS = {});

CS.boostName = function (defOrId) {
  var id = typeof defOrId === 'string' ? defOrId : (defOrId && defOrId.id);
  var def = typeof defOrId === 'object' ? defOrId : (CS.BOOSTER_DEFS || []).find(function (d) { return d.id === id; });
  var key = 'boost.' + id + '.name';
  if (id && CS.t && CS.I18N && CS.I18N[CS.getLang()] && CS.I18N[CS.getLang()][key]) return CS.t(key);
  return (def && def.name) || id || '';
};
CS.boostHint = function (defOrId) {
  var id = typeof defOrId === 'string' ? defOrId : (defOrId && defOrId.id);
  var def = typeof defOrId === 'object' ? defOrId : (CS.BOOSTER_DEFS || []).find(function (d) { return d.id === id; });
  var key = 'boost.' + id + '.hint';
  if (id && CS.t && CS.I18N && CS.I18N[CS.getLang()] && CS.I18N[CS.getLang()][key]) return CS.t(key);
  return (def && (def.hint || def.desc)) || '';
};
CS.cardName = function (defOrId) {
  var id = typeof defOrId === 'string' ? defOrId : (defOrId && defOrId.id);
  var def = typeof defOrId === 'object' ? defOrId : (CS.CARD_DEFS || []).find(function (d) { return d.id === id; });
  var key = 'card.' + id + '.name';
  if (id && CS.t && CS.I18N && CS.I18N[CS.getLang()] && CS.I18N[CS.getLang()][key]) return CS.t(key);
  return (def && def.name) || id || '';
};
CS.cardHint = function (defOrId) {
  var id = typeof defOrId === 'string' ? defOrId : (defOrId && defOrId.id);
  var def = typeof defOrId === 'object' ? defOrId : (CS.CARD_DEFS || []).find(function (d) { return d.id === id; });
  var key = 'card.' + id + '.hint';
  if (id && CS.t && CS.I18N && CS.I18N[CS.getLang()] && CS.I18N[CS.getLang()][key]) return CS.t(key);
  return (def && def.hint) || '';
};

// КЭШ.СТРИМ — временные бустеры, коллекционные карточки, реклама / поддержка
var CS = window.CS || (window.CS = {});

// ---------------------------------------------------------------------------
// Каталог временных бустеров
// durationTicks — длительность в секундах (1 тик = 1 с)
// costCash — цена покупки за игровой кэш (дорого, чтобы не ломать экономику)
// Бесплатно: claimFreeBooster (кулдаун) или claimAdReward (если включена реальная реклама)
// ---------------------------------------------------------------------------
CS.BOOSTER_DEFS = [
  {
    id: 'income_x2',
    name: 'Двойной поток',
    icon: '⚡',
    tagline: '×2 весь доход на 60 с',
    durationTicks: 60,
    costCash: 180,
    effects: { incomeMult: 2, clickMult: 2 }
  },
  {
    id: 'click_x3',
    name: 'Яростный клик',
    icon: '🖱️',
    tagline: '×3 клики на 45 с',
    durationTicks: 45,
    costCash: 140,
    effects: { clickMult: 3 }
  },
  {
    id: 'cashback_25',
    name: 'Кэшбэк 25%',
    icon: '💳',
    tagline: '25% возврата с покупок 90 с',
    durationTicks: 90,
    costCash: 200,
    effects: { cashback: 0.25 }
  },
  {
    id: 'focus_shield',
    name: 'Щит фокуса',
    icon: '🛡️',
    tagline: '−40% расход фокуса, −30% выгорание 75 с',
    durationTicks: 75,
    costCash: 160,
    effects: { focusCostMult: 0.6, burnoutGainMult: 0.7 }
  },
  {
    id: 'lucky_hour',
    name: 'Счастливый час',
    icon: '🍀',
    tagline: '×1.5 доход + меньше шанс провала 50 с',
    durationTicks: 50,
    costCash: 150,
    effects: { incomeMult: 1.5, clickMult: 1.5, failChanceMult: 0.5 }
  },
  {
    id: 'mega_stream',
    name: 'Мега-стрим',
    icon: '🚀',
    tagline: '×2.5 всё на 30 с',
    durationTicks: 30,
    costCash: 280,
    effects: { incomeMult: 2.5, clickMult: 2.5 }
  }
];

// ---------------------------------------------------------------------------
// Коллекционные карточки (постоянные мелкие бонусы + коллекция)
// ---------------------------------------------------------------------------
CS.CARD_DEFS = [
  { id: 'card_intern',   name: 'Карточка стажёра',   icon: '🎓', bonus: { internIncomeMult: 1.08 }, hint: '+8% доход стажёров' },
  { id: 'card_click',    name: 'Карточка клика',     icon: '👆', bonus: { clickFlat: 0.25 },       hint: '+0.25 к базовому клику' },
  { id: 'card_rent',     name: 'Карточка аренды',    icon: '🏠', bonus: { rentMult: 0.92 },        hint: '−8% аренда' },
  { id: 'card_focus',    name: 'Карточка фокуса',    icon: '☕', bonus: { focusRegenMult: 1.15 },  hint: '+15% восстановление фокуса' },
  { id: 'card_lucky',    name: 'Карточка удачи',     icon: '🎰', bonus: { failChanceMult: 0.85 },  hint: '−15% шанс провала клика' },
  { id: 'card_tax',      name: 'Карточка ФНС',       icon: '📋', bonus: { taxRiskDecay: 1 },       hint: 'Быстрее затухает налоговый риск' },
  { id: 'card_crypto',   name: 'Карточка крипты',    icon: '₿',  bonus: { cryptoFeeMult: 0.9 },    hint: '−10% комиссии крипты (заготовка)' },
  { id: 'card_legend',   name: 'Легендарная карта',  icon: '👑', bonus: { incomeMult: 1.05 },      hint: '+5% весь доход' }
];

CS.ensureBoosters = function (state) {
  if (!state.boosters || typeof state.boosters !== 'object') {
    state.boosters = {
      active: [],           // { id, endsAtTick, effects }
      cards: {},            // id -> unlockedAt
      adCooldown: 0,        // тиков до следующей бесплатной рекламы
      adsWatched: 0,
      boostersUsed: 0,
      tickCounter: 0        // монотонный счётчик тиков для endsAt
    };
  }
  if (!Array.isArray(state.boosters.active)) state.boosters.active = [];
  if (!state.boosters.cards || typeof state.boosters.cards !== 'object') state.boosters.cards = {};
  if (typeof state.boosters.adCooldown !== 'number') state.boosters.adCooldown = 0;
  if (typeof state.boosters.adsWatched !== 'number') state.boosters.adsWatched = 0;
  if (typeof state.boosters.boostersUsed !== 'number') state.boosters.boostersUsed = 0;
  if (typeof state.boosters.tickCounter !== 'number') state.boosters.tickCounter = 0;
  return state.boosters;
};

CS.getBoosterDef = function (id) {
  return CS.BOOSTER_DEFS.find((b) => b.id === id) || null;
};

CS.getCardDef = function (id) {
  return CS.CARD_DEFS.find((c) => c.id === id) || null;
};

/** Суммарные эффекты всех активных бустеров + карточек */
CS.getBoosterEffects = function (state) {
  CS.ensureBoosters(state);
  const out = {
    incomeMult: 1,
    clickMult: 1,
    cashback: 0,
    focusCostMult: 1,
    burnoutGainMult: 1,
    failChanceMult: 1,
    internIncomeMult: 1,
    clickFlat: 0,
    rentMult: 1,
    focusRegenMult: 1
  };

  state.boosters.active.forEach((a) => {
    const e = a.effects || {};
    if (e.incomeMult) out.incomeMult *= e.incomeMult;
    if (e.clickMult) out.clickMult *= e.clickMult;
    if (e.cashback) out.cashback = Math.max(out.cashback, e.cashback);
    if (e.focusCostMult) out.focusCostMult *= e.focusCostMult;
    if (e.burnoutGainMult) out.burnoutGainMult *= e.burnoutGainMult;
    if (e.failChanceMult) out.failChanceMult *= e.failChanceMult;
  });

  Object.keys(state.boosters.cards).forEach((cid) => {
    const def = CS.getCardDef(cid);
    if (!def || !def.bonus) return;
    const b = def.bonus;
    if (b.incomeMult) out.incomeMult *= b.incomeMult;
    if (b.internIncomeMult) out.internIncomeMult *= b.internIncomeMult;
    if (b.clickFlat) out.clickFlat += b.clickFlat;
    if (b.rentMult) out.rentMult *= b.rentMult;
    if (b.focusRegenMult) out.focusRegenMult *= b.focusRegenMult;
    if (b.failChanceMult) out.failChanceMult *= b.failChanceMult;
  });

  return out;
};

CS.tickBoosters = function (state) {
  const b = CS.ensureBoosters(state);
  b.tickCounter = (b.tickCounter || 0) + 1;
  if (b.adCooldown > 0) b.adCooldown -= 1;

  const before = b.active.length;
  b.active = b.active.filter((a) => a.endsAtTick > b.tickCounter);
  if (b.active.length !== before && typeof CS.Audio !== 'undefined' && CS.Audio.play) {
    try { CS.Audio.play('click'); } catch (e) { /* ignore */ }
  }
};

/** Активировать бустер (добавить в active, продлить если уже есть тот же id) */
CS.activateBooster = function (state, boosterId) {
  const def = CS.getBoosterDef(boosterId);
  if (!def) return { success: false, reason: 'unknown' };
  const b = CS.ensureBoosters(state);
  const ends = b.tickCounter + def.durationTicks;

  const existing = b.active.find((a) => a.id === boosterId);
  if (existing) {
    existing.endsAtTick = Math.max(existing.endsAtTick, ends);
    existing.effects = def.effects;
  } else {
    b.active.push({
      id: boosterId,
      endsAtTick: ends,
      effects: Object.assign({}, def.effects)
    });
  }
  b.boostersUsed = (b.boostersUsed || 0) + 1;
  state.history.unshift({
    type: 'booster',
    text: `${def.icon} ${def.name} активен (${def.durationTicks}с)`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  CS.checkAchievements(state, { event: 'booster', id: boosterId });
  return { success: true, def };
};

/** Покупка выбранного бустера за игровой кэш (дорого). */
CS.buyBooster = function (state, boosterId) {
  const def = CS.getBoosterDef(boosterId);
  if (!def) return { success: false, reason: 'unknown' };
  const cost = Math.max(1, def.costCash || 0);
  if (state.cash < cost) return { success: false, reason: 'cash', cost };
  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;
  const result = CS.activateBooster(state, def.id);
  let hist = `Бустер «${def.name}» за ${cost}💰`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({ type: 'booster', text: hist, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);
  return { success: true, def, cost, cashback, activated: result.success };
};

/**
 * Внутренняя выдача бустера + шанс карточки (после кулдауна уже проверен).
 */
CS._grantBoosterReward = function (state, preferredId, meta) {
  const b = CS.ensureBoosters(state);
  let def = preferredId ? CS.getBoosterDef(preferredId) : null;
  if (!def) {
    def = CS.BOOSTER_DEFS[Math.floor(Math.random() * CS.BOOSTER_DEFS.length)];
  }

  const cd = CS.CONFIG.BOOSTER_FREE_COOLDOWN_TICKS || CS.CONFIG.AD_COOLDOWN_TICKS || 120;
  b.adCooldown = cd;
  b.adsWatched = (b.adsWatched || 0) + 1;

  const result = CS.activateBooster(state, def.id);

  let cardUnlocked = null;
  const cardChance = CS.CONFIG.BOOSTER_CARD_CHANCE != null ? CS.CONFIG.BOOSTER_CARD_CHANCE : 0.15;
  if (Math.random() < cardChance) {
    const locked = CS.CARD_DEFS.filter((c) => !b.cards[c.id]);
    if (locked.length) {
      const card = locked[Math.floor(Math.random() * locked.length)];
      b.cards[card.id] = Date.now();
      cardUnlocked = card;
      state.history.unshift({
        type: 'booster',
        text: `🃏 Получена карточка: ${card.name}`,
        time: new Date().toLocaleTimeString()
      });
      state.history = state.history.slice(0, 20);
      CS.checkAchievements(state, { event: 'card', id: card.id });
    }
  }

  CS.checkAchievements(state, { event: 'ad', count: b.adsWatched });
  const source = (meta && meta.source) || 'free';
  state.history.unshift({
    type: 'booster',
    text: source === 'ad'
      ? `📺 Бустер «${def.name}» за рекламу`
      : `☕ Бесплатный бустер «${def.name}» (перерыв)`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);

  return {
    success: true,
    booster: def,
    card: cardUnlocked,
    activated: result.success,
    source: source
  };
};

/**
 * Бесплатный бустер с кулдауном (без рекламы) — основной способ до монетизации.
 * preferredId — конкретный бустер или null = случайный.
 */
CS.claimFreeBooster = function (state, preferredId) {
  const b = CS.ensureBoosters(state);
  if (b.adCooldown > 0) {
    return { success: false, reason: 'cooldown', left: b.adCooldown };
  }
  return CS._grantBoosterReward(state, preferredId, { source: 'free' });
};

/**
 * Награда после реального просмотра рекламы (CS.Ads onRewarded).
 * Тот же кулдаун, что у бесплатного — чтобы не фармить оба канала подряд.
 */
CS.claimAdReward = function (state, preferredId) {
  const b = CS.ensureBoosters(state);
  if (b.adCooldown > 0) {
    return { success: false, reason: 'cooldown', left: b.adCooldown };
  }
  return CS._grantBoosterReward(state, preferredId, { source: 'ad' });
};

/** Реальная реклама доступна (yandex + block id + http(s))? */
CS.adsMonetizationEnabled = function () {
  const ads = (CS.CONFIG && CS.CONFIG.ADS) || {};
  if (ads.provider !== 'yandex') return false;
  if (!(ads.yandexBlockId || '').trim()) return false;
  if (typeof location === 'undefined') return false;
  return location.protocol === 'http:' || location.protocol === 'https:';
};

/** Применить кэшбэк к уже совершённой трате (вызвать сразу после cash -= cost) */
CS.applyCashback = function (state, spent) {
  if (spent <= 0) return 0;
  const rate = CS.getBoosterEffects(state).cashback || 0;
  if (rate <= 0) return 0;
  const back = Math.round(spent * rate);
  if (back <= 0) return 0;
  state.cash += back;
  state.totalsToday.cash += back;
  if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + back;
  return back;
};

CS.cardsUnlockedCount = function (state) {
  CS.ensureBoosters(state);
  return Object.keys(state.boosters.cards).length;
};

CS.activeBoostersSummary = function (state) {
  CS.ensureBoosters(state);
  const t = state.boosters.tickCounter || 0;
  return state.boosters.active.map((a) => {
    const def = CS.getBoosterDef(a.id);
    return {
      id: a.id,
      name: def ? (CS.boostName ? CS.boostName(def) : def.name) : a.id,
      icon: def ? def.icon : '⚡',
      left: Math.max(0, a.endsAtTick - t)
    };
  });
};
