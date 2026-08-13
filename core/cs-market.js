// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Биржа, недвижимость, налоговые хелперы ----
// ============================================================================
// Биржа «Рынок Айти» — акции с динамической ценой.
// ============================================================================

CS.initMarket = function (state) {
  let changed = false;
  if (CS.initCrypto(state)) changed = true;
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

CS.ensureInvest = function (state) {
  if (!state.invest || typeof state.invest !== 'object') state.invest = {};
  if (!state.invest.realtyPrices || typeof state.invest.realtyPrices !== 'object') state.invest.realtyPrices = {};
  if (!state.invest.renovationLevels || typeof state.invest.renovationLevels !== 'object') state.invest.renovationLevels = {};
  if (!state.invest.tenants || typeof state.invest.tenants !== 'object') state.invest.tenants = {};
  return state.invest;
};

CS.propertyCost = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return Infinity;
  const owned = state.properties[id] || 0;
  return Math.round(prop.cost * Math.pow(CS.CONFIG.PROPERTY_COST_GROWTH || 1.28, owned));
};

/** Рыночная цена для UI: база = propertyCost, лёгкая волатильность ±3%. */
CS.propertyMarketPrice = function (state, id) {
  const base = CS.propertyCost(state, id);
  if (!Number.isFinite(base)) return Infinity;
  const inv = CS.ensureInvest(state);
  // якорим отображаемую «котировку» к реальной стоимости, а не к 1000
  if (!inv.realtyPrices[id] || inv.realtyPrices[id] < base * 0.5) {
    inv.realtyPrices[id] = base;
  }
  const drift = 1 + (Math.random() - 0.5) * 0.06;
  return Math.max(1, Math.round(base * drift));
};

CS.renovationLevel = function (state, id) {
  const inv = CS.ensureInvest(state);
  return inv.renovationLevels[id] || 0;
};

CS.renovationCost = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return Infinity;
  const level = CS.renovationLevel(state, id);
  const max = CS.CONFIG.PROPERTY_RENOVATION_MAX || 5;
  if (level >= max) return Infinity;
  const share = CS.CONFIG.PROPERTY_RENOVATION_COST_SHARE || 0.28;
  const growth = CS.CONFIG.PROPERTY_RENOVATION_COST_GROWTH || 1.45;
  return Math.round(prop.cost * share * Math.pow(growth, level));
};

CS.buyProperty = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return { success: false, reason: 'unknown' };
  const cost = CS.propertyCost(state, id);
  if (state.cash < cost) return { success: false, reason: 'cash', cost };

  state.cash -= cost;
  const cashback = typeof CS.applyCashback === 'function' ? CS.applyCashback(state, cost) : 0;
  state.properties[id] = (state.properties[id] || 0) + 1;
  CS.ensureInvest(state).realtyPrices[id] = CS.propertyCost(state, id);
  if (state.lifetime) state.lifetime.purchases = (state.lifetime.purchases || 0) + 1;

  let hist = `Куплен объект «${prop.name}» №${state.properties[id]} (-${cost})`;
  if (cashback > 0) hist += ` (кэшбэк +${cashback})`;
  state.history.unshift({
    type: 'realty',
    text: hist,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, cost, cashback };
};

CS.sellProperty = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return { success: false, reason: 'unknown' };
  const owned = state.properties[id] || 0;
  if (owned <= 0) return { success: false, reason: 'none' };

  // цена продажи от стоимости «последнего» экземпляра
  const unitCost = Math.round(prop.cost * Math.pow(CS.CONFIG.PROPERTY_COST_GROWTH || 1.28, owned - 1));
  const proceeds = Math.round(unitCost * (CS.CONFIG.PROPERTY_SELL_SHARE || 0.72));
  state.properties[id] = owned - 1;
  state.cash += proceeds;
  CS.ensureInvest(state).realtyPrices[id] = CS.propertyCost(state, id);

  state.history.unshift({
    type: 'realty',
    text: `Продан объект «${prop.name}» (+${proceeds})`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, proceeds };
};

