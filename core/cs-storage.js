// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Хранилище, normalize, freshState ----
// ---- Хранилище --------------------------------------------------------
// Если страница открыта как часть расширения — используем chrome.storage.local
// (общее состояние для popup/fullpage/казино/биржи). Если страница открыта как
// обычная веб-страница (без chrome.*), откатываемся на localStorage —
// так игра остаётся играбельной и вне расширения.
CS._hasChromeStorage = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);

CS.loadState = function () {
  if (CS._hasChromeStorage) {
    return new Promise((resolve) => {
      chrome.storage.local.get(CS.CONFIG.STORAGE_KEY, (res) => {
        const stored = res[CS.CONFIG.STORAGE_KEY];
        if (!stored) {
          const fresh = CS.freshState();
          CS.saveState(fresh);
          resolve(fresh);
        } else {
          const normalized = CS.normalizeState(stored);
          if (normalized !== stored) CS.saveState(normalized);
          resolve(normalized);
        }
      });
    });
  }
  return new Promise((resolve) => {
    try {
      const raw = localStorage.getItem(CS.CONFIG.STORAGE_KEY);
      if (raw) {
        const normalized = CS.normalizeState(JSON.parse(raw));
        CS.saveState(normalized);
        resolve(normalized);
        return;
      }
    } catch (e) { /* ignore corrupt storage, fall through to fresh state */ }
    const fresh = CS.freshState();
    CS.saveState(fresh);
    resolve(fresh);
  });
};

