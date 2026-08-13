// ============================================================================
// Настройка.exe — звук, громкость, boot-анимация, облачный аккаунт
// ============================================================================

let _settingsBound = false;

function bindSettingsUI() {
  const sound = document.getElementById('setSound');
  const volume = document.getElementById('setVolume');
  const volLabel = document.getElementById('setVolumeLabel');
  const bootAnim = document.getElementById('setBootAnim');
  const testBtn = document.getElementById('setTestSound');
  const replay = document.getElementById('setReplayBoot');
  if (!sound || !state) return;

  const s = CS.ensureSettings(state);
  sound.checked = s.sound !== false;
  if (volume) {
    volume.value = Math.round((s.volume != null ? s.volume : 0.45) * 100);
    if (volLabel) volLabel.textContent = volume.value + '%';
  }
  if (bootAnim) bootAnim.checked = s.bootAnim !== false;

  const langSel = document.getElementById('setLang');
  if (langSel) {
    CS.syncLangFromState(state);
    langSel.value = CS.getLangPreference ? CS.getLangPreference(state) : (state.settings && state.settings.lang) || 'auto';
  }
  if (typeof CS.applyI18n === 'function') {
    const body = document.querySelector('.settings-body');
    if (body) CS.applyI18n(body);
  }

  renderCloudSettingsUI();

  if (_settingsBound) return;
  _settingsBound = true;

  function persist() {
    CS.ensureSettings(state);
    state.settings.sound = sound.checked;
    if (volume) state.settings.volume = Number(volume.value) / 100;
    if (bootAnim) state.settings.bootAnim = bootAnim.checked;
    const langSel2 = document.getElementById('setLang');
    if (langSel2) state.settings.lang = langSel2.value;
    CS.saveState(state);
  }

  sound.addEventListener('change', () => { persist(); if (CS.Audio) CS.Audio.play(state, 'ui'); });
  if (volume) {
    volume.addEventListener('input', () => {
      if (volLabel) volLabel.textContent = volume.value + '%';
      persist();
    });
  }
  if (bootAnim) bootAnim.addEventListener('change', persist);
  if (langSel) {
    langSel.addEventListener('change', () => {
      CS.setLangAsync(langSel.value, state).then(function () { if (CS.applyI18n) CS.applyI18n(document); });
      persist();
      if (typeof CS.applyI18n === 'function') {
        const body = document.querySelector('.settings-body');
        if (body) CS.applyI18n(body);
        CS.applyI18n(document);
      }
      // обновить заголовок окна настроек
      try {
        const win = document.querySelector('.win95-window[data-window-id="settings"] .win95-titlebar span, #win-settings .win95-titlebar span');
        if (win) win.textContent = CS.t('win.settings');
      } catch (e) {}
      if (typeof renderCloudSettingsUI === 'function') renderCloudSettingsUI();
    });
  }
  if (testBtn) testBtn.addEventListener('click', () => {
    persist();
    if (CS.Audio) { CS.Audio.unlock(); CS.Audio.play(state, 'success'); }
  });
  if (replay) replay.addEventListener('click', () => {
    runBootSequence().then(() => { if (CS.Audio) CS.Audio.play(state, 'notify'); });
  });

  const loginBtn = document.getElementById('setCloudLogin');
  const regBtn = document.getElementById('setCloudRegister');
  const googleBtn = document.getElementById('setCloudGoogle');
  const logoutBtn = document.getElementById('setCloudLogout');
  const pushBtn = document.getElementById('setCloudPush');
  const pullBtn = document.getElementById('setCloudPull');
  // старая кнопка на случай кэша шаблона
  const syncBtn = document.getElementById('setCloudSync');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = (document.getElementById('setCloudEmail') || {}).value || '';
      const pass = (document.getElementById('setCloudPass') || {}).value || '';
      setCloudMsg((CS.t ? CS.t('m.ceaf0c955d') : 'Вход…'));
      const r = await CS.Cloud.signIn(email.trim(), pass);
      if (!r.success) {
        setCloudMsg(r.error || (CS.t ? CS.t('m.8e3dea2352') : 'Ошибка входа'), true);
        return;
      }
      setCloudMsg((CS.t ? CS.t('m.2438a2d749') : 'Вход выполнен, сверка с облаком…'));
      await afterCloudAuth();
    });
  }
  if (regBtn) {
    regBtn.addEventListener('click', async () => {
      const email = (document.getElementById('setCloudEmail') || {}).value || '';
      const pass = (document.getElementById('setCloudPass') || {}).value || '';
      if (pass.length < 6) {
        setCloudMsg((CS.t ? CS.t('m.52fd36c2ec') : 'Пароль не короче 6 символов'), true);
        return;
      }
      setCloudMsg((CS.t ? CS.t('m.668f963448') : 'Регистрация…'));
      const r = await CS.Cloud.signUp(email.trim(), pass);
      if (!r.success) {
        setCloudMsg(r.error || (CS.t ? CS.t('m.b9f2cacc6f') : 'Ошибка регистрации'), true);
        return;
      }
      if (r.needsConfirm) {
        setCloudMsg(r.message || (CS.t ? CS.t('m.49892d1167') : 'Проверьте почту, затем войдите.'));
        renderCloudSettingsUI();
        return;
      }
      setCloudMsg((CS.t ? CS.t('m.6851449e1f') : 'Аккаунт создан, сохранение в облако…'));
      await afterCloudAuth();
    });
  }
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      setCloudMsg((CS.t ? CS.t('m.68f9d5a54d') : 'Откроется окно Google…'));
      const r = await CS.Cloud.signInWithGoogle();
      if (!r.success) {
        setCloudMsg(r.error || (CS.t ? CS.t('m.003312f5bd') : 'Ошибка Google-входа'), true);
        return;
      }
      setCloudMsg((CS.t ? CS.t('m.343007bdcc') : 'Google: вход выполнен, сверка с облаком…'));
      await afterCloudAuth();
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await CS.Cloud.signOut();
      setCloudMsg((CS.t ? CS.t('m.6fcf945ef3') : 'Вы вышли. Прогресс остаётся на этом устройстве.'));
      renderCloudSettingsUI();
    });
  }
  if (pushBtn) {
    pushBtn.addEventListener('click', async () => {
      setCloudMsg((CS.t ? CS.t('m.68a4b9980b') : 'Сохранение в облако…'));
      await pushCloudNow(true);
    });
  }
  if (pullBtn) {
    pullBtn.addEventListener('click', async () => {
      if (!confirm((CS.t ? CS.t('m.de624383c9') : 'Заменить текущий прогресс на сейв из облака? Локальные изменения с последнего сохранения в облако будут потеряны.'))) {
        return;
      }
      setCloudMsg((CS.t ? CS.t('m.11d93544df') : 'Загрузка из облака…'));
      await pullCloudNow(true);
    });
  }
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      setCloudMsg((CS.t ? CS.t('m.68a4b9980b') : 'Сохранение в облако…'));
      await pushCloudNow(true);
    });
  }

  // ---- Экспорт / импорт / сброс ----
  const exportBtn = document.getElementById('setExportSave');
  const importBtn = document.getElementById('setImportSave');
  const importFile = document.getElementById('setImportFile');
  const resetBtn = document.getElementById('setResetProgress');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        state = await CS.loadState();
        const json = CS.exportStateJson(state);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.href = URL.createObjectURL(blob);
        a.download = 'cashstream-save-' + stamp + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setSaveMsg((CS.t ? CS.t('m.e5d8d360b3') : 'Сейв скачан: ') + a.download);
      } catch (e) {
        setSaveMsg(e.message || String(e), true);
      }
    });
  }
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files && importFile.files[0];
      importFile.value = '';
      if (!file) return;
      if (!confirm((CS.t ? CS.t('m.ef82415866') : 'Заменить текущий прогресс данными из «') + file.name + '»?')) return;
      try {
        const text = await file.text();
        const result = CS.importStateJson(text);
        if (!result.success) {
          setSaveMsg(result.error || (CS.t ? CS.t('m.b46028ec71') : 'Ошибка импорта'), true);
          return;
        }
        state = result.state;
        CS.saveState(state);
        if (typeof renderAll === 'function') renderAll(true);
        else if (typeof renderPanel === 'function') renderPanel();
        setSaveMsg((CS.t ? CS.t('m.b903d2ec69') : 'Импорт выполнен. Уровень ') + (state.level || 1) + ', кэш ' + Math.floor(state.cash || 0) + '.');
        renderCloudSettingsUI();
      } catch (e) {
        setSaveMsg(e.message || String(e), true);
      }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm((CS.t ? CS.t('m.fccf986c2f') : 'Сбросить весь локальный прогресс и начать заново? Это нельзя отменить (кроме импорта JSON / облака).'))) return;
      if (!confirm((CS.t ? CS.t('m.ebaddaf8ff') : 'Точно сбросить? Обучение начнётся снова.'))) return;
      state = CS.resetProgress();
      if (typeof renderAll === 'function') renderAll(true);
      else if (typeof renderPanel === 'function') renderPanel();
      if (typeof showTutorial === 'function' && !state.tutorialDone) showTutorial();
      setSaveMsg((CS.t ? CS.t('m.7d1312f2a3') : 'Прогресс сброшен. Облачный аккаунт не затронут.'));
      renderCloudSettingsUI();
    });
  }
}

