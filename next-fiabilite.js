/* ============================================================
   ClimPilot Next — next-fiabilite.js
   Petits garde-fous transversaux (couche additive, chargée en dernier) :
   1. Un champ de formulaire ne reçoit plus jamais le texte « undefined »
      (ex. fiche ouverte sans téléphone → « undefined » réenregistré).
   2. Les fiches incomplètes (clients, devis, interventions, locations,
      fluides…) reçoivent des valeurs vides par défaut, en mémoire :
      plus de « undefined » ni de « NaN kg » dans les listes et PDF.
   3. Le bandeau « Sauvegarde jamais faite — tes données ne vivent que
      sur cet ordinateur » ne s'affiche plus quand le cloud est connecté
      (synchro + sauvegardes automatiques serveur et Drive).
   ============================================================ */
(function(){
  'use strict';

  /* 1. valeur de champ : undefined / null → vide */
  ['HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement'].forEach(function(n){
    try{
      var proto=window[n]&&window[n].prototype; if(!proto) return;
      var d=Object.getOwnPropertyDescriptor(proto,'value'); if(!d||!d.set||d.set._nxf) return;
      var set=function(v){ return d.set.call(this,v==null?'':v); }; set._nxf=true;
      Object.defineProperty(proto,'value',{configurable:true,enumerable:d.enumerable,get:d.get,set:set});
    }catch(e){}
  });

  /* 2. valeurs par défaut des fiches (en mémoire, sans réécrire le stockage) */
  function fill(list,strs,nums){
    if(!Array.isArray(list)) return;
    list.forEach(function(o){
      if(!o||typeof o!=='object') return;
      (strs||[]).forEach(function(k){ if(o[k]==null) o[k]=''; });
      (nums||[]).forEach(function(k){ if(o[k]==null||o[k]===''||isNaN(Number(o[k]))) o[k]=0; else if(typeof o[k]==='string') o[k]=Number(o[k]); });
    });
  }
  function normalize(){
    try{ fill(CLIENTS,['nom','tel','mail','adr','ville','siren','notes']); CLIENTS.forEach(function(c){ if(!c.type) c.type='Particulier'; }); }catch(e){}
    try{ fill(DEVIS.filter(function(d){ return d&&d.v!==2; }),['cNom','cTel','cMail','cAdr','cVille','cSiren','notes']); }catch(e){}
    try{ fill(DEVIS.filter(function(d){ return d&&d.v===2; }),['cNom','cTel','cMail','cAdr','cVille','cSiren','notes']); }catch(e){}
    try{ fill(DEP,['cNom','cTel','cMail','cAdr','cVille','cSiren','notes']); }catch(e){}
    try{ fill(LOC,['cNom','cTel','cMail','cAdr','cVille','notes']); }catch(e){}
    try{ fill(CTR,['clientNom','type']); }catch(e){}
    try{ fill(EQUIP,['client','type','marque','modele','fluide','serie']); }catch(e){}
    try{ fill(FLU,['num','client','desc','fluide','nature','ctrl'],['qv','qrec','qreg','qrt','qru','charge']); }catch(e){}
  }
  normalize();

  /* 3. rappel de sauvegarde : inutile (et faux) quand le cloud est connecté */
  function cloudOn(){ try{ return typeof SESS!=='undefined'&&!!SESS; }catch(e){ return false; } }
  if(typeof window.checkBackup==='function'){
    var _cb=window.checkBackup;
    window.checkBackup=function(){
      if(cloudOn()){ var b=document.getElementById('bkbanner'); if(b){ b.className='syncbanner'; b.innerHTML=''; } return; }
      return _cb.apply(this,arguments);
    };
  }
  if(typeof window.afterLogin==='function'){
    var _al=window.afterLogin;
    window.afterLogin=function(){ var r=_al.apply(this,arguments); try{ window.checkBackup(); }catch(e){} return r; };
  }
  /* 4. une facture émise ne disparaît pas : suppression bloquée (elle s'annule par un avoir) */
  function facsOf(kind,id){
    try{
      if(kind==='devis'){ var d=DEVIS.find(function(x){ return x.id===id; }); return d?[d.facAcompte,d.facSolde].filter(Boolean).map(function(f){ return f.num; }):[]; }
      if(kind==='dep'){ var x=DEP.find(function(o){ return o.id===id; }); return x&&x.facNum?[x.facNum]:[]; }
      if(kind==='loc'){ var l=LOC.find(function(o){ return o.id===id; }); return l&&l.fac?[l.fac.num]:[]; }
      if(kind==='ctr'){ var c=CTR.find(function(o){ return o.id===id; }); return c?(c.facs||[]).map(function(f){ return f.num; }):[]; }
    }catch(e){}
    return [];
  }
  function guardDel(fn,kind,what){
    var o=window[fn]; if(typeof o!=='function'||o._nxf) return;
    var w=function(id){
      var f=facsOf(kind,id);
      if(f.length){ try{ toast('⛔ '+what+' avec facture émise ('+f.join(', ')+') : il reste dans ClimPilot, car une facture ne se supprime pas (elle s\'annule par un avoir).'); }catch(e){} return; }
      return o.apply(this,arguments);
    }; w._nxf=true; window[fn]=w;
  }
  /* 5. dupliquer un devis ne recopie ni ses factures, ni sa signature, ni son suivi */
  var RESET=['facAcompte','facSolde','signature','signLink','sentAt','relances','datePlanif','matReserve','hReel','achatReel','refus','acceptedAt','updatedAt','_inboxId','_baseStatut','_statutSet','ctrFaits','figEnv'];
  function guardDup(){
    var o=window.dupDevis; if(typeof o!=='function'||o._nxf) return;
    var w=function(id){
      var n0=(DEVIS||[]).length, r=o.apply(this,arguments);
      try{
        if(DEVIS.length>n0){
          var d=DEVIS[DEVIS.length-1]; RESET.forEach(function(k){ delete d[k]; }); d.statut='brouillon';
          if(d.v===2&&window.NXD2){ (d.lots||[]).forEach(function(l){ try{ l.id=uid(); }catch(e){} }); d.num=NXD2.numFor(d); NXD2.derive(d); }
          save(LS.devis,DEVIS); if(typeof renderList==='function') renderList(); try{ updateBadges(); }catch(e){}
        }
      }catch(e){}
      return r;
    }; w._nxf=true; window.dupDevis=w;
  }
  /* 6. numéro de facture : jamais en dessous du plus grand numéro déjà émis.
        Deux appareils (téléphone + PC) ont chacun leur compteur ; après une synchro, celui d'un appareil peut être en retard
        sur les factures reçues de l'autre → il redonnerait un numéro déjà pris. On repart donc du plus grand numéro existant. */
  function facNumsAll(){
    var a=[];
    try{ (DEVIS||[]).forEach(function(d){ [d.facAcompte,d.facSolde].forEach(function(f){ if(f&&f.num) a.push(f.num); }); }); }catch(e){}
    try{ (DEP||[]).forEach(function(x){ if(x&&x.facNum) a.push(x.facNum); }); }catch(e){}
    try{ (LOC||[]).forEach(function(l){ if(l&&l.fac&&l.fac.num) a.push(l.fac.num); }); }catch(e){}
    try{ (CTR||[]).forEach(function(c){ ((c&&c.facs)||[]).forEach(function(f){ if(f&&f.num) a.push(f.num); }); }); }catch(e){}
    return a;
  }
  window.nxFacNumsAll=facNumsAll;
  function guardFacNum(){
    var o=window.nextFacNum; if(typeof o!=='function'||o._nxf) return;
    var w=function(){
      try{
        var y=new Date().getFullYear(), mx=0, re=new RegExp('^F-'+y+'-(\\d+)$');
        facNumsAll().forEach(function(n){ var m=String(n).match(re); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
        var sq=load(LS.facseq,{year:y,seq:0}); if(!sq||sq.year!==y) sq={year:y,seq:0};
        if(mx>(Number(sq.seq)||0)){ sq.seq=mx; save(LS.facseq,sq); }
      }catch(e){}
      return o.apply(this,arguments);
    }; w._nxf=true; window.nextFacNum=w;
  }
  /* 7. une facture d'intervention émise ne bouge plus.
        Avant : le montant était recalculé à chaque affichage avec les tarifs du moment → un changement de tarif ou une pièce
        ajoutée après coup changeait la facture (et le livre des recettes) sous le même numéro.
        Maintenant : à l'émission, le calcul et le contenu imprimé sont figés (facFig) ; la fiche est verrouillée.
        Correction possible (facture pas encore envoyée) : bouton « Corriger », la facture est refigée et la modification tracée. */
  var BILL=['cNom','cTel','cMail','cType','cAdr','cVille','cSiren','date','desc','itype','mode','panne','heures','zone','maj','rateChoice','rateCustom',
    'mesMode','mesType','heuresSup','nbRaccords','optRoute','optRaccords','optVide','optAzote','optEtanch','optAppoint','optConso','optPv','pieces','urgence','consoMode'];
  function cl(o){ return o==null?o:JSON.parse(JSON.stringify(o)); }
  function frozen(d){ return !!(d&&d.facNum&&d.facFig&&d.facFig.num===d.facNum); }
  var _cd=null;
  function freezeOf(d,extra){ var r=cl(_cd(d)); r.num=d.facNum; r.at=Date.now(); r.src={}; BILL.forEach(function(k){ if(d[k]!==undefined) r.src[k]=cl(d[k]); }); return Object.assign(r,extra||{}); }
  function lockDepForm(){
    try{
      var v=document.getElementById('v-depform'); if(!v||typeof curDep==='undefined'||!curDep) return;
      var old=document.getElementById('nxfLock'); if(old) old.remove();
      var locked=frozen(curDep)&&!curDep._unlock;
      v.querySelectorAll('.card').forEach(function(c){
        if(c.querySelector('#dp_notes')||c.id==='dp_recap'||c.id==='dp_sante') return;
        c.querySelectorAll('input,select,textarea,button').forEach(function(el){
          if(locked){ if(!el.disabled){ el.disabled=true; el.setAttribute('data-nxf-lock',''); } }
          else if(el.hasAttribute('data-nxf-lock')){ el.disabled=false; el.removeAttribute('data-nxf-lock'); } });
      });
      if(!frozen(curDep)) return;
      var b=document.createElement('div'); b.id='nxfLock'; b.className='warnbox'; b.style.margin='0 0 12px';
      b.innerHTML=locked?'🔒 <b>Facture '+curDep.facNum+' émise</b>'+(curDep.facDate?' le '+new Date(curDep.facDate+'T00:00:00').toLocaleDateString('fr-FR'):'')+' : son contenu et son montant sont figés (une facture émise ne se modifie pas ; une erreur se corrige par un avoir). Tu peux toujours modifier les notes internes. '+
        '<button type="button" class="btn-ghost btn-sm" onclick="nxfUnlockDep()">Corriger (facture pas encore envoyée)</button>'
        :'✏️ <b>Correction de la facture '+curDep.facNum+'</b> : à l\'enregistrement, la facture est refigée avec ces nouvelles valeurs et la modification est tracée (avant / après).';
      var head=v.querySelector('.flexhead'); if(head&&head.nextSibling) v.insertBefore(b,head.nextSibling); else v.insertBefore(b,v.firstChild);
    }catch(e){}
  }
  window.nxfUnlockDep=function(){
    try{ if(!curDep||!frozen(curDep)) return;
      if(!confirm('Corriger la facture '+curDep.facNum+' ?\nÀ faire seulement si elle n\'a pas encore été envoyée au client. Sinon, la règle est de faire un avoir.')) return;
      curDep._unlock=true; loadDepForm(); }catch(e){}
  };
  function guardDepFreeze(){
    var o=window.computeDep; if(typeof o!=='function'||o._nxf) return;
    _cd=o;
    var w=function(d){ if(frozen(d)){ var r=cl(d.facFig); ['num','at','src','migre'].forEach(function(k){ delete r[k]; }); return r; } return _cd.apply(this,arguments); };
    w._nxf=true; window.computeDep=w;
    /* le formulaire relit l'écran : sur une facture figée, le contenu facturé reste celui de la facture */
    var f2d=window.formToDep;
    if(typeof f2d==='function'&&!f2d._nxf){ var wf=function(){ var r=f2d.apply(this,arguments); try{ if(curDep&&frozen(curDep)&&!curDep._unlock&&curDep.facFig.src) Object.assign(curDep,cl(curDep.facFig.src)); }catch(e){} return r; }; wf._nxf=true; window.formToDep=wf; }
    var ldf=window.loadDepForm;
    if(typeof ldf==='function'&&!ldf._nxf){ var wl=function(){ var r=ldf.apply(this,arguments); lockDepForm(); return r; }; wl._nxf=true; window.loadDepForm=wl; }
    var sd=window.saveDep;
    if(typeof sd==='function'&&!sd._nxf){ var ws=function(){
        try{ if(curDep&&frozen(curDep)&&curDep._unlock){ window.formToDep(); var av=curDep.facFig.totalHT, nf=freezeOf(curDep); (curDep.facModifs=curDep.facModifs||[]).push({at:Date.now(),avant:av,apres:nf.totalHT}); curDep.facFig=nf; delete curDep._unlock; } }catch(e){}
        var r=sd.apply(this,arguments); lockDepForm(); return r; }; ws._nxf=true; window.saveDep=ws; }
    var fd=window.factureDep;
    if(typeof fd==='function'&&!fd._nxf){ var wd=function(){
        var r=fd.apply(this,arguments);
        try{ if(curDep&&curDep.facNum&&!frozen(curDep)){ curDep.facFig=freezeOf(curDep); var x=(DEP||[]).find(function(q){ return q.id===curDep.id; }); if(x){ x.facFig=cl(curDep.facFig); save(LS.dep,DEP); } lockDepForm(); try{ recalcDep(); }catch(e){} } }catch(e){}
        return r; }; wd._nxf=true; window.factureDep=wd; }
    var dd=window.dupDep;
    if(typeof dd==='function'&&!dd._nxf){ var wdd=function(){ var n0=(DEP||[]).length, r=dd.apply(this,arguments); try{ if(DEP.length>n0){ var x=DEP[DEP.length-1]; delete x.facFig; delete x.facModifs; delete x.devisRep; save(LS.dep,DEP); } }catch(e){} return r; }; wdd._nxf=true; window.dupDep=wdd; }
    /* interventions déjà facturées avant cette version : figées une fois, avec les valeurs affichées aujourd'hui */
    try{ var n=0; (DEP||[]).forEach(function(x){ if(x&&x.facNum&&!frozen(x)){ x.facFig=freezeOf(x,{migre:true}); n++; } }); if(n) save(LS.dep,DEP); }catch(e){}
  }
  window.nxfDepFrozen=frozen;

  /* 8. le montant envoyé au client est gardé (figEnv). Si, au moment de facturer, le devis donne autre chose
        (modifié après l'envoi, tarifs changés entre-temps, calcul corrigé par une mise à jour), ClimPilot le dit
        au lieu de facturer en silence un autre montant que celui que le client a vu. */
  function figReady(d){ if(!d||typeof window.compute!=='function') return false; if(d.v!==2) return true; var M=(window.NXD2&&window.NXD2.modules)||{}; return (d.lots||[]).length>0&&(d.lots||[]).every(function(l){ return !!M[l.module]; }); }
  function figOf(d){ var c=window.compute(cl(d)), b=typeof window.nxBillTotal==='function'?window.nxBillTotal(d,c):c.totalTTC; return {ht:Math.round(c.totalHT*100)/100,ttc:Math.round(c.totalTTC*100)/100,bill:Math.round(b*100)/100}; }
  function stampFig(d){
    if(!d) return false;
    if((d.statut==='brouillon'||d.statut==='verifier'||d.statut==='pret')&&d.figEnv&&!d.facAcompte&&!d.facSolde){ delete d.figEnv; return true; }   /* repassé en préparation : la prochaine version envoyée fera foi */
    if(d.statut!=='envoye'&&d.statut!=='accepte') return false;
    var f=d.figEnv, sl=(d.signLink&&Number(d.signLink.at))||0;
    if(f&&!(sl>Number(f.at||0))) return false;            /* déjà gardé ; un nouveau lien de signature = nouvelle version envoyée */
    if(!figReady(d)) return false;
    try{ d.figEnv=Object.assign(figOf(d),{at:Date.now(),statut:d.statut}); return true; }catch(e){ return false; }
  }
  function stampAll(){ try{ var n=0; (DEVIS||[]).forEach(function(d){ if(stampFig(d)) n++; }); if(n) save(LS.devis,DEVIS); return n; }catch(e){ return 0; } }
  window.nxfStampFig=stampAll;
  /* appelé par facturerDevis : true = on peut facturer ce montant */
  window.nxFigCheck=function(d,tot){
    try{ stampFig(d); var f=d&&d.figEnv; if(!f||Math.abs(Number(tot)-Number(f.bill))<=0.01) return true;
      var dt=new Date(Number(f.at)).toLocaleDateString('fr-FR'), e=function(x){ return (typeof eur==='function')?eur(x):(Math.round(x*100)/100)+' €'; };
      return confirm('Attention : ce devis a été '+(f.statut==='accepte'?'accepté par':'envoyé à')+' ton client pour '+e(f.bill)+' ('+dt+').\nIl donne maintenant '+e(tot)+' (devis modifié ou tarifs changés depuis).\n\nOK = facturer '+e(tot)+'\nAnnuler = ne rien facturer et vérifier le devis d\'abord');
    }catch(err){ return true; }
  };
  function guardFig(tries){
    tries=tries||0;
    var g=window.go; if(typeof g==='function'&&!g._nxfig){ var wg=function(){ try{ stampAll(); }catch(e){} return g.apply(this,arguments); }; wg._nxfig=true; Object.keys(g).forEach(function(k){ wg[k]=g[k]; }); window.go=wg; }
    var n=window.nxd2; if(n){ ['save','statut','sign'].forEach(function(k){ var o=n[k]; if(typeof o!=='function'||o._nxfig) return; var w=function(){ var r=o.apply(this,arguments); try{ setTimeout(stampAll,0); }catch(e){} return r; }; Object.keys(o).forEach(function(q){ w[q]=o[q]; }); w._nxfig=true; n[k]=w; }); }
    else if(tries<30) setTimeout(function(){ guardFig(tries+1); },300);
  }
  function boot(){ try{ normalize(); window.checkBackup&&window.checkBackup();
    guardDel('delDevis','devis','Devis'); guardDel('delDep','dep','Intervention'); guardDel('delLoc','loc','Location'); guardDel('delCtr','ctr','Contrat'); guardDup(); guardFacNum(); }catch(e){}
    try{ guardDepFreeze(); }catch(e){}
    try{ guardFig(0); setTimeout(stampAll,3000); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
  /* la session cloud arrive un peu après le démarrage */
  var tries=0, iv=setInterval(function(){ tries++; if(cloudOn()||tries>30){ clearInterval(iv); try{ window.checkBackup&&window.checkBackup(); }catch(e){} } },1000);
})();
