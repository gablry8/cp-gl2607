/* ============================================================
   ClimPilot Next — next-statut.js
   Refonte du système de statut des devis (couche additive).
   - Réduit à 4 statuts : brouillon -> envoye -> accepte / refuse
     (anciens "verifier" et "pret" migrés vers "brouillon").
   - Design A : boutons d'action « étape suivante » dans la liste.
   - Design C : barre d'avancement (segments) dans le récap,
     à la place du menu déroulant caché.
   - Auto-mail : « Mail au client » passe le devis en Envoyé.
   - Menu de gauche : Brouillons · Envoyés · Acceptés (+ Tous).
   - Thème marine sobre déjà en place.
   Chargé en dernier dans index.html. N'édite pas le cœur : il
   enveloppe (wrap) les fonctions existantes et retouche le DOM.
   ============================================================ */
(function(){
  'use strict';

  /* anciens statuts -> nouveau modèle */
  var MAP = { verifier:'brouillon', pret:'brouillon' };
  var LABELS = { brouillon:'Brouillon', envoye:'Envoyé', accepte:'Accepté', refuse:'Refusé' };
  function norm(s){ return MAP[s] || s || 'brouillon'; }

  function persist(){
    try{ if(typeof save==='function' && typeof LS!=='undefined') save(LS.devis, DEVIS); }catch(e){}
  }
  function findDevis(id){
    try{ return DEVIS.find(function(x){ return x.id===id; }); }catch(e){ return null; }
  }
  function refreshViews(){
    try{ if(typeof updateBadges==='function') updateBadges(); }catch(e){}
    try{ if(typeof renderList==='function') renderList(); }catch(e){}
    try{ if(window._curView==='dash' && typeof renderDash==='function') renderDash(); }catch(e){}
  }

  /* ---------- 1. affichage : normalise les anciens statuts ---------- */
  if(typeof window.statusTag==='function'){
    var _statusTag = window.statusTag;
    window.statusTag = function(s){ return _statusTag(norm(s)); };
  }

  /* ---------- 2. migration à l'ouverture d'un devis ---------- */
  if(typeof window.migrate==='function'){
    var _migrate = window.migrate;
    window.migrate = function(d){
      d = _migrate(d);
      if(d && MAP[d.statut]) d.statut = MAP[d.statut];
      return d;
    };
  }

  /* ---------- 3. actions de statut ---------- */
  window.nxSetStatut = function(id, s){
    var d = findDevis(id); if(!d) return;
    d.statut = s;
    if(s==='envoye' && !d.sentAt) d.sentAt = Date.now();
    persist(); refreshViews();
    try{ if(typeof toast==='function') toast('Statut : ' + (LABELS[s]||s)); }catch(e){}
  };

  window.nxEnvoyer = function(id){
    var d = findDevis(id); if(!d) return;
    d.statut = 'envoye';
    if(!d.sentAt) d.sentAt = Date.now();
    persist(); refreshViews();
    /* ouvre le brouillon de mail (même texte que « Mail au client ») */
    try{
      var c = compute(d);
      var E = (typeof P!=='undefined' && P.entreprise) || {};
      var validite = (typeof P!=='undefined' && P.validiteJours) || 30;
      var body = 'Bonjour' + (d.cNom ? ' '+d.cNom : '') + ',\n\n' +
        'Suite à notre échange, voici notre devis ' + d.num + ' (' + d.type + ') pour un montant de ' +
        eur(c.totalHT) + ' HT — TVA non applicable, art. 293 B du CGI.\n\n' +
        'Il est valable ' + validite + ' jours. Je reste disponible pour toute question ou ajustement.\n\n' +
        'Cordialement,\n' + (E.nom||'') + (E.tel ? '\n'+E.tel : '') +
        '\n\n(Pense à joindre le PDF généré par « Aperçu / PDF »)';
      if(typeof buildMail==='function')
        buildMail(d.cMail, 'Devis ' + d.num + ' — ' + (E.nom||'GL Froid & Clim'), body);
    }catch(e){}
  };

  window.nxFacturer = function(id){
    try{
      if(typeof openDevis==='function'){
        openDevis(id);
        if(typeof step==='function') setTimeout(function(){ try{ step(6); }catch(e){} }, 0);
      }
    }catch(e){}
  };

  /* ---------- 4. Design A : boutons dans la liste ---------- */
  function nxDecorateList(){
    var host = document.getElementById('listTable'); if(!host) return;
    var rows = host.querySelectorAll('tbody tr');
    Array.prototype.forEach.call(rows, function(tr){
      var btn = tr.querySelector('button[onclick^="openDevis"]'); if(!btn) return;
      var m = /openDevis\('([^']+)'\)/.exec(btn.getAttribute('onclick')||''); if(!m) return;
      var d = findDevis(m[1]); if(!d) return;
      var pill = tr.querySelector('.tag');
      var cell = pill ? pill.closest('td') : tr.children[5];
      if(!cell || cell.querySelector('.nx-actwrap')) return;
      var s = norm(d.statut), html = '';
      if(s==='brouillon')
        html = '<button class="nx-sbtn mar" onclick="nxEnvoyer(\''+d.id+'\')">Envoyer</button>';
      else if(s==='envoye')
        html = '<button class="nx-sbtn acc" onclick="nxSetStatut(\''+d.id+'\',\'accepte\')">Accepté</button>' +
               '<button class="nx-sbtn ref" onclick="nxSetStatut(\''+d.id+'\',\'refuse\')">Refusé</button>';
      else if(s==='accepte')
        html = '<button class="nx-sbtn ghost" onclick="nxFacturer(\''+d.id+'\')">Facturer</button>';
      else if(s==='refuse')
        html = '<button class="nx-sbtn ghost" onclick="nxSetStatut(\''+d.id+'\',\'brouillon\')">Rouvrir</button>';
      if(!html) return;
      var wrap = document.createElement('div');
      wrap.className = 'nx-actwrap';
      wrap.innerHTML = html;
      cell.appendChild(wrap);
    });
  }
  if(typeof window.renderList==='function'){
    var _renderList = window.renderList;
    window.renderList = function(){
      var r = _renderList.apply(this, arguments);
      try{ nxDecorateList(); }catch(e){}
      try{ nxSyncChips(); }catch(e){}
      return r;
    };
  }

  /* ---------- 5. Design C : barre d'avancement au récap ---------- */
  var SEG = [ ['brouillon','Brouillon',''], ['envoye','Envoyé',''],
              ['accepte','Accepté','acc'], ['refuse','Refusé','ref'] ];

  function nxSegSync(){
    var sel = document.getElementById('f_statut');
    var seg = document.getElementById('nx-seg');
    if(!sel || !seg) return;
    var v = norm(sel.value);
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function(b){
      b.className = '';
      if(b.getAttribute('data-s')===v){
        b.classList.add('on');
        var k = b.getAttribute('data-k');
        if(k) b.classList.add(k);
      }
    });
  }

  function buildSeg(){
    var sel = document.getElementById('f_statut'); if(!sel) return;
    var label = sel.closest('label'); if(!label) return;
    if(document.getElementById('nx-seg')) return;
    /* retire les options devenues inutiles */
    ['verifier','pret'].forEach(function(v){
      var o = sel.querySelector('option[value="'+v+'"]'); if(o) o.remove();
    });
    label.style.display = 'none';
    var wrap = document.createElement('div');
    wrap.className = 'nx-segwrap';
    wrap.innerHTML = '<span class="nx-seglab">Statut</span>';
    var seg = document.createElement('div');
    seg.id = 'nx-seg'; seg.className = 'nx-seg';
    seg.innerHTML = SEG.map(function(d){
      return '<button type="button" data-s="'+d[0]+'" data-k="'+d[2]+'">'+d[1]+'</button>';
    }).join('');
    wrap.appendChild(seg);
    label.parentNode.insertBefore(wrap, label);
    seg.addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b) return;
      var s = b.getAttribute('data-s');
      sel.value = s;
      try{ if(s==='envoye' && typeof cur!=='undefined' && cur && !cur.sentAt) cur.sentAt = Date.now(); }catch(err){}
      try{ sel.dispatchEvent(new Event('change')); }
      catch(err){
        try{ if(typeof recalc==='function') recalc(); }catch(e2){}
        try{ if(typeof renderFBloc==='function') renderFBloc(); }catch(e2){}
      }
      nxSegSync();
    });
    nxSegSync();
  }

  if(typeof window.showStep==='function'){
    var _showStep = window.showStep;
    window.showStep = function(){
      var r = _showStep.apply(this, arguments);
      try{ if(typeof curStep!=='undefined' && curStep===6){ buildSeg(); nxSegSync(); } }catch(e){}
      return r;
    };
  }

  /* ---------- 5b. cases de filtre dans « Tous les devis » ---------- */
  var FILTERS = [ ['tous','Tous'], ['brouillon','Brouillons'], ['envoye','Envoyés'],
                  ['accepte','Acceptés'], ['refuse','Refusés'] ];

  window.nxSetFilter = function(f){
    window._listFilter = f;
    try{ if(typeof renderList==='function') renderList(); }catch(e){}
    nxMarkTousActive();
  };

  function nxMarkTousActive(){
    var nav = document.getElementById('nav'); if(!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function(a){ a.classList.remove('active'); });
    var t = nav.querySelector('a[data-v="tous"]'); if(t) t.classList.add('active');
  }

  function nxCount(f){
    try{
      if(f==='tous') return DEVIS.length;
      return DEVIS.filter(function(d){ return norm(d.statut)===f; }).length;
    }catch(e){ return 0; }
  }

  function nxSyncChips(){
    var bar = document.getElementById('nx-filterbar'); if(!bar) return;
    var cur = window._listFilter || 'tous';
    Array.prototype.forEach.call(bar.querySelectorAll('.nx-chip'), function(c){
      var f = c.getAttribute('data-f');
      c.classList.toggle('on', f===cur);
      var b = c.querySelector('.nx-chipn'); if(b) b.textContent = nxCount(f);
    });
  }

  function buildFilterBar(){
    var view = document.getElementById('v-list'); if(!view) return;
    if(document.getElementById('nx-filterbar')) return;
    var sb = view.querySelector('.searchbar');
    var bar = document.createElement('div');
    bar.id = 'nx-filterbar';
    bar.className = 'nx-filterbar';
    bar.innerHTML = FILTERS.map(function(d){
      return '<button type="button" class="nx-chip" data-f="'+d[0]+'" onclick="nxSetFilter(\''+d[0]+'\')">' +
             d[1] + ' <span class="nx-chipn">0</span></button>';
    }).join('');
    if(sb && sb.parentNode) sb.parentNode.insertBefore(bar, sb.nextSibling);
    else view.insertBefore(bar, view.firstChild);
    nxSyncChips();
  }

  /* garde « Tous les devis » surligné + cases à jour quand on entre dans la liste */
  if(typeof window.go==='function'){
    var _go = window.go;
    window.go = function(v){
      var r = _go.apply(this, arguments);
      try{
        if(typeof LISTV!=='undefined' && LISTV.indexOf(v)>=0){ nxMarkTousActive(); nxSyncChips(); }
      }catch(e){}
      return r;
    };
  }

  /* ---------- 6. auto-mail : « Mail au client » -> Envoyé ---------- */
  if(typeof window.mailDevis==='function'){
    var _mailDevis = window.mailDevis;
    window.mailDevis = function(){
      var r = _mailDevis.apply(this, arguments);
      try{
        if(typeof cur!=='undefined' && cur && norm(cur.statut)==='brouillon'){
          cur.statut = 'envoye';
          if(!cur.sentAt) cur.sentAt = Date.now();
          var sel = document.getElementById('f_statut');
          if(sel) sel.value = 'envoye';
          nxSegSync();
          var i = -1; try{ i = DEVIS.findIndex(function(x){ return x.id===cur.id; }); }catch(e){}
          if(i>=0){ DEVIS[i].statut='envoye'; if(!DEVIS[i].sentAt) DEVIS[i].sentAt=cur.sentAt; persist(); if(typeof updateBadges==='function') updateBadges(); }
          try{ var ws=document.getElementById('wizStatus'); if(ws && typeof statusTag==='function') ws.innerHTML=statusTag('envoye'); }catch(e){}
          try{ if(typeof renderFBloc==='function') renderFBloc(); }catch(e){}
          try{ if(typeof toast==='function') toast('Devis marqué « Envoyé »'); }catch(e){}
        }
      }catch(e){}
      return r;
    };
  }

  /* ---------- 7. menu de gauche + tableau de bord ---------- */
  function tweakNav(){
    try{ if(typeof LISTV!=='undefined' && LISTV.indexOf('brouillon')<0) LISTV.push('brouillon'); }catch(e){}
    try{ if(typeof TITLES!=='undefined' && !TITLES.brouillon) TITLES.brouillon=['Brouillons','Devis en cours de préparation — pas encore envoyés.']; }catch(e){}
    var nav = document.getElementById('nav');
    if(nav){
      var av = nav.querySelector('a[data-v="verifier"]');
      if(av){
        av.setAttribute('data-v','brouillon');
        var txt = av.querySelector('.txt'); if(txt) txt.textContent='Brouillons';
        var bd = av.querySelector('.badge'); if(bd) bd.setAttribute('data-c','brouillon');
      }
      var ap = nav.querySelector('a[data-v="pret"]');
      if(ap) ap.style.display='none';
      /* regroupé : une seule entrée « Tous les devis », le filtre se fait dans la liste */
      ['brouillon','envoye','accepte'].forEach(function(v){
        var a = nav.querySelector('a[data-v="'+v+'"]'); if(a) a.style.display='none';
      });
      var at = nav.querySelector('a[data-v="tous"] .txt'); if(at) at.textContent='Tous les devis';
    }
    /* bouton rapide du tableau de bord */
    Array.prototype.forEach.call(document.querySelectorAll('.qbtn'), function(b){
      var oc = b.getAttribute('onclick')||'';
      if(oc.indexOf("go('verifier')")>=0){
        b.setAttribute('onclick', "go('brouillon')");
        Array.prototype.forEach.call(b.childNodes, function(n){
          if(n.nodeType===3 && n.textContent.trim()) n.textContent='Brouillons';
        });
      }
    });
  }

  if(typeof window.renderDash==='function'){
    var _renderDash = window.renderDash;
    window.renderDash = function(){
      var r = _renderDash.apply(this, arguments);
      try{
        var host = document.getElementById('dashKpis');
        if(host){
          var cnt = 0;
          try{ cnt = DEVIS.filter(function(x){ return norm(x.statut)==='brouillon'; }).length; }catch(e){}
          Array.prototype.forEach.call(host.querySelectorAll('.kpi'), function(k){
            var lab = k.querySelector('.lab');
            if(lab && /v[ée]rifier/i.test(lab.textContent)){
              var done=false;
              Array.prototype.forEach.call(lab.childNodes, function(n){
                if(!done && n.nodeType===3 && n.textContent.trim()){ n.textContent='Brouillons '; done=true; }
              });
              var val = k.querySelector('.val'); if(val) val.textContent = cnt;
            }
          });
        }
      }catch(e){}
      return r;
    };
  }

  /* ---------- 8. migration des devis existants ---------- */
  function migrateAll(){
    try{
      if(typeof DEVIS==='undefined' || !Array.isArray(DEVIS)) return;
      var changed=false;
      DEVIS.forEach(function(d){ if(MAP[d.statut]){ d.statut=MAP[d.statut]; changed=true; } });
      if(changed) persist();
    }catch(e){}
  }

  /* ---------- 9. styles (marine sobre) ---------- */
  function injectCSS(){
    if(document.getElementById('nx-statut-css')) return;
    var css =
      '.tag.envoye{background:var(--blue-soft)!important;color:var(--blue)!important}' +
      '.nx-actwrap{display:inline-flex;gap:5px;margin-top:6px;flex-wrap:wrap}' +
      '.nx-sbtn{font:inherit;font-size:11px;font-weight:600;padding:3px 9px;border-radius:7px;border:1px solid var(--line2);background:#fff;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;line-height:1.5;white-space:nowrap}' +
      '.nx-sbtn:hover{border-color:var(--blue);color:var(--blue)}' +
      '.nx-sbtn.mar{background:var(--blue);border-color:var(--blue);color:#fff}' +
      '.nx-sbtn.mar:hover{background:var(--blue-d);color:#fff}' +
      '.nx-sbtn.acc{color:var(--green);border-color:var(--green)}' +
      '.nx-sbtn.acc:hover{background:var(--green-soft);color:var(--green)}' +
      '.nx-sbtn.ref{color:var(--red);border-color:var(--red)}' +
      '.nx-sbtn.ref:hover{background:var(--red-soft);color:var(--red)}' +
      '.nx-segwrap{display:inline-flex;align-items:center}' +
      '.nx-seglab{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-right:8px}' +
      '.nx-seg{display:inline-flex;border:1px solid var(--line2);border-radius:10px;overflow:hidden;flex-wrap:wrap}' +
      '.nx-seg button{font:inherit;font-size:12px;font-weight:600;padding:8px 15px;border:0;border-right:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer;text-transform:none;letter-spacing:0}' +
      '.nx-seg button:last-child{border-right:0}' +
      '.nx-seg button:hover{background:#f5f7fa;color:var(--blue)}' +
      '.nx-seg button.on{background:var(--blue);color:#fff}' +
      '.nx-seg button.on:hover{background:var(--blue);color:#fff}' +
      '.nx-seg button.on.acc{background:var(--green)}' +
      '.nx-seg button.on.ref{background:var(--red)}' +
      '.nx-filterbar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}' +
      '.nx-chip{font:inherit;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:20px;border:1px solid var(--line2);background:#fff;color:var(--muted);cursor:pointer;text-transform:none;letter-spacing:0;display:inline-flex;align-items:center;gap:7px}' +
      '.nx-chip:hover{border-color:var(--blue);color:var(--blue)}' +
      '.nx-chip .nx-chipn{font-size:11px;font-weight:700;background:var(--line);color:var(--muted);border-radius:11px;padding:1px 7px;min-width:18px;text-align:center}' +
      '.nx-chip.on{background:var(--blue);border-color:var(--blue);color:#fff}' +
      '.nx-chip.on .nx-chipn{background:rgba(255,255,255,.25);color:#fff}';
    var st = document.createElement('style');
    st.id = 'nx-statut-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- boot ---------- */
  function boot(){
    injectCSS();
    migrateAll();
    tweakNav();
    buildSeg();
    buildFilterBar();
    refreshViews();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 0); });
  else setTimeout(boot, 0);

})();
