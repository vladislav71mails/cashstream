// ============================================================================
// «Банк» — депозиты, кредиты, ипотека
// ============================================================================

let state = null;
let selectedDepositTerm = 3;
let selectedLoanTerm = 3;

// Конфигурация банковских продуктов
const BANK_CONFIG = {
  depositRates: [
    { months: 1, rate: 0.02, label: (CS.t ? CS.t('m.2d54fa570e') : '1 месяц') },
    { months: 3, rate: 0.07, label: (CS.t ? CS.t('m.7a853f97c3') : '3 месяца') },
    { months: 6, rate: 0.15, label: (CS.t ? CS.t('m.e3a04f479d') : '6 месяцев') },
    { months: 12, rate: 0.32, label: (CS.t ? CS.t('m.d3ac2737d3') : '12 месяцев') }
  ],
  loanRates: [
    { months: 1, rate: 0.15, label: (CS.t ? CS.t('m.2d54fa570e') : '1 месяц') },
    { months: 3, rate: 0.40, label: (CS.t ? CS.t('m.7a853f97c3') : '3 месяца') },
    { months: 6, rate: 0.75, label: (CS.t ? CS.t('m.e3a04f479d') : '6 месяцев') },
    { months: 12, rate: 1.50, label: (CS.t ? CS.t('m.d3ac2737d3') : '12 месяцев') }
  ],
  mortgageTerms: [3, 5, 10, 15, 20],
  minDownPayment: 0.20,
  /** Наценка к цене объекта при покупке в ипотеку (иначе это просто рассрочка). */
  mortgagePriceMarkup: 1.28,
  /** Базовая ставка ипотеки до бонуса/штрафа рейтинга. */
  mortgageBaseRate: 0.12,
  creditScoreThresholds: [
    { min: 0, label: 'F', interestBonus: 0.50, maxLoan: 500, emoji: '🔴' },
    { min: 25, label: 'E', interestBonus: 0.40, maxLoan: 1000, emoji: '🟠' },
    { min: 45, label: 'D', interestBonus: 0.25, maxLoan: 3000, emoji: '🟡' },
    { min: 60, label: 'C', interestBonus: 0.12, maxLoan: 8000, emoji: '🟢' },
    { min: 75, label: 'B', interestBonus: 0.04, maxLoan: 20000, emoji: '🔵' },
    { min: 88, label: 'A', interestBonus: 0, maxLoan: 50000, emoji: '💎' },
    { min: 97, label: 'S', interestBonus: -0.07, maxLoan: 150000, emoji: '👑' }
  ]
};

async function init() {
  try {
    state = await CS.loadState();
    if (CS.bootI18n) await CS.bootI18n(state);
    else { if (CS.syncLangFromState) CS.syncLangFromState(state); if (CS.applyI18n) CS.applyI18n(document); }
    if (!state.bank) {
      state.bank = {
        deposits: [],
        loans: [],
        mortgages: [],
        history: []
      };
      await CS.saveState(state);
    }

    initTermSelectors();
    renderTopbar();
    renderDeposits();
    renderLoans();
    renderMortgages();
    renderHistory();

    document.getElementById('depositsTab').addEventListener('click', () => switchTab('deposits'));
    document.getElementById('loansTab').addEventListener('click', () => switchTab('loans'));
    document.getElementById('mortgageTab').addEventListener('click', () => switchTab('mortgage'));
    document.getElementById('historyTab').addEventListener('click', () => switchTab('history'));

    document.getElementById('depositAddBtn').addEventListener('click', onDepositAdd);
    document.getElementById('depositWithdrawBtn').addEventListener('click', onDepositWithdraw);
    document.getElementById('takeLoanBtn').addEventListener('click', onTakeLoan);

    // Обновление подсказки по максимальной сумме кредита
    document.getElementById('loanAmount').addEventListener('input', updateLoanHint);

    CS.onStateChanged(async (newState) => {
      state = newState;
      renderTopbar();
      renderDeposits();
      renderLoans();
      renderMortgages();
      renderHistory();
      updateLoanHint();
    });

  } catch (err) {
    CS.reportFatalError(err);
  }
}

