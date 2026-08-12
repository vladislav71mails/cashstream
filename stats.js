// ============================================================================
// Отчетность.exe — симулятор 1С:Предприятие (бюрократия, регистрация,
// отчётность, налоги, игровая статистика). ЭЦП/СКЗИ и Магазин приложений
// вынесены в отдельные программы (crypto.html / store.html) — эта программа
// отвечает только за учёт и отчётность.
// ============================================================================

let state = null;
let selectedPeriod = 'day';

const COSTS = {
  install: 0,
  update: 80,
  patch: 40,
  directories: 30,
  license: 450,       // лицензия 1С
  its: 320,           // 1С:ИТС
  reporting: 280,     // 1С:Отчётность
  regSelf: 50,
  regIp: 200,
  regOoo: 500,
  regOooCapital: 1000
};

function ensureOnec(s) {
  return CS.ensureOnec(s);
}

function log(elId, msg, type = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  const time = new Date().toLocaleTimeString('ru');
  const line = document.createElement('div');
  line.className = type;
  line.textContent = `[${time}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function genInn(type) {
  // упрощённый «ИНН»
  const base = String(Math.floor(1000000000 + Math.random() * 9000000000));
  return type === 'ooo' ? base + String(Math.floor(10 + Math.random() * 90)) : base.slice(0, 12);
}

function genOgrn(type) {
  if (type === 'self') return '';
  const prefix = type === 'ip' ? '3' : '1';
  return prefix + String(Math.floor(1e12 + Math.random() * 9e12)).slice(0, 12);
}

// ---- Заставка при запуске (визуальная имитация загрузки 1С) ----
async function runBootSequence() {
  const boot = document.getElementById('onecBoot');
  const logEl = document.getElementById('onecBootLog');
  const fill = document.getElementById('onecBootFill');
  if (!boot) return;

  const lines = [
    'Инициализация конфигурации «КЭШ.СТРИМ: Учёт и отчётность»…',
    'Подключение к информационной базе…',
    'Проверка лицензии платформы…',
    'Загрузка форм и справочников…',
    'Готово.'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = document.createElement('div');
    line.textContent = lines[i];
    logEl.appendChild(line);
    fill.style.width = Math.round(((i + 1) / lines.length) * 100) + '%';
    await new Promise((r) => setTimeout(r, 260 + Math.random() * 220));
  }

  await new Promise((r) => setTimeout(r, 220));
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 450);
}

// ---- Готовность к сдаче ----
function isReadyToSubmit(onec) {
  return (
    onec.installed &&
    onec.updated &&
    onec.patchesInstalled >= onec.patchesNeeded &&
    onec.directoriesLoaded &&
    onec.licensePaid &&
    onec.itsPaid &&
    onec.reportingPaid &&
    onec.tokenBought &&
    onec.cryptoproInstalled &&
    onec.edsDrivers &&
    onec.skziLicense &&
    onec.registration.registered
  );
}

function readinessList(onec) {
  return [
    { ok: onec.installed, label: '1С установлена' },
    { ok: onec.updated, label: `Обновление до ${onec.targetVersion}` },
    { ok: onec.patchesInstalled >= onec.patchesNeeded, label: `Патчи (${onec.patchesInstalled}/${onec.patchesNeeded})` },
    { ok: onec.directoriesLoaded, label: 'Справочники загружены' },
    { ok: onec.licensePaid, label: 'Лицензия 1С' },
    { ok: onec.itsPaid, label: '1С:ИТС' },
    { ok: onec.reportingPaid, label: '1С:Отчётность' },
    { ok: onec.tokenBought, label: 'Токен (USB-ключ) — программа «ЭЦП и СКЗИ.exe»' },
    { ok: onec.cryptoproInstalled, label: 'КриптоПро CSP — программа «Магазин приложений.exe»' },
    { ok: onec.edsDrivers, label: 'Драйверы ЭЦП — программа «ЭЦП и СКЗИ.exe»' },
    { ok: onec.skziLicense, label: 'Лицензия СКЗИ — программа «ЭЦП и СКЗИ.exe»' },
    { ok: onec.registration.registered, label: 'Регистрация (ИП/ООО/самозанятый)' }
  ];
}

// ---- Рендер вкладок ----
function renderAll() {
  const onec = ensureOnec(state);
  renderSetup(onec);
  renderLicenses(onec);
  renderReg(onec);
  renderReport(onec);
  renderStatsTab();
  updateStatusBadge(onec);
}

function updateStatusBadge(onec) {
  const badge = document.getElementById('onecStatusBadge');
  const ver = document.getElementById('onecVersion');
  ver.textContent = onec.installed ? onec.version : 'не установлена';
  if (isReadyToSubmit(onec)) {
    badge.textContent = 'ГОТОВО К ОТЧЁТНОСТИ';
    badge.classList.add('ready');
  } else {
    badge.textContent = 'НЕ ГОТОВО';
    badge.classList.remove('ready');
  }
}

function renderSetup(onec) {
  const list = document.getElementById('setupChecklist');
  const items = [
    { ok: onec.installed, label: 'Платформа 1С:Предприятие установлена' },
    { ok: onec.updated, label: `Релиз актуален (${onec.version} → ${onec.targetVersion})` },
    { ok: onec.patchesInstalled >= onec.patchesNeeded, label: `Патчи безопасности (${onec.patchesInstalled}/${onec.patchesNeeded})` },
    { ok: onec.directoriesLoaded, label: 'Справочники (ОКВЭД, КБК, регионы) загружены' }
  ];
  list.innerHTML = items.map(i => `
    <div class="check-item ${i.ok ? 'done' : ''}">
      <span class="icon">${i.ok ? '✅' : '☐'}</span>
      <span>${i.label}</span>
    </div>
  `).join('');

  document.getElementById('btnInstall').disabled = onec.installed;
  document.getElementById('btnUpdate').disabled = !onec.installed || onec.updated;
  document.getElementById('btnPatch').disabled = !onec.updated || onec.patchesInstalled >= onec.patchesNeeded;
  document.getElementById('btnDirs').disabled = !onec.updated || onec.directoriesLoaded;

  const bootRelease = document.getElementById('onecBootRelease');
  if (bootRelease) bootRelease.textContent = onec.version;
}

function renderLicenses(onec) {
  const grid = document.getElementById('licenseGrid');
  const licenses = [
    { key: 'licensePaid', name: 'Лицензия 1С:Предприятие', desc: 'Основная лицензия на платформу. Без неё конфигурация не запустится в рабочем режиме.', price: COSTS.license },
    { key: 'itsPaid', name: '1С:ИТС (информационно-технологическое сопровождение)', desc: 'Обновления, консультации, доступ к базе знаний. Требуется для патчей.', price: COSTS.its },
    { key: 'reportingPaid', name: '1С:Отчётность', desc: 'Модуль электронной сдачи деклараций в ФНС, ПФР, ФСС.', price: COSTS.reporting }
  ];
  grid.innerHTML = licenses.map(l => `
    <div class="license-card ${onec[l.key] ? 'paid' : ''}">
      <div class="license-name">${l.name}</div>
      <div class="license-desc">${l.desc}</div>
      <div class="license-price">${onec[l.key] ? '✅ Оплачено' : l.price + '💰'}</div>
      <button class="win95-btn bevel-out" data-license="${l.key}" data-price="${l.price}" ${onec[l.key] ? 'disabled' : ''}>
        ${onec[l.key] ? 'Активна' : 'Купить'}
      </button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-license]').forEach(btn => {
    btn.addEventListener('click', () => buyLicense(btn.dataset.license, +btn.dataset.price));
  });
}

