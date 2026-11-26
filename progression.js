// =========================================================================
// === ГЛУБОКАЯ СИСТЕМА ПРОГРЕССИИ: ЛАБОРАТОРИЯ, СТРИК ПОБЕД И ТИТУЛЫ ===
// =========================================================================

let prog = {
    upgCoins: 0,          // Уровень улучшения «Катализатор монет» (0..10)
    upgExp: 0,            // Уровень улучшения «Ускоритель опыта» (0..10)
    upgFreeUndo: 0,       // Уровень улучшения «Интуиция» (0..5)
    winStreak: 0,         // Текущая серия побед подряд без отмен и рестартов
    bestStreak: 0,        // Лучшая серия побед за всё время
    fastWins: 0,          // Сколько этапов пройдено за <= 12 ходов
    equippedTitle: 'auto' // Какой титул игрок надел вручную ('auto' или id титула)
};

try {
    const savedProg = JSON.parse(localStorage.getItem('panichka_sort_prog'));
    if (savedProg) prog = { ...prog, ...savedProg };
} catch (e) {}

function saveProg() {
    try { localStorage.setItem('panichka_sort_prog', JSON.stringify(prog)); } catch (e) {}
}

// 3 ветки постоянной прокачки за монеты с понятным описанием и расчётом итогового бонуса
const UPGRADES = [
    {
        id: 'coins', key: 'upgCoins', max: 10, baseCost: 150, stepCost: 120, perLvl: 10,
        name: { ru: '🔬 Катализатор монет', en: '🔬 Coin Catalyst', tr: '🔬 Altın Katalizörü' },
        desc: {
            ru: 'Больше монет за прохождение этапов (+{val}%)',
            en: 'More coins for completing stages (+{val}%)',
            tr: 'Aşama tamamlama ödülüne bonus (+%{val})'
        }
    },
    {
        id: 'exp', key: 'upgExp', max: 10, baseCost: 120, stepCost: 100, perLvl: 15,
        name: { ru: '⚡ Ускоритель опыта', en: '⚡ EXP Booster', tr: '⚡ EXP Hızlandırıcı' },
        desc: {
            ru: 'Ускоряет получение опыта Ранга (+{val}%)',
            en: 'Increases Rank EXP gained (+{val}%)',
            tr: 'Rütbe EXP kazanımını artırır (+%{val})'
        }
    },
    {
        id: 'undo', key: 'upgFreeUndo', max: 5, baseCost: 250, stepCost: 200, perLvl: 10,
        name: { ru: '🧠 Интуиция отмены', en: '🧠 Free Undo %', tr: '🧠 Ücretsiz Geri Al' },
        desc: {
            ru: 'Шанс отменить ход бесплатно без траты монет ({val}%)',
            en: 'Chance to undo a move for free ({val}%)',
            tr: 'Hamleyi ücretsiz geri alma şansı (%{val})'
        }
    }
];

// Уникальные титулы за разные стили игры и подвиги (каждый даёт свой бонус!)
const SPECIAL_TITLES = [
    { id: 'novice',    bonusMult: 1.0,  check: () => true,                        name: { ru: '🌱 Новичок',         en: '🌱 Novice',        tr: '🌱 Acemi' },        desc: { ru: 'Базовый титул', en: 'Starter title', tr: 'Başlangıç' } },
    { id: 'alchemist', bonusMult: 1.15, check: () => extra.accLvl >= 5,           name: { ru: '🧪 Алхимик',         en: '🧪 Alchemist',     tr: '🧪 Simyacı' },      desc: { ru: 'Достигни 5-го Ранга', en: 'Reach Rank 5', tr: '5. Rütbe' } },
    { id: 'speedster', bonusMult: 1.25, check: () => prog.fastWins >= 3,          name: { ru: '⚡ Спидраннер',      en: '⚡ Speedrunner',   tr: '⚡ Hız Ustası' },   desc: { ru: 'Пройди 3 этапа за ≤12 ходов', en: '3 stages in ≤12 moves', tr: '≤12 hamlede 3 aşama' } },
    { id: 'streak5',   bonusMult: 1.35, check: () => prog.bestStreak >= 5,        name: { ru: '🔥 Непобедимый',     en: '🔥 Unstoppable',   tr: '🔥 Durdurulamaz' }, desc: { ru: 'Серия из 5 побед без отмен', en: '5 win streak no undo', tr: '5 seri galibiyet' } },
    { id: 'collector', bonusMult: 1.45, check: () => lastKnownOwnedCount >= 6,    name: { ru: '💎 Коллекционер',    en: '💎 Collector',     tr: '💎 Koleksiyoncu' }, desc: { ru: 'Открой 6 предметов магазина', en: 'Unlock 6 shop items', tr: '6 mağaza öğesi' } },
    { id: 'tycoon',    bonusMult: 1.6,  check: () => state.coins >= 5000,         name: { ru: '💰 Неоновый Магнат', en: '💰 Neon Tycoon',   tr: '💰 Neon Kralı' },   desc: { ru: 'Накопи 5 000 монет', en: 'Hold 5,000 coins', tr: '5.000 altın biriktir' } },
    { id: 'legend',    bonusMult: 2.0,  check: () => extra.accLvl >= 100,         name: { ru: '👑 Легенда Неона',   en: '👑 Neon Legend',   tr: '👑 Neon Efsanesi' },desc: { ru: 'Достигни 100-го Ранга', en: 'Reach Rank 100', tr: '100. Rütbe' } }
];

function getActiveSpecialTitle() {
    const unlocked = SPECIAL_TITLES.filter(t => t.check());
    if (prog.equippedTitle !== 'auto') {
        const chosen = unlocked.find(t => t.id === prog.equippedTitle);
        if (chosen) return chosen;
    }
    return unlocked.at(-1) || SPECIAL_TITLES.at(0);
}

// =========================================================================
// === ОКНО ЛАБОРАТОРИИ (⚗️), ЗАЛ ТИТУЛОВ И СЧЁТЧИК СЕРИИ ПОБЕД (🔥) ===
// =========================================================================

window.addEventListener('load', () => {
    // 1. Добавляем кнопку Лаборатории улучшений (⚗️) в верхнюю левую панель
    const topLeft = document.querySelector('.top-bar .btn-group');
    if (topLeft && !document.getElementById('lab-btn')) {
        topLeft.insertAdjacentHTML('beforeend', '<button class="icon-btn" id="lab-btn" onclick="openLabModal()" title="Лаборатория">⚗️</button>');
    }

    // 2. Делаем плашку титула вверху кликабельной (открывает Зал Титулов) и добавляем значок Стрика 🔥
    const badge = document.getElementById('title-badge');
    if (badge) {
        badge.style.cursor = 'pointer';
        badge.style.border = '1px solid rgba(251,191,36,0.45)';
        badge.onclick = openTitlesModal;
    }

    const header = document.querySelector('.header');
    if (header && !document.getElementById('streak-box')) {
        header.insertAdjacentHTML('beforeend', '<div class="stat-box" id="streak-box" style="text-align:center;"><span class="stat-label" id="streak-lbl">Серия</span><span class="stat-value" id="streak-val" style="color:#f97316;">🔥 0</span></div>');
    }

    // 3. Добавляем модальные окна для Лаборатории и Зала Титулов
    const board = document.getElementById('board-area');
    if (board && !document.getElementById('lab-modal')) {
        board.insertAdjacentHTML('beforeend', `
            <div id="lab-modal" class="modal">
                <h2>⚗️ <span id="lab-title">Лаборатория</span></h2>
                <div class="modal-list" id="lab-list"></div>
                <button class="action-btn btn-gray modal-btn-sm" onclick="closeModals()"><span data-t="close">Закрыть</span></button>
            </div>
            <div id="titles-modal" class="modal">
                <h2>🎖 <span id="titles-title">Зал Титулов</span></h2>
                <div class="modal-list" id="titles-list"></div>
                <button class="action-btn btn-gray modal-btn-sm" onclick="closeModals()"><span data-t="close">Закрыть</span></button>
            </div>
        `);
    }

    updateStreakUI();
    refreshTitleBadge();
});

function updateStreakUI() {
    const val = document.getElementById('streak-val');
    const lbl = document.getElementById('streak-lbl');
    if (val) val.textContent = '🔥 ' + prog.winStreak;
    if (lbl) lbl.textContent = currentLang === 'en' ? 'Streak' : (currentLang === 'tr' ? 'Seri' : 'Серия');
}

