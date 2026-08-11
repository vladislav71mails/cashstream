// ============================================================================
// «Рынок Айти» + «Недвижимость» — окно инвестиций. Кошелёк общий с игрой
// (chrome.storage.local через shared.js). Открывается как отдельная
// программа внутри рабочего стола (см. fullpage.js) или из попапа.
// ============================================================================

let state = null;
const qtyByStock = {}; // stockId -> выбранное количество для сделки

async function init() {
  try {
    state = await CS.loadState();
    CS.STOCKS.forEach((s) => { qtyByStock[s.id] = 1; });

    renderTopbar();
    renderStocks();
    renderProperties();

    document.getElementById('marketTab').addEventListener('click', () => switchTab('market'));
    document.getElementById('realtyTab').addEventListener('click', () => switchTab('realty'));

    CS.onStateChanged((newState) => {
      state = newState;
      renderTopbar();
      renderStocks();
      renderProperties();
    });
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function switchTab(tab) {
  document.getElementById('marketTab').classList.toggle('active', tab === 'market');
  document.getElementById('realtyTab').classList.toggle('active', tab === 'realty');
  document.getElementById('marketSection').classList.toggle('active', tab === 'market');
  document.getElementById('realtySection').classList.toggle('active', tab === 'realty');
}

function renderTopbar() {
  document.getElementById('walletCash').textContent = Math.floor(state.cash);
  document.getElementById('portfolioValue').textContent = Math.floor(CS.portfolioValue(state));
  document.getElementById('realtyIncome').textContent =
    (CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state)).toFixed(1);
}

// ---- Рынок Айти -----------------------------------------------------------
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

function renderStocks() {
  const list = document.getElementById('stockList');
  list.innerHTML = '';

  CS.STOCKS.forEach((s) => {
    const price = state.stockPrices[s.id];
    const pct = CS.stockChangePct(state, s.id);
    const holding = state.portfolio[s.id] || { shares: 0, avgCost: 0 };
    const qty = qtyByStock[s.id];

    const card = document.createElement('div');
    card.className = 'stock-card bevel-out';
    card.innerHTML = `
      <div class="stock-id">
        <span class="stock-name">${s.name}</span>
        <span class="stock-ticker">${s.ticker}</span>
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
          <button class="win95-btn bevel-out buy-btn" data-action="buy">Купить</button>
          <button class="win95-btn bevel-out sell-btn" data-action="sell">Продать</button>
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
    card.querySelector('[data-action="buy"]').addEventListener('click', () => onBuyStock(s.id));
    card.querySelector('[data-action="sell"]').addEventListener('click', () => onSellStock(s.id));

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

// ---- Недвижимость ----------------------------------------------------------
function renderProperties() {
  const list = document.getElementById('propertyList');
  list.innerHTML = '';

  CS.PROPERTIES.forEach((p) => {
    const owned = state.properties[p.id] || 0;
    const cost = CS.propertyCost(state, p.id);
    const affordable = state.cash >= cost;

    const card = document.createElement('div');
    card.className = 'property-card bevel-out';
    card.innerHTML = `
      <div class="property-icon">${p.icon}</div>
      <div>
        <div class="property-name">${p.name}</div>
        <div class="property-stats">Доход: +${p.income}💰/с · Содержание: -${p.upkeep}💰/с</div>
        ${owned > 0 ? `<div class="property-owned">В собственности: ${owned}</div>` : ''}
      </div>
      <div class="property-buy">
        <button class="win95-btn bevel-out buy-btn" ${affordable ? '' : 'disabled'}>Купить за ${cost}💰</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => onBuyProperty(p.id));
    list.appendChild(card);
  });
}

async function onBuyProperty(id) {
  state = await CS.loadState();
  const result = CS.buyProperty(state, id);
  CS.saveState(state);
  if (!result.success) {
    document.getElementById('realtySection').classList.add('shake');
    setTimeout(() => document.getElementById('realtySection').classList.remove('shake'), 130);
  }
  renderTopbar();
  renderProperties();
}

init();
