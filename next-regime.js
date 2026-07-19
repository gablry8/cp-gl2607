/*
 * ClimPilot Next — module « Statut & régime » (étape 2, 2026-07-20).
 * Comparateur micro-entreprise / micro+TVA / EURL-IS / SASU avec les chiffres réels de Gabriel.
 * Fichier isolé : ne touche pas au moteur historique. Chargé après next-addons.js.
 *
 * TAUX VÉRIFIÉS 07/2026 (sources : URSSAF, economie.gouv, legifiscal) :
 *   - Micro BIC prestations : 21,2 % (10,6 % avec ACRE année 1)
 *   - Versement libératoire : 1,7 % · Plafond micro : 77 700 € · Franchise TVA : 37 500 / 41 250 €
 *   - IS : 15 % jusqu'à 42 500 €, 25 % au-delà · PFU dividendes : 30 %
 * ORDRES DE GRANDEUR (à affiner avec un expert-comptable) :
 *   - Cotisations TNS ≈ 45 % de la rémunération nette (minimum ≈ 1 200 €/an)
 *   - SASU : coût total ≈ 1,80 × le salaire net
 *   - CFP + chambre des métiers ≈ 0,52 % (hypothèse du business plan)
 */
(function(){
  'use strict';

  var RG_KEY='cpnext_regime';
  var RG_DEF={
    caBase:74450,      // CA main-d'œuvre + déplacements HT/an (hypothèse business plan)
    achats:15000,      // achats matériel HT/an revendus aux clients — À AJUSTER
    margeMat:25,       // marge sur matériel %
    fournirMat:true,   // je fournis le matériel (sinon le client l'achète en direct)
    acre:true,         // année 1 avec ACRE
    chargesFixes:14950,// charges fixes annuelles (business plan)
    creditMois:600,    // crédit camion €/mois
    remNette:1800,     // rémunération nette €/mois visée en société
    comptable:1800,    // expert-comptable €/an (société) — devis à demander
    capital:1000       // capital social (règle des 10 % dividendes EURL)
  };
  var rg=Object.assign({},RG_DEF);
  try{var s=JSON.parse(localStorage.getItem(RG_KEY));if(s&&typeof s==='object')Object.assign(rg,s);}catch(e){}
  try{if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(RG_KEY)<0)SYNC_KEYS.push(RG_KEY);}catch(e){}

  function rgSave(){localStorage.setItem(RG_KEY,JSON.stringify(rg));try{markDirty();}catch(e){}}
  function rgFmt(v){var n=Math.round(Number(v)||0);try{return eur(n);}catch(e){return n.toLocaleString('fr-FR')+' €';}}
  function rgEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}

  /*CALC-START*/
  var RG_RATES={
    microA1:0.106, microA2:0.212, microTaxes:0.0052, vl:0.017,
    plafondMicro:77700, seuilFranchise:37500,
    isBas:0.15, isSeuil:42500, isHaut:0.25,
    tnsFactor:0.45, tnsMin:1200, sasuFactor:1.80,
    pfu:0.30, irDiv:0.128, tva:0.20
  };

  function nxrgCompute(p){
    var R=RG_RATES;
    var caMat=p.fournirMat?p.achats*(1+p.margeMat/100):0;
    var caTotal=p.caBase+caMat;
    var matHT=p.fournirMat?p.achats:0;
    var creditAn=p.creditMois*12;
    var remAn=p.remNette*12;
    var out={caTotal:caTotal,caMat:caMat,statuts:[]};

    function micro(franchise){
      var taux=p.acre?R.microA1:R.microA2;
      var cotis=caTotal*taux, taxes=caTotal*R.microTaxes, vl=caTotal*R.vl;
      var coutMat=matHT*(franchise?(1+R.tva):1);
      var net=caTotal-cotis-taxes-vl-coutMat-p.chargesFixes-creditAn;
      var al=[];
      if(caTotal>R.plafondMicro)al.push('CA total '+Math.round(caTotal).toLocaleString('fr-FR')+' € > plafond micro 77 700 € → micro impossible en régime de croisière (tolérance : 1 seul dépassement).');
      if(franchise&&p.caBase>R.seuilFranchise)al.push('Prestations > 37 500 € → la franchise de TVA tombe en cours d’année : ce scénario n’est tenable qu’en début d’activité.');
      if(franchise)al.push('TVA 20 % non récupérable sur le matériel ('+Math.round(matHT*R.tva).toLocaleString('fr-FR')+' €/an perdus) — et tes clients ne profitent pas du nouveau taux de 5,5 % sur les PAC éligibles.');
      return{label:franchise?'Micro (franchise TVA)':'Micro assujetti TVA',
        rows:[['Cotisations ('+(taux*100).toFixed(1).replace('.',',')+' %)',-cotis],['CFP + chambre (0,52 %)',-taxes],['Impôt (VL 1,7 %, IR inclus)',-vl],['Matériel ('+(franchise?'TTC':'HT récup.')+')',-coutMat],['Charges fixes',-p.chargesFixes],['Crédit camion',-creditAn]],
        net:net,irInclus:true,alerts:al};
    }

    function societe(sasu){
      var al=[];
      var coutRem, cotis;
      if(sasu){cotis=remAn*(R.sasuFactor-1);coutRem=remAn+cotis;
        if(remAn===0)al.push('Salaire 0 € = AUCUNE protection sociale (ni retraite ni maladie).');
      }else{cotis=remAn>0?Math.max(remAn*R.tnsFactor,R.tnsMin):R.tnsMin;coutRem=remAn+cotis;}
      var resIS=caTotal-matHT-p.chargesFixes-creditAn-p.comptable-coutRem;
      var IS=0,div=0,netDiv=0;
      if(resIS<0){al.push('Résultat négatif de '+Math.round(-resIS).toLocaleString('fr-FR')+' € : ta rémunération est trop haute pour ce CA — baisse-la ou monte le CA.');}
      else{
        IS=Math.min(resIS,R.isSeuil)*R.isBas+Math.max(0,resIS-R.isSeuil)*R.isHaut;
        div=resIS-IS;
        if(sasu){netDiv=div*(1-R.pfu);}
        else{
          var d10=p.capital*0.10;
          var eligible=Math.min(div,d10), exces=Math.max(0,div-d10);
          netDiv=eligible*(1-R.pfu)+exces*(1-R.tnsFactor)*(1-R.irDiv);
          if(exces>0)al.push('EURL : '+Math.round(exces).toLocaleString('fr-FR')+' € de dividendes au-delà de 10 % du capital → soumis aux cotisations TNS (~45 %). Augmenter le capital ou préférer la rémunération.');
        }
      }
      var net=remAn+Math.max(0,netDiv)+(resIS<0?resIS:0);
      return{label:sasu?'SASU à l’IS':'EURL à l’IS (gérant TNS)',
        rows:[['Rémunération nette',remAn>0?remAn:0],['Cotisations sociales',-cotis],['Matériel (HT, TVA récup.)',-matHT],['Charges fixes + camion',-(p.chargesFixes+creditAn)],['Expert-comptable',-p.comptable],['IS',-IS],['Dividendes nets (après '+(sasu?'PFU 30 %':'PFU/TNS')+')',netDiv]],
        net:net,irInclus:false,alerts:al,resIS:resIS};
    }

    out.statuts=[micro(true),micro(false),societe(false),societe(true)];
    return out;
  }
  /*CALC-END*/

  function rgInput(id,label,val,step,suffix){
    return '<label>'+label+(suffix?' <span class="sub">('+suffix+')</span>':'')+'<input type="number" step="'+(step||100)+'" id="rg_'+id+'" value="'+val+'" oninput="nxrgSet(\''+id+'\',this.value)"></label>';
  }

  function renderRegime(){
    var box=document.getElementById('nxRegime');if(!box)return;
    var r=nxrgCompute(rg);
    var maxNet=Math.max.apply(null,r.statuts.map(function(s){return Math.max(1,s.net);}));

    var inputs='<div class="next-card"><h3>⚙ Tes hypothèses <span class="sub">— tout est modifiable, rien n’est inventé : les valeurs pré-remplies viennent de ton business plan et sont à ajuster</span></h3>'
      +'<div class="next-form">'
      +rgInput('caBase','CA main-d’œuvre + déplacements HT/an',rg.caBase,500)
      +rgInput('achats','Achats matériel HT/an',rg.achats,500,'0 si le client achète en direct')
      +rgInput('margeMat','Marge sur matériel %',rg.margeMat,5)
      +rgInput('chargesFixes','Charges fixes annuelles',rg.chargesFixes,100)
      +rgInput('creditMois','Crédit camion €/mois',rg.creditMois,50)
      +rgInput('remNette','Rémunération nette visée €/mois (société)',rg.remNette,100)
      +rgInput('comptable','Expert-comptable €/an (société)',rg.comptable,100,'devis à demander')
      +rgInput('capital','Capital social € (EURL)',rg.capital,500)
      +'<label>Année<select id="rg_acre" onchange="nxrgSet(\'acre\',this.value===\'1\')"><option value="1"'+(rg.acre?' selected':'')+'>Année 1 — ACRE (10,6 %)</option><option value="0"'+(rg.acre?'':' selected')+'>Année 2+ (21,2 %)</option></select></label>'
      +'<label>Matériel<select id="rg_mat" onchange="nxrgSet(\'fournirMat\',this.value===\'1\')"><option value="1"'+(rg.fournirMat?' selected':'')+'>Je fournis (revendu avec marge)</option><option value="0"'+(rg.fournirMat?'':' selected')+'>Le client achète en direct</option></select></label>'
      +'</div>'
      +'<div class="sub" style="margin-top:8px">CA total simulé : <b>'+rgFmt(r.caTotal)+'</b>'+(r.caMat>0?' (dont '+rgFmt(r.caMat)+' de matériel revendu)':'')+'</div></div>';

    var cards='<div class="next-grid">';
    var best=r.statuts.reduce(function(a,b){return b.net>a.net?b:a;});
    r.statuts.forEach(function(s){
      var pct=Math.max(2,Math.round(s.net/maxNet*100));
      var isBest=(s===best&&s.net>0);
      cards+='<div class="next-card next-col-6"'+(isBest?' style="border-left:4px solid var(--next-mint,#34d399)"':'')+'>'
        +'<h3>'+rgEsc(s.label)+(isBest?' <span class="badge" style="background:#34d399;color:#06281c">meilleur net</span>':'')+'</h3>'
        +'<table style="width:100%;font-size:13px;border-collapse:collapse">'
        +s.rows.map(function(row){return '<tr><td style="padding:2px 0;color:var(--next-muted,#8fa3c8)">'+rgEsc(row[0])+'</td><td style="text-align:right;white-space:nowrap">'+(row[1]<0?'− ':'')+rgFmt(Math.abs(row[1]))+'</td></tr>';}).join('')
        +'</table>'
        +'<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(143,163,200,.25)"><b style="font-size:17px">'+rgFmt(s.net)+'</b> <span class="sub">net dispo/an ≈ '+rgFmt(s.net/12)+'/mois'+(s.irInclus?' — impôt inclus':' — AVANT impôt sur le revenu sur ta rémunération')+'</span></div>'
        +'<div style="background:rgba(143,163,200,.15);border-radius:6px;height:8px;margin-top:8px"><div style="height:8px;border-radius:6px;width:'+pct+'%;background:'+(isBest?'#34d399':'#5b8def')+'"></div></div>'
        +s.alerts.map(function(a){return '<div class="sub" style="margin-top:8px;color:#f59e0b">⚠ '+rgEsc(a)+'</div>';}).join('')
        +'</div>';
    });
    cards+='</div>';

    var explain='<details class="next-card" style="margin-top:14px"><summary style="cursor:pointer"><b>🧮 Comment c’est calculé (et ce qui est vérifié vs approximatif)</b></summary>'
      +'<div class="sub" style="margin-top:10px;line-height:1.7">'
      +'<b>Micro</b> : cotisations = CA total × 21,2 % (10,6 % ACRE) — <b>vérifié URSSAF 2026</b>. CFP + chambre 0,52 % = hypothèse de ton business plan. Versement libératoire 1,7 % : ton impôt est inclus. En franchise (art. 293 B) tu paies le matériel TTC sans récupérer la TVA. Les cotisations portent sur TOUT le CA, y compris le matériel revendu — c’est ça qui tue la micro quand tu fournis beaucoup de matériel.<br><br>'
      +'<b>EURL à l’IS</b> : résultat = CA − achats HT − charges − comptable − (rémunération + cotisations TNS ≈ 45 % du net, <i>ordre de grandeur à affiner</i>). IS 15 % jusqu’à 42 500 € puis 25 % — <b>vérifié</b>. Dividendes : PFU 30 % jusqu’à 10 % du capital, au-delà cotisations TNS ≈ 45 % + IR 12,8 %.<br><br>'
      +'<b>SASU</b> : coût total du salaire ≈ 1,80 × le net (<i>ordre de grandeur</i>, pas de cotisation chômage). Dividendes intégralement au PFU 30 % — l’avantage SASU. Meilleure retraite/prévoyance que TNS, mais chaque euro de salaire coûte bien plus cher.<br><br>'
      +'<b>Ce que le simulateur ne chiffre PAS</b> : ton IR au barème sur la rémunération de société (dépend de ton foyer), les règles fines de déductibilité (repas, crédit véhicule : seuls intérêts + amortissement sont déductibles — ici l’annuité complète est prise, légèrement optimiste), la CFE réelle de ta commune, la protection sociale (arrêt maladie, retraite) qui vaut plus en SASU. <b>Avant de décider : valide avec un expert-comptable — c’est une simulation, pas un conseil fiscal.</b>'
      +'</div></details>';

    var next='<div class="next-card" style="margin-top:14px"><h3>🔀 Bascule de régime <span class="badge">étape 3 — à venir</span></h3><div class="sub">Le jour où tu passes en société : choix d’une date de bascule → TVA appliquée sur devis/factures (5,5 % PAC éligibles / 10 % / 20 %), mentions légales adaptées, provision cotisations recalculée. Dis « go étape 3 » à Claude quand tu veux.</div></div>';

    box.innerHTML=inputs+cards+explain+next;
  }

  window.nxrgSet=function(field,value){
    if(field==='acre'||field==='fournirMat')rg[field]=!!value;
    else rg[field]=Math.max(0,Number(value)||0);
    rgSave();
    /* re-rendu partiel : on ne reconstruit pas les inputs pour ne pas perdre le focus */
    var box=document.getElementById('nxRegime');
    if(box){var keep=document.activeElement&&document.activeElement.id;renderRegime();if(keep){var el=document.getElementById(keep);if(el){el.focus();try{var l=el.value.length;el.setSelectionRange(l,l);}catch(e){}}}}
  };

  function rgInit(){
    try{
      var nav=document.getElementById('nav');if(!nav)return;
      if(!nav.querySelector('[data-v="nx_regime"]')){
        var host=nav.querySelector('.nx-nav-section[data-section="manage"] .nx-nav-body')||nav;
        host.insertAdjacentHTML('beforeend','<a data-v="nx_regime" onclick="go(\'nx_regime\')"><span class="ico">🏛️</span><span class="txt">Statut & régime</span></a>');
      }
      var content=document.querySelector('.content');
      if(content&&!document.getElementById('v-nx_regime'))content.insertAdjacentHTML('beforeend','<section class="view" id="v-nx_regime"><div id="nxRegime"></div></section>');
      TITLES.nx_regime=['Statut & régime','Micro, EURL ou SASU : compare avec tes vrais chiffres avant de décider.'];
      var prevGo=window.go;
      window.go=function(v){
        prevGo(v);
        if(v==='nx_regime'){
          renderRegime();
          /* ouvre la section Gestion du menu (le module navigation ne connaît pas cette vue) */
          document.querySelectorAll('.nx-nav-section').forEach(function(s){var open=s.dataset.section==='manage';s.classList.toggle('open',open);var b=s.querySelector(':scope > .nx-nav-toggle');if(b)b.setAttribute('aria-expanded',open?'true':'false');});
        }
      };
    }catch(e){console.error('ClimPilot next-regime init',e);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rgInit);else rgInit();
})();