function initTermSelectors() {
  // Депозитные кнопки
  document.querySelectorAll('#depositTermButtons .term-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#depositTermButtons .term-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedDepositTerm = parseInt(this.dataset.months);
    });
  });

  // Кредитные кнопки
  document.querySelectorAll('#loanTermButtons .term-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#loanTermButtons .term-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedLoanTerm = parseInt(this.dataset.months);
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll('.bank-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.bank-section').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tab + 'Tab').classList.add('active');
  document.getElementById(tab + 'Section').classList.add('active');
}

function getCreditScore(state) {
  const totalDebt = getTotalDebt(state);
  const totalIncome = CS.propertyIncomeTotal(state) + state.interns * CS.CONFIG.INTERN_INCOME_PER_TICK;
  const debtRatio = totalIncome > 0 ? Math.min(1, totalDebt / (totalIncome * 60)) : 1;
  
  let score = 70;
  
  // Влияние долга
  score -= debtRatio * 35;
  
  // Бонус за активы
  const propertyCount = CS.propertyCount(state);
  score += Math.min(15, propertyCount * 2.5);
  
  // Бонус за депозиты
  const totalDeposits = state.bank.deposits.reduce((sum, d) => sum + d.amount, 0);
  score += Math.min(12, totalDeposits / 1500);
  
  // Бонус за историю платежей (количество погашенных кредитов)
  const paidLoans = state.bank.loans.filter(l => l.paid).length;
  score += Math.min(10, paidLoans * 2);
  
  // Штраф за просрочки (если есть активные кредиты с просрочкой)
  const overdueLoans = state.bank.loans.filter(l => {
    if (l.paid) return false;
    const monthsPassed = Math.floor((Date.now() - l.startTime) / (30 * 1000));
    return monthsPassed > l.months;
  });
  score -= overdueLoans.length * 15;
  
  // Штраф за большое количество активных кредитов
  const activeLoans = state.bank.loans.filter(l => !l.paid).length;
  if (activeLoans > 2) score -= (activeLoans - 2) * 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getCreditRating(score) {
  for (let i = BANK_CONFIG.creditScoreThresholds.length - 1; i >= 0; i--) {
    if (score >= BANK_CONFIG.creditScoreThresholds[i].min) {
      return BANK_CONFIG.creditScoreThresholds[i];
    }
  }
  return BANK_CONFIG.creditScoreThresholds[0];
}

function getTotalDebt(state) {
  const loanDebt = state.bank.loans.reduce((sum, l) => {
    if (!l.paid) {
      const monthsPassed = Math.floor((Date.now() - l.startTime) / (30 * 1000));
      const totalWithInterest = l.amount * (1 + l.rate);
      const paidSoFar = Math.min(totalWithInterest, (l.amount / l.months) * Math.min(monthsPassed, l.months));
      return sum + (totalWithInterest - paidSoFar);
    }
    return sum;
  }, 0);
  
  const mortgageDebt = state.bank.mortgages.reduce((sum, m) => {
    return sum + (m.totalAmount - m.paidAmount);
  }, 0);
  
  return loanDebt + mortgageDebt + (state.debt || 0);
}

function renderTopbar() {
  document.getElementById('walletCash').textContent = Math.floor(state.cash);
  const score = getCreditScore(state);
  const rating = getCreditRating(score);
  const scoreEl = document.getElementById('creditScore');
  scoreEl.textContent = `${rating.emoji} ${rating.label}`;
  scoreEl.className = `credit-${rating.label}`;
  document.getElementById('totalDebt').textContent = Math.round(getTotalDebt(state));
}

function renderDeposits() {
  const list = document.getElementById('depositList');
  list.innerHTML = '';
  
  if (state.bank.deposits.length === 0) {
    list.innerHTML = '<div class="bank-hint bevel-in" style="margin:0;">' + (CS.t ? CS.t('bank.empty_deposits') : '') + '</div>';
  } else {
    state.bank.deposits.forEach((deposit, idx) => {
      const card = document.createElement('div');
      card.className = 'deposit-card bevel-out';
      const monthsPassed = Math.floor((Date.now() - deposit.startTime) / (30 * 1000));
      const isMature = monthsPassed >= deposit.months;
      const totalReturn = deposit.amount * (1 + deposit.rate);
      
      card.innerHTML = `
        <div class="deposit-info">
          <div class="deposit-amount">${Math.round(deposit.amount)}💰</div>
          <div class="deposit-rate">${deposit.rate * 100}% за ${deposit.months} мес. · 
            ${isMature ? (CS.t ? CS.t('m.e8b07210bf') : '') : (CS.t ? CS.t('bank.mo_passed', { a: monthsPassed, b: deposit.months }) : (monthsPassed + '/' + deposit.months))}
            ${isMature ? ` (💰 ${Math.round(totalReturn)}💰)` : ''}
          </div>
        </div>
        <div class="deposit-actions">
          <button class="win95-btn bevel-out bank-btn-sm deposit-close-btn" data-idx="${idx}">
            ${isMature ? (CS.t ? CS.t('m.ee2ec08e7b') : '') : (CS.t ? CS.t('m.9aa8ecafaa') : '')}
          </button>
        </div>
      `;
      list.appendChild(card);
      
      card.querySelector('.deposit-close-btn').addEventListener('click', () => closeDeposit(idx));
    });
  }
  
  const totalDeposits = state.bank.deposits.reduce((sum, d) => sum + d.amount, 0);
  document.getElementById('totalDeposits').textContent = Math.round(totalDeposits);
  
  const depositIncome = state.bank.deposits.reduce((sum, d) => {
    const monthsPassed = Math.floor((Date.now() - d.startTime) / (30 * 1000));
    if (monthsPassed >= d.months) return sum;
    return sum + (d.amount * d.rate) / (d.months * 30);
  }, 0);
  document.getElementById('depositIncome').textContent = depositIncome.toFixed(1);
}

function closeDeposit(idx) {
  const deposit = state.bank.deposits[idx];
  if (!deposit) return;
  
  const monthsPassed = Math.floor((Date.now() - deposit.startTime) / (30 * 1000));
  let amount = deposit.amount;
  
  if (monthsPassed >= deposit.months) {
    amount += deposit.amount * deposit.rate;
  }
  
  state.cash += Math.round(amount);
  state.bank.deposits.splice(idx, 1);
  addBankHistory(state, `Закрыт депозит: +${Math.round(amount)}💰`, 'bank-deposit');
  CS.saveState(state);
}

async function onDepositAdd() {
  const input = document.getElementById('depositAmount');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0 || amount > state.cash) {
    document.getElementById('depositsSection').classList.add('shake');
    setTimeout(() => document.getElementById('depositsSection').classList.remove('shake'), 130);
    return;
  }
  
  const rateConfig = BANK_CONFIG.depositRates.find(r => r.months === selectedDepositTerm);
  if (!rateConfig) return;
  
  state.cash -= amount;
  state.bank.deposits.push({
    amount: amount,
    rate: rateConfig.rate,
    months: selectedDepositTerm,
    startTime: Date.now()
  });
  
  addBankHistory(state, `Открыт депозит на ${amount}💰 (${selectedDepositTerm} мес., ${rateConfig.rate*100}%)`, 'bank-deposit');
  CS.saveState(state);
}