function renderReg(onec) {
  const r = onec.registration;
  const status = document.getElementById('regStatus');
  const formBox = document.getElementById('regForm');
  const typesBox = document.querySelector('.reg-types');
  const typeLabel = { self: 'Самозанятый', ip: 'ИП', ooo: 'ООО' };

  if (r.registered) {
    typesBox.style.display = 'none';
    formBox.style.display = 'none';
    document.querySelectorAll('input[name="regType"]').forEach(i => { i.disabled = true; });

    let upgradeHtml = '';
    if (r.type === 'self') {
      upgradeHtml = `<button class="win95-btn bevel-out" id="btnUpgradeIp">⬆️ Перейти на ИП — ${COSTS.regIp}💰</button>`;
    } else if (r.type === 'ip') {
      upgradeHtml = `<button class="win95-btn bevel-out" id="btnUpgradeOoo">⬆️ Перейти на ООО — ${COSTS.regOoo + COSTS.regOooCapital}💰</button>`;
    } else {
      upgradeHtml = `<span class="hint" style="margin:0;">Максимальный уровень регистрации бизнеса.</span>`;
    }

    status.innerHTML = `
      ✅ Зарегистрирован как <b>${typeLabel[r.type]}</b><br>
      ${r.name}<br>ИНН: ${r.inn}${r.ogrn ? ' · ОГРН: ' + r.ogrn : ''}
      <div class="onec-actions" style="margin-top:8px;margin-bottom:0;">${upgradeHtml}</div>
    `;

    const ipBtn = document.getElementById('btnUpgradeIp');
    if (ipBtn) ipBtn.addEventListener('click', () => upgradeBusiness('ip', COSTS.regIp));
    const oooBtn = document.getElementById('btnUpgradeOoo');
    if (oooBtn) oooBtn.addEventListener('click', () => upgradeBusiness('ooo', COSTS.regOoo + COSTS.regOooCapital));
  } else {
    typesBox.style.display = '';
    formBox.style.display = document.querySelector('input[name="regType"]:checked') ? 'block' : 'none';
    status.textContent = 'Статус: не зарегистрирован. Выберите форму и подайте заявление.';
  }

  renderBizRisk();
}

