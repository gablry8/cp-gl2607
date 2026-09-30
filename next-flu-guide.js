/* ============================================================
   ClimPilot Next — next-flu-guide.js  (couche additive, 30/09/2026)
   Fiche fluide (Cerfa 15497*04) en MODE GUIDÉ.
   - 4 étapes dans l'ordre : Équipement → Intervention → Fluide → Vérifier.
   - Seules les cases utiles s'affichent selon tes réponses :
       · pas de récupération → pas de BSFF / code UN / destination ;
       · pas de contrôle d'étanchéité → pas de détecteur ;
       · pas de fuite → pas de localisation de fuite ;
       · PRP / t éq. CO₂ / périodicité seulement pour les fluides fluorés ;
       · mise en service → pas de récupération ; démantèlement → pas de charge.
     Une question « as-tu chargé ? / as-tu récupéré ? » remplace les
     6 cases de quantités quand la réponse est non.
   - Référence machine : tape la référence, ClimPilot retrouve fluide,
     charge et PRP d'après ton parc et tes fiches précédentes (et retient
     chaque nouvelle référence, y compris celles lues sur la plaque).
   - Récap final avec les oublis avant d'enregistrer.
   « Tout afficher » repasse à la fiche complète à tout moment.
   Rien n'est inventé : une référence inconnue se lit sur la plaque.
   ============================================================ */
