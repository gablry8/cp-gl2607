/* ============================================================
   ClimPilot Next — next-taux.js  (couche additive, 1.10 — 02/10/2026)
   UNE SEULE SOURCE pour les taux de la micro-entreprise, datée et sourcée.

   - Tous les écrans qui affichaient P.cotisTaux passent par nxCotisPct(date) (index.html : cotisPct()).
     P.cotisTaux n'est plus qu'une valeur de compatibilité, recalculée.
   - Profil fiscal (Paramètres) : début d'activité, ACRE, versement libératoire, artisan (CFP, taxe CMA),
     activité (prestations / mixte), CFE. Tout est « à confirmer » par défaut, et chaque estimation
     affiche ses HYPOTHÈSES. Rien n'est activé sans que Gabriel le choisisse.
   - Compteurs réels : plafond du régime micro et franchise de TVA, selon l'année (création, suivante, après).

   Sources (lues le 02/10/2026, extraits de recherche pour les pages bloquées depuis l'environnement) :
     URSSAF taux micro 2026 ......... https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-ac-plnr.html
                                      https://entreprendre.service-public.gouv.fr/vosdroits/F36232
     ACRE (75 % du taux, création ≥ 01/07/2026) : décret 2026-69 https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053449085
                                      https://www.urssaf.fr/accueil/exoneration-acre-createur.html
     Versement libératoire .......... https://www.impots.gouv.fr/professionnel/le-versement-liberatoire
     CFP ............................ https://entreprendre.service-public.gouv.fr/vosdroits/F23459
     Plafonds micro 2026-2028 ....... https://www.impots.gouv.fr/professionnel/questions/pour-rester-micro-entrepreneur-quel-montant-de-chiffre-daffaires-ou-de
     Micro l'année de création et la suivante, prorata : BOFiP BOI-BIC-DECLA-10-10-20
     Franchise de TVA ............... https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-puis-je-etre-redevable-de-la-tva
                                      https://entreprendre.service-public.gouv.fr/vosdroits/F21746
   ============================================================ */
