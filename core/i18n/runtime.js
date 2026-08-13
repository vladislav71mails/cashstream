// ============================================================================
// КЭШ.СТРИМ — i18n runtime (словари в core/i18n/{lang}.js)
// API: CS.t, CS.setLang, CS.loadLocale, CS.ensureLocale, CS.applyI18n
// ============================================================================
var CS = window.CS || (window.CS = {});

CS.LANGS = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' }
];

/** Загруженные пакеты: { ru: { key: str }, ... } */
CS.I18N = CS.I18N || {};

/**
 * Язык ОС игрока → один из поддерживаемых кодов.
 * navigator.languages: ['es-MX','en-US'] → es
 */
CS.detectSystemLang = function () {
  var supported = {};
  (CS.LANGS || []).forEach(function (l) { supported[l.code] = true; });
  var list = [];
  try {
    if (navigator.languages && navigator.languages.length) {
      for (var i = 0; i < navigator.languages.length; i++) list.push(navigator.languages[i]);
    }
  } catch (e) {}
  try {
    if (navigator.language) list.push(navigator.language);
    if (navigator.userLanguage) list.push(navigator.userLanguage);
  } catch (e2) {}
  for (var j = 0; j < list.length; j++) {
    var raw = String(list[j] || '').toLowerCase().replace('_', '-');
    if (!raw) continue;
    var primary = raw.split('-')[0];
    if (supported[primary]) return primary;
    // pt-BR и т.п. без словаря → en как нейтральный fallback для «похожих» не делаем
  }
  // нет совпадения с ru/en/es → английский как универсальный
  return supported.en ? 'en' : 'ru';
};

/**
 * Эффективный язык UI из settings.
 * settings.lang === 'auto' | отсутствует → система
 * иначе явный выбор игрока
 */
CS.resolveLang = function (state) {
  var s = state && CS.ensureSettings ? CS.ensureSettings(state) : (state && state.settings);
  var pref = (s && s.lang) || 'auto';
  if (pref === 'auto' || pref === 'system') {
    return CS.detectSystemLang();
  }
  if (CS.LANGS && CS.LANGS.some(function (l) { return l.code === pref; })) {
    return pref;
  }
  return CS.detectSystemLang();
};


CS._lang = 'ru';
CS._tCache = Object.create(null);
CS._localeLoading = Object.create(null);

/** Зарегистрировать словарь (вызывается из core/i18n/xx.js) */
CS.registerLocale = function (code, pack) {
  if (!code || !pack) return;
  CS.I18N[code] = pack;
  // сбросить кэш строк этого языка
  var prefix = code + '\0';
  Object.keys(CS._tCache).forEach(function (k) {
    if (k.indexOf(prefix) === 0) delete CS._tCache[k];
  });
};

CS._i18nHas = function (key) {
  try {
    var pack = CS.I18N[CS.getLang()];
    if (pack && Object.prototype.hasOwnProperty.call(pack, key)) return true;
    // fallback ru
    pack = CS.I18N.ru;
    return !!(pack && Object.prototype.hasOwnProperty.call(pack, key));
  } catch (e) {
    return false;
  }
};

CS.getLang = function () {
  return CS._lang || 'ru';
};

CS._localeUrl = function (code) {
  var base = CS.coreBase || '';
  return base + 'core/i18n/' + code + '.js';
};

/**
 * Подгрузить словарь языка один раз.
 * ru обычно уже в бандле; en/es — по требованию.
 */
CS.loadLocale = function (code) {
  code = code || 'ru';
  if (CS.I18N[code]) return Promise.resolve(code);
  if (CS._localeLoading[code]) return CS._localeLoading[code];

  CS._localeLoading[code] = new Promise(function (resolve, reject) {
    // В extension/iframe: динамический script
    var s = document.createElement('script');
    s.src = CS._localeUrl(code);
    s.async = true;
    s.onload = function () {
      if (CS.I18N[code]) resolve(code);
      else reject(new Error('locale not registered: ' + code));
    };
    s.onerror = function () {
      delete CS._localeLoading[code];
      reject(new Error('locale load failed: ' + code));
    };
    (document.head || document.documentElement).appendChild(s);
  });
  return CS._localeLoading[code];
};

