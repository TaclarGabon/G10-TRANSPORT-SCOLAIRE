let adminTab="drivers";
let selectedRouteZoneId=null;
let selectedFareZoneId=null;
let editingStudentId=null;

window.setAdminTab=tab=>{adminTab=tab;renderAdmin()};
G10.renderers.admin=renderAdmin;

function renderAdmin(){
  ["Drivers","Students","Fares","Routes","Buses"].forEach(x=>{const b=$("#adminTab"+x);if(b)b.classList.toggle("active",adminTab===x.toLowerCase())});
  if(adminTab==="drivers")renderAdminDrivers();
  if(adminTab==="students")renderAdminStudents();
  if(adminTab==="fares")renderAdminFares();
  if(adminTab==="routes")renderAdminRoutes();
  if(adminTab==="buses")renderAdminBuses();
}

function renderAdminDrivers(){
  const rows=G10.snapshot.drivers.length?G10.snapshot.drivers:[{id:1,name:"",active_status:"ACTIF"},{id:2,name:"",active_status:"ACTIF"}];
  let html='<div class="panelHead"><div><h4>Chauffeurs scolaires</h4><p class="muted">Statut Actif = le chauffeur peut être affecté par le Chef d’exploitation. Inactif = il reste dans la base mais ne peut pas recevoir de bus.</p></div><button class="btn green" onclick="addDriver()">+ Ajouter un chauffeur</button></div>';
  html+=rows.map((d,i)=>'<div class="miniCard"><div class="schoolRow">'+
    '<div><label>Nom chauffeur '+(i+1)+'</label><input id="drv_name_'+d.id+'" value="'+G10.esc(d.name||"")+'" placeholder="Nom à renseigner"></div>'+
    '<div><label>Code de connexion</label><input id="drv_pin_'+d.id+'" placeholder="'+String(1200+Number(d.id))+'"></div>'+
    '<div><label>Statut</label><select id="drv_status_'+d.id+'" class="driverStatusSelect"><option value="ACTIF" '+(d.active_status==="ACTIF"?"selected":"")+'>Actif</option><option value="INACTIF" '+(d.active_status==="INACTIF"?"selected":"")+'>Inactif</option></select></div>'+
    '<div class="studentActions"><button class="btn light" onclick="editDriver('+d.id+')">Éditer</button><button class="btn orange" onclick="deleteDriver('+d.id+')">Archiver</button><button class="btn green" onclick="saveDriver('+d.id+')">Enregistrer</button></div>'+
    '</div></div>').join("");
  $("#adminContent").innerHTML=html;
}
window.addDriver=async()=>{try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify({action:"ADD_DRIVER"})});await G10.loadState();G10.toast("Chauffeur ajouté")}catch(e){G10.toast(e.message)}};
window.editDriver=id=>{const e=$("#drv_name_"+id);if(e){e.focus();e.select()}};
window.saveDriver=async id=>{
  const name=$("#drv_name_"+id).value.trim();
  const pin=$("#drv_pin_"+id).value.trim();
  const activeStatus=$("#drv_status_"+id).value;
  try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify({action:"SAVE_DRIVER",id,name,pin,activeStatus})});await G10.loadState();G10.toast("Chauffeur enregistré")}catch(e){G10.toast(e.message)}
};
window.deleteDriver=async id=>{if(!confirm("Archiver ce chauffeur ? Son historique sera conservé et son accès sera suspendu."))return;try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify({action:"DELETE_DRIVER",id})});await G10.loadState();G10.toast("Chauffeur archivé")}catch(e){G10.toast(e.message)}};

