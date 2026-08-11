// Module 2: Tri-Party Dispatch Logic & Payment Collections Tracker

let currentDispatches = [];

// Shared helper: render QC-approved docs block for dispatch records
function buildQCApprovedDocsHtml(d, compact = false) {
    let html = "";

    // QC Approved docs from Project Engineer packages
    if (d.qc_approved_docs && d.qc_approved_docs.length > 0) {
        const docs = d.qc_approved_docs.map(pkg => {
            let filesLinks = "";
            if (pkg.files && pkg.files.length > 0) {
                filesLinks = pkg.files.map(f => `
                    <a href="${f.document_path || '#'}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; color: #047857; text-decoration: underline; margin-right: 8px;">
                        <span class="badge" style="background:#EDE9FE; color:#5B21B6; border:1px solid #DDD6FE; font-size:0.68rem; padding:1px 5px;">${f.category || 'Doc'}</span>
                        ${f.file_name || 'File'}
                    </a>
                `).join("");
            }
            let qcFields = "";
            if (pkg.custom_qc_fields && typeof pkg.custom_qc_fields === 'object' && Object.keys(pkg.custom_qc_fields).length > 0) {
                qcFields = Object.entries(pkg.custom_qc_fields).map(([k, v]) => `<span style="font-size:0.72rem; color:#166534;">• <strong>${k}:</strong> ${v}</span>`).join(compact ? ' &nbsp; ' : '<br>');
            }
            return `
                <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:${compact ? '6px 10px' : '10px 14px'}; margin-bottom:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:#047857; font-size:${compact ? '0.78rem' : '0.85rem'};">📐 ${pkg.package_name || 'Engineering Package'}</strong>
                        <span class="badge badge-verified" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0; font-size:0.65rem;">✅ QC Approved</span>
                    </div>
                    ${!compact ? `<div style="font-size:0.78rem; color:#334155; margin-bottom:4px;"><strong>Project:</strong> ${pkg.project_ref || 'N/A'} &nbsp; <strong>PO:</strong> ${pkg.po_number || 'N/A'} &nbsp; <strong>Vendor:</strong> ${pkg.vendor_name || 'N/A'}</div>` : ''}
                    ${filesLinks ? `<div style="margin-bottom:4px;">${filesLinks}</div>` : ''}
                    ${qcFields ? `<div style="padding:3px 0;">${qcFields}</div>` : ''}
                </div>
            `;
        }).join('');
        html += docs;
    }

    // Additional files uploaded during dispatch
    if (d.additional_files && d.additional_files.length > 0) {
        const addlHtml = d.additional_files.map(f => `
            <a href="${f.document_path || '#'}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem; color:#B45309; text-decoration:underline; margin-right:8px;">
                📎 ${f.file_name || 'Additional File'}
            </a>
        `).join('');
        html += `<div style="margin-top:4px;">${addlHtml}</div>`;
    }

    return html;
}

async function fetchDispatches() {
    try {
        const res = await fetch('/api/dispatch');
        currentDispatches = await res.json();
        renderDispatchTable(currentDispatches);
        renderDispatchCollectionCalendar('ALL');
        renderQCDispatchView(currentDispatches.filter(d => d.status === 'Pending QC'));
        renderFinalClearanceView(currentDispatches.filter(d => d.status === 'QC Approved'));
    } catch (err) {
        console.error("Error fetching dispatches:", err);
    }
}

function switchWizardStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.wizard-pane').forEach(p => p.style.display = 'none');

    const btn = document.getElementById(`step-btn-${stepNum}`);
    const pane = document.getElementById(`wizard-step-${stepNum}`);
    if (btn) btn.classList.add('active');
    if (pane) pane.style.display = 'block';
}

