// Suite N — passage en facturation réelle (R1 de la relecture du 05/10/2026), reprise d'une demande déjà servie
// avec un document modifié (R3), année du document autour du 31/12 (R4). Serveur simulé (mêmes règles que le SQL).
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import { ecrireResultats } from './env.mjs';
import { SERVEUR } from './serveur-simule.mjs';
const G='Passage au réel';

/* cloud + SIRET + serveur migré, SANS démarrage explicite ; 6 anciennes factures d'essai (2 soldes, 2 acomptes,
   2 dépannages) + 1 avoir sur l'une d'elles, comme sur l'appareil de Gabriel ; appels au serveur enregistrés */
const PREP=`(function(){
  window.SESS={user:{id:'u1',email:'test@test'}};
  Object.assign(P.entreprise,{nom:'Entreprise Test',siret:'12345678900012',adresse:"1 rue de l'Exemple",cp:'60000',ville:'Beauvais',natureChantier:'S',assurance:'Assureur Test n° 0001',assuranceZone:'France métropolitaine'});
  const o=sb.rpc; window.__appels=[]; sb.rpc=(n,p)=>{ __appels.push({n,p:JSON.parse(JSON.stringify(p||{}))}); return o(n,p); };
  const y=new Date().getFullYear(), t=todayISO(), N=k=>'F-'+y+'-00'+k;
  const dv=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0);
  dv[0].facSolde={num:N(1),date:t,montant:1000,payeLe:t,mode:'Virement'}; dv[1].facSolde={num:N(2),date:t,montant:2000};
  dv[0].facAcompte={num:N(3),date:t,montant:300}; dv[1].facAcompte={num:N(4),date:t,montant:400};
  save(LS.devis,DEVIS);
  DEP.push({id:'o5',cNom:'A',date:t,statut:'facturee',facNum:N(5),facDate:t,itype:'dep',heures:1,pieces:[]},{id:'o6',cNom:'B',date:t,statut:'facturee',facNum:N(6),facDate:t,itype:'dep',heures:1,pieces:[]});
  save(LS.dep,DEP);
  const AV=nxAvoirs(); AV.push({id:'av1',num:'AV-'+y+'-001',facNum:N(2),date:t,montant:50,motif:'Geste'}); save('cp2_avoirs',AV);
  window.__dvLibre=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0&&!x.facSolde&&!x.facAcompte).map(x=>x.id);
})();`;
async function preparer(){
  const {p,ctx,errs}=await page({mobile:false});
  const dialogues=[]; p.removeAllListeners('dialog'); p.on('dialog',d=>{ dialogues.push(d.message()); d.accept().catch(()=>{}); });
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(PREP);
  return {p,ctx,errs,dialogues};
}
const y=new Date().getFullYear();
const close=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;

