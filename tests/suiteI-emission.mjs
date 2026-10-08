import { ecrireResultats } from './env.mjs';
// Suite I — émission sécurisée (1.10) : modes, serveur simulé, reprise, fusion, rapprochement, onglets.
// Le serveur simulé reprend la logique de la migration SQL (testée, elle, sur un vrai PostgreSQL :
// tests/sql/test_migration.py). Cette suite vérifie le comportement de l'APPLI face à ce serveur.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import { SERVEUR } from './serveur-simule.mjs';
import fs from 'fs';

const REEL=`(function(){ window.SESS={user:{id:'u1',email:'test@test'}}; localStorage.setItem('cp2_facturation',JSON.stringify({debut:todayISO(),decideLe:'test',anciens:{},renommes:{},v:1})); /* 1.10 : facturation réelle démarrée explicitement */ Object.assign(P.entreprise,{nom:'Gabriel Leroy',siret:'12345678900012',adresse:"1 rue de l'Exemple",cp:'60000',ville:'Beauvais',natureChantier:'S',assurance:'Assureur Test n° 0001',assuranceZone:'France métropolitaine' /* 1.10 : mentions exigées en mode réel (suite L) */}); })();`;
const wait=(p,ms)=>p.waitForTimeout(ms);
const close=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;

/* I1 démonstration : série TEST, filigrane, version figée réimprimée à l'identique */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p);
  const r=await p.evaluate(async c=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); facturerDevis(d.id,'solde'); eval(c);
    const num=d.facSolde.num, e=nxEmisEntree(num), f=JSON.parse(localStorage.getItem('cpnext_docs_fichiers')||'{}')[num];
    const nomAvant=P.entreprise.nom; P.entreprise.nom='NOM MODIFIÉ APRÈS COUP';
    printFactureDevis(d,'solde'); await new Promise(r=>setTimeout(r,150)); const t=(document.getElementById('nx-pdf-page')||{}).textContent||''; eval(c);
    P.entreprise.nom=nomAvant;
    return {num,mode:e&&e.mode,fil:/DOCUMENT DE TEST/.test(f&&f.html||''),xml:/<rsm:CrossIndustryInvoice/.test(f&&f.xml||''),reimpFig:!/NOM MODIFIÉ APRÈS COUP/.test(t)&&/DOCUMENT DE TEST/.test(t),modeAff:nxEmisMode().mode}; },close);
  rec('Émission','Démonstration (pas de cloud) : numéro de la série TEST',/^TEST-F-\d{4}-001$/.test(r.num)&&r.mode==='demo'&&r.modeAff==='demo',JSON.stringify(r));
  rec('Émission','Démonstration : PDF marqué « DOCUMENT DE TEST », XML figé',r.fil&&r.xml,JSON.stringify(r));
  rec('Émission','Réimpression = version figée (un changement de paramètres ne modifie pas la facture)',r.reimpFig,JSON.stringify(r));
  rec('Émission','Aucune erreur JavaScript (démonstration)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* I2 mode réel avec serveur simulé : numéro du serveur, fichiers déposés, paiement en évènement */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); const dlg=[]; p.on('dialog',d=>{ dlg.push(d.message()); d.accept().catch(()=>{}); });
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r=await p.evaluate(async c=>{ window.askMode=()=>'Virement'; const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0);
    await facturerDevis(d.id,'solde'); eval(c); await new Promise(r=>setTimeout(r,100));
    const num=d.facSolde&&d.facSolde.num, e=nxEmisEntree(num), sd=__srv.docs[0];
    payerFacture('devis',d.id,'solde'); await new Promise(r=>setTimeout(r,100));
    let thrown=''; try{ nextFacNum(); }catch(err){ thrown=err.message; }
    return {num,mode:nxEmisMode().mode,e:e&&{mode:e.mode,sid:e.sid},srvNum:sd&&sd.num,html:!!(sd&&sd.html&&/Gabriel Leroy/.test(sd.html)),xml:!!(sd&&sd.xml&&/CrossIndustryInvoice/.test(sd.xml)),payloadFac:sd&&sd.payload&&sd.payload.fac&&sd.payload.fac.montant,events:__srv.events.map(x=>x.type),thrown}; },close);
  rec('Émission','Mode réel : numéro attribué par le serveur (F-AAAA-001), enregistré avec la facture',!!(r.mode==='reel'&&/^F-\d{4}-001$/.test(r.num||'')&&r.srvNum===r.num&&r.e&&r.e.mode==='reel'&&r.e.sid),JSON.stringify(r));
  rec('Émission','Mode réel : PDF (HTML) et XML de la même version déposés sur le serveur',r.html&&r.xml&&r.payloadFac>0,JSON.stringify(r));
  rec('Émission','Paiement : évènement à part, la facture figée n\'est pas réécrite',r.events.includes('paiement'),JSON.stringify(r.events));
  rec('Émission','Ancien compteur local inutilisable en mode réel',/réservé au serveur/.test(r.thrown),r.thrown);
  rec('Émission','Aucune erreur JavaScript (mode réel)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* I3 serveur sans migration / hors ligne : la facture reste à faire (aucun numéro local) */
{
  const {p,ctx}=await page({mobile:false});
  p.removeAllListeners('dialog'); const dlg=[]; p.on('dialog',d=>{ dlg.push(d.message()); d.accept().catch(()=>{}); });
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r=await p.evaluate(async c=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0);
    __srv.fail.migration=true; await facturerDevis(d.id,'solde'); eval(c); const a=!!d.facSolde;
    __srv.fail.migration=false; __srv.fail.horsService=true; await facturerDevis(d.id,'solde'); eval(c); const b=!!d.facSolde;
    return {a,b,docs:__srv.docs.length,mode:nxEmisMode()}; },close);
  rec('Émission','Migration absente : facture NON émise (le chantier reste à facturer)',!r.a&&r.docs===0&&dlg.some(m=>/NON émise/.test(m)&&/migration/.test(m)),JSON.stringify(r)+' '+dlg.join(' / ').slice(0,200));
  rec('Émission','Serveur injoignable : facture NON émise, aucun numéro local',!r.b&&r.docs===0,JSON.stringify(r));
  await ctx.close();
}

