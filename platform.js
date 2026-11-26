const SUPABASE_URL = 'https://vnrwplmznprluqgafcke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucndwbG16bnBybHVxZ2FmY2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2OTgyNjIsImV4cCI6MjExMTI3NDI2Mn0.idFgNFunD4Z0JtchsAvEt1--wltWRLC-o7WbAuv3la0';
const GAME_ID = 'neon_sort';

let cloudRestored = false;

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
    if (!SUPABASE_URL.startsWith('http') || SUPABASE_KEY.includes('СЮДА_ВСТАВЬ') || typeof state === 'undefined') return;
    if (PlatformSDK.type === 'vk' && !cloudRestored) return;
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

    const fullSave = JSON.stringify({
        state: state,
        extra: typeof extra !== 'undefined' ? extra : {},
        prog: typeof prog !== 'undefined' ? prog : {},
        tickets: typeof extraTickets !== 'undefined' ? extraTickets : { hint: 0, tube: 0 }
    });

    fetch(SUPABASE_URL + '/rest/v1/leaders?on_conflict=game_id,user_id', {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({
            game_id: GAME_ID, user_id: uid, name: pName, photo: PlatformSDK.vkPhoto || '',
            score: Math.floor(pScore), rank: Math.floor(pRank), coins: Math.floor(pCoins),
            save_data: fullSave, updated_at: new Date().toISOString()
        })
    }).catch(() => {});
}

function restoreProgressFromSupabase() {
    const vkId = PlatformSDK.vkUserId || new URLSearchParams(location.search).get('vk_user_id');
    if (!vkId || !SUPABASE_URL.startsWith('http') || SUPABASE_KEY.includes('СЮДА_ВСТАВЬ') || typeof state === 'undefined') return;

    fetch(SUPABASE_URL + '/rest/v1/leaders?game_id=eq.' + GAME_ID + '&user_id=eq.vk_' + vkId + '&limit=1', {
        headers: getSupabaseHeaders()
    })
    .then(r => r.json())
    .then(rows => {
        cloudRestored = true;
        if (!Array.isArray(rows) || rows.length === 0) return;
        const [row] = rows;
        let changed = false;

        if (row.save_data) {
            try {
                const parsed = JSON.parse(row.save_data);
                if (parsed.state && (parsed.state.level || 1) >= (state.level || 1)) {
                    Object.assign(state, parsed.state);
                    changed = true;
                }
                if (parsed.extra && typeof extra !== 'undefined' && ((parsed.extra.accLvl || 1) > (extra.accLvl || 1) || (parsed.extra.accExp || 0) > (extra.accExp || 0))) {
                    Object.assign(extra, parsed.extra);
                    changed = true;
                }
                if (parsed.prog && typeof prog !== 'undefined') {
                    Object.assign(prog, parsed.prog);
                    changed = true;
                }
                if (parsed.tickets && typeof extraTickets !== 'undefined') {
                    Object.assign(extraTickets, parsed.tickets);
                    if (typeof saveTickets === 'function') saveTickets();
                    changed = true;
                }
            } catch (e) {}
        }

        if (typeof extra !== 'undefined' && (row.rank || 1) > (extra.accLvl || 1)) {
            extra.accLvl = row.rank;
            changed = true;
        }
        if ((row.score || 1) > (state.level || 1)) {
            state.level = row.score;
            state.bestScore = Math.max(state.bestScore || 1, row.score);
            changed = true;
        }
        if ((row.coins || 0) > (state.coins || 0)) {
            state.coins = row.coins;
            changed = true;
        }

        if (changed) {
            if (typeof saveProgress === 'function') saveProgress();
            if (typeof saveExtra === 'function') saveExtra();
            if (typeof saveProg === 'function') saveProg();
            if (typeof generateLevel === 'function') generateLevel(state.level);
            if (typeof updateExpBar === 'function') updateExpBar();
            if (typeof updateStreakUI === 'function') updateStreakUI();
            if (typeof refreshTitleBadge === 'function') refreshTitleBadge();
            if (typeof renderBoard === 'function') renderBoard();
        }
    })
    .catch(() => { cloudRestored = true; });
}

