/**
 * EHCP — Application State & Utilities
 * Central state, toast, audit logging helpers
 */

import { saveRecord, getAll, STORES } from './database.js';

/* ============================================================
   GLOBAL STATE
   ============================================================ */
export const state = {
  session:         null,
  currentView:     "dashboard",
  selectedPatientId: null,
  patients:        [],
  appointments:    [],
  labOrders:       [],
  treatmentPlans:  [],
  auditLogs:       [],
  notifications:   [],
  approvals:       [],
};

export async function refreshState() {
  const [
    patients, appointments, labOrders,
    treatmentPlans, auditLogs, notifications, approvals
  ] = await Promise.all([
    getAll(STORES.PATIENTS),
    getAll(STORES.APPOINTMENTS),
    getAll(STORES.LAB_ORDERS),
    getAll(STORES.TREATMENT_PLANS),
    getAll(STORES.AUDIT_LOGS),
    getAll(STORES.NOTIFICATIONS),
    getAll(STORES.APPROVALS),
  ]);
  Object.assign(state, { patients, appointments, labOrders, treatmentPlans, auditLogs, notifications, approvals });
}

/* ============================================================
   AUDIT LOGGING
   ============================================================ */
export async function addAuditLog(action, details, userId = null) {
  const entry = {
    id:        Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    role:      state.session?.role || "System",
    action,
    details,
    userId:    userId || state.session?.username || "system",
  };
  await saveRecord(STORES.AUDIT_LOGS, entry);
  state.auditLogs.unshift(entry);
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
export async function addNotification(message, type = "info") {
  const notif = {
    id:        Date.now() + Math.random(),
    message,
    type,
    read:      false,
    createdAt: new Date().toISOString(),
  };
  await saveRecord(STORES.NOTIFICATIONS, notif);
  state.notifications.unshift(notif);
  renderNotifBadge();
  showToast(message, type);
}

export function renderNotifBadge() {
  const unread  = state.notifications.filter(n => !n.read).length;
  const badge   = document.getElementById("notif-badge");
  const dot     = document.querySelector(".notif-dot");
  if (badge) {
    if (unread > 0) { badge.textContent = unread > 9 ? "9+" : unread; badge.classList.remove("hidden"); }
    else badge.classList.add("hidden");
  }
  if (dot) { dot.style.display = unread > 0 ? "block" : "none"; }
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
export function showToast(msg, type = "info") {
  const root  = document.getElementById("toast-root");
  if (!root) return;
  const icons = { success: "✅", error: "🚨", info: "ℹ️", warning: "⚠️" };
  const toast = document.createElement("div");
  toast.className = `toast t-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${msg}</span>`;
  root.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(20px)"; toast.style.transition = "all 0.3s"; setTimeout(() => toast.remove(), 300); }, 4000);
}

/* ============================================================
   TRIAGE RULE ENGINE
   ============================================================ */
export function applyTriageRules(patient) {
  let priority    = "LOW";
  let assignDoctor = patient.assignedDoctor || "Dr. Marcus Smith";

  const symptoms  = (patient.symptoms || "").toLowerCase();
  const systolic  = parseInt((patient.bloodPressure || "0/0").split("/")[0]);

  // Critical rules
  if (symptoms.includes("chest pain") || symptoms.includes("shortness of breath")) {
    priority    = "HIGH";
    assignDoctor = "Dr. Marcus Smith (Emergency)";
  } else if (symptoms.includes("stroke") || symptoms.includes("seizure")) {
    priority    = "HIGH";
    assignDoctor = "Dr. Anika Jones (Emergency)";
  }

  // Age-based escalation
  if (patient.age > 65 && systolic > 140) { priority = "HIGH"; }

  // Moderate priority
  if (priority !== "HIGH") {
    if (systolic > 130 || patient.age > 55) priority = "MEDIUM";
    if (symptoms.includes("fever") || symptoms.includes("pain")) priority = "MEDIUM";
  }

  return { ...patient, priority, assignedDoctor: assignDoctor };
}

/* ============================================================
   PATIENT STATUS MACHINE
   ============================================================ */
export const STATUS_FLOW = [
  "DRAFT","SUBMITTED","TRIAGE_PENDING","TRIAGED",
  "ASSIGNED_TO_DOCTOR","CONSULTED","TREATMENT_STARTED","COMPLETED","FOLLOW_UP_REQUIRED"
];

export async function updatePatientStatus(patientId, newStatus) {
  const patient = state.patients.find(p => p.id === patientId);
  if (!patient) return;
  const old = patient.status;
  patient.status = newStatus;
  await saveRecord(STORES.PATIENTS, patient);
  state.patients = state.patients.map(p => p.id === patientId ? patient : p);
  await addAuditLog("Patient Status Changed", `${patient.name}: ${old} → ${newStatus}`);
  await addNotification(`${patient.name} moved to ${newStatus.replace(/_/g," ")}`, "success");
}

/* ============================================================
   STATUS / PRIORITY BADGE HELPERS
   ============================================================ */
export function statusBadge(status) {
  const map = {
    "TRIAGE_PENDING":     ["warning", "⏳ Triage Pending"],
    "TRIAGED":            ["info",    "✔ Triaged"],
    "DRAFT":              ["muted",   "📝 Draft"],
    "SUBMITTED":          ["accent",  "📨 Submitted"],
    "ASSIGNED_TO_DOCTOR": ["info",    "👨‍⚕️ Assigned"],
    "CONSULTED":          ["accent",  "🩺 Consulted"],
    "TREATMENT_STARTED":  ["success", "💊 In Treatment"],
    "COMPLETED":          ["success", "✅ Completed"],
    "FOLLOW_UP_REQUIRED": ["warning", "🔁 Follow-Up"],
    "ACTIVE":             ["success", "🟢 Active"],
    "APPROVED":           ["success", "✅ Approved"],
    "REVIEW":             ["warning", "👁 Review"],
    "CLOSED":             ["muted",   "⬛ Closed"],
    "Processing":         ["warning", "⚙️ Processing"],
    "Sample Collected":   ["info",    "🧪 Sample Taken"],
    "Results Uploaded":   ["success", "📊 Results Ready"],
    "scheduled":          ["info",    "📅 Scheduled"],
    "waitlist":           ["warning", "⏳ Waitlist"],
    "cancelled":          ["danger",  "❌ Cancelled"],
  };
  const [type, label] = map[status] || ["muted", status];
  return `<span class="badge badge-${type}">${label}</span>`;
}

export function priorityBadge(priority) {
  const map = { HIGH: "danger", MEDIUM: "warning", LOW: "success" };
  const icons = { HIGH: "🔴", MEDIUM: "🟡", LOW: "🟢" };
  const cls = map[priority] || "muted";
  return `<span class="badge badge-${cls}">${icons[priority] || ""} ${priority}</span>`;
}

/* ============================================================
   ROLE COLOR HELPER
   ============================================================ */
export const ROLE_COLORS = {
  Admin:               "#8b5cf6",
  Doctor:              "#3b82f6",
  Specialist:          "#8b5cf6",
  Nurse:               "#06b6d4",
  Receptionist:        "#10b981",
  "Lab Technician":    "#f59e0b",
  "Billing Officer":   "#f97316",
  "Compliance Officer":"#ec4899",
  Patient:             "#64748b",
};

/* ============================================================
   DATE / TIME FORMATTERS
   ============================================================ */
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ============================================================
   UNIQUE ID
   ============================================================ */
export const uid = () => Date.now() + Math.floor(Math.random() * 10000);
