const SUPABASE_URL = 'https://vnrwplmznprluqgafcke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucndwbG16bnBybHVxZ2FmY2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2OTgyNjIsImV4cCI6MjExMTI3NDI2Mn0.idFgNFunD4Z0JtchsAvEt1--wltWRLC-o7WbAuv3la0';
const GAME_ID = 'neon_sort';

window.PlatformSDK = {
    type: 'web',
    vkUserId: new URLSearchParams(location.search).get('vk_user_id') || null,
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
    if (!PlatformSDK.vkUserId) {
        PlatformSDK.vkUserId = new URLSearchParams(location.search).get('vk_user_id') || null;
    }
    if (PlatformSDK.type === 'vk' && !PlatformSDK.vkUserId) return;

    const uid = PlatformSDK.vkUserId ? 'vk_' + PlatformSDK.vkUserId : (localStorage.getItem('guest_uid') || (() => {
        const id = 'web_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('guest_uid', id);
        return id;
    })());
    const pName = (typeof extra !== 'undefined' && extra.customName) ? extra.customName : 'Игрок';
    const pScore = Math.max(state.bestScore || 1, state.level || 1);
    const pRank = (typeof extra !== 'undefined' && extra.accLvl) ? extra.accLvl : 1;
    const pCoins = state.coins || 0;

    // Упаковываем полный прогресс (титул, серия, опыт, скины, этап)
    const fullSave = JSON.stringify({
        state: state,
        extra: typeof extra !== 'undefined' ? extra : {},
        prog: typeof prog !== 'undefined' ? prog : {}
    });

    fetch(SUPABASE_URL + '/rest/v1/leaders?on_conflict=game_id,user_id', {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({
            game_id: GAME_ID, user_id: uid, name: pName, photo: PlatformSDK.vkPhoto || '',
            score: Math.floor(pScore), rank: Math.floor(pRank), coins: Math.floor(pCoins),
            save_data: fullSave,
            updated_at: new Date().toISOString()
        })
    }).catch(() => {});
}

