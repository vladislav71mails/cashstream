let state = null;
let lastTapTime = 0;
let combo = 1;

async function init() {
  try {
    state = await CS.loadState();
    render();
    setInterval(tick, CS.CONFIG.TICK_MS);
    setInterval(updateClock, 1000);
    updateClock();

    CS.onStateChanged((newState) => {
      state = newState;
      render();
    });

    document.getElementById('tapBtn').addEventListener('click', onTap);
    document.getElementById('openFull').addEventListener('click', openFullPage);
    document.getElementById('openCasino').addEventListener('click', () => openFullPage('casino'));
    document.getElementById('openInvest').addEventListener('click', () => openFullPage('invest'));
  } catch (err) {
    CS.reportFatalError(err);
  }
}

function updateClock() {
  const d = new Date();
  document.getElementById('clock').textContent =
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function tick() {
  if (!state) return;
  CS.tick(state);
  CS.saveState(state);
  render();
}

function onTap(e) {
  if (!state) return;
  const step = CS.currentStep(state);

  if (state.focus <= 0) {
    flashHint('Фокус на нуле — дайте себе отдохнуть!');
    return;
  }
  if (state.burnout >= CS.CONFIG.MAX_BURNOUT) {
    flashHint('Выгорание критично! Сходите в казино на перерыв.');
    return;
  }

  const now = Date.now();
  if (now - lastTapTime < CS.CONFIG.COMBO_WINDOW_MS) {
    combo = Math.min(CS.CONFIG.COMBO_MAX, combo + CS.CONFIG.COMBO_STEP);
  } else {
    combo = 1;
  }
  lastTapTime = now;
  document.getElementById('comboValue').textContent = combo.toFixed(1);

  const result = CS.registerTap(state, combo);
  CS.saveState(state);
  spawnFloaty('+' + result.gained, e);
  document.getElementById('workZone').classList.add('shake');
  setTimeout(() => document.getElementById('workZone').classList.remove('shake'), 130);

  if (result.chainCompleted) {
    flashHint('Квест выполнен! Новое задание в деле 🎉');
  } else if (result.stepCompleted) {
    flashHint('Этап закрыт, переходим к следующему.');
  } else if (step.type !== 'tap') {
    flashHint('Для мини-игры (🔍/🧩) разверните на весь экран →');
  }

  render();
}

function spawnFloaty(text, e) {
  const zone = document.getElementById('workZone');
  const f = document.createElement('div');
  f.className = 'floaty';
  f.textContent = text;
  const rect = zone.getBoundingClientRect();
  f.style.left = (e.clientX - rect.left) + 'px';
  f.style.top = (e.clientY - rect.top) + 'px';
  zone.appendChild(f);
  setTimeout(() => f.remove(), 700);
}

let hintTimeout = null;
function flashHint(text) {
  const el = document.getElementById('popupHint');
  el.textContent = text;
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => { el.textContent = ''; }, 2200);
}

function openFullPage(anchor) {
  const url = chrome.runtime.getURL('fullpage.html') + (anchor ? '#' + anchor : '');
  chrome.tabs.create({ url });
}

function render() {
  if (!state) return;
  document.getElementById('cashValue').textContent = Math.floor(state.cash);
  document.getElementById('levelValue').textContent = state.level;

  const focusPct = Math.round(state.focus);
  document.getElementById('focusFill').style.width = focusPct + '%';
  document.getElementById('focusLabel').textContent = focusPct;

  const burnoutPct = Math.round(state.burnout);
  document.getElementById('burnoutFill').style.width = burnoutPct + '%';
  document.getElementById('burnoutLabel').textContent = burnoutPct;

  const chain = CS.currentChain(state);
  const step = CS.currentStep(state);
  document.getElementById('questTitle').textContent = '📋 ' + chain.title;
  document.getElementById('questStep').textContent = step.text;
  const pct = Math.min(100, Math.round((state.stepProgress / step.target) * 100));
  document.getElementById('questFill').style.width = pct + '%';
  document.getElementById('questLabel').textContent = `${state.stepProgress}/${step.target}`;

  const tapBtn = document.getElementById('tapBtn');
  tapBtn.disabled = state.focus <= 0 || state.burnout >= CS.CONFIG.MAX_BURNOUT;

  document.getElementById('internCountPopup').textContent = state.interns;
  document.getElementById('internIncomePopup').textContent = (state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK).toFixed(1);
  document.getElementById('realtyIncomePopup').textContent =
    Math.max(0, CS.propertyIncomeTotal(state) - CS.propertyUpkeepTotal(state)).toFixed(1);

  const debtMini = document.getElementById('debtMini');
  if (state.debt > 0) {
    debtMini.hidden = false;
    document.getElementById('debtValuePopup').textContent = Math.round(state.debt);
  } else {
    debtMini.hidden = true;
  }
}

init();
