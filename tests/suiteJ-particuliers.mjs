import { ecrireResultats } from './env.mjs';
// Suite J — contrats avec les particuliers (1.10, next-particuliers.js) :
// mode de conclusion ≠ urgence, « à préciser » bloque toute demande de paiement, délai de 7 jours (L221-10)
// sur tous les parcours (facture, encaissement, intervention, relance), paiement reçu malgré tout tracé,
// rétractation selon le mode, contrat de dépannage avant travaux, remise de l'exemplaire avec preuve.
import {page,rec,RES,closeBrowser,seed,getBrowser} from './lib.mjs';
import fs from 'fs';

/* boîtes de dialogue simulées dans la page + petites aides */
const PREP=`(function(){
  window.__dlg=[]; window.__q=[]; window.__oui=false; window.__rep=null;
  window.alert=m=>{ __dlg.push('A:'+m); };
  window.confirm=m=>{ __dlg.push('C:'+m); return __q.length?!!__q.shift():!!__oui; };
  window.prompt=(m,d)=>{ __dlg.push('P:'+m); return __rep!=null?__rep:d; };
  window.askMode=()=>'Virement';
  window.J={
    iso:n=>nxPartPlusJours(todayISO(),n),
    d8:iso=>String(iso).replace(/-/g,''),
    devis:(conc,extra)=>{ const src=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0);
      const d=JSON.parse(JSON.stringify(src)); d.id='J'+Math.random().toString(36).slice(2,8); d.num=src.num+'-'+d.id;
      d.cType='Particulier'; d.cNom='Mme Test Particulier'; delete d.facAcompte; delete d.facSolde; delete d.conclusion;
      if(conc) d.conclusion=conc; Object.assign(d,extra||{}); DEVIS.push(d); save(LS.devis,DEVIS); return d; },
    fic:num=>(JSON.parse(localStorage.getItem('cpnext_docs_fichiers')||'{}')[num])||{},
    taches:()=>JSON.parse(localStorage.getItem('cpnext_tasks')||'[]'),
    reset:()=>{ __dlg.length=0; __q.length=0; __oui=false; __rep=null; const m=document.getElementById('nxPartM'); if(m) m.remove(); }
  };
})();`;
const close=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;
const j=o=>JSON.stringify(o);

const {p,ctx,errs}=await page({mobile:false});
await seed(p); await p.evaluate(PREP);

