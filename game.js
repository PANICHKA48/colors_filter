// =========================================================================
// === 1. НАСТРОЙКИ БАЛАНСА, ЦВЕТОВ И СКИНОВ (МОЖЕШЬ МЕНЯТЬ ПОД СЕБЯ) ===
// =========================================================================

let TUBE_CAPACITY = 4;       // Сколько шариков помещается в одну колбу (стандарт = 4)
const BASE_WIN_REWARD = 20;    // Базовая награда монет за прохождение уровня
const UNDO_COST = 20;          // Цена отмены 1 хода в монетах

// Палитра ярких неоновых цветов для шариков (всего 11 цветов для высоких уровней)
const COLORS = [
    '#ef4444', // 0: Красный
    '#3b82f6', // 1: Синий
    '#22c55e', // 2: Зелёный
    '#eab308', // 3: Жёлтый
    '#a855f7', // 4: Фиолетовый
    '#ec4899', // 5: Розовый
    '#06b6d4', // 6: Голубой
    '#f97316', // 7: Оранжевый
    '#84cc16', // 8: Лаймовый
    '#f8fafc', // 9: Жемчужно-белый (для 50+ этапов)
    '#b45309'  // 10: Бронзово-янтарный (для 75+ этапов)
];

// Ассортимент магазина форм (меняет внешний вид элементов в колбах)
const SKINS = [
    { id: 'ball', css: '',          price: 0,    name: { ru: 'Неоновые шары', en: 'Neon Orbs',    tr: 'Neon Küreler' } },
    { id: 'gem',  css: 'skin-gem',  price: 250,  name: { ru: 'Кристаллы',     en: 'Crystals',     tr: 'Kristaller' } },
    { id: 'pill', css: 'skin-pill', price: 1800, name: { ru: 'Энерго-блоки',  en: 'Energy Cells', tr: 'Enerji Blokları' } }
];

// Словарь переводов интерфейса на 3 языка (Русский, Английский, Турецкий)
const I18N = {
    ru: {
        level: 'Этап', moves: 'Ходы', winTitle: 'Этап пройден!',
        rewardText: 'Награда:', claimX2: 'Забрать x2 (Реклама)', nextLevel: 'Дальше',
        lbTitle: 'Лучшие игроки', shopTitle: 'Магазин', close: 'Закрыть',
        undo: 'Отмена', addTube: '+1 Колба', free: 'Бесплатно', selected: 'Выбрано', buy: 'Купить', you: 'Вы'
    },
    en: {
        level: 'Stage', moves: 'Moves', winTitle: 'Stage Complete!',
        rewardText: 'Reward:', claimX2: 'Claim x2 (Ad)', nextLevel: 'Next Level',
        lbTitle: 'Top Players', shopTitle: 'Shop', close: 'Close',
        undo: 'Undo', addTube: '+1 Tube', free: 'Free', selected: 'Active', buy: 'Buy', you: 'You'
    },
    tr: {
        level: 'Aşama', moves: 'Hamle', winTitle: 'Aşama Tamam!',
        rewardText: 'Ödül:', claimX2: '2x Al (Reklam)', nextLevel: 'Sonraki',
        lbTitle: 'En İyi Oyuncular', shopTitle: 'Mağaza', close: 'Kapat',
        undo: 'Geri Al', addTube: '+1 Tüp', free: 'Ücretsiz', selected: 'Seçili', buy: 'Satın Al', you: 'Sen'
    }
};

// =========================================================================
// === 2. СОХРАНЕНИЕ ПРОГРЕССА И ЗВУКОВОЙ СИНТЕЗАТОР ===
// =========================================================================

let state = {
    level: 1,                  // Текущий уровень игрока
    coins: 20,                 // Стартовый баланс монет (хватит на 1 отмену хода)
    unlockedSkins: ['ball'],   // Купленные формы
    activeSkin: 'ball',        // Текущая выбранная форма
    sound: true                // Включён ли звук
};

