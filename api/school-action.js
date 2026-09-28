import { db, events } from "hatchable";

export const access = "public";
export const methods = ["POST"];

async function pub(action,payload={}){
  await events.publish("g10-school-live","state-changed",{source:"school",action,...payload});
}

async function currentLeg(busId){
  const q=await db.query("SELECT current_leg FROM school_runs WHERE bus_id=$1",[busId]);
  return q.rows[0]?.current_leg||"MATIN";
}

async function activeSubscriberCount(busId){
  const q=await db.query("SELECT COUNT(*)::int AS n FROM school_students WHERE bus_id=$1 AND status='ACTIF'",[busId]);
  return Number(q.rows[0]?.n||0);
}

async function dailyOnboardCount(busId,leg){
  const q=await db.query("SELECT COUNT(*)::int AS n FROM school_daily_rides WHERE service_date=CURRENT_DATE AND bus_id=$1 AND leg=$2 AND status='MONTE'",[busId,leg]);
  return Number(q.rows[0]?.n||0);
}

async function subscriberOnboardCount(busId,leg){
  const q=await db.query(`
    SELECT COUNT(*)::int AS n
    FROM school_boardings sb
    JOIN school_students s ON s.id=sb.student_id
    WHERE sb.service_date=CURRENT_DATE
      AND sb.leg=$1
      AND sb.status='MONTE'
      AND s.bus_id=$2
  `,[leg,busId]);
  return Number(q.rows[0]?.n||0);
}

async function refreshBoarded(busId){
  if(!busId) return 0;
  const leg=await currentLeg(busId);
  const subs=await subscriberOnboardCount(busId,leg);
  const daily=await dailyOnboardCount(busId,leg);
  const total=subs+daily;
  await db.query("UPDATE school_runs SET boarded=$1,updated_at=now() WHERE bus_id=$2",[total,busId]);
  return total;
}

async function ensureSubscriptionCapacity(busId,studentId=null,status="ACTIF"){
  if(!busId||status!=="ACTIF") return;
  const cap=await db.query("SELECT capacity FROM school_buses WHERE id=$1 AND active=true",[busId]);
  const capacity=Number(cap.rows[0]?.capacity||0);
  if(!capacity) throw new Error("Bus invalide ou inactif.");
  const q=await db.query("SELECT COUNT(*)::int AS n FROM school_students WHERE bus_id=$1 AND status='ACTIF' AND ($2::int IS NULL OR id<>$2)",[busId,studentId]);
  if(Number(q.rows[0]?.n||0)>=capacity) throw new Error("Ce bus a déjà atteint sa capacité d’abonnés.");
}

