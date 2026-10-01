import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';

/* C1. Sauvegarde complète puis restauration sur un appareil vide */
{
  const {p,ctx,errs}=await page({mobile:false});
  await seed(p);
  await p.evaluate(()=>{ EQUIP.push({id:'eq1',client:'Boulangerie Dupré',type:'Monosplit',marque:'Daikin',modele:'FTXM25',fluide:'R32',charge:0.9}); save('cp2_equip',EQUIP);
    CTR.push({id:'ct1',clientNom:'Boulangerie Dupré',type:'Climatisation',prix:180,visites:1,prochaineVisite:dISO(new Date()),actif:true,facs:[]}); save('cp2_contrats',CTR);
    FLU.push({id:'fl1',num:'FF-2026-001',date:dISO(new Date()),client:'Boulangerie Dupré',desc:'Split',fluide:'R32',charge:0.9,qv:0.2}); save('cp2_fluides',FLU);
    localStorage.setItem('cpnext_refs',JSON.stringify({ftxm25:{ref:'FTXM25',fluide:'R32',charge:0.9}})); });
  const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>exportJSON())]);
  const path='/tmp/claude-0/sp/bk.json'; await dl.saveAs(path);
  const bk=JSON.parse(fs.readFileSync(path,'utf8'));
  const has=k=>bk.all&&bk.all[k]!=null;
  rec('Sauvegarde','Contient parc, contrats, fiches fluides, références',has('cp2_equip')&&has('cp2_contrats')&&has('cp2_fluides')&&has('cpnext_refs'),Object.keys(bk.all||{}).join(','));
  rec('Sauvegarde','N\'embarque pas le code PIN',!has('cp2_pin'));
  await ctx.close();
  const q=await page({mobile:false});
  q.p.on('dialog',d=>d.accept().catch(()=>{}));
  await q.p.evaluate(()=>{ window.confirm=()=>true; });
  const inp=await q.p.evaluateHandle(()=>{ const i=document.createElement('input'); i.type='file'; i.id='tstImp'; i.onchange=function(){ importJSON(this); }; document.body.appendChild(i); return i; });
  await q.p.setInputFiles('#tstImp',path); await q.p.waitForTimeout(2500);
  const r=await q.p.evaluate(()=>({d:DEVIS.length,e:EQUIP.length,c:CTR.length,f:FLU.length,refs:!!JSON.parse(localStorage.getItem('cpnext_refs')||'{}').ftxm25}));
  rec('Sauvegarde','Restauration complète sur appareil vide',r.d>=12&&r.e===1&&r.c===1&&r.f===1&&r.refs,JSON.stringify(r));
  const r2=await q.p.evaluate(()=>!!localStorage.getItem('cpnext_avant_import'));
  rec('Sauvegarde','Copie de l\'état d\'avant gardée',r2);
  await q.ctx.close();
}

/* C2. Brouillon : fermer l'app au milieu d'un devis */
{
  const {p,ctx}=await page({mobile:true});
  await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; NXD2.open(d,{tab:'client'}); });
  await p.locator('[data-k="$.cNom"]').fill('Brouillon Test'); await p.locator('[data-k="$.cNom"]').blur(); await p.waitForTimeout(2500);
  const dr=await p.evaluate(()=>{ try{ return localStorage.getItem('cpnext_d2_draft')||''; }catch(e){ return ''; } });
  rec('Brouillon','Saisie non enregistrée gardée en brouillon',/Brouillon Test/.test(dr),dr?dr.length+' car.':'rien');
  await p.reload(); await p.waitForTimeout(2500);
  const txt=await p.evaluate(()=>document.body.innerText.match(/brouillon[^\n]{0,80}/i)?.[0]||'');
  rec('Brouillon','Au redémarrage, proposition de reprendre',/reprendre|récupér|brouillon/i.test(txt),txt);
  await ctx.close();
}

/* C3. Quitter un devis modifié sans enregistrer */
{
  const {p,ctx}=await page({mobile:true});
  let asked=''; p.removeAllListeners('dialog'); p.on('dialog',d=>{ asked=d.message(); d.dismiss().catch(()=>{}); });
  await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; NXD2.open(d,{tab:'client'}); });
  await p.locator('[data-k="$.cNom"]').fill('Oubli'); await p.locator('[data-k="$.cNom"]').blur();
  await p.evaluate(()=>{ try{ nxd2.close(); }catch(e){} }); await p.waitForTimeout(300);
  rec('Brouillon','Fermer un devis modifié → proposition d\'enregistrer',/non enregistrées/.test(asked),asked||'aucun');
  await ctx.close();
}

