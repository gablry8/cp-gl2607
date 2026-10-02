// Suite K — fiscalité et cotisations (1.10, next-taux.js) : taux unique daté et sourcé, profil fiscal,
// ACRE selon la date, versement libératoire et CFP/CMA selon le profil, activité mixte, même taux sur tous
// les écrans, plafonds micro 2026, franchise de TVA (année de création, suivante, courante), avertissement
// logiciel de caisse.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';
const j=o=>JSON.stringify(o);
const close=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;

const {p,ctx,errs}=await page({mobile:false});
await seed(p);
const setP=o=>p.evaluate(o=>{ save('cp2_fiscal',o); },o);

/* K1 taux selon le profil */
{
  const r=await p.evaluate(()=>{ const out={};
    const P0=o=>{ save('cp2_fiscal',o); };
    P0({}); out.defaut=nxCotisPct('2026-10-02'); out.hyp=nxCotisExplication('2026-10-02').hypotheses;
    P0({acre:'oui',debut:'2026-07-15'}); out.acre25=nxCotisPct('2026-10-02'); out.fin25=nxFinAcre('2026-07-15'); out.apres25=nxCotisPct('2027-07-01'); out.dernierJour=nxCotisPct('2027-06-30');
    P0({acre:'oui',debut:'2026-03-10'}); out.acre50=nxCotisPct('2026-05-02'); out.fin50=nxFinAcre('2026-03-10');
    P0({acre:'oui'}); out.acreSansDate=nxCotisPct('2026-10-02');
    P0({vl:'non'}); out.sansVL=nxCotisPct('2026-10-02');
    P0({artisan:'non'}); out.commercant=nxCotisPct('2026-10-02');
    P0({manuel:30}); out.manuel=nxCotisPct('2026-10-02');
    P0({activite:'mixte',partVentes:40}); out.mixte=nxCotisPct('2026-10-02');
    out.urssaf1=nxFinAcre('2023-02-20'); out.urssaf2=nxFinAcre('2023-04-03');
    P0({}); return out; });
  rec('Fiscal','Profil par défaut (tout « à confirmer ») : 21,2 + VL 1,7 + CFP 0,3 + CMA 0,48 = 23,68 %',r.defaut===23.68,j(r));
  rec('Fiscal','Hypothèses affichées (ACRE non comptée, VL compté, artisan, ventilation, CFE)',r.hyp.length>=5&&r.hyp.some(h=>/ACRE à confirmer/.test(h))&&r.hyp.some(h=>/CFE/.test(h)),j(r.hyp));
  rec('Fiscal','ACRE, création au 15/07/2026 : taux = 75 % de 21,2 → 15,9 + 2,48 = 18,38 %',r.acre25===18.38,j(r));
  rec('Fiscal','ACRE : fin au 30/06/2027 (fin du 3e trimestre civil suivant), taux normal le 01/07/2027',r.fin25==='2027-06-30'&&r.dernierJour===18.38&&r.apres25===23.68,j(r));
  rec('Fiscal','ACRE, création avant le 01/07/2026 : réduction de 50 % (10,6 + 2,48 = 13,08 %), fin au 31/12/2026',r.acre50===13.08&&r.fin50==='2026-12-31',j(r));
  rec('Fiscal','Fin de l\'ACRE : exemples URSSAF (20/02/2023 → 31/12/2023 ; 03/04/2023 → 31/03/2024)',r.urssaf1==='2023-12-31'&&r.urssaf2==='2024-03-31',j(r));
  rec('Fiscal','ACRE cochée sans date de début : non comptée (prudent)',r.acreSansDate===23.68,j(r));
  rec('Fiscal','Sans versement libératoire : 21,98 % ; non artisan : CFP 0,1 % sans CMA (23 %)',r.sansVL===21.98&&r.commercant===23,j(r));
  rec('Fiscal','Taux manuel prioritaire ; activité mixte 40 % ventes = 19,74 %',r.manuel===30&&r.mixte===19.74,j(r));
}