refreshTitleBadge = function() {
    const badge = document.getElementById('title-badge');
    if (!badge) return;
    const tObj = getActiveSpecialTitle();
    const label = tObj.name[currentLang] || tObj.name.ru;
    const totalMult = (tObj.bonusMult + prog.upgCoins * 0.1).toFixed(2);
    badge.textContent = label + ' (x' + totalMult + ') ▾';
};

function openLabModal() {
    closeModals();
    const titleEl = document.getElementById('lab-title');
    if (titleEl) titleEl.textContent = currentLang === 'en' ? 'Upgrade Lab' : (currentLang === 'tr' ? 'Laboratuvar' : 'Лаборатория');
    const list = document.getElementById('lab-list');

    const lvlWord = currentLang === 'en' ? 'Lvl' : (currentLang === 'tr' ? 'Sv.' : 'Ур.');

    list.innerHTML = UPGRADES.map(u => {
        const curLvl = prog[u.key] || 0;
        const isMax = curLvl >= u.max;
        const cost = u.baseCost + curLvl * u.stepCost;
        const totalBonus = curLvl * u.perLvl;
        const name = u.name[currentLang] || u.name.ru;
        const rawDesc = u.desc[currentLang] || u.desc.ru;
        const finalDesc = rawDesc.replace('{val}', totalBonus);

        const btn = isMax
            ? '<button class="mini-btn equipped">MAX</button>'
            : '<button class="mini-btn" style="background:#d97706;" onclick="buyUpgrade(\'' + u.id + '\')">$' + cost + '</button>';

        return '<div class="card-item" style="gap:10px;"><div style="text-align:left;">' +
            '<div style="font-size:13px;font-weight:800;">' + name + ' <span style="color:#fbbf24;font-size:11px;">(' + lvlWord + ' ' + curLvl + '/' + u.max + ')</span></div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.3;">' + finalDesc + '</div>' +
        '</div>' + btn + '</div>';
    }).join('');
    document.getElementById('lab-modal').style.display = 'flex';
}

function buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return;
    const curLvl = prog[u.key] || 0;
    const cost = u.baseCost + curLvl * u.stepCost;
    if (curLvl >= u.max || state.coins < cost) return;

    state.coins -= cost;
    prog[u.key] = curLvl + 1;
    saveProgress();
    saveProg();
    playTone(740, 0.2);
    renderBoard();
    refreshTitleBadge();
    openLabModal();
}

function openTitlesModal() {
    closeModals();
    const titleEl = document.getElementById('titles-title');
    if (titleEl) titleEl.textContent = currentLang === 'en' ? 'Hall of Titles' : (currentLang === 'tr' ? 'Unvan Salonu' : 'Зал Титулов');
    const list = document.getElementById('titles-list');
    const active = getActiveSpecialTitle();

    list.innerHTML = SPECIAL_TITLES.map(tObj => {
        const unlocked = tObj.check();
        const isEquipped = active.id === tObj.id;
        const name = tObj.name[currentLang] || tObj.name.ru;
        const desc = tObj.desc[currentLang] || tObj.desc.ru;
        let act = '<span style="color:#64748b;font-size:12px;">🔒</span>';
        if (isEquipped) act = '<button class="mini-btn equipped">' + t('selected') + '</button>';
        else if (unlocked) act = '<button class="mini-btn" onclick="equipSpecialTitle(\'' + tObj.id + '\')">' + (currentLang === 'en' ? 'Equip' : (currentLang === 'tr' ? 'Kullan' : 'Надеть')) + '</button>';

        return '<div class="card-item ' + (isEquipped ? 'active-skin' : '') + '"><div style="text-align:left;"><div style="font-size:13px;font-weight:800;">' + name + ' <span style="color:#fbbf24;">(x' + tObj.bonusMult + ')</span></div><div style="font-size:11px;color:#94a3b8;">' + desc + '</div></div>' + act + '</div>';
    }).join('');
    document.getElementById('titles-modal').style.display = 'flex';
}

function equipSpecialTitle(id) {
    prog.equippedTitle = id;
    saveProg();
    playTone(620, 0.15);
    refreshTitleBadge();
    openTitlesModal();
}

// Перехватываем отмену хода (сброс стрика + шанс бесплатной отмены от «Интуиции»)
const prevUndoForProg = undoMove;
undoMove = function() {
    if (historyStack.length === 0) return;
    if (prog.winStreak > 0) {
        prog.winStreak = 0;
        saveProg();
        updateStreakUI();
    }
    if (prog.upgFreeUndo > 0 && Math.random() < prog.upgFreeUndo * 0.1) {
        const prev = historyStack.pop();
        tubes = prev.tubes;
        movesCount = prev.moves;
        selectedTube = -1;
        playTone(600, 0.15);
        renderBoard();
        showFloatText('🧠 Бесплатная отмена!', '#38bdf8');
        return;
    }
    prevUndoForProg();
};

// Перехватываем рестарт (сброс стрика) и победу (рост стрика + спидран-подвиг + бонусы)
const prevRestartForProg = restartLevel;
restartLevel = function() {
    prog.winStreak = 0;
    saveProg();
    updateStreakUI();
    prevRestartForProg();
};

const prevClaimWinForProg = claimWin;
claimWin = function(mult) {
    const hadWin = document.getElementById('win-modal').style.display === 'flex';
    const lastMoves = movesCount;
    prevClaimWinForProg(mult);
    if (hadWin) {
        prog.winStreak++;
        if (prog.winStreak > prog.bestStreak) prog.bestStreak = prog.winStreak;
        if (lastMoves <= 12) prog.fastWins++;
        const streakBonus = prog.winStreak * 15;
        state.coins += streakBonus;
        saveProgress();
        saveProg();
        updateStreakUI();
        refreshTitleBadge();
        if (prog.winStreak > 1) showFloatText('🔥 Серия x' + prog.winStreak + '! +$' + streakBonus, '#f97316');
    }
};

// Усиливаем получаемый опыт за счёт прокачки «Ускоритель опыта»
const prevGainExpForProg = gainExp;
gainExp = function(pts) {
    const mult = 1 + (prog.upgExp || 0) * 0.15;
    prevGainExpForProg(Math.round(pts * mult));
};

// =========================================================================
// === ЕДИНЫЙ ЭКОНОМИЧЕСКИЙ РЕБАЛАНС (ЦЕНЫ, НАГРАДЫ И КВЕСТЫ) ===
// =========================================================================

// 1. Новые сбалансированные цены в Магазине (Формы, Колбы, Фоны)
const NEW_PRICES = {
    gem: 300, pill: 1200,
    neon: 450, gold: 1800,
    cyber: 600, lab: 1500
};
SKINS.forEach(s => { if (NEW_PRICES[s.id]) s.price = NEW_PRICES[s.id]; });
TUBE_SKINS.forEach(t => { if (NEW_PRICES[t.id]) t.price = NEW_PRICES[t.id]; });
THEMES.forEach(th => {
    if (th.id === 'cyber') th.price = 600;
    if (th.id === 'lab')   th.price = 1500;
    if (th.id === 'gold')  th.price = 3500;
});

// 2. Новые цены улучшений в Лаборатории (окупаемая прогрессия)
UPGRADES.forEach(u => {
    if (u.id === 'coins') { u.baseCost = 250; u.stepCost = 250; }
    if (u.id === 'exp')   { u.baseCost = 200; u.stepCost = 200; }
    if (u.id === 'undo')  { u.baseCost = 400; u.stepCost = 400; }
});

