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
  'zakazy.birzh': renderZakazy,
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

  setStatus('Открытие ' + url + '…');
  updateWallet();

  const root = document.getElementById('pageRoot');
  root.innerHTML = '';

  const renderer = SITES[url];
  if (renderer) {
    renderer(root);
    setStatus('Готово');
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
    setStatus('Ошибка 404');
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
    </div>
    <div class="page-grid">
      <div class="card bevel-out">
        <h3>👔 Работа.Кэш</h3>
        <p>Биржа труда и найм стажёров. Лимит штата зависит от регистрации бизнеса.</p>
        <button class="win95-btn bevel-out" data-go="rabota.cash">Открыть</button>
      </div>
      <div class="card bevel-out">
        <h3>🛒 Офис.Маркет</h3>
        <p>Оборудование, кофемашина и улучшения рабочего места.</p>
        <button class="win95-btn bevel-out" data-go="office.market">Открыть</button>
      </div>
      <div class="card bevel-out">
        <h3>📋 Биржа заказов</h3>
        <p>Лента фриланс-заказов (ранний прототип).</p>
        <button class="win95-btn bevel-out" data-go="zakazy.birzh">Открыть</button>
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
  const type = CS.businessType(state);
  const typeLabel = { none: 'не зарегистрирован', self: 'самозанятый', ip: 'ИП', ooo: 'ООО' }[type] || type;

  root.innerHTML = `
    <div class="page-header">
      <h1>👔 Работа.Кэш — биржа труда</h1>
      <div class="tagline">Найм стажёров · статус бизнеса: ${typeLabel}</div>
    </div>
    <div class="hint-box">
      Без регистрации (или только самозанятость) можно держать максимум
      <b>${CS.CONFIG.INTERN_CAP_UNREGISTERED}</b> стажёра. ИП/ООО — без лимита.
      Оформление — в программе «Отчетность.exe».
    </div>
    <div class="card bevel-out" style="margin-bottom:10px;">
      <h3>Текущий штат</h3>
      <p>Стажёров: <b>${state.interns}</b> / ${cap === Infinity ? '∞' : cap}</p>
      <p>Доход от стажёров: <b>${(state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1)}</b>💰/с</p>
      <p class="meta">Стоимость следующего: ${cost}💰</p>
      <button class="win95-btn bevel-out" id="hireBtn" ${atCap || state.cash < cost ? 'disabled' : ''}>
        ${atCap ? 'Лимит штата' : `Нанять стажёра (−${cost}💰)`}
      </button>
      <span id="hireMsg" style="margin-left:8px;font-size:11px;"></span>
    </div>
    <table class="table-simple">
      <tr><th>Должность</th><th>Эффект</th><th>Статус</th></tr>
      <tr><td>Стажёр</td><td>+${CS.CONFIG.INTERN_INCOME_PER_TICK}💰/с</td><td>доступно</td></tr>
      <tr><td>Младший разработчик</td><td>—</td><td>🔒 скоро</td></tr>
      <tr><td>Менеджер проектов</td><td>—</td><td>🔒 скоро</td></tr>
    </table>`;

  const btn = root.querySelector('#hireBtn');
  if (btn && !btn.disabled) {
    btn.addEventListener('click', async () => {
      state = await CS.loadState();
      const result = CS.hireIntern(state);
      const msg = root.querySelector('#hireMsg');
      if (!result.success) {
        msg.textContent = result.reason === 'cap' ? 'Достигнут лимит штата' : 'Недостаточно средств';
        root.classList.add('shake');
        setTimeout(() => root.classList.remove('shake'), 130);
        return;
      }
      CS.saveState(state);
      msg.textContent = 'Нанят!';
      root.classList.add('flash-ok');
      setTimeout(() => root.classList.remove('flash-ok'), 400);
      navigate('rabota.cash', true);
    });
  }
}

function renderOfficeMarket(root) {
  const equipCost = CS.equipCost(state);
  const coffeeCost = CS.coffeeCost(state);

  root.innerHTML = `
    <div class="page-header">
      <h1>🛒 Офис.Маркет</h1>
      <div class="tagline">Всё для продуктивного рабочего места</div>
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
        <p class="meta">Снижение выгорания (скоро)</p>
        <div class="price">—</div>
        <button class="win95-btn bevel-out" disabled>🔒 Скоро</button>
      </div>
      <div class="card bevel-out">
        <h3>🖥 Второй монитор</h3>
        <p class="meta">Комбо дольше держится (скоро)</p>
        <div class="price">—</div>
        <button class="win95-btn bevel-out" disabled>🔒 Скоро</button>
      </div>
    </div>`;

  const eq = root.querySelector('#buyEquip');
  if (eq && !eq.disabled) {
    eq.addEventListener('click', async () => {
      state = await CS.loadState();
      const r = CS.buyEquip(state);
      if (!r.success) { root.classList.add('shake'); setTimeout(() => root.classList.remove('shake'), 130); return; }
      CS.saveState(state);
      navigate('office.market', true);
    });
  }
  const cf = root.querySelector('#buyCoffee');
  if (cf && !cf.disabled) {
    cf.addEventListener('click', async () => {
      state = await CS.loadState();
      const r = CS.buyCoffee(state);
      if (!r.success) { root.classList.add('shake'); setTimeout(() => root.classList.remove('shake'), 130); return; }
      CS.saveState(state);
      navigate('office.market', true);
    });
  }
}

function renderZakazy(root) {
  root.innerHTML = `
    <div class="page-header">
      <h1>📋 Биржа заказов</h1>
      <div class="tagline">Фриланс-лента · прототип</div>
    </div>
    <div class="hint-box">
      Здесь появятся случайные заказы с разной сложностью, рейтингом исполнителя
      и штрафами за срыв дедлайна. Пока раздел в разработке — основные задания
      выполняются в «Задачи.exe» и «Работа.exe».
    </div>
    <table class="table-simple">
      <tr><th>Заказ</th><th>Оплата</th><th>Сложность</th><th></th></tr>
      <tr><td>Лендинг для кофейни</td><td>180💰</td><td>★☆☆</td><td><button class="win95-btn bevel-out" disabled>🔒</button></td></tr>
      <tr><td>Интеграция с 1С</td><td>420💰</td><td>★★☆</td><td><button class="win95-btn bevel-out" disabled>🔒</button></td></tr>
      <tr><td>Рефакторинг легаси</td><td>650💰</td><td>★★★</td><td><button class="win95-btn bevel-out" disabled>🔒</button></td></tr>
    </table>`;
}

function renderGos(root) {
  const type = CS.businessType(state);
  const typeLabel = { none: 'Не зарегистрирован', self: 'Самозанятый', ip: 'ИП', ooo: 'ООО' }[type] || type;
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