function renderBizRisk() {
  const box = document.getElementById('bizRiskBox');
  if (!box || !state) return;
  const type = CS.businessType(state);
  const onec = ensureOnec(state);
  const risk = Math.round(state.taxRisk || 0);
  const capWarned = !!onec.registration.capWarned;

  const labels = {
    none: '❌ Не зарегистрирован — риск проверки ФНС растёт от пассивного дохода (стажёры, недвижимость).',
    self: capWarned
      ? '⚠️ Лимит самозанятого превышен — риск проверки растёт точно так же, как без регистрации. Оформите ИП.'
      : '🧾 Самозанятый — доход в пределах лимита, риска нет.',
    ip: '💼 ИП — деятельность легальна, лимитов и риска нет.',
    ooo: '🏢 ООО — деятельность легальна, лимитов и риска нет. Доход с недвижимости +10%.'
  };

  const showGauge = type === 'none' || (type === 'self' && capWarned);
  box.innerHTML = `
    <div class="onec-section-title" style="margin-bottom:6px;">🚨 Риск проверки ФНС</div>
    <div>${labels[type]}</div>
    ${showGauge ? `
      <div class="win95-gauge burnout" style="margin-top:6px;">
        <i style="width:${Math.min(100, risk / 3)}%;"></i>
        <span class="gauge-label">Риск: ${risk}</span>
      </div>
    ` : ''}
  `;
}

function renderReport(onec) {
  const box = document.getElementById('readinessBox');
  const items = readinessList(onec);
  const ready = items.filter(i => i.ok).length;
  box.innerHTML = `
    <div style="margin-bottom:6px;font-weight:bold;">Готовность: ${ready}/${items.length}</div>
    <div class="checklist">
      ${items.map(i => `
        <div class="check-item ${i.ok ? 'done' : 'locked'}">
          <span class="icon">${i.ok ? '✅' : '☐'}</span>
          <span>${i.label}</span>
        </div>
      `).join('')}
    </div>
  `;

  const taxes = onec.taxes || { totalIncome: 0, totalPaid: 0, rate: 0.13 };
  const income = getTaxableIncome();
  const rate = getTaxRate(onec);
  const due = Math.floor(income * rate);
  const paid = taxes.totalPaid || 0;
  const remain = due - paid;

  document.getElementById('repIncome').textContent = Math.floor(income) + '💰';
  document.getElementById('repRate').textContent = (rate * 100).toFixed(0) + '%';
  document.getElementById('repTax').textContent = due + '💰';
  document.getElementById('repPaid').textContent = paid + '💰';
  document.getElementById('repRemain').textContent = (remain >= 0 ? remain : remain) + '💰';

  const canSubmit = isReadyToSubmit(onec);
  document.getElementById('btnSubmitReport').disabled = !canSubmit;
  document.getElementById('btnFormReport').disabled = !onec.installed;
}

function getTaxableIncome() {
  // Честный учёт: сумма всех положительных поступлений (клики, квесты,
  // стажёры, net-доход недвижимости, казино, ачивки…). Недвижимость входит.
  return CS.getTaxableIncome(state);
}

function getTaxRate(onec) {
  return CS.getTaxRate(state);
}

