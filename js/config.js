// GateFlow Frontend Configuration & Dynamic API Resolution Engine
(function() {
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

        return "https://gateflow-backend.vercel.app";
    };

    // Override fetch wrapper to automatically prepend backend URL to /api/ requests
    const originalFetch = window.fetch;
    window.fetch = function(resource, init) {
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
            const backend = window.getBackendUrl();
            if (backend) {
                resource = backend + resource;
            }
        }
        return originalFetch.call(this, resource, init);
    };
})();
