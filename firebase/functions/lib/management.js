const {
  db, FieldValue, gabonDateKey, nextId, touchSync, makePinSecret, requireRoles
}=require("./core");

async function handleManagementAction(req,res){
  const b=req.body||{},action=String(b.action||"");

  if(["ADD_WARNING","UPDATE_WARNING"].includes(action)){
    await requireRoles(req,["OPERATIONS","DIRECTION"]);
  }else{
    await requireRoles(req,["DIRECTION"]);
  }

  if(action==="ADD_WARNING"){
    const driverId=Number(b.driverId),date=String(b.date||"").trim()||gabonDateKey();
    const reason=String(b.reason||"").trim(),details=String(b.details||"").trim();
    const recordedBy=String(b.recordedBy||"").trim()||"G10";
    const status=String(b.status||"A_VERIFIER");
    if(!driverId||!reason)return res.status(400).json({ok:false,error:"Chauffeur et motif requis."});
    if(!["A_VERIFIER","CONFIRMEE","CLASSEE"].includes(status))return res.status(400).json({ok:false,error:"Statut invalide."});
    const id=await nextId("driverWarnings");
    await db.doc("driverWarnings/"+id).set({
      driver_id:driverId,complaint_date:date,reason,details,recorded_by:recordedBy,status,
      acknowledged_at:null,created_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()
    });
    await touchSync(action);return res.json({ok:true,id});
  }

  if(action==="UPDATE_WARNING"){
    const id=Number(b.id),status=String(b.status||"");
    if(!id||!["A_VERIFIER","CONFIRMEE","CLASSEE"].includes(status))return res.status(400).json({ok:false,error:"Avertissement ou statut invalide."});
    await db.doc("driverWarnings/"+id).set({status,updated_at:FieldValue.serverTimestamp()},{merge:true});
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="SET_DRIVER_ACCESS"){
    const driverId=Number(b.driverId),accessStatus=String(b.accessStatus||"");
    if(!driverId||!["AUTORISE","SUSPENDU"].includes(accessStatus))return res.status(400).json({ok:false,error:"Paramètres invalides."});
    await db.doc("drivers/"+driverId).set({
      access_status:accessStatus,session_version:FieldValue.increment(1),updated_at:FieldValue.serverTimestamp()
    },{merge:true});
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="CHANGE_DRIVER_PIN"){
    const driverId=Number(b.driverId),pin=String(b.pin||"").trim();
    if(!driverId||pin.length<4)return res.status(400).json({ok:false,error:"PIN de 4 caractères minimum requis."});
    await db.doc("drivers/"+driverId).set({
      ...makePinSecret(pin),session_version:FieldValue.increment(1),updated_at:FieldValue.serverTimestamp()
    },{merge:true});
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="FORCE_DRIVER_LOGOUT"){
    const driverId=Number(b.driverId);
    if(!driverId)return res.status(400).json({ok:false,error:"Chauffeur invalide."});
    await db.doc("drivers/"+driverId).set({session_version:FieldValue.increment(1),updated_at:FieldValue.serverTimestamp()},{merge:true});
    await touchSync(action);return res.json({ok:true});
  }

  if(action==="VALIDATE_DRIVER_MONTH"){
    const driverId=Number(b.driverId),monthKey=String(b.monthKey||"").trim();
    if(!driverId||!/^\d{4}-\d{2}$/.test(monthKey))return res.status(400).json({ok:false,error:"Chauffeur ou mois invalide."});
    await db.doc("driverMonthAwards/"+monthKey).set({
      month_key:monthKey,driver_id:driverId,validated_by:"Direction",validated_at:FieldValue.serverTimestamp()
    });
    await touchSync(action);return res.json({ok:true});
  }

  return res.status(400).json({ok:false,error:"Action inconnue."});
}

module.exports={handleManagementAction};