// 3. Корректируем базовую награду за этап ($40 + $5 за номер этапа) и бонус за 1 колбу ($5 вместо $15)
var prevClickClearHint = onTubeClick;
onTubeClick = function(idx) {
    var beforeMoves = movesCount;
    prevClickClearHint(idx);
    if (movesCount > beforeMoves && hintPair.length > 0) {
        hintPair = [];
        renderBoard();
    }
};
// 4. Ребаланс наград во всех 22 квестах под новую экономику
const QUEST_ECONOMY = {
    t5:    { reward: 60,   exp: 50 },
    m100:  { reward: 90,   exp: 70 },
    l3:    { reward: 100,  exp: 80 },
    t15:   { reward: 150,  exp: 110 },
    s3:    { reward: 180,  exp: 130 },
    rk5:   { reward: 220,  exp: 150 },
    l8:    { reward: 260,  exp: 180 },
    t40:   { reward: 350,  exp: 220 },
    m500:  { reward: 450,  exp: 280 },
    rk10:  { reward: 500,  exp: 300 },
    l15:   { reward: 550,  exp: 340 },
    s6:    { reward: 650,  exp: 400 },
    rk15:  { reward: 800,  exp: 450 },
    t150:  { reward: 1000, exp: 550 },
    rk20:  { reward: 1150, exp: 600 },
    l35:   { reward: 1300, exp: 700 },
    rk25:  { reward: 1600, exp: 800 },
    s9:    { reward: 1800, exp: 900 },
    c5000: { reward: 1200, exp: 500 },
    l60:   { reward: 2500, exp: 1100 },
    t500:  { reward: 3200, exp: 1400 },
    c15000:{ reward: 3500, exp: 1500 },
    rk100: { reward: 7500, exp: 2500 },
    l100:  { reward: 8500, exp: 3000 }
};

FULL_QUESTS.forEach(q => {
    if (QUEST_ECONOMY[q.id]) {
        q.reward = QUEST_ECONOMY[q.id].reward;
        q.exp = QUEST_ECONOMY[q.id].exp;
    }
});

// Сортируем квесты от самых лёгких и дешёвых к самым сложным и дорогим
FULL_QUESTS.sort((a, b) => a.reward - b.reward);

// =========================================================================
// === ПАТЧ ИСПРАВЛЕНИЙ: ЗАЩИТА ОТ ФАРМА, ПЕРЕВОДЫ И ТОЧНЫЕ НАГРАДЫ ===
// =========================================================================

// 1. Защита от накрутки монет/опыта через кнопку «Отмена» (считаем макс. собранных колб за этап)
let maxTubesThisStage = 0;
const origGenForFix = generateLevel;
generateLevel = function(lvl) {
    maxTubesThisStage = 0;
    origGenForFix(lvl);
};

// Переопределяем проверку собранных колб без дыры через Undo
onTubeClick = function(idx) {
    const prevSel = selectedTube;
    const movingColor = prevSel !== -1 && tubes.at(prevSel)?.length ? COLORS.at(tubes.at(prevSel).at(-1)) : null;

    // Вызываем базовый клик из game.js напрямую (без двойных оберток)
    if (selectedTube === -1) {
        if (tubes[idx].length === 0) return;
        selectedTube = idx; playTone(440, 0.08); renderBoard(); return;
    }
    if (selectedTube === idx) {
        selectedTube = -1; playTone(320, 0.08); renderBoard(); return;
    }

    const from = tubes[selectedTube];
    const to = tubes[idx];
    const topColor = from[from.length - 1];
    const canMove = to.length < TUBE_CAPACITY && (to.length === 0 || to[to.length - 1] === topColor);

    if (canMove) {
        historyStack.push({ tubes: JSON.parse(JSON.stringify(tubes)), moves: movesCount });
        while (from.length > 0 && from[from.length - 1] === topColor && to.length < TUBE_CAPACITY) {
            to.push(from.pop());
        }
        movesCount++;
        extra.totalMoves = (extra.totalMoves || 0) + 1;
        selectedTube = -1;
        playTone(580, 0.12);
        renderBoard();

        if (movingColor) animateBallFlight(prevSel, idx, movingColor);
        gainExp(5);

        // Награждаем ТОЛЬКО если побит рекорд собранных колб на текущем этапе (нельзя накрутить через Undo!)
        const nowDone = tubes.filter(t => t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))).length;
        if (nowDone > maxTubesThisStage) {
            maxTubesThisStage = nowDone;
            extra.tubesCompleted++;
            state.coins += 5;
            saveProgress();
            saveExtra();
            renderBoard();
            const andW = currentLang === 'en' ? 'and' : (currentLang === 'tr' ? 've' : 'и');
            const realExp = Math.round(15 * (1 + (prog.upgExp || 0) * 0.15));
            showFloatText('✨ +$5 ' + andW + ' +' + realExp + ' EXP!', '#4ade80');
            gainExp(15);
            updateAlertBadges();
        }
        checkWin();
    } else {
        selectedTube = tubes[idx].length > 0 ? idx : -1;
        playTone(220, 0.1);
        renderBoard();
    }
};

// 2. Честный показ награды в окне победы (с учётом Титула и Катализатора) и выдача строго ПОСЛЕ рекламы
checkWin = function() {
    const won = tubes.every(t => t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))));
    if (!won) return;

    const tObj = getActiveSpecialTitle();
    const totalMult = tObj.bonusMult + (prog.upgCoins || 0) * 0.1;
    const totalReward = Math.round((BASE_WIN_REWARD + Math.floor(state.level * 5)) * totalMult);

    document.getElementById('win-reward').textContent = '+$' + totalReward;
    document.getElementById('win-modal').style.display = 'flex';
    playTone(760, 0.25);
    if (ysdk?.features?.GameplayAPI) {
        try { ysdk.features.GameplayAPI.stop(); } catch (e) {}
    }
};

claimWin = function(mult) {
    const tObj = getActiveSpecialTitle();
    const totalMult = tObj.bonusMult + (prog.upgCoins || 0) * 0.1;
    const baseReward = Math.round((BASE_WIN_REWARD + Math.floor(state.level * 5)) * totalMult);
    const lastMoves = movesCount;

    const finishLevel = () => {
        prog.winStreak++;
        if (prog.winStreak > prog.bestStreak) prog.bestStreak = prog.winStreak;
        if (lastMoves <= 12) prog.fastWins++;

        const streakBonus = prog.winStreak * 15;
        state.coins += (baseReward * mult) + streakBonus;
        state.level++;

        saveProgress();
        saveProg();
        updateStreakUI();
        refreshTitleBadge();
        gainExp(80);
        updateAlertBadges();
        submitScoreToLb(state.level);

        closeModals();
        generateLevel(state.level);
        if (prog.winStreak > 1) showFloatText('🔥 x' + prog.winStreak + '! +$' + streakBonus, '#f97316');
        if (mult === 1 && state.level % 3 === 0) showInterstitial();
    };

    if (mult > 1) showRewarded(finishLevel);
    else finishLevel();
};

// 3. Перевод «Подарка дня» на 3 языка (RU / EN / TR)
openDaily = function() {
    closeModals();
    const today = new Date().toDateString();
    const ok = extra.lastDaily !== today;
    const readyTxt = currentLang === 'en' ? 'Your daily gift is ready: +$150!' : (currentLang === 'tr' ? 'Günlük hediyen hazır: +$150!' : 'Ваш подарок дня готов: +$150!');
    const waitTxt  = currentLang === 'en' ? 'Already claimed today! Come back tomorrow!' : (currentLang === 'tr' ? 'Bugün alındı! Yarın tekrar gel!' : 'Подарок сегодня уже получен! Заходите завтра!');

    document.getElementById('d-desc').textContent = ok ? readyTxt : waitTxt;
    document.getElementById('d-btns').innerHTML = ok
        ? '<button class="action-btn btn-next modal-btn" onclick="claimDaily(1)">🎁 +$150</button><button class="action-btn btn-ad modal-btn" onclick="claimDaily(2)">📺 +$300 (x2)</button>'
        : '';
    document.getElementById('daily-modal').style.display = 'flex';
};

// =========================================================================
// === 1. УМНАЯ ПОДСКАЗКА ЗА РЕКЛАМУ (💡) ===
// =========================================================================

var hintPair = [];

// Добавляем кнопку 💡 Подсказка (📺) в нижнюю панель управления при загрузке
window.addEventListener('load', () => {
    var controls = document.querySelector('.controls');
    if (controls && !document.getElementById('hint-btn')) {
        controls.insertAdjacentHTML('afterbegin',
            '<button class="action-btn" id="hint-btn" style="background:linear-gradient(135deg,#0284c7,#2563eb);" onclick="useHintAd()">💡 <span id="hint-lbl">Подсказка</span> 📺</button>'
        );
    }
    updateHintLang();
    renderBoard();
});

