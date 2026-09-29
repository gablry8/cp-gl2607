/* ============================================================
   ClimPilot Next — next-mod-autres.js  (phase 6)
   Les autres natures de chantier, chacune avec son formulaire, son
   calcul, sa visite, son PDF et sa dictée :
   - Froid commercial (vitrines, meubles, groupes ; pose ou remplacement)
   - PAC air-eau (module séparé du ballon)
   - Ballon thermodynamique
   - Adiabatique (depuis ton étude AdiaPilot : même montant)
   - Mise en service seule (matériel posé par un autre)
   - Dépose / remplacement (fluide récupéré, BSFF, DEEE)
   - Sous-traitance (pour un donneur d'ordre)
   Règles vérifiées le 29/09/2026 : TVA 5,5 % PAC air-eau / chauffe-eau
   thermodynamique en logement de plus de 2 ans sous critères, simple
   mention sur le devis (economie.gouv.fr) ; MaPrimeRénov' : installateur
   RGE obligatoire (service-public.fr) ; BSFF via Trackdéchets obligatoire
   depuis le 01/01/2023 (Trackdéchets).
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2||!window.NXK) return;
  var K=NXK, A=K.A, esc=K.esc, num=K.num;
  function flagOn(){ try{ return localStorage.getItem('cpnext_d2_on')!=='0'; }catch(e){ return true; } }
  function mesKey(k){ return (P.mes&&P.mes[k]!=null)?k:'Aucune'; }
  function elecDef(){ return {groupCable:'Câble 3G2,5',groupLong:0,elecMode:'auto',breakerManual:'Disjoncteur 20A',breakerQte:1,differential:false,diffQte:1,proximity:false}; }
  function stLines(B,d,warn){ (d.st||[]).forEach(function(s){ var p=Math.max(0,num(s.prix)); if(!s.l&&!p) return; var v=0; try{ v=priceVente(p,num(s.marge)); }catch(e){ v=p; }
    B.raw('Pose & main-d’œuvre',s.l||'Sous-traitance',p>0?'prix du sous-traitant '+A.money(p)+' HT + marge '+A.fq(num(s.marge))+' %':'',v,p,{qte:1,unite:'forfait',pu:v},'st'); if(!p) warn.push('Sous-traitance « '+(s.l||'—')+' » : prix à saisir'); }); }
  function secSt(d,i){ var sh=(d.st||[]).map(function(s,j){ return '<div class="frm nxk2" style="align-items:end">'+A.fIn('Sous-traitance','data.st.'+j+'.l',s.l,{full:true})+A.fIn('Prix HT (€)','data.st.'+j+'.prix',s.prix,{t:'n',step:1})+A.fIn('Ta marge %','data.st.'+j+'.marge',s.marge,{t:'n',step:1})+'<div>'+K.btn('🗑','delSt',i,j,'iconbtn d')+'</div></div>'; }).join('');
    return K.sec('Sous-traitance',(sh||'<div class="nxd2-hint">Aucune.</div>')+K.btn('+ Ajouter','addSt',i)); }
  var stActions={ addSt:function(l){ (l.data.st||(l.data.st=[])).push({l:'',prix:0,marge:35}); }, delSt:function(l,i,api,j){ l.data.st.splice(j,1); } };
  /* module « machines + périphériques + tâches » (base de plusieurs natures) */
  function genericCompute(lot,ctx,cfg){
    var d=lot.data||{}, warn=[];
    if(d.legacyCopy) return K.legacyCompute(d,ctx,cfg.legacyType||cfg.type,cfg.catLabel);
    var mode=d.moMode||'detail', rows=mode==='detail'?K.taskRows(d,cfg.TASKS,cfg.DEF):[];
    var data=A.clone(d); if(cfg.noSplit&&cfg.noSplit(d)) data.splits=[];
    var b=K.base(data,ctx,{type:cfg.type,rows:rows,mode:mode,heures:d.heures,machineLabel:cfg.machineLabel,catLabel:cfg.catLabel});
    var B=K.builder(warn);
    if(cfg.PER) K.perLines(B,d,cfg.PER.filter(function(x){ return !x.when||x.when(d); }));
    if(cfg.extra) cfg.extra(B,d,warn);
    stLines(B,d,warn);
    var lines=K.insertAfterMat(b.lines,B.lines.filter(function(l){ return l.group==='Matériel'; })).concat(B.lines.filter(function(l){ return l.group!=='Matériel'; }));
    K.machineWarn(d,warn,cfg.machineWord||'Équipement'); K.legacyWarn(b.lines,warn); K.verifWarn(B,warn);
    if(cfg.check) cfg.check(d,warn);
    return {lines:lines,mat:(b.mat||[]).concat(B.mat),heures:b.heures,detailH:mode==='forfait'?0:b.heures,warnings:warn};
  }
  function moCfg(mod,cfg,id){ return {id:id,mod:mod,TASKS:cfg.TASKS,DEF:cfg.DEF,forfait:cfg.forfait,hist:cfg.hist,catLabel:cfg.catLabel}; }
  function perDefaults(PER,d){ var o={}; PER.forEach(function(x){ var on=typeof x.on==='function'?x.on(d):!!x.on; o[x.k]={on:on,q:x.q==null?1:x.q}; }); return o; }

  /* ================= FROID COMMERCIAL ================= */
  (function(){
    var MOD='froidcom', DEF={meuble:2,raccord:3,elec:1,regul:1,depose:2,recup:0.75,nett:0.5};
    var PER=[
      {k:'detendeur',l:'Détendeur thermostatique + orifice',nom:'Détendeur thermostatique + orifice',q:1,cat:'posemat',when:function(d){ return d.groupe!=='loge'; },on:function(d){ return d.groupe!=='loge'; }},
      {k:'vanne',l:'Électrovanne + bobine',nom:'Vanne solénoïde + bobine',q:1,cat:'posemat',when:function(d){ return d.groupe!=='loge'; },on:function(d){ return d.groupe!=='loge'; }},
      {k:'deshy',l:'Déshydrateur',nom:'Déshydrateur à souder',q:1,cat:'posemat',when:function(d){ return d.groupe!=='loge'; },on:function(d){ return d.groupe!=='loge'; }},
      {k:'voyant',l:'Voyant liquide',nom:'Voyant liquide',q:1,cat:'posemat',when:function(d){ return d.groupe!=='loge'; },on:false},
      {k:'regul',l:'Régulation (coffret + sondes, dégivrage)',nom:'Coffret régulation chambre froide + sondes',q:1,cat:'posemat',on:function(d){ return d.groupe!=='loge'; }},
      {k:'alarme',l:'Enregistreur / alarme de température',nom:'Enregistreur de température',q:1,cat:'posemat',on:false},
      {k:'evac',l:'Évacuation des condensats (m)',nom:'Tuyau condensats',q:3,u:'m',step:0.5,cat:'posemat',on:true}
    ];
    var TASKS=[
      {k:'meuble',l:'Pose et mise à niveau des meubles / vitrines',u:'par équipement',q:function(d){ return (d.machines||[]).length; }},
      {k:'raccord',l:'Raccordement frigorifique (groupe déporté ou centrale)',u:'par équipement',q:function(d){ return d.groupe==='loge'?0:(d.machines||[]).length; }},
      {k:'elec',l:'Raccordement électrique',u:'par équipement',q:function(d){ return d.elecMode==='none'?0:(d.machines||[]).length; }},
      {k:'regul',l:'Régulation, dégivrage, réglages',u:'par équipement',q:function(d){ return (d.machines||[]).length; }},
      {k:'depose',l:'Dépose de l\'ancien équipement',u:'par équipement',q:function(d){ return d.nature==='remplacement'?Math.max(0,Math.round(num((d.dep||{}).n))):0; }},
      {k:'recup',l:'Récupération du fluide de l\'ancien équipement',u:'par équipement',q:function(d){ return d.nature==='remplacement'&&num((d.dep||{}).kg)>0?Math.max(1,Math.round(num((d.dep||{}).n))):0; }},
      {k:'nett',l:'Nettoyage, explications, mise en route',u:'par chantier',q:function(){ return 1; }}
    ];
    var cfg={type:'Froid commercial',machineLabel:'équipement frigorifique',machineWord:'Équipement',catLabel:null,TASKS:TASKS,DEF:DEF,PER:PER,hist:'Froid commercial',
      noSplit:function(d){ return d.groupe==='loge'; },
      check:function(d,warn){ if(d.nature==='remplacement'&&num((d.dep||{}).kg)>0) warn.push('Fluide récupéré sur l\'ancien équipement : fiche d\'intervention (Cerfa 15497) et bordereau de suivi (BSFF, Trackdéchets)'); }};
    function defaults(){ var d=Object.assign({nature:'neuf',groupe:'loge',machines:[K.mkMachine()],splits:[{puiss:0,liaison:'',long:0,cableInter:''}],dep:{n:1,kg:0,fluide:''},manut:0,horaires:'',
      mes:'Aucune',brasure:'Aucune',tests:'0',acces:'0',supp:0,taille:'petit',extras:[],st:[],moMode:'detail',heures:0,units:K.initUnits(MOD,DEF),custom:[]},elecDef()); d.per=perDefaults(PER,d); return d; }
    function compute(lot,ctx){
      var r=genericCompute(lot,ctx,cfg), d=lot.data;
      var h=Math.max(0,num(d.manut)); if(h>0&&!d.legacyCopy){ var l=A.mkLine('Pose & main-d’œuvre','Manutention (livraison, mise en place)',A.fq(h)+' h × '+A.money(ctx.rate)+'/h',h*ctx.rate,0,{qte:h,unite:'h',pu:ctx.rate,mo:true}); r.lines.push(l); r.heures+=h; r.detailH+=h; }
      return r;
    }
    function render(lot,i){
      var d=lot.data, h='';
      if(d.legacyCopy) return K.legacyRender(d,i,'de froid commercial');
      h+=K.sec('Chantier','<div class="frm nxk2">'+A.fSel('Nature','data.nature',d.nature,[['neuf','Pose neuve'],['remplacement','Remplacement d\'un équipement']],{re:'lot'})+
        A.fSel('Groupe','data.groupe',d.groupe,[['loge','Logé (groupe intégré)'],['deporte','Déporté (groupe de condensation)'],['centrale','Raccordement à une centrale existante']],{re:'lot',on:'fcGroupe'})+
        A.fIn('Manutention (h)','data.manut',d.manut,{t:'n',step:0.5})+A.fIn('Horaires possibles (commerce)','data.horaires',d.horaires,{full:true})+'</div>');
      h+=K.secMachines(d,i,{title:'Équipements (vitrines, meubles, armoires, groupes)',row:'Équipement',add:true});
      if(d.groupe!=='loge') h+=K.secLiaison(d);
      if(d.nature==='remplacement') h+=K.sec('Dépose de l\'ancien équipement','<div class="frm nxk2">'+A.fIn('Équipements déposés','data.dep.n',d.dep.n,{t:'n',step:1})+A.fIn('Fluide à récupérer (kg)','data.dep.kg',d.dep.kg||'',{t:'n',step:0.01})+A.fIn('Fluide','data.dep.fluide',d.dep.fluide)+'</div>'+
        '<div class="nxd2-hint">Ancien équipement : récupération du fluide (fiche d\'intervention + BSFF) et reprise par une filière DEEE.</div>');
      h+=K.secPer(d,i,PER.filter(function(x){ return !x.when||x.when(d); }),'Organes, régulation et accessoires');
      h+=K.secElec(d)+secSt(d,i)+K.secMes(d)+K.secExtras(d,i);
      h+='<div class="nxd2-sec" id="fcmo'+i+'">'+K.moBlock(lot,i,moCfg(MOD,cfg,'fcmo'))+'</div>';
      return h;
    }
    A.hook('fcGroupe',function(li,el,v){ var l=A.cur().lots[li]; if(!l) return; var d=l.data; d.per=perDefaults(PER,d);
      if(v!=='loge'&&!(d.splits&&d.splits[0]&&d.splits[0].liaison)) d.splits=[{puiss:0,liaison:K.first(K.cat('Cuivre'),['Liaison 3/8 - 5/8','Liaison 1/4 - 1/2']),long:5,cableInter:'Câble 5G1,5'}]; });
    function pdf(lot){ var d=lot.data; if(d.legacyCopy) return ''; var ms=(d.machines||[]).filter(function(m){ return m.marque||m.ref; }).map(function(m){ return esc([m.marque,m.ref].filter(Boolean).join(' ')); }), out=[];
      if(ms.length) out.push('Équipements : '+ms.join(', '));
      out.push('Groupe : '+({loge:'logé',deporte:'déporté (groupe de condensation)',centrale:'raccordement à la centrale existante'})[d.groupe]);
      if(d.nature==='remplacement') out.push('Dépose de l\'ancien équipement : fluide récupéré et tracé (bordereau de suivi BSFF), équipement remis à une filière DEEE.');
      return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>'; }
    function summary(lot){ var d=lot.data, n=(d.machines||[]).length; return 'Froid commercial — '+(d.nature==='remplacement'?'remplacement':'pose')+' de '+n+' équipement'+(n>1?'s':''); }
    function fromAssistant(g,lot){ var src=lot.data||{}, d=defaults(), msg=[]; if(src.machines&&src.machines.some(function(m){ return m.marque||m.ref; })) d.machines=A.clone(src.machines); lot.data=d; lot.exclusions=exclusions();
      if(!g||typeof g!=='object'){ msg.push('équipements et raccordement à renseigner'); return msg; }
      if(g.nature==='remplacement') d.nature='remplacement'; if(['loge','deporte','centrale'].indexOf(g.groupe)>=0){ d.groupe=g.groupe; d.per=perDefaults(PER,d); }
      if(Array.isArray(g.equipements)&&g.equipements.length) d.machines=g.equipements.slice(0,10).map(function(e){ return K.mkMachine({marque:String(e.type||e.marque||''),ref:String(e.modele||''),achat:num(e.achat)}); });
      if(g.depose){ d.dep={n:Math.max(1,num(g.depose.n)||1),kg:num(g.depose.kg),fluide:String(g.depose.fluide||'')}; }
      return msg; }
    function exclusions(){ return 'Maçonnerie, alimentation électrique en amont si elle n\'est pas chiffrée ci-dessus ; évacuation jusqu\'au réseau ; travaux sur la centrale existante non décrits.'; }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:function(s){ var d=defaults(); d.legacyCopy=true; Object.assign(d,K.baseFromLegacy(s)); return d; },compute:compute,render:render,
      renderPart:function(id,lot,i){ return id==='fcmo'+i?K.moBlock(lot,i,moCfg(MOD,cfg,'fcmo')):''; },live:function(lot,i){ K.liveMachines(lot,i); },actions:K.actions(stActions),
      visite:[{k:'empl',l:'Emplacement, rejet d\'air chaud du groupe, ventilation du local',t:'txt',full:true},{k:'groupe',l:'Groupe logé ou déporté, distance groupe → meuble, centrale existante',t:'txt',full:true},K.VIS.tableau,K.VIS.distTab,{k:'evac',l:'Évacuation des condensats',t:'txt',full:true},K.VIS.horaires,K.VIS.notes],
      applyVisite:function(lot){ var m=[]; K.applyCommon(lot.visite||{},lot.data,m); return m; },pdf:pdf,summary:summary,exclusions:exclusions,
      typeLabel:function(){ return 'Froid commercial'; },isLegacyType:function(t){ return t==='Froid commercial'; },remember:K.rememberUnits(DEF),fromAssistant:fromAssistant,
      assistant:{type:'Froid commercial',consigne:'Devis de type "Froid commercial" : ajoute payload.froidcom = {nature: "neuf"|"remplacement", groupe: "loge"|"deporte"|"centrale", equipements:[{type (vitrine, meuble, armoire, tour, machine à glaçons, groupe), modele, achat (si dit)}], depose:{n, kg, fluide}}.'},
      UNITS_DEF:DEF});
  })();

  /* ================= PAC AIR-EAU ================= */
  (function(){
    var MOD='pac', DEF={ue:3,hydro:3,raccord:4,desemb:3,chaud:3,elec:2,regul:1.5,nett:0.5};
    var PER=[
      {k:'kit',l:'Kit hydraulique (vannes + raccords)',nom:'Kit hydraulique PAC (vannes + raccords)',q:1,u:'forfait',cat:'hydro',on:true},
      {k:'tampon',l:'Ballon tampon',nom:'Ballon tampon 25L',q:1,cat:'hydro',on:false},
      {k:'decoupl',l:'Bouteille de découplage',nom:'Bouteille de découplage',q:1,cat:'hydro',on:false},
      {k:'vase',l:'Vase d\'expansion chauffage',nom:'Vase expansion chauffage 18L',q:1,cat:'hydro',on:false},
      {k:'circ',l:'Circulateur',nom:'Circulateur classe A 25-60',q:1,cat:'hydro',on:false},
      {k:'boue',l:'Pot à boue magnétique (désemboueur)',nom:'Pot à boue magnétique (désemboueur)',q:1,cat:'hydro',on:true},
      {k:'flex',l:'Flexibles inox (paire)',nom:'Flexibles inox DN25 (paire)',q:1,u:'paire',cat:'hydro',on:true},
      {k:'vannes',l:'Vannes d\'arrêt 1"',nom:'Vanne d\'arrêt 1/4 tour 1"',q:2,cat:'hydro',on:true},
      {k:'tube',l:'Multicouche Ø26 (m)',nom:'Multicouche Ø26',q:10,u:'m',step:0.5,cat:'hydro',on:true},
      {k:'raccords',l:'Raccords laiton divers',nom:'Raccords laiton divers (forfait)',q:1,u:'forfait',cat:'hydro',on:true},
      {k:'isolant',l:'Isolant tuyau (m)',nom:'Isolant tuyau 19 mm',q:10,u:'m',step:0.5,cat:'hydro',on:true},
      {k:'inhib',l:'Inhibiteur / antigel',nom:'Inhibiteur / antigel (bidon)',q:1,cat:'hydro',on:true},
      {k:'sonde',l:'Sonde extérieure / câble bus',nom:'Sonde extérieure / câble bus',q:1,cat:'posemat',on:true},
      {k:'thermo',l:'Thermostat d\'ambiance',nom:'Thermostat d\'ambiance',q:1,cat:'posemat',on:true},
      {k:'support',l:'Support sol antivibratile (paire)',nom:'Support sol PAC anti-vibratile (paire)',q:1,u:'paire',cat:'posemat',on:true},
      {k:'evac',l:'Évacuation des condensats (m)',nom:'Tuyau condensats',q:3,u:'m',step:0.5,cat:'posemat',on:true}
    ];
    var TASKS=[
      {k:'ue',l:'Pose de l\'unité extérieure',u:'par unité',q:function(d){ return (d.machines||[]).length; }},
      {k:'hydro',l:'Pose du module hydraulique / unité intérieure',u:'par unité',q:function(d){ return d.modele==='monobloc'?0:(d.machines||[]).length; }},
      {k:'raccord',l:'Raccordement hydraulique au circuit de chauffage',u:'par installation',q:function(){ return 1; }},
      {k:'desemb',l:'Désembouage du circuit',u:'par circuit',q:function(d){ return d.desemb?1:0; }},
      {k:'chaud',l:'Dépose de la chaudière existante',u:'par chaudière',q:function(d){ return d.chaudiere==='depose'?1:0; }},
      {k:'elec',l:'Raccordements électriques',u:'par installation',q:function(d){ return d.elecMode==='none'?0:1; }},
      {k:'regul',l:'Régulation, sondes, paramétrage',u:'par installation',q:function(){ return 1; }},
      {k:'nett',l:'Nettoyage, explications au client',u:'par chantier',q:function(){ return 1; }}
    ];
    var cfg={type:'PAC air-eau',machineLabel:'pompe à chaleur air-eau',machineWord:'PAC',TASKS:TASKS,DEF:DEF,PER:PER,forfait:'PAC air-eau',hist:'PAC air-eau',
      noSplit:function(d){ return d.modele==='monobloc'; },
      check:function(d,warn){ var dp=deper(d); var kw=num(((d.machines||[])[0]||{}).kw); if(dp>0&&kw>0&&kw<dp*0.8) warn.push('PAC de '+A.fq(kw)+' kW pour '+A.fq(Math.round(dp*10)/10)+' kW de déperditions (repère de ton onglet Dimensionnement : 80 à 100 %) : à vérifier');
        if(d.chaudiere==='depose') warn.push('Dépose de la chaudière : évacuation / filière à prévoir (article ou sous-traitance)'); }};
    function deper(d){ var s=num(d.surf), h=num(d.haut)||2.5, g=num(d.G), dT=num(d.tconf||20)-num(d.tbase); if(!(s>0&&g>0)) return 0; return g*s*h*dT/1000+num(d.occEcs)*0.25; }
    function defaults(){ var d=Object.assign({modele:'monobloc',emetteurs:'radiateurs',tDepart:'',chaudiere:'aucune',ecs:'conservee',desemb:false,surf:0,haut:2.5,G:1,tbase:-7,tconf:20,occEcs:0,
      machines:[K.mkMachine({kw:0})],splits:[{puiss:0,liaison:'',long:0,cableInter:''}],mes:mesKey('PAC air-eau'),brasure:'Aucune',tests:'0',acces:'0',supp:0,taille:'moyen',extras:[],st:[],moMode:'detail',heures:0,units:K.initUnits(MOD,DEF),custom:[]},elecDef());
      d.per=perDefaults(PER,d); return d; }
    function render(lot,i){
      var d=lot.data, h='';
      if(d.legacyCopy) return K.legacyRender(d,i,'de PAC air-eau');
      h+='<div class="nxd2-hint">Aides (MaPrimeRénov\', CEE) : réservées aux travaux faits par une entreprise RGE. Tant que tu n\'es pas RGE, ne les promets pas au client.</div>';
      h+=K.sec('Installation','<div class="frm nxk2">'+A.fSel('PAC','data.modele',d.modele,[['monobloc','Monobloc'],['split','Bi-bloc (liaisons frigorifiques)']],{re:'lot'})+
        A.fSel('Émetteurs','data.emetteurs',d.emetteurs,[['radiateurs','Radiateurs'],['plancher','Plancher chauffant'],['mixte','Radiateurs + plancher']])+A.fIn('Température de départ (°C)','data.tDepart',d.tDepart,{t:'n',step:1})+
        A.fSel('Chaudière existante','data.chaudiere',d.chaudiere,[['aucune','Aucune'],['depose','Déposée'],['releve','Conservée en relève']])+
        A.fSel('Eau chaude sanitaire','data.ecs',d.ecs,[['conservee','Production existante conservée'],['integree','Intégrée à la PAC'],['ballon','Ballon séparé (autre lot)']])+'</div>'+A.fChk('Désembouage du circuit','data.desemb',d.desemb,{re:'#pcmo'+i}));
      h+=K.secMachines(d,i,{title:'Pompe à chaleur',row:'PAC',fields:[['Puissance (kW)','kw',{step:0.1}]]});
      if(d.modele==='split') h+=K.secLiaison(d);
      h+=K.sec('Repère de puissance (méthode de ton onglet Dimensionnement)','<div class="frm nxk2">'+A.fIn('Surface chauffée (m²)','data.surf',d.surf||'',{t:'n',step:1,re:'#pcsum'+i})+A.fIn('Hauteur (m)','data.haut',d.haut,{t:'n',step:0.1,re:'#pcsum'+i})+
        A.fSel('Isolation (coef G)','data.G',d.G,[['0.75','RT2012 / récente (0,75)'],['1','1990-2010 isolée (1,0)'],['1.3','Avant 1990 isolée (1,3)'],['1.6','Peu isolée (1,6)']],{t:'n',re:'#pcsum'+i})+
        A.fSel('T° extérieure de base','data.tbase',d.tbase,[['-5','−5 °C'],['-7','−7 °C'],['-9','−9 °C'],['-11','−11 °C'],['-15','−15 °C']],{t:'n',re:'#pcsum'+i})+A.fIn('Occupants (ECS)','data.occEcs',d.occEcs,{t:'n',step:1,re:'#pcsum'+i})+'</div><div id="pcsum'+i+'">'+sumPac(d)+'</div>');
      h+=K.secPer(d,i,PER,'Hydraulique et accessoires','Quantités à ajuster au chantier (longueurs réelles).');
      h+=K.secElec(d)+secSt(d,i)+K.secMes(d,{brasure:d.modele==='split'})+K.secExtras(d,i);
      h+='<div class="nxd2-sec" id="pcmo'+i+'">'+K.moBlock(lot,i,moCfg(MOD,cfg,'pcmo'))+'</div>';
      return h;
    }
    function sumPac(d){ var dp=deper(d); if(!dp) return '<div class="nxd2-hint">Renseigne surface et isolation pour le repère de déperditions.</div>';
      return '<div class="nxd2-ok">Déperditions à T° de base : <b>'+A.fq(Math.round(dp*10)/10)+' kW</b> → PAC de '+A.fq(Math.round(dp*0.8*10)/10)+' à '+A.fq(Math.round(dp*10)/10)+' kW (repère ; l\'étude thermique fait foi).</div>'; }
    function pdf(lot){ var d=lot.data; if(d.legacyCopy) return ''; var m=(d.machines||[])[0]||{}, out=[];
      if(m.marque||m.ref) out.push('Pompe à chaleur air-eau '+(d.modele==='split'?'bi-bloc':'monobloc')+' : '+esc([m.marque,m.ref].filter(Boolean).join(' '))+(num(m.kw)?' ('+A.fq(num(m.kw))+' kW)':''));
      out.push('Émetteurs : '+({radiateurs:'radiateurs',plancher:'plancher chauffant',mixte:'radiateurs et plancher chauffant'})[d.emetteurs]+(num(d.tDepart)?' — départ '+A.fq(num(d.tDepart))+' °C':''));
      if(d.chaudiere==='depose') out.push('Dépose de la chaudière existante.'); if(d.chaudiere==='releve') out.push('Chaudière existante conservée en relève.');
      if(d.desemb) out.push('Désembouage du circuit de chauffage.');
      return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>'; }
    function exclusions(){ return 'Travaux de maçonnerie et de plâtrerie ; mise en conformité du circuit de chauffage existant non décrite ; alimentation électrique en amont si elle n\'est pas chiffrée ci-dessus.'; }
    function fromAssistant(g,lot){ var src=lot.data||{}, d=defaults(), msg=[]; if(src.machines&&src.machines.some(function(m){ return m.marque||m.ref; })) d.machines=A.clone(src.machines).map(function(m){ m.kw=m.kw||0; return m; }); lot.data=d; lot.exclusions=exclusions();
      if(!g||typeof g!=='object'){ msg.push('installation et accessoires à vérifier'); return msg; }
      if(g.modele==='split') d.modele='split'; if(['radiateurs','plancher','mixte'].indexOf(g.emetteurs)>=0) d.emetteurs=g.emetteurs; if(['aucune','depose','releve'].indexOf(g.chaudiere)>=0) d.chaudiere=g.chaudiere;
      if(g.desembouage) d.desemb=true; if(num(g.puissance_kw)>0) d.machines[0].kw=num(g.puissance_kw); if(num(g.surface)>0) d.surf=num(g.surface); return msg; }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:function(s){ var d=defaults(); d.legacyCopy=true; Object.assign(d,K.baseFromLegacy(s)); return d; },compute:function(lot,ctx){ return genericCompute(lot,ctx,cfg); },render:render,
      renderPart:function(id,lot,i){ if(id==='pcmo'+i) return K.moBlock(lot,i,moCfg(MOD,cfg,'pcmo')); if(id==='pcsum'+i) return sumPac(lot.data); return ''; },
      live:function(lot,i){ K.liveMachines(lot,i); var s=document.getElementById('pcsum'+i); if(s) s.innerHTML=sumPac(lot.data); },actions:K.actions(stActions),
      visite:[{k:'emet',l:'Émetteurs (radiateurs, plancher), température de départ actuelle',t:'txt',full:true},{k:'chaud',l:'Chaudière existante (type, âge, conservée ou déposée)',t:'txt',full:true},
        {k:'circuit',l:'État du circuit (boues, désembouage nécessaire ?)',t:'sel',o:['','Propre','Désembouage à prévoir','À vérifier']},{k:'place',l:'Place pour l\'unité extérieure et le module intérieur',t:'txt',full:true},
        {k:'abo',l:'Abonnement électrique (kVA)',t:'num'},{k:'ecs',l:'Production d\'eau chaude : conservée, intégrée ou ballon séparé',t:'txt',full:true},K.VIS.tableau,K.VIS.distTab,K.VIS.notes],
      applyVisite:function(lot){ var v=lot.visite||{}, d=lot.data, m=[]; if(v.circuit==='Désembouage à prévoir'&&!d.desemb){ d.desemb=true; m.push('désembouage'); } K.applyCommon(v,d,m); return m; },
      pdf:pdf,summary:function(lot){ var d=lot.data, m=(d.machines||[])[0]||{}; return 'PAC air-eau'+(num(m.kw)?' '+A.fq(num(m.kw))+' kW':'')+(m.marque?' ('+[m.marque,m.ref].filter(Boolean).join(' ')+')':''); },exclusions:exclusions,
      typeLabel:function(){ return 'PAC air-eau'; },isLegacyType:function(t){ return t==='PAC air-eau'; },remember:K.rememberUnits(DEF),fromAssistant:fromAssistant,
      assistant:{type:'PAC air-eau',consigne:'Devis de type "PAC air-eau" : ajoute payload.pac = {modele: "monobloc"|"split", puissance_kw, emetteurs: "radiateurs"|"plancher"|"mixte", chaudiere: "aucune"|"depose"|"releve", desembouage: bool, surface}. Le ballon d\'eau chaude se fait dans un devis "Ballon thermodynamique" séparé si demandé.'},
      UNITS_DEF:DEF,_deper:deper});
    /* onglet Dimensionnement → nouveau format */
    var o=window.devisFromDim; if(typeof o==='function'&&!o._pac){ var w=function(type,kit){ try{ if(kit==='pac'&&flagOn()){ var gv=function(id){ var e=document.getElementById(id); return e?e.value:''; };
      var d=NXD2.newDevis(MOD,{}), D=d.lots[0].data; D.surf=num(gv('dp_surf2')); D.haut=num(gv('dp_haut2'))||2.5; D.G=num(gv('dp_g'))||1; D.tbase=num(gv('dp_tbase'))||-7; D.tconf=num(gv('dp_tconf'))||20; D.occEcs=num(gv('dp_ecs'));
      NXD2.derive(d); NXD2.open(d,{tab:'lots',dirty:true,banner:'Pré-rempli depuis le Dimensionnement : surface, isolation et températures. Choisis la PAC et ajuste les accessoires.'}); return; } }catch(e){} return o.apply(this,arguments); }; w._pac=true; w._cf=o._cf; w._ga=o._ga; window.devisFromDim=w; }
  })();

  /* ================= BALLON THERMODYNAMIQUE ================= */
  (function(){
    var MOD='ballon', DEF={depose:1.5,pose:2,raccord:1.5,gaines:1,elec:1,mes:0.5};
    var PER=[
      {k:'secu',l:'Groupe de sécurité',nom:'Groupe de sécurité inox 3/4"',q:1,cat:'hydro',on:true},
      {k:'siphon',l:'Siphon de groupe de sécurité',nom:'Siphon groupe de sécurité',q:1,cat:'hydro',on:true},
      {k:'reduc',l:'Réducteur de pression',nom:'Réducteur de pression 3/4"',q:1,cat:'hydro',on:false},
      {k:'vase',l:'Vase d\'expansion sanitaire',nom:'Vase expansion sanitaire 8L',q:1,cat:'hydro',on:false},
      {k:'dielec',l:'Raccords diélectriques (paire)',nom:'Raccord diélectrique (paire)',q:1,u:'paire',cat:'hydro',on:true},
      {k:'flex',l:'Flexibles sanitaire (paire)',nom:'Flexibles sanitaire (paire)',q:1,u:'paire',cat:'hydro',on:true},
      {k:'support',l:'Trépied / support',nom:'Trépied / support ballon',q:1,cat:'posemat',on:false},
      {k:'gaine',l:'Gaine semi-rigide Ø160 (m)',nom:'Gaine semi-rigide Ø160 (ballon)',q:6,u:'m',step:0.5,cat:'posemat',on:function(d){ return d.impl==='gaine'; },when:function(d){ return d.impl==='gaine'; }},
      {k:'chapeau',l:'Chapeau de toiture / grille Ø160',nom:'Chapeau de toiture / grille Ø160',q:2,cat:'posemat',on:function(d){ return d.impl==='gaine'; },when:function(d){ return d.impl==='gaine'; }},
      {k:'evac',l:'Évacuation des condensats (m)',nom:'Tuyau condensats',q:2,u:'m',step:0.5,cat:'posemat',on:true}
    ];
    var TASKS=[
      {k:'depose',l:'Dépose de l\'ancien chauffe-eau (vidange, évacuation)',u:'par appareil',q:function(d){ return d.depose?1:0; }},
      {k:'pose',l:'Pose du ballon',u:'par ballon',q:function(d){ return (d.machines||[]).length; }},
      {k:'raccord',l:'Raccordements hydrauliques et condensats',u:'par ballon',q:function(d){ return (d.machines||[]).length; }},
      {k:'gaines',l:'Gaines d\'air et traversées',u:'par ballon',q:function(d){ return d.impl==='gaine'?1:0; }},
      {k:'elec',l:'Raccordement électrique',u:'par ballon',q:function(d){ return d.elecMode==='none'?0:1; }},
      {k:'mes',l:'Mise en service, réglages, explications',u:'par ballon',q:function(d){ return (d.machines||[]).length; }}
    ];
    var cfg={type:'Ballon thermodynamique',machineLabel:'ballon thermodynamique',machineWord:'Ballon',TASKS:TASKS,DEF:DEF,PER:PER,forfait:'Ballon thermodynamique',hist:'Ballon thermodynamique',noSplit:function(){ return true; },
      check:function(d,warn){ var c=cap(d), v=num(((d.machines||[])[0]||{}).litres); if(c&&v&&v<c) warn.push('Ballon de '+v+' L pour un besoin de '+(num(d.occ)*num(d.profil))+' L/jour (repère de ton onglet Dimensionnement : '+c+' L) : à vérifier');
        if(d.depose) warn.push('Ancien chauffe-eau : évacuation en déchetterie / filière à prévoir'); }};
    function cap(d){ var b=num(d.occ)*num(d.profil); if(!(b>0)) return 0; var std=[100,150,200,250,300]; return std.find(function(c){ return c>=b; })||300; }
    function defaults(){ var d=Object.assign({impl:'ambiant',depose:true,occ:0,profil:50,piece:'',machines:[K.mkMachine({litres:0})],mes:'Aucune',brasure:'Aucune',tests:'0',acces:'0',supp:0,taille:'petit',extras:[],st:[],moMode:'detail',heures:0,units:K.initUnits(MOD,DEF),custom:[]},elecDef());
      d.per=perDefaults(PER,d); return d; }
    function render(lot,i){
      var d=lot.data, h='';
      if(d.legacyCopy) return K.legacyRender(d,i,'de ballon thermodynamique');
      h+='<div class="nxd2-hint">Aides (MaPrimeRénov\', CEE) : réservées aux travaux faits par une entreprise RGE. Tant que tu n\'es pas RGE, ne les promets pas au client.</div>';
      h+=K.sec('Installation','<div class="frm nxk2">'+A.fSel('Implantation','data.impl',d.impl,[['ambiant','Air ambiant (local ≥ 20 m³ hors gel)'],['gaine','Gainé sur l\'air extérieur']],{re:'lot',on:'blImpl'})+
        A.fIn('Pièce d\'installation','data.piece',d.piece,{ph:'garage, cellier…'})+A.fIn('Occupants','data.occ',d.occ||'',{t:'n',step:1,re:'#blsum'+i})+
        A.fSel('Profil d\'usage','data.profil',d.profil,[['50','Normal (~50 L/pers/jour)'],['75','Confort (~75 L/pers/jour)']],{t:'n',re:'#blsum'+i})+'</div>'+A.fChk('Dépose de l\'ancien chauffe-eau','data.depose',d.depose,{re:'lot'})+'<div id="blsum'+i+'">'+sumBal(d)+'</div>');
      h+=K.secMachines(d,i,{title:'Ballon thermodynamique',row:'Ballon',fields:[['Volume (L)','litres',{step:10}]]});
      h+=K.secPer(d,i,PER.filter(function(x){ return !x.when||x.when(d); }),'Raccordements et accessoires');
      h+=K.secElec(d)+secSt(d,i)+K.secMes(d,{brasure:false,tests:false})+K.secExtras(d,i);
      h+='<div class="nxd2-sec" id="blmo'+i+'">'+K.moBlock(lot,i,moCfg(MOD,cfg,'blmo'))+'</div>';
      return h;
    }
    function sumBal(d){ var c=cap(d); return c?'<div class="nxd2-ok">Besoin estimé : '+(num(d.occ)*num(d.profil))+' L/jour → capacité conseillée <b>'+c+' L</b> (repère de ton onglet Dimensionnement).</div>':''; }
    A.hook('blImpl',function(li,el,v){ var l=A.cur().lots[li]; if(!l) return; l.data.per=l.data.per||{}; ['gaine','chapeau'].forEach(function(k){ var x=PER.find(function(p){ return p.k===k; }); l.data.per[k]={on:v==='gaine',q:x.q}; }); });
    function pdf(lot){ var d=lot.data; if(d.legacyCopy) return ''; var m=(d.machines||[])[0]||{}, out=[];
      if(m.marque||m.ref) out.push('Ballon thermodynamique : '+esc([m.marque,m.ref].filter(Boolean).join(' '))+(num(m.litres)?' — '+num(m.litres)+' L':''));
      out.push('Implantation : '+(d.impl==='gaine'?'gainé sur l\'air extérieur':'sur air ambiant')+(d.piece?' ('+esc(d.piece)+')':''));
      if(d.depose) out.push('Dépose et évacuation de l\'ancien chauffe-eau.');
      return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>'; }
    function exclusions(){ return 'Modification du réseau d\'eau au-delà du raccordement du ballon ; alimentation électrique en amont si elle n\'est pas chiffrée ci-dessus ; percements en toiture si non prévus ci-dessus.'; }
    function fromAssistant(g,lot){ var src=lot.data||{}, d=defaults(), msg=[]; if(src.machines&&src.machines.some(function(m){ return m.marque||m.ref; })) d.machines=A.clone(src.machines); lot.data=d; lot.exclusions=exclusions();
      if(!g||typeof g!=='object') return ['volume et implantation à vérifier'];
      if(g.implantation==='gaine'){ d.impl='gaine'; d.per=perDefaults(PER,d); } if(g.depose===false) d.depose=false; if(num(g.occupants)>0) d.occ=num(g.occupants); if(num(g.litres)>0) d.machines[0].litres=num(g.litres); return msg; }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:function(s){ var d=defaults(); d.legacyCopy=true; Object.assign(d,K.baseFromLegacy(s)); return d; },compute:function(lot,ctx){ return genericCompute(lot,ctx,cfg); },render:render,
      renderPart:function(id,lot,i){ if(id==='blmo'+i) return K.moBlock(lot,i,moCfg(MOD,cfg,'blmo')); if(id==='blsum'+i) return sumBal(lot.data); return ''; },
      live:function(lot,i){ K.liveMachines(lot,i); },actions:K.actions(stActions),
      visite:[{k:'occ',l:'Nombre de personnes',t:'num'},{k:'existant',l:'Ballon existant (type, volume, dépose)',t:'txt',full:true},{k:'piece',l:'Pièce : volume, température, hors gel ?',t:'txt',full:true},
        {k:'eau',l:'Arrivée d\'eau, pression, évacuation',t:'txt',full:true},K.VIS.tableau,K.VIS.notes],
      applyVisite:function(lot){ var v=lot.visite||{}, d=lot.data, m=[]; if(num(v.occ)>0){ d.occ=num(v.occ); m.push(d.occ+' occupants'); } K.applyCommon(v,d,m); return m; },
      pdf:pdf,summary:function(lot){ var m=(lot.data.machines||[])[0]||{}; return 'Ballon thermodynamique'+(num(m.litres)?' '+num(m.litres)+' L':'')+(m.marque?' ('+[m.marque,m.ref].filter(Boolean).join(' ')+')':''); },exclusions:exclusions,
      typeLabel:function(){ return 'Ballon thermodynamique'; },isLegacyType:function(t){ return t==='Ballon thermodynamique'; },remember:K.rememberUnits(DEF),fromAssistant:fromAssistant,
      assistant:{type:'Ballon thermodynamique',consigne:'Devis de type "Ballon thermodynamique" : ajoute payload.ballon = {litres, implantation: "ambiant"|"gaine", occupants, depose: bool}.'},UNITS_DEF:DEF});
    var o=window.devisFromDim; if(typeof o==='function'&&!o._bal){ var w=function(type,kit){ try{ if(kit==='bal'&&flagOn()){ var gv=function(id){ var e=document.getElementById(id); return e?e.value:''; };
      var d=NXD2.newDevis(MOD,{}), D=d.lots[0].data; D.occ=num(gv('db_occ')); D.profil=num(gv('db_conf'))||50; if(gv('db_impl')==='gaine'){ D.impl='gaine'; D.per=perDefaults(PER,D); } D.machines[0].litres=cap(D);
      NXD2.derive(d); NXD2.open(d,{tab:'lots',dirty:true,banner:'Pré-rempli depuis le Dimensionnement : occupants, profil, implantation et capacité conseillée. Choisis le ballon (prix d\'achat).'}); return; } }catch(e){} return o.apply(this,arguments); };
      w._bal=true; w._pac=o._pac; w._cf=o._cf; w._ga=o._ga; window.devisFromDim=w; }
  })();

  /* ================= ADIABATIQUE (depuis l'étude) ================= */
  (function(){
    var MOD='adia';
    function defaults(){ return Object.assign({machines:[K.mkMachine()],extras:[],splits:[],moMode:'heures',heures:0,mes:'Aucune',brasure:'Aucune',tests:'0',acces:'0',supp:0,taille:'petit',st:[],notesEtude:''},elecDef(),{elecMode:'none'}); }
    function fromLegacy(s){ var d=defaults(); Object.assign(d,K.baseFromLegacy(s)); d.notesEtude=s.notes||''; return d; }
    function compute(lot,ctx){ var d=lot.data||{}, warn=[], b=K.base(d,ctx,{type:'Adiabatique',mode:d.moMode==='heures'?'heures':'forfait',heures:d.heures,machineLabel:'rafraîchisseur adiabatique'});
      var B=K.builder(warn); stLines(B,d,warn); K.machineWarn(d,warn,'Machine'); K.legacyWarn(b.lines,warn);
      if(!num(d.heures)) warn.push('Heures de pose à renseigner');
      return {lines:b.lines.concat(B.lines),mat:b.mat,heures:b.heures,detailH:d.moMode==='heures'?b.heures:0,warnings:warn}; }
    function render(lot,i){ var d=lot.data;
      return '<div class="nxd2-banner">Lot rempli depuis ton étude adiabatique (onglet Adiabatique → « Créer le devis ») : mêmes machines, postes et heures que l\'étude.'+
        '<br><button type="button" class="btn-ghost btn-sm" onclick="nxadReimport('+i+')">↻ Reprendre l\'étude en cours</button> <button type="button" class="btn-ghost btn-sm" onclick="nxadEntretien('+i+')">＋ Proposer l\'entretien (option)</button></div>'+
        (d.notesEtude?'<div class="nxd2-hint" style="white-space:pre-wrap">'+esc(d.notesEtude)+'</div>':'')+
        K.secMachines(d,i,{title:'Rafraîchisseurs',row:'Machine',add:true})+K.secExtras(d,i)+secSt(d,i)+
        K.sec('Main-d\'œuvre (pose, mise en service, formation)','<div class="frm">'+A.fIn('Heures','data.heures',d.heures,{t:'n',step:0.5})+'</div>');
    }
    window.nxadReimport=function(i){ try{ if(typeof devisFromAdia!=='function') return; var keep=A.cur(); window._nxadTarget={d:keep,i:i}; go('adia'); }catch(e){} try{ toast('Vérifie l\'étude puis « Créer le devis » : le lot sera remplacé'); }catch(e){} };
    window.nxadEntretien=function(i){ try{ var c=A.cur(), l=c.lots[i], n=(l.data.machines||[]).length||1; var e=window.nxd2.addLotMod('entretien',true,'Entretien 2 visites / an'); if(!e) return;
      e.data.visites=2; e.data.equips=(l.data.machines||[]).map(function(m){ return {eqId:'',type:'adia',marque:m.marque||'',modele:m.ref||'',fluide:'Sans',charge:0,prp:'',lds:false,herm:false,temps:''}; }); if(!e.data.equips.length) e.data.equips=[{eqId:'',type:'adia',marque:'',modele:'',fluide:'Sans',charge:0,prp:'',lds:false,herm:false,temps:''}];
      window.nxd2.tab('lots'); }catch(err){} };
    /* « Créer le devis » de l'étude → nouveau format (même montant) */
    var o=window.devisFromAdia; if(typeof o==='function'&&!o._nx){ var w=function(){ var r=o.apply(this,arguments); try{
        if(flagOn()&&cur&&cur.v!==2&&cur.type==='Adiabatique'){
          var src=JSON.parse(JSON.stringify(cur)), tgt=window._nxadTarget; window._nxadTarget=null;
          if(tgt&&tgt.d&&tgt.d.lots&&tgt.d.lots[tgt.i]){ var lot=tgt.d.lots[tgt.i]; lot.data=fromLegacy(src); cur=null; NXD2.open(tgt.d,{tab:'lots',dirty:true,banner:'Lot adiabatique mis à jour depuis l\'étude.'}); return r; }
          var d=NXD2.fromLegacyDevis(src); cur=null; NXD2.open(d,{tab:'lots',dirty:true,banner:'Devis adiabatique au nouveau format, <b>même montant</b> que l\'étude. Ajoute préparation, achat du matériel et provision SAV dans le récapitulatif si besoin, puis enregistre.'});
        } }catch(e){} return r; }; w._nx=true; window.devisFromAdia=w; }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:fromLegacy,compute:compute,render:render,live:function(lot,i){ K.liveMachines(lot,i); },actions:K.actions(stActions),
      visite:[{k:'local',l:'Surface, hauteur, apports, occupation',t:'txt',full:true},{k:'eau',l:'Arrivée d\'eau (pression, qualité), évacuation',t:'txt',full:true},{k:'extraction',l:'Évacuation de l\'air soufflé (ouvertures, extraction)',t:'txt',full:true},K.VIS.tableau,K.VIS.acces,K.VIS.notes],
      applyVisite:function(lot){ var m=[]; K.applyCommon(lot.visite||{},lot.data,m); return m; },
      pdf:function(lot){ var d=lot.data; return d.notesEtude?'<div style="font-size:10.5px;color:#333;line-height:1.55">Condition : l\'air soufflé doit pouvoir s\'évacuer (ouvertures ou extraction). Rafraîchissement de confort, sans consigne de température garantie.</div>':''; },
      summary:function(lot){ var n=(lot.data.machines||[]).length; return 'Rafraîchissement adiabatique — '+n+' machine'+(n>1?'s':''); },
      exclusions:function(){ return 'Travaux de couverture ou de bardage non décrits ; alimentation électrique et arrivée d\'eau en amont si elles ne sont pas chiffrées ci-dessus.'; },
      typeLabel:function(){ return 'Adiabatique'; },isLegacyType:function(t){ return t==='Adiabatique'; },
      assistant:{type:'Adiabatique',consigne:'Devis de type "Adiabatique" : l\'étude se fait dans l\'onglet Adiabatique de ClimPilot ; dépose seulement le client et les notes (surface, hauteur, usage).'}});
  })();

  /* ================= MISE EN SERVICE SEULE ================= */
  (function(){
    var MOD='mes';
    function M(){ return P.mesOpt||{}; }
    function defaults(){ return {install:Object.keys(P.mes||{}).filter(function(k){ return k!=='Aucune'; })[0]||'Monosplit',posePar:'client',etat:'',mode:'forfait',route:true,raccords:0,vide:true,azote:false,etanch:false,appoint:false,
      fluide:K.first(K.names(function(p){ return /^Fluide /i.test(p.nom); }),['Fluide R32 (au kg)']),chargeKg:0,pv:true,conso:true,hsup:0,hEst:2,reserves:''}; }
    function compute(lot,ctx){
      var d=lot.data||{}, warn=[], B=K.builder(warn), rate=ctx.rate, T=P.tests||{}, heures=0, mes=function(l,v){ if(num(v)>0) B.raw('Mise en service & déplacement',l,'',num(v),0,{},'mes'); };
      if(d.mode==='forfait') mes('Forfait mise en service '+d.install,(P.mes||{})[d.install]); else if(d.route) mes('Mise en route, réglages et contrôles',M().miseEnRoute);
      if(num(d.raccords)>0&&num(M().raccord)>0) B.raw('Mise en service & déplacement','Confection de raccords (dudgeons)',A.fq(num(d.raccords))+' × '+A.money(M().raccord),num(d.raccords)*num(M().raccord),0,{qte:num(d.raccords),unite:'u',pu:num(M().raccord)},'mes');
      if(d.vide) mes('Tirage au vide',T.vide); if(d.azote) mes('Test azote (mise en pression)',T.azote); if(d.etanch) mes('Contrôle d\'étanchéité',T.etanch);
      if(d.appoint){ mes('Appoint de fluide — main-d\'œuvre et pesée',M().appoint); if(num(d.chargeKg)>0) B.add(d.fluide,d.chargeKg,'fluide',(d.fluide||'Fluide')+' — complément de charge'); }
      if(d.pv) mes('Procès-verbal de mise en service',M().pv);
      if(d.conso&&num(M().conso)>0) B.raw('Frais & divers','Consommables de mise en service','',num(M().conso),num(M().conso)*0.6,{},'divers');
      var hs=Math.max(0,num(d.hsup)); if(hs>0){ B.raw('Pose & main-d’œuvre','Heures supplémentaires',A.fq(hs)+' h × '+A.money(rate)+'/h',hs*rate,0,{qte:hs,unite:'h',pu:rate,mo:true},'mo'); heures+=hs; }
      heures+=Math.max(0,num(d.hEst)); /* temps passé estimé (planning, gain horaire) : champ modifiable */
      if(d.appoint&&num(d.chargeKg)>0) warn.push('Complément de charge : fiche d\'intervention (Cerfa 15497) à remplir');
      if(d.posePar==='autre') warn.push('Pose faite par un autre installateur : formule tes réserves sur le devis et vérifie avec ton assureur décennale');
      K.verifWarn(B,warn);
      return {lines:B.lines,mat:B.mat,heures:heures,detailH:hs,warnings:warn};
    }
    function render(lot,i){ var d=lot.data, M0=M(), T=P.tests||{};
      return K.sec('Installation','<div class="frm nxk2">'+A.fSel('Type d\'installation','data.install',d.install,Object.keys(P.mes||{}).filter(function(k){ return k!=='Aucune'; }).map(function(k){ return [k,k+' — '+A.money(P.mes[k])]; }))+
          A.fSel('Posée par','data.posePar',d.posePar,[['client','Le client'],['autre','Un autre installateur']])+A.fArea('État constaté avant intervention','data.etat',d.etat,{rows:2})+'</div>')+
        K.sec('Prestations','<div class="frm">'+A.fSel('Tarif','data.mode',d.mode,[['forfait','Forfait mise en service (tes tarifs)'],['carte','À la carte']],{re:'lot'})+'</div>'+
          (d.mode==='carte'?A.fChk('Mise en route + réglages + contrôles ('+A.money(M0.miseEnRoute)+')','data.route',d.route):'')+
          '<div class="frm nxk2">'+A.fIn('Raccords dudgeons à confectionner','data.raccords',d.raccords,{t:'n',step:1,note:A.money(M0.raccord)+' / raccord'})+A.fIn('Heures supplémentaires (facturées)','data.hsup',d.hsup,{t:'n',step:0.5})+A.fIn('Temps passé estimé (h, non facturé)','data.hEst',d.hEst,{t:'n',step:0.5,note:'planning et gain horaire'})+'</div>'+
          A.fChk('Tirage au vide ('+A.money(T.vide)+')','data.vide',d.vide)+A.fChk('Test azote ('+A.money(T.azote)+')','data.azote',d.azote)+A.fChk('Contrôle d\'étanchéité ('+A.money(T.etanch)+')','data.etanch',d.etanch)+
          A.fChk('Appoint de fluide ('+A.money(M0.appoint)+' + fluide)','data.appoint',d.appoint,{re:'lot'})+(d.appoint?'<div class="frm nxk2">'+A.fSel('Fluide','data.fluide',d.fluide,K.opts(K.names(function(p){ return /^Fluide /i.test(p.nom); })))+A.fIn('Complément (kg)','data.chargeKg',d.chargeKg,{t:'n',step:0.01})+'</div>':'')+
          A.fChk('PV de mise en service ('+A.money(M0.pv)+')','data.pv',d.pv)+A.fChk('Consommables ('+A.money(M0.conso)+')','data.conso',d.conso))+
        K.sec('Réserves (imprimées sur le devis)','<div class="frm">'+A.fArea('','data.reserves',d.reserves,{rows:2})+'</div><div class="nxd2-hint">Matériel posé par un autre : précise ce que tu ne garantis pas (pose, liaisons, supports…), à formuler avec ton assureur décennale.</div>');
    }
    function pdf(lot){ var d=lot.data, out=['Mise en service d\'une installation '+esc(d.install)+' posée par '+(d.posePar==='autre'?'un autre installateur':'le client')+'.'];
      if(d.etat) out.push('<b>État constaté</b> : '+esc(d.etat)); if(d.reserves) out.push('<b>Réserves</b> : '+esc(d.reserves));
      return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>'; }
    function fromAssistant(g,lot){ var d=defaults(); lot.data=d; lot.exclusions=exclusions(); if(!g||typeof g!=='object') return ['installation à préciser'];
      if(g.installation&&(P.mes||{})[g.installation]!=null) d.install=g.installation; if(g.posePar==='autre') d.posePar='autre'; if(num(g.complement_kg)>0){ d.appoint=true; d.chargeKg=num(g.complement_kg); } if(g.etat) d.etat=String(g.etat); return []; }
    function exclusions(){ return 'Reprise de la pose (supports, liaisons, évacuations) si elle n\'est pas conforme ; fourniture de matériel non listé ci-dessus.'; }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:function(){ return defaults(); },compute:compute,render:render,actions:K.actions(),
      visite:[{k:'qui',l:'Qui a posé quoi (unités, liaisons, électricité)',t:'txt',full:true},{k:'etat',l:'État constaté (supports, liaisons, isolant, évacuations)',t:'area'},K.VIS.acces,K.VIS.notes],
      applyVisite:function(lot){ var v=lot.visite||{}, d=lot.data, m=[]; if(v.etat&&!d.etat){ d.etat=v.etat; m.push('état constaté'); } return m; },
      pdf:pdf,summary:function(lot){ return 'Mise en service '+lot.data.install; },exclusions:exclusions,
      typeLabel:function(){ return 'Mise en service'; },isLegacyType:function(t){ return t==='Mise en service'; },fromAssistant:fromAssistant,
      common:function(){ return {prepH:0,achatH:0,savPct:0}; },
      assistant:{type:'Mise en service',consigne:'Devis de type "Mise en service" (matériel posé par un autre) : ajoute payload.mes = {installation (clé des forfaits de mise en service), posePar: "client"|"autre", etat, complement_kg}.'}});
  })();

  /* ================= DÉPOSE / REMPLACEMENT ================= */
  (function(){
    var MOD='depose', DEF={recup:0.75,depose:1.5,reboucher:0.5,supports:0.5};
    function mkE(){ return {type:'',marque:'',modele:'',fluide:'',charge:0}; }
    function defaults(){ return {equips:[mkE()],reboucher:true,supports:false,deee:{on:true,prix:0},bsff:{on:true,prix:0},units:K.initUnits(MOD,DEF),custom:[]}; }
    var TASKS=[
      {k:'recup',l:'Récupération du fluide',u:'par équipement',q:function(d){ return (d.equips||[]).filter(function(e){ return num(e.charge)>0; }).length; }},
      {k:'depose',l:'Dépose des unités',u:'par équipement',q:function(d){ return (d.equips||[]).length; }},
      {k:'reboucher',l:'Rebouchage des traversées',u:'par équipement',q:function(d){ return d.reboucher?(d.equips||[]).length:0; }},
      {k:'supports',l:'Reprise des supports',u:'par équipement',q:function(d){ return d.supports?(d.equips||[]).length:0; }}
    ];
    function compute(lot,ctx){ var d=lot.data||{}, warn=[], B=K.builder(warn), rows=K.taskRows(d,TASKS,DEF), h=A.sum(rows,function(r){ return r.h; });
      K.taskLines(rows,ctx.rate,'Main-d’œuvre — dépose').forEach(function(l){ l.cat='mo'; B.lines.push(l); });
      if(d.deee&&d.deee.on){ var p=Math.max(0,num(d.deee.prix)); B.raw('Frais & divers','Évacuation des équipements déposés (filière DEEE)','',p,p,{},'divers'); if(!p) warn.push('Évacuation DEEE : coût à saisir (0 si reprise gratuite par ton distributeur)'); }
      if(d.bsff&&d.bsff.on){ var q=Math.max(0,num(d.bsff.prix)); if(q>0) B.raw('Frais & divers','Traitement du fluide récupéré (bordereau BSFF)','',q,q,{},'divers'); }
      var kg=A.sum(d.equips||[],function(e){ return num(e.charge); });
      if(kg>0) warn.push('Fluide récupéré ('+A.fq(kg)+' kg) : fiche d\'intervention (Cerfa 15497) et bordereau de suivi BSFF dans Trackdéchets');
      if(!(d.equips||[]).length) warn.push('Aucun équipement à déposer');
      return {lines:B.lines,mat:[],heures:h,detailH:h,warnings:warn}; }
    function render(lot,i){ var d=lot.data;
      var eh=(d.equips||[]).map(function(e,j){ var q='data.equips.'+j+'.'; return '<div class="nxd2-row"><span class="del">'+K.btn('🗑','delE',i,j,'iconbtn d')+'</span><b style="font-size:13px">Équipement '+(j+1)+'</b><div class="frm nxk2">'+
        A.fIn('Type',q+'type',e.type,{ph:'split, vitrine…'})+A.fIn('Marque / modèle',q+'marque',e.marque)+A.fIn('Fluide',q+'fluide',e.fluide)+A.fIn('Charge à récupérer (kg)',q+'charge',e.charge||'',{t:'n',step:0.01,re:'#dsmo'+i})+'</div></div>'; }).join('');
      return K.sec('Équipements déposés',eh+K.btn('+ Ajouter','addE',i))+
        K.sec('Travaux',A.fChk('Rebouchage des traversées','data.reboucher',d.reboucher,{re:'#dsmo'+i})+A.fChk('Reprise des supports','data.supports',d.supports,{re:'#dsmo'+i})+
          A.fChk('Évacuation par une filière DEEE','data.deee.on',d.deee.on,{re:'lot'})+(d.deee.on?'<div class="frm">'+A.fIn('Coût DEEE (€ HT)','data.deee.prix',d.deee.prix,{t:'n',step:1})+'</div>':'')+
          A.fChk('Traitement du fluide facturé','data.bsff.on',d.bsff.on,{re:'lot'})+(d.bsff.on?'<div class="frm">'+A.fIn('Coût traitement fluide (€ HT)','data.bsff.prix',d.bsff.prix,{t:'n',step:1})+'</div>':'')+
          '<div class="nxd2-hint">Fluide récupéré : bordereau de suivi (BSFF) dans Trackdéchets, obligatoire depuis le 1er janvier 2023. Souvent combiné avec une installation neuve : ajoute un lot « Clim murale » dans le même devis.</div>')+
        '<div class="nxd2-sec" id="dsmo'+i+'">'+K.moBlock(lot,i,{id:'dsmo',mod:MOD,TASKS:TASKS,DEF:DEF}).replace(/<div class="frm">.*?<\/div>/,'')+'</div>'; }
    function pdf(lot){ var d=lot.data, kg=A.sum(d.equips||[],function(e){ return num(e.charge); }), out=[];
      out.push('Équipements déposés : '+(d.equips||[]).map(function(e){ return esc([e.type,e.marque].filter(Boolean).join(' ')||'équipement')+(e.fluide?' ('+esc(e.fluide)+(num(e.charge)?', '+A.fq(num(e.charge))+' kg':'')+')':''); }).join(' ; '));
      if(kg>0) out.push('Fluide récupéré, tracé par bordereau de suivi (BSFF).'); if(d.deee&&d.deee.on) out.push('Équipements déposés remis à une filière DEEE.');
      return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>'; }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:function(){ return defaults(); },compute:compute,render:render,
      renderPart:function(id,lot,i){ return id==='dsmo'+i?K.moBlock(lot,i,{id:'dsmo',mod:MOD,TASKS:TASKS,DEF:DEF}).replace(/<div class="frm">.*?<\/div>/,''):''; },
      actions:K.actions({ addE:function(l){ l.data.equips.push(mkE()); }, delE:function(l,i,api,j){ l.data.equips.splice(j,1); } }),
      visite:[{k:'equip',l:'Équipements à déposer (type, fluide, charge)',t:'area'},K.VIS.acces,K.VIS.notes],applyVisite:function(){ return []; },
      pdf:pdf,summary:function(lot){ var n=(lot.data.equips||[]).length; return 'Dépose de '+n+' équipement'+(n>1?'s':''); },exclusions:function(){ return 'Reprises de peinture et de maçonnerie au-delà du rebouchage des traversées.'; },
      typeLabel:function(){ return 'Dépose'; },isLegacyType:function(t){ return t==='Dépose'; },remember:K.rememberUnits(DEF),
      fromAssistant:function(g,lot){ var d=defaults(); lot.data=d; if(g&&Array.isArray(g.equipements)&&g.equipements.length) d.equips=g.equipements.slice(0,10).map(function(e){ return {type:String(e.type||''),marque:String(e.marque||''),modele:'',fluide:String(e.fluide||''),charge:num(e.charge)}; }); return []; },
      common:function(){ return {prepH:0,achatH:0,savPct:0}; },
      assistant:{type:'Dépose',consigne:'Devis de type "Dépose" : ajoute payload.depose = {equipements:[{type, marque, fluide, charge (kg)}]}.'},UNITS_DEF:DEF});
  })();

  /* ================= SOUS-TRAITANCE ================= */
  (function(){
    var MOD='st';
    function defaults(){ return {donneur:'',taux:num(P.defaultRate),lignes:[{l:'Pose',h:8}],materiel:'do',extras:[],splits:[],machines:[]}; }
    function compute(lot,ctx){ var d=lot.data||{}, warn=[], B=K.builder(warn), t=Math.max(0,num(d.taux)), h=0;
      (d.lignes||[]).forEach(function(r){ var x=Math.max(0,num(r.h)); if(!x) return; h+=x; var l=B.raw('Pose & main-d’œuvre',r.l||'Main-d’œuvre',A.fq(x)+' h × '+A.money(t)+'/h',x*t,0,{qte:x,unite:'h',pu:t,mo:true},'mo'); l.catLabel='Main-d’œuvre (sous-traitance)'; });
      if(d.materiel==='moi') (d.extras||[]).forEach(function(x){ if(x.nom&&num(x.qte)>0) B.add(x.nom,x.qte,'posemat'); });
      if(!t) warn.push('Taux horaire de sous-traitance à saisir'); if(!h) warn.push('Heures à renseigner'); K.verifWarn(B,warn);
      return {lines:B.lines,mat:B.mat,heures:h,detailH:0,warnings:warn}; }
    function render(lot,i){ var d=lot.data;
      var lh=(d.lignes||[]).map(function(r,j){ return '<div class="nxd2-task"><div class="l"><input type="text" data-k="data.lignes.'+j+'.l" data-t="s" value="'+esc(r.l||'')+'"></div><div class="v"><input type="number" step="0.5" min="0" data-k="data.lignes.'+j+'.h" data-t="n" value="'+(r.h==null?'':r.h)+'"> h '+K.btn('🗑','delL',i,j,'iconbtn d')+'</div></div>'; }).join('');
      return K.sec('Donneur d\'ordre','<div class="frm nxk2">'+A.fIn('Entreprise donneuse d\'ordre','data.donneur',d.donneur,{full:true,ph:'le client du devis est le donneur d\'ordre'})+A.fIn('Taux horaire de sous-traitance (€ HT)','data.taux',d.taux,{t:'n',step:1})+'</div>'+
          '<div class="nxd2-hint">Ton donneur d\'ordre te demandera ton attestation de vigilance URSSAF (téléchargeable sur ton espace urssaf.fr). Le jour où tu factures la TVA : en sous-traitance du bâtiment, la TVA est autoliquidée par le donneur d\'ordre (art. 283-2 nonies du CGI), facture hors taxe avec la mention « Autoliquidation » — à confirmer avec ton comptable au premier cas.</div>')+
        K.sec('Heures',lh+K.btn('+ Ajouter une ligne','addL',i))+
        K.sec('Matériel','<div class="frm">'+A.fSel('Fourni par','data.materiel',d.materiel,[['do','Le donneur d\'ordre'],['moi','Moi (articles ci-dessous)']],{re:'lot'})+'</div>')+(d.materiel==='moi'?K.secExtras(d,i):''); }
    NXD2.register({id:MOD,defaults:defaults,fromLegacy:function(){ return defaults(); },compute:compute,render:render,
      actions:K.actions({ addL:function(l){ l.data.lignes.push({l:'',h:1}); }, delL:function(l,i,api,j){ l.data.lignes.splice(j,1); } }),
      visite:[K.VIS.horaires,K.VIS.notes],applyVisite:function(){ return []; },
      pdf:function(lot){ var d=lot.data; return '<div style="font-size:10.5px;color:#333;line-height:1.55">Travaux réalisés en sous-traitance'+(d.donneur?' pour le compte de '+esc(d.donneur):'')+(d.materiel==='do'?' ; matériel fourni par le donneur d\'ordre':'')+'.</div>'; },
      summary:function(lot){ var h=A.sum(lot.data.lignes||[],function(r){ return num(r.h); }); return 'Sous-traitance — '+A.fq(h)+' h'; },exclusions:function(){ return ''; },
      typeLabel:function(){ return 'Sous-traitance'; },isLegacyType:function(t){ return t==='Sous-traitance'; },
      fromAssistant:function(g,lot){ var d=defaults(); lot.data=d; if(g&&typeof g==='object'){ if(num(g.taux)>0) d.taux=num(g.taux); if(num(g.heures)>0) d.lignes=[{l:String(g.travaux||'Pose'),h:num(g.heures)}]; if(g.donneur) d.donneur=String(g.donneur); } return []; },
      common:function(){ return {prepH:0,achatH:0,savPct:0}; },
      assistant:{type:'Sous-traitance',consigne:'Devis de type "Sous-traitance" (pour un donneur d\'ordre, ex. son patron) : ajoute payload.st = {donneur, taux (€/h si dit), heures, travaux}.'}});
  })();
})();
