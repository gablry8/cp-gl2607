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
  var ICO = {note:'📝',tache:'✅',rdv:'📅',devis:'📄',intervention:'🔧',message:'✉️',machine:'❄️',client:'👤',article:'🏷️',autre:'💡'};
  var LBL = {note:'Note',tache:'Tâche',rdv:'Rendez-vous',devis:'Devis',intervention:'Intervention',message:'Message client',machine:'Machine',client:'Client',article:'Article',autre:'Autre'};
  var DONE_LBL = {note:'ajouté à « À faire »',tache:'ajouté à « À faire »',machine:'ajoutée à la bibliothèque',client:'ajouté aux clients',article:'ajouté à la base de prix'};

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
    if(!String(o.title||'').trim()) return false;
    try{
      var before=lsGet('cpnext_tasks',[]).length;
      window.nxOpenTaskModal();
      var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
      set('nxTaskTitle', o.title||'');
      set('nxTaskDue', o.due||'');
      set('nxTaskPriority', ['high','medium','low'].indexOf(o.priority)>=0?o.priority:'medium');
      var catEl=document.getElementById('nxTaskCat');
      if(catEl){ var ok=[].some.call(catEl.options,function(op){return op.value===o.cat;}); catEl.value=ok?o.cat:'Autre'; }
      set('nxTaskLink', o.link||'');
      window.nxSaveTask();
      return lsGet('cpnext_tasks',[]).length>before; /* vérifié : la tâche est bien enregistrée */
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

  /* Texte venant de l'IA ou d'un e-mail : on retire tout balisage HTML avant de l'injecter dans l'appli */
  function cleanDeep(v){
    if(typeof v==='string') return v.replace(/[<>]/g,'').replace(/javascript:/gi,'').slice(0,5000);
    if(Array.isArray(v)) return v.slice(0,50).map(cleanDeep);
    if(v&&typeof v==='object'){ var o={}; Object.keys(v).slice(0,60).forEach(function(k){ o[k]=cleanDeep(v[k]); }); return o; }
    return v;
  }
  window.nxaClean = cleanDeep;
  /* Réservation atomique : un seul appareil importe un élément ; s'il échoue, l'élément est remis en file */
  function claim(id){
    if(!cloudOk()) return Promise.resolve(false);
    return sb.from(TABLE).update({statut:'valide',traite_at:new Date().toISOString()}).eq('id',id).eq('statut','auto').select('id')
      .then(function(r){ return !!(r && !r.error && r.data && r.data.length); }).catch(function(){ return false; });
  }
  function release(id){ if(!cloudOk()) return Promise.resolve(); return sb.from(TABLE).update({statut:'auto',traite_at:null}).eq('id',id).then(function(){}).catch(function(){}); }
  function applyAuto(x){
    var p=cleanDeep(x.payload||{});
    if(x.kind==='note'||x.kind==='tache'){
      var o=parseNote(p.texte||x.titre||'');
      if(p.echeance) o.due=String(p.echeance).slice(0,10);
      if(p.priorite) o.priority=p.priorite;
      if(p.categorie) o.cat=p.categorie;
      o.title=cleanDeep(x.titre||'')||o.title; o.link='Assistant IA';
      if(p.heure && !/\d\s*h/i.test(o.title)) o.title=String(p.heure).replace(':','h')+' — '+o.title;
      if(!String(o.title||'').trim()) return 'invalide';
      return addTask(o);
    }
    if(x.kind==='machine') return applyMachine(p);
    if(x.kind==='client') return applyClient(p);
    if(x.kind==='article') return applyArticle(p);
    return true; /* rdv déjà dans l'agenda, autre : simple trace */
  }
  function autoImport(rows){
    var done=lsGet(DONE_KEY,[]), chain=Promise.resolve(), imported=[];
    rows.forEach(function(x){
      chain=chain.then(function(){
        return claim(x.id).then(function(got){
          if(!got) return;                                   /* déjà pris par un autre appareil */
          if(done.indexOf(x.id)>=0){ imported.push(x); return; } /* déjà appliqué ici (reprise) */
          var res=false; try{ res=applyAuto(x); }catch(e){ res=false; }
          if(res==='invalide'){ return mark(x.id,'rejete'); }  /* contenu vide : écarté, pas de boucle */
          var okApply=res!==false;
          if(okApply){ done.push(x.id); x.statut='valide'; x.traite_at=new Date().toISOString(); imported.push(x); }
          else return release(x.id);                         /* échec : on remet en file, rien n'est perdu */
        });
      });
    });
    return chain.then(function(){ if(imported.length){ lsSet(DONE_KEY,done.slice(-500)); RECENT=imported.concat(RECENT); } });
  }

  /* --- enregistrements automatiques (données internes, pas client) --- */
  function applyMachine(p){
    try{
      if(!p.marque && !p.ref) return false;
      var m={marque:String(p.marque||'').trim(), ref:String(p.ref||'').trim()+(p.puissance_kw&&String(p.ref||'').indexOf('kW')<0?' ('+p.puissance_kw+' kW)':''), achat:+p.achat||0, marge:+p.marge||35};
      var j=MACHLIB.findIndex(function(z){ return (z.marque||'').toLowerCase()===m.marque.toLowerCase() && (z.ref||'').toLowerCase()===m.ref.toLowerCase(); });
      if(j>=0){ if(!m.achat) m.achat=MACHLIB[j].achat; MACHLIB[j]=Object.assign({},MACHLIB[j],m); } else MACHLIB.push(m);
      save(LS.machlib,MACHLIB); toastX('❄️ Machine enregistrée : '+(m.marque+' '+m.ref).trim(),'ok'); return true;
    }catch(e){ return false; }
  }
  function applyClient(p){
    try{
      var nom=String(p.nom||'').trim(); if(!nom) return false;
      var i=CLIENTS.findIndex(function(c){ return (c.nom||'').toLowerCase()===nom.toLowerCase(); });
      var c=i>=0?CLIENTS[i]:{id:uid(),nom:nom,tel:'',mail:'',type:'Particulier',adr:'',ville:'',notes:''};
      ['tel','mail','adr','ville','siren'].forEach(function(k){ if(p[k]) c[k]=String(p[k]); });
      if(p.type==='Professionnel'||p.type==='Particulier') c.type=p.type;
      if(p.notes) c.notes=(c.notes?c.notes+'\n':'')+p.notes;
      if(i<0) CLIENTS.push(c);
      save(LS.clients,CLIENTS); toastX('👤 Client '+(i<0?'ajouté':'mis à jour')+' : '+nom,'ok'); return true;
    }catch(e){ return false; }
  }
  function applyArticle(p){
    try{
      var nom=String(p.nom||'').trim(); if(!nom) return false;
      var customs=load(LS.custom,[]);
      var o={id:uid(),nom:nom,cat:p.cat||'Divers',unite:p.unite||'unité',achat:+p.achat||0,marge:+p.marge||35,verif:true,src:'local'};
      var i=customs.findIndex(function(z){ return z.nom===nom; });
      if(i>=0) customs[i]=Object.assign({},customs[i],o,{id:customs[i].id}); else customs.push(o);
      save(LS.custom,customs); try{ rebuildPrix(); }catch(e){}
      toastX('🏷️ Article enregistré : '+nom,'ok'); return true;
    }catch(e){ return false; }
  }
  window.nxaApply = {machine:applyMachine, client:applyClient, article:applyArticle};

  /* --- rendez-vous → Google Agenda (lien pré-rempli) --- */
  function gcalUrl(x){
    var p=x.payload||{}, date=String(p.date||'').slice(0,10), h=String(p.heure||'09:00').slice(0,5);
    var st=new Date(date+'T'+h+':00'); if(isNaN(st)) st=new Date();
    var en=new Date(st.getTime()+(+p.duree_min||60)*60000);
    var f=function(d){ return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'T'+pad(d.getHours())+pad(d.getMinutes())+'00'; };
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(x.titre||'Rendez-vous')+
      '&dates='+f(st)+'/'+f(en)+'&ctz=Europe/Paris'+(p.lieu?'&location='+encodeURIComponent(p.lieu):'')+
      '&details='+encodeURIComponent((p.description||x.resume||'')+'\n— ajouté depuis ClimPilot');
  }
  window.nxaGcalUrl = gcalUrl;
  window.nxaGcal = function(id){
    var x=findRow(id); if(!x) return;
    try{ window.open(gcalUrl(x),'_blank'); }catch(e){}
    mark(id,'valide').then(fetchInbox);
  };

  window.nxaReject = function(id){
    if(!confirm('Écarter cette proposition ?')) return;
    mark(id,'rejete').then(fetchInbox);
  };

  /* --- devis proposé → formulaire pré-rempli (validation = enregistrement) --- */
  function findRow(id){ return ROWS.filter(function(x){return x.id===id;})[0]; }
  function inList(v,list){ return list.indexOf(v)>=0; }
  window.nxaOpenDevis = function(id){
    var x=findRow(id); if(!x) return;
    var p=cleanDeep(x.payload||{}), warn=[].concat(p.a_verifier||[]);
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
      if(x.dictee) notes.push('— Dictée d\'origine : « '+cleanDeep(x.dictee)+' »');
      cur.notes=notes.join('\n');
      cur._inboxId=x.id;
      loadDevisToForm(); try{ recalc(); }catch(e){}
      showBanner('wizard', x, warn);
    }catch(e){ toastX('⚠ Pré-remplissage incomplet : '+(e.message||e),'warn'); }
  };

  /* --- intervention proposée → fiche pré-remplie --- */
  window.nxaOpenInter = function(id){
    var x=findRow(id); if(!x) return;
    var p=cleanDeep(x.payload||{}), warn=[].concat(p.a_verifier||[]);
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
      if(p.fluide && (p.fluide.nom||p.fluide.charge||p.fluide.recupere)) d._fluide=p.fluide; /* → fiche Cerfa pré-remplie à l'enregistrement */
      if(p.fluide) notes.push('Fluide : '+[p.fluide.nom, p.fluide.charge?('chargé '+p.fluide.charge+' kg'):'', p.fluide.recupere?('récupéré '+p.fluide.recupere+' kg'):''].filter(Boolean).join(' · ')+' → pense à la fiche fluide (Cerfa).');
      if(x.dictee) notes.push('— Dictée d\'origine : « '+cleanDeep(x.dictee)+' »');
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

  /* validation d'une proposition depuis le devis au nouveau format (next-devis2.js) */
  window.nxaInboxValidated = function(id){ try{ mark(id,'valide').then(fetchInbox); var b=document.getElementById('nxaBanner'); if(b) b.remove(); toastX('✅ Proposition de l\'assistant validée','ok'); }catch(e){} };

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
    else if(k==='rdv'){ var pr=x.payload||{}; act='<div class="nxa-sub" style="width:100%">📅 '+esc(pr.date?new Date(String(pr.date).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}):'date ?')+(pr.heure?' à '+esc(String(pr.heure).replace(':','h')):'')+(pr.lieu?' · '+esc(pr.lieu):'')+'</div><button class="nx-sbtn mar" onclick="nxaGcal(\''+x.id+'\')">📅 Ajouter à Google Agenda</button>'; }
    else act='<button class="nx-sbtn acc" onclick="nxaDone(\''+x.id+'\')">OK, traité</button>';
    return '<div class="nxa-card k-'+esc(k)+'">'+
      '<div class="nxa-h"><span class="nxa-ico">'+(ICO[k]||'💡')+'</span><div style="flex:1;min-width:0"><b>'+esc(x.titre||LBL[k]||'Proposition')+'</b>'+
      '<div class="nxa-sub">'+esc(LBL[k]||k)+' · '+esc(fmtWhen(x.created_at))+'</div></div></div>'+
      (x.resume?'<div class="nxa-body">'+esc(x.resume).replace(/\n/g,'<br>')+'</div>':'')+todo+
      (x.dictee?'<details class="nxa-dict"><summary>Ce que tu as dit</summary>« '+esc(x.dictee)+' »</details>':'')+
      '<div class="nxa-act">'+act+'<button class="nx-sbtn ref" onclick="nxaReject(\''+x.id+'\')">Écarter</button></div></div>';
  }
  /* ---------- Conversation avec l'assistant IA (fonction serveur) ---------- */
  var THREAD=[], DISPLAY=[], BUSY=false, BUDGET=null;
  function nowInfo(){ var d=new Date(); return {jour:d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}), date:dISO(d), heure:pad(d.getHours())+':'+pad(d.getMinutes())}; }
  function callAssistant(body){
    if(!cloudOk()) return Promise.resolve({erreur:'hors_ligne',message:'Pas connecté au cloud — connecte-toi pour parler à l\'assistant.'});
    return sb.functions.invoke('assistant',{body:body}).then(function(r){
      if(r && r.error){
        var ctx=r.error.context;
        if(ctx && typeof ctx.json==='function') return ctx.json().catch(function(){ return {erreur:'http',message:r.error.message||'Erreur'}; });
        return {erreur:'reseau',message:'Assistant injoignable — vérifie ta connexion.'};
      }
      return r.data||{erreur:'vide',message:'Réponse vide'};
    }).catch(function(e){ return {erreur:'reseau',message:'Assistant injoignable — vérifie ta connexion.'}; });
  }
  function setBudget(b){ if(b&&b.plafond_eur!=null) BUDGET=b; var el=document.getElementById('nxaBudget'); if(!el) return;
    if(BUDGET==='off'){ el.textContent='IA non activée'; el.className='nxa-chip mute'; return; }
    if(!BUDGET){ el.textContent=''; return; }
    var r=BUDGET.depense_eur/BUDGET.plafond_eur; el.textContent='IA ce mois : '+String(BUDGET.depense_eur.toFixed(2)).replace('.',',')+' € / '+String(BUDGET.plafond_eur.toFixed(2)).replace('.',',')+' €';
    el.className='nxa-chip'+(r>0.8?' hot':''); }
  function refreshBudget(){ if(!cloudOk()) return; callAssistant({etat:true}).then(function(r){ if(r&&r.type==='etat') setBudget(r); else if(r&&r.erreur==='cle_absente'){ BUDGET='off'; setBudget(); } }); }
  window.nxaRefreshBudget = refreshBudget;

  function renderThread(){
    var el=document.getElementById('nxaThread'); if(!el) return;
    var h=DISPLAY.map(function(m){
      var items=(m.items||[]).map(function(it){ return '<div class="nxa-it">'+(ICO[it.kind]||'💡')+' '+esc(it.titre||LBL[it.kind]||'')+' <span class="nxa-chip '+(it.statut==='a_valider'?'hot':'')+'">'+(it.statut==='a_valider'?'à valider ci-dessous':(DONE_LBL[it.kind]||'enregistré'))+'</span></div>'; }).join('');
      return '<div class="nxa-bub '+m.who+'">'+esc(m.text).replace(/\n/g,'<br>')+items+(m.retry?'<div class="nxa-act"><button class="nx-sbtn" onclick="nxaQuickSave()">📝 Garder en note simple</button></div>':'')+'</div>';
    }).join('');
    if(BUSY) h+='<div class="nxa-bub ia nxa-typing"><span></span><span></span><span></span></div>';
    el.innerHTML=h; el.style.display=h?'':'none';
    var nb=document.getElementById('nxaNewBtn'); if(nb) nb.style.display=DISPLAY.length?'':'none';
    var sb2=document.getElementById('nxaSendBtn'); if(sb2){ sb2.disabled=BUSY; sb2.textContent=BUSY?'…':(THREAD.length?'➤ Répondre':'➤ Envoyer à l\'assistant'); }
    try{ el.scrollTop=el.scrollHeight; }catch(e){}
  }
  window.nxaNewConv = function(){ THREAD=[]; DISPLAY=[]; renderThread(); };
  window.nxaSend = function(){
    if(BUSY) return;
    var ta=document.getElementById('nxaQuick'); if(!ta) return;
    var v=ta.value.trim(); if(!v){ toastX('Dicte ou écris ta demande d\'abord','warn'); return; }
    THREAD.push({role:'user',content:v}); DISPLAY.push({who:'me',text:v});
    ta.value=''; quickPreview(); BUSY=true; renderThread();
    callAssistant({messages:THREAD, now:nowInfo()}).then(function(r){
      BUSY=false;
      if(!r || r.erreur){
        THREAD.pop(); ta.value=v; quickPreview();
        var msg=(r&&r.message)||'Erreur inattendue';
        if(r&&r.erreur==='cle_absente'){ msg='L\'assistant IA n\'est pas encore activé (clé API Claude à installer). Ta demande est remise dans le champ : tu peux la garder en note simple.'; BUDGET='off'; setBudget(); }
        DISPLAY.push({who:'sys',text:'⚠ '+msg,retry:true});
      } else {
        if(r.budget) setBudget(r.budget);
        if(r.type==='question'){ THREAD.push({role:'assistant',content:r.texte}); DISPLAY.push({who:'ia',text:r.texte}); }
        else if(r.type==='reponse'){ THREAD.push({role:'assistant',content:r.texte}); DISPLAY.push({who:'ia',text:r.texte}); }
        else if(r.type==='depose'){ DISPLAY.push({who:'ia',text:r.texte,items:r.elements||[]}); THREAD=[]; fetchInbox(); }
        else DISPLAY.push({who:'sys',text:'Réponse inattendue.'});
      }
      renderThread();
    });
  };

  function renderAssist(){
    var host=document.getElementById('nxAssist'); if(!host) return;
    if(!document.getElementById('nxaTalk')){
      host.innerHTML=
      '<div class="nxa-quick card" id="nxaTalk"><div class="nxa-hd"><h2 style="margin:0">🎙️ Parle à ton assistant</h2><span id="nxaBudget" class="nxa-chip mute"></span></div>'+
        '<div class="nxa-sub" style="margin:4px 0 8px">Devis, dépannage, note, rendez-vous, message client, nouvelle machine ou nouveau client… dicte comme tu parles. S\'il manque quelque chose, il te pose la question ; puis il prépare tout ici.</div>'+
        '<div id="nxaThread" class="nxa-thread" style="display:none"></div>'+
        '<div class="nxa-row"><textarea id="nxaQuick" rows="3" placeholder="Touche ici puis le 🎙️ du clavier…" oninput="nxaQuickPreview()" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\')nxaSend()"></textarea>'+
        '<button id="nxaMicBtn" class="nxa-mic" title="Dicter" onclick="nxaMic()">🎙️</button></div>'+
        '<div id="nxaQuickPv" class="nxa-pv"></div>'+
        '<div class="nxa-act"><button class="btn-pri" id="nxaSendBtn" onclick="nxaSend()">➤ Envoyer à l\'assistant</button>'+
        '<button class="nx-sbtn" onclick="nxaQuickSave()">📝 Note simple (sans IA)</button>'+
        '<button class="nx-sbtn" id="nxaNewBtn" onclick="nxaNewConv()" style="display:none">↺ Nouvelle demande</button></div></div>'+
      '<div id="nxaState"></div><div id="nxaLists"></div>';
      renderThread(); setBudget();
    }
    var st='';
    if(STATE==='offline') st='<div class="nxa-state">☁ Pas connecté au cloud — la note simple marche, mais l\'assistant et ses propositions demandent d\'être connecté.</div>';
    else if(STATE==='notable') st='<div class="nxa-state warn">La boîte de réception n\'est pas encore créée dans Supabase (étape d\'installation à faire une fois).</div>';
    else if(STATE==='error') st='<div class="nxa-state warn">⚠ Boîte de réception injoignable : '+esc(LAST_ERR)+' <button class="nx-sbtn" onclick="nxaRefresh()">Réessayer</button></div>';
    document.getElementById('nxaState').innerHTML=st;
    document.getElementById('nxaLists').innerHTML=
      '<div class="card"><div class="nxa-hd"><h2 style="margin:0">📥 À valider</h2><button class="nx-sbtn" onclick="nxaRefresh()">↻ Actualiser</button></div>'+
        '<div class="nxa-sub" style="margin:2px 0 6px">Proposé par ton assistant — rien n\'est créé ni envoyé sans toi.</div>'+
        (ROWS.length?ROWS.map(card).join(''):'<div class="empty">Rien à valider pour l\'instant. Dicte une demande ci-dessus, ou parle à l\'agent complet dans l\'app Claude (projet « Gabriel Leroy — Froid & Clim »).</div>')+
      '</div>'+
      (RECENT.length?'<div class="card"><h2>🕘 Traité ces 7 derniers jours</h2>'+RECENT.slice(0,25).map(function(x){
        var s=x.statut==='rejete'?'écarté':(x.kind==='rdv'?'dans l\'agenda':(DONE_LBL[x.kind]||'validé'));
        return '<div class="recap-line"><div style="min-width:0">'+(ICO[x.kind]||'💡')+' '+esc(x.titre||LBL[x.kind]||'')+'<div class="sub2">'+esc(fmtWhen(x.created_at))+'</div></div><span class="nxa-chip '+(x.statut==='rejete'?'mute':'')+'">'+s+'</span></div>';
      }).join('')+'</div>':'');
  }
  window.nxaRender = renderAssist;

  function setBadge(){
    var el=document.getElementById('nxaBadge'); if(!el) return;
    var n=ROWS.length; el.textContent=n; el.style.display=n>0?'':'none';
  }

  /* ---------- Sauvegardes cloud (table climpilot_backups, alimentée par le serveur) ---------- */
  var RAISON={quotidienne:'Automatique (quotidienne)',avant_grosse_modification:'🛡️ Avant une grosse modification',initiale:'Première sauvegarde',manuelle:'Manuelle',avant_restauration:'Avant une restauration'};
  function currentData(){ var o={}; try{ SYNC_KEYS.forEach(function(k){ var v=localStorage.getItem(k); if(v!=null){ try{ o[k]=JSON.parse(v); }catch(e){} } }); }catch(e){} return o; }
  function snapBackup(raison){
    if(!cloudOk()) return Promise.resolve({error:{message:'pas connecté'}});
    var d=currentData(), n=function(k){ return Array.isArray(d[k])?d[k].length:0; };
    return sb.from('climpilot_backups').insert({user_id:SESS.user.id,raison:raison,data:d,taille:JSON.stringify(d).length,nb_devis:n('cp2_devis'),nb_clients:n('cp2_clients'),nb_dep:n('cp2_dep'),nb_loc:n('cp2_loc')}).then(function(r){ return r; });
  }
  function renderBackups(){
    var host=document.getElementById('nxaBackups'); if(!host) return;
    if(!cloudOk()){ host.innerHTML='<div class="card"><h2>☁️ Sauvegardes cloud</h2><div class="nxa-sub">Connecte-toi au cloud pour voir tes sauvegardes automatiques.</div></div>'; return; }
    host.innerHTML='<div class="card"><h2>☁️ Sauvegardes cloud</h2><div class="nxa-sub">Chargement…</div></div>';
    sb.from('climpilot_backups').select('id,created_at,raison,taille,nb_devis,nb_clients,nb_dep,nb_loc').order('created_at',{ascending:false}).limit(60).then(function(r){
      var rows=(r&&r.data)||[];
      var h='<div class="card"><div class="nxa-hd"><h2 style="margin:0">☁️ Sauvegardes cloud automatiques</h2><button class="nx-sbtn mar" onclick="nxaBackupNow()">Sauvegarder maintenant</button></div>'+
        '<div class="nxa-sub" style="margin:4px 0 10px">Le serveur garde une copie <b>chaque jour</b> (45 jours, puis une par mois pendant 13 mois) et une copie <b>avant toute grosse perte</b> de données (appareil vide qui écraserait le cloud, suppression massive…). Une copie de secours part aussi chaque semaine sur ton Google Drive.</div>';
      if(r&&r.error) h+='<div class="nxa-state warn">⚠ '+esc(r.error.message)+'</div>';
      else if(!rows.length) h+='<div class="empty">Aucune sauvegarde pour l\'instant — la première arrive à la prochaine synchro.</div>';
      else h+=rows.map(function(b){ return '<div class="recap-line"><div style="min-width:0"><b>'+esc(fmtWhen(b.created_at))+'</b><div class="sub2">'+esc(RAISON[b.raison]||b.raison)+' · '+(b.nb_devis||0)+' devis · '+(b.nb_clients||0)+' clients · '+(b.nb_dep||0)+' interv. · '+(b.nb_loc||0)+' loc. · '+Math.max(1,Math.round((b.taille||0)/1024))+' Ko</div></div><button class="nx-sbtn" onclick="nxaRestore('+b.id+')">Restaurer</button></div>'; }).join('');
      host.innerHTML=h+'</div>';
    });
  }
  window.nxaRenderBackups = renderBackups;
  window.nxaBackupNow = function(){ snapBackup('manuelle').then(function(r){ if(r&&r.error) toastX('⚠ Sauvegarde impossible : '+r.error.message,'warn'); else toastX('☁️ Sauvegarde enregistrée','ok'); renderBackups(); }); };
  window.nxaRestore = function(id){
    if(!cloudOk()) return;
    sb.from('climpilot_backups').select('created_at,data,nb_devis,nb_clients').eq('id',id).maybeSingle().then(function(r){
      var b=r&&r.data; if(!b||!b.data){ toastX('Sauvegarde introuvable','warn'); return; }
      if(!confirm('Restaurer la sauvegarde du '+fmtWhen(b.created_at)+' ?\n('+(b.nb_devis||0)+' devis, '+(b.nb_clients||0)+' clients)\n\nL\'état actuel est d\'abord sauvegardé : tu pourras revenir en arrière.')) return;
      snapBackup('avant_restauration').then(function(r0){
        if(r0&&r0.error){ if(!confirm('La sauvegarde de sécurité a échoué ('+r0.error.message+'). Restaurer quand même ?')) return; }
        try{ SYNC_KEYS.forEach(function(k){ if(b.data[k]!==undefined) localStorage.setItem(k,JSON.stringify(b.data[k])); }); localStorage.setItem('cp2_dirty','1'); }catch(e){ toastX('⚠ Restauration impossible : '+e.message,'warn'); return; }
        Promise.resolve(typeof pushState==='function'?pushState(true,true):null).then(function(){ toastX('✅ Sauvegarde restaurée — rechargement…','ok'); setTimeout(function(){ location.reload(); },900); });
      });
    });
  };

  /* ---------- 7. Styles ---------- */
  var CSS=
  '.nxa-card{border:1px solid var(--line,#e3e8ef);border-left:4px solid #121417;border-radius:12px;padding:12px 14px;margin:10px 0;background:#fff}'+
  '.nxa-card.k-message{border-left-color:#0d6e7c}.nxa-card.k-intervention{border-left-color:#c77700}'+
  '.nxa-hd{display:flex;justify-content:space-between;align-items:center;gap:10px}.nxa-h{display:flex;gap:10px;align-items:flex-start}.nxa-ico{font-size:20px;line-height:1.2}'+
  '.nxa-sub{font-size:12px;color:var(--muted,#6b7a90)}.nxa-body{margin:8px 0 4px;font-size:13.5px;line-height:1.45}'+
  '.nxa-warn{margin:6px 0;padding:8px 10px 8px 26px;background:#fff6e5;border-radius:8px;font-size:12.5px;color:#7a4b00}'+
  '.nxa-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}'+
  '.nxa-msg{width:100%}.nxa-msg textarea{width:100%;box-sizing:border-box;border:1px solid var(--line2,#cfd8e3);border-radius:10px;padding:10px;font:inherit;font-size:13.5px;line-height:1.45;margin:6px 0}'+
  '.nxa-dict{font-size:12px;color:var(--muted,#6b7a90);margin-top:6px}.nxa-dict summary{cursor:pointer}'+
  '.nxa-row{display:flex;gap:8px;align-items:stretch}.nxa-row textarea{flex:1;border:2px solid var(--line2,#cfd8e3);border-radius:10px;padding:10px;font:inherit;font-size:15px;min-height:52px}'+
  '.nxa-mic{border:none;border-radius:12px;background:#121417;color:#fff;font-size:22px;width:56px;cursor:pointer}.nxa-mic.on{background:#c0392b;animation:nxaP 1s infinite}'+
  '@keyframes nxaP{50%{opacity:.6}}'+
  '.nxa-pv{margin-top:6px;min-height:22px}.nxa-chip{display:inline-block;font-size:11.5px;padding:3px 9px;border-radius:20px;background:#e8eef6;color:#121417;margin:2px 4px 2px 0;white-space:nowrap}'+
  '.nxa-chip.mute{background:#f0f2f5;color:#8a96a8}.nxa-chip.hot{background:#fde2df;color:#b03a2e}'+
  '.nxa-state{padding:10px 14px;border-radius:10px;background:#eef3f9;margin:10px 0;font-size:13px}.nxa-state.warn{background:#fff6e5;color:#7a4b00}'+
  '.nxa-banner{position:relative;background:#eef3f9;border:1px solid #c9d8ea;border-left:4px solid #121417;border-radius:10px;padding:10px 38px 10px 14px;margin:0 0 12px;font-size:13px}'+
  '.nxa-banner ul{margin:6px 0 4px;padding-left:20px;color:#7a4b00}.nxa-x{position:absolute;top:6px;right:8px;border:none;background:none;font-size:15px;cursor:pointer;color:#6b7a90}'+
  '.nxa-fab{position:fixed;right:18px;bottom:18px;z-index:9000;border:none;border-radius:28px;background:#121417;color:#fff;font-weight:700;font-size:14px;padding:13px 18px;box-shadow:0 6px 20px rgba(15,35,65,.35);cursor:pointer}'+
  '.nxa-thread{max-height:46vh;overflow:auto;margin:6px 0 10px;padding:4px 2px;display:flex;flex-direction:column;gap:8px}'+
  '.nxa-bub{max-width:88%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word}'+
  '.nxa-bub.me{align-self:flex-end;background:#121417;color:#fff;border-bottom-right-radius:4px}'+
  '.nxa-bub.ia{align-self:flex-start;background:#eef3f9;color:#10243e;border-bottom-left-radius:4px}'+
  '.nxa-bub.sys{align-self:stretch;max-width:100%;background:#fff6e5;color:#7a4b00;font-size:13px}'+
  '.nxa-it{margin-top:6px;font-size:13px}.nxa-typing span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#7d93ad;animation:nxaB 1s infinite}'+
  '.nxa-typing span:nth-child(2){animation-delay:.15s}.nxa-typing span:nth-child(3){animation-delay:.3s}@keyframes nxaB{50%{transform:translateY(-4px);opacity:.5}}'+
  '#nxaSendBtn[disabled]{opacity:.6}'+
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
        var b=document.createElement('button'); b.id='nxaFab'; b.className='nxa-fab'; b.innerHTML='🎙️ Assistant';
        b.onclick=function(){ go('nx_assist'); setTimeout(function(){ var t=document.getElementById('nxaQuick'); if(t) t.focus(); },120); };
        document.body.appendChild(b);
      }
      var _go=window.go;
      window.go=function(v){
        var r=_go.apply(this,arguments);
        try{
          if(v==='nx_assist'){ renderAssist(); fetchInbox(); refreshBudget();
            document.querySelectorAll('.nx-nav-section').forEach(function(s){ var open=s.dataset.section==='home'; s.classList.toggle('open',open); var t=s.querySelector(':scope > .nx-nav-toggle'); if(t) t.setAttribute('aria-expanded',open?'true':'false'); });
          }
          if(v==='nx_tools'){ var vt=document.getElementById('v-nx_tools'); if(vt&&!document.getElementById('nxaBackups')){ var bx=document.createElement('div'); bx.id='nxaBackups'; vt.insertBefore(bx,vt.firstChild); } renderBackups(); }
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
