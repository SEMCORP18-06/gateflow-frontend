// Module 1: SEMCO Purchase Orders (PO Preparation & Approval Workflow)

let currentPurchaseOrders = [];
let DEFAULT_PORTAL_PROJECTS = [
    {
        "project_no": "PRJ-SEM-2026-101",
        "project_name": "Vacuum Distillation Unit Package - Thermax Ltd",
        "client_name": "Thermax Limited - Process Heat Division",
        "quotation_ref": "QTN-2026-042",
        "quotation_mode": "EMAIL",
        "vendor_name": "ABC Engineering Solutions Pvt. Ltd.",
        "vendor_address": "Plot No. 45, Sector 7, MIDC, Bhosari, Pune - 411026",
        "vendor_gstin": "27ABCDE1234F1Z5",
        "consignee_name": "SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD",
        "ship_address": "Opposite Arya Industries, Gat No 63, Dehu-Alandi Road Talwade, Pune, 411062",
        "ship_gstin": "27ABRCS0246H1Z3",
        "payment_terms": "30 Days after Delivery & Acceptance",
        "freight_terms": "Paid by Vendor",
        "mode_of_dispatch": "Road Transport / Courier",
        "line_items": [
            { "line_no": 1, "goods_description": "High Vacuum Pump Assembly 10G (Thermax Spec)", "project_no": "PRJ-SEM-2026-101", "hsn_sac": "8414", "qty": 2, "uom": "Nos", "base_rate": 45000, "gst_percent": 18, "amount": 90000 },
            { "line_no": 2, "goods_description": "Stainless Steel Flange 4 Inch ANSI B16.5 150#", "project_no": "PRJ-SEM-2026-101", "hsn_sac": "7307", "qty": 10, "uom": "Nos", "base_rate": 1200, "gst_percent": 18, "amount": 12000 },
            { "line_no": 3, "goods_description": "Digital Vacuum Gauge Controller (Dual Sensor)", "project_no": "PRJ-SEM-2026-101", "hsn_sac": "9026", "qty": 1, "uom": "Nos", "base_rate": 15000, "gst_percent": 18, "amount": 15000 }
        ]
    },
    {
        "project_no": "PRJ-SEM-2026-102",
        "project_name": "Bio-Ethanol Evaporator Skid - Praj Industries",
        "client_name": "Praj Industries Ltd - Brewery & Bioenergy",
        "quotation_ref": "QTN-2026-088",
        "quotation_mode": "PORTAL",
        "vendor_name": "Vacuumtech Components & Systems",
        "vendor_address": "Gat No 120, Chakan Industrial Area, Phase 2, Pune - 410501",
        "vendor_gstin": "27VACUA9988E1Z9",
        "consignee_name": "SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD",
        "ship_address": "Opposite Arya Industries, Gat No 63, Dehu-Alandi Road Talwade, Pune, 411062",
        "ship_gstin": "27ABRCS0246H1Z3",
        "payment_terms": "45 Days net",
        "freight_terms": "FOB Factory",
        "mode_of_dispatch": "Heavy Commercial Transport",
        "line_items": [
            { "line_no": 1, "goods_description": "Rotary Vane Vacuum Pump 25 CFM Heavy Duty", "project_no": "PRJ-SEM-2026-102", "hsn_sac": "8414", "qty": 3, "uom": "Nos", "base_rate": 68000, "gst_percent": 18, "amount": 204000 },
            { "line_no": 2, "goods_description": "Reinforced Vacuum Hose 2 Inch (Wire Embedded)", "project_no": "PRJ-SEM-2026-102", "hsn_sac": "3917", "qty": 50, "uom": "Mtr", "base_rate": 650, "gst_percent": 18, "amount": 32500 }
        ]
    },
    {
        "project_no": "PRJ-992",
        "project_name": "Steam Condensate Vacuum Package - Forbes Marshall",
        "client_name": "Forbes Marshall Pvt Ltd",
        "quotation_ref": "QTN-2026-104",
        "quotation_mode": "MAIL",
        "vendor_name": "Precision Machined Components Ltd",
        "vendor_address": "W-12, MIDC Ambad, Nashik - 422010",
        "vendor_gstin": "27PRECI4567K1Z2",
        "consignee_name": "SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD",
        "ship_address": "Dehu-Alandi Road Talwade, Pune, 411062",
        "ship_gstin": "27ABRCS0246H1Z3",
        "payment_terms": "30 Days after Delivery",
        "freight_terms": "Paid by Vendor",
        "mode_of_dispatch": "Road Transport",
        "line_items": [
            { "line_no": 1, "goods_description": "Stainless Steel Vacuum Chamber 500L SS316L", "project_no": "PRJ-992", "hsn_sac": "7309", "qty": 1, "uom": "Set", "base_rate": 220000, "gst_percent": 18, "amount": 220000 },
            { "line_no": 2, "goods_description": "Thermodynamic High Pressure Steam Traps 1/2 Inch", "project_no": "PRJ-992", "hsn_sac": "8481", "qty": 12, "uom": "Pcs", "base_rate": 8500, "gst_percent": 18, "amount": 102000 }
        ]
    },
    {
        "project_no": "PRJ-995",
        "project_name": "Hygienic Flow Automation - Alfa Laval",
        "client_name": "Alfa Laval India Pvt Ltd",
        "quotation_ref": "QTN-2026-115",
        "quotation_mode": "DIRECT",
        "vendor_name": "PneuTech Automation & Controls",
        "vendor_address": "F-55, Phase II, MIDC Chakan, Pune - 410501",
        "vendor_gstin": "27PNEUT1234M1Z1",
        "consignee_name": "SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD",
        "ship_address": "Dehu-Alandi Road Talwade, Pune, 411062",
        "ship_gstin": "27ABRCS0246H1Z3",
        "payment_terms": "15 Days after Inspection",
        "freight_terms": "Door Delivery",
        "mode_of_dispatch": "Express Road Logistics",
        "line_items": [
            { "line_no": 1, "goods_description": "Pneumatic Control Valve Assembly 3 Inch Tri-Clamp", "project_no": "PRJ-995", "hsn_sac": "8481", "qty": 4, "uom": "Set", "base_rate": 34000, "gst_percent": 18, "amount": 136000 }
        ]
    }
];

