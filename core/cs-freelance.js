// КЭШ.СТРИМ — биржа: переговоры, торг, рейтинг, штрафы, помощь стажёров
var CS = window.CS || (window.CS = {});

CS.CLIENTS = [
  { id: 'anna', name: 'Анна К.', role: 'маркетолог', avatar: '👩‍💼', tone: 'polite', flexibility: 0.7 },
  { id: 'igor', name: 'Игорь П.', role: 'стартапер', avatar: '🧔', tone: 'rush', flexibility: 0.35 },
  { id: 'olga', name: 'Ольга М.', role: 'HR', avatar: '👩', tone: 'formal', flexibility: 0.55 },
  { id: 'max', name: 'Макс Д.', role: 'тимлид', avatar: '🧑‍💻', tone: 'tech', flexibility: 0.5 },
  { id: 'rita', name: 'Рита С.', role: 'магазин', avatar: '🛒', tone: 'simple', flexibility: 0.65 },
  { id: 'boss', name: 'Сергей В.', role: 'заказчик', avatar: '👔', tone: 'strict', flexibility: 0.25 }
];

CS.ORDER_TEMPLATES = [
  {
    id: 'tz_fix',
    title: 'Правки по ТЗ',
    brief: 'Вчера прислали ТЗ. Нужно вычитать, согласовать объём и собрать КП.',
    rewardBase: 160,
    deadlineTicks: 200,
    penaltyShare: 0.25,
    steps: [
      { type: 'find', text: 'Найдите ошибки в техзадании', target: 3 },
      { type: 'chat', text: 'Согласуйте финальный объём в чате', target: 1 },
      { type: 'puzzle', text: 'Соберите КП по возрастанию цены', target: 4 }
    ]
  },
  {
    id: 'deadline_land',
    title: 'Лендинг «вчера»',
    brief: 'Одностраничник ASAP. Доверстать, поймать баг, закрыть статус.',
    rewardBase: 200,
    deadlineTicks: 160,
    penaltyShare: 0.35,
    steps: [
      { type: 'tap', text: 'Доверстайте блоки лендинга', target: 55 },
      { type: 'find', text: 'Найдите баг во вёрстке', target: 3 },
      { type: 'chat', text: 'Пришлите статус и ссылку на превью', target: 1 }
    ]
  },
  {
    id: 'report_year',
    title: 'Годовой отчёт',
    brief: 'Свести цифры, собрать смету, вычитать презентацию.',
    rewardBase: 220,
    deadlineTicks: 240,
    penaltyShare: 0.3,
    steps: [
      { type: 'tap', text: 'Сведите таблицы', target: 50 },
      { type: 'puzzle', text: 'Соберите смету по возрастанию', target: 4 },
      { type: 'find', text: 'Найдите опечатку в презентации', target: 3 }
    ]
  },
  {
    id: 'onboard_intern',
    title: 'Онбординг стажёра',
    brief: 'Проверить прайс, инструктаж, ревью кода новичка.',
    rewardBase: 150,
    deadlineTicks: 180,
    penaltyShare: 0.2,
    steps: [
      { type: 'puzzle', text: 'Проверьте прайс по возрастанию', target: 4 },
      { type: 'tap', text: 'Проведите инструктаж', target: 35 },
      { type: 'find', text: 'Найдите лишнюю скобку в коде', target: 3 }
    ]
  },
  {
    id: 'meeting',
    title: 'Срочная планёрка',
    brief: 'Слот, слайды, протокол. Классика офиса.',
    rewardBase: 140,
    deadlineTicks: 150,
    penaltyShare: 0.2,
    steps: [
      { type: 'find', text: 'Найдите свободный слот', target: 3 },
      { type: 'tap', text: 'Подготовьте слайды', target: 40 },
      { type: 'chat', text: 'Разошлите протокол заказчику', target: 1 }
    ]
  },
  {
    id: 'shop_feed',
    title: 'Карточки товара',
    brief: 'Описания, цены, вычитка для интернет-магазина.',
    rewardBase: 175,
    deadlineTicks: 190,
    penaltyShare: 0.25,
    steps: [
      { type: 'tap', text: 'Напишите описания товаров', target: 45 },
      { type: 'puzzle', text: 'Отсортируйте цены по возрастанию', target: 4 },
      { type: 'find', text: 'Найдите битую ссылку', target: 3 }
    ]
  },
  {
    id: 'support_fire',
    title: 'Пожар в поддержке',
    brief: 'Тикеты горят. Разгрести и согласовать тон ответов.',
    rewardBase: 190,
    deadlineTicks: 140,
    penaltyShare: 0.4,
    steps: [
      { type: 'tap', text: 'Закройте тикеты', target: 50 },
      { type: 'chat', text: 'Согласуйте тон ответа с заказчиком', target: 1 },
      { type: 'find', text: 'Найдите критичный баг в логах', target: 3 }
    ]
  }
];


