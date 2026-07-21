/* ===================================================================
   ClimPilot Next — Recherche d'entreprise (clients pros)
   2026-07-21. Utilise l'API publique gratuite recherche-entreprises.api.gouv.fr
   (annuaire des entreprises, données INSEE/RNE). Tape un nom ou un SIRET :
   remplit automatiquement nom, SIREN et adresse du client pro.
   100 % additif : si l'API est indisponible (hors ligne), on saisit à la main.
   =================================================================== */
(function () {
  "use strict";
  var API = "https://recherche-entreprises.api.gouv.fr/search";
  var CACHE = {}, TMR = {};
  var MAP = {
    f:  { nom:"f_cNom",  siren:"f_cSiren",  adr:"f_cAdr",  ville:"f_cVille",  type:"f_cType",  after:function(){ try{ updateWizName(); }catch(e){} } },
    dp: { nom:"dp_cNom", siren:"dp_cSiren", adr:"dp_cAdr", ville:"dp_cVille", type:"dp_cType" }
  };
  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function close(prefix){ var b=el(prefix+"_cSearchRes"); if(b){ b.innerHTML=""; b.classList.remove("on"); } }

  window.climSirenSearch = function (q, prefix) {
    clearTimeout(TMR[prefix]);
    var box = el(prefix + "_cSearchRes"); if (!box) return;
    q = (q || "").trim();
    if (q.length < 3) { close(prefix); return; }
    TMR[prefix] = setTimeout(function () {
      box.innerHTML = '<div class="clim-siren-msg">Recherche…</div>'; box.classList.add("on");
      fetch(API + "?per_page=6&q=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var rs = (d && d.results) || []; CACHE[prefix] = rs;
          if (!rs.length) { box.innerHTML = '<div class="clim-siren-msg">Aucune entreprise trouvée.</div>'; return; }
          box.innerHTML = rs.map(function (x, i) {
            var s = x.siege || {}, ville = [s.code_postal, s.libelle_commune].filter(Boolean).join(" ");
            return '<div class="clim-siren-item" onclick="climSirenPick(\'' + prefix + '\',' + i + ')">' +
                   '<b>' + esc(x.nom_complet || x.nom_raison_sociale || "—") + '</b>' +
                   '<small>SIREN ' + esc(x.siren) + (ville ? " · " + esc(ville) : "") + '</small></div>';
          }).join("");
        })
        .catch(function () { box.innerHTML = '<div class="clim-siren-msg">Recherche indisponible (hors ligne ?) — saisis à la main.</div>'; });
    }, 320);
  };

  window.climSirenPick = function (prefix, i) {
    var x = (CACHE[prefix] || [])[i]; if (!x) return;
    var m = MAP[prefix], s = x.siege || {};
    var street = [s.numero_voie, s.type_voie, s.libelle_voie].filter(Boolean).join(" ") || s.adresse || "";
    var ville = [s.code_postal, s.libelle_commune].filter(Boolean).join(" ");
    var set = function (id, v) { var e = el(id); if (e && v != null && v !== "") e.value = v; };
    set(m.nom, x.nom_complet || x.nom_raison_sociale || "");
    set(m.siren, x.siren || "");
    set(m.adr, street);
    set(m.ville, ville);
    var t = el(m.type); if (t) t.value = "Professionnel";
    var sr = el(prefix + "_cSearch"); if (sr) sr.value = "";
    close(prefix);
    if (m.after) m.after();
  };

  document.addEventListener("click", function (e) {
    ["f", "dp"].forEach(function (p) {
      var box = el(p + "_cSearchRes"), inp = el(p + "_cSearch");
      if (box && box.classList.contains("on") && e.target !== inp && !box.contains(e.target)) close(p);
    });
  });
})();
