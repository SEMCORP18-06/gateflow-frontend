// Module 1: Receiving & Dynamic OCR Extraction Logic with Mobile Camera Access

let currentReceivingRecords = [];
let pendingOCRPath = "";
let currentExtractedFields = {};
let cameraStream = null;
let manualCustomFieldCount = 0;
let manualUploadedFilePath = "";

async function fetchReceivingRecords() {
    try {
        const res = await fetch('/api/receiving');
        currentReceivingRecords = await res.json();
        renderReceivingTable(currentReceivingRecords);
        renderCalendar('ALL');
        fetchReceivingAuditLogs();
    } catch (err) {
        console.error("Error fetching receiving records:", err);
    }
}

window.applySection2PayablesFilter = function() {
    const invQuery = (document.getElementById("sec2-filter-inv")?.value || "").trim().toLowerCase();
    const dateQuery = (document.getElementById("sec2-filter-date")?.value || "").trim();
    const poQuery = (document.getElementById("sec2-filter-po")?.value || "").trim().toLowerCase();
    const dueStatusSelect = document.getElementById("sec2-filter-due")?.value || "ALL";

    const today = new Date();
    today.setHours(0,0,0,0);

    const filtered = currentReceivingRecords.filter(r => {
        const fields = r.extracted_fields || {};

        // 1. Invoice No Filter (Optional: evaluated only if non-empty)
        if (invQuery) {
            const invNo = (r.invoice_number || fields["Invoice Number"] || "").toLowerCase();
            if (!invNo.includes(invQuery)) return false;
        }

        // 2. Date Filter (Optional: evaluated only if date selected)
        if (dateQuery) {
            const recDate = (r.invoice_date || r.inward_date || r.created_at || "").split("T")[0];
            if (recDate !== dateQuery) return false;
        }

        // 3. PO No Filter (Optional: evaluated only if non-empty)
        if (poQuery) {
            const poNo = (r.po_number || fields["PO Number"] || r.challan_number || "").toLowerCase();
            if (!poNo.includes(poQuery)) return false;
        }

        // 4. Payment Terms / Due Status Filter (Optional: evaluated only if status selected)
        if (dueStatusSelect !== 'ALL') {
            if (dueStatusSelect === 'PAID' && r.status !== 'Paid') return false;
            if (dueStatusSelect === 'PARTIAL' && r.status !== 'Partially Paid') return false;

            const dueDt = new Date(r.due_date);
            const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));

            if (dueStatusSelect === 'OVERDUE' && !(r.status !== 'Paid' && diffDays < 0)) return false;
            if (dueStatusSelect === 'DUE_7' && !(r.status !== 'Paid' && diffDays >= 0 && diffDays <= 7)) return false;
            if (dueStatusSelect === 'DUE_30' && !(r.status !== 'Paid' && diffDays >= 0 && diffDays <= 30)) return false;
        }

        return true;
    });

    renderReceivingTable(filtered);
};

window.resetSection2PayablesFilters = function() {
    const invInput = document.getElementById("sec2-filter-inv");
    const dateInput = document.getElementById("sec2-filter-date");
    const poInput = document.getElementById("sec2-filter-po");
    const dueSelect = document.getElementById("sec2-filter-due");

    if (invInput) invInput.value = "";
    if (dateInput) dateInput.value = "";
    if (poInput) poInput.value = "";
    if (dueSelect) dueSelect.value = "ALL";

    renderReceivingTable(currentReceivingRecords);
};

function renderReceivingTable(records) {
    const tbody = document.getElementById('receiving-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 20px;">🔍 No receiving records match the selected category filters.</td></tr>`;
        return;
    }

    records.forEach(r => {
        const fields = r.extracted_fields || {};
        const challanNum = r.challan_number || fields["Challan Number"] || fields["Linked Challan Number"] || "N/A";
        const invDocPath = r.document_path || "";
        const challanDocPath = r.challan_doc_path || fields["Challan Document Path"] || r.challan_doc || "";

        let docsHtml = `<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">`;
        if (challanDocPath) {
            docsHtml += `<a href="${challanDocPath}" target="_blank" class="btn btn-outline btn-sm" style="border-color: #D97706; color: #D97706; font-size: 0.75rem; font-weight: 600;">📜 Challan Doc</a>`;
        } else {
            docsHtml += `<span style="font-size: 0.75rem; color: var(--text-muted);">📜 No Challan</span>`;
        }

        if (invDocPath) {
            docsHtml += `<a href="${invDocPath}" target="_blank" class="btn btn-outline btn-sm" style="border-color: var(--semco-blue); color: var(--semco-blue); font-size: 0.75rem; font-weight: 600;">📄 Invoice Doc</a>`;
        } else {
            docsHtml += `<span style="font-size: 0.75rem; color: var(--text-muted);">📄 No Invoice</span>`;
        }
        docsHtml += `</div>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.invoice_number || 'N/A'}</strong></td>
            <td><span class="badge" style="background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;">${challanNum}</span></td>
            <td>${r.vendor_name || 'N/A'}</td>
            <td>${r.due_date || 'N/A'}</td>
            <td>₹${(r.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td>${docsHtml}</td>
            <td>${getStatusBadge(r.status, r)}</td>
            <td>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-outline btn-sm" style="border-color: var(--semco-blue); color: var(--semco-blue);" onclick="previewReceivingRecord('${r.id}')">👁️ Full Preview</button>
                    ${r.status !== 'Paid' ? `<button class="btn btn-success btn-sm" onclick="markPaid('${r.id}')">Mark Paid</button>` : ''}
                    <button class="btn btn-outline btn-sm" style="border-color: #EF4444; color: #EF4444;" onclick="deleteReceivingRecord('${r.id}')">🗑️ Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteReceivingRecord = async function(recordId) {
    const confirmed = await window.showConfirmModal({
        icon: "🗑️",
        title: "Delete Invoice Record",
        message: "Are you sure you want to permanently delete this invoice record from the repository?",
        proceedText: "🗑️ Delete Permanently",
        proceedClass: "btn-outline"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/receiving/${recordId}`, { method: "DELETE" });
        if (res.ok) {
            fetchReceivingRecords();
            fetchNotifications();
        } else {
            window.showAlertModal({ icon: "❌", title: "Deletion Failed", message: "Could not delete invoice record." });
        }
    } catch (err) {
        console.error("Delete record error:", err);
    }
};

window.markPaid = function(recordId) {
    const record = currentReceivingRecords.find(r => r.id === recordId);
    if (!record) return;

    window.openPaymentModal({
        id: recordId,
        targetType: "RECEIVING",
        refText: `Vendor Invoice #${record.invoice_number || 'N/A'} (${record.vendor_name || 'Vendor'})`,
        totalAmount: record.total_amount || 0.0,
        alreadyPaid: record.paid_amount || 0.0
    });
};

window.applyPayablesCategorizedFilters = function() {
    renderCalendar('CATEGORIZED');
};

window.resetPayablesFilters = function() {
    const invInput = document.getElementById("payables-filter-inv");
    const dateInput = document.getElementById("payables-filter-date");
    const poInput = document.getElementById("payables-filter-po");
    const dueSelect = document.getElementById("payables-filter-due");

    if (invInput) invInput.value = "";
    if (dateInput) dateInput.value = "";
    if (poInput) poInput.value = "";
    if (dueSelect) dueSelect.value = "ALL";

    renderCalendar('ALL');
};

window.setPayablesQuickStatus = function(statusStr) {
    const dueSelect = document.getElementById("payables-filter-due");
    if (dueSelect) dueSelect.value = statusStr;
    renderCalendar(statusStr);
};

// Payment Calendar Visual Renderer with 4-Attribute Filtering (All Filters Optional & Independent)
window.renderCalendar = function(filter = 'ALL') {
    const container = document.getElementById('calendar-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    // Read Filter Values from Control Inputs
    const invQuery = (document.getElementById("payables-filter-inv")?.value || "").trim().toLowerCase();
    const dateQuery = (document.getElementById("payables-filter-date")?.value || "").trim();
    const poQuery = (document.getElementById("payables-filter-po")?.value || "").trim().toLowerCase();
    const dueStatusSelect = document.getElementById("payables-filter-due")?.value || "ALL";

    const activeDueFilter = filter === 'CATEGORIZED' ? dueStatusSelect : filter;

    const filtered = currentReceivingRecords.filter(r => {
        const fields = r.extracted_fields || {};

        // 1. Invoice No Filter (Optional)
        if (invQuery) {
            const invNo = (r.invoice_number || fields["Invoice Number"] || "").toLowerCase();
            if (!invNo.includes(invQuery)) return false;
        }

        // 2. Date Filter (Optional)
        if (dateQuery) {
            const recDate = (r.invoice_date || r.inward_date || r.created_at || "").split("T")[0];
            if (recDate !== dateQuery) return false;
        }

        // 3. PO No Filter (Optional)
        if (poQuery) {
            const poNo = (r.po_number || fields["PO Number"] || r.challan_number || "").toLowerCase();
            if (!poNo.includes(poQuery)) return false;
        }

        // 4. Payment Terms or Due Date Status Filter (Optional)
        if (activeDueFilter !== 'ALL') {
            if (activeDueFilter === 'PAID' && r.status !== 'Paid') return false;
            if (activeDueFilter === 'PARTIAL' && r.status !== 'Partially Paid') return false;

            const dueDt = new Date(r.due_date);
            const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));

            if (activeDueFilter === 'OVERDUE' && !(r.status !== 'Paid' && diffDays < 0)) return false;
            if ((activeDueFilter === 'DUE_7' || activeDueFilter === 'UPCOMING') && !(r.status !== 'Paid' && diffDays >= 0 && diffDays <= 7)) return false;
            if (activeDueFilter === 'DUE_30' && !(r.status !== 'Paid' && diffDays >= 0 && diffDays <= 30)) return false;
        }

        return true;
    });

    // ... (rest of rendering logic remains unchanged)
};