CS.localizeOrder = function (order) {
  if (!order) return order;
  var tid = order.templateId;
  var out = Object.assign({}, order);
  if (tid && CS._i18nHas && CS._i18nHas('ord.' + tid + '.title')) {
    out.title = CS.t('ord.' + tid + '.title');
    if (CS._i18nHas('ord.' + tid + '.brief')) out.brief = CS.t('ord.' + tid + '.brief');
    if (Array.isArray(order.steps)) {
      out.steps = order.steps.map(function (s, i) {
        var key = 'ord.' + tid + '.s' + i;
        var step = Object.assign({}, s);
        if (CS._i18nHas(key)) step.text = CS.t(key);
        return step;
      });
    }
  }
  return out;
};

CS.clientRole = function (client) {
  if (!client) return '';
  var key = 'client.' + client.id + '.role';
  if (CS._i18nHas && CS._i18nHas(key)) return CS.t(key);
  return client.role || '';
};

CS.chatWorkReply = function (index) {
  var key = 'chat.work.' + (index % 4);
  if (CS._i18nHas && CS._i18nHas(key)) return CS.t(key);
  return (CS.CHAT_WORK_REPLIES && CS.CHAT_WORK_REPLIES[index % CS.CHAT_WORK_REPLIES.length]) || '';
};

// Реплики на этапе РАБОТЫ (после подписания)
CS.CHAT_WORK_REPLIES = [
  'Принял, делаю этот этап.',
  'Нужно уточнение по этому пункту — пишу.',
  'Промежуточный результат готов, смотрите.',
  'Закрыл часть, перехожу дальше.'
];

CS.ensureFreelance = function (state) {
  if (!state.freelance || typeof state.freelance !== 'object') {
    state.freelance = {
      board: [],
      active: null,
      done: [],
      tick: 0,
      rating: 50,
      completedCount: 0,
      failedCount: 0
    };
  }
  if (!Array.isArray(state.freelance.board)) state.freelance.board = [];
  if (!Array.isArray(state.freelance.done)) state.freelance.done = [];
  if (typeof state.freelance.tick !== 'number') state.freelance.tick = 0;
  if (typeof state.freelance.rating !== 'number' || Number.isNaN(state.freelance.rating)) {
    state.freelance.rating = 50;
  }
  if (typeof state.freelance.completedCount !== 'number') state.freelance.completedCount = 0;
  if (typeof state.freelance.failedCount !== 'number') state.freelance.failedCount = 0;
  if (state.freelance.active && !Array.isArray(state.freelance.active.chat)) {
    state.freelance.active.chat = [];
  }
  return state.freelance;
};

CS.getClient = function (id) {
  return CS.CLIENTS.find(function (c) { return c.id === id; }) || CS.CLIENTS[0];
};

/** Email заказчика для почтового клиента */
CS.clientEmail = function (clientOrId) {
  var c = typeof clientOrId === 'string' ? CS.getClient(clientOrId) : (clientOrId || CS.CLIENTS[0]);
  var local = String(c.id || 'client').replace(/[^a-z0-9]/gi, '');
  return local + '@client.cash';
};

CS._pick = function (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
};

CS.ratingStars = function (state) {
  var r = CS.ensureFreelance(state).rating;
  return Math.max(1, Math.min(5, Math.round(r / 20 * 10) / 10));
};

CS.adjustRating = function (state, delta) {
  var f = CS.ensureFreelance(state);
  f.rating = Math.max(0, Math.min(100, f.rating + delta));
};

CS.refreshOrderBoard = function (state, force) {
  var f = CS.ensureFreelance(state);
  var need = 4;
  if (!force && f.board.length >= need) return;
  while (f.board.length < need) {
    f.board.push(CS._spawnOrder(state));
  }
};

CS._spawnOrder = function (state) {
  var f = CS.ensureFreelance(state);
  var tpl = CS._pick(CS.ORDER_TEMPLATES);
  var client = CS._pick(CS.CLIENTS);
  var lvl = state.level || 1;
  var ratingMult = 0.85 + (f.rating / 100) * 0.35;
  var reward = Math.round((tpl.rewardBase + lvl * 18 + Math.random() * 40) * ratingMult);
  var deadline = Math.round(tpl.deadlineTicks * (0.9 + Math.random() * 0.25));
  // низкий рейтинг — реже «жирные» заказы
  if (f.rating < 35 && reward > 180 && Math.random() < 0.5) {
    reward = Math.round(reward * 0.75);
  }
  return {
    uid: 'ord_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 9999),
    templateId: tpl.id,
    title: tpl.title,
    brief: tpl.brief,
    offerReward: reward,
    reward: reward,
    deadlineTicks: deadline,
    penaltyShare: tpl.penaltyShare || 0.25,
    clientId: client.id,
    steps: tpl.steps.map(function (s) {
      return { type: s.type, text: s.text, target: s.target };
    })
  };
};

/**
 * Отклик на заказ → фаза переговоров (ещё не работа).
 * status: negotiating | active
 */
