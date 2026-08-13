// ============================================================================
// «ЭЦП и СКЗИ» — покупка токена, драйверов и лицензии СКЗИ. Эти три флага
// нужны Отчетность.exe (кабинет учёта) для сдачи отчётности. Четвёртая зависимость —
// КриптоПро CSP — устанавливается отдельно через Магазин приложений.exe,
// эта программа только показывает её статус в режиме "только чтение".
// ============================================================================

let state = null;

const COSTS = {
  token: 120,
  drivers: 60,
  skzi: 200
};

async function init() {
  try {
    state = await CS.loadState();
    if (CS.bootI18n) await CS.bootI18n(state);
    else if (CS.applyI18n) CS.applyI18n(document);
    render();

    document.getElementById('buyTokenBtn').addEventListener('click', () => buy('tokenBought', COSTS.token, CS.t ? CS.t('crypto.buy_token') : 'token'));
    document.getElementById('buyDriversBtn').addEventListener('click', () => buy('edsDrivers', COSTS.drivers, CS.t ? CS.t('crypto.buy_drivers') : 'drivers'));
    document.getElementById('buySkziBtn').addEventListener('click', () => buy('skziLicense', COSTS.skzi, CS.t ? CS.t('crypto.buy_skzi') : 'skzi'));

    CS.onStateChanged((newState) => {
      state = newState;
      render();
    });
  } catch (err) {
    CS.reportFatalError(err);
  }
}

async function buy(field, price, historyText) {
  state = await CS.loadState();
  const onec = CS.ensureOnec(state);
  if (onec[field]) return;

  if (state.cash < price) {
    shake();
    return;
  }

  state.cash -= price;
  onec[field] = true;
  state.history.unshift({ type: 'business', text: `${historyText} (-${price})`, time: new Date().toLocaleTimeString() });
  state.history = state.history.slice(0, 20);

  CS.saveState(state);
  render();
}

function shake() {
  const root = document.querySelector('.crypto-root');
  root.classList.add('shake');
  setTimeout(() => root.classList.remove('shake'), 130);
}

function renderField(statusId, btnId, done, price) {
  const statusEl = document.getElementById(statusId);
  const btn = document.getElementById(btnId);

  if (done) {
    statusEl.textContent = CS.t ? CS.t('crypto.done') : 'OK';
    statusEl.className = 'crypto-card-status status-ok';
    btn.textContent = CS.t ? CS.t('crypto.ready') : 'OK';
    btn.disabled = true;
  } else {
    statusEl.textContent = CS.t ? CS.t('crypto.not_done') : '—';
    statusEl.className = 'crypto-card-status status-missing';
    btn.textContent = CS.t ? CS.t('crypto.buy_for', { n: price }) : String(price);
    btn.disabled = false;
  }
}

function render() {
  document.getElementById('walletCash').textContent = Math.floor(state.cash);
  const onec = CS.ensureOnec(state);

  renderField('tokenStatus', 'buyTokenBtn', onec.tokenBought, COSTS.token);
  renderField('driversStatus', 'buyDriversBtn', onec.edsDrivers, COSTS.drivers);
  renderField('skziStatus', 'buySkziBtn', onec.skziLicense, COSTS.skzi);

  const cryptoproEl = document.getElementById('cryptoproStatus');
  if (onec.cryptoproInstalled) {
    cryptoproEl.textContent = CS.t ? CS.t('crypto.installed') : 'OK';
    cryptoproEl.className = 'crypto-card-status status-ok';
  } else {
    cryptoproEl.textContent = CS.t ? CS.t('crypto.not_installed') : '—';
    cryptoproEl.className = 'crypto-card-status status-missing';
  }
}

init();
