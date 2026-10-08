/* ============================================================
   ClimPilot Next — next-store.js  (chargé en PREMIER, dans <head>) — 01/10/2026
   GRANDE MÉMOIRE : les données ne sont plus limitées aux ~5 millions de
   caractères du « localStorage » (limite de l'iPhone). Elles vivent dans
   IndexedDB, la base de données intégrée au navigateur (gratuite, sur
   l'appareil, des centaines de fois plus grande).

   Comment :
   - Au démarrage, la base est lue en entier en mémoire, PUIS l'application
     est lancée (ses scripts sont marqués type="text/x-climpilot" et exécutés
     ici, dans le même ordre, avec les mêmes événements de démarrage).
   - Le code de l'appli continue d'utiliser localStorage : ses lectures et
     écritures sont redirigées vers la mémoire + IndexedDB.
   - Double sécurité : chaque écriture est AUSSI faite dans le localStorage
     tant qu'il reste de la place (sinon seule IndexedDB la garde).
   - Fusion au démarrage par numéro d'ordre : la version la plus récente de
     chaque donnée gagne (y compris si une ancienne version de l'appli a
     écrit entre-temps).
   - Si IndexedDB ne répond pas : l'appli tourne sur le localStorage, SAUF si
     des données n'existent que dans IndexedDB → écran « rouvre l'appli »
     (jamais d'appli lancée avec des données manquantes).
   ============================================================ */
