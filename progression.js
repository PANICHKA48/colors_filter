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

const UPGRADES = [
    {
        id: 'coins', key: 'upgCoins', max: 10, baseCost: 200, stepCost: 200, perLvl: 10,
        name: { ru: '🔬 Катализатор монет', en: '🔬 Coin Catalyst', tr: '🔬 Altın Katalizörü' },
        desc: {
            ru: 'Больше монет за прохождение этапов (+{val}%)',
            en: 'More coins for completing stages (+{val}%)',
            tr: 'Aşama tamamlama ödülüne bonus (+%{val})'
        }
    },
    {
        id: 'exp', key: 'upgExp', max: 10, baseCost: 200, stepCost: 180, perLvl: 15,
        name: { ru: '⚡ Ускоритель опыта', en: '⚡ EXP Booster', tr: '⚡ EXP Hızlandırıcı' },
        desc: {
            ru: 'Ускоряет получение опыта Ранга (+{val}%)',
            en: 'Increases Rank EXP gained (+{val}%)',
            tr: 'Rütbe EXP kazanımını artırır (+%{val})'
        }
    },
    {
        id: 'undo', key: 'upgFreeUndo', max: 5, baseCost: 350, stepCost: 350, perLvl: 10,
        name: { ru: '🧠 Интуиция отмены', en: '🧠 Free Undo %', tr: '🧠 Ücretsiz Geri Al' },
        desc: {
            ru: 'Шанс отменить ход бесплатно без траты монет ({val}%)',
            en: 'Chance to undo a move for free ({val}%)',
            tr: 'Hamleyi ücretsiz geri alma şansı (%{val})'
        }
    }
];

