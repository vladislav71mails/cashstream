// ============================================================================
// Отчетность.exe — кабинет учёта (регистрация,
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
  license: 450,
  its: 320,           // подписка на обновления (~400 тиков)
  reporting: 280,     // модуль сдачи (~350 тиков)
  itsDays: 400,
  reportingDays: 350,
  dirsDays: 300,
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

// ---- Заставка при запуске ----
async function runBootSequence() {
  const boot = document.getElementById('onecBoot');
  const logEl = document.getElementById('onecBootLog');
  const fill = document.getElementById('onecBootFill');
  if (!boot) return;

  const lines = [
    (CS.t ? CS.t('m.e88a456c6b') : 'Запуск кабинета учёта…'),
    (CS.t ? CS.t('m.e3116a7b60') : 'Подключение книги доходов и расходов…'),
    (CS.t ? CS.t('m.e3e0a82e53') : 'Проверка подписок и ЭЦП…'),
    (CS.t ? CS.t('m.a046c11f13') : 'Загрузка справочников ФНС…'),
    (CS.t ? CS.t('m.487d88cbb5') : 'Готово.')
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
function isWorkplaceReady(onec) {
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

function isReadyToSubmit(onec) {
  const p = onec.period || {};
  return isWorkplaceReady(onec) && p.diagnosed && p.declared && p.taxPaid && !p.submitted;
}

function readinessList(onec) {
  const p = onec.period || {};
  return [
    { ok: onec.installed, label: (CS.t ? CS.t('stats.cab_ok') : '') },
    { ok: onec.updated, label: `ПО актуально (v${onec.version} → ${onec.targetVersion})` },
    { ok: onec.patchesInstalled >= onec.patchesNeeded, label: `Патчи (${onec.patchesInstalled}/${onec.patchesNeeded})` },
    { ok: onec.directoriesLoaded, label: (CS.t ? CS.t('stats.dirs_short') : '') },
    { ok: onec.licensePaid, label: (CS.t ? CS.t('stats.lic_cabinet') : 'Лицензия кабинета') },
    { ok: onec.itsPaid, label: (CS.t ? CS.t('m.ab6aa9a23a') : 'Подписка на обновления (не просрочена)') },
    { ok: onec.reportingPaid, label: (CS.t ? CS.t('m.3989fffd0c') : 'Модуль сдачи отчётности (не просрочен)') },
    { ok: onec.tokenBought, label: (CS.t ? CS.t('m.e3922c7278') : 'Токен ЭЦП — «ЭЦП и СКЗИ.exe»') },
    { ok: onec.cryptoproInstalled, label: (CS.t ? CS.t('m.38e11f0235') : 'Криптопровайдер — «Магазин.exe»') },
    { ok: onec.edsDrivers && onec.skziLicense, label: (CS.t ? CS.t('m.a662ce4c60') : 'Драйверы и лицензия СКЗИ') },
    { ok: onec.registration.registered, label: (CS.t ? CS.t('m.0714f6263a') : 'Регистрация бизнеса') },
    { ok: !!p.diagnosed, label: (CS.t ? CS.t('m.a9f9dd524d') : '① Диагностика периода пройдена') },
    { ok: !!p.declared, label: (CS.t ? CS.t('m.df06f55fb1') : '② Декларация сформирована') },
    { ok: !!p.taxPaid, label: (CS.t ? CS.t('m.01a9370abf') : '③ Налог за период уплачен') },
    { ok: !!p.submitted, label: (CS.t ? CS.t('m.b2cba83fdd') : '④ Отчёт отправлен (закрыт)') }
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
  ver.textContent = onec.installed ? onec.version : (CS.t ? CS.t('stats.onec_none') : '—');
  if (isReadyToSubmit(onec)) {
    badge.textContent = CS.t ? CS.t('stats.ready') : 'READY';
    badge.classList.add('ready');
  } else {
    badge.textContent = CS.t ? CS.t('stats.not_ready') : 'NO';
    badge.classList.remove('ready');
  }
}

function renderSetup(onec) {
  const list = document.getElementById('setupChecklist');
  const items = [
    { ok: onec.installed, label: (CS.t ? CS.t('m.f94e6a13ee') : 'Кабинет учёта развёрнут') },
    { ok: onec.updated, label: `ПО актуально (${onec.version} → ${onec.targetVersion})` },
    { ok: onec.patchesInstalled >= onec.patchesNeeded, label: `Патчи безопасности (${onec.patchesInstalled}/${onec.patchesNeeded})` },
    { ok: onec.directoriesLoaded, label: (CS.t ? CS.t('m.aef1278874') : 'Справочники ФНС (КБК, ОК, регионы) актуальны') }
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
  // справочники можно обновлять снова, когда истекли
  document.getElementById('btnDirs').disabled = !onec.updated;

  const bootRelease = document.getElementById('onecBootRelease');
  if (bootRelease) bootRelease.textContent = onec.version;
}

function renderLicenses(onec) {
  const grid = document.getElementById('licenseGrid');
  const tick = (state && state._acctTick) || 0;
  const itsLeft = onec.itsPaid ? Math.max(0, (onec.itsUntilTick || 0) - tick) : 0;
  const repLeft = onec.reportingPaid ? Math.max(0, (onec.reportingUntilTick || 0) - tick) : 0;
  const licenses = [
    { key: 'licensePaid', name: CS.t ? CS.t('stats.lic_cabinet') : 'License', desc: CS.t ? CS.t('stats.lic_cabinet_d') : '', price: COSTS.license, status: onec.licensePaid ? (CS.t ? CS.t('stats.lic_forever') : 'OK') : null },
    { key: 'itsPaid', name: CS.t ? CS.t('stats.lic_its') : 'Updates', desc: CS.t ? CS.t('stats.lic_its_d') : '', price: COSTS.its, status: onec.itsPaid ? (CS.t ? CS.t('stats.lic_left', { n: itsLeft }) : String(itsLeft)) : null },
    { key: 'reportingPaid', name: CS.t ? CS.t('stats.lic_rep') : 'Tax module', desc: CS.t ? CS.t('stats.lic_rep_d') : '', price: COSTS.reporting, status: onec.reportingPaid ? (CS.t ? CS.t('stats.lic_left', { n: repLeft }) : String(repLeft)) : null }
  ];
  grid.innerHTML = licenses.map(l => `
    <div class="license-card ${onec[l.key] ? 'paid' : ''}">
      <div class="license-name">${l.name}</div>
      <div class="license-desc">${l.desc}</div>
      <div class="license-price">${l.status || (l.price + '💰')}</div>
      <button class="win95-btn bevel-out" data-license="${l.key}" data-price="${l.price}" ${onec[l.key] && l.key === 'licensePaid' ? 'disabled' : ''}>
        ${onec[l.key] && l.key === 'licensePaid' ? (CS.t ? CS.t('stats.lic_active') : 'Active') : (onec[l.key] ? (CS.t ? CS.t('stats.renew') : 'Renew') : (CS.t ? CS.t('stats.pay') : 'Pay'))}
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
  const typeLabel = { self: CS.t ? CS.t('stats.type_self') : 'self', ip: CS.t ? CS.t('stats.type_ip') : 'ip', ooo: CS.t ? CS.t('stats.type_ooo') : 'ooo' };

  if (r.registered) {
    typesBox.style.display = 'none';
    formBox.style.display = 'none';
    document.querySelectorAll('input[name="regType"]').forEach(i => { i.disabled = true; });

    let upgradeHtml = '';
    if (r.type === 'self') {
      upgradeHtml = `<button class="win95-btn bevel-out" id="btnUpgradeIp">${CS.t ? CS.t('stats.upgrade_ip', { n: COSTS.regIp }) : COSTS.regIp}</button>`;
    } else if (r.type === 'ip') {
      upgradeHtml = `<button class="win95-btn bevel-out" id="btnUpgradeOoo">${CS.t ? CS.t('stats.upgrade_ooo', { n: COSTS.regOoo + COSTS.regOooCapital }) : ''}</button>`;
    } else {
      upgradeHtml = `<span class="hint" style="margin:0;">${CS.t ? CS.t('stats.reg_max') : ''}</span>`;
    }

    status.innerHTML = `
      ${CS.t ? CS.t('stats.reg_ok', { type: typeLabel[r.type] }) : typeLabel[r.type]}<br>
      ${r.name}<br>ИНН: ${r.inn}${r.ogrn ? ' · ОГРН: ' + r.ogrn : ''}
      <div class="onec-actions" style="margin-top:8px;margin-bottom:0;">${upgradeHtml}</div>
    `;
    const renameForm = document.getElementById('renameForm');
    if (renameForm) {
      renameForm.style.display = 'block';
      const rn = document.getElementById('renameName');
      if (rn && !rn.value) rn.value = r.name || '';
    }

    const ipBtn = document.getElementById('btnUpgradeIp');
    if (ipBtn) ipBtn.addEventListener('click', () => upgradeBusiness('ip', COSTS.regIp));
    const oooBtn = document.getElementById('btnUpgradeOoo');
    if (oooBtn) oooBtn.addEventListener('click', () => upgradeBusiness('ooo', COSTS.regOoo + COSTS.regOooCapital));
  } else {
    const renameForm = document.getElementById('renameForm');
    if (renameForm) renameForm.style.display = 'none';
    typesBox.style.display = '';
    formBox.style.display = document.querySelector('input[name="regType"]:checked') ? 'block' : 'none';
    status.textContent = CS.t ? CS.t('stats.unregistered') : '';
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
    none: CS.t ? CS.t('stats.risk_none') : '',
    self: capWarned
      ? (CS.t ? CS.t('stats.risk_self_over') : '') : (CS.t ? CS.t('stats.risk_self_ok') : ''),
    ip: CS.t ? CS.t('stats.risk_ip') : '',
    ooo: CS.t ? CS.t('stats.risk_ooo') : ''
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
  const p = onec.period || {};
  box.innerHTML = `
    <div style="margin-bottom:6px;font-weight:bold;">Диагностика: ${ready}/${items.length}</div>
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
  const remain = Math.max(0, due - paid);

  const repPeriod = document.getElementById('repPeriod');
  if (repPeriod) repPeriod.textContent = String(p.id || 1);
  document.getElementById('repIncome').textContent = Math.floor(income) + '💰';
  document.getElementById('repRate').textContent = (rate * 100).toFixed(0) + '%';
  document.getElementById('repTax').textContent = due + '💰';
  document.getElementById('repPaid').textContent = paid + '💰';
  document.getElementById('repRemain').textContent = remain + '💰';

  const workplace = isWorkplaceReady(onec);
  const btnDiag = document.getElementById('btnDiagnose');
  const btnForm = document.getElementById('btnFormReport');
  const btnPay = document.getElementById('btnPayTax');
  const btnSub = document.getElementById('btnSubmitReport');
  if (btnDiag) btnDiag.disabled = !workplace || !!p.diagnosed;
  if (btnForm) btnForm.disabled = !workplace || !p.diagnosed || !!p.declared;
  if (btnPay) btnPay.disabled = !p.declared || !!p.taxPaid || remain <= 0;
  if (btnSub) btnSub.disabled = !isReadyToSubmit(onec);
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
  const ok = await spend(price, 'Подписка/лицензия: ' + key);
  if (!ok) return;
  state = await CS.loadState();
  const onec = ensureOnec(state);
  const tick = state._acctTick || 0;
  onec[key] = true;
  if (key === 'itsPaid') {
    onec.itsUntilTick = tick + COSTS.itsDays;
    onec.updated = true;
  }
  if (key === 'reportingPaid') {
    onec.reportingUntilTick = tick + COSTS.reportingDays;
  }
  if (typeof CS.recordExpense === 'function') CS.recordExpense(state, 'purchase', price);
  await CS.saveState(state);
  log('setupLog', `Оплачено (${price}💰). ${key === 'licensePaid' ? 'Лицензия активна.' : 'Подписка продлена.'}`, 'ok');
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
  log('setupLog', 'Развёртывание кабинета учёта…', 'info');
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
    log('setupLog', 'ОШИБКА: нужна активная подписка на обновления.', 'err');
    alert('Для обновлений продлите подписку во вкладке «Рабочее место».');
    return;
  }
  const ok = await spend(COSTS.update, 'Обновление кабинета до ' + onec.targetVersion);
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
    log('setupLog', 'ОШИБКА: патчи доступны только при активной подписке на обновления.', 'err');
    return;
  }
  const ok = await spend(COSTS.patch, 'Установка патча безопасности');
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
  const ok = await spend(COSTS.directories, 'Обновление справочников ФНС');
  if (!ok) return;
  log('setupLog', 'Загрузка классификаторов ОКВЭД, КБК, адресов…', 'info');
  await delay(700);
  state = await CS.loadState();
  const o = ensureOnec(state);
  o.directoriesLoaded = true;
  o.dirsUntilTick = (state._acctTick || 0) + COSTS.dirsDays;
  await CS.saveState(state);
  log('setupLog', 'Справочники обновлены (со временем устареют — обновляйте снова).', 'ok');
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

const btnDiagnose = document.getElementById('btnDiagnose');
if (btnDiagnose) {
  btnDiagnose.addEventListener('click', async () => {
    state = await CS.loadState();
    const onec = ensureOnec(state);
    if (!isWorkplaceReady(onec)) {
      log('reportLog', 'Диагностика: рабочее место не готово (смотрите чеклист).', 'err');
      return;
    }
    log('reportLog', 'Диагностика: проверка подписок, ЭЦП, регистрации…', 'info');
    await delay(400);
    onec.period = onec.period || {};
    onec.period.diagnosed = true;
    await CS.saveState(state);
    log('reportLog', 'Диагностика OK. Можно формировать декларацию.', 'ok');
    renderAll();
  });
}

document.getElementById('btnFormReport').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  if (!onec.period || !onec.period.diagnosed) {
    log('reportLog', 'Сначала пройдите диагностику (шаг 1).', 'err');
    return;
  }
  if (!isWorkplaceReady(onec)) {
    log('reportLog', 'Рабочее место не готово.', 'err');
    return;
  }
  log('reportLog', 'Формирование декларации (УСН / НПД / прибыль)…', 'info');
  await delay(500);
  onec.period.declared = true;
  await CS.saveState(state);
  log('reportLog', 'Декларация сформирована. Далее — уплата налога (шаг 3).', 'ok');
  renderAll();
});

document.getElementById('btnPayTax').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  if (!onec.period || !onec.period.declared) {
    log('reportLog', 'Сначала сформируйте декларацию (шаг 2).', 'err');
    return;
  }
  const income = getTaxableIncome();
  const rate = getTaxRate(onec);
  const due = Math.floor(income * rate);
  const paid = onec.taxes.totalPaid || 0;
  const remain = due - paid;
  if (remain <= 0) {
    onec.period.taxPaid = true;
    await CS.saveState(state);
    log('reportLog', 'Задолженности нет — шаг 3 отмечен.', 'ok');
    renderAll();
    return;
  }
  const ok = await spend(remain, 'Уплата налога');
  if (!ok) return;
  state = await CS.loadState();
  const o = ensureOnec(state);
  o.taxes.totalPaid = due;
  o.period.taxPaid = true;
  if (typeof CS.recordExpense === 'function') CS.recordExpense(state, 'tax', remain);
  await CS.saveState(state);
  log('reportLog', `Налог уплачен: ${remain}💰. Можно отправлять (шаг 4).`, 'ok');
  renderAll();
});

document.getElementById('btnSubmitReport').addEventListener('click', async () => {
  state = await CS.loadState();
  const onec = ensureOnec(state);
  if (!isReadyToSubmit(onec)) {
    alert('Порядок: диагностика → декларация → налог → отправка.\nСмотрите чеклист готовности.');
    return;
  }

  log('reportLog', 'Подписание пакета ЭЦП…', 'info');
  await delay(700);
  log('reportLog', 'Отправка в приёмник ФНС…', 'info');
  await delay(800);

  state = await CS.loadState();
  const o = ensureOnec(state);
  o.reportsSubmitted += 1;
  o.lastReportAt = Date.now();
  o.period.submitted = true;
  const bonus = 25 + Math.min(50, o.reportsSubmitted * 5);
  state.cash += bonus;
  if (typeof CS.recordIncome === 'function') CS.recordIncome(state, 'other', bonus);
  if (!state.stats.transactions) state.stats.transactions = [];
  state.stats.transactions.push({ type: 'tax_bonus', amount: -bonus, date: Date.now(), description: 'Бонус за сдачу' });
  await CS.saveState(state);

  log('reportLog', `Отчёт принят. Протокол №${1000 + o.reportsSubmitted}. Бонус +${bonus}💰. Для следующей сдачи — «Новый период».`, 'ok');
  alert(`✅ Отчётность сдана!\nПротокол №${1000 + o.reportsSubmitted}\nБонус: +${bonus}💰`);
  renderAll();
});

const btnNewPeriod = document.getElementById('btnNewPeriod');
if (btnNewPeriod) {
  btnNewPeriod.addEventListener('click', async () => {
    state = await CS.loadState();
    CS.startNewTaxPeriod(state);
    await CS.saveState(state);
    log('reportLog', 'Открыт новый налоговый период. Снова: диагностика → …', 'info');
    renderAll();
  });
}

const btnRename = document.getElementById('btnRename');
if (btnRename) {
  btnRename.addEventListener('click', async () => {
    state = await CS.loadState();
    const name = (document.getElementById('renameName') || {}).value || '';
    const r = CS.renameBusiness(state, name);
    if (!r.success) {
      alert(r.reason === 'cash' ? `Нужно ${r.cost}💰` : 'Не удалось сменить название');
      return;
    }
    await CS.saveState(state);
    alert('Наименование обновлено: ' + r.name);
    renderAll();
  });
}

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
  const L = typeof CS.ensureLedger === 'function' ? CS.ensureLedger(state) : null;
  let income = 0;
  let expenses = 0;
  if (L) {
    income = Object.keys(L.income).reduce((s, k) => s + (L.income[k] || 0), 0);
    expenses = Object.keys(L.expense).reduce((s, k) => s + (L.expense[k] || 0), 0);
  } else {
    income = getIncomeForPeriod(state, selectedPeriod);
    expenses = getExpensesForPeriod(state, selectedPeriod);
  }
  // fallback: если книга пуста, показать lifetime
  if (income <= 0 && state.lifetime && state.lifetime.cashEarned) {
    income = state.lifetime.cashEarned;
  }
  document.getElementById('statsBalance').textContent = Math.floor(state.cash);
  document.getElementById('statsIncome').textContent = Math.floor(income);
  document.getElementById('statsExpenses').textContent = Math.floor(expenses);
  document.getElementById('statsProfit').textContent = Math.floor(income - expenses);

  const onec = ensureOnec(state);
  document.getElementById('reportsCount').textContent = onec.reportsSubmitted;
  document.getElementById('lastReportDate').textContent = onec.lastReportAt
    ? new Date(onec.lastReportAt).toLocaleString('ru')
    : '—';

  const br = document.getElementById('statsBreakdown');
  if (br && L) {
    const incLabels = {
      click: 'Клики / работа',
      freelance: 'Биржа заказов',
      property: 'Недвижимость',
      intern: 'Стажёры / штат',
      casino: 'Казино',
      other: 'Прочее'
    };
    const expLabels = {
      rent: 'Аренда',
      tax: 'Налоги',
      penalty: 'Штрафы',
      purchase: 'Покупки / подписки',
      debt: 'Долг / проценты',
      other: 'Прочее'
    };
    const lines = (obj, labels) =>
      Object.keys(labels).map(k => {
        const v = Math.floor(obj[k] || 0);
        if (v <= 0) return '';
        return `<div>${labels[k]}: <b>${v}💰</b></div>`;
      }).join('');
    br.innerHTML =
      '<div style="font-weight:bold;margin-bottom:4px;">Доходы по источникам</div>' +
      (lines(L.income, incLabels) || '<div class="hint">Пока нет размеченных поступлений — играйте дальше, книга начнёт заполняться.</div>') +
      '<div style="font-weight:bold;margin:10px 0 4px;">Расходы по статьям</div>' +
      (lines(L.expense, expLabels) || '<div class="hint">Расходов в книге ещё нет.</div>');
  }
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
    ctx.fillText((CS.t ? CS.t('m.8839479f0a') : 'Недостаточно данных'), canvas.width / 2, canvas.height / 2);
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