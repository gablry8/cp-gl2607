/* ============================================================
   ClimPilot Next — next-cerfa.js  (couche additive)
   FICHE D'INTERVENTION FLUIDES CONFORME AU CERFA 15497*04
   - Complète la fiche existante avec TOUTES les rubriques du Cerfa
     (notice officielle service-public, cadres 1 à 14) : SIRET détenteur,
     identification du circuit, PRP / tonnage équivalent CO2, 8 natures
     d'intervention, détecteur manuel (n° + date de contrôle), système
     permanent, périodicité, fuites (localisation, réparation), BSFF,
     code UN / ADR, installation de destination.
   - « Mon matériel fluides » (détecteurs, bouteilles, centre de reprise,
     codes UN) : saisi une fois, repris sur chaque fiche.
   - Impression fidèle aux 14 cadres + signatures (détenteur en ligne).
   - Dépannage dicté avec fluide → fiche pré-remplie à l'enregistrement.
   - Lecture de plaque par photo : IA (Claude) si activée, sinon OCR local.
   Rappel légal (notice Cerfa) : forme électronique admise ; conservation
   5 ans par l'opérateur ET le détenteur ; signatures des deux sur le même document.
   ============================================================ */
(function(){
  'use strict';
  var MKEY='cpnext_materiel';
  try{ if(Array.isArray(SYNC_KEYS) && SYNC_KEYS.indexOf(MKEY)<0) SYNC_KEYS.push(MKEY); }catch(e){}
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function toastX(m,t){ try{ if(window.nxToast) return window.nxToast(m,t); }catch(e){} try{ toast(m); }catch(e){} }
  function M(){ var m; try{ m=JSON.parse(localStorage.getItem(MKEY)||'null'); }catch(e){} m=m||{}; m.detecteurs=m.detecteurs||[]; m.unCodes=m.unCodes||{}; return m; }
  function saveM(m){ try{ if(typeof save==='function') save(MKEY,m); else localStorage.setItem(MKEY,JSON.stringify(m)); }catch(e){} }
  window.nxcMateriel = M;
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function g(id){ var e=document.getElementById(id); return e?e.value:''; }
  function s(id,v){ var e=document.getElementById(id); if(e) e.value=(v==null?'':v); }
  function frDate(d){ try{ return d?new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR'):''; }catch(e){ return d||''; } }

  /* natures du cadre 4 (notice) — les anciennes valeurs restent valides */
  var NAT={assemblage:'Assemblage de l\'équipement',mes:'Mise en service',modification:'Modification de l\'équipement',entretien:'Maintenance',
    depannage:'Maintenance (dépannage / réparation)',etancheite:'Contrôle d\'étanchéité périodique',etancheite_np:'Contrôle d\'étanchéité non périodique',
    demantelement:'Démantèlement',autre:'Autre'};
  var HFC=/^R(32|125|134A|143A|404A|407[A-H]?|410A|413A|417A|422[A-D]?|427A|437A|438A|442A|448A|449[A-C]?|450A|452[A-C]?|453A|454[A-C]?|455A|507A?|508[AB]?|513A|515B|23|227EA|236FA|245FA)$/i;
  var HFO=/^R(1234YF|1234ZE|1233ZD|1336MZZ)/i;
  function famille(fl){ fl=String(fl||'').toUpperCase().replace(/[\s-]/g,''); if(HFC.test(fl)) return 'HFC'; if(HFO.test(fl)) return 'HFO'; if(/^R(22|123|124|142B|401|402|408|409)/.test(fl)) return 'HCFC'; if(/^R(290|600A?|1270|744|717)$/.test(fl)) return 'naturel'; return ''; }
  window.nxcFamille = famille;

  /* ---------- 1. champs complémentaires dans la fiche ---------- */
  function inject(){
    var modal=document.getElementById('mFlu'); if(!modal || document.getElementById('nxcCerfa')) return !!modal;
    var nat=document.getElementById('fl_nature');
    if(nat){ Object.keys(NAT).forEach(function(k){ if(![].some.call(nat.options,function(o){return o.value===k;})){ var o=document.createElement('option'); o.value=k; o.textContent=NAT[k]; nat.appendChild(o); } });
      [].forEach.call(nat.options,function(o){ if(NAT[o.value]) o.textContent=NAT[o.value]; }); }
    var fl=document.getElementById('fl_fluide');
    if(fl && ![].some.call(fl.options,function(o){return o.value==='R407C';})) ['R407C','R449A','R452A','R454B','R513A','R744','R1234yf','R600a','R22'].forEach(function(v){ var o=document.createElement('option'); o.textContent=v; fl.insertBefore(o, fl.lastElementChild); });
    var firstFrm=modal.querySelector('.bd .frm');
    var box=document.createElement('div'); box.id='nxcCerfa';
    box.innerHTML=
      '<div class="nxc-bar"><button type="button" class="nx-sbtn mar" onclick="nxcScanPlate()">📷 Lire la plaque (photo)</button><span class="nxc-hint">marque, modèle, n° de série, fluide, charge, PRP, t éq. CO₂</span></div>'+
      '<div id="nxcWarn"></div>'+
      '<h3 class="nxc-h">Compléments Cerfa 15497*04</h3>'+
      '<div class="frm">'+
        '<label>Identification / repère du circuit<input id="fl_ident" placeholder="Ex : Groupe 1 — réserve froid positif"></label>'+
        '<label>Autre nature (si « Autre »)<input id="fl_natautre"></label>'+
        '<label>PRP du fluide<input type="number" id="fl_prg" step="1" min="0" placeholder="plaque ou fiche fluide" oninput="nxcCalc()"></label>'+
        '<label>Tonnage éq. CO₂ (t)<input type="number" id="fl_teq" step="0.01" min="0"><span class="note-inline" id="nxcTeqNote">PRP × charge / 1000</span></label>'+
        '<label>Détecteur manuel de fuite<select id="fl_det" onchange="nxcDetPick()"></select></label>'+
        '<label>Contrôle du détecteur (date)<input type="date" id="fl_detdate"></label>'+
        '<label>Système permanent de détection<select id="fl_sysperm"><option value="non">Non</option><option value="oui">Oui</option></select></label>'+
        '<label>Périodicité du contrôle d\'étanchéité<select id="fl_perio"><option value="">— non concerné / à définir —</option><option value="3">3 mois</option><option value="6">6 mois</option><option value="12">12 mois</option><option value="24">24 mois</option></select><span class="note-inline">selon le fluide, la charge et le détecteur (art. 4, arrêté du 29/02/2016)</span></label>'+
        '<label class="full">Localisation des fuites constatées<input id="fl_fuiteloc" placeholder="Ex : raccord flare unité intérieure"></label>'+
        '<label>N° de BSFF / Trackdéchets<input id="fl_bsff" placeholder="si fluide remis pour traitement"></label>'+
        '<label>Code UN et dénomination ADR<input id="fl_un" placeholder="Ex : UN 3252 DIFLUOROMÉTHANE"></label>'+
        '<label class="full">Installation de destination du fluide récupéré<input id="fl_dest" placeholder="Nom et adresse (distributeur / centre de traitement)"></label>'+
      '</div>'+
      '<div class="nxc-bar" id="nxcSignBar"></div>';
    if(firstFrm && firstFrm.parentNode) firstFrm.parentNode.insertBefore(box, firstFrm.nextSibling); else modal.querySelector('.bd').appendChild(box);
    ['fl_charge','fl_fluide'].forEach(function(id){ var e=document.getElementById(id); if(e) e.addEventListener('input',function(){ nxcCalc(); }); if(e) e.addEventListener('change',function(){ nxcCalc(); if(id==='fl_fluide') fillUN(); }); });
    return true;
  }
  function fillDetSelect(sel){
    var m=M(), el=document.getElementById('fl_det'); if(!el) return;
    el.innerHTML='<option value="">— aucun / non utilisé —</option>'+m.detecteurs.map(function(d,i){ return '<option value="'+i+'">'+esc(d.ref||'Détecteur')+' — n° '+esc(d.id||'?')+'</option>'; }).join('');
    if(sel!=null) el.value=sel;
  }
  window.nxcDetPick=function(){ var m=M(), i=g('fl_det'); if(i!==''&&m.detecteurs[+i]) s('fl_detdate', m.detecteurs[+i].dateCtrl||''); };
  window.nxcCalc=function(){
    var prg=num(g('fl_prg')), ch=num(g('fl_charge')), fam=famille(g('fl_fluide')), note=document.getElementById('nxcTeqNote');
    if(prg>0 && ch>0){ s('fl_teq', (Math.round(prg*ch/10)/100).toFixed(2)); if(note) note.textContent='calculé : '+prg+' × '+ch+' kg / 1000'; }
    else if(note) note.textContent=fam==='HFC'?'PRP × charge / 1000 — lis le PRP sur la plaque':'utile pour les HFC / PFC (cadre 7)';
  };
  function fillUN(){ var m=M(), fl=g('fl_fluide'); if(!g('fl_un') && m.unCodes[fl]) s('fl_un', m.unCodes[fl]); }

  function setWarn(list){ var w=document.getElementById('nxcWarn'); if(!w) return; w.innerHTML=list&&list.length?'<div class="nxc-warn"><b>À vérifier avant d\'enregistrer :</b><ul>'+list.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>':''; }
  window.nxcSetWarn=setWarn;

  /* ---------- 2. ouverture / enregistrement (enveloppes) ---------- */
  function wrap(){
    if(typeof window.openFlu==='function' && !window.openFlu._nxc){
      var oOpen=window.openFlu;
      window.openFlu=function(id,pre){
        var r=oOpen.apply(this,arguments);
        try{
          inject();
          var f=id?(FLU||[]).find(function(x){ return x.id===id; }):null, m=M();
          fillDetSelect(f&&f.detIdx!=null?String(f.detIdx):(m.defDet!=null&&m.detecteurs[m.defDet]?String(m.defDet):''));
          s('fl_ident',f?f.ident:''); s('fl_natautre',f?f.natAutre:''); s('fl_prg',f?f.prg:''); s('fl_teq',f?f.teq:'');
          s('fl_detdate',f?f.detDate:(g('fl_det')!==''&&m.detecteurs[+g('fl_det')]?m.detecteurs[+g('fl_det')].dateCtrl:''));
          s('fl_sysperm',f&&f.sysPerm?f.sysPerm:'non'); s('fl_perio',f?f.perio||'':''); s('fl_fuiteloc',f?f.fuiteLoc:'');
          s('fl_bsff',f?f.bsff:''); s('fl_un',f?f.un:''); s('fl_dest',f?f.dest:(m.destNom?[m.destNom,m.destAdr].filter(Boolean).join(' — '):''));
          if(!f && m.bouteilles && !g('fl_bout')) s('fl_bout','');
          if(!f) fillUN();
          if(pre && pre.warn) setWarn(pre.warn); else setWarn([]);
          nxcCalc();
          var sb2=document.getElementById('nxcSignBar');
          if(sb2) sb2.innerHTML=f?(f.sigDetenteur?'<span class="nxc-ok">✔ Signée par le détenteur ('+esc(f.sigDetenteur.nom)+') le '+esc(new Date(f.sigDetenteur.at).toLocaleDateString('fr-FR'))+'</span>':'<button type="button" class="nx-sbtn mar" onclick="closeModal(\'mFlu\');nxsSendFlu(\''+f.id+'\')">✍️ Faire signer le détenteur en ligne</button>'):'<span class="nxc-hint">Enregistre la fiche pour pouvoir la faire signer en ligne par le détenteur.</span>';
        }catch(e){ try{ console.error('nxc open',e); }catch(_){} }
        return r;
      };
      window.openFlu._nxc=true;
    }
    if(typeof window.saveFlu==='function' && !window.saveFlu._nxc){
      var oSave=window.saveFlu;
      window.saveFlu=function(printAfter){
        var before={}; (FLU||[]).forEach(function(x){ before[x.id]=1; });
        var id0=g('fl_id');
        var ext={ident:g('fl_ident').trim(),natAutre:g('fl_natautre').trim(),prg:num(g('fl_prg'))||null,teq:num(g('fl_teq'))||null,
          detIdx:g('fl_det')===''?null:+g('fl_det'),detDate:g('fl_detdate'),sysPerm:g('fl_sysperm')||'non',perio:g('fl_perio'),
          fuiteLoc:g('fl_fuiteloc').trim(),bsff:g('fl_bsff').trim(),un:g('fl_un').trim(),dest:g('fl_dest').trim()};
        var m=M(); if(ext.detIdx!=null && m.detecteurs[ext.detIdx]){ ext.detId=m.detecteurs[ext.detIdx].id; ext.detRef=m.detecteurs[ext.detIdx].ref; }
        var fl=g('fl_fluide'); if(ext.un && fl && m.unCodes[fl]!==ext.un){ m.unCodes[fl]=ext.un; saveM(m); }
        var r=oSave.call(this,false);
        try{
          var f=id0?(FLU||[]).find(function(x){ return x.id===id0; }):(FLU||[]).find(function(x){ return !before[x.id]; });
          if(f){ Object.assign(f,ext); save('cp2_fluides',FLU); if(printAfter) window.printFicheFlu(f.id); }
        }catch(e){ try{ console.error('nxc save',e); }catch(_){} }
        return r;
      };
      window.saveFlu._nxc=true;
    }
    /* dépannage dicté avec fluide → fiche pré-remplie dès l'enregistrement de l'intervention */
    if(typeof window.saveDep==='function' && !window.saveDep._nxc){
      var oDep=window.saveDep;
      window.saveDep=function(){
        var d=(typeof curDep!=='undefined')?curDep:null, fx=d&&d._fluide?d._fluide:null, meta=d?{client:d.cNom,date:d.date,itype:d.itype}:null;
        var r=oDep.apply(this,arguments);
        try{
          if(fx && meta){
            var saved=(DEP||[]).find(function(x){ return x.id===d.id; }); if(saved) delete saved._fluide; try{ save(LS.dep,DEP); }catch(e){}
            setTimeout(function(){ openFluFromIntervention(meta,fx); },250);
          }
        }catch(e){}
        return r;
      };
      window.saveDep._nxc=true;
    }
  }
  function openFluFromIntervention(meta,fx){
    var warn=['Vérifie le type de fluide chargé (vierge / recyclé / régénéré)'];
    window.openFlu(null,{client:meta.client,date:meta.date,nature:meta.itype==='mes'?'mes':'depannage',warn:warn});
    var fl=String(fx.nom||'').toUpperCase().replace(/\s/g,'');
    var sel=document.getElementById('fl_fluide');
    if(sel && fl){ var opt=[].find.call(sel.options,function(o){ return o.value.toUpperCase()===fl; }); if(opt) sel.value=opt.value; else { sel.value='Autre'; warn.push('Fluide « '+fx.nom+' » à préciser en observations'); } }
    if(fx.charge) s('fl_qv', num(fx.charge));
    if(fx.recupere){ s('fl_qru', num(fx.recupere)); warn.push('Fluide récupéré : pour réutilisation ou pour traitement (BSFF) ?'); }
    if(!g('fl_desc')) warn.push('Équipement : lis la plaque (📷) ou choisis-le dans le parc');
    fillUN(); nxcCalc(); setWarn(warn);
    toastX('🧪 Fiche fluide pré-remplie depuis l\'intervention — vérifie et enregistre','ok');
  }
  window.nxcFromIntervention=openFluFromIntervention;

  /* ---------- 3. impression fidèle au Cerfa 15497*04 ---------- */
  function box(on,label){ return '<span style="white-space:nowrap;margin-right:10px">'+(on?'☒':'☐')+' '+label+'</span>'; }
  window.printFicheFlu=function(id){
    var f=(FLU||[]).find(function(x){ return x.id===id; }); if(!f) return;
    var E=(P&&P.entreprise)||{}, cl=(CLIENTS||[]).find(function(x){ return (x.nom||'').toLowerCase()===(f.client||'').toLowerCase(); })||{};
    var eq=(typeof EQUIP!=='undefined'&&f.equipId)?(EQUIP||[]).find(function(x){ return x.id===f.equipId; }):null;
    var fam=famille(f.fluide), ch=num(f.charge), teq=f.teq||(f.prg&&ch?Math.round(f.prg*ch/10)/100:null);
    var q=function(v){ v=num(v); return v?String(Math.round(v*1000)/1000).replace('.',','):'0'; };
    var B='#121417', td='padding:5px 8px;border:1px solid #9aa9b8;font-size:9.8px;vertical-align:top';
    var cad=function(n,t){ return '<tr><td colspan="4" style="background:'+B+';color:#fff;font-weight:700;font-size:10px;padding:4px 8px">'+n+' — '+t+'</td></tr>'; };
    var row=function(cells){ return '<tr>'+cells.map(function(c){ return '<td style="'+td+'"'+(c[1]?' colspan="'+c[1]+'"':'')+'>'+c[0]+'</td>'; }).join('')+'</tr>'; };
    var fuite=f.ctrl==='fuite_rep'||f.ctrl==='fuite_nonrep';
    var chTot=num(f.qv)+num(f.qrec)+num(f.qreg), reTot=num(f.qrt)+num(f.qru);
    var nat=f.nature;
    var detSig=f.sigDetenteur?('<b>'+esc(f.sigDetenteur.nom)+'</b> — signé électroniquement le '+esc(new Date(f.sigDetenteur.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}))+(f.sigDetenteur.png?'<br><img src="'+esc(f.sigDetenteur.png)+'" style="height:48px">':'')):'<b>'+esc(f.client)+'</b>';
    var html='<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:780px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid '+B+';padding-bottom:4px;margin-bottom:6px"><div><b style="font-size:14px">FICHE D\'INTERVENTION</b><br><span style="font-size:9.5px">Opérations nécessitant une manipulation de fluides frigorigènes — équivalent électronique du formulaire <b>Cerfa n° 15497*04</b> (art. R.543-82 du code de l\'environnement)</span></div><div style="text-align:right;font-size:10px">N° <b style="font-family:monospace;font-size:12px">'+esc(f.num)+'</b><br>Date : <b>'+esc(frDate(f.date))+'</b></div></div>'+
      '<table style="width:100%;border-collapse:collapse">'+
      cad(1,'Opérateur')+row([['Nom / raison sociale : <b>'+esc(E.nom||'—')+'</b><br>'+esc([E.adresse,E.cp,E.ville].filter(Boolean).join(' ')),2],['SIRET : <b>'+esc(E.siret||'⚠ à renseigner')+'</b>',1],['N° d\'attestation de capacité : <b>'+esc(E.attFluides||'⚠ à renseigner')+'</b>',1]])+
      cad(2,'Détenteur')+row([['Nom : <b>'+esc(f.client)+'</b><br>Adresse : '+esc([cl.adr,cl.cp,cl.ville].filter(Boolean).join(' ')||'—'),3],['SIRET (ou équivalent) : '+esc(cl.siren||cl.siret||(cl.type==='Particulier'?'particulier':'—')),1]])+
      cad(3,'Équipement concerné')+row([['Marque, référence : '+esc(f.desc||'—'),2],['Identification : '+esc(f.ident||(eq&&eq.serie?'SN '+eq.serie:'—')),2]])+
      row([['Dénomination du fluide : <b>'+esc(f.fluide||'—')+'</b>',1],['Charge totale : <b>'+q(ch)+' kg</b>',1],['PRP : '+(f.prg?esc(f.prg):'—'),1],['Tonnage éq. CO₂ : <b>'+(teq!=null?String(teq).replace('.',',')+' t':'—')+'</b>',1]])+
      cad(4,'Nature de l\'intervention')+row([[box(nat==='assemblage','Assemblage')+box(nat==='mes','Mise en service')+box(nat==='modification','Modification')+box(nat==='entretien'||nat==='depannage','Maintenance')+'<br>'+box(nat==='etancheite','Contrôle d\'étanchéité périodique')+box(nat==='etancheite_np','Contrôle d\'étanchéité non périodique')+box(nat==='demantelement','Démantèlement')+box(nat==='autre','Autre'+(f.natAutre?' : '+esc(f.natAutre):'')),4]])+
      cad(5,'Détecteur manuel de fuite')+row([['Identification : '+esc(f.detId?((f.detRef?f.detRef+' — ':'')+'n° '+f.detId):'—'),2],['Contrôlé le : '+esc(frDate(f.detDate)||'—'),2]])+
      cad(6,'Présence d\'un système permanent de détection de fuites')+row([[box(f.sysPerm==='oui','Oui')+box(f.sysPerm!=='oui','Non'),4]])+
      cad('7, 8, 9','Quantité de fluide dans l\'équipement et périodicité du contrôle d\'étanchéité')+row([['Famille : '+esc(fam||'—')+' — charge '+q(ch)+' kg'+(teq!=null?' — '+String(teq).replace('.',',')+' t éq. CO₂':''),2],['Fréquence minimale du contrôle : <b>'+(f.perio?esc(f.perio)+' mois':'—')+'</b> ('+(f.sysPerm==='oui'?'avec':'sans')+' système permanent)',2]])+
      cad(10,'Fuites constatées lors du contrôle d\'étanchéité')+row([[box(fuite,'Oui')+box(f.ctrl==='ok','Non')+(f.ctrl==='na'?'<i>(contrôle non réalisé lors de cette intervention)</i>':''),1],['Localisation : '+esc(f.fuiteLoc||'—'),2],['Réparation : '+(fuite?(f.ctrl==='fuite_rep'?'<b>réalisée</b>':'<b style="color:#b03a2e">à faire</b>'):'—'),1]])+
      cad(11,'Manipulation du fluide frigorigène')+
      row([['<b>Quantité chargée totale (A+B+C) : '+q(chTot)+' kg</b>',2],['<b>Quantité récupérée totale (D+E) : '+q(reTot)+' kg</b>',2]])+
      row([['A — fluide vierge : '+q(f.qv)+' kg<br>B — fluide recyclé : '+q(f.qrec)+' kg<br>C — fluide régénéré : '+q(f.qreg)+' kg',2],['D — destiné au traitement : '+q(f.qrt)+' kg'+(num(f.qrt)>0?' — BSFF n° <b>'+esc(f.bsff||'⚠ à compléter')+'</b>':'')+'<br>E — conservé pour réutilisation : '+q(f.qru)+' kg<br>Contenant(s) de récupération : '+esc(f.bout||'—'),2]])+
      cad(12,'Code UN et dénomination ADR / RID du déchet de fluide')+row([[esc(f.un||(num(f.qrt)>0?'⚠ à compléter':'—')),4]])+
      cad(13,'Installation de destination du fluide récupéré')+row([[esc(f.dest||(reTot>0?'⚠ à compléter':'—')),4]])+
      cad(14,'Observations')+row([[esc(f.obs||'—').replace(/\n/g,'<br>'),4]])+
      '</table>'+
      '<table style="width:100%;border-collapse:collapse;margin-top:10px"><tr>'+
        '<td style="width:50%;border:1px solid #9aa9b8;padding:8px;height:84px;vertical-align:top;font-size:9.8px">Signature de l\'opérateur (nom, date) :<br><b>'+esc(E.nom||'')+'</b></td>'+
        '<td style="width:50%;border:1px solid #9aa9b8;padding:8px;vertical-align:top;font-size:9.8px">Signature du détenteur (nom, date) :<br>'+detSig+'</td></tr></table>'+
      '<div style="font-size:8.6px;color:#555;margin-top:6px">Document à conserver 5 ans par l\'opérateur et par le détenteur. Établi sous forme électronique conformément à la notice du Cerfa 15497*04.'+(f.sigDetenteur?' Empreinte SHA-256 du document signé : '+esc(f.sigDetenteur.hash||''):'')+'</div>'+
      '</div>';
    var doc=document.getElementById('devisDoc'); if(doc) doc.innerHTML=html;
    window.print();
  };

  /* ---------- 4. « Mon matériel fluides » (vue Fluides) ---------- */
  function renderMat(){
    var host=document.getElementById('nxcMat'); if(!host) return;
    var m=M(), E=(P&&P.entreprise)||{}, miss=[];
    if(!E.siret) miss.push('SIRET'); if(!E.attFluides) miss.push('n° d\'attestation de capacité'); if(!m.detecteurs.length) miss.push('détecteur de fuite');
    host.innerHTML='<div class="card"><div class="nxa-hd" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">🧰 Mon matériel fluides</h2><button class="nx-sbtn" onclick="nxcToggleMat()">'+(host.dataset.open?'Fermer':'Modifier')+'</button></div>'+
      '<div class="nxc-hint" style="margin:4px 0">'+(miss.length?'⚠ Manque pour des fiches complètes : <b>'+miss.join(', ')+'</b>'+(miss.indexOf('SIRET')>=0||miss.indexOf('n° d\'attestation de capacité')>=0?' (Paramètres de l\'entreprise)':''):'✔ Tout est renseigné pour les fiches Cerfa.')+'</div>'+
      (m.detecteurs.length?'<div class="nxc-hint">Détecteur(s) : '+m.detecteurs.map(function(d){ return esc((d.ref||'Détecteur')+' n° '+(d.id||'?')+' — contrôlé le '+(frDate(d.dateCtrl)||'?')); }).join(' · ')+'</div>':'')+
      (host.dataset.open?(
        '<div id="nxcDets">'+m.detecteurs.map(function(d,i){ return detRow(d,i); }).join('')+'</div>'+
        '<button class="nx-sbtn" onclick="nxcAddDet()">+ Ajouter un détecteur</button>'+
        '<div class="frm" style="margin-top:10px">'+
          '<label>Détecteur par défaut<select id="nxcDefDet">'+m.detecteurs.map(function(d,i){ return '<option value="'+i+'"'+(m.defDet===i?' selected':'')+'>'+esc((d.ref||'Détecteur')+' n° '+(d.id||''))+'</option>'; }).join('')+'</select></label>'+
          '<label>Bouteilles de récupération (n°)<input id="nxcBout" value="'+esc(m.bouteilles||'')+'" placeholder="Ex : BR-001, BR-002"></label>'+
          '<label>Reprise du fluide récupéré — nom<input id="nxcDestNom" value="'+esc(m.destNom||'')+'" placeholder="Distributeur / centre de traitement"></label>'+
          '<label>Reprise — adresse<input id="nxcDestAdr" value="'+esc(m.destAdr||'')+'"></label>'+
        '</div>'+
        '<div class="nxc-hint" style="margin-top:6px">Codes UN retenus par fluide (appris depuis tes fiches) : '+(Object.keys(m.unCodes).length?Object.keys(m.unCodes).map(function(k){ return esc(k+' → '+m.unCodes[k]); }).join(' · '):'aucun pour l\'instant')+'</div>'+
        '<div class="nxa-act" style="margin-top:10px"><button class="btn-pri" onclick="nxcSaveMat()">Enregistrer mon matériel</button></div>'):'')+
      '</div>';
  }
  function detRow(d,i){ return '<div class="frm nxc-det" data-i="'+i+'"><label>Modèle du détecteur<input class="nxc-dref" value="'+esc(d.ref||'')+'"></label><label>N° de série / identification<input class="nxc-did" value="'+esc(d.id||'')+'"></label><label>Date du dernier contrôle<input type="date" class="nxc-ddate" value="'+esc(d.dateCtrl||'')+'"></label><div><button class="iconbtn d" onclick="nxcDelDet('+i+')">🗑</button></div></div>'; }
  function readMat(){ var m=M(); m.detecteurs=[].map.call(document.querySelectorAll('#nxcDets .nxc-det'),function(r){ return {ref:r.querySelector('.nxc-dref').value.trim(),id:r.querySelector('.nxc-did').value.trim(),dateCtrl:r.querySelector('.nxc-ddate').value}; }).filter(function(d){ return d.ref||d.id; });
    var dd=document.getElementById('nxcDefDet'); m.defDet=dd&&dd.value!==''?Math.min(+dd.value,m.detecteurs.length-1):0;
    m.bouteilles=g('nxcBout').trim(); m.destNom=g('nxcDestNom').trim(); m.destAdr=g('nxcDestAdr').trim(); return m; }
  window.nxcToggleMat=function(){ var h=document.getElementById('nxcMat'); if(!h) return; if(h.dataset.open) delete h.dataset.open; else h.dataset.open='1'; renderMat(); };
  window.nxcAddDet=function(){ var m=readMat(); m.detecteurs.push({ref:'',id:'',dateCtrl:''}); saveM(m); renderMat(); };
  window.nxcDelDet=function(i){ var m=readMat(); m.detecteurs.splice(i,1); saveM(m); renderMat(); };
  window.nxcSaveMat=function(){ var m=readMat(); saveM(m); var h=document.getElementById('nxcMat'); if(h) delete h.dataset.open; renderMat(); toastX('🧰 Matériel enregistré — repris automatiquement sur les fiches','ok'); };
  window.nxcRenderMat=renderMat;

  /* ---------- 5. lecture de plaque par photo (IA puis OCR local) ---------- */
  function resize(file, max){
    return new Promise(function(res,rej){
      var img=new Image(), url=URL.createObjectURL(file);
      img.onload=function(){ var k=Math.min(1,max/Math.max(img.width,img.height)); var c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.85).split(',')[1]); };
      img.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('image illisible')); };
      img.src=url;
    });
  }
  window.nxcScanPlate=function(){ if(typeof window.nxOpenScanner==='function') window.nxOpenScanner('fluide'); else toastX('Scanner indisponible','warn'); };
  var PL_FIELDS=[['marque','Marque'],['modele','Modèle / référence'],['serie','N° de série'],['fluide','Fluide'],['charge','Charge (kg)'],['prg','PRP'],['teq','t éq. CO₂'],['annee','Année'],['puissance','Puissance']];
  function wrapScanner(){
    if(typeof window.nxRunContextOCR!=='function' || window.nxRunContextOCR._nxc) return;
    var oRun=window.nxRunContextOCR, oApply=window.nxApplyContextOCR;
    window.nxRunContextOCR=async function(){
      var input=document.getElementById('nxCtxOcrFile'), file=input&&input.files&&input.files[0], progress=document.getElementById('nxCtxOcrProgress');
      var cloud=false; try{ cloud=!!(sb&&SESS&&SESS.user); }catch(e){}
      if(!file || !cloud) return oRun.apply(this,arguments);
      try{
        if(progress) progress.textContent='🤖 Lecture de la plaque par l\'IA…';
        var data=await resize(file,1600);
        var r=await sb.functions.invoke('assistant',{body:{mode:'plaque',image:{media_type:'image/jpeg',data:data}}});
        var res=r&&r.data;
        if(r&&r.error){ try{ res=await r.error.context.json(); }catch(e){ res=null; } }
        if(!res || res.type!=='plaque'){ if(progress) progress.textContent=(res&&res.erreur==='cle_absente')?'IA non activée — lecture locale…':'IA indisponible — lecture locale…'; return oRun.apply(this,arguments); }
        var c=res.champs||{};
        var found=document.getElementById('nxCtxOcrFound');
        if(found) found.innerHTML='<div class="nx-ocr-review">'+PL_FIELDS.map(function(p){ var v=c[p[0]]; return '<label>'+p[1]+'<input data-nx-ocr-field="'+p[0]+'" value="'+esc(v==null?'':v)+'"></label>'; }).join('')+'</div>'+
          (c.illisible&&c.illisible.length?'<div class="warnbox" style="margin:10px 0 0">Illisible / incertain : '+esc(c.illisible.join(', '))+'</div>':'')+
          '<div class="warnbox" style="margin:12px 0 0">⚠️ Compare chaque valeur avec la plaque. L\'IA propose, elle ne certifie pas.</div><button class="btn-next-accent" style="width:100%;margin-top:12px" type="button" onclick="nxApplyContextOCR()">Utiliser ces informations</button>';
        if(progress) progress.textContent='Lecture terminée — vérification obligatoire.'+(res.budget?' (IA ce mois : '+String(res.budget.depense_eur).replace('.',',')+' €)':'');
      }catch(e){ if(progress) progress.textContent='IA indisponible — lecture locale…'; return oRun.apply(this,arguments); }
    };
    window.nxRunContextOCR._nxc=true;
    if(typeof oApply==='function'){
      window.nxApplyContextOCR=function(){
        var v={}; document.querySelectorAll('#nxCtxOcrFound [data-nx-ocr-field]').forEach(function(e){ v[e.dataset.nxOcrField]=e.value.trim(); });
        var r=oApply.apply(this,arguments);
        try{
          if(document.getElementById('fl_prg')){
            if(v.prg) s('fl_prg', num(v.prg)); if(v.teq) s('fl_teq', num(v.teq));
            if(v.serie && !g('fl_ident')) s('fl_ident','SN '+v.serie);
            var sel=document.getElementById('fl_fluide');
            if(sel && v.fluide){ var fl=v.fluide.toUpperCase().replace(/\s/g,''); var opt=[].find.call(sel.options,function(o){ return o.value.toUpperCase()===fl; }); sel.value=opt?opt.value:'Autre'; }
            if(v.charge) s('fl_charge', num(v.charge));
            window.nxcCalc(); fillUN();
          }
          var em=document.getElementById('eq_marque');
          if(em && document.getElementById('mEquip') && document.getElementById('mEquip').classList.contains('on')){
            if(v.fluide){ var ef=document.getElementById('eq_fluide'); if(ef){ var fo=[].find.call(ef.options||[],function(o){ return o.value.toUpperCase()===v.fluide.toUpperCase().replace(/\s/g,''); }); if(fo) ef.value=fo.value; } }
          }
        }catch(e){}
        return r;
      };
    }
  }

  var CSS='.nxc-h{font-size:13px;color:var(--blue,#121417);margin:14px 0 6px}.nxc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}'+
    '.nxc-hint{font-size:12px;color:var(--muted,#6b7a90)}.nxc-ok{font-size:12.5px;color:#1e7a4c;font-weight:700}'+
    '.nxc-warn{background:#fff6e5;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#7a4b00;margin:8px 0}.nxc-warn ul{margin:4px 0 0;padding-left:18px}'+
    '.nxc-det{align-items:end;margin-bottom:6px;grid-template-columns:1.3fr 1.3fr 1fr auto}';

  function boot(tries){
    tries=tries||0;
    if(typeof window.openFlu!=='function' || !document.getElementById('mFlu')){ if(tries<40) setTimeout(function(){ boot(tries+1); },150); return; }
    try{
      if(!document.getElementById('nxcStyle')){ var st=document.createElement('style'); st.id='nxcStyle'; st.textContent=CSS; document.head.appendChild(st); }
      inject(); wrap(); wrapScanner();
      var vf=document.getElementById('v-fluides');
      if(vf && !document.getElementById('nxcMat')){ var d=document.createElement('div'); d.id='nxcMat'; var kp=document.getElementById('fluKpis'); if(kp) kp.parentNode.insertBefore(d,kp.nextSibling); else vf.appendChild(d); }
      var _go=window.go; window.go=function(v){ var r=_go.apply(this,arguments); try{ if(v==='fluides') renderMat(); }catch(e){} return r; };
      setTimeout(wrapScanner,1500);
    }catch(e){ try{ console.error('ClimPilot next-cerfa',e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);
})();
