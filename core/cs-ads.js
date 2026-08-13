// ============================================================================
// КЭШ.СТРИМ — адаптер рекламы (симуляция / Яндекс РСЯ Rewarded)
//
// Важно для РФ и Chrome Extension:
// • AdMob / мобильные SDK в MV3-расширении не работают.
// • Google AdSense / Ad Placement API рассчитаны на веб-страницу с доменом,
//   не на chrome-extension:// (и выплаты в РФ ограничены).
// • Рабочий путь для аудитории в России: **Rewarded-блок РСЯ** на HTTPS-сайте
//   (fullpage выложен на ваш домен) или публикация в Яндекс Играх.
// • В контексте расширения (chrome-extension://) провайдер yandex недоступен —
//   остаётся simulate или ссылка на веб-версию / донат.
// ============================================================================
var CS = window.CS || (window.CS = {});

CS.Ads = {
  /** @type {'simulate'|'yandex'} */
  provider: 'simulate',
  ready: false,
  _loaderPromise: null,
  _pending: null
};

/**
 * Инициализация. Вызывать один раз после загрузки конфига (fullpage).
 * Провайдер берётся из CS.CONFIG.ADS.provider; yandex включается только на http(s).
 */
CS.Ads.init = function () {
  const cfg = (CS.CONFIG && CS.CONFIG.ADS) || {};
  let provider = cfg.provider || 'simulate';

  const isHttp = typeof location !== 'undefined' &&
    (location.protocol === 'http:' || location.protocol === 'https:');
  const isExtension = typeof location !== 'undefined' &&
    location.protocol === 'chrome-extension:';

  if (provider === 'yandex' && !isHttp) {
    console.warn('[CS.Ads] yandex недоступен вне http(s) (сейчас ' +
      (isExtension ? 'chrome-extension' : location.protocol) +
      '). Используем simulate. Выложите fullpage на домен или откройте веб-сборку.');
    provider = 'simulate';
  }

  if (provider === 'yandex' && !(cfg.yandexBlockId || '').trim()) {
    console.warn('[CS.Ads] ADS.yandexBlockId пуст — fallback на simulate');
    provider = 'simulate';
  }

  CS.Ads.provider = provider;
  CS.Ads.ready = true;
  return provider;
};

/** Загрузка скрипта Яндекс.Контекста (один раз). */
CS.Ads._loadYandexLoader = function () {
  if (CS.Ads._loaderPromise) return CS.Ads._loaderPromise;
  CS.Ads._loaderPromise = new Promise(function (resolve, reject) {
    if (window.Ya && window.Ya.Context && window.Ya.Context.AdvManager) {
      resolve();
      return;
    }
    window.yaContextCb = window.yaContextCb || [];
    const s = document.createElement('script');
    s.src = 'https://yandex.ru/ads/system/context.js';
    s.async = true;
    s.onload = function () { resolve(); };
    s.onerror = function () {
      CS.Ads._loaderPromise = null;
      reject(new Error('Не удалось загрузить yandex.ru/ads/system/context.js'));
    };
    document.head.appendChild(s);
  });
  return CS.Ads._loaderPromise;
};

/**
 * Показать rewarded / симуляцию.
 * @param {object} opts
 * @param {string|null} [opts.preferredBoosterId]
 * @param {function} [opts.onProgress] — (leftSec, totalSec) только для simulate
 * @param {function} opts.onRewarded — полный просмотр → выдать награду
 * @param {function} [opts.onDismissed] — закрыли раньше / ошибка без награды
 * @param {function} [opts.onError] — (err)
 */
CS.Ads.showRewarded = function (opts) {
  opts = opts || {};
  if (!CS.Ads.ready) CS.Ads.init();

  if (CS.Ads.provider === 'yandex') {
    return CS.Ads._showYandex(opts);
  }
  return CS.Ads._showSimulate(opts);
};

CS.Ads._showSimulate = function (opts) {
  const total = (CS.CONFIG && CS.CONFIG.AD_WATCH_SECONDS) || 8;
  let left = total;
  const overlay = document.getElementById('adOverlay');
  const fill = document.getElementById('adProgressFill');
  const timerEl = document.getElementById('adTimer');
  const skip = document.getElementById('adSkipBtn');
  const note = document.querySelector('#adOverlay .ad-note');
  const title = document.querySelector('#adOverlay .ad-title');

  if (title) title.textContent = (CS.t ? CS.t('m.5e03302bac') : '📺 Реклама (симуляция)');
  if (note) {
    note.textContent = (CS.t ? CS.t('m.68b1999a28') : 'Реальный SDK не активен. Для РФ: РСЯ Rewarded на HTTPS-домене — см. CS.CONFIG.ADS.');
  }

  if (overlay) overlay.hidden = false;
  if (fill) fill.style.width = '0%';
  if (skip) {
    skip.disabled = true;
    skip.textContent = (CS.t ? CS.t('m.06f1d9ee88') : 'Забрать награду');
    skip.onclick = null;
  }
  if (timerEl) timerEl.textContent = (CS.t ? CS.t('m.b8491b70f9') : 'Осталось ') + left + (CS.t ? CS.t('m.8f85815be2') : ' с…');

  if (CS.Ads._simTimer) clearInterval(CS.Ads._simTimer);
  CS.Ads._simTimer = setInterval(function () {
    left -= 1;
    const pct = Math.round(((total - left) / total) * 100);
    if (fill) fill.style.width = Math.min(100, pct) + '%';
    if (timerEl) timerEl.textContent = left > 0 ? ((CS.t ? CS.t('m.b8491b70f9') : 'Осталось ') + left + (CS.t ? CS.t('m.8f85815be2') : ' с…')) : (CS.t ? CS.t('m.a534ca53a5') : 'Готово!');
    if (typeof opts.onProgress === 'function') opts.onProgress(Math.max(0, left), total);
    if (left <= 0) {
      clearInterval(CS.Ads._simTimer);
      CS.Ads._simTimer = null;
      if (skip) {
        skip.disabled = false;
        skip.onclick = function () {
          if (overlay) overlay.hidden = true;
          if (typeof opts.onRewarded === 'function') opts.onRewarded({ provider: 'simulate' });
        };
      }
    }
  }, 1000);

  // Закрытие крестиком не предусмотрено — только досмотр (как у rewarded)
  return Promise.resolve({ provider: 'simulate' });
};

