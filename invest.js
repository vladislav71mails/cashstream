// ============================================================================
// «Инвестиции» — Фондовый рынок 2.0, Недвижимость, Криптобиржа, Майнинг,
// Опционы (на реальные акции игры)
// ============================================================================

let state = null;
const qtyByStock = {};
const qtyByCrypto = {};
const SELECTED_STOCK = {};

// Конфигурация криптовалют
const CRYPTO_CONFIG = [
  { id: 'btc', name: 'Bitcoin', ticker: 'BTC', icon: '₿', volatility: 0.15 },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', icon: '⟠', volatility: 0.20 },
  { id: 'sol', name: 'Solana', ticker: 'SOL', icon: '◎', volatility: 0.30 },
  { id: 'ada', name: 'Cardano', ticker: 'ADA', icon: '₳', volatility: 0.25 },
  { id: 'dot', name: 'Polkadot', ticker: 'DOT', icon: '●', volatility: 0.28 }
];

// Конфигурация майнингового оборудования (+ параметры риска)
const MINING_CONFIG = [
  { id: 'asic',  name: 'ASIC Майнер',      cost: 5000, hashrate: 100, powerCost: 2,   focusCost: 0.5, breakChance: 0.010, hackChance: 0.006, theftChance: 0.005, repairCost: 800 },
  { id: 'gpu',   name: 'GPU Майнинг',       cost: 2000, hashrate: 40,  powerCost: 1,   focusCost: 0.3, breakChance: 0.014, hackChance: 0.008, theftChance: 0.007, repairCost: 350 },
  { id: 'cpu',   name: 'CPU Майнинг',       cost: 500,  hashrate: 8,   powerCost: 0.3, focusCost: 0.1, breakChance: 0.020, hackChance: 0.010, theftChance: 0.010, repairCost: 90 },
  { id: 'cloud', name: 'Облачный майнинг',  cost: 1000, hashrate: 20,  powerCost: 0.5, focusCost: 0,   breakChance: 0.004, hackChance: 0.018, theftChance: 0.002, repairCost: 150 }
];

async function init() {
  try {
    state = await CS.loadState();

    // Инициализация структур данных
    if (!state.invest) {
      state.invest = {
        stocks: {},
        properties: {},
        crypto: {},
        mining: {},
        options: [],
        realtyPrices: {},
        renovationLevels: {},
        tenants: {}
      };
    }
    if (!state.invest.options) state.invest.options = [];

    // Инициализация крипто-кошелька
    if (!state.cryptoWallet) state.cryptoWallet = {};
    CRYPTO_CONFIG.forEach(c => {
      if (!state.cryptoWallet[c.id]) state.cryptoWallet[c.id] = 0;
    });

    // Инициализация майнинга (+ поля риска: сломан ли, когда чинили)
    MINING_CONFIG.forEach(m => {
      if (!state.invest.mining[m.id]) {
        state.invest.mining[m.id] = { active: false, startedAt: 0, owned: false, broken: false, incident: null };
      } else {
        if (state.invest.mining[m.id].broken === undefined) state.invest.mining[m.id].broken = false;
        if (state.invest.mining[m.id].incident === undefined) state.invest.mining[m.id].incident = null;
      }
    });

    CS.STOCKS.forEach((s) => {
      qtyByStock[s.id] = 1;
      SELECTED_STOCK[s.id] = 'buy';
    });
    CRYPTO_CONFIG.forEach((c) => { qtyByCrypto[c.id] = 1; });

    renderTopbar();
    renderStocks();
    renderProperties();
    renderCrypto();
    renderMining();
    renderOptions();

    // Вкладки
    document.querySelectorAll('.invest-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const section = tab.id.replace('Tab', 'Section');
        document.querySelectorAll('.invest-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.invest-section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(section);
        if (target) target.classList.add('active');
      });
    });

    CS.onStateChanged((newState) => {
      state = newState;
      renderTopbar();
      renderStocks();
      renderProperties();
      renderCrypto();
      renderMining();
      renderOptions();
    });

  } catch (err) {
    CS.reportFatalError(err);
  }
}