// ---- Действия ----
async function spend(amount, reason) {
  state = await CS.loadState();
  if (state.cash < amount) {
    alert(`Недостаточно средств! Нужно ${amount}💰, у вас ${Math.floor(state.cash)}💰`);
    return false;
  }
  state.cash -= amount;
  ensureOnec(state);
  if (!state.stats.transactions) state.stats.transactions = [];
  state.stats.transactions.push({ type: 'onec', amount, date: Date.now(), description: reason });
  await CS.saveState(state);
  return true;
}

async function buyLicense(key, price) {
  const ok = await spend(price, 'Покупка: ' + key);
  if (!ok) return;
  const onec = ensureOnec(state);
  onec[key] = true;
  await CS.saveState(state);
  log('setupLog', `Оплачена лицензия (${price}💰). Ключ активирован.`, 'ok');
  renderAll();
}

function openApp(name) {
  try {
    if (window.parent && window.parent.WM) {
      window.parent.WM.open(name);
      return;
    }
  } catch (e) { /* ignore */ }
  alert('Откройте эту программу с рабочего стола.');
}

async function upgradeBusiness(newType, cost) {
  const ok = await spend(cost, 'Переход на ' + newType.toUpperCase());
  if (!ok) return;
  state = await CS.loadState();
  const onec = ensureOnec(state);
  onec.registration.type = newType;
  if (!onec.registration.ogrn) onec.registration.ogrn = genOgrn(newType);
  onec.taxes.rate = getTaxRate(onec);
  await CS.saveState(state);
  alert(`Поздравляем! Теперь вы ${newType === 'ip' ? 'ИП' : 'ООО'}.`);
  renderAll();
}

// Установка / обновление
document.getElementById('btnInstall').addEventListener('click', async () => {
  log('setupLog', 'Запуск установщика 1С:Предприятие 8.3...', 'info');
  await delay(600);
  state = await CS.loadState();
  const onec = ensureOnec(state);
  onec.installed = true;
  onec.version = '8.3.10';
  await CS.saveState(state);
  log('setupLog', 'Установка завершена. Версия 8.3.10 (устаревшая). Требуется обновление.', 'ok');
  renderAll();
});

document.getElementById('btnUpdate').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  if (!onec.itsPaid) {
    log('setupLog', 'ОШИБКА: для обновления нужен активный 1С:ИТС.', 'err');
    alert('Для получения обновлений требуется подписка 1С:ИТС. Купите её во вкладке «Настройка 1С».');
    return;
  }
  const ok = await spend(COSTS.update, 'Обновление 1С до ' + onec.targetVersion);
  if (!ok) return;
  log('setupLog', 'Скачивание дистрибутива релиза ' + onec.targetVersion + '...', 'info');
  await delay(800);
  log('setupLog', 'Установка обновления...', 'info');
  await delay(700);
  state = await CS.loadState();
  const o = ensureOnec(state);
  o.updated = true;
  o.version = o.targetVersion;
  await CS.saveState(state);
  log('setupLog', `Обновление успешно. Текущий релиз: ${o.version}`, 'ok');
  renderAll();
});

document.getElementById('btnPatch').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  if (!onec.itsPaid) {
    log('setupLog', 'ОШИБКА: патчи доступны только по ИТС.', 'err');
    return;
  }
  const ok = await spend(COSTS.patch, 'Установка патча 1С');
  if (!ok) return;
  log('setupLog', `Установка патча ${onec.patchesInstalled + 1}/${onec.patchesNeeded}...`, 'info');
  await delay(500);
  state = await CS.loadState();
  const o = ensureOnec(state);
  o.patchesInstalled = Math.min(o.patchesNeeded, o.patchesInstalled + 1);
  await CS.saveState(state);
  log('setupLog', `Патч установлен (${o.patchesInstalled}/${o.patchesNeeded}).`, 'ok');
  renderAll();
});

document.getElementById('btnDirs').addEventListener('click', async () => {
  const ok = await spend(COSTS.directories, 'Загрузка справочников 1С');
  if (!ok) return;
  log('setupLog', 'Загрузка классификаторов ОКВЭД, КБК, адресов ФИАС...', 'info');
  await delay(700);
  state = await CS.loadState();
  ensureOnec(state).directoriesLoaded = true;
  await CS.saveState(state);
  log('setupLog', 'Справочники успешно загружены.', 'ok');
  renderAll();
});

