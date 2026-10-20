import { ecrireResultats, out } from './env.mjs';
// Suite T — messages (next-messages.js) et terrain (next-terrain.js), 20/10/2026 : veille, entretien sous contrat,
// confirmation de créneau, compte SMS, exclusion d'un client ; tournée du jour, pointage, alerte matériel,
// demande du site → intervention, suivi d'acompte → créneau ferme.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
const j=o=>JSON.stringify(o);

const {p,ctx,errs}=await page({mobile:false});
await seed(p);
await p.waitForFunction(()=>typeof window.nxmsgCandidats==='function'&&typeof window.nxtrTournee==='function'&&window.nxjAjouts&&window.nxjAjouts.length>=4,null,{timeout:15000});
/* jeu : un chantier demain matin (client avec tel+mail), un dépannage demain après-midi, un contrat dont la visite est dans 10 jours, un chantier accepté dans 3 jours sans matériel réservé */
const D=await p.evaluate(()=>{
  const d1=new Date(); d1.setDate(d1.getDate()+1); const demain=dISO(d1); const d3=new Date(); d3.setDate(d3.getDate()+3); const j3=dISO(d3); const d10=new Date(); d10.setDate(d10.getDate()+10); const j10=dISO(d10);
  const base=DEVIS.find(d=>d.statut==='accepte');
  const mk=(id,nom,date,extra)=>{ const d=JSON.parse(JSON.stringify(base)); d.id=id; d.cNom=nom; d.cTel='06 12 34 56 78'; d.cMail='client@exemple.org'; d.datePlanif=date; d.momentPlanif='matin'; delete d.matReserve; Object.assign(d,extra||{}); return d; };
  DEVIS.push(mk('t-a','Mme Veille',demain)); const baseM=DEVIS.find(d=>d.statut==='accepte'&&compute(d).mat.length>0)||base; const c=JSON.parse(JSON.stringify(baseM)); c.id='t-c'; c.cNom='M. Materiel'; c.datePlanif=j3; c.momentPlanif='apresmidi'; delete c.matReserve; DEVIS.push(c); DEVIS.forEach(d=>{ if(d.statut==='accepte'&&d.id!=='t-c') d.matReserve=Date.now(); }); save(LS.devis,DEVIS);
  DEP.push({id:'t-dep',created:Date.now(),date:demain,statut:'brouillon',facNum:'',facDate:null,payeLe:null,itype:'dep',cNom:'Boulangerie Demain',cTel:'0611223344',cMail:'',cType:'Professionnel',cAdr:'5 Rue de la Gare',cVille:'60600 Clermont',desc:'Vitrine qui givre',notes:'',mode:'forfaitH',panne:'',heures:1,rateChoice:'75',rateCustom:75,zone:'0-10 km',maj:'0',pieces:[],moment:'apresmidi'}); save(LS.dep,DEP);
  CTR.push({id:'t-ctr',clientNom:'Boulangerie Dupré',type:'Clim',prix:180,visites:1,prochaineVisite:j10,actif:true}); save('cp2_contrats',CTR);
  localStorage.removeItem('cpnext_msgs'); localStorage.removeItem('cpnext_pointage'); localStorage.removeItem('cpnext_pointages');
  return {demain,j3,j10,vendredi:new Date().getDay()===5,samedi:new Date().getDay()===6};
});