try {
    const saved = JSON.parse(localStorage.getItem('panichka_sort_save'));
    if (saved) state = { ...state, ...saved };
} catch (e) {}

function saveProgress() {
    try { localStorage.setItem('panichka_sort_save', JSON.stringify(state)); } catch (e) {}
}

let currentLang = 'ru';
function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.ru[key] || key; }

let audioCtx = null, isPaused = false;
function playTone(freq, dur = 0.1) {
    if (!state.sound || isPaused) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
}

// =========================================================================
// === 3. ГЕНЕРАТОР УРОВНЕЙ И ИГРОВАЯ ЛОГИКА ===
// =========================================================================

let tubes = [];
let initialTubes = [];
let historyStack = [];
let selectedTube = -1;
let movesCount = 0;
let extraTubeUsed = false;

function generateLevel(lvl) {
    const numColors = Math.min(8, 3 + Math.floor((lvl - 1) / 3));
    const emptyTubes = 2;

    let pool = [];
    for (let c = 0; c < numColors; c++) {
        for (let k = 0; k < TUBE_CAPACITY; k++) pool.push(c);
    }

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    tubes = [];
    for (let tIdx = 0; tIdx < numColors; tIdx++) {
        tubes.push(pool.slice(tIdx * TUBE_CAPACITY, (tIdx + 1) * TUBE_CAPACITY));
    }
    for (let e = 0; e < emptyTubes; e++) tubes.push([]);

    initialTubes = JSON.parse(JSON.stringify(tubes));
    historyStack = [];
    selectedTube = -1;
    movesCount = 0;
    extraTubeUsed = false;

    const addBtn = document.getElementById('add-tube-btn');
    if (addBtn) addBtn.disabled = false;

    renderBoard();
}

// =========================================================================
// === 4. ОТРИСОВКА КОЛБ, ОБРАБОТКА НАЖАТИЙ И ПРОВЕРКА ПОБЕДЫ ===
// =========================================================================

function renderBoard() {
    const container = document.getElementById('tubes-container');
    if (!container) return;

    document.getElementById('level-display').textContent = state.level;
    document.getElementById('moves-display').textContent = movesCount;
    document.getElementById('coins-display').textContent = state.coins;

    const isMany = tubes.length > 6;
    const tubeWidth = isMany ? '46px' : '52px';
    const tubeHeight = isMany ? '164px' : '184px';
    const ballSize = isMany ? '33px' : '38px';

    const skinObj = SKINS.find(s => s.id === state.activeSkin) || SKINS;

    container.innerHTML = tubes.map((tube, idx) => {
        const isDone = tube.length === TUBE_CAPACITY && tube.every(c => c === tube.at(0));
        const isSelected = idx === selectedTube;

        const ballsHtml = tube.map(colorIdx =>
            `<div class="ball ${skinObj.css}" style="width:${ballSize};height:${ballSize};background:${COLORS[colorIdx]};"></div>`
        ).join('');

        return `<div class="tube ${isSelected ? 'selected' : ''} ${isDone ? 'completed' : ''}"
                     style="width:${tubeWidth};height:${tubeHeight};"
                     onclick="onTubeClick(${idx})">
                    ${ballsHtml}
                </div>`;
    }).join('');
}

function onTubeClick(idx) {
    if (selectedTube === -1) {
        if (tubes[idx].length === 0) return;
        selectedTube = idx;
        playTone(440, 0.08);
        renderBoard();
        return;
    }

    if (selectedTube === idx) {
        selectedTube = -1;
        playTone(320, 0.08);
        renderBoard();
        return;
    }

    const from = tubes[selectedTube];
    const to = tubes[idx];
    const topColor = from[from.length - 1];

    const canMove = to.length < TUBE_CAPACITY && (to.length === 0 || to[to.length - 1] === topColor);

    if (canMove) {
        historyStack.push({
            tubes: JSON.parse(JSON.stringify(tubes)),
            moves: movesCount
        });

        while (from.length > 0 && from[from.length - 1] === topColor && to.length < TUBE_CAPACITY) {
            to.push(from.pop());
        }

        movesCount++;
        selectedTube = -1;
        playTone(580, 0.12);
        renderBoard();
        checkWin();
    } else {
        selectedTube = tubes[idx].length > 0 ? idx : -1;
        playTone(220, 0.1);
        renderBoard();
    }
}

