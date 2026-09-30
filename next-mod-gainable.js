/* ============================================================
   ClimPilot Next — next-mod-gainable.js
   Module « Gainable » : le réseau pièce par pièce, du plénum de
   reprise jusqu'aux thermostats (remplace le kit « 4 bouches »).
   - Unité, liaisons, électricité, condensats, mise en service,
     consommables : chiffrés par la chaîne de calcul existante
     (mêmes règles que tes autres devis).
   - Réseau aéraulique et régulation : ligne par ligne, depuis ta
     base de prix. Les articles qui manquaient (registres motorisés,
     thermostats, centrale, trappe…) sont ajoutés à la base au
     premier devis gainable, avec un prix relevé sur internet,
     marqués « à vérifier » : tu les remplaces par tes prix pro.
   - Aucun calcul aéraulique inventé : contrôle de cohérence
     (débits saisis / débit de l'unité), sinon « à vérifier avec
     la fiche fabricant ».
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2) return;
  var A=NXD2.api, esc=A.esc, num=A.num;
  var MOD='gainable';

  /* ---------- articles ajoutés à la base (prix d'achat HT relevés sur internet le 29/09/2026) ---------- */
  var SEED_VER=2, WEB_DATE='29/09/2026';   /* 2 : prix de la passerelle machine trouvé (article resté à 0 mis à jour) */
  var N={
    plenum:'Plénum de soufflage isolé (3 à 6 piquages)', plenumMot:'Plénum motorisé de zonage (kit fabricant)',
    registre:'Registre motorisé circulaire Ø160/Ø200 (12 V)', centrale:'Centrale de zonage (carte système)',
    passerelle:'Passerelle de communication machine (selon marque)', thF:'Thermostat de zone filaire', thR:'Thermostat de zone radio',
    wifi:'Passerelle Wi-Fi (pilotage connecté)', bus:'Câble bus de régulation', grilleRep:'Grille de reprise avec porte-filtre 500x400',
    filtre:'Filtre de rechange grille de reprise', manchette:'Manchette souple Ø200 (M0, colliers)', susp:'Kit de suspension gainable (4 câbles)',
    trappe:'Trappe de visite 600x600', bac:'Bac auxiliaire de récupération 945x425', secu:'Sécurité de débordement (flotteur)',
    /* articles déjà présents dans ta base (Matériel v2) */
    colliers:'Colliers de serrage (x10)', scotch:'Scotch alu 50 m', transfert:'Grille de transfert', bypass:'Clapet de délestage', plenumRep:'Plénum de reprise'
  };
  var SEED=[
    [N.plenum,'unité',191.67,'mygainable.com — plénum universel isolé 3 sorties Ø160/200, 230 € (TTC supposé)'],
    [N.plenumMot,'unité',0,'prix selon le nombre de sorties, à saisir d\'après ton pack. Repère : clim-planete.com, pack Airzone taille M 4 sorties pour Daikin FBA60/71 AVEC 4 thermostats, 2 207,50 € HT (thermostats inclus : ne les compte pas en plus)'],
    [N.registre,'unité',131.97,'aircco.fr — Airzone CPCC200MTE, 131,97 € HT'],
    [N.centrale,'unité',283.47,'leroymerlin.es — Airzone Flexa 4.0 (CE8), 343 € TTC Espagne, TVA 21 % déduite'],
    [N.passerelle,'unité',316.00,'climfactory.com — passerelle Airzone pour gainable Daikin ou Mitsubishi (fonction QAI), 379,20 € TTC soit 316,00 € HT ; autre marque : référence et prix à vérifier'],
    [N.thF,'unité',141.11,'aircco.fr — Airzone Lite filaire, 141,11 € HT'],
    [N.thR,'unité',172.54,'aircco.fr — Airzone Lite radio, 172,54 € HT'],
    [N.wifi,'unité',212.66,'aircco.fr — Webserver Airzone Cloud, 212,66 € HT'],
    [N.bus,'m',0.89,'aircco.fr — câble bus Airzone, bobine 100 m à 89,11 € HT'],
    [N.grilleRep,'unité',132.50,'clim-planete.com — grille + filtre de reprise 500x400, 159 € TTC'],
    [N.filtre,'unité',21.67,'climfactory.com — pack de 5 filtres de reprise, 108,33 € HT'],
    [N.manchette,'unité',68.44,'cedeo.fr — Aldes kit manchette M0 Ø200, 82,13 € TTC'],
    [N.susp,'unité',49.17,'clim-split.com — kit Gripple x4 gainable/cassette, 59 € TTC'],
    [N.trappe,'unité',41.66,'leroymerlin.fr — trappe de visite 600x600, 49,99 € TTC'],
    [N.bac,'unité',39.20,'climplus.com — bac de récupération plastique 945x425, 47,04 € TTC'],
    [N.secu,'unité',0,'aucun prix générique fiable relevé : à saisir']
  ];
  function slug(s){ return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
  function seededV(){ var g=(A.DEFS()||{})[MOD]; return g?num(g.seeded):0; }
  function seeded(){ return seededV()>=SEED_VER; }
  /* ajout à la base de prix, une seule fois (repère synchronisé entre appareils) ; un article déjà présent n'est jamais touché,
     sauf un article ajouté par ClimPilot et resté à 0 € (jamais renseigné) : il reçoit le prix indicatif trouvé depuis */
  function seed(){
    try{
      var v0=seededV(); if(v0>=SEED_VER) return 0;
      var customs=load(LS.custom,[]), names={}, n=0, up=0;
      (PRIX||[]).forEach(function(p){ names[p.nom]=1; }); customs.forEach(function(p){ names[p.nom]=1; });
      SEED.forEach(function(s){
        var web=s[3]+' — relevé le '+WEB_DATE;
        if(v0>=1){ /* mise à jour : on n'ajoute rien (un article supprimé reste supprimé) */
          var e=customs.find(function(p){ return p.id==='gai_'+slug(s[0]); });
          if(e&&!(num(e.achat)>0)&&(s[2]>0||e.web!==web)){ e.achat=s[2]; e.web=web; e.verif=true; up++; }
          return; }
        if(names[s[0]]) return;
        customs.push({id:'gai_'+slug(s[0]),nom:s[0],cat:'Gainable',unite:s[1],achat:s[2],marge:35,verif:true,src:'local',web:web}); n++; });
      if(n||up){ save(LS.custom,customs); try{ rebuildPrix(); }catch(e){} }
      var all=A.DEFS(); all[MOD]=Object.assign(all[MOD]||{},{seeded:SEED_VER}); save('cpnext_d2_defaults',all);
      return n;
    }catch(e){ return 0; }
  }
  function pr(nom){ try{ return findPrix(nom)||null; }catch(e){ return null; } }
  function names(filter){ try{ return (PRIX||[]).filter(filter).map(function(p){ return p.nom; }); }catch(e){ return []; } }
  function firstOf(list,pref){ for(var i=0;i<pref.length;i++){ if(list.indexOf(pref[i])>=0) return pref[i]; } return list[0]||''; }
  function grilles(){ return names(function(p){ return p.cat==='Gainable'&&/^(Grille soufflage|Diffuseur)/i.test(p.nom); }); }
  function plGrilles(){ return names(function(p){ return p.cat==='Gainable'&&/^Plénum/i.test(p.nom)&&/grille/i.test(p.nom); }); }
  function gaines(){ return names(function(p){ return p.cat==='Gainable'&&/^Gaine/i.test(p.nom)&&p.unite==='m'; }); }
  function grillesRep(){ return names(function(p){ return p.cat==='Gainable'&&/^Grille (de )?reprise/i.test(p.nom); }); }

  /* ---------- données ---------- */
  var EMPL=['Combles perdus','Combles aménagés','Faux plafond','Placard technique','Autre'];
  var BREAKERS=['Disjoncteur 16A','Disjoncteur 20A','Disjoncteur 32A'];
  /* temps unitaires de départ (proposés, à ajuster : ClimPilot retient les tiens à l'enregistrement) */
  var UNITS_DEF={ue:2,ui:3,liaison:2,plenums:1.5,reseau:1,reprise:0.75,decoupe:0.5,trappe:1.5,regul:0.75,regulc:1,cond:0.75,elec:1,equil:1,nett:0.5,maj:30};
  function savedUnits(){ var s=(A.DEFS()[MOD]||{}).units; return s&&typeof s==='object'?s:null; }
  function unitsOf(d){ var u=d.units||{}, o={}; Object.keys(UNITS_DEF).forEach(function(k){ o[k]=(u[k]!=null&&u[k]!=='')?Math.max(0,num(u[k])):UNITS_DEF[k]; }); return o; }
  function mkMachine(){ return {marque:'',ref:'',achat:0,marge:35,maxCurrent:0,kw:0,debit:0,pression:0}; }
  function mkPiece(nom){
    var g=grilles(), pg=plGrilles(), ga=gaines();
    return {nom:nom||'',surface:0,bouches:1,grille:firstOf(g,['Grille soufflage linéaire','Grille soufflage double déflexion']),
      plenumGrille:firstOf(pg,['Plénum soufflage grille linéaire'])||'Aucun',gaine:firstOf(ga,['Gaine isolée Ø160']),long:5,zone:true,debit:0};
  }
  function quoteDefaults(){ try{ var q=JSON.parse(localStorage.getItem('cpnext_quote_defaults')||'{}'); return q.Gainable||null; }catch(e){ return null; } }
  var IMPORT=['mes','acces','tests','brasure','support','elecMode','pompeType','pompeQte','groupCable','breakerManual','breakerQte','differential','diffQte','proximity'];
  function defaults(){
    seed();
    var kw=7.1, lia='Liaison 3/8 - 5/8'; try{ lia=liaisonForPower(kw); }catch(e){}
    var d={type:'Gainable',machines:[mkMachine()],emplacement:'Combles perdus',accesCombles:false,trappe:'existante',
      platrerie:'moi',stPrix:0,stMarge:35,pieces:[mkPiece('Séjour'),mkPiece('Chambre 1')],
      plenum:N.plenum,plenumQte:1,
      reprise:{empl:'Couloir',grille:firstOf(grillesRep(),[N.grilleRep,'Grille de reprise linéaire']),plenum:N.plenumRep,gaine:firstOf(gaines(),['Gaine isolée Ø250','Gaine isolée Ø200']),long:3,qte:1,transferts:0,filtre:false},
      manchettes:2,suspension:true,regul:'zonage',zoneMat:'registres',thermo:'filaire',centrale:true,passerelle:true,wifi:false,cableBus:'',bypass:false,
      liaison:lia,long:5,cableInter:'Câble 5G1,5',groupCable:'Câble 3G2,5',groupLong:0,condLong:0,support:'Aucun',pompeType:'Aucune',pompeQte:1,bacAux:false,secuDeb:false,
      elecMode:'auto',breakerManual:'Disjoncteur 20A',breakerQte:1,differential:false,diffQte:1,proximity:false,
      mes:(P.mes&&P.mes.Gainable!=null)?'Gainable':'Aucune',brasure:'Brasure simple',tests:'0',acces:'0',supp:0,taille:'auto',
      extras:[],heures:0,moMode:'detail',units:Object.assign({},UNITS_DEF,savedUnits()||{}),custom:[],tva55:{}};
    d.machines[0].kw=kw;
    var q=quoteDefaults(); if(q) IMPORT.forEach(function(k){ if(q[k]!=null) d[k]=A.clone(q[k]); });
    return d;
  }
  /* ancien formulaire « Gainable » : copie à l'identique (le kit reste en articles), même montant */
  function fromLegacy(s){
    if((s.machines||[]).length>1||(s.splits||[]).length>1){ var K=window.NXK, dl={legacyCopy:true,type:'Gainable'}; if(K) Object.assign(dl,K.baseFromLegacy(s)); dl.units=Object.assign({},UNITS_DEF); dl.custom=[]; dl.tva55={}; return dl; }
    var sp=(s.splits||[])[0]||{};
    return {type:'Gainable',
      machines:(s.machines||[]).slice(0,1).map(function(m){ return {marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:m.marge!=null?num(m.marge):35,maxCurrent:num(m.maxCurrent),kw:num(sp.puiss),debit:0,pression:0}; }),
      emplacement:'Combles perdus',accesCombles:false,trappe:'aucune',platrerie:'exclue',stPrix:0,stMarge:35,pieces:[],
      plenum:'Aucun',plenumQte:1,reprise:{empl:'',grille:'Aucun',plenum:'Aucun',gaine:'Aucun',long:0,qte:0,transferts:0,filtre:false},
      manchettes:0,suspension:false,regul:'thermostat',zoneMat:'registres',thermo:'filaire',centrale:false,passerelle:false,wifi:false,cableBus:'',bypass:false,
      liaison:sp.liaison||'',long:num(sp.long),cableInter:sp.cableInter||sp.cable||'Câble 5G1,5',groupCable:s.groupCable||'Câble 3G2,5',groupLong:num(s.groupLong),
      goulottes:A.clone(s.goulottes||[]),condLong:num(s.condLong),support:s.support||'Aucun',pompeType:s.pompeType||'Aucune',pompeQte:s.pompeQte!=null?s.pompeQte:1,bacAux:false,secuDeb:false,
      elecMode:s.elecMode||'auto',breakerManual:s.breakerManual||'Disjoncteur 20A',breakerQte:s.breakerQte!=null?s.breakerQte:1,differential:!!s.differential,diffQte:s.diffQte!=null?s.diffQte:1,proximity:!!s.proximity,
      mes:s.mes||'Aucune',brasure:s.brasure||'Aucune',tests:s.tests||'0',acces:s.acces||'0',supp:num(s.supp),taille:s.taille||'auto',
      extras:A.clone(s.extras||[]),heures:num(s.heures),moMode:s.moMode==='heures'?'heures':'forfait',units:Object.assign({},UNITS_DEF,savedUnits()||{}),custom:[],tva55:{}};
  }

  /* ---------- quantités du réseau ---------- */
  function zoning(d){ return d.regul==='zonage'; }
  function counts(d){
    var ps=d.pieces||[], z=zoning(d);
    var bouches=A.sum(ps,function(p){ return Math.max(0,Math.round(num(p.bouches))); });
    var zp=z?ps.filter(function(p){ return p.zone&&num(p.bouches)>0; }):[];
    var bz=A.sum(zp,function(p){ return Math.max(0,Math.round(num(p.bouches))); });
    var rq=Math.max(0,Math.round(num((d.reprise||{}).qte))), tr=Math.max(0,Math.round(num((d.reprise||{}).transferts)));
    var reg=z&&d.zoneMat==='registres'?bz:0, th=z?zp.length:0;
    var busAuto=z?(d.thermo==='filaire'?10*th:0)+2*reg+5:0;
    var bus=(d.cableBus===''||d.cableBus==null)?busAuto:Math.max(0,num(d.cableBus));
    return {bouches:bouches,zones:zp.length,bouchesZ:bz,registres:reg,thermostats:th,reprises:rq,transferts:tr,busAuto:busAuto,bus:bus,
      ouvertures:bouches+rq+tr, gaineM:A.sum(ps,function(p){ return Math.max(0,num(p.bouches))*Math.max(0,num(p.long)); })};
  }
  /* lignes du réseau aéraulique et de la régulation, depuis la base de prix */
  function netLines(d,warn){
    var c=counts(d), out=[], mat=[], used={};
    function add(nom,q,cat,label){
      q=Math.max(0,num(q)); if(!nom||nom==='Aucun'||q<=0) return;
      var p=pr(nom);
      if(!p){ out.push(tag(A.mkLine('Matériel',label||nom,'⚠️ absent de la base de prix — prix 0, à corriger',0,0,{qte:q,unite:'u',pu:0}),cat)); warn.push('Article « '+nom+' » absent de la base de prix'); return; }
      var u=0; try{ u=venteOf(nom,p.marge); }catch(e){}
      if(!num(p.achat)&&p.pv==null) warn.push('« '+nom+' » : prix d\'achat à saisir dans la base de prix');
      if(p.verif) used[nom]=1;
      var lab=label||nom, un=p.unite==='unité'?'u':p.unite;
      out.push(tag(A.mkLine('Matériel',lab,A.fq(A.r2(q))+' '+un+' × '+A.money(u),u*q,num(p.achat)*q,{qte:q,unite:un,pu:u}),cat));
      mat.push({nom:nom,qte:q,unite:p.unite,achatU:num(p.achat),venteU:u,ht:u*q});
    }
    function tag(l,cat){ l.cat=cat; return l; }
    /* soufflage */
    if(zoning(d)&&d.zoneMat==='plenum') add(N.plenumMot,Math.max(1,num(d.plenumQte)||1),'regul','Plénum motorisé de zonage');
    else add(d.plenum,Math.max(1,num(d.plenumQte)||1),'reseau');
    var byG={}, byPG={}, byGaine={};
    (d.pieces||[]).forEach(function(p){ var b=Math.max(0,Math.round(num(p.bouches))); if(!b) return;
      if(p.grille&&p.grille!=='Aucun') byG[p.grille]=(byG[p.grille]||0)+b;
      if(p.plenumGrille&&p.plenumGrille!=='Aucun') byPG[p.plenumGrille]=(byPG[p.plenumGrille]||0)+b;
      if(p.gaine&&p.gaine!=='Aucun'&&num(p.long)>0) byGaine[p.gaine]=(byGaine[p.gaine]||0)+b*num(p.long); });
    Object.keys(byPG).forEach(function(k){ add(k,byPG[k],'reseau'); });
    Object.keys(byG).forEach(function(k){ add(k,byG[k],'reseau'); });
    /* reprise */
    var r=d.reprise||{};
    if(c.reprises>0){ add(r.grille,c.reprises,'reseau'); add(r.plenum,c.reprises,'reseau');
      if(r.gaine&&r.gaine!=='Aucun'&&num(r.long)>0) byGaine[r.gaine]=(byGaine[r.gaine]||0)+num(r.long)*c.reprises; }
    Object.keys(byGaine).forEach(function(k){ add(k,A.r2(byGaine[k]),'reseau'); });
    add(N.transfert,c.transferts,'reseau');
    if(r.filtre) add(N.filtre,Math.max(1,c.reprises),'reseau','Filtre de reprise de rechange');
    add(N.manchette,Math.max(0,Math.round(num(d.manchettes))),'reseau','Manchette souple antivibratile');
    var ends=2*c.bouches+2*c.reprises; if(ends>0) add(N.colliers,Math.ceil(ends/10),'reseau');
    if(c.bouches>0) add(N.scotch,1,'reseau');
    if(zoning(d)&&d.bypass) add(N.bypass,1,'reseau','Clapet de délestage (bypass)');
    /* régulation */
    if(zoning(d)){
      add(N.registre,c.registres,'regul','Registre motorisé de zone');
      var kit=d.zoneMat==='plenum'&&d.kitInclus!==false;   /* kit fabricant : thermostats et centrale fournis avec le plénum motorisé */
      if(d.centrale&&!kit) add(N.centrale,1,'regul');
      if(d.passerelle) add(N.passerelle,1,'regul');
      if(!kit) add(d.thermo==='radio'?N.thR:N.thF,c.thermostats,'regul');
      add(N.bus,A.r2(c.bus),'regul');
    }
    if(d.wifi) add(N.wifi,1,'regul');
    /* pose */
    if(d.suspension) add(N.susp,1,'posemat','Kit de suspension de l\'unité');
    if(d.trappe==='creer'&&d.platrerie==='moi') add(N.trappe,1,'posemat');   /* sous-traitée : fournie par le plaquiste ; exclue : à la charge du client */
    if(d.bacAux) add(N.bac,1,'posemat','Bac auxiliaire sous l\'unité');
    if(d.secuDeb) add(N.secu,1,'posemat','Sécurité de débordement (coupure)');
    return {lines:out,mat:mat,verif:Object.keys(used)};
  }

  /* ---------- main-d'œuvre tâche par tâche ---------- */
  var TASKS=[
    {k:'ue',l:'Pose du groupe extérieur et support',u:'par groupe',q:function(d){ return (d.machines||[]).length; }},
    {k:'ui',l:'Pose de l\'unité gainable (suspension, plots)',u:'par unité',q:function(d){ return (d.machines||[]).length; },comb:true},
    {k:'liaison',l:'Liaisons frigorifiques, câble, passage de mur',u:'par unité',q:function(d){ return (d.machines||[]).length; }},
    {k:'plenums',l:'Plénums de soufflage et de reprise, manchettes',u:'par unité',q:function(d){ return (d.pieces||[]).length||counts(d).reprises?(d.machines||[]).length:0; },comb:true},
    {k:'reseau',l:'Réseau de gaines et bouches de soufflage',u:'par bouche',q:function(d){ return counts(d).bouches; },comb:true},
    {k:'reprise',l:'Reprise et grilles de transfert',u:'par grille',q:function(d){ var c=counts(d); return c.reprises+c.transferts; },comb:true},
    {k:'decoupe',l:'Découpes des bouches et grilles (plâtrerie)',u:'par ouverture',q:function(d){ return d.platrerie==='moi'?counts(d).ouvertures:0; }},
    {k:'trappe',l:'Création de la trappe de visite',u:'par trappe',q:function(d){ return d.platrerie==='moi'&&d.trappe==='creer'?1:0; }},
    {k:'regul',l:'Régulation : registres et thermostats',u:'par zone',q:function(d){ return zoning(d)?counts(d).zones:0; },comb:true},
    {k:'regulc',l:'Centrale de zonage : câblage et paramétrage',u:'par système',q:function(d){ return zoning(d)&&(d.centrale||d.zoneMat==='plenum')?1:0; }},
    {k:'cond',l:'Condensats (bac auxiliaire, pompe)',u:'par chantier',q:function(d){ return d.bacAux||(d.pompeType&&d.pompeType!=='Aucune')?1:0; }},
    {k:'elec',l:'Raccordement électrique',u:'par groupe',q:function(d){ return d.elecMode==='none'?0:(d.machines||[]).length; }},
    {k:'equil',l:'Équilibrage des débits et réglages',u:'par chantier',q:function(d){ return counts(d).bouches>0?1:0; }},
    {k:'nett',l:'Nettoyage et explications au client',u:'par chantier',q:function(){ return 1; }}
  ];
  function taskRows(d){
    var u=unitsOf(d), combH=0;
    var rows=TASKS.map(function(t){ var q=t.q(d), h=q*u[t.k]; if(t.comb) combH+=h; return {k:t.k,l:t.l,u:t.u,q:q,h1:u[t.k],h:h}; }).filter(function(r){ return r.q>0; });
    if(d.accesCombles&&combH>0&&u.maj>0) rows.push({k:'maj',maj:true,l:'Majoration accès difficile en combles',u:'% des heures en combles',q:combH,h1:u.maj,h:combH*u.maj/100});
    (d.custom||[]).forEach(function(c,j){ var h=Math.max(0,num(c.h)); rows.push({custom:j,l:c.l||'Autre tâche',q:1,h1:h,h:h}); });
    return rows;
  }

  /* ---------- calcul ---------- */
  function autoTaille(d){ if(d.taille&&d.taille!=='auto') return d.taille; var b=counts(d).bouches; if(!b) return 'auto'; return b<=3?'petit':(b<=6?'moyen':'gros'); }
  function compute(lot,ctx){
    var data=lot.data||{}, rate=ctx.rate, warnings=[];
    if(data.legacyCopy&&window.NXK) return window.NXK.legacyCompute(data,ctx,'Gainable','Main-d’œuvre — gainable');
    var m0=(data.machines||[])[0]||{};
    var o={type:'Gainable',machines:A.clone(data.machines||[]).map(function(m){ return {marque:m.marque,ref:m.ref,achat:num(m.achat),marge:num(m.marge),breaker:m.breaker||'',maxCurrent:num(m.maxCurrent)}; }),
      splits:(data.liaison||num(data.long))?[{puiss:num(m0.kw)||7,liaison:data.liaison,long:num(data.long),cableInter:data.cableInter}]:[],
      groupCable:data.groupCable,groupLong:num(data.groupLong),goulottes:A.clone(data.goulottes||[]),condLong:num(data.condLong),support:data.support,
      pompeType:data.pompeType,pompeQte:data.pompeQte,extras:A.clone(data.extras||[]),acces:data.acces,supp:num(data.supp),mes:data.mes,brasure:data.brasure,tests:data.tests,
      taille:autoTaille(data),elecMode:data.elecMode||'auto',breakerManual:data.breakerManual,breakerQte:data.breakerQte,differential:!!data.differential,diffQte:data.diffQte,proximity:!!data.proximity,
      zone:'Aucun',rateChoice:ctx.d.rateChoice,rateCustom:ctx.d.rateCustom,acompteOn:false,acomptePct:0,tvaRate:0,estim:false};
    o.nbMach=o.machines.length; o.nbSplit=o.splits.length;
    var mode=data.moMode||'detail', rows=null, heures=0;
    if(mode==='detail'){ rows=taskRows(data); heures=A.sum(rows,function(r){ return r.h; }); o.moMode='heures'; o.heures=heures; }
    else if(mode==='forfait'){ o.moMode='forfait'; o.heures=num(data.heures); heures=num(data.heures); }
    else { o.moMode='heures'; o.heures=num(data.heures); heures=num(data.heures); }
    var c=A.LEGACY(o);
    var lines=c.lines.filter(function(l){ return !(l.group==='Frais & divers'&&(l.label==='Frais administratifs devis'||l.label==='Frais commande matériel'||/^Marge sécurité/.test(l.label))); });
    lines.forEach(function(l){
      if(l.group==='Pose & main-d’œuvre'&&(l.label==='Main-d’œuvre'||l.label==='Forfait pose')) l.mo=true;
      if(l.group==='Matériel'&&/^Machine\s*\d+/.test(l.label)) l.pdf='ensemble gainable : unité intérieure + groupe extérieur';
      var m=/^Liaison split \d+ \((.+?), [\d.,]+ kW\)$/.exec(l.label); if(m) l.label='Liaison frigorifique ('+m[1]+')';
      var m2=/^Câble interco\. split \d+ \((.+)\)$/.exec(l.label); if(m2) l.label='Câble d\'interconnexion ('+m2[1]+')';
    });
    if(mode==='detail'){
      var idx=-1; lines.forEach(function(l,j){ if(idx<0&&l.group==='Pose & main-d’œuvre'&&l.label==='Main-d’œuvre') idx=j; });
      if(idx>=0){
        var tl=rows.filter(function(r){ return r.h>0; }).map(function(r){
          var det=r.maj?(A.fq(A.r2(r.h))+' h ('+A.fq(r.h1)+' % de '+A.fq(A.r2(r.q))+' h) × '+A.money(rate)+'/h'):(A.fq(A.r2(r.h))+' h'+(r.custom==null?' ('+A.fq(r.q)+' × '+A.fq(r.h1)+' h '+r.u+')':'')+' × '+A.money(rate)+'/h');
          return A.mkLine('Pose & main-d’œuvre',r.l,det,r.h*rate,0,{qte:r.h,unite:'h',pu:rate,mo:true});
        });
        lines.splice.apply(lines,[idx,1].concat(tl));
      }
    }
    /* réseau + régulation, insérés après le matériel de l'ancienne chaîne */
    var net=netLines(data,warnings);
    var at=0; lines.forEach(function(l,j){ if(l.group==='Matériel') at=j+1; });
    lines.splice.apply(lines,[at,0].concat(net.lines));
    /* plâtrerie sous-traitée */
    if(data.platrerie==='soustraite'){
      var st=Math.max(0,num(data.stPrix)), pv=0; try{ pv=priceVente(st,num(data.stMarge)); }catch(e){ pv=st; }
      var sl=A.mkLine('Pose & main-d’œuvre','Plâtrerie sous-traitée (découpes des bouches, trappe, reprises)',st>0?'prix du plaquiste '+A.money(st)+' HT + marge '+A.fq(num(data.stMarge))+' %':'',pv,st,{qte:1,unite:'forfait',pu:pv}); sl.cat='st';
      lines.push(sl);
      if(!st) warnings.push('Plâtrerie sous-traitée : prix du plaquiste à saisir');
    }
    /* contrôles */
    (data.machines||[]).forEach(function(m){ if(!num(m.achat)) warnings.push('Unité gainable'+(m.marque?' ('+m.marque+')':'')+' : prix d\'achat à saisir'); });
    lines.forEach(function(l){ if(/absent du catalogue/.test(l.detail||'')) warnings.push('Article « '+l.label+' » absent de la base de prix'); });
    if(net.verif.length) warnings.push(net.verif.length+' article(s) au prix internet indicatif (« à vérifier ») : remplace-les par tes prix pro dans la base de prix');
    var k=counts(data);
    if(zoning(data)&&!k.zones) warnings.push('Zonage choisi, mais aucune pièce n\'est cochée « zone » : pas de thermostat ni de registre chiffré');
    if(zoning(data)&&data.zoneMat==='plenum'&&data.kitInclus!==false) warnings.push('Plénum motorisé : thermostats et centrale comptés dans le kit (non facturés à part). Vérifie ta référence ; décoche « inclus dans le kit » s\'ils sont vendus séparément. La passerelle machine est comptée à part : vérifie qu\'elle n\'est pas déjà fournie');
    if((data.pieces||[]).some(function(p){ return num(p.bouches)>0; })&&(data.extras||[]).some(function(x){ return x.nom&&num(x.qte)>0&&/^(Gaine|Grille|Plénum|Diffuseur)/i.test(x.nom); }))
      warnings.push('Réseau en double ? Des gaines, grilles ou plénums sont dans les articles ET calculés pièce par pièce : retire les articles de l\'ancien kit');
    if(num(data.long)>=10) warnings.push('Liaison de '+A.fq(num(data.long))+' m : vérifie la longueur préchargée (notice) ; au-delà, ajoute le complément de fluide');
    if(window.NXK&&window.NXK.installChecks) window.NXK.installChecks(data,warnings,{visite:lot.visite});
    if(!zoning(data)||data.zoneMat!=='plenum'){ var pq=Math.max(1,num(data.plenumQte)||1); if(data.plenum===N.plenum&&k.bouches>6*pq) warnings.push(k.bouches+' bouches pour '+pq+' plénum(s) de 3 à 6 piquages : vérifie le nombre de sorties'); }
    var deb=num(m0.debit), sd=A.sum(data.pieces||[],function(p){ return num(p.debit); });
    if(deb>0&&sd>0&&(sd>deb*1.1||sd<deb*0.7)) warnings.push('Somme des débits des pièces ('+A.fq(Math.round(sd))+' m³/h) éloignée du débit nominal de l\'unité ('+A.fq(Math.round(deb))+' m³/h) : à vérifier avec la fiche fabricant');
    if(mode==='forfait'&&!(P.forfait&&P.forfait.Gainable)) warnings.push('Pas de forfait pose « Gainable » : les heures × taux sont utilisées');
    if(mode!=='detail'&&!heures) warnings.push('Heures estimées à renseigner (gain horaire et planning)');
    if(String(lot.tva)==='5.5'){ var t=data.tva55||{}; if(!(t.rev&&t.classe&&t.pilot&&t.log2&&t.p12)) warnings.push('TVA 5,5 % : tous les critères ne sont pas cochés'); }
    return {lines:lines,mat:(c.mat||[]).concat(net.mat),heures:heures,detailH:heures,warnings:warnings};
  }

  /* ---------- formulaire ---------- */
  function opts(list){ return list.map(function(x){ return [x,x]; }); }
  function withNone(list){ return [['Aucun','Aucun']].concat(opts(list)); }
  function sec(t,body,id){ return '<div class="nxd2-sec"'+(id?' id="'+id+'"':'')+'><h3>'+t+'</h3>'+body+'</div>'; }
  function btn(lbl,act,i,extra,cls){ return '<button type="button" class="'+(cls||'btn-ghost btn-sm')+'" onclick="nxd2.act(\''+act+'\','+i+(extra!=null?','+extra:'')+')">'+lbl+'</button>'; }
  function pAchat(nom){ var p=pr(nom); if(!p) return nom&&nom!=='Aucun'?'⚠️ absent de la base':''; var u=0; try{ u=venteOf(nom,p.marge); }catch(e){} return (num(p.achat)?A.money(u)+' / '+esc(p.unite):'prix d\'achat à saisir')+(p.verif?' · à vérifier':''); }
  function render(lot,i){
    if(lot.data&&lot.data.legacyCopy&&window.NXK) return window.NXK.legacyRender(lot.data,i,'gainable (plusieurs unités)',false);
    var d=lot.data, h='', k=counts(d), pn=names(function(){ return true; });
    if(!seeded()) seed();
    /* installation */
    h+=sec('Installation','<div class="frm">'+
      A.fSel('Emplacement de l\'unité','data.emplacement',d.emplacement,opts(EMPL))+
      A.fSel('Trappe d\'accès','data.trappe',d.trappe,[['existante','Existante'],['creer','À créer'],['aucune','Pas nécessaire']],{re:'lot'})+
      A.fSel('Plâtrerie (découpes des bouches, trappe)','data.platrerie',d.platrerie,[['moi','Faite par moi (heures comptées)'],['soustraite','Sous-traitée (plaquiste)'],['exclue','Exclue : à la charge du client']],{re:'lot',on:'gaPlat'})+
      (d.platrerie==='soustraite'?A.fIn('Prix du plaquiste HT (€)','data.stPrix',d.stPrix,{t:'n',step:1})+A.fIn('Ta marge sur la sous-traitance %','data.stMarge',d.stMarge,{t:'n',step:1}):'')+
      '</div>'+A.fChk('Accès difficile en combles (faible hauteur, isolant soufflé) : majoration des heures','data.accesCombles',d.accesCombles,{re:'#gamo'+i}));
    /* unité */
    var lib=(typeof MACHLIB!=='undefined'?MACHLIB:[])||[];
    var mh=(d.machines||[]).map(function(m,j){
      return '<div class="nxd2-row"><b style="font-size:13px">Unité gainable + groupe extérieur</b><div class="frm ga-piece">'+
        (lib.length?'<label class="full">📚 Bibliothèque<select onchange="nxd2.act(\'lib\','+i+','+j+',this.value)"><option value="">— choisir —</option>'+lib.map(function(x,q){ return '<option value="'+q+'">'+esc((x.marque||'')+' '+(x.ref||''))+' — '+A.money(x.achat)+'</option>'; }).join('')+'</select></label>':'')+
        A.fIn('Marque','data.machines.'+j+'.marque',m.marque)+A.fIn('Référence','data.machines.'+j+'.ref',m.ref)+
        A.fIn('Prix d\'achat HT (€)','data.machines.'+j+'.achat',m.achat,{t:'n',step:0.01})+A.fIn('Marge %','data.machines.'+j+'.marge',m.marge,{t:'n',step:1})+
        A.fIn('Puissance froid (kW)','data.machines.'+j+'.kw',m.kw||'',{t:'n',step:0.1,on:'gaKw',re:'lot'})+
        A.fIn('Débit nominal (m³/h)','data.machines.'+j+'.debit',m.debit||'',{t:'n',step:10,note:'fiche fabricant'})+
        A.fIn('Pression statique dispo (Pa)','data.machines.'+j+'.pression',m.pression||'',{t:'n',step:5,note:'fiche fabricant'})+
        A.fIn('Courant max (A)','data.machines.'+j+'.maxCurrent',m.maxCurrent||'',{t:'n',step:0.1,note:'notice → calibre'})+
        '</div><div class="calc" id="nxd2mv'+i+'_'+j+'"></div>'+btn('☆ Mémoriser','mem',i,j)+'</div>';
    }).join('');
    h+=sec('Unité gainable',mh);
    /* soufflage */
    var G=grilles(), PG=plGrilles(), GA=gaines();
    var ph=(d.pieces||[]).map(function(p,j){
      var q='data.pieces.'+j+'.';
      return '<div class="nxd2-row"><span class="del">'+btn('🗑','delPiece',i,j,'iconbtn d')+'</span><b style="font-size:13px">'+(p.nom?esc(p.nom):'Pièce '+(j+1))+'</b><div class="frm ga-piece">'+
        A.fIn('Pièce',q+'nom',p.nom,{ph:'Séjour, chambre 1…',full:true})+A.fIn('Surface (m²)',q+'surface',p.surface||'',{t:'n',step:0.5})+
        A.fIn('Bouches',q+'bouches',p.bouches,{t:'n',step:1,min:0,re:'#gasum'+i})+
        A.fSel('Grille de soufflage',q+'grille',p.grille,withNone(G),{full:true})+
        A.fSel('Plénum de grille',q+'plenumGrille',p.plenumGrille,withNone(PG),{full:true})+
        A.fSel('Gaine',q+'gaine',p.gaine,withNone(GA))+
        A.fIn('Gaine / bouche (m)',q+'long',p.long,{t:'n',step:0.5})+
        A.fIn('Débit de la pièce (m³/h)',q+'debit',p.debit||'',{t:'n',step:10,note:'facultatif, contrôle',full:true})+
        '</div>'+(zoning(d)?A.fChk('Zone régulée (thermostat dans la pièce)',q+'zone',p.zone,{re:'#gasum'+i}):'')+'</div>';
    }).join('');
    h+=sec('Soufflage — pièce par pièce',(ph||'<div class="nxd2-hint">Aucune pièce. Ajoute les pièces desservies.</div>')+btn('+ Ajouter une pièce','addPiece',i)+
      '<div class="frm" style="margin-top:8px">'+(zoning(d)&&d.zoneMat==='plenum'?'':A.fSel('Plénum de soufflage','data.plenum',d.plenum,withNone(names(function(p){ return p.cat==='Gainable'&&/^Plénum/i.test(p.nom)&&!/grille|reprise|motoris/i.test(p.nom); }))))+
      A.fIn('Nombre de plénums de soufflage','data.plenumQte',d.plenumQte,{t:'n',step:1,min:1})+
      A.fIn('Manchettes souples','data.manchettes',d.manchettes,{t:'n',step:1,note:'soufflage + reprise'})+'</div>'+
      '<div id="gasum'+i+'">'+sumBlock(lot,i)+'</div>');
    /* reprise */
    var r=d.reprise||{};
    h+=sec('Reprise','<div class="frm">'+A.fIn('Emplacement','data.reprise.empl',r.empl,{ph:'couloir, palier…'})+
      A.fIn('Grilles de reprise','data.reprise.qte',r.qte,{t:'n',step:1,min:0})+
      A.fSel('Grille de reprise','data.reprise.grille',r.grille,withNone(grillesRep()))+
      A.fSel('Plénum de reprise','data.reprise.plenum',r.plenum,withNone(names(function(p){ return p.cat==='Gainable'&&/^Plénum/i.test(p.nom)&&/reprise/i.test(p.nom); })))+
      A.fSel('Gaine de reprise','data.reprise.gaine',r.gaine,withNone(GA))+A.fIn('Longueur (m)','data.reprise.long',r.long,{t:'n',step:0.5})+
      A.fIn('Grilles de transfert','data.reprise.transferts',r.transferts,{t:'n',step:1,min:0,note:'si portes non détalonnées'})+'</div>'+
      A.fChk('Filtre de rechange fourni','data.reprise.filtre',r.filtre));
    /* régulation */
    var zh='<div class="frm">'+A.fSel('Régulation','data.regul',d.regul,[['thermostat','Thermostat unique (commande de l\'unité)'],['zonage','Zonage pièce par pièce']],{re:'lot'})+
      (zoning(d)?A.fSel('Matériel de zonage','data.zoneMat',d.zoneMat,[['registres','Registres motorisés sur les gaines'],['plenum','Plénum motorisé (kit fabricant)']],{re:'lot'})+
        (d.zoneMat==='plenum'?A.fChk('Thermostats et centrale inclus dans le kit','data.kitInclus',d.kitInclus!==false,{re:'lot'}):'')+
        A.fSel('Thermostats','data.thermo',d.thermo,[['filaire','Filaires'],['radio','Radio']],{re:'#gasum'+i})+
        A.fIn('Câble bus (m)','data.cableBus',d.cableBus,{t:'n',step:1,ph:'auto : '+k.busAuto+' m',note:'vide = estimation'}):'')+'</div>'+
      (zoning(d)?A.fChk('Centrale de zonage','data.centrale',d.centrale)+A.fChk('Passerelle de communication avec l\'unité','data.passerelle',d.passerelle)+A.fChk('Clapet de délestage (bypass)','data.bypass',d.bypass):'')+
      A.fChk('Pilotage connecté (Wi-Fi)','data.wifi',d.wifi)+
      (zoning(d)?'<div class="nxd2-hint">Registres : un par bouche des pièces zonées. Thermostats : un par zone. Câble bus estimé à 10 m par thermostat filaire + 2 m par registre + 5 m : ajuste-le.</div>':'');
    h+=sec('Régulation',zh);
    /* liaisons, électricité, condensats */
    var liais=names(function(p){ return p.cat==='Cuivre'; }), sup=names(function(p){ return p.cat==='Supports'; }), pom=names(function(p){ return p.cat==='Pompe'; });
    var cab=(typeof SPLIT_CABLES!=='undefined'?SPLIT_CABLES:['Câble 5G1,5']), gc=(typeof GROUP_CABLES!=='undefined'?GROUP_CABLES:['Câble 3G2,5']), em=d.elecMode||'auto';
    h+=sec('Liaisons, électricité, condensats',
      '<div class="frm">'+A.fSel('Liaison cuivre','data.liaison',d.liaison,opts(liais))+A.fIn('Longueur liaison (m)','data.long',d.long,{t:'n',step:0.5})+
        A.fSel('Câble d\'interconnexion','data.cableInter',d.cableInter,opts(cab))+
        A.fSel('Câble d\'alimentation du groupe','data.groupCable',d.groupCable,opts(gc))+A.fIn('Longueur alimentation (m)','data.groupLong',d.groupLong,{t:'n',step:0.5})+
        A.fSel('Support groupe extérieur','data.support',d.support,[['Aucun','Aucun']].concat(opts(sup)))+'</div>'+
      '<div class="frm" style="margin-top:8px">'+A.fIn('Évacuation condensats (m)','data.condLong',d.condLong,{t:'n',step:0.5})+
        A.fSel('Pompe de relevage','data.pompeType',d.pompeType,[['Aucune','Aucune']].concat(opts(pom)),{re:'#gamo'+i})+A.fIn('Nombre de pompes','data.pompeQte',d.pompeQte,{t:'n',step:1,min:1})+'</div>'+
      A.fChk('Bac auxiliaire sous l\'unité','data.bacAux',d.bacAux,{re:'#gamo'+i})+A.fChk('Sécurité de débordement (coupure de l\'unité)','data.secuDeb',d.secuDeb)+
      A.fChk('Kit de suspension de l\'unité','data.suspension',d.suspension)+
      '<div class="frm" style="margin-top:8px">'+A.fSel('Protection électrique','data.elecMode',em,[['auto','Automatique (courant max de l\'unité)'],['manual','Choix manuel'],['none','Non fournie / existante à contrôler']],{re:'lot'})+
        (em==='manual'?A.fSel('Disjoncteur','data.breakerManual',d.breakerManual,opts(BREAKERS))+A.fIn('Quantité','data.breakerQte',d.breakerQte,{t:'n',step:1,min:1}):'')+'</div>'+
      (em!=='none'?A.fChk('Protection différentielle','data.differential',d.differential,{re:'lot'})+(d.differential?'<div class="frm">'+A.fIn('Nombre de différentiels','data.diffQte',d.diffQte,{t:'n',step:1,min:1})+'</div>':'')+A.fChk('Interrupteur de proximité IP65','data.proximity',d.proximity):'')+
      '<div class="nxd2-hint">⚠️ Liaison et calibre à valider avec la notice constructeur de l\'unité.</div>');
    /* MES */
    var mesK=Object.keys(P.mes||{}), brK=Object.keys(P.bras||{});
    h+=sec('Mise en service et contrôles','<div class="frm">'+
      A.fSel('Mise en service','data.mes',d.mes,mesK.map(function(x){ return [x,x==='Aucune'?'Aucune':x+' — '+A.money(P.mes[x])]; }))+
      A.fSel('Brasure','data.brasure',d.brasure,brK.map(function(x){ return [x,x==='Aucune'?'Aucune':x+' — '+A.money(P.bras[x])]; }))+
      A.fSel('Contrôle','data.tests',d.tests,[['0','Aucun'],['vide','Tirage au vide — '+A.money((P.tests||{}).vide)],['azote','Test azote — '+A.money((P.tests||{}).azote)],['etanch','Contrôle d\'étanchéité — '+A.money((P.tests||{}).etanch)]])+
      A.fSel('Accès','data.acces',d.acces,[['0','Normal'],['diff','Difficile (+'+A.money((P.acces||{}).diff)+')']])+
      A.fIn('Suppléments chantier (€ HT)','data.supp',d.supp,{t:'n',step:1})+
      A.fSel('Consommables','data.taille',d.taille||'auto',[['auto','Auto (selon le nombre de bouches)'],['petit','Petit chantier'],['moyen','Chantier moyen'],['gros','Gros chantier']])+'</div>');
    /* articles */
    var dl='<datalist id="nxd2PrixDL">'+pn.map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>';
    var xh=(d.extras||[]).map(function(x,j){
      return '<div class="frm" style="align-items:end;margin-bottom:6px">'+A.fIn('Article','data.extras.'+j+'.nom',x.nom,{list:'nxd2PrixDL',re:'lot'})+A.fIn('Quantité','data.extras.'+j+'.qte',x.qte,{t:'n',step:0.5})+
        '<div class="calc">'+esc(pAchat(x.nom))+'</div><div>'+btn('🗑','delExtra',i,j,'iconbtn d')+'</div></div>';
    }).join('');
    h+=sec('Articles complémentaires',dl+(xh||'<div class="nxd2-hint">Aucun article complémentaire.</div>')+btn('+ Ajouter un article','addExtra',i));
    /* MO */
    h+='<div class="nxd2-sec" id="gamo'+i+'">'+moBlock(lot,i)+'</div>';
    /* TVA 5,5 */
    try{ if(P.regimeTVA==='assujetti'){ var t=d.tva55||{};
      h+=sec('TVA à 5,5 % — critères (réforme 2026)','<div class="nxd2-hint">À confirmer sur le texte officiel au premier devis concerné. Sinon : 10 % pose / 20 % matériel en logement de plus de 2 ans, 20 % pour les locaux pro.</div>'+
        A.fChk('PAC air/air réversible (chaud et froid)','data.tva55.rev',t.rev)+A.fChk('Classes énergétiques requises atteintes en chaud et en froid (≤ 12 kW : A++ pour un mono-split, cas du gainable)','data.tva55.classe',t.classe)+
        A.fChk('Pilotage connecté fourni','data.tva55.pilot',t.pilot)+A.fChk('Logement d\'habitation achevé depuis plus de 2 ans','data.tva55.log2',t.log2)+A.fChk('Fluide et puissance conformes (≤ 12 kW ou seuils saisonniers au-delà)','data.tva55.p12',t.p12));
    } }catch(e){}
    /* sources des prix indicatifs */
    h+='<details class="nxd2-sec"><summary style="cursor:pointer;font-size:13px;color:var(--muted)">Prix indicatifs relevés sur internet (sources)</summary><div class="nxd2-hint" style="margin-top:6px">Prix d\'achat HT, marge 35 %, marqués « à vérifier » dans ta base de prix. Remplace-les par tes prix pro.</div><ul style="font-size:12.5px;margin:6px 0 0 18px;padding:0">'+
      SEED.map(function(s){ return '<li><b>'+esc(s[0])+'</b> : '+(s[2]?A.money(s[2])+' HT':'prix à saisir')+' — '+esc(s[3])+'</li>'; }).join('')+'</ul></details>';
    return h;
  }
  function sumBlock(lot,i){
    var d=lot.data, k=counts(d), m0=(d.machines||[])[0]||{};
    var sd=A.sum(d.pieces||[],function(p){ return num(p.debit); }), longest=0;
    (d.pieces||[]).forEach(function(p){ if(num(p.bouches)>0) longest=Math.max(longest,num(p.long)); });
    var h='<div class="nxd2-ok" style="margin-top:8px">'+(d.pieces||[]).length+' pièce(s) · <b>'+k.bouches+' bouche(s)</b> · '+A.fq(A.r2(k.gaineM))+' m de gaine au soufflage'+
      (zoning(d)?' · <b>'+k.zones+' zone(s)</b>, '+k.thermostats+' thermostat(s)'+(d.zoneMat==='registres'?', '+k.registres+' registre(s) motorisé(s)':', plénum motorisé'):' · thermostat unique')+'</div>';
    if(num(m0.debit)>0&&sd>0) h+='<div class="nxd2-hint">Débits saisis : '+A.fq(Math.round(sd))+' m³/h pour '+A.fq(Math.round(num(m0.debit)))+' m³/h nominal.</div>';
    if(longest>0) h+='<div class="nxd2-hint">Bouche la plus éloignée : '+A.fq(longest)+' m de gaine'+(num(m0.pression)>0?', pression statique dispo '+A.fq(num(m0.pression))+' Pa':'')+' — à comparer aux courbes débit/pression de la fiche fabricant.</div>';
    /* repère de l'onglet Dimensionnement (vitesse ≤ 3,5 m/s) : Ø160 ≤ 290 m³/h, Ø200 ≤ 450, Ø250 ≤ 700 */
    var LIM={'160':290,'200':450,'250':700};
    (d.pieces||[]).forEach(function(p){ var b=Math.max(0,num(p.bouches)), dm=/Ø\s*(\d{3})/.exec(p.gaine||''); if(!b||!num(p.debit)||!dm||!LIM[dm[1]]) return;
      var qb=num(p.debit)/b; if(qb>LIM[dm[1]]) h+='<div class="nxd2-warn">'+esc(p.nom||'Pièce')+' : '+A.fq(Math.round(qb))+' m³/h par bouche en Ø'+dm[1]+', au-dessus du repère de ton onglet Dimensionnement ('+LIM[dm[1]]+' m³/h). À vérifier.</div>'; });
    return h;
  }
  function moBlock(lot,i){
    var d=lot.data, mode=d.moMode||'detail', rate=A.rateOf(A.cur());
    var forf=(P.forfait||{}).Gainable, hist=A.historyHours('Gainable');
    var h='<h3>Main-d\'œuvre du lot</h3><div class="frm">'+A.fSel('Mode de calcul','data.moMode',mode,[['detail','Détail en heures (tâche par tâche)'],['forfait','Forfait pose'+(forf!=null?' — '+A.money(forf):' (aucun pour le gainable)')],['heures','Heures globales']],{re:'#gamo'+i})+'</div>';
    if(mode==='detail'){
      var rows=taskRows(d), tot=A.sum(rows,function(r){ return r.h; });
      h+=rows.map(function(r){
        if(r.custom!=null) return '<div class="nxd2-task"><div class="l"><input type="text" placeholder="Autre tâche" data-k="data.custom.'+r.custom+'.l" data-t="s" value="'+esc((d.custom[r.custom]||{}).l||'')+'"></div>'+
          '<div class="v"><input type="number" step="0.25" min="0" inputmode="decimal" data-k="data.custom.'+r.custom+'.h" data-t="n" data-re="#gamo'+i+'" value="'+r.h1+'"> h '+btn('🗑','delTask',i,r.custom,'iconbtn d')+'</div></div>';
        if(r.maj) return '<div class="nxd2-task"><div class="l">'+esc(r.l)+' <span class="sub2">· sur '+A.fq(A.r2(r.q))+' h en combles</span></div>'+
          '<div class="v"><input type="number" step="5" min="0" inputmode="decimal" data-k="data.units.maj" data-t="n" data-re="#gamo'+i+'" value="'+r.h1+'"> % = <b>'+A.fq(A.r2(r.h))+' h</b></div></div>';
        return '<div class="nxd2-task"><div class="l">'+esc(r.l)+' <span class="sub2">· '+A.fq(A.r2(r.q))+' '+esc(r.u)+'</span></div>'+
          '<div class="v"><input type="number" step="0.05" min="0" inputmode="decimal" data-k="data.units.'+r.k+'" data-t="n" data-re="#gamo'+i+'" value="'+r.h1+'"> h/u = <b>'+A.fq(A.r2(r.h))+' h</b></div></div>';
      }).join('')+
      '<div class="nxd2-task tot"><div class="l">Total du lot</div><div class="v">'+A.fq(A.r2(tot))+' h · '+A.money(tot*rate)+' HT</div></div>'+
      btn('+ Ajouter une tâche','addTask',i)+
      '<div class="nxd2-hint">Préparation, achat du matériel et provision SAV sont comptés une fois pour tout le devis (onglet Récapitulatif). Mise en service, brasure et contrôle restent à tes forfaits.</div>'+
      (savedUnits()?'':'<div class="nxd2-hint">Temps unitaires : <b>valeurs de départ proposées</b>, pas encore les tiennes. Ajuste-les ; ClimPilot les retient à l\'enregistrement.</div>');
      if(forf!=null&&forf>0&&tot*rate<forf*0.85) h+='<div class="nxd2-warn">Le détail donne '+A.money(tot*rate)+', soit moins que ton forfait pose gainable ('+A.money(forf)+'). Vérifie tes temps : ce devis pourrait être sous-facturé.</div>';
    } else {
      h+='<div class="frm">'+A.fIn(mode==='forfait'?'Heures estimées (pour le gain horaire et le planning)':'Heures totales du lot','data.heures',d.heures,{t:'n',step:0.5,re:'#gamo'+i})+'</div>';
      if(mode==='forfait'&&forf!=null) h+='<div class="nxd2-hint">Forfait pose gainable : '+A.money(forf)+(rate>0?' (≈ '+A.fq(A.r2(forf/rate))+' h à '+A.money(rate)+'/h)':'')+'.</div>';
    }
    if(hist) h+='<div class="nxd2-hint">Repère — tes '+hist.n+' devis gainables précédents : '+A.fq(A.r2(hist.avg))+' h en moyenne (de '+A.fq(hist.min)+' à '+A.fq(hist.max)+' h).</div>';
    return h;
  }
  function renderPart(id,lot,i){ if(id==='gamo'+i) return moBlock(lot,i); if(id==='gasum'+i) return sumBlock(lot,i); return ''; }
  function live(lot,i){
    (lot.data.machines||[]).forEach(function(m,j){ var el=document.getElementById('nxd2mv'+i+'_'+j); if(el){ var v=0; try{ v=priceVente(num(m.achat),num(m.marge)); }catch(e){} el.textContent='Prix de vente HT : '+A.money(v); } });
    var s=document.getElementById('gasum'+i); if(s) s.innerHTML=sumBlock(lot,i);
    var mo=document.getElementById('gamo'+i); if(mo&&!mo.contains(document.activeElement)) mo.innerHTML=moBlock(lot,i);
  }

  /* ---------- actions ---------- */
  var actions={
    lib:function(l,i,a,j,k){ if(k===''||k==null) return false; var m=(MACHLIB||[])[+k]; if(!m) return false; var c0=l.data.machines[j]||{}; l.data.machines[j]=Object.assign({},c0,{marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:m.marge!=null?num(m.marge):35}); try{ toast('Unité chargée : '+((m.marque||'')+' '+(m.ref||'')).trim()); }catch(e){} },
    mem:function(l,i,a,j){ var m=l.data.machines[j]; if(!m||(!m.marque&&!m.ref)){ try{ toast('Renseigne au moins la marque ou la référence'); }catch(e){} return false; }
      var o={marque:String(m.marque||'').trim(),ref:String(m.ref||'').trim(),achat:num(m.achat),marge:num(m.marge)}; var k=MACHLIB.findIndex(function(x){ return x.marque===o.marque&&x.ref===o.ref; });
      if(k>=0) MACHLIB[k]=o; else MACHLIB.push(o); try{ save(LS.machlib,MACHLIB); toast('☆ Unité mémorisée'); }catch(e){} },
    addPiece:function(l){ var p=mkPiece(''), last=l.data.pieces[l.data.pieces.length-1]; if(last){ p.grille=last.grille; p.plenumGrille=last.plenumGrille; p.gaine=last.gaine; p.long=last.long; } l.data.pieces.push(p); },
    delPiece:function(l,i,a,j){ l.data.pieces.splice(j,1); },
    addExtra:function(l){ (l.data.extras||(l.data.extras=[])).push({nom:'',qte:1}); },
    delExtra:function(l,i,a,j){ l.data.extras.splice(j,1); },
    addTask:function(l){ (l.data.custom||(l.data.custom=[])).push({l:'',h:1}); },
    delTask:function(l,i,a,j){ l.data.custom.splice(j,1); }
  };
  A.hook('gaKw',function(li,el,v){ var l=A.cur().lots[li]; if(!l||!(num(v)>0)) return; try{ l.data.liaison=liaisonForPower(v); }catch(e){} });
  A.hook('gaPlat',function(li,el,v,chg){ var l=A.cur().lots[li]; if(!l||!chg) return;
    /* le texte « travaux non compris » suit le choix, sauf si tu l'as modifié à la main */
    var all=['moi','soustraite','exclue'].map(function(x){ return exclText(x); });
    if(!l.exclusions||all.indexOf(l.exclusions)>=0) l.exclusions=exclText(v); });

  /* ---------- visite technique ---------- */
  var VISITE=[
    {k:'empl',l:'Emplacement de l\'unité',t:'sel',o:['','Combles perdus','Combles aménagés','Faux plafond','Placard technique','Autre (voir notes)']},
    {k:'hauteur',l:'Hauteur disponible pour l\'unité (cm)',t:'num'},
    {k:'porteur',l:'Plancher / charpente porteurs, suspension possible',t:'sel',o:['','Oui','Non — renfort à prévoir','À vérifier']},
    {k:'trappe',l:'Trappe d\'accès',t:'sel',o:['','Existante (dimensions dans les notes)','À créer','Pas nécessaire']},
    {k:'circul',l:'Circulation dans les combles pour poser le réseau',t:'sel',o:['','Facile','Difficile (faible hauteur, isolant soufflé)']},
    {k:'isol',l:'État et isolation des combles',t:'txt',full:true},
    {k:'reprise',l:'Reprise : emplacement, section disponible, portes détalonnées ou non',t:'txt',full:true},
    {k:'condens',l:'Condensats',t:'sel',o:['','Gravitaire possible','Pompe nécessaire','Bac auxiliaire nécessaire (unité en combles)','Pompe + bac auxiliaire']},
    {k:'ueEmpl',l:'Emplacement du groupe extérieur',t:'sel',o:['','Au sol','En façade (mur)','Toit-terrasse','Balcon','Autre (voir notes)']},
    {k:'ueAcces',l:'Accès / hauteur de travail (groupe)',t:'sel',o:['','Normal (escabeau)','Échafaudage','Nacelle','Toiture (harnais)']},
    {k:'tableau',l:'Tableau électrique : place disponible',t:'sel',o:['','Oui','Non — à prévoir','À vérifier']},
    {k:'diff',l:'Différentiel 30 mA en place',t:'sel',o:['','Oui','Non','À vérifier']},
    {k:'distTab',l:'Distance tableau → groupe extérieur (m)',t:'num'},
    {k:'regulCable',l:'Passage des câbles vers les thermostats',t:'txt',full:true},
    {k:'copro',l:'Copropriété / façade protégée',t:'sel',o:['','Non concerné','Autorisation à obtenir par le client','Autorisation obtenue']},
    {k:'amiante',l:'Amiante : bâtiment ancien, repérage avant travaux (combles, percements) — à vérifier',t:'sel',o:['','Non concerné','À demander au client','Rapport fourni']},
    {k:'notes',l:'Notes pour ce lot',t:'area'}
  ];
  function applyVisite(lot){
    var v=lot.visite||{}, d=lot.data, msg=[];
    var em=(v.empl||'').replace(' (voir notes)','');
    if(em&&EMPL.indexOf(em)>=0&&d.emplacement!==em){ d.emplacement=em; msg.push('emplacement : '+em.toLowerCase()); }
    if(/^Existante/.test(v.trappe||'')&&d.trappe!=='existante'){ d.trappe='existante'; msg.push('trappe existante'); }
    if(v.trappe==='À créer'&&d.trappe!=='creer'){ d.trappe='creer'; msg.push('trappe à créer'); }
    if(v.trappe==='Pas nécessaire'&&d.trappe!=='aucune'){ d.trappe='aucune'; msg.push('pas de trappe'); }
    if(/^Difficile/.test(v.circul||'')&&!d.accesCombles){ d.accesCombles=true; msg.push('majoration combles difficiles'); }
    if(/Pompe/.test(v.condens||'')&&(!d.pompeType||d.pompeType==='Aucune')){ var p=(PRIX||[]).filter(function(x){ return x.cat==='Pompe'; })[0]; if(p){ d.pompeType=p.nom; d.pompeQte=Math.max(1,d.pompeQte||1); msg.push('pompe de relevage'); } }
    if(/bac auxiliaire/i.test(v.condens||'')&&!d.bacAux){ d.bacAux=true; d.secuDeb=true; msg.push('bac auxiliaire + sécurité de débordement'); }
    if(num(v.distTab)>0){ d.groupLong=num(v.distTab); msg.push('alimentation '+A.fq(d.groupLong)+' m'); }
    if(/Échafaudage|Nacelle|Toiture/.test(v.ueAcces||'')&&d.acces!=='diff'){ d.acces='diff'; msg.push('accès difficile'); }
    if(v.diff==='Non'&&!d.differential&&d.elecMode!=='none'){ d.differential=true; msg.push('différentiel'); }
    if(v.ueEmpl==='Au sol'&&(!d.support||d.support==='Aucun')){ var s=(PRIX||[]).filter(function(x){ return x.cat==='Supports'&&/sol|rubber/i.test(x.nom); })[0]; if(s){ d.support=s.nom; msg.push('support : '+s.nom); } }
    if(v.ueEmpl==='En façade (mur)'&&(!d.support||d.support==='Aucun')){ var s2=(PRIX||[]).filter(function(x){ return x.cat==='Supports'&&/mural standard/i.test(x.nom); })[0]; if(s2){ d.support=s2.nom; msg.push('support : '+s2.nom); } }
    if(v.reprise&&!(d.reprise||{}).empl){ d.reprise.empl=String(v.reprise).slice(0,60); msg.push('emplacement de reprise'); }
    return msg;
  }
  function visitePrint(lot,blank){
    var d=lot.data, dots='<span style="color:#aaa">…………</span>';
    var rows=blank?[0,1,2,3,4,5].map(function(){ return '<tr><td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td></tr>'; }).join('')
      :(d.pieces||[]).map(function(p){ return '<tr><td>'+esc(p.nom||'—')+'</td><td>'+(num(p.surface)?A.fq(p.surface)+' m²':'')+'</td><td>'+A.fq(num(p.bouches))+'</td><td>'+(zoning(d)&&p.zone?'oui':'—')+'</td><td>'+esc(p.gaine||'')+' · '+A.fq(num(p.long))+' m</td><td></td></tr>'; }).join('');
    return '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px" border="1" cellpadding="5"><tr style="background:#f1f3f5"><th>Pièce</th><th>Surface</th><th>Bouches</th><th>Zone</th><th>Gaine / longueur</th><th>Emplacement des bouches, remarques</th></tr>'+rows+'</table>'+
      '<div style="font-size:11px;margin-top:6px"><b>Reprise</b> : '+(blank?dots+dots:esc((d.reprise||{}).empl||'—'))+'</div>';
  }

  /* ---------- PDF ---------- */
  function pdf(lot){
    if(lot.data&&lot.data.legacyCopy) return '';
    var d=lot.data, k=counts(d), ps=(d.pieces||[]).filter(function(p){ return num(p.bouches)>0; }), h='';
    var td='text-align:left;padding:3px 6px;border-top:1px solid #eef1f5';
    if(ps.length){
      h+='<table style="width:100%;border-collapse:collapse;font-size:10.5px"><tr style="color:#121417"><th style="text-align:left;padding:3px 6px">Pièce</th><th style="text-align:right;padding:3px 6px">Bouches de soufflage</th><th style="text-align:left;padding:3px 6px">Régulation</th></tr>'+
        ps.map(function(p,j){ return '<tr><td style="'+td+'">'+esc(p.nom||('Pièce '+(j+1)))+(num(p.surface)?' ('+A.fq(p.surface)+' m²)':'')+'</td><td style="'+td+';text-align:right">'+A.fq(num(p.bouches))+'</td><td style="'+td+'">'+(zoning(d)?(p.zone?'zone '+(ps.filter(function(x){ return x.zone; }).indexOf(p)+1)+', thermostat '+(d.thermo==='radio'?'radio':'filaire'):'non régulée à part'):'thermostat unique')+'</td></tr>'; }).join('')+'</table>';
    }
    var info=[];
    var ms=(d.machines||[]).filter(function(m){ return m.marque||m.ref; }).map(function(m){ return esc(((m.marque||'')+' '+(m.ref||'')).trim())+(num(m.kw)?' ('+A.fq(num(m.kw))+' kW froid)':''); });
    if(ms.length) info.push('Unité : '+ms.join(', '));
    if(k.reprises) info.push('Reprise : '+k.reprises+' grille'+(k.reprises>1?'s':'')+((d.reprise||{}).grille&&/filtre/i.test(d.reprise.grille)?' avec filtre':'')+((d.reprise||{}).empl?' ('+esc(d.reprise.empl)+')':'')+(k.transferts?', '+k.transferts+' grille(s) de transfert':''));
    info.push('Régulation : '+(zoning(d)?'zonage pièce par pièce, '+k.zones+' zone'+(k.zones>1?'s':'')+(d.zoneMat==='plenum'?' (plénum motorisé)':' (registres motorisés)'):'thermostat unique')+(d.wifi?', pilotage connecté (Wi-Fi)':''));
    if(k.reprises||k.bouches) info.push('Entretien : filtre de reprise à nettoyer ou remplacer à la fréquence indiquée par la notice du fabricant');
    h+='<div style="font-size:10.5px;color:#555;margin-top:4px">'+info.join('<br>')+'</div>';
    return h;
  }
  function summary(lot){
    if(lot.data&&lot.data.legacyCopy) return 'Gainable';
    var d=lot.data, k=counts(d), m=(d.machines||[])[0]||{};
    return 'Gainable — '+(d.pieces||[]).length+' pièce'+((d.pieces||[]).length>1?'s':'')+', '+k.bouches+' bouche'+(k.bouches>1?'s':'')+(zoning(d)?', zonage '+k.zones+' zone'+(k.zones>1?'s':''):'')+((m.marque||m.ref)?' ('+((m.marque||'')+' '+(m.ref||'')).trim()+')':'');
  }
  function exclText(pl){
    var base='Peinture et reprises de finition ; création d\'une ligne électrique depuis le tableau si elle n\'est pas chiffrée ci-dessus ; autorisations de copropriété ou d\'urbanisme (à la charge du client).';
    return pl==='exclue'?'Plâtrerie : découpes des bouches et grilles, trappe de visite, coffrages (à la charge du client). '+base:base;
  }
  function exclusions(lot){ return exclText(lot&&lot.data&&lot.data.platrerie); }

  /* ---------- dictée : payload.gainable proposé par l'assistant ---------- */
  var KEEP=['machines','groupCable','groupLong','condLong','support','pompeType','pompeQte','acces','tests','mes','brasure','supp','extras','elecMode','breakerManual','breakerQte','differential','diffQte','proximity'];
  function fromAssistant(g,lot){
    /* devis dicté : on part d'un gainable « normal » (réseau, régulation…) et on garde ce que la dictée a donné */
    var src=lot.data||{}, d=defaults(), msg=[];
    KEEP.forEach(function(k){ if(src[k]!=null&&src[k]!==''&&!(Array.isArray(src[k])&&!src[k].length)) d[k]=A.clone(src[k]); });
    if(!(d.machines||[]).length) d.machines=[mkMachine()];
    d.machines.forEach(function(m){ m.kw=7.1; });
    d.pieces=[]; d.moMode='detail'; lot.data=d; lot.exclusions=exclText(d.platrerie);
    if(!g||typeof g!=='object'){ msg.push('pièces et bouches à renseigner'); return msg; }
    if(g.emplacement&&EMPL.indexOf(g.emplacement)>=0) d.emplacement=g.emplacement;
    if(g.trappe==='creer'||g.trappe==='existante') d.trappe=g.trappe;
    if(g.accesDifficile) d.accesCombles=true;
    if(['moi','soustraite','exclue'].indexOf(g.platrerie)>=0){ d.platrerie=g.platrerie; lot.exclusions=exclText(g.platrerie); }
    if(g.zonage===false) d.regul='thermostat'; else if(g.zonage===true) d.regul='zonage';
    if(g.thermostats==='radio'||g.thermostats==='filaire') d.thermo=g.thermostats;
    if(g.wifi) d.wifi=true;
    if(Array.isArray(g.pieces)&&g.pieces.length){
      d.pieces=g.pieces.slice(0,15).map(function(p){ var x=mkPiece(String(p.nom||'').slice(0,40)); x.surface=num(p.surface); x.bouches=Math.max(1,Math.round(num(p.bouches))||1); x.zone=p.zone!==false; if(num(p.longGaine)>0) x.long=num(p.longGaine); return x; });
      /* le réseau est décrit pièce par pièce : les gaines/grilles/plénums éventuellement mis en articles feraient doublon */
      var before=(d.extras||[]).length; d.extras=(d.extras||[]).filter(function(x){ var p=pr(x.nom); return !(p&&p.cat==='Gainable'); });
      if(d.extras.length<before) msg.push('articles réseau retirés (décrits pièce par pièce)');
    } else msg.push('pièces et bouches à renseigner');
    if(g.reprise&&typeof g.reprise==='object'){ if(g.reprise.emplacement) d.reprise.empl=String(g.reprise.emplacement).slice(0,60); if(num(g.reprise.transferts)>0) d.reprise.transferts=Math.round(num(g.reprise.transferts)); }
    if(g.pompe&&(!d.pompeType||d.pompeType==='Aucune')){ var p=(PRIX||[]).filter(function(x){ return x.cat==='Pompe'; })[0]; if(p){ d.pompeType=p.nom; d.pompeQte=1; } }
    if(g.bacAuxiliaire){ d.bacAux=true; d.secuDeb=true; }
    if(num(g.liaisonLong)>0) d.long=num(g.liaisonLong);
    if(num(g.puissance_kw)>0){ d.machines[0].kw=num(g.puissance_kw); try{ d.liaison=liaisonForPower(d.machines[0].kw); }catch(e){} }
    else msg.push('puissance de l\'unité à confirmer (7,1 kW par défaut)');
    return msg;
  }
  var ASSIST={type:'Gainable',consigne:'Devis de type "Gainable" : ajoute payload.gainable = {emplacement: "Combles perdus"|"Combles aménagés"|"Faux plafond"|"Placard technique", trappe: "existante"|"creer", accesDifficile: bool, puissance_kw, pieces: [{nom, surface, bouches, zone: bool, longGaine}], zonage: bool, thermostats: "filaire"|"radio", reprise: {emplacement, transferts}, pompe: bool, bacAuxiliaire: bool, platrerie: "moi"|"soustraite"|"exclue", liaisonLong, wifi: bool}. Ne mets PAS les gaines, grilles, plénums, registres ni thermostats dans extras : ClimPilot les chiffre à partir des pièces. Ce qui n\'est pas dit reste absent.'};

  /* onglet Dimensionnement : « Créer le devis gainable » ouvre le nouveau format (sauf si l'ancien formulaire est choisi dans les Paramètres) */
  (function(){
    var o=window.devisFromDim; if(typeof o!=='function'||o._ga) return;
    var w=function(type,kit){
      try{
        if(kit==='gain'&&localStorage.getItem('cpnext_d2_on')!=='0'){
          var g=function(id){ var e=document.getElementById(id); return e?num(e.value):0; };
          var kw=g('dg_p'), dt=g('dg_dt')||10, n=Math.min(15,Math.max(1,Math.round(g('dg_n'))||1));
          var Q=kw>0?kw*1000/(0.34*dt):0;   /* même méthode que l'onglet Dimensionnement */
          var d=NXD2.newDevis(MOD), lot=d.lots[0];
          if(kw>0){ lot.data.machines[0].kw=kw; try{ lot.data.liaison=liaisonForPower(kw); }catch(e){} }
          lot.data.pieces=[]; for(var j=0;j<n;j++){ var p=mkPiece('Pièce '+(j+1)); if(Q>0) p.debit=Math.round(Q/n); lot.data.pieces.push(p); }
          NXD2.derive(d);
          NXD2.open(d,{tab:'lots',dirty:true,banner:'Pré-rempli depuis le Dimensionnement : '+A.fq(kw)+' kW, '+n+' bouche(s) de '+A.fq(Math.round(Q/n))+' m³/h, une par pièce. Nomme les pièces, regroupe les bouches et vérifie les longueurs : rien n\'est définitif.'});
          return;
        }
      }catch(e){}
      return o.apply(this,arguments);
    }; w._ga=true; window.devisFromDim=w;
  })();

  (function(){ if(document.getElementById('gaStyle')) return; var st=document.createElement('style'); st.id='gaStyle';
    st.textContent='@media(min-width:861px){.frm.ga-piece{grid-template-columns:repeat(4,minmax(0,1fr))}.frm.ga-piece .full{grid-column:span 2}}'+
      '.frm.ga-piece>label{align-self:end;min-width:0}'+
      '@media(max-width:860px){.frm.ga-piece{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}}';
    (document.head||document.documentElement).appendChild(st); })();

  NXD2.register({
    id:MOD, defaults:defaults, fromLegacy:fromLegacy, compute:compute, render:render, renderPart:renderPart, live:live, actions:actions,
    visite:VISITE, applyVisite:applyVisite, visitePrint:visitePrint, pdf:pdf, summary:summary, exclusions:exclusions,
    typeLabel:function(){ return 'Gainable'; },
    isLegacyType:function(t){ return t==='Gainable'; },
    remember:function(lot){ return {units:unitsOf(lot.data||{})}; },
    fromAssistant:fromAssistant, assistant:ASSIST, seed:seed,
    _taskRows:taskRows, _counts:counts, UNITS_DEF:UNITS_DEF, SEED:SEED, N:N
  });
})();
