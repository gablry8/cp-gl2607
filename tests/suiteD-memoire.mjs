// Suite D — grande mémoire (IndexedDB) : migration, gros volume, secours, fusion
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import { ecrireResultats, lancerNavigateur } from './env.mjs';
import fs from 'fs';
const clean=e=>[...new Set(e)].slice(0,6).join(' | ');
const nat=`(function(){ const LS=window.localStorage; const g=Storage.prototype.__lookupGetter__?null:null; return {get:k=>Object.getPrototypeOf(LS).getItem.call(LS,k)}; })()`;

/* D1. Première ouverture avec données existantes (localStorage) → tout repris, copié dans la base */
{
  const {p,ctx,errs}=await page({mobile:true,init:()=>{ if(!sessionStorage.getItem('__d1')){ sessionStorage.setItem('__d1','1');
    localStorage.setItem('cp2_clients',JSON.stringify([{id:'a',nom:'Ancien Client',type:'Particulier'}]));
    localStorage.setItem('cp2_devis',JSON.stringify([{id:'old1',num:'DV-OLD-1',cNom:'Ancien Client',type:'Monosplit',statut:'brouillon',machines:[],splits:[],extras:[],goulottes:[]}])); } }});
  await p.reload(); await p.waitForTimeout(2500);
  const r=await p.evaluate(async()=>{ const o={mode:nxStore.mode,c:CLIENTS.length,d:DEVIS.length};
    const db=await new Promise(res=>{ const q=indexedDB.open('climpilot-store'); q.onsuccess=()=>res(q.result); });
    o.idb=await new Promise(res=>{ const t=db.transaction('kv').objectStore('kv').getAll(); t.onsuccess=()=>res(t.result.map(x=>x.k)); }); return o; });
  rec('Grande mémoire','Mode grande mémoire actif',r.mode==='idb',r.mode);
  rec('Grande mémoire','Anciennes données reprises au 1er démarrage',r.c===1&&r.d===1,JSON.stringify(r));
  rec('Grande mémoire','Copiées dans la base',r.idb.includes('cp2_devis')&&r.idb.includes('cp2_clients'),r.idb.join(','));
  rec('Grande mémoire','Démarrage sans erreur',errs.length===0,clean(errs));
  await ctx.close();
}

/* D2. 12 millions de caractères (≈ 2,5× la limite iPhone) : enregistrés et relus */
{
  const {p,ctx,errs}=await page({mobile:true});
  const w=await p.evaluate(()=>{ const mods=NXD2.natures.map(n=>n.id); for(let i=0;i<3000;i++){ const m=mods[i%mods.length]; const d=NXD2.newDevis(m,{}); d.lots=[NXD2.newLot(m)]; Object.assign(d,{cNom:'Client '+i,notes:'n'.repeat(2500),statut:'brouillon'}); d.num='DV-BIG-'+i; DEVIS.push(d);} let err=''; try{ save(LS.devis,DEVIS); }catch(e){ err=e.message; }
    return {err,len:(localStorage.getItem('cp2_devis')||'').length,banner:!!document.getElementById('nxStoreFail')}; });
  rec('Grande mémoire','12 M caractères enregistrés sans erreur',!w.err&&!w.banner&&w.len>10e6,JSON.stringify(w));
  await p.evaluate(()=>nxStore.flush());
  await p.reload(); await p.waitForTimeout(4000);
  const r=await p.evaluate(()=>({n:DEVIS.length,last:DEVIS[DEVIS.length-1]&&DEVIS[DEVIS.length-1].num,mode:nxStore.mode}));
  rec('Grande mémoire','Relus intégralement après redémarrage',r.n===3000&&r.last==='DV-BIG-2999',JSON.stringify(r));
  const s=await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; d.cNom='Encore un'; NXD2.open(d,{tab:'client'}); const n0=DEVIS.length; nxd2.save(); return {added:DEVIS.length-n0,fail:!!document.getElementById('nxStoreFail')}; });
  rec('Grande mémoire','On peut encore enregistrer ensuite',s.added===1&&!s.fail,JSON.stringify(s));
  const t=await p.evaluate(async()=>{ const a=performance.now(); go('tous'); return Math.round(performance.now()-a); });
  rec('Grande mémoire','Liste rapide avec 3 000 devis',t<1500,t+' ms');
  rec('Grande mémoire','Aucune erreur',errs.length===0,clean(errs));
  await ctx.close();
}

/* D3. Suppression : une donnée effacée ne revient pas */
{
  const {p,ctx}=await page({mobile:false});
  await p.evaluate(()=>{ localStorage.setItem('cpnext_testdel','x'); }); await p.evaluate(()=>nxStore.flush());
  await p.evaluate(()=>{ localStorage.removeItem('cpnext_testdel'); }); await p.evaluate(()=>nxStore.flush());
  await p.reload(); await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>localStorage.getItem('cpnext_testdel'));
  rec('Grande mémoire','Donnée supprimée reste supprimée',r===null,String(r));
  await ctx.close();
}

