/**
 * EHCP — View Renderers
 * All page modules: Dashboard, Patients, Triage, Lab, etc.
 */

import { state, statusBadge, priorityBadge, fmtDate, fmtDateTime, timeAgo, uid,
         updatePatientStatus, applyTriageRules, addAuditLog, addNotification } from './state.js';
import { can, ROLE_META } from './auth.js';
import { saveRecord, deleteRecord, STORES } from './database.js';

/* ============================================================
   SHARED HELPERS
   ============================================================ */
const role = () => state.session?.role;

function accessDenied(permission) {
  return `<div class="access-denied">
    <div class="ad-icon">🔒</div>
    <h3>Access Restricted</h3>
    <p>Your role <strong>${role()}</strong> does not have <em>${permission}</em> permission.</p>
    <p style="margin-top:8px;font-size:0.72rem;color:var(--clr-text-dim)">Contact your administrator if you need access.</p>
  </div>`;
}

function emptyState(icon, title, sub) {
  return `<div class="access-denied" style="opacity:0.6">
    <div class="ad-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${sub}</p>
  </div>`;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
export function renderDashboard(container) {
  if (!can("view_dashboard", role())) { container.innerHTML = accessDenied("view_dashboard"); return; }

  const totalPatients   = state.patients.length;
  const triagePending   = state.patients.filter(p => p.status === "TRIAGE_PENDING").length;
  const activeRx        = state.treatmentPlans.filter(t => t.status === "ACTIVE").length;
  const todayAppts      = state.appointments.filter(a => a.date === new Date().toISOString().split("T")[0]).length;
  const highPriority    = state.patients.filter(p => p.priority === "HIGH").length;
  const pendingLabs     = state.labOrders.filter(l => l.status !== "Results Uploaded").length;
  const unreadNotifs    = state.notifications.filter(n => !n.read).length;

  const statCards = [
    { icon:"👥", label:"Total Patients", value: totalPatients, accent:"#3b82f6", rgb:"59,130,246" },
    { icon:"🚨", label:"Triage Pending", value: triagePending, accent:"#ef4444", rgb:"239,68,68",  badge: triagePending > 0 ? "urgent" : "" },
    { icon:"💊", label:"Active Treatments",value: activeRx,   accent:"#10b981", rgb:"16,185,129" },
    { icon:"📅", label:"Today's Appointments",value: todayAppts,accent:"#8b5cf6", rgb:"139,92,246" },
    { icon:"🔴", label:"High Priority",  value: highPriority, accent:"#ef4444", rgb:"239,68,68"  },
    { icon:"🔬", label:"Pending Lab Orders",value: pendingLabs,accent:"#f59e0b", rgb:"245,158,11" },
  ].filter((_, i) => {
    // Limit stats visible per role
    if (role() === "Patient")           return false; // patients see own portal
    if (role() === "Lab Technician")    return [2,5].includes(i);
    if (role() === "Billing Officer")   return [0,3].includes(i);
    if (role() === "Compliance Officer")return [0,6].includes(i);
    return true;
  });

  const recentPatients = state.patients.slice(0, 6).map(p => `
    <tr data-id="${p.id}" class="clickable-row">
      <td><div style="font-weight:600">${p.name}</div><div style="font-size:0.72rem;color:var(--clr-text-muted)">${p.condition}</div></td>
      <td>${statusBadge(p.status)}</td>
      <td>${priorityBadge(p.priority)}</td>
      <td style="font-size:0.8rem;color:var(--clr-text-muted)">${p.assignedDoctor || "—"}</td>
    </tr>
  `).join("");

  const recentLogs = state.auditLogs.slice(0, 4).map(l => `
    <div class="audit-row">
      <div class="audit-dot" style="background:var(--clr-primary);border-color:var(--clr-primary)"></div>
      <div>
        <div style="font-size:0.82rem;font-weight:600">${l.action}</div>
        <div style="font-size:0.74rem;color:var(--clr-text-muted)">${l.details}</div>
        <div style="font-size:0.68rem;color:var(--clr-text-dim);margin-top:2px">${l.role} · ${timeAgo(l.timestamp)}</div>
      </div>
    </div>
  `).join("");

  // Role-specific welcome message
  const welcomeMap = {
    Doctor: `<div style="margin-bottom:24px;padding:16px;background:rgba(59,130,246,0.06);border:1px solid var(--clr-border);border-radius:var(--radius);border-left:3px solid var(--clr-primary)">
      <div style="font-family:'Sora',sans-serif;font-weight:700;color:var(--clr-text)">Good day, ${state.session?.name} 👋</div>
      <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:4px">You have <strong>${triagePending}</strong> patients in triage and <strong>${todayAppts}</strong> appointments today.</div>
    </div>`,
    Nurse: `<div style="margin-bottom:24px;padding:16px;background:rgba(6,182,212,0.06);border:1px solid var(--clr-border);border-radius:var(--radius);border-left:3px solid var(--clr-accent)">
      <div style="font-family:'Sora',sans-serif;font-weight:700;color:var(--clr-text)">Nurse Dashboard — ${state.session?.name} 👩‍⚕️</div>
      <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:4px"><strong>${triagePending}</strong> patients awaiting triage. <strong>${highPriority}</strong> high priority cases active.</div>
    </div>`,
    "Lab Technician": `<div style="margin-bottom:24px;padding:16px;background:rgba(245,158,11,0.06);border:1px solid var(--clr-border);border-radius:var(--radius);border-left:3px solid var(--clr-warning)">
      <div style="font-family:'Sora',sans-serif;font-weight:700;color:var(--clr-text)">Lab Portal — ${state.session?.name} 🔬</div>
      <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:4px"><strong>${pendingLabs}</strong> pending lab orders require results upload.</div>
    </div>`,
    Receptionist: `<div style="margin-bottom:24px;padding:16px;background:rgba(16,185,129,0.06);border:1px solid var(--clr-border);border-radius:var(--radius);border-left:3px solid var(--clr-success)">
      <div style="font-family:'Sora',sans-serif;font-weight:700;color:var(--clr-text)">Front Desk — ${state.session?.name} 🧑‍💼</div>
      <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:4px"><strong>${todayAppts}</strong> appointments scheduled today. <strong>${totalPatients}</strong> patients on record.</div>
    </div>`,
  };

  container.innerHTML = `
    <div class="page-enter">
      ${welcomeMap[role()] || `<div style="margin-bottom:24px"><span style="font-family:'Sora',sans-serif;font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,var(--clr-primary-glow),var(--clr-accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">EHCP Dashboard</span></div>`}

      <div class="grid-${statCards.length > 4 ? '3' : '4'}" style="margin-bottom:24px">
        ${statCards.map(s => `
          <div class="stat-card ${s.badge === 'urgent' ? 'pulse-danger' : ''}" style="--accent-clr:${s.accent};--accent-rgb:${s.rgb}">
            <div class="stat-icon">${s.icon}</div>
            <div class="stat-value">${s.value}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        `).join("")}
      </div>

      <div class="grid-2">
        ${can("view_patients", role()) ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">👥 Recent Patients</span>
            <button class="btn btn-ghost btn-sm" id="dash-view-all-patients">View All →</button>
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead><tr><th>Patient</th><th>Status</th><th>Priority</th><th>Doctor</th></tr></thead>
              <tbody id="dash-patients-body">${recentPatients}</tbody>
            </table>
          </div>
        </div>` : `<div class="card">${emptyState("🔒","No Patient Access","Your role cannot view patient records")}</div>`}

        <div class="card">
          <div class="card-header">
            <span class="card-title">📋 Recent Activity</span>
          </div>
          ${recentLogs || emptyState("📋","No Activity Yet","Actions will appear here")}
        </div>
      </div>

      <!-- Triage Notice for Nurses/Doctors -->
      ${triagePending > 0 && can("perform_triage", role()) ? `
      <div style="margin-top:20px;padding:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);display:flex;align-items:center;gap:12px">
        <span style="font-size:1.5rem">🚨</span>
        <div>
          <div style="font-weight:700;color:var(--clr-danger)">${triagePending} Patient(s) Awaiting Triage</div>
          <div style="font-size:0.78rem;color:var(--clr-text-muted)">Immediate attention required for triage queue.</div>
        </div>
        <button class="btn btn-danger" id="dash-goto-triage" style="margin-left:auto">Go to Triage →</button>
      </div>` : ""}
    </div>
  `;

  // Events
  container.querySelectorAll(".clickable-row").forEach(row => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      state.selectedPatientId = parseInt(row.dataset.id);
      state.currentView = "patient-detail";
      window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patient-detail" } }));
    });
  });
  document.getElementById("dash-view-all-patients")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patients" } }));
  });
  document.getElementById("dash-goto-triage")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "triage" } }));
  });
}

/* ============================================================
   PATIENT LIST
   ============================================================ */
export function renderPatients(container) {
  if (!can("view_patients", role())) { container.innerHTML = accessDenied("view_patients"); return; }

  let filtered = [...state.patients];

  container.innerHTML = `
    <div class="page-enter">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div class="search-bar" style="flex:1;max-width:360px">
          <span class="search-icon">🔍</span>
          <input id="patient-search" placeholder="Search by name, condition, ID...">
        </div>
        <select id="patient-status-filter" class="field-select" style="width:180px">
          <option value="">All Statuses</option>
          <option value="TRIAGE_PENDING">Triage Pending</option>
          <option value="TRIAGED">Triaged</option>
          <option value="TREATMENT_STARTED">In Treatment</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select id="patient-priority-filter" class="field-select" style="width:140px">
          <option value="">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        ${can("create_patient", role()) ? `<button class="btn btn-primary" id="btn-new-patient">+ Add Patient</button>` : ""}
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div class="data-table-wrap">
          <table class="data-table" id="patients-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned Doctor</th>
                <th>Insurance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="patients-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const renderTable = (data) => {
    const tbody = document.getElementById("patients-tbody");
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--clr-text-muted)">No patients found</td></tr>`; return; }
    tbody.innerHTML = data.map(p => `
      <tr class="clickable-row" data-id="${p.id}" style="cursor:pointer">
        <td>
          <div style="font-weight:600">${p.name}</div>
          <div style="font-size:0.72rem;color:var(--clr-text-muted)">ID: ${p.id} · ${p.age}y</div>
        </td>
        <td style="font-size:0.82rem">${p.condition}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${priorityBadge(p.priority)}</td>
        <td style="font-size:0.8rem;color:var(--clr-text-muted)">${p.assignedDoctor || "—"}</td>
        <td style="font-size:0.8rem">${p.insurance || "—"}</td>
        <td>
          <button class="btn btn-ghost btn-sm view-patient-btn" data-id="${p.id}">View →</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".view-patient-btn, .clickable-row").forEach(el => {
      el.addEventListener("click", (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        state.selectedPatientId = id;
        state.currentView = "patient-detail";
        window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patient-detail" } }));
      });
    });
  };

  renderTable(filtered);

  // Filters
  const applyFilters = () => {
    const term     = document.getElementById("patient-search")?.value.toLowerCase() || "";
    const statusF  = document.getElementById("patient-status-filter")?.value || "";
    const priorityF= document.getElementById("patient-priority-filter")?.value || "";
    filtered = state.patients.filter(p => {
      const matchTerm = !term || p.name.toLowerCase().includes(term) || p.condition.toLowerCase().includes(term) || String(p.id).includes(term);
      const matchStatus   = !statusF  || p.status   === statusF;
      const matchPriority = !priorityF || p.priority === priorityF;
      return matchTerm && matchStatus && matchPriority;
    });
    renderTable(filtered);
  };

  document.getElementById("patient-search")?.addEventListener("input", applyFilters);
  document.getElementById("patient-status-filter")?.addEventListener("change", applyFilters);
  document.getElementById("patient-priority-filter")?.addEventListener("change", applyFilters);
  document.getElementById("btn-new-patient")?.addEventListener("click", () => showAddPatientModal());
}

/* ============================================================
   PATIENT DETAIL
   ============================================================ */
export async function renderPatientDetail(container) {
  if (!can("view_patient_detail", role())) { container.innerHTML = accessDenied("view_patient_detail"); return; }

  const p = state.patients.find(pt => pt.id === state.selectedPatientId);
  if (!p) { container.innerHTML = `<button class="btn btn-ghost" id="back-btn">← Back</button><br><br><div class="access-denied"><div class="ad-icon">🔍</div><h3>Patient not found</h3></div>`; return; }

  const plans = state.treatmentPlans.filter(t => t.patientId === p.id);
  const appts  = state.appointments.filter(a => a.patientId === p.id);
  const labs   = state.labOrders.filter(l => l.patientId === p.id);

  const flowStatus = ["DRAFT","SUBMITTED","TRIAGE_PENDING","TRIAGED","ASSIGNED_TO_DOCTOR","TREATMENT_STARTED","COMPLETED"];
  const currentIdx = flowStatus.indexOf(p.status);

  container.innerHTML = `
    <div class="page-enter">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button class="btn btn-ghost btn-sm" id="back-patients">← Patients</button>
        <div style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700">${p.name}</div>
        ${statusBadge(p.status)} ${priorityBadge(p.priority)}
      </div>

      <!-- Workflow Status -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-title" style="margin-bottom:12px">Care Pathway</div>
        <div class="workflow-steps">
          ${flowStatus.map((s, i) => `
            <div class="wf-step">
              <div class="wf-node ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}">
                ${i < currentIdx ? '✓' : i === currentIdx ? '●' : '○'}
                <span style="font-size:0.6rem">${s.replace(/_/g," ")}</span>
              </div>
              ${i < flowStatus.length - 1 ? '<div class="wf-arrow"></div>' : ''}
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Tab bar -->
      <div class="tab-bar" id="detail-tabs">
        <div class="tab-item active" data-tab="overview">Overview</div>
        <div class="tab-item" data-tab="treatment">Treatment Plans</div>
        <div class="tab-item" data-tab="labs">Lab Results</div>
        <div class="tab-item" data-tab="appointments">Appointments</div>
      </div>

      <!-- Tab Content -->
      <div id="tab-content"></div>
    </div>
  `;

  const renderTab = (tab) => {
    const tc = document.getElementById("tab-content");
    if (!tc) return;
    if (tab === "overview") {
      tc.innerHTML = `
        <div class="grid-2">
          <div class="card">
            <div class="card-title" style="margin-bottom:14px">👤 Patient Information</div>
            <div style="display:grid;gap:10px">
              ${[
                ["Full Name", p.name], ["Date of Birth", fmtDate(p.dob)], ["Age", `${p.age} years`],
                ["Phone", p.phone || "—"], ["Email", p.email || "—"], ["Insurance", p.insurance || "—"],
              ].map(([k,v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--clr-border)"><span style="font-size:0.78rem;color:var(--clr-text-muted)">${k}</span><span style="font-size:0.83rem;font-weight:600">${v}</span></div>`).join("")}
            </div>
          </div>
          <div class="card">
            <div class="card-title" style="margin-bottom:14px">🩺 Clinical Information</div>
            <div style="display:grid;gap:10px">
              ${[
                ["Condition", p.condition], ["Symptoms", p.symptoms || "—"],
                ["Blood Pressure", p.bloodPressure || "—"], ["Priority", p.priority],
                ["Assigned Doctor", p.assignedDoctor || "Unassigned"],
                ["Cost Limit", p.costLimit ? `$${p.costLimit.toLocaleString()}` : "—"],
              ].map(([k,v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--clr-border)"><span style="font-size:0.78rem;color:var(--clr-text-muted)">${k}</span><span style="font-size:0.83rem;font-weight:600">${v}</span></div>`).join("")}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          ${can("perform_triage", role()) && p.status === "TRIAGE_PENDING" ? `<button class="btn btn-primary" id="btn-do-triage">🚨 Perform Triage</button>` : ""}
          ${can("perform_triage", role()) && p.status === "TRIAGED" ? `<button class="btn btn-success" id="btn-start-treat">💊 Start Treatment</button>` : ""}
          ${can("edit_patient", role()) ? `<button class="btn btn-ghost" id="btn-edit-patient">✏️ Edit Patient</button>` : ""}
        </div>
      `;
      document.getElementById("btn-do-triage")?.addEventListener("click", async () => {
        const updated = applyTriageRules(p);
        await saveRecord(STORES.PATIENTS, updated);
        await updatePatientStatus(p.id, "TRIAGED");
        if (updated.priority === "HIGH") await addNotification(`🚨 Emergency: ${p.name} — High Priority`, "error");
        window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patient-detail" } }));
      });
      document.getElementById("btn-start-treat")?.addEventListener("click", async () => {
        await updatePatientStatus(p.id, "TREATMENT_STARTED");
        await addAuditLog("Treatment Started", `Patient ${p.name} moved to Treatment`);
        window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patient-detail" } }));
      });

    } else if (tab === "treatment") {
      const canEdit = can("edit_treatment", role());
      tc.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">💊 Treatment Plans</span>
            ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-new-plan">+ New Plan</button>` : ""}
          </div>
          ${plans.length === 0 ? emptyState("💊","No Treatment Plans","No plans on record for this patient") :
            plans.map(plan => `
              <div style="padding:14px;background:var(--clr-surface-2);border-radius:var(--radius-sm);margin-bottom:10px;border-left:3px solid ${plan.status==='ACTIVE'?'var(--clr-success)':plan.status==='DRAFT'?'var(--clr-warning)':'var(--clr-border)'}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  <span style="font-weight:700">${plan.name}</span>
                  ${statusBadge(plan.status)}
                </div>
                <div style="font-size:0.8rem;color:var(--clr-text-muted)">
                  <span>💊 ${plan.medications.join(", ")}</span>
                  <span style="margin-left:12px">💰 Cost: $${plan.cost?.toLocaleString()}</span>
                </div>
                ${plan.requiresControlledSubstance && !plan.seniorApproved ? `
                  <div style="margin-top:8px;padding:8px;background:rgba(239,68,68,0.08);border-radius:6px;font-size:0.78rem;color:var(--clr-danger)">
                    ⚠️ Requires Senior Doctor Approval
                    ${can("approve_treatment", role()) ? `<button class="btn btn-sm" style="margin-left:8px;background:rgba(239,68,68,0.15);color:var(--clr-danger);border:1px solid rgba(239,68,68,0.3)" data-approve-senior="${plan.id}">Approve →</button>` : ""}
                  </div>` : ""}
                ${plan.cost > (p.costLimit || 0) && !plan.insuranceApproved ? `
                  <div style="margin-top:8px;padding:8px;background:rgba(245,158,11,0.08);border-radius:6px;font-size:0.78rem;color:var(--clr-warning)">
                    ⚠️ Insurance Pre-Approval Required
                    ${can("edit_billing", role()) ? `<button class="btn btn-sm" style="margin-left:8px;background:rgba(245,158,11,0.15);color:var(--clr-warning);border:1px solid rgba(245,158,11,0.3)" data-approve-insurance="${plan.id}">Pre-Approve →</button>` : ""}
                  </div>` : ""}
              </div>
            `).join("")}
        </div>
      `;
      // Approval handlers
      tc.querySelectorAll("[data-approve-senior]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const pid = parseInt(btn.dataset.approveSenior);
          const plan = state.treatmentPlans.find(pl => pl.id === pid);
          if (plan) { plan.seniorApproved = true; plan.status = "APPROVED"; await saveRecord(STORES.TREATMENT_PLANS, plan); await addNotification("Senior approval granted","success"); renderTab("treatment"); }
        });
      });
      tc.querySelectorAll("[data-approve-insurance]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const pid = parseInt(btn.dataset.approveInsurance);
          const plan = state.treatmentPlans.find(pl => pl.id === pid);
          if (plan) { plan.insuranceApproved = true; plan.status = "ACTIVE"; await saveRecord(STORES.TREATMENT_PLANS, plan); await addNotification("Insurance pre-approved","success"); renderTab("treatment"); }
        });
      });

    } else if (tab === "labs") {
      const canUpload = can("upload_results", role());
      tc.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">🔬 Lab Orders & Results</span>
            ${can("order_lab", role()) ? `<button class="btn btn-primary btn-sm" id="btn-order-lab">+ Order Lab Test</button>` : ""}
          </div>
          ${labs.length === 0 ? emptyState("🔬","No Lab Orders","No lab tests ordered for this patient") :
            labs.map(lab => `
              <div style="padding:14px;background:var(--clr-surface-2);border-radius:var(--radius-sm);margin-bottom:10px;display:flex;align-items:center;gap:12px;border-left:3px solid ${lab.status==='Results Uploaded'?'var(--clr-success)':lab.urgent?'var(--clr-danger)':'var(--clr-warning)'}">
                <div style="flex:1">
                  <div style="font-weight:700">${lab.testName} ${lab.urgent ? '<span class="badge badge-danger" style="margin-left:6px">URGENT</span>' : ""}</div>
                  <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:4px">${statusBadge(lab.status)} · SLA: ${lab.sla}h</div>
                  ${lab.resultValue ? `<div style="margin-top:8px;padding:8px;background:rgba(16,185,129,0.08);border-radius:6px;font-size:0.8rem;color:var(--clr-success)">📊 ${lab.resultValue}</div>` : ""}
                </div>
                ${canUpload && lab.status !== "Results Uploaded" ? `<button class="btn btn-ghost btn-sm upload-result-btn" data-lab-id="${lab.id}">Upload Result</button>` : ""}
              </div>
            `).join("")}
        </div>
      `;
      tc.querySelectorAll(".upload-result-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const lid = parseInt(btn.dataset.labId);
          const lab = state.labOrders.find(l => l.id === lid);
          if (lab) {
            lab.status = "Results Uploaded";
            lab.resultValue = "Result uploaded — within normal range (simulated)";
            lab.uploadedBy = state.session?.name;
            await saveRecord(STORES.LAB_ORDERS, lab);
            await addNotification(`Lab result uploaded: ${lab.testName}`, "success");
            await addAuditLog("Lab Result Uploaded", `${lab.testName} for patient ${p.name}`);
            renderTab("labs");
          }
        });
      });

    } else if (tab === "appointments") {
      tc.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">📅 Appointments</span>
          </div>
          ${appts.length === 0 ? emptyState("📅","No Appointments","No appointments scheduled") :
            `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Type</th><th>Room</th><th>Status</th></tr></thead><tbody>
              ${appts.map(a => `<tr><td>${fmtDate(a.date)}</td><td>${a.time}</td><td>${a.doctorName}</td><td>${a.type || "General"}</td><td>${a.room || "—"}</td><td>${statusBadge(a.status)}</td></tr>`).join("")}
            </tbody></table></div>`}
        </div>
      `;
    }
  };

  renderTab("overview");

  // Tab switching
  container.querySelectorAll(".tab-item").forEach(tab => {
    tab.addEventListener("click", () => {
      container.querySelectorAll(".tab-item").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderTab(tab.dataset.tab);
    });
  });

  document.getElementById("back-patients")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patients" } }));
  });
}

/* ============================================================
   APPOINTMENTS
   ============================================================ */
export function renderAppointments(container) {
  if (!can("view_appointments", role())) { container.innerHTML = accessDenied("view_appointments"); return; }
  const canSchedule = can("create_appointment", role());

  container.innerHTML = `
    <div class="page-enter">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <span style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700">Appointments</span>
        ${canSchedule ? `<button class="btn btn-primary" id="btn-new-appt">+ Schedule Appointment</button>` : ""}
      </div>

      <div class="card" style="padding:0">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Type</th><th>Room</th><th>Status</th></tr></thead>
            <tbody>
              ${state.appointments.map(a => {
                const pt = state.patients.find(p => p.id === a.patientId);
                return `<tr>
                  <td><div style="font-weight:600">${pt?.name || "Unknown"}</div></td>
                  <td style="font-size:0.82rem">${a.doctorName}</td>
                  <td style="font-size:0.82rem">${fmtDate(a.date)}</td>
                  <td style="font-size:0.82rem;font-family:'JetBrains Mono',monospace">${a.time}</td>
                  <td style="font-size:0.82rem">${a.type || "General"}</td>
                  <td style="font-size:0.82rem">${a.room || "—"}</td>
                  <td>${statusBadge(a.status)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      ${canSchedule ? `
      <div class="card" style="margin-top:20px">
        <div class="card-title" style="margin-bottom:16px">📅 Schedule New Appointment</div>
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Patient</label>
            <select class="field-select" id="appt-patient">
              <option value="">Select Patient</option>
              ${state.patients.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Date</label>
            <input type="date" class="field-input" id="appt-date">
          </div>
        </div>
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Time</label>
            <input type="time" class="field-input" id="appt-time">
          </div>
          <div class="field-group">
            <label class="field-label">Type</label>
            <select class="field-select" id="appt-type">
              <option>Consultation</option><option>Follow-up</option>
              <option>Emergency</option><option>Treatment</option>
            </select>
          </div>
        </div>
        <div style="padding:10px;background:rgba(59,130,246,0.06);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--clr-text-muted);margin-bottom:14px">
          🛡️ Double-book prevention is active — conflicting time slots will be rejected.
        </div>
        <button class="btn btn-primary" id="create-appt-btn">Schedule Appointment</button>
      </div>` : ""}
    </div>
  `;

  document.getElementById("create-appt-btn")?.addEventListener("click", async () => {
    const patientId = parseInt(document.getElementById("appt-patient").value);
    const date      = document.getElementById("appt-date").value;
    const time      = document.getElementById("appt-time").value;
    const type      = document.getElementById("appt-type").value;
    if (!patientId || !date || !time) { showToastLocal("Please fill all fields", "error"); return; }
    const conflict = state.appointments.some(a => a.date === date && a.time === time);
    if (conflict) { await addNotification("⚠️ Time slot conflict — choose a different time", "error"); return; }
    const appt = { id: uid(), patientId, doctorName: "Dr. Marcus Smith", date, time, type, status: "scheduled", room: "A" + Math.floor(Math.random()*20+1) };
    await saveRecord(STORES.APPOINTMENTS, appt);
    state.appointments.push(appt);
    await addAuditLog("Appointment Scheduled", `${type} for patient ${patientId} on ${date}`);
    await addNotification("Appointment scheduled successfully", "success");
    window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "appointments" } }));
  });
}

/* ============================================================
   TRIAGE QUEUE
   ============================================================ */
export function renderTriage(container) {
  if (!can("view_triage", role())) { container.innerHTML = accessDenied("view_triage"); return; }
  const canTriage = can("perform_triage", role());
  const pending = state.patients.filter(p => p.status === "TRIAGE_PENDING");

  container.innerHTML = `
    <div class="page-enter">
      <div style="margin-bottom:20px">
        <div style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:4px">🚨 Triage Queue</div>
        <div style="font-size:0.8rem;color:var(--clr-text-muted)">${pending.length} patient(s) awaiting clinical triage assessment</div>
      </div>

      ${pending.length === 0 ? emptyState("✅","Queue Clear","No patients pending triage") :
        pending.map(p => `
          <div class="triage-card ${p.priority}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                  <span style="font-weight:700;font-size:1rem">${p.name}</span>
                  ${priorityBadge(p.priority)}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:0.8rem;color:var(--clr-text-muted)">
                  <span>🩺 <b>Condition:</b> ${p.condition}</span>
                  <span>📋 <b>Symptoms:</b> ${p.symptoms}</span>
                  <span>💉 <b>BP:</b> ${p.bloodPressure}</span>
                  <span>👤 <b>Age:</b> ${p.age} years</span>
                </div>
              </div>
              ${canTriage ? `
              <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
                <button class="btn btn-primary btn-sm triage-assign-btn" data-id="${p.id}">🩺 Triage & Assign</button>
                <button class="btn btn-danger btn-sm triage-emergency-btn" data-id="${p.id}">🚨 Emergency</button>
              </div>` : `<span style="font-size:0.75rem;color:var(--clr-text-dim)">View only</span>`}
            </div>
          </div>
        `).join("")}

      <!-- Triage Rules Reference -->
      <div class="card" style="margin-top:20px">
        <div class="card-title" style="margin-bottom:12px">📋 Automated Triage Rules</div>
        <div style="font-size:0.8rem;font-family:'JetBrains Mono',monospace;color:var(--clr-text-muted);display:grid;gap:8px">
          <div style="padding:8px;background:rgba(239,68,68,0.06);border-radius:6px"><span style="color:var(--clr-danger);font-weight:700">IF</span> symptoms includes "Chest Pain" → priority=HIGH, assign=Emergency Doctor</div>
          <div style="padding:8px;background:rgba(239,68,68,0.06);border-radius:6px"><span style="color:var(--clr-danger);font-weight:700">IF</span> age &gt; 65 AND blood_pressure &gt; 140/90 → escalate_priority=HIGH</div>
          <div style="padding:8px;background:rgba(245,158,11,0.06);border-radius:6px"><span style="color:var(--clr-warning);font-weight:700">IF</span> systolic &gt; 130 OR age &gt; 55 → priority=MEDIUM</div>
          <div style="padding:8px;background:rgba(16,185,129,0.06);border-radius:6px"><span style="color:var(--clr-success);font-weight:700">DEFAULT</span> → priority=LOW</div>
        </div>
      </div>
    </div>
  `;

  if (canTriage) {
    container.querySelectorAll(".triage-assign-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid = parseInt(btn.dataset.id);
        let patient = state.patients.find(p => p.id === pid);
        patient = applyTriageRules(patient);
        await saveRecord(STORES.PATIENTS, patient);
        await updatePatientStatus(pid, "TRIAGED");
        await addAuditLog("Triage Performed", `Patient ${patient.name} → priority ${patient.priority}, assigned ${patient.assignedDoctor}`);
        if (patient.priority === "HIGH") await addNotification(`🚨 High Priority: ${patient.name} — Emergency protocol`, "error");
        window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "triage" } }));
      });
    });
    container.querySelectorAll(".triage-emergency-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid = parseInt(btn.dataset.id);
        let patient = state.patients.find(p => p.id === pid);
        patient.priority = "HIGH"; patient.assignedDoctor = "Dr. Marcus Smith (Emergency)";
        await saveRecord(STORES.PATIENTS, patient);
        await updatePatientStatus(pid, "TRIAGED");
        await addNotification(`🚨 EMERGENCY PROTOCOL: ${patient.name}`, "error");
        await addAuditLog("Emergency Override", `Emergency declared for ${patient.name}`);
        window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "triage" } }));
      });
    });
  }
}

