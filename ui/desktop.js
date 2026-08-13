// ============================================================================
// Рабочий стол: иконки установленных приложений, почта (бейдж/тосты),
// меню СТАРТ, boot-экран, часы.
// ============================================================================

const _shownMailPushIds = new Set();

function syncInstalledAppIcons() {
  if (!state) return;
  const container = document.getElementById('desktopIcons');
  if (!container) return;
  const hint = container.querySelector('.desktop-hint');
  const installed = (state.apps && state.apps.installed) || [];

  installed.forEach((id) => {
    const def = CS.APP_CATALOG.find((a) => a.id === id);
    if (!def || !def.addsIcon) return;
    if (container.querySelector(`.desktop-icon[data-window="${id}"]`)) return;

    const btn = document.createElement('button');
    btn.className = 'desktop-icon';
    btn.dataset.window = id;
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('draggable', 'false');
    btn.innerHTML = `<span class="icon-glyph">${def.icon}</span><span class="icon-label">${def.name}.exe</span>`;

    btn.addEventListener('dragstart', (e) => e.preventDefault());
    btn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      WM.open(id);
    });
    btn.addEventListener('click', () => {
      container.querySelectorAll('.desktop-icon').forEach((i) => i.classList.remove('selected'));
      btn.classList.add('selected');
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); WM.open(id); }
    });
    btn.dataset.wmBound = '1';

    container.insertBefore(btn, hint);
  });

  syncMailBadge();
}

// ============================================================================
// Почта: бейдж непрочитанных + пуш-уведомления
// ============================================================================

function syncMailBadge() {
  if (!state) return;
  const unread = CS.unreadMailCount(state, 'inbox');
  const mailInstalled = CS.isAppInstalled(state, 'mail');

  const icon = document.querySelector('.desktop-icon[data-window="mail"]');
  if (icon) {
    let badge = icon.querySelector('.mail-badge');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mail-badge';
        icon.appendChild(badge);
      }
      badge.hidden = false;
      badge.textContent = unread > 99 ? '99+' : String(unread);
    } else if (badge) {
      badge.hidden = true;
    }
  }

  const tray = document.getElementById('trayMail');
  const trayBadge = document.getElementById('trayMailBadge');
  if (tray && trayBadge) {
    if (mailInstalled && unread > 0) {
      tray.hidden = false;
      trayBadge.textContent = unread > 99 ? '99+' : String(unread);
      tray.title = `Почта: ${unread} непрочитанн${unread === 1 ? 'ое' : 'ых'}`;
    } else {
      tray.hidden = true;
    }
  }

  document.querySelectorAll('#taskbarWindows .taskbar-win-btn').forEach((btn) => {
    if (btn.textContent.indexOf('Почта') !== -1 || btn.dataset.windowId === 'mail') {
      btn.textContent = unread > 0 ? `✉️ Почта (${unread})` : '✉️ Почта';
    }
  });
}

function processMailPush() {
  if (!state) return;
  const mail = CS.ensureMail(state);
  if (!mail.pushQueue || !mail.pushQueue.length) return;

  const queue = CS.consumeMailPush(state);
  const fresh = queue.filter((item) => {
    if (_shownMailPushIds.has(item.id)) return false;
    _shownMailPushIds.add(item.id);
    return true;
  });
  if (_shownMailPushIds.size > 80) {
    const arr = Array.from(_shownMailPushIds);
    arr.slice(0, arr.length - 40).forEach((id) => _shownMailPushIds.delete(id));
  }

  if (!fresh.length) return;

  CS.saveState(state);

  // Смещение относительно ачивок: почта снизу, не в одной куче
  fresh.forEach((item, i) => {
    setTimeout(() => showMailToast(item), i * 450);
  });
  syncMailBadge();
}

function showMailToast(item) {
  const stack = document.getElementById('mailToastStack');
  if (!stack) return;

  const el = document.createElement('div');
  el.className = 'mail-toast';
  el.innerHTML = `
    <div class="toast-titlebar">
      <span>✉️ Новое сообщение</span>
      <span class="toast-close" title=(CS.t ? CS.t('common.close') : "Закрыть")>×</span>
    </div>
    <div class="toast-body">
      <div class="toast-from">${escapeToast(item.from || '')}</div>
      <div class="toast-subj">${escapeToast(item.subject || '(без темы)')}</div>
    </div>`;

  const close = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };

  if (CS.Audio && state) CS.Audio.play(state, 'mail');

  el.querySelector('.toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  el.addEventListener('click', () => {
    close();
    if (CS.isAppInstalled(state, 'mail')) {
      WM.open('mail');
    }
  });

  stack.appendChild(el);
  setTimeout(close, 6000);
}

function escapeToast(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Boot / Start menu / Clock
// ============================================================================

function runBootSequence() {
  return new Promise((resolve) => {
    const screen = document.getElementById('bootScreen');
    const fill = document.getElementById('bootFill');
    const log = document.getElementById('bootLog');
    if (!screen) { resolve(); return; }
    screen.hidden = false;
    screen.classList.remove('boot-done');
    const steps = [
      'POST: memory OK',
      'Detecting mouse…',
      'Loading HIMEM.SYS',
      'Starting KESH.STREAM…',
      'Initializing desktop…',
      'Welcome'
    ];
    let i = 0;
    if (CS.Audio) CS.Audio.play(state, 'boot');
    const tickBoot = () => {
      if (log) log.textContent = steps[Math.min(i, steps.length - 1)];
      if (fill) fill.style.width = Math.round(((i + 1) / steps.length) * 100) + '%';
      i += 1;
      if (i >= steps.length) {
        setTimeout(() => {
          screen.classList.add('boot-done');
          setTimeout(() => {
            screen.hidden = true;
            resolve();
          }, 350);
        }, 280);
        return;
      }
      setTimeout(tickBoot, 280 + Math.random() * 120);
    };
    tickBoot();
  });
}

function setupStartMenu() {
  const btn = document.getElementById('startBtn');
  const menu = document.getElementById('startMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    if (open && CS.Audio) CS.Audio.play(state, 'ui');
  });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', (e) => e.stopPropagation());
  menu.querySelectorAll('.start-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.start;
      menu.hidden = true;
      if (id) WM.open(id);
    });
  });
}

function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const d = new Date();
  el.textContent =
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}
