/**
 * EHCP — Main Application Entry Point
 * Orchestrates login, routing, navigation, shell rendering
 */

import { openDB, seedIfEmpty } from './database.js';
import { login, clearSession, getSession, getNavItems, defaultView, ROLE_META } from './auth.js';
import { state, refreshState, addAuditLog, addNotification, renderNotifBadge, showToast } from './state.js';
import {
  renderDashboard, renderPatients, renderPatientDetail, renderAppointments,
  renderTriage, renderTreatmentPlans, renderLab, renderBilling,
  renderReports, renderAudit, renderAdmin, renderPatientPortal
} from './views.js';

/* ============================================================
   INITIALIZATION
   ============================================================ */
(async function init() {
  try {
    await openDB();
    await seedIfEmpty();
    await refreshState();
    const existing = getSession();
    if (existing) {
      state.session = existing;
      bootApp();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error("EHCP Init Error:", err);
    document.body.innerHTML = `<div style="color:#ef4444;padding:40px;font-family:monospace">Failed to initialize EHCP: ${err.message}</div>`;
  }
})();

/* ============================================================
   LOGIN
   ============================================================ */
function showLoginScreen() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-shell").classList.add("hidden");
  setupLoginHandlers();
}

function setupLoginHandlers() {
  // Role quick-select buttons
  const roleBtns = document.querySelectorAll(".role-btn");
  roleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      roleBtns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      // Pre-fill credentials
      const credMap = {
        "Admin":               ["admin",      "admin123"],
        "Doctor":              ["dr.smith",   "doc123"],
        "Nurse":               ["nurse.ray",  "nurse123"],
        "Receptionist":        ["reception",  "recep123"],
        "Lab Technician":      ["labtech",    "lab123"],
        "Billing Officer":     ["billing",    "bill123"],
        "Compliance Officer":  ["compliance", "comp123"],
        "Patient":             ["patient1",   "pat123"],
        "Specialist":          ["dr.jones",   "spec123"],
      };
      const cred = credMap[btn.dataset.role];
      if (cred) {
        document.getElementById("login-username").value = cred[0];
        document.getElementById("login-password").value = cred[1];
      }
    });
  });

  // Login button
  document.getElementById("login-btn")?.addEventListener("click", handleLogin);
  document.getElementById("login-password")?.addEventListener("keydown", e => {
    if (e.key === "Enter") handleLogin();
  });
}

async function handleLogin() {
  const username = document.getElementById("login-username")?.value.trim();
  const password = document.getElementById("login-password")?.value;
  const errEl    = document.getElementById("login-error");
  const btn      = document.getElementById("login-btn");

  if (errEl) errEl.textContent = "";
  if (btn) { btn.textContent = "Signing in…"; btn.disabled = true; }

  try {
    const session = await login(username, password);
    state.session = session;
    await addAuditLog("User Login", `${session.name} logged in as ${session.role}`, session.username);
    await refreshState();
    bootApp();
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
    if (btn) { btn.textContent = "Sign In →"; btn.disabled = false; }
  }
}

/* ============================================================
   APP SHELL BOOT
   ============================================================ */
function bootApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  buildSidebar();
  updateHeader();
  state.currentView = defaultView(state.session.role);
  renderCurrentView();
  setupGlobalHandlers();

  // Background reminder job
  setInterval(async () => {
    if (state.session) await addNotification("⏰ Reminder: Outstanding triage queue review due","info");
  }, 120000);
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function buildSidebar() {
  const role = state.session.role;
  const meta = ROLE_META[role] || {};

  // Avatar + user info
  document.getElementById("sidebar-user-name").textContent = state.session.name;
  document.getElementById("sidebar-user-role").textContent = meta.label || role;
  document.getElementById("sidebar-avatar").textContent = state.session.avatar || meta.icon || "👤";
  document.getElementById("sidebar-avatar").style.color = meta.color || "#3b82f6";
  document.getElementById("sidebar-avatar").style.borderColor = meta.color || "#3b82f6";

  // Nav items
  const nav = document.getElementById("nav-menu");
  const items = getNavItems(role);
  let currentSection = "";

  nav.innerHTML = items.map(item => {
    let sectionHtml = "";
    if (item.section !== currentSection) {
      currentSection = item.section;
      sectionHtml = `<div class="nav-section-title">${item.section}</div>`;
    }
    return `${sectionHtml}
      <div class="nav-item" data-view="${item.id}">
        <div class="nav-icon">${item.icon}</div>
        <span>${item.label}</span>
      </div>`;
  }).join("");

  // Nav click handlers
  nav.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      navigate(item.dataset.view);
    });
  });
}

