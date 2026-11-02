/* ============================================================
   ClimPilot Next — next-terrain.js  (couche additive, 20/10/2026, branche claude/planning-20-10)
   Quatre outils de terrain (choix de Gabriel du 19/10), dans « Ma journée » :
     1. TOURNÉE DU JOUR : les interventions du jour dans l'ordre (matin → journée → après-midi, puis au plus
        proche de l'étape précédente), km estimés, itinéraire complet Google Maps (départ = point de départ des trajets).
     2. POINTAGE : « ▶ Commencer » / « ■ Terminer » sur chaque intervention ; le temps réel va dans `hReel`
        (devis et interventions), arrondi au quart d'heure, en plus de ce qui y était déjà.
     3. ALERTE MATÉRIEL : chantier accepté dans les 7 jours dont le matériel n'est pas marqué réservé / commandé.
     4. SUIVI D'ACOMPTE : une demande de créneau venue du site devient une intervention (« 📅 Planifier ce créneau »
        dans la boîte de réception) ; l'acompte attendu est suivi ; « ✔ Acompte reçu » rend le créneau FERME.
   Rien ne part vers l'extérieur ; le pointage en cours reste sur l'appareil (clé cpnext_pointage), les pointages
   terminés sont synchronisés (cpnext_pointages).
   ============================================================ */