/* I3b devis OUVERT à l'écran, serveur injoignable : rien de PROVISOIRE ne reste sur l'écran ni n'est enregistré ;
   puis devis modifié à l'écran et facturé : modification gardée ET facture émise (essai du 08/10 sur la copie d'essai) */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); const dlg=[]; p.on('dialog',d=>{ dlg.push(d.message()); d.accept().catch(()=>{}); });
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r=await p.evaluate(async c=>{ const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0); const d=acc[0];
    NXD2.open(JSON.parse(JSON.stringify(d)),{tab:'recap'}); await new Promise(r=>setTimeout(r,80));
    __srv.fail.horsService=true; await facturerDevis(d.id,'solde'); eval(c);
    const cu=NXD2.api.cur(); const ecran=cu&&cu.facSolde?cu.facSolde.num:null;
    const bloc=(document.body.textContent||'').includes('PROVISOIRE');
    nxd2.save(); const stocke=(DEVIS.find(x=>x.id===d.id)||{}).facSolde||null;
    const ls=(localStorage.getItem('cp2_devis')||'').includes('PROVISOIRE');
    __srv.fail.horsService=false; await facturerDevis(d.id,'solde'); eval(c);
    const apres=(DEVIS.find(x=>x.id===d.id)||{}).facSolde, cu2=NXD2.api.cur();
    /* devis modifié à l'écran puis facturé directement */
    const d2=acc[1]; NXD2.open(JSON.parse(JSON.stringify(d2)),{tab:'recap'}); await new Promise(r=>setTimeout(r,80));
    const cu3=NXD2.api.cur(); cu3.cNom=(cu3.cNom||'')+' MODIF'; NXD2.api.markDirty();
    await facturerDevis(d2.id,'solde'); eval(c);
    const s2=DEVIS.find(x=>x.id===d2.id)||{};
    return {ecran,bloc,stocke:stocke&&stocke.num,ls,apres:apres&&apres.num,ecranApres:cu2&&cu2.facSolde&&cu2.facSolde.num,docs:__srv.docs.map(x=>x.num),
      modif:/ MODIF$/.test(s2.cNom||''),fac2:s2.facSolde&&s2.facSolde.num}; },close);
  rec('Émission','Devis ouvert + serveur injoignable : aucun numéro PROVISOIRE à l\'écran',!r.ecran&&!r.bloc,JSON.stringify(r));
  rec('Émission','Devis ouvert + serveur injoignable : « Enregistrer » n\'enregistre aucune fausse facture',!r.stocke&&!r.ls,JSON.stringify(r));
  rec('Émission','Réseau revenu : la facture est émise normalement (F-AAAA-001), écran à jour',/^F-\d{4}-001$/.test(r.apres||'')&&r.ecranApres===r.apres&&r.docs[0]===r.apres,JSON.stringify(r));
  rec('Émission','Devis modifié à l\'écran puis facturé : modification enregistrée ET facture émise',r.modif&&/^F-\d{4}-002$/.test(r.fac2||''),JSON.stringify(r));
  rec('Émission','Aucune erreur JavaScript (devis ouvert)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* I3c devis non accepté : confirmation demandée ; refus = rien d'émis ; accord = facture émise */
{
  const {p,ctx,errs}=await page({mobile:false});
  let repondre=false; const dlg=[]; p.removeAllListeners('dialog'); p.on('dialog',d=>{ dlg.push(d.message()); (d.type()==='confirm'&&!repondre?d.dismiss():d.accept()).catch(()=>{}); });
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r1=await p.evaluate(async c=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); d.statut='brouillon'; window.__dId=d.id;
    await facturerDevis(d.id,'solde'); eval(c); return {fac:d.facSolde&&d.facSolde.num,docs:__srv.docs.length}; },close);
  repondre=true;
  const r2=await p.evaluate(async c=>{ const d=DEVIS.find(x=>x.id===__dId); await facturerDevis(d.id,'solde'); eval(c); return {fac:d.facSolde&&d.facSolde.num,docs:__srv.docs.length}; },close);
  const r3=await p.evaluate(async c=>{ const d=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0&&!x.facSolde)[0]; const n0=window.__nbConf=0; await facturerDevis(d.id,'solde'); eval(c); return {fac:d.facSolde&&d.facSolde.num}; },close);
  const conf=dlg.filter(m=>/pas accepté/.test(m));
  rec('Émission','Devis brouillon : confirmation demandée, « Annuler » = rien d\'émis',!r1.fac&&r1.docs===0&&conf.length>=1&&/brouillon/.test(conf[0]),JSON.stringify(r1)+' '+conf.join(' / ').slice(0,160));
  rec('Émission','Devis brouillon confirmé : facture émise',/^F-\d{4}-001$/.test(r2.fac||'')&&r2.docs===1,JSON.stringify(r2));
  rec('Émission','Devis accepté : aucune question supplémentaire',/^F-\d{4}-002$/.test(r3.fac||'')&&conf.length===2,JSON.stringify(r3)+' conf='+conf.length);
  rec('Émission','Aucune erreur JavaScript (devis non accepté)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* I4 réponse perdue puis nouvelle tentative : même facture ; double clic : une seule */
{
  const {p,ctx}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r=await p.evaluate(async c=>{ const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0); const d=acc[0];
    __srv.fail.perdreReponse=true; await facturerDevis(d.id,'solde'); eval(c); const apresPerte=!!d.facSolde, att=Object.keys(nxEmisAttentes()).length;
    await facturerDevis(d.id,'solde'); eval(c);
    const d2=acc[1]; const p1=facturerDevis(d2.id,'solde'), p2=facturerDevis(d2.id,'solde'); await Promise.all([p1,p2]); eval(c);
    return {apresPerte,att,num:d.facSolde&&d.facSolde.num,docs:__srv.docs.map(x=>x.num),attFin:Object.keys(nxEmisAttentes()).length,num2:d2.facSolde&&d2.facSolde.num}; },close);
  rec('Émission','Réponse perdue : rien d\'appliqué, demande gardée en attente',!r.apresPerte&&r.att===1,JSON.stringify(r));
  rec('Émission','Nouvelle tentative : MÊME facture retrouvée, pas de doublon sur le serveur',r.num===r.docs[0]&&r.docs.filter(n=>n===r.num).length===1&&r.attFin===0,JSON.stringify(r));
  rec('Émission','Double clic : une seule facture',r.docs.length===2&&r.num2===r.docs[1],JSON.stringify(r));
  await ctx.close();
}