// Дополняет старые сохранённые состояния недостающими полями (например,
// после добавления новых механик вроде биржи, недвижимости или регистрации
// бизнеса) и лечит NaN, если он уже успел просочиться в сохранённое состояние.
CS.normalizeState = function (stored) {
  let changed = false;
  const state = Object.assign({}, CS.DEFAULT_STATE, stored);
  state.totalsToday = Object.assign({}, CS.DEFAULT_STATE.totalsToday, stored.totalsToday || {});

  const numericFields = ['cash', 'focus', 'burnout', 'level', 'xp', 'clickValue', 'stepProgress', 'interns',
    'projectManagers', 'equipLevel', 'coffeeLevel', 'chairLevel', 'monitorLevel',
    'rentTimer', 'debt', 'taxRisk', 'graceTicksLeft', 'tutorialStep'];
  numericFields.forEach((key) => {
    if (typeof state[key] !== 'number' || Number.isNaN(state[key])) {
      state[key] = CS.DEFAULT_STATE[key] || 0;
      changed = true;
    }
  });
  ['taps', 'chains', 'cash'].forEach((key) => {
    if (typeof state.totalsToday[key] !== 'number' || Number.isNaN(state.totalsToday[key])) {
      state.totalsToday[key] = 0;
      changed = true;
    }
  });

  if (typeof state.economyActive !== 'boolean') {
    // Старые сохранения уже «в игре» — экономика включена, обучение пройдено
    state.economyActive = true;
    state.graceTicksLeft = 0;
    state.tutorialDone = true;
    changed = true;
  }
  if (typeof state.tutorialDone !== 'boolean') { state.tutorialDone = !!state.economyActive; changed = true; }

  if (!state.lifetime || typeof state.lifetime !== 'object') {
    state.lifetime = { taps: 0, chains: 0, cashEarned: 0, purchases: 0, casinoPlays: 0, eventsHandled: 0 };
    changed = true;
  } else {
    ['taps', 'chains', 'cashEarned', 'purchases', 'casinoPlays', 'eventsHandled'].forEach((k) => {
      if (typeof state.lifetime[k] !== 'number' || Number.isNaN(state.lifetime[k])) {
        state.lifetime[k] = 0;
        changed = true;
      }
    });
  }

  if (state.activeEvent !== null && typeof state.activeEvent !== 'object') {
    state.activeEvent = null;
    changed = true;
  }
  if (typeof state.eventCooldown !== 'number' || Number.isNaN(state.eventCooldown)) {
    state.eventCooldown = 0;
    changed = true;
  }

  if (!state.achievements || typeof state.achievements !== 'object') {
    state.achievements = { unlocked: {}, progress: {} };
    changed = true;
  } else {
    if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') {
      state.achievements.unlocked = {};
      changed = true;
    }
    if (!state.achievements.progress || typeof state.achievements.progress !== 'object') {
      state.achievements.progress = {};
      changed = true;
    }
  }

  if (!Array.isArray(state.history)) { state.history = []; changed = true; }
  if (!Array.isArray(state.puzzleOrder)) { state.puzzleOrder = []; changed = true; }
  if (!Array.isArray(state.findLayout)) { state.findLayout = []; changed = true; }
  if (!state.stockPrices || typeof state.stockPrices !== 'object') { state.stockPrices = {}; changed = true; }
  if (!state.stockHistory || typeof state.stockHistory !== 'object') { state.stockHistory = {}; changed = true; }
  if (!state.portfolio || typeof state.portfolio !== 'object') { state.portfolio = {}; changed = true; }
  if (!state.properties || typeof state.properties !== 'object') { state.properties = {}; changed = true; }

  if (CS.initMarket(state)) changed = true;
  if (CS.recomputeDerived(state)) changed = true;

  // Кабинет учёта / бизнес-регистрация должны существовать всегда, независимо от того,
  // открывал ли игрок Отчетность.exe — иначе банк/наём стажёров не смогут
  // прочитать статус регистрации.
  if (!state.stats || !state.stats.onec) {
    CS.ensureOnec(state);
    changed = true;
  }

  // «Магазин приложений» должен существовать всегда, независимо от того,
  // открывал ли игрок Магазин.exe — иначе рабочий стол не сможет узнать,
  // какие иконки установленных программ нужно показать.
  if (!state.apps) {
    CS.ensureApps(state);
    changed = true;
  }
  // Браузер и Почта — по умолчанию установлены (миграция старых сейвов)
  {
    const apps = CS.ensureApps(state);
    ['browser', 'mail'].forEach((id) => {
      if (!apps.installed.includes(id)) {
        apps.installed.push(id);
        changed = true;
      }
    });
  }

  CS.ensureInvest(state);
  if (typeof CS.ensureSettings === 'function') CS.ensureSettings(state);
  if (typeof CS.ensureBoosters === 'function') {
    CS.ensureBoosters(state);
  }
  if (typeof CS.ensureFreelance === 'function') {
    CS.ensureFreelance(state);
    CS.refreshOrderBoard(state, false);
  }

  if (!state.mail || typeof state.mail !== 'object') {
    state.mail = { messages: [], nextId: 1, filters: [], lastSystemAt: 0, pushQueue: [] };
    changed = true;
  } else {
    if (!Array.isArray(state.mail.messages)) { state.mail.messages = []; changed = true; }
    if (!Array.isArray(state.mail.filters)) { state.mail.filters = []; changed = true; }
    if (!Array.isArray(state.mail.pushQueue)) { state.mail.pushQueue = []; changed = true; }
    if (typeof state.mail.nextId !== 'number') { state.mail.nextId = 1; changed = true; }
  }

  if (state.chainId === null || state.chainId === undefined || !CS.QUEST_POOL[state.chainId]) {
    CS.assignChain(state, Math.floor(Math.random() * CS.QUEST_POOL.length));
    changed = true;
  } else if (!CS.currentChain(state).steps[state.stepIndex]) {
    state.stepIndex = 0;
    state.stepProgress = 0;
    CS.prepareStepLayout(state, CS.currentChain(state).steps[0]);
    changed = true;
  }

  return changed ? state : stored;
};

