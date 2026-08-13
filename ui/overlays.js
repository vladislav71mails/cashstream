// ============================================================================
// Оверлеи: обучение, случайные события, окно достижений и тосты.
// ============================================================================

function renderAchievementsWindow() {
  const list = document.getElementById('achList');
  const countEl = document.getElementById('achCount');
  if (!list || !state) return;
  const items = CS.achievementProgressList(state);
  const unlockedN = items.filter((i) => i.unlocked).length;
  if (countEl) countEl.textContent = unlockedN + ' / ' + items.length;
  list.innerHTML = items.map((a) => {
    const cls = a.unlocked ? 'ach-item unlocked' : 'ach-item locked';
    let prog = '';
    if (!a.unlocked && a.progress) {
      const pct = Math.min(100, Math.round((a.progress.current / Math.max(1, a.progress.need)) * 100));
      prog = `<div class="ach-progress bevel-in"><i style="width:${pct}%"></i><span>${Math.min(a.progress.current, a.progress.need)} / ${a.progress.need}</span></div>`;
    }
    const rewardParts = [];
    if (a.reward.cash) rewardParts.push('+' + a.reward.cash + '💰');
    if (a.reward.focus) rewardParts.push('+' + a.reward.focus + '⭐');
    const rewardStr = rewardParts.length ? `<span class="ach-reward">${rewardParts.join(' ')}</span>` : '';
    return `<div class="${cls}" data-id="${a.id}">
      <span class="ach-icon">${a.icon}</span>
      <div class="ach-meta">
        <div class="ach-title">${a.title}${a.unlocked ? ' ✓' : ''}</div>
        <div class="ach-desc">${a.desc}</div>
        ${prog}
      </div>
      ${rewardStr}
    </div>`;
  }).join('');
}

