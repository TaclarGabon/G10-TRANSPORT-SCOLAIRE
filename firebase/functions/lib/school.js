const {
  db, FieldValue, gabonDateKey, nextId, touchSync, requireAuth, requireRoles,
  writeGuardianProfile, removeStudentFromGuardian
}=require("./core");
const { syncFareMatrix }=require("./seed");

function err(status,message){const e=new Error(message);e.status=status;throw e;}
async function all(name){const s=await db.collection(name).get();return s.docs.map(d=>({id:/^\d+$/.test(d.id)?Number(d.id):d.id,...d.data()}));}
async function currentLeg(busId){const s=await db.doc("runs/"+busId).get();return s.data()?.current_leg||"MATIN";}

async function activeSubscriberCount(busId,excludeId=null){
  const students=await all("students");
  return students.filter(s=>Number(s.bus_id)===Number(busId)&&s.status==="ACTIF"&&Number(s.id)!==Number(excludeId||-1)).length;
}
async function dailyOnboardCount(busId,leg){
  const today=gabonDateKey(),rides=await all("dailyRides");
  return rides.filter(r=>r.service_date===today&&Number(r.bus_id)===Number(busId)&&r.leg===leg&&r.status==="MONTE").length;
}
async function subscriberOnboardCount(busId,leg){
  const today=gabonDateKey(),[students,boardings]=await Promise.all([all("students"),all("boardings")]);
  const ids=new Set(students.filter(s=>Number(s.bus_id)===Number(busId)).map(s=>Number(s.id)));
  return boardings.filter(b=>b.service_date===today&&b.leg===leg&&b.status==="MONTE"&&ids.has(Number(b.student_id))).length;
}
async function refreshBoarded(busId){
  if(!busId)return 0;
  const leg=await currentLeg(busId);
  const [subs,daily]=await Promise.all([subscriberOnboardCount(busId,leg),dailyOnboardCount(busId,leg)]);
  const total=subs+daily;
  await db.doc("runs/"+busId).set({boarded:total,updated_at:FieldValue.serverTimestamp()},{merge:true});
  return total;
}
async function ensureSubscriptionCapacity(busId,studentId=null,status="ACTIF"){
  if(!busId||status!=="ACTIF")return;
  const busSnap=await db.doc("buses/"+busId).get(),bus=busSnap.data();
  const capacity=Number(bus?.active?bus.capacity:0);
  if(!capacity)err(400,"Bus invalide ou inactif.");
  const n=await activeSubscriberCount(busId,studentId);
  if(n>=capacity)err(409,"Ce bus a déjà atteint sa capacité d’abonnés.");
}
async function stopMatches(zoneName,pickup){
  const [zones,stops]=await Promise.all([all("zones"),all("stops")]);
  const z=zones.find(x=>x.active!==false&&x.name===zoneName);
  return !!(z&&stops.find(s=>s.active!==false&&Number(s.zone_id)===Number(z.id)&&s.name===pickup));
}
async function destinationMatches(zoneName,school){
  const [zones,dests,links]=await Promise.all([all("zones"),all("destinations"),all("destinationZones")]);
  const z=zones.find(x=>x.active!==false&&x.name===zoneName);
  const d=dests.find(x=>x.active!==false&&x.name===school);
  return !!(z&&d&&links.find(l=>l.active!==false&&Number(l.zone_id)===Number(z.id)&&Number(l.destination_id)===Number(d.id)));
}
async function assertDriverSession(token,busId=null){
  const did=Number(token.driverId);
  const dSnap=await db.doc("drivers/"+did).get();
  if(!dSnap.exists)err(401,"Chauffeur introuvable.");
  const d=dSnap.data();
  if(d.archived_at||d.active_status!=="ACTIF")err(403,"Ce chauffeur est inactif.");
  if(d.access_status==="SUSPENDU")err(403,"Accès chauffeur suspendu par la Direction.");
  if(Number(d.session_version)!==Number(token.sessionVersion))err(401,"Session chauffeur expirée. Reconnecte-toi.");
  if(busId){
    const run=(await db.doc("runs/"+Number(busId)).get()).data();
    if(!run||Number(run.driver_id)!==did)err(403,"Ce bus ne t’est pas affecté.");
  }
  return d;
}
async function authorizeAction(req,action){
  const config=["SAVE_ZONE","DELETE_ZONE","SAVE_STOP","DELETE_STOP","REORDER_STOPS","SAVE_DESTINATION","ASSOCIATE_DESTINATION","REMOVE_DESTINATION_ZONE","REORDER_DESTINATIONS","DELETE_DESTINATION","ADD_STUDENT","UPDATE_STUDENT","DELETE_STUDENT","IMPORT_STUDENTS","SAVE_FARES_BULK"];
  const driver=["SET_BOARDING","ADD_DAILY_RIDE","ARRIVE_DESTINATION","ARRIVE_STOP","DROP_DAILY_GROUP","CANCEL_DAILY_RIDE","PASS_STOP","CLOSE_CASH"];
  if(config.includes(action))return requireRoles(req,["ADMIN","DIRECTION"]);
  if(driver.includes(action)){
    const token=await requireRoles(req,["DRIVER"]);
    await assertDriverSession(token,Number(req.body?.busId)||null);
    return token;
  }
  if(action==="SET_PARENT_ABSENCE")return requireRoles(req,["PARENT","ADMIN","DIRECTION"]);
  return requireAuth(req);
}

