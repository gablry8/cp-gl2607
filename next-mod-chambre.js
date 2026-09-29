/* ============================================================
   ClimPilot Next — next-mod-chambre.js  (phase 5)
   Chambre froide positive ou négative, neuve ou groupe à remplacer.
   - panneaux calculés depuis les dimensions (murs, plafond, sol isolé),
     porte, finitions, rideau, cordon chauffant et soupape (négatif) ;
   - groupe monobloc ou groupe de condensation + évaporateur, organes
     frigorifiques, régulation, liaisons, électricité ;
   - sécurités (INRS) : porte ouvrable de l'intérieur, alarme sonore et
     lumineuse en cas d'enfermement ;
   - contrôle de puissance avec la méthode de ton onglet Dimensionnement
     (repère, la sélection fabricant fait foi) ;
   - sous-traitance (électricien, levage) avec ta marge.
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2||!window.NXK) return;
  var K=NXK, A=K.A, esc=K.esc, num=K.num, MOD='chambre';
  var SEED_VER=1, WEB_DATE='29/09/2026';
  var N={soupape:'Soupape d\'équilibrage de pression',alarme:'Kit alarme personne enfermée',enreg:'Enregistreur de température'};
  var SEED=[[N.soupape,'Chambre froide','unité',107.50,'soluclim.com — Fermod TS2220, 129 € TTC'],
    [N.alarme,'Chambre froide','unité',485.78,'fireless.fr — kit Cordia personne enfermée, 485,78 € HT'],
    [N.enreg,'Chambre froide','unité',524.10,'sanipousse.com — kit enregistreur Mini Therm, 524,10 € HT']];
  var UNITS_DEF={panneaux:0.2,porte:2,groupe:3,evap:2,liaison:2,regul:1.5,elec:2,nett:1};
  function isNeg(d){ return d.temp==='neg'; }
  function isSplit(d){ return d.groupeType==='split'; }
  var PER=[
    {k:'profils',l:'Profils, visserie, silicone alimentaire',nom:'Profils + visserie + mastic alimentaire (forfait)',q:1,u:'forfait',cat:'cf',on:true},
    {k:'rideau',l:'Rideau à lanières',nom:'Rideau à lanières',q:1,cat:'cf',on:false},
    {k:'cordon',l:'Cordon chauffant de porte (négatif)',nom:'Résistance de cordon de porte (négatif)',q:1,cat:'cf',neg:true},
    {k:'soupape',l:'Soupape d\'équilibrage de pression (négatif)',nom:N.soupape,q:1,cat:'cf',neg:true},
    {k:'eclairage',l:'Éclairage étanche',nom:'Éclairage LED étanche chambre froide',q:1,cat:'cf',on:true},
    {k:'alarme',l:'Alarme personne enfermée (bouton intérieur + flash / sirène)',nom:N.alarme,q:1,cat:'cf',on:true},
    {k:'enreg',l:'Enregistreur de température',nom:N.enreg,q:1,cat:'cf',on:false},
    {k:'regul',l:'Coffret de régulation + sondes',nom:'Coffret régulation chambre froide + sondes',q:1,cat:'posemat',split:true},
    {k:'detendeur',l:'Détendeur thermostatique + orifice',nom:'Détendeur thermostatique + orifice',q:1,cat:'posemat',split:true},
    {k:'vanne',l:'Électrovanne + bobine',nom:'Vanne solénoïde + bobine',q:1,cat:'posemat',split:true},
    {k:'deshy',l:'Déshydrateur',nom:'Déshydrateur à souder',q:1,cat:'posemat',split:true},
    {k:'voyant',l:'Voyant liquide',nom:'Voyant liquide',q:1,cat:'posemat',split:true},
    {k:'evac',l:'Évacuation des condensats (m)',nom:'Tuyau condensats',q:3,u:'m',step:0.5,cat:'posemat',on:true,note:'En négatif : évacuation réchauffée à prévoir (cordon chauffant) — ajoute l\'article si besoin.'}
  ];
  function perDefaults(d){ var o={}; PER.forEach(function(x){ var on=x.on!=null?x.on:(x.neg?isNeg(d):(x.split?isSplit(d):false)); o[x.k]={on:on,q:x.q==null?1:x.q}; }); return o; }
  function panels(){ return K.cat('Chambre froide',/^Panneau/); }
  function doors(){ return K.cat('Chambre froide',/^Porte/); }
  function groups(){ return K.cat('Chambre froide',/^Groupe/); }
  function evaps(){ return K.cat('Chambre froide',/^Évaporateur/); }
  function defaults(){
    K.seed(MOD,SEED_VER,SEED,WEB_DATE);
    var d={temp:'pos',consigne:2,usage:'',entrees:'',L:3,l:2,h:2.2,ep:K.first(panels(),['Panneau sandwich 80 mm','Panneau sandwich 60 mm']),sol:'isole',
      porte:K.first(doors(),['Porte pivotante froid positif']),porteDim:'',groupeType:'monobloc',pw:0,fluide:'',use:1,
      machines:[K.mkMachine({pw:0})],evap:K.first(evaps(),['Évaporateur cubique positif']),splits:[{puiss:0,liaison:'',long:0,cableInter:''}],
      groupCable:'Câble 3G2,5',groupLong:0,elecMode:'auto',breakerManual:'Disjoncteur 20A',breakerQte:1,differential:false,diffQte:1,proximity:false,
      mes:(P.mes&&P.mes['Chambre froide']!=null)?'Chambre froide':'Aucune',brasure:'Aucune',tests:'0',acces:'0',supp:0,taille:'moyen',extras:[],
      st:[],moMode:'detail',heures:0,units:K.initUnits(MOD,UNITS_DEF),custom:[]};
    d.per=perDefaults(d);
    return d;
  }
  function fromLegacy(s){ var d=defaults(); d.legacyCopy=true; Object.assign(d,K.baseFromLegacy(s)); return d; }
  function geo(d){ var L=Math.max(0,num(d.L)), l=Math.max(0,num(d.l)), h=Math.max(0,num(d.h)); var murs=2*(L+l)*h, pl=L*l, sol=d.sol==='isole'?L*l:0;
    return {L:L,l:l,h:h,V:L*l*h,murs:murs,plafond:pl,sol:sol,m2:Math.ceil(murs+pl+sol)}; }
  /* repère de l'onglet Dimensionnement (même abaque) */
  function abaque(d){ var V=geo(d).V, neg=isNeg(d); var ratio=neg?(V<=5?180:V<=10?160:V<=20?140:V<=50?120:100):(V<=5?130:V<=10?110:V<=20?95:V<=50?80:65); return {ratio:ratio,W:V*ratio*(num(d.use)||1)}; }
  var TASKS=[
    {k:'panneaux',l:'Montage des panneaux (murs, plafond, sol)',u:'par m²',q:function(d){ return geo(d).m2; }},
    {k:'porte',l:'Pose de la porte',u:'par porte',q:function(d){ return d.porte&&d.porte!=='Aucun'?1:0; }},
    {k:'groupe',l:'Pose du groupe',u:'par groupe',q:function(d){ return (d.machines||[]).length; }},
    {k:'evap',l:'Pose de l\'évaporateur',u:'par évaporateur',q:function(d){ return isSplit(d)&&d.evap&&d.evap!=='Aucun'?1:0; }},
    {k:'liaison',l:'Liaisons frigorifiques et organes',u:'par circuit',q:function(d){ return isSplit(d)?1:0; }},
    {k:'regul',l:'Régulation, sondes, alarme',u:'par chambre',q:function(d){ var p=d.per||{}; return (p.regul&&p.regul.on)||(p.alarme&&p.alarme.on)?1:0; }},
    {k:'elec',l:'Raccordements électriques',u:'par chambre',q:function(d){ return d.elecMode==='none'?0:1; }},
    {k:'nett',l:'Nettoyage, réglages, explications',u:'par chambre',q:function(){ return 1; }}
  ];

  /* ---------- calcul ---------- */
  function compute(lot,ctx){
    var d=lot.data||{}, warn=[];
    if(d.legacyCopy){ var b=K.base(d,ctx,{type:'Chambre froide',mode:d.moMode==='heures'?'heures':'forfait',heures:d.heures}); K.legacyWarn(b.lines,warn); K.machineWarn(d,warn,'Machine'); return {lines:b.lines,mat:b.mat,heures:b.heures,detailH:d.moMode==='heures'?b.heures:0,warnings:warn}; }
    var mode=d.moMode||'detail', rows=mode==='detail'?K.taskRows(d,TASKS,UNITS_DEF):[];
    var data=A.clone(d); if(!isSplit(d)) data.splits=[];
    var b2=K.base(data,ctx,{type:'Chambre froide',rows:rows,mode:mode,heures:d.heures,machineLabel:isSplit(d)?'groupe de condensation':'groupe monobloc'});
    var B=K.builder(warn), g=geo(d);
    if(g.m2>0) B.add(d.ep,g.m2,'cf',null);
    B.add(d.porte,1,'cf');
    if(isSplit(d)) B.add(d.evap,1,'equip');
    K.perLines(B,d,PER.filter(function(x){ return !(x.split&&!isSplit(d)); }));
    (d.st||[]).forEach(function(s){ var p=Math.max(0,num(s.prix)); if(!s.l&&!p) return; var v=0; try{ v=priceVente(p,num(s.marge)); }catch(e){ v=p; }
      B.raw('Pose & main-d’œuvre',s.l||'Sous-traitance',p>0?'prix du sous-traitant '+A.money(p)+' HT + marge '+A.fq(num(s.marge))+' %':'',v,p,{qte:1,unite:'forfait',pu:v},'st'); if(!p) warn.push('Sous-traitance « '+(s.l||'—')+' » : prix à saisir'); });
    var lines=K.insertAfterMat(b2.lines,B.lines.filter(function(l){ return l.group==='Matériel'; }));
    lines=lines.concat(B.lines.filter(function(l){ return l.group!=='Matériel'; }));
    /* contrôles */
    K.machineWarn(d,warn,'Groupe'); K.legacyWarn(b2.lines,warn);
    var ab=abaque(d), pw=num(((d.machines||[])[0]||{}).pw), bil=num(d.bilanW);
    /* référence : ton bilan frigorifique s'il est saisi (Coolselector, calcul poste par poste), sinon le repère de l'onglet Dimensionnement */
    var ref=bil>0?bil:ab.W, refTxt=bil>0?'ton bilan frigorifique':'le repère de ton onglet Dimensionnement';
    if(g.V<=0) warn.push('Dimensions de la chambre à renseigner');
    else if(pw>0&&pw<ref*(bil>0?1:0.9)) warn.push('Puissance retenue ('+A.fq(Math.round(pw))+' W) sous '+refTxt+' ('+A.fq(Math.round(ref))+' W) : à vérifier avec la sélection fabricant');
    else if(!(pw>0)) warn.push('Puissance frigorifique du groupe à renseigner (sélection fabricant) — '+(bil>0?'bilan':'repère')+' : '+A.fq(Math.round(ref))+' W');
    if(!(bil>0)&&g.V>0) warn.push('Repère « abaque » seulement : fais le bilan frigorifique (Coolselector ou poste par poste) et saisis sa puissance');
    var p=d.per||{};
    if(!(p.alarme&&p.alarme.on)) warn.push('Sécurité (INRS) : alarme sonore et lumineuse en cas d\'enfermement non prévue');
    if(isNeg(d)&&!(p.soupape&&p.soupape.on)) warn.push('Chambre négative sans soupape d\'équilibrage de pression');
    K.verifWarn(B,warn);
    return {lines:lines,mat:(b2.mat||[]).concat(B.mat),heures:b2.heures,detailH:mode==='forfait'?0:b2.heures,warnings:warn};
  }

  /* ---------- formulaire ---------- */
  function render(lot,i){
    var d=lot.data, h='';
    if(!K.seededOk(MOD,SEED_VER)) K.seed(MOD,SEED_VER,SEED,WEB_DATE);
    if(d.legacyCopy) return '<div class="nxd2-banner">Copie d\'un ancien devis de chambre froide : montants repris tels quels (kit, forfait de pose).</div>'+K.secMachines(d,i,{title:'Groupe',add:true})+K.secExtras(d,i)+
      K.sec('Main-d\'œuvre','<div class="frm">'+A.fSel('Mode','data.moMode',d.moMode,[['forfait','Forfait pose chambre froide'],['heures','Heures × taux']],{re:'lot'})+A.fIn('Heures','data.heures',d.heures,{t:'n',step:0.5})+'</div>');
    var g=geo(d), ab=abaque(d);
    h+=K.sec('Usage','<div class="frm nxk2">'+A.fSel('Régime','data.temp',d.temp,[['pos','Positif'],['neg','Négatif']],{re:'lot',on:'cfTemp'})+A.fIn('Consigne (°C)','data.consigne',d.consigne,{t:'n',step:1,min:-40})+
      A.fIn('Produits stockés','data.usage',d.usage,{full:true,ph:'viande, crémerie, fruits et légumes…'})+A.fIn('Entrées de marchandises (kg/jour)','data.entrees',d.entrees,{t:'n',step:10})+
      A.fSel('Usage (repère de puissance)','data.use',d.use,[['1','Standard'],['1.15','Ouvertures fréquentes (+15 %)'],['1.2','Denrées entrantes chaudes (+20 %)']],{t:'n',re:'#cfsum'+i})+
      A.fIn('Puissance du bilan frigorifique (W)','data.bilanW',d.bilanW||'',{t:'n',step:10,note:'Coolselector ou calcul poste par poste',re:'#cfsum'+i})+'</div>');
    h+=K.sec('Dimensions intérieures','<div class="frm nxk2">'+A.fIn('Longueur (m)','data.L',d.L,{t:'n',step:0.05,re:'#cfsum'+i})+A.fIn('Largeur (m)','data.l',d.l,{t:'n',step:0.05,re:'#cfsum'+i})+A.fIn('Hauteur (m)','data.h',d.h,{t:'n',step:0.05,re:'#cfsum'+i})+
      A.fSel('Sol','data.sol',d.sol,[['isole','Panneaux de sol isolés'],['existant','Sol existant (isolé par le client)']],{re:'#cfsum'+i})+'</div><div id="cfsum'+i+'">'+sumBlock(lot,i)+'</div>');
    h+=K.sec('Panneaux et porte','<div class="frm nxk2">'+A.fSel('Panneaux','data.ep',d.ep,K.none(panels()))+A.fSel('Porte','data.porte',d.porte,K.none(doors()))+A.fIn('Dimensions / sens de la porte','data.porteDim',d.porteDim,{full:true,ph:'ex. 800 × 1900, poussant droite'})+'</div>'+
      '<div class="nxd2-hint">Sécurité (INRS) : la porte doit pouvoir s\'ouvrir depuis l\'intérieur ; alarme sonore et lumineuse en cas d\'enfermement (ci-dessous).</div>');
    var gpick=groups();
    h+=K.sec('Groupe frigorifique','<div class="frm">'+A.fSel('Type','data.groupeType',d.groupeType,[['monobloc','Groupe monobloc'],['split','Groupe de condensation + évaporateur']],{re:'lot',on:'cfSplit'})+'</div>')+
      K.secMachines(d,i,{title:'',row:'Groupe',pick:gpick,fields:[['Puissance frigorifique (W)','pw',{step:10,note:'sélection fabricant'}]]}).replace('<h3></h3>','')+
      (isSplit(d)?'<div class="frm">'+A.fSel('Évaporateur','data.evap',d.evap,K.none(evaps()))+'</div>'+K.secLiaison(d):'');
    h+=K.secPer(d,i,PER.filter(function(x){ return !(x.split&&!isSplit(d)); }),'Accessoires, sécurités et organes');
    h+=K.secElec(d);
    var sh=(d.st||[]).map(function(s,j){ return '<div class="frm nxk2" style="align-items:end">'+A.fIn('Sous-traitance','data.st.'+j+'.l',s.l,{ph:'électricien, levage…',full:true})+A.fIn('Prix HT (€)','data.st.'+j+'.prix',s.prix,{t:'n',step:1})+A.fIn('Ta marge %','data.st.'+j+'.marge',s.marge,{t:'n',step:1})+'<div>'+K.btn('🗑','delSt',i,j,'iconbtn d')+'</div></div>'; }).join('');
    h+=K.sec('Sous-traitance',(sh||'<div class="nxd2-hint">Aucune (électricité en amont, levage…).</div>')+K.btn('+ Ajouter','addSt',i));
    h+=K.secMes(d)+K.secExtras(d,i);
    h+='<div class="nxd2-sec" id="cfmo'+i+'">'+K.moBlock(lot,i,{id:'cfmo',mod:MOD,TASKS:TASKS,DEF:UNITS_DEF,forfait:'Chambre froide',hist:'Chambre froide'})+'</div>';
    return h;
  }
  function sumBlock(lot,i){ var d=lot.data, g=geo(d), ab=abaque(d), pw=num(((d.machines||[])[0]||{}).pw);
    return '<div class="nxd2-ok" style="margin-top:8px">Volume <b>'+A.fq(Math.round(g.V*10)/10)+' m³</b> · panneaux <b>'+g.m2+' m²</b> (murs '+A.fq(Math.round(g.murs*10)/10)+', plafond '+A.fq(Math.round(g.plafond*10)/10)+(g.sol?', sol '+A.fq(Math.round(g.sol*10)/10):'')+')</div>'+
      '<div class="nxd2-hint">Repère de puissance (méthode de ton onglet Dimensionnement : '+ab.ratio+' W/m³'+(num(d.use)>1?' × '+A.fq(num(d.use)):'')+') : <b>'+A.fq(Math.round(ab.W))+' W</b>'+(num(d.bilanW)>0?' — ton bilan : <b>'+A.fq(Math.round(num(d.bilanW)))+' W</b> (référence)':'')+(pw>0?' — groupe retenu : '+A.fq(Math.round(pw))+' W':'')+'. La sélection fabricant fait foi.</div>'; }
  function renderPart(id,lot,i){ if(id==='cfmo'+i) return K.moBlock(lot,i,{id:'cfmo',mod:MOD,TASKS:TASKS,DEF:UNITS_DEF,forfait:'Chambre froide',hist:'Chambre froide'}); if(id==='cfsum'+i) return sumBlock(lot,i); return ''; }
  function live(lot,i){ K.liveMachines(lot,i); var s=document.getElementById('cfsum'+i); if(s) s.innerHTML=sumBlock(lot,i); var mo=document.getElementById('cfmo'+i); if(mo&&!mo.contains(document.activeElement)) mo.innerHTML=renderPart('cfmo'+i,lot,i); }
  A.hook('cfTemp',function(li,el,v){ var l=A.cur().lots[li]; if(!l) return; var d=l.data, neg=v==='neg';
    d.consigne=neg?-18:2; var ep=panels(), dr=doors(), ev=evaps();
    d.ep=K.first(ep,neg?['Panneau sandwich 100 mm']:['Panneau sandwich 80 mm','Panneau sandwich 60 mm']); d.porte=K.first(dr,neg?['Porte pivotante froid négatif']:['Porte pivotante froid positif']); d.evap=K.first(ev,neg?['Évaporateur cubique négatif']:['Évaporateur cubique positif']);
    d.per=d.per||{}; ['cordon','soupape'].forEach(function(k){ d.per[k]={on:neg,q:1}; }); });
  A.hook('cfSplit',function(li,el,v){ var l=A.cur().lots[li]; if(!l) return; var d=l.data, sp=v==='split'; d.per=d.per||{}; ['regul','detendeur','vanne','deshy','voyant'].forEach(function(k){ d.per[k]={on:sp,q:1}; });
    if(sp&&!(d.splits&&d.splits[0]&&d.splits[0].liaison)){ var li2=K.cat('Cuivre'); d.splits=[{puiss:0,liaison:K.first(li2,['Liaison 3/8 - 5/8','Liaison 1/4 - 1/2']),long:5,cableInter:'Câble 5G1,5'}]; } });
  var actions=K.actions({ addSt:function(l){ (l.data.st||(l.data.st=[])).push({l:'',prix:0,marge:35}); }, delSt:function(l,i,api,j){ l.data.st.splice(j,1); } });

  /* ---------- visite ---------- */
  var VISITE=[
    {k:'produits',l:'Produits, consigne, entrées de marchandises par jour, fréquence d\'ouverture',t:'area'},
    {k:'L',l:'Longueur intérieure (m)',t:'num'},{k:'l',l:'Largeur intérieure (m)',t:'num'},{k:'h',l:'Hauteur intérieure (m)',t:'num'},
    {k:'local',l:'Local : ventilation, exposition, température ambiante',t:'txt',full:true},
    {k:'sol',l:'Sol',t:'sel',o:['','Existant non isolé (panneaux de sol)','Existant isolé','Dalle à créer (hors devis)']},
    {k:'accesPan',l:'Accès pour amener les panneaux',t:'txt',full:true},
    {k:'porte',l:'Porte : dimensions, sens, pivotante ou coulissante',t:'txt',full:true},
    {k:'groupe',l:'Emplacement du groupe, distance, rejet d\'air',t:'txt',full:true},
    K.VIS.tableau,K.VIS.distTab,{k:'evac',l:'Évacuation des condensats',t:'txt',full:true},K.VIS.acces,K.VIS.notes];
  function applyVisite(lot){ var v=lot.visite||{}, d=lot.data, msg=[];
    ['L','l','h'].forEach(function(k){ if(num(v[k])>0&&num(d[k])!==num(v[k])){ d[k]=num(v[k]); msg.push(k+' = '+A.fq(d[k])+' m'); } });
    if(/^Existant isolé/.test(v.sol||'')&&d.sol!=='existant'){ d.sol='existant'; msg.push('sol existant isolé'); }
    if(/non isolé/.test(v.sol||'')&&d.sol!=='isole'){ d.sol='isole'; msg.push('panneaux de sol'); }
    K.applyCommon(v,d,msg); return msg; }

  /* ---------- PDF ---------- */
  function pdf(lot){
    var d=lot.data; if(d.legacyCopy) return '';
    var g=geo(d), m=(d.machines||[])[0]||{}, p=d.per||{}, out=[];
    out.push('<b>Chambre '+(isNeg(d)?'négative':'positive')+'</b> — consigne '+A.fq(num(d.consigne))+' °C'+(d.usage?' — '+esc(d.usage):''));
    out.push('Dimensions intérieures : '+A.fq(g.L)+' × '+A.fq(g.l)+' × '+A.fq(g.h)+' m ('+A.fq(Math.round(g.V*10)/10)+' m³) — '+esc(d.ep||'')+(d.sol==='isole'?', sol isolé':', sol existant'));
    if(d.porte&&d.porte!=='Aucun') out.push('Porte : '+esc(d.porte)+(d.porteDim?' ('+esc(d.porteDim)+')':'')+', ouverture possible depuis l\'intérieur');
    if(m.marque||m.ref||num(m.pw)) out.push('Groupe : '+esc([m.marque,m.ref].filter(Boolean).join(' '))+(num(m.pw)?' — puissance frigorifique '+A.fq(Math.round(num(m.pw)))+' W':'')+(isSplit(d)&&d.evap?' ; '+esc(d.evap):''));
    if(p.alarme&&p.alarme.on) out.push('Alarme personne enfermée (bouton intérieur, signal sonore et lumineux)');
    return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>';
  }
  function summary(lot){ var d=lot.data; if(d.legacyCopy) return 'Chambre froide'; var g=geo(d); return 'Chambre froide '+(isNeg(d)?'négative':'positive')+' '+A.fq(Math.round(g.V*10)/10)+' m³ ('+A.fq(g.L)+' × '+A.fq(g.l)+' × '+A.fq(g.h)+' m)'; }
  function exclusions(){ return 'Maçonnerie, dalle et isolation de sol hors panneaux ; alimentation électrique en amont du coffret si elle n\'est pas chiffrée ci-dessus ; évacuation des condensats jusqu\'au réseau ; levage si non prévu ci-dessus.'; }

  /* ---------- dictée ---------- */
  function fromAssistant(g,lot){
    var src=lot.data||{}, d=defaults(), msg=[]; ['machines','groupLong','extras'].forEach(function(k){ if(src[k]&&!(Array.isArray(src[k])&&!src[k].length)) d[k]=A.clone(src[k]); });
    lot.data=d; lot.exclusions=exclusions();
    if(!g||typeof g!=='object'){ msg.push('dimensions, régime et groupe à renseigner'); return msg; }
    if(g.regime==='neg'||g.regime==='negatif'){ d.temp='neg'; d.consigne=-18; d.ep=K.first(panels(),['Panneau sandwich 100 mm']); d.porte=K.first(doors(),['Porte pivotante froid négatif']); d.evap=K.first(evaps(),['Évaporateur cubique négatif']); d.per=perDefaults(d); }
    if(num(g.consigne)||g.consigne===0) d.consigne=num(g.consigne);
    ['L','l','h'].forEach(function(k){ if(num(g[k])>0) d[k]=num(g[k]); });
    if(g.usage) d.usage=String(g.usage).slice(0,80);
    if(g.groupe==='split'){ d.groupeType='split'; d.per=perDefaults(d); d.splits=[{puiss:0,liaison:K.first(K.cat('Cuivre'),['Liaison 3/8 - 5/8']),long:num(g.liaisonLong)||5,cableInter:'Câble 5G1,5'}]; }
    if(num(g.puissance_w)>0) d.machines[0].pw=num(g.puissance_w); else msg.push('puissance du groupe à confirmer (sélection fabricant)');
    if(g.sol==='existant') d.sol='existant';
    return msg;
  }
  var ASSIST={type:'Chambre froide',consigne:'Devis de type "Chambre froide" : ajoute payload.chambre = {regime: "pos"|"neg", consigne (°C), L, l, h (dimensions intérieures en m), usage, sol: "isole"|"existant", groupe: "monobloc"|"split", puissance_w (si dite), liaisonLong}. Ne mets pas les panneaux ni la porte dans extras : ClimPilot les calcule.'};

  /* onglet Dimensionnement → nouveau format */
  (function(){
    var o=window.devisFromDim; if(typeof o!=='function'||o._cf) return;
    var w=function(type,kit){
      try{ if(kit==='cf'&&localStorage.getItem('cpnext_d2_on')!=='0'){
        var gv=function(id){ var e=document.getElementById(id); return e?e.value:''; };
        var d=NXD2.newDevis(MOD,{}), l=d.lots[0], D=l.data; D.L=num(gv('df_L'))||D.L; D.l=num(gv('df_l'))||D.l; D.h=num(gv('df_h'))||D.h; D.use=num(gv('df_use'))||1;
        if(gv('df_type')==='neg'){ D.temp='neg'; D.consigne=-18; D.ep=K.first(panels(),['Panneau sandwich 100 mm']); D.porte=K.first(doors(),['Porte pivotante froid négatif']); D.evap=K.first(evaps(),['Évaporateur cubique négatif']); D.per=perDefaults(D); }
        NXD2.derive(d); NXD2.open(d,{tab:'lots',dirty:true,banner:'Pré-rempli depuis le Dimensionnement : dimensions, régime et usage. Choisis le groupe (puissance de la sélection fabricant) et vérifie les accessoires.'}); return; }
      }catch(e){}
      return o.apply(this,arguments);
    }; w._cf=true; window.devisFromDim=w;
  })();

  NXD2.register({
    id:MOD, defaults:defaults, fromLegacy:fromLegacy, compute:compute, render:render, renderPart:renderPart, live:live, actions:actions,
    visite:VISITE, applyVisite:applyVisite, pdf:pdf, summary:summary, exclusions:exclusions,
    typeLabel:function(){ return 'Chambre froide'; }, isLegacyType:function(t){ return t==='Chambre froide'; },
    remember:K.rememberUnits(UNITS_DEF), fromAssistant:fromAssistant, assistant:ASSIST,
    _geo:geo, _abaque:abaque, UNITS_DEF:UNITS_DEF, SEED:SEED
  });
})();
