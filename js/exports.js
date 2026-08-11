// Data Exporters helper

function exportData(module, format) {
    let url = "";
    if (module === 'receiving') {
        url = `/api/receiving/export?format=${format}`;
    } else if (module === 'approved_qc') {
        url = `/api/receiving/export?status=Verified&format=${format}`;
    } else if (module === 'dispatch') {
        url = `/api/dispatch/export?format=${format}`;
    }

    if (url) {
        window.open(url, '_blank');
    }
}
