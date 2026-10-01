import {page,rec,RES,closeBrowser,seed,SEED} from './lib.mjs';
import fs from 'fs';
const clean=e=>[...new Set(e)].slice(0,6).join(' | ');

/* B1. Aller-retour : chaque nature enregistrée, rechargée, identique au centime ; PDF sans « undefined / NaN » */
{
  const {p,errs,ctx}=await page({mobile:true});
  await seed(p);
  const before=await p.evaluate(()=>DEVIS.map(d=>{ const c=compute(d); return [d.id,d.num,Math.round(c.totalHT*100)]; }));
  await p.reload(); await p.waitForTimeout(2200);
  const after=await p.evaluate(()=>DEVIS.map(d=>{ const c=compute(d); return [d.id,d.num,Math.round(c.totalHT*100)]; }));
  const diff=before.filter((b,i)=>!after[i]||after[i][2]!==b[2]||after[i][1]!==b[1]);
  rec('Devis','Totaux identiques après rechargement ('+before.length+' devis, 1 par nature)',diff.length===0,JSON.stringify(diff));
  const pdf=await p.evaluate(async()=>{ const out=[]; for(const d of DEVIS){ try{ NXD2.open(d,{tab:'recap'}); await new Promise(r=>setTimeout(r,80)); printDevis(); await new Promise(r=>setTimeout(r,120));
      const pg=document.getElementById('nx-pdf-page'); const t=pg?pg.textContent:''; const bad=(t.match(/undefined|NaN|\[object|null €|Infinity/g)||[]);
      if(!t||t.length<200) out.push(d.num+': PDF vide'); else if(bad.length) out.push(d.num+': '+bad.join(','));
      const c=document.getElementById('nx-pdf-close'); if(c) c.click(); }catch(e){ out.push(d.num+' ERR '+e.message); } } return out; });
  rec('Devis','PDF de chaque nature propre (pas de « undefined »/NaN)',pdf.length===0,pdf.join(' | '));
  /* numéros uniques */
  const dup=await p.evaluate(()=>{ const n={}; DEVIS.forEach(d=>n[d.num]=(n[d.num]||0)+1); return Object.keys(n).filter(k=>n[k]>1); });
  rec('Devis','Numéros de devis uniques',dup.length===0,dup.join(','));
  /* double tap sur Enregistrer */
  const dbl=await p.evaluate(()=>{ const n0=DEVIS.length; const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; d.cNom='Double Tap'; NXD2.open(d,{tab:'client'}); nxd2.save(); nxd2.save(); nxd2.save(); return DEVIS.length-n0; });
  rec('Devis','Double/triple appui sur Enregistrer = 1 seul devis',dbl===1,dbl+' créé(s)');
  /* facturation : série continue même en mélangeant devis / intervention */
  const fac=await p.evaluate(()=>{ const acc=DEVIS.filter(d=>d.statut==='accepte'&&compute(d).totalHT>0).slice(0,3); const nums=[];
    acc.forEach(d=>{ d.acompteOn=true; d.acomptePct=30; try{ facturerDevis(d.id,'acompte'); }catch(e){} try{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); }catch(e){} try{ facturerDevis(d.id,'solde'); }catch(e){} try{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); }catch(e){}
      [d.facAcompte,d.facSolde].forEach(f=>{ if(f) nums.push(f.num); }); });
    const chk=typeof nxSerieCheck==='function'?nxSerieCheck():null;
    return {nums,chk:chk?JSON.stringify(chk).slice(0,200):'n/a',sum:acc.map(d=>{ const t=(typeof nxBillTotal==='function')?nxBillTotal(d,compute(d)):compute(d).totalTTC; return Math.round(((d.facAcompte||{}).montant||0)*100+((d.facSolde||{}).montant||0)*100)-Math.round(t*100); })}; });
  const seq=fac.nums.map(n=>+n.split('-')[2]); const cont=seq.every((v,i)=>i===0||v===seq[i-1]+1);
  rec('Factures','Numéros de facture continus ('+fac.nums.join(', ')+')',fac.nums.length>0&&cont,fac.chk);
  rec('Factures','Acompte + solde = total du devis (au centime)',fac.sum.every(x=>x===0),JSON.stringify(fac.sum));
  const dblF=await p.evaluate(()=>{ const d=DEVIS.find(x=>x.facSolde); if(!d) return 'n/a'; const n0=d.facSolde.num; facturerDevis(d.id,'solde'); return d.facSolde.num===n0; });
  rec('Factures','Pas de double facture si on réappuie',dblF===true,String(dblF));
  rec('Devis','Aucune erreur',errs.length===0,clean(errs));
  await ctx.close();
}

