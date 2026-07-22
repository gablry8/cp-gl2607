/* ============================================================
   ClimPilot Next — next-pdf.js
   Correctif d'impression / PDF (couche additive).
   Problème : tous les boutons « Aperçu / PDF » remplissent la
   zone cachée #devisDoc puis appellent window.print(). Sur Chrome
   et iOS, l'impression de la page entière via @media print sort
   BLANCHE.
   Solution : on intercepte window.print() -> on affiche d'abord un
   APERÇU plein écran (le document rendu, visible), avec :
     - « Imprimer / Enregistrer en PDF » : imprime un document
       propre et isolé (iframe), sans le CSS de l'appli => fiable.
     - « Ouvrir dans un onglet » : ouvre le document seul dans un
       onglet (idéal iPhone/iPad : Partager -> Imprimer / PDF).
   Un seul point d'interception (window.print) couvre TOUS les PDF
   (devis, factures, contrats, fiches fluides, PV, checklist…).
   Se compose avec next-regime (qui rappelle le vrai print).
   Chargé en dernier dans index.html.
   ============================================================ */
(function(){
  'use strict';

  var realPrint = (typeof window.print === 'function') ? window.print.bind(window) : null;
  var HINT = 'Astuce : dans la fenêtre d’impression, choisis « Enregistrer au format PDF » comme imprimante.';

  function docTitle(){
    try{
      var t = document.querySelector('#nx-pdf-page h1');
      if(t && t.textContent.trim()) return t.textContent.trim().slice(0,60);
    }catch(e){}
    return 'ClimPilot — document';
  }

  function pageWrapper(inner, title){
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + (title||'Document') + '</title><style>' +
      '@page{size:A4;margin:12mm}' +
      'html,body{margin:0;padding:0}' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#222;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '</style></head><body>' + inner + '</body></html>';
  }

  /* ---- impression via iframe isolé (fiable, sans CSS de l'appli) ---- */
  function printViaIframe(inner, title){
    var fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden','true');
    fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    var d = fr.contentWindow.document;
    d.open(); d.write(pageWrapper(inner, title)); d.close();
    var fire = function(){
      try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(e){}
      setTimeout(function(){ try{ document.body.removeChild(fr); }catch(e){} }, 60000);
    };
    if(d.readyState === 'complete') setTimeout(fire, 200);
    else fr.onload = function(){ setTimeout(fire, 200); };
  }

  /* ---- ouverture dans un onglet (fallback universel iOS) ---- */
  function openInTab(inner, title){
    try{
      var blob = new Blob([pageWrapper(inner, title)], {type:'text/html'});
      var url = URL.createObjectURL(blob);
      var w = window.open(url, '_blank');
      if(!w){ if(typeof toast==='function') toast('Ton navigateur a bloqué l’ouverture — autorise les fenêtres pop-up.'); }
      setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
    }catch(e){
      var w2 = window.open('', '_blank');
      if(w2){ w2.document.open(); w2.document.write(pageWrapper(inner, title)); w2.document.close(); }
    }
  }

  /* ---- CSS de l'aperçu (marine sobre) ---- */
  function injectCSS(){
    if(document.getElementById('nx-pdf-css')) return;
    var css =
      '#nx-pdf-modal{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:none;flex-direction:column}' +
      '#nx-pdf-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#16233a;color:#fff;flex-wrap:wrap}' +
      '#nx-pdf-bar .t{font-weight:600;font-size:14px;margin-right:auto;display:flex;align-items:center;gap:8px}' +
      '#nx-pdf-bar .hint{font-size:11px;color:#b9c6dc;font-weight:400;width:100%;order:3}' +
      '.nx-pdf-btn{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;cursor:pointer;white-space:nowrap}' +
      '.nx-pdf-btn:hover{background:rgba(255,255,255,.12)}' +
      '.nx-pdf-btn.pri{background:#1f4e79;border-color:#1f4e79}' +
      '.nx-pdf-btn.pri:hover{background:#2a5f92}' +
      '#nx-pdf-scroll{flex:1;overflow:auto;padding:22px 12px;-webkit-overflow-scrolling:touch}' +
      '#nx-pdf-page{background:#fff;max-width:820px;margin:0 auto;padding:30px 34px;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.35);color:#222}' +
      '@media(max-width:620px){#nx-pdf-page{padding:18px}}';
    var st = document.createElement('style'); st.id = 'nx-pdf-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  function buildModal(){
    if(document.getElementById('nx-pdf-modal')) return;
    injectCSS();
    var m = document.createElement('div');
    m.id = 'nx-pdf-modal';
    m.innerHTML =
      '<div id="nx-pdf-bar">' +
        '<span class="t">Aperçu du document</span>' +
        '<button class="nx-pdf-btn pri" id="nx-pdf-print">🖨️ Imprimer / Enregistrer en PDF</button>' +
        '<button class="nx-pdf-btn" id="nx-pdf-tab">Ouvrir dans un onglet</button>' +
        '<button class="nx-pdf-btn" id="nx-pdf-close">Fermer</button>' +
        '<span class="hint">' + HINT + '</span>' +
      '</div>' +
      '<div id="nx-pdf-scroll"><div id="nx-pdf-page"></div></div>';
    document.body.appendChild(m);
    document.getElementById('nx-pdf-print').addEventListener('click', function(){
      printViaIframe(document.getElementById('nx-pdf-page').innerHTML, docTitle());
    });
    document.getElementById('nx-pdf-tab').addEventListener('click', function(){
      openInTab(document.getElementById('nx-pdf-page').innerHTML, docTitle());
    });
    document.getElementById('nx-pdf-close').addEventListener('click', closePreview);
    m.addEventListener('click', function(e){ if(e.target === m) closePreview(); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ var mm = document.getElementById('nx-pdf-modal'); if(mm && mm.style.display === 'flex') closePreview(); }
    });
  }

  function showPreview(html){
    buildModal();
    document.getElementById('nx-pdf-page').innerHTML = html;
    document.getElementById('nx-pdf-scroll').scrollTop = 0;
    document.getElementById('nx-pdf-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closePreview(){
    var m = document.getElementById('nx-pdf-modal');
    if(m) m.style.display = 'none';
    document.body.style.overflow = '';
  }
  window.nxClosePreview = closePreview;

  /* ---- interception unique de window.print ---- */
  window.print = function(){
    try{
      var doc = document.getElementById('devisDoc');
      if(doc && doc.innerHTML && doc.innerHTML.trim()){ showPreview(doc.innerHTML); return; }
    }catch(e){}
    if(realPrint) return realPrint();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ buildModal(); }catch(e){} });
  else { try{ buildModal(); }catch(e){} }

})();