async function onDepositWithdraw() {
  const input = document.getElementById('depositAmount');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0) {
    document.getElementById('depositsSection').classList.add('shake');
    setTimeout(() => document.getElementById('depositsSection').classList.remove('shake'), 130);
    return;
  }
  
  let remaining = amount;
  let withdrawn = 0;
  const toRemove = [];
  
  for (let i = 0; i < state.bank.deposits.length; i++) {
    const d = state.bank.deposits[i];
    if (d.amount <= remaining) {
      withdrawn += d.amount;
      remaining -= d.amount;
      toRemove.push(i);
    } else {
      d.amount -= remaining;
      withdrawn += remaining;
      remaining = 0;
      break;
    }
  }
  
  if (withdrawn === 0) {
    document.getElementById('depositsSection').classList.add('shake');
    setTimeout(() => document.getElementById('depositsSection').classList.remove('shake'), 130);
    return;
  }
  
  toRemove.sort((a, b) => b - a).forEach(idx => state.bank.deposits.splice(idx, 1));
  
  state.cash += withdrawn;
  addBankHistory(state, `Снято с депозитов: +${Math.round(withdrawn)}💰`, 'bank-withdraw');
  CS.saveState(state);
}

function renderLoans() {
  const list = document.getElementById('loanList');
  list.innerHTML = '';
  
  const activeLoans = state.bank.loans.filter(l => !l.paid);
  const rating = getCreditRating(getCreditScore(state));
  const maxLoan = rating.maxLoan;
  
  if (activeLoans.length === 0) {
    list.innerHTML = '<div class="bank-hint bevel-in" style="margin:0;">' + (CS.t ? CS.t('bank.empty_loans') : '') + '</div>';
  } else {
    activeLoans.forEach((loan, idx) => {
      const realIdx = state.bank.loans.indexOf(loan);
      const card = document.createElement('div');
      card.className = 'loan-card bevel-out';
      const monthsPassed = Math.floor((Date.now() - loan.startTime) / (30 * 1000));
      const totalWithInterest = loan.amount * (1 + loan.rate);
      const paidSoFar = Math.min(totalWithInterest, (loan.amount / loan.months) * Math.min(monthsPassed, loan.months));
      const remaining = totalWithInterest - paidSoFar;
      const isOverdue = monthsPassed > loan.months;
      
      card.innerHTML = `
        <div class="loan-info">
          <div class="loan-amount">${Math.round(loan.amount)}💰</div>
          <div class="loan-rate">${loan.rate * 100}% за ${loan.months} мес. · 
            ${isOverdue ? (CS.t ? CS.t('m.05249b1151') : '') : (CS.t ? CS.t('bank.mo_passed', { a: Math.min(monthsPassed, loan.months), b: loan.months }) : '')}
          </div>
          <div class="loan-payment">Остаток: ${Math.round(remaining)}💰 · 
            ${CS.t ? CS.t('bank.monthly', { n: Math.round(loan.amount / loan.months) }) : Math.round(loan.amount / loan.months)}
          </div>
        </div>
        <div>
          <button class="win95-btn bevel-out bank-btn-sm loan-pay-btn" data-idx="${realIdx}">
            💰 Погасить досрочно (${Math.round(remaining)}💰)
          </button>
        </div>
      `;
      list.appendChild(card);
      
      card.querySelector('.loan-pay-btn').addEventListener('click', () => payLoan(realIdx));
    });
  }
  
  document.getElementById('activeLoans').textContent = activeLoans.length;
  
  const monthlyPayment = activeLoans.reduce((sum, l) => sum + (l.amount / l.months), 0);
  document.getElementById('monthlyPayment').textContent = Math.round(monthlyPayment);
  
  updateLoanHint();
}