/* N1. SIRET + cloud + serveur migré + factures d'essai : AUCUN passage automatique, aucun import */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(async c=>{ const m0=nxEmisMode(); const rp=await nxEmisRapprocher();
    const id=__dvLibre[0]; await facturerDevis(id,'solde'); eval(c); const d=DEVIS.find(x=>x.id===id);
    return {m0,rp,num:d.facSolde&&d.facSolde.num,appels:__appels.map(a=>a.n),recon:__srv.docs.length,badge:(document.getElementById('nxEmisBadge')||{}).textContent||''}; },close);
  rec(G,'SIRET saisi, cloud et serveur prêts : reste en démonstration tant que rien n\'est démarré',r.m0.mode==='demo'&&r.m0.demarre===false,JSON.stringify(r.m0));
  rec(G,'Aucun import ni aucune émission vers le serveur sans démarrage explicite',!r.appels.some(n=>/cp_importer_ancien|cp_emettre_document/.test(n))&&r.recon===0&&r.rp&&r.rp.fait===false,JSON.stringify({appels:r.appels,rp:r.rp}));
  rec(G,'Facture émise avant le démarrage : numéro de la série TEST',/^TEST-F-\d{4}-\d{3}$/.test(r.num||''),r.num);
  rec(G,'L\'indicateur dit que la facturation réelle est à démarrer',/à démarrer/.test(r.badge),r.badge);
  /* N2. écran : les 6 anciennes factures, « Essai » par défaut */
  const e=await p.evaluate(()=>{ go('params'); const c=document.getElementById('nxReelCard'); const s=[...c.querySelectorAll('select[data-reel-num]')]; return {n:s.length,essai:s.every(x=>x.value==='essai'),txt:c.textContent.slice(0,300)}; });
  rec(G,'Paramètres : les anciennes factures sont listées, « Essai » par défaut',e.n===6&&e.essai,JSON.stringify(e));
  /* N3. date passée et absence de SIRET refusées */
  const ref=await p.evaluate(()=>{ const a=nxEmisDemarrer('2000-01-01',{}); const s=P.entreprise.siret; P.entreprise.siret=''; const b=nxEmisDemarrer(todayISO(),{}); P.entreprise.siret=s; return {a,b,dec:nxEmisDecision()}; });
  rec(G,'Démarrage refusé sans SIRET ou avec une date passée',ref.a.err&&ref.b.err&&!ref.dec,JSON.stringify(ref));
  rec(G,'Aucune erreur de page (N1-N3)',!errs.length,errs.join(' | '));
  await ctx.close(); }

/* N4. démarrage par l'écran, sans rien choisir : tout en essais ; numérotation réelle depuis 1 */
{ const {p,ctx,errs,dialogues}=await preparer();
  const caAvant=await p.evaluate(y=>nxCaAnnee(y).facture,y);
  await p.evaluate(()=>{ go('params'); document.getElementById('nxReelDebut').value=todayISO(); nxEmisDemarrerUI(); });
  await p.waitForTimeout(800);
  const r=await p.evaluate(async c=>{ const id=__dvLibre[0]; await facturerDevis(id,'solde'); eval(c); const d=DEVIS.find(x=>x.id===id);
    const em=__appels.filter(a=>a.n==='cp_emettre_document'); const nums=nxInvoices().map(i=>i.num).sort(); const y=new Date().getFullYear();
    return {dec:nxEmisDecision(),mode:nxEmisMode().mode,num:d.facSolde&&d.facSolde.num,montant:d.facSolde&&d.facSolde.montant,min:em.length?em[em.length-1].p.p_min_numero:null,
      imports:__appels.filter(a=>a.n==='cp_importer_ancien').length,nums,avoirs:nxAvoirs().map(a=>a.num+'>'+a.facNum),dbl:Object.keys(nxEmisDoublons()),
      ca:nxCaAnnee(y).facture,recettes:allRecettes().map(x=>x.num),impayes:allImpayes().map(x=>x.num)}; },close);
  const confirmTxt=dialogues.find(t=>/Démarrer la facturation réelle/.test(t))||'';
  rec(G,'Démarrage : confirmation qui annonce le classement et le caractère définitif',/7 ancienne\(s\)[\s\S]*ESSAIS[\s\S]*0 importé[\s\S]*définitive/.test(confirmTxt),confirmTxt.slice(0,240));
  rec(G,'Décision enregistrée (date de début, choix)',r.dec&&r.dec.debut&&Object.keys(r.dec.anciens).length===7&&r.mode==='reel',JSON.stringify(r.dec).slice(0,240));
  rec(G,'Par défaut, les anciennes factures et leur avoir deviennent des essais (ESSAI-…)',r.nums.filter(n=>/^ESSAI-F-/.test(n)).length===6&&r.avoirs.includes('ESSAI-AV-'+y+'-001>ESSAI-F-'+y+'-002'),JSON.stringify({nums:r.nums,avoirs:r.avoirs}));
  rec(G,'Aucune ancienne facture importée au registre du serveur',r.imports===0,r.imports);
  rec(G,'p_min_numero sans les essais : première vraie facture F-…-001',r.min===0&&r.num==='F-'+y+'-001',JSON.stringify({min:r.min,num:r.num}));
  rec(G,'Aucun faux doublon entre les essais et les vrais numéros',!r.dbl.length,r.dbl.join(', '));
  rec(G,'Chiffre d\'affaires, recettes, impayés : sans les essais ni la période de démonstration',r.ca===r.montant&&caAvant>r.ca&&!r.recettes.some(n=>/ESSAI|TEST/.test(n))&&!r.impayes.some(n=>/ESSAI|TEST/.test(n)),JSON.stringify({caAvant,ca:r.ca,montant:r.montant,recettes:r.recettes,impayes:r.impayes}));
  const e=await p.evaluate(()=>{ go('params'); return document.getElementById('nxReelCard').textContent; });
  rec(G,'Paramètres après démarrage : date, essais et imports affichés, plus de bouton',/Démarrée le/.test(e)&&/7 classée\(s\) en essais/.test(e)&&!/Démarrer la facturation réelle/.test(e),e.slice(0,200));
  rec(G,'Aucune erreur de page (N4)',!errs.length,errs.join(' | '));
  await ctx.close(); }