function renderDispatchTable(records) {
    const tbody = document.getElementById('dispatch-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No dispatch records active.</td></tr>`;
        return;
    }

    records.forEach(d => {
        const amt = d.invoice_amount ? parseFloat(d.invoice_amount) : 50000.0;
        const colStatus = d.collection_status || 'Pending Collection';
        const poDisplay = d.po_number ? `<span class="badge" style="background:#DBEAFE; color:#1E40AF;">PO: ${d.po_number}</span>` : '';
        const qcDocsHtml = buildQCApprovedDocsHtml(d, true);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${d.dispatch_number}</strong>
                ${poDisplay ? `<br>${poDisplay}` : ''}
            </td>
            <td>${d.client_name}<br><small style="color:var(--text-muted);">${d.client_phone}</small></td>
            <td>${d.driver_name}<br><small style="color:var(--text-muted);">${d.driver_phone}</small></td>
            <td><strong>₹${amt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td>
                ${getCollectionStatusBadge(colStatus, d)}
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">Due: ${d.collection_due_date || 'N/A'}</div>
            </td>
            <td>
                ${getDispatchStatusBadge(d.status)}
                ${qcDocsHtml ? `<div style="margin-top:6px;">${qcDocsHtml}</div>` : ''}
            </td>
            <td>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                    ${colStatus !== 'Collected' ? `<button class="btn btn-success btn-sm" onclick="markDispatchCollected('${d.id}')">💰 Mark Collected</button>` : ''}
                    ${d.status === 'Draft' ? `<button class="btn btn-outline btn-sm" onclick="submitDispatchQC('${d.id}')">Submit QC</button>` : ''}
                    ${d.status === 'OK for Dispatch' ? `<button class="btn btn-primary btn-sm" onclick="completeDispatch('${d.id}')">Mark Completed</button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getDispatchStatusBadge(status) {
    switch (status) {
        case 'Draft': return `<span class="badge badge-draft">Draft</span>`;
        case 'Pending QC': return `<span class="badge badge-pending">Pending QC</span>`;
        case 'OK for Dispatch': return `<span class="badge badge-verified">En Route (Approved)</span>`;
        case 'Completed': return `<span class="badge badge-paid">Completed</span>`;
        default: return `<span class="badge">${status}</span>`;
    }
}

function getCollectionStatusBadge(colStatus, record = null) {
    if (colStatus === 'Partially Paid') {
        const coll = record ? (record.collected_amount || 0) : 0;
        const bal = record ? (record.remaining_collection_balance || 0) : 0;
        const info = (coll > 0 || bal > 0) ? ` (Coll ₹${coll.toLocaleString('en-IN')} / Bal ₹${bal.toLocaleString('en-IN')})` : '';
        return `<span class="badge" style="background:#FFF7ED; color:#C2410C; border:1px solid #FDBA74; font-weight:600;">⌛ Partially Paid${info}</span>`;
    }
    switch (colStatus) {
        case 'Collected': return `<span class="badge badge-paid">Fully Collected</span>`;
        case 'Overdue': return `<span class="badge badge-overdue">Overdue Collection</span>`;
        default: return `<span class="badge badge-pending">Pending Collection</span>`;
    }
}

// ----------------------------------------------------
// DISPATCH PAYMENT COLLECTIONS RECEIVABLE CALENDAR
// ----------------------------------------------------

function renderDispatchCollectionCalendar(filter = 'ALL') {
    const container = document.getElementById('collections-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    const filtered = currentDispatches.filter(d => {
        const isCollected = (d.collection_status === 'Collected');
        if (isCollected) return filter === 'ALL' || filter === 'COLLECTED';
        if (d.collection_status === 'Partially Paid') return filter === 'ALL' || filter === 'UPCOMING' || filter === 'COLLECTED';

        const dueStr = d.collection_due_date || d.created_at;
        const dueDt = dueStr ? new Date(dueStr) : today;
        const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return filter === 'ALL' || filter === 'OVERDUE';
        if (diffDays >= 0 && diffDays <= 7) return filter === 'ALL' || filter === 'UPCOMING';
        return filter === 'ALL';
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No client payment collections found for this filter.</p>`;
        return;
    }

    filtered.forEach(d => {
        const isCollected = (d.collection_status === 'Collected');
        const dueStr = d.collection_due_date || d.created_at;
        const dueDt = dueStr ? new Date(dueStr) : today;
        const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));
        const amt = d.invoice_amount ? parseFloat(d.invoice_amount) : 50000.0;

        let borderLeft = "4px solid var(--border-color)";
        let statusText = d.collection_status || "Pending Collection";

        if (isCollected) {
            borderLeft = "4px solid var(--success)";
            statusText = "Collected in full";
        } else if (d.collection_status === 'Partially Paid') {
            borderLeft = "4px solid #F97316";
            statusText = `Partially Paid (Bal: ₹${(d.remaining_collection_balance || 0).toLocaleString('en-IN')})`;
        } else if (diffDays < 0) {
            borderLeft = "4px solid var(--danger)";
            statusText = `Overdue by ${Math.abs(diffDays)} days`;
        } else if (diffDays <= 7) {
            borderLeft = "4px solid var(--warning)";
            statusText = `Collection due in ${diffDays} days`;
        }

        const div = document.createElement('div');
        div.className = 'card';
        div.style.marginBottom = '0';
        div.style.borderLeft = borderLeft;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                <strong style="font-size: 1.05rem; color: var(--semco-blue);">${d.dispatch_number}</strong>
                ${getCollectionStatusBadge(d.collection_status, d)}
            </div>
            <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 6px;">Client: <strong>${d.client_name}</strong></div>
            <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px;">Collection Due: <strong>${d.collection_due_date || 'N/A'}</strong> (${statusText})</div>
            <div style="font-size: 1.15rem; font-weight: 700; color: var(--semco-green); margin-bottom: 12px;">₹${amt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            ${!isCollected ? `<button class="btn btn-success btn-sm" onclick="markDispatchCollected('${d.id}')">💰 Record Collection</button>` : '<span style="color:var(--semco-green); font-size:0.85rem; font-weight:600;">✓ Payment Received</span>'}
        `;
        container.appendChild(div);
    });
}

window.markDispatchCollected = function(dispatchId) {
    const record = currentDispatches.find(d => d.id === dispatchId);
    if (!record) return;

    window.openPaymentModal({
        id: dispatchId,
        targetType: "DISPATCH",
        refText: `Dispatch Bundle #${record.dispatch_number || 'N/A'} (${record.client_name || 'Client'})`,
        totalAmount: record.invoice_amount || 50000.0,
        alreadyPaid: record.collected_amount || 0.0
    });
};

// -------------------------------------------------------
// QC APPROVED DOCUMENTS AUTO-POPULATION (from Module 3)
// -------------------------------------------------------

window.loadQCApprovedDocsForDispatch = async function() {
    const container = document.getElementById("dispatch-qc-approved-docs-container");
    const hiddenInput = document.getElementById("dispatch-qc-package-ids");
    if (!container) return;

    try {
        const res = await fetch("/api/project-engineer");
        if (!res.ok) return;
        const packages = await res.json();
        const approved = packages.filter(p => p.status === 'QC Approved');

        if (approved.length === 0) {
            container.innerHTML = `<span style="color: #64748B; font-size: 0.82rem; font-style: italic;">No QC-approved packages available. Submit packages via Project Engineer Desk → QC Gate first.</span>`;
            if (hiddenInput) hiddenInput.value = "[]";
            return;
        }

        // Store all approved package IDs
        if (hiddenInput) hiddenInput.value = JSON.stringify(approved.map(p => p.id));

        container.innerHTML = "";
        approved.forEach(pkg => {
            const pkgDiv = document.createElement("div");
            pkgDiv.style.cssText = "background: #FFFFFF; border: 1px solid #BBF7D0; border-radius: 10px; padding: 12px; margin-bottom: 8px;";

            // Files list
            let filesHtml = "";
            if (pkg.files && pkg.files.length > 0) {
                filesHtml = pkg.files.map(f => `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                        <span class="badge" style="background: #EDE9FE; color: #5B21B6; border: 1px solid #DDD6FE; font-size: 0.72rem;">${f.category || 'General'}</span>
                        <a href="${f.document_path || '#'}" target="_blank" style="font-size: 0.8rem; color: #047857; text-decoration: underline;">${f.file_name || 'File'}</a>
                    </div>
                `).join("");
            } else {
                filesHtml = `<span style="color: #64748B; font-size: 0.78rem;">No files in this package.</span>`;
            }

            // Custom QC fields
            let qcFieldsHtml = "";
            if (pkg.custom_qc_fields && typeof pkg.custom_qc_fields === "object" && Object.keys(pkg.custom_qc_fields).length > 0) {
                qcFieldsHtml = `
                    <div style="margin-top: 8px; padding: 6px 10px; background: #F0FDF4; border: 1px solid #A7F3D0; border-radius: 6px; font-size: 0.75rem; color: #166534;">
                        <strong style="display:block; margin-bottom:2px;">🛡️ QC Certificates & Details:</strong>
                        ${Object.entries(pkg.custom_qc_fields).map(([k, v]) => `<div>• <strong>${k}:</strong> ${v}</div>`).join('')}
                    </div>
                `;
            }

            pkgDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #047857; font-size: 0.88rem;">📐 ${pkg.package_name || 'Engineering Package'}</strong>
                    <span class="badge badge-verified" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0; font-size: 0.7rem;">✅ QC Approved</span>
                </div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.8rem; color: #334155; margin-bottom: 6px;">
                    <span><strong>Project:</strong> ${pkg.project_ref || 'N/A'}</span>
                    <span><strong>PO:</strong> ${pkg.po_number || 'N/A'}</span>
                    <span><strong>Vendor:</strong> ${pkg.vendor_name || 'N/A'}</span>
                </div>
                ${filesHtml}
                ${qcFieldsHtml}
            `;
            container.appendChild(pkgDiv);
        });
    } catch (err) {
        console.error("Error loading QC approved docs:", err);
        container.innerHTML = `<span style="color: #DC2626; font-size: 0.82rem;">Error loading QC documents.</span>`;
    }
};

// -------------------------------------------------------
// ADDITIONAL FILE UPLOAD ROWS (dynamic)
// -------------------------------------------------------

window.addDispatchAdditionalFileRow = function() {
    const container = document.getElementById("dispatch-additional-files-container");
    if (!container) return;

    const rowId = `add-file-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const row = document.createElement("div");
    row.id = rowId;
    row.style.cssText = "display: flex; gap: 8px; align-items: center;";

    row.innerHTML = `
        <input type="text" class="form-control dispatch-add-file-label" placeholder="Document Label (e.g. Revised Drawing, Site Photo)" style="flex: 1; font-size: 0.82rem;">
        <input type="file" class="form-control dispatch-add-file-input" accept="image/*,.pdf,.doc,.docx,.xlsx" style="flex: 1.5; font-size: 0.82rem;" name="additional_files">
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('${rowId}').remove()" style="border-color: #EF4444; color: #EF4444; padding: 2px 8px; font-size: 0.75rem;">✖</button>
    `;

    container.appendChild(row);
};

// Form Submission
document.addEventListener("DOMContentLoaded", () => {
    const dispForm = document.getElementById("dispatch-form");
    if (dispForm) {
        // Set default collection due date to +15 days from today
        const dueDateInput = dispForm.querySelector("input[name='collection_due_date']");
        if (dueDateInput && !dueDateInput.value) {
            const next15 = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
            dueDateInput.value = next15;
        }

        // Auto-populate QC approved documents
        if (typeof loadQCApprovedDocsForDispatch === 'function') loadQCApprovedDocsForDispatch();

        dispForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const confirmed = await window.showConfirmModal({
                icon: "🚚",
                title: "Create & Submit Dispatch Bundle",
                message: "Are you sure you want to create and submit this Tri-Party Dispatch Bundle for QC Gate Inspection?",
                proceedText: "🚀 Submit Bundle to QC",
                proceedClass: "btn-primary"
            });
            if (!confirmed) return;

            const formData = new FormData(dispForm);

            try {
                const res = await fetch("/api/dispatch", {
                    method: "POST",
                    body: formData
                });
                const created = await res.json();
                
                // Submit to QC automatically
                await fetch(`/api/dispatch/${created.id}/submit-qc`, { method: "POST" });
                dispForm.reset();
                const supName = document.getElementById("dispatch-supplier-name");
                if (supName) supName.value = "SEMCO Dispatch Team";
                switchWizardStep(1);

                created.status = "Pending QC";
                currentDispatches = [created, ...currentDispatches.filter(d => d.id !== created.id)];
                renderDispatchTable(currentDispatches);
                renderDispatchCollectionCalendar('ALL');
                renderQCDispatchView(currentDispatches.filter(d => d.status === 'Pending QC'));

                await window.showAlertModal({ icon: "🎉", title: "Dispatch Bundle Created", message: `Tri-Party Dispatch bundle #${created.dispatch_number} created & sent to QC Admin for approval!` });
                fetchDispatches();
                fetchNotifications();
            } catch (err) {
                window.showAlertModal({ icon: "❌", title: "Creation Error", message: err.message });
            }
        });
    }
});

async function submitDispatchQC(dispatchId) {
    const confirmed = await window.showConfirmModal({
        icon: "🛡️",
        title: "Submit to QC Gate",
        message: "Are you sure you want to submit this Tri-Party Dispatch Bundle for QC Gate Inspection?",
        proceedText: "🚀 Submit for QC",
        proceedClass: "btn-primary"
    });
    if (!confirmed) return;

    try {
        await fetch(`/api/dispatch/${dispatchId}/submit-qc`, { method: "POST" });
        window.showAlertModal({ icon: "🛡️", title: "Submitted to QC Gate", message: "Dispatch bundle submitted to QC Gate successfully!" });
        fetchDispatches();
        fetchNotifications();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Submission Error", message: err.message });
    }
}

async function approveDispatchQC(dispatchId) {
    if (window.approveDispatchQC) {
        return window.approveDispatchQC(dispatchId);
    }
}

async function completeDispatch(dispatchId) {
    const confirmed = await window.showConfirmModal({
        icon: "✅",
        title: "Complete Dispatch Cycle",
        message: "Are you sure you want to mark this active dispatch lifecycle as Completed?",
        proceedText: "✅ Mark Completed",
        proceedClass: "btn-primary"
    });
    if (!confirmed) return;

    try {
        await fetch(`/api/dispatch/${dispatchId}/complete`, { method: "POST" });
        window.showAlertModal({ icon: "✅", title: "Dispatch Completed", message: "Dispatch cycle marked as Completed successfully!" });
        fetchDispatches();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
}

function renderFinalClearanceView(approvedDispatches) {
    const container = document.getElementById('dispatch-final-clearance-container');
    if (!container) return;
    container.innerHTML = '';

    if (!approvedDispatches || approvedDispatches.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); padding: 10px 0;">No dispatches currently waiting for final clearance.</p>`;
        return;
    }

    approvedDispatches.forEach(d => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.background = '#F8FAFC';
        div.style.borderLeft = '4px solid var(--success)';
        div.style.marginBottom = '16px';
        const qcDocsBlock = buildQCApprovedDocsHtml(d, false);
        div.innerHTML = `
            <div style="margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color: var(--semco-blue); font-size: 1.1rem;">Dispatch Bundle #${d.dispatch_number}</h3>
                <span class="badge badge-verified">🛡️ QC Approved</span>
            </div>

            <div class="form-row" style="margin-bottom: 14px;">
                <div>
                    <strong style="color: var(--semco-blue); font-size: 0.85rem;">Client:</strong>
                    <div style="font-size: 0.85rem;">${d.client_name} (${d.client_phone})</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${d.client_email}</div>
                </div>
                <div>
                    <strong style="color: var(--semco-blue); font-size: 0.85rem;">Transporter & Driver:</strong>
                    <div style="font-size: 0.85rem;">${d.transporter_name || 'N/A'} - ${d.driver_name} (${d.driver_phone})</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Vehicle: ${d.vehicle_number}</div>
                </div>
                <div>
                    <strong style="color: var(--semco-blue); font-size: 0.85rem;">Valuation & Location:</strong>
                    <div style="font-size: 0.85rem;">₹${(d.invoice_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${d.delivery_location}</div>
                </div>
            </div>

            ${qcDocsBlock ? `
            <div style="margin-bottom: 16px;">
                <strong style="font-size: 0.9rem; color: #166534;">🛡️ QC Approved Documents & Certificates:</strong>
                <div style="margin-top: 8px;">${qcDocsBlock}</div>
            </div>
            ` : ''}

            <div style="display:flex; justify-content:flex-end; gap: 10px;">
                <button class="btn btn-primary" onclick="initiateFinalDispatch('${d.id}')">
                    🚚 Grant Final Clearance & Release Vehicle (Trigger Client Email & SMS)
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.initiateFinalDispatch = async function(dispatchId) {
    const confirmed = await window.showConfirmModal({
        icon: "🚚",
        title: "Initiate Final Dispatch & Release Vehicle",
        message: "Are you sure you want to grant final clearance and initiate dispatch? This will release the vehicle and trigger automated Client Email & Driver SMS.",
        proceedText: "🚚 Release & Dispatch",
        proceedClass: "btn-primary"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/dispatch/${dispatchId}/initiate-final-dispatch`, { method: "POST" });
        const cleared = await res.json();
        await window.showAlertModal({
            icon: "🎉",
            title: "Vehicle Released & Dispatched!",
            message: `Final clearance granted for Dispatch Bundle #${cleared.dispatch_number}!\n\nAutomated Workflows Triggered:\n1. Email sent to Client (${cleared.client_email})\n2. SMS sent to Driver (${cleared.driver_phone}) with Google Maps location link.`
        });
        fetchDispatches();
        fetchNotifications();
    } catch (err) {
        window.showAlertModal({
            icon: "❌",
            title: "Clearance Error",
            message: err.message
        });
    }
};