function setActiveNav(viewId) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });
}

/* ============================================================
   HEADER
   ============================================================ */
function updateHeader() {
  const role = state.session.role;
  const meta = ROLE_META[role] || {};
  const chip = document.getElementById("role-chip");
  if (chip) {
    chip.textContent = `${meta.icon || "👤"} ${role}`;
    chip.style.color  = meta.color || "#3b82f6";
    chip.style.borderColor = meta.color || "#3b82f6";
  }
}

function updatePageTitle(viewId) {
  const titles = {
    dashboard:         "Dashboard",
    patients:          "Patients",
    "patient-detail":  "Patient Detail",
    appointments:      "Appointments",
    triage:            "Triage Queue",
    "treatment-plans": "Treatment Plans",
    lab:               "Lab & Diagnostics",
    billing:           "Billing",
    reports:           "Analytics & Reports",
    audit:             "Audit & Compliance",
    admin:             "Admin Panel",
    "my-portal":       "My Health Portal",
  };
  const el = document.getElementById("page-title");
  if (el) el.textContent = titles[viewId] || viewId;
}

/* ============================================================
   ROUTING
   ============================================================ */
function navigate(viewId) {
  state.currentView = viewId;
  setActiveNav(viewId);
  updatePageTitle(viewId);
  renderCurrentView();
}

function renderCurrentView() {
  const container = document.getElementById("view-container");
  if (!container) return;
  container.innerHTML = "";

  const view = state.currentView;
  switch (view) {
    case "dashboard":        renderDashboard(container);       break;
    case "patients":         renderPatients(container);        break;
    case "patient-detail":   renderPatientDetail(container);   break;
    case "appointments":     renderAppointments(container);    break;
    case "triage":           renderTriage(container);          break;
    case "treatment-plans":  renderTreatmentPlans(container);  break;
    case "lab":              renderLab(container);             break;
    case "billing":          renderBilling(container);         break;
    case "reports":          renderReports(container);         break;
    case "audit":            renderAudit(container);           break;
    case "admin":            renderAdmin(container);           break;
    case "my-portal":        renderPatientPortal(container);   break;
    default:                 renderDashboard(container);
  }
}

/* ============================================================
   GLOBAL EVENTS
   ============================================================ */
function setupGlobalHandlers() {
  // Custom navigation events (from views)
  window.addEventListener("navigate", async (e) => {
    await refreshState();
    navigate(e.detail.view);
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await addAuditLog("User Logout", `${state.session?.name} logged out`);
    clearSession();
    state.session = null;
    showLoginScreen();
  });

  // Notification bell
  document.getElementById("notif-btn")?.addEventListener("click", () => {
    toggleNotifPanel();
  });

  // Keyboard shortcut: Escape closes overlays
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay, .notif-panel").forEach(el => el.remove());
    }
  });
}

/* ============================================================
   NOTIFICATION PANEL
   ============================================================ */
function toggleNotifPanel() {
  const existing = document.querySelector(".notif-panel");
  if (existing) { existing.remove(); return; }

  const panel = document.createElement("div");
  panel.className = "notif-panel";

  const unread = state.notifications.filter(n => !n.read).length;
  panel.innerHTML = `
    <div class="notif-header">
      <span style="font-family:'Sora',sans-serif;font-weight:700">Notifications ${unread > 0 ? `<span class="badge badge-danger" style="margin-left:6px">${unread}</span>` : ""}</span>
      <button id="close-notif-panel" class="modal-close" style="position:static">✕</button>
    </div>
    ${state.notifications.slice(0, 20).map(n => `
      <div class="notif-item">
        <div class="notif-dot-small" style="background:${n.type==='error'?'var(--clr-danger)':n.type==='success'?'var(--clr-success)':n.type==='warning'?'var(--clr-warning)':'var(--clr-primary)'}"></div>
        <div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${new Date(n.createdAt).toLocaleString()}</div>
        </div>
      </div>
    `).join("") || `<div style="padding:24px;text-align:center;color:var(--clr-text-muted)">No notifications</div>`}
  `;

  document.body.appendChild(panel);
  panel.querySelector("#close-notif-panel").onclick = () => panel.remove();

  // Mark all as read
  state.notifications.forEach(n => n.read = true);
  renderNotifBadge();
}