function updateLoanHint() {
  const rating = getCreditRating(getCreditScore(state));
  const maxLoan = rating.maxLoan;
  const hint = document.getElementById('loanMaxHint');
  hint.textContent = CS.t ? CS.t('bank.max_loan', { n: maxLoan, r: rating.label }) : String(maxLoan);
}

function takeLoan(amount, months) {
  const rating = getCreditRating(getCreditScore(state));
  const maxLoan = rating.maxLoan;
  
  if (amount > maxLoan) {
    alert(`Ваш кредитный рейтинг (${rating.emoji} ${rating.label}) позволяет взять максимум ${maxLoan}💰`);
    return false;
  }
  
  const rateConfig = BANK_CONFIG.loanRates.find(r => r.months === months);
  if (!rateConfig) return false;
  
  const rate = Math.max(0.05, rateConfig.rate + rating.interestBonus);
  
  state.cash += amount;
  state.bank.loans.push({
    amount: amount,
    rate: rate,
    months: months,
    startTime: Date.now(),
    paid: false
  });
  
  addBankHistory(state, `Взят кредит на ${amount}💰 (${months} мес., ${Math.round(rate*100)}%)`, 'bank-loan');
  return true;
}

async function onTakeLoan() {
  const input = document.getElementById('loanAmount');
  const amount = parseInt(input.value);
  if (!amount || amount <= 0) {
    document.getElementById('loansSection').classList.add('shake');
    setTimeout(() => document.getElementById('loansSection').classList.remove('shake'), 130);
    return;
  }
  
  if (takeLoan(amount, selectedLoanTerm)) {
    CS.saveState(state);
  }
}

