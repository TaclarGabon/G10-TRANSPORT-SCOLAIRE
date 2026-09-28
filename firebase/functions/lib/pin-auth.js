const crypto = require("crypto");
const { db, auth, verifyPin, guardianKey, normalizeName } = require("./core");
const { ensureBase } = require("./seed");

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

async function handlePinAuth(req, res, secrets) {
  await ensureBase();
  const b = req.body || {};
  const kind = String(b.kind || "").toLowerCase();

  if (kind === "management") {
    const requested = String(b.role || "").toUpperCase();
    const pin = String(b.pin || "");
    const candidates = requested === "ADMIN_OR_DIRECTION"
      ? ["ADMIN", "DIRECTION"]
      : [requested];

    let role = null;
    for (const candidate of candidates) {
      if (!["ADMIN", "OPERATIONS", "GUARD", "DIRECTION"].includes(candidate)) continue;
      if (safeEqual(pin, secrets[candidate])) {
        role = candidate;
        break;
      }
    }
    if (!role) return res.status(401).json({ ok: false, error: "Code d’accès incorrect." });

    const uid = "mgmt-" + role.toLowerCase();
    const customToken = await auth.createCustomToken(uid, { role });
    return res.json({ ok: true, customToken, role });
  }

  if (kind === "driver") {
    const driverId = Number(b.driverId);
    const pin = String(b.pin || "");
    if (!driverId || !pin) return res.status(400).json({ ok: false, error: "Chauffeur et PIN requis." });

    const snap = await db.doc("drivers/" + driverId).get();
    if (!snap.exists) return res.status(401).json({ ok: false, error: "Chauffeur introuvable." });
    const d = snap.data();

    if (d.archived_at || d.active_status !== "ACTIF") {
      return res.status(403).json({ ok: false, error: "Ce chauffeur est inactif." });
    }
    if (d.access_status === "SUSPENDU") {
      return res.status(403).json({ ok: false, error: "Accès chauffeur suspendu par la Direction." });
    }
    if (!verifyPin(pin, d.pin_salt, d.pin_hash)) {
      return res.status(401).json({ ok: false, error: "Code chauffeur incorrect." });
    }

    const uid = "driver-" + driverId;
    const customToken = await auth.createCustomToken(uid, {
      role: "DRIVER",
      driverId,
      sessionVersion: Number(d.session_version || 1)
    });
    return res.json({
      ok: true,
      customToken,
      role: "DRIVER",
      driverId,
      sessionVersion: Number(d.session_version || 1)
    });
  }

  if (kind === "parent") {
    const name = String(b.guardianName || "").trim();
    const pin = String(b.pin || "");
    if (!name || !pin) return res.status(400).json({ ok: false, error: "Nom du parent et mot de passe requis." });

    const key = guardianKey(name);
    const snap = await db.doc("guardians/" + key).get();
    if (!snap.exists) return res.status(401).json({ ok: false, error: "Nom du parent ou mot de passe incorrect." });
    const g = snap.data();

    if (normalizeName(g.guardian_name) !== normalizeName(name) || !verifyPin(pin, g.pin_salt, g.pin_hash)) {
      return res.status(401).json({ ok: false, error: "Nom du parent ou mot de passe incorrect." });
    }

    const uid = "parent-" + key;
    const customToken = await auth.createCustomToken(uid, {
      role: "PARENT",
      guardianKey: key
    });
    return res.json({
      ok: true,
      customToken,
      role: "PARENT",
      guardianName: g.guardian_name
    });
  }

  return res.status(400).json({ ok: false, error: "Type de connexion invalide." });
}

module.exports = { handlePinAuth };
