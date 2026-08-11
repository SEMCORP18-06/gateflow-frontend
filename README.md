# GateFlow SCM — Mobile-First Web Application

GateFlow SCM Frontend is a modern, responsive web application for **Supply Chain Management**, **Receiving OCR Desk**, **QC Inspections**, **Purchase Orders**, and **Tri-Party Dispatch Tracking**.

---

## 🌟 Features

- **Glassmorphism Theme & Micro-Animations**: Ultra-fast HTML5/CSS3/ES6 user interface with custom color palettes and responsive layouts.
- **Receival Desk & OCR Upload**: In-browser document capture with side-by-side OCR field verification.
- **QC Inspection Portal**: Admin verification loops for receiving records, engineering packages, and dispatch cycles.
- **Interactive Payment Calendar**: Visual payment status tracking (Overdue, Due Soon, Settled) with filter controls.
- **Tri-Party Dispatch Initiation**: Multi-step wizard for capturing supplier, transporter, driver, and client details.
- **Dynamic API Config**: Automatic API routing connecting to Vercel backend (`https://gateflow-backend.vercel.app`) or local backend server.

---

## 🛠️ Repository Structure

```
gateflow-frontend/
├── index.html             # Mobile-first single-page web app
├── css/
│   └── styles.css         # Custom styling & glassmorphism dark theme
├── js/
│   ├── config.js          # Dynamic API URL resolution wrapper
│   ├── app.js             # Router, Auth session & UI renderers
│   ├── receiving.js       # Module 1 OCR upload & Payment Calendar logic
│   ├── dispatch.js        # Module 2 Tri-Party Dispatch wizard
│   ├── pos.js             # Purchase Order builder & management
│   ├── payments.js        # Accounts payable & receivable trackers
│   └── exports.js         # Client-side export triggers
├── assets/
│   ├── logo.jpg           # Brand logo image
│   └── semco_logo.png     # Application header favicon & branding
├── vercel.json            # Vercel static route rewrite config
└── README.md              # Technical documentation
```

---

## 🚀 Local Execution & Vercel Hosting

### Host on Vercel
1. Import **`SEMCORP18-06/gateflow-frontend`** into your Vercel Dashboard.
2. Deploy directly — zero build commands required!

### Run Locally
Serve using any static web server (e.g. VS Code Live Server or Python HTTP server):
```bash
python -m http.server 3000
```
Then open `http://localhost:3000` in your browser.
