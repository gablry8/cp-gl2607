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
   - « À faire maintenant » + pastille du menu : déclaration Urssaf proche ou en retard (échéances officielles),
     envoi à la comptable non coché, impayés de plus de 30 jours, trésorerie à mettre à jour.
   - « Mon suivi » : déclarations Urssaf et envois à la comptable cochés et datés par toi.
   - « Mes 3 objectifs » : CA de l'année (à date), contrats d'entretien (15 / 40 / 70), part du plus gros client.
   - Feu de lancement : règle ACRE selon la date de fermeture de l'ancienne EI (art. D131-6-1 CSS).
   Stockage : cpnext_objectifs (synchronisé). Aucune donnée envoyée ailleurs.
   1.12 (12/10/2026) : modules ajoutés par window.nxobjAjouts (next-rentab, next-avis, next-banque, next-flubilan) ;
   liste « Lancer l'entreprise » avec des CONSEILS qui ne bloquent pas le feu (nom INPI, fiche Google, prévoyance,
   transport des bouteilles, facture électronique) ; attestation de capacité de l'entreprise (conseil avant la création,
   car elle se demande avec le SIRET ; bloquante une fois lancée) ; coût du km ; nxobjTreso / nxobjAJour.
   ============================================================ */
(function(){
  'use strict';
  var KEY='cpnext_objectifs', VUE='nx_obj';
  /* KEY2 : cases cochées (datées) et relevés mensuels, en LISTE d'éléments à identifiant : la synchro les fusionne
     élément par élément (cpMergeArr), donc une case cochée sur le téléphone et une autre sur le PC ne s'écrasent pas. */
  var KEY2='cpnext_objsuivi';
  try{ [KEY,KEY2].forEach(function(k){ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(k)<0) SYNC_KEYS.push(k); }); }catch(e){}

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
    eiFermeture:'',           // date de fermeture de l'ancienne EI (règle ACRE « reprise l'année suivante »)
    tresoMontant:null,tresoDate:'',
    declPeriode:'trim',       // déclaration du CA à l'Urssaf : 'trim' ou 'mois'
    envoiPeriode:'mois',      // envoi des pièces à la comptable : 'mois' ou 'trim' (rythme convenu avec elle)
    checks:{},hist:{},envois:{},decl:{}, // lus dans cpnext_objsuivi (liste « type:clé ») : cases à cocher, relevés mensuels,
                                         // envois à la comptable ('AAAA-MM' / 'AAAA-Tn'), déclarations Urssaf
    sim:{brut:2300,camion:0,fact:70,marge:20,margeBrute:50,augm:100},
    coutKm:0,                 // € par km pour chiffrer les déplacements de SAV (1.12, next-rentab) ; 0 = km non chiffrés
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
  var MAPS={checks:'check',decl:'decl',envois:'envoi',hist:'hist'};
  function ecrire(k,v){ try{ save(k,v); }catch(e){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } }
  function marks(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KEY2)||'[]'); }catch(e){ a=[]; }
    return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.id==='string'&&x.id.indexOf(':')>0; }):[]; }
  /* setMark('decl','2027-T3',{d:'2027-11-12'}) ; valeur null = décocher */
  function setMark(type,k,val){ var a=marks(), id=type+':'+k, i=-1;
    a.forEach(function(x,j){ if(x.id===id) i=j; });
    if(val==null){ if(i<0) return; a.splice(i,1); } else { var x=Object.assign({id:id},val); if(i>=0) a[i]=x; else a.push(x); }
    ecrire(KEY2,a); }
  function st(){
    var o={}; try{ o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ o={}; }
    /* anciennes cases rangées dans l'objet (branche 1.11 avant le 11/10) : passées dans la liste, une seule fois */
    var legacy=Object.keys(MAPS).filter(function(m){ return o[m]&&typeof o[m]==='object'; });
    if(legacy.length){ var deja={}; marks().forEach(function(x){ deja[x.id]=1; });
      legacy.forEach(function(m){ Object.keys(o[m]).forEach(function(k){ var v=o[m][k];
        if(m!=='hist'&&deja['hist:'+k]) return; if(deja[MAPS[m]+':'+k]) return; /* jamais d'écrasement : une case décochée ne revient pas */
        if(m==='hist') setMark('hist',k,{carnet:Number(v&&v.carnet)||0}); else if(v) setMark(MAPS[m],k,{d:String(v)}); }); delete o[m]; });
      ecrire(KEY,o); }
    var r=Object.assign({},DEF,o);
    r.sim=Object.assign({},DEF.sim,o.sim||{}); r.checks={}; r.hist={}; r.envois={}; r.decl={};
    marks().forEach(function(x){ var p=x.id.indexOf(':'), t=x.id.slice(0,p), k=x.id.slice(p+1);
      if(t==='check') r.checks[k]=x.d; else if(t==='decl') r.decl[k]=x.d; else if(t==='envoi') r.envois[k]=x.d; else if(t==='hist') r.hist[k]={carnet:Number(x.carnet)||0}; });
    if(r.declPeriode!=='mois') r.declPeriode='trim';
    if(r.envoiPeriode!=='trim') r.envoiPeriode='mois';
    return r;
  }
  /* les réglages seuls (les cases et relevés vivent dans KEY2) */
  function stSave(o){ var c=Object.assign({},o); Object.keys(MAPS).forEach(function(m){ delete c[m]; }); c.maj=Date.now(); ecrire(KEY,c); }
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
  /* cache valable le temps d'UN affichage (avecCache) : chaque appel relirait sinon toutes les factures (lent avec des
     milliers de documents) ; vidé à la fin de l'affichage, donc jamais périmé d'un écran à l'autre */
  var CACHE=null;
  function avecCache(fn){ if(CACHE) return fn(); CACHE={}; try{ return fn(); } finally { CACHE=null; } }
  function factures(){ if(CACHE&&CACHE.F) return CACHE.F; var r=[]; try{ if(window.nxrgLignesFactures) r=nxrgLignesFactures(); }catch(e){} if(CACHE) CACHE.F=r; return r; }
  function recettes(from,to){
    var all;
    if(CACHE&&CACHE.R) all=CACHE.R;
    else { all=[]; try{ if(window.nxrgLignesRecettes) all=nxrgLignesRecettes('','',CACHE?factures():undefined); }catch(e){} if(CACHE) CACHE.R=all; }
    return all.filter(function(x){ var d=String(x.date||'').slice(0,10); return d&&(!from||d>=from)&&(!to||d<=to); });
  }
  function impayes(){ if(CACHE&&CACHE.I) return CACHE.I; var r=[]; try{ if(window.nxrgLignesImpayes) r=nxrgLignesImpayes(CACHE?factures():undefined); }catch(e){} if(CACHE) CACHE.I=r; return r; }
  function finMois(k){ return iso(+k.slice(0,4),+k.slice(5,7),0); }

  /* ---------- modules ajoutés (1.12) : next-rentab, next-avis, next-banque, next-flubilan ----------
     Chacun s'inscrit dans window.nxobjAjouts : {id, pos:'apres3'|'apresFeux'|'comptable', carte(ctx)→html, afaire(ctx)→[{urg,txt,act…}]}.
     ctx = {o, t, m}. Une erreur dans un module n'empêche jamais l'écran de s'afficher. */
  window.nxobjAjouts=window.nxobjAjouts||[];
  function ajouts(){ return Array.isArray(window.nxobjAjouts)?window.nxobjAjouts:[]; }
  function logErr(id,e){ try{ console.error('ClimPilot objectifs — module '+id,e); }catch(_){} }
  function ajoutsAFaire(o,t,m){ var r=[]; ajouts().forEach(function(a){ if(!a||typeof a.afaire!=='function') return;
      try{ (a.afaire({o:o,t:t,m:m})||[]).forEach(function(x){ if(x&&x.txt) r.push(x); }); }catch(e){ logErr(a.id,e); } }); return r; }
  function ajoutsCartes(pos,o,t,m){ return ajouts().filter(function(a){ return a&&a.pos===pos&&typeof a.carte==='function'; })
      .map(function(a){ try{ return a.carte({o:o,t:t,m:m})||''; }catch(e){ logErr(a.id,e); return ''; } }).join(''); }
  /* pour les modules : mêmes lectures que l'écran (avec le cache pendant un affichage) */
  window.nxobjFactures=function(){ return factures(); };
  window.nxobjRecettes=function(from,to){ return recettes(from,to); };
  window.nxobjDebut=function(){ return debut(st()); };
  window.nxobjIndexMois=function(d){ return indexMois(d||today(),st()); };
  window.nxobjTauxAnnee=function(m){ var o=st(); m=m||indexMois(today(),o); return tauxAnnee(m>=1?Math.min(3,Math.ceil(m/12)):1,o); };
  /* trésorerie datée (import du relevé bancaire : la date du solde, pas celle du jour) */
  window.nxobjTreso=function(montant,date){ var o=st(), n=Number(montant); if(!isFinite(n)) return false; if(!okDate(date)||date>today()) date=today();
    o.tresoMontant=r2(n); o.tresoDate=date; stSave(o); return true; };
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
    setMark('hist',k,{carnet:c});
    var ks=Object.keys(o.hist).concat(o.hist[k]?[]:[k]).sort(); while(ks.length>24){ setMark('hist',ks.shift(),null); }
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
  function cond(ok,label,detail,source,key,conseil){ var c={ok:ok,label:label,detail:detail||'',source:source||'auto',key:key||''}; if(conseil) c.conseil=true; return c; }
  /* un conseil (c.conseil) s'affiche mais ne change pas la couleur du feu */
  function bloquants(cs){ return cs.filter(function(c){ return !c.conseil; }); }
  function couleur(cs){ cs=bloquants(cs); if(cs.some(function(c){ return c.ok===false; })) return 'rouge'; if(cs.some(function(c){ return c.ok==null; })) return 'orange'; return 'vert'; }
  function resteAFaire(cs){ return bloquants(cs).filter(function(c){ return c.ok!==true; }).length; }
  /* ACRE : « ne sont assimilées à un début d'activité ni la modification des conditions d'exercice […] ni la reprise
     d'activité intervenue soit dans l'année au cours de laquelle est survenue la cessation d'activité, soit dans l'année
     suivante » (art. D131-6-1 et R131-3 du Code de la sécurité sociale, décret 2026-69 ; circulaire CNAV 2026-12 du
     07/04/2026, https://legislation.lassuranceretraite.fr/Pdf/circulaire_cnav_2026_12_07042026.pdf, lue le 11/10/2026).
     + pas d'ACRE déjà obtenue dans les 3 années précédentes (service-public F11677, vérifié le 01/07/2026). */
  function condAcre(o){
    var L='Droit à l’ACRE éclairci', yC=+debut(o).slice(0,4), u=o.checks.urssaf;
    if(u) return cond(true,L,'Réponse écrite de l’Urssaf reçue (cochée le '+fr(u)+'). Garde-la.','auto','acre');
    if(!okDate(o.eiFermeture)) return cond(null,L,'Renseigne la date de fermeture de ton ancienne EI dans « À renseigner » (elle figure sur l’avis de radiation).','auto','acre');
    var yF=+o.eiFermeture.slice(0,4);
    if(yF>=yC-1) return cond(false,L,'EI fermée en '+yF+', création en '+yC+' : une reprise d’activité l’année de la fermeture ou l’année suivante ne compte pas comme un début d’activité (art. D131-6-1 du Code de la sécurité sociale). Risque : pas d’ACRE, donc pas d’ARCE (≈ 10 000 €). Demande écrite à l’Urssaf avant de créer. Une création à partir du 01/01/'+(yF+2)+' ne serait plus concernée par cette règle.','auto','acre');
    return cond(true,L,'EI fermée en '+yF+' : plus d’une année civile complète avant '+yC+', la règle de reprise ne te concerne pas. Reste une condition : ne pas avoir eu l’ACRE dans les 3 ans avant la création.','auto','acre');
  }
  window.nxobjCondAcre=function(){ return condAcre(st()); };
  /* [clé, libellé, détail, conseil] — conseil = true : recommandé, ne bloque pas le feu (1.12) */
  var CHECKS_LANCEMENT=[
    ['urssaf','Réponse ÉCRITE de l’Urssaf sur ton droit à l’ACRE','Indispensable si ton EI a été fermée l’année de la création ou l’année d’avant (ligne au-dessus). Sans ACRE, pas d’ARCE (capital chômage).'],
    ['assurances','Devis décennale + RC pro reçus et comparés','Décennale obligatoire pour les travaux (art. L241-1 Code des assurances) ; RC pro : à voir avec ton assureur.'],
    ['decennaleActivites','Toutes tes activités écrites sur l’attestation décennale','Clim et PAC air-air, et si tu en poses : PAC air-eau, ballon thermodynamique, chambres froides, froid commercial. Une activité qui n’y figure pas risque de ne pas être couverte : fais-le confirmer par écrit par l’assureur.'],
    ['aptitude','Attestation d’aptitude fluides à jour','Catégorie adaptée (et hydrocarbures / CO₂ pour le froid commercial).'],
    ['wolf','Accord écrit avec WOLF ENERGY','Heures par mois, prix, durée, déplacements payés ou non.'],
    ['comptable','Expert-comptable choisi (ou la comptable qui te suit d’accord)','Lui montrer l’écran « Objectifs & feux » et le pack comptable avant de démarrer.'],
    ['banque','Compte bancaire dédié à l’activité ouvert','Obligatoire au-delà de 10 000 € de CA 2 années de suite (service-public F35991) ; conseillé dès le départ.'],
    ['deuxfa','Double authentification activée sur GitHub et Supabase','Quelqu’un qui entre dans ton GitHub peut publier une fausse version de ClimPilot ; dans Supabase, il lit toutes tes données. 15 minutes, à faire tout de suite.'],
    ['nomInpi','Nom de l’entreprise vérifié dans la base des marques (INPI) avant de lettrer le camion','Recherche gratuite sur data.inpi.fr : un nom déjà déposé dans ton secteur peut t’obliger à tout refaire (camion, site, cartes).',true],
    ['ficheGoogle','Fiche Google de l’entreprise créée (Google Business Profile)','Première source gratuite de clients pour un artisan local. Colle ensuite son lien « avis » dans Paramètres › Mon entreprise : ClimPilot te proposera de demander un avis après chaque chantier payé.',true],
    ['prevoyance','Prévoyance (arrêt de travail) et perte d’exploitation étudiées','Si tu es arrêté plusieurs semaines : qui paie le camion, les assurances et ta paie ? Demande un devis à ton assureur et compare avec ce que verse la Sécurité sociale (à vérifier sur ameli.fr).',true],
    ['transportFluides','Transport des bouteilles de fluide dans le camion vérifié','Sous 1 000 points ADR (kg de R32 ou R290 × 3, kg de R410A ou R134a × 1, litres d’azote × 1 : calcul dans l’écran Fluides), régime allégé. Restent obligatoires : extincteur 2 kg à poudre, formation du conducteur (ADR chapitre 1.3), bouteilles fermées et arrimées. R290 = propane : camion aéré, pas de bouteille à demeure. Source : OPPBTP (quantités limitées).',true],
    ['pdp','Facture électronique : plateforme choisie et essayée en bac à sable','Factures entre entreprises : réception électronique obligatoire pour toutes depuis le 01/09/2026, émission obligatoire pour les micro-entreprises à partir du 01/09/2027 (les ventes aux particuliers passent par une transmission de données, le « e-reporting »). Essaie Super PDP en bac à sable avant ta première vraie facture.',true]
  ];
  function feux(o,F,seulLancement){
    o=o||st(); F=F||factures();
    var t=today(), mNow=indexMois(t,o), E={}; try{ E=(P&&P.entreprise)||{}; }catch(e){}
    var fiscal={}; try{ fiscal=window.nxFiscalProfil?nxFiscalProfil():{}; }catch(e){}
    var pl=plancher(Math.max(1,mNow),o), sorties=pl.sorties, tf=tresoFraiche(o), T=num(o.tresoMontant);
    var trois=seulLancement?null:troisMoisAuPlancher(o,F), car=seulLancement?null:carnet(), rec=seulLancement?null:recurrent(), sim=seulLancement?null:simul(o);
    var out={};

    /* 1. lancement */
    var cl=[condAcre(o)].concat(CHECKS_LANCEMENT.filter(function(c){ return !c[3]; }).map(function(c){ return cond(!!o.checks[c[0]]?true:null,c[1],c[2],'toi',c[0]); }));
    /* attestation de CAPACITÉ (entreprise) ≠ attestation d'APTITUDE (personne) : art. R543-99 du Code de l'environnement ;
       délivrance par un organisme agréé, arrêté du 21/11/2025 (applicable au 01/01/2027) */
    /* elle se demande avec le SIRET : avant la création, rappel qui ne bloque pas ; une fois lancée, point bloquant */
    var cap=String(E.attFluides||'').trim();
    cl.push(cond(cap?true:null,mNow>=1?'Attestation de capacité fluides de TON entreprise (Paramètres)':'Attestation de capacité fluides de ton entreprise : à demander dès que tu as ton SIRET','Différente de ton attestation d’aptitude (personnelle) : c’est l’entreprise qui manipule les fluides qui doit l’avoir, délivrée par un organisme agréé (art. R543-99 du Code de l’environnement). Sans elle, pas de manipulation de fluide à ton nom. Numéro et organisme dans Paramètres › Mon entreprise.','auto','capacite',mNow<1));
    cl.push(cond(String(E.mediateur||'').trim()?true:null,'Médiateur de la consommation renseigné (Paramètres)','Obligatoire avant le premier devis à un particulier.','auto'));
    cl.push(cond(okDate(fiscal.debut)?true:null,'Profil fiscal rempli (date de début d’activité)','Paramètres › Profil fiscal : il règle le taux de cotisations partout.','auto'));
    cl.push(cond(!tf?null:T>=3*sorties,'Trésorerie ≥ 3 mois de dépenses ('+e0(3*sorties)+')',tf?'Déclarée : '+e0(T)+' le '+fr(o.tresoDate)+'.':'Renseigne ta trésorerie ci-dessous (à refaire tous les 45 jours).','auto'));
    CHECKS_LANCEMENT.filter(function(c){ return c[3]; }).forEach(function(c){ cl.push(cond(!!o.checks[c[0]]?true:null,c[1],c[2],'toi',c[0],true)); });
    out.lancement={id:'lancement',titre:'Lancer l’entreprise',couleur:couleur(cl),conditions:cl,pill:mNow>=1&&couleur(cl)!=='vert'?'À régler':null,
      verdict:mNow>=1?'Lancée depuis le '+fr(debut(o))+'.':couleur(cl)==='vert'?'Tout est prêt pour créer.':'Pas encore : '+resteAFaire(cl)+' point(s) à régler avant de créer.'};
    if(mNow>=1&&out.lancement.couleur!=='vert') out.lancement.verdict='Lancée — '+resteAFaire(cl)+' point(s) encore à régler.';
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

  /* ---------- 3 objectifs simples de l'année du plan ---------- */
  /* contrats d'entretien actifs visés : 15 fin année 1, 40 fin année 2, 70 fin année 3 (plan du 09/10/2026), progression linéaire */
  function objContrats(m){ m=Math.max(0,Math.min(36,m)); return m<=12?Math.round(15*m/12):m<=24?Math.round(15+25*(m-12)/12):Math.round(40+30*(m-24)/12); }
  window.nxobjObjContrats=objContrats;
  function objectifsAnnee(o,F,t){
    var m=indexMois(t,o), y=m>=1?Math.min(3,Math.ceil(m/12)):1, a=(y-1)*12+1, b=y*12, i, tot=0;
    for(i=a;i<=b;i++) tot+=objectif(i,o).ca;
    var res={annee:y,m:m,caAn:r2(tot),contratsFin:objContrats(b),limite:m<=6?0.7:0.5,debutAn:moisDate(a,o)};
    if(m<1||m>36) return res;
    var k=ym(t), att=0; for(i=a;i<m;i++) att+=objectif(i,o).ca;
    att+=objectif(m,o).ca*Math.min(1,(+t.slice(8,10))/(+finMois(k).slice(8,10)));
    var fait=0; F.forEach(function(x){ var d=String(x.date); if(d>=res.debutAn&&d<=t) fait+=Number(x.ht)||0; });
    var rc=recurrent();
    var d6=iso(+t.slice(0,4),+t.slice(5,7)-7,+t.slice(8,10)+1); if(d6<debut(o)) d6=debut(o); /* 6 derniers mois glissants */
    res.caAttendu=r2(att); res.caFait=r2(fait); res.contrats=rc.contrats; res.contratsObj=objContrats(m); res.client=premierClient(F,d6); res.depuisClient=d6;
    return res;
  }
  window.nxobjObjectifsAnnee=function(){ return objectifsAnnee(st(),factures(),today()); };

  /* ---------- calendrier : envois à la comptable et déclarations Urssaf ----------
     Échéances de déclaration du chiffre d'affaires (autoentrepreneur.urssaf.fr, « L'essentiel du statut », lu le 11/10/2026) :
     mensuelle → dernier jour du mois suivant ; trimestrielle → 30/04, 31/07, 31/10, 31/01 (report au jour ouvré suivant
     un week-end ou un jour férié, non calculé ici) ; déclaration obligatoire même à 0 € ; seules les factures encaissées.
     1re déclaration : au plus tôt 90 jours après le début de l'activité (service-public F36232, vérifié le 01/01/2026).
     Le rythme d'envoi à la comptable n'est pas une règle : c'est celui que tu conviens avec elle (mois ou trimestre). */
  /* 90 jours après la VRAIE date de début (profil fiscal) quand elle est connue, sinon après le début du plan */
  function j90(o){ var d=debut(o); try{ var pf=window.nxFiscalProfil&&nxFiscalProfil(); if(pf&&okDate(pf.debut)) d=pf.debut; }catch(e){}
    return iso(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)+90); }
  /* périodes depuis le début du plan jusqu'à t. grouper=true (déclarations Urssaf) : les périodes terminées avant le 90e jour
     sont regroupées avec la suivante en UNE « 1re déclaration » (montant depuis le début, échéance de cette période-là). */
  function periodes(type,o,t,grouper){
    var d=debut(o), out=[], k, y, q, from, to, p90=j90(o), lim=grouper&&p90>t?p90:t, n;
    if(type==='mois'){
      for(k=ym(d),n=0;k<=ym(lim)&&n<400;k=moisPrec(k,-1),n++){ to=finMois(k); out.push({id:k,lab:labMois(k,true),from:k+'-01',to:to,ech:finMois(moisPrec(k,-1))}); }
    } else {
      y=+d.slice(0,4); q=Math.floor((+d.slice(5,7)-1)/3);
      for(n=0;n<140;n++){ from=iso(y,q*3,1); if(from>lim) break; to=iso(y,q*3+3,0);
        out.push({id:y+'-T'+(q+1),lab:(q+1)+(q===0?'er':'e')+' trimestre '+y,from:from<d?d:from,to:to,ech:iso(y,q*3+4,0)});
        q++; if(q>3){ q=0; y++; } }
    }
    if(grouper){
      var g=-1; for(n=0;n<out.length;n++){ if(out[n].to>=p90){ g=n; break; } }
      if(g>0){ var mb=out.slice(0,g+1), P=out[g];
        out.splice(0,g+1,{id:P.id,lab:'1re déclaration ('+mb[0].lab+' → '+P.lab+')',from:mb[0].from,to:P.to,ech:P.ech,premiere:true,membres:mb.map(function(x){ return x.id; })}); }
    }
    return out.filter(function(p){ return p.from<=t; });
  }
  window.nxobjPeriodes=function(type,grouper){ var o=st(); return periodes(type||o.declPeriode,o,today(),grouper!==false); };
  /* fin de la période d'un identifiant ('AAAA-MM' ou 'AAAA-Tn') */
  function finId(id){ var m=/^(\d{4})-T([1-4])$/.exec(id); if(m) return iso(+m[1],+m[2]*3,0); return /^\d{4}-\d{2}$/.test(id)?finMois(id):''; }
  /* « à jour jusqu'au » : fin de la plus récente période cochée, quel que soit le rythme (mois ou trimestre).
     Une période plus ancienne non cochée n'est plus rappelée (on ne peut pas la cocher si elle n'est plus affichée,
     et un changement de rythme ne doit pas faire réapparaître tout le passé en retard). */
  function ajour(map){ var f=''; Object.keys(map||{}).forEach(function(id){ var x=finId(id); if(x>f) f=x; }); return f; }
  /* pour le relevé bancaire (1.12) : jusqu'à quelle date les déclarations Urssaf et les envois à la comptable sont faits */
  window.nxobjAJour=function(){ var o=st(); return {decl:ajour(o.decl),envoi:ajour(o.envois)}; };
  function enAttente(map,p,t){ return !map[p.id]&&p.to<t&&p.to>ajour(map); }
  /* « du 3e trimestre 2027 », « de juillet 2027 », « d’octobre 2027 » */
  function duLab(p){ return /trimestre/.test(p.lab)?'du '+p.lab:(/^[aeiouyéèêàâîôû]/i.test(p.lab)?'d’':'de ')+p.lab; }
  function encHT(p){ return r2(recettes(p.from,p.to).reduce(function(s,x){ return s+(Number(x.ht)||0); },0)); }

  /* « À faire maintenant » : urg 2 = en retard / bloquant, 1 = à faire bientôt, 0 = à garder en tête */
  function aFaire(o,F,t){
    var m=indexMois(t,o), out=[];
    if(m<1){
      var ac=condAcre(o);
      if(ac.ok===false) out.push({urg:2,txt:'ACRE : ton ancienne EI a été fermée l’année de la création ou l’année d’avant. Demande par écrit à l’Urssaf si tu y as droit, avant de créer.',act:''});
      var fl=feux(o,F,true).lancement, reste=resteAFaire(fl.conditions);
      if(reste) out.push({urg:0,txt:reste+' point(s) à régler avant de créer (carte « Lancer l’entreprise »).',act:''});
    } else {
      periodes(o.declPeriode,o,t,true).forEach(function(p){
        if(!enAttente(o.decl,p,t)) return;
        var jr=joursEntre(t,p.ech); if(jr>20) return;
        var quoi=p.premiere?'Faire ta 1re déclaration Urssaf ('+p.lab.replace(/^1re déclaration \(|\)$/g,'')+') : '+e0(encHT(p))+' encaissés depuis le début':'Déclarer à l’Urssaf le CA encaissé '+duLab(p)+' : '+e0(encHT(p));
        out.push({urg:jr<0?2:1,txt:quoi+(jr<0?' — échéance du '+fr(p.ech)+' dépassée : déclare tout de suite (même à 0 €).':' — avant le '+fr(p.ech)+' (même à 0 €)'+(p.premiere?' ; l’échéance exacte est sur ton espace Urssaf.':'.')),act:'decl',id:p.id});
      });
      var env=periodes(o.envoiPeriode==='trim'?'trim':'mois',o,t,false).filter(function(p){ return enAttente(o.envois,p,t); });
      if(env.length){ var der=env[env.length-1], jd=joursEntre(der.to,t);
        if(jd>=5) out.push({urg:jd>20?2:1,txt:'Envoyer à ta comptable les pièces '+duLab(der)+' (livre des recettes, facturier, factures d’achat)'+(env.length>1?' — et '+(env.length-1)+' période(s) plus ancienne(s) pas cochée(s) : cocher la plus récente suffit si tu es à jour':'')+'.',act:'envoi',id:der.id}); }
      var imp=impayes().filter(function(i){ return i.days>30; });
      if(imp.length) out.push({urg:1,txt:'Relancer '+imp.length+' facture(s) impayée(s) depuis plus de 30 jours ('+e0(imp.reduce(function(s,i){ return s+i.ttc; },0))+').',act:'impayes'});
    }
    if(!tresoFraiche(o)) out.push({urg:0,txt:o.tresoDate?'Mettre à jour ta trésorerie (dernière saisie le '+fr(o.tresoDate)+').':'Saisir ta trésorerie : plusieurs feux en ont besoin.',act:'treso'});
    out=out.concat(ajoutsAFaire(o,t,m));
    return out.sort(function(a,b){ return b.urg-a.urg; });
  }
  window.nxobjAFaire=function(){ return avecCache(function(){ var o=st(); return aFaire(o,factures(),today()); }); };
  function nbUrgent(){ try{ return avecCache(function(){ return aFaire(st(),factures(),today()).filter(function(x){ return x.urg>=1; }).length; }); }catch(e){ return 0; } }
  function majBadge(n){ var b=document.getElementById('nxobjBadge'); if(!b) return; if(n==null) n=nbUrgent(); b.textContent=n; b.style.display=n?'':'none'; }

  /* ---------- rendu ---------- */
  var CSS='#v-nx_obj .nxo-row{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));align-items:start}'
    +'#v-nx_obj .nxo-pill{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:12px;padding:3px 10px;border-radius:999px;white-space:nowrap}'
    +'#v-nx_obj .nxo-vert{background:var(--green-soft,#e7f6ee);color:var(--green,#16794a)}#v-nx_obj .nxo-orange{background:var(--orange-soft,#fff3e0);color:var(--orange,#b45309)}#v-nx_obj .nxo-rouge{background:var(--red-soft,#fdecec);color:var(--red,#b42318)}#v-nx_obj .nxo-gris{background:#f1f3f5;color:#555}'
    +'#v-nx_obj .nxo-dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}#v-nx_obj .nxo-dot.vert{background:var(--green,#16794a)}#v-nx_obj .nxo-dot.orange{background:var(--orange,#b45309)}#v-nx_obj .nxo-dot.rouge{background:var(--red,#b42318)}#v-nx_obj .nxo-dot.gris{background:#c3c8cf}'
    +'#v-nx_obj .nxo-feu h3{margin:0 0 4px;font-size:15px;display:flex;justify-content:space-between;gap:8px;align-items:center}#v-nx_obj .nxo-feu .v{font-weight:600;margin:4px 0 8px}'
    +'#v-nx_obj .nxo-c{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line,#e5e7eb);font-size:13px}#v-nx_obj .nxo-c .i{flex:none;width:18px;text-align:center;font-weight:800}#v-nx_obj .nxo-c .d{color:var(--muted,#667085);font-size:12px;margin-top:2px}#v-nx_obj .nxo-c .s{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#667085)}'
    +'#v-nx_obj .nxo-c input[type=checkbox]{width:18px;height:18px;margin:1px 0 0;flex:none}#v-nx_obj table.nxo-suivi input[type=checkbox]{width:18px;height:18px;margin:0;flex:none;display:inline-block}'
    +'#v-nx_obj .nxo-bar{position:relative;height:12px;background:#eef1f4;border-radius:6px;overflow:visible;margin:10px 0 4px}#v-nx_obj .nxo-bar .f{position:absolute;left:0;top:0;bottom:0;border-radius:6px}#v-nx_obj .nxo-bar .p{position:absolute;top:-4px;bottom:-4px;width:2px;background:#344054}'
    +'#v-nx_obj table.nxo-t{width:100%;border-collapse:collapse;font-size:13px}#v-nx_obj table.nxo-t th,#v-nx_obj table.nxo-t td{padding:7px 6px;border-bottom:1px solid var(--line,#e5e7eb);text-align:right;white-space:nowrap}#v-nx_obj table.nxo-t th:first-child,#v-nx_obj table.nxo-t td:first-child{text-align:left}#v-nx_obj table.nxo-t tr.cur td{background:var(--blue-soft,#eef4ff);font-weight:700}'
    +'#v-nx_obj .nxo-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    +'#v-nx_obj .nxo-big{font-size:15px;line-height:1.5}#v-nx_obj .nxo-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}#v-nx_obj .nxo-tabs button.on{outline:2px solid var(--ink,#121417)}'
    +'#v-nx_obj .nxo-form{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}#v-nx_obj .nxo-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--muted,#667085)}#v-nx_obj .nxo-form input,#v-nx_obj .nxo-form select{font-size:15px}'
    +'#v-nx_obj .nxo-note{font-size:12px;color:var(--muted,#667085);line-height:1.55;margin-top:8px}'
    +'#v-nx_obj .nxo-conseils{margin:10px 0 0;padding-top:8px;border-top:2px solid var(--line,#e5e7eb);font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#667085)}'
    +'#nxobjDash .nxo-l{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}#nxobjDash .nxo-l b{font-size:15px}'
    +'#v-nx_obj .nxo-st{display:none;font-weight:800;font-size:13px;margin:16px 0 0;padding:6px 10px;border-radius:8px;background:var(--blue-soft,#eef4ff)}'
    +'@media(max-width:640px){#v-nx_obj .nxo-st{display:block}#v-nx_obj table.nxo-suivi,#v-nx_obj table.nxo-suivi tbody{display:block;width:100%}#v-nx_obj table.nxo-suivi thead{display:none}'
    +'#v-nx_obj table.nxo-suivi tr{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:10px 0;border-bottom:1px solid var(--line,#e5e7eb)}'
    +'#v-nx_obj table.nxo-suivi td{display:block;border:0!important;padding:0!important;text-align:left!important;white-space:normal!important}'
    +'#v-nx_obj table.nxo-suivi td:first-child{flex-basis:100%;font-weight:700}#v-nx_obj table.nxo-suivi td.nxo-pieces{flex-basis:100%;display:flex;gap:6px;flex-wrap:wrap}'
    +'#v-nx_obj table.nxo-suivi td[data-l]::before{content:attr(data-l) " : ";font-weight:600;color:var(--muted,#667085);font-size:12px}'
    +'#v-nx_obj table.nxo-suivi td[data-l="Déclaré"]::before,#v-nx_obj table.nxo-suivi td[data-l="Envoyé"]::before{content:attr(data-l) " ?"}'
    +'#v-nx_obj table.nxo-suivi td[data-l="Déclaré"],#v-nx_obj table.nxo-suivi td[data-l="Envoyé"]{display:flex;gap:8px;align-items:center}}'
    +'@media(max-width:520px){#v-nx_obj table.nxo-t th:nth-child(5),#v-nx_obj table.nxo-t td:nth-child(5){display:none}#v-nx_obj table.nxo-t th,#v-nx_obj table.nxo-t td{padding:7px 4px}}';
  function css(){ if(document.getElementById('nxobjCss')) return; var s=document.createElement('style'); s.id='nxobjCss'; s.textContent=CSS; document.head.appendChild(s); }

  var NOM={vert:'Vert',orange:'À compléter',rouge:'Pas encore',gris:'—'};
  function pill(c,txt){ return '<span class="nxo-pill nxo-'+c+'"><span class="nxo-dot '+c+'"></span>'+esc(txt||NOM[c])+'</span>'; }
  function ico(ok){ return ok===true?'<span class="i" style="color:var(--green,#16794a)">✓</span>':ok===false?'<span class="i" style="color:var(--red,#b42318)">✕</span>':'<span class="i" style="color:var(--orange,#b45309)">?</span>'; }
  function carteFeu(f){
    var ligne=function(c){
      var box=c.source==='toi'?'<input type="checkbox" '+(c.ok===true?'checked':'')+' onchange="nxobjCheck(\''+esc(c.key)+'\',this.checked)" aria-label="'+esc(c.label)+'">':ico(c.ok);
      return '<div class="nxo-c"'+(c.conseil?' data-conseil="1"':'')+'>'+box+'<div><div>'+esc(c.label)+'</div>'+(c.detail?'<div class="d">'+esc(c.detail)+'</div>':'')+'</div></div>';
    };
    var cons=f.conditions.filter(function(c){ return c.conseil; });
    return '<div class="card nxo-feu" data-feu="'+esc(f.id||'')+'"><h3><span>'+esc(f.titre)+'</span>'+pill(f.couleur,f.pill)+'</h3><div class="v">'+esc(f.verdict)+'</div>'
      +bloquants(f.conditions).map(ligne).join('')
      +(cons.length?'<div class="nxo-conseils">Conseillé — ne bloque pas le feu ('+cons.filter(function(c){ return c.ok===true; }).length+' / '+cons.length+')</div>'+cons.map(ligne).join(''):'')
      +(f.info?'<div class="nxo-note">'+esc(f.info)+'</div>':'')+'</div>';
  }
  /* « Mon suivi » : déclarations Urssaf et envois à la comptable, cochés par toi (datés) */
  function suivi(o,t){
    var m=indexMois(t,o);
    var sel=function(id,lab,val,opts){ return '<label>'+esc(lab)+'<select id="nxo_'+id+'" onchange="nxobjSet(\''+id+'\',this.value)">'+opts.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===val?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')+'</select></label>'; };
    var h='<h3 id="nxo_suivi" style="margin:14px 0 6px;font-size:14px">Mon suivi</h3><div class="nxo-form">'
      +sel('declPeriode','Je déclare mon CA à l’Urssaf',o.declPeriode,[['trim','Chaque trimestre'],['mois','Chaque mois']])
      +sel('envoiPeriode','J’envoie mes pièces à ma comptable',o.envoiPeriode,[['mois','Chaque mois'],['trim','Chaque trimestre']])
      +'</div>';
    if(m<1) return h+'<div class="nxo-note">Le suivi démarre le '+fr(debut(o))+', au début du plan.</div>';
    var D=periodes(o.declPeriode,o,t,true).slice(-5).reverse(), E=periodes(o.envoiPeriode,o,t,false).filter(function(p){ return p.to<t; }).slice(-4).reverse();
    var aJourD=ajour(o.decl);
    var cb=function(fn,id,date,dis){ return '<label style="display:inline-flex;flex-direction:row;gap:6px;align-items:center;font-weight:600;white-space:nowrap;text-transform:none;letter-spacing:0;font-size:13px;color:inherit;margin:0"><input type="checkbox" '+(date?'checked':'')+(dis?' disabled':'')+' onchange="'+fn+'(\''+esc(id)+'\',this.checked)" aria-label="'+esc(id)+'">'+(date?'le '+fr(date):dis?'en cours':'à faire')+'</label>'; };
    var xb=function(type,lab,p){ return '<button class="btn-ghost btn-sm" onclick="nxobjExport(\''+type+'\',\''+p.from+'\',\''+p.to+'\')">'+lab+'</button>'; };
    h+='<div class="nxo-st">Déclarations à l’Urssaf</div><div class="nxo-scroll"><table class="nxo-t nxo-suivi" style="margin-top:8px"><thead><tr><th>Déclaration Urssaf</th><th>Encaissé</th><th>Échéance</th><th>Déclaré</th></tr></thead><tbody>'
      +D.map(function(p){ var fini=p.to<t, late=fini&&!o.decl[p.id]&&p.to>aJourD&&p.ech<t;
        return '<tr data-decl="'+esc(p.id)+'"><td style="white-space:normal">'+esc(p.lab)+'</td><td data-l="Encaissé">'+e0(encHT(p))+(fini?'':' <span style="font-weight:400">à ce jour</span>')+'</td><td data-l="Échéance"'+(late?' style="color:var(--red,#b42318);font-weight:700"':'')+'>'+fr(p.ech)+(p.premiere?' <span style="font-weight:400">(à vérifier)</span>':'')+'</td><td data-l="Déclaré">'+cb('nxobjDecl',p.id,o.decl[p.id],!fini)+'</td></tr>'; }).join('')
      +'</tbody></table></div>'
      +'<div class="nxo-st">Envois à ta comptable</div><div class="nxo-scroll"><table class="nxo-t nxo-suivi" style="margin-top:8px"><thead><tr><th>Envoi à la comptable</th><th>Encaissé</th><th style="text-align:left">Pièces</th><th>Envoyé</th></tr></thead><tbody>'
      +(E.length?E.map(function(p){ return '<tr data-envoi="'+esc(p.id)+'"><td>'+esc(p.lab)+'</td><td data-l="Encaissé">'+e0(encHT(p))+'</td><td class="nxo-pieces" style="text-align:left">'+xb('livre','Livre',p)+' '+xb('facturier','Facturier',p)+' '+xb('synthese','Synthèse',p)+'</td><td data-l="Envoyé">'+cb('nxobjEnvoi',p.id,o.envois[p.id],false)+'</td></tr>'; }).join('')
        :'<tr><td colspan="4" style="text-align:center;color:var(--muted,#667085)">Ta première période n’est pas encore terminée.</td></tr>')
      +'</tbody></table></div>'
      +'<div class="nxo-note">Coche le jour où c’est fait : ClimPilot garde la date et arrête de te le rappeler. « 1re déclaration » : elle regroupe tes premiers mois et se fait au plus tôt le '+fr(j90(o))+' (90 jours après le début) ; l’échéance exacte est sur ton espace Urssaf. Une période plus ancienne que la dernière cochée n’est plus rappelée. Une échéance un samedi, un dimanche ou un jour férié passe au jour ouvré suivant. Montants = encaissements (hors TVA si tu la factures, à confirmer avec ta comptable), essais exclus, avoirs et remboursements compris.</div>';
    return h;
  }

  var ANNEE=null, PERIODE='mois';
  function render(){ return avecCache(render0); }
  function render0(){
    var host=document.getElementById('nxobj'); if(!host) return;
    css(); try{ noteHistorique(); }catch(e){}
    var o=st(), t=today(), m=indexMois(t,o), F=factures(), FX=feux(o,F), sim=simul(o), html='';

    /* 0. à faire maintenant */
    var AF=aFaire(o,F,t); majBadge(AF.filter(function(x){ return x.urg>=1; }).length);
    var btn=function(x){
      if(x.act==='decl') return '<button class="btn-ghost btn-sm" onclick="nxobjDecl(\''+esc(x.id)+'\',true)">C’est déclaré</button>';
      if(x.act==='envoi') return '<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn-ghost btn-sm" onclick="nxobjVoir(\'nxo_suivi\')">Préparer</button><button class="btn-ghost btn-sm" onclick="nxobjEnvoi(\''+esc(x.id)+'\',true)">C’est envoyé</button></span>';
      if(x.act==='impayes') return '<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn-ghost btn-sm" onclick="go(\'recettes\')">Ouvrir</button>'+(typeof window.nxbqChoisir==='function'?'<button class="btn-ghost btn-sm" onclick="nxbqChoisir()">Déjà payées ? Mon relevé</button>':'')+'</span>';
      if(x.act==='treso') return '<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn-ghost btn-sm" onclick="nxobjVoir(\'nxo_tresoMontant\')">Saisir</button>'+(typeof window.nxbqChoisir==='function'?'<button class="btn-ghost btn-sm" onclick="nxbqChoisir()">Depuis mon relevé</button>':'')+'</span>';
      /* modules (1.12) : ouvrir un écran, ou appeler une fonction nx… avec un argument texte */
      if(x.act==='go'&&/^[a-z_]+$/.test(String(x.vue||''))) return '<button class="btn-ghost btn-sm" onclick="go(\''+x.vue+'\')">'+esc(x.btn||'Ouvrir')+'</button>';
      if(x.act==='appel'&&/^nx[A-Za-z0-9_]+$/.test(String(x.fn||''))&&/^[\w:.\-]*$/.test(String(x.arg||''))) return '<button class="btn-ghost btn-sm" onclick="'+x.fn+'(\''+esc(x.arg||'')+'\')">'+esc(x.btn||'Ouvrir')+'</button>';
      return '';
    };
    html+='<div class="card nxo-af" id="nxo_afaire"><h2>À faire maintenant</h2>'+(AF.length?AF.map(function(x){
        return '<div class="nxo-c" data-urg="'+x.urg+'"><span class="nxo-dot '+(x.urg===2?'rouge':x.urg===1?'orange':'gris')+'" style="margin-top:5px"></span><div style="flex:1">'+esc(x.txt)+'</div>'+btn(x)+'</div>'; }).join('')
      :'<div class="nxo-big">Rien d’urgent pour l’instant.</div>')+'</div>';

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

    /* A2. les 3 objectifs de l'année */
    var OA=objectifsAnnee(o,F,t);
    var obj3=function(n,titre,detail,c){ return '<div class="nxo-c"><span class="i" style="font-weight:800">'+n+'</span><div style="flex:1"><div><b>'+esc(titre)+'</b></div><div class="d">'+esc(detail)+'</div></div>'+(c?pill(c,c==='vert'?'OK':c==='orange'?'À pousser':c==='rouge'?'En retard':'—'):'')+'</div>'; };
    if(m>=1&&m<=36){
      var ec=OA.caFait-OA.caAttendu, cc=OA.caFait>=OA.caAttendu?'vert':OA.caFait>=0.85*OA.caAttendu?'orange':'rouge';
      var co=OA.contratsObj?(OA.contrats>=OA.contratsObj?'vert':'orange'):'gris';
      var cl=OA.client, lim=OA.limite, ccl=cl.total>0?(cl.part<=lim?'vert':cl.part<=lim+0.15?'orange':'rouge'):'gris';
      html+='<div class="card"><h2>Mes 3 objectifs — année '+OA.annee+'</h2>'
        +obj3(1,'Facturer '+e0(OA.caAn)+' HT sur l’année','À ce jour : '+e0(OA.caFait)+' facturés pour '+e0(OA.caAttendu)+' attendus → '+(ec>=0?'en avance de ':'en retard de ')+e0(Math.abs(ec))+'.',cc)
        +obj3(2,'Avoir '+OA.contratsFin+' contrats d’entretien actifs en fin d’année','Aujourd’hui : '+OA.contrats+' contrat(s) ; objectif ce mois-ci : '+OA.contratsObj+'. C’est ce qui paiera tes futurs salariés.',co)
        +obj3(3,'Ton plus gros client sous '+Math.round(lim*100)+' % de ton CA',cl.total>0?(cl.nom||'—')+' : '+String(Math.round(cl.part*1000)/10).replace('.',',')+' % du facturé depuis le '+fr(OA.depuisClient)+' (6 derniers mois). Au-delà, tu dépends d’un seul donneur d’ordre.':'Pas encore de facture sur les 6 derniers mois.',ccl)
        +'</div>';
    } else if(m<1){
      html+='<div class="card"><h2>Mes 3 objectifs — année 1</h2>'
        +obj3(1,'Facturer '+e0(OA.caAn)+' HT sur la 1re année','Mois par mois dans « Mon plan sur 3 ans ».','')
        +obj3(2,'Avoir '+OA.contratsFin+' contrats d’entretien actifs au bout de 12 mois','Commerces de bouche, restaurants, supérettes autour de chez toi.','')
        +obj3(3,'Ton plus gros client (WOLF) sous 70 % de ton CA les 6 premiers mois, puis sous 50 %','Pour ne pas dépendre d’un seul donneur d’ordre.','')
        +'</div>';
    }

    html+=ajoutsCartes('apres3',o,t,m);

    /* B. les feux */
    var ordre=m>=1?[FX.apprenti,FX.technicien,FX.societe,FX.lancement]:[FX.lancement,FX.societe,FX.apprenti,FX.technicien];
    html+='<h2 style="margin:6px 0 4px">Mes feux</h2><div class="nxo-note" style="margin:0 0 10px"><b style="color:var(--green,#16794a)">✓</b> rempli · <b style="color:var(--red,#b42318)">✕</b> pas rempli · <b style="color:var(--orange,#b45309)">?</b> il manque une info — calculés par ClimPilot. Les cases à cocher, c’est toi. Règles de gestion proposées, sauf la règle légale du maître d’apprentissage.</div><div class="nxo-row">'+ordre.map(carteFeu).join('')+'</div>';
    html+=ajoutsCartes('apresFeux',o,t,m);

    /* C. à renseigner */
    var inp=function(id,lab,type,val,aide){ return '<label>'+esc(lab)+'<input id="nxo_'+id+'" type="'+type+'" value="'+esc(val==null?'':val)+'" '+(type==='number'?'inputmode="decimal" step="any"':'')+' onchange="nxobjSet(\''+id+'\',this.value)">'+(aide?'<span style="font-weight:400">'+esc(aide)+'</span>':'')+'</label>'; };
    html+='<div class="card"><h2>À renseigner</h2><div class="nxo-form">'
      +inp('tresoMontant','Ma trésorerie aujourd’hui (€)','number',o.tresoMontant,o.tresoDate?'Mise à jour le '+fr(o.tresoDate)+(tresoFraiche(o)?'':' — à refaire'):'Solde du compte pro + réserve')
      +inp('eiFermeture','Fermeture de mon ancienne EI','date',o.eiFermeture,'Date de l’avis de radiation : elle décide de ton droit à l’ACRE')
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
      +'<label>Son camion<select id="nxo_sim_camion" onchange="nxobjSim(\'camion\',this.value)"><option value="0"'+(Number(s.camion)?'':' selected')+'>En binôme (mon camion)</option><option value="1"'+(Number(s.camion)?' selected':'')+'>Son camion (+13 600 €/an)</option></select></label>'
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
    var PER=[['mois','Mois dernier',pm],['trim','Trimestre dernier',pq],['trimc','Trimestre en cours',{from:iso(y0,q*3,1),to:iso(y0,q*3+3,0)}],['annee','Année dernière',pa],['anneec','Année en cours',{from:y0+'-01-01',to:y0+'-12-31'}]];
    if(!PERIODE||!PER.some(function(x){ return x[0]===PERIODE; })) PERIODE='mois';
    var pc=PER.filter(function(x){ return x[0]===PERIODE; })[0][2];
    html+='<div class="card"><h2>Pour la comptable</h2>'
      +'<div class="nxo-scroll"><table class="nxo-t"><thead><tr><th>Quand</th><th style="text-align:left">Quoi envoyer</th></tr></thead><tbody>'
      +'<tr><td>'+(o.envoiPeriode==='trim'?'Chaque trimestre':'Chaque mois')+'</td><td style="text-align:left;white-space:normal">À ta comptable : livre des recettes, facturier, synthèse + tes factures d’achat (photos ou PDF, classées par date). Rythme à convenir avec elle (réglage ci-dessous).</td></tr>'
      +'<tr><td>'+(o.declPeriode==='mois'?'Chaque mois':'Chaque trimestre')+'</td><td style="text-align:left;white-space:normal">À l’Urssaf : déclarer le chiffre d’affaires <b>encaissé</b>, même s’il est à 0 €, avant le '+(o.declPeriode==='mois'?'dernier jour du mois suivant':'30/04, 31/07, 31/10 ou 31/01')+'. Montant et échéance dans « Mon suivi » ci-dessous ; la date affichée sur ton espace Urssaf fait foi.</td></tr>'
      +'<tr><td>Chaque année (janvier)</td><td style="text-align:left;white-space:normal">Pack de l’année + point du mois de décembre. Conservation : 10 ans pour le livre des recettes et les pièces.</td></tr>'
      +'</tbody></table></div>'
      +suivi(o,t)
      +'<h3 style="margin:14px 0 4px;font-size:14px">Contrôles avant envoi</h3>'
      +ctl.map(function(c){ return '<div class="nxo-c">'+ico(c.ok)+'<div><div>'+esc(c.label)+'</div><div class="d">'+esc(c.detail)+'</div></div></div>'; }).join('')
      +'<h3 style="margin:14px 0 6px;font-size:14px">Exports</h3><div class="nxo-form" style="grid-template-columns:minmax(0,380px)"><label>Période<select id="nxo_periode" onchange="nxobjPeriode(this.value)">'+PER.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===PERIODE?' selected':'')+'>'+esc(x[1])+' ('+fr(x[2].from)+' → '+fr(x[2].to)+')</option>'; }).join('')+'</select></label></div>'
      +'<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxobjExport(\'livre\',\''+pc.from+'\',\''+pc.to+'\')">Livre des recettes (CSV)</button><button class="btn-ghost btn-sm" onclick="nxobjExport(\'facturier\',\''+pc.from+'\',\''+pc.to+'\')">Facturier (CSV)</button><button class="btn-ghost btn-sm" onclick="nxobjExport(\'synthese\',\''+pc.from+'\',\''+pc.to+'\')">Synthèse (PDF)</button><button class="btn-ghost btn-sm" onclick="nxobjExport(\'mail\',\''+pc.from+'\',\''+pc.to+'\')">Mail à la comptable</button></div>'
      +'<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxobjPointMois()">Point du mois (PDF)</button><button class="btn-ghost btn-sm" onclick="go(\'nx_regime\')">Ouvrir « Statut & régime »</button></div>'
      +ajoutsCartes('comptable',o,t,m)
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
      +rin('coutKm','Mon coût du km (€)',o.coutKm||'','Pour chiffrer les km de SAV non facturés : carburant + entretien + assurance du camion ÷ km par an')
      +'</div><div class="row-actions" style="margin-top:10px"><button class="btn-ghost btn-sm" onclick="nxobjReset()">Remettre les hypothèses du plan</button></div></details>';

    host.innerHTML=html;
  }
  window.nxobjRender=render;

  /* ---------- actions ---------- */
  var DATES=['debut','diplomeDate','societeDate','apprentiDate','techDate','eiFermeture'];
  window.nxobjSet=function(k,v){
    var o=st();
    if(DATES.indexOf(k)>=0){ if(v&&!okDate(v)){ say('Date invalide'); return render(); } o[k]=v||''; }
    else if(k==='declPeriode'||k==='envoiPeriode') o[k]=v==='mois'?'mois':'trim';
    else if(k==='camionActif') o.camionActif=v==='1'||v===true;
    else if(k==='tresoMontant'){ if(v===''){ o.tresoMontant=null; o.tresoDate=''; } else { var n=num(v); if(n<0&&!confirm('Trésorerie négative : c’est bien ça ?')) return render(); o.tresoMontant=n; o.tresoDate=today(); } }
    else if(Object.prototype.hasOwnProperty.call(DEF,k)){ var x=num(v); if(x<0){ say('Valeur négative refusée'); return render(); } o[k]=x; }
    else return;
    stSave(o); render(); say('Enregistré');
  };
  window.nxobjSim=function(k,v){ var o=st(); var x=num(v); if(k!=='camion'&&x<0){ say('Valeur négative refusée'); return render(); } if(k==='fact'&&(x<=0||x>100)){ say('Entre 1 et 100 %'); return render(); } if(k==='marge'&&x>=90){ say('Marge trop élevée'); return render(); } o.sim[k]=x; stSave(o); render(); };
  window.nxobjCheck=function(k,on){ setMark('check',k,on?{d:today()}:null); render(); };
  window.nxobjDecl=function(id,on){ setMark('decl',id,on?{d:today()}:null); render(); say(on?'Déclaration notée le '+fr(today()):'Déclaration décochée'); };
  window.nxobjEnvoi=function(id,on){ setMark('envoi',id,on?{d:today()}:null); render(); say(on?'Envoi noté le '+fr(today()):'Envoi décoché'); };
  window.nxobjVoir=function(id){ var e=document.getElementById(id); if(!e) return; try{ e.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_){ e.scrollIntoView(); } if(e.tagName==='INPUT') try{ e.focus({preventScroll:true}); }catch(_){} };
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
  window.nxobjPointMois=function(k){ return avecCache(function(){ return pointMois(k); }); };
  function pointMois(k){
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
  function bandeauDash(){ return avecCache(bandeauDash0); }
  function bandeauDash0(){
    try{
      var k=document.getElementById('dashKpis'); if(!k) return; var el=document.getElementById('nxobjDash');
      if(!el){ el=document.createElement('div'); el.id='nxobjDash'; el.className='card'; el.style.padding='12px 16px'; k.parentNode.insertBefore(el,k); }
      css(); var o=st(), t=today(), m=indexMois(t,o), txt;
      if(m<1){ var FX=feux(o,[],true), cl=bloquants(FX.lancement.conditions), ok=cl.filter(function(c){ return c.ok===true; }).length;
        txt='<span><b>Lancement le '+fr(debut(o))+'</b> — dans '+joursEntre(t,debut(o))+' jours · '+ok+' / '+cl.length+' points prêts</span>'; }
      else if(m>36) txt='<span><b>Plan de 3 ans terminé</b> — refais tes objectifs</span>';
      else { var ob=objectif(m,o), pl=plancher(m,o), r=realise(ym(t)), c=r.facture>=ob.ca?'vert':r.facture>=pl.montant?'orange':'rouge';
        txt='<span><span class="nxo-dot '+c+'" style="width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;background:var(--'+(c==='vert'?'green':c==='orange'?'orange':'red')+')"></span><b>Objectif '+esc(labMois(ym(t),true))+' : '+e0(ob.ca)+' HT</b> · facturé '+e0(r.facture)+' · plancher '+e0(pl.montant)+'</span>'; }
      var n=nbUrgent(); majBadge(n);
      el.innerHTML='<div class="nxo-l">'+txt+(n?'<span style="color:var(--red,#b42318);font-weight:700">'+n+' chose'+(n>1?'s':'')+' à faire</span>':'')+'<button class="btn-ghost btn-sm" onclick="go(\''+VUE+'\')">Mes objectifs & feux</button></div>';
    }catch(e){}
  }
  window.nxobjBandeau=bandeauDash;

  /* ---------- branchement ---------- */
  function lienNav(){
    var nav=document.getElementById('nav'); if(!nav||nav.querySelector('a[data-v="'+VUE+'"]')) return;
    var a=document.createElement('a'); a.setAttribute('data-v',VUE); a.innerHTML='<span class="ico">🎯</span><span class="txt">Objectifs & feux</span><span class="badge" id="nxobjBadge" title="Choses à faire (déclaration, envoi à la comptable, impayés)" style="display:none">0</span>';
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
      if(typeof window.updateBadges==='function'&&!window.updateBadges._nxobj){
        var ub=window.updateBadges; window.updateBadges=function(){ var r=ub.apply(this,arguments); try{ majBadge(); }catch(e){} return r; }; window.updateBadges._nxobj=true;
      }
      setTimeout(function(){ lienNav(); try{ noteHistorique(); }catch(e){} try{ majBadge(); }catch(e){} },1500);
    }catch(e){ try{ console.error('ClimPilot next-objectifs init',e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
