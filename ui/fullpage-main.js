// ============================================================================
// fullpage-main — точка входа UI: state, init, tick, renderAll / panel / quests
// Подключается последним после ui/*.js
// ============================================================================

let state = null;

// ============================================================================
// Инициализация игры
// ============================================================================
async function init() {
  try {
    document.addEventListener('pointerdown', () => { if (CS.Audio) CS.Audio.unlock(); }, { once: true });

    state = await CS.loadState();
    CS.ensureSettings(state);
    if (CS.bootI18n) await CS.bootI18n(state);
    else { if (CS.syncLangFromState) CS.syncLangFromState(state); if (CS.applyI18n) CS.applyI18n(document); }
    if (typeof initCloudOnBoot === 'function') await initCloudOnBoot();

    const prefs = CS.ensureSettings(state);
    const runBoot = prefs.bootAnim !== false;

    const afterBoot = () => {
      WM.initIcons();
      WM.autoOpenDefaults();
      syncInstalledAppIcons();
      syncMailBadge();
      setupStartMenu();

      const trayMail = document.getElementById('trayMail');
      if (trayMail) {
        trayMail.addEventListener('click', () => {
          if (CS.isAppInstalled(state, 'mail')) WM.open('mail');
        });
      }

      if (!CS.isAppInstalled(state, 'achievements')) {
        CS.installApp(state, 'achievements');
        CS.saveState(state);
        syncInstalledAppIcons();
      }

      renderAll(true);
      setInterval(tick, CS.CONFIG.TICK_MS);
      setInterval(updateClock, 1000);
      updateClock();
      // Тихий push в облако раз в ~2 мин, если залогинены
      setInterval(() => {
        if (CS.Cloud && CS.Cloud.isLoggedIn() && state) {
          if (!state.cloudMeta) state.cloudMeta = {};
          state.cloudMeta.updatedAt = new Date().toISOString();
          CS.Cloud.pushSave(state).catch(function () { /* ignore */ });
        }
      }, 120000);

      setupTutorialUI();
      if (!state.tutorialDone) {
        showTutorial();
      }

      setupBoostersUI();
      if (typeof CS.Ads !== 'undefined' && CS.Ads.init) CS.Ads.init();

      CS.onStateChanged((newState) => {
        state = newState;
        renderAll(false);
        syncInstalledAppIcons();
        processMailPush();
        syncMailBadge();
        flushAchievementToasts();
      });
    };

    if (runBoot) {
      runBootSequence().then(afterBoot);
    } else {
      const boot = document.getElementById('bootScreen');
      if (boot) boot.hidden = true;
      afterBoot();
    }
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function tick() {
  if (!state) return;
  // Полная пауза: обучение / вход — без тиканья аренды, дедлайнов, событий
  if (typeof CS.isGamePaused === 'function' && CS.isGamePaused(state)) {
    renderPanel();
    return;
  }
  CS.tick(state);
  CS.saveState(state);
  renderPanel();
  processMailPush();
  syncMailBadge();
  syncEventOverlay();
}

// ---------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------
function renderAll(forceWorkZone) {
  if (!state) return;
  renderPanel();
  renderQuestPanel();
  renderHistory();
  syncMailBadge();
  const key = `${state.chainId}-${state.stepIndex}-${CS.currentStep(state).type}`;
  if (forceWorkZone || key !== renderedStepKey) {
    renderedStepKey = key;
    renderWorkZone();
  } else {
    updateWorkZoneDynamic();
  }
}

function renderPanel() {
  document.getElementById('cashValue').textContent = Math.floor(state.cash);
  document.getElementById('levelValue').textContent = state.level;
  document.getElementById('xpValue').textContent = Math.floor(state.xp);
  document.getElementById('xpNeedValue').textContent = CS.xpToNextLevel(state.level);

  const focusPct = Math.round(state.focus);
  document.getElementById('focusFill').style.width = focusPct + '%';
  document.getElementById('focusLabel').textContent = focusPct;

  const burnoutPct = Math.round(state.burnout);
  document.getElementById('burnoutFill').style.width = burnoutPct + '%';
  document.getElementById('burnoutLabel').textContent = burnoutPct;

  const rentGaugeLabel = document.getElementById('rentGaugeLabel');
  const graceBadge = document.getElementById('graceBadge');
  if (!state.economyActive) {
    const left = Math.max(0, state.graceTicksLeft || 0);
    if (rentGaugeLabel) {
      rentGaugeLabel.innerHTML = (CS.t ? CS.t('panel.grace', { n: '<span id="rentCountdown">' + left + '</span>' }) : ('grace ' + left));
    } else {
      document.getElementById('rentCountdown').textContent = left;
    }
    document.getElementById('rentFill').style.width = Math.round((1 - left / Math.max(1, CS.CONFIG.GRACE_TICKS)) * 100) + '%';
    document.getElementById('rentLabel').textContent = CS.t ? CS.t('panel.no_rent') : '—';
    if (graceBadge) {
      graceBadge.hidden = false;
      document.getElementById('graceValue').textContent = left;
    }
  } else {
    const rentTicksLeft = CS.CONFIG.RENT_INTERVAL_TICKS - (state.rentTimer || 0);
    const rentPct = Math.round(((state.rentTimer || 0) / CS.CONFIG.RENT_INTERVAL_TICKS) * 100);
    if (rentGaugeLabel) {
      rentGaugeLabel.innerHTML = (CS.t ? CS.t('panel.rent_in', { n: '<span id="rentCountdown">' + Math.max(0, rentTicksLeft) + '</span>' }) : String(rentTicksLeft));
    } else {
      document.getElementById('rentCountdown').textContent = Math.max(0, rentTicksLeft);
    }
    document.getElementById('rentFill').style.width = rentPct + '%';
    document.getElementById('rentLabel').textContent = CS.currentRentAmount(state) + '💰';
    if (graceBadge) graceBadge.hidden = true;
  }

  const debtBadge = document.getElementById('debtBadge');
  if (state.debt > 0) {
    debtBadge.hidden = false;
    document.getElementById('debtValue').textContent = Math.round(state.debt);
  } else {
    debtBadge.hidden = true;
  }

  document.getElementById('comboValue').textContent = combo.toFixed(1);
  document.getElementById('todayCash').textContent = Math.floor(state.totalsToday.cash);
  document.getElementById('todayChains').textContent = state.totalsToday.chains;

  // Активные бустеры на панели
  const boosterBadge = document.getElementById('boosterBadge');
  if (boosterBadge && typeof CS.activeBoostersSummary === 'function') {
    const list = CS.activeBoostersSummary(state);
    if (list.length) {
      boosterBadge.hidden = false;
      const top = list.slice(0, 2).map((x) => x.icon + x.left + 'с').join(' · ');
      document.getElementById('boosterBadgeText').textContent = top;
    } else {
      boosterBadge.hidden = true;
    }
  }

  renderAchievementsWindow();
  renderBoostersWindow();
  flushAchievementToasts();
  syncEventOverlay();
}

function renderQuestPanel() {
  if (!state || typeof CS.ensureFreelance !== 'function') {
    // fallback: только инструкция в Работе
    const step = CS.currentStep(state);
    const workInstr = document.getElementById('workInstruction');
    if (workInstr && step) workInstr.textContent = step.text;
    return;
  }
  CS.ensureFreelance(state);
  CS.refreshOrderBoard(state, false);

  const titleEl = document.getElementById('questTitle');
  const rating = Math.round(state.freelance.rating || 50);
  if (titleEl) {
    titleEl.textContent = CS.t ? CS.t('fl.board_title', { n: rating }) : ('📋 ' + rating);
  }

  const board = document.getElementById('flBoardList');
  if (board) {
    board.innerHTML = '';
    state.freelance.board.forEach((o) => {
      const client = CS.getClient(o.clientId);
      o = CS.localizeOrder ? CS.localizeOrder(o) : o;
      const card = document.createElement('div');
      card.className = 'fl-card bevel-out';
      card.innerHTML =
        '<div class="fl-card-top">' + client.avatar + ' <strong>' + o.title + '</strong></div>' +
        '<div class="fl-card-client">' + client.name + ' · ' + (CS.clientRole ? CS.clientRole(client) : client.role) + '</div>' +
        '<div class="fl-card-brief">' + o.brief + '</div>' +
        '<div class="fl-card-meta">💰 ' + (o.offerReward || o.reward) + ' · ⏱ ' + o.deadlineTicks + 's · ' + o.steps.length + '</div>' +
        '<div class="fl-card-actions">' +
        '<button type="button" class="win95-btn bevel-out" data-fl-accept="' + o.uid + '">Написать</button> ' +
        '<button type="button" class="win95-btn bevel-out" data-fl-skip="' + o.uid + '">Скрыть</button>' +
        '</div>';
      board.appendChild(card);
    });
    if (!state.freelance.board.length) {
      board.innerHTML = '<div class="fl-empty">' + (CS.t ? CS.t('fl.empty_orders') : '…') + '</div>';
    }
  }

  const activePane = document.getElementById('flActivePane');
  if (activePane) {
    activePane.innerHTML = '';
    const a = state.freelance.active;
    if (!a) {
      activePane.innerHTML = '<div class="fl-empty">' + (CS.t ? CS.t('fl.empty_dialog') : '') + '</div>';
    } else {
      const client = CS.getClient(a.clientId);
      const negotiating = a.status === 'negotiating';
      const pct = a.deadlineMax ? Math.round((a.deadlineLeft / a.deadlineMax) * 100) : 0;
      let stepsHtml = '';
      if (!negotiating) {
        stepsHtml = a.steps.map((s, i) => {
          let cls = 'pending';
          if (i < a.stepIndex) cls = 'done';
          else if (i === a.stepIndex) cls = 'current';
          const mark = i < a.stepIndex ? '✓ ' : (i === a.stepIndex ? '► ' : '○ ');
          return '<div class="fl-step ' + cls + '">' + mark + s.text +
            (i === a.stepIndex ? ' (' + a.stepProgress + '/' + s.target + ')' : '') + '</div>';
        }).join('');
      }
      const phaseLabel = negotiating
        ? (CS.t ? CS.t('m.efc3ec3108') : '<div class="fl-card-meta" style="color:#6a4a12;">Фаза: переговоры — уточните ТЗ, срок, цену</div>')
        : '<div class="fl-deadline">Дедлайн: <strong>' + a.deadlineLeft + 'с</strong></div>' +
          '<div class="win95-gauge quest"><i style="width:' + pct + '%"></i><span class="gauge-label">' + a.deadlineLeft + 'с</span></div>' +
          '<div class="fl-steps">' + stepsHtml + '</div>' +
          (CS.t ? CS.t('m.8cf7068d56') : '<div class="fl-card-meta">Работа.exe · стажёры помогают на этапах</div>');
      activePane.innerHTML =
        '<div class="fl-card bevel-out fl-card-live">' +
        '<div class="fl-card-top">' + client.avatar + ' <strong>' + ((CS.localizeOrder ? CS.localizeOrder(a) : a).title) + '</strong></div>' +
        '<div class="fl-card-client">' + client.name + ' · ' + a.reward + '💰' +
        (negotiating ? ' (обсуждается)' : '') + '</div>' +
        '<div class="fl-card-brief">' + ((CS.localizeOrder ? CS.localizeOrder(a) : a).brief) + '</div>' +
        phaseLabel +
        '</div>';
    }
  }

  const doneList = document.getElementById('flDoneList');
  if (doneList) {
    doneList.innerHTML = '';
    (state.freelance.done || []).slice(0, 8).forEach((d) => {
      const client = CS.getClient(d.clientId);
      const el = document.createElement('div');
      el.className = 'fl-done-item' + (d.success ? '' : ' fail');
      el.textContent = (d.success ? '✓ ' : '✗ ') + d.title + ' · ' + (d.reward || 0) + '💰 · ' + d.time;
      el.title = client ? client.name : '';
      doneList.appendChild(el);
    });
    if (!(state.freelance.done || []).length) {
      doneList.innerHTML = '<div class="fl-empty">' + (CS.t ? CS.t('fl.empty_done') : '') + '</div>';
    }
  }

  renderFreelanceChat();
  bindFreelanceBoardOnce();

  const step = CS.currentStep(state);
  const workInstr = document.getElementById('workInstruction');
  if (workInstr && step) {
    const chain = CS.currentChain(state);
    workInstr.textContent = (chain && chain.freelance ? '📦 ' + chain.title + ' — ' : '') + step.text;
  }
}

function renderFreelanceChat() {
  const wrap = document.getElementById('flChatWrap');
  const log = document.getElementById('flChatLog');
  const replies = document.getElementById('flChatReplies');
  if (!wrap || !log) return;
  const a = state.freelance && state.freelance.active;
  if (!a) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const client = CS.getClient(a.clientId);
  const phase = a.status === 'negotiating' ? 'переговоры' : 'в работе';
  log.innerHTML =
    '<div class="fl-msg npc">Переписка с <strong>' + client.avatar + ' ' + client.name +
    '</strong> — в <strong>Почта.exe</strong> (' + phase + ').</div>' +
    '<div class="fl-msg npc">Не ищите десяток Re: — откройте письмо «Сделка: …» во входящих.</div>';
  if (replies) {
    replies.innerHTML = '';
    const openMail = document.createElement('button');
    openMail.type = 'button';
    openMail.className = 'win95-btn bevel-out fl-reply-btn';
    openMail.textContent = CS.t ? CS.t('fl.open_mail') : '✉️ Mail';
    openMail.addEventListener('click', () => {
      if (typeof WM !== 'undefined' && WM.open) WM.open('mail');
    });
    replies.appendChild(openMail);
  }
}

let _flBoardBound = false;
function bindFreelanceBoardOnce() {
  if (_flBoardBound) return;
  const root = document.getElementById('flBoardList');
  if (!root) return;
  _flBoardBound = true;
  document.addEventListener('click', (e) => {
    const acc = e.target.closest('[data-fl-accept]');
    if (acc) {
      const uid = acc.getAttribute('data-fl-accept');
      const r = CS.acceptOrder(state, uid);
      CS.saveState(state);
      renderQuestPanel();
      renderPanel();
      if (typeof renderWorkZone === 'function') {
        renderedStepKey = null;
        renderWorkZone();
      }
      if (r && r.success && typeof WM !== 'undefined' && WM.open) {
        WM.open('mail');
      }
      return;
    }
    const skip = e.target.closest('[data-fl-skip]');
    if (skip) {
      CS.declineOrder(state, skip.getAttribute('data-fl-skip'));
      CS.saveState(state);
      renderQuestPanel();
    }
  });
}

function renderHistory() {
  const log = document.getElementById('historyLog');
  if (!log) return;
  log.innerHTML = '';
  state.history.slice(0, 15).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item' + (item.type === 'casino' ? (item.win ? ' casino-win' : ' casino-loss') : ' ' + item.type);
    div.textContent = `[${item.time}] ${item.text}`;
    log.appendChild(div);
  });
}

