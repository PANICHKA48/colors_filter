// =========================================================================
// === 1. НАСТРОЙКИ БАЛАНСА, ЦВЕТОВ И СКИНОВ (МОЖЕШЬ МЕНЯТЬ ПОД СЕБЯ) ===
// =========================================================================

let TUBE_CAPACITY = 4;       // Сколько шариков помещается в одну колбу (стандарт = 4)
const BASE_WIN_REWARD = 40;    // Базовая награда монет за прохождение уровня
const UNDO_COST = 20;          // Цена отмены 1 хода в монетах

// Палитра ярких неоновых цветов дл я шариков (всего 9 цветов для высоких уровней)
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
    '#f8fafc', // 9: Жемчужно-белый (для 50+ этапов — невозможно спутать ни с чем!)
    '#b45309'  // 10: Бронзово-янтарный (для 75+ этапов — чётко отличается от всех!)
];

// Ассортимент магазина форм (меняет внешний вид элементов в колбах)
const SKINS = [
    { id: 'ball', css: '',          price: 0,   name: { ru: 'Неоновые шары', en: 'Neon Orbs', tr: 'Neon Küreler' } },
    { id: 'gem',  css: 'skin-gem',  price: 200, name: { ru: 'Кристаллы',     en: 'Crystals',  tr: 'Kristaller' } },
    { id: 'pill', css: 'skin-pill', price: 500, name: { ru: 'Энерго-блоки',  en: 'Energy Cells', tr: 'Enerji Blokları' } }
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
    coins: 60,                 // Стартовый баланс монет (хватит на 3 отмены хода)
    unlockedSkins: ['ball'],   // Купленные формы
    activeSkin: 'ball',        // Текущая выбранная форма
    sound: true                // Включён ли звук
};

// Загружаем сохранённый прогресс из памяти браузера
try {
    const saved = JSON.parse(localStorage.getItem('panichka_sort_save'));
    if (saved) state = { ...state, ...saved };
} catch (e) {}

function saveProgress() {
    try { localStorage.setItem('panichka_sort_save', JSON.stringify(state)); } catch (e) {}
}

let currentLang = 'ru';
function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.ru[key] || key; }

// Простой встроенный генератор звуков (не требует mp3-файлов)
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

let tubes = [];          // Массив колб (каждая колба — массив индексов цвета снизу вверх)
let initialTubes = [];   // Копия начального расклада для кнопки «Заново»
let historyStack = [];   // История ходов для кнопки «Отмена»
let selectedTube = -1;   // Индекс выбранной колбы (-1 = ни одна не выбрана)
let movesCount = 0;      // Счётчик сделанных ходов на текущем уровне
let extraTubeUsed = false; // Использовал ли игрок бустер «+1 Колба» на этом уровне