CS.Ads._showYandex = function (opts) {
  const cfg = CS.CONFIG.ADS || {};
  const blockId = (cfg.yandexBlockId || '').trim();
  const platform = cfg.yandexPlatform === 'touch' ? 'touch' : 'desktop';

  const overlay = document.getElementById('adOverlay');
  const fill = document.getElementById('adProgressFill');
  const timerEl = document.getElementById('adTimer');
  const skip = document.getElementById('adSkipBtn');
  const title = document.querySelector('#adOverlay .ad-title');
  const note = document.querySelector('#adOverlay .ad-note');

  // Пока грузится/идёт ролик — показываем наш оверлей как «ожидание»
  if (title) title.textContent = '📺 Реклама РСЯ';
  if (note) note.textContent = (CS.t ? CS.t('m.cd47396765') : 'Досмотрите ролик до конца, чтобы получить бустер.');
  if (overlay) overlay.hidden = false;
  if (fill) fill.style.width = '30%';
  if (timerEl) timerEl.textContent = (CS.t ? CS.t('m.c5b6ba85ab') : 'Загрузка рекламы…');
  if (skip) {
    skip.disabled = true;
    skip.textContent = (CS.t ? CS.t('m.6f04847208') : 'Смотрите рекламу…');
    skip.onclick = null;
  }

  return CS.Ads._loadYandexLoader().then(function () {
    return new Promise(function (resolve) {
      let rewarded = false;
      let settled = false;

      function done(kind, extra) {
        if (settled) return;
        settled = true;
        if (overlay) overlay.hidden = true;
        resolve({ provider: 'yandex', kind: kind, extra: extra });
      }

      try {
        window.yaContextCb = window.yaContextCb || [];
        window.yaContextCb.push(function () {
          try {
            Ya.Context.AdvManager.render({
              blockId: blockId,
              type: 'rewarded',
              platform: platform,
              onRewarded: function () {
                rewarded = true;
                if (typeof opts.onRewarded === 'function') {
                  opts.onRewarded({ provider: 'yandex' });
                }
              },
              onClose: function () {
                if (!rewarded && typeof opts.onDismissed === 'function') {
                  opts.onDismissed({ provider: 'yandex' });
                }
                done(rewarded ? 'rewarded' : 'closed');
              },
              onError: function (err) {
                console.warn('[CS.Ads] Yandex onError', err);
                if (typeof opts.onError === 'function') opts.onError(err);
                // Fallback: не выдаём награду автоматически
                if (typeof opts.onDismissed === 'function') opts.onDismissed({ provider: 'yandex', error: err });
                done('error', err);
              }
            });
          } catch (e) {
            console.warn('[CS.Ads] render failed', e);
            if (typeof opts.onError === 'function') opts.onError(e);
            if (typeof opts.onDismissed === 'function') opts.onDismissed({ provider: 'yandex', error: e });
            done('error', e);
          }
        });
      } catch (e) {
        if (typeof opts.onError === 'function') opts.onError(e);
        if (typeof opts.onDismissed === 'function') opts.onDismissed({ provider: 'yandex', error: e });
        done('error', e);
      }
    });
  }).catch(function (err) {
    console.warn('[CS.Ads] loader failed, fallback simulate', err);
    if (typeof opts.onError === 'function') opts.onError(err);
    return CS.Ads._showSimulate(opts);
  });
};

/** Человекочитаемый статус для UI / настроек */
CS.Ads.statusText = function () {
  if (!CS.Ads.ready) CS.Ads.init();
  if (CS.Ads.provider === 'yandex') {
    return 'РСЯ Rewarded · блок ' + ((CS.CONFIG.ADS && CS.CONFIG.ADS.yandexBlockId) || '—');
  }
  return (CS.t ? CS.t('m.1114b2a1cb') : 'Симуляция (для продакшена в РФ — ADS.provider = "yandex" + HTTPS-домен)');
};
