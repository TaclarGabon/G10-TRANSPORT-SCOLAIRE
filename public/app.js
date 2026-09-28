const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];
const API=(window.__HATCHABLE__&&window.__HATCHABLE__.api)||"/api";

window.G10={
  snapshot:{drivers:[],buses:[],zones:[],stops:[],destinations:[],destinationZones:[],runs:[],students:[],fares:[],boardings:[],dailyRides:[],cashClosures:[],driverWarnings:[],driverActivity:[],driverMonthAwards:[],server_time:null},
  currentScreen:"home",
  renderers:{},
  driverSession:null,
  parentSession:null,
  parentData:null,
  managementSessions:{},
  managementRoles:{admin:"ADMIN",operations:"OPERATIONS",dashboard:"DIRECTION",documents:"ADMIN_OR_DIRECTION"}
};

G10.esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
G10.money=v=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";
G10.fmtTime=iso=>!iso?"—":new Intl.DateTimeFormat("fr-FR",{timeZone:"Africa/Libreville",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
G10.timeToMinutes=t=>{if(!/^\d{2}:\d{2}$/.test(String(t||"")))return null;const p=String(t).split(":").map(Number);return p[0]*60+p[1]};
G10.actualToMinutes=iso=>{if(!iso)return null;const s=new Intl.DateTimeFormat("fr-FR",{timeZone:"Africa/Libreville",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso));return G10.timeToMinutes(s)};
G10.varianceText=(planned,actualIso)=>{const p=G10.timeToMinutes(planned),a=G10.actualToMinutes(actualIso);if(p===null||a===null)return"—";let d=a-p;if(d>720)d-=1440;if(d<-720)d+=1440;if(d===0)return"À l’heure";return d<0?Math.abs(d)+" min d’avance":"+"+d+" min de retard"};
G10.toast=msg=>{const el=$("#toast");if(!el)return;el.textContent=msg;el.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.style.display="none",2100)};
G10.api=async(path,opts={})=>{const res=await fetch(API+path,{headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});let data={};try{data=await res.json()}catch(e){}if(!res.ok)throw new Error(data.error||("Erreur "+res.status));return data};

G10.busFor=id=>G10.snapshot.buses.find(b=>Number(b.id)===Number(id));
G10.runFor=id=>G10.snapshot.runs.find(r=>Number(r.bus_id)===Number(id));
G10.driverFor=id=>G10.snapshot.drivers.find(d=>Number(d.id)===Number(id));
G10.zoneFor=id=>G10.snapshot.zones.find(z=>Number(z.id)===Number(id));
G10.stopFor=id=>G10.snapshot.stops.find(s=>Number(s.id)===Number(id));
G10.destinationFor=id=>G10.snapshot.destinations.find(d=>Number(d.id)===Number(id));
G10.destinationsForZone=zoneId=>{
  const links=(G10.snapshot.destinationZones||[]).filter(x=>Number(x.zone_id)===Number(zoneId)&&x.active!==false).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
  return links.map(x=>G10.destinationFor(x.destination_id)).filter(Boolean);
};
G10.stopsForZone=zoneId=>G10.snapshot.stops.filter(s=>Number(s.zone_id)===Number(zoneId)&&s.active!==false).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
G10.activeDrivers=()=>G10.snapshot.drivers.filter(d=>String(d.name||"").trim()&&d.active_status==="ACTIF"&&d.access_status!=="SUSPENDU"&&!d.archived_at);
G10.activeStudents=()=>G10.snapshot.students.filter(s=>s.status==="ACTIF");
G10.studentsForBus=busId=>G10.activeStudents().filter(s=>Number(s.bus_id)===Number(busId));
G10.boardingFor=(studentId,leg)=>G10.snapshot.boardings.find(b=>Number(b.student_id)===Number(studentId)&&b.leg===leg);
G10.dailyRidesForBus=(busId,leg=null)=>G10.snapshot.dailyRides.filter(r=>Number(r.bus_id)===Number(busId)&&(!leg||r.leg===leg));
G10.checklistObj=run=>{const c=run?.checklist;if(!c)return{};if(typeof c==="string"){try{return JSON.parse(c)}catch(e){return{}}}return c};
G10.checkedCount=run=>Object.values(G10.checklistObj(run)).filter(Boolean).length;
G10.is360Ok=run=>["pneus","feux","huile","niveaux","tableau","dommages"].every(k=>!!G10.checklistObj(run)[k]);
G10.statusLabel=s=>({NON_ASSIGNE:"Non affecté",ASSIGNE:"Affecté",CONNECTE:"Connecté",CONTROLE_EN_COURS:"Contrôle en cours",CONTROLE_OK:"360° validé",EN_ROUTE:"En route",ARRET_1:"À l’arrêt",ARRIVE:"Arrivé",ACTIF:"Actif",INACTIF:"Inactif",AUTORISE:"Autorisé",EN_ATTENTE:"En attente de régularisation",SUSPENDU:"Suspendu",ATTENDU:"Attendu",MONTE:"Monté",ABSENT:"Absent",DEPOSE:"Déposé",A_VERIFIER:"À vérifier",CONFIRMEE:"Confirmée",CLASSEE:"Classée"})[s]||s||"—";
G10.badge=s=>{let cls="bluebg";if(["ARRIVE","CONTROLE_OK","ACTIF","AUTORISE","MONTE","DEPOSE","CONFIRMEE"].includes(s))cls="greenbg";else if(["CONNECTE","CONTROLE_EN_COURS","EN_ROUTE","ARRET_1","EN_ATTENTE","A_VERIFIER"].includes(s))cls="orangebg";else if(["NON_ASSIGNE","INACTIF","ABSENT","SUSPENDU"].includes(s))cls="redbg";else if(["CLASSEE"].includes(s))cls="graybg";return '<span class="badge '+cls+'">'+G10.esc(G10.statusLabel(s))+'</span>'};
G10.busTone=id=>Number(id)%2===1?"busTone1":"busTone2";
G10.busChip=id=>Number(id)%2===1?"busChip1":"busChip2";
G10.subscriberBoardedCount=(busId,leg)=>G10.studentsForBus(busId).filter(s=>G10.boardingFor(s.id,leg)?.status==="MONTE").length;
G10.subscriberAbsentCount=(busId,leg)=>G10.studentsForBus(busId).filter(s=>G10.boardingFor(s.id,leg)?.status==="ABSENT"||s.absence_today).length;
G10.dailyOnboardCount=(busId,leg=null)=>G10.dailyRidesForBus(busId,leg).filter(r=>r.status==="MONTE").length;
G10.dailyRevenue=busId=>G10.dailyRidesForBus(busId).reduce((n,r)=>n+Number(r.fare_amount||0),0);
G10.warningsForDriver=driverId=>(G10.snapshot.driverWarnings||[]).filter(w=>Number(w.driver_id)===Number(driverId));
G10.confirmedWarningsForDriver=driverId=>G10.warningsForDriver(driverId).filter(w=>w.status==="CONFIRMEE");
G10.warningLevel=driverId=>{
  const n=G10.confirmedWarningsForDriver(driverId).length;
  if(n<=0)return{count:0,icon:"🟢",label:"Aucun avertissement"};
  if(n===1)return{count:1,icon:"🟡",label:"1er avertissement — verbal"};
  if(n===2)return{count:2,icon:"🟠",label:"2e avertissement — risque de mise à pied"};
  return{count:n,icon:"🔴",label:"3e avertissement confirmé — décision Direction requise"};
};

G10.setTitle=(title,subtitle)=>{if($("#pageTitle"))$("#pageTitle").textContent=title;if($("#pageSubtitle"))$("#pageSubtitle").textContent=subtitle};

G10.managementTokenFor=screen=>{
  const needed=G10.managementRoles[screen];
  if(!needed)return null;
  if(needed==="ADMIN_OR_DIRECTION")return G10.managementSessions.ADMIN?.token||G10.managementSessions.DIRECTION?.token||null;
  return G10.managementSessions[needed]?.token||null;
};
G10.ensureManagementAccess=async screen=>{
  const needed=G10.managementRoles[screen];
  if(!needed)return true;
  if(G10.managementTokenFor(screen))return true;
  const labels={ADMIN:"Administration",OPERATIONS:"Chef d’exploitation",DIRECTION:"Direction",ADMIN_OR_DIRECTION:"Administration ou Direction"};
  const code=prompt("Code d’accès — "+(labels[needed]||needed));
  if(code===null)return false;
  try{
    const out=await G10.api("/management-login",{method:"POST",body:JSON.stringify({code,requestedRole:needed})});
    G10.managementSessions[out.role]={token:out.token};
    return true;
  }catch(e){G10.toast(e.message);return false}
};
G10.applyDriverNav=()=>{
  const locked=!!G10.driverSession;
  $$(".navBtn").forEach(b=>{
    if(!locked){b.style.display="";return}
    b.style.display=["home","driver"].includes(b.dataset.nav)?"":"none";
  });
};
G10.managementAction=async(screen,body)=>{
  const ok=await G10.ensureManagementAccess(screen);
  if(!ok)throw new Error("Accès requis.");
  const managementToken=G10.managementTokenFor(screen);
  return G10.api("/management-action",{method:"POST",body:JSON.stringify({...body,managementToken})});
};

window.openScreen=async id=>{
  if(G10.driverSession&&!["home","driver"].includes(id)){
    G10.toast("Le chauffeur a accès uniquement à Accueil et Espace chauffeur.");
    id="home";
  }
  if(G10.managementRoles[id]){
    const ok=await G10.ensureManagementAccess(id);
    if(!ok)return;
  }
  G10.currentScreen=id;
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const target=$("#"+id);if(target)target.classList.add("active");
  $$(".navBtn").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
  const titles={
    home:["Accueil","Bienvenue chez G10 Transports."],
    admin:["Administration","Création des chauffeurs, bus, zones, arrêts, abonnés et tarifs scolaires."],
    operations:["Chef d’exploitation","Affectation des bus, zones, chauffeurs et horaires."],
    driver:["Espace chauffeur","Contrôle 360°, départ et suivi des élèves arrêt par arrêt."],
    dashboard:["Direction","Abonnements, recettes quotidiennes et situation des bus scolaires."],
    parent:["Parent","Accès privé au trajet de votre enfant."],
    documents:["Documents & exports","Exports, impressions et outils de démonstration."]
  };
  if(titles[id])G10.setTitle(titles[id][0],titles[id][1]);
  G10.renderCurrent();
  const u=new URL(location.href);u.searchParams.set("screen",id);history.replaceState({}, "", u);
  scrollTo(0,0);
};
G10.renderCurrent=()=>{const fn=G10.renderers[G10.currentScreen];if(fn)fn()};
G10.loadState=async(silent=true)=>{
  try{
    G10.snapshot=await G10.api("/state");
    if(G10.driverSession){
      const d=G10.driverFor(G10.driverSession.driverId);
      if(!d||d.active_status!=="ACTIF"||d.access_status==="SUSPENDU"||Number(d.session_version)!==Number(G10.driverSession.sessionVersion)){
        G10.driverSession=null;
        if(G10.currentScreen==="driver")G10.toast("Session chauffeur fermée par la Direction.");
      }
    }
    G10.applyDriverNav();
    const pill=$("#syncPill");if(pill)pill.textContent="🟢 G10 Transports Scolaires";
    G10.renderCurrent();
    if(!silent)G10.toast("Données synchronisées");
  }catch(e){
    const pill=$("#syncPill");if(pill)pill.textContent="🟠 Connexion en attente";
    if(!silent)G10.toast(e.message);
  }
};

try{
  const rt=hatchable.events.connect();
  rt.channel("g10-school-live").on("state-changed",async()=>{await G10.loadState(true);if(G10.parentSession&&window.refreshParent)try{await window.refreshParent()}catch(e){}});
  rt.channel("g10-school-live").on("$reset",()=>G10.loadState(true));
}catch(e){}

const requested=new URL(location.href).searchParams.get("screen");
if(["home","admin","operations","driver","dashboard","parent","documents"].includes(requested))G10.currentScreen=requested;
window.addEventListener("DOMContentLoaded",()=>G10.loadState(true).then(()=>openScreen(G10.currentScreen)));