/* B2. Noms piégés : apostrophe, guillemets, HTML, emoji */
{
  const {p,errs,ctx}=await page({mobile:true,init:()=>{ window.__xss=0; window.alert=function(m){ if(String(m)==='xss') window.__xss++; }; }});
  await seed(p);
  await p.evaluate(()=>{ const bad=[{id:'x1',nom:'<img src=x onerror="alert(\'xss\')">',tel:'1',type:'Particulier',adr:'<b>rue</b>',ville:'Ville',notes:'<script>alert("xss")</script>'},{id:'x3',nom:'x" autofocus onfocus="alert(\'xss\')" y="',tel:'3',type:'Particulier',adr:'" onmouseover="alert(\'xss\')',ville:'V',notes:''},{id:'x2',nom:"O'Neil & Fils \"Clim\" 🧊",tel:'2',type:'Professionnel',adr:"1 rue d'Ici",ville:"L'Isle-Adam",notes:"note d'accès"}];
    bad.forEach(c=>CLIENTS.push(c)); save(LS.clients,CLIENTS);
    bad.forEach(c=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; Object.assign(d,{cNom:c.nom,cAdr:c.adr,cVille:c.ville,statut:'accepte',datePlanif:dISO(new Date()),notePlanning:'<i>n</i>\'"'}); d.num=NXD2.numFor(d); DEVIS.push(d);
      CTR.push({id:'k'+c.id,clientNom:c.nom,type:'Climatisation',prix:180,visites:1,prochaineVisite:dISO(new Date()),actif:true,facs:[]});
      EQUIP.push({id:'e'+c.id,client:c.nom,type:'Monosplit',marque:'M',modele:"R'1",fluide:'R32',charge:1}); });
    save(LS.devis,DEVIS); save('cp2_contrats',CTR); save('cp2_equip',EQUIP); });
  const views=['dash','tous','plan','clients','contrats','fluides','nx_docs','relances','commander','recettes','nx_tasks','nx_journee'];
  const probs=[];
  for(const v of views){ const e0=errs.length; await p.evaluate(v=>{ try{ go(v); }catch(e){ throw new Error(v+': '+e.message); } },v).catch(e=>probs.push(e.message)); await p.waitForTimeout(150); if(errs.length>e0) probs.push(v+': '+errs.slice(e0).join('/')); }
  /* clic des boutons liés aux clients piégés (✏️ contrat, proposer contrat, fiche 360) */
  const e1=errs.length;
  await p.evaluate(async()=>{ go('contrats'); await new Promise(r=>setTimeout(r,100)); document.querySelectorAll('#v-contrats button').forEach(b=>{ if(/openCtr|Proposer/.test(b.getAttribute('onclick')||b.textContent)){ try{ b.click(); }catch(e){} document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on')); } });
    go('clients'); await new Promise(r=>setTimeout(r,100)); document.querySelectorAll('#v-clients [onclick*="Client360"],#v-clients [onclick*="openClient360"]').forEach(b=>{ try{ b.click(); }catch(e){} });
    go('plan'); await new Promise(r=>setTimeout(r,300)); });
  if(errs.length>e1) probs.push('boutons: '+errs.slice(e1).join('/'));
  /* sélecteur de client + recherche globale */
  await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; NXD2.open(d,{tab:'client'}); });
  await p.locator('[data-k="$.cNom"]').tap(); await p.keyboard.type("o'neil"); await p.waitForTimeout(200);
  const pick=await p.locator('.nxcp-dd .nxcp-it').count(); if(pick) { await p.locator('.nxcp-dd .nxcp-it').first().tap(); await p.waitForTimeout(300); }
  const got=await p.evaluate(()=>NXD2.api.cur().cTel);
  rec('Noms piégés','Client avec apostrophe/guillemets sélectionnable',got==='2','tel='+got);
  const x=await p.evaluate(()=>window.__xss);
  rec('Noms piégés','Aucun code injecté exécuté (HTML dans un nom)',x===0,x+' exécution(s)');
  rec('Noms piégés','Écrans et boutons OK avec noms spéciaux',probs.length===0,probs.join(' | '));
  const planTxt=await p.evaluate(()=>{ go('plan'); return document.getElementById('planGrid').innerHTML.includes('<img src=x'); });
  rec('Noms piégés','Planning n\'interprète pas le HTML des noms',!planTxt);
  await ctx.close();
}

