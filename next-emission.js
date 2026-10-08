/* ============================================================
   ClimPilot Next — next-emission.js  (couche additive, 1.10 — 02/10/2026)
   ÉMISSION SÉCURISÉE DES FACTURES ET DES AVOIRS — chargé en dernier.

   Trois modes :
   - RÉEL : facturation réelle DÉMARRÉE par une action explicite et datée
     (Paramètres › Facturation réelle : « Démarrer la facturation réelle à
     partir du … »), cloud connecté, SIRET renseigné, fonctions serveur installées
     (migration supabase/migrations/20261002120000_documents_emis.sql).
     Le numéro est donné par le serveur EN MÊME TEMPS que la facture y est
     enregistrée (cp_emettre_document, une transaction). Une même demande
     rejouée (double clic, coupure, réponse perdue) retrouve la même facture.
   - BLOQUÉ : cloud connecté + SIRET, mais serveur injoignable, hors ligne
     ou migration absente → la facture N'EST PAS émise (le chantier reste
     « à facturer ») ; jamais de compteur local pour une vraie facture.
   - DÉMONSTRATION : facturation réelle pas encore démarrée, pas de cloud ou
     pas de SIRET → numéros TEST-F-AAAA-NNN
     et TEST-AV-AAAA-NNN, séparés des séries réelles, document marqué
     « DOCUMENT DE TEST ».

   Comment, sans toucher aux calculs existants :
   1. la fonction d'origine (facturerDevis, factureDep, facturerLoc,
      facturerContrat, avoir) est d'abord jouée À BLANC sur une copie, avec
      les écritures suspendues (nxStore.suspend) : on obtient la facture
      calculée exactement comme avant, sans rien enregistrer ;
   2. le numéro est attribué (serveur ou série TEST) ;
   3. le résultat est appliqué, la version FIGÉE est conservée (données,
      HTML du PDF, XML) et les réimpressions repartent de cette version.
   Paiements et statuts : événements à part, l'original n'est pas réécrit.
   Synchronisation : un champ de facture émise n'est jamais perdu par une
   fusion ; rapprochement avec le registre du serveur au démarrage.
   Démarrage de la facturation réelle : les anciennes factures F-/AV- sont des
   ESSAIS par défaut (renommées ESSAI-…, jamais envoyées au serveur, hors chiffre
   d'affaires) ; seules celles choisies explicitement sont importées au registre
   du serveur, et seules elles comptent pour le numéro minimal (p_min_numero).
   ============================================================ */
(function(){
  'use strict';
  var VERSION='1.10.0-beta'; window.CP_VERSION=VERSION;
  var REG='cp2_docs', FIL='cpnext_docs_fichiers', ATT='cpnext_emission_attente', EVQ='cpnext_events_attente', TSEQ='cp2_testseq', FR='cp2_facturation';
  try{ [REG,TSEQ,FR].forEach(function(k){ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(k)<0) SYNC_KEYS.push(k); }); }catch(e){}

  /* ---------- outils ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function cl(o){ return o==null?o:JSON.parse(JSON.stringify(o)); }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } }
  function fr(iso){ return iso?new Date(String(iso).slice(0,10)+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function say(m){ try{ toast(m); }catch(e){} }
  function rd(k,def){ try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?def:v; }catch(e){ return def; } }
  function wr(k,v){ try{ save(k,v); }catch(e){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } }
  function rid(){ try{ if(crypto&&crypto.randomUUID) return crypto.randomUUID(); }catch(e){} var h='';for(var i=0;i<32;i++) h+=Math.floor(Math.random()*16).toString(16); return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32); }
  /* empreinte courte synchrone (repérage local) */
  function h(s){ s=String(s); var x=0x811c9dc5; for(var i=0;i<s.length;i++){ x^=s.charCodeAt(i); x=Math.imul(x,16777619); } return (x>>>0).toString(16)+'.'+s.length; }
  /* identifiant de demande stable dérivé d'une clé (anciennes factures : même clé → même request_id) */
  function uuidDe(cle){ var a=h('a'+cle).split('.')[0], b=h('b'+cle).split('.')[0], c=h('c'+cle).split('.')[0], d=h('d'+cle).split('.')[0];
    var x=(a+b+c+d+'00000000000000000000000000000000').slice(0,32); return x.slice(0,8)+'-'+x.slice(8,12)+'-5'+x.slice(13,16)+'-8'+x.slice(17,20)+'-'+x.slice(20,32); }
  function sha256(t){ try{ return crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(t))).then(function(b){ return Array.from(new Uint8Array(b)).map(function(x){ return x.toString(16).padStart(2,'0'); }).join(''); }); }catch(e){ return Promise.resolve(h(t)); } }
  function cloud(){ try{ return !!(window.sb&&window.SESS&&window.SESS.user); }catch(e){ return false; } }
  function siretOk(){ try{ return String((P.entreprise||{}).siret||'').replace(/\D/g,'').length===14; }catch(e){ return false; } }

  /* ---------- serveur ---------- */
  var INFO={t:0,ok:null,raison:'',detail:''};
  function rpc(name,params){
    return Promise.race([window.sb.rpc(name,params),new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('délai dépassé (25 s)')); },25000); })]);
  }
  function absente(err){ var m=String((err&&(err.message||''))+' '+(err&&err.code||'')); return /PGRST202|Could not find the function|does not exist/i.test(m); }
  function sonde(force){
    if(!cloud()) return Promise.resolve(INFO={t:Date.now(),ok:false,raison:'cloud'});
    if(!force&&INFO.ok!==null&&Date.now()-INFO.t<120000) return Promise.resolve(INFO);
    if(navigator.onLine===false) return Promise.resolve(INFO={t:Date.now(),ok:false,raison:'horsligne'});
    return rpc('cp_serveur_info',{}).then(function(r){
      if(r&&r.error) INFO={t:Date.now(),ok:false,raison:absente(r.error)?'migration':'serveur',detail:String(r.error.message||'')};
      else INFO={t:Date.now(),ok:!!(r&&r.data&&r.data.documents),raison:'',detail:''};
      return INFO;
    },function(e){ INFO={t:Date.now(),ok:false,raison:'serveur',detail:String(e&&e.message||e)}; return INFO; });
  }
  var RAISON={cloud:'connecte le cloud (Paramètres)',horsligne:'pas de réseau',migration:'le serveur n\'a pas encore la mise à jour 1.10 (migration à appliquer)',serveur:'serveur injoignable'};
  /* ---------- décision « facturation réelle » (synchronisée) ----------
     {debut:'AAAA-MM-JJ', decideLe, anciens:{num:'essai'|'importer'}, renommes:{ancien:nouveau}} */
  function decision(){ var o=rd(FR,null); return o&&typeof o==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(o.debut||'')?o:null; }
  function reelDemarre(){ var o=decision(); return !!(o&&today()>=o.debut); }
  function choix(num){ var o=decision(); return o&&o.anciens&&o.anciens[num]==='importer'?'importer':'essai'; }
  /* numéro d'essai : ESSAI-… toujours ; TEST-… une fois la facturation réelle démarrée (période de démonstration) */
  function numEssai(n){ n=String(n||''); return /^ESSAI-/.test(n)||(/^TEST-/.test(n)&&reelDemarre()); }
  window.nxNumEssai=numEssai; window.nxEmisDecision=decision;
  /* mode d'après le dernier sondage (synchrone) : jamais réel sans démarrage explicite, même avec un SIRET */
  function mode(){ if(!siretOk()||!cloud()||!reelDemarre()) return 'demo'; if(INFO.ok===true) return 'reel'; return 'bloque'; }
  window.nxEmisMode=function(){ var o=decision(); return {mode:mode(),raison:INFO.raison,detail:INFO.detail,demarre:reelDemarre(),debut:o?o.debut:null}; };
  window.nxEmisSonde=sonde;

  /* ---------- registre local des documents émis (synchronisé) + fichiers figés (appareil) ---------- */
  function reg(){ var a=rd(REG,[]); return Array.isArray(a)?a:[]; }
  function regPut(a){ wr(REG,a); }
  function fichiers(){ var o=rd(FIL,{}); return o&&typeof o==='object'?o:{}; }
  function fichiersPut(num,o){ var all=fichiers(); all[num]=o; try{ localStorage.setItem(FIL,JSON.stringify(all)); }catch(e){} }
  function srcCle(s){ return s?[s.k,s.id,s.w==null?'':s.w].join('|'):''; }
  function entree(num){ var a=reg().filter(function(e){ return e.num===num; }); return a.find(function(e){ return e.mode==='reel'&&e.origine==='emis'; })||a.find(function(e){ return e.mode==='demo'; })||a[0]||null; }
  window.nxEmisRegistre=reg;
  window.nxEmisModele=function(num){ var e=entree(num); return e&&e.model?e.model:null; };
  window.nxEmisXmlFige=function(num){ var f=fichiers()[num]; return f&&f.xml?f.xml:null; };
  window.nxEmisEntree=entree;
  /* le XML émis doit être sur l'appareil avant un envoi : sinon on le reprend du serveur */
  window.nxEmisAssurerFichiers=function(num){
    var f=fichiers()[num]; if(f&&f.xml) return Promise.resolve(true);
    var e=entree(num); if(!e||!e.sid||!cloud()) return Promise.resolve(false);
    return window.sb.from('climpilot_documents').select('html,xml').eq('id',e.sid).maybeSingle().then(function(r){
      var d=r&&r.data; if(d&&(d.xml||d.html)){ fichiersPut(num,{html:d.html||'',xml:d.xml||null,at:Date.now(),mode:e.mode}); return true; } return false; },function(){ return false; });
  };
  function ajouterRegistre(e){
    var a=reg(); e.id=(e.mode==='demo'?'demo|':'')+e.num+'|'+srcCle(e.src);
    var i=a.findIndex(function(x){ return x.id===e.id; }); if(i>=0) a[i]=Object.assign(a[i],e); else a.push(e);
    regPut(a);
  }
  /* doublons : un même numéro porté par deux documents différents */
  function doublons(){
    /* avoir : la source s'écrit « facture » à l'émission et « facture|montant|motif » (clé de demande) au rapprochement :
       même avoir, donc une seule source (la facture d'origine) — sinon faux doublon après chaque synchro */
    var cleSrc=function(e){ return e.src&&e.src.k==='avoir'?'avoir|'+String(e.src.w||'').split('|')[0]:(srcCle(e.src)||e.id); };
    var by={}; reg().forEach(function(e){ if(e.mode==='demo'||numEssai(e.num)) return; (by[e.num]=by[e.num]||{})[cleSrc(e)]=1; });
    try{ (window.nxFacNumsAll?nxFacNumsAll():[]).forEach(function(n){ if(!numEssai(n)) by[n]=by[n]||{}; }); }catch(e){}
    var d={}; Object.keys(by).forEach(function(n){ if(Object.keys(by[n]).length>1) d[n]=true; });
    /* numéros présents deux fois dans les données de l'appareil */
    var vus={}; (function(){ try{ (window.nxInvoices?nxInvoices():[]).forEach(function(i){ var k=i.num; if(numEssai(k)) return; if(vus[k]&&vus[k]!==(i.kind+'|'+i.id+'|'+(i.which||''))) d[k]=true; vus[k]=i.kind+'|'+i.id+'|'+(i.which||''); }); }catch(e){} })();
    (function(){ try{ var v2={}; (window.nxAvoirs?nxAvoirs():[]).forEach(function(a){ if(numEssai(a.num)) return; if(v2[a.num]&&v2[a.num]!==a.id) d[a.num]=true; v2[a.num]=a.id; }); }catch(e){} })();
    return d;
  }
  window.nxEmisDoublons=doublons;

  /* ---------- série TEST (démonstration) ---------- */
  /* année = celle de la DATE DU DOCUMENT (comme le serveur), pas celle de l'horloge (factures autour du 31/12) */
  function anDe(dateDoc){ var y=parseInt(String(dateDoc||'').slice(0,4),10); return y>1999?y:new Date().getFullYear(); }
  function numTest(serie,dateDoc){
    var y=anDe(dateDoc||today()), sq=rd(TSEQ,{}); if(!sq||sq.year!==y) sq={year:y,F:0,AV:0};
    var re=new RegExp('^TEST-'+serie+'-'+y+'-(\\d+)$'), mx=0;
    reg().forEach(function(e){ var m=String(e.num).match(re); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
    var n=Math.max(mx,Number(sq[serie])||0)+1; sq[serie]=n; wr(TSEQ,sq);
    return 'TEST-'+serie+'-'+y+'-'+String(n).padStart(3,'0');
  }

  /* ---------- essai à blanc ---------- */
  var ORIG={}, EMITTING=false;
  var UI=['print','loadDepForm','renderFBloc','renderDep','renderLoc','renderContrats','renderDash','updateBadges','printFactureDevis','printFacture','printFactureLoc','printFactureCtr','recalcDep','renderRecettes'];
  function aBlanc(fn){
    var saved={}, toasts=[], prov='PROVISOIRE-'+Math.random().toString(36).slice(2,10).toUpperCase();
    UI.forEach(function(k){ saved[k]=window[k]; if(typeof window[k]==='function') window[k]=function(){}; });
    saved.toast=window.toast; window.toast=function(m){ toasts.push(m); };
    saved.nextFacNum=window.nextFacNum; window.nextFacNum=function(){ return prov; };
    var out;
    try{ out=window.nxStore&&nxStore.suspend?nxStore.suspend(function(){ return fn(prov); }):fn(prov); }
    finally{ Object.keys(saved).forEach(function(k){ window[k]=saved[k]; }); }
    return {out:out,prov:prov,toasts:toasts};
  }
  function remplacer(o,prov,num){ return JSON.parse(JSON.stringify(o).split(prov).join(num)); }
  function capturer(fn,dateDoc){
    var real=window.print, html=''; window.print=function(){};
    var dd=window.__nxDocDate; window.__nxDocDate=dateDoc; EMITTING=true;
    try{ fn(); var el=document.getElementById('devisDoc'); html=el?el.innerHTML:''; }
    finally{ window.print=real; window.__nxDocDate=dd; EMITTING=false; }
    /* mention de franchise selon la DATE DU DOCUMENT (CIBS au 01/01/2027) */
    if(String(dateDoc||'')>='2027-01-01') html=html.replace(/(art(?:icle|\.)\s*)293\s*B\s*du\s*CGI/gi,'art. L. 233-3 du CIBS');
    return html;
  }
  function exigibleHTML(t){ return '<div data-exigible="1" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7a1020;border:1px solid #e5484d;background:#fff5f5;padding:6px 8px;margin-top:8px"><b>'+String(t).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; })+'</b></div>'; }
  function filigrane(html){
    return '<div style="border:3px solid #c8102e;color:#c8102e;font:700 13px Arial,Helvetica,sans-serif;text-align:center;padding:8px;margin-bottom:10px;letter-spacing:.04em">DOCUMENT DE TEST — ClimPilot en mode démonstration — sans valeur comptable ni fiscale</div>'+html;
  }
  function montrer(html,dateDoc){
    var el=document.getElementById('devisDoc'); if(!el) return;
    el.innerHTML=html; var dd=window.__nxDocDate; window.__nxDocDate=dateDoc;
    try{ window.print(); } finally{ window.__nxDocDate=dd; }
  }
  /* données du vendeur gardées dans la version figée (sans fichiers lourds) */
  function vendeur(){ var e={}; try{ e=cl(P.entreprise||{}); }catch(_){} Object.keys(e).forEach(function(k){ if(typeof e[k]==='string'&&e[k].length>20000) delete e[k]; }); return e; }

  /* ---------- les quatre sortes de factures ---------- */
  /* objets « devis ouvert à l'écran » (éditeur 1.9 et ancien formulaire) pour un devis donné */
  function ecrans(id){ var l=[];
    try{ var cu=window.NXD2&&NXD2.api.cur&&NXD2.api.cur(); if(cu&&cu.id===id) l.push(cu); }catch(e){}
    try{ if(typeof cur!=='undefined'&&cur&&cur.id===id&&l.indexOf(cur)<0) l.push(cur); }catch(e){}
    return l.filter(function(o){ return !(DEVIS||[]).some(function(x){ return x===o; }); }); }
  var SORTES={
    devis:{ fn:'facturerDevis',
      essai:function(args,prov){ var id=args[0], which=args[1]; var i=(DEVIS||[]).findIndex(function(x){ return x.id===id; }); if(i<0) return null;
        var real=DEVIS[i], f=which==='acompte'?'facAcompte':'facSolde'; if(real[f]) return {deja:true};
        var c=cl(real); DEVIS[i]=c; var m=null;
        /* le devis ouvert à l'écran (cur) est recopié depuis DEVIS par la couche next-devis2 pendant l'essai :
           on le remet tel qu'il était, sinon le numéro PROVISOIRE resterait affiché (et serait enregistré) si l'émission échoue */
        var ecr=ecrans(id), avant=ecr.map(function(o){ var s={}; ['facAcompte','facSolde','figEnv','statut'].forEach(function(k){ s[k]=Object.prototype.hasOwnProperty.call(o,k)?cl(o[k]):undefined; }); return s; });
        try{ ORIG.facturerDevis(id,which); if(c[f]&&c[f].num===prov){ try{ m=window.nxEinvModelLive(prov); }catch(e){} } }
        finally{ DEVIS[i]=real;
          ecr.forEach(function(o,j){ Object.keys(avant[j]).forEach(function(k){ if(avant[j][k]===undefined) delete o[k]; else o[k]=avant[j][k]; }); }); }
        if(!c[f]||c[f].num!==prov) return null;
        return {real:real,res:c,fac:c[f],model:m,src:{k:'devis',id:id,w:which},type:which==='acompte'?'acompte':'facture',date:c[f].date};
      },
      appliquer:function(d,res){ Object.assign(d.real,res); save(LS.devis,DEVIS);
        try{ var cu=window.NXD2&&NXD2.api.cur&&NXD2.api.cur(); if(cu&&cu.id===d.real.id){ ['facAcompte','facSolde','figEnv'].forEach(function(k){ if(d.real[k]) cu[k]=cl(d.real[k]); }); } }catch(e){}
        try{ if(typeof cur!=='undefined'&&cur&&cur.id===d.real.id&&cur!==d.real){ ['facAcompte','facSolde','figEnv'].forEach(function(k){ if(d.real[k]) cur[k]=cl(d.real[k]); }); } }catch(e){}
        try{ renderFBloc(); }catch(e){} },
      imprimer:function(d){ var which=d.src.w; printFactureDevis(d.real,which); }
    },
    dep:{ fn:'factureDep',
      essai:function(args,prov){ if(typeof curDep==='undefined'||!curDep) return null; var real=curDep; if(real.facNum) return {deja:true};
        var ref=DEP, items=ref.slice(), i=ref.findIndex(function(x){ return x.id===real.id; }), c=cl(real), m=null;
        curDep=c; if(i>=0) ref[i]=c;
        try{ ORIG.factureDep(); if(c.facNum===prov){ try{ m=window.nxEinvModelLive(prov); }catch(e){} } }
        finally{ if(DEP!==ref) DEP=ref; ref.length=0; items.forEach(function(x){ ref.push(x); }); curDep=real; }
        if(c.facNum!==prov) return null;
        return {real:real,res:c,fac:{num:prov,date:c.facDate,montant:(m&&m.grand)||null},model:m,src:{k:'dep',id:real.id,w:''},type:'facture',date:c.facDate||today()};
      },
      appliquer:function(d,res){ Object.assign(d.real,res); var i=DEP.findIndex(function(x){ return x.id===d.real.id; }); if(i>=0) DEP[i]=d.real; else DEP.push(d.real);
        save(LS.dep,DEP); try{ loadDepForm(); }catch(e){} try{ renderDep(); }catch(e){} },
      imprimer:function(d){ printFacture(); }
    },
    loc:{ fn:'facturerLoc',
      essai:function(args,prov){ var id=args[0], i=(LOC||[]).findIndex(function(x){ return x.id===id; }); if(i<0) return null;
        var real=LOC[i]; if(real.fac) return {deja:true}; var c=cl(real), m=null; LOC[i]=c;
        try{ ORIG.facturerLoc(id); if(c.fac&&c.fac.num===prov){ try{ m=window.nxEinvModelLive(prov); }catch(e){} } }
        finally{ LOC[i]=real; }
        if(!c.fac||c.fac.num!==prov) return null;
        return {real:real,res:c,fac:c.fac,model:m,src:{k:'loc',id:id,w:''},type:'facture',date:c.fac.date};
      },
      appliquer:function(d,res){ Object.assign(d.real,res); save(LS.loc,LOC); try{ renderLoc(); }catch(e){} },
      imprimer:function(d){ printFactureLoc(d.real); }
    },
    ctr:{ fn:'facturerContrat',
      essai:function(args,prov){ var id=args[0], i=(CTR||[]).findIndex(function(x){ return x.id===id; }); if(i<0) return null;
        var real=CTR[i], c=cl(real), m=null; CTR[i]=c;
        try{ ORIG.facturerContrat(id); var f0=(c.facs||[]).find(function(f){ return f.num===prov; }); if(f0){ try{ m=window.nxEinvModelLive(prov); }catch(e){} } }
        finally{ CTR[i]=real; }
        var f=(c.facs||[]).find(function(x){ return x.num===prov; }); if(!f) return null;
        return {real:real,res:c,fac:f,model:m,src:{k:'ctr',id:id,w:String(f.annee)},type:'facture',date:f.date};
      },
      appliquer:function(d,res){ Object.assign(d.real,res); save('cp2_contrats',CTR); try{ renderContrats(); }catch(e){} },
      imprimer:function(d){ var f=(d.real.facs||[]).find(function(x){ return x.num===d.num; }); printFactureCtr(d.real,f); }
    }
  };

  /* demandes en attente (même request_id pour la même facture tant qu'elle n'est pas émise) */
  function attentes(){ var o=rd(ATT,{}); return o&&typeof o==='object'?o:{}; }
  function attentePut(cle,v){ var o=attentes(); if(v) o[cle]=v; else delete o[cle]; try{ localStorage.setItem(ATT,JSON.stringify(o)); }catch(e){} }
  window.nxEmisAttentes=attentes;

  var BUSY=false;
  function emettre(sorte,args){
    if(window.__cpLectureSeule){ alert('Cet onglet est en lecture seule : rien ne peut y être émis.'); return Promise.resolve(null); }
    if(BUSY){ say('Émission en cours… patiente.'); return Promise.resolve(null); }
    var S=SORTES[sorte];
    /* contrôles propres aux particuliers (next-particuliers.js) : arrêt, date d'exigibilité, trace */
    var av={}; try{ if(typeof window.nxAvantEmission==='function') av=window.nxAvantEmission(sorte,args)||{}; }catch(e){ av={}; }
    if(av.stop){ relire(sorte); return Promise.resolve(null); }
    /* devis pas encore accepté (brouillon, envoyé, refusé…) : on demande confirmation avant de le facturer */
    if(sorte==='devis'){ try{ var dv=(DEVIS||[]).find(function(x){ return x.id===args[0]; });
      var stv=dv&&(typeof cur!=='undefined'&&cur&&cur.id===dv.id&&cur.statut?cur.statut:dv.statut);
      if(dv&&!(args[1]==='solde'?dv.facSolde:dv.facAcompte)&&stv&&stv!=='accepte'){
        var lib={brouillon:'brouillon (jamais envoyé)',verifier:'à vérifier',pret:'prêt, pas encore envoyé',envoye:'envoyé, pas encore accepté',refuse:'REFUSÉ par le client'}[stv]||stv;
        if(!confirm('Ce devis n\'est pas accepté (statut : '+lib+').\n\nUne facture émise ne se supprime pas : seul un avoir l\'annule.\n\nFacturer quand même ?')) return Promise.resolve(null);
      } }catch(e){} }
    /* devis ouvert et modifié à l'écran : enregistré AVANT l'essai à blanc (sinon l'enregistrement se ferait pendant l'essai, sur la copie) */
    if(sorte==='devis'&&typeof window.nxDevisAvantFacture==='function'&&!window.nxDevisAvantFacture(args[0])) return Promise.resolve(null);
    var essai=aBlanc(function(prov){ return S.essai(args,prov); });
    var d=essai.out;
    if(!d||d.deja){ /* refus de la fonction d'origine (déjà facturé, rien à facturer…) : on la rejoue telle quelle pour ses messages */
      if(d&&d.deja){ return Promise.resolve(ORIG[S.fn].apply(null,args)); }
      essai.toasts.forEach(say); return Promise.resolve(null);
    }
    d.prov=essai.prov;
    if(av.marque) Object.assign(d.res,cl(av.marque));
    if(av.echeance){
      d.exigible={date:av.echeance,texte:av.echeanceTexte||''};
      if(sorte==='dep') d.res.facExigibleLe=av.echeance;
      d.fac.exigibleLe=av.echeance;
      if(d.model){ if(!d.model.echeance||String(d.model.echeance)<av.echeance){ d.model.echeance=av.echeance; d.model.echeanceTexte=av.echeanceTexte||''; } }
    }
    var mo=mode();
    if(mo==='demo'){ return Promise.resolve(finir(S,d,numTest(d.type==='avoir'?'AV':'F',d.date),'demo',null)); }
    BUSY=true; say('🔐 Émission de la facture… (numéro attribué par le serveur)');
    return sonde(true).then(function(info){
      if(!info.ok){ BUSY=false; bloque(info); relire(sorte); return null; }
      return demanderServeur(d,'F',d.type).then(function(r){ BUSY=false; if(!r){ relire(sorte); return null; }
        if(r.differe) return reprendreServeur(sorte,d,r.doc);
        return finir(S,d,r.doc.num,'reel',r.doc); });
    }).catch(function(e){ BUSY=false; bloque({raison:'serveur',detail:String(e&&e.message||e)}); relire(sorte); return null; });
  }
  function relire(sorte){ try{ if(sorte==='dep') loadDepForm(); if(sorte==='devis') renderFBloc(); }catch(e){} }
  function bloque(info){
    var t='Facture NON émise : '+(RAISON[info.raison]||'serveur indisponible')+(info.detail?' ('+info.detail+')':'')+'.\n\nRien n\'a été facturé : réessaie quand le serveur répond (le même clic reprendra la même demande, sans créer de doublon).';
    try{ alert(t); }catch(e){ say(t); }
  }
  function payloadDe(d){
    var model=cl(d.model)||null; if(model){ model.id=''; model.seller=vendeur(); }
    return {v:1,app:VERSION,src:d.src,type:d.type,date:d.date,fac:remplacer(d.fac,d.prov,''),model:model?remplacer(model,d.prov,''):null,vendeur:vendeur()};
  }
  function demanderServeur(d,serie,type){
    var cle=srcCle(d.src), a=attentes()[cle], r0=(a&&a.rid)||rid();
    attentePut(cle,{rid:r0,at:Date.now(),serie:serie});
    var pl=payloadDe(d), mini=maxLocal(serie,d.date);
    return rpc('cp_emettre_document',{p_request_id:r0,p_serie:serie,p_type:type,p_date:d.date,p_payload:pl,p_min_numero:mini,p_client_version:VERSION}).then(function(r){
      if(r&&r.error){ bloque({raison:absente(r.error)?'migration':'serveur',detail:String(r.error.message||'')}); return null; }
      var out=r&&r.data; if(!out||!out.ok||!out.doc){ bloque({raison:'serveur',detail:'réponse vide'}); return null; }
      /* la demande avait déjà été servie avec un autre contenu (réponse perdue, puis document modifié) :
         le document du serveur fait foi — rien n'est recalculé sur l'appareil (voir reprendreServeur) */
      if(out.deja&&out.doc.payload&&JSON.stringify(out.doc.payload.fac||{})!==JSON.stringify(pl.fac||{})) out.differe=true;
      return out;
    });
  }
  /* numéro minimal envoyé au serveur (p_min_numero) : seulement les VRAIS numéros de l'année du document —
     registre du serveur (émis ou reconstitués) et anciennes factures choisies pour l'import ; jamais les essais */
  function maxLocal(serie,dateDoc){
    var y=anDe(dateDoc||today()), re=new RegExp('^'+serie+'-'+y+'-(\\d+)$'), mx=0, o=decision();
    reg().forEach(function(e){ if(e.mode!=='reel') return; var m=String(e.num).match(re); if(m) mx=Math.max(mx,+m[1]); });
    if(o&&o.anciens) Object.keys(o.anciens).forEach(function(n){ if(o.anciens[n]!=='importer') return; var m=String(n).match(re); if(m) mx=Math.max(mx,+m[1]); });
    return mx;
  }
  window.nxEmisNumeros={maxLocal:maxLocal,numTest:function(s,d){ return numTest(s,d); }};
  function reprendreServeur(sorte,d,doc){
    var p=doc.payload||{}, fac=p.fac?remplaceVide(p.fac,doc.num):null;
    ajouterRegistre({num:doc.num,mode:'reel',origine:'emis',type:doc.type,serie:doc.serie,date:doc.date_doc,src:d.src,fac:fac,model:p.model?Object.assign(remplaceVide(p.model,doc.num),{id:doc.num}):null,sid:doc.id,ph:doc.payload_hash,at:Date.now()});
    var res=restaurer(d.src,doc.num,fac); attentePut(srcCle(d.src),null); relire(sorte);
    try{ updateBadges(); }catch(e){}
    var t='La facture '+doc.num+' avait déjà été émise et enregistrée sur le serveur (réponse perdue).\n\nLe document a été modifié depuis : c\'est la facture ENREGISTRÉE qui fait foi'+(fac&&fac.montant!=null?' (montant '+fac.montant+' €)':'')+', elle n\'est pas recalculée. Pour corriger le montant, fais un avoir.';
    try{ alert(t); }catch(e){ say(t); }
    try{ window.nxEmisAssurerFichiers(doc.num).then(function(ok){ var f=fichiers()[doc.num]; if(ok&&f&&f.html) montrer(f.html,doc.date_doc); }); }catch(e){}
    return {num:doc.num,mode:'reel',repris:true,restaure:res};
  }
  function finir(S,d,num,mo,doc){
    var res=remplacer(d.res,d.prov,num); d.num=num;
    S.appliquer(d,res);
    var model=d.model?remplacer(d.model,d.prov,num):null; if(model){ model.id=num; if(doc&&doc.payload&&doc.payload.vendeur) model.seller=cl(doc.payload.vendeur); }
    var html=capturer(function(){ S.imprimer(d); },d.date);
    if(d.exigible&&d.exigible.texte) html+=exigibleHTML(d.exigible.texte);
    if(mo==='demo') html=filigrane(html);
    var xml=null; try{ if(model) xml=window.nxEinvXMLOf(model); }catch(e){}
    var fac=remplacer(d.fac,d.prov,num);
    ajouterRegistre({num:num,mode:mo,origine:'emis',type:d.type,serie:/^TEST-AV|^AV/.test(num)?'AV':'F',date:d.date,src:d.src,fac:fac,model:model,sid:doc?doc.id:null,ph:doc?doc.payload_hash:h(JSON.stringify(fac)),at:Date.now()});
    fichiersPut(num,{html:html,xml:xml,at:Date.now(),mode:mo});
    attentePut(srcCle(d.src),null);
    if(doc) deposerFichiers(doc.id,num,html,xml);
    try{ updateBadges(); }catch(e){}
    say((mo==='demo'?'🧪 Document de TEST ':'🧾 Facture ')+num+' émise'+(mo==='reel'?' et enregistrée sur le serveur':''));
    montrer(html,d.date);
    return {num:num,mode:mo};
  }
  function deposerFichiers(id,num,html,xml){
    return rpc('cp_document_fichiers',{p_id:id,p_html:html,p_xml:xml||''}).then(function(r){
      if(r&&r.error){ var f=fichiers()[num]; if(f){ f.aDeposer=id; fichiersPut(num,f); } return false; }
      var f2=fichiers()[num]; if(f2){ delete f2.aDeposer; f2.depose=true; fichiersPut(num,f2); } return true;
    },function(){ var f=fichiers()[num]; if(f){ f.aDeposer=id; fichiersPut(num,f); } return false; });
  }

  /* ---------- avoirs ---------- */
  window.nxAvoirEmit=function(o){
    if(window.__cpLectureSeule) return Promise.resolve({err:'Onglet en lecture seule'});
    if(typeof window.nxAvoirBuild!=='function') return Promise.resolve(window.nxCreateAvoir(o));
    var b=window.nxAvoirBuild(o,'PROVISOIRE-AV'); if(b.err) return Promise.resolve(b);
    var model=null; try{ var AVL=nxAvoirs(); AVL.push(b.av); try{ model=window.nxEinvModelLive('PROVISOIRE-AV'); } finally{ AVL.splice(AVL.indexOf(b.av),1); } }catch(e){}
    var d={src:{k:'avoir',id:b.av.id,w:b.av.facNum},type:'avoir',date:b.av.date,fac:cl(b.av),model:model,prov:'PROVISOIRE-AV'};
    var fin=function(num,mo,doc){
      b.av.num=num; var r=window.nxAvoirCommit(b,o);
      var mdl=model?remplacer(model,'PROVISOIRE-AV',num):null; if(mdl) mdl.id=num;
      var html=capturer(function(){ window.nxPrintAvoir(r.av.id); },r.av.date); if(mo==='demo') html=filigrane(html);
      var xml=null; try{ if(mdl) xml=window.nxEinvXMLOf(mdl); }catch(e){}
      ajouterRegistre({num:num,mode:mo,origine:'emis',type:'avoir',serie:'AV',date:r.av.date,src:{k:'avoir',id:r.av.id,w:r.av.facNum},fac:cl(r.av),model:mdl,sid:doc?doc.id:null,ph:doc?doc.payload_hash:'',at:Date.now()});
      fichiersPut(num,{html:html,xml:xml,at:Date.now(),mode:mo}); attentePut(srcCle(d.src),null);
      if(doc) deposerFichiers(doc.id,num,html,xml);
      montrer(html,r.av.date); r.imprime=true; return r;
    };
    var mo=mode();
    if(mo==='demo') return Promise.resolve(fin(numTest('AV',b.av.date),'demo',null));
    if(BUSY) return Promise.resolve({err:'Émission en cours'});
    BUSY=true;
    return sonde(true).then(function(info){
      if(!info.ok){ BUSY=false; return {err:'Avoir NON émis : '+(RAISON[info.raison]||'serveur indisponible')+'. Rien n\'a été créé.'}; }
      /* la clé de demande d'un avoir : facture + montant + motif (le même formulaire rejoué = même demande) */
      d.src={k:'avoir',id:'',w:b.av.facNum+'|'+b.av.montant+'|'+b.av.motif};
      return demanderServeur(d,'AV','avoir').then(function(r){ BUSY=false; if(!r) return {err:'Avoir non émis (serveur)'}; return fin(r.doc.num,'reel',r.doc); });
    }).catch(function(e){ BUSY=false; return {err:'Avoir non émis : '+String(e&&e.message||e)}; });
  };

  /* ---------- réimpressions : la version figée fait foi ---------- */
  function reimprimer(num,dateDoc,orig,self,args){
    if(EMITTING) return orig.apply(self,args);
    var f=num&&fichiers()[num];
    if(f&&f.html){ montrer(f.html,dateDoc); return; }
    var e=num&&entree(num);
    if(e&&e.sid&&cloud()){
      return window.sb.from('climpilot_documents').select('html').eq('id',e.sid).maybeSingle().then(function(r){
        var html=r&&r.data&&r.data.html; if(html){ fichiersPut(num,{html:html,xml:null,at:Date.now(),mode:e.mode}); montrer(html,dateDoc); }
        else duplicata(num,dateDoc,orig,self,args);
      },function(){ duplicata(num,dateDoc,orig,self,args); });
    }
    return duplicata(num,dateDoc,orig,self,args);
  }
  /* facture émise AVANT la 1.10 (ou sans version figée) : réimpression reconstituée et signalée comme telle */
  function duplicata(num,dateDoc,orig,self,args){
    var real=window.print, dd=window.__nxDocDate; window.__nxDocDate=dateDoc;
    window.print=function(){ try{ var el=document.getElementById('devisDoc'); if(el&&num) el.insertAdjacentHTML('afterbegin','<div style="border:1px dashed #888;color:#555;font:11px Arial,Helvetica,sans-serif;padding:6px;margin-bottom:8px;text-align:center">Duplicata reconstitué le '+new Date().toLocaleDateString('fr-FR')+' à partir des données actuelles — peut différer du document envoyé à l\'origine.</div>'); }catch(e){} window.print=real; try{ return real.apply(window,arguments); } finally{ window.__nxDocDate=dd; } }; /* date du document gardée pendant l'impression (mention de franchise, C17) */
    try{ return orig.apply(self,args); } finally{ if(window.print!==real){ window.print=real; window.__nxDocDate=dd; } }
  }

  /* ---------- paiements : événements à part (l'original figé n'est jamais réécrit) ---------- */
  function evenement(num,type,donnees){
    var e=entree(num); if(!e||e.mode!=='reel'||!e.sid) return;
    var q=rd(EVQ,[]); q.push({rid:rid(),sid:e.sid,num:num,type:type,donnees:donnees||{},at:Date.now()}); try{ localStorage.setItem(EVQ,JSON.stringify(q)); }catch(_){}
    viderEvenements();
  }
  window.nxEmisEvenement=evenement;
  function viderEvenements(){
    if(!cloud()) return Promise.resolve(0);
    var q=rd(EVQ,[]); if(!q.length) return Promise.resolve(0);
    var ok=[];
    return q.reduce(function(p,ev){ return p.then(function(){ return rpc('cp_document_evenement',{p_request_id:ev.rid,p_document_id:ev.sid,p_type:ev.type,p_donnees:ev.donnees}).then(function(r){ if(!(r&&r.error)) ok.push(ev.rid); },function(){}); }); },Promise.resolve())
      .then(function(){ var rest=rd(EVQ,[]).filter(function(ev){ return ok.indexOf(ev.rid)<0; }); try{ localStorage.setItem(EVQ,JSON.stringify(rest)); }catch(_){} return ok.length; });
  }

  /* ---------- fusion de synchronisation : un champ de facture émise n'est jamais perdu ---------- */
  function numsAnnules(o,cle){ return ((o&&o[cle])||[]).map(function(f){ return f&&f.num; }); }
  function protegerFusion(B,L,R,out){
    var parId=function(a){ var m={}; (Array.isArray(a)?a:[]).forEach(function(x){ if(x&&x.id!=null) m[x.id]=x; }); return m; };
    var reparations=[];
    /* chantiers */
    var Ld=parId(L.cp2_devis), Rd=parId(R.cp2_devis);
    (Array.isArray(out.cp2_devis)?out.cp2_devis:[]).forEach(function(d){
      var l=Ld[d.id], r=Rd[d.id]; var ann=[].concat(numsAnnules(d,'facAnnulees'),numsAnnules(l,'facAnnulees'),numsAnnules(r,'facAnnulees'));
      d.facAnnulees=union([d.facAnnulees,l&&l.facAnnulees,r&&r.facAnnulees]);
      ['facAcompte','facSolde'].forEach(function(k){ var cand=[d[k],l&&l[k],r&&r[k]].filter(function(f){ return f&&f.num&&ann.indexOf(f.num)<0; });
        if(!d[k]&&cand.length){ d[k]=cl(cand[0]); reparations.push(cand[0].num); }
        if(d[k]&&ann.indexOf(d[k].num)>=0) delete d[k]; });
    });
    /* interventions */
    var Lp=parId(L.cp2_dep), Rp=parId(R.cp2_dep);
    (Array.isArray(out.cp2_dep)?out.cp2_dep:[]).forEach(function(x){
      var l=Lp[x.id], r=Rp[x.id]; x.facAnnulees=union([x.facAnnulees,l&&l.facAnnulees,r&&r.facAnnulees]); var ann=numsAnnules(x,'facAnnulees');
      if(!x.facNum){ var src=[l,r].find(function(o){ return o&&o.facNum&&ann.indexOf(o.facNum)<0; });
        if(src){ ['facNum','facDate','facFig','facModifs','statut','payeLe','modeReg'].forEach(function(k){ if(src[k]!==undefined) x[k]=cl(src[k]); }); reparations.push(src.facNum); } }
    });
    /* locations */
    var Ll=parId(L.cp2_loc), Rl=parId(R.cp2_loc);
    (Array.isArray(out.cp2_loc)?out.cp2_loc:[]).forEach(function(o){
      var l=Ll[o.id], r=Rl[o.id]; o.facAnnulees=union([o.facAnnulees,l&&l.facAnnulees,r&&r.facAnnulees]); var ann=numsAnnules(o,'facAnnulees');
      if(!o.fac){ var f=[l&&l.fac,r&&r.fac].find(function(f){ return f&&f.num&&ann.indexOf(f.num)<0; }); if(f){ o.fac=cl(f); reparations.push(f.num); } }
    });
    /* contrats : union des factures par numéro */
    var Lc=parId(L.cp2_contrats), Rc=parId(R.cp2_contrats);
    (Array.isArray(out.cp2_contrats)?out.cp2_contrats:[]).forEach(function(c){
      var l=Lc[c.id], r=Rc[c.id]; c.facsAnnulees=union([c.facsAnnulees,l&&l.facsAnnulees,r&&r.facsAnnulees]); var ann=numsAnnules(c,'facsAnnulees');
      var avant=(c.facs||[]).length; c.facs=union([c.facs,l&&l.facs,r&&r.facs]).filter(function(f){ return ann.indexOf(f.num)<0; });
      if(c.facs.length>avant) reparations.push(c.id);
    });
    /* registre et avoirs : union (rien ne s'y supprime) ; compteurs : le plus grand */
    if(L[REG]||R[REG]) out[REG]=unionId([out[REG],L[REG],R[REG]]);
    if(L.cp2_avoirs||R.cp2_avoirs) out.cp2_avoirs=unionId([out.cp2_avoirs,L.cp2_avoirs,R.cp2_avoirs]);
    ['cp2_facseq','cp2_avseq',TSEQ].forEach(function(k){ var a=L[k], b=R[k]; if(a&&b&&a.year===b.year){ var m=cl(a); Object.keys(b).forEach(function(z){ if(typeof b[z]==='number'&&z!=='year') m[z]=Math.max(Number(a[z])||0,b[z]); }); out[k]=m; } });
    if(reparations.length) try{ window.__nxFusionReparee=(window.__nxFusionReparee||[]).concat(reparations); }catch(e){}
    return out;
  }
  function union(listes){ var vus={}, out=[]; listes.forEach(function(a){ (Array.isArray(a)?a:[]).forEach(function(f){ if(!f||!f.num||vus[f.num]) return; vus[f.num]=1; out.push(cl(f)); }); }); return out; }
  function unionId(listes){ var vus={}, out=[]; listes.forEach(function(a){ (Array.isArray(a)?a:[]).forEach(function(x){ if(!x) return; var k=x.id!=null?x.id:JSON.stringify(x); if(vus[k]) return; vus[k]=1; out.push(cl(x)); }); }); return out; }
  window.nxEmisProtegerFusion=protegerFusion;

  /* ---------- rapprochement avec le registre du serveur ---------- */
  function rapprocher(){
    if(mode()!=='reel'||!cloud()) return Promise.resolve({fait:false});
    return window.sb.from('climpilot_documents').select('id,request_id,num,serie,type,origine,date_doc,payload,payload_hash,fichiers_hash').order('cree_le',{ascending:true}).then(function(r){
      if(r.error) return {fait:false,erreur:r.error.message};
      var docs=r.data||[], restaures=[], conflits=[];
      docs.forEach(function(doc){
        var p=doc.payload||{}, src=p.src||{};
        if(doc.origine==='emis'){
          ajouterRegistre({num:doc.num,mode:'reel',origine:'emis',type:doc.type,serie:doc.serie,date:doc.date_doc,src:src,fac:p.fac?remplaceVide(p.fac,doc.num):null,model:p.model?Object.assign(remplaceVide(p.model,doc.num),{id:doc.num}):null,sid:doc.id,ph:doc.payload_hash,at:Date.now()});
          var res=restaurer(src,doc.num,p.fac?remplaceVide(p.fac,doc.num):null);
          if(res==='restaure') restaures.push(doc.num); else if(res==='conflit') conflits.push(doc.num);
          var a=attentes(); Object.keys(a).forEach(function(k){ if(a[k]&&a[k].rid===doc.request_id) attentePut(k,null); });
        } else {
          ajouterRegistre({num:doc.num,mode:'reel',origine:'reconstitue',type:doc.type,serie:doc.serie,date:doc.date_doc,src:src,fac:null,model:null,sid:doc.id,ph:doc.payload_hash,at:Date.now()});
        }
      });
      return importerAnciens(docs).then(function(n){ var es=classerInconnus(); viderEvenements(); deposerEnRetard(); return {fait:true,restaures:restaures,conflits:conflits,importes:n,essais:es}; });
    },function(e){ return {fait:false,erreur:String(e)}; });
  }
  window.nxEmisRapprocher=rapprocher;
  function remplaceVide(o,num){ var s=JSON.stringify(o||{}); return JSON.parse(s.replace(/"num":""/g,'"num":'+JSON.stringify(num))); }
  /* remet une facture émise dans son chantier / intervention / location / contrat si elle en a disparu */
  function restaurer(src,num,fac){
    if(!src||!src.k||!fac) return 'ok';
    try{
      if(src.k==='devis'){ var d=(DEVIS||[]).find(function(x){ return x.id===src.id; }); if(!d) return 'ok'; var k=src.w==='acompte'?'facAcompte':'facSolde';
        if(numsAnnules(d,'facAnnulees').indexOf(num)>=0) return 'ok'; if(d[k]&&d[k].num===num) return 'ok'; if(d[k]) return 'conflit';
        d[k]=cl(fac); save(LS.devis,DEVIS); return 'restaure'; }
      if(src.k==='dep'){ var x=(DEP||[]).find(function(o){ return o.id===src.id; }); if(!x) return 'ok';
        if(numsAnnules(x,'facAnnulees').indexOf(num)>=0||x.facNum===num) return 'ok'; if(x.facNum) return 'conflit';
        x.facNum=num; x.facDate=fac.date||x.facDate; if(x.statut==='brouillon') x.statut='facturee'; save(LS.dep,DEP); return 'restaure'; }
      if(src.k==='loc'){ var l=(LOC||[]).find(function(o){ return o.id===src.id; }); if(!l) return 'ok';
        if(numsAnnules(l,'facAnnulees').indexOf(num)>=0||(l.fac&&l.fac.num===num)) return 'ok'; if(l.fac) return 'conflit';
        l.fac=cl(fac); save(LS.loc,LOC); return 'restaure'; }
      if(src.k==='ctr'){ var c=(CTR||[]).find(function(o){ return o.id===src.id; }); if(!c) return 'ok';
        if(numsAnnules(c,'facsAnnulees').indexOf(num)>=0||(c.facs||[]).some(function(f){ return f.num===num; })) return 'ok';
        c.facs=(c.facs||[]).concat([cl(fac)]); save('cp2_contrats',CTR); return 'restaure'; }
    }catch(e){}
    return 'ok';
  }
  /* anciennes factures (avant le démarrage de la facturation réelle) : importées comme « reconstituées »
     SEULEMENT si elles ont été choisies explicitement au démarrage (choix « importer ») ; sinon ce sont des essais */
  function importerAnciens(docs){
    var surServeur={}; docs.forEach(function(d){ surServeur[d.num+'|'+srcCle((d.payload||{}).src)]=1; surServeur['N|'+d.num]=1; });
    var a=[];
    try{ (window.nxInvoices?nxInvoices():[]).forEach(function(i){ if(!/^F-\d{4}-\d+$/.test(i.num)||choix(i.num)!=='importer') return; var src={k:i.kind,id:i.id,w:i.which||(i.kind==='ctr'?i.which:'')}; if(surServeur[i.num+'|'+srcCle(src)]) return;
      if(entree(i.num)&&entree(i.num).origine==='emis'&&entree(i.num).mode==='reel') return;
      a.push({serie:'F',type:(i.kind==='devis'&&i.which==='acompte')?'acompte':'facture',num:i.num,date:i.date,src:src,payload:{v:1,app:VERSION,reconstitue:true,src:src,inv:{num:i.num,date:i.date,montant:i.montant,cli:i.cli,label:i.label,kind:i.kind}}}); }); }catch(e){}
    try{ (window.nxAvoirs?nxAvoirs():[]).forEach(function(v){ if(!/^AV-\d{4}-\d+$/.test(v.num)||choix(v.num)!=='importer') return; var src={k:'avoir',id:v.id,w:v.facNum}; if(surServeur[v.num+'|'+srcCle(src)]) return;
      a.push({serie:'AV',type:'avoir',num:v.num,date:v.date,src:src,payload:{v:1,app:VERSION,reconstitue:true,src:src,avoir:cl(v)}}); }); }catch(e){}
    return a.reduce(function(p,x){ return p.then(function(n){
      return rpc('cp_importer_ancien',{p_request_id:uuidDe(x.num+'|'+srcCle(x.src)),p_serie:x.serie,p_type:x.type,p_num:x.num,p_date:x.date||null,p_payload:x.payload}).then(function(r){
        if(!(r&&r.error)){ ajouterRegistre({num:x.num,mode:'reel',origine:'reconstitue',type:x.type,serie:x.serie,date:x.date,src:x.src,fac:null,model:null,sid:r.data&&r.data.doc&&r.data.doc.id,at:Date.now()}); return n+1; } return n; },function(){ return n; }); }); },Promise.resolve(0));
  }
  /* ---------- anciennes factures : liste, renommage en essais, démarrage explicite ---------- */
  /* factures et avoirs à l'ancien format (F-/AV-) qui ne sont pas des documents du registre du serveur */
  function anciennes(){
    var reelles={}; reg().forEach(function(e){ if(e.mode==='reel') reelles[e.num]=1; });
    var out=[];
    try{ (window.nxInvoices?nxInvoices():[]).forEach(function(i){ if(/^F-\d{4}-\d+$/.test(i.num)&&!reelles[i.num]) out.push({num:i.num,date:i.date||'',montant:i.montant,cli:i.cli||i.client||'',type:'facture'}); }); }catch(e){}
    try{ (window.nxAvoirs?nxAvoirs():[]).forEach(function(v){ if(/^AV-\d{4}-\d+$/.test(v.num)&&!reelles[v.num]) out.push({num:v.num,date:v.date||'',montant:v.montant,cli:'',type:'avoir',facNum:v.facNum}); }); }catch(e){}
    var vus={}; return out.filter(function(x){ if(vus[x.num]) return false; vus[x.num]=1; return true; });
  }
  window.nxEmisAnciennes=anciennes;
  /* renomme des numéros partout sur l'appareil (factures, factures annulées, avoirs et leur facture d'origine) */
  function renommer(map){
    var n=function(v){ return map[v]||v; }, nb=0, fx=function(f){ if(f&&f.num&&map[f.num]){ f.num=map[f.num]; nb++; } };
    try{ (DEVIS||[]).forEach(function(d){ fx(d.facAcompte); fx(d.facSolde); (d.facAnnulees||[]).forEach(fx); }); save(LS.devis,DEVIS); }catch(e){}
    try{ (DEP||[]).forEach(function(x){ if(x.facNum&&map[x.facNum]){ x.facNum=map[x.facNum]; nb++; } (x.facAnnulees||[]).forEach(fx); }); save(LS.dep,DEP); }catch(e){}
    try{ (LOC||[]).forEach(function(l){ fx(l.fac); (l.facAnnulees||[]).forEach(fx); }); save(LS.loc,LOC); }catch(e){}
    try{ (CTR||[]).forEach(function(c){ (c.facs||[]).forEach(fx); (c.facsAnnulees||[]).forEach(fx); }); save('cp2_contrats',CTR); }catch(e){}
    try{ var AV=window.nxAvoirs?nxAvoirs():null; if(AV){ AV.forEach(function(a){ if(map[a.num]){ a.num=map[a.num]; nb++; } if(a.facNum) a.facNum=n(a.facNum); }); save('cp2_avoirs',AV); } }catch(e){}
    return nb;
  }
  /* un avoir suit sa facture d'origine : essai si elle est un essai */
  function classement(liste,choisis){
    var c={}; liste.forEach(function(x){ c[x.num]=choisis&&choisis[x.num]==='importer'?'importer':'essai'; });
    liste.forEach(function(x){ if(x.type==='avoir'&&x.facNum&&c[x.facNum]) c[x.num]=c[x.facNum]; });
    return c;
  }
  function renommesDe(c){ var m={}; Object.keys(c).forEach(function(n){ if(c[n]==='essai') m[n]='ESSAI-'+n; }); return m; }
  /* décision explicite : « démarrer la facturation réelle à partir du … » */
  function demarrer(debut,choisis){
    if(decision()) return {err:'La facturation réelle est déjà décidée (à partir du '+fr(decision().debut)+').'};
    if(!siretOk()) return {err:'Saisis d\'abord le SIRET de l\'entreprise (14 chiffres) dans Paramètres › Entreprise.'};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(debut||'')) return {err:'Date de début invalide.'};
    if(debut<today()) return {err:'La date de début ne peut pas être passée.'};
    var liste=anciennes(), c=classement(liste,choisis||{}), m=renommesDe(c), nb=renommer(m), dec={};
    Object.keys(c).forEach(function(n){ dec[c[n]==='essai'?m[n]:n]=c[n]; });
    wr(FR,{debut:debut,decideLe:new Date().toISOString(),anciens:dec,renommes:m,v:1});
    var imp=Object.keys(c).filter(function(n){ return c[n]==='importer'; });
    if(reelDemarre()&&cloud()) sonde(true).then(function(){ badge(); return rapprocher(); }).then(function(){ badge(); },function(){});
    try{ badge(); updateBadges(); }catch(e){}
    return {ok:true,debut:debut,essais:Object.keys(m).length,renommes:nb,importes:imp};
  }
  window.nxEmisDemarrer=demarrer;
  /* revenir sur la décision : avant la date de début, ou après si AUCUN document réel n'existe (appareil ET serveur).
     Les anciennes factures renommées ESSAI-… reprennent leur numéro. La décision annulée reste tracée (synchronisée). */
  function annulable(){
    var o=decision(); if(!o) return Promise.resolve({ok:false,err:'Aucune décision de facturation réelle à annuler.'});
    if(!reelDemarre()) return Promise.resolve({ok:true});
    if(reg().some(function(e){ return e.mode==='reel'; })) return Promise.resolve({ok:false,err:'Des factures réelles existent déjà (numéros du serveur) : la facturation réelle ne peut plus être annulée. Une facture émise se corrige par un avoir.'});
    if(!cloud()) return Promise.resolve({ok:false,err:'Connecte-toi au cloud : il faut vérifier sur le serveur qu\'aucune facture réelle n\'a été émise (depuis un autre appareil).'});
    return window.sb.from('climpilot_documents').select('id').limit(1).then(function(r){
      if(r&&r.error) return {ok:false,err:'Vérification impossible sur le serveur ('+(r.error.message||'erreur')+') : rien n\'a été annulé.'};
      if(r&&r.data&&r.data.length) return {ok:false,err:'Le serveur contient déjà des factures réelles : la facturation réelle ne peut plus être annulée.'};
      return {ok:true};
    },function(e){ return {ok:false,err:'Serveur injoignable : rien n\'a été annulé.'}; });
  }
  function annuler(){
    return annulable().then(function(a){
      if(!a.ok) return a;
      var o=decision(), inv={}; Object.keys(o.renommes||{}).forEach(function(n){ inv[o.renommes[n]]=n; });
      var nb=renommer(inv);
      wr(FR,{annule:true,annuleLe:new Date().toISOString(),precedent:{debut:o.debut,decideLe:o.decideLe},v:1});
      INFO={t:0,ok:null,raison:'',detail:''};
      try{ badge(); updateBadges(); }catch(e){}
      return {ok:true,restaures:nb};
    });
  }
  window.nxEmisAnnulerDecision=annuler;
  /* après le démarrage, une ancienne facture inconnue (arrivée d'un autre appareil) est un essai par défaut ;
     appelé seulement après lecture réussie du registre du serveur (rapprocher) */
  function classerInconnus(){
    var o=decision(); if(!o) return 0;
    var inconnues=anciennes().filter(function(x){ return !(o.anciens&&o.anciens[x.num]==='importer'); });
    if(!inconnues.length) return 0;
    var c=classement(inconnues,{}), m=renommesDe(c); renommer(m);
    o.anciens=o.anciens||{}; o.renommes=o.renommes||{}; Object.keys(m).forEach(function(n){ o.anciens[m[n]]='essai'; o.renommes[n]=m[n]; });
    wr(FR,o); say('🧪 '+Object.keys(m).length+' ancienne(s) facture(s) classée(s) en essais (renommées ESSAI-…)');
    return Object.keys(m).length;
  }
  /* avant un envoi en production : le XML figé doit être sur le serveur (dépôt en retard rejoué) */
  window.nxEmisDeposer=function(num){ var f=fichiers()[num]; if(!f||!f.aDeposer) return Promise.resolve(true); /* sinon le serveur dit lui-même si le XML manque */ return deposerFichiers(f.aDeposer,num,f.html,f.xml); };
  function deposerEnRetard(){ var all=fichiers(); Object.keys(all).forEach(function(num){ var f=all[num]; if(f&&f.aDeposer) deposerFichiers(f.aDeposer,num,f.html,f.xml); }); }

  /* ---------- synchro : version envoyée au serveur ---------- */
  window.cpStatePushRpc=function(L,expected,force){
    return window.sb.rpc('cp_state_push',{p_data:L,p_expected:expected,p_force:force,p_client_version:VERSION}).then(function(r){
      /* serveur pas encore migré (ancienne fonction sans p_client_version) : même appel qu'avant */
      if(r&&r.error&&absente(r.error)) return window.sb.rpc('cp_state_push',{p_data:L,p_expected:expected,p_force:force});
      return r;
    });
  };

  /* ---------- branchement ---------- */
  function envelopper(){
    Object.keys(SORTES).forEach(function(k){ var S=SORTES[k], o=window[S.fn]; if(typeof o!=='function'||o._nxem) return;
      ORIG[S.fn]=o; var w=function(){ return emettre(k,Array.prototype.slice.call(arguments)); }; w._nxem=true; window[S.fn]=w; });
    /* réimpressions */
    [['printFactureDevis',function(a){ var d=a[0], f=a[1]==='acompte'?'facAcompte':'facSolde'; return d&&d[f]?[d[f].num,d[f].date]:[null,null]; }],
     ['printFacture',function(){ return (typeof curDep!=='undefined'&&curDep)?[curDep.facNum,curDep.facDate]:[null,null]; }],
     ['printFactureLoc',function(a){ return a[0]&&a[0].fac?[a[0].fac.num,a[0].fac.date]:[null,null]; }],
     ['printFactureCtr',function(a){ return a[1]?[a[1].num,a[1].date]:[null,null]; }],
     ['nxPrintAvoir',function(a){ var v=(window.nxAvoirs?nxAvoirs():[]).find(function(x){ return x.id===a[0]||x.num===a[0]; }); return v?[v.num,v.date]:[null,null]; }]
    ].forEach(function(p){ var o=window[p[0]]; if(typeof o!=='function'||o._nxem) return;
      var w=function(){ var a=Array.prototype.slice.call(arguments);
        if(p[0]==='printFacture'&&!EMITTING){ try{ formToDep(); }catch(e){} if(typeof curDep!=='undefined'&&curDep&&!curDep.facNum){
          if(confirm('Pas encore de n° de facture. Émettre la facture maintenant ?')) return window.factureDep(); return; } }
        var nd=p[1](a); if(!nd[0]) return o.apply(this,a); return reimprimer(nd[0],nd[1],o,this,a); }; w._nxem=true; window[p[0]]=w; });
    /* API directe (tests, assistant) : synchrone en démonstration ; en mode réel, l'avoir passe par l'écran Avoirs (serveur) */
    var ca=window.nxCreateAvoir; if(typeof ca==='function'&&!ca._nxem){ var wc=function(o){
        if(typeof window.nxAvoirBuild!=='function') return ca.apply(this,arguments);
        if(mode()!=='demo') return {err:'Avoir à émettre depuis l\'écran Avoirs (numéro attribué par le serveur).'};
        var b=window.nxAvoirBuild(o,'PROVISOIRE-AV'); if(b.err) return b;
        var model=null; try{ var AVL=nxAvoirs(); AVL.push(b.av); try{ model=window.nxEinvModelLive('PROVISOIRE-AV'); } finally{ AVL.splice(AVL.indexOf(b.av),1); } }catch(e){}
        var num=numTest('AV',b.av.date); b.av.num=num; var r=window.nxAvoirCommit(b,o);
        var mdl=model?remplacer(model,'PROVISOIRE-AV',num):null; if(mdl) mdl.id=num;
        var html=capturer(function(){ window.nxPrintAvoir(r.av.id); },r.av.date);
        var xml=null; try{ if(mdl) xml=window.nxEinvXMLOf(mdl); }catch(e){}
        ajouterRegistre({num:num,mode:'demo',origine:'emis',type:'avoir',serie:'AV',date:r.av.date,src:{k:'avoir',id:r.av.id,w:r.av.facNum},fac:cl(r.av),model:mdl,sid:null,ph:'',at:Date.now()});
        fichiersPut(num,{html:filigrane(html),xml:xml,at:Date.now(),mode:'demo'});
        return r; }; wc._nxem=true; window.nxCreateAvoir=wc; }
    /* paiements → événements */
    var pf=window.payerFacture; if(typeof pf==='function'&&!pf._nxem){ var wp=function(kind,id,which){ var r=pf.apply(this,arguments); try{ var n=numDe(kind,id,which); if(n) evenement(n,'paiement',{date:today(),source:'payerFacture'}); }catch(e){} return r; }; wp._nxem=true; window.payerFacture=wp; }
    var pd=window.payDep; if(typeof pd==='function'&&!pd._nxem){ var wd=function(id){ var x=(DEP||[]).find(function(o){ return o.id===id; }), avant=x&&x.statut; var r=pd.apply(this,arguments); try{ if(x&&x.facNum&&avant!==x.statut) evenement(x.facNum,x.statut==='payee'?'paiement':'paiement_annule',{date:today(),mode:x.modeReg||''}); }catch(e){} return r; }; wd._nxem=true; window.payDep=wd; }
    /* une facture enregistrée sur le serveur ne se « corrige » plus : avoir */
    var un=window.nxfUnlockDep; if(typeof un==='function'&&!un._nxem){ var wu=function(){ try{ var e=curDep&&entree(curDep.facNum); if(e&&e.mode==='reel'&&e.origine==='emis'){ alert('La facture '+curDep.facNum+' est émise et enregistrée sur le serveur : elle ne se modifie plus. Pour la corriger, fais un avoir (écran Avoirs).'); return; } }catch(_){} return un.apply(this,arguments); }; wu._nxem=true; window.nxfUnlockDep=wu; }
    /* défense en profondeur : un appel direct à l'ancien compteur ne peut plus produire un vrai numéro */
    var nf=window.nextFacNum; if(typeof nf==='function'&&!nf._nxem){ var g=function(){ if(mode()==='demo') return numTest('F',today()); throw new Error('Numéro de facture réservé au serveur (ClimPilot 1.10).'); }; g._nxem=true; window.nextFacNum=g; }
    /* l'indicateur de mode suit les mises à jour de l'appli (SIRET saisi, démarrage, émission) */
    var ub=window.updateBadges; if(typeof ub==='function'&&!ub._nxem){ var wb=function(){ var r=ub.apply(this,arguments); try{ badge(); }catch(e){} return r; }; wb._nxem=true; window.updateBadges=wb; }
    /* fusion de synchro protégée */
    var mg=window.cpMerge; if(typeof mg==='function'&&!mg._nxem){ var wm=function(B,L,R){ var out=mg.apply(this,arguments); try{ return protegerFusion(B||{},L||{},R||{},out); }catch(e){ return out; } }; wm._nxem=true; window.cpMerge=wm; }
    /* onglet en lecture seule : pas de synchro */
    ['pushState','pullState','markDirty'].forEach(function(f){ var o=window[f]; if(typeof o!=='function'||o._nxro) return; var w=function(){ if(window.__cpLectureSeule) return; return o.apply(this,arguments); }; w._nxro=true; window[f]=w; });
  }
  function numDe(kind,id,which){
    if(kind==='devis'){ var d=(DEVIS||[]).find(function(x){ return x.id===id; }); var f=d&&(which==='acompte'?d.facAcompte:d.facSolde); return f&&f.num; }
    if(kind==='loc'){ var l=(LOC||[]).find(function(x){ return x.id===id; }); return l&&l.fac&&l.fac.num; }
    if(kind==='ctr'){ var c=(CTR||[]).find(function(x){ return x.id===id; }); var f2=c&&(c.facs||[]).find(function(x){ return String(x.annee)===String(which); }); return f2&&f2.num; }
    if(kind==='dep'){ var x=(DEP||[]).find(function(o){ return o.id===id; }); return x&&x.facNum; }
    return null;
  }

  /* ---------- affichage du mode ---------- */
  function badge(){
    var foot=document.querySelector('.side .foot'); if(!foot) return;
    var b=document.getElementById('nxEmisBadge'); if(!b){ b=document.createElement('div'); b.id='nxEmisBadge'; b.style.cssText='margin-top:6px;font-size:11px;line-height:1.4'; foot.insertBefore(b,foot.firstChild); }
    var m=mode(), n=Object.keys(attentes()).length, dbl=Object.keys(doublons());
    b.innerHTML=(m==='reel'?'<span style="color:#7de3a0">● Facturation réelle (numéros du serveur)</span>':m==='bloque'?'<span style="color:#ff9d9d">● Facturation bloquée : '+esc(RAISON[INFO.raison]||'serveur')+'</span>':'<span style="color:#ffd58a">● Mode démonstration : numéros TEST'+(siretOk()?(decision()?' — facturation réelle à partir du '+esc(fr(decision().debut)):' — facturation réelle à démarrer (Paramètres)'):'')+'</span>')+
      (n?'<br><span style="color:#ffd58a">'+n+' facture(s) en attente d\'émission</span>':'')+(dbl.length?'<br><span style="color:#ff9d9d">Numéros en double : '+esc(dbl.join(', '))+'</span>':'');
  }
  window.nxEmisBadge=badge;

  /* ---------- Paramètres › Facturation réelle ---------- */
  function carteParams(){
    var v=document.getElementById('v-params'); if(!v) return;
    var c=document.getElementById('nxReelCard'); if(!c){ c=document.createElement('div'); c.className='card'; c.id='nxReelCard'; v.insertBefore(c,v.firstChild); }
    var o=decision(), eur=function(x){ try{ return money(Number(x)||0); }catch(e){ return (Number(x)||0).toFixed(2)+' €'; } };
    if(o){
      var es=Object.keys(o.anciens||{}).filter(function(n){ return o.anciens[n]==='essai'; }).length, im=Object.keys(o.anciens||{}).filter(function(n){ return o.anciens[n]==='importer'; });
      c.innerHTML='<h2>🧾 Facturation réelle</h2><div class="sub">'+(reelDemarre()?'Démarrée le <b>'+esc(fr(o.debut))+'</b>':'Démarrage prévu le <b>'+esc(fr(o.debut))+'</b> (d\'ici là : mode démonstration, numéros TEST)')+
        ' — décidée le '+esc(fr(String(o.decideLe||'').slice(0,10)))+'.<br>Anciennes factures : '+es+' classée(s) en essais (renommées ESSAI-…, hors registre et hors chiffre d\'affaires)'+(im.length?', '+im.length+' importée(s) au registre : '+esc(im.join(', ')):'')+'.</div>'+
        (reg().some(function(e){ return e.mode==='reel'; })?'':'<div class="row-actions" style="margin-top:10px"><button class="btn-ghost btn-sm" onclick="nxEmisAnnulerUI()">Annuler cette décision / changer la date</button></div><div class="sub" id="nxReelMsg"></div>');
      return;
    }
    var l=anciennes(), lignes=l.filter(function(x){ return x.type==='facture'; }).map(function(x){
      return '<tr><td class="l"><b>'+esc(x.num)+'</b></td><td class="l">'+esc(fr(x.date))+'</td><td class="l">'+esc(x.cli||'—')+'</td><td>'+(x.montant!=null?eur(x.montant):'—')+'</td><td class="l"><select data-reel-num="'+esc(x.num)+'"><option value="essai" selected>Essai (par défaut)</option><option value="importer">Vraie facture : l\'importer</option></select></td></tr>'; }).join('');
    c.innerHTML='<h2>🧾 Facturation réelle</h2>'+
      '<div class="sub">Tant qu\'elle n\'est pas démarrée, ClimPilot reste en <b>mode démonstration</b> (numéros TEST, sans valeur), même avec un SIRET. Le démarrage est une décision : il est <b>définitif</b>.</div>'+
      (lignes?'<div class="sub" style="margin-top:8px">Anciennes factures trouvées sur cet appareil : par défaut ce sont des <b>essais</b> (renommées ESSAI-…, jamais envoyées au registre du serveur, hors chiffre d\'affaires). N\'importe que les vraies factures, une par une.</div><div class="scroll"><table><thead><tr><th class="l">N°</th><th class="l">Date</th><th class="l">Client</th><th>Montant</th><th class="l">Classement</th></tr></thead><tbody>'+lignes+'</tbody></table></div>':'<div class="sub" style="margin-top:8px">Aucune ancienne facture sur cet appareil.</div>')+
      '<div class="row-actions" style="margin-top:10px"><label>À partir du <input type="date" id="nxReelDebut" value="'+esc(today())+'" min="'+esc(today())+'"></label>'+
      '<button class="btn-pri btn-sm" onclick="nxEmisDemarrerUI()">Démarrer la facturation réelle</button></div><div class="sub" id="nxReelMsg"></div>';
  }
  window.nxEmisCarteParams=carteParams;
  window.nxEmisAnnulerUI=function(){
    var msg=document.getElementById('nxReelMsg');
    if(!confirm('Annuler la décision de facturation réelle ?\n\nClimPilot repasse en mode démonstration (numéros TEST). Les anciennes factures renommées ESSAI-… reprennent leur numéro. Tu pourras redémarrer la facturation réelle à la date de ton choix.\n\nC\'est possible seulement si aucune facture réelle n\'a été émise.')) return;
    if(msg) msg.textContent='Vérification…';
    annuler().then(function(r){
      if(!r.ok){ if(msg) msg.textContent='⚠ '+r.err; else alert(r.err); return; }
      say('↩️ Décision annulée : mode démonstration'+(r.restaures?' — '+r.restaures+' facture(s) reprennent leur numéro':'')); carteParams();
    });
  };
  window.nxEmisDemarrerUI=function(){
    var debut=(document.getElementById('nxReelDebut')||{}).value||'', choisis={}, msg=document.getElementById('nxReelMsg');
    [].forEach.call(document.querySelectorAll('#nxReelCard select[data-reel-num]'),function(s){ choisis[s.getAttribute('data-reel-num')]=s.value; });
    var l=anciennes(), c=classement(l,choisis), im=Object.keys(c).filter(function(n){ return c[n]==='importer'; }), es=Object.keys(c).length-im.length;
    if(!siretOk()){ if(msg) msg.textContent='⚠ Saisis d\'abord le SIRET (Paramètres › Entreprise).'; return; }
    if(!confirm('Démarrer la facturation réelle à partir du '+fr(debut)+' ?\n\n'+
      '• '+es+' ancienne(s) facture(s) ou avoir(s) classé(s) en ESSAIS : renommés ESSAI-…, jamais envoyés au registre du serveur, hors chiffre d\'affaires.\n'+
      '• '+im.length+' importé(s) DÉFINITIVEMENT au registre du serveur'+(im.length?' : '+im.join(', '):'')+'.\n\n'+
      'À partir de cette date, les numéros de facture sont donnés par le serveur. Cette décision est définitive.')) return;
    var r=demarrer(debut,choisis);
    if(r.err){ if(msg) msg.textContent='⚠ '+r.err; return; }
    say('🧾 Facturation réelle '+(reelDemarre()?'démarrée':'prévue le '+fr(debut))); carteParams();
  };
  function boot(){
    envelopper();
    var og=window.go; if(typeof og==='function'&&!og._nxreel){ window.go=function(v){ var r=og.apply(this,arguments); try{ if(v==='params') carteParams(); }catch(e){} return r; }; window.go._nxreel=true; }
    var t=0; var tick=function(){ badge(); t++; if(t<3) setTimeout(tick,1500); };
    setTimeout(function(){ tick(); if(cloud()&&siretOk()&&reelDemarre()) sonde(true).then(function(){ badge(); return rapprocher(); }).then(function(r){ badge(); if(r&&r.restaures&&r.restaures.length) say('🛟 '+r.restaures.length+' facture(s) remise(s) en place depuis le registre du serveur : '+r.restaures.join(', ')); if(r&&r.conflits&&r.conflits.length) alert('⚠ Conflit de numéros de facture à vérifier : '+r.conflits.join(', ')+'\nRien n\'a été renuméroté. Ouvre le registre des documents.'); }); },2500);
    window.addEventListener('online',function(){ viderEvenements(); deposerEnRetard(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