let portalProjectsCache = [...DEFAULT_PORTAL_PROJECTS];

let poLineItems = [
    { line_no: 1, goods_description: "High Vacuum Pump Assembly 10G", project_no: "PRJ-SEM-2026-101", hsn_sac: "8414", qty: 2, uom: "Nos", base_rate: 45000, gst_percent: 18, amount: 90000 },
    { line_no: 2, goods_description: "Stainless Steel Flange 4 Inch", project_no: "PRJ-SEM-2026-101", hsn_sac: "7307", qty: 10, uom: "Nos", base_rate: 1200, gst_percent: 18, amount: 12000 },
    { line_no: 3, goods_description: "Digital Vacuum Gauge Controller", project_no: "PRJ-SEM-2026-101", hsn_sac: "9026", qty: 1, uom: "Nos", base_rate: 15000, gst_percent: 18, amount: 15000 }
];

// Fetch active project numbers & PO autofill packages from semcorpemp portal
window.fetchPortalProjects = async function() {
    try {
        const res = await fetch('/api/external-projects');
        if (res.ok) {
            const data = await res.json();
            if (data.projects && data.projects.length > 0) {
                portalProjectsCache = data.projects;
                populatePortalProjectDropdown(portalProjectsCache);
            }
        }
    } catch (err) {
        console.error("Error fetching external portal projects:", err);
    }
};

