/* ============================================================
   ClimPilot Next — next-objectifs.js  (couche additive, 1.11 — 11/10/2026)
   « Objectifs & feux » : le plan d'action de l'entreprise DANS ClimPilot.

   - Objectif de chiffre d'affaires HT mois par mois sur 3 ans, recalculé depuis des hypothèses simples
     (mêmes formules que le fichier « Plan_Objectifs_2027-2030.xlsx » du 09/10/2026).
   - Plancher du mois = CA minimum pour payer charges + ta paie (+ apprenti / technicien quand ils sont là),
     cotisations au taux du profil fiscal (next-taux.js : nxCotisPct), provision camion activable.
   - Réalisé = factures émises HT (même source que le pack comptable : essais exclus, avoirs déduits).
   - Feux : lancement, passage en société, apprenti, technicien. Chaque condition dit si elle est
     calculée par ClimPilot ou cochée par toi. Ce sont des RÈGLES DE GESTION PROPOSÉES, pas des lois,
     sauf les deux règles légales citées avec leur source :
       * maître d'apprentissage : diplôme du domaine + 1 an d'expérience (art. R6223-22 du Code du travail,
         https://code.travail.gouv.fr/code-du-travail/r6223-22) ;
       * livre des recettes : chronologique, montant, client, mode de règlement, références des factures,
         total tous les 3 mois, conservation 10 ans (https://entreprendre.service-public.gouv.fr/vosdroits/F23266, vérifié le 07/09/2026).
   - Coût d'un salarié : ESTIMATION 2026 (calcul sur les taux publiés : réduction générale, caisse de congés
     BTP Nord-Ouest 20,70 %, AT 3,77 %) — à refaire sur mon-entreprise.urssaf.fr avant toute embauche.
   - « Pour la comptable » : quoi envoyer et quand, contrôles avant envoi, exports (next-regime.js).
   Stockage : cpnext_objectifs (synchronisé). Aucune donnée envoyée ailleurs.
   ============================================================ */