function payLoan(idx) {
  const loan = state.bank.loans[idx];
  if (!loan || loan.paid) return;
  
  const monthsPassed = Math.floor((Date.now() - loan.startTime) / (30 * 1000));
  const totalWithInterest = loan.amount * (1 + loan.rate);
  const paidSoFar = Math.min(totalWithInterest, (loan.amount / loan.months) * Math.min(monthsPassed, loan.months));
  const remaining = totalWithInterest - paidSoFar;
  
  if (state.cash < remaining) {
    alert(`Не хватает денег! Нужно ${Math.round(remaining)}💰`);
    return;
  }
  
  state.cash -= Math.round(remaining);
  loan.paid = true;
  addBankHistory(state, `Погашен кредит: -${Math.round(remaining)}💰`, 'bank-payment');
  CS.saveState(state);
}

function renderMortgages() {
  const list = document.getElementById('mortgageList');
  list.innerHTML = '';
  
  CS.PROPERTIES.forEach((prop) => {
    const owned = state.properties[prop.id] || 0;
    const cashPrice = CS.propertyCost(state, prop.id);
    const markup = BANK_CONFIG.mortgagePriceMarkup || 1.28;
    const mortgagePrice = Math.round(cashPrice * markup);
    const downPayment = Math.round(mortgagePrice * BANK_CONFIG.minDownPayment);
    const canAfford = state.cash >= downPayment;
    const hasMortgage = state.bank.mortgages.some(m => m.propertyId === prop.id);
    const extraPct = Math.round((markup - 1) * 100);

    const card = document.createElement('div');
    card.className = 'mortgage-card bevel-out';
    card.innerHTML = `
      <div class="mortgage-info">
        <div class="mortgage-property">${prop.icon} ${prop.name}</div>
        <div>За кэш: ${cashPrice}💰 · В ипотеку: ${mortgagePrice}💰 (+${extraPct}%)</div>
        <div>Первый взнос: ${downPayment}💰 (20%) · + проценты по ставке</div>
        <div class="mortgage-payment">Доход: +${prop.income}💰/с · Содержание: -${prop.upkeep}💰/с</div>
        ${owned > 0 ? `<div style="color:#2a7a3a;">✅ Уже в собственности: ${owned} шт.</div>` : ''}
        ${hasMortgage ? `<div style="color:#8a6a2a;">🏠 В ипотеке</div>` : ''}
      </div>
      <div>
        ${!hasMortgage && owned === 0 ? `
          <button class="win95-btn bevel-out bank-btn-sm mortgage-btn" 
                  ${canAfford ? '' : 'disabled'}>
            ${CS.t ? CS.t('bank.mortgage_from', { n: downPayment }) : downPayment}
          </button>
        ` : ''}
        ${hasMortgage ? `
          <button class="win95-btn bevel-out bank-btn-sm mortgage-pay-btn">
            💰 Погасить ипотеку
          </button>
        ` : ''}
      </div>
    `;
    list.appendChild(card);
    
    const btn = card.querySelector('.mortgage-btn');
    if (btn) btn.addEventListener('click', () => takeMortgage(prop.id));
    
    const payBtn = card.querySelector('.mortgage-pay-btn');
    if (payBtn) payBtn.addEventListener('click', () => payMortgage(prop.id));
  });
  
  if (state.bank.mortgages.length > 0) {
    const header = document.createElement('div');
    header.className = 'bank-hint bevel-in';
    header.style.marginTop = '8px';
    header.textContent = (CS.t ? CS.t('m.c8272c38d4') : '🏠 Активные ипотеки:');
    list.appendChild(header);
    
    state.bank.mortgages.forEach((m, idx) => {
      const prop = CS.PROPERTIES.find(p => p.id === m.propertyId);
      if (!prop) return;
      
      const remaining = m.totalAmount - m.paidAmount;
      const monthsPassed = Math.floor((Date.now() - m.startTime) / (30 * 1000));
      const isOverdue = monthsPassed > m.months;
      
      const card = document.createElement('div');
      card.className = 'mortgage-card bevel-out';
      card.innerHTML = `
        <div class="mortgage-info">
          <div class="mortgage-property">${prop.icon} ${prop.name}</div>
          <div class="mortgage-balance">Остаток: ${Math.round(remaining)}💰</div>
          <div class="mortgage-payment">${CS.t ? CS.t('bank.monthly', { n: Math.round(m.monthlyPayment) }) : m.monthlyPayment} · 
            ${isOverdue ? (CS.t ? CS.t('m.05249b1151') : '') : (CS.t ? CS.t('bank.mo_passed', { a: Math.min(monthsPassed, m.months), b: m.months }) : '')}
          </div>
        </div>
        <div>
          <button class="win95-btn bevel-out bank-btn-sm mortgage-pay-btn" data-idx="${idx}">
            💰 Погасить досрочно (${Math.round(remaining)}💰)
          </button>
        </div>
      `;
      list.appendChild(card);
      
      card.querySelector('.mortgage-pay-btn').addEventListener('click', () => payMortgage(m.propertyId));
    });
  }
}

