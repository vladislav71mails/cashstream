// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Случайные кризисные / удачные события ----
// ============================================================================
// Случайные кризисные (и редкие удачные) события
// ============================================================================

/**
 * Пул событий. weight — относительный вес при выборе.
 * kind: 'crisis' | 'lucky'
 * choices[].effects: { cash, focus, burnout, debt, interns, equipLevel }
 *   — дельты (отрицательные = потеря). cash может быть функцией (state) => number.
 * choices[].requiresCash — минимальный кэш; если нет — кнопка недоступна (UI).
 * choices[].label / resultText — подписи.
 */
CS.EVENT_POOL = [
  {
    id: 'burned_laptop',
    kind: 'crisis',
    weight: 10,
    icon: '🔥',
    title: 'Сгорел ноутбук',
    body: 'Блок питания искрит, экран погас. Без рабочей машины клики даются тяжелее, а нервы на пределе.',
    choices: [
      {
        id: 'buy_new',
        label: 'Купить б/у ноут',
        requiresCash: 180,
        costLabel: '180💰',
        effects: { cash: -180, focus: 8, burnout: -6 },
        resultText: 'Купили б/у ноутбук. Можно снова работать.'
      },
      {
        id: 'endure',
        label: 'Чинить скотчем',
        effects: { focus: -18, burnout: 16 },
        resultText: 'Скотч и молитвы. Фокус падает, стресс растёт.'
      }
    ]
  },
  {
    id: 'client_no_pay',
    kind: 'crisis',
    weight: 12,
    icon: '💸',
    title: 'Заказчик не заплатил',
    body: 'Счёт «в обработке» уже третью неделю. Нужно решить: давить или списать.',
    choices: [
      {
        id: 'lawyer',
        label: 'Нанять юриста',
        requiresCash: 120,
        costLabel: '120💰',
        effects: { cash: 80, focus: -5, burnout: 4 },
        resultText: 'Юрист выбил часть долга. Нетто +80💰 после гонорара.'
      },
      {
        id: 'writeoff',
        label: 'Списать и забыть',
        effects: { cash: -60, burnout: 12, focus: -8 },
        resultText: 'Деньги не вернули. Настроение и фокус просели.'
      }
    ]
  },
  {
    id: 'power_outage',
    kind: 'crisis',
    weight: 9,
    icon: '🔌',
    title: 'Отключили свет',
    body: 'В доме авария на подстанции. Без электричества ни кодить, ни казино.',
    choices: [
      {
        id: 'coworking',
        label: 'Уйти в коворкинг',
        requiresCash: 50,
        costLabel: '50💰',
        effects: { cash: -50, focus: 5 },
        resultText: 'Сели в коворкинге. Дорого, зато розетки есть.'
      },
      {
        id: 'candle',
        label: 'Ждать у окна',
        effects: { focus: -12, burnout: 8 },
        resultText: 'Просидели в темноте. Смена потеряна.'
      }
    ]
  },
  {
    id: 'virus',
    kind: 'crisis',
    weight: 10,
    icon: '🦠',
    title: 'Вирус на ПК',
    body: 'Баннер «Ваш компьютер заражён!» не закрывается. Файлы под угрозой.',
    choices: [
      {
        id: 'antivirus',
        label: 'Купить антивирус',
        requiresCash: 70,
        costLabel: '70💰',
        effects: { cash: -70, focus: 4, burnout: -3 },
        resultText: 'Антивирус вычистил систему. Можно работать.'
      },
      {
        id: 'format',
        label: 'Форматировать диск',
        effects: { focus: -15, burnout: 10 },
        resultText: 'Всё снесли. Часть наработок потеряна, нервы тоже.'
      }
    ]
  },
  {
    id: 'hard_drive',
    kind: 'crisis',
    weight: 8,
    icon: '💾',
    title: 'Умер жёсткий диск',
    body: 'Щёлкает, не грузится. Бэкапов, разумеется, не было.',
    choices: [
      {
        id: 'new_hdd',
        label: 'Купить диск + восстановление',
        requiresCash: 140,
        costLabel: '140💰',
        effects: { cash: -140, focus: 6 },
        resultText: 'Новый диск и частичное восстановление. Урок усвоен.'
      },
      {
        id: 'live_without',
        label: 'Начать с нуля',
        effects: { focus: -20, burnout: 18, cash: -30 },
        resultText: 'Потеряли проекты и время. Клиенты недовольны (−30💰).'
      }
    ]
  },
  {
    id: 'intern_quit',
    kind: 'crisis',
    weight: 7,
    icon: '🚪',
    title: 'Стажёр уволился',
    body: 'Написал в чат «я в отпуска и не вернусь» и пропал. Пассивный доход просел.',
    requireInterns: 1,
    choices: [
      {
        id: 'raise',
        label: 'Уговорить премией',
        requiresCash: 90,
        costLabel: '90💰',
        effects: { cash: -90 },
        resultText: 'Стажёр остался… пока. Премия ушла впустую почти.'
      },
      {
        id: 'let_go',
        label: 'Отпустить',
        effects: { interns: -1, burnout: 8, focus: -5 },
        resultText: 'Стажёров стало меньше. Тишина в офисе.'
      }
    ]
  },
  {
    id: 'coffee_spill',
    kind: 'crisis',
    weight: 9,
    icon: '☕',
    title: 'Кофе на клавиатуру',
    body: 'Кружка опрокинулась. Клавиши липкие, Enter залип.',
    choices: [
      {
        id: 'new_kb',
        label: 'Купить клавиатуру',
        requiresCash: 40,
        costLabel: '40💰',
        effects: { cash: -40, focus: 3 },
        resultText: 'Новая клавиатура. Пахнет пластиком, зато работает.'
      },
      {
        id: 'dry',
        label: 'Сушить феном',
        effects: { focus: -10, burnout: 7 },
        resultText: 'Сохнет… и нервы тоже.'
      }
    ]
  },
  {
    id: 'neighbor_noise',
    kind: 'crisis',
    weight: 8,
    icon: '🥁',
    title: 'Соседи шумят',
    body: 'Ремонт сверху с 8 утра. Сконцентрироваться невозможно.',
    choices: [
      {
        id: 'cafe',
        label: 'Сбежать в кафе',
        requiresCash: 35,
        costLabel: '35💰',
        effects: { cash: -35, focus: 10, burnout: -4 },
        resultText: 'Тихий угол в кафе. Фокус восстановился.'
      },
      {
        id: 'earplugs',
        label: 'Терпеть в наушниках',
        effects: { focus: -14, burnout: 11 },
        resultText: 'Дрель победила. День почти потерян.'
      }
    ]
  },
  {
    id: 'sick_day',
    kind: 'crisis',
    weight: 9,
    icon: '🤒',
    title: 'Прихватило',
    body: 'Горло, температура, желание лежать. Дедлайны никуда не делись.',
    choices: [
      {
        id: 'medicine',
        label: 'Аптека и отдых',
        requiresCash: 45,
        costLabel: '45💰',
        effects: { cash: -45, focus: 12, burnout: -10 },
        resultText: 'Лекарства и сон. Стало легче.'
      },
      {
        id: 'push_through',
        label: 'Работать через силу',
        effects: { focus: -22, burnout: 20 },
        resultText: 'Дотащили смену. Цена — фокус и выгорание.'
      }
    ]
  },
  {
    id: 'scam_call',
    kind: 'crisis',
    weight: 8,
    icon: '📞',
    title: 'Звонок «из банка»',
    body: 'Голос просит код из СМС «для проверки безопасности».',
    choices: [
      {
        id: 'hangup',
        label: 'Положить трубку',
        effects: { focus: 2 },
        resultText: 'Не повелись. Деньги целы.'
      },
      {
        id: 'almost',
        label: 'Почти продиктовали…',
        effects: { cash: -80, burnout: 14, focus: -10 },
        resultText: 'Успели остановиться, но часть средств ушла (−80💰).'
      }
    ]
  },
  {
    id: 'license_expired',
    kind: 'crisis',
    weight: 7,
    icon: '📄',
    title: 'Истекла лицензия ПО',
    body: 'Редактор кода требует оплату. Без него сроки горят.',
    choices: [
      {
        id: 'renew',
        label: 'Продлить лицензию',
        requiresCash: 95,
        costLabel: '95💰',
        effects: { cash: -95, focus: 5 },
        resultText: 'Лицензия на год. Можно кодить спокойно.'
      },
      {
        id: 'crack',
        label: 'Искать «бесплатно»',
        effects: { burnout: 9, focus: -8, taxRisk: 8 },
        resultText: 'Нашли… сомнительный билд. Риск и стресс выросли.'
      }
    ]
  },
  {
    id: 'rent_inspection',
    kind: 'crisis',
    weight: 7,
    icon: '🔑',
    title: 'Проверка от УК',
    body: 'Управляющая компания хочет осмотреть офис. «Мелочи» всплывут.',
    choices: [
      {
        id: 'tidy',
        label: 'Срочный клининг',
        requiresCash: 55,
        costLabel: '55💰',
        effects: { cash: -55, burnout: -2 },
        resultText: 'Всё блестит. УК ушла довольная.'
      },
      {
        id: 'ignore',
        label: 'Пустить как есть',
        effects: { debt: 40, burnout: 10 },
        resultText: 'Штраф за «нарушения» +40 к долгу.'
      }
    ]
  },
  {
    id: 'deadline_panic',
    kind: 'crisis',
    weight: 11,
    icon: '⏰',
    title: 'Срочный дедлайн',
    body: 'Клиент перенёс сдачу на сегодня. Ночь обещает быть бессонной.',
    choices: [
      {
        id: 'allnighter',
        label: 'Вытянуть ночью',
        effects: { cash: 90, focus: -25, burnout: 22 },
        resultText: 'Сдали вовремя (+90💰). Цена — фокус и выгорание.'
      },
      {
        id: 'negotiate',
        label: 'Торговаться о сроке',
        effects: { cash: 30, focus: -5, burnout: 6 },
        resultText: 'Выторговали сутки. Небольшой аванс (+30💰).'
      }
    ]
  },
  {
    id: 'equipment_glitch',
    kind: 'crisis',
    weight: 6,
    icon: '🖥️',
    title: 'Глючит оборудование',
    body: 'Монитор мерцает, мышь лагает. После прошлых апгрейдов что-то пошло не так.',
    requireEquip: 1,
    choices: [
      {
        id: 'service',
        label: 'Отдать в сервис',
        requiresCash: 75,
        costLabel: '75💰',
        effects: { cash: -75, focus: 6 },
        resultText: 'Починили. Техника снова слушается.'
      },
      {
        id: 'downgrade',
        label: 'Откатить апгрейд',
        effects: { equipLevel: -1, burnout: 8 },
        resultText: 'Вернулись на шаг назад по железу.'
      }
    ]
  },
  // ---- Удачные (реже) ----
  {
    id: 'unexpected_bonus',
    kind: 'lucky',
    weight: 5,
    icon: '🎁',
    title: 'Премия от заказчика',
    body: '«За скорость и качество» — неожиданный бонус на карту.',
    choices: [
      {
        id: 'accept',
        label: 'Принять с благодарностью',
        effects: { cash: 120, focus: 8, burnout: -6 },
        resultText: 'Премия +120💰. Настроение поднялось.'
      },
      {
        id: 'invest_self',
        label: 'Вложить в себя (курсы)',
        requiresCash: 40,
        costLabel: '40💰 из премии',
        effects: { cash: 80, focus: 15, burnout: -4 },
        resultText: 'Часть премии в обучение. Фокус вырос сильнее.'
      }
    ]
  },
  {
    id: 'old_client',
    kind: 'lucky',
    weight: 4,
    icon: '🤝',
    title: 'Старый клиент вернулся',
    body: 'Пишет: «Нужен тот же подрядчик. Оплата сразу».',
    choices: [
      {
        id: 'take',
        label: 'Взять заказ',
        effects: { cash: 150, burnout: 5 },
        resultText: 'Быстрый заказ закрыт (+150💰).'
      },
      {
        id: 'refer',
        label: 'Передать знакомому',
        effects: { cash: 40, focus: 5, burnout: -3 },
        resultText: 'Комиссия за рекомендацию +40💰. Спокойствие.'
      }
    ]
  },
  {
    id: 'found_cash',
    kind: 'lucky',
    weight: 3,
    icon: '🪙',
    title: 'Нашли конверт',
    body: 'В старой куртке — забытый конверт с наличными.',
    choices: [
      {
        id: 'pocket',
        label: 'Положить в кэш',
        effects: { cash: 55, focus: 3 },
        resultText: 'Неожиданные +55💰.'
      },
      {
        id: 'coffee_run',
        label: 'Потратить на хорошую еду',
        effects: { cash: 20, focus: 12, burnout: -8 },
        resultText: 'Поели нормально. Фокус и настроение вверх.'
      }
    ]
  }
];


