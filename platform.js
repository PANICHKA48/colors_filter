const SUPABASE_URL = 'https://vnrwplmznprluqgafcke.supabase.com';
const SUPABASE_KEY = 'sb_publishable_-PTgDlvlE2S49OHWxjK_lw_8HIcBZ-E';
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
        'Content-Type': 'application/json'
    }, extraHeaders || {});
}

function syncLeaderToSupabase() {
    if (!SUPABASE_URL.startsWith('http') || !SUPABASE_KEY.startsWith('sb_') && !SUPABASE_KEY.startsWith('eyJ')) return;
    if (typeof state === 'undefined') return;

    const uid = PlatformSDK.vkUserId
        ? 'vk_' + PlatformSDK.vkUserId
        : (localStorage.getItem('guest_uid') || (() => {
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
            game_id: GAME_ID,
            user_id: uid,
            name: pName,
            photo: PlatformSDK.vkPhoto || '',
            score: Math.floor(pScore),
            rank: Math.floor(pRank),
            coins: Math.floor(pCoins),
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
    [
        { key: 'score', label: '🏆 Рекорд' },
        { key: 'rank',  label: '⭐ Ранг' },
        { key: 'coins', label: '💰 Баланс' }
    ].forEach(t => {
        const b = document.createElement('button');
        const active = sortBy === t.key;
        b.style.cssText = 'padding:8px 4px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;' +
            'background:' + (active ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)') + ';' +
            'border:1px solid ' + (active ? '#38bdf8' : 'rgba(255,255,255,0.14)') + ';' +
            'color:' + (active ? '#ffffff' : '#cbd5e1') + ';';
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
        const timer = setTimeout(() => controller.abort(), 3200); // Ждём максимум 3.2 сек

        const res = await fetch(
            SUPABASE_URL + '/rest/v1/leaders?game_id=eq.' + GAME_ID + '&order=' + sortBy + '.desc&limit=50',
            { headers: getSupabaseHeaders(), signal: controller.signal }
        );
        clearTimeout(timer);
        const rows = await res.json();
        statusDiv.remove();

        if (!Array.isArray(rows) || rows.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:16px;text-align:center;color:#94a3b8;font-size:13px;';
            empty.textContent = 'Пока нет записей. Пройди уровень, чтобы стать первым!';
            listEl.appendChild(empty);
            return;
        }

        const myUid = PlatformSDK.vkUserId ? 'vk_' + PlatformSDK.vkUserId : localStorage.getItem('guest_uid');
        rows.forEach((r, idx) => {
            const isMe = r.user_id === myUid;
            const rowEl = document.createElement('div');
            rowEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:6px;border-radius:10px;' +
                'background:' + (isMe ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)') + ';' +
                'border:1px solid ' + (isMe ? '#38bdf8' : 'rgba(255,255,255,0.08)') + ';';

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
        // Если провайдер игрока в РФ замедляет supabase.co — плавно показываем встроенный рейтинг без красной ошибки!
        if (typeof renderLeaderboardList === 'function') {
            renderLeaderboardList(sortBy === 'score' ? 'level' : sortBy);
        } else {
            statusDiv.style.color = '#94a3b8';
            statusDiv.textContent = 'Локальный режим рейтинга активен';
        }
    }

function setupVkBridgeHooks() {
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

    vkBridge.send('VKWebAppStorageGet', { keys: ['vk_save_state', 'vk_save_extra', 'vk_save_prog'] })
        .then(res => {
            if (!res || !res.keys) return;
            let updated = false;
            res.keys.forEach(item => {
                if (!item.value) return;
                try {
                    const parsed = JSON.parse(item.value);
                    if (item.key === 'vk_save_state' && typeof state !== 'undefined' && (parsed.level || 1) > (state.level || 1)) {
                        Object.assign(state, parsed);
                        updated = true;
                    }
                    if (item.key === 'vk_save_extra' && typeof extra !== 'undefined' && (parsed.accExp || 0) > (extra.accExp || 0)) {
                        Object.assign(extra, parsed);
                        updated = true;
                    }
                    if (item.key === 'vk_save_prog' && typeof prog !== 'undefined') {
                        Object.assign(prog, parsed);
                        updated = true;
                    }
                } catch (e) {}
            });
            if (updated) {
                if (typeof saveProgress === 'function') saveProgress();
                if (typeof renderBoard === 'function') renderBoard();
            }
        }).catch(() => {});

    window.showInterstitial = function() {
        isPaused = true;
        vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).finally(() => { isPaused = false; });
    };

    window.showRewarded = function(onSuccess) {
        isPaused = true;
        vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
            .then(res => { isPaused = false; if (res && res.result) onSuccess(); })
            .catch(() => { isPaused = false; });
    };
}

(function initUniversalPlatform() {
    const isVk = location.search.includes('vk_') || location.hash.includes('vk_') || (document.referrer && document.referrer.includes('vk.'));

    if (isVk) {
        PlatformSDK.type = 'vk';
        setupVkBridgeHooks();
        // Ждём до 4 секунд, пока догрузится динамический скрипт vk-bridge
        let tries = 0;
        const waitBridge = setInterval(() => {
            tries++;
            if (typeof vkBridge !== 'undefined') {
                setupVkBridgeHooks();
                clearInterval(waitBridge);
            } else if (tries > 20) {
                clearInterval(waitBridge);
            }
        }, 200);

        window.openLeaderboard = function() {
            syncLeaderToSupabase();
            openGlobalSupabaseLeaderboard('score');
        };
    }

    const origSaveProgress = window.saveProgress;
    window.saveProgress = function() {
        if (typeof origSaveProgress === 'function') origSaveProgress();
        syncLeaderToSupabase();

        if (PlatformSDK.type === 'vk' && typeof vkBridge !== 'undefined' && typeof state !== 'undefined') {
            vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_state', value: JSON.stringify(state) }).catch(() => {});
            if (typeof extra !== 'undefined') {
                vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_extra', value: JSON.stringify(extra) }).catch(() => {});
            }
            if (typeof prog !== 'undefined') {
                vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_prog', value: JSON.stringify(prog) }).catch(() => {});
            }
        }
    };

    function injectVkShareButtons() {
        if (PlatformSDK.type !== 'vk') return;

        // Вставляем кнопку только в окно победы/проигрыша, чтобы не сдвигать верхнюю панель иконок!
        const targetModal = document.getElementById('win-modal') || document.getElementById('gameover-modal');
        if (targetModal && !document.getElementById('vk-share-modal-btn')) {
            const box = targetModal.querySelector('.modal-content') || targetModal;
            const shareBtn = document.createElement('button');
            shareBtn.id = 'vk-share-modal-btn';
            shareBtn.className = 'action-btn modal-btn';
            shareBtn.style.cssText = 'background:linear-gradient(135deg,#2563eb,#7c3aed);margin-top:8px;width:100%;';
            shareBtn.textContent = '👥 Поделиться с друзьями (+$150)';
            shareBtn.onclick = () => shareGameWithFriends(true);

            const lastBtn = box.querySelector('button:last-of-type');
            if (lastBtn) box.insertBefore(shareBtn, lastBtn);
            else box.appendChild(shareBtn);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectVkShareButtons);
    } else {
        injectVkShareButtons();
    }
})();

function shareGameWithFriends(withBonus) {
    const appId = new URLSearchParams(location.search).get('vk_app_id') || '';
    const appUrl = appId ? 'https://vk.com' + appId : 'https://vk.com';

    const rewardOnce = () => {
        const today = new Date().toDateString();
        if (withBonus && PlatformSDK.lastShareBonusDay !== today && typeof state !== 'undefined') {
            PlatformSDK.lastShareBonusDay = today;
            localStorage.setItem('vk_share_bonus_day', today);
            state.coins += 150;
            if (typeof saveProgress === 'function') saveProgress();
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof showFloatText === 'function') showFloatText('👥 Спасибо за приглашение! +$150!', '#38bdf8');
            if (typeof playTone === 'function') playTone(820, 0.25);
        }
    };

    if (typeof vkBridge !== 'undefined') {
        // Пробуем сначала нативное приглашение друзей в игру, если недоступно — репост ссылки
        vkBridge.send('VKWebAppShowInviteBox', {})
            .then(rewardOnce)
            .catch(() => {
                vkBridge.send('VKWebAppShare', { link: appUrl }).then(rewardOnce).catch(() => {});
            });
    } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ handler: 'VKWebAppShowInviteBox', params: {}, type: 'vk-connect' }, '*');
        rewardOnce();
    }
}