function getStatusBadge(status, record = null) {
    if (status === 'Partially Paid') {
        const paid = record ? (record.paid_amount || 0) : 0;
        const bal = record ? (record.remaining_balance || 0) : 0;
        const info = (paid > 0 || bal > 0) ? ` (Paid ₹${paid.toLocaleString('en-IN')} / Bal ₹${bal.toLocaleString('en-IN')})` : '';
        return `<span class="badge" style="background:#FFF7ED; color:#C2410C; border:1px solid #FDBA74; font-weight:600;">⌛ Partially Paid${info}</span>`;
    }
    switch (status) {
        case 'Draft': return `<span class="badge badge-draft">Draft</span>`;
        case 'Pending QC': return `<span class="badge badge-pending">Pending QC</span>`;
        case 'Verified': return `<span class="badge badge-verified">Verified</span>`;
        case 'Paid': return `<span class="badge badge-paid">Fully Paid</span>`;
        case 'Overdue': return `<span class="badge badge-overdue">Overdue</span>`;
        default: return `<span class="badge">${status}</span>`;
    }
}

// ----------------------------------------------------
// MOBILE CAMERA & LIVE STREAM HANDLERS
// ----------------------------------------------------

function triggerMobileCamera() {
    const camInput = document.getElementById("ocr-camera-input");
    if (camInput) {
        camInput.click();
    }
}

window.triggerChallanMobileCamera = function() {
    const input = document.getElementById("rec-challan-camera-input");
    if (input) input.click();
};

window.handleChallanFileUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    await uploadChallanFile(input.files[0]);
};

window.handleChallanCameraUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    await uploadChallanFile(input.files[0]);
};

window.handleManualChallanFileUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/receiving/upload-file", { method: "POST", body: formData });
        const data = await res.json();
        document.getElementById("manual-challan-doc-path").value = data.document_path || "";
        document.getElementById("manual-challan-file-preview").style.display = "block";
        document.getElementById("manual-challan-file-name").textContent = `✅ ${file.name} Attached`;
    } catch (err) {
        console.error("Manual challan upload error:", err);
    }
};

async function uploadChallanFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/receiving/upload-file", { method: "POST", body: formData });
        const data = await res.json();
        document.getElementById("rec-challan-doc-path").value = data.document_path || "";
        document.getElementById("rec-challan-file-badge").style.display = "block";
        document.getElementById("rec-challan-file-name").textContent = `✅ ${file.name} Attached`;
    } catch (err) {
        console.error("Challan file upload error:", err);
    }
}

async function handleCameraUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    await processDocumentFile(file, false);
}

async function openLiveCameraModal() {
    const modal = document.getElementById("camera-modal");
    const video = document.getElementById("camera-stream-video");
    if (!modal || !video) return;

    modal.style.display = "flex";
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = cameraStream;
    } catch (err) {
        alert("Unable to access camera: " + err.message + "\nFallback to mobile camera upload button.");
    }
}

function closeLiveCameraModal() {
    const modal = document.getElementById("camera-modal");
    const video = document.getElementById("camera-stream-video");
    if (modal) modal.style.display = "none";
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (video) video.srcObject = null;
}

async function capturePhotoFromStream(autoSubmitQC = false) {
    const video = document.getElementById("camera-stream-video");
    const canvas = document.getElementById("camera-canvas");
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
        if (!blob) return;
        const cameraFile = new File([blob], `camera_snap_${Date.now()}.jpg`, { type: "image/jpeg" });
        closeLiveCameraModal();
        await processDocumentFile(cameraFile, autoSubmitQC);
    }, "image/jpeg", 0.9);
}

async function processDocumentFile(file, autoSubmitQC = false) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/receiving/ocr-upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        const fields = data.extracted_fields || {};
        
        const invNum = fields["Invoice Number"] || fields["Document Number"] || fields["Invoice #"] || fields["Bill No"] || "";
        const vendor = fields["Vendor Name"] || fields["Vendor / Sender"] || fields["Supplier"] || fields["Company"] || "";
        const invDate = fields["Invoice Date"] || fields["Document Date"] || fields["Date"] || "";
        const dueDate = fields["Due Date"] || "";
        
        const amtStr = fields["Total Amount"] || fields["Total Valuation (₹)"] || fields["Net Amount"] || fields["Payable Amount"] || "";
        const numAmt = amtStr ? (parseFloat(amtStr.replace(/[^0-9.]/g, '')) || "") : "";

        // Invoice Section Fields
        const recInvInput = document.getElementById("rec-invoice-number");
        const recVendInput = document.getElementById("rec-vendor-name");
        const recInvDateInput = document.getElementById("rec-invoice-date");
        const recDueDateInput = document.getElementById("rec-due-date");
        const recAmtInput = document.getElementById("rec-total-amount");

        if (recInvInput) recInvInput.value = invNum;
        if (recVendInput) recVendInput.value = vendor;
        if (recInvDateInput) recInvDateInput.value = invDate;
        if (recDueDateInput) recDueDateInput.value = dueDate;
        if (recAmtInput) recAmtInput.value = numAmt;

        // Delivery Challan Section Fields (Autofilled dynamically from OCR)
        const challanNum = fields["Challan Number"] || fields["Delivery Challan No"] || fields["DC No"] || "";
        const challanDate = fields["Challan Date"] || fields["DC Date"] || fields["Invoice Date"] || "";
        const transporter = fields["Transporter Name"] || fields["Transporter / Carrier Name"] || fields["Carrier"] || "";
        const vehicle = fields["Vehicle Number"] || fields["Vehicle Registration Number"] || fields["Vehicle No"] || "";
        const goods = fields["Goods Summary"] || fields["Items Summary"] || fields["Material Summary"] || fields["Goods & Material Summary (Challan)"] || "";

        const recChallanNumInput = document.getElementById("rec-challan-number");
        const recChallanDateInput = document.getElementById("rec-challan-date");
        const recChallanTransporterInput = document.getElementById("rec-challan-transporter");
        const recChallanVehicleInput = document.getElementById("rec-challan-vehicle");
        const recChallanGoodsInput = document.getElementById("rec-challan-goods");

        if (recChallanNumInput) recChallanNumInput.value = challanNum;
        if (recChallanDateInput) recChallanDateInput.value = challanDate;
        if (recChallanTransporterInput) recChallanTransporterInput.value = transporter;
        if (recChallanVehicleInput) recChallanVehicleInput.value = vehicle;
        if (recChallanGoodsInput) recChallanGoodsInput.value = goods;

        document.getElementById("rec-document-path").value = data.document_path || "";
        pendingOCRPath = data.document_path || "";

        renderDynamicFields(fields);

        const resultsCard = document.getElementById("ocr-results-card");
        if (resultsCard) {
            resultsCard.style.setProperty("display", "block", "important");
            resultsCard.scrollIntoView({ behavior: "smooth" });
        }

        if (autoSubmitQC) {
            await submitCurrentReceivingQC();
        }
    } catch (err) {
        window.showAlertModal({ icon: "⚠️", title: "OCR Extraction Warning", message: "Document scanning encountered an issue: " + err.message });
    }
}

// Render dynamic fields container categorized by invoice components
function renderDynamicFields(fields) {
    const container = document.getElementById("dynamic-fields-container");
    if (!container) return;
    container.innerHTML = "";
    currentExtractedFields = fields || {};

    if (Object.keys(currentExtractedFields).length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No additional components detected.</p>`;
        return;
    }

    // Component Category Groups
    const categories = [
        {
            title: "🏢 Order Received By (Receiver / Billed To)",
            badgeClass: "badge-verified",
            keys: ["Order Received By (Receiver / Billed To)", "Receiver GSTIN", "Receiver Address"]
        },
        {
            title: "🏭 Vendor / Supplier Details (Issued By)",
            badgeClass: "badge-draft",
            keys: ["Vendor Name", "Vendor GSTIN", "Vendor Address", "Vendor Phone", "Vendor Email", "Vendor MSME No"]
        },
        {
            title: "📄 Invoice & Transport References",
            badgeClass: "badge-pending",
            keys: ["Invoice Number", "Invoice Date", "Due Date", "Challan Number", "PO Number"]
        },
        {
            title: "💰 Financial & Tax Summary",
            badgeClass: "badge-paid",
            keys: ["Total Amount", "Subtotal (Before Tax)", "CGST Amount", "SGST Amount", "Total Tax Amount"]
        },
        {
            title: "🏦 Bank & Payment Details",
            badgeClass: "badge-draft",
            keys: ["Bank Account Name", "Bank Account No", "Bank IFSC Code", "Bank Name", "Bank Branch"]
        }
    ];

    const handledKeys = new Set();

    categories.forEach(cat => {
        const catFields = [];
        cat.keys.forEach(k => {
            if (currentExtractedFields[k] !== undefined && currentExtractedFields[k] !== "N/A") {
                catFields.push([k, currentExtractedFields[k]]);
                handledKeys.add(k);
            }
        });

        if (catFields.length > 0) {
            const sectionDiv = document.createElement("div");
            sectionDiv.style.gridColumn = "1 / -1";
            sectionDiv.style.background = "#F8FAFC";
            sectionDiv.style.padding = "14px";
            sectionDiv.style.borderRadius = "12px";
            sectionDiv.style.border = "1px solid var(--border-color)";
            sectionDiv.style.marginBottom = "10px";

            let fieldsHtml = "";
            catFields.forEach(([k, v]) => {
                fieldsHtml += `
                    <div style="margin-bottom: 8px;">
                        <label class="form-label" style="font-weight: 700; color: var(--semco-blue); font-size: 0.78rem;">${k}</label>
                        <input type="text" class="form-control dynamic-field-input" data-key="${k}" value="${String(v).replace(/"/g, '&quot;')}" style="font-size: 0.85rem;">
                    </div>
                `;
            });

            sectionDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: var(--semco-blue); font-size: 0.9rem;">${cat.title}</strong>
                    <span class="badge ${cat.badgeClass}">${catFields.length} Fields</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
                    ${fieldsHtml}
                </div>
            `;
            container.appendChild(sectionDiv);
        }
    });

    // Render any remaining additional fields or full text
    const remainingFields = Object.entries(currentExtractedFields).filter(([k]) => !handledKeys.has(k));
    if (remainingFields.length > 0) {
        const otherDiv = document.createElement("div");
        otherDiv.style.gridColumn = "1 / -1";
        otherDiv.style.background = "#FFFFFF";
        otherDiv.style.padding = "14px";
        otherDiv.style.borderRadius = "12px";
        otherDiv.style.border = "1px solid var(--border-color)";

        let otherHtml = "";
        remainingFields.forEach(([k, v]) => {
            const valStr = String(v || "");
            if (valStr.includes("\n") || valStr.length > 70) {
                otherHtml += `
                    <div style="margin-bottom: 10px;">
                        <label class="form-label" style="font-weight: 700; color: var(--semco-blue);">${k}</label>
                        <textarea class="form-control dynamic-field-input" data-key="${k}" rows="5" style="font-family: monospace; font-size: 0.82rem;">${valStr}</textarea>
                    </div>
                `;
            } else {
                otherHtml += `
                    <div style="margin-bottom: 8px;">
                        <label class="form-label">${k}</label>
                        <input type="text" class="form-control dynamic-field-input" data-key="${k}" value="${valStr.replace(/"/g, '&quot;')}">
                    </div>
                `;
            }
        });

        otherDiv.innerHTML = `
            <strong style="color: var(--semco-blue); font-size: 0.9rem; display: block; margin-bottom: 10px;">📝 Full Scanned Invoice Text & Raw Line Items</strong>
            ${otherHtml}
        `;
        container.appendChild(otherDiv);
    }
}