function checkWin() {
    const won = tubes.every(t => t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))));
    if (!won) return;

    const reward = BASE_WIN_REWARD + Math.floor(state.level * 2);
    document.getElementById('win-reward').textContent = `+$${reward}`;
    document.getElementById('win-modal').style.display = 'flex';
    playTone(760, 0.25);

    if (ysdk?.features?.GameplayAPI) {
        try { ysdk.features.GameplayAPI.stop(); } catch (e) {}
    }
}

function claimWin(mult) {
    const reward = (BASE_WIN_REWARD + Math.floor(state.level * 2)) * mult;
    const proceed = () => {
        state.coins += reward;
        state.level++;
        saveProgress();
        submitScoreToLb(state.level);
        closeModals();
        generateLevel(state.level);

        if (mult === 1 && state.level % 3 === 0) showInterstitial();
    };

    if (mult > 1) showRewarded(proceed);
    else proceed();
}

// =========================================================================
// === 5. БУСТЕРЫ: ОТМЕНА ХОДА, +1 КОЛБА ЗА РЕКЛАМУ И РЕСТАРТ ===
// =========================================================================

function undoMove() {
    if (historyStack.length === 0) return;
    if (state.coins < UNDO_COST) {
        showRewarded(() => {
            const prev = historyStack.pop();
            tubes = prev.tubes;
            movesCount = prev.moves;
            selectedTube = -1;
            renderBoard();
        });
        return;
    }

    state.coins -= UNDO_COST;
    const prev = historyStack.pop();
    tubes = prev.tubes;
    movesCount = prev.moves;
    selectedTube = -1;
    saveProgress();
    playTone(380, 0.1);
    renderBoard();
}

function addExtraTubeAd() {
    if (extraTubeUsed) return;
    showRewarded(() => {
        extraTubeUsed = true;
        tubes.push([]);
        historyStack.forEach(item => item.tubes.push([]));
        document.getElementById('add-tube-btn').disabled = true;
        playTone(660, 0.2);
        renderBoard();
    });
}

function restartLevel() {
    tubes = JSON.parse(JSON.stringify(initialTubes));
    historyStack = [];
    selectedTube = -1;
    movesCount = 0;
    extraTubeUsed = false;
    const addBtn = document.getElementById('add-tube-btn');
    if (addBtn) addBtn.disabled = false;
    playTone(300, 0.1);
    renderBoard();
}

// =========================================================================
// === 6. МАГАЗИН СКИНОВ, ТАБЛИЦА ЛИДЕРОВ И ЛОКАЛИЗАЦИЯ ===
// =========================================================================

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    if (ysdk?.features?.GameplayAPI) {
        try { ysdk.features.GameplayAPI.start(); } catch (e) {}
    }
}

function openShop() {
    closeModals();
    const list = document.getElementById('shop-list');
    list.innerHTML = SKINS.map(s => {
        const owned = state.unlockedSkins.includes(s.id);
        const active = state.activeSkin === s.id;
        const name = s.name[currentLang] || s.name.ru;

        let btnHtml = '';
        if (active) {
            btnHtml = `<button class="mini-btn equipped">${t('selected')}</button>`;
        } else if (owned) {
            btnHtml = `<button class="mini-btn" onclick="equipSkin('${s.id}')">${t('selected')}</button>`;
        } else {
            btnHtml = `<button class="mini-btn" style="background:#d97706;" onclick="buySkin('${s.id}')">$${s.price}</button>`;
        }

        return `<div class="card-item ${active ? 'active-skin' : ''}">
            <span style="font-weight:700;font-size:14px;">${name}</span>
            ${btnHtml}
        </div>`;
    }).join('');
    document.getElementById('shop-modal').style.display = 'flex';
}

