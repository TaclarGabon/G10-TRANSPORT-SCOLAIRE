let opTab="assign";
window.setOpTab=tab=>{opTab=tab;renderOperations()};
G10.renderers.operations=renderOperations;

function activeBuses(){return G10.snapshot.buses.filter(b=>b.active!==false)}
function renderOperations(){
  ["Assign","Plan","Follow","Warnings"].forEach(x=>{const b=$("#opTab"+x);if(b)b.classList.toggle("active",opTab===x.toLowerCase())});
  if(opTab==="assign")renderOpAssign();
  if(opTab==="plan")renderOpPlan();
  if(opTab==="follow")renderOpFollow();
  if(opTab==="warnings")renderOpWarnings();
}
function driverOptions(selected){
  return '<option value="">-- Choisir chauffeur --</option>'+G10.activeDrivers().map(d=>'<option value="'+d.id+'" '+(Number(d.id)===Number(selected)?"selected":"")+'>'+G10.esc(d.name)+'</option>').join("");
}
function zoneOptions(selected){
  return '<option value="">-- Choisir zone --</option>'+G10.snapshot.zones.filter(z=>z.active!==false).map(z=>'<option value="'+z.id+'" '+(Number(z.id)===Number(selected)?"selected":"")+'>'+G10.esc(z.name)+'</option>').join("");
}
function scheduleValue(v){return /^\d{2}:\d{2}$/.test(String(v||""))?v:""}

function renderOpAssign(){
  let html='<div class="callout"><b>Assignation :</b> choisis seulement le chauffeur et la zone de chaque bus. Les horaires matin/retour se règlent dans l’onglet “Circuits & horaires”.</div><div class="grid2" style="margin-top:12px">';
  html+=activeBuses().map(b=>{
    const r=G10.runFor(b.id)||{};
    return '<div class="assignSchoolCard '+G10.busTone(b.id)+'"><div class="assignSchoolHead"><div><h4>'+G10.esc(b.label)+' '+(b.plate?"• "+G10.esc(b.plate):"• plaque à renseigner")+'</h4><span class="muted">'+b.capacity+' places</span></div>'+G10.badge(r.status)+'</div>'+
      '<div class="schoolRow2" style="margin-top:10px">'+
        '<div><label>Chauffeur</label><select id="op_driver_'+b.id+'">'+driverOptions(r.driver_id)+'</select></div>'+
        '<div><label>Zone</label><select id="op_zone_'+b.id+'">'+zoneOptions(r.zone_id)+'</select></div>'+
      '</div><div class="actions"><button class="btn green" onclick="saveAssignment('+b.id+')">Enregistrer l’affectation</button><button class="btn light" onclick="clearAssignment('+b.id+')">Désaffecter</button></div></div>';
  }).join("");
  html+='</div>';
  $("#opContent").innerHTML=html;
}
window.saveAssignment=async busId=>{
  const driverId=Number($("#op_driver_"+busId).value)||null;
  const zoneId=Number($("#op_zone_"+busId).value)||null;
  const r=G10.runFor(busId)||{};
  if(!driverId)return G10.toast("Choisis un chauffeur dans le déroulant.");
  if(!zoneId)return G10.toast("Choisis une zone.");
  const body={
    action:"SAVE_ASSIGNMENT",busId,driverId,zoneId,
    morningDeparturePlanned:r.morning_departure_planned||"06:30",
    morningArrivalPlanned:r.morning_arrival_planned||"08:00",
    returnDeparturePlanned:r.return_departure_planned||"15:00",
    returnArrivalPlanned:r.return_arrival_planned||"18:30"
  };
  try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify(body)});await G10.loadState();G10.toast("Affectation enregistrée")}catch(e){G10.toast(e.message)}
};
window.clearAssignment=async busId=>{try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify({action:"DELETE_ASSIGNMENT",busId})});await G10.loadState();G10.toast("Bus désaffecté")}catch(e){G10.toast(e.message)}};