CS.renovateProperty = function (state, id) {
  const prop = CS.PROPERTIES.find((p) => p.id === id);
  if (!prop) return { success: false, reason: 'unknown' };
  if ((state.properties[id] || 0) <= 0) return { success: false, reason: 'none' };
  const level = CS.renovationLevel(state, id);
  const max = CS.CONFIG.PROPERTY_RENOVATION_MAX || 5;
  if (level >= max) return { success: false, reason: 'max', max };
  const cost = CS.renovationCost(state, id);
  if (state.cash < cost) return { success: false, reason: 'cash', cost };

  state.cash -= cost;
  CS.ensureInvest(state).renovationLevels[id] = level + 1;
  state.history.unshift({
    type: 'realty',
    text: `Ремонт «${prop.name}» → ур. ${level + 1} (-${cost})`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  return { success: true, cost, level: level + 1 };
};

/** Множитель дохода одного типа объекта: ремонт + арендатор. */
CS.propertyIncomeMult = function (state, id) {
  const inv = CS.ensureInvest(state);
  const ren = inv.renovationLevels[id] || 0;
  const bonus = CS.CONFIG.PROPERTY_RENOVATION_INCOME_BONUS || 0.12;
  let mult = 1 + ren * bonus;
  const tenant = inv.tenants[id] || 'none';
  if (tenant === 'residential') mult *= 1.15;
  else if (tenant === 'industrial') mult *= 1.28;
  return mult;
};

// Доход с недвижимости. У ООО +10%. Ремонт/арендаторы из state.invest учитываются.
// В налог попадает через lifetime.cashEarned (net > 0 каждый тик).
CS.propertyIncomeTotal = function (state) {
  const base = CS.PROPERTIES.reduce((sum, p) => {
    const n = state.properties[p.id] || 0;
    if (n <= 0) return sum;
    return sum + n * p.income * CS.propertyIncomeMult(state, p.id);
  }, 0);
  return CS.businessType(state) === 'ooo' ? base * 1.1 : base;
};
CS.propertyUpkeepTotal = function (state) {
  return CS.PROPERTIES.reduce((sum, p) => sum + (state.properties[p.id] || 0) * p.upkeep, 0);
};
CS.propertyCount = function (state) {
  return CS.PROPERTIES.reduce((sum, p) => sum + (state.properties[p.id] || 0), 0);
};

// ============================================================================
// Честный налоговый учёт
// ============================================================================

/**
 * Налогооблагаемый доход = весь учтённый заработок за жизнь.
 * В lifetime.cashEarned входят: клики, квесты, стажёры, net-доход недвижимости,
 * выигрыши казино, награды ачивок и т.п. (только положительные поступления).
 * Недвижимость: да, net > 0 каждый тик увеличивает базу.
 * Расходы (аренда, покупки, налог) базу не уменьшают — упрощённый «оборот/выручка».
 */
CS.getTaxableIncome = function (state) {
  if (!state) return 0;
  const earned = (state.lifetime && state.lifetime.cashEarned) || 0;
  const onec = CS.ensureOnec(state);
  if (!onec.taxes) onec.taxes = { totalIncome: 0, totalPaid: 0, rate: 0.13 };
  // синхронизируем отображаемую базу
  onec.taxes.totalIncome = Math.max(onec.taxes.totalIncome || 0, earned);
  return Math.max(0, Math.floor(earned));
};

CS.getTaxRate = function (state) {
  const type = CS.businessType(state);
  if (type === 'self' || type === 'ip') return 0.06;
  if (type === 'ooo') return 0.20;
  return 0.13;
};

CS.getTaxDue = function (state) {
  return Math.floor(CS.getTaxableIncome(state) * CS.getTaxRate(state));
};

CS.getTaxRemain = function (state) {
  const onec = CS.ensureOnec(state);
  const paid = (onec.taxes && onec.taxes.totalPaid) || 0;
  return Math.max(0, CS.getTaxDue(state) - paid);
};


// ============================================================================
// Крипторынок + дивиденды + опционы (тик в общем CS.tick, не только в iframe)
// ============================================================================

CS.CRYPTO_ASSETS = [
  { id: 'btc', name: 'Bitcoin',  ticker: 'BTC', icon: '₿', basePrice: 920,  volatility: 0.12 },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', icon: '⟠', basePrice: 310,  volatility: 0.15 },
  { id: 'sol', name: 'Solana',   ticker: 'SOL', icon: '◎', basePrice: 95,   volatility: 0.22 },
  { id: 'ada', name: 'Cardano',  ticker: 'ADA', icon: '₳', basePrice: 18,   volatility: 0.18 },
  { id: 'dot', name: 'Polkadot', ticker: 'DOT', icon: '●', basePrice: 42,   volatility: 0.20 }
];

CS.initCrypto = function (state) {
  let changed = false;
  if (!state.cryptoPrices || typeof state.cryptoPrices !== 'object') { state.cryptoPrices = {}; changed = true; }
  if (!state.cryptoPricesPrev || typeof state.cryptoPricesPrev !== 'object') { state.cryptoPricesPrev = {}; changed = true; }
  if (!state.cryptoWallet || typeof state.cryptoWallet !== 'object') { state.cryptoWallet = {}; changed = true; }
  CS.CRYPTO_ASSETS.forEach(function (c) {
    if (typeof state.cryptoPrices[c.id] !== 'number' || Number.isNaN(state.cryptoPrices[c.id])) {
      state.cryptoPrices[c.id] = c.basePrice;
      changed = true;
    }
    if (typeof state.cryptoWallet[c.id] !== 'number' || Number.isNaN(state.cryptoWallet[c.id])) {
      state.cryptoWallet[c.id] = 0;
      changed = true;
    }
  });
  if (typeof state.dividendTimer !== 'number' || Number.isNaN(state.dividendTimer)) {
    state.dividendTimer = 0;
    changed = true;
  }
  if (typeof state.marketIndex !== 'number') { state.marketIndex = 1000; changed = true; }
  if (typeof state.marketIndexChange !== 'number') { state.marketIndexChange = 0; changed = true; }
  return changed;
};

CS.tickCrypto = function (state) {
  CS.initCrypto(state);
  CS.CRYPTO_ASSETS.forEach(function (c) {
    var prev = state.cryptoPrices[c.id] || c.basePrice;
    var change = (Math.random() - 0.5) * c.volatility * 2;
    // редкий «памп/дамп»
    if (Math.random() < 0.03) change += (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.15);
    var next = Math.max(0.5, prev * (1 + change));
    state.cryptoPricesPrev[c.id] = prev;
    state.cryptoPrices[c.id] = Math.round(next * 100) / 100;
  });
};

/**
 * Годовая дивидендная доходность (доля 0..1) зависит от:
 * - волатильности бумаги (стабильные платят больше),
 * - цены относительно basePrice (дешёвые — выше yield),
 * - недавнего тренда (просадка → урезание дивиденда).
 */
CS.stockDividendYield = function (state, id) {
  var s = CS.STOCKS.find(function (x) { return x.id === id; });
  if (!s) return 0;
  var y = 0.018 + Math.max(0, 0.07 - (s.volatility || 0.04)) * 0.9;
  var price = (state.stockPrices && state.stockPrices[id]) || s.basePrice;
  var rel = price / s.basePrice;
  if (rel > 1.3) y *= 0.7;
  else if (rel > 1.1) y *= 0.85;
  else if (rel < 0.75) y *= 1.35;
  else if (rel < 0.9) y *= 1.15;
  var hist = (state.stockHistory && state.stockHistory[id]) || [];
  if (hist.length >= 8) {
    var mom = hist[hist.length - 1] / Math.max(0.01, hist[hist.length - 8]);
    if (mom < 0.88) y *= 0.35;
    else if (mom < 0.95) y *= 0.7;
    else if (mom > 1.2) y *= 0.8;
  }
  return Math.max(0.002, Math.min(0.12, y));
};

CS.tickDividends = function (state) {
  state.dividendTimer = (state.dividendTimer || 0) + 1;
  var interval = (CS.CONFIG && CS.CONFIG.DIVIDEND_INTERVAL_TICKS) || 40;
  if (state.dividendTimer < interval) return;
  state.dividendTimer = 0;

  var fraction = (CS.CONFIG && CS.CONFIG.DIVIDEND_PAYOUT_FRACTION) || 0.22;
  var total = 0;
  CS.STOCKS.forEach(function (s) {
    var h = state.portfolio && state.portfolio[s.id];
    if (!h || !h.shares || h.shares <= 0) return;
    var price = state.stockPrices[s.id] || s.basePrice;
    var y = CS.stockDividendYield(state, s.id);
    var pay = Math.round(h.shares * price * y * fraction * 100) / 100;
    if (pay < 0.5) return;
    total += pay;
    state.history.unshift({
      type: 'market',
      text: '💵 Дивиденды ' + s.ticker + ': +' + pay.toFixed(1) + '💰 (yield ~' + (y * 100).toFixed(1) + '%)',
      time: new Date().toLocaleTimeString()
    });
  });
  if (total > 0) {
    state.cash += total;
    state.totalsToday.cash = (state.totalsToday.cash || 0) + total;
    if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + total;
    state.history = state.history.slice(0, 20);
  }
};

CS.ensureInvestOptions = function (state) {
  CS.ensureInvest(state);
  if (!Array.isArray(state.invest.options)) state.invest.options = [];
  return state.invest.options;
};

/** Истечение опционов CALL/PUT по реальным ценам акций. */
CS.tickOptions = function (state) {
  var opts = CS.ensureInvestOptions(state);
  var changed = false;
  opts.forEach(function (opt) {
    if (opt.result !== null && opt.result !== undefined) return;
    if (!opt.startedAt) return;
    var elapsed = (Date.now() - opt.startedAt) / 1000;
    var expiry = opt.expiry || 45;
    if (elapsed < expiry) return;

    var currentPrice = (state.stockPrices && state.stockPrices[opt.stockId]) || opt.strike;
    var win = opt.type === 'call' ? (currentPrice > opt.strike) : (currentPrice < opt.strike);
    if (win) {
      state.cash += opt.amount * 2;
      if (state.lifetime) state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + opt.amount;
      opt.result = 'win';
    } else {
      opt.result = 'lose';
    }
    var stock = CS.STOCKS.find(function (s) { return s.id === opt.stockId; });
    state.history.unshift({
      type: 'market',
      text: 'Опцион ' + (stock ? stock.ticker : opt.stockId) + ' ' + String(opt.type).toUpperCase() + ': ' +
        (win ? ('+' + (opt.amount * 2) + '💰') : ('-' + opt.amount + '💰')),
      time: new Date().toLocaleTimeString()
    });
    state.history = state.history.slice(0, 20);
    changed = true;
  });
  // чистим закрытые старше 90с
  state.invest.options = opts.filter(function (o) {
    if (o.result === null || o.result === undefined) return true;
    return (Date.now() - o.startedAt) / 1000 < (o.expiry || 45) + 90;
  });
  return changed;
};

CS.tickMarketIndex = function (state) {
  if (!state.stockPrices) return;
  var values = Object.keys(state.stockPrices).map(function (k) { return state.stockPrices[k]; });
  if (!values.length) return;
  var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
  var prev = state.marketIndex || avg;
  state.marketIndexChange = prev ? ((avg / prev) - 1) * 100 : 0;
  state.marketIndex = Math.round(avg * 10) / 10;
};
