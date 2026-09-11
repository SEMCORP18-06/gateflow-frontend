// Data Exporters Helper for SEMCO GateFlow SCM

async function exportData(module, format) {
    const ext = (format === 'xlsx' ? 'xlsx' : (format === 'pdf' ? 'pdf' : 'csv'));
    let endpoint = "";
    let defaultFilename = `${module}_records.${ext}`;

    if (module === 'receiving') {
        endpoint = `/api/receiving/export?format=${format}`;
        defaultFilename = `receiving_records.${ext}`;
    } else if (module === 'approved_qc') {
        endpoint = `/api/receiving/export?status=Verified&format=${format}`;
        defaultFilename = `approved_qc_records.${ext}`;
    } else if (module === 'dispatch') {
        endpoint = `/api/dispatch/export?format=${format}`;
        defaultFilename = `dispatch_records.${ext}`;
    } else if (module === 'challans') {
        endpoint = `/api/challans/export?format=${format}`;
        defaultFilename = `delivery_challans.${ext}`;
    } else {
        console.error("Unknown export module:", module);
        alert(`Unknown export module: ${module}`);
        return;
    }

    console.log(`[Export] Requesting export for module '${module}' in format '${format}'...`);

    try {
        // Use the application's wrapped fetch which automatically handles backend URL resolution & failover
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Accept': format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                          (format === 'pdf' ? 'application/pdf' : 'text/csv')
            }
        });

        if (!response.ok) {
            let errorDetail = "";
            try {
                const errJson = await response.json();
                errorDetail = errJson.detail || errJson.message || "";
            } catch (_) {}
            throw new Error(`Server returned HTTP ${response.status} ${response.statusText}${errorDetail ? ': ' + errorDetail : ''}`);
        }

        // Try reading exact filename from Content-Disposition header
        let filename = defaultFilename;
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
            const matches = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (matches && matches[1]) {
                filename = matches[1].replace(/['"]/g, '').trim();
            }
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
            alert("No records found to export.");
            return;
        }

        // Trigger clean, pop-up-blocker-proof programmatic file download
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            if (link.parentNode) {
                document.body.removeChild(link);
            }
            window.URL.revokeObjectURL(blobUrl);
        }, 1500);

    } catch (err) {
        console.error(`[Export Error] Failed to export ${module} (${format}):`, err);
        alert(`Failed to export ${format.toUpperCase()} file: ${err.message || err}`);
    }
}

// Attach to window so all button onclick handlers can access it reliably
window.exportData = exportData;
