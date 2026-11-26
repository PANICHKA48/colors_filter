const SUPABASE_URL = 'https://vnrwplmznprluqgafcke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucndwbG16bnBybHVxZ2FmY2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2OTgyNjIsImV4cCI6MjExMTI3NDI2Mn0.idFgNFunD4Z0JtchsAvEt1--wltWRLC-o7WbAuv3la0';
const GAME_ID = 'neon_sort';

window.PlatformSDK = {
    type: 'web',
    vkUserId: null,
    vkPhoto: '',
    lastShareBonusDay: localStorage.getItem('vk_share_bonus_day') || ''
};

function getSupabaseHeaders(extraHeaders) {
    return Object.assign({
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
    }, extraHeaders || {});
}

function syncLeaderToSupabase() {
    if (!SUPABASE_URL.startsWith('http') || typeof state === 'undefined') return;
    const uid = PlatformSDK.vkUserId ? 'vk_' + PlatformSDK.vkUserId : (localStorage.getItem('guest_uid') || (() => {
        const id = 'web_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('guest_uid', id);
        return id;
    })());
    const pName = (typeof extra !== 'undefined' && extra.customName) ? extra.customName : 'Игрок';
    const pScore = state.bestScore || state.level || 1;
    const pRank = (typeof extra !== 'undefined' && extra.accLvl) ? extra.accLvl : 1;
    const pCoins = state.coins || 0;

    fetch(SUPABASE_URL + '/rest/v1/leaders?on_conflict=game_id,user_id', {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({
            game_id: GAME_ID, user_id: uid, name: pName, photo: PlatformSDK.vkPhoto || '',
            score: Math.floor(pScore), rank: Math.floor(pRank), coins: Math.floor(pCoins),
            updated_at: new Date().toISOString()
        })
    }).catch(() => {});
}

async function openGlobalSupabaseLeaderboard(sortBy = 'score') {
    const modal = document.getElementById('lb-modal');
    const listEl = document.getElementById('lb-list') || document.querySelector('#lb-modal .shop-list, #lb-modal .lb-content');
    if (!modal || !listEl) return;

    modal.style.display = 'flex';
    listEl.innerHTML = '';

    const tabsRow = document.createElement('div');
    tabsRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;';
    [{ key: 'score', label: '🏆 Рекорд' }, { key: 'rank', label: '⭐ Ранг' }, { key: 'coins', label: '💰 Баланс' }].forEach(t => {
        const b = document.createElement('button');
        const active = sortBy === t.key;
        b.style.cssText = 'padding:8px 4px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;background:' +
            (active ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';border:1px solid ' +
            (active ? '#38bdf8' : 'rgba(255,255,255,0.14)') + ';color:' + (active ? '#fff' : '#cbd5e1') + ';';
        b.textContent = t.label;
        b.onclick = () => openGlobalSupabaseLeaderboard(t.key);
        tabsRow.appendChild(b);
    });
    listEl.appendChild(tabsRow);

    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'padding:16px;text-align:center;color:#94a3b8;font-size:13px;';
    statusDiv.textContent = '⏳ Загрузка мирового рейтинга...';
    listEl.appendChild(statusDiv);

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3200);
        const res = await fetch(SUPABASE_URL + '/rest/v1/leaders?game_id=eq.' + GAME_ID + '&order=' + sortBy + '.desc&limit=50', {
            headers: getSupabaseHeaders(), signal: controller.signal
        });
        clearTimeout(timer);
        const rows = await res.json();
        statusDiv.remove();

        if (!Array.isArray(rows) || rows.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:16px;text-align:center;color:#94a3b8;font-size:13px;';
            empty.textContent = 'Пока нет записей. Пройди уровень!';
            listEl.appendChild(empty);
            return;
        }

        const myUid = PlatformSDK.vkUserId ? 'vk_' + PlatformSDK.vkUserId : localStorage.getItem('guest_uid');
        rows.forEach((r, idx) => {
            const isMe = r.user_id === myUid;
            const rowEl = document.createElement('div');
            rowEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:6px;border-radius:10px;background:' +
                (isMe ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)') + ';border:1px solid ' + (isMe ? '#38bdf8' : 'rgba(255,255,255,0.08)') + ';';
            const left = document.createElement('div');
            left.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;';
            const medal = document.createElement('span');
            medal.style.cssText = 'font-weight:900;min-width:26px;color:#fbbf24;';
            medal.textContent = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
            left.appendChild(medal);
            if (r.photo) {
                const img = document.createElement('img');
                img.src = r.photo;
                img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
                left.appendChild(img);
            }
            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'font-weight:700;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:145px;';
            nameSpan.textContent = (r.name || 'Игрок') + (isMe ? ' (Вы)' : '');
            left.appendChild(nameSpan);
            const valSpan = document.createElement('span');
            valSpan.style.cssText = 'font-weight:900;font-size:13px;color:#38bdf8;white-space:nowrap;';
            valSpan.textContent = sortBy === 'rank' ? '⭐ ' + r.rank : (sortBy === 'coins' ? '$' + Number(r.coins).toLocaleString('ru-RU') : '🚩 ' + r.score);
            rowEl.appendChild(left);
            rowEl.appendChild(valSpan);
            listEl.appendChild(rowEl);
        });
    } catch (e) {
        if (typeof renderLeaderboardList === 'function') renderLeaderboardList(sortBy === 'score' ? 'level' : sortBy);
        else statusDiv.textContent = 'Локальный режим рейтинга';
    }
}
function shareGameWithFriends(withBonus) {
    const appId = new URLSearchParams(location.search).get('vk_app_id') || '';
    const appUrl = appId ? 'https://vk.com' + '/app' + appId : 'https://vk.com';
    const rewardOnce = () => {
        const today = new Date().toDateString();
        if (withBonus && PlatformSDK.lastShareBonusDay !== today && typeof state !== 'undefined') {
            PlatformSDK.lastShareBonusDay = today;
            localStorage.setItem('vk_share_bonus_day', today);
            state.coins += 150;
            if (typeof saveProgress === 'function') saveProgress();
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof showFloatText === 'function') showFloatText('👥 Спасибо за репост! +$150!', '#38bdf8');
            if (typeof playTone === 'function') playTone(820, 0.25);
        }
    };
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppShare', { link: appUrl }).then(rewardOnce).catch(() => {});
    } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ handler: 'VKWebAppShare', params: { link: appUrl }, type: 'vk-connect' }, '*');
        rewardOnce();
    }
}