function gatherDynamicFieldsFromUI() {
    const fields = {};
    document.querySelectorAll(".dynamic-field-input").forEach(input => {
        const key = input.getAttribute("data-key");
        if (key) {
            fields[key] = input.value;
        }
    });
    return fields;
}

// OCR Upload Form Submit Listener
document.addEventListener("DOMContentLoaded", () => {
    const ocrForm = document.getElementById("ocr-upload-form");
    if (ocrForm) {
        ocrForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("btn-ocr-scan");
            btn.innerHTML = "⏳ Extracting All Document Headings...";
            btn.disabled = true;

            const fileInput = document.getElementById("ocr-file-input");
            if (fileInput && fileInput.files[0]) {
                await processDocumentFile(fileInput.files[0], false);
            } else {
                window.showAlertModal({ icon: "📂", title: "No File Selected", message: "Please select an invoice file or snap a photo with your mobile camera." });
            }
            btn.innerHTML = "🔍 Scan Selected File & Extract Metadata";
            btn.disabled = false;
        });
    }

    // Save Receiving Form Listener
    const recSaveForm = document.getElementById("receiving-save-form");
    if (recSaveForm) {
        recSaveForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const invNum = document.getElementById("rec-invoice-number").value || "Invoice";
            const confirmed = await window.showConfirmModal({
                icon: "📥",
                title: "Save Invoice Record",
                message: `Are you sure you want to save & log Invoice #${invNum}?`,
                proceedText: "💾 Save Record",
                proceedClass: "btn-primary"
            });
            if (!confirmed) return;

            const updatedFields = gatherDynamicFieldsFromUI();
            
            // Gather Part A (Delivery Challan) inputs
            const chNum = document.getElementById("rec-challan-number")?.value;
            const chDate = document.getElementById("rec-challan-date")?.value;
            const chTrans = document.getElementById("rec-challan-transporter")?.value;
            const chVeh = document.getElementById("rec-challan-vehicle")?.value;
            const chGoods = document.getElementById("rec-challan-goods")?.value;

            if (chNum) updatedFields["Challan Number"] = chNum;
            if (chDate) updatedFields["Challan Date"] = chDate;
            if (chTrans) updatedFields["Transporter Name"] = chTrans;
            if (chVeh) updatedFields["Vehicle Number"] = chVeh;
            if (chGoods) updatedFields["Challan Goods Summary"] = chGoods;

            document.getElementById("rec-extracted-fields-json").value = JSON.stringify(updatedFields);

            const formData = new FormData(recSaveForm);
            if (chNum && !formData.has("challan_number")) formData.append("challan_number", chNum);

            try {
                const res = await fetch("/api/receiving", {
                    method: "POST",
                    body: formData
                });
                if (res.ok) {
                    const saved = await res.json();
                    const ocrCard = document.getElementById("rec-ocr-results-card") || document.getElementById("ocr-results-card");
                    if (ocrCard) ocrCard.style.display = "none";
                    if (recSaveForm) recSaveForm.reset();

                    currentReceivingRecords = [saved, ...currentReceivingRecords.filter(r => r.id !== saved.id)];
                    renderReceivingTable(currentReceivingRecords);
                    renderCalendar('ALL');

                    await window.showAlertModal({ icon: "🎉", title: "Receiving Record Saved", message: `Invoice #${saved.invoice_number || invNum} saved & logged into repository successfully!` });
                    fetchReceivingRecords();
                    fetchNotifications();
                }
            } catch (err) {
                console.error("Receiving save error:", err);
                window.showAlertModal({ icon: "❌", title: "Save Error", message: err.message });
            }
        });
    }
});

window.markPaid = function(recordId) {
    const record = currentReceivingRecords.find(r => r.id === recordId);
    if (!record) return;

    window.openPaymentModal({
        id: recordId,
        targetType: "RECEIVING",
        refText: `Vendor Invoice #${record.invoice_number || 'N/A'} (${record.vendor_name || 'Vendor'})`,
        totalAmount: record.total_amount || 0.0,
        alreadyPaid: record.paid_amount || 0.0
    });
};

window.applyPayablesCategorizedFilters = function() {
    renderCalendar('CATEGORIZED');
};

window.resetPayablesFilters = function() {
    const invInput = document.getElementById("payables-filter-inv");
    const dateInput = document.getElementById("payables-filter-date");
    const poInput = document.getElementById("payables-filter-po");
    const dueSelect = document.getElementById("payables-filter-due");

    if (invInput) invInput.value = "";
    if (dateInput) dateInput.value = "";
    if (poInput) poInput.value = "";
    if (dueSelect) dueSelect.value = "ALL";

    renderCalendar('ALL');
};

window.setPayablesQuickStatus = function(statusStr) {
    const dueSelect = document.getElementById("payables-filter-due");
    if (dueSelect) dueSelect.value = statusStr;
    renderCalendar(statusStr);
};