export default async function(req,res){
  const b=req.body||{};
  const action=String(b.action||"");

  if(action==="SAVE_ZONE"){
    const id=Number(b.id)||null;
    const name=String(b.name||"").trim();
    if(!name) return res.status(400).json({ok:false,error:"Nom de zone requis."});
    if(id) await db.query("UPDATE school_zones SET name=$1,updated_at=now() WHERE id=$2",[name,id]);
    else await db.query("INSERT INTO school_zones(name,active,updated_at) VALUES ($1,true,now()) ON CONFLICT(name) DO UPDATE SET active=true,updated_at=now()",[name]);
    await pub("SAVE_ZONE");
    return res.json({ok:true});
  }

  if(action==="DELETE_ZONE"){
    const id=Number(b.id);
    if(!id) return res.status(400).json({ok:false,error:"Zone invalide."});
    await db.query("UPDATE school_zones SET active=false,updated_at=now() WHERE id=$1",[id]);
    await db.query("UPDATE school_runs SET zone_id=NULL,current_stop_id=NULL,current_location_label=NULL,updated_at=now() WHERE zone_id=$1",[id]);
    await pub("DELETE_ZONE",{id});
    return res.json({ok:true});
  }

  if(action==="SAVE_STOP"){
    const id=Number(b.id)||null,zoneId=Number(b.zoneId);
    const name=String(b.name||"").trim();
    if(!zoneId||!name) return res.status(400).json({ok:false,error:"Zone et nom de l’arrêt requis."});
    if(id) await db.query("UPDATE school_stops SET name=$1,zone_id=$2,updated_at=now() WHERE id=$3",[name,zoneId,id]);
    else{
      const q=await db.query("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM school_stops WHERE zone_id=$1",[zoneId]);
      await db.query("INSERT INTO school_stops(zone_id,name,sort_order,active,updated_at) VALUES ($1,$2,$3,true,now()) ON CONFLICT(zone_id,name) DO UPDATE SET active=true,updated_at=now()",[zoneId,name,Number(q.rows[0]?.n||1)]);
    }
    await pub("SAVE_STOP",{zoneId});
    return res.json({ok:true});
  }

  if(action==="DELETE_STOP"){
    const id=Number(b.id);
    if(!id) return res.status(400).json({ok:false,error:"Arrêt invalide."});
    await db.query("UPDATE school_stops SET active=false,updated_at=now() WHERE id=$1",[id]);
    await pub("DELETE_STOP",{id});
    return res.json({ok:true});
  }

  if(action==="REORDER_STOPS"){
    const zoneId=Number(b.zoneId),ids=Array.isArray(b.stopIds)?b.stopIds.map(Number):[];
    if(!zoneId||!ids.length) return res.status(400).json({ok:false,error:"Ordre invalide."});
    for(let i=0;i<ids.length;i++) await db.query("UPDATE school_stops SET sort_order=$1,updated_at=now() WHERE id=$2 AND zone_id=$3",[i+1,ids[i],zoneId]);
    await pub("REORDER_STOPS",{zoneId});
    return res.json({ok:true});
  }

  if(action==="SAVE_DESTINATION"){
    const id=Number(b.id)||null;
    const name=String(b.name||"").trim();
    const zoneId=Number(b.zoneId)||null;
    const demoZone=String(b.demoZone||"").trim()||null;
    if(!name) return res.status(400).json({ok:false,error:"Nom de l’établissement requis."});

    let destinationId=id;
    if(id){
      await db.query("UPDATE school_destinations SET name=$1,demo_zone=COALESCE($2,demo_zone),active=true,updated_at=now() WHERE id=$3",[name,demoZone,id]);
    }else{
      const q=await db.query(`
        INSERT INTO school_destinations(name,demo_zone,active,updated_at)
        VALUES ($1,$2,true,now())
        ON CONFLICT(name) DO UPDATE SET active=true,updated_at=now()
        RETURNING id
      `,[name,demoZone]);
      destinationId=Number(q.rows[0]?.id||0);
    }

    if(zoneId&&destinationId){
      const ord=await db.query("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM school_destination_zones WHERE zone_id=$1 AND active=true",[zoneId]);
      await db.query(`
        INSERT INTO school_destination_zones(destination_id,zone_id,sort_order,active,updated_at)
        VALUES ($1,$2,$3,true,now())
        ON CONFLICT(destination_id,zone_id)
        DO UPDATE SET active=true,updated_at=now()
      `,[destinationId,zoneId,Number(ord.rows[0]?.n||1)]);
    }
    await pub("SAVE_DESTINATION",{destinationId,zoneId});
    return res.json({ok:true,id:destinationId});
  }

  if(action==="ASSOCIATE_DESTINATION"){
    const destinationId=Number(b.destinationId),zoneId=Number(b.zoneId);
    if(!destinationId||!zoneId) return res.status(400).json({ok:false,error:"Zone et établissement requis."});
    const ord=await db.query("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM school_destination_zones WHERE zone_id=$1 AND active=true",[zoneId]);
    await db.query(`
      INSERT INTO school_destination_zones(destination_id,zone_id,sort_order,active,updated_at)
      VALUES ($1,$2,$3,true,now())
      ON CONFLICT(destination_id,zone_id)
      DO UPDATE SET active=true,updated_at=now()
    `,[destinationId,zoneId,Number(ord.rows[0]?.n||1)]);
    await pub("ASSOCIATE_DESTINATION",{destinationId,zoneId});
    return res.json({ok:true});
  }

  if(action==="REMOVE_DESTINATION_ZONE"){
    const destinationId=Number(b.destinationId),zoneId=Number(b.zoneId);
    if(!destinationId||!zoneId) return res.status(400).json({ok:false,error:"Zone et établissement requis."});
    await db.query("UPDATE school_destination_zones SET active=false,updated_at=now() WHERE destination_id=$1 AND zone_id=$2",[destinationId,zoneId]);
    await pub("REMOVE_DESTINATION_ZONE",{destinationId,zoneId});
    return res.json({ok:true});
  }

  if(action==="REORDER_DESTINATIONS"){
    const zoneId=Number(b.zoneId),ids=Array.isArray(b.destinationIds)?b.destinationIds.map(Number):[];
    if(!zoneId||!ids.length) return res.status(400).json({ok:false,error:"Ordre des établissements invalide."});
    for(let i=0;i<ids.length;i++){
      await db.query("UPDATE school_destination_zones SET sort_order=$1,updated_at=now() WHERE destination_id=$2 AND zone_id=$3",[i+1,ids[i],zoneId]);
    }
    await pub("REORDER_DESTINATIONS",{zoneId});
    return res.json({ok:true});
  }

  if(action==="DELETE_DESTINATION"){
    const id=Number(b.id);
    if(!id) return res.status(400).json({ok:false,error:"Établissement invalide."});
    await db.query("UPDATE school_destination_zones SET active=false,updated_at=now() WHERE destination_id=$1",[id]);
    await db.query("UPDATE school_destinations SET active=false,updated_at=now() WHERE id=$1",[id]);
    await pub("DELETE_DESTINATION",{id});
    return res.json({ok:true});
  }

  if(action==="ADD_STUDENT" || action==="UPDATE_STUDENT"){
    const id=Number(b.id)||null;
    const name=String(b.name||"").trim();
    if(!name) return res.status(400).json({ok:false,error:"Nom de l’élève requis."});

    const guardianName=String(b.guardianName||"").trim();
    const guardianPhone=String(b.guardianPhone||"").trim();
    const guardianPinRaw=b.guardianPin===null||b.guardianPin===undefined?"":String(b.guardianPin).trim();
    const guardianPin=guardianPinRaw||"0000";
    const zone=String(b.zone||"").trim();
    const pickup=String(b.pickup||"").trim();
    const school=String(b.school||"").trim();
    const busId=Number(b.busId)||null;
    const monthly=Math.max(0,Number(b.monthlyAmount||60000));
    const status=String(b.status||"ACTIF");
    const morningPickupPlanned=String(b.morningPickupPlanned||"").trim();
    const schoolStartTime=String(b.schoolStartTime||"").trim();
    const returnPickupPlanned=String(b.returnPickupPlanned||"").trim();
    const returnArrivalPlanned=String(b.returnArrivalPlanned||"").trim();

    if(zone&&pickup){
      const p=await db.query(`
        SELECT 1 FROM school_stops s
        JOIN school_zones z ON z.id=s.zone_id
        WHERE z.name=$1 AND s.name=$2 AND z.active=true AND s.active=true
        LIMIT 1
      `,[zone,pickup]);
      if(!p.rows[0]) return res.status(400).json({ok:false,error:"Le point d’arrêt ne correspond pas à la zone sélectionnée."});
    }
    if(zone&&school){
      const q=await db.query(`
        SELECT 1 FROM school_destinations d
        JOIN school_destination_zones dz ON dz.destination_id=d.id AND dz.active=true
        JOIN school_zones z ON z.id=dz.zone_id AND z.active=true
        WHERE z.name=$1 AND d.name=$2 AND d.active=true
        LIMIT 1
      `,[zone,school]);
      if(!q.rows[0]) return res.status(400).json({ok:false,error:"Cet établissement n’est pas desservi par la zone sélectionnée."});
    }

    try{await ensureSubscriptionCapacity(busId,id,status)}catch(e){return res.status(409).json({ok:false,error:e.message})}

    if(action==="ADD_STUDENT"){
      await db.query(`
        INSERT INTO school_students
        (name,guardian_name,guardian_phone,guardian_pin,zone,pickup,school,bus_id,monthly_amount,status,absence_today,
         morning_pickup_planned,school_start_time,return_pickup_planned,return_arrival_planned,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,now())
      `,[name,guardianName,guardianPhone,guardianPin,zone,pickup,school,busId,monthly,status,morningPickupPlanned,schoolStartTime,returnPickupPlanned,returnArrivalPlanned]);
    }else{
      await db.query(`
        UPDATE school_students SET
          name=$1,guardian_name=$2,guardian_phone=$3,
          guardian_pin=CASE WHEN $4='' THEN guardian_pin ELSE $4 END,
          zone=$5,pickup=$6,school=$7,bus_id=$8,monthly_amount=$9,status=$10,
          morning_pickup_planned=$11,school_start_time=$12,return_pickup_planned=$13,return_arrival_planned=$14,
          updated_at=now()
        WHERE id=$15
      `,[name,guardianName,guardianPhone,guardianPinRaw,zone,pickup,school,busId,monthly,status,morningPickupPlanned,schoolStartTime,returnPickupPlanned,returnArrivalPlanned,id]);
    }
    await pub(action,{id});
    return res.json({ok:true});
  }

  if(action==="DELETE_STUDENT"){
    const id=Number(b.id);
    if(!id) return res.status(400).json({ok:false,error:"Élève invalide."});
    await db.query("DELETE FROM school_students WHERE id=$1",[id]);
    await pub("DELETE_STUDENT",{id});
    return res.json({ok:true});
  }

  if(action==="IMPORT_STUDENTS"){
    const rows=Array.isArray(b.rows)?b.rows:[];
    let count=0;
    for(const row of rows){
      const name=String(row.name||row.nom||"").trim();
      if(!name) continue;
      const busId=Number(row.busId||row.bus_id)||null;
      const status=String(row.status||"ACTIF");
      try{await ensureSubscriptionCapacity(busId,null,status)}catch(e){continue}
      await db.query(`
        INSERT INTO school_students
        (name,guardian_name,guardian_phone,guardian_pin,zone,pickup,school,bus_id,monthly_amount,status,absence_today,
         morning_pickup_planned,school_start_time,return_pickup_planned,return_arrival_planned,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,now())
      `,[
        name,String(row.guardianName||row.guardian_name||"").trim(),
        String(row.guardianPhone||row.guardian_phone||"").trim(),
        String(row.guardianPin||row.guardian_pin||"0000").trim()||"0000",
        String(row.zone||"").trim(),String(row.pickup||"").trim(),String(row.school||"").trim(),
        busId,Math.max(0,Number(row.monthlyAmount||row.monthly_amount||60000)),status,
        String(row.morningPickupPlanned||"").trim(),String(row.schoolStartTime||"").trim(),
        String(row.returnPickupPlanned||"").trim(),String(row.returnArrivalPlanned||"").trim()
      ]);
      count++;
    }
    await pub("IMPORT_STUDENTS",{count});
    return res.json({ok:true,count});
  }

  if(action==="SAVE_FARES_BULK"){
    const fares=Array.isArray(b.fares)?b.fares:[];
    let count=0;
    for(const f of fares){
      const id=Number(f.id),amount=Math.max(0,Number(f.dailyAmount||1500));
      if(!id) continue;
      await db.query("UPDATE school_fares SET daily_amount=$1,updated_at=now() WHERE id=$2",[amount,id]);
      count++;
    }
    await pub("SAVE_FARES_BULK",{count});
    return res.json({ok:true,count});
  }

  if(action==="SET_BOARDING"){
    const studentId=Number(b.studentId),leg=String(b.leg||"MATIN"),status=String(b.status||"ATTENDU");
    if(!studentId) return res.status(400).json({ok:false,error:"Élève invalide."});
    if(!["MATIN","RETOUR"].includes(leg)) return res.status(400).json({ok:false,error:"Trajet invalide."});
    if(!["ATTENDU","MONTE","ABSENT","DEPOSE"].includes(status)) return res.status(400).json({ok:false,error:"Statut invalide."});

    const st=await db.query("SELECT id,bus_id,zone,pickup,school FROM school_students WHERE id=$1",[studentId]);
    const student=st.rows[0];
    if(!student) return res.status(404).json({ok:false,error:"Élève introuvable."});
    const busId=Number(student.bus_id||0);

    await db.query(`
      INSERT INTO school_boardings (student_id,service_date,leg,status,boarded_at,dropped_at,updated_at)
      VALUES ($1,CURRENT_DATE,$2,$3,
        CASE WHEN $3='MONTE' THEN now() ELSE NULL END,
        CASE WHEN $3='DEPOSE' THEN now() ELSE NULL END,
        now())
      ON CONFLICT (student_id,service_date,leg)
      DO UPDATE SET status=EXCLUDED.status,
        boarded_at=CASE WHEN EXCLUDED.status='MONTE' THEN COALESCE(school_boardings.boarded_at,now()) ELSE school_boardings.boarded_at END,
        dropped_at=CASE WHEN EXCLUDED.status='DEPOSE' THEN now() ELSE school_boardings.dropped_at END,
        updated_at=now()
    `,[studentId,leg,status]);

    if(busId&&(status==="MONTE"||status==="DEPOSE")){
      const location=(leg==="MATIN")
        ? (status==="MONTE"?student.pickup:student.school)
        : (status==="MONTE"?student.school:student.pickup);
      let stopId=null;
      if(location===student.pickup){
        const q=await db.query(`
          SELECT ss.id FROM school_stops ss
          JOIN school_zones z ON z.id=ss.zone_id
          WHERE z.name=$1 AND ss.name=$2 AND ss.active=true
          LIMIT 1
        `,[student.zone,student.pickup]);
        stopId=q.rows[0]?.id||null;
      }
      await db.query("UPDATE school_runs SET current_stop_id=$1,current_location_label=$2,updated_at=now() WHERE bus_id=$3",[stopId,location,busId]);
    }

    const boarded=await refreshBoarded(busId);
    await pub("SET_BOARDING",{studentId,leg,status,busId});
    return res.json({ok:true,boarded});
  }

  if(action==="SET_PARENT_ABSENCE"){
    const studentId=Number(b.studentId),absent=!!b.absent;
    if(!studentId) return res.status(400).json({ok:false,error:"Élève invalide."});
    await db.query("UPDATE school_students SET absence_today=$1,updated_at=now() WHERE id=$2",[absent,studentId]);
    if(absent){
      await db.query(`
        INSERT INTO school_boardings(student_id,service_date,leg,status,updated_at)
        VALUES ($1,CURRENT_DATE,'MATIN','ABSENT',now())
        ON CONFLICT(student_id,service_date,leg) DO UPDATE SET status='ABSENT',updated_at=now()
      `,[studentId]);
    }else{
      await db.query("DELETE FROM school_boardings WHERE student_id=$1 AND service_date=CURRENT_DATE AND leg='MATIN' AND status='ABSENT'",[studentId]);
    }
    await pub("SET_PARENT_ABSENCE",{studentId,absent});
    return res.json({ok:true});
  }

  if(action==="ADD_DAILY_RIDE"){
    const busId=Number(b.busId),zoneId=Number(b.zoneId),stopId=Number(b.stopId),destinationId=Number(b.destinationId);
    const leg=String(b.leg||"MATIN");
    if(!busId||!zoneId||!stopId||!destinationId) return res.status(400).json({ok:false,error:"Arrêt et établissement requis."});

    const allowed=await db.query(`
      SELECT 1
      FROM school_runs r
      JOIN school_stops s ON s.id=$3 AND s.zone_id=$2 AND s.active=true
      JOIN school_destination_zones dz ON dz.destination_id=$4 AND dz.zone_id=$2 AND dz.active=true
      WHERE r.bus_id=$1 AND r.zone_id=$2
      LIMIT 1
    `,[busId,zoneId,stopId,destinationId]);
    if(!allowed.rows[0]) return res.status(400).json({ok:false,error:"Cet arrêt ou cet établissement ne fait pas partie de la zone affectée à ce bus."});

    const bus=await db.query("SELECT capacity FROM school_buses WHERE id=$1 AND active=true",[busId]);
    const capacity=Number(bus.rows[0]?.capacity||0);
    if(!capacity) return res.status(400).json({ok:false,error:"Bus invalide."});

    const reserved=await activeSubscriberCount(busId);
    const daily=await dailyOnboardCount(busId,leg);
    const maxDaily=Math.max(0,capacity-reserved);
    if(daily>=maxDaily){
      return res.status(409).json({ok:false,error:"Bus complet : "+reserved+" place(s) réservée(s) aux abonnés et "+daily+" place(s) non-abonné(s) déjà utilisées sur "+capacity+"."});
    }

    const fare=await db.query("SELECT daily_amount FROM school_fares WHERE stop_id=$1 AND destination_id=$2 AND active=true LIMIT 1",[stopId,destinationId]);
    const amount=Number(fare.rows[0]?.daily_amount||1500);
    const ins=await db.query("INSERT INTO school_daily_rides(bus_id,zone_id,stop_id,destination_id,leg,fare_amount,status,boarded_at) VALUES ($1,$2,$3,$4,$5,$6,'MONTE',now()) RETURNING id",[busId,zoneId,stopId,destinationId,leg,amount]);

    const loc=await db.query("SELECT name FROM school_stops WHERE id=$1",[stopId]);
    const locationLabel=String(b.locationLabel||loc.rows[0]?.name||"").trim();
    const currentStopId=leg==="MATIN"?stopId:null;
    await db.query("UPDATE school_runs SET current_stop_id=$1,current_location_label=$2,updated_at=now() WHERE bus_id=$3",[currentStopId,locationLabel,busId]);
    const boarded=await refreshBoarded(busId);
    await pub("ADD_DAILY_RIDE",{busId,stopId,destinationId,amount});
    return res.json({ok:true,id:ins.rows[0]?.id,amount,boarded,remaining:maxDaily-daily-1});
  }

  if(action==="ARRIVE_DESTINATION"){
    const busId=Number(b.busId),destinationId=Number(b.destinationId);
    if(!busId||!destinationId) return res.status(400).json({ok:false,error:"Bus et établissement requis."});

    const d=await db.query(`
      SELECT d.name
      FROM school_destinations d
      JOIN school_destination_zones dz ON dz.destination_id=d.id AND dz.active=true
      JOIN school_runs r ON r.bus_id=$2 AND r.zone_id=dz.zone_id
      WHERE d.id=$1 AND d.active=true
      LIMIT 1
    `,[destinationId,busId]);
    const destination=d.rows[0]?.name;
    if(!destination) return res.status(404).json({ok:false,error:"Cet établissement n’est pas desservi par la zone de ce bus."});

    const subs=await db.query(`
      UPDATE school_boardings sb
      SET status='DEPOSE',dropped_at=now(),updated_at=now()
      FROM school_students s
      WHERE sb.student_id=s.id
        AND sb.service_date=CURRENT_DATE
        AND sb.leg='MATIN'
        AND sb.status='MONTE'
        AND s.bus_id=$1
        AND s.school=$2
      RETURNING sb.id
    `,[busId,destination]);

    const cash=await db.query(`
      UPDATE school_daily_rides
      SET status='DEPOSE',dropped_at=now()
      WHERE service_date=CURRENT_DATE
        AND bus_id=$1
        AND leg='MATIN'
        AND destination_id=$2
        AND status='MONTE'
      RETURNING id
    `,[busId,destinationId]);

    await db.query("UPDATE school_runs SET current_stop_id=NULL,current_location_label=$1,updated_at=now() WHERE bus_id=$2",[destination,busId]);
    const boarded=await refreshBoarded(busId);
    await pub("ARRIVE_DESTINATION",{busId,destinationId,subscribers:subs.rows.length,cash:cash.rows.length});
    return res.json({ok:true,subscribers:subs.rows.length,cash:cash.rows.length,boarded});
  }

  if(action==="ARRIVE_STOP"){
    const busId=Number(b.busId),stopId=Number(b.stopId);
    if(!busId||!stopId) return res.status(400).json({ok:false,error:"Bus et arrêt requis."});

    const s=await db.query(`
      SELECT ss.name,z.name AS zone_name
      FROM school_stops ss
      JOIN school_zones z ON z.id=ss.zone_id
      WHERE ss.id=$1 AND ss.active=true
    `,[stopId]);
    const stop=s.rows[0]?.name,zone=s.rows[0]?.zone_name;
    if(!stop) return res.status(404).json({ok:false,error:"Arrêt introuvable."});

    const subs=await db.query(`
      UPDATE school_boardings sb
      SET status='DEPOSE',dropped_at=now(),updated_at=now()
      FROM school_students st
      WHERE sb.student_id=st.id
        AND sb.service_date=CURRENT_DATE
        AND sb.leg='RETOUR'
        AND sb.status='MONTE'
        AND st.bus_id=$1
        AND st.pickup=$2
        AND st.zone=$3
      RETURNING sb.id
    `,[busId,stop,zone]);

    const cash=await db.query(`
      UPDATE school_daily_rides
      SET status='DEPOSE',dropped_at=now()
      WHERE service_date=CURRENT_DATE
        AND bus_id=$1
        AND leg='RETOUR'
        AND stop_id=$2
        AND status='MONTE'
      RETURNING id
    `,[busId,stopId]);

    await db.query("UPDATE school_runs SET current_stop_id=$1,current_location_label=$2,updated_at=now() WHERE bus_id=$3",[stopId,stop,busId]);
    const boarded=await refreshBoarded(busId);
    await pub("ARRIVE_STOP",{busId,stopId,subscribers:subs.rows.length,cash:cash.rows.length});
    return res.json({ok:true,subscribers:subs.rows.length,cash:cash.rows.length,boarded});
  }

  if(action==="DROP_DAILY_GROUP"){
    const busId=Number(b.busId),leg=String(b.leg||"MATIN"),destinationId=Number(b.destinationId)||null,stopId=Number(b.stopId)||null;
    if(!busId) return res.status(400).json({ok:false,error:"Bus invalide."});
    if(leg==="MATIN" && !destinationId) return res.status(400).json({ok:false,error:"Établissement requis."});
    if(leg==="RETOUR" && !stopId) return res.status(400).json({ok:false,error:"Arrêt requis."});

    let q;
    if(leg==="MATIN"){
      q=await db.query("UPDATE school_daily_rides SET status='DEPOSE',dropped_at=now() WHERE service_date=CURRENT_DATE AND bus_id=$1 AND leg=$2 AND destination_id=$3 AND status='MONTE' RETURNING id",[busId,leg,destinationId]);
      const d=await db.query("SELECT name FROM school_destinations WHERE id=$1",[destinationId]);
      await db.query("UPDATE school_runs SET current_stop_id=NULL,current_location_label=$1,updated_at=now() WHERE bus_id=$2",[d.rows[0]?.name||"",busId]);
    }else{
      q=await db.query("UPDATE school_daily_rides SET status='DEPOSE',dropped_at=now() WHERE service_date=CURRENT_DATE AND bus_id=$1 AND leg=$2 AND stop_id=$3 AND status='MONTE' RETURNING id",[busId,leg,stopId]);
      const s=await db.query("SELECT name FROM school_stops WHERE id=$1",[stopId]);
      await db.query("UPDATE school_runs SET current_stop_id=$1,current_location_label=$2,updated_at=now() WHERE bus_id=$3",[stopId,s.rows[0]?.name||"",busId]);
    }
    const boarded=await refreshBoarded(busId);
    await pub("DROP_DAILY_GROUP",{busId,leg,destinationId,stopId,count:q.rows.length});
    return res.json({ok:true,count:q.rows.length,boarded});
  }

  if(action==="CANCEL_DAILY_RIDE"){
    const id=Number(b.id);
    if(!id) return res.status(400).json({ok:false,error:"Saisie invalide."});
    const q=await db.query("DELETE FROM school_daily_rides WHERE id=$1 AND service_date=CURRENT_DATE RETURNING bus_id",[id]);
    const busId=Number(q.rows[0]?.bus_id||0);
    if(busId) await refreshBoarded(busId);
    await pub("CANCEL_DAILY_RIDE",{id,busId});
    return res.json({ok:true});
  }

  if(action==="PASS_STOP"){
    const busId=Number(b.busId),stopId=Number(b.stopId);
    if(!busId||!stopId) return res.status(400).json({ok:false,error:"Arrêt invalide."});
    const st=await db.query("SELECT name FROM school_stops WHERE id=$1",[stopId]);
    await db.query("UPDATE school_runs SET current_stop_id=$1,current_location_label=$2,updated_at=now() WHERE bus_id=$3",[stopId,st.rows[0]?.name||"",busId]);
    await pub("PASS_STOP",{busId,stopId});
    return res.json({ok:true});
  }

  if(action==="CLOSE_CASH"){
    const busId=Number(b.busId);
    const countedAmount=Math.max(0,Number(b.countedAmount||0));
    const transferMethod=String(b.transferMethod||"").trim();
    const destinationPhone=String(b.destinationPhone||"").trim();
    const transactionReference=String(b.transactionReference||"").trim();
    const note=String(b.note||"").trim();

    if(!busId) return res.status(400).json({ok:false,error:"Bus invalide."});
    if(!transferMethod) return res.status(400).json({ok:false,error:"Choisis le mode de remise de la recette."});
    if(transferMethod==="Airtel Money"&&!destinationPhone) return res.status(400).json({ok:false,error:"Entre le numéro Airtel Money destinataire."});

    const q=await db.query("SELECT COALESCE(SUM(fare_amount),0)::int AS total FROM school_daily_rides WHERE service_date=CURRENT_DATE AND bus_id=$1",[busId]);
    const expected=Number(q.rows[0]?.total||0);

    await db.query(`
      INSERT INTO school_cash_closures
        (service_date,bus_id,expected_amount,counted_amount,handed_to,transfer_method,destination_phone,transaction_reference,note,closed_at)
      VALUES (CURRENT_DATE,$1,$2,$3,$4,$4,$5,$6,$7,now())
      ON CONFLICT(service_date,bus_id)
      DO UPDATE SET
        expected_amount=EXCLUDED.expected_amount,
        counted_amount=EXCLUDED.counted_amount,
        handed_to=EXCLUDED.handed_to,
        transfer_method=EXCLUDED.transfer_method,
        destination_phone=EXCLUDED.destination_phone,
        transaction_reference=EXCLUDED.transaction_reference,
        note=EXCLUDED.note,
        closed_at=now()
    `,[busId,expected,countedAmount,transferMethod,destinationPhone,transactionReference,note]);

    await pub("CLOSE_CASH",{busId,expected,countedAmount,transferMethod});
    return res.json({ok:true,expected,countedAmount,difference:countedAmount-expected,transferMethod});
  }

  return res.status(400).json({ok:false,error:"Action inconnue."});
}