/* J1 « à préciser » (par défaut) : la facture n'est pas émise, la fenêtre de conclusion s'ouvre */
{
  const r=await p.evaluate(async c=>{ J.reset(); const d=J.devis(null); await facturerDevis(d.id,'solde'); eval(c);
    const dd=DEVIS.find(x=>x.id===d.id);
    return {id:d.id,fac:!!dd.facSolde,alerte:__dlg.some(m=>/^A:.*à préciser/.test(m)),fen:!!document.getElementById('nxPartM'),mode:(document.getElementById('nxpMode')||{}).value}; },close);
  rec('Particuliers','Mode « à préciser » : facture (demande de paiement) non émise',!r.fac&&r.alerte,j(r));
  rec('Particuliers','Mode « à préciser » : la fenêtre « où le contrat a-t-il été conclu ? » s\'ouvre',r.fen&&r.mode==='a_preciser',j(r));

  /* on remplit la fenêtre : signé chez le client aujourd'hui, sans urgence */
  const r2=await p.evaluate(async (a)=>{ const [id,c]=a;
    document.getElementById('nxpMode').value='hors_etablissement'; document.getElementById('nxpDate').value=todayISO(); document.getElementById('nxpOk').click();
    const d=DEVIS.find(x=>x.id===id); const conc=d.conclusion;
    J.reset(); await facturerDevis(id,'solde'); eval(c);
    const f=DEVIS.find(x=>x.id===id).facSolde, fic=f?J.fic(f.num):{}, xml=f?(nxEmisXmlFige(f.num)||''):'';
    const due=(xml.match(/<ram:DueDateDateTime><udt:DateTimeString format="102">(\d{8})/)||[])[1]||'';
    return {conc,num:f&&f.num,exig:f&&f.exigibleLe,attendu:J.iso(8),html:/Paiement exigible à partir du/.test(fic.html||''),due,dueAttendu:J.d8(J.iso(8)),
      reg:(nxEmisEntree(f&&f.num)||{}).fac}; },[r.id,close]);
  rec('Particuliers','Conclusion enregistrée avec mode, date réelle et preuve (pas la date « Accepté »)',r2.conc&&r2.conc.mode==='hors_etablissement'&&r2.conc.date&&r2.conc.preuve&&r2.conc.urgence===false,j(r2.conc));
  rec('Particuliers','Hors établissement : facture émise, exigible à J+8 (jour de conclusion non compté)',!!r2.num&&r2.exig===r2.attendu,j(r2));
  rec('Particuliers','Hors établissement : date d\'exigibilité imprimée sur le PDF figé',r2.html,j(r2));
  rec('Particuliers','Hors établissement : XML figé — échéance (BT-9) = J+8',r2.due===r2.dueAttendu,j(r2));
  rec('Particuliers','Hors établissement : date d\'exigibilité gardée dans la version figée (registre)',!!(r2.reg&&r2.reg.exigibleLe===r2.attendu),j(r2.reg));

  /* encaissement avant J+8 */
  const r3=await p.evaluate(async id=>{ J.reset(); __oui=false; payerFacture('devis',id,'solde');
    const f1=JSON.parse(JSON.stringify(DEVIS.find(x=>x.id===id).facSolde)), d1=__dlg.slice();
    J.reset(); __oui=true; payerFacture('devis',id,'solde'); const f2=DEVIS.find(x=>x.id===id).facSolde;
    const t=J.taches().find(x=>x.ref==='L221-10-'+f2.num);
    return {paye1:f1.payeLe,avert:d1.some(m=>/délai de 7 jours/.test(m)&&/L242-7/.test(m)),paye2:f2.payeLe,irr:f2.paiementIrregulier,tache:t&&t.title}; },r.id);
  rec('Particuliers','Encaissement avant J+8 : avertissement (L221-10, L242-7) ; « non » = rien n\'est enregistré',r3.avert&&!r3.paye1,j(r3));
  rec('Particuliers','Paiement reçu malgré tout : enregistré tel quel, marqué IRRÉGULIER',!!r3.paye2&&r3.irr&&r3.irr.statut==='irregulier'&&r3.irr.des===await p.evaluate(()=>J.iso(8)),j(r3));
  rec('Particuliers','Paiement irrégulier : tâche de régularisation créée',/Régulariser/.test(r3.tache||''),j(r3));
}

/* J2 calcul du délai : J+7 encore interdit, J+8 autorisé */
{
  const r=await p.evaluate(()=>{ const a=J.devis({mode:'hors_etablissement',date:J.iso(-7)}), b=J.devis({mode:'hors_etablissement',date:J.iso(-8)});
    return {a:nxPartRegle('devis',a.id),b:nxPartRegle('devis',b.id)}; });
  rec('Particuliers','Délai : conclu il y a 7 jours → paiement encore interdit (possible demain)',r.a.ok===false&&r.a.motif==='delai',j(r.a));
  rec('Particuliers','Délai : conclu il y a 8 jours → paiement possible',r.b.ok===true,j(r.b));
}

/* J3 cas sans délai : délai expiré, urgence demandée, contrat dans les locaux, à distance, client professionnel */
{
  const r=await p.evaluate(async c=>{
    const out={};
    const cas={expire:[{mode:'hors_etablissement',date:J.iso(-10)}],urgence:[{mode:'hors_etablissement',date:todayISO(),urgence:true,urgenceTexte:'Panne totale en canicule'}],
      locaux:[{mode:'locaux',date:todayISO()}],distance:[{mode:'distance',date:todayISO()}],pro:[null,{cType:'Professionnel',cNom:'Boulangerie Dupré'}]};
    for(const k of Object.keys(cas)){ J.reset(); const d=J.devis(cas[k][0],cas[k][1]); await facturerDevis(d.id,'solde'); eval(c);
      let f=DEVIS.find(x=>x.id===d.id).facSolde; const dlgFac=__dlg.length;
      J.reset(); if(f) payerFacture('devis',d.id,'solde'); f=DEVIS.find(x=>x.id===d.id).facSolde;
      out[k]={num:f&&f.num,exig:f&&f.exigibleLe||null,paye:f&&f.payeLe,irr:!!(f&&f.paiementIrregulier),dlgFac,dlgPay:__dlg.length}; }
    return out; },close);
  const sans=k=>!!r[k].num&&!r[k].exig&&!!r[k].paye&&!r[k].irr&&r[k].dlgFac===0&&r[k].dlgPay===0;
  rec('Particuliers','Délai expiré (conclu il y a 10 jours) : facture et encaissement normaux',sans('expire'),j(r.expire));
  rec('Particuliers','Urgence expressément demandée (case à part) : pas de délai',sans('urgence'),j(r.urgence));
  rec('Particuliers','Contrat conclu dans les locaux : pas de délai',sans('locaux'),j(r.locaux));
  rec('Particuliers','Contrat à distance : pas de délai de paiement (L221-10 vise le hors établissement)',sans('distance'),j(r.distance));
  rec('Particuliers','Client professionnel : aucun contrôle particulier',sans('pro'),j(r.pro));
}

