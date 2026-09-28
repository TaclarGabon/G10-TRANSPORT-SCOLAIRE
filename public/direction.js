G10.renderers.dashboard=renderDashboard;

function activeBuses(){return G10.snapshot.buses.filter(b=>b.active!==false)}

function renderDashboard(){
  const subs=G10.activeStudents();
  const monthlyRevenue=subs.reduce((n,s)=>n+Number(s.monthly_amount||0),0);
  const dailyCount=G10.snapshot.dailyRides.length;
  const dailyRev=G10.snapshot.dailyRides.reduce((n,r)=>n+Number(r.fare_amount||0),0);

  let html='<h4 class="directionBlockTitle">Abonnements mensuels</h4>'+
    '<div class="kpiStrip">'+
      '<div class="stat"><span>Abonnés actifs</span><strong>'+subs.length+'</strong></div>'+
      '<div class="stat"><span>Recette mensuelle abonnements</span><strong>'+G10.money(monthlyRevenue)+'</strong></div>'+
      activeBuses().map(b=>'<div class="stat"><span>'+G10.esc(b.label)+' — abonnés</span><strong>'+G10.studentsForBus(b.id).length+'</strong></div>').join("")+
    '</div>';

  html+='<h4 class="directionBlockTitle">Recettes du jour — non-abonnés cash</h4>'+
    '<div class="kpiStrip">'+
      '<div class="stat"><span>Élèves non abonnés transportés</span><strong>'+dailyCount+'</strong></div>'+
      '<div class="stat"><span>Recette journalière</span><strong>'+G10.money(dailyRev)+'</strong></div>'+
      activeBuses().map(b=>'<div class="stat"><span>'+G10.esc(b.label)+' — recette du jour</span><strong>'+G10.money(G10.dailyRevenue(b.id))+'</strong></div>').join("")+
    '</div>';

  html+='<h4 class="directionBlockTitle">Situation des bus</h4><div class="grid2">'+activeBuses().map(b=>G10.busLiveCard?G10.busLiveCard(b):"").join("")+'</div>';

  html+='<h4 class="directionBlockTitle">Clôture des caisses</h4><div class="grid2">'+activeBuses().map(b=>{
    const c=(G10.snapshot.cashClosures||[]).find(x=>Number(x.bus_id)===Number(b.id));
    if(!c)return '<div class="miniCard '+G10.busTone(b.id)+'"><h4>'+G10.esc(b.label)+'</h4><div class="routeWarn">Caisse non clôturée aujourd’hui.</div></div>';
    const diff=Number(c.counted_amount)-Number(c.expected_amount);
    return '<div class="miniCard '+G10.busTone(b.id)+'"><h4>'+G10.esc(b.label)+'</h4><p>Recette attendue : <b>'+G10.money(c.expected_amount)+'</b><br>Montant remis / transféré : <b>'+G10.money(c.counted_amount)+'</b><br>Écart : <b>'+G10.money(diff)+'</b><br>Mode : <b>'+G10.esc(c.transfer_method||c.handed_to||"—")+'</b>'+(c.destination_phone?'<br>Numéro destinataire : <b>'+G10.esc(c.destination_phone)+'</b>':'')+(c.transaction_reference?'<br>Référence : <b>'+G10.esc(c.transaction_reference)+'</b>':'')+'<br>Clôturé : <b>'+G10.fmtTime(c.closed_at)+'</b></p></div>';
  }).join("")+'</div>';

  html+='<h4 class="directionBlockTitle">Analyse du jour par arrêt et établissement</h4>'+renderDailyAnalytics();
  html+=renderDirectionWarnings();
  html+=renderDriverAccessManagement();
  html+=renderDriverOfMonth();
  $("#dashboardContent").innerHTML=html;
}

function renderDailyAnalytics(){
  if(!G10.snapshot.dailyRides.length)return'<div class="empty">Aucun non-abonné enregistré aujourd’hui.</div>';
  const map=new Map();
  G10.snapshot.dailyRides.forEach(r=>{
    const key=(r.stop_name||"—")+"|"+(r.destination_name||"—");
    const v=map.get(key)||{stop:r.stop_name||"—",dest:r.destination_name||"—",count:0,revenue:0};
    v.count++;v.revenue+=Number(r.fare_amount||0);map.set(key,v);
  });
  return '<div class="tableWrap"><table class="analyticsTable"><thead><tr><th>Arrêt</th><th>Établissement</th><th>Non-abonnés</th><th>Recette</th></tr></thead><tbody>'+
    [...map.values()].map(v=>'<tr><td>'+G10.esc(v.stop)+'</td><td>'+G10.esc(v.dest)+'</td><td>'+v.count+'</td><td><b>'+G10.money(v.revenue)+'</b></td></tr>').join("")+
    '</tbody></table></div>';
}

