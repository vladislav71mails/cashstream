// ============================================================================
// Браузер.exe — внутренние «сайты» для найма, апгрейдов и заказов
// ============================================================================

let state = null;
const historyStack = [];
let histIndex = -1;
let currentUrl = 'home.cash';

const SITES = {
  'home.cash': renderHome,
  'rabota.cash': renderRabota,
  'office.market': renderOfficeMarket,
  'gos.cash': renderGos
};

async function init() {
  try {
    state = await CS.loadState();
    bindUi();
    navigate('home.cash', true);
    CS.onStateChanged((ns) => {
      state = ns;
      updateWallet();
      // Перерисовать текущую страницу, если она зависит от state
      navigate(currentUrl, true);
    });
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function bindUi() {
  document.getElementById('btnGo').addEventListener('click', () => {
    const url = normalizeUrl(document.getElementById('addrBar').value);
    navigate(url);
  });
  document.getElementById('addrBar').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = normalizeUrl(document.getElementById('addrBar').value);
      navigate(url);
    }
  });
  document.getElementById('btnHome').addEventListener('click', () => navigate('home.cash'));
  document.getElementById('btnRefresh').addEventListener('click', () => navigate(currentUrl, true));
  document.getElementById('btnBack').addEventListener('click', goBack);
  document.getElementById('btnForward').addEventListener('click', goForward);

  document.querySelectorAll('.bookmark').forEach((b) => {
    b.addEventListener('click', () => navigate(b.dataset.url));
  });
}

function normalizeUrl(raw) {
  let u = String(raw || '').trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!u) return 'home.cash';
  return u;
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

function updateWallet() {
  document.getElementById('walletCash').textContent = Math.floor(state.cash);
}

function navigate(url, replace) {
  url = normalizeUrl(url);
  currentUrl = url;
  document.getElementById('addrBar').value = url;

  if (!replace) {
    historyStack.splice(histIndex + 1);
    historyStack.push(url);
    histIndex = historyStack.length - 1;
  }

  setStatus(CS.t ? CS.t('browser.status_open', { url: url }) : url);
  updateWallet();

  const root = document.getElementById('pageRoot');
  root.innerHTML = '';

  const renderer = SITES[url];
  if (renderer) {
    renderer(root);
    setStatus(CS.t ? CS.t('browser.status_ok') : 'OK');
  } else {
    root.innerHTML = `
      <div class="page-header">
        <h1>404 — Страница не найдена</h1>
        <div class="tagline">${url}</div>
      </div>
      <p>Такого сайта в локальной сети КЭШ.СТРИМ нет.</p>
      <div class="link-list">
        <button class="linkish" data-go="home.cash">← Вернуться на стартовую</button>
      </div>`;
    root.querySelector('[data-go]').addEventListener('click', () => navigate('home.cash'));
    setStatus(CS.t ? CS.t('browser.status_404') : '404');
  }
}

function goBack() {
  if (histIndex > 0) {
    histIndex--;
    navigate(historyStack[histIndex], true);
  }
}

function goForward() {
  if (histIndex < historyStack.length - 1) {
    histIndex++;
    navigate(historyStack[histIndex], true);
  }
}

// ---- Страницы -------------------------------------------------------------

function renderHome(root) {
  root.innerHTML = `
    <div class="page-header">
      <h1>🌐 Сеть КЭШ.СТРИМ</h1>
      <div class="tagline">Локальный портал офиса 90-х · уровень ${state.level}</div>
    </div>
    <div class="hint-box">
      Выберите сайт в закладках или введите адрес. Здесь можно нанимать сотрудников,
      улучшать рабочее место и смотреть гос. сервисы.
      Заказы берутся в программе «Биржа.exe» на рабочем столе.
    </div>
    <div class="page-grid">
      <div class="card bevel-out">
        <h3>👔 Работа.Кэш</h3>
        <p>Найм стажёров и менеджеров проектов. Лимит штата зависит от регистрации бизнеса.</p>
        <button class="win95-btn bevel-out" data-go="rabota.cash">Открыть</button>
      </div>
      <div class="card bevel-out">
        <h3>🛒 Офис.Маркет</h3>
        <p>Оборудование, кофемашина, кресло и мониторы — реальный бонус команде.</p>
        <button class="win95-btn bevel-out" data-go="office.market">Открыть</button>
      </div>
      <div class="card bevel-out">
        <h3>🏛 Госуслуги.Кэш</h3>
        <p>Справка о регистрации, налогах и рисках ФНС.</p>
        <button class="win95-btn bevel-out" data-go="gos.cash">Открыть</button>
      </div>
    </div>`;
  root.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.go));
  });
}