// ============================================================================
// Бустеры: окно, реклама, панель
// ============================================================================
let boostersUiBound = false;

function setupBoostersUI() {
  if (boostersUiBound) return;
  boostersUiBound = true;

  const panelBtn = document.getElementById('panelBoostBtn');
  if (panelBtn) {
    panelBtn.addEventListener('click', () => {
      WM.open('boosters');
      renderBoostersWindow();
    });
  }

  // Табы и кнопки живут внутри template → появляются после первого WM.open.
  // Делегирование на document.
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-boost-tab]');
    if (tab) {
      const name = tab.getAttribute('data-boost-tab');
      document.querySelectorAll('.boost-tab').forEach((t) => t.classList.toggle('active', t === tab));
      const shop = document.getElementById('boostPanelShop');
      const cards = document.getElementById('boostPanelCards');
      const support = document.getElementById('boostPanelSupport');
      if (shop) shop.hidden = name !== 'shop';
      if (cards) cards.hidden = name !== 'cards';
      if (support) support.hidden = name !== 'support';
      return;
    }

    const buyBtn = e.target.closest('[data-buy-booster]');
    if (buyBtn) {
      onBuyBooster(buyBtn.getAttribute('data-buy-booster'));
      return;
    }

    const freeBtn = e.target.closest('[data-free-booster]');
    if (freeBtn) {
      onClaimFreeBooster(freeBtn.getAttribute('data-free-booster'));
      return;
    }

    const adBoosterBtn = e.target.closest('[data-ad-booster]');
    if (adBoosterBtn) {
      startAdWatch(adBoosterBtn.getAttribute('data-ad-booster'));
      return;
    }

    if (e.target.id === 'boostWatchAd' || e.target.closest('#boostWatchAd')) {
      // Без реальной монетизации — бесплатный случайный буст; с yandex — ролик
      if (typeof CS.adsMonetizationEnabled === 'function' && CS.adsMonetizationEnabled()) {
        startAdWatch(null);
      } else {
        onClaimFreeBooster(null);
      }
      return;
    }

    if (e.target.id === 'boostOpenShop' || e.target.closest('#boostOpenShop')) {
      openPremiumShop();
      return;
    }

    if (e.target.id === 'adSkipBtn') {
      finishAdWatch();
    }
  });
}