// Payment Calendar Visual Renderer with 4-Attribute Filtering
window.renderCalendar = function(filter = 'ALL') {
    const container = document.getElementById('calendar-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    // Read Filter Values from Control Inputs
    const invQuery = (document.getElementById("payables-filter-inv")?.value || "").trim().toLowerCase();
    const dateQuery = (document.getElementById("payables-filter-date")?.value || "").trim();
    const poQuery = (document.getElementById("payables-filter-po")?.value || "").trim().toLowerCase();
    const dueStatusSelect = document.getElementById("payables-filter-due")?.value || "ALL";

    const activeDueFilter = filter === 'CATEGORIZED' ? dueStatusSelect : filter;

    const filtered = currentReceivingRecords.filter(r => {
        const fields = r.extracted_fields || {};

        // 1. Invoice No Filter
        if (invQuery) {
            const invNo = (r.invoice_number || fields["Invoice Number"] || "").toLowerCase();
            if (!invNo.includes(invQuery)) return false;
        }

        // 2. Date Filter (matches invoice_date, inward_date, or created_at)
        if (dateQuery) {
            const recDate = (r.invoice_date || r.inward_date || r.created_at || "").split("T")[0];
            if (recDate !== dateQuery) return false;
        }

        // 3. PO No Filter (matches po_number, extracted PO Number, or Challan Number)
        if (poQuery) {
            const poNo = (r.po_number || fields["PO Number"] || r.challan_number || "").toLowerCase();
            if (!poNo.includes(poQuery)) return false;
        }

        // 4. Payment Terms or Due Date Status Filter
        if (activeDueFilter === 'PAID') {
            return r.status === 'Paid';
        }
        if (activeDueFilter === 'PARTIAL') {
            return r.status === 'Partially Paid';
        }

        const dueDt = new Date(r.due_date);
        const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));

        if (activeDueFilter === 'OVERDUE') {
            return r.status !== 'Paid' && diffDays < 0;
        }
        if (activeDueFilter === 'DUE_7' || activeDueFilter === 'UPCOMING') {
            return r.status !== 'Paid' && diffDays >= 0 && diffDays <= 7;
        }
        if (activeDueFilter === 'DUE_30') {
            return r.status !== 'Paid' && diffDays >= 0 && diffDays <= 30;
        }

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 20px; background: #FFF; border-radius: 10px; border: 1px dashed #CBD5E1;">🔍 No payable invoices match the selected category filters.</p>`;
        return;
    }

    filtered.forEach(r => {
        const fields = r.extracted_fields || {};
        const dueDt = new Date(r.due_date);
        const diffDays = Math.ceil((dueDt - today) / (1000 * 60 * 60 * 24));
        
        let borderLeft = "4px solid var(--border-color)";
        let statusText = r.status;

        if (r.status === 'Paid') {
            borderLeft = "4px solid var(--success)";
            statusText = "Paid in full";
        } else if (r.status === 'Partially Paid') {
            borderLeft = "4px solid #F97316";
            statusText = `Partially Paid (Bal: ₹${(r.remaining_balance || 0).toLocaleString('en-IN')})`;
        } else if (diffDays < 0) {
            borderLeft = "4px solid var(--danger)";
            statusText = `Overdue by ${Math.abs(diffDays)} days`;
        } else if (diffDays <= 7) {
            borderLeft = "4px solid var(--warning)";
            statusText = `Due in ${diffDays} days`;
        }

        const poNumDisplay = r.po_number || fields["PO Number"] || "N/A";
        const invDateDisplay = r.invoice_date || (r.created_at ? r.created_at.split('T')[0] : 'N/A');

        const div = document.createElement('div');
        div.className = 'card';
        div.style.marginBottom = '0';
        div.style.borderLeft = borderLeft;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                <div>
                    <strong style="font-size: 1.05rem; color: var(--semco-blue); display: block;">${r.invoice_number || 'N/A'}</strong>
                    <span class="badge" style="background:#F1F5F9; color:#475569; font-size:0.75rem; margin-top:2px;">PO: ${poNumDisplay}</span>
                </div>
                ${getStatusBadge(r.status, r)}
            </div>
            <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 4px;">Vendor: <strong>${r.vendor_name || 'N/A'}</strong></div>
            <div style="font-size: 0.82rem; color: #64748B; margin-bottom: 4px;">Invoice Date: <strong>${invDateDisplay}</strong></div>
            <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px;">Due Date / Terms: <strong>${r.due_date || 'N/A'}</strong> <span style="color:#D97706; font-size:0.8rem;">(${statusText})</span></div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 12px;">₹${(r.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            ${r.status !== 'Paid' ? `<button class="btn btn-success btn-sm" onclick="markPaid('${r.id}')">💳 Record Payment</button>` : '<span style="color:#166534; font-weight:600; font-size:0.85rem;">✓ Paid in Full</span>'}
        `;
        container.appendChild(div);
    });
};

// ----------------------------------------------------
// RECEIVING SUB-TABS: INVOICES vs DELIVERY CHALLANS
// ----------------------------------------------------

let currentChallans = [];

window.switchReceivingSubtab = function(subtab) {
    console.log("Switching receiving subtab to:", subtab);
    const secChallan = document.getElementById("rec-section-challan");
    const secChallanInvoice = document.getElementById("rec-section-challan-invoice");
    const secInvoiceAfter = document.getElementById("rec-section-invoice-after");
    const secInvoicesByDate = document.getElementById("rec-section-invoices-by-date");

    const btnChallan = document.getElementById("rec-subnav-challan-btn");
    const btnChallanInvoice = document.getElementById("rec-subnav-challan-invoice-btn");
    const btnInvoiceAfter = document.getElementById("rec-subnav-invoice-after-btn");
    const btnInvoicesByDate = document.getElementById("rec-subnav-invoices-date-btn");

    // Reset buttons
    [btnChallan, btnChallanInvoice, btnInvoiceAfter, btnInvoicesByDate].forEach(b => {
        if (b) { b.classList.remove("btn-primary"); b.classList.add("btn-outline"); }
    });

    // Reset sections
    [secChallan, secChallanInvoice, secInvoiceAfter, secInvoicesByDate].forEach(s => {
        if (s) s.style.setProperty("display", "none", "important");
    });

    if (subtab === 'challan') {
        if (secChallan) secChallan.style.setProperty("display", "block", "important");
        if (btnChallan) { btnChallan.classList.remove("btn-outline"); btnChallan.classList.add("btn-primary"); }
        if (typeof fetchDeliveryChallans === 'function') fetchDeliveryChallans();
    } else if (subtab === 'challan-invoice') {
        if (secChallanInvoice) secChallanInvoice.style.setProperty("display", "block", "important");
        if (btnChallanInvoice) { btnChallanInvoice.classList.remove("btn-outline"); btnChallanInvoice.classList.add("btn-primary"); }
        if (typeof fetchReceivingRecords === 'function') fetchReceivingRecords();
    } else if (subtab === 'invoice-after') {
        if (secInvoiceAfter) secInvoiceAfter.style.setProperty("display", "block", "important");
        if (btnInvoiceAfter) { btnInvoiceAfter.classList.remove("btn-outline"); btnInvoiceAfter.classList.add("btn-primary"); }
        if (typeof refreshPendingChallansDropdown === 'function') refreshPendingChallansDropdown();
        if (typeof fetchReceivingRecords === 'function') fetchReceivingRecords();
    } else if (subtab === 'invoices-by-date') {
        if (secInvoicesByDate) secInvoicesByDate.style.setProperty("display", "block", "important");
        if (btnInvoicesByDate) { btnInvoicesByDate.classList.remove("btn-outline"); btnInvoicesByDate.classList.add("btn-primary"); }
        renderOnlyInvoicesByInwardDate('ALL');
    }
};

window.fetchDeliveryChallans = async function() {
    try {
        const res = await fetch('/api/receiving/challans');
        currentChallans = await res.json();
        renderChallansTable(currentChallans);
    } catch (err) {
        console.error("Error fetching delivery challans:", err);
    }
};

function renderChallansTable(challans) {
    const tbody = document.getElementById('challans-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (challans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No inward delivery challans logged yet.</td></tr>`;
        return;
    }

    challans.forEach(ch => {
        const tr = document.createElement('tr');
        const docLink = ch.challan_doc ? `<a href="${ch.challan_doc}" target="_blank" class="btn btn-outline btn-sm" style="font-size:0.75rem;">📜 View Challan</a>` : '<span style="color:var(--text-muted);">No Doc</span>';

        tr.innerHTML = `
            <td><strong>${ch.challan_number}</strong></td>
            <td>${ch.vendor_name}</td>
            <td>${ch.challan_date}</td>
            <td>${ch.transporter_name || 'N/A'}</td>
            <td>${ch.items_summary || 'N/A'}</td>
            <td>${docLink}</td>
            <td>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                    <span class="badge badge-verified">${ch.status || 'Inward Verified'}</span>
                    <button class="btn btn-outline btn-sm" style="border-color: #EF4444; color: #EF4444;" onclick="deleteDeliveryChallan('${ch.id}')">🗑️ Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteDeliveryChallan = async function(challanId) {
    const confirmed = await window.showConfirmModal({
        icon: "🗑️",
        title: "Delete Delivery Challan",
        message: "Are you sure you want to delete this delivery challan record?",
        proceedText: "🗑️ Delete Permanently",
        proceedClass: "btn-outline"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/receiving/challans/${challanId}`, { method: "DELETE" });
        if (res.ok) {
            fetchDeliveryChallans();
            fetchNotifications();
        } else {
            window.showAlertModal({ icon: "❌", title: "Deletion Failed", message: "Could not delete delivery challan." });
        }
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Deletion Error", message: err.message });
    }
};

// Additional listener for Delivery Challan form submission
document.addEventListener("DOMContentLoaded", () => {
    const challanForm = document.getElementById("challan-save-form");
    if (challanForm) {
        challanForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const confirmed = await window.showConfirmModal({
                icon: "📜",
                title: "Save Delivery Challan",
                message: "Are you sure you want to log and save this Inward Delivery Challan?",
                proceedText: "📜 Save & Log",
                proceedClass: "btn-primary"
            });
            if (!confirmed) return;

            const btn = document.getElementById("btn-save-challan");
            btn.innerHTML = "⏳ Saving Delivery Challan...";
            btn.disabled = true;

            try {
                const formData = new FormData(challanForm);
                const res = await fetch("/api/receiving/challans", {
                    method: "POST",
                    body: formData
                });
                const saved = await res.json();
                challanForm.reset();

                currentChallans = [saved, ...currentChallans.filter(c => c.id !== saved.id)];
                renderChallansTable(currentChallans);

                await window.showAlertModal({ icon: "🎉", title: "Delivery Challan Logged", message: `Delivery Challan #${saved.challan_number} saved & logged successfully!` });
                fetchDeliveryChallans();
                fetchNotifications();
            } catch (err) {
                window.showAlertModal({ icon: "❌", title: "Save Error", message: err.message });
            } finally {
                btn.innerHTML = "📜 Save & Log Delivery Challan";
                btn.disabled = false;
            }
        });
    }
});

window.fetchReceivingAuditLogs = async function() {
    try {
        const res = await fetch('/api/notifications?section=RECEIVING');
        const logs = await res.json();
        renderReceivingAuditTable(logs);
    } catch (err) {
        console.error("Error fetching receiving audit logs:", err);
    }
};

