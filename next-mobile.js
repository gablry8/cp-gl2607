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

  /* ---------- CSS ---------- */
  var CSS=
    'body.nx-ov-open #nxaFab{display:none!important}'+
    'body.nx-d2 #nxaFab{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}'+
    '@media(max-width:860px){.content{padding-bottom:110px!important}#nxaFab{right:12px!important;bottom:calc(12px + env(safe-area-inset-bottom,0px));padding:11px 15px!important;font-size:13px!important}'+
      '.modal .box{max-height:calc(100dvh - 24px);overflow:auto;-webkit-overflow-scrolling:touch}'+
      '.modal .navbtns{position:sticky;bottom:0;background:var(--panel,#fff);padding-top:10px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2;flex-wrap:wrap;gap:8px}'+
      'button,.btn-pri,.btn-ghost,.btn-dark,.iconbtn,a[onclick]{touch-action:manipulation}}'+
    '.nxcp-wrap{position:relative}'+
    '.nxcp-dd{position:absolute;left:0;right:0;top:100%;z-index:10050;background:var(--panel,#fff);border:1px solid var(--line2,#cfd8e3);border-radius:10px;box-shadow:0 10px 30px rgba(15,30,60,.18);margin-top:4px;max-height:280px;overflow:auto;-webkit-overflow-scrolling:touch}'+
    '.nxcp-it{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line,#e3e8ef);background:none;padding:11px 12px;font:inherit;font-size:14px;color:inherit;cursor:pointer;min-height:44px;text-transform:none;letter-spacing:0}'+
    '.nxcp-it:last-child{border-bottom:0}.nxcp-it:active,.nxcp-it.on{background:var(--blue-soft,#eef3fa)}'+
    '.nxcp-it b{font-weight:600}.nxcp-it small{display:block;color:var(--muted,#64748b);font-size:12px;margin-top:2px;font-weight:400}'+
    '.nxcp-new{font-size:12.5px;color:var(--muted,#64748b);padding:9px 12px}';
  function injectCSS(){ if(document.getElementById('nxmStyle')) return; var st=document.createElement('style'); st.id='nxmStyle'; st.textContent=CSS; document.head.appendChild(st); }

  /* ---------- fenêtres ouvertes → cacher le bouton Assistant ---------- */
  var OVSEL='.modal.on,.nxd2-ov,.nxs-ov,#nxCatModal,#nx-pdf-modal,#nxfgOv,#nxdmOv,#nxfoOv';
  function visible(el){ if(!el) return false; var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return false; var r=el.getBoundingClientRect(); return r.width>0&&r.height>0; }
  var pend=false;
  function syncBody(){
    pend=false;
    var open=[].some.call(document.querySelectorAll(OVSEL),visible);
    document.body.classList.toggle('nx-ov-open',open);
    var d2=document.getElementById('v-nx_devis2');
    document.body.classList.toggle('nx-d2',!!(d2&&d2.classList.contains('active')));
    fitPdf();
  }
  function schedule(){ if(pend) return; pend=true; (window.requestAnimationFrame||setTimeout)(syncBody); }

  /* ---------- aperçu PDF à l'échelle de l'écran ---------- */
  function fitPdf(){
    var m=document.getElementById('nx-pdf-modal'), pg=document.getElementById('nx-pdf-page'), sc=document.getElementById('nx-pdf-scroll');
    if(!m||!pg) return;
    var w=(sc&&sc.clientWidth)||window.innerWidth;
    if(window.innerWidth<860&&getComputedStyle(m).display!=='none'){
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

  /* ---------- démarrage ---------- */
  function boot(){
    injectCSS(); bindPicker(); dateify(document); syncBody();
    new MutationObserver(function(ms){
      schedule();
      ms.forEach(function(m){ [].forEach.call(m.addedNodes||[],function(n){ if(n.nodeType===1&&n.querySelector) dateify(n); }); });
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',schedule);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