CS.acceptOrder = function (state, uid) {
  var f = CS.ensureFreelance(state);
  if (f.active) return { success: false, reason: 'busy' };
  var idx = f.board.findIndex(function (o) { return o.uid === uid; });
  if (idx < 0) return { success: false, reason: 'missing' };
  var order = f.board.splice(idx, 1)[0];
  var client = CS.getClient(order.clientId);

  f.active = {
    uid: order.uid,
    title: order.title,
    brief: order.brief,
    offerReward: order.offerReward,
    reward: order.reward,
    deadlineLeft: order.deadlineTicks,
    deadlineMax: order.deadlineTicks,
    penaltyShare: order.penaltyShare,
    clientId: order.clientId,
    steps: order.steps,
    stepIndex: 0,
    stepProgress: 0,
    chat: [],
    status: 'negotiating',
    nego: {
      askedScope: false,
      askedDeadline: false,
      askedBudget: false,
      offersMade: 0,
      maxOffers: 2
    }
  };

  var locOrder = CS.localizeOrder ? CS.localizeOrder(order) : order;
  var roleStr = CS.clientRole ? CS.clientRole(client) : (client.role || '');
  var body = CS.t
    ? CS.t('nego.mail_hello', {
        title: locOrder.title,
        brief: locOrder.brief,
        reward: order.offerReward,
        deadline: order.deadlineTicks,
        name: client.name,
        role: roleStr
      })
    : (locOrder.title + ' / ' + order.offerReward);

  CS._mailFromClient(state, f.active, {
    subject: (CS.t ? CS.t('nego.mail_subject', { title: (locOrder || order).title }) : ('Order: ' + order.title)),
    body: body,
    withActions: true
  });

  state.history.unshift({
    type: 'quest',
    text: CS.t ? CS.t('nego.hist_mail', { name: client.name, title: (locOrder || order).title }) : client.name,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);
  CS.refreshOrderBoard(state, false);
  return { success: true, order: f.active, openMail: true };
};

CS.declineOrder = function (state, uid) {
  var f = CS.ensureFreelance(state);
  f.board = f.board.filter(function (o) { return o.uid !== uid; });
  CS.refreshOrderBoard(state, false);
  return { success: true };
};

CS._pushChat = function (active, from, text) {
  if (!active || !active.chat) return;
  active.chat.push({
    from: from,
    text: text,
    time: new Date().toLocaleTimeString()
  });
  if (active.chat.length > 50) active.chat = active.chat.slice(-50);
};

/**
 * Одна цепочка переписки на заказ (не засоряет входящие).
 * Все реплики пишутся в active.thread и одно письмо inbox обновляется.
 */
CS._formatThreadBody = function (active) {
  var client = CS.getClient(active.clientId);
  var lines = [
    '══ Переписка по заказу «' + active.title + '» ══',
    'Заказчик: ' + client.name + ' (' + client.role + ')',
    'Статус: ' + (active.status === 'negotiating' ? 'переговоры' : 'в работе') +
      ' · цена ' + active.reward + '💰 · срок ' + (active.deadlineMax || '—') + 'с',
    ''
  ];
  (active.thread || []).forEach(function (m) {
    var who = m.from === 'me' ? 'Вы' : client.name;
    lines.push('[' + m.time + '] ' + who + ':');
    lines.push(m.text);
    lines.push('');
  });
  return lines.join('\n');
};

CS._appendThread = function (active, from, text) {
  if (!active.thread) active.thread = [];
  active.thread.push({
    from: from,
    text: text,
    time: new Date().toLocaleTimeString()
  });
  if (active.thread.length > 30) active.thread = active.thread.slice(-30);
  CS._pushChat(active, from, String(text).split('\n')[0]);
};

/** Найти / создать единственное письмо-тред по uid заказа */
CS._upsertDealThreadMail = function (state, active, withActions) {
  if (!active || typeof CS.addMail !== 'function') return null;
  var client = CS.getClient(active.clientId);
  var mail = CS.ensureMail(state);
  var msg = mail.messages.find(function (m) {
    return m.folder === 'inbox' && m.deal && m.deal.orderUid === active.uid;
  });
  var actions = withActions ? CS.getChatActions(state) : [];
  var deal = {
    orderUid: active.uid,
    phase: active.status,
    thread: true,
    messages: (active.thread || []).map(function (m) {
      return { from: m.from, text: m.text, time: m.time };
    }),
    clientName: client.name,
    clientAvatar: client.avatar,
    title: active.title,
    reward: active.reward,
    deadlineMax: active.deadlineMax,
    actions: (actions || []).map(function (a) {
      return { id: a.id, label: a.label };
    })
  };
  var body = CS._formatThreadBody(active);
  var subject = 'Сделка: ' + active.title + ' — ' + client.name;

  if (msg) {
    msg.body = body;
    msg.subject = subject;
    msg.from = CS.clientEmail(client);
    msg.deal = deal; // всегда храним тред для UI, даже без кнопок
    msg.read = false;
    msg.time = new Date().toISOString();
    msg.tags = ['deal', 'thread', active.uid];
    mail.messages = mail.messages.filter(function (m) { return m.id !== msg.id; });
    mail.messages.unshift(msg);
    if (!msg.read) {
      mail.pushQueue.push({ id: msg.id, from: msg.from, subject: msg.subject, at: Date.now() });
      if (mail.pushQueue.length > 12) mail.pushQueue = mail.pushQueue.slice(-12);
    }
    return msg;
  }

  return CS.addMail(state, {
    from: CS.clientEmail(client),
    to: 'you@cash.stream',
    subject: subject,
    body: body,
    folder: 'inbox',
    tags: ['deal', 'thread', active.uid],
    deal: deal
  });
};

/** Клиент пишет в тред */
CS._mailFromClient = function (state, active, opts) {
  if (!active) return null;
  var text = opts.body || '';
  // убрать подпись из тела для треда — добавим коротко
  CS._appendThread(active, 'npc', text);
  return CS._upsertDealThreadMail(state, active, opts.withActions !== false);
};

/** Игрок пишет в тред (без отдельного sent-спама) */
CS._mailFromPlayer = function (state, active, subject, body) {
  if (!active) return null;
  CS._appendThread(active, 'me', body || '');
  return CS._upsertDealThreadMail(state, active, true);
};

/** Кнопки ответа зависят от фазы (почта + биржа) */
CS.getChatActions = function (state) {
  var f = CS.ensureFreelance(state);
  if (!f.active) return [];
  if (f.active.status === 'negotiating') {
    var n = f.active.nego || {};
    var actions = [];
    if (!n.askedScope) {
      actions.push({ id: 'ask_scope', label: 'Уточнить объём и ТЗ' });
    }
    if (!n.askedDeadline) {
      actions.push({ id: 'ask_deadline', label: 'Уточнить срок' });
    }
    if (!n.askedBudget) {
      actions.push({ id: 'ask_budget', label: 'Обсудить бюджет' });
    }
    // +20% — один раз: либо приняли, либо отказали
    if (!n.offerUpRejected && !n.offerUpAccepted && (n.offersMade || 0) < (n.maxOffers || 2)) {
      actions.push({ id: 'offer_up', label: 'Просить +20% к оплате' });
    }
    if (!n.offerDownDone && (n.offersMade || 0) < (n.maxOffers || 2)) {
      actions.push({ id: 'offer_down', label: '−15% оплаты, +запас срока' });
    }
    actions.push({ id: 'deal_accept', label: '✓ Согласен, берусь на этих условиях' });
    actions.push({ id: 'deal_walk', label: '✗ Отойти от сделки' });
    return actions;
  }
  // работа
  var isLast = f.active.stepIndex >= (f.active.steps.length - 1);
  var step = f.active.steps[f.active.stepIndex];
  if (isLast) {
    return [
      { id: 'work_done_0', label: 'Отправляю результат, проверьте' },
      { id: 'work_done_1', label: 'Всё готово, жду оплату' },
      { id: 'work_done_2', label: 'Сдано. Спасибо за заказ' }
    ];
  }
  // Этап «переписка» — ответы здесь
  if (step && step.type === 'chat') {
    return CS.CHAT_WORK_REPLIES.map(function (label, i) {
      return { id: 'work_' + i, label: label, index: i };
    });
  }
  // find/tap/puzzle — работа в Работа.exe, в почте только подсказка
  return [
    { id: 'work_hint', label: 'Что делать на этом этапе?' }
  ];
};

/** Ответ из письма (кнопка в Почта.exe) */
CS.handleMailDealAction = function (state, mailId, actionId) {
  var mail = CS.ensureMail(state);
  var msg = mail.messages.find(function (m) { return m.id === mailId; });
  if (msg) {
    msg.read = true;
    // кнопки обновятся в _upsertDealThreadMail; тред не затираем
    if (msg.deal) msg.deal.actions = [];
  }
  return CS.handleChatAction(state, actionId);
};

CS._handleNegotiation = function (state, actionId) {
  var f = CS.ensureFreelance(state);
  var a = f.active;
  var client = CS.getClient(a.clientId);
  var flex = client.flexibility != null ? client.flexibility : 0.5;
  var n = a.nego || (a.nego = {});
  var subj = 'Re: Заказ: ' + a.title;

  function playerSays(text) {
    CS._mailFromPlayer(state, a, subj, text + '\n\n' + (CS.t ? CS.t('nego.you') : '— You'));
  }
  function clientSays(text, withActions) {
    CS._mailFromClient(state, a, {
      subject: subj,
      body: text + '\n\n— ' + client.name + ', ' + client.role,
      withActions: !!withActions
    });
  }

  if (actionId === 'ask_scope') {
    playerSays('Можете уточнить объём: что точно входит в ТЗ, а что — за рамками?');
    n.askedScope = true;
    clientSays(CS._pick([
      'В объёме — то, что в брифе. Сложные интеграции, если всплывут, обсудим отдельно.',
      'Делаем строго по описанию. Правки после сдачи — только по доп. согласованию.',
      'Важны результат и сроки. Мелочи согласуем в процессе, без расползания scope.'
    ]), true);
    return { success: true, phase: 'negotiating', mail: true };
  }

  if (actionId === 'ask_deadline') {
    playerSays('Насколько жёсткий дедлайн? Есть ли запас по времени?');
    n.askedDeadline = true;
    var soft = Math.random() < flex;
    if (soft) {
      a.deadlineMax = Math.round(a.deadlineMax * 1.12);
      a.deadlineLeft = a.deadlineMax;
      clientSays('Могу дать небольшой запас — ориентир ~' + a.deadlineMax + ' сек. Но тянуть не стоит.', true);
    } else {
      clientSays('Срок жёсткий: ' + a.deadlineMax + ' сек. Перенос почти невозможен.', true);
    }
    return { success: true, phase: 'negotiating', mail: true };
  }

  if (actionId === 'ask_budget') {
    playerSays('Давайте ещё раз по бюджету — от какой суммы отталкиваемся?');
    n.askedBudget = true;
    clientSays('Стартовое предложение: ' + a.offerReward + '💰. Можем поговорить, если аргументируете.', true);
    return { success: true, phase: 'negotiating', mail: true };
  }

  if (actionId === 'offer_up') {
    if (n.offerUpRejected) {
      clientSays('Я уже писал(а): бюджета больше нет. Берите как есть или отказывайтесь.', true);
      return { success: true, phase: 'negotiating', mail: true };
    }
    playerSays('За этот объём прошу примерно +20% к оплате. Объём не маленький.');
    n.offersMade = (n.offersMade || 0) + 1;
    if (Math.random() < flex * 0.85) {
      var up = Math.round(a.reward * 1.2);
      a.reward = up;
      n.offerUpAccepted = true;
      clientSays('Ладно, уговорили. Фиксируем ' + up + '💰 — но без срыва срока. Повторно сумму не поднимаю.', true);
    } else {
      n.offerUpRejected = true;
      clientSays(CS._pick([
        'Больше бюджета нет. Это окончательно: работаем на текущих условиях или ищу другого.',
        'Не потяну +20%. Сумма закрыта. Можем только про срок (−15% за запас).',
        'Оставляем как есть. Повторные просьбы о надбавке не рассматриваю.'
      ]), true);
    }
    return { success: true, phase: 'negotiating', mail: true };
  }

  if (actionId === 'offer_down') {
    playerSays('Могу взять дешевле (−15%), если дадите запас по сроку.');
    n.offersMade = (n.offersMade || 0) + 1;
    n.offerDownDone = true;
    a.reward = Math.round(a.reward * 0.85);
    a.deadlineMax = Math.round(a.deadlineMax * 1.2);
    a.deadlineLeft = a.deadlineMax;
    clientSays('Договорились: ' + a.reward + '💰 и срок ~' + a.deadlineMax + ' сек. Жду подтверждения старта.', true);
    return { success: true, phase: 'negotiating', mail: true };
  }

  if (actionId === 'deal_accept') {
    // Без отдельного уточнения ТЗ считаем бриф согласованным — работа стартует
    if (!n.askedScope) {
      n.askedScope = true;
      CS._appendThread(a, 'npc',
        'Объём фиксирую сам по брифу (раз отдельно не уточняли):\n«' + a.brief + '»\nДоп. требований нет — этого достаточно, чтобы начать.');
    }
    playerSays(CS.t ? CS.t('nego.p.accept', { reward: a.reward, deadline: a.deadlineMax }) : ('OK ' + a.reward));
    a.status = 'active';
    a.deadlineLeft = a.deadlineMax;
    state.stepIndex = 0;
    state.stepProgress = 0;
    a.stepIndex = 0;
    a.stepProgress = 0;
    CS.prepareStepLayout(state, a.steps[0]);
    var first = a.steps[0];
    var locA = CS.localizeOrder ? CS.localizeOrder(a) : a;
    var firstText = (locA.steps && locA.steps[0] && locA.steps[0].text) || first.text;
    var where = (first.type === 'chat')
      ? (CS.t ? CS.t('nego.c.accept_where_chat') : '')
      : (CS.t ? CS.t('nego.c.accept_where_work') : '');
    clientSays(
      CS.t ? CS.t('nego.c.accept_body', { brief: locA.brief, total: a.steps.length, step: firstText, where: where, deadline: a.deadlineMax })
      : (locA.brief + ' / ' + firstText),
      true
    );
    state.history.unshift({
      type: 'quest',
      text: CS.t ? CS.t('nego.hist.start', { title: locA.title, reward: a.reward }) : locA.title,
      time: new Date().toLocaleTimeString()
    });
    state.history = state.history.slice(0, 20);
    return { success: true, phase: 'active', started: true, mail: true };
  }

  if (actionId === 'deal_walk') {
    playerSays(CS.t ? CS.t('nego.p.walk') : 'walk');
    clientSays(CS.t ? CS.t('nego.c.walk') : 'ok', false);
    CS.adjustRating(state, -1);
    f.active = null;
    CS.refreshOrderBoard(state, false);
    return { success: true, phase: 'none', walked: true, mail: true };
  }

  return { success: false, reason: 'unknown_action' };
};

/**
 * Ответ в фазе работы (почта).
 * На последнем этапе любой ответ → сдача заказа.
 * На chat-этапе в середине — прогресс шага.
 */
CS.replyToClient = function (state, presetIndex) {
  var f = CS.ensureFreelance(state);
  if (!f.active || f.active.status !== 'active') {
    return { success: false, reason: 'not_working' };
  }
  var a = f.active;
  var client = CS.getClient(a.clientId);
  var isLast = a.stepIndex >= (a.steps.length - 1);
  var texts = isLast
    ? [
      CS.t ? CS.t('nego.done0') : '',
      CS.t ? CS.t('nego.done1') : '',
      CS.t ? CS.t('nego.done2') : ''
    ]
    : [0,1,2,3].map(function (i) { return CS.chatWorkReply ? CS.chatWorkReply(i) : CS.CHAT_WORK_REPLIES[i]; });
  var text = texts[Math.min(presetIndex || 0, texts.length - 1)];

  CS._mailFromPlayer(state, a, CS.t ? CS.t('nego.re', { title: (CS.localizeOrder ? CS.localizeOrder(a) : a).title }) : ('Re: ' + a.title), text + '\n\n' + (CS.t ? CS.t('nego.you') : '— You'));

  // Финальная стадия: любой ответ закрывает проект
  if (isLast) {
    CS._mailFromClient(state, a, {
      subject: 'Re: Заказ: ' + a.title,
      body: CS._pick([
        CS.t ? CS.t('nego.c.paid0') : '',
        CS.t ? CS.t('nego.c.paid1') : '',
        CS.t ? CS.t('nego.c.paid2') : ''
      ]) + '\n\n— ' + client.name,
      withActions: false
    });
    var done = CS.completeActiveOrder(state, true);
    return { success: true, stepCompleted: true, chainCompleted: done, bonus: 0, final: true };
  }

  var step = a.steps[a.stepIndex];
  var stepCompleted = false;
  var chainCompleted = false;
  var bonus = 0;
  if (step && step.type === 'chat') {
    a.stepProgress += 1;
    state.stepProgress = a.stepProgress;
    bonus = 8 + state.level * 2;
    state.cash += bonus;
    state.totalsToday.cash += bonus;
    if (a.stepProgress >= step.target) {
      stepCompleted = true;
      chainCompleted = CS.advanceFreelanceStep(state);
    } else {
      CS._mailFromClient(state, a, {
        subject: 'Re: Заказ: ' + a.title,
        body: 'Ок, жду ещё по этому пункту.\n\n— ' + client.name,
        withActions: true
      });
    }
  } else {
    CS._mailFromClient(state, a, {
      subject: 'Re: Заказ: ' + a.title,
      body: CS._pick(['Принято.', 'Ок, продолжайте.', 'На связи.']) + '\n\n— ' + client.name,
      withActions: true
    });
  }
  return { success: true, stepCompleted: stepCompleted, chainCompleted: chainCompleted, bonus: bonus };
};

CS.handleChatAction = function (state, actionId) {
  var f = CS.ensureFreelance(state);
  if (!f.active) return { success: false, reason: 'no_active' };
  if (f.active.status === 'negotiating') {
    return CS._handleNegotiation(state, actionId);
  }
  if (actionId === 'work_hint') {
    var a = f.active;
    var step = a.steps[a.stepIndex];
    var client = CS.getClient(a.clientId);
    var hint = step
      ? ('Сейчас этап ' + (a.stepIndex + 1) + '/' + a.steps.length + ': «' + step.text + '».\n' +
        (step.type === 'chat'
          ? 'Ответьте кнопками в этом письме.'
          : 'Это делается в «Работа.exe» (не в почте). Тип: ' + step.type + '.'))
      : 'Откройте «Работа.exe».';
    CS._mailFromClient(state, a, {
      subject: 'Re: ' + a.title,
      body: hint + '\n\n— ' + client.name,
      withActions: true
    });
    return { success: true, hint: true };
  }
  if (String(actionId).indexOf('work_done_') === 0) {
    var di = parseInt(String(actionId).replace('work_done_', ''), 10) || 0;
    return CS.replyToClient(state, di);
  }
  if (String(actionId).indexOf('work_') === 0) {
    var idx = parseInt(String(actionId).replace('work_', ''), 10) || 0;
    return CS.replyToClient(state, idx);
  }
  return { success: false, reason: 'unknown' };
};

CS.advanceFreelanceStep = function (state) {
  var f = CS.ensureFreelance(state);
  if (!f.active || f.active.status !== 'active') return false;
  var client = CS.getClient(f.active.clientId);
  CS.addXp(state, CS.CONFIG.XP_PER_STEP);

  if (f.active.stepIndex + 1 < f.active.steps.length) {
    f.active.stepIndex += 1;
    f.active.stepProgress = 0;
    state.stepIndex = f.active.stepIndex;
    state.stepProgress = 0;
    CS.prepareStepLayout(state, f.active.steps[f.active.stepIndex]);
    var next = f.active.steps[f.active.stepIndex];
    var isLast = f.active.stepIndex >= f.active.steps.length - 1;
    CS._mailFromClient(state, f.active, {
      subject: 'Re: Заказ: ' + f.active.title,
      body: (isLast
        ? 'Финальный этап: «' + next.text + '». Когда закончите — напишите любое подтверждение, закроем заказ.'
        : 'Этап принят. Дальше: «' + next.text + '».') + '\n\n— ' + client.name,
      withActions: true
    });
    return false;
  }
  return CS.completeActiveOrder(state, true);
};

CS.completeActiveOrder = function (state, success) {
  var f = CS.ensureFreelance(state);
  if (!f.active) return true;
  var order = f.active;
  var client = CS.getClient(order.clientId);
  var reward = 0;
  var penalty = 0;

  if (success) {
    reward = order.reward;
    state.cash += reward;
    state.totalsToday.cash += reward;
    if (typeof CS.recordIncome === 'function') CS.recordIncome(state, 'freelance', reward);
    state.totalsToday.chains += 1;
    if (state.lifetime) {
      state.lifetime.chains = (state.lifetime.chains || 0) + 1;
      state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + reward;
    }
    CS.addXp(state, CS.CONFIG.XP_PER_CHAIN);
    CS.adjustRating(state, 4 + Math.min(3, Math.floor((order.deadlineLeft || 0) / 60)));
    f.completedCount = (f.completedCount || 0) + 1;
    CS._mailFromClient(state, order, {
      subject: 'Оплата: ' + order.title,
      body: CS._pick([
        'Спасибо, оплата ' + reward + '💰 ушла. Рейтинг на бирже обновлю в плюс.',
        'Принято. Приятно работать — ' + reward + '💰 перевёл(а).',
        'Закрываем. Хороший результат, на связи.'
      ]) + '\n\n— ' + client.name,
      withActions: false
    });
    state.history.unshift({
      type: 'quest',
      text: 'Заказ «' + order.title + '» сдан (+' + reward + '💰, рейтинг ' + Math.round(f.rating) + ')',
      time: new Date().toLocaleTimeString()
    });
    if (!state.economyActive && CS.CONFIG.GRACE_END_ON_CHAIN) {
      CS.activateEconomy(state, 'chain');
    }
    CS.checkAchievements(state, { event: 'chain' });
  } else {
    // Штраф: доля от цены заказа + выгорание + рейтинг
    penalty = Math.round(order.reward * (order.penaltyShare || 0.25));
    penalty = Math.min(state.cash, Math.max(15, penalty));
    if (typeof CS.recordExpense === 'function') CS.recordExpense(state, 'penalty', penalty);
    state.cash = Math.max(0, state.cash - penalty);
    state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, (state.burnout || 0) + 14);
    CS.adjustRating(state, -10);
    f.failedCount = (f.failedCount || 0) + 1;
    CS._mailFromClient(state, order, {
      subject: 'Срыв срока: ' + order.title,
      body: 'Срок сорван. По договорённости удерживаю штраф ' + penalty +
        '💰. Рейтинг на бирже снижен.\n\n' +
        CS._pick([
          'Очень разочарован(а). Пока без новых задач.',
          'Так работать нельзя. Ищу другого исполнителя.',
          'Зафиксировал(а) срыв. Исправьте подход.'
        ]) + '\n\n— ' + client.name,
      withActions: false
    });
    state.history.unshift({
      type: 'quest',
      text: 'Срыв «' + order.title + '»: штраф −' + penalty + '💰, рейтинг ' + Math.round(f.rating),
      time: new Date().toLocaleTimeString()
    });
  }

  state.history = state.history.slice(0, 20);
  f.done.unshift({
    title: order.title,
    clientId: order.clientId,
    reward: success ? reward : -penalty,
    success: !!success,
    time: new Date().toLocaleTimeString()
  });
  f.done = f.done.slice(0, 12);

  // оставляем чат на секунду в done не нужно — обнуляем active
  f.active = null;

  if (state.chainId == null || !CS.QUEST_POOL[state.chainId]) {
    CS.assignChain(state, Math.floor(Math.random() * CS.QUEST_POOL.length));
  } else {
    state.stepIndex = 0;
    state.stepProgress = 0;
    CS.prepareStepLayout(state, CS.QUEST_POOL[state.chainId].steps[0]);
  }
  CS.refreshOrderBoard(state, true);
  return true;
};