// Populate the Project Selection Dropdown in PO Preparation Section
function populatePortalProjectDropdown(projects) {
    const select = document.getElementById('semco-po-project-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose Project Number from semcorpemp.vercel.app --</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.project_no;
        opt.textContent = `${p.project_no} — ${p.project_name || p.client_name}`;
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
}

// Automatically autofill Purchase Order fields when a Project Number is selected
window.onPOProjectNumberSelect = function(projectNo) {
    if (!projectNo) return;

    let proj = portalProjectsCache.find(p => p.project_no === projectNo);
    if (!proj) {
        proj = DEFAULT_PORTAL_PROJECTS.find(p => p.project_no === projectNo);
    }
    if (!proj) return;

    // 1. Autofill Header Metadata
    const poNoInput = document.getElementById('semco-po-no');
    if (poNoInput) {
        const cleanNo = projectNo.replace(/[^0-9A-Z]/gi, '');
        poNoInput.value = `26/27 - ${cleanNo.slice(-6)}`;
    }

    const quotRefInput = document.getElementById('semco-po-quot-no');
    if (quotRefInput && proj.quotation_ref) quotRefInput.value = proj.quotation_ref;

    const quotModeInput = document.getElementById('semco-po-quot-mode');
    if (quotModeInput && proj.quotation_mode) quotModeInput.value = proj.quotation_mode;

    // 2. Autofill Vendor Details
    const vendorNameInput = document.getElementById('semco-vendor-name');
    if (vendorNameInput && proj.vendor_name) vendorNameInput.value = proj.vendor_name;

    const vendorAddrInput = document.getElementById('semco-vendor-address');
    if (vendorAddrInput && proj.vendor_address) vendorAddrInput.value = proj.vendor_address;

    const vendorGstInput = document.getElementById('semco-vendor-gst');
    if (vendorGstInput && proj.vendor_gstin) vendorGstInput.value = proj.vendor_gstin;

    // 3. Autofill Ship To / Consignee Details
    const shipNameInput = document.getElementById('semco-ship-name');
    if (shipNameInput && proj.consignee_name) shipNameInput.value = proj.consignee_name;

    const shipAddrInput = document.getElementById('semco-ship-address');
    if (shipAddrInput && proj.ship_address) shipAddrInput.value = proj.ship_address;

    const shipGstInput = document.getElementById('semco-ship-gst');
    if (shipGstInput && proj.ship_gstin) shipGstInput.value = proj.ship_gstin;

    // 4. Autofill Terms & Conditions
    const termPaymentInput = document.getElementById('semco-term-payment');
    if (termPaymentInput && proj.payment_terms) termPaymentInput.value = proj.payment_terms;

    const termFreightInput = document.getElementById('semco-term-freight');
    if (termFreightInput && proj.freight_terms) termFreightInput.value = proj.freight_terms;

    const termDispatchInput = document.getElementById('semco-term-dispatch-mode');
    if (termDispatchInput && proj.mode_of_dispatch) termDispatchInput.value = proj.mode_of_dispatch;

    // 5. Replace Line Items with Selected Project Line Items
    if (proj.line_items && proj.line_items.length > 0) {
        poLineItems = JSON.parse(JSON.stringify(proj.line_items));
        renderPOLineItemsTable();
    }

    if (window.showAlertModal) {
        window.showAlertModal({
            icon: "✨",
            title: `PO Autofilled for ${projectNo}`,
            message: `PO details, line items, and terms autofilled for project ${projectNo} (${proj.client_name}) synced from semcorpemp.vercel.app!`
        });
    }
};

window.triggerAutoFillSelectedProject = function() {
    const select = document.getElementById('semco-po-project-select');
    let val = select ? select.value : "";
    if (!val && portalProjectsCache.length > 0) {
        val = portalProjectsCache[0].project_no;
        if (select) select.value = val;
    }
    if (val) {
        onPOProjectNumberSelect(val);
    } else {
        if (window.showAlertModal) {
            window.showAlertModal({
                icon: "⚠️",
                title: "Select Project Number",
                message: "Please choose a Project Number from the dropdown list to autofill the Purchase Order."
            });
        }
    }
};

window.fetchPurchaseOrders = async function() {
    try {
        const res = await fetch('/api/pos');
        currentPurchaseOrders = await res.json();
        renderPOTables(currentPurchaseOrders);
        populatePODropdowns(currentPurchaseOrders);
    } catch (err) {
        console.error("Error fetching purchase orders:", err);
    }
};

window.switchPOSubTab = function(subKey) {
    if (subKey === 'appr') subKey = 'repo';
    const target = document.getElementById(`po-section-${subKey}`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const prepBtn = document.getElementById('po-subnav-prep');
    const repoBtn = document.getElementById('po-subnav-repo');

    if (prepBtn) {
        if (subKey === 'prep') {
            prepBtn.className = 'btn btn-primary';
            prepBtn.style.background = 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)';
            prepBtn.style.color = 'white';
        } else {
            prepBtn.className = 'btn btn-outline';
            prepBtn.style.background = 'white';
            prepBtn.style.color = '#1E3A8A';
        }
    }
    if (repoBtn) {
        if (subKey === 'repo') {
            repoBtn.className = 'btn btn-primary';
            repoBtn.style.background = 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)';
            repoBtn.style.color = 'white';
        } else {
            repoBtn.className = 'btn btn-outline';
            repoBtn.style.background = 'white';
            repoBtn.style.color = '#2563EB';
        }
    }
};

