// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Почтовый клиент ----
// ============================================================================
// Почтовый клиент — системные письма, спам, фильтры
// ============================================================================

CS.ensureMail = function (state) {
  if (!state.mail || typeof state.mail !== 'object') {
    state.mail = { messages: [], nextId: 1, filters: [], lastSystemAt: 0, pushQueue: [] };
  }
  if (!Array.isArray(state.mail.messages)) state.mail.messages = [];
  if (!Array.isArray(state.mail.filters)) state.mail.filters = [];
  if (!Array.isArray(state.mail.pushQueue)) state.mail.pushQueue = [];
  if (typeof state.mail.nextId !== 'number') state.mail.nextId = 1;
  return state.mail;
};

/** Непрочитанные во входящих (или в указанной папке) */
CS.unreadMailCount = function (state, folder) {
  folder = folder || 'inbox';
  return CS.ensureMail(state).messages.filter((m) => m.folder === folder && !m.read).length;
};

/** Добавить письмо. folder: inbox | spam | sent | trash | drafts */
CS.addMail = function (state, opts) {
  const mail = CS.ensureMail(state);
  const id = mail.nextId++;
  const msg = {
    id,
    from: opts.from || 'system@cash.stream',
    to: opts.to || 'you@cash.stream',
    subject: opts.subject || '(без темы)',
    body: opts.body || '',
    folder: opts.folder || 'inbox',
    read: !!opts.read,
    starred: !!opts.starred,
    time: opts.time || new Date().toISOString(),
    tags: opts.tags || [],
    // Сделка с заказчиком биржи: orderUid + кнопки быстрого ответа
    deal: opts.deal || null
  };

  // Простые фильтры: по from/subject → папка
  for (const f of mail.filters) {
    const hay = ((msg.from || '') + ' ' + (msg.subject || '')).toLowerCase();
    if (f.keyword && hay.includes(String(f.keyword).toLowerCase())) {
      msg.folder = f.folder || 'spam';
      break;
    }
  }

  mail.messages.unshift(msg);
  if (mail.messages.length > 120) mail.messages = mail.messages.slice(0, 120);

  // Пуш только для непрочитанных входящих (не спам, не sent)
  if (msg.folder === 'inbox' && !msg.read) {
    mail.pushQueue.push({
      id: msg.id,
      from: msg.from,
      subject: msg.subject,
      at: Date.now()
    });
    if (mail.pushQueue.length > 12) mail.pushQueue = mail.pushQueue.slice(-12);
  }

  return msg;
};

/** Забрать очередь пушей (для рабочего стола). Очищает очередь. */
CS.consumeMailPush = function (state) {
  const mail = CS.ensureMail(state);
  const q = mail.pushQueue.slice();
  mail.pushQueue = [];
  return q;
};

CS.markMailRead = function (state, id) {
  const mail = CS.ensureMail(state);
  const m = mail.messages.find((x) => x.id === id);
  if (m) m.read = true;
  return m;
};

CS.moveMail = function (state, id, folder) {
  const mail = CS.ensureMail(state);
  const m = mail.messages.find((x) => x.id === id);
  if (m) m.folder = folder;
  return m;
};

CS.deleteMail = function (state, id) {
  const mail = CS.ensureMail(state);
  const m = mail.messages.find((x) => x.id === id);
  if (!m) return false;
  if (m.folder === 'trash') {
    mail.messages = mail.messages.filter((x) => x.id !== id);
  } else {
    m.folder = 'trash';
  }
  return true;
};

CS.sendMail = function (state, to, subject, body) {
  const mail = CS.ensureMail(state);
  const msg = CS.addMail(state, {
    from: 'you@cash.stream',
    to: to || 'unknown@cash.stream',
    subject: subject || '(без темы)',
    body: body || '',
    folder: 'sent',
    read: true
  });
  // Иногда приходит автоответ
  if (Math.random() < 0.35) {
    setTimeout(() => {}, 0); // placeholder — реальный ответ генерируется при следующем tick/open
    mail._pendingReply = {
      to: 'you@cash.stream',
      from: to || 'noreply@cash.stream',
      subject: 'Re: ' + (subject || ''),
      body: 'Спасибо за обращение. Мы рассмотрим ваш запрос в порядке очереди.\n\n— Автоответчик'
    };
  }
  return msg;
};

CS.addMailFilter = function (state, keyword, folder) {
  const mail = CS.ensureMail(state);
  const kw = String(keyword || '').trim();
  if (!kw) return false;
  if (mail.filters.some((f) => f.keyword.toLowerCase() === kw.toLowerCase())) return false;
  mail.filters.push({ keyword: kw, folder: folder || 'spam' });
  // Применить к уже существующим
  mail.messages.forEach((m) => {
    const hay = ((m.from || '') + ' ' + (m.subject || '')).toLowerCase();
    if (hay.includes(kw.toLowerCase()) && m.folder === 'inbox') {
      m.folder = folder || 'spam';
    }
  });
  return true;
};

CS.removeMailFilter = function (state, keyword) {
  const mail = CS.ensureMail(state);
  mail.filters = mail.filters.filter((f) => f.keyword.toLowerCase() !== String(keyword).toLowerCase());
};