function setSaveMsg(text, isError) {
  const el = document.getElementById('setSaveMsg');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? '#7a1c1c' : '';
}

function setCloudMsg(text, isError) {
  const el = document.getElementById('setCloudMsg');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? '#7a1c1c' : '';
}

function renderCloudSettingsUI() {
  const status = document.getElementById('setCloudStatus');
  const out = document.getElementById('setCloudLoggedOut');
  const inn = document.getElementById('setCloudLoggedIn');
  if (!status) return;

  if (!CS.Cloud || !CS.Cloud._configured()) {
    const st = CS.Cloud && CS.Cloud.configStatus ? CS.Cloud.configStatus() : null;
    status.textContent = '⚠ ' + (st && st.text
      ? st.text
      : (CS.t ? CS.t('m.acedf34a18') : 'Укажите Publishable key в core/cs-config.js → CS.CLOUD.anonKey'));
    if (out) out.hidden = true;
    if (inn) inn.hidden = true;
    return;
  }

  if (CS.Cloud.isLoggedIn()) {
    status.textContent = CS.t('set.cloud.logged', { email: CS.Cloud.currentEmail() || CS.Cloud.currentUserId() });
    if (out) out.hidden = true;
    if (inn) inn.hidden = false;
  } else {
    status.textContent = CS.t('set.cloud.guest');
    if (out) out.hidden = false;
    if (inn) inn.hidden = true;
  }
}

