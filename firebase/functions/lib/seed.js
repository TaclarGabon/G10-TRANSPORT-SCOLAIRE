const { db, FieldValue, makePinSecret, nextId, docId } = require("./core");

const BASE_ZONES = [
  { id: 1, name: "Akanda" },
  { id: 2, name: "Owendo" }
];

const BASE_STOPS = [
  { id: 1, zone_id: 1, name: "Amissa", sort_order: 1 },
  { id: 2, zone_id: 1, name: "Carrefour Jiji", sort_order: 2 },
  { id: 3, zone_id: 1, name: "Okala", sort_order: 3 },
  { id: 4, zone_id: 1, name: "Cité des Ailes", sort_order: 4 },
  { id: 5, zone_id: 2, name: "Pont Nomba", sort_order: 1 },
  { id: 6, zone_id: 2, name: "SNI", sort_order: 2 },
  { id: 7, zone_id: 2, name: "Lycée Technique", sort_order: 3 },
  { id: 8, zone_id: 2, name: "Alénakiri", sort_order: 4 }
];

const BASE_DESTINATIONS = [
  { id: 1, name: "Lycée d'État", demo_zone: "Akanda", zone_id: 1, sort_order: 1 },
  { id: 2, name: "Lycée Léon Mba", demo_zone: "Akanda", zone_id: 1, sort_order: 2 },
  { id: 3, name: "Quaben", demo_zone: "Akanda", zone_id: 1, sort_order: 3 },
  { id: 4, name: "Sainte-Marie", demo_zone: "Akanda", zone_id: 1, sort_order: 4 },
  { id: 5, name: "Immaculée", demo_zone: "Akanda", zone_id: 1, sort_order: 5 },
  { id: 6, name: "Bessieux", demo_zone: "Akanda", zone_id: 1, sort_order: 6 },
  { id: 7, name: "Lycée Technique National Omar Bongo", demo_zone: "Owendo", zone_id: 2, sort_order: 1 },
  { id: 8, name: "Lycée Public d'Owendo", demo_zone: "Owendo", zone_id: 2, sort_order: 2 },
  { id: 9, name: "CES d'Alénakiri", demo_zone: "Owendo", zone_id: 2, sort_order: 3 },
  { id: 10, name: "Lycée Privé Catholique Don Bosco", demo_zone: "Owendo", zone_id: 2, sort_order: 4 }
];

