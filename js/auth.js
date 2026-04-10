/**
 * EHCP — Authentication & Role-Based Access Control
 * Manages login sessions, role permissions, and access checks
 */

import { getRecord, saveRecord, STORES } from './database.js';

/* ---- Session ---- */
const SESSION_KEY = "ehcp_session";

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/* ---- Login ---- */
export async function login(username, password) {
  if (!username || !password) throw new Error("Username and password are required");
  const user = await getRecord(STORES.USERS, username.toLowerCase().trim());
  if (!user || user.password !== password) throw new Error("Invalid credentials");
  const session = { username: user.username, role: user.role, name: user.name, avatar: user.avatar, loginAt: Date.now() };
  setSession(session);
  return session;
}

/* ====================================================
   RBAC — Permission Matrix
   Role → array of granted permissions
   ==================================================== */
const ROLE_PERMISSIONS = {
  Admin: [
    "view_dashboard","view_patients","view_patient_detail",
    "create_patient","edit_patient","delete_patient",
    "view_appointments","create_appointment","cancel_appointment",
    "view_triage","perform_triage",
    "view_treatment_plans","create_treatment","edit_treatment","approve_treatment",
    "view_lab","order_lab","upload_results","view_lab_results",
    "view_reports","export_reports",
    "view_audit","export_audit",
    "view_billing","edit_billing",
    "view_admin","simulate_edge_cases","manage_users",
    "emergency_override",
  ],

  Doctor: [
    "view_dashboard","view_patients","view_patient_detail",
    "view_appointments","create_appointment",
    "view_triage","perform_triage",
    "view_treatment_plans","create_treatment","edit_treatment","approve_treatment",
    "view_lab","order_lab","view_lab_results",
    "view_reports",
    "view_billing",
  ],

  Specialist: [
    "view_dashboard","view_patients","view_patient_detail",
    "view_appointments",
    "view_triage",
    "view_treatment_plans","edit_treatment","approve_treatment",
    "view_lab","order_lab","view_lab_results",
    "view_reports",
  ],

  Nurse: [
    "view_dashboard","view_patients","view_patient_detail",
    "view_appointments",
    "view_triage","perform_triage",
    "view_treatment_plans","view_lab","view_lab_results",
    "view_reports",
  ],

  Receptionist: [
    "view_dashboard","view_patients","create_patient","view_patient_detail",
    "view_appointments","create_appointment","cancel_appointment",
    "view_triage",
  ],

  "Lab Technician": [
    "view_dashboard","view_patients","view_patient_detail",
    "view_lab","upload_results","view_lab_results",
  ],

  "Billing Officer": [
    "view_dashboard","view_patients","view_patient_detail",
    "view_billing","edit_billing",
    "view_appointments",
    "view_reports","export_reports",
  ],

  "Compliance Officer": [
    "view_dashboard",
    "view_audit","export_audit",
    "view_reports","export_reports",
    "view_patients","view_patient_detail",
  ],

  Patient: [
    "view_dashboard",
    "view_own_appointments",
    "view_own_treatment_plans",
    "view_own_lab_results",
  ],
};

/* ---- Permission Check ---- */
export function can(permission, role) {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

/* ---- Role Metadata ---- */
export const ROLE_META = {
  Admin:               { icon: "🛡️",  color: "#8b5cf6", label: "Administrator" },
  Doctor:              { icon: "👨‍⚕️",  color: "#3b82f6", label: "Physician" },
  Specialist:          { icon: "🩺",  color: "#8b5cf6", label: "Specialist" },
  Nurse:               { icon: "👩‍⚕️",  color: "#06b6d4", label: "Registered Nurse" },
  Receptionist:        { icon: "🧑‍💼",  color: "#10b981", label: "Receptionist" },
  "Lab Technician":    { icon: "🔬",  color: "#f59e0b", label: "Lab Technician" },
  "Billing Officer":   { icon: "💳",  color: "#f97316", label: "Billing Officer" },
  "Compliance Officer":{ icon: "📋",  color: "#ec4899", label: "Compliance Officer" },
  Patient:             { icon: "🧑",  color: "#64748b", label: "Patient" },
};

/* ---- Default Dashboard Route per Role ---- */
export function defaultView(role) {
  const map = {
    Patient:             "my-portal",
    "Lab Technician":    "lab",
    "Billing Officer":   "billing",
    "Compliance Officer":"audit",
    Receptionist:        "appointments",
  };
  return map[role] || "dashboard";
}

/* ---- Nav Items per Role ---- */
export function getNavItems(role) {
  const ALL_ITEMS = [
    { id: "dashboard",       icon: "⚡", label: "Dashboard",      section: "MAIN", perm: "view_dashboard" },
    { id: "patients",        icon: "👥", label: "Patients",        section: "MAIN", perm: "view_patients" },
    { id: "appointments",    icon: "📅", label: "Appointments",    section: "MAIN", perm: "view_appointments" },
    { id: "triage",          icon: "🚨", label: "Triage Queue",    section: "CLINICAL", perm: "view_triage" },
    { id: "treatment-plans", icon: "💊", label: "Treatment Plans", section: "CLINICAL", perm: "view_treatment_plans" },
    { id: "lab",             icon: "🔬", label: "Lab & Diagnostics",section:"CLINICAL", perm: "view_lab" },
    { id: "billing",         icon: "💳", label: "Billing",         section: "ADMIN", perm: "view_billing" },
    { id: "reports",         icon: "📊", label: "Analytics",       section: "ADMIN", perm: "view_reports" },
    { id: "audit",           icon: "🔍", label: "Audit & Compliance",section:"ADMIN", perm: "view_audit" },
    { id: "admin",           icon: "⚙️", label: "Admin Panel",     section: "ADMIN", perm: "view_admin" },
    { id: "my-portal",       icon: "🏠", label: "My Health Portal",section: "MAIN", perm: "view_dashboard" },
  ];

  // Patient sees only patient portal
  if (role === "Patient") {
    return ALL_ITEMS.filter(i => ["my-portal"].includes(i.id));
  }

  return ALL_ITEMS
    .filter(i => i.id !== "my-portal")
    .filter(i => can(i.perm, role));
}