/* J4 ancienne facture d'un particulier (mode à préciser) : encaissement « à vérifier », relance bloquée */
{
  const r=await p.evaluate(()=>{ J.reset(); const d=J.devis(null,{facSolde:{num:'F-2025-050',date:'2025-12-01',montant:100,payeLe:null,mode:''}});
    let mails=0; const bm=window.buildMail; window.buildMail=function(){ mails++; };
    mailRelancePaiement('devis',d.id,'solde'); const relanceBloquee=mails===0&&__dlg.some(m=>/Relance non préparée/.test(m)); const fen=!!document.getElementById('nxPartM');
    J.reset(); __q=[false,false]; payerFacture('devis',d.id,'solde'); const p0=DEVIS.find(x=>x.id===d.id).facSolde.payeLe;
    J.reset(); __q=[false,true]; payerFacture('devis',d.id,'solde'); const f=JSON.parse(JSON.stringify(DEVIS.find(x=>x.id===d.id).facSolde));
    const t=J.taches().find(x=>x.ref==='L221-10-F-2025-050');
    const d2=DEVIS.find(x=>x.id===d.id); d2.conclusion={mode:'locaux',date:'2025-11-20'}; d2.facSolde.payeLe=null; mails=0; J.reset(); mailRelancePaiement('devis',d.id,'solde');
    window.buildMail=bm;
    return {relanceBloquee,fen,p0,paye:f.payeLe,statut:f.paiementIrregulier&&f.paiementIrregulier.statut,tache:t&&t.title,relanceApres:mails}; });
  rec('Particuliers','Relance de paiement par mail bloquée tant que le contrat est « à préciser »',r.relanceBloquee&&r.fen,j(r));
  rec('Particuliers','Encaissement d\'une ancienne facture « à préciser » : « non » = rien n\'est enregistré',!r.p0,j(r));
  rec('Particuliers','Paiement déjà reçu : enregistré, marqué « à vérifier », tâche créée',!!r.paye&&r.statut==='a_verifier'&&/Vérifier/.test(r.tache||''),j(r));
  rec('Particuliers','Relance possible une fois le contrat précisé (dans les locaux)',r.relanceApres===1,j(r));
}

/* J5 rétractation sur le devis papier, selon le mode */
{
  const r=await p.evaluate(async c=>{
    const out={};
    for(const [k,conc,extra] of [['preciser',null],['hors',{mode:'hors_etablissement',date:'2026-09-28'}],['distance',{mode:'distance',date:'2026-09-28'}],['locaux',{mode:'locaux',date:'2026-09-28'}],['pro',null,{cType:'Professionnel'}]]){
      const d=J.devis(conc,extra); cur=JSON.parse(JSON.stringify(d)); printDevis(); const h=document.getElementById('devisDoc').innerHTML; eval(c);
      printDevis(); const h2=document.getElementById('devisDoc').innerHTML; eval(c);
      out[k]={n:(h.match(/data-retractation/g)||[]).length,n2:(h2.match(/data-retractation/g)||[]).length,l221:/data-l221-10/.test(h),
        titre:(h.match(/client particulier — ([^)]*)\)/)||[])[1]||'',j8:/à partir du 06\/10\/2026/.test(h),formulaire:/Formulaire de rétractation/.test(h),
        anticipe:/demande expressément que les travaux commencent/.test(h),remise:/Exemplaire client/.test(h),bad:(h.match(/undefined|NaN/g)||[]).length}; }
    return out; },close);
  rec('Particuliers','Devis « à préciser » : rétractation + avertissement de paiement (7 jours)',r.preciser.n===1&&r.preciser.l221&&/à distance ou hors établissement/.test(r.preciser.titre),j(r.preciser));
  rec('Particuliers','Devis signé chez le client : titre « hors établissement », paiement à partir de J+8 imprimé',r.hors.n===1&&r.hors.l221&&r.hors.titre==='contrat conclu hors établissement'&&r.hors.j8,j(r.hors));
  rec('Particuliers','Devis à distance : rétractation et formulaire, sans délai de paiement',r.distance.n===1&&!r.distance.l221&&r.distance.titre==='contrat conclu à distance'&&r.distance.formulaire,j(r.distance));
  rec('Particuliers','Devis conclu dans les locaux : pas de rétractation, accusé de remise présent',r.locaux.n===0&&!r.locaux.l221&&r.locaux.remise,j(r.locaux));
  rec('Particuliers','Demande expresse de commencement anticipé (L221-25) sur le devis papier',r.hors.anticipe&&r.preciser.anticipe&&!r.locaux.anticipe,j(r.hors));
  rec('Particuliers','Client professionnel : rien d\'ajouté',r.pro.n===0&&!r.pro.l221&&!r.pro.remise,j(r.pro));
  rec('Particuliers','Pas de doublon de rétractation à la 2e impression, ni de « undefined/NaN »',['preciser','hors','distance'].every(k=>r[k].n2===1&&r[k].bad===0),j(r));
}

