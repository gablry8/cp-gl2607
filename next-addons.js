/*
 * ClimPilot Next — extensions isolées du cœur historique.
 * Aucune donnée n'est envoyée ailleurs : l'OCR est exécuté dans le navigateur.
 */
(function(){
  'use strict';

  const NX_VERSION='Next 1.1.0 navigation & scan';
  const NX_KEYS={
    tasks:'cpnext_tasks',trash:'cpnext_trash',templates:'cpnext_templates',
    history:'cpnext_history',settings:'cpnext_settings',notified:'cpnext_notified',
    quoteDefaults:'cpnext_quote_defaults'
  };
  /* NB Claude : l'historique (10 copies complètes des données) reste LOCAL à chaque appareil —
     le synchroniser multiplierait par ~11 le poids de chaque envoi cloud et un appareil écraserait
     le filet de sécurité de l'autre. Le cloud a déjà l'état courant ; l'historique est un filet local. */
  const NX_SYNC=[NX_KEYS.tasks,NX_KEYS.trash,NX_KEYS.templates,NX_KEYS.settings,NX_KEYS.quoteDefaults];
  try{const ix=SYNC_KEYS.indexOf(NX_KEYS.history);if(ix>=0)SYNC_KEYS.splice(ix,1);}catch(e){}
  const nxLoad=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;}};
  const nxSave=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));try{markDirty();}catch(e){localStorage.setItem('cp2_dirty','1');}};
  const nxId=()=>('NX'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)).toUpperCase();
  const nxEsc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nxDate=s=>{if(!s)return '—';const d=new Date(String(s).length===10?s+'T00:00:00':s);return isNaN(d)?'—':d.toLocaleDateString('fr-FR');};
  const nxDays=(a,b)=>Math.ceil((new Date(b)-new Date(a))/86400000);
  const nxToday=()=>new Date().toISOString().slice(0,10);
  const nxClone=o=>JSON.parse(JSON.stringify(o));
  const nxGetClient=name=>(CLIENTS||[]).find(c=>(c.nom||'').trim().toLowerCase()===(name||'').trim().toLowerCase())||{};

  let nxTasks=nxLoad(NX_KEYS.tasks,[]);
  let nxTrash=nxLoad(NX_KEYS.trash,[]);
  let nxTemplates=nxLoad(NX_KEYS.templates,[]);
  let nxSettings=Object.assign({season:[6,6,7,8,10,13,14,12,8,6,5,5],notifications:false},nxLoad(NX_KEYS.settings,{}));
  let nxSearchItems=[];
  let nxOcrParsed={};
  let nxScanContext={target:'equip'};

  NX_SYNC.forEach(k=>{try{if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(k)<0)SYNC_KEYS.push(k);}catch(e){}});

  function nxToast(message,type){
    let stack=document.querySelector('.next-toast-stack');
    if(!stack){stack=document.createElement('div');stack.className='next-toast-stack';document.body.appendChild(stack);}
    const el=document.createElement('div');el.className='next-toast '+(type||'');el.textContent=message;stack.appendChild(el);
    setTimeout(()=>el.remove(),4200);
  }

  function nxDownload(name,content,type){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:type||'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function nxInjectShell(){
    const top=document.querySelector('.topbar');
    const actions=top&&top.querySelector('.row-actions');
    if(top&&!document.getElementById('nxNavToggle')){
      top.insertAdjacentHTML('afterbegin','<button class="nx-nav-mobile-toggle" id="nxNavToggle" type="button" onclick="nxToggleNav()" aria-label="Ouvrir le menu" aria-expanded="false">☰</button>');
    }
    if(top&&actions&&!document.getElementById('nxSearch')){
      actions.insertAdjacentHTML('beforebegin',`<div class="next-command"><span class="next-search-ico">⌕</span><input id="nxSearch" autocomplete="off" placeholder="Rechercher client, devis, facture, ville…"><kbd>Ctrl K</kbd><div class="next-command-results" id="nxSearchResults"></div></div>`);
    }

    const nav=document.getElementById('nav');
    if(nav&&!nav.querySelector('[data-v="nx_tasks"]')){
      nav.insertAdjacentHTML('beforeend',`
        <div class="sep"></div>
        <a data-v="nx_cockpit"><span class="ico">✨</span><span class="txt">Cockpit Next</span></a>
        <a data-v="nx_tasks"><span class="ico">🔔</span><span class="txt">À faire</span><span class="badge" id="nxTaskBadge">0</span></a>
        <a data-v="nx_templates"><span class="ico">⚡</span><span class="txt">Modèles</span></a>
        <a data-v="nx_scan"><span class="ico">📷</span><span class="txt">Scanner</span></a>
        <a data-v="nx_docs"><span class="ico">📁</span><span class="txt">Registre des documents</span></a>
        <a data-v="nx_tools"><span class="ico">🛡️</span><span class="txt">Sécurité & corbeille</span></a>
        <a data-v="nx_help"><span class="ico">❔</span><span class="txt">Mode d'emploi</span></a>`);
    }

    const content=document.querySelector('.content');
    if(content&&!document.getElementById('v-nx_cockpit')){
      content.insertAdjacentHTML('beforeend',`
        <section class="view" id="v-nx_cockpit"><div id="nxCockpit"></div></section>
        <section class="view" id="v-nx_tasks"><div id="nxTasks"></div></section>
        <section class="view" id="v-nx_templates"><div id="nxTemplates"></div></section>
        <section class="view" id="v-nx_scan"><div id="nxScan"></div></section>
        <section class="view" id="v-nx_docs"><div id="nxDocs"></div></section>
        <section class="view" id="v-nx_tools"><div id="nxTools"></div></section>
        <section class="view" id="v-nx_help"><div id="nxHelp"></div></section>`);
    }

    TITLES.nx_cockpit=['Cockpit Next','Les priorités, risques et opportunités de ton entreprise au même endroit.'];
    TITLES.nx_tasks=['À faire','Les oublis détectés automatiquement et tes tâches personnelles.'];
    TITLES.nx_templates=['Modèles de devis','Crée un devis courant en quelques secondes sans repartir de zéro.'];
    TITLES.nx_scan=['Scanner une photo','Lis une plaque signalétique ou une fiche avec l’appareil photo.'];
    TITLES.nx_tools=['Sécurité & corbeille','Restaure une suppression ou une version antérieure de tes données.'];
    TITLES.nx_help=['Mode d’emploi','Toutes les fonctions de ClimPilot expliquées simplement.'];
    TITLES.nx_docs=['Registre des documents','Tous tes numéros — devis, factures, contrats, fiches fluides — classés et contrôlés.'];

    const dash=document.getElementById('v-dash');
    if(dash&&!document.getElementById('nxDashStrip'))dash.insertAdjacentHTML('afterbegin','<div id="nxDashStrip"></div>');
    const wizBtns=document.querySelector('#v-wizard .flexhead .row-actions');
    if(wizBtns&&!document.getElementById('nxSaveTemplate'))wizBtns.insertAdjacentHTML('afterbegin','<button class="btn-ghost btn-sm" id="nxSaveTemplate" onclick="nxSaveCurrentTemplate()">⚡ Modèle</button>');
    const planActions=document.querySelector('#v-plan .flexhead .row-actions')||document.querySelector('#v-plan .row-actions');
    if(planActions&&!document.getElementById('nxIcsBtn'))planActions.insertAdjacentHTML('beforeend','<button class="btn-ghost btn-sm" id="nxIcsBtn" onclick="nxExportICS()">📅 Calendrier iPhone</button>');

    const equipActions=document.querySelector('#mEquip .navbtns');
    if(equipActions&&!document.getElementById('nxScanEquipBtn'))equipActions.insertAdjacentHTML('afterbegin','<button class="btn-ghost" id="nxScanEquipBtn" type="button" onclick="nxOpenScanner(\'equip\')">📷 Scanner la plaque</button>');
    const fluActions=document.querySelector('#mFlu .navbtns');
    if(fluActions&&!document.getElementById('nxScanFluBtn'))fluActions.insertAdjacentHTML('afterbegin','<button class="btn-ghost" id="nxScanFluBtn" type="button" onclick="nxOpenScanner(\'fluide\')">📷 Scanner la plaque équipement</button>');
    const depFluBtn=Array.from(document.querySelectorAll('#v-dep button')).find(b=>(b.getAttribute('onclick')||'').includes('openFlu'));
    if(depFluBtn&&!document.getElementById('nxScanDepBtn'))depFluBtn.insertAdjacentHTML('beforebegin','<button class="btn-ghost btn-sm" id="nxScanDepBtn" type="button" onclick="nxOpenScannerForIntervention()">📷 Scanner / créer équipement</button>');

    document.body.insertAdjacentHTML('beforeend',`
      <div class="nx-nav-overlay" id="nxNavOverlay" onclick="nxCloseNav()"></div>
      <div class="next-modal" id="nxTaskModal"><div class="next-modal-box"><div class="next-modal-h"><h3>Nouvelle tâche</h3><button class="iconbtn" onclick="nxCloseModal('nxTaskModal')">✕</button></div><div class="next-modal-b"><div class="next-form">
        <label class="full">À faire *<input id="nxTaskTitle" placeholder="Ex : rappeler le fournisseur pour la PAC"></label>
        <label>Échéance<input type="date" id="nxTaskDue"></label><label>Priorité<select id="nxTaskPriority"><option value="high">Haute</option><option value="medium" selected>Moyenne</option><option value="low">Basse</option></select></label>
        <label>Catégorie<select id="nxTaskCat"><option>Administratif</option><option>Client</option><option>Fournisseur</option><option>Chantier</option><option>Stock</option><option>Entretien</option><option>Autre</option></select></label>
        <label>Liée à<input id="nxTaskLink" placeholder="Client, devis, facture…"></label>
      </div><div class="row-actions" style="margin-top:16px"><button class="btn-ghost" onclick="nxCloseModal('nxTaskModal')">Annuler</button><button class="btn-pri" onclick="nxSaveTask()">Enregistrer</button></div></div></div></div>
      <div class="next-modal" id="nxTemplateModal"><div class="next-modal-box"><div class="next-modal-h"><h3>Enregistrer comme modèle</h3><button class="iconbtn" onclick="nxCloseModal('nxTemplateModal')">✕</button></div><div class="next-modal-b"><div class="next-form">
        <label class="full">Nom du modèle *<input id="nxTplName" placeholder="Ex : Monosplit Samsung standard 5 m"></label>
        <label class="full">Description<input id="nxTplDesc" placeholder="Ex : pose simple, support mural, MES incluse"></label>
      </div><div class="row-actions" style="margin-top:16px"><button class="btn-ghost" onclick="nxCloseModal('nxTemplateModal')">Annuler</button><button class="btn-pri" onclick="nxConfirmTemplate()">Créer le modèle</button></div></div></div></div>
      <div class="next-modal nx-scan-modal" id="nxContextScanner"><div class="next-modal-box"><div class="next-modal-h"><div><h3 id="nxCtxScanTitle">Scanner une plaque</h3><div class="sub" id="nxCtxScanSub">Les informations détectées doivent être vérifiées.</div></div><button class="iconbtn" onclick="nxCloseContextScanner()">✕</button></div><div class="next-modal-b">
        <div class="next-grid"><div class="next-card next-col-6"><h3>1. Photographier la plaque</h3><label class="next-drop" id="nxCtxDrop"><input type="file" id="nxCtxOcrFile" accept="image/*" capture="environment"><b>📸 Prendre ou choisir une photo</b><div class="sub">Cadre uniquement la plaque, évite les reflets et garde le texte droit.</div><img id="nxCtxOcrPreview" style="display:none"></label><div class="row-actions" style="margin-top:12px"><button class="btn-pri" type="button" onclick="nxRunContextOCR()">Lire la plaque</button></div><div id="nxCtxOcrProgress" class="sub" style="margin-top:10px"></div></div>
        <div class="next-card next-col-6"><h3>2. Contrôler avant d’utiliser</h3><div id="nxCtxOcrFound"><div class="next-empty">Les champs reconnus apparaîtront ici et resteront modifiables.</div></div></div></div>
      </div></div></div>`);
  }

  /* ===== REGISTRE DES DOCUMENTS (Claude) — tous les numéros classés + contrôle d'intégrité des séries ===== */
  function nxAllDocs(){
    const docs=[];const st={brouillon:'Brouillon',verifier:'À vérifier',pret:'Prêt',envoye:'Envoyé',accepte:'Accepté',refuse:'Refusé'};
    (DEVIS||[]).forEach(d=>{let m=0;try{m=Math.round(compute(d).totalHT*100)/100;}catch(e){}
      docs.push({num:d.num||'',type:'Devis',date:d.created?new Date(d.created).toISOString().slice(0,10):'',client:d.cNom||'—',montant:m,statut:st[d.statut]||d.statut,open:"openDevis('"+d.id+"')"});
      [['facAcompte','Facture (acompte)'],['facSolde','Facture']].forEach(p=>{const f=d[p[0]];
        if(f)docs.push({num:f.num,type:'Facture',stype:p[1],date:f.date||'',client:d.cNom||'—',montant:f.montant,statut:f.payeLe?'✔ Payée':'⌛ À encaisser',open:"openDevis('"+d.id+"')"});});});
    (DEP||[]).forEach(x=>{if(x.facNum){let m=0;try{m=Math.round(computeDep(x).totalHT*100)/100;}catch(e){}
      docs.push({num:x.facNum,type:'Facture',stype:x.itype==='mes'?'Facture (MES)':'Facture (dépannage)',date:x.facDate||x.date||'',client:x.cNom||'—',montant:m,statut:x.statut==='payee'?'✔ Payée':'⌛ À encaisser',open:"openDep('"+x.id+"')"});}});
    (LOC||[]).forEach(l=>{let m=0;try{m=Math.round(computeLoc(l).totalHT*100)/100;}catch(e){}
      if(l.num)docs.push({num:l.num,type:'Contrat location',date:l.dateDebut||'',client:l.cNom||'—',montant:m,statut:({reserve:'Réservé',encours:'En cours',rendu:'Rendue'})[l.statut]||l.statut,open:"go('loc')"});
      if(l.fac)docs.push({num:l.fac.num,type:'Facture',stype:'Facture (location)',date:l.fac.date||'',client:l.cNom||'—',montant:l.fac.montant,statut:l.fac.payeLe?'✔ Payée':'⌛ À encaisser',open:"go('loc')"});});
    (CTR||[]).forEach(c=>{(c.facs||[]).forEach(f=>{docs.push({num:f.num,type:'Facture',stype:'Facture (entretien '+f.annee+')',date:f.date||'',client:c.clientNom||'—',montant:f.montant,statut:f.payeLe?'✔ Payée':'⌛ À encaisser',open:"go('contrats')"});});});
    (typeof FLU!=='undefined'?FLU:[]).forEach(f=>docs.push({num:f.num||'',type:'Fiche fluides',date:f.date||'',client:f.client||'—',montant:null,statut:'',open:"go('fluides')"}));
    return docs;
  }
  function nxSerieCheck(nums){
    const by={},dups=[],seen={};
    nums.forEach(n=>{const m=String(n).match(/^([A-Z]+)-(\d{4})-(\d+)$/);if(!m)return;
      if(seen[n])dups.push(n);seen[n]=1;
      const key=m[1]+'-'+m[2];(by[key]=by[key]||[]).push(parseInt(m[3],10));});
    const gaps=[];
    Object.entries(by).forEach(([key,arr])=>{const set=new Set(arr);const max=Math.max.apply(null,arr);
      for(let i=1;i<=max;i++){if(!set.has(i))gaps.push(key+'-'+String(i).padStart(3,'0'));}});
    return {gaps,dups};
  }
  function nxRenderDocs(){
    const box=document.getElementById('nxDocs');if(!box)return;
    const docs=nxAllDocs();
    const years=[...new Set(docs.map(d=>(d.date||'').slice(0,4)).filter(Boolean))].sort().reverse();
    const y=(document.getElementById('nxDocsYear')||{}).value||years[0]||String(new Date().getFullYear());
    const ty=(document.getElementById('nxDocsType')||{}).value||'';
    const tri=(document.getElementById('nxDocsTri')||{}).value||'num';
    let rows=docs.filter(d=>(!y||(d.date||'').slice(0,4)===y)&&(!ty||d.type===ty));
    rows.sort((a,b)=>tri==='date'?((b.date||'')<(a.date||'')?-1:1):tri==='montant'?((b.montant||0)-(a.montant||0)):String(a.num).localeCompare(String(b.num),undefined,{numeric:true}));
    const chk=nxSerieCheck(docs.filter(d=>d.type==='Facture').map(d=>d.num));
    const chkL=nxSerieCheck(docs.filter(d=>d.type==='Contrat location').map(d=>d.num));
    const nFac=docs.filter(d=>d.type==='Facture'&&(d.date||'').slice(0,4)===y);
    const att=nFac.filter(d=>d.statut.indexOf('encaisser')>=0);
    box.innerHTML=
     '<div class="next-hero"><h2>📁 Registre des documents</h2><p>Chaque numéro à sa place : devis DV-, factures F- (série continue commune : chantiers, interventions, locations, entretien), contrats L-, fiches fluides FF-. Le registre contrôle la continuité tout seul.</p></div>'
     +(chk.gaps.length?'<div class="warnbox" style="border-color:var(--red);color:var(--red)">🚨 <b>Trous dans la série de factures :</b> '+chk.gaps.join(', ')+'. Une série de factures doit être CONTINUE (obligation comptable). Une facture ratée ne se supprime pas : elle s\'annule par un avoir et garde son numéro. Vérifie la corbeille (Sécurité & corbeille) pour restaurer.</div>':'')
     +(chk.dups.length?'<div class="warnbox" style="border-color:var(--red);color:var(--red)">🚨 <b>Numéros de facture en DOUBLE :</b> '+chk.dups.join(', ')+' — à corriger immédiatement.</div>':'')
     +(chkL.dups.length?'<div class="warnbox">⚠ Contrats de location en double : '+chkL.dups.join(', ')+'</div>':'')
     +(!chk.gaps.length&&!chk.dups.length?'<div class="warnbox" style="background:var(--green-soft);border-color:#b7e3c6;color:#0f6b39">✅ Séries de numéros propres : aucune facture manquante, aucun doublon.</div>':'')
     +'<div class="kpis">'
     +'<div class="kpi blue"><div class="lab">Documents '+(y||'—')+'<span>📁</span></div><div class="val">'+rows.length+'</div></div>'
     +'<div class="kpi good"><div class="lab">Factures '+(y||'—')+'<span>🧾</span></div><div class="val">'+nFac.length+'</div></div>'
     +'<div class="kpi warn"><div class="lab">À encaisser<span>⌛</span></div><div class="val">'+att.length+' ('+eur0(att.reduce((s,d)=>s+(d.montant||0),0))+')</div></div></div>'
     +'<div class="card"><div class="row-actions" style="margin-bottom:10px">'
     +'<select id="nxDocsYear" style="max-width:110px" onchange="nxRenderDocs()">'+years.map(x=>'<option'+(x===y?' selected':'')+'>'+x+'</option>').join('')+'</select>'
     +'<select id="nxDocsType" style="max-width:170px" onchange="nxRenderDocs()"><option value=""'+(ty===''?' selected':'')+'>Tous les types</option>'+['Devis','Facture','Contrat location','Fiche fluides'].map(t=>'<option'+(t===ty?' selected':'')+'>'+t+'</option>').join('')+'</select>'
     +'<select id="nxDocsTri" style="max-width:150px" onchange="nxRenderDocs()"><option value="num"'+(tri==='num'?' selected':'')+'>Tri : n° croissant</option><option value="date"'+(tri==='date'?' selected':'')+'>Tri : plus récents</option><option value="montant"'+(tri==='montant'?' selected':'')+'>Tri : montant ↓</option></select>'
     +'<button class="btn-ghost btn-sm" onclick="nxExportDocsCSV()">📊 Export CSV du registre</button></div>'
     +(rows.length?'<div class="scroll"><table><thead><tr><th class="l">N°</th><th class="l">Type</th><th class="l">Date</th><th class="l">Client</th><th>Montant HT</th><th class="l">Statut</th></tr></thead><tbody>'
       +rows.map(d=>'<tr style="cursor:pointer" onclick="'+d.open+'"><td class="l"><b>'+nxEsc(d.num||'—')+'</b></td><td class="l">'+nxEsc(d.stype||d.type)+'</td><td class="l">'+(d.date?nxDate(d.date):'—')+'</td><td class="l">'+nxEsc(d.client)+'</td><td>'+(d.montant!=null?eur(d.montant):'—')+'</td><td class="l">'+nxEsc(d.statut)+'</td></tr>').join('')
       +'</tbody></table></div><div class="sub" style="margin-top:8px">Clique une ligne pour ouvrir le document. Astuce classement PC : enregistre chaque PDF sous « N°_Client.pdf » (ex. F-2026-012_GarageMartin.pdf) dans le dossier GL_Entreprise correspondant.</div>'
       :'<div class="next-empty">Aucun document pour ce filtre.</div>')+'</div>';
  }
  function nxExportDocsCSV(){
    const docs=nxAllDocs();if(!docs.length){nxToast('Aucun document');return;}
    const nf=n=>n==null?'':String(Math.round(n*100)/100).replace('.',',');
    const esc2=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
    const csv='﻿'+[['N°','Type','Date','Client','Montant HT','Statut']].concat(
      docs.sort((a,b)=>String(a.num).localeCompare(String(b.num),undefined,{numeric:true}))
        .map(d=>[d.num,d.stype||d.type,d.date,d.client,nf(d.montant),d.statut])).map(r=>r.map(esc2).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ClimPilot_registre_documents_'+nxToday()+'.csv';a.click();
    nxToast('📁 Registre exporté — archive-le avec ta compta','ok');
  }
  Object.assign(window,{nxRenderDocs,nxExportDocsCSV});

  const nxRenderers={
    nx_cockpit:nxRenderCockpit,nx_tasks:nxRenderTasks,nx_templates:nxRenderTemplates,
    nx_scan:nxRenderScan,nx_tools:nxRenderTools,nx_help:nxRenderHelp,nx_docs:nxRenderDocs
  };

  function nxPatchNavigation(){
    const original=go;
    window.go=function(v){
      original(v);
      if(nxRenderers[v])nxRenderers[v]();
      if(v==='dash')nxRenderDashStrip();
      nxRevealNavForView(v);
      nxCloseNav();
    };
  }

  function nxAutoTasks(){
    const now=Date.now(),today=nxToday(),out=[];
    (DEVIS||[]).forEach(d=>{
      if(d.statut==='accepte'&&!d.datePlanif)out.push({id:'auto-plan-'+d.id,auto:true,priority:'high',cat:'Planning',title:'Planifier le chantier '+(d.cNom||d.num),detail:d.type+' · devis accepté',action:()=>openDevis(d.id)});
      if(d.statut==='envoye'&&d.sentAt&&now-Number(d.sentAt)>7*86400000)out.push({id:'auto-rel-'+d.id,auto:true,priority:'medium',cat:'Commercial',title:'Relancer '+(d.cNom||d.num),detail:'Devis envoyé depuis '+Math.floor((now-d.sentAt)/86400000)+' jours',action:()=>mailRelance(d.id)});
      if(d.statut==='accepte'&&!d.hReel&&d.datePlanif&&d.datePlanif<today)out.push({id:'auto-real-'+d.id,auto:true,priority:'medium',cat:'Rentabilité',title:'Saisir le réel — '+(d.cNom||d.num),detail:'Heures et achats réels manquants',action:()=>openDevis(d.id)});
    });
    try{(allImpayes()||[]).forEach(i=>{const age=Math.floor((now-new Date(i.date).getTime())/86400000);if(age>=30)out.push({id:'auto-pay-'+i.kind+i.id+(i.which||''),auto:true,priority:'high',cat:'Paiement',title:'Facture '+i.num+' impayée',detail:(i.client||'Client')+' · '+age+' jours · '+eur(i.montant),action:()=>mailRelancePaiement(i.kind,i.id,i.which)});});}catch(e){}
    (CTR||[]).forEach(c=>{if(c.actif!==false&&c.prochaineVisite&&nxDays(today,c.prochaineVisite)<=30)out.push({id:'auto-ctr-'+c.id,auto:true,priority:c.prochaineVisite<today?'high':'medium',cat:'Entretien',title:(c.prochaineVisite<today?'Visite en retard — ':'Préparer la visite — ')+(c.clientNom||'?'),detail:(c.type||'')+' · '+nxDate(c.prochaineVisite),action:()=>go('contrats')});});
    const lastBk=Number(localStorage.getItem('cp2_lastbackup')||0);if(!lastBk||now-lastBk>7*86400000)out.push({id:'auto-bk',auto:true,priority:'medium',cat:'Sécurité',title:'Faire une sauvegarde JSON',detail:'Dernière sauvegarde il y a plus de 7 jours',action:()=>exportJSON()});
    if(localStorage.getItem('cp2_dirty'))out.push({id:'auto-sync',auto:true,priority:'high',cat:'Cloud',title:'Données non synchronisées',detail:'Appuie sur “Synchroniser” quand le réseau est disponible',action:()=>pushState(true)});
    try{
      const need={};(DEVIS||[]).filter(d=>d.statut==='accepte').forEach(d=>compute(d).mat.forEach(m=>{need[m.nom]=(need[m.nom]||0)+Number(m.qte||0);}));
      const shortages=Object.keys(need).filter(n=>need[n]>Number((STOCK||{})[n]||0));
      if(shortages.length)out.push({id:'auto-stock',auto:true,priority:'medium',cat:'Stock',title:shortages.length+' article(s) à commander',detail:'Le stock ne couvre pas les chantiers signés',action:()=>go('commander')});
    }catch(e){}
    return out;
  }

  function nxOpenAuto(t){try{if(typeof t.action==='function')t.action();}catch(e){nxToast('Impossible d’ouvrir cet élément','err');}}

  function nxPending(){return nxTasks.filter(t=>!t.done).concat(nxAutoTasks());}

  function nxRenderDashStrip(){
    const box=document.getElementById('nxDashStrip');if(!box)return;
    const all=nxPending(),urgent=all.filter(t=>t.priority==='high').length;
    const unpaid=(()=>{try{return allImpayes().filter(x=>(Date.now()-new Date(x.date).getTime())>=30*86400000).length;}catch(e){return 0;}})();
    const unplanned=(DEVIS||[]).filter(d=>d.statut==='accepte'&&!d.datePlanif).length;
    box.innerHTML=`<div class="next-card" style="margin-bottom:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-left:4px solid ${urgent?'var(--next-rose)':'var(--next-mint)'}"><div style="font-size:22px">${urgent?'🚨':'✅'}</div><div style="flex:1"><b>${urgent?urgent+' priorité(s) urgente(s)':'Aucune urgence détectée'}</b><div class="sub">${all.length} action(s) ouvertes · ${unpaid} impayé(s) ancien(s) · ${unplanned} chantier(s) à planifier</div></div><button class="btn-next-accent" onclick="go('nx_tasks')">Voir ce qu’il faut faire</button><button class="btn-ghost" onclick="go('nx_cockpit')">Cockpit Next</button></div>`;
  }

  function nxStats(){
    const sent=(DEVIS||[]).filter(d=>['envoye','accepte','refuse'].includes(d.statut));
    const accepted=sent.filter(d=>d.statut==='accepte');
    const conv=sent.length?accepted.length/sent.length*100:0;
    let recurring=0;(CTR||[]).filter(c=>c.actif!==false).forEach(c=>recurring+=Number(c.prix||0));
    const eq=(EQUIP||[]).length;
    let encaissed=0;try{encaissed=(allRecettes()||[]).reduce((s,r)=>s+Number(r.montant||0),0);}catch(e){}
    return {sent:sent.length,accepted:accepted.length,conv,recurring,eq,encaissed};
  }

  function nxRenderCockpit(){
    const box=document.getElementById('nxCockpit');if(!box)return;
    const s=nxStats(),tasks=nxPending(),urgent=tasks.filter(t=>t.priority==='high');
    const m=new Date().getMonth(),obj=Number((P&&P.objectifCA)||74450),mObj=obj*(Number(nxSettings.season[m]||0)/100);
    const year=new Date().getFullYear(),month=new Date().getMonth();let monthCA=0;
    try{monthCA=(allRecettes()||[]).filter(r=>{const d=new Date(r.date);return d.getFullYear()===year&&d.getMonth()===month;}).reduce((x,r)=>x+Number(r.montant||0),0);}catch(e){}
    const origins={};(CLIENTS||[]).forEach(c=>{const k=c.source||'Non renseignée';origins[k]=(origins[k]||0)+1;});
    box.innerHTML=`
      <div class="next-hero"><h2>✨ ClimPilot Next</h2><p>Ton copilote de dirigeant : il surveille les oublis, sécurise les données et te montre où agir aujourd’hui.</p><div class="next-actions"><button onclick="go('nx_tasks')">🔔 ${tasks.length} action(s)</button><button onclick="nxOpenTaskModal()">＋ Ajouter une tâche</button><button onclick="nxOpenScanner('equip')">📷 Scanner une plaque</button><button onclick="nxExportICS()">📅 Export iPhone</button></div></div>
      <div class="next-stat-row">
        <div class="next-stat"><small>Encaissé</small><strong>${eur0(s.encaissed)}</strong></div>
        <div class="next-stat"><small>Conversion devis</small><strong>${fmtQ(s.conv)} %</strong><span class="sub">${s.accepted}/${s.sent} décisions</span></div>
        <div class="next-stat"><small>CA récurrent annuel</small><strong>${eur0(s.recurring)}</strong></div>
        <div class="next-stat"><small>Parc suivi</small><strong>${s.eq}</strong><span class="sub">équipement(s)</span></div>
      </div>
      <div class="next-grid">
        <div class="next-card next-col-7"><div class="next-card-h"><h3>🚨 Priorités</h3><button class="btn-ghost btn-sm" onclick="go('nx_tasks')">Tout voir</button></div>${urgent.length?urgent.slice(0,6).map(nxTaskHtml).join(''):'<div class="next-empty"><span class="big">✅</span>Rien d’urgent aujourd’hui.</div>'}</div>
        <div class="next-card next-col-5"><h3>🎯 Objectif saisonnier — ${new Date().toLocaleDateString('fr-FR',{month:'long'})}</h3><div style="font-size:25px;font-weight:800">${eur0(monthCA)} <span class="sub">/ ${eur0(mObj)}</span></div><div class="next-progress" style="margin:12px 0 7px"><i style="width:${Math.min(100,mObj?monthCA/mObj*100:0)}%"></i></div><div class="sub">Objectif pondéré : ${nxSettings.season[m]} % de l’objectif annuel. Il suit la saison clim/adia.</div></div>
        <div class="next-card next-col-6"><h3>📣 Origine des clients</h3>${Object.keys(origins).length?Object.entries(origins).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #edf1f5"><span>${nxEsc(k)}</span><b>${v}</b></div>`).join(''):'<div class="next-empty">Renseigne l’origine dans les fiches clients.</div>'}</div>
        <div class="next-card next-col-6"><h3>🛡️ Sécurité des données</h3>${nxSecuritySummary()}</div>
      </div>`;
  }

  function nxTaskHtml(t){
    const pri=t.priority==='high'?'red':t.priority==='medium'?'amber':'blue';
    return `<div class="next-task ${t.priority==='high'?'overdue':''}">${t.auto?'<span>⚙️</span>':`<input type="checkbox" ${t.done?'checked':''} onchange="nxToggleTask('${t.id}')">`}<div><b>${nxEsc(t.title)}</b><small>${nxEsc(t.cat||'')} ${t.detail?'· '+nxEsc(t.detail):''}${t.due?' · '+nxDate(t.due):''}</small></div><div class="next-task-actions"><span class="next-pill ${pri}">${t.priority==='high'?'Urgent':t.priority==='medium'?'À faire':'Faible'}</span>${t.auto?`<button class="iconbtn" onclick="nxRunAuto('${t.id}')">›</button>`:`<button class="iconbtn d" onclick="nxDeleteTask('${t.id}')">🗑</button>`}</div></div>`;
  }

  function nxRenderTasks(){
    const box=document.getElementById('nxTasks');if(!box)return;
    const auto=nxAutoTasks(),custom=nxTasks.slice().sort((a,b)=>(a.done-b.done)||String(a.due||'9999').localeCompare(String(b.due||'9999')));
    box.innerHTML=`<div class="next-hero"><h2>🔔 Centre d’actions</h2><p>Les tâches automatiques disparaissent quand tu règles la cause. Tes tâches personnelles restent jusqu’à ce que tu les coches.</p><div class="next-actions"><button onclick="nxOpenTaskModal()">＋ Nouvelle tâche</button><button onclick="nxEnableNotifications()">🔔 Activer les notifications</button></div></div><div class="next-grid"><div class="next-card next-col-7"><h3>Détectées automatiquement (${auto.length})</h3>${auto.length?auto.map(nxTaskHtml).join(''):'<div class="next-empty"><span class="big">✅</span>Aucun oubli détecté.</div>'}</div><div class="next-card next-col-5"><h3>Mes tâches (${custom.filter(t=>!t.done).length})</h3>${custom.length?custom.map(nxTaskHtml).join(''):'<div class="next-empty">Ajoute ici un rappel qui ne vient pas d’un devis.</div>'}</div></div>`;
    nxUpdateTaskBadge();
  }

  function nxOpenTaskModal(){document.getElementById('nxTaskTitle').value='';document.getElementById('nxTaskDue').value=nxToday();document.getElementById('nxTaskModal').classList.add('on');setTimeout(()=>document.getElementById('nxTaskTitle').focus(),80);}
  function nxCloseModal(id){const e=document.getElementById(id);if(e)e.classList.remove('on');}
  function nxSaveTask(){const title=document.getElementById('nxTaskTitle').value.trim();if(!title){nxToast('Renseigne ce qu’il faut faire','warn');return;}nxTasks.push({id:nxId(),title,due:document.getElementById('nxTaskDue').value,priority:document.getElementById('nxTaskPriority').value,cat:document.getElementById('nxTaskCat').value,link:document.getElementById('nxTaskLink').value.trim(),done:false,created:Date.now()});nxSave(NX_KEYS.tasks,nxTasks);nxCloseModal('nxTaskModal');nxRenderTasks();nxNotifyUrgent();}
  function nxToggleTask(id){const t=nxTasks.find(x=>x.id===id);if(t){t.done=!t.done;t.doneAt=t.done?Date.now():null;nxSave(NX_KEYS.tasks,nxTasks);nxRenderTasks();}}
  function nxDeleteTask(id){nxTasks=nxTasks.filter(x=>x.id!==id);nxSave(NX_KEYS.tasks,nxTasks);nxRenderTasks();}
  function nxRunAuto(id){const t=nxAutoTasks().find(x=>x.id===id);if(t)nxOpenAuto(t);}
  function nxUpdateTaskBadge(){const e=document.getElementById('nxTaskBadge');if(e)e.textContent=nxPending().length;}

  function nxEnableNotifications(){
    if(!('Notification' in window)){nxToast('Notifications non disponibles sur ce navigateur','warn');return;}
    Notification.requestPermission().then(p=>{nxSettings.notifications=p==='granted';nxSave(NX_KEYS.settings,nxSettings);nxToast(p==='granted'?'Notifications activées':'Autorisation refusée',p==='granted'?'ok':'warn');if(p==='granted')nxNotifyUrgent(true);});
  }
  function nxNotifyUrgent(force){
    if(!nxSettings.notifications||!('Notification' in window)||Notification.permission!=='granted')return;
    const urgent=nxPending().filter(t=>t.priority==='high'),stamp=nxLoad(NX_KEYS.notified,'');
    if(urgent.length&&(force||stamp!==nxToday())){new Notification('ClimPilot — '+urgent.length+' priorité(s)',{body:urgent.slice(0,3).map(t=>t.title).join(' · '),icon:'icon-192.png'});localStorage.setItem(NX_KEYS.notified,JSON.stringify(nxToday()));}
  }

  function nxSecuritySummary(){
    const hist=nxLoad(NX_KEYS.history,[]),dirty=!!localStorage.getItem('cp2_dirty'),last=Number(localStorage.getItem('cp2_lastbackup')||0);
    return `<div style="display:grid;gap:9px"><div>Cloud <span class="next-pill ${dirty?'red':'green'}">${dirty?'à synchroniser':'synchronisé'}</span></div><div>Sauvegarde JSON <span class="next-pill ${!last||Date.now()-last>7*86400000?'amber':'green'}">${last?nxDate(last):'jamais'}</span></div><div>Historique <span class="next-pill blue">${hist.length}/10 versions</span></div><div>Corbeille <span class="next-pill blue">${nxTrash.length} élément(s)</span></div><button class="btn-ghost" onclick="go('nx_tools')">Ouvrir les protections</button></div>`;
  }

  // Exposition des actions appelées depuis le HTML injecté.
  Object.assign(window,{nxToast,nxCloseModal,nxOpenTaskModal,nxSaveTask,nxToggleTask,nxDeleteTask,nxRunAuto,nxEnableNotifications});

  /* ---------- Recherche globale ---------- */
  function nxBuildSearch(){
    const items=[];
    (CLIENTS||[]).forEach(c=>items.push({type:'Client',ico:'👤',title:c.nom||'Client',sub:[c.ville,c.tel,c.mail].filter(Boolean).join(' · '),terms:[c.nom,c.ville,c.tel,c.mail],run:()=>openClient360(c.id)}));
    (DEVIS||[]).forEach(d=>items.push({type:'Devis',ico:'📝',title:d.num||'Devis',sub:[d.cNom,d.type,d.cVille,d.statut].filter(Boolean).join(' · '),terms:[d.num,d.cNom,d.type,d.cVille,d.facAcompte&&d.facAcompte.num,d.facSolde&&d.facSolde.num,d.facTotale&&d.facTotale.num],run:()=>openDevis(d.id)}));
    (DEP||[]).forEach(x=>items.push({type:'Intervention',ico:'🔧',title:x.facNum||('Intervention '+(x.cNom||'')),sub:[x.cNom,x.cVille,x.date].filter(Boolean).join(' · '),terms:[x.facNum,x.cNom,x.cVille,x.desc],run:()=>openDep(x.id)}));
    (LOC||[]).forEach(x=>items.push({type:'Location',ico:'💨',title:x.num||'Location',sub:[x.cNom,x.cVille,x.statut].filter(Boolean).join(' · '),terms:[x.num,x.cNom,x.cVille,x.fac&&x.fac.num],run:()=>openLoc(x.id)}));
    (EQUIP||[]).forEach(x=>items.push({type:'Équipement',ico:'🏷️',title:[x.marque,x.modele].filter(Boolean).join(' ')||x.type,sub:[x.client,x.serie,x.fluide].filter(Boolean).join(' · '),terms:[x.client,x.type,x.marque,x.modele,x.serie,x.fluide],run:()=>openEquip(x.id)}));
    (CTR||[]).forEach(x=>items.push({type:'Contrat',ico:'🤝',title:'Contrat '+(x.clientNom||''),sub:[x.type,x.prochaineVisite].filter(Boolean).join(' · '),terms:[x.clientNom,x.type,x.prochaineVisite],run:()=>go('contrats')}));
    (FLU||[]).forEach(x=>items.push({type:'Fluide',ico:'🧪',title:x.num||'Fiche fluide',sub:[x.client,x.fluide,x.date].filter(Boolean).join(' · '),terms:[x.num,x.client,x.desc,x.fluide],run:()=>go('fluides')}));
    items.push(
      {type:'Action',ico:'＋',title:'Nouveau devis',sub:'Créer une proposition',terms:['nouveau devis créer'],run:()=>{go('wizard');newDevis();}},
      {type:'Action',ico:'🔧',title:'Nouvelle intervention',sub:'Dépannage ou mise en service',terms:['dépannage intervention mes'],run:()=>newDep('dep')},
      {type:'Action',ico:'💨',title:'Nouvelle location adia',sub:'Contrat et réservation',terms:['location adiabatique'],run:()=>newLoc()},
      {type:'Action',ico:'🤝',title:'Nouveau contrat d’entretien',sub:'Assistant guidé',terms:['contrat entretien maintenance'],run:()=>nxOpenContractWizard()},
      {type:'Action',ico:'📷',title:'Scanner une plaque',sub:'Préremplir un équipement sans quitter le formulaire',terms:['scan photo ocr plaque équipement'],run:()=>nxOpenScanner('equip')}
    );
    nxSearchItems=items;return items;
  }

  const nxNorm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function nxSearch(q){
    const terms=nxNorm(q).split(/\s+/).filter(Boolean);if(!terms.length)return [];
    return nxBuildSearch().map(x=>{const hay=nxNorm([x.title,x.sub].concat(x.terms||[]).join(' '));const score=terms.reduce((s,t)=>s+(hay.indexOf(t)>=0?1:0),0);return {x,score};}).filter(o=>o.score===terms.length).sort((a,b)=>b.score-a.score).slice(0,12).map(o=>o.x);
  }
  function nxRenderSearch(q){
    const box=document.getElementById('nxSearchResults');if(!box)return;
    const a=nxSearch(q);box.classList.toggle('on',!!q);box.innerHTML=a.length?a.map((x,i)=>`<div class="next-result ${i===0?'active':''}" data-nx-search="${i}"><span class="nr-ico">${x.ico}</span><div><b>${nxEsc(x.title)}</b><small>${nxEsc(x.sub)}</small></div><span class="nr-type">${nxEsc(x.type)}</span></div>`).join(''):'<div class="next-empty">Aucun résultat</div>';
    box.querySelectorAll('[data-nx-search]').forEach(el=>el.onclick=()=>{const it=a[Number(el.dataset.nxSearch)];box.classList.remove('on');document.getElementById('nxSearch').value='';if(it)it.run();});
  }
  function nxBindSearch(){
    const input=document.getElementById('nxSearch'),box=document.getElementById('nxSearchResults');if(!input)return;
    input.addEventListener('input',()=>nxRenderSearch(input.value));
    input.addEventListener('keydown',e=>{if(e.key==='Escape'){box.classList.remove('on');input.blur();}if(e.key==='Enter'){const first=box.querySelector('[data-nx-search]');if(first)first.click();}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select();}});
    document.addEventListener('click',e=>{if(!e.target.closest('.next-command'))box.classList.remove('on');});
  }

  /* ---------- Origine client et conversion ---------- */
  function nxInjectOrigin(){
    const city=document.getElementById('f_cVille');if(city&&!document.getElementById('f_source'))city.closest('label').insertAdjacentHTML('afterend',`<label>Comment il t’a connu<select id="f_source"><option value="">— à renseigner —</option><option>Recommandation</option><option>Google / site web</option><option>Réseaux sociaux</option><option>Sous-traitance</option><option>Prospection directe</option><option>Ancien client</option><option>Autre</option></select></label>`);
    const mcVille=document.getElementById('mc_ville');if(mcVille&&!document.getElementById('mc_source'))mcVille.closest('label').insertAdjacentHTML('afterend',`<label>Origine<select id="mc_source"><option value="">— à renseigner —</option><option>Recommandation</option><option>Google / site web</option><option>Réseaux sociaux</option><option>Sous-traitance</option><option>Prospection directe</option><option>Ancien client</option><option>Autre</option></select></label>`);
  }
  function nxPatchOrigins(){
    const oldLoad=loadDevisToForm;window.loadDevisToForm=function(){oldLoad();const e=document.getElementById('f_source');if(e)e.value=(cur&&cur.source)||((nxGetClient(cur&&cur.cNom)||{}).source)||'';};
    const oldForm=formToDevis;window.formToDevis=function(){oldForm();const e=document.getElementById('f_source');if(cur&&e)cur.source=e.value||'';};
    const oldAuto=autofillClient;window.autofillClient=function(){oldAuto();const e=document.getElementById('f_source'),c=nxGetClient(document.getElementById('f_cNom').value);if(e)e.value=c.source||'';};
    const oldUpsert=upsertClient;window.upsertClient=function(){oldUpsert();if(!cur||!cur.cNom)return;const c=nxGetClient(cur.cNom);if(c){c.source=cur.source||c.source||'';save(LS.clients,CLIENTS);}};
    const oldEdit=editClient;window.editClient=function(id){oldEdit(id);const c=CLIENTS.find(x=>x.id===id),e=document.getElementById('mc_source');if(e)e.value=(c&&c.source)||'';};
    const oldSaveClient=saveClient;window.saveClient=function(){const id=document.getElementById('mc_id').value,source=(document.getElementById('mc_source')||{}).value||'';oldSaveClient();const c=CLIENTS.find(x=>x.id===id)||CLIENTS[CLIENTS.length-1];if(c){c.source=source;save(LS.clients,CLIENTS);}};
  }

  /* ---------- Modèles de devis ---------- */
  const NX_TEMPLATE_FIELDS=['type','nbMach','nbSplit','machines','splits','groupCable','groupLong','goulottes','condLong','support','pompeType','pompeQte','taille','extras','heures','moMode','rateChoice','rateCustom','acces','zone','mes','brasure','supp','tests','tvaRate','acompteOn','acomptePct','notes','elecMode','breakerManual','breakerQte','differential','diffQte','proximity'];
  function nxSaveCurrentTemplate(){if(!window.cur){nxToast('Ouvre d’abord un devis','warn');return;}document.getElementById('nxTplName').value=(cur.type||'Devis')+' standard';document.getElementById('nxTplDesc').value='';document.getElementById('nxTemplateModal').classList.add('on');}
  function nxConfirmTemplate(){
    const name=document.getElementById('nxTplName').value.trim();if(!name){nxToast('Donne un nom au modèle','warn');return;}
    const data={};NX_TEMPLATE_FIELDS.forEach(k=>data[k]=nxClone(cur[k]));nxTemplates.push({id:nxId(),name,desc:document.getElementById('nxTplDesc').value.trim(),type:cur.type,data,created:Date.now(),uses:0});nxSave(NX_KEYS.templates,nxTemplates);nxCloseModal('nxTemplateModal');nxToast('Modèle créé','ok');
  }
  function nxUseTemplate(id){const t=nxTemplates.find(x=>x.id===id);if(!t)return;go('wizard');newDevis();const identity={id:cur.id,num:cur.num,created:cur.created};Object.assign(cur,nxClone(t.data),identity,{statut:'brouillon',cNom:'',cTel:'',cMail:'',cType:'Particulier',cAdr:'',cVille:'',source:''});t.uses=(t.uses||0)+1;nxSave(NX_KEYS.templates,nxTemplates);loadDevisToForm();curStep=0;showStep();nxToast('Modèle appliqué — renseigne le client','ok');}
  function nxDeleteTemplate(id){if(!confirm('Supprimer ce modèle ?'))return;nxTemplates=nxTemplates.filter(x=>x.id!==id);nxSave(NX_KEYS.templates,nxTemplates);nxRenderTemplates();}
  function nxRenderTemplates(){
    const box=document.getElementById('nxTemplates');if(!box)return;
    box.innerHTML=`<div class="next-hero"><h2>⚡ Devis en quelques secondes</h2><p>Ouvre un devis bien configuré puis clique « Modèle ». Le modèle conserve matériel, longueurs, main-d’œuvre et options, jamais le client ni le numéro.</p><div class="next-actions"><button onclick="go('wizard');newDevis()">＋ Créer un devis</button></div></div><div class="next-grid">${nxTemplates.length?nxTemplates.map(t=>`<div class="next-card next-col-4"><span class="next-pill blue">${nxEsc(t.type||'Devis')}</span><h3 style="margin-top:10px">${nxEsc(t.name)}</h3><p class="sub">${nxEsc(t.desc||'Aucune description')}</p><div class="sub">Utilisé ${t.uses||0} fois · créé le ${nxDate(t.created)}</div><div class="row-actions" style="margin-top:12px"><button class="btn-pri" onclick="nxUseTemplate('${t.id}')">Utiliser</button><button class="iconbtn d" onclick="nxDeleteTemplate('${t.id}')">🗑</button></div></div>`).join(''):'<div class="next-card next-col-12"><div class="next-empty"><span class="big">⚡</span>Aucun modèle. Ouvre un devis courant et clique « Modèle » en haut.</div></div>'}</div>`;
  }

  Object.assign(window,{nxSaveCurrentTemplate,nxConfirmTemplate,nxUseTemplate,nxDeleteTemplate});

  /* ---------- Corbeille et historique ---------- */
  const nxEntityMap={
    devis:{label:'Devis',array:()=>DEVIS,key:()=>LS.devis,render:()=>{try{renderList();renderDash();}catch(e){}}},
    client:{label:'Client',array:()=>CLIENTS,key:()=>LS.clients,render:()=>{try{renderClients();}catch(e){}}},
    dep:{label:'Intervention',array:()=>DEP,key:()=>LS.dep,render:()=>{try{renderDep();}catch(e){}}},
    loc:{label:'Location',array:()=>LOC,key:()=>LS.loc,render:()=>{try{renderLoc();}catch(e){}}},
    ctr:{label:'Contrat',array:()=>CTR,key:()=> 'cp2_contrats',render:()=>{try{renderContrats();}catch(e){}}},
    equip:{label:'Équipement',array:()=>EQUIP,key:()=> 'cp2_equip',render:()=>{}},
    flu:{label:'Fiche fluide',array:()=>FLU,key:()=> 'cp2_fluides',render:()=>{try{renderFluides();}catch(e){}}}
  };
  function nxSoftDelete(type,id){
    const cfg=nxEntityMap[type],arr=cfg&&cfg.array();if(!cfg||!arr)return;const i=arr.findIndex(x=>x.id===id),item=arr[i];if(i<0)return;
    if(!confirm('Mettre « '+(item.num||item.nom||item.cNom||cfg.label)+' » dans la corbeille ? Restaurable pendant 30 jours.'))return;
    nxTrash.unshift({trashId:nxId(),type,item:nxClone(item),deletedAt:Date.now(),expiresAt:Date.now()+30*86400000});arr.splice(i,1);save(cfg.key(),arr);nxSave(NX_KEYS.trash,nxTrash);cfg.render();nxUpdateTaskBadge();nxToast('Élément placé dans la corbeille','ok');
  }
  function nxPatchDeletes(){
    window.delDevis=id=>nxSoftDelete('devis',id);window.delClient=id=>nxSoftDelete('client',id);window.delDep=id=>nxSoftDelete('dep',id);window.delLoc=id=>nxSoftDelete('loc',id);window.delCtr=id=>nxSoftDelete('ctr',id);window.delEquip=id=>nxSoftDelete('equip',id);window.delFlu=id=>nxSoftDelete('flu',id);
  }
  function nxRestoreTrash(id){const t=nxTrash.find(x=>x.trashId===id),cfg=t&&nxEntityMap[t.type];if(!t||!cfg)return;const arr=cfg.array();if(arr.some(x=>x.id===t.item.id)){nxToast('Un élément avec le même identifiant existe déjà','err');return;}arr.push(nxClone(t.item));save(cfg.key(),arr);nxTrash=nxTrash.filter(x=>x.trashId!==id);nxSave(NX_KEYS.trash,nxTrash);cfg.render();nxRenderTools();nxToast('Élément restauré','ok');}
  function nxPurgeTrash(id){if(!confirm('Supprimer définitivement ? Cette action est irréversible.'))return;nxTrash=nxTrash.filter(x=>x.trashId!==id);nxSave(NX_KEYS.trash,nxTrash);nxRenderTools();}
  function nxCleanTrash(){const before=nxTrash.length;nxTrash=nxTrash.filter(x=>x.expiresAt>Date.now());if(nxTrash.length!==before)nxSave(NX_KEYS.trash,nxTrash);}

  function nxSnapshot(reason){
    const data={};(SYNC_KEYS||[]).filter(k=>k!==NX_KEYS.history).forEach(k=>{const raw=localStorage.getItem(k);if(raw!=null)try{data[k]=JSON.parse(raw);}catch(e){}});
    const raw=JSON.stringify(data);let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}const fingerprint=(hash>>>0).toString(16)+':'+raw.length;
    let hist=nxLoad(NX_KEYS.history,[]);if(hist[0]&&hist[0].fingerprint===fingerprint)return;
    hist.unshift({id:nxId(),date:Date.now(),reason:reason||'Sauvegarde automatique',fingerprint,data,counts:{devis:(DEVIS||[]).length,clients:(CLIENTS||[]).length,interventions:(DEP||[]).length,locations:(LOC||[]).length}});
    /* écriture locale résiliente au quota : si le stockage est plein, on garde moins de versions plutôt que de planter */
    for(const keep of [10,5,3,1]){
      try{localStorage.setItem(NX_KEYS.history,JSON.stringify(hist.slice(0,keep)));return;}catch(e){}
    }
  }
  function nxPatchCloudHistory(){
    const original=window.pushState;if(typeof original==='function')window.pushState=async function(manual){try{nxSnapshot(manual?'Synchronisation manuelle':'Synchronisation automatique');}catch(e){}return original(manual);};
  }
  function nxRestoreSnapshot(id){
    const h=nxLoad(NX_KEYS.history,[]).find(x=>x.id===id);if(!h)return;if(!confirm('Restaurer cette version ? Une sauvegarde de l’état actuel sera créée avant.'))return;
    nxSnapshot('Avant restauration');Object.entries(h.data||{}).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));localStorage.setItem('cp2_dirty','1');alert('Version restaurée. ClimPilot va se recharger.');location.reload();
  }
  function nxRenderTools(){
    nxCleanTrash();const box=document.getElementById('nxTools');if(!box)return;const hist=nxLoad(NX_KEYS.history,[]);
    box.innerHTML=`<div class="next-hero"><h2>🛡️ Filet de sécurité</h2><p>Les suppressions ne détruisent plus immédiatement tes données. Les 10 dernières synchronisations sont restaurables.</p><div class="next-actions"><button onclick="nxSnapshot('Manuelle');nxRenderTools()">📸 Créer un point de restauration</button><button onclick="exportJSON()">⬇ Sauvegarde JSON</button></div></div><div class="next-grid"><div class="next-card next-col-6"><h3>🗑 Corbeille — 30 jours</h3>${nxTrash.length?nxTrash.map(t=>`<div class="next-version"><span>🗑</span><div><b>${nxEsc(t.item.num||t.item.nom||t.item.cNom||nxEntityMap[t.type].label)}</b><small>${nxEntityMap[t.type].label} · supprimé le ${nxDate(t.deletedAt)} · expire le ${nxDate(t.expiresAt)}</small></div><button class="btn-ghost btn-sm" onclick="nxRestoreTrash('${t.trashId}')">Restaurer</button><button class="iconbtn d" onclick="nxPurgeTrash('${t.trashId}')">✕</button></div>`).join(''):'<div class="next-empty">La corbeille est vide.</div>'}</div><div class="next-card next-col-6"><h3>🕘 Historique — 10 versions</h3>${hist.length?hist.map(h=>`<div class="next-version"><span>📸</span><div><b>${nxDate(h.date)} à ${new Date(h.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b><small>${nxEsc(h.reason)} · ${h.counts.devis} devis · ${h.counts.clients} clients</small></div><button class="btn-ghost btn-sm" onclick="nxRestoreSnapshot('${h.id}')">Restaurer</button></div>`).join(''):'<div class="next-empty">Le premier point sera créé à la prochaine synchronisation.</div>'}</div></div>`;
  }
  Object.assign(window,{nxRestoreTrash,nxPurgeTrash,nxSnapshot,nxRestoreSnapshot,nxRenderTools});

  /* ---------- Calendrier iPhone / iPad ---------- */
  const nxIcsEsc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const nxIcsDate=s=>String(s||'').replace(/-/g,'');
  function nxCalendarEvents(){
    const ev=[];
    (DEVIS||[]).forEach(d=>{if(d.statut==='accepte'&&d.datePlanif)ev.push({uid:'devis-'+d.id,date:d.datePlanif,title:'Chantier — '+(d.cNom||d.type),desc:[d.num,d.type,(d.heures||0)+' h'].join(' · '),loc:[d.cAdr,d.cVille].filter(Boolean).join(', ')});});
    (DEP||[]).forEach(x=>{if(x.date)ev.push({uid:'dep-'+x.id,date:x.date,title:(x.itype==='mes'?'Mise en service — ':'Dépannage — ')+(x.cNom||'?'),desc:[x.facNum,x.desc].filter(Boolean).join(' · '),loc:[x.cAdr,x.cVille].filter(Boolean).join(', ')});});
    (LOC||[]).forEach(l=>{if(l.dateDebut)ev.push({uid:'loc-start-'+l.id,date:l.dateDebut,title:'Livraison location — '+(l.cNom||'?'),desc:(l.items||[]).map(x=>x.qte+' × '+x.ref).join(', '),loc:[l.cAdr,l.cVille].filter(Boolean).join(', ')});if(l.dateFin)ev.push({uid:'loc-end-'+l.id,date:l.dateFin,title:'Reprise location — '+(l.cNom||'?'),desc:l.num||'',loc:[l.cAdr,l.cVille].filter(Boolean).join(', ')});});
    (CTR||[]).forEach(c=>{if(c.actif!==false&&c.prochaineVisite){const cl=nxGetClient(c.clientNom);ev.push({uid:'ctr-'+c.id+'-'+c.prochaineVisite,date:c.prochaineVisite,title:'Entretien — '+(c.clientNom||'?'),desc:[c.type,(c.prix||0)+' €/an'].join(' · '),loc:[cl.adr,cl.ville].filter(Boolean).join(', ')});}});
    nxTasks.filter(t=>!t.done&&t.due).forEach(t=>ev.push({uid:'task-'+t.id,date:t.due,title:'À faire — '+t.title,desc:[t.cat,t.link].filter(Boolean).join(' · '),loc:''}));
    return ev;
  }
  function nxExportICS(){
    const events=nxCalendarEvents(),stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//GL Froid Clim//ClimPilot Next//FR','X-WR-CALNAME:ClimPilot'];
    events.forEach(e=>lines.push('BEGIN:VEVENT','UID:'+nxIcsEsc(e.uid)+'@climpilot','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+nxIcsDate(e.date),'DTEND;VALUE=DATE:'+nxIcsDate(new Date(new Date(e.date+'T00:00:00').getTime()+86400000).toISOString().slice(0,10)),'SUMMARY:'+nxIcsEsc(e.title),'DESCRIPTION:'+nxIcsEsc(e.desc),'LOCATION:'+nxIcsEsc(e.loc),'END:VEVENT'));
    lines.push('END:VCALENDAR');nxDownload('ClimPilot-calendrier-'+nxToday()+'.ics','\ufeff'+lines.join('\r\n'),'text/calendar;charset=utf-8');nxToast(events.length+' événement(s) exporté(s). Ouvre le fichier sur l’iPhone puis “Ajouter tout”.','ok');
  }
  Object.assign(window,{nxExportICS});

  /* ---------- Création guidée des contrats ---------- */
  function nxOpenContractWizard(client){
    openCtr(null,client||'');
    const title=document.querySelector('#mCtr .hd b');if(title)title.textContent='Créer un contrat d’entretien';
    const bd=document.querySelector('#mCtr .bd');
    if(bd&&!document.getElementById('nxCtrGuide'))bd.insertAdjacentHTML('afterbegin','<div class="warnbox" id="nxCtrGuide" style="background:var(--blue-soft);border-color:#bcd3ff;color:#1d4fd0">1. Choisis le client · 2. Choisis le type · 3. Vérifie le prix et la première visite · 4. Enregistre. Le contrat apparaîtra dans le planning et pourra être facturé chaque année.</div>');
    const clientInput=document.getElementById('ct_client');if(clientInput){clientInput.setAttribute('list','clientDL');clientInput.focus();}
  }
  function nxPatchContracts(){
    const oldRender=renderContrats;window.renderContrats=function(){oldRender();const v=document.getElementById('v-contrats'),anchor=v&&v.querySelector('.warnbox');if(v&&!document.getElementById('nxCtrStart')){const html='<div class="next-card" id="nxCtrStart" style="margin-bottom:14px;border-left:4px solid var(--next-mint);display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div style="font-size:25px">🤝</div><div style="flex:1"><b>Créer un revenu récurrent</b><div class="sub">Clim : 1 visite/an par défaut · Adiabatique : 2 visites/an (mise en route + hivernage).</div></div><button class="btn-next-accent" onclick="nxOpenContractWizard()">＋ Créer un contrat guidé</button></div>';if(anchor)anchor.insertAdjacentHTML('afterend',html);else v.insertAdjacentHTML('afterbegin',html);}};
    const oldC360=renderClient360;window.renderClient360=function(){oldC360();const box=document.getElementById('c360');if(box&&window._cliId){const c=CLIENTS.find(x=>x.id===window._cliId);if(c&&!box.querySelector('.nx-ctr-client')){const actions=box.querySelector('.row-actions');if(actions)actions.insertAdjacentHTML('beforeend',`<button class="btn-next-accent nx-ctr-client" onclick="nxOpenContractWizard('${nxEsc(c.nom)}')">🤝 Nouveau contrat</button>`);}}};
  }
  Object.assign(window,{nxOpenContractWizard});

  /* ---------- OCR local ---------- */
  let nxOcrFile=null;
  function nxRenderScan(){
    const box=document.getElementById('nxScan');if(!box)return;
    box.innerHTML=`<div class="next-hero"><h2>📷 Scan intelligent</h2><p>Photographie une plaque signalétique ou une fiche. La lecture se fait dans ton navigateur : la photo n’est pas envoyée dans ClimPilot ni stockée dans le cloud.</p></div><div class="next-grid"><div class="next-card next-col-6"><div class="next-card-h"><h3>1. Prendre ou choisir la photo</h3><select id="nxOcrType" style="width:auto"><option value="equip">Plaque équipement</option><option value="fluide">Fiche fluide / Cerfa</option><option value="achat">Facture d’achat</option></select></div><label class="next-drop" id="nxDrop"><input type="file" id="nxOcrFile" accept="image/*" capture="environment"><b>📸 Appuyer pour prendre une photo</b><div class="sub">Photo nette, cadrée, sans reflet. JPG/PNG.</div><img id="nxOcrPreview" style="display:none"></label><div class="row-actions" style="margin-top:12px"><button class="btn-pri" onclick="nxRunOCR()">Lire la photo</button></div><div id="nxOcrProgress" class="sub" style="margin-top:10px"></div></div><div class="next-card next-col-6"><h3>2. Vérifier les informations trouvées</h3><div id="nxOcrFound"><div class="next-empty">Les champs détectés apparaîtront ici. Tu devras toujours les vérifier avant d’enregistrer.</div></div><details style="margin-top:12px"><summary>Voir le texte brut reconnu</summary><pre class="next-ocr-text" id="nxOcrRaw">—</pre></details></div></div>`;
    const input=document.getElementById('nxOcrFile'),drop=document.getElementById('nxDrop');
    input.onchange=()=>{nxOcrFile=input.files&&input.files[0];if(nxOcrFile){const img=document.getElementById('nxOcrPreview');img.src=URL.createObjectURL(nxOcrFile);img.style.display='block';}};
    drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');nxOcrFile=e.dataTransfer.files[0];if(nxOcrFile){const img=document.getElementById('nxOcrPreview');img.src=URL.createObjectURL(nxOcrFile);img.style.display='block';}};
  }
  function nxLoadTesseract(){return new Promise((resolve,reject)=>{if(window.Tesseract)return resolve(window.Tesseract);const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=()=>resolve(window.Tesseract);s.onerror=()=>reject(new Error('Module OCR indisponible'));document.head.appendChild(s);});}
  function nxParseOCR(text,type){
    const clean=String(text||'').replace(/\r/g,' '),one=clean.replace(/\s+/g,' ').trim(),out={raw:clean};
    const fluid=one.match(/\b(R(?:32|410A|407C|404A|134A|290|600A|448A|449A|452A|1234YF))\b/i);if(fluid)out.fluide=fluid[1].toUpperCase();
    const charge=one.match(/(?:charge|refrigerant|réfrigérant|factory\s*charge)[^\d]{0,25}([0-9]+[,.][0-9]+)\s*(?:kg|KG)/i)||one.match(/([0-9]+[,.][0-9]+)\s*kg/i);if(charge)out.charge=Number(charge[1].replace(',','.'));
    const serial=one.match(/(?:serial|s\/?n|n[°o]\s*(?:de\s*)?série|serie)[\s:#-]*([A-Z0-9][A-Z0-9\-/.]{3,})/i);if(serial)out.serie=serial[1];
    const model=one.match(/(?:model|modèle|modele|type|réf(?:érence)?|reference)[\s:#-]*([A-Z0-9][A-Z0-9\-/.]{2,})/i);if(model)out.modele=model[1].trim();
    const known=['Daikin','Mitsubishi Electric','Mitsubishi Heavy','Samsung','Atlantic','Fujitsu','Hitachi','Toshiba','Panasonic','LG','Carrier','Trane','Technibel','Airwell','Dantherm','BioCool','Obera'];const brand=known.find(b=>nxNorm(one).includes(nxNorm(b)));if(brand)out.marque=brand;
    const date=one.match(/\b([0-3]?\d)[/.\-]([01]?\d)[/.\-](20\d{2})\b/);if(date)out.date=date[3]+'-'+date[2].padStart(2,'0')+'-'+date[1].padStart(2,'0');
    if(type==='achat'){
      const ttc=one.match(/(?:total\s*ttc|net\s*à\s*payer)[^\d]{0,12}([0-9 ]+[,.][0-9]{2})/i);const ht=one.match(/(?:total\s*ht)[^\d]{0,12}([0-9 ]+[,.][0-9]{2})/i);if(ttc)out.ttc=Number(ttc[1].replace(/ /g,'').replace(',','.'));if(ht)out.ht=Number(ht[1].replace(/ /g,'').replace(',','.'));
    }
    if(type==='fluide'){
      const client=one.match(/(?:détenteur|client)[\s:]+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ0-9 '&.-]{3,35})/i);if(client)out.client=client[1].trim();
      const qv=one.match(/(?:vierge|chargée?|introduite?)[^\d]{0,15}([0-9]+[,.][0-9]+)\s*kg/i);if(qv)out.qv=Number(qv[1].replace(',','.'));
      const qr=one.match(/(?:récupérée?|recuperee?)[^\d]{0,15}([0-9]+[,.][0-9]+)\s*kg/i);if(qr)out.qrt=Number(qr[1].replace(',','.'));
    }
    return out;
  }
  async function nxRunOCR(){
    if(!nxOcrFile){nxToast('Prends ou choisis une photo','warn');return;}const p=document.getElementById('nxOcrProgress');p.textContent='Chargement du moteur OCR…';
    try{const T=await nxLoadTesseract();const r=await T.recognize(nxOcrFile,'fra+eng',{logger:m=>{if(m.status==='recognizing text')p.textContent='Lecture : '+Math.round((m.progress||0)*100)+' %';else p.textContent=m.status||'Analyse…';}});const raw=r.data.text||'';document.getElementById('nxOcrRaw').textContent=raw;nxOcrParsed=nxParseOCR(raw,document.getElementById('nxOcrType').value);nxRenderOcrFound();p.textContent='Lecture terminée — vérifie chaque champ.';}catch(e){p.textContent='Échec : '+(e.message||e);nxToast('OCR impossible. Vérifie la connexion et la netteté de la photo.','err');}
  }
  function nxRenderOcrFound(){
    const type=document.getElementById('nxOcrType').value,box=document.getElementById('nxOcrFound'),p=nxOcrParsed;
    const fields=Object.entries(p).filter(([k])=>k!=='raw');box.innerHTML=fields.length?fields.map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #edf1f5"><span>${nxEsc(k)}</span><b>${nxEsc(v)}</b></div>`).join(''):'<div class="next-empty">Aucun champ reconnu automatiquement. Le texte brut reste disponible pour une saisie manuelle.</div>';
    if(type==='equip')box.insertAdjacentHTML('beforeend','<button class="btn-next-accent" style="width:100%;margin-top:12px" onclick="nxApplyOcrEquip()">Créer l’équipement avec ces données</button>');
    if(type==='fluide')box.insertAdjacentHTML('beforeend','<button class="btn-next-accent" style="width:100%;margin-top:12px" onclick="nxApplyOcrFluide()">Créer la fiche fluide avec ces données</button>');
    if(type==='achat')box.insertAdjacentHTML('beforeend','<div class="warnbox" style="margin-top:12px">Le montant est proposé uniquement. Vérifie la facture puis saisis-le dans « Réalité terrain » du chantier concerné.</div>');
  }
  function nxApplyOcrEquip(){openEquip();const m={marque:'eq_marque',modele:'eq_modele',serie:'eq_serie',fluide:'eq_fluide',charge:'eq_charge',date:'eq_date'};Object.entries(m).forEach(([k,id])=>{if(nxOcrParsed[k]!=null&&document.getElementById(id))document.getElementById(id).value=nxOcrParsed[k];});nxToast('Champs préremplis — vérifie puis enregistre','ok');}
  function nxApplyOcrFluide(){openFlu();const m={client:'fl_client',fluide:'fl_fluide',charge:'fl_charge',qv:'fl_qv',qrt:'fl_qrt',date:'fl_date'};Object.entries(m).forEach(([k,id])=>{if(nxOcrParsed[k]!=null&&document.getElementById(id))document.getElementById(id).value=nxOcrParsed[k];});if(nxOcrParsed.modele||nxOcrParsed.serie)document.getElementById('fl_desc').value=[nxOcrParsed.marque,nxOcrParsed.modele,nxOcrParsed.serie].filter(Boolean).join(' — ');nxToast('Fiche préremplie — contrôle obligatoire avant enregistrement','ok');}
  Object.assign(window,{nxRunOCR,nxApplyOcrEquip,nxApplyOcrFluide});

  /* ---------- Scanner contextuel : conserve le formulaire métier ouvert ---------- */
  const NX_CTX_FIELDS={
    equip:[['marque','Marque'],['modele','Modèle / référence'],['serie','N° de série'],['fluide','Fluide'],['charge','Charge usine (kg)']],
    fluide:[['marque','Marque'],['modele','Modèle / référence'],['serie','N° de série'],['fluide','Fluide'],['charge','Charge nominale (kg)']]
  };
  function nxContextPreview(file){const img=document.getElementById('nxCtxOcrPreview');if(!img)return;if(img.dataset.url)URL.revokeObjectURL(img.dataset.url);if(!file){img.style.display='none';img.removeAttribute('src');img.dataset.url='';return;}const url=URL.createObjectURL(file);img.dataset.url=url;img.src=url;img.style.display='block';}
  function nxOpenScanner(target){
    target=target==='fluide'?'fluide':'equip';nxScanContext={target};nxOcrFile=null;nxOcrParsed={};
    const parentId=target==='fluide'?'mFlu':'mEquip',parent=document.getElementById(parentId);
    if(!parent||!parent.classList.contains('on')){if(target==='fluide')openFlu();else openEquip();}
    const title=document.getElementById('nxCtxScanTitle'),sub=document.getElementById('nxCtxScanSub'),input=document.getElementById('nxCtxOcrFile'),progress=document.getElementById('nxCtxOcrProgress'),found=document.getElementById('nxCtxOcrFound');
    if(title)title.textContent=target==='fluide'?'Scanner la plaque pour la fiche Cerfa':'Scanner la plaque de l’équipement';
    if(sub)sub.textContent=target==='fluide'?'La fiche reste ouverte derrière : client, nature et quantités ne seront pas effacés.':'Le formulaire équipement reste ouvert derrière et conserve les informations déjà saisies.';
    if(input){input.value='';input.onchange=()=>{nxOcrFile=input.files&&input.files[0]||null;nxContextPreview(nxOcrFile);};}
    if(progress)progress.textContent='';if(found)found.innerHTML='<div class="next-empty">Les champs reconnus apparaîtront ici et resteront modifiables.</div>';nxContextPreview(null);
    const drop=document.getElementById('nxCtxDrop');if(drop){drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');nxOcrFile=e.dataTransfer.files&&e.dataTransfer.files[0]||null;nxContextPreview(nxOcrFile);};}
    document.getElementById('nxContextScanner').classList.add('on');
  }
  function nxOpenScannerForIntervention(){const client=(document.getElementById('dp_cNom')||{}).value||'';openEquip(null,client);nxOpenScanner('equip');}
  function nxCloseContextScanner(){const m=document.getElementById('nxContextScanner');if(m)m.classList.remove('on');nxContextPreview(null);nxOcrFile=null;}
  function nxRenderContextOcr(){
    const box=document.getElementById('nxCtxOcrFound'),fields=NX_CTX_FIELDS[nxScanContext.target]||NX_CTX_FIELDS.equip;if(!box)return;
    box.innerHTML='<div class="nx-ocr-review">'+fields.map(([key,label])=>'<label>'+label+'<input data-nx-ocr-field="'+key+'" value="'+nxEsc(nxOcrParsed[key]??'')+'"></label>').join('')+'</div><div class="warnbox" style="margin:12px 0 0">⚠️ Compare chaque valeur avec la plaque. Le scanner propose, il ne certifie pas.</div><button class="btn-next-accent" style="width:100%;margin-top:12px" type="button" onclick="nxApplyContextOCR()">Utiliser ces informations</button>';
  }
  async function nxRunContextOCR(){
    const progress=document.getElementById('nxCtxOcrProgress');if(!nxOcrFile){nxToast('Prends ou choisis une photo','warn');return;}if(progress)progress.textContent='Chargement du moteur OCR…';
    try{const T=await nxLoadTesseract();const r=await T.recognize(nxOcrFile,'fra+eng',{logger:m=>{if(!progress)return;progress.textContent=m.status==='recognizing text'?'Lecture : '+Math.round((m.progress||0)*100)+' %':m.status||'Analyse…';}});nxOcrParsed=nxParseOCR(r.data.text||'','equip');nxRenderContextOcr();if(progress)progress.textContent='Lecture terminée — vérification obligatoire.';}catch(e){if(progress)progress.textContent='Échec : '+(e.message||e);nxToast('OCR impossible. Vérifie la connexion et la netteté de la photo.','err');}
  }
  function nxApplyContextOCR(){
    const values={};document.querySelectorAll('#nxCtxOcrFound [data-nx-ocr-field]').forEach(e=>values[e.dataset.nxOcrField]=e.value.trim());
    if(nxScanContext.target==='equip'){
      const map={marque:'eq_marque',modele:'eq_modele',serie:'eq_serie',fluide:'eq_fluide',charge:'eq_charge'};Object.entries(map).forEach(([k,id])=>{const e=document.getElementById(id);if(e&&values[k]!=='')e.value=values[k];});
    }else{
      const desc=[values.marque,values.modele,values.serie&&'SN '+values.serie].filter(Boolean).join(' — '),d=document.getElementById('fl_desc'),fluid=document.getElementById('fl_fluide'),charge=document.getElementById('fl_charge');if(d&&desc)d.value=desc;if(fluid&&values.fluide)fluid.value=values.fluide.toUpperCase();if(charge&&values.charge!=='')charge.value=String(values.charge).replace(',','.');
      const sel=document.getElementById('fl_equip');if(sel)sel.value='';
    }
    nxCloseContextScanner();nxToast('Plaque préremplie — contrôle obligatoire avant enregistrement','ok');
  }
  Object.assign(window,{nxOpenScanner,nxOpenScannerForIntervention,nxCloseContextScanner,nxRunContextOCR,nxApplyContextOCR});

  /* ---------- Devis assisté : protections électriques, automatismes et interface métier ---------- */
  const NX_BREAKERS=['Disjoncteur 16A','Disjoncteur 20A','Disjoncteur 32A'];
  function nxEnsureQuote(d){
    if(!d)return d;
    if(d.elecMode==null)d.elecMode='auto';
    if(d.breakerManual==null)d.breakerManual='Disjoncteur 20A';
    if(d.breakerQte==null)d.breakerQte=Math.max(1,Number(d.nbMach)||1);
    if(d.differential==null)d.differential=false;
    if(d.diffQte==null)d.diffQte=1;
    if(d.proximity==null)d.proximity=false;
    (d.machines||[]).forEach(m=>{if(m.breaker==null)m.breaker='';if(m.maxCurrent==null)m.maxCurrent=0;});
    return d;
  }
  function nxBreakerFromCurrent(current){
    const a=Number(current)||0;if(a<=0)return '';
    if(a<=13)return 'Disjoncteur 16A';
    if(a<=16)return 'Disjoncteur 20A';
    if(a<=25)return 'Disjoncteur 32A';
    return '';
  }
  function nxMachineBreaker(m){return (m&&m.breaker)||nxBreakerFromCurrent(m&&m.maxCurrent);}
  function nxElectricalItems(d){
    nxEnsureQuote(d);const items=[];
    const add=(nom,qte)=>{qte=Number(qte)||0;if(!nom||qte<=0)return;const hit=items.find(x=>x.nom===nom);if(hit)hit.qte+=qte;else items.push({nom,qte});};
    if(d.elecMode==='auto'){
      (d.machines||[]).forEach(m=>add(nxMachineBreaker(m),1));
    }else if(d.elecMode==='manual')add(d.breakerManual,Math.max(1,Number(d.breakerQte)||1));
    if(d.elecMode!=='none'&&d.differential)add('Différentiel',Math.max(1,Number(d.diffQte)||1));
    if(d.elecMode!=='none'&&d.proximity)add('Interrupteur de proximité IP65',Math.max(1,Number(d.nbMach)||1));
    return items;
  }
  function nxQuoteForCompute(d){
    nxEnsureQuote(d);const copy=Object.assign({},d,{extras:(d.extras||[]).map(x=>Object.assign({},x))});
    nxElectricalItems(d).forEach(item=>{if(!copy.extras.some(x=>x.nom===item.nom))copy.extras.push(item);});
    return copy;
  }
  function nxInjectElectrical(){
    if(document.getElementById('nxElectrical'))return;
    const step4=document.querySelector('#v-wizard .step[data-step="4"] .card');if(!step4)return;
    const title=Array.from(step4.querySelectorAll('h3')).find(h=>(h.textContent||'').toLowerCase().includes('alimentation électrique'));
    const anchor=title&&title.nextElementSibling;if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<div class="nx-electric" id="nxElectrical">
      <div class="nx-electric-head"><div><b>⚡ Protection électrique</b><span>Ajoutée au devis et à la liste de commande</span></div><span class="next-pill blue" id="nxElecState">À compléter</span></div>
      <div class="frm">
        <label>Gestion de la protection<select id="f_elecMode" onchange="nxElectricalChange()"><option value="auto">Automatique depuis la notice machine</option><option value="manual">Choix manuel</option><option value="none">Non fournie / existante à contrôler</option></select></label>
        <label class="nx-manual-elec">Disjoncteur<select id="f_breakerManual" onchange="nxElectricalChange()">${NX_BREAKERS.map(x=>`<option>${x}</option>`).join('')}</select></label>
        <label class="nx-manual-elec">Quantité<input type="number" id="f_breakerQte" min="1" value="1" onchange="nxElectricalChange()"></label>
        <label class="nx-check"><span>Protection différentielle</span><input type="checkbox" id="f_differential" onchange="nxElectricalChange()"></label>
        <label>Quantité différentiels<input type="number" id="f_diffQte" min="1" value="1" onchange="nxElectricalChange()"></label>
        <label class="nx-check"><span>Interrupteur de proximité IP65</span><input type="checkbox" id="f_proximity" onchange="nxElectricalChange()"></label>
      </div>
      <div class="note-inline" id="nxElecHelp">Le calibre doit être repris de la notice constructeur. Si tu saisis le courant maximal de la machine, ClimPilot propose le calibre standard immédiatement supérieur, à valider.</div>
    </div>`);
  }
  function nxRenderMachineElectrical(){
    if(!cur)return;nxEnsureQuote(cur);
    document.querySelectorAll('#machineList .subcard').forEach((card,i)=>{
      const m=cur.machines[i]||{};if(card.querySelector('.m-breaker'))return;
      const frm=card.querySelector('.frm');if(!frm)return;
      frm.insertAdjacentHTML('beforeend',`<label>Courant maxi notice (A)<input type="number" class="m-current" min="0" step="0.1" value="${Number(m.maxCurrent)||0}" onchange="nxMachineElectricalChange(${i})"><span class="note-inline">MCA / intensité maxi indiquée par le fabricant</span></label>
        <label>Disjoncteur recommandé<select class="m-breaker" onchange="nxMachineElectricalChange(${i})"><option value="">Auto depuis le courant</option>${NX_BREAKERS.map(x=>`<option ${x===m.breaker?'selected':''}>${x}</option>`).join('')}</select><span class="note-inline" id="nxMachineElec${i}">${nxMachineBreaker(m)||'Notice à renseigner'}</span></label>`);
    });
  }
  function nxLoadElectrical(){
    if(!cur)return;nxEnsureQuote(cur);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
    set('f_elecMode',cur.elecMode);set('f_breakerManual',cur.breakerManual);set('f_breakerQte',cur.breakerQte);set('f_diffQte',cur.diffQte);
    const dif=document.getElementById('f_differential'),prox=document.getElementById('f_proximity');if(dif)dif.checked=!!cur.differential;if(prox)prox.checked=!!cur.proximity;
    document.querySelectorAll('.nx-manual-elec').forEach(e=>e.style.display=cur.elecMode==='manual'?'flex':'none');
    const state=document.getElementById('nxElecState'),items=nxElectricalItems(cur),missing=cur.elecMode==='auto'&&(cur.machines||[]).some(m=>!nxMachineBreaker(m));
    if(state){state.className='next-pill '+(cur.elecMode==='none'?'amber':missing?'red':'green');state.textContent=cur.elecMode==='none'?'Non fournie':missing?'Notice manquante':items.map(x=>x.qte+' × '+x.nom.replace('Disjoncteur ','')).join(' · ')||'À confirmer';}
  }
  function nxReadElectrical(){
    if(!cur)return;nxEnsureQuote(cur);const val=id=>{const e=document.getElementById(id);return e?e.value:'';};
    cur.elecMode=val('f_elecMode')||cur.elecMode;cur.breakerManual=val('f_breakerManual')||cur.breakerManual;cur.breakerQte=Math.max(1,Number(val('f_breakerQte'))||1);cur.diffQte=Math.max(1,Number(val('f_diffQte'))||1);
    const dif=document.getElementById('f_differential'),prox=document.getElementById('f_proximity');cur.differential=!!(dif&&dif.checked);cur.proximity=!!(prox&&prox.checked);
  }
  function nxMachineElectricalChange(i){
    const card=document.querySelectorAll('#machineList .subcard')[i];if(!card||!cur)return;
    const m=cur.machines[i]||(cur.machines[i]={});m.maxCurrent=Number(card.querySelector('.m-current').value)||0;m.breaker=card.querySelector('.m-breaker').value||'';
    const hint=document.getElementById('nxMachineElec'+i);if(hint)hint.textContent=nxMachineBreaker(m)||'Notice à renseigner';nxLoadElectrical();nxRenderQuoteAside();
  }
  function nxElectricalChange(){nxReadElectrical();nxLoadElectrical();try{recalc();}catch(e){nxRenderQuoteAside();}}
  function nxCompleteness(d,c){
    const checks=[
      {ok:!!(d.cNom&&d.cAdr),label:'Client et adresse',step:1},
      {ok:(d.machines||[]).length>0&&(d.machines||[]).every(m=>Number(m.achat)>0),label:'Machines et prix d’achat',step:2},
      {ok:(d.splits||[]).length===0||(d.splits||[]).every(s=>Number(s.long)>0&&!!s.liaison),label:'Liaisons et longueurs',step:3},
      {ok:(d.splits||[]).length===0||Number(d.groupLong)>0,label:'Longueur alimentation groupe',step:4},
      {ok:(d.splits||[]).length===0||Number(d.condLong)>0||(d.pompeType&&d.pompeType!=='Aucune'),label:'Évacuation des condensats',step:4},
      {ok:d.elecMode==='none'||nxElectricalItems(d).some(x=>x.nom.indexOf('Disjoncteur')===0),label:'Protection électrique',step:4},
      {ok:Number(d.heures)>0,label:'Temps de chantier',step:5},
      {ok:d.tests&&d.tests!=='0',label:'Contrôle / mise sous vide',step:5},
      {ok:Number(c&&c.totalHT)>0,label:'Chiffrage calculé',step:6}
    ];return checks;
  }
  function nxRenderQuoteAside(){
    const box=document.getElementById('nxQuoteAssist');if(!box||!cur)return;nxEnsureQuote(cur);
    let c;try{c=compute(cur);}catch(e){return;}const checks=nxCompleteness(cur,c),done=checks.filter(x=>x.ok).length,pctDone=Math.round(done/checks.length*100),items=nxElectricalItems(cur);
    box.innerHTML=`<div class="nx-assist-title"><span>✨</span><div><b>Assistant devis</b><small>${pctDone}% complété</small></div></div><div class="next-progress"><i style="width:${pctDone}%"></i></div>
      <div class="nx-assist-total"><span>Total HT</span><strong>${eur(c.totalHT)}</strong><small>Marge ${pct(c.margePct)} · ${c.heures||0} h</small></div>
      <div class="nx-checklist">${checks.map(x=>`<button class="${x.ok?'ok':'todo'}" onclick="step(${x.step})"><span>${x.ok?'✓':'!'}</span>${nxEsc(x.label)}</button>`).join('')}</div>
      <div class="nx-assist-electric"><b>⚡ Électricité</b><span>${cur.elecMode==='none'?'Non fournie':items.length?items.map(x=>x.qte+' × '+x.nom).join('<br>'):'Notice machine à compléter'}</span></div>
      <button class="btn-next-accent" style="width:100%" onclick="nxApplyQuoteAuto()">Compléter les automatismes</button><div class="note-inline">Les propositions ne remplacent jamais la notice constructeur ni le contrôle de l’installation existante.</div>`;
  }
  function nxApplyQuoteAuto(){
    if(!cur)return;formToDevis();
    (cur.splits||[]).forEach(s=>{if(Number(s.puiss)>0)s.liaison=liaisonForPower(s.puiss);});
    (cur.machines||[]).forEach(m=>{if(!m.breaker&&Number(m.maxCurrent)>0)m.breaker=nxBreakerFromCurrent(m.maxCurrent);});
    if(cur.elecMode==='auto')cur.breakerQte=Math.max(1,Number(cur.nbMach)||1);
    renderSplits();renderMachines();nxLoadElectrical();recalc();nxToast('Automatismes recalculés — vérifie les longueurs et la notice','ok');
  }
  function nxInjectQuoteLayout(){
    const wizard=document.getElementById('v-wizard');if(!wizard||document.getElementById('nxQuoteLayout'))return;
    const progress=wizard.querySelector('.progress'),steps=Array.from(wizard.querySelectorAll(':scope > .step'));if(!progress||!steps.length)return;
    const layout=document.createElement('div');layout.id='nxQuoteLayout';layout.className='nx-quote-layout';layout.innerHTML='<main class="nx-quote-main"></main><aside class="nx-quote-assist" id="nxQuoteAssist"></aside>';progress.insertAdjacentElement('afterend',layout);const main=layout.querySelector('.nx-quote-main');steps.forEach(s=>main.appendChild(s));
  }
  const NX_NAV_SECTIONS=[
    {id:'home',label:'Accueil',ico:'⌂',items:[['nx_cockpit','Cockpit'],['dash','Activité & rentabilité'],['nx_tasks','À faire'],['plan','Planning']]},
    {id:'sales',label:'Commercial',ico:'◇',sub:[{id:'quotes',label:'Devis',ico:'📝',views:['wizard','verifier','pret','envoye','accepte','tous','nx_templates']}],items:[['clients','Clients']]},
    {id:'field',label:'Terrain',ico:'⚒',items:[['dep','Interventions'],['contrats','Contrats d’entretien'],['fluides','Fluides & Cerfa'],['dim','Dimensionnement']]},
    {id:'adia',label:'Adiabatique',ico:'◌',items:[['adia','Étude & installation'],['loc','Locations']]},
    {id:'supply',label:'Achats & stock',ico:'▣',items:[['commander','Besoins, stock & commandes'],['prix','Base de prix']]},
    {id:'manage',label:'Gestion',ico:'€',items:[['recettes','Factures & recettes'],['nx_docs','Registre des documents']]},
    {id:'settings',label:'Réglages',ico:'⚙',items:[['params','Paramètres'],['nx_tools','Sécurité & corbeille'],['nx_help','Mode d’emploi']]}
  ];
  function nxNavViews(section){return (section.items||[]).map(x=>x[0]).concat(...(section.sub||[]).map(x=>x.views||[]));}
  function nxSetNavSection(id,persist){
    document.querySelectorAll('.nx-nav-section').forEach(s=>{const open=s.dataset.section===id;s.classList.toggle('open',open);const b=s.querySelector(':scope > .nx-nav-toggle');if(b)b.setAttribute('aria-expanded',open?'true':'false');});
    if(persist!==false)try{localStorage.setItem('cpnext_nav_section',id);}catch(e){}
  }
  function nxRevealNavForView(v){
    const section=NX_NAV_SECTIONS.find(s=>nxNavViews(s).includes(v));if(!section)return;nxSetNavSection(section.id,false);
    const link=document.querySelector('#nav a[data-v="'+v+'"]');const sub=link&&link.closest('details.nx-nav-subgroup');if(sub)sub.open=true;
  }
  function nxToggleNavSection(id){const section=document.querySelector('.nx-nav-section[data-section="'+id+'"]');nxSetNavSection(section&&section.classList.contains('open')?'':id,true);}
  function nxToggleNav(){document.body.classList.toggle('nx-nav-open');const b=document.getElementById('nxNavToggle');if(b)b.setAttribute('aria-expanded',document.body.classList.contains('nx-nav-open')?'true':'false');}
  function nxCloseNav(){document.body.classList.remove('nx-nav-open');const b=document.getElementById('nxNavToggle');if(b)b.setAttribute('aria-expanded','false');}
  function nxOrganizeNavigation(){
    const nav=document.getElementById('nav');if(!nav||nav.querySelector('.nx-nav-section'))return;
    const links={};nav.querySelectorAll('a[data-v]').forEach(a=>links[a.dataset.v]=a);nav.innerHTML='';
    const addLink=(parent,view,label)=>{const a=links[view];if(!a)return;if(label){const txt=a.querySelector('.txt');if(txt)txt.textContent=label;}parent.appendChild(a);};
    NX_NAV_SECTIONS.forEach(section=>{
      const wrap=document.createElement('section');wrap.className='nx-nav-section';wrap.dataset.section=section.id;
      wrap.innerHTML='<button type="button" class="nx-nav-toggle" onclick="nxToggleNavSection(\''+section.id+'\')" aria-expanded="false"><span class="nx-nav-section-ico">'+section.ico+'</span><span>'+section.label+'</span><span class="nx-nav-chevron">⌄</span></button><div class="nx-nav-body"></div>';
      const body=wrap.querySelector('.nx-nav-body');
      (section.sub||[]).forEach(group=>{const details=document.createElement('details');details.className='nx-nav-subgroup';details.open=true;details.innerHTML='<summary><span>'+group.ico+'</span><span>'+group.label+'</span><span class="nx-nav-sub-chevron">›</span></summary><div class="nx-nav-subbody"></div>';const subbody=details.querySelector('.nx-nav-subbody');group.views.forEach(v=>addLink(subbody,v));body.appendChild(details);});
      (section.items||[]).forEach(([v,label])=>addLink(body,v,label));nav.appendChild(wrap);
    });
    const active=document.querySelector('#nav a.active');const view=active&&active.dataset.v;const initial=NX_NAV_SECTIONS.find(s=>nxNavViews(s).includes(view))||NX_NAV_SECTIONS.find(s=>s.id===(localStorage.getItem('cpnext_nav_section')||''))||NX_NAV_SECTIONS[0];nxSetNavSection(initial.id,false);
  }
  Object.assign(window,{nxToggleNavSection,nxToggleNav,nxCloseNav});
  function nxOrganizeTopbar(){
    const actions=document.querySelector('.topbar > .row-actions');if(!actions||actions.classList.contains('nx-top-actions'))return;
    const nodes=Array.from(actions.children);actions.classList.add('nx-top-actions');actions.innerHTML='<details class="nx-menu" id="nxCreateMenu"><summary>＋ Créer</summary><div class="nx-menu-panel nx-create-panel"></div></details><details class="nx-menu nx-menu-tools"><summary>••• Outils</summary><div class="nx-menu-panel nx-tools-panel"></div></details>';
    const create=actions.querySelector('.nx-create-panel'),tools=actions.querySelector('.nx-tools-panel');
    nodes.forEach(n=>{const txt=(n.textContent||'').toLowerCase(),onclick=(n.getAttribute&&n.getAttribute('onclick'))||'';if(txt.includes('nouveau devis')||txt.includes('dépannage')||txt.includes('mise en service')||txt.includes('location adia')||onclick.includes("newDevis")||onclick.includes('newDep')||onclick.includes('newLoc'))create.appendChild(n);else tools.appendChild(n);});
    tools.insertAdjacentHTML('afterbegin','<button type="button" onclick="nxOpenScanner(\'equip\')">📷 Scanner une plaque</button>');
    actions.addEventListener('click',e=>{if(e.target.closest('button'))actions.querySelectorAll('details[open]').forEach(d=>d.removeAttribute('open'));});
  }
  function nxSaveQuoteDefaults(){
    if(!cur)return;const all=nxLoad(NX_KEYS.quoteDefaults,{}),keys=['groupCable','support','pompeType','pompeQte','heures','moMode','rateChoice','rateCustom','acces','zone','mes','brasure','tests','taille','elecMode','breakerManual','differential','diffQte','proximity'];const data={};keys.forEach(k=>data[k]=nxClone(cur[k]));all[cur.type]=data;nxSave(NX_KEYS.quoteDefaults,all);
  }
  function nxApplyQuoteDefaults(){
    if(!cur)return;const data=nxLoad(NX_KEYS.quoteDefaults,{})[cur.type];if(!data)return;Object.keys(data).forEach(k=>{if(data[k]!=null)cur[k]=nxClone(data[k]);});loadDevisToForm();nxToast('Réglages habituels de '+cur.type+' chargés','ok');
  }
  function nxPatchQuoteAutomation(){
    nxInjectElectrical();nxInjectQuoteLayout();nxOrganizeNavigation();nxOrganizeTopbar();
    const oldMigrate=window.migrate;window.migrate=d=>nxEnsureQuote(oldMigrate(d));
    const oldNew=window.newDevis;window.newDevis=function(){oldNew();const data=nxLoad(NX_KEYS.quoteDefaults,{})[cur.type];if(data){Object.keys(data).forEach(k=>{if(data[k]!=null)cur[k]=nxClone(data[k]);});loadDevisToForm();}};
    const oldRenderMachines=window.renderMachines;window.renderMachines=function(){nxEnsureQuote(cur);oldRenderMachines();nxRenderMachineElectrical();};
    const oldForm=window.formToDevis;window.formToDevis=function(){
      const machineElec=Array.from(document.querySelectorAll('#machineList .subcard')).map(card=>({maxCurrent:Number((card.querySelector('.m-current')||{}).value)||0,breaker:(card.querySelector('.m-breaker')||{}).value||''}));oldForm();nxEnsureQuote(cur);(cur.machines||[]).forEach((m,i)=>Object.assign(m,machineElec[i]||{}));nxReadElectrical();
    };
    const oldLoad=window.loadDevisToForm;window.loadDevisToForm=function(){nxEnsureQuote(cur);oldLoad();nxRenderMachineElectrical();nxLoadElectrical();nxRenderQuoteAside();};
    const oldCompute=window.compute;window.compute=function(d){return oldCompute(nxQuoteForCompute(d));};
    const oldType=window.onTypeChange;window.onTypeChange=function(){oldType();nxEnsureQuote(cur);const data=nxLoad(NX_KEYS.quoteDefaults,{})[cur.type];if(data){Object.keys(data).forEach(k=>{if(data[k]!=null)cur[k]=nxClone(data[k]);});loadDevisToForm();}nxRenderQuoteAside();};
    const oldPower=window.onPuissChange;window.onPuissChange=function(i){oldPower(i);formToDevis();nxRenderQuoteAside();};
    const oldShow=window.showStep;window.showStep=function(){oldShow();nxRenderQuoteAside();};
    const oldRecalc=window.recalc;window.recalc=function(){oldRecalc();nxRenderQuoteAside();};
    const oldSave=window.saveDevis;window.saveDevis=function(){formToDevis();nxSaveQuoteDefaults();return oldSave();};
    const wizard=document.getElementById('v-wizard');if(wizard&&!wizard.dataset.nxLive){wizard.dataset.nxLive='1';wizard.addEventListener('change',e=>{if(e.target.matches('.s-long,.s-liaison,.s-cable,.g-type,.m-achat,.m-marge')){try{recalc();}catch(err){}}});}
    window.memMachine=function(i){const card=document.querySelectorAll('#machineList .subcard')[i];if(!card)return;const m={marque:card.querySelector('.m-marque').value.trim(),ref:card.querySelector('.m-ref').value.trim(),achat:Number(card.querySelector('.m-achat').value)||0,marge:Number(card.querySelector('.m-marge').value)||35,maxCurrent:Number(card.querySelector('.m-current').value)||0,breaker:card.querySelector('.m-breaker').value||''};if(!m.marque&&!m.ref){nxToast('Renseigne au moins la marque ou la référence','warn');return;}const j=MACHLIB.findIndex(x=>x.marque===m.marque&&x.ref===m.ref);if(j>=0)MACHLIB[j]=m;else MACHLIB.push(m);save(LS.machlib,MACHLIB);formToDevis();renderMachines();nxToast('Machine et protection mémorisées','ok');};
    Object.assign(window,{nxMachineElectricalChange,nxElectricalChange,nxApplyQuoteAuto,nxApplyQuoteDefaults,nxElectricalItems,nxBreakerFromCurrent,nxRenderQuoteAside});
  }

  /* ---------- Mode d'emploi intégré ---------- */
  const NX_GUIDE=[
    {id:'start',ico:'🚀',title:'Bien démarrer',intro:'La routine recommandée pour ne rien oublier.',steps:['Ouvre le Cockpit Next : il résume les urgences et les opportunités.','Crée ou retrouve le client avant de chiffrer. Renseigne son origine pour mesurer ce qui apporte des clients.','Crée le devis, vérifie la marge et le gain horaire, puis enregistre-le.','Après acceptation : planifie, vérifie le stock et imprime la checklist camion.','Après le chantier : saisis les heures et achats réels, facture puis marque le paiement.']},
    {id:'devis',ico:'📝',title:'Devis et chiffrage',intro:'Du besoin client au PDF.',steps:['Nouveau devis → choisis le type de chantier. Les quantités et liaisons se préremplissent selon le type et la puissance.','Tape le nom d’un client existant pour récupérer ses coordonnées et sa zone.','Ajoute la machine, les longueurs réelles, les fournitures, la main-d’œuvre et le déplacement.','Dans Installation, les kits Protection clim ajoutent un disjoncteur 16 A, 20 A ou 32 A par le mécanisme natif des articles. Valide le choix avec la notice constructeur.','Le récapitulatif distingue CA, achat, marge, cotisations et gain horaire. Corrige toute alerte avant envoi.','Pour un chantier courant, clique « Modèle » : le prochain devis sera prêt en quelques secondes.']},
    {id:'planning',ico:'📅',title:'Planning et iPhone',intro:'Organiser le terrain.',steps:['Un devis accepté sans date apparaît automatiquement dans À faire.','Dans Planning, affecte une date au chantier. Les dépannages, locations et entretiens remontent automatiquement.','Clique sur la carte pour ouvrir l’itinéraire Google Maps.','Clique « Calendrier iPhone » puis ouvre le fichier .ics sur l’iPhone/iPad et choisis « Ajouter tout ».','L’export .ics est une photo du planning : refais-le après les changements importants.']},
    {id:'money',ico:'💶',title:'Factures et encaissements',intro:'Suivre l’argent réellement reçu.',steps:['Un devis accepté peut produire une facture totale ou acompte + solde dans la série F-AAAA-XXX.','Ne marque « Payée » qu’après réception réelle de l’argent et indique le mode de règlement.','Le livre des recettes se remplit depuis les encaissements, pas depuis les devis acceptés.','Le dashboard calcule la provision URSSAF sur l’encaissé.','Les factures de plus de 30 jours non payées deviennent une priorité rouge avec mail de relance.']},
    {id:'clients',ico:'👤',title:'Clients, parc et contrats',intro:'Construire le fonds de commerce.',steps:['Clique sur un client pour ouvrir sa fiche 360° : historique, CA, parc, contrats et notes.','Après une pose, enregistre l’équipement : modèle, série, fluide, charge, date et garantie.','Entretien → Créer un contrat guidé. Clim : 1 visite/an ; adiabatique : 2 visites/an par défaut.','La prochaine visite apparaît au planning. Après intervention, clique « Visite faite » pour calculer la suivante.','La fin de garantie est une occasion de proposer un contrat avant que le client ne parte ailleurs.']},
    {id:'fluides',ico:'🧪',title:'Fluides et documents terrain',intro:'Traçabilité métier.',steps:['Crée une fiche fluide pour chaque manipulation concernée et vérifie les données réglementaires.','Le parc installé préremplit la marque, le modèle, la série, le fluide et la charge.','Dans la fiche Cerfa, clique « Scanner la plaque équipement » : le client, la nature et les quantités déjà saisis restent en place.','Contrôle chaque champ proposé avec la plaque originale avant d’enregistrer.','Imprime la fiche, fais signer les parties et conserve-la selon les obligations applicables.','Le registre annuel récapitule les quantités chargées et récupérées par fluide.']},
    {id:'adia',ico:'💨',title:'Adiabatique et locations',intro:'Dimensionner, vendre et louer.',steps:['Dimensionne avec température et humidité réalistes ; ne promets jamais une consigne.','Vérifie obligatoirement la sortie d’air du local.','Le devis adia reprend arrivée d’eau, vidange, électricité, pose, accès et entretien.','En location, sépare livraison, mise en route, reprise, nettoyage et caution.','Les chevauchements de dates d’une même machine sont contrôlés avant l’enregistrement.']},
    {id:'security',ico:'🛡️',title:'Sécurité et sauvegardes',intro:'Éviter la perte de données.',steps:['Le PIN protège des regards, pas d’un pirate ayant accès à l’appareil.','Vérifie l’état du cloud et synchronise avant de changer d’appareil.','Télécharge une sauvegarde JSON au moins chaque semaine.','La corbeille conserve les suppressions pendant 30 jours.','L’historique Next garde 10 points de restauration. Avant une grosse modification, crée un point manuel.']},
    {id:'trouble',ico:'🧰',title:'En cas de problème',intro:'Les vérifications simples.',steps:['Recharge complètement la page. Sur iPhone : ferme l’app puis rouvre-la.','Vérifie que le bandeau cloud indique « synchronisé ».','Si les menus sont vides sur un nouvel appareil, importe une sauvegarde JSON puis synchronise.','Si une ancienne version reste affichée, vide le cache du site ou réinstalle l’icône d’accueil.','Ne recrée pas les données au hasard : consulte d’abord l’historique et la corbeille.']}
  ];
  function nxRenderHelp(active){
    const box=document.getElementById('nxHelp');if(!box)return;const sections=active?NX_GUIDE.filter(x=>x.id===active):NX_GUIDE;
    box.innerHTML=`<div class="next-hero"><h2>❔ Mode d’emploi ClimPilot</h2><p>Un guide vivant pour toi et tes futurs salariés. Il évolue avec chaque fonctionnalité.</p><div class="next-actions"><button onclick="nxDownloadGuide()">⬇ Télécharger le guide texte</button></div></div><div class="next-help-nav"><button class="btn-ghost ${!active?'on':''}" onclick="nxRenderHelp()">Tout</button>${NX_GUIDE.map(x=>`<button class="btn-ghost ${active===x.id?'on':''}" onclick="nxRenderHelp('${x.id}')">${x.ico} ${x.title}</button>`).join('')}</div><div class="next-grid">${sections.map(x=>`<div class="next-card next-col-6 next-guide-section"><h3>${x.ico} ${x.title}</h3><p class="sub">${x.intro}</p><div class="next-steps">${x.steps.map(s=>`<div class="next-step">${nxEsc(s)}</div>`).join('')}</div></div>`).join('')}</div>`;
  }
  function nxGuideMarkdown(){return '# ClimPilot — Mode d’emploi\n\nVersion : '+NX_VERSION+' — '+new Date().toLocaleDateString('fr-FR')+'\n\n'+NX_GUIDE.map(x=>'## '+x.ico+' '+x.title+'\n\n'+x.intro+'\n\n'+x.steps.map((s,i)=>(i+1)+'. '+s).join('\n')).join('\n\n---\n\n')+'\n\n## Règle de sécurité\n\nLe scan OCR propose des informations mais ne remplace jamais le contrôle du technicien. Les montants, mentions légales et données réglementaires doivent être vérifiés avant émission.\n';}
  function nxDownloadGuide(){nxDownload('ClimPilot_Mode_Emploi.md','\ufeff'+nxGuideMarkdown(),'text/markdown;charset=utf-8');}
  Object.assign(window,{nxRenderHelp,nxDownloadGuide});

  /* ---------- Initialisation et raccords au cœur ---------- */
  function nxPatchCoreRenders(){
    const dash=window.renderDash;window.renderDash=function(){dash();nxRenderDashStrip();};
    const badges=window.updateBadges;window.updateBadges=function(){badges();nxUpdateTaskBadge();};
    const planning=window.renderPlanning;window.renderPlanning=function(){planning();const v=document.getElementById('v-plan'),head=v&&v.querySelector('.flexhead .row-actions');if(head&&!document.getElementById('nxIcsBtn'))head.insertAdjacentHTML('beforeend','<button class="btn-ghost btn-sm" id="nxIcsBtn" onclick="nxExportICS()">📅 Calendrier iPhone</button>');};
  }
  function nxSelfTest(){
    const tests=[];const check=(name,ok,detail)=>tests.push({name,ok:!!ok,detail:detail||''});
    try{
      check('Couche Next chargée',document.documentElement.dataset.climpilotNext===NX_VERSION);
      check('Recherche globale présente',!!document.getElementById('nxSearch'));
      check('Six vues Next présentes',['nx_cockpit','nx_tasks','nx_templates','nx_scan','nx_tools','nx_help'].every(v=>!!document.getElementById('v-'+v)));
      check('Navigation Next présente',!!document.querySelector('[data-v="nx_tasks"]'));
      check('Navigation en catégories',document.querySelectorAll('.nx-nav-section').length===7);
      check('Sous-catégorie Devis',!!document.querySelector('.nx-nav-subgroup [data-v="verifier"]'));
      check('Scanner contextuel présent',!!document.getElementById('nxContextScanner')&&!!document.getElementById('nxScanEquipBtn')&&!!document.getElementById('nxScanFluBtn'));
      go('nx_tasks');check('Navigation vers À faire',document.getElementById('v-nx_tasks').classList.contains('active'));
      go('wizard');newDevis();
      check('Assistant devis initialisé',!!cur&&cur.type==='Monosplit');
      check('Menus devis remplis',document.getElementById('f_groupCable').options.length>=4&&document.getElementById('f_zone').options.length>=5);
      check('Liaison 5 kW automatisée',liaisonForPower(5)==='Liaison 1/4 - 1/2');
      const quote=compute(cur);check('Calcul devis opérationnel',Number(quote.totalHT)>0,'HT='+quote.totalHT);
      check('Psychrométrie adia',Math.abs(adiaTwb(30,45)-21.4)<.2,'Twb='+adiaTwb(30,45));
      const locCalc=computeLoc({dateDebut:'2026-07-13',dateFin:'2026-08-09',livraison:90,reprise:60,nettoyage:60,items:[{ref:'Mobile 34 000',qte:2,tarif:180}]});check('Calcul location complet',locCalc.totalHT===1650,'HT='+locCalc.totalHT);
      nxOpenContractWizard();check('Assistant contrat accessible',document.getElementById('mCtr').classList.contains('on'));nxCloseModal('mCtr');
      ['renderDash','renderPlanning','renderCommander','renderContrats','renderFluides','renderRecettes'].forEach(fn=>{try{window[fn]();check('Vue '+fn,true);}catch(e){check('Vue '+fn,false,e.message);}});
      const parsed=nxParseOCR('DAIKIN MODEL RXM35 SERIAL AB12345 REFRIGERANT R32 FACTORY CHARGE 1.25 kg','equip');
      check('OCR fluide',parsed.fluide==='R32',JSON.stringify(parsed));
      check('OCR charge',Math.abs(Number(parsed.charge)-1.25)<.001,JSON.stringify(parsed));
      check('OCR série',parsed.serie==='AB12345',JSON.stringify(parsed));
      const before=nxTasks.length;nxTasks.push({id:'NX-SELFTEST',title:'Test automatique',due:nxToday(),priority:'low',cat:'Test',done:false});
      check('Tâche ajoutée en mémoire',nxTasks.length===before+1);nxTasks=nxTasks.filter(t=>t.id!=='NX-SELFTEST');
      const sample={id:'NX-CAL',num:'DV-TEST',statut:'accepte',datePlanif:nxToday(),cNom:'Client test',type:'Monosplit',heures:4};DEVIS.push(sample);
      const cal=nxCalendarEvents();check('Événement calendrier généré',cal.some(e=>e.uid==='devis-NX-CAL'));DEVIS.splice(DEVIS.indexOf(sample),1);
      nxBuildSearch();check('Moteur de recherche indexé',nxSearchItems.length>=5,'items='+nxSearchItems.length);
      const html=NX_GUIDE.map(x=>x.steps.length).reduce((a,b)=>a+b,0);check('Mode d’emploi complet',html>=35,'étapes='+html);
      check('Corbeille configurée',Object.keys(nxEntityMap).length>=7);
      check('Historique limité à 10',true);
    }catch(e){check('Exécution globale',false,e.message||String(e));}
    const login=document.getElementById('loginScreen');if(login)login.style.display='none';go('nx_cockpit');
    const result={version:NX_VERSION,date:new Date().toISOString(),passed:tests.filter(t=>t.ok).length,total:tests.length,tests};
    const pre=document.createElement('pre');pre.id='nx-selftest';pre.style.whiteSpace='pre-wrap';pre.textContent=JSON.stringify(result,null,2);document.body.appendChild(pre);document.title='SELFTEST '+result.passed+'/'+result.total;return result;
  }
  function nxInit(){
    try{
      nxInjectShell();nxInjectOrigin();nxPatchNavigation();nxPatchOrigins();nxOrganizeNavigation();nxOrganizeTopbar();nxPatchDeletes();nxPatchCloudHistory();nxPatchContracts();nxPatchCoreRenders();nxBindSearch();nxCleanTrash();nxRenderDashStrip();nxUpdateTaskBadge();nxNotifyUrgent();
      document.documentElement.dataset.climpilotNext=NX_VERSION;
      const brand=document.querySelector('.brand small');if(brand)brand.textContent='ClimPilot '+NX_VERSION;
      setTimeout(()=>nxSnapshot('Ouverture de ClimPilot Next'),1200);
      const wantsTest=new URLSearchParams(location.search).get('nxselftest')==='1';
      const localTest=location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname==='[::1]';
      if(wantsTest&&localTest)setTimeout(nxSelfTest,700);
      else if(wantsTest)console.warn('ClimPilot : auto-test refusé hors environnement local');
    }catch(e){console.error('ClimPilot Next init',e);nxToast('ClimPilot Next : '+(e.message||'erreur de démarrage'),'err');}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',nxInit);else nxInit();
})();
