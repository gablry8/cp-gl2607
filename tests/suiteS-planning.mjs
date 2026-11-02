import { ecrireResultats, out } from './env.mjs';
// Suite S — planning par demi-journée (20/10/2026, next-planning.js) : moment de chaque intervention, conflits,
// confirmation avant de planifier sur un moment pris, demi-journées occupées envoyées sans nom, moments pris
// dans Google Agenda affichés et comptés.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
const j=o=>JSON.stringify(o);

const {p,ctx,errs}=await page({mobile:false});
await seed(p);
await p.waitForFunction(()=>typeof window.nxplMoment==='function'&&window.planifDevis&&window.planifDevis._nxpl,null,{timeout:15000});
/* trois chantiers acceptés, planifiés dans 7 jours (date fixe pour tous les contrôles) */
const D=await p.evaluate(()=>{
  const x=new Date(); x.setDate(x.getDate()+7); const iso=dISO(x);
  const base=DEVIS.find(d=>d.statut==='accepte');
  const mk=(id,nom)=>{ const d=JSON.parse(JSON.stringify(base)); d.id=id; d.cNom=nom; d.datePlanif=iso; delete d.momentPlanif; return d; };
  DEVIS.push(mk('pl-a','Client A'),mk('pl-b','Client B')); const c=mk('pl-c','Client C'); c.datePlanif=''; DEVIS.push(c); save(LS.devis,DEVIS);
  return {iso};
});

