// Suite M — point de départ des trajets (hors du code), copie dans le presse-papiers, registre des documents
// (recherche et filtres sur tous les documents, affichage par 200).
import fs from 'fs';
import {page,rec,RES,closeBrowser} from './lib.mjs';
import { ecrireResultats, RACINE } from './env.mjs';
const G='Point de départ', C='Presse-papiers', R='Registre';

/* M0. Le code ne contient plus d'adresse de départ par défaut */
{ const s=fs.readFileSync(RACINE+'next-adresse.js','utf8');
  rec(G,'Aucun point de départ écrit dans le code',!/HOME_DEF/.test(s)&&!/lon:\s*\d+\.\d+\s*,\s*lat:\s*\d+\.\d+/.test(s)); }

/* page sans point de départ fictif, géocodage simulé et compté (aucun réseau) */
async function pageDepart(init){
  const {p,ctx,errs}=await page({mobile:false,depart:false,init});
  const geo=[];
  await p.route(/data\.geopf\.fr\/geocodage/, r=>{ const q=new URL(r.request().url()).searchParams.get('q')||''; geo.push(q);
    const x=/beauvais/i.test(q)?[2.0807,49.4295]:/compiegne|compiègne/i.test(q)?[2.8262,49.4179]:[2.47,49.38];
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:x},properties:{label:q,score:0.9}}]})}); });
  await p.route(/data\.geopf\.fr\/navigation/, r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({distance:12.3,duration:15})}));
  return {p,ctx,errs,geo};
}
const ENT=(adr,cp,ville)=>`(()=>{ Object.assign(P.entreprise,{adresse:${JSON.stringify(adr)},cp:${JSON.stringify(cp)},ville:${JSON.stringify(ville)}}); })()`;
const POINT=()=>JSON.parse(localStorage.getItem('cpnext_home')||'null');

/* M1. Aucun point, adresse de l'entreprise remplie → géocodée une fois, enregistrée (source entreprise) */
{ const {p,ctx,errs,geo}=await pageDepart();
  await p.evaluate(ENT("1 rue de l'Exemple",'60000','Beauvais'));
  const r=await p.evaluate(async()=>{ const a=await nxadDistance('5 rue de la Gare 60600 Clermont'); const h1=JSON.parse(localStorage.getItem('cpnext_home')||'null');
    const b=await nxadDistance('8 place du Marché 60600 Clermont'); return {a,b,h1}; });
  const geoEnt=geo.filter(q=>/beauvais/i.test(q)).length;
  rec(G,'Sans point enregistré : l\'adresse de l\'entreprise sert de départ (géocodée une seule fois)',r.a&&r.a.km===12.3&&r.b&&geoEnt===1,JSON.stringify({geoEnt,a:r.a}));
  rec(G,'Point enregistré avec l\'adresse qui a servi au calcul (source entreprise)',r.h1&&r.h1.source==='entreprise'&&/Beauvais/.test(r.h1.adresseSource)&&r.h1.lat>49,JSON.stringify(r.h1));
  /* M2. déménagement : l'adresse de l'entreprise change → le point est recalculé */
  await p.evaluate(ENT('3 place Saint-Jacques','60200','Compiègne'));
  const r2=await p.evaluate(async()=>{ const d=await nxadDistance('9 rue Neuve 60600 Clermont'); return {d,h:JSON.parse(localStorage.getItem('cpnext_home')||'null')}; });
  rec(G,'Déménagement : nouvelle adresse d\'entreprise → point de départ recalculé',r2.h&&/Compi/.test(r2.h.adresseSource)&&Math.abs(r2.h.lon-2.8262)<1e-6&&geo.some(q=>/compi/i.test(q)),JSON.stringify(r2.h));
  rec(G,'Aucune erreur de page',!errs.length,errs.join(' | ')); await ctx.close(); }

