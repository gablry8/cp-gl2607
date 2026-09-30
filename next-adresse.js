/* ============================================================
   ClimPilot Next — next-adresse.js  (couche additive, 30/09/2026)
   Adresses, distances et planning lisible.
   - Adresse du chantier : suggestions pendant la frappe (Base Adresse
     Nationale, service public IGN Géoplateforme, gratuit, sans clé) dans
     le devis, le bon d'intervention, la location et la fiche client ;
     un choix remplit l'adresse ET la ville.
   - Distance et temps de route depuis ton domicile (par défaut :
     12 rue de l'Hostellerie, 60140 Bailleval — modifiable dans
     Paramètres) via le calcul d'itinéraire IGN ; si le service ne répond
     pas : distance à vol d'oiseau × 1,3, affichée « ≈ estimée ».
   - La zone de déplacement du devis se règle toute seule d'après les km
     (toujours modifiable à la main).
   - Planning : chaque chantier affiche le client, l'adresse, la distance,
     le téléphone, la note client et une note de chantier modifiable ;
     les visites techniques datées apparaissent aussi. Sur téléphone, le
     planning s'affiche en liste jour par jour.
   Les coordonnées et distances sont gardées en cache (synchronisé).
   ============================================================ */
(function(){
  'use strict';
  var HOMEK='cpnext_home', GEOK='cpnext_geo';
  var HOME_DEF={adr:'12 Rue de l\'Hostellerie 60140 Bailleval',lon:2.447507,lat:49.350006};
  var GEO_URL='https://data.geopf.fr/geocodage/search', ROUTE_URL='https://data.geopf.fr/navigation/itineraire';
  try{ [HOMEK,GEOK].forEach(function(k){ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(k)<0) SYNC_KEYS.push(k); }); }catch(e){}

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function lsGet(k,fb){ try{ var v=localStorage.getItem(k); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
  function persist(k,v){ try{ if(typeof save==='function') save(k,v); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } }
  function say(m){ try{ toast(m); }catch(e){} }
  function fq(n){ try{ return fmtQ(n); }catch(e){ return String(Math.round(n*10)/10).replace('.',','); } }
  function home(){ var h=lsGet(HOMEK,null); return (h&&h.lat&&h.lon)?h:HOME_DEF; }
  window.nxadHome=home;

  /* ---------------- géocodage & itinéraire ---------------- */
  var GEO=lsGet(GEOK,{})||{};
  function saveGeo(){ var ks=Object.keys(GEO); if(ks.length>400){ ks.sort(function(a,b){ return (GEO[a].ts||0)-(GEO[b].ts||0); }).slice(0,ks.length-400).forEach(function(k){ delete GEO[k]; }); } persist(GEOK,GEO); }
  function key(adr){ return norm(adr).slice(0,160); }
  function fetchJSON(url,ms){
    return new Promise(function(res,rej){
      var done=false, t=setTimeout(function(){ if(!done){ done=true; rej(new Error('délai dépassé')); } },ms||8000);
      fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
        .then(function(j){ if(!done){ done=true; clearTimeout(t); res(j); } })
        .catch(function(e){ if(!done){ done=true; clearTimeout(t); rej(e); } });
    });
  }
  function suggest(q){
    return fetchJSON(GEO_URL+'?q='+encodeURIComponent(q)+'&limit=6&autocomplete=1&index=address',6000).then(function(j){
      return (j.features||[]).map(function(f){ var p=f.properties||{}, c=(f.geometry||{}).coordinates||[];
        return {label:p.label||'',name:p.name||'',postcode:p.postcode||'',city:p.city||'',context:p.context||'',type:p.type||'',score:p.score||0,lon:c[0],lat:c[1]}; });
    });
  }
  function geocode(adr){
    var k=key(adr); if(!k) return Promise.reject(new Error('adresse vide'));
    if(GEO[k]&&GEO[k].lat) return Promise.resolve(GEO[k]);
    return fetchJSON(GEO_URL+'?q='+encodeURIComponent(adr)+'&limit=1',7000).then(function(j){
      var f=(j.features||[])[0]; if(!f||(f.properties&&f.properties.score<0.45)) throw new Error('adresse introuvable');
      var c=f.geometry.coordinates; GEO[k]={lon:c[0],lat:c[1],label:f.properties.label,ts:Date.now()}; saveGeo(); return GEO[k];
    });
  }
  function hav(a,b){ var R=6371, t=Math.PI/180, dLa=(b.lat-a.lat)*t, dLo=(b.lon-a.lon)*t, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*R*Math.asin(Math.sqrt(x)); }
  function route(g){
    var h=home(), hk=key(h.adr);
    if(g.route&&g.route.from===hk) return Promise.resolve(g.route);
    var url=ROUTE_URL+'?resource=bdtopo-osrm&profile=car&optimization=fastest&getSteps=false&geometryFormat=polyline&distanceUnit=kilometer&timeUnit=minute&start='+h.lon+','+h.lat+'&end='+g.lon+','+g.lat;
    return fetchJSON(url,9000).then(function(j){
      var km=num(j.distance), mn=num(j.duration); if(!(km>0)) throw new Error('itinéraire vide');
      g.route={from:hk,km:Math.round(km*10)/10,min:Math.round(mn),est:false}; g.ts=Date.now(); saveGeo(); return g.route;
    }).catch(function(){
      var km=hav(h,g)*1.3; return {from:hk,km:Math.round(km),min:Math.round(km/70*60+5),est:true}; /* non mis en cache : on réessaiera */
    });
  }
  /* distance d'une adresse complète depuis le domicile → {km,min,est,label} */
  function distance(adr){ return geocode(adr).then(function(g){ return route(g).then(function(r){ return {km:r.km,min:r.min,est:r.est,label:g.label}; }); }); }
  function cachedDist(adr){ var g=GEO[key(adr)]; if(g&&g.route&&g.route.from===key(home().adr)) return {km:g.route.km,min:g.route.min,est:false,label:g.label}; return null; }
  window.nxadDistance=distance; window.nxadCached=cachedDist;
  function fmtDur(m){ m=Math.round(m||0); return m<60?m+' min':Math.floor(m/60)+' h '+('0'+(m%60)).slice(-2); }
  function distTxt(r){ return (r.est?'≈ ':'')+fq(r.km)+' km · '+fmtDur(r.min)+(r.est?' (estimé)':''); }
  window.nxadDistTxt=distTxt;

  /* ---------------- zones ---------------- */
  function bucket(km,opts){
    /* opts : valeurs des options (ex. « 0-10 km », « +60 km ») */
    var best=null;
    opts.forEach(function(o){ var m=/(\d+)\s*-\s*(\d+)/.exec(o); if(m&&km>=num(m[1])&&km<num(m[2])+0.0001) best=best||o; });
    if(best) return best;
    var plus=opts.map(function(o){ var m=/^\+\s*(\d+)/.exec(o); return m?{o:o,v:num(m[1])}:null; }).filter(Boolean).sort(function(a,b){ return b.v-a.v; });
    for(var i=0;i<plus.length;i++) if(km>=plus[i].v) return plus[i].o;
    return null;
  }

  /* ---------------- champs adresse : liste de suggestions ---------------- */
  var LEGACY={f_cAdr:'f_cVille',dp_cAdr:'dp_cVille',lc_adr:'lc_ville',mc_adr:'mc_ville'};
  var ZONESEL={f_cAdr:'f_zone',dp_cAdr:'dp_zone',lc_adr:'lc_zone'};
  function isAddr(el){ return el&&el.tagName==='INPUT'&&(el.dataset.addr==='1'||LEGACY[el.id]); }
  function villeFor(el){
    if(LEGACY[el.id]) return document.getElementById(LEGACY[el.id]);
    var f=el.closest('.frm')||el.closest('.card')||document; return f.querySelector('[data-k="$.cVille"]');
  }
  var dd=null, ddFor=null, timer=null, seq=0;
  function closeDD(){ if(dd&&dd.parentNode) dd.parentNode.removeChild(dd); dd=null; ddFor=null; }
  function renderDD(el,items,msg){
    if(!dd){ dd=document.createElement('div'); dd.className='nxcp-dd';
      dd.addEventListener('pointerdown',function(e){ e.preventDefault(); }); dd.addEventListener('mousedown',function(e){ e.preventDefault(); });
      dd.addEventListener('click',function(e){ var b=e.target.closest('.nxcp-it'); if(!b||!dd||!dd._items) return; pickAddr(ddFor,dd._items[+b.dataset.i]); }); }
    dd._items=items;
    dd.innerHTML=msg?'<div class="nxcp-new">'+esc(msg)+'</div>':items.map(function(it,i){ return '<button type="button" class="nxcp-it" data-i="'+i+'"><b>'+esc(it.name||it.label)+'</b><small>'+esc([it.postcode,it.city].filter(Boolean).join(' ')+(it.context?' — '+it.context.split(',').slice(1).join(',').trim():''))+'</small></button>'; }).join('');
    var host=el.parentNode; host.classList.add('nxcp-wrap'); if(dd.parentNode!==host) host.insertBefore(dd,el.nextSibling); ddFor=el;
  }
  function onType(el){
    clearTimeout(timer); var q=el.value.trim();
    if(q.length<4){ closeDD(); return; }
    var v=villeFor(el), full=q+(v&&v.value&&q.toLowerCase().indexOf(v.value.toLowerCase())<0&&!/\d{5}/.test(q)?' '+v.value:'');
    timer=setTimeout(function(){
      var my=++seq;
      suggest(full).then(function(items){ if(my!==seq||document.activeElement!==el) return; if(!items.length) renderDD(el,[], 'Aucune adresse trouvée — tape le numéro, la rue et la ville'); else renderDD(el,items); })
        .catch(function(){ if(my===seq&&document.activeElement===el) renderDD(el,[], 'Suggestions indisponibles (pas de réseau ?) — tu peux taper l\'adresse à la main'); });
    },320);
  }
  function fire(el){ try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} }
  function pickAddr(el,it){
    closeDD();
    var v=villeFor(el);
    el.value=it.type==='municipality'?'':(it.name||it.label);
    var ville=[it.postcode,it.city].filter(Boolean).join(' ');
    var k=key((el.value?el.value+' ':'')+ville);
    GEO[k]={lon:it.lon,lat:it.lat,label:it.label,ts:Date.now()}; saveGeo();
    /* le devis se redessine au changement de ville : on écrit l'adresse d'abord, la ville ensuite */
    fire(el);
    var v2=v&&document.contains(v)?v:villeFor(document.querySelector('[data-k="$.cAdr"]')||el);
    if(v2){ v2.value=ville; fire(v2); }
    afterAddress(el.id||'$.cAdr',(el.value?el.value+' ':'')+ville);
  }
  function bindAddr(){
    document.addEventListener('input',function(e){ if(isAddr(e.target)) onType(e.target); },true);
    document.addEventListener('focusin',function(e){ if(isAddr(e.target)){ e.target.setAttribute('autocomplete','off'); } },true);
    document.addEventListener('focusout',function(e){ if(e.target===ddFor) setTimeout(function(){ if(document.activeElement!==ddFor) closeDD(); },200); },true);
    /* adresse tapée à la main puis quitte le champ ville → on calcule quand même la distance */
    document.addEventListener('change',function(e){
      var el=e.target; if(!el||el.tagName!=='INPUT') return;
      var id=el.id, isV=/^(f_cVille|dp_cVille|lc_ville)$/.test(id)||el.dataset.k==='$.cVille';
      if(!isV) return;
      var a=null; if(id==='f_cVille') a='f_cAdr'; else if(id==='dp_cVille') a='dp_cAdr'; else if(id==='lc_ville') a='lc_adr';
      var ae=a?document.getElementById(a):document.querySelector('[data-k="$.cAdr"]');
      setTimeout(function(){ afterAddress(a||'$.cAdr',[(ae&&ae.value)||'',el.value].join(' ').trim()); },50);
    });
  }

  /* ---------------- après une adresse : distance + zone ---------------- */
  function boxFor(src){
    if(src==='$.cAdr') return document.getElementById('nxadDist');
    var id='nxadDist_'+src, b=document.getElementById(id);
    if(!b){ var ref=document.getElementById(LEGACY[src]); if(!ref) return null; var lab=ref.closest('label')||ref; b=document.createElement('div'); b.id=id; b.className='full'; b.style.cssText='grid-column:1/-1'; lab.parentNode.insertBefore(b,lab.nextSibling); }
    return b;
  }
  function showBox(src,html){ var b=boxFor(src); if(b) b.innerHTML=html; }
  function mapsLink(adr){ try{ return mapsUrl(adr); }catch(e){ return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(adr); } }
  var lastAA={k:'',t:0};
  function afterAddress(src,adr){
    adr=String(adr||'').trim(); if(adr.length<5) return;
    var kk=src+'|'+key(adr); if(lastAA.k===kk&&Date.now()-lastAA.t<2000) return; lastAA={k:kk,t:Date.now()};
    showBox(src,'<div class="nxd2-hint">📍 Calcul de la distance depuis chez toi…</div>');
    distance(adr).then(function(r){
      var h='<div class="nxad-dist">📍 <b>'+esc(distTxt(r))+'</b> depuis '+esc(home().adr.split(' ').slice(-1)[0])+' (aller) · <a href="'+esc(mapsLink(adr))+'" target="_blank" rel="noopener">itinéraire</a></div>';
      showBox(src,h);
      applyZone(src,r);
    }).catch(function(e){ showBox(src,'<div class="nxd2-warn">Distance non calculée : '+esc(e.message||'erreur')+'. Vérifie l\'adresse (numéro, rue, ville).</div>'); });
  }
  function applyZone(src,r){
    var km=r.km;
    if(src==='$.cAdr'){
      var d=null; try{ d=NXD2.api.cur(); }catch(e){}
      if(!d||d.v!==2) return;
      var opts=['0-10 km','10-20 km','20-30 km','30-40 km','40-50 km','50-60 km','+60 km'], z=bucket(km,opts)||'+60 km';
      var ch=d.zone!==z||(z==='+60 km'&&num(d.km)!==Math.round(km));
      d.distAuto={km:km,min:r.min,est:!!r.est};
      if(ch){ d.zone=z; if(z==='+60 km') d.km=Math.round(km); try{ NXD2.api.markDirty(); NXD2.api.rerender('tab'); }catch(e){} say('Déplacement réglé : '+z+(z==='+60 km'?' ('+Math.round(km)+' km)':'')+' — '+fq(km)+' km depuis chez toi'); setTimeout(function(){ afterAddressQuiet(r); },30); }
      return;
    }
    var sel=document.getElementById(ZONESEL[src]); if(!sel) return;
    var vals=[].map.call(sel.options,function(o){ return o.value||o.textContent; }), z2=bucket(km,vals);
    if(z2&&sel.value!==z2){ sel.value=z2; try{ sel.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} say('Zone de déplacement : '+z2+' ('+fq(km)+' km)'); }
  }
  function afterAddressQuiet(r){ var b=document.getElementById('nxadDist'); if(b&&!b.innerHTML) b.innerHTML='<div class="nxad-dist">📍 <b>'+esc(distTxt(r))+'</b> depuis chez toi (aller)</div>'; }
  /* à l'ouverture de l'onglet client d'un devis : ré-affiche la distance mémorisée */
  function refreshDevisBox(){
    var b=document.getElementById('nxadDist'); if(!b||b.innerHTML) return;
    var d=null; try{ d=NXD2.api.cur(); }catch(e){} if(!d) return;
    var adr=[d.cAdr,d.cVille].filter(Boolean).join(' ').trim(); if(adr.length<5) return;
    var c=cachedDist(adr); if(c) b.innerHTML='<div class="nxad-dist">📍 <b>'+esc(distTxt(c))+'</b> depuis chez toi (aller) · <a href="'+esc(mapsLink(adr))+'" target="_blank" rel="noopener">itinéraire</a></div>';
    else if(d.distAuto) b.innerHTML='<div class="nxad-dist">📍 <b>'+esc(distTxt(d.distAuto))+'</b> depuis chez toi (aller)</div>';
    else b.innerHTML='<button type="button" class="btn-ghost btn-sm" onclick="nxadCalcDevis()">📍 Calculer la distance depuis chez moi</button>';
  }
  window.nxadCalcDevis=function(){ var d=null; try{ d=NXD2.api.cur(); }catch(e){} if(!d) return; afterAddress('$.cAdr',[d.cAdr,d.cVille].filter(Boolean).join(' ')); };

  /* ---------------- paramètres : domicile ---------------- */
  function paramsCard(){
    var v=document.getElementById('v-params'); if(!v||document.getElementById('nxadHomeCard')) return;
    var c=document.createElement('div'); c.className='card'; c.id='nxadHomeCard';
    c.innerHTML='<h2>🏠 Point de départ des trajets</h2><div class="frm"><label class="full">Adresse (domicile / dépôt)<input id="nxad_home" data-home="1" autocomplete="off" value="'+esc(home().adr)+'"></label></div>'+
      '<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxadSaveHome()">Enregistrer</button><span class="sub" id="nxadHomeMsg"></span></div>'+
      '<div class="sub" style="margin-top:6px">Sert au calcul des distances (devis, interventions, planning). Service d\'adresses et d\'itinéraire de l\'IGN (gratuit, public).</div>';
    v.insertBefore(c,v.firstChild);
  }
  window.nxadSaveHome=function(){
    var el=document.getElementById('nxad_home'), q=(el&&el.value||'').trim(), msg=document.getElementById('nxadHomeMsg'); if(!q) return;
    if(msg) msg.textContent='Recherche…';
    fetchJSON(GEO_URL+'?q='+encodeURIComponent(q)+'&limit=1',7000).then(function(j){
      var f=(j.features||[])[0]; if(!f) throw new Error('adresse introuvable');
      var h={adr:f.properties.label,lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}; persist(HOMEK,h);
      if(el) el.value=h.adr; if(msg) msg.textContent='✔ '+h.adr; say('Point de départ enregistré');
    }).catch(function(e){ if(msg) msg.textContent='⚠ '+(e.message||'erreur'); });
  };

  /* ---------------- planning ---------------- */
  function srcOf(ev){
    var m=/(openDevis|openDep|openLoc)\('([^']+)'\)/.exec(ev.click||''); if(!m) return null;
    try{ if(m[1]==='openDevis') return {kind:'devis',o:(DEVIS||[]).find(function(x){ return x.id===m[2]; })};
      if(m[1]==='openDep') return {kind:'dep',o:(DEP||[]).find(function(x){ return x.id===m[2]; })};
      return {kind:'loc',o:(LOC||[]).find(function(x){ return x.id===m[2]; })}; }catch(e){ return null; }
  }
  function clientOf(name){ try{ var n=norm(name); return n?(CLIENTS||[]).find(function(c){ return norm(c.nom)===n; }):null; }catch(e){ return null; } }
  function wrapPlan(){
    if(typeof window.planEvents!=='function'||window.planEvents._nxad) return;
    var o=window.planEvents;
    window.planEvents=function(off){
      var r=o.apply(this,arguments);
      try{
        var ws=r.ws, dISO_=function(dt){ try{ return dISO(dt); }catch(e){ return dt.toISOString().slice(0,10); } };
        /* visites techniques datées (devis non refusés) */
        for(var i=0;i<7;i++){ var day=new Date(ws); day.setDate(ws.getDate()+i); var iso=dISO_(day);
          (DEVIS||[]).forEach(function(d){ var vd=d.visite&&d.visite.date; if(!vd||d.statut==='refuse') return; var vi=window.nxToISO?nxToISO(vd):vd; if(vi!==iso) return;
            r.ev.push({i:i,ic:'📋',lbl:'Visite technique — '+(d.cNom||'?'),sub:(d.num||'')+(d.visite.contact?' · sur place : '+d.visite.contact:''),h:1,adr:[d.cAdr,d.cVille].filter(Boolean).join(', '),click:"openDevis('"+d.id+"')",_visite:true}); }); }
        r.ev.forEach(function(ev){
          var s=srcOf(ev), ob=s&&s.o, cname=ob?ob.cNom:(ev.lbl||'').replace(/^.*— /,'');
          var cl=clientOf(cname);
          ev.client=cname||''; ev.tel=(ob&&ob.cTel)||(cl&&cl.tel)||'';
          ev.noteClient=(cl&&cl.notes)||''; ev.noteChantier=(ob&&(ob.notePlanning||''))||'';
          ev.kind=s?s.kind:''; ev.id=ob?ob.id:'';
          if(ev.adr){ var c=cachedDist(ev.adr); if(c) ev.dist=c; }
        });
      }catch(e){}
      return r;
    };
    window.planEvents._nxad=true;
  }
  var pendingDist={};
  function wantDist(adr){ if(!adr||pendingDist[adr]) return; pendingDist[adr]=1; distance(adr).then(function(){ clearTimeout(wantDist.t); wantDist.t=setTimeout(function(){ try{ if(window._curView==='plan') renderPlanning(); }catch(e){} },400); }).catch(function(){}); }
  function card(e){
    var note=[e.noteChantier?'<div class="nxad-note">📝 '+esc(e.noteChantier)+'</div>':'',e.noteClient?'<div class="nxad-note cl">👤 '+esc(e.noteClient)+'</div>':''].join('');
    if(e.adr&&!e.dist) wantDist(e.adr);
    return '<div class="nxad-ev" onclick="'+esc(e.click)+'">'+
      '<div class="t"><b>'+e.ic+' '+esc(e.lbl)+'</b></div>'+
      (e.sub?'<div class="s">'+esc(e.sub)+'</div>':'')+
      (e.adr?'<div class="a">📍 '+esc(e.adr)+(e.dist?' — <b>'+esc(distTxt(e.dist))+'</b>':'')+'</div>':'<div class="a muted">Adresse non renseignée</div>')+note+
      '<div class="b" onclick="event.stopPropagation()">'+
        (e.adr?'<a class="btn-ghost btn-sm" href="'+esc(mapsLink(e.adr))+'" target="_blank" rel="noopener">🗺️ Itinéraire</a>':'')+
        (e.tel?'<a class="btn-ghost btn-sm" href="tel:'+esc(String(e.tel).replace(/\s/g,''))+'">📞 Appeler</a>':'')+
        (e.id&&(e.kind==='devis'||e.kind==='dep'||e.kind==='loc')?'<button type="button" class="btn-ghost btn-sm" onclick="nxadNote(\''+e.kind+'\',\''+esc(e.id)+'\')">📝 Note</button>':'')+
      '</div></div>';
  }
  window.nxadNote=function(kind,id){
    var arr=kind==='devis'?DEVIS:kind==='dep'?DEP:LOC, o=(arr||[]).find(function(x){ return x.id===id; }); if(!o) return;
    var v=prompt('Note de chantier (accès, code portail, matériel à prévoir…)',o.notePlanning||''); if(v==null) return;
    o.notePlanning=v.trim();
    try{ save(kind==='devis'?LS.devis:kind==='dep'?LS.dep:LS.loc,arr); }catch(e){ try{ var k={devis:'cp2_devis',dep:'cp2_dep',loc:'cp2_loc'}[kind]; save(k,arr); }catch(_){} }
    try{ renderPlanning(); }catch(e){} say('Note enregistrée');
  };
  function wrapRender(){
    if(typeof window.renderPlanning!=='function'||window.renderPlanning._nxad) return;
    var o=window.renderPlanning;
    window.renderPlanning=function(){
      var r=o.apply(this,arguments);
      try{
        var g=document.getElementById('planGrid'); if(!g) return r;
        var pe=planEvents(window.planOff||(typeof planOff!=='undefined'?planOff:0)), ws=pe.ws, today=dISO(new Date());
        var names=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'], mobile=window.innerWidth<760;
        var days=names.map(function(nm,i){ var day=new Date(ws); day.setDate(ws.getDate()+i); var iso=dISO(day); return {i:i,nm:nm,day:day,iso:iso,evs:pe.ev.filter(function(e){ return e.i===i; })}; });
        if(mobile){
          g.innerHTML='<div class="nxad-list">'+days.map(function(D){
            if(!D.evs.length&&D.iso!==today&&D.i>4) return '';
            if(!D.evs.length) return '<div class="nxad-day nxad-free'+(D.iso===today?' today':'')+'"><div class="h">'+D.nm+' '+D.day.getDate()+(D.iso===today?' · aujourd\'hui':'')+' — <span>rien de prévu</span></div></div>';
            return '<div class="nxad-day'+(D.iso===today?' today':'')+'"><div class="h">'+D.nm+' '+D.day.getDate()+' '+D.day.toLocaleDateString('fr-FR',{month:'short'})+(D.iso===today?' · aujourd\'hui':'')+'</div>'+
              (D.evs.length?D.evs.map(card).join(''):'<div class="nxad-empty">Rien de prévu</div>')+'</div>';
          }).join('')+'</div>';
        } else {
          g.innerHTML='<div class="nxad-grid">'+days.map(function(D){
            return '<div class="nxad-day'+(D.iso===today?' today':'')+'"><div class="h">'+D.nm+' '+D.day.getDate()+'</div>'+(D.evs.length?D.evs.map(card).join(''):'')+'</div>';
          }).join('')+'</div>';
        }
      }catch(e){ try{ console.error('nxad plan',e); }catch(_){} }
      return r;
    };
    window.renderPlanning._nxad=true;
  }

  var CSS=
    '.nxad-dist{font-size:13.5px;background:var(--blue-soft,#eef3fa);border-radius:8px;padding:8px 10px;margin-top:8px}'+
    '.nxad-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}'+
    '.nxad-list{display:flex;flex-direction:column;gap:10px}'+
    '.nxad-day{border:1px solid var(--line,#e3e8ef);border-radius:10px;padding:8px;background:var(--bg,#f6f8fb);min-height:80px}'+
    '.nxad-day.today{background:var(--blue-soft,#eef3fa);border-color:var(--blue,#1f4e79)}'+
    '.nxad-day .h{font-size:12px;font-weight:700;color:var(--muted,#64748b);text-transform:capitalize}.nxad-day.today .h{color:var(--blue,#1f4e79)}'+
    '.nxad-ev{cursor:pointer;background:var(--panel,#fff);border:1px solid var(--line2,#cfd8e3);border-radius:9px;padding:8px 9px;margin-top:7px;font-size:12.5px;line-height:1.35}'+
    '.nxad-ev .s{color:var(--muted,#64748b);font-size:11.5px;margin-top:2px}.nxad-ev .a{margin-top:4px;font-size:12px}.nxad-ev .a.muted{color:var(--muted,#64748b);font-style:italic}'+
    '.nxad-note{margin-top:4px;font-size:12px;background:#fff8e6;border-radius:6px;padding:4px 6px}.nxad-note.cl{background:#f1f5f9}'+
    '.nxad-ev .b{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.nxad-ev .b .btn-sm{padding:5px 9px;font-size:12px;text-decoration:none}'+
    '.nxad-day.nxad-free{min-height:0;padding:7px 9px}.nxad-free .h span{font-weight:400}'+'.nxad-empty{font-size:12px;color:var(--muted,#64748b);margin-top:6px}'+
    '@media(max-width:1200px){.nxad-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}}';

  function boot(tries){
    tries=tries||0;
    if(typeof window.planEvents!=='function'||typeof window.renderPlanning!=='function'){ if(tries<60) return setTimeout(function(){ boot(tries+1); },150); }
    if(!document.getElementById('nxadStyle')){ var st=document.createElement('style'); st.id='nxadStyle'; st.textContent=CSS; document.head.appendChild(st); }
    wrapPlan(); wrapRender(); bindAddr();
    var og=window.go; if(typeof og==='function'&&!og._nxad){ window.go=function(v){ var r=og.apply(this,arguments); try{ if(v==='params') paramsCard(); }catch(e){} return r; }; window.go._nxad=true; }
    new MutationObserver(function(){ refreshDevisBox(); }).observe(document.body,{childList:true,subtree:true});
  }
  window.nxadTest={bucket:bucket,hav:hav,key:key};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ boot(0); }); else boot(0);
})();
