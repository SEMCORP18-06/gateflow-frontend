// GateFlow Frontend Configuration & Dynamic API Resolution Engine
(function() {
    const CLOUD_BACKEND = "https://gateflow-backend.vercel.app";

    window.getBackendUrl = function() {
        const customUrl = localStorage.getItem("gateflow_backend_url");
        if (customUrl) return customUrl.replace(/\/$/, "");

        if (window.GATEFLOW_BACKEND_URL) return window.GATEFLOW_BACKEND_URL.replace(/\/$/, "");

        // Default to localhost if testing on local dev port, otherwise Vercel production backend
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (window.location.port === '5000' || window.location.port === '') {
                return ""; // Same origin
            }
            return "http://localhost:5000";
        }

        return CLOUD_BACKEND;
    };

    window.formatFileUrl = function(path) {
        if (!path || path === '#') return '#';
        if (typeof path !== 'string') return '#';
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
            return path;
        }
        const backend = window.getBackendUrl ? window.getBackendUrl() : '';
        if (path.startsWith('/')) {
            return backend + path;
        }
        return backend + '/' + path;
    };

    // Override fetch wrapper to automatically prepend backend URL to /api/ requests with failover
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init) {
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
            const primaryBackend = window.getBackendUrl();
            const targetUrl = (primaryBackend ? primaryBackend : "") + resource;
            
            try {
                const response = await originalFetch.call(this, targetUrl, init);
                return response;
            } catch (err) {
                // If primary local server is down, automatically fail over to live cloud backend
                if (primaryBackend && primaryBackend !== CLOUD_BACKEND) {
                    console.warn(`[GateFlow] Primary backend (${primaryBackend}) unavailable, retrying on cloud backend (${CLOUD_BACKEND})...`);
                    try {
                        return await originalFetch.call(this, CLOUD_BACKEND + resource, init);
                    } catch (cloudErr) {
                        console.error("[GateFlow] Cloud backend also unavailable:", cloudErr);
                        throw cloudErr;
                    }
                }
                throw err;
            }
        }
        return originalFetch.call(this, resource, init);
    };

    // Global file input helpers
    window.handleGenericFileInputChange = function(input, discardBtnId) {
        const btn = typeof discardBtnId === 'string' ? document.getElementById(discardBtnId) : discardBtnId;
        if (btn) {
            if (input.files && input.files[0]) {
                btn.style.display = "inline-flex";
            } else {
                btn.style.display = "none";
            }
        }
    };

    window.clearSpecificFileInput = function(input, discardBtn) {
        if (input) {
            input.value = "";
        }
        if (discardBtn) {
            discardBtn.style.display = "none";
        }
    };
})();
