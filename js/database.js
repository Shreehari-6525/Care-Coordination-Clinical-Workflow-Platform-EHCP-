/**
 * EHCP — Database Module (IndexedDB)
 * Handles all persistent storage operations
 */

const DB_NAME    = "EHCP_DB_v2";
const DB_VERSION = 1;
let   db         = null;

export const STORES = {
  PATIENTS:        "patients",
  APPOINTMENTS:    "appointments",
  LAB_ORDERS:      "labOrders",
  TREATMENT_PLANS: "treatmentPlans",
  AUDIT_LOGS:      "auditLogs",
  NOTIFICATIONS:   "notifications",
  APPROVALS:       "approvals",
  USERS:           "users",
  DOCUMENTS:       "documents",
};

/* ---- Open / Upgrade ---- */
export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      const makeStore = (name, opts = {}) => {
        if (!d.objectStoreNames.contains(name)) {
          const s = d.createObjectStore(name, opts.key ? { keyPath: opts.key } : { keyPath: "id", autoIncrement: !!opts.auto });
          if (opts.idx) opts.idx.forEach(i => s.createIndex(i, i, { unique: false }));
          return s;
        }
      };
      makeStore(STORES.PATIENTS,        { key: "id", idx: ["status","priority","assignedDoctor"] });
      makeStore(STORES.APPOINTMENTS,    { key: "id" });
      makeStore(STORES.LAB_ORDERS,      { key: "id", idx: ["patientId","status"] });
      makeStore(STORES.TREATMENT_PLANS, { key: "id", idx: ["patientId","status"] });
      makeStore(STORES.AUDIT_LOGS,      { key: "id", auto: true, idx: ["role"] });
      makeStore(STORES.NOTIFICATIONS,   { key: "id", auto: true });
      makeStore(STORES.APPROVALS,       { key: "id" });
      makeStore(STORES.USERS,           { key: "username" });
      makeStore(STORES.DOCUMENTS,       { key: "id" });
    };
  });
}

/* ---- CRUD Helpers ---- */
export function getAll(storeName) {
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror  = () => rej(req.error);
  });
}

export function getRecord(storeName, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => res(req.result || null);
    req.onerror  = () => rej(req.error);
  });
}

export function saveRecord(storeName, record) {
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => res(record);
    req.onerror  = () => rej(req.error);
  });
}

export function deleteRecord(storeName, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => res();
    req.onerror  = () => rej(req.error);
  });
}

/* ---- Seed Initial Data ---- */
export async function seedIfEmpty() {
  const existing = await getAll(STORES.PATIENTS);
  if (existing.length > 0) return;

  /* Users (credentials: username / password) */
  const USERS = [
    { username: "admin",      password: "admin123",   role: "Admin",              name: "System Admin",        avatar: "🛡️" },
    { username: "dr.smith",   password: "doc123",     role: "Doctor",             name: "Dr. Marcus Smith",    avatar: "👨‍⚕️" },
    { username: "nurse.ray",  password: "nurse123",   role: "Nurse",              name: "Rachel Nurse",        avatar: "👩‍⚕️" },
    { username: "reception",  password: "recep123",   role: "Receptionist",       name: "Priya Mehta",         avatar: "🧑‍💼" },
    { username: "labtech",    password: "lab123",     role: "Lab Technician",     name: "Aakash Lab",          avatar: "🔬" },
    { username: "billing",    password: "bill123",    role: "Billing Officer",    name: "Sandra Bill",         avatar: "💳" },
    { username: "compliance", password: "comp123",    role: "Compliance Officer", name: "Carlos Audit",        avatar: "📋" },
    { username: "patient1",   password: "pat123",     role: "Patient",            name: "Emily Clark",         avatar: "🧑" },
    { username: "dr.jones",   password: "spec123",    role: "Specialist",         name: "Dr. Anika Jones",     avatar: "🩺" },
  ];
  for (const u of USERS) await saveRecord(STORES.USERS, u);

  /* Patients */
  const mockPatients = [
    { id: 101, name: "Emily Clark",   dob: "1985-03-12", condition: "Hypertension",   status: "TRIAGED",          priority: "MEDIUM", assignedDoctor: "Dr. Marcus Smith", symptoms: "Headache, high BP",           bloodPressure: "145/90", age: 39, insurance: "BCBS",     costLimit: 5000, phone: "+1-555-0101", email: "emily@example.com" },
    { id: 102, name: "Robert Hayes",  dob: "1950-07-22", condition: "Chest Pain",     status: "TRIAGE_PENDING",   priority: "HIGH",   assignedDoctor: null,               symptoms: "Chest Pain, shortness of breath", bloodPressure: "160/95", age: 73, insurance: "Medicare", costLimit: 3000, phone: "+1-555-0102", email: "robert@example.com" },
    { id: 103, name: "Linda Park",    dob: "1990-11-02", condition: "Diabetes",       status: "TREATMENT_STARTED",priority: "MEDIUM", assignedDoctor: "Dr. Anika Jones",  symptoms: "Fatigue, frequent urination", bloodPressure: "128/82", age: 34, insurance: "Cigna",    costLimit: 8000, phone: "+1-555-0103", email: "linda@example.com" },
    { id: 104, name: "James Wilson",  dob: "1978-05-16", condition: "Pneumonia",      status: "TREATMENT_STARTED",priority: "HIGH",   assignedDoctor: "Dr. Marcus Smith", symptoms: "Fever, cough, breathing difficulty", bloodPressure: "130/80", age: 46, insurance: "Aetna",    costLimit: 10000, phone: "+1-555-0104", email: "james@example.com" },
    { id: 105, name: "Sarah Connor",  dob: "2001-01-09", condition: "Anxiety",        status: "TRIAGE_PENDING",   priority: "LOW",    assignedDoctor: null,               symptoms: "Panic attacks, insomnia",     bloodPressure: "118/76", age: 24, insurance: "Cigna",    costLimit: 2000,  phone: "+1-555-0105", email: "sarah@example.com" },
    { id: 106, name: "David Patel",   dob: "1960-12-01", condition: "Hypertension",   status: "COMPLETED",        priority: "LOW",    assignedDoctor: "Dr. Marcus Smith", symptoms: "Occasional dizziness",        bloodPressure: "135/85", age: 63, insurance: "BCBS",     costLimit: 4000,  phone: "+1-555-0106", email: "david@example.com" },
  ];
  for (const p of mockPatients) await saveRecord(STORES.PATIENTS, p);

  /* Appointments */
  const mockAppts = [
    { id: 1001, patientId: 101, doctorName: "Dr. Marcus Smith", date: "2026-04-14", time: "10:30", status: "scheduled",  room: "A12", type: "Follow-up" },
    { id: 1002, patientId: 102, doctorName: "Dr. Marcus Smith", date: "2026-04-10", time: "14:00", status: "waitlist",   room: "ER-1",type: "Emergency" },
    { id: 1003, patientId: 103, doctorName: "Dr. Anika Jones",  date: "2026-04-12", time: "11:00", status: "scheduled",  room: "B05", type: "Consultation" },
    { id: 1004, patientId: 104, doctorName: "Dr. Marcus Smith", date: "2026-04-11", time: "09:00", status: "scheduled",  room: "C02", type: "Treatment" },
  ];
  for (const a of mockAppts) await saveRecord(STORES.APPOINTMENTS, a);

  /* Lab Orders */
  const mockLabs = [
    { id: 2001, patientId: 101, testName: "Lipid Panel",     status: "Results Uploaded", resultValue: "Cholesterol 210 mg/dL — Borderline High", uploadedBy: "Aakash Lab", createdAt: "2026-04-01", sla: 24, urgent: false },
    { id: 2002, patientId: 102, testName: "Troponin I",      status: "Processing",       resultValue: null,                                    uploadedBy: null,         createdAt: "2026-04-09", sla: 4,  urgent: true  },
    { id: 2003, patientId: 103, testName: "HbA1c",           status: "Sample Collected", resultValue: null,                                    uploadedBy: null,         createdAt: "2026-04-08", sla: 12, urgent: false },
    { id: 2004, patientId: 104, testName: "Chest X-Ray",     status: "Results Uploaded", resultValue: "Bilateral opacities — consistent with pneumonia", uploadedBy: "Aakash Lab", createdAt: "2026-04-09", sla: 6, urgent: true },
  ];
  for (const l of mockLabs) await saveRecord(STORES.LAB_ORDERS, l);

  /* Treatment Plans */
  const mockPlans = [
    { id: 3001, patientId: 101, version: 1, name: "Hypertension Management",  medications: ["Lisinopril 10mg","Amlodipine 5mg"], status: "ACTIVE",  cost: 450,  requiresControlledSubstance: false, insuranceApproved: true,  seniorApproved: true  },
    { id: 3002, patientId: 103, version: 1, name: "Diabetes Care Protocol",   medications: ["Metformin 500mg","Glipizide"],       status: "ACTIVE",  cost: 1200, requiresControlledSubstance: false, insuranceApproved: true,  seniorApproved: false },
    { id: 3003, patientId: 104, version: 1, name: "Pneumonia Treatment Plan", medications: ["Amoxicillin","Azithromycin"],        status: "ACTIVE",  cost: 800,  requiresControlledSubstance: false, insuranceApproved: true,  seniorApproved: false },
    { id: 3004, patientId: 102, version: 1, name: "Cardiac Emergency Protocol",medications: ["Aspirin","Morphine Sulfate"],      status: "DRAFT",   cost: 5500, requiresControlledSubstance: true,  insuranceApproved: false, seniorApproved: false },
  ];
  for (const t of mockPlans) await saveRecord(STORES.TREATMENT_PLANS, t);

  /* Seed some audit logs */
  const seedLogs = [
    { timestamp: new Date(Date.now()-900000).toISOString(), role: "Admin",  action: "System Initialized",     details: "EHCP DB seeded with mock data", userId: "admin" },
    { timestamp: new Date(Date.now()-600000).toISOString(), role: "Nurse",  action: "Triage Performed",        details: "Patient Emily Clark triaged → MEDIUM", userId: "nurse.ray" },
    { timestamp: new Date(Date.now()-300000).toISOString(), role: "Doctor", action: "Treatment Plan Created",  details: "Hypertension Management for Emily Clark", userId: "dr.smith" },
  ];
  for (const log of seedLogs) {
    await saveRecord(STORES.AUDIT_LOGS, { id: Date.now() + Math.random(), ...log });
  }
}