function renderReceivingAuditTable(logs) {
    const tbody = document.getElementById('receiving-audit-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No audit logs recorded for Receiving section yet.</td></tr>`;
        return;
    }

    logs.forEach(l => {
        const tr = document.createElement('tr');
        const dt = l.sent_at || (l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : 'Just Now');
        tr.innerHTML = `
            <td><small style="color:var(--text-muted);">${dt}</small></td>
            <td><strong>${l.subject}</strong></td>
            <td>${l.message_body}</td>
            <td><span class="badge badge-draft">RECEIVING</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// RECEIVING RECORD DOCUMENT & DATA VERIFICATION PREVIEW
// ----------------------------------------------------

window.previewReceivingRecord = async function(recordId) {
    let record = (currentReceivingRecords || []).find(r => r.id === recordId);
    if (!record) {
        try {
            const res = await fetch('/api/receiving');
            const records = await res.json();
            currentReceivingRecords = records;
            record = records.find(r => r.id === recordId);
        } catch (err) {
            console.error("Error fetching receiving records for preview:", err);
        }
    }

    if (!record) {
        window.showAlertModal({ icon: "⚠️", title: "Record Not Found", message: "Could not locate record details in repository." });
        return;
    }

    const modal = document.getElementById("receiving-preview-modal");
    const splitBody = document.getElementById("rec-preview-split-body");
    const titleEl = document.getElementById("rec-preview-title");
    const subtitleEl = document.getElementById("rec-preview-subtitle");

    if (!modal || !splitBody) return;

    if (titleEl) titleEl.innerText = `Invoice #${record.invoice_number} — Document Verification`;
    if (subtitleEl) subtitleEl.innerText = `Vendor: ${record.vendor_name} | Amount: ₹${(record.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})} | Status: ${record.status}`;

    const docPath = record.document_path || "";
    let viewerHtml = "";

    if (docPath) {
        const lower = docPath.toLowerCase();
        if (lower.endsWith(".pdf")) {
            viewerHtml = `
                <div style="background: #FFFFFF; padding: 12px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: var(--semco-blue); font-size: 0.9rem;">📑 Original Uploaded PDF Document</strong>
                        <a href="${docPath}" target="_blank" class="btn btn-outline btn-sm">↗ Open Full PDF</a>
                    </div>
                    <iframe src="${docPath}" style="width: 100%; height: 580px; border: 1px solid #CBD5E1; border-radius: 8px;"></iframe>
                </div>
            `;
        } else if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
            viewerHtml = `
                <div style="background: #FFFFFF; padding: 12px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: var(--semco-blue); font-size: 0.9rem;">🖼️ Original Uploaded Image Document</strong>
                        <a href="${docPath}" target="_blank" class="btn btn-outline btn-sm">↗ Open Original</a>
                    </div>
                    <div style="text-align: center; max-height: 580px; overflow: auto; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1;">
                        <img src="${docPath}" alt="Uploaded Invoice Document" style="max-width: 100%; max-height: 540px; object-fit: contain; border-radius: 6px;">
                    </div>
                </div>
            `;
        } else {
            viewerHtml = `
                <div style="background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 2rem;">📎</div>
                    <strong style="color: var(--semco-blue);">Attached Document</strong>
                    <div style="margin-top: 10px;">
                        <a href="${docPath}" target="_blank" class="btn btn-primary btn-sm">📥 Download / View File (${docPath.split('/').pop()})</a>
                    </div>
                </div>
            `;
        }
    } else {
        viewerHtml = `
            <div style="background: #EFF6FF; padding: 30px; border-radius: 12px; border: 1px solid #BFDBFE; text-align: center;">
                <div style="font-size: 2.5rem; margin-bottom: 10px;">📝</div>
                <strong style="color: var(--semco-blue); font-size: 1.05rem;">Direct Entry Record</strong>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 6px;">This record was logged directly via form entry. No external document file was attached.</p>
            </div>
        `;
    }

    const fields = record.extracted_fields || {};
    let dataSummaryHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: var(--semco-blue);">🏢 Order Received By (Receiver / Billed To)</strong>
                    <span class="badge badge-verified">Verified</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem;">${fields["Order Received By (Receiver / Billed To)"] || record.receiver_name || "SEMCORP PROCESS AND VACUUM SYSTEMS PRIVATE LIMITED"}</div>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">GSTIN: <strong>${fields["Receiver GSTIN"] || "27ABRCS0246H1Z3"}</strong></div>
                ${fields["Receiver Address"] ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${fields["Receiver Address"]}</div>` : ''}
            </div>

            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: var(--semco-blue);">🏭 Vendor / Supplier Details (Issued By)</strong>
                    <span class="badge badge-draft">Supplier</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem;">${fields["Vendor Name"] || record.vendor_name}</div>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">GSTIN: <strong>${fields["Vendor GSTIN"] || "N/A"}</strong> ${fields["Vendor Phone"] ? `| Phone: ${fields["Vendor Phone"]}` : ''}</div>
                ${fields["Vendor Address"] ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${fields["Vendor Address"]}</div>` : ''}
            </div>

            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <strong style="color: var(--semco-blue); font-size: 0.9rem; display: block; margin-bottom: 8px;">📄 Invoice & References</strong>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                    <div>Invoice No: <strong>${record.invoice_number}</strong></div>
                    <div>Invoice Date: <strong>${record.invoice_date || "N/A"}</strong></div>
                    <div>Due Date: <strong>${record.due_date || "N/A"}</strong></div>
                    <div>Challan No: <strong>${fields["Challan Number"] || "N/A"}</strong></div>
                </div>
            </div>

            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <strong style="color: var(--semco-blue); font-size: 0.9rem; display: block; margin-bottom: 8px;">💰 Financial Breakdown</strong>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                    <div>Total Valuation: <strong style="color: #059669; font-size: 1rem;">₹${(record.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></div>
                    <div>Subtotal (Excl. Tax): <strong>${fields["Subtotal (Before Tax)"] || "N/A"}</strong></div>
                    <div>CGST: <strong>${fields["CGST Amount"] || "N/A"}</strong></div>
                    <div>SGST: <strong>${fields["SGST Amount"] || "N/A"}</strong></div>
                    <div>Total Tax: <strong>${fields["Total Tax Amount"] || "N/A"}</strong></div>
                </div>
            </div>

            ${fields["Bank Account Name"] || fields["Bank Account No"] ? `
                <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <strong style="color: var(--semco-blue); font-size: 0.9rem; display: block; margin-bottom: 8px;">🏦 Bank & Payment Details</strong>
                    <div style="font-size: 0.83rem;">
                        <div>Account Name: <strong>${fields["Bank Account Name"] || "N/A"}</strong></div>
                        <div>Account No: <strong>${fields["Bank Account No"] || "N/A"}</strong></div>
                        <div>IFSC Code: <strong>${fields["Bank IFSC Code"] || "N/A"}</strong></div>
                        <div>Bank: <strong>${fields["Bank Name"] || "N/A"}</strong> (${fields["Bank Branch"] || ""})</div>
                    </div>
                </div>
            ` : ''}
    `;

    if (fields["Full Scanned Document Content"]) {
        dataSummaryHtml += `
            <div style="background: #FFFFFF; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <strong style="color: var(--semco-blue); font-size: 0.88rem; display: block; margin-bottom: 8px;">📝 Full Scanned Text & Line Items</strong>
                <textarea rows="6" readonly style="width: 100%; font-family: monospace; font-size: 0.8rem; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 8px;">${fields["Full Scanned Document Content"]}</textarea>
            </div>
        `;
    }

    dataSummaryHtml += `</div>`;

    splitBody.innerHTML = `
        <div style="flex: 1;">${viewerHtml}</div>
        <div style="flex: 1;">${dataSummaryHtml}</div>
    `;

    modal.style.display = "flex";
};

window.closeReceivingPreviewModal = function() {
    const modal = document.getElementById("receiving-preview-modal");
    if (modal) modal.style.display = "none";
};

// Preview during OCR editing phase (before record is saved)
window.previewCurrentOCRScan = function() {
    const docPath = pendingOCRPath || (document.getElementById("rec-document-path") ? document.getElementById("rec-document-path").value : "");
    const fields = currentExtractedFields || {};

    const modal = document.getElementById("receiving-preview-modal");
    const splitBody = document.getElementById("rec-preview-split-body");
    const titleEl = document.getElementById("rec-preview-title");
    const subtitleEl = document.getElementById("rec-preview-subtitle");

    if (!modal || !splitBody) return;

    const invNum = document.getElementById("rec-invoice-number") ? document.getElementById("rec-invoice-number").value : (fields["Invoice Number"] || "N/A");
    const vendorName = document.getElementById("rec-vendor-name") ? document.getElementById("rec-vendor-name").value : (fields["Vendor Name"] || "N/A");

    if (titleEl) titleEl.innerText = `Invoice #${invNum} — Document Preview`;
    if (subtitleEl) subtitleEl.innerText = `Vendor: ${vendorName} | Pre-Save Verification`;

    let viewerHtml = "";

    if (docPath) {
        const lower = docPath.toLowerCase();
        if (lower.endsWith(".pdf")) {
            viewerHtml = `
                <div style="background: #FFFFFF; padding: 12px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: var(--semco-blue); font-size: 0.9rem;">📑 Uploaded PDF Document</strong>
                        <a href="${docPath}" target="_blank" class="btn btn-outline btn-sm">↗ Open Full PDF</a>
                    </div>
                    <iframe src="${docPath}" style="width: 100%; height: 580px; border: 1px solid #CBD5E1; border-radius: 8px;"></iframe>
                </div>
            `;
        } else if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
            viewerHtml = `
                <div style="background: #FFFFFF; padding: 12px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: var(--semco-blue); font-size: 0.9rem;">🖼️ Uploaded Image Document</strong>
                        <a href="${docPath}" target="_blank" class="btn btn-outline btn-sm">↗ Open Original</a>
                    </div>
                    <div style="text-align: center; max-height: 580px; overflow: auto; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1;">
                        <img src="${docPath}" alt="Uploaded Invoice Document" style="max-width: 100%; max-height: 540px; object-fit: contain; border-radius: 6px;">
                    </div>
                </div>
            `;
        } else {
            viewerHtml = `
                <div style="background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 2rem;">📎</div>
                    <strong style="color: var(--semco-blue);">Attached Document</strong>
                    <div style="margin-top: 10px;">
                        <a href="${docPath}" target="_blank" class="btn btn-primary btn-sm">📥 Download / View (${docPath.split('/').pop()})</a>
                    </div>
                </div>
            `;
        }
    } else {
        viewerHtml = `
            <div style="background: #EFF6FF; padding: 30px; border-radius: 12px; border: 1px solid #BFDBFE; text-align: center;">
                <div style="font-size: 2.5rem; margin-bottom: 10px;">📝</div>
                <strong style="color: var(--semco-blue); font-size: 1.05rem;">No Document Uploaded Yet</strong>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 6px;">Upload an invoice file to preview it here.</p>
            </div>
        `;
    }

    // Build extracted data summary from current fields
    let dataSummaryHtml = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: var(--semco-blue);">🏢 Order Received By</strong>
                    <span class="badge badge-verified">Receiver</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem;">${fields["Order Received By (Receiver / Billed To)"] || "SEMCORP PROCESS AND VACUUM SYSTEMS PRIVATE LIMITED"}</div>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">GSTIN: <strong>${fields["Receiver GSTIN"] || "N/A"}</strong></div>
            </div>

            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: var(--semco-blue);">🏭 Vendor / Supplier</strong>
                    <span class="badge badge-draft">Supplier</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem;">${fields["Vendor Name"] || vendorName}</div>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">GSTIN: <strong>${fields["Vendor GSTIN"] || "N/A"}</strong> ${fields["Vendor Phone"] ? `| Phone: ${fields["Vendor Phone"]}` : ''}</div>
            </div>

            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <strong style="color: var(--semco-blue); font-size: 0.9rem; display: block; margin-bottom: 8px;">📄 Invoice & References</strong>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                    <div>Invoice No: <strong>${invNum}</strong></div>
                    <div>Invoice Date: <strong>${fields["Invoice Date"] || "N/A"}</strong></div>
                    <div>Due Date: <strong>${fields["Due Date"] || "N/A"}</strong></div>
                    <div>Total Amount: <strong style="color: #059669;">${fields["Total Amount"] || "N/A"}</strong></div>
                </div>
            </div>
    `;

    if (fields["Bank Account No"] || fields["Bank Name"]) {
        dataSummaryHtml += `
            <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <strong style="color: var(--semco-blue); font-size: 0.9rem; display: block; margin-bottom: 8px;">🏦 Bank & Payment Details</strong>
                <div style="font-size: 0.83rem;">
                    <div>Account No: <strong>${fields["Bank Account No"] || "N/A"}</strong></div>
                    <div>IFSC Code: <strong>${fields["Bank IFSC Code"] || "N/A"}</strong></div>
                    <div>Bank: <strong>${fields["Bank Name"] || "N/A"}</strong></div>
                </div>
            </div>
        `;
    }

    if (fields["Full Scanned Document Content"]) {
        dataSummaryHtml += `
            <div style="background: #FFFFFF; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <strong style="color: var(--semco-blue); font-size: 0.88rem; display: block; margin-bottom: 8px;">📝 Full Scanned Text</strong>
                <textarea rows="6" readonly style="width: 100%; font-family: monospace; font-size: 0.8rem; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 8px;">${fields["Full Scanned Document Content"]}</textarea>
            </div>
        `;
    }

    dataSummaryHtml += `</div>`;

    splitBody.innerHTML = `
        <div style="flex: 1;">${viewerHtml}</div>
        <div style="flex: 1;">${dataSummaryHtml}</div>
    `;

    modal.style.display = "flex";
};

// ----------------------------------------------------
// MANUAL ENTRY FORM LOGIC
// ----------------------------------------------------

window.showManualEntryForm = function() {
    const manualCard = document.getElementById("manual-entry-card");
    if (manualCard) manualCard.style.display = "block";

    const ocrCard = document.getElementById("rec-ocr-results-card") || document.getElementById("ocr-results-card");
    if (ocrCard) ocrCard.style.display = "none";

    const today = new Date();
    const invDateInput = document.getElementById("manual-invoice-date");
    if (invDateInput) invDateInput.value = today.toISOString().split("T")[0];

    const dueDateInput = document.getElementById("manual-due-date");
    if (dueDateInput) {
        const due = new Date(today); due.setDate(due.getDate() + 30);
        dueDateInput.value = due.toISOString().split("T")[0];
    }

    manualCustomFieldCount = 0;
    manualUploadedFilePath = "";

    const customContainer = document.getElementById("manual-custom-fields-container");
    if (customContainer) customContainer.innerHTML = "";

    const previewEl = document.getElementById("manual-file-preview");
    if (previewEl) previewEl.style.display = "none";

    const docPathInput = document.getElementById("manual-document-path");
    if (docPathInput) docPathInput.value = "";

    if (manualCard) manualCard.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.hideManualEntryForm = function() {
    const manualCard = document.getElementById("manual-entry-card");
    if (manualCard) manualCard.style.display = "none";
};

window.addManualCustomField = function() {
    manualCustomFieldCount++;
    const container = document.getElementById("manual-custom-fields-container");
    const row = document.createElement("div");
    row.className = "form-row";
    row.style.marginBottom = "8px";
    row.id = `manual-custom-row-${manualCustomFieldCount}`;
    row.innerHTML = `
        <div class="form-group" style="flex: 1;">
            <input type="text" class="form-control manual-custom-key" placeholder="Field Name (e.g. Transport Mode)" style="font-size: 0.85rem;">
        </div>
        <div class="form-group" style="flex: 2;">
            <input type="text" class="form-control manual-custom-val" placeholder="Field Value" style="font-size: 0.85rem;">
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('manual-custom-row-${manualCustomFieldCount}').remove()" style="border-color: #EF4444; color: #EF4444; align-self: center; height: 36px;">✖</button>
    `;
    container.appendChild(row);
};

window.triggerManualCameraCapture = function() {
    document.getElementById("manual-camera-input").click();
};

window.handleManualCameraCapture = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    await uploadManualFile(file);
};

// Listen on manual file input change
document.addEventListener("DOMContentLoaded", function() {
    const manualFileInput = document.getElementById("manual-file-input");
    if (manualFileInput) {
        manualFileInput.addEventListener("change", async function() {
            if (this.files && this.files[0]) {
                await uploadManualFile(this.files[0]);
            }
        });
    }
});

async function uploadManualFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/receiving/upload-file", { method: "POST", body: formData });
        const data = await res.json();
        manualUploadedFilePath = data.document_path || "";
        document.getElementById("manual-document-path").value = manualUploadedFilePath;
        document.getElementById("manual-file-preview").style.display = "block";
        document.getElementById("manual-file-name").textContent = `✅ ${file.name} uploaded`;
    } catch (err) {
        console.error("Manual file upload error:", err);
    }
}

// Manual entry form submission
document.addEventListener("DOMContentLoaded", function() {
    const manualForm = document.getElementById("manual-entry-form");
    if (manualForm) {
        manualForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const invoiceNumber = document.getElementById("manual-invoice-number").value.trim();
            const vendorName = document.getElementById("manual-vendor-name").value.trim();
            const invoiceDate = document.getElementById("manual-invoice-date").value;
            const dueDate = document.getElementById("manual-due-date").value;
            const totalAmount = parseFloat(document.getElementById("manual-total-amount").value) || 0;
            const docPath = document.getElementById("manual-document-path").value;

            // Build extracted_fields from all manual sections
            const extractedFields = {};
            extractedFields["Vendor Name"] = vendorName;
            extractedFields["Invoice Number"] = invoiceNumber;
            extractedFields["Invoice Date"] = invoiceDate;
            extractedFields["Due Date"] = dueDate;
            extractedFields["Total Amount"] = `₹ ${totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

            const vendorGstin = document.getElementById("manual-vendor-gstin").value.trim();
            if (vendorGstin) extractedFields["Vendor GSTIN"] = vendorGstin;
            const vendorPhone = document.getElementById("manual-vendor-phone").value.trim();
            if (vendorPhone) extractedFields["Vendor Phone"] = vendorPhone;
            const vendorEmail = document.getElementById("manual-vendor-email").value.trim();
            if (vendorEmail) extractedFields["Vendor Email"] = vendorEmail;
            const vendorAddr = document.getElementById("manual-vendor-address").value.trim();
            if (vendorAddr) extractedFields["Vendor Address"] = vendorAddr;

            const recName = document.getElementById("manual-receiver-name").value.trim();
            if (recName) extractedFields["Order Received By (Receiver / Billed To)"] = recName;
            const recGstin = document.getElementById("manual-receiver-gstin").value.trim();
            if (recGstin) extractedFields["Receiver GSTIN"] = recGstin;

            const subtotal = document.getElementById("manual-subtotal").value.trim();
            if (subtotal) extractedFields["Subtotal (Before Tax)"] = subtotal;
            const cgst = document.getElementById("manual-cgst").value.trim();
            if (cgst) extractedFields["CGST Amount"] = cgst;
            const sgst = document.getElementById("manual-sgst").value.trim();
            if (sgst) extractedFields["SGST Amount"] = sgst;
            const totalTax = document.getElementById("manual-total-tax").value.trim();
            if (totalTax) extractedFields["Total Tax Amount"] = totalTax;

            const poNum = document.getElementById("manual-po-number").value.trim();
            if (poNum) extractedFields["PO Number"] = poNum;
            const challanNum = document.getElementById("manual-challan-number").value.trim();
            if (challanNum) extractedFields["Challan Number"] = challanNum;

            const manualChallanDoc = document.getElementById("manual-challan-doc-path")?.value || "";
            if (manualChallanDoc) extractedFields["Challan Document Path"] = manualChallanDoc;

            // Collect custom fields
            const customKeys = document.querySelectorAll(".manual-custom-key");
            const customVals = document.querySelectorAll(".manual-custom-val");
            customKeys.forEach((keyEl, idx) => {
                const k = keyEl.value.trim();
                const v = customVals[idx] ? customVals[idx].value.trim() : "";
                if (k) extractedFields[k] = v;
            });

            // Save via API
            const formData = new FormData();
            formData.append("invoice_number", invoiceNumber);
            formData.append("vendor_name", vendorName);
            formData.append("invoice_date", invoiceDate);
            formData.append("due_date", dueDate);
            formData.append("total_amount", totalAmount);
            formData.append("po_number", poNum);
            formData.append("challan_number", challanNum);
            formData.append("document_path", docPath);
            formData.append("challan_doc_path", manualChallanDoc);
            formData.append("extracted_fields_json", JSON.stringify(extractedFields));
            formData.append("status", "Verified");

            try {
                const res = await fetch("/api/receiving", { method: "POST", body: formData });
                if (res.ok) {
                    window.showAlertModal({ icon: "✅", title: "Manual Entry Saved", message: `Invoice #${invoiceNumber} from ${vendorName} has been saved to the repository.` });
                    hideManualEntryForm();
                    manualForm.reset();
                    fetchReceivingRecords();
                } else {
                    window.showAlertModal({ icon: "❌", title: "Save Failed", message: "Could not save manual entry. Please try again." });
                }
            } catch (err) {
                console.error("Manual entry save error:", err);
                window.showAlertModal({ icon: "❌", title: "Save Error", message: err.message });
            }
        });
    }
});

