G10.renderers.documents=renderDocuments;

function renderDocuments(){
  const students=G10.snapshot.students||[];
  const daily=G10.snapshot.dailyRides||[];
  const cash=daily.reduce((n,r)=>n+Number(r.fare_amount||0),0);

  $("#documentsContent").innerHTML=
    '<div class="docsGrid">'+
      '<div class="docsCard"><h4>Excel — abonnements</h4><p>Exporter la liste des élèves abonnés avec parent, zone, arrêt, école, bus et horaires.</p><div class="docsActions"><button class="btn green" onclick="exportStudentsExcel()">Exporter abonnés</button><label class="btn light" style="cursor:pointer">Importer abonnés<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="importStudentsExcel(this)"></label></div><div class="docsNote">'+students.length+' élève(s) actuellement dans la base.</div></div>'+
      '<div class="docsCard"><h4>Excel — tarifs</h4><p>Exporter la matrice des tarifs journaliers pour les élèves non abonnés.</p><div class="docsActions"><button class="btn green" onclick="exportFaresExcel()">Exporter tarifs</button></div></div>'+
      '<div class="docsCard"><h4>Excel — rapport du jour</h4><p>Exporter abonnés, pointages, non-abonnés et recettes cash du jour.</p><div class="docsActions"><button class="btn green" onclick="exportDailyExcel()">Exporter rapport du jour</button></div><div class="docsNote">'+daily.length+' trajet(s) cash • '+G10.money(cash)+'</div></div>'+
      '<div class="docsCard"><h4>PDF / impression — Direction</h4><p>Créer une version propre du résumé Direction pour impression ou enregistrement en PDF depuis le navigateur.</p><div class="docsActions"><button class="btn light" onclick="printDirectionReport()">Imprimer / PDF</button></div></div>'+
      '<div class="docsCard"><h4>PDF / impression — abonnés</h4><p>Créer une liste imprimable des abonnements actuellement enregistrés.</p><div class="docsActions"><button class="btn light" onclick="printSubscribers()">Imprimer / PDF</button></div></div>'+
      '<div class="docsCard"><h4>Factures & reçus</h4><p>Cette partie sera reliée au futur suivi des paiements. Pour éviter de produire une fausse facture, aucun reçu n’est généré tant qu’un paiement n’est pas enregistré dans l’application.</p><div class="docsNote">Prévu : facture abonnement, reçu de paiement et historique par famille.</div></div>'+
    '</div>'+

    '<h4 class="directionBlockTitle">Outils de démonstration</h4>'+
    '<div class="docsGrid">'+
      '<div class="docsCard"><h4>Réinitialiser la journée</h4><p>Efface seulement les pointages du jour, les passagers cash, les heures réelles, le 360° du jour et la clôture de caisse. Chauffeurs, abonnés, bus, zones et horaires prévus restent en place.</p><div class="docsActions"><button class="btn light" onclick="resetDemoDay()">Réinitialiser activité du jour</button></div></div>'+
      '<div class="docsCard docsDanger"><h4>Réinitialiser toute la démo</h4><p>Remet l’application dans un état propre pour une présentation : aucun abonné, aucun chauffeur renseigné, aucune affectation, aucune plaque ni recette. Bus 1 et Bus 2 restent disponibles à 23 places; Akanda/Owendo et les arrêts de référence sont restaurés.</p><div class="docsActions"><button class="btn orange" onclick="resetDemoFull()">Remettre la démo à zéro</button></div><div class="docsNote">À utiliser juste avant une démonstration à JC, ou après tes essais.</div></div>'+
    '</div>';
}

