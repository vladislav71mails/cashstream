// ============================================================================
// Казино «Перерыв» — та же механика рулетки/слотов, но кошелёк общий с игрой
// (chrome.storage.local через shared.js), и каждый раунд снимает выгорание.
// ============================================================================

let balance = 0;
let currentBet = 10;
let slotBet = 10;
let currentBetType = null;
let currentBetValue = null;
let isSpinning = false;
let csState = null;

const slotSymbols = ['💼', '🪪', '🖋️', '🥂', '📈', '☕', '📎'];

const rouletteNumbers = [
    { number: 0, color: 'green' },
    { number: 32, color: 'red' }, { number: 15, color: 'black' }, { number: 19, color: 'red' },
    { number: 4, color: 'black' }, { number: 21, color: 'red' }, { number: 2, color: 'black' },
    { number: 25, color: 'red' }, { number: 17, color: 'black' }, { number: 34, color: 'red' },
    { number: 6, color: 'black' }, { number: 27, color: 'red' }, { number: 13, color: 'black' },
    { number: 36, color: 'red' }, { number: 11, color: 'black' }, { number: 30, color: 'red' },
    { number: 8, color: 'black' }, { number: 23, color: 'red' }, { number: 10, color: 'black' },
    { number: 5, color: 'red' }, { number: 24, color: 'black' }, { number: 16, color: 'red' },
    { number: 33, color: 'black' }, { number: 1, color: 'red' }, { number: 20, color: 'black' },
    { number: 14, color: 'red' }, { number: 31, color: 'black' }, { number: 9, color: 'red' },
    { number: 22, color: 'black' }, { number: 18, color: 'red' }, { number: 29, color: 'black' },
    { number: 7, color: 'red' }, { number: 28, color: 'black' }, { number: 12, color: 'red' },
    { number: 35, color: 'black' }, { number: 3, color: 'red' }, { number: 26, color: 'black' }
];

let rouletteCanvas = null;
let rouletteCtx = null;
let rouletteRotation = 0;
const rouletteRadius = 140;

document.addEventListener('DOMContentLoaded', async function () {
    try {
        csState = await CS.loadState();
        balance = csState.cash;
        updateBalance();
        renderHistory();

        initializeRouletteCanvas();
        initializeEventListeners();
        setTimeout(createMiniRoulette, 100);

        // если баланс изменился в другой вкладке/попапе (например, кликами) — подхватываем
        CS.onStateChanged((newState) => {
            if (isSpinning) return; // не дёргаем баланс посреди анимации
            csState = newState;
            balance = csState.cash;
            updateBalance();
            renderHistory();
        });
    } catch (err) {
        CS.reportFatalError(err);
    }
});

function initializeRouletteCanvas() {
    rouletteCanvas = document.getElementById('rouletteCanvas');
    if (!rouletteCanvas) return;
    rouletteCtx = rouletteCanvas.getContext('2d');
    rouletteCanvas.width = 300;
    rouletteCanvas.height = 300;
    drawRoulette();
}

function drawRoulette() {
    if (!rouletteCtx) return;
    const centerX = rouletteCanvas.width / 2;
    const centerY = rouletteCanvas.height / 2;

    rouletteCtx.clearRect(0, 0, rouletteCanvas.width, rouletteCanvas.height);
    rouletteCtx.save();
    rouletteCtx.translate(centerX, centerY);
    rouletteCtx.rotate(rouletteRotation * Math.PI / 180);

    const numSectors = rouletteNumbers.length;
    const sectorAngle = (2 * Math.PI) / numSectors;

    for (let i = 0; i < numSectors; i++) {
        const startAngle = i * sectorAngle - Math.PI / 2;
        const endAngle = (i + 1) * sectorAngle - Math.PI / 2;
        const sectorData = rouletteNumbers[i];
        let color;
        switch (sectorData.color) {
            case 'red': color = '#ff4757'; break;
            case 'black': color = '#2f3542'; break;
            case 'green': color = '#2ed573'; break;
            default: color = '#3742fa';
        }

        rouletteCtx.beginPath();
        rouletteCtx.moveTo(0, 0);
        rouletteCtx.arc(0, 0, rouletteRadius, startAngle, endAngle);
        rouletteCtx.closePath();
        rouletteCtx.fillStyle = color;
        rouletteCtx.fill();
        rouletteCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        rouletteCtx.lineWidth = 1;
        rouletteCtx.stroke();

        const textAngle = startAngle + sectorAngle / 2;
        const textRadius = rouletteRadius * 0.7;
        const textX = Math.cos(textAngle) * textRadius;
        const textY = Math.sin(textAngle) * textRadius;

        rouletteCtx.save();
        rouletteCtx.translate(textX, textY);
        rouletteCtx.rotate(textAngle + Math.PI / 2);
        rouletteCtx.fillStyle = 'white';
        rouletteCtx.font = 'bold 12px Arial';
        rouletteCtx.textAlign = 'center';
        rouletteCtx.textBaseline = 'middle';
        rouletteCtx.fillText(sectorData.number.toString(), 0, 0);
        rouletteCtx.restore();
    }

    rouletteCtx.beginPath();
    rouletteCtx.arc(0, 0, rouletteRadius * 0.3, 0, 2 * Math.PI);
    rouletteCtx.fillStyle = '#ffd700';
    rouletteCtx.fill();
    rouletteCtx.strokeStyle = '#ff4757';
    rouletteCtx.lineWidth = 4;
    rouletteCtx.stroke();

    rouletteCtx.restore();
}