/* ============================================================
   TREATMENT PLANS
   ============================================================ */
export function renderTreatmentPlans(container) {
  if (!can("view_treatment_plans", role())) { container.innerHTML = accessDenied("view_treatment_plans"); return; }
  const canEdit = can("create_treatment", role());

  container.innerHTML = `
    <div class="page-enter">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <span style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700">Treatment Plans</span>
        ${canEdit ? `<button class="btn btn-primary" id="btn-new-plan-global">+ Create Plan</button>` : ""}
      </div>

      ${state.treatmentPlans.map(plan => {
        const pt = state.patients.find(p => p.id === plan.patientId);
        return `
          <div class="card" style="margin-bottom:14px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                  <span style="font-weight:700">${plan.name}</span>
                  ${statusBadge(plan.status)}
                  ${plan.requiresControlledSubstance ? `<span class="badge badge-danger">Controlled Substance</span>` : ""}
                </div>
                <div style="font-size:0.8rem;color:var(--clr-text-muted)">
                  👤 Patient: <strong>${pt?.name || "Unknown"}</strong> ·
                  💊 ${plan.medications.join(", ")} ·
                  💰 $${plan.cost?.toLocaleString()}
                </div>
                ${plan.requiresControlledSubstance && !plan.seniorApproved ?
                  `<div style="margin-top:10px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px;font-size:0.78rem;color:var(--clr-danger);display:flex;align-items:center;gap:8px">
                    ⚠️ Awaiting Senior Doctor Approval
                    ${can("approve_treatment", role()) ? `<button class="btn btn-sm btn-danger approve-senior-btn" data-id="${plan.id}">Approve Now</button>` : ""}
                  </div>` : ""}
                ${plan.cost > ((pt?.costLimit) || 0) && !plan.insuranceApproved ?
                  `<div style="margin-top:8px;padding:10px;background:rgba(245,158,11,0.08);border-radius:8px;font-size:0.78rem;color:var(--clr-warning);display:flex;align-items:center;gap:8px">
                    ⚠️ Cost exceeds patient limit — Insurance Pre-Approval Required
                    ${can("edit_billing", role()) ? `<button class="btn btn-sm" style="background:rgba(245,158,11,0.2);color:var(--clr-warning);border:1px solid rgba(245,158,11,0.3)" class="approve-ins-btn" data-id="${plan.id}">Pre-Approve</button>` : ""}
                  </div>` : ""}
              </div>
              <div style="font-size:0.7rem;color:var(--clr-text-dim)">v${plan.version || 1}</div>
            </div>
          </div>
        `;
      }).join("") || emptyState("💊","No Treatment Plans","No plans on record")}
    </div>
  `;

  container.querySelectorAll(".approve-senior-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const plan = state.treatmentPlans.find(p => p.id === parseInt(btn.dataset.id));
      if (plan) { plan.seniorApproved = true; plan.status = "APPROVED"; await saveRecord(STORES.TREATMENT_PLANS, plan); await addNotification("Senior approval granted","success"); window.dispatchEvent(new CustomEvent("navigate",{detail:{view:"treatment-plans"}})); }
    });
  });
}