// Render Line Items in SEMCO PO Builder Form
window.renderPOLineItemsTable = function() {
    const tbody = document.getElementById('semco-po-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    poLineItems.forEach((item, index) => {
        item.line_no = index + 1;
        item.amount = (parseFloat(item.qty) || 0) * (parseFloat(item.base_rate) || 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; font-weight: 700; color: #1E3A8A;">${item.line_no}</td>
            <td><input type="text" class="form-control form-control-sm" value="${item.goods_description || ''}" onchange="updatePOLineItem(${index}, 'goods_description', this.value)"></td>
            <td><input type="text" class="form-control form-control-sm" value="${item.project_no || ''}" onchange="updatePOLineItem(${index}, 'project_no', this.value)"></td>
            <td><input type="text" class="form-control form-control-sm" value="${item.hsn_sac || ''}" onchange="updatePOLineItem(${index}, 'hsn_sac', this.value)"></td>
            <td><input type="number" class="form-control form-control-sm" value="${item.qty || 0}" style="text-align: center;" oninput="updatePOLineItem(${index}, 'qty', this.value)"></td>
            <td>
                <select class="form-control form-control-sm" onchange="updatePOLineItem(${index}, 'uom', this.value)">
                    <option value="Nos" ${item.uom === 'Nos' ? 'selected' : ''}>Nos</option>
                    <option value="Kg" ${item.uom === 'Kg' ? 'selected' : ''}>Kg</option>
                    <option value="Mtr" ${item.uom === 'Mtr' ? 'selected' : ''}>Mtr</option>
                    <option value="Set" ${item.uom === 'Set' ? 'selected' : ''}>Set</option>
                    <option value="Pcs" ${item.uom === 'Pcs' ? 'selected' : ''}>Pcs</option>
                    <option value="Lot" ${item.uom === 'Lot' ? 'selected' : ''}>Lot</option>
                </select>
            </td>
            <td><input type="number" step="0.01" class="form-control form-control-sm" value="${item.base_rate || 0}" style="text-align: right;" oninput="updatePOLineItem(${index}, 'base_rate', this.value)"></td>
            <td>
                <select class="form-control form-control-sm" onchange="updatePOLineItem(${index}, 'gst_percent', this.value)">
                    <option value="18" ${item.gst_percent == 18 ? 'selected' : ''}>18%</option>
                    <option value="12" ${item.gst_percent == 12 ? 'selected' : ''}>12%</option>
                    <option value="5" ${item.gst_percent == 5 ? 'selected' : ''}>5%</option>
                    <option value="28" ${item.gst_percent == 28 ? 'selected' : ''}>28%</option>
                    <option value="0" ${item.gst_percent == 0 ? 'selected' : ''}>0%</option>
                </select>
            </td>
            <td style="text-align: right; font-weight: 700; color: #1E3A8A;">₹ ${item.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td style="text-align: center;">
                <button type="button" class="btn btn-outline btn-sm" style="border:none; color:#EF4444; padding:2px 6px;" onclick="deletePOLineItemRow(${index})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    recalculateSEMCOTotals();
};

window.addPOLineItemRow = function() {
    poLineItems.push({
        line_no: poLineItems.length + 1,
        goods_description: "",
        project_no: "PRJ-992",
        hsn_sac: "8414",
        qty: 1,
        uom: "Nos",
        base_rate: 0,
        gst_percent: 18,
        amount: 0
    });
    renderPOLineItemsTable();
};

window.deletePOLineItemRow = function(index) {
    if (poLineItems.length <= 1) {
        window.showAlertModal({ icon: "⚠️", title: "Action Restricted", message: "A Purchase Order must contain at least 1 line item." });
        return;
    }
    poLineItems.splice(index, 1);
    renderPOLineItemsTable();
};

window.updatePOLineItem = function(index, field, val) {
    if (field === 'qty' || field === 'base_rate' || field === 'gst_percent') {
        poLineItems[index][field] = parseFloat(val) || 0;
    } else {
        poLineItems[index][field] = val;
    }
    renderPOLineItemsTable();
};

// Recalculate Subtotal, Freight, P&F, Taxes, Grand Total & Rupees in Words
window.recalculateSEMCOTotals = function() {
    let totalQty = 0;
    let subTotal = 0;
    let totalTaxAmount = 0;

    poLineItems.forEach(item => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.base_rate) || 0;
        const gst = parseFloat(item.gst_percent) || 18;

        const lineAmount = qty * rate;
        totalQty += qty;
        subTotal += lineAmount;
        totalTaxAmount += (lineAmount * gst / 100);
    });

    const freight = parseFloat(document.getElementById('semco-input-freight')?.value) || 0;
    const pfCharges = parseFloat(document.getElementById('semco-input-pf')?.value) || 0;

    // Tax calculation on (subTotal + freight + pfCharges)
    const taxableBase = subTotal + freight + pfCharges;
    const igstAmount = (taxableBase * 0.18); // Default 18% IGST
    const grandTotal = taxableBase + igstAmount;

    // Update DOM Display
    const qtyEl = document.getElementById('semco-calc-total-qty');
    if (qtyEl) qtyEl.textContent = totalQty;

    const subEl = document.getElementById('semco-calc-subtotal');
    if (subEl) subEl.textContent = `₹ ${subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    const taxEl = document.getElementById('semco-calc-tax');
    if (taxEl) taxEl.textContent = `₹ ${igstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    const grandEl = document.getElementById('semco-calc-grandtotal');
    if (grandEl) grandEl.textContent = `₹ ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    const wordsDisplay = document.getElementById('semco-amount-words-display');
    if (wordsDisplay) wordsDisplay.textContent = convertNumberToIndianWords(Math.round(grandTotal));
};

// Convert Number to Indian Rupees Text (e.g. 140060 -> Indian Rupees One Lakh Forty Thousand Sixty Only)
function convertNumberToIndianWords(num) {
    if (!num || num === 0) return "Indian Rupees Zero Only";
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
        if ((n = n.toString()).length > 9) return 'overflow';
        let nStr = ('000000000' + n).substr(-9);
        let nArr = nStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!nArr) return '';
        let str = '';
        str += (nArr[1] != 0) ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'Crore ' : '';
        str += (nArr[2] != 0) ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'Lakh ' : '';
        str += (nArr[3] != 0) ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'Thousand ' : '';
        str += (nArr[4] != 0) ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'Hundred ' : '';
        str += (nArr[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
        return str;
    }

    return `Indian Rupees ${inWords(num).trim()} Only`;
}

// Handle Form Submission for SEMCO PO Builder
window.handleSEMCAPOBuilderSubmit = function(e) {
    e.preventDefault();
    saveSEMCOPO('SUBMIT');
};

window.saveSEMCOPO = async function(actionType = 'SUBMIT') {
    const poNo = document.getElementById('semco-po-no')?.value;
    const poDate = document.getElementById('semco-po-date')?.value;
    const vendorName = document.getElementById('semco-vendor-name')?.value;
    const vendorGst = document.getElementById('semco-vendor-gst')?.value;

    if (!poNo || !vendorName || !vendorGst) {
        window.showAlertModal({ icon: "⚠️", title: "Missing Information", message: "Please fill in PO No, Vendor Name, and Vendor GST No." });
        return;
    }

    let subTotal = 0;
    poLineItems.forEach(item => {
        subTotal += (parseFloat(item.qty) || 0) * (parseFloat(item.base_rate) || 0);
    });

    const freight = parseFloat(document.getElementById('semco-input-freight')?.value) || 0;
    const pfCharges = parseFloat(document.getElementById('semco-input-pf')?.value) || 0;
    const igstAmount = (subTotal + freight + pfCharges) * 0.18;
    const grandTotal = subTotal + freight + pfCharges + igstAmount;

    const payload = {
        po_number: poNo,
        po_date: poDate || new Date().toISOString().split('T')[0],
        quotation_ref: document.getElementById('semco-po-quot-no')?.value || "QTN-2026-042",
        mobile_no: document.getElementById('semco-po-mobile')?.value || "9684011614",
        email_id: document.getElementById('semco-po-email')?.value || "umesh.p@semcogroups.com",
        amendment_no: document.getElementById('semco-po-amend-no')?.value || "-",
        amendment_date: document.getElementById('semco-po-amend-date')?.value || "-",
        vendor_name: vendorName,
        vendor_address: document.getElementById('semco-vendor-address')?.value || "",
        vendor_gstin: vendorGst,
        consignee_name: document.getElementById('semco-ship-name')?.value || "SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD",
        ship_address: document.getElementById('semco-ship-address')?.value || "",
        ship_gstin: document.getElementById('semco-ship-gst')?.value || "27ABRCS0246H1Z3",
        line_items: poLineItems,
        total_qty: poLineItems.reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0),
        sub_total: subTotal,
        freight: freight,
        pf_charges: pfCharges,
        igst_amount: igstAmount,
        grand_total: grandTotal,
        amount_in_words: convertNumberToIndianWords(Math.round(grandTotal)),
        payment_terms: document.getElementById('semco-term-payment')?.value || "30 Days after Delivery",
        freight_terms: document.getElementById('semco-term-freight')?.value || "Paid by Vendor",
        mode_of_dispatch: document.getElementById('semco-term-dispatch-mode')?.value || "Road Transport",
        inspection_terms: document.getElementById('semco-term-inspection')?.value || "Before Dispatch",
        delivery_terms: document.getElementById('semco-term-delivery')?.value || "Door Delivery",
        remarks: document.getElementById('semco-term-remarks')?.value || "",
        action: actionType,
        prepared_by: {
            name: "Mr. Umesh H. Patil",
            email: "poprep@semco.com",
            date: new Date().toISOString().split('T')[0]
        }
    };

    try {
        const res = await fetch("/api/pos/save-builder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const saved = await res.json();
            let titleMsg = "PO Saved";
            let bodyMsg = `Purchase Order #${saved.po_number} saved.`;

            if (actionType === 'SUBMIT') {
                titleMsg = "🚀 PO Submitted for Approval";
                bodyMsg = `Purchase Order #${saved.po_number} for ${saved.vendor_name} (Grand Total: ₹${(saved.grand_total || saved.total_amount || 0).toLocaleString('en-IN')}) submitted for approval! You can inspect, view PDF, or authorize it directly from the table below.`;
            } else if (actionType === 'SAVE_DRAFT') {
                titleMsg = "💾 PO Draft Saved";
                bodyMsg = `Draft Purchase Order #${saved.po_number} saved.`;
            }

            window.showAlertModal({ icon: "✅", title: titleMsg, message: bodyMsg });
            fetchPurchaseOrders();
            switchPOSubTab('repo');
        } else {
            window.showAlertModal({ icon: "❌", title: "Save Error", message: "Failed to save Purchase Order." });
        }
    } catch (err) {
        console.error("PO Save error:", err);
    }
};