/* B3. Données abîmées dans le stockage : l'app démarre quand même */
{
  const cases={
    'devis illisible':()=>{ localStorage.setItem('cp2_devis','{pas du json'); },
    'clients = null':()=>{ localStorage.setItem('cp2_clients','null'); },
    'clients = objet':()=>{ localStorage.setItem('cp2_clients','{"a":1}'); },
    'devis avec trous':()=>{ localStorage.setItem('cp2_devis',JSON.stringify([null,{id:'z',v:2,lots:null,statut:'accepte'},{id:'y'},{id:'w',v:2,lots:[{module:'inconnu',data:null}]}])); },
    'caches nouveaux abîmés':()=>{ ['cpnext_geo','cpnext_refs','cpnext_home','cpnext_dim2','cpnext_fourn','cpnext_flu_guide'].forEach(k=>localStorage.setItem(k,'[1,2')); },
    'caches nouveaux = tableaux':()=>{ ['cpnext_geo','cpnext_refs','cpnext_home','cpnext_dim2','cpnext_fourn'].forEach(k=>localStorage.setItem(k,'[1,2,3]')); },
    'interventions/contrats abîmés':()=>{ localStorage.setItem('cp2_dep','[{"id":"a"},null]'); localStorage.setItem('cp2_contrats','[{"id":"b","prochaineVisite":"pas-une-date"}]'); localStorage.setItem('cp2_fluides','[{}]'); }
  };
  for(const [name,fn] of Object.entries(cases)){
    const {p,errs,ctx}=await page({mobile:true,init:`(()=>{ if(!sessionStorage.getItem('__i')){ sessionStorage.setItem('__i','1'); (${fn.toString()})(); } })()`});
    await p.reload(); await p.waitForTimeout(2200);
    const e0=errs.length;
    const r=await p.evaluate(async()=>{ const out=[]; for(const v of ['dash','tous','plan','clients','dep','contrats','fluides','dim','nx_docs','recettes']){ try{ go(v); }catch(e){ out.push(v+': '+e.message); } await new Promise(r=>setTimeout(r,60)); }
      try{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; d.cNom='Test'; NXD2.open(d,{tab:'client'}); nxd2.save(); }catch(e){ out.push('nouveau devis: '+e.message); }
      return out; });
    const alive=await p.evaluate(()=>!!document.querySelector('.view.active'));
    const all=r.concat(errs);
    rec('Données abîmées',name+' → l\'app reste utilisable',alive&&all.length===0,clean(all));
    await ctx.close();
  }
}

