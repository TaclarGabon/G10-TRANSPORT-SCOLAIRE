const {
  db, gabonDateKey, plain, requireRoles
}=require("./core");

async function handleParentLogin(req,res){
  const token=await requireRoles(req,["PARENT"]);
  const key=String(token.guardianKey||"");
  if(!key)return res.status(403).json({ok:false,error:"Compte parent invalide."});

  const gSnap=await db.doc("guardians/"+key).get();
  if(!gSnap.exists)return res.status(404).json({ok:false,error:"Compte parent introuvable."});
  const guardian=gSnap.data(),studentIds=Array.isArray(guardian.student_ids)?guardian.student_ids.map(Number):[];
  const today=gabonDateKey(),children=[];

  for(const id of studentIds){
    const sSnap=await db.doc("students/"+id).get();
    if(!sSnap.exists)continue;
    const s={id,...plain(sSnap.data())};
    const busId=Number(s.bus_id||0);
    const [bSnap,rSnap,bdSnap]=await Promise.all([
      busId?db.doc("buses/"+busId).get():Promise.resolve(null),
      busId?db.doc("runs/"+busId).get():Promise.resolve(null),
      db.collection("boardings").where("student_id","==",id).get()
    ]);
    const bus=bSnap?.exists?plain(bSnap.data()):{};
    const run=rSnap?.exists?plain(rSnap.data()):{};
    const boardings=bdSnap.docs
      .map(d=>plain(d.data()))
      .filter(x=>x.service_date===today)
      .sort((a,b)=>String(a.leg||"").localeCompare(String(b.leg||"")));

    children.push({
      ...s,
      bus_label:bus.label||null,
      plate:bus.plate||null,
      bus_status:run.status||"NON_ASSIGNE",
      current_leg:run.current_leg||"MATIN",
      current_location_label:run.current_location_label||null,
      morning_departure_planned:run.morning_departure_planned||null,
      morning_arrival_planned:run.morning_arrival_planned||null,
      return_departure_planned:run.return_departure_planned||null,
      return_arrival_planned:run.return_arrival_planned||null,
      morning_departed_at:run.morning_departed_at||null,
      morning_arrived_at:run.morning_arrived_at||null,
      return_departed_at:run.return_departed_at||null,
      return_arrived_at:run.return_arrived_at||null,
      boardings
    });
  }

  children.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  return res.json({ok:true,guardianName:guardian.guardian_name,children});
}

module.exports={handleParentLogin};