(function(){
  'use strict';
  var W=window, NATIVE={}, SP=Storage.prototype;
  ['getItem','setItem','removeItem','key','clear'].forEach(function(m){ NATIVE[m]=SP[m]; });
  var LEN=Object.getOwnPropertyDescriptor(SP,'length');
  var LSO=null; try{ LSO=W.localStorage; }catch(e){}
  var KS='__nxks', DBN='climpilot-store', ST='kv', OPEN_MS=3500;
  var MAP=null, SEQ=0, KSM={}, db=null, mode='init', pending={}, flushT=null, flushP=Promise.resolve(), failed=0;
  W.__native={get:NATIVE.getItem,set:NATIVE.setItem,remove:NATIVE.removeItem}; /* accès direct (diagnostic / tests) */
  var STORE=W.nxStore={mode:'init',flush:function(){ return doFlush(); },info:function(){ return {mode:mode,keys:MAP?MAP.size:null,seq:SEQ,lectureSeule:!!RO}; }};
  /* 1.10 — écritures suspendues : pendant fn(), ce qui est écrit reste en mémoire puis est jeté
     (essai « à blanc » d'une fonction de facturation, voir next-emission.js) */
  var OVL=null, RO=false;
  STORE.suspend=function(fn){ var prev=OVL; OVL=new Map(); try{ return fn(); } finally{ OVL=prev; } };
  STORE.lectureSeule=function(){ return RO; };

  function nGet(k){ try{ return NATIVE.getItem.call(LSO,k); }catch(e){ return null; } }
  function nSet(k,v){ NATIVE.setItem.call(LSO,k,v); }
  function nDel(k){ try{ NATIVE.removeItem.call(LSO,k); }catch(e){} }
  function nKeys(){ var a=[]; try{ var n=LEN.get.call(LSO); for(var i=0;i<n;i++){ var k=NATIVE.key.call(LSO,i); if(k!=null) a.push(k); } }catch(e){} return a; }
  function internal(k){ return k===KS||k.indexOf('__nx')===0; }
  function h(s){ s=String(s); var x=0x811c9dc5; for(var i=0;i<s.length;i++){ x^=s.charCodeAt(i); x=Math.imul(x,16777619); } return (x>>>0).toString(36)+'.'+s.length; }
  function loadKS(){ try{ var o=JSON.parse(nGet(KS)||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
  function saveKS(){ try{ nSet(KS,JSON.stringify(KSM)); }catch(e){} }

  /* ---------- écriture ---------- */
  function track(k,v,deleted){
    SEQ++;
    var nativeOk=false;
    if(deleted){ nDel(k); KSM[k]={s:SEQ,d:1}; nativeOk=true; }
    else{
      try{ nSet(k,v); nativeOk=true; KSM[k]={s:SEQ,h:h(v)}; }
      catch(e){ nDel(k); KSM[k]={s:SEQ,o:1}; } /* trop gros pour le localStorage : seulement dans IndexedDB */
    }
    saveKS();
    return nativeOk;
  }
  function queue(k,v){
    pending[k]=v===null?null:{k:k,v:v,s:SEQ};
    if(!flushT) flushT=setTimeout(doFlush,0);
  }
  function doFlush(){
    if(flushT){ clearTimeout(flushT); flushT=null; }
    var batch=pending; pending={};
    var keys=Object.keys(batch); if(!keys.length||!db) return flushP;
    flushP=flushP.then(function(){ return new Promise(function(res){
      var tx; try{ tx=db.transaction(ST,'readwrite'); }catch(e){ return fail(e,batch,res); }
      var os=tx.objectStore(ST);
      keys.forEach(function(k){ if(batch[k]===null) os.delete(k); else os.put(batch[k]); });
      os.put({k:'__nxseq',v:String(SEQ),s:SEQ});
      tx.oncomplete=function(){ failed=0; res(); };
      tx.onerror=tx.onabort=function(){ fail(tx.error,batch,res); };
    }); });
    return flushP;
  }
  function fail(e,batch,res){
    failed++;
    if(failed<=2){ Object.keys(batch).forEach(function(k){ if(!(k in pending)) pending[k]=batch[k]; }); setTimeout(doFlush,400); }
    else{
      /* ce qui n'a pas pu aller dans la base ET n'est pas dans le localStorage est en danger : alerte rouge */
      var lost=Object.keys(batch).filter(function(k){ return KSM[k]&&KSM[k].o; });
      if(lost.length) try{ if(typeof W.nxStorageFail==='function') W.nxStorageFail(lost.join(','),e); }catch(_){}
    }
    res();
  }

  /* ---------- localStorage redirigé ---------- */
  function isLS(o){ return LSO&&o===LSO; }
  function install(){
    SP.getItem=function(k){ if(!isLS(this)) return NATIVE.getItem.call(this,k); k=String(k); if(internal(k)) return NATIVE.getItem.call(this,k); if(OVL&&OVL.has(k)){ var o=OVL.get(k); return o===undefined?null:o; } var v=MAP.get(k); return v===undefined?null:v; };
    SP.setItem=function(k,v){ if(!isLS(this)) return NATIVE.setItem.call(this,k,v); k=String(k); v=String(v); if(internal(k)) return NATIVE.setItem.call(this,k,v);
      if(OVL){ OVL.set(k,v); return; }
      if(RO){ MAP.set(k,v); return; } /* onglet en lecture seule : rien n'est enregistré */
      if(mode==='local'){ nSet(k,v); MAP.set(k,v); SEQ++; KSM[k]={s:SEQ,h:h(v)}; saveKS(); return; } /* secours : erreurs de place transmises telles quelles */
      MAP.set(k,v); track(k,v,false); queue(k,v); };
    SP.removeItem=function(k){ if(!isLS(this)) return NATIVE.removeItem.call(this,k); k=String(k); if(internal(k)) return NATIVE.removeItem.call(this,k);
      if(OVL){ OVL.set(k,undefined); return; }
      if(RO){ MAP.delete(k); return; }
      MAP.delete(k); if(mode==='local'){ nDel(k); SEQ++; KSM[k]={s:SEQ,d:1}; saveKS(); return; } track(k,null,true); queue(k,null); };
    SP.key=function(i){ if(!isLS(this)) return NATIVE.key.call(this,i); var a=Array.from(MAP.keys()); return a[i]===undefined?null:a[i]; };
    SP.clear=function(){ if(!isLS(this)) return NATIVE.clear.call(this); Array.from(MAP.keys()).forEach(function(k){ SP.removeItem.call(LSO,k); }); };
    Object.defineProperty(SP,'length',{configurable:true,enumerable:true,get:function(){ return isLS(this)?MAP.size:LEN.get.call(this); }});
  }

  /* ---------- démarrage : lecture + fusion ---------- */
  function openDB(){
    return new Promise(function(res,rej){
      if(!W.indexedDB) return rej(new Error('IndexedDB absent'));
      var done=false, t=setTimeout(function(){ if(!done){ done=true; rej(new Error('IndexedDB ne répond pas')); } },OPEN_MS);
      var r; try{ r=indexedDB.open(DBN,1); }catch(e){ clearTimeout(t); return rej(e); }
      r.onupgradeneeded=function(){ var d=r.result; if(!d.objectStoreNames.contains(ST)) d.createObjectStore(ST,{keyPath:'k'}); };
      r.onsuccess=function(){ if(done){ try{ r.result.close(); }catch(e){} return; } done=true; clearTimeout(t); res(r.result); };
      r.onerror=function(){ if(!done){ done=true; clearTimeout(t); rej(r.error||new Error('ouverture refusée')); } };
      r.onblocked=function(){};
    });
  }
  function readAll(d){
    return new Promise(function(res,rej){
      var out={}; var tx=d.transaction(ST,'readonly'), os=tx.objectStore(ST);
      var q=os.openCursor();
      q.onsuccess=function(){ var c=q.result; if(c){ out[c.value.k]=c.value; c.continue(); } };
      tx.oncomplete=function(){ res(out); }; tx.onerror=tx.onabort=function(){ rej(tx.error); };
    });
  }
  function merge(idb){
    KSM=loadKS();
    var nat={}; nKeys().forEach(function(k){ if(!internal(k)) nat[k]=nGet(k); });
    var maxS=0; Object.keys(idb).forEach(function(k){ maxS=Math.max(maxS,idb[k].s||0); }); Object.keys(KSM).forEach(function(k){ maxS=Math.max(maxS,(KSM[k]&&KSM[k].s)||0); });
    SEQ=maxS;
    var keys={}; Object.keys(idb).forEach(function(k){ if(k!=='__nxseq') keys[k]=1; }); Object.keys(nat).forEach(function(k){ keys[k]=1; });
    MAP=new Map(); var toIDB=[], fromNative=0;
    Object.keys(keys).forEach(function(k){
      var I=idb[k], N=nat[k], T=KSM[k], natS=-1;
      if(N!=null) natS=(T&&!T.d&&!T.o&&T.h===h(N))?T.s:Infinity; /* écrit par une version sans cette couche → plus récent */
      var delS=(T&&T.d)?T.s:-1;
      var cand=null, from='';
      var iS=I?(I.s||0):-1;
      if(I&&iS>=natS&&iS>delS){ cand=I.v; from='idb'; }
      else if(N!=null&&natS>delS){ cand=N; from='native'; }
      if(cand==null){ if(N!=null) nDel(k); return; }
      MAP.set(k,cand);
      if(from==='native'){
        /* écrit plus tard dans le localStorage (ou première migration) → copié dans la base */
        if(!I||I.v!==cand){ SEQ++; toIDB.push({k:k,v:cand,s:SEQ}); KSM[k]={s:SEQ,h:h(cand)}; fromNative++; }
        else KSM[k]={s:iS,h:h(cand)};
      } else {
        /* retenu depuis la base : le localStorage doit avoir la même version, ou rien */
        if(N!==cand){ try{ nSet(k,cand); KSM[k]={s:iS,h:h(cand)}; }catch(e){ nDel(k); KSM[k]={s:iS,o:1}; } }
        else if(!T||T.h!==h(cand)||T.o||T.d) KSM[k]={s:iS,h:h(cand)};
      }
    });
    /* données trop grosses pour le localStorage : on libère leur ancienne copie native (elle est dans la base) */
    saveKS();
    return {toIDB:toIDB,fromNative:fromNative};
  }
  function writeRecs(recs){
    if(!recs.length) return Promise.resolve();
    return new Promise(function(res){ var tx=db.transaction(ST,'readwrite'), os=tx.objectStore(ST); recs.forEach(function(r){ os.put(r); }); os.put({k:'__nxseq',v:String(SEQ),s:SEQ});
      tx.oncomplete=function(){ res(); }; tx.onerror=tx.onabort=function(){ res(); }; });
  }
  var OPTIONAL=/^(cpnext_history|cpnext_geo|cpnext_avant_import)$/; /* pas indispensables pour lancer l'appli */
  function idbOnlyKeys(){ var ks=loadKS(); return Object.keys(ks).filter(function(k){ return ks[k]&&ks[k].o&&!OPTIONAL.test(k); }); }

  /* ---------- lancement de l'application (mêmes événements, même ordre) ---------- */
  var DCLQ=[], LOADQ=[], nativeLoaded=false, ran=false;
  W.addEventListener('load',function(){ nativeLoaded=true; });
  function runApp(){
    if(ran) return; ran=true;
    var dAdd=document.addEventListener, wAdd=W.addEventListener;
    document.addEventListener=function(t,f,o){ if(t==='DOMContentLoaded'){ DCLQ.push(f); return; } return dAdd.call(this,t,f,o); };
    W.addEventListener=function(t,f,o){ if(t==='load'&&nativeLoaded){ LOADQ.push(f); return; } if(t==='DOMContentLoaded'){ DCLQ.push(f); return; } return wAdd.call(this,t,f,o); };
    try{ Object.defineProperty(document,'readyState',{configurable:true,get:function(){ return 'loading'; }}); }catch(e){}
    var list=[].slice.call(document.querySelectorAll('script[type="text/x-climpilot"]'));
    var i=0;
    function finish(){
      try{ delete document.readyState; }catch(e){}
      document.addEventListener=dAdd; W.addEventListener=wAdd;
      var ev; try{ ev=new Event('DOMContentLoaded'); }catch(e){ ev={type:'DOMContentLoaded'}; }
      DCLQ.forEach(function(f){ try{ typeof f==='function'?f.call(document,ev):f.handleEvent(ev); }catch(e){ setTimeout(function(){ throw e; }); } });
      var lev; try{ lev=new Event('load'); }catch(e){ lev={type:'load'}; }
      LOADQ.forEach(function(f){ try{ typeof f==='function'?f.call(W,lev):f.handleEvent(lev); }catch(e){ setTimeout(function(){ throw e; }); } });
      STORE.ready=true; try{ document.dispatchEvent(new Event('nxstoreready')); }catch(e){}
    }
    /* scripts intégrés : exécutés tout de suite ; fichiers : téléchargés en parallèle, exécutés dans l'ordre (async=false) */
    var waiting=0;
    function next(){
      while(i<list.length){
        var old=list[i], src=old.getAttribute('data-src');
        if(!src){ if(waiting) return; i++; var s=document.createElement('script'); s.textContent=old.textContent; old.parentNode.insertBefore(s,old); continue; }
        i++; waiting++; var e=document.createElement('script'); e.async=false; e.src=src;
        e.onload=e.onerror=function(){ waiting--; if(!waiting) next(); };
        old.parentNode.insertBefore(e,old);
      }
      if(!waiting) finish();
    }
    next();
  }
  function whenParsed(f){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',f); else f(); }

  function blockScreen(msg){
    whenParsed(function(){
      var d=document.createElement('div');
      d.style.cssText='position:fixed;inset:0;z-index:300000;background:#0f1b2d;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font:16px/1.5 system-ui,sans-serif;text-align:center';
      d.innerHTML='<div style="max-width:420px"><div style="font-size:40px">💾</div><h2 style="margin:8px 0">La mémoire de l\'appareil ne répond pas</h2><p>'+msg+'</p>'+
        '<p>Tes données sont en sécurité. <b>Ferme complètement l\'application</b> (balaye-la vers le haut) puis rouvre-la. Si ça continue, redémarre le téléphone.</p>'+
        '<button onclick="location.reload()" style="margin-top:10px;padding:12px 20px;border:0;border-radius:10px;background:#fff;color:#0f1b2d;font-weight:700;font-size:16px">Réessayer</button></div>';
      document.body.appendChild(d);
    });
  }

  function startLocal(reason){
    mode='local'; STORE.mode='local'; STORE.reason=String(reason&&reason.message||reason||'');
    var only=idbOnlyKeys();
    if(only.length){ blockScreen('Certaines données ('+only.length+') ne sont que dans la grande mémoire, impossible de lancer l\'appli sans elles.'); return; }
    KSM=loadKS(); MAP=new Map(); nKeys().forEach(function(k){ if(!internal(k)) MAP.set(k,nGet(k)); });
    var mx=0; Object.keys(KSM).forEach(function(k){ mx=Math.max(mx,(KSM[k]&&KSM[k].s)||0); }); SEQ=mx;
    install(); whenParsed(runApp);
  }
  /* ---------- 1.10 : un seul onglet actif à la fois ----------
     Le nouvel onglet demande s'il existe déjà un onglet actif (BroadcastChannel, 300 ms). Si oui, il démarre
     en LECTURE SEULE (rien n'est enregistré, voile explicatif) ; « Utiliser cet onglet » met l'autre en lecture
     seule puis recharge celui-ci. Un onglet qui voit le stockage modifié par un autre (ancienne version sans
     ce mécanisme, par ex.) passe aussi en lecture seule. */
  var BC=null, TAB=Math.random().toString(36).slice(2), ACTIF=false;
  function voile(msg){
    whenParsed(function(){
      var o=document.getElementById('nxRoVoile'); if(o) o.remove();
      var d=document.createElement('div'); d.id='nxRoVoile';
      d.style.cssText='position:fixed;inset:0;z-index:299999;background:rgba(15,27,45,.92);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font:16px/1.5 system-ui,sans-serif;text-align:center';
      d.innerHTML='<div style="max-width:440px"><div style="font-size:38px">🗂️</div><h2 style="margin:8px 0">Onglet en lecture seule</h2><p>'+msg+'</p><p>Rien de ce qui est fait ici n\'est enregistré, pour ne pas écraser le travail de l\'autre onglet.</p>'+
        '<button id="nxRoPrendre" style="margin-top:10px;padding:12px 20px;border:0;border-radius:10px;background:#fff;color:#0f1b2d;font-weight:700;font-size:16px">Utiliser cet onglet</button></div>';
      document.body.appendChild(d);
      document.getElementById('nxRoPrendre').onclick=function(){ try{ if(BC) BC.postMessage({t:'prise',id:TAB}); }catch(e){} setTimeout(function(){ location.reload(); },400); };
    });
  }
  function passerLectureSeule(msg){ if(RO) return; RO=true; STORE.mode=mode+'-lecture'; W.__cpLectureSeule=true; try{ doFlush(); }catch(e){} voile(msg); }
  STORE.passerLectureSeule=passerLectureSeule;
  function ecouteOnglets(){
    try{ if(!W.BroadcastChannel) return Promise.resolve(false); BC=new BroadcastChannel('climpilot-onglets'); }catch(e){ return Promise.resolve(false); }
    BC.onmessage=function(ev){ var m=ev&&ev.data||{}; if(m.id===TAB) return;
      if(m.t==='bonjour'&&ACTIF&&!RO) BC.postMessage({t:'actif',id:TAB});
      if(m.t==='prise'&&!RO){ passerLectureSeule('ClimPilot est maintenant utilisé dans un autre onglet.'); } };
    return new Promise(function(res){ var vu=false; var h=function(ev){ if(ev&&ev.data&&ev.data.t==='actif'&&ev.data.id!==TAB) vu=true; };
      BC.addEventListener('message',h); BC.postMessage({t:'bonjour',id:TAB});
      setTimeout(function(){ BC.removeEventListener('message',h); res(vu); },300); });
  }
  W.addEventListener('storage',function(e){
    /* écriture faite par un AUTRE onglet (les nôtres ne déclenchent pas cet évènement) */
    if(!e||!e.key||internal(e.key)||e.key==='cp2_dirty'||RO||mode==='init') return;
    if(/^(cp2_|cpnext_)/.test(e.key)) passerLectureSeule('Les données ont été modifiées dans un autre onglet ou une autre version de ClimPilot. Recharge pour repartir des données à jour.');
  });
  function start(attempt){
    if(attempt===0&&!start._ok){ start._ok=true;
      return ecouteOnglets().then(function(autre){ if(autre){ RO=true; W.__cpLectureSeule=true; voile('ClimPilot est déjà ouvert dans un autre onglet de ce navigateur.'); } else ACTIF=true; start(0); });
    }
    return start2(attempt);
  }
  function start2(attempt){
    if(!LSO){ mode='none'; STORE.mode='none'; whenParsed(runApp); return; }
    openDB().then(function(d){ db=d; db.onversionchange=function(){ try{ db.close(); }catch(e){} };
      return readAll(d).then(function(idb){
        var r=merge(idb); mode='idb'; STORE.mode='idb'; STORE.migrated=r.fromNative;
        install();
        return writeRecs(r.toIDB).then(function(){ whenParsed(runApp); });
      });
    }).catch(function(e){
      if(attempt<1) return setTimeout(function(){ start(attempt+1); },300);
      startLocal(e);
    });
  }
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().then(function(p){ STORE.persistent=p; }).catch(function(){}); }catch(e){}
  /* rechargement : on attend que tout soit écrit dans la base */
  W.nxStoreReload=function(){ var go=function(){ location.reload(); }; try{ doFlush().then(go,go); setTimeout(go,1500); }catch(e){ go(); } };
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') doFlush(); });
  W.addEventListener('pagehide',function(){ doFlush(); });
  try{ start(0); }catch(e){ try{ startLocal(e); }catch(_){ whenParsed(runApp); } }
})();