/* M3. Point saisi à la main : jamais remplacé par l'adresse de l'entreprise, même si elle change */
{ const {p,ctx,errs,geo}=await pageDepart(()=>{ localStorage.setItem('cpnext_home',JSON.stringify({adr:'2 rue Manuelle 60100 Creil',lon:2.47,lat:49.26,source:'manuel'})); });
  await p.evaluate(ENT('3 place Saint-Jacques','60200','Compiègne'));
  const r=await p.evaluate(async()=>{ const d=await nxadDistance('5 rue de la Gare 60600 Clermont'); return {d,h:JSON.parse(localStorage.getItem('cpnext_home')||'null')}; });
  rec(G,'Point saisi à la main gardé (pas de géocodage de l\'adresse de l\'entreprise)',r.h&&r.h.source==='manuel'&&r.h.adr.indexOf('Manuelle')>=0&&!geo.some(q=>/compi/i.test(q)),JSON.stringify(r.h));
  /* ancien point sans « source » (enregistré avant cette version) = saisi à la main */
  await p.evaluate(()=>localStorage.setItem('cpnext_home',JSON.stringify({adr:'4 rue Ancienne 60100 Creil',lon:2.48,lat:49.25})));
  const r2=await p.evaluate(async()=>{ await nxadDistance('7 rue de la Gare 60600 Clermont'); return JSON.parse(localStorage.getItem('cpnext_home')||'null'); });
  rec(G,'Ancien point sans source : considéré comme saisi à la main, gardé',r2&&r2.adr.indexOf('Ancienne')>=0&&!r2.source,JSON.stringify(r2));
  rec(G,'Aucune erreur de page (point manuel)',!errs.length,errs.join(' | ')); await ctx.close(); }

/* M4. Ni point ni adresse d'entreprise → message clair, aucun plantage */
{ const {p,ctx,errs}=await pageDepart();
  await p.evaluate(ENT('','',''));
  const r=await p.evaluate(async()=>{ try{ await nxadDistance('5 rue de la Gare 60600 Clermont'); return 'calculé'; }catch(e){ return String(e.message||e); } });
  rec(G,'Rien de réglé : message « point de départ non réglé », pas de calcul',/point de départ des trajets non réglé/.test(r),r);
  /* Paramètres : la carte indique l'origine du point */
  const card=await p.evaluate(()=>{ go('params'); const c=document.getElementById('nxadHomeCard'); return c?c.textContent:''; });
  rec(G,'Paramètres : l\'origine du point est affichée',/Non réglé|adresse de l'entreprise/.test(card),card.slice(0,160));
  rec(G,'Aucune erreur de page (rien de réglé)',!errs.length,errs.join(' | ')); await ctx.close(); }

/* M5. Presse-papiers : « Copié » seulement si la copie a réussi ; aucun refus non intercepté */
{ const {p,ctx,errs}=await page({mobile:false});
  await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://localhost:8765'});
  const ok=await p.evaluate(async()=>{ const r=await cpCopier('texte ClimPilot'); let lu=''; try{ lu=await navigator.clipboard.readText(); }catch(e){ lu='?'; } return {r,lu}; });
  rec(C,'Copie autorisée : réussite annoncée et texte réellement copié',ok.r===true&&ok.lu==='texte ClimPilot',JSON.stringify(ok));
  const ui=await p.evaluate(async()=>{ const t=document.createElement('textarea'); t.id='nxfoBody'; t.value='demande de prix'; document.body.appendChild(t);
    nxfoCopy(); await new Promise(r=>setTimeout(r,300)); return (document.getElementById('toast')||{}).textContent||''; });
  rec(C,'Demande fournisseur : « Texte copié » après une vraie copie',/Texte copié/.test(ui),ui);
  await ctx.close(); }
{ const {p,ctx,errs}=await page({mobile:false,init:()=>{ try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new DOMException('refus','NotAllowedError'))},configurable:true}); }catch(e){} document.execCommand=()=>false; }});
  const r=await p.evaluate(async()=>cpCopier('x'));
  const ui=await p.evaluate(async()=>{ const t=document.createElement('textarea'); t.id='nxfoBody'; t.value='demande'; document.body.appendChild(t);
    nxfoCopy(); await new Promise(r=>setTimeout(r,300)); return (document.getElementById('toast')||{}).textContent||''; });
  await p.waitForTimeout(300);
  rec(C,'Copie refusée : échec annoncé (« Copie impossible »), jamais « copié »',r===false&&/Copie impossible/.test(ui)&&!/Texte copié/.test(ui),JSON.stringify({r,ui}));
  rec(C,'Copie refusée : aucune erreur non interceptée',!errs.length,errs.join(' | '));
  await ctx.close(); }

