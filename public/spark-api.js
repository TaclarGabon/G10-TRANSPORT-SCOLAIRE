(function(){
"use strict";

const LOCAL_KEY="g10-school-spark-v1";
const H={
  ADMIN:"6cf713e83ca48f8a190b07af39303ea10884872d491f8d0c2056907fc2a26bad",
  OPERATIONS:"c5d4a63dbef4f919bd9cb1690deb3aa0eca57e71fc9af9570465852e2e91357c",
  GUARD:"a0bd500821a86e562ff1a1ab1d85caca8f3ddd287a0a3267536f9a1b7335cfb3",
  DIRECTION:"66ba11c8b57047bc31dcba9dde802fb5f9d55940b0d98e692d4b47f6eead97ad",
  DRIVER1:"3b47492744946d5a188be73c702fb2e3cd1b635433f841381ae8d2e0ed67b45f",
  DRIVER2:"da26b77becf8bcc17aa4e59a0205d8910373e5a25e0d7993fd5b2856c21ecdbb",
  PARENT_DEFAULT:"9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0"
};

const clone=v=>JSON.parse(JSON.stringify(v));
const now=()=>new Date().toISOString();
const gabonDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Libreville",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const normName=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const arr=v=>Array.isArray(v)?v:(v&&typeof v==="object"?Object.values(v):[]);
const num=v=>Number(v)||0;
const nextId=list=>Math.max(0,...arr(list).map(x=>Number(x?.id)||0))+1;
const byId=(list,id)=>arr(list).find(x=>Number(x.id)===Number(id));
const removeById=(list,id)=>arr(list).filter(x=>Number(x.id)!==Number(id));
const error=(message,status=400)=>{const e=new Error(message);e.status=status;throw e};

async function hashCode(v){
  const data=new TextEncoder().encode(String(v));
  const buf=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function baseState(){
  const state={
    drivers:[
      {id:1,name:"",employment_status:"ACTIF",active_status:"ACTIF",access_status:"AUTORISE",session_version:1,archived_at:null,pin_hash:H.DRIVER1,updated_at:now()},
      {id:2,name:"",employment_status:"ACTIF",active_status:"ACTIF",access_status:"AUTORISE",session_version:1,archived_at:null,pin_hash:H.DRIVER2,updated_at:now()}
    ],
    buses:[
      {id:1,label:"Bus 1",capacity:23,plate:"",active:true,scheduled_start:"À définir"},
      {id:2,label:"Bus 2",capacity:23,plate:"",active:true,scheduled_start:"À définir"}
    ],
    zones:[
      {id:1,name:"Akanda",active:true,updated_at:now()},
      {id:2,name:"Owendo",active:true,updated_at:now()}
    ],
    stops:[
      {id:1,zone_id:1,name:"Amissa",sort_order:1,active:true,updated_at:now()},
      {id:2,zone_id:1,name:"Carrefour Jiji",sort_order:2,active:true,updated_at:now()},
      {id:3,zone_id:1,name:"Okala",sort_order:3,active:true,updated_at:now()},
      {id:4,zone_id:1,name:"Cité des Ailes",sort_order:4,active:true,updated_at:now()},
      {id:5,zone_id:2,name:"Pont Nomba",sort_order:1,active:true,updated_at:now()},
      {id:6,zone_id:2,name:"SNI",sort_order:2,active:true,updated_at:now()},
      {id:7,zone_id:2,name:"Lycée Technique",sort_order:3,active:true,updated_at:now()},
      {id:8,zone_id:2,name:"Alénakiri",sort_order:4,active:true,updated_at:now()}
    ],
    destinations:[
      {id:1,name:"Lycée d'État",demo_zone:"Akanda",active:true,updated_at:now()},
      {id:2,name:"Lycée Léon Mba",demo_zone:"Akanda",active:true,updated_at:now()},
      {id:3,name:"Quaben",demo_zone:"Akanda",active:true,updated_at:now()},
      {id:4,name:"Sainte-Marie",demo_zone:"Akanda",active:true,updated_at:now()},
      {id:5,name:"Immaculée",demo_zone:"Akanda",active:true,updated_at:now()},
      {id:6,name:"Bessieux",demo_zone:"Akanda",active:true,updated_at:now()},
      {id:7,name:"Lycée Technique National Omar Bongo",demo_zone:"Owendo",active:true,updated_at:now()},
      {id:8,name:"Lycée Public d'Owendo",demo_zone:"Owendo",active:true,updated_at:now()},
      {id:9,name:"CES d'Alénakiri",demo_zone:"Owendo",active:true,updated_at:now()},
      {id:10,name:"Lycée Privé Catholique Don Bosco",demo_zone:"Owendo",active:true,updated_at:now()}
    ],
    destinationZones:[
      {destination_id:1,zone_id:1,sort_order:1,active:true,updated_at:now()},
      {destination_id:2,zone_id:1,sort_order:2,active:true,updated_at:now()},
      {destination_id:3,zone_id:1,sort_order:3,active:true,updated_at:now()},
      {destination_id:4,zone_id:1,sort_order:4,active:true,updated_at:now()},
      {destination_id:5,zone_id:1,sort_order:5,active:true,updated_at:now()},
      {destination_id:6,zone_id:1,sort_order:6,active:true,updated_at:now()},
      {destination_id:7,zone_id:2,sort_order:1,active:true,updated_at:now()},
      {destination_id:8,zone_id:2,sort_order:2,active:true,updated_at:now()},
      {destination_id:9,zone_id:2,sort_order:3,active:true,updated_at:now()},
      {destination_id:10,zone_id:2,sort_order:4,active:true,updated_at:now()}
    ],
    runs:[
      runTemplate(1),runTemplate(2)
    ],
    students:[],fares:[],boardings:[],dailyRides:[],cashClosures:[],
    driverWarnings:[],driverActivity:[],driverMonthAwards:[],
    managementAccess:[
      {role:"ADMIN",label:"Administration",pin_hash:H.ADMIN,active:true,access_version:1},
      {role:"OPERATIONS",label:"Chef d’exploitation",pin_hash:H.OPERATIONS,active:true,access_version:1},
      {role:"GUARD",label:"Gardien / Clés",pin_hash:H.GUARD,active:true,access_version:1},
      {role:"DIRECTION",label:"Direction",pin_hash:H.DIRECTION,active:true,access_version:1}
    ],
    accessLog:[],
    server_time:now()
  };
  ensureFareMatrix(state);
  return state;
}

function runTemplate(busId){
  return{
    bus_id:busId,driver_id:null,zone_id:null,status:"NON_ASSIGNE",checklist:{},boarded:0,stage:0,
    current_stop_id:null,current_leg:"MATIN",current_location_label:null,
    morning_departure_planned:"À définir",morning_arrival_planned:"À définir",
    return_departure_planned:"À définir",return_arrival_planned:"À définir",
    morning_departed_at:null,morning_arrived_at:null,return_departed_at:null,return_arrived_at:null,
    departed_at:null,arrived_at:null,updated_at:now()
  };
}

function ensureFareMatrix(s){
  s.fares=arr(s.fares);
  const zones=arr(s.zones).filter(z=>z.active!==false);
  const stops=arr(s.stops).filter(x=>x.active!==false);
  const dests=arr(s.destinations).filter(x=>x.active!==false);
  const links=arr(s.destinationZones).filter(x=>x.active!==false);
  for(const z of zones){
    for(const st of stops.filter(x=>Number(x.zone_id)===Number(z.id))){
      for(const link of links.filter(x=>Number(x.zone_id)===Number(z.id))){
        const d=dests.find(x=>Number(x.id)===Number(link.destination_id));if(!d)continue;
        const existing=s.fares.find(f=>f.active!==false&&Number(f.stop_id)===Number(st.id)&&Number(f.destination_id)===Number(d.id));
        if(!existing)s.fares.push({id:nextId(s.fares),zone:z.name,pickup:st.name,school:d.name,stop_id:st.id,destination_id:d.id,daily_amount:1500,monthly_amount:0,active:true,updated_at:now()});
      }
    }
  }
}

function normalizeState(raw){
  const s=raw&&typeof raw==="object"?raw:baseState();
  for(const k of ["drivers","buses","zones","stops","destinations","destinationZones","runs","students","fares","boardings","dailyRides","cashClosures","driverWarnings","driverActivity","driverMonthAwards","managementAccess","accessLog"])s[k]=arr(s[k]);
  if(!s.managementAccess.length)s.managementAccess=baseState().managementAccess;
  s.drivers.forEach(d=>{if(!d.session_version)d.session_version=1;if(!d.pin_hash&&Number(d.id)===1)d.pin_hash=H.DRIVER1;if(!d.pin_hash&&Number(d.id)===2)d.pin_hash=H.DRIVER2;if(!d.access_status)d.access_status="AUTORISE";if(!d.active_status)d.active_status="ACTIF"});
  s.buses.forEach(b=>{if(!b.capacity)b.capacity=23;if(typeof b.active!=="boolean")b.active=true});
  ensureFareMatrix(s);
  const stopMap=new Map(s.stops.map(x=>[Number(x.id),x]));
  const destMap=new Map(s.destinations.map(x=>[Number(x.id),x]));
  const drvMap=new Map(s.drivers.map(x=>[Number(x.id),x]));
  const zoneMap=new Map(s.zones.map(x=>[Number(x.id),x]));
  s.runs.forEach(r=>{r.driver_name=drvMap.get(Number(r.driver_id))?.name||null;r.zone_name=zoneMap.get(Number(r.zone_id))?.name||null});
  s.dailyRides.forEach(r=>{r.stop_name=stopMap.get(Number(r.stop_id))?.name||r.stop_name||null;r.destination_name=destMap.get(Number(r.destination_id))?.name||r.destination_name||null});
  s.server_time=now();
  return s;
}

function localLoad(){
  try{const v=JSON.parse(localStorage.getItem(LOCAL_KEY));return v?normalizeState(v):baseState()}catch(e){return baseState()}
}
function localSave(s){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(s))}catch(e){}}

let remoteRef=null,remoteReady=false,applyingRemote=false;

function setBadge(text){
  const p=document.querySelector("#syncPill");
  if(p)p.textContent=text;
}
function syncSnapshot(s){
  window.G10.snapshot=normalizeState(s);
  localSave(window.G10.snapshot);
}
async function pushState(action="update"){
  if(!window.G10)return;
  window.G10.snapshot.server_time=now();
  localSave(window.G10.snapshot);
  if(remoteReady&&remoteRef&&!applyingRemote){
    try{await remoteRef.set(window.G10.snapshot);setBadge("🟢 Synchronisé Firebase")}
    catch(e){console.error("Firebase write",e);setBadge("🔴 Erreur synchronisation");throw e}
  }
}
function rerender(){if(window.G10){window.G10.renderCurrent?.();window.G10.applyDriverNav?.()}}

function roleRecord(role){return arr(window.G10?.snapshot?.managementAccess).find(x=>x.role===role)}
function sessionValid(){
  if(!window.G10)return;
  const G=window.G10;
  if(G.driverSession){
    const d=byId(G.snapshot.drivers,G.driverSession.driverId);
    if(!d||d.archived_at||d.active_status!=="ACTIF"||d.access_status==="SUSPENDU"||Number(d.session_version)!==Number(G.driverSession.sessionVersion)){
      G.driverSession=null;
      try{sessionStorage.removeItem("g10_school_driver_session")}catch(e){}
      G.toast?.("Session chauffeur fermée.");
    }
  }
  for(const [role,sess] of Object.entries(G.managementSessions||{})){
    const r=roleRecord(role);
    if(!r||r.active===false||Number(r.access_version||1)!==Number(sess.accessVersion||1))delete G.managementSessions[role];
  }
}
async function start(){
  if(!window.G10||!window.G10Firebase)return;
  syncSnapshot(localLoad());
  rerender();
  try{
    await G10Firebase.auth.signInAnonymously();
    const db=G10Firebase.db;
    remoteRef=db.ref(G10Firebase.statePath);
    db.ref(".info/connected").on("value",snap=>setBadge(snap.val()?"🟢 Synchronisé Firebase":"🟠 Hors ligne — données locales"));
    const snap=await remoteRef.once("value");
    if(snap.exists()){
      applyingRemote=true;syncSnapshot(snap.val());sessionValid();rerender();applyingRemote=false;
    }else{
      await remoteRef.set(window.G10.snapshot);
    }
    remoteReady=true;
    remoteRef.on("value",live=>{
      if(!live.exists())return;
      applyingRemote=true;syncSnapshot(live.val());sessionValid();rerender();
      if(window.G10.parentSession&&window.refreshParent)window.refreshParent().catch(()=>{});
      applyingRemote=false;
    });
  }catch(e){
    console.error("Firebase init",e);
    setBadge("🔴 Firebase non connecté");
  }
}

function runForBus(busId){return arr(G10.snapshot.runs).find(r=>Number(r.bus_id)===Number(busId))}
function studentsForBus(busId){return arr(G10.snapshot.students).filter(s=>Number(s.bus_id)===Number(busId)&&s.status==="ACTIF")}
function boarding(studentId,leg){return arr(G10.snapshot.boardings).find(b=>Number(b.student_id)===Number(studentId)&&b.leg===leg&&b.service_date===gabonDate())}
function currentLeg(busId){return runForBus(busId)?.current_leg||"MATIN"}
function dailyOnboard(busId,leg){return arr(G10.snapshot.dailyRides).filter(r=>r.service_date===gabonDate()&&Number(r.bus_id)===Number(busId)&&r.leg===leg&&r.status==="MONTE").length}
function subscriberOnboard(busId,leg){const ids=new Set(studentsForBus(busId).map(s=>Number(s.id)));return arr(G10.snapshot.boardings).filter(b=>b.service_date===gabonDate()&&b.leg===leg&&b.status==="MONTE"&&ids.has(Number(b.student_id))).length}
function refreshBoarded(busId){const r=runForBus(busId);if(!r)return 0;const total=subscriberOnboard(busId,currentLeg(busId))+dailyOnboard(busId,currentLeg(busId));r.boarded=total;r.updated_at=now();return total}
function ensureCapacity(busId,studentId,status){if(!busId||status!=="ACTIF")return;const b=byId(G10.snapshot.buses,busId);if(!b||b.active===false)error("Bus invalide ou inactif.");const n=G10.snapshot.students.filter(s=>Number(s.bus_id)===Number(busId)&&s.status==="ACTIF"&&Number(s.id)!==Number(studentId||-1)).length;if(n>=Number(b.capacity||23))error("Ce bus a déjà atteint sa capacité d’abonnés.",409)}
function stopMatches(zoneName,pickup){const z=G10.snapshot.zones.find(x=>x.active!==false&&x.name===zoneName);return !!(z&&G10.snapshot.stops.find(s=>s.active!==false&&Number(s.zone_id)===Number(z.id)&&s.name===pickup))}
function destinationMatches(zoneName,school){const z=G10.snapshot.zones.find(x=>x.active!==false&&x.name===zoneName),d=G10.snapshot.destinations.find(x=>x.active!==false&&x.name===school);return !!(z&&d&&G10.snapshot.destinationZones.find(l=>l.active!==false&&Number(l.zone_id)===Number(z.id)&&Number(l.destination_id)===Number(d.id)))}

async function pinLogin(payload){
  const kind=String(payload?.kind||"").toLowerCase();
  const pin=String(payload?.pin||"");
  const hash=await hashCode(pin);
  if(kind==="management"){
    const requested=String(payload.role||"").toUpperCase();
    const roles=requested==="ADMIN_OR_DIRECTION"?["ADMIN","DIRECTION"]:[requested];
    const match=roles.map(roleRecord).find(r=>r&&r.active!==false&&r.pin_hash===hash);
    if(!match)error("Code d’accès incorrect.",401);
    return{ok:true,role:match.role,accessVersion:Number(match.access_version||1)};
  }
  if(kind==="driver"){
    const id=Number(payload.driverId),d=byId(G10.snapshot.drivers,id);
    if(!d||d.archived_at||d.active_status!=="ACTIF")error("Ce chauffeur est inactif.",403);
    if(d.access_status==="SUSPENDU")error("Accès chauffeur suspendu par la Direction.",403);
    if(hash!==d.pin_hash)error("Code chauffeur incorrect.",401);
    return{ok:true,role:"DRIVER",driverId:id,sessionVersion:Number(d.session_version||1)};
  }
  if(kind==="parent"){
    const name=normName(payload.guardianName);
    const students=G10.snapshot.students.filter(s=>normName(s.guardian_name)===name);
    if(!students.length||!students.some(s=>s.guardian_pin_hash===hash))error("Nom du parent ou mot de passe incorrect.",401);
    return{ok:true,role:"PARENT",guardianName:students[0].guardian_name};
  }
  error("Type de connexion invalide.");
}

async function adminSave(b){
  const a=String(b.action||"");
  if(a==="ADD_DRIVER"){
    const id=nextId(G10.snapshot.drivers),pin=String(1200+id);
    G10.snapshot.drivers.push({id,name:"",employment_status:"ACTIF",active_status:"ACTIF",access_status:"AUTORISE",session_version:1,archived_at:null,pin_hash:await hashCode(pin),updated_at:now()});
    await pushState(a);return{ok:true,id};
  }
  if(a==="SAVE_DRIVER"){
    const d=byId(G10.snapshot.drivers,b.id);if(!d)error("Chauffeur invalide.");
    const name=String(b.name||"").trim(),pin=String(b.pin||"").trim(),activeStatus=String(b.activeStatus||"ACTIF").toUpperCase();
    if(!name)error("Entre le nom du chauffeur scolaire.");if(pin&&pin.length<4)error("Le code chauffeur doit contenir au moins 4 caractères.");
    d.name=name;d.active_status=activeStatus;d.updated_at=now();
    if(pin){d.pin_hash=await hashCode(pin);d.session_version=Number(d.session_version||1)+1}
    if(activeStatus==="INACTIF"){d.access_status="SUSPENDU";d.session_version=Number(d.session_version||1)+1;for(const r of G10.snapshot.runs.filter(r=>Number(r.driver_id)===Number(d.id)))Object.assign(r,runTemplate(r.bus_id))}
    await pushState(a);return{ok:true};
  }
  if(a==="DELETE_DRIVER"){
    const d=byId(G10.snapshot.drivers,b.id);if(!d)error("Chauffeur invalide.");d.active_status="INACTIF";d.access_status="SUSPENDU";d.archived_at=now();d.session_version=Number(d.session_version||1)+1;d.updated_at=now();
    for(const r of G10.snapshot.runs.filter(r=>Number(r.driver_id)===Number(d.id)))Object.assign(r,runTemplate(r.bus_id));
    await pushState(a);return{ok:true};
  }
  if(a==="ADD_BUS"){
    const id=nextId(G10.snapshot.buses);G10.snapshot.buses.push({id,label:"Bus "+id,capacity:23,plate:"",active:true,scheduled_start:"À définir"});G10.snapshot.runs.push(runTemplate(id));await pushState(a);return{ok:true,id};
  }
  if(a==="SAVE_BUS"){
    const bus=byId(G10.snapshot.buses,b.id);if(!bus)error("Bus scolaire invalide.");const label=String(b.label||"").trim();if(!label)error("Nom du bus requis.");
    Object.assign(bus,{label,plate:String(b.plate||"").trim().toUpperCase(),capacity:Math.max(1,Number(b.capacity||23)),active:b.active!==false});
    if(bus.active===false)Object.assign(runForBus(bus.id),runTemplate(bus.id));
    await pushState(a);return{ok:true};
  }
  if(a==="DELETE_BUS"){
    const bus=byId(G10.snapshot.buses,b.id);if(!bus)error("Bus scolaire invalide.");bus.active=false;G10.snapshot.students.forEach(s=>{if(Number(s.bus_id)===Number(bus.id))s.bus_id=null});Object.assign(runForBus(bus.id),runTemplate(bus.id));await pushState(a);return{ok:true};
  }
  if(a==="SAVE_ASSIGNMENT"){
    const busId=Number(b.busId),driverId=Number(b.driverId),zoneId=Number(b.zoneId);if(!busId||!driverId||!zoneId)error("Bus, chauffeur et zone requis.");
    const d=byId(G10.snapshot.drivers,driverId),bus=byId(G10.snapshot.buses,busId),zone=byId(G10.snapshot.zones,zoneId);
    if(!d||!String(d.name||"").trim())error("Le chauffeur n’est pas renseigné.");if(d.active_status!=="ACTIF"||d.access_status==="SUSPENDU")error("Ce chauffeur est inactif ou suspendu.");if(!bus?.active)error("Ce bus est inactif.");if(!zone?.active)error("Zone invalide.");
    if(G10.snapshot.runs.some(r=>Number(r.driver_id)===driverId&&Number(r.bus_id)!==busId))error("Ce chauffeur est déjà affecté à un autre bus.");
    const r=runForBus(busId)||runTemplate(busId);if(!runForBus(busId))G10.snapshot.runs.push(r);
    const md=String(b.morningDeparturePlanned||b.scheduledStart||"").trim()||"À définir",ma=String(b.morningArrivalPlanned||b.scheduledArrival||"").trim()||"À définir",rd=String(b.returnDeparturePlanned||"").trim()||"À définir",ra=String(b.returnArrivalPlanned||"").trim()||"À définir";
    Object.assign(r,{driver_id:driverId,zone_id:zoneId,status:"ASSIGNE",checklist:{},boarded:0,stage:0,current_leg:"MATIN",current_stop_id:null,current_location_label:null,departed_at:null,arrived_at:null,morning_departure_planned:md,morning_arrival_planned:ma,return_departure_planned:rd,return_arrival_planned:ra,updated_at:now()});bus.scheduled_start=md;await pushState(a);return{ok:true};
  }
  if(a==="DELETE_ASSIGNMENT"){const r=runForBus(b.busId);if(!r)error("Bus invalide.");Object.assign(r,runTemplate(r.bus_id));const bus=byId(G10.snapshot.buses,b.busId);if(bus)bus.scheduled_start="À définir";await pushState(a);return{ok:true}}
  error("Action inconnue.");
}

async function schoolAction(b){
  const a=String(b.action||"");
  if(a==="SAVE_ZONE"){
    const name=String(b.name||"").trim();if(!name)error("Nom de zone requis.");let z=b.id?byId(G10.snapshot.zones,b.id):G10.snapshot.zones.find(x=>x.name===name);
    if(z)Object.assign(z,{name,active:true,updated_at:now()});else G10.snapshot.zones.push({id:nextId(G10.snapshot.zones),name,active:true,updated_at:now()});ensureFareMatrix(G10.snapshot);await pushState(a);return{ok:true};
  }
  if(a==="DELETE_ZONE"){const z=byId(G10.snapshot.zones,b.id);if(!z)error("Zone invalide.");z.active=false;G10.snapshot.runs.filter(r=>Number(r.zone_id)===Number(z.id)).forEach(r=>{r.zone_id=null;r.current_stop_id=null;r.current_location_label=null});await pushState(a);return{ok:true}}
  if(a==="SAVE_STOP"){
    const zoneId=Number(b.zoneId),name=String(b.name||"").trim();if(!zoneId||!name)error("Zone et nom de l’arrêt requis.");let st=b.id?byId(G10.snapshot.stops,b.id):G10.snapshot.stops.find(x=>Number(x.zone_id)===zoneId&&x.name===name);
    if(st)Object.assign(st,{name,zone_id:zoneId,active:true,updated_at:now()});else{const ord=1+Math.max(0,...G10.snapshot.stops.filter(x=>Number(x.zone_id)===zoneId&&x.active!==false).map(x=>Number(x.sort_order||0)));G10.snapshot.stops.push({id:nextId(G10.snapshot.stops),zone_id:zoneId,name,sort_order:ord,active:true,updated_at:now()})}
    ensureFareMatrix(G10.snapshot);await pushState(a);return{ok:true};
  }
  if(a==="DELETE_STOP"){const st=byId(G10.snapshot.stops,b.id);if(!st)error("Arrêt invalide.");st.active=false;G10.snapshot.fares.forEach(f=>{if(Number(f.stop_id)===Number(st.id))f.active=false});await pushState(a);return{ok:true}}
  if(a==="REORDER_STOPS"){const zoneId=Number(b.zoneId),ids=arr(b.stopIds).map(Number);ids.forEach((id,i)=>{const st=byId(G10.snapshot.stops,id);if(st&&Number(st.zone_id)===zoneId){st.sort_order=i+1;st.updated_at=now()}});await pushState(a);return{ok:true}}
  if(a==="SAVE_DESTINATION"){
    const name=String(b.name||"").trim(),zoneId=Number(b.zoneId)||null;if(!name)error("Nom de l’établissement requis.");let d=b.id?byId(G10.snapshot.destinations,b.id):G10.snapshot.destinations.find(x=>x.name===name);
    if(d)Object.assign(d,{name,demo_zone:String(b.demoZone||d.demo_zone||"").trim(),active:true,updated_at:now()});else{d={id:nextId(G10.snapshot.destinations),name,demo_zone:String(b.demoZone||"").trim(),active:true,updated_at:now()};G10.snapshot.destinations.push(d)}
    if(zoneId){let link=G10.snapshot.destinationZones.find(x=>Number(x.destination_id)===Number(d.id)&&Number(x.zone_id)===zoneId);const ord=1+Math.max(0,...G10.snapshot.destinationZones.filter(x=>Number(x.zone_id)===zoneId&&x.active!==false).map(x=>Number(x.sort_order||0)));if(link)Object.assign(link,{active:true,updated_at:now()});else G10.snapshot.destinationZones.push({destination_id:d.id,zone_id:zoneId,sort_order:ord,active:true,updated_at:now()})}
    ensureFareMatrix(G10.snapshot);await pushState(a);return{ok:true,id:d.id};
  }
  if(a==="ASSOCIATE_DESTINATION"){
    const destinationId=Number(b.destinationId),zoneId=Number(b.zoneId);if(!destinationId||!zoneId)error("Zone et établissement requis.");let link=G10.snapshot.destinationZones.find(x=>Number(x.destination_id)===destinationId&&Number(x.zone_id)===zoneId);const ord=1+Math.max(0,...G10.snapshot.destinationZones.filter(x=>Number(x.zone_id)===zoneId&&x.active!==false).map(x=>Number(x.sort_order||0)));if(link)Object.assign(link,{active:true,updated_at:now()});else G10.snapshot.destinationZones.push({destination_id:destinationId,zone_id:zoneId,sort_order:ord,active:true,updated_at:now()});ensureFareMatrix(G10.snapshot);await pushState(a);return{ok:true};
  }
  if(a==="REMOVE_DESTINATION_ZONE"){const link=G10.snapshot.destinationZones.find(x=>Number(x.destination_id)===Number(b.destinationId)&&Number(x.zone_id)===Number(b.zoneId));if(link)link.active=false;await pushState(a);return{ok:true}}
  if(a==="REORDER_DESTINATIONS"){const zoneId=Number(b.zoneId);arr(b.destinationIds).map(Number).forEach((id,i)=>{let link=G10.snapshot.destinationZones.find(x=>Number(x.destination_id)===id&&Number(x.zone_id)===zoneId);if(link){link.sort_order=i+1;link.active=true;link.updated_at=now()}});await pushState(a);return{ok:true}}
  if(a==="DELETE_DESTINATION"){const d=byId(G10.snapshot.destinations,b.id);if(!d)error("Établissement invalide.");d.active=false;G10.snapshot.destinationZones.forEach(l=>{if(Number(l.destination_id)===Number(d.id))l.active=false});G10.snapshot.fares.forEach(f=>{if(Number(f.destination_id)===Number(d.id))f.active=false});await pushState(a);return{ok:true}}
  if(a==="ADD_STUDENT"||a==="UPDATE_STUDENT"){
    const id=Number(b.id)||null,name=String(b.name||"").trim();if(!name)error("Nom de l’élève requis.");
    const guardianName=String(b.guardianName||"").trim(),guardianPin=String(b.guardianPin||"").trim(),zone=String(b.zone||"").trim(),pickup=String(b.pickup||"").trim(),school=String(b.school||"").trim(),busId=Number(b.busId)||null,status=String(b.status||"ACTIF");
    if(zone&&pickup&&!stopMatches(zone,pickup))error("Le point d’arrêt ne correspond pas à la zone sélectionnée.");if(zone&&school&&!destinationMatches(zone,school))error("Cet établissement n’est pas desservi par la zone sélectionnée.");ensureCapacity(busId,id,status);
    let st=id?byId(G10.snapshot.students,id):null;if(id&&!st)error("Élève introuvable.");if(!st){st={id:nextId(G10.snapshot.students),created_at:now()};G10.snapshot.students.push(st)}
    Object.assign(st,{name,guardian_name:guardianName,guardian_phone:String(b.guardianPhone||"").trim(),zone,pickup,school,bus_id:busId,monthly_amount:Math.max(0,Number(b.monthlyAmount||60000)),status,absence_today:!!st.absence_today,morning_pickup_planned:String(b.morningPickupPlanned||"").trim(),school_start_time:String(b.schoolStartTime||"").trim(),return_pickup_planned:String(b.returnPickupPlanned||"").trim(),return_arrival_planned:String(b.returnArrivalPlanned||"").trim(),updated_at:now()});
    if(a==="ADD_STUDENT"||guardianPin)st.guardian_pin_hash=await hashCode(guardianPin||"0000");
    await pushState(a);return{ok:true,id:st.id};
  }
  if(a==="DELETE_STUDENT"){G10.snapshot.students=removeById(G10.snapshot.students,b.id);await pushState(a);return{ok:true}}
  if(a==="IMPORT_STUDENTS"){
    let count=0;for(const row of arr(b.rows)){const name=String(row.name||row.nom||"").trim();if(!name)continue;const busId=Number(row.busId||row.bus_id)||null,status=String(row.status||"ACTIF");try{ensureCapacity(busId,null,status)}catch(e){continue}G10.snapshot.students.push({id:nextId(G10.snapshot.students),name,guardian_name:String(row.guardianName||row.guardian_name||"").trim(),guardian_phone:String(row.guardianPhone||row.guardian_phone||"").trim(),guardian_pin_hash:await hashCode(String(row.guardianPin||row.guardian_pin||"0000").trim()||"0000"),zone:String(row.zone||"").trim(),pickup:String(row.pickup||"").trim(),school:String(row.school||"").trim(),bus_id:busId,monthly_amount:Math.max(0,Number(row.monthlyAmount||row.monthly_amount||60000)),status,absence_today:false,morning_pickup_planned:String(row.morningPickupPlanned||"").trim(),school_start_time:String(row.schoolStartTime||"").trim(),return_pickup_planned:String(row.returnPickupPlanned||"").trim(),return_arrival_planned:String(row.returnArrivalPlanned||"").trim(),created_at:now(),updated_at:now()});count++}
    await pushState(a);return{ok:true,count};
  }
  if(a==="SAVE_FARES_BULK"){let count=0;for(const f of arr(b.fares)){const x=byId(G10.snapshot.fares,f.id);if(x){x.daily_amount=Math.max(0,Number(f.dailyAmount||1500));x.updated_at=now();count++}}await pushState(a);return{ok:true,count}}
  if(a==="SET_BOARDING"){
    const studentId=Number(b.studentId),leg=String(b.leg||"MATIN"),status=String(b.status||"ATTENDU"),st=byId(G10.snapshot.students,studentId);if(!st)error("Élève introuvable.");
    let bd=boarding(studentId,leg);if(!bd){bd={id:nextId(G10.snapshot.boardings),student_id:studentId,service_date:gabonDate(),leg,status:"ATTENDU"};G10.snapshot.boardings.push(bd)}
    bd.status=status;bd.updated_at=now();if(status==="MONTE"&&!bd.boarded_at)bd.boarded_at=now();if(status==="DEPOSE")bd.dropped_at=now();
    if(st.bus_id&&(status==="MONTE"||status==="DEPOSE")){const location=leg==="MATIN"?(status==="MONTE"?st.pickup:st.school):(status==="MONTE"?st.school:st.pickup);const z=G10.snapshot.zones.find(x=>x.name===st.zone);const stop=G10.snapshot.stops.find(x=>Number(x.zone_id)===Number(z?.id)&&x.name===st.pickup);const r=runForBus(st.bus_id);if(r){r.current_stop_id=location===st.pickup?(stop?.id||null):null;r.current_location_label=location;r.updated_at=now()}}
    const boarded=refreshBoarded(st.bus_id);await pushState(a);return{ok:true,boarded};
  }
  if(a==="SET_PARENT_ABSENCE"){
    const st=byId(G10.snapshot.students,b.studentId);if(!st)error("Élève introuvable.");st.absence_today=!!b.absent;st.updated_at=now();let bd=boarding(st.id,"MATIN");
    if(b.absent){if(!bd){bd={id:nextId(G10.snapshot.boardings),student_id:st.id,service_date:gabonDate(),leg:"MATIN"};G10.snapshot.boardings.push(bd)}bd.status="ABSENT";bd.updated_at=now()}else if(bd?.status==="ABSENT")G10.snapshot.boardings=G10.snapshot.boardings.filter(x=>x!==bd);
    await pushState(a);return{ok:true};
  }
  if(a==="ADD_DAILY_RIDE"){
    const busId=Number(b.busId),zoneId=Number(b.zoneId),stopId=Number(b.stopId),destinationId=Number(b.destinationId),leg=String(b.leg||"MATIN");if(!busId||!zoneId||!stopId||!destinationId)error("Arrêt et établissement requis.");
    const run=runForBus(busId),st=byId(G10.snapshot.stops,stopId),link=G10.snapshot.destinationZones.find(x=>Number(x.destination_id)===destinationId&&Number(x.zone_id)===zoneId&&x.active!==false),bus=byId(G10.snapshot.buses,busId);
    if(!run||Number(run.zone_id)!==zoneId||Number(st?.zone_id)!==zoneId||!link)error("Cet arrêt ou cet établissement ne fait pas partie de la zone affectée à ce bus.");if(!bus?.active)error("Bus invalide.");
    const reserved=studentsForBus(busId).length,daily=dailyOnboard(busId,leg),maxDaily=Math.max(0,Number(bus.capacity||23)-reserved);if(daily>=maxDaily)error("Bus complet : "+reserved+" place(s) réservée(s) aux abonnés et "+daily+" place(s) non-abonné(s) déjà utilisées sur "+bus.capacity+".",409);
    const fare=G10.snapshot.fares.find(f=>f.active!==false&&Number(f.stop_id)===stopId&&Number(f.destination_id)===destinationId),amount=Number(fare?.daily_amount||1500),id=nextId(G10.snapshot.dailyRides);
    G10.snapshot.dailyRides.push({id,service_date:gabonDate(),bus_id:busId,zone_id:zoneId,stop_id:stopId,destination_id:destinationId,leg,fare_amount:amount,status:"MONTE",boarded_at:now(),dropped_at:null,stop_name:st.name,destination_name:byId(G10.snapshot.destinations,destinationId)?.name||""});
    run.current_stop_id=leg==="MATIN"?stopId:null;run.current_location_label=String(b.locationLabel||st.name||"").trim();run.updated_at=now();const boarded=refreshBoarded(busId);await pushState(a);return{ok:true,id,amount,boarded,remaining:maxDaily-daily-1};
  }
  if(a==="ARRIVE_DESTINATION"){
    const busId=Number(b.busId),destinationId=Number(b.destinationId),run=runForBus(busId),d=byId(G10.snapshot.destinations,destinationId);if(!run||!d)error("Bus ou établissement invalide.");const today=gabonDate();let subscribers=0,cash=0;
    const ids=new Set(G10.snapshot.students.filter(s=>Number(s.bus_id)===busId&&s.school===d.name).map(s=>Number(s.id)));
    G10.snapshot.boardings.forEach(x=>{if(x.service_date===today&&x.leg==="MATIN"&&x.status==="MONTE"&&ids.has(Number(x.student_id))){x.status="DEPOSE";x.dropped_at=now();x.updated_at=now();subscribers++}});
    G10.snapshot.dailyRides.forEach(x=>{if(x.service_date===today&&Number(x.bus_id)===busId&&x.leg==="MATIN"&&Number(x.destination_id)===destinationId&&x.status==="MONTE"){x.status="DEPOSE";x.dropped_at=now();cash++}});
    run.current_stop_id=null;run.current_location_label=d.name;run.updated_at=now();const boarded=refreshBoarded(busId);await pushState(a);return{ok:true,subscribers,cash,boarded};
  }
  if(a==="ARRIVE_STOP"){
    const busId=Number(b.busId),stopId=Number(b.stopId),run=runForBus(busId),st=byId(G10.snapshot.stops,stopId);if(!run||!st)error("Bus ou arrêt invalide.");const zone=byId(G10.snapshot.zones,st.zone_id)?.name,today=gabonDate();let subscribers=0,cash=0;const ids=new Set(G10.snapshot.students.filter(s=>Number(s.bus_id)===busId&&s.pickup===st.name&&s.zone===zone).map(s=>Number(s.id)));
    G10.snapshot.boardings.forEach(x=>{if(x.service_date===today&&x.leg==="RETOUR"&&x.status==="MONTE"&&ids.has(Number(x.student_id))){x.status="DEPOSE";x.dropped_at=now();x.updated_at=now();subscribers++}});
    G10.snapshot.dailyRides.forEach(x=>{if(x.service_date===today&&Number(x.bus_id)===busId&&x.leg==="RETOUR"&&Number(x.stop_id)===stopId&&x.status==="MONTE"){x.status="DEPOSE";x.dropped_at=now();cash++}});
    run.current_stop_id=stopId;run.current_location_label=st.name;run.updated_at=now();const boarded=refreshBoarded(busId);await pushState(a);return{ok:true,subscribers,cash,boarded};
  }
  if(a==="DROP_DAILY_GROUP"){
    const busId=Number(b.busId),leg=String(b.leg||"MATIN"),destinationId=Number(b.destinationId)||null,stopId=Number(b.stopId)||null,today=gabonDate(),run=runForBus(busId);if(!run)error("Bus invalide.");let count=0;
    G10.snapshot.dailyRides.forEach(x=>{if(x.service_date===today&&Number(x.bus_id)===busId&&x.leg===leg&&x.status==="MONTE"&&(leg==="MATIN"?Number(x.destination_id)===destinationId:Number(x.stop_id)===stopId)){x.status="DEPOSE";x.dropped_at=now();count++}});
    if(leg==="MATIN"){run.current_stop_id=null;run.current_location_label=byId(G10.snapshot.destinations,destinationId)?.name||""}else{run.current_stop_id=stopId;run.current_location_label=byId(G10.snapshot.stops,stopId)?.name||""}
    const boarded=refreshBoarded(busId);await pushState(a);return{ok:true,count,boarded};
  }
  if(a==="CANCEL_DAILY_RIDE"){const ride=byId(G10.snapshot.dailyRides,b.id),busId=Number(ride?.bus_id||0);G10.snapshot.dailyRides=removeById(G10.snapshot.dailyRides,b.id);const boarded=refreshBoarded(busId);await pushState(a);return{ok:true,boarded}}
  if(a==="PASS_STOP"){const r=runForBus(b.busId),st=byId(G10.snapshot.stops,b.stopId);if(!r||!st)error("Arrêt invalide.");r.current_stop_id=st.id;r.current_location_label=st.name;r.updated_at=now();await pushState(a);return{ok:true}}
  if(a==="CLOSE_CASH"){
    const busId=Number(b.busId),counted=Math.max(0,Number(b.countedAmount||0)),method=String(b.transferMethod||"").trim();if(!busId||!method)error("Bus et mode de remise requis.");if(method==="Airtel Money"&&!String(b.destinationPhone||"").trim())error("Entre le numéro Airtel Money destinataire.");
    const expected=G10.snapshot.dailyRides.filter(r=>r.service_date===gabonDate()&&Number(r.bus_id)===busId).reduce((n,r)=>n+Number(r.fare_amount||0),0);let c=G10.snapshot.cashClosures.find(x=>x.service_date===gabonDate()&&Number(x.bus_id)===busId);if(!c){c={id:nextId(G10.snapshot.cashClosures),service_date:gabonDate(),bus_id:busId};G10.snapshot.cashClosures.push(c)}Object.assign(c,{expected_amount:expected,counted_amount:counted,handed_to:method,transfer_method:method,destination_phone:String(b.destinationPhone||"").trim(),transaction_reference:String(b.transactionReference||"").trim(),note:String(b.note||"").trim(),closed_at:now()});await pushState(a);return{ok:true,expected,countedAmount:counted,difference:counted-expected,transferMethod:method};
  }
  error("Action inconnue.");
}

async function driverAction(b){
  const a=String(b.action||""),sess=G10.driverSession;if(!sess)error("Connexion chauffeur requise.",401);const d=byId(G10.snapshot.drivers,sess.driverId),run=runForBus(sess.busId),bus=byId(G10.snapshot.buses,sess.busId);
  if(!d||d.archived_at||d.active_status!=="ACTIF"||d.access_status==="SUSPENDU"||Number(d.session_version)!==Number(sess.sessionVersion))error("Session chauffeur expirée ou suspendue.",401);if(!run||Number(run.driver_id)!==Number(d.id)||!bus?.active)error("Ce bus n’est pas affecté à ce chauffeur.",403);
  if(a==="LOGIN"){if(run.status==="NON_ASSIGNE")run.status="ASSIGNE";run.updated_at=now();await pushState(a);return{ok:true,sessionVersion:Number(d.session_version||1)}}
  if(a==="ACK_WARNING"){const w=byId(G10.snapshot.driverWarnings,b.payload?.warningId);if(!w||Number(w.driver_id)!==Number(d.id)||w.status!=="CONFIRMEE")error("Avertissement confirmé introuvable.",404);w.acknowledged_at=w.acknowledged_at||now();w.updated_at=now();await pushState(a);return{ok:true}}
  if(a==="SET_LEG"){const leg=String(b.payload?.leg||"MATIN");if(!["MATIN","RETOUR"].includes(leg))error("Trajet invalide.");Object.assign(run,{current_leg:leg,current_stop_id:null,current_location_label:null,boarded:0,stage:0,departed_at:null,arrived_at:null,status:G10.is360Ok(run)?"CONTROLE_OK":"ASSIGNE",updated_at:now()});await pushState(a);return{ok:true}}
  if(a==="CHECKLIST"){const c=b.payload&&typeof b.payload==="object"?b.payload:{};run.checklist={pneus:!!c.pneus,feux:!!c.feux,huile:!!c.huile,niveaux:!!c.niveaux,tableau:!!c.tableau,dommages:!!c.dommages};run.status=Object.values(run.checklist).every(Boolean)?"CONTROLE_OK":"CONTROLE_EN_COURS";run.updated_at=now();await pushState(a);return{ok:true}}
  if(a==="DEPART"){if(!G10.is360Ok(run))error("Le contrôle 360° doit être validé avant le départ.");Object.assign(run,{status:"EN_ROUTE",stage:1,departed_at:now(),arrived_at:null,updated_at:now()});if(run.current_leg==="RETOUR"){run.return_departed_at=now();run.current_location_label="Départ établissements"}else{run.morning_departed_at=now();run.current_location_label="Départ circuit matin"}await pushState(a);return{ok:true}}
  if(a==="ARRIVE"){
    if(Number(run.boarded||0)>0)error("Impossible de terminer le trajet : "+Number(run.boarded||0)+" passager(s) sont encore enregistrés à bord.",409);
    const leg=run.current_leg==="RETOUR"?"RETOUR":"MATIN",today=gabonDate(),ids=new Set(studentsForBus(bus.id).map(s=>Number(s.id))),subs=G10.snapshot.boardings.filter(x=>x.service_date===today&&x.leg===leg&&x.status==="DEPOSE"&&ids.has(Number(x.student_id))).length,cash=G10.snapshot.dailyRides.filter(x=>x.service_date===today&&x.leg===leg&&x.status==="DEPOSE"&&Number(x.bus_id)===Number(bus.id)).length,planned=leg==="RETOUR"?run.return_arrival_planned:run.morning_arrival_planned;
    Object.assign(run,{status:"ARRIVE",stage:4,arrived_at:now(),updated_at:now()});if(leg==="RETOUR"){run.return_arrived_at=now();run.current_location_label="Fin du retour"}else{run.morning_arrived_at=now();run.current_location_label="Arrivée établissements"}
    let act=G10.snapshot.driverActivity.find(x=>Number(x.driver_id)===Number(d.id)&&x.service_date===today&&x.leg===leg);if(!act){act={id:nextId(G10.snapshot.driverActivity),driver_id:d.id,bus_id:bus.id,service_date:today,leg};G10.snapshot.driverActivity.push(act)}Object.assign(act,{passengers_transported:subs+cash,capacity:Number(bus.capacity||23),planned_end:planned,actual_end:now(),checklist_ok:G10.is360Ok(run),created_at:act.created_at||now()});
    await pushState(a);return{ok:true};
  }
  error("Action inconnue.");
}

async function managementAction(b){
  const a=String(b.action||"");
  if(a==="ADD_WARNING"){const id=nextId(G10.snapshot.driverWarnings),reason=String(b.reason||"").trim();if(!b.driverId||!reason)error("Chauffeur et motif requis.");G10.snapshot.driverWarnings.push({id,driver_id:Number(b.driverId),complaint_date:String(b.date||"").trim()||gabonDate(),reason,details:String(b.details||"").trim(),recorded_by:String(b.recordedBy||"").trim()||"G10",status:String(b.status||"A_VERIFIER"),acknowledged_at:null,created_at:now(),updated_at:now()});await pushState(a);return{ok:true,id}}
  if(a==="UPDATE_WARNING"){const w=byId(G10.snapshot.driverWarnings,b.id);if(!w)error("Avertissement invalide.");w.status=String(b.status||w.status);w.updated_at=now();await pushState(a);return{ok:true}}
  if(a==="SET_DRIVER_ACCESS"){const d=byId(G10.snapshot.drivers,b.driverId);if(!d)error("Chauffeur invalide.");d.access_status=String(b.accessStatus||"AUTORISE");d.session_version=Number(d.session_version||1)+1;d.updated_at=now();G10.snapshot.accessLog.push({date:now(),type:"DRIVER",id:d.id,action:d.access_status});await pushState(a);return{ok:true}}
  if(a==="CHANGE_DRIVER_PIN"){const d=byId(G10.snapshot.drivers,b.driverId),pin=String(b.pin||"").trim();if(!d||pin.length<4)error("PIN de 4 caractères minimum requis.");d.pin_hash=await hashCode(pin);d.session_version=Number(d.session_version||1)+1;d.updated_at=now();G10.snapshot.accessLog.push({date:now(),type:"DRIVER",id:d.id,action:"PIN modifié"});await pushState(a);return{ok:true}}
  if(a==="FORCE_DRIVER_LOGOUT"){const d=byId(G10.snapshot.drivers,b.driverId);if(!d)error("Chauffeur invalide.");d.session_version=Number(d.session_version||1)+1;d.updated_at=now();G10.snapshot.accessLog.push({date:now(),type:"DRIVER",id:d.id,action:"Déconnexion forcée"});await pushState(a);return{ok:true}}
  if(a==="VALIDATE_DRIVER_MONTH"){const monthKey=String(b.monthKey||""),driverId=Number(b.driverId);G10.snapshot.driverMonthAwards=G10.snapshot.driverMonthAwards.filter(x=>x.month_key!==monthKey);G10.snapshot.driverMonthAwards.push({id:nextId(G10.snapshot.driverMonthAwards),month_key:monthKey,driver_id:driverId,validated_by:"Direction",validated_at:now()});await pushState(a);return{ok:true}}
  if(a==="CHANGE_MANAGEMENT_PIN"){const r=roleRecord(String(b.role||"").toUpperCase()),pin=String(b.pin||"").trim();if(!r||pin.length<4)error("Rôle ou PIN invalide.");r.pin_hash=await hashCode(pin);r.access_version=Number(r.access_version||1)+1;G10.snapshot.accessLog.push({date:now(),type:"MANAGEMENT",role:r.role,action:"PIN modifié"});await pushState(a);return{ok:true}}
  if(a==="FORCE_MANAGEMENT_LOGOUT"){const r=roleRecord(String(b.role||"").toUpperCase());if(!r)error("Rôle invalide.");r.access_version=Number(r.access_version||1)+1;G10.snapshot.accessLog.push({date:now(),type:"MANAGEMENT",role:r.role,action:"Déconnexion forcée"});await pushState(a);return{ok:true}}
  if(a==="SET_MANAGEMENT_ACCESS"){const r=roleRecord(String(b.role||"").toUpperCase());if(!r)error("Rôle invalide.");r.active=!!b.active;r.access_version=Number(r.access_version||1)+1;G10.snapshot.accessLog.push({date:now(),type:"MANAGEMENT",role:r.role,action:r.active?"Accès réactivé":"Accès suspendu"});await pushState(a);return{ok:true}}
  error("Action inconnue.");
}

function parentData(){
  const guardian=String(G10.parentSession?.guardianName||"");if(!guardian)error("Connexion parent requise.",401);
  const children=G10.snapshot.students.filter(s=>normName(s.guardian_name)===normName(guardian)).map(s=>{
    const bus=byId(G10.snapshot.buses,s.bus_id)||{},run=runForBus(s.bus_id)||{};
    return{...clone(s),bus_label:bus.label||null,plate:bus.plate||null,bus_status:run.status||"NON_ASSIGNE",current_leg:run.current_leg||"MATIN",current_location_label:run.current_location_label||null,morning_departure_planned:run.morning_departure_planned||null,morning_arrival_planned:run.morning_arrival_planned||null,return_departure_planned:run.return_departure_planned||null,return_arrival_planned:run.return_arrival_planned||null,morning_departed_at:run.morning_departed_at||null,morning_arrived_at:run.morning_arrived_at||null,return_departed_at:run.return_departed_at||null,return_arrived_at:run.return_arrived_at||null,boardings:G10.snapshot.boardings.filter(b=>Number(b.student_id)===Number(s.id)&&b.service_date===gabonDate()).map(clone)};
  });
  return{ok:true,guardianName:children[0]?.guardian_name||guardian,children};
}

async function resetDemo(mode){
  if(String(mode).toUpperCase()==="FULL"){const m=clone(G10.snapshot.managementAccess);syncSnapshot(baseState());G10.snapshot.managementAccess=m;await pushState("RESET_FULL");return{ok:true,mode:"FULL"}}
  const today=gabonDate();G10.snapshot.boardings=G10.snapshot.boardings.filter(x=>x.service_date!==today);G10.snapshot.dailyRides=G10.snapshot.dailyRides.filter(x=>x.service_date!==today);G10.snapshot.cashClosures=G10.snapshot.cashClosures.filter(x=>x.service_date!==today);G10.snapshot.driverActivity=G10.snapshot.driverActivity.filter(x=>x.service_date!==today);G10.snapshot.students.forEach(s=>{s.absence_today=false;s.updated_at=now()});G10.snapshot.runs.forEach(r=>Object.assign(r,{status:(r.driver_id&&r.zone_id)?"ASSIGNE":"NON_ASSIGNE",checklist:{},boarded:0,stage:0,current_leg:"MATIN",current_stop_id:null,current_location_label:null,departed_at:null,arrived_at:null,morning_departed_at:null,morning_arrived_at:null,return_departed_at:null,return_arrived_at:null,updated_at:now()}));await pushState("RESET_DAY");return{ok:true,mode:"DAY"};
}

async function api(path,opts={}){
  let b={};try{b=opts.body?JSON.parse(opts.body):{}}catch(e){}
  if(path==="/state")return clone(normalizeState(G10.snapshot));
  if(path==="/admin-save")return adminSave(b);
  if(path==="/school-action")return schoolAction(b);
  if(path==="/driver-action")return driverAction(b);
  if(path==="/management-action")return managementAction(b);
  if(path==="/parent-login")return parentData();
  if(path==="/reset-demo")return resetDemo(b.mode);
  error("Route locale inconnue : "+path,404);
}

window.G10Spark={start,api,pinLogin,pushState,hashCode,normalizeState,roleRecord};
})();