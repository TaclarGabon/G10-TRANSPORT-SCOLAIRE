const {
  db, FieldValue, gabonDateKey, touchSync, requireRoles
}=require("./core");

const fields=["pneus","feux","huile","niveaux","tableau","dommages"];

async function getAll(name){
  const s=await db.collection(name).get();
  return s.docs.map(d=>({id:/^\d+$/.test(d.id)?Number(d.id):d.id,...d.data()}));
}
async function validateDriver(token,busId){
  const did=Number(token.driverId),bid=Number(busId);
  const [dSnap,rSnap,bSnap]=await Promise.all([
    db.doc("drivers/"+did).get(),db.doc("runs/"+bid).get(),db.doc("buses/"+bid).get()
  ]);
  if(!dSnap.exists)throw Object.assign(new Error("Chauffeur introuvable."),{status:401});
  const d=dSnap.data(),r=rSnap.data(),b=bSnap.data();
  if(d.archived_at||d.active_status!=="ACTIF")throw Object.assign(new Error("Ce chauffeur est inactif."),{status:403});
  if(d.access_status==="SUSPENDU")throw Object.assign(new Error("Accès chauffeur suspendu par la Direction."),{status:403});
  if(Number(d.session_version)!==Number(token.sessionVersion))throw Object.assign(new Error("Session chauffeur expirée. Reconnecte-toi."),{status:401});
  if(!r||Number(r.driver_id)!==did)throw Object.assign(new Error("Ce bus n’est pas affecté à ce chauffeur."),{status:403});
  if(!b?.active)throw Object.assign(new Error("Ce bus est inactif."),{status:403});
  return {driver:d,run:r,bus:b,did,bid};
}

async function handleDriverAction(req,res){
  const token=await requireRoles(req,["DRIVER"]);
  const {busId,action,payload}=req.body||{};
  const bid=Number(busId),did=Number(token.driverId);

  if(action==="LOGIN"){
    const ctx=await validateDriver(token,bid);
    if(ctx.run.status==="NON_ASSIGNE")await db.doc("runs/"+bid).set({status:"ASSIGNE",updated_at:FieldValue.serverTimestamp()},{merge:true});
    await touchSync(action);
    return res.json({ok:true,sessionVersion:Number(ctx.driver.session_version)});
  }

  if(action==="ACK_WARNING"){
    const ctx=await validateDriver(token,bid);
    const warningId=Number(payload?.warningId);
    if(!warningId)return res.status(400).json({ok:false,error:"Avertissement invalide."});
    const ref=db.doc("driverWarnings/"+warningId),snap=await ref.get();
    if(!snap.exists||Number(snap.data().driver_id)!==did||snap.data().status!=="CONFIRMEE"){
      return res.status(404).json({ok:false,error:"Avertissement confirmé introuvable."});
    }
    await ref.set({acknowledged_at:snap.data().acknowledged_at||FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true});
    await touchSync(action);return res.json({ok:true});
  }

  const {run,bus}=await validateDriver(token,bid);

  if(action==="SET_LEG"){
    const leg=String(payload?.leg||"MATIN");
    if(!["MATIN","RETOUR"].includes(leg))return res.status(400).json({ok:false,error:"Trajet invalide."});
    const checklist=run.checklist||{},ok=fields.every(k=>!!checklist[k]);
    await db.doc("runs/"+bid).set({
      current_leg:leg,current_stop_id:null,current_location_label:null,boarded:0,stage:0,
      departed_at:null,arrived_at:null,status:ok?"CONTROLE_OK":"ASSIGNE",updated_at:FieldValue.serverTimestamp()
    },{merge:true});
  }else if(action==="CHECKLIST"){
    const c=payload&&typeof payload==="object"?payload:{},clean={};
    fields.forEach(k=>clean[k]=!!c[k]);const ok=fields.every(k=>clean[k]);
    await db.doc("runs/"+bid).set({checklist:clean,status:ok?"CONTROLE_OK":"CONTROLE_EN_COURS",updated_at:FieldValue.serverTimestamp()},{merge:true});
  }else if(action==="DEPART"){
    const c=run.checklist||{};
    if(!fields.every(k=>c[k]))return res.status(400).json({ok:false,error:"Le contrôle 360° doit être validé avant le départ."});
    const data={status:"EN_ROUTE",stage:1,departed_at:FieldValue.serverTimestamp(),arrived_at:null,updated_at:FieldValue.serverTimestamp()};
    if(run.current_leg==="RETOUR"){
      data.return_departed_at=FieldValue.serverTimestamp();data.current_location_label="Départ établissements";
    }else{
      data.morning_departed_at=FieldValue.serverTimestamp();data.current_location_label="Départ circuit matin";
    }
    await db.doc("runs/"+bid).set(data,{merge:true});
  }else if(action==="ARRIVE"){
    if(Number(run.boarded||0)>0)return res.status(409).json({ok:false,error:"Impossible de terminer le trajet : "+Number(run.boarded||0)+" passager(s) sont encore enregistrés à bord."});
    const leg=run.current_leg==="RETOUR"?"RETOUR":"MATIN",today=gabonDateKey();
    const [students,boardings,rides]=await Promise.all([getAll("students"),getAll("boardings"),getAll("dailyRides")]);
    const ids=new Set(students.filter(s=>Number(s.bus_id)===bid).map(s=>Number(s.id)));
    const subCount=boardings.filter(x=>x.service_date===today&&x.leg===leg&&x.status==="DEPOSE"&&ids.has(Number(x.student_id))).length;
    const cashCount=rides.filter(x=>x.service_date===today&&x.leg===leg&&x.status==="DEPOSE"&&Number(x.bus_id)===bid).length;
    const passengers=subCount+cashCount,checklist=run.checklist||{},checklistOk=fields.every(k=>!!checklist[k]);
    const plannedEnd=leg==="RETOUR"?run.return_arrival_planned:run.morning_arrival_planned;
    const data={status:"ARRIVE",stage:4,arrived_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()};
    if(leg==="RETOUR"){data.return_arrived_at=FieldValue.serverTimestamp();data.current_location_label="Fin du retour";}
    else{data.morning_arrived_at=FieldValue.serverTimestamp();data.current_location_label="Arrivée établissements";}
    await db.doc("runs/"+bid).set(data,{merge:true});
    const activityId=today+"_"+did+"_"+leg;
    await db.doc("driverActivity/"+activityId).set({
      driver_id:did,bus_id:bid,service_date:today,leg,passengers_transported:passengers,
      capacity:Number(bus.capacity||23),planned_end:plannedEnd,actual_end:FieldValue.serverTimestamp(),
      checklist_ok:checklistOk,created_at:FieldValue.serverTimestamp()
    },{merge:true});
  }else{
    return res.status(400).json({ok:false,error:"Action inconnue."});
  }

  await touchSync(action);
  return res.json({ok:true});
}

module.exports={handleDriverAction};
