// ============================================================================
// Почта.exe — почтовый клиент в стиле Outlook Express
// ============================================================================

let state = null;
let currentFolder = 'inbox';
let selectedId = null;

async function init() {
  try {
    state = await CS.loadState();
    CS.ensureMail(state);

    // Приветственное письмо один раз
    if (!state.mail.messages.length) {
      CS.notifyMail(state, 'welcome');
      CS.saveState(state);
    }

    bindUi();
    renderAll();

    CS.onStateChanged((ns) => {
      state = ns;
      CS.ensureMail(state);
      renderAll();
    });
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function bindUi() {
  document.querySelectorAll('.folder-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFolder = btn.dataset.folder;
      selectedId = null;
      document.querySelectorAll('.folder-item').forEach((b) => b.classList.toggle('active', b.dataset.folder === currentFolder));
      renderList();
      renderView();
      updateToolbar();
    });
  });

  document.getElementById('btnCompose').addEventListener('click', openCompose);
  document.getElementById('composeClose').addEventListener('click', closeCompose);
  document.getElementById('composeCancel').addEventListener('click', closeCompose);
  document.getElementById('composeSend').addEventListener('click', onSend);
  document.getElementById('btnDelete').addEventListener('click', onDelete);
  document.getElementById('btnSpam').addEventListener('click', onSpam);
  document.getElementById('btnReply').addEventListener('click', onReply);
  document.getElementById('btnRefresh').addEventListener('click', async () => {
    state = await CS.loadState();
    CS.maybeGenerateSystemMail(state);
    CS.saveState(state);
    renderAll();
  });
  document.getElementById('btnAddFilter').addEventListener('click', onAddFilter);
}

function messagesIn(folder) {
  return (state.mail.messages || []).filter((m) => m.folder === folder);
}

function renderAll() {
  renderCounts();
  renderFilters();
  renderList();
  renderView();
  updateToolbar();
}

function renderCounts() {
  ['inbox', 'sent', 'spam', 'trash', 'drafts'].forEach((f) => {
    const el = document.getElementById('cnt-' + f);
    if (!el) return;
    const list = messagesIn(f);
    const unread = list.filter((m) => !m.read).length;
    el.textContent = unread ? `(${unread})` : list.length ? `(${list.length})` : '';
  });
  const inboxUnread = messagesIn('inbox').filter((m) => !m.read).length;
  document.getElementById('unreadCount').textContent = inboxUnread;
}

function renderFilters() {
  const box = document.getElementById('filterList');
  box.innerHTML = '';
  (state.mail.filters || []).forEach((f) => {
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.innerHTML = `<span>«${escapeHtml(f.keyword)}» → ${f.folder}</span><button title="Удалить">×</button>`;
    row.querySelector('button').addEventListener('click', async () => {
      state = await CS.loadState();
      CS.removeMailFilter(state, f.keyword);
      CS.saveState(state);
      renderAll();
    });
    box.appendChild(row);
  });
}

function renderList() {
  const list = document.getElementById('mailList');
  list.innerHTML = '';
  const msgs = messagesIn(currentFolder).slice().sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  if (!msgs.length) {
    list.innerHTML = '<div style="padding:12px;font-size:11px;color:#888;">Папка пуста</div>';
    return;
  }

  msgs.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'mail-row' + (m.read ? '' : ' unread') + (m.id === selectedId ? ' selected' : '');
    const date = formatDate(m.time);
    const from = currentFolder === 'sent' ? (m.to || '') : (m.from || '');
    row.innerHTML = `
      <span class="col-from" title="${escapeHtml(from)}">${escapeHtml(shorten(from, 18))}</span>
      <span class="col-subj" title="${escapeHtml(m.subject)}">${escapeHtml(m.subject || '(без темы)')}</span>
      <span class="col-date">${date}</span>`;
    row.addEventListener('click', async () => {
      selectedId = m.id;
      state = await CS.loadState();
      CS.markMailRead(state, m.id);
      CS.saveState(state);
      renderList();
      renderView();
      updateToolbar();
      renderCounts();
    });
    list.appendChild(row);
  });
}

function renderView() {
  const view = document.getElementById('mailView');
  const m = (state.mail.messages || []).find((x) => x.id === selectedId);
  if (!m) {
    view.innerHTML = '<div class="mail-view-empty">Выберите письмо</div>';
    return;
  }
  view.innerHTML = `
    <div class="mail-view-header">
      <div class="subj">${escapeHtml(m.subject || '(без темы)')}</div>
      <div class="meta">
        От: ${escapeHtml(m.from)}<br>
        Кому: ${escapeHtml(m.to)}<br>
        Дата: ${formatDate(m.time, true)}
      </div>
    </div>
    <div class="mail-view-body">${escapeHtml(m.body || '')}</div>`;
}

function updateToolbar() {
  const has = selectedId != null;
  document.getElementById('btnDelete').disabled = !has;
  document.getElementById('btnSpam').disabled = !has || currentFolder === 'spam';
  document.getElementById('btnReply').disabled = !has || currentFolder === 'sent';
}

async function onDelete() {
  if (selectedId == null) return;
  state = await CS.loadState();
  CS.deleteMail(state, selectedId);
  selectedId = null;
  CS.saveState(state);
  renderAll();
}

async function onSpam() {
  if (selectedId == null) return;
  state = await CS.loadState();
  CS.moveMail(state, selectedId, 'spam');
  selectedId = null;
  CS.saveState(state);
  renderAll();
}

function onReply() {
  const m = (state.mail.messages || []).find((x) => x.id === selectedId);
  if (!m) return;
  openCompose();
  document.getElementById('composeTo').value = m.from || '';
  document.getElementById('composeSubject').value = 'Re: ' + (m.subject || '');
  document.getElementById('composeBody').value = '\n\n--- Исходное сообщение ---\n' + (m.body || '');
}

function openCompose() {
  document.getElementById('composeOverlay').classList.remove('hidden');
  document.getElementById('composeTo').value = '';
  document.getElementById('composeSubject').value = '';
  document.getElementById('composeBody').value = '';
}

function closeCompose() {
  document.getElementById('composeOverlay').classList.add('hidden');
}

async function onSend() {
  const to = document.getElementById('composeTo').value.trim();
  const subject = document.getElementById('composeSubject').value.trim();
  const body = document.getElementById('composeBody').value;
  if (!to) {
    document.getElementById('composeTo').focus();
    return;
  }
  state = await CS.loadState();
  CS.sendMail(state, to, subject, body);
  CS.saveState(state);
  closeCompose();
  currentFolder = 'sent';
  document.querySelectorAll('.folder-item').forEach((b) => b.classList.toggle('active', b.dataset.folder === 'sent'));
  renderAll();
}

async function onAddFilter() {
  const kw = document.getElementById('filterKeyword').value.trim();
  if (!kw) return;
  state = await CS.loadState();
  CS.addMailFilter(state, kw, 'spam');
  CS.saveState(state);
  document.getElementById('filterKeyword').value = '';
  renderAll();
}

function formatDate(iso, full) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (full) return d.toLocaleString('ru-RU');
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return '';
  }
}

function shorten(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