/* ============================================================
   LAB MANAGEMENT
   ============================================================ */
export function renderLab(container) {
  if (!can("view_lab", role())) { container.innerHTML = accessDenied("view_lab"); return; }
  const canUpload = can("upload_results", role());
  const canOrder  = can("order_lab", role());

  container.innerHTML = `
    <div class="page-enter">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <span style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700">🔬 Lab & Diagnostics</span>
        ${canOrder ? `<button class="btn btn-primary" id="btn-order-lab-global">+ Order Lab Test</button>` : ""}
      </div>

      <!-- Status grid -->
      <div class="grid-4" style="margin-bottom:20px">
        ${["Sample Collected","Processing","Results Uploaded"].map((s,i) => {
          const count = state.labOrders.filter(l => l.status === s).length;
          const colors = ["#f59e0b","#3b82f6","#10b981"];
          return `<div class="stat-card" style="--accent-clr:${colors[i]}">
            <div class="stat-value">${count}</div>
            <div class="stat-label">${s}</div>
          </div>`;
        }).join("")}
        <div class="stat-card" style="--accent-clr:#ef4444">
          <div class="stat-value">${state.labOrders.filter(l=>l.urgent).length}</div>
          <div class="stat-label">Urgent Orders</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Test</th><th>Patient</th><th>Status</th><th>Urgent</th><th>SLA</th><th>Result</th>${canUpload ? "<th>Action</th>" : ""}</tr></thead>
            <tbody>
              ${state.labOrders.map(lab => {
                const pt = state.patients.find(p => p.id === lab.patientId);
                return `<tr>
                  <td style="font-weight:600">${lab.testName}</td>
                  <td style="font-size:0.82rem">${pt?.name || "Unknown"}</td>
                  <td>${statusBadge(lab.status)}</td>
                  <td>${lab.urgent ? `<span class="badge badge-danger">URGENT</span>` : `<span class="badge badge-muted">Normal</span>`}</td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem">${lab.sla}h</td>
                  <td style="font-size:0.78rem;max-width:180px">${lab.resultValue || `<span style="color:var(--clr-text-dim)">Pending</span>`}</td>
                  ${canUpload ? `<td>${lab.status !== "Results Uploaded" ? `<button class="btn btn-ghost btn-sm upload-lab-btn" data-lab-id="${lab.id}">Upload</button>` : `<span style="color:var(--clr-success);font-size:0.75rem">✓ Done</span>`}</td>` : ""}
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".upload-lab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const lab = state.labOrders.find(l => l.id === parseInt(btn.dataset.labId));
      if (lab) {
        lab.status = "Results Uploaded"; lab.resultValue = "Normal range — no anomalies detected (simulated)"; lab.uploadedBy = state.session?.name;
        await saveRecord(STORES.LAB_ORDERS, lab);
        await addNotification(`Lab result uploaded: ${lab.testName}`, "success");
        await addAuditLog("Lab Result Uploaded", `${lab.testName}`, state.session?.username);
        window.dispatchEvent(new CustomEvent("navigate",{detail:{view:"lab"}}));
      }
    });
  });
}