/* J6 dépannage chez un particulier : contrat AVANT travaux */
{
  const r=await p.evaluate(async c=>{ J.reset(); newDep('dep'); await new Promise(r=>setTimeout(r,50));
    Object.assign(curDep,{cNom:'M. Dépannage Test',cAdr:'10 Rue de Grenelle',cVille:'75007 Paris',desc:'Recherche de panne et remplacement du condensateur',heures:1.5,
      pieces:[{nom:'Condensateur 35 µF',qte:1,achat:8,vente:24}]}); loadDepForm();
    const ban=(document.getElementById('nxPartDep')||{}).textContent||'';
    nxPartContratDep(); const h=document.getElementById('devisDoc').innerHTML; eval(c);
    /* sans contrat préalable, client refuse de facturer → rien */
    curDep.conclusion={mode:'hors_etablissement',date:todayISO(),urgence:true,urgenceTexte:'Panne totale'}; loadDepForm();
    J.reset(); __oui=false; await factureDep(); const fac0=curDep.facNum, msg0=__dlg.find(m=>/AVANT les travaux/.test(m))||'';
    J.reset(); __oui=true; await factureDep(); eval(c); const x=DEP.find(o=>o.id===curDep.id)||{};
    const ban2=(document.getElementById('nxPartDep')||{}).textContent||'';
    return {ban,ok:{titre:/Contrat d'intervention/.test(h),taux:/taux horaire/.test(h)&&/TTC/.test(h),temps:/temps est compté/.test(h),depl:/déplacement/i.test(h),nature:/Nature exacte des travaux/.test(h)&&/condensateur/.test(h),
      decompte:/Quantité × prix unitaire/.test(h)&&/1 × 24,00/.test(h),total:/Total/.test(h),gratuit:/gratuit/.test(h),date:/Contrat établi le/.test(h),client:/M\. Dépannage Test/.test(h)&&/Grenelle/.test(h),signature:/Bon pour accord/.test(h),
      urgence:false},bad:(h.match(/undefined|NaN/g)||[]).length,fac0,msg0:!!msg0,fac1:x.facNum,trace:x.contratAvantManquant,ban2}; },close);
  rec('Particuliers','Dépannage particulier : bandeau « à faire AVANT de commencer » dès l\'ouverture',/AVANT de commencer/.test(r.ban),r.ban.slice(0,160));
  const manquants=Object.keys(r.ok).filter(k=>k!=='urgence'&&!r.ok[k]);
  rec('Particuliers','Contrat d\'intervention : mentions des art. 2 et 4 de l\'arrêté du 24/01/2017 présentes',manquants.length===0&&r.bad===0,'manquent : '+manquants.join(', ')+' ; bad='+r.bad);
  rec('Particuliers','Facturer sans contrat préalable : avertissement, « non » = pas de facture',!r.fac0&&r.msg0,j({fac0:r.fac0,msg0:r.msg0}));
  rec('Particuliers','Facturer quand même : facture émise et manquement tracé sur l\'intervention',/^TEST-F-/.test(r.fac1||'')&&!!(r.trace&&r.trace.date)&&/Facturé sans contrat préalable/.test(r.ban2),j({fac1:r.fac1,trace:r.trace}));
}