function zoneOptions(current){
  return G10.snapshot.zones.filter(z=>z.active!==false).map(z=>'<option value="'+z.id+'" '+(String(current)===String(z.name)||Number(current)===Number(z.id)?"selected":"")+'>'+G10.esc(z.name)+'</option>').join("");
}
function pickupOptions(zoneName,current){
  const z=G10.snapshot.zones.find(x=>x.name===zoneName);if(!z)return'<option value="">Aucun arrêt</option>';
  return '<option value="">-- Choisir arrêt G10 --</option>'+G10.stopsForZone(z.id).map(s=>'<option value="'+G10.esc(s.name)+'" '+(s.name===current?"selected":"")+'>'+G10.esc(s.name)+'</option>').join("");
}
function schoolOptions(zoneName,current){
  const z=G10.snapshot.zones.find(x=>x.name===zoneName);
  if(!z)return '<option value="">Aucun établissement</option>';
  const list=G10.destinationsForZone(z.id);
  let options='<option value="">-- Choisir établissement --</option>'+list.map(d=>'<option value="'+G10.esc(d.name)+'" '+(d.name===current?"selected":"")+'>'+G10.esc(d.name)+'</option>').join("");
  if(current&&!list.some(d=>d.name===current)) options+='<option value="'+G10.esc(current)+'" selected>'+G10.esc(current)+' — hors zone actuelle</option>';
  return options;
}
function busOptions(current){
  return '<option value="">Non affecté</option>'+G10.snapshot.buses.filter(b=>b.active!==false).map(b=>'<option value="'+b.id+'" '+(Number(current)===Number(b.id)?"selected":"")+'>'+G10.esc(b.label)+(b.plate?" • "+G10.esc(b.plate):"")+'</option>').join("");
}
function studentStatusOptions(current){
  return '<option value="ACTIF" '+(current==="ACTIF"?"selected":"")+'>Actif — abonnement validé</option>'+
    '<option value="EN_ATTENTE" '+(current==="EN_ATTENTE"?"selected":"")+'>En attente de régularisation</option>'+
    '<option value="SUSPENDU" '+(current==="SUSPENDU"?"selected":"")+'>Suspendu</option>';
}
function renderAdminStudents(){
  const e=editingStudentId?G10.snapshot.students.find(s=>Number(s.id)===Number(editingStudentId)):null;
  const d=e||{name:"",guardian_name:"",guardian_phone:"",zone:G10.snapshot.zones[0]?.name||"Akanda",pickup:"",school:"",bus_id:null,monthly_amount:60000,status:"ACTIF",morning_pickup_planned:"",school_start_time:"",return_pickup_planned:"",return_arrival_planned:""};
  let html='<div class="miniCard"><div class="panelHead"><div><h4>'+(e?"Modifier l’abonné":"Ajouter un élève abonné")+'</h4><p class="muted">Le montant mensuel appartient à l’abonnement. Les tarifs journaliers des non-abonnés sont gérés dans l’onglet “Tarifs non-abonnés”.</p></div><span class="badge greenbg">Référence : 60 000 FCFA/mois</span></div>';
  html+='<div class="studentForm">'+
    '<div><label>Nom élève</label><input id="st_name" value="'+G10.esc(d.name)+'"></div>'+
    '<div><label>Parent / responsable</label><input id="st_guardian" value="'+G10.esc(d.guardian_name)+'"></div>'+
    '<div><label>Téléphone parent</label><input id="st_phone" value="'+G10.esc(d.guardian_phone)+'"></div>'+
    '<div><label>Mot de passe parent</label><input id="st_guardian_pin" value="" placeholder="'+(e?"Laisser vide pour conserver":"0000")+'"></div>'+
    '<div><label>Zone</label><select id="st_zone" onchange="studentZoneChanged()">'+zoneOptions(d.zone)+'</select></div>'+
    '<div><label>Point d’arrêt G10</label><select id="st_pickup">'+pickupOptions(d.zone,d.pickup)+'</select></div>'+
    '<div><label>Établissement</label><select id="st_school">'+schoolOptions(d.zone,d.school)+'</select></div>'+
    '<div><label>Passage prévu à l’arrêt — matin</label><input id="st_morning_pickup" type="time" value="'+G10.esc(d.morning_pickup_planned||"")+'"></div>'+
    '<div><label>Début des cours</label><input id="st_school_start" type="time" value="'+G10.esc(d.school_start_time||"")+'"></div>'+
    '<div><label>Montée prévue à l’école — retour</label><input id="st_return_pickup" type="time" value="'+G10.esc(d.return_pickup_planned||"")+'"></div>'+
    '<div><label>Arrivée prévue à l’arrêt — retour</label><input id="st_return_arrival" type="time" value="'+G10.esc(d.return_arrival_planned||"")+'"></div>'+
    '<div><label>Bus</label><select id="st_bus">'+busOptions(d.bus_id)+'</select></div>'+
    '<div><label>Abonnement mensuel</label><input id="st_amount" type="number" min="0" value="'+Number(d.monthly_amount||60000)+'"></div>'+
    '<div><label>Statut abonnement</label><select id="st_status">'+studentStatusOptions(d.status)+'</select></div>'+
    '</div><div class="actions"><button class="btn green" onclick="saveStudent()">'+(e?"Enregistrer les modifications":"Ajouter l’abonné")+'</button>'+(e?'<button class="btn light" onclick="cancelStudentEdit()">Annuler</button>':'')+'</div></div>';
  html+='<h4 style="margin:20px 0 10px">Liste des abonnés</h4>';
  if(!G10.snapshot.students.length)html+='<div class="empty">Aucun élève enregistré. Saisie manuelle ou import Excel possible.</div>';
  else{
    html+='<div class="tableWrap"><table class="schoolTable"><thead><tr><th>Élève</th><th>Parent</th><th>Zone</th><th>Arrêt G10</th><th>Établissement</th><th>Bus</th><th>Mensuel</th><th>Statut</th><th>Actions</th></tr></thead><tbody>';
    html+=G10.snapshot.students.map(s=>'<tr><td><b>'+G10.esc(s.name)+'</b></td><td>'+G10.esc(s.guardian_name||"—")+'<br><small>'+G10.esc(s.guardian_phone||"")+'</small></td><td>'+G10.esc(s.zone||"—")+'</td><td>'+G10.esc(s.pickup||"—")+'</td><td>'+G10.esc(s.school||"—")+'</td><td>'+(s.bus_id?"Bus "+s.bus_id:"—")+'</td><td>'+G10.money(s.monthly_amount)+'</td><td>'+G10.badge(s.status)+'</td><td><div class="studentActions"><button class="btn light" onclick="editStudent('+s.id+')">Éditer</button><button class="btn orange" onclick="deleteStudent('+s.id+')">Supprimer</button></div></td></tr>').join("");
    html+='</tbody></table></div>';
  }
  $("#adminContent").innerHTML=html;
}
window.studentZoneChanged=()=>{const z=G10.zoneFor(Number($("#st_zone").value));$("#st_pickup").innerHTML=pickupOptions(z?.name||"","");$("#st_school").innerHTML=schoolOptions(z?.name||"","")};
window.saveStudent=async()=>{
  const z=G10.zoneFor(Number($("#st_zone").value));
  const body={action:editingStudentId?"UPDATE_STUDENT":"ADD_STUDENT",id:editingStudentId||undefined,name:$("#st_name").value.trim(),guardianName:$("#st_guardian").value.trim(),guardianPhone:$("#st_phone").value.trim(),guardianPin:editingStudentId?$("#st_guardian_pin").value.trim():($("#st_guardian_pin").value.trim()||"0000"),zone:z?.name||"",pickup:$("#st_pickup").value,school:$("#st_school").value,busId:Number($("#st_bus").value)||null,monthlyAmount:Number($("#st_amount").value)||60000,status:$("#st_status").value,morningPickupPlanned:$("#st_morning_pickup").value,schoolStartTime:$("#st_school_start").value,returnPickupPlanned:$("#st_return_pickup").value,returnArrivalPlanned:$("#st_return_arrival").value};
  if(!body.name)return G10.toast("Nom de l’élève requis.");
  try{await G10.api("/school-action",{method:"POST",body:JSON.stringify(body)});editingStudentId=null;await G10.loadState();G10.toast("Abonnement enregistré")}catch(e){G10.toast(e.message)}
};
window.editStudent=id=>{editingStudentId=id;renderAdminStudents();scrollTo(0,0)};
window.cancelStudentEdit=()=>{editingStudentId=null;renderAdminStudents()};
window.deleteStudent=async id=>{if(!confirm("Supprimer cet élève ?"))return;try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"DELETE_STUDENT",id})});await G10.loadState();G10.toast("Élève supprimé")}catch(e){G10.toast(e.message)}};

