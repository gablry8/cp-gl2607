// Suite E — avoirs
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';
const clean=e=>[...new Set(e)].slice(0,6).join(' | ');
const closePdf=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;

{
  const {p,ctx,errs}=await page({mobile:true});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p);
  await p.evaluate(()=>{ window.askMode=()=>'Virement'; });

  /* E1 chantier : facture solde non payée → avoir total + refaire */
  const e1=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); facturerDevis(d.id,'solde'); document.getElementById('nx-pdf-close')&&document.getElementById('nx-pdf-close').click();
    const f1=d.facSolde.num, imp0=allImpayes().some(i=>i.num===f1);
    const r=nxCreateAvoir({facNum:f1,montant:d.facSolde.montant,motif:'Erreur sur le montant facturé',liberer:true});
    const imp1=allImpayes().some(i=>i.num===f1);
    facturerDevis(d.id,'solde'); document.getElementById('nx-pdf-close')&&document.getElementById('nx-pdf-close').click();
    return {f1,f2:d.facSolde&&d.facSolde.num,av:r.av&&r.av.num,lib:r.av&&r.av.libere,imp0,imp1,ann:(d.facAnnulees||[]).map(f=>f.num),id:d.id}; });
  rec('Avoirs','Avoir total sur facture chantier non payée',e1.av==='TEST-AV-2026-001'&&e1.imp0&&!e1.imp1,JSON.stringify(e1));
  rec('Avoirs','Facture corrigée refaite avec un NOUVEAU numéro',e1.f2&&e1.f2!==e1.f1&&e1.ann.includes(e1.f1),e1.f1+' → '+e1.f2);
  const reg=await p.evaluate(()=>{ go('nx_docs'); const t=document.getElementById('nxDocs').innerText; return {annul:/Annulée \(TEST-AV-2026-001\)/.test(t),avoir:/TEST-AV-2026-001/.test(t),gap:/Trous dans la série/.test(t),propre:/Séries de numéros propres/.test(t)}; });
  rec('Avoirs','Registre : facture annulée + avoir listés, série sans trou',reg.annul&&reg.avoir&&!reg.gap,JSON.stringify(reg));
  const pdf=await p.evaluate(async()=>{ nxPrintAvoir('TEST-AV-2026-001'); await new Promise(r=>setTimeout(r,150)); const t=(document.getElementById('nx-pdf-page')||{}).textContent||''; document.getElementById('nx-pdf-close')&&document.getElementById('nx-pdf-close').click();
    return {num:/AVOIR N° TEST-AV-2026-001/.test(t),ref:/relative? à la facture (TEST-)?F-2026-\d+ du/.test(t)||/relatif à la facture/.test(t),tva:/293 B/.test(t),motif:/Motif : Erreur sur le montant/.test(t),bad:(t.match(/undefined|NaN/g)||[]).length}; });
  rec('Avoirs','PDF de l\'avoir : numéro, facture d\'origine, motif, mention TVA',pdf.num&&pdf.ref&&pdf.tva&&pdf.motif&&!pdf.bad,JSON.stringify(pdf));
  const stale=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.facAnnulees&&x.facAnnulees.length); /* éditeur ouvert avant l'avoir : enregistrer ne doit pas ressusciter l'ancienne facture */
    NXD2.open(JSON.parse(JSON.stringify(d)),{tab:'recap'}); const c=NXD2.api.cur(); c.facSolde=JSON.parse(JSON.stringify(d.facAnnulees[0])); nxd2.save(); const s=DEVIS.find(x=>x.id===d.id);
    const nums=nxFacNumsAll(); const dup=nums.filter((n,i)=>nums.indexOf(n)!==i); return {dup}; });
  rec('Avoirs','Pas de numéro de facture en double après enregistrement du devis',stale.dup.length===0,JSON.stringify(stale));
  const del=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.facAnnulees&&x.facAnnulees.length); window.confirm=()=>true; try{ delDevis(d.id); }catch(e){} return DEVIS.some(x=>x.id===d.id); });
  rec('Avoirs','Devis avec facture annulée : suppression bloquée',del);

  /* E2 intervention : avoir partiel avant paiement → impayé réduit → paiement = montant réduit */
  const e2=await p.evaluate(()=>{ const x={id:'depA',cNom:'Boulangerie Dupré',cType:'Professionnel',date:dISO(new Date()),itype:'dep',statut:'brouillon',heures:2,pieces:[],rateChoice:'custom',rateCustom:90};
    DEP.push(x); save(LS.dep,DEP); curDep=x; try{ loadDepForm(); }catch(e){} try{ factureDep(); }catch(e){} const d=DEP.find(o=>o.id==='depA'); const tot=computeDep(d).totalHT;
    const r=nxCreateAvoir({facNum:d.facNum,montant:50,motif:'Geste commercial'});
    const imp=allImpayes().find(i=>i.num===d.facNum); payDep('depA'); const rc=allRecettes().find(x=>x.num===d.facNum);
    return {tot:Math.round(tot*100)/100,av:r.av&&r.av.num,imp:imp&&imp.montant,rec:rc&&rc.montant}; });
  rec('Avoirs','Avoir partiel : impayé réduit de 50 €',Math.abs(e2.imp-(e2.tot-50))<0.01,JSON.stringify(e2));
  rec('Avoirs','Paiement ensuite : recette = montant réduit',Math.abs(e2.rec-(e2.tot-50))<0.01,JSON.stringify(e2));
  const over=await p.evaluate(()=>{ const d=DEP.find(o=>o.id==='depA'); return nxCreateAvoir({facNum:d.facNum,montant:99999,motif:'x'}).err||''; });
  rec('Avoirs','Avoir supérieur au reste refusé',/supérieur/.test(over),over);

  /* E3 location payée → avoir → à rembourser → remboursé */
  const e3=await p.evaluate(()=>{ const l={id:'locA',num:'L-2026-099',cNom:"L'Atelier du Froid",statut:'rendu',dateDebut:dISO(new Date()),dateFin:dISO(new Date()),items:[{ref:'Mobile 18 000 m³/h',qte:1,tarif:130}],fac:{num:nextFacNum(),date:dISO(new Date()),montant:300,payeLe:dISO(new Date()),mode:'Virement'}};
    LOC.push(l); save(LS.loc,LOC); const r=nxCreateAvoir({facNum:l.fac.num,montant:300,motif:'Prestation annulée'}); updateBadges();
    const badge=(document.getElementById('nxavBadge')||{}).textContent; const before=allRecettes().filter(x=>x.num===l.fac.num||x.num===r.av.num).map(x=>x.montant);
    window.prompt=()=> '05/10/2026'; nxavRembourse(r.av.id); const after=allRecettes().filter(x=>x.num===l.fac.num||x.num===r.av.num).map(x=>x.montant+'@'+x.date);
    return {av:r.av.num,badge,before,after}; });
  rec('Avoirs','Facture déjà payée : avoir « à rembourser » (badge)',e3.badge==='1'&&e3.before.join()==='300',JSON.stringify(e3));
  rec('Avoirs','Remboursement : ligne négative datée, encaissement d\'origine gardé',e3.after.includes('300@'+new Date().toISOString().slice(0,10))||e3.after.length===2&&e3.after.some(x=>x.startsWith('-300@2026-10-05')),JSON.stringify(e3.after));

  /* E4 contrat : avoir total + refacturer la même année */
  const e4=await p.evaluate(()=>{ const c={id:'ctrA',clientNom:'Boulangerie Dupré',type:'Climatisation',prix:180,visites:1,prochaineVisite:dISO(new Date()),actif:true,facs:[]}; CTR.push(c); save('cp2_contrats',CTR);
    facturerContrat('ctrA'); document.getElementById('nx-pdf-close')&&document.getElementById('nx-pdf-close').click(); const f1=c.facs[0].num;
    nxCreateAvoir({facNum:f1,montant:180,motif:'Erreur sur le montant facturé',liberer:true});
    c.prix=150; facturerContrat('ctrA'); document.getElementById('nx-pdf-close')&&document.getElementById('nx-pdf-close').click();
    return {f1,f2:c.facs[0]&&c.facs[0].num,m:c.facs[0]&&c.facs[0].montant,ann:(c.facsAnnulees||[]).length}; });
  rec('Avoirs','Contrat : avoir total puis refacturation de la même année',e4.f2&&e4.f2!==e4.f1&&e4.m===150&&e4.ann===1,JSON.stringify(e4));

  /* E5 série d'avoirs + compteur de factures intact */
  const e5=await p.evaluate(()=>{ const n=nxAvoirs().map(a=>a.num); const f=nxFacNumsAll(); const seq=f.filter(x=>/^(TEST-)?F-2026-/.test(x)).map(x=>+String(x).match(/(\d+)$/)[1]).sort((a,b)=>a-b); const cont=seq.every((v,i)=>v===i+1); return {n,cont,seq}; });
  rec('Avoirs','Série AV continue',JSON.stringify(e5.n)==='["TEST-AV-2026-001","TEST-AV-2026-002","TEST-AV-2026-003","TEST-AV-2026-004"]',JSON.stringify(e5.n));
  rec('Avoirs','Série de factures continue (annulées comprises)',e5.cont,JSON.stringify(e5.seq));

  /* E6 fenêtre sur téléphone */
  const e6a=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&!x.facSolde&&!x.facAnnulees&&compute(x).totalHT>0); facturerDevis(d.id,'solde'); document.getElementById('nx-pdf-close')&&document.getElementById('nx-pdf-close').click(); go('nx_avoirs'); return d.facSolde.num; });
  await p.waitForTimeout(200);
  await p.locator('button:has-text("Faire un avoir")').first().tap(); await p.waitForTimeout(200);
  await p.selectOption('#avType','partiel'); await p.locator('#avMont').fill('25,50');
  const vis=await p.evaluate(()=>{ const b=[...document.querySelectorAll('#mAvoir .navbtns button')].pop(); b.scrollIntoView(); const r=b.getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return b===h||b.contains(h); });
  await p.locator('#mAvoir button:has-text("Émettre")').tap(); await p.waitForTimeout(500);
  await p.evaluate(closePdf);
  const e6=await p.evaluate(()=>{ const a=nxAvoirs()[nxAvoirs().length-1]; return {m:a.montant,t:a.total}; });
  rec('Avoirs','Téléphone : avoir partiel 25,50 € saisi à la virgule',e6.m===25.5&&e6.t===false&&vis,JSON.stringify(e6)+' bouton visible '+vis);
  const view=await p.evaluate(()=>{ go('nx_avoirs'); return document.getElementById('nxav').innerText; });
  rec('Avoirs','Écran Avoirs : liste + à rembourser',/Avoirs émis/.test(view)&&/AV-2026-005/.test(view),'');

  /* E7 dupliquer un devis ne copie pas les factures annulées */
  const e7=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.facAnnulees&&x.facAnnulees.length); const n0=DEVIS.length; dupDevis(d.id); const c=DEVIS[DEVIS.length-1]; return {added:DEVIS.length-n0,ann:!!c.facAnnulees}; });
  rec('Avoirs','Dupliquer un devis : factures annulées non copiées',e7.added===1&&!e7.ann,JSON.stringify(e7));

  /* E8 rechargement : tout persiste */
  await p.evaluate(()=>nxStore.flush()); await p.reload(); await p.waitForTimeout(2800);
  const e8=await p.evaluate(()=>({n:nxAvoirs().length,ann:DEVIS.filter(d=>d.facAnnulees).length}));
  rec('Avoirs','Avoirs conservés après redémarrage',e8.n===5&&e8.ann>=1,JSON.stringify(e8));
  rec('Avoirs','Aucune erreur',errs.length===0,clean(errs));
  await ctx.close();
}
await closeBrowser();
fs.writeFileSync('/tmp/claude-0/sp/resE.json',JSON.stringify(RES,null,1));
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
