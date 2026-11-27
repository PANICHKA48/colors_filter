// =========================================================================
// === МОДУЛЬ ВИЗУАЛА И ПРОГРЕССИИ: ЖИВОЙ ФОН, ТЕМЫ, EXP, КВЕСТЫ И ПОЛЁТ ===
// =========================================================================

let extra = {
    accLvl: 1,                  // Уровень профиля игрока
    accExp: 0,                  // Текущий опыт профиля
    activeTheme: 'classic',     // Активная цветовая тема фона
    unlockedThemes: ['classic'],// Купленные темы фона
    tubesCompleted: 0,          // Сколько всего колб собрано за всё время
    claimedQuests: [],          // Забранные награды за квесты
    lastDaily: ''               // Дата последнего ежедневного подарка
};

try {
    const savedEx = JSON.parse(localStorage.getItem('panichka_sort_extra'));
    if (savedEx) extra = { ...extra, ...savedEx };
} catch (e) {}

function saveExtra() {
    try { localStorage.setItem('panichka_sort_extra', JSON.stringify(extra)); } catch (e) {}
}

// Доступные фоновые темы для магазина (сбалансированы под удержание)
const THEMES = [
    { id: 'classic', price: 0,    bg: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)', dot: '#38bdf8', name: { ru: 'Фон: Ночной космос', en: 'BG: Night Space', tr: 'Arka Plan: Gece' } },
    { id: 'cyber',   price: 900,  bg: 'linear-gradient(180deg, #19092d 0%, #3b0764 100%)', dot: '#f472b6', name: { ru: 'Фон: Киберпанк',     en: 'BG: Cyberpunk',   tr: 'Arka Plan: Siber' } },
    { id: 'lab',     price: 3200, bg: 'linear-gradient(180deg, #042f2e 0%, #064e3b 100%)', dot: '#34d399', name: { ru: 'Фон: Лаборатория',   en: 'BG: Emerald Lab', tr: 'Arka Plan: Lab' } },
    { id: 'gold',    price: 6000, bg: 'linear-gradient(180deg, #1c1917 0%, #451a03 100%)', dot: '#fbbf24', name: { ru: 'Фон: Золотой VIP',   en: 'BG: Golden VIP',  tr: 'Arka Plan: Altın' } }
];

const QUESTS = [
    { id: 't5',  type: 'tubes', target: 5,  reward: 40,  title: { ru: 'Собери 5 полных колб',  en: 'Complete 5 tubes',  tr: '5 tüp tamamla' } },
    { id: 't25', type: 'tubes', target: 25, reward: 120, title: { ru: 'Собери 25 полных колб', en: 'Complete 25 tubes', tr: '25 tüp tamamla' } },
    { id: 'l3',  type: 'level', target: 3,  reward: 60,  title: { ru: 'Пройди 3-й уровень',    en: 'Reach Level 3',     tr: 'Seviye 3 ol' } },
    { id: 'l10', type: 'level', target: 10, reward: 220, title: { ru: 'Пройди 10-й уровень',   en: 'Reach Level 10',    tr: 'Seviye 10 ol' } }
];