function updateHintLang() {
    var lbl = document.getElementById('hint-lbl');
    if (lbl) lbl.textContent = currentLang === 'en' ? 'Hint' : (currentLang === 'tr' ? 'İpucu' : 'Подсказка');
}

var prevCycleLangHint = cycleLang;
cycleLang = function() {
    prevCycleLangHint();
    updateHintLang();
    updateStreakUI();
};

var lastPlayerMove = [-1, -1];

// Запоминаем последний ход игрока, чтобы подсказка никогда не гоняла шар туда-обратно
var trackMoveOrigClick = onTubeClick;
onTubeClick = function(idx) {
    var selBefore = selectedTube;
    var movesBefore = movesCount;
    trackMoveOrigClick(idx);
    if (movesCount > movesBefore && selBefore !== -1) {
        lastPlayerMove = [selBefore, idx];
    }
};

function findBestMove() {
    var bestMove = null;
    var bestScore = -999;

    for (var i = 0; i < tubes.length; i++) {
        // Игнорируем замороженные колбы!
        if (typeof frozenTubes !== 'undefined' && frozenTubes.includes(i)) continue;

        var from = tubes.at(i);
        if (!from || from.length === 0) continue;
        // Пропускаем уже полностью собранные колбы
        if (from.length === TUBE_CAPACITY && from.every(c => c === from.at(0))) continue;

        var topCol = from.at(-1);
        var sameRun = 0;
        for (var k = from.length - 1; k >= 0 && from.at(k) === topCol; k--) sameRun++;
        var isUniform = sameRun === from.length;

        for (var j = 0; j < tubes.length; j++) {
            if (i === j) continue;
            // Нельзя ходить и в замороженную колбу!
            if (typeof frozenTubes !== 'undefined' && frozenTubes.includes(j)) continue;

            var to = tubes.at(j);
            if (!to || to.length >= TUBE_CAPACITY) continue;
            if (to.length > 0 && to.at(-1) !== topCol) continue;

            // 1. Запрещаем бессмысленный перенос однородной стопки в пустую колбу
            if (to.length === 0 && isUniform) continue;

            // 2. Запрещаем делить стопку на части, если целевая колба не вмещает её целиком
            if (to.length + sameRun > TUBE_CAPACITY) continue;

            // 3. Не перекладываем из однородной колбы в другую однородную, если в первой шаров больше или столько же
            if (to.length > 0 && isUniform && to.every(c => c === topCol) && from.length > to.length) continue;

            var score = 0;
            if (to.length > 0) {
                score += 60;
                if (to.length + sameRun === TUBE_CAPACITY && to.every(c => c === topCol)) score += 120; // Закрываем колбу
                if (!isUniform) score += 40; // Открываем новый цвет или знак ? снизу
            } else {
                score += 15; // Перенос в пустую колбу только ради освобождения нижнего слоя
            }

            // Штрафуем обратный ход [to -> from], чтобы никогда не зацикливаться
            if (lastPlayerMove.at(0) === j && lastPlayerMove.at(1) === i) {
                score -= 200;
            }

            if (score > bestScore && score > 0) {
                bestScore = score;
                bestMove = [i, j];
            }
        }
    }
    return bestMove;
}
function useHintAd() {
    var move = findBestMove();
    if (!move) {
        var noTxt = currentLang === 'en' ? 'No moves left! Use +1 Tube' : (currentLang === 'tr' ? 'Hamle kalmadı! +1 Tüp kullan' : 'Ходов нет! Возьми +1 Колбу');
        showFloatText('⚠️ ' + noTxt, '#f87171');
        return;
    }
    showRewarded(() => {
        hintPair = move;
        playTone(720, 0.2);
        renderBoard();
        var msg = currentLang === 'en' ? '💡 Move highlighted!' : (currentLang === 'tr' ? '💡 Hamle gösterildi!' : '💡 Ход подсвечен!');
        showFloatText(msg, '#38bdf8');
    });
}

// =========================================================================
// === 2. БОСС-ЭТАПЫ С ТАЙНЫМИ КОЛБАМИ (?) КАЖДЫЕ 5 УРОВНЕЙ (НАГРАДА x2) ===
// =========================================================================

var revealedMask = []; // Хранит, какие ячейки на босс-этапе уже открыты

function isMysteryStage(lvl) {
    return lvl >= 5 && lvl % 5 === 0;
}

var prevGenMystery = generateLevel;
generateLevel = function(lvl) {
    hintPair = [];
    prevGenMystery(lvl);
    revealedMask = tubes.map(t => t.map((_, idx) => !isMysteryStage(lvl) || idx === t.length - 1));
    renderBoard();

    if (isMysteryStage(lvl)) {
        var bossTxt = currentLang === 'en' ? '❓ MYSTERY STAGE (x2 REWARD!)' : (currentLang === 'tr' ? '❓ GİZEMLİ AŞAMA (x2 ÖDÜL!)' : '❓ ТАЙНЫЙ ЭТАП (НАГРАДА x2!)');
        setTimeout(() => showFloatText(bossTxt, '#c084fc'), 250);
    }
};

// Сбрасываем подсветку подсказки после совершения хода
var prevClickClearHint = onTubeClick;
onTubeClick = function(idx) {
    var beforeMoves = movesCount;
    prevClickClearHint(idx);
    if (movesCount > beforeMoves) hintPair = [];
};

// Удваиваем награду за прохождение Тайного этапа (каждый 5-й уровень)
var prevCheckWinMystery = checkWin;
checkWin = function() {
    prevCheckWinMystery();
    var won = tubes.every(t => t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))));
    if (won && isMysteryStage(state.level)) {
        var rwEl = document.getElementById('win-reward');
        var curVal = parseInt(rwEl.textContent.replace(/\D/g, ''), 10) || 50;
        rwEl.textContent = '+$' + (curVal * 2) + ' (❓ x2!)';
    }
};

// =========================================================================
// === 3. БОНУСНЫЙ СУНДУК ЗА КАЖДЫЕ 3 ПОБЕДЫ ПОДРЯД БЕЗ ОТМЕН (🔥 x3) ===
// =========================================================================

var prevClaimWinChest = claimWin;
claimWin = function(mult) {
    var wasBoss = isMysteryStage(state.level);
    var tObj = getActiveSpecialTitle();
    var totalMult = tObj.bonusMult + (prog.upgCoins || 0) * 0.1;
    var extraBossBonus = wasBoss ? Math.round((BASE_WIN_REWARD + Math.floor(state.level * 5)) * totalMult * mult) : 0;

    prevClaimWinChest(mult);

    if (extraBossBonus > 0) {
        state.coins += extraBossBonus;
        saveProgress();
        renderBoard();
    }

    // Уведомление о бонусе за текущую серию или сундук каждые 3 победы
    if (prog.winStreak > 0 && prog.winStreak % 3 === 0) {
        var chestCoins = 120 + prog.winStreak * 25;
        state.coins += chestCoins;
        extra.accExp += 60;
        saveProgress();
        saveExtra();
        renderBoard();
        if (typeof updateExpUI === 'function') updateExpUI();
        var chestMsg = currentLang === 'en'
            ? '🎁 STREAK x' + prog.winStreak + ' CHEST! +$' + chestCoins + ' & +60 EXP!'
            : (currentLang === 'tr' ? '🎁 SERİ x' + prog.winStreak + ' SANDIĞI! +$' + chestCoins + ' & +60 EXP!' : '🎁 СУНДУК СЕРИИ x' + prog.winStreak + '! +$' + chestCoins + ' и +60 EXP!');
        setTimeout(() => showFloatText(chestMsg, '#fbbf24'), 800);
        playTone(820, 0.3);
    } else if (prog.winStreak >= 2) {
        var streakBonus = prog.winStreak * 15;
        var sMsg = currentLang === 'en'
            ? '🔥 Streak x' + prog.winStreak + ': +$' + streakBonus + ' bonus!'
            : (currentLang === 'tr' ? '🔥 Seri x' + prog.winStreak + ': +$' + streakBonus + ' bonus!' : '🔥 Серия x' + prog.winStreak + ': бонус +$' + streakBonus + '!');
        setTimeout(() => showFloatText(sMsg, '#fb923c'), 800);
    }
};

// Привязываем подсказку к конкретному номеру хода: светит пока movesCount не изменится
var hintActiveAtMove = -1;

