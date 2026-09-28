const crypto = require("crypto");
const { db, auth, verifyPin, guardianKey, normalizeName } = require("./core");
const { ensureBase } = require("./seed");

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function attemptKey(kind,identity){
  return crypto.createHash("sha256").update(String(kind)+"|"+String(identity)).digest("hex");
}
async function assertNotLocked(kind,identity){
  const ref=db.doc("authAttempts/"+attemptKey(kind,identity));
  const snap=await ref.get();
  const locked=snap.data()?.locked_until?.toDate?.();
  if(locked&&locked.getTime()>Date.now()){
    const seconds=Math.ceil((locked.getTime()-Date.now())/1000);
    const e=new Error("Trop de tentatives. Réessaie dans "+Math.ceil(seconds/60)+" minute(s).");
    e.status=429;throw e;
  }
}
async function recordFailure(kind,identity){
  const ref=db.doc("authAttempts/"+attemptKey(kind,identity));
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),data=snap.exists?snap.data():{};
    const last=data.last_failed_at?.toDate?.();
    const fresh=!last||Date.now()-last.getTime()>10*60*1000;
    const count=(fresh?0:Number(data.fail_count||0))+1;
    const next={fail_count:count,last_failed_at:new Date()};
    if(count>=5)next.locked_until=new Date(Date.now()+10*60*1000);
    tx.set(ref,next,{merge:true});
  });
}
async function clearFailures(kind,identity){
  await db.doc("authAttempts/"+attemptKey(kind,identity)).delete().catch(()=>{});
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

    await assertNotLocked("management",requested);
    let role = null;
    for (const candidate of candidates) {
      if (!["ADMIN", "OPERATIONS", "GUARD", "DIRECTION"].includes(candidate)) continue;
      if (safeEqual(pin, secrets[candidate])) {
        role = candidate;
        break;
      }
    }
    if (!role) {
      await recordFailure("management",requested);
      return res.status(401).json({ ok: false, error: "Code d’accès incorrect." });
    }
    await clearFailures("management",requested);

    const uid = "mgmt-" + role.toLowerCase();
    const customToken = await auth.createCustomToken(uid, { role });
    return res.json({ ok: true, customToken, role });
  }

  if (kind === "driver") {
    const driverId = Number(b.driverId);
    const pin = String(b.pin || "");
    if (!driverId || !pin) return res.status(400).json({ ok: false, error: "Chauffeur et PIN requis." });

    await assertNotLocked("driver",driverId);
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
      await recordFailure("driver",driverId);
      return res.status(401).json({ ok: false, error: "Code chauffeur incorrect." });
    }
    await clearFailures("driver",driverId);

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
    await assertNotLocked("parent",key);
    const snap = await db.doc("guardians/" + key).get();
    if (!snap.exists) return res.status(401).json({ ok: false, error: "Nom du parent ou mot de passe incorrect." });
    const g = snap.data();

    if (normalizeName(g.guardian_name) !== normalizeName(name) || !verifyPin(pin, g.pin_salt, g.pin_hash)) {
      await recordFailure("parent",key);
      return res.status(401).json({ ok: false, error: "Nom du parent ou mot de passe incorrect." });
    }
    await clearFailures("parent",key);

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
