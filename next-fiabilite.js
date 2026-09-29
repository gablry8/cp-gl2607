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
  var RESET=['facAcompte','facSolde','signature','signLink','sentAt','relances','datePlanif','matReserve','hReel','achatReel','refus','acceptedAt','updatedAt','_inboxId','_baseStatut','_statutSet'];
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
  function boot(){ try{ normalize(); window.checkBackup&&window.checkBackup();
    guardDel('delDevis','devis','Devis'); guardDel('delDep','dep','Intervention'); guardDel('delLoc','loc','Location'); guardDel('delCtr','ctr','Contrat'); guardDup(); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
  /* la session cloud arrive un peu après le démarrage */
  var tries=0, iv=setInterval(function(){ tries++; if(cloudOn()||tries>30){ clearInterval(iv); try{ window.checkBackup&&window.checkBackup(); }catch(e){} } },1000);
})();