function renderDirectionWarnings(){
  const drivers=G10.snapshot.drivers.filter(d=>String(d.name||"").trim());
  let html='<h4 class="directionBlockTitle">Avertissements chauffeurs</h4><div class="grid2">';
  html+=drivers.map(d=>{
    const level=G10.warningLevel(d.id);
    const rows=G10.warningsForDriver(d.id);
    return '<div class="miniCard"><div class="panelHead"><div><h4>'+G10.esc(d.name)+'</h4><p class="muted">'+level.icon+' '+G10.esc(level.label)+'</p></div></div>'+
      (rows.length?'<div class="tableWrap"><table class="schoolTable"><thead><tr><th>Date</th><th>Motif</th><th>Statut</th><th>Enregistré par</th><th>Lu</th></tr></thead><tbody>'+
      rows.map(w=>'<tr><td>'+G10.esc(w.complaint_date||"")+'</td><td><b>'+G10.esc(w.reason)+'</b><br><small>'+G10.esc(w.details||"")+'</small></td><td>'+G10.badge(w.status)+'</td><td>'+G10.esc(w.recorded_by||"—")+'</td><td>'+(w.acknowledged_at?"Oui • "+G10.fmtTime(w.acknowledged_at):"Non")+'</td></tr>').join("")+
      '</tbody></table></div>':'<div class="empty">Aucun avertissement.</div>')+
      (level.count>=3?'<div class="routeWarn" style="margin-top:10px"><b>Décision Direction requise.</b> Aucune mise à pied ni rupture de contrat n’est appliquée automatiquement.</div>':'')+
      '</div>';
  }).join("");
  html+='</div>';
  return html;
}

function renderDriverAccessManagement(){
  const drivers=G10.snapshot.drivers.filter(d=>String(d.name||"").trim());
  return '<h4 class="directionBlockTitle">Gestion des accès chauffeurs</h4>'+
    '<div class="grid2">'+drivers.map(d=>{
      const suspended=d.access_status==="SUSPENDU";
      return '<div class="accessCard"><div class="panelHead"><div><h4>'+G10.esc(d.name)+'</h4><p class="muted">'+
        (d.archived_at?"Historique conservé — chauffeur archivé":(d.active_status==="ACTIF"?"Chauffeur actif":"Chauffeur inactif"))+
        '</p></div>'+G10.badge(suspended?"SUSPENDU":"AUTORISE")+'</div>'+
        '<div class="actions">'+
          '<button class="btn '+(suspended?"green":"orange")+'" '+(d.archived_at?"disabled":"")+' onclick="setDriverAccess('+d.id+',\''+(suspended?"AUTORISE":"SUSPENDU")+'\')">'+(suspended?"Autoriser l’accès":"Suspendre l’accès")+'</button>'+
          '<button class="btn light" '+(d.archived_at?"disabled":"")+' onclick="changeDriverPin('+d.id+')">Changer le PIN</button>'+
          '<button class="btn light" onclick="forceDriverLogout('+d.id+')">Forcer la déconnexion</button>'+
        '</div>'+
        '<p class="muted" style="margin-top:8px">Toute suspension, modification du PIN ou déconnexion forcée invalide immédiatement la session en cours.</p>'+
      '</div>';
    }).join("")+'</div>';
}

window.setDriverAccess=async(driverId,accessStatus)=>{
  try{
    await G10.managementAction("dashboard",{action:"SET_DRIVER_ACCESS",driverId,accessStatus});
    await G10.loadState();G10.toast(accessStatus==="SUSPENDU"?"Accès suspendu":"Accès autorisé");
  }catch(e){G10.toast(e.message)}
};
window.changeDriverPin=async driverId=>{
  const pin=prompt("Nouveau PIN chauffeur (4 chiffres minimum)");
  if(pin===null)return;
  if(!/^\d{4,}$/.test(pin.trim()))return G10.toast("PIN invalide.");
  try{
    await G10.managementAction("dashboard",{action:"CHANGE_DRIVER_PIN",driverId,pin:pin.trim()});
    await G10.loadState();G10.toast("PIN modifié et anciennes sessions fermées");
  }catch(e){G10.toast(e.message)}
};
window.forceDriverLogout=async driverId=>{
  if(!confirm("Forcer la déconnexion de ce chauffeur sur tous ses appareils ?"))return;
  try{
    await G10.managementAction("dashboard",{action:"FORCE_DRIVER_LOGOUT",driverId});
    await G10.loadState();G10.toast("Déconnexion forcée envoyée");
  }catch(e){G10.toast(e.message)}
};

