import { ecrireResultats, out } from './env.mjs';
// Suite R — fiabilité (19/10/2026) : boîte de réception (demandes déposées par le site), encaissement annulé,
// export complet hors Supabase. Serveur Supabase SIMULÉ (tests/serveur-simule.mjs), aucune connexion réelle.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import { SERVEUR } from './serveur-simule.mjs';
import fs from 'fs';

const SESSION=`(function(){ window.SESS={user:{id:'u1',email:'test@test'}}; })();`;
const REEL=`(function(){ window.SESS={user:{id:'u1',email:'test@test'}}; localStorage.setItem('cp2_facturation',JSON.stringify({debut:todayISO(),decideLe:'test',anciens:{},renommes:{},v:1})); Object.assign(P.entreprise,{nom:'Gabriel Leroy',siret:'12345678900012',adresse:"1 rue de l'Exemple",cp:'60000',ville:'Beauvais',natureChantier:'S',assurance:'Assureur Test n° 0001',assuranceZone:'France métropolitaine'}); })();`;
const close=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;
const wait=(p,ms)=>p.waitForTimeout(ms);
const j=o=>JSON.stringify(o);
const IDS=['aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000005'];

/* R1 — boîte de réception : 500 lignes, demandes du site (3 types), échappement, Traité / Écarter */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await p.evaluate(SERVEUR); await p.evaluate(SESSION);
  await p.evaluate(ids=>{ const now=Date.now(), iso=ms=>new Date(ms).toISOString(), S=__srv;
    /* une semaine chargée : 300 demandes déjà traitées (les plus anciennes), 197 encore à valider, puis 3 nouvelles */
    for(let i=0;i<300;i++){ const t=now-6.5*86400000+i*60000; S.inbox.push(S.ligneSite('demande',{created_at:iso(t),statut:i%5?'valide':'rejete',traite_at:iso(t+3600000)})); }
    for(let i=0;i<197;i++){ const t=now-3*86400000+i*60000; S.inbox.push(S.ligneSite(i%2?'reservation':'demande',{created_at:iso(t)})); }
    const piege='Fuite " onmouseover="window.__xss=1" <img src=x onerror="window.__xss=2"> javascript:window.__xss=3';
    S.inbox.push(S.ligneSite('demande',{id:ids[0],created_at:iso(now-120000),rappeler_avant:'2020-01-06',
      champs:{description:piege,nom:'Client "piège" <b>gras</b>',email:'javascript:alert(1)@x.fr',telephone:'06 12 34 56 78'}}));
    S.inbox.push(S.ligneSite('reservation',{id:ids[1],created_at:iso(now-60000)}));
    S.inbox.push(S.ligneSite('retractation',{id:ids[2],created_at:iso(now-30000)}));
    /* ligne abîmée : a_verifier n'est pas une liste */
    S.inbox.push({id:ids[3],user_id:'u1',created_at:iso(now-200000),kind:'devis',statut:'a_valider',source:'agent',titre:'Proposition abîmée',resume:null,dictee:null,payload:{a_verifier:'pas une liste'}});
    /* message préparé par l'assistant (pas le site) : affichage d'avant */
    S.inbox.push({id:ids[4],user_id:'u1',created_at:iso(now-300000),kind:'message',statut:'a_valider',source:'agent',titre:'Message pour M. Test',resume:'Relance',dictee:null,payload:{canal:'mail',destinataire:'M. Test',email:'test@exemple.fr',objet:'Votre devis',corps:'Bonjour, voici votre devis.'}});
  },IDS);
  await p.evaluate(async()=>{ go('nx_assist'); await nxaRefresh(); });
  await wait(p,300);
  const r=await p.evaluate(ids=>{
    const L=document.getElementById('nxaLists')||document.body, A=document.getElementById('nxaAValider');
    const carte=id=>document.querySelector('#nxaLists [data-id="'+id+'"]');
    const c1=carte(ids[0]), c2=carte(ids[1]), c3=carte(ids[2]), c4=carte(ids[3]), c5=carte(ids[4]);
    const cartes=A?[...A.querySelectorAll('.nxa-card')]:[];
    const tel=c1&&c1.querySelector('a[href^="tel:"]'), mail=c1&&c1.querySelector('a[href^="mailto:"]');
    const attrs=[...L.querySelectorAll('*')].some(e=>[...e.attributes].some(a=>/^on/i.test(a.name)&&/__xss/.test(a.value)));
    const ta=c5&&c5.querySelector('textarea');
    return { badge:(document.getElementById('nxaBadge')||{}).textContent, nCartes:cartes.length, premier:cartes[0]&&cartes[0].getAttribute('data-id'),
      txtA:A?A.innerText:'', c1:c1?c1.innerText:null, c2:c2?c2.innerText:null, c3:c3?c3.innerText:null, c4:!!c4, c5:ta?ta.value:null,
      rappelDep:!!(c1&&c1.querySelector('.nxa-rappel.depasse')), bloque:!!(c1&&c1.querySelector('.nxa-bloque')),
      tel:tel&&tel.getAttribute('href'), mail:mail&&mail.getAttribute('href'), liens:[...L.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),
      attrs, img:L.querySelectorAll('img').length, xss:window.__xss||null, boutons:c1?[...c1.querySelectorAll('button')].map(b=>b.textContent.trim()):[] };
  },IDS);
  const court={...r,liens:r.liens.length,txtA:(r.txtA||'').slice(0,120),c1:(r.c1||'').slice(0,400)};
  rec('Boîte de réception','500 lignes en base : les 3 nouvelles demandes du site sont visibles',!!(r.c1&&r.c2&&r.c3),j(court));
  rec('Boîte de réception','Plus récentes d\'abord',r.premier===IDS[2],j(court));
  rec('Boîte de réception','Badge = nombre exact à valider (202) ; 100 affichées, les autres signalées',r.badge==='202'&&r.nCartes===100&&/102 /.test(r.txtA),j(court));
  rec('Boîte de réception','Demande du site : champs du formulaire avec libellés lisibles',!!r.c1&&['Téléphone','06 12 34 56 78','Commune','Creil','Code erreur ou symptôme','Professionnel','Panne'].every(s=>r.c1.indexOf(s)>=0),j(court));
  rec('Boîte de réception','Réservation et rétractation : leurs champs aussi',!!(r.c2&&r.c3)&&/Jour souhaité/.test(r.c2)&&/Mardi 27 octobre/.test(r.c2)&&/Adresse/.test(r.c2)&&/Date de la réservation ou du contrat/.test(r.c3)&&/Je me rétracte/.test(r.c3),j({c2:r.c2,c3:r.c3}));
  rec('Boîte de réception','« À rappeler avant le … » en évidence quand le délai est dépassé',r.rappelDep&&/À rappeler avant le/.test(r.c1||''),j(court));
  rec('Boîte de réception','« ACTIVITÉ BLOQUÉE » visible',r.bloque&&/ACTIVITÉ BLOQUÉE/.test(r.c1||''),j(court));
  rec('Boîte de réception','Échappement : texte piégé affiché tel quel, aucun attribut ni balise injecté',!r.attrs&&r.img===0&&!r.xss&&/onmouseover/.test(r.c1||'')&&(r.c1||'').indexOf('<b>gras</b>')>=0,j(court));
  rec('Boîte de réception','Liens à schéma fixe (tel:, mailto:) et valeurs encodées',r.tel==='tel:'+encodeURIComponent('0612345678')&&!!r.mail&&r.mail.indexOf('mailto:'+encodeURIComponent('javascript:alert(1)@x.fr'))===0&&r.liens.length>0&&r.liens.every(h=>/^(tel|mailto):/.test(h)),j({tel:r.tel,mail:r.mail,autres:r.liens.filter(h=>!/^(tel|mailto):/.test(h)).slice(0,5)}));
  rec('Boîte de réception','Ligne abîmée (a_verifier n\'est pas une liste) : la liste s\'affiche quand même',r.c4,j(court));
  rec('Boîte de réception','Message préparé par l\'assistant : affichage d\'avant (zone de texte)',r.c5==='Bonjour, voici votre devis.',j({c5:r.c5}));
  rec('Boîte de réception','Demande du site : boutons « Traité » et « Écarter »',r.boutons.some(b=>/Traité/.test(b))&&r.boutons.some(b=>/Écarter/.test(b)),j(r.boutons));
  const r2=await p.evaluate(async ids=>{
    if(typeof window.nxaSiteTraite!=='function') return {absent:true};
    await nxaSiteTraite(ids[0]); await new Promise(r=>setTimeout(r,200));
    window.confirm=()=>true; nxaReject(ids[1]); await new Promise(r=>setTimeout(r,400));
    const row=__srv.inbox.find(x=>x.id===ids[0]), row2=__srv.inbox.find(x=>x.id===ids[1]);
    const A=document.getElementById('nxaAValider'), T=document.getElementById('nxaTraites'), l=T?[...T.querySelectorAll('.recap-line')]:[];
    return {st:row.statut,tr:!!row.traite_at,st2:row2.statut,encore:!!(A&&A.querySelector('[data-id="'+ids[0]+'"]')),dansT:!!(T&&T.querySelector('[data-id="'+ids[0]+'"]')),
      nT:l.length,premierT:l[0]&&l[0].getAttribute('data-id'),badge:(document.getElementById('nxaBadge')||{}).textContent};
  },IDS);
  rec('Boîte de réception','« Traité » : statut valide + date de traitement, la demande quitte « À valider »',r2.st==='valide'&&r2.tr&&!r2.encore&&r2.badge==='200',j(r2));
  rec('Boîte de réception','« Écarter » : statut rejete',r2.st2==='rejete',j(r2));
  rec('Boîte de réception','Liste « Traité » : 25 lignes au plus, la plus récente en tête',r2.nT>0&&r2.nT<=25&&r2.premierT===IDS[1]&&r2.dansT,j(r2));
  const r3=await p.evaluate(async()=>{ __srv.fail.climpilot_inbox=true; await nxaRefresh(); const t=(document.getElementById('nxaState')||{}).innerText||''; __srv.fail.climpilot_inbox=false; return t; });
  rec('Boîte de réception','Serveur en erreur : message « injoignable » et bouton Réessayer',/injoignable/i.test(r3)&&/Réessayer/.test(r3),r3);
  rec('Boîte de réception','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
  await ctx.close();
}

await closeBrowser();
ecrireResultats('resR.json',RES);
RES.forEach(x=>console.log(x.ok.padEnd(5),'['+x.group+']',x.name,x.ok==='PASS'?'':'— '+x.detail));
