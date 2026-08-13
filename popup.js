// ============================================================================
// Popup — мини-ПК: снимок рабочего стола + лаунчер. Экономика не тикается.
// Авторизация — диалог «Сетевой вход» (иконка ☁ в трее).
// ============================================================================

let state = null;

/** Иконки мини-стола: id → open hash / app, glyph, label */
const MINI_APPS = [
  { id: 'quests',  glyph: '📋', labelKey: 'popup.icon.quests',  open: 'quests' },
  { id: 'work',    glyph: '💼', labelKey: 'popup.icon.work',    open: 'work' },
  { id: 'invest',  glyph: '📈', labelKey: 'popup.icon.invest',  open: 'invest' },
  { id: 'bank',    glyph: '🏦', labelKey: 'popup.icon.bank',    open: 'bank' },
  { id: 'mail',    glyph: '✉',  labelKey: 'popup.icon.mail',    open: 'mail' },
  { id: 'casino',  glyph: '🎰', labelKey: 'popup.icon.casino',  open: 'casino' },
  { id: 'browser', glyph: '🌐', labelKey: 'popup.icon.browser', open: 'browser' }
];

async function init() {
  try {
    state = await CS.loadState();
    if (CS.Cloud && CS.Cloud.loadSession) await CS.Cloud.loadSession();
    if (CS.bootI18n) await CS.bootI18n(state);
    else if (CS.syncLangFromState) CS.syncLangFromState(state);
    buildIcons();
    if (CS.applyI18n) CS.applyI18n(document);
    render();
    setInterval(refreshFromStorage, 1500);
    setInterval(updateClock, 1000);
    updateClock();

    CS.onStateChanged((newState) => {
      state = newState;
      render();
    });

    document.getElementById('openFullMini').addEventListener('click', () => openFullPage());
    setupPopupCloudUI();
    setupPopupLangUI();
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function buildIcons() {
  const root = document.getElementById('miniIcons');
  if (!root) return;
  root.innerHTML = '';
  MINI_APPS.forEach((app) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-icon';
    btn.dataset.open = app.open || '';
    const label = (CS.t && app.labelKey) ? CS.t(app.labelKey) : (app.label || app.id);
    btn.title = label;
    btn.innerHTML = '<span class="glyph">' + app.glyph + '</span><span class="label">' + label + '</span>';
    btn.addEventListener('click', () => {
      root.querySelectorAll('.mini-icon').forEach((el) => el.classList.remove('selected'));
      btn.classList.add('selected');
      openFullPage(app.open || null);
    });
    root.appendChild(btn);
  });
}

async function refreshFromStorage() {
  try {
    const s = await CS.loadState();
    if (s) {
      state = s;
      render();
    }
  } catch (e) { /* ignore */ }
}

function setPopCloudMsg(text, isError) {
  const el = document.getElementById('popCloudMsg');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? '#7a1c1c' : '';
}

function renderCloudTray() {
  const btn = document.getElementById('cloudBarBtn');
  const icon = document.getElementById('cloudBarIcon');
  const label = document.getElementById('cloudTrayLabel');
  if (!btn || !icon) return;
  if (CS.Cloud && CS.Cloud.isLoggedIn()) {
    icon.textContent = '☁';
    btn.classList.add('logged');
    if (label) label.textContent = CS.t ? CS.t('popup.net.online') : 'Онлайн';
    btn.title = '☁ ' + (CS.Cloud.currentEmail() || '');
  } else {
    icon.textContent = '☁';
    btn.classList.remove('logged');
    if (label) label.textContent = CS.t ? CS.t('popup.net.network') : 'Сеть';
    btn.title = CS.t ? CS.t('popup.net.title') : 'Сетевой вход';
  }
}

function setupPopupCloudUI() {
  const barBtn = document.getElementById('cloudBarBtn');
  const panel = document.getElementById('cloudAuthPanel');
  const cancel = document.getElementById('popCloudCancel');
  const login = document.getElementById('popCloudLogin');
  const reg = document.getElementById('popCloudRegister');
  const google = document.getElementById('popCloudGoogle');
  const hint = document.getElementById('netDialogHint');

  function showLoggedPanel() {
    if (!panel) return;
    panel.hidden = false;
    if (hint) {
      hint.textContent = CS.t('popup.net.hint_user', { email: CS.Cloud.currentEmail() || '—' });
    }
    // Переключаем кнопки: вместо Войти — Сохранить
    if (login) login.textContent = CS.t('popup.net.save');
    if (reg) reg.hidden = true;
    if (google) google.hidden = true;
  }

  function showGuestPanel() {
    if (!panel) return;
    panel.hidden = false;
    if (hint) {
      hint.textContent = CS.t('popup.net.hint_guest');
    }
    if (login) login.textContent = CS.t('popup.net.login');
    if (reg) reg.hidden = false;
    if (google) google.hidden = false;
  }

  if (barBtn) {
    barBtn.addEventListener('click', async () => {
      if (CS.Cloud && CS.Cloud.isLoggedIn()) {
        // Уже в сети: показать диалог с «Сохранить» или сразу пуш
        if (panel && !panel.hidden) {
          // повторный клик при открытой панели — пуш
          setPopCloudMsg(CS.t ? CS.t('cloud.saving') : '…');
          try {
            state = await CS.loadState();
            if (!state.cloudMeta) state.cloudMeta = {};
            state.cloudMeta.updatedAt = new Date().toISOString();
            CS.saveState(state);
            const push = await CS.Cloud.pushSave(state);
            setPopCloudMsg(push.success ? (CS.t ? CS.t('cloud.saved') : 'OK') : (push.error || (CS.t ? CS.t('cloud.error') : 'err')), !push.success);
            if (push.success) setTimeout(() => { if (panel) panel.hidden = true; }, 1200);
          } catch (e) {
            setPopCloudMsg(e.message || String(e), true);
          }
          renderCloudTray();
          return;
        }
        showLoggedPanel();
        setPopCloudMsg('');
        return;
      }
      // Гость: toggle диалога входа
      if (panel) {
        if (panel.hidden) showGuestPanel();
        else panel.hidden = true;
      }
      setPopCloudMsg('');
    });
  }

  if (cancel) {
    cancel.addEventListener('click', () => {
      if (panel) panel.hidden = true;
      setPopCloudMsg('');
    });
  }

  async function afterPopAuth() {
    renderCloudTray();
    setPopCloudMsg(CS.t ? CS.t('cloud.login_ok') : '…');
    try {
      state = await CS.loadState();
      const result = await CS.Cloud.syncAfterLogin(state);
      if (result.action === 'pulled_cloud' && result.state) {
        state = result.state;
        CS.saveState(state);
        setPopCloudMsg(CS.t ? CS.t('cloud.pulled') : 'OK');
      } else {
        if (!state.cloudMeta) state.cloudMeta = {};
        state.cloudMeta.updatedAt = new Date().toISOString();
        CS.saveState(state);
        setPopCloudMsg(CS.t ? CS.t('cloud.in_cloud') : 'OK');
      }
      render();
      showLoggedPanel();
      setTimeout(() => { if (panel) panel.hidden = true; }, 1400);
    } catch (e) {
      setPopCloudMsg(e.message || String(e), true);
    }
  }

  if (login) {
    login.addEventListener('click', async () => {
      // Если уже залогинен — это кнопка «Сохранить»
      if (CS.Cloud && CS.Cloud.isLoggedIn() && login.textContent === 'Сохранить') {
        setPopCloudMsg(CS.t ? CS.t('cloud.saving') : '…');
        try {
          state = await CS.loadState();
          if (!state.cloudMeta) state.cloudMeta = {};
          state.cloudMeta.updatedAt = new Date().toISOString();
          CS.saveState(state);
          const push = await CS.Cloud.pushSave(state);
          setPopCloudMsg(push.success ? (CS.t ? CS.t('cloud.saved') : 'OK') : (push.error || (CS.t ? CS.t('cloud.error') : 'err')), !push.success);
          if (push.success) setTimeout(() => { if (panel) panel.hidden = true; }, 1200);
        } catch (e) {
          setPopCloudMsg(e.message || String(e), true);
        }
        return;
      }
      const email = (document.getElementById('popCloudEmail') || {}).value || '';
      const pass = (document.getElementById('popCloudPass') || {}).value || '';
      setPopCloudMsg('Вход…');
      const r = await CS.Cloud.signIn(email.trim(), pass);
      if (!r.success) { setPopCloudMsg(r.error || 'Ошибка', true); return; }
      await afterPopAuth();
    });
  }
  if (reg) {
    reg.addEventListener('click', async () => {
      const email = (document.getElementById('popCloudEmail') || {}).value || '';
      const pass = (document.getElementById('popCloudPass') || {}).value || '';
      if (pass.length < 6) { setPopCloudMsg('Пароль ≥ 6', true); return; }
      setPopCloudMsg('Регистрация…');
      const r = await CS.Cloud.signUp(email.trim(), pass);
      if (!r.success) { setPopCloudMsg(r.error || 'Ошибка', true); return; }
      if (r.needsConfirm) { setPopCloudMsg(r.message || 'Проверьте почту'); return; }
      await afterPopAuth();
    });
  }
  if (google) {
    google.addEventListener('click', async () => {
      setPopCloudMsg('Google…');
      const r = await CS.Cloud.signInWithGoogle();
      if (!r.success) { setPopCloudMsg(r.error || 'Ошибка', true); return; }
      await afterPopAuth();
    });
  }
}

function updateClock() {
  const d = new Date();
  const el = document.getElementById('clock');
  if (el) {
    el.textContent =
      d.getHours().toString().padStart(2, '0') + ':' +
      d.getMinutes().toString().padStart(2, '0');
  }
}

function openFullPage(appId) {
  let url = chrome.runtime.getURL('fullpage.html');
  if (appId === 'casino') url += '#casino';
  else if (appId === 'invest') url += '#invest';
  // Остальные — пустой стол; пользователь кликает значок
  chrome.tabs.create({ url });
}

function renderOrderLine() {
  const el = document.getElementById('orderLine');
  if (!el || !state) return;
  const f = state.freelance;
  const active = f && f.active;
  if (!active) {
    el.textContent = CS.t ? CS.t('popup.no_order') : 'Нет активного заказа · ⏸';
    return;
  }
  if (active.status === 'negotiating') {
    el.textContent = '💬 ' + (active.title || 'заказ') + ' · ' + (CS.t ? CS.t('popup.order.negotiating') : 'переговоры') + ' ⏸';
    return;
  }
  if (active.status === 'active') {
    const steps = active.steps || [];
    const idx = active.stepIndex || 0;
    const step = steps[idx];
    const left = active.deadlineLeft != null ? active.deadlineLeft + 'с' : '—';
    el.textContent = '📋 ' + (active.title || 'Заказ') +
      ' · ' + (idx + 1) + '/' + Math.max(1, steps.length) +
      ' · ⏱' + left + ' ⏸';
    return;
  }
  el.textContent = 'Заказ: ' + (active.title || '—') + ' ⏸';
}

function renderAlerts() {
  const box = document.getElementById('hudAlerts');
  if (!box || !state) return;
  const parts = [];
  if (state.debt > 0) {
    parts.push('<span class="hud-alert-debt">' + (CS.t ? CS.t('popup.debt', { n: Math.round(state.debt) }) : ('⚠ Долг ' + Math.round(state.debt))) + '</span>');
  }
  if (!state.economyActive) {
    parts.push('<span class="hud-alert-grace">' + (CS.t ? CS.t('popup.grace', { n: Math.max(0, state.graceTicksLeft || 0) }) : '') + '</span>');
  }
  const unread = typeof CS.unreadMailCount === 'function' ? CS.unreadMailCount(state) : 0;
  if (unread > 0) {
    parts.push('<span title="Непрочитанная почта">✉ ' + unread + '</span>');
  }
  box.innerHTML = parts.join(' ');
}

function render() {
  if (!state) return;
  renderCloudTray();
  const langLabel = document.getElementById('langTrayLabel');
  if (langLabel && CS.getLang) langLabel.textContent = CS.getLang().toUpperCase();

  document.getElementById('cashValue').textContent = Math.floor(state.cash);
  document.getElementById('levelValue').textContent = state.level;

  const focusPct = Math.round(state.focus);
  document.getElementById('focusFill').style.width = focusPct + '%';
  const burnoutPct = Math.round(state.burnout);
  document.getElementById('burnoutFill').style.width = burnoutPct + '%';

  renderOrderLine();
  renderAlerts();

  const tutorialPaused = typeof CS.isGamePaused === 'function' && CS.isGamePaused(state);
  const tray = document.getElementById('statusTray');
  if (tray) {
    tray.textContent = tutorialPaused ? '📚' : '⏸';
    tray.title = tutorialPaused
      ? (CS.t ? CS.t('popup.tray.tutorial') : '')
      : (CS.t ? CS.t('popup.tray.paused') : '');
  }
}


function setupPopupLangUI() {
  const btn = document.getElementById('langTrayBtn');
  const panel = document.getElementById('langPanel');
  const close = document.getElementById('langPanelClose');
  if (!btn || !panel) return;

  function refreshLangTray() {
    const label = document.getElementById('langTrayLabel');
    const effective = (CS.getLang && CS.getLang()) || 'en';
    const pref = (CS.getLangPreference && state) ? CS.getLangPreference(state) : effective;
    if (label) label.textContent = pref === 'auto' ? 'AUTO' : effective.toUpperCase();
    btn.title = CS.t ? CS.t('tut.lang') : 'Language';
    panel.querySelectorAll('.lang-choice').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-lang') === pref);
    });
  }

  btn.addEventListener('click', () => {
    const cloud = document.getElementById('cloudAuthPanel');
    if (cloud) cloud.hidden = true;
    panel.hidden = !panel.hidden;
    refreshLangTray();
  });
  if (close) close.addEventListener('click', () => { panel.hidden = true; });

  panel.querySelectorAll('.lang-choice').forEach((b) => {
    b.addEventListener('click', async () => {
      const code = b.getAttribute('data-lang');
      if (!state) state = await CS.loadState();
      CS.setLangAsync(code, state).then(function () {
        CS.saveState(state);
        panel.hidden = true;
        buildIcons();
        if (CS.applyI18n) CS.applyI18n(document);
        render();
        refreshLangTray();
      });
    });
  });
  refreshLangTray();
}


init();