/* I5 avoir en mode réel ; rapprochement : facture disparue localement remise en place ; doublons signalés */
{
  const {p,ctx}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r=await p.evaluate(async c=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0);
    await facturerDevis(d.id,'solde'); eval(c); const num=d.facSolde.num;
    const av=await nxAvoirEmit({facNum:num,montant:10,motif:'Geste'}); eval(c);
    /* la facture disparaît de l'appareil (fusion ou restauration d'une vieille sauvegarde) */
    delete d.facSolde; save(LS.devis,DEVIS);
    const rp=await nxEmisRapprocher();
    /* anciennes factures arrivées APRÈS le démarrage (autre appareil) : deux F-…-050 différentes, jamais choisies */
    const y=new Date().getFullYear(); DEP.push({id:'dx1',cNom:'A',date:todayISO(),statut:'facturee',facNum:'F-'+y+'-050',facDate:todayISO(),itype:'dep',heures:1,pieces:[]},{id:'dx2',cNom:'B',date:todayISO(),statut:'facturee',facNum:'F-'+y+'-050',facDate:todayISO(),itype:'dep',heures:1,pieces:[]}); save(LS.dep,DEP);
    const rp2=await nxEmisRapprocher();
    return {num,av:av&&av.av&&av.av.num,restaure:d.facSolde&&d.facSolde.num,rp,rp2,dbl:Object.keys(nxEmisDoublons()),recon:__srv.docs.filter(x=>x.origine==='reconstitue').map(x=>x.num),
      essais:DEP.filter(x=>/^dx/.test(x.id)).map(x=>x.facNum)}; },close);
  rec('Émission','Avoir en mode réel : numéro AV- du serveur',/^AV-\d{4}-001$/.test(r.av||''),JSON.stringify(r));
  rec('Émission','Rapprochement : facture disparue de l\'appareil remise en place depuis le serveur',r.restaure===r.num&&r.rp.restaures.includes(r.num),JSON.stringify(r.rp));
  rec('Émission','Anciennes factures non choisies : jamais importées, classées en essais (ESSAI-…) ; aucun faux doublon (avoir réel compris)',r.recon.length===0&&r.rp2.essais>=1&&r.essais.length===2&&r.essais.every(n=>/^ESSAI-F-\d{4}-050$/.test(n))&&!r.dbl.length,JSON.stringify({recon:r.recon,essais:r.essais,dbl:r.dbl,rp2:r.rp2}));
  await ctx.close();
}

