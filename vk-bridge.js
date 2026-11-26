window.vkBridge = (function() {
    var reqId = 1;
    var pending = {};

    window.addEventListener('message', function(event) {
        var data = event.data;
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
    });

    return {
        send: function(method, params) {
            return new Promise(function(resolve, reject) {
                if (!window.parent || window.parent === window) {
                    return reject({ error_type: 'client_error', error_reason: 'Not in iframe' });
                }
                var id = 'req_' + (reqId++);
                var reqParams = Object.assign({}, params || {}, { request_id: id });
                pending[id] = { resolve: resolve, reject: reject };

                window.parent.postMessage({
                    handler: method,
                    params: reqParams,
                    type: 'vk-connect'
                }, '*');

                setTimeout(function() {
                    if (pending[id]) {
                        delete pending[id];
                        reject({ error_type: 'timeout' });
                    }
                }, 8000);
            });
        }
    };
})();