function renderBoostersWindow() {
  if (!state || typeof CS.ensureBoosters !== 'function') return;
  CS.ensureBoosters(state);

  const activeEl = document.getElementById('boostActiveList');
  if (activeEl) {
    const summary = CS.activeBoostersSummary(state);
    if (!summary.length) {
      activeEl.textContent = '';
    } else {
      activeEl.innerHTML = summary.map((s) =>
        `<span class="boost-active-item">${s.icon} ${s.name}: ${s.left}с</span>`
      ).join(' · ');
    }
  }

  const grid = document.getElementById('boostShopGrid');
  if (grid) {
    grid.innerHTML = '';
    const freeCd = state.boosters.adCooldown || 0;
    const adsOn = typeof CS.adsMonetizationEnabled === 'function' && CS.adsMonetizationEnabled();
    CS.BOOSTER_DEFS.forEach((def) => {
      const card = document.createElement('div');
      card.className = 'boost-card bevel-out';
      const cost = def.costCash || 0;
      const canBuy = state.cash >= cost;
      let freePart;
      if (freeCd > 0) {
        freePart = `<span class="store-badge">${CS.t ? CS.t('boost.via_cd', { n: freeCd }) : freeCd + 's'}</span>`;
      } else if (adsOn) {
        freePart = `<button type="button" class="win95-btn bevel-out" data-ad-booster="${def.id}">${CS.t ? CS.t('boost.ad_btn') : 'ad'}</button>`;
      } else {
        freePart = `<button type="button" class="win95-btn bevel-out" data-free-booster="${def.id}">${CS.t ? CS.t('boost.free_btn') : 'free'}</button>`;
      }
      const buyPart = `<button type="button" class="win95-btn bevel-out" data-buy-booster="${def.id}" ${canBuy ? '' : 'disabled'}>${cost}💰</button>`;
      const bName = CS.boostName ? CS.boostName(def) : def.name;
      const bHint = CS.boostHint ? CS.boostHint(def) : def.tagline;
      card.innerHTML = `
        <div class="bi">${def.icon}</div>
        <div>
          <div class="bn">${bName}</div>
          <div class="bt">${bHint}</div>
        </div>
        <div class="ba" style="display:flex;flex-direction:column;gap:4px;align-items:stretch;">${freePart}${buyPart}</div>`;
      grid.appendChild(card);
    });
  }

  const cdEl = document.getElementById('boostAdCd');
  const adBtn = document.getElementById('boostWatchAd');
  if (cdEl) {
    const left = state.boosters.adCooldown || 0;
    const adsOn = typeof CS.adsMonetizationEnabled === 'function' && CS.adsMonetizationEnabled();
    if (left > 0) {
      cdEl.textContent = CS.t ? CS.t('boost.cooldown', { n: left }) : ('CD ' + left);
      if (adBtn) adBtn.disabled = true;
    } else {
      cdEl.textContent = adsOn
        ? (CS.t ? CS.t('boost.ad_ready') : '')
        : (CS.t ? CS.t('boost.free_ready') : '');
      if (adBtn) adBtn.disabled = false;
    }
    if (adBtn) {
      adBtn.textContent = adsOn
        ? (CS.t ? CS.t('boost.ad_random') : '')
        : (CS.t ? CS.t('boost.free_random') : '');
    }
  }

  const cardsGrid = document.getElementById('boostCardsGrid');
  if (cardsGrid && CS.CARD_DEFS) {
    cardsGrid.innerHTML = '';
    CS.CARD_DEFS.forEach((c) => {
      const unlocked = !!(state.boosters.cards && state.boosters.cards[c.id]);
      const el = document.createElement('div');
      el.className = 'boost-collect bevel-out' + (unlocked ? '' : ' locked');
      el.innerHTML = `
        <div class="ci">${unlocked ? c.icon : '❔'}</div>
        <div class="cn">${unlocked ? (CS.cardName ? CS.cardName(c) : c.name) : '???'}</div>
        <div class="ch">${unlocked ? (CS.cardHint ? CS.cardHint(c) : c.hint) : (CS.t ? CS.t('card.locked') : '???')}</div>`;
      cardsGrid.appendChild(el);
    });
  }

  const urlNote = document.getElementById('boostShopUrlNote');
  if (urlNote) {
    urlNote.textContent = 'URL: ' + (CS.CONFIG.PREMIUM_SHOP_URL || (CS.t ? CS.t('boost.url_none') : '—'));
  }
}