/** Гарантировать язык в памяти (fallback на ru при ошибке). */
CS.ensureLocale = function (code) {
  code = code || CS.getLang() || 'ru';
  if (!CS.LANGS.some(function (l) { return l.code === code; })) code = 'ru';
  return CS.loadLocale(code).catch(function () {
    return CS.loadLocale('ru').then(function () { return 'ru'; });
  });
};

/** Строка перевода. vars: { name: value } → {name} */
CS.t = function (key, vars) {
  if (!key) return '';
  var lang = CS.getLang();
  var cacheKey = null;
  if (!vars) {
    cacheKey = lang + '\0' + key;
    if (CS._tCache[cacheKey] != null) return CS._tCache[cacheKey];
  }
  var pack = CS.I18N[lang];
  var text = (pack && pack[key]) || (CS.I18N.ru && CS.I18N.ru[key]) || key;
  if (vars && typeof vars === 'object') {
    text = String(text);
    Object.keys(vars).forEach(function (k) {
      text = text.split('{' + k + '}').join(String(vars[k]));
    });
    return text;
  }
  if (cacheKey) CS._tCache[cacheKey] = text;
  return text;
};

/**
 * code: 'auto' | 'ru' | 'en' | 'es'
 * В settings пишется preference; в CS._lang — эффективный код для CS.t
 */
CS.setLang = function (code, state) {
  if (!code) code = 'auto';
  var pref = code;
  var effective;
  if (pref === 'auto' || pref === 'system') {
    pref = 'auto';
    effective = CS.detectSystemLang();
  } else if (CS.LANGS.some(function (l) { return l.code === pref; })) {
    effective = pref;
  } else {
    pref = 'auto';
    effective = CS.detectSystemLang();
  }
  CS._lang = effective;
  CS._tCache = Object.create(null);
  if (state && CS.ensureSettings) {
    CS.ensureSettings(state);
    state.settings.lang = pref;
  }
  try {
    document.documentElement.lang = effective;
  } catch (e) { /* ignore */ }
  return effective;
};

/** Сменить язык (auto или явный) и догрузить словарь */
CS.setLangAsync = function (code, state) {
  var effective = (code === 'auto' || code === 'system' || !code)
    ? CS.detectSystemLang()
    : code;
  if (!CS.LANGS.some(function (l) { return l.code === effective; })) {
    effective = CS.detectSystemLang();
  }
  return CS.ensureLocale(effective).then(function (loaded) {
    // preference сохраняем как запросил пользователь (auto/ru/en/es)
    if (state && CS.ensureSettings) {
      CS.ensureSettings(state);
      state.settings.lang = (code === 'auto' || code === 'system' || !code) ? 'auto' : loaded;
    }
    CS._lang = loaded;
    CS._tCache = Object.create(null);
    try { document.documentElement.lang = loaded; } catch (e) {}
    return loaded;
  });
};

CS.applyI18n = function (root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    if (!key) return;
    var val = CS.t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (!el.getAttribute('data-i18n-placeholder')) el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = CS.t(key);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-title');
    if (key) el.title = CS.t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = CS.t(key);
  });
};

CS.syncLangFromState = function (state) {
  var code = CS.resolveLang(state);
  CS._lang = code;
  try { document.documentElement.lang = code; } catch (e) {}
  return code;
};

/** После loadState: auto→система или явный язык + догрузка словаря */
CS.bootI18n = function (state) {
  var code = CS.syncLangFromState(state);
  return CS.ensureLocale(code).then(function (loaded) {
    CS._lang = loaded;
    try { document.documentElement.lang = loaded; } catch (e) {}
    if (CS.applyI18n) CS.applyI18n(document);
    return loaded;
  });
};

/** Preference из settings для UI-селектов: auto|ru|en|es */
CS.getLangPreference = function (state) {
  var s = state && CS.ensureSettings ? CS.ensureSettings(state) : (state && state.settings);
  var pref = (s && s.lang) || 'auto';
  if (pref === 'system') return 'auto';
  if (pref === 'auto') return 'auto';
  if (CS.LANGS.some(function (l) { return l.code === pref; })) return pref;
  return 'auto';
};
