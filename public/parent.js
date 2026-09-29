G10.renderers.parent=renderParent;

function childTripStatus(child){
  const morning=(child.boardings||[]).find(x=>x.leg==="MATIN");
  const ret=(child.boardings||[]).find(x=>x.leg==="RETOUR");
  return {morning,ret};
}
function schoolPunctuality(child,morning){
  if(!child.school_start_time||!morning?.dropped_at)return "—";
  return G10.varianceText(child.school_start_time,morning.dropped_at);
}
function renderParent(){
  if(!G10.parentSession||!G10.parentData){renderParentLogin();return}
  const children=G10.parentData.children||[];
  let html='<div class="panelHead"><div><h4>Bonjour '+G10.esc(G10.parentData.guardianName)+'</h4><p class="muted">Vous voyez uniquement les enfants liés à votre compte parent.</p></div><button class="btn orange" onclick="parentLogout()">Déconnexion</button></div>';

  html+=children.map(c=>{
    const {morning,ret}=childTripStatus(c);
    const morningState=morning?.status||"ATTENDU";
    const returnState=ret?.status||"ATTENDU";
    return '<div class="parentChildCard">'+
      '<div class="panelHead"><div><h4>'+G10.esc(c.name)+'</h4><p class="muted">'+G10.esc(c.bus_label||"Bus non affecté")+(c.plate?" • "+G10.esc(c.plate):"")+' • '+G10.esc(c.zone||"")+' • '+G10.esc(c.pickup||"Arrêt à renseigner")+' ↔ '+G10.esc(c.school||"Établissement à renseigner")+'</p></div>'+G10.badge(c.bus_status||"NON_ASSIGNE")+'</div>'+

      '<div class="grid2" style="margin-top:12px">'+
        '<div class="miniCard"><h4>Matin — vers l’école</h4>'+
          '<div class="parentTimeline">'+
            '<div><span class="muted">Passage prévu à l’arrêt</span><br><b>'+G10.esc(c.morning_pickup_planned||"À définir")+'</b></div>'+
            '<div><span class="muted">Monté dans le bus à '+G10.esc(c.pickup||"l’arrêt")+'</span><br><b>'+(morning?.boarded_at?G10.fmtTime(morning.boarded_at):G10.statusLabel(morningState))+'</b></div>'+
            '<div><span class="muted">Bus arrivé à '+G10.esc(c.school||"l’établissement")+'</span><br><b>'+(morning?.dropped_at?G10.fmtTime(morning.dropped_at):"Pas encore arrivé")+'</b></div>'+
            '<div><span class="muted">Début des cours</span><br><b>'+G10.esc(c.school_start_time||"À définir")+'</b><br><small>'+G10.esc(schoolPunctuality(c,morning))+'</small></div>'+
          '</div>'+
        '</div>'+
        '<div class="miniCard"><h4>Retour — vers l’arrêt</h4>'+
          '<div class="parentTimeline">'+
            '<div><span class="muted">Montée prévue à l’école</span><br><b>'+G10.esc(c.return_pickup_planned||"À définir")+'</b></div>'+
            '<div><span class="muted">Monté dans le bus à '+G10.esc(c.school||"l’école")+'</span><br><b>'+(ret?.boarded_at?G10.fmtTime(ret.boarded_at):G10.statusLabel(returnState))+'</b></div>'+
            '<div><span class="muted">Arrivée prévue à '+G10.esc(c.pickup||"l’arrêt")+'</span><br><b>'+G10.esc(c.return_arrival_planned||"À définir")+'</b></div>'+
            '<div><span class="muted">Bus arrivé à '+G10.esc(c.pickup||"l’arrêt")+'</span><br><b>'+(ret?.dropped_at?G10.fmtTime(ret.dropped_at):"Pas encore arrivé")+'</b></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="callout" style="margin-top:12px"><b>Position opérationnelle du bus :</b> '+G10.esc(c.current_location_label||"Pas encore de pointage")+'</div>'+
      '<div class="actions"><button class="btn '+(c.absence_today?"light":"orange")+'" onclick="setParentAbsence('+c.id+','+(!c.absence_today)+')">'+(c.absence_today?"Annuler l’absence":"Absent aujourd’hui")+'</button></div>'+
    '</div>';
  }).join("");
  $("#parentContent").innerHTML=html;
}
function renderParentLogin(){
  $("#parentContent").innerHTML='<div class="miniCard parentLogin"><h4>Connexion Parent</h4><p class="muted">Utilisez le nom du parent / responsable enregistré dans l’abonnement et le mot de passe associé. Aucun autre enfant n’est affiché.</p><div><label>Nom du parent / responsable</label><input id="parentName" placeholder="Nom enregistré"></div><div style="margin-top:10px"><label>Mot de passe</label><input id="parentPin" type="password" placeholder="Mot de passe"></div><div class="actions"><button class="btn green" onclick="parentLogin()">Se connecter</button></div></div>';
}
window.parentLogin=async()=>{
  const guardianName=$("#parentName").value.trim(),pin=$("#parentPin").value.trim();
  if(!guardianName||!pin)return G10.toast("Nom et mot de passe requis.");
  try{
    const authOut=await G10.pinLogin({kind:"parent",guardianName,pin});
    G10.parentSession={guardianName:authOut.guardianName||guardianName};
    sessionStorage.setItem("g10_school_parent_session",JSON.stringify(G10.parentSession));
    G10.parentData=await G10.api("/parent-login",{method:"POST",body:"{}"});
    await G10.loadState(true);
    renderParent();G10.toast("Connexion réussie");
  }catch(e){G10.parentSession=null;G10.parentData=null;sessionStorage.removeItem("g10_school_parent_session");G10.toast(e.message)}
};
window.parentLogout=async()=>{G10.parentSession=null;G10.parentData=null;sessionStorage.removeItem("g10_school_parent_session");await G10.loadState(true);renderParent()};
window.refreshParent=async()=>{
  if(!G10.parentSession)return;
  G10.parentData=await G10.api("/parent-login",{method:"POST",body:"{}"});
  renderParent();
};
window.setParentAbsence=async(studentId,absent)=>{
  try{
    await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"SET_PARENT_ABSENCE",studentId,absent})});
    await G10.loadState();await window.refreshParent();
    G10.toast(absent?"Absence signalée":"Absence annulée");
  }catch(e){G10.toast(e.message)}
};