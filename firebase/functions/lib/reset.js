const {
  db, FieldValue, gabonDateKey, touchSync, requireRoles
}=require("./core");
const { fullResetSeed }=require("./seed");

async function deleteWhereDate(collection,date){
  const snap=await db.collection(collection).where("service_date","==",date).get();
  if(snap.empty)return;
  let batch=db.batch(),count=0;
  for(const doc of snap.docs){
    batch.delete(doc.ref);count++;
    if(count===400){await batch.commit();batch=db.batch();count=0;}
  }
  if(count)await batch.commit();
}

async function resetDay(){
  const today=gabonDateKey();
  await Promise.all([
    deleteWhereDate("boardings",today),
    deleteWhereDate("dailyRides",today),
    deleteWhereDate("cashClosures",today),
    deleteWhereDate("driverActivity",today)
  ]);

  const students=await db.collection("students").get();
  let batch=db.batch(),count=0;
  for(const doc of students.docs){
    batch.set(doc.ref,{absence_today:false,updated_at:FieldValue.serverTimestamp()},{merge:true});count++;
    if(count===400){await batch.commit();batch=db.batch();count=0;}
  }
  if(count)await batch.commit();

  const runs=await db.collection("runs").get();
  batch=db.batch();count=0;
  for(const doc of runs.docs){
    const r=doc.data();
    batch.set(doc.ref,{
      status:(r.driver_id&&r.zone_id)?"ASSIGNE":"NON_ASSIGNE",
      checklist:{},boarded:0,stage:0,current_leg:"MATIN",
      current_stop_id:null,current_location_label:null,departed_at:null,arrived_at:null,
      morning_departed_at:null,morning_arrived_at:null,return_departed_at:null,return_arrived_at:null,
      updated_at:FieldValue.serverTimestamp()
    },{merge:true});
    count++;
    if(count===400){await batch.commit();batch=db.batch();count=0;}
  }
  if(count)await batch.commit();
}

async function handleReset(req,res){
  await requireRoles(req,["ADMIN","DIRECTION"]);
  const mode=String(req.body?.mode||"DAY").toUpperCase();
  if(mode==="DAY")await resetDay();
  else if(mode==="FULL")await fullResetSeed();
  else return res.status(400).json({ok:false,error:"Mode de réinitialisation invalide."});
  await touchSync("RESET_"+mode);
  return res.json({ok:true,mode});
}

module.exports={handleReset,resetDay};