function renderRabota(root) {
  const cost = CS.internCost(state);
  const cap = CS.internCap(state);
  const atCap = state.interns >= cap;
  const pmCost = CS.pmCost(state);
  const pmCap = CS.pmCap(state);
  const pms = state.projectManagers || 0;
  const pmAtCap = pms >= pmCap;
  const type = CS.businessType(state);
  const typeLabel = {
    none: CS.t ? CS.t('browser.biz_none') : 'none',
    self: CS.t ? CS.t('browser.biz_self') : 'self',
    ip: CS.t ? CS.t('browser.biz_ip') : 'ip',
    ooo: CS.t ? CS.t('browser.biz_ooo') : 'ooo'
  }[type] || type;
  const needBiz = type !== 'ip' && type !== 'ooo';

  root.innerHTML = `
    <div class="page-header">
      <h1>${CS.t ? CS.t('browser.rabota_title') : 'Work.Cash'}</h1>
      <div class="tagline">${CS.t ? CS.t('browser.rabota_tag', { type: typeLabel }) : typeLabel}</div>
    </div>
    <div class="hint-box">
      ${(CS.t ? CS.t('browser.rabota_hint', { n: CS.CONFIG.INTERN_CAP_UNREGISTERED }) : '').replace(/\n/g, '<br>')}
    </div>
    <div class="card bevel-out" style="margin-bottom:10px;">
      <h3>${CS.t ? CS.t('browser.interns') : 'Interns'}</h3>
      <p>${CS.t ? CS.t('browser.staff_of', { cur: state.interns, cap: cap === Infinity ? '∞' : cap }) : state.interns}</p>
      <p>${CS.t ? CS.t('browser.intern_help_line', { n: (state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1) }) : ''}</p>
      <p class="meta">${CS.t ? CS.t('browser.next_cost_line', { n: cost }) : cost}</p>
      <button class="win95-btn bevel-out" id="hireBtn" ${atCap || state.cash < cost ? 'disabled' : ''}>
        ${atCap ? (CS.t ? CS.t('browser.staff_cap') : 'cap') : (CS.t ? CS.t('browser.hire_intern', { n: cost }) : cost)}
      </button>
      <span id="hireMsg" style="margin-left:8px;font-size:11px;"></span>
    </div>
    <div class="card bevel-out" style="margin-bottom:10px;">
      <h3>${CS.t ? CS.t('browser.pms') : 'PMs'}</h3>
      <p>${CS.t ? CS.t('browser.staff_of', { cur: pms, cap: pmCap === Infinity ? '∞' : pmCap }) : pms}</p>
      <p class="meta">${CS.t ? CS.t('browser.pm_meta') : ''}</p>
      <p class="meta">${CS.t ? CS.t('browser.next_cost_line', { n: pmCost }) : pmCost}</p>
      <button class="win95-btn bevel-out" id="hirePmBtn" ${pmAtCap || needBiz || state.cash < pmCost ? 'disabled' : ''}>
        ${needBiz ? (CS.t ? CS.t('browser.need_biz') : 'biz') : (pmAtCap ? (CS.t ? CS.t('browser.limit') : 'cap') : (CS.t ? CS.t('browser.hire_pm', { n: pmCost }) : pmCost))}
      </button>
      <span id="hirePmMsg" style="margin-left:8px;font-size:11px;"></span>
    </div>
    <table class="table-simple">
      <tr><th>${CS.t ? CS.t('browser.col_role') : ''}</th><th>${CS.t ? CS.t('browser.col_effect') : ''}</th><th>${CS.t ? CS.t('browser.col_status') : ''}</th></tr>
      <tr><td>${CS.t ? CS.t('browser.role_intern_row') : 'Intern'}</td><td>${CS.t ? CS.t('browser.effect_intern_row') : ''}</td><td>${CS.t ? CS.t('browser.status_ok') : ''}</td></tr>
      <tr><td>${CS.t ? CS.t('browser.role_pm_row') : 'PM'}</td><td>${CS.t ? CS.t('browser.effect_pm_row') : ''}</td><td>${needBiz ? (CS.t ? CS.t('browser.status_need_biz') : '') : (CS.t ? CS.t('browser.status_ok') : '')}</td></tr>
      <tr><td>Младший разработчик</td><td>—</td><td>🔒 скоро</td></tr>
    </table>`;

  const btn = root.querySelector('#hireBtn');
  if (btn && !btn.disabled) {
    btn.addEventListener('click', async () => {
      state = await CS.loadState();
      const result = CS.hireIntern(state);
      const msg = root.querySelector('#hireMsg');
      if (!result.success) {
        msg.textContent = result.reason === 'cap' ? (CS.t ? CS.t('browser.err_cap') : 'cap') : (CS.t ? CS.t('browser.err_cash') : 'cash');
        root.classList.add('shake');
        setTimeout(() => root.classList.remove('shake'), 130);
        return;
      }
      CS.saveState(state);
      msg.textContent = CS.t ? CS.t('browser.hired') : 'OK';
      root.classList.add('flash-ok');
      setTimeout(() => root.classList.remove('flash-ok'), 400);
      navigate('rabota.cash', true);
    });
  }
  const pmBtn = root.querySelector('#hirePmBtn');
  if (pmBtn && !pmBtn.disabled) {
    pmBtn.addEventListener('click', async () => {
      state = await CS.loadState();
      const result = CS.hireProjectManager(state);
      const msg = root.querySelector('#hirePmMsg');
      if (!result.success) {
        msg.textContent = result.reason === 'cap' ? (CS.t ? CS.t('browser.err_pm') : 'cap') : (CS.t ? CS.t('browser.err_cash') : 'cash');
        root.classList.add('shake');
        setTimeout(() => root.classList.remove('shake'), 130);
        return;
      }
      CS.saveState(state);
      msg.textContent = CS.t ? CS.t('browser.pm_hired') : 'OK';
      root.classList.add('flash-ok');
      setTimeout(() => root.classList.remove('flash-ok'), 400);
      navigate('rabota.cash', true);
    });
  }
}

