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
  const all = state.mail.messages || [];
  if (folder === 'deals') {
    return all.filter((m) => m.folder === 'inbox' && m.deal && (m.deal.thread || m.deal.orderUid));
  }
  return all.filter((m) => m.folder === folder);
}

function renderAll() {
  renderCounts();
  renderFilters();
  renderList();
  renderView();
  updateToolbar();
}

function renderCounts() {
  ['inbox', 'deals', 'sent', 'spam', 'trash', 'drafts'].forEach((f) => {
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
    list.innerHTML = '<div style="padding:12px;font-size:11px;color:#888;">' + (CS.t ? CS.t('mail.empty_folder') : '') + '</div>';
    return;
  }

  msgs.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'mail-row' + (m.read ? '' : ' unread') + (m.id === selectedId ? ' selected' : '') + (m.deal ? ' deal-row' : '');
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

function renderThreadHtml(deal) {
  const msgs = deal.messages || [];
  const name = deal.clientName || (CS.t ? CS.t('mail.client') : 'Client');
  const avatar = deal.clientAvatar || '👤';
  let html = '<div class="thread-head">' +
    '<div class="thread-title">💬 ' + escapeHtml(deal.title || (CS.t ? CS.t('mail.deal') : 'Deal')) + '</div>' +
    '<div class="thread-meta">' + escapeHtml(avatar + ' ' + name) +
    (deal.reward != null ? ' · ' + deal.reward + '💰' : '') +
    (deal.deadlineMax != null ? ' · ⏱ ' + deal.deadlineMax + 'с' : '') +
    ' · ' + (deal.phase === 'negotiating' ? (CS.t ? CS.t('mail.phase_nego') : 'nego') : (deal.phase === 'active' ? (CS.t ? CS.t('mail.phase_work') : 'work') : deal.phase || '')) +
    '</div></div>';
  html += '<div class="thread-list">';
  if (!msgs.length) {
    html += (CS.t ? CS.t('m.ca0a765a44') : '<div class="thread-empty">Пока нет сообщений</div>');
  } else {
    msgs.forEach((msg) => {
      const mine = msg.from === 'me';
      html += '<div class="thread-bubble ' + (mine ? 'me' : 'npc') + '">' +
        '<div class="thread-who">' + (mine ? (CS.t ? CS.t('mail.you') : 'You') : escapeHtml(name)) +
        '<span class="thread-time">' + escapeHtml(msg.time || '') + '</span></div>' +
        '<div class="thread-text">' + escapeHtml(msg.text || '').replace(/\n/g, '<br>') + '</div>' +
        '</div>';
    });
  }
  html += '</div>';
  return html;
}

function renderView() {
  const view = document.getElementById('mailView');
  const m = (state.mail.messages || []).find((x) => x.id === selectedId);
  if (!m) {
    view.innerHTML = '<div class="mail-view-empty">' + (CS.t ? CS.t('mail.pick') : '') + '</div>';
    return;
  }
  let actionsHtml = '';
  if (m.deal && m.deal.actions && m.deal.actions.length && m.folder === 'inbox') {
    actionsHtml = '<div class="mail-deal-actions">' +
      (CS.t ? CS.t('m.4ddcd36d59') : '<div class="mail-deal-hint">Быстрый ответ в треде:</div>') +
      m.deal.actions.map((a) =>
        '<button type="button" class="win95-btn bevel-out mail-deal-btn" data-deal-action="' +
        escapeHtml(a.id) + '" data-mail-id="' + m.id + '">' + escapeHtml(a.label) + '</button>'
      ).join(' ') +
      '</div>';
  }

  const isThread = m.deal && (m.deal.thread || (m.deal.messages && m.deal.messages.length));
  const bodyHtml = isThread
    ? renderThreadHtml(m.deal)
    : '<div class="mail-view-body">' + escapeHtml(m.body || '').replace(/\n/g, '<br>') + '</div>';

  view.innerHTML = `
    <div class="mail-view-header">
      <div class="subj">${escapeHtml(m.subject || '(без темы)')}</div>
      <div class="meta">
        От: ${escapeHtml(m.from)}<br>
        Кому: ${escapeHtml(m.to)}<br>
        Дата: ${formatDate(m.time, true)}
      </div>
    </div>
    ${bodyHtml}
    ${actionsHtml}`;

  view.querySelectorAll('[data-deal-action]').forEach((btn) => {
    btn.addEventListener('click', onDealAction);
  });
  const list = view.querySelector('.thread-list');
  if (list) list.scrollTop = list.scrollHeight;
}

async function onDealAction(e) {
  const btn = e.currentTarget;
  const actionId = btn.getAttribute('data-deal-action');
  const mailId = Number(btn.getAttribute('data-mail-id'));
  state = await CS.loadState();
  if (typeof CS.handleMailDealAction !== 'function') return;
  const r = CS.handleMailDealAction(state, mailId, actionId);
  CS.saveState(state);
  renderAll();
  if (r && r.started) {
    // лёгкая подсказка в теме не нужна
  }
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
