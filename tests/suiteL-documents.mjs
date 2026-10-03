import { ecrireResultats } from './env.mjs';
// Suite L — mentions des documents (1.10, next-documents.js + retouches index.html) : dénomination « EI »,
// pied de facture ≠ pied de devis, validité unique, nature S/M selon le réglage, contrôles assurance /
// médiateur selon les travaux et le client (blocage en mode réel), factures à 0 € refusées, RGPD,
// sauvegarde au premier lancement de la 1.10, nouveaux champs des Paramètres.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';
const j=o=>JSON.stringify(o);
const close=`(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;
const PREP=`(function(){
  window.__dlg=[]; window.__oui=true;
  window.alert=m=>{ __dlg.push('A:'+m); }; window.confirm=m=>{ __dlg.push('C:'+m); return !!__oui; }; window.prompt=(m,d)=>d;
  window.askMode=()=>'Virement';
  window.L={ fic:n=>(JSON.parse(localStorage.getItem('cpnext_docs_fichiers')||'{}')[n])||{},
    devis:(extra)=>{ const src=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0&&x.cType==='Professionnel'); const d=JSON.parse(JSON.stringify(src));
      d.id='L'+Math.random().toString(36).slice(2,8); d.num=src.num+'-'+d.id; delete d.facAcompte; delete d.facSolde; Object.assign(d,extra||{}); DEVIS.push(d); save(LS.devis,DEVIS); return d; },
    ent:o=>{ Object.assign(P.entreprise,o); } };
})();`;
const SRV=`(function(){ const srv={docs:[],appels:[],from:[]}; window.__srv=srv;
  window.sb={rpc:(n,a)=>{ srv.appels.push(n);
      if(n==='cp_serveur_info') return Promise.resolve({data:{documents:true,version:'1.10'}});
      if(n==='cp_emettre_document'){ const an=+String(a.p_date).slice(0,4), k=srv.docs.length+1; const d={id:'doc'+k,request_id:a.p_request_id,serie:a.p_serie,annee:an,numero:k,num:a.p_serie+'-'+an+'-'+String(k).padStart(3,'0'),type:a.p_type,origine:'emis',date_doc:a.p_date,payload:JSON.parse(JSON.stringify(a.p_payload)),payload_hash:'h'};
        srv.docs.push(d); return Promise.resolve({data:{ok:true,deja:false,doc:d}}); }
      return Promise.resolve({data:{ok:true}}); },
    from:t=>{ srv.from.push(t); const q={select(){return q;},order(){return q;},eq(){return q;},or(){return q;},in(){return q;},gte(){return q;},lte(){return q;},limit(){return q;},insert(){ srv.from.push('insert:'+t); return q;},update(){return q;},single(){return Promise.resolve({data:null});},maybeSingle(){return Promise.resolve({data:null});},then(ok,ko){ return Promise.resolve({data:[]}).then(ok,ko); }}; return q; },
    auth:{getSession:()=>Promise.resolve({data:{session:null}})}};
  window.SESS={user:{id:'u1',email:'test@test'}}; Object.assign(P.entreprise,{siret:'12345678900012'}); })();`;

const {p,ctx,errs}=await page({mobile:false});
await seed(p); await p.evaluate(PREP);

/* L1 dénomination « EI » */
{
  const r=await p.evaluate(async c=>{ const out={};
    out.a=nxDenomination({nom:'GL Froid & Clim',statut:'Micro-entreprise (en création)'});
    out.b=nxDenomination({nom:'GL Froid & Clim',statut:'Micro-entreprise',nomEntrepreneur:'Gabriel Leroy'});
    out.c=nxDenomination({nom:'Gabriel Leroy',statut:'EI',nomEntrepreneur:'Gabriel Leroy'});
    out.d=nxDenomination({nom:'GL Froid SASU',statut:'SASU'}); out.e=nxDenomination({nom:'Gabriel Leroy EI',statut:'Micro'});
    L.ent({nom:'GL Froid & Clim',statut:'Micro-entreprise',nomEntrepreneur:'Gabriel Leroy'});
    const d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); const f=DEVIS.find(x=>x.id===d.id).facSolde, fic=L.fic(f.num);
    out.pdf=/GL Froid &amp; Clim — Gabriel Leroy EI|GL Froid & Clim — Gabriel Leroy EI/.test(fic.html||''); out.xml=/<ram:Name>GL Froid &amp; Clim — Gabriel Leroy EI<\/ram:Name>/.test(fic.xml||'');
    const av=nxCreateAvoir({facNum:f.num,montant:10,motif:'Geste commercial'}); eval(c); const fa=L.fic(av.av&&av.av.num);
    out.avoir=/Gabriel Leroy EI/.test(fa.html||document.getElementById('devisDoc').innerHTML);
    return out; },close);
  rec('Documents','EI : « dénomination EI », nom de l\'entrepreneur ajouté s\'il n\'y figure pas, rien pour une société',r.a==='GL Froid & Clim EI'&&r.b==='GL Froid & Clim — Gabriel Leroy EI'&&r.c==='Gabriel Leroy EI'&&r.d==='GL Froid SASU'&&r.e==='Gabriel Leroy EI',j(r));
  rec('Documents','EI sur la facture (PDF figé), dans le XML (vendeur) et sur l\'avoir',r.pdf&&r.xml&&r.avoir,j(r));
}

/* L2 pieds de page et validité */
{
  const r=await p.evaluate(async c=>{ L.ent({piedNote:'Devis gratuit, valable 30 jours. Prix indicatifs.',piedFacture:'Merci pour votre confiance.',validiteDevis:'3 mois'});
    const d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); const f=DEVIS.find(x=>x.id===d.id).facSolde, fic=L.fic(f.num).html||'';
    const av=nxCreateAvoir({facNum:f.num,montant:5,motif:'Geste'}); eval(c); const ah=L.fic(av.av.num).html||'';
    cur=JSON.parse(JSON.stringify(d)); printDevis(); const dh=document.getElementById('devisDoc').innerHTML; eval(c);
    let body=''; const bm=window.buildMail; window.buildMail=(t,s,b)=>{ body=b; }; try{ cur=JSON.parse(JSON.stringify(d)); NXD2.open(cur,{tab:'recap'}); mailDevis(); }catch(e){ body='ERR '+e.message; } window.buildMail=bm;
    return {facPied:/Merci pour votre confiance/.test(fic),facDevisTxt:/Devis gratuit/.test(fic),avPied:/Merci pour votre confiance/.test(ah),avDevisTxt:/Devis gratuit/.test(ah),
      devis3:/valable 3 mois/.test(dh),devis30:/30 jours/.test(dh),mail:body.slice(0,400)}; },close);
  rec('Documents','Facture et avoir : pied de facture, jamais « Devis gratuit… »',r.facPied&&!r.facDevisTxt&&r.avPied&&!r.avDevisTxt,j(r));
  rec('Documents','Devis : une seule durée de validité (3 mois), même si la note de bas de devis disait 30 jours',r.devis3&&!r.devis30,j(r));
  rec('Documents','Mail du devis : même durée de validité',/valable 3 mois/.test(r.mail)&&!/30 jours/.test(r.mail),r.mail);
}

/* L3 nature de l'opération : S par défaut (à confirmer), M sur réglage — PDF et XML identiques */
{
  const r=await p.evaluate(async c=>{ const out={}; const cad=x=>(/BusinessProcessSpecifiedDocumentContextParameter><ram:ID>([A-Z]\d)</.exec(x||'')||[])[1];
    L.ent({natureChantier:'a_confirmer'}); let d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); let f=L.fic(DEVIS.find(x=>x.id===d.id).facSolde.num);
    out.defXml=cad(f.xml); out.defPdf=/opération :<\/b> Prestation de services\./.test(f.html||'');
    L.ent({natureChantier:'M'}); d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); f=L.fic(DEVIS.find(x=>x.id===d.id).facSolde.num);
    out.mXml=cad(f.xml); out.mPdf=/opération :<\/b> Livraison de biens et prestation de services\./.test(f.html||'');
    L.ent({natureChantier:'a_confirmer'}); return out; },close);
  rec('Documents','Nature « à confirmer » : S1 dans le XML et « Prestation de services » sur le PDF (plus de M imposé)',r.defXml==='S1'&&r.defPdf,j(r));
  rec('Documents','Nature M choisie dans Paramètres : M1 dans le XML et sur le PDF',r.mXml==='M1'&&r.mPdf,j(r));
}

/* L4 contrôles selon les travaux et le client — mode démonstration */
{
  const r=await p.evaluate(async c=>{ const out={}; L.ent({assurance:'',assuranceZone:'',decennale:'a_confirmer',mediateur:''});
    out.pose=nxEstPose(L.devis()); out.dep=nxEstPose({v:2,lots:[{module:'depannage'}]}); out.ent=nxEstPose({v:2,lots:[{module:'entretien'},{module:'split',option:true}]}); out.v1dep=nxEstPose({type:'Dépannage'});
    const toasts=[]; const tt=window.toast; window.toast=m=>toasts.push(m);
    __dlg.length=0; let d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); window.toast=tt;
    out.demo=/^TEST-F-/.test((DEVIS.find(x=>x.id===d.id).facSolde||{}).num||'')&&toasts.some(m=>/L132-1/.test(m)&&/mode réel/.test(m))&&!__dlg.some(m=>/L132-1/.test(m));
    L.ent({decennale:'non'}); __dlg.length=0; d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); out.nonRequise=!!DEVIS.find(x=>x.id===d.id).facSolde&&!__dlg.some(m=>/L132-1/.test(m));
    L.ent({decennale:'a_confirmer'});
    return out; },close);
  rec('Documents','Travaux de pose détectés selon les lots (dépannage, entretien, options exclus)',r.pose&&!r.dep&&!r.ent&&!r.v1dep,j(r));
  rec('Documents','Démo : assurance manquante pour une pose → document de TEST émis avec un avertissement (L132-1), sans question bloquante',r.demo,j(r));
  rec('Documents','Décennale déclarée non obligatoire : pas de contrôle d\'assurance',r.nonRequise,j(r));
}

/* L5 factures à 0 € refusées */
{
  const r=await p.evaluate(async c=>{ const out={};
    LOC.push({id:'l0',num:'LOC-0',cNom:'Client Zéro',cType:'Professionnel',items:[],dateDebut:todayISO(),dateFin:todayISO()}); save(LS.loc,LOC);
    await facturerLoc('l0'); eval(c); out.loc=!LOC.find(x=>x.id==='l0').fac;
    CTR.push({id:'k0',clientNom:'Boulangerie Dupré',type:'Climatisation',prix:0,facs:[]}); save('cp2_contrats',CTR); await facturerContrat('k0'); eval(c); out.ctr=!(CTR.find(x=>x.id==='k0').facs||[]).length;
    const x={id:'d0',cNom:'Pro Zéro',cType:'Professionnel',date:todayISO(),itype:'dep',statut:'brouillon',heures:0,pieces:[],rateChoice:'custom',rateCustom:0,mode:'forfaitH',zone:'',maj:'0'};
    DEP.push(x); curDep=x; try{ loadDepForm(); }catch(e){} const t=computeDep(curDep).totalHT; __dlg.length=0; await factureDep(); eval(c); out.depTotal=t; out.dep=!DEP.find(o=>o.id==='d0').facNum;
    return out; },close);
  rec('Documents','Location vide et contrat sans prix : aucune facture à 0 €',r.loc&&r.ctr,j(r));
  rec('Documents','Intervention à 0 € : aucune facture',r.depTotal>0.005||r.dep,j(r));
}

/* L6 devis : RGPD, médiateur pour un particulier */
{
  const r=await p.evaluate(async c=>{ L.ent({mediateur:'',assurance:'AXA n° 123',assuranceZone:'France métropolitaine',decennale:'oui'});
    const toasts=[]; const tt=window.toast; window.toast=m=>toasts.push(m);
    const d=L.devis({cType:'Particulier',cNom:'Mme RGPD',conclusion:{mode:'locaux',date:todayISO()}}); cur=JSON.parse(JSON.stringify(d)); printDevis(); const h=document.getElementById('devisDoc').innerHTML; eval(c);
    printDevis(); const h2=document.getElementById('devisDoc').innerHTML; eval(c);
    const t1=toasts.slice(); const pro=L.devis(); cur=JSON.parse(JSON.stringify(pro)); toasts.length=0; printDevis(); eval(c); const tPro=toasts.slice();
    window.toast=tt;
    return {rgpd:(h.match(/data-rgpd/g)||[]).length,rgpd2:(h2.match(/data-rgpd/g)||[]).length,cnil:/CNIL/.test(h),toast:t1.some(m=>/médiateur/.test(m)),tPro:tPro.some(m=>/médiateur/.test(m))}; },close);
  rec('Documents','Devis : paragraphe « Données personnelles » (droits, CNIL), une seule fois',r.rgpd===1&&r.rgpd2===1&&r.cnil,j(r));
  rec('Documents','Devis d\'un particulier sans médiateur : avertissement ; client professionnel : aucun',r.toast&&!r.tPro,j(r));
}

/* L7 Paramètres : nouveaux champs enregistrés */
{
  const r=await p.evaluate(async ()=>{ go('params'); await new Promise(r=>setTimeout(r,150));
    const ids=['pe_nomei','pe_piedfac','pe_nature','pe_decennale'], ok=ids.every(i=>!!document.getElementById(i));
    document.getElementById('pe_nomei').value='Gabriel Leroy'; document.getElementById('pe_piedfac').value='Pied facture test'; document.getElementById('pe_nature').value='S'; document.getElementById('pe_decennale').value='oui';
    saveParams(); const e=P.entreprise; return {ok,e:{n:e.nomEntrepreneur,p:e.piedFacture,na:e.natureChantier,de:e.decennale}}; });
  rec('Documents','Paramètres : nom de l\'entrepreneur, pied de facture, nature, décennale enregistrés',r.ok&&r.e.n==='Gabriel Leroy'&&r.e.p==='Pied facture test'&&r.e.na==='S'&&r.e.de==='oui',j(r));
}

/* L8 sauvegarde au premier lancement de la 1.10 */
{
  const r=await p.evaluate(async ()=>{ go('dash'); await new Promise(r=>setTimeout(r,200));
    const st=JSON.parse(localStorage.getItem('cpnext_avant110')||'null'), hist=JSON.parse(localStorage.getItem('cpnext_history')||'[]');
    const carte=!!document.getElementById('nxAvant110');
    const oc=URL.createObjectURL; URL.createObjectURL=()=>'blob:x'; const ac=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){};
    try{ exportJSON(); }finally{ URL.createObjectURL=oc; HTMLAnchorElement.prototype.click=ac; }
    await new Promise(r=>setTimeout(r,400)); go('dash'); await new Promise(r=>setTimeout(r,100));
    return {st:!!(st&&st.at),snap:hist.some(h=>/Avant ClimPilot 1\.10/.test(h.reason||'')),carte,apres:!!document.getElementById('nxAvant110')}; });
  rec('Documents','Premier lancement 1.10 : copie locale automatique + invitation à télécharger une sauvegarde',r.st&&r.snap&&r.carte,j(r));
  rec('Documents','Après téléchargement de la sauvegarde : l\'invitation disparaît',!r.apres,j(r));
}
rec('Documents','Aucune erreur JavaScript (démonstration)',errs.length===0,errs.join(' | '));
await ctx.close();

/* L9 mode réel (serveur simulé) : blocages avant toute demande de numéro */
{
  const {p,ctx,errs}=await page({mobile:false});
  await seed(p); await p.evaluate(PREP); await p.evaluate(SRV);
  const r=await p.evaluate(async c=>{ const out={}; const emis=()=>__srv.appels.filter(x=>x==='cp_emettre_document').length;
    L.ent({nom:'Entreprise Test',natureChantier:'a_confirmer',assurance:'',assuranceZone:'',decennale:'a_confirmer',mediateur:''});
    __dlg.length=0; let d=L.devis(); await facturerDevis(d.id,'solde'); eval(c); out.nature={emis:emis(),fac:!!DEVIS.find(x=>x.id===d.id).facSolde,msg:__dlg.some(m=>/nature de l.opération/.test(m))};
    L.ent({natureChantier:'S'}); __dlg.length=0; await facturerDevis(d.id,'solde'); eval(c); out.assur={emis:emis(),fac:!!DEVIS.find(x=>x.id===d.id).facSolde,msg:__dlg.some(m=>/NON émise/.test(m)&&/L132-1/.test(m))};
    L.ent({assurance:'AXA n° 123',assuranceZone:'France métropolitaine'}); __dlg.length=0; await facturerDevis(d.id,'solde'); eval(c); out.ok={emis:emis(),num:(DEVIS.find(x=>x.id===d.id).facSolde||{}).num};
    /* envoi d'un devis à signer : bloqué sans médiateur pour un particulier */
    const part=L.devis({cType:'Particulier',cNom:'Mme Signe',conclusion:{mode:'locaux',date:todayISO()}}); cur=JSON.parse(JSON.stringify(part)); __dlg.length=0; const f0=__srv.from.length;
    try{ go('wizard'); }catch(e){} try{ await nxsSendDevis(); }catch(e){}
    out.envoi={bloque:__dlg.some(m=>/Devis NON envoyé/.test(m)&&/L616-1/.test(m)),inserts:__srv.from.slice(f0).filter(x=>/^insert:/.test(x)).length};
    return out; },close);
  rec('Documents','Mode réel : nature « à confirmer » → facture non émise, aucun numéro demandé',r.nature.emis===0&&!r.nature.fac&&r.nature.msg,j(r.nature));
  rec('Documents','Mode réel : assurance manquante pour une pose → facture non émise (L132-1)',r.assur.emis===0&&!r.assur.fac&&r.assur.msg,j(r.assur));
  rec('Documents','Mode réel : mentions complètes → facture émise avec le numéro du serveur',r.ok.emis===1&&/^F-\d{4}-001$/.test(r.ok.num||''),j(r.ok));
  rec('Documents','Mode réel : devis d\'un particulier sans médiateur → envoi pour signature bloqué',r.envoi.bloque&&r.envoi.inserts===0,j(r.envoi));
  rec('Documents','Aucune erreur JavaScript (mode réel)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* L10 (C17) en 2027 : la réimpression d'une ancienne facture de 2026 garde la mention de franchise de sa date */
{
  const {p,ctx,errs}=await page({mobile:false,init:()=>{ const D=Date; const T=new D('2027-01-05T10:00:00').getTime(); const off=T-D.now(); class FD extends D{ constructor(...a){ if(a.length) super(...a); else super(D.now()+off); } static now(){ return D.now()+off; } } window.Date=FD; }});
  await seed(p);
  const r=await p.evaluate(async c=>{ const x={id:'old26',cNom:'Pro 2026',cType:'Professionnel',date:'2026-06-01',itype:'dep',statut:'facturee',facNum:'F-2026-040',facDate:'2026-06-01',heures:1,pieces:[],rateChoice:'custom',rateCustom:90,mode:'forfaitH',zone:'',maj:'0'};
    DEP.push(x); save(LS.dep,DEP); curDep=JSON.parse(JSON.stringify(x)); printFacture(); await new Promise(r=>setTimeout(r,200));
    const t=(document.getElementById('nx-pdf-page')||document.getElementById('devisDoc')||{}).textContent||''; eval(c);
    return {annee:new Date().getFullYear(),b293:/293 B/.test(t),cibs:/233-3 du CIBS/.test(t),dup:/reconstitu/i.test(t)}; },close);
  rec('Documents','En 2027, réimpression d\'une facture de 2026 (avant 1.10) : mention 293 B de sa date, marquée reconstituée',r.annee===2027&&r.b293&&!r.cibs&&r.dup,j(r));
  rec('Documents','Aucune erreur JavaScript (horloge 2027)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

await closeBrowser();
ecrireResultats('resL.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