/* J7 intervention hors établissement non urgente : contrat signé avant, facture J+8, bascule « payée » protégée */
{
  const r=await p.evaluate(async c=>{ J.reset(); newDep('dep'); await new Promise(r=>setTimeout(r,50));
    Object.assign(curDep,{cNom:'Mme Entretien Test',cAdr:'5 Rue de la Gare',cVille:'60600 Clermont',desc:'Entretien annuel',conclusion:{mode:'hors_etablissement',date:todayISO()}}); loadDepForm();
    __rep=null; nxPartContratSigne(); const ca=curDep.contratAvant;
    J.reset(); await factureDep(); eval(c); const id=curDep.id, x=DEP.find(o=>o.id===id);
    const dlgFac=__dlg.filter(m=>/AVANT les travaux/.test(m)).length, exig=x.facExigibleLe, fic=J.fic(x.facNum);
    J.reset(); __oui=false; payDep(id); const st1=DEP.find(o=>o.id===id).statut;
    J.reset(); __oui=true; payDep(id); const y=DEP.find(o=>o.id===id);
    const st2=y.statut, irr=y.paiementIrregulier;
    J.reset(); payDep(id); const st3=DEP.find(o=>o.id===id).statut, dlg3=__dlg.length;
    return {ca,dlgFac,exig,attendu:J.iso(8),html:/Paiement exigible à partir du/.test(fic.html||''),st1,st2,irr,st3,dlg3}; },close);
  rec('Particuliers','Contrat d\'intervention signé enregistré (date + preuve) : plus d\'avertissement à la facturation',!!(r.ca&&r.ca.date&&r.ca.preuve==='papier')&&r.dlgFac===0,j(r));
  rec('Particuliers','Intervention hors établissement : facture exigible à J+8 (PDF figé compris)',r.exig===r.attendu&&r.html,j(r));
  rec('Particuliers','Bascule « payée » avant J+8 : « non » = reste à payer',r.st1==='facturee',j(r));
  rec('Particuliers','Bascule « payée » malgré tout : payée et marquée irrégulière',r.st2==='payee'&&r.irr&&r.irr.statut==='irregulier',j(r));
  rec('Particuliers','Annuler un paiement (retour à « facturée ») : aucune question',r.st3==='facturee'&&r.dlg3===0,j(r));
}