var origUseHintAd = useHintAd;
useHintAd = function() {
    var move = findBestMove();
    if (!move) {
        var noTxt = currentLang === 'en' ? 'No moves left! Use +1 Tube' : (currentLang === 'tr' ? 'Hamle kalmadı! +1 Tüp kullan' : 'Ходов нет! Возьми +1 Колбу');
        showFloatText('⚠️ ' + noTxt, '#f87171');
        return;
    }
    showRewarded(() => {
        hintPair = move;
        hintActiveAtMove = movesCount; // Запоминаем номер хода, на котором взята подсказка
        playTone(720, 0.2);
        renderBoard();
        var msg = currentLang === 'en' ? '💡 Move highlighted!' : (currentLang === 'tr' ? '💡 Hamle gösterildi!' : '💡 Ход подсвечен!');
        showFloatText(msg, '#38bdf8');
    });
};

var prevRenderMystery = renderBoard;
renderBoard = function() {
    prevRenderMystery();
    var tubeEls = document.querySelectorAll('#tubes-container .tube');
    tubeEls.forEach((el, tIdx) => {
        if (hintPair.includes(tIdx)) el.classList.add('hint-glow');
        var tData = tubes.at(tIdx) || [];
        
        if (!revealedMask[tIdx]) {
            revealedMask[tIdx] = [true, true, true, true];
        }

        // 1. Верхний шар в любой колбе всегда открыт
        if (tData.length > 0) {
            revealedMask[tIdx][tData.length - 1] = true;
            // 2. Все шары того же цвета, идущие подряд от верха вниз, тоже открываются!
            var topColor = tData[tData.length - 1];
            for (var k = tData.length - 2; k >= 0; k--) {
                if (tData[k] === topColor) revealedMask[tIdx][k] = true;
                else break;
            }
        }

        // 3. Если в колбе все шары одного цвета (например, переложили в пустую колбу) — открываем все
        if (tData.length > 0 && tData.every(c => c === tData[0])) {
            for (var m = 0; m < tData.length; m++) revealedMask[tIdx][m] = true;
        }

        var ballEls = el.querySelectorAll('.ball');
        ballEls.forEach((bEl, bIdx) => {
            if (isMysteryStage(state.level) && !revealedMask[tIdx][bIdx]) {
                bEl.classList.add('mystery-ball');
            }
        });
    });
};

// При отмене хода (Undo) не прячем обратно уже открытые слои и синхронизируем длину revealedMask
var prevUndoMystery = undoMove;
undoMove = function() {
    prevUndoMystery();
    while (revealedMask.length < tubes.length) {
        revealedMask.push([true, true, true, true]);
    }
    renderBoard();
};

// Железобетонный сброс подсветки подсказки сразу после любого хода
var hintTrackedMoves = -1;
var lastRenderWithHintReset = renderBoard;
renderBoard = function() {
    if (hintPair.length > 0) {
        if (hintTrackedMoves === -1) hintTrackedMoves = movesCount;
        else if (movesCount !== hintTrackedMoves) {
            hintPair = [];
            hintTrackedMoves = -1;
        }
    } else {
        hintTrackedMoves = -1;
    }
    lastRenderWithHintReset();
};

// =========================================================================
// === 1. ЭЛИТНЫЕ ДОРОГИЕ СКИНЫ ($15 000 - $50 000) И ПРИЗЫ ИЗ КЕЙСОВ ===
// =========================================================================

if (typeof SHOP_DATA !== 'undefined') {
    if (!SHOP_DATA.bg.some(x => x.id === 'blackhole')) {
        SHOP_DATA.bg.push(
            { id: 'blackhole', price: 25000, name: { ru: '🌌 Чёрная дыра (Элит)',   en: '🌌 Black Hole (Elite)',   tr: '🌌 Kara Delik (Elit)' } },
            { id: 'olympus',   price: 50000, name: { ru: '👑 Золотой Олимп (Легенда)', en: '👑 Golden Olympus (Legend)', tr: '👑 Altın Olimpos (Efsane)' } }
        );
    }
    if (!SHOP_DATA.tube.some(x => x.id === 'dragon')) {
        SHOP_DATA.tube.push(
            { id: 'dragon', price: 18000, name: { ru: '🐉 Драконий неон', en: '🐉 Dragon Neon', tr: '🐉 Ejderha Neon' } }
        );
    }
    // Эксклюзивный скин шаров (выбивается только из кейсов!)
    if (!SHOP_DATA.ball.some(x => x.id === 'relic')) {
        SHOP_DATA.ball.push(
            { id: 'relic', price: 999999, caseOnly: true, name: { ru: '💎 Реликвия (Из кейса)', en: '💎 Relic (Case Only)', tr: '💎 Kalıntı (Sandıktan)' } }
        );
    }
}

// =========================================================================
// === 2. УСЛОЖНЕНИЕ ПОСЛЕ 15-ГО УРОВНЯ: ЛЕДЯНЫЕ КОЛБЫ (❄️) И 5 ШАРОВ ===
// =========================================================================

var frozenTubes = []; // Индексы колб под замком льда
var extraTickets = JSON.parse(localStorage.getItem('sort_tickets_v1') || '{"hint":0,"tube":0}');
function saveTickets() { localStorage.setItem('sort_tickets_v1', JSON.stringify(extraTickets)); }

var prevGenEndgame = generateLevel;
generateLevel = function(lvl) {
    // С 25-го уровня каждый 5-й босс-этап имеет высоту 5 шаров в колбе!
    if (typeof TUBE_CAPACITY !== 'undefined') {
        TUBE_CAPACITY = (lvl >= 25 && lvl % 5 === 0) ? 5 : 4;
    }

    prevGenEndgame(lvl);

    // С 15-го уровня замораживаем 1 колбу (с 30-го — 2 колбы), которые откроются при сборке других колб
    frozenTubes = [];
    if (lvl >= 15) {
        var freezeCount = lvl >= 30 ? 2 : 1;
        var candidates = [];
        for (var i = 0; i < tubes.length; i++) {
            if (tubes[i] && tubes[i].length > 0 && !tubes[i].every(c => c === tubes[i][0])) {
                candidates.push(i);
            }
        }
        candidates.sort(() => Math.random() - 0.5);
        frozenTubes = candidates.slice(0, freezeCount);
    }

    renderBoard();

    if (frozenTubes.length > 0) {
        var fMsg = currentLang === 'en'
            ? '❄️ FROZEN TUBES! Complete any tube to thaw!'
            : (currentLang === 'tr' ? '❄️ DONMUŞ TÜPLER! Çözmek için bir tüp tamamla!' : '❄️ ЛЕДЯНЫЕ КОЛБЫ! Собери любую колбу, чтобы разморозить!');
        setTimeout(() => showFloatText(fMsg, '#7dd3fc'), 550);
    }
};

// Блокируем клик по замороженной колбе
var prevClickFrozen = onTubeClick;
onTubeClick = function(idx) {
    if (frozenTubes.includes(idx)) {
        playTone(180, 0.15);
        var lockTxt = currentLang === 'en' ? '❄️ Complete any tube first!' : (currentLang === 'tr' ? '❄️ Önce bir tüp tamamla!' : '❄️ Сначала собери любую колбу!');
        showFloatText(lockTxt, '#7dd3fc');
        return;
    }

    var solvedBefore = tubes.filter(t => t.length === TUBE_CAPACITY && t.every(c => c === t[0])).length;
    prevClickFrozen(idx);
    var solvedAfter = tubes.filter(t => t.length === TUBE_CAPACITY && t.every(c => c === t[0])).length;

    // Если игрок только что собрал колбу — размораживаем 1 ледяную колбу!
    if (solvedAfter > solvedBefore && frozenTubes.length > 0) {
        frozenTubes.shift();
        playTone(760, 0.25);
        var thawTxt = currentLang === 'en' ? '🔥 Ice melted!' : (currentLang === 'tr' ? '🔥 Buz eridi!' : '🔥 Лёд растаял!');
        showFloatText(thawTxt, '#38bdf8');
        renderBoard();
    }
};

