// GateFlow Payments Desk Module — Vendor Payables (Paying) & Customer Receivables (Receiving)

let currentVendorPayables = [];
let currentCustomerReceivables = [];

// Initialize Payments Desk Data
async function fetchPaymentsData() {
    try {
        const [payRes, recRes, sumRes] = await Promise.all([
            fetch('/api/payments/payables'),
            fetch('/api/payments/receivables'),
            fetch('/api/payments/summary')
        ]);

        if (payRes.ok) currentVendorPayables = await payRes.json();
        if (recRes.ok) currentCustomerReceivables = await recRes.json();
        
        if (sumRes.ok) {
            const summary = await sumRes.json();
            updatePaymentsSummaryCards(summary);
        }

        renderVendorPayablesTable(currentVendorPayables);
        renderCustomerReceivablesTable(currentCustomerReceivables);
        checkTallyStatus();
    } catch (err) {
        console.error("Error fetching Payments Desk data:", err);
    }
}

// ═══════════════════════════════════════════════════════════
// TALLY PRIME INTEGRATION MODULE (Computer B: 192.168.1.27:9000)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// TALLY PRIME INTEGRATION MODULE (Computer B: 192.168.1.27:9000)
// ═══════════════════════════════════════════════════════════
window.checkTallyStatus = async function() {
    const statusEl = document.getElementById('tally-prime-status-badge');
    if (!statusEl) return;

    // 1. Try Direct Browser LAN Connection to 192.168.1.27:9000
    const xmlCheck = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Accounts</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const directRes = await fetch('http://192.168.1.27:9000', {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: xmlCheck,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (directRes.ok) {
            statusEl.className = 'badge bg-success text-white';
            statusEl.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> 🟢 Tally Connected (Local LAN 192.168.1.27:9000)';
            fetchTallyPaymentsDirect();
            return;
        }
    } catch (e) {
        console.log("Direct browser LAN check fallback:", e);
    }

    // 2. Fallback to Cloud Backend Status
    try {
        const res = await fetch('/api/tally/status');
        const data = await res.json();
        if (data.online) {
            statusEl.className = 'badge bg-success text-white';
            statusEl.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> 🟢 Tally Connected (192.168.1.27:9000)';
        } else {
            statusEl.className = 'badge bg-warning text-dark';
            statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Tally Offline (Click for Setup)';
        }
    } catch (e) {
        statusEl.className = 'badge bg-secondary text-white';
        statusEl.innerHTML = 'Tally Status Unknown';
    }
};

window.fetchTallyPaymentsDirect = async function() {
    const todayStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const startStr = `${new Date().getFullYear() - 1}0401`;

    const xmlReq = `<ENVELOPE>
      <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
      <BODY>
        <EXPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>Day Book</REPORTNAME>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              <SVFROMDATE>${startStr}</SVFROMDATE>
              <SVTODATE>${todayStr}</SVTODATE>
            </STATICVARIABLES>
          </REQUESTDESC>
        </EXPORTDATA>
      </BODY>
    </ENVELOPE>`;

    try {
        const res = await fetch('http://192.168.1.27:9000', {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: xmlReq
        });
        const xmlText = await res.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const vouchers = xmlDoc.getElementsByTagName("VOUCHER");

        const directPayables = [];
        const directReceivables = [];

        for (let i = 0; i < vouchers.length; i++) {
            const v = vouchers[i];
            const vtype = (v.getElementsByTagName("VOUCHERTYPENAME")[0]?.textContent || "").toLowerCase();
            const party = v.getElementsByTagName("PARTYLEDGERNAME")[0]?.textContent || "Party Ledger";
            const vnum = v.getElementsByTagName("VOUCHERNUMBER")[0]?.textContent || `VCH-${i+1}`;
            const amount = Math.abs(parseFloat(v.getElementsByTagName("AMOUNT")[0]?.textContent || 0));
            const rawDate = v.getElementsByTagName("DATE")[0]?.textContent || "";
            const fmtDate = rawDate.length === 8 ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}` : rawDate;
            const narr = v.getElementsByTagName("NARRATION")[0]?.textContent || "";

            if (vtype.includes("payment")) {
                directPayables.push({
                    id: `tally_direct_${vnum}`,
                    po_number: "TALLY-VCH",
                    vendor_name: party,
                    bill_amount: amount,
                    amount_paid: amount,
                    balance_due: 0.0,
                    payment_date: fmtDate,
                    payment_mode: "Tally Prime LAN",
                    transaction_ref: vnum,
                    status: "Fully Paid",
                    notes: narr || "Fetched live from local Tally Prime",
                    is_tally: true
                });
            } else if (vtype.includes("receipt")) {
                directReceivables.push({
                    id: `tally_direct_rec_${vnum}`,
                    invoice_number: "TALLY-REC",
                    customer_name: party,
                    total_value: amount,
                    amount_received: amount,
                    balance_outstanding: 0.0,
                    receipt_date: fmtDate,
                    payment_mode: "Tally Prime Receipt",
                    transaction_ref: vnum,
                    status: "Fully Collected",
                    notes: narr || "Receipt fetched live from local Tally Prime",
                    is_tally: true
                });
            }
        }

        if (directPayables.length > 0) {
            currentVendorPayables = [...directPayables, ...currentVendorPayables.filter(p => !p.is_tally)];
            renderVendorPayablesTable(currentVendorPayables);
        }
        if (directReceivables.length > 0) {
            currentCustomerReceivables = [...directReceivables, ...currentCustomerReceivables.filter(r => !r.is_tally)];
            renderCustomerReceivablesTable(currentCustomerReceivables);
        }
    } catch (err) {
        console.log("Browser direct Tally parse:", err);
    }
};

window.syncPaymentToTally = async function(vendorName, amount, refNo, narration) {
    try {
        const res = await fetch('/api/tally/sync-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendorName,
                amount: parseFloat(amount),
                bankLedger: 'HDFC Bank',
                refNo: refNo || `PAY-${Date.now()}`,
                narration: narration || 'Payment via GateFlow Payments Desk'
            })
        });
        const result = await res.json();
        if (result.success) {
            alert(`✅ ${result.message}`);
        } else {
            alert(`⚠️ Tally Sync Error: ${result.error || 'Failed to sync voucher'}`);
        }
    } catch (err) {
        alert(`❌ Network Error: Could not reach Tally Prime server (${err.message})`);
    }
};

// Update Top Financial Summary Cards
function updatePaymentsSummaryCards(s) {
    const payablesTotalEl = document.getElementById("pay-card-total-payables");
    const payablesDueEl = document.getElementById("pay-card-due-payables");
    
    const recTotalEl = document.getElementById("pay-card-total-receivables");
    const recOutEl = document.getElementById("pay-card-out-receivables");
    
    const cashflowEl = document.getElementById("pay-card-net-cashflow");
    const gapEl = document.getElementById("pay-card-net-gap");

    if (payablesTotalEl && s.payables) payablesTotalEl.textContent = `₹ ${s.payables.total_paid.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    if (payablesDueEl && s.payables) payablesDueEl.textContent = `₹ ${s.payables.total_due.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    if (recTotalEl && s.receivables) recTotalEl.textContent = `₹ ${s.receivables.total_received.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    if (recOutEl && s.receivables) recOutEl.textContent = `₹ ${s.receivables.total_outstanding.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    if (cashflowEl) cashflowEl.textContent = `₹ ${s.net_cashflow.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    if (gapEl) gapEl.textContent = `₹ ${s.net_balance_gap.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
}

// Switch between Payables (Paying), Receivables (Receiving), and Payment Calendar Sub-Tabs
window.switchPaymentsSubTab = function(subKey) {
    document.querySelectorAll('.payments-sub-section').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`payments-section-${subKey}`);
    if (target) target.style.display = 'block';

    const payBtn = document.getElementById('payments-subnav-payables');
    const recBtn = document.getElementById('payments-subnav-receivables');
    const calBtn = document.getElementById('payments-subnav-calendar');

    if (payBtn) {
        payBtn.className = subKey === 'payables' ? 'btn btn-primary' : 'btn btn-outline';
        payBtn.style.background = subKey === 'payables' ? 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)' : 'white';
        payBtn.style.color = subKey === 'payables' ? 'white' : '#1E3A8A';
    }

    if (recBtn) {
        recBtn.className = subKey === 'receivables' ? 'btn btn-primary' : 'btn btn-outline';
        recBtn.style.background = subKey === 'receivables' ? 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)' : 'white';
        recBtn.style.color = subKey === 'receivables' ? 'white' : '#15803D';
    }

    if (calBtn) {
        calBtn.className = subKey === 'calendar' ? 'btn btn-primary' : 'btn btn-outline';
        calBtn.style.background = subKey === 'calendar' ? 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)' : 'white';
        calBtn.style.color = subKey === 'calendar' ? 'white' : '#7C3AED';
    }

    if (subKey === 'calendar') {
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderDispatchCollectionCalendar === 'function') renderDispatchCollectionCalendar('ALL');
    }
};

// Render Section 1: Vendor Payables Table (Paying)
function renderVendorPayablesTable(payables) {
    const tbody = document.getElementById('vendor-payables-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!payables || payables.length === 0) {
        tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color: var(--text-muted); padding: 32px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
              <h6 style="font-weight: 700; color: #1E3A8A; margin-bottom: 6px;"><i class="fa-solid fa-server me-2"></i> Tally Prime Integration Active</h6>
              <p style="font-size: 13px; color: #64748B; margin-bottom: 16px;">
                Target: <code>http://192.168.1.27:9000</code><br>
                No payment entries recorded yet. Click below to record a payment or refresh from Tally Prime.
              </p>
              <div style="display: flex; gap: 10px; justify-content: center;">
                <button type="button" class="btn btn-primary btn-sm" onclick="fetchPaymentsData()"><i class="fa-solid fa-rotate me-1"></i> Refresh Payments</button>
                <button type="button" class="btn btn-outline btn-sm" style="border-color: #1E3A8A; color: #1E3A8A;" onclick="openAddVendorPayableModal()"><i class="fa-solid fa-plus me-1"></i> Record Payment</button>
              </div>
            </div>
          </td>
        </tr>`;
        return;
    }

    payables.forEach(p => {
        let badgeClass = "badge-draft";
        if (p.status === "Fully Paid") badgeClass = "badge-verified";
        if (p.status === "Partially Paid") badgeClass = "badge-pending";
        if (p.status === "Unpaid") badgeClass = "badge-overdue";

        const tallyTag = p.is_tally 
          ? `<span class="badge" style="background:#15803D; color:white; font-size:10px; margin-left:4px;">Tally Prime</span>` 
          : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: #1E3A8A;">${p.po_number || '-'}</strong>${tallyTag}</td>
            <td><strong>${p.vendor_name}</strong></td>
            <td>${p.payment_date || '-'}</td>
            <td><strong>₹ ${(p.bill_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><strong style="color: #15803D;">₹ ${(p.amount_paid || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><strong style="color: #DC2626;">₹ ${(p.balance_due || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><span class="badge ${badgeClass}">${p.status || 'Recorded'}</span></td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-outline btn-sm" style="border-color: #1E3A8A; color: #1E3A8A;" onclick="viewPaymentDetails('${p.id}', 'payable')">👁️ Details</button>
                    ${p.is_tally ? '' : `<button type="button" class="btn btn-outline btn-sm" style="border-color: #EF4444; color: #EF4444;" onclick="deletePaymentRecord('${p.id}', 'payable')">🗑️ Delete</button>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Section 2: Customer Receivables Table (Receiving)
function renderCustomerReceivablesTable(receivables) {
    const tbody = document.getElementById('customer-receivables-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!receivables || receivables.length === 0) {
        tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color: var(--text-muted); padding: 32px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #F4FBF7; border: 1px solid #BBF7D0; border-radius: 8px; padding: 20px;">
              <h6 style="font-weight: 700; color: #15803D; margin-bottom: 6px;"><i class="fa-solid fa-server me-2"></i> Tally Prime Receipt Integration Active</h6>
              <p style="font-size: 13px; color: #475569; margin-bottom: 16px;">
                Target: <code>http://192.168.1.27:9000</code><br>
                No customer inward collections recorded yet. Click below to record a collection or refresh from Tally.
              </p>
              <div style="display: flex; gap: 10px; justify-content: center;">
                <button type="button" class="btn btn-success btn-sm" onclick="fetchPaymentsData()"><i class="fa-solid fa-rotate me-1"></i> Refresh Collections</button>
                <button type="button" class="btn btn-outline btn-sm" style="border-color: #15803D; color: #15803D;" onclick="openRecordCustomerReceivableModal()"><i class="fa-solid fa-plus me-1"></i> Record Collection</button>
              </div>
            </div>
          </td>
        </tr>`;
        return;
    }

    receivables.forEach(r => {
        let badgeClass = "badge-draft";
        if (r.status === "Fully Collected") badgeClass = "badge-verified";
        if (r.status === "Partially Collected") badgeClass = "badge-pending";
        if (r.status === "Pending") badgeClass = "badge-overdue";

        const tallyTag = r.is_tally 
          ? `<span class="badge" style="background:#15803D; color:white; font-size:10px; margin-left:4px;">Tally Receipt</span>` 
          : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: #15803D;">${r.invoice_number || '-'}</strong>${tallyTag}</td>
            <td><strong>${r.customer_name}</strong></td>
            <td>${r.receipt_date || '-'}</td>
            <td><strong>₹ ${(r.total_value || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><strong style="color: #15803D;">₹ ${(r.amount_received || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><strong style="color: #DC2626;">₹ ${(r.balance_outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><span class="badge ${badgeClass}">${r.status || 'Recorded'}</span></td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-outline btn-sm" style="border-color: #15803D; color: #15803D;" onclick="viewPaymentDetails('${r.id}', 'receivable')">👁️ Details</button>
                    ${r.is_tally ? '' : `<button type="button" class="btn btn-outline btn-sm" style="border-color: #EF4444; color: #EF4444;" onclick="deletePaymentRecord('${r.id}', 'receivable')">🗑️ Delete</button>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Open Modal to Record Vendor Payment (Paying)
window.openRecordVendorPayableModal = function() {
    const modal = document.getElementById("record-payable-modal");
    if (modal) {
        document.getElementById("rec-pay-date").value = new Date().toISOString().split('T')[0];
        document.getElementById("rec-pay-utr").value = `UTR-${Date.now().toString().slice(-8)}`;
        modal.style.display = "flex";
    }
};

window.closeRecordVendorPayableModal = function() {
    const modal = document.getElementById("record-payable-modal");
    if (modal) modal.style.display = "none";
};

// Handle Vendor Payment Submission
window.handleRecordVendorPayableSubmit = async function(e) {
    e.preventDefault();
    const payload = {
        po_number: document.getElementById("rec-pay-po-no")?.value || "",
        vendor_name: document.getElementById("rec-pay-vendor-name")?.value || "",
        bill_amount: parseFloat(document.getElementById("rec-pay-bill-amount")?.value) || 0,
        amount_paid: parseFloat(document.getElementById("rec-pay-paid-amount")?.value) || 0,
        payment_date: document.getElementById("rec-pay-date")?.value || new Date().toISOString().split('T')[0],
        payment_mode: document.getElementById("rec-pay-mode")?.value || "NEFT / Bank Transfer",
        transaction_ref: document.getElementById("rec-pay-utr")?.value || "",
        bank_account: document.getElementById("rec-pay-bank")?.value || "HDFC Bank Ltd - Main Operative A/C",
        notes: document.getElementById("rec-pay-notes")?.value || ""
    };

    if (!payload.vendor_name || !payload.amount_paid) {
        window.showAlertModal({ icon: "⚠️", title: "Missing Details", message: "Please specify Vendor Name and Amount Paid." });
        return;
    }

    try {
        const res = await fetch("/api/payments/record-payable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeRecordVendorPayableModal();
            window.showAlertModal({
                icon: "💸",
                title: "Vendor Payment Recorded",
                message: `Payment of ₹${payload.amount_paid.toLocaleString('en-IN')} for ${payload.vendor_name} recorded! PO & Payables Calendar synced.`
            });
            fetchPaymentsData();
            if (typeof fetchPurchaseOrders === 'function') fetchPurchaseOrders();
            if (typeof fetchReceivingRecords === 'function') fetchReceivingRecords();
        }
    } catch (err) {
        console.error("Record payable error:", err);
    }
};

// Open Modal to Record Customer Collection (Receiving)
window.openRecordCustomerReceivableModal = function() {
    const modal = document.getElementById("record-receivable-modal");
    if (modal) {
        document.getElementById("rec-rec-date").value = new Date().toISOString().split('T')[0];
        document.getElementById("rec-rec-utr").value = `UTR-R${Date.now().toString().slice(-8)}`;
        modal.style.display = "flex";
    }
};

window.closeRecordCustomerReceivableModal = function() {
    const modal = document.getElementById("record-receivable-modal");
    if (modal) modal.style.display = "none";
};

// Handle Customer Collection Submission
window.handleRecordCustomerReceivableSubmit = async function(e) {
    e.preventDefault();
    const payload = {
        invoice_number: document.getElementById("rec-rec-inv-no")?.value || "",
        customer_name: document.getElementById("rec-rec-customer-name")?.value || "",
        total_value: parseFloat(document.getElementById("rec-rec-total-value")?.value) || 0,
        amount_received: parseFloat(document.getElementById("rec-rec-received-amount")?.value) || 0,
        receipt_date: document.getElementById("rec-rec-date")?.value || new Date().toISOString().split('T')[0],
        payment_mode: document.getElementById("rec-rec-mode")?.value || "RTGS / Bank Transfer",
        transaction_ref: document.getElementById("rec-rec-utr")?.value || "",
        bank_account: document.getElementById("rec-rec-bank")?.value || "State Bank of India - Collection A/C",
        notes: document.getElementById("rec-rec-notes")?.value || ""
    };

    if (!payload.customer_name || !payload.amount_received) {
        window.showAlertModal({ icon: "⚠️", title: "Missing Details", message: "Please specify Customer Name and Amount Received." });
        return;
    }

    try {
        const res = await fetch("/api/payments/record-receivable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeRecordCustomerReceivableModal();
            window.showAlertModal({
                icon: "💰",
                title: "Collection Recorded",
                message: `Collection of ₹${payload.amount_received.toLocaleString('en-IN')} from ${payload.customer_name} recorded! Dispatch & Collections Calendar synced.`
            });
            fetchPaymentsData();
            if (typeof fetchDispatches === 'function') fetchDispatches();
        }
    } catch (err) {
        console.error("Record receivable error:", err);
    }
};

// Delete Payment/Collection Record
window.deletePaymentRecord = async function(id, type) {
    if (!confirm("Are you sure you want to delete this financial record?")) return;
    try {
        const url = type === 'payable' ? `/api/payments/payables/${id}` : `/api/payments/receivables/${id}`;
        const res = await fetch(url, { method: "DELETE" });
        if (res.ok) {
            fetchPaymentsData();
            window.showAlertModal({ icon: "🗑️", title: "Record Deleted", message: "Financial record removed." });
        }
    } catch (err) {
        console.error("Delete payment error:", err);
    }
};

// View Details Modal
window.viewPaymentDetails = function(id, type) {
    const list = type === 'payable' ? currentVendorPayables : currentCustomerReceivables;
    const item = list.find(x => x.id === id);
    if (!item) return;

    window.showAlertModal({
        icon: type === 'payable' ? "💸" : "💰",
        title: `${type === 'payable' ? 'Vendor Payment' : 'Customer Collection'} Details`,
        message: `
            <strong>Ref/ID:</strong> ${item.po_number || item.invoice_number || item.id}<br>
            <strong>Party:</strong> ${item.vendor_name || item.customer_name}<br>
            <strong>Date:</strong> ${item.payment_date || item.receipt_date}<br>
            <strong>Mode:</strong> ${item.payment_mode} (Ref: ${item.transaction_ref})<br>
            <strong>Bank Account:</strong> ${item.bank_account}<br>
            <strong>Total Value:</strong> ₹${(item.bill_amount || item.total_value || 0).toLocaleString('en-IN')}<br>
            <strong>Amount Processed:</strong> ₹${(item.amount_paid || item.amount_received || 0).toLocaleString('en-IN')}<br>
            <strong>Outstanding Balance:</strong> ₹${(item.balance_due || item.balance_outstanding || 0).toLocaleString('en-IN')}<br>
            <strong>Notes:</strong> ${item.notes || 'No notes'}
        `
    });
};

// Fetch data on startup
document.addEventListener("DOMContentLoaded", function() {
    fetchPaymentsData();
});