/* C4. Factures protégées */
{
  const {p,ctx}=await page({mobile:true});
  await seed(p);
  const r=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); facturerDevis(d.id,'solde'); const c=document.getElementById('nx-pdf-close'); if(c) c.click();
    window.confirm=()=>true; const n0=DEVIS.length; try{ delDevis(d.id); }catch(e){} const still=DEVIS.some(x=>x.id===d.id);
    /* compteur en retard (autre appareil) */
    const max=d.facSolde.num; save(LS.facseq,{year:new Date().getFullYear(),seq:0}); const nx=nextFacNum();
    return {still,max,nx}; });
  rec('Factures','Devis facturé impossible à supprimer',r.still);
  rec('Factures','Compteur en retard : jamais de numéro déjà utilisé',r.nx>r.max,r.max+' puis '+r.nx);
  await ctx.close();
}

/* C5. Fiche fluide guidée : cas limites */
{
  const {p,ctx}=await page({mobile:true});
  const r=await p.evaluate(async()=>{ const vis=id=>{const e=document.getElementById(id); const l=e&&e.closest('label'); return !!l&&getComputedStyle(l).display!=='none';}; const o={};
    go('fluides'); openFlu(); await new Promise(r=>setTimeout(r,200));
    document.getElementById('fl_nature').value='mes'; document.getElementById('fl_nature').dispatchEvent(new Event('change',{bubbles:true}));
    nxfgGo(2); await new Promise(r=>setTimeout(r,50)); o.mesRecup=vis('nxfg_qr');
    document.getElementById('fl_nature').value='demantelement'; document.getElementById('fl_nature').dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,50));
    o.demCharge=vis('nxfg_qc'); o.demRecup=vis('nxfg_qr');
    const f=document.getElementById('fl_fluide'); f.value='R290'; f.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,50)); o.r290prp=vis('fl_prg');
    nxfgGo(0); o.info=/n'est pas un gaz fluoré/.test(document.getElementById('nxfgBar').textContent);
    /* enregistrer sans client → bloqué, reste sur la fiche */
    nxfgGo(3); const n0=FLU.length; saveFlu(false); o.blocked=FLU.length===n0&&document.getElementById('mFlu').classList.contains('on');
    nxfgToggle(); o.fullAll=vis('fl_bsff')&&vis('fl_qv'); nxfgToggle();
    return o; });
  rec('Fiche fluide','Mise en service : pas de question « récupéré »',!r.mesRecup);
  rec('Fiche fluide','Démantèlement : pas de « chargé », « récupéré » visible',!r.demCharge&&r.demRecup);
  rec('Fiche fluide','R290 : PRP masqué + info « pas un gaz fluoré »',!r.r290prp&&r.info,JSON.stringify(r));
  rec('Fiche fluide','Sans client : enregistrement bloqué',r.blocked);
  rec('Fiche fluide','« Tout afficher » montre toutes les cases',r.fullAll);
  await ctx.close();
}

/* C6. Un devis au format inconnu (module absent) ne bloque rien */
{
  const {p,ctx,errs}=await page({mobile:true});
  const r=await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[{id:'l1',module:'futur',data:{},visite:{}}]; d.cNom='Futur'; d.num='DV-FUTUR'; DEVIS.push(d); save(LS.devis,DEVIS);
    let out=[]; try{ const c=compute(d); out.push('total '+c.totalHT); }catch(e){ out.push('ERR '+e.message); } try{ go('tous'); go('dash'); NXD2.open(d,{tab:'lots'}); printDevis(); }catch(e){ out.push('ERR '+e.message); } return out.join(' | '); });
  rec('Données abîmées','Devis d\'une version plus récente : lisible, avertit',!/ERR/.test(r)&&errs.length===0,r+' '+errs.join('/'));
  await ctx.close();
}


/* C7. Historique local : ne remplit jamais la mémoire */
{
  const {p,ctx}=await page({mobile:true,init:()=>{ if(!sessionStorage.getItem('__h')){ sessionStorage.setItem('__h','1'); const big=[]; for(let i=0;i<1200;i++) big.push({id:'b'+i,v:1,cNom:'Client '+i,notes:'x'.repeat(1400),statut:'brouillon',num:'DV-'+i}); localStorage.setItem('cp2_devis',JSON.stringify(big)); } }});
  await p.reload(); await p.waitForTimeout(3500);
  const r=await p.evaluate(()=>{ const h=(localStorage.getItem('cpnext_history')||'').length; let t=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); t+=k.length+(localStorage.getItem(k)||'').length; } return {histM:+(h/1e6).toFixed(2),totalM:+(t/1e6).toFixed(2)}; });
  const big=await p.evaluate(()=>window.nxStore&&nxStore.mode==='idb');
  rec('Stockage plein','Historique plafonné ('+(big?'grande mémoire : ≤ 6 M':'≤ 1,2 M')+')',big?r.histM<=6:r.histM<=1.2&&r.totalM<4.8,JSON.stringify(r));
  const s=await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; d.cNom='Après historique'; NXD2.open(d,{tab:'client'}); const n0=DEVIS.length; nxd2.save(); return DEVIS.length-n0; });
  rec('Stockage plein','On peut encore enregistrer un devis ensuite',s===1,String(s));
  await ctx.close();
}
await closeBrowser();
fs.writeFileSync('/tmp/claude-0/sp/resC.json',JSON.stringify(RES,null,1));
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