(function(){
  'use strict';
  var KEY='cp2_fiscal';
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}

  /* ---------- tables datées (une ligne = une période ; la plus récente applicable gagne) ---------- */
  var T={
    social:[ /* % du CA, micro-social, hors ACRE */
      {du:'2024-07-01',services:21.2,ventes:12.3,bnc:23.2,src:'URSSAF'},
      {du:'2026-01-01',services:21.2,ventes:12.3,bnc:25.6,src:'URSSAF, taux au 01/01/2026'}
    ],
    acre:[ /* part exonérée du taux, selon la date de DÉBUT d'activité */
      {du:'2000-01-01',exo:0.50,src:'ACRE micro : taux réduit de 50 %'},
      {du:'2026-07-01',exo:0.25,src:'décret 2026-69 : taux = 75 % du taux normal pour une création à partir du 01/07/2026'}
    ],
    vl:{ventes:1.0,services:1.7,bnc:2.2,src:'impots.gouv.fr, versement libératoire'},
    cfp:{artisan:0.3,commercant:0.1,src:'service-public F23459'},
    cma:{services:0.48,ventes:0.22,src:'taxe pour frais de chambre de métiers, taux hors Alsace-Moselle (à confirmer)'},
    plafonds:[
      {du:2023,au:2025,services:77700,ventes:188700},
      {du:2026,au:2028,services:83600,ventes:203100}
    ],
    franchise:[
      {du:2025,services:{base:37500,majore:41250},ventes:{base:85000,majore:93500}}
    ]
  };
  window.nxTauxTables=T;

  /* ---------- profil fiscal ---------- */
  var DEF={debut:'',activite:'services',partVentes:0,acre:'a_confirmer',vl:'a_confirmer',artisan:'a_confirmer',cfe:null,manuel:null,maj:0};
  /* lecture mise en cache (compute() d'un devis l'appelle pour chaque ligne des listes) */
  var RAW=null, PRO=null, MEMO={};
  function profil(){ var raw=''; try{ raw=localStorage.getItem(KEY)||''; }catch(e){}
    if(raw!==RAW){ RAW=raw; MEMO={}; var o={}; try{ o=JSON.parse(raw||'{}')||{}; }catch(e){} PRO=Object.assign({},DEF,o);
      /* profil changé (ici ou par la synchro d'un autre appareil) : valeur de compatibilité recalculée */
      try{ if(P) P.cotisTaux=calcPct(today(),PRO); }catch(e){} }
    return Object.assign({},PRO); }
  function setProfil(p){ p.maj=Date.now(); try{ save(KEY,p); }catch(e){ localStorage.setItem(KEY,JSON.stringify(p)); } compat(); }
  window.nxFiscalProfil=profil; window.nxFiscalSet=function(k,v){ var p=profil(); p[k]=v; setProfil(p); };

  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } }
  function ligne(tab,date){ var r=null; tab.forEach(function(x){ if(String(x.du)<=String(date)) r=x; }); return r||tab[0]; }
  function an(iso){ return +String(iso).slice(0,4); }
  function r2(n){ return Math.round(n*100)/100; }
  function fr(iso){ return iso?new Date(String(iso).slice(0,10)+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function pct(n){ return String(r2(n)).replace('.',',')+' %'; }

  /* fin de l'ACRE : fin du 3e trimestre civil qui suit celui du début d'activité */
  function finAcre(debut){ var y=an(debut), q=Math.floor((+String(debut).slice(5,7)-1)/3), q2=q+3, y2=y+Math.floor(q2/4); q2=q2%4;
    var m=q2*3+3; return y2+'-'+String(m).padStart(2,'0')+'-'+String(new Date(y2,m,0).getDate()).padStart(2,'0'); }
  window.nxFinAcre=finAcre;

  /* ---------- détail du taux pour une catégorie à une date ---------- */
  function detail(date,cat,p){
    date=String(date||today()).slice(0,10); p=p||profil(); cat=cat||'services';
    var h=[], s=ligne(T.social,date), base=s[cat], soc=base, acre=null;
    if(p.acre==='oui'){
      if(!p.debut) h.push('ACRE cochée mais date de début d\'activité absente : ACRE non comptée');
      else { var fin=finAcre(p.debut), rule=ligne(T.acre,p.debut);
        if(date>=p.debut&&date<=fin){ soc=base*(1-rule.exo); acre={exo:rule.exo,fin:fin}; h.push('ACRE : taux réduit de '+Math.round(rule.exo*100)+' % jusqu\'au '+fr(fin)+' (début d\'activité le '+fr(p.debut)+')'); }
        else if(date>fin) h.push('ACRE terminée le '+fr(fin)); }
    } else if(p.acre==='a_confirmer') h.push('ACRE à confirmer : non comptée (provision prudente)');
    var vl=(p.vl==='oui'||p.vl==='a_confirmer')?T.vl[cat]:0;
    if(p.vl==='a_confirmer') h.push('Versement libératoire à confirmer : compté ('+pct(T.vl[cat])+') — option soumise au revenu fiscal de référence');
    if(p.vl==='non') h.push('Sans versement libératoire : l\'impôt sur le revenu n\'est PAS provisionné ici');
    var art=p.artisan!=='non', cfp=art?T.cfp.artisan:T.cfp.commercant, cma=art?T.cma[cat]||0:0;
    if(p.artisan==='a_confirmer') h.push('Inscription au registre des métiers à confirmer : CFP artisan (0,3 %) et taxe CMA ('+pct(T.cma[cat]||0)+') comptées');
    var total=soc+vl+cfp+cma;
    return {date:date,categorie:cat,social:r2(soc),socialNormal:base,acre:acre,vl:vl,cfp:cfp,cma:cma,total:r2(total),hypotheses:h,
      sources:[s.src,acre?ligne(T.acre,p.debut).src:null,vl?T.vl.src:null,T.cfp.src,cma?T.cma.src:null].filter(Boolean)};
  }
  window.nxTaux=detail;

  /* ---------- LE taux utilisé partout (part du CA HT encaissé à mettre de côté) ---------- */
  function cotisPct(date){
    var p=profil(), k=String(date||today()).slice(0,10); if(MEMO[k]!=null) return MEMO[k];
    return (MEMO[k]=calcPct(k,p));
  }
  function calcPct(date,p){
    if(p.manuel!=null&&p.manuel!==''&&isFinite(+p.manuel)) return r2(+p.manuel);
    var ds=detail(date,'services',p);
    if(p.activite==='mixte'&&+p.partVentes>0){ var dv=detail(date,'ventes',p), v=Math.min(100,Math.max(0,+p.partVentes))/100; return r2(ds.total*(1-v)+dv.total*v); }
    return ds.total;
  }
  window.nxCotisPct=cotisPct;
  window.nxCotisExplication=function(date){
    var p=profil(), d=detail(date,'services',p);
    if(p.manuel!=null&&p.manuel!==''&&isFinite(+p.manuel)) return {total:r2(+p.manuel),texte:'taux saisi à la main ('+pct(+p.manuel)+')',hypotheses:['Taux manuel : le calcul automatique est ignoré']};
    var t='cotisations '+pct(d.social)+(d.acre?' (ACRE)':'')+(d.vl?' + versement libératoire '+pct(d.vl):'')+' + formation '+pct(d.cfp)+(d.cma?' + chambre des métiers '+pct(d.cma):'');
    var hy=d.hypotheses.slice();
    if(p.activite==='mixte'&&+p.partVentes>0){ hy.push('Activité mixte : '+(+p.partVentes)+' % du CA compté en ventes (taux ventes) — ventilation à confirmer avec ton comptable'); }
    else hy.push('Tout le CA est compté en prestations de services (si une part est de la vente de matériel, à confirmer : BOFiP BOI-BIC-DECLA-10-10-20 § 90)');
    if(p.cfe==null||p.cfe==='') hy.push('CFE non comprise : impôt annuel séparé (montant fixé par la commune, exonérée l\'année de création)');
    return {total:cotisPct(date),texte:t,hypotheses:hy,detail:d};
  };
  function compat(){ try{ if(P) P.cotisTaux=cotisPct(today()); }catch(e){} }

  /* ---------- seuils ---------- */
  function plafonds(y){ var r=T.plafonds[T.plafonds.length-1]; T.plafonds.forEach(function(x){ if(y>=x.du&&y<=x.au) r=x; }); return r; }
  function franchise(y){ var r=T.franchise[0]; T.franchise.forEach(function(x){ if(y>=x.du) r=x; }); return r; }
  window.nxPlafondsMicro=plafonds; window.nxSeuilsFranchise=franchise;
  function joursAnnee(y){ return ((y%4===0&&y%100!==0)||y%400===0)?366:365; }
  function prorata(debut,y){ if(!debut||an(debut)!==y) return 1; var d0=new Date(debut+'T00:00:00'), d1=new Date(y,11,31); return (Math.round((d1-d0)/86400000)+1)/joursAnnee(y); }
  window.nxProrataCreation=prorata;

  /* chiffre d'affaires HT de l'année : facturé (date de facture, avoirs déduits) et encaissé (date de paiement) */
  function caAnnee(y){
    var f=0,e=0,yy=String(y);
    try{ (window.nxInvoices?nxInvoices():[]).forEach(function(i){ if(String(i.date||'').slice(0,4)===yy) f+=Number(i.montant)||0; /* factures annulées comprises : leur avoir est déduit ci-dessous */ }); }catch(_){}
    try{ (window.nxAvoirs?nxAvoirs():[]).forEach(function(a){ if(String(a.date||'').slice(0,4)===yy) f-=Number(a.montant)||0; }); }catch(_){}
    try{ (typeof allRecettes==='function'?allRecettes():[]).forEach(function(r){ if(String(r.date||'').slice(0,4)===yy) e+=Number(r.montant)||0; }); }catch(_){}
    return {facture:r2(f),encaisse:r2(e),retenu:r2(Math.max(f,e))};
  }
  window.nxCaAnnee=caAnnee;

  /* état de la franchise de TVA (prestations) pour l'année de la date */
  function etatFranchise(date,caFn){
    date=String(date||today()).slice(0,10); caFn=caFn||caAnnee;
    var p=profil(), y=an(date), S=franchise(y).services, h=[], ca=caFn(y), caPrec=caFn(y-1), out={annee:y,ca:ca,base:S.base,majore:S.majore,hypotheses:h};
    try{ if(P&&P.regimeTVA==='assujetti'){ out.statut='assujetti'; out.message='Assujetti à la TVA : compteur sans objet.'; return out; } }catch(e){}
    h.push('Chiffre d\'affaires retenu : le plus élevé entre le facturé ('+ca.facture.toLocaleString('fr-FR')+' €) et l\'encaissé ('+ca.encaisse.toLocaleString('fr-FR')+' €) — prudent, à confirmer');
    h.push('Tout le CA est compté en prestations (seuils 37 500 / 41 250 €) ; activité mixte : à confirmer');
    var anneeType=!p.debut?'inconnue':an(p.debut)===y?'creation':an(p.debut)===y-1?'suivante':an(p.debut)>y?'avant':'courante';
    if(anneeType==='inconnue') h.push('Date de début d\'activité non renseignée : seuils sans prorata');
    out.anneeType=anneeType;
    /* droit à la franchise au 1er janvier de l'année */
    if(anneeType==='suivante'){ var pr=prorata(p.debut,y-1), lim=r2(S.base*pr); out.seuilDebut=lim;
      h.push('Année suivant la création : seuil de '+S.base.toLocaleString('fr-FR')+' € ramené à '+lim.toLocaleString('fr-FR')+' € (prorata de '+Math.round(pr*365)+' jours d\'activité en '+(y-1)+')');
      if(caPrec.retenu>lim){ out.statut='perdue_1er_janvier'; out.message='Franchise perdue depuis le 1er janvier '+y+' : CA '+(y-1)+' ('+caPrec.retenu.toLocaleString('fr-FR')+' €) au-dessus de '+lim.toLocaleString('fr-FR')+' €. TVA à facturer.'; return out; } }
    else if(anneeType==='courante'||anneeType==='inconnue'){ out.seuilDebut=S.base;
      if(caPrec.retenu>S.base){ out.statut='perdue_1er_janvier'; out.message='Franchise perdue depuis le 1er janvier '+y+' : CA '+(y-1)+' ('+caPrec.retenu.toLocaleString('fr-FR')+' €) au-dessus de '+S.base.toLocaleString('fr-FR')+' €. TVA à facturer.'; return out; } }
    else if(anneeType==='creation') h.push('Année de création : seul le seuil majoré ('+S.majore.toLocaleString('fr-FR')+' €, sans prorata) fait perdre la franchise en cours d\'année');
    /* en cours d'année */
    if(ca.retenu>S.majore){ out.statut='perdue_immediate'; out.message='Seuil majoré de '+S.majore.toLocaleString('fr-FR')+' € dépassé : TVA due dès le jour du dépassement. Préviens ton comptable et passe en « assujetti ».'; return out; }
    var limSuiv=anneeType==='creation'?r2(S.base*prorata(p.debut,y)):S.base; out.seuilAnneeSuivante=limSuiv;
    if(anneeType==='creation') h.push('Pour '+(y+1)+' : le CA '+y+' sera comparé à '+limSuiv.toLocaleString('fr-FR')+' € (prorata du temps d\'activité)');
    if(ca.retenu>limSuiv){ out.statut='perte_au_1er_janvier'; out.message='Au-dessus de '+limSuiv.toLocaleString('fr-FR')+' € : franchise perdue au 1er janvier '+(y+1)+' (et dès le jour du dépassement si tu passes '+S.majore.toLocaleString('fr-FR')+' €).'; return out; }
    out.statut=ca.retenu>0.8*limSuiv?'attention':'ok';
    out.reste=r2(limSuiv-ca.retenu);
    out.message=(out.statut==='attention'?'Attention : ':'')+'CA '+ca.retenu.toLocaleString('fr-FR')+' € sur '+limSuiv.toLocaleString('fr-FR')+' € (au-delà, franchise perdue au 1er janvier '+(y+1)+') — reste '+out.reste.toLocaleString('fr-FR')+' €. Seuil majoré : '+S.majore.toLocaleString('fr-FR')+' € (au-delà, TVA dès le jour du dépassement).';
    return out;
  }
  window.nxEtatFranchise=etatFranchise;

  /* état du plafond micro (prestations) */
  function etatMicro(date,caFn){
    date=String(date||today()).slice(0,10); caFn=caFn||caAnnee;
    var p=profil(), y=an(date), pl=plafonds(y).services, ca=caFn(y), out={annee:y,plafond:pl,ca:ca,hypotheses:[]};
    var creation=p.debut&&an(p.debut)===y, suivante=p.debut&&an(p.debut)===y-1;
    if(creation||suivante){ out.statut='de_droit';
      var lim=creation?r2(pl*prorata(p.debut,y)):pl;
      out.message='Régime micro de plein droit en '+y+' ('+(creation?'année de création':'année suivant la création')+'). '+(creation?'Le CA '+y+' est comparé à '+lim.toLocaleString('fr-FR')+' € (prorata) : ':'')+
        'le régime réel ne s\'appliquerait qu\'à partir de '+(creation?y+2:y+1)+' en cas de dépassement deux années de suite.';
      out.hypotheses.push('BOFiP BOI-BIC-DECLA-10-10-20 : micro de plein droit l\'année de création et la suivante ; CA de création ajusté au prorata du temps d\'exploitation');
      return out; }
    if(!p.debut) out.hypotheses.push('Date de début d\'activité non renseignée : année « courante » supposée, sans prorata');
    out.statut=ca.retenu>pl?'depasse':ca.retenu>0.8*pl?'attention':'ok';
    out.message=ca.retenu>pl?'Plafond micro ('+pl.toLocaleString('fr-FR')+' €) dépassé en '+y+' : un 2e dépassement l\'an prochain ferait passer au régime réel. À voir avec ton comptable.':
      'Plafond micro '+y+' : '+pl.toLocaleString('fr-FR')+' € de prestations — reste '+r2(pl-ca.retenu).toLocaleString('fr-FR')+' €.';
    return out;
  }
  window.nxEtatMicro=etatMicro;

  /* ---------- Paramètres : profil fiscal ---------- */
  function sel(id,val,opts){ return '<select id="'+id+'" onchange="nxFiscalUI(\''+id+'\',this.value)">'+opts.map(function(o){ return '<option value="'+o[0]+'"'+(String(val)===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select>'; }
  var CONF=[['a_confirmer','À confirmer'],['oui','Oui'],['non','Non']];
  function carteProfil(){
    var p=profil(), x=window.nxCotisExplication(today());
    return '<div class="card" id="nxFiscal" style="margin-top:12px"><h2>🧾 Profil fiscal (micro-entreprise)</h2>'+
      '<div class="sub" style="margin-bottom:8px">Ces réponses fixent le taux mis de côté sur chaque euro encaissé, partout dans l\'appli. « À confirmer » = calcul prudent, affiché comme hypothèse.</div>'+
      '<div class="grid2">'+
      '<label>Début d\'activité<input type="date" id="fx_debut" value="'+(p.debut||'')+'" onchange="nxFiscalUI(\'fx_debut\',this.value)"></label>'+
      '<label>Activité'+sel('fx_activite',p.activite,[['services','Prestations de services (artisan)'],['mixte','Mixte : ventes + prestations']])+'</label>'+
      (p.activite==='mixte'?'<label>Part du CA en ventes (%)<input type="number" min="0" max="100" id="fx_partVentes" value="'+(+p.partVentes||0)+'" onchange="nxFiscalUI(\'fx_partVentes\',this.value)"></label>':'')+
      '<label>ACRE accordée'+sel('fx_acre',p.acre,CONF)+'</label>'+
      '<label>Versement libératoire'+sel('fx_vl',p.vl,CONF)+'</label>'+
      '<label>Inscrit au registre des métiers (artisan)'+sel('fx_artisan',p.artisan,CONF)+'</label>'+
      '<label>CFE annuelle (€, si connue)<input type="number" min="0" id="fx_cfe" value="'+(p.cfe==null?'':p.cfe)+'" onchange="nxFiscalUI(\'fx_cfe\',this.value)"></label>'+
      '<label>Taux manuel (%, vide = calcul)<input type="number" step="0.01" id="fx_manuel" value="'+(p.manuel==null?'':p.manuel)+'" onchange="nxFiscalUI(\'fx_manuel\',this.value)"></label>'+
      '</div>'+
      '<div class="recap-line" style="margin-top:8px"><div class="lbl"><b>Taux appliqué aujourd\'hui</b><div class="sub2">'+x.texte+'</div></div><div><b id="nxFiscalTotal">'+pct(x.total)+'</b></div></div>'+
      '<ul class="sub" style="margin:6px 0 0 18px">'+x.hypotheses.map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul>'+
      '<div class="sub2" style="margin-top:6px">Sources : URSSAF (taux 2026), décret 2026-69 (ACRE), impots.gouv.fr (versement libératoire, seuils), service-public.fr (CFP). Taux vérifiés le 02/10/2026 — ils changent : revérifie chaque année.</div></div>';
  }
  window.nxFiscalUI=function(id,v){
    var k=id.replace(/^fx_/,''), p=profil();
    if(k==='partVentes') v=Math.min(100,Math.max(0,+v||0)); else if(k==='cfe'||k==='manuel') v=(v===''?null:+v);
    p[k]=v; setProfil(p); monterProfil();
  };
  function monterProfil(){
    var g=document.getElementById('paramGen'); if(!g) return;
    var c=document.getElementById('pg_cotis');
    if(c){ c.value=cotisPct(today()); c.readOnly=true; c.title='Calculé depuis ton profil fiscal';
      var n=c.parentNode&&c.parentNode.querySelector('.note-inline'); if(n) n.textContent='Calculé depuis ton profil fiscal (ci-dessous) — ne se saisit plus ici.'; }
    var old=document.getElementById('nxFiscal'); var html=carteProfil();
    if(old) old.outerHTML=html; else g.insertAdjacentHTML('afterend',html);
  }

  /* ---------- compteurs (Ma journée, Statut & régime) ---------- */
  function carteSeuils(id){
    var f=etatFranchise(), m=etatMicro(), col={ok:'#0f6b39',attention:'#b26a00',perte_au_1er_janvier:'#b42318',perdue_immediate:'#b42318',perdue_1er_janvier:'#b42318',depasse:'#b42318',de_droit:'#0f6b39',assujetti:'#55627a'};
    return '<div class="next-card nx-seuils" id="'+(id||'nxSeuilsR')+'" style="margin:12px 0"><h3>📏 Seuils '+f.annee+' (chiffre d\'affaires réel)</h3>'+
      '<div style="color:'+(col[f.statut]||'inherit')+'"><b>Franchise de TVA</b> — '+f.message+'</div>'+
      '<div style="color:'+(col[m.statut]||'inherit')+';margin-top:6px"><b>Régime micro</b> — '+m.message+'</div>'+
      '<details style="margin-top:6px"><summary class="sub" style="cursor:pointer">Hypothèses du calcul</summary><ul class="sub" style="margin:4px 0 0 18px">'+f.hypotheses.concat(m.hypotheses).map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul></details></div>';
  }
  window.nxCarteSeuils=carteSeuils;
  function monterJournee(force){
    var host=document.getElementById('nxJournee'); if(!host) return; var old=document.getElementById('nxSeuilsJ');
    if(old&&!force) return; if(old) old.remove();
    try{ host.insertAdjacentHTML('beforeend',carteSeuils('nxSeuilsJ')); }catch(e){}
  }
  function observerJournee(){
    var host=document.getElementById('nxJournee'); if(!host) return;
    if(!host._nxtaux){ host._nxtaux=true; try{ new MutationObserver(function(){ if(!document.getElementById('nxSeuilsJ')) monterJournee(); }).observe(host,{childList:true}); }catch(e){} }
    monterJournee(true); /* chiffres à jour à chaque ouverture */
  }

  /* ---------- branchement ---------- */
  function boot(){
    compat();
    var rb=window.rebuildP; if(typeof rb==='function'&&!rb._nxtaux){ var w=function(){ var r=rb.apply(this,arguments); compat(); return r; }; w._nxtaux=true; window.rebuildP=w; }
    var rp=window.renderParams; if(typeof rp==='function'&&!rp._nxtaux){ var w2=function(){ var r=rp.apply(this,arguments); try{ monterProfil(); }catch(e){} return r; }; w2._nxtaux=true; window.renderParams=w2; }
    var g=window.go; if(typeof g==='function'&&!g._nxtaux){ var w3=function(v){ var r=g.apply(this,arguments); if(v==='nx_journee') setTimeout(observerJournee,0); return r; }; w3._nxtaux=true; window.go=w3; }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