function takeMortgage(propertyId) {
  const prop = CS.PROPERTIES.find(p => p.id === propertyId);
  if (!prop) return;

  const cashPrice = CS.propertyCost(state, propertyId);
  const markup = BANK_CONFIG.mortgagePriceMarkup || 1.28;
  const price = Math.round(cashPrice * markup); // цена в ипотеку выше наличной
  const downPayment = Math.round(price * BANK_CONFIG.minDownPayment);

  if (state.cash < downPayment) {
    alert(`Не хватает на первый взнос! Нужно ${downPayment}💰 (в ипотеку объект дороже: ${price}💰 вместо ${cashPrice}💰 за кэш)`);
    return;
  }

  const term = prompt(CS.t ? CS.t('bank.mortgage_term') : '3,5,10,15,20', '10');
  const months = parseInt(term);
  if (!BANK_CONFIG.mortgageTerms.includes(months)) {
    alert(CS.t ? CS.t('bank.mortgage_term_bad') : '3/5/10/15/20');
    return;
  }

  const rating = getCreditRating(getCreditScore(state));
  const baseRate = BANK_CONFIG.mortgageBaseRate != null ? BANK_CONFIG.mortgageBaseRate : 0.12;
  const rate = Math.max(0.04, baseRate + rating.interestBonus);
  const loanAmount = price - downPayment;
  const totalWithInterest = loanAmount * (1 + rate);
  const monthlyPayment = totalWithInterest / months;
  const totalCost = downPayment + totalWithInterest;

  state.cash -= downPayment;
  state.properties[propertyId] = (state.properties[propertyId] || 0) + 1;

  state.bank.mortgages.push({
    propertyId: propertyId,
    cashPrice: cashPrice,
    mortgagePrice: price,
    totalAmount: totalWithInterest,
    paidAmount: 0,
    months: months,
    monthlyPayment: monthlyPayment,
    rate: rate,
    startTime: Date.now(),
    downPayment: downPayment
  });

  addBankHistory(
    state,
    `Оформлена ипотека на ${prop.name}: цена ${price}💰 (кэш ${cashPrice}), взнос ${downPayment}, всего к выплате ~${Math.round(totalCost)}💰 (${months} мес., ${Math.round(rate * 100)}%)`,
    'bank-mortgage'
  );
  CS.saveState(state);
}

function payMortgage(propertyId) {
  const mortgage = state.bank.mortgages.find(m => m.propertyId === propertyId);
  if (!mortgage) return;
  
  const remaining = mortgage.totalAmount - mortgage.paidAmount;
  if (state.cash < remaining) {
    alert(`Не хватает денег! Нужно ${Math.round(remaining)}💰`);
    return;
  }
  
  state.cash -= Math.round(remaining);
  mortgage.paidAmount = mortgage.totalAmount;
  addBankHistory(state, `Погашена ипотека на ${propertyId}: -${Math.round(remaining)}💰`, 'bank-payment');
  
  const idx = state.bank.mortgages.indexOf(mortgage);
  if (idx !== -1) state.bank.mortgages.splice(idx, 1);
  
  CS.saveState(state);
}