CS.saveState = function (state) {
  // Очереди тостов только в памяти — иначе дубли после storage.onChanged
  if (state && Object.prototype.hasOwnProperty.call(state, '_achievementQueue')) {
    try { delete state._achievementQueue; } catch (e) { state._achievementQueue = []; }
  }
  if (CS._hasChromeStorage) {
    chrome.storage.local.set({ [CS.CONFIG.STORAGE_KEY]: state });
    return;
  }
  try {
    localStorage.setItem(CS.CONFIG.STORAGE_KEY, JSON.stringify(state));
    // localStorage's native 'storage' event doesn't fire in the tab that
    // wrote it, so dispatch a synthetic one for same-tab widgets (casino/invest iframes).
    window.dispatchEvent(new CustomEvent('cs-storage-sync', { detail: state }));
  } catch (e) { /* storage unavailable — state just won't persist */ }
};

CS.onStateChanged = function (callback) {
  if (CS._hasChromeStorage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[CS.CONFIG.STORAGE_KEY]) {
        callback(changes[CS.CONFIG.STORAGE_KEY].newValue);
      }
    });
    return;
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== CS.CONFIG.STORAGE_KEY) return;
    try { callback(JSON.parse(e.newValue)); } catch (err) { /* ignore */ }
  });
  window.addEventListener('cs-storage-sync', (e) => callback(e.detail));
  if (window.parent && window.parent !== window) {
    window.parent.addEventListener('cs-storage-sync', (e) => callback(e.detail));
  }
};

// Видимый баннер вместо тихого зависания, если что-то пошло не так при инициализации
CS.reportFatalError = function (err) {
  console.error('КЭШ.СТРИМ:', err);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
    'background:#7a1c1c;color:#fff;font:12px Tahoma,sans-serif;padding:8px 12px;';
  banner.textContent = '⚠ Ошибка запуска игры: ' + (err && err.message ? err.message : err) +
    ' — откройте консоль разработчика (F12) для подробностей.';
  document.body.appendChild(banner);
};

/** Экспорт сейва в JSON (без токенов облака — они в csCloudSession). */
CS.exportStateJson = function (state) {
  const copy = JSON.parse(JSON.stringify(state || {}));
  if (copy._achievementQueue) delete copy._achievementQueue;
  return JSON.stringify(copy, null, 2);
};

/** Импорт из JSON → { success, state, error }. */
CS.importStateJson = function (raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { success: false, error: 'Файл не похож на сейв КЭШ.СТРИМ' };
    }
    if (typeof parsed.cash !== 'number' && typeof parsed.level !== 'number') {
      return { success: false, error: 'В файле нет полей cash/level — возможно, неверный файл' };
    }
    return { success: true, state: CS.normalizeState(parsed) };
  } catch (e) {
    return { success: false, error: e.message || 'Не удалось разобрать JSON' };
  }
};

/** Полный сброс прогресса. Сессию облака не трогает. */
CS.resetProgress = function () {
  const fresh = CS.freshState();
  CS.saveState(fresh);
  return fresh;
};

CS.freshState = function () {
  const state = JSON.parse(JSON.stringify(CS.DEFAULT_STATE));
  state.graceTicksLeft = CS.CONFIG.GRACE_TICKS;
  state.economyActive = false;
  state.tutorialDone = false;
  state.tutorialStep = 0;
  state.achievements = { unlocked: {}, progress: {} };
  state.lifetime = { taps: 0, chains: 0, cashEarned: 0, purchases: 0, casinoPlays: 0, eventsHandled: 0 };
  state.activeEvent = null;
  state.eventCooldown = 25; // небольшая пауза после старта новой игры
  CS.initMarket(state);
  CS.recomputeDerived(state);
  CS.ensureOnec(state);
  CS.ensureApps(state);
  CS.ensureInvest(state);
  if (typeof CS.ensureSettings === 'function') CS.ensureSettings(state);
  if (typeof CS.ensureBoosters === 'function') CS.ensureBoosters(state);
  if (typeof CS.ensureFreelance === 'function') {
    CS.ensureFreelance(state);
    CS.refreshOrderBoard(state, true);
  }
  CS.assignChain(state, Math.floor(Math.random() * CS.QUEST_POOL.length));
  return state;
};