/* K2 même taux sur tous les écrans */
{
  await setP({acre:'oui',debut:'2026-07-15'});
  const r=await p.evaluate(async c=>{ const t=nxCotisPct(); const out={t,P:P.cotisTaux};
    const d=DEVIS.find(x=>compute(x).totalHT>0), cd=compute(d); out.devis=Math.abs(cd.cotis-cd.totalHT*t/100)<0.01;
    const x={id:'kd',cNom:'Client K',cType:'Professionnel',date:todayISO(),itype:'dep',statut:'brouillon',heures:2,pieces:[],rateChoice:'custom',rateCustom:90};
    const cx=computeDep(x); out.dep=Math.abs(cx.cotis-cx.totalHT*t/100)<0.01;
    try{ const v2=DEVIS.find(y=>y.v===2&&compute(y).totalHT>0); if(v2){ const cv=compute(v2); out.v2=Math.abs(cv.cotis-cv.totalHT*t/100)<0.01; } }catch(e){ out.v2err=e.message; }
    go('dash'); await new Promise(r=>setTimeout(r,150)); out.dash=(document.getElementById('v-dash')||document.body).textContent.includes('Net après cotis. '+String(t).replace('.',',')+' %');
    go('params'); await new Promise(r=>setTimeout(r,150)); const pc=document.getElementById('pg_cotis'); out.param=pc&&+pc.value===t&&pc.readOnly; out.carte=!!document.getElementById('nxFiscal'); out.carteTxt=(document.getElementById('nxFiscalTotal')||{}).textContent;
    go('nx_regime'); await new Promise(r=>setTimeout(r,200)); const rg=(document.getElementById('nxRegime')||{}).textContent||''; out.regimeProv=rg.includes('provision '+String(t).replace('.',',')+' %');
    return out; },close);
  rec('Fiscal','P.cotisTaux = valeur calculée (compatibilité)',r.P===r.t,j(r));
  rec('Fiscal','Même taux : devis, intervention, devis v2, tableau de bord, Paramètres, Statut & régime',r.devis&&r.dep&&r.v2!==false&&r.dash&&r.param&&r.regimeProv,j(r));
  rec('Fiscal','Paramètres : taux en lecture seule + carte « Profil fiscal » avec le total',r.param&&r.carte&&r.carteTxt===String(r.t).replace('.',',')+' %',j(r));
}

/* K3 provision des encaissements : taux à la date de chaque encaissement (ACRE finie en cours d'année) */
{
  const r=await p.evaluate(async ()=>{ save('cp2_fiscal',{acre:'oui',debut:'2025-10-15'});
    LOC.push({id:'kl1',cNom:'K1',fac:{num:'KF-1',date:'2026-05-01',montant:1000,payeLe:'2026-05-01',mode:'CB'}},{id:'kl2',cNom:'K2',fac:{num:'KF-2',date:'2026-11-01',montant:1000,payeLe:'2026-11-01',mode:'CB'}});
    save(LS.loc,LOC); go('recettes'); await new Promise(r=>setTimeout(r,100)); const s=document.getElementById('recYear'); if(s){ if(![...s.options].some(o=>o.value==='2026')){ const o=document.createElement('option'); o.textContent='2026'; s.appendChild(o);} s.value='2026'; } renderRecettes();
    const k=(document.getElementById('recKpis')||{}).textContent||'';
    const att=1000*nxCotisPct('2026-05-01')/100+1000*nxCotisPct('2026-11-01')/100;
    const autres=allRecettes().filter(x=>x.date.slice(0,4)==='2026'&&!/^KF-/.test(x.num)).reduce((s,x)=>s+x.montant*nxCotisPct(x.date)/100,0);
    return {k:k.slice(0,300),r1:nxCotisPct('2026-05-01'),r2:nxCotisPct('2026-11-01'),att:Math.round((att+autres))}; });
  rec('Fiscal','Encaissements : ACRE (50 %) jusqu\'au 30/09/2026 puis taux normal',r.r1===13.08&&r.r2===23.68,j(r));
  rec('Fiscal','Livre des recettes : provision au taux de chaque date (« taux selon la date »)',/taux selon la date/.test(r.k)&&r.k.replace(/\s/g,'').includes(String(r.att.toLocaleString('fr-FR')).replace(/\s/g,'')),j(r));
}