async function afterCloudAuth() {
  renderCloudSettingsUI();
  // Умная сверка только при входе (не затирает более сильный локальный прогресс)
  await runCloudSyncOnLogin(true);
}

/** Записать текущий локальный прогресс в БД */
async function pushCloudNow(interactive) {
  if (!CS.Cloud || !CS.Cloud.isLoggedIn()) {
    if (interactive) setCloudMsg('Сначала войдите в аккаунт', true);
    return;
  }
  try {
    state = await CS.loadState();
    if (!state.cloudMeta) state.cloudMeta = {};
    state.cloudMeta.updatedAt = new Date().toISOString();
    CS.saveState(state);
    const push = await CS.Cloud.pushSave(state);
    if (interactive) {
      setCloudMsg(push.success
        ? (CS.t ? CS.t('m.fd5747b80a') : 'Текущий прогресс сохранён в базу (') + (push.updated_at || '') + ').'
        : ((CS.t ? CS.t('m.ff59eff482') : 'Ошибка записи: ') + (push.error || '')), !push.success);
    }
    renderCloudSettingsUI();
  } catch (e) {
    if (interactive) setCloudMsg(e.message || String(e), true);
  }
}

/** Подтянуть сейв из БД и заменить локальный */
async function pullCloudNow(interactive) {
  if (!CS.Cloud || !CS.Cloud.isLoggedIn()) {
    if (interactive) setCloudMsg('Сначала войдите в аккаунт', true);
    return;
  }
  try {
    const pull = await CS.Cloud.pullSave();
    if (!pull.success) {
      if (interactive) setCloudMsg((CS.t ? CS.t('m.41ce885c43') : 'Ошибка: ') + (pull.error || 'pull'), true);
      return;
    }
    if (!pull.state) {
      if (interactive) setCloudMsg((CS.t ? CS.t('m.8533f30723') : 'В облаке ещё нет сейва — сначала нажмите «Сохранить в облако».'));
      return;
    }
    state = CS.normalizeState(pull.state);
    if (!state.cloudMeta) state.cloudMeta = {};
    state.cloudMeta.updatedAt = pull.updated_at || new Date().toISOString();
    CS.saveState(state);
    if (typeof renderPanel === 'function') renderPanel();
    if (typeof renderAll === 'function') renderAll(false);
    if (interactive) setCloudMsg((CS.t ? CS.t('m.9c3330e320') : 'Загружен прогресс из облака.'));
    renderCloudSettingsUI();
  } catch (e) {
    if (interactive) setCloudMsg(e.message || String(e), true);
  }
}