const SPECIAL_TITLES = [
    { id: 'novice',    bonusMult: 1.0,  check: () => true,                        name: { ru: '🌱 Новичок',         en: '🌱 Novice',        tr: '🌱 Acemi' },        desc: { ru: 'Базовый титул', en: 'Starter title', tr: 'Başlangıç' } },
    { id: 'alchemist', bonusMult: 1.15, check: () => extra.accLvl >= 5,           name: { ru: '🧪 Алхимик',         en: '🧪 Alchemist',     tr: '🧪 Simyacı' },      desc: { ru: 'Достигни 5-го Ранга', en: 'Reach Rank 5', tr: '5. Rütbe' } },
    { id: 'speedster', bonusMult: 1.25, check: () => prog.fastWins >= 3,          name: { ru: '⚡ Спидраннер',      en: '⚡ Speedrunner',   tr: '⚡ Hız Ustası' },   desc: { ru: 'Пройди 3 этапа за ≤12 ходов', en: '3 stages in ≤12 moves', tr: '≤12 hamlede 3 aşama' } },
    { id: 'streak5',   bonusMult: 1.35, check: () => prog.bestStreak >= 5,        name: { ru: '🔥 Непобедимый',     en: '🔥 Unstoppable',   tr: '🔥 Durdurulamaz' }, desc: { ru: 'Серия из 5 побед без отмен', en: '5 win streak no undo', tr: '5 seri galibiyet' } },
    { id: 'collector', bonusMult: 1.45, check: () => ((state.unlockedSkins?.length || 0) + (extra.unlockedTubes?.length || 0) + (extra.unlockedThemes?.length || 0)) >= 6, name: { ru: '💎 Коллекционер', en: '💎 Collector', tr: '💎 Koleksiyoncu' }, desc: { ru: 'Открой 6 предметов магазина', en: 'Unlock 6 shop items', tr: '6 mağaza öğesi' } },
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

window.addEventListener('load', () => {
    const topLeft = document.querySelector('.top-bar .btn-group');
    if (topLeft && !document.getElementById('lab-btn')) {
        topLeft.insertAdjacentHTML('beforeend', '<button class="icon-btn" id="lab-btn" onclick="openLabModal()" title="Лаборатория">⚗️</button>');
    }

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
        const streakBonus = prog.winStreak * 5;
        state.coins += streakBonus;
        saveProgress();
        saveProg();
        updateStreakUI();
        refreshTitleBadge();
        if (prog.winStreak > 1) showFloatText('🔥 Серия x' + prog.winStreak + '! +$' + streakBonus, '#f97316');
    }
};

const prevGainExpForProg = gainExp;
gainExp = function(pts) {
    const mult = 1 + (prog.upgExp || 0) * 0.15;
    prevGainExpForProg(Math.round(pts * mult));
};

// =========================================================================
// === ЕДИНЫЙ ЭКОНОМИЧЕСКИЙ РЕБАЛАНС (ЦЕНЫ, НАГРАДЫ И КВЕСТЫ) ===
// =========================================================================

const NEW_PRICES = {
    gem: 250, pill: 1800,
    neon: 400, gold: 2500,
    cyber: 900, lab: 3200
};
SKINS.forEach(s => { if (NEW_PRICES[s.id]) s.price = NEW_PRICES[s.id]; });
TUBE_SKINS.forEach(t => { if (NEW_PRICES[t.id]) t.price = NEW_PRICES[t.id]; });
THEMES.forEach(th => {
    if (th.id === 'cyber') th.price = 900;
    if (th.id === 'lab')   th.price = 3200;
    if (th.id === 'gold')  th.price = 6000;
});

UPGRADES.forEach(u => {
    if (u.id === 'coins') { u.baseCost = 200; u.stepCost = 200; }
    if (u.id === 'exp')   { u.baseCost = 200; u.stepCost = 180; }
    if (u.id === 'undo')  { u.baseCost = 350; u.stepCost = 350; }
});
var prevClickClearHint = onTubeClick;
onTubeClick = function(idx) {
    var beforeMoves = movesCount;
    prevClickClearHint(idx);
    if (movesCount > beforeMoves && hintPair.length > 0) {
        hintPair = [];
        renderBoard();
    }
};

const QUEST_ECONOMY = {
    t5:    { reward: 40,   exp: 50 },
    m100:  { reward: 60,   exp: 70 },
    l3:    { reward: 60,   exp: 80 },
    t15:   { reward: 90,   exp: 110 },
    s3:    { reward: 100,  exp: 130 },
    rk5:   { reward: 140,  exp: 150 },
    l8:    { reward: 150,  exp: 180 },
    t40:   { reward: 200,  exp: 220 },
    m500:  { reward: 260,  exp: 280 },
    rk10:  { reward: 300,  exp: 300 },
    l15:   { reward: 320,  exp: 340 },
    s6:    { reward: 380,  exp: 400 },
    rk15:  { reward: 480,  exp: 450 },
    t150:  { reward: 600,  exp: 550 },
    rk20:  { reward: 700,  exp: 600 },
    l35:   { reward: 750,  exp: 700 },
    rk25:  { reward: 950,  exp: 800 },
    s9:    { reward: 1000, exp: 900 },
    m1000: { reward: 600,  exp: 500 },
    l60:   { reward: 1500, exp: 1100 },
    t500:  { reward: 2000, exp: 1400 },
    m2500: { reward: 2000, exp: 1500 },
    rk100: { reward: 4500, exp: 2500 },
    l100:  { reward: 5000, exp: 3000 }
};

FULL_QUESTS.forEach(q => {
    if (QUEST_ECONOMY[q.id]) {
        q.reward = QUEST_ECONOMY[q.id].reward;
        q.exp = QUEST_ECONOMY[q.id].exp;
    }
});

FULL_QUESTS.sort((a, b) => a.reward - b.reward);

let maxTubesThisStage = 0;
const origGenForFix = generateLevel;
generateLevel = function(lvl) {
    maxTubesThisStage = 0;
    origGenForFix(lvl);
};

onTubeClick = function(idx) {
    const prevSel = selectedTube;
    const movingColor = prevSel !== -1 && tubes.at(prevSel)?.length ? COLORS.at(tubes.at(prevSel).at(-1)) : null;

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

        const nowDone = tubes.filter(t => t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))).length;
        if (nowDone > maxTubesThisStage) {
            maxTubesThisStage = nowDone;
            extra.tubesCompleted++;
            saveExtra();
            renderBoard();
            const realExp = Math.round(15 * (1 + (prog.upgExp || 0) * 0.15));
            showFloatText('✨ +' + realExp + ' EXP!', '#4ade80');
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

checkWin = function() {
    const won = tubes.every(t => t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))));
    if (!won) return;

    const tObj = getActiveSpecialTitle();
    const totalMult = tObj.bonusMult + (prog.upgCoins || 0) * 0.1;
    const totalReward = Math.round((BASE_WIN_REWARD + Math.floor(state.level * 2)) * totalMult);

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
    const baseReward = Math.round((BASE_WIN_REWARD + Math.floor(state.level * 2)) * totalMult);
    const lastMoves = movesCount;

    const finishLevel = () => {
        prog.winStreak++;
        if (prog.winStreak > prog.bestStreak) prog.bestStreak = prog.winStreak;
        if (lastMoves <= 12) prog.fastWins++;

        const streakBonus = prog.winStreak * 5;
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

openDaily = function() {
    closeModals();
    const today = new Date().toDateString();
    const ok = extra.lastDaily !== today;
    const readyTxt = currentLang === 'en' ? 'Your daily gift is ready: +$60!' : (currentLang === 'tr' ? 'Günlük hediyen hazır: +$60!' : 'Ваш подарок дня готов: +$60!');
    const waitTxt  = currentLang === 'en' ? 'Already claimed today! Come back tomorrow!' : (currentLang === 'tr' ? 'Bugün alındı! Yarın tekrar gel!' : 'Подарок сегодня уже получен! Заходите завтра!');

    document.getElementById('d-desc').textContent = ok ? readyTxt : waitTxt;
    document.getElementById('d-btns').innerHTML = ok
        ? '<button class="action-btn btn-next modal-btn" onclick="claimDaily(1)">🎁 +$60</button><button class="action-btn btn-ad modal-btn" onclick="claimDaily(2)">📺 +$120 (x2)</button>'
        : '';
    document.getElementById('daily-modal').style.display = 'flex';
};
var hintPair = [];

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
        if (typeof frozenTubes !== 'undefined' && frozenTubes.includes(i)) continue;

        var from = tubes.at(i);
        if (!from || from.length === 0) continue;
        if (from.length === TUBE_CAPACITY && from.every(c => c === from.at(0))) continue;

        var topCol = from.at(-1);
        var sameRun = 0;
        for (var k = from.length - 1; k >= 0 && from.at(k) === topCol; k--) sameRun++;
        var isUniform = sameRun === from.length;

        for (var j = 0; j < tubes.length; j++) {
            if (i === j) continue;
            if (typeof frozenTubes !== 'undefined' && frozenTubes.includes(j)) continue;

            var to = tubes.at(j);
            if (!to || to.length >= TUBE_CAPACITY) continue;
            if (to.length > 0 && to.at(-1) !== topCol) continue;

            if (to.length === 0 && isUniform) continue;
            if (to.length + sameRun > TUBE_CAPACITY) continue;
            if (to.length > 0 && isUniform && to.every(c => c === topCol) && from.length > to.length) continue;

            var score = 0;
            if (to.length > 0) {
                score += 60;
                if (to.length + sameRun === TUBE_CAPACITY && to.every(c => c === topCol)) score += 120;
                if (!isUniform) score += 40;
            } else {
                score += 15;
            }

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

var revealedMask = [];

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

var prevClickClearHint = onTubeClick;
onTubeClick = function(idx) {
    var beforeMoves = movesCount;
    prevClickClearHint(idx);
    if (movesCount > beforeMoves) hintPair = [];
};

var prevCheckWinMystery = checkWin;
checkWin = function() {
    prevCheckWinMystery();
    var won = tubes.every(t => t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))));
    if (won && isMysteryStage(state.level)) {
        var rwEl = document.getElementById('win-reward');
        var curVal = parseInt(rwEl.textContent.replace(/\D/g, ''), 10) || 25;
        rwEl.textContent = '+$' + (curVal * 2) + ' (❓ x2!)';
    }
};