(function(){
  'use strict';
  var KP='cpnext_pointage', KPS='cpnext_pointages';
  try{ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(KPS)<0) SYNC_KEYS.push(KPS); }catch(e){}
  var pad=function(n){ return String(n).padStart(2,'0'); };
  var isoD=function(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  var plus=function(iso,n){ var d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return isoD(d); };
  var auj=function(){ return isoD(new Date()); };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function say(m,t){ try{ if(window.nxToast) return nxToast(m,t); }catch(e){} try{ toast(m); }catch(e){} }
  function lsGet(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function persist(k,v){ try{ save(k,v); }catch(e){ lsSet(k,v); } }
  function fq(n){ try{ return fmtQ(n); }catch(e){ return String(Math.round(n*100)/100).replace('.',','); } }
  function dateFR(iso){ try{ return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }catch(e){ return iso; } }
  function rafraichir(){ try{ if(window._curView==='nx_journee'&&window.nxjRender) nxjRender(); }catch(e){} try{ if(window._curView==='plan'&&window.renderPlanning) renderPlanning(); }catch(e){} }
  function source(k){ try{ return window.nxplSource?nxplSource(k):null; }catch(e){ return null; } }
  function adresseDe(s){ if(!s||!s.o) return ''; var o=s.o; if(s.t==='ctr'){ var cl=null; try{ cl=(CLIENTS||[]).find(function(c){ return (c.nom||'').toLowerCase()===(o.clientNom||'').toLowerCase(); }); }catch(e){} return cl?[cl.adr,cl.ville].filter(Boolean).join(', '):''; } return [o.cAdr,o.cVille].filter(Boolean).join(', '); }
  function telDe(s){ if(!s||!s.o) return ''; var t=s.o.cTel||''; if(!t&&s.t==='ctr'){ try{ var cl=(CLIENTS||[]).find(function(c){ return (c.nom||'').toLowerCase()===(s.o.clientNom||'').toLowerCase(); }); t=cl?cl.tel:''; }catch(e){} } return String(t||'').replace(/[^\d+]/g,''); }

  /* ================= 1. tournée du jour ================= */
  var ORDRE={matin:0,journee:1,apresmidi:2};
  function tournee(iso){
    iso=iso||auj();
    var ev=[]; try{ ev=nxplEvenementsDuJour(iso); }catch(e){ ev=[]; }
    var home=null; try{ home=window.nxadHome?nxadHome():null; }catch(e){}
    var stops=ev.map(function(e){ var s=source(e.k), adr=adresseDe(s); var g=null; try{ g=adr&&window.nxadGeo?nxadGeo(adr):null; }catch(x){}
      return {k:e.k,lbl:e.lbl,m:e.m||'journee',adr:adr,geo:g,tel:telDe(s),click:(s?(s.t==='dep'?"openDep('"+s.o.id+"')":(s.t==='devis'||s.t==='visite')?"openDevis('"+s.o.id+"')":s.t==='ctr'?"go('contrats')":"openLoc('"+s.o.id+"')"):'')}; });
    /* ordre : moment, puis plus proche voisin depuis l'étape précédente (départ = maison) */
    var out=[], prev=home&&home.lat?{lat:home.lat,lon:home.lon}:null, groupes={};
    stops.forEach(function(s){ (groupes[ORDRE[s.m]]=groupes[ORDRE[s.m]]||[]).push(s); });
    [0,1,2].forEach(function(gi){ var g=groupes[gi]||[];
      while(g.length){ var best=0, bd=Infinity;
        if(prev) g.forEach(function(s,i){ if(s.geo){ var d=nxadHav(prev,s.geo); if(d<bd){ bd=d; best=i; } } });
        var s=g.splice(best,1)[0]; s.km=(prev&&s.geo)?Math.round(nxadHav(prev,s.geo)*1.3):null; out.push(s); if(s.geo) prev=s.geo; } });
    var total=out.reduce(function(a,s){ return a+(s.km||0); },0), retour=(prev&&home&&home.lat&&out.length)?Math.round(nxadHav(prev,home)*1.3):0;
    var manque=out.filter(function(s){ return s.adr&&!s.geo; }).length;
    var url=''; if(out.some(function(s){ return s.adr; })){ var pts=out.filter(function(s){ return s.adr; }).map(function(s){ return s.adr; });
      url='https://www.google.com/maps/dir/?api=1'+(home&&home.adr?'&origin='+encodeURIComponent(home.adr):'')+'&destination='+encodeURIComponent(home&&home.adr?home.adr:pts[pts.length-1])+(pts.length?'&waypoints='+encodeURIComponent((home&&home.adr?pts:pts.slice(0,-1)).join('|')):'')+'&travelmode=driving'; }
    return {jour:iso,stops:out,km:total+retour,retour:retour,manque:manque,url:url,home:!!(home&&home.lat)};
  }
  window.nxtrTournee=tournee;
  /* adresses sans coordonnées : on les calcule (réseau) puis on réaffiche */
  var GEO_EN_COURS={};
  function completerGeo(t){ t.stops.forEach(function(s){ if(s.adr&&!s.geo&&!GEO_EN_COURS[s.adr]&&window.nxadDistance){ GEO_EN_COURS[s.adr]=1; nxadDistance(s.adr).then(function(){ delete GEO_EN_COURS[s.adr]; rafraichir(); },function(){ delete GEO_EN_COURS[s.adr]; }); } }); }

  /* ================= 2. pointage ================= */
  function enCours(){ var p=lsGet(KP,null); return (p&&p.k&&p.debut)?p:null; }
  function arrondi(h){ return Math.max(0.25,Math.round(h*4)/4); }
  window.nxtrPointer=function(k){ var p=enCours(); if(p&&p.k!==k){ say('Un pointage est déjà en cours : termine-le d\'abord','warn'); return false; } if(p) return false;
    lsSet(KP,{k:k,debut:Date.now()}); say('⏱ Pointage commencé','ok'); rafraichir(); return true; };
  window.nxtrTerminer=function(k){ var p=enCours(); if(!p||p.k!==k) return null; var h=arrondi((Date.now()-p.debut)/36e5), s=source(k);
    if(s&&s.o&&s.t!=='ctr'){ var o=s.o, avant=Number(String(o.hReel==null?'':o.hReel).replace(',','.'))||0; o.hReel=String(Math.round((avant+h)*100)/100); try{ if(s.t==='devis'||s.t==='visite') save(LS.devis,DEVIS); else if(s.t==='dep') save(LS.dep,DEP); else save(LS.loc,LOC); }catch(e){} }
    var L=lsGet(KPS,[]); if(!Array.isArray(L)) L=[]; L.push({k:k,jour:auj(),debut:new Date(p.debut).toISOString(),fin:new Date().toISOString(),h:h}); if(L.length>500) L=L.slice(-500); persist(KPS,L);
    lsSet(KP,null); say('⏱ '+fq(h)+' h pointée'+(h>1?'s':'')+(s&&s.t!=='ctr'?' (ajoutées au réel du chantier)':''),'ok'); rafraichir(); return h; };
  window.nxtrAnnulerPointage=function(){ lsSet(KP,null); rafraichir(); };
  window.nxtrPointages=function(k){ return lsGet(KPS,[]).filter(function(x){ return !k||x.k===k; }); };
  function pointeTxt(k){ var h=lsGet(KPS,[]).filter(function(x){ return x.k===k; }).reduce(function(a,x){ return a+(Number(x.h)||0); },0); return h?fq(h)+' h pointée'+(h>1?'s':''):''; }

  /* ================= 3. alerte matériel ================= */
  function alertesMateriel(){
    var out=[], t=auj(), lim=plus(t,7);
    try{ (DEVIS||[]).forEach(function(d){ if(!d||d.statut!=='accepte'||!d.datePlanif||d.datePlanif<t||d.datePlanif>lim||d.matReserve) return;
      var n=0; try{ n=(compute(d).mat||[]).length; }catch(e){ n=0; } if(!n) return;
      out.push({id:d.id,nom:d.cNom||d.num||'?',jour:d.datePlanif,articles:n,jours:Math.round((new Date(d.datePlanif+'T12:00:00')-new Date(t+'T12:00:00'))/864e5)}); }); }catch(e){}
    return out.sort(function(a,b){ return a.jour<b.jour?-1:1; });
  }
  window.nxtrAlertesMateriel=alertesMateriel;
  window.nxtrMaterielOk=function(id){ try{ if(window.nxToggleResa) nxToggleResa(id,true); else { var d=DEVIS.find(function(x){ return x.id===id; }); if(d){ d.matReserve=Date.now(); save(LS.devis,DEVIS); } } }catch(e){} say('Matériel marqué réservé','ok'); rafraichir(); };

  /* ================= 4. demande du site → intervention, suivi d'acompte ================= */
  function nombre(s){ var m=/(\d+(?:[.,]\d+)?)/.exec(String(s||'')); return m?Number(m[1].replace(',','.')):0; }
  window.nxtrPlanifierSite=function(inboxId){
    var x=null; try{ x=window.nxaSiteLigne?nxaSiteLigne(inboxId):null; }catch(e){} if(!x){ say('Demande introuvable','warn'); return null; }
    var p=(x.payload&&typeof x.payload==='object')?x.payload:{}, ch=(p.champs&&typeof p.champs==='object')?p.champs:{}, txt=function(k){ var v=ch[k]; return (v==null||typeof v==='object')?'':String(v).slice(0,300); };
    var jour=/^\d{4}-\d{2}-\d{2}$/.test(txt('jour'))?txt('jour'):'', m=/apr/i.test(txt('moment'))?'apresmidi':/matin/i.test(txt('moment'))?'matin':'journee';
    if(!jour){ say('Pas de jour dans cette demande','warn'); return null; }
    var c=[]; try{ c=nxplConflits(jour,m,''); }catch(e){} if(c.length&&!confirm('Le '+dateFR(jour)+' ('+(window.nxplLabel?nxplLabel(m).toLowerCase():m)+') est déjà pris : '+c.map(function(e){ return e.lbl; }).join(', ')+'.\n\nPlanifier quand même ?')) return null;
    var pro=/pro/i.test(txt('profil')), o;
    try{ o={id:uid(),created:Date.now(),date:jour,statut:'brouillon',facNum:'',facDate:null,payeLe:null,itype:'dep',cNom:txt('nom'),cTel:txt('telephone'),cMail:txt('email'),cType:pro?'Professionnel':'Particulier',cAdr:txt('adresse'),cVille:txt('commune'),
      desc:(txt('prestation')||'Intervention demandée sur le site')+(txt('equipement')?' — '+txt('equipement'):'')+(txt('marque')?' ('+txt('marque')+')':''),notes:[txt('message'),txt('dernier')?'Dernier entretien : '+txt('dernier'):'',txt('connu')?'Nous a connu par : '+txt('connu'):''].filter(Boolean).join('\n'),
      mode:'forfaitH',panne:'',heures:1,rateChoice:String((P&&P.dep&&P.dep.taux)||75),rateCustom:(P&&P.dep&&P.dep.taux)||75,zone:'0-10 km',maj:'0',pieces:[],mesMode:'forfait',mesType:'Monosplit',heuresSup:0,nbRaccords:4,
      moment:m,site:{inbox:String(x.id||''),rid:String((p.meta&&p.meta.rid)||''),prestation:txt('prestation'),recu:(p.meta&&p.meta.recu)||x.created_at||''},acompte:{montant:nombre(txt('acompte')),recu:null}}; }catch(e){ say('Création impossible : '+(e&&e.message||e),'warn'); return null; }
    if(/visite/i.test(txt('prestation'))&&!o.acompte.montant) o.acompte=null; /* visite gratuite : pas d'acompte */
    DEP.push(o); save(LS.dep,DEP);
    try{ if(o.cNom){ var i=CLIENTS.findIndex(function(cl){ return (cl.nom||'').toLowerCase()===o.cNom.toLowerCase(); }); var fiche={nom:o.cNom,type:o.cType,tel:o.cTel,mail:o.cMail,adr:o.cAdr,ville:o.cVille}; if(i>=0) CLIENTS[i]=Object.assign({},CLIENTS[i],fiche); else CLIENTS.push(Object.assign({id:uid(),notes:''},fiche)); save(LS.clients,CLIENTS); } }catch(e){}
    try{ if(window.nxaSiteTraite) nxaSiteTraite(inboxId); }catch(e){}
    try{ if(window.nxplEnvoyer) setTimeout(function(){ nxplEnvoyer(false); },500); }catch(e){}
    say('📅 Créneau planifié le '+dateFR(jour)+(o.acompte&&o.acompte.montant?' — acompte de '+o.acompte.montant+' € attendu':'')+'. Le message de confirmation est prêt dans Ma journée.','ok');
    try{ updateBadges(); }catch(e){} try{ go('plan'); }catch(e){}
    return o.id;
  };
  function acomptes(){
    var out=[], t=auj();
    try{ (DEP||[]).forEach(function(x){ if(!x||!x.acompte||!x.acompte.montant||x.statut==='payee') return; var recu=!!(x.acompte&&x.acompte.recu);
      var j=x.date?Math.round((new Date(x.date+'T12:00:00')-new Date(t+'T12:00:00'))/864e5):null;
      out.push({id:x.id,nom:x.cNom||'?',jour:x.date,jours:j,montant:x.acompte.montant,recu:recu,le:recu?x.acompte.recu.le:'',urgent:!recu&&j!=null&&j<=2,passe:j!=null&&j<0}); }); }catch(e){}
    return out.sort(function(a,b){ return (a.jour||'')<(b.jour||'')?-1:1; });
  }
  window.nxtrAcomptes=acomptes;
  window.nxtrAcompteRecu=function(id){ var x=null; try{ x=DEP.find(function(d){ return d.id===id; }); }catch(e){} if(!x||!x.acompte) return false;
    var mode=null; try{ mode=askMode(); }catch(e){ mode='Virement'; } if(mode==null) return false;
    x.acompte.recu={le:auj(),mode:mode}; save(LS.dep,DEP); say('✔ Acompte reçu : créneau ferme','ok'); rafraichir(); return true; };
  window.nxtrAcompteAnnuler=function(id){ var x=null; try{ x=DEP.find(function(d){ return d.id===id; }); }catch(e){} if(!x||!x.acompte||!x.acompte.recu) return false; x.acompte.recu=null; save(LS.dep,DEP); rafraichir(); return true; };

  /* ================= cartes dans Ma journée ================= */
  function carteTournee(r,mode){
    if(mode!=='matin') return '';
    var t=tournee(r.today); if(!t.stops.length) return '';
    if(t.manque) completerGeo(t);
    var p=enCours();
    var h='<div class="card nxj-card" id="nxTournee"><h2>🚐 Tournée du jour <span class="nxt-km">'+(t.home?(t.km?'≈ '+t.km+' km aller-retour':'')+(t.manque?' (adresses en cours de calcul)':''):'point de départ des trajets non réglé (Paramètres)')+'</span></h2>';
    h+=t.stops.map(function(s,i){ var mine=p&&p.k===s.k, autre=p&&p.k!==s.k, pt=pointeTxt(s.k);
      return '<div class="nxt-stop"><div class="nxt-n">'+(i+1)+'</div><div class="nxt-main" onclick="'+esc(s.click)+'"><b>'+esc(s.lbl)+'</b><div class="nxj-sub">'+esc(window.nxplLabel?nxplLabel(s.m):s.m)+(s.adr?' · '+esc(s.adr):' · <i>adresse non renseignée</i>')+(s.km!=null&&i>0?' · ≈ '+s.km+' km depuis l\'étape '+i:s.km!=null?' · ≈ '+s.km+' km':'')+(pt?' · ⏱ '+esc(pt):'')+'</div></div>'+
        '<div class="nxt-act">'+(s.tel?'<a class="nx-sbtn" href="tel:'+esc(s.tel)+'">📞</a>':'')+(s.adr?'<a class="nx-sbtn" href="'+esc(mapsUrl(s.adr))+'" target="_blank" rel="noopener">🗺️</a>':'')+
        (mine?'<button class="nx-sbtn ref" onclick="nxtrTerminer(\''+esc(s.k)+'\')">■ Terminer ('+esc(dureeTxt(p.debut))+')</button>':autre?'':'<button class="nx-sbtn acc" onclick="nxtrPointer(\''+esc(s.k)+'\')">▶ Commencer</button>')+'</div></div>'; }).join('');
    if(t.url) h+='<div class="nxa-act" style="margin-top:8px"><a class="nx-sbtn" href="'+esc(t.url)+'" target="_blank" rel="noopener">🗺️ Itinéraire complet dans Google Maps</a>'+(t.retour?'<span class="nxj-sub">retour ≈ '+t.retour+' km</span>':'')+'</div>';
    if(p&&!t.stops.some(function(s){ return s.k===p.k; })) h+='<div class="nxj-sub" style="margin-top:6px">⏱ Pointage en cours sur une autre intervention depuis '+esc(dureeTxt(p.debut))+' — <button class="nx-sbtn" onclick="nxtrTerminer(\''+esc(p.k)+'\')">Terminer</button> <button class="nx-sbtn" onclick="nxtrAnnulerPointage()">Annuler</button></div>';
    return h+'<div class="nxj-sub" style="margin-top:6px">Ordre proposé : matin, journée, après-midi, puis au plus proche. Les km sont estimés à vol d\'oiseau × 1,3.</div></div>';
  }
  function dureeTxt(debut){ var m=Math.round((Date.now()-debut)/6e4); return m<60?m+' min':Math.floor(m/60)+' h '+pad(m%60); }
  function carteMateriel(r,mode){
    var A=alertesMateriel(); if(!A.length) return '';
    return '<div class="card nxj-card" id="nxMateriel"><h2>📦 Matériel à vérifier</h2>'+A.map(function(a){ return '<div class="nxt-stop"><div class="nxt-n" style="background:#b05a00">!</div><div class="nxt-main" onclick="openDevis(\''+esc(a.id)+'\')"><b>'+esc(a.nom)+'</b><div class="nxj-sub">chantier '+(a.jours===0?'aujourd\'hui':a.jours===1?'demain':'dans '+a.jours+' jours')+' · '+a.articles+' article'+(a.articles>1?'s':'')+' · matériel non marqué réservé / commandé</div></div><div class="nxt-act"><button class="nx-sbtn acc" onclick="nxtrMaterielOk(\''+esc(a.id)+'\')">✔ Réservé</button><button class="nx-sbtn" onclick="go(\'commander\')">À commander</button></div></div>'; }).join('')+'</div>';
  }
  function carteAcomptes(r,mode){
    var A=acomptes().filter(function(a){ return !a.recu||a.jours==null||a.jours>=-1; }); if(!A.length) return '';
    return '<div class="card nxj-card" id="nxAcomptes"><h2>💶 Acomptes des créneaux réservés</h2>'+A.map(function(a){
      return '<div class="nxt-stop'+(a.urgent?' nxt-urgent':'')+'"><div class="nxt-n" style="background:'+(a.recu?'#1e7a4c':a.urgent?'#b03a2e':'#b05a00')+'">'+(a.recu?'✔':'⏳')+'</div><div class="nxt-main" onclick="openDep(\''+esc(a.id)+'\')"><b>'+esc(a.nom)+'</b><div class="nxj-sub">'+esc(a.jour?dateFR(a.jour):'')+' · acompte '+a.montant+' € '+(a.recu?'reçu le '+esc(new Date(a.le+'T12:00:00').toLocaleDateString('fr-FR'))+' — <b>créneau ferme</b>':a.urgent?'<b>toujours attendu, rendez-vous '+(a.jours<=0?'aujourd\'hui':'dans '+a.jours+' jour'+(a.jours>1?'s':''))+' : rappelle le client</b>':'attendu avant le rendez-vous')+'</div></div><div class="nxt-act">'+(a.recu?'<button class="nx-sbtn" onclick="nxtrAcompteAnnuler(\''+esc(a.id)+'\')" title="Marqué reçu par erreur">↺</button>':'<button class="nx-sbtn acc" onclick="nxtrAcompteRecu(\''+esc(a.id)+'\')">✔ Reçu</button>')+'</div></div>'; }).join('')+'</div>';
  }
  /* au planning : état de l'acompte et pointage sur les cartes */
  function decorerPlanning(){
    var g=document.getElementById('planGrid'); if(!g) return;
    g.querySelectorAll('[data-k^="dep:"]').forEach(function(ch){ if(ch.querySelector('.nxt-ac')) return; var s=source(ch.getAttribute('data-k')); if(!s||!s.o||!s.o.acompte||!s.o.acompte.montant) return;
      var ok=!!s.o.acompte.recu, d=document.createElement('div'); d.className='nxt-ac'; d.style.cssText='font-size:10.5px;font-weight:700;margin-top:3px;color:'+(ok?'#1e7a4c':'#b05a00'); d.textContent=ok?'✔ acompte reçu — créneau ferme':'⏳ acompte '+s.o.acompte.montant+' € attendu'; ch.appendChild(d); });
  }
  var CSS='.nxt-stop{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line,#edf1f5)}.nxt-stop:last-child{border-bottom:0}.nxt-stop.nxt-urgent{background:#fff4f2;border-radius:8px;padding:8px 6px}'+
    '.nxt-n{width:26px;height:26px;border-radius:50%;background:#121417;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none}.nxt-main{flex:1;min-width:0;cursor:pointer}.nxt-act{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.nxt-act .nx-sbtn{text-decoration:none}'+
    '.nxt-km{font-size:12px;font-weight:400;color:var(--muted,#6b7a90);margin-left:6px}';
  function boot(n){
    if(typeof window.nxjRender!=='function'||typeof window.nxplSource!=='function'||typeof window.nxplEvenementsDuJour!=='function'){ if(n<60) setTimeout(function(){ boot(n+1); },250); return; }
    if(!document.getElementById('nxtStyle')){ var st=document.createElement('style'); st.id='nxtStyle'; st.textContent=CSS; document.head.appendChild(st); }
    window.nxjAjouts=window.nxjAjouts||[];
    [['tournee',carteTournee,10],['materiel',carteMateriel,20],['acomptes',carteAcomptes,30]].forEach(function(p){ if(!window.nxjAjouts.some(function(a){ return a&&a.id===p[0]; })) window.nxjAjouts.push({id:p[0],pos:p[2],carte:p[1]}); });
    var g=document.getElementById('planGrid'); if(g&&window.MutationObserver){ var prevu=false; new MutationObserver(function(){ if(prevu) return; prevu=true; Promise.resolve().then(function(){ prevu=false; try{ decorerPlanning(); }catch(e){} }); }).observe(g,{childList:true,subtree:true}); }
    setInterval(function(){ try{ if(enCours()&&window._curView==='nx_journee') nxjRender(); }catch(e){} },60000);
    try{ if(window._curView==='nx_journee') nxjRender(); }catch(e){}
  }
  boot(0);
})();
