// ============================================================================
// Менеджер окон (Window Manager)
// Каждая «программа» открывается как перетаскиваемое окно поверх рабочего
// стола, сворачивается в таскбар и закрывается независимо.
// При close iframe выгружается (src → about:blank), при open — восстанавливается.
// ============================================================================
const WM = (function () {
  const DEFS = {
    quests:  { titleKey: 'win.quests',  title: (CS.t ? CS.t('m.37a1b02678') : '📋 Биржа заказов'),   tpl: 'tpl-quests', w: 720, h: 560 },
    journal: { titleKey: null,          title: (CS.t ? CS.t('m.19e01a6690') : '🗂️ Журнал'),          tpl: 'tpl-journal', w: 360, h: 420 },
    work:    { titleKey: 'win.work',    title: (CS.t ? CS.t('m.c29ccd8450') : '💻 Рабочая зона'),     tpl: 'tpl-work',   w: 420, h: 480 },
    casino:  { titleKey: 'win.casino',  title: (CS.t ? CS.t('m.400a38d58a') : '☕ Перерыв'),           tpl: 'tpl-casino', w: 560, h: 640 },
    invest:  { titleKey: 'win.invest',  title: (CS.t ? CS.t('win.invest') : '📈 Инвестиции'),       tpl: 'tpl-invest', w: 560, h: 520 },
    stats:   { titleKey: 'win.stats',   title: (CS.t ? CS.t('win.stats') : '📊 Отчетность'),       tpl: 'tpl-stats',  w: 680, h: 600 },
    bank:    { titleKey: 'win.bank',    title: (CS.t ? CS.t('win.bank') : '🏦 Банк'),             tpl: 'tpl-bank',   w: 600, h: 540 },
    store:   { titleKey: 'win.store',   title: (CS.t ? CS.t('store.title') : '🛒 Магазин приложений'), tpl: 'tpl-store', w: 640, h: 560 },
    crypto:  { titleKey: 'win.crypto',  title: (CS.t ? CS.t('m.4fa4f445ea') : '🔐 ЭЦП и СКЗИ'),        tpl: 'tpl-crypto', w: 480, h: 480 },
    browser: { titleKey: 'win.browser', title: (CS.t ? CS.t('win.browser') : '🌐 Браузер'),          tpl: 'tpl-browser', w: 640, h: 520 },
    mail:    { titleKey: 'win.mail',    title: (CS.t ? CS.t('m.3d7f4b697e') : '✉️ Почта'),            tpl: 'tpl-mail',   w: 720, h: 520 },
    achievements: { titleKey: 'win.achievements', title: (CS.t ? CS.t('desktop.achievements') : '🏆 Достижения'), tpl: 'tpl-achievements', w: 420, h: 520 },
    settings: { titleKey: 'win.settings', title: (CS.t ? CS.t('win.settings') : '⚙️ Настройка компьютера'), tpl: 'tpl-settings', w: 440, h: 560 },
    boosters: { titleKey: 'win.boosters', title: (CS.t ? CS.t('m.f19d80e4e4') : '⚡ Бустеры и коллекция'), tpl: 'tpl-boosters', w: 480, h: 560 }
  };

  function localizedTitle(def) {
    if (def.titleKey && typeof CS !== 'undefined' && CS.t) return CS.t(def.titleKey);
    return def.title;
  }
  const ORDER = ['quests', 'work', 'casino', 'invest'];
  // При входе окна не открываем — тихий рабочий стол. Hash (#casino / #invest) открывает якорь.
  const AUTO_OPEN = [];

  const windows = {}; // id -> { el, taskbarBtn, minimized, opened, maximized, prevRect }
  let topZ = 10;
  let focused = null;
  let cascadeIndex = 0;

  function layer() { return document.getElementById('windowLayer'); }
  function taskbarRow() { return document.getElementById('taskbarWindows'); }

  function nextRect(w, h) {
    const root = document.getElementById('desktopRoot');
    const bounds = root.getBoundingClientRect();
    const step = 30;
    const maxCols = Math.max(1, Math.floor((bounds.width - w - 40) / (step * 4)) + 1);
    const col = cascadeIndex % maxCols;
    const row = Math.floor(cascadeIndex / maxCols) % 5;
    cascadeIndex++;
    const left = 20 + col * (step * 4) + row * step;
    const top = 16 + row * step;
    return { left, top };
  }

  /** Запомнить исходный src iframe и выгрузить (остановить «процесс»). */
  function unloadFrames(el) {
    if (!el) return;
    el.querySelectorAll('iframe').forEach((frame) => {
      if (!frame.dataset.origSrc) {
        frame.dataset.origSrc = frame.getAttribute('src') || frame.src || '';
      }
      try {
        frame.src = 'about:blank';
      } catch (e) { /* ignore */ }
    });
  }

  /** Восстановить iframe после повторного открытия. */
  function reloadFrames(el) {
    if (!el) return;
    el.querySelectorAll('iframe').forEach((frame) => {
      const orig = frame.dataset.origSrc;
      if (orig && (frame.getAttribute('src') === 'about:blank' || frame.src === 'about:blank' || !frame.getAttribute('src'))) {
        frame.src = orig;
      }
    });
  }

  function build(id) {
    const def = DEFS[id];
    if (!def) return null;
    const tpl = document.getElementById(def.tpl);
    if (!tpl) return null;

    const el = document.createElement('div');
    el.className = 'win95-window floating-window hidden-window';
    el.dataset.windowId = id;
    el.style.width = def.w + 'px';
    el.style.height = def.h + 'px';

    const rect = nextRect(def.w, def.h);
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';

    const titlebar = document.createElement('div');
    titlebar.className = 'win95-titlebar';
    titlebar.innerHTML = `<span>${localizedTitle(def)}</span>
      <div class="dots">
        <span data-act="min" title="Свернуть">_</span>
        <span data-act="max" title="Во весь экран">▢</span>
        <span data-act="close" title="Закрыть">×</span>
      </div>`;
    el.appendChild(titlebar);

    const body = tpl.content.cloneNode(true);
    el.appendChild(body);

    // Запомнить исходные src iframe сразу после клонирования
    el.querySelectorAll('iframe').forEach((frame) => {
      if (!frame.dataset.origSrc) {
        frame.dataset.origSrc = frame.getAttribute('src') || '';
      }
    });

    layer().appendChild(el);

    titlebar.querySelector('[data-act="close"]').addEventListener('click', (e) => { e.stopPropagation(); close(id); });
    titlebar.querySelector('[data-act="min"]').addEventListener('click', (e) => { e.stopPropagation(); minimize(id); });
    titlebar.querySelector('[data-act="max"]').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(id); });
    titlebar.addEventListener('mousedown', (e) => startDrag(id, e));
    el.addEventListener('mousedown', () => focus(id));

    const btn = document.createElement('button');
    btn.className = 'win95-btn bevel-out taskbar-win-btn';
    btn.dataset.windowId = id;
    btn.textContent = localizedTitle(def);
    btn.hidden = true; // появляется только когда окно открыто/свёрнуто
    btn.addEventListener('click', () => {
      const w = windows[id];
      if (!w) return;
      if (w.minimized || !w.opened) { open(id); }
      else if (focused === id) { minimize(id); }
      else { focus(id); }
    });
    taskbarRow().appendChild(btn);

    windows[id] = { el, taskbarBtn: btn, minimized: false, opened: false, maximized: false, prevRect: null };
    return windows[id];
  }

  function get(id) { return windows[id] || build(id); }

  function open(id) {
    const w = get(id);
    if (!w) return;
    const wasOpen = w.opened && !w.minimized;
    // Если окно было закрыто — восстановить iframe (перезапуск «процесса»)
    if (!w.opened) {
      reloadFrames(w.el);
    }
    w.el.classList.remove('hidden-window');
    w.opened = true;
    w.minimized = false;
    w.taskbarBtn.hidden = false;
    focus(id);
    if (!wasOpen && typeof CS !== 'undefined' && CS.Audio && typeof state !== 'undefined') {
      const openSound = ({ casino: 'slot_spin', bank: 'bank', invest: 'invest', mail: 'mail' })[id] || 'open';
      CS.Audio.play(state, openSound);
    }
    // мини-анимация «загрузки» приложения
    w.el.classList.remove('app-booting');
    void w.el.offsetWidth;
    w.el.classList.add('app-booting');
    setTimeout(() => w.el.classList.remove('app-booting'), 450);
    if (id === 'settings' && typeof bindSettingsUI === 'function') {
      setTimeout(bindSettingsUI, 0);
    }
  }

  function close(id) {
    const w = windows[id];
    if (!w) return;
    w.el.classList.add('hidden-window');
    w.opened = false;
    w.minimized = false;
    w.maximized = false;
    w.taskbarBtn.classList.remove('focused');
    w.taskbarBtn.hidden = true; // убираем из таскбара — процесс завершён
    if (focused === id) focused = null;
    // Реальная выгрузка «процесса» — останавливает тики/таймеры внутри iframe
    unloadFrames(w.el);
    if (typeof CS !== 'undefined' && CS.Audio && typeof state !== 'undefined') {
      CS.Audio.play(state, 'close');
    }
  }

  function minimize(id) {
    const w = windows[id];
    if (!w) return;
    w.el.classList.add('hidden-window');
    w.minimized = true;
    w.taskbarBtn.hidden = false;
    w.taskbarBtn.classList.remove('focused');
    if (focused === id) focused = null;
  }

  function toggleMaximize(id) {
    const w = windows[id];
    if (!w) return;
    const root = document.getElementById('desktopRoot');
    if (!w.maximized) {
      w.prevRect = { left: w.el.style.left, top: w.el.style.top, width: w.el.style.width, height: w.el.style.height };
      w.el.style.left = '4px';
      w.el.style.top = '4px';
      w.el.style.width = (root.clientWidth - 8) + 'px';
      w.el.style.height = (root.clientHeight - 8) + 'px';
      w.maximized = true;
    } else {
      Object.assign(w.el.style, w.prevRect);
      w.maximized = false;
    }
  }

  function focus(id) {
    const w = windows[id];
    if (!w || !w.opened) return;
    topZ += 1;
    w.el.style.zIndex = topZ;
    focused = id;
    Object.keys(windows).forEach((k) => windows[k].taskbarBtn.classList.toggle('focused', k === id));
  }

  function startDrag(id, e) {
    if (e.target.closest('.dots')) return;
    if (e.button !== 0) return;
    const w = windows[id];
    if (!w) return;
    // Не тащим максимизированное окно
    if (w.maximized) return;
    e.preventDefault();
    focus(id);
    const el = w.el;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(el.style.left, 10) || 0;
    const startTop = parseInt(el.style.top, 10) || 0;
    el.classList.add('dragging');

    function onMove(ev) {
      const root = document.getElementById('desktopRoot');
      if (!root) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let left = startLeft + dx;
      let top = startTop + dy;
      left = Math.max(-40, Math.min(left, root.clientWidth - 60));
      top = Math.max(0, Math.min(top, root.clientHeight - 40));
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    }
    function onUp() {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // если фокус окна потерян — не оставляем «залипший» drag
    window.addEventListener('blur', onUp);
  }

  function bindDesktopIcon(icon) {
    if (!icon || icon.dataset.wmBound) return;
    icon.dataset.wmBound = '1';
    const id = icon.dataset.window;
    icon.setAttribute('draggable', 'false');
    icon.setAttribute('tabindex', '0');
    icon.addEventListener('dragstart', (e) => e.preventDefault());
    icon.addEventListener('dblclick', (e) => {
      e.preventDefault();
      open(id);
    });
    icon.addEventListener('click', () => {
      document.querySelectorAll('.desktop-icon').forEach((i) => i.classList.remove('selected'));
      icon.classList.add('selected');
    });
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(id); }
    });
  }

  function initIcons() {
    document.querySelectorAll('.desktop-icon').forEach(bindDesktopIcon);
    // Клик по пустому месту рабочего стола — снять выделение с иконок
    const root = document.getElementById('desktopRoot') || document.querySelector('.desktop');
    if (root && !root.dataset.iconDeselectBound) {
      root.dataset.iconDeselectBound = '1';
      root.addEventListener('mousedown', (e) => {
        if (e.target.closest('.desktop-icon') || e.target.closest('.floating-window')) return;
        document.querySelectorAll('.desktop-icon.selected').forEach((i) => i.classList.remove('selected'));
      });
    }
  }

  function autoOpenDefaults() {
    AUTO_OPEN.forEach((id) => open(id));
    if (location.hash === '#casino') { open('casino'); focus('casino'); }
    if (location.hash === '#invest') { open('invest'); focus('invest'); }
  }

  function isOpen(id) {
    const w = windows[id];
    return !!(w && w.opened && !w.minimized);
  }

  return { open, close, minimize, focus, initIcons, autoOpenDefaults, isOpen, DEFS };
})();
