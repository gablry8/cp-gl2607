/* ============================================================
   ClimPilot Next — next-journee.js  (couche additive)
   « MA JOURNÉE » : une synthèse à lire en 30 secondes.
   - Matin : l'agenda du jour, ce qu'il faut faire, ce qui attend
     (validations, relances, chantiers à planifier, impayés, signatures).
   - Soir  : ce qui a été fait, ce qui reste (reporter / fait en 1 clic),
     l'agenda de demain, et « vide ta tête » (notes pour demain).
   Calculé localement à partir des données de l'appli : gratuit,
   instantané, fonctionne hors connexion. Aucune IA.
   ============================================================ */
(function(){
  'use strict';
  var MODE=null; /* 'matin' | 'soir' | null = automatique selon l'heure */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pad(n){ return (n<10?'0':'')+n; }
  function iso(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function sameDay(ts,dayIso){ if(!ts) return false; var d=new Date(typeof ts==='number'?ts:(String(ts).length===10?ts+'T12:00:00':ts)); return !isNaN(d) && iso(d)===dayIso; }
  function lsGet(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } }
  function toastX(m,t){ try{ if(window.nxToast) return window.nxToast(m,t); }catch(e){} try{ toast(m); }catch(e){} }
  function euro(n){ try{ return eur0(n); }catch(e){ return Math.round(n||0)+' €'; } }
  var JOURS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

  /* ----- collecte ----- */
  function eventsFor(dayDate){
    try{
      var monday=weekStart(0), diff=Math.round((new Date(dayDate.getFullYear(),dayDate.getMonth(),dayDate.getDate())-monday)/86400000);
      var off=Math.floor(diff/7), idx=((diff%7)+7)%7;
      return (planEvents(off).ev||[]).filter(function(e){ return e.i===idx; });
    }catch(e){ return []; }
  }
  function tasks(){ return lsGet('cpnext_tasks',[]); }
  function collect(){
    var now=new Date(), today=iso(now), tmr=iso(addDays(now,1)), T=tasks();
    var open=T.filter(function(t){ return !t.done; });
    var r={today:today,tomorrow:tmr,now:now};
    r.evToday=eventsFor(now); r.evTomorrow=eventsFor(addDays(now,1));
    r.late=open.filter(function(t){ return t.due && t.due<today; });
    r.dueToday=open.filter(function(t){ return t.due===today; });
    r.urgentNoDate=open.filter(function(t){ return !t.due && t.priority==='high'; });
    r.dueTomorrow=open.filter(function(t){ return t.due===tmr; });
    r.doneToday=T.filter(function(t){ return t.done && sameDay(t.doneAt,today); });
    var D=[]; try{ D=DEVIS||[]; }catch(e){}
    r.relances=D.filter(function(d){ if(d.statut!=='envoye'||!d.sentAt) return false; var rl=(d.relances||[]); var last=rl.length?rl[rl.length-1]:d.sentAt; return Date.now()-last>7*86400000; });
    r.aPlanifier=D.filter(function(d){ return d.statut==='accepte' && !d.datePlanif; });
    r.sentToday=D.filter(function(d){ return sameDay(d.sentAt,today); });
    r.acceptedToday=D.filter(function(d){ return d.statut==='accepte' && (sameDay(d.acceptedAt,today) || (d.signature&&sameDay(d.signature.at,today))); });
    try{ r.impayes=(allImpayes()||[]).filter(function(x){ return x.days>30; }); }catch(e){ r.impayes=[]; }
    try{ r.encaisse=(allRecettes()||[]).filter(function(x){ return x.date===today; }); }catch(e){ r.encaisse=[]; }
    try{ r.depToday=(DEP||[]).filter(function(x){ return x.date===today; }); }catch(e){ r.depToday=[]; }
    try{ r.fluToday=(FLU||[]).filter(function(x){ return x.date===today; }); r.fluNonSignees=(FLU||[]).filter(function(x){ return !x.sigDetenteur && x.date>=iso(addDays(now,-30)); }); }catch(e){ r.fluToday=[]; r.fluNonSignees=[]; }
    var b=document.getElementById('nxaBadge'); r.aValider=b?(+b.textContent||0):0;
    r.sigPending=(window.nxsPendingList&&window.nxsPendingList())||[];
    return r;
  }

  /* ----- rendu ----- */
  function evLine(e){
    var maps=''; try{ if(e.adr) maps='<a class="nx-sbtn" href="'+esc(mapsUrl(e.adr))+'" target="_blank" rel="noopener">🗺️ Y aller</a>'; }catch(x){}
    return '<div class="nxj-row"><div class="nxj-ic">'+e.ic+'</div><div class="nxj-main" onclick="'+esc(e.click||'')+'"><b>'+esc(e.lbl)+'</b><div class="nxj-sub">'+esc(e.sub||'')+'</div></div>'+maps+'</div>';
  }
  function taskLine(t,soir){
    var late=t.due && t.due<iso(new Date());
    return '<div class="nxj-row"><label class="nxj-chk"><input type="checkbox" onchange="nxjDone(\''+esc(t.id)+'\')"><span></span></label>'+
      '<div class="nxj-main"><b>'+esc(t.title)+'</b><div class="nxj-sub">'+(late?'<span class="nxj-late">en retard ('+esc(new Date(t.due+'T12:00:00').toLocaleDateString('fr-FR'))+')</span> · ':'')+esc(t.cat||'')+(t.priority==='high'?' · <span class="nxj-late">prioritaire</span>':'')+'</div></div>'+
      (soir?'<button class="nx-sbtn" onclick="nxjTomorrow(\''+esc(t.id)+'\')">↪ Demain</button>':'')+'</div>';
  }
  function block(title, inner, cls){ return inner?'<div class="card nxj-card '+(cls||'')+'"><h2>'+title+'</h2>'+inner+'</div>':''; }
  function chip(n,label,go,cls){ return n?'<button class="nxj-chip '+(cls||'')+'" onclick="'+go+'"><b>'+n+'</b> '+label+'</button>':''; }

  function render(){
    var host=document.getElementById('nxJournee'); if(!host) return;
    var r=collect(), h=r.now.getHours(), mode=MODE||(h<14?'matin':'soir');
    var dayLbl=JOURS[r.now.getDay()]+' '+r.now.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    var todo=r.late.concat(r.dueToday), nTodo=todo.length+r.urgentNoDate.length;
    var head='<div class="nxj-hero"><div><div class="nxj-hello">'+(mode==='matin'?'☀️ Bonjour Gab':'🌙 Fin de journée')+'</div><div class="nxj-date">'+esc(dayLbl.charAt(0).toUpperCase()+dayLbl.slice(1))+'</div></div>'+
      '<div class="nxj-switch"><button class="'+(mode==='matin'?'on':'')+'" onclick="nxjMode(\'matin\')">Matin</button><button class="'+(mode==='soir'?'on':'')+'" onclick="nxjMode(\'soir\')">Soir</button></div></div>';
    var html=head;
    if(mode==='matin'){
      var resume=[r.evToday.length?r.evToday.length+' rendez-vous / chantier'+(r.evToday.length>1?'s':''):'', nTodo?nTodo+' chose'+(nTodo>1?'s':'')+' à faire':'', r.aValider?r.aValider+' à valider':''].filter(Boolean).join(' · ');
      html+='<div class="nxj-sum">'+(resume?esc(resume):'Rien de prévu aujourd\'hui — journée libre pour avancer ou prospecter.')+'</div>';
      html+=block('📅 Aujourd\'hui', r.evToday.map(evLine).join(''));
      html+=block('✅ À faire aujourd\'hui', todo.concat(r.urgentNoDate).map(function(t){ return taskLine(t,false); }).join(''));
      var att=chip(r.aValider,'proposition'+(r.aValider>1?'s':'')+' de l\'assistant à valider',"go('nx_assist')",'hot')+
        chip(r.relances.length,'devis à relancer (sans réponse depuis 7 j)',"go('relances')")+
        chip(r.aPlanifier.length,'chantier'+(r.aPlanifier.length>1?'s':'')+' accepté'+(r.aPlanifier.length>1?'s':'')+' à planifier',"go('plan')")+
        chip(r.impayes.length,'facture'+(r.impayes.length>1?'s':'')+' impayée'+(r.impayes.length>1?'s':'')+' depuis +30 j ('+euro(r.impayes.reduce(function(s,x){return s+(x.montant||0);},0))+')',"go('recettes')",'hot')+
        chip(r.sigPending.length,'lien'+(r.sigPending.length>1?'s':'')+' de signature en attente',"go('nx_assist')")+
        chip(r.fluNonSignees.length,'fiche'+(r.fluNonSignees.length>1?'s':'')+' fluide non signée'+(r.fluNonSignees.length>1?'s':'')+' par le client',"go('fluides')");
      html+=block('📌 Ce qui t\'attend', att?'<div class="nxj-chips">'+att+'</div>':'');
      if(!r.evToday.length && !nTodo && !att) html+='<div class="card nxj-card nxj-zen">✨ Tout est à jour. Rien ne t\'attend.</div>';
    } else {
      var faits=[];
      r.doneToday.forEach(function(t){ faits.push('✔ '+t.title); });
      r.depToday.forEach(function(x){ faits.push((x.itype==='mes'?'🧊 Mise en service':'🔧 Dépannage')+' — '+(x.cNom||'?')); });
      r.sentToday.forEach(function(d){ faits.push('📤 Devis envoyé — '+(d.cNom||d.num)); });
      r.acceptedToday.forEach(function(d){ faits.push('✍️ Devis accepté — '+(d.cNom||d.num)); });
      r.fluToday.forEach(function(f){ faits.push('🧪 Fiche fluide '+f.num+' — '+f.client); });
      r.encaisse.forEach(function(x){ faits.push('💶 Encaissé '+euro(x.montant)+' — '+x.client); });
      html+='<div class="nxj-sum">'+(faits.length?faits.length+' chose'+(faits.length>1?'s':'')+' faite'+(faits.length>1?'s':'')+' aujourd\'hui. Bravo.':'Journée enregistrée.')+(r.late.concat(r.dueToday).length?' Il reste '+r.late.concat(r.dueToday).length+' tâche(s) : fais-les ou reporte-les ci-dessous.':'')+'</div>';
      html+=block('✔ Fait aujourd\'hui', faits.map(function(f){ return '<div class="nxj-done">'+esc(f)+'</div>'; }).join(''));
      html+=block('⏭ Reste ouvert', r.late.concat(r.dueToday).map(function(t){ return taskLine(t,true); }).join('')+(r.late.concat(r.dueToday).length>1?'<div class="nxa-act"><button class="nx-sbtn" onclick="nxjAllTomorrow()">↪ Tout reporter à demain</button></div>':''));
      var dem=r.evTomorrow.map(evLine).join('')+r.dueTomorrow.map(function(t){ return taskLine(t,false); }).join('');
      html+=block('📅 Demain', dem||'<div class="nxj-sub">Rien de prévu pour l\'instant.</div>');
      html+='<div class="card nxj-card"><h2>🧠 Vide ta tête</h2><div class="nxj-sub" style="margin-bottom:8px">Tout ce qui te trotte dans la tête : dicte-le, c\'est enregistré pour demain. Ensuite, tu décroches.</div>'+
        '<textarea id="nxjBrain" rows="3" class="nxj-ta" placeholder="Ex : commander 2 supports, rappeler M. Petit, vérifier la charge chez Biocoop…"></textarea>'+
        '<div class="nxa-act"><button class="btn-pri" onclick="nxjBrain()">Enregistrer pour demain</button></div></div>';
      html+='<div class="nxj-bye">👋 Tout est noté. Tu peux décrocher.</div>';
    }
    host.innerHTML=html;
  }
  window.nxjRender=render;
  window.nxjMode=function(m){ MODE=m; render(); };
  window.nxjDone=function(id){ try{ window.nxToggleTask(id); }catch(e){} toastX('✔ Fait','ok'); setTimeout(render,60); };
  window.nxjTomorrow=function(id){ if(window.nxUpdateTask && window.nxUpdateTask(id,{due:iso(addDays(new Date(),1))})){ toastX('↪ Reporté à demain','ok'); render(); } };
  window.nxjAllTomorrow=function(){ var r=collect(), t=iso(addDays(new Date(),1)); r.late.concat(r.dueToday).forEach(function(x){ try{ window.nxUpdateTask(x.id,{due:t}); }catch(e){} }); toastX('↪ Tout est reporté à demain','ok'); render(); };
  window.nxjBrain=function(){
    var ta=document.getElementById('nxjBrain'); if(!ta) return;
    var lines=ta.value.split(/\n|;|(?:\s+-\s+)/).map(function(x){ return x.trim(); }).filter(Boolean);
    if(!lines.length){ toastX('Écris ou dicte d\'abord','warn'); return; }
    var n=0, tmr=iso(addDays(new Date(),1));
    lines.forEach(function(l){
      var o=window.nxaParseNote?window.nxaParseNote(l):{title:l,priority:'medium',cat:'Autre'};
      if(!o.due) o.due=tmr; o.link='Vide ta tête';
      if(window.nxaAddTask && window.nxaAddTask(o)) n++;
    });
    ta.value=''; toastX('🧠 '+n+' note'+(n>1?'s':'')+' enregistrée'+(n>1?'s':'')+' pour demain','ok'); render();
  };

  var CSS='.nxj-hero{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#121417;color:#fff;border-radius:16px;padding:16px 18px;margin-bottom:12px}'+
    '.nxj-hello{font-size:20px;font-weight:800}.nxj-date{opacity:.85;font-size:13px;margin-top:2px}'+
    '.nxj-switch{display:flex;background:rgba(255,255,255,.15);border-radius:10px;padding:3px}.nxj-switch button{border:0;background:none;color:#fff;font-weight:700;padding:7px 12px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px}.nxj-switch button.on{background:#fff;color:#121417}'+
    '.nxj-sum{font-size:15px;font-weight:600;margin:4px 2px 12px;color:var(--ink,#16263a)}'+
    '.nxj-card h2{font-size:15px;margin:0 0 8px}.nxj-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line,#edf1f5)}.nxj-row:last-child{border-bottom:0}'+
    '.nxj-ic{font-size:20px;width:28px;text-align:center}.nxj-main{flex:1;min-width:0;cursor:pointer}.nxj-sub{font-size:12px;color:var(--muted,#6b7a90)}.nxj-late{color:#b03a2e;font-weight:700}'+
    '.nxj-chk{position:relative;width:26px;height:26px;flex:none}.nxj-chk input{position:absolute;opacity:0;width:26px;height:26px;margin:0;cursor:pointer}.nxj-chk span{display:block;width:22px;height:22px;border:2px solid #9fb3c8;border-radius:7px;margin:2px}.nxj-chk input:checked+span{background:#1e7a4c;border-color:#1e7a4c}'+
    '.nxj-chips{display:flex;flex-direction:column;gap:8px}.nxj-chip{display:block;text-align:left;border:1px solid var(--line,#dde4ec);background:#fff;border-radius:12px;padding:11px 13px;font:inherit;font-size:14px;cursor:pointer}.nxj-chip b{color:#121417;font-size:16px;margin-right:4px}.nxj-chip.hot{border-color:#f0c9a8;background:#fff8f1}.nxj-chip.hot b{color:#b05a00}'+
    '.nxj-done{padding:6px 0;font-size:14px;border-bottom:1px dashed var(--line,#edf1f5)}.nxj-ta{width:100%;box-sizing:border-box;border:2px solid var(--line2,#cfd8e3);border-radius:10px;padding:10px;font:inherit;font-size:15px}'+
    '#nxJournee{padding-bottom:70px}.nxj-zen{text-align:center;font-size:15px;padding:22px}.nxj-bye{text-align:center;color:var(--muted,#6b7a90);margin:10px 0 24px;font-size:14px}';

  function boot(tries){
    tries=tries||0;
    var nav=document.getElementById('nav');
    if(!nav || !nav.querySelector('.nx-nav-section') || typeof planEvents!=='function'){ if(tries<40) setTimeout(function(){ boot(tries+1); },150); return; }
    try{
      if(!document.getElementById('nxjStyle')){ var st=document.createElement('style'); st.id='nxjStyle'; st.textContent=CSS; document.head.appendChild(st); }
      if(typeof TITLES!=='undefined') TITLES.nx_journee=['Ma journée','Ce que tu as à faire, et le bilan du soir.'];
      if(!nav.querySelector('a[data-v="nx_journee"]')){
        var host=nav.querySelector('.nx-nav-section[data-section="home"] .nx-nav-body')||nav;
        var a=document.createElement('a'); a.setAttribute('data-v','nx_journee'); a.innerHTML='<span class="ico">☀️</span><span class="txt">Ma journée</span>';
        host.insertBefore(a, host.firstChild);
      }
      if(!document.getElementById('v-nx_journee')){
        var dash=document.getElementById('v-dash'), parent=dash?dash.parentNode:document.querySelector('.content');
        if(parent){ var sec=document.createElement('section'); sec.className='view'; sec.id='v-nx_journee'; sec.innerHTML='<div id="nxJournee"></div>'; parent.appendChild(sec); }
      }
      var _go=window.go;
      window.go=function(v){ var r=_go.apply(this,arguments); try{ if(v==='nx_journee'){ render();
        document.querySelectorAll('.nx-nav-section').forEach(function(s){ var open=s.dataset.section==='home'; s.classList.toggle('open',open); }); } }catch(e){} return r; };
      /* écran d'accueil : on ouvre « Ma journée » au lancement si l'utilisateur n'a encore rien touché */
      var touched=false; document.addEventListener('click',function(){ touched=true; },{once:true,capture:true});
      setTimeout(function(){ try{ var v=window._curView; if(!touched && (v==='dash'||v==='nx_cockpit'||!v)) window.go('nx_journee'); }catch(e){} },1400);
      document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible' && window._curView==='nx_journee') render(); });
    }catch(e){ try{ console.error('ClimPilot next-journee',e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);
})();