async function onBuyBooster(id) {
  state = await CS.loadState();
  const result = CS.buyBooster(state, id);
  if (!result.success) {
    if (result.reason === 'cash') {
      const btn = document.querySelector(`[data-buy-booster="${id}"]`);
      if (btn) {
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 150);
      }
    }
    return;
  }
  CS.saveState(state);
  renderPanel();
  renderBoostersWindow();
  if (CS.Audio && CS.Audio.play) try { CS.Audio.play('click'); } catch (e) { /* */ }
}

async function onClaimFreeBooster(id) {
  state = await CS.loadState();
  const result = CS.claimFreeBooster(state, id || null);
  if (!result.success) {
    renderBoostersWindow();
    return;
  }
  CS.saveState(state);
  renderPanel();
  renderBoostersWindow();
  if (CS.Audio && CS.Audio.play) try { CS.Audio.play('click'); } catch (e) { /* */ }
  if (result.card) {
    state.history.unshift({
      type: 'booster',
      text: `🃏 Бонус: карточка «${result.card.name}»`,
      time: new Date().toLocaleTimeString()
    });
    CS.saveState(state);
  }
}

let adPreferredBoosterId = null; // конкретный бустер при клике «📺 реклама» на карточке

function startAdWatch(preferredId) {
  if (!state) return;
  CS.ensureBoosters(state);
  if ((state.boosters.adCooldown || 0) > 0) return;

  adPreferredBoosterId = preferredId || null;
  if (typeof CS.Ads === 'undefined') {
    console.warn('[ad] CS.Ads не загружен');
    return;
  }
  if (!CS.Ads.ready) CS.Ads.init();

  CS.Ads.showRewarded({
    preferredBoosterId: preferredId,
    onRewarded: function () {
      finishAdWatch(true);
    },
    onDismissed: function () {
      adPreferredBoosterId = null;
      const overlay = document.getElementById('adOverlay');
      if (overlay) overlay.hidden = true;
      // Без награды — пользователь закрыл ролик раньше времени
    },
    onError: function () {
      // Ошибка сети/блока — UI уже мог уйти в simulate fallback внутри CS.Ads
    }
  });
}