function renderTopbar() {
  document.getElementById('walletCash').textContent = Math.floor(state.cash);
  document.getElementById('portfolioValue').textContent = Math.floor(CS.portfolioValue(state));
  document.getElementById('realtyIncome').textContent =
    (CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state)).toFixed(1);

  // Стоимость крипто-портфеля
  let cryptoValue = 0;
  CRYPTO_CONFIG.forEach(c => {
    const price = state.cryptoPrices?.[c.id] || 100;
    const balance = state.cryptoWallet?.[c.id] || 0;
    cryptoValue += price * balance;
  });
  document.getElementById('cryptoValue').textContent = Math.floor(cryptoValue);

  // Крипто-кошелёк
  document.getElementById('cryptoWalletBalance').textContent =
    Math.floor(Object.values(state.cryptoWallet || {}).reduce((a, b) => a + b, 0));
}

// ---- Фондовый рынок 2.0 ----
function buildSparkline(history) {
  if (!history || history.length < 2) return '';
  const w = 100, h = 30;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = (max - min) || 1;
  const step = w / (history.length - 1);
  const points = history.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const rising = history[history.length - 1] >= history[0];
  const stroke = rising ? 'var(--up)' : 'var(--down)';
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${points}" style="stroke:${stroke}"></polyline>
  </svg>`;
}

// ---- Технический анализ вместо "читерского ИИ" ----
// Никакой магии: обычная скользящая средняя (SMA) и волатильность (стд. отклонение),
// как в настоящем терминале. Игрок сам учится читать графики, а не получает готовый ответ.
function sma(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function getStockTechnicals(stockId) {
  const history = state.stockHistory?.[stockId] || [];
  if (history.length < 6) return { trend: '⏳ Копим историю котировок…', vol: null };

  const shortMA = sma(history, 4);
  const longMA = sma(history, Math.min(history.length, 12));
  let trend;
  if (shortMA === null || longMA === null) {
    trend = '⏳ Недостаточно данных';
  } else {
    const diffPct = ((shortMA - longMA) / longMA) * 100;
    if (diffPct > 1.5) trend = `📈 SMA4 выше SMA12 на ${diffPct.toFixed(1)}% — восходящий тренд`;
    else if (diffPct < -1.5) trend = `📉 SMA4 ниже SMA12 на ${Math.abs(diffPct).toFixed(1)}% — нисходящий тренд`;
    else trend = `➡️ SMA4/SMA12 почти равны (${diffPct.toFixed(1)}%) — боковик`;
  }

  const dev = stdDev(history.slice(-10));
  const avg = history.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, history.length);
  const volPct = avg > 0 ? (dev / avg) * 100 : 0;
  let volLabel;
  if (volPct < 1.5) volLabel = '🟢 низкая';
  else if (volPct < 4) volLabel = '🟡 средняя';
  else volLabel = '🔴 высокая';

  return { trend, vol: `Волатильность: ${volLabel} (${volPct.toFixed(1)}%)` };
}

function renderStocks() {
  const list = document.getElementById('stockList');
  list.innerHTML = '';

  // Индекс
  const index = state.marketIndex || 1000;
  const indexChange = state.marketIndexChange || 0;
  document.getElementById('marketIndex').textContent = index.toFixed(1);
  const indexEl = document.getElementById('marketIndexChange');
  indexEl.textContent = (indexChange >= 0 ? '+' : '') + indexChange.toFixed(1) + '%';
  indexEl.className = indexChange >= 0 ? 'up' : 'down';

  CS.STOCKS.forEach((s) => {
    const price = state.stockPrices[s.id];
    const pct = CS.stockChangePct(state, s.id);
    const holding = state.portfolio[s.id] || { shares: 0, avgCost: 0 };
    const qty = qtyByStock[s.id];
    const tech = getStockTechnicals(s.id);
    const dividend = state.stockDividends?.[s.id] || s.dividendYield || 0;
    const maxAffordable = Math.max(0, Math.floor(state.cash / (price * (1 + CS.CONFIG.STOCK_TRADE_FEE))));

    const card = document.createElement('div');
    card.className = 'stock-card bevel-out';
    card.innerHTML = `
      <div class="stock-id">
        <span class="stock-name">${s.name}</span>
        <span class="stock-ticker">${s.ticker}</span>
        <span class="stock-prediction">📐 ${tech.trend}</span>
        ${tech.vol ? `<span class="stock-vol">${tech.vol}</span>` : ''}
        <span class="stock-dividend">💵 Дивиденды: ${(dividend * 100).toFixed(1)}%</span>
      </div>
      <div class="stock-price-box">
        <div class="stock-price">${price.toFixed(2)}₽</div>
        <div class="stock-change ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</div>
      </div>
      <div class="stock-graph">${buildSparkline(state.stockHistory[s.id])}</div>
      <div class="stock-actions">
        <div class="stock-qty-row" data-stock="${s.id}">
          ${[1, 5, 10, 25].map((n) => `<button class="win95-btn bevel-out qty-btn${n === qty ? ' active' : ''}" data-qty="${n}">${n}</button>`).join('')}
        </div>
        <div class="stock-trade-row">
          <button class="win95-btn bevel-out buy-btn ${SELECTED_STOCK[s.id] === 'buy' ? 'active' : ''}" data-action="buy">📈 Купить</button>
          <button class="win95-btn bevel-out sell-btn ${SELECTED_STOCK[s.id] === 'sell' ? 'active' : ''}" data-action="sell">📉 Продать</button>
        </div>
        <div class="stock-trade-row">
          <button class="win95-btn bevel-out buy-all-btn" title="Купить максимум на весь доступный кэш">💰 Купить всё (${maxAffordable})</button>
          <button class="win95-btn bevel-out sell-all-btn" ${holding.shares > 0 ? '' : 'disabled'} title="Продать все акции этой компании">🧾 Продать всё</button>
        </div>
        <div class="stock-holding">${holding.shares > 0 ? `У вас: ${holding.shares} шт. · ср. ${holding.avgCost.toFixed(2)}₽` : 'Нет позиции'}</div>
      </div>
    `;

    card.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        qtyByStock[s.id] = parseInt(btn.dataset.qty, 10);
        renderStocks();
      });
    });

    card.querySelectorAll('.stock-trade-row button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        SELECTED_STOCK[s.id] = btn.dataset.action;
        if (btn.dataset.action === 'buy') {
          onBuyStock(s.id);
        } else {
          onSellStock(s.id);
        }
      });
    });

    card.querySelector('.buy-all-btn').addEventListener('click', () => onBuyAllStock(s.id));
    card.querySelector('.sell-all-btn').addEventListener('click', () => onSellAllStock(s.id));

    list.appendChild(card);
  });
}

async function onBuyStock(id) {
  state = await CS.loadState();
  const result = CS.buyStock(state, id, qtyByStock[id]);
  CS.saveState(state);
  if (!result.success) shakeSection('marketSection');
  renderTopbar();
  renderStocks();
}

async function onSellStock(id) {
  state = await CS.loadState();
  const result = CS.sellStock(state, id, qtyByStock[id]);
  CS.saveState(state);
  if (!result.success) shakeSection('marketSection');
  renderTopbar();
  renderStocks();
}

async function onBuyAllStock(id) {
  state = await CS.loadState();
  const price = state.stockPrices[id];
  const maxQty = Math.floor(state.cash / (price * (1 + CS.CONFIG.STOCK_TRADE_FEE)));
  if (maxQty <= 0) { shakeSection('marketSection'); return; }
  const result = CS.buyStock(state, id, maxQty);
  CS.saveState(state);
  if (!result.success) shakeSection('marketSection');
  renderTopbar();
  renderStocks();
}

async function onSellAllStock(id) {
  state = await CS.loadState();
  const holding = state.portfolio[id];
  if (!holding || holding.shares <= 0) { shakeSection('marketSection'); return; }
  const result = CS.sellStock(state, id, holding.shares);
  CS.saveState(state);
  if (!result.success) shakeSection('marketSection');
  renderTopbar();
  renderStocks();
}

function shakeSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 130);
}

// ---- Недвижимость с улучшениями ----
function getPropertyPrice(state, propertyId) {
  if (!state.invest.realtyPrices) state.invest.realtyPrices = {};
  if (!state.invest.realtyPrices[propertyId]) {
    const prop = CS.PROPERTIES.find(p => p.id === propertyId);
    state.invest.realtyPrices[propertyId] = prop ? prop.basePrice || 1000 : 1000;
  }
  const base = state.invest.realtyPrices[propertyId] || 1000;
  const volatility = 0.05;
  const change = 1 + (Math.random() - 0.5) * volatility;
  return Math.round(base * change);
}

function getPropertyRent(state, propertyId) {
  const prop = CS.PROPERTIES.find(p => p.id === propertyId);
  if (!prop) return 0;
  const owned = state.properties[propertyId] || 0;
  if (owned === 0) return 0;

  let rent = prop.income * 0.3;
  const renovation = state.invest.renovationLevels?.[propertyId] || 0;
  rent *= (1 + renovation * 0.15);

  const tenantType = state.invest.tenants?.[propertyId] || 'none';
  if (tenantType === 'residential') {
    rent *= 1.2;
  } else if (tenantType === 'industrial') {
    rent *= 1.5;
  }

  return rent;
}

function renderProperties() {
  const list = document.getElementById('propertyList');
  list.innerHTML = '';

  CS.PROPERTIES.forEach((p) => {
    const owned = state.properties[p.id] || 0;
    const cost = getPropertyPrice(state, p.id);
    const priceChange = state.invest.realtyPrices?.[p.id] ?
      ((cost - state.invest.realtyPrices[p.id]) / state.invest.realtyPrices[p.id] * 100) : 0;
    const affordable = state.cash >= cost;
    const rent = getPropertyRent(state, p.id);
    const renovation = state.invest.renovationLevels?.[p.id] || 0;
    const tenant = state.invest.tenants?.[p.id] || 'none';

    const tenantLabel = tenant === 'residential' ? '🏠 Жилая' :
                        tenant === 'industrial' ? '🏭 Промышленная' : '❌ Нет';

    const card = document.createElement('div');
    card.className = 'property-card bevel-out';
    card.innerHTML = `
      <div class="property-icon">${p.icon}</div>
      <div>
        <div class="property-name">${p.name}</div>
        <div class="property-stats">Доход: +${p.income}💰/с · Содержание: -${p.upkeep}💰/с</div>
        <div class="property-price">${cost}💰 <span class="${priceChange >= 0 ? 'up' : 'down'}">${priceChange >= 0 ? '▲' : '▼'} ${Math.abs(priceChange).toFixed(1)}%</span></div>
        <div class="property-renovation">🔧 Улучшение: ${renovation} ур. (доход +${Math.round(renovation * 15)}%)</div>
        <div class="property-tenant">👤 Арендатор: ${tenantLabel} (доход +${rent.toFixed(1)}💰/с)</div>
        ${owned > 0 ? `<div class="property-owned">В собственности: ${owned}</div>` : ''}
      </div>
      <div class="property-actions">
        ${owned > 0 ? `
          <button class="win95-btn bevel-out renovate-btn">🔧 Улучшить (${Math.round(cost * 0.3)}💰)</button>
          <button class="win95-btn bevel-out tenant-btn">👤 Найти арендатора</button>
        ` : ''}
        <button class="win95-btn bevel-out buy-btn" ${affordable ? '' : 'disabled'}>Купить за ${cost}💰</button>
        ${owned > 0 ? `
          <button class="win95-btn bevel-out sell-prop-btn">💰 Продать</button>
        ` : ''}
      </div>
    `;

    const buyBtn = card.querySelector('.buy-btn');
    if (buyBtn) buyBtn.addEventListener('click', () => onBuyProperty(p.id));

    const sellBtn = card.querySelector('.sell-prop-btn');
    if (sellBtn) sellBtn.addEventListener('click', () => onSellProperty(p.id));

    const renovateBtn = card.querySelector('.renovate-btn');
    if (renovateBtn) renovateBtn.addEventListener('click', () => onRenovateProperty(p.id));

    const tenantBtn = card.querySelector('.tenant-btn');
    if (tenantBtn) tenantBtn.addEventListener('click', () => onFindTenant(p.id));

    list.appendChild(card);
  });
}

async function onBuyProperty(id) {
  state = await CS.loadState();
  const cost = getPropertyPrice(state, id);
  if (state.cash < cost) return;

  state.cash -= cost;
  state.properties[id] = (state.properties[id] || 0) + 1;
  state.invest.realtyPrices[id] = cost;

  CS.saveState(state);
  renderTopbar();
  renderProperties();
}

async function onSellProperty(id) {
  state = await CS.loadState();
  const owned = state.properties[id] || 0;
  if (owned <= 0) return;

  const price = getPropertyPrice(state, id) * 0.9;
  state.cash += price;
  state.properties[id]--;

  CS.saveState(state);
  renderTopbar();
  renderProperties();
}

async function onRenovateProperty(id) {
  state = await CS.loadState();
  const cost = getPropertyPrice(state, id) * 0.3;
  if (state.cash < cost) return;

  state.cash -= cost;
  if (!state.invest.renovationLevels) state.invest.renovationLevels = {};
  state.invest.renovationLevels[id] = (state.invest.renovationLevels[id] || 0) + 1;

  CS.saveState(state);
  renderTopbar();
  renderProperties();
}

async function onFindTenant(id) {
  state = await CS.loadState();
  const prop = CS.PROPERTIES.find(p => p.id === id);
  if (!prop) return;

  const types = ['residential', 'industrial'];
  const type = types[Math.floor(Math.random() * types.length)];
  state.invest.tenants = state.invest.tenants || {};
  state.invest.tenants[id] = type;

  const bonus = Math.round(50 + Math.random() * 150);
  state.cash += bonus;

  CS.saveState(state);
  renderTopbar();
  renderProperties();
}

// ---- Криптовалюты ----
function renderCrypto() {
  const list = document.getElementById('cryptoList');
  list.innerHTML = '';

  CRYPTO_CONFIG.forEach((c) => {
    const price = state.cryptoPrices?.[c.id] || 100;
    const prevPrice = state.cryptoPricesPrev?.[c.id] || price;
    const pct = ((price - prevPrice) / prevPrice) * 100;
    const balance = state.cryptoWallet?.[c.id] || 0;
    const qty = qtyByCrypto[c.id] || 1;

    const card = document.createElement('div');
    card.className = 'crypto-card bevel-out';
    card.innerHTML = `
      <div class="crypto-icon">${c.icon}</div>
      <div>
        <div class="crypto-name">${c.name}</div>
        <div class="crypto-ticker">${c.ticker}</div>
        <div class="crypto-balance">Баланс: ${balance.toFixed(4)}</div>
      </div>
      <div>
        <div class="crypto-price">$${price.toFixed(2)}</div>
        <div class="crypto-change ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</div>
      </div>
      <div class="crypto-actions">
        <button class="win95-btn bevel-out buy-crypto" data-id="${c.id}">Купить</button>
        <button class="win95-btn bevel-out sell-crypto" data-id="${c.id}">Продать</button>
        <button class="win95-btn bevel-out sell-all-crypto" data-id="${c.id}" ${balance > 0 ? '' : 'disabled'}>Продать всё</button>
        <input type="number" class="win95-input crypto-qty" data-id="${c.id}" value="${qty}" min="0.001" step="0.001" style="width:60px;">
      </div>
    `;

    card.querySelector('.buy-crypto').addEventListener('click', () => onBuyCrypto(c.id));
    card.querySelector('.sell-crypto').addEventListener('click', () => onSellCrypto(c.id));
    card.querySelector('.sell-all-crypto').addEventListener('click', () => onSellAllCrypto(c.id));
    card.querySelector('.crypto-qty').addEventListener('change', (e) => {
      qtyByCrypto[c.id] = parseFloat(e.target.value) || 0.001;
    });

    list.appendChild(card);
  });
}

async function onBuyCrypto(id) {
  state = await CS.loadState();
  const price = state.cryptoPrices?.[id] || 100;
  const qty = qtyByCrypto[id] || 0.001;
  const cost = price * qty;
  const fee = Math.max(1, cost * 0.005);

  if (state.cash < cost + fee) return;

  state.cash -= cost + fee;
  state.cryptoWallet[id] = (state.cryptoWallet[id] || 0) + qty;

  CS.saveState(state);
  renderTopbar();
  renderCrypto();
}

async function onSellCrypto(id) {
  state = await CS.loadState();
  const price = state.cryptoPrices?.[id] || 100;
  const qty = qtyByCrypto[id] || 0.001;
  const balance = state.cryptoWallet[id] || 0;

  if (balance < qty) return;

  const revenue = price * qty;
  const fee = Math.max(1, revenue * 0.005);

  state.cash += revenue - fee;
  state.cryptoWallet[id] -= qty;

  CS.saveState(state);
  renderTopbar();
  renderCrypto();
}

async function onSellAllCrypto(id) {
  state = await CS.loadState();
  const balance = state.cryptoWallet[id] || 0;
  if (balance <= 0) return;
  const price = state.cryptoPrices?.[id] || 100;
  const revenue = price * balance;
  const fee = Math.max(1, revenue * 0.005);

  state.cash += revenue - fee;
  state.cryptoWallet[id] = 0;

  CS.saveState(state);
  renderTopbar();
  renderCrypto();
}

// ---- Майнинг (с рисками: поломки, взлом, кража) ----
function renderMining() {
  const list = document.getElementById('miningList');
  list.innerHTML = '';

  MINING_CONFIG.forEach((m) => {
    const rec = state.invest.mining[m.id] || {};
    const active = rec.active || false;
    const startedAt = rec.startedAt || 0;
    const broken = rec.broken || false;
    const owned = rec.owned || false;
    const isActive = active && !broken && (Date.now() - startedAt < 60000);

    const mined = isActive ? (Date.now() - startedAt) / 1000 * m.hashrate / 1000 : 0;
    const btcPrice = state.cryptoPrices?.btc || 100;
    const value = mined * btcPrice * 0.01;

    let statusLine;
    if (broken) statusLine = `💥 Оборудование сломано (${rec.incident || 'поломка'}) — требуется ремонт`;
    else if (isActive) statusLine = `⛏️ Майнинг: +${mined.toFixed(4)} BTC (≈${value.toFixed(1)}💰)`;
    else statusLine = '⏸️ Остановлен';

    const card = document.createElement('div');
    card.className = 'mining-card bevel-out';
    card.innerHTML = `
      <div>
        <div class="mining-name">${m.name}</div>
        <div class="mining-stats">Стоимость: ${m.cost}💰 · Хешрейт: ${m.hashrate} MH/s</div>
        <div class="mining-stats">Потребление: ${m.powerCost}💰/с · Фокус: ${m.focusCost}/с</div>
        <div class="mining-risk">⚠️ Риски/мин: поломка ${(m.breakChance*100).toFixed(1)}% · взлом ${(m.hackChance*100).toFixed(1)}% · кража ${(m.theftChance*100).toFixed(1)}%</div>
        <div class="mining-hashrate">${statusLine}</div>
      </div>
      <div class="mining-actions">
        ${owned ? `
          ${broken ? `<button class="win95-btn bevel-out repair-miner" data-id="${m.id}">🔧 Починить (${m.repairCost}💰)</button>` : `
          <button class="win95-btn bevel-out ${isActive ? 'stop-mining' : 'start-mining'}" data-id="${m.id}">
            ${isActive ? '⏹️ Остановить' : '▶️ Запустить'}
          </button>`}
        ` : `<button class="win95-btn bevel-out buy-miner" data-id="${m.id}">💰 Купить (${m.cost}💰)</button>`}
      </div>
    `;

    card.querySelector('.start-mining, .stop-mining')?.addEventListener('click', () => onToggleMining(m.id));
    card.querySelector('.buy-miner')?.addEventListener('click', () => onBuyMiner(m.id));
    card.querySelector('.repair-miner')?.addEventListener('click', () => onRepairMiner(m.id));

    list.appendChild(card);
  });
}

async function onBuyMiner(id) {
  state = await CS.loadState();
  const config = MINING_CONFIG.find(m => m.id === id);
  if (!config) return;

  if (state.cash < config.cost) return;

  state.cash -= config.cost;
  state.invest.mining[id] = { active: false, startedAt: 0, owned: true, broken: false, incident: null };

  CS.saveState(state);
  renderTopbar();
  renderMining();
}

async function onRepairMiner(id) {
  state = await CS.loadState();
  const config = MINING_CONFIG.find(m => m.id === id);
  const rec = state.invest.mining[id];
  if (!config || !rec || !rec.broken) return;
  if (state.cash < config.repairCost) return;

  state.cash -= config.repairCost;
  rec.broken = false;
  rec.incident = null;
  state.history.unshift({ type: 'business', text: `Отремонтировано «${config.name}» (-${config.repairCost})`, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);

  CS.saveState(state);
  renderTopbar();
  renderMining();
}

async function onToggleMining(id) {
  state = await CS.loadState();
  const mining = state.invest.mining[id];
  if (!mining || mining.broken) return;

  if (mining.active) {
    mining.active = false;
    mining.startedAt = 0;
  } else {
    const config = MINING_CONFIG.find(m => m.id === id);
    if (state.focus < config.focusCost) {
      flashGlobalHint('Недостаточно фокуса для запуска майнинга!');
      return;
    }
    mining.active = true;
    mining.startedAt = Date.now();
  }

  CS.saveState(state);
  renderTopbar();
  renderMining();
}

function flashGlobalHint(text) {
  // Небольшая всплывающая подсказка через shake активной секции майнинга
  shakeSection('miningSection');
}

// ---- Опционы (привязаны к реальным акциям биржи «Рынок Айти») ----
function renderOptions() {
  const list = document.getElementById('optionsList');
  list.innerHTML = '';

  CS.STOCKS.forEach((stock) => {
    const currentPrice = state.stockPrices?.[stock.id] || stock.basePrice;
    const exists = state.invest.options?.find(o => o.stockId === stock.id && o.result === null);
    const result = exists?.result;

    const card = document.createElement('div');
    card.className = 'option-card bevel-out';
    card.innerHTML = `
      <div>
        <div class="option-name">${stock.ticker} — опцион на 45с</div>
        <div class="option-info">Текущая цена: ${currentPrice.toFixed(2)}₽ · Страйк фиксируется в момент покупки</div>
        ${exists ? `
          <div class="option-result">
            📌 ${exists.type === 'call' ? '📈 CALL' : '📉 PUT'} · страйк ${exists.strike.toFixed(2)}₽ · ставка ${exists.amount}💰
            <br>⏳ Осталось: <span class="option-timer" data-idx="${exists.id}">…</span>
          </div>
        ` : ''}
      </div>
      <div class="option-actions">
        ${!exists ? `
          <input type="number" class="win95-input option-amount" data-stock="${stock.id}" value="100" min="10" style="width:70px;">
          <button class="win95-btn bevel-out call" data-stock="${stock.id}">📈 CALL (рост)</button>
          <button class="win95-btn bevel-out put" data-stock="${stock.id}">📉 PUT (падение)</button>
        ` : ''}
      </div>
    `;

    if (!exists) {
      card.querySelector('.call').addEventListener('click', () => onBuyOption(stock.id, 'call'));
      card.querySelector('.put').addEventListener('click', () => onBuyOption(stock.id, 'put'));
    }

    list.appendChild(card);
  });

  updateOptionTimers();
}

function updateOptionTimers() {
  clearInterval(updateOptionTimers._t);
  updateOptionTimers._t = setInterval(() => {
    document.querySelectorAll('.option-timer').forEach((el) => {
      const idx = parseInt(el.dataset.idx, 10);
      const opt = state.invest.options.find(o => o.id === idx);
      if (!opt) return;
      const remaining = Math.max(0, opt.expiry - (Date.now() - opt.startedAt) / 1000);
      el.textContent = remaining.toFixed(0) + 'с';
    });
  }, 1000);
}

async function onBuyOption(stockId, type) {
  state = await CS.loadState();
  const card = document.querySelector(`.option-amount[data-stock="${stockId}"]`);
  const amount = parseInt(card?.value || 100);
  if (amount < 10 || state.cash > 0 === false || state.cash < amount) return;

  const price = state.stockPrices?.[stockId] || 100;
  if (!state.invest.options) state.invest.options = [];

  const nextId = (state.invest.options.reduce((max, o) => Math.max(max, o.id), 0)) + 1;

  state.invest.options.push({
    id: nextId,
    stockId,
    type,
    strike: price,
    amount,
    startPrice: price,
    startedAt: Date.now(),
    expiry: 45,
    result: null
  });

  state.cash -= amount;

  CS.saveState(state);
  renderTopbar();
  renderOptions();
}

// ---- Тик обновления ----
function investTick(state) {
  if (!state.invest) return;

  // Обновление крипто-цен
  if (!state.cryptoPrices) state.cryptoPrices = {};
  if (!state.cryptoPricesPrev) state.cryptoPricesPrev = {};

  CRYPTO_CONFIG.forEach(c => {
    const prev = state.cryptoPrices[c.id] || 100;
    const volatility = c.volatility;
    const change = (Math.random() - 0.5) * volatility * 2;
    const newPrice = Math.max(1, prev * (1 + change));
    state.cryptoPricesPrev[c.id] = prev;
    state.cryptoPrices[c.id] = newPrice;
  });

  // Майнинг: доход + риски (поломка / взлом / кража)
  MINING_CONFIG.forEach(m => {
    const rec = state.invest.mining[m.id];
    if (!rec || !rec.owned) return;

    if (rec.active && !rec.broken && rec.startedAt > 0) {
      const duration = (Date.now() - rec.startedAt) / 1000;

      // Каждую примерную "минуту" работы — шанс на инцидент
      if (duration > 5) {
        const roll = Math.random();
        if (roll < m.breakChance / 12) {
          // Поломка оборудования — останавливает майнинг
          rec.broken = true;
          rec.active = false;
          rec.incident = 'поломка';
          state.history.unshift({ type: 'business', text: `⚠️ «${m.name}» сломался и требует ремонта!`, time: new Date().toLocaleTimeString() });
          state.history = state.history.slice(0, 20);
        } else if (roll < (m.breakChance + m.hackChance) / 12) {
          // Взлом — крадут часть кэша
          const stolen = Math.round(20 + Math.random() * 80);
          state.cash = Math.max(0, state.cash - stolen);
          state.history.unshift({ type: 'debt', text: `🕵️ Взлом! С кошелька украли ${stolen}💰 через «${m.name}»`, time: new Date().toLocaleTimeString() });
          state.history = state.history.slice(0, 20);
        } else if (roll < (m.breakChance + m.hackChance + m.theftChance) / 12) {
          // Кража намайненной крипты
          const stolenBtc = (state.cryptoWallet.btc || 0) * (0.1 + Math.random() * 0.2);
          state.cryptoWallet.btc = Math.max(0, (state.cryptoWallet.btc || 0) - stolenBtc);
          state.history.unshift({ type: 'debt', text: `🥷 Кража! Украдено ${stolenBtc.toFixed(4)} BTC с «${m.name}»`, time: new Date().toLocaleTimeString() });
          state.history = state.history.slice(0, 20);
        }
      }

      if (duration > 60) {
        const mined = duration * m.hashrate / 1000;
        state.cryptoWallet.btc = (state.cryptoWallet.btc || 0) + mined * 0.01;
        rec.startedAt = Date.now();
        state.focus = Math.max(0, state.focus - m.focusCost);
      }
    }
  });

  // Опционы (реальные акции)
  if (state.invest.options) {
    state.invest.options.forEach((opt) => {
      if (opt.result !== null) return;

      const elapsed = (Date.now() - opt.startedAt) / 1000;
      if (elapsed >= opt.expiry) {
        const currentPrice = state.stockPrices?.[opt.stockId] || opt.strike;
        const profit = opt.type === 'call' ?
          (currentPrice > opt.strike) :
          (currentPrice < opt.strike);

        if (profit) {
          state.cash += opt.amount * 2;
          opt.result = 'win';
        } else {
          opt.result = 'lose';
        }
        const stock = CS.STOCKS.find(s => s.id === opt.stockId);
        state.history.unshift({
          type: 'market',
          text: `Опцион ${stock ? stock.ticker : opt.stockId} ${opt.type.toUpperCase()}: ${profit ? `+${opt.amount * 2}💰` : `-${opt.amount}💰`}`,
          time: new Date().toLocaleTimeString()
        });
        state.history = state.history.slice(0, 20);
      }
    });
    // подчищаем закрытые опционы старше минуты, чтобы список не рос бесконечно
    state.invest.options = state.invest.options.filter(o => o.result === null || (Date.now() - o.startedAt) / 1000 < o.expiry + 60);
  }

  // Индекс рынка
  if (state.stockPrices) {
    const values = Object.values(state.stockPrices);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const prevIndex = state.marketIndex || 1000;
    const change = (avg / prevIndex) - 1;
    state.marketIndexChange = change * 100;
    state.marketIndex = avg;
  }
}

// Интеграция в основной тик
const originalTick = CS.tick;
CS.tick = function(state) {
  originalTick(state);
  investTick(state);
};

init();