/**
 * Стажёры помогают на активном заказе (не «кормят» пассивом).
 * Шанс прогресса за тик растёт с числом стажёров; сильнее на tap-этапах.
 */
CS.tickInternOrderHelp = function (state) {
  var f = CS.ensureFreelance(state);
  if (!f.active || f.active.status !== 'active') return;
  var n = state.interns || 0;
  if (n <= 0) return;
  var step = f.active.steps[f.active.stepIndex];
  if (!step || step.type === 'chat') return; // чат — PM или игрок

  // ~8% за стажёра на tap, меньше на find/puzzle; PM усиливают «постановку на проект»
  var chance = n * (step.type === 'tap' ? 0.08 : 0.04);
  var pms = state.projectManagers || 0;
  if (pms > 0) {
    chance *= 1 + pms * (CS.CONFIG.PM_INTERN_HELP_MULT || 0.35);
  }
  if (chance > 0.65) chance = 0.65;
  if (Math.random() > chance) return;

  f.active.stepProgress = (f.active.stepProgress || 0) + 1;
  state.stepProgress = f.active.stepProgress;
  if (f.active.stepProgress >= step.target) {
    CS.advanceFreelanceStep(state);
  }
};

/**
 * PM общаются с клиентами: chat-этапы и переговоры.
 * Игрок может ускорить всё сам кликами / ответами.
 */