function currentMonthKey(){
  const d=new Date(G10.snapshot.server_time||Date.now());
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Libreville",year:"numeric",month:"2-digit"}).formatToParts(d);
  const y=parts.find(p=>p.type==="year")?.value,m=parts.find(p=>p.type==="month")?.value;
  return y+"-"+m;
}
function driverMonthMetrics(driverId,monthKey){
  const rows=(G10.snapshot.driverActivity||[]).filter(a=>Number(a.driver_id)===Number(driverId)&&String(a.service_date||"").startsWith(monthKey));
  const passengers=rows.reduce((n,a)=>n+Number(a.passengers_transported||0),0);
  const avgFill=rows.length?rows.reduce((n,a)=>n+Math.min(100,(Number(a.passengers_transported||0)/Math.max(1,Number(a.capacity||23)))*100),0)/rows.length:0;
  const proc=rows.length?(rows.filter(a=>a.checklist_ok).length/rows.length)*100:0;
  const punctualRows=rows.filter(a=>G10.timeToMinutes(a.planned_end)!==null&&a.actual_end);
  const ontime=punctualRows.length?(punctualRows.filter(a=>{
    let delta=G10.actualToMinutes(a.actual_end)-G10.timeToMinutes(a.planned_end);if(delta>720)delta-=1440;if(delta<-720)delta+=1440;
    return delta<=5;
  }).length/punctualRows.length)*100:0;
  const warnings=G10.confirmedWarningsForDriver(driverId).filter(w=>String(w.complaint_date||"").startsWith(monthKey)).length;
  return{rows,rotations:rows.length,passengers,avgFill,proc,ontime,warnings};
}
function renderDriverOfMonth(){
  const monthKey=currentMonthKey();
  const drivers=G10.snapshot.drivers.filter(d=>String(d.name||"").trim()&&!d.archived_at);
  const all=drivers.map(d=>({driver:d,m:driverMonthMetrics(d.id,monthKey)}));
  const maxRot=Math.max(1,...all.map(x=>x.m.rotations));
  const maxPass=Math.max(1,...all.map(x=>x.m.passengers));
  all.forEach(x=>{
    const m=x.m;
    x.score=Math.max(0,Math.round(
      (m.rotations/maxRot)*20+
      (m.passengers/maxPass)*20+
      m.avgFill*.20+
      m.ontime*.25+
      m.proc*.15-
      m.warnings*15
    ));
  });
  const candidate=all.filter(x=>x.m.rotations>0).sort((a,b)=>b.score-a.score)[0]||null;
  const validated=(G10.snapshot.driverMonthAwards||[]).find(a=>a.month_key===monthKey);
  const validatedDriver=validated?G10.driverFor(validated.driver_id):null;

  let html='<h4 class="directionBlockTitle">🏆 Chauffeur du mois — '+G10.esc(monthKey)+'</h4>'+
    '<div class="callout"><b>Indicateur automatique, décision humaine.</b> Le calcul utilise les rotations réalisées, passagers transportés, remplissage, ponctualité, contrôle 360° et avertissements confirmés. La Direction reste seule décisionnaire pour une prime.</div>'+
    '<div class="grid2" style="margin-top:12px">'+all.map(x=>{
      const m=x.m;
      return '<div class="miniCard"><div class="panelHead"><div><h4>'+G10.esc(x.driver.name)+'</h4><p class="muted">Indice opérationnel : '+x.score+'/100</p></div>'+(validated&&Number(validated.driver_id)===Number(x.driver.id)?'<span class="badge greenbg">Validé Direction</span>':'')+'</div>'+
        '<div class="metricGrid">'+
          '<div class="metricBox"><span>Rotations</span><b>'+m.rotations+'</b></div>'+
          '<div class="metricBox"><span>Passagers</span><b>'+m.passengers+'</b></div>'+
          '<div class="metricBox"><span>Remplissage moyen</span><b>'+Math.round(m.avgFill)+'%</b></div>'+
          '<div class="metricBox"><span>Ponctualité</span><b>'+Math.round(m.ontime)+'%</b></div>'+
          '<div class="metricBox"><span>Procédures 360°</span><b>'+Math.round(m.proc)+'%</b></div>'+
          '<div class="metricBox"><span>Avertissements confirmés</span><b>'+m.warnings+'</b></div>'+
        '</div></div>';
    }).join("")+'</div>';

  if(validatedDriver){
    html+='<div class="callout" style="margin-top:12px">🏆 <b>Validé par la Direction :</b> '+G10.esc(validatedDriver.name)+' • '+G10.fmtTime(validated.validated_at)+'</div>';
  }else if(candidate){
    html+='<div class="callout" style="margin-top:12px"><b>Candidat suggéré par les données :</b> '+G10.esc(candidate.driver.name)+' — indice '+candidate.score+'/100. <button class="btn green" style="margin-left:8px" onclick="validateDriverMonth('+candidate.driver.id+',\''+monthKey+'\')">Valider par la Direction</button></div>';
  }else{
    html+='<div class="empty" style="margin-top:12px">Pas encore assez de rotations terminées ce mois-ci pour proposer un indicateur.</div>';
  }
  return html;
}
window.validateDriverMonth=async(driverId,monthKey)=>{
  if(!confirm("Valider ce chauffeur comme Chauffeur du mois ? Cette validation appartient à la Direction et peut être modifiée."))return;
  try{
    await G10.managementAction("dashboard",{action:"VALIDATE_DRIVER_MONTH",driverId,monthKey});
    await G10.loadState();G10.toast("Chauffeur du mois validé");
  }catch(e){G10.toast(e.message)}
};