async function openGlobalSupabaseLeaderboard(sortBy = 'score') {
    if (typeof closeModals === 'function') closeModals();
    const modal = document.getElementById('lb-modal');
    const listEl = document.getElementById('lb-list');
    if (!modal || !listEl) return;

    modal.style.display = 'flex';
    listEl.innerHTML = '';

    const tabsRow = document.createElement('div');
    tabsRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;';
    [{ key: 'score', label: '🏆 Этап' }, { key: 'rank', label: '⭐ Ранг' }, { key: 'coins', label: '💰 Баланс' }].forEach(t => {
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
            empty.textContent = 'Пока нет записей. Пройди этап!';
            listEl.appendChild(empty);
            return;
        }

        const myUid = PlatformSDK.vkUserId ? 'vk_' + PlatformSDK.vkUserId : localStorage.getItem('guest_uid');
        rows.forEach((r, idx) => {
            const isMe = r.user_id === myUid;
            const rowEl = document.createElement('div');
            rowEl.className = 'card-item ' + (isMe ? 'active-skin' : '');
            rowEl.style.marginBottom = '6px';

            const left = document.createElement('div');
            left.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;';
            const medal = document.createElement('span');
            medal.style.cssText = 'font-weight:900;min-width:26px;color:#fbbf24;';
            medal.textContent = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
            left.appendChild(medal);

            if (r.photo) {
                const img = document.createElement('img');
                img.src = r.photo;
                img.style.cssText = 'width:26px;height:26px;border-radius:50%;object-fit:cover;';
                left.appendChild(img);
            }

            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'font-weight:700;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;';
            nameSpan.textContent = (r.name || 'Игрок') + (isMe ? ' (Вы)' : '');
            left.appendChild(nameSpan);

            const valSpan = document.createElement('strong');
            valSpan.style.cssText = 'font-size:13px;color:#38bdf8;white-space:nowrap;';
            valSpan.textContent = sortBy === 'rank' ? '⭐ ' + r.rank : (sortBy === 'coins' ? '$' + Number(r.coins).toLocaleString('ru-RU') : 'Этап ' + r.score);

            rowEl.appendChild(left);
            rowEl.appendChild(valSpan);
            listEl.appendChild(rowEl);
        });
    } catch (e) {
        statusDiv.textContent = '⚠️ Нет связи с сервером рейтинга';
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
            if (typeof updateExpBar === 'function') updateExpBar();
            if (typeof refreshTitleBadge === 'function') refreshTitleBadge();
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof showFloatText === 'function') showFloatText('👥 Репост: +$10 000 и +5 рангов!', '#38bdf8');
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
        setTimeout(restoreProgressFromSupabase, 350);

        const hookVk = () => {
            if (typeof vkBridge === 'undefined' || PlatformSDK.vkHooked) return;
            PlatformSDK.vkHooked = true;
            vkBridge.send('VKWebAppInit').catch(() => {});
            vkBridge.send('VKWebAppGetUserInfo').then(u => {
                PlatformSDK.vkUserId = u.id;
                PlatformSDK.vkPhoto = u.photo_100 || u.photo_50 || '';
                localStorage.removeItem('guest_uid');
                if (u.first_name && typeof extra !== 'undefined' && (!extra.customName || extra.customName === 'Игрок')) {
                    extra.customName = (u.first_name + ' ' + (u.last_name || '')).trim().slice(0, 16);
                    if (typeof saveExtra === 'function') saveExtra();
                }
                restoreProgressFromSupabase();
                syncLeaderToSupabase();
            }).catch(() => {});

            window.showInterstitial = () => {
                isPaused = true;
                vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).finally(() => { isPaused = false; });
            };

            window.showRewarded = (cb) => {
                isPaused = true;
                vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
                    .then(r => {
                        isPaused = false;
                        if (r && r.result && typeof cb === 'function') cb();
                    })
                    .catch(() => {
                        isPaused = false;
                        if (typeof showFloatText === 'function') showFloatText('⏳ Реклама пока недоступна', '#94a3b8');
                    });
            };
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
    };

    window.addEventListener('load', () => {
        if (PlatformSDK.type === 'vk') {
            const topLeft = document.querySelector('.top-bar .btn-group');
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            // Добавляем кнопку полноэкранного режима только на ПК
            if (topLeft && !isMobile && !document.getElementById('fullscreen-btn')) {
                const fsBtn = document.createElement('button');
                fsBtn.className = 'icon-btn';
                fsBtn.id = 'fullscreen-btn';
                fsBtn.title = 'На весь экран';
                fsBtn.textContent = '⛶';
                const applyFullscreenScale = () => {
                    const wrap = document.getElementById('game-wrapper') || document.querySelector('.app-container') || document.body;
                    if (document.fullscreenElement) {
                        document.querySelectorAll('body > div').forEach(el => {
                            if (el.offsetHeight > 300) {
                                el.style.maxWidth = '820px';
                                el.style.width = '90vw';
                            }
                        });
                        fsBtn.textContent = '🗗';
                    } else {
                        document.querySelectorAll('body > div').forEach(el => {
                            el.style.maxWidth = '';
                            el.style.width = '';
                        });
                        fsBtn.textContent = '⛶';
                    }
                };

                fsBtn.onclick = () => {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                    } else {
                        document.exitFullscreen().catch(() => {});
                    }
                };
                document.addEventListener('fullscreenchange', applyFullscreenScale);
                topLeft.appendChild(fsBtn);
            }
            const winModal = document.getElementById('win-modal');
            if (winModal && !document.getElementById('vk-share-modal-btn')) {
                const btn = document.createElement('button');
                btn.id = 'vk-share-modal-btn';
                btn.className = 'action-btn modal-btn';
                btn.style.cssText = 'background:linear-gradient(135deg,#2563eb,#7c3aed);margin-top:4px;';
                btn.textContent = '👥 Поделиться с друзьями (+$10 000 и +5 ур.)';
                btn.onclick = () => shareGameWithFriends(true);
                const lastBtn = winModal.querySelector('button:last-of-type');
                if (lastBtn) winModal.insertBefore(btn, lastBtn); else winModal.appendChild(btn);
            }
        }

        if (typeof window.generateLevel === 'function') {
            const origGen = window.generateLevel;
            window.generateLevel = function(lvl) {
                const scaledLvl = lvl <= 1 ? 1 : Math.min(60, Math.max(1, Math.round(lvl * 0.6)));
                origGen.call(this, scaledLvl);
                if (typeof state !== 'undefined') state.level = lvl;
        
                // Синхронизируем тайные шары и лёд с реальным номером этапа (lvl)
                if (typeof tubes !== 'undefined' && Array.isArray(tubes)) {
                    if (typeof isMysteryStage === 'function' && isMysteryStage(lvl) && typeof revealedMask !== 'undefined') {
                        revealedMask = tubes.map(t => t.map((_, idx) => idx === t.length - 1));
                    }
                    const hasFrozen = typeof frozenTubes !== 'undefined' && frozenTubes.length > 0;
                    const hasMystery = typeof isMysteryStage === 'function' && isMysteryStage(lvl);
                    const emptyCount = tubes.filter(t => t.length === 0).length;
                    if ((hasFrozen || hasMystery) && emptyCount < 2) {
                        tubes.push([]);
                        if (typeof revealedMask !== 'undefined') revealedMask.push([true, true, true, true]);
                    }
                    if (typeof renderBoard === 'function') renderBoard();
                }
            };
        }
    });

    let x2ClaimedThisWin = false;
    let streakShownThisWin = false;

    setTimeout(() => {
        if (typeof window.showFloatText === 'function') {
            const origFloat = window.showFloatText;
            window.showFloatText = function(text, color) {
                    if (typeof text === 'string' && text.includes('ЛЕДЯНЫЕ КОЛБЫ')) {
                    const hasRealIce = document.querySelectorAll('.frozen, [data-frozen="true"]').length > 0 ||
                        (typeof frozenTubes !== 'undefined' && frozenTubes.length > 0);
                    if (!hasRealIce) return;
                }
                if (typeof text === 'string' && (text.includes('Серия x') || text.includes('СУНДУК СЕРИИ'))) {
                    if (streakShownThisWin) return;
                    streakShownThisWin = true;
                }
                return origFloat.apply(this, arguments);
            };
        }
    }, 300);

    setInterval(() => {
        const winModal = document.getElementById('win-modal');
        const isWinOpen = winModal && winModal.style.display !== 'none' && winModal.style.display !== '';

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
            x2Btn.textContent = '📺 Забрать x2 (Реклама)';
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
                let ticks = 0;
                const checkTimer = setInterval(() => {
                    ticks++;
                    const coinsAfter = typeof state !== 'undefined' ? state.coins : 0;
                    if (coinsAfter > coinsBefore) {
                        x2ClaimedThisWin = true;
                        x2Btn.disabled = true;
                        x2Btn.style.opacity = '0.5';
                        x2Btn.style.pointerEvents = 'none';
                        x2Btn.textContent = '✅ Награда x2 получена';
                        clearInterval(checkTimer);
                    } else if (ticks > 60) {
                        clearInterval(checkTimer);
                    }
                }, 400);
            }, true);
        }
    }, 300);

    document.addEventListener('visibilitychange', () => {
        if (typeof audioCtx !== 'undefined' && audioCtx) {
            if (document.hidden) audioCtx.suspend().catch(() => {});
            else if (typeof state !== 'undefined' && state.sound !== false) audioCtx.resume().catch(() => {});
        }
    });
    window.addEventListener('pagehide', () => {
        if (typeof audioCtx !== 'undefined' && audioCtx) audioCtx.suspend().catch(() => {});
    });
})();

    document.addEventListener('focusin', (e) => {
        if (e.target && e.target.tagName === 'INPUT') {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) {
                overlay.style.alignItems = 'flex-start';
                overlay.style.paddingTop = '14px';
            }
        }
    });
    document.addEventListener('focusout', (e) => {
        if (e.target && e.target.tagName === 'INPUT') {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) {
                overlay.style.alignItems = '';
                overlay.style.paddingTop = '';
            }
        }
    });