/**
 * Только после входа/регистрации: сверка без слепого отката к старому облаку.
 * @param {boolean} interactive
 */
async function runCloudSyncOnLogin(interactive) {
  if (!CS.Cloud || !CS.Cloud.isLoggedIn()) {
    if (interactive) setCloudMsg((CS.t ? CS.t('m.ef51b98f91') : 'Сначала войдите в аккаунт'), true);
    return;
  }
  try {
    state = await CS.loadState();
    const result = await CS.Cloud.syncAfterLogin(state);
    if (!result.success) {
      if (interactive) setCloudMsg((CS.t ? CS.t('m.41ce885c43') : 'Ошибка: ') + (result.error || 'sync'), true);
      return;
    }
    if (result.action === 'pulled_cloud' && result.state) {
      state = result.state;
      CS.saveState(state);
      if (typeof renderPanel === 'function') renderPanel();
      if (interactive) setCloudMsg((CS.t ? CS.t('m.285fb37dcf') : 'С другого устройства подтянут более свежий сейв из облака.'));
    } else {
      if (!state.cloudMeta) state.cloudMeta = {};
      state.cloudMeta.updatedAt = new Date().toISOString();
      CS.saveState(state);
      if (interactive) {
        setCloudMsg(result.success
          ? (CS.t ? CS.t('m.d047fbf228') : 'Текущий прогресс записан в облако.')
          : ((CS.t ? CS.t('m.ff59eff482') : 'Ошибка записи: ') + (result.error || '')), !result.success);
      }
    }
    renderCloudSettingsUI();
  } catch (e) {
    if (interactive) setCloudMsg(e.message || String(e), true);
  }
}

/** @deprecated имя для совместимости — теперь только push */
async function runCloudSync(interactive) {
  return pushCloudNow(interactive);
}

/** Тихая синхронизация (после загрузки fullpage), если уже залогинены */
async function initCloudOnBoot() {
  if (!CS.Cloud) return;
  await CS.Cloud.loadSession();
  if (CS.Cloud.isLoggedIn()) {
    // не перетираем локальный сразу без нужды — только refresh token check
    try { await CS.Cloud.ensureFreshToken(); } catch (e) { /* ignore */ }
  }
}
