import { db, events } from "hatchable";

export const access = "public";
export const methods = ["POST"];

const fields=["pneus","feux","huile","niveaux","tableau","dommages"];

async function publish(busId,action,driverId){
  await events.publish("g10-school-live","state-changed",{source:"driver",busId,driverId,action});
}

export default async function(req,res){
  const {driverId,pin,busId,action,payload,sessionVersion}=req.body||{};
  const did=Number(driverId),bid=Number(busId);

  const dr=await db.query("SELECT id,name,pin,active_status,access_status,session_version,archived_at FROM school_drivers WHERE id=$1",[did]);
  const driver=dr.rows[0];
  if(!driver||driver.pin!==String(pin||"")) return res.status(401).json({ok:false,error:"Code chauffeur incorrect."});
  if(driver.archived_at||driver.active_status!=="ACTIF") return res.status(403).json({ok:false,error:"Ce chauffeur est inactif."});
  if(driver.access_status==="SUSPENDU") return res.status(403).json({ok:false,error:"Accès chauffeur suspendu par la Direction."});

  if(action==="LOGIN"){
    const qr=await db.query("SELECT r.*,b.capacity,b.active FROM school_runs r JOIN school_buses b ON b.id=r.bus_id WHERE r.bus_id=$1",[bid]);
    const run=qr.rows[0];
    if(!run||Number(run.driver_id)!==did) return res.status(403).json({ok:false,error:"Ce bus n’est pas affecté à ce chauffeur."});
    if(!run.active) return res.status(403).json({ok:false,error:"Ce bus est inactif."});
    await db.query("UPDATE school_runs SET status=CASE WHEN status='NON_ASSIGNE' THEN 'ASSIGNE' ELSE status END,updated_at=now() WHERE bus_id=$1",[bid]);
    await publish(bid,action,did);
    return res.json({ok:true,sessionVersion:Number(driver.session_version)});
  }

  if(Number(sessionVersion)!==Number(driver.session_version)){
    return res.status(401).json({ok:false,error:"Session chauffeur expirée. Reconnecte-toi."});
  }

  if(action==="ACK_WARNING"){
    const warningId=Number(payload?.warningId);
    if(!warningId) return res.status(400).json({ok:false,error:"Avertissement invalide."});
    const q=await db.query(`
      UPDATE school_driver_warnings
      SET acknowledged_at=COALESCE(acknowledged_at,now()),updated_at=now()
      WHERE id=$1 AND driver_id=$2 AND status='CONFIRMEE'
      RETURNING id
    `,[warningId,did]);
    if(!q.rows[0]) return res.status(404).json({ok:false,error:"Avertissement confirmé introuvable."});
    await publish(bid,action,did);
    return res.json({ok:true});
  }

  const qr=await db.query("SELECT r.*,b.capacity,b.active FROM school_runs r JOIN school_buses b ON b.id=r.bus_id WHERE r.bus_id=$1",[bid]);
  const run=qr.rows[0];
  if(!run||Number(run.driver_id)!==did) return res.status(403).json({ok:false,error:"Ce bus n’est pas affecté à ce chauffeur."});
  if(!run.active) return res.status(403).json({ok:false,error:"Ce bus est inactif."});

  if(action==="SET_LEG"){
    const leg=String(payload?.leg||"MATIN");
    if(!["MATIN","RETOUR"].includes(leg)) return res.status(400).json({ok:false,error:"Trajet invalide."});
    const checklist=run.checklist||{};
    const checklistOk=fields.every(k=>!!checklist[k]);
    await db.query(`
      UPDATE school_runs SET
        current_leg=$1,current_stop_id=NULL,current_location_label=NULL,boarded=0,stage=0,
        departed_at=NULL,arrived_at=NULL,status=$2,updated_at=now()
      WHERE bus_id=$3
    `,[leg,checklistOk?"CONTROLE_OK":"ASSIGNE",bid]);
  }else if(action==="CHECKLIST"){
    const c=payload&&typeof payload==="object"?payload:{};
    const clean={};fields.forEach(k=>clean[k]=!!c[k]);
    const ok=fields.every(k=>clean[k]);
    await db.query("UPDATE school_runs SET checklist=$1::jsonb,status=$2,updated_at=now() WHERE bus_id=$3",[JSON.stringify(clean),ok?"CONTROLE_OK":"CONTROLE_EN_COURS",bid]);
  }else if(action==="DEPART"){
    const c=run.checklist||{};
    if(!fields.every(k=>c[k])) return res.status(400).json({ok:false,error:"Le contrôle 360° doit être validé avant le départ."});
    if(run.current_leg==="RETOUR"){
      await db.query("UPDATE school_runs SET status='EN_ROUTE',stage=1,departed_at=now(),return_departed_at=now(),arrived_at=NULL,current_location_label='Départ établissements',updated_at=now() WHERE bus_id=$1",[bid]);
    }else{
      await db.query("UPDATE school_runs SET status='EN_ROUTE',stage=1,departed_at=now(),morning_departed_at=now(),arrived_at=NULL,current_location_label='Départ circuit matin',updated_at=now() WHERE bus_id=$1",[bid]);
    }
  }else if(action==="ARRIVE"){
    if(Number(run.boarded||0)>0){
      return res.status(409).json({ok:false,error:"Impossible de terminer le trajet : "+Number(run.boarded||0)+" passager(s) sont encore enregistrés à bord."});
    }

    const leg=run.current_leg==="RETOUR"?"RETOUR":"MATIN";
    const sub=await db.query(`
      SELECT COUNT(*)::int AS n
      FROM school_boardings sb
      JOIN school_students s ON s.id=sb.student_id
      WHERE sb.service_date=CURRENT_DATE AND sb.leg=$1 AND sb.status='DEPOSE' AND s.bus_id=$2
    `,[leg,bid]);
    const cash=await db.query("SELECT COUNT(*)::int AS n FROM school_daily_rides WHERE service_date=CURRENT_DATE AND leg=$1 AND status='DEPOSE' AND bus_id=$2",[leg,bid]);
    const passengers=Number(sub.rows[0]?.n||0)+Number(cash.rows[0]?.n||0);
    const checklist=run.checklist||{};
    const checklistOk=fields.every(k=>!!checklist[k]);
    const plannedEnd=leg==="RETOUR"?run.return_arrival_planned:run.morning_arrival_planned;

    if(leg==="RETOUR"){
      await db.query("UPDATE school_runs SET status='ARRIVE',stage=4,arrived_at=now(),return_arrived_at=now(),current_location_label='Fin du retour',updated_at=now() WHERE bus_id=$1",[bid]);
    }else{
      await db.query("UPDATE school_runs SET status='ARRIVE',stage=4,arrived_at=now(),morning_arrived_at=now(),current_location_label='Arrivée établissements',updated_at=now() WHERE bus_id=$1",[bid]);
    }

    await db.query(`
      INSERT INTO school_driver_activity
        (driver_id,bus_id,service_date,leg,passengers_transported,capacity,planned_end,actual_end,checklist_ok,created_at)
      VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,now(),$7,now())
      ON CONFLICT(driver_id,service_date,leg)
      DO UPDATE SET passengers_transported=EXCLUDED.passengers_transported,capacity=EXCLUDED.capacity,
                    planned_end=EXCLUDED.planned_end,actual_end=now(),checklist_ok=EXCLUDED.checklist_ok
    `,[did,bid,leg,passengers,Number(run.capacity||23),plannedEnd,checklistOk]);
  }else{
    return res.status(400).json({ok:false,error:"Action inconnue."});
  }

  await publish(bid,action,did);
  res.json({ok:true});
}