function fareBy(stopId,destId){return G10.snapshot.fares.find(f=>Number(f.stop_id)===Number(stopId)&&Number(f.destination_id)===Number(destId))}
window.setFareZone=id=>{selectedFareZoneId=Number(id);renderAdminFares()};
function renderAdminFares(){
  const zones=G10.snapshot.zones.filter(z=>z.active!==false);
  if(!selectedFareZoneId&&zones[0])selectedFareZoneId=Number(zones[0].id);
  const z=G10.zoneFor(selectedFareZoneId),stops=G10.stopsForZone(selectedFareZoneId),dests=G10.destinationsForZone(selectedFareZoneId);
  let html='<div class="panelHead"><div><h4>Tarifs journaliers — élèves non abonnés</h4><p class="muted">Chaque combinaison arrêt G10 × établissement est déjà créée. Tu ne changes que les prix.</p></div><select onchange="setFareZone(this.value)" style="max-width:220px">'+zones.map(x=>'<option value="'+x.id+'" '+(x.id===selectedFareZoneId?"selected":"")+'>'+G10.esc(x.name)+'</option>').join("")+'</select></div>';
  html+='<div class="callout"><b>Valeur de départ :</b> 1 500 FCFA. Si G10 décide que le siège coûte le même prix quelle que soit la destination, tu peux laisser toute la grille à 1 500 FCFA.</div>';
  if(stops.length&&dests.length){
    html+='<div class="fareMatrixWrap" style="margin-top:12px"><table class="fareMatrix"><thead><tr><th>Arrêt '+G10.esc(z?.name||"")+'</th>'+dests.map(d=>'<th>'+G10.esc(d.name)+'</th>').join("")+'</tr></thead><tbody>';
    html+=stops.map(st=>'<tr><td>'+G10.esc(st.name)+'</td>'+dests.map(d=>{const f=fareBy(st.id,d.id);return'<td><input data-fare-id="'+(f?.id||"")+'" type="number" min="0" value="'+Number(f?.daily_amount||1500)+'"></td>'}).join("")+'</tr>').join("");
    html+='</tbody></table></div><div class="actions"><button class="btn green" onclick="saveFareMatrix()">Enregistrer toute la grille '+G10.esc(z?.name||"")+'</button></div>';
  }else html+='<div class="empty">Ajoute d’abord des arrêts et établissements.</div>';
  $("#adminContent").innerHTML=html;
}
window.saveFareMatrix=async()=>{const fares=$$("[data-fare-id]").map(i=>({id:Number(i.dataset.fareId),dailyAmount:Number(i.value)||1500})).filter(x=>x.id);try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SAVE_FARES_BULK",fares})});await G10.loadState();G10.toast("Grille tarifaire enregistrée")}catch(e){G10.toast(e.message)}};

window.setRouteZone=id=>{selectedRouteZoneId=Number(id);renderAdminRoutes()};
function renderAdminRoutes(){
  const zones=G10.snapshot.zones.filter(z=>z.active!==false);
  if(!selectedRouteZoneId&&zones[0])selectedRouteZoneId=Number(zones[0].id);
  const z=G10.zoneFor(selectedRouteZoneId);
  const stops=G10.stopsForZone(selectedRouteZoneId);
  const reverse=[...stops].reverse();
  const zoneDests=G10.destinationsForZone(selectedRouteZoneId);
  const reverseDests=[...zoneDests].reverse();
  const linked=new Set(zoneDests.map(d=>Number(d.id)));
  const unlinked=G10.snapshot.destinations.filter(d=>d.active!==false&&!linked.has(Number(d.id)));

  let html='<div class="grid2"><div class="miniCard"><div class="panelHead"><div><h4>Zones scolaires</h4><p class="muted">Choisis une zone : les arrêts, établissements, tarifs et listes chauffeur seront filtrés sur cette zone.</p></div></div><div class="schoolRow2"><div><label>Nouvelle zone</label><input id="newZoneName" placeholder="Ex. Akanda Nord"></div><div class="actions" style="align-items:end"><button class="btn green" onclick="saveNewZone()">Ajouter zone</button><button class="btn orange" onclick="deleteZone('+selectedRouteZoneId+')">Supprimer zone sélectionnée</button></div></div><div class="routeList" style="margin-top:12px">'+zones.map(x=>'<button class="btn '+(x.id===selectedRouteZoneId?"green":"light")+'" onclick="setRouteZone('+x.id+')">'+G10.esc(x.name)+'</button>').join("")+'</div></div>';

  html+='<div class="miniCard"><h4>Établissements desservis — '+G10.esc(z?.name||"")+'</h4><p class="muted">Seuls ces établissements apparaîtront pour un abonnement, les tarifs et l’espace chauffeur de cette zone. Un même établissement peut être associé à plusieurs zones.</p>'+
    '<div class="routeEditor">'+(zoneDests.length?zoneDests.map((d,i)=>'<div class="routeStopItem"><div class="routeStopOrder">'+(i+1)+'</div><b>'+G10.esc(d.name)+'</b><div class="routeStopBtns"><button class="btn light" '+(i===0?"disabled":"")+' onclick="moveDestination('+d.id+',-1)">↑</button><button class="btn light" '+(i===zoneDests.length-1?"disabled":"")+' onclick="moveDestination('+d.id+',1)">↓</button><button class="btn orange" onclick="removeDestinationFromZone('+d.id+')">Retirer de '+G10.esc(z?.name||"")+'</button></div></div>').join(""):'<div class="empty">Aucun établissement associé à cette zone.</div>')+'</div>'+
    '<div class="schoolRow2" style="margin-top:12px"><div><label>Nouvel établissement pour '+G10.esc(z?.name||"")+'</label><input id="newDestinationName" placeholder="Nom établissement"></div><div class="actions" style="align-items:end"><button class="btn green" onclick="saveDestination()">Ajouter à '+G10.esc(z?.name||"")+'</button></div></div>'+
    (unlinked.length?'<div class="schoolRow2" style="margin-top:10px"><div><label>Associer un établissement existant</label><select id="existingDestination"><option value="">-- Choisir --</option>'+unlinked.map(d=>'<option value="'+d.id+'">'+G10.esc(d.name)+'</option>').join("")+'</select></div><div class="actions" style="align-items:end"><button class="btn light" onclick="associateExistingDestination()">Associer à '+G10.esc(z?.name||"")+'</button></div></div>':'')+
    '</div></div>';

  html+='<div class="miniCard" style="margin-top:12px"><div class="panelHead"><div><h4>Ordre des arrêts — '+G10.esc(z?.name||"")+' matin</h4><p class="muted">Déplace les arrêts avec ↑ et ↓. Le retour reprend automatiquement l’ordre inverse.</p></div></div><div class="routeEditor">'+stops.map((s,i)=>'<div class="routeStopItem"><div class="routeStopOrder">'+(i+1)+'</div><input id="stopName_'+s.id+'" value="'+G10.esc(s.name)+'"><div class="routeStopBtns"><button class="btn light" '+(i===0?"disabled":"")+' onclick="moveStop('+s.id+',-1)">↑</button><button class="btn light" '+(i===stops.length-1?"disabled":"")+' onclick="moveStop('+s.id+',1)">↓</button><button class="btn green" onclick="renameStop('+s.id+')">Enregistrer</button><button class="btn orange" onclick="deleteStop('+s.id+')">Supprimer</button></div></div>').join("")+'</div><div class="schoolRow2" style="margin-top:12px"><div><label>Ajouter un point d’arrêt</label><input id="newStopName" placeholder="Nouvel arrêt G10"></div><div class="actions" style="align-items:end"><button class="btn green" onclick="addStop()">Ajouter arrêt</button></div></div></div>';

  html+='<div class="grid2" style="margin-top:12px"><div class="miniCard"><h4>Ramassage matin — '+G10.esc(z?.name||"")+'</h4><div class="routeSequence">'+stops.map((s,i)=>'<span>'+G10.esc(s.name)+'</span>'+(i<stops.length-1?'<b>→</b>':'')).join("")+'</div></div><div class="miniCard"><h4>Dépose matin — établissements</h4><div class="routeSequence">'+zoneDests.map((d,i)=>'<span>'+G10.esc(d.name)+'</span>'+(i<zoneDests.length-1?'<b>→</b>':'')).join("")+'</div></div></div>';
  html+='<div class="grid2" style="margin-top:12px"><div class="miniCard"><h4>Ramassage retour — établissements</h4><div class="routeSequence">'+reverseDests.map((d,i)=>'<span>'+G10.esc(d.name)+'</span>'+(i<reverseDests.length-1?'<b>→</b>':'')).join("")+'</div></div><div class="miniCard"><h4>Dépose retour — arrêts</h4><div class="routeSequence">'+reverse.map((s,i)=>'<span>'+G10.esc(s.name)+'</span>'+(i<reverse.length-1?'<b>→</b>':'')).join("")+'</div></div></div>';

  if(z?.name==="Owendo")html+='<div class="routeWarn" style="margin-top:12px"><b>Owendo :</b> les éléments de démonstration restent modifiables jusqu’à confirmation opérationnelle du circuit.</div>';
  $("#adminContent").innerHTML=html;
}
window.saveNewZone=async()=>{const name=$("#newZoneName").value.trim();if(!name)return;try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SAVE_ZONE",name})});await G10.loadState();G10.toast("Zone ajoutée")}catch(e){G10.toast(e.message)}};
window.deleteZone=async id=>{if(!confirm("Retirer cette zone ?"))return;try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"DELETE_ZONE",id})});selectedRouteZoneId=null;await G10.loadState();G10.toast("Zone retirée")}catch(e){G10.toast(e.message)}};
window.addStop=async()=>{const name=$("#newStopName").value.trim();if(!name)return;try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SAVE_STOP",zoneId:selectedRouteZoneId,name})});await G10.loadState();G10.toast("Arrêt ajouté")}catch(e){G10.toast(e.message)}};
window.renameStop=async id=>{const name=$("#stopName_"+id).value.trim();try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SAVE_STOP",id,zoneId:selectedRouteZoneId,name})});await G10.loadState();G10.toast("Arrêt modifié")}catch(e){G10.toast(e.message)}};
window.deleteStop=async id=>{if(!confirm("Supprimer cet arrêt ?"))return;try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"DELETE_STOP",id})});await G10.loadState();G10.toast("Arrêt supprimé")}catch(e){G10.toast(e.message)}};
window.moveStop=async(id,delta)=>{const ids=G10.stopsForZone(selectedRouteZoneId).map(s=>Number(s.id)),i=ids.indexOf(Number(id)),j=i+Number(delta);if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"REORDER_STOPS",zoneId:selectedRouteZoneId,stopIds:ids})});await G10.loadState()}catch(e){G10.toast(e.message)}};
window.saveDestination=async()=>{
  const name=$("#newDestinationName").value.trim();if(!name)return;
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SAVE_DESTINATION",name,zoneId:selectedRouteZoneId,demoZone:G10.zoneFor(selectedRouteZoneId)?.name||""})});
    await G10.loadState();G10.toast("Établissement ajouté à "+(G10.zoneFor(selectedRouteZoneId)?.name||"la zone"));
  }catch(e){G10.toast(e.message)}
};
window.associateExistingDestination=async()=>{
  const destinationId=Number($("#existingDestination")?.value||0);if(!destinationId)return G10.toast("Choisis un établissement.");
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"ASSOCIATE_DESTINATION",destinationId,zoneId:selectedRouteZoneId})});
    await G10.loadState();G10.toast("Établissement associé à la zone");
  }catch(e){G10.toast(e.message)}
};
window.removeDestinationFromZone=async destinationId=>{
  const z=G10.zoneFor(selectedRouteZoneId);
  if(!confirm("Retirer cet établissement de la zone "+(z?.name||"")+" ?"))return;
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"REMOVE_DESTINATION_ZONE",destinationId,zoneId:selectedRouteZoneId})});
    await G10.loadState();G10.toast("Établissement retiré de "+(z?.name||"la zone"));
  }catch(e){G10.toast(e.message)}
};
window.moveDestination=async(destinationId,delta)=>{
  const ids=G10.destinationsForZone(selectedRouteZoneId).map(d=>Number(d.id)),i=ids.indexOf(Number(destinationId)),j=i+Number(delta);
  if(i<0||j<0||j>=ids.length)return;
  [ids[i],ids[j]]=[ids[j],ids[i]];
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"REORDER_DESTINATIONS",zoneId:selectedRouteZoneId,destinationIds:ids})});
    await G10.loadState();
  }catch(e){G10.toast(e.message)}
};
window.deleteDestination=async id=>{if(!confirm("Supprimer complètement cet établissement de toutes les zones ?"))return;try{await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"DELETE_DESTINATION",id})});await G10.loadState();G10.toast("Établissement supprimé")}catch(e){G10.toast(e.message)}};