let bgParticles = [];
function initLiveBackground() {
    const wrapper = document.getElementById('game-wrapper');
    const board = document.getElementById('board-area');
    if (!wrapper || !board) return;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'bg-particles-canvas';
    bgCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    board.prepend(bgCanvas);

    const tubesCont = document.getElementById('tubes-container');
    if (tubesCont) { tubesCont.style.position = 'relative'; tubesCont.style.zIndex = '2'; }

    const ctx = bgCanvas.getContext('2d');
    bgParticles = Array.from({ length: 28 }, () => ({
        x: Math.random() * 440,
        y: Math.random() * 700,
        r: 1.5 + Math.random() * 2.8,
        vy: 0.25 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.3
    }));

    function animateBg() {
        if (bgCanvas.width !== board.clientWidth || bgCanvas.height !== board.clientHeight) {
            bgCanvas.width = board.clientWidth;
            bgCanvas.height = board.clientHeight;
        }
        ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

        const th = THEMES.find(x => x.id === extra.activeTheme) || THEMES.at(0);
        ctx.fillStyle = th.dot;
        ctx.globalAlpha = 0.25;

        for (let p of bgParticles) {
            p.y -= p.vy;
            p.x += p.vx;
            if (p.y < -10) { p.y = bgCanvas.height + 10; p.x = Math.random() * bgCanvas.width; }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(animateBg);
    }
    applyThemeStyle();
    animateBg();
}

function applyThemeStyle() {
    const wrapper = document.getElementById('game-wrapper');
    const th = THEMES.find(x => x.id === extra.activeTheme) || THEMES.at(0);
    if (wrapper) wrapper.style.background = th.bg;
}

function getNeedExp(lvl) { return 100 + (lvl - 1) * 60; }

window.addEventListener('load', () => {
    initLiveBackground();

    const topLeft = document.querySelector('.top-bar .btn-group');
    if (topLeft && !document.getElementById('q-btn')) {
        topLeft.insertAdjacentHTML('beforeend', `
            <button class="icon-btn" id="q-btn" onclick="openQuests()">🎯</button>
            <button class="icon-btn" id="d-btn" onclick="openDaily()">🎁</button>
        `);
    }

    const wrapper = document.getElementById('game-wrapper');
    const header = wrapper?.querySelector('.header');
    if (wrapper && header && !document.getElementById('exp-strip')) {
        const strip = document.createElement('div');
        strip.id = 'exp-strip';
        strip.style.cssText = 'background:rgba(15,23,42,0.7);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:4px 10px;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;';
        strip.innerHTML = `
            <span id="acc-lvl-txt" style="color:#38bdf8;white-space:nowrap;">⭐ Ур. 1</span>
            <div style="flex:1;height:7px;background:rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;">
                <div id="acc-exp-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#38bdf8,#a855f7);transition:width 0.3s;"></div>
            </div>
            <span id="acc-exp-num" style="color:#94a3b8;font-size:10px;">0/100</span>
        `;
        wrapper.insertBefore(strip, header);
    }

    const board = document.getElementById('board-area');
    if (board && !document.getElementById('quest-modal')) {
        board.insertAdjacentHTML('beforeend', `
            <div id="quest-modal" class="modal">
                <h2>🎯 <span id="q-title">Задания</span></h2>
                <div class="modal-list" id="quest-list"></div>
                <button class="action-btn btn-gray modal-btn-sm" onclick="closeModals()"><span data-t="close">Закрыть</span></button>
            </div>
            <div id="daily-modal" class="modal">
                <h2>🎁 <span id="d-title">Подарок дня</span></h2>
                <p id="d-desc" style="color:#cbd5e1;font-size:14px;"></p>
                <div id="d-btns" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;"></div>
                <button class="action-btn btn-gray modal-btn-sm" onclick="closeModals()"><span data-t="close">Закрыть</span></button>
            </div>
        `);
    }

    updateExpBar();
    updateAlertBadges();
});
function updateExpBar() {
    const lvlEl = document.getElementById('acc-lvl-txt');
    const barEl = document.getElementById('acc-exp-bar');
    const numEl = document.getElementById('acc-exp-num');
    if (!lvlEl || !barEl || !numEl) return;

    const need = getNeedExp(extra.accLvl);
    const pct = Math.min(100, Math.floor((extra.accExp / need) * 100));
    const w = currentLang === 'en' ? 'Lvl' : (currentLang === 'tr' ? 'Sv.' : 'Ур.');
    lvlEl.textContent = `⭐ ${w} ${extra.accLvl}`;
    barEl.style.width = `${pct}%`;
    numEl.textContent = `${extra.accExp}/${need}`;
}

function gainExp(pts) {
    extra.accExp += pts;
    let need = getNeedExp(extra.accLvl);
    while (extra.accExp >= need) {
        extra.accExp -= need;
        extra.accLvl++;
        need = getNeedExp(extra.accLvl);
        const bonus = extra.accLvl * 20;
        state.coins += bonus;
        saveProgress();
        showFloatText(`⭐ ${t('level')} ${extra.accLvl}! +$${bonus}`, '#fbbf24');
        playTone(820, 0.25);
    }
    saveExtra();
    updateExpBar();
}

let activeFloatCount = 0;

function showFloatText(text, color = '#4ade80') {
    const board = document.getElementById('board-area');
    if (!board) return;

    const offsetY = activeFloatCount * 28;
    activeFloatCount++;

    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:absolute;top:calc(16% + ' + offsetY + 'px);left:50%;transform:translateX(-50%);color:' + color + ';font-weight:900;font-size:17px;white-space:nowrap;text-shadow:0 2px 10px rgba(0,0,0,0.95);pointer-events:none;z-index:40;transition:all 0.9s ease-out;';
    board.appendChild(el);

    requestAnimationFrame(() => {
        el.style.top = 'calc(6% + ' + offsetY + 'px)';
        el.style.opacity = '0';
    });

    setTimeout(() => {
        el.remove();
        activeFloatCount = Math.max(0, activeFloatCount - 1);
    }, 950);
}

function animateBallFlight(fromIdx, toIdx, colorHex) {
    const board = document.getElementById('board-area');
    const tubeEls = document.querySelectorAll('.tube');
    const elFrom = tubeEls.item(fromIdx);
    const elTo = tubeEls.item(toIdx);
    if (!board || !elFrom || !elTo) return;

    const bRect = board.getBoundingClientRect();
    const r1 = elFrom.getBoundingClientRect();
    const r2 = elTo.getBoundingClientRect();

    const skinObj = SKINS.find(s => s.id === state.activeSkin) || SKINS.at(0);

    const flyer = document.createElement('div');
    flyer.className = 'ball ' + skinObj.css;
    flyer.style.cssText = 'position:absolute;width:32px;height:32px;background:' + colorHex + ';left:' + (r1.left - bRect.left + 8) + 'px;top:' + (r1.top - bRect.top) + 'px;z-index:35;pointer-events:none;transition:all 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);';
    board.appendChild(flyer);

    requestAnimationFrame(() => {
        flyer.style.left = (r2.left - bRect.left + 8) + 'px';
        flyer.style.top = (r2.top - bRect.top) + 'px';
    });
    setTimeout(() => flyer.remove(), 230);
}

const origOnTubeClick = onTubeClick;

onTubeClick = function(idx) {
    const prevSel = selectedTube;
    const beforeDone = tubes.filter(t => t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))).length;
    const movingColor = prevSel !== -1 && tubes.at(prevSel)?.length ? COLORS.at(tubes.at(prevSel).at(-1)) : null;

    origOnTubeClick(idx);

    if (prevSel !== -1 && selectedTube === -1 && prevSel !== idx && movingColor) {
        animateBallFlight(prevSel, idx, movingColor);
        gainExp(5);

        const afterDone = tubes.filter(t => t.length === TUBE_CAPACITY && t.every(c => c === t.at(0))).length;
        if (afterDone > beforeDone) {
            extra.tubesCompleted++;
            saveExtra();
            renderBoard();
            const realExp = Math.round(15 * (1 + (typeof prog !== 'undefined' ? (prog.upgExp || 0) * 0.15 : 0)));
            showFloatText('✨ +' + realExp + ' EXP!', '#4ade80');
            gainExp(15);
            updateAlertBadges();
        }
    }
};

