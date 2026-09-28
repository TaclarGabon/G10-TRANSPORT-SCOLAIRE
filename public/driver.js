G10.renderers.driver=renderDriver;

function legPlan(run){
  const leg=run.current_leg||"MATIN";
  if(leg==="RETOUR"){
    return {
      leg,
      startLabel:"Départ des établissements",
      endLabel:"Fin du retour",
      plannedStart:run.return_departure_planned,
      plannedEnd:run.return_arrival_planned,
      actualStart:run.return_departed_at,
      actualEnd:run.return_arrived_at
    };
  }
  return {
    leg,
    startLabel:"Départ circuit matin",
    endLabel:"Arrivée aux établissements",
    plannedStart:run.morning_departure_planned,
    plannedEnd:run.morning_arrival_planned,
    actualStart:run.morning_departed_at,
    actualEnd:run.morning_arrived_at
  };
}
function currentClosure(busId){
  return (G10.snapshot.cashClosures||[]).find(c=>Number(c.bus_id)===Number(busId));
}
function dailyFareFor(stopId,destId){
  const f=G10.snapshot.fares.find(x=>Number(x.stop_id)===Number(stopId)&&Number(x.destination_id)===Number(destId));
  return Number(f?.daily_amount||1500);
}
function subscriberState(student,leg){
  const br=G10.boardingFor(student.id,leg);
  if(student.absence_today&&leg==="MATIN")return "ABSENT";
  return br?.status||"ATTENDU";
}
function subscriberPickupLine(student,leg){
  const br=G10.boardingFor(student.id,leg);
  const state=subscriberState(student,leg);
  const time=state==="MONTE"?G10.fmtTime(br?.boarded_at):"";
  return '<div class="subRow"><div><b>'+G10.esc(student.name)+'</b><div class="subMeta">'+
    G10.esc(student.school||"")+' • '+G10.esc(G10.statusLabel(state))+(time?" • "+time:"")+
    '</div></div><div class="boardingBtns">'+
    '<button class="btn green" onclick="setBoarding('+student.id+',\'MONTE\')">Monté</button>'+
    '<button class="btn orange" onclick="setBoarding('+student.id+',\'ABSENT\')">Absent</button>'+
    '</div></div>';
}
function rideCount(busId,leg,stopId,destId){
  return G10.snapshot.dailyRides.filter(r=>
    Number(r.bus_id)===Number(busId)&&r.leg===leg&&Number(r.stop_id)===Number(stopId)&&Number(r.destination_id)===Number(destId)&&r.status==="MONTE"
  ).length;
}
function latestRide(busId,leg,stopId,destId){
  return G10.snapshot.dailyRides
    .filter(r=>Number(r.bus_id)===Number(busId)&&r.leg===leg&&Number(r.stop_id)===Number(stopId)&&Number(r.destination_id)===Number(destId)&&r.status==="MONTE")
    .sort((a,b)=>Number(b.id)-Number(a.id))[0]||null;
}
function cashTile(busId,leg,stopId,destId,label,locationLabel){
  const count=rideCount(busId,leg,stopId,destId);
  const last=latestRide(busId,leg,stopId,destId);
  const price=dailyFareFor(stopId,destId);
  return '<div class="cashTileGroup"><strong>'+G10.esc(label)+'</strong><span>'+G10.money(price)+'</span><small>'+count+' actuellement à bord</small>'+
    '<div class="cashTileActions">'+
      '<button class="cashPlus" onclick="addDailyRide('+stopId+','+destId+',\''+String(locationLabel).replace(/'/g,"&#39;")+'\')">+ 1 élève</button>'+
      '<button class="cashMinus" '+(!last?"disabled":"")+' onclick="'+(last?'cancelDailyRide('+last.id+')':'')+'">−</button>'+
    '</div></div>';
}
function totalOnboardFor(busId,leg){
  return G10.subscriberBoardedCount(busId,leg)+G10.dailyOnboardCount(busId,leg);
}

function renderDriver(){
  if(!G10.driverSession){renderDriverLogin();return}
  const run=G10.runFor(G10.driverSession.busId);
  const bus=G10.busFor(G10.driverSession.busId);
  const driver=G10.driverFor(G10.driverSession.driverId);
  const zone=G10.zoneFor(run?.zone_id);
  if(!run||!bus||!driver){G10.driverSession=null;renderDriverLogin();return}

  const plan=legPlan(run),leg=plan.leg;
  const reserved=G10.studentsForBus(bus.id).length;
  const dailyMax=Math.max(0,Number(bus.capacity||0)-reserved);
  const dailyOn=G10.dailyOnboardCount(bus.id,leg);
  const subOn=G10.subscriberBoardedCount(bus.id,leg);
  const total=subOn+dailyOn;
  const started=!!plan.actualStart;
  const ended=!!plan.actualEnd;

  let html='<div class="driverIdentity"><div><h4>Espace chauffeur — '+G10.esc(driver.name)+'</h4><p>'+
    G10.esc(bus.label)+' '+(bus.plate?"• "+G10.esc(bus.plate):"")+' • '+G10.esc(zone?.name||"Zone non affectée")+' • '+leg+
    '</p></div>'+G10.badge(run.status)+'</div>';

  const confirmedWarnings=G10.confirmedWarningsForDriver(driver.id);
  if(confirmedWarnings.length){
    html+='<div class="miniCard driverWarnings"><div class="panelHead"><div><h4>Avertissements confirmés</h4><p class="muted">“J’ai pris connaissance” confirme uniquement la lecture de l’avertissement. Cela ne signifie pas que tu acceptes la sanction ou les faits.</p></div></div>'+
      confirmedWarnings.map(w=>'<div class="warningRow"><div><b>'+G10.esc(w.reason)+'</b><br><small>'+G10.esc(w.complaint_date||"")+' • '+G10.esc(w.details||"")+'</small></div>'+
      (w.acknowledged_at?'<span class="badge greenbg">Lu '+G10.fmtTime(w.acknowledged_at)+'</span>':'<button class="btn orange" onclick="ackDriverWarning('+w.id+')">J’ai pris connaissance</button>')+
      '</div>').join("")+'</div>';
  }

  html+='<div class="miniCard"><div class="panelHead"><div><h4>Trajet '+(leg==="MATIN"?"du matin":"retour")+'</h4>'+
    '<p class="muted">Le chauffeur ne saisit pas les heures : les heures réelles se créent avec les boutons Départ et Arrivée.</p></div>'+
    '<select id="driverLeg" onchange="setDriverLeg(this.value)" style="max-width:190px"><option value="MATIN" '+(leg==="MATIN"?"selected":"")+'>Matin</option><option value="RETOUR" '+(leg==="RETOUR"?"selected":"")+'>Retour</option></select></div>'+
    '<div class="scheduleGrid">'+
      '<div class="scheduleBox"><span>'+plan.startLabel+' prévu</span><b>'+G10.esc(plan.plannedStart||"—")+'</b></div>'+
      '<div class="scheduleBox"><span>'+plan.startLabel+' réel</span><b>'+G10.fmtTime(plan.actualStart)+'</b><small>'+G10.varianceText(plan.plannedStart,plan.actualStart)+'</small></div>'+
      '<div class="scheduleBox"><span>'+plan.endLabel+' prévue</span><b>'+G10.esc(plan.plannedEnd||"—")+'</b></div>'+
      '<div class="scheduleBox"><span>'+plan.endLabel+' réelle</span><b>'+G10.fmtTime(plan.actualEnd)+'</b><small>'+G10.varianceText(plan.plannedEnd,plan.actualEnd)+'</small></div>'+
    '</div></div>';

  html+='<div class="miniCard"><div class="panelHead"><div><h4>1. Contrôle 360° obligatoire</h4>'+
    '<p class="muted">Une fois validé au début du service, il reste valable pour le trajet retour.</p></div><span class="badge bluebg">'+G10.checkedCount(run)+'/6</span></div>'+
    '<div class="schoolGrid3">'+["pneus","feux","huile","niveaux","tableau","dommages"].map(k=>
      '<label><input type="checkbox" data-check="'+k+'" '+(G10.checklistObj(run)[k]?"checked":"")+'> '+
      ({pneus:"Pneus / extérieur",feux:"Feux / clignotants",huile:"Huile moteur",niveaux:"Niveaux essentiels",tableau:"Voyants / tableau de bord",dommages:"Dommages / anomalies"}[k])+
      '</label>'
    ).join("")+'</div>'+
    '<div class="actions"><button class="btn light" onclick="save360()">Valider le 360°</button>'+
    '<button class="btn green" '+(!G10.is360Ok(run)||started?"disabled":"")+' onclick="driverStart()">DÉPART DU BUS</button></div></div>';

  html+='<div class="kpiStrip">'+
    '<div class="stat"><span>Capacité du bus</span><strong>'+bus.capacity+'</strong></div>'+
    '<div class="stat"><span>Places réservées abonnés</span><strong>'+reserved+'</strong></div>'+
    '<div class="stat"><span>Non-abonnés actuellement à bord</span><strong>'+dailyOn+' / '+dailyMax+'</strong></div>'+
    '<div class="stat"><span>Total actuellement à bord</span><strong>'+total+' / '+bus.capacity+'</strong></div>'+
    '</div>';

  if(!run.zone_id){
    html+='<div class="empty">Aucune zone n’a été affectée par le Chef d’exploitation.</div>';
  }else if(leg==="MATIN"){
    html+=renderMorningWorkflow(bus,run);
  }else{
    html+=renderReturnWorkflow(bus,run);
  }

  if(started&&!ended){
    if(total===0){
      html+='<div class="actions"><button class="btn green" onclick="driverFinish()">TERMINER LE TRAJET</button></div>';
    }else{
      html+='<div class="routeWarn" style="margin-top:12px"><b>Trajet non terminable :</b> '+total+' passager(s) sont encore enregistrés à bord. Utilise les boutons “Arrivé à …” avant de terminer.</div>';
    }
  }

  html+=renderCashClosure(bus,run);
  html+='<div class="actions"><button class="btn orange" onclick="driverLogout()">Déconnexion</button></div>';
  $("#driverContent").innerHTML=html;
  toggleCashTransferFields();
}

function renderDriverLogin(){
  const options='<option value="">-- Choisir chauffeur --</option>'+G10.activeDrivers().map(d=>'<option value="'+d.id+'">'+G10.esc(d.name)+'</option>').join("");
  $("#driverContent").innerHTML='<div class="miniCard"><h4>Connexion chauffeur</h4><p class="muted">Le chauffeur est créé par l’Administration puis affecté à un bus par le Chef d’exploitation.</p>'+
    '<div class="schoolRow2"><div><label>Chauffeur</label><select id="driverLoginSelect">'+options+'</select></div>'+
    '<div><label>Code chauffeur</label><input id="driverLoginPin" placeholder="Code"></div></div>'+
    '<div class="actions"><button class="btn green" onclick="driverLogin()">Se connecter</button></div></div>';
}

function renderMorningWorkflow(bus,run){
  const stops=G10.stopsForZone(run.zone_id);
  const destinations=G10.destinationsForZone(run.zone_id);
  let html='<div class="miniCard"><div class="panelHead"><div><h4>2. Ramassage matin — arrêts G10</h4>'+
    '<p class="muted">Abonné : Monté/Absent. Non-abonné : 1 pression sur + = 1 élève monté et le tarif encaissé.</p></div></div>';

  html+=stops.map(st=>{
    const subs=G10.studentsForBus(bus.id).filter(s=>s.pickup===st.name);
    const tiles=destinations.map(d=>cashTile(bus.id,"MATIN",st.id,d.id,d.name,st.name)).join("");
    return '<div class="stopCard"><div class="stopHead"><div><b>'+G10.esc(st.name)+'</b><div class="subMeta">'+subs.length+' abonné(s) attendu(s)</div></div>'+
      '<button class="btn light" onclick="passStop('+st.id+')">Passer cet arrêt</button></div>'+
      '<div style="margin-top:8px">'+(subs.length?subs.map(s=>subscriberPickupLine(s,"MATIN")).join(""):'<div class="muted">Aucun abonné attendu à cet arrêt.</div>')+'</div>'+
      '<div class="cashTiles">'+tiles+'</div></div>';
  }).join("");
  html+='</div>';

  html+='<div class="miniCard"><div class="panelHead"><div><h4>3. Arrivée aux établissements</h4>'+
    '<p class="muted">Un seul bouton par établissement. Il retire automatiquement du compteur tous les abonnés et non-abonnés dont c’est la destination.</p></div></div>';

  const cards=destinations.map(d=>{
    const subs=G10.studentsForBus(bus.id).filter(s=>s.school===d.name&&subscriberState(s,"MATIN")==="MONTE");
    const cash=G10.snapshot.dailyRides.filter(r=>Number(r.bus_id)===Number(bus.id)&&r.leg==="MATIN"&&Number(r.destination_id)===Number(d.id)&&r.status==="MONTE");
    const total=subs.length+cash.length;
    if(!total)return "";
    return '<div class="stopCard"><div class="stopHead"><div><b>'+G10.esc(d.name)+'</b><div class="subMeta">'+subs.length+' abonné(s) + '+cash.length+' non-abonné(s) à faire descendre</div></div></div>'+
      '<button class="arrivalBtn" onclick="arriveDestination('+d.id+')">ARRIVÉ À '+G10.esc(d.name).toUpperCase()+' — '+total+' descendent</button></div>';
  }).join("");
  html+=cards||'<div class="empty">Aucun passager actuellement en attente de dépose.</div>';
  html+='</div>';
  return html;
}

function renderReturnWorkflow(bus,run){
  const stops=[...G10.stopsForZone(run.zone_id)].reverse();
  const destinations=[...G10.destinationsForZone(run.zone_id)].reverse();
  let html='<div class="miniCard"><div class="panelHead"><div><h4>2. Ramassage retour — établissements</h4>'+
    '<p class="muted">Abonné : Monté/Absent à l’école. Non-abonné : touche directement l’arrêt de destination.</p></div></div>';

  html+=destinations.map(d=>{
    const subs=G10.studentsForBus(bus.id).filter(s=>s.school===d.name);
    const tiles=stops.map(st=>cashTile(bus.id,"RETOUR",st.id,d.id,st.name,d.name)).join("");
    if(!subs.length&&!tiles)return "";
    return '<div class="stopCard"><div class="stopHead"><div><b>'+G10.esc(d.name)+'</b><div class="subMeta">'+subs.length+' abonné(s) à récupérer</div></div></div>'+
      '<div style="margin-top:8px">'+(subs.length?subs.map(s=>subscriberPickupLine(s,"RETOUR")).join(""):'<div class="muted">Aucun abonné à cet établissement.</div>')+'</div>'+
      '<div class="cashTiles">'+tiles+'</div></div>';
  }).join("");
  html+='</div>';

  html+='<div class="miniCard"><div class="panelHead"><div><h4>3. Arrivée aux arrêts G10</h4>'+
    '<p class="muted">Un seul bouton par arrêt. Il retire automatiquement du compteur tous les passagers destinés à cet arrêt.</p></div></div>';

  const cards=stops.map(st=>{
    const subs=G10.studentsForBus(bus.id).filter(s=>s.pickup===st.name&&subscriberState(s,"RETOUR")==="MONTE");
    const cash=G10.snapshot.dailyRides.filter(r=>Number(r.bus_id)===Number(bus.id)&&r.leg==="RETOUR"&&Number(r.stop_id)===Number(st.id)&&r.status==="MONTE");
    const total=subs.length+cash.length;
    if(!total)return "";
    return '<div class="stopCard"><div class="stopHead"><div><b>'+G10.esc(st.name)+'</b><div class="subMeta">'+subs.length+' abonné(s) + '+cash.length+' non-abonné(s) à faire descendre</div></div></div>'+
      '<button class="arrivalBtn" onclick="arriveReturnStop('+st.id+')">ARRIVÉ À '+G10.esc(st.name).toUpperCase()+' — '+total+' descendent</button></div>';
  }).join("");
  html+=cards||'<div class="empty">Aucun passager actuellement en attente de dépose.</div>';
  html+='</div>';
  return html;
}

function renderCashClosure(bus,run){
  const expected=G10.dailyRevenue(bus.id);
  const closure=currentClosure(bus.id);
  const canClose=!!run.return_arrived_at;

  return '<div class="miniCard"><div class="panelHead"><div><h4>4. Fin de service — remise de la recette</h4>'+
    '<p class="muted">“Encaisser” se fait quand l’élève monte. Ici, on enregistre seulement où et comment la recette a été remise à G10.</p></div>'+
    (closure?'<span class="badge greenbg">Clôturée '+G10.fmtTime(closure.closed_at)+'</span>':'')+'</div>'+
    '<div class="schoolGrid3">'+
      '<div class="scheduleBox"><span>Recette cash attendue</span><b>'+G10.money(expected)+'</b></div>'+
      '<div><label>Montant remis / transféré</label><input id="cash_counted" type="number" min="0" value="'+Number(closure?.counted_amount??expected)+'"></div>'+
      '<div><label>Mode de remise</label><select id="cash_transfer_method" onchange="toggleCashTransferFields()">'+
        '<option value="">-- Choisir --</option>'+
        '<option '+((closure?.transfer_method||closure?.handed_to)==="Airtel Money"?"selected":"")+'>Airtel Money</option>'+
        '<option '+((closure?.transfer_method||closure?.handed_to)==="Caisse G10"?"selected":"")+'>Caisse G10</option>'+
        '<option '+((closure?.transfer_method||closure?.handed_to)==="Gardien / coffre"?"selected":"")+'>Gardien / coffre</option>'+
        '<option '+((closure?.transfer_method||closure?.handed_to)==="Direction"?"selected":"")+'>Direction</option>'+
        '<option '+((closure?.transfer_method||closure?.handed_to)==="Autre"?"selected":"")+'>Autre</option>'+
      '</select></div>'+
    '</div>'+
    '<div id="airtelFields" class="cashTransferFields">'+
      '<div><label>Numéro Airtel Money destinataire</label><input id="cash_phone" value="'+G10.esc(closure?.destination_phone||"")+'" placeholder="Ex. 07 XX XX XX XX"></div>'+
      '<div><label>Référence transaction</label><input id="cash_reference" value="'+G10.esc(closure?.transaction_reference||"")+'" placeholder="Optionnel"></div>'+
      '<div><label>Note</label><input id="cash_note" value="'+G10.esc(closure?.note||"")+'" placeholder="Optionnel"></div>'+
    '</div>'+
    (!canClose?'<div class="docsNote">La clôture devient disponible après la fin du trajet retour.</div>':'')+
    '<div class="actions"><button class="btn green" '+(!canClose?"disabled":"")+' onclick="closeCash()">CONFIRMER LA REMISE</button></div>'+
    (closure?'<div class="callout">Attendu : <b>'+G10.money(closure.expected_amount)+'</b> • Remis : <b>'+G10.money(closure.counted_amount)+'</b> • Écart : <b>'+G10.money(Number(closure.counted_amount)-Number(closure.expected_amount))+'</b> • Mode : <b>'+G10.esc(closure.transfer_method||closure.handed_to||"—")+'</b></div>':'')+
    '</div>';
}

window.toggleCashTransferFields=()=>{
  const el=$("#airtelFields"),method=$("#cash_transfer_method")?.value||"";
  if(!el)return;
  el.style.display=method==="Airtel Money"?"grid":"none";
};
window.driverLogin=async()=>{
  const driverId=Number($("#driverLoginSelect").value),pin=$("#driverLoginPin").value.trim();
  if(!driverId||!pin)return G10.toast("Choisis le chauffeur et entre son code.");
  const run=G10.snapshot.runs.find(x=>Number(x.driver_id)===driverId);
  if(!run)return G10.toast("Aucun bus n’est affecté à ce chauffeur.");
  try{
    const authOut=await G10.pinLogin({kind:"driver",driverId,pin});
    G10.driverSession={driverId,busId:Number(run.bus_id),sessionVersion:Number(authOut.sessionVersion)};
    const out=await G10.api("/driver-action",{method:"POST",body:JSON.stringify({busId:Number(run.bus_id),action:"LOGIN"})});
    G10.driverSession.sessionVersion=Number(out.sessionVersion||authOut.sessionVersion);
    G10.applyDriverNav();
    await G10.loadState();G10.toast("Connexion réussie");
  }catch(e){G10.driverSession=null;await G10Firebase.auth.signOut().catch(()=>{});G10.toast(e.message)}
};
window.driverLogout=async()=>{G10.driverSession=null;await G10Firebase.auth.signOut().catch(()=>{});G10.applyDriverNav();await G10.loadState(true);renderDriver()};
window.ackDriverWarning=async warningId=>{
  try{
    await G10.api("/driver-action",{method:"POST",body:JSON.stringify({...G10.driverSession,action:"ACK_WARNING",payload:{warningId}})});
    await G10.loadState();G10.toast("Prise de connaissance enregistrée");
  }catch(e){G10.toast(e.message)}
};
window.setDriverLeg=async leg=>{
  if(!G10.driverSession)return;
  if(!confirm("Passer au trajet "+leg+" ? Le 360° reste validé.")){renderDriver();return}
  try{
    await G10.api("/driver-action",{method:"POST",body:JSON.stringify({...G10.driverSession,action:"SET_LEG",payload:{leg}})});
    await G10.loadState();G10.toast("Trajet "+leg+" sélectionné");
  }catch(e){G10.toast(e.message)}
};
window.save360=async()=>{
  const payload={};$$("[data-check]").forEach(x=>payload[x.dataset.check]=x.checked);
  try{
    await G10.api("/driver-action",{method:"POST",body:JSON.stringify({...G10.driverSession,action:"CHECKLIST",payload})});
    await G10.loadState();G10.toast(Object.values(payload).every(Boolean)?"360° validé":"Contrôle enregistré");
  }catch(e){G10.toast(e.message)}
};
window.driverStart=async()=>{
  try{
    await G10.api("/driver-action",{method:"POST",body:JSON.stringify({...G10.driverSession,action:"DEPART",payload:{}})});
    await G10.loadState();G10.toast("Départ réel enregistré");
  }catch(e){G10.toast(e.message)}
};
window.driverFinish=async()=>{
  try{
    await G10.api("/driver-action",{method:"POST",body:JSON.stringify({...G10.driverSession,action:"ARRIVE",payload:{}})});
    await G10.loadState();G10.toast("Trajet terminé");
  }catch(e){G10.toast(e.message)}
};
window.setBoarding=async(studentId,status)=>{
  const run=G10.runFor(G10.driverSession.busId),leg=run?.current_leg||"MATIN";
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SET_BOARDING",studentId,leg,status})});
    await G10.loadState();G10.toast("Pointage enregistré");
  }catch(e){G10.toast(e.message)}
};
window.passStop=async stopId=>{
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"PASS_STOP",busId:G10.driverSession.busId,stopId})});
    await G10.loadState();G10.toast("Arrêt enregistré");
  }catch(e){G10.toast(e.message)}
};
window.addDailyRide=async(stopId,destId,locationLabel)=>{
  const run=G10.runFor(G10.driverSession.busId);
  try{
    const out=await G10.api("/school-action",{method:"POST",body:JSON.stringify({
      action:"ADD_DAILY_RIDE",busId:G10.driverSession.busId,zoneId:run.zone_id,stopId,destinationId:destId,leg:run.current_leg||"MATIN",locationLabel
    })});
    await G10.loadState();G10.toast("1 élève encaissé • "+G10.money(out.amount)+" • "+out.remaining+" place(s) cash restantes");
  }catch(e){G10.toast(e.message)}
};
window.cancelDailyRide=async id=>{
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"CANCEL_DAILY_RIDE",id})});
    await G10.loadState();G10.toast("Dernière saisie annulée");
  }catch(e){G10.toast(e.message)}
};
window.arriveDestination=async destinationId=>{
  try{
    const out=await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"ARRIVE_DESTINATION",busId:G10.driverSession.busId,destinationId})});
    await G10.loadState();G10.toast((out.subscribers+out.cash)+" passager(s) sortis du compteur");
  }catch(e){G10.toast(e.message)}
};
window.arriveReturnStop=async stopId=>{
  try{
    const out=await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"ARRIVE_STOP",busId:G10.driverSession.busId,stopId})});
    await G10.loadState();G10.toast((out.subscribers+out.cash)+" passager(s) sortis du compteur");
  }catch(e){G10.toast(e.message)}
};
window.closeCash=async()=>{
  const countedAmount=Number($("#cash_counted").value)||0;
  const transferMethod=$("#cash_transfer_method").value;
  const destinationPhone=$("#cash_phone")?.value.trim()||"";
  const transactionReference=$("#cash_reference")?.value.trim()||"";
  const note=$("#cash_note")?.value.trim()||"";
  if(!transferMethod)return G10.toast("Choisis le mode de remise.");
  if(transferMethod==="Airtel Money"&&!destinationPhone)return G10.toast("Entre le numéro Airtel Money destinataire.");
  try{
    const out=await G10.api("/school-action",{method:"POST",body:JSON.stringify({
      action:"CLOSE_CASH",busId:G10.driverSession.busId,countedAmount,transferMethod,destinationPhone,transactionReference,note
    })});
    await G10.loadState();
    G10.toast("Recette remise • écart "+G10.money(out.difference));
  }catch(e){G10.toast(e.message)}
};