// ============================================================================
// «Магазин приложений» — установка программ. Успешная установка сразу
// добавляет id в state.apps.installed; рабочий стол (fullpage.js) слушает
// изменения состояния и рисует новый значок без перезагрузки страницы.
// ============================================================================

let state = null;

async function init() {
  try {
    state = await CS.loadState();
    if (CS.bootI18n) await CS.bootI18n(state);
    else { if (CS.syncLangFromState) CS.syncLangFromState(state); if (CS.applyI18n) CS.applyI18n(document); }
    render();

    CS.onStateChanged((newState) => {
      state = newState;
      render();
    });
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function render() {
  document.getElementById('walletCash').textContent = Math.floor(state.cash);

  const grid = document.getElementById('storeGrid');
  grid.innerHTML = '';

  // Только реально доступные приложения — «скоро» не показываем
  CS.APP_CATALOG.filter((app) => app.status !== 'soon').forEach((app) => {
    const installed = CS.isAppInstalled(state, app.id);

    const card = document.createElement('div');
    card.className = 'store-card bevel-out';

    let actionHtml;
    if (installed) {
      actionHtml = `<span class="store-badge installed">${CS.t ? CS.t('store.installed') : '✅ Установлено'}</span>`;
    } else {
      const priceLabel = app.price
        ? (CS.t ? CS.t('store.install_price', { n: app.price }) : `Установить (${app.price}💰)`)
        : (CS.t ? CS.t('store.install_free') : 'Установить бесплатно');
      actionHtml = `<button class="win95-btn bevel-out install-btn">${priceLabel}</button>`;
    }

    card.innerHTML = `
      <div class="store-icon">${app.icon}</div>
      <div class="store-info">
        <div class="store-name">${app.name}.exe</div>
        <div class="store-tagline">${app.tagline}</div>
      </div>
      <div class="store-action">${actionHtml}</div>
    `;

    const btn = card.querySelector('.install-btn');
    if (btn) btn.addEventListener('click', () => onInstall(app.id));

    grid.appendChild(card);
  });
}

async function onInstall(id) {
  state = await CS.loadState();
  const result = CS.installApp(state, id);

  if (!result.success) {
    if (result.reason === 'cash') shake();
    return;
  }

  CS.saveState(state);
  render();
}

function shake() {
  const grid = document.getElementById('storeGrid');
  grid.classList.add('shake');
  setTimeout(() => grid.classList.remove('shake'), 130);
}

init();