function restoreProgressFromSupabase() {
    const vkId = PlatformSDK.vkUserId || new URLSearchParams(location.search).get('vk_user_id');
    if (!vkId || !SUPABASE_URL.startsWith('http') || typeof state === 'undefined') return;

    fetch(SUPABASE_URL + '/rest/v1/leaders?game_id=eq.' + GAME_ID + '&user_id=eq.vk_' + vkId + '&limit=1', {
        headers: getSupabaseHeaders()
    })
    .then(r => r.json())
    .then(rows => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const row = rows;
        let changed = false;

        if (row.save_data) {
            try {
                const parsed = JSON.parse(row.save_data);
                if (parsed.state && (parsed.state.level || 1) >= (state.level || 1)) {
                    Object.assign(state, parsed.state);
                    changed = true;
                }
                if (parsed.extra && typeof extra !== 'undefined' && ((parsed.extra.accLvl || 1) >= (extra.accLvl || 1))) {
                    Object.assign(extra, parsed.extra);
                    changed = true;
                }
                if (parsed.prog && typeof prog !== 'undefined') {
                    Object.assign(prog, parsed.prog);
                    changed = true;
                }
            } catch (e) {}
        }

        if (!changed && (row.score || 1) > (state.level || 1)) {
            state.level = row.score;
            state.bestScore = Math.max(state.bestScore || 1, row.score);
            state.coins = Math.max(state.coins || 0, row.coins || 0);
            if (typeof extra !== 'undefined') extra.accLvl = Math.max(extra.accLvl || 1, row.rank || 1);
            changed = true;
        }

        if (changed) {
            if (typeof saveProgress === 'function') saveProgress();
            if (typeof saveExtra === 'function') saveExtra();
            if (typeof initLevel === 'function') initLevel();
            if (typeof updateHeader === 'function') updateHeader();
            if (typeof renderBoard === 'function') renderBoard();
        }
    })
    .catch(() => {});
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
        const res = await fetch(SUPABASE_URL + '/rest/v1/leaders?game_id=eq.' + GAME_ID + '&order=' + sortBy + '.desc&limit=50', {
            headers: getSupabaseHeaders()
        });
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
            state.coins += 10000;
            state.level = (state.level || 1) + 5;
            state.bestScore = Math.max(state.bestScore || 1, state.level);
            if (typeof extra !== 'undefined') {
                extra.accLvl = (extra.accLvl || 1) + 5;
                if (typeof saveExtra === 'function') saveExtra();
            }
            if (typeof saveProgress === 'function') saveProgress();
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof showFloatText === 'function') showFloatText('👥 Репост: +$10 000 и +5 ур.!', '#38bdf8');
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
        setTimeout(restoreProgressFromSupabase, 300);
        const hookVk = () => {
            if (typeof vkBridge === 'undefined' || PlatformSDK.vkHooked) return;
            PlatformSDK.vkHooked = true;
            vkBridge.send('VKWebAppGetUserInfo').then(u => {
                PlatformSDK.vkUserId = u.id;
                PlatformSDK.vkPhoto = u.photo_100 || u.photo_50 || '';
                localStorage.removeItem('guest_uid');
                if (u.first_name && typeof extra !== 'undefined' && !extra.customName) {
                    extra.customName = (u.first_name + ' ' + (u.last_name || '')).trim().slice(0, 16);
                    if (typeof saveExtra === 'function') saveExtra();
                }
                ;
            }).catch(() => {});
            vkBridge.send('VKWebAppStorageGet', { keys: ['vk_save_state', 'vk_save_extra', 'vk_save_prog'] }).then(res => {
                if (!res || !res.keys) return;
                let upd = false;
                res.keys.forEach(item => {
                    if (!item.value) return;
                    try {
                        const p = JSON.parse(item.value);
                        if (item.key === 'vk_save_state' && typeof state !== 'undefined' && (p.level || 1) > (state.level || 1)) { Object.assign(state, p); upd = true; }
                        if (item.key === 'vk_save_extra' && typeof extra !== 'undefined' && ((p.accLvl || 1) > (extra.accLvl || 1) || (p.accExp || 0) > (extra.accExp || 0))) { Object.assign(extra, p); upd = true; }
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
            btn.textContent = '👥 Поделиться с друзьями (+$10 000 и +5 ур.)';
            btn.onclick = () => shareGameWithFriends(true);
            const last = box.querySelector('button:last-of-type');
            if (last) box.insertBefore(btn, last); else box.appendChild(btn);
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
})();
(function protectWinRewardsAndStreakBug() {
    let x2ClaimedThisWin = false;
    let streakShownThisWin = false;

    if (typeof window.showFloatText === 'function') {
        const origFloat = window.showFloatText;
        window.showFloatText = function(text, color) {
            if (typeof text === 'string' && (text.includes('Серия x') || text.includes('СУНДУК СЕРИИ'))) {
                if (streakShownThisWin) return;
                streakShownThisWin = true;
            }
            return origFloat.apply(this, arguments);
        };
    }

    setInterval(() => {
        const winModal = document.getElementById('win-modal');
        const isWinOpen = winModal && winModal.style.display !== 'none' && winModal.style.display !== '';

        // Как только игрок нажал «Дальше» и окно победы закрылось — сбрасываем замки для следующего уровня!
        if (!isWinOpen) {
            x2ClaimedThisWin = false;
            streakShownThisWin = false;
            return;
        }

        const x2Btn = Array.from(winModal.querySelectorAll('button')).find(
            b => b.textContent.includes('Забрать x2') || b.textContent.includes('Награда x2')
        );
        if (!x2Btn) return;

        if (!x2ClaimedThisWin && x2Btn.disabled && x2Btn.textContent.includes('получена')) {
            x2Btn.disabled = false;
            x2Btn.style.opacity = '1';
            x2Btn.style.pointerEvents = 'auto';
            x2Btn.textContent = '🎬 Забрать x2 (Реклама)';
        }

        if (!x2Btn.dataset.guardedClick) {
            x2Btn.dataset.guardedClick = '1';
            x2Btn.addEventListener('click', function(e) {
                if (x2ClaimedThisWin) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    return;
                }
                const coinsBefore = typeof state !== 'undefined' ? state.coins : 0;
                const checkTimer = setInterval(() => {
                    const coinsAfter = typeof state !== 'undefined' ? state.coins : 0;
                    if (coinsAfter > coinsBefore) {
                        x2ClaimedThisWin = true;
                        x2Btn.disabled = true;
                        x2Btn.style.opacity = '0.5';
                        x2Btn.style.pointerEvents = 'none';
                        x2Btn.textContent = '✅ Награда x2 получена';
                        clearInterval(checkTimer);
                    }
                }, 300);
                setTimeout(() => clearInterval(checkTimer), 45000);
            }, true);
        }
    }, 250);
})();

(function setupMobileModerationCompliance() {
    document.addEventListener('visibilitychange', () => {
        if (typeof audioCtx !== 'undefined' && audioCtx) {
            if (document.hidden) audioCtx.suspend().catch(() => {});
            else if (typeof state !== 'undefined' && state.sound !== false) audioCtx.resume().catch(() => {});
        }
    });
    window.addEventListener('pagehide', () => {
        if (typeof audioCtx !== 'undefined' && audioCtx) audioCtx.suspend().catch(() => {});
    });

    setInterval(() => {
        if (typeof state !== 'undefined' && state.level > (state.bestScore || 1)) {
            state.bestScore = state.level;
            syncLeaderToSupabase();
        }
    }, 2000);
})();

(function guaranteeSolvableLevels() {
    if (typeof window.initLevel !== 'function') return;
    const origInitLevel = window.initLevel;

    window.initLevel = function() {
        origInitLevel.apply(this, arguments);
        if (typeof tubes === 'undefined' || !Array.isArray(tubes)) return;

        // 1. Собираем все цвета на уровне и проверяем, есть ли замороженные шары
        const frozenColors = new Set();
        const allColors = new Set();
        let hasHazards = false;

        tubes.forEach(tube => {
            tube.forEach(ball => {
                if (!ball) return;
                const col = typeof ball === 'object' ? ball.color : ball;
                allColors.add(col);
                if (typeof ball === 'object') {
                    if (ball.frozen) {
                        frozenColors.add(col);
                        hasHazards = true;
                    }
                    if (ball.hidden) hasHazards = true;
                }
            });
        });

        // 2. Если заморожены ВСЕ цвета (нельзя собрать ни одну полную колбу для разморозки) —
        // размораживаем один случайный цвет целиком, чтобы всегда был выход из ситуации!
        if (frozenColors.size > 0 && frozenColors.size >= allColors.size) {
            const unlockColor = Array.from(allColors)[0];
            tubes.forEach(tube => {
                tube.forEach(ball => {
                    if (ball && typeof ball === 'object' && ball.color === unlockColor) {
                        ball.frozen = false;
                    }
                });
            });
        }

        // 3. Гарантируем минимум 2 пустые колбы на уровнях со льдом или вопросами
        const emptyCount = tubes.filter(t => t.length === 0).length;
        if (hasHazards && emptyCount < 2) {
            tubes.push([]);
        }

        if (typeof renderBoard === 'function') renderBoard();
    };
})();

if (typeof window.watchAd === 'function') {
    window.watchAd = function(onReward) {
        if (typeof window.showRewarded === 'function') {
            window.showRewarded(onReward);
        } else if (typeof showFloatText === 'function') {
            showFloatText('⏳ Реклама пока недоступна', '#94a3b8');
        }
    };
}
