window.refreshAllModuleData = function() {
    if (typeof fetchReceivingRecords === 'function') fetchReceivingRecords();
    if (typeof fetchProjectEngineerPackages === 'function') fetchProjectEngineerPackages();
    if (typeof fetchProjectEngineerQCRecords === 'function') fetchProjectEngineerQCRecords();
    if (typeof fetchDispatches === 'function') fetchDispatches();
    if (typeof fetchNotifications === 'function') fetchNotifications();
    if (typeof fetchPurchaseOrders === 'function') fetchPurchaseOrders();
    if (typeof fetchVendorPayments === 'function') fetchVendorPayments();
    if (typeof fetchMasterAdminDashboardSummary === 'function' && currentSessionUser && currentSessionUser.role === 'admin') {
        fetchMasterAdminDashboardSummary();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.refreshAllModuleData();
    checkAuthSession();
    setTimeout(() => {
        if (typeof handleDeepLinkRouting === 'function') {
            handleDeepLinkRouting();
        }
    }, 400);

    // Live background auto-sync every 8 seconds across all modules
    setInterval(() => {
        if (currentSessionUser) {
            window.refreshAllModuleData();
        }
    }, 8000);
});

// ----------------------------------------------------
// DEDICATED PROFILE AUTHENTICATION & ROLE CONTROL
// ----------------------------------------------------

let currentSessionUser = null;

function checkAuthSession() {
    const savedUserJson = localStorage.getItem("gateflow_user");
    if (savedUserJson) {
        try {
            currentSessionUser = JSON.parse(savedUserJson);
            applyUserSession(currentSessionUser);
            return;
        } catch (e) {
            localStorage.removeItem("gateflow_user");
        }
    }
    showLoginPage();
}

function showLoginPage() {
    const pill = document.getElementById("active-profile-pill");
    const logoutBtn = document.getElementById("btn-logout");
    const loginNav = document.getElementById("nav-item-login");
    const bottomNav = document.querySelector("nav.bottom-nav");
    const topNav = document.getElementById("top-module-nav");

    if (pill) pill.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (loginNav) loginNav.style.display = "none";
    if (bottomNav) bottomNav.style.display = "none";
    if (topNav) topNav.style.display = "none";

    // Hide workspace tabs from bottom nav until signed in
    ["nav-item-dashboard", "nav-item-receiving", "nav-item-project-engineer", "nav-item-dispatch", "nav-item-qc", "nav-item-audit", "nav-item-po", "nav-item-payments"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // Hide workspace tabs from top nav until signed in
    ["top-nav-dashboard", "top-nav-receiving", "top-nav-project-engineer", "top-nav-dispatch", "top-nav-qc", "top-nav-audit", "top-nav-po", "top-nav-payments"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    switchMainTab("login-tab", loginNav);
}

async function handleAuthSubmit(event, roleKey) {
    event.preventDefault();
    const emailInput = document.getElementById(`auth-email-${roleKey}`);
    const passInput = document.getElementById(`auth-pass-${roleKey}`);
    if (!emailInput || !passInput) return;

    const formData = new FormData();
    formData.append("email", emailInput.value);
    formData.append("password", passInput.value);
    formData.append("role", roleKey);

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            let errorMsg = "Invalid credentials for this profile. Please try again.";
            try {
                const errData = await res.json();
                if (errData && errData.detail) errorMsg = errData.detail;
            } catch(e) {}

            window.showAlertModal({
                icon: "⚠️",
                title: "Authentication Failed",
                message: errorMsg,
                buttonText: "Try Again"
            });
            return;
        }

        const user = await res.json();
        if (roleKey === 'payments') {
            user.active_role = 'payments';
        }
        localStorage.setItem("gateflow_user", JSON.stringify(user));
        currentSessionUser = user;
        
        try {
            applyUserSession(user);
        } catch (uiErr) {
            console.error("Session apply UI error:", uiErr);
        }
    } catch (err) {
        console.error("Sign in network error:", err);
        window.showAlertModal({
            icon: "❌",
            title: "Sign In Error",
            message: "Unable to connect to login service. Please verify server connection."
        });
    }
}

function applyUserSession(user) {
    if (!user) return;
    const pill = document.getElementById("active-profile-pill");
    const iconSpan = document.getElementById("active-profile-icon");
    const nameSpan = document.getElementById("active-profile-name");
    const logoutBtn = document.getElementById("btn-logout");
    const loginNav = document.getElementById("nav-item-login");

    if (loginNav) loginNav.style.display = "none";
    if (pill) pill.style.display = "inline-flex";

    const userRole = user.active_role || user.role || "receiving";
    let roleIcon = "👤";
    let roleLabel = userRole.replace("_", " ").toUpperCase();
    
    if (userRole === 'receiving') roleIcon = "📥";
    if (userRole === 'project_engineer') { roleIcon = "📐"; roleLabel = "PROJECT ENGINEER DESK"; }
    if (userRole === 'dispatch') roleIcon = "🚚";
    if (userRole === 'qc_admin') roleIcon = "🛡️";
    if (userRole === 'po_admin') { roleIcon = "📋"; roleLabel = "PO MASTER DESK"; }
    if (userRole === 'po_preparer') { roleIcon = "✍️"; roleLabel = "PO PREPARATION DESK"; }
    if (userRole === 'po_approver') { roleIcon = "🛡️"; roleLabel = "PO APPROVAL DESK"; }
    if (userRole === 'payments') { roleIcon = "💳"; roleLabel = "PAYMENTS DESK (TREASURY)"; }
    if (userRole === 'admin') { roleIcon = "👑"; roleLabel = "MASTER ADMIN"; }

    if (iconSpan) iconSpan.innerText = roleIcon;
    if (nameSpan) nameSpan.innerText = `${user.full_name || user.email} (${roleLabel})`;
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    enforceRoleTabScoping(userRole);
}

let pbiCashflowChartInstance = null;
let pbiPOPipelineChartInstance = null;
let pbiReceivingQCChartInstance = null;
let pbiDispatchChartInstance = null;