/* K4 seuils : plafonds micro et franchise de TVA selon l'année */
{
  const r=await p.evaluate(()=>{ const out={};
    out.p2026=nxPlafondsMicro(2026); out.p2025=nxPlafondsMicro(2025); out.f2026=nxSeuilsFranchise(2026).services;
    const ca=m=>y=>{ const v=m[y]||0; return {facture:v,encaisse:v,retenu:v}; };
    save('cp2_fiscal',{debut:'2027-07-01'});
    out.creation20k=nxEtatFranchise('2027-12-15',ca({2027:20000})); out.creation42k=nxEtatFranchise('2027-12-15',ca({2027:42000}));
    out.suivante20k=nxEtatFranchise('2028-03-01',ca({2027:20000,2028:1000})); out.suivante15k=nxEtatFranchise('2028-03-01',ca({2027:15000,2028:10000}));
    out.microCreation=nxEtatMicro('2027-12-15',ca({2027:60000}));
    save('cp2_fiscal',{debut:'2024-03-01'});
    out.courante38=nxEtatFranchise('2026-10-02',ca({2025:30000,2026:38000})); out.precedente38=nxEtatFranchise('2026-02-01',ca({2025:38000,2026:2000}));
    out.ok=nxEtatFranchise('2026-10-02',ca({2025:30000,2026:10000})); out.microDep=nxEtatMicro('2026-10-02',ca({2026:90000}));
    save('cp2_fiscal',{}); out.inconnue=nxEtatFranchise('2026-10-02',ca({2026:10000}));
    const ov=load(LS.over,{}); ov.regimeTVA='assujetti'; save(LS.over,ov); rebuildP(); out.assujetti=nxEtatFranchise('2026-10-02',ca({2026:10000})).statut;
    ov.regimeTVA='franchise'; save(LS.over,ov); rebuildP();
    return out; });
  rec('Fiscal','Plafonds micro : 83 600 / 203 100 € en 2026 (77 700 / 188 700 € en 2025)',r.p2026.services===83600&&r.p2026.ventes===203100&&r.p2025.services===77700,j([r.p2026,r.p2025]));
  rec('Fiscal','Franchise 2026 : 37 500 € (base) / 41 250 € (majoré)',r.f2026.base===37500&&r.f2026.majore===41250,j(r.f2026));
  rec('Fiscal','Création au 01/07/2027, 20 000 € : franchise gardée en 2027 mais perdue au 01/01/2028 (seuil proratisé ≈ 18 904 €)',r.creation20k.statut==='perte_au_1er_janvier'&&Math.round(r.creation20k.seuilAnneeSuivante)===18904,j(r.creation20k));
  rec('Fiscal','Année de création : au-delà de 41 250 € (sans prorata) → TVA dès le jour du dépassement',r.creation42k.statut==='perdue_immediate',j(r.creation42k.statut));
  rec('Fiscal','Année suivant la création : CA de création comparé au seuil proratisé',r.suivante20k.statut==='perdue_1er_janvier'&&r.suivante15k.statut==='ok',j([r.suivante20k.message,r.suivante15k.statut]));
  rec('Fiscal','Année courante : 38 000 € → franchise perdue au 1er janvier suivant (pas en cours d\'année)',r.courante38.statut==='perte_au_1er_janvier',r.courante38.message);
  rec('Fiscal','Année courante : CA de l\'an dernier > 37 500 € → franchise perdue depuis le 1er janvier',r.precedente38.statut==='perdue_1er_janvier',r.precedente38.message);
  rec('Fiscal','Sous les seuils : « ok » avec le reste avant seuil ; sans date de début, hypothèse affichée',r.ok.statut==='ok'&&r.ok.reste===27500&&r.inconnue.hypotheses.some(h=>/non renseignée/.test(h)),j([r.ok.message,r.inconnue.hypotheses]));
  rec('Fiscal','Micro de plein droit l\'année de création ; 90 000 € une année courante → dépassement signalé',r.microCreation.statut==='de_droit'&&r.microDep.statut==='depasse',j([r.microCreation.message,r.microDep.message]));
  rec('Fiscal','Assujetti à la TVA : compteur de franchise sans objet',r.assujetti==='assujetti',r.assujetti);
}

