// ==========================================================================
// КЭШ.СТРИМ — точка входа ядра.
// Подключайте только этот файл: <script src="shared.js"></script>
// Он синхронно подгружает модули из core/ (порядок важен).
// ==========================================================================
(function () {
  var files = [
    'core/cs-namespace.js',
    'core/cs-config.js',
    'core/cs-data.js',
    'core/cs-storage.js',
    'core/cs-gameplay.js',
    'core/cs-market.js',
    'core/cs-economy.js',
    'core/cs-business.js',
    'core/cs-mail.js',
    'core/cs-achievements.js',
    'core/cs-events.js',
    'core/cs-audio.js'
  ];

  var base = '';
  try {
    if (document.currentScript && document.currentScript.src) {
      base = document.currentScript.src.replace(/[^\/]+$/, '');
    }
  } catch (e) { /* ignore */ }

  // document.write в момент разбора shared.js вставляет script-теги синхронно,
  // поэтому к моменту следующего <script src="fullpage.js"> объект CS уже собран.
  for (var i = 0; i < files.length; i++) {
    document.write('<script src="' + base + files[i] + '"><\/script>');
  }
})();