CS.tickProjectManagers = function (state) {
  var pms = state.projectManagers || 0;
  if (pms <= 0) return;
  var f = CS.ensureFreelance(state);
  if (!f.active) return;

  // Переговоры: с шансом уточняют условия и в итоге принимают сделку
  if (f.active.status === 'negotiating') {
    var negoChance = Math.min(0.55, pms * (CS.CONFIG.PM_NEGO_CHANCE_PER || 0.12));
    if (Math.random() > negoChance) return;
    var n = f.active.nego || {};
    // Сначала «закрываем» уточнения, потом принимаем
    if (!n.askedScope) {
      CS.handleChatAction(state, 'ask_scope');
      return;
    }
    if (!n.askedDeadline) {
      CS.handleChatAction(state, 'ask_deadline');
      return;
    }
    if (!n.askedBudget) {
      CS.handleChatAction(state, 'ask_budget');
      return;
    }
    CS.handleChatAction(state, 'deal_accept');
    CS._pushChat(f.active, 'me', 'PM: условия согласованы, берём заказ.');
    return;
  }

  if (f.active.status !== 'active') return;
  var step = f.active.steps[f.active.stepIndex];
  if (!step) return;

  // Chat-этапы: PM сами пишут клиенту
  if (step.type === 'chat') {
    var chatChance = Math.min(0.7, pms * (CS.CONFIG.PM_CHAT_CHANCE_PER || 0.22));
    if (Math.random() > chatChance) return;
    // Берём первый доступный work-ответ
    var actions = CS.getChatActions(state);
    var work = actions.find(function (a) { return a.id && a.id.indexOf('work_') === 0 && a.id !== 'work_hint'; });
    if (work) {
      CS.handleChatAction(state, work.id);
    }
    return;
  }

  // На финальной сдаче — PM иногда отправляет результат
  var isLast = f.active.stepIndex >= (f.active.steps.length - 1);
  if (isLast && step.type !== 'tap' && step.type !== 'find' && step.type !== 'puzzle') {
    var doneChance = Math.min(0.4, pms * 0.1);
    if (Math.random() < doneChance) {
      CS.handleChatAction(state, 'work_done_0');
    }
  }
};

