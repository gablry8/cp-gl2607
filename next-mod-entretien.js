/* ============================================================
   ClimPilot Next — next-mod-entretien.js  (phase 4)
   Entretien : visite ponctuelle ou contrat annuel.
   - parc d'équipements (repris de la fiche client ou saisi) ;
   - temps par équipement × visites, consommables par visite,
     pièces d'usure incluses ou non, dégressivité réglable ;
   - contrôle d'étanchéité : obligatoire ou non et fréquence minimale,
     d'après le règlement (UE) 2024/573 (seuils vérifiés le 29/09/2026 :
     HFC 5 / 50 / 500 t éq. CO₂ → 12 / 6 mois, doublés avec détection
     des fuites, 10 t si hermétique ; HFO 1 / 10 / 100 kg) ;
   - contrat signé → créé tout seul dans l'onglet Contrats avec sa
     prochaine visite ; particulier + reconduction tacite → clause et
     rappel L215-1 du Code de la consommation (information 3 à 1 mois
     avant l'échéance).
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2||!window.NXK) return;
  var K=NXK, A=K.A, esc=K.esc, num=K.num, MOD='entretien';
  var TYPES=[['clim','Climatisation / PAC air-air'],['pac','PAC air-eau'],['frc','Froid commercial (vitrine, meuble, groupe)'],['chf','Chambre froide'],['adia','Rafraîchisseur adiabatique'],['autre','Autre équipement']];
  var TLAB={}; TYPES.forEach(function(t){ TLAB[t[0]]=t[1]; });
  var UNITS_DEF={clim:1,pac:1.5,frc:1.5,chf:1.5,adia:1.5,autre:1};
  var CHECK={
    clim:['Nettoyage ou remplacement des filtres','Nettoyage de l\'échangeur intérieur et de la turbine','Désinfection de l\'unité intérieure','Contrôle de l\'évacuation des condensats (et de la pompe de relevage)','Nettoyage de l\'échangeur extérieur','Contrôle des connexions électriques et des serrages','Relevé des pressions et températures de fonctionnement','Contrôle d\'étanchéité si l\'équipement y est soumis (fiche d\'intervention)','Essais en chaud et en froid, télécommande'],
    pac:['Nettoyage de l\'évaporateur extérieur','Contrôle de la pression du circuit d\'eau et du vase d\'expansion','Nettoyage du filtre / pot à boue','Contrôle des sondes et de la régulation','Contrôle des connexions électriques','Relevé des températures départ / retour','Contrôle d\'étanchéité si l\'équipement y est soumis (fiche d\'intervention)','Essais de fonctionnement (chauffage, eau chaude)'],
    frc:['Nettoyage du condenseur','Contrôle des ventilateurs','Contrôle du dégivrage et de l\'évacuation des condensats','Contrôle des températures et des sondes','Contrôle des joints de porte','Relevé des pressions de fonctionnement','Contrôle d\'étanchéité si l\'équipement y est soumis (fiche d\'intervention)','Contrôle des alarmes'],
    chf:['Nettoyage du condenseur et de l\'évaporateur','Contrôle du dégivrage et de l\'évacuation des condensats','Contrôle des températures, sondes et régulation','Contrôle des joints de porte et du cordon chauffant','Contrôle de l\'ouverture de la porte depuis l\'intérieur et de l\'alarme personne enfermée','Relevé des pressions de fonctionnement','Contrôle d\'étanchéité si l\'équipement y est soumis (fiche d\'intervention)','Contrôle des connexions électriques'],
    adia:['Remise en route au printemps / hivernage et vidange à l\'automne','Nettoyage du bac et contrôle des médias','Contrôle de la pompe et du niveau d\'eau (flotteur)','Contrôle du traitement d\'eau','Contrôle du clapet anti-retour (EA)','Contrôle des connexions électriques','Essais de fonctionnement'],
    autre:['Contrôle général de fonctionnement','Nettoyage','Relevés et réglages','Compte rendu d\'intervention']
  };
  function typeOf(t){ t=String(t||''); if(/air[- ]?eau/i.test(t)) return 'pac'; if(/adiab/i.test(t)) return 'adia'; if(/chambre/i.test(t)) return 'chf'; if(/vitrine|meuble|armoire|tour|glaçon|froid commercial|groupe/i.test(t)) return 'frc';
    if(/split|gainable|air[- ]?air|clim|cassette|console/i.test(t)) return 'clim'; return 'autre'; }
  function mkEq(o){ return Object.assign({eqId:'',type:'clim',marque:'',modele:'',fluide:'',charge:0,prp:'',lds:false,herm:false,temps:''},o||{}); }
  function isoPlus(days){ var d=new Date(Date.now()+days*864e5); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function defaults(){
    return {format:'contrat',equips:[mkEq()],visites:1,degr:0,consoVisite:num((P.mesOpt||{}).conso)||num((P.conso||{}).petit),usure:{incluses:false,budget:0},delai:'',duree:12,reconduction:true,
      revision:'Prix révisable à chaque date anniversaire, avec information préalable.',resiliation:'Par lettre recommandée ou courriel, au plus tard un mois avant l\'échéance.',premiere:'',
      units:K.initUnits(MOD,UNITS_DEF),custom:[]};
  }
  function fromLegacy(s){ var d=defaults(); d.legacyCopy=true; Object.assign(d,K.baseFromLegacy(s)); d.equips=[]; return d; }

  /* ---------- contrôle d'étanchéité (règlement UE 2024/573) ---------- */
  var NAT=/^(R290|R600A?|R744|R717|R1270|CO2|NH3|SANS|AUCUN|EAU|-)$/, HFO=/^(R1234YF|R1234ZE(\(E\))?|R1233ZD(\(E\))?|R1336MZZ(\(Z\)|\(E\))?)$/;
  function leak(e){
    var f=String(e.fluide||'').toUpperCase().replace(/\s|-(?=\d)/g,'').replace(/^R-/,'R'), ch=num(e.charge);
    if(!f) return {txt:'fluide à renseigner',m:null};
    if(NAT.test(f)) return {txt:'non concerné (fluide non fluoré)',m:0};
    if(!(ch>0)) return {txt:'charge à renseigner',m:null};
    if(HFO.test(f)){ if(ch<1) return {txt:'pas de contrôle périodique (moins de 1 kg de HFO)',m:0}; var mh=ch<10?12:ch<100?6:3; if(e.lds) mh*=2; return {txt:'tous les '+mh+' mois ('+A.fq(ch)+' kg de HFO'+(e.lds?', avec détection des fuites':'')+')',m:mh}; }
    var prp=num(e.prp); if(!(prp>0)) return {txt:'PRP à relever sur la plaque (calcul en t éq. CO₂)',m:null};
    var t=prp*ch/1000, seuil=e.herm?10:5, ts=A.fq(Math.round(t*100)/100);
    if(t<seuil) return {txt:'non obligatoire ('+ts+' t éq. CO₂ < '+seuil+' t'+(e.herm?', hermétique':'')+')',m:0,t:t};
    if(t>=500) return {txt:'tous les 6 mois, détection des fuites obligatoire ('+ts+' t éq. CO₂)',m:6,t:t};
    var m=t<50?12:6; if(e.lds) m*=2;
    return {txt:'tous les '+m+' mois ('+ts+' t éq. CO₂'+(e.lds?', avec détection des fuites':'')+')',m:m,t:t};
  }

  /* ---------- calcul ---------- */
  function hoursOf(d){
    var u=K.units(d,UNITS_DEF), v=d.format==='visite'?1:Math.max(1,Math.round(num(d.visites))||1), dg=Math.max(0,Math.min(90,num(d.degr)));
    return (d.equips||[]).map(function(e,j){ var h=num(e.temps)>0?num(e.temps):u[e.type]||u.autre; var f=j>0?(1-dg/100):1; return {e:e,h1:h*f,v:v,h:h*f*v}; });
  }
  function compute(lot,ctx){
    var d=lot.data||{}, warn=[], rate=ctx.rate;
    if(d.legacyCopy){ var b=K.base(d,ctx,{type:'Maintenance',mode:d.moMode==='heures'?'heures':'forfait',heures:d.heures,catLabel:'Main-d’œuvre — entretien'}); K.legacyWarn(b.lines,warn); return {lines:b.lines,mat:b.mat,heures:b.heures,detailH:0,warnings:warn}; }
    var B=K.builder(warn), rows=hoursOf(d), v=d.format==='visite'?1:Math.max(1,Math.round(num(d.visites))||1), heures=0;
    if(d.format==='contrat'&&!lot.option&&((ctx.d&&ctx.d.lots)||[]).some(function(q){ return q!==lot&&q&&!q.option&&q.module!==MOD; }))
      warn.push('Contrat d\'entretien dans un devis avec d\'autres travaux : son prix annuel reprend le taux horaire de ce devis et seulement une part du déplacement et des frais. Pour un prix de contrat juste chaque année, fais-en un devis séparé.');
    rows.forEach(function(r,j){
      var e=r.e, lab='Entretien — '+(TLAB[e.type]||'équipement')+([e.marque,e.modele].filter(Boolean).length?' '+[e.marque,e.modele].filter(Boolean).join(' '):'');
      var l=B.raw('Pose & main-d’œuvre',lab,A.fq(A.r2(r.h1))+' h × '+v+' visite'+(v>1?'s':'')+' × '+A.money(rate)+'/h',r.h*rate,0,{qte:r.h,unite:'h',pu:rate,mo:true},'entr'); heures+=r.h;
    });
    (d.custom||[]).forEach(function(c){ var h=Math.max(0,num(c.h)); if(h>0){ B.raw('Pose & main-d’œuvre',c.l||'Autre tâche',A.fq(h)+' h × '+A.money(rate)+'/h',h*rate,0,{qte:h,unite:'h',pu:rate,mo:true},'entr'); heures+=h; } });
    var cv=Math.max(0,num(d.consoVisite)); if(cv>0) B.raw('Frais & divers','Produits et consommables d\'entretien',A.fq(v)+' visite'+(v>1?'s':'')+' × '+A.money(cv),cv*v,cv*v*0.6,{qte:v,unite:'u',pu:cv},'divers');
    var us=d.usure||{}; if(us.incluses&&num(us.budget)>0){ var pv=0; try{ pv=priceVente(num(us.budget),35); }catch(e){ pv=num(us.budget); } B.raw('Matériel','Pièces d\'usure incluses (filtres, courroies…)','budget annuel',pv,num(us.budget),{},'pieces'); }
    /* contrôles */
    if(!(d.equips||[]).length) warn.push('Aucun équipement : ajoute le parc à entretenir');
    (d.equips||[]).forEach(function(e,j){ var lk=leak(e); if(lk.m==null) warn.push('Équipement '+(j+1)+' : '+lk.txt); else if(lk.m>0&&d.format==='contrat'&&12/lk.m>v) warn.push('Équipement '+(j+1)+' : contrôle d\'étanchéité '+lk.txt.replace(/ \(.*$/,'')+' — prévois '+(12/lk.m)+' visites par an (ou des passages dédiés)'); });
    try{ var cur=A.cur(); if(d.format==='contrat'&&cur&&cur.lots&&cur.lots.indexOf(lot)>=0&&(Math.round(num(cur.nbDepl))||1)<v&&cur.zone!=='Aucun') warn.push('Déplacements : '+(Math.round(num(cur.nbDepl))||1)+' compté(s) pour '+v+' visites par an (onglet Client & chantier)'); }catch(e){}
    return {lines:B.lines,mat:B.mat,heures:heures,detailH:heures,warnings:warn};
  }

  /* ---------- formulaire ---------- */
  function render(lot,i){
    var d=lot.data, h='';
    if(d.legacyCopy) return '<div class="nxd2-banner">Copie d\'un ancien devis de maintenance : montants repris tels quels.<br>'+K.btn('Passer au format entretien détaillé','convert',i,null,'btn-pri btn-sm')+'</div>'+K.secMachines(d,i,{title:'Machines (ancien devis)',add:true})+K.secExtras(d,i)+
      K.sec('Main-d\'œuvre','<div class="frm">'+A.fSel('Mode','data.moMode',d.moMode,[['forfait','Forfait'],['heures','Heures × taux']],{re:'lot'})+A.fIn('Heures','data.heures',d.heures,{t:'n',step:0.5})+'</div>');
    var u=K.units(d,UNITS_DEF), cur=A.cur()||{};
    h+=K.sec('Formule','<div class="frm nxk2">'+A.fSel('Formule','data.format',d.format,[['contrat','Contrat annuel'],['visite','Visite ponctuelle']],{re:'lot'})+
      (d.format==='contrat'?A.fIn('Visites par an','data.visites',d.visites,{t:'n',step:1,min:1,re:'lot'})+A.fIn('Première visite prévue','data.premiere',d.premiere,{ph:'AAAA-MM-JJ'}):'')+
      A.fIn('Dégressivité équipements suivants (%)','data.degr',d.degr,{t:'n',step:5,note:'0 = même temps pour chacun'})+'</div>'+
      (d.format==='contrat'&&(Math.round(num(cur.nbDepl))||1)!==Math.max(1,Math.round(num(d.visites))||1)?'<div class="nxd2-hint">Chaque visite est un déplacement : '+K.btn('Compter '+Math.max(1,Math.round(num(d.visites))||1)+' déplacement(s)','alignDepl',i)+'</div>':''));
    /* parc */
    var eqs=[]; try{ var cn=String(cur.cNom||'').toLowerCase(); eqs=(EQUIP||[]).filter(function(x){ return cn&&String(x.client||'').toLowerCase()===cn; }); }catch(e){}
    var eh=(d.equips||[]).map(function(e,j){
      var q='data.equips.'+j+'.', lk=leak(e);
      return '<div class="nxd2-row"><span class="del">'+K.btn('🗑','delEq',i,j,'iconbtn d')+'</span><b style="font-size:13px">Équipement '+(j+1)+'</b><div class="frm nxk2">'+
        A.fSel('Type',q+'type',e.type,TYPES,{re:'lot',full:true})+A.fIn('Marque',q+'marque',e.marque)+A.fIn('Modèle',q+'modele',e.modele)+
        A.fIn('Fluide',q+'fluide',e.fluide,{ph:'R32, R410A…',re:'lot'})+A.fIn('Charge (kg)',q+'charge',e.charge||'',{t:'n',step:0.01,re:'lot'})+
        A.fIn('PRP du fluide',q+'prp',e.prp,{t:'n',step:1,note:'plaque',re:'lot'})+A.fIn('Temps par visite (h)',q+'temps',e.temps,{t:'n',step:0.25,ph:A.fq(u[e.type]||u.autre)+' par défaut'})+'</div>'+
        A.fChk('Système de détection des fuites',q+'lds',e.lds,{re:'lot'})+A.fChk('Hermétiquement scellé et étiqueté',q+'herm',e.herm,{re:'lot'})+
        '<div class="'+(lk.m==null?'nxd2-warn':'nxd2-hint')+'">Contrôle d\'étanchéité : <b>'+esc(lk.txt)+'</b></div></div>';
    }).join('');
    h+=K.sec('Parc à entretenir',(eqs.length?'<div class="frm"><label class="full">Parc enregistré du client<select onchange="nxd2.act(\'pickEq\','+i+',null,this.value)"><option value="">— ajouter un équipement enregistré —</option><option value="*">Tous ('+eqs.length+')</option>'+eqs.map(function(x){ return '<option value="'+esc(x.id)+'">'+esc([x.type,x.marque,x.modele].filter(Boolean).join(' '))+(x.fluide?' — '+esc(x.fluide):'')+'</option>'; }).join('')+'</select></label></div>':'')+
      (eh||'<div class="nxd2-hint">Aucun équipement.</div>')+K.btn('+ Ajouter un équipement','addEq',i)+
      '<div class="nxd2-hint">Fréquence du contrôle d\'étanchéité d\'après le règlement (UE) 2024/573 : HFC en t éq. CO₂ (PRP × charge), HFO en kg. Le PRP se lit sur la plaque ; ClimPilot ne l\'invente pas.</div>');
    h+=K.sec('Temps par type (valeurs de départ, retenues à l\'enregistrement)','<div class="frm nxk2">'+TYPES.map(function(t){ return A.fIn(t[1],'data.units.'+t[0],u[t[0]],{t:'n',step:0.25}); }).join('')+'</div>'+
      ((d.custom||[]).map(function(c,j){ return '<div class="nxd2-task"><div class="l"><input type="text" placeholder="Autre tâche" data-k="data.custom.'+j+'.l" data-t="s" value="'+esc(c.l||'')+'"></div><div class="v"><input type="number" step="0.25" min="0" data-k="data.custom.'+j+'.h" data-t="n" value="'+(c.h==null?'':c.h)+'"> h '+K.btn('🗑','delTask',i,j,'iconbtn d')+'</div></div>'; }).join(''))+K.btn('+ Ajouter une tâche','addTask',i));
    var us=d.usure||{};
    h+=K.sec('Contenu','<div class="frm nxk2">'+A.fIn('Consommables par visite (€ HT)','data.consoVisite',d.consoVisite,{t:'n',step:1})+A.fIn('Délai d\'intervention garanti','data.delai',d.delai,{ph:'imprimé seulement si rempli'})+'</div>'+
      A.fChk('Pièces d\'usure incluses','data.usure.incluses',us.incluses,{re:'lot'})+(us.incluses?'<div class="frm">'+A.fIn('Budget annuel pièces d\'usure (€ HT d\'achat)','data.usure.budget',us.budget,{t:'n',step:5})+'</div>':''));
    if(d.format==='contrat') h+=K.sec('Durée et conditions','<div class="frm">'+A.fIn('Durée (mois)','data.duree',d.duree,{t:'n',step:1,min:1})+'</div>'+A.fChk('Reconduction tacite','data.reconduction',d.reconduction)+
      '<div class="frm">'+A.fIn('Révision du prix','data.revision',d.revision,{full:true})+A.fIn('Résiliation','data.resiliation',d.resiliation,{full:true})+'</div>'+
      '<div class="nxd2-hint">Client particulier + reconduction tacite : la clause de l\'article L215-1 du Code de la consommation est imprimée, et une tâche te rappellera de l\'informer par écrit entre 3 mois et 1 mois avant l\'échéance.</div>');
    return h;
  }
  var actions=K.actions({
    addEq:function(l){ (l.data.equips||(l.data.equips=[])).push(mkEq()); },
    delEq:function(l,i,api,j){ l.data.equips.splice(j,1); },
    pickEq:function(l,i,api,j,id){
      var cn=String((A.cur()||{}).cNom||'').toLowerCase(), all=(EQUIP||[]).filter(function(x){ return String(x.client||'').toLowerCase()===cn; });
      var pick=id==='*'?all:all.filter(function(x){ return x.id===id; }); if(!pick.length) return false;
      l.data.equips=(l.data.equips||[]).filter(function(e){ return e.marque||e.modele||e.fluide||e.eqId; });
      pick.forEach(function(x){ if(l.data.equips.some(function(e){ return e.eqId===x.id; })) return; l.data.equips.push(mkEq({eqId:x.id,type:typeOf(x.type),marque:x.marque||'',modele:x.modele||'',fluide:x.fluide||'',charge:num(x.charge)})); }); },
    alignDepl:function(l){ var c=A.cur(); if(c) c.nbDepl=Math.max(1,Math.round(num(l.data.visites))||1); },
    convert:function(l){ var d=l.data, nd=defaults(); nd.equips=(d.machines||[]).filter(function(m){ return m.marque||m.ref; }).map(function(m){ return mkEq({marque:m.marque||'',modele:m.ref||''}); }); if(!nd.equips.length) nd.equips=[mkEq()]; l.data=nd; }
  });
  var VISITE=[{k:'parc',l:'Parc constaté (type, marque, modèle, fluide, charge, année)',t:'area'},K.VIS.acces,K.VIS.horaires,{k:'histo',l:'Historique des interventions / pannes connues',t:'area'},K.VIS.notes];
  function applyVisite(lot){ var v=lot.visite||{}, d=lot.data, msg=[]; if(/Nacelle|Toiture/.test(v.acces||'')) msg.push('pense au temps d\'accès dans le temps par visite'); return msg; }

  /* ---------- PDF ---------- */
  function pdf(lot,x){
    var d=lot.data; if(d.legacyCopy) return '';
    var v=d.format==='visite'?1:Math.max(1,Math.round(num(d.visites))||1), cur=A.cur()||{}, part=cur.cType!=='Professionnel';
    var td='text-align:left;padding:3px 6px;border-top:1px solid #eef1f5;vertical-align:top';
    var h='<div style="font-size:11.5px;font-weight:700;color:#121417;margin-bottom:4px">'+(d.format==='visite'?'Visite d\'entretien':'Contrat d\'entretien — '+v+' visite'+(v>1?'s':'')+' par an')+'</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:10.5px"><tr><th style="text-align:left;padding:3px 6px">Équipement</th><th style="text-align:left;padding:3px 6px">Fluide / charge</th><th style="text-align:left;padding:3px 6px">Contrôle d\'étanchéité</th></tr>'+
      (d.equips||[]).map(function(e){ var lk=leak(e); return '<tr><td style="'+td+'">'+esc(TLAB[e.type]||'Équipement')+([e.marque,e.modele].filter(Boolean).length?' — '+esc([e.marque,e.modele].filter(Boolean).join(' ')):'')+'</td><td style="'+td+'">'+esc(e.fluide||'—')+(num(e.charge)?' · '+A.fq(num(e.charge))+' kg':'')+'</td><td style="'+td+'">'+esc(lk.txt)+'</td></tr>'; }).join('')+'</table>';
    var info=[];
    if(x&&d.format==='contrat'){ var an=(x.ht||0)+(x.commonShare||0); info.push('<b>Prix</b> : '+A.money(an)+' HT par an, soit '+A.money(an/v)+' HT par visite, déplacement compris.'); }
    info.push('<b>Compris</b> : main-d\'œuvre des visites, déplacements, produits d\'entretien'+((d.usure||{}).incluses?', pièces d\'usure':'')+'.');
    info.push('<b>Non compris</b> : '+((d.usure||{}).incluses?'':'pièces d\'usure et ')+'pièces de rechange, fluide frigorigène, travaux de mise en conformité ; dépannages hors visites au tarif dépannage en vigueur.');
    if(d.delai) info.push('<b>Délai d\'intervention</b> : '+esc(d.delai)+'.');
    if(d.format==='contrat'){
      info.push('<b>Durée</b> : '+A.fq(Math.max(1,num(d.duree)||12))+' mois à compter de la signature'+(d.reconduction?', reconduit tacitement par périodes identiques':'')+'.');
      if(d.revision) info.push('<b>Révision du prix</b> : '+esc(d.revision));
      if(d.resiliation) info.push('<b>Résiliation</b> : '+esc(d.resiliation));
      if(part&&d.reconduction) info.push('Conformément à l\'article L215-1 du Code de la consommation, nous vous informerons par écrit, au plus tôt trois mois et au plus tard un mois avant la fin de chaque période, de la possibilité de ne pas reconduire le contrat.');
    }
    h+='<div style="font-size:10.5px;color:#333;line-height:1.55;margin-top:6px">'+info.join('<br>')+'</div>';
    var types=(d.equips||[]).map(function(e){ return e.type; }).filter(function(t,k,a){ return a.indexOf(t)===k; });
    if(types.length) h+='<div style="font-size:10px;color:#444;margin-top:8px;border-top:1px dashed #cfd6e0;padding-top:6px"><b>Contenu de chaque visite</b>'+types.map(function(t){ return '<div style="margin-top:4px"><i>'+esc(TLAB[t]||t)+'</i> : '+CHECK[t].map(esc).join(' ; ')+'.</div>'; }).join('')+'</div>';
    return h;
  }
  function summary(lot){ var d=lot.data; if(d.legacyCopy) return 'Maintenance'; var n=(d.equips||[]).length, v=Math.max(1,Math.round(num(d.visites))||1);
    return (d.format==='visite'?'Visite d\'entretien':'Contrat d\'entretien '+v+' visite'+(v>1?'s':'')+'/an')+' — '+n+' équipement'+(n>1?'s':''); }
  function exclusions(){ return ''; }

  /* ---------- dictée ---------- */
  function fromAssistant(g,lot){
    var d=defaults(), msg=[]; lot.data=d; lot.exclusions='';
    if(!g||typeof g!=='object'){ msg.push('équipements à renseigner'); return msg; }
    if(g.format==='visite') d.format='visite';
    if(num(g.visites)>0) d.visites=Math.round(num(g.visites));
    if(Array.isArray(g.equipements)&&g.equipements.length) d.equips=g.equipements.slice(0,30).map(function(e){ return mkEq({type:TLAB[e.type]?e.type:typeOf(e.type),marque:String(e.marque||''),modele:String(e.modele||''),fluide:String(e.fluide||''),charge:num(e.charge),prp:num(e.prp)||''}); });
    if(g.piecesUsureIncluses) d.usure.incluses=true;
    if(d.equips.some(function(e){ return leak(e).m==null; })) msg.push('fluide, charge ou PRP à compléter pour le contrôle d\'étanchéité');
    return msg;
  }
  var ASSIST={type:'Maintenance',consigne:'Devis de type "Maintenance" (entretien) : ajoute payload.entretien = {format: "contrat"|"visite", visites (par an), equipements:[{type: "clim"|"pac"|"frc"|"chf"|"adia"|"autre", marque, modele, fluide, charge (kg), prp (si lu sur la plaque)}], piecesUsureIncluses: bool}. N\'invente ni PRP ni charge.'};

  /* ---------- contrat signé → onglet Contrats ---------- */
  var CTYPE={clim:'Climatisation',pac:'PAC',adia:'Adiabatique',frc:'Froid commercial',chf:'Froid commercial',autre:'Climatisation'};
  function addMonths(iso,m){ var d=new Date(iso+'T00:00:00'); d.setMonth(d.getMonth()+m); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  /* Fiabilité (2 appareils + contrat supprimé) :
     - l'identifiant du contrat se déduit du devis et du lot : si le téléphone et le PC relèvent la même signature
       en même temps, ils créent LE MÊME contrat et la synchro n'en garde qu'un ;
     - le devis retient les contrats déjà créés (ctrFaits) : un contrat que Gabriel supprime ne revient pas tout seul. */
  function ctrKey(dv,l){ return String(dv.id)+':'+String(l.id); }
  function ctrIdOf(dv,l){ return 'CTR-'+String(dv.id).replace(/[^\w-]/g,'')+'-'+String(l.id).replace(/[^\w-]/g,''); }
  function markDone(dv,k){
    if(!Array.isArray(dv.ctrFaits)) dv.ctrFaits=[];
    if(dv.ctrFaits.indexOf(k)<0) dv.ctrFaits.push(k);
    try{ if(typeof cur!=='undefined'&&cur&&cur.id===dv.id){ if(!Array.isArray(cur.ctrFaits)) cur.ctrFaits=[]; if(cur.ctrFaits.indexOf(k)<0) cur.ctrFaits.push(k); } }catch(e){}
  }
  function syncContracts(){
    var made=0, flagged=0, news=[];
    try{
      (DEVIS||[]).forEach(function(dv){
        if(!dv||dv.v!==2||dv.statut!=='accepte') return;
        var c=null;
        (dv.lots||[]).forEach(function(l){
          if(l.module!==MOD||l.option||!l.data||l.data.legacyCopy||l.data.format!=='contrat') return;
          var k=ctrKey(dv,l), cid=ctrIdOf(dv,l);
          if(Array.isArray(dv.ctrFaits)&&dv.ctrFaits.indexOf(k)>=0) return;
          if((CTR||[]).some(function(x){ return x.id===cid||(x.devisId===dv.id&&x.lotId===l.id); })){ markDone(dv,k); flagged++; return; }
          if(!c) c=NXD2.compute(JSON.parse(JSON.stringify(dv)));
          var e=(c.lots||[]).find(function(x){ return x.id===l.id; }); if(!e) return;
          var d=l.data, today=(typeof todayISO==='function'?todayISO():isoPlus(0)), debut=dv.acceptedAt?(function(t){ var q=new Date(t); return q.getFullYear()+'-'+String(q.getMonth()+1).padStart(2,'0')+'-'+String(q.getDate()).padStart(2,'0'); })(dv.acceptedAt):today;
          var fin=addMonths(debut,Math.max(1,num(d.duree)||12)), first=/^\d{4}-\d{2}-\d{2}$/.test(d.premiere||'')?d.premiere:isoPlus(30);
          var t0=(d.equips||[])[0]?d.equips[0].type:'clim', part=dv.cType!=='Professionnel';
          var o={id:cid,clientNom:dv.cNom||'',type:CTYPE[t0]||'Climatisation',prix:Math.round(((e.ht||0)+(e.commonShare||0))*100)/100,
            visites:Math.max(1,Math.round(num(d.visites))||1),prochaineVisite:first,actif:true,facs:[],devisId:dv.id,lotId:l.id,debut:debut,fin:fin,reconduction:!!d.reconduction,particulier:part,
            notes:'Contrat issu du devis n° '+(dv.num||'')+' — '+(d.equips||[]).map(function(q){ return [TLAB[q.type],q.marque,q.modele].filter(Boolean).join(' '); }).join(' ; ')};
          CTR.push(o); made++;
          news.push({dv:dv,k:k,o:o,task:(part&&d.reconduction)?{title:'Contrat d\'entretien '+(dv.cNom||'')+' : informer par écrit de la possibilité de ne pas reconduire (échéance '+new Date(fin+'T00:00:00').toLocaleDateString('fr-FR')+', art. L215-1)',
              due:addMonths(fin,-2),priority:'high',cat:'Client',ref:'L2151-'+o.id}:null});
        });
      });
      if(made){
        /* le contrat d'abord : si l'enregistrement échoue (stockage plein), rien n'est marqué « fait » et on réessaiera */
        try{ save('cp2_contrats',CTR); }
        catch(err){ news.forEach(function(n){ var i=CTR.indexOf(n.o); if(i>=0) CTR.splice(i,1); }); made=0; news=[]; }
        news.forEach(function(n){ markDone(n.dv,n.k); flagged++;
          if(n.task&&typeof window.nxAddTask==='function'){ try{ window.nxAddTask(n.task); }catch(e){} } });
      }
      if(flagged){ try{ save((typeof LS!=='undefined'&&LS&&LS.devis)||'cp2_devis',DEVIS); }catch(e){} }
      if(made){ try{ if(window._curView==='contrats') renderContrats(); updateBadges(); }catch(e){} try{ toast('🤝 '+made+' contrat(s) d\'entretien signé(s) ajouté(s) à l\'onglet Contrats'); }catch(e){} }
    }catch(e){}
    return made;
  }
  window.nxenSyncContracts=syncContracts;
  function boot(tries){
    tries=tries||0;
    if(!window.nxd2||typeof window.go!=='function'){ if(tries<30) setTimeout(function(){ boot(tries+1); },300); return; }
    ['save','statut','sign'].forEach(function(k){ var o=window.nxd2[k]; if(typeof o!=='function'||o._nxen) return; var w=function(){ var r=o.apply(this,arguments); try{ syncContracts(); }catch(e){} return r; }; w._nxen=true; window.nxd2[k]=w; });
    var g=window.go; if(!g._nxen){ window.go=function(v){ if(v==='contrats'||v==='dash'||v==='nx_journee'){ try{ syncContracts(); }catch(e){} } return g.apply(this,arguments); }; window.go._nxen=true; }
    setTimeout(syncContracts,2500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(function(){ boot(0); },0); }); else setTimeout(function(){ boot(0); },0);

  NXD2.register({
    id:MOD, defaults:defaults, fromLegacy:fromLegacy, compute:compute, render:render, actions:actions,
    visite:VISITE, applyVisite:applyVisite, pdf:pdf, summary:summary, exclusions:exclusions,
    typeLabel:function(lot){ return lot&&lot.data&&lot.data.format==='visite'?'Entretien':'Contrat d\'entretien'; },
    isLegacyType:function(t){ return t==='Maintenance'; },
    remember:K.rememberUnits(UNITS_DEF), fromAssistant:fromAssistant, assistant:ASSIST,
    common:function(){ return {prepH:0,achatH:0,savPct:0}; },
    fees:function(lot){ var d=(lot&&lot.data)||{}; return d.legacyCopy?{}:{commande:!!(d.usure&&d.usure.incluses)}; },
    _leak:leak, UNITS_DEF:UNITS_DEF, sync:syncContracts
  });
})();
