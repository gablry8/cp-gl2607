/* ============================================================
   ClimPilot Next — next-activite.js
   Tableau de bord PAR ACTIVITÉ (couche additive).
   Répartit CA HT et marge de l'année en cours par métier :
   Climatisation, Froid commercial, Adiabatique, Dépannage & MES,
   Entretien (contrats). Lecture seule — ne touche aucun calcul.
   Nouvelle entrée de menu « Par activité » + vue dédiée.
   Chargé en dernier dans index.html.
   ============================================================ */
(function(){
  'use strict';

  var CLIM = ['Monosplit','Bisplit','Trisplit','Quadrisplit','Plusieurs monosplits',
              'Multisplit personnalisé','Gainable','PAC air-air','PAC air-eau','Ballon thermodynamique'];

  function bucketOf(type){
    if(type==='Chambre froide') return 'froid';
    if(type==='Adiabatique') return 'adia';
    if(type==='Dépannage' || type==='Maintenance') return 'dep';
    return 'clim';
  }

  function actData(){
    var year = new Date().getFullYear();
    var b = {
      clim:  {lbl:'Climatisation',            ca:0, benef:0, n:0, marge:true},
      froid: {lbl:'Froid commercial',          ca:0, benef:0, n:0, marge:true},
      adia:  {lbl:'Adiabatique',               ca:0, benef:0, n:0, marge:true},
      dep:   {lbl:'Dépannage & mise en service',ca:0, benef:0, n:0, marge:true},
      ent:   {lbl:'Entretien (contrats)',      ca:0, benef:0, n:0, marge:false}
    };
    try{
      DEVIS.forEach(function(d){
        if(d.statut!=='accepte') return;
        if(new Date(d.created||0).getFullYear()!==year) return;
        var c = compute(d), k = bucketOf(d.type||'');
        b[k].ca += c.totalHT; b[k].benef += c.benefice; b[k].n++;
      });
    }catch(e){}
    try{
      DEP.forEach(function(x){
        if(x.statut==='brouillon') return;
        if(new Date(x.facDate||x.created||0).getFullYear()!==year) return;
        var c = computeDep(x); b.dep.ca += c.totalHT; b.dep.benef += c.benefice; b.dep.n++;
      });
    }catch(e){}
    try{
      LOC.forEach(function(l){
        if(!l.fac) return;
        if(new Date(l.fac.date||l.dateDebut||l.created||0).getFullYear()!==year) return;
        b.adia.ca += Number(l.fac.montant)||0; b.adia.n++; b.adia.locOnly = (b.adia.locOnly||0) + (Number(l.fac.montant)||0);
      });
    }catch(e){}
    try{
      CTR.forEach(function(c){
        (c.facs||[]).forEach(function(f){
          var y = f.annee!=null ? Number(f.annee) : new Date(f.date||0).getFullYear();
          if(y!==year) return;
          b.ent.ca += Number(f.montant)||0; b.ent.n++;
        });
      });
    }catch(e){}
    return {year:year, b:b};
  }

  function renderActivite(){
    var host = document.getElementById('nxact'); if(!host) return;
    var data = actData(), b = data.b;
    var order = ['clim','froid','adia','dep','ent'];
    var total = order.reduce(function(s,k){ return s + b[k].ca; }, 0);
    var totBenef = order.reduce(function(s,k){ return b[k].marge ? s + b[k].benef : s; }, 0);
    var max = Math.max.apply(null, order.map(function(k){ return b[k].ca; }).concat([1]));

    var top = order.slice().filter(function(k){return b[k].ca>0;})
                   .sort(function(x,y){ return b[y].ca - b[x].ca; })[0];
    var kpis = document.getElementById('nxactKpis');
    if(kpis){
      kpis.innerHTML =
        '<div class="kpi good"><div class="lab">CA '+data.year+' HT<span>€</span></div><div class="val">'+eur0(total)+'</div></div>' +
        '<div class="kpi blue"><div class="lab">Marge estimée<span>📈</span></div><div class="val">'+eur0(totBenef)+'</div></div>' +
        '<div class="kpi"><div class="lab">Activité n°1<span>🏆</span></div><div class="val" style="font-size:18px">'+(top?b[top].lbl:'—')+'</div></div>';
    }

    if(total<=0){ host.innerHTML = '<div class="empty">Aucun chiffre d\'affaires enregistré cette année. Les devis acceptés, interventions facturées, locations et contrats apparaîtront ici, ventilés par métier.</div>'; return; }

    var IC = {clim:'❄️',froid:'🧊',adia:'💨',dep:'🔧',ent:'🤝'};
    host.innerHTML = order.map(function(k){
      var x = b[k], part = total>0 ? x.ca/total*100 : 0;
      var margePct = (x.marge && x.ca>0) ? x.benef/x.ca*100 : null;
      var margeTxt = x.marge
        ? (x.ca>0 ? eur0(x.benef)+' &nbsp;<span class="sub2">('+pct(margePct)+')</span>' : '—')
        : '<span class="sub2">non suivie</span>';
      return '<div style="margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">' +
          '<b>'+IC[k]+' '+x.lbl+'</b>' +
          '<span><b>'+eur0(x.ca)+'</b> <span class="sub2">'+pct(part)+' · '+x.n+' op.</span></span>' +
        '</div>' +
        '<div style="height:9px;border-radius:6px;background:var(--line);margin:5px 0;overflow:hidden">' +
          '<div style="height:100%;width:'+(x.ca/max*100)+'%;background:var(--blue)"></div></div>' +
        '<div class="sub2">Marge estimée : '+margeTxt+'</div>' +
      '</div>';
    }).join('') +
    '<div class="sub" style="margin-top:6px;border-top:1px solid var(--line);padding-top:10px">' +
      'CA HT de l\'année en cours. Devis = acceptés · Dépannage/MES = interventions facturées · Adiabatique = devis + locations facturées · Entretien = contrats facturés. ' +
      'La marge n\'est pas suivie sur les locations et les contrats (pas de coût matière saisi).</div>';
  }
  window.renderActivite = renderActivite;

  function boot(){
    try{
      if(typeof TITLES!=='undefined' && !TITLES.activite)
        TITLES.activite = ['Rentabilité par activité','Ton chiffre d\'affaires et ta marge, métier par métier — année en cours.'];

      var nav = document.getElementById('nav');
      if(nav && !nav.querySelector('a[data-v="activite"]')){
        var ref = nav.querySelector('a[data-v="recettes"]') || nav.querySelector('a[data-v="commander"]');
        var a = document.createElement('a');
        a.setAttribute('data-v','activite');
        a.innerHTML = '<span class="ico">📈</span><span class="txt">Par activité</span>';
        if(ref && ref.parentNode) ref.parentNode.insertBefore(a, ref.nextSibling);
        else nav.appendChild(a);
      }

      if(!document.getElementById('v-activite')){
        var dash = document.getElementById('v-dash');
        var parent = dash ? dash.parentNode : document.querySelector('.content');
        if(parent){
          var sec = document.createElement('section');
          sec.className = 'view'; sec.id = 'v-activite';
          sec.innerHTML = '<div class="kpis" id="nxactKpis"></div>' +
                          '<div class="card"><h2>📊 Répartition par métier</h2><div id="nxact"></div></div>';
          parent.appendChild(sec);
        }
      }

      if(typeof window.go==='function'){
        var _go = window.go;
        window.go = function(v){
          var r = _go.apply(this, arguments);
          try{ if(v==='activite') renderActivite(); }catch(e){}
          return r;
        };
      }
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);

})();
