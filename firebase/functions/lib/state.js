const {
  db, gabonDateKey, getCollection, optionalAuth, plain
} = require("./core");
const { ensureBase, syncFareMatrix } = require("./seed");

function sortNum(a,b){ return Number(a.id)-Number(b.id); }
function sortBy(a,b,...keys){
  for(const k of keys){
    const av=a[k],bv=b[k];
    if(av==null&&bv!=null)return 1;
    if(av!=null&&bv==null)return -1;
    if(av<bv)return -1;
    if(av>bv)return 1;
  }
  return 0;
}

async function buildState() {
  await ensureBase();
  await syncFareMatrix();

  const today=gabonDateKey();
  const [
    drivers,buses,zones,stops,destinations,destinationZones,runs,students,fares,
    boardingsAll,dailyRidesAll,cashAll,driverWarnings,driverActivity,driverMonthAwards
  ]=await Promise.all([
    getCollection("drivers"),getCollection("buses"),getCollection("zones"),
    getCollection("stops"),getCollection("destinations"),getCollection("destinationZones"),
    getCollection("runs"),getCollection("students"),getCollection("fares"),
    getCollection("boardings"),getCollection("dailyRides"),getCollection("cashClosures"),
    getCollection("driverWarnings"),getCollection("driverActivity"),getCollection("driverMonthAwards")
  ]);

  const driverMap=new Map(drivers.map(x=>[Number(x.id),x]));
  const zoneMap=new Map(zones.map(x=>[Number(x.id),x]));
  const stopMap=new Map(stops.map(x=>[Number(x.id),x]));
  const destMap=new Map(destinations.map(x=>[Number(x.id),x]));

  const cleanDrivers=drivers.map(d=>{
    const {pin_hash,pin_salt,...rest}=d;
    return rest;
  }).sort(sortNum);

  const joinedRuns=runs.map(r=>({
    ...r,
    bus_id:Number(r.bus_id??r.id),
    driver_name:driverMap.get(Number(r.driver_id))?.name||null,
    zone_name:zoneMap.get(Number(r.zone_id))?.name||null
  })).sort((a,b)=>Number(a.bus_id)-Number(b.bus_id));

  const boardings=boardingsAll.filter(x=>x.service_date===today).sort((a,b)=>Number(a.student_id)-Number(b.student_id)||String(a.leg).localeCompare(String(b.leg)));
  const dailyRides=dailyRidesAll.filter(x=>x.service_date===today).map(r=>({
    ...r,
    stop_name:stopMap.get(Number(r.stop_id))?.name||null,
    destination_name:destMap.get(Number(r.destination_id))?.name||null
  })).sort((a,b)=>String(a.boarded_at||"").localeCompare(String(b.boarded_at||"")));
  const cashClosures=cashAll.filter(x=>x.service_date===today).sort((a,b)=>Number(a.bus_id)-Number(b.bus_id));

  return {
    drivers:cleanDrivers,
    buses:buses.sort(sortNum),
    zones:zones.filter(x=>x.active!==false).sort(sortNum),
    stops:stops.filter(x=>x.active!==false).sort((a,b)=>Number(a.zone_id)-Number(b.zone_id)||Number(a.sort_order)-Number(b.sort_order)||Number(a.id)-Number(b.id)),
    destinations:destinations.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name))),
    destinationZones:destinationZones.filter(x=>x.active!==false).sort((a,b)=>Number(a.zone_id)-Number(b.zone_id)||Number(a.sort_order)-Number(b.sort_order)),
    runs:joinedRuns,
    students:students.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))),
    fares:fares.filter(x=>x.active!==false).sort((a,b)=>String(a.zone||"").localeCompare(String(b.zone||""))||String(a.pickup||"").localeCompare(String(b.pickup||""))||String(a.school||"").localeCompare(String(b.school||""))),
    boardings,
    dailyRides,
    cashClosures,
    driverWarnings:driverWarnings.sort((a,b)=>String(b.complaint_date||"").localeCompare(String(a.complaint_date||""))||Number(b.id)-Number(a.id)),
    driverActivity:driverActivity.sort((a,b)=>String(b.service_date||"").localeCompare(String(a.service_date||""))||Number(b.id)-Number(a.id)),
    driverMonthAwards:driverMonthAwards.sort((a,b)=>String(b.month_key||"").localeCompare(String(a.month_key||""))),
    server_time:new Date().toISOString()
  };
}

function publicState(state){
  return {
    drivers:state.drivers.filter(d=>String(d.name||"").trim()&&d.active_status==="ACTIF"&&d.access_status!=="SUSPENDU"&&!d.archived_at).map(d=>({
      id:d.id,name:d.name,active_status:d.active_status,access_status:d.access_status,session_version:d.session_version
    })),
    buses:state.buses.filter(b=>b.active!==false).map(b=>({id:b.id,label:b.label,plate:b.plate,capacity:b.capacity,active:b.active})),
    runs:state.runs.map(r=>({bus_id:r.bus_id,driver_id:r.driver_id,zone_id:r.zone_id,status:r.status})),
    zones:[],stops:[],destinations:[],destinationZones:[],students:[],fares:[],boardings:[],dailyRides:[],cashClosures:[],driverWarnings:[],driverActivity:[],driverMonthAwards:[],
    server_time:state.server_time
  };
}

function driverState(state,driverId){
  const run=state.runs.find(r=>Number(r.driver_id)===Number(driverId));
  const busId=Number(run?.bus_id||0);
  return {
    ...state,
    drivers:state.drivers.filter(d=>Number(d.id)===Number(driverId)),
    buses:state.buses.filter(b=>Number(b.id)===busId),
    runs:state.runs.filter(r=>Number(r.bus_id)===busId),
    students:state.students.filter(s=>Number(s.bus_id)===busId),
    boardings:state.boardings.filter(b=>{
      const s=state.students.find(x=>Number(x.id)===Number(b.student_id));
      return Number(s?.bus_id)===busId;
    }),
    dailyRides:state.dailyRides.filter(r=>Number(r.bus_id)===busId),
    cashClosures:state.cashClosures.filter(c=>Number(c.bus_id)===busId),
    driverWarnings:state.driverWarnings.filter(w=>Number(w.driver_id)===Number(driverId)),
    driverActivity:state.driverActivity.filter(a=>Number(a.driver_id)===Number(driverId)),
    driverMonthAwards:[]
  };
}

async function handleState(req,res){
  const state=await buildState();
  const token=await optionalAuth(req);
  if(!token)return res.json(publicState(state));
  if(["ADMIN","OPERATIONS","GUARD","DIRECTION"].includes(token.role))return res.json(state);
  if(token.role==="DRIVER"){
    const d=state.drivers.find(x=>Number(x.id)===Number(token.driverId));
    if(!d||d.archived_at||d.active_status!=="ACTIF"||d.access_status==="SUSPENDU"||Number(d.session_version)!==Number(token.sessionVersion)){
      return res.status(401).json({ok:false,error:"Session chauffeur expirée ou suspendue."});
    }
    return res.json(driverState(state,token.driverId));
  }
  return res.json(publicState(state));
}

module.exports={buildState,handleState};