var prevClaimWinChest = claimWin;
claimWin = function(mult) {
    var wasBoss = isMysteryStage(state.level);
    var tObj = getActiveSpecialTitle();
    var totalMult = tObj.bonusMult + (prog.upgCoins || 0) * 0.1;
    var extraBossBonus = wasBoss ? Math.round((BASE_WIN_REWARD + Math.floor(state.level * 2)) * totalMult * mult) : 0;

    prevClaimWinChest(mult);

    if (extraBossBonus > 0) {
        state.coins += extraBossBonus;
        saveProgress();
        renderBoard();
    }

    if (prog.winStreak > 0 && prog.winStreak % 5 === 0) {
        var chestCoins = 60 + prog.winStreak * 10;
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
        var streakBonus = prog.winStreak * 5;
        var sMsg = currentLang === 'en'
            ? '🔥 Streak x' + prog.winStreak + ': +$' + streakBonus + ' bonus!'
            : (currentLang === 'tr' ? '🔥 Seri x' + prog.winStreak + ': +$' + streakBonus + ' bonus!' : '🔥 Серия x' + prog.winStreak + ': бонус +$' + streakBonus + '!');
        setTimeout(() => showFloatText(sMsg, '#fb923c'), 800);
    }
};
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
        hintActiveAtMove = movesCount;
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

        if (tData.length > 0) {
            revealedMask[tIdx][tData.length - 1] = true;
            var topColor = tData[tData.length - 1];
            for (var k = tData.length - 2; k >= 0; k--) {
                if (tData[k] === topColor) revealedMask[tIdx][k] = true;
                else break;
            }
        }

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