async function finishAdWatch(fromProvider) {
  const overlay = document.getElementById('adOverlay');
  if (overlay) overlay.hidden = true;

  // Старый путь: кнопка «Забрать награду» на симуляции (onclick в cs-ads)
  // fromProvider === true — колбэк из CS.Ads
  if (!fromProvider && CS.Ads && CS.Ads.provider === 'yandex') {
    // На yandex награда только из onRewarded
    return;
  }

  const preferred = adPreferredBoosterId;
  adPreferredBoosterId = null;

  state = await CS.loadState();
  const result = CS.claimAdReward(state, preferred);
  if (!result.success) {
    renderBoostersWindow();
    return;
  }
  CS.saveState(state);
  renderPanel();
  renderBoostersWindow();
  if (CS.Audio && CS.Audio.play) try { CS.Audio.play('click'); } catch (e) { /* */ }

  if (result.card) {
    state.history.unshift({
      type: 'booster',
      text: `🃏 Бонус рекламы: карточка «${result.card.name}»`,
      time: new Date().toLocaleTimeString()
    });
  }
}

function openPremiumShop() {
  const url = (CS.CONFIG && CS.CONFIG.PREMIUM_SHOP_URL) || 'https://www.donationalerts.com/r/j_miles';
  // Предпочитаем встроенный Браузер.exe, иначе внешнюю вкладку
  try {
    if (typeof WM !== 'undefined' && WM.open) {
      WM.open('browser');
      // Попытка передать URL в iframe браузера (если API есть)
      setTimeout(() => {
        const frame = document.querySelector('#browserFrame, iframe[src*="browser"]');
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ type: 'cs-navigate', url }, '*');
          } catch (e) { /* ignore */ }
        }
      }, 300);
    }
  } catch (e) { /* ignore */ }
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) { /* ignore */ }
}

// Старт после загрузки всех UI-модулей
init();