/* J8 remise de l'exemplaire : « remis » seulement avec une preuve */
{
  const r=await p.evaluate(()=>{ J.reset(); const d=J.devis({mode:'hors_etablissement',date:todayISO()}); cur=JSON.parse(JSON.stringify(d)); renderFBloc();
    const t0=(document.getElementById('nxPartBloc')||{}).textContent||'';
    /* sans accusé signé : rien n'est enregistré */
    nxPartRemisePapier('devis',d.id); document.getElementById('nxrDate').value='2026-10-01'; document.getElementById('nxrOk').click();
    const sansAccuse=!(DEVIS.find(x=>x.id===d.id).conclusion||{}).remise&&__dlg.some(m=>/Sans accusé/.test(m)); document.getElementById('nxPartM').remove();
    nxPartRemisePapier('devis',d.id); document.getElementById('nxrDate').value='2026-10-01'; document.getElementById('nxrAccuse').checked=true; document.getElementById('nxrOk').click();
    cur=JSON.parse(JSON.stringify(DEVIS.find(x=>x.id===d.id))); renderFBloc();
    const t1=(document.getElementById('nxPartBloc')||{}).textContent||'';
    const e=J.devis({mode:'distance',date:todayISO()},{signature:{at:'2026-10-01T10:00:00Z',nom:'Mme Test',token:'tok1',copieLe:'2026-10-02T09:00:00Z'}}); cur=JSON.parse(JSON.stringify(e)); renderFBloc();
    const t2=(document.getElementById('nxPartBloc')||{}).textContent||'';
    return {t0,t1,t2,sansAccuse,rem:DEVIS.find(x=>x.id===d.id).conclusion.remise}; });
  rec('Particuliers','Exemplaire client : « non confirmé » sans preuve',/Exemplaire client : non confirmé/.test(r.t0),r.t0.slice(0,200));
  rec('Particuliers','Exemplaire papier : rien n\'est enregistré sans accusé de remise signé',r.sansAccuse,j(r.sansAccuse));
  rec('Particuliers','Exemplaire papier : « déclarée remise le » avec les pièces remises (contrat + formulaire de rétractation)',/déclarée remise le 01\/10\/2026/.test(r.t1)&&/Formulaire de rétractation/.test(r.t1)&&r.rem&&r.rem.accuseSigne===true&&r.rem.pieces.includes('retractation'),r.t1.slice(0,260));
  rec('Particuliers','Exemplaire électronique : téléchargement enregistré par le serveur affiché',/téléchargé par le client le 02\/10\/2026/.test(r.t2),r.t2.slice(0,200));
  /* synchro des signatures : la date de remise ne vient que de la ligne du serveur portant le même jeton */
  const r2=await p.evaluate(()=>{ const a=J.devis({mode:'distance',date:todayISO()},{signature:{at:'2026-10-01T10:00:00Z',nom:'X',token:'tokA'}}), b=J.devis({mode:'distance',date:todayISO()},{signature:{at:'2026-10-01T10:00:00Z',nom:'Y',token:'tokB'}});
    nxsRemises([{statut:'signe',doc_type:'devis',doc_id:a.id,token:'tokA',copie_le:'2026-10-02T08:00:00Z',support_durable_accord:true},{statut:'signe',doc_type:'devis',doc_id:b.id,token:'AUTRE',copie_le:'2026-10-02T08:00:00Z'}]);
    return {a:DEVIS.find(x=>x.id===a.id).signature,b:DEVIS.find(x=>x.id===b.id).signature}; });
  const r3=await p.evaluate(()=>{ const a=J.devis(null), b=J.devis({mode:'hors_etablissement',date:'2026-09-30',preuve:{type:'papier',ref:'bon signé'}});
    nxsApplySig({doc_type:'devis',doc_id:a.id,statut:'signe',signed_at:'2026-10-01T22:30:00Z',signer_nom:'Mme Test',doc_hash:'abcdef0123456789',token:'tokS'});
    nxsApplySig({doc_type:'devis',doc_id:b.id,statut:'signe',signed_at:'2026-10-01T22:30:00Z',signer_nom:'Mme Test',doc_hash:'abc',token:'tokT'});
    return {a:DEVIS.find(x=>x.id===a.id).conclusion,b:DEVIS.find(x=>x.id===b.id).conclusion}; });
  rec('Particuliers','Signature en ligne : date de conclusion = horodatage serveur (jour à Paris) + preuve, mode NON deviné',r3.a&&r3.a.date==='2026-10-02'&&r3.a.mode==='a_preciser'&&r3.a.preuve.type==='signature_en_ligne',j(r3.a));
  rec('Particuliers','Signature en ligne : une conclusion déjà saisie n\'est pas écrasée',r3.b.date==='2026-09-30'&&r3.b.mode==='hors_etablissement'&&r3.b.preuve.type==='papier',j(r3.b));
  rec('Particuliers','Synchro : date de remise reprise du serveur (jeton identique seulement)',r2.a.copieLe==='2026-10-02T08:00:00Z'&&r2.a.supportDurable===true&&!r2.b.copieLe,j(r2));
}