function renderPowerBICharts(data) {
    if (typeof Chart === 'undefined') return;

    // 1. Cashflow Chart (Payables vs Receivables Bar Combo)
    const ctxCashflow = document.getElementById("pbi-chart-cashflow");
    if (ctxCashflow) {
        if (pbiCashflowChartInstance) pbiCashflowChartInstance.destroy();
        pbiCashflowChartInstance = new Chart(ctxCashflow, {
            type: 'bar',
            data: {
                labels: ['Vendor Paid', 'Vendor Dues', 'Client Collected', 'Outstanding'],
                datasets: [{
                    label: 'Amount (INR)',
                    data: [
                        data.payments?.payables_paid || 0,
                        data.payments?.payables_due || 0,
                        data.payments?.receivables_received || 0,
                        data.payments?.receivables_outstanding || 0
                    ],
                    backgroundColor: ['#2563EB', '#DC2626', '#16A34A', '#EA580C'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: function(v) { return '₹ ' + v.toLocaleString('en-IN'); } }
                    }
                }
            }
        });
    }

    // 2. PO Pipeline Donut Chart
    const ctxPO = document.getElementById("pbi-chart-po-pipeline");
    if (ctxPO) {
        if (pbiPOPipelineChartInstance) pbiPOPipelineChartInstance.destroy();
        const drafts = data.pos?.drafts || 0;
        const pending = data.pos?.pending_approval || 0;
        const approved = data.pos?.approved || 0;
        const total = data.pos?.total_count || 0;

        pbiPOPipelineChartInstance = new Chart(ctxPO, {
            type: 'doughnut',
            data: {
                labels: ['Draft POs', 'Pending Signatures', 'Approved POs'],
                datasets: [{
                    data: [drafts, pending, approved > 0 ? approved : (total === 0 ? 1 : 0)],
                    backgroundColor: ['#94A3B8', '#F59E0B', '#2563EB'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // 3. Receiving & QC Verification Funnel Chart
    const ctxRecQC = document.getElementById("pbi-chart-receiving-qc");
    if (ctxRecQC) {
        if (pbiReceivingQCChartInstance) pbiReceivingQCChartInstance.destroy();
        pbiReceivingQCChartInstance = new Chart(ctxRecQC, {
            type: 'bar',
            data: {
                labels: ['Invoices Inward', 'Verified Goods', 'QC Approved', 'Pending Invoices'],
                datasets: [{
                    label: 'Count',
                    data: [
                        data.receiving?.total_count || 0,
                        data.receiving?.verified || 0,
                        data.qc?.approved || 0,
                        data.receiving?.pending_invoices || 0
                    ],
                    backgroundColor: ['#059669', '#10B981', '#0284C7', '#F59E0B'],
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 4. Dispatch Tracker Chart
    const ctxDisp = document.getElementById("pbi-chart-dispatch-status");
    if (ctxDisp) {
        if (pbiDispatchChartInstance) pbiDispatchChartInstance.destroy();
        pbiDispatchChartInstance = new Chart(ctxDisp, {
            type: 'pie',
            data: {
                labels: ['Initiated Dispatches', 'In-Transit', 'Delivered Packages'],
                datasets: [{
                    data: [
                        data.dispatch?.total_dispatches || 0,
                        data.dispatch?.in_transit || 0,
                        data.dispatch?.delivered || 0
                    ],
                    backgroundColor: ['#EA580C', '#F97316', '#10B981'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

window.fetchMasterAdminDashboardSummary = async function() {
    try {
        const res = await fetch("/api/admin/dashboard-summary");
        if (!res.ok) return;
        const data = await res.json();

        if (data.pos) {
            const poTotal = document.getElementById("dash-po-total");
            const poPending = document.getElementById("dash-po-pending");
            const poVal = document.getElementById("dash-po-val");
            if (poTotal) poTotal.textContent = data.pos.total_count || 0;
            if (poPending) poPending.textContent = data.pos.pending_approval || 0;
            if (poVal) poVal.textContent = `₹ ${(data.pos.total_value || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        }

        if (data.receiving) {
            const recTotal = document.getElementById("dash-rec-total");
            const recVerified = document.getElementById("dash-rec-verified");
            const recAmt = document.getElementById("dash-rec-amt");
            if (recTotal) recTotal.textContent = data.receiving.total_count || 0;
            if (recVerified) recVerified.textContent = data.receiving.verified || 0;
            if (recAmt) recAmt.textContent = `₹ ${(data.receiving.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        }

        if (data.project_engineer) {
            const peTotal = document.getElementById("dash-pe-total");
            const peFiles = document.getElementById("dash-pe-files");
            if (peTotal) peTotal.textContent = data.project_engineer.total_packages || 0;
            if (peFiles) peFiles.textContent = data.project_engineer.total_files || 0;
        }

        if (data.payments) {
            const payPaid = document.getElementById("dash-pay-paid");
            const payDue = document.getElementById("dash-pay-due");
            const payRec = document.getElementById("dash-pay-rec");
            const payOut = document.getElementById("dash-pay-out");
            const payNet = document.getElementById("dash-pay-net");

            if (payPaid) payPaid.textContent = `₹ ${(data.payments.payables_paid || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payDue) payDue.textContent = `₹ ${(data.payments.payables_due || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payRec) payRec.textContent = `₹ ${(data.payments.receivables_received || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payOut) payOut.textContent = `₹ ${(data.payments.receivables_outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payNet) payNet.textContent = `₹ ${(data.payments.net_cashflow || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        }

        if (data.qc) {
            const qcApproved = document.getElementById("dash-qc-approved");
            const qcPending = document.getElementById("dash-qc-pending");
            if (qcApproved) qcApproved.textContent = data.qc.approved || 0;
            if (qcPending) qcPending.textContent = data.qc.pending || 0;
        }

        if (data.dispatch) {
            const dispTotal = document.getElementById("dash-disp-total");
            const dispDelivered = document.getElementById("dash-disp-delivered");
            const dispTransit = document.getElementById("dash-disp-transit");
            if (dispTotal) dispTotal.textContent = data.dispatch.total_dispatches || 0;
            if (dispDelivered) dispDelivered.textContent = data.dispatch.delivered || 0;
            if (dispTransit) dispTransit.textContent = data.dispatch.in_transit || 0;
        }

        // Matrix Table Updates
        const tblPo = document.getElementById("pbi-tbl-po");
        const tblRec = document.getElementById("pbi-tbl-rec");
        const tblPe = document.getElementById("pbi-tbl-pe");
        const tblPay = document.getElementById("pbi-tbl-pay");
        const tblQc = document.getElementById("pbi-tbl-qc");
        const tblDisp = document.getElementById("pbi-tbl-disp");

        if (tblPo) tblPo.textContent = `${data.pos?.total_count || 0} POs (${data.pos?.pending_approval || 0} Pending)`;
        if (tblRec) tblRec.textContent = `${data.receiving?.total_count || 0} Inward (${data.receiving?.verified || 0} Verified)`;
        if (tblPe) tblPe.textContent = `${data.project_engineer?.total_packages || 0} Packages (${data.project_engineer?.total_files || 0} Files)`;
        if (tblPay) tblPay.textContent = `₹ ${(data.payments?.net_cashflow || 0).toLocaleString('en-IN')} Net Flow`;
        if (tblQc) tblQc.textContent = `${data.qc?.approved || 0} Approved / ${data.qc?.pending || 0} Pending`;
        if (tblDisp) tblDisp.textContent = `${data.dispatch?.total_dispatches || 0} Dispatches (${data.dispatch?.delivered || 0} Delivered)`;

        // Render Power BI Charts
        renderPowerBICharts(data);

    } catch (err) {
        console.error("Dashboard summary fetch error:", err);
    }
};

function enforceRoleTabScoping(role) {
    const bottomNav = document.querySelector("nav.bottom-nav");
    const topNav = document.getElementById("top-module-nav");

    const dashNav = document.getElementById("nav-item-dashboard");
    const receivingNav = document.getElementById("nav-item-receiving");
    const peNav = document.getElementById("nav-item-project-engineer");
    const dispatchNav = document.getElementById("nav-item-dispatch");
    const qcNav = document.getElementById("nav-item-qc");
    const auditNav = document.getElementById("nav-item-audit");
    const poNav = document.getElementById("nav-item-po");
    const paymentsNav = document.getElementById("nav-item-payments");

    const topDash = document.getElementById("top-nav-dashboard");
    const topRec = document.getElementById("top-nav-receiving");
    const topPe = document.getElementById("top-nav-project-engineer");
    const topDisp = document.getElementById("top-nav-dispatch");
    const topQc = document.getElementById("top-nav-qc");
    const topAudit = document.getElementById("top-nav-audit");
    const topPo = document.getElementById("top-nav-po");
    const topPay = document.getElementById("top-nav-payments");

    const payablesCard = document.getElementById("card-payables-calendar");
    const collectionsCard = document.getElementById("card-collections-calendar");

    if (role === 'admin') {
        // Master Admin Portal: Full unrestricted access with Navigation Bars!
        if (bottomNav) bottomNav.style.display = "flex";
        if (topNav) topNav.style.display = "flex";

        [dashNav, receivingNav, peNav, dispatchNav, qcNav, auditNav, poNav, paymentsNav].forEach(el => { if (el) el.style.display = "flex"; });
        [topDash, topRec, topPe, topDisp, topQc, topAudit, topPo, topPay].forEach(el => { if (el) el.style.display = "flex"; });

        if (payablesCard) payablesCard.style.display = "block";
        if (collectionsCard) collectionsCard.style.display = "block";

        // Master Admin opens FIRST to Executive All-Module Dashboard!
        switchMainTab("admin-dashboard-tab", dashNav);
        fetchMasterAdminDashboardSummary();
    } else {
        // HIDE Module Navigation Bars for ALL individual Desk profiles!
        if (bottomNav) bottomNav.style.display = "none";
        if (topNav) topNav.style.display = "none";

        if (role === 'payments') {
            if (payablesCard) payablesCard.style.display = "block";
            if (collectionsCard) collectionsCard.style.display = "block";
            switchMainTab("payments-tab");
        } else if (role === 'project_engineer') {
            switchMainTab("project-engineer-tab");
        } else if (role === 'po_preparer' || role === 'po_approver' || role === 'po_admin') {
            switchMainTab("po-tab");
            if (typeof switchPOSubTab === 'function') switchPOSubTab(role === 'po_approver' ? 'appr' : 'prep');
        } else if (role === 'receiving') {
            if (payablesCard) payablesCard.style.display = "block";
            if (collectionsCard) collectionsCard.style.display = "none";
            switchMainTab("receiving-tab");
        } else if (role === 'dispatch') {
            if (payablesCard) payablesCard.style.display = "none";
            if (collectionsCard) collectionsCard.style.display = "block";
            switchMainTab("dispatch-tab");
        } else if (role === 'qc_admin') {
            switchMainTab("qc-tab");
        } else {
            switchMainTab("receiving-tab");
        }
    }
}

// ----------------------------------------------------
// DYNAMIC CONFIRMATION MODAL MANAGER
// ----------------------------------------------------

window.showConfirmModal = function({ icon = "⚠️", title = "Confirm Action", message = "Are you sure you want to proceed?", proceedText = "Proceed", proceedClass = "btn-primary" }) {
    return new Promise((resolve) => {
        const backdrop = document.getElementById("global-confirm-modal");
        const iconEl = document.getElementById("confirm-modal-icon");
        const titleEl = document.getElementById("confirm-modal-title");
        const bodyEl = document.getElementById("confirm-modal-body");
        const proceedBtn = document.getElementById("confirm-modal-proceed");
        const cancelBtn = document.getElementById("confirm-modal-cancel");

        if (!backdrop) {
            if (confirm(`${title}\n\n${message}`)) {
                resolve(true);
            } else {
                resolve(false);
            }
            return;
        }

        if (iconEl) iconEl.innerText = icon;
        if (titleEl) titleEl.innerText = title;
        if (bodyEl) bodyEl.innerText = message;
        if (proceedBtn) {
            proceedBtn.innerText = proceedText;
            proceedBtn.className = `btn ${proceedClass}`;
        }

        backdrop.style.display = "flex";

        const cleanup = () => {
            backdrop.style.display = "none";
            if (proceedBtn) proceedBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
        };

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
        }

        if (proceedBtn) {
            proceedBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
        }
    });
};

window.showAlertModal = function({ icon = "ℹ️", title = "Notification", message = "Action completed.", buttonText = "OK" }) {
    return new Promise((resolve) => {
        const backdrop = document.getElementById("global-confirm-modal");
        const iconEl = document.getElementById("confirm-modal-icon");
        const titleEl = document.getElementById("confirm-modal-title");
        const bodyEl = document.getElementById("confirm-modal-body");
        const proceedBtn = document.getElementById("confirm-modal-proceed");
        const cancelBtn = document.getElementById("confirm-modal-cancel");

        if (!backdrop) {
            alert(`${title}\n\n${message}`);
            resolve(true);
            return;
        }

        if (iconEl) iconEl.innerText = icon;
        if (titleEl) titleEl.innerText = title;
        if (bodyEl) {
            if (typeof message === 'string' && message.trim().startsWith('<')) {
                bodyEl.innerHTML = message;
            } else {
                bodyEl.innerText = message;
            }
        }

        if (cancelBtn) cancelBtn.style.display = "none";
        if (proceedBtn) {
            proceedBtn.innerText = buttonText;
            proceedBtn.className = "btn btn-primary";
            proceedBtn.style.width = "100%";
        }

        backdrop.style.display = "flex";

        const cleanup = () => {
            backdrop.style.display = "none";
            if (cancelBtn) cancelBtn.style.display = "";
            if (proceedBtn) proceedBtn.style.width = "";
            if (proceedBtn) proceedBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
        };

        if (proceedBtn) {
            proceedBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
        }
    });
};

async function logoutUser() {
    const confirmed = await window.showConfirmModal({
        icon: "🚪",
        title: "Sign Out Confirmation",
        message: "Are you sure you want to log out of GateFlow SCM?",
        proceedText: "Yes, Sign Out",
        proceedClass: "btn-outline"
    });
    if (!confirmed) return;

    localStorage.removeItem("gateflow_user");
    currentSessionUser = null;
    showLoginPage();
}

function switchMainTab(tabId, navBtn) {
    // Security check: restrict tab switching (Admin has full access to all tabs)
    if (currentSessionUser) {
        const role = currentSessionUser.role;
        if (role !== 'admin') {
            if (role === 'project_engineer' && !['project-engineer-tab', 'receiving-tab', 'audit-tab', 'po-tab'].includes(tabId)) return;
            if (role === 'receiving' && !['receiving-tab', 'project-engineer-tab', 'calendar-tab', 'audit-tab', 'po-tab'].includes(tabId)) return;
            if (role === 'dispatch' && !['dispatch-tab', 'calendar-tab', 'audit-tab'].includes(tabId)) return;
            if (role === 'qc_admin' && !['qc-tab', 'project-engineer-tab', 'audit-tab'].includes(tabId)) return;
            if (role === 'po_admin' && !['po-tab', 'calendar-tab', 'audit-tab'].includes(tabId)) return;
            if (role === 'po_preparer' && !['po-tab', 'audit-tab'].includes(tabId)) return;
            if (role === 'po_approver' && !['po-tab', 'audit-tab'].includes(tabId)) return;
        }
    } else {
        if (tabId !== 'login-tab') return;
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item, .top-nav-item').forEach(n => n.classList.remove('active'));

    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');

    const navMap = {
        'receiving-tab': ['nav-item-receiving', 'top-nav-receiving'],
        'project-engineer-tab': ['nav-item-project-engineer', 'top-nav-project-engineer'],
        'calendar-tab': ['nav-item-calendar', 'top-nav-calendar'],
        'dispatch-tab': ['nav-item-dispatch', 'top-nav-dispatch'],
        'qc-tab': ['nav-item-qc', 'top-nav-qc'],
        'audit-tab': ['nav-item-audit', 'top-nav-audit'],
        'po-tab': ['nav-item-po', 'top-nav-po']
    };

    if (navMap[tabId]) {
        navMap[tabId].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.add('active');
        });
    } else if (navBtn) {
        navBtn.classList.add('active');
    }

    if (tabId === 'receiving-tab') fetchReceivingRecords();
    if (tabId === 'project-engineer-tab') fetchProjectEngineerPackages();
    if (tabId === 'calendar-tab') {
        fetchReceivingRecords();
        fetchDispatches();
    }
    if (tabId === 'dispatch-tab') {
        fetchDispatches();
        if (typeof loadQCApprovedDocsForDispatch === 'function') loadQCApprovedDocsForDispatch();
    }
    if (tabId === 'qc-tab') {
        fetchReceivingRecords();
        fetchDispatches();
        fetchProjectEngineerQCRecords();
        fetchProjectEngineerPackages();
    }
    if (tabId === 'audit-tab') fetchNotifications();
    if (tabId === 'po-tab') {
        if (typeof fetchPurchaseOrders === 'function') fetchPurchaseOrders();
    }
}

async function triggerPaymentCheck() {
    try {
        const res = await fetch("/api/scheduler/trigger-check", { method: "POST" });
        const data = await res.json();
        window.showAlertModal({
            icon: "⚡",
            title: "Automated Payment Audit",
            message: data.message || "Payment check executed."
        });
        fetchNotifications();
    } catch (err) {
        window.showAlertModal({
            icon: "❌",
            title: "Check Error",
            message: err.message
        });
    }
}

// ----------------------------------------------------
// QC ADMIN VIEWS RENDERER
// ----------------------------------------------------

function renderQCDispatchView(pendingDispatches) {
    const container = document.getElementById('qc-dispatch-container');
    if (!container) return;
    container.innerHTML = '';

    if (pendingDispatches.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); padding: 10px 0;">No dispatch bundles currently pending QC review.</p>`;
        return;
    }

    pendingDispatches.forEach(d => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.background = '#FFFFFF';
        div.innerHTML = `
            <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color: var(--semco-blue);">Dispatch Bundle #${d.dispatch_number}</h3>
                <span class="badge badge-pending">Pending Review</span>
            </div>

            <div class="form-row" style="margin-bottom: 16px;">
                <div style="background: #F8FAFD; padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0;">
                    <strong style="color: var(--semco-blue);">1. Supplier & PO Details</strong>
                    <p style="font-size: 0.85rem; margin-top: 4px;">Supplier: ${d.supplier_name}</p>
                    <p style="font-size: 0.85rem;">Phone: ${d.supplier_phone}</p>
                    <p style="font-size: 0.85rem;">P.O. Number: <strong>${d.po_number || 'N/A'}</strong></p>
                </div>
                <div style="background: #F8FAFD; padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0;">
                    <strong style="color: var(--semco-blue);">2. Transporter & Driver</strong>
                    <p style="font-size: 0.85rem; margin-top: 4px;">Driver: ${d.driver_name} (${d.driver_phone})</p>
                    <p style="font-size: 0.85rem;">Vehicle: ${d.vehicle_number} (${d.truck_type})</p>
                </div>
                <div style="background: #F8FAFD; padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0;">
                    <strong style="color: var(--semco-blue);">3. Client & Destination</strong>
                    <p style="font-size: 0.85rem; margin-top: 4px;">Client: ${d.client_name} (${d.client_phone})</p>
                    <p style="font-size: 0.85rem;">Email: ${d.client_email}</p>
                    <p style="font-size: 0.85rem;">Location: ${d.delivery_location}</p>
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <strong style="font-size: 0.9rem; color: var(--semco-blue);">Uploaded Documents:</strong>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
                    ${d.supplier_invoice_doc ? `<a href="${window.formatFileUrl ? window.formatFileUrl(d.supplier_invoice_doc) : d.supplier_invoice_doc}" target="_blank" class="btn btn-outline btn-sm">📄 Supplier Invoice</a>` : ''}
                    ${d.supplier_challan_doc ? `<a href="${window.formatFileUrl ? window.formatFileUrl(d.supplier_challan_doc) : d.supplier_challan_doc}" target="_blank" class="btn btn-outline btn-sm">📜 Delivery Challan</a>` : ''}
                </div>
            </div>

            ${(typeof buildQCApprovedDocsHtml === 'function' && buildQCApprovedDocsHtml(d, false)) ? `
            <div style="margin-bottom: 16px;">
                <strong style="font-size: 0.9rem; color: #166534;">🛡️ QC Approved Documents & Certificates:</strong>
                <div style="margin-top: 8px;">${buildQCApprovedDocsHtml(d, false)}</div>
            </div>
            ` : ''}

            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-success" onclick="approveDispatchQC('${d.id}')">
                    👍 OK for Dispatch (Trigger Client Email & Transporter SMS)
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.approveDispatchQC = async function(dispatchId) {
    const confirmed = await window.showConfirmModal({
        icon: "🛡️",
        title: "Approve QC Gate Inspection",
        message: "Are you sure you want to approve this Dispatch Bundle as 'OK for Dispatch'? This will trigger automated Client Email & Transporter SMS.",
        proceedText: "👍 Approve & Trigger Workflows",
        proceedClass: "btn-success"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/dispatch/${dispatchId}/approve`, { method: "POST" });
        const approved = await res.json();
        await window.showAlertModal({
            icon: "🛡️",
            title: "QC Inspection Approved!",
            message: `QC Approval granted for Bundle #${approved.dispatch_number}!\n\nThe dispatch bundle has been forwarded to the Dispatch Module for final clearance & vehicle release.`
        });
        fetchDispatches();
        fetchNotifications();
    } catch (err) {
        window.showAlertModal({
            icon: "❌",
            title: "Approval Error",
            message: err.message
        });
    }
};

window.fetchProjectEngineerQCRecords = async function() {
    const container = document.getElementById("qc-project-engineer-container");
    if (!container) return;
    try {
        const res = await fetch("/api/project-engineer");
        const packages = await res.json();
        renderQCProjectEngineerCards(packages);
    } catch (err) {
        console.error("Error fetching PE QC packages:", err);
    }
};

window.addQCCustomFieldRow = function(pkgId, defaultKey = '', defaultValue = '') {
    const container = document.getElementById(`qc-custom-fields-container-${pkgId}`);
    if (!container) return;

    const rowId = `qc-custom-row-${pkgId}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const div = document.createElement("div");
    div.id = rowId;
    div.className = "qc-custom-field-row";
    div.style.cssText = "display: flex; gap: 8px; align-items: center;";

    div.innerHTML = `
        <input type="text" class="form-control qc-custom-key" placeholder="Field Title (e.g. QAP Cert No, FAT ID)" value="${defaultKey.replace(/"/g, '&quot;')}" style="flex: 1; font-size: 0.82rem;">
        <input type="text" class="form-control qc-custom-val" placeholder="Value / Certificate Info" value="${defaultValue.replace(/"/g, '&quot;')}" style="flex: 1.5; font-size: 0.82rem;">
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('${rowId}').remove()" style="border-color: #EF4444; color: #EF4444; padding: 2px 8px; font-size: 0.75rem;">✖</button>
    `;

    container.appendChild(div);
};

window.addQCFileRow = function(pkgId) {
    const container = document.getElementById(`qc-files-container-${pkgId}`);
    if (!container) return;

    const rowId = `qc-file-row-${pkgId}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const div = document.createElement("div");
    div.id = rowId;
    div.className = "qc-file-upload-row";
    div.style.cssText = "display: flex; gap: 8px; align-items: center;";

    div.innerHTML = `
        <select class="form-control qc-file-category" style="flex: 0.8; font-size: 0.82rem;">
            <option value="QC Inspection Photo">📷 QC Inspection Photo</option>
            <option value="QAP Certificate">🛡️ QAP Certificate</option>
            <option value="Additional MTC">📜 Additional MTC</option>
            <option value="Test Report">🧪 Test Report</option>
            <option value="Compliance Document">📋 Compliance Document</option>
            <option value="Material Photo">📸 Material Photo</option>
            <option value="Packing List">📦 Packing List</option>
            <option value="Other QC Document">📄 Other QC Document</option>
        </select>
        <input type="file" class="form-control qc-file-input" accept="image/*,.pdf,.doc,.docx,.xlsx,.zip" style="flex: 1.2; font-size: 0.82rem;">
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('${rowId}').remove()" style="border-color: #EF4444; color: #EF4444; padding: 2px 8px; font-size: 0.75rem;">✖</button>
    `;

    container.appendChild(div);
};

function renderQCProjectEngineerCards(packages) {
    const container = document.getElementById("qc-project-engineer-container");
    if (!container) return;
    container.innerHTML = "";

    if (!packages || packages.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); padding: 10px 0;">No technical packages currently recorded in repository.</p>`;
        return;
    }

    packages.forEach(p => {
        const isApproved = p.status === 'QC Approved';
        const isNeedsRevision = p.status === 'Needs Revision';

        let badgeHtml = `<span class="badge badge-pending">⌛ Pending QC Approval</span>`;
        if (isApproved) {
            badgeHtml = `<span class="badge badge-verified" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0;">✅ QC Approved — OK for Dispatch</span>`;
        } else if (isNeedsRevision) {
            badgeHtml = `<span class="badge" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">⚠️ Revision Requested by QC Desk</span>`;
        }

        let borderLeftColor = "#7C3AED";
        if (isApproved) borderLeftColor = "#059669";
        if (isNeedsRevision) borderLeftColor = "#DC2626";

        const div = document.createElement("div");
        div.className = "card";
        div.style.background = "#FFFFFF";
        div.style.borderLeft = `5px solid ${borderLeftColor}`;
        div.style.marginBottom = "14px";

        let filesHtml = "";
        if (p.files && p.files.length > 0) {
            p.files.forEach(f => {
                filesHtml += `
                    <div style="background: #F5F3FF; padding: 8px 12px; border-radius: 8px; border: 1px solid #DDD6FE; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <div>
                            <strong style="color: #5B21B6; font-size: 0.85rem;">📁 ${f.file_name || 'Technical File'}</strong>
                            <span class="badge" style="background: #EDE9FE; color: #6D28D9; font-size: 0.72rem; margin-left: 6px;">${f.category || 'General'}</span>
                        </div>
                        ${f.document_path ? `<a href="${window.formatFileUrl ? window.formatFileUrl(f.document_path) : f.document_path}" target="_blank" class="btn btn-outline btn-sm" style="border-color: #7C3AED; color: #7C3AED;">📄 View File</a>` : ''}
                    </div>
                `;
            });
        } else {
            filesHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">No document files attached.</span>`;
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin:0; color: #5B21B6;">📐 ${p.package_name || 'Engineering Package'}</h4>
                ${badgeHtml}
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px; font-size: 0.85rem;">
                <div style="background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <span style="color: #64748B;">Project Ref:</span> <strong style="color: #0F172A;">${p.project_ref || 'N/A'}</strong>
                </div>
                <div style="background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <span style="color: #64748B;">PO Number:</span> <strong style="color: #0F172A;">${p.po_number || 'N/A'}</strong>
                </div>
                <div style="background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <span style="color: #64748B;">Vendor:</span> <strong style="color: #0F172A;">${p.vendor_name || 'N/A'}</strong>
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <strong style="color: #5B21B6; font-size: 0.85rem; display: block; margin-bottom: 6px;">Categorized Drawing & MTC Package Files:</strong>
                ${filesHtml}
            </div>

            <!-- Dynamic Custom QC Fields & Certificates Section -->
            <div style="background: #F8FAFC; padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <strong style="color: #334155; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                        📝 Dynamic QC Details & Custom Certificates (e.g. QAP Certificate, FAT Log)
                    </strong>
                    <button type="button" class="btn btn-outline btn-sm" onclick="addQCCustomFieldRow('${p.id}')" style="border-color: #6D28D9; color: #6D28D9; background: #FFFFFF; font-size: 0.78rem; font-weight: 700;">
                        ➕ Add Custom QC Field / Certificate
                    </button>
                </div>
                <div id="qc-custom-fields-container-${p.id}" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Dynamic key-value pairs added here -->
                </div>
            </div>

            <!-- QC File / Photo Upload Section -->
            <div style="background: #FFFBEB; padding: 14px; border-radius: 10px; border: 1.5px solid #FDE68A; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <strong style="color: #92400E; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                        📷 Upload Additional Files / Photos from QC Inspection
                    </strong>
                    <button type="button" class="btn btn-outline btn-sm" onclick="addQCFileRow('${p.id}')" style="border-color: #D97706; color: #D97706; background: #FFFFFF; font-size: 0.78rem; font-weight: 700;">
                        ➕ Add File / Photo
                    </button>
                </div>
                <p style="font-size: 0.76rem; color: #B45309; margin-bottom: 8px;">Attach QC inspection photos, additional certificates, compliance docs, or any other files. These will be linked to this package and carried through to Dispatch.</p>
                <div id="qc-files-container-${p.id}" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Dynamic file upload rows added here -->
                </div>
            </div>

            <!-- QC Comments / Approval Notes -->
            <div style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 0.8rem; color: #475569; font-weight: 600;">QC Verification Comments & Inspection Notes</label>
                <input type="text" id="qc-comments-input-${p.id}" class="form-control" placeholder="e.g. Approved by QC Manager. QAP & MTC verified against ASME Standards." style="font-size: 0.85rem;" value="${(p.qc_comments || 'Approved by QC Desk — OK for Dispatch').replace(/"/g, '&quot;')}">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" onclick="rejectPEQC('${p.id}')" style="border-color: #DC2626; color: #DC2626; font-weight: 600;">
                    ❌ Reject Package / Request Revision
                </button>
                <button type="button" class="btn btn-success btn-sm" onclick="approvePEQC('${p.id}')" style="background: #059669; border: none; font-weight: 700;">
                    ${isApproved ? '💾 Update QC Certificates' : '👍 Approve Package (OK for Dispatch)'}
                </button>
            </div>
        `;
        container.appendChild(div);

        // Pre-populate any existing custom fields, or inject default row
        if (p.custom_qc_fields && typeof p.custom_qc_fields === "object" && Object.keys(p.custom_qc_fields).length > 0) {
            Object.entries(p.custom_qc_fields).forEach(([k, v]) => {
                addQCCustomFieldRow(p.id, k, v);
            });
        } else {
            addQCCustomFieldRow(p.id, "QAP Certificate No.", "");
        }
    });
}

window.approvePEQC = async function(recordId) {
    const confirmed = await window.showConfirmModal({
        icon: "📐",
        title: "Approve Technical Package",
        message: "Approve this Project Engineer package? The technical drawings and MTCs will be marked 'OK for Dispatch'.",
        proceedText: "👍 Approve & Clear for Dispatch",
        proceedClass: "btn-success"
    });
    if (!confirmed) return;

    // Gather dynamic custom QC fields
    const customFields = {};
    const container = document.getElementById(`qc-custom-fields-container-${recordId}`);
    if (container) {
        container.querySelectorAll(".qc-custom-field-row").forEach(row => {
            const keyEl = row.querySelector(".qc-custom-key");
            const valEl = row.querySelector(".qc-custom-val");
            const key = keyEl ? keyEl.value.trim() : "";
            const val = valEl ? valEl.value.trim() : "";
            if (key && val) {
                customFields[key] = val;
            }
        });
    }

    const commentsInput = document.getElementById(`qc-comments-input-${recordId}`);
    const qcComments = commentsInput ? commentsInput.value : "Approved by QC Desk \u2014 OK for Dispatch";

    const formData = new FormData();
    formData.append("qc_comments", qcComments);
    formData.append("custom_fields_json", JSON.stringify(customFields));

    // Gather QC file uploads
    const filesContainer = document.getElementById(`qc-files-container-${recordId}`);
    const fileCategoriesList = [];
    if (filesContainer) {
        filesContainer.querySelectorAll(".qc-file-upload-row").forEach(row => {
            const fileInput = row.querySelector(".qc-file-input");
            const catSelect = row.querySelector(".qc-file-category");
            if (fileInput && fileInput.files && fileInput.files[0]) {
                formData.append("qc_files", fileInput.files[0]);
                fileCategoriesList.push(catSelect ? catSelect.value : "QC Document");
            }
        });
    }
    formData.append("qc_file_categories_json", JSON.stringify(fileCategoriesList));

    try {
        const res = await fetch(`/api/project-engineer/${recordId}/approve-qc`, {
            method: "POST",
            body: formData
        });
        if (res.ok) {
            const fileCount = fileCategoriesList.length;
            const msg = fileCount > 0
                ? `Project Engineer package approved with ${fileCount} additional file(s) and custom QC details saved!`
                : "Project Engineer package approved and marked OK for Dispatch with custom QC details saved!";
            await window.showAlertModal({ icon: "🎉", title: "Package Approved", message: msg });
            if (typeof window.refreshAllModuleData === 'function') window.refreshAllModuleData();
        }
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
};

window.rejectPEQC = async function(recordId) {
    const confirmed = await window.showConfirmModal({
        icon: "❌",
        title: "Reject Technical Package",
        message: "Request revision for this Project Engineer package?",
        proceedText: "Reject & Request Revision",
        proceedClass: "btn-outline"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/project-engineer/${recordId}/reject-qc`, { method: "POST" });
        if (res.ok) {
            await window.showAlertModal({ icon: "⚠️", title: "Revision Requested", message: "Package returned to Project Engineer for revision." });
            if (typeof window.refreshAllModuleData === 'function') window.refreshAllModuleData();
        }
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
};

// ----------------------------------------------------
// AUDIT & NOTIFICATIONS RENDERER
// ----------------------------------------------------

async function fetchNotifications() {
    try {
        let section = "RECEIVING";
        if (currentSessionUser && currentSessionUser.role) {
            if (currentSessionUser.role === 'receiving') section = "RECEIVING";
            if (currentSessionUser.role === 'dispatch') section = "DISPATCH";
            if (currentSessionUser.role === 'qc_admin') section = "QC_ADMIN";
            if (currentSessionUser.role === 'admin') section = "ALL";
        }
        const res = await fetch(`/api/notifications?section=${section}`);
        const logs = await res.json();
        renderAuditTable(logs, section);
    } catch (err) {
        console.error("Error fetching notifications log:", err);
    }
}

function renderAuditTable(logs, currentSection) {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredLogs = logs.filter(l => {
        if (!currentSection || currentSection.toUpperCase() === "ALL") return true;
        if (!l.section) return true;
        return l.section.toUpperCase() === currentSection.toUpperCase();
    });

    if (filteredLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No audit trails recorded for this section yet.</td></tr>`;
        return;
    }

    filteredLogs.forEach(l => {
        const tr = document.createElement('tr');
        const dt = l.sent_at || (l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : 'Just Now');
        const secBadge = `<span class="badge badge-draft" style="font-size:0.75rem;">${l.section || 'SYSTEM'}</span>`;

        tr.innerHTML = `
            <td><small style="color:var(--text-muted);">${dt}</small></td>
            <td><strong>${l.subject || 'System Action'}</strong></td>
            <td>${l.message_body || 'N/A'}</td>
            <td>${l.recipient || 'N/A'}</td>
            <td>${secBadge}</td>
            <td><span class="badge badge-verified">Logged</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// MOBILE-OPTIMIZED EMAIL DEEP-LINK ROUTER
// ----------------------------------------------------

window.handleDeepLinkRouting = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    let targetTab = urlParams.get("tab") || urlParams.get("view") || urlParams.get("section");
    let recordId = urlParams.get("id") || urlParams.get("dispatch_id") || urlParams.get("invoice_id") || urlParams.get("challan_id");

    if (hash && hash.startsWith("#")) {
        const parts = hash.slice(1).split("-");
        if (parts.length >= 1 && !targetTab) targetTab = parts[0];
        if (parts.length >= 2 && !recordId) recordId = parts.slice(1).join("-");
    }

    if (!targetTab && !recordId) return;

    let tabId = "receiving-tab";
    if (targetTab) {
        const lower = targetTab.toLowerCase();
        if (lower.includes("disp") || lower.includes("ship")) tabId = "dispatch-tab";
        else if (lower.includes("rec") || lower.includes("invoic") || lower.includes("challan")) tabId = "receiving-tab";
        else if (lower.includes("qc") || lower.includes("gate")) tabId = "qc-tab";
        else if (lower.includes("audit") || lower.includes("log")) tabId = "audit-tab";
        else if (lower.includes("calen") || lower.includes("pay")) tabId = "calendar-tab";
    }

    const navItem = document.getElementById(`nav-item-${tabId.replace('-tab', '')}`);
    if (navItem && navItem.style.display !== 'none') {
        switchMainTab(tabId, navItem);
    }

    if (recordId) {
        showDeepLinkModal(tabId, recordId);
    }
};

window.showDeepLinkModal = function(tabId, recordId) {
    const modal = document.getElementById("deeplink-preview-modal");
    const iconEl = document.getElementById("deeplink-modal-icon");
    const titleEl = document.getElementById("deeplink-modal-title");
    const bodyEl = document.getElementById("deeplink-modal-body");
    if (!modal || !bodyEl) return;

    let foundRecord = null;
    let recordType = "Record";

    if (tabId === "dispatch-tab" || tabId === "qc-tab") {
        foundRecord = (currentDispatches || []).find(d => d.id === recordId || d.dispatch_number === recordId);
        recordType = "Tri-Party Dispatch Bundle";
    } else if (tabId === "receiving-tab") {
        foundRecord = (currentReceivingRecords || []).find(r => r.id === recordId || r.invoice_number === recordId);
        recordType = "Inward Receiving Invoice";
    }

    if (iconEl) iconEl.innerText = "📧";
    if (titleEl) titleEl.innerText = `Email Link: ${recordType}`;

    if (foundRecord) {
        if (recordType.includes("Dispatch")) {
            bodyEl.innerHTML = `
                <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
                    <div style="font-weight: 800; color: var(--semco-blue); font-size: 1.05rem;">Dispatch Bundle #${foundRecord.dispatch_number}</div>
                    <div style="margin-top: 6px;">Client: <strong>${foundRecord.client_name}</strong> (${foundRecord.client_phone})</div>
                    <div>Driver: ${foundRecord.driver_name} (${foundRecord.driver_phone})</div>
                    <div>Vehicle: ${foundRecord.vehicle_number}</div>
                    <div style="margin-top: 6px;">Status: <span class="badge badge-verified">${foundRecord.status}</span></div>
                </div>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Directly linked from your email client notification. Click below to continue in workspace.</p>
            `;
        } else {
            bodyEl.innerHTML = `
                <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
                    <div style="font-weight: 800; color: var(--semco-blue); font-size: 1.05rem;">Invoice #${foundRecord.invoice_number}</div>
                    <div style="margin-top: 6px;">Vendor: <strong>${foundRecord.vendor_name}</strong></div>
                    <div>Amount: <strong>₹${(foundRecord.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></div>
                    <div style="margin-top: 6px;">Status: <span class="badge badge-verified">${foundRecord.status}</span></div>
                </div>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Directly linked from your email notification.</p>
            `;
        }
    } else {
        bodyEl.innerHTML = `
            <div style="padding: 12px; background: #EFF6FF; border-radius: 12px; color: var(--semco-blue); font-weight: 600;">
                🔗 Deep-Link Target ID: <strong>${recordId}</strong>
            </div>
            <p style="margin-top: 10px; color: var(--text-muted); font-size: 0.85rem;">Opened workspace view: <strong>${tabId.replace('-tab', '').toUpperCase()}</strong>.</p>
        `;
    }

    modal.style.display = "flex";
};

window.closeDeepLinkModal = function() {
    const modal = document.getElementById("deeplink-preview-modal");
    if (modal) modal.style.display = "none";
};

// ----------------------------------------------------
// PASSWORD VISIBILITY TOGGLE HANDLER
// ----------------------------------------------------

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        if (btn) btn.innerText = "🙈";
    } else {
        input.type = "password";
        if (btn) btn.innerText = "👁️";
    }
};

// ----------------------------------------------------
// GLOBAL INTERACTIVE PAYMENT & COLLECTION MODAL HANDLERS
// ----------------------------------------------------

window._currentPaymentModalData = null;

window.openPaymentModal = function(config) {
    // config = { id, targetType, refText, totalAmount, alreadyPaid }
    window._currentPaymentModalData = config;

    const modal = document.getElementById("global-payment-modal");
    if (!modal) return;

    const idInput = document.getElementById("payment-modal-record-id");
    const typeInput = document.getElementById("payment-modal-target-type");
    const iconEl = document.getElementById("payment-modal-icon");
    const titleEl = document.getElementById("payment-modal-title");
    const subtitleEl = document.getElementById("payment-modal-subtitle");
    const refEl = document.getElementById("payment-modal-ref");

    const totalEl = document.getElementById("payment-modal-total");
    const paidEl = document.getElementById("payment-modal-paid");
    const balEl = document.getElementById("payment-modal-balance");

    const amtInput = document.getElementById("payment-modal-amount");
    const dateInput = document.getElementById("payment-modal-date");
    const notesInput = document.getElementById("payment-modal-notes");

    idInput.value = config.id;
    typeInput.value = config.targetType;

    const total = parseFloat(config.totalAmount) || 0.0;
    const paid = parseFloat(config.alreadyPaid) || 0.0;
    const balance = Math.max(0.0, total - paid);

    if (config.targetType === "RECEIVING") {
        iconEl.innerText = "💳";
        titleEl.innerText = "Record Vendor Payment (Payable)";
        subtitleEl.innerText = "Vendor Invoice Reference";
    } else {
        iconEl.innerText = "💰";
        titleEl.innerText = "Record Client Payment (Receivable)";
        subtitleEl.innerText = "Client Dispatch Reference";
    }

    refEl.innerText = config.refText || `#${config.id}`;
    totalEl.innerText = `₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    paidEl.innerText = `₹${paid.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    balEl.innerText = `₹${balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    // Select FULL by default
    document.getElementById("pay-opt-full").checked = true;
    amtInput.value = balance.toFixed(2);
    dateInput.value = new Date().toISOString().split('T')[0];
    notesInput.value = "";

    handlePaymentTypeToggle();
    modal.style.display = "flex";
};

window.closePaymentModal = function() {
    const modal = document.getElementById("global-payment-modal");
    if (modal) modal.style.display = "none";
    window._currentPaymentModalData = null;
};

window.handlePaymentTypeToggle = function() {
    const isFull = document.getElementById("pay-opt-full").checked;
    const fullLabel = document.getElementById("pay-opt-full-label");
    const partialLabel = document.getElementById("pay-opt-partial-label");
    const amtInput = document.getElementById("payment-modal-amount");

    const config = window._currentPaymentModalData || {};
    const total = parseFloat(config.totalAmount) || 0.0;
    const paid = parseFloat(config.alreadyPaid) || 0.0;
    const balance = Math.max(0.0, total - paid);

    if (isFull) {
        fullLabel.style.border = "2px solid #166534";
        fullLabel.style.background = "#F0FDF4";
        partialLabel.style.border = "2px solid #CBD5E1";
        partialLabel.style.background = "#FFFFFF";

        amtInput.value = balance.toFixed(2);
    } else {
        partialLabel.style.border = "2px solid #C2410C";
        partialLabel.style.background = "#FFF7ED";
        fullLabel.style.border = "2px solid #CBD5E1";
        fullLabel.style.background = "#FFFFFF";

        amtInput.value = (balance > 0 ? (balance / 2).toFixed(2) : "0.00");
        amtInput.focus();
    }

    updatePaymentModalPreview();
};

window.updatePaymentModalPreview = function() {
    const calcPreview = document.getElementById("payment-modal-calc-preview");
    const amtInput = document.getElementById("payment-modal-amount");
    const config = window._currentPaymentModalData || {};

    const total = parseFloat(config.totalAmount) || 0.0;
    const alreadyPaid = parseFloat(config.alreadyPaid) || 0.0;
    const enteredAmt = parseFloat(amtInput.value) || 0.0;

    if (!calcPreview) return;

    if (enteredAmt <= 0) {
        calcPreview.style.display = "none";
        return;
    }

    const newTotalPaid = alreadyPaid + enteredAmt;
    const newRemaining = Math.max(0.0, total - newTotalPaid);

    calcPreview.style.display = "block";

    if (newRemaining <= 0.01) {
        calcPreview.style.background = "#F0FDF4";
        calcPreview.style.border = "1px solid #86EFAC";
        calcPreview.style.color = "#166534";
        calcPreview.innerHTML = `<strong>✅ 100% Full Settlement:</strong> Payment of <strong>₹${enteredAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong> will settle the complete remaining balance. Status will update to <span class="badge badge-paid">Paid / Collected</span>.`;
    } else {
        calcPreview.style.background = "#FFF7ED";
        calcPreview.style.border = "1px solid #FDBA74";
        calcPreview.style.color = "#C2410C";
        calcPreview.innerHTML = `<strong>⌛ Partial Payment:</strong> Payment of <strong>₹${enteredAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong> leaving a remaining balance of <strong>₹${newRemaining.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>. Status will update to <span class="badge" style="background:#FFEDD5; color:#C2410C; border:1px solid #FDBA74;">Partially Paid</span>.`;
    }
};

window.submitPaymentModal = async function(event) {
    event.preventDefault();

    const recordId = document.getElementById("payment-modal-record-id").value;
    const targetType = document.getElementById("payment-modal-target-type").value;
    const isFull = document.getElementById("pay-opt-full").checked;
    const paymentType = isFull ? "FULL" : "PARTIAL";
    const amount = document.getElementById("payment-modal-amount").value;
    const date = document.getElementById("payment-modal-date").value;
    const notes = document.getElementById("payment-modal-notes").value;

    const formData = new FormData();
    formData.append("payment_type", paymentType);
    formData.append(targetType === "RECEIVING" ? "paid_amount" : "collected_amount", amount);
    formData.append(targetType === "RECEIVING" ? "payment_date" : "collection_date", date);
    formData.append(targetType === "RECEIVING" ? "payment_notes" : "collection_notes", notes);

    const endpoint = targetType === "RECEIVING"
        ? `/api/receiving/${recordId}/record-payment`
        : `/api/dispatch/${recordId}/record-collection`;

    try {
        const res = await fetch(endpoint, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Server error recording payment");

        closePaymentModal();
        window.showAlertModal({
            icon: paymentType === "FULL" ? "✅" : "⌛",
            title: "Payment Recorded",
            message: `Payment of ₹${parseFloat(amount).toLocaleString('en-IN', {minimumFractionDigits: 2})} successfully recorded as ${paymentType === "FULL" ? "FULLY PAID" : "PARTIALLY PAID"}!`
        });

        if (typeof fetchReceivingRecords === 'function') fetchReceivingRecords();
        if (typeof fetchDispatches === 'function') fetchDispatches();
        if (typeof fetchNotifications === 'function') fetchNotifications();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Payment Error", message: err.message });
    }
};

// ----------------------------------------------------
// MODULE 3: PROJECT ENGINEER DESK FUNCTIONS
// ----------------------------------------------------

let peFileRowCount = 0;
let projectEngineerRecordsCache = [];

function initProjectEngineerFormRows() {
    const container = document.getElementById("pe-file-rows-container");
    if (!container) return;
    container.innerHTML = "";
    peFileRowCount = 0;
    addProjectEngineerFileRow();
}

window.addProjectEngineerFileRow = function() {
    const container = document.getElementById("pe-file-rows-container");
    if (!container) return;
    peFileRowCount++;
    const rowId = `pe-file-row-${peFileRowCount}`;

    const rowDiv = document.createElement("div");
    rowDiv.id = rowId;
    rowDiv.className = "pe-file-row";
    rowDiv.style.cssText = "background: #FFFFFF; padding: 14px; border-radius: 10px; border: 1px solid #DDD6FE; display: flex; flex-direction: column; gap: 10px;";

    rowDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #6D28D9; font-size: 0.85rem;">📄 Attached File #${peFileRowCount}</strong>
            ${peFileRowCount > 1 ? `<button type="button" class="btn btn-outline btn-sm" onclick="removeProjectEngineerFileRow('${rowId}')" style="border-color: #EF4444; color: #EF4444; padding: 2px 8px; font-size: 0.75rem;">✖ Remove File</button>` : ''}
        </div>
        <div class="form-row">
            <div class="form-group" style="flex: 1;">
                <label class="form-label">Select File (PDF, Image, Photo, CAD, Sheet) *</label>
                <input type="file" class="form-control pe-file-input" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.dwg,.dxf,.step,.stp,.iges,.ppt,.pptx,.csv,.txt,.zip,.rar" required>
            </div>
            <div class="form-group" style="flex: 1;">
                <label class="form-label">Manual File Category Tag *</label>
                <select class="form-control pe-category-select" required onchange="handleCategorySelectChange(this, '${rowId}')">
                    <option value="Material Test Certificate (MTC)">📜 Material Test Certificate (MTC)</option>
                    <option value="Technical Drawing">📐 Technical Drawing / Blueprint</option>
                    <option value="Quality Assurance Report">🛡️ Quality Assurance (QA) Report</option>
                    <option value="Mill Test Sheet">🏭 Mill Test Sheet</option>
                    <option value="Inspection Certificate">🔍 Inspection Certificate</option>
                    <option value="Factory Acceptance Test (FAT)">⚡ Factory Acceptance Test (FAT)</option>
                    <option value="Material Photo">📷 Material Photo / Picture</option>
                    <option value="Site Inspection Photo">📸 Site Inspection Photo</option>
                    <option value="Packing List">📦 Packing List</option>
                    <option value="Compliance Document">📋 Compliance / Regulatory Document</option>
                    <option value="Test Report">🧪 Test Report / Lab Result</option>
                    <option value="CAD File">🖥️ CAD / 3D Model File</option>
                    <option value="CUSTOM">✍️ Custom Manual Category...</option>
                </select>
            </div>
        </div>
        <div class="form-group pe-custom-category-group" id="${rowId}-custom-group" style="display: none;">
            <label class="form-label" style="color: #6D28D9; font-weight: 600;">Specify Custom Category Name *</label>
            <input type="text" class="form-control pe-custom-category-input" placeholder="e.g. Compliance Certificate, Photo Inspection Log">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">File-Specific Remarks / Technical Specs</label>
            <input type="text" class="form-control pe-file-notes-input" placeholder="e.g. Grade 316SS Heat #88921, Passed 150 PSI Hydro Test">
        </div>
    `;

    container.appendChild(rowDiv);
};

window.removeProjectEngineerFileRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
};

window.handleCategorySelectChange = function(selectEl, rowId) {
    const customGroup = document.getElementById(`${rowId}-custom-group`);
    if (customGroup) {
        if (selectEl.value === "CUSTOM") {
            customGroup.style.display = "block";
            const customInput = customGroup.querySelector(".pe-custom-category-input");
            if (customInput) customInput.required = true;
        } else {
            customGroup.style.display = "none";
            const customInput = customGroup.querySelector(".pe-custom-category-input");
            if (customInput) customInput.required = false;
        }
    }
};

window.fetchProjectEngineerPackages = async function() {
    try {
        const res = await fetch("/api/project-engineer");
        if (!res.ok) return;
        const packages = await res.json();
        projectEngineerRecordsCache = packages;

        renderProjectEngineerTable(packages);
        renderQCProjectEngineerPackages(packages);
    } catch (err) {
        console.error("Error fetching project engineer packages:", err);
    }
};

function renderProjectEngineerTable(packages) {
    const tbody = document.getElementById("pe-table-body");
    const badge = document.getElementById("pe-count-badge");

    if (badge) badge.innerText = `${packages.length} Package(s)`;
    if (!tbody) return;

    if (!packages || packages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No Project Engineer packages uploaded yet. Use the form above to attach multi-file packages with manual categories.</td></tr>`;
        return;
    }

    tbody.innerHTML = packages.map(pkg => {
        const filesHtml = (pkg.files || []).map(f => `
            <div style="margin-bottom: 4px;">
                <span class="badge" style="background:#EDE9FE; color:#5B21B6; border:1px solid #DDD6FE;">${f.category}</span>
                <a href="${window.formatFileUrl ? window.formatFileUrl(f.document_path) : (f.document_path || '#')}" target="_blank" style="font-size: 0.8rem; text-decoration: underline; margin-left: 4px; color: #4C1D95;">${f.file_name}</a>
                ${f.notes ? `<div style="font-size: 0.72rem; color: #64748B;">Note: ${f.notes}</div>` : ''}
            </div>
        `).join("") || `<span style="color:var(--text-muted); font-size:0.8rem;">No files</span>`;

        let statusBadge = `<span class="badge badge-draft">Draft / Logged</span>`;
        let actionBtn = `
            <button type="button" class="btn btn-primary btn-sm" onclick="sendPackageForQCApproval('${pkg.id}')" style="background: linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%); border:none; font-weight:700;">
                📤 Send for QC Approval
            </button>
        `;

        if (pkg.status === 'Pending QC') {
            statusBadge = `<span class="badge badge-pending">⌛ Pending QC Approval</span>`;
            actionBtn = `<span class="badge badge-pending" style="font-size:0.75rem;">⌛ In QC Desk Review</span>`;
        } else if (pkg.status === 'QC Approved') {
            statusBadge = `<span class="badge badge-verified" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0;">✅ QC Approved</span>`;
            actionBtn = `<span class="badge badge-verified" style="background:#ECFDF5; color:#047857; border:1px solid #A7F3D0; font-size:0.75rem;">✅ OK for Dispatch</span>`;
        } else if (pkg.status === 'Needs Revision') {
            statusBadge = `<span class="badge" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">⚠️ Needs Revision</span>`;
            actionBtn = `
                <button type="button" class="btn btn-primary btn-sm" onclick="sendPackageForQCApproval('${pkg.id}')" style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); border:none; font-weight:700;">
                    🔄 Re-submit to QC
                </button>
            `;
        }

        let customQCFieldsHtml = "";
        if (pkg.custom_qc_fields && typeof pkg.custom_qc_fields === "object" && Object.keys(pkg.custom_qc_fields).length > 0) {
            customQCFieldsHtml = `
                <div style="margin-top: 6px; padding: 4px 8px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; font-size: 0.75rem; color: #166534;">
                    <strong style="display:block; margin-bottom:2px;">🛡️ Custom QC Certificates & Details:</strong>
                    ${Object.entries(pkg.custom_qc_fields).map(([k, v]) => `<div>• <strong>${k}:</strong> ${v}</div>`).join('')}
                </div>
            `;
        }

        return `
            <tr>
                <td><strong>${pkg.package_name}</strong></td>
                <td><span class="badge badge-draft">${pkg.project_ref}</span></td>
                <td>
                    <div style="font-size: 0.85rem;"><strong>PO:</strong> ${pkg.po_number || 'N/A'}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${pkg.vendor_name || 'N/A'}</div>
                </td>
                <td>
                    ${filesHtml}
                    ${customQCFieldsHtml}
                </td>
                <td style="font-size: 0.82rem;">${pkg.engineer_name || 'Project Engineer'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                        ${actionBtn}
                        <button class="btn btn-outline btn-sm" onclick="deleteProjectEngineerPackage('${pkg.id}')" style="border-color:#EF4444; color:#EF4444;">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

window.sendPackageForQCApproval = async function(recordId) {
    const confirmed = await window.showConfirmModal({
        icon: "🛡️",
        title: "Send for QC Gate Approval",
        message: "Submit this technical package to the QC Gate Desk for verification and dispatch clearance?",
        proceedText: "📤 Submit to QC Desk",
        proceedClass: "btn-primary"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/project-engineer/${recordId}/submit-qc`, { method: "POST" });
        if (res.ok) {
            await window.showAlertModal({ icon: "🚀", title: "Sent to QC Desk", message: "Technical package successfully submitted to QC Desk for approval!" });
            fetchProjectEngineerPackages();
            if (typeof fetchProjectEngineerQCRecords === 'function') fetchProjectEngineerQCRecords();
            fetchNotifications();
        }
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Submission Error", message: err.message });
    }
};

window.handleProjectEngineerSubmit = async function(event) {
    event.preventDefault();

    const packageName = document.getElementById("pe-package-name").value;
    const projectRef = document.getElementById("pe-project-ref").value;
    const poNumber = document.getElementById("pe-po-number").value;
    const vendorName = document.getElementById("pe-vendor-name").value;
    const engineerName = document.getElementById("pe-engineer-name").value;
    const notes = document.getElementById("pe-notes").value;

    const rows = document.querySelectorAll(".pe-file-row");
    if (rows.length === 0) {
        window.showAlertModal({ icon: "⚠️", title: "Missing File Attachment", message: "Please attach at least one file to save package." });
        return;
    }

    const formData = new FormData();
    formData.append("package_name", packageName);
    formData.append("project_ref", projectRef);
    formData.append("po_number", poNumber);
    formData.append("vendor_name", vendorName);
    formData.append("engineer_name", engineerName);
    formData.append("notes", notes);

    const categories = [];
    const notesList = [];
    let fileAttachedCount = 0;

    rows.forEach(row => {
        const fileInput = row.querySelector(".pe-file-input");
        const categorySelect = row.querySelector(".pe-category-select");
        const customInput = row.querySelector(".pe-custom-category-input");
        const fileNotesInput = row.querySelector(".pe-file-notes-input");

        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append("files", fileInput.files[0]);
            fileAttachedCount++;

            let catValue = categorySelect ? categorySelect.value : "General Document";
            if (catValue === "CUSTOM" && customInput) {
                catValue = customInput.value.trim() || "Custom Category";
            }
            categories.push(catValue);
            notesList.push(fileNotesInput ? fileNotesInput.value.trim() : "");
        }
    });

    if (fileAttachedCount === 0) {
        window.showAlertModal({ icon: "⚠️", title: "No Files Selected", message: "Please select a file for each row attached." });
        return;
    }

    formData.append("categories_json", JSON.stringify(categories));
    formData.append("notes_json", JSON.stringify(notesList));

    try {
        const res = await fetch("/api/project-engineer", {
            method: "POST",
            body: formData
        });

        if (!res.ok) throw new Error("Failed to save project engineer package.");

        document.getElementById("project-engineer-package-form").reset();
        initProjectEngineerFormRows();

        window.showAlertModal({
            icon: "💾",
            title: "Package Saved",
            message: `Project Engineering Package '${packageName}' with ${fileAttachedCount} categorized document(s) successfully logged into repository!`
        });

        fetchProjectEngineerPackages();
        if (typeof fetchNotifications === 'function') fetchNotifications();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Submission Error", message: err.message });
    }
};

window.submitProjectEngineerQC = async function(id) {
    try {
        const res = await fetch(`/api/project-engineer/${id}/submit-qc`, { method: "POST" });
        if (!res.ok) throw new Error("QC submission failed.");
        window.showAlertModal({ icon: "🛡️", title: "QC Submission", message: "Package submitted for QC Desk verification!" });
        fetchProjectEngineerPackages();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
};

window.approveProjectEngineerQC = async function(id) {
    const comments = prompt("Enter QC Verification Comments:", "QC Gate Approval Completed — Documents Verified");
    if (comments === null) return;

    const formData = new FormData();
    formData.append("qc_comments", comments || "Approved by QC Desk");

    try {
        const res = await fetch(`/api/project-engineer/${id}/approve-qc`, {
            method: "POST",
            body: formData
        });
        if (!res.ok) throw new Error("Approval failed.");
        window.showAlertModal({ icon: "🛡️", title: "QC Approved", message: "Project Engineer package approved and marked Verified!" });
        fetchProjectEngineerPackages();
        if (typeof fetchNotifications === 'function') fetchNotifications();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
};

window.rejectProjectEngineerQC = async function(id) {
    const comments = prompt("Enter Reason for Revision Request:", "Discrepancy in test certificate parameters");
    if (!comments) return;

    const formData = new FormData();
    formData.append("qc_comments", comments);

    try {
        const res = await fetch(`/api/project-engineer/${id}/reject-qc`, {
            method: "POST",
            body: formData
        });
        if (!res.ok) throw new Error("Rejection failed.");
        window.showAlertModal({ icon: "⚠️", title: "Revision Requested", message: "Package returned to Project Engineer for revision." });
        fetchProjectEngineerPackages();
        if (typeof fetchNotifications === 'function') fetchNotifications();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
};

window.deleteProjectEngineerPackage = async function(id) {
    const confirmed = await window.showConfirmModal({
        icon: "🗑️",
        title: "Delete Project Package",
        message: "Are you sure you want to delete this project package record?",
        proceedText: "Delete",
        proceedClass: "btn-danger"
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/project-engineer/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed.");
        fetchProjectEngineerPackages();
    } catch (err) {
        window.showAlertModal({ icon: "❌", title: "Error", message: err.message });
    }
};

// Initialize default row on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        initProjectEngineerFormRows();
    }, 300);
});