function createMiniRoulette() {
    const betGroup = document.querySelector('.bet-group:nth-child(3)');
    if (!betGroup) return;

    let miniRoulette = document.querySelector('.mini-roulette');
    if (!miniRoulette) {
        miniRoulette = document.createElement('div');
        miniRoulette.className = 'mini-roulette';
        const numberBets = betGroup.querySelector('.number-bets');
        if (numberBets) numberBets.after(miniRoulette);
    }

    miniRoulette.innerHTML = '';
    rouletteNumbers.forEach(item => {
        const miniNumber = document.createElement('div');
        miniNumber.className = `mini-number ${item.color}`;
        miniNumber.textContent = item.number;
        miniNumber.dataset.number = item.number;
        miniNumber.dataset.color = item.color;

        miniNumber.addEventListener('click', function () {
            if (isSpinning) return;
            document.querySelectorAll('.mini-number').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.number-bet').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.bet-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentBetType = 'number';
            currentBetValue = item.number;
            document.getElementById('selectedNumber').textContent = item.number;
        });

        miniRoulette.appendChild(miniNumber);
    });
}

function initializeEventListeners() {
    document.getElementById('rouletteTab').addEventListener('click', () => switchGame('roulette'));
    document.getElementById('slotsTab').addEventListener('click', () => switchGame('slots'));

    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentBet = parseInt(this.dataset.amount);
            document.getElementById('currentBet').textContent = currentBet;
        });
    });

    document.querySelectorAll('.slot-bet-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.slot-bet-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            slotBet = parseInt(this.dataset.amount);
            document.getElementById('slotBet').textContent = slotBet;
        });
    });

    document.querySelectorAll('.bet-option').forEach(btn => {
        btn.addEventListener('click', function () {
            if (isSpinning) return;
            const group = this.parentNode;
            group.querySelectorAll('.bet-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentBetType = this.dataset.type;
            currentBetValue = this.dataset.value;
            if (currentBetType !== 'number') {
                document.querySelectorAll('.mini-number').forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.number-bet').forEach(b => b.classList.remove('active'));
                document.getElementById('selectedNumber').textContent = 'нет';
            }
        });
    });

    document.querySelectorAll('.number-bet').forEach(btn => {
        btn.addEventListener('click', function () {
            if (isSpinning) return;
            document.querySelectorAll('.number-bet').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mini-number').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.bet-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const number = this.dataset.value;
            const miniNumber = document.querySelector(`.mini-number[data-number="${number}"]`);
            if (miniNumber) miniNumber.classList.add('active');
            currentBetType = 'number';
            currentBetValue = number;
            document.getElementById('selectedNumber').textContent = number;
        });
    });

    document.getElementById('spinRoulette').addEventListener('click', spinRoulette);
    document.getElementById('spinSlots').addEventListener('click', spinSlots);
}

function switchGame(game) {
    document.querySelectorAll('.game-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.game-section').forEach(section => section.classList.remove('active'));
    if (game === 'roulette') {
        document.getElementById('rouletteTab').classList.add('active');
        document.getElementById('rouletteGame').classList.add('active');
    } else {
        document.getElementById('slotsTab').classList.add('active');
        document.getElementById('slotsGame').classList.add('active');
    }
}

function updateBalance() {
    const el = document.getElementById('balance');
    if (el) el.textContent = Math.floor(balance);
}

function renderHistory() {
    const historyElement = document.getElementById('gameHistory');
    if (!historyElement || !csState) return;
    historyElement.innerHTML = '';
    const recent = csState.history.filter(h => h.type === 'casino').slice(0, 5);
    recent.forEach(item => {
        const div = document.createElement('div');
        div.className = `history-item ${item.win ? 'win' : 'loss'}`;
        div.textContent = item.text;
        historyElement.appendChild(div);
    });
}