/* J11 dépannage : contrôle AVANT le démarrage des travaux (fenêtre bloquante, report tracé) */
{
  const r=await p.evaluate(async ()=>{ J.reset(); const out={};
    const ferme=()=>{ const e=document.getElementById('nxPartPorte'); if(e) e.remove(); };
    ferme(); go('dep'); newDep('dep'); await new Promise(r=>setTimeout(r,50)); out.sansClient=!!document.getElementById('nxPartPorte');
    curDep.cNom='Mme Porte Test'; loadDepForm(); out.ouverte=!!document.getElementById('nxPartPorte'); out.txt=(document.getElementById('nxPartPorte')||{}).textContent||'';
    document.getElementById('nxpgRep').click(); out.sansMotif=!!document.getElementById('nxPartPorte')&&__dlg.some(m=>/motif/.test(m))&&!curDep.contratReporte;
    document.getElementById('nxpgMotif').value='Simple diagnostic, aucun travail réalisé'; document.getElementById('nxpgRep').click();
    const x=DEP.find(o=>o.id===curDep.id)||{}; out.reporte=!document.getElementById('nxPartPorte')&&x.contratReporte&&/diagnostic/.test(x.contratReporte.motif);
    out.bandeau=/Contrat reporté/.test((document.getElementById('nxPartDep')||{}).textContent||''); loadDepForm(); out.pasRouvert=!document.getElementById('nxPartPorte');
    newDep('dep'); await new Promise(r=>setTimeout(r,50)); document.getElementById('dp_cNom').value='M. Signe Test'; saveDep(); out.surEnregistrement=!!document.getElementById('nxPartPorte');
    __rep=null; document.getElementById('nxpgSig').click(); out.signe=!!(curDep.contratAvant&&curDep.contratAvant.date)&&!document.getElementById('nxPartPorte'); loadDepForm(); out.signePasRouvert=!document.getElementById('nxPartPorte');
    ferme(); newDep('dep'); await new Promise(r=>setTimeout(r,50)); curDep.cNom='Boulangerie Pro'; curDep.cType='Professionnel'; loadDepForm(); out.pro=!document.getElementById('nxPartPorte');
    /* changer d'intervention ou quitter l'écran ferme la fenêtre ; « Revenir à la liste » aussi */
    newDep('dep'); await new Promise(r=>setTimeout(r,50)); document.getElementById('dp_cNom').value='Mme Quitte'; curDep.cNom='Mme Quitte'; curDep.cType='Particulier'; loadDepForm();
    const a1=!!document.getElementById('nxPartPorte'); go('dash'); out.quitte=a1&&!document.getElementById('nxPartPorte');
    go('depform'); loadDepForm(); const a2=!!document.getElementById('nxPartPorte'); document.getElementById('nxpgRet').click(); out.retour=a2&&!document.getElementById('nxPartPorte')&&window._curView==='dep';
    ferme(); return out; });
  rec('Particuliers','Dépannage particulier : fenêtre bloquante « avant de commencer » à l\'ouverture (dès que le client est saisi)',!r.sansClient&&r.ouverte&&/AVANT|Avant de commencer/.test(r.txt)&&/art\. 4/.test(r.txt),j(r));
  rec('Particuliers','Report sans motif refusé ; avec motif : fenêtre fermée, motif tracé sur l\'intervention et dans le bandeau',r.sansMotif&&r.reporte&&r.bandeau&&r.pasRouvert,j(r));
  rec('Particuliers','Fenêtre aussi à l\'enregistrement ; contrat signé → plus de fenêtre',r.surEnregistrement&&r.signe&&r.signePasRouvert,j(r));
  rec('Particuliers','Client professionnel : pas de fenêtre',r.pro,j(r));
  rec('Particuliers','Quitter l\'écran ou « Revenir à la liste » ferme la fenêtre (aucun écran bloqué ailleurs)',r.quitte&&r.retour,j(r));
}