/* T1 messages : candidats */
{
  const r=await p.evaluate(()=>{ const C=nxmsgCandidats(); return {v:C.veille.map(x=>({nom:x.nom,tel:x.tel,mail:x.mail,txt:x.txt,deja:!!x.deja})),e:C.entretien.map(x=>({nom:x.nom,retard:x.retard,txt:x.txt,tel:x.tel})),c:C.confirm.length}; });
  const va=r.v.find(x=>x.nom==='Mme Veille'), vd=r.v.find(x=>x.nom==='Boulangerie Demain');
  rec('Messages','Veille : un message par intervention de demain, avec moment et coordonnées du client',!!va&&!!vd&&/demain matin/.test(va.txt)&&/demain après-midi/.test(vd.txt)&&va.tel==='0612345678'&&va.mail==='client@exemple.org'&&vd.tel==='0611223344'&&!vd.mail,j(r.v));
  rec('Messages','Veille : signature = nom de l’entreprise + téléphone, texte en 1 SMS',!!va&&va.txt.length>40&&/Un empêchement/.test(va.txt),j(va));
  const e=r.e.find(x=>x.nom==='Boulangerie Dupré');
  rec('Messages','Entretien : client sous contrat dont la visite approche, téléphone pris sur la fiche client',!!e&&!e.retard&&/contrat d'entretien Clim/.test(e.txt)&&e.tel==='0611223344',j(r.e));
  rec('Messages','Entretien : seulement les contrats (pas de prospection)',r.e.length===1,j(r.e));
  rec('Messages','Confirmation : rien tant qu’aucun créneau du site n’est planifié',r.c===0,r.c);
}
/* T2 compte SMS */
{
  const r=await p.evaluate(()=>({a:nxmsgSms('Bonjour, je passe demain matin. Gabriel Leroy 06 00 00 00 00'),b:nxmsgSms('Bonjour, reçu, à bientôt ! Ça marche.'),c:nxmsgSms('x'.repeat(161)),d:nxmsgGsm('Ça marche — l’œuvre… ô'),e:nxmsgSms('Prix : 50 €')}));
  rec('Messages','SMS : texte simple = 1 SMS GSM, 161 caractères = 2 SMS',r.a.gsm&&r.a.segments===1&&r.c.segments===2,j(r));
  rec('Messages','SMS : « Ç » et « ç » font basculer en 70 caractères ; version simple sans accent spécial',r.b.gsm===false&&r.b.max===70&&r.d==='Ça marche - l\'oeuvre... o',j(r));
  rec('Messages','SMS : « € » compte double',r.e.len===12,j(r.e));
}
/* T3 envoi noté, exclusion */
{
  const r=await p.evaluate(async()=>{ const urls=[]; const o=window.nxavisOuvrir; window.nxavisOuvrir=u=>urls.push(u);
    const C=nxmsgCandidats(); const va=C.veille.find(x=>x.nom==='Mme Veille'), vd=C.veille.find(x=>x.nom==='Boulangerie Demain');
    const ok1=nxmsgSmsEnvoyer(va.id); const ok2=nxmsgMailEnvoyer(vd.id); const ok3=nxmsgMailEnvoyer(va.id);
    const C2=nxmsgCandidats(); const va2=C2.veille.find(x=>x.nom==='Mme Veille'), vd2=C2.veille.find(x=>x.nom==='Boulangerie Demain');
    nxmsgExclure('Boulangerie Dupré'); const C3=nxmsgCandidats(); const journal=JSON.parse(localStorage.getItem('cpnext_msgs')||'[]');
    nxmsgReinclure('Boulangerie Dupré'); const C4=nxmsgCandidats(); window.nxavisOuvrir=o;
    return {ok1,ok2,ok3,urls,deja:va2.deja&&va2.deja.canal,vdDeja:!!vd2.deja,exclu:C3.entretien.length,reinclu:C4.entretien.length,journal:journal.map(x=>x.kind+':'+x.canal)}; });
  rec('Messages','SMS envoyé : lien sms: avec le numéro et le texte, envoi noté (canal sms) ; mail refusé sans e-mail',r.ok1===true&&r.ok3===true&&r.ok2===false&&r.urls.length===2&&/^sms:0612345678\?&body=/.test(r.urls[0])&&r.deja==='mail',j(r));
  rec('Messages','Exclusion d’un client : plus de message pour lui, réinclusion possible, journal synchronisé',r.exclu===0&&r.reinclu===1&&r.journal.includes('veille:mail')&&r.vdDeja===false,j(r));
  const sync=await p.evaluate(()=>SYNC_KEYS.indexOf('cpnext_msgs')>=0&&SYNC_KEYS.indexOf('cpnext_pointages')>=0);
  rec('Messages','Journal des messages et pointages dans les clés synchronisées',sync===true,sync);
}
/* T4 Ma journée : cartes */
{
  const r=await p.evaluate(async()=>{ go('nx_journee'); nxjMode('soir'); await new Promise(z=>setTimeout(z,300)); const h=document.getElementById('nxJournee');
    const msg=h.querySelector('#nxMessages'); const rows=msg?[...msg.querySelectorAll('.nxm-row')].map(x=>x.textContent.slice(0,40)):[];
    const ordre=[...h.querySelectorAll('.card')].map(c=>c.id).filter(Boolean);
    return {msg:!!msg,rows,ordre,byeLast:(()=>{ const k=[...h.children]; const b=k.findIndex(x=>x.className==='nxj-bye'); const m=k.findIndex(x=>x.id==='nxMessages'); return b>m&&m>=0; })()}; });
  rec('Terrain','Ma journée (soir) : carte Messages présente, « Tu peux décrocher » reste en dernier',r.msg&&r.rows.length>=1&&r.byeLast,j(r));
}
/* T5 tournée du jour + pointage (on déplace deux interventions à aujourd'hui) */
{
  const r=await p.evaluate(async()=>{ const t=dISO(new Date());
    const a=DEVIS.find(d=>d.id==='t-a'); a.datePlanif=t; a.momentPlanif='apresmidi'; a.cAdr='2 rue de l\'Église'; a.cVille='60100 Creil'; save(LS.devis,DEVIS);
    const x=DEP.find(d=>d.id==='t-dep'); x.date=t; x.moment='matin'; save(LS.dep,DEP);
    localStorage.setItem('cpnext_geo',JSON.stringify({[nxadTest.key('5 Rue de la Gare, 60600 Clermont')]:{lon:2.41,lat:49.38,label:'x'},[nxadTest.key('2 rue de l\'Église, 60100 Creil')]:{lon:2.47,lat:49.26,label:'y'}}));
    const T=nxtrTournee(t); go('nx_journee'); nxjMode('matin'); await new Promise(z=>setTimeout(z,300));
    const card=document.getElementById('nxTournee'); const stops=card?[...card.querySelectorAll('.nxt-stop .nxt-main b')].map(b=>b.textContent):[];
    const btn=card&&card.querySelector('.nxt-stop button'); const url=card&&card.querySelector('a[href*="waypoints="]');
    return {ordre:T.stops.map(s=>s.lbl+'|'+s.m),km:T.km,home:T.home,h:nxadHome(),stops,btn:btn&&btn.textContent,url:url&&url.getAttribute('href'),turl:T.url}; });
  rec('Terrain','Tournée : matin d’abord, après-midi en dernier, km estimés depuis le point de départ, itinéraire complet avec étapes',r.ordre.length>=2&&/matin$/.test(r.ordre[0])&&/apresmidi$/.test(r.ordre[r.ordre.length-1])&&r.ordre.slice(1,-1).every(x=>/journee$/.test(x))&&r.km>0&&/waypoints=/.test(r.url||'')&&/origin=/.test(r.url||''),j({h:r.h,url:r.url,turl:r.turl}));
  rec('Terrain','Tournée : carte dans Ma journée (matin), bouton « Commencer »',r.stops.length===r.ordre.length&&/Commencer/.test(r.btn||''),j(r));
  const q=await p.evaluate(async()=>{ const k='dep:t-dep'; const ok=nxtrPointer(k); const dbl=nxtrPointer('devis:t-a');
    const p0=JSON.parse(localStorage.getItem('cpnext_pointage')); p0.debut=Date.now()-95*60000; localStorage.setItem('cpnext_pointage',JSON.stringify(p0));
    const h=nxtrTerminer(k); const x=DEP.find(d=>d.id==='t-dep'); const L=JSON.parse(localStorage.getItem('cpnext_pointages')||'[]');
    nxtrPointer('devis:t-a'); const p1=JSON.parse(localStorage.getItem('cpnext_pointage')); p1.debut=Date.now()-7*60000; localStorage.setItem('cpnext_pointage',JSON.stringify(p1)); const h2=nxtrTerminer('devis:t-a'); const a=DEVIS.find(d=>d.id==='t-a');
    return {ok,dbl,h,hReel:x.hReel,n:L.length,h2,aReel:a.hReel,encours:localStorage.getItem('cpnext_pointage')}; });
  rec('Terrain','Pointage : un seul à la fois ; 95 min → 1,5 h ajoutée au réel de l’intervention ; journal',q.ok===true&&q.dbl===false&&q.h===1.5&&q.hReel==='1.5'&&q.n>=1,j(q));
  rec('Terrain','Pointage : minimum un quart d’heure, ajouté au réel du devis, plus rien en cours',q.h2===0.25&&q.aReel==='0.25'&&q.encours==='null',j(q));
}
/* T6 alerte matériel */
{
  const r=await p.evaluate(async()=>{ const A=nxtrAlertesMateriel(); const avant=A.map(a=>a.nom); nxtrMaterielOk('t-c'); const A2=nxtrAlertesMateriel(); const d=DEVIS.find(x=>x.id==='t-c');
    const far=DEVIS.find(x=>x.id==='t-a'); return {avant,apres:A2.map(a=>a.nom),reserve:!!d.matReserve}; });
  rec('Terrain','Matériel : chantier accepté dans 3 jours sans matériel réservé signalé ; « Réservé » le retire',r.avant.includes('M. Materiel')&&!r.apres.includes('M. Materiel')&&r.reserve,j(r));
}
/* T7 demande du site → intervention → acompte → créneau ferme → message de confirmation */
{
  const r=await p.evaluate(async()=>{ const d7=new Date(); d7.setDate(d7.getDate()+7); const jour=dISO(d7);
    const row={id:'inbox-essai-1',created_at:new Date().toISOString(),kind:'message',statut:'a_valider',source:'site',titre:'Site · Réservation',payload:{type:'site_reservation',champs:{nom:'Client Site',telephone:'06 00 00 00 00',email:'site@exemple.org',prestation:'Entretien clim (forfait 110 €)',jour:jour,moment:'Matin',adresse:'1 rue du Site',commune:'Clermont',equipement:'Monosplit',marque:'Daikin',acompte:'33 € à régler après confirmation du créneau',cgv:'Oui',profil:'home'},meta:{rid:'essai-x',recu:new Date().toISOString()}}};
    const traites=[]; const o1=window.nxaSiteLigne, o2=window.nxaSiteTraite; window.nxaSiteLigne=()=>JSON.parse(JSON.stringify(row)); window.nxaSiteTraite=id=>{ traites.push(id); return Promise.resolve(); };
    const n0=DEP.length; const id=nxtrPlanifierSite('inbox-essai-1'); const x=DEP.find(d=>d.id===id);
    const C=nxmsgCandidats(); const cf=C.confirm[0]; const A=nxtrAcomptes();
    const o3=window.askMode; window.askMode=()=>'Virement'; const recu=nxtrAcompteRecu(id); window.askMode=o3;
    const A2=nxtrAcomptes(); const C2=nxmsgCandidats(); const cf2=C2.confirm[0];
    go('plan'); const lun=d=>{ const y=new Date(d); y.setDate(y.getDate()-((y.getDay()+6)%7)); y.setHours(0,0,0,0); return y; }; planOff=Math.round((lun(new Date(jour+'T12:00:00'))-lun(new Date()))/(7*864e5)); renderPlanning(); await new Promise(z=>setTimeout(z,300));
    const ac=document.querySelector('[data-k="dep:'+id+'"] .nxt-ac'); planOff=0; renderPlanning();
    window.nxaSiteLigne=o1; window.nxaSiteTraite=o2; const cl=CLIENTS.find(c=>c.nom==='Client Site');
    return {cree:DEP.length===n0+1,x:x&&{date:x.date,moment:x.moment,cNom:x.cNom,cTel:x.cTel,desc:x.desc,acompte:x.acompte,itype:x.itype,cType:x.cType},traites,cf:cf&&{nom:cf.nom,txt:cf.txt,tel:cf.tel},A:A.map(a=>({recu:a.recu,montant:a.montant})),recu,A2:A2.map(a=>a.recu),cf2:cf2&&cf2.txt,planning:ac&&ac.textContent,client:!!cl}; });
  rec('Terrain','Demande du site → intervention : jour, moment, client, prestation, acompte 33 € ; demande marquée traitée ; fiche client créée',r.cree&&r.x&&r.x.moment==='matin'&&r.x.cNom==='Client Site'&&r.x.cTel==='06 00 00 00 00'&&/Entretien clim/.test(r.x.desc)&&r.x.acompte.montant===33&&r.x.itype==='dep'&&r.x.cType==='Particulier'&&r.traites.length===1&&r.client,j(r.x)+' '+j(r.traites));
  rec('Terrain','Message de confirmation prêt : créneau, prestation, acompte, annulation gratuite 24 h',!!r.cf&&/est confirmé/.test(r.cf.txt)&&/Acompte de 33 €/.test(r.cf.txt)&&/24 h/.test(r.cf.txt)&&r.cf.tel==='0600000000',j(r.cf));
  rec('Terrain','Acompte : attendu puis « Reçu » (mode demandé) → créneau ferme, visible au planning ; le message ne réclame plus l’acompte',r.A.length===1&&r.A[0].recu===false&&r.recu===true&&r.A2[0]===true&&/ferme/.test(r.planning||'')&&!/Acompte de/.test(r.cf2||''),j({A:r.A,A2:r.A2,planning:r.planning,cf2:r.cf2}));
}
/* T8 site : visite gratuite → pas d'acompte ; demande sans jour refusée */
{
  const r=await p.evaluate(()=>{ const o1=window.nxaSiteLigne, o2=window.nxaSiteTraite; window.nxaSiteTraite=()=>Promise.resolve();
    const d9=new Date(); d9.setDate(d9.getDate()+9); const jour=dISO(d9);
    window.nxaSiteLigne=()=>({id:'i2',payload:{type:'site_reservation',champs:{nom:'Visite Site',telephone:'0600000001',prestation:'Visite technique (gratuite)',jour:jour,moment:'Après-midi',commune:'Creil'},meta:{}}});
    const id=nxtrPlanifierSite('i2'); const x=DEP.find(d=>d.id===id);
    window.nxaSiteLigne=()=>({id:'i3',payload:{type:'site_reservation',champs:{nom:'Sans Jour',prestation:'Diagnostic'},meta:{}}}); const n=DEP.length; const id3=nxtrPlanifierSite('i3');
    window.nxaSiteLigne=o1; window.nxaSiteTraite=o2; return {acompte:x&&x.acompte,moment:x&&x.moment,id3,n:DEP.length===n}; });
  rec('Terrain','Visite gratuite : pas d’acompte ; demande sans jour : rien n’est créé',r.acompte===null&&r.moment==='apresmidi'&&r.id3===null&&r.n,j(r));
}
/* captures */
{
  await p.evaluate(async()=>{ document.querySelectorAll('.toast,.nx-toast,#toast,[class*=toast]').forEach(t=>t.remove()); go('nx_journee'); nxjMode('matin'); }); await p.waitForTimeout(400);
  const h=await p.$('#nxJournee'); if(h) await h.screenshot({path:out('suiteT-journee-matin.png')});
  await p.evaluate(()=>nxjMode('soir')); await p.waitForTimeout(300); const h2=await p.$('#nxJournee'); if(h2) await h2.screenshot({path:out('suiteT-journee-soir.png')});
  await p.setViewportSize({width:390,height:844}); await p.evaluate(()=>nxjMode('matin')); await p.waitForTimeout(300); const h3=await p.$('#nxJournee'); if(h3) await h3.screenshot({path:out('suiteT-journee-telephone.png')});
}
rec('Terrain','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await ctx.close();
await closeBrowser();
ecrireResultats('resT.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
