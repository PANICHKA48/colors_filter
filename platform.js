// =========================================================================
// === УНИВЕРСАЛЬНЫЙ МОСТ ПЛАТФОРМ: YANDEX GAMES + VK MINI APPS (BRIDGE) ===
// =========================================================================

window.PlatformSDK = {
    type: 'web', // 'yandex' | 'vk' | 'web'
    vkUserId: null,
    lastShareBonusDay: localStorage.getItem('vk_share_bonus_day') || ''
};

(function initUniversalPlatform() {
    const isVk = location.search.includes('vk_app_id') || location.hash.includes('vk_app_id');

    // 1. ВЕТКА ВКОНТАКТЕ (VK BRIDGE)
    if (isVk && typeof vkBridge !== 'undefined') {
        PlatformSDK.type = 'vk';
        vkBridge.send('VKWebAppInit').then(() => {
            vkBridge.send('VKWebAppGetUserInfo').then(u => {
                PlatformSDK.vkUserId = u.id;
                if (u.first_name && typeof extra !== 'undefined' && !extra.customName) {
                    extra.customName = (u.first_name + ' ' + (u.last_name || '')).trim().slice(0, 16);
                    if (typeof saveExtra === 'function') saveExtra();
                }
            }).catch(() => {});
        }).catch(() => {});

        // Подменяем межстраничную и бонусную рекламу на нативную рекламу ВКонтакте
        window.showInterstitial = function() {
            isPaused = true;
            vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
                .finally(() => { isPaused = false; });
        };

        window.showRewarded = function(onSuccess) {
            isPaused = true;
            vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
                .then(res => {
                    isPaused = false;
                    if (res && res.result) onSuccess();
                })
                .catch(() => { isPaused = false; });
        };

        // Подменяем отправку рекорда и открытие топа на системный лидерборд друзей ВК
        window.submitScoreToLb = function(scoreVal) {
            if (!scoreVal) return;
            vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: Math.floor(scoreVal), global: 1 }).catch(() => {});
        };

        const origOpenLb = window.openLeaderboard;
        window.openLeaderboard = function() {
            const val = typeof state !== 'undefined' ? (state.bestScore || state.level || 1) : 1;
            vkBridge.send('VKWebAppShowLeaderBoardBox', { user_result: Math.floor(val), global: 1 })
                .catch(() => {
                    // Если системный топ ещё не включён в настройках кабинета ВК — открываем запасной топ
                    if (typeof origOpenLb === 'function') origOpenLb();
                });
        };
    }

    // 2. ДОБАВЛЯЕМ ВИРАЛЬНЫЕ КНОПКИ «ПОДЕЛИТЬСЯ С ДРУЗЬЯМИ» В ВЕРСИИ ВК
    window.addEventListener('load', () => {
        if (PlatformSDK.type !== 'vk') return;

        // Кнопка «👥 Друзьям (+$150)» в верхней панели
        const topLeft = document.querySelector('.top-bar .btn-group') || document.querySelector('.top-bar');
        if (topLeft && !document.getElementById('vk-share-top-btn')) {
            topLeft.insertAdjacentHTML('beforeend',
                '<button class="icon-btn" id="vk-share-top-btn" onclick="shareGameWithFriends(true)" title="Поделиться с друзьями" style="border-color:#38bdf8;">👥</button>'
            );
        }

        // Добавляем кнопку «👥 Поделиться рекордом» в окно победы (#win-modal) или проигрыша (#gameover-modal)
        const targetModal = document.getElementById('win-modal') || document.getElementById('gameover-modal');
        if (targetModal && !document.getElementById('vk-share-modal-btn')) {
            const shareBtn = document.createElement('button');
            shareBtn.id = 'vk-share-modal-btn';
            shareBtn.className = 'action-btn modal-btn';
            shareBtn.style.cssText = 'background:linear-gradient(135deg,#2563eb,#7c3aed);margin-top:4px;';
            shareBtn.innerHTML = '👥 Поделиться с друзьями (+$150)';
            shareBtn.onclick = () => shareGameWithFriends(true);

            // Вставляем перед кнопкой «Дальше / Заново»
            const lastBtn = targetModal.querySelector('button:last-of-type');
            if (lastBtn) targetModal.insertBefore(shareBtn, lastBtn);
            else targetModal.appendChild(shareBtn);
        }
    });
})();

// Функция вызова окна репоста / приглашения друзей ВКонтакте с наградой 1 раз в день
function shareGameWithFriends(withBonus) {
    if (typeof vkBridge === 'undefined' || PlatformSDK.type !== 'vk') return;

    vkBridge.send('VKWebAppShare', { link: location.origin + location.pathname })
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