import { db, events } from "hatchable";

export const access = "public";
export const methods = ["POST"];

async function resetDay(){
  await db.query("DELETE FROM school_boardings WHERE service_date=CURRENT_DATE");
  await db.query("DELETE FROM school_daily_rides WHERE service_date=CURRENT_DATE");
  await db.query("DELETE FROM school_cash_closures WHERE service_date=CURRENT_DATE");
  await db.query("DELETE FROM school_driver_activity WHERE service_date=CURRENT_DATE");
  await db.query("UPDATE school_students SET absence_today=false,updated_at=now()");
  await db.query(`
    UPDATE school_runs
    SET status=CASE WHEN driver_id IS NULL OR zone_id IS NULL THEN 'NON_ASSIGNE' ELSE 'ASSIGNE' END,
        checklist=$1::jsonb,boarded=0,stage=0,current_leg='MATIN',
        current_stop_id=NULL,current_location_label=NULL,
        departed_at=NULL,arrived_at=NULL,
        morning_departed_at=NULL,morning_arrived_at=NULL,
        return_departed_at=NULL,return_arrived_at=NULL,
        updated_at=now()
  `,["{}"]);
}

async function resetFull(){
  await db.query("DELETE FROM school_boardings");
  await db.query("DELETE FROM school_daily_rides");
  await db.query("DELETE FROM school_cash_closures");
  await db.query("DELETE FROM school_students");
  await db.query("DELETE FROM school_fares");
  await db.query("DELETE FROM school_driver_warnings");
  await db.query("DELETE FROM school_driver_activity");
  await db.query("DELETE FROM school_driver_month_awards");
  await db.query("DELETE FROM school_management_sessions");

  await db.query(`
    UPDATE school_runs
    SET driver_id=NULL,zone_id=NULL,status='NON_ASSIGNE',
        checklist=$1::jsonb,boarded=0,stage=0,current_leg='MATIN',
        current_stop_id=NULL,current_location_label=NULL,
        departed_at=NULL,arrived_at=NULL,
        morning_departed_at=NULL,morning_arrived_at=NULL,
        return_departed_at=NULL,return_arrived_at=NULL,
        morning_departure_planned='À définir',morning_arrival_planned='À définir',
        return_departure_planned='À définir',return_arrival_planned='À définir',
        updated_at=now()
  `,["{}"]);

  await db.query("DELETE FROM school_drivers");
  await db.query("INSERT INTO school_drivers (id,name,pin,employment_status,active_status,access_status,session_version,updated_at) VALUES (1,'',CAST(1200+1 AS TEXT),'ACTIF','ACTIF','AUTORISE',1,now())");
  await db.query("INSERT INTO school_drivers (id,name,pin,employment_status,active_status,access_status,session_version,updated_at) VALUES (2,'',CAST(1200+2 AS TEXT),'ACTIF','ACTIF','AUTORISE',1,now())");

  await db.query("DELETE FROM school_runs WHERE bus_id>2");
  await db.query("DELETE FROM school_buses WHERE id>2");
  await db.query("UPDATE school_buses SET label='Bus 1',capacity=23,plate='',active=true,route_name='',start_name='',stop_name='',end_name='',scheduled_start='À définir' WHERE id=1");
  await db.query("UPDATE school_buses SET label='Bus 2',capacity=23,plate='',active=true,route_name='',start_name='',stop_name='',end_name='',scheduled_start='À définir' WHERE id=2");

  await db.query("INSERT INTO school_buses (id,label,capacity,route_name,start_name,stop_name,end_name,scheduled_start,plate,active) SELECT 1,'Bus 1',23,'','','','','À définir','',true WHERE NOT EXISTS (SELECT 1 FROM school_buses WHERE id=1)");
  await db.query("INSERT INTO school_buses (id,label,capacity,route_name,start_name,stop_name,end_name,scheduled_start,plate,active) SELECT 2,'Bus 2',23,'','','','','À définir','',true WHERE NOT EXISTS (SELECT 1 FROM school_buses WHERE id=2)");
  await db.query("INSERT INTO school_runs (bus_id,status,checklist,boarded,stage,current_leg,morning_departure_planned,morning_arrival_planned,return_departure_planned,return_arrival_planned) SELECT 1,'NON_ASSIGNE',$1::jsonb,0,0,'MATIN','À définir','À définir','À définir','À définir' WHERE NOT EXISTS (SELECT 1 FROM school_runs WHERE bus_id=1)",["{}"]);
  await db.query("INSERT INTO school_runs (bus_id,status,checklist,boarded,stage,current_leg,morning_departure_planned,morning_arrival_planned,return_departure_planned,return_arrival_planned) SELECT 2,'NON_ASSIGNE',$1::jsonb,0,0,'MATIN','À définir','À définir','À définir','À définir' WHERE NOT EXISTS (SELECT 1 FROM school_runs WHERE bus_id=2)",["{}"]);

  await db.query("UPDATE school_runs SET driver_id=NULL,zone_id=NULL,status='NON_ASSIGNE',checklist=$1::jsonb,boarded=0,stage=0,current_leg='MATIN',current_stop_id=NULL,current_location_label=NULL,departed_at=NULL,arrived_at=NULL,morning_departed_at=NULL,morning_arrived_at=NULL,return_departed_at=NULL,return_arrived_at=NULL,morning_departure_planned='À définir',morning_arrival_planned='À définir',return_departure_planned='À définir',return_arrival_planned='À définir',updated_at=now() WHERE bus_id IN (1,2)",["{}"]);

  await db.query("DELETE FROM school_stops");
  await db.query("DELETE FROM school_destinations");
  await db.query("DELETE FROM school_zones");

  await db.query("INSERT INTO school_zones(name,active,updated_at) VALUES ('Akanda',true,now())");
  await db.query("INSERT INTO school_zones(name,active,updated_at) VALUES ('Owendo',true,now())");

  const ak=await db.query("SELECT id FROM school_zones WHERE name='Akanda' LIMIT 1");
  const ow=await db.query("SELECT id FROM school_zones WHERE name='Owendo' LIMIT 1");
  const akId=ak.rows[0].id,owId=ow.rows[0].id;

  for(const [name,ord] of [["Amissa",1],["Carrefour Jiji",2],["Okala",3],["Cité des Ailes",4]]){
    await db.query("INSERT INTO school_stops(zone_id,name,sort_order,active,updated_at) VALUES ($1,$2,$3,true,now())",[akId,name,ord]);
  }
  for(const [name,ord] of [["Pont Nomba",1],["SNI",2],["Lycée Technique",3],["Alénakiri",4]]){
    await db.query("INSERT INTO school_stops(zone_id,name,sort_order,active,updated_at) VALUES ($1,$2,$3,true,now())",[owId,name,ord]);
  }

  const zoneIds={Akanda:akId,Owendo:owId};
  const zoneOrder={Akanda:0,Owendo:0};
  for(const [name,zone] of [
    ["Lycée d'État","Akanda"],["Lycée Léon Mba","Akanda"],["Quaben","Akanda"],["Sainte-Marie","Akanda"],
    ["Immaculée","Akanda"],["Bessieux","Akanda"],["Lycée Technique National Omar Bongo","Owendo"],
    ["Lycée Public d'Owendo","Owendo"],["CES d'Alénakiri","Owendo"],["Lycée Privé Catholique Don Bosco","Owendo"]
  ]){
    const d=await db.query("INSERT INTO school_destinations(name,demo_zone,active,updated_at) VALUES ($1,$2,true,now()) RETURNING id",[name,zone]);
    zoneOrder[zone]++;
    await db.query("INSERT INTO school_destination_zones(destination_id,zone_id,sort_order,active,updated_at) VALUES ($1,$2,$3,true,now())",[d.rows[0].id,zoneIds[zone],zoneOrder[zone]]);
  }
}

export default async function(req,res){
  const mode=String(req.body?.mode||"DAY").toUpperCase();
  if(mode==="DAY") await resetDay();
  else if(mode==="FULL") await resetFull();
  else return res.status(400).json({ok:false,error:"Mode de réinitialisation invalide."});

  await events.publish("g10-school-live","state-changed",{source:"reset",mode});
  res.json({ok:true,mode});
}