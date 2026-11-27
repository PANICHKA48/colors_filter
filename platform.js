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

    const rowsBox = document.createElement('div');
    listEl.appendChild(rowsBox);

    const myUid = PlatformSDK.vkUserId ? 'vk_' + PlatformSDK.vkUserId : localStorage.getItem('guest_uid');
    const cacheKey = 'lb_cache_' + sortBy;

    const renderRows = (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            rowsBox.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Пока нет записей. Пройди этап!</div>';
            return;
        }
        rowsBox.innerHTML = rows.map((r, idx) => {
            const isMe = r.user_id === myUid;
            const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
            const avatar = r.photo ? `<img src="${r.photo}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">` : '';
            const val = sortBy === 'rank' ? '⭐ ' + r.rank : (sortBy === 'coins' ? '$' + Number(r.coins).toLocaleString('ru-RU') : 'Этап ' + r.score);
            return `<div class="card-item ${isMe ? 'active-skin' : ''}" style="margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <span style="font-weight:900;min-width:26px;color:#fbbf24;">${medal}</span>
                    ${avatar}
                    <span style="font-weight:700;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${(r.name || 'Игрок') + (isMe ? ' (Вы)' : '')}</span>
                </div>
                <strong style="font-size:13px;color:#38bdf8;white-space:nowrap;">${val}</strong>
            </div>`;
        }).join('');
    };

    // 1. Мгновенно показываем кэш с телефона за 0 мс, если он есть
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && cached.length > 0) renderRows(cached);
        else rowsBox.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">⏳ Загрузка рейтинга...</div>';
    } catch (e) {}

    // 2. В фоне запрашиваем только лёгкие колонки (без тяжёлого save_data!) с таймаутом 6 сек
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const url = `${SUPABASE_URL}/rest/v1/leaders?game_id=eq.${GAME_ID}&select=user_id,name,photo,score,rank,coins&order=${sortBy}.desc&limit=50`;
        const res = await fetch(url, { headers: getSupabaseHeaders(), signal: ctrl.signal });
        clearTimeout(timer);
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify(rows));
            renderRows(rows);
        }
    } catch (e) {
        if (!rowsBox.querySelector('.card-item')) {
            rowsBox.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">⚠️ Медленный интернет. Попробуйте ещё раз</div>';
        }
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
            state.coins += 500;
            if (typeof extraTickets !== 'undefined') {
                extraTickets.hint += 1;
                if (typeof saveTickets === 'function') saveTickets();
            }
            if (typeof saveProgress === 'function') saveProgress();
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof showFloatText === 'function') showFloatText('👥 Репост: +$500 и +1 Подсказка!', '#38bdf8');
            if (typeof playTone === 'function') playTone(820, 0.25);
        }
    };
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppShare', { link: appUrl }).then(rewardOnce).catch(() => {});
    }
}

(function initUniversalPlatform() {
    const isVk = location.search.includes('vk_') || location.hash.includes('vk_') || (document.referrer && document.referrer.includes('vk.'));
    if (isVk) {
        PlatformSDK.type = 'vk';
        setTimeout(restoreProgressFromSupabase, 350);
        // Фоновый прогрев рейтинга сразу при входе в игру для мгновенного открытия 🏆
        setTimeout(() => {
            fetch(`${SUPABASE_URL}/rest/v1/leaders?game_id=eq.${GAME_ID}&select=user_id,name,photo,score,rank,coins&order=score.desc&limit=50`, {
                headers: getSupabaseHeaders()
            })
            .then(r => r.json())
            .then(rows => {
                if (Array.isArray(rows) && rows.length > 0) {
                    localStorage.setItem('lb_cache_score', JSON.stringify(rows));
                }
            })
            .catch(() => {});
        }, 800);
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
                    let fsStyle = document.getElementById('vk-pc-fullscreen-style');
                    if (document.fullscreenElement) {
                        if (!fsStyle) {
                            fsStyle = document.createElement('style');
                            fsStyle.id = 'vk-pc-fullscreen-style';
                            fsStyle.textContent = `
                                #game-wrapper {
                                    max-width: 680px !important;
                                    max-height: 100vh !important;
                                    width: min(92vw, 680px) !important;
                                    height: 100vh !important;
                                    padding: 16px 20px !important;
                                }
                                #tubes-container {
                                    transform: scale(1.22) !important;
                                    transform-origin: center center !important;
                                    max-width: 82% !important;
                                    margin: 0 auto !important;
                                }
                            `;
                            document.head.appendChild(fsStyle);
                        }
                        fsBtn.textContent = '🗗';
                    } else {
                        if (fsStyle) fsStyle.remove();
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
                btn.textContent = '👥 Поделиться с друзьями (+$500 и +1 💡)';
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
            let lastFloatMsg = '', lastFloatTime = 0;
            window.showFloatText = function(text, color) {
                if (typeof text === 'string') {
                    // Блокируем ложное уведомление о тайном этапе, если реальный этап не кратен 5
                    if (text.includes('ТАЙНЫЙ ЭТАП') || text.includes('MYSTERY STAGE') || text.includes('GİZEMLİ AŞAMA')) {
                        if (typeof state !== 'undefined' && (state.level < 5 || state.level % 5 !== 0)) return;
                    }
                    // Блокируем ложное уведомление о льде, если замороженных колб нет
                    if (text.includes('ЛЕДЯНЫЕ КОЛБЫ') || text.includes('FROZEN TUBES') || text.includes('DONMUŞ TÜPLER')) {
                        const hasRealIce = document.querySelectorAll('.frozen-tube, .frozen').length > 0 ||
                            (typeof frozenTubes !== 'undefined' && frozenTubes.length > 0);
                        if (!hasRealIce) return;
                    }
                    // Не дублируем одинаковую плашку дважды подряд при синхронизации с облаком
                    const now = Date.now();
                    if (text === lastFloatMsg && now - lastFloatTime < 2500) return;
                    lastFloatMsg = text;
                    lastFloatTime = now;
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

// =========================================================================
// === ОТКАТ ТАЙНЫХ ШАРОВ (?) ПРИ НАЖАТИИ «ОТМЕНА» (ЗАЩИТА ОТ ПРОСВЕТА) ===
// =========================================================================
let maskHistoryStack = [];

const origGenMaskStack = generateLevel;
generateLevel = function(lvl) {
    maskHistoryStack = [];
    origGenMaskStack(lvl);
};

const origClickSaveMask = onTubeClick;
onTubeClick = function(idx) {
    const prevMoves = movesCount;
    const snapMask = JSON.parse(JSON.stringify(revealedMask || []));
    origClickSaveMask(idx);
    if (movesCount > prevMoves) {
        maskHistoryStack.push(snapMask);
    }
};

const origUndoRestoreMask = undoMove;
undoMove = function() {
    const prevMoves = movesCount;
    origUndoRestoreMask();
    if (movesCount < prevMoves && maskHistoryStack.length > 0) {
        revealedMask = maskHistoryStack.pop();
        renderBoard();
    }
};