function flushAchievementToasts() {
  // Совместимость: перенос со старого state._achievementQueue в runtime-очередь
  if (state && state._achievementQueue && state._achievementQueue.length) {
    if (!CS._achToastQueue) CS._achToastQueue = [];
    if (!CS._achToastShown) CS._achToastShown = {};
    while (state._achievementQueue.length) {
      const item = state._achievementQueue.shift();
      if (!item || !item.id || CS._achToastShown[item.id]) continue;
      CS._achToastShown[item.id] = Date.now();
      CS._achToastQueue.push(item);
    }
  }
  const queue = CS._achToastQueue;
  if (!queue || !queue.length) return;
  const stack = document.getElementById('achToastStack');
  if (!stack) return;

  // Не спамим: по одному тосту, остальные с задержкой
  if (flushAchievementToasts._busy) return;
  flushAchievementToasts._busy = true;

  const item = queue.shift();
  if (!item) {
    flushAchievementToasts._busy = false;
    return;
  }
  // Уже висит такой же тост в DOM
  if (stack.querySelector('[data-ach-id="' + item.id + '"]')) {
    flushAchievementToasts._busy = false;
    if (queue.length) setTimeout(flushAchievementToasts, 200);
    return;
  }

  if (CS.Audio) CS.Audio.play(state, 'achievement');
  const el = document.createElement('div');
  el.className = 'ach-toast bevel-out';
  el.setAttribute('data-ach-id', item.id || '');
  const rewardParts = [];
  if (item.reward && item.reward.cash) rewardParts.push('+' + item.reward.cash + '💰');
  if (item.reward && item.reward.focus) rewardParts.push('+' + item.reward.focus + '⭐');
  el.innerHTML = `<span class="ach-toast-icon">${item.icon || '🏆'}</span>
    <div><strong>Достижение!</strong><br>${escapeToast(item.title)}
    ${rewardParts.length ? '<br><span class="ach-toast-reward">' + rewardParts.join(' ') + '</span>' : ''}</div>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade');
    setTimeout(() => el.remove(), 400);
  }, 4200);

  setTimeout(() => {
    flushAchievementToasts._busy = false;
    if (CS._achToastQueue && CS._achToastQueue.length) flushAchievementToasts();
  }, 700);
}

// ============================================================================
// Обучение
// ============================================================================

function setupTutorialUI() {
  const nextBtn = document.getElementById('tutorialNextBtn');
  const backBtn = document.getElementById('tutorialBackBtn');
  const skipBtn = document.getElementById('tutorialSkipBtn');
  const skipTitle = document.getElementById('tutorialSkipTitle');
  if (nextBtn) nextBtn.addEventListener('click', onTutorialNext);
  if (backBtn) backBtn.addEventListener('click', onTutorialBack);
  if (skipBtn) skipBtn.addEventListener('click', onTutorialSkip);
  if (skipTitle) skipTitle.addEventListener('click', onTutorialSkip);
}

function showTutorial() {
  const overlay = document.getElementById('tutorialOverlay');
  if (!overlay || !state || state.tutorialDone) return;
  const step = CS.currentTutorialStep(state);
  if (!step) {
    overlay.hidden = true;
    return;
  }
  if (CS.syncLangFromState) CS.syncLangFromState(state);

  const total = CS.TUTORIAL_STEPS.length;
  const idx = (state.tutorialStep || 0) + 1;
  const stepNum = document.getElementById('tutorialStepNum');
  if (stepNum) stepNum.textContent = CS.t('tut.step', { n: idx, total: total });

  const title = step.titleKey ? CS.t(step.titleKey) : (step.title || '');
  const body = step.bodyKey ? CS.t(step.bodyKey) : (step.body || '');
  document.getElementById('tutorialTitle').textContent = title;
  document.getElementById('tutorialText').textContent = body;

  const nextBtn = document.getElementById('tutorialNextBtn');
  if (nextBtn) nextBtn.textContent = idx >= total ? CS.t('tut.done') : CS.t('tut.next');
  const backBtn = document.getElementById('tutorialBackBtn');
  if (backBtn) {
    backBtn.textContent = CS.t('tut.back');
    backBtn.disabled = (state.tutorialStep || 0) <= 0;
    backBtn.hidden = false;
  }
  const skipBtn = document.getElementById('tutorialSkipBtn');
  if (skipBtn) skipBtn.textContent = CS.t('tut.skip');
  const skipTitle = document.getElementById('tutorialSkipTitle');
  if (skipTitle) skipTitle.title = CS.t('tut.skip');

  // Выбор языка — на каждом шаге обучения
  const langRow = document.getElementById('tutorialLangRow');
  const langSel = document.getElementById('tutorialLang');
  if (langRow) langRow.hidden = false;
  if (langSel) {
    langSel.value = CS.getLangPreference ? CS.getLangPreference(state) : CS.getLang();
    if (!langSel._bound) {
      langSel._bound = true;
      langSel.addEventListener('change', () => {
        CS.setLangAsync(langSel.value, state).then(function () {
          CS.saveState(state);
          if (CS.applyI18n) CS.applyI18n(document);
          showTutorial();
        });
      });
    }
  }
  const langLabel = document.getElementById('tutorialLangLabel');
  if (langLabel) langLabel.textContent = CS.t('tut.lang');

  const authBox = document.getElementById('tutorialAuth');
  if (authBox) {
    const show = !!step.showAuth;
    authBox.hidden = !show;
    if (show) {
      refreshTutorialAuthUI();
      bindTutorialAuthOnce();
    }
  }

  overlay.hidden = false;
}

function setTutCloudMsg(text, isError) {
  const el = document.getElementById('tutCloudMsg');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? '#7a1c1c' : '';
}

function refreshTutorialAuthUI() {
  const logged = document.getElementById('tutCloudLogged');
  const msg = document.getElementById('tutCloudMsg');
  if (!CS.Cloud) return;
  if (CS.Cloud.isLoggedIn()) {
    if (logged) {
      logged.hidden = false;
      logged.textContent = CS.t('tut.logged', { email: CS.Cloud.currentEmail() || '—' });
    }
    if (msg) msg.textContent = '';
  } else if (logged) {
    logged.hidden = true;
  }
}

let _tutAuthBound = false;
function bindTutorialAuthOnce() {
  if (_tutAuthBound) return;
  _tutAuthBound = true;

  const login = document.getElementById('tutCloudLogin');
  const reg = document.getElementById('tutCloudRegister');
  const google = document.getElementById('tutCloudGoogle');

  async function afterTutAuth() {
    refreshTutorialAuthUI();
    if (typeof afterCloudAuth === 'function') {
      await afterCloudAuth();
    } else if (CS.Cloud && CS.Cloud.isLoggedIn() && state) {
      await CS.Cloud.syncAfterLogin(state);
      CS.saveState(state);
    }
    setTutCloudMsg(CS.t('tut.auth_ok'));
  }

  if (login) {
    login.addEventListener('click', async () => {
      const email = (document.getElementById('tutCloudEmail') || {}).value || '';
      const pass = (document.getElementById('tutCloudPass') || {}).value || '';
      setTutCloudMsg('Вход…');
      const r = await CS.Cloud.signIn(email.trim(), pass);
      if (!r.success) { setTutCloudMsg(r.error || 'Ошибка', true); return; }
      await afterTutAuth();
    });
  }
  if (reg) {
    reg.addEventListener('click', async () => {
      const email = (document.getElementById('tutCloudEmail') || {}).value || '';
      const pass = (document.getElementById('tutCloudPass') || {}).value || '';
      if (pass.length < 6) { setTutCloudMsg('Пароль не короче 6 символов', true); return; }
      setTutCloudMsg('Регистрация…');
      const r = await CS.Cloud.signUp(email.trim(), pass);
      if (!r.success) { setTutCloudMsg(r.error || 'Ошибка', true); return; }
      if (r.needsConfirm) { setTutCloudMsg(r.message || 'Проверьте почту'); return; }
      await afterTutAuth();
    });
  }
  if (google) {
    google.addEventListener('click', async () => {
      setTutCloudMsg('Окно Google…');
      const r = await CS.Cloud.signInWithGoogle();
      if (!r.success) { setTutCloudMsg(r.error || 'Ошибка Google', true); return; }
      await afterTutAuth();
    });
  }
}

function onTutorialNext() {
  if (!state) return;
  const result = CS.advanceTutorial(state);
  CS.saveState(state);
  if (result.done) {
    document.getElementById('tutorialOverlay').hidden = true;
    flushAchievementToasts();
    renderPanel();
  } else {
    showTutorial();
  }
}

function onTutorialBack() {
  if (!state) return;
  CS.backTutorial(state);
  CS.saveState(state);
  showTutorial();
}

function onTutorialSkip() {
  if (!state) return;
  CS.skipTutorial(state);
  CS.saveState(state);
  document.getElementById('tutorialOverlay').hidden = true;
  flushAchievementToasts();
  renderPanel();
}

// ============================================================================
// Случайные события — модальный выбор реакции
// ============================================================================

function syncEventOverlay() {
  const overlay = document.getElementById('eventOverlay');
  if (!overlay || !state) return;

  const tut = document.getElementById('tutorialOverlay');
  if (tut && !tut.hidden) {
    overlay.hidden = true;
    return;
  }

  const ev = state.activeEvent;
  if (!ev) {
    overlay.hidden = true;
    return;
  }

  if (!overlay.hidden && overlay.dataset.eventId === ev.id) return;

  overlay.dataset.eventId = ev.id;
  const isLucky = ev.kind === 'lucky';
  if (CS.Audio) CS.Audio.play(state, isLucky ? 'event_lucky' : 'event');
  document.getElementById('eventWinTitle').textContent = (ev.icon || '⚡') + ' ' + (isLucky ? (CS.t ? CS.t('ev.lucky_exe') : 'Luck.exe') : (CS.t ? CS.t('ev.crisis_exe') : 'Crisis.exe'));
  document.getElementById('eventKind').textContent = isLucky ? (CS.t ? CS.t('ev.kind_lucky') : '') : (CS.t ? CS.t('ev.kind_crisis') : '');
  document.getElementById('eventKind').className = 'event-kind ' + (isLucky ? 'lucky' : 'crisis');
  document.getElementById('eventIcon').textContent = ev.icon || '⚡';
  document.getElementById('eventTitle').textContent = CS.eventTitle ? CS.eventTitle(ev) : (ev.title || '');
  document.getElementById('eventText').textContent = CS.eventBody ? CS.eventBody(ev) : (ev.body || '');
  document.getElementById('eventHint').textContent = '';

  const box = document.getElementById('eventChoices');
  box.innerHTML = '';
  (ev.choices || []).forEach((ch) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'win95-btn bevel-out event-choice-btn';
    const need = ch.requiresCash || 0;
    const can = need <= 0 || state.cash >= need;
    let label = CS.choiceLabel ? CS.choiceLabel(ev.id, ch) : ch.label;
    if (ch.costLabel) label += ' (' + ch.costLabel + ')';
    btn.textContent = label;
    if (!can) {
      btn.disabled = true;
      btn.title = CS.t ? CS.t('ev.need_cash', { n: need, have: Math.floor(state.cash) }) : (need + '💰');
      btn.classList.add('disabled');
    }
    btn.addEventListener('click', () => onEventChoice(ch.id));
    box.appendChild(btn);
  });

  overlay.hidden = false;
}

function onEventChoice(choiceId) {
  if (!state || !state.activeEvent) return;
  const result = CS.resolveEventChoice(state, choiceId);
  if (!result.success) {
    const hint = document.getElementById('eventHint');
    if (result.reason === 'cash') {
      hint.textContent = CS.t ? CS.t('ev.not_enough', { n: result.need }) : ('need ' + result.need);
    }
    syncEventOverlay();
    document.getElementById('eventOverlay').dataset.eventId = '';
    syncEventOverlay();
    return;
  }
  CS.saveState(state);
  document.getElementById('eventOverlay').hidden = true;
  document.getElementById('eventOverlay').dataset.eventId = '';
  renderAll(false);
  flushAchievementToasts();
  if (result.resultText) {
    const stack = document.getElementById('achToastStack');
    if (stack) {
      const el = document.createElement('div');
      el.className = 'ach-toast bevel-out event-result-toast';
      el.innerHTML = `<span class="ach-toast-icon">${result.icon || '⚡'}</span>
        <div><strong>${escapeToast(result.title || (CS.t ? CS.t('ev.event') : 'Event'))}</strong><br>${escapeToast(result.resultText)}</div>`;
      stack.appendChild(el);
      setTimeout(() => {
        el.classList.add('fade');
        setTimeout(() => el.remove(), 400);
      }, 4500);
    }
  }
}