// Генерация нового уровня в зависимости от номера (state.level)
function generateLevel(lvl) {
    // На 1 уровне — 3 цвета, дальше плавно растёт до 8 цветов
    const numColors = Math.min(8, 3 + Math.floor((lvl - 1) / 3));
    const emptyTubes = 2; // Всегда даём 2 пустые колбы для перекладывания

    // Создаём пул всех шариков (по 4 штуки каждого цвета)
    let pool = [];
    for (let c = 0; c < numColors; c++) {
        for (let k = 0; k < TUBE_CAPACITY; k++) pool.push(c);
    }

    // Перемешиваем шарики случайным образом (алгоритм Фишера-Йетса)
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Раскладываем перемешанные шарики по заполненным колбам + добавляем 2 пустые
    tubes = [];
    for (let tIdx = 0; tIdx < numColors; tIdx++) {
        tubes.push(pool.slice(tIdx * TUBE_CAPACITY, (tIdx + 1) * TUBE_CAPACITY));
    }
    for (let e = 0; e < emptyTubes; e++) tubes.push([]);

    // Сохраняем копию уровня на случай перезапуска
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

// Отрисовка всех колб и шариков на экране
function renderBoard() {
    const container = document.getElementById('tubes-container');
    if (!container) return;

    // Обновляем цифры уровня, ходов и монет в верхней панели
    document.getElementById('level-display').textContent = state.level;
    document.getElementById('moves-display').textContent = movesCount;
    document.getElementById('coins-display').textContent = state.coins;

    // Подбираем размер колб в зависимости от их количества (чтобы всё влезало в экран)
    const isMany = tubes.length > 6;
    const tubeWidth = isMany ? '46px' : '52px';
    const tubeHeight = isMany ? '164px' : '184px';
    const ballSize = isMany ? '33px' : '38px';

    // Находим CSS-класс текущей выбранной формы из магазина
    const skinObj = SKINS.find(s => s.id === state.activeSkin) || SKINS;

    container.innerHTML = tubes.map((tube, idx) => {
        // Проверяем, собрана ли колба целиком (4 шарика одного цвета)
        const isDone = tube.length === TUBE_CAPACITY && tube.every(c => c === tube.at(0));
        const isSelected = idx === selectedTube;

        // Генерируем HTML для каждого шарика внутри колбы
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

// Обработка клика по колбе с номером idx
function onTubeClick(idx) {
    // 1. Если ещё ни одна колба не выбрана — выбираем эту (если она не пустая)
    if (selectedTube === -1) {
        if (tubes[idx].length === 0) return;
        selectedTube = idx;
        playTone(440, 0.08);
        renderBoard();
        return;
    }

    // 2. Если нажали на ту же самую колбу — снимаем выделение
    if (selectedTube === idx) {
        selectedTube = -1;
        playTone(320, 0.08);
        renderBoard();
        return;
    }

    // 3. Пытаемся переложить верхний шарик (или серию одинаковых) из selectedTube в idx
    const from = tubes[selectedTube];
    const to = tubes[idx];
    const topColor = from[from.length - 1];

    // Проверяем правила: в целевой колбе должно быть место, и верхний шарик там либо такой же, либо колба пустая
    const canMove = to.length < TUBE_CAPACITY && (to.length === 0 || to[to.length - 1] === topColor);

    if (canMove) {
        // Сохраняем текущее состояние в историю для кнопки «Отмена»
        historyStack.push({
            tubes: JSON.parse(JSON.stringify(tubes)),
            moves: movesCount
        });

        // Перекладываем все подряд идущие верхние шарики одного цвета, пока хватает места
        while (from.length > 0 && from[from.length - 1] === topColor && to.length < TUBE_CAPACITY) {
            to.push(from.pop());
        }

        movesCount++;
        selectedTube = -1;
        playTone(580, 0.12);
        renderBoard();
        checkWin();
    } else {
        // Если ход невозможен — переключаем выделение на новую колбу (если она не пустая)
        selectedTube = tubes[idx].length > 0 ? idx : -1;
        playTone(220, 0.1);
        renderBoard();
    }
}

// Проверка победы: все непустые колбы должны содержать по 4 шарика одного цвета
function checkWin() {
    const won = tubes.every(t => t.length === 0 || (t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))));
    if (!won) return;

    // Считаем награду за уровень (чем выше уровень, тем чуть больше монет)
    const reward = BASE_WIN_REWARD + Math.floor(state.level * 5);
    document.getElementById('win-reward').textContent = `+$${reward}`;
    document.getElementById('win-modal').style.display = 'flex';
    playTone(760, 0.25);

    // Сообщаем Яндекс SDK, что активный геймплей приостановлен на время окна победы
    if (ysdk?.features?.GameplayAPI) {
        try { ysdk.features.GameplayAPI.stop(); } catch (e) {}
    }
}

// Забрать награду (mult = 1 обычно, mult = 2 за просмотр рекламы) и перейти на следующий уровень
function claimWin(mult) {
    const reward = (BASE_WIN_REWARD + Math.floor(state.level * 5)) * mult;
    const proceed = () => {
        state.coins += reward;
        state.level++;
        saveProgress();
        submitScoreToLb(state.level); // Отправляем новый уровень в таблицу лидеров
        closeModals();
        generateLevel(state.level);

        // Показываем обычную межстраничную рекламу каждые 3 пройденных уровня (если не смотрели x2)
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
        // Если монет не хватает — предлагаем отменить ход бесплатно за просмотр рекламы!
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
        tubes.push([]); // Добавляем одну пустую вспомогательную колбу
        historyStack.forEach(item => item.tubes.push([])); // Сохраняем бонусную колбу в истории ходов
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
    if (!ysdk?.adv) { onSuccess(); return; }
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

    if (typeof YaGames !== 'undefined') {
        YaGames.init().then(_ysdk => {
            ysdk = _ysdk;
            const l = ysdk.environment?.i18n?.lang;
            if (['ru', 'en', 'tr'].includes(l)) currentLang = l;
            applyLang();
            if (ysdk.leaderboards) {
                yandexLb = ysdk.leaderboards;
                submitScoreToLb(state.level);
            }
            ysdk.on('game_api_pause', () => { isPaused = true; });
            ysdk.on('game_api_resume', () => { isPaused = false; });
            if (ysdk.features?.LoadingAPI) ysdk.features.LoadingAPI.ready();
            if (ysdk.features?.GameplayAPI) ysdk.features.GameplayAPI.start();
        }).catch(() => {});
    }
});