// Отрисовка льда, высоты на 5 шаров и счётчика бесплатных билетов на кнопках
var prevRenderEndgame = renderBoard;
renderBoard = function() {
    prevRenderEndgame();
    var tubeEls = document.querySelectorAll('#tubes-container .tube');
    tubeEls.forEach((el, idx) => {
        if (frozenTubes.includes(idx)) el.classList.add('frozen-tube');
        if (typeof TUBE_CAPACITY !== 'undefined' && TUBE_CAPACITY === 5) el.classList.add('tall-tube');
    });

    // Компактные бейджи бесплатных билетов из кейсов (помещаются в 1 строку при любом количестве!)
    var hBtn = document.getElementById('hint-btn');
    if (hBtn) {
        hBtn.innerHTML = extraTickets.hint > 0
            ? '💡 🎟️' + extraTickets.hint
            : '💡 <span id="hint-lbl">' + (currentLang === 'en' ? 'Hint' : (currentLang === 'tr' ? 'İpucu' : 'Подсказка')) + '</span> 📺';
    }
    var tBtn = document.getElementById('add-tube-btn') || document.querySelector('button[onclick*="addExtraTube"]');
    if (tBtn) {
        tBtn.innerHTML = extraTickets.tube > 0
            ? '🧪 +1 🎟️' + extraTickets.tube
            : '📺 +1 ' + (currentLang === 'en' ? 'Tube' : (currentLang === 'tr' ? 'Tüp' : 'Колба'));
    }
};

// Если есть билеты из кейсов — тратим билет вместо просмотра рекламы!
var prevUseHintTickets = useHintAd;
useHintAd = function() {
    if (extraTickets.hint > 0) {
        var move = findBestMove();
        if (!move) return prevUseHintTickets();
        extraTickets.hint--;
        saveTickets();
        hintPair = move;
        hintActiveAtMove = movesCount;
        playTone(720, 0.2);
        renderBoard();
        showFloatText('🎟️ ' + (currentLang === 'en' ? 'Ticket used!' : 'Билет применён!'), '#38bdf8');
        return;
    }
    prevUseHintTickets();
};

var prevAddTubeTickets = addExtraTubeAd;
addExtraTubeAd = function() {
    if (extraTickets.tube > 0 && !extraTubeUsed) {
        extraTickets.tube--;
        saveTickets();
        extraTubeUsed = true;
        tubes.push([]);
        playTone(620, 0.2);
        renderBoard();
        showFloatText('🎟️ +1 Колба по билету!', '#fbbf24');
        return;
    }
    prevAddTubeTickets();
};

// =========================================================================
// === 3. ВКЛАДКА «🎰 КЕЙСЫ» В МАГАЗИНЕ (КУДА ТРАТИТЬ ДЕСЯТКИ ТЫСЯЧ $) ===
// =========================================================================

window.addEventListener('load', () => {
    var tabsBox = document.querySelector('#shop-modal .shop-tabs');
    if (tabsBox && !document.getElementById('tab-cases-btn')) {
        var cTitle = currentLang === 'en' ? '🎰 Cases' : (currentLang === 'tr' ? '🎰 Sandıklar' : '🎰 Кейсы');
        tabsBox.insertAdjacentHTML('beforeend',
            '<button class="tab-btn" id="tab-cases-btn" onclick="openCasesTab()">' + cTitle + '</button>'
        );
    }
    var list = document.getElementById('shop-list');
    if (list) {
        new MutationObserver(() => {
            if (list.innerHTML.includes('$ 999999')) {
                list.innerHTML = list.innerHTML.replace('$ 999999', '🎰 Только в кейсе');
            }
        }).observe(list, { childList: true });
    }
});

function openCasesTab() {
    playTone(500, 0.08);

    // Сохраняем блок вкладок сверху, чтобы он не пропадал при переключении!
    var list = document.getElementById('shop-list');
    var tabsEl = list ? list.querySelector('.shop-tabs, .tabs') : null;
    if (!tabsEl) {
        var existingTab = document.querySelector('#shop-modal .tab-btn, #tab-cases-btn');
        tabsEl = existingTab ? existingTab.parentElement : null;
    }

    document.querySelectorAll('#shop-modal .tab-btn, #tab-cases-btn').forEach(b => b.classList.remove('active'));
    var cb = document.getElementById('tab-cases-btn');
    if (cb) cb.classList.add('active');

    var isEn = currentLang === 'en';
    var casesHtml =
        '<div class="shop-item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(56,189,248,0.35);margin-bottom:8px;">' +
            '<div style="text-align:left;">' +
                '<div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:3px;">📦 ' + (isEn ? 'Neon Supply Case' : 'Неоновый контейнер') + '</div>' +
                '<div style="font-size:11px;color:#94a3b8;line-height:1.3;">' +
                    (isEn ? 'Hint/Tube tickets, +150 EXP or $1,000–$5,000' : 'Билеты Подсказки/+1 Колбы, +150 EXP или $1 000–$5 000') +
                '</div>' +
            '</div>' +
            '<button class="buy-btn" onclick="buyCase(2500, false)">$ 2 500</button>' +
        '</div>' +
        '<div class="shop-item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.45);">' +
            '<div style="text-align:left;">' +
                '<div style="font-weight:800;font-size:14px;color:#fbbf24;margin-bottom:3px;">👑 ' + (isEn ? 'VIP Relic Case' : 'VIP-кейс Реликвий') + '</div>' +
                '<div style="font-size:11px;color:#fde68a;line-height:1.3;">' +
                    (isEn ? '💎 Relic Skin, x3 Tickets, +500 EXP or $25,000!' : '💎 Скин «Реликвия», x3 билета, +500 EXP или $25 000!') +
                '</div>' +
            '</div>' +
            '<button class="buy-btn" style="background:linear-gradient(135deg,#f59e0b,#ea580c) !important;" onclick="buyCase(10000, true)">$ 10 000</button>' +
        '</div>';

    if (list) {
        if (tabsEl && tabsEl.parentElement === list) {
            list.innerHTML = '';
            list.appendChild(tabsEl);
            list.insertAdjacentHTML('beforeend', casesHtml);
        } else {
            list.innerHTML = casesHtml;
        }
    }
}

function buyCase(cost, isVip) {
    if (state.coins < cost) {
        showFloatText(currentLang === 'en' ? 'Not enough coins!' : 'Не хватает монет!', '#f87171');
        return;
    }
    state.coins -= cost;
    var r = Math.random();
    var prizeText = '';

    if (!isVip) {
        if (r < 0.35) {
            extraTickets.hint += 2; saveTickets();
            prizeText = '🎟️ +2 Билета Подсказки!';
        } else if (r < 0.65) {
            extraTickets.tube += 1; saveTickets();
            prizeText = '🎟️ +1 Билет «+1 Колба»!';
        } else if (r < 0.88) {
            if (typeof updateExpUI === 'function') updateExpUI();
            prizeText = '⭐ +150 Опыта аккаунта!';
        } else {
            state.coins += 5000;
            prizeText = '💰 Удача! Выпало $5 000!';
        }
    } else {
        if (r < 0.25 && !prog.unlocked.ball.includes('relic')) {
            prog.unlocked.ball.push('relic');
            prog.equipped.ball = 'relic';
            saveProg();
            prizeText = '💎 ЛЕГЕНДАРКА! Скин «Реликвия»!';
        } else if (r < 0.55) {
            extraTickets.hint += 3; extraTickets.tube += 2; saveTickets();
            prizeText = '🎟️ Набор VIP: +3 Подсказки и +2 Колбы!';
        } else if (r < 0.82) {
            if (typeof updateExpUI === 'function') updateExpUI();
            prizeText = '⭐ +500 Опыта аккаунта!';
        } else {
            state.coins += 25000;
            prizeText = '👑 ДЖЕКПОТ! +$25 000!';
        }
    }

    saveProgress();
    renderBoard();
    playTone(840, 0.3);
    showFloatText(prizeText, '#fbbf24');
}

// =========================================================================
// === ДОЛГИЕ УВЕДОМЛЕНИЯ (3.2 СЕК) + СБРОС СЕРИИ ПРИ ПОДСКАЗКЕ ===
// =========================================================================

