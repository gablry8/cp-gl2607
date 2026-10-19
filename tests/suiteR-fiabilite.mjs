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

/* R2 — encaissement : « Annuler » sur le mode de règlement n'enregistre rien ; « Annuler l'encaissement » avec trace */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p);
  const r=await p.evaluate(async c=>{
    const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); await facturerDevis(d.id,'solde'); eval(c);
    const f=()=>DEVIS.find(x=>x.id===d.id).facSolde, num=f()&&f().num, livre=n=>allRecettes().some(x=>x.num===n);
    window.prompt=()=>null; payerFacture('devis',d.id,'solde');
    const annule={paye:f().payeLe||null,livre:livre(num)};
    window.prompt=()=>'Chèque'; payerFacture('devis',d.id,'solde');
    const paye={paye:f().payeLe||null,mode:f().mode,livre:livre(num)};
    cur=DEVIS.find(x=>x.id===d.id); renderFBloc(); const bouton=!!document.querySelector('#fBloc [onclick*="annulerEncaissement"]');
    const fn=typeof window.annulerEncaissement==='function'; if(fn) annulerEncaissement('devis',d.id,'solde');
    const apres={paye:f().payeLe||null,trace:f().encaissementsAnnules||null,livre:livre(num)};
    /* location */
    LOC.push({id:'locR',cNom:'Location test',cType:'Professionnel',items:[],fac:{num:'TEST-F-2099-001',date:todayISO(),montant:100,payeLe:null,mode:''}}); save(LS.loc,LOC);
    window.prompt=()=>null; payerFacture('loc','locR',''); const l1=LOC.find(x=>x.id==='locR').fac.payeLe||null;
    window.prompt=()=>'Espèces'; payerFacture('loc','locR',''); const l2=LOC.find(x=>x.id==='locR').fac.payeLe||null;
    if(fn) annulerEncaissement('loc','locR',''); const lf=LOC.find(x=>x.id==='locR').fac;
    /* intervention : bascule existante (sans question), trace gardée */
    newDep('dep'); await new Promise(r=>setTimeout(r,50));
    Object.assign(curDep,{cNom:'Intervention test',cType:'Professionnel',desc:'Dépannage test',heures:1}); loadDepForm(); await factureDep(); eval(c);
    const idD=curDep.id;
    window.prompt=()=>null; payDep(idD); const d1=DEP.find(x=>x.id===idD).statut;
    window.prompt=()=>'CB'; payDep(idD); const d2=DEP.find(x=>x.id===idD).statut;
    payDep(idD); const dx=DEP.find(x=>x.id===idD);
    return {num,annule,paye,bouton,fn,apres,l1,l2,lf:{paye:lf.payeLe||null,trace:lf.encaissementsAnnules||null},d1,d2,d3:dx.statut,dtrace:dx.encaissementsAnnules||null};
  },close);
  rec('Encaissement','« Annuler » sur le mode de règlement : rien n\'est enregistré',!!r.num&&r.annule.paye===null&&!r.annule.livre,j(r));
  rec('Encaissement','Encaissement confirmé : payé, mode gardé, au livre des recettes',!!r.paye.paye&&r.paye.mode==='Chèque'&&r.paye.livre,j(r));
  rec('Encaissement','Bouton « Annuler l\'encaissement » sur une facture payée',r.bouton,j(r));
  rec('Encaissement','Annuler l\'encaissement : retour « en attente », trace gardée, hors livre des recettes',r.fn&&r.apres.paye===null&&Array.isArray(r.apres.trace)&&r.apres.trace.length===1&&r.apres.trace[0].mode==='Chèque'&&!!r.apres.trace[0].annuleLe&&!r.apres.livre,j(r));
  rec('Encaissement','Location : mêmes règles',r.l1===null&&!!r.l2&&r.lf.paye===null&&Array.isArray(r.lf.trace)&&r.lf.trace.length===1,j(r));
  rec('Encaissement','Intervention : « Annuler » = reste facturée ; repasser en attente garde une trace',r.d1==='facturee'&&r.d2==='payee'&&r.d3==='facturee'&&Array.isArray(r.dtrace)&&r.dtrace.length===1&&r.dtrace[0].mode==='CB',j(r));
  rec('Encaissement','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* R2b — mode réel : le journal du serveur ne reçoit un paiement que s'il a vraiment été enregistré */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(REEL);
  const r=await p.evaluate(async c=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0);
    await facturerDevis(d.id,'solde'); eval(c); await new Promise(r=>setTimeout(r,100));
    const ev=()=>__srv.events.map(e=>e.type);
    window.prompt=()=>null; payerFacture('devis',d.id,'solde'); await new Promise(r=>setTimeout(r,100)); const e1=ev();
    window.prompt=()=>'Virement'; payerFacture('devis',d.id,'solde'); await new Promise(r=>setTimeout(r,100)); const e2=ev();
    if(typeof window.annulerEncaissement==='function') annulerEncaissement('devis',d.id,'solde'); await new Promise(r=>setTimeout(r,100)); const e3=ev();
    return {num:d.facSolde&&d.facSolde.num,e1,e2,e3}; },close);
  rec('Encaissement','Mode réel : « Annuler » n\'envoie aucun paiement au journal du serveur',/^F-\d{4}-\d{3}$/.test(r.num||'')&&r.e1.length===0,j(r));
  rec('Encaissement','Mode réel : paiement puis annulation tracés au journal (paiement, paiement_annule)',r.e2.join()==='paiement'&&r.e3.join()==='paiement,paiement_annule',j(r));
  rec('Encaissement','Aucune erreur JavaScript (mode réel)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* R3 — export complet (état + registre + journal + signatures), pagination, rappel discret, texte honnête */
{
  const {p,ctx,errs}=await page({mobile:false});
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
  await seed(p); await p.evaluate(SERVEUR); await p.evaluate(SESSION);
  await p.evaluate(()=>{ for(let i=0;i<3;i++) __srv.docs.push({id:'doc'+(i+1),request_id:'r'+i,serie:'F',annee:2026,numero:i+1,num:'F-2026-00'+(i+1),type:'facture',origine:'emis',date_doc:todayISO(),payload:{src:{k:'devis',id:'x'+i,w:'solde'}}});
    for(let i=0;i<1205;i++) __srv.events.push({rid:'e'+i,doc:'doc1',type:'note',donnees:{}});
    const t=new Date().toISOString();
    __srv.sigs.push({token:'t1',user_id:'u1',doc_type:'devis',doc_id:'zz1',doc_num:'D-1',statut:'signe',created_at:t,doc_html:'<p>x</p>'},{token:'t2',user_id:'u1',doc_type:'devis',doc_id:'zz2',doc_num:'D-2',statut:'en_attente',created_at:t,doc_html:'<p>y</p>'});
    go('nx_tools'); });
  await wait(p,800);
  const texte=await p.evaluate(()=>(document.getElementById('nxaBackups')||{}).innerText||'');
  rec('Sauvegarde','Texte honnête : plus de promesse de copie Google Drive, copies serveur dites « dans Supabase »',!/Google Drive/i.test(texte)&&/hors Supabase/i.test(texte),texte.slice(0,400));
  const existe=await p.evaluate(()=>typeof window.nxaExportComplet==='function');
  rec('Export complet','Bouton « Export complet » présent',existe&&/Export complet/.test(texte),texte.slice(0,200));
  if(existe){
    const [dl]=await Promise.all([p.waitForEvent('download',{timeout:30000}),p.evaluate(()=>nxaExportComplet())]);
    const nom=dl.suggestedFilename(), pth=out('export-complet.json'); await dl.saveAs(pth);
    const o=JSON.parse(fs.readFileSync(pth,'utf8')), s=o.serveur||{};
    const info=await p.evaluate(()=>({i:JSON.parse(localStorage.getItem('cpnext_dernier_export')||'null'),appels:__srv.appels.filter(a=>a==='from:climpilot_doc_events').length,sync:SYNC_KEYS.indexOf('cpnext_dernier_export')>=0,txt:(document.getElementById('nxaBackups')||{}).innerText||''}));
    rec('Export complet','Fichier JSON daté',/^ClimPilot_export_complet_\d{4}-\d{2}-\d{2}\.json$/.test(nom)&&o.format==='climpilot-export-complet-1',nom+' '+o.format);
    rec('Export complet','Contient l\'état (devis, clients…), le registre, le journal et les signatures',!!(o.etat&&o.etat.all&&o.etat.all.cp2_devis&&o.etat.all.cp2_devis.length)&&(s.climpilot_documents||[]).length===3&&(s.climpilot_signatures||[]).length===2&&(o.erreurs||[]).length===0,j({docs:(s.climpilot_documents||[]).length,sig:(s.climpilot_signatures||[]).length,err:o.erreurs}));
    rec('Export complet','Pagination : 1 205 événements récupérés en plusieurs pages',(s.climpilot_doc_events||[]).length===1205&&info.appels>=2,j({n:(s.climpilot_doc_events||[]).length,appels:info.appels}));
    rec('Export complet','Clé synchronisée cpnext_dernier_export : horodatage ISO + taille en octets, date affichée',!!(info.i&&info.i.at&&Date.now()-Date.parse(info.i.at)<60000&&info.i.octets===fs.statSync(pth).size)&&info.sync&&/Dernière copie hors Supabase/.test(info.txt)&&info.txt.indexOf(new Date().toLocaleDateString('fr-FR'))>=0,j({i:info.i,txt:info.txt.slice(0,300)}));
    /* une table en erreur : fichier quand même, mais signalé INCOMPLET et non compté comme export complet */
    const avant=info.i&&info.i.at;
    await p.evaluate(()=>{ __srv.fail.climpilot_signatures=true; });
    const [dl2]=await Promise.all([p.waitForEvent('download',{timeout:30000}),p.evaluate(()=>nxaExportComplet())]);
    const pth2=out('export-incomplet.json'); await dl2.saveAs(pth2); const o2=JSON.parse(fs.readFileSync(pth2,'utf8'));
    const i2=await p.evaluate(()=>{ __srv.fail.climpilot_signatures=false; return JSON.parse(localStorage.getItem('cpnext_dernier_export')||'null'); });
    rec('Export complet','Table en erreur : fichier marqué incomplet, pas compté comme export complet',(o2.erreurs||[]).length===1&&o2.complet===false&&i2&&i2.at===avant&&i2.incomplet&&i2.incomplet.erreurs===1,j({err:o2.erreurs,i2}));
    /* rappel discret : plus de 7 jours sans export complet */
    const rp=await p.evaluate(()=>{ const set=ms=>localStorage.setItem('cpnext_dernier_export',JSON.stringify({at:new Date(ms).toISOString(),octets:1}));
      set(Date.now()-8*86400000); checkBackup(); const a=(document.getElementById('bkbanner')||{}).innerText||'';
      set(Date.now()-86400000); checkBackup(); const b=(document.getElementById('bkbanner')||{}).innerText||'';
      localStorage.removeItem('cpnext_dernier_export'); checkBackup(); const c=(document.getElementById('bkbanner')||{}).innerText||'';
      return {a,b,c}; });
    rec('Export complet','Rappel discret au-delà de 7 jours, rien en dessous, « jamais » sans export',/Export complet/.test(rp.a)&&/8 jours/.test(rp.a)&&rp.b.trim()===''&&/jamais/i.test(rp.c),j(rp));
  }
  rec('Export complet','Aucune erreur JavaScript',errs.length===0,errs.join(' | '));
  await ctx.close();
  /* l'export complet se relit avec « Importer » sur un appareil vide (partie « etat ») */
  if(existe&&fs.existsSync(out('export-complet.json'))){
    const q=await page({mobile:false});
    q.p.on('dialog',d=>d.accept().catch(()=>{}));
    await q.p.evaluate(()=>{ window.confirm=()=>true; });
    await q.p.evaluate(()=>{ const i=document.createElement('input'); i.type='file'; i.id='tstImpR'; i.onchange=function(){ importJSON(this); }; document.body.appendChild(i); });
    await q.p.setInputFiles('#tstImpR',out('export-complet.json')); await q.p.waitForTimeout(2500);
    const n=await q.p.evaluate(()=>({d:DEVIS.length,c:CLIENTS.length}));
    rec('Export complet','Relu par « Importer » sur un appareil vide (devis et clients revenus)',n.d>=12&&n.c>=3,j(n));
    await q.ctx.close();
  }
}

await closeBrowser();
ecrireResultats('resR.json',RES);
RES.forEach(x=>console.log(x.ok.padEnd(5),'['+x.group+']',x.name,x.ok==='PASS'?'':'— '+x.detail));