/** Системные письма по событиям игры (вызывается из tick / действий) */
CS.maybeGenerateSystemMail = function (state) {
  const mail = CS.ensureMail(state);
  const now = Date.now();
  // Не чаще раза в ~25 сек
  if (now - (mail.lastSystemAt || 0) < 25000) return;
  mail.lastSystemAt = now;

  const roll = Math.random();

  // Отложенный автоответ
  if (mail._pendingReply) {
    const r = mail._pendingReply;
    delete mail._pendingReply;
    CS.addMail(state, { from: r.from, to: r.to, subject: r.subject, body: r.body, folder: 'inbox' });
    return;
  }

  if (state.debt > 200 && roll < 0.22) {
    CS.addMail(state, {
      from: 'kolektory@dolg.cash',
      subject: '⚠️ Задолженность: требуется погашение',
      body: `Уважаемый клиент!\n\nПо состоянию на сегодня ваш долг составляет ${Math.floor(state.debt)}💰.\nРекомендуем погасить задолженность, чтобы избежать роста процентов и стресса.\n\n— Служба взыскания КЭШ.СТРИМ`,
      folder: 'inbox',
      tags: ['debt']
    });
  } else if ((state.taxRisk || 0) > 40 && roll < 0.25) {
    CS.addMail(state, {
      from: 'fns@nalog.cash',
      subject: 'Уведомление ФНС: риск внеплановой проверки',
      body: `Информируем, что по вашей деятельности зафиксирован повышенный налоговый риск (${Math.floor(state.taxRisk)}).\n\nРекомендуем оформить регистрацию (самозанятость / ИП / ООО) в программе «Отчетность.exe», чтобы снизить вероятность штрафа.\n\n— Федеральная налоговая служба (игровой симулятор)`,
      folder: 'inbox',
      tags: ['tax']
    });
  } else if (state.interns > 0 && roll < 0.12) {
    CS.addMail(state, {
      from: 'hr@kadry.cash',
      subject: 'Отчёт по стажёрам',
      body: `Нанято стажёров: ${state.interns}.\nПассивный доход: ~${(state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1)}💰/с.\n\nНе забывайте оформлять сотрудников официально при росте штата.\n\n— Отдел кадров`,
      folder: 'inbox',
      tags: ['hr']
    });
  } else if (roll < 0.08) {
    // Спам
    const spam = [
      { from: 'promo@viagra.biz', subject: '🔥 СРОЧНО: увеличьте клики в 10 раз!!!', body: 'Специальное предложение только сегодня. Переведите 50💰 на счёт…' },
      { from: 'nigerian@prince.ml', subject: 'Наследство 1 000 000💰', body: 'Я принц далёкой страны. Переведите небольшой аванс, и получите миллион.' },
      { from: 'crypto-pump@scam.io', subject: 'Монета x100 за сутки', body: 'Купите токен CASHMOON до полуночи. Не финансовый совет.' },
      { from: 'lottery@win.cash', subject: 'Вы выиграли iPhone 95!', body: 'Поздравляем! Для получения приза оплатите доставку 29💰.' }
    ];
    const s = spam[Math.floor(Math.random() * spam.length)];
    CS.addMail(state, { from: s.from, subject: s.subject, body: s.body, folder: 'spam', tags: ['spam'] });
  } else if (roll < 0.15 && state.level >= 2) {
    CS.addMail(state, {
      from: 'arenda@office.cash',
      subject: CS.t ? CS.t('mail.rent_rem.subj') : 'Rent',
      body: CS.t ? CS.t('mail.rent_rem.body', { ticks: CS.CONFIG.RENT_INTERVAL_TICKS, level: state.level }) : '',
      folder: 'inbox',
      tags: ['rent']
    });
  }
};

/** Вызвать после важных действий (наём, апгрейд, штраф) */
CS.notifyMail = function (state, kind, extra) {
  CS.ensureMail(state);
  if (kind === 'hire') {
    CS.addMail(state, {
      from: 'hr@kadry.cash',
      subject: CS.t ? CS.t('mail.hire.subj', { n: state.interns }) : ('Intern #' + state.interns),
      body: CS.t ? CS.t('mail.hire.body', { n: state.interns, income: (state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1), extra: extra || '' }) : (extra || ''),
      folder: 'inbox',
      tags: ['hr']
    });
  } else if (kind === 'hire_pm') {
    CS.addMail(state, {
      from: 'hr@kadry.cash',
      subject: CS.t ? CS.t('mail.hire_pm.subj', { n: state.projectManagers }) : ('PM #' + state.projectManagers),
      body: CS.t ? CS.t('mail.hire_pm.body', { n: state.projectManagers, extra: extra || '' }) : (extra || ''),
      folder: 'inbox',
      tags: ['hr']
    });
  } else if (kind === 'equip') {
    CS.addMail(state, {
      from: 'shop@office.market',
      subject: CS.t ? CS.t('mail.equip.subj', { n: state.equipLevel }) : ('Equip ' + state.equipLevel),
      body: CS.t ? CS.t('mail.equip.body', { bonus: (state.equipLevel * CS.CONFIG.EQUIP_CLICK_BONUS).toFixed(1) }) : '',
      folder: 'inbox',
      tags: ['shop']
    });
  } else if (kind === 'coffee') {
    CS.addMail(state, {
      from: 'shop@office.market',
      subject: CS.t ? CS.t('mail.coffee.subj', { n: state.coffeeLevel }) : ('Coffee ' + state.coffeeLevel),
      body: CS.t ? CS.t('mail.coffee.body', { n: state.coffeeLevel }) : '',
      folder: 'inbox',
      tags: ['shop']
    });
  } else if (kind === 'tax_fine') {
    CS.addMail(state, {
      from: 'fns@nalog.cash',
      subject: CS.t ? CS.t('mail.tax.subj') : 'Tax fine',
      body: extra || (CS.t ? CS.t('mail.tax.body') : ''),
      folder: 'inbox',
      tags: ['tax']
    });
  } else if (kind === 'welcome') {
    CS.addMail(state, {
      from: 'support@cash.stream',
      subject: CS.t ? CS.t('mail.welcome.subj') : 'Welcome',
      body: CS.t ? CS.t('mail.welcome.body') : '',
      folder: 'inbox',
      tags: ['system']
    });
  }
};
