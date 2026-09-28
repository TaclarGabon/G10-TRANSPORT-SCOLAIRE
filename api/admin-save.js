import { db, events } from "hatchable";

export const access = "public";
export const methods = ["POST"];

async function publish(action,payload={}){
  await events.publish("g10-school-live","state-changed",{source:"admin",action,...payload});
}

export default async function(req,res){
  const body=req.body||{};
  const action=String(body.action||"");

  if(action==="ADD_DRIVER"){
    const q=await db.query("SELECT COALESCE(MAX(id),0)+1 AS next_id FROM school_drivers");
    const id=Number(q.rows[0]?.next_id||1);
    const pin=String(1200+id);
    await db.query("INSERT INTO school_drivers (id,name,pin,employment_status,active_status,access_status,session_version,updated_at) VALUES ($1,'',$2,'ACTIF','ACTIF','AUTORISE',1,now())",[id,pin]);
    await publish("ADD_DRIVER",{id});
    return res.json({ok:true,id});
  }

  if(action==="SAVE_DRIVER"){
    const id=Number(body.id);
    const name=String(body.name||"").trim();
    const pin=String(body.pin||"").trim();
    const activeStatus=String(body.activeStatus||"ACTIF").toUpperCase();
    if(!id) return res.status(400).json({ok:false,error:"Chauffeur invalide."});
    if(!name) return res.status(400).json({ok:false,error:"Entre le nom du chauffeur scolaire."});
    if(pin&&pin.length<4) return res.status(400).json({ok:false,error:"Le code chauffeur doit contenir au moins 4 caractères."});
    if(!["ACTIF","INACTIF"].includes(activeStatus)) return res.status(400).json({ok:false,error:"Statut chauffeur invalide."});
    if(activeStatus==="INACTIF"){
      await db.query("UPDATE school_runs SET driver_id=NULL,status='NON_ASSIGNE',checklist=$1::jsonb,boarded=0,stage=0,departed_at=NULL,arrived_at=NULL,current_stop_id=NULL,current_location_label=NULL,updated_at=now() WHERE driver_id=$2",["{}",id]);
      await db.query("UPDATE school_drivers SET access_status='SUSPENDU',session_version=session_version+1 WHERE id=$1",[id]);
    }
    await db.query("UPDATE school_drivers SET name=$1,pin=CASE WHEN $2='' THEN pin ELSE $2 END,session_version=CASE WHEN $2='' THEN session_version ELSE session_version+1 END,active_status=$3,updated_at=now() WHERE id=$4",[name,pin,activeStatus,id]);
    await publish("SAVE_DRIVER",{id});
    return res.json({ok:true});
  }

  if(action==="DELETE_DRIVER"){
    const id=Number(body.id);
    if(!id) return res.status(400).json({ok:false,error:"Chauffeur invalide."});
    await db.query("UPDATE school_runs SET driver_id=NULL,status='NON_ASSIGNE',checklist=$1::jsonb,boarded=0,stage=0,departed_at=NULL,arrived_at=NULL,current_stop_id=NULL,current_location_label=NULL,updated_at=now() WHERE driver_id=$2",["{}",id]);
    await db.query("UPDATE school_drivers SET active_status='INACTIF',access_status='SUSPENDU',archived_at=COALESCE(archived_at,now()),session_version=session_version+1,updated_at=now() WHERE id=$1",[id]);
    await publish("ARCHIVE_DRIVER",{id});
    return res.json({ok:true});
  }

  if(action==="ADD_BUS"){
    const q=await db.query("SELECT COALESCE(MAX(id),0)+1 AS next_id FROM school_buses");
    const id=Number(q.rows[0]?.next_id||1);
    await db.query(`
      INSERT INTO school_buses
      (id,label,capacity,route_name,start_name,stop_name,end_name,scheduled_start,plate,active)
      VALUES ($1,$2,23,'','','','','À définir','',true)
    `,[id,"Bus "+id]);
    await db.query(`
      INSERT INTO school_runs
      (bus_id,status,checklist,boarded,stage,current_leg,morning_departure_planned,morning_arrival_planned,return_departure_planned,return_arrival_planned)
      VALUES ($1,'NON_ASSIGNE',$2::jsonb,0,0,'MATIN','06:30','08:00','15:00','18:30')
    `,[id,"{}"]);
    await publish("ADD_BUS",{id});
    return res.json({ok:true,id});
  }

  if(action==="SAVE_BUS"){
    const id=Number(body.id);
    const label=String(body.label||"").trim();
    const plate=String(body.plate||"").trim().toUpperCase();
    const active=body.active!==false;
    const capacity=Math.max(1,Number(body.capacity||23));
    if(!id) return res.status(400).json({ok:false,error:"Bus scolaire invalide."});
    if(!label) return res.status(400).json({ok:false,error:"Nom du bus requis."});
    await db.query("UPDATE school_buses SET label=$1,plate=$2,active=$3,capacity=$4 WHERE id=$5",[label,plate,active,capacity,id]);
    if(!active){
      await db.query("UPDATE school_runs SET driver_id=NULL,zone_id=NULL,status='NON_ASSIGNE',boarded=0,current_stop_id=NULL,current_location_label=NULL,updated_at=now() WHERE bus_id=$1",[id]);
    }
    await publish("SAVE_BUS",{id});
    return res.json({ok:true});
  }

  if(action==="DELETE_BUS"){
    const id=Number(body.id);
    if(!id) return res.status(400).json({ok:false,error:"Bus scolaire invalide."});
    await db.query("UPDATE school_students SET bus_id=NULL,updated_at=now() WHERE bus_id=$1",[id]);
    await db.query("UPDATE school_buses SET active=false WHERE id=$1",[id]);
    await db.query("UPDATE school_runs SET driver_id=NULL,zone_id=NULL,status='NON_ASSIGNE',boarded=0,current_stop_id=NULL,current_location_label=NULL,updated_at=now() WHERE bus_id=$1",[id]);
    await publish("DELETE_BUS",{id});
    return res.json({ok:true});
  }

  if(action==="SAVE_ASSIGNMENT"){
    const busId=Number(body.busId);
    const driverId=Number(body.driverId)||null;
    const zoneId=Number(body.zoneId)||null;
    if(!busId) return res.status(400).json({ok:false,error:"Bus invalide."});
    if(!driverId) return res.status(400).json({ok:false,error:"Choisis un chauffeur scolaire."});
    if(!zoneId) return res.status(400).json({ok:false,error:"Choisis une zone."});

    const morningDeparture=String(body.morningDeparturePlanned||body.scheduledStart||"").trim()||"À définir";
    const morningArrival=String(body.morningArrivalPlanned||body.scheduledArrival||"").trim()||"À définir";
    const returnDeparture=String(body.returnDeparturePlanned||"").trim()||"À définir";
    const returnArrival=String(body.returnArrivalPlanned||"").trim()||"À définir";

    const d=await db.query("SELECT id,name,active_status FROM school_drivers WHERE id=$1",[driverId]);
    if(!d.rows[0]||!String(d.rows[0].name||"").trim()) return res.status(400).json({ok:false,error:"Le chauffeur n’est pas renseigné."});
    if(d.rows[0].active_status!=="ACTIF") return res.status(400).json({ok:false,error:"Ce chauffeur est inactif."});

    const bus=await db.query("SELECT id,active FROM school_buses WHERE id=$1",[busId]);
    if(!bus.rows[0]?.active) return res.status(400).json({ok:false,error:"Ce bus est inactif."});

    const conflict=await db.query("SELECT bus_id FROM school_runs WHERE driver_id=$1 AND bus_id<>$2",[driverId,busId]);
    if(conflict.rows[0]) return res.status(400).json({ok:false,error:"Ce chauffeur est déjà affecté à un autre bus."});

    await db.query("UPDATE school_buses SET scheduled_start=$1 WHERE id=$2",[morningDeparture,busId]);
    await db.query(`
      UPDATE school_runs
      SET driver_id=$1,zone_id=$2,
          morning_departure_planned=$3,morning_arrival_planned=$4,
          return_departure_planned=$5,return_arrival_planned=$6,
          status='ASSIGNE',checklist=$7::jsonb,boarded=0,stage=0,
          departed_at=NULL,arrived_at=NULL,current_stop_id=NULL,current_location_label=NULL,current_leg='MATIN',updated_at=now()
      WHERE bus_id=$8
    `,[driverId,zoneId,morningDeparture,morningArrival,returnDeparture,returnArrival,"{}",busId]);
    await publish("SAVE_ASSIGNMENT",{busId,driverId,zoneId});
    return res.json({ok:true});
  }

  if(action==="DELETE_ASSIGNMENT"){
    const busId=Number(body.busId);
    if(!busId) return res.status(400).json({ok:false,error:"Bus invalide."});
    await db.query("UPDATE school_buses SET scheduled_start='À définir' WHERE id=$1",[busId]);
    await db.query(`
      UPDATE school_runs
      SET driver_id=NULL,zone_id=NULL,status='NON_ASSIGNE',checklist=$1::jsonb,boarded=0,stage=0,
          departed_at=NULL,arrived_at=NULL,current_stop_id=NULL,current_location_label=NULL,current_leg='MATIN',
          morning_departure_planned='À définir',morning_arrival_planned='À définir',
          return_departure_planned='À définir',return_arrival_planned='À définir',updated_at=now()
      WHERE bus_id=$2
    `,["{}",busId]);
    await publish("DELETE_ASSIGNMENT",{busId});
    return res.json({ok:true});
  }

  return res.status(400).json({ok:false,error:"Action inconnue."});
}