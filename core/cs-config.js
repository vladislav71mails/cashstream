// КЭШ.СТРИМ — общий namespace (подключать первым).
var CS = window.CS || (window.CS = {});

// ---- Константы баланса / экономика ----
CS.CONFIG = {
  STORAGE_KEY: 'csState',
  MAX_FOCUS: 100,
  MAX_BURNOUT: 100,
  FOCUS_COST_PER_TAP: 1.8,
  BURNOUT_GAIN_PER_TAP: 1.4,
  FOCUS_REGEN_PER_TICK: 0.4,      // восстановление фокуса в простое (раз в TICK_MS)
  BURNOUT_DECAY_PER_TICK: 0.15,   // естественное снижение выгорания в простое
  CASINO_BURNOUT_RELIEF: 9,       // снижение выгорания за один раунд в казино
  TICK_MS: 1000,
  COMBO_WINDOW_MS: 700,           // окно между кликами, чтобы сохранить комбо
  COMBO_MAX: 2.5,
  COMBO_STEP: 0.2,
  BASE_CLICK_VALUE: 1.5,
  XP_PER_STEP: 12,
  XP_PER_CHAIN: 40,
  LEVEL_XP_BASE: 100,
  LEVEL_XP_GROWTH: 1.35,
  INTERN_BASE_COST: 400,
  INTERN_COST_GROWTH: 1.55,
  INTERN_INCOME_PER_TICK: 0.8,    // кэш в секунду с одного стажёра

  // ---- Экономика: аренда офиса (обязательный расход) ----
  RENT_INTERVAL_TICKS: 50,        // раз в ~50 секунд прилетает счёт за аренду (раньше 25 — слишком агрессивно)
  RENT_BASE: 100,                 // база аренды
  RENT_PER_LEVEL: 18,             // аренда растёт вместе с уровнем игрока
  RENT_LATE_BURNOUT: 20,          // штраф выгорания, если нечем платить
  DEBT_INTEREST_PER_TICK: 0.009,  // проценты по долгу (за тик)
  DEBT_AUTOPAY_SHARE: 0.15,       // доля свободного кэша, уходящая на списание долга

  // Мягкий старт: аренда и проценты по долгу не действуют, пока не истечёт
  // льготный период ИЛИ игрок не завершит первую цепочку квестов / не купит апгрейд.
  GRACE_TICKS: 90,                // ~1.5 минуты «обучения» без давления аренды
  GRACE_END_ON_CHAIN: true,       // первая завершённая цепочка тоже снимает льготу

  // ---- Выгорание → шанс провала клика ----
  // С burnout >= BURNOUT_FAIL_START растёт шанс «неудачного» клика:
  // фокус и выгорание всё равно тратятся, доход 0 или минус деньги.
  BURNOUT_FAIL_START: 40,         // с какого уровня выгорания начинаются провалы
  BURNOUT_FAIL_MAX_CHANCE: 0.55,  // шанс провала при burnout = 100
  BURNOUT_FAIL_CASH_LOSS_SHARE: 0.5, // доля clickValue, которую теряете при провале
  BURNOUT_SUCCESS_PENALTY: 0.35,  // при высоком burnout успешный клик даёт меньше (до −35%)

  // ---- Случайные кризисные (и редкие удачные) события ----
  EVENT_CHANCE_PER_TICK: 0.02,    // реже кризисы (раньше 0.04 — слишком часто)
  EVENT_COOLDOWN_TICKS: 90,       // длиннее пауза между событиями
  EVENT_MIN_LEVEL: 1,

  // ---- Апгрейды оборудования (тратим кэш, чтобы не залипать на тапе) ----
  EQUIP_BASE_COST: 260,
  EQUIP_COST_GROWTH: 1.62,
  EQUIP_CLICK_BONUS: 1.0,         // прибавка к clickValue за уровень
  COFFEE_BASE_COST: 220,
  COFFEE_COST_GROWTH: 1.5,
  COFFEE_FOCUS_SAVE: 0.16,        // снижение стоимости фокуса за тап на уровень
  COFFEE_MIN_FOCUS_COST: 0.45,

  // ---- Офис.Маркет: кресло и второй монитор ----
  CHAIR_BASE_COST: 280,
  CHAIR_COST_GROWTH: 1.55,
  CHAIR_BURNOUT_DECAY_BONUS: 0.08, // +к естественному спаду выгорания за уровень
  CHAIR_BURNOUT_GAIN_SAVE: 0.10,  // −к набору выгорания за тап за уровень (доля)
  MONITOR_BASE_COST: 320,
  MONITOR_COST_GROWTH: 1.6,
  MONITOR_COMBO_WINDOW_BONUS: 120, // +мс к окну комбо за уровень монитора

  // ---- Менеджеры проектов (PM) ----
  PM_BASE_COST: 900,
  PM_COST_GROWTH: 1.7,
  PM_CAP_UNREGISTERED: 0,         // без ИП/ООО PM недоступны
  PM_CHAT_CHANCE_PER: 0.22,       // шанс авто-ответа клиенту за тик на chat-этапе (за PM)
  PM_NEGO_CHANCE_PER: 0.12,       // шанс продвинуть переговоры / принять сделку
  PM_INTERN_HELP_MULT: 0.35,      // множитель к шансу помощи стажёров за каждого PM

  // ---- Биржа «Рынок Айти» ----
  STOCK_NEWS_CHANCE: 0.05,        // шанс резкого новостного скачка за тик
  STOCK_NEWS_MAGNITUDE: [0.10, 0.28],
  STOCK_TRADE_FEE: 0.01,          // комиссия брокера 1% — ещё один денежный сток
  STOCK_HISTORY_LEN: 28,
  DIVIDEND_INTERVAL_TICKS: 40,       // выплата дивидендов раз в N тиков
  DIVIDEND_PAYOUT_FRACTION: 0.22,   // доля годовой доходности за один платёж

  // ---- Недвижимость ----
  PROPERTY_COST_GROWTH: 1.28,     // рост цены за каждый следующий такой же объект
  PROPERTY_RENOVATION_MAX: 5,
  PROPERTY_RENOVATION_INCOME_BONUS: 0.12, // +12% дохода объекта за уровень ремонта
  PROPERTY_RENOVATION_COST_SHARE: 0.28,   // доля от базовой цены объекта
  PROPERTY_RENOVATION_COST_GROWTH: 1.45,  // удорожание каждого следующего ремонта
  PROPERTY_SELL_SHARE: 0.72,              // доля цены при продаже

  // ---- Бизнес и регистрация (ФНС, риски) ----
  UNREG_AUDIT_BASE_CHANCE: 0.02,   // базовый шанс внеплановой проверки за тик (масштабируется риском)
  UNREG_AUDIT_RISK_SCALE: 250,     // риск, при котором шанс проверки выходит «на плато»
  UNREG_AUDIT_MAX_CHANCE: 0.3,     // потолок шанса проверки за один тик
  UNREG_FINE_SHARE: 0.55,          // доля накопленного риска, которая уходит в штраф
  UNREG_FINE_MIN: 25,
  UNREG_BURNOUT_PENALTY: 16,
  UNREG_RISK_DECAY: 3,             // затухание риска за тик, если деятельность легальна
  SELF_EMPLOYED_INCOME_CAP: 6000,  // лимит дохода самозанятого (аналог 2.4 млн ₽/год, уменьшено под игру)
  INTERN_CAP_UNREGISTERED: 1,      // без регистрации бизнеса (или самозанятости) — максимум 1 «неофициальный» стажёр

  // ---- Бустеры / реклама / монетизация владельца ----
  BOOSTER_FREE_COOLDOWN_TICKS: 120, // ~2 мин между бесплатными бустерами
  BOOSTER_CARD_CHANCE: 0.15,
  AD_COOLDOWN_TICKS: 120,           // = free cooldown (совместимость)
  AD_WATCH_SECONDS: 8,              // только для simulate / dev
  // Ссылка магазина поддержки / доната (владелец подставляет свою).
  PREMIUM_SHOP_URL: 'https://www.donationalerts.com/r/j_miles',
  PREMIUM_SHOP_LABEL: 'DonationAlerts · поддержать автора',

  /**
   * Реклама — см. core/cs-ads.js
   * Для РФ: provider 'yandex' + Rewarded-блок РСЯ + fullpage на HTTPS-домене.
   * В chrome-extension:// yandex автоматически падает в simulate.
   */
  ADS: {
    provider: 'simulate',      // 'simulate' | 'yandex'
    yandexBlockId: '',         // ID блока, напр. R-A-XXXXXX-Y
    yandexPlatform: 'desktop'  // 'desktop' | 'touch'
  }
};

// ---- Облако (Supabase) ----
// Publishable key (sb_publishable_...) вставьте в anonKey.
// service_role / secret в расширение НЕ класть.
CS.CLOUD = {
  url: 'https://agrsvzssbyhutovflxgv.supabase.co',
  anonKey: 'sb_publishable_VvuA9YW_X025uhRZ41Br7A_Zs3aOKBv'
};