/* ============================================================
   BILLING
   ============================================================ */
export function renderBilling(container) {
  if (!can("view_billing", role())) { container.innerHTML = accessDenied("view_billing"); return; }

  container.innerHTML = `
    <div class="page-enter">
      <div style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:20px">💳 Billing & Insurance</div>

      <div class="grid-3" style="margin-bottom:20px">
        <div class="stat-card" style="--accent-clr:#f97316">
          <div class="stat-icon">💰</div>
          <div class="stat-value">$${state.treatmentPlans.reduce((s,p)=>s+(p.cost||0),0).toLocaleString()}</div>
          <div class="stat-label">Total Plan Costs</div>
        </div>
        <div class="stat-card" style="--accent-clr:#10b981">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${state.treatmentPlans.filter(p=>p.insuranceApproved).length}</div>
          <div class="stat-label">Insurance Approved</div>
        </div>
        <div class="stat-card" style="--accent-clr:#ef4444">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">${state.treatmentPlans.filter(p=>!p.insuranceApproved).length}</div>
          <div class="stat-label">Pending Approval</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:14px">Insurance Status by Patient</div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Patient</th><th>Insurance</th><th>Plan</th><th>Cost</th><th>Limit</th><th>Pre-Approved</th><th>Actions</th></tr></thead>
            <tbody>
              ${state.patients.map(p => {
                const plan = state.treatmentPlans.find(t => t.patientId === p.id);
                return `<tr>
                  <td style="font-weight:600">${p.name}</td>
                  <td style="font-size:0.82rem">${p.insurance || "—"}</td>
                  <td style="font-size:0.82rem">${plan?.name || "No Active Plan"}</td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:0.82rem">${plan ? `$${plan.cost?.toLocaleString()}` : "—"}</td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:0.82rem">$${p.costLimit?.toLocaleString() || "—"}</td>
                  <td>${plan ? (plan.insuranceApproved ? `<span class="badge badge-success">✅ Approved</span>` : `<span class="badge badge-warning">⏳ Pending</span>`) : "—"}</td>
                  <td>${plan && !plan.insuranceApproved && can("edit_billing", role()) ? `<button class="btn btn-ghost btn-sm pre-approve-btn" data-plan-id="${plan.id}">Pre-Approve</button>` : ""}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Edge Case Simulator -->
      <div class="card" style="margin-top:20px">
        <div class="card-title" style="margin-bottom:12px">⚡ Insurance Edge Cases (Simulator)</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="sim-denial">Simulate Insurance Denial</button>
          <button class="btn btn-ghost" id="sim-override">Emergency Cost Override</button>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".pre-approve-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const plan = state.treatmentPlans.find(p => p.id === parseInt(btn.dataset.planId));
      if (plan) { plan.insuranceApproved = true; plan.status = "ACTIVE"; await saveRecord(STORES.TREATMENT_PLANS, plan); await addNotification("Insurance pre-approved","success"); window.dispatchEvent(new CustomEvent("navigate",{detail:{view:"billing"}})); }
    });
  });
  document.getElementById("sim-denial")?.addEventListener("click", async () => {
    await addNotification("⛔ Insurance Denial: Patient Robert Hayes — pre-auth required for cardiac procedure","error");
    await addAuditLog("Insurance Denial Simulated","BCBS denied cardiac claim — escalate to billing manager");
  });
  document.getElementById("sim-override")?.addEventListener("click", async () => {
    await addNotification("✅ Emergency Cost Override approved by Admin","success");
    await addAuditLog("Emergency Cost Override","Billing limit bypassed for critical patient");
  });
}

