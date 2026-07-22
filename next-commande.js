/* ============================================================
   ClimPilot Next — next-commande.js
   Réservation matériel + bon de commande fournisseur (additif).
   Dans « À commander » :
   - Bon de commande PDF : agrège le « reste à commander » (besoin
     des chantiers signés − stock, hors articles déjà cochés), et
     l'édite en document propre (via l'aperçu PDF).
   - Réservation par chantier : une case « matériel réservé/commandé »
     par devis accepté (stockée dans d.matReserve, donc synchronisée),
     avec la date. Suivi X/Y chantiers prêts. Ne modifie aucun calcul
     ni le stock : c'est un simple pointage.
   Chargé en dernier dans index.html.
   ============================================================ */
(function(){
  'use strict';

  function accepted(){ try{ return DEVIS.filter(function(d){ return d.statut==='accepte'; }); }catch(e){ return []; } }

  function resteACommander(){
    var agg = {};
    accepted().forEach(function(d){
      try{
        compute(d).mat.forEach(function(m){
          var k = m.nom + '|' + m.unite;
          if(!agg[k]) agg[k] = {nom:m.nom, unite:m.unite, qte:0, achatU:m.achatU};
          agg[k].qte += m.qte;
        });
      }catch(e){}
    });
    var rows = Object.keys(agg).map(function(k){ return agg[k]; });
    rows.forEach(function(r){ r.stock = Number(STOCK[r.nom])||0; r.aCmd = Math.max(0, r.qte - r.stock); });
    return rows.filter(function(r){ return r.aCmd>0 && !CMD[r.nom]; })
               .sort(function(a,b){ return a.nom.localeCompare(b.nom); });
  }

  window.nxBonCommande = function(){
    var acc = accepted();
    if(!acc.length){ if(typeof toast==='function') toast('Aucun chantier signé — rien à commander.'); return; }
    var toOrder = resteACommander();
    if(!toOrder.length){ if(typeof toast==='function') toast('Rien à commander : tout est en stock ou déjà coché commandé.'); return; }
    var fourn = '';
    try{ fourn = (window.prompt ? (prompt('Nom du fournisseur (facultatif) :','') || '') : ''); }catch(e){}
    var E = (typeof P!=='undefined' && P.entreprise) || {};
    var NV = '#1f4e79';
    var today = new Date().toLocaleDateString('fr-FR');
    var ref = 'BC-' + new Date().toISOString().slice(0,10).replace(/-/g,'');
    var totalHT = toOrder.reduce(function(s,r){ return s + r.aCmd*r.achatU; }, 0);
    var CUBE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5M12 12v9"/></svg>';
    var head = (typeof docTop==='function') ? docTop(E, NV, CUBE, today, ' — bon de commande')
                                            : '<div style="font-size:19px;font-weight:800">'+(E.nom||'—')+'</div>';
    var body = toOrder.map(function(r){
      return '<tr>' +
        '<td style="padding:8px 10px;border-top:1px solid #e6ebf2">'+r.nom+'</td>' +
        '<td style="padding:8px 10px;border-top:1px solid #e6ebf2;text-align:center;font-weight:600">'+fmtQ(r.aCmd)+' '+r.unite+'</td>' +
        '<td style="padding:8px 10px;border-top:1px solid #e6ebf2;text-align:right">'+eur(r.achatU)+'</td>' +
        '<td style="padding:8px 10px;border-top:1px solid #e6ebf2;text-align:right;font-weight:600">'+eur(r.aCmd*r.achatU)+'</td></tr>';
    }).join('');
    document.getElementById('devisDoc').innerHTML =
      '<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px">' +
      head +
      '<div style="margin:12px 0 4px"><span style="font-size:20px;font-weight:800;color:'+NV+'">Bon de commande '+ref+'</span></div>' +
      (fourn ? '<div style="font-size:12px;margin-bottom:4px"><b>Fournisseur :</b> '+fourn+'</div>' : '') +
      '<div style="font-size:11px;color:#555;margin-bottom:12px">Matériel nécessaire aux chantiers signés, déduction faite du stock. Quantités à commander uniquement.</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #dce3ec">' +
        '<thead><tr style="background:'+NV+';color:#fff"><th style="text-align:left;padding:9px 10px">Article</th><th style="padding:9px 10px">Qté à commander</th><th style="text-align:right;padding:9px 10px">PU HT</th><th style="text-align:right;padding:9px 10px">Total HT</th></tr></thead>' +
        '<tbody>'+body+'</tbody>' +
        '<tfoot><tr style="background:#eef2f7"><td colspan="3" style="text-align:right;padding:9px 10px;font-weight:800;color:'+NV+'">Total HT à commander</td><td style="text-align:right;padding:9px 10px;font-weight:800;color:'+NV+'">'+eur(totalHT)+'</td></tr></tfoot>' +
      '</table>' +
      '<div style="margin-top:10px;font-size:10.5px;color:#777">Prix d\'achat indicatifs issus de ta base de prix — à confirmer avec le fournisseur. Document interne de commande, non contractuel.</div>' +
      ((typeof docLegal==='function') ? docLegal(E, NV) : '') +
      '</div>';
    if(typeof window.print==='function') window.print();
  };

  window.nxToggleResa = function(id, checked){
    try{
      var d = DEVIS.find(function(x){ return x.id===id; }); if(!d) return;
      d.matReserve = checked ? Date.now() : null;
      if(typeof save==='function' && typeof LS!=='undefined') save(LS.devis, DEVIS);
    }catch(e){}
    renderCmdPanel();
  };

  function renderCmdPanel(){
    var host = document.getElementById('nxcmd'); if(!host) return;
    var acc = accepted();
    var done = acc.filter(function(d){ return d.matReserve; }).length;
    var toOrder = resteACommander();
    var resteHT = toOrder.reduce(function(s,r){ return s + r.aCmd*r.achatU; }, 0);
    var rows = acc.map(function(d){
      var tot = 0; try{ tot = compute(d).mat.reduce(function(s,m){ return s + m.achatU*m.qte; }, 0); }catch(e){}
      var at = d.matReserve ? new Date(d.matReserve).toLocaleDateString('fr-FR') : '';
      return '<label class="nxresa-row">' +
        '<input type="checkbox" '+(d.matReserve?'checked':'')+' onchange="nxToggleResa(\''+d.id+'\',this.checked)">' +
        '<span class="nxresa-nm">'+devisName(d)+'</span>' +
        '<span class="nxresa-meta">'+d.num+' · achat '+eur(tot)+(at?' · réservé le '+at:'')+'</span></label>';
    }).join('');
    host.innerHTML =
      '<div class="card" style="border-left:4px solid var(--blue)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<h2 style="margin:0">🧾 Commande &amp; réservation</h2>' +
          '<button class="btn-dark btn-sm" onclick="nxBonCommande()">🧾 Éditer un bon de commande (PDF)</button>' +
        '</div>' +
        (toOrder.length ? '<div class="sub" style="margin-top:6px">Reste à commander : <b>'+eur(resteHT)+' HT</b> sur '+toOrder.length+' article(s).</div>' : '<div class="sub" style="margin-top:6px">Rien à commander : tout est en stock ou déjà commandé.</div>') +
        (acc.length
          ? '<div class="sub" style="margin:10px 0 8px">Pointe chaque chantier quand son matériel est commandé/réservé — <b>'+done+'/'+acc.length+'</b> prêts.</div>' + rows
          : '<div class="sub" style="margin-top:8px">Aucun chantier signé pour l\'instant.</div>') +
      '</div>';
  }
  window.renderCmdPanel = renderCmdPanel;

  function injectCSS(){
    if(document.getElementById('nxcmd-css')) return;
    var css =
      '.nxresa-row{display:flex;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid var(--line);text-transform:none;letter-spacing:0;font-weight:400;cursor:pointer}' +
      '.nxresa-row input{width:auto;flex:0 0 auto}' +
      '.nxresa-nm{font-weight:600;font-size:13px}' +
      '.nxresa-meta{margin-left:auto;color:var(--muted);font-size:11.5px;text-align:right}';
    var st = document.createElement('style'); st.id = 'nxcmd-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  function boot(){
    try{
      injectCSS();
      var view = document.getElementById('v-commander');
      if(view && !document.getElementById('nxcmd')){
        var panel = document.createElement('div');
        panel.id = 'nxcmd';
        view.insertBefore(panel, view.firstChild);
      }
      if(typeof window.go==='function'){
        var _go = window.go;
        window.go = function(v){
          var r = _go.apply(this, arguments);
          try{ if(v==='commander') renderCmdPanel(); }catch(e){}
          return r;
        };
      }
      if(typeof window.renderCommander==='function'){
        var _rc = window.renderCommander;
        window.renderCommander = function(){
          var r = _rc.apply(this, arguments);
          try{ renderCmdPanel(); }catch(e){}
          return r;
        };
      }
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);

})();