function renderAdminBuses(){
  const active=G10.snapshot.buses.filter(b=>b.active!==false);
  const removed=G10.snapshot.buses.filter(b=>b.active===false);
  let html='<div class="panelHead"><div class="callout" style="flex:1"><b>Rôle Administration :</b> créer le bus, saisir sa plaque et sa capacité. La zone, le chauffeur et les horaires sont affectés ensuite par le Chef d’exploitation.</div><button class="btn green" onclick="addBus()">+ Ajouter un bus</button></div><div class="grid2" style="margin-top:12px">';
  html+=active.map(b=>'<div class="miniCard '+G10.busTone(b.id)+'"><div class="panelHead"><div><h4>'+G10.esc(b.label)+'</h4><p class="muted">Bus scolaire '+b.id+'</p></div><span class="badge '+G10.busChip(b.id)+'">Bus '+b.id+'</span></div><div class="studentForm"><div><label>Nom du bus</label><input id="bus_label_'+b.id+'" value="'+G10.esc(b.label)+'"></div><div><label>Plaque / immatriculation</label><input id="bus_plate_'+b.id+'" value="'+G10.esc(b.plate||"")+'" placeholder="À renseigner"></div><div><label>Capacité</label><input id="bus_capacity_'+b.id+'" type="number" min="1" value="'+Number(b.capacity||23)+'"></div><div><label>Statut</label><select id="bus_active_'+b.id+'"><option value="1" selected>Actif</option><option value="0">Inactif</option></select></div></div><div class="actions"><button class="btn green" onclick="saveBus('+b.id+')">Enregistrer</button><button class="btn orange" onclick="deleteBus('+b.id+')">Supprimer le bus</button></div></div>').join("");
  html+='</div>';
  if(removed.length) html+='<div class="callout" style="margin-top:12px"><b>Bus retirés :</b> '+removed.map(b=>G10.esc(b.label)).join(" • ")+' — ils restent dans l’historique mais ne sont plus proposés à l’exploitation.</div>';
  $("#adminContent").innerHTML=html;
}
window.addBus=async()=>{try{const out=await G10.api("/admin-save",{method:"POST",body:JSON.stringify({action:"ADD_BUS"})});await G10.loadState();G10.toast("Bus "+out.id+" ajouté")}catch(e){G10.toast(e.message)}};
window.saveBus=async id=>{const body={action:"SAVE_BUS",id,label:$("#bus_label_"+id).value.trim(),plate:$("#bus_plate_"+id).value.trim(),capacity:Number($("#bus_capacity_"+id).value)||23,active:$("#bus_active_"+id).value==="1"};try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify(body)});await G10.loadState();G10.toast("Bus enregistré")}catch(e){G10.toast(e.message)}};
window.deleteBus=async id=>{if(!confirm("Supprimer ce bus de l’exploitation scolaire ? Son historique sera conservé."))return;try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify({action:"DELETE_BUS",id})});await G10.loadState();G10.toast("Bus retiré")}catch(e){G10.toast(e.message)}};