/* B4. Gros volume : 300 clients, 1500 devis, 500 interventions */
{
  const {p,errs,ctx}=await page({mobile:true});
  const t=await p.evaluate(()=>{ const T0=performance.now();
    for(let i=0;i<300;i++) CLIENTS.push({id:'v'+i,nom:'Client '+i,tel:'06'+i,type:i%2?'Professionnel':'Particulier',adr:i+' rue Test',ville:'Ville '+(i%20)});
    const mods=NXD2.natures.map(n=>n.id);
    for(let i=0;i<1500;i++){ const m=mods[i%mods.length]; const d=NXD2.newDevis(m,{}); d.lots=[NXD2.newLot(m)]; Object.assign(d,{cNom:'Client '+(i%300),statut:['brouillon','envoye','accepte','refuse'][i%4],created:Date.now()-i*3600e3}); d.num=NXD2.numFor(d)+'-'+i; DEVIS.push(d); }
    for(let i=0;i<500;i++) DEP.push({id:'d'+i,cNom:'Client '+(i%300),date:dISO(new Date(Date.now()-i*86400e3)),itype:'dep',statut:'facturee',heures:1});
    const T1=performance.now(); let ok=true, size=0;
    try{ save(LS.clients,CLIENTS); save(LS.devis,DEVIS); save(LS.dep,DEP); }catch(e){ ok=false; }
    size=(localStorage.getItem(LS.devis)||'').length;
    return {gen:Math.round(T1-T0),ok,sizeKB:Math.round(size/1024)}; });
  rec('Volume','Enregistrement de 1 500 devis',t.ok,'taille '+t.sizeKB+' Ko');
  await p.reload(); const T=Date.now(); await p.waitForTimeout(3500);
  const perf=await p.evaluate(async()=>{ const m={}; const tm=async(k,f)=>{ const a=performance.now(); try{ f(); }catch(e){ m[k]='ERR '+e.message; return; } await new Promise(r=>setTimeout(r,0)); m[k]=Math.round(performance.now()-a); };
    await tm('liste devis',()=>go('tous')); await tm('tableau de bord',()=>go('dash')); await tm('planning',()=>go('plan')); await tm('clients',()=>go('clients')); await tm('registre documents',()=>go('nx_docs')); await tm('recettes',()=>go('recettes'));
    await tm('ouvrir un devis',()=>NXD2.open(DEVIS[700],{tab:'lots'}));
    await tm('frappe (recalcul devis)',()=>{ for(let i=0;i<10;i++) NXD2.compute(NXD2.api.cur()); });
    return m; });
  const slow=Object.entries(perf).filter(([k,v])=>typeof v==='string'||v>800);
  rec('Volume','Écrans rapides avec 1 500 devis (< 0,8 s)',slow.length===0,Object.entries(perf).map(([k,v])=>k+' '+v+(typeof v==='number'?' ms':'')).join(', '));
  /* recherche du sélecteur client */
  const pk=await p.evaluate(async()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; NXD2.open(d,{tab:'client'}); const i=document.querySelector('[data-k="$.cNom"]'); i.focus(); i.value='client 29'; const a=performance.now(); i.dispatchEvent(new Event('input',{bubbles:true})); return {ms:Math.round(performance.now()-a),n:document.querySelectorAll('.nxcp-dd .nxcp-it').length}; });
  rec('Volume','Recherche client instantanée parmi 300',pk.ms<100&&pk.n>0,pk.ms+' ms, '+pk.n+' résultats');
  rec('Volume','Aucune erreur',errs.length===0,clean(errs));
  await ctx.close();
}

/* B5. Stockage plein : l'enregistrement échoue-t-il en silence ? */
{
  const {p,errs,ctx}=await page({mobile:true});
  const r=await p.evaluate(()=>{ let toastMsg=[]; const ot=window.toast; window.toast=function(m){ toastMsg.push(String(m)); try{ ot&&ot.apply(this,arguments); }catch(e){} };
    const orig=Storage.prototype.setItem; let blocked=0;
    Storage.prototype.setItem=function(k,v){ if(/^cp2_devis$/.test(k)){ blocked++; const e=new Error('QuotaExceededError'); e.name='QuotaExceededError'; throw e; } return orig.call(this,k,v); };
    const n0=DEVIS.length; const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; d.cNom='Martin'; NXD2.open(d,{tab:'client'}); let thrown='';
    try{ nxd2.save(); }catch(e){ thrown=e.message; }
    Storage.prototype.setItem=orig;
    const banner=!!document.getElementById('nxStoreFail');
    return {blocked,thrown,toasts:toastMsg.join(' / '),banner,added:DEVIS.length-n0}; });
  const warned=r.banner&&!/ enregistré$/.test(r.toasts)&&r.added===0;
  rec('Stockage plein','Stockage plein : alerte rouge, jamais « enregistré »',warned,JSON.stringify(r));
  await ctx.close();
  const g=await page({mobile:true,init:()=>{ try{ navigator.storage.estimate=()=>Promise.resolve({usage:950,quota:1000}); }catch(e){} }});
  await g.p.waitForTimeout(2500);
  const gb=await g.p.evaluate(()=>({b:(document.getElementById('nxmStore')||{}).textContent||'',mode:nxStore.mode}));
  rec('Stockage plein','Mémoire presque pleine → prévenu au démarrage',/remplie à 95/.test(gb.b),JSON.stringify(gb));
  await g.ctx.close();
}