function buySkin(id) {
    const s = SKINS.find(x => x.id === id);
    if (!s || state.coins < s.price) return;
    state.coins -= s.price;
    state.unlockedSkins.push(id);
    state.activeSkin = id;
    saveProgress();
    playTone(700, 0.2);
    renderBoard();
    openShop();
}

function equipSkin(id) {
    state.activeSkin = id;
    saveProgress();
    playTone(540, 0.1);
    renderBoard();
    openShop();
}

function openLeaderboard() {
    closeModals();
    const modal = document.getElementById('lb-modal');
    const list = document.getElementById('lb-list');
    modal.style.display = 'flex';

    const fallbackHtml = `<div class="card-item active-skin">
        <span><strong>#1</strong> ${t('you')}</span>
        <strong style="color:#fbbf24;">${t('level')} ${state.level}</strong>
    </div>`;

    if (yandexLb) {
        yandexLb.getLeaderboardEntries('bestlevel', { quantityTop: 10, includeUser: true, quantityAround: 2 })
            .then(res => {
                if (!res.entries || !res.entries.length) { list.innerHTML = fallbackHtml; return; }
                list.innerHTML = res.entries.map(e => {
                    const isMe = res.userRank && e.rank === res.userRank;
                    const name = e.player.publicName || (isMe ? t('you') : 'Player');
                    return `<div class="card-item ${isMe ? 'active-skin' : ''}">
                        <span><strong>#${e.rank}</strong> ${name}</span>
                        <strong style="color:#fbbf24;">${t('level')} ${e.score}</strong>
                    </div>`;
                }).join('');
            }).catch(() => { list.innerHTML = fallbackHtml; });
    } else {
        list.innerHTML = fallbackHtml;
    }
}

function toggleSound() {
    state.sound = !state.sound;
    document.getElementById('sound-btn').textContent = state.sound ? '🔊' : '🔇';
    saveProgress();
}

function applyLang() {
    document.getElementById('lang-btn').textContent = currentLang.toUpperCase();
    const els = document.getElementsByTagName('*');
    for (let i = 0; i < els.length; i++) {
        const key = els[i].getAttribute('data-t');
        if (key) els[i].textContent = t(key);
    }
    renderBoard();
}

function cycleLang() {
    const langs = ['ru', 'en', 'tr'];
    currentLang = langs[(langs.indexOf(currentLang) + 1) % langs.length];
    applyLang();
}

// === ИНТЕГРАЦИЯ YANDEX GAMES SDK ===
let ysdk = null, yandexLb = null;

function submitScoreToLb(lvl) {
    if (!yandexLb) return;
    try { yandexLb.setLeaderboardScore('bestlevel', Math.floor(lvl)).catch(() => {}); } catch (e) {}
}

function showInterstitial() {
    if (!ysdk?.adv) return;
    isPaused = true;
    ysdk.adv.showFullscreenAdv({
        callbacks: { onClose: () => { isPaused = false; }, onError: () => { isPaused = false; } }
    });
}

function showRewarded(onSuccess) {
    if (!ysdk?.adv) {
        if (typeof showFloatText === 'function') showFloatText('⏳ Реклама пока недоступна', '#94a3b8');
        return;
    }
    isPaused = true;
    ysdk.adv.showRewardedVideo({
        callbacks: {
            onRewarded: () => { onSuccess(); },
            onClose: () => { isPaused = false; },
            onError: () => { isPaused = false; }
        }
    });
}

window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
    if (ysdk?.features?.GameplayAPI) {
        try { document.hidden ? ysdk.features.GameplayAPI.stop() : ysdk.features.GameplayAPI.start(); } catch (e) {}
    }
});

window.addEventListener('load', () => {
    document.getElementById('sound-btn').textContent = state.sound ? '🔊' : '🔇';
    generateLevel(state.level);
    const sp = document.getElementById('splash');
    if (sp) sp.style.display = 'none';
});

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModals();
});