/* I6 fusion PC / téléphone avec le vrai code (cpMerge enveloppé) ; restauration d'une vieille sauvegarde */
{
  const {p,ctx}=await page({mobile:false});
  const r=await p.evaluate(()=>{ const t=todayISO();
    const base={cp2_devis:[{id:'D',num:'DV1',statut:'accepte',notes:''}],cp2_facseq:{year:2026,seq:5},cp2_avoirs:[],cp2_docs:[]};
    const cloud={cp2_devis:[{id:'D',num:'DV1',statut:'accepte',notes:'',facSolde:{num:'F-2026-006',date:t,montant:1000}}],cp2_facseq:{year:2026,seq:6},cp2_avoirs:[{id:'av1',num:'AV-2026-001'}],cp2_docs:[{id:'F-2026-006|devis|D|solde',num:'F-2026-006'}]};
    const tel={cp2_devis:[{id:'D',num:'DV1',statut:'accepte',notes:'rappeler le client'}],cp2_facseq:{year:2026,seq:5},cp2_avoirs:[],cp2_docs:[]};
    const m=cpMerge(base,tel,cloud);
    /* vieille sauvegarde restaurée (sans la facture), base = dernier état synchronisé qui l'avait */
    const m2=cpMerge(cloud,{cp2_devis:[{id:'D',num:'DV1',statut:'accepte',notes:'ancienne'}]},cloud);
    return {fac:m.cp2_devis[0].facSolde&&m.cp2_devis[0].facSolde.num,notes:m.cp2_devis[0].notes,seq:m.cp2_facseq.seq,reg:m.cp2_docs.length,fac2:m2.cp2_devis[0].facSolde&&m2.cp2_devis[0].facSolde.num}; });
  rec('Synchro','Conflit PC / téléphone : la facture émise sur le PC est conservée (et la note du téléphone aussi)',r.fac==='F-2026-006'&&r.notes==='rappeler le client',JSON.stringify(r));
  rec('Synchro','Compteurs : le plus grand l\'emporte ; registre fusionné sans perte',r.seq===6&&r.reg===1,JSON.stringify(r));
  rec('Synchro','Restauration d\'une ancienne sauvegarde puis synchro : la facture n\'est pas perdue',r.fac2==='F-2026-006',JSON.stringify(r));
  await ctx.close();
}