function renderOpPlan(){
  let html='<div class="callout"><b>Horaires :</b> on sépare volontairement le matin et le retour pour éviter toute confusion. “Arrivée établissements” concerne le trajet du matin; “Fin du retour” concerne le trajet de l’après-midi/soir.</div><div class="grid2" style="margin-top:12px">';
  html+=activeBuses().map(b=>{
    const r=G10.runFor(b.id)||{},z=G10.zoneFor(r.zone_id),stops=G10.stopsForZone(r.zone_id);
    return '<div class="miniCard '+G10.busTone(b.id)+'"><div class="panelHead"><div><h4>'+G10.esc(b.label)+' '+(b.plate?"• "+G10.esc(b.plate):"")+'</h4><p class="muted">'+G10.esc(z?.name||"Zone non affectée")+'</p></div>'+G10.badge(r.status)+'</div>'+
      '<h4 style="margin-top:14px">Trajet du matin</h4><div class="schoolRow2">'+
        '<div><label>Départ circuit matin prévu</label><input id="mdep_'+b.id+'" type="time" value="'+scheduleValue(r.morning_departure_planned)+'"></div>'+
        '<div><label>Arrivée établissements prévue</label><input id="marr_'+b.id+'" type="time" value="'+scheduleValue(r.morning_arrival_planned)+'"></div>'+
      '</div>'+
      '<h4 style="margin-top:14px">Trajet retour</h4><div class="schoolRow2">'+
        '<div><label>Départ des établissements prévu</label><input id="rdep_'+b.id+'" type="time" value="'+scheduleValue(r.return_departure_planned)+'"></div>'+
        '<div><label>Fin du retour prévue</label><input id="rarr_'+b.id+'" type="time" value="'+scheduleValue(r.return_arrival_planned)+'"></div>'+
      '</div>'+
      '<div class="actions"><button class="btn green" onclick="saveBusSchedule('+b.id+')">Enregistrer les horaires</button></div>'+
      '<div style="margin-top:12px">'+(stops.length?'<b>Circuit matin</b><div class="routeSequence" style="margin-top:8px">'+stops.map((s,i)=>'<span>'+G10.esc(s.name)+'</span>'+(i<stops.length-1?'<b>→</b>':'')).join("")+'</div>':'<div class="empty">Aucune zone / aucun arrêt affecté.</div>')+'</div></div>';
  }).join("");
  html+='</div>';
  $("#opContent").innerHTML=html;
}
window.saveBusSchedule=async busId=>{
  const r=G10.runFor(busId)||{};
  if(!r.driver_id||!r.zone_id)return G10.toast("Affecte d’abord un chauffeur et une zone à ce bus.");
  const body={
    action:"SAVE_ASSIGNMENT",busId,driverId:Number(r.driver_id),zoneId:Number(r.zone_id),
    morningDeparturePlanned:$("#mdep_"+busId).value,
    morningArrivalPlanned:$("#marr_"+busId).value,
    returnDeparturePlanned:$("#rdep_"+busId).value,
    returnArrivalPlanned:$("#rarr_"+busId).value
  };
  try{await G10.api("/admin-save",{method:"POST",body:JSON.stringify(body)});await G10.loadState();G10.toast("Horaires enregistrés")}catch(e){G10.toast(e.message)}
};

function legTimes(r){
  const leg=r.current_leg||"MATIN";
  if(leg==="RETOUR") return {
    p1:r.return_departure_planned,a1:r.return_departed_at,
    p2:r.return_arrival_planned,a2:r.return_arrived_at,
    l1:"Départ établissements",l2:"Fin du retour"
  };
  return {
    p1:r.morning_departure_planned,a1:r.morning_departed_at,
    p2:r.morning_arrival_planned,a2:r.morning_arrived_at,
    l1:"Départ circuit matin",l2:"Arrivée établissements"
  };
}
G10.busLiveCard=function(b){
  const r=G10.runFor(b.id)||{},d=G10.driverFor(r.driver_id),z=G10.zoneFor(r.zone_id),leg=r.current_leg||"MATIN",t=legTimes(r);
  const expected=G10.studentsForBus(b.id).length;
  const subOn=G10.subscriberBoardedCount(b.id,leg);
  const nonOn=G10.dailyOnboardCount(b.id,leg);
  return '<div class="busCard '+G10.busTone(b.id)+'"><div class="panelHead"><div><h4>'+G10.esc(b.label)+' '+(b.plate?"• "+G10.esc(b.plate):"")+'</h4><p class="muted">'+G10.esc(z?.name||"Zone non affectée")+' • '+G10.esc(leg)+'</p></div>'+G10.badge(r.status)+'</div>'+
    '<div class="schoolGrid4">'+
      '<div class="stat schoolKpi"><span>Chauffeur</span><strong style="font-size:15px">'+G10.esc(d?.name||"—")+'</strong></div>'+
      '<div class="stat schoolKpi"><span>360°</span><strong style="font-size:15px">'+(G10.is360Ok(r)?"Validé":"À faire")+'</strong></div>'+
      '<div class="stat schoolKpi"><span>Abonnés attendus / montés</span><strong>'+expected+' / '+subOn+'</strong></div>'+
      '<div class="stat schoolKpi"><span>Non-abonnés à bord</span><strong>'+nonOn+'</strong></div>'+
    '</div>'+
    '<div class="scheduleGrid" style="margin-top:10px">'+
      '<div class="scheduleBox"><span>'+t.l1+' prévu</span><b>'+G10.esc(t.p1||"—")+'</b></div>'+
      '<div class="scheduleBox"><span>'+t.l1+' réel</span><b>'+G10.fmtTime(t.a1)+'</b><small>'+G10.varianceText(t.p1,t.a1)+'</small></div>'+
      '<div class="scheduleBox"><span>'+t.l2+' prévue</span><b>'+G10.esc(t.p2||"—")+'</b></div>'+
      '<div class="scheduleBox"><span>'+t.l2+' réelle</span><b>'+G10.fmtTime(t.a2)+'</b><small>'+G10.varianceText(t.p2,t.a2)+'</small></div>'+
    '</div>'+
    '<p class="muted" style="margin-top:10px"><b>Dernier point connu :</b> '+G10.esc(r.current_location_label||G10.stopFor(r.current_stop_id)?.name||"Pas encore de pointage")+' • Absents abonnés : '+G10.subscriberAbsentCount(b.id,leg)+' • Recette cash du jour : '+G10.money(G10.dailyRevenue(b.id))+'</p></div>';
};
function renderOpFollow(){$("#opContent").innerHTML='<div class="grid2">'+activeBuses().map(G10.busLiveCard).join("")+'</div>'}