(function initUniversalPlatform() {
    const isVk = location.search.includes('vk_') || location.hash.includes('vk_') || (document.referrer && document.referrer.includes('vk.'));
    if (isVk) {
        PlatformSDK.type = 'vk';
        const hookVk = () => {
            if (typeof vkBridge === 'undefined' || PlatformSDK.vkHooked) return;
            PlatformSDK.vkHooked = true;
            vkBridge.send('VKWebAppInit').catch(() => {});
            vkBridge.send('VKWebAppGetUserInfo').then(u => {
                PlatformSDK.vkUserId = u.id;
                PlatformSDK.vkPhoto = u.photo_100 || u.photo_50 || '';
                if (u.first_name && typeof extra !== 'undefined' && !extra.customName) {
                    extra.customName = (u.first_name + ' ' + (u.last_name || '')).trim().slice(0, 16);
                    if (typeof saveExtra === 'function') saveExtra();
                }
                syncLeaderToSupabase();
            }).catch(() => {});
            vkBridge.send('VKWebAppStorageGet', { keys: ['vk_save_state', 'vk_save_extra', 'vk_save_prog'] }).then(res => {
                if (!res || !res.keys) return;
                let upd = false;
                res.keys.forEach(item => {
                    if (!item.value) return;
                    try {
                        const p = JSON.parse(item.value);
                        if (item.key === 'vk_save_state' && typeof state !== 'undefined' && (p.level || 1) > (state.level || 1)) { Object.assign(state, p); upd = true; }
                        if (item.key === 'vk_save_extra' && typeof extra !== 'undefined' && (p.accExp || 0) > (extra.accExp || 0)) { Object.assign(extra, p); upd = true; }
                        if (item.key === 'vk_save_prog' && typeof prog !== 'undefined') { Object.assign(prog, p); upd = true; }
                    } catch (e) {}
                });
                if (upd) {
                    if (typeof saveProgress === 'function') saveProgress();
                    if (typeof renderBoard === 'function') renderBoard();
                }
            }).catch(() => {});
            window.showInterstitial = () => { isPaused = true; vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).finally(() => { isPaused = false; }); };
            window.showRewarded = (cb) => { isPaused = true; vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' }).then(r => { isPaused = false; if (r && r.result) cb(); }).catch(() => { isPaused = false; }); };
        };
        hookVk();
        let t = 0;
        const iv = setInterval(() => { hookVk(); if (PlatformSDK.vkHooked || ++t > 20) clearInterval(iv); }, 200);
        window.openLeaderboard = () => { syncLeaderToSupabase(); openGlobalSupabaseLeaderboard('score'); };
    }

    const origSave = window.saveProgress;
    window.saveProgress = function() {
        if (typeof origSave === 'function') origSave();
        syncLeaderToSupabase();
        if (PlatformSDK.type === 'vk' && typeof vkBridge !== 'undefined' && typeof state !== 'undefined') {
            vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_state', value: JSON.stringify(state) }).catch(() => {});
            if (typeof extra !== 'undefined') vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_extra', value: JSON.stringify(extra) }).catch(() => {});
            if (typeof prog !== 'undefined') vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_prog', value: JSON.stringify(prog) }).catch(() => {});
        }
    };

    const addBtn = () => {
        if (PlatformSDK.type !== 'vk') return;
        const modal = document.getElementById('win-modal') || document.getElementById('gameover-modal');
        if (modal && !document.getElementById('vk-share-modal-btn')) {
            const box = modal.querySelector('.modal-content') || modal;
            const btn = document.createElement('button');
            btn.id = 'vk-share-modal-btn';
            btn.className = 'action-btn modal-btn';
            btn.style.cssText = 'background:linear-gradient(135deg,#2563eb,#7c3aed);margin-top:8px;width:100%;';
            btn.textContent = '👥 Поделиться с друзьями (+$150)';
            btn.onclick = () => shareGameWithFriends(true);
            const last = box.querySelector('button:last-of-type');
            if (last) box.insertBefore(btn, last); else box.appendChild(btn);
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
})();
(function protectWinRewardsAndStreakBug() {
    let x2UsedThisLevel = false;
    let x2Busy = false;
    let streakRewardLevel = -1;

    // 1. Защита от повторного начисления бонуса серии на одном и том же уровне
    if (typeof window.showFloatText === 'function') {
        const origFloat = window.showFloatText;
        window.showFloatText = function(text, color) {
            if (typeof text === 'string' && text.includes('СУНДУК СЕРИИ')) {
                const curLvl = typeof state !== 'undefined' ? state.level : 0;
                if (streakRewardLevel === curLvl) return;
                streakRewardLevel = curLvl;
            }
            return origFloat.apply(this, arguments);
        };
    }

    // 2. Защита показа рекламы с наградой (не даёт вызывать повторно во время/после просмотра)
    const origShowRewarded = window.showRewarded;
    window.showRewarded = function(onSuccess) {
        if (x2Busy || x2UsedThisLevel) return;
        x2Busy = true;

        const wrappedSuccess = function() {
            x2Busy = false;
            x2UsedThisLevel = true;
            if (typeof onSuccess === 'function') onSuccess();
        };

        if (typeof origShowRewarded === 'function') {
            origShowRewarded(wrappedSuccess);
            setTimeout(() => { x2Busy = false; }, 2500);
        } else {
            x2Busy = false;
        }
    };

    // 3. Жесткая блокировка кнопки «Забрать x2 (Реклама)» в окне победы
    setInterval(() => {
        const winModal = document.getElementById('win-modal');
        if (!winModal || winModal.style.display === 'none' || winModal.style.display === '') {
            x2UsedThisLevel = false;
            x2Busy = false;
            return;
        }

        const x2Btn = Array.from(winModal.querySelectorAll('button')).find(
            b => b.textContent.includes('Забрать x2') || b.textContent.includes('x2')
        );

        if (x2Btn && !x2Btn.dataset.hardGuarded) {
            x2Btn.dataset.hardGuarded = '1';
            const origClick = x2Btn.onclick;

            x2Btn.onclick = function(e) {
                if (x2UsedThisLevel || x2Busy) return;
                x2Busy = true;
                x2Btn.disabled = true;
                x2Btn.style.opacity = '0.5';
                x2Btn.style.pointerEvents = 'none';

                const prevCoins = typeof state !== 'undefined' ? state.coins : 0;
                if (typeof origClick === 'function') origClick.call(this, e);

                setTimeout(() => {
                    const nowCoins = typeof state !== 'undefined' ? state.coins : 0;
                    x2Busy = false;
                    if (nowCoins > prevCoins) {
                        x2UsedThisLevel = true;
                        x2Btn.textContent = '✅ Награда x2 получена';
                    } else {
                        // Если рекламу закрыли досрочно — разрешаем 1 повторную попытку, но не бесконечно
                        x2Btn.disabled = false;
                        x2Btn.style.opacity = '1';
                        x2Btn.style.pointerEvents = 'auto';
                    }
                }, 500);
            };
        }
    }, 250);
})();