async function ensureBase() {
  const batch = db.batch();

  for (const z of BASE_ZONES) {
    const ref = db.doc("zones/" + z.id);
    const snap = await ref.get();
    if (!snap.exists) batch.set(ref, { name: z.name, active: true, updated_at: FieldValue.serverTimestamp() });
  }

  for (const s of BASE_STOPS) {
    const ref = db.doc("stops/" + s.id);
    const snap = await ref.get();
    if (!snap.exists) batch.set(ref, {
      zone_id: s.zone_id, name: s.name, sort_order: s.sort_order, active: true, updated_at: FieldValue.serverTimestamp()
    });
  }

  for (const d of BASE_DESTINATIONS) {
    const ref = db.doc("destinations/" + d.id);
    const snap = await ref.get();
    if (!snap.exists) batch.set(ref, {
      name: d.name, demo_zone: d.demo_zone, active: true, updated_at: FieldValue.serverTimestamp()
    });
    const linkRef = db.doc("destinationZones/" + d.id + "_" + d.zone_id);
    const linkSnap = await linkRef.get();
    if (!linkSnap.exists) batch.set(linkRef, {
      destination_id: d.id, zone_id: d.zone_id, sort_order: d.sort_order, active: true, updated_at: FieldValue.serverTimestamp()
    });
  }

  for (const id of [1, 2]) {
    const drvRef = db.doc("drivers/" + id);
    const drvSnap = await drvRef.get();
    if (!drvSnap.exists) {
      const pin = makePinSecret(String(1200 + id));
      batch.set(drvRef, {
        name: "",
        employment_status: "ACTIF",
        active_status: "ACTIF",
        access_status: "AUTORISE",
        session_version: 1,
        archived_at: null,
        ...pin,
        updated_at: FieldValue.serverTimestamp()
      });
    }

    const busRef = db.doc("buses/" + id);
    const busSnap = await busRef.get();
    if (!busSnap.exists) {
      batch.set(busRef, {
        label: "Bus " + id,
        capacity: 23,
        plate: "",
        active: true,
        scheduled_start: "À définir",
        updated_at: FieldValue.serverTimestamp()
      });
    }

    const runRef = db.doc("runs/" + id);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      batch.set(runRef, {
        bus_id: id,
        driver_id: null,
        zone_id: null,
        status: "NON_ASSIGNE",
        checklist: {},
        boarded: 0,
        stage: 0,
        current_stop_id: null,
        current_leg: "MATIN",
        current_location_label: null,
        morning_departure_planned: "À définir",
        morning_arrival_planned: "À définir",
        return_departure_planned: "À définir",
        return_arrival_planned: "À définir",
        morning_departed_at: null,
        morning_arrived_at: null,
        return_departed_at: null,
        return_arrived_at: null,
        departed_at: null,
        arrived_at: null,
        updated_at: FieldValue.serverTimestamp()
      });
    }
  }

  const countersRef=db.doc("meta/counters");
  const countersSnap=await countersRef.get();
  if(!countersSnap.exists){
    batch.set(countersRef, {
      drivers: 2, buses: 2, zones: 2, stops: 8, destinations: 10,
      students: 0, fares: 0, dailyRides: 0, driverWarnings: 0
    });
  }

  batch.set(db.doc("system/sync"), {
    version: 0,
    action: "bootstrap",
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
  await syncFareMatrix();
}

async function syncFareMatrix() {
  const [zonesSnap, stopsSnap, linksSnap, destSnap, faresSnap] = await Promise.all([
    db.collection("zones").where("active", "==", true).get(),
    db.collection("stops").where("active", "==", true).get(),
    db.collection("destinationZones").where("active", "==", true).get(),
    db.collection("destinations").where("active", "==", true).get(),
    db.collection("fares").where("active", "==", true).get()
  ]);

  const zones = new Map(zonesSnap.docs.map(d => [Number(d.id), { id: Number(d.id), ...d.data() }]));
  const stops = stopsSnap.docs.map(d => ({ id: Number(d.id), ...d.data() }));
  const links = linksSnap.docs.map(d => d.data());
  const dests = new Map(destSnap.docs.map(d => [Number(d.id), { id: Number(d.id), ...d.data() }]));
  const existing = new Map();
  for (const f of faresSnap.docs) {
    const data = f.data();
    existing.set(Number(data.stop_id) + "_" + Number(data.destination_id), { id: Number(f.id), ...data });
  }

  for (const stop of stops) {
    const zone = zones.get(Number(stop.zone_id));
    if (!zone) continue;
    const zoneLinks = links.filter(l => Number(l.zone_id) === Number(stop.zone_id));
    for (const link of zoneLinks) {
      const dest = dests.get(Number(link.destination_id));
      if (!dest) continue;
      const key = Number(stop.id) + "_" + Number(dest.id);
      if (existing.has(key)) continue;
      const id = await nextId("fares");
      await db.doc("fares/" + id).set({
        zone: zone.name,
        pickup: stop.name,
        school: dest.name,
        stop_id: Number(stop.id),
        destination_id: Number(dest.id),
        daily_amount: 1500,
        monthly_amount: 0,
        active: true,
        updated_at: FieldValue.serverTimestamp()
      });
    }
  }
}

async function fullResetSeed() {
  const collections = [
    "boardings", "dailyRides", "cashClosures", "students", "fares",
    "driverWarnings", "driverActivity", "driverMonthAwards", "guardians", "authAttempts",
    "destinationZones", "destinations", "stops", "zones", "runs", "buses", "drivers"
  ];
  for (const name of collections) {
    const snap = await db.collection(name).get();
    const chunks = [];
    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count === 400) {
        chunks.push(batch.commit());
        batch = db.batch();
        count = 0;
      }
    }
    if (count) chunks.push(batch.commit());
    await Promise.all(chunks);
  }
  await db.doc("meta/counters").delete().catch(() => {});
  await ensureBase();
}

module.exports = { ensureBase, syncFareMatrix, fullResetSeed };