function warningStatusOptions(current){
  return '<option value="A_VERIFIER" '+(current==="A_VERIFIER"?"selected":"")+'>À vérifier</option>'+
    '<option value="CONFIRMEE" '+(current==="CONFIRMEE"?"selected":"")+'>Confirmée</option>'+
    '<option value="CLASSEE" '+(current==="CLASSEE"?"selected":"")+'>Classée</option>';
}
function renderOpWarnings(){
  const drivers=G10.snapshot.drivers.filter(d=>String(d.name||"").trim());
  const today=new Date().toISOString().slice(0,10);
  let html='<div class="miniCard"><div class="panelHead"><div><h4>Avertissements chauffeurs</h4><p class="muted">Une plainte est d’abord À vérifier. Seules les plaintes confirmées alimentent le niveau disciplinaire. Aucune mise à pied n’est automatique.</p></div></div>'+
    '<div class="studentForm">'+
      '<div><label>Chauffeur</label><select id="warn_driver"><option value="">-- Choisir --</option>'+drivers.map(d=>'<option value="'+d.id+'">'+G10.esc(d.name)+'</option>').join("")+'</select></div>'+
      '<div><label>Date</label><input id="warn_date" type="date" value="'+today+'"></div>'+
      '<div><label>Motif</label><input id="warn_reason" placeholder="Ex. plainte client, conduite, procédure"></div>'+
      '<div><label>Enregistré par</label><input id="warn_by" placeholder="Nom / Chef d’exploitation"></div>'+
      '<div style="grid-column:1/-1"><label>Détails</label><textarea id="warn_details" rows="3" placeholder="Détails factuels de la plainte"></textarea></div>'+
      '<div><label>Statut</label><select id="warn_status">'+warningStatusOptions("A_VERIFIER")+'</select></div>'+
    '</div><div class="actions"><button class="btn green" onclick="addDriverWarning()">Enregistrer la plainte</button></div></div>';

  html+='<div class="grid2" style="margin-top:12px">'+drivers.map(d=>{
    const level=G10.warningLevel(d.id);
    const rows=G10.warningsForDriver(d.id);
    return '<div class="miniCard"><div class="panelHead"><div><h4>'+G10.esc(d.name)+'</h4><p class="muted">'+level.icon+' '+G10.esc(level.label)+'</p></div><span class="badge '+(level.count===0?"greenbg":level.count===1?"yellowbg":level.count===2?"orangebg":"redbg")+'">'+level.count+' confirmé(s)</span></div>'+
      (rows.length?'<div class="tableWrap"><table class="schoolTable"><thead><tr><th>Date</th><th>Motif</th><th>Détails</th><th>Par</th><th>Statut</th><th>Prise de connaissance</th></tr></thead><tbody>'+
      rows.map(w=>'<tr><td>'+G10.esc(w.complaint_date||"")+'</td><td><b>'+G10.esc(w.reason)+'</b></td><td>'+G10.esc(w.details||"—")+'</td><td>'+G10.esc(w.recorded_by||"—")+'</td><td><select onchange="updateDriverWarning('+w.id+',this.value)">'+warningStatusOptions(w.status)+'</select></td><td>'+(w.acknowledged_at?G10.fmtTime(w.acknowledged_at):"—")+'</td></tr>').join("")+
      '</tbody></table></div>':'<div class="empty">Aucune plainte enregistrée.</div>')+
      (level.count>=3?'<div class="routeWarn" style="margin-top:10px"><b>Décision Direction requise.</b> Le système ne suspend ni ne licencie automatiquement le chauffeur.</div>':'')+
      '</div>';
  }).join("")+'</div>';
  $("#opContent").innerHTML=html;
}
window.addDriverWarning=async()=>{
  const body={action:"ADD_WARNING",driverId:Number($("#warn_driver").value),date:$("#warn_date").value,reason:$("#warn_reason").value.trim(),details:$("#warn_details").value.trim(),recordedBy:$("#warn_by").value.trim(),status:$("#warn_status").value};
  if(!body.driverId||!body.reason)return G10.toast("Choisis un chauffeur et indique le motif.");
  try{await G10.managementAction("operations",body);await G10.loadState();G10.toast("Plainte enregistrée")}catch(e){G10.toast(e.message)}
};
window.updateDriverWarning=async(id,status)=>{
  try{await G10.managementAction("operations",{action:"UPDATE_WARNING",id,status});await G10.loadState();G10.toast("Statut mis à jour")}catch(e){G10.toast(e.message)}
};