function updateAlertBadges() {
    const today = new Date().toDateString();
    const dBtn = document.getElementById('d-btn');
    if (dBtn) dBtn.style.borderColor = extra.lastDaily !== today ? '#fbbf24' : 'rgba(255,255,255,0.15)';

    const hasReadyQ = QUESTS.some(q => !extra.claimedQuests.includes(q.id) && (q.type === 'tubes' ? extra.tubesCompleted : state.level) >= q.target);
    const qBtn = document.getElementById('q-btn');
    if (qBtn) qBtn.style.borderColor = hasReadyQ ? '#fbbf24' : 'rgba(255,255,255,0.15)';
}

function openQuests() {
    closeModals();
    const list = document.getElementById('quest-list');
    list.innerHTML = QUESTS.map(q => {
        const cur = q.type === 'tubes' ? extra.tubesCompleted : state.level;
        const done = cur >= q.target;
        const claimed = extra.claimedQuests.includes(q.id);
        const title = q.title[currentLang] || q.title.ru;
        let act = '<span style="color:#94a3b8;font-size:12px;">' + Math.min(cur, q.target) + '/' + q.target + '</span>';
        if (claimed) act = '<span style="color:#4ade80;font-weight:800;">✔</span>';
        else if (done) act = '<div style="display:flex;gap:4px;"><button class="mini-btn equipped" onclick="claimQ(\'' + q.id + '\',1)">+$' + q.reward + '</button><button class="mini-btn" style="background:#d97706;" onclick="claimQ(\'' + q.id + '\',2)">📺 x2</button></div>';
        return '<div class="card-item ' + (done && !claimed ? 'active-skin' : '') + '"><span style="font-size:13px;font-weight:700;">' + title + '</span>' + act + '</div>';
    }).join('');
    document.getElementById('quest-modal').style.display = 'flex';
}

function claimQ(id, mult) {
    const q = QUESTS.find(x => x.id === id);
    if (!q || extra.claimedQuests.includes(q.id)) return;
    const give = () => {
        extra.claimedQuests.push(id);
        state.coins += q.reward * mult;
        saveExtra();
        saveProgress();
        renderBoard();
        updateAlertBadges();
        openQuests();
    };
    if (mult > 1) showRewarded(give); else give();
}

function openDaily() {
    closeModals();
    const today = new Date().toDateString();
    const ok = extra.lastDaily !== today;
    document.getElementById('d-desc').textContent = ok ? 'Ваш подарок дня готов: +$60!' : 'Подарок сегодня уже получен! Заходите завтра!';
    document.getElementById('d-btns').innerHTML = ok
        ? '<button class="action-btn btn-next modal-btn" onclick="claimDaily(1)">🎁 +$60</button><button class="action-btn btn-ad modal-btn" onclick="claimDaily(2)">📺 +$120 (x2)</button>'
        : '';
    document.getElementById('daily-modal').style.display = 'flex';
}

function claimDaily(mult) {
    const today = new Date().toDateString();
    if (extra.lastDaily === today) return;
    const give = () => {
        extra.lastDaily = today;
        state.coins += 60 * mult;
        saveExtra();
        saveProgress();
        renderBoard();
        updateAlertBadges();
        openDaily();
    };
    if (mult > 1) showRewarded(give); else give();
}
extra.activeTube = extra.activeTube || 'glass';
extra.unlockedTubes = extra.unlockedTubes || ['glass'];

const TUBE_SKINS = [
    { id: 'glass',  css: '',            price: 0,    isAd: false, name: { ru: 'Обычное стекло',      en: 'Classic Glass',    tr: 'Klasik Cam' } },
    { id: 'neon',   css: 'tube-neon',   price: 400,  isAd: false, name: { ru: 'Голубой неон',        en: 'Cyber Neon',       tr: 'Mavi Neon' } },
    { id: 'gold',   css: 'tube-gold',   price: 2500, isAd: false, name: { ru: 'Золотой слиток',      en: 'Golden Tube',      tr: 'Altın Tüp' } },
    { id: 'plasma', css: 'tube-plasma', price: 0,    isAd: true,  name: { ru: '⚡ Плазменная капсула', en: '⚡ Plasma Capsule', tr: '⚡ Plazma Kapsül' } }
];

if (!SKINS.some(s => s.id === 'atom')) {
    SKINS.push({ id: 'atom', css: 'skin-atom', price: 0, isAd: true, name: { ru: '💫 Атомные ядра', en: '💫 Atomic Cores', tr: '💫 Atom Çekirdeği' } });
}
if (!THEMES.some(th => th.id === 'aurora')) {
    THEMES.push({ id: 'aurora', price: 0, isAd: true, bg: 'linear-gradient(135deg, #042f2e, #1e1b4b, #311042)', dot: '#5eead4', name: { ru: '🌌 Северное сияние', en: '🌌 Northern Lights', tr: '🌌 Kuzey Işıkları' } });
}

applyThemeStyle = function() {
    const wrapper = document.getElementById('game-wrapper');
    const th = THEMES.find(x => x.id === extra.activeTheme) || THEMES.at(0);
    if (!wrapper) return;
    wrapper.classList.remove('theme-aurora', 'bg-cyber', 'bg-lab', 'bg-gold');
    wrapper.style.background = th.bg;
    if (extra.activeTheme === 'aurora') wrapper.classList.add('theme-aurora');
    if (extra.activeTheme === 'cyber')  wrapper.classList.add('bg-cyber');
    if (extra.activeTheme === 'lab')    wrapper.classList.add('bg-lab');
    if (extra.activeTheme === 'gold')   wrapper.classList.add('bg-gold');
};

const prevRenderForTubes = renderBoard;
renderBoard = function() {
    prevRenderForTubes();
    const tSkin = TUBE_SKINS.find(x => x.id === extra.activeTube);
    if (tSkin && tSkin.css) {
        document.querySelectorAll('.tube').forEach(el => el.classList.add(tSkin.css));
    }
};