/* B6. Réseau coupé / service d'itinéraire en panne */
{
  const {p,errs,ctx}=await page({mobile:true,offline:true});
  await seed(p);
  await p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; NXD2.open(d,{tab:'client'}); });
  await p.locator('[data-k="$.cAdr"]').tap(); await p.keyboard.type('10 rue de grenelle paris'); await p.waitForTimeout(1500);
  const msg=await p.evaluate(()=>(document.querySelector('.nxcp-dd')||{}).textContent||'');
  rec('Hors réseau','Adresse sans réseau : message clair, saisie possible',/indisponible|réseau/i.test(msg),msg);
  await p.evaluate(()=>go('plan')); await p.waitForTimeout(800);
  rec('Hors réseau','Planning s\'affiche sans réseau',await p.evaluate(()=>document.querySelectorAll('.nxad-ev').length>0));
  rec('Hors réseau','Aucune erreur',errs.length===0,clean(errs));
  await ctx.close();
  const q=await page({mobile:true,routeFail:true});
  await q.p.evaluate(()=>{ const d=NXD2.newDevis('split',{}); d.lots=[NXD2.newLot('split')]; NXD2.open(d,{tab:'client'}); });
  await q.p.locator('[data-k="$.cAdr"]').tap(); await q.p.keyboard.type('10 rue de grenelle paris'); await q.p.waitForTimeout(900);
  if(await q.p.locator('.nxcp-dd .nxcp-it').count()) { await q.p.locator('.nxcp-dd .nxcp-it').first().tap(); await q.p.waitForTimeout(1500); }
  const est=await q.p.evaluate(()=>({box:(document.getElementById('nxadDist')||{}).textContent,z:NXD2.api.cur().zone,km:NXD2.api.cur().km}));
  rec('Hors réseau','Itinéraire en panne : distance estimée affichée',/estim/.test(est.box||''),JSON.stringify(est));
  await q.ctx.close();
}

/* B7. Fuseaux / dates : « aujourd'hui » et le planning ne décalent pas d'un jour */
for(const tz of ['Europe/Paris','Pacific/Kiritimati','America/Los_Angeles']){
  const {p,errs,ctx}=await page({mobile:false,tz});
  const r=await p.evaluate(()=>{ const now=new Date(); const loc=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    return {today:(typeof todayISO==='function'?todayISO():''),dISO:dISO(now),loc,fr:window.nxDateFR?nxDateFR('2026-10-25'):'', iso:window.nxToISO?[nxToISO('5/10/26'),nxToISO('05.10.2026'),nxToISO('2026-10-05T23:00')]:[]}; });
  rec('Dates','Date du jour juste ('+tz+')',r.today===r.loc&&r.dISO===r.loc,JSON.stringify(r));
  await ctx.close();
}
{
  const {p,ctx}=await page({mobile:false});
  const r=await p.evaluate(()=>{ return [nxToISO('5/10/26'),nxToISO('05.10.2026'),nxToISO('2026-10-05T23:00'),nxToISO('31/02/2026'),nxToISO('bonjour'),nxDateFR('2026-10-05')]; });
  rec('Dates','Conversion des dates saisies à l\'ancienne',r[0]==='2026-10-05'&&r[1]==='2026-10-05'&&r[2]==='2026-10-05'&&r[4]===''&&r[5]==='05/10/2026','31/02 → '+r[3]+' | '+JSON.stringify(r));
  /* semaine du changement d'heure */
  const w=await p.evaluate(()=>{ const out=[]; const base=new Date(2026,9,26); for(let i=0;i<7;i++){ const d=new Date(2026,9,19+i,0,0,0); out.push(dISO(d)); } return out; });
  rec('Dates','Semaine du passage à l\'heure d\'hiver (25/10) : 7 jours distincts',new Set(w).size===7,w.join(','));
  await ctx.close();
}