// Продлеваем жизнь всплывающей плашки до 3.2 секунд, чтобы текст спокойно читался
showFloatText = function(text, color) {
    var box = document.getElementById('canvas-container') || document.getElementById('game-wrapper');
    if (!box) return;

    var existing = box.querySelectorAll('.float-text');
    // Если на экране уже висит больше 2 плашек одновременно — убираем самую верхнюю (старую)
    if (existing.length >= 3 && existing.at(0)) {
        existing.at(0).remove();
        existing = box.querySelectorAll('.float-text');
    }

    var el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color || '#fbbf24';
    // Сдвигаем каждую следующую одновременную плашку на 44px ниже предыдущей
    el.style.top = (96 + existing.length * 44) + 'px';
    el.style.setProperty('top', (96 + existing.length * 44) + 'px', 'important');

    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 4200);
};

// Сбрасываем серию побед при использовании подсказки (как и при отмене/рестарте)
var prevHintWithStreakReset = useHintAd;
useHintAd = function() {
    var beforeHint = hintPair.length;
    prevHintWithStreakReset();
    // Проверяем через 50 мс: если подсказка сработала (появилась подсветка), обнуляем серию
    setTimeout(() => {
        if (hintPair.length > 0 && beforeHint === 0 && prog.winStreak > 0) {
            prog.winStreak = 0;
            saveProg();
            if (typeof updateStreakUI === 'function') updateStreakUI();
            var brkTxt = currentLang === 'en' ? '💔 Streak reset (Hint used)' : (currentLang === 'tr' ? '💔 Seri sıfırlandı (İpucu)' : '💔 Серия сброшена (использована подсказка)');
            setTimeout(() => showFloatText(brkTxt, '#f87171'), 1600);
        }
    }, 50);
};

// =========================================================================
// === ГАРАНТИРОВАННАЯ ВКЛАДКА «🎰 КЕЙСЫ» И УВЕДОМЛЕНИЕ О НОВОМ РАНГЕ ===
// =========================================================================

// 1. Встраиваем вкладку «🎰 Кейсы» при каждом открытии магазина (находим панель вкладок автоматически)
var origOpenShopCases = typeof openShop === 'function' ? openShop : null;
if (origOpenShopCases) {
    openShop = function() {
        origOpenShopCases();
        injectCasesTabButton();
    };
}

function injectCasesTabButton() {
    var modal = document.getElementById('shop-modal');
    if (!modal || document.getElementById('tab-cases-btn')) return;

    // Ищем контейнер с кнопками вкладок (Фоны / Колбы / Элементы)
    var existingTab = modal.querySelector('.tab-btn') || modal.querySelector('button[onclick*="switchShopTab"]') || modal.querySelector('button[onclick*="setShopTab"]');
    var tabsContainer = existingTab ? existingTab.parentElement : modal.querySelector('.shop-tabs, .tabs');

    if (tabsContainer) {
        var cTitle = currentLang === 'en' ? '🎰 Cases' : (currentLang === 'tr' ? '🎰 Sandıklar' : '🎰 Кейсы');
        var btn = document.createElement('button');
        btn.id = 'tab-cases-btn';
        btn.className = existingTab ? existingTab.className.replace('active', '').trim() : 'tab-btn';
        btn.textContent = cTitle;
        btn.onclick = openCasesTab;
        tabsContainer.appendChild(btn);
    }
}

// Также вешаем проверку на клик по любой кнопке открытия магазина в шапке
document.addEventListener('click', function(e) {
    if (e.target && (e.target.closest('[onclick*="openShop"]') || e.target.closest('#btn-shop'))) {
        setTimeout(injectCasesTabButton, 30);
    }
});

// 2. Яркое уведомление при каждом повышении ранга аккаунта
var lastKnownAccRank = (typeof extra !== 'undefined' && extra.accRank) ? extra.accRank : 1;

var origClaimWinRank = claimWin;
claimWin = function(mult) {
    var rankBefore = (typeof extra !== 'undefined' && extra.accRank) ? extra.accRank : lastKnownAccRank;
    origClaimWinRank(mult);
    var rankAfter = (typeof extra !== 'undefined' && extra.accRank) ? extra.accRank : rankBefore;

    if (rankAfter > rankBefore) {
        lastKnownAccRank = rankAfter;
        var rankReward = rankAfter * 100;
        state.coins += rankReward;
        saveProgress();
        renderBoard();
        var rMsg = currentLang === 'en'
            ? '⭐ NEW RANK ' + rankAfter + '! +$' + rankReward + '!'
            : (currentLang === 'tr' ? '⭐ YENİ RÜTBE ' + rankAfter + '! +$' + rankReward + '!' : '⭐ НОВЫЙ РАНГ ' + rankAfter + '! Награда +$' + rankReward + '!');
        setTimeout(() => showFloatText(rMsg, '#c084fc'), 350);
        playTone(880, 0.35);
    }
};

// Компактное отображение баланса >= 100 000 в шапке (например, 9.32M), чтобы кнопки не уезжали за край
var prevRenderCompactCoins = renderBoard;
renderBoard = function() {
    prevRenderCompactCoins();
    if (state.coins >= 100000) {
        var shortVal = state.coins >= 1000000
            ? (state.coins / 1000000).toFixed(2) + 'M'
            : Math.floor(state.coins / 1000) + 'K';
        var headerBox = document.querySelector('header, .header, .top-bar');
        if (headerBox) {
            headerBox.querySelectorAll('span, div, b').forEach(el => {
                if (el.children.length === 0 && el.textContent.trim() === String(state.coins)) {
                    el.textContent = shortVal;
                }
            });
        }
    }
};

// =========================================================================
// === ФИНАЛЬНЫЙ ПАТЧ: ИСПРАВЛЕНИЕ КЕЙСОВ, ЭЛИТНЫХ СКИНОВ, РАНГА И UNDO ===
// =========================================================================

// 1. Добавляем элитные скины и «Реликвию» в реальные массивы магазина (SKINS, TUBE_SKINS, THEMES)
if (!SKINS.some(s => s.id === 'relic')) {
    SKINS.push({ id: 'relic', css: 'skin-relic', price: 999999, caseOnly: true, name: { ru: '💎 Реликвия (Из кейса)', en: '💎 Relic (Case Only)', tr: '💎 Kalıntı (Sandıktan)' } });
}
if (!TUBE_SKINS.some(t => t.id === 'dragon')) {
    TUBE_SKINS.push({ id: 'dragon', css: 'tube-dragon', price: 18000, isAd: false, name: { ru: '🐉 Драконий неон', en: '🐉 Dragon Neon', tr: '🐉 Ejderha Neon' } });
}
if (!THEMES.some(th => th.id === 'blackhole')) {
    THEMES.push(
        { id: 'blackhole', price: 25000, isAd: false, bg: 'radial-gradient(circle at 50% 35%, #311042 0%, #090514 55%, #000000 100%)', dot: '#c084fc', name: { ru: '🌌 Чёрная дыра (Элит)', en: '🌌 Black Hole (Elite)', tr: '🌌 Kara Delik (Elit)' } },
        { id: 'olympus',   price: 50000, isAd: false, bg: 'radial-gradient(circle at 50% 20%, #451a03 0%, #1c1917 60%, #090d16 100%)', dot: '#fbbf24', name: { ru: '👑 Золотой Олимп (Легенда)', en: '👑 Golden Olympus (Legend)', tr: '👑 Altın Olimpos (Efsane)' } }
    );
}

// 2. Переопределяем buyCase без багов с несуществующим SHOP_DATA и с реальным начислением EXP
buyCase = function(cost, isVip) {
    if (state.coins < cost) {
        showFloatText(currentLang === 'en' ? 'Not enough coins!' : 'Не хватает монет!', '#f87171');
        return;
    }
    state.coins -= cost;
    var r = Math.random();
    var prizeText = '';

    if (!isVip) {
        if (r < 0.35) {
            extraTickets.hint += 2; saveTickets();
            prizeText = '🎟️ +2 Билета Подсказки!';
        } else if (r < 0.65) {
            extraTickets.tube += 1; saveTickets();
            prizeText = '🎟️ +1 Билет «+1 Колба»!';
        } else if (r < 0.88) {
            gainExp(150);
            prizeText = '⭐ +150 Опыта Ранга!';
        } else {
            state.coins += 5000;
            prizeText = '💰 Удача! Выпало $5 000!';
        }
    } else {
        if (r < 0.25 && !state.unlockedSkins.includes('relic')) {
            state.unlockedSkins.push('relic');
            state.activeSkin = 'relic';
            prizeText = '💎 ЛЕГЕНДАРКА! Скин «Реликвия»!';
        } else if (r < 0.55) {
            extraTickets.hint += 3; extraTickets.tube += 2; saveTickets();
            prizeText = '🎟️ Набор VIP: +3 Подсказки и +2 Колбы!';
        } else if (r < 0.82) {
            gainExp(500);
            prizeText = '⭐ +500 Опыта Ранга!';
        } else {
            state.coins += 25000;
            prizeText = '👑 ДЖЕКПОТ! +$25 000!';
        }
    }

    saveProgress();
    renderBoard();
    updateAlertBadges();
    playTone(840, 0.3);
    showFloatText(prizeText, '#fbbf24');
};

