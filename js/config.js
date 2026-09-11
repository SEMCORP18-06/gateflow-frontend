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
        if (!path || path === '#' || typeof path !== 'string') return '#';
        path = path.trim();
        if (!path || path === '#') return '#';

        // Normalize Windows backslashes
        path = path.replace(/\\/g, '/');

        if (path.startsWith('data:')) {
            return path;
        }

        let fullUrl = '';
        if (path.startsWith('http://') || path.startsWith('https://')) {
            fullUrl = path;
        } else {
            const backend = window.getBackendUrl ? window.getBackendUrl() : '';
            if (path.startsWith('/')) {
                fullUrl = (backend ? backend : '') + path;
            } else {
                fullUrl = (backend ? backend : '') + '/' + path;
            }
        }

        // Safely encode URI to handle spaces and special chars without breaking protocol/slashes
        try {
            return encodeURI(decodeURI(fullUrl));
        } catch (e) {
            return encodeURI(fullUrl);
        }
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

    // ----------------------------------------------------
    // UNIVERSAL FILE UPLOAD PREVIEW & DISCARD ENGINE
    // ----------------------------------------------------
    let currentUniversalBlobUrl = null;

    window.openUniversalFilePreview = function(fileOrUrl, title = 'Attached File') {
        const modal = document.getElementById('universal-file-preview-modal');
        if (!modal) return;

        const iconEl = document.getElementById('univ-file-icon');
        const titleEl = document.getElementById('univ-file-title');
        const subtitleEl = document.getElementById('univ-file-subtitle');
        const tabBtn = document.getElementById('univ-file-tab-btn');
        const downloadBtn = document.getElementById('univ-file-download-btn');
        const contentEl = document.getElementById('univ-file-viewer-content');

        if (currentUniversalBlobUrl) {
            try { URL.revokeObjectURL(currentUniversalBlobUrl); } catch(e) {}
            currentUniversalBlobUrl = null;
        }

        if (!fileOrUrl) {
            if (contentEl) {
                contentEl.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 10px;">📭</div>
                        <h4>No File Attached</h4>
                        <p style="font-size: 0.85rem;">Please select or attach a file first to preview.</p>
                    </div>
                `;
            }
            modal.style.display = 'flex';
            return;
        }

        let url = '';
        let fileName = title;
        let isImage = false;
        let isPdf = false;
        let fileSizeStr = '';

        if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
            currentUniversalBlobUrl = URL.createObjectURL(fileOrUrl);
            url = currentUniversalBlobUrl;
            fileName = fileOrUrl.name || title;
            const type = fileOrUrl.type || '';
            isImage = type.startsWith('image/');
            isPdf = type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
            fileSizeStr = fileOrUrl.size ? `(${(fileOrUrl.size / (1024 * 1024)).toFixed(2)} MB)` : '';
        } else if (typeof fileOrUrl === 'string') {
            url = window.formatFileUrl ? window.formatFileUrl(fileOrUrl) : fileOrUrl;
            fileName = fileOrUrl.split('/').pop().split('\\').pop() || title;
            if (fileName.includes('_')) {
                const parts = fileName.split('_');
                if (parts.length > 2) fileName = parts.slice(2).join('_');
            }
            const lower = url.toLowerCase();
            isImage = /\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?$/i.test(lower);
            isPdf = /\.pdf(\?.*)?$/i.test(lower);
        }

        if (titleEl) titleEl.textContent = fileName || title;
        if (subtitleEl) subtitleEl.textContent = `${title} ${fileSizeStr}`.trim();
        if (iconEl) iconEl.textContent = isImage ? '🖼️' : (isPdf ? '📑' : '📎');

        if (tabBtn) {
            tabBtn.href = url;
            tabBtn.style.display = 'inline-flex';
        }
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = fileName;
            downloadBtn.style.display = 'inline-flex';
        }

        if (isImage) {
            contentEl.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: center; align-items: center; background: #0F172A; border-radius: 10px; padding: 14px; max-height: 70vh; overflow: auto;">
                    <img src="${url}" alt="${fileName}" style="max-width: 100%; max-height: 65vh; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" />
                </div>
            `;
        } else if (isPdf) {
            contentEl.innerHTML = `
                <div style="width: 100%; height: 70vh; border-radius: 10px; overflow: hidden; border: 1px solid #CBD5E1;">
                    <iframe src="${url}" style="width: 100%; height: 100%; border: none;" title="${fileName}"></iframe>
                </div>
            `;
        } else {
            contentEl.innerHTML = `
                <div style="width: 100%; text-align: center; padding: 40px 20px; background: #F8FAFC; border-radius: 10px; border: 1px dashed #CBD5E1;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">📎</div>
                    <h4 style="color: var(--semco-blue); margin-bottom: 6px;">${fileName}</h4>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 18px;">
                        Direct in-browser embedding is not supported for this file type. You can view it in a new tab or download it.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <a href="${url}" target="_blank" class="btn btn-outline">↗️ Open in New Tab</a>
                        <a href="${url}" download="${fileName}" class="btn btn-primary">⬇️ Download Document</a>
                    </div>
                </div>
            `;
        }

        modal.style.display = 'flex';
    };

    window.closeUniversalFilePreview = function() {
        const modal = document.getElementById('universal-file-preview-modal');
        if (modal) modal.style.display = 'none';
        if (currentUniversalBlobUrl) {
            try { URL.revokeObjectURL(currentUniversalBlobUrl); } catch(e) {}
            currentUniversalBlobUrl = null;
        }
    };

    window.previewUploadInputFile = function(inputId, label) {
        const input = typeof inputId === 'string' ? document.getElementById(inputId) : inputId;
        if (!input) return;
        if (input.files && input.files[0]) {
            window.openUniversalFilePreview(input.files[0], label || input.files[0].name);
        } else {
            if (window.showAlertModal) {
                window.showAlertModal({ icon: '📂', title: 'No File Selected', message: 'Please select a file first to preview.' });
            } else {
                alert('Please select a file first to preview.');
            }
        }
    };

    window.previewGenericRowFile = function(btn) {
        const container = btn.parentElement;
        const input = container.querySelector('input[type="file"]');
        if (input && input.files && input.files[0]) {
            window.openUniversalFilePreview(input.files[0], input.files[0].name);
        } else {
            if (window.showAlertModal) {
                window.showAlertModal({ icon: '📂', title: 'No File Selected', message: 'Please select a file first to preview.' });
            } else {
                alert('Please select a file first to preview.');
            }
        }
    };

    // Global file input change helper (toggles both discard and view buttons)
    window.handleGenericFileInputChange = function(input, discardBtnId, viewBtnId) {
        const discardBtn = typeof discardBtnId === 'string' ? document.getElementById(discardBtnId) : discardBtnId;
        const viewBtn = typeof viewBtnId === 'string' ? document.getElementById(viewBtnId) : viewBtnId;
        const hasFile = input.files && input.files[0];

        if (discardBtn) {
            discardBtn.style.display = hasFile ? "inline-flex" : "none";
        }
        if (viewBtn) {
            viewBtn.style.display = hasFile ? "inline-flex" : "none";
        }
    };

    window.clearSpecificFileInput = function(input, discardBtn, viewBtn) {
        if (input) {
            input.value = "";
        }
        if (discardBtn) {
            discardBtn.style.display = "none";
        }
        if (viewBtn) {
            viewBtn.style.display = "none";
        }
    };
})();