CS._i18nHas = function (key) {
  try {
    var pack = CS.I18N && CS.I18N[CS.getLang && CS.getLang()];
    return !!(pack && pack[key]);
  } catch (e) { return false; }
};
CS.eventTitle = function (ev) {
  if (!ev) return '';
  var key = 'ev.' + ev.id + '.title';
  return CS._i18nHas(key) ? CS.t(key) : (ev.title || '');
};
CS.eventBody = function (ev) {
  if (!ev) return '';
  var key = 'ev.' + ev.id + '.body';
  return CS._i18nHas(key) ? CS.t(key) : (ev.body || '');
};
CS.choiceLabel = function (evId, choice) {
  if (!choice) return '';
  var key = 'ev.' + evId + '.c.' + choice.id + '.label';
  return CS._i18nHas(key) ? CS.t(key) : (choice.label || '');
};
CS.choiceResult = function (evId, choice) {
  if (!choice) return '';
  var key = 'ev.' + evId + '.c.' + choice.id + '.result';
  return CS._i18nHas(key) ? CS.t(key) : (choice.resultText || '');
};

CS.maybeTriggerEvent = function (state) {
  if (!state || !state.economyActive) return;
  if (state.activeEvent) return;
  if ((state.level || 1) < (CS.CONFIG.EVENT_MIN_LEVEL || 1)) return;

  if (state.eventCooldown > 0) {
    state.eventCooldown -= 1;
    return;
  }

  if (Math.random() > (CS.CONFIG.EVENT_CHANCE_PER_TICK || 0.03)) return;

  const pool = CS.EVENT_POOL.filter((ev) => {
    if (ev.requireInterns && (state.interns || 0) < ev.requireInterns) return false;
    if (ev.requireEquip && (state.equipLevel || 0) < ev.requireEquip) return false;
    return true;
  });
  if (!pool.length) return;

  const totalWeight = pool.reduce((s, e) => s + (e.weight || 1), 0);
  let roll = Math.random() * totalWeight;
  let chosen = pool[0];
  for (let i = 0; i < pool.length; i++) {
    roll -= (pool[i].weight || 1);
    if (roll <= 0) { chosen = pool[i]; break; }
  }

  state.activeEvent = {
    id: chosen.id,
    kind: chosen.kind,
    icon: chosen.icon,
    title: chosen.title,
    body: chosen.body,
    choices: chosen.choices.map((c) => ({
      id: c.id,
      label: c.label,
      requiresCash: c.requiresCash || 0,
      costLabel: c.costLabel || null,
      effects: Object.assign({}, c.effects || {}),
      resultText: c.resultText || ''
    }))
  };
};

