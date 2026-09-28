function xmlEsc(v){
  return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function excelStatusStyle(v){
  const s=String(v||"").toUpperCase();
  if(["ACTIF","AUTORISÉ","AUTORISE","CONFIRMÉE","CONFIRMEE","MONTÉ","MONTE","DÉPOSÉ","DEPOSE","ARRIVÉ","ARRIVE","VALIDÉ","VALIDE"].some(x=>s.includes(x)))return"StatusGreen";
  if(["ATTENTE","À VÉRIFIER","A_VERIFIER","EN ROUTE","CONTRÔLE","CONTROLE"].some(x=>s.includes(x)))return"StatusOrange";
  if(["SUSPENDU","INACTIF","ABSENT","RETARD","3E AVERTISSEMENT"].some(x=>s.includes(x)))return"StatusRed";
  if(["CLASSÉE","CLASSEE","NON AFFECTÉ","NON_ASSIGNE"].some(x=>s.includes(x)))return"StatusGray";
  return"Body";
}
function excelCell(v,style="Body",type=null){
  if(v===null||v===undefined)v="";
  const numeric=type==="Number"||typeof v==="number";
  const t=numeric?"Number":"String";
  return '<Cell ss:StyleID="'+style+'"><Data ss:Type="'+t+'">'+xmlEsc(v)+'</Data></Cell>';
}
function workbookXml(sheets){
  const styles='<Styles>'+
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>'+
    '<Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#073763" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>'+
    '<Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#073763" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E3EE"/></Borders></Style>'+
    '<Style ss:ID="Body"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E3EE"/></Borders></Style>'+
    '<Style ss:ID="Currency"><NumberFormat ss:Format="#,##0 &quot;FCFA&quot;"/><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E3EE"/></Borders></Style>'+
    '<Style ss:ID="Total"><Font ss:Bold="1" ss:Color="#073763"/><Interior ss:Color="#E7F0F7" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#073763"/></Borders></Style>'+
    '<Style ss:ID="StatusGreen"><Font ss:Bold="1" ss:Color="#047857"/><Interior ss:Color="#E8F8F1" ss:Pattern="Solid"/></Style>'+
    '<Style ss:ID="StatusOrange"><Font ss:Bold="1" ss:Color="#9A5B00"/><Interior ss:Color="#FFF0D5" ss:Pattern="Solid"/></Style>'+
    '<Style ss:ID="StatusRed"><Font ss:Bold="1" ss:Color="#A61B1B"/><Interior ss:Color="#FFE4E4" ss:Pattern="Solid"/></Style>'+
    '<Style ss:ID="StatusGray"><Font ss:Bold="1" ss:Color="#52606D"/><Interior ss:Color="#EEF2F5" ss:Pattern="Solid"/></Style>'+
  '</Styles>';
  const worksheets=sheets.map(sh=>{
    const cols=sh.headers.map(()=>'<Column ss:AutoFitWidth="1" ss:Width="120"/>').join("");
    const title='<Row ss:Height="26"><Cell ss:StyleID="Title" ss:MergeAcross="'+Math.max(0,sh.headers.length-1)+'"><Data ss:Type="String">'+xmlEsc(sh.title)+'</Data></Cell></Row>';
    const subtitle='<Row><Cell ss:MergeAcross="'+Math.max(0,sh.headers.length-1)+'"><Data ss:Type="String">'+xmlEsc(sh.subtitle||"G10 Transport Scolaire")+'</Data></Cell></Row>';
    const header='<Row>'+sh.headers.map(h=>excelCell(h,"Header")).join("")+'</Row>';
    const rows=sh.rows.map(row=>'<Row>'+row.map((v,i)=>{
      const key=sh.headers[i]||"";
      if(/FCFA|Montant|Recette|Mensuel|Tarif/i.test(key))return excelCell(Number(v||0),"Currency","Number");
      if(/Statut|Accès|Situation|Niveau/i.test(key))return excelCell(v,excelStatusStyle(v));
      return excelCell(v);
    }).join("")+'</Row>').join("");
    const total=sh.totalRow?'<Row>'+sh.totalRow.map((v,i)=>/FCFA|Montant|Recette|Mensuel|Tarif/i.test(sh.headers[i]||"")?excelCell(Number(v||0),"Total","Number"):excelCell(v,"Total")).join("")+'</Row>':"";
    return '<Worksheet ss:Name="'+xmlEsc(sh.name.slice(0,31))+'"><Table>'+cols+title+subtitle+header+rows+total+'</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>';
  }).join("");
  return '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'+
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
    styles+worksheets+'</Workbook>';
}
function downloadStyledExcel(filename,sheets){
  const blob=new Blob([workbookXml(sheets)],{type:"application/vnd.ms-excel;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function warningLevelText(driverId){
  const l=G10.warningLevel(driverId);return l.icon+" "+l.label;
}

window.exportStudentsExcel=()=>{
  const rows=G10.snapshot.students.map(s=>[
    s.name,s.guardian_name,s.guardian_phone,s.zone,s.pickup,s.school,
    s.bus_id?"Bus "+s.bus_id:"",
    s.morning_pickup_planned||"",s.school_start_time||"",s.return_pickup_planned||"",s.return_arrival_planned||"",
    Number(s.monthly_amount||0),G10.statusLabel(s.status)
  ]);
  const total=G10.snapshot.students.reduce((n,s)=>n+Number(s.monthly_amount||0),0);
  downloadStyledExcel("G10_Scolaire_Abonnes.xls",[{
    name:"Abonnés",title:"G10 TRANSPORT SCOLAIRE — ABONNÉS",
    subtitle:"Liste des abonnements scolaires",
    headers:["Élève","Parent","Téléphone","Zone","Arrêt G10","Établissement","Bus","Passage prévu matin","Début des cours","Montée prévue retour","Arrivée prévue retour","Mensuel FCFA","Statut"],
    rows,totalRow:["TOTAL",G10.snapshot.students.length+" abonné(s)","","","","","","","","","",total,""]
  }]);
};

window.exportFaresExcel=()=>{
  const rows=G10.snapshot.fares.map(f=>[f.zone,f.pickup,f.school,Number(f.daily_amount||1500)]);
  downloadStyledExcel("G10_Scolaire_Tarifs.xls",[{
    name:"Tarifs",title:"G10 TRANSPORT SCOLAIRE — TARIFS NON-ABONNÉS",
    subtitle:"Tarifs journaliers par zone, arrêt et établissement",
    headers:["Zone","Arrêt G10","Établissement","Tarif FCFA"],rows
  }]);
};

window.exportDailyExcel=()=>{
  const operational=[];
  G10.snapshot.students.forEach(s=>{
    const m=G10.boardingFor(s.id,"MATIN"),r=G10.boardingFor(s.id,"RETOUR");
    operational.push([
      "Abonné",s.name,s.bus_id?"Bus "+s.bus_id:"",s.zone,s.pickup,s.school,
      G10.statusLabel(m?.status||"ATTENDU"),m?.boarded_at?G10.fmtTime(m.boarded_at):"",
      G10.statusLabel(r?.status||"ATTENDU"),r?.boarded_at?G10.fmtTime(r.boarded_at):"",0
    ]);
  });
  G10.snapshot.dailyRides.forEach(r=>operational.push([
    "Non-abonné","",r.bus_id?"Bus "+r.bus_id:"",G10.zoneFor(r.zone_id)?.name||"",r.stop_name||"",r.destination_name||"",
    r.leg==="MATIN"?G10.statusLabel(r.status):"",r.leg==="MATIN"?G10.fmtTime(r.boarded_at):"",
    r.leg==="RETOUR"?G10.statusLabel(r.status):"",r.leg==="RETOUR"?G10.fmtTime(r.boarded_at):"",
    Number(r.fare_amount||0)
  ]));
  const dailyRevenue=G10.snapshot.dailyRides.reduce((n,r)=>n+Number(r.fare_amount||0),0);

  const discipline=(G10.snapshot.driverWarnings||[]).map(w=>{
    const d=G10.driverFor(w.driver_id);
    return [d?.name||"—",w.complaint_date||"",w.reason,w.details||"",w.recorded_by||"",G10.statusLabel(w.status),warningLevelText(w.driver_id),w.acknowledged_at?"Oui • "+G10.fmtTime(w.acknowledged_at):"Non"];
  });

  const access=(G10.snapshot.drivers||[]).filter(d=>String(d.name||"").trim()).map(d=>[
    d.name,G10.statusLabel(d.active_status),G10.statusLabel(d.access_status||"AUTORISE"),d.archived_at?"Archivé":"En service",G10.confirmedWarningsForDriver(d.id).length
  ]);

  const activity=(G10.snapshot.driverActivity||[]).map(a=>{
    const d=G10.driverFor(a.driver_id),b=G10.busFor(a.bus_id);
    return [a.service_date||"",d?.name||"—",b?.label||("Bus "+a.bus_id),a.leg,Number(a.passengers_transported||0),Number(a.capacity||0),a.capacity?Math.round((Number(a.passengers_transported||0)/Number(a.capacity))*100)+"%":"0%",a.planned_end||"",a.actual_end?G10.fmtTime(a.actual_end):"",a.checklist_ok?"Validé":"Non validé"];
  });

  downloadStyledExcel("G10_Scolaire_Rapport_Complet.xls",[
    {
      name:"Rapport opérationnel",title:"G10 TRANSPORT SCOLAIRE — RAPPORT OPÉRATIONNEL",
      subtitle:"Pointages et recettes du jour",
      headers:["Type","Élève","Bus","Zone","Arrêt","Établissement","Matin","Heure matin","Retour","Heure retour","Recette FCFA"],
      rows:operational,totalRow:["TOTAL",operational.length+" ligne(s)","","","","","","","","",dailyRevenue]
    },
    {
      name:"Discipline chauffeurs",title:"G10 TRANSPORT SCOLAIRE — DISCIPLINE CHAUFFEURS",
      subtitle:"Historique des plaintes et avertissements",
      headers:["Chauffeur","Date","Motif","Détails","Enregistré par","Statut","Niveau","Prise de connaissance"],
      rows:discipline
    },
    {
      name:"Accès chauffeurs",title:"G10 TRANSPORT SCOLAIRE — ACCÈS CHAUFFEURS",
      subtitle:"État des accès et historique d’emploi",
      headers:["Chauffeur","Statut emploi","Accès","Situation","Avertissements confirmés"],rows:access
    },
    {
      name:"Activité chauffeurs",title:"G10 TRANSPORT SCOLAIRE — ACTIVITÉ CHAUFFEURS",
      subtitle:"Données utilisées pour l’indicateur Chauffeur du mois",
      headers:["Date","Chauffeur","Bus","Rotation","Passagers","Capacité","Remplissage","Arrivée prévue","Arrivée réelle","360°"],rows:activity
    }
  ]);
};

window.importStudentsExcel=async input=>{
  const file=input.files&&input.files[0];if(!file)return;
  if(!window.XLSX){G10.toast("Module Excel non chargé.");return}
  try{
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data);
    const ws=wb.Sheets[wb.SheetNames[0]];
    const raw=XLSX.utils.sheet_to_json(ws,{defval:""});
    const rows=raw.map(r=>{
      const busRaw=r["Bus"]||r["bus"]||"";
      const busId=Number(String(busRaw).replace(/\D/g,""))||null;
      return {
        name:r["Nom élève"]||r["Nom"]||r["Élève"]||"",
        guardianName:r["Parent"]||r["Responsable"]||"",
        guardianPhone:r["Téléphone"]||r["Telephone"]||"",
        guardianPin:r["Mot de passe parent"]||"0000",
        zone:r["Zone"]||"",
        pickup:r["Arrêt G10"]||r["Arret G10"]||r["Arrêt"]||"",
        school:r["Établissement"]||r["Etablissement"]||"",
        busId,
        monthlyAmount:Number(r["Abonnement mensuel FCFA"]||r["Mensuel FCFA"]||r["Abonnement FCFA"]||60000),
        status:r["Statut"]||"ACTIF",
        morningPickupPlanned:r["Passage prévu matin"]||"",
        schoolStartTime:r["Début des cours"]||"",
        returnPickupPlanned:r["Montée prévue retour"]||"",
        returnArrivalPlanned:r["Arrivée prévue retour"]||""
      };
    }).filter(r=>String(r.name).trim());
    const out=await G10.api("/school-action",{method:"POST",body:JSON.stringify({action:"IMPORT_STUDENTS",rows})});
    await G10.loadState();
    G10.toast(out.count+" élève(s) importé(s)");
  }catch(e){G10.toast("Import impossible : "+e.message)}
  input.value="";
};