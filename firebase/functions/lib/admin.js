const {
  db, FieldValue, nextId, touchSync, makePinSecret, requireRoles
}=require("./core");

async function unassignDriver(driverId){
  const snap=await db.collection("runs").where("driver_id","==",Number(driverId)).get();
  const batch=db.batch();
  for(const doc of snap.docs){
    batch.set(doc.ref,{
      driver_id:null,status:"NON_ASSIGNE",checklist:{},boarded:0,stage:0,
      departed_at:null,arrived_at:null,current_stop_id:null,current_location_label:null,
      updated_at:FieldValue.serverTimestamp()
    },{merge:true});
  }
  if(!snap.empty)await batch.commit();
}

async function handleAdminSave(req,res){
  const b=req.body||{};
  const action=String(b.action||"");

  if(["ADD_DRIVER","SAVE_DRIVER","DELETE_DRIVER","ADD_BUS","SAVE_BUS","DELETE_BUS"].includes(action)){
    await requireRoles(req,["ADMIN","DIRECTION"]);
  }else{
    await requireRoles(req,["OPERATIONS","DIRECTION","ADMIN"]);
  }

  if(action==="ADD_DRIVER"){
    const id=await nextId("drivers");
    const pin=makePinSecret(String(1200+id));
    await db.doc("drivers/"+id).set({
      name:"",employment_status:"ACTIF",active_status:"ACTIF",access_status:"AUTORISE",
      session_version:1,archived_at:null,...pin,updated_at:FieldValue.serverTimestamp()
    });
    await touchSync(action);
    return res.json({ok:true,id});
  }

  if(action==="SAVE_DRIVER"){
    const id=Number(b.id),name=String(b.name||"").trim(),pin=String(b.pin||"").trim();
    const activeStatus=String(b.activeStatus||"ACTIF").toUpperCase();
    if(!id)return res.status(400).json({ok:false,error:"Chauffeur invalide."});
    if(!name)return res.status(400).json({ok:false,error:"Entre le nom du chauffeur scolaire."});
    if(pin&&pin.length<4)return res.status(400).json({ok:false,error:"Le code chauffeur doit contenir au moins 4 caractères."});
    if(!["ACTIF","INACTIF"].includes(activeStatus))return res.status(400).json({ok:false,error:"Statut chauffeur invalide."});
    const ref=db.doc("drivers/"+id),snap=await ref.get();
    if(!snap.exists)return res.status(404).json({ok:false,error:"Chauffeur introuvable."});
    const data={name,active_status:activeStatus,updated_at:FieldValue.serverTimestamp()};
    if(pin){Object.assign(data,makePinSecret(pin));data.session_version=FieldValue.increment(1);}
    if(activeStatus==="INACTIF"){
      data.access_status="SUSPENDU";
      data.session_version=FieldValue.increment(1);
      await unassignDriver(id);
    }
    await ref.set(data,{merge:true});
    await touchSync(action);
    return res.json({ok:true});
  }

  if(action==="DELETE_DRIVER"){
    const id=Number(b.id);
    if(!id)return res.status(400).json({ok:false,error:"Chauffeur invalide."});
    await unassignDriver(id);
    await db.doc("drivers/"+id).set({
      active_status:"INACTIF",access_status:"SUSPENDU",
      archived_at:FieldValue.serverTimestamp(),
      session_version:FieldValue.increment(1),updated_at:FieldValue.serverTimestamp()
    },{merge:true});
    await touchSync("ARCHIVE_DRIVER");
    return res.json({ok:true});
  }

  if(action==="ADD_BUS"){
    const id=await nextId("buses");
    await db.doc("buses/"+id).set({
      label:"Bus "+id,capacity:23,plate:"",active:true,scheduled_start:"À définir",
      updated_at:FieldValue.serverTimestamp()
    });
    await db.doc("runs/"+id).set({
      bus_id:id,driver_id:null,zone_id:null,status:"NON_ASSIGNE",checklist:{},boarded:0,stage:0,
      current_stop_id:null,current_leg:"MATIN",current_location_label:null,
      morning_departure_planned:"06:30",morning_arrival_planned:"08:00",
      return_departure_planned:"15:00",return_arrival_planned:"18:30",
      morning_departed_at:null,morning_arrived_at:null,return_departed_at:null,return_arrived_at:null,
      departed_at:null,arrived_at:null,updated_at:FieldValue.serverTimestamp()
    });
    await touchSync(action);
    return res.json({ok:true,id});
  }

  if(action==="SAVE_BUS"){
    const id=Number(b.id),label=String(b.label||"").trim();
    const plate=String(b.plate||"").trim().toUpperCase();
    const active=b.active!==false,capacity=Math.max(1,Number(b.capacity||23));
    if(!id)return res.status(400).json({ok:false,error:"Bus scolaire invalide."});
    if(!label)return res.status(400).json({ok:false,error:"Nom du bus requis."});
    await db.doc("buses/"+id).set({label,plate,active,capacity,updated_at:FieldValue.serverTimestamp()},{merge:true});
    if(!active){
      await db.doc("runs/"+id).set({
        driver_id:null,zone_id:null,status:"NON_ASSIGNE",boarded:0,current_stop_id:null,current_location_label:null,
        updated_at:FieldValue.serverTimestamp()
      },{merge:true});
    }
    await touchSync(action);
    return res.json({ok:true});
  }

  if(action==="DELETE_BUS"){
    const id=Number(b.id);
    if(!id)return res.status(400).json({ok:false,error:"Bus scolaire invalide."});
    const students=await db.collection("students").where("bus_id","==",id).get();
    const batch=db.batch();
    students.docs.forEach(doc=>batch.set(doc.ref,{bus_id:null,updated_at:FieldValue.serverTimestamp()},{merge:true}));
    batch.set(db.doc("buses/"+id),{active:false,updated_at:FieldValue.serverTimestamp()},{merge:true});
    batch.set(db.doc("runs/"+id),{
      driver_id:null,zone_id:null,status:"NON_ASSIGNE",boarded:0,current_stop_id:null,current_location_label:null,
      updated_at:FieldValue.serverTimestamp()
    },{merge:true});
    await batch.commit();
    await touchSync(action);
    return res.json({ok:true});
  }

  if(action==="SAVE_ASSIGNMENT"){
    const busId=Number(b.busId),driverId=Number(b.driverId)||null,zoneId=Number(b.zoneId)||null;
    if(!busId)return res.status(400).json({ok:false,error:"Bus invalide."});
    if(!driverId)return res.status(400).json({ok:false,error:"Choisis un chauffeur scolaire."});
    if(!zoneId)return res.status(400).json({ok:false,error:"Choisis une zone."});
    const [ds,bs,zs]=await Promise.all([
      db.doc("drivers/"+driverId).get(),db.doc("buses/"+busId).get(),db.doc("zones/"+zoneId).get()
    ]);
    const d=ds.data(),bus=bs.data();
    if(!d||!String(d.name||"").trim())return res.status(400).json({ok:false,error:"Le chauffeur n’est pas renseigné."});
    if(d.active_status!=="ACTIF"||d.access_status==="SUSPENDU")return res.status(400).json({ok:false,error:"Ce chauffeur est inactif ou suspendu."});
    if(!bus?.active)return res.status(400).json({ok:false,error:"Ce bus est inactif."});
    if(!zs.exists||zs.data().active===false)return res.status(400).json({ok:false,error:"Zone invalide."});
    const conflict=await db.collection("runs").where("driver_id","==",driverId).get();
    if(conflict.docs.some(x=>Number(x.id)!==busId))return res.status(400).json({ok:false,error:"Ce chauffeur est déjà affecté à un autre bus."});
    const morningDeparture=String(b.morningDeparturePlanned||b.scheduledStart||"").trim()||"À définir";
    const morningArrival=String(b.morningArrivalPlanned||b.scheduledArrival||"").trim()||"À définir";
    const returnDeparture=String(b.returnDeparturePlanned||"").trim()||"À définir";
    const returnArrival=String(b.returnArrivalPlanned||"").trim()||"À définir";
    await Promise.all([
      db.doc("buses/"+busId).set({scheduled_start:morningDeparture,updated_at:FieldValue.serverTimestamp()},{merge:true}),
      db.doc("runs/"+busId).set({
        bus_id:busId,driver_id:driverId,zone_id:zoneId,
        morning_departure_planned:morningDeparture,morning_arrival_planned:morningArrival,
        return_departure_planned:returnDeparture,return_arrival_planned:returnArrival,
        status:"ASSIGNE",checklist:{},boarded:0,stage:0,departed_at:null,arrived_at:null,
        current_stop_id:null,current_location_label:null,current_leg:"MATIN",
        updated_at:FieldValue.serverTimestamp()
      },{merge:true})
    ]);
    await touchSync(action);
    return res.json({ok:true});
  }

  if(action==="DELETE_ASSIGNMENT"){
    const busId=Number(b.busId);
    if(!busId)return res.status(400).json({ok:false,error:"Bus invalide."});
    await Promise.all([
      db.doc("buses/"+busId).set({scheduled_start:"À définir",updated_at:FieldValue.serverTimestamp()},{merge:true}),
      db.doc("runs/"+busId).set({
        driver_id:null,zone_id:null,status:"NON_ASSIGNE",checklist:{},boarded:0,stage:0,
        departed_at:null,arrived_at:null,current_stop_id:null,current_location_label:null,current_leg:"MATIN",
        morning_departure_planned:"À définir",morning_arrival_planned:"À définir",
        return_departure_planned:"À définir",return_arrival_planned:"À définir",
        updated_at:FieldValue.serverTimestamp()
      },{merge:true})
    ]);
    await touchSync(action);
    return res.json({ok:true});
  }

  return res.status(400).json({ok:false,error:"Action inconnue."});
}

module.exports={handleAdminSave};