// Регистрация
document.querySelectorAll('input[name="regType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const type = radio.value;
    document.getElementById('regForm').style.display = 'block';
    document.getElementById('regInn').value = genInn(type);
    document.getElementById('regOgrn').value = genOgrn(type);
    document.getElementById('ogrnRow').style.display = type === 'self' ? 'none' : 'flex';
    document.querySelectorAll('.reg-card').forEach(c => c.classList.remove('selected'));
    radio.closest('.reg-card').classList.add('selected');
  });
});

document.getElementById('btnRegister').addEventListener('click', async () => {
  const type = document.querySelector('input[name="regType"]:checked')?.value;
  if (!type) { alert('Выберите форму регистрации'); return; }
  const name = document.getElementById('regName').value.trim();
  if (!name) { alert('Укажите ФИО / наименование'); return; }

  let cost = COSTS.regSelf;
  if (type === 'ip') cost = COSTS.regIp;
  if (type === 'ooo') cost = COSTS.regOoo + COSTS.regOooCapital;

  const ok = await spend(cost, 'Регистрация ' + type.toUpperCase());
  if (!ok) return;

  state = await CS.loadState();
  const onec = ensureOnec(state);
  Object.assign(onec.registration, {
    type,
    name,
    inn: document.getElementById('regInn').value,
    ogrn: document.getElementById('regOgrn').value,
    registered: true,
    lifetimeIncome: onec.registration.lifetimeIncome || 0,
    capWarned: onec.registration.capWarned || false
  });
  onec.taxes.rate = getTaxRate(onec);
  await CS.saveState(state);
  alert(`Поздравляем! Вы зарегистрированы как ${type === 'self' ? 'самозанятый' : type === 'ip' ? 'ИП' : 'ООО'}.\nИНН: ${onec.registration.inn}`);
  renderAll();
});

// Открытие связанных программ
document.getElementById('btnOpenCrypto').addEventListener('click', () => openApp('crypto'));
document.getElementById('btnOpenStore').addEventListener('click', () => openApp('store'));

// Отчётность
document.getElementById('btnFormReport').addEventListener('click', () => {
  const onec = ensureOnec(state);
  if (!onec.installed) {
    log('reportLog', '1С не установлена.', 'err');
    return;
  }
  log('reportLog', 'Формирование декларации 3-НДФЛ / УСН / НПД...', 'info');
  setTimeout(() => {
    log('reportLog', 'Декларация сформирована. Проверьте суммы и подпишите ЭЦП.', 'ok');
  }, 500);
});

document.getElementById('btnPayTax').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  const income = getTaxableIncome();
  const rate = getTaxRate(onec);
  const due = Math.floor(income * rate);
  const paid = onec.taxes.totalPaid || 0;
  const remain = due - paid;
  if (remain <= 0) {
    alert('Налог уже уплачен полностью.');
    return;
  }
  const ok = await spend(remain, 'Уплата налога');
  if (!ok) return;
  state = await CS.loadState();
  ensureOnec(state).taxes.totalPaid = due;
  await CS.saveState(state);
  log('reportLog', `Налог уплачен: ${remain}💰`, 'ok');
  renderAll();
});

document.getElementById('btnSubmitReport').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  if (!isReadyToSubmit(onec)) {
    alert('Не выполнены все условия для сдачи отчётности. Смотрите чеклист.');
    return;
  }
  const income = getTaxableIncome();
  const rate = getTaxRate(onec);
  const due = Math.floor(income * rate);
  const paid = onec.taxes.totalPaid || 0;
  if (paid < due) {
    log('reportLog', 'ОШИБКА ФНС: налог не уплачен. Сначала оплатите задолженность.', 'err');
    alert('Налоговая отклонила отчёт: есть задолженность по налогу.');
    return;
  }

  log('reportLog', 'Подписание пакета ЭЦП (токен)...', 'info');
  await delay(700);
  log('reportLog', 'Отправка в приёмник ФНС...', 'info');
  await delay(800);

  state = await CS.loadState();
  const o = ensureOnec(state);
  o.reportsSubmitted += 1;
  o.lastReportAt = Date.now();
  // Небольшой «возврат/субсидия» за дисциплину — заметно меньше типичного налога,
  // чтобы сдача отчётности не была чистым плюсом к кэшу.
  const bonus = 25 + Math.min(50, o.reportsSubmitted * 5);
  state.cash += bonus;
  if (!state.stats.transactions) state.stats.transactions = [];
  state.stats.transactions.push({ type: 'onec_bonus', amount: -bonus, date: Date.now(), description: 'Бонус за сдачу отчётности' });
  await CS.saveState(state);

  log('reportLog', `Отчёт принят ФНС. Протокол входящий №${1000 + o.reportsSubmitted}. Бонус: +${bonus}💰`, 'ok');
  alert(`✅ Отчётность сдана!\nПротокол №${1000 + o.reportsSubmitted}\nБонус за дисциплину: +${bonus}💰`);
  renderAll();
});

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---- Вкладки ----
document.querySelectorAll('.onec-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.onec-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.onec-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'stats') {
      renderStatsTab();
      renderCharts();
    }
    if (tab.dataset.tab === 'reg') {
      renderBizRisk();
    }
  });
});