var prevUndoMystery = undoMove;
undoMove = function() {
    prevUndoMystery();
    while (revealedMask.length < tubes.length) {
        revealedMask.push([true, true, true, true]);
    }
    renderBoard();
};

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

var frozenTubes = [];
var extraTickets = JSON.parse(localStorage.getItem('sort_tickets_v1') || '{"hint":0,"tube":0}');
function saveTickets() { localStorage.setItem('sort_tickets_v1', JSON.stringify(extraTickets)); }

var prevGenEndgame = generateLevel;
generateLevel = function(lvl) {
    if (typeof TUBE_CAPACITY !== 'undefined') {
        TUBE_CAPACITY = (lvl >= 25 && lvl % 5 === 0) ? 5 : 4;
    }

    prevGenEndgame(lvl);

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

};

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

    if (solvedAfter > solvedBefore && frozenTubes.length > 0) {
        frozenTubes.shift();
        playTone(760, 0.25);
        var thawTxt = currentLang === 'en' ? '🔥 Ice melted!' : (currentLang === 'tr' ? '🔥 Buz eridi!' : '🔥 Лёд растаял!');
        showFloatText(thawTxt, '#38bdf8');
        renderBoard();
    }
};

var prevRenderEndgame = renderBoard;
renderBoard = function() {
    prevRenderEndgame();
    var tubeEls = document.querySelectorAll('#tubes-container .tube');
    tubeEls.forEach((el, idx) => {
        if (frozenTubes.includes(idx)) el.classList.add('frozen-tube');
        if (typeof TUBE_CAPACITY !== 'undefined' && TUBE_CAPACITY === 5) el.classList.add('tall-tube');
    });

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
                    (isEn ? 'Hint/Tube tickets, +150 EXP or $1,500–$3,000' : 'Билеты Подсказки/+1 Колбы, +150 EXP или $1 500–$3 000') +
                '</div>' +
            '</div>' +
            '<button class="buy-btn" onclick="buyCase(4000, false)">$ 4 000</button>' +
        '</div>' +
        '<div class="shop-item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.45);">' +
            '<div style="text-align:left;">' +
                '<div style="font-weight:800;font-size:14px;color:#fbbf24;margin-bottom:3px;">👑 ' + (isEn ? 'VIP Relic Case' : 'VIP-кейс Реликвий') + '</div>' +
                '<div style="font-size:11px;color:#fde68a;line-height:1.3;">' +
                    (isEn ? '💎 Relic Skin, x3 Tickets, +500 EXP or $20,000!' : '💎 Скин «Реликвия», x3 билета, +500 EXP или $20 000!') +
                '</div>' +
            '</div>' +
            '<button class="buy-btn" style="background:linear-gradient(135deg,#f59e0b,#ea580c) !important;" onclick="buyCase(15000, true)">$ 15 000</button>' +
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

showFloatText = function(text, color) {
    var box = document.getElementById('canvas-container') || document.getElementById('game-wrapper');
    if (!box) return;

    var existing = box.querySelectorAll('.float-text');
    if (existing.length >= 3 && existing[0]) {
        existing[0].remove();
        existing = box.querySelectorAll('.float-text');
    }

    var el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color || '#fbbf24';
    el.style.top = (96 + existing.length * 44) + 'px';
    el.style.setProperty('top', (96 + existing.length * 44) + 'px', 'important');

    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 4200);
};

