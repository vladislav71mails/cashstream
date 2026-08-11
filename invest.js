// ============================================================================
// «Инвестиции» — Фондовый рынок 2.0, Недвижимость, Криптобиржа, Майнинг,
// Аирдропы, Опционы
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

// Конфигурация майнингового оборудования
const MINING_CONFIG = [
  { id: 'asic', name: 'ASIC Майнер', cost: 5000, hashrate: 100, powerCost: 2, focusCost: 0.5 },
  { id: 'gpu', name: 'GPU Майнинг', cost: 2000, hashrate: 40, powerCost: 1, focusCost: 0.3 },
  { id: 'cpu', name: 'CPU Майнинг', cost: 500, hashrate: 8, powerCost: 0.3, focusCost: 0.1 },
  { id: 'cloud', name: 'Облачный майнинг', cost: 1000, hashrate: 20, powerCost: 0.5, focusCost: 0 }
];

// Конфигурация опционов
const OPTION_ASSETS = ['BTC', 'ETH', 'SOL', 'AAPL', 'GOOGL', 'MSFT'];

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
        airdrops: [],
        options: [],
        realtyPrices: {},
        renovationLevels: {},
        tenants: {}
      };
    }
    
    // Инициализация крипто-кошелька
    if (!state.cryptoWallet) state.cryptoWallet = {};
    CRYPTO_CONFIG.forEach(c => {
      if (!state.cryptoWallet[c.id]) state.cryptoWallet[c.id] = 0;
    });
    
    // Инициализация майнинга
    MINING_CONFIG.forEach(m => {
      if (!state.invest.mining[m.id]) state.invest.mining[m.id] = { active: false, startedAt: 0 };
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
    renderAirdrops();
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
      renderAirdrops();
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

function getStockPrediction(stockId) {
  const history = state.stockHistory?.[stockId] || [];
  if (history.length < 10) return 'Недостаточно данных';
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (!prev) return 'Нет данных';
  const pct = ((last - prev) / prev) * 100;
  if (pct > 2) return '📈 Рост вероятен';
  if (pct > 0.5) return '↗️ Слабый рост';
  if (pct > -0.5) return '➡️ Флэт';
  if (pct > -2) return '↘️ Снижение';
  return '📉 Падение вероятно';
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
    const prediction = getStockPrediction(s.id);
    const dividend = state.stockDividends?.[s.id] || s.dividendYield || 0;

    const card = document.createElement('div');
    card.className = 'stock-card bevel-out';
    card.innerHTML = `
      <div class="stock-id">
        <span class="stock-name">${s.name}</span>
        <span class="stock-ticker">${s.ticker}</span>
        <span class="stock-prediction">🤖 ${prediction}</span>
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
        <div class="stock-holding">${holding.shares > 0 ? `У вас: ${holding.shares} шт. · ср. ${holding.avgCost.toFixed(2)}₽` : 'Нет позиции'}</div>
      </div>
    `;

    card.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        qtyByStock[s.id] = parseInt(btn.dataset.qty, 10);
        renderStocks();
      });
    });
    
    card.querySelectorAll('.stock-trade-row button').forEach((btn) => {
      btn.addEventListener('click', () => {
        SELECTED_STOCK[s.id] = btn.dataset.action;
        if (btn.dataset.action === 'buy') {
          onBuyStock(s.id);
        } else {
          onSellStock(s.id);
        }
      });
    });

    list.appendChild(card);
  });
}

async function onBuyStock(id) {
  state = await CS.loadState();
  const result = CS.buyStock(state, id, qtyByStock[id]);
  CS.saveState(state);
  if (!result.success) {
    document.getElementById('marketSection').classList.add('shake');
    setTimeout(() => document.getElementById('marketSection').classList.remove('shake'), 130);
  }
  renderTopbar();
  renderStocks();
}