/* I7 synchro : la version de l'appli est envoyée ; ancien serveur (avant migration) toujours accepté */
{
  const {p,ctx}=await page({mobile:false});
  await p.evaluate(SERVEUR);
  const r=await p.evaluate(async()=>{ const a=await cpStatePushRpc({x:1},null,false); const v=__srv.dernierPush&&__srv.dernierPush.p_client_version;
    __srv.fail.ancienServeur=true; __srv.dernierPush=null; const b=await cpStatePushRpc({x:2},null,false); return {a:a.data&&a.data.ok,v,b:b.data&&b.data.ok,sansVersion:__srv.dernierPush&&!('p_client_version' in __srv.dernierPush)}; });
  rec('Synchro','Envoi de la version (1.10) ; serveur pas encore migré : repli sur l\'ancien appel',r.a&&r.v==='1.10.0'&&r.b&&r.sansVersion,JSON.stringify(r));
  await ctx.close();
}

/* I8 deux onglets ; ancienne version qui écrit en même temps */
{
  const {p,ctx}=await page({mobile:false});
  const p2=await ctx.newPage(); await p2.route(/supabase|cdnjs|tesseract|unpkg|cdn\.jsdelivr/,r=>r.abort());
  await p2.goto('http://localhost:8765/index.html'); await p2.waitForTimeout(2200);
  const a=await p.evaluate(()=>({ro:nxStore.info().lectureSeule,voile:!!document.getElementById('nxRoVoile')}));
  const b=await p2.evaluate(()=>{ const avant=__native.get.call(localStorage,'cp2_clients'); try{ CLIENTS.push({id:'zz',nom:'Écrit dans le 2e onglet'}); save(LS.clients,CLIENTS); }catch(e){} return {ro:nxStore.info().lectureSeule,voile:!!document.getElementById('nxRoVoile'),persiste:__native.get.call(localStorage,'cp2_clients')!==avant}; });
  rec('Onglets','Deuxième onglet : lecture seule (voile), rien n\'est enregistré',!a.ro&&!a.voile&&b.ro&&b.voile&&!b.persiste,JSON.stringify({a,b}));
  /* « Utiliser cet onglet » : le premier passe en lecture seule */
  await p2.evaluate(()=>{ document.getElementById('nxRoPrendre').click(); }); await p.waitForTimeout(300);
  const c=await p.evaluate(()=>({ro:nxStore.info().lectureSeule,voile:!!document.getElementById('nxRoVoile')}));
  rec('Onglets','« Utiliser cet onglet » : l\'autre passe en lecture seule',c.ro&&c.voile,JSON.stringify(c));
  await ctx.close();
  /* ancienne version (sans ce mécanisme) qui écrit dans le stockage : l'onglet actif se met en lecture seule */
  const q=await page({mobile:false}); const q2=await q.ctx.newPage(); await q2.route(/.*/,r=>r.fulfill({status:200,contentType:'text/html',body:'<html><body>ancienne</body></html>'}));
  await q2.goto('http://localhost:8765/vieux.html');
  await q2.evaluate(()=>localStorage.setItem('cp2_devis','[]')); await q.p.waitForTimeout(300);
  const d=await q.p.evaluate(()=>({ro:nxStore.info().lectureSeule,voile:!!document.getElementById('nxRoVoile'),txt:(document.getElementById('nxRoVoile')||{}).innerText||''}));
  rec('Onglets','Écriture par une autre version : l\'onglet passe en lecture seule',d.ro&&d.voile&&/autre version/.test(d.txt),JSON.stringify(d).slice(0,200));
  await q.ctx.close();
}

await closeBrowser();
ecrireResultats('resI.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