// ----------------------------------------------------
// SECTION 1: CHALLAN ONLY HANDLERS
// ----------------------------------------------------

window.handleChallanOCR = async function(input, target) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/receiving/ocr-upload", { method: "POST", body: formData });
        const data = await res.json();
        const fields = data.extracted_fields || {};

        if (target === 'challan') {
            document.getElementById("ch1-document-path").value = data.document_path || "";
            if (fields["Challan Number"]) document.getElementById("ch1-challan-number").value = fields["Challan Number"];
            if (fields["Invoice Date"]) document.getElementById("ch1-challan-date").value = fields["Invoice Date"];
            if (fields["Vendor Name"]) document.getElementById("ch1-vendor-name").value = fields["Vendor Name"];
            if (fields["PO Number"]) document.getElementById("ch1-po-number").value = fields["PO Number"];
            document.getElementById("ch1-file-badge").style.display = "block";
            document.getElementById("ch1-file-name").textContent = `✅ ${file.name} scanned & attached`;
        }
    } catch (err) {
        console.error("Challan OCR error:", err);
    }
};

document.addEventListener("DOMContentLoaded", function() {
    const ch1Form = document.getElementById("challan-only-form");
    if (ch1Form) {
        ch1Form.addEventListener("submit", async function(e) {
            e.preventDefault();
            const challanNumber = document.getElementById("ch1-challan-number").value.trim();
            const challanDate = document.getElementById("ch1-challan-date").value;
            const vendorName = document.getElementById("ch1-vendor-name").value.trim();
            const poNumber = document.getElementById("ch1-po-number").value.trim();
            const transporter = document.getElementById("ch1-transporter").value.trim();
            const vehicle = document.getElementById("ch1-vehicle").value.trim();
            const itemsSummary = document.getElementById("ch1-items-summary").value.trim();
            let docPath = document.getElementById("ch1-document-path").value;

            const fileInput = document.getElementById("ch1-file-input");
            if (fileInput && fileInput.files && fileInput.files[0] && !docPath) {
                const uploadFd = new FormData();
                uploadFd.append("file", fileInput.files[0]);
                const upRes = await fetch("/api/receiving/upload-file", { method: "POST", body: uploadFd });
                const upData = await upRes.json();
                docPath = upData.document_path || "";
            }

            // Gather Section 1 Custom Fields
            const customFields = {};
            const keys = document.querySelectorAll(".s1-custom-key");
            const vals = document.querySelectorAll(".s1-custom-val");
            keys.forEach((kEl, idx) => {
                const k = kEl.value.trim();
                const v = vals[idx] ? vals[idx].value.trim() : "";
                if (k) customFields[k] = v;
            });

            const formData = new FormData();
            formData.append("challan_number", challanNumber);
            formData.append("vendor_name", vendorName);
            formData.append("challan_date", challanDate);
            formData.append("transporter_name", transporter);
            formData.append("vehicle_number", vehicle);
            formData.append("items_summary", itemsSummary);
            formData.append("po_number", poNumber);
            formData.append("document_path", docPath);
            formData.append("invoice_status", "Awaiting Invoice");
            if (Object.keys(customFields).length > 0) {
                formData.append("custom_fields_json", JSON.stringify(customFields));
            }

            try {
                const res = await fetch("/api/receiving/challans", { method: "POST", body: formData });
                if (res.ok) {
                    window.showAlertModal({ icon: "✅", title: "Challan Logged", message: `Delivery Challan #${challanNumber} has been logged.` });
                    ch1Form.reset();
                    document.getElementById("ch1-file-badge").style.display = "none";
                    if (typeof fetchDeliveryChallans === 'function') fetchDeliveryChallans();
                } else {
                    window.showAlertModal({ icon: "❌", title: "Save Failed", message: "Could not log delivery challan." });
                }
            } catch (err) {
                console.error("Challan save error:", err);
            }
        });
    }
});