/* S1 clés et moment par défaut */
{
  const r=await p.evaluate(D=>{ const out={};
    const ev=[]; for(let o=0;o<3;o++) planEvents(o).ev.forEach(e=>ev.push(e.k||''));
    out.cles=ev.filter(k=>/^devis:pl-/.test(k)); out.m=nxplMoment('devis:pl-a'); out.inconnu=nxplMoment('devis:rien');
    return out; },D);
  rec('Planning','Chaque intervention du planning a une clé (type:id)',r.cles.includes('devis:pl-a')&&r.cles.includes('devis:pl-b'),j(r));
  rec('Planning','Sans moment choisi : Journée (prudent, bloque matin et après-midi)',r.m==='journee'&&r.inconnu==='journee',j(r));
}
/* S2 conflits */
{
  const r=await p.evaluate(D=>{ const out={};
    out.deuxJournees=nxplConflitsDuJour(D.iso);
    nxplSetMoment('devis:pl-a','matin'); nxplSetMoment('devis:pl-b','apresmidi'); out.separes=nxplConflitsDuJour(D.iso);
    out.stocke=DEVIS.find(d=>d.id==='pl-a').momentPlanif; out.lu=JSON.parse(localStorage.getItem(LS.devis)).find(d=>d.id==='pl-a').momentPlanif;
    nxplSetMoment('devis:pl-b','matin'); out.deuxMatins=nxplConflitsDuJour(D.iso);
    out.libreApresMidi=nxplConflits(D.iso,'apresmidi','devis:pl-c').length; out.matinPris=nxplConflits(D.iso,'matin','devis:pl-c').map(e=>e.lbl);
    out.refus=nxplSetMoment('devis:pl-a','soir');
    nxplSetMoment('devis:pl-b','apresmidi'); return out; },D);
  rec('Planning','Deux chantiers « Journée » le même jour : conflit signalé',Object.keys(r.deuxJournees).length===2,j(r));
  rec('Planning','Matin + après-midi : pas de conflit ; moment enregistré et sauvegardé',Object.keys(r.separes).length===0&&r.stocke==='matin'&&r.lu==='matin',j(r));
  rec('Planning','Deux matins : conflit ; après-midi libre détecté, matin pris détecté',Object.keys(r.deuxMatins).length===2&&r.libreApresMidi===0&&r.matinPris.length===2,j(r));
  rec('Planning','Moment inconnu refusé',r.refus===false,j(r));
}
/* S3 « Planifier » sur un moment pris : confirmation */
{
  const r=await p.evaluate(D=>{ const out={}; let msg=''; const o=window.confirm;
    window.confirm=m=>{ msg=m; return false; }; planifDevis('pl-c',D.iso); out.refuse=DEVIS.find(d=>d.id==='pl-c').datePlanif; out.msg=msg;
    window.confirm=m=>{ msg=m; return true; }; planifDevis('pl-c',D.iso); out.accepte=DEVIS.find(d=>d.id==='pl-c').datePlanif;
    msg=''; const x=new Date(); x.setDate(x.getDate()+40); const libre=dISO(x); planifDevis('pl-c',libre); out.libre=DEVIS.find(d=>d.id==='pl-c').datePlanif===libre&&msg==='';
    window.confirm=o; return out; },D);
  rec('Planning','Planifier sur un jour déjà pris : question posée, rien d’enregistré si on refuse',r.refuse===''&&/déjà pris/.test(r.msg)&&/Client A/.test(r.msg),j(r));
  rec('Planning','… enregistré si on confirme ; jour libre : aucune question',r.accepte===D.iso&&r.libre===true,j(r));
}
/* S4 demi-journées occupées : dates seulement */
{
  const r=await p.evaluate(D=>{ const x=new Date(); const du=dISO(x); x.setDate(x.getDate()+60); const au=dISO(x);
    const o=nxplOccupations(du,au); return {o,jour:o.find(z=>z.jour===D.iso),du}; },D);
  rec('Planning','Occupations : format {jour, matin, après-midi}, aucun nom ni adresse',r.o.length>0&&r.o.every(z=>Object.keys(z).join()==='jour,matin,apresmidi')&&!/Client|Rue |rue /.test(j(r.o)),j(r.o.slice(0,3)));
  rec('Planning','Occupations : le jour des chantiers A (matin) et B (après-midi) = journée prise',r.jour&&r.jour.matin&&r.jour.apresmidi,j(r.jour));
  rec('Planning','Occupations : rien avant aujourd’hui',r.o.every(z=>z.jour>=r.du),j(r.o.map(z=>z.jour)));
}
/* S5 envoi vers Supabase (simulé), une seule fois tant que rien ne change ; migration absente = envoi coupé sans erreur */
{
  const r=await p.evaluate(async()=>{ const out={appels:[]}; const s0=sb, e0=SESS; localStorage.removeItem('cpnext_busy_envoye');
    sb={rpc:(n,a)=>{ out.appels.push({n,a}); return Promise.resolve({data:a.p_jours.length,error:null}); }}; SESS={user:{id:'u-test'}};
    out.v1=await nxplEnvoyer(false); out.v2=await nxplEnvoyer(false);
    nxplSetMoment('devis:pl-b','matin'); out.v3=await nxplEnvoyer(false); nxplSetMoment('devis:pl-b','apresmidi');
    sb={rpc:()=>Promise.resolve({data:null,error:{code:'PGRST202',message:'Could not find the function public.cp_busy_appli'}})}; out.v4=await nxplEnvoyer(true); out.coupe=_nxplEtat.envoi.coupe; out.v5=await nxplEnvoyer(true);
    _nxplEtat.envoi.coupe=false; sb=s0; SESS=e0; nxplSetMoment('devis:pl-a','matin');
    out.sansCloud=await nxplEnvoyer(true);
    return {v1:out.v1,v2:out.v2,v3:out.v3,v4:out.v4,coupe:out.coupe,v5:out.v5,sansCloud:out.sansCloud,n:out.appels.length,nom:out.appels[0]&&out.appels[0].n,args:out.appels[0]&&{du:out.appels[0].a.p_du,au:out.appels[0].a.p_au,nb:out.appels[0].a.p_jours.length},brut:JSON.stringify(out.appels)}; });
  rec('Planning','Envoi : cp_busy_appli sur 60 jours, puis rien tant que le planning ne change pas',r.v1===true&&r.v2===false&&r.nom==='cp_busy_appli'&&r.args.nb>0,j(r));
  rec('Planning','Envoi : renvoyé après un changement de moment',r.v3===true&&r.n===2,j(r));
  rec('Planning','Envoi : aucun nom de client ni adresse dans ce qui part',!/Client A|Client B|Rue|rue /.test(r.brut),r.brut.slice(0,200));
  rec('Planning','Migration pas encore appliquée : envoi coupé sans erreur ; sans connexion : rien',r.v4===null&&r.coupe===true&&r.v5===null&&r.sansCloud===null,j(r));
}
/* S6 moments pris dans Google Agenda */
{
  const r=await p.evaluate(async D=>{ const s0=sb, e0=SESS; const out={};
    const chaine=rows=>{ const q={select:()=>q,eq:()=>q,gte:()=>q,lte:()=>q,then:(ok,ko)=>Promise.resolve({data:rows,error:null}).then(ok,ko)}; return q; };
    const x=new Date(); x.setDate(x.getDate()+9); const gj=dISO(x);
    sb={from:t=>chaine(t==='climpilot_busy'?[{jour:gj,matin:true,apresmidi:false}]:[])}; SESS={user:{id:'u-test'}};
    out.charge=await nxplChargerGoogle(dISO(new Date()),D.iso.slice(0,8)+'31',true);
    out.c=nxplConflits(gj,'matin','x').map(e=>e.lbl); out.apm=nxplConflits(gj,'apresmidi','x').length;
    let msg=''; const o=window.confirm; window.confirm=m=>{ msg=m; return false; }; planifDevis('pl-c',gj); window.confirm=o;
    out.msg=msg; out.refuse=DEVIS.find(d=>d.id==='pl-c').datePlanif!==gj;
    out.occ=nxplOccupations(gj,gj); sb=s0; SESS=e0; return out; },D);
  rec('Planning','Google Agenda : matin pris compté dans les conflits, après-midi libre',r.charge===true&&r.c.includes('Agenda Google')&&r.apm===0,j(r));
  rec('Planning','Google Agenda : « Planifier » prévient aussi pour un moment pris dans Google',/Agenda Google/.test(r.msg)&&r.refuse,j(r));
  rec('Planning','Google Agenda : jamais renvoyé comme occupation de ClimPilot (pas de boucle)',r.occ.length===0,j(r.occ));
}
/* S7 écran Planning */
{
  const r=await p.evaluate(async D=>{ go('plan'); const x=new Date(D.iso+'T12:00:00');
    const lun=d=>{ const y=new Date(d); y.setDate(y.getDate()-((y.getDay()+6)%7)); y.setHours(0,0,0,0); return y; };
    planOff=Math.round((lun(x)-lun(new Date()))/(7*864e5)); renderPlanning(); await new Promise(z=>setTimeout(z,300));
    const g=document.getElementById('planGrid'); const b=[...g.querySelectorAll('[data-k="devis:pl-a"] .nxpl-m')];
    const avant=b[0]&&b[0].textContent; if(b[0]) b[0].click(); await new Promise(z=>setTimeout(z,200));
    const apres=(g.querySelector('[data-k="devis:pl-a"] .nxpl-m')||{}).textContent;
    const conflit=g.querySelectorAll('.nxpl-conflit').length;
    const ouvert=document.querySelector('#v-devis.on, .modal.on, #devisModal[open]')?true:false;
    planOff=0; renderPlanning(); return {nb:b.length,avant,apres,conflit,stocke:DEVIS.find(d=>d.id==='pl-a').momentPlanif,ouvert}; },D);
  rec('Planning','Écran : bouton de moment sur chaque intervention, un clic passe Matin → Après-midi',r.nb===1&&r.avant==='Matin'&&r.apres==='Après-midi'&&r.stocke==='apresmidi',j(r));
  rec('Planning','Écran : chevauchement signalé en rouge (A passé l’après-midi, comme B)',r.conflit>=2,j(r));
}
/* captures pour relecture humaine (PC puis largeur téléphone) */
{
  const voir=async (fichier)=>{ await p.evaluate(D=>{ const lun=d=>{ const y=new Date(d); y.setDate(y.getDate()-((y.getDay()+6)%7)); y.setHours(0,0,0,0); return y; };
    go('plan'); planOff=Math.round((lun(new Date(D.iso+'T12:00:00'))-lun(new Date()))/(7*864e5)); renderPlanning(); },D);
    await p.waitForTimeout(400); const g=await p.$('#planGrid'); if(g) await g.screenshot({path:out(fichier)}); };
  await voir('suiteS-planning-pc.png'); await p.setViewportSize({width:390,height:844}); await voir('suiteS-planning-telephone.png');
  await p.setViewportSize({width:1300,height:900}); await p.evaluate(()=>{ planOff=0; renderPlanning(); });
}
rec('Planning','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await ctx.close();
await closeBrowser();
ecrireResultats('resS.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