(function(){
  'use strict';
  var KEY='cpnext_objectifs', VUE='nx_obj';
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}

  /* ---------- hypothèses du plan (modifiables dans l'écran) ---------- */
  var DEF={
    debut:'',                 // début du plan (vide = date de début du profil fiscal, sinon 01/07/2027)
    tauxA1:55,tauxA2:57,tauxA3:60, // € HT / h facturés aux clients directs, par année du plan
    tauxST:45,                // € HT / h en sous-traitance
    paie:1750,                // ce que tu te verses par mois
    chargesFixes:14950,       // € / an (assurances, téléphone, carburant, repas…)
    variables:500,            // € / mois
    camionActif:true,camionMontant:600,camionMois:24, // provision camion (même si rien n'est à rembourser)
    fraisSociete:2400,        // € / an une fois en société (comptable, banque…) — hypothèse
    chargesDirigeant:45,      // % de ta paie une fois en société (gérant majoritaire d'EURL : ordre de grandeur)
    apprentiDate:'',apprentiCout:13200,
    techDate:'',
    societeDate:'',diplomeDate:'',
    tresoMontant:null,tresoDate:'',
    checks:{},hist:{},
    sim:{brut:2300,camion:0,fact:70,marge:20,margeBrute:50,augm:100},
    maj:0
  };
  var PLAN={heuresAn:6*235, depAn:11000, appH:30, appTaux:35, hPayees:1607, prodDebut:0.6, semaineH:30};
  PLAN.cap=PLAN.heuresAn/12; PLAN.deph=PLAN.depAn/PLAN.heuresAn;

  /* ---------- outils ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function num(v){ var n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isFinite(n)?n:0; }
  function e0(n){ try{ return eur0(n); }catch(e){ return Math.round(Number(n)||0).toLocaleString('fr-FR')+' €'; } }
  function e2(n){ try{ return eur(n); }catch(e){ return r2(n).toFixed(2).replace('.',',')+' €'; } }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } }
  function iso(y,m,d){ var x=new Date(y,m,d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  function okDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')); }
  var MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var MOISL=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  function ym(s){ return String(s||'').slice(0,7); }
  function labMois(k,long){ var y=+k.slice(0,4),m=+k.slice(5,7); return (long?MOISL:MOIS)[m-1]+' '+y; }
  function fr(s){ return okDate(s)?new Date(s+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function joursEntre(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
  function say(m){ try{ toast(m); }catch(e){} }

  /* ---------- état ---------- */
  function st(){
    var o={}; try{ o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ o={}; }
    var r=Object.assign({},DEF,o);
    r.sim=Object.assign({},DEF.sim,o.sim||{}); r.checks=Object.assign({},o.checks||{}); r.hist=Object.assign({},o.hist||{});
    return r;
  }
  function stSave(o){ o.maj=Date.now(); try{ save(KEY,o); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(o)); }catch(_){} } }
  window.nxobjEtat=st;

  /* début du plan : réglage de l'écran > date de début du profil fiscal > 01/07/2027 */
  function debut(o){
    o=o||st(); if(okDate(o.debut)) return o.debut.slice(0,8)+'01';
    try{ var p=window.nxFiscalProfil&&nxFiscalProfil(); if(p&&okDate(p.debut)) return p.debut.slice(0,8)+'01'; }catch(e){}
    return '2027-07-01';
  }
  function moisDate(m,o){ var d=debut(o); return iso(+d.slice(0,4),+d.slice(5,7)-1+(m-1),1); }
  function indexMois(dateISO,o){ if(!okDate(dateISO)) return 0; var d=debut(o); return (+dateISO.slice(0,4)-+d.slice(0,4))*12+(+dateISO.slice(5,7)-+d.slice(5,7))+1; }
  /* actif à partir du mois de la date (une date avant le début du plan compte dès le mois 1) ; renvoie le mois de début, 0 sinon */
  function actifDepuis(dateISO,m,o){ if(!okDate(dateISO)) return 0; var i=indexMois(dateISO,o); return m>=i?Math.max(1,i):0; }
  function enSociete(m,o){ return !!actifDepuis(o.societeDate,m,o); }

  /* ---------- salarié : coût estimé ---------- */
  /* coût employeur annuel (salaire + charges + caisse congés BTP), estimation 2026, interpolation linéaire */
  var COUT=[[1867,26400],[2000,29300],[2300,36350],[2427,39200],[2600,43000],[2987,51200]];
  function coutEmployeur(brut){
    brut=Number(brut)||0; var a,b,i;
    if(brut<=COUT[0][0]){ a=COUT[0]; b=COUT[1]; }
    else if(brut>=COUT[COUT.length-1][0]){ a=COUT[COUT.length-2]; b=COUT[COUT.length-1]; }
    else for(i=0;i<COUT.length-1;i++) if(brut>=COUT[i][0]&&brut<=COUT[i+1][0]){ a=COUT[i]; b=COUT[i+1]; break; }
    return Math.round(a[1]+(brut-a[0])*(b[1]-a[1])/(b[0]-a[0]));
  }
  function simul(o){
    var s=(o||st()).sim, emp=coutEmployeur(s.brut), camion=Number(s.camion)?13600:0;
    var autres=360+101+3600+1000+400+140+300+450; /* mutuelle, médecine, indemnités repas/trajet, outillage, EPI, formation, paie, téléphone */
    var C=emp+camion+autres, H=PLAN.hPayees*(num(s.fact)/100), cH=H>0?C/H:0, pmin=cH/(1-Math.min(0.9,num(s.marge)/100));
    var taux=tauxAnnee(3,o||st());
    return {emp:emp,camion:camion,autres:autres,cout:C,heuresFact:H,coutHeure:cH,prixMin:pmin,taux:taux,
      rentable:taux>=pmin, heuresMinMois:taux>0?C/12/taux:0, caMinMois:num(s.margeBrute)>0?C/(num(s.margeBrute)/100)/12:0,
      augmAn:num(s.augm)*12*1.9};
  }
  window.nxobjSimul=function(){ return simul(st()); };
  window.nxobjCoutEmployeur=coutEmployeur;

  /* ---------- objectifs et plancher ---------- */
  function tauxAnnee(y,o){ return num(y<=1?o.tauxA1:y===2?o.tauxA2:o.tauxA3); }
  function remplissage(m,tech){ return m<=3?0.50:m<=6?0.65:m<=12?0.80:m<=24?0.85:(tech?0.75:0.85); }
  function sousTraitance(m){ return m<=6?0.70:m<=12?0.50:m<=24?0.25:0.10; }
  function objectif(m,o){
    o=o||st(); var y=Math.ceil(m/12), tech=actifDepuis(o.techDate,m,o), app=actifDepuis(o.apprentiDate,m,o);
    var h=PLAN.cap*remplissage(m,!!tech), stp=sousTraitance(m), td=tauxAnnee(y,o);
    var mo=h*(stp*num(o.tauxST)+(1-stp)*td);
    var techH=tech?PLAN.hPayees*(num(o.sim.fact)/100)/12*((m-tech)<3?PLAN.prodDebut:1):0;
    var dep=(h*(1-stp)+(Number(o.sim.camion)?techH:0))*PLAN.deph;
    var appCA=app?PLAN.appH*PLAN.appTaux:0;
    return {m:m,mois:ym(moisDate(m,o)),annee:y,heures:h,sousTraitance:stp,ca:r2(mo+dep+appCA+techH*td),toi:r2(mo+dep),apprenti:appCA,technicien:r2(techH*td)};
  }
  function cotis(dateISO){ try{ if(window.nxCotisPct) return Number(nxCotisPct(dateISO))||0; }catch(e){} return 23.68; }
  function plancher(m,o){
    o=o||st(); var d=moisDate(m,o), soc=enSociete(m,o), app=actifDepuis(o.apprentiDate,m,o), tech=actifDepuis(o.techDate,m,o);
    var charges=num(o.chargesFixes)/12+(o.camionActif&&m<=num(o.camionMois)?num(o.camionMontant):0)+num(o.variables)+(soc?num(o.fraisSociete)/12:0);
    var paie=num(o.paie)*(soc?1+num(o.chargesDirigeant)/100:1);
    var equipe=(app?num(o.apprentiCout)/12:0)+(tech?simul(o).cout/12:0);
    var t=soc?0:cotis(d)/100;
    return {m:m,charges:charges,paie:paie,equipe:equipe,taux:soc?null:cotis(d),sorties:charges+paie+equipe,montant:r2((charges+paie+equipe)/(1-t))};
  }
  window.nxobjObjectif=function(m){ return objectif(m,st()); };
  window.nxobjPlancher=function(m){ return plancher(m,st()); };

  /* ---------- réalisé (même source que le pack comptable) ---------- */
  function factures(){ try{ if(window.nxrgLignesFactures) return nxrgLignesFactures(); }catch(e){} return []; }
  function recettes(from,to){ try{ if(window.nxrgLignesRecettes) return nxrgLignesRecettes(from,to); }catch(e){} return []; }
  function impayes(){ try{ if(window.nxrgLignesImpayes) return nxrgLignesImpayes(); }catch(e){} return []; }
  function finMois(k){ return iso(+k.slice(0,4),+k.slice(5,7),0); }
  function realise(k,F){ F=F||factures(); var f=0,n=0; F.forEach(function(x){ if(ym(x.date)===k){ f+=Number(x.ht)||0; n++; } });
    var enc=recettes(k+'-01',finMois(k)).reduce(function(s,x){ return s+(Number(x.ht)||0); },0);
    return {facture:r2(f),encaisse:r2(enc),docs:n}; }
  window.nxobjRealise=function(k){ return realise(k); };

  /* travail signé : devis acceptés pas encore facturés au solde → semaines de travail (30 h facturées / semaine) */
  function carnet(){
    var h=0,n=0; try{ (DEVIS||[]).forEach(function(d){ if(d&&d.statut==='accepte'&&!d.facSolde){ var c=null; try{ c=compute(d); }catch(e){} h+=Number(c&&c.heures)||0; n++; } }); }catch(e){}
    return {heures:r2(h),devis:n,semaines:Math.round(h/PLAN.semaineH*10)/10};
  }
  window.nxobjCarnet=carnet;
  function recurrent(){ var s=0,n=0; try{ (CTR||[]).forEach(function(c){ if(c&&c.actif!==false){ s+=Number(c.prix)||0; n++; } }); }catch(e){} return {annuel:r2(s),contrats:n}; }
  function premierClient(F,depuis){ var t={},tot=0; (F||[]).forEach(function(x){ if(String(x.date)>=depuis){ var k=String(x.client||'—').trim().toLowerCase(); t[k]=(t[k]||{nom:x.client,ht:0}); t[k].ht+=Number(x.ht)||0; tot+=Number(x.ht)||0; } });
    var top=null; Object.keys(t).forEach(function(k){ if(!top||t[k].ht>top.ht) top=t[k]; }); return {nom:top?top.nom:'',part:tot>0&&top?top.ht/tot:0,total:tot}; }
  function tresoFraiche(o){ return o.tresoMontant!=null&&o.tresoMontant!==''&&okDate(o.tresoDate)&&joursEntre(o.tresoDate,today())<=45; }

  /* instantané mensuel du travail signé (pour « 3 mois de suite ») — écrit seulement si la valeur change */
  function noteHistorique(){
    var o=st(), k=ym(today()), c=carnet().semaines;
    if(o.hist[k]&&o.hist[k].carnet===c) return;
    o.hist[k]={carnet:c}; var ks=Object.keys(o.hist).sort(); while(ks.length>24){ delete o.hist[ks.shift()]; }
    stSave(o);
  }
  function moisPrec(k,n){ var y=+k.slice(0,4),m=+k.slice(5,7)-1-n; return ym(iso(y,m,1)); }

  /* CA HT ≥ plancher sur les 3 derniers mois COMPLETS du plan */
  function troisMoisAuPlancher(o,F){
    var k=ym(today()), res=[], i;
    for(i=1;i<=3;i++){ var km=moisPrec(k,i), m=indexMois(km+'-01',o); if(m<1) return {ok:null,detail:'Il faut 3 mois complets d’activité dans le plan.',mois:res}; var r=realise(km,F), p=plancher(m,o).montant; res.push({mois:km,facture:r.facture,plancher:p}); }
    var bad=res.filter(function(x){ return x.facture<x.plancher; });
    return {ok:bad.length===0,detail:res.map(function(x){ return labMois(x.mois)+' : '+e0(x.facture)+' / '+e0(x.plancher); }).join(' · '),mois:res};
  }

  /* ---------- les feux ---------- */
  function cond(ok,label,detail,source,key){ return {ok:ok,label:label,detail:detail||'',source:source||'auto',key:key||''}; }
  function couleur(cs){ if(cs.some(function(c){ return c.ok===false; })) return 'rouge'; if(cs.some(function(c){ return c.ok==null; })) return 'orange'; return 'vert'; }
  var CHECKS_LANCEMENT=[
    ['ei','Date de fermeture de ton ancienne EI retrouvée','Avis de radiation (guichet INPI / Urssaf). Elle décide si tu as droit à l’ACRE en 2027.'],
    ['urssaf','Réponse ÉCRITE de l’Urssaf sur ton droit à l’ACRE','Sans ACRE, pas d’ARCE (capital chômage). Garde la réponse.'],
    ['assurances','Devis décennale + RC pro reçus et comparés','Décennale obligatoire pour les travaux (art. L241-1 Code des assurances) ; RC pro : à voir avec ton assureur.'],
    ['aptitude','Attestation d’aptitude fluides à jour','Catégorie adaptée (et hydrocarbures / CO₂ pour le froid commercial).'],
    ['wolf','Accord écrit avec WOLF ENERGY','Heures par mois, prix, durée, déplacements payés ou non.'],
    ['comptable','Expert-comptable choisi (ou ta mère d’accord pour suivre)','Lui montrer ce fichier et le pack comptable avant de démarrer.'],
    ['banque','Compte bancaire dédié à l’activité ouvert','Obligatoire au-delà de 10 000 € de CA 2 années de suite (service-public F35991) ; conseillé dès le départ.']
  ];
  function feux(o,F,seulLancement){
    o=o||st(); F=F||factures();
    var t=today(), mNow=indexMois(t,o), E={}; try{ E=(P&&P.entreprise)||{}; }catch(e){}
    var fiscal={}; try{ fiscal=window.nxFiscalProfil?nxFiscalProfil():{}; }catch(e){}
    var pl=plancher(Math.max(1,mNow),o), sorties=pl.sorties, tf=tresoFraiche(o), T=num(o.tresoMontant);
    var trois=seulLancement?null:troisMoisAuPlancher(o,F), car=seulLancement?null:carnet(), rec=seulLancement?null:recurrent(), sim=seulLancement?null:simul(o);
    var out={};

    /* 1. lancement */
    var cl=CHECKS_LANCEMENT.map(function(c){ return cond(!!o.checks[c[0]]?true:null,c[1],c[2],'toi',c[0]); });
    cl.push(cond(String(E.mediateur||'').trim()?true:null,'Médiateur de la consommation renseigné (Paramètres)','Obligatoire avant le premier devis à un particulier.','auto'));
    cl.push(cond(okDate(fiscal.debut)?true:null,'Profil fiscal rempli (date de début d’activité)','Paramètres › Profil fiscal : il règle le taux de cotisations partout.','auto'));
    cl.push(cond(!tf?null:T>=3*sorties,'Trésorerie ≥ 3 mois de dépenses ('+e0(3*sorties)+')',tf?'Déclarée : '+e0(T)+' le '+fr(o.tresoDate)+'.':'Renseigne ta trésorerie ci-dessous (à refaire tous les 45 jours).','auto'));
    out.lancement={id:'lancement',titre:'Lancer l’entreprise',couleur:couleur(cl),conditions:cl,pill:mNow>=1&&couleur(cl)!=='vert'?'À régler':null,
      verdict:mNow>=1?'Lancée depuis le '+fr(debut(o))+'.':couleur(cl)==='vert'?'Tout est prêt pour créer.':'Pas encore : '+cl.filter(function(c){ return c.ok!==true; }).length+' point(s) à régler avant de créer.'};
    if(mNow>=1&&out.lancement.couleur!=='vert') out.lancement.verdict='Lancée — '+cl.filter(function(c){ return c.ok!==true; }).length+' point(s) encore à régler.';
    if(seulLancement) return out;

    /* 2. société (passage au réel) */
    var soc=okDate(o.societeDate)&&o.societeDate<=t;
    var micro={}; try{ micro=window.nxEtatMicro?nxEtatMicro(t):{}; }catch(e){}
    var embauche=[o.apprentiDate,o.techDate].filter(okDate).sort()[0]||'';
    var cs=[
      cond(soc?true:(embauche?false:true),'Au réel ou en société avant ta première embauche',soc?'En société / au réel depuis le '+fr(o.societeDate)+'.':embauche?'Embauche prévue le '+fr(embauche)+' : en micro, son salaire ne réduit ni tes cotisations ni ton impôt.':'Aucune embauche prévue pour l’instant.','auto'),
      cond(micro.statut==='depasse'?false:micro.statut==='attention'?null:true,'Plafond micro (prestations) loin d’être atteint',micro.message||'—','auto')
    ];
    out.societe={id:'societe',titre:'Passer en société (EURL / SASU)',couleur:soc?'vert':couleur(cs),conditions:cs,pill:soc?'Fait':couleur(cs)==='vert'?'Pas nécessaire':couleur(cs)==='orange'?'À étudier':'Avant l’embauche',
      verdict:soc?'Fait : en société / au réel depuis le '+fr(o.societeDate)+'.':couleur(cs)==='vert'?'Pas nécessaire pour l’instant.':'À étudier avec ton expert-comptable maintenant (simulation micro / EURL / SASU dans « Statut & régime »).'};

    /* 3. apprenti */
    var dip=okDate(o.diplomeDate), unAn=dip?iso(+o.diplomeDate.slice(0,4)+1,+o.diplomeDate.slice(5,7)-1,+o.diplomeDate.slice(8,10)):'';
    var ref=okDate(o.apprentiDate)?o.apprentiDate:t;
    var ca=[
      cond(!dip?null:ref>=unAn,'1 an d’expérience après ton diplôme (règle légale)',dip?'Diplôme le '+fr(o.diplomeDate)+' → maître d’apprentissage possible à partir du '+fr(unAn)+'. L’apprentissage ne compte pas (art. R6223-22 Code du travail).':'Renseigne la date d’obtention de ton BTS ci-dessous.','auto'),
      cond(okDate(o.societeDate)&&o.societeDate<=ref,'Au réel ou en société à son arrivée',okDate(o.societeDate)?'Passage prévu le '+fr(o.societeDate)+'.':'Renseigne la date de passage en société / au réel.','auto'),
      cond(trois.ok,'CA HT au-dessus du plancher les 3 derniers mois',trois.detail,'auto'),
      cond(car.semaines>=4,'Au moins 4 semaines de travail signé','Aujourd’hui : '+car.semaines.toLocaleString('fr-FR')+' semaine(s) ('+car.devis+' devis acceptés pas encore facturés).','auto'),
      cond(!tf?null:T>=3*(sorties+num(o.apprentiCout)/12),'Trésorerie ≥ 3 mois de dépenses, apprenti compris ('+e0(3*(sorties+num(o.apprentiCout)/12))+')',tf?'Déclarée : '+e0(T)+' le '+fr(o.tresoDate)+'.':'Renseigne ta trésorerie ci-dessous.','auto')
    ];
    out.apprenti={id:'apprenti',titre:'Prendre un apprenti',couleur:couleur(ca),conditions:ca,pill:couleur(ca)==='vert'?'Feu vert':null,
      verdict:couleur(ca)==='vert'?'Feu vert : tu peux chercher ton apprenti.':couleur(ca)==='orange'?'Presque : complète les points en orange.':'Pas encore.',
      info:'Coût estimé ≈ '+e0(num(o.apprentiCout))+' / an (18-20 ans, 1re année). Aide à l’embauche 2026 : 4 500 € la 1re année pour un BTS, 5 000 € pour un CAP ou bac ; 2027 non voté.'};

    /* 4. technicien */
    var ks=[ym(t),moisPrec(ym(t),1),moisPrec(ym(t),2)], hs=ks.map(function(k){ return o.hist[k]?o.hist[k].carnet:null; });
    var carnetOk=car.semaines<6?false:hs.some(function(v){ return v==null; })?null:hs.every(function(v){ return v>=6; });
    var refT=okDate(o.techDate)?o.techDate:t;
    var ct=[
      cond(carnetOk,'Au moins 6 semaines de travail signé, 3 mois de suite','Aujourd’hui : '+car.semaines.toLocaleString('fr-FR')+' sem. · relevés : '+ks.map(function(k,i){ return labMois(k)+' '+(hs[i]==null?'—':hs[i].toLocaleString('fr-FR')); }).join(' · ')+'. ClimPilot note la valeur à chaque ouverture.','auto'),
      cond(trois.ok,'CA HT au-dessus du plancher les 3 derniers mois',trois.detail,'auto'),
      cond(rec.annuel>=0.5*sim.cout,'Contrats d’entretien ≥ 50 % de son coût ('+e0(0.5*sim.cout)+' / an)','Aujourd’hui : '+e0(rec.annuel)+' / an sur '+rec.contrats+' contrat(s) actif(s).','auto'),
      cond(!tf?null:T>=3*sorties+3*sim.cout/12,'Trésorerie ≥ 3 mois de tes dépenses + 3 mois de son coût ('+e0(3*sorties+3*sim.cout/12)+')',tf?'Déclarée : '+e0(T)+' le '+fr(o.tresoDate)+'.':'Renseigne ta trésorerie ci-dessous.','auto'),
      cond(okDate(o.societeDate)&&o.societeDate<=refT,'Au réel ou en société à son arrivée',okDate(o.societeDate)?'Passage prévu le '+fr(o.societeDate)+'.':'Renseigne la date de passage en société / au réel.','auto'),
      cond(sim.rentable,'Ton taux horaire couvre son coût ('+e2(sim.taux)+' ≥ '+e2(sim.prixMin)+')','Prix minimum calculé dans « Combien coûte un salarié ? » ci-dessous.','auto')
    ];
    out.technicien={id:'technicien',titre:'Embaucher un technicien',couleur:couleur(ct),conditions:ct,pill:couleur(ct)==='vert'?'Feu vert':null,
      verdict:couleur(ct)==='vert'?'Feu vert : tu peux recruter.':couleur(ct)==='orange'?'Presque : complète les points en orange.':'Pas encore.',
      info:'Coût complet estimé ≈ '+e0(sim.cout)+' / an ('+(Number(o.sim.camion)?'avec son camion':'en binôme dans ton camion')+'). À refaire sur le simulateur Urssaf avant d’embaucher.'};
    return out;
  }
  window.nxobjFeux=function(){ return feux(st()); };

  /* ---------- contrôles avant envoi à la comptable ---------- */
  function controles(F){
    F=F||factures(); var out=[];
    var demo=false; try{ var md=window.nxEmisMode&&nxEmisMode(); demo=!!(md&&!md.demarre); }catch(e){}
    out.push(cond(!demo,'Facturation réelle démarrée',demo?'Mode démonstration : les exports ne contiennent que des documents d’essai — ne pas envoyer.':'Les essais sont exclus des exports.','auto'));
    var sans=recettes('','').filter(function(r){ return r.sansFacture; }).length;
    out.push(cond(sans===0,'Chaque encaissement est rattaché à une facture',sans?sans+' encaissement(s) sans facture : à corriger avant envoi.':'OK.','auto'));
    /* série continue par préfixe et par année (F-AAAA-NNN, AV-AAAA-NNN) */
    var g={}; F.forEach(function(x){ var mm=/^(F|AV)-(\d{4})-(\d+)$/.exec(String(x.num||'')); if(mm){ var k=mm[1]+'-'+mm[2]; (g[k]=g[k]||[]).push(+mm[3]); } });
    var trous=[]; Object.keys(g).forEach(function(k){ var a=g[k].sort(function(x,y){ return x-y; }); for(var i=1;i<a.length;i++){ if(a[i]===a[i-1]) trous.push(k+' doublon n°'+a[i]); else if(a[i]>a[i-1]+1) trous.push(k+' manque n°'+(a[i-1]+1)+(a[i]-a[i-1]>2?' à '+(a[i]-1):'')); } });
    out.push(cond(trous.length===0,'Numérotation des factures continue, sans trou ni doublon',trous.length?trous.slice(0,4).join(' · '):Object.keys(g).length?'OK.':'Aucune facture réelle pour l’instant.','auto'));
    var vieux=impayes().filter(function(i){ return i.days>60; });
    out.push(cond(vieux.length===0,'Aucun impayé de plus de 60 jours',vieux.length?vieux.length+' facture(s), '+e0(vieux.reduce(function(s,i){ return s+i.ttc; },0))+' — relance-les (Factures & recettes).':'OK.','auto'));
    return out;
  }
  window.nxobjControles=function(){ return controles(); };

  /* ---------- rendu ---------- */
  var CSS='#v-nx_obj .nxo-row{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));align-items:start}'
    +'#v-nx_obj .nxo-pill{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:12px;padding:3px 10px;border-radius:999px;white-space:nowrap}'
    +'#v-nx_obj .nxo-vert{background:var(--green-soft,#e7f6ee);color:var(--green,#16794a)}#v-nx_obj .nxo-orange{background:var(--orange-soft,#fff3e0);color:var(--orange,#b45309)}#v-nx_obj .nxo-rouge{background:var(--red-soft,#fdecec);color:var(--red,#b42318)}#v-nx_obj .nxo-gris{background:#f1f3f5;color:#555}'
    +'#v-nx_obj .nxo-dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}#v-nx_obj .nxo-dot.vert{background:var(--green,#16794a)}#v-nx_obj .nxo-dot.orange{background:var(--orange,#b45309)}#v-nx_obj .nxo-dot.rouge{background:var(--red,#b42318)}#v-nx_obj .nxo-dot.gris{background:#c3c8cf}'
    +'#v-nx_obj .nxo-feu h3{margin:0 0 4px;font-size:15px;display:flex;justify-content:space-between;gap:8px;align-items:center}#v-nx_obj .nxo-feu .v{font-weight:600;margin:4px 0 8px}'
    +'#v-nx_obj .nxo-c{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line,#e5e7eb);font-size:13px}#v-nx_obj .nxo-c .i{flex:none;width:18px;text-align:center;font-weight:800}#v-nx_obj .nxo-c .d{color:var(--muted,#667085);font-size:12px;margin-top:2px}#v-nx_obj .nxo-c .s{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#667085)}'
    +'#v-nx_obj .nxo-c input[type=checkbox]{width:18px;height:18px;margin:1px 0 0;flex:none}'
    +'#v-nx_obj .nxo-bar{position:relative;height:12px;background:#eef1f4;border-radius:6px;overflow:visible;margin:10px 0 4px}#v-nx_obj .nxo-bar .f{position:absolute;left:0;top:0;bottom:0;border-radius:6px}#v-nx_obj .nxo-bar .p{position:absolute;top:-4px;bottom:-4px;width:2px;background:#344054}'
    +'#v-nx_obj table.nxo-t{width:100%;border-collapse:collapse;font-size:13px}#v-nx_obj table.nxo-t th,#v-nx_obj table.nxo-t td{padding:7px 6px;border-bottom:1px solid var(--line,#e5e7eb);text-align:right;white-space:nowrap}#v-nx_obj table.nxo-t th:first-child,#v-nx_obj table.nxo-t td:first-child{text-align:left}#v-nx_obj table.nxo-t tr.cur td{background:var(--blue-soft,#eef4ff);font-weight:700}'
    +'#v-nx_obj .nxo-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    +'#v-nx_obj .nxo-big{font-size:15px;line-height:1.5}#v-nx_obj .nxo-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}#v-nx_obj .nxo-tabs button.on{outline:2px solid var(--ink,#121417)}'
    +'#v-nx_obj .nxo-form{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}#v-nx_obj .nxo-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--muted,#667085)}#v-nx_obj .nxo-form input,#v-nx_obj .nxo-form select{font-size:15px}'
    +'#v-nx_obj .nxo-note{font-size:12px;color:var(--muted,#667085);line-height:1.55;margin-top:8px}'
    +'#nxobjDash .nxo-l{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}#nxobjDash .nxo-l b{font-size:15px}'
    +'@media(max-width:520px){#v-nx_obj table.nxo-t th:nth-child(5),#v-nx_obj table.nxo-t td:nth-child(5){display:none}#v-nx_obj table.nxo-t th,#v-nx_obj table.nxo-t td{padding:7px 4px}}';
  function css(){ if(document.getElementById('nxobjCss')) return; var s=document.createElement('style'); s.id='nxobjCss'; s.textContent=CSS; document.head.appendChild(s); }

  var NOM={vert:'Vert',orange:'À compléter',rouge:'Pas encore',gris:'—'};
  function pill(c,txt){ return '<span class="nxo-pill nxo-'+c+'"><span class="nxo-dot '+c+'"></span>'+esc(txt||NOM[c])+'</span>'; }
  function ico(ok){ return ok===true?'<span class="i" style="color:var(--green,#16794a)">✓</span>':ok===false?'<span class="i" style="color:var(--red,#b42318)">✕</span>':'<span class="i" style="color:var(--orange,#b45309)">?</span>'; }
  function carteFeu(f){
    return '<div class="card nxo-feu" data-feu="'+esc(f.id||'')+'"><h3><span>'+esc(f.titre)+'</span>'+pill(f.couleur,f.pill)+'</h3><div class="v">'+esc(f.verdict)+'</div>'
      +f.conditions.map(function(c){
        var box=c.source==='toi'?'<input type="checkbox" '+(c.ok===true?'checked':'')+' onchange="nxobjCheck(\''+esc(c.key)+'\',this.checked)" aria-label="'+esc(c.label)+'">':ico(c.ok);
        return '<div class="nxo-c">'+box+'<div><div>'+esc(c.label)+'</div>'+(c.detail?'<div class="d">'+esc(c.detail)+'</div>':'')+'</div></div>';
      }).join('')
      +(f.info?'<div class="nxo-note">'+esc(f.info)+'</div>':'')+'</div>';
  }
  var ANNEE=null, PERIODE='mois';
  function render(){
    var host=document.getElementById('nxobj'); if(!host) return;
    css(); try{ noteHistorique(); }catch(e){}
    var o=st(), t=today(), m=indexMois(t,o), F=factures(), FX=feux(o,F), sim=simul(o), html='';

    /* A. ce mois-ci */
    if(m<1){
      var j=joursEntre(t,debut(o)), o1=objectif(1,o);
      html+='<div class="card"><h2>Avant le lancement</h2><div class="nxo-big">Début du plan le <b>'+fr(debut(o))+'</b> — dans <b>'+j+' jours</b>.<br>Premier objectif : <b>'+e0(o1.ca)+' HT</b> en '+labMois(o1.mois,true)+' (plancher '+e0(plancher(1,o).montant)+').</div>'
        +'<div class="nxo-note">Maintenant, le plus utile : la liste « Lancer l’entreprise » ci-dessous. Le suivi mois par mois démarrera tout seul le '+fr(debut(o))+'.</div></div>';
    } else if(m>36){
      html+='<div class="card"><h2>Ton plan de 3 ans est terminé</h2><div class="nxo-big">Refais tes objectifs avec tes vrais chiffres (et ton comptable) : change la date de début du plan dans « Mes réglages ».</div></div>';
    } else {
      var k=ym(t), ob=objectif(m,o), pl=plancher(m,o), r=realise(k,F), coul=r.facture>=ob.ca?'vert':r.facture>=pl.montant?'orange':'rouge';
      var manque=Math.max(0,ob.ca-r.facture), tx=tauxAnnee(ob.annee,o), fin=finMois(k), restJ=joursEntre(t,fin)+1;
      var max=Math.max(ob.ca,r.facture,pl.montant)*1.05||1;
      var conseil=r.facture>=ob.ca?'Objectif atteint : '+e0(r.facture-ob.ca)+' au-dessus. Continue à signer des contrats d’entretien.'
        :'Il te manque <b>'+e0(manque)+' HT</b> d’ici le '+fr(fin)+' ('+restJ+' jour'+(restJ>1?'s':'')+'), soit ≈ <b>'+Math.ceil(manque/(tx||1))+' h</b> facturées à '+e0(tx)+'/h.'
          +(r.facture<pl.montant?' <span style="color:var(--red,#b42318);font-weight:700">Sous le plancher : sans rattrapage, tes charges et ta paie se paient avec ta trésorerie.</span>':'');
      html+='<div class="card"><h2 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>'+esc(labMois(k,true))+' — mois '+m+' / 36</span>'+pill(coul,coul==='vert'?'Objectif atteint':coul==='orange'?'Au-dessus du plancher':'Sous le plancher')+'</h2>'
        +'<div class="kpis"><div class="kpi blue"><div class="lab">Objectif du mois<span>HT</span></div><div class="val">'+e0(ob.ca)+'</div></div>'
        +'<div class="kpi"><div class="lab">Facturé ce mois<span>HT</span></div><div class="val">'+e0(r.facture)+'</div></div>'
        +'<div class="kpi warn"><div class="lab">Plancher<span>min.</span></div><div class="val">'+e0(pl.montant)+'</div></div>'
        +'<div class="kpi"><div class="lab">Encaissé ce mois<span>HT</span></div><div class="val">'+e0(r.encaisse)+'</div></div></div>'
        +'<div class="nxo-bar" title="Facturé / objectif — trait = plancher"><div class="f" style="width:'+Math.min(100,r.facture/max*100)+'%;background:var(--'+(coul==='vert'?'green':coul==='orange'?'orange':'red')+',#555)"></div><div class="p" style="left:'+Math.min(100,pl.montant/max*100)+'%"></div></div>'
        +'<div class="nxo-big" style="margin-top:8px">'+conseil+'</div>'
        +'<div class="nxo-note">Facturé = factures émises dans le mois, HT, essais exclus, avoirs déduits. Plancher = charges ('+e0(pl.charges)+') + ta paie ('+e0(pl.paie)+')'+(pl.equipe?' + équipe ('+e0(pl.equipe)+')':'')+(pl.taux!=null?', cotisations '+String(pl.taux).replace('.',',')+' % (profil fiscal) comprises':'')+'.</div></div>';
    }

    /* B. les feux */
    var ordre=m>=1?[FX.apprenti,FX.technicien,FX.societe,FX.lancement]:[FX.lancement,FX.societe,FX.apprenti,FX.technicien];
    html+='<h2 style="margin:6px 0 4px">Mes feux</h2><div class="nxo-note" style="margin:0 0 10px"><b style="color:var(--green,#16794a)">✓</b> rempli · <b style="color:var(--red,#b42318)">✕</b> pas rempli · <b style="color:var(--orange,#b45309)">?</b> il manque une info — calculés par ClimPilot. Les cases à cocher, c’est toi. Règles de gestion proposées, sauf la règle légale du maître d’apprentissage.</div><div class="nxo-row">'+ordre.map(carteFeu).join('')+'</div>';

    /* C. à renseigner */
    var inp=function(id,lab,type,val,aide){ return '<label>'+esc(lab)+'<input id="nxo_'+id+'" type="'+type+'" value="'+esc(val==null?'':val)+'" '+(type==='number'?'inputmode="decimal" step="any"':'')+' onchange="nxobjSet(\''+id+'\',this.value)">'+(aide?'<span style="font-weight:400">'+esc(aide)+'</span>':'')+'</label>'; };
    html+='<div class="card"><h2>À renseigner</h2><div class="nxo-form">'
      +inp('tresoMontant','Ma trésorerie aujourd’hui (€)','number',o.tresoMontant,o.tresoDate?'Mise à jour le '+fr(o.tresoDate)+(tresoFraiche(o)?'':' — à refaire'):'Solde du compte pro + réserve')
      +inp('diplomeDate','Date d’obtention de mon BTS','date',o.diplomeDate,'Pour la règle du maître d’apprentissage')
      +inp('societeDate','Passage en société / au réel','date',o.societeDate,'Vide = encore en micro')
      +inp('apprentiDate','Arrivée de l’apprenti (prévue)','date',o.apprentiDate,'Vide = pas d’apprenti')
      +inp('techDate','Arrivée du technicien (prévue)','date',o.techDate,'Vide = pas de technicien')
      +'</div><div class="nxo-note">Les dates d’arrivée ajoutent leur coût au plancher et leur chiffre d’affaires à l’objectif, à partir de ce mois-là. Aucune n’embauche personne : elles servent à simuler.</div></div>';

    /* D. le plan sur 3 ans */
    var aCur=m>=1&&m<=36?Math.ceil(m/12):1; if(ANNEE==null) ANNEE=aCur;
    var lignes='', y=ANNEE, i, tot={o:0,p:0,f:0};
    for(i=(y-1)*12+1;i<=y*12;i++){
      var ob2=objectif(i,o), p2=plancher(i,o), passe=i<=m, r2x=passe?realise(ob2.mois,F):null, c2=!passe?'gris':r2x.facture>=ob2.ca?'vert':r2x.facture>=p2.montant?'orange':'rouge';
      tot.o+=ob2.ca; tot.p+=p2.montant; if(r2x) tot.f+=r2x.facture;
      lignes+='<tr'+(i===m?' class="cur"':'')+'><td>'+esc(labMois(ob2.mois))+'</td><td>'+e0(ob2.ca)+'</td><td>'+e0(p2.montant)+'</td><td>'+(r2x?e0(r2x.facture):'—')+'</td><td>'+(r2x?(r2x.facture-ob2.ca>=0?'+':'')+e0(r2x.facture-ob2.ca):'—')+'</td><td><span class="nxo-dot '+c2+'"></span></td></tr>';
    }
    html+='<div class="card"><h2>Mon plan sur 3 ans</h2><div class="nxo-tabs">'+[1,2,3].map(function(a){ return '<button class="btn-ghost btn-sm'+(a===ANNEE?' on':'')+'" onclick="nxobjAnnee('+a+')">Année '+a+' · '+labMois(ym(moisDate((a-1)*12+1,o)))+'</button>'; }).join('')+'</div>'
      +'<div class="nxo-scroll"><table class="nxo-t"><thead><tr><th>Mois</th><th>Objectif HT</th><th>Plancher</th><th>Facturé HT</th><th>Écart</th><th></th></tr></thead><tbody>'+lignes
      +'<tr><td><b>Total année '+y+'</b></td><td><b>'+e0(tot.o)+'</b></td><td><b>'+e0(tot.p)+'</b></td><td><b>'+(m>=(y-1)*12+1?e0(tot.f):'—')+'</b></td><td></td><td></td></tr></tbody></table></div>'
      +'<div class="nxo-note">Objectif calculé : 6 h facturables / jour, 235 jours / an ; agenda rempli à 50 % puis 65 % les 6 premiers mois, 80 % le reste de l’année 1, 85 % ensuite (75 % quand tu encadres un technicien) ; sous-traitance 70 % → 10 % de tes heures ; déplacements 11 000 € / an à pleine charge. Hypothèses du plan d’action du 09/10/2026, modifiables dans « Mes réglages ».</div></div>';

    /* E. combien coûte un salarié */
    var s=o.sim, sin=function(id,lab,val,aide){ return '<label>'+esc(lab)+'<input id="nxo_sim_'+id+'" type="number" inputmode="decimal" step="any" value="'+esc(val)+'" onchange="nxobjSim(\''+id+'\',this.value)">'+(aide?'<span style="font-weight:400">'+esc(aide)+'</span>':'')+'</label>'; };
    html+='<div class="card"><h2>Combien coûte un salarié ?</h2><div class="nxo-form">'
      +sin('brut','Salaire brut mensuel (€)',s.brut,'Minimum compagnon N3 coef. 230 en Hauts-de-France 2026 : 2 269 €')
      +'<label>Son camion<select id="nxo_sim_camion" onchange="nxobjSim(\'camion\',this.value)"><option value="0"'+(Number(s.camion)?'':' selected')+'>En binôme dans mon camion</option><option value="1"'+(Number(s.camion)?' selected':'')+'>Son propre camion (+13 600 €/an)</option></select></label>'
      +sin('fact','Part de ses heures facturées (%)',s.fact,'65 à 75 % en pratique (trajets, SAV, préparation)')
      +sin('marge','Marge à garder sur son heure (%)',s.marge,'')
      +sin('augm','Augmentation envisagée (€ brut / mois)',s.augm,'')
      +'</div><div class="kpis" style="margin-top:12px"><div class="kpi"><div class="lab">Coût complet / an</div><div class="val">'+e0(sim.cout)+'</div></div>'
      +'<div class="kpi"><div class="lab">Coût par heure facturée</div><div class="val">'+e2(sim.coutHeure)+'</div></div>'
      +'<div class="kpi '+(sim.rentable?'':'warn')+'"><div class="lab">Prix minimum à facturer</div><div class="val">'+e2(sim.prixMin)+'</div></div>'
      +'<div class="kpi"><div class="lab">Heures à facturer / mois</div><div class="val">'+Math.ceil(sim.heuresMinMois)+' h</div></div></div>'
      +'<div class="nxo-big" style="margin-top:8px">'+(sim.rentable?'À '+e2(sim.taux)+'/h (ton taux année 3), il couvre son coût et ta marge.':'<span style="color:var(--red,#b42318);font-weight:700">À '+e2(sim.taux)+'/h (ton taux année 3), il ne couvre pas son coût + ta marge : il faut au moins '+e2(sim.prixMin)+'/h.</span>')
      +' En dessous de <b>'+Math.ceil(sim.heuresMinMois)+' h</b> facturées par mois, il te coûte de l’argent.</div>'
      +'<div class="nxo-note">Augmentation de '+e0(num(s.augm))+' brut / mois : ≈ <b>'+e0(sim.augmAn)+' / an</b> de plus pour toi (≈ 1,90 € par € brut entre 2 000 et 2 600 €), soit ≈ '+Math.ceil(sim.augmAn/(sim.taux||1))+' h facturées de plus par an à '+e2(sim.taux)+'/h. Obligatoire à chaque hausse du SMIC ou de la grille ; par choix si ses heures facturées et sa qualité le justifient.</div>'
      +'<div class="nxo-note">Coût employeur ESTIMÉ sur les taux 2026 (salaire + charges + caisse congés BTP) + mutuelle, médecine du travail, indemnités repas/trajet, outillage, EPI, formation, paie, téléphone. À refaire sur le simulateur officiel <b>mon-entreprise.urssaf.fr</b> avant d’embaucher. Convention collective probable : IDCC 1596 (à confirmer).</div></div>';

    /* F. pour la comptable */
    var ctl=controles(F), y0=+t.slice(0,4), mo0=+t.slice(5,7)-1, q=Math.floor(mo0/3);
    var pm={from:iso(y0,mo0-1,1),to:iso(y0,mo0,0)}, pq={from:iso(y0,(q-1)*3,1),to:iso(y0,q*3,0)}, pa={from:(y0-1)+'-01-01',to:(y0-1)+'-12-31'};
    var encQ=recettes(pq.from,pq.to).reduce(function(a,x){ return a+x.ht; },0), encQc=recettes(iso(y0,q*3,1),t).reduce(function(a,x){ return a+x.ht; },0);
    var PER=[['mois','Mois dernier',pm],['trim','Trimestre dernier',pq],['trimc','Trimestre en cours',{from:iso(y0,q*3,1),to:iso(y0,q*3+3,0)}],['annee','Année dernière',pa],['anneec','Année en cours',{from:y0+'-01-01',to:y0+'-12-31'}]];
    if(!PERIODE||!PER.some(function(x){ return x[0]===PERIODE; })) PERIODE='mois';
    var pc=PER.filter(function(x){ return x[0]===PERIODE; })[0][2];
    html+='<div class="card"><h2>Pour la comptable</h2>'
      +'<div class="nxo-scroll"><table class="nxo-t"><thead><tr><th>Quand</th><th style="text-align:left">Quoi envoyer</th></tr></thead><tbody>'
      +'<tr><td>Chaque mois</td><td style="text-align:left;white-space:normal">Livre des recettes du mois + tes factures d’achat (photos ou PDF, classées par date).</td></tr>'
      +'<tr><td>Chaque trimestre</td><td style="text-align:left;white-space:normal">Pack du trimestre (livre, facturier, synthèse). Chiffre d’affaires encaissé HT à déclarer à l’Urssaf (si tu déclares au trimestre) : trimestre dernier <b>'+e0(encQ)+'</b>, trimestre en cours <b>'+e0(encQc)+'</b> à ce jour. La date limite affichée sur ton espace Urssaf fait foi.</td></tr>'
      +'<tr><td>Chaque année (janvier)</td><td style="text-align:left;white-space:normal">Pack de l’année + point du mois de décembre. Conservation : 10 ans pour le livre des recettes et les pièces.</td></tr>'
      +'</tbody></table></div>'
      +'<h3 style="margin:14px 0 4px;font-size:14px">Contrôles avant envoi</h3>'
      +ctl.map(function(c){ return '<div class="nxo-c">'+ico(c.ok)+'<div><div>'+esc(c.label)+'</div><div class="d">'+esc(c.detail)+'</div></div></div>'; }).join('')
      +'<h3 style="margin:14px 0 6px;font-size:14px">Exports</h3><div class="nxo-form" style="grid-template-columns:minmax(0,260px)"><label>Période<select id="nxo_periode" onchange="nxobjPeriode(this.value)">'+PER.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===PERIODE?' selected':'')+'>'+esc(x[1])+' ('+fr(x[2].from)+' → '+fr(x[2].to)+')</option>'; }).join('')+'</select></label></div>'
      +'<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxobjExport(\'livre\',\''+pc.from+'\',\''+pc.to+'\')">Livre des recettes (CSV)</button><button class="btn-ghost btn-sm" onclick="nxobjExport(\'facturier\',\''+pc.from+'\',\''+pc.to+'\')">Facturier (CSV)</button><button class="btn-ghost btn-sm" onclick="nxobjExport(\'synthese\',\''+pc.from+'\',\''+pc.to+'\')">Synthèse (PDF)</button><button class="btn-ghost btn-sm" onclick="nxobjExport(\'mail\',\''+pc.from+'\',\''+pc.to+'\')">Mail à la comptable</button></div>'
      +'<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxobjPointMois()">Point du mois (PDF)</button><button class="btn-ghost btn-sm" onclick="go(\'nx_regime\')">Ouvrir « Statut & régime »</button></div>'
      +'<div class="nxo-note">Livre des recettes : chronologique, montant, client, mode de règlement, n° de facture ; total tous les 3 mois (dans la synthèse) ; il peut être tenu sous forme électronique (service-public F23266). Registre des achats : exigé des commerçants ; si une part de ton activité est de la vente de matériel, demande à ta comptable — ClimPilot ne le tient pas, garde tes factures d’achat.</div></div>';

    /* G. réglages */
    var rin=function(id,lab,val,aide){ return '<label>'+esc(lab)+'<input id="nxo_'+id+'" type="number" inputmode="decimal" step="any" value="'+esc(val)+'" onchange="nxobjSet(\''+id+'\',this.value)">'+(aide?'<span style="font-weight:400">'+esc(aide)+'</span>':'')+'</label>'; };
    html+='<details class="card"><summary style="cursor:pointer;font-weight:700">Mes réglages (hypothèses du plan)</summary><div class="nxo-form" style="margin-top:10px">'
      +'<label>Début du plan<input id="nxo_debut" type="date" value="'+esc(o.debut)+'" onchange="nxobjSet(\'debut\',this.value)"><span style="font-weight:400">Vide = date de début du profil fiscal, sinon 01/07/2027 (actuellement '+fr(debut(o))+')</span></label>'
      +rin('tauxA1','Taux horaire année 1 (€ HT)',o.tauxA1)+rin('tauxA2','Taux horaire année 2 (€ HT)',o.tauxA2)+rin('tauxA3','Taux horaire année 3 (€ HT)',o.tauxA3)
      +rin('tauxST','Taux en sous-traitance (€ HT)',o.tauxST,'Accord WOLF')
      +rin('paie','Ma paie mensuelle (€)',o.paie)
      +rin('chargesFixes','Charges fixes (€ / an)',o.chargesFixes,'Assurances, téléphone, carburant, repas…')
      +rin('variables','Charges variables (€ / mois)',o.variables)
      +'<label>Provision camion<select id="nxo_camionActif" onchange="nxobjSet(\'camionActif\',this.value)"><option value="1"'+(o.camionActif?' selected':'')+'>Comptée</option><option value="0"'+(o.camionActif?'':' selected')+'>Pas comptée</option></select><span style="font-weight:400">À garder tant que tu n’es pas sûr de ne rien rembourser</span></label>'
      +rin('camionMontant','Provision camion (€ / mois)',o.camionMontant)+rin('camionMois','Pendant (mois)',o.camionMois)
      +rin('apprentiCout','Coût de l’apprenti (€ / an)',o.apprentiCout)
      +rin('fraisSociete','Frais de société (€ / an)',o.fraisSociete,'Comptable, banque… (hypothèse)')
      +rin('chargesDirigeant','Mes charges sociales en société (% de ma paie)',o.chargesDirigeant,'Ordre de grandeur EURL ; plus en SASU')
      +'</div><div class="row-actions" style="margin-top:10px"><button class="btn-ghost btn-sm" onclick="nxobjReset()">Remettre les hypothèses du plan</button></div></details>';

    host.innerHTML=html;
  }
  window.nxobjRender=render;

  /* ---------- actions ---------- */
  var DATES=['debut','diplomeDate','societeDate','apprentiDate','techDate'];
  window.nxobjSet=function(k,v){
    var o=st();
    if(DATES.indexOf(k)>=0){ if(v&&!okDate(v)){ say('Date invalide'); return render(); } o[k]=v||''; }
    else if(k==='camionActif') o.camionActif=v==='1'||v===true;
    else if(k==='tresoMontant'){ if(v===''){ o.tresoMontant=null; o.tresoDate=''; } else { var n=num(v); if(n<0&&!confirm('Trésorerie négative : c’est bien ça ?')) return render(); o.tresoMontant=n; o.tresoDate=today(); } }
    else if(Object.prototype.hasOwnProperty.call(DEF,k)){ var x=num(v); if(x<0){ say('Valeur négative refusée'); return render(); } o[k]=x; }
    else return;
    stSave(o); render(); say('Enregistré');
  };
  window.nxobjSim=function(k,v){ var o=st(); var x=num(v); if(k!=='camion'&&x<0){ say('Valeur négative refusée'); return render(); } if(k==='fact'&&(x<=0||x>100)){ say('Entre 1 et 100 %'); return render(); } if(k==='marge'&&x>=90){ say('Marge trop élevée'); return render(); } o.sim[k]=x; stSave(o); render(); };
  window.nxobjCheck=function(k,on){ var o=st(); if(on) o.checks[k]=today(); else delete o.checks[k]; stSave(o); render(); };
  window.nxobjAnnee=function(a){ ANNEE=a; render(); };
  window.nxobjPeriode=function(v){ PERIODE=v; render(); };
  window.nxobjReset=function(){ if(!confirm('Remettre toutes les hypothèses du plan (taux, paie, charges, camion) ? Tes dates, ta trésorerie et tes cases cochées sont gardées.')) return;
    var o=st(); ['tauxA1','tauxA2','tauxA3','tauxST','paie','chargesFixes','variables','camionActif','camionMontant','camionMois','apprentiCout','fraisSociete','chargesDirigeant'].forEach(function(k){ o[k]=DEF[k]; }); o.sim=Object.assign({},DEF.sim); stSave(o); render(); say('Hypothèses du plan remises'); };
  window.nxobjExport=function(type,from,to){
    try{ if(!window.nxrgPackPour){ say('Module « Statut & régime » absent : mets ClimPilot à jour'); return; }
      nxrgPackPour(from,to);
      if(type==='livre') nxrgLivre(); else if(type==='facturier') nxrgFacturier(); else if(type==='mail') nxrgMailComptable(); else nxrgSynthese();
    }catch(e){ say('Export impossible : '+(e&&e.message||e)); }
  };

  /* point du mois : une page pour toi, ta comptable ou ta banque (aperçu PDF de l'appli) */
  window.nxobjPointMois=function(k){
    var o=st(), t=today(); k=k||ym(t); var m=indexMois(k+'-01',o), F=factures(), FX=feux(o,F), E={}; try{ E=(P&&P.entreprise)||{}; }catch(e){}
    var r=realise(k,F), ob=m>=1&&m<=36?objectif(m,o):null, pl=m>=1?plancher(Math.min(m,36),o):plancher(1,o);
    var y=k.slice(0,4), fa=0, en=0; F.forEach(function(x){ if(String(x.date).slice(0,4)===y&&String(x.date)<=finMois(k)) fa+=x.ht; }); en=recettes(y+'-01-01',finMois(k)).reduce(function(a,x){ return a+x.ht; },0);
    var imp=impayes(), imp30=imp.filter(function(i){ return i.days>30; });
    var cot=recettes(k+'-01',finMois(k)).reduce(function(a,x){ return a+x.ht*cotis(x.date)/100; },0);
    var micro={},tva={}; try{ micro=nxEtatMicro(finMois(k)<t?finMois(k):t)||{}; }catch(e){} try{ tva=nxEtatFranchise(finMois(k)<t?finMois(k):t)||{}; }catch(e){}
    var demo=false; try{ var md=nxEmisMode(); demo=!!(md&&!md.demarre); }catch(e){}
    var td='padding:7px 10px;border:1px solid #e5e7eb', kv=function(l,v,b){ return '<tr><td style="'+td+(b?';font-weight:800':'')+'">'+l+'</td><td style="'+td+';text-align:right'+(b?';font-weight:800':'')+'">'+v+'</td></tr>'; };
    var feuTxt=function(f){ return '<tr><td style="'+td+'">'+esc(f.titre)+'</td><td style="'+td+';font-weight:700;color:'+(f.couleur==='vert'?'#16794a':f.couleur==='orange'?'#b45309':'#b42318')+'">'+esc(NOM[f.couleur])+'</td><td style="'+td+'">'+esc(f.verdict)+'</td></tr>'; };
    var doc=document.getElementById('devisDoc'); if(!doc){ say('Aperçu indisponible'); return; }
    doc.innerHTML='<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:780px">'
      +(demo?'<div style="border:2px solid #b42318;color:#b42318;font-weight:800;text-align:center;padding:8px;margin-bottom:10px;font-size:12px">DÉMONSTRATION — facturation réelle pas encore démarrée : chiffres d’essai.</div>':'')
      +'<div style="font-size:18px;font-weight:800">Point du mois — '+esc(labMois(k,true))+'</div>'
      +'<div style="font-size:12px;color:#555;margin:2px 0 14px">'+esc(E.nom||'')+(m>=1&&m<=36?' · mois '+m+' / 36 du plan':' · hors période du plan')+' · généré le '+new Date().toLocaleDateString('fr-FR')+'</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">'
      +(ob?kv('Objectif du mois (HT)',e0(ob.ca)):'')
      +kv('Facturé dans le mois (HT, avoirs déduits)',e0(r.facture),true)
      +kv('Plancher (charges + paie, cotisations comprises)',e0(pl.montant))
      +(ob?kv('Écart à l’objectif',(r.facture-ob.ca>=0?'+':'')+e0(r.facture-ob.ca)):'')
      +kv('Encaissé dans le mois (HT)',e0(r.encaisse))
      +kv('Cotisations à provisionner sur l’encaissé du mois',e0(cot))
      +kv('Facturé depuis le 1er janvier '+y+' (HT)',e0(fa))
      +kv('Encaissé depuis le 1er janvier '+y+' (HT)',e0(en))
      +kv('Impayés de plus de 30 jours',imp30.length+' facture(s) · '+e0(imp30.reduce(function(a,i){ return a+i.ttc; },0)))
      +'</table>'
      +'<div style="font-weight:700;font-size:12px;margin:10px 0 4px">Seuils de l’année</div><div style="font-size:11.5px;line-height:1.5;margin-bottom:10px">'+esc(micro.message||'—')+'<br>'+esc(tva.message||'—')+'</div>'
      +'<div style="font-weight:700;font-size:12px;margin:10px 0 4px">Feux</div><table style="width:100%;border-collapse:collapse;font-size:11.5px">'+feuTxt(FX.lancement)+feuTxt(FX.societe)+feuTxt(FX.apprenti)+feuTxt(FX.technicien)+'</table>'
      +'<div style="margin-top:14px;font-size:9.5px;color:#777;border-top:1px solid #eee;padding-top:8px">Document de pilotage généré par ClimPilot — pas une pièce comptable. Les pièces sont le livre des recettes et le facturier (exports CSV) et les factures. Objectifs : plan d’action du 09/10/2026, hypothèses modifiables.</div></div>';
    window.print();
  };

  /* ---------- tableau de bord : une ligne ---------- */
  function bandeauDash(){
    try{
      var k=document.getElementById('dashKpis'); if(!k) return; var el=document.getElementById('nxobjDash');
      if(!el){ el=document.createElement('div'); el.id='nxobjDash'; el.className='card'; el.style.padding='12px 16px'; k.parentNode.insertBefore(el,k); }
      css(); var o=st(), t=today(), m=indexMois(t,o), txt;
      if(m<1){ var FX=feux(o,[],true), cl=FX.lancement.conditions, ok=cl.filter(function(c){ return c.ok===true; }).length;
        txt='<span><b>Lancement le '+fr(debut(o))+'</b> — dans '+joursEntre(t,debut(o))+' jours · '+ok+' / '+cl.length+' points prêts</span>'; }
      else if(m>36) txt='<span><b>Plan de 3 ans terminé</b> — refais tes objectifs</span>';
      else { var ob=objectif(m,o), pl=plancher(m,o), r=realise(ym(t)), c=r.facture>=ob.ca?'vert':r.facture>=pl.montant?'orange':'rouge';
        txt='<span><span class="nxo-dot '+c+'" style="width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;background:var(--'+(c==='vert'?'green':c==='orange'?'orange':'red')+')"></span><b>Objectif '+esc(labMois(ym(t),true))+' : '+e0(ob.ca)+' HT</b> · facturé '+e0(r.facture)+' · plancher '+e0(pl.montant)+'</span>'; }
      el.innerHTML='<div class="nxo-l">'+txt+'<button class="btn-ghost btn-sm" onclick="go(\''+VUE+'\')">Mes objectifs & feux</button></div>';
    }catch(e){}
  }
  window.nxobjBandeau=bandeauDash;

  /* ---------- branchement ---------- */
  function lienNav(){
    var nav=document.getElementById('nav'); if(!nav||nav.querySelector('a[data-v="'+VUE+'"]')) return;
    var a=document.createElement('a'); a.setAttribute('data-v',VUE); a.innerHTML='<span class="ico">🎯</span><span class="txt">Objectifs & feux</span>';
    var dash=nav.querySelector('.nx-nav-section[data-section="home"] a[data-v="dash"]')||nav.querySelector('a[data-v="dash"]');
    if(dash&&dash.parentNode) dash.parentNode.insertBefore(a,dash.nextSibling); else nav.appendChild(a);
  }
  function boot(){
    try{
      if(typeof TITLES!=='undefined') TITLES[VUE]=['Objectifs & feux','Ton plan d’action : objectif du mois, plancher, feux pour l’apprenti et le salarié, et ce qu’il faut envoyer à la comptable.'];
      lienNav();
      var content=document.querySelector('.content')||(document.getElementById('v-dash')||{}).parentNode;
      if(content&&!document.getElementById('v-'+VUE)){ var sec=document.createElement('section'); sec.className='view'; sec.id='v-'+VUE; sec.innerHTML='<div id="nxobj"></div>'; content.appendChild(sec); }
      if(typeof window.go==='function'&&!window.go._nxobj){
        var prev=window.go;
        window.go=function(v){ var r=prev.apply(this,arguments); try{ lienNav();
          if(v===VUE){ render(); document.querySelectorAll('#nav a').forEach(function(a){ a.classList.toggle('active',a.dataset.v===VUE); });
            document.querySelectorAll('.nx-nav-section').forEach(function(s){ var open=s.dataset.section==='home'; s.classList.toggle('open',open); var b=s.querySelector(':scope > .nx-nav-toggle'); if(b) b.setAttribute('aria-expanded',open?'true':'false'); }); }
        }catch(e){ try{ console.error('ClimPilot next-objectifs',e); }catch(_){} } return r; };
        window.go._nxobj=true;
      }
      if(typeof window.renderDash==='function'&&!window.renderDash._nxobj){
        var od=window.renderDash; window.renderDash=function(){ var r=od.apply(this,arguments); bandeauDash(); return r; }; window.renderDash._nxobj=true;
        if(window._curView==='dash'||!window._curView) bandeauDash();
      }
      setTimeout(function(){ lienNav(); try{ noteHistorique(); }catch(e){} },1500);
    }catch(e){ try{ console.error('ClimPilot next-objectifs init',e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