function printWindow(title,body){
  const w=window.open("","_blank");
  if(!w){G10.toast("Autorise les fenêtres contextuelles pour créer le PDF.");return}
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+G10.esc(title)+'</title><style>body{font-family:Arial,sans-serif;color:#123;padding:28px}h1{color:#073763}h2{margin-top:26px;color:#0b4f8a}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccd8e1;padding:8px;text-align:left;font-size:12px}th{background:#073763;color:#fff}.muted{color:#667}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{border:1px solid #ccd8e1;padding:12px;border-radius:10px}.kpi b{display:block;font-size:20px;margin-top:4px}@media print{button{display:none}}</style></head><body>'+body+'<script>setTimeout(()=>window.print(),250)<\/script></body></html>');
  w.document.close();
}
window.printDirectionReport=()=>{
  const subs=G10.activeStudents(),monthly=subs.reduce((n,s)=>n+Number(s.monthly_amount||0),0),daily=G10.snapshot.dailyRides||[],cash=daily.reduce((n,r)=>n+Number(r.fare_amount||0),0);
  let body='<h1>G10 Transports Scolaires — Rapport Direction</h1><p class="muted">Situation au '+new Date().toLocaleString("fr-FR")+'</p>'+
    '<div class="kpis"><div class="kpi">Abonnés actifs<b>'+subs.length+'</b></div><div class="kpi">Recette mensuelle prévue<b>'+G10.money(monthly)+'</b></div><div class="kpi">Non-abonnés du jour<b>'+daily.length+'</b></div><div class="kpi">Cash du jour<b>'+G10.money(cash)+'</b></div></div>'+
    '<h2>Bus</h2><table><thead><tr><th>Bus</th><th>Plaque</th><th>Zone</th><th>Chauffeur</th><th>Statut</th><th>À bord</th></tr></thead><tbody>'+
    G10.snapshot.buses.filter(b=>b.active!==false).map(b=>{const r=G10.runFor(b.id)||{};return'<tr><td>'+G10.esc(b.label)+'</td><td>'+G10.esc(b.plate||"—")+'</td><td>'+G10.esc(G10.zoneFor(r.zone_id)?.name||"—")+'</td><td>'+G10.esc(G10.driverFor(r.driver_id)?.name||"—")+'</td><td>'+G10.esc(G10.statusLabel(r.status))+'</td><td>'+Number(r.boarded||0)+' / '+b.capacity+'</td></tr>'}).join("")+
    '</tbody></table>';
  printWindow("Rapport Direction G10 Scolaire",body);
};
window.printSubscribers=()=>{
  const body='<h1>G10 Transports Scolaires — Liste des abonnés</h1><p class="muted">Édité le '+new Date().toLocaleString("fr-FR")+'</p>'+
    '<table><thead><tr><th>Élève</th><th>Parent</th><th>Zone</th><th>Arrêt</th><th>Établissement</th><th>Bus</th><th>Mensuel</th><th>Statut</th></tr></thead><tbody>'+
    G10.snapshot.students.map(s=>'<tr><td>'+G10.esc(s.name)+'</td><td>'+G10.esc(s.guardian_name||"—")+'</td><td>'+G10.esc(s.zone||"—")+'</td><td>'+G10.esc(s.pickup||"—")+'</td><td>'+G10.esc(s.school||"—")+'</td><td>'+(s.bus_id?"Bus "+s.bus_id:"—")+'</td><td>'+G10.money(s.monthly_amount)+'</td><td>'+G10.esc(G10.statusLabel(s.status))+'</td></tr>').join("")+
    '</tbody></table>';
  printWindow("Abonnés G10 Scolaire",body);
};
window.resetDemoDay=async()=>{
  if(!confirm("Réinitialiser uniquement l’activité du jour ? Les abonnés, chauffeurs, bus, zones et horaires prévus seront conservés."))return;
  try{await G10.api("/reset-demo",{method:"POST",body:JSON.stringify({mode:"DAY"})});G10.driverSession=null;G10.parentSession=null;G10.parentData=null;await G10.loadState();G10.toast("Activité du jour réinitialisée")}catch(e){G10.toast(e.message)}
};
window.resetDemoFull=async()=>{
  const word=prompt("Cette action remet la démonstration à zéro. Tape RESET pour confirmer.");
  if(word!=="RESET")return G10.toast("Réinitialisation annulée.");
  if(!confirm("Confirmer la remise à zéro complète de la démo ?"))return;
  try{await G10.api("/reset-demo",{method:"POST",body:JSON.stringify({mode:"FULL"})});G10.driverSession=null;G10.parentSession=null;G10.parentData=null;await G10.loadState();G10.toast("Démo remise à zéro")}catch(e){G10.toast(e.message)}
};