// ----------------------------------------------------
// SECTION 3: INVOICE AFTER DELIVERY CHALLAN HANDLERS
// ----------------------------------------------------

window.refreshPendingChallansDropdown = async function() {
    try {
        const res = await fetch('/api/receiving/challans');
        const challans = await res.json();
        const select = document.getElementById("s3-challan-select");
        if (!select) return;
        select.innerHTML = `<option value="">-- Select a Delivery Challan awaiting invoice --</option>`;

        let pendingCount = 0;
        challans.forEach(ch => {
            if (ch.invoice_status !== "Invoice Linked" && ch.status !== "Invoice Linked") {
                pendingCount++;
                const opt = document.createElement("option");
                opt.value = JSON.stringify(ch);
                opt.textContent = `Challan #${ch.challan_number || 'N/A'} — ${ch.vendor_name || 'Vendor'} (${ch.challan_date || 'Date'})`;
                select.appendChild(opt);
            }
        });

        const badge = document.getElementById("challan-pending-invoice-count");
        if (badge) badge.textContent = `${pendingCount} Awaiting Invoice`;
    } catch (err) {
        console.error("Error refreshing pending challans:", err);
    }
};

window.handleSection3ChallanSelectChange = function(select) {
    if (!select || !select.value) return;
    try {
        const data = JSON.parse(select.value);
        const manualChallanInput = document.getElementById("s3m-manual-challan-number");
        if (manualChallanInput && data.challan_number) {
            manualChallanInput.value = data.challan_number;
        }
        const vendorInput = document.getElementById("s3m-vendor-name");
        if (vendorInput && data.vendor_name) {
            vendorInput.value = data.vendor_name;
        }
    } catch(e) {}
};

window.handleSection3InvoiceUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/receiving/ocr-upload", { method: "POST", body: formData });
        const data = await res.json();
        const fields = data.extracted_fields || {};

        if (fields["Invoice Number"] || data.invoice_number) {
            const el = document.getElementById("s3m-invoice-number");
            if (el) el.value = fields["Invoice Number"] || data.invoice_number || "";
        }
        if (fields["Invoice Date"] || data.invoice_date) {
            const el = document.getElementById("s3m-invoice-date");
            if (el) el.value = fields["Invoice Date"] || data.invoice_date || "";
        }
        if (fields["Due Date"] || data.due_date) {
            const el = document.getElementById("s3m-due-date");
            if (el) el.value = fields["Due Date"] || data.due_date || "";
        }
        if (fields["Vendor Name"] || data.vendor_name) {
            const el = document.getElementById("s3m-vendor-name");
            if (el) el.value = fields["Vendor Name"] || data.vendor_name || "";
        }
        if (fields["Total Amount"] || data.total_amount) {
            const el = document.getElementById("s3m-total-amount");
            if (el) el.value = parseFloat(fields["Total Amount"] || data.total_amount) || 0;
        }
        if (data.document_path) {
            const el = document.getElementById("s3m-document-path");
            if (el) el.value = data.document_path;
            const badge = document.getElementById("s3m-file-badge");
            if (badge) badge.style.display = "block";
            const nameEl = document.getElementById("s3m-file-name");
            if (nameEl) nameEl.textContent = `✅ ${file.name} (OCR Scanned)`;
        }
        window.showAlertModal({ icon: "🎉", title: "Invoice OCR Complete", message: "Extracted invoice fields have been populated into Section 3." });
    } catch (err) {
        console.error("Section 3 OCR error:", err);
    }
};

window.saveSection3ManualInvoice = async function() {
    const select = document.getElementById("s3-challan-select");
    const manualChallanInput = document.getElementById("s3m-manual-challan-number");

    let challanNum = "";
    let vendorNameFromChallan = "";

    if (select && select.value) {
        try {
            const challanData = JSON.parse(select.value);
            challanNum = challanData.challan_number;
            vendorNameFromChallan = challanData.vendor_name;
        } catch(e){}
    }
    if (!challanNum && manualChallanInput) {
        challanNum = manualChallanInput.value.trim();
    }

    if (!challanNum) {
        window.showAlertModal({
            icon: "⚠️",
            title: "Delivery Challan Required",
            message: "Please select a Delivery Challan from the list OR type a Delivery Challan Number to link this invoice."
        });
        return;
    }

    const invoiceNumInput = document.getElementById("s3m-invoice-number");
    const invoiceNumber = invoiceNumInput ? invoiceNumInput.value.trim() : "";
    if (!invoiceNumber) {
        window.showAlertModal({ icon: "⚠️", title: "Invoice Number Required", message: "Please enter an Invoice Number." });
        return;
    }

    const invoiceDate = document.getElementById("s3m-invoice-date")?.value || "";
    const dueDate = document.getElementById("s3m-due-date")?.value || "";
    const vendorName = document.getElementById("s3m-vendor-name")?.value.trim() || vendorNameFromChallan || "Vendor";
    const totalAmount = parseFloat(document.getElementById("s3m-total-amount")?.value) || 0;
    let docPath = document.getElementById("s3m-document-path")?.value || "";

    const fileInput = document.getElementById("s3m-file-input");
    if (fileInput && fileInput.files && fileInput.files[0] && !docPath) {
        const uploadFd = new FormData();
        uploadFd.append("file", fileInput.files[0]);
        const upRes = await fetch("/api/receiving/upload-file", { method: "POST", body: uploadFd });
        const upData = await upRes.json();
        docPath = upData.document_path || "";
    }

    // Gather Section 3 Custom Fields
    const s3CustomFields = {};
    const s3Keys = document.querySelectorAll(".s3-custom-key");
    const s3Vals = document.querySelectorAll(".s3-custom-val");
    s3Keys.forEach((kEl, idx) => {
        const k = kEl.value.trim();
        const v = s3Vals[idx] ? s3Vals[idx].value.trim() : "";
        if (k) s3CustomFields[k] = v;
    });

    const extractedFields = {
        "Vendor Name": vendorName,
        "Invoice Number": invoiceNumber,
        "Invoice Date": invoiceDate,
        "Due Date": dueDate,
        "Total Amount": `₹ ${totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
        "Linked Challan Number": challanNum,
        ...s3CustomFields
    };

    const formData = new FormData();
    formData.append("invoice_number", invoiceNumber);
    formData.append("vendor_name", vendorName);
    formData.append("invoice_date", invoiceDate);
    formData.append("due_date", dueDate);
    formData.append("total_amount", totalAmount);
    formData.append("challan_number", challanNum);
    formData.append("document_path", docPath);
    formData.append("extracted_fields_json", JSON.stringify(extractedFields));
    formData.append("status", "Verified");

    try {
        const res = await fetch("/api/receiving", { method: "POST", body: formData });
        if (res.ok) {
            window.showAlertModal({
                icon: "🎉",
                title: "Invoice Linked & Saved",
                message: `Invoice #${invoiceNumber} has been linked to Delivery Challan #${challanNum} and logged into the repository!`
            });

            // Reset Section 3 inputs
            if (invoiceNumInput) invoiceNumInput.value = "";
            if (manualChallanInput) manualChallanInput.value = "";
            const totalInput = document.getElementById("s3m-total-amount");
            if (totalInput) totalInput.value = "";
            const customContainer = document.getElementById("s3-manual-custom-fields-container");
            if (customContainer) customContainer.innerHTML = "";
            const badge = document.getElementById("s3m-file-badge");
            if (badge) badge.style.display = "none";
            const docPathEl = document.getElementById("s3m-document-path");
            if (docPathEl) docPathEl.value = "";

            refreshPendingChallansDropdown();
            fetchReceivingRecords();
        } else {
            window.showAlertModal({ icon: "❌", title: "Save Failed", message: "Failed to save invoice record. Please check inputs." });
        }
    } catch (err) {
        console.error("Error linking manual invoice:", err);
        window.showAlertModal({ icon: "❌", title: "Save Error", message: err.message });
    }
};