(function(){
  'use strict';
  var REFK='cpnext_refs', MODEK='cpnext_flu_guide';
  try{ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(REFK)<0) SYNC_KEYS.push(REFK); }catch(e){}
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,''); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function $(id){ return document.getElementById(id); }
  function g(id){ var e=$(id); return e?e.value:''; }
  function sv(id,v){ var e=$(id); if(e){ e.value=(v==null?'':v); } }
  function lsGet(k,fb){ try{ var v=localStorage.getItem(k); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
  function persist(k,v){ try{ if(typeof save==='function') save(k,v); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function say(m){ try{ toast(m); }catch(e){} }
  function fam(fl){ try{ return window.nxcFamille?nxcFamille(fl):''; }catch(e){ return ''; } }
  function guidedPref(){ return lsGet(MODEK,true)!==false; }

  /* ---------------- mémoire des références ---------------- */
  function REFS(){ var r=lsGet(REFK,{}); return (r&&typeof r==='object')?r:{}; }
  function learn(o){
    if(!o||!o.ref) return; var k=norm(o.ref); if(k.length<3) return;
    var r=REFS(), e=r[k]||{};
    ['ref','marque','type','fluide','charge','prp'].forEach(function(f){ if(o[f]!=null&&o[f]!==''&&o[f]!==0) e[f]=o[f]; });
    e.ts=Date.now(); e.n=(e.n||0)+1; r[k]=e;
    var ks=Object.keys(r); if(ks.length>600){ ks.sort(function(a,b){ return (r[a].ts||0)-(r[b].ts||0); }).slice(0,ks.length-600).forEach(function(x){ delete r[x]; }); }
    persist(REFK,r);
  }
  function candidates(q){
    var n=norm(q); if(n.length<2) return [];
    var out={}, add=function(o,src){ if(!o.ref) return; var k=norm(o.ref); if(k.indexOf(n)<0&&norm((o.marque||'')+o.ref).indexOf(n)<0) return; var e=out[k]||(out[k]={ref:o.ref,src:src}); ['marque','type','fluide','charge','prp'].forEach(function(f){ if(!e[f]&&o[f]) e[f]=o[f]; }); };
    var r=REFS(); Object.keys(r).forEach(function(k){ add(r[k],'fiche'); });
    try{ (EQUIP||[]).forEach(function(e){ add({ref:e.modele,marque:e.marque,type:e.type,fluide:e.fluide!=='Sans'?e.fluide:'',charge:num(e.charge)||'',prp:e.prp||''},'parc'); }); }catch(e){}
    return Object.keys(out).map(function(k){ return out[k]; }).sort(function(a,b){ return (norm(a.ref).indexOf(n)===0?0:1)-(norm(b.ref).indexOf(n)===0?0:1); }).slice(0,6);
  }
  function setFluide(fl){
    var s=$('fl_fluide'); if(!s||!fl) return;
    var ok=[].some.call(s.options,function(o){ return (o.value||o.textContent).toUpperCase()===String(fl).toUpperCase(); });
    if(!ok){ var o=document.createElement('option'); o.textContent=fl; s.insertBefore(o,s.lastElementChild); }
    [].forEach.call(s.options,function(o){ if((o.value||o.textContent).toUpperCase()===String(fl).toUpperCase()) s.value=o.value||o.textContent; });
  }
  function applyRef(c){
    sv('nxfg_ref',c.ref);
    var desc=[c.type,c.marque,c.ref].filter(Boolean).join(' ');
    if(!g('fl_desc').trim()) sv('fl_desc',desc); else if(norm(g('fl_desc')).indexOf(norm(c.ref))<0) sv('fl_desc',g('fl_desc').trim()+' — '+c.ref);
    if(c.fluide) setFluide(c.fluide);
    if(num(c.charge)>0) sv('fl_charge',c.charge);
    if(num(c.prp)>0) sv('fl_prg',c.prp);
    try{ nxcCalc(); }catch(e){}
    refresh();
    say('Référence '+c.ref+' : '+[c.fluide,num(c.charge)?c.charge+' kg':'',num(c.prp)?'PRP '+c.prp:''].filter(Boolean).join(' · ')+' — vérifie avec la plaque');
  }
  function refDD(){
    var el=$('nxfg_ref'), box=$('nxfgRefDD'); if(!el||!box) return;
    var q=el.value.trim(), list=candidates(q);
    if(q.length<2){ box.innerHTML=''; return; }
    if(!list.length){ box.innerHTML='<div class="nxfg-hint">Référence inconnue dans ton parc et tes fiches : <button type="button" class="nx-sbtn mar" onclick="nxcScanPlate()">📷 Lis la plaque</button> — elle sera retenue pour la prochaine fois.</div>'; return; }
    box.innerHTML='<div class="nxcp-dd" style="position:static;margin-top:4px">'+list.map(function(c,i){ return '<button type="button" class="nxcp-it" data-i="'+i+'"><b>'+esc(c.ref)+'</b><small>'+esc([c.marque,c.type,c.fluide,num(c.charge)?c.charge+' kg':'',num(c.prp)?'PRP '+c.prp:''].filter(Boolean).join(' · '))+' — '+(c.src==='parc'?'ton parc':'fiche précédente')+'</small></button>'; }).join('')+'</div>';
    box._list=list;
  }

  /* ---------------- structure guidée ---------------- */
  var ST={on:true,step:0,charge:null,recup:null};
  var STEPS=['Équipement','Intervention','Fluide','Vérifier'];
  function ctrlDone(){ return g('fl_ctrl')&&g('fl_ctrl')!=='na'; }
  function fuite(){ return /^fuite/.test(g('fl_ctrl')); }
  function nature(){ return g('fl_nature'); }
  function isFluo(){ var f=fam(g('fl_fluide')); return f==='HFC'||f==='HFO'||f==='HCFC'||(!f&&g('fl_fluide')==='Autre'); }
  function chargeQ(){ return nature()!=='demantelement'; }
  function recupQ(){ return nature()!=='mes'&&nature()!=='assemblage'; }
  function recupYes(){ return recupQ()&&ST.recup===true; }
  function chargeYes(){ return chargeQ()&&ST.charge===true; }
  var SHOW={
    0:{fl_date:1,fl_client:1,fl_equip:1,nxfg_ref:1,fl_desc:1,fl_fluide:1,fl_charge:1,fl_ident:1},
    1:{fl_nature:1,fl_natautre:function(){ return nature()==='autre'; },fl_ctrl:1,fl_fuiteloc:fuite,fl_det:ctrlDone,fl_detdate:function(){ return ctrlDone()&&g('fl_det')!==''; },
       fl_sysperm:ctrlDone,fl_perio:function(){ return isFluo(); }},
    2:{nxfg_qc:chargeQ,fl_qv:chargeYes,fl_qrec:chargeYes,fl_qreg:chargeYes,nxfg_qr:recupQ,fl_qrt:recupYes,fl_qru:recupYes,fl_bout:recupYes,
       fl_bsff:function(){ return recupYes()&&num(g('fl_qrt'))>0; },fl_un:function(){ return recupYes()&&num(g('fl_qrt'))>0; },fl_dest:function(){ return recupYes()&&num(g('fl_qrt'))>0; },
       fl_prg:isFluo,fl_teq:isFluo},
    3:{fl_obs:1}
  };
  function vis(step,id){ var r=(SHOW[step]||{})[id]; return typeof r==='function'?!!r():!!r; }
  function ctlOf(lab){ var c=lab.querySelector('input[id],select[id],textarea[id],[data-fg]'); return c?(c.id||c.dataset.fg):''; }

  function inject(){
    var m=$('mFlu'); if(!m) return false;
    var bd=m.querySelector('.bd'); if(!bd) return false;
    if(!$('nxfgBar')){
      var bar=document.createElement('div'); bar.id='nxfgBar'; bd.insertBefore(bar,bd.firstChild);
    }
    if(!$('nxfg_ref')){
      var dl=$('fl_desc'), lab=dl&&dl.closest('label');
      if(lab){ var l2=document.createElement('label'); l2.className='full';
        l2.innerHTML='Référence / modèle de la machine <span class="note-inline">fluide, charge et PRP retrouvés tout seuls</span><input id="nxfg_ref" autocomplete="off" placeholder="Ex : AR09TXFYAWKNEU"><div id="nxfgRefDD"></div>';
        lab.parentNode.insertBefore(l2,lab);
        $('nxfg_ref').addEventListener('input',refDD);
        $('nxfgRefDD').addEventListener('pointerdown',function(e){ if(e.target.closest('.nxcp-it')) e.preventDefault(); });
        $('nxfgRefDD').addEventListener('click',function(e){ var b=e.target.closest('.nxcp-it'), box=$('nxfgRefDD'); if(!b||!box._list) return; applyRef(box._list[+b.dataset.i]); box.innerHTML=''; });
      }
    }
    function yn(id,label,key,before){
      if($(id)) return; var ref=$(before), lab=ref&&ref.closest('label'); if(!lab) return;
      var q=document.createElement('label'); q.className='full nxfg-q'; q.innerHTML='<span data-fg="'+id+'" id="'+id+'">'+label+'</span><div class="nxfg-yn"><button type="button" data-v="1">Oui</button><button type="button" data-v="0">Non</button></div>';
      lab.parentNode.insertBefore(q,lab);
      q.addEventListener('click',function(e){ var b=e.target.closest('button[data-v]'); if(!b) return; e.preventDefault(); ST[key]=b.dataset.v==='1';
        if(!ST[key]){ if(key==='charge'){ sv('fl_qv',0); sv('fl_qrec',0); sv('fl_qreg',0); } else { sv('fl_qrt',0); sv('fl_qru',0); } }
        refresh(); });
    }
    yn('nxfg_qc','As-tu chargé du fluide dans l\'équipement ?','charge','fl_qv');
    yn('nxfg_qr','As-tu récupéré du fluide ?','recup','fl_qrt');
    if(!$('nxfgSum')){ var ob=$('fl_obs'), la=ob&&ob.closest('.frm'); if(la){ var sm=document.createElement('div'); sm.id='nxfgSum'; la.parentNode.insertBefore(sm,la); } }
    if(!$('nxfgNav')){ var nv=document.createElement('div'); nv.id='nxfgNav'; bd.appendChild(nv); }
    if(!m._nxfg){ m._nxfg=true;
      m.addEventListener('change',function(e){ if(e.target&&e.target.id!=='nxfg_ref') setTimeout(refresh,0); });
      m.addEventListener('input',function(e){ if(e.target&&/^fl_q/.test(e.target.id)) setTimeout(refreshSum,0); });
    }
    return true;
  }

  function refreshSum(){ var s=$('nxfgSum'); if(s&&ST.on&&ST.step===3) s.innerHTML=summary(); }
  function refresh(){
    var m=$('mFlu'); if(!m||!$('nxfgBar')) return;
    var bd=m.querySelector('.bd');
    var fl=g('fl_fluide'), f=fam(fl);
    $('nxfgBar').innerHTML='<div class="nxfg-top"><div class="nxfg-steps">'+(ST.on?STEPS.map(function(t,i){ return '<button type="button" class="'+(i===ST.step?'on':i<ST.step?'done':'')+'" onclick="nxfgGo('+i+')">'+(i+1)+'. '+t+'</button>'; }).join(''):'<span class="nxfg-hint">Fiche complète (toutes les cases)</span>')+'</div>'+
      '<button type="button" class="nxfg-tog" onclick="nxfgToggle()">'+(ST.on?'Tout afficher':'Mode guidé')+'</button></div>'+
      (ST.on&&ST.step===0?'<button type="button" class="nx-sbtn mar nxfg-scan" onclick="nxcScanPlate()">📷 Photo de la plaque : remplit marque, modèle, fluide, charge, PRP</button>':'')+
      (f==='naturel'&&ST.on&&ST.step===0?'<div class="nxfg-info">'+esc(fl)+' n\'est pas un gaz fluoré : vérifie si la fiche Cerfa est exigée pour cette intervention (elle reste utile pour ta traçabilité).</div>':'');
    [].forEach.call(bd.querySelectorAll('label'),function(lab){
      if(lab.closest('#nxfgBar,#nxfgNav,#nxfgSum')) return;
      var id=ctlOf(lab); if(!id) return;
      lab.classList.toggle('nxfg-hide',ST.on&&!vis(ST.step,id));
    });
    [].forEach.call(bd.querySelectorAll('h3'),function(h){ h.classList.toggle('nxfg-hide',ST.on); });
    var scan=m.querySelector('#nxcCerfa .nxc-bar'); if(scan&&scan.id!=='nxcSignBar') scan.classList.toggle('nxfg-hide',ST.on);
    ['nxcWarn','nxcSignBar'].forEach(function(id){ var e=$(id); if(e) e.classList.toggle('nxfg-hide',ST.on&&ST.step!==3); });
    var nb=m.querySelector('.navbtns'); if(nb) nb.classList.toggle('nxfg-hide',ST.on&&ST.step!==3);
    /* oui / non */
    [['nxfg_qc','charge'],['nxfg_qr','recup']].forEach(function(p){ var q=$(p[0]); if(!q) return; var lab=q.closest('label'); [].forEach.call(lab.querySelectorAll('button[data-v]'),function(b){ b.classList.toggle('on',ST[p[1]]===(b.dataset.v==='1')); }); lab.classList.toggle('nxfg-hide',!ST.on||!vis(ST.step,p[0])); });
    var rf=$('nxfg_ref'); if(rf){ var rl=rf.closest('label'); if(rl) rl.classList.toggle('nxfg-hide',ST.on&&ST.step!==0); }
    var sm=$('nxfgSum'); if(sm){ sm.classList.toggle('nxfg-hide',!ST.on||ST.step!==3); if(ST.on&&ST.step===3) sm.innerHTML=summary(); }
    var nv=$('nxfgNav'); if(nv) nv.innerHTML=ST.on?('<div class="nxfg-nav">'+(ST.step>0?'<button type="button" class="btn-ghost" onclick="nxfgGo('+(ST.step-1)+')">← Précédent</button>':'<button type="button" class="btn-ghost" onclick="closeModal(\'mFlu\')">Annuler</button>')+
      (ST.step<3?'<button type="button" class="btn-pri" onclick="nxfgNext()">Suivant →</button>':'')+'</div><div id="nxfgMsg"></div>'):'';
  }
  function problems(){
    var p=[], bad=[];
    if(!g('fl_client').trim()) bad.push('le client (détenteur)');
    if(!g('fl_desc').trim()) bad.push('l\'équipement (type, marque, modèle)');
    if(!(num(g('fl_charge'))>0)) p.push('Charge nominale non renseignée (lis-la sur la plaque)');
    if(isFluo()&&!(num(g('fl_prg'))>0)) p.push('PRP du fluide absent (sur la plaque) : le tonnage éq. CO₂ ne peut pas être calculé');
    if(ctrlDone()&&g('fl_det')==='') p.push('Contrôle d\'étanchéité fait sans détecteur indiqué');
    if(fuite()&&!g('fl_fuiteloc').trim()) p.push('Fuite constatée : localisation non indiquée');
    if(g('fl_ctrl')==='fuite_nonrep'&&num(g('fl_qv'))+num(g('fl_qrec'))+num(g('fl_qreg'))>0) p.push('Fuite NON réparée avec du fluide chargé : à justifier dans les observations');
    if(chargeYes()&&!(num(g('fl_qv'))+num(g('fl_qrec'))+num(g('fl_qreg'))>0)) p.push('Tu as répondu « chargé » mais aucune quantité n\'est saisie');
    if(recupYes()&&!(num(g('fl_qrt'))+num(g('fl_qru'))>0)) p.push('Tu as répondu « récupéré » mais aucune quantité n\'est saisie');
    if(recupYes()&&num(g('fl_qrt'))>0&&!g('fl_dest').trim()) p.push('Fluide remis pour traitement : installation de destination à indiquer');
    if(recupYes()&&!g('fl_bout').trim()) p.push('N° de bouteille de récupération non indiqué');
    if(chargeQ()&&ST.charge==null) p.push('Question « as-tu chargé du fluide ? » sans réponse');
    if(recupQ()&&ST.recup==null) p.push('Question « as-tu récupéré du fluide ? » sans réponse');
    return {bad:bad,warn:p};
  }
  function summary(){
    var pr=problems(), q=function(id){ return num(g(id)); }, natTxt=($('fl_nature')&&$('fl_nature').selectedOptions[0]||{}).textContent||'';
    var rows=[['Date',window.nxDateFR?nxDateFR(g('fl_date')):g('fl_date')],['Détenteur',g('fl_client')],['Équipement',g('fl_desc')],['Fluide',g('fl_fluide')+(q('fl_charge')?' — '+q('fl_charge')+' kg':'')+(q('fl_prg')?' — PRP '+q('fl_prg'):'')],
      ['Nature',natTxt],['Chargé',chargeYes()?(q('fl_qv')+q('fl_qrec')+q('fl_qreg'))+' kg':'non'],['Récupéré',recupYes()?(q('fl_qrt')+q('fl_qru'))+' kg':'non']];
    return '<div class="nxfg-sum"><b>Récapitulatif</b>'+rows.map(function(r){ return '<div class="r"><span>'+esc(r[0])+'</span><b>'+esc(r[1]||'—')+'</b></div>'; }).join('')+'</div>'+
      (pr.bad.length?'<div class="nxfg-bad">Obligatoire avant d\'enregistrer : '+esc(pr.bad.join(', '))+'</div>':'')+
      (pr.warn.length?'<div class="nxfg-warn"><b>À vérifier :</b><ul>'+pr.warn.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>':'<div class="nxfg-ok">✔ Fiche complète : tu peux enregistrer et faire signer.</div>');
  }
  window.nxfgGo=function(i){ ST.step=Math.max(0,Math.min(3,i)); refresh(); var b=$('mFlu').querySelector('.box'); if(b) b.scrollTop=0; var bd=$('mFlu').querySelector('.bd'); if(bd) bd.scrollTop=0; };
  window.nxfgNext=function(){
    var msg=$('nxfgMsg');
    if(ST.step===0&&(!g('fl_client').trim()||!g('fl_desc').trim())){ if(msg) msg.innerHTML='<div class="nxfg-bad">Renseigne le client et l\'équipement (ou sa référence) pour continuer.</div>'; return; }
    if(ST.step===2&&((chargeQ()&&ST.charge==null)||(recupQ()&&ST.recup==null))){ if(msg) msg.innerHTML='<div class="nxfg-bad">Réponds aux questions « chargé » / « récupéré » (oui ou non).</div>'; return; }
    nxfgGo(ST.step+1);
  };
  window.nxfgToggle=function(){ ST.on=!ST.on; persist(MODEK,ST.on); refresh(); };

  /* ---------------- enveloppes ---------------- */
  function wrap(){
    if(typeof window.openFlu==='function'&&!window.openFlu._nxfg){
      var o=window.openFlu;
      window.openFlu=function(id){
        var r=o.apply(this,arguments);
        setTimeout(function(){
          try{
            if(!inject()) return;
            var f=id?(FLU||[]).find(function(x){ return x.id===id; }):null;
            ST.on=guidedPref(); ST.step=f?3:0;
            ST.charge=f?(num(f.qv)+num(f.qrec)+num(f.qreg)>0):(g('fl_nature')==='mes'?true:null);
            ST.recup=f?(num(f.qrt)+num(f.qru)>0):(g('fl_nature')==='mes'?false:null);
            if(!f&&(num(g('fl_qv'))+num(g('fl_qrec'))+num(g('fl_qreg'))>0)) ST.charge=true;
            if(!f&&(num(g('fl_qrt'))+num(g('fl_qru'))>0)) ST.recup=true;
            sv('nxfg_ref',f&&f.ref?f.ref:''); var dd=$('nxfgRefDD'); if(dd) dd.innerHTML='';
            refresh();
          }catch(e){ try{ console.error('nxfg',e); }catch(_){} }
        },30);
        return r;
      };
      window.openFlu._nxfg=true;
    }
    if(typeof window.saveFlu==='function'&&!window.saveFlu._nxfg){
      var os=window.saveFlu;
      window.saveFlu=function(){
        if(ST.on&&$('nxfgBar')){ var pr=problems(); if(pr.bad.length){ nxfgGo(3); return; } }
        var id0=g('fl_id'), before={}; try{ (FLU||[]).forEach(function(x){ before[x.id]=1; }); }catch(e){}
        var ref=g('nxfg_ref').trim(), snap={ref:ref,fluide:g('fl_fluide'),charge:num(g('fl_charge')),prp:num(g('fl_prg'))};
        var r=os.apply(this,arguments);
        try{
          if(ref){ learn(snap);
            var f=id0?(FLU||[]).find(function(x){ return x.id===id0; }):(FLU||[]).find(function(x){ return !before[x.id]; });
            if(f&&f.ref!==ref){ f.ref=ref; save('cp2_fluides',FLU); } }
        }catch(e){}
        return r;
      };
      window.saveFlu._nxfg=true;
    }
    /* équipement choisi dans le parc : PRP et référence repris aussi */
    if(typeof window.fluEquipPick==='function'&&!window.fluEquipPick._nxfg){
      var op=window.fluEquipPick;
      window.fluEquipPick=function(){
        var r=op.apply(this,arguments);
        try{ var e=(EQUIP||[]).find(function(x){ return x.id===g('fl_equip'); }); if(e){ if(e.modele) sv('nxfg_ref',e.modele); var k=REFS()[norm(e.modele||'')]; if(k&&num(k.prp)>0&&!num(g('fl_prg'))) sv('fl_prg',k.prp); try{ nxcCalc(); }catch(_){} refresh(); } }catch(e){}
        return r;
      };
      window.fluEquipPick._nxfg=true;
    }
    /* plaque lue (photo) : la référence est retenue */
    if(typeof window.nxApplyContextOCR==='function'&&!window.nxApplyContextOCR._nxfg){
      var oa=window.nxApplyContextOCR;
      window.nxApplyContextOCR=function(){
        var v={}; try{ document.querySelectorAll('#nxCtxOcrFound [data-nx-ocr-field]').forEach(function(e){ v[e.dataset.nxOcrField]=e.value.trim(); }); }catch(e){}
        var r=oa.apply(this,arguments);
        try{ if(v.modele){ sv('nxfg_ref',v.modele); learn({ref:v.modele,marque:v.marque,fluide:v.fluide,charge:num(v.charge),prp:num(v.prg)}); } refresh(); }catch(e){}
        return r;
      };
      window.nxApplyContextOCR._nxfg=true;
    }
    /* équipements enregistrés au parc : référence retenue */
    if(typeof window.saveEquip==='function'&&!window.saveEquip._nxfg){
      var oe=window.saveEquip;
      window.saveEquip=function(){ var o={ref:g('eq_modele').trim(),marque:g('eq_marque').trim(),type:g('eq_type'),fluide:g('eq_fluide')!=='Sans'?g('eq_fluide'):'',charge:num(g('eq_charge'))}; var r=oe.apply(this,arguments); try{ learn(o); }catch(e){} return r; };
      window.saveEquip._nxfg=true;
    }
  }

  var CSS=
    '.nxfg-hide{display:none!important}'+'.nxfg-scan{width:100%;margin-top:10px;min-height:44px;white-space:normal}'+
    '#nxfgBar{margin-bottom:10px}.nxfg-top{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}'+
    '.nxfg-steps{display:flex;gap:4px;flex-wrap:wrap;flex:1;min-width:0}'+
    '.nxfg-steps button{border:1px solid var(--line2,#cfd8e3);background:var(--panel,#fff);border-radius:999px;padding:6px 10px;font:inherit;font-size:12.5px;cursor:pointer;color:inherit}'+
    '.nxfg-steps button.on{background:var(--blue,#1f4e79);border-color:var(--blue,#1f4e79);color:#fff;font-weight:600}.nxfg-steps button.done{background:var(--blue-soft,#eef3fa)}'+
    '.nxfg-tog{border:0;background:none;color:var(--blue,#1f4e79);font:inherit;font-size:12.5px;text-decoration:underline;cursor:pointer;padding:4px}'+
    '.nxfg-info{margin-top:8px;font-size:12.5px;background:#fff8e6;border-radius:8px;padding:7px 9px}'+
    '.nxfg-hint{font-size:12.5px;color:var(--muted,#64748b);margin-top:6px}'+
    '.nxfg-q{text-transform:none!important;letter-spacing:0!important;font-size:14px!important;font-weight:600;color:inherit!important}'+
    '.nxfg-yn{display:flex;gap:8px;margin-top:6px}.nxfg-yn button{flex:1;min-height:44px;border:1px solid var(--line2,#cfd8e3);background:var(--panel,#fff);border-radius:10px;font:inherit;font-size:15px;cursor:pointer;color:inherit}'+
    '.nxfg-yn button.on{background:var(--blue,#1f4e79);border-color:var(--blue,#1f4e79);color:#fff;font-weight:600}'+
    '.nxfg-nav{display:flex;justify-content:space-between;gap:10px;margin-top:14px;position:sticky;bottom:0;background:var(--panel,#fff);padding:10px 0 calc(6px + env(safe-area-inset-bottom,0px))}.nxfg-nav .btn-pri{margin-left:auto}'+
    '.nxfg-sum{border:1px solid var(--line,#e3e8ef);border-radius:10px;padding:10px 12px;margin:6px 0 10px;font-size:13px}.nxfg-sum .r{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line,#e3e8ef)}.nxfg-sum .r:last-child{border-bottom:0}.nxfg-sum .r span{color:var(--muted,#64748b)}.nxfg-sum .r b{text-align:right}'+
    '.nxfg-warn{border-left:4px solid var(--orange,#d97706);background:#fff7e6;padding:8px 12px;border-radius:8px;margin:6px 0;font-size:13px}.nxfg-warn ul{margin:4px 0 0 18px;padding:0}'+
    '.nxfg-bad{border-left:4px solid var(--red,#c0392b);background:#fdecea;padding:8px 12px;border-radius:8px;margin:6px 0;font-size:13px}'+
    '.nxfg-ok{border-left:4px solid var(--green,#189a58);background:#eaf7ef;padding:8px 12px;border-radius:8px;margin:6px 0;font-size:13px}';

  function boot(t){
    t=t||0;
    if(typeof window.openFlu!=='function'||!window.openFlu._nxc){ if(t<80) return setTimeout(function(){ boot(t+1); },150); }
    if(!$('nxfgStyle')){ var st=document.createElement('style'); st.id='nxfgStyle'; st.textContent=CSS; document.head.appendChild(st); }
    wrap();
  }
  window.nxfgTest={learn:learn,candidates:candidates,problems:problems,ST:ST};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ boot(0); }); else boot(0);
})();
