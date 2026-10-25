/* ============================================================
   ClimPilot Next — next-raccourcis.js  (couche additive, 1.12 — 13/10/2026)
   Raccourcis vers ce qu'on fait souvent :
   - menu « ＋ Créer » : Retour SAV ; menu « ••• Outils » : relevé bancaire, déclaration des fluides, bouteilles dans
     le camion (ADR) ;
   - recherche Ctrl K : ces actions + tous les écrans du menu (tape « fluides », « contrats », « relevé »…),
     par window.nxExtraSearch (lu par nxBuildSearch, next-addons.js) ;
   - ouverture directe par l'adresse : index.html?ouvrir=devis | depannage | objectifs | sav | releve | fluides | adr
     (raccourcis de l'appli installée, manifest.json « shortcuts » : clic droit sur l'icône dans la barre des tâches de
     Windows, appui long sur Android ; l'iPhone ne les affiche pas). Le paramètre est retiré de l'adresse après usage,
     une valeur inconnue est ignorée.
   Rien n'est stocké, sauf pour l'onglet (sessionStorage) : la cible d'un raccourci et l'écran à rouvrir après une mise à jour
   reçue d'un autre appareil.
   ============================================================ */
(function(){
  'use strict';
  function viser(id,ouvrirDetails,focusId){
    var e=document.getElementById(id); if(!e) return false;
    if(ouvrirDetails){ var d=e.querySelector('details'); if(d) d.open=true; }
    try{ e.scrollIntoView({behavior:'smooth',block:'start'}); }catch(_){ try{ e.scrollIntoView(); }catch(__){} }
    if(focusId){ var f=document.getElementById(focusId); if(f) try{ f.focus({preventScroll:true}); }catch(_){} }
    return true;
  }
  /* même chemin que les boutons existants du menu « Créer » */
  function cliquerCreer(motif){
    var b=[].slice.call(document.querySelectorAll('.nx-create-panel button, .topbar button')).filter(function(x){ return (x.getAttribute('onclick')||'').indexOf(motif)>=0; })[0];
    if(b){ b.click(); return true; } return false;
  }
  function puis(id,details,focus){ setTimeout(function(){ viser(id,details,focus); },120); }
  var CIBLES={
    devis:function(){ if(cliquerCreer('newDevis')) return true; if(typeof go==='function'&&typeof newDevis==='function'){ go('wizard'); newDevis(); return true; } return false; },
    depannage:function(){ if(cliquerCreer("newDep('dep')")) return true; if(typeof newDep==='function'){ newDep('dep'); return true; } return false; },
    objectifs:function(){ go('nx_obj'); return true; },
    sav:function(){ go('nx_obj'); puis('nxrt',true,'nxrt_devis'); return true; },
    releve:function(){ go('nx_obj'); puis('nxbq'); return true; },
    fluides:function(){ go('fluides'); puis('nxfb'); return true; },
    adr:function(){ go('fluides'); puis('nxadr',false,'nxadrQ'); return true; },
    avis:function(){ go('nx_obj'); puis('nxavis'); return true; }
  };
  window.nxrcOuvrir=function(c){ var f=Object.prototype.hasOwnProperty.call(CIBLES,String(c||''))?CIBLES[c]:null; if(!f) return false;
    try{ return f(); }catch(e){ try{ console.error('ClimPilot raccourci',e); }catch(_){} return false; } };
  window.nxrcCibles=function(){ return Object.keys(CIBLES); };

  /* ---------- menus ---------- */
  var MENU=[
    {p:'.nx-create-panel',id:'sav',txt:'↺ + Retour SAV (non facturé)'},
    {p:'.nx-tools-panel',id:'releve',txt:'🏦 Importer mon relevé bancaire'},
    {p:'.nx-tools-panel',id:'fluides',txt:'🧪 Déclaration annuelle des fluides'},
    {p:'.nx-tools-panel',id:'adr',txt:'🚐 Bouteilles dans le camion (ADR)'}
  ];
  function menus(){
    var faits=0;
    MENU.forEach(function(m){ var p=document.querySelector(m.p); if(!p) return;
      if(!p.querySelector('[data-nxrc="'+m.id+'"]')){
        var b=document.createElement('button'); b.type='button'; b.setAttribute('data-nxrc',m.id); b.textContent=m.txt;
        /* même cadre que les autres boutons du menu « Créer » (règle .topbar button[style*="background"], next-pro.css) */
        if(m.p==='.nx-create-panel'){ b.className='btn-sm'; b.setAttribute('style','background:#fff'); }
        /* relevé : le sélecteur de fichier s'ouvre directement depuis le clic (geste de l'utilisateur) */
        b.setAttribute('onclick',m.id==='releve'?"if(typeof nxbqChoisir==='function')nxbqChoisir();else nxrcOuvrir('releve')":"nxrcOuvrir('"+m.id+"')");
        p.appendChild(b); }
      faits++; });
    return faits===MENU.length;
  }

  /* ---------- recherche Ctrl K ---------- */
  window.nxExtraSearch=window.nxExtraSearch||[];
  window.nxExtraSearch.push(function(){
    var out=[
      {ico:'↺',title:'Noter un retour SAV',sub:'Garantie, réglage, geste commercial non facturé',terms:['sav retour garantie non facture'],run:function(){ nxrcOuvrir('sav'); }},
      {ico:'🏦',title:'Importer mon relevé bancaire',sub:'Retrouver les factures payées, mettre la trésorerie à jour',terms:['banque releve virement paiement paye tresorerie csv'],run:function(){ if(typeof nxbqChoisir==='function') nxbqChoisir(); else nxrcOuvrir('releve'); }},
      {ico:'🧪',title:'Déclaration annuelle des fluides',sub:'Organisme agréé, avant le 31 janvier',terms:['fluides declaration annuelle organisme bilan'],run:function(){ nxrcOuvrir('fluides'); }},
      {ico:'🚐',title:'Bouteilles dans le camion (ADR)',sub:'Seuil de 1 000 points',terms:['adr bouteilles camion transport'],run:function(){ nxrcOuvrir('adr'); }},
      {ico:'⭐',title:'Demander un avis Google',sub:'Clients payés récemment',terms:['avis google'],run:function(){ nxrcOuvrir('avis'); }}
    ];
    [].slice.call(document.querySelectorAll('#nav a[data-v]')).forEach(function(a){
      var v=a.getAttribute('data-v'), t=String((a.querySelector('.txt')||a).textContent||'').trim(); if(!v||!t) return;
      out.push({type:'Écran',ico:'↗',title:t,sub:'Ouvrir l’écran',terms:['ecran'],run:function(){ go(v); }}); });
    return out;
  });

  /* ---------- ouverture par l'adresse ---------- */
  /* la cible est gardée pour l'onglet (sessionStorage) quelques secondes : si l'APPLI se recharge d'elle-même juste après
     (mise à jour reçue d'un autre appareil à l'ouverture), le raccourci n'est pas perdu. Un rechargement fait à la main
     (F5) n'y revient pas : seul un rechargement de synchro est signalé par l'appli (__cpRechargeAuto, voir cpReload). */
  var CLE_RC='__nxrc_cible';
  function lireSS(k){ try{ return JSON.parse(sessionStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function depuisAdresse(){
    var q=''; try{ q=new URLSearchParams(location.search).get('ouvrir')||''; }catch(e){ q=''; }
    var o=null;
    if(q){
      try{ var u=new URL(location.href); u.searchParams.delete('ouvrir'); history.replaceState(history.state,'',u.pathname+u.search+u.hash); }catch(e){}
      if(!Object.prototype.hasOwnProperty.call(CIBLES,q)) return;
      o={c:q,t:Date.now()};
    } else {
      var p=lireSS(CLE_RC), auto=+(sessionStorage.getItem('__cpRechargeAuto')||0);
      if(p&&Object.prototype.hasOwnProperty.call(CIBLES,p.c)&&Date.now()-p.t<20000&&Date.now()-auto<10000) o=p;
    }
    try{ sessionStorage.removeItem(CLE_RC); }catch(e){}
    if(!o){ if(!q) vueApresSynchro(); return; }
    try{ sessionStorage.removeItem(CLE_VUE); }catch(e){}
    try{ sessionStorage.setItem(CLE_RC,JSON.stringify(o)); }catch(e){}
    setTimeout(function(){ window.nxrcOuvrir(o.c); setTimeout(function(){ try{ sessionStorage.removeItem(CLE_RC); }catch(e){} },4000); },900);
  }

  /* ---------- même écran après une mise à jour reçue d'un autre appareil ----------
     La mise à jour recharge l'appli (seule façon sûre de relire toutes les données). cpReload (index.html) garde pour
     l'onglet l'écran ouvert et sa position (__cpVue) ; on y revient ici, au lieu de repartir sur « Ma journée ».
     Seulement après un rechargement fait par l'appli (__cpRechargeAuto, 10 s), jamais après un F5. Un raccourci en
     attente (ci-dessus) passe avant. */
  var CLE_VUE='__cpVue';
  function vueApresSynchro(){
    var o=lireSS(CLE_VUE), auto=+(sessionStorage.getItem('__cpRechargeAuto')||0);
    try{ sessionStorage.removeItem(CLE_VUE); }catch(e){}
    if(!o||typeof o.v!=='string'||!/^[a-z0-9_]{1,40}$/.test(o.v)||/^(wizard|depform|nx_devis2|nx_scan)$/.test(o.v)) return;
    if(Date.now()-auto>10000||Date.now()-(+o.t||0)>15000) return;
    window.__nxVueGardee=true;
    var essais=0;
    (function encore(){
      var liste=(typeof LISTV!=='undefined'&&LISTV.indexOf&&LISTV.indexOf(o.v)>=0); /* listes de devis : un seul écran « list » */
      var pret=typeof window.go==='function'&&document.getElementById('v-'+(liste?'list':o.v))&&(!window.nxStore||window.nxStore.ready);
      if(!pret){ if(++essais<40) setTimeout(encore,100); return; }
      try{
        /* fiche client : rouverte sur le même client s'il existe encore, sinon la liste des clients */
        if(o.v==='client360'){ var cl=typeof CLIENTS!=='undefined'&&o.c&&CLIENTS.some(function(x){ return x&&String(x.id)===o.c; });
          if(cl&&typeof window.openClient360==='function') window.openClient360(o.c); else window.go('clients'); }
        else if(window._curView!==o.v) window.go(o.v);
      }catch(e){ if(++essais<40) setTimeout(encore,150); return; }
      var y=Math.max(0,+o.y||0);
      if(y) setTimeout(function(){ try{ window.scrollTo(0,y); if(document.body) document.body.scrollTop=y; }catch(e){} },150);
      try{ if(typeof window.toast==='function') window.toast('🔄 Mis à jour depuis ton autre appareil'); }catch(e){}
    })();
  }

  function boot(){
    var essais=0; (function encore(){ if(menus()||++essais>20) return; setTimeout(encore,300); })();
    depuisAdresse();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
