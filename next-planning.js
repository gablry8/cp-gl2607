/* ClimPilot — Planning par demi-journée (20/10/2026, branche claude/planning-20-10, NON déployée)
   But (choix de Gabriel du 19/10) : ne jamais se retrouver avec deux clients au même moment.
   - chaque intervention planifiée a un moment : Matin, Après-midi ou Journée (Journée par défaut : prudent) ;
   - le planning signale les chevauchements et « Planifier » demande confirmation si le moment est déjà pris ;
   - les demi-journées occupées (dates seulement, AUCUN nom) partent vers Supabase (cp_busy_appli) : le site ne propose
     que les moments libres et le script Google Agenda les recopie ;
   - les moments pris dans Google Agenda (envoyés par le script) s'affichent au planning et comptent dans les conflits.
   Tant que la migration agenda n'est pas appliquée, l'envoi se coupe tout seul (rien ne casse). */
(function(){
  'use strict';
  var JOUR=864e5, FENETRE=60;
  var CHAMP={devis:'momentPlanif',dep:'moment',locd:'momentDebut',locf:'momentFin',ctr:'momentVisite'};
  var LBL={matin:'Matin',apresmidi:'Après-midi',journee:'Journée'};
  var pad=function(n){ return String(n).padStart(2,'0'); };
  var isoD=function(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  var plus=function(iso,n){ var d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return isoD(d); };
  var auj=function(){ return isoD(new Date()); };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function cloudOk(){ try{ return !!(sb && SESS && SESS.user); }catch(e){ return false; } }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  /* ---------- source d'un événement du planning (clé « type:id ») ---------- */
  function source(k){
    var p=String(k||'').split(':'), t=p[0], id=p.slice(1).join(':'), L=null;
    try{
      if(t==='devis'||t==='visite') L=DEVIS; else if(t==='dep') L=DEP; else if(t==='locd'||t==='locf') L=LOC; else if(t==='ctr') L=CTR;
    }catch(e){ L=null; }
    var o=L&&L.find(function(x){ return x&&x.id===id; });
    return o?{t:t,o:o}:null;
  }
  function momentDe(k){
    var s=source(k); if(!s) return 'journee';
    var v=s.t==='visite'?(s.o.visite&&s.o.visite.moment):s.o[CHAMP[s.t]];
    return v==='matin'||v==='apresmidi'?v:'journee';
  }
  function enregistrer(t){
    try{
      if(t==='devis'||t==='visite') save(LS.devis,DEVIS); else if(t==='dep') save(LS.dep,DEP);
      else if(t==='locd'||t==='locf') save(LS.loc,LOC); else if(t==='ctr') save('cp2_contrats',CTR);
    }catch(e){}
  }
  function setMoment(k,m){
    if(['matin','apresmidi','journee'].indexOf(m)<0) return false;
    var s=source(k); if(!s) return false;
    if(s.t==='visite'){ s.o.visite=s.o.visite||{}; s.o.visite.moment=m; } else s.o[CHAMP[s.t]]=m;
    enregistrer(s.t); return true;
  }
  var chevauche=function(a,b){ return a==='journee'||b==='journee'||a===b; };

  /* ---------- événements d'un jour (semaine du planning) + moments pris dans Google ---------- */
  function lundi(iso){ var d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return isoD(d); }
  function decalage(iso){ return Math.round((new Date(lundi(iso)+'T12:00:00')-new Date(lundi(auj())+'T12:00:00'))/(7*JOUR)); }
  function evenementsDuJour(iso,cache){
    var off=decalage(iso), r;
    if(cache&&cache[off]) r=cache[off]; else { try{ r=planEvents(off); }catch(e){ r={ev:[]}; } if(cache) cache[off]=r; }
    var idx=(new Date(iso+'T12:00:00').getDay()+6)%7;
    return (r.ev||[]).filter(function(e){ return e.i===idx&&e.k; }).map(function(e){ return {k:e.k,lbl:e.lbl,m:momentDe(e.k)}; });
  }
  var GOOGLE={jours:{},charge:0,du:'',au:''};
  function googleDuJour(iso){ var g=GOOGLE.jours[iso]; if(!g||!(g.matin||g.apresmidi)) return null; return {k:'google:'+iso,lbl:'Agenda Google',m:g.matin&&g.apresmidi?'journee':g.matin?'matin':'apresmidi',google:true}; }
  function chargerGoogle(du,au,force){
    if(!cloudOk()) return Promise.resolve(false);
    if(!force&&GOOGLE.du<=du&&GOOGLE.au>=au&&Date.now()-GOOGLE.charge<5*60*1000) return Promise.resolve(false);
    try{
      return sb.from('climpilot_busy').select('jour,matin,apresmidi').eq('source','google').gte('jour',du).lte('jour',au).then(function(r){
        if(!r||r.error||!Array.isArray(r.data)) return false;
        var j={}; r.data.forEach(function(x){ j[x.jour]={matin:!!x.matin,apresmidi:!!x.apresmidi}; });
        GOOGLE.jours=j; GOOGLE.du=du; GOOGLE.au=au; GOOGLE.charge=Date.now(); return true;
      },function(){ return false; });
    }catch(e){ return Promise.resolve(false); }
  }

  /* conflits d'un moment donné (sauf l'événement lui-même) */
  function conflits(iso,m,sauf){
    var ev=evenementsDuJour(iso), g=googleDuJour(iso); if(g) ev.push(g);
    return ev.filter(function(e){ return e.k!==sauf&&chevauche(e.m,m||'journee'); });
  }
  /* chevauchements internes d'un jour : clés en conflit */
  function conflitsDuJour(iso,cache){
    var ev=evenementsDuJour(iso,cache), g=googleDuJour(iso), out={}; if(g) ev.push(g);
    for(var a=0;a<ev.length;a++) for(var b=a+1;b<ev.length;b++) if(chevauche(ev[a].m,ev[b].m)){ out[ev[a].k]=ev[b].lbl; out[ev[b].k]=ev[a].lbl; }
    return out;
  }

  /* ---------- demi-journées occupées (dates seulement) ---------- */
  function occupations(du,au){
    var out=[], cache={}, x=du, guard=0;
    while(x<=au&&guard++<200){
      var ev=evenementsDuJour(x,cache), m=false, a=false;
      ev.forEach(function(e){ if(e.m!=='apresmidi') m=true; if(e.m!=='matin') a=true; });
      if(m||a) out.push({jour:x,matin:m,apresmidi:a});
      x=plus(x,1);
    }
    return out;
  }
  var ENVOI={coupe:false,enCours:false,t:null};
  function envoyer(force){
    if(ENVOI.coupe||ENVOI.enCours||!cloudOk()) return Promise.resolve(null);
    var du=auj(), au=plus(du,FENETRE), jours=occupations(du,au), h=JSON.stringify([du,jours]);
    if(!force&&lsGet('cpnext_busy_envoye')===h) return Promise.resolve(false);
    ENVOI.enCours=true;
    var fin=function(v){ ENVOI.enCours=false; return v; };
    try{
      return Promise.resolve(sb.rpc('cp_busy_appli',{p_du:du,p_au:au,p_jours:jours})).then(function(r){
        if(r&&r.error){
          var c=String(r.error.code||''), msg=String(r.error.message||'');
          if(c==='PGRST202'||c==='42883'||c==='42P01'||/cp_busy_appli|climpilot_busy/.test(msg)) ENVOI.coupe=true; /* migration pas encore appliquée */
          return fin(null);
        }
        lsSet('cpnext_busy_envoye',h); return fin(true);
      },function(){ return fin(null); });
    }catch(e){ return Promise.resolve(fin(null)); }
  }
  function planifierEnvoi(ms){ clearTimeout(ENVOI.t); ENVOI.t=setTimeout(function(){ envoyer(false); },ms==null?2000:ms); }

  /* ---------- « Planifier » : confirmation si le moment est déjà pris ---------- */
  function dateFR(iso){ try{ return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }catch(e){ return iso; } }
  function texteConflit(iso,m,liste){
    return 'Le '+dateFR(iso)+' ('+LBL[m||'journee'].toLowerCase()+') est déjà pris :\n'+liste.map(function(e){ return '• '+e.lbl+' — '+LBL[e.m].toLowerCase(); }).join('\n')+
      '\n\nPlanifier quand même ? (choisis ensuite Matin ou Après-midi dans le planning pour séparer les deux)';
  }
  function brancherPlanifier(){
    if(typeof window.planifDevis!=='function'||window.planifDevis._nxpl) return;
    var o=window.planifDevis;
    window.planifDevis=function(id,val){
      if(val){
        var k='devis:'+id, c=conflits(val,momentDe(k),k);
        if(c.length&&!confirm(texteConflit(val,momentDe(k),c))){ try{ renderPlanning(); }catch(e){} return; }
      }
      var r=o.apply(this,arguments); planifierEnvoi(); return r;
    };
    window.planifDevis._nxpl=true;
  }

  /* ---------- affichage dans le planning ---------- */
  function decorer(){
    var grille=document.getElementById('planGrid'); if(!grille) return;
    var ws=null; try{ ws=weekStart(planOff); }catch(e){ return; }
    var cache={}, jours=grille.querySelectorAll('[data-iso]');
    if(!jours.length) jours=grille.querySelectorAll(':scope > div > div'); /* écran de base (sans le module adresses) */
    jours.forEach(function(col,i){
      var iso=col.getAttribute('data-iso'); if(!iso){ var d=new Date(ws); d.setDate(ws.getDate()+i); iso=isoD(d); }
      var cf=conflitsDuJour(iso,cache);
      col.querySelectorAll('[data-k]').forEach(function(ch){
        var k=ch.getAttribute('data-k'); if(!k||ch.querySelector('.nxpl-m')) return;
        var m=momentDe(k), b=document.createElement('button');
        b.type='button'; b.className='nxpl-m'; b.textContent=LBL[m]; b.title='Moment : cliquer pour changer (Journée → Matin → Après-midi)';
        b.style.cssText='display:inline-block;margin-top:4px;font-size:10px;padding:1px 6px;border-radius:6px;border:1px solid var(--line2);background:var(--bg);color:inherit;cursor:pointer';
        b.addEventListener('click',function(ev){ ev.stopPropagation(); var suiv={journee:'matin',matin:'apresmidi',apresmidi:'journee'}[momentDe(k)];
          setMoment(k,suiv); try{ renderPlanning(); }catch(e){} planifierEnvoi(); });
        ch.appendChild(b);
        if(cf[k]){ ch.style.borderColor='var(--red)'; var w=document.createElement('div'); w.className='nxpl-conflit'; w.style.cssText='color:var(--red);font-size:10px;font-weight:700;margin-top:3px';
          w.textContent='⚠ même moment que : '+cf[k]; ch.appendChild(w); }
      });
      var g=googleDuJour(iso);
      if(g&&!col.querySelector('.nxpl-google')){ var x=document.createElement('div'); x.className='nxpl-google';
        x.style.cssText='margin-top:6px;font-size:11px;padding:5px 7px;border-radius:8px;border:1px dashed var(--line2);color:var(--muted)'+(cf[g.k]?';border-color:var(--red)':'');
        x.innerHTML='📅 <b>Agenda Google</b> — '+esc(LBL[g.m].toLowerCase())+' pris'+(cf[g.k]?' <span style="color:var(--red);font-weight:700">⚠ conflit</span>':''); col.appendChild(x); }
    });
  }
  function brancherRendu(){
    if(typeof window.renderPlanning!=='function'||window.renderPlanning._nxpl) return;
    var o=window.renderPlanning;
    window.renderPlanning=function(){
      var r=o.apply(this,arguments);
      try{ decorer(); }catch(e){}
      try{ var ws=weekStart(planOff), du=isoD(ws), au=plus(du,6); chargerGoogle(du,au,false).then(function(nv){ if(nv){ try{ o(); decorer(); }catch(e){} } }); }catch(e){}
      planifierEnvoi(); return r;
    };
    window.renderPlanning._nxpl=true;
  }

  /* ---------- démarrage ---------- */
  function boot(n){
    if(typeof window.planEvents!=='function'||typeof window.renderPlanning!=='function'||typeof window.planifDevis!=='function'){ if(n<60) setTimeout(function(){ boot(n+1); },250); return; }
    brancherPlanifier(); brancherRendu();
    /* d'autres modules redessinent la grille après nous (adresses, trajets) : on décore après CHAQUE changement de la grille */
    var g=document.getElementById('planGrid');
    if(g&&window.MutationObserver){ var prevu=false; new MutationObserver(function(){ if(prevu) return; prevu=true;
      Promise.resolve().then(function(){ prevu=false; try{ decorer(); }catch(e){} }); }).observe(g,{childList:true,subtree:true}); }
    setInterval(function(){ envoyer(false); },30000);
    document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') planifierEnvoi(3000); });
    planifierEnvoi(5000);
  }
  window.nxplMoment=momentDe; window.nxplSetMoment=setMoment; window.nxplConflits=conflits; window.nxplConflitsDuJour=conflitsDuJour;
  window.nxplOccupations=occupations; window.nxplEnvoyer=envoyer; window.nxplChargerGoogle=chargerGoogle; window._nxplEtat={envoi:ENVOI,google:GOOGLE};
  boot(0);
})();
