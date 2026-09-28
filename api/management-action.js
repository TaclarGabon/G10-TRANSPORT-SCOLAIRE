import { db, events } from "hatchable";

export const access="public";
export const methods=["POST"];

async function auth(token,roles){
  const q=await db.query("SELECT role FROM school_management_sessions WHERE token=$1 AND expires_at>now()",[String(token||"")]);
  const role=q.rows[0]?.role;
  if(!role||!roles.includes(role)) return null;
  return role;
}
async function publish(action,payload={}){
  await events.publish("g10-school-live","state-changed",{source:"management",action,...payload});
}

export default async function(req,res){
  const b=req.body||{};
  const action=String(b.action||"");
  const token=b.managementToken;

  if(action==="ADD_WARNING"){
    const role=await auth(token,["OPERATIONS","DIRECTION"]);
    if(!role) return res.status(403).json({ok:false,error:"Accès Chef d’exploitation ou Direction requis."});
    const driverId=Number(b.driverId);
    const date=String(b.date||"").trim()||new Date().toISOString().slice(0,10);
    const reason=String(b.reason||"").trim();
    const details=String(b.details||"").trim();
    const recordedBy=String(b.recordedBy||"").trim()||(role==="DIRECTION"?"Direction":"Chef d’exploitation");
    const status=String(b.status||"A_VERIFIER");
    if(!driverId||!reason) return res.status(400).json({ok:false,error:"Chauffeur et motif requis."});
    if(!["A_VERIFIER","CONFIRMEE","CLASSEE"].includes(status)) return res.status(400).json({ok:false,error:"Statut invalide."});
    const q=await db.query(`
      INSERT INTO school_driver_warnings(driver_id,complaint_date,reason,details,recorded_by,status,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING id
    `,[driverId,date,reason,details,recordedBy,status]);
    await publish("ADD_WARNING",{driverId,id:q.rows[0].id});
    return res.json({ok:true,id:q.rows[0].id});
  }

  if(action==="UPDATE_WARNING"){
    const role=await auth(token,["OPERATIONS","DIRECTION"]);
    if(!role) return res.status(403).json({ok:false,error:"Accès Chef d’exploitation ou Direction requis."});
    const id=Number(b.id),status=String(b.status||"");
    if(!id||!["A_VERIFIER","CONFIRMEE","CLASSEE"].includes(status)) return res.status(400).json({ok:false,error:"Avertissement ou statut invalide."});
    await db.query("UPDATE school_driver_warnings SET status=$1,updated_at=now() WHERE id=$2",[status,id]);
    await publish("UPDATE_WARNING",{id,status});
    return res.json({ok:true});
  }

  if(action==="SET_DRIVER_ACCESS"){
    const role=await auth(token,["DIRECTION"]);
    if(!role) return res.status(403).json({ok:false,error:"Accès Direction requis."});
    const driverId=Number(b.driverId),accessStatus=String(b.accessStatus||"");
    if(!driverId||!["AUTORISE","SUSPENDU"].includes(accessStatus)) return res.status(400).json({ok:false,error:"Paramètres invalides."});
    await db.query("UPDATE school_drivers SET access_status=$1,session_version=session_version+1,updated_at=now() WHERE id=$2",[accessStatus,driverId]);
    await publish("SET_DRIVER_ACCESS",{driverId,accessStatus});
    return res.json({ok:true});
  }

  if(action==="CHANGE_DRIVER_PIN"){
    const role=await auth(token,["DIRECTION"]);
    if(!role) return res.status(403).json({ok:false,error:"Accès Direction requis."});
    const driverId=Number(b.driverId),pin=String(b.pin||"").trim();
    if(!driverId||pin.length<4) return res.status(400).json({ok:false,error:"PIN de 4 caractères minimum requis."});
    await db.query("UPDATE school_drivers SET pin=$1,session_version=session_version+1,updated_at=now() WHERE id=$2",[pin,driverId]);
    await publish("CHANGE_DRIVER_PIN",{driverId});
    return res.json({ok:true});
  }

  if(action==="FORCE_DRIVER_LOGOUT"){
    const role=await auth(token,["DIRECTION"]);
    if(!role) return res.status(403).json({ok:false,error:"Accès Direction requis."});
    const driverId=Number(b.driverId);
    if(!driverId) return res.status(400).json({ok:false,error:"Chauffeur invalide."});
    await db.query("UPDATE school_drivers SET session_version=session_version+1,updated_at=now() WHERE id=$1",[driverId]);
    await publish("FORCE_DRIVER_LOGOUT",{driverId});
    return res.json({ok:true});
  }

  if(action==="VALIDATE_DRIVER_MONTH"){
    const role=await auth(token,["DIRECTION"]);
    if(!role) return res.status(403).json({ok:false,error:"Accès Direction requis."});
    const driverId=Number(b.driverId),monthKey=String(b.monthKey||"").trim();
    if(!driverId||!/^\d{4}-\d{2}$/.test(monthKey)) return res.status(400).json({ok:false,error:"Chauffeur ou mois invalide."});
    await db.query(`
      INSERT INTO school_driver_month_awards(month_key,driver_id,validated_by,validated_at)
      VALUES ($1,$2,'Direction',now())
      ON CONFLICT(month_key) DO UPDATE SET driver_id=EXCLUDED.driver_id,validated_by='Direction',validated_at=now()
    `,[monthKey,driverId]);
    await publish("VALIDATE_DRIVER_MONTH",{driverId,monthKey});
    return res.json({ok:true});
  }

  return res.status(400).json({ok:false,error:"Action inconnue."});
}