/* M6. Registre : 1 500 devis + 500 interventions ; recherche et filtres sur tout, affichage par 200 */
{ const {p,ctx,errs}=await page({mobile:false});
  await p.evaluate(()=>{ const mods=NXD2.natures.map(n=>n.id);
    for(let i=0;i<1500;i++){ const m=mods[i%mods.length]; const d=NXD2.newDevis(m,{}); d.lots=[NXD2.newLot(m)]; Object.assign(d,{cNom:'Client '+(i%300),statut:'brouillon',created:Date.now()-i*3600e3}); d.num=NXD2.numFor(d)+'-'+i; DEVIS.push(d); }
    DEVIS.push(Object.assign(NXD2.newDevis(mods[0],{}),{cNom:'Garage Rarissime',statut:'brouillon',created:Date.now()-5*86400e3,num:'DV-ZZZ-UNIQUE'}));
    save(LS.devis,DEVIS); });
  const t=[]; for(let k=0;k<5;k++){ t.push(await p.evaluate(()=>{ go('dash'); const t0=performance.now(); go('nx_docs'); return Math.round(performance.now()-t0); })); }
  const r=await p.evaluate(()=>{ const rows=()=>document.querySelectorAll('#nxDocs tbody tr').length;
    const o={tot:DEVIS.length,rows:rows(),plus:!!document.getElementById('nxDocsPlus'),compte:(document.getElementById('nxDocsCompte')||{}).textContent||'',kpi:(document.querySelector('#nxDocs .kpi.blue .val')||{}).textContent||''};
    document.getElementById('nxDocsPlus').click(); o.rows2=rows(); return o; });
  const med=[...t].sort((a,b)=>a-b)[2];
  rec(R,'Affichage limité à 200 lignes, avec « Afficher plus »',r.rows===200&&r.plus&&/— 200 affichés/.test(r.compte),JSON.stringify(r));
  rec(R,'« Afficher plus » ajoute 200 lignes',r.rows2===400,r.rows2);
  rec(R,'Compteurs sur TOUS les documents (pas seulement les 200 affichés)',Number(r.kpi)>=1501&&new RegExp('^'+r.kpi+' document').test(r.compte),JSON.stringify({kpi:r.kpi,compte:r.compte}));
  rec(R,'Ouverture du registre avec 1 500 devis : médiane de 5 mesures < 0,8 s',med<800,t.join(', ')+' ms');
  /* recherche d'un document qui n'est pas dans les 200 premiers */
  const s=await p.evaluate(async()=>{ const order=[...document.querySelectorAll('#nxDocs tbody tr td:first-child')].map(x=>x.textContent); const visible=order.indexOf('DV-ZZZ-UNIQUE')>=0&&order.indexOf('DV-ZZZ-UNIQUE')<200;
    nxDocsRecherche('rarissime'); await new Promise(r=>setTimeout(r,400));
    const q=document.getElementById('nxDocsQ'); const rows=[...document.querySelectorAll('#nxDocs tbody tr')].map(x=>x.textContent);
    return {visibleAvant:visible,rows,focus:document.activeElement===q,val:q&&q.value}; });
  rec(R,'Recherche : trouve un document hors des 200 premiers affichés',!s.visibleAvant&&s.rows.length===1&&/DV-ZZZ-UNIQUE/.test(s.rows[0]),JSON.stringify(s).slice(0,300));
  rec(R,'Recherche : le curseur reste dans le champ',s.focus&&s.val==='rarissime',JSON.stringify({focus:s.focus,val:s.val}));
  const f=await p.evaluate(async()=>{ nxDocsRecherche(''); await new Promise(r=>setTimeout(r,400));
    const ty=document.getElementById('nxDocsType'); ty.value='Devis'; ty.dispatchEvent(new Event('change')); const yr=document.getElementById('nxDocsYear'); yr.value='*'; yr.dispatchEvent(new Event('change'));
    return {rows:document.querySelectorAll('#nxDocs tbody tr').length,compte:document.getElementById('nxDocsCompte').textContent,tot:DEVIS.length}; });
  rec(R,'Filtres (type + toutes les années) : comptés sur tout, affichage remis à 200',f.rows===200&&new RegExp('^'+f.tot+' document').test(f.compte),JSON.stringify(f));
  rec(R,'Aucune erreur de page',!errs.length,errs.join(' | '));
  await ctx.close(); }

await closeBrowser();
ecrireResultats('resM.json',RES);
RES.forEach(x=>console.log(x.ok.padEnd(5),'['+x.group+']',x.name,x.ok==='PASS'?'':'— '+x.detail));