function renderHistory() {
  const log = document.getElementById('bankHistoryLog');
  log.innerHTML = '';
  
  const history = state.bank.history || [];
  if (history.length === 0) {
    log.innerHTML = '<div style="color: #888;">' + (CS.t ? CS.t('bank.empty_history') : '') + '</div>';
    return;
  }
  
  history.slice(0, 50).forEach(item => {
    const div = document.createElement('div');
    div.className = item.type || '';
    div.textContent = `[${item.time || new Date().toLocaleTimeString()}] ${item.text}`;
    log.appendChild(div);
  });
}

function addBankHistory(state, text, type) {
  if (!state.bank.history) state.bank.history = [];
  state.bank.history.unshift({
    text: text,
    type: type || 'bank',
    time: new Date().toLocaleTimeString()
  });
  if (state.bank.history.length > 100) state.bank.history.pop();
}

function bankTick(state) {
  if (!state.bank) return;
  
  // Обработка кредитов
  state.bank.loans.forEach((loan, idx) => {
    if (loan.paid) return;
    const monthsPassed = Math.floor((Date.now() - loan.startTime) / (30 * 1000));
    if (monthsPassed >= loan.months) {
      const totalWithInterest = loan.amount * (1 + loan.rate);
      const paidSoFar = Math.min(totalWithInterest, (loan.amount / loan.months) * loan.months);
      const remaining = totalWithInterest - paidSoFar;
      
      if (state.cash >= remaining) {
        state.cash -= Math.round(remaining);
        loan.paid = true;
        addBankHistory(state, `Автоматическое погашение кредита: -${Math.round(remaining)}💰`, 'bank-payment');
      } else {
        state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + 10);
        state.debt = (state.debt || 0) + remaining * 0.2;
        addBankHistory(state, `Просрочка кредита! Штраф ${Math.round(remaining * 0.2)}💰, стресс +10`, 'bank-loan');
      }
    }
  });
  
  // Обработка ипотеки
  state.bank.mortgages.forEach((mortgage) => {
    const monthsPassed = Math.floor((Date.now() - mortgage.startTime) / (30 * 1000));
    if (monthsPassed >= mortgage.months) {
      const remaining = mortgage.totalAmount - mortgage.paidAmount;
      if (state.cash >= remaining) {
        state.cash -= Math.round(remaining);
        mortgage.paidAmount = mortgage.totalAmount;
        addBankHistory(state, `Ипотека погашена автоматически: -${Math.round(remaining)}💰`, 'bank-payment');
      } else {
        const prop = CS.PROPERTIES.find(p => p.id === mortgage.propertyId);
        if (prop && state.properties[prop.id] > 0) {
          state.properties[prop.id]--;
          state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + 20);
          addBankHistory(state, `Недвижимость изъята за неуплату ипотеки! Стресс +20`, 'bank-mortgage');
        }
        const idx = state.bank.mortgages.indexOf(mortgage);
        if (idx !== -1) state.bank.mortgages.splice(idx, 1);
      }
    } else if (monthsPassed > 0 && monthsPassed % 1 === 0) {
      const payment = Math.min(mortgage.monthlyPayment, mortgage.totalAmount - mortgage.paidAmount);
      if (state.cash >= payment) {
        state.cash -= Math.round(payment);
        mortgage.paidAmount += payment;
        addBankHistory(state, `Ипотечный платёж: -${Math.round(payment)}💰`, 'bank-payment');
      } else {
        state.burnout = Math.min(CS.CONFIG.MAX_BURNOUT, state.burnout + 5);
        state.debt = (state.debt || 0) + payment * 0.1;
        addBankHistory(state, `Просрочка ипотеки! Штраф ${Math.round(payment * 0.1)}💰, стресс +5`, 'bank-mortgage');
      }
    }
  });
}

// Интеграция в основной тик
const originalTick = CS.tick;
CS.tick = function(state) {
  originalTick(state);
  if (state.bank) {
    bankTick(state);
  }
};

init();