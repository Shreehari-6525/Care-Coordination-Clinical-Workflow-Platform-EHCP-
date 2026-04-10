# EHCP — Care Coordination & Clinical Workflow Platform

> Enterprise-grade Healthcare Information Platform with Role-Based Access Control, 
> Clinical Triage Engine, Treatment Plan Workflows, and HIPAA-Compliant Audit Trail.

---

## 📁 Project Structure

```
ehcp/
├── index.html              ← Main HTML shell (login + app skeleton)
├── css/
│   └── styles.css          ← Complete design system & global styles
├── js/
│   ├── app.js              ← 🚀 Entry point — routing, login, shell orchestration
│   ├── auth.js             ← 🔐 Authentication, RBAC permission matrix, role metadata
│   ├── database.js         ← 🗄️  IndexedDB wrapper — CRUD, seeding, schema
│   ├── state.js            ← 🧠 Global state, audit logging, triage rules, utilities
│   └── views.js            ← 📄 All page renderers (dashboard, patients, triage, etc.)
└── README.md               ← This file
```

---

## 🔑 Role Credentials

| Role               | Username     | Password   | Default Landing     |
|--------------------|--------------|------------|---------------------|
| Admin              | admin        | admin123   | Dashboard           |
| Doctor             | dr.smith     | doc123     | Dashboard           |
| Specialist         | dr.jones     | spec123    | Dashboard           |
| Nurse              | nurse.ray    | nurse123   | Dashboard           |
| Receptionist       | reception    | recep123   | Appointments        |
| Lab Technician     | labtech      | lab123     | Lab & Diagnostics   |
| Billing Officer    | billing      | bill123    | Billing             |
| Compliance Officer | compliance   | comp123    | Audit & Compliance  |
| Patient            | patient1     | pat123     | My Health Portal    |

---

## 🧩 Modules & Access Matrix

| Module              | Admin | Doctor | Nurse | Receptionist | Lab Tech | Billing | Compliance | Patient |
|---------------------|:-----:|:------:|:-----:|:------------:|:--------:|:-------:|:----------:|:-------:|
| Dashboard           | ✅    | ✅     | ✅    | ✅           | ✅       | ✅      | ✅         | ❌      |
| Patients List       | ✅    | ✅     | ✅    | ✅           | ❌       | ✅      | ✅         | ❌      |
| Patient Detail      | ✅    | ✅     | ✅    | ✅           | ✅       | ✅      | ✅         | ❌      |
| Create Patient      | ✅    | ❌     | ❌    | ✅           | ❌       | ❌      | ❌         | ❌      |
| Triage Queue        | ✅    | ✅     | ✅    | view only    | ❌       | ❌      | ❌         | ❌      |
| Perform Triage      | ✅    | ✅     | ✅    | ❌           | ❌       | ❌      | ❌         | ❌      |
| Treatment Plans     | ✅    | ✅     | view  | ❌           | ❌       | ❌      | ❌         | ❌      |
| Create/Edit Plan    | ✅    | ✅     | ❌    | ❌           | ❌       | ❌      | ❌         | ❌      |
| Approve Treatment   | ✅    | ✅     | ❌    | ❌           | ❌       | ❌      | ❌         | ❌      |
| Lab Orders          | ✅    | ✅     | view  | ❌           | ✅       | ❌      | ❌         | ❌      |
| Upload Lab Results  | ✅    | ❌     | ❌    | ❌           | ✅       | ❌      | ❌         | ❌      |
| Billing             | ✅    | view   | ❌    | ❌           | ❌       | ✅      | ❌         | ❌      |
| Analytics/Reports   | ✅    | ✅     | ❌    | ❌           | ❌       | ✅      | ✅         | ❌      |
| Audit Logs          | ✅    | ❌     | ❌    | ❌           | ❌       | ❌      | ✅         | ❌      |
| Admin Panel         | ✅    | ❌     | ❌    | ❌           | ❌       | ❌      | ❌         | ❌      |
| My Health Portal    | ❌    | ❌     | ❌    | ❌           | ❌       | ❌      | ❌         | ✅      |

---

## 🔄 Patient Care Pathway

```
DRAFT → SUBMITTED → TRIAGE_PENDING → TRIAGED → 
ASSIGNED_TO_DOCTOR → CONSULTED → TREATMENT_STARTED → 
COMPLETED → FOLLOW_UP_REQUIRED
```

## 🤖 Triage Rule Engine

```
IF symptoms includes "Chest Pain"    → priority=HIGH,   assign=Emergency Doctor
IF symptoms includes "Stroke/Seizure"→ priority=HIGH,   assign=Specialist
IF age > 65 AND systolic > 140       → priority=HIGH    (escalated)
IF systolic > 130 OR age > 55        → priority=MEDIUM
DEFAULT                              → priority=LOW
```

## 💊 Treatment Plan Approval Workflow

```
IF medication = Controlled Substance → require senior_doctor_approval
IF cost > patient.costLimit          → require insurance_preapproval
```

---

## 🚀 How to Run

### Option A: Direct Browser (recommended)
Open `index.html` directly in a modern browser.
> Note: ES Modules require a server for imports to work correctly.

### Option B: Local HTTP Server (recommended for full ES module support)
```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# Then open: http://localhost:8080
```

---

## 🗄️ Persistence

All data is stored in **IndexedDB** (`EHCP_DB_v2`) — persists across browser sessions.

Stores:
- `patients` — Patient records with clinical data
- `appointments` — Scheduling with double-book prevention
- `labOrders` — Lab tests with SLA tracking
- `treatmentPlans` — Versioned plans with approval workflows
- `auditLogs` — Immutable HIPAA-compliant audit trail
- `notifications` — Real-time notification queue
- `users` — Credentials and role assignments

---

## ⚡ Edge Cases Simulated (Admin Panel)

- Emergency override access (bypass RBAC for critical cases)
- Insurance denial scenario
- Data retention expiration alert (HIPAA 7-year rule)
- Specialist conflict (conflicting treatment recommendations)
- Post-discharge edit logging

---

## 🏗️ Architecture Notes

- **Zero framework dependencies** — Pure ES6 modules, Vanilla JS
- **IndexedDB** for offline-capable persistent storage
- **Event-driven navigation** via `CustomEvent("navigate")`
- **RBAC** enforced at both nav level (menu hidden) and render level (access denied block)
- **Chart.js** loaded from CDN for analytics charts
- **Sora + JetBrains Mono** Google Fonts for professional medical-grade typography