/** Применить выбор. Возвращает { success, reason?, resultText?, effects? } */
CS.resolveEventChoice = function (state, choiceId) {
  const ev = state.activeEvent;
  if (!ev) return { success: false, reason: 'none' };
  const choice = (ev.choices || []).find((c) => c.id === choiceId);
  if (!choice) return { success: false, reason: 'bad_choice' };

  const need = choice.requiresCash || 0;
  if (need > 0 && state.cash < need) {
    return { success: false, reason: 'cash', need };
  }

  const fx = choice.effects || {};
  if (typeof fx.cash === 'number') {
    state.cash = Math.max(0, state.cash + fx.cash);
    if (fx.cash > 0 && state.lifetime) {
      state.lifetime.cashEarned = (state.lifetime.cashEarned || 0) + fx.cash;
    }
  }
  if (typeof fx.focus === 'number') {
    state.focus = Math.max(0, Math.min(CS.CONFIG.MAX_FOCUS, state.focus + fx.focus));
  }
  if (typeof fx.burnout === 'number') {
    state.burnout = Math.max(0, Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + fx.burnout));
  }
  if (typeof fx.debt === 'number') {
    state.debt = Math.max(0, (state.debt || 0) + fx.debt);
  }
  if (typeof fx.interns === 'number') {
    state.interns = Math.max(0, (state.interns || 0) + fx.interns);
  }
  if (typeof fx.equipLevel === 'number') {
    state.equipLevel = Math.max(0, (state.equipLevel || 0) + fx.equipLevel);
    CS.recomputeDerived(state);
  }
  if (typeof fx.taxRisk === 'number') {
    state.taxRisk = Math.max(0, (state.taxRisk || 0) + fx.taxRisk);
  }

  if (state.lifetime) {
    state.lifetime.eventsHandled = (state.lifetime.eventsHandled || 0) + 1;
  }

  const locTitle = CS.eventTitle(ev);
  const locBody = CS.eventBody(ev);
  const locLabel = CS.choiceLabel(ev.id, choice);
  const locResult = CS.choiceResult(ev.id, choice);
  const kindTag = ev.kind === 'lucky' ? 'lucky' : 'crisis';
  state.history.unshift({
    type: 'event',
    text: `${ev.icon || '⚡'} ${locTitle}: ${locResult || locLabel}`,
    time: new Date().toLocaleTimeString()
  });
  state.history = state.history.slice(0, 20);

  CS.addMail(state, {
    from: 'events@cash.stream',
    subject: `${ev.icon || '⚡'} ${locTitle}`,
    body: `${locBody}\n\n${CS.t ? CS.t('ev.your_choice', { label: locLabel }) : locLabel}\n\n${locResult || ''}\n\n${CS.t ? CS.t('ev.mail_footer') : ''}`,
    folder: 'inbox',
    tags: ['event', kindTag]
  });

  state.activeEvent = null;
  state.eventCooldown = CS.CONFIG.EVENT_COOLDOWN_TICKS || 55;

  CS.checkAchievements(state, { event: 'crisis' });

  return {
    success: true,
    resultText: locResult,
    effects: fx,
    title: locTitle,
    icon: ev.icon,
    kind: ev.kind
  };
};