function spinRoulette() {
    if (isSpinning) return;
    if (balance < currentBet) {
        document.getElementById('rouletteResult').textContent = 'Недостаточно средств!';
        return;
    }
    if (!currentBetType || !currentBetValue) {
        document.getElementById('rouletteResult').textContent = 'Выберите тип ставки!';
        return;
    }

    isSpinning = true;
    const spinBtn = document.getElementById('spinRoulette');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Крутится...';

    balance -= currentBet;
    updateBalance();

    const winningIndex = Math.floor(Math.random() * rouletteNumbers.length);
    const winningNumber = rouletteNumbers[winningIndex].number;
    const winningColor = rouletteNumbers[winningIndex].color;

    window.winningNumber = winningNumber;
    window.winningColor = winningColor;
    window.winningIndex = winningIndex;

    const numSectors = rouletteNumbers.length;
    const sectorAngle = 360 / numSectors;
    const winningSectorAngle = winningIndex * sectorAngle;
    const targetSectorCenterAngle = winningSectorAngle + sectorAngle / 2;
    const currentNormalizedRotation = rouletteRotation % 360;

    const fullSpins = 5 + Math.floor(Math.random() * 3);
    let targetRotation = fullSpins * 360;
    targetRotation += (360 - targetSectorCenterAngle - 90) % 360;
    const randomOffset = (Math.random() - 0.5) * sectorAngle * 0.3;
    targetRotation += randomOffset;

    animateRoulette(null, 3000, currentNormalizedRotation, targetRotation);
}

function animateRoulette(startTime, duration, startRotation, targetRotation) {
    const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        let easeProgress;
        if (progress < 0.7) {
            easeProgress = progress / 0.7;
        } else {
            easeProgress = 1 - Math.pow(1 - ((progress - 0.7) / 0.3), 3);
            easeProgress = 0.7 + easeProgress * 0.3;
        }

        rouletteRotation = startRotation + (targetRotation - startRotation) * easeProgress;
        drawRoulette();

        if (progress > 0.95 && window.winningIndex !== undefined) {
            highlightWinningSector(window.winningIndex);
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            const spinBtn = document.getElementById('spinRoulette');
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fas fa-play"></i> Крутить рулетку';
            checkRouletteResult();
        }
    };
    requestAnimationFrame(animate);
}

function highlightWinningSector(winningIndex) {
    if (!rouletteCtx) return;
    const centerX = rouletteCanvas.width / 2;
    const centerY = rouletteCanvas.height / 2;
    const numSectors = rouletteNumbers.length;
    const sectorAngle = (2 * Math.PI) / numSectors;

    rouletteCtx.save();
    rouletteCtx.translate(centerX, centerY);
    rouletteCtx.rotate(rouletteRotation * Math.PI / 180);

    const startAngle = winningIndex * sectorAngle - Math.PI / 2;
    const endAngle = (winningIndex + 1) * sectorAngle - Math.PI / 2;

    rouletteCtx.beginPath();
    rouletteCtx.moveTo(0, 0);
    rouletteCtx.arc(0, 0, rouletteRadius, startAngle, endAngle);
    rouletteCtx.closePath();

    const gradient = rouletteCtx.createRadialGradient(0, 0, 0, 0, 0, rouletteRadius);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    rouletteCtx.fillStyle = gradient;
    rouletteCtx.fill();

    const textAngle = startAngle + sectorAngle / 2;
    const textRadius = rouletteRadius * 0.7;
    const textX = Math.cos(textAngle) * textRadius;
    const textY = Math.sin(textAngle) * textRadius;

    rouletteCtx.save();
    rouletteCtx.translate(textX, textY);
    rouletteCtx.rotate(textAngle + Math.PI / 2);
    rouletteCtx.fillStyle = '#000000';
    rouletteCtx.font = 'bold 14px Arial';
    rouletteCtx.textAlign = 'center';
    rouletteCtx.textBaseline = 'middle';
    rouletteCtx.fillText(rouletteNumbers[winningIndex].number.toString(), 0, 0);
    rouletteCtx.restore();
    rouletteCtx.restore();
}