/* N5. une ancienne facture choisie explicitement : importée seule ; la numérotation repart au-dessus d'ELLE seule */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(async c=>{ const y=new Date().getFullYear(); const res=nxEmisDemarrer(todayISO(),{['F-'+y+'-004']:'importer'});
    await nxEmisRapprocher(); const id=__dvLibre[0]; await facturerDevis(id,'solde'); eval(c); const d=DEVIS.find(x=>x.id===id);
    const em=__appels.filter(a=>a.n==='cp_emettre_document');
    return {res,imp:__appels.filter(a=>a.n==='cp_importer_ancien').map(a=>a.p.p_num),recon:__srv.docs.filter(x=>x.origine==='reconstitue').map(x=>x.num),
      min:em.length?em[em.length-1].p.p_min_numero:null,num:d.facSolde&&d.facSolde.num,nums:nxInvoices().map(i=>i.num)}; },close);
  rec(G,'Facture choisie : importée au registre (et elle seule)',JSON.stringify(r.recon)===JSON.stringify(['F-'+y+'-004'])&&r.imp.every(n=>n==='F-'+y+'-004'),JSON.stringify({imp:r.imp,recon:r.recon}));
  rec(G,'p_min_numero = la facture importée seulement (4), pas les essais (jusqu\'à 6)',r.min===4&&r.num==='F-'+y+'-005',JSON.stringify({min:r.min,num:r.num}));
  rec(G,'Les autres restent des essais renommés',r.nums.filter(n=>/^ESSAI-/.test(n)).length===5&&r.nums.includes('F-'+y+'-004'),JSON.stringify(r.nums));
  rec(G,'Aucune erreur de page (N5)',!errs.length,errs.join(' | '));
  await ctx.close(); }

/* N6. démarrage daté dans le futur : démonstration jusqu'à la date, puis réel */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(async ()=>{ const d=new Date(); d.setDate(d.getDate()+10); const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const res=nxEmisDemarrer(iso,{}); const avant=nxEmisMode(); nxEmisBadge(); const badge=document.getElementById('nxEmisBadge').textContent;
    const dec=nxEmisDecision(); dec.debut=todayISO(); localStorage.setItem('cp2_facturation',JSON.stringify(dec)); await nxEmisSonde(true); const apres=nxEmisMode();
    return {res,avant,apres,badge}; });
  rec(G,'Date future : démonstration jusqu\'à la date annoncée',r.res.ok&&r.avant.mode==='demo'&&r.avant.demarre===false&&/à partir du/.test(r.badge),JSON.stringify({avant:r.avant,badge:r.badge}));
  rec(G,'Date atteinte : facturation réelle',r.apres.mode==='reel'&&r.apres.demarre===true,JSON.stringify(r.apres));
  rec(G,'Aucune erreur de page (N6)',!errs.length,errs.join(' | '));
  await ctx.close(); }