var prevHintWithStreakReset = useHintAd;
useHintAd = function() {
    var beforeHint = hintPair.length;
    prevHintWithStreakReset();
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

document.addEventListener('click', function(e) {
    if (e.target && (e.target.closest('[onclick*="openShop"]') || e.target.closest('#btn-shop'))) {
        setTimeout(injectCasesTabButton, 30);
    }
});

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
            gainExp(150);
            prizeText = '⭐ +150 Опыта Ранга!';
        } else {
            state.coins += 3000;
            prizeText = '💰 Удача! Выпало $3 000!';
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
            state.coins += 20000;
            prizeText = '👑 ДЖЕКПОТ! +$20 000!';
        }
    }

    saveProgress();
    renderBoard();
    updateAlertBadges();
    playTone(840, 0.3);
    showFloatText(prizeText, '#fbbf24');
}

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

var prevUndoBossGuard = undoMove;
undoMove = function() {
    if (isMysteryStage(state.level)) {
        if (historyStack.length === 0) return;
        prog.winStreak = 0; saveProg(); updateStreakUI();
        prevUndoForProg();
        while (revealedMask.length < tubes.length) revealedMask.push([true, true, true, true]);
        renderBoard();
        return;
    }
    prevUndoBossGuard();
};

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

function spawnTubeConfetti(tubeIdx, colorHex) {
    var board = document.getElementById('board-area');
    var tubeEl = document.querySelectorAll('#tubes-container .tube')[tubeIdx];
    if (!board || !tubeEl) return;

    var bRect = board.getBoundingClientRect();
    var tRect = tubeEl.getBoundingClientRect();
    var startX = tRect.left - bRect.left + tRect.width / 2;
    var startY = tRect.top - bRect.top + 8;

    for (var i = 0; i < 16; i++) {
        var spark = document.createElement('div');
        var size = 5 + Math.random() * 5;
        var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
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

var prevClickConfetti = onTubeClick;
onTubeClick = function(idx) {
    var doneBefore = tubes.map(t => t.length === TUBE_CAPACITY && t.every(c => c === t[0]));
    prevClickConfetti(idx);
    tubes.forEach((t, tIdx) => {
        var isNowDone = t.length === TUBE_CAPACITY && t.every(c => c === t[0]);
        if (isNowDone && !doneBefore[tIdx]) {
            var colHex = COLORS[t[0]] || '#4ade80';
            setTimeout(() => spawnTubeConfetti(tIdx, colHex), 180);
        }
    });
};

var prevGenMilestones = generateLevel;
generateLevel = function(lvl) {
    prevGenMilestones(lvl);

    var bonusColors = 0;
    if (lvl >= 100) bonusColors = 3;
    else if (lvl >= 75) bonusColors = 2;
    else if (lvl >= 50) bonusColors = 1;

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
            el.style.height = isTall ? '172px' : '142px';
        });
        document.querySelectorAll('#tubes-container .ball').forEach(b => {
            b.style.width = isTall ? '28px' : '29px';
            b.style.height = isTall ? '28px' : '29px';
        });
    }
};

var prevClickWinGuard = onTubeClick;
onTubeClick = function(idx) {
    prevClickWinGuard(idx);
    setTimeout(() => {
        var winModal = document.getElementById('win-modal');
        if (winModal && winModal.style.display === 'flex') return;

        var allSolved = tubes.length > 0 && tubes.every(t =>
            t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t[0]))
        );
        if (allSolved && typeof checkWin === 'function') {
            checkWin();
        }
    }, 260);
};
// =========================================================================
// === ПАТЧ: ЗАЩИТА ОТ ФАРМА EXP ЧЕРЕЗ UNDO И СБРОС СЕРИИ ПРИ ПОДСКАЗКЕ ===
// =========================================================================

// 1. Опыт за ход (+5 EXP) начисляется только при движении вперёд, а не после «Отмены»
let maxMovesThisStage = 0;
const origGenForExpGuard = generateLevel;
generateLevel = function(lvl) {
    maxMovesThisStage = 0;
    origGenForExpGuard(lvl);
};

const origGainExpUndoGuard = gainExp;
gainExp = function(pts) {
    // Если это начисление +5 EXP за обычный ход, проверяем, побит ли рекорд ходов на этапе
    if (pts === 5) {
        if (movesCount <= maxMovesThisStage) return;
        maxMovesThisStage = movesCount;
    }
    origGainExpUndoGuard(pts);
};

