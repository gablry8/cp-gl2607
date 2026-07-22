/* ============================================================
   ClimPilot Next — next-relance.js
   Relances devis intelligentes (couche additive).
   File des devis « Envoyés » sans réponse : âge, nb de relances
   déjà faites, dernière relance, mail pré-rempli en 1 clic, et
   décision Accepté/Refusé sur place. Badge de menu.
   S'appuie sur le statut envoye + sentAt et sur mailRelance()
   existant (enrichi pour tracer chaque relance : d.relances[]).
   Chargé en dernier dans index.html.
   ============================================================ */
(function(){
  'use strict';

  var SEUIL = 7; /* jours avant de considérer un devis « à relancer » */
  var DAY = 86400000;

  function days(ts){ return ts ? Math.floor((Date.now()-ts)/DAY) : null; }
  function lastRelance(d){ var r=d.relances||[]; return r.length ? r[r.length-1] : null; }
  function needsRelance(d){
    if(d.statut!=='envoye' || !d.sentAt) return false;
    var lr = lastRelance(d);
    return lr ? (Date.now()-lr) > SEUIL*DAY : (Date.now()-d.sentAt) > SEUIL*DAY;
  }
  function relCount(){
    try{ return DEVIS.filter(needsRelance).length; }catch(e){ return 0; }
  }
  function setBadge(){
    var el = document.getElementById('nxrelBadge'); if(!el) return;
    var n = relCount(); el.textContent = n; el.style.display = n>0 ? '' : 'none';
  }
  window.nxRelBadge = setBadge;

  /* enrichit mailRelance pour tracer la relance */
  if(typeof window.mailRelance==='function'){
    var _mr = window.mailRelance;
    window.mailRelance = function(id){
      var r = _mr.apply(this, arguments);
      try{
        var d = DEVIS.find(function(x){ return x.id===id; });
        if(d){ if(!d.relances) d.relances=[]; d.relances.push(Date.now());
          if(typeof save==='function' && typeof LS!=='undefined') save(LS.devis, DEVIS); }
      }catch(e){}
      return r;
    };
  }

  window.nxRelancer = function(id){
    try{ if(typeof mailRelance==='function') mailRelance(id); }catch(e){}
    renderRelances(); setBadge();
  };
  window.nxRelDecision = function(id, s){
    try{ if(typeof window.nxSetStatut==='function') window.nxSetStatut(id, s); }catch(e){}
    renderRelances(); setBadge();
  };

  function line(d){
    var c; try{ c = compute(d); }catch(e){ c = {totalHT:0}; }
    var nm = (typeof devisName==='function') ? devisName(d) : (d.cNom||d.num||'Devis');
    var da = days(d.sentAt);
    var lr = lastRelance(d), nrel = (d.relances||[]).length;
    var sub = 'envoyé il y a ' + (da!=null?da:'?') + ' j'
            + (nrel ? ' · ' + nrel + ' relance' + (nrel>1?'s':'') + ' (dernière il y a ' + days(lr) + ' j)' : ' · jamais relancé')
            + (d.cTel ? ' · ' + d.cTel : '');
    return '<div class="recap-line">' +
      '<div style="cursor:pointer;min-width:0" onclick="openDevis(\''+d.id+'\')">' +
        '<b>'+nm+'</b><div class="sub2">'+d.num+' · '+sub+'</div></div>' +
      '<div class="row-actions" style="flex-wrap:wrap;justify-content:flex-end">' +
        '<b>'+eur0(c.totalHT)+'</b>' +
        '<button class="nx-sbtn mar" onclick="nxRelancer(\''+d.id+'\')">✉ Relancer</button>' +
        '<button class="nx-sbtn acc" onclick="nxRelDecision(\''+d.id+'\',\'accepte\')">Accepté</button>' +
        '<button class="nx-sbtn ref" onclick="nxRelDecision(\''+d.id+'\',\'refuse\')">Refusé</button>' +
      '</div></div>';
  }

  function renderRelances(){
    var host = document.getElementById('nxrel'); if(!host) return;
    var sent; try{ sent = DEVIS.filter(function(d){ return d.statut==='envoye' && d.sentAt; }); }catch(e){ sent = []; }
    sent.sort(function(a,b){ return a.sentAt - b.sentAt; });
    var due = sent.filter(needsRelance);
    var wait = sent.filter(function(d){ return !needsRelance(d); });

    var kpis = document.getElementById('nxrelKpis');
    if(kpis){
      var totDue = due.reduce(function(s,d){ try{ return s+compute(d).totalHT; }catch(e){ return s; } }, 0);
      kpis.innerHTML =
        '<div class="kpi warn"><div class="lab">À relancer<span>📞</span></div><div class="val">'+due.length+'</div></div>' +
        '<div class="kpi blue"><div class="lab">En attente récente<span>⏳</span></div><div class="val">'+wait.length+'</div></div>' +
        '<div class="kpi good"><div class="lab">Montant en jeu (à relancer)<span>€</span></div><div class="val">'+eur0(totDue)+'</div></div>';
    }

    var html = '';
    if(!sent.length){
      html = '<div class="empty">Aucun devis en attente de réponse. Les devis passés en « Envoyé » apparaîtront ici pour le suivi et les relances.</div>';
    } else {
      if(due.length) html += '<div class="card" style="border-left:4px solid var(--orange)"><h2>📞 À relancer <span class="sub" style="font-weight:400">(sans réponse depuis plus de '+SEUIL+' jours)</span></h2>' + due.map(line).join('') + '</div>';
      if(wait.length) html += '<div class="card"><h2>⏳ Envoyés récemment <span class="sub" style="font-weight:400">(laisse encore un peu de temps)</span></h2>' + wait.map(line).join('') + '</div>';
    }
    host.innerHTML = html;
    setBadge();
  }
  window.renderRelances = renderRelances;

  /* garde le badge à jour quand les statuts changent */
  if(typeof window.updateBadges==='function'){
    var _ub = window.updateBadges;
    window.updateBadges = function(){ var r = _ub.apply(this, arguments); try{ setBadge(); }catch(e){} return r; };
  }

  function boot(){
    try{
      if(typeof TITLES!=='undefined' && !TITLES.relances)
        TITLES.relances = ['Relances devis','Tes devis envoyés sans réponse — relance en 1 clic et suivi.'];

      var nav = document.getElementById('nav');
      if(nav && !nav.querySelector('a[data-v="relances"]')){
        var ref = nav.querySelector('a[data-v="tous"]') || nav.querySelector('a[data-v="commander"]');
        var a = document.createElement('a');
        a.setAttribute('data-v','relances');
        a.innerHTML = '<span class="ico">📞</span><span class="txt">Relances</span><span class="badge" id="nxrelBadge">0</span>';
        if(ref && ref.parentNode) ref.parentNode.insertBefore(a, ref.nextSibling);
        else nav.appendChild(a);
      }

      if(!document.getElementById('v-relances')){
        var dash = document.getElementById('v-dash');
        var parent = dash ? dash.parentNode : document.querySelector('.content');
        if(parent){
          var sec = document.createElement('section');
          sec.className = 'view'; sec.id = 'v-relances';
          sec.innerHTML = '<div class="kpis" id="nxrelKpis"></div><div id="nxrel"></div>';
          parent.appendChild(sec);
        }
      }

      if(typeof window.go==='function'){
        var _go = window.go;
        window.go = function(v){
          var r = _go.apply(this, arguments);
          try{ if(v==='relances') renderRelances(); }catch(e){}
          return r;
        };
      }
      setBadge();
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);

})();