function renderOfficeMarket(root) {
  const equipCost = CS.equipCost(state);
  const coffeeCost = CS.coffeeCost(state);
  const chairCost = CS.chairCost(state);
  const monitorCost = CS.monitorCost(state);
  const chairLvl = state.chairLevel || 0;
  const monLvl = state.monitorLevel || 0;
  const comboWin = (typeof CS.comboWindowMs === 'function') ? CS.comboWindowMs(state) : CS.CONFIG.COMBO_WINDOW_MS;

  root.innerHTML = `
    <div class="page-header">
      <h1>🛒 Офис.Маркет</h1>
      <div class="tagline">Всё для продуктивного рабочего места и команды</div>
    </div>
    <div class="hint-box">
      Апгрейды работают сразу: оборудование усиливает клик, кофе экономит фокус,
      кресло снижает выгорание, монитор удлиняет окно комбо. Полезно и вам, и стажёрам на проекте.
    </div>
    <div class="page-grid">
      <div class="card bevel-out">
        <h3>💻 Оборудование</h3>
        <p>Уровень: <b>${state.equipLevel}</b></p>
        <p class="meta">Бонус к клику: +${(state.equipLevel * CS.CONFIG.EQUIP_CLICK_BONUS).toFixed(1)}</p>
        <div class="price">${equipCost}💰</div>
        <button class="win95-btn bevel-out" id="buyEquip" ${state.cash < equipCost ? 'disabled' : ''}>
          Улучшить
        </button>
      </div>
      <div class="card bevel-out">
        <h3>☕ Кофемашина</h3>
        <p>Уровень: <b>${state.coffeeLevel}</b></p>
        <p class="meta">Экономия фокуса за клик</p>
        <div class="price">${coffeeCost}💰</div>
        <button class="win95-btn bevel-out" id="buyCoffee" ${state.cash < coffeeCost ? 'disabled' : ''}>
          Купить / улучшить
        </button>
      </div>
      <div class="card bevel-out">
        <h3>🪑 Кресло руководителя</h3>
        <p>Уровень: <b>${chairLvl}</b></p>
        <p class="meta">−набор выгорания, +спад в простое</p>
        <div class="price">${chairCost}💰</div>
        <button class="win95-btn bevel-out" id="buyChair" ${state.cash < chairCost ? 'disabled' : ''}>
          Купить / улучшить
        </button>
      </div>
      <div class="card bevel-out">
        <h3>🖥 Второй монитор</h3>
        <p>Уровень: <b>${monLvl}</b></p>
        <p class="meta">Окно комбо: ${comboWin} мс (+${CS.CONFIG.MONITOR_COMBO_WINDOW_BONUS} мс/ур.)</p>
        <div class="price">${monitorCost}💰</div>
        <button class="win95-btn bevel-out" id="buyMonitor" ${state.cash < monitorCost ? 'disabled' : ''}>
          Купить / улучшить
        </button>
      </div>
    </div>`;

  function bindBuy(id, fn) {
    const el = root.querySelector(id);
    if (el && !el.disabled) {
      el.addEventListener('click', async () => {
        state = await CS.loadState();
        const r = fn(state);
        if (!r.success) { root.classList.add('shake'); setTimeout(() => root.classList.remove('shake'), 130); return; }
        CS.saveState(state);
        navigate('office.market', true);
      });
    }
  }
  bindBuy('#buyEquip', CS.buyEquip);
  bindBuy('#buyCoffee', CS.buyCoffee);
  bindBuy('#buyChair', CS.buyChair);
  bindBuy('#buyMonitor', CS.buyMonitor);
}