// ---- Статистика (графики) ----
function getPeriodStart(period) {
  const now = Date.now();
  switch (period) {
    case 'day': return now - 86400000;
    case 'week': return now - 7 * 86400000;
    case 'month': return now - 30 * 86400000;
    default: return 0;
  }
}

function getIncomeForPeriod(st, period) {
  const start = getPeriodStart(period);
  const hist = st.stats?.history || [];
  const rec = hist.filter(h => h.timestamp >= start);
  if (!rec.length) return st.totalsToday?.cash || 0;
  return rec.reduce((s, r) => s + (r.income || 0), 0);
}

function getExpensesForPeriod(st, period) {
  const start = getPeriodStart(period);
  const hist = st.stats?.history || [];
  const rec = hist.filter(h => h.timestamp >= start);
  return rec.reduce((s, r) => s + (r.expenses || 0), 0);
}

function renderStatsTab() {
  if (!state) return;
  const income = getIncomeForPeriod(state, selectedPeriod);
  const expenses = getExpensesForPeriod(state, selectedPeriod);
  document.getElementById('statsBalance').textContent = Math.floor(state.cash);
  document.getElementById('statsIncome').textContent = Math.floor(income);
  document.getElementById('statsExpenses').textContent = Math.floor(expenses);
  document.getElementById('statsProfit').textContent = Math.floor(income - expenses);

  const onec = ensureOnec(state);
  document.getElementById('reportsCount').textContent = onec.reportsSubmitted;
  document.getElementById('lastReportDate').textContent = onec.lastReportAt
    ? new Date(onec.lastReportAt).toLocaleString('ru')
    : '—';
}

function renderCharts() {
  const canvas = document.getElementById('capitalChart');
  if (!canvas || !state) return;
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  canvas.width = Math.max(280, parent.clientWidth - 16);
  canvas.height = 150;

  const data = (state.stats.history || []).filter(d => d.timestamp >= getPeriodStart(selectedPeriod));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (data.length < 2) {
    ctx.fillStyle = '#888';
    ctx.font = '12px Tahoma';
    ctx.textAlign = 'center';
    ctx.fillText('Недостаточно данных', canvas.width / 2, canvas.height / 2);
    return;
  }
  const pad = { t: 8, b: 18, l: 36, r: 8 };
  const w = canvas.width - pad.l - pad.r;
  const h = canvas.height - pad.t - pad.b;
  const vals = data.map(d => d.balance || 0);
  const maxV = Math.max(...vals, 100);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const y = pad.t + (h / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(canvas.width - pad.r, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#2a7a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = pad.l + (i / (vals.length - 1)) * w;
    const y = pad.t + h - ((v - minV) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    selectedPeriod = this.dataset.period;
    renderStatsTab();
    renderCharts();
  });
});

function addHistoryRecord(st) {
  if (!st.stats) st.stats = { history: [], transactions: [] };
  if (!st.stats.history) st.stats.history = [];
  st.stats.history.push({
    timestamp: Date.now(),
    balance: st.cash,
    income: st.totalsToday?.cash || 0,
    expenses: 0
  });
  if (st.stats.history.length > 1000) st.stats.history = st.stats.history.slice(-1000);
}

// ---- Init ----
async function init() {
  try {
    state = await CS.loadState();
    ensureOnec(state);
    await CS.saveState(state);

    renderAll();
    renderCharts();

    CS.onStateChanged((newState) => {
      state = newState;
      ensureOnec(state);
      renderAll();
      if (document.getElementById('tab-stats').classList.contains('active')) {
        renderStatsTab();
        renderCharts();
      }
    });

    setInterval(() => {
      if (state) {
        addHistoryRecord(state);
        CS.saveState(state);
      }
    }, 30000);

    addHistoryRecord(state);
  } catch (err) {
    CS.reportFatalError(err);
  }
}

runBootSequence();
init();