// 2. Мгновенный и гарантированный сброс серии побед при любом использовании Подсказки (билет или реклама)
function resetStreakOnHintUse() {
    if (typeof prog !== 'undefined' && prog.winStreak > 0) {
        prog.winStreak = 0;
        if (typeof saveProg === 'function') saveProg();
        if (typeof updateStreakUI === 'function') updateStreakUI();
        const brkTxt = currentLang === 'en'
            ? '💔 Streak reset (Hint used)'
            : (currentLang === 'tr' ? '💔 Seri sıfırlandı (İpucu)' : '💔 Серия сброшена (использована подсказка)');
        setTimeout(() => showFloatText(brkTxt, '#f87171'), 600);
    }
}

const finalWrapUseHintAd = useHintAd;
useHintAd = function() {
    const move = typeof findBestMove === 'function' ? findBestMove() : null;
    if (!move) {
        finalWrapUseHintAd();
        return;
    }
    // Если тратится билет — сбрасываем серию сразу
    if (typeof extraTickets !== 'undefined' && extraTickets.hint > 0) {
        finalWrapUseHintAd();
        resetStreakOnHintUse();
        return;
    }
    // Если за рекламу — перехватываем показ награды, чтобы сбросить серию строго после просмотра
    const origShowRew = window.showRewarded;
    window.showRewarded = function(cb) {
        origShowRew(() => {
            if (typeof cb === 'function') cb();
            resetStreakOnHintUse();
        });
    };
    finalWrapUseHintAd();
    window.showRewarded = origShowRew;
};
// =========================================================================
// === 7-ДНЕВНЫЙ КАЛЕНДАРЬ ЕЖЕДНЕВНЫХ НАГРАД (МОТИВАЦИЯ ВОЗВРАТА В ИГРУ) ===
// =========================================================================

const DAILY_CALENDAR = [
    { day: 1, coins: 300,   hint: 0, tube: 0, exp: 0, label: { ru: '$300',             en: '$300',             tr: '$300' } },
    { day: 2, coins: 650,   hint: 3, tube: 0, exp: 0, label: { ru: '$650 + 💡3',       en: '$650 + 💡3',       tr: '$650 + 💡3' } },
    { day: 3, coins: 1500,  hint: 2, tube: 0, exp: 0, label: { ru: '$1 500 + 💡2',     en: '$1,500 + 💡2',     tr: '$1.500 + 💡2' } },
    { day: 4, coins: 2500,  hint: 0, tube: 3, exp: 0, label: { ru: '$2 500 + 🧪3',     en: '$2,500 + 🧪3',     tr: '$2.500 + 🧪3' } },
    { day: 5, coins: 4000,  hint: 5, tube: 0, exp: 0, label: { ru: '$4 000 + 💡5',     en: '$4,000 + 💡5',     tr: '$4.000 + 💡5' } },
    { day: 6, coins: 8000,  hint: 3, tube: 3, exp: 0, label: { ru: '$8 000 + 💡3 + 🧪3', en: '$8,000 + 💡3 + 🧪3', tr: '$8.000 + 💡3 + 🧪3' } },
    { day: 7, coins: 15000, hint: 5, tube: 5, exp: 0, label: { ru: '$15 000 + 💡5 + 🧪5', en: '$15,000 + 💡5 + 🧪5', tr: '$15.000 + 💡5 + 🧪5' } }
];

function getDailyStreakState() {
    const today = new Date();
    const todayStr = today.toDateString();
    const yesterday = new Date(today.getTime() - 86400000).toDateString();

    let dayIdx = parseInt(extra.dailyDayIdx || '0', 10);
    const claimedToday = extra.lastDaily === todayStr;

    if (!claimedToday && extra.lastDaily && extra.lastDaily !== yesterday) {
        dayIdx = 0;
    }
    if (dayIdx < 0 || dayIdx >= 7) dayIdx = 0;

    return { dayIdx, claimedToday, todayStr };
}