/* B8. Calculs : cohérence des outils de dimensionnement */
{
  const {p,ctx}=await page({mobile:false});
  const r=await p.evaluate(()=>{ go('dim'); const C=nxdm.calc, o=[];
    const g=C.gaine({kw:3.5,debit:'',dt:10,vmax:4,pieces:[{n:'A',s:20}]}); o.push(['Gainable 3,5 kW → 1029 m³/h',Math.round(g.Q)===1029]);
    const g0=C.gaine({kw:0,debit:'',dt:10,vmax:4,pieces:[]}); o.push(['Gainable vide sans plantage',g0.rows.length===0]);
    const w=C.eau({kw:10,dt:5,tube:'multi',temp:45,long:10}); o.push(['Eau 10 kW ΔT5 → 1,72 m³/h',Math.abs(w.Q-1.7197)<0.01]);
    const w0=C.eau({kw:0,dt:5,tube:'cuivre',temp:45,long:0}); o.push(['Eau 0 kW sans NaN',w0.rows.every(x=>isFinite(x.v))]);
    const big=C.eau({kw:500,dt:5,tube:'cuivre',temp:45,long:10}); o.push(['Eau 500 kW : aucun tube → avertit',big.rec===null]);
    ['R32','R410A','R134a','R404A','R448A','R290','R454B'].forEach(fl=>{ const f=C.frigo({fl,kw:5,te:-10,tc:40}); o.push(['Frigo '+fl+' calcule',!!f&&f.m>0&&f.lines.every(L=>L.best!=null)]); });
    const hot=C.frigo({fl:'R404A',kw:5,te:10,tc:25}); o.push(['Frigo cas limite Te=10/Tc=25',!!hot]);
    const neg=C.frigo({fl:'R404A',kw:3,te:-35,tc:40}); o.push(['Frigo négatif −35 °C',!!neg&&neg.lines[0].best!=null]);
    const bad=C.frigo({fl:'R404A',kw:5,te:40,tc:30}); o.push(['Frigo Te > Tc refusé proprement',bad===null]);
    return o; });
  r.forEach(([n,ok])=>rec('Calculs',n,ok));
  await ctx.close();
}


/* B9. Mémoire de calcul : jamais de total périmé */
{
  const {p,ctx}=await page({mobile:false});
  await seed(p); await p.waitForTimeout(600);
  const r=await p.evaluate(async()=>{ const o={}; const d=DEVIS.find(x=>x.v===2&&compute(x).totalHT>100);
    o.cached=!!window.nxmComputeCache;
    const t1=compute(d).totalHT; await new Promise(r=>setTimeout(r,5));
    const r0=d.rateChoice; d.rateChoice='custom'; d.rateCustom=999; const t2=compute(d).totalHT; d.rateChoice=r0; await new Promise(r=>setTimeout(r,5));
    const t3=compute(d).totalHT; await new Promise(r=>setTimeout(r,5));
    const p0=P.fraisAdmin; P.fraisAdmin=(Number(p0)||0)+100; await new Promise(r=>setTimeout(r,5)); const t4=compute(d).totalHT; P.fraisAdmin=p0; await new Promise(r=>setTimeout(r,5));
    let it=null; for(const x of DEVIS){ const mt=(compute(x).mat||[]); for(const m of mt){ const pp=PRIX.find(q=>q.nom===m.nom&&q.achat>0&&q.pv==null); if(pp){ it=pp; break; } } if(it) break; } if(!it) it=PRIX.find(x=>x.achat>0); const a0=it.achat, pv0=it.pv; it.achat=a0*3; it.pv=null; await new Promise(r=>setTimeout(r,5));
    const d2=DEVIS.find(x=>JSON.stringify(compute(x).mat||[]).indexOf(it.nom)>=0); let t5=null,t6=null;
    if(d2){ it.achat=a0; it.pv=pv0; await new Promise(r=>setTimeout(r,5)); t5=compute(d2).totalHT; it.achat=a0*3; it.pv=null; await new Promise(r=>setTimeout(r,5)); t6=compute(d2).totalHT; }
    it.achat=a0; it.pv=pv0;
    const c1=compute(d); c1.totalHT=-1; const c2=compute(d);
    return {o,t1,t2,t3,t4,t5,t6,shared:c2.totalHT===-1}; });
  rec('Calculs','Mémoire de calcul active',r.o.cached);
  rec('Calculs','Devis modifié → total recalculé',r.t2!==r.t1&&r.t3===r.t1,JSON.stringify(r));
  rec('Calculs','Réglage modifié → total recalculé',r.t4!==r.t1,'');
  rec('Calculs','Prix d\'achat modifié → total recalculé',r.t5===null?'INFO':r.t6!==r.t5,r.t5===null?'aucun devis avec cet article':'');
  rec('Calculs','Résultats indépendants (pas de copie partagée)',!r.shared);
  await ctx.close();
}
await closeBrowser();
fs.writeFileSync('/tmp/claude-0/sp/resB.json',JSON.stringify(RES,null,1));
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
