window.PlatformSDK = {
    type: 'web',
    vkUserId: null,
    lastShareBonusDay: localStorage.getItem('vk_share_bonus_day') || ''
};

(function initUniversalPlatform() {
    const isVk = location.search.includes('vk_') || location.hash.includes('vk_') || (document.referrer && document.referrer.includes('vk.'));

    if (isVk) {
        PlatformSDK.type = 'vk';

        if (typeof vkBridge !== 'undefined') {
            vkBridge.send('VKWebAppInit').catch(() => {});

            // 1. Получаем имя игрока и загружаем облачное сохранение аккаунта ВК (ПК <-> Телефон)
            vkBridge.send('VKWebAppGetUserInfo').then(u => {
                PlatformSDK.vkUserId = u.id;
                if (u.first_name && typeof extra !== 'undefined' && !extra.customName) {
                    extra.customName = (u.first_name + ' ' + (u.last_name || '')).trim().slice(0, 16);
                    if (typeof saveExtra === 'function') saveExtra();
                }
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

            // 2. Дублируем каждое локальное сохранение в облако ВКонтакте
            const origSaveProgress = window.saveProgress;
            window.saveProgress = function() {
                if (typeof origSaveProgress === 'function') origSaveProgress();
                if (typeof vkBridge !== 'undefined' && typeof state !== 'undefined') {
                    vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_state', value: JSON.stringify(state) }).catch(() => {});
                    if (typeof extra !== 'undefined') {
                        vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_extra', value: JSON.stringify(extra) }).catch(() => {});
                    }
                    if (typeof prog !== 'undefined') {
                        vkBridge.send('VKWebAppStorageSet', { key: 'vk_save_prog', value: JSON.stringify(prog) }).catch(() => {});
                    }
                }
            };

            // 3. Реклама и лидерборд ВК
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

            const origOpenLb = window.openLeaderboard;
            window.openLeaderboard = function() {
                const val = typeof state !== 'undefined' ? (state.level || 1) : 1;
                vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: Math.floor(val), global: 1 })
                    .catch(() => { if (typeof origOpenLb === 'function') origOpenLb(); });
            };
        }
    }

    // 4. Добавляем кнопки «👥 Поделиться» в шапку и в окно победы
    function injectVkShareButtons() {
        if (PlatformSDK.type !== 'vk') return;

        const topLeft = document.querySelector('.top-bar .btn-group') || document.querySelector('.top-bar');
        if (topLeft && !document.getElementById('vk-share-top-btn')) {
            topLeft.insertAdjacentHTML('beforeend',
                '<button class="icon-btn" id="vk-share-top-btn" onclick="shareGameWithFriends(true)" title="Поделиться с друзьями" style="border-color:#38bdf8;">👥</button>'
            );
        }

        const targetModal = document.getElementById('win-modal') || document.getElementById('gameover-modal');
        if (targetModal && !document.getElementById('vk-share-modal-btn')) {
            const box = targetModal.querySelector('.modal-content') || targetModal;
            const shareBtn = document.createElement('button');
            shareBtn.id = 'vk-share-modal-btn';
            shareBtn.className = 'action-btn modal-btn';
            shareBtn.style.cssText = 'background:linear-gradient(135deg,#2563eb,#7c3aed);margin-top:8px;width:100%;';
            shareBtn.innerHTML = '👥 Поделиться с друзьями (+$150)';
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
    if (typeof vkBridge === 'undefined') return;
    const appUrl = document.referrer && document.referrer.includes('://vk.com')
        ? document.referrer.split('?')[0]
        : 'https://://vk.com' + (new URLSearchParams(location.search).get('vk_app_id') || '');

    vkBridge.send('VKWebAppShare', { link: appUrl })
        .then(() => {
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
        })
        .catch(() => {});
}