/* ============================================================
   ANALYTICS / REPORTS
   ============================================================ */
export function renderReports(container) {
  if (!can("view_reports", role())) { container.innerHTML = accessDenied("view_reports"); return; }

  const byStatus   = {};
  const byPriority = {};
  state.patients.forEach(p => {
    byStatus[p.status]     = (byStatus[p.status]    || 0) + 1;
    byPriority[p.priority] = (byPriority[p.priority]|| 0) + 1;
  });

  container.innerHTML = `
    <div class="page-enter">
      <div style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:20px">📊 Analytics & Reports</div>

      <div class="grid-2" style="margin-bottom:20px">
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">Patient Status Distribution</div>
          <div class="chart-container"><canvas id="statusChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">Priority Distribution</div>
          <div class="chart-container"><canvas id="priorityChart"></canvas></div>
        </div>
      </div>

      <div class="grid-3" style="margin-bottom:20px">
        <div class="stat-card" style="--accent-clr:#3b82f6">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${state.patients.length}</div>
          <div class="stat-label">Total Patients</div>
        </div>
        <div class="stat-card" style="--accent-clr:#10b981">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${state.treatmentPlans.filter(t=>t.status==="ACTIVE").length}</div>
          <div class="stat-label">Active Treatments</div>
        </div>
        <div class="stat-card" style="--accent-clr:#f59e0b">
          <div class="stat-icon">🔬</div>
          <div class="stat-value">${state.labOrders.filter(l=>l.status==="Results Uploaded").length}/${state.labOrders.length}</div>
          <div class="stat-label">Labs Complete</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Clinical Reports</span>
          ${can("export_reports", role()) ? `
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" id="export-csv">⬇️ Export CSV</button>
            <button class="btn btn-ghost btn-sm" id="compliance-report">📋 Compliance Report</button>
          </div>` : ""}
        </div>
        <div style="display:grid;gap:8px">
          ${[
            ["Patient Inflow", `${state.patients.length} patients registered`],
            ["Triage Pending", `${state.patients.filter(p=>p.status==="TRIAGE_PENDING").length} patients need triage`],
            ["Active Treatment Plans", `${state.treatmentPlans.filter(t=>t.status==="ACTIVE").length} active plans`],
            ["Lab Turnaround", `${state.labOrders.filter(l=>l.status==="Results Uploaded").length} results uploaded of ${state.labOrders.length} total`],
            ["Insurance Pending", `${state.treatmentPlans.filter(t=>!t.insuranceApproved).length} plans pending insurance approval`],
          ].map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--clr-surface-2);border-radius:var(--radius-sm)">
              <span style="font-size:0.82rem;color:var(--clr-text-muted)">${k}</span>
              <span style="font-size:0.82rem;font-weight:600">${v}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  // Charts
  setTimeout(() => {
    const chartOpts = (labels, data, colors, label) => ({
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: "var(--clr-surface)", borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#8099b4", font: { family: "'Inter'" } } } } }
    });
    const sEl = document.getElementById("statusChart");
    const pEl = document.getElementById("priorityChart");
    if (sEl && window.Chart) new window.Chart(sEl, chartOpts(Object.keys(byStatus), Object.values(byStatus), ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4"], "Status"));
    if (pEl && window.Chart) new window.Chart(pEl, chartOpts(["HIGH","MEDIUM","LOW"], [byPriority.HIGH||0, byPriority.MEDIUM||0, byPriority.LOW||0], ["#ef4444","#f59e0b","#10b981"], "Priority"));
  }, 100);

  document.getElementById("export-csv")?.addEventListener("click", () => {
    const csv = "Name,Status,Priority,Condition,Insurance\n" + state.patients.map(p=>`${p.name},${p.status},${p.priority},${p.condition},${p.insurance}`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "ehcp_patients.csv"; a.click();
    addNotification("Patient data exported to CSV","success");
  });
  document.getElementById("compliance-report")?.addEventListener("click", async () => {
    await addNotification("Compliance report generated — 30-day audit log summary ready","info");
    await addAuditLog("Compliance Report Generated","Full audit export triggered by "+ state.session?.name);
  });
}

/* ============================================================
   AUDIT LOG
   ============================================================ */
export function renderAudit(container) {
  if (!can("view_audit", role())) { container.innerHTML = accessDenied("view_audit"); return; }

  const logs = state.auditLogs.slice(0, 50);

  container.innerHTML = `
    <div class="page-enter">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700">🔍 Audit Trail</div>
          <div style="font-size:0.78rem;color:var(--clr-text-muted)">HIPAA-compliant immutable log — ${logs.length} entries</div>
        </div>
        ${can("export_audit", role()) ? `<button class="btn btn-primary btn-sm" id="export-audit">⬇️ Export Audit Log</button>` : ""}
      </div>

      <div class="card" style="padding:0">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Timestamp</th><th>Role</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;white-space:nowrap">${fmtDateTime(log.timestamp)}</td>
                  <td><span class="badge" style="background:rgba(59,130,246,0.1);color:var(--clr-primary);border:1px solid rgba(59,130,246,0.2)">${log.role}</span></td>
                  <td style="font-size:0.78rem;color:var(--clr-text-muted)">${log.userId || "—"}</td>
                  <td style="font-weight:600;font-size:0.82rem">${log.action}</td>
                  <td style="font-size:0.78rem;color:var(--clr-text-muted);max-width:260px">${log.details}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("export-audit")?.addEventListener("click", () => {
    const csv = "Timestamp,Role,User,Action,Details\n" + logs.map(l=>`"${l.timestamp}","${l.role}","${l.userId}","${l.action}","${l.details}"`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "ehcp_audit.csv"; a.click();
    addNotification("Audit log exported to CSV","success");
  });
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
export function renderAdmin(container) {
  if (!can("view_admin", role())) { container.innerHTML = accessDenied("view_admin"); return; }

  container.innerHTML = `
    <div class="page-enter">
      <div style="font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:20px">⚙️ Admin Panel</div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">⚡ Edge Case Simulator</div>
          <div style="display:grid;gap:8px">
            ${[
              ["🛡️ Emergency Override Access","emergency-override","Simulate emergency bypass of RBAC"],
              ["⛔ Insurance Denial","insurance-denial","Simulate claim rejection scenario"],
              ["📂 Data Retention Alert","data-retention","Trigger data expiration notification"],
              ["⚔️ Specialist Conflict","specialist-conflict","Simulate conflicting recommendations"],
              ["🔄 Doctor Post-Discharge Edit","post-discharge","Doctor edits after patient discharge"],
            ].map(([label, id, desc]) => `
              <button class="btn btn-ghost" id="sim-${id}" style="text-align:left;flex-direction:column;align-items:flex-start;height:auto;padding:12px">
                <span style="font-weight:700">${label}</span>
                <span style="font-size:0.72rem;color:var(--clr-text-dim);margin-top:2px;font-weight:400">${desc}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:14px">👥 User Roles Overview</div>
          <div style="display:grid;gap:6px">
            ${Object.entries({
              Admin:"Full system access — all modules",
              Doctor:"Patients, triage, treatment, labs, reports",
              Nurse:"Triage, patients, view labs",
              Receptionist:"Patients, appointments only",
              "Lab Technician":"Upload results, view lab orders",
              "Billing Officer":"Billing, insurance, reports",
              "Compliance Officer":"Audit logs, reports only",
              Patient:"Own health portal — appointments & results",
            }).map(([r,desc]) => `
              <div style="display:flex;gap:10px;padding:8px;background:var(--clr-surface-2);border-radius:6px;align-items:center">
                <span class="badge" style="background:rgba(59,130,246,0.1);color:var(--clr-primary);border:1px solid rgba(59,130,246,0.2);white-space:nowrap">${r}</span>
                <span style="font-size:0.75rem;color:var(--clr-text-muted)">${desc}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="card-title" style="margin-bottom:12px">📊 System Health</div>
        <div class="grid-4">
          ${[
            ["Patients","👥",state.patients.length],
            ["Appointments","📅",state.appointments.length],
            ["Lab Orders","🔬",state.labOrders.length],
            ["Audit Logs","📋",state.auditLogs.length],
          ].map(([l,i,v]) => `<div style="text-align:center;padding:16px;background:var(--clr-surface-2);border-radius:var(--radius-sm)"><div style="font-size:1.5rem">${i}</div><div style="font-size:1.3rem;font-weight:700;margin:4px 0">${v}</div><div style="font-size:0.75rem;color:var(--clr-text-muted)">${l}</div></div>`).join("")}
        </div>
      </div>
    </div>
  `;

  const simActions = {
    "sim-emergency-override": async () => { await addNotification("🛡️ Emergency Override: Dr. Smith granted temporary full access","warning"); await addAuditLog("Emergency Override","RBAC bypass granted for critical emergency"); },
    "sim-insurance-denial":   async () => { await addNotification("⛔ Insurance Denial: Cardiac procedure claim rejected by Medicare","error"); await addAuditLog("Insurance Denial","Medicare denied cardiac claim — escalation required"); },
    "sim-data-retention":     async () => { await addNotification("📂 Data Retention: 127 records flagged for archival — HIPAA 7-year rule","info"); await addAuditLog("Data Retention Policy","Nightly retention job triggered — 127 records flagged"); },
    "sim-specialist-conflict":async () => { await addNotification("⚔️ Conflict: Cardiologist vs Neurologist disagree on treatment — escalate to lead","error"); await addAuditLog("Specialist Conflict","Conflicting treatment plans — escalated to senior physician"); },
    "sim-post-discharge":     async () => { await addNotification("🔄 Post-discharge edit logged — compliance review required","warning"); await addAuditLog("Post-Discharge Edit","Doctor edited treatment plan after patient discharge"); },
  };

  Object.entries(simActions).forEach(([id, fn]) => {
    document.getElementById(id)?.addEventListener("click", fn);
  });
}

/* ============================================================
   PATIENT PORTAL (My Health Portal)
   ============================================================ */
export function renderPatientPortal(container) {
  // Find the patient linked to the session
  const patientName = state.session?.name;
  const p = state.patients.find(pt => pt.name === patientName) || state.patients[0];
  if (!p) { container.innerHTML = emptyState("🏠","No Patient Record","Your account is not linked to a patient record"); return; }

  const myAppts = state.appointments.filter(a => a.patientId === p.id);
  const myPlans = state.treatmentPlans.filter(t => t.patientId === p.id);
  const myLabs  = state.labOrders.filter(l => l.patientId === p.id && l.status === "Results Uploaded");

  container.innerHTML = `
    <div class="page-enter">
      <div style="padding:20px;background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(6,182,212,0.06));border:1px solid var(--clr-border);border-radius:var(--radius);margin-bottom:24px">
        <div style="font-family:'Sora',sans-serif;font-size:1.3rem;font-weight:800">Hello, ${p.name} 👋</div>
        <div style="font-size:0.8rem;color:var(--clr-text-muted);margin-top:4px">Here's your health summary. ${statusBadge(p.status)}</div>
      </div>

      <div class="grid-3" style="margin-bottom:20px">
        <div class="stat-card" style="--accent-clr:#3b82f6">
          <div class="stat-icon">📅</div>
          <div class="stat-value">${myAppts.length}</div>
          <div class="stat-label">My Appointments</div>
        </div>
        <div class="stat-card" style="--accent-clr:#10b981">
          <div class="stat-icon">💊</div>
          <div class="stat-value">${myPlans.length}</div>
          <div class="stat-label">Treatment Plans</div>
        </div>
        <div class="stat-card" style="--accent-clr:#f59e0b">
          <div class="stat-icon">🔬</div>
          <div class="stat-value">${myLabs.length}</div>
          <div class="stat-label">Lab Results Ready</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">📅 My Upcoming Appointments</div>
          ${myAppts.length === 0 ? `<div style="color:var(--clr-text-muted);font-size:0.82rem">No appointments scheduled.</div>` :
            myAppts.map(a => `
              <div style="padding:12px;background:var(--clr-surface-2);border-radius:var(--radius-sm);margin-bottom:8px">
                <div style="font-weight:600">${a.doctorName}</div>
                <div style="font-size:0.78rem;color:var(--clr-text-muted)">${fmtDate(a.date)} at ${a.time} · ${a.type || "General"}</div>
                <div style="margin-top:4px">${statusBadge(a.status)}</div>
              </div>
            `).join("")}
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:14px">🔬 My Lab Results</div>
          ${myLabs.length === 0 ? `<div style="color:var(--clr-text-muted);font-size:0.82rem">No results available yet.</div>` :
            myLabs.map(lab => `
              <div style="padding:12px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:var(--radius-sm);margin-bottom:8px">
                <div style="font-weight:600">${lab.testName}</div>
                <div style="font-size:0.78rem;color:var(--clr-success);margin-top:4px">📊 ${lab.resultValue}</div>
              </div>
            `).join("")}
        </div>
      </div>

      ${myPlans.length > 0 ? `
      <div class="card" style="margin-top:20px">
        <div class="card-title" style="margin-bottom:12px">💊 My Treatment Plans</div>
        ${myPlans.map(plan => `
          <div style="padding:12px;background:var(--clr-surface-2);border-radius:var(--radius-sm);margin-bottom:8px;border-left:3px solid var(--clr-success)">
            <div style="font-weight:600">${plan.name} ${statusBadge(plan.status)}</div>
            <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:4px">Medications: ${plan.medications.join(", ")}</div>
          </div>
        `).join("")}
      </div>` : ""}
    </div>
  `;
}

/* ============================================================
   ADD PATIENT MODAL (helper)
   ============================================================ */
function showAddPatientModal() {
  // Simple inline modal
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">👤 Register New Patient</div>
      <button class="modal-close" id="close-modal">✕</button>
      <div class="field-group"><label class="field-label">Full Name</label><input class="field-input" id="m-name" placeholder="e.g. John Doe"></div>
      <div class="field-row">
        <div class="field-group"><label class="field-label">Date of Birth</label><input type="date" class="field-input" id="m-dob"></div>
        <div class="field-group"><label class="field-label">Age</label><input type="number" class="field-input" id="m-age" placeholder="e.g. 45"></div>
      </div>
      <div class="field-group"><label class="field-label">Condition / Diagnosis</label><input class="field-input" id="m-condition" placeholder="e.g. Hypertension"></div>
      <div class="field-group"><label class="field-label">Symptoms</label><input class="field-input" id="m-symptoms" placeholder="e.g. Headache, dizziness"></div>
      <div class="field-row">
        <div class="field-group"><label class="field-label">Blood Pressure</label><input class="field-input" id="m-bp" placeholder="e.g. 140/90"></div>
        <div class="field-group"><label class="field-label">Insurance</label><input class="field-input" id="m-insurance" placeholder="e.g. BCBS"></div>
      </div>
      <div class="field-group"><label class="field-label">Phone</label><input class="field-input" id="m-phone" placeholder="+1-555-..."></div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" id="cancel-modal">Cancel</button>
        <button class="btn btn-primary" id="save-patient-modal">Save Patient</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#close-modal").onclick = () => overlay.remove();
  overlay.querySelector("#cancel-modal").onclick = () => overlay.remove();
  overlay.querySelector("#save-patient-modal").onclick = async () => {
    const name = overlay.querySelector("#m-name").value.trim();
    if (!name) { alert("Name is required"); return; }
    const newP = {
      id: uid(), name, dob: overlay.querySelector("#m-dob").value,
      age: parseInt(overlay.querySelector("#m-age").value) || 0,
      condition: overlay.querySelector("#m-condition").value, status: "TRIAGE_PENDING",
      priority: "MEDIUM", symptoms: overlay.querySelector("#m-symptoms").value,
      bloodPressure: overlay.querySelector("#m-bp").value, insurance: overlay.querySelector("#m-insurance").value,
      phone: overlay.querySelector("#m-phone").value, assignedDoctor: null, costLimit: 5000,
    };
    await saveRecord(STORES.PATIENTS, newP);
    state.patients.push(newP);
    await addAuditLog("Patient Registered", `New patient: ${name}`);
    await addNotification(`Patient ${name} registered — triage pending`, "success");
    overlay.remove();
    window.dispatchEvent(new CustomEvent("navigate", { detail: { view: "patients" } }));
  };
}

function showToastLocal(msg, type) {
  import('./state.js').then(m => m.showToast(msg, type));
}