CS.tickFreelance = function (state) {
  var f = CS.ensureFreelance(state);
  f.tick = (f.tick || 0) + 1;
  if (f.board.length < 3 && f.tick % 45 === 0) CS.refreshOrderBoard(state, false);

  CS.tickInternOrderHelp(state);
  CS.tickProjectManagers(state);

  if (!f.active) return;
  // дедлайн тикает только после подписания сделки
  if (f.active.status !== 'active') return;

  f.active.deadlineLeft = Math.max(0, (f.active.deadlineLeft || 0) - 1);
  if (f.active.deadlineLeft === 60 || f.active.deadlineLeft === 30) {
    CS._pushChat(f.active, 'npc', CS._pick([
      'Напоминаю: дедлайн близко (' + f.active.deadlineLeft + 'с).',
      'Как статус? Осталось ' + f.active.deadlineLeft + 'с.',
      'Срок горит. Жду апдейт.'
    ]));
  }
  if (f.active.deadlineLeft <= 0) {
    CS.completeActiveOrder(state, false);
  }
};

CS.currentChain = function (state) {
  var f = state.freelance;
  if (f && f.active && f.active.status === 'active' && f.active.steps && f.active.steps.length) {
    var loc = CS.localizeOrder ? CS.localizeOrder(f.active) : f.active;
    return { title: loc.title, steps: loc.steps, freelance: true, brief: loc.brief, templateId: f.active.templateId };
  }
  var q = CS.QUEST_POOL[state.chainId] || CS.QUEST_POOL[0];
  return CS.localizeQuest ? CS.localizeQuest(q) : q;
};

CS.currentStep = function (state) {
  var chain = CS.currentChain(state);
  var idx = state.stepIndex || 0;
  if (state.freelance && state.freelance.active && state.freelance.active.status === 'active') {
    idx = state.freelance.active.stepIndex || 0;
    state.stepIndex = idx;
    state.stepProgress = state.freelance.active.stepProgress || 0;
  }
  return chain.steps[Math.min(idx, chain.steps.length - 1)];
};