// ----------------------------------------------------
// SECTION 1 & SECTION 3 MANUAL ENTRY HELPERS
// ----------------------------------------------------

let s1CustomFieldCount = 0;
let s3CustomFieldCount = 0;

window.focusSection1ManualForm = function() {
    const card = document.getElementById("s1-manual-card");
    if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
        const numInput = document.getElementById("ch1-challan-number");
        if (numInput) numInput.focus();
    }
};

window.addSection1CustomField = function() {
    s1CustomFieldCount++;
    const container = document.getElementById("s1-custom-fields-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "form-row";
    row.style.marginBottom = "8px";
    row.id = `s1-custom-row-${s1CustomFieldCount}`;
    row.innerHTML = `
        <div class="form-group" style="flex: 1;">
            <input type="text" class="form-control s1-custom-key" placeholder="Field Name (e.g. Transport Mode)" style="font-size: 0.85rem;">
        </div>
        <div class="form-group" style="flex: 2;">
            <input type="text" class="form-control s1-custom-val" placeholder="Field Value" style="font-size: 0.85rem;">
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('s1-custom-row-${s1CustomFieldCount}').remove()" style="border-color: #EF4444; color: #EF4444; align-self: center; height: 36px;">✖</button>
    `;
    container.appendChild(row);
};

window.handleSection1CameraUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/receiving/upload-file", { method: "POST", body: formData });
        const data = await res.json();
        document.getElementById("ch1-document-path").value = data.document_path || "";
        document.getElementById("ch1-file-badge").style.display = "block";
        document.getElementById("ch1-file-name").textContent = `✅ ${file.name} attached`;
    } catch (err) {
        console.error("Section 1 camera upload error:", err);
    }
};

window.addSection3CustomField = function() {
    s3CustomFieldCount++;
    const container = document.getElementById("s3-manual-custom-fields-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "form-row";
    row.style.marginBottom = "8px";
    row.id = `s3-custom-row-${s3CustomFieldCount}`;
    row.innerHTML = `
        <div class="form-group" style="flex: 1;">
            <input type="text" class="form-control s3-custom-key" placeholder="Field Name (e.g. Terms / Notes)" style="font-size: 0.85rem;">
        </div>
        <div class="form-group" style="flex: 2;">
            <input type="text" class="form-control s3-custom-val" placeholder="Field Value" style="font-size: 0.85rem;">
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('s3-custom-row-${s3CustomFieldCount}').remove()" style="border-color: #EF4444; color: #EF4444; align-self: center; height: 36px;">✖</button>
    `;
    container.appendChild(row);
};

window.handleSection3CameraUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/api/receiving/upload-file", { method: "POST", body: formData });
        const data = await res.json();
        document.getElementById("s3m-document-path").value = data.document_path || "";
        document.getElementById("s3m-file-badge").style.display = "block";
        document.getElementById("s3m-file-name").textContent = `✅ ${file.name} attached`;
    } catch (err) {
        console.error("Section 3 camera upload error:", err);
    }
};

// ----------------------------------------------------
// SECTION 4: ONLY INVOICES INWARD REGISTER (DATE CATEGORIZED)
// ----------------------------------------------------

window.setInvoicesDateQuickFilter = function(filterMode) {
    const input = document.getElementById("invoices-date-filter");
    if (input) input.value = "";
    renderOnlyInvoicesByInwardDate(filterMode);
};

window.filterInvoicesByInwardDate = function(dateVal) {
    renderOnlyInvoicesByInwardDate('CUSTOM', dateVal);
};

window.renderOnlyInvoicesByInwardDate = function(filterMode = 'ALL', customDateStr = '') {
    const container = document.getElementById("invoices-date-grouped-container");
    if (!container) return;
    container.innerHTML = "";

    // 1. Filter ONLY records that contain an Invoice Number
    let invoiceRecords = currentReceivingRecords.filter(r => r.invoice_number && r.invoice_number.trim() !== '');

    const today = new Date();
    today.setHours(0,0,0,0);

    // 2. Apply Date Range Filters if requested
    if (filterMode === 'TODAY') {
        const todayStr = today.toISOString().split('T')[0];
        invoiceRecords = invoiceRecords.filter(r => {
            const inDate = (r.inward_date || r.created_at || r.invoice_date || '').split('T')[0];
            return inDate === todayStr;
        });
    } else if (filterMode === 'THIS_WEEK') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        invoiceRecords = invoiceRecords.filter(r => {
            const inDateStr = (r.inward_date || r.created_at || r.invoice_date || '').split('T')[0];
            const inDate = new Date(inDateStr);
            return inDate >= sevenDaysAgo;
        });
    } else if (filterMode === 'THIS_MONTH') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        invoiceRecords = invoiceRecords.filter(r => {
            const inDateStr = (r.inward_date || r.created_at || r.invoice_date || '').split('T')[0];
            const inDate = new Date(inDateStr);
            return inDate >= startOfMonth;
        });
    } else if (filterMode === 'CUSTOM' && customDateStr) {
        invoiceRecords = invoiceRecords.filter(r => {
            const inDate = (r.inward_date || r.created_at || r.invoice_date || '').split('T')[0];
            return inDate === customDateStr;
        });
    }

    // 3. Update Category Summary Cards
    const totalCount = invoiceRecords.length;
    const totalAmountSum = invoiceRecords.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const uniqueVendors = new Set(invoiceRecords.map(r => r.vendor_name).filter(Boolean)).size;

    const countEl = document.getElementById("invoices-date-total-count");
    if (countEl) countEl.textContent = totalCount;

    const amtEl = document.getElementById("invoices-date-total-amount");
    if (amtEl) amtEl.textContent = `₹ ${totalAmountSum.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    const vendorEl = document.getElementById("invoices-date-vendor-count");
    if (vendorEl) vendorEl.textContent = uniqueVendors;

    if (invoiceRecords.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 30px; color: var(--text-muted);">
                <span style="font-size: 2rem; display: block; margin-bottom: 8px;">📂</span>
                <strong>No Inward Invoices Documented for this Date Category</strong>
                <p style="font-size: 0.85rem; margin-top: 4px;">Try selecting 'All Dates' or choosing a different Inward Receipt Date.</p>
            </div>
        `;
        return;
    }

    // 4. Group Invoices strictly by Inward Date (YYYY-MM-DD)
    const groupedByDate = {};
    invoiceRecords.forEach(r => {
        let inDateStr = (r.inward_date || r.created_at || r.invoice_date || '').split('T')[0];
        if (!inDateStr || inDateStr.length < 10) inDateStr = "Date Not Specified";
        if (!groupedByDate[inDateStr]) groupedByDate[inDateStr] = [];
        groupedByDate[inDateStr].push(r);
    });

    // 5. Sort Date Keys Descending (most recent dates first)
    const sortedDates = Object.keys(groupedByDate).sort((a,b) => b.localeCompare(a));

    sortedDates.forEach(dateStr => {
        const groupRecords = groupedByDate[dateStr];
        const groupTotalSum = groupRecords.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);

        const card = document.createElement("div");
        card.className = "card";
        card.style.marginBottom = "20px";
        card.style.borderLeft = "5px solid #2563EB";
        card.style.background = "#FFFFFF";

        // Card Header
        let formattedDateLabel = dateStr;
        try {
            if (dateStr !== "Date Not Specified") {
                const dObj = new Date(dateStr + "T00:00:00");
                formattedDateLabel = dObj.toLocaleDateString("en-IN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
        } catch(e) {}

        let rowsHtml = "";
        groupRecords.forEach(r => {
            const fields = r.extracted_fields || {};
            const challanNum = r.challan_number || fields["Challan Number"] || fields["Linked Challan Number"] || "N/A";
            const invDocPath = r.document_path || "";
            
            let docBtn = invDocPath 
                ? `<a href="${invDocPath}" target="_blank" class="btn btn-outline btn-sm" style="border-color: #2563EB; color: #2563EB; font-size: 0.75rem; font-weight: 600;">📄 View Invoice</a>`
                : `<span style="font-size: 0.75rem; color: var(--text-muted);">No File</span>`;

            rowsHtml += `
                <tr>
                    <td><strong>${r.invoice_number}</strong></td>
                    <td><span class="badge" style="background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;">${challanNum}</span></td>
                    <td>${r.vendor_name || 'N/A'}</td>
                    <td><span style="color:#2563EB; font-weight:600;">${dateStr}</span></td>
                    <td>${r.due_date || 'N/A'}</td>
                    <td><strong>₹ ${ (parseFloat(r.total_amount) || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}) }</strong></td>
                    <td>${docBtn}</td>
                    <td>${getStatusBadge(r.status, r)}</td>
                    <td>
                        <button class="btn btn-outline btn-sm" style="border-color: var(--semco-blue); color: var(--semco-blue);" onclick="previewReceivingRecord('${r.id}')">👁️ Preview</button>
                    </td>
                </tr>
            `;
        });

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h3 style="margin: 0; color: #1E40AF; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                        📅 Inward Receipt Date: ${formattedDateLabel}
                    </h3>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Iso Date: ${dateStr}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span class="badge" style="background: #DBEAFE; color: #1E40AF; border: 1px solid #93C5FD; font-size: 0.85rem; padding: 6px 12px;">
                        📦 ${groupRecords.length} Invoice${groupRecords.length > 1 ? 's' : ''} Documented
                    </span>
                    <span class="badge" style="background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; font-size: 0.85rem; padding: 6px 12px;">
                        💰 Total: ₹ ${groupTotalSum.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </span>
                </div>
            </div>

            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Challan #</th>
                            <th>Vendor Name</th>
                            <th>Inward Receipt Date</th>
                            <th>Due Date</th>
                            <th>Invoice Amount (₹)</th>
                            <th>Document</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(card);
    });
};