function renderGos(root) {
  const type = CS.businessType(state);
  const typeLabel = {
    none: CS.t ? CS.t('browser.biz_none') : 'none',
    self: CS.t ? CS.t('browser.biz_self') : 'self',
    ip: CS.t ? CS.t('browser.biz_ip') : 'ip',
    ooo: CS.t ? CS.t('browser.biz_ooo') : 'ooo'
  }[type] || type;
  const onec = CS.ensureOnec(state);
  const reg = onec.registration || {};

  root.innerHTML = `
    <div class="page-header">
      <h1>🏛 Госуслуги.Кэш</h1>
      <div class="tagline">Справки и статус регистрации</div>
    </div>
    <div class="card bevel-out" style="margin-bottom:10px;">
      <h3>Статус бизнеса</h3>
      <p><b>${typeLabel}</b></p>
      ${reg.name ? `<p class="meta">Наименование: ${reg.name}</p>` : ''}
      ${reg.inn ? `<p class="meta">ИНН: ${reg.inn}</p>` : ''}
      <p class="meta">Налоговый риск: ${Math.floor(state.taxRisk || 0)}</p>
      <p class="meta">Долг: ${Math.floor(state.debt || 0)}💰</p>
    </div>
    <div class="hint-box">
      Регистрация самозанятости / ИП / ООО выполняется в программе
      <b>Отчетность.exe</b>. Этот сайт только показывает текущий статус.
    </div>
    <div class="link-list">
      <button class="linkish" data-go="home.cash">← На стартовую</button>
    </div>`;
  root.querySelector('[data-go]').addEventListener('click', () => navigate('home.cash'));
}

init();