rec('Particuliers','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await ctx.close();

/* J9 mode réel (serveur simulé) : « à préciser » → aucun appel au serveur ; J+8 dans le payload figé */
{
  const {p,ctx,errs}=await page({mobile:false});
  await seed(p); await p.evaluate(PREP);
  await p.evaluate(`(function(){ const srv={docs:[],appels:[]}; window.__srv=srv;
    window.sb={rpc:(n,a)=>{ srv.appels.push(n);
      if(n==='cp_serveur_info') return Promise.resolve({data:{documents:true,version:'1.10'}});
      if(n==='cp_emettre_document'){ const ex=srv.docs.find(d=>d.request_id===a.p_request_id); const an=+String(a.p_date).slice(0,4);
        const d=ex||{id:'doc'+(srv.docs.length+1),request_id:a.p_request_id,serie:a.p_serie,annee:an,numero:srv.docs.length+1,num:a.p_serie+'-'+an+'-'+String(srv.docs.length+1).padStart(3,'0'),type:a.p_type,origine:'emis',date_doc:a.p_date,payload:JSON.parse(JSON.stringify(a.p_payload))};
        if(!ex) srv.docs.push(d); return Promise.resolve({data:{ok:true,deja:!!ex,doc:Object.assign({payload_hash:'h'},d)}}); }
      return Promise.resolve({data:{ok:true}}); },
      from:()=>{ const q={select(){return q;},order(){return q;},eq(){return q;},or(){return q;},in(){return q;},gte(){return q;},lte(){return q;},limit(){return q;},maybeSingle(){return Promise.resolve({data:null});},then(ok,ko){ return Promise.resolve({data:[]}).then(ok,ko); }}; return q; },
      auth:{getSession:()=>Promise.resolve({data:{session:null}})}};
    window.SESS={user:{id:'u1',email:'test@test'}}; localStorage.setItem('cp2_facturation',JSON.stringify({debut:todayISO(),decideLe:'test',anciens:{},renommes:{},v:1})); /* 1.10 : facturation réelle démarrée explicitement */ Object.assign(P.entreprise,{nom:'Entreprise Test',siret:'12345678900012',natureChantier:'S',assurance:'Assureur Test n° 0001',assuranceZone:'France métropolitaine' /* 1.10 : mentions exigées en mode réel (suite L) */}); })();`);
  const r=await p.evaluate(async c=>{ J.reset(); const a=J.devis(null); await facturerDevis(a.id,'solde'); eval(c); const appels0=__srv.appels.filter(x=>x==='cp_emettre_document').length;
    J.reset(); const b=J.devis({mode:'hors_etablissement',date:todayISO()}); await facturerDevis(b.id,'solde'); eval(c);
    const f=DEVIS.find(x=>x.id===b.id).facSolde, sd=__srv.docs[0];
    return {appels0,mode:nxEmisMode().mode,num:f&&f.num,srvExig:sd&&sd.payload&&sd.payload.fac&&sd.payload.fac.exigibleLe,modelEch:sd&&sd.payload&&sd.payload.model&&sd.payload.model.echeance,attendu:J.iso(8)}; },close);
  rec('Particuliers','Mode réel : « à préciser » → aucune demande de numéro au serveur',r.appels0===0,j(r));
  rec('Particuliers','Mode réel : date d\'exigibilité J+8 dans le document figé du serveur (facture et XML)',r.mode==='reel'&&/^F-\d{4}-001$/.test(r.num||'')&&r.srvExig===r.attendu&&r.modelEch===r.attendu,j(r));
  rec('Particuliers','Aucune erreur JavaScript (mode réel)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* J10 page de signature du client : accord « support durable » et téléchargement de l'exemplaire (fonction simulée) */
{
  const b=await getBrowser(); const ctx=await b.newContext({acceptDownloads:true,locale:'fr-FR'}); const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  const tok='11111111-2222-4333-8444-555555555555', appels=[]; let etat='en_attente';
  await p.route(/functions\/v1\/signature/, async r=>{ const body=JSON.parse(r.request().postData()||'{}'); appels.push(body);
    const doc={statut:etat,doc_type:'devis',doc_num:'D-2026-010',titre:'Climatisation',client_nom:'Mme Test',montant_ttc:1200,doc_html:'<p>Devis</p><div data-retractation="1">Rétractation</div>',doc_hash:'abc',
      signed_at:etat==='signe'?'2026-10-02T08:00:00Z':null,signer_nom:etat==='signe'?'Mme Test':null,signature_png:null,copie_le:null};
    let out=doc; if(body.action==='copie') out={ok:true,copie_le:'2026-10-02T09:00:00Z',doc_num:'D-2026-010',doc_html:'<p>Devis</p><div data-retractation="1">Rétractation</div>',doc_hash:'abc',signed_at:'2026-10-02T08:00:00Z',signer_nom:'Mme Test',consentement:'J\'ai lu le devis'};
    await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)}); });
  await p.goto('http://localhost:8765/signer.html#t='+tok); await p.waitForTimeout(600);
  const avant=await p.evaluate(()=>({sd:!!document.getElementById('sd'),anti:!!document.getElementById('anti')}));
  rec('Particuliers','Page de signature : case « exemplaire sur support durable » (facultative) et demande expresse',avant.sd&&avant.anti,j(avant));
  etat='signe'; await p.goto('http://localhost:8765/signer.html?x=1#t='+tok); await p.waitForTimeout(600);
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('#dl')]); await p.waitForTimeout(200);
  let contenu=''; if(dl){ const f=await dl.path(); contenu=fs.readFileSync(f,'utf8'); }
  const msg=await p.evaluate(()=>(document.getElementById('dlm')||{}).textContent||'');
  rec('Particuliers','Page de signature : téléchargement de l\'exemplaire (document + preuve) et remise enregistrée',!!dl&&/Exemplaire du client/.test(contenu)&&/Annexes incluses dans ce fichier : information sur le droit de rétractation/.test(contenu)&&/Mme Test/.test(contenu)&&appels.some(a=>a.action==='copie')&&/remise enregistrée/.test(msg),j({dl:!!dl,msg,actions:appels.map(a=>a.action)}));
  rec('Particuliers','Page de signature : aucune erreur JavaScript',errs.length===0,errs.join(' | '));
  await ctx.close();
}

await closeBrowser();
ecrireResultats('resJ.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
