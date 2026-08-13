// Устарело: словари перенесены в core/i18n/.
// shared.js подключает core/i18n/runtime.js + core/i18n/ru.js
// Другие языки: CS.loadLocale('en'|'es'|...)
var CS = window.CS || (window.CS = {});
if (!CS.t && console && console.warn) {
  console.warn('[CS] cs-i18n.js stub: load core/i18n/runtime.js');
}
