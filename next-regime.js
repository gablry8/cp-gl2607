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
    capital:1000,      // capital social (règle des 10 % dividendes EURL)
    bascule:{          // étape 3 — bascule de régime datée
      planned:false, date:'', cible:'micro-tva',   // 'micro-tva' (option TVA / seuil dépassé) ou 'societe'
      provision:23.42,   // % à provisionner après bascule (micro A2 : 21,2+0,52+1,7 — société : à définir avec le comptable)
      tvaDefaut:20, tvaDep:10, tvaLoc:20, tvaCtr:10, // taux par type de document (à vérifier selon éligibilité)
      applied:false, appliedOn:''
    }
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

    box.innerHTML=inputs+cards+explain+nxrgBasculeCard()+nxrgPackCard();
  }

  window.nxrgSet=function(field,value){
    if(field==='acre'||field==='fournirMat')rg[field]=!!value;
    else rg[field]=Math.max(0,Number(value)||0);
    rgSave();
    /* re-rendu partiel : on ne reconstruit pas les inputs pour ne pas perdre le focus */
    var box=document.getElementById('nxRegime');
    if(box){var keep=document.activeElement&&document.activeElement.id;renderRegime();if(keep){var el=document.getElementById(keep);if(el){el.focus();try{var l=el.value.length;el.setSelectionRange(l,l);}catch(e){}}}}
  };

  /* ================== ÉTAPE 3 — BASCULE DE RÉGIME DATÉE (2026-07-20) ================== */

  function nxrgAssujetti(){try{return P&&P.regimeTVA==='assujetti';}catch(e){return false;}}

  function nxrgBasculeCard(){
    var b=rg.bascule||{};
    var etat;
    try{etat=nxrgAssujetti()
      ?'<span class="badge" style="background:#5b8def;color:#fff">ASSUJETTI TVA</span> taux devis par défaut '+(P.tva||20)+' % · provision '+(P.cotisTaux||0)+' %'
      :'<span class="badge" style="background:#34d399;color:#06281c">MICRO — FRANCHISE 293 B</span> provision '+(P.cotisTaux||0)+' %';}
    catch(e){etat='<span class="sub">paramètres en cours de chargement…</span>';}
    var planInfo='';
    if(b.applied)planInfo='<div class="sub" style="margin-top:8px;color:#34d399">✔ Bascule appliquée le '+rgEsc(b.appliedOn||'?')+' ('+(b.cible==='societe'?'société':'micro assujettie TVA')+').</div>';
    else if(b.planned)planInfo='<div class="sub" style="margin-top:8px;color:#f59e0b">⏳ Bascule planifiée au <b>'+rgEsc(b.date||'?')+'</b> ('+(b.cible==='societe'?'société':'micro + TVA')+') — elle s’appliquera automatiquement à l’ouverture de l’app ce jour-là.</div>';
    return '<div class="next-card" style="margin-top:14px"><h3>🔀 Bascule de régime</h3>'
      +'<div class="sub" style="margin-bottom:6px">Régime actuel : '+etat+'</div>'+planInfo
      +'<div class="next-form" style="margin-top:10px">'
      +'<label>Date de bascule<input type="date" id="rgb_date" value="'+rgEsc(b.date)+'" onchange="nxrgBSet(\'date\',this.value)"></label>'
      +'<label>Je passe en<select id="rgb_cible" onchange="nxrgBSet(\'cible\',this.value)"><option value="micro-tva"'+(b.cible!=='societe'?' selected':'')+'>Micro assujettie TVA (option ou seuil 37 500 € dépassé)</option><option value="societe"'+(b.cible==='societe'?' selected':'')+'>Société (EURL / SASU)</option></select></label>'
      +'<label>Provision après bascule % <span class="sub">(micro A2 : 23,42 — société : demande à ton comptable)</span><input type="number" step="0.01" id="rgb_prov" value="'+b.provision+'" oninput="nxrgBSet(\'provision\',this.value)"></label>'
      +'<label>TVA défaut devis %<input type="number" step="0.1" id="rgb_tvadef" value="'+b.tvaDefaut+'" oninput="nxrgBSet(\'tvaDefaut\',this.value)"></label>'
      +'<label>TVA dépannage/MES %<input type="number" step="0.1" id="rgb_tvadep" value="'+b.tvaDep+'" oninput="nxrgBSet(\'tvaDep\',this.value)"></label>'
      +'<label>TVA locations %<input type="number" step="0.1" id="rgb_tvaloc" value="'+b.tvaLoc+'" oninput="nxrgBSet(\'tvaLoc\',this.value)"></label>'
      +'<label>TVA contrats entretien %<input type="number" step="0.1" id="rgb_tvactr" value="'+b.tvaCtr+'" oninput="nxrgBSet(\'tvaCtr\',this.value)"></label>'
      +'</div>'
      +'<div class="row-actions" style="margin-top:12px">'
      +(b.planned&&!b.applied?'<button class="btn-ghost" onclick="nxrgAnnuler()">Annuler la planification</button>':'<button class="btn-ghost" onclick="nxrgPlanifier()">📅 Planifier à la date choisie</button>')
      +'<button class="btn-pri" onclick="nxrgAppliquer()">Basculer maintenant</button>'
      +(nxrgAssujetti()?'<button class="btn-ghost" onclick="nxrgRetourFranchise()">↩ Revenir en franchise (réimpression d’anciennes factures)</button>':'')
      +'</div>'
      +'<div class="sub" style="margin-top:12px;line-height:1.7">'
      +'<b>Ce que la bascule change concrètement :</b> devis avec TVA (5,5 / 10 / 20 % ou mixte 20 % matériel + 10 % pose, à choisir au récapitulatif), factures d’intervention, de location et d’entretien imprimées avec HT / TVA / TTC au lieu de la mention 293 B, provision cotisations recalculée au nouveau taux. Renseigne ton <b>n° de TVA intracommunautaire</b> dans Paramètres → entreprise : il apparaîtra en pied de page.<br>'
      +'⚠ <b>Limites connues (honnêteté avant tout)</b> : les factures émises AVANT la bascule doivent rester en 293 B — réimprime-les via « Revenir en franchise » temporairement. Les encaissements d’interventions/locations restent enregistrés en HT dans le livre des recettes ; le suivi de la TVA collectée à reverser (déclarations CA3/CA12) n’est pas encore géré — prochaine étape possible avec le pack comptable. <b>Rappel loi 2026 : 5,5 % seulement si PAC air/air réversible éligible (A++/A+ multi, ≤ 12 kW, F-Gaz, connectée) et logement > 2 ans.</b>'
      +'</div></div>';
  }

  window.nxrgBSet=function(field,value){
    if(!rg.bascule)rg.bascule=JSON.parse(JSON.stringify(RG_DEF.bascule));
    rg.bascule[field]=(field==='date'||field==='cible')?value:Math.max(0,Number(value)||0);
    rgSave();
  };
  window.nxrgPlanifier=function(){
    var b=rg.bascule;
    if(!b.date){nxrgToast('Choisis d’abord une date de bascule','err');return;}
    b.planned=true;b.applied=false;rgSave();renderRegime();
    nxrgToast('Bascule planifiée au '+b.date+' — elle s’appliquera automatiquement','ok');
  };
  window.nxrgAnnuler=function(){rg.bascule.planned=false;rgSave();renderRegime();nxrgToast('Planification annulée','ok');};
  window.nxrgAppliquer=function(){
    if(!confirm('Basculer MAINTENANT en régime assujetti TVA ?\n\nTous les nouveaux devis et factures porteront de la TVA. Les documents déjà émis restent en 293 B (réimprime-les avant si besoin).'))return;
    nxrgApply();
  };
  window.nxrgRetourFranchise=function(){
    if(!confirm('Repasser temporairement en franchise 293 B ?\n\nÀ utiliser uniquement pour réimprimer d’anciennes factures, puis re-bascule.'))return;
    try{var ov=load(LS.over,{});ov.regimeTVA='franchise';save(LS.over,ov);rebuildP();renderRegime();nxrgToast('Retour en franchise — pense à re-basculer après','ok');}
    catch(e){nxrgToast('Paramètres pas encore chargés, réessaie','err');}
  };
  function nxrgApply(){
    var b=rg.bascule;
    try{
      var ov=load(LS.over,{});
      ov.regimeTVA='assujetti';
      ov.tva=b.tvaDefaut||20;
      ov.cotisTaux=b.provision;
      save(LS.over,ov);rebuildP();
      b.applied=true;b.appliedOn=nxrgToday();b.planned=false;rgSave();
      if(document.getElementById('nxRegime')&&window._curView==='nx_regime')renderRegime();
      nxrgToast('✅ Régime assujetti TVA actif — vérifie ton n° TVA intracom dans Paramètres','ok');
    }catch(e){nxrgToast('Impossible d’appliquer (paramètres pas chargés) — réessaie dans quelques secondes','err');}
  }
  function nxrgToday(){return new Date().toISOString().slice(0,10);}
  function nxrgToast(m,t){try{var s=document.querySelector('.next-toast-stack');if(!s){s=document.createElement('div');s.className='next-toast-stack';document.body.appendChild(s);}var el=document.createElement('div');el.className='next-toast '+(t||'');el.textContent=m;s.appendChild(el);setTimeout(function(){el.remove();},4200);}catch(e){alert(m);}}

  /* Application automatique à la date planifiée (réessaie tant que les paramètres ne sont pas chargés) */
  function nxrgAutoCheck(tries){
    var b=rg.bascule;
    if(!b||!b.planned||b.applied||!b.date)return;
    if(nxrgToday()<b.date)return;
    try{if(typeof rebuildP!=='function'||!PDEF)throw 0;nxrgApply();}
    catch(e){if((tries||0)<10)setTimeout(function(){nxrgAutoCheck((tries||0)+1);},1500);}
  }

  /* TVA mixte 20 % matériel / 10 % pose (loi : clim NON éligible 5,5 % en logement > 2 ans) */
  function nxrgWrapCompute(){
    var orig=window.compute;if(!orig||orig._nxrg)return;
    window.compute=function(d){
      var c=orig(d);
      try{
        if(c&&!c.franchise&&d&&d.tvaMode==='mixte'){
          var matHT=(c.lines||[]).filter(function(l){return l.group==='Matériel';}).reduce(function(s,l){return s+l.ht;},0);
          c.tva=matHT*0.20+(c.totalHT-matHT)*0.10;
          c.totalTTC=c.totalHT+c.tva;
          c.tvaRate='20/10';
          c.acompte=c.totalTTC*(c.acomptePct||0)/100;c.solde=c.totalTTC-c.acompte;
        }
      }catch(e){}
      return c;
    };
    window.compute._nxrg=true;
  }

  /* Sélecteur de taux au récapitulatif du devis (uniquement si assujetti) */
  function nxrgWrapRecalc(){
    var orig=window.recalc;if(!orig||orig._nxrg)return;
    window.recalc=function(){
      orig.apply(this,arguments);
      try{
        if(!nxrgAssujetti())return;
        var tot=document.getElementById('recapTotals');if(!tot||document.getElementById('nxrgTvaSel'))return;
        var mode=(typeof cur!=='undefined'&&cur)?(cur.tvaMode==='mixte'?'mixte':String(cur.tvaRate)):'20';
        function btn(v,lbl,hint){var on=(mode===v);return '<button class="btn-sm '+(on?'btn-pri':'btn-ghost')+'" style="margin:2px" title="'+hint+'" onclick="nxrgTva(\''+v+'\')">'+lbl+'</button>';}
        tot.insertAdjacentHTML('beforeend','<div id="nxrgTvaSel" style="margin-top:10px;padding-top:8px;border-top:1px dashed rgba(143,163,200,.4)"><div class="sub" style="margin-bottom:4px">Taux de TVA du devis :</div>'
          +btn('5.5','5,5 %','PAC air/air réversible ÉLIGIBLE (A++ mono / A+ multi, ≤ 12 kW, F-Gaz, connectée) + logement > 2 ans — garde la fiche technique !')
          +btn('10','10 %','Entretien / travaux SANS fourniture d’équipement de clim, logement > 2 ans')
          +btn('mixte','20/10 mixte','Clim non éligible au 5,5 % en logement > 2 ans : matériel 20 % + pose 10 %')
          +btn('20','20 %','Défaut : logement < 2 ans, local pro, froid seul')
          +'<div class="sub" style="margin-top:4px">5,5 % : vérifie chaque référence (arrêté du 13/07/2026) — en cas de doute, 20 % ou mixte.</div></div>');
      }catch(e){}
    };
    window.recalc._nxrg=true;
  }
  window.nxrgTva=function(v){
    try{
      if(v==='mixte'){cur.tvaMode='mixte';}
      else{
        cur.tvaMode='';cur.tvaRate=Number(v);
        var f=document.getElementById('f_tvaRate');if(f)f.value=v; /* le champ du formulaire écrase cur au recalc */
      }
      recalc();
    }catch(e){}
  };

  /* Mails : la mention 293 B est en dur dans les corps de mail → correction générique quand assujetti */
  function nxrgWrapMail(){
    var orig=window.buildMail;if(!orig||orig._nxrg)return;
    window.buildMail=function(to,subject,body){
      try{
        if(nxrgAssujetti()&&typeof body==='string'){
          body=body.replace(/\s*[—-]\s*TVA non applicable, art\. 293 B du CGI\.?/g,' HT — TVA en sus selon le taux du devis (voir PDF joint)').replace(/\s*HT\s+HT/g,' HT');
          body=body.replace(/\(TVA non applicable, art\. 293 B\)/g,'(TVA en sus, voir facture)');
        }
      }catch(e){}
      return orig.call(this,to,subject,body);
    };
    window.buildMail._nxrg=true;
  }

  /* Factures & contrats : quand assujetti, remplace la mention 293 B en dur et ajoute HT / TVA / TTC */
  var nxrgDocCtx=null;
  function nxrgWrapDoc(fnName,type){
    var orig=window[fnName];if(!orig||orig._nxrg)return;
    var w=function(){
      var args=Array.prototype.slice.call(arguments);
      var real=window.print,fired=false;
      window.print=function(){fired=true;};
      try{orig.apply(this,args);}finally{window.print=real;}
      try{if(nxrgAssujetti())nxrgFixDoc(type,args);}catch(e){console.error('nxrgFixDoc',e);}
      if(fired)real.call(window);
    };
    w._nxrg=true;window[fnName]=w;
  }
  function nxrgFixDoc(type,args){
    var doc=document.getElementById('devisDoc');if(!doc)return;
    var b=rg.bascule||RG_DEF.bascule;
    /* 1. Mention 293 B → mention TVA */
    var rx=/TVA non applicable\s*[—-]\s*art(?:icle)?\.?\s*293 B du CGI\.?/g;
    doc.querySelectorAll('div,td').forEach(function(el){
      if(el.children.length===0&&rx.test(el.textContent)){el.innerHTML=el.innerHTML.replace(rx,'TVA acquittée selon les taux en vigueur.');}
      rx.lastIndex=0;
    });
    /* 2. Total : HT / TVA / TTC */
    var montant=0,rate=20,isTTC=false;
    if(type==='facdevis'){
      var d=args[0],which=args[1];var c=compute(d);
      var f=which==='acompte'?d.facAcompte:d.facSolde;if(!f)return;
      montant=Number(f.montant)||0;isTTC=true;
      rate=c.totalHT>0?(c.tva/c.totalHT*100):(Number(P.tva)||20);
    }else if(type==='dep'){var cd=computeDep(curDep);montant=cd.totalHT;rate=b.tvaDep;}
    else if(type==='loc'){var l=args[0];montant=Number(l.fac&&l.fac.montant)||0;rate=b.tvaLoc;}
    else if(type==='ctr'){var f2=args[1];montant=Number(f2&&f2.montant)||0;rate=b.tvaCtr;}
    else return; /* contrat de location : mention seule */
    if(montant<=0)return;
    var ht,tva,ttc;
    if(isTTC){ttc=montant;ht=ttc/(1+rate/100);tva=ttc-ht;}
    else{ht=montant;tva=ht*rate/100;ttc=ht+tva;}
    var rateLbl=(Math.round(rate*10)/10).toString().replace('.',',');
    var tables=Array.prototype.slice.call(doc.querySelectorAll('table')).filter(function(t){return /Net à payer/.test(t.textContent)&&!/TVA \(/.test(t.textContent);});
    var t=tables[tables.length-1];if(!t)return;
    var td='style="text-align:right;padding:6px 8px"';
    t.innerHTML='<tr><td '+td+'>Total HT</td><td '+td+'>'+eur(ht)+'</td></tr>'
      +'<tr><td '+td+'>TVA ('+rateLbl+' %)</td><td '+td+'>'+eur(tva)+'</td></tr>'
      +'<tr style="background:#fbeedd"><td style="text-align:right;padding:8px;font-weight:800">Net à payer TTC</td><td style="text-align:right;padding:8px;font-weight:800">'+eur(ttc)+'</td></tr>';
  }

  /* ================== ÉTAPE 4 — PACK COMPTABLE (2026-07-20) ================== */

  function nxrgPackDefaults(){
    var now=new Date(),q=Math.floor(now.getMonth()/3);
    var from=new Date(now.getFullYear(),q*3,1),to=new Date(now.getFullYear(),q*3+3,0);
    return{from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
  }
  if(!rg.pack)rg.pack=nxrgPackDefaults();

  /* Taux effectif de TVA d'une facture selon sa DATE D'ÉMISSION (avant bascule = franchise = 0) */
  function nxrgEra(dateEmission){
    var b=rg.bascule||{};
    if(!b.applied||!b.appliedOn)return nxrgAssujetti(); /* jamais basculé via l'app : suit le paramètre courant */
    return String(dateEmission||'')>=b.appliedOn;
  }
  function nxrgSplit(montant,rate,isTTC){
    var ht,tva;
    if(rate<=0){return{ht:montant,tva:0,ttc:montant};}
    if(isTTC){ht=montant/(1+rate/100);tva=montant-ht;return{ht:ht,tva:tva,ttc:montant};}
    tva=montant*rate/100;return{ht:montant,tva:tva,ttc:montant+tva};
  }

  /* Collecte TOUTES les factures émises (facturier) — payées ou non */
  function nxrgFactures(){
    var b=rg.bascule||RG_DEF.bascule,out=[];
    function push(num,date,client,nature,montant,rate,isTTC,payeLe,mode){
      if(!num)return;
      var era=nxrgEra(date),s=nxrgSplit(Number(montant)||0,era?rate:0,era&&isTTC);
      out.push({num:num,date:date||'',client:client||'—',nature:nature,ht:s.ht,tva:s.tva,ttc:s.ttc,payeLe:payeLe||'',mode:mode||''});
    }
    (typeof DEVIS!=='undefined'?DEVIS:[]).forEach(function(d){
      var rate=20;try{var c=compute(d);rate=c.totalHT>0&&c.tva>0?c.tva/c.totalHT*100:(Number(P.tva)||20);}catch(e){}
      if(d.facAcompte)push(d.facAcompte.num,d.facAcompte.date,d.cNom,'Travaux — acompte devis '+d.num,d.facAcompte.montant,rate,true,d.facAcompte.payeLe,d.facAcompte.mode);
      if(d.facSolde)push(d.facSolde.num,d.facSolde.date,d.cNom,'Travaux — devis '+d.num,d.facSolde.montant,rate,true,d.facSolde.payeLe,d.facSolde.mode);
    });
    (typeof DEP!=='undefined'?DEP:[]).forEach(function(x){
      if(!x.facNum)return;var m=0;try{m=computeDep(x).totalHT;}catch(e){}
      push(x.facNum,x.facDate||x.date,x.cNom,x.itype==='mes'?'Mise en service':'Dépannage',m,b.tvaDep,false,x.payeLe,x.modeReg);
    });
    (typeof LOC!=='undefined'?LOC:[]).forEach(function(l){
      if(l.fac)push(l.fac.num,l.fac.date,l.cNom,'Location adiabatique '+(l.num||''),l.fac.montant,b.tvaLoc,false,l.fac.payeLe,l.fac.mode);
    });
    (typeof CTR!=='undefined'?CTR:[]).forEach(function(c){
      (c.facs||[]).forEach(function(f){push(f.num,f.date,c.clientNom,'Contrat entretien '+(f.annee||''),f.montant,b.tvaCtr,false,f.payeLe,f.mode);});
    });
    return out.sort(function(a,b2){return String(a.date).localeCompare(String(b2.date));});
  }
  function nxrgInPeriod(dateStr){var p=rg.pack;return dateStr&&(!p.from||dateStr>=p.from)&&(!p.to||dateStr<=p.to);}

  function nxrgCsv(rows,header){
    var esc=function(v){v=String(v==null?'':v);return '"'+v.replace(/"/g,'""')+'"';};
    var num=function(v){return esc((Math.round(v*100)/100).toFixed(2).replace('.',','));};
    var lines=[header.map(esc).join(';')];
    rows.forEach(function(r){lines.push(r.map(function(v,i){return typeof v==='number'?num(v):esc(v);}).join(';'));});
    return '\uFEFF'+lines.join('\r\n'); /* BOM pour Excel FR */
  }
  function nxrgDownload(name,content,type){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([content],{type:type||'text/csv;charset=utf-8'}));
    a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  }

  window.nxrgPackPeriod=function(which){
    var now=new Date(),y=now.getFullYear(),q=Math.floor(now.getMonth()/3);
    if(which==='trim'){rg.pack=nxrgPackDefaults();}
    else if(which==='trimprec'){var pq=q-1,py=y;if(pq<0){pq=3;py--;}
      rg.pack={from:new Date(py,pq*3,1).toISOString().slice(0,10),to:new Date(py,pq*3+3,0).toISOString().slice(0,10)};}
    else if(which==='annee'){rg.pack={from:y+'-01-01',to:y+'-12-31'};}
    rgSave();renderRegime();
  };
  window.nxrgPackDate=function(field,value){rg.pack[field]=value;rgSave();};

  window.nxrgLivre=function(){
    var rows=nxrgFactures().filter(function(f){return f.payeLe&&nxrgInPeriod(f.payeLe);})
      .sort(function(a,b2){return String(a.payeLe).localeCompare(String(b2.payeLe));})
      .map(function(f){return[f.payeLe,f.num,f.client,f.nature,f.mode||'—',f.ttc,f.tva,f.ht];});
    if(!rows.length){nxrgToast('Aucun encaissement sur la période','err');return;}
    nxrgDownload('livre-recettes_'+rg.pack.from+'_'+rg.pack.to+'.csv',
      nxrgCsv(rows,['Date encaissement','N° facture','Client','Nature','Mode de règlement','Montant encaissé','dont TVA collectée','Montant HT']));
    nxrgToast('📥 Livre des recettes exporté ('+rows.length+' encaissements)','ok');
  };
  window.nxrgFacturier=function(){
    var rows=nxrgFactures().filter(function(f){return nxrgInPeriod(f.date);})
      .map(function(f){return[f.date,f.num,f.client,f.nature,f.ht,f.tva,f.ttc,f.payeLe?'Payée le '+f.payeLe:'En attente',f.mode||'—'];});
    if(!rows.length){nxrgToast('Aucune facture émise sur la période','err');return;}
    nxrgDownload('facturier_'+rg.pack.from+'_'+rg.pack.to+'.csv',
      nxrgCsv(rows,['Date émission','N° facture','Client','Nature','HT','TVA','TTC','Statut','Mode de règlement']));
    nxrgToast('📥 Facturier exporté ('+rows.length+' factures)','ok');
  };
  window.nxrgSynthese=function(){
    var all=nxrgFactures(),p=rg.pack;
    var enc=all.filter(function(f){return f.payeLe&&nxrgInPeriod(f.payeLe);});
    var emises=all.filter(function(f){return nxrgInPeriod(f.date);});
    var impayes=all.filter(function(f){return !f.payeLe&&f.date&&f.date<=(p.to||'9999');});
    var sum=function(arr,k){return arr.reduce(function(s,x){return s+x[k];},0);};
    var natures={};enc.forEach(function(f){var n=f.nature.split('—')[0].trim();if(!natures[n])natures[n]={ht:0,n:0};natures[n].ht+=f.ht;natures[n].n++;});
    var cot=sum(enc,'ht')*(Number(P.cotisTaux)||0)/100;
    var E=P.entreprise||{};
    var natRows=Object.keys(natures).map(function(n){return '<tr><td style="padding:6px 10px;border:1px solid #eee">'+rgEsc(n)+'</td><td style="text-align:center;padding:6px 10px;border:1px solid #eee">'+natures[n].n+'</td><td style="text-align:right;padding:6px 10px;border:1px solid #eee">'+eur(natures[n].ht)+'</td></tr>';}).join('');
    var impRows=impayes.slice(0,15).map(function(f){return '<tr><td style="padding:5px 10px;border:1px solid #eee">'+rgEsc(f.num)+'</td><td style="padding:5px 10px;border:1px solid #eee">'+rgEsc(f.client)+'</td><td style="padding:5px 10px;border:1px solid #eee">'+rgEsc(f.date)+'</td><td style="text-align:right;padding:5px 10px;border:1px solid #eee">'+eur(f.ttc)+'</td></tr>';}).join('');
    var kv=function(l,v,strong){return '<tr><td style="padding:7px 10px;border:1px solid #eee'+(strong?';font-weight:800':'')+'">'+l+'</td><td style="text-align:right;padding:7px 10px;border:1px solid #eee'+(strong?';font-weight:800':'')+'">'+v+'</td></tr>';};
    document.getElementById('devisDoc').innerHTML='<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px">'
      +'<div style="text-align:center;margin-bottom:4px"><span style="font-size:18px;font-weight:800">Synthèse comptable — '+rgEsc(E.nom||'GL Froid & Clim')+'</span></div>'
      +'<div style="text-align:center;font-size:12px;color:#555;margin-bottom:16px">Période du '+rgEsc(p.from)+' au '+rgEsc(p.to)+' · régime : '+(nxrgAssujetti()?'assujetti TVA':'franchise en base (art. 293 B)')+' · généré le '+new Date().toLocaleDateString('fr-FR')+'</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">'
      +kv('Encaissements de la période ('+enc.length+' règlements)',eur(sum(enc,'ttc')),true)
      +kv('dont TVA collectée (à reverser si assujetti)',eur(sum(enc,'tva')))
      +kv('Chiffre d’affaires HT encaissé',eur(sum(enc,'ht')))
      +kv('Cotisations à provisionner ('+(P.cotisTaux||0)+' % du HT encaissé)',eur(cot))
      +kv('Factures émises sur la période ('+emises.length+')',eur(sum(emises,'ttc')))
      +kv('Impayés en cours (toutes périodes : '+impayes.length+')',eur(sum(impayes,'ttc')))
      +'</table>'
      +'<div style="font-weight:700;font-size:12px;margin:12px 0 4px">Répartition du CA HT encaissé par activité</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#f4f4f4"><th style="text-align:left;padding:6px 10px;border:1px solid #eee">Activité</th><th style="padding:6px 10px;border:1px solid #eee">Nb</th><th style="text-align:right;padding:6px 10px;border:1px solid #eee">CA HT</th></tr>'+(natRows||'<tr><td colspan="3" style="padding:8px;text-align:center;color:#999">Aucun encaissement</td></tr>')+'</table>'
      +(impRows?'<div style="font-weight:700;font-size:12px;margin:14px 0 4px">Impayés en cours</div><table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#f4f4f4"><th style="text-align:left;padding:5px 10px;border:1px solid #eee">Facture</th><th style="text-align:left;padding:5px 10px;border:1px solid #eee">Client</th><th style="text-align:left;padding:5px 10px;border:1px solid #eee">Émise le</th><th style="text-align:right;padding:5px 10px;border:1px solid #eee">Montant</th></tr>'+impRows+'</table>':'')
      +'<div style="margin-top:16px;font-size:9.5px;color:#777;border-top:1px solid #eee;padding-top:8px">Document de travail généré par ClimPilot — ne remplace pas une comptabilité. TVA déductible sur achats non suivie ici : transmettre les factures d’achat au comptable. Joindre les exports CSV « livre des recettes » et « facturier » de la même période.</div>'
      +'</div>';
    window.print();
  };
  window.nxrgMailComptable=function(){
    var all=nxrgFactures(),p=rg.pack;
    var enc=all.filter(function(f){return f.payeLe&&nxrgInPeriod(f.payeLe);});
    var sum=function(arr,k){return arr.reduce(function(s,x){return s+x[k];},0);};
    try{
      buildMail('','Pièces comptables '+p.from+' → '+p.to+' — '+((P.entreprise||{}).nom||'GL Froid & Clim'),
        'Bonjour,\n\nVeuillez trouver ci-joint les pièces de la période du '+p.from+' au '+p.to+' :\n'
        +'- Livre des recettes (CSV) : '+enc.length+' encaissements, '+eur(sum(enc,'ttc'))+' encaissés dont '+eur(sum(enc,'tva'))+' de TVA collectée\n'
        +'- Facturier (CSV)\n- Synthèse (PDF)\n- Factures d’achat de la période (TVA déductible)\n\nRégime actuel : '+(nxrgAssujetti()?'assujetti TVA':'franchise en base 293 B')+'.\n\nJe reste disponible pour toute question.\n\nCordialement');
      nxrgToast('✉️ Brouillon ouvert — pense à JOINDRE les 3 fichiers téléchargés','ok');
    }catch(e){nxrgToast('Fonction mail indisponible','err');}
  };

  function nxrgPackCard(){
    var p=rg.pack||nxrgPackDefaults();
    return '<div class="next-card" style="margin-top:14px"><h3>📦 Pack comptable</h3>'
      +'<div class="sub" style="margin-bottom:8px">Tout ce que ton comptable (ou ta banque) attend, sans ressaisie : exporte, joins au mail, c’est fini.</div>'
      +'<div class="row-actions" style="margin-bottom:8px">'
      +'<button class="btn-ghost btn-sm" onclick="nxrgPackPeriod(\'trim\')">Trimestre en cours</button>'
      +'<button class="btn-ghost btn-sm" onclick="nxrgPackPeriod(\'trimprec\')">Trimestre précédent</button>'
      +'<button class="btn-ghost btn-sm" onclick="nxrgPackPeriod(\'annee\')">Année '+new Date().getFullYear()+'</button>'
      +'</div>'
      +'<div class="next-form">'
      +'<label>Du<input type="date" value="'+rgEsc(p.from)+'" onchange="nxrgPackDate(\'from\',this.value)"></label>'
      +'<label>Au<input type="date" value="'+rgEsc(p.to)+'" onchange="nxrgPackDate(\'to\',this.value)"></label>'
      +'</div>'
      +'<div class="row-actions" style="margin-top:10px">'
      +'<button class="btn-pri btn-sm" onclick="nxrgLivre()">📥 Livre des recettes (CSV)</button>'
      +'<button class="btn-pri btn-sm" onclick="nxrgFacturier()">📥 Facturier (CSV)</button>'
      +'<button class="btn-ghost btn-sm" onclick="nxrgSynthese()">🖨 Synthèse (PDF)</button>'
      +'<button class="btn-ghost btn-sm" onclick="nxrgMailComptable()">✉️ Mail au comptable</button>'
      +'</div>'
      +'<div class="sub" style="margin-top:10px;line-height:1.6">Le livre des recettes est en date d’<b>encaissement</b> (la règle micro), le facturier en date d’<b>émission</b>. La TVA collectée n’est comptée que sur les factures émises après ta bascule — avant, tout est en franchise 293 B. CSV au format Excel français (séparateur ; virgule décimale).</div>'
      +'</div>';
  }

  function nxrgWraps(){
    nxrgWrapCompute();nxrgWrapRecalc();nxrgWrapMail();
    nxrgWrapDoc('printFactureDevis','facdevis');
    nxrgWrapDoc('printFacture','dep');
    nxrgWrapDoc('printFactureLoc','loc');
    nxrgWrapDoc('printFactureCtr','ctr');
    nxrgWrapDoc('printContrat','contratloc');
  }

  function rgInit(){
    try{
      var nav=document.getElementById('nav');if(!nav)return;
      if(!nav.querySelector('[data-v="nx_regime"]')){
        var host=nav.querySelector('.nx-nav-section[data-section="manage"] .nx-nav-body')||nav;
        host.insertAdjacentHTML('beforeend','<a data-v="nx_regime" onclick="go(\'nx_regime\')"><span class="ico">🏛️</span><span class="txt">Statut & régime</span></a>');
      }
      var content=document.querySelector('.content');
      if(content&&!document.getElementById('v-nx_regime'))content.insertAdjacentHTML('beforeend','<section class="view" id="v-nx_regime"><div id="nxRegime"></div></section>');
      TITLES.nx_regime=['Statut & régime','Micro, EURL ou SASU : compare, puis planifie ta bascule TVA.'];
      nxrgWraps();
      setTimeout(function(){nxrgAutoCheck(0);},800);
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