async function onSellStock(id) {
  state = await CS.loadState();
  const result = CS.sellStock(state, id, qtyByStock[id]);
  CS.saveState(state);
  if (!result.success) {
    document.getElementById('marketSection').classList.add('shake');
    setTimeout(() => document.getElementById('marketSection').classList.remove('shake'), 130);
  }
  renderTopbar();
  renderStocks();
}

// ---- Недвижимость с улучшениями ----
function getPropertyPrice(state, propertyId) {
  if (!state.invest.realtyPrices) state.invest.realtyPrices = {};
  if (!state.invest.realtyPrices[propertyId]) {
    const prop = CS.PROPERTIES.find(p => p.id === propertyId);
    state.invest.realtyPrices[propertyId] = prop ? prop.basePrice || 1000 : 1000;
  }
  // Колебания цен
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
  
  // Базовая аренда
  let rent = prop.income * 0.3;
  
  // Бонус за улучшения
  const renovation = state.invest.renovationLevels?.[propertyId] || 0;
  rent *= (1 + renovation * 0.15);
  
  // Тип аренды: жилая или промышленная
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
  
  const price = getPropertyPrice(state, id) * 0.9; // 10% комиссия
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
  
  // Арендаторы: жилые или промышленные
  const types = ['residential', 'industrial'];
  const type = types[Math.floor(Math.random() * types.length)];
  state.invest.tenants = state.invest.tenants || {};
  state.invest.tenants[id] = type;
  
  // Бонус за находку
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
        <input type="number" class="win95-input crypto-qty" data-id="${c.id}" value="${qty}" min="0.001" step="0.001" style="width:60px;">
      </div>
    `;
    
    card.querySelector('.buy-crypto').addEventListener('click', () => onBuyCrypto(c.id));
    card.querySelector('.sell-crypto').addEventListener('click', () => onSellCrypto(c.id));
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

// ---- Майнинг ----
function renderMining() {
  const list = document.getElementById('miningList');
  list.innerHTML = '';

  MINING_CONFIG.forEach((m) => {
    const active = state.invest.mining[m.id]?.active || false;
    const startedAt = state.invest.mining[m.id]?.startedAt || 0;
    const hashrate = m.hashrate;
    const isActive = active && (Date.now() - startedAt < 60000); // Активен 60 секунд
    
    // Доход от майнинга (в крипте)
    const mined = isActive ? (Date.now() - startedAt) / 1000 * hashrate / 1000 : 0;
    const btcPrice = state.cryptoPrices?.btc || 100;
    const value = mined * btcPrice * 0.01;

    const card = document.createElement('div');
    card.className = 'mining-card bevel-out';
    card.innerHTML = `
      <div>
        <div class="mining-name">${m.name}</div>
        <div class="mining-stats">Стоимость: ${m.cost}💰 · Хешрейт: ${m.hashrate} MH/s</div>
        <div class="mining-stats">Потребление: ${m.powerCost}💰/с · Фокус: ${m.focusCost}/с</div>
        <div class="mining-hashrate">${isActive ? `⛏️ Майнинг: +${mined.toFixed(4)} BTC (≈${value.toFixed(1)}💰)` : '⏸️ Остановлен'}</div>
      </div>
      <div class="mining-actions">
        <button class="win95-btn bevel-out ${isActive ? 'stop-mining' : 'start-mining'}" data-id="${m.id}">
          ${isActive ? '⏹️ Остановить' : '▶️ Запустить'}
        </button>
        ${!active ? `<button class="win95-btn bevel-out buy-miner" data-id="${m.id}">💰 Купить (${m.cost}💰)</button>` : ''}
      </div>
    `;
    
    card.querySelector('.start-mining, .stop-mining')?.addEventListener('click', () => onToggleMining(m.id));
    card.querySelector('.buy-miner')?.addEventListener('click', () => onBuyMiner(m.id));

    list.appendChild(card);
  });
}

async function onBuyMiner(id) {
  state = await CS.loadState();
  const config = MINING_CONFIG.find(m => m.id === id);
  if (!config) return;
  
  if (state.cash < config.cost) return;
  
  state.cash -= config.cost;
  state.invest.mining[id].active = false;
  state.invest.mining[id].startedAt = 0;
  state.invest.mining[id].owned = true;
  
  CS.saveState(state);
  renderTopbar();
  renderMining();
}

async function onToggleMining(id) {
  state = await CS.loadState();
  const mining = state.invest.mining[id];
  if (!mining) return;
  
  if (mining.active) {
    // Остановить
    mining.active = false;
    mining.startedAt = 0;
  } else {
    // Запустить - проверка фокуса
    const config = MINING_CONFIG.find(m => m.id === id);
    if (state.focus < config.focusCost) {
      alert('Недостаточно фокуса для майнинга!');
      return;
    }
    mining.active = true;
    mining.startedAt = Date.now();
  }
  
  CS.saveState(state);
  renderTopbar();
  renderMining();
}

// ---- Аирдропы ----
function renderAirdrops() {
  const list = document.getElementById('airdropsList');
  list.innerHTML = '';

  const airdrops = [
    { id: 'drop1', name: '🎁 Новогодний аирдроп', reward: 100, requirement: 'Будьте активны 5 мин' },
    { id: 'drop2', name: '🎉 Крипто-вечеринка', reward: 250, requirement: 'Совершите 3 сделки' },
    { id: 'drop3', name: '💎 Редкий токен', reward: 500, requirement: 'Владейте криптовалютой' },
    { id: 'drop4', name: '🚀 Стартап-бонус', reward: 1000, requirement: 'Инвестируйте в акции' }
  ];

  airdrops.forEach((drop) => {
    const claimed = state.invest.airdrops?.includes(drop.id) || false;
    const lastClaim = state.invest.airdropTimes?.[drop.id] || 0;
    const available = !claimed && (Date.now() - lastClaim > 3600000); // 1 час

    const card = document.createElement('div');
    card.className = 'airdrop-card bevel-out';
    card.innerHTML = `
      <div>
        <div class="airdrop-name">${drop.name}</div>
        <div class="airdrop-desc">${drop.requirement}</div>
        <div class="airdrop-reward">🎁 Награда: ${drop.reward}💰</div>
      </div>
      <div class="airdrop-actions">
        <button class="win95-btn bevel-out claim-airdrop" ${available ? '' : 'disabled'} data-id="${drop.id}">
          ${claimed ? '✅ Получено' : available ? '🎁 Забрать!' : '⏳ Ожидание...'}
        </button>
      </div>
    `;
    
    card.querySelector('.claim-airdrop')?.addEventListener('click', () => onClaimAirdrop(drop.id, drop.reward));

    list.appendChild(card);
  });
}

async function onClaimAirdrop(id, reward) {
  state = await CS.loadState();
  
  state.cash += reward;
  if (!state.invest.airdrops) state.invest.airdrops = [];
  state.invest.airdrops.push(id);
  if (!state.invest.airdropTimes) state.invest.airdropTimes = {};
  state.invest.airdropTimes[id] = Date.now();
  
  CS.saveState(state);
  renderTopbar();
  renderAirdrops();
}

// ---- Опционы ----
function renderOptions() {
  const list = document.getElementById('optionsList');
  list.innerHTML = '';

  // Создаём несколько опционов
  const options = [
    { asset: 'BTC', strike: 45000, expiry: 60, type: 'call' },
    { asset: 'ETH', strike: 3200, expiry: 60, type: 'put' },
    { asset: 'SOL', strike: 180, expiry: 60, type: 'call' },
    { asset: 'AAPL', strike: 180, expiry: 60, type: 'put' },
  ];

  options.forEach((opt, idx) => {
    const exists = state.invest.options?.find(o => o.id === idx);
    const currentPrice = state.cryptoPrices?.[opt.asset.toLowerCase()] || 
                         state.stockPrices?.[opt.asset.toLowerCase()] || 100;
    const result = exists?.result;

    const card = document.createElement('div');
    card.className = 'option-card bevel-out';
    card.innerHTML = `
      <div>
        <div class="option-name">${opt.asset} ${opt.type === 'call' ? '📈 CALL' : '📉 PUT'}</div>
        <div class="option-info">Страйк: ${opt.strike} · Срок: ${opt.expiry}с</div>
        <div class="option-strike">Текущая цена: ${currentPrice}</div>
        ${exists ? `
          <div class="option-result ${result === 'win' ? 'win' : result === 'lose' ? 'lose' : ''}">
            ${result === 'win' ? '✅ Выигрыш! x2' : result === 'lose' ? '❌ Проигрыш' : '⏳ Ожидание...'}
          </div>
        ` : ''}
      </div>
      <div class="option-actions">
        ${!exists ? `
          <input type="number" class="win95-input option-amount" data-idx="${idx}" value="100" min="10" style="width:70px;">
          <button class="win95-btn bevel-out call" data-idx="${idx}">📈 Купить CALL</button>
          <button class="win95-btn bevel-out put" data-idx="${idx}">📉 Купить PUT</button>
        ` : ''}
      </div>
    `;
    
    if (!exists) {
      card.querySelector('.call').addEventListener('click', () => onBuyOption(idx, 'call'));
      card.querySelector('.put').addEventListener('click', () => onBuyOption(idx, 'put'));
    }

    list.appendChild(card);
  });
}

async function onBuyOption(idx, type) {
  state = await CS.loadState();
  const amount = parseInt(document.querySelector('.option-amount')?.value || 100);
  if (amount < 10 || state.cash < amount) return;
  
  // Определяем базовый актив
  const opt = [
    { asset: 'BTC', strike: 45000, expiry: 60 },
    { asset: 'ETH', strike: 3200, expiry: 60 },
    { asset: 'SOL', strike: 180, expiry: 60 },
    { asset: 'AAPL', strike: 180, expiry: 60 }
  ][idx];
  
  if (!state.invest.options) state.invest.options = [];
  
  state.invest.options.push({
    id: idx,
    asset: opt.asset,
    type: type,
    strike: opt.strike,
    amount: amount,
    startPrice: state.cryptoPrices?.[opt.asset.toLowerCase()] || 
                state.stockPrices?.[opt.asset.toLowerCase()] || 100,
    startedAt: Date.now(),
    expiry: opt.expiry,
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
  
  // Майнинг
  MINING_CONFIG.forEach(m => {
    const mining = state.invest.mining[m.id];
    if (mining?.active && mining?.startedAt > 0) {
      const duration = (Date.now() - mining.startedAt) / 1000;
      if (duration > 60) {
        // Добыча крипты
        const mined = duration * m.hashrate / 1000;
        state.cryptoWallet.btc = (state.cryptoWallet.btc || 0) + mined * 0.01;
        mining.startedAt = Date.now();
        
        // Тратим фокус
        state.focus = Math.max(0, state.focus - m.focusCost);
      }
    }
  });
  
  // Опционы
  if (state.invest.options) {
    state.invest.options.forEach((opt, i) => {
      if (opt.result !== null) return;
      
      const elapsed = (Date.now() - opt.startedAt) / 1000;
      if (elapsed >= opt.expiry) {
        const currentPrice = state.cryptoPrices?.[opt.asset.toLowerCase()] || 
                            state.stockPrices?.[opt.asset.toLowerCase()] || 100;
        const profit = opt.type === 'call' ? 
          (currentPrice > opt.strike) : 
          (currentPrice < opt.strike);
        
        if (profit) {
          state.cash += opt.amount * 2; // x2 прибыль
          opt.result = 'win';
        } else {
          opt.result = 'lose';
        }
      }
    });
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