async function handleSchoolAction(req,res){
  const b=req.body||{},action=String(b.action||"");
  const token=await authorizeAction(req,action);

  if(action==="SAVE_ZONE"){
    const id=Number(b.id)||null,name=String(b.name||"").trim();
    if(!name)err(400,"Nom de zone requis.");
    if(id){
      await db.doc("zones/"+id).set({name,active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
    }else{
      const zones=await all("zones");
      const existing=zones.find(z=>z.name===name);
      if(existing)await db.doc("zones/"+existing.id).set({active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
      else{
        const newId=await nextId("zones");
        await db.doc("zones/"+newId).set({name,active:true,updated_at:FieldValue.serverTimestamp()});
      }
    }
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="DELETE_ZONE"){
    const id=Number(b.id);if(!id)err(400,"Zone invalide.");
    await db.doc("zones/"+id).set({active:false,updated_at:FieldValue.serverTimestamp()},{merge:true});
    const runs=await db.collection("runs").where("zone_id","==",id).get();
    const batch=db.batch();runs.docs.forEach(d=>batch.set(d.ref,{zone_id:null,current_stop_id:null,current_location_label:null,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    if(!runs.empty)await batch.commit();
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="SAVE_STOP"){
    const id=Number(b.id)||null,zoneId=Number(b.zoneId),name=String(b.name||"").trim();
    if(!zoneId||!name)err(400,"Zone et nom de l’arrêt requis.");
    if(id)await db.doc("stops/"+id).set({name,zone_id:zoneId,active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
    else{
      const stops=await all("stops");
      const same=stops.find(s=>Number(s.zone_id)===zoneId&&s.name===name);
      const ord=1+Math.max(0,...stops.filter(s=>Number(s.zone_id)===zoneId&&s.active!==false).map(s=>Number(s.sort_order||0)));
      if(same)await db.doc("stops/"+same.id).set({active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
      else{
        const newId=await nextId("stops");
        await db.doc("stops/"+newId).set({zone_id:zoneId,name,sort_order:ord,active:true,updated_at:FieldValue.serverTimestamp()});
      }
    }
    await syncFareMatrix();await touchSync(action);return res.json({ok:true});
  }

  if(action==="DELETE_STOP"){
    const id=Number(b.id);if(!id)err(400,"Arrêt invalide.");
    await db.doc("stops/"+id).set({active:false,updated_at:FieldValue.serverTimestamp()},{merge:true});
    const fares=await all("fares");
    const batch=db.batch();fares.filter(f=>Number(f.stop_id)===id).forEach(f=>batch.set(db.doc("fares/"+f.id),{active:false,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    await batch.commit();await touchSync(action);return res.json({ok:true});
  }

  if(action==="REORDER_STOPS"){
    const zoneId=Number(b.zoneId),ids=Array.isArray(b.stopIds)?b.stopIds.map(Number):[];
    if(!zoneId||!ids.length)err(400,"Ordre invalide.");
    const batch=db.batch();ids.forEach((id,i)=>batch.set(db.doc("stops/"+id),{zone_id:zoneId,sort_order:i+1,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    await batch.commit();await touchSync(action);return res.json({ok:true});
  }

  if(action==="SAVE_DESTINATION"){
    const id=Number(b.id)||null,name=String(b.name||"").trim(),zoneId=Number(b.zoneId)||null,demoZone=String(b.demoZone||"").trim()||null;
    if(!name)err(400,"Nom de l’établissement requis.");
    let destinationId=id;
    if(id)await db.doc("destinations/"+id).set({name,demo_zone:demoZone,active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
    else{
      const dests=await all("destinations"),same=dests.find(d=>d.name===name);
      if(same){destinationId=Number(same.id);await db.doc("destinations/"+destinationId).set({active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});}
      else{
        destinationId=await nextId("destinations");
        await db.doc("destinations/"+destinationId).set({name,demo_zone:demoZone,active:true,updated_at:FieldValue.serverTimestamp()});
      }
    }
    if(zoneId&&destinationId){
      const links=await all("destinationZones");
      const ord=1+Math.max(0,...links.filter(l=>Number(l.zone_id)===zoneId&&l.active!==false).map(l=>Number(l.sort_order||0)));
      await db.doc("destinationZones/"+destinationId+"_"+zoneId).set({destination_id:destinationId,zone_id:zoneId,sort_order:ord,active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
    }
    await syncFareMatrix();await touchSync(action);return res.json({ok:true,id:destinationId});
  }

  if(action==="ASSOCIATE_DESTINATION"){
    const destinationId=Number(b.destinationId),zoneId=Number(b.zoneId);
    if(!destinationId||!zoneId)err(400,"Zone et établissement requis.");
    const links=await all("destinationZones");
    const ord=1+Math.max(0,...links.filter(l=>Number(l.zone_id)===zoneId&&l.active!==false).map(l=>Number(l.sort_order||0)));
    await db.doc("destinationZones/"+destinationId+"_"+zoneId).set({destination_id:destinationId,zone_id:zoneId,sort_order:ord,active:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
    await syncFareMatrix();await touchSync(action);return res.json({ok:true});
  }

  if(action==="REMOVE_DESTINATION_ZONE"){
    const destinationId=Number(b.destinationId),zoneId=Number(b.zoneId);
    if(!destinationId||!zoneId)err(400,"Zone et établissement requis.");
    await db.doc("destinationZones/"+destinationId+"_"+zoneId).set({active:false,updated_at:FieldValue.serverTimestamp()},{merge:true});
    const fares=await all("fares");
    const stops=await all("stops");
    const stopIds=new Set(stops.filter(s=>Number(s.zone_id)===zoneId).map(s=>Number(s.id)));
    const batch=db.batch();fares.filter(f=>Number(f.destination_id)===destinationId&&stopIds.has(Number(f.stop_id))).forEach(f=>batch.set(db.doc("fares/"+f.id),{active:false,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    await batch.commit();await touchSync(action);return res.json({ok:true});
  }

  if(action==="REORDER_DESTINATIONS"){
    const zoneId=Number(b.zoneId),ids=Array.isArray(b.destinationIds)?b.destinationIds.map(Number):[];
    if(!zoneId||!ids.length)err(400,"Ordre des établissements invalide.");
    const batch=db.batch();ids.forEach((id,i)=>batch.set(db.doc("destinationZones/"+id+"_"+zoneId),{destination_id:id,zone_id:zoneId,sort_order:i+1,active:true,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    await batch.commit();await touchSync(action);return res.json({ok:true});
  }

  if(action==="DELETE_DESTINATION"){
    const id=Number(b.id);if(!id)err(400,"Établissement invalide.");
    await db.doc("destinations/"+id).set({active:false,updated_at:FieldValue.serverTimestamp()},{merge:true});
    const links=await all("destinationZones"),fares=await all("fares"),batch=db.batch();
    links.filter(l=>Number(l.destination_id)===id).forEach(l=>batch.set(db.doc("destinationZones/"+l.destination_id+"_"+l.zone_id),{active:false,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    fares.filter(f=>Number(f.destination_id)===id).forEach(f=>batch.set(db.doc("fares/"+f.id),{active:false,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    await batch.commit();await touchSync(action);return res.json({ok:true});
  }

  if(action==="ADD_STUDENT"||action==="UPDATE_STUDENT"){
    const id=Number(b.id)||null,name=String(b.name||"").trim();
    if(!name)err(400,"Nom de l’élève requis.");
    const guardianName=String(b.guardianName||"").trim(),guardianPhone=String(b.guardianPhone||"").trim();
    const guardianPinRaw=b.guardianPin==null?"":String(b.guardianPin).trim();
    const zone=String(b.zone||"").trim(),pickup=String(b.pickup||"").trim(),school=String(b.school||"").trim();
    const busId=Number(b.busId)||null,monthly=Math.max(0,Number(b.monthlyAmount||60000)),status=String(b.status||"ACTIF");
    const morningPickupPlanned=String(b.morningPickupPlanned||"").trim(),schoolStartTime=String(b.schoolStartTime||"").trim();
    const returnPickupPlanned=String(b.returnPickupPlanned||"").trim(),returnArrivalPlanned=String(b.returnArrivalPlanned||"").trim();
    if(zone&&pickup&&!(await stopMatches(zone,pickup)))err(400,"Le point d’arrêt ne correspond pas à la zone sélectionnée.");
    if(zone&&school&&!(await destinationMatches(zone,school)))err(400,"Cet établissement n’est pas desservi par la zone sélectionnée.");
    await ensureSubscriptionCapacity(busId,id,status);

    let studentId=id,old=null;
    if(id){const snap=await db.doc("students/"+id).get();old=snap.exists?snap.data():null;if(!old)err(404,"Élève introuvable.");}
    else studentId=await nextId("students");

    const pinForGuardian=action==="ADD_STUDENT"?(guardianPinRaw||"0000"):guardianPinRaw;
    if(old&&old.guardian_name&&old.guardian_name!==guardianName)await removeStudentFromGuardian(old.guardian_name,studentId);
    const gKey=await writeGuardianProfile(guardianName,pinForGuardian,studentId);

    await db.doc("students/"+studentId).set({
      name,guardian_name:guardianName,guardian_phone:guardianPhone,guardian_key:gKey,
      zone,pickup,school,bus_id:busId,monthly_amount:monthly,status,absence_today:old?.absence_today||false,
      morning_pickup_planned:morningPickupPlanned,school_start_time:schoolStartTime,
      return_pickup_planned:returnPickupPlanned,return_arrival_planned:returnArrivalPlanned,
      created_at:old?.created_at||FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()
    },{merge:true});
    await touchSync(action);return res.json({ok:true,id:studentId});
  }

  if(action==="DELETE_STUDENT"){
    const id=Number(b.id);if(!id)err(400,"Élève invalide.");
    const ref=db.doc("students/"+id),snap=await ref.get();if(snap.exists)await removeStudentFromGuardian(snap.data().guardian_name,id);
    await ref.delete();await touchSync(action);return res.json({ok:true});
  }

  if(action==="IMPORT_STUDENTS"){
    const rows=Array.isArray(b.rows)?b.rows:[];let count=0;
    for(const row of rows){
      const name=String(row.name||row.nom||"").trim();if(!name)continue;
      const busId=Number(row.busId||row.bus_id)||null,status=String(row.status||"ACTIF");
      try{await ensureSubscriptionCapacity(busId,null,status);}catch{continue;}
      const id=await nextId("students");
      const guardianName=String(row.guardianName||row.guardian_name||"").trim();
      const guardianPin=String(row.guardianPin||row.guardian_pin||"0000").trim()||"0000";
      const gKey=await writeGuardianProfile(guardianName,guardianPin,id);
      await db.doc("students/"+id).set({
        name,guardian_name:guardianName,guardian_phone:String(row.guardianPhone||row.guardian_phone||"").trim(),guardian_key:gKey,
        zone:String(row.zone||"").trim(),pickup:String(row.pickup||"").trim(),school:String(row.school||"").trim(),
        bus_id:busId,monthly_amount:Math.max(0,Number(row.monthlyAmount||row.monthly_amount||60000)),status,absence_today:false,
        morning_pickup_planned:String(row.morningPickupPlanned||"").trim(),school_start_time:String(row.schoolStartTime||"").trim(),
        return_pickup_planned:String(row.returnPickupPlanned||"").trim(),return_arrival_planned:String(row.returnArrivalPlanned||"").trim(),
        created_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()
      });
      count++;
    }
    await touchSync(action);return res.json({ok:true,count});
  }

  if(action==="SAVE_FARES_BULK"){
    const fares=Array.isArray(b.fares)?b.fares:[],batch=db.batch();let count=0;
    for(const f of fares){
      const id=Number(f.id),amount=Math.max(0,Number(f.dailyAmount||1500));if(!id)continue;
      batch.set(db.doc("fares/"+id),{daily_amount:amount,updated_at:FieldValue.serverTimestamp()},{merge:true});count++;
    }
    if(count)await batch.commit();await touchSync(action);return res.json({ok:true,count});
  }

  if(action==="SET_BOARDING"){
    const studentId=Number(b.studentId),leg=String(b.leg||"MATIN"),status=String(b.status||"ATTENDU");
    if(!studentId)err(400,"Élève invalide.");
    if(!["MATIN","RETOUR"].includes(leg))err(400,"Trajet invalide.");
    if(!["ATTENDU","MONTE","ABSENT","DEPOSE"].includes(status))err(400,"Statut invalide.");
    const stSnap=await db.doc("students/"+studentId).get();if(!stSnap.exists)err(404,"Élève introuvable.");
    const student={id:studentId,...stSnap.data()},busId=Number(student.bus_id||0);
    if(token.role==="DRIVER"&&Number(token.driverId)!==Number((await db.doc("runs/"+busId).get()).data()?.driver_id))err(403,"Cet élève n’est pas affecté à ton bus.");
    const today=gabonDateKey(),ref=db.doc("boardings/"+today+"_"+studentId+"_"+leg),prev=await ref.get();
    const data={student_id:studentId,service_date:today,leg,status,updated_at:FieldValue.serverTimestamp()};
    if(status==="MONTE"&&!prev.data()?.boarded_at)data.boarded_at=FieldValue.serverTimestamp();
    if(status==="DEPOSE")data.dropped_at=FieldValue.serverTimestamp();
    await ref.set(data,{merge:true});
    if(status==="ABSENT"&&token.role==="DRIVER"){
      await db.doc("alerts/absence_"+today+"_"+studentId+"_MATIN").set({
        service_date:today,type:"ABSENCE_RAMASSAGE",student_id:studentId,
        guardian_key:student.guardian_key||null,bus_id:busId,driver_id:Number(token.driverId),
        status:"NOUVELLE",message:"Élève absent au point de ramassage.",created_at:FieldValue.serverTimestamp()
      },{merge:true});
    }
    if(busId&&(status==="MONTE"||status==="DEPOSE")){
      const location=leg==="MATIN"?(status==="MONTE"?student.pickup:student.school):(status==="MONTE"?student.school:student.pickup);
      let stopId=null;
      if(location===student.pickup){
        const [zones,stops]=await Promise.all([all("zones"),all("stops")]);
        const z=zones.find(x=>x.name===student.zone);
        stopId=stops.find(s=>Number(s.zone_id)===Number(z?.id)&&s.name===student.pickup)?.id||null;
      }
      await db.doc("runs/"+busId).set({current_stop_id:stopId,current_location_label:location,updated_at:FieldValue.serverTimestamp()},{merge:true});
    }
    const boarded=await refreshBoarded(busId);await touchSync(action);return res.json({ok:true,boarded});
  }

  if(action==="SET_PARENT_ABSENCE"){
    const studentId=Number(b.studentId),absent=!!b.absent;if(!studentId)err(400,"Élève invalide.");
    const stRef=db.doc("students/"+studentId),stSnap=await stRef.get();if(!stSnap.exists)err(404,"Élève introuvable.");
    const st=stSnap.data();
    if(token.role==="PARENT"){
      if(st.guardian_key!==token.guardianKey)err(403,"Cet enfant n’est pas lié à votre compte.");
      const gSnap=await db.doc("guardians/"+String(token.guardianKey||"")).get();
      if(!gSnap.exists||Number(gSnap.data().session_version||1)!==Number(token.sessionVersion||1))err(401,"Session parent expirée. Reconnectez-vous.");
    }
    await stRef.set({absence_today:absent,updated_at:FieldValue.serverTimestamp()},{merge:true});
    const today=gabonDateKey(),ref=db.doc("boardings/"+today+"_"+studentId+"_MATIN");
    if(absent){
      await ref.set({student_id:studentId,service_date:today,leg:"MATIN",status:"ABSENT",updated_at:FieldValue.serverTimestamp()},{merge:true});
      await db.doc("alerts/parent_absence_"+today+"_"+studentId).set({
        service_date:today,type:"ABSENCE_PARENT",student_id:studentId,guardian_key:st.guardian_key||null,
        bus_id:Number(st.bus_id)||null,driver_id:null,status:"NOUVELLE",
        message:"Absence signalée par le parent.",created_at:FieldValue.serverTimestamp()
      },{merge:true});
    }else{
      const s=await ref.get();if(s.exists&&s.data().status==="ABSENT")await ref.delete();
      await db.doc("alerts/parent_absence_"+today+"_"+studentId).delete().catch(()=>{});
    }
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="ADD_DAILY_RIDE"){
    const busId=Number(b.busId),zoneId=Number(b.zoneId),stopId=Number(b.stopId),destinationId=Number(b.destinationId),leg=String(b.leg||"MATIN");
    if(!busId||!zoneId||!stopId||!destinationId)err(400,"Arrêt et établissement requis.");
    const run=(await db.doc("runs/"+busId).get()).data();
    if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    const [stopSnap,linkSnap,busSnap]=await Promise.all([db.doc("stops/"+stopId).get(),db.doc("destinationZones/"+destinationId+"_"+zoneId).get(),db.doc("buses/"+busId).get()]);
    if(Number(run?.zone_id)!==zoneId||Number(stopSnap.data()?.zone_id)!==zoneId||linkSnap.data()?.active===false||!linkSnap.exists)err(400,"Cet arrêt ou cet établissement ne fait pas partie de la zone affectée à ce bus.");
    const capacity=Number(busSnap.data()?.active?busSnap.data().capacity:0);if(!capacity)err(400,"Bus invalide.");
    const reserved=await activeSubscriberCount(busId),daily=await dailyOnboardCount(busId,leg),maxDaily=Math.max(0,capacity-reserved);
    if(daily>=maxDaily)err(409,"Bus complet : "+reserved+" place(s) réservée(s) aux abonnés et "+daily+" place(s) non-abonné(s) déjà utilisées sur "+capacity+".");
    const fares=await all("fares"),fare=fares.find(f=>f.active!==false&&Number(f.stop_id)===stopId&&Number(f.destination_id)===destinationId),amount=Number(fare?.daily_amount||1500);
    const id=await nextId("dailyRides"),today=gabonDateKey(),stop=stopSnap.data();
    await db.doc("dailyRides/"+id).set({service_date:today,bus_id:busId,zone_id:zoneId,stop_id:stopId,destination_id:destinationId,leg,fare_amount:amount,status:"MONTE",boarded_at:FieldValue.serverTimestamp(),dropped_at:null});
    await db.doc("runs/"+busId).set({current_stop_id:leg==="MATIN"?stopId:null,current_location_label:String(b.locationLabel||stop?.name||"").trim(),updated_at:FieldValue.serverTimestamp()},{merge:true});
    const boarded=await refreshBoarded(busId);await touchSync(action);return res.json({ok:true,id,amount,boarded,remaining:maxDaily-daily-1});
  }

  if(action==="ARRIVE_DESTINATION"){
    const busId=Number(b.busId),destinationId=Number(b.destinationId);if(!busId||!destinationId)err(400,"Bus et établissement requis.");
    const run=(await db.doc("runs/"+busId).get()).data();if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    const link=await db.doc("destinationZones/"+destinationId+"_"+run.zone_id).get();if(!link.exists||link.data().active===false)err(404,"Cet établissement n’est pas desservi par la zone de ce bus.");
    const dSnap=await db.doc("destinations/"+destinationId).get(),destination=dSnap.data()?.name;if(!destination)err(404,"Établissement introuvable.");
    const today=gabonDateKey(),[students,boardings,rides]=await Promise.all([all("students"),all("boardings"),all("dailyRides")]);
    const studentIds=new Set(students.filter(s=>Number(s.bus_id)===busId&&s.school===destination).map(s=>Number(s.id)));
    let subCount=0,cashCount=0,batch=db.batch();
    boardings.filter(x=>x.service_date===today&&x.leg==="MATIN"&&x.status==="MONTE"&&studentIds.has(Number(x.student_id))).forEach(x=>{batch.set(db.doc("boardings/"+x.id),{status:"DEPOSE",dropped_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true});subCount++;});
    rides.filter(x=>x.service_date===today&&Number(x.bus_id)===busId&&x.leg==="MATIN"&&Number(x.destination_id)===destinationId&&x.status==="MONTE").forEach(x=>{batch.set(db.doc("dailyRides/"+x.id),{status:"DEPOSE",dropped_at:FieldValue.serverTimestamp()},{merge:true});cashCount++;});
    batch.set(db.doc("runs/"+busId),{current_stop_id:null,current_location_label:destination,updated_at:FieldValue.serverTimestamp()},{merge:true});await batch.commit();
    const boarded=await refreshBoarded(busId);await touchSync(action);return res.json({ok:true,subscribers:subCount,cash:cashCount,boarded});
  }

  if(action==="ARRIVE_STOP"){
    const busId=Number(b.busId),stopId=Number(b.stopId);if(!busId||!stopId)err(400,"Bus et arrêt requis.");
    const run=(await db.doc("runs/"+busId).get()).data();if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    const [sSnap,zones,students,boardings,rides]=await Promise.all([db.doc("stops/"+stopId).get(),all("zones"),all("students"),all("boardings"),all("dailyRides")]);
    if(!sSnap.exists||sSnap.data().active===false)err(404,"Arrêt introuvable.");
    const stop=sSnap.data().name,zone=zones.find(z=>Number(z.id)===Number(sSnap.data().zone_id))?.name;
    const today=gabonDateKey(),studentIds=new Set(students.filter(s=>Number(s.bus_id)===busId&&s.pickup===stop&&s.zone===zone).map(s=>Number(s.id)));
    let subCount=0,cashCount=0,batch=db.batch();
    boardings.filter(x=>x.service_date===today&&x.leg==="RETOUR"&&x.status==="MONTE"&&studentIds.has(Number(x.student_id))).forEach(x=>{batch.set(db.doc("boardings/"+x.id),{status:"DEPOSE",dropped_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true});subCount++;});
    rides.filter(x=>x.service_date===today&&Number(x.bus_id)===busId&&x.leg==="RETOUR"&&Number(x.stop_id)===stopId&&x.status==="MONTE").forEach(x=>{batch.set(db.doc("dailyRides/"+x.id),{status:"DEPOSE",dropped_at:FieldValue.serverTimestamp()},{merge:true});cashCount++;});
    batch.set(db.doc("runs/"+busId),{current_stop_id:stopId,current_location_label:stop,updated_at:FieldValue.serverTimestamp()},{merge:true});await batch.commit();
    const boarded=await refreshBoarded(busId);await touchSync(action);return res.json({ok:true,subscribers:subCount,cash:cashCount,boarded});
  }

  if(action==="DROP_DAILY_GROUP"){
    const busId=Number(b.busId),leg=String(b.leg||"MATIN"),destinationId=Number(b.destinationId)||null,stopId=Number(b.stopId)||null;
    if(!busId)err(400,"Bus invalide.");if(leg==="MATIN"&&!destinationId)err(400,"Établissement requis.");if(leg==="RETOUR"&&!stopId)err(400,"Arrêt requis.");
    const run=(await db.doc("runs/"+busId).get()).data();if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    const today=gabonDateKey(),rides=await all("dailyRides"),matches=rides.filter(r=>r.service_date===today&&Number(r.bus_id)===busId&&r.leg===leg&&r.status==="MONTE"&&(leg==="MATIN"?Number(r.destination_id)===destinationId:Number(r.stop_id)===stopId));
    const batch=db.batch();matches.forEach(r=>batch.set(db.doc("dailyRides/"+r.id),{status:"DEPOSE",dropped_at:FieldValue.serverTimestamp()},{merge:true}));
    let label="",currentStopId=null;if(leg==="MATIN"){label=(await db.doc("destinations/"+destinationId).get()).data()?.name||"";}else{label=(await db.doc("stops/"+stopId).get()).data()?.name||"";currentStopId=stopId;}
    batch.set(db.doc("runs/"+busId),{current_stop_id:currentStopId,current_location_label:label,updated_at:FieldValue.serverTimestamp()},{merge:true});await batch.commit();
    const boarded=await refreshBoarded(busId);await touchSync(action);return res.json({ok:true,count:matches.length,boarded});
  }

  if(action==="CANCEL_DAILY_RIDE"){
    const id=Number(b.id);if(!id)err(400,"Saisie invalide.");
    const ref=db.doc("dailyRides/"+id),snap=await ref.get();if(!snap.exists)return res.json({ok:true});
    const busId=Number(snap.data().bus_id||0),run=(await db.doc("runs/"+busId).get()).data();if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    await ref.delete();const boarded=await refreshBoarded(busId);await touchSync(action);return res.json({ok:true,boarded});
  }

  if(action==="PASS_STOP"){
    const busId=Number(b.busId),stopId=Number(b.stopId);if(!busId||!stopId)err(400,"Arrêt invalide.");
    const run=(await db.doc("runs/"+busId).get()).data();if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    const stop=(await db.doc("stops/"+stopId).get()).data();await db.doc("runs/"+busId).set({current_stop_id:stopId,current_location_label:stop?.name||"",updated_at:FieldValue.serverTimestamp()},{merge:true});
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="CLOSE_CASH"){
    const busId=Number(b.busId),countedAmount=Math.max(0,Number(b.countedAmount||0)),transferMethod=String(b.transferMethod||"").trim();
    const destinationPhone=String(b.destinationPhone||"").trim(),transactionReference=String(b.transactionReference||"").trim(),note=String(b.note||"").trim();
    if(!busId)err(400,"Bus invalide.");if(!transferMethod)err(400,"Choisis le mode de remise de la recette.");if(transferMethod==="Airtel Money"&&!destinationPhone)err(400,"Entre le numéro Airtel Money destinataire.");
    const run=(await db.doc("runs/"+busId).get()).data();if(Number(run?.driver_id)!==Number(token.driverId))err(403,"Ce bus ne t’est pas affecté.");
    const today=gabonDateKey(),rides=await all("dailyRides"),expected=rides.filter(r=>r.service_date===today&&Number(r.bus_id)===busId).reduce((n,r)=>n+Number(r.fare_amount||0),0);
    await db.doc("cashClosures/"+today+"_"+busId).set({
      service_date:today,bus_id:busId,expected_amount:expected,counted_amount:countedAmount,handed_to:transferMethod,transfer_method:transferMethod,
      destination_phone:destinationPhone,transaction_reference:transactionReference,note,closed_at:FieldValue.serverTimestamp()
    },{merge:true});
    await touchSync(action);return res.json({ok:true,expected,countedAmount,difference:countedAmount-expected,transferMethod});
  }

  err(400,"Action inconnue.");
}

module.exports={handleSchoolAction,refreshBoarded};
