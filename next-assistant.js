/* ============================================================
   ClimPilot Next — next-assistant.js  (couche additive, v1)
   L'ASSISTANT : boîte de réception des propositions de l'agent IA
   + note rapide dictée + catalogue publié pour l'agent.

   Principe : l'agent (Claude) dépose des propositions dans la table
   Supabase `climpilot_inbox`. L'appli les affiche ; Gabriel valide.
     - note / tache / rdv  (statut 'auto')  → enregistrées toutes seules
     - devis / intervention / message (statut 'a_valider') → rien n'est
       créé ni envoyé sans son clic. Un devis proposé s'ouvre PRÉ-REMPLI
       dans le formulaire : les PRIX sont calculés par ClimPilot, jamais
       par l'IA. La proposition n'est soldée qu'à l'enregistrement.
   Catalogue : l'appli publie (clé synchronisée cp2_agent_catalog) la
   liste des types, options, articles, clients… que l'agent a le droit
   d'utiliser — il ne peut rien inventer hors de ce catalogue.
   Chargé en dernier dans index.html.
   ============================================================ */
(function(){
  'use strict';

  var TABLE = 'climpilot_inbox';
  var CAT_KEY = 'cp2_agent_catalog';
  var DONE_KEY = 'cpnext_inbox_done';          /* ids déjà importés (anti-doublon, local) */
  var ROWS = [], RECENT = [], STATE = 'init', LAST_ERR = '';
  var ICO = {note:'📝',tache:'✅',rdv:'📅',devis:'📄',intervention:'🔧',message:'✉️',autre:'💡'};
  var LBL = {note:'Note',tache:'Tâche',rdv:'Rendez-vous',devis:'Devis',intervention:'Intervention',message:'Message client',autre:'Autre'};

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function toastX(m,t){ try{ if(window.nxToast) return window.nxToast(m,t); }catch(e){} try{ toast(m); }catch(e){} }
  function pad(n){ return (n<10?'0':'')+n; }
  function dISO(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function fmtWhen(ts){ try{ var d=new Date(ts); return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
  function lsGet(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function cloudOk(){ try{ return !!(sb && SESS && SESS.user); }catch(e){ return false; } }

  /* ---------- 1. Analyse légère d'une note dictée (sans IA) ---------- */
  var JOURS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  function parseNote(txt){
    var t=String(txt||'').trim(), low=t.toLowerCase(), now=new Date(), due=null, heure='';
    if(/apr[eè]s[- ]demain/.test(low)){ due=new Date(now); due.setDate(due.getDate()+2); }
    else if(/\bdemain\b/.test(low)){ due=new Date(now); due.setDate(due.getDate()+1); }
    else if(/aujourd'?hui|ce soir|ce matin|cet apr[eè]s-midi|tout [àa] l'heure/.test(low)){ due=new Date(now); }
    else {
      for(var i=0;i<7;i++){ if(new RegExp('\\b'+JOURS[i]+'\\b').test(low)){ due=new Date(now); var diff=(i-now.getDay()+7)%7; if(diff===0) diff=7; due.setDate(due.getDate()+diff); break; } }
      var m=low.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
      if(!due && m){ var y=m[3]?(+m[3]<100?2000+(+m[3]):+m[3]):now.getFullYear(); var dd=new Date(y,+m[2]-1,+m[1]); if(!isNaN(dd)) due=dd; }
    }
    var h=low.match(/\b(?:à|a|vers)?\s*(\d{1,2})\s*h\s*(\d{2})?\b/);
    if(h && +h[1]<24) heure=pad(+h[1])+':'+(h[2]||'00');
    var prio = /urgent|vite|important|imp[ée]ratif|sans faute/.test(low) ? 'high' : 'medium';
    var cat='Autre';
    if(/rappeler|appeler|client|devis|relancer/.test(low)) cat='Client';
    if(/fournisseur|commande|livraison|re[çc]oit|recevoir|colis/.test(low)) cat='Fournisseur';
    if(/chantier|pose|installation|d[ée]pannage|intervention|visite/.test(low)) cat='Chantier';
    if(/stock|mat[ée]riel|pi[èe]ce/.test(low)) cat=(cat==='Autre'?'Stock':cat);
    if(/urssaf|imp[ôo]t|banque|assurance|facture|compta|papier/.test(low)) cat='Administratif';
    if(/entretien|contrat/.test(low)) cat=(cat==='Autre'?'Entretien':cat);
    var title=t.charAt(0).toUpperCase()+t.slice(1);
    if(heure && title.indexOf(heure.replace(':00','h'))<0 && !/\d\s*h/.test(title)) title=heure.replace(':','h')+' — '+title;
    return {title:title, due:due?dISO(due):'', heure:heure, priority:prio, cat:cat};
  }
  window.nxaParseNote = parseNote;

  /* ---------- 2. Ajout d'une tâche via le module À faire existant ---------- */
  function addTask(o){
    if(typeof window.nxOpenTaskModal!=='function' || typeof window.nxSaveTask!=='function') return false;
    try{
      window.nxOpenTaskModal();
      var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
      set('nxTaskTitle', o.title||'');
      set('nxTaskDue', o.due||'');
      set('nxTaskPriority', ['high','medium','low'].indexOf(o.priority)>=0?o.priority:'medium');
      var catEl=document.getElementById('nxTaskCat');
      if(catEl){ var ok=[].some.call(catEl.options,function(op){return op.value===o.cat;}); catEl.value=ok?o.cat:'Autre'; }
      set('nxTaskLink', o.link||'');
      window.nxSaveTask();
      return true;
    }catch(e){ return false; }
  }
  window.nxaAddTask = addTask;

  /* ---------- 3. Note rapide (champ + dictée clavier / micro) ---------- */
  function quickPreview(){
    var ta=document.getElementById('nxaQuick'), pv=document.getElementById('nxaQuickPv'); if(!ta||!pv) return;
    var v=ta.value.trim(); if(!v){ pv.innerHTML=''; return; }
    var p=parseNote(v);
    pv.innerHTML='<span class="nxa-chip">'+esc(p.cat)+'</span>'+(p.due?'<span class="nxa-chip">📅 '+esc(new Date(p.due+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))+'</span>':'<span class="nxa-chip mute">sans date</span>')+(p.heure?'<span class="nxa-chip">🕕 '+esc(p.heure.replace(':','h'))+'</span>':'')+(p.priority==='high'?'<span class="nxa-chip hot">urgent</span>':'');
  }
  window.nxaQuickPreview = quickPreview;
  window.nxaQuickSave = function(){
    var ta=document.getElementById('nxaQuick'); if(!ta) return;
    var v=ta.value.trim(); if(!v){ toastX('Dicte ou écris ta note d\'abord','warn'); return; }
    var p=parseNote(v); p.link='Note rapide';
    if(addTask(p)){ ta.value=''; quickPreview(); toastX('📝 Note enregistrée dans « À faire »'+(p.due?' pour le '+new Date(p.due+'T12:00:00').toLocaleDateString('fr-FR'):''),'ok'); }
    else toastX('Impossible d\'enregistrer la note (module À faire absent)','warn');
    renderAssist();
  };
  /* micro navigateur si disponible (Chrome PC/Android) ; sinon la dictée du clavier iPhone fait le travail */
  var REC=null;
  window.nxaMic = function(){
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    var ta=document.getElementById('nxaQuick');
    if(!SR){ toastX('Sur iPhone : touche le champ puis le 🎙️ du clavier pour dicter','warn'); if(ta) ta.focus(); return; }
    if(REC){ try{ REC.stop(); }catch(e){} REC=null; return; }
    try{
      REC=new SR(); REC.lang='fr-FR'; REC.interimResults=false; REC.continuous=false;
      var btn=document.getElementById('nxaMicBtn'); if(btn) btn.classList.add('on');
      REC.onresult=function(ev){ var t=''; for(var i=0;i<ev.results.length;i++) t+=ev.results[i][0].transcript; if(ta){ ta.value=(ta.value?ta.value+' ':'')+t; quickPreview(); } };
      REC.onend=function(){ REC=null; var b=document.getElementById('nxaMicBtn'); if(b) b.classList.remove('on'); };
      REC.onerror=function(){ toastX('Micro indisponible — utilise la dictée du clavier','warn'); };
      REC.start();
    }catch(e){ REC=null; toastX('Micro indisponible — utilise la dictée du clavier','warn'); }
  };

  /* ---------- 4. Catalogue publié pour l'agent ---------- */
  function uniq(a){ var s={},o=[]; a.forEach(function(x){ if(x!=null && x!=='' && !s[x]){ s[x]=1; o.push(x); } }); return o; }
  function buildCatalog(){
    var c={v:1};
    try{
      var ft=document.getElementById('f_type'); c.types=ft?[].map.call(ft.options,function(o){return o.value;}):Object.keys(TYPEUNITS);
      c.typeUnits=TYPEUNITS; c.splitPowers=SPLIT_POWERS; c.splitCables=SPLIT_CABLES; c.groupCables=GROUP_CABLES;
      c.zones=Object.keys(P.zone); c.acces={'0':'Facile','moyen':'Moyen','diff':'Difficile'};
      c.tests={'0':'Aucun','vide':'Tirage au vide','azote':'Test azote','etanch':'Contrôle étanchéité'};
      c.taille=['auto','petit','moyen','gros']; c.mes=Object.keys(P.mes||{}); c.brasure=Object.keys(P.bras||{});
      c.tauxHoraire=P.defaultRate; c.taux=P.rates||[];
      c.liaisons=PRIX.filter(function(p){return p.cat==='Cuivre';}).map(function(p){return p.nom;});
      c.goulottes=PRIX.filter(function(p){return p.cat==='Goulotte'&&p.unite==='m';}).map(function(p){return p.nom;});
      c.supports=PRIX.filter(function(p){return p.cat==='Supports';}).map(function(p){return p.nom;});
      c.pompes=PRIX.filter(function(p){return p.cat==='Pompe';}).map(function(p){return p.nom;});
      var byCat={}; PRIX.forEach(function(p){ (byCat[p.cat||'Divers']=byCat[p.cat||'Divers']||[]).push(p.nom); }); c.articles=byCat;
      c.kits=Object.keys(typeof KITS!=='undefined'?KITS:{});
      c.depPannes=Object.keys(P.depPannes||{}); c.depTaux=(P.dep&&P.dep.taux)||null;
      c.machinesConnues=(MACHLIB||[]).map(function(m){return {marque:m.marque,ref:m.ref,achat:m.achat};});
      c.clients=(CLIENTS||[]).map(function(x){return {nom:x.nom,ville:x.ville||'',tel:x.tel||'',mail:x.mail||'',type:x.type||'',adr:x.adr||'',zone:x.lastZone||''};});
    }catch(e){ c.erreur=String(e&&e.message||e); }
    return c;
  }
  function publishCatalog(){
    try{
      var c=buildCatalog(), s=JSON.stringify(c);
      if(localStorage.getItem(CAT_KEY)!==s){
        if(typeof save==='function') save(CAT_KEY,c); else localStorage.setItem(CAT_KEY,s);
      }
    }catch(e){}
  }
  window.nxaCatalog = buildCatalog;
  try{ if(Array.isArray(SYNC_KEYS) && SYNC_KEYS.indexOf(CAT_KEY)<0) SYNC_KEYS.push(CAT_KEY); }catch(e){}

  /* ---------- 5. Boîte de réception (Supabase) ---------- */
  function fetchInbox(){
    if(!cloudOk()){ STATE='offline'; renderAssist(); setBadge(); return Promise.resolve(); }
    var since=new Date(Date.now()-7*86400000).toISOString();
    return sb.from(TABLE).select('*').or('statut.in.(a_valider,auto),traite_at.gte."'+since+'"').order('created_at',{ascending:true}).limit(200)
      .then(function(r){
        if(r.error){ STATE=/does not exist|not find|PGRST205|42P01/i.test((r.error.message||'')+(r.error.code||''))?'notable':'error'; LAST_ERR=r.error.message||''; ROWS=[]; RECENT=[]; }
        else {
          STATE='ok';
          var all=r.data||[];
          ROWS=all.filter(function(x){return x.statut==='a_valider';});
          RECENT=all.filter(function(x){return x.statut!=='a_valider';}).reverse();
          return autoImport(all.filter(function(x){return x.statut==='auto';}));
        }
      })
      .catch(function(e){ STATE='error'; LAST_ERR=String(e&&e.message||e); })
      .then(function(){ renderAssist(); setBadge(); });
  }
  window.nxaRefresh = fetchInbox;

  function mark(id,statut){
    if(!cloudOk()) return Promise.resolve();
    return sb.from(TABLE).update({statut:statut,traite_at:new Date().toISOString()}).eq('id',id)
      .then(function(r){ if(r&&r.error) toastX('⚠ Boîte de réception : '+r.error.message,'warn'); })
      .catch(function(){});
  }

  function autoImport(rows){
    var done=lsGet(DONE_KEY,[]), jobs=[];
    rows.forEach(function(x){
      if(done.indexOf(x.id)>=0){ jobs.push(mark(x.id,'valide')); return; }
      var p=x.payload||{};
      if(x.kind==='note'||x.kind==='tache'){
        var o=parseNote(p.texte||x.titre||'');
        if(p.echeance) o.due=String(p.echeance).slice(0,10);
        if(p.priorite) o.priority=p.priorite;
        if(p.categorie) o.cat=p.categorie;
        o.title=x.titre||o.title; o.link='Assistant IA';
        addTask(o);
      }
      /* rdv : déjà posé dans Google Agenda par l'agent → simple trace ici */
      done.push(x.id); x.statut='valide'; x.traite_at=new Date().toISOString();
      jobs.push(mark(x.id,'valide'));
    });
    if(rows.length){ lsSet(DONE_KEY,done.slice(-500)); RECENT=rows.concat(RECENT); }
    return Promise.all(jobs);
  }

  window.nxaReject = function(id){
    if(!confirm('Écarter cette proposition ?')) return;
    mark(id,'rejete').then(fetchInbox);
  };

  /* --- devis proposé → formulaire pré-rempli (validation = enregistrement) --- */
  function findRow(id){ return ROWS.filter(function(x){return x.id===id;})[0]; }
  function inList(v,list){ return list.indexOf(v)>=0; }
  window.nxaOpenDevis = function(id){
    var x=findRow(id); if(!x) return;
    var p=x.payload||{}, warn=[].concat(p.a_verifier||[]);
    try{
      go('wizard'); newDevis();
      var cat=buildCatalog();
      var type=p.type&&inList(p.type,cat.types)?p.type:null;
      if(p.type && !type) warn.push('Type « '+p.type+' » non reconnu — choisis-le');
      if(type){ cur.type=type; if(TYPEUNITS[type]){ cur.nbMach=TYPEUNITS[type][0]; cur.nbSplit=TYPEUNITS[type][1]; } if(P.mes&&P.mes[type]!=null) cur.mes=type; }
      var cl=p.client||{};
      cur.cNom=cl.nom||''; cur.cTel=cl.tel||''; cur.cMail=cl.mail||''; cur.cType=cl.type==='Professionnel'?'Professionnel':'Particulier';
      cur.cAdr=cl.adr||''; cur.cVille=cl.ville||''; if(cl.siren) cur.cSiren=cl.siren;
      var known=(CLIENTS||[]).filter(function(c){return (c.nom||'').toLowerCase()===(cur.cNom||'').toLowerCase();})[0];
      if(known){ ['tel','mail','adr','ville'].forEach(function(k){ var ck='c'+k.charAt(0).toUpperCase()+k.slice(1); if(!cur[ck]) cur[ck]=known[k]||''; }); if(!cl.type&&known.type) cur.cType=known.type; if(known.lastZone&&!p.zone) cur.zone=known.lastZone; }
      if(Array.isArray(p.splits)&&p.splits.length){
        cur.splits=p.splits.map(function(s){
          var kw=+s.puiss||3.5; if(!inList(kw,SPLIT_POWERS)){ var near=SPLIT_POWERS.reduce(function(a,b){return Math.abs(b-kw)<Math.abs(a-kw)?b:a;}); warn.push('Puissance '+kw+' kW ramenée à '+near+' kW'); kw=near; }
          return {puiss:kw, long:+s.long||0, liaison:(s.liaison&&inList(s.liaison,cat.liaisons))?s.liaison:liaisonForPower(kw), cableInter:(s.cable&&inList(s.cable,SPLIT_CABLES))?s.cable:'Câble 5G1,5'};
        });
        cur.nbSplit=cur.splits.length;
      } else if(cur.splits){ while(cur.splits.length<cur.nbSplit) cur.splits.push({puiss:3.5,liaison:'Liaison 1/4 - 3/8',long:5,cableInter:'Câble 5G1,5'}); cur.splits=cur.splits.slice(0,cur.nbSplit); }
      if(Array.isArray(p.machines)&&p.machines.length){
        cur.machines=p.machines.map(function(m){
          var lib=(MACHLIB||[]).filter(function(l){return l.marque&&m.marque&&l.marque.toLowerCase()===String(m.marque).toLowerCase()&&(!m.ref||l.ref===m.ref);})[0];
          var achat=+m.achat||(lib?+lib.achat:0);
          if(!achat) warn.push('Prix d\'achat machine '+(m.marque||'')+' '+(m.ref||'')+' à saisir');
          return {marque:m.marque||(lib&&lib.marque)||'', ref:m.ref||(lib&&lib.ref)||'', achat:achat, marge:+m.marge||(lib&&lib.marge)||35};
        });
        cur.nbMach=cur.machines.length;
      } else { while(cur.machines.length<cur.nbMach) cur.machines.push({marque:'',ref:'',achat:0,marge:35}); warn.push('Machine et prix d\'achat à saisir'); }
      if(Array.isArray(p.goulottes)) cur.goulottes=p.goulottes.map(function(g){ if(!inList(g.type,cat.goulottes)) warn.push('Goulotte « '+g.type+' » non reconnue'); return {type:inList(g.type,cat.goulottes)?g.type:'Aucune',long:+g.long||0}; });
      if(p.condLong!=null) cur.condLong=+p.condLong||0;
      if(p.groupLong!=null) cur.groupLong=+p.groupLong||0;
      if(p.support){ if(inList(p.support,cat.supports)) cur.support=p.support; else warn.push('Support « '+p.support+' » non reconnu'); }
      if(p.pompe){ if(inList(p.pompe,cat.pompes)){ cur.pompeType=p.pompe; cur.pompeQte=+p.pompeQte||1; } else warn.push('Pompe « '+p.pompe+' » non reconnue'); }
      if(p.zone&&inList(p.zone,cat.zones)) cur.zone=p.zone;
      if(p.acces&&cat.acces[p.acces]) cur.acces=p.acces;
      if(p.tests&&cat.tests[p.tests]) cur.tests=p.tests;
      if(p.heures) cur.heures=+p.heures;
      if(Array.isArray(p.extras)) cur.extras=p.extras.filter(function(e){ var ok=!!findPrix(e.nom); if(!ok) warn.push('Article « '+e.nom+' » absent de la base de prix'); return ok; }).map(function(e){return {nom:e.nom,qte:+e.qte||1};});
      var notes=[]; if(p.notes) notes.push(p.notes);
      if(x.dictee) notes.push('— Dictée d\'origine : « '+x.dictee+' »');
      cur.notes=notes.join('\n');
      cur._inboxId=x.id;
      loadDevisToForm(); try{ recalc(); }catch(e){}
      showBanner('wizard', x, warn);
    }catch(e){ toastX('⚠ Pré-remplissage incomplet : '+(e.message||e),'warn'); }
  };

  /* --- intervention proposée → fiche pré-remplie --- */
  window.nxaOpenInter = function(id){
    var x=findRow(id); if(!x) return;
    var p=x.payload||{}, warn=[].concat(p.a_verifier||[]);
    try{
      newDep(p.itype==='mes'?'mes':'dep');
      var d=curDep, cl=p.client||{};
      d.cNom=cl.nom||''; d.cTel=cl.tel||''; d.cMail=cl.mail||''; d.cType=cl.type==='Professionnel'?'Professionnel':'Particulier'; d.cAdr=cl.adr||''; d.cVille=cl.ville||'';
      var known=(CLIENTS||[]).filter(function(c){return (c.nom||'').toLowerCase()===(d.cNom||'').toLowerCase();})[0];
      if(known){ d.cTel=d.cTel||known.tel||''; d.cMail=d.cMail||known.mail||''; d.cAdr=d.cAdr||known.adr||''; d.cVille=d.cVille||known.ville||''; if(!cl.type&&known.type) d.cType=known.type; }
      if(p.date) d.date=String(p.date).slice(0,10);
      d.desc=p.desc||d.desc;
      if(p.panne){ if(P.depPannes&&P.depPannes[p.panne]!=null) d.panne=p.panne; else warn.push('Type de panne « '+p.panne+' » à choisir'); }
      if(p.heures) d.heures=+p.heures;
      if(p.zone&&P.zone[p.zone]!=null) d.zone=p.zone;
      if(Array.isArray(p.pieces)) d.pieces=p.pieces.map(function(pc){ var f=findPrix(pc.nom); if(!f&&!pc.achat) warn.push('Prix de la pièce « '+pc.nom+' » à saisir'); return {nom:pc.nom||'',qte:+pc.qte||1,achat:+pc.achat||(f?f.achat:0)||0,vente:+pc.vente||(f?venteOf(pc.nom,f.marge):0)||0}; });
      var notes=[]; if(p.notes) notes.push(p.notes);
      if(p.fluide) notes.push('Fluide : '+[p.fluide.nom, p.fluide.charge?('chargé '+p.fluide.charge+' kg'):'', p.fluide.recupere?('récupéré '+p.fluide.recupere+' kg'):''].filter(Boolean).join(' · ')+' → pense à la fiche fluide (Cerfa).');
      if(x.dictee) notes.push('— Dictée d\'origine : « '+x.dictee+' »');
      d.notes=notes.join('\n');
      d._inboxId=x.id;
      loadDepForm(); try{ recalcDep(); }catch(e){}
      showBanner('depform', x, warn);
    }catch(e){ toastX('⚠ Pré-remplissage incomplet : '+(e.message||e),'warn'); }
  };

  /* bandeau « à vérifier » au-dessus du formulaire pré-rempli */
  function showBanner(view, x, warn){
    var host=document.getElementById('v-'+view); if(!host) return;
    var old=document.getElementById('nxaBanner'); if(old) old.remove();
    var div=document.createElement('div'); div.id='nxaBanner'; div.className='nxa-banner';
    div.innerHTML='<b>🤖 Pré-rempli par l\'assistant</b> — vérifie, complète, puis <b>enregistre</b> pour valider.'+
      (warn.length?'<ul>'+uniqS(warn).map(function(w){return '<li>'+esc(w)+'</li>';}).join('')+'</ul>':'')+
      '<div class="nxa-sub">Les prix sont calculés par ClimPilot à partir de ta base, pas par l\'IA.</div>'+
      '<button class="nxa-x" onclick="this.parentNode.remove()">✕</button>';
    host.insertBefore(div, host.firstChild);
  }
  function uniqS(a){ return uniq(a.map(String)); }

  /* la proposition est soldée quand Gabriel enregistre */
  function wrapSave(name, getObj, getList){
    if(typeof window[name]!=='function') return;
    var orig=window[name];
    window[name]=function(){
      var o=getObj(), id=o&&o._inboxId, oid=o&&o.id;
      var r=orig.apply(this,arguments);
      try{
        var o2=getObj(), list=getList()||[];
        var saved=list.some(function(z){ return z && z.id===oid; });
        if(id && saved && (!o2 || o2._inboxId===id)){
          list.forEach(function(z){ if(z && z.id===oid) delete z._inboxId; }); mark(id,'valide').then(fetchInbox); if(o2) delete o2._inboxId; var b=document.getElementById('nxaBanner'); if(b) b.remove(); toastX('✅ Proposition de l\'assistant validée','ok'); }
      }catch(e){}
      return r;
    };
  }

  /* --- message client --- */
  window.nxaMsg = function(id, how){
    var x=findRow(id); if(!x) return;
    var p=x.payload||{}, ta=document.getElementById('nxaMsg_'+id), body=ta?ta.value:(p.corps||'');
    var subj=p.objet||'';
    if(how==='copy'){ try{ navigator.clipboard.writeText((subj?subj+'\n\n':'')+body); toastX('📋 Copié','ok'); }catch(e){ toastX('Copie impossible','warn'); } return; }
    if(how==='mail'){ location.href='mailto:'+encodeURIComponent(p.email||'')+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body); }
    if(how==='sms'){ location.href='sms:'+encodeURIComponent(p.tel||'')+(/iPhone|iPad/.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(body); }
    mark(id,'valide').then(fetchInbox);
  };
  window.nxaDone = function(id){ mark(id,'valide').then(fetchInbox); };

  /* ---------- 6. Rendu ---------- */
  function card(x){
    var p=x.payload||{}, k=x.kind||'autre';
    var todo=(p.a_verifier||[]).length?'<ul class="nxa-warn">'+p.a_verifier.map(function(w){return '<li>'+esc(w)+'</li>';}).join('')+'</ul>':'';
    var act='';
    if(k==='devis') act='<button class="nx-sbtn mar" onclick="nxaOpenDevis(\''+x.id+'\')">Ouvrir le devis pré-rempli</button>';
    else if(k==='intervention') act='<button class="nx-sbtn mar" onclick="nxaOpenInter(\''+x.id+'\')">Ouvrir la fiche pré-remplie</button>';
    else if(k==='message'){
      act='<div class="nxa-msg">'+(p.objet?'<div class="nxa-sub"><b>Objet :</b> '+esc(p.objet)+'</div>':'')+
        '<textarea id="nxaMsg_'+x.id+'" rows="7">'+esc(p.corps||'')+'</textarea>'+
        '<div class="nxa-sub">À : '+esc([p.destinataire,p.email,p.tel].filter(Boolean).join(' · ')||'—')+'</div></div>'+
        (p.email||p.canal==='mail'?'<button class="nx-sbtn mar" onclick="nxaMsg(\''+x.id+'\',\'mail\')">✉ Ouvrir dans Mail</button>':'')+
        (p.tel||p.canal==='sms'?'<button class="nx-sbtn mar" onclick="nxaMsg(\''+x.id+'\',\'sms\')">💬 SMS</button>':'')+
        '<button class="nx-sbtn" onclick="nxaMsg(\''+x.id+'\',\'copy\')">Copier</button>';
    }
    else act='<button class="nx-sbtn acc" onclick="nxaDone(\''+x.id+'\')">OK, traité</button>';
    return '<div class="nxa-card k-'+esc(k)+'">'+
      '<div class="nxa-h"><span class="nxa-ico">'+(ICO[k]||'💡')+'</span><div style="flex:1;min-width:0"><b>'+esc(x.titre||LBL[k]||'Proposition')+'</b>'+
      '<div class="nxa-sub">'+esc(LBL[k]||k)+' · '+esc(fmtWhen(x.created_at))+'</div></div></div>'+
      (x.resume?'<div class="nxa-body">'+esc(x.resume).replace(/\n/g,'<br>')+'</div>':'')+todo+
      (x.dictee?'<details class="nxa-dict"><summary>Ce que tu as dit</summary>« '+esc(x.dictee)+' »</details>':'')+
      '<div class="nxa-act">'+act+'<button class="nx-sbtn ref" onclick="nxaReject(\''+x.id+'\')">Écarter</button></div></div>';
  }
  function renderAssist(){
    var host=document.getElementById('nxAssist'); if(!host) return;
    var st='';
    if(STATE==='offline') st='<div class="nxa-state">☁ Pas connecté au cloud — la note rapide marche, mais les propositions de l\'assistant n\'arrivent qu\'une fois connecté.</div>';
    else if(STATE==='notable') st='<div class="nxa-state warn">La boîte de réception n\'est pas encore créée dans Supabase (étape d\'installation à faire une fois).</div>';
    else if(STATE==='error') st='<div class="nxa-state warn">⚠ Boîte de réception injoignable : '+esc(LAST_ERR)+' <button class="nx-sbtn" onclick="nxaRefresh()">Réessayer</button></div>';
    var html=
      '<div class="nxa-quick card"><h2>🎙️ Note rapide</h2>'+
        '<div class="nxa-sub" style="margin-bottom:8px">Dicte ce qui te passe par la tête : « rappeler Jean-Claude demain à 18h pour la livraison ». Ça part direct dans « À faire », avec la date.</div>'+
        '<div class="nxa-row"><textarea id="nxaQuick" rows="2" placeholder="Touche ici puis le 🎙️ du clavier…" oninput="nxaQuickPreview()"></textarea>'+
        '<button id="nxaMicBtn" class="nxa-mic" title="Dicter" onclick="nxaMic()">🎙️</button></div>'+
        '<div id="nxaQuickPv" class="nxa-pv"></div>'+
        '<div class="nxa-act"><button class="btn-pri" onclick="nxaQuickSave()">Enregistrer la note</button></div></div>'+
      st+
      '<div class="card"><div class="nxa-hd"><h2 style="margin:0">📥 À valider</h2><button class="nx-sbtn" onclick="nxaRefresh()">↻ Actualiser</button></div>'+
        '<div class="nxa-sub" style="margin:2px 0 6px">Proposé par ton assistant — rien n\'est créé ni envoyé sans toi.</div>'+
        (ROWS.length?ROWS.map(card).join(''):'<div class="empty">Rien à valider. Parle à ton assistant dans l\'app Claude (projet « Gabriel Leroy — Froid & Clim ») : devis, dépannages, messages clients… ses propositions arrivent ici.</div>')+
      '</div>'+
      (RECENT.length?'<div class="card"><h2>🕘 Traité ces 7 derniers jours</h2>'+RECENT.slice(0,25).map(function(x){
        var s=x.statut==='rejete'?'écarté':(x.kind==='rdv'?'dans Google Agenda':(x.kind==='note'||x.kind==='tache'?'ajouté à « À faire »':'validé'));
        return '<div class="recap-line"><div style="min-width:0">'+(ICO[x.kind]||'💡')+' '+esc(x.titre||LBL[x.kind]||'')+'<div class="sub2">'+esc(fmtWhen(x.created_at))+'</div></div><span class="nxa-chip '+(x.statut==='rejete'?'mute':'')+'">'+s+'</span></div>';
      }).join('')+'</div>':'');
    host.innerHTML=html;
  }
  window.nxaRender = renderAssist;

  function setBadge(){
    var el=document.getElementById('nxaBadge'); if(!el) return;
    var n=ROWS.length; el.textContent=n; el.style.display=n>0?'':'none';
  }

  /* ---------- 7. Styles ---------- */
  var CSS=
  '.nxa-card{border:1px solid var(--line,#e3e8ef);border-left:4px solid #1f4e79;border-radius:12px;padding:12px 14px;margin:10px 0;background:#fff}'+
  '.nxa-card.k-message{border-left-color:#0d6e7c}.nxa-card.k-intervention{border-left-color:#c77700}'+
  '.nxa-hd{display:flex;justify-content:space-between;align-items:center;gap:10px}.nxa-h{display:flex;gap:10px;align-items:flex-start}.nxa-ico{font-size:20px;line-height:1.2}'+
  '.nxa-sub{font-size:12px;color:var(--muted,#6b7a90)}.nxa-body{margin:8px 0 4px;font-size:13.5px;line-height:1.45}'+
  '.nxa-warn{margin:6px 0;padding:8px 10px 8px 26px;background:#fff6e5;border-radius:8px;font-size:12.5px;color:#7a4b00}'+
  '.nxa-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}'+
  '.nxa-msg{width:100%}.nxa-msg textarea{width:100%;box-sizing:border-box;border:1px solid var(--line2,#cfd8e3);border-radius:10px;padding:10px;font:inherit;font-size:13.5px;line-height:1.45;margin:6px 0}'+
  '.nxa-dict{font-size:12px;color:var(--muted,#6b7a90);margin-top:6px}.nxa-dict summary{cursor:pointer}'+
  '.nxa-row{display:flex;gap:8px;align-items:stretch}.nxa-row textarea{flex:1;border:2px solid var(--line2,#cfd8e3);border-radius:10px;padding:10px;font:inherit;font-size:15px;min-height:52px}'+
  '.nxa-mic{border:none;border-radius:12px;background:#1f4e79;color:#fff;font-size:22px;width:56px;cursor:pointer}.nxa-mic.on{background:#c0392b;animation:nxaP 1s infinite}'+
  '@keyframes nxaP{50%{opacity:.6}}'+
  '.nxa-pv{margin-top:6px;min-height:22px}.nxa-chip{display:inline-block;font-size:11.5px;padding:3px 9px;border-radius:20px;background:#e8eef6;color:#1f4e79;margin:2px 4px 2px 0;white-space:nowrap}'+
  '.nxa-chip.mute{background:#f0f2f5;color:#8a96a8}.nxa-chip.hot{background:#fde2df;color:#b03a2e}'+
  '.nxa-state{padding:10px 14px;border-radius:10px;background:#eef3f9;margin:10px 0;font-size:13px}.nxa-state.warn{background:#fff6e5;color:#7a4b00}'+
  '.nxa-banner{position:relative;background:#eef3f9;border:1px solid #c9d8ea;border-left:4px solid #1f4e79;border-radius:10px;padding:10px 38px 10px 14px;margin:0 0 12px;font-size:13px}'+
  '.nxa-banner ul{margin:6px 0 4px;padding-left:20px;color:#7a4b00}.nxa-x{position:absolute;top:6px;right:8px;border:none;background:none;font-size:15px;cursor:pointer;color:#6b7a90}'+
  '.nxa-fab{position:fixed;right:18px;bottom:18px;z-index:9000;border:none;border-radius:28px;background:#1f4e79;color:#fff;font-weight:700;font-size:14px;padding:13px 18px;box-shadow:0 6px 20px rgba(15,35,65,.35);cursor:pointer}'+
  '@media print{.nxa-fab{display:none!important}}';

  /* ---------- 8. Démarrage ---------- */
  function boot(tries){
    tries=tries||0;
    try{
      var nav=document.getElementById('nav');
      if(!nav){ if(tries<40) setTimeout(function(){boot(tries+1);},150); return; }
      if(!nav.querySelector('.nx-nav-section') && tries<20){ setTimeout(function(){boot(tries+1);},150); return; }
      if(!document.getElementById('nxaStyle')){ var st=document.createElement('style'); st.id='nxaStyle'; st.textContent=CSS; document.head.appendChild(st); }
      if(typeof TITLES!=='undefined') TITLES.nx_assist=['Assistant','Tes notes dictées et les propositions de ton assistant IA — à valider en un clic.'];
      if(!nav.querySelector('a[data-v="nx_assist"]')){
        var host=nav.querySelector('.nx-nav-section[data-section="home"] .nx-nav-body')||nav;
        var a=document.createElement('a'); a.setAttribute('data-v','nx_assist');
        a.innerHTML='<span class="ico">🤖</span><span class="txt">Assistant</span><span class="badge" id="nxaBadge" style="display:none">0</span>';
        host.insertBefore(a, host.firstChild);
      }
      if(!document.getElementById('v-nx_assist')){
        var dash=document.getElementById('v-dash'), parent=dash?dash.parentNode:document.querySelector('.content');
        if(parent){ var sec=document.createElement('section'); sec.className='view'; sec.id='v-nx_assist'; sec.innerHTML='<div id="nxAssist"></div>'; parent.appendChild(sec); }
      }
      if(!document.getElementById('nxaFab')){
        var b=document.createElement('button'); b.id='nxaFab'; b.className='nxa-fab'; b.innerHTML='🎙️ Note';
        b.onclick=function(){ go('nx_assist'); setTimeout(function(){ var t=document.getElementById('nxaQuick'); if(t) t.focus(); },120); };
        document.body.appendChild(b);
      }
      var _go=window.go;
      window.go=function(v){
        var r=_go.apply(this,arguments);
        try{
          if(v==='nx_assist'){ renderAssist(); fetchInbox();
            document.querySelectorAll('.nx-nav-section').forEach(function(s){ var open=s.dataset.section==='home'; s.classList.toggle('open',open); var t=s.querySelector(':scope > .nx-nav-toggle'); if(t) t.setAttribute('aria-expanded',open?'true':'false'); });
          }
          var fab=document.getElementById('nxaFab'); if(fab) fab.style.display=(v==='nx_assist'||v==='wizard'||v==='depform')?'none':'';
        }catch(e){}
        return r;
      };
      wrapSave('saveDevis', function(){ try{ return cur; }catch(e){ return null; } }, function(){ try{ return DEVIS; }catch(e){ return []; } });
      wrapSave('saveDep', function(){ try{ return curDep; }catch(e){ return null; } }, function(){ try{ return DEP; }catch(e){ return []; } });
      publishCatalog();
      /* attend la session cloud puis relève la boîte ; ensuite toutes les 2 min + au retour sur l'appli */
      var w=0, iv=setInterval(function(){ w++; if(cloudOk()||w>30){ clearInterval(iv); fetchInbox(); publishCatalog(); } },1000);
      setInterval(function(){ if(document.visibilityState==='visible') fetchInbox(); }, 120000);
      document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') fetchInbox(); });
    }catch(e){ try{ console.error('ClimPilot next-assistant', e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);
})();