// Render Unified Master PO Repository & Approval Table
function renderPOTables(pos) {
    const repoTbody = document.getElementById('po-table-body');
    const pendingCountBadge = document.getElementById('po-pending-approval-badge');
    const countBadge = document.getElementById('po-count-badge');

    const pending = pos.filter(p => p.status === 'SUBMITTED_FOR_APPROVAL');
    if (pendingCountBadge) pendingCountBadge.textContent = `${pending.length} Pending Approval`;
    if (countBadge) countBadge.textContent = `${pos.length} POs`;

    // Render Master Repository Table
    if (repoTbody) {
        repoTbody.innerHTML = '';
        if (pos.length === 0) {
            repoTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 24px;">📋 No Purchase Orders found in repository.</td></tr>`;
        } else {
            pos.forEach(p => {
                let badgeClass = "badge-draft";
                let statusLabel = p.status || "DRAFT";

                if (p.status === "APPROVED") {
                    badgeClass = "badge-verified";
                    statusLabel = "✅ APPROVED";
                } else if (p.status === "SUBMITTED_FOR_APPROVAL") {
                    badgeClass = "badge-pending";
                    statusLabel = "⏳ PENDING APPROVAL";
                } else if (p.status === "REJECTED") {
                    badgeClass = "badge-overdue";
                    statusLabel = "❌ REJECTED";
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong style="color: #1E3A8A; font-size: 0.95rem;">${p.po_number}</strong></td>
                    <td><strong>${p.vendor_name || p.vendor_client_name}</strong></td>
                    <td>${p.po_date}</td>
                    <td><span class="badge" style="background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;">${p.payment_terms || '30 Days'}</span></td>
                    <td><strong style="color: #15803D;">₹ ${(p.grand_total || p.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
                    <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                    <td>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button type="button" class="btn btn-outline btn-sm" style="border-color: #1E3A8A; color: #1E3A8A; font-weight: 600;" onclick="openSEMCOPOPrintView('${p.id}')">📄 View & Print PO</button>
                            ${p.status !== 'APPROVED' ? `<button type="button" class="btn btn-outline btn-sm" style="border-color: #059669; color: #059669; font-weight: 700;" onclick="approvePO('${p.id}')">✅ Quick Approve</button>` : ''}
                            <button type="button" class="btn btn-outline btn-sm" style="border-color: #059669; color: #059669;" onclick="openPODeepAuditModal('${p.po_number}')">💳 Audit Payments</button>
                            <button type="button" class="btn btn-outline btn-sm" style="border-color: #EF4444; color: #EF4444;" onclick="deletePurchaseOrder('${p.id}')">🗑️ Delete</button>
                        </div>
                    </td>
                `;
                repoTbody.appendChild(tr);
            });
        }
    }
}

window.approvePO = async function(poId) {
    try {
        const res = await fetch(`/api/pos/${poId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approver_name: "Authorised Signatory", notes: "Approved by Signatory Desk" })
        });
        if (res.ok) {
            const updatedPo = await res.json();
            const idx = currentPurchaseOrders.findIndex(p => p.id === poId || (updatedPo && p.id === updatedPo.id));
            if (idx !== -1 && updatedPo) {
                currentPurchaseOrders[idx] = updatedPo;
            }
            renderPOTables(currentPurchaseOrders);
            switchPOSubTab('repo');
            window.showAlertModal({ icon: "✅", title: "PO Approved", message: "Purchase Order has been APPROVED and signed!" });
            fetchPurchaseOrders();
        }
    } catch (err) {
        console.error("Approve PO error:", err);
    }
};

window.rejectPO = async function(poId) {
    const reason = prompt("Enter Rejection Reason / Revision Notes:");
    if (reason === null) return;

    try {
        const res = await fetch(`/api/pos/${poId}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason || "Revision required" })
        });
        if (res.ok) {
            const updatedPo = await res.json();
            const idx = currentPurchaseOrders.findIndex(p => p.id === poId || (updatedPo && p.id === updatedPo.id));
            if (idx !== -1 && updatedPo) {
                currentPurchaseOrders[idx] = updatedPo;
            }
            renderPOTables(currentPurchaseOrders);
            switchPOSubTab('repo');
            window.showAlertModal({ icon: "❌", title: "PO Rejected", message: "Purchase Order set to REJECTED." });
            fetchPurchaseOrders();
        }
    } catch (err) {
        console.error("Reject PO error:", err);
    }
};

window.deletePurchaseOrder = async function(poId) {
    if (!confirm("Are you sure you want to delete this Purchase Order?")) return;
    try {
        const res = await fetch(`/api/pos/${poId}`, { method: "DELETE" });
        if (res.ok) {
            currentPurchaseOrders = currentPurchaseOrders.filter(p => p.id !== poId);
            renderPOTables(currentPurchaseOrders);
            switchPOSubTab('repo');
            window.showAlertModal({ icon: "🗑️", title: "PO Deleted", message: "Purchase Order has been removed." });
            fetchPurchaseOrders();
        }
    } catch (err) {
        console.error("Delete PO error:", err);
    }
};

// Printable SEMCO Formatted PO Document Modal
window.openSEMCOPOPrintView = function(poId) {
    const po = currentPurchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const modal = document.getElementById("semco-po-preview-modal");
    const modalTitle = document.getElementById("semco-po-modal-title");
    const modalBody = document.getElementById("semco-po-modal-body");

    if (!modal || !modalBody) return;

    if (modalTitle) modalTitle.textContent = `Official SEMCO Purchase Order #${po.po_number}`;

    let itemsRows = "";
    const items = po.line_items || poLineItems;
    items.forEach(item => {
        itemsRows += `
            <tr>
                <td style="text-align:center; padding:6px; border:1px solid #CBD5E1;">${item.line_no}</td>
                <td style="padding:6px; border:1px solid #CBD5E1;">${item.goods_description}</td>
                <td style="padding:6px; border:1px solid #CBD5E1;">${item.project_no || ''}</td>
                <td style="padding:6px; border:1px solid #CBD5E1;">${item.hsn_sac || ''}</td>
                <td style="text-align:center; padding:6px; border:1px solid #CBD5E1;">${item.qty}</td>
                <td style="text-align:center; padding:6px; border:1px solid #CBD5E1;">${item.uom || 'Nos'}</td>
                <td style="text-align:right; padding:6px; border:1px solid #CBD5E1;">₹ ${(item.base_rate || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                <td style="text-align:center; padding:6px; border:1px solid #CBD5E1;">${item.gst_percent || 18}%</td>
                <td style="text-align:right; padding:6px; border:1px solid #CBD5E1; font-weight:700;">₹ ${(item.amount || (item.qty * item.base_rate) || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
            </tr>
        `;
    });

    const printHtml = `
        <div id="semco-printable-po-doc" style="background: white; border: 2px solid #0F172A; padding: 20px; font-family: Arial, sans-serif; text-align: left; box-sizing: border-box; overflow-x: hidden;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F172A; padding-bottom: 10px; margin-bottom: 12px;">
                <img src="/static/assets/semco_logo.png" style="height: 48px;">
                <div style="text-align: right; font-size: 0.8rem;">
                    <h3 style="margin: 0; color: #1E3A8A; font-size: 1.1rem; font-weight: 800;">SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD</h3>
                    <div style="font-style: italic;">Office: ACE Aurum 2, Office No. A-302, Ravet, Pune - 411033 MH, India</div>
                    <div style="font-style: italic;">Factory: Opposite Arya Industries, Gat No 63, Dehu-Alandi Road Talwade, Pune, 411062</div>
                </div>
            </div>

            <div style="background: #1E3A8A; color: white; text-align: center; font-weight: 800; font-size: 1.1rem; padding: 6px; text-transform: uppercase; margin-bottom: 12px;">
                PURCHASE ORDER
            </div>

            <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 12px;">
                <div style="font-size: 0.85rem; color: #475569;">Date Generated: <strong>${po.po_date}</strong></div>
            </div>

            <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:0.82rem; border:1px solid #CBD5E1;">
                <tr style="background:#F8FAFC;">
                    <td style="padding:6px; border:1px solid #CBD5E1;"><strong>PO No:</strong> ${po.po_number}</td>
                    <td style="padding:6px; border:1px solid #CBD5E1;"><strong>Quotation Ref:</strong> ${po.quotation_ref || 'QTN-2026-042'}</td>
                    <td style="padding:6px; border:1px solid #CBD5E1;"><strong>Mobile / Email:</strong> ${po.mobile_no || '9684011614'} | ${po.email_id || 'umesh.p@semcogroups.com'}</td>
                </tr>
            </table>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; font-size: 0.82rem;">
                <div style="border: 1px solid #1E3A8A; padding: 8px;">
                    <strong style="color: #1E3A8A; display: block; border-bottom: 1px solid #1E3A8A; padding-bottom: 4px; margin-bottom: 4px;">VENDOR DETAILS</strong>
                    <div><strong>${po.vendor_name || po.vendor_client_name}</strong></div>
                    <div>${po.vendor_address || 'MIDC, Bhosari, Pune - 411026'}</div>
                    <div style="margin-top:4px;"><strong>GST NO:</strong> ${po.vendor_gstin || '27ABCDE1234F1Z5'}</div>
                </div>
                <div style="border: 1px solid #1E3A8A; padding: 8px;">
                    <strong style="color: #1E3A8A; display: block; border-bottom: 1px solid #1E3A8A; padding-bottom: 4px; margin-bottom: 4px;">SHIP TO DETAILS</strong>
                    <div><strong>${po.consignee_name || 'SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD'}</strong></div>
                    <div>${po.ship_address || 'Dehu-Alandi Road Talwade, Pune, 411062'}</div>
                    <div style="margin-top:4px;"><strong>GST NO:</strong> ${po.ship_gstin || '27ABRCS0246H1Z3'}</div>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:0.8rem; border:1px solid #CBD5E1;">
                <thead style="background:#1E3A8A; color:white;">
                    <tr>
                        <th style="padding:6px;">Line</th>
                        <th style="padding:6px;">Description of Goods</th>
                        <th style="padding:6px;">Project No</th>
                        <th style="padding:6px;">HSN/SAC</th>
                        <th style="padding:6px;">Qty</th>
                        <th style="padding:6px;">UOM</th>
                        <th style="padding:6px;">Base Rate</th>
                        <th style="padding:6px;">GST%</th>
                        <th style="padding:6px;">Amount (INR)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; font-size: 0.82rem;">
                <div style="flex:1;">
                    <div style="background:#F1F5F9; padding:8px; border:1px solid #CBD5E1; font-style:italic; margin-bottom:8px;">
                        <strong>Amount in words:</strong> ${po.amount_in_words || convertNumberToIndianWords(Math.round(po.grand_total || po.total_amount || 0))}
                    </div>
                    <div><strong>Attachments:</strong> ${po.attachments || 'Technical Specifications Annexure-A.pdf'}</div>
                </div>
                <div style="width:260px; border:1px solid #CBD5E1; font-size:0.82rem;">
                    <div style="display:flex; justify-content:space-between; padding:4px 8px; border-bottom:1px solid #CBD5E1;"><span>Subtotal:</span><strong>₹ ${(po.sub_total || po.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></div>
                    <div style="display:flex; justify-content:space-between; padding:4px 8px; border-bottom:1px solid #CBD5E1;"><span>Freight:</span><span>₹ ${(po.freight || 1500).toLocaleString('en-IN', {minimumFractionDigits:2})}</span></div>
                    <div style="display:flex; justify-content:space-between; padding:4px 8px; border-bottom:1px solid #CBD5E1;"><span>P&F:</span><span>₹ ${(po.pf_charges || 500).toLocaleString('en-IN', {minimumFractionDigits:2})}</span></div>
                    <div style="display:flex; justify-content:space-between; padding:4px 8px; border-bottom:1px solid #CBD5E1;"><span>IGST 18%:</span><span>₹ ${(po.igst_amount || 21060).toLocaleString('en-IN', {minimumFractionDigits:2})}</span></div>
                    <div style="display:flex; justify-content:space-between; padding:6px 8px; background:#1E3A8A; color:white;"><strong>Grand Total:</strong><strong>₹ ${(po.grand_total || po.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></div>
                </div>
            </div>

            <div style="border: 1px solid #1E3A8A; padding: 8px; margin-bottom: 16px; font-size: 0.8rem;">
                <strong style="color:#1E3A8A; display:block; margin-bottom:4px;">TERMS & CONDITIONS</strong>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>Payment: <strong>${po.payment_terms || '30 Days after Delivery'}</strong> | Freight: <strong>${po.freight_terms || 'Paid by Vendor'}</strong></div>
                    <div>Dispatch Mode: <strong>${po.mode_of_dispatch || 'Road Transport'}</strong> | Delivery: <strong>${po.delivery_terms || 'Door Delivery'}</strong></div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1px solid #CBD5E1;">
                <div style="text-align: center;">
                    <div style="font-weight: 700;">${po.prepared_by?.name || 'Mr. Umesh H. Patil'}</div>
                    <div style="font-size: 0.75rem; color: #64748B;">Prepared By (Date: ${po.prepared_by?.date || po.po_date})</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-weight: 800; color: #1E3A8A;">${po.approved_by ? `✅ Approved by ${po.approved_by.name}` : '___________________________'}</div>
                    <div style="font-weight: 800; color: #1E3A8A; font-size:0.8rem;">For SEMCORP PROCESS AND VACUUM SYSTEMS PVT. LTD</div>
                    <div style="font-size: 0.75rem; color: #64748B; font-weight: 700;">Authorised Signatory</div>
                </div>
            </div>
        </div>

        <div class="po-print-hide" style="margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn btn-outline" onclick="closeSEMCOPOPreviewModal()">Close</button>
            <button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
            ${po.status === 'SUBMITTED_FOR_APPROVAL' ? `<button type="button" class="btn btn-success" onclick="approvePO('${po.id}'); closeSEMCOPOPreviewModal();">✅ Authorize & Approve PO</button>` : ''}
        </div>
    `;

    modalBody.innerHTML = printHtml;
    modal.style.display = "flex";
};

window.closeSEMCOPOPreviewModal = function() {
    const modal = document.getElementById("semco-po-preview-modal");
    if (modal) modal.style.display = "none";
};

// Initialize Table on Startup
document.addEventListener("DOMContentLoaded", function() {
    renderPOLineItemsTable();
    const dateInput = document.getElementById('semco-po-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const prepDateEl = document.getElementById('semco-preparer-date');
    if (prepDateEl) prepDateEl.textContent = new Date().toLocaleDateString('en-GB');

    fetchPurchaseOrders();
    fetchPortalProjects();
});
