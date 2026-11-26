window.vkBridge = (function() {
    var reqId = 1;
    var pending = {};

    function handleIncoming(data) {
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data || typeof data !== 'object') return;
        var type = data.type || '';
        var payload = data.data || data;

        if (payload && payload.request_id && pending[payload.request_id]) {
            var p = pending[payload.request_id];
            delete pending[payload.request_id];
            if (type.indexOf('Failed') !== -1 || payload.error_type) {
                p.reject(payload);
            } else {
                p.resolve(payload);
            }
        }
    }

    window.addEventListener('message', function(event) {
        handleIncoming(event.data);
    });

    // Коллбэк, в который мобильные клиенты ВК (iOS / Android) возвращают ответы
    window.vkBridgeCallback = handleIncoming;

    return {
        send: function(method, params) {
            return new Promise(function(resolve, reject) {
                var id = 'req_' + (reqId++);
                var reqParams = Object.assign({}, params || {}, { request_id: id });
                pending[id] = { resolve: resolve, reject: reject };

                var msgObj = {
                    handler: method,
                    params: reqParams,
                    type: 'vk-connect'
                };
                var msgStr = JSON.stringify(msgObj);

                var sent = false;
                // 1. Нативный мост iPhone (iOS VK App)
                try {
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.VKWebAppClose) {
                        window.webkit.messageHandlers.VKWebAppClose.postMessage(msgObj);
                        sent = true;
                    } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[method]) {
                        window.webkit.messageHandlers[method].postMessage(reqParams);
                        sent = true;
                    }
                } catch (e) {}

                // 2. Нативный мост Android (Android VK App)
                try {
                    if (window.AndroidBridge && typeof window.AndroidBridge[method] === 'function') {
                        window.AndroidBridge[method](JSON.stringify(reqParams));
                        sent = true;
                    } else if (window.AndroidBridge && typeof window.AndroidBridge.postMessage === 'function') {
                        window.AndroidBridge.postMessage(msgStr);
                        sent = true;
                    }
                } catch (e) {}

                // 3. Браузер ПК и мобильный WebView (iframe)
                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage(msgObj, '*');
                        sent = true;
                    }
                } catch (e) {}

                if (!sent) {
                    delete pending[id];
                    return reject({ error_type: 'client_error', error_reason: 'Bridge not found' });
                }

                setTimeout(function() {
                    if (pending[id]) {
                        delete pending[id];
                        reject({ error_type: 'timeout' });
                    }
                }, 6000);
            });
        }
    };
})();
