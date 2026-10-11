// Suite O — Objectifs & feux (next-objectifs.js) et pack comptable cohérent avec le livre des recettes
// (next-regime.js, 1.11). Données fictives. Les montants attendus des objectifs viennent du fichier
// « Plan_Objectifs_2027-2030.xlsx » du 09/10/2026 (mêmes hypothèses), recalculés par LibreOffice.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import { ecrireResultats, out } from './env.mjs';
const G='Objectifs';
const j=o=>JSON.stringify(o);
const proche=(a,b,t)=>Math.abs((Number(a)||0)-(Number(b)||0))<=(t==null?0.011:t);

/* plan démarré il y a 6 mois (mois courant = mois 7) ; outils de capture des fichiers et des impressions */
const PREP=`(function(){
  const t=todayISO(), y=+t.slice(0,4), m=+t.slice(5,7)-1, iso=(a,b,c)=>{const x=new Date(a,b,c);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  window.__iso=iso; window.__t=t; window.__debut=iso(y,m-6,1);
  save('cpnext_objectifs',{debut:__debut});
  window.__blobs=[]; URL.createObjectURL=b=>{ __blobs.push(b); return 'blob:capture-'+__blobs.length; };
  /* téléchargements : on garde le nom du fichier, sans navigation vers le faux lien */
  window.__noms=[]; const oc=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(this.download){ __noms.push(this.download); return; } return oc.apply(this,arguments); };
})();`;
const lireFichiers=`(async()=>{ const r=[]; for(const b of __blobs) r.push(await b.text()); __blobs.length=0; return r; })()`;
const fermerPdf=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;

async function preparer(opts){
  const {p,ctx,errs}=await page(Object.assign({mobile:false},opts||{}));
  await seed(p); await p.evaluate(PREP);
  return {p,ctx,errs};
}