let activeShopTab = 'shapes';
function switchShopTab(tab) {
    activeShopTab = tab;
    playTone(500, 0.08);
    openShop();
}

openShop = function() {
    closeModals();
    const list = document.getElementById('shop-list');
    const equipTxt = currentLang === 'en' ? 'Equip' : (currentLang === 'tr' ? 'Kullan' : 'Надеть');
    const t1 = currentLang === 'en' ? '🔮 Shapes' : (currentLang === 'tr' ? '🔮 Şekiller' : '🔮 Формы');
    const t2 = currentLang === 'en' ? '🧪 Tubes'  : (currentLang === 'tr' ? '🧪 Tüpler'   : '🧪 Колбы');
    const t3 = currentLang === 'en' ? '🎨 BG'     : (currentLang === 'tr' ? '🎨 Arka'     : '🎨 Фоны');

    const tabsHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:6px;">' +
        '<button onclick="switchShopTab(\'shapes\')" style="padding:7px 2px;border-radius:8px;border:1px solid ' + (activeShopTab === 'shapes' ? '#38bdf8' : 'rgba(255,255,255,0.15)') + ';background:' + (activeShopTab === 'shapes' ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';color:#fff;font-weight:800;font-size:11px;cursor:pointer;">' + t1 + '</button>' +
        '<button onclick="switchShopTab(\'tubes\')"  style="padding:7px 2px;border-radius:8px;border:1px solid ' + (activeShopTab === 'tubes'  ? '#38bdf8' : 'rgba(255,255,255,0.15)') + ';background:' + (activeShopTab === 'tubes'  ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';color:#fff;font-weight:800;font-size:11px;cursor:pointer;">' + t2 + '</button>' +
        '<button onclick="switchShopTab(\'themes\')" style="padding:7px 2px;border-radius:8px;border:1px solid ' + (activeShopTab === 'themes' ? '#38bdf8' : 'rgba(255,255,255,0.15)') + ';background:' + (activeShopTab === 'themes' ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';color:#fff;font-weight:800;font-size:11px;cursor:pointer;">' + t3 + '</button>' +
    '</div>';

    const items = activeShopTab === 'shapes' ? SKINS : (activeShopTab === 'tubes' ? TUBE_SKINS : THEMES);
    const unlocked = activeShopTab === 'shapes' ? state.unlockedSkins : (activeShopTab === 'tubes' ? extra.unlockedTubes : extra.unlockedThemes);
    const activeId = activeShopTab === 'shapes' ? state.activeSkin : (activeShopTab === 'tubes' ? extra.activeTube : extra.activeTheme);

    const itemsHtml = items.map(it => {
        const isOwned = unlocked.includes(it.id);
        const isAct = activeId === it.id;
        const name = it.name[currentLang] || it.name.ru;
        let btn = '';
        if (isAct) btn = '<button class="mini-btn equipped">' + t('selected') + '</button>';
        else if (isOwned) btn = '<button class="mini-btn" onclick="shopEquip(\'' + activeShopTab + '\',\'' + it.id + '\')">' + equipTxt + '</button>';
        else if (it.isAd) btn = '<button class="mini-btn" style="background:linear-gradient(135deg,#ec4899,#8b5cf6);" onclick="shopAdUnlock(\'' + activeShopTab + '\',\'' + it.id + '\')">📺</button>';
        else btn = '<button class="mini-btn" style="background:#d97706;" onclick="shopBuy(\'' + activeShopTab + '\',\'' + it.id + '\')">$' + it.price + '</button>';
        return '<div class="card-item ' + (isAct ? 'active-skin' : '') + '"><span style="font-weight:700;font-size:13px;">' + name + '</span>' + btn + '</div>';
    }).join('');

    list.innerHTML = tabsHtml + itemsHtml;
    document.getElementById('shop-modal').style.display = 'flex';
};

function shopEquip(cat, id) {
    if (cat === 'shapes') { state.activeSkin = id; saveProgress(); }
    if (cat === 'tubes')  { extra.activeTube = id; saveExtra(); }
    if (cat === 'themes') { extra.activeTheme = id; saveExtra(); applyThemeStyle(); }
    playTone(540, 0.1);
    renderBoard();
    openShop();
}

function shopBuy(cat, id) {
    const list = cat === 'shapes' ? SKINS : (cat === 'tubes' ? TUBE_SKINS : THEMES);
    const it = list.find(x => x.id === id);
    if (!it || state.coins < it.price) return;
    state.coins -= it.price;
    if (cat === 'shapes') state.unlockedSkins.push(id);
    if (cat === 'tubes')  extra.unlockedTubes.push(id);
    if (cat === 'themes') extra.unlockedThemes.push(id);
    shopEquip(cat, id);
}

function shopAdUnlock(cat, id) {
    showRewarded(() => {
        if (cat === 'shapes' && !state.unlockedSkins.includes(id)) state.unlockedSkins.push(id);
        if (cat === 'tubes'  && !extra.unlockedTubes.includes(id)) extra.unlockedTubes.push(id);
        if (cat === 'themes' && !extra.unlockedThemes.includes(id)) extra.unlockedThemes.push(id);
        shopEquip(cat, id);
    });
}

updateExpBar = function() {
    const lvlEl = document.getElementById('acc-lvl-txt');
    const barEl = document.getElementById('acc-exp-bar');
    const numEl = document.getElementById('acc-exp-num');
    if (!lvlEl || !barEl || !numEl) return;

    const need = getNeedExp(extra.accLvl);
    const pct = Math.min(100, Math.floor((extra.accExp / need) * 100));
    const w = currentLang === 'en' ? 'Rank' : (currentLang === 'tr' ? 'Rütbe' : 'Ранг');
    lvlEl.textContent = '⭐ ' + w + ' ' + extra.accLvl;
    barEl.style.width = pct + '%';
    numEl.textContent = extra.accExp + '/' + need;
};

gainExp = function(pts) {
    extra.accExp += pts;
    let need = getNeedExp(extra.accLvl);
    while (extra.accExp >= need) {
        extra.accExp -= need;
        extra.accLvl++;
        need = getNeedExp(extra.accLvl);
        const bonus = extra.accLvl * 20;
        state.coins += bonus;
        saveProgress();
        const w = currentLang === 'en' ? 'Rank' : (currentLang === 'tr' ? 'Rütbe' : 'Ранг');
        showFloatText('⭐ ' + w + ' ' + extra.accLvl + '! +$' + bonus, '#fbbf24');
        playTone(820, 0.25);
    }
    saveExtra();
    updateExpBar();
};

setTimeout(updateExpBar, 100);
let activeLbTab = 'stage';

function switchLbTab(tab) {
    activeLbTab = tab;
    playTone(500, 0.08);
    openLeaderboard();
}

openLeaderboard = function() {
    closeModals();
    const modal = document.getElementById('lb-modal');
    const list = document.getElementById('lb-list');
    modal.style.display = 'flex';

    const tStage = currentLang === 'en' ? '🧩 Stage' : (currentLang === 'tr' ? '🧩 Aşama' : '🧩 Этап');
    const tRank  = currentLang === 'en' ? '⭐ Rank'  : (currentLang === 'tr' ? '⭐ Rütbe' : '⭐ Ранг');
    const tCoins = currentLang === 'en' ? '💰 Coins' : (currentLang === 'tr' ? '💰 Para'  : '💰 Баланс');

    const tabsHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px;">' +
        '<button onclick="switchLbTab(\'stage\')" style="padding:7px 2px;border-radius:8px;border:1px solid ' + (activeLbTab === 'stage' ? '#38bdf8' : 'rgba(255,255,255,0.15)') + ';background:' + (activeLbTab === 'stage' ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';color:#fff;font-weight:800;font-size:11px;cursor:pointer;">' + tStage + '</button>' +
        '<button onclick="switchLbTab(\'rank\')"  style="padding:7px 2px;border-radius:8px;border:1px solid ' + (activeLbTab === 'rank'  ? '#38bdf8' : 'rgba(255,255,255,0.15)') + ';background:' + (activeLbTab === 'rank'  ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';color:#fff;font-weight:800;font-size:11px;cursor:pointer;">' + tRank + '</button>' +
        '<button onclick="switchLbTab(\'coins\')" style="padding:7px 2px;border-radius:8px;border:1px solid ' + (activeLbTab === 'coins' ? '#38bdf8' : 'rgba(255,255,255,0.15)') + ';background:' + (activeLbTab === 'coins' ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';color:#fff;font-weight:800;font-size:11px;cursor:pointer;">' + tCoins + '</button>' +
    '</div>';

    const cfg = activeLbTab === 'stage'
        ? { lb: 'bestlevel', val: state.level, label: t('level') + ' ' + state.level, fmt: v => t('level') + ' ' + v }
        : (activeLbTab === 'rank'
            ? { lb: 'bestrank', val: extra.accLvl, label: (currentLang === 'en' ? 'Rank ' : (currentLang === 'tr' ? 'Rütbe ' : 'Ранг ')) + extra.accLvl, fmt: v => (currentLang === 'en' ? 'Rank ' : (currentLang === 'tr' ? 'Rütbe ' : 'Ранг ')) + v }
            : { lb: 'bestcoins', val: state.coins, label: '$' + state.coins, fmt: v => '$' + v });

    const fallbackHtml = tabsHtml + '<div class="card-item active-skin"><span><strong>#1</strong> ' + t('you') + '</span><strong style="color:#fbbf24;">' + cfg.label + '</strong></div>';

    if (yandexLb) {
        yandexLb.getLeaderboardEntries(cfg.lb, { quantityTop: 10, includeUser: true, quantityAround: 2 })
            .then(res => {
                if (!res.entries || !res.entries.length) { list.innerHTML = fallbackHtml; return; }
                list.innerHTML = tabsHtml + res.entries.map(e => {
                    const isMe = res.userRank && e.rank === res.userRank;
                    const name = e.player.publicName || (isMe ? t('you') : 'Player');
                    return '<div class="card-item ' + (isMe ? 'active-skin' : '') + '"><span><strong>#' + e.rank + '</strong> ' + name + '</span><strong style="color:#fbbf24;">' + cfg.fmt(e.score) + '</strong></div>';
                }).join('');
            }).catch(() => { list.innerHTML = fallbackHtml; });
    } else {
        list.innerHTML = fallbackHtml;
    }
};

let lastSortLbSync = 0;
setInterval(() => {
    if (!yandexLb || Date.now() - lastSortLbSync < 10000) return;
    lastSortLbSync = Date.now();
    if (state.level > 1) yandexLb.setLeaderboardScore('bestlevel', Math.floor(state.level)).catch(() => {});
    if (extra.accLvl > 1) setTimeout(() => yandexLb.setLeaderboardScore('bestrank', Math.floor(extra.accLvl)).catch(() => {}), 1500);
    if (state.coins > 0) setTimeout(() => yandexLb.setLeaderboardScore('bestcoins', Math.floor(state.coins)).catch(() => {}), 3000);
}, 15000);

extra.customName = extra.customName || '';

window.addEventListener('load', () => {
    const topGroups = document.querySelectorAll('.top-bar .btn-group');
    const topRight = topGroups.item(1);
    if (topRight && !document.getElementById('prof-btn')) {
        topRight.insertAdjacentHTML('afterbegin', '<button class="icon-btn" id="prof-btn" onclick="openProfileModal()">👤</button>');
    }

    const board = document.getElementById('board-area');
    if (board && !document.getElementById('name-modal')) {
        board.insertAdjacentHTML('beforeend', `
            <div id="name-modal" class="modal">
                <h2>👤 <span id="prof-title">Профиль игрока</span></h2>
                <p id="prof-hint" style="color:#cbd5e1;font-size:13px;">Введите имя для таблицы лидеров:</p>
                <input id="player-name-input" type="text" maxlength="16" placeholder="Ваше имя..."
                       style="width:85%;padding:11px 14px;border-radius:10px;border:1px solid #38bdf8;background:rgba(15,23,42,0.9);color:#fff;font-size:15px;font-weight:700;text-align:center;outline:none;">
                <button class="action-btn btn-next modal-btn" onclick="saveCustomName()">💾 <span id="prof-save-txt">Сохранить</span></button>
                <button class="action-btn btn-gray modal-btn-sm" onclick="closeModals()"><span data-t="close">Закрыть</span></button>
            </div>
        `);
    }

    setTimeout(() => {
        if (typeof ysdk !== 'undefined' && ysdk && typeof ysdk.getPlayer === 'function') {
            ysdk.getPlayer({ scopes: false }).then(p => {
                const yName = p.getName && p.getName();
                if (yName && !extra.customName) {
                    extra.customName = yName.slice(0, 16);
                    saveExtra();
                }
            }).catch(() => {});
        }
    }, 1500);
});

function getDisplayPlayerName() {
    if (extra.customName && extra.customName.trim().length > 0) return extra.customName.trim();
    return t('you');
}

function openProfileModal() {
    closeModals();
    const titleEl = document.getElementById('prof-title');
    const hintEl = document.getElementById('prof-hint');
    const saveEl = document.getElementById('prof-save-txt');
    const inp = document.getElementById('player-name-input');

    if (titleEl) titleEl.textContent = currentLang === 'en' ? 'Player Profile' : (currentLang === 'tr' ? 'Oyuncu Profili' : 'Профиль игрока');
    if (hintEl) hintEl.textContent = currentLang === 'en' ? 'Enter your nickname for the leaderboard:' : (currentLang === 'tr' ? 'Liderlik tablosu için takma adınızı girin:' : 'Введите имя для таблицы лидеров:');
    if (saveEl) saveEl.textContent = currentLang === 'en' ? 'Save' : (currentLang === 'tr' ? 'Kaydet' : 'Сохранить');
    if (inp) inp.value = extra.customName || '';

    document.getElementById('name-modal').style.display = 'flex';
}

function saveCustomName() {
    const inp = document.getElementById('player-name-input');
    if (!inp) return;
    extra.customName = inp.value.trim().slice(0, 16);
    saveExtra();
    playTone(680, 0.15);
    closeModals();
    showFloatText('👤 ' + getDisplayPlayerName(), '#38bdf8');
}

const baseOpenLeaderboard = openLeaderboard;
openLeaderboard = function() {
    baseOpenLeaderboard();
    setTimeout(() => {
        const meRow = document.querySelector('#lb-list .active-skin span');
        if (meRow) {
            const rankMatch = meRow.innerHTML.match(/<strong>#\d+<\/strong>/);
            const prefix = rankMatch ? rankMatch.at(0) : '<strong>#1</strong>';
            meRow.innerHTML = prefix + ' ' + getDisplayPlayerName();
        }
    }, 60);
};

extra.adsWatched = extra.adsWatched || 0;
extra.comboStreak = 0;
getNeedExp = function(lvl) { return 80 + (lvl - 1) * 40; };

const FULL_QUESTS = [
    { id: 't5',    type: 'tubes', target: 5,    reward: 40,    exp: 60,   title: { ru: 'Собери 5 полных колб',        en: 'Complete 5 tubes',        tr: '5 tüp tamamla' } },
    { id: 't15',   type: 'tubes', target: 15,   reward: 90,    exp: 100,  title: { ru: 'Собери 15 полных колб',       en: 'Complete 15 tubes',       tr: '15 tüp tamamla' } },
    { id: 't40',   type: 'tubes', target: 40,   reward: 200,   exp: 180,  title: { ru: 'Собери 40 полных колб',       en: 'Complete 40 tubes',       tr: '40 tüp tamamla' } },
    { id: 'l3',    type: 'level', target: 3,    reward: 60,    exp: 80,   title: { ru: 'Дойди до 3-го этапа',        en: 'Reach Stage 3',           tr: '3. aşamaya ulaş' } },
    { id: 'l8',    type: 'level', target: 8,    reward: 150,   exp: 150,  title: { ru: 'Дойди до 8-го этапа',        en: 'Reach Stage 8',           tr: '8. aşamaya ulaş' } },
    { id: 'l15',   type: 'level', target: 15,   reward: 320,   exp: 250,  title: { ru: 'Дойди до 15-го этапа',       en: 'Reach Stage 15',          tr: '15. aşamaya ulaş' } },
    { id: 's3',    type: 'skins', target: 3,    reward: 100,   exp: 120,  title: { ru: 'Открой 3 предмета в магазине', en: 'Unlock 3 shop items',   tr: '3 mağaza öğesi aç' } },
    { id: 's6',    type: 'skins', target: 6,    reward: 250,   exp: 220,  title: { ru: 'Открой 6 предметов в магазине', en: 'Unlock 6 shop items',   tr: '6 mağaza öğesi aç' } },
    { id: 'c5000', type: 'coins', target: 5000, reward: 350,   exp: 250,  title: { ru: 'Накопи 5000 монет на балансе', en: 'Hold 5000 coins balance', tr: '5000 altın biriktir' } },
    { id: 'rk5',   type: 'rank',  target: 5,    reward: 160,   exp: 150,  title: { ru: 'Достигни 5-го Ранга',        en: 'Reach Rank 5',            tr: '5. rütbeye ulaş' } },
    { id: 'rk10',  type: 'rank',  target: 10,   reward: 350,   exp: 250,  title: { ru: 'Достигни 10-го Ранга',       en: 'Reach Rank 10',           tr: '10. rütbeye ulaş' } },
    { id: 'rk15',  type: 'rank',  target: 15,   reward: 550,   exp: 350,  title: { ru: 'Достигни 15-го Ранга',       en: 'Reach Rank 15',           tr: '15. rütbeye ulaş' } },
    { id: 'rk20',  type: 'rank',  target: 20,   reward: 750,   exp: 450,  title: { ru: 'Достигни 20-го Ранга',       en: 'Reach Rank 20',           tr: '20. rütbeye ulaş' } },
    { id: 'rk25',  type: 'rank',  target: 25,   reward: 1000,  exp: 600,  title: { ru: 'Достигни 25-го Ранга',       en: 'Reach Rank 25',           tr: '25. rütbeye ulaş' } },
    { id: 'rk100', type: 'rank',  target: 100,  reward: 5000,  exp: 1000, title: { ru: '👑 Легенда: 100-й Ранг (+Корона)', en: '👑 Legend: Rank 100 (+Crown)', tr: '👑 Efsane: 100. Rütbe (+Taç)' } },
    { id: 'l100',  type: 'level', target: 100,  reward: 8000,  exp: 1500, title: { ru: '💎 Гранд-мастер: 100-й Этап', en: '💎 Grandmaster: Stage 100', tr: '💎 Büyük Usta: 100. Aşama' } }
];

function getQuestProgress(q) {
    if (q.type === 'tubes') return extra.tubesCompleted;
    if (q.type === 'level') return state.level;
    if (q.type === 'rank')  return extra.accLvl;
    if (q.type === 'coins') return state.coins;
    if (q.type === 'ads')   return extra.adsWatched;
    if (q.type === 'skins') {
        const total = (state.unlockedSkins?.length || 1) + (extra.unlockedTubes?.length || 1) + (extra.unlockedThemes?.length || 1) - 3;
        return Math.max(0, total);
    }
    return 0;
}

const prevClaimWinForExp = claimWin;
claimWin = function(mult) {
    const prevLvl = state.level;
    prevClaimWinForExp(mult);
    setTimeout(() => {
        if (state.level > prevLvl) {
            extra.comboStreak = 0;
            gainExp(80);
            updateAlertBadges();
        }
    }, 100);
};

const prevShopBuyForExp = shopBuy;
shopBuy = function(cat, id) {
    const beforeOwned = (state.unlockedSkins?.length || 0) + (extra.unlockedTubes?.length || 0) + (extra.unlockedThemes?.length || 0);
    prevShopBuyForExp(cat, id);
    const afterOwned = (state.unlockedSkins?.length || 0) + (extra.unlockedTubes?.length || 0) + (extra.unlockedThemes?.length || 0);
    if (afterOwned > beforeOwned) {
        gainExp(120);
        showFloatText('🎨 +120 EXP!', '#38bdf8');
        updateAlertBadges();
    }
};

const prevShopAdForExp = shopAdUnlock;
shopAdUnlock = function(cat, id) {
    const beforeOwned = (state.unlockedSkins?.length || 0) + (extra.unlockedTubes?.length || 0) + (extra.unlockedThemes?.length || 0);
    prevShopAdForExp(cat, id);
    setTimeout(() => {
        const afterOwned = (state.unlockedSkins?.length || 0) + (extra.unlockedTubes?.length || 0) + (extra.unlockedThemes?.length || 0);
        if (afterOwned > beforeOwned) {
            gainExp(120);
            showFloatText('🎨 +120 EXP!', '#38bdf8');
            updateAlertBadges();
        }
    }, 100);
};


const prevShowRewardedForExp = showRewarded;
showRewarded = function(onSuccess) {
    prevShowRewardedForExp(() => {
        extra.adsWatched++;
        saveExtra();
        gainExp(50);
        updateAlertBadges();
        onSuccess();
    });
};

updateAlertBadges = function() {
    const today = new Date().toDateString();
    const dBtn = document.getElementById('d-btn');
    if (dBtn) dBtn.style.borderColor = extra.lastDaily !== today ? '#fbbf24' : 'rgba(255,255,255,0.15)';

    const hasReadyQ = FULL_QUESTS.some(q => !extra.claimedQuests.includes(q.id) && getQuestProgress(q) >= q.target);
    const qBtn = document.getElementById('q-btn');
    if (qBtn) qBtn.style.borderColor = hasReadyQ ? '#fbbf24' : 'rgba(255,255,255,0.15)';
};

openQuests = function() {
    closeModals();
    const list = document.getElementById('quest-list');
    list.innerHTML = FULL_QUESTS.map(q => {
        const cur = getQuestProgress(q);
        const done = cur >= q.target;
        const claimed = extra.claimedQuests.includes(q.id);
        const title = q.title[currentLang] || q.title.ru;
        const andW = currentLang === 'en' ? 'and' : (currentLang === 'tr' ? 've' : 'и');
        const sub = '<div style="font-size:10px;color:#38bdf8;margin-top:2px;">+$' + q.reward + ' ' + andW + ' +' + q.exp + ' EXP</div>';

        let act = '<span style="color:#94a3b8;font-size:12px;font-weight:700;">' + Math.min(cur, q.target) + '/' + q.target + '</span>';
        if (claimed) act = '<span style="color:#4ade80;font-weight:800;">✔</span>';
        else if (done) act = '<div style="display:flex;gap:4px;"><button class="mini-btn equipped" onclick="claimFullQ(\'' + q.id + '\',1)">+$' + q.reward + '</button><button class="mini-btn" style="background:#d97706;" onclick="claimFullQ(\'' + q.id + '\',2)">📺 x2</button></div>';

        return '<div class="card-item ' + (done && !claimed ? 'active-skin' : '') + '"><div style="text-align:left;"><div style="font-size:12px;font-weight:700;">' + title + '</div>' + sub + '</div>' + act + '</div>';
    }).join('');
    document.getElementById('quest-modal').style.display = 'flex';
};

function claimFullQ(id, mult) {
    const q = FULL_QUESTS.find(x => x.id === id);
    if (!q || extra.claimedQuests.includes(q.id)) return;
    const give = () => {
        extra.claimedQuests.push(id);
        state.coins += q.reward * mult;
        saveExtra();
        saveProgress();
        gainExp(q.exp);
        renderBoard();
        updateAlertBadges();
        openQuests();
    };
    if (mult > 1) showRewarded(give); else give();
}

const prevGetDisplayName = getDisplayPlayerName;
getDisplayPlayerName = function() {
    const baseName = prevGetDisplayName();
    return extra.accLvl >= 100 ? ('👑 ' + baseName) : baseName;
};

const RANKS_TITLES = [
    { minRank: 1,   mult: 1.0, ru: '🌱 Новичок',           en: '🌱 Novice',          tr: '🌱 Acemi' },
    { minRank: 5,   mult: 1.15,ru: '🧪 Ученик Алхимика',   en: '🧪 Alchemist',       tr: '🧪 Simyacı' },
    { minRank: 15,  mult: 1.3, ru: '🔮 Магистр Колб',      en: '🔮 Tube Magister',   tr: '🔮 Tüp Ustası' },
    { minRank: 30,  mult: 1.5, ru: '⚡ Хранитель Неона',   en: '⚡ Neon Keeper',     tr: '⚡ Neon Koruyucu' },
    { minRank: 60,  mult: 1.75,ru: '🔥 Повелитель Стихий', en: '🔥 Element Lord',    tr: '🔥 Element Lordu' },
    { minRank: 100, mult: 2.0, ru: '👑 Легенда Неона',     en: '👑 Neon Legend',     tr: '👑 Neon Efsanesi' }
];

function getCurrentTitleObj() {
    let cur = RANKS_TITLES.at(0);
    for (let item of RANKS_TITLES) {
        if (extra.accLvl >= item.minRank) cur = item;
    }
    return cur;
}

window.addEventListener('load', () => {
    const strip = document.getElementById('exp-strip');
    if (strip && !document.getElementById('title-badge')) {
        const badge = document.createElement('span');
        badge.id = 'title-badge';
        badge.style.cssText = 'color:#fbbf24;font-size:10px;white-space:nowrap;background:rgba(251,191,36,0.12);padding:2px 6px;border-radius:6px;';
        strip.insertBefore(badge, strip.firstChild);
        refreshTitleBadge();
    }
});

function refreshTitleBadge() {
    const badge = document.getElementById('title-badge');
    if (!badge) return;
    const tObj = getCurrentTitleObj();
    const label = tObj[currentLang] || tObj.ru;
    badge.textContent = label + ' (x' + tObj.mult + ')';
}

const origClaimWinForTitle = claimWin;
claimWin = function(mult) {
    const tObj = getCurrentTitleObj();
    const extraBonus = Math.floor((BASE_WIN_REWARD + Math.floor(state.level * 2)) * mult * (tObj.mult - 1));
    origClaimWinForTitle(mult);
    if (extraBonus > 0) {
        setTimeout(() => {
            state.coins += extraBonus;
            saveProgress();
            renderBoard();
        }, 120);
    }
};

extra.totalMoves = extra.totalMoves || 0;
const origTubeClickMoves = onTubeClick;
onTubeClick = function(idx) {
    const beforeM = movesCount;
    origTubeClickMoves(idx);
    if (movesCount > beforeM) {
        extra.totalMoves++;
        saveExtra();
        refreshTitleBadge();
    }
};

FULL_QUESTS.push(
    { id: 'm100',   type: 'moves', target: 100,   reward: 80,    exp: 90,   title: { ru: 'Сделай 100 перекладываний',      en: 'Make 100 moves',          tr: '100 hamle yap' } },
    { id: 'm500',   type: 'moves', target: 500,   reward: 320,   exp: 300,  title: { ru: 'Сделай 500 перекладываний',      en: 'Make 500 moves',          tr: '500 hamle yap' } },
    { id: 't150',   type: 'tubes', target: 150,   reward: 600,   exp: 500,  title: { ru: 'Собери 150 полных колб',         en: 'Complete 150 tubes',      tr: '150 tüp tamamla' } },
    { id: 't500',   type: 'tubes', target: 500,   reward: 2000,  exp: 1200, title: { ru: 'Собери 500 полных колб',         en: 'Complete 500 tubes',      tr: '500 tüp tamamla' } },
    { id: 'l35',    type: 'level', target: 35,    reward: 750,   exp: 550,  title: { ru: 'Дойди до 35-го этапа',           en: 'Reach Stage 35',          tr: '35. aşamaya ulaş' } },
    { id: 'l60',    type: 'level', target: 60,    reward: 1800,  exp: 900,  title: { ru: 'Дойди до 60-го этапа',           en: 'Reach Stage 60',          tr: '60. aşamaya ulaş' } },
    { id: 'c15000', type: 'coins', target: 15000, reward: 1200,  exp: 600,  title: { ru: 'Накопи 15 000 монет на балансе', en: 'Hold 15,000 coins',       tr: '15.000 altın biriktir' } },
    { id: 's9',     type: 'skins', target: 9,     reward: 1000,  exp: 700,  title: { ru: 'Собери всю коллекцию (9 шт.)',   en: 'Unlock full shop (9/9)',  tr: 'Tüm mağazayı aç (9/9)' } }
);

const prevGetQuestProgress = getQuestProgress;
getQuestProgress = function(q) {
    if (q.type === 'moves') return extra.totalMoves;
    return prevGetQuestProgress(q);
};