// 3. Корректное уведомление о новом Ранге (привязано к реальному extra.accLvl)
var prevGainExpNotice = gainExp;
gainExp = function(pts) {
    var beforeLvl = extra.accLvl;
    prevGainExpNotice(pts);
    if (extra.accLvl > beforeLvl) {
        var rMsg = currentLang === 'en'
            ? '⭐ NEW RANK ' + extra.accLvl + '!'
            : (currentLang === 'tr' ? '⭐ YENİ RÜTBE ' + extra.accLvl + '!' : '⭐ НОВЫЙ РАНГ ' + extra.accLvl + '!');
        setTimeout(() => showFloatText(rMsg, '#c084fc'), 400);
    }
};

// 4. Защита от бесплатного подглядывания тайных шаров (?) на босс-этапах через «Интуицию отмены»
var prevUndoBossGuard = undoMove;
undoMove = function() {
    if (isMysteryStage(state.level)) {
        // На тайных этапах бесплатная интуиция не срабатывает — тратится $20 или реклама
        if (historyStack.length === 0) return;
        prog.winStreak = 0; saveProg(); updateStreakUI();
        prevUndoForProg();
        while (revealedMask.length < tubes.length) revealedMask.push([true, true, true, true]);
        renderBoard();
        return;
    }
    prevUndoBossGuard();
};

// Всегда показываем понятные названия «Подсказка» и «+1 Колба», а билеты — бейджем в углу кнопки
var prevRenderClearLabels = renderBoard;
renderBoard = function() {
    prevRenderClearLabels();

    var hBtn = document.getElementById('hint-btn');
    if (hBtn) {
        var hText = currentLang === 'en' ? 'Hint' : (currentLang === 'tr' ? 'İpucu' : 'Подсказка');
        hBtn.innerHTML = extraTickets.hint > 0
            ? '💡 ' + hText + '<span class="ticket-badge">🎟️' + extraTickets.hint + '</span>'
            : '💡 ' + hText + ' 📺';
    }

    var tBtn = document.getElementById('add-tube-btn') || document.querySelector('button[onclick*="addExtraTube"]');
    if (tBtn) {
        var tText = currentLang === 'en' ? '+1 Tube' : (currentLang === 'tr' ? '+1 Tüp' : '+1 Колба');
        tBtn.innerHTML = extraTickets.tube > 0
            ? '🧪 ' + tText + '<span class="ticket-badge">🎟️' + extraTickets.tube + '</span>'
            : '📺 ' + tText;
    }
};

// =========================================================================
// === ФОНТАН НЕОНОВЫХ ИСКР ПРИ ПОЛНОЙ СБОРКЕ КОЛБЫ ===
// =========================================================================

function spawnTubeConfetti(tubeIdx, colorHex) {
    var board = document.getElementById('board-area');
    var tubeEl = document.querySelectorAll('#tubes-container .tube').item(tubeIdx);
    if (!board || !tubeEl) return;

    var bRect = board.getBoundingClientRect();
    var tRect = tubeEl.getBoundingClientRect();
    var startX = tRect.left - bRect.left + tRect.width / 2;
    var startY = tRect.top - bRect.top + 8;

    for (var i = 0; i < 16; i++) {
        var spark = document.createElement('div');
        var size = 5 + Math.random() * 5;
        var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4; // Вылет веером вверх из горлышка
        var dist = 45 + Math.random() * 65;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;

        spark.style.cssText =
            'position:absolute;left:' + startX + 'px;top:' + startY + 'px;' +
            'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
            'background:' + (i % 3 === 0 ? '#ffffff' : colorHex) + ';' +
            'box-shadow:0 0 8px ' + colorHex + ';' +
            'pointer-events:none;z-index:45;' +
            'transition:transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.65s ease-out;';

        board.appendChild(spark);

        requestAnimationFrame(((el, x, y) => () => {
            el.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(0.2)';
            el.style.opacity = '0';
        })(spark, dx, dy));

        setTimeout(((el) => () => { if (el.parentNode) el.remove(); })(spark), 680);
    }
}

// Запускаем фонтан искр сразу после прилёта последнего шара в собранную колбу
var prevClickConfetti = onTubeClick;
onTubeClick = function(idx) {
    var doneBefore = tubes.map(t => t.length === TUBE_CAPACITY && t.every(c => c === t.at(0)));
    prevClickConfetti(idx);
    tubes.forEach((t, tIdx) => {
        var isNowDone = t.length === TUBE_CAPACITY && t.every(c => c === t.at(0));
        if (isNowDone && !doneBefore.at(tIdx)) {
            var colHex = COLORS.at(t.at(0)) || '#4ade80';
            setTimeout(() => spawnTubeConfetti(tIdx, colHex), 180);
        }
    });
};

// =========================================================================
// === ЮБИЛЕЙНЫЕ РУБЕЖИ: 50+ (11 КОЛБ), 75+ (12 КОЛБ), 100+ (13 КОЛБ) ===
// =========================================================================

var prevGenMilestones = generateLevel;
generateLevel = function(lvl) {
    prevGenMilestones(lvl);

    var bonusColors = 0;
    if (lvl >= 100) bonusColors = 3;      // 11 цветов + 2 пустые = 13 колб навсегда с 100 этапа
    else if (lvl >= 75) bonusColors = 2;  // 10 цветов + 2 пустые = 12 колб с 75 по 99 этап
    else if (lvl >= 50) bonusColors = 1;  // 9 цветов + 2 пустые = 11 колб с 50 по 74 этап

    if (bonusColors > 0) {
        var existingPool = [];
        tubes.forEach(t => { existingPool = existingPool.concat(t); });

        var currentColors = Math.floor(existingPool.length / TUBE_CAPACITY);
        for (var c = 0; c < bonusColors; c++) {
            var colorIdx = (currentColors + c) % COLORS.length;
            for (var k = 0; k < TUBE_CAPACITY; k++) existingPool.push(colorIdx);
        }

        for (var i = existingPool.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = existingPool[i];
            existingPool[i] = existingPool[j];
            existingPool[j] = tmp;
        }

        var totalFilled = currentColors + bonusColors;
        tubes = [];
        for (var tIdx = 0; tIdx < totalFilled; tIdx++) {
            tubes.push(existingPool.slice(tIdx * TUBE_CAPACITY, (tIdx + 1) * TUBE_CAPACITY));
        }
        tubes.push([], []);

        initialTubes = JSON.parse(JSON.stringify(tubes));
        revealedMask = tubes.map(t => t.map((_, idx) => !isMysteryStage(lvl) || idx === t.length - 1));

        frozenTubes = [];
        if (lvl >= 15) {
            var freezeCount = lvl >= 30 ? 2 : 1;
            var cand = [];
            for (var m = 0; m < tubes.length; m++) {
                if (tubes[m].length > 0 && !tubes[m].every(col => col === tubes[m][0])) cand.push(m);
            }
            cand.sort(() => Math.random() - 0.5);
            frozenTubes = cand.slice(0, freezeCount);
        }

        renderBoard();
    }
};

var prevRenderMilestoneFit = renderBoard;
renderBoard = function() {
    prevRenderMilestoneFit();
    if (tubes.length >= 11) {
        var isTall = typeof TUBE_CAPACITY !== 'undefined' && TUBE_CAPACITY === 5;
        document.querySelectorAll('#tubes-container .tube').forEach(el => {
            el.style.width = '40px';
            el.style.height = isTall ? '195px' : '152px';
        });
        document.querySelectorAll('#tubes-container .ball').forEach(b => {
            b.style.width = isTall ? '28px' : '29px';
            b.style.height = isTall ? '28px' : '29px';
        });
    }
};





// state.level = 25; generateLevel(25);