/* ================= O1 — chargement, menu, écran ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{ const a=document.querySelector('#nav a[data-v="nx_obj"]'); const sec=a&&a.closest('.nx-nav-section');
    go('nx_obj'); const v=document.getElementById('v-nx_obj'), h=(document.getElementById('nxobj')||{}).innerText||'';
    return {lien:!!a,section:sec?sec.dataset.section:'',actif:!!(v&&v.classList.contains('active')),titre:document.getElementById('ttl').textContent,
      blocs:['Mes feux','Mon plan sur 3 ans','Combien coûte un salarié','Pour la comptable','À renseigner','Mes réglages'].filter(x=>h.indexOf(x)<0),
      sync:SYNC_KEYS.indexOf('cpnext_objectifs')>=0, mois:/mois 7 \/ 36/.test(h)}; });
  rec(G,'Lien « Objectifs & feux » dans la section Accueil du menu',r.lien&&r.section==='home',j(r));
  rec(G,'L’écran s’ouvre avec son titre et ses 6 blocs',r.actif&&r.titre==='Objectifs & feux'&&r.blocs.length===0,j(r));
  rec(G,'Mois courant reconnu (mois 7 / 36 d’un plan démarré il y a 6 mois)',r.mois,j(r));
  rec(G,'Réglages synchronisés entre appareils (clé cpnext_objectifs dans la synchro)',r.sync,'');

  /* ================= O2 — objectifs = fichier Excel du plan ================= */
  const o2=await p.evaluate(()=>{ const o=nxobjEtat(); const md=k=>{ const d=o.debut; return __iso(+d.slice(0,4),+d.slice(5,7)-1+(k-1),1); };
    o.apprentiDate=md(15); o.techDate=md(25); save('cpnext_objectifs',o);
    const avec=[1,4,7,13,15,25,28,36].map(k=>nxobjObjectif(k).ca);
    o.techDate=''; save('cpnext_objectifs',o); const sans=nxobjObjectif(28).ca;
    o.apprentiDate=''; save('cpnext_objectifs',o); const solo=nxobjObjectif(15).ca;
    return {avec,sans,solo}; });
  const XL=[2957.5,3845.0,5067.0,5977.8,7027.8,10198.9,12448.6,12448.6];
  rec(G,'Objectifs mensuels identiques au fichier Excel (mois 1, 4, 7, 13, 15, 25, 28, 36 ; apprenti m15, technicien m25)',o2.avec.every((v,i)=>proche(v,XL[i],1)),j({calc:o2.avec,excel:XL}));
  rec(G,'Sans technicien, l’année 3 revient à 85 % d’agenda (7 594 €/mois comme le fichier)',proche(o2.sans,7593.9,1),o2.sans);
  rec(G,'Sans apprenti, son chiffre d’affaires n’est pas compté (mois 15 : 7 028 − 1 050)',proche(o2.solo,7027.8-1050,1),o2.solo);

  /* ================= O3 — plancher ================= */
  const o3=await p.evaluate(()=>{ const o=nxobjEtat(); const md=k=>{ const d=o.debut; return __iso(+d.slice(0,4),+d.slice(5,7)-1+(k-1),1); };
    const r1=nxCotisPct(md(1))/100, p1=nxobjPlancher(1).montant, attendu=(14950/12+600+500+1750)/(1-r1);
    o.camionActif=false; save('cpnext_objectifs',o); const p1b=nxobjPlancher(1).montant;
    o.camionActif=true; o.apprentiDate=md(15); o.societeDate=md(19); save('cpnext_objectifs',o); const p19=nxobjPlancher(19).montant, p18=nxobjPlancher(18).montant, r18=nxCotisPct(md(18))/100;
    const att18=(14950/12+600+500+1750+13200/12)/(1-r18);
    o.apprentiDate=''; o.societeDate=''; save('cpnext_objectifs',o);
    return {r1,p1,attendu,ecartCamion:p1-p1b,camionAttendu:600/(1-r1),p19,p18,att18}; });
  rec(G,'Plancher = (charges + provision camion + variables + paie) ÷ (1 − cotisations du profil fiscal)',proche(o3.p1,o3.attendu,0.02),j(o3));
  rec(G,'Provision camion désactivable : le plancher baisse de 600 € ÷ (1 − cotisations)',proche(o3.ecartCamion,o3.camionAttendu,0.02),j(o3));
  rec(G,'Avant la société, l’apprenti s’ajoute au plancher (mois 18)',proche(o3.p18,o3.att18,0.02),j(o3));
  rec(G,'En société (mois 19) : plus de cotisations micro, paie × 1,45 et frais de société (6 183 € comme le fichier)',proche(o3.p19,6183.33,0.02),j(o3));

  /* ================= O4 — réalisé du mois, pack comptable (essais, avoirs, remboursements, factures annulées) ================= */
  const o4=await p.evaluate(()=>{
    const t=__t, y=t.slice(0,4), m=+t.slice(5,7)-1, N=k=>'F-'+y+'-'+String(k).padStart(3,'0'), prec=__iso(+y,m-1,10);
    const dv=DEVIS.filter(x=>x.statut==='accepte');
    dv[0].facSolde={num:N(101),date:t,montant:1200,payeLe:t,mode:'Virement'};
    dv[0].facAcompte={num:'ESSAI-F-'+y+'-001',date:t,montant:999,payeLe:t,mode:'Chèque'};   /* essai payé : jamais dans les pièces */
    dv[1].facSolde={num:N(100),date:prec,montant:500};                                        /* mois dernier */
    dv[1].facAnnulees=[{num:N(105),date:t,montant:150,which:'acompte',avoir:'AV-'+y+'-003'}];
    save(LS.devis,DEVIS);
    DEP.push({id:'o_d1',cNom:'Client Dépannage',date:t,statut:'payee',payeLe:t,modeReg:'Carte',facNum:N(102),facDate:t,itype:'dep',heures:1,pieces:[]}); save(LS.dep,DEP);
    const depHT=Math.round(computeDep(DEP[DEP.length-1]).totalHT*100)/100;
    CTR.push({id:'o_c1',clientNom:'Supérette Test',type:'clim',prix:300,visites:1,actif:true,facs:[{annee:+y,num:N(103),date:t,montant:300,payeLe:t,mode:'Virement'}]});
    CTR.push({id:'o_c2',clientNom:'Boucherie Test',type:'froid',prix:400,visites:2,actif:true,facs:[{annee:+y,num:N(104),date:t,montant:400,payeLe:t,mode:'Virement'}]});
    save('cp2_contrats',CTR);
    const AV=nxAvoirs();
    AV.push({id:'oa1',num:'AV-'+y+'-001',facNum:N(101),date:t,montant:200,motif:'Geste commercial',cli:{nom:dv[0].cNom}});                 /* avoir avant paiement */
    AV.push({id:'oa2',num:'AV-'+y+'-002',facNum:N(104),date:t,montant:400,motif:'Annulation',cli:{nom:'Boucherie Test'},factPayee:true,rembourse:{date:t,mode:'Virement'}}); /* remboursé */
    AV.push({id:'oa3',num:'AV-'+y+'-003',facNum:N(105),date:t,montant:150,motif:'Annulation',cli:{nom:dv[1].cNom}});
    save('cp2_avoirs',AV);
    const k=t.slice(0,7), r=nxobjRealise(k), rp=nxobjRealise(__iso(+y,m-1,1).slice(0,7));
    const recApp=allRecettes().filter(x=>x.date.slice(0,7)===k), totApp=recApp.reduce((s,x)=>s+Number(x.montant),0);
    const livre=typeof nxrgLignesRecettes==='function'?nxrgLignesRecettes(k+'-01',__iso(+y,m+1,0)):[];
    return {r,rp,depHT,y,totApp,nApp:recApp.length,livreTot:livre.reduce((s,x)=>s+x.ttc,0),livreN:livre.length,
      attenduFac:1200+depHT+300+400+150-200-400-150, attenduEnc:1000+depHT+300+400-400};
  });
  rec(G,'Facturé du mois : HT, essai exclu, avoirs déduits, facture annulée et son avoir neutres',proche(o4.r.facture,o4.attenduFac),j(o4));
  rec(G,'Encaissé du mois = livre des recettes de l’appli (avoir avant paiement déduit, remboursement en négatif)',proche(o4.r.encaisse,o4.attenduEnc)&&proche(o4.r.encaisse,o4.totApp),j(o4));
  rec(G,'Une facture du mois dernier n’entre pas dans le mois courant',proche(o4.rp.facture,500),j(o4.rp));
  rec(G,'Lignes du pack = lignes du livre des recettes de l’appli (même nombre, même total)',o4.livreN===o4.nApp&&proche(o4.livreTot,o4.totApp),j(o4));

  const o5=await p.evaluate(async()=>{ const t=__t, y=t.slice(0,4), m=+t.slice(5,7)-1, from=t.slice(0,7)+'-01', to=__iso(+y,m+1,0);
    if(typeof nxrgPackPour==='function') nxrgPackPour(from,to); else { nxrgPackDate('from',from); nxrgPackDate('to',to); } nxrgLivre(); nxrgFacturier(); const noms=[]; return {from,to}; });
  const fichiers=await p.evaluate(lireFichiers);
  const livre=fichiers[0]||'', fact=fichiers[1]||'', y=o4.y;
  rec(G,'Pack comptable : livre des recettes sans facture d’essai',livre.length>0&&livre.indexOf('ESSAI-')<0,livre.slice(0,300));
  rec(G,'Pack comptable : le remboursement d’un avoir apparaît en négatif dans le livre',livre.indexOf('AV-'+y+'-002')>=0&&/-400,00/.test(livre),livre);
  rec(G,'Pack comptable : l’avoir avant paiement est déduit dans le livre (1 000,00 € encaissés sur F-…-101)',/F-\d{4}-101"[^\n]*"1000,00"/.test(livre),livre);
  rec(G,'Pack comptable : le facturier liste les avoirs en négatif',fact.indexOf('AV-'+y+'-001')>=0&&/"-200,00"/.test(fact)&&/"Avoir"/.test(fact),fact);
  rec(G,'Pack comptable : le facturier garde la facture annulée (série continue) avec son avoir',fact.indexOf('F-'+y+'-105')>=0&&/Annulée \(avoir AV-\d{4}-003\)/.test(fact),fact);
  rec(G,'Pack comptable : facturier sans facture d’essai',fact.length>0&&fact.indexOf('ESSAI-')<0,'');

  /* nom des fichiers : DEMONSTRATION_ tant que la facturation réelle n'est pas démarrée */
  const o6=await p.evaluate(async()=>{ __noms.length=0;
    nxrgLivre(); save('cp2_facturation',{debut:'2020-01-01',decideLe:'2020-01-01',anciens:{}}); nxrgLivre();
    __blobs.length=0; return __noms.slice(); });
  rec(G,'Fichiers nommés « DEMONSTRATION_… » tant que la facturation réelle n’a pas démarré, nom normal ensuite',/^DEMONSTRATION_livre-recettes_/.test(o6[0]||'')&&/^livre-recettes_/.test(o6[1]||''),j(o6));

  /* synthèse PDF : totaux trimestriels + aperçu */
  const o7=await p.evaluate(()=>{ nxrgSynthese(); const d=(document.getElementById('devisDoc')||{}).innerText||'', modal=!!document.getElementById('nx-pdf-modal'); return {d:d.slice(0,1500),modal,trim:/Total des recettes par trimestre/.test(d),essai:/ESSAI-/.test(d)}; });
  await p.evaluate(fermerPdf);
  rec(G,'Synthèse : total des recettes par trimestre (obligation : total tous les 3 mois) et aperçu PDF',o7.trim&&o7.modal&&!o7.essai,o7.d.slice(0,300));

  /* ================= O9 — contrôles avant envoi ================= */
  const o9=await p.evaluate(()=>{ const y=__t.slice(0,4); const c0=nxobjControles();
    DEP.push({id:'o_d2',cNom:'Client Trou',date:__t,statut:'facturee',facNum:'F-'+y+'-107',facDate:__t,itype:'dep',heures:1,pieces:[]}); save(LS.dep,DEP);
    const c1=nxobjControles(); return {c0:c0.map(x=>[x.label,x.ok,x.detail]),c1:c1.map(x=>[x.label,x.ok,x.detail])}; });
  const serie0=o9.c0.find(x=>/continue/.test(x[0])), serie1=o9.c1.find(x=>/continue/.test(x[0]));
  rec(G,'Contrôle : numérotation continue reconnue (F-…-100 à 105, avoirs 001 à 003)',serie0&&serie0[1]===true,j(serie0));
  rec(G,'Contrôle : un trou dans la série est signalé (F-…-106 manquante)',serie1&&serie1[1]===false&&/manque n°106/.test(serie1[2]),j(serie1));
  rec(G,'Contrôle : chaque encaissement est rattaché à une facture',o9.c0.some(x=>/rattaché/.test(x[0])&&x[1]===true),j(o9.c0));

  /* ================= O8 — feux ================= */
  const o8=await p.evaluate(()=>{ const t=__t, y=+t.slice(0,4), m=+t.slice(5,7)-1, o=nxobjEtat();
    const c=(f,i)=>nxobjFeux()[f].conditions[i].ok;
    o.diplomeDate=__iso(y,m-6,15); save('cpnext_objectifs',o); const dip6=c('apprenti',0), coul6=nxobjFeux().apprenti.couleur;
    o.diplomeDate=__iso(y-1,m-1,1); save('cpnext_objectifs',o); const dip13=c('apprenti',0);
    const soc0=c('apprenti',1), treso0=c('apprenti',4);
    o.societeDate=__iso(y,m,1); o.tresoMontant=200000; o.tresoDate=t; save('cpnext_objectifs',o);
    const soc1=c('apprenti',1), treso1=c('apprenti',4), trois0=c('apprenti',2);
    /* 3 derniers mois complets au-dessus du plancher */
    for(let i=1;i<=3;i++){ const d=__iso(y,m-i,5); DEVIS[i].facAcompte={num:'F-'+y+'-2'+String(i).padStart(2,'0'),date:d,montant:9000,payeLe:d,mode:'Virement'}; } save(LS.devis,DEVIS);
    const trois1=c('apprenti',2), car=nxobjCarnet(), carC=c('apprenti',3);
    const F=nxobjFeux().apprenti, tous=F.conditions.every(x=>x.ok===true);
    /* technicien */
    const ctrOk0=c('technicien',2); CTR.push({id:'o_c3',clientNom:'Hôtel Test',type:'clim',prix:30000,visites:2,actif:true,facs:[]}); save('cp2_contrats',CTR); const ctrOk1=c('technicien',2);
    o.hist={}; o.hist[t.slice(0,7)]={carnet:9}; o.hist[__iso(y,m-1,1).slice(0,7)]={carnet:9}; o.hist[__iso(y,m-2,1).slice(0,7)]={carnet:9}; save('cpnext_objectifs',o);
    const carT=c('technicien',0);
    const taux0=c('technicien',5); o.sim.brut=3500; o.sim.camion=1; save('cpnext_objectifs',o); const taux1=c('technicien',5); o.sim.brut=2300; o.sim.camion=0; save('cpnext_objectifs',o);
    /* société */
    o.societeDate=''; o.apprentiDate=__iso(y,m+2,1); save('cpnext_objectifs',o); const socF=nxobjFeux().societe;
    o.societeDate=__iso(y,m,1); save('cpnext_objectifs',o); const socF2=nxobjFeux().societe;
    o.apprentiDate=''; save('cpnext_objectifs',o);
    return {dip6,coul6,dip13,soc0,treso0,soc1,treso1,trois0,trois1,car,carC,couleur:F.couleur,tous,ctrOk0,ctrOk1,carT,taux0,taux1,socF:{c:socF.couleur,ok:socF.conditions[0].ok},socF2:{c:socF2.couleur,v:socF2.verdict}}; });
  rec(G,'Apprenti : diplôme depuis 6 mois → condition légale non remplie, feu rouge (art. R6223-22)',o8.dip6===false&&o8.coul6==='rouge',j(o8));
  rec(G,'Apprenti : diplôme depuis plus d’un an → condition remplie',o8.dip13===true,j(o8));
  rec(G,'Apprenti : sans date de passage en société → condition non remplie ; avec → remplie',o8.soc0===false&&o8.soc1===true,j(o8));
  rec(G,'Trésorerie non renseignée → « à compléter » (ni vert ni rouge) ; renseignée et suffisante → remplie',o8.treso0===null&&o8.treso1===true,j(o8));
  rec(G,'CA au-dessus du plancher les 3 derniers mois : faux sans factures, vrai avec',o8.trois0===false&&o8.trois1===true,j(o8));
  rec(G,'Travail signé en semaines = heures des devis acceptés non soldés ÷ 30 h',o8.carC===(o8.car.semaines>=4)&&proche(o8.car.semaines,Math.round(o8.car.heures/30*10)/10,0.051),j(o8.car));
  rec(G,'Feu apprenti vert si et seulement si toutes ses conditions sont remplies',(o8.couleur==='vert')===o8.tous,j({c:o8.couleur,tous:o8.tous}));
  rec(G,'Technicien : contrats d’entretien ≥ 50 % de son coût (faux avec 2 petits contrats, vrai avec un gros contrat en plus)',o8.ctrOk0===false&&o8.ctrOk1===true,j(o8));
  rec(G,'Technicien : 6 semaines de travail signé exigées aujourd’hui, même avec un historique favorable',o8.carT===(o8.car.semaines>=6?true:false),j({carT:o8.carT,sem:o8.car.semaines}));
  rec(G,'Technicien : taux horaire comparé au prix minimum (vrai à 2 300 € en binôme, faux à 3 500 € avec camion)',o8.taux0===true&&o8.taux1===false,j(o8));
  rec(G,'Société : embauche prévue en micro → feu rouge ; une fois en société → vert « Fait »',o8.socF.c==='rouge'&&o8.socF.ok===false&&o8.socF2.c==='vert'&&/^Fait/.test(o8.socF2.v),j(o8));

  /* ================= O10 — saisies : formats français, refus, persistance ================= */
  const o10=await p.evaluate(()=>{ nxobjSet('tresoMontant','12 500,50'); const a=nxobjEtat();
    nxobjSet('paie','-5'); const b=nxobjEtat().paie; nxobjSet('diplomeDate','abc'); const c=nxobjEtat().diplomeDate;
    nxobjSim('fact','0'); const d=nxobjEtat().sim.fact; nxobjSet('paie','1400'); const e=nxobjEtat().paie;
    return {treso:a.tresoMontant,tresoDate:a.tresoDate,t:__t,b,c,d,e}; });
  rec(G,'Trésorerie saisie « 12 500,50 » → 12 500,50 € datée du jour',o10.treso===12500.5&&o10.tresoDate===o10.t,j(o10));
  rec(G,'Valeurs absurdes refusées (paie négative, date invalide, 0 % d’heures facturées)',o10.b===1750&&o10.c!=='abc'&&o10.d===70,j(o10));
  await p.reload(); await p.waitForTimeout(2200);
  const o10b=await p.evaluate(()=>({paie:nxobjEtat().paie,treso:nxobjEtat().tresoMontant}));
  rec(G,'Réglages conservés après rechargement',o10b.paie===1400&&o10b.treso===12500.5,j(o10b));

  /* ================= O11 — interface : cases à cocher, tableau de bord, point du mois ================= */
  await p.evaluate(()=>go('nx_obj'));
  const box=p.locator('#nxobj input[type=checkbox]').first(); await box.check();
  const o11=await p.evaluate(()=>({checks:nxobjEtat().checks,coche:document.querySelector('#nxobj input[type=checkbox]').checked}));
  rec(G,'Case « à cocher par toi » enregistrée (datée) et conservée à l’affichage',Object.keys(o11.checks).length===1&&o11.coche,j(o11));
  const o12=await p.evaluate(()=>{ go('dash'); const b=document.getElementById('nxobjDash'); return b?b.innerText:''; });
  rec(G,'Tableau de bord : ligne « Objectif du mois » avec lien vers l’écran',/Objectif/.test(o12)&&/Mes objectifs/.test(o12),o12);
  const o13=await p.evaluate(()=>{ nxobjPointMois(); const d=(document.getElementById('devisDoc')||{}).innerText||''; return {d:d.slice(0,4000),modal:!!document.getElementById('nx-pdf-modal')}; });
  await p.evaluate(fermerPdf);
  rec(G,'Point du mois (PDF) : objectif, facturé, plancher, feux, aperçu',/Point du mois/.test(o13.d)&&/Objectif du mois/.test(o13.d)&&/Plancher/.test(o13.d)&&/Prendre un apprenti/.test(o13.d)&&o13.modal,o13.d.slice(0,300));
  await p.evaluate(()=>go('nx_obj')); await p.waitForTimeout(300);
  await p.locator('#v-nx_obj').screenshot({path:out('suiteO-ecran-pc.png')});
  rec(G,'Aucune erreur JavaScript (ordinateur)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= O12 — avant le lancement ================= */
{ const {p,ctx,errs}=await page({mobile:false}); await seed(p);
  const r=await p.evaluate(()=>{ const t=todayISO(), y=+t.slice(0,4); save('cpnext_objectifs',{debut:(y+1)+'-07-01'}); go('nx_obj'); const h=document.getElementById('nxobj').innerText; go('dash'); const b=(document.getElementById('nxobjDash')||{}).innerText||''; return {h:h.slice(0,400),b}; });
  rec(G,'Avant le lancement : compte à rebours et premier objectif, sans suivi du mois',/Avant le lancement/.test(r.h)&&/Premier objectif/.test(r.h)&&!/mois \d+ \/ 36/.test(r.h),r.h);
  rec(G,'Avant le lancement : le tableau de bord montre les points prêts',/Lancement le/.test(r.b)&&/points prêts/.test(r.b),r.b);
  rec(G,'Aucune erreur JavaScript (avant lancement)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= O13 — téléphone ================= */
{ const {p,ctx,errs}=await page({mobile:true}); await seed(p); await p.evaluate(PREP);
  const r=await p.evaluate(()=>{ go('nx_obj'); const f=document.querySelector('#nxobj .nxo-feu'); if(f) f.scrollIntoView(); const b=f?f.getBoundingClientRect():null;
    const hit=b?document.elementFromPoint(b.left+b.width/2,Math.max(5,b.top+20)):null;
    return {w:document.documentElement.scrollWidth,iw:window.innerWidth,ok:!!f,visible:!!(hit&&f.contains(hit))}; });
  await p.screenshot({path:out('suiteO-ecran-telephone.png')});
  rec(G,'Téléphone : écran affiché sans débordement horizontal, carte des feux visible une fois atteinte',r.ok&&r.visible&&r.w<=r.iw+1,j(r));
  rec(G,'Aucune erreur JavaScript (téléphone)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

await closeBrowser();
ecrireResultats('resO.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
