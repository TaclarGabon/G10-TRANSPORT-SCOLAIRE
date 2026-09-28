const crypto = require("crypto");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

function gabonDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Libreville",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(v) {
  return String(v || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
}

function guardianKey(name) {
  return crypto.createHash("sha256").update(normalizeName(name)).digest("hex").slice(0, 32);
}

function makePinSecret(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  return { pin_salt: salt, pin_hash: hash };
}

function verifyPin(pin, salt, hash) {
  if (!salt || !hash) return false;
  const a = Buffer.from(crypto.scryptSync(String(pin), salt, 64).toString("hex"), "hex");
  const b = Buffer.from(String(hash), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function plain(v) {
  if (v == null) return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = plain(val);
    return out;
  }
  return v;
}

async function getCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(doc => ({ id: /^\d+$/.test(doc.id) ? Number(doc.id) : doc.id, ...plain(doc.data()) }));
}

async function nextId(collectionName) {
  const ref = db.doc("meta/counters");
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const next = Number(data[collectionName] || 0) + 1;
    tx.set(ref, { [collectionName]: next }, { merge: true });
    return next;
  });
}

async function touchSync(action = "update") {
  const ref = db.doc("system/sync");
  await ref.set({
    version: FieldValue.increment(1),
    action,
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });
}

function docId(v) {
  return String(Number(v));
}

function isMgmt(role) {
  return ["ADMIN", "OPERATIONS", "GUARD", "DIRECTION"].includes(String(role || ""));
}

async function optionalAuth(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return null;
  try {
    return await auth.verifyIdToken(h.slice(7));
  } catch {
    return null;
  }
}

async function requireAuth(req) {
  const token = await optionalAuth(req);
  if (!token) {
    const e = new Error("Authentification requise.");
    e.status = 401;
    throw e;
  }
  if (["ADMIN","OPERATIONS","GUARD","DIRECTION"].includes(token.role)) {
    const authTime = Number(token.auth_time || 0) * 1000;
    if (!authTime || Date.now() - authTime > 12 * 60 * 60 * 1000) {
      const e = new Error("Session de gestion expirée. Entre de nouveau le code d’accès.");
      e.status = 401;
      throw e;
    }
  }
  return token;
}

async function requireRoles(req, roles) {
  const token = await requireAuth(req);
  if (!roles.includes(token.role)) {
    const e = new Error("Accès non autorisé.");
    e.status = 403;
    throw e;
  }
  return token;
}

async function writeGuardianProfile(guardianName, pin, studentId) {
  const key = guardianKey(guardianName);
  const ref = db.doc("guardians/" + key);
  const snap = await ref.get();
  const data = {
    guardian_name: guardianName,
    normalized_name: normalizeName(guardianName),
    updated_at: FieldValue.serverTimestamp()
  };
  if (pin) Object.assign(data, makePinSecret(pin));
  if (studentId != null) {
    data.student_ids = FieldValue.arrayUnion(Number(studentId));
  }
  if (!snap.exists && !pin) {
    const e = new Error("Un mot de passe parent est requis pour ce nouveau responsable.");
    e.status = 400;
    throw e;
  }
  await ref.set(data, { merge: true });
  return key;
}

async function removeStudentFromGuardian(guardianName, studentId) {
  if (!guardianName) return;
  const key = guardianKey(guardianName);
  await db.doc("guardians/" + key).set({
    student_ids: FieldValue.arrayRemove(Number(studentId)),
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });
}

module.exports = {
  admin, db, auth, FieldValue, Timestamp,
  gabonDateKey, nowIso, normalizeName, guardianKey,
  makePinSecret, verifyPin, plain, getCollection,
  nextId, touchSync, docId, isMgmt,
  optionalAuth, requireAuth, requireRoles,
  writeGuardianProfile, removeStudentFromGuardian
};