openDaily = function() {
    closeModals();
    const { dayIdx, claimedToday } = getDailyStreakState();
    const curItem = DAILY_CALENDAR[dayIdx];
    const dayWord = currentLang === 'en' ? 'Day' : (currentLang === 'tr' ? 'Gün' : 'День');

    const cardsHtml = DAILY_CALENDAR.map((item, idx) => {
        const isPast = idx < dayIdx;
        const isToday = idx === dayIdx && !claimedToday;
        const border = isToday ? '2px solid #fbbf24' : (isPast ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.14)');
        const bg = isToday ? 'rgba(251,191,36,0.18)' : (isPast ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)');
        const statusIcon = isPast ? '✅' : (isToday ? '🎁' : '🔒');
        const spanStyle = item.day === 7 ? 'grid-column: span 3;' : '';

        return `<div style="${spanStyle}background:${bg};border:${border};border-radius:10px;padding:7px 4px;text-align:center;">
            <div style="font-size:10px;font-weight:800;color:${isToday ? '#fbbf24' : '#94a3b8'};">${dayWord} ${item.day} ${statusIcon}</div>
            <div style="font-size:11px;font-weight:900;color:#fff;margin-top:3px;">${item.label[currentLang] || item.label.ru}</div>
        </div>`;
    }).join('');

    const descEl = document.getElementById('d-desc');
    descEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;margin-bottom:4px;">${cardsHtml}</div>`;

    const btnsEl = document.getElementById('d-btns');
    if (claimedToday) {
        const waitTxt = currentLang === 'en' ? 'Come back tomorrow for the next reward!' : (currentLang === 'tr' ? 'Yarınki ödül için tekrar gel!' : 'Заходи завтра за следующей наградой!');
        btnsEl.innerHTML = `<div style="color:#4ade80;font-weight:800;font-size:13px;padding:6px;">✅ ${waitTxt}</div>`;
    } else {
        const rewStr = curItem.label[currentLang] || curItem.label.ru;
        const claimTxt = currentLang === 'en' ? 'Claim' : (currentLang === 'tr' ? 'Al' : 'Забрать');
        const adTxt = currentLang === 'en' ? 'Ad' : (currentLang === 'tr' ? 'Reklam' : 'Реклама');
        btnsEl.innerHTML = `
            <button class="action-btn btn-next modal-btn" onclick="claimDaily(1)">🎁 ${claimTxt}: ${rewStr}</button>
            <button class="action-btn btn-ad modal-btn" onclick="claimDaily(2)">📺 ${claimTxt} x2 (${adTxt})</button>
        `;
    }

    document.getElementById('daily-modal').style.display = 'flex';
};

claimDaily = function(mult) {
    const { dayIdx, claimedToday, todayStr } = getDailyStreakState();
    if (claimedToday) return;

    const item = DAILY_CALENDAR[dayIdx];
    const give = () => {
        extra.lastDaily = todayStr;
        extra.dailyDayIdx = (dayIdx + 1) % 7;
        state.coins += item.coins * mult;

        if (typeof extraTickets !== 'undefined') {
            if (item.hint > 0) extraTickets.hint += item.hint * mult;
            if (item.tube > 0) extraTickets.tube += item.tube * mult;
            if (typeof saveTickets === 'function') saveTickets();
        }
        if (item.exp > 0 && typeof gainExp === 'function') {
            gainExp(item.exp * mult);
        }

        saveExtra();
        saveProgress();
        renderBoard();
        updateAlertBadges();
        playTone(820, 0.25);
        openDaily();
    };

    if (mult > 1) showRewarded(give);
    else give();
};
// =========================================================================
// === ЖЕЛЕЗОБЕТОННЫЙ ФИЛЬТР УВЕДОМЛЕНИЯ О ЛЬДЕ (ПО РЕАЛЬНОЙ ДОСКЕ) ===
// =========================================================================

const finalFloatGuard = showFloatText;
showFloatText = function(text, color) {
    if (typeof text === 'string' && (text.includes('ЛЕДЯНЫЕ КОЛБЫ') || text.includes('FROZEN TUBES') || text.includes('DONMUŞ TÜPLER'))) {
        setTimeout(() => {
            const hasRealIceOnScreen = document.querySelectorAll('#tubes-container .frozen-tube').length > 0;
            if (hasRealIceOnScreen) {
                finalFloatGuard.call(this, text, color);
            }
        }, 250);
        return;
    }
    return finalFloatGuard.apply(this, arguments);
};

// =========================================================================
// === ВОССТАНОВЛЕНИЕ ЗАМОРОЖЕННЫХ КОЛБ ПРИ НАЖАТИИ «ЗАНОВО» (RESTART) ===
// =========================================================================
let initialFrozenTubes = [];

const origGenSaveIce = generateLevel;
generateLevel = function(lvl) {
    origGenSaveIce(lvl);
    initialFrozenTubes = Array.isArray(frozenTubes) ? [...frozenTubes] : [];
};

const origRestartRestoreIce = restartLevel;
restartLevel = function() {
    maxMovesThisStage = 0;
    origRestartRestoreIce();
    frozenTubes = [...initialFrozenTubes];
    renderBoard();
};