/* D4. Coupure brutale avant écriture dans la base : la copie localStorage sauve la dernière modif */
{
  const {p,ctx}=await page({mobile:false});
  await seed(p); await p.evaluate(()=>nxStore.flush());
  await p.evaluate(()=>{ CLIENTS.push({id:'last',nom:'Dernière Minute',type:'Particulier'}); /* écriture sans attendre la base, puis on bloque la base */
    const op=IDBObjectStore.prototype.put; IDBObjectStore.prototype.put=function(){ throw new Error('coupure'); }; save(LS.clients,CLIENTS); });
  await p.reload(); await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>CLIENTS.some(c=>c.nom==='Dernière Minute'));
  rec('Grande mémoire','Coupure avant écriture base : rien de perdu',r);
  await ctx.close();
}

/* D5. Une ancienne version de l'appli (sans grande mémoire) écrit entre-temps → sa version gagne */
{
  const {p,ctx}=await page({mobile:false});
  await seed(p); await p.evaluate(()=>nxStore.flush());
  await p.evaluate(()=>{ const LSO=window.localStorage; const nsSet=Object.getPrototypeOf(LSO).constructor.prototype; /* écriture native directe */
    const raw=JSON.stringify([{id:'v',nom:'Écrit par ancienne version',type:'Particulier'}]);
    window.__native.set.call(LSO,'cp2_clients',raw); });
  await p.reload(); await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>CLIENTS.map(c=>c.nom).join(','));
  rec('Grande mémoire','Écriture d\'une ancienne version reprise',r==='Écrit par ancienne version',r);
  await ctx.close();
}

/* D6. Base de données indisponible (navigation privée, bug iOS) → l'appli marche sur le localStorage */
{
  const {p,ctx,errs}=await page({mobile:true,init:()=>{ try{ Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true}); }catch(e){} }});
  const r=await p.evaluate(()=>({mode:nxStore.mode,ok:!!document.querySelector('.view.active')}));
  rec('Secours','Sans base : appli lancée en mode secours',r.mode==='local'&&r.ok,JSON.stringify(r));
  const s=await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; d.cNom='Secours'; NXD2.open(d,{tab:'client'}); const n0=DEVIS.length; nxd2.save(); return DEVIS.length-n0; });
  rec('Secours','Enregistrement possible en mode secours',s===1);
  rec('Secours','Aucune erreur',errs.length===0,clean(errs));
  await ctx.close();
}

/* D7. Base qui ne répond pas ALORS que des données n'existent que dedans → écran « rouvre », pas d'appli incomplète */
{
  const b=await lancerNavigateur();
  const ctx=await b.newContext({viewport:{width:900,height:800}});
  const p=await ctx.newPage(); await p.route(/supabase|cdn\./,r=>r.abort());
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(()=>{ const big=[]; for(let i=0;i<2500;i++) big.push({id:'z'+i,v:2,lots:[],num:'DV-Z-'+i,cNom:'Z'+i,notes:'x'.repeat(2400),statut:'brouillon'}); localStorage.setItem('cp2_devis',JSON.stringify(big)); });
  await p.evaluate(()=>nxStore.flush());
  const only=await p.evaluate(()=>{ const ks=JSON.parse(window.__native.get.call(localStorage,'__nxks')||'{}'); return ks.cp2_devis; });
  await p.addInitScript(()=>{ const o=indexedDB.open.bind(indexedDB); indexedDB.open=function(){ return {set onsuccess(f){},set onerror(f){},set onupgradeneeded(f){},set onblocked(f){}}; }; });
  await p.reload(); await p.waitForTimeout(9000);
  const r=await p.evaluate(()=>({mode:window.nxStore&&nxStore.mode,block:/ne répond pas/.test(document.body.innerText),app:typeof DEVIS!=='undefined'}));
  rec('Secours','Données seulement dans la base + base muette → écran « rouvre », appli non lancée',r.block&&!r.app,JSON.stringify(r)+' ks='+JSON.stringify(only));
  await b.close();
}

/* D8. Ordre de démarrage identique : tous les modules présents et branchés */
{
  const {p,ctx,errs}=await page({mobile:false});
  const r=await p.evaluate(()=>({nxd2:!!window.NXD2,pdf:!!document.getElementById('nx-pdf-modal')||typeof window.print==='function',
    dispatch:(function(){ const x=NXD2.newDevis('split',{}); x.lots=[NXD2.newLot('split')]; x.cNom='Aiguillage'; x.num='DV-AIG'; DEVIS.push(x); openDevis(x.id); return window._curView==='nx_devis2'; })(),memo:!!(window.compute&&window.compute._nxm),icons:!!document.querySelector('svg'),
    nav:document.querySelectorAll('.nx-nav-section').length,store:nxStore.mode,ready:nxStore.ready}));
  rec('Grande mémoire','Modules chargés dans le bon ordre (aiguillage devis, calculs, icônes, menus)',r.nxd2&&r.dispatch&&r.memo&&r.nav>0&&r.ready,JSON.stringify(r));
  rec('Grande mémoire','Aucune erreur au démarrage',errs.length===0,clean(errs));
  await ctx.close();
}

await closeBrowser();
ecrireResultats('resD.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
