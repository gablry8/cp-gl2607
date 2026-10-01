// Suite H — plateforme agréée SUPER PDP (écran « Facture électronique »), serveur simulé
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';

/* faux serveur : remplace sb.functions.invoke ; mémorise les appels */
const MOCK=`(function(env){
  const chain=()=>{ const f=function(){ return P; }; const P=new Proxy(f,{get(t,k){ if(k==='then') return (res)=>Promise.resolve({data:[],error:null}).then(res); return chain(); },apply(){ return P; }}); return P; };
  window.__calls=[]; window.__state={connecte:false,env:env,valid:true,sent:0};
  window.sb={from:()=>chain(),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){},auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({})},
    functions:{invoke:async(name,{body})=>{ __calls.push(body); const S=__state; const co={id:7,nom:env==='sandbox'?'Tricatel':'Gabriel Leroy',siren:env==='sandbox'?'000000001':'123456789'};
      switch(body.action){
        case 'status': return {data:S.connecte?{connecte:true,env:S.env,company:co,client_id:'abc123…'}:{connecte:false}};
        case 'connect': if(body.client_secret!=='bonsecret') return {data:{erreur:'identifiants',message:'SUPER PDP refuse ces identifiants : invalid_client'}}; S.connecte=true; return {data:{connecte:true,env:S.env,company:co}};
        case 'disconnect': S.connecte=false; return {data:{connecte:false}};
        case 'validate': S.lastXml=body.xml; return {data:{rapport:S.valid?{is_valid:true,profil:'EN16931',erreurs:[],avertissements:[]}:{is_valid:false,erreurs:[{message:'BR-FR-12 : adresse électronique du vendeur manquante',location:'/rsm:CrossIndustryInvoice'}],avertissements:[]}}};
        case 'send': S.sent++; S.lastSend=body; return {data:{id:1000+S.sent,direction:'out',events:[{status_code:'api:uploaded',status_text:'uploaded',created_at:'2026-10-01T10:00:00Z'}],env:S.env}};
        case 'invoice': return {data:{id:body.id,events:[{status_code:'api:uploaded',created_at:'2026-10-01T10:00:00Z'},{status_code:'fr:205',status_text:'Approuvée',created_at:'2026-10-01T11:00:00Z'}]}};
        case 'list': return {data:{items:[{id:55,direction:'in',numero:'FA-889',date:'2026-09-28',vendeur:'Clim Distribution',total:1250.4,events:[{code:'fr:203',texte:'Mise à disposition',at:'2026-09-28T09:00:00Z'}]}],has_after:false}};
        case 'event': S.lastEvent=body; return {data:{ok:true}};
        case 'directory': return {data:{entreprises:[{formal_name:'BOULANGERIE DUPRE'}],entrees:body.number==='552100554'?[{id:1}]:[],erreur_annuaire:null}};
        case 'download': return {data:{type:'application/xml',base64:btoa('<x/>')}};
      }
      return {data:{erreur:'action'}};
    }}};
  window.SESS={user:{id:'925080a9-1eaa-4fcf-9fa9-af6ffb214552',email:'g@x.fr'}};
})`;

async function setup(env,opts={}){
  const {p,ctx,errs}=await page({mobile:opts.mobile!==false?true:false});
  await p.evaluate(MOCK+'('+JSON.stringify(env)+')');
  await seed(p);
  /* une facture pro (SIREN) et une facture particulier */
  const nums=await p.evaluate(async()=>{
    const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0);
    const pro=acc.find(d=>d.cType==='Professionnel'), part=acc.find(d=>d.cType!=='Professionnel')||acc[1];
    pro.cSiren='552100554'; part.cType='Particulier';
    facturerDevis(pro.id,'solde'); await new Promise(r=>setTimeout(r,150)); const c1=document.getElementById('nx-pdf-close'); if(c1) c1.click();
    facturerDevis(part.id,'solde'); await new Promise(r=>setTimeout(r,150)); const c2=document.getElementById('nx-pdf-close'); if(c2) c2.click();
    return {pro:pro.facSolde.num,part:part.facSolde.num};
  });
  return {p,ctx,errs,nums};
}
const T=(p)=>p.evaluate(()=>((document.getElementById('mPdp')||{}).innerText||''));
const V=(p)=>p.evaluate(()=>((document.getElementById('nxpdp')||{}).innerText||''));
const wait=(p,ms=250)=>p.waitForTimeout(ms);