/* K5 chiffre d'affaires réel (facturé − avoirs, encaissé) et cartes d'affichage */
{
  const r=await p.evaluate(async c=>{ save('cp2_fiscal',{}); const y=new Date().getFullYear(); const a0=nxCaAnnee(y);
    const d=DEVIS.find(x=>x.statut==='accepte'&&!x.facSolde&&compute(x).totalHT>0&&x.cType==='Professionnel'); await facturerDevis(d.id,'solde'); eval(c);
    const m=d.facSolde.montant; const a1=nxCaAnnee(y); window.askMode=()=>'Virement'; payerFacture('devis',d.id,'solde'); const a2=nxCaAnnee(y);
    const av=nxCreateAvoir({facNum:d.facSolde.num,montant:50,motif:'Geste commercial'}); const a3=nxCaAnnee(y);
    go('nx_journee'); await new Promise(r=>setTimeout(r,300)); const jn=(document.getElementById('nxSeuilsJ')||{}).textContent||'';
    go('nx_regime'); await new Promise(r=>setTimeout(r,300)); const rg=((document.getElementById('nxRegime')||{}).textContent||'').replace(/[\u202f\u00a0]/g,' ');
    return {m,df:Math.round((a1.facture-a0.facture)*100)/100,de:Math.round((a2.encaisse-a1.encaisse)*100)/100,dav:Math.round((a2.facture-a3.facture)*100)/100,av:!!(av&&av.av),jn:jn,
      rg83:rg.includes('83 600'),rg77:rg.includes('77 700'),caisse:/Logiciel de caisse/.test(rg)&&/certifi/.test(rg),seuils:rg.includes('Franchise de TVA'),
      acreLbl:(rg.match(/Année 1 — ACRE \(([\d,]+) %\)/)||[])[1]||'',bad:(rg.match(/undefined|NaN/g)||[]).length}; },close);
  rec('Fiscal','CA réel : facture (+'+r.m+'), encaissement, avoir (−50) bien comptés',r.df===r.m&&r.de===r.m&&r.dav===50&&r.av,j(r));
  rec('Fiscal','Ma journée : carte « Seuils » (franchise de TVA + régime micro)',/Franchise de TVA/.test(r.jn)&&/Régime micro/.test(r.jn),r.jn.slice(0,300));
  rec('Fiscal','Statut & régime : plafond 83 600 € (plus de 77 700 €), seuils réels affichés, sans « undefined »',r.rg83&&!r.rg77&&r.seuils&&r.bad===0,j(r));
  rec('Fiscal','Statut & régime : ACRE du simulateur = 15,9 % (création ≥ 01/07/2026 supposée, hypothèse affichée)',r.acreLbl==='15,9',j(r.acreLbl));
  rec('Fiscal','Bascule TVA : avertissement « logiciel de caisse certifié »',r.caisse,'');
}

/* K6 Paramètres : modifier le profil met à jour tout l'appli */
{
  const r=await p.evaluate(async ()=>{ save('cp2_fiscal',{}); go('params'); await new Promise(r=>setTimeout(r,150));
    const a=nxCotisPct(); nxFiscalUI('fx_debut','2026-07-15'); nxFiscalUI('fx_acre','oui');
    const b=nxCotisPct(), t=(document.getElementById('nxFiscalTotal')||{}).textContent, pc=+(document.getElementById('pg_cotis')||{}).value, stored=JSON.parse(localStorage.getItem('cp2_fiscal')||'{}');
    const synced=SYNC_KEYS.includes('cp2_fiscal');
    return {a,b,t,pc,P:P.cotisTaux,stored:{acre:stored.acre,debut:stored.debut},synced}; });
  rec('Fiscal','Profil modifié : taux, Paramètres et P.cotisTaux mis à jour ensemble',r.a===23.68&&r.b===18.38&&r.t==='18,38 %'&&r.pc===18.38&&r.P===18.38,j(r));
  rec('Fiscal','Profil fiscal enregistré et synchronisé entre appareils',r.stored.acre==='oui'&&r.stored.debut==='2026-07-15'&&r.synced,j(r));
}

rec('Fiscal','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await ctx.close();
await closeBrowser();
fs.mkdirSync('/tmp/claude-0/sp',{recursive:true});
fs.writeFileSync('/tmp/claude-0/sp/resK.json',JSON.stringify(RES,null,1));
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