async function checkRouletteResult() {
    const winningNumber = window.winningNumber;
    const winningColor = window.winningColor;
    if (!winningNumber && winningNumber !== 0) return;

    let win = false;
    let multiplier = 0;
    let resultText = '';
    let colorName = '';

    switch (winningColor) {
        case 'red': colorName = 'красный'; break;
        case 'black': colorName = 'черный'; break;
        case 'green': colorName = 'зеленый'; break;
    }

    switch (currentBetType) {
        case 'color':
            if (currentBetValue === winningColor) {
                win = true;
                multiplier = currentBetValue === 'green' ? 14 : 2;
            }
            resultText = `Выпало число ${winningNumber} (${colorName})`;
            break;
        case 'parity': {
            const isEven = winningNumber % 2 === 0 && winningNumber !== 0;
            const isOdd = winningNumber % 2 === 1;
            const playerBetEven = currentBetValue === 'even';
            if ((playerBetEven && isEven) || (!playerBetEven && isOdd)) {
                win = true;
                multiplier = 2;
            }
            resultText = `Выпало число ${winningNumber} (${winningNumber === 0 ? 'зеро' : isEven ? 'четное' : 'нечетное'})`;
            break;
        }
        case 'number':
            if (parseInt(currentBetValue) === winningNumber) {
                win = true;
                multiplier = 35;
            }
            resultText = `Выпало число ${winningNumber}`;
            break;
    }

    csState = await CS.loadState();

    if (win) {
        const winnings = currentBet * multiplier;
        balance = csState.cash + winnings;
        CS.applyCasinoResult(csState, winnings, `Биржа: ${resultText}. +${winnings} (x${multiplier})`, true);
        document.getElementById('rouletteResult').innerHTML =
            `<span class="win">${resultText}. Вы выиграли ${winnings}! Множитель: x${multiplier}</span>`;
    } else {
        balance = csState.cash - currentBet;
        CS.applyCasinoResult(csState, -currentBet, `Биржа: ${resultText}. -${currentBet}`, false);
        document.getElementById('rouletteResult').innerHTML =
            `<span class="loss">${resultText}. Вы проиграли ${currentBet}.</span>`;
    }

    CS.saveState(csState);
    updateBalance();
    renderHistory();

    delete window.winningNumber;
    delete window.winningColor;
    delete window.winningIndex;
}

function spinSlots() {
    if (isSpinning) return;
    if (balance < slotBet) {
        document.getElementById('slotsResult').textContent = 'Недостаточно средств!';
        return;
    }

    isSpinning = true;
    const spinBtn = document.getElementById('spinSlots');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Крутится...';

    balance -= slotBet;
    updateBalance();

    const reels = [
        document.getElementById('reel1'),
        document.getElementById('reel2'),
        document.getElementById('reel3')
    ];

    reels.forEach((reel, index) => {
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(-100px)';
        reel.style.opacity = '0.5';
        setTimeout(() => {
            reel.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
            reel.style.transform = 'translateY(0)';
            reel.style.opacity = '1';
        }, index * 200);
    });

    setTimeout(() => {
        const results = [];
        reels.forEach((reel) => {
            const randomSymbol = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
            reel.textContent = randomSymbol;
            results.push(randomSymbol);
        });
        checkSlotWin(results);
    }, 1000);
}

async function checkSlotWin(results) {
    const [a, b, c] = results;
    let winMultiplier = 0;
    let winMessage = '';

    if (a === b && b === c) {
        switch (a) {
            case '💼': winMultiplier = 100; winMessage = 'ДЖЕКПОТ! Тройной кейс'; break;
            case '🪪': winMultiplier = 50; winMessage = '3 визитки — новые контакты!'; break;
            case '🖋️': winMultiplier = 20; winMessage = '3 печати — сделка подписана'; break;
            case '🥂': winMultiplier = 10; winMessage = '3 бокала — сделка отмечена'; break;
            case '📈': winMultiplier = 5; winMessage = '3 графика роста'; break;
            case '☕': winMultiplier = 3; winMessage = '3 чашки кофе'; break;
            case '📎': winMultiplier = 2; winMessage = '3 скрепки'; break;
        }
    }

    setTimeout(async () => {
        csState = await CS.loadState();
        const spinBtn = document.getElementById('spinSlots');

        if (winMultiplier > 0) {
            const winnings = slotBet * winMultiplier;
            balance = csState.cash + winnings;
            CS.applyCasinoResult(csState, winnings, `Встреча: ${winMessage}. +${winnings}`, true);
            document.getElementById('slotsResult').innerHTML =
                `<span class="win">${winMessage}! Вы выиграли ${winnings}!</span>`;
        } else {
            balance = csState.cash - slotBet;
            CS.applyCasinoResult(csState, -slotBet, `Встреча: ${results.join(' ')}. -${slotBet}`, false);
            document.getElementById('slotsResult').innerHTML =
                `<span class="loss">${results.join(' ')}. Вы проиграли ${slotBet}.</span>`;
        }

        CS.saveState(csState);
        updateBalance();
        renderHistory();

        isSpinning = false;
        spinBtn.disabled = false;
        spinBtn.innerHTML = '<i class="fas fa-play"></i> Крутить встречу';
    }, 1500);
}