/* R3. réponse perdue, devis modifié, nouveau clic : la facture ENREGISTRÉE fait foi, rien n'est recalculé */
{ const {p,ctx,errs,dialogues}=await preparer();
  const r=await p.evaluate(async c=>{ nxEmisDemarrer(todayISO(),{}); await nxEmisSonde(true);
    const id=__dvLibre[0], d=DEVIS.find(x=>x.id===id);
    __srv.fail.perdreReponse=true; await facturerDevis(id,'solde'); eval(c);
    const apres1=!!d.facSolde, montantServeur=__srv.docs[__srv.docs.length-1].payload.fac.montant;
    const l2=JSON.parse(JSON.stringify(d.lots[0])); l2.id='lot-ajoute'; d.lots.push(l2); save(LS.devis,DEVIS);
    const res=await facturerDevis(id,'solde'); eval(c);
    const e=nxEmisEntree(d.facSolde&&d.facSolde.num);
    return {apres1,montantServeur,res,fac:d.facSolde,entree:e&&{num:e.num,mode:e.mode,sid:e.sid},docs:__srv.docs.length,attente:Object.keys(nxEmisAttentes()).length}; },close);
  const msg=dialogues.find(t=>/fait foi/.test(t))||'';
  rec('Reprise R3','Première tentative perdue : rien appliqué sur l\'appareil',r.apres1===false,JSON.stringify({apres1:r.apres1}));
  rec('Reprise R3','Nouveau clic après modification : la facture du serveur est appliquée telle quelle (montant non recalculé)',r.res&&r.res.repris&&r.fac&&r.fac.montant===r.montantServeur&&r.docs===1,JSON.stringify({res:r.res,fac:r.fac&&{num:r.fac.num,montant:r.fac.montant},montantServeur:r.montantServeur,docs:r.docs}));
  rec('Reprise R3','Registre à jour, demande en attente effacée, message clair (avoir pour corriger)',r.entree&&r.entree.mode==='reel'&&r.entree.sid&&r.attente===0&&/avoir/.test(msg),JSON.stringify({entree:r.entree,attente:r.attente,msg:msg.slice(0,160)}));
  rec('Reprise R3','Aucune erreur de page',!errs.length,errs.join(' | '));
  await ctx.close(); }

/* R4. année du DOCUMENT (comme le serveur), pas celle de l'horloge */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{ const ya=new Date().getFullYear()-1, yb=ya+1;
    nxEmisDemarrer(todayISO(),{});
    const reg=JSON.parse(localStorage.getItem('cp2_docs')||'[]'); reg.push({id:'r1',num:'F-'+ya+'-007',mode:'reel',origine:'emis',type:'facture',serie:'F',date:ya+'-12-31',src:{k:'devis',id:'zz',w:'solde'},sid:'s1'}); localStorage.setItem('cp2_docs',JSON.stringify(reg));
    const n=nxEmisNumeros;
    return {ya,yb,minA:n.maxLocal('F',ya+'-12-31'),minB:n.maxLocal('F',yb+'-01-01'),tA:n.numTest('F',ya+'-12-31'),tB:n.numTest('F',yb+'-01-01')}; });
  rec('Année R4','Numéro minimal calculé sur l\'année de la date du document (31/12 → année précédente)',r.minA===7&&r.minB===0,JSON.stringify(r));
  rec('Année R4','Série TEST : année de la date du document',r.tA.indexOf('TEST-F-'+r.ya+'-')===0&&r.tB.indexOf('TEST-F-'+r.yb+'-')===0,JSON.stringify({tA:r.tA,tB:r.tB}));
  rec('Année R4','Aucune erreur de page',!errs.length,errs.join(' | '));
  await ctx.close(); }

await closeBrowser();
ecrireResultats('resN.json',RES);
RES.forEach(x=>console.log(x.ok.padEnd(5),'['+x.group+']',x.name,x.ok==='PASS'?'':'— '+x.detail));
