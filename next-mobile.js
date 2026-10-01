/* ============================================================
   ClimPilot Next — next-mobile.js  (couche additive, 30/09/2026)
   Confort téléphone — corrige les « boutons qui ne marchent pas » :
   - le bouton flottant « Assistant » passait PAR-DESSUS les boutons
     Enregistrer des fenêtres (fiche fluide, contrat, équipement…) et de
     la barre du devis : il se cache quand une fenêtre est ouverte et
     remonte au-dessus de la barre du devis ;
   - marge en bas de page pour que les derniers boutons restent atteignables ;
   - choix du client : liste de suggestions maison (au lieu du datalist,
     capricieux sur iPhone), tolérante aux accents / majuscules, qui
     déclenche bien le remplissage auto dans TOUTES les catégories
     (devis, dépannage, location, fiche fluide, équipement, contrat) ;
   - aperçu PDF : la page A4 est mise à l'échelle de l'écran (elle était
     coupée à droite sur téléphone) ;
   - tout champ de date encore « à la main » devient un calendrier.
   Rien n'est modifié dans les données.
   ============================================================ */
(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim(); }

  /* ---------- dates ---------- */
  function toISO(v){
    v=String(v||'').trim(); if(!v) return '';
    if(/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    var m=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(v);
    if(m){ var y=m[3].length===2?'20'+m[3]:m[3]; return y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2); }
    return '';
  }
  function frDate(v){ var i=toISO(v); if(!i) return String(v||''); var p=i.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
  window.nxToISO=toISO; window.nxDateFR=frDate;
  /* filet de sécurité : un champ texte qui attend une date devient un calendrier */
  function dateify(root){
    (root||document).querySelectorAll('input[type="text"][placeholder],input:not([type])[placeholder]').forEach(function(el){
      if(!/jj\s*\/\s*mm|aaaa-mm-jj|jj-mm-aaaa/i.test(el.getAttribute('placeholder')||'')) return;
      var iso=toISO(el.value); el.type='date'; el.removeAttribute('placeholder'); if(iso) el.value=iso;
    });
  }

  /* ---------- nombres à virgule (01/10/2026) ----------
     Sur iPhone, une case « nombre » refusait la virgule (1,5 kg devenait vide). Chaque case nombre devient une
     case texte au clavier décimal : tu tapes 1,5 ou 1.5, l'app lit toujours 1.5 (aucun calcul ne change).
     Les cases qui acceptent un nombre négatif (températures, mesures) ont un bouton ± (le clavier décimal
     de l'iPhone n'a pas de signe moins). */
  var VDESC=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  function normNum(v){
    v=String(v==null?'':v).replace(/[\s  ]/g,'');
    if(v.indexOf(',')>=0&&v.indexOf('.')>=0) v=v.replace(/\./g,'');
    v=v.replace(',','.');
    return /^[-+]?(\d+\.?\d*|\.\d+|)([eE][-+]?\d+)?$/.test(v)?v.replace(/^\+/,''):'';
  }
  function showNum(v){ v=String(v==null?'':v); return /^-?\d*\.?\d*(e-?\d+)?$/i.test(v)?v.replace('.',','):v; }
  window.nxNormNum=normNum;
  function negOK(el){ var m=el.getAttribute('min'); if(m!==null&&m!==''&&Number(m)<0) return true; return el.dataset.neg==='1'; }
  function decimalize(el){
    if(!el||el.tagName!=='INPUT'||el.dataset.nxdec||el.type!=='number') return;
    el.dataset.nxdec='1';
    var raw=VDESC.get.call(el);
    try{ el.type='text'; }catch(e){ return; }
    el.setAttribute('inputmode','decimal'); el.setAttribute('autocomplete','off'); el.setAttribute('spellcheck','false');
    Object.defineProperty(el,'value',{configurable:true,enumerable:true,
      get:function(){ return normNum(VDESC.get.call(this)); },
      set:function(v){ VDESC.set.call(this,showNum(v)); }});
    Object.defineProperty(el,'valueAsNumber',{configurable:true,get:function(){ var n=parseFloat(normNum(VDESC.get.call(this))); return isFinite(n)?n:NaN; }});
    VDESC.set.call(el,showNum(raw));
    if(negOK(el)&&!(el.nextElementSibling&&el.nextElementSibling.classList.contains('nxdec-pm'))){
      var w=document.createElement('span'); w.className='nxdec-wrap'; el.parentNode.insertBefore(w,el); w.appendChild(el);
      var b=document.createElement('button'); b.type='button'; b.className='nxdec-pm'; b.textContent='±'; b.title='Changer le signe (nombre négatif)';
      b.addEventListener('pointerdown',function(e){ e.preventDefault(); });
      b.addEventListener('click',function(e){ e.preventDefault(); var r=VDESC.get.call(el).trim(); VDESC.set.call(el,r.charAt(0)==='-'?r.slice(1):'-'+r);
        el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
      w.appendChild(b);
    }
  }
  function decimalizeAll(root){ if(!root||!root.querySelectorAll) return; if(root.tagName==='INPUT') decimalize(root); root.querySelectorAll('input[type="number"]').forEach(decimalize); }
  window.nxDecimalize=decimalizeAll;
  /* saisie impossible à lire (ex. « 2 kg ») : la case se signale au lieu d'être prise pour 0 en silence */
  document.addEventListener('focusout',function(e){ var el=e.target; if(!el||!el.dataset||!el.dataset.nxdec) return; var r=VDESC.get.call(el).trim(); var bad=r!==''&&normNum(r)==='';
    el.classList.toggle('nxdec-bad',bad); if(bad){ el.title='Nombre non reconnu : tape seulement des chiffres (ex. 1,5)'; try{ toast('⚠ « '+r+' » n\'est pas un nombre — tape seulement des chiffres (ex. 1,5)'); }catch(_){} } else el.removeAttribute('title'); },true);

  /* ---------- CSS ---------- */
  var CSS=
    '.nxdec-wrap{display:flex;gap:6px;align-items:stretch;width:100%}.nxdec-wrap input{flex:1;min-width:0}'+
    '.nxdec-pm{flex:0 0 auto;min-width:42px;border:1px solid var(--line2,#cfd8e3);background:var(--panel,#fff);border-radius:8px;font-size:18px;font-weight:600;cursor:pointer;color:inherit}'+
    'input.nxdec-bad{border-color:var(--red,#c0392b)!important;background:#fdecea!important}'+
    'body.nx-ov-open #nxaFab{display:none!important}'+
    'body.nx-d2 #nxaFab{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}'+
    '@media(max-width:860px){.content{padding-bottom:110px!important}#nxaFab{right:12px!important;bottom:calc(12px + env(safe-area-inset-bottom,0px));padding:11px 15px!important;font-size:13px!important}'+
      '.modal .box{max-height:calc(100dvh - 24px);overflow:auto;-webkit-overflow-scrolling:touch}'+
      '.modal .navbtns{position:sticky;bottom:0;background:var(--panel,#fff);padding-top:10px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2;flex-wrap:wrap;gap:8px}'+
      'button,.btn-pri,.btn-ghost,.btn-dark,.iconbtn,a[onclick]{touch-action:manipulation}.iconbtn{min-width:38px;min-height:38px}}'+
    '.nxcp-wrap{position:relative}'+
    '.nxcp-dd{position:absolute;left:0;right:0;top:100%;z-index:10050;background:var(--panel,#fff);border:1px solid var(--line2,#cfd8e3);border-radius:10px;box-shadow:0 10px 30px rgba(15,30,60,.18);margin-top:4px;max-height:280px;overflow:auto;-webkit-overflow-scrolling:touch}'+
    '.nxcp-it{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line,#e3e8ef);background:none;padding:11px 12px;font:inherit;font-size:14px;color:inherit;cursor:pointer;min-height:44px;text-transform:none;letter-spacing:0}'+
    '.nxcp-it:last-child{border-bottom:0}.nxcp-it:active,.nxcp-it.on{background:var(--blue-soft,#eef3fa)}'+
    '.nxcp-it b{font-weight:600}.nxcp-it small{display:block;color:var(--muted,#64748b);font-size:12px;margin-top:2px;font-weight:400}'+
    '.nxcp-new{font-size:12.5px;color:var(--muted,#64748b);padding:9px 12px}';
  function injectCSS(){ if(document.getElementById('nxmStyle')) return; var st=document.createElement('style'); st.id='nxmStyle'; st.textContent=CSS; document.head.appendChild(st); }

  /* ---------- fenêtres ouvertes → cacher le bouton Assistant ---------- */
  /* lecture SANS calcul de mise en page (sinon chaque changement d'écran coûtait cher) */
  function overlayOpen(){
    if(document.querySelector('.modal.on,.nxd2-ov,.nxs-ov,#nxfgOv,#nxdmOv,#nxfoOv')) return true;
    var pm=document.getElementById('nx-pdf-modal'); if(pm&&pm.style.display==='flex') return true;
    var cm=document.getElementById('nxCatModal'); if(cm&&cm.style.display!=='none') return true;
    var sc=document.getElementById('nxContextScanner'); if(sc&&(sc.classList.contains('on')||sc.classList.contains('open')||sc.style.display==='flex'||sc.style.display==='block')) return true;
    return false;
  }
  var pend=false, lastPdfW=-1;
  function syncBody(){
    pend=false;
    var b=document.body, open=overlayOpen();
    if(b.classList.contains('nx-ov-open')!==open) b.classList.toggle('nx-ov-open',open);
    var d2=document.getElementById('v-nx_devis2'), on=!!(d2&&d2.classList.contains('active'));
    if(b.classList.contains('nx-d2')!==on) b.classList.toggle('nx-d2',on);
    var pm=document.getElementById('nx-pdf-modal');
    if(pm&&pm.style.display==='flex'){ if(lastPdfW!==window.innerWidth) fitPdf(); } else lastPdfW=-1;
  }
  function schedule(){ if(pend) return; pend=true; (window.requestAnimationFrame||setTimeout)(syncBody); }

  /* ---------- aperçu PDF à l'échelle de l'écran ---------- */
  function fitPdf(){
    var m=document.getElementById('nx-pdf-modal'), pg=document.getElementById('nx-pdf-page'), sc=document.getElementById('nx-pdf-scroll');
    if(!m||!pg) return;
    var w=window.innerWidth; lastPdfW=window.innerWidth;
    if(window.innerWidth<860&&m.style.display==='flex'){
      var A4=794, z=Math.min(1,(w-16)/A4);
      pg.style.width=A4+'px'; pg.style.maxWidth='none'; pg.style.padding='30px 34px'; pg.style.zoom=String(Math.round(z*1000)/1000);
      if(sc) sc.style.padding='10px 8px';
    } else { pg.style.width=''; pg.style.maxWidth=''; pg.style.padding=''; pg.style.zoom=''; if(sc) sc.style.padding=''; }
  }

  /* ---------- choix du client ---------- */
  var LISTS=/^(clientDL|clientDLdep|nxd2ClientDL)$/;
  function clients(){ try{ return (CLIENTS||[]).filter(function(c){ return c&&c.nom; }); }catch(e){ return []; } }
  function matches(q){
    var n=norm(q), all=clients();
    if(!n) return all.slice().sort(function(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); }).slice(0,8);
    var sc=all.map(function(c){ var nm=norm(c.nom), s=-1;
      if(nm===n) s=100; else if(nm.indexOf(n)===0) s=80; else if(nm.split(' ').some(function(w){ return w.indexOf(n)===0; })) s=60; else if(nm.indexOf(n)>=0) s=40;
      else if(norm(c.ville).indexOf(n)>=0||String(c.tel||'').replace(/\s/g,'').indexOf(n.replace(/\s/g,''))>=0&&n.length>=4) s=20;
      return {c:c,s:s}; }).filter(function(x){ return x.s>=0; });
    sc.sort(function(a,b){ return b.s-a.s||String(a.c.nom).localeCompare(String(b.c.nom)); });
    return sc.slice(0,8).map(function(x){ return x.c; });
  }
  var dd=null, ddFor=null, ddSel=-1;
  function closeDD(){ if(dd&&dd.parentNode) dd.parentNode.removeChild(dd); dd=null; ddFor=null; ddSel=-1; }
  function pick(el,c){
    closeDD();
    el.value=c.nom;
    try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
    try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
    try{ if(el.id==='fl_client'&&typeof fluEquipList==='function') fluEquipList(); }catch(e){}
  }
  function showDD(el){
    var list=matches(el.value);
    if(!list.length){ if(el.value.trim()){ render('<div class="nxcp-new">Nouveau client : « '+esc(el.value.trim())+' » sera créé à l\'enregistrement.</div>'); } else closeDD(); return; }
    if(list.length===1&&norm(list[0].nom)===norm(el.value)){ closeDD(); return; }
    render(list.map(function(c,i){ return '<button type="button" class="nxcp-it" data-i="'+i+'"><b>'+esc(c.nom)+'</b><small>'+esc([c.ville,c.tel,c.type].filter(Boolean).join(' · ')||'—')+'</small></button>'; }).join(''));
    dd._list=list;
    function render(h){
      if(!dd){ dd=document.createElement('div'); dd.className='nxcp-dd';
        dd.addEventListener('pointerdown',function(e){ e.preventDefault(); });
        dd.addEventListener('mousedown',function(e){ e.preventDefault(); });
        dd.addEventListener('click',function(e){ var b=e.target.closest('.nxcp-it'); if(!b||!dd||!dd._list) return; pick(ddFor,dd._list[+b.dataset.i]); });
      }
      dd.innerHTML=h; dd._list=null;
      var host=el.parentNode; if(host&&!host.classList.contains('nxcp-wrap')) host.classList.add('nxcp-wrap');
      if(dd.parentNode!==host||dd.previousSibling!==el) host.insertBefore(dd,el.nextSibling);
      ddFor=el; ddSel=-1;
    }
  }
  function isClientInput(el){
    if(!el||el.tagName!=='INPUT') return false;
    if(el.dataset.nxcp) return true;
    var l=el.getAttribute('list');
    if(l&&LISTS.test(l)){ el.dataset.nxcp=l; el.removeAttribute('list'); el.setAttribute('autocomplete','off'); el.setAttribute('autocapitalize','words'); return true; }
    return false;
  }
  function bindPicker(){
    document.addEventListener('focusin',function(e){ if(isClientInput(e.target)) showDD(e.target); },true);
    document.addEventListener('input',function(e){ if(isClientInput(e.target)) showDD(e.target); },true);
    document.addEventListener('focusout',function(e){ if(e.target===ddFor) setTimeout(function(){ if(document.activeElement!==ddFor) closeDD(); },180); },true);
    document.addEventListener('keydown',function(e){
      if(!dd||e.target!==ddFor||!dd._list) return;
      var its=dd.querySelectorAll('.nxcp-it'); if(!its.length) return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); ddSel=(ddSel+(e.key==='ArrowDown'?1:-1)+its.length)%its.length; its.forEach(function(x,i){ x.classList.toggle('on',i===ddSel); }); }
      else if(e.key==='Enter'&&ddSel>=0){ e.preventDefault(); pick(ddFor,dd._list[ddSel]); }
      else if(e.key==='Escape') closeDD();
    },true);
    /* sélection tolérante : même si le nom est tapé avec une autre casse ou un espace de trop, le client est reconnu */
    document.addEventListener('change',function(e){
      var el=e.target; if(!isClientInput(el)) return;
      var v=norm(el.value); if(!v) return;
      var c=clients().find(function(x){ return norm(x.nom)===v; });
      if(c&&el.value!==c.nom){ el.value=c.nom; }
    },true);
  }

  /* ---------- rapidité : un même devis n'est calculé qu'une fois par affichage ----------
     Un écran appelait le calcul 2 à 3 fois par devis, à chaque affichage. Le résultat est gardé
     en mémoire avec pour clé le contenu COMPLET du devis + l'empreinte de tes réglages et de ta base
     de prix (recalculée à chaque action) : un devis ou un prix modifié est toujours recalculé ;
     chaque appel reçoit sa propre copie du résultat. */
  function h32(str){ var h=0x811c9dc5; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; } return h.toString(36)+':'+str.length; }
  function fingerprint(){ var a='',b='',c=''; try{ a=JSON.stringify(P); }catch(e){} try{ b=JSON.stringify(PRIX); }catch(e){} try{ c=localStorage.getItem('cpnext_d2_defaults')||''; }catch(e){} return h32(a)+'|'+h32(b)+'|'+h32(c); }
  function memoCompute(){
    var oc=window.compute; if(typeof oc!=='function'||oc._nxm) return;
    var cache=new Map(), MAX=6000, fp=null, sched=false;
    var endTask=function(){ fp=null; sched=false; };
    var cp=typeof structuredClone==='function'?function(o){ try{ return structuredClone(o); }catch(e){ return JSON.parse(JSON.stringify(o)); } }:function(o){ return JSON.parse(JSON.stringify(o)); };
    var w=function(d){
      if(!d||typeof d!=='object') return oc.apply(this,arguments);
      var k; try{ k=JSON.stringify(d); }catch(e){ return oc.apply(this,arguments); }
      /* empreinte des réglages et des prix recalculée à chaque action : un prix modifié invalide tout */
      if(fp===null){ fp=fingerprint(); if(!sched){ sched=true; setTimeout(endTask,0); } }
      k=fp+'\u0001'+k;
      var hit=cache.get(k); if(hit){ cache.delete(k); cache.set(k,hit); return cp(hit); }
      var r=oc.apply(this,arguments);
      if(r&&typeof r==='object'){ cache.set(k,r); if(cache.size>MAX){ var it=cache.keys(); for(var i=0;i<500;i++) cache.delete(it.next().value); } return cp(r); }
      return r;
    };
    Object.keys(oc).forEach(function(x){ w[x]=oc[x]; }); w._nxm=true; window.compute=w;
    window.nxmComputeCache={size:function(){ return cache.size; },clear:function(){ cache.clear(); }};
  }
  window.addEventListener('load',function(){ setTimeout(memoCompute,400); });

  /* ---------- démarrage ---------- */
  /* données illisibles détectées au démarrage : on prévient (une copie brute a été gardée) */
  function corruptBanner(){
    var k=window._nxCorrupt; if(!k||!k.length||document.getElementById('nxmCorrupt')) return;
    var L={cp2_devis:'devis',cp2_clients:'clients',cp2_dep:'interventions',cp2_loc:'locations',cp2_equip:'équipements',cp2_contrats:'contrats',cp2_fluides:'fiches fluides'};
    var names=Array.from(new Set(k)).map(function(x){ return L[x]||x; }).join(', ');
    var c=document.querySelector('.content'); if(!c) return;
    var b=document.createElement('div'); b.id='nxmCorrupt'; b.className='warnbox'; b.style.margin='0 0 12px';
    b.innerHTML='⚠️ <b>Données abîmées réparées au démarrage</b> ('+esc(names)+') : les éléments illisibles ont été écartés et une copie brute a été gardée sur cet appareil. Vérifie tes derniers éléments ; au besoin, restaure un instantané (Outils → Historique / sauvegardes). <button type="button" class="btn-ghost btn-sm" onclick="this.parentNode.remove()">OK</button>';
    c.insertBefore(b,c.firstChild);
  }
  /* devis commencés mais jamais enregistrés (app fermée, batterie à plat…) : rappel au démarrage */
  function draftBanner(){
    var nd=[]; try{ nd=(window.nxd2&&nxd2.pendingDrafts)?nxd2.pendingDrafts():[]; }catch(e){}
    if(!nd.length||document.getElementById('nxmDrafts')) return;
    var c=document.querySelector('.content'); if(!c) return;
    var b=document.createElement('div'); b.id='nxmDrafts'; b.className='warnbox'; b.style.margin='0 0 12px';
    b.innerHTML='📝 <b>'+(nd.length>1?nd.length+' devis commencés':'Un devis commencé')+' mais pas enregistré'+(nd.length>1?'s':'')+'</b> : '+nd.slice(0,3).map(function(x){ return '<span style="white-space:nowrap">'+esc((x.cur&&x.cur.cNom)||'sans nom')+' <button type="button" class="btn-pri btn-sm" onclick="document.getElementById(\'nxmDrafts\').remove();nxd2.resumeNewDraft(\''+esc(x.id)+'\')">Reprendre</button></span>'; }).join(' ')+
      ' <button type="button" class="btn-ghost btn-sm" onclick="this.parentNode.remove()">Plus tard</button>';
    c.insertBefore(b,c.firstChild);
  }
  /* espace de stockage de l'appareil (≈ 5 millions de caractères sur iPhone/Safari) */
  var LIMIT=5000000;
  function storageUse(){ var n=0; try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); n+=k.length+(localStorage.getItem(k)||'').length; } }catch(e){} return {chars:n,pct:Math.round(n/LIMIT*100)}; }
  window.nxmStorage=storageUse;
  function bigStore(){ return !!(window.nxStore&&nxStore.mode==='idb'); }
  function showStore(pct,txt){
    var c=document.querySelector('.content'); if(!c) return;
    var old=document.getElementById('nxmStore'); if(old) old.remove();
    if(pct<70) return;
    var b=document.createElement('div'); b.id='nxmStore'; b.className='warnbox'; b.style.margin='0 0 12px';
    b.innerHTML='💾 <b>Mémoire de l\'appareil remplie à '+pct+' %</b>'+(pct>=90?' — risque de ne plus pouvoir enregistrer !':'')+' '+txt+' <button type="button" class="btn-ghost btn-sm" onclick="this.parentNode.remove()">OK</button>';
    c.insertBefore(b,c.firstChild);
  }
  function storageBanner(){
    /* grande mémoire active : on mesure la place réellement disponible (quota du navigateur) */
    if(bigStore()&&navigator.storage&&navigator.storage.estimate){
      navigator.storage.estimate().then(function(e){ if(!e||!e.quota) return; var pct=Math.round((e.usage||0)/e.quota*100); window._nxQuota=e; showStore(pct,'Libère de l\'espace sur le téléphone (photos, vidéos) et fais une <b>⤓ Sauvegarde</b>.'); }).catch(function(){});
      return;
    }
    var u=storageUse();
    showStore(u.pct,'Fais une <b>⤓ Sauvegarde</b>, puis vide la corbeille et l\'historique (Outils). Les grosses données sont surtout les signatures des devis.');
  }
  window.nxmStorageBanner=storageBanner;
  function boot(){
    injectCSS(); bindPicker(); dateify(document); decimalizeAll(document); syncBody(); setTimeout(corruptBanner,600); setTimeout(draftBanner,1500); setTimeout(storageBanner,2000);
    new MutationObserver(function(ms){
      schedule();
      ms.forEach(function(m){ [].forEach.call(m.addedNodes||[],function(n){ if(n.nodeType===1&&n.querySelector){ dateify(n); decimalizeAll(n); } }); });
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',function(){ lastPdfW=-1; schedule(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