/* H1 — bac à sable : connexion, envoi, statuts */
{
  const {p,ctx,errs,nums}=await setup('sandbox');
  const nav=await p.evaluate(()=>!!document.querySelector('#nav a[data-v="nx_pdp"]'));
  rec('Super PDP','Menu « Facture électronique » présent',nav);
  await p.evaluate(()=>go('nx_pdp')); await wait(p);
  let v=await V(p);
  rec('Super PDP','Non connecté : formulaire client_id / client_secret',/Connecter SUPER PDP/.test(v)&&!!(await p.$('#nxpdpSec')),v.slice(0,120));
  await p.fill('#nxpdpId','abc123'); await p.fill('#nxpdpSec','mauvais'); await p.evaluate(()=>nxPdpConnect()); await wait(p);
  v=await V(p);
  rec('Super PDP','Mauvais identifiants : message clair, pas connecté',/refuse ces identifiants/.test(v),v.slice(-200));
  await p.fill('#nxpdpSec','bonsecret'); await p.evaluate(()=>nxPdpConnect()); await wait(p,400);
  v=await V(p);
  rec('Super PDP','Bons identifiants : « Connecté — compte de TEST » + Tricatel',/compte de TEST/.test(v)&&/Tricatel/.test(v),v.slice(0,300));
  const secretKept=await p.evaluate(()=>{ let s=''; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); s+=localStorage.getItem(k); } return /bonsecret/.test(s); });
  rec('Super PDP','Le secret n\'est stocké nulle part dans le téléphone',!secretKept);
  rec('Super PDP','Liste « Envoyer une facture » contient la facture pro',v.includes(nums.pro),nums.pro);
  /* envoi test */
  await p.evaluate(n=>nxPdpSend(n),nums.pro); await wait(p,500);
  let m=await T(p);
  rec('Super PDP','Envoi test : contrôle conforme puis confirmation (sociétés de test, -TEST)',/conforme/.test(m)&&/Burger Queen/.test(m)&&/-TEST/.test(m),m.slice(0,400));
  const xmlChk=await p.evaluate(()=>{ const x=__state.lastXml||''; return {seller:/000000001/.test(x),buyer:/000000002/.test(x),realCli:/552100554/.test(x),sch:/schemeID="0225"/.test(x)}; });
  const cad=await p.evaluate(n=>{ const x=__state.lastXml||''; const m=/BusinessProcessSpecifiedDocumentContextParameter><ram:ID>([A-Z]\d)</.exec(x); return {cadre:m&&m[1],avant:x.indexOf('BusinessProcess')<x.indexOf('GuidelineSpecified'),txt:/opération : livraison de biens et prestation de services/.test(x),modal:/cadre de facturation M1/.test(document.getElementById('mPdp').textContent)}; });
  rec('Super PDP','Cadre de facturation BT-23 (BR-FR-08) : M1 pour une facture de devis, affiché',cad.cadre==='M1'&&cad.avant&&cad.txt&&cad.modal,JSON.stringify(cad));
  await p.evaluate(n=>nxPdpSend(n,'S'),nums.pro); await wait(p,500);
  const cadS=await p.evaluate(()=>{ const x=__state.lastXml||''; return (/BusinessProcessSpecifiedDocumentContextParameter><ram:ID>([A-Z]\d)</.exec(x)||[])[1]+'|'+/prestation de services\./.test(x)+'|'+(nxPdpMap().docs[Object.keys(nxPdpMap().docs)[0]]||{}).nature; });
  rec('Super PDP','Changer la nature : fichier refait (S1) et choix mémorisé',cadS==='S1|true|S',cadS);
  rec('Super PDP','XML de test : vendeur 000000001, acheteur 000000002, adresses 0225, pas le vrai client',xmlChk.seller&&xmlChk.buyer&&!xmlChk.realCli&&xmlChk.sch,JSON.stringify(xmlChk));
  await p.click('#nxpdpGo'); await wait(p,400);
  m=await T(p);
  const ext=await p.evaluate(()=>__state.lastSend&&__state.lastSend.external_id);
  rec('Super PDP','Envoyé : statut « Déposée », référence suffixée',/déposé sur la plateforme/.test(m)&&/Déposée/.test(m)&&/-TEST\d{5}$/.test(ext||''),ext+' | '+m.slice(0,200));
  await p.evaluate(()=>closeModal('mPdp'));
  await p.evaluate(()=>nxPdpRender()); await wait(p,600);
  v=await V(p);
  rec('Super PDP','Ouverture de l\'écran : statut mis à jour automatiquement (Approuvée)',/Approuvée/.test(v),v.slice(0,500));
  await p.evaluate(n=>nxPdpHistory(n),nums.pro); await wait(p);
  m=await T(p);
  rec('Super PDP','Historique : étapes datées + bouton copie déposée',/Approuvée/.test(m)&&/Copie déposée/.test(m),m.slice(0,300));
  await p.evaluate(()=>closeModal('mPdp'));
  /* rapport non conforme */
  await p.evaluate(()=>{ __state.valid=false; }); await p.evaluate(n=>nxPdpSend(n),nums.pro); await wait(p,500);
  m=await T(p); const sentBefore=await p.evaluate(()=>__state.sent);
  rec('Super PDP','Fichier non conforme : liste des erreurs, aucun envoi',/refusé par le contrôle/.test(m)&&/BR-FR-12/.test(m)&&!(await p.$('#nxpdpGo'))&&sentBefore===1,m.slice(0,300));
  await p.evaluate(()=>{ closeModal('mPdp'); __state.valid=true; });
  /* factures reçues */
  await p.evaluate(()=>nxPdpLoadReceived()); await wait(p);
  v=await V(p);
  rec('Super PDP','Factures reçues : fournisseur, montant, statut',/Clim Distribution/.test(v)&&/1\s?250,40/.test(v)&&/Mise à disposition/.test(v),v.slice(-400));
  await p.evaluate(()=>{ window.confirm=()=>true; window.prompt=()=>'Prix non conforme au devis'; });
  await p.evaluate(()=>nxPdpDecide(55,'fr:210')); await wait(p);
  const ev=await p.evaluate(()=>__state.lastEvent);
  rec('Super PDP','Refus d\'une facture reçue : statut fr:210 + motif transmis',ev&&ev.status_code==='fr:210'&&/Prix/.test(ev.reason),JSON.stringify(ev));
  /* annuaire */
  await p.fill('#nxpdpSiren','552100554'); await p.evaluate(()=>nxPdpLookup()); await wait(p);
  let d=await p.evaluate(()=>document.getElementById('nxpdpDirOut').innerText);
  rec('Super PDP','Annuaire : client trouvé et joignable',/BOULANGERIE/.test(d)&&/Peut recevoir/.test(d),d);
  await p.fill('#nxpdpSiren','12'); await p.evaluate(()=>nxPdpLookup()); await wait(p,100);
  d=await p.evaluate(()=>document.getElementById('nxpdpDirOut').innerText);
  rec('Super PDP','Annuaire : saisie invalide refusée sans appel serveur',/9 chiffres/.test(d),d);
  /* boutons ailleurs */
  await p.evaluate(()=>go('nx_avoirs')); await wait(p,400);
  const btn=await p.evaluate(n=>{ const b=[...document.querySelectorAll('#nxav .nxpdp-x')]; return {n:b.length,txt:b.map(x=>x.textContent).join('|'),st:/Approuvée/.test((document.getElementById('nxav')||{}).innerText||'')}; },nums.pro);
  rec('Super PDP','Écran Avoirs : boutons Envoyer/Renvoyer + statut',btn.n>=2&&/Renvoyer/.test(btn.txt)&&btn.st,JSON.stringify(btn));
  /* téléphone : boutons cliquables */
  await p.evaluate(()=>go('nx_pdp')); await wait(p,500);
  const tap=await p.evaluate(()=>{ const b=document.querySelector('#nxpdp .btn-pri.btn-sm'); if(!b) return 'absent'; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return el===b||b.contains(el)?'ok':'masqué par '+(el&&el.className); });
  rec('Super PDP','Téléphone : bouton « Envoyer » cliquable',tap==='ok',tap);
  /* déconnexion */
  await p.evaluate(()=>{ window.confirm=()=>true; nxPdpDisconnect(); }); await wait(p,300);
  v=await V(p);
  rec('Super PDP','Déconnexion : retour au formulaire',/Connecter SUPER PDP/.test(v));
  rec('Super PDP','Aucune erreur JavaScript (bac à sable)',errs.length===0,errs.join(' | '));
  await ctx.close();
}
/* H2 — compte réel : particulier refusé, pro sans SIREN refusé, pro avec SIREN envoyé vers le vrai client */
{
  const {p,ctx,errs,nums}=await setup('production',{mobile:false});
  await p.evaluate(()=>{ __state.connecte=true; });
  await p.evaluate(n=>nxPdpSend(n),nums.part); await wait(p,400);
  let m=await T(p);
  rec('Super PDP','Compte réel : facture particulier non envoyée (explication e-reporting)',/particulier/.test(m)&&/2027/.test(m)&&!(await p.$('#nxpdpGo')),m.slice(0,200));
  await p.evaluate(()=>closeModal('mPdp'));
  await p.evaluate(n=>nxPdpSend(n),nums.pro); await wait(p,500);
  m=await T(p);
  const x=await p.evaluate(()=>__state.lastXml||'');
  rec('Super PDP','Compte réel : facture pro → vrai client (SIREN), pas de -TEST',/552100554/.test(x)&&!/000000002/.test(x)&&!/-TEST/.test(m)&&/circuit officiel/.test(m),m.slice(0,300));
  await p.click('#nxpdpGo'); await wait(p,300);
  const ext=await p.evaluate(()=>__state.lastSend.external_id);
  rec('Super PDP','Compte réel : référence = numéro de facture',ext===nums.pro,ext);
  /* hors ligne / pas de session */
  await p.evaluate(()=>{ closeModal('mPdp'); window.SESS=null; go('nx_pdp'); }); await wait(p,300);
  const v=await V(p);
  rec('Super PDP','Sans connexion cloud : message, pas de plantage',/Connecte-toi au cloud/.test(v),v.slice(0,200));
  rec('Super PDP','Aucune erreur JavaScript (compte réel)',errs.length===0,errs.join(' | '));
  await ctx.close();
}
await closeBrowser();
fs.mkdirSync('/tmp/claude-0/sp',{recursive:true});
fs.writeFileSync('/tmp/claude-0/sp/resH.json',JSON.stringify(RES,null,1));
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
