import { ecrireResultats, RACINE, URL_LOCALE, out } from './env.mjs';
// Suite AB — mission S (sécurité de l'appli, 10/11/2026). Dossier privé dans le Project ; ici, seulement les règles vérifiées :
//  AB1  un texte libre (nom de client) ne s'exécute jamais et s'affiche à l'identique ; les boutons qui le portent marchent (apostrophe, guillemet).
//  AB2  idem pour la désignation, la catégorie et l'unité d'un article (import de tarif simulé, base de prix, devis, à commander, bon de commande).
//  AB3  idem pour une réservation venue du site ;  AB4  idem pour un client, une machine, un article créés par l'assistant.
//  AB5  facture reçue (plateforme simulée) : le bouton « Fichier » reçoit le numéro tel quel.
//  AB6  sauvegarde restaurée : textes affichés sans exécution, identifiants invalides réparés et journalisés.
//  AB7  réservation au nom d'un client existant : aucun champ effacé, différence notée dans la fiche, rapprochement sans tenir compte des espaces.
//  AB8  exemplaire signé téléchargé : aucun script ne s'exécute ; image de signature acceptée seulement en PNG embarqué.
//  AB9  exports CSV : une cellule de texte qui ressemble à une formule est neutralisée ; un montant négatif reste un nombre.
//  AB10 CSP : balise présente, 0 violation sur tous les écrans (téléphone et PC) et pendant les fonctions (adresses, SIREN, Excel, ZIP, PDF, signature).
//  AB11 bibliothèques embarquées (vendor/) avec empreinte ; aucune requête vers un CDN pendant la suite.
//  AB12 non-régression : références golden (Y, Z, W, U) inchangées sur la branche ; rendu visible des noms avec apostrophe et guillemets.
//  AB13 lecture de plaque (OCR) entièrement locale : une image lisible → mêmes champs qu'avant, aucune requête externe.
// Horloge figée sur REF (tests/lib.mjs) : aucun test ne lit la vraie date. Cloud coupé (lib.mjs). Aucun montant n'est recalculé ni modifié.
// Le jeu de textes ci-dessous n'est ni un secret ni une donnée personnelle : ce sont des noms d'essai.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { spawnSync } from 'child_process'; import { createRequire } from 'module';
import { page, rec, RES, closeBrowser, seed, REF, getBrowser } from './lib.mjs';
const j = (o) => JSON.stringify(o);
const G = (n) => 'Sécurité ' + n;
const TEXTES = ["L'Atelier du Froid", "O'Neil\\", 'Dupont " Fils', 'x" onmouseover="window.__xss=1', '<img src=x onerror="window.__xss=1">', "';window.__xss=1;//", '&#39;);window.__xss=1;//', '=HYPERLINK("http://exemple.invalid")'];
const CDN = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|tessdata\.projectnaptha\.com/i;
const EXTERNE = (u) => !/^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|about:|mailto:|sms:|tel:)/i.test(u);
const cdnHits = []; const externes = [];
function suivre(ctx) { ctx.on('request', (r) => { const u = r.url(); if (CDN.test(u)) cdnHits.push(u.slice(0, 120)); if (EXTERNE(u)) externes.push(u.slice(0, 120)); }); return ctx; }
/* page de l'appli : horloge figée, dialogues simulés, piège d'exécution (window.__xss), outils communs */
const PREP = `(function(){
  window.__dlg=[]; window.__msgs=[]; window.__blobs=[];
  window.alert=m=>{ __dlg.push('A:'+m); }; window.confirm=m=>{ __dlg.push('C:'+m); return true; }; window.prompt=(m,d)=>{ __dlg.push('P:'+m); return window.__rep==null?'':window.__rep; };
  const _t=window.toast; window.toast=function(m){ __msgs.push(String(m)); try{ return _t.apply(this,arguments); }catch(e){} };
  if(window.nxToast){ const _n=window.nxToast; window.nxToast=function(m,t){ __msgs.push(String(m)); try{ return _n.apply(this,arguments); }catch(e){} }; }
  /* fichiers produits par l'appli (CSV, ZIP, exemplaire) : capturés dans __blobs ; les images (aperçu d'une photo) gardent une vraie adresse blob: */
  const _cou=URL.createObjectURL.bind(URL); URL.createObjectURL=b=>{ if(b&&/^(image\\/|application\\/javascript|text\\/javascript)/.test(b.type||'')) return _cou(b); __blobs.push(b); return 'blob:capture-'+__blobs.length; }; URL.revokeObjectURL=()=>{};
  /* un lien de téléchargement ou de messagerie cliqué par le test ne doit pas faire naviguer la page (le fichier est lu dans __blobs) */
  const _ac=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ const h=this.href||''; if(this.hasAttribute('download')||/^(mailto|sms|tel):|^blob:capture/.test(h)||(/^https?:\\/\\//.test(h)&&!/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)/.test(h))) return; return _ac.apply(this,arguments); };
  const attendre=ms=>new Promise(r=>setTimeout(r,ms||40));
  window.AB={
    attendre,
    reset(){ delete window.__xss; },
    TEXTES:${j(TEXTES)},
    /* survol de tout ce qui est affiché : déclenche les gestionnaires « onmouseover » posés par un texte piégé */
    hover(){ document.querySelectorAll('.view.active *, .modal.on *, #devisDoc *, #nx-pdf-page *').forEach(e=>{ try{ e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); }catch(_){} }); },
    xss(){ return window.__xss; },
    texte(){ const v=document.querySelector('.view.active'); return (v?v.innerText:'')+'\\n'+[...document.querySelectorAll('.modal.on')].map(m=>m.innerText).join('\\n'); },
    ferme(){ document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on')); document.querySelectorAll('.nxd2-ov,#nxfoOv,.nxs-ov').forEach(o=>o.remove()); const pm=document.getElementById('nx-pdf-modal'); if(pm) pm.style.display='none'; const c=document.getElementById('nx-pdf-close'); if(c) c.click(); },
    async ouvrir(v){ AB.ferme(); AB.reset(); try{ if(v==='plan') planOff=0; if(v==='commander') cmdView='article'; if(v==='nx_journee'){ go('nx_journee'); nxjMode('soir'); } else go(v); }catch(e){ return 'ERR '+e.message; } await attendre(150); AB.hover(); await attendre(250); return null; },
    /* clic sur chaque bouton de l'écran actif (sauf suppressions, restaurations, impression) ; l'écran est rouvert avant chaque clic */
    async clics(v, rouvrir){
      const n=await (async()=>{ await AB.ouvrir(v); if(rouvrir) rouvrir(); const s=document.querySelector('.view.active'); return s?s.querySelectorAll('button,[onclick]').length:0; })();
      AB.reset(); let faits=0; const erreurs=[];
      for(let i=0;i<Math.min(n,90);i++){
        AB.ferme(); try{ if(window._curView!==v) go(v); if(rouvrir) rouvrir(); }catch(e){}
        const s=document.querySelector('.view.active'); const el=s&&s.querySelectorAll('button,[onclick]')[i]; if(!el) continue;
        const txt=(el.textContent||el.title||'').trim().slice(0,40), oc=el.getAttribute('onclick')||'';
        if(/delete|suppr|delX|del[A-Z]|reset|wipe|logout|déconn|clear|vider|Import|signOut|restore|restaurer|print|pdf|🖨|imprimer|annulerFlu|annulerEnc/i.test(oc+txt)) continue;
        if(!el.getBoundingClientRect().width) continue;
        try{ el.click(); faits++; }catch(e){ erreurs.push(txt+' : '+e.message); }
        await attendre(30);
      }
      await attendre(250); AB.ferme(); const xss=AB.xss(); AB.reset(); return {faits,erreurs,xss};
    },
    /* jeu de données pour UN nom de client : fiche, devis accepté planifié demain (planning, messages, à commander), devis envoyé (relances),
       facture de solde encaissée (livre des recettes), intervention, location, contrat, équipement en fin de garantie, fiche fluide */
    jeu(nomBrut,i,extras){
      const t=__REF.jour, dem=AB.plus(t,1), an=__REF.an;
      const c={id:'abc'+i,nom:nomBrut,tel:'03 44 0'+i+' 00 0'+i,mail:'client'+i+'@exemple.org',type:'Professionnel',adr:'1 rue du Test',ville:'60000 Beauvais',notes:''};
      CLIENTS.push(c); save(LS.clients,CLIENTS); const nom=c.nom; /* tel que l'appli le garde (nettoyage des balises au stockage) */
      const base=(id,st)=>({id,num:'DV-'+an+'1020-TST-'+id.toUpperCase(),cNom:nom,cTel:c.tel,cMail:c.mail,cType:'Professionnel',cAdr:c.adr,cVille:c.ville,type:'Monosplit',statut:st,date:t,created:Date.parse(__REF.horloge)-i*1000,
        nbMach:1,nbSplit:1,machines:[{marque:'D',ref:'X',achat:1000,marge:35}],splits:[{long:5,liaison:'Liaison 1/4 - 3/8',puiss:2.5,cableInter:'Câble 5G1,5'}],groupCable:'Câble 3G2,5',groupLong:6,goulottes:[],condLong:3,support:'Support sol',pompeType:'Aucune',pompeQte:1,
        taille:'auto',extras:extras||[],heures:3,moMode:'heures',rateChoice:'45',rateCustom:45,acces:'0',zone:'0-10 km',mes:'Monosplit',brasure:'Brasure simple',supp:0,tests:'vide',tvaRate:10,acompteOn:false,acomptePct:30,notes:''});
      const d1=base('abd'+i+'a','accepte'); d1.datePlanif=dem; d1.momentPlanif='matin'; d1.facSolde={num:'TEST-F-'+an+'-'+String(100+i),date:t,montant:1200+i,payeLe:t,mode:'Virement'};
      const d2=base('abd'+i+'b','envoye'); d2.sentAt=Date.parse(__REF.horloge)-9*86400000;
      DEVIS.push(d1,d2); save(LS.devis,DEVIS);
      DEP.push({id:'abp'+i,created:Date.now(),date:t,statut:'facturee',facNum:'TEST-F-'+an+'-'+String(200+i),facDate:t,payeLe:null,itype:'dep',cNom:nom,cTel:c.tel,cMail:c.mail,cType:'Professionnel',cAdr:c.adr,cVille:c.ville,desc:'Dépannage essai '+i,notes:'',mode:'forfaitH',panne:'',heures:1,rateChoice:'75',rateCustom:75,zone:'0-10 km',maj:'0',pieces:[],mesMode:'forfait',mesType:'Monosplit',heuresSup:0,nbRaccords:4}); save(LS.dep,DEP);
      LOC.push({id:'abl'+i,num:'LOC-'+an+'-'+i,created:Date.now(),cNom:nom,cTel:c.tel,cAdr:c.adr,cVille:c.ville,dateDebut:t,dateFin:AB.plus(t,2),items:[{ref:'Adia essai',qte:1,tarif:100}],livraison:50,reprise:0,nettoyage:0,caution:0,statut:'reserve'}); save(LS.loc,LOC);
      CTR.push({id:'abk'+i,clientNom:nom,type:'Climatisation',prix:150,visites:1,prochaineVisite:t,actif:false,facs:[]}); save('cp2_contrats',CTR);
      const pose=new Date(__REF.horloge); pose.setMonth(pose.getMonth()-23);
      EQUIP.push({id:'abe'+i,client:nom,type:'Monosplit',marque:'Daikin',modele:'FTXM',serie:'SN'+i,datePose:pose.toISOString().slice(0,10),garantie:24,fluide:'R32',charge:0.8}); save('cp2_equip',EQUIP);
      FLU.push({id:'abf'+i,num:'FF-'+an+'-'+String(100+i),date:t,client:nom,desc:'Clim essai '+i,fluide:'R32',nature:'entretien',qv:0.5,qrec:0,qreg:0,qrt:0,qru:0,ctrl:'ok'}); save('cp2_fluides',FLU);
      return {id:c.id,nom,devis:d1.id,devisEnvoye:d2.id,fac:d1.facSolde.num};
    },
    plus(iso,n){ const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); },
    /* les boutons qui portent le nom du client : chacun doit faire son travail avec le nom exact */
    async boutons(idClient){
      const c=CLIENTS.find(x=>x.id===idClient), nom=c.nom, out={}; const val=id=>(document.getElementById(id)||{}).value; const raz=()=>['ct_client','eq_client','f_cNom'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; }); AB.reset();
      AB.ferme(); go('contrats'); await attendre(60);
      const td=[...document.querySelectorAll('#ctrTable td[onclick]')].find(x=>x.textContent.trim()===nom);
      if(td){ td.click(); await attendre(60); out.contratsCellule=(window._curView==='client360'&&window._cliId===c.id)||('vue '+window._curView); } else out.contratsCellule='cellule introuvable';
      AB.ferme(); go('contrats'); await attendre(60);
      const ligne=[...document.querySelectorAll('#garTable .recap-line')].find(l=>l.textContent.includes(nom)), bg=ligne&&ligne.querySelector('button.btn-pri');
      raz(); if(bg){ bg.click(); await attendre(60); out.proposerContrat=(val('ct_client')===nom&&document.getElementById('mCtr').classList.contains('on'))||('champ « '+val('ct_client')+' »'); } else out.proposerContrat='bouton introuvable';
      AB.ferme(); openClient360(c.id); await attendre(60);
      const btn=re=>[...document.querySelectorAll('#c360 button')].find(x=>re.test(x.textContent));
      /* « Nouveau devis » : la couche devis v2 intercepte le clic et ouvre le choix de la nature AVEC le client ; sans elle, l'ancien formulaire s'ouvre avec le client */
      raz(); let b=btn(/Nouveau devis/); if(b){ b.click(); await attendre(120); const ch=document.getElementById('nxd2Choose'); out.nouveauDevis=ch?((ch._opt&&ch._opt.client)===nom||('client du choix « '+(ch._opt&&ch._opt.client)+' »')):((window._curView==='wizard'&&val('f_cNom')===nom)||('vue '+window._curView+' champ « '+val('f_cNom')+' »')); if(ch) ch.remove(); } else out.nouveauDevis='bouton introuvable';
      AB.ferme(); openClient360(c.id); await attendre(60);
      raz(); b=btn(/^\\+ Contrat/); if(b){ b.click(); await attendre(60); out.plusContrat=(val('ct_client')===nom)||('champ « '+val('ct_client')+' »'); } else out.plusContrat='bouton introuvable';
      AB.ferme(); raz(); b=btn(/\\+ Équipement/); if(b){ b.click(); await attendre(60); out.plusEquipement=(val('eq_client')===nom)||('champ « '+val('eq_client')+' »'); } else out.plusEquipement='bouton introuvable';
      AB.ferme(); raz(); b=btn(/Nouveau contrat/); if(b){ b.click(); await attendre(60); out.nouveauContrat=(val('ct_client')===nom)||('champ « '+val('ct_client')+' »'); } else out.nouveauContrat='bouton introuvable';
      AB.ferme(); go('nx_journee'); nxjMode('soir'); await attendre(120);
      const row=[...document.querySelectorAll('.nxm-row')].find(r=>{ const b2=r.querySelector('.nxm-h b'); return b2&&b2.textContent===nom; }), pb=row&&row.querySelector('.nx-sbtn.ref');
      if(pb){ const avant=nxmsgCandidats().veille.some(x=>x.nom===nom); pb.click(); await attendre(80); const apres=nxmsgCandidats().veille.some(x=>x.nom===nom); out.plusDeMessages=(avant&&!apres)||('avant '+avant+' après '+apres); } else out.plusDeMessages='ligne introuvable';
      AB.ferme(); out.execute=AB.xss()===undefined?true:'texte exécuté'; return out;
    }
  };
})();`;
async function bloc(nom, fn) { try { await fn(); } catch (e) { rec(G(nom), 'Bloc en erreur (plantage du test)', false, String(e && e.stack || e).slice(0, 400)); } }
const essai = (p, code) => p.evaluate(code).catch((e) => ({ erreur: String(e).slice(0, 400) }));
const nomsStockes = (p) => p.evaluate(() => CLIENTS.filter((c) => /^abc\d$/.test(c.id)).map((c) => c.nom));
const texteOk = (texte, noms) => noms.filter((n) => !texte.includes(n));
async function pageAppli(opts = {}) {
  const r = await page({ mobile: false, horloge: REF.horloge, wait: 2500, cspReelle: true, ...opts }); suivre(r.ctx); await r.p.evaluate(PREP); return r;
}
const sha384 = (f) => 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(f)).digest('base64');
const lireApp = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

/* ============================ AB1 — noms de clients ============================ */
const { p, ctx, errs } = await pageAppli();
let CLI = [];
await bloc('AB1', async () => {
  const g = G('AB1 clients');
  CLI = await p.evaluate(() => AB.TEXTES.map((t, i) => AB.jeu(t, i)));
  const noms = await nomsStockes(p);
  rec(g, '8 fiches clients créées avec le jeu de textes (le nettoyage au stockage ne change que les balises)', CLI.length === 8 && noms.length === 8, j(noms));
  const ecrans = ['clients', 'contrats', 'loc', 'plan', 'relances', 'commander', 'nx_journee', 'dash', 'recettes', 'dep', 'fluides', 'tous', 'nx_docs'];
  const attenduNom = { clients: 1, contrats: 1, loc: 1, plan: 1, relances: 1, commander: 1, nx_journee: 1, dash: 1, recettes: 1, dep: 1, fluides: 1, tous: 1 };
  const manques = [], exec = [], ouvertureErr = [];
  for (const v of ecrans) {
    const e0 = errs.length;
    const r = await essai(p, `(async()=>{ const e=await AB.ouvrir(${j(v)}); return {e,xss:AB.xss(),texte:AB.texte()}; })()`);
    if (r.erreur || r.e) { ouvertureErr.push(v + ' : ' + (r.erreur || r.e)); continue; }
    if (r.xss !== undefined) exec.push(v + ' (ouverture / survol)');
    if (attenduNom[v]) { const m = texteOk(r.texte, noms); if (m.length) manques.push(v + ' : ' + j(m)); }
    if (errs.length > e0) ouvertureErr.push(v + ' : ' + errs.slice(e0).join(' / ').slice(0, 200));
  }
  for (const c of CLI) {
    const r = await essai(p, `(async()=>{ AB.ferme(); openClient360(${j(c.id)}); await AB.attendre(150); AB.hover(); await AB.attendre(200); return {xss:AB.xss(),texte:AB.texte()}; })()`);
    if (r.erreur) ouvertureErr.push('fiche 360 ' + c.id + ' : ' + r.erreur); else { if (r.xss !== undefined) exec.push('fiche 360 ' + c.id); if (!r.texte.includes(c.nom)) manques.push('fiche 360 : ' + j(c.nom)); }
  }
  const rw = await essai(p, `(async()=>{ AB.ferme(); openDevis(${j(CLI[2].devis)}); await AB.attendre(200); AB.hover(); await AB.attendre(200); const f=document.getElementById('f_cNom'); return {xss:AB.xss(),val:f&&f.value,texte:AB.texte()}; })()`);
  rec(g, 'Tous les écrans s\'ouvrent (' + ecrans.length + ' écrans + 8 fiches 360 + éditeur)', ouvertureErr.length === 0 && !rw.erreur, ouvertureErr.join(' | ') || rw.erreur);
  rec(g, 'Aucun texte piégé ne s\'exécute à l\'ouverture ni au survol des écrans', exec.length === 0 && rw.xss === undefined, exec.join(' | '));
  rec(g, 'Chaque nom est affiché à l\'identique sur chaque écran qui le porte', manques.length === 0, manques.slice(0, 8).join(' | '));
  rec(g, 'Éditeur de devis : le nom du client « Dupont " Fils » est dans le champ client', rw.val === CLI[2].nom, j(rw.val));
  /* les boutons réparés : nom avec apostrophe, nom avec guillemet (avant les clics généraux, qui excluent les clients des messages) */
  for (const k of [0, 2]) {
    const r = await essai(p, `AB.boutons(${j(CLI[k].id)})`);
    const ok = !r.erreur && Object.values(r).every((x) => x === true);
    rec(g, 'Boutons qui portent le nom « ' + CLI[k].nom + ' » : cellule des contrats, « Proposer un contrat », « Nouveau devis » (choix de la nature avec ce client), « + Contrat », « + Équipement », « Nouveau contrat », « Plus de messages »', ok, j(r));
  }
  /* clics sur chaque bouton de ces écrans */
  const clicErr = [], clicExec = []; let nClics = 0;
  for (const v of ecrans) {
    const r = await essai(p, `AB.clics(${j(v)})`);
    if (r.erreur) clicErr.push(v + ' : ' + r.erreur); else { nClics += r.faits; if (r.xss !== undefined) clicExec.push(v); if (r.erreurs.length) clicErr.push(v + ' : ' + r.erreurs.slice(0, 3).join(' ; ')); }
  }
  for (const c of CLI) { const r = await essai(p, `AB.clics('client360',()=>openClient360(${j(c.id)}))`); if (r.erreur) clicErr.push('fiche 360 : ' + r.erreur); else { nClics += r.faits; if (r.xss !== undefined) clicExec.push('fiche 360 ' + c.id); } }
  rec(g, 'Clic sur ' + nClics + ' boutons de ces écrans : aucun texte piégé exécuté', clicExec.length === 0 && clicErr.length === 0, (clicExec.length ? 'exécuté : ' + clicExec.join(', ') : '') + ' ' + clicErr.slice(0, 5).join(' | '));
  rec(g, 'Aucune erreur JavaScript pendant AB1', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});

/* ============================ AB2 — articles ============================ */
await bloc('AB2', async () => {
  const g = G('AB2 articles');
  const r = await essai(p, `(async()=>{
    const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
    const csv='Référence;Désignation;Prix net;Unité\\n'+AB.TEXTES.map((t,i)=>'REFAB'+i+';'+q(t)+';'+(10+i)+';'+q(t)).join('\\n');
    const rows=nxcatParseCSV(csv); const imp=await nxcatImportRows('Fournisseur Essai',rows);
    const trouves=await nxcatSearch('REFAB',60); const noms=trouves.map(e=>nxcatPromote(e));
    AB.TEXTES.forEach((t,i)=>nxaApply.article({nom:'Article catégorie '+i,cat:t,unite:'u',achat:5}));
    const d={id:'abx2',num:'DV-'+__REF.an+'1020-TST-ABX2',cNom:CLIENTS[0].nom,cTel:'',cMail:'',cType:'Professionnel',cAdr:'',cVille:'',type:'Monosplit',statut:'accepte',date:__REF.jour,created:Date.parse(__REF.horloge),
      nbMach:1,nbSplit:1,machines:[{marque:'D',ref:'X',achat:1000,marge:35}],splits:[{long:5,liaison:'Liaison 1/4 - 3/8',puiss:2.5,cableInter:'Câble 5G1,5'}],groupCable:'Câble 3G2,5',groupLong:6,goulottes:[],condLong:3,support:'Support sol',pompeType:'Aucune',pompeQte:1,
      taille:'auto',extras:noms.map(n=>({nom:n,qte:2})),heures:3,moMode:'heures',rateChoice:'45',rateCustom:45,acces:'0',zone:'0-10 km',mes:'Monosplit',brasure:'Brasure simple',supp:0,tests:'vide',tvaRate:10,acompteOn:false,acomptePct:30,notes:''};
    DEVIS.push(d); save(LS.devis,DEVIS);
    const mat=compute(d).mat.map(m=>m.nom);
    return {imp:imp.n,noms,mat,cats:[...new Set(PRIX.map(p=>p.cat))].length};
  })()`);
  rec(g, 'Import de tarif simulé (8 lignes) puis « Ma base » : 8 articles dans la base de prix, 8 catégories créées par l\'assistant, un devis accepté les utilise', !r.erreur && r.imp === 8 && r.noms.length === 8 && r.mat.length >= 8, j(r).slice(0, 300));
  const NOMS = r.noms || [], NOMS_DEVIS = (r.mat || []).filter((n) => /réf REFAB\d/.test(n));
  const manques = [], exec = [], ouv = [];
  for (const v of ['prix', 'commander', 'tous']) {
    const e0 = errs.length;
    const x = await essai(p, `(async()=>{ const e=await AB.ouvrir(${j(v)}); return {e,xss:AB.xss(),texte:AB.texte()}; })()`);
    if (x.erreur || x.e) ouv.push(v + ' : ' + (x.erreur || x.e)); else { if (x.xss !== undefined) exec.push(v); if (v !== 'tous') { const m = texteOk(x.texte, v === 'prix' ? NOMS : NOMS_DEVIS); if (m.length) manques.push(v + ' : ' + j(m).slice(0, 200)); } }
    if (errs.length > e0) ouv.push(v + ' : ' + errs.slice(e0).join(' / ').slice(0, 200));
  }
  const w = await essai(p, `(async()=>{ AB.ferme(); AB.reset(); openDevis('abx2'); await AB.attendre(200); recalc(); showStep&&showStep(4); await AB.attendre(100); AB.hover(); await AB.attendre(200); const rec=(document.getElementById('recapDetail')||{}).innerText||''; return {xss:AB.xss(),texte:AB.texte()+rec,rec}; })()`);
  if (w.erreur) ouv.push('éditeur : ' + w.erreur); else { if (w.xss !== undefined) exec.push('éditeur (articles, récapitulatif)'); }
  const bc = await essai(p, `(async()=>{ AB.ferme(); AB.reset(); cmdView='article'; go('commander'); await AB.attendre(100); window.__rep='Fournisseur Essai'; const op=window.print; window.print=()=>{}; try{ nxBonCommande(); } finally{ window.print=op; } await AB.attendre(250); AB.hover(); await AB.attendre(200); return {xss:AB.xss(),texte:(document.getElementById('devisDoc')||{}).innerText||''}; })()`);
  if (bc.erreur) ouv.push('bon de commande : ' + bc.erreur); else { if (bc.xss !== undefined) exec.push('bon de commande'); const m = texteOk(bc.texte, NOMS_DEVIS); if (m.length) manques.push('bon de commande : ' + j(m).slice(0, 200)); }
  rec(g, 'Base de prix, à commander, liste des devis, éditeur (articles et récapitulatif), bon de commande PDF : ouverts sans erreur', ouv.length === 0, ouv.join(' | '));
  rec(g, 'Aucun texte piégé exécuté (ouverture, survol) sur ces écrans', exec.length === 0, exec.join(' | '));
  rec(g, 'Désignations et unités affichées à l\'identique (base de prix : 8 noms ; à commander et bon de commande : ' + NOMS_DEVIS.length + ' noms tels que le devis les garde)', manques.length === 0 && NOMS_DEVIS.length >= 7, manques.join(' | ') + ' devis=' + NOMS_DEVIS.length);
  const f = await essai(p, `(async()=>{ AB.ferme(); AB.reset(); go('prix'); await AB.attendre(100); const out={}; const tags=[...document.querySelectorAll('#prixCats span')];
    for(const t of tags){ const cat=t.textContent.trim(); try{ t.click(); }catch(e){ out[cat]='ERR '+e.message; continue; } await AB.attendre(40); out[cat]=(prixCatFilter===cat)||('filtre « '+prixCatFilter+' »'); }
    prixCatFilter='Tous'; renderPrix(); return {out,xss:AB.xss()}; })()`);
  const fOk = !f.erreur && Object.values(f.out).every((x) => x === true) && f.xss === undefined;
  rec(g, 'Filtres de catégorie : chaque étiquette filtre sur sa catégorie exacte (apostrophe, guillemet compris), aucune exécution', fOk, j(f).slice(0, 400));
  const st = await essai(p, `(async()=>{ AB.ferme(); AB.reset(); cmdView='article'; go('commander'); await AB.attendre(100); const out={};
    for(const n of ${j(NOMS_DEVIS)}){ const tr=[...document.querySelectorAll('#cmdTable tbody tr')].find(x=>(x.querySelector('td:nth-child(2) b')||{}).textContent===n); const inp=tr&&tr.querySelector('td:nth-child(4) input'); if(!inp){ out[n]='ligne introuvable'; continue; }
      inp.value='3'; inp.dispatchEvent(new Event('change',{bubbles:true})); await AB.attendre(60); out[n]=(STOCK[n]===3)||('stock '+j(STOCK[n])); }
    return {out,xss:AB.xss()}; })()`);
  const stOk = !st.erreur && Object.values(st.out).every((x) => x === true) && st.xss === undefined;
  rec(g, 'À commander : le champ « En stock » enregistre le stock de l\'article exact (apostrophe, guillemet compris), aucune exécution', stOk, j(st).slice(0, 400));
  const cl = await essai(p, `(async()=>{ const a=await AB.clics('prix'), b=await AB.clics('commander'); return {faits:a.faits+b.faits,erreurs:a.erreurs.concat(b.erreurs),xss:[a.xss,b.xss]}; })()`);
  rec(g, 'Clic sur ' + (cl.faits || 0) + ' boutons (base de prix, à commander) : aucun texte piégé exécuté', !cl.erreur && cl.xss.every((x) => x === undefined) && !cl.erreurs.length, j(cl).slice(0, 300));
  rec(g, 'Aucune erreur JavaScript pendant AB2', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});

/* ============================ AB3 — réservation du site ============================ */
await bloc('AB3', async () => {
  const g = G('AB3 réservation');
  const r = await essai(p, `(async()=>{
    const o1=window.nxaSiteLigne, o2=window.nxaSiteTraite; const ids=[]; window.nxaSiteTraite=()=>Promise.resolve();
    AB.TEXTES.forEach((t,i)=>{ const jour=AB.plus(__REF.jour,3);
      window.nxaSiteLigne=()=>({id:'in'+i,created_at:__REF.horloge,payload:{type:'site_reservation',champs:{nom:t,telephone:'09 7'+i+' 00 00 0'+i,email:'site'+i+'@exemple.org',prestation:'Entretien clim (forfait 110 €)',jour:jour,moment:'Matin',adresse:'1 rue du Site',commune:'Clermont',equipement:'Monosplit',acompte:'33 € à régler',profil:'home'},meta:{rid:'r'+i}}});
      ids.push(nxtrPlanifierSite('in'+i)); });
    window.nxaSiteLigne=o1; window.nxaSiteTraite=o2;
    const deps=ids.map(id=>DEP.find(d=>d.id===id)).filter(Boolean);
    return {n:deps.length,noms:deps.map(d=>d.cNom),clients:CLIENTS.filter(c=>/^abc\\d$/.test(c.id)).length};
  })()`);
  rec(g, '8 demandes du site planifiées (une par texte) : 8 interventions, aucune fiche client en double', !r.erreur && r.n === 8 && r.clients === 8, j(r).slice(0, 300));
  const exec = [], manques = [], ouv = [];
  for (const v of ['plan', 'dep', 'clients', 'nx_journee']) {
    const x = await essai(p, `(async()=>{ const e=await AB.ouvrir(${j(v)}); return {e,xss:AB.xss(),texte:AB.texte()}; })()`);
    if (x.erreur || x.e) ouv.push(v + ' : ' + (x.erreur || x.e)); else { if (x.xss !== undefined) exec.push(v); const m = texteOk(x.texte, r.noms || []); if (m.length) manques.push(v + ' : ' + j(m).slice(0, 160)); }
  }
  const cl = await essai(p, `(async()=>{ let f=0; const er=[], ex=[]; for(const v of ['plan','dep','nx_journee']){ const a=await AB.clics(v); f+=a.faits; er.push(...a.erreurs); if(a.xss!==undefined) ex.push(v); } return {faits:f,er,xss:ex.length?ex.join(','):undefined}; })()`);
  rec(g, 'Planning, interventions, clients, Ma journée : ouverts, noms affichés à l\'identique, aucune exécution (ouverture, survol, ' + (cl.faits || 0) + ' clics)', ouv.length === 0 && exec.length === 0 && manques.length === 0 && !cl.erreur && cl.xss === undefined, [...ouv, ...exec.map((x) => 'exécuté : ' + x), ...manques].join(' | ') + (cl.xss !== undefined ? ' exécuté au clic' : ''));
  rec(g, 'Aucune erreur JavaScript pendant AB3', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});

/* ============================ AB4 — assistant ============================ */
await bloc('AB4', async () => {
  const g = G('AB4 assistant');
  const r = await essai(p, `(async()=>{
    const res=AB.TEXTES.map((t,i)=>[nxaApply.client({nom:t,tel:'03 44 99 00 0'+i}),nxaApply.machine({marque:t,ref:'REF-IA-'+i,achat:900}),nxaApply.article({nom:'Article IA '+i,cat:t,unite:t,achat:7})]);
    return {res,machines:MACHLIB.filter(m=>/REF-IA-/.test(m.ref)).map(m=>m.marque),articles:PRIX.filter(p=>/^Article IA/.test(p.nom)).map(p=>p.unite)};
  })()`);
  rec(g, 'Assistant : 8 clients mis à jour, 8 machines et 8 articles créés automatiquement avec le jeu de textes (balises retirées par l\'assistant)', !r.erreur && r.res.every((x) => x.every(Boolean)) && r.machines.length === 8 && r.articles.length === 8, j(r).slice(0, 300));
  const exec = [], ouv = [];
  for (const v of ['clients', 'prix']) { const x = await essai(p, `(async()=>{ const e=await AB.ouvrir(${j(v)}); return {e,xss:AB.xss()}; })()`); if (x.erreur || x.e) ouv.push(v); else if (x.xss !== undefined) exec.push(v); }
  const w = await essai(p, `(async()=>{ AB.ferme(); AB.reset(); openDevis('abx2'); await AB.attendre(200); showStep&&showStep(2); await AB.attendre(100); AB.hover(); await AB.attendre(200); const opts=[...document.querySelectorAll('#v-wizard select option')].map(o=>o.textContent); return {xss:AB.xss(),opts:opts.filter(o=>/REF-IA-/.test(o)).length}; })()`);
  rec(g, 'Clients, base de prix, éditeur (bibliothèque de machines) : aucune exécution ; les 8 machines sont proposées', ouv.length === 0 && exec.length === 0 && !w.erreur && w.xss === undefined && w.opts === 8, j({ ouv, exec, w }).slice(0, 300));
  rec(g, 'Aucune erreur JavaScript pendant AB4', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});

/* ============================ AB5 — facture reçue (plateforme simulée) ============================ */
await bloc('AB5', async () => {
  const g = G('AB5 plateforme');
  const r = await essai(p, `(async()=>{
    const chain=()=>{ const f=function(){ return P; }; const P=new Proxy(f,{get(t,k){ if(k==='then') return (res)=>Promise.resolve({data:[],error:null}).then(res); return chain(); },apply(){ return P; }}); return P; };
    window.sb={rpc:async()=>({data:null}),from:()=>chain(),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){},auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({})},
      functions:{invoke:async(name,{body})=>{ switch(body.action){
        case 'status': return {data:{connecte:true,env:'sandbox',company:{id:7,nom:'Tricatel',siren:'000000001'},client_id:'abc123…'}};
        case 'list': return {data:{items:AB.TEXTES.map((t,i)=>({id:100+i,direction:'in',numero:t,date:__REF.an+'-09-28',vendeur:'Fournisseur '+i,total:100+i,events:[{code:'fr:203',texte:'Mise à disposition',at:__REF.an+'-09-28T09:00:00Z'}]})),has_after:false}};
        case 'download': return {data:{type:'application/xml',base64:btoa('<x/>')}}; }
        return {data:{erreur:'action'}}; }}};
    window.SESS={user:{id:'99999999-9999-4999-8999-999999999999',email:'g@x.fr'}};
    window.__dl=[]; window.nxPdpDownload=function(id,num){ __dl.push([id,num]); };
    AB.ferme(); AB.reset(); go('nx_pdp'); await AB.attendre(300); nxPdpLoadReceived(); await AB.attendre(400); AB.hover(); await AB.attendre(200);
    const xssAvant=AB.xss(); AB.reset(); const out={};
    const rows=[...document.querySelectorAll('#nxpdpRecu tbody tr')];
    for(const tr of rows){ const num=tr.querySelector('td:nth-child(2)').textContent; const b=[...tr.querySelectorAll('button')].find(x=>/Fichier/.test(x.textContent)); if(!b){ out[num]='bouton introuvable'; continue; } try{ b.click(); }catch(e){ out[num]='ERR '+e.message; } }
    await AB.attendre(100);
    return {n:rows.length,xssAvant,xss:AB.xss(),dl:__dl,out,texte:(document.getElementById('nxpdpRecu')||{}).innerText||''};
  })()`);
  const attendu = TEXTES.map((t, i) => [100 + i, t]);
  rec(g, 'Factures reçues : 8 lignes affichées, numéros à l\'identique, aucune exécution à l\'affichage', !r.erreur && r.n === 8 && r.xssAvant === undefined && texteOk(r.texte || '', TEXTES).length === 0, j(r && { n: r.n, xssAvant: r.xssAvant, manque: texteOk(r.texte || '', TEXTES) }).slice(0, 300));
  rec(g, 'Bouton « Fichier » : appelé avec le numéro exact pour les 8 lignes, aucune exécution', !r.erreur && r.xss === undefined && j(r.dl) === j(attendu), j({ dl: r.dl, out: r.out, xss: r.xss }).slice(0, 500));
  rec(g, 'Aucune erreur JavaScript pendant AB5', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});

/* ============================ AB7 — réservation au nom d'un client existant ============================ */
await bloc('AB7', async () => {
  const g = G('AB7 réservation : champs vides');
  const r = await essai(p, `(async()=>{
    const c={id:'ab7',nom:'Boulangerie Dupré',tel:'03 44 11 22 33',mail:'b@d.fr',type:'Professionnel',adr:'5 Rue de la Gare',ville:'60600 Clermont',notes:'Code portail 1234'}; CLIENTS.push(c); save(LS.clients,CLIENTS);
    const n0=CLIENTS.length, o1=window.nxaSiteLigne, o2=window.nxaSiteTraite; window.nxaSiteTraite=()=>Promise.resolve();
    const demande=(id,ch)=>{ window.nxaSiteLigne=()=>({id,created_at:__REF.horloge,payload:{type:'site_reservation',champs:Object.assign({prestation:'Entretien clim (forfait 110 €)',jour:AB.plus(__REF.jour,4),moment:'Matin'},ch),meta:{}}}); return nxtrPlanifierSite(id); };
    const id1=demande('ab7a',{nom:'boulangerie  dupré ',telephone:'',email:'',adresse:'',commune:''});
    const apres1=JSON.parse(JSON.stringify(CLIENTS.find(x=>x.id==='ab7'))), n1=CLIENTS.length;
    const id2=demande('ab7b',{nom:'Boulangerie Dupré',telephone:'09 70 00 00 07',email:'autre@exemple.org',adresse:'9 rue Nouvelle',commune:'60200 Compiègne'});
    const apres2=JSON.parse(JSON.stringify(CLIENTS.find(x=>x.id==='ab7'))), n2=CLIENTS.length;
    window.nxaSiteLigne=o1; window.nxaSiteTraite=o2;
    return {id1,id2,n0,n1,n2,apres1,apres2};
  })()`);
  const a1 = r.apres1 || {}, a2 = r.apres2 || {};
  rec(g, 'Demande sans téléphone ni e-mail, nom écrit autrement (majuscules, espaces) : fiche retrouvée, aucune fiche en double, rien d\'effacé', !r.erreur && !!r.id1 && r.n1 === r.n0 && a1.tel === '03 44 11 22 33' && a1.mail === 'b@d.fr' && a1.type === 'Professionnel' && a1.adr === '5 Rue de la Gare' && a1.ville === '60600 Clermont' && a1.nom === 'Boulangerie Dupré', j({ n0: r.n0, n1: r.n1, a1 }).slice(0, 400));
  rec(g, 'Demande avec un téléphone et un e-mail différents : la fiche garde les siens, la différence est notée dans la fiche', !r.erreur && !!r.id2 && r.n2 === r.n0 && a2.tel === '03 44 11 22 33' && a2.mail === 'b@d.fr' && /09 70 00 00 07/.test(a2.notes || '') && /autre@exemple\.org/.test(a2.notes || '') && /site/i.test(a2.notes || '') && /Code portail 1234/.test(a2.notes || ''), j({ n2: r.n2, a2 }).slice(0, 400));
  rec(g, 'Aucune erreur JavaScript pendant AB7', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});

/* ============================ AB9 — exports CSV ============================ */
await bloc('AB9', async () => {
  const g = G('AB9 CSV');
  const r = await essai(p, `(async()=>{
    const fac=${j(CLI[7] && CLI[7].fac)}; const d=DEVIS.find(x=>x.id===${j(CLI[7] && CLI[7].devis)});
    let avoir=null; try{ avoir=nxCreateAvoir({facNum:fac,montant:40,motif:'Geste commercial'}); }catch(e){ avoir={erreur:String(e)}; }
    const lire=async(fn)=>{ __blobs.length=0; try{ fn(); }catch(e){ return 'ERREUR '+e.message; } await AB.attendre(150); const t=[]; for(const b of __blobs) t.push(await b.text()); return t.join('\\n=====\\n'); };
    AB.ferme(); go('recettes'); await AB.attendre(100);
    const out={};
    out.recettes=await lire(()=>exportCSVRecettes());
    out.livre=await lire(()=>nxrgLivre());
    out.facturier=await lire(()=>nxrgFacturier());
    out.registre=await lire(()=>nxExportDocsCSV());
    out.devis=await lire(()=>exportCSV());
    out.depannages=await lire(()=>exportCSVDep());
    return {out,avoir:avoir&&(avoir.av?avoir.av.num:avoir)};
  })()`);
  const cellules = (csv) => String(csv || '').split(/\r?\n/).flatMap((l) => l.split(';'));
  const formule = /^\uFEFF?"?'?=HYPERLINK/;
  for (const k of ['recettes', 'livre', 'facturier', 'registre', 'devis', 'depannages']) {
    const csv = (r.out || {})[k] || '';
    const cel = cellules(csv).filter((c) => /HYPERLINK/.test(c));
    const neutres = cel.filter((c) => /^"?'=HYPERLINK/.test(c.replace(/^\uFEFF/, '')));
    rec(g, 'Export « ' + k + ' » : la cellule « ' + TEXTES[7] + ' » est présente et neutralisée (apostrophe en tête), jamais une formule', cel.length > 0 && neutres.length === cel.length && !/ERREUR/.test(csv.slice(0, 20)), j({ trouvees: cel.length, neutres: neutres.length, exemple: cel[0] }).slice(0, 300));
  }
  const factu = (r.out || {}).facturier || '';
  const negatifs = cellules(factu).filter((c) => /^"-\d/.test(c)), prefixes = cellules(factu).filter((c) => /^"'[-+=@]/.test(c) && !/HYPERLINK/.test(c));
  rec(g, 'Facturier : l\'avoir apparaît en montant négatif, intact (aucun nombre préfixé)', negatifs.length >= 1 && prefixes.length === 0 && !!r.avoir, j({ avoir: r.avoir, negatifs: negatifs.slice(0, 3), prefixes: prefixes.slice(0, 3) }).slice(0, 300));
  rec(g, 'Aucune erreur JavaScript pendant AB9', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  errs.length = 0;
});
await ctx.close();

/* ============================ AB6 — sauvegarde restaurée ============================ */
await bloc('AB6', async () => {
  const g = G('AB6 sauvegarde restaurée');
  const { p, ctx, errs } = await pageAppli();
  const IDS = ["x');window.__xss=1;//", '<img src=x onerror=window.__xss=1>', 'a" onmouseover="window.__xss=1', 'ok-123_ABC'];
  const nav = p.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch((e) => 'pas de rechargement : ' + e.message);
  const r = await essai(p, `(async()=>{
    const ids=${j(IDS)}; const an=__REF.an, t=__REF.jour;
    const clients=AB.TEXTES.map((n,i)=>({id:ids[i%ids.length],nom:n,tel:'03 44 00 00 0'+i,mail:'',type:'Particulier',adr:'',ville:'',notes:''}));
    const devis=[{id:ids[0],num:'DV-'+an+'1020-TST-RESTAURE',cNom:AB.TEXTES[0],cTel:'',cMail:'',cType:'Professionnel',cAdr:'',cVille:'',type:'Monosplit',statut:'accepte',date:t,created:Date.parse(__REF.horloge),nbMach:1,nbSplit:1,machines:[{marque:'D',ref:'X',achat:1000,marge:35}],splits:[{long:5,liaison:'Liaison 1/4 - 3/8',puiss:2.5,cableInter:'Câble 5G1,5'}],groupCable:'Câble 3G2,5',groupLong:6,goulottes:[],condLong:3,support:'Support sol',pompeType:'Aucune',pompeQte:1,taille:'auto',extras:[],heures:3,moMode:'heures',rateChoice:'45',rateCustom:45,acces:'0',zone:'0-10 km',mes:'Monosplit',brasure:'Brasure simple',supp:0,tests:'vide',tvaRate:10,acompteOn:false,acomptePct:30,notes:''}];
    const customs=[{id:ids[1],nom:'Article restauré',cat:'Divers',unite:'u',achat:3,marge:35,src:'local'}];
    const o={format:'climpilot-export-complet-1',etat:{all:{cp2_clients:clients,cp2_devis:devis,cp2_prix_custom:customs},exported:__REF.horloge,compte:{devis:1,clients:clients.length}}};
    importJSON({files:[new File([JSON.stringify(o)],'sauvegarde-essai.json',{type:'application/json'})],value:''});
    return {dlg:__dlg.slice(-2)};
  })()`);
  const navr = await nav;
  await p.waitForFunction(() => window.nxStore && nxStore.ready && typeof window.compute === 'function' && Array.isArray(window.CLIENTS), null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800); await p.evaluate(PREP);
  const v = await essai(p, `(async()=>{
    const re=/^[A-Za-z0-9_-]{1,64}$/; const bad=[]; [['clients',CLIENTS],['devis',DEVIS],['prix',PRIX.filter(p=>p.src==='local')]].forEach(([k,a])=>a.forEach(x=>{ if(!re.test(String(x.id))) bad.push(k+':'+String(x.id).slice(0,30)); }));
    const journal=load('cpnext_journal',[]).filter(e=>e&&/id/i.test(String(e.type||''))&&/repar/i.test(String(e.type||'')));
    const noms=CLIENTS.map(c=>c.nom);
    const e1=await AB.ouvrir('clients'); const x1=AB.xss(); const t1=AB.texte(); const a=await AB.clics('clients'); const e2=await AB.ouvrir('tous'); const x2=AB.xss(); const t2=AB.texte(); const b=await AB.clics('tous'); const e3=await AB.ouvrir('prix'); const x3=AB.xss(); const c=await AB.clics('prix');
    const ex=[x1,x2,x3,a.xss,b.xss,c.xss].some(x=>x!==undefined)?1:undefined;
    return {bad,journal:journal.length,noms,t1,t2,clics:a.faits+b.faits+c.faits,xss:ex,e:[e1,e2,e3].filter(Boolean)};
  })()`);
  rec(g, 'Sauvegarde restaurée (confirmation acceptée, rechargement)', !r.erreur && typeof navr !== 'string' && !v.erreur, (r && r.erreur) || (typeof navr === 'string' ? navr : '') || (v && v.erreur) || '');
  rec(g, 'Identifiants invalides de la sauvegarde réparés au chargement (clients, devis, articles) et journalisés', !v.erreur && v.bad.length === 0 && v.journal >= 3, j({ bad: v.bad, journal: v.journal }).slice(0, 300));
  rec(g, 'Textes restaurés affichés à l\'identique (clients, devis), aucune exécution à l\'ouverture, au survol ni au clic (' + (v.clics || 0) + ' clics)', !v.erreur && v.xss === undefined && texteOk(v.t1 || '', v.noms || []).length === 0 && (v.t2 || '').includes((v.noms || [])[0] || '§') && v.e.length === 0, j({ xss: v.xss, manque: texteOk(v.t1 || '', v.noms || []), e: v.e }).slice(0, 300));
  rec(g, 'Aucune erreur JavaScript pendant AB6', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  await ctx.close();
});

/* ============================ AB8 — exemplaire signé téléchargé ============================ */
await bloc('AB8', async () => {
  const g = G('AB8 exemplaire signé');
  const b = await getBrowser(); const ctx = suivre(await b.newContext({ viewport: { width: 1000, height: 900 }, locale: 'fr-FR' })); const pg = await ctx.newPage(); const errs8 = [];
  pg.on('pageerror', (e) => errs8.push(String(e).slice(0, 160)));
  const PIEGE = '<p>Devis d\'essai</p><script>window.__xss=1</script><img src="x" onerror="window.__xss=1"><div data-retractation="1">annexe</div>';
  const DOC = { statut: 'signe', doc_type: 'devis', doc_num: 'DV-ESSAI-1', titre: 'Essai', client_nom: 'Client Essai', signer_nom: 'Client Essai', signed_at: REF.horloge, signature_png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', doc_hash: 'abc123', doc_html: PIEGE, consentement: 'oui' };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await pg.route(/\/functions\/v1\/signature/, (r) => { const body = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.action === 'copie' ? { ok: true, copie_le: REF.horloge, ...DOC } : DOC) }); });
  await pg.addInitScript(() => { window.__cspv = []; document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(e.violatedDirective + ' ' + (e.blockedURI || ''))); window.__blobs = []; URL.createObjectURL = (b) => { window.__blobs.push(b); return 'blob:capture-' + window.__blobs.length; }; });
  await pg.goto(URL_LOCALE + 'signer.html#t=00000000-0000-4000-8000-000000000000'); await pg.waitForTimeout(1200);
  const s = await pg.evaluate(async () => { const b = document.getElementById('dl'); if (!b) return { erreur: 'bouton Télécharger absent : ' + document.body.innerText.slice(0, 120) }; b.click(); await new Promise((r) => setTimeout(r, 600)); const t = []; for (const x of window.__blobs) t.push(await x.text()); return { xssPage: window.__xss, n: t.length, html: t[0] || '', cspv: window.__cspv, img: !!document.querySelector('img.sigimg') }; });
  rec(g, 'Page de signature (document signé, serveur simulé) : exemplaire produit, page sans exécution, image de signature affichée', !s.erreur && s.n === 1 && s.xssPage === undefined && s.img, j({ erreur: s.erreur, n: s.n, xss: s.xssPage }).slice(0, 300));
  rec(g, 'Exemplaire : le fichier porte une CSP qui interdit les scripts', /http-equiv="Content-Security-Policy"[^>]*script-src 'none'|http-equiv="Content-Security-Policy"[^>]*default-src 'none'/i.test(s.html || ''), (s.html || '').slice(0, 200));
  const pg2 = await ctx.newPage(); await pg2.route(/\/__exemplaire\.html$/, (r) => r.fulfill({ status: 200, contentType: 'text/html;charset=utf-8', body: s.html || '' })); await pg2.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await pg2.goto(URL_LOCALE + '__exemplaire.html'); await pg2.waitForTimeout(700);
  const ex = await pg2.evaluate(() => ({ xss: window.__xss, texte: document.body.innerText, sig: [...document.images].map((i) => i.getAttribute('src').slice(0, 30)) }));
  rec(g, 'Exemplaire ouvert par le client : aucun script ne s\'exécute, le texte du devis et la preuve de signature sont là', ex.xss === undefined && /Devis d'essai/.test(ex.texte) && /Client Essai/.test(ex.texte) && /abc123/.test(ex.texte), j(ex).slice(0, 300));
  rec(g, 'Exemplaire : la signature est une image PNG embarquée', ex.sig.some((x) => /^data:image\/png;base64,/.test(x)), j(ex.sig));
  /* image de signature trafiquée : jamais une adresse extérieure */
  DOC.signature_png = 'https://exemple.invalid/pixel.png';
  await pg.reload(); await pg.waitForTimeout(1200);
  const s2 = await pg.evaluate(async () => { const b = document.getElementById('dl'); if (!b) return { erreur: 'absent' }; window.__blobs.length = 0; b.click(); await new Promise((r) => setTimeout(r, 500)); const t = []; for (const x of window.__blobs) t.push(await x.text()); return { imgs: [...document.images].map((i) => i.getAttribute('src')), fichier: t[0] || '' }; });
  const ext = (s2.imgs || []).filter((x) => /^https?:/.test(x || '')).length + ((s2.fichier || '').match(/src="https?:/g) || []).length;
  rec(g, 'Image de signature qui n\'est pas un PNG embarqué : ignorée sur la page et dans l\'exemplaire (pas d\'image extérieure)', !s2.erreur && ext === 0, j({ imgs: s2.imgs, ext }).slice(0, 300));
  rec(g, 'Page de signature : 0 violation de la CSP (cadre du document, image de signature)', Array.isArray(s.cspv) && s.cspv.length === 0, j(s.cspv));
  rec(g, 'Aucune erreur JavaScript sur la page de signature', errs8.length === 0, errs8.join(' | '));
  await ctx.close();
});

/* ============================ AB10 — CSP ============================ */
await bloc('AB10', async () => {
  const g = G('AB10 CSP');
  const idx = lireApp('index.html'), sgn = lireApp('signer.html');
  const meta = (h) => (h.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
  const mi = meta(idx), ms = meta(sgn);
  rec(g, 'index.html : balise CSP présente avant le premier script, origines de connexion = self, *.supabase.co, data.geopf.fr, recherche-entreprises.api.gouv.fr (jamais l\'adresse exacte du projet)', !!mi && idx.indexOf('http-equiv="Content-Security-Policy"') < idx.indexOf('<script') && /connect-src 'self' https:\/\/\*\.supabase\.co https:\/\/data\.geopf\.fr https:\/\/recherche-entreprises\.api\.gouv\.fr[ ;]/.test(mi) && !/[a-z0-9]{20}\.supabase\.co/.test(mi) && /object-src 'none'/.test(mi) && /base-uri 'self'/.test(mi) && /'wasm-unsafe-eval'/.test(mi) && /worker-src 'self' blob:/.test(mi), mi.slice(0, 300));
  rec(g, 'signer.html : balise CSP présente avant le premier script (default-src none, connexion *.supabase.co seulement)', !!ms && sgn.indexOf('http-equiv="Content-Security-Policy"') < sgn.indexOf('<script') && /default-src 'none'/.test(ms) && /connect-src https:\/\/\*\.supabase\.co[ ;]/.test(ms) && !/[a-z0-9]{20}\.supabase\.co/.test(ms), ms.slice(0, 300));
  /* copie d'essai : construction verte, CSP reprise, aucune trace de l'adresse réelle */
  const dir = out('essai-ab'); fs.rmSync(dir, { recursive: true, force: true });
  const es = spawnSync('bash', [path.join(RACINE, 'tools', 'essai', 'construire-copie-essai.sh'), dir], { encoding: 'utf8', timeout: 120000 });
  const dossier = fs.existsSync(dir) ? fs.readdirSync(dir).find((d) => /^ClimPilot-ESSAI-/.test(d) && fs.statSync(path.join(dir, d)).isDirectory()) : null;
  const copie = dossier ? fs.readFileSync(path.join(dir, dossier, 'index.html'), 'utf8') : '';
  rec(g, 'Copie d\'essai (tools/essai) : construction réussie avec la CSP, balise reprise telle quelle', es.status === 0 && !!dossier && meta(copie) === mi && !!mi, (es.stdout || '').trim().split('\n').pop() + ' ' + (es.stderr || '').slice(0, 200));
  /* 0 violation : tous les écrans, téléphone et PC, et les fonctions */
  const INIT = () => { window.__cspv = []; document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '').slice(-50))); };
  let xlsx = null; try { const X = createRequire(import.meta.url)(path.join(RACINE, 'vendor', fs.readdirSync(path.join(RACINE, 'vendor')).find((f) => /^xlsx-.*\.js$/.test(f)) || 'absent.js')); const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Référence', 'Désignation', 'Prix net', 'Unité'], ['R1', 'Tube cuivre 1/4', 3.5, 'm'], ['R2', 'Goulotte 80x60', 7.2, 'm']]), 'Tarif'); xlsx = Buffer.from(X.write(wb, { type: 'array', bookType: 'xlsx' })); } catch (e) { xlsx = null; }
  for (const mobile of [true, false]) {
    const { p, ctx, errs } = await page({ mobile, horloge: REF.horloge, wait: 2500, init: INIT, cspReelle: true }); suivre(ctx);
    await ctx.route(/recherche-entreprises\.api\.gouv\.fr/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results: [{ nom_complet: 'ESSAI SARL', siren: '000000001', siege: { adresse: '1 rue de l\'Essai', code_postal: '60000', libelle_commune: 'Beauvais' } }] }) }));
    await seed(p); await p.evaluate(PREP);
    const r = await essai(p, `(async()=>{
      const meta=(document.querySelector('meta[http-equiv="Content-Security-Policy"]')||{}).content||'';
      const views=[...new Set([...document.querySelectorAll('[data-v]')].map(a=>a.dataset.v))].concat(['nx_devis2']); const err=[];
      for(const v of views){ try{ if(v==='nx_devis2') NXD2.open(DEVIS[0],{tab:'client'}); else go(v); }catch(e){ err.push(v+': '+e.message); } await AB.attendre(80); AB.hover(); }
      AB.ferme();
      /* fonctions : adresses, SIREN, PDF, signature, ZIP, Excel */
      const f={};
      try{ const g=await fetch('https://data.geopf.fr/geocodage/search?q=5+rue+de+la+gare+clermont'); f.adresses=(await g.json()).features.length>0; }catch(e){ f.adresses='ERR '+e.message; }
      try{ const s=await fetch('https://recherche-entreprises.api.gouv.fr/search?q=essai'); f.siren=(await s.json()).results.length>0; }catch(e){ f.siren='ERR '+e.message; }
      try{ const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0); openDevis(acc[0].id); await AB.attendre(150); printDevis(); await AB.attendre(300); f.pdf=((document.getElementById('nx-pdf-page')||document.getElementById('devisDoc')||{}).innerText||'').length>200; AB.ferme(); }catch(e){ f.pdf='ERR '+e.message; }
      try{ f.signature=/signé électroniquement/.test(nxsSigBlock({nom:'Client Essai',at:__REF.horloge,png:'data:image/png;base64,iVBORw0KGgo=',hash:'abc'},'Devis')); }catch(e){ f.signature='ERR '+e.message; }
      try{ window.askMode=()=>'Virement'; const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0); const d=acc[1]||acc[0]; if(!d.facSolde){ await facturerDevis(d.id,'solde'); await AB.attendre(200); AB.ferme(); } __blobs.length=0; const n=await nxEinvExportYear(__REF.an); await AB.attendre(300); f.zip=n>0&&__blobs.length>0&&__blobs[0].size>100||('n='+n+' blobs='+__blobs.length); }catch(e){ f.zip='ERR '+e.message; }
      return {views:views.length,err,f,cspv:__cspv.slice(0,10),nCspv:__cspv.length,meta};
    })()`);
    let xl = { ok: 'pas de fichier Excel (vendor absent)' };
    if (xlsx) { xl = await p.evaluate(async (b64) => { try { const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const rows = await nxcatReadFile(new File([bytes], 'tarif.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); return { ok: rows.length === 3 && rows[1][1] === 'Tube cuivre 1/4', rows: rows.length }; } catch (e) { return { ok: 'ERR ' + e.message }; } }, xlsx.toString('base64')); }
    const cspv2 = await p.evaluate(() => window.__cspv.length);
    const G2 = mobile ? 'téléphone' : 'PC';
    rec(g, G2 + ' : ' + (r.views || '?') + ' écrans ouverts et survolés, 0 violation de la CSP', !r.erreur && r.err.length === 0 && r.nCspv === 0, j({ err: r.err, cspv: r.cspv }).slice(0, 400));
    /* sonde eval APRÈS un await : pendant la partie synchrone d'un appel de l'inspecteur (Playwright), Chromium autorise eval quelle que soit la CSP ; la politique de la page s'applique ensuite */
    const evalBloque = await p.evaluate(async () => { await new Promise((r) => setTimeout(r, 0)); try { eval('1'); return false; } catch (e) { return /unsafe-eval|EvalError/.test(String(e)); } }).catch((e) => 'ERR ' + e.message);
    rec(g, G2 + ' : la page testée porte la CSP réelle du dépôt (eval interdit, pas la version assouplie servie aux anciennes suites)', !r.erreur && r.meta === mi && evalBloque === true, j({ meta: (r.meta || '').slice(0, 80), evalBloque }));
    rec(g, G2 + ' : adresses, SIREN, PDF, signature, ZIP, import Excel fonctionnent sous la CSP, 0 violation', !r.erreur && Object.values(r.f).every((x) => x === true) && xl.ok === true && cspv2 === 0, j({ f: r.f, excel: xl, cspv: cspv2 }).slice(0, 400));
    rec(g, G2 + ' : aucune erreur JavaScript', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
    if (!mobile) {
      /* AB12 (rendu) : les noms avec apostrophe et guillemets du jeu de données s'impriment à l'identique */
      const v = await essai(p, `(async()=>{ AB.ferme(); const html=()=>{ const e=document.getElementById('nx-pdf-page')||document.getElementById('devisDoc'); return e?e.innerText:''; };
        const jojo=DEVIS.find(x=>x.cNom==='M. "Jojo" Martin'), atelier=DEVIS.find(x=>x.cNom==="L'Atelier du Froid");
        openDevis(jojo.id); await AB.attendre(120); printDevis(); await AB.attendre(250); const t1=html(); AB.ferme();
        openDevis(atelier.id); await AB.attendre(120); printDevis(); await AB.attendre(250); const t2=html(); AB.ferme();
        return {jojo:t1.includes('M. "Jojo" Martin'),atelier:t2.includes("L'Atelier du Froid")}; })()`);
      rec(G('AB12 golden'), 'Rendu des documents : « M. "Jojo" Martin » et « L\'Atelier du Froid » imprimés à l\'identique (l\'échappement ne change pas le texte visible)', !v.erreur && v.jojo === true && v.atelier === true, j(v));
    }
    await ctx.close();
  }
});

/* ============================ AB12 — références golden inchangées sur la branche ============================ */
await bloc('AB12', async () => {
  const g = G('AB12 golden');
  /* empreintes des références figées (main du 10/11/2026, après P3). Une régénération voulue par Gab se fait en changeant ces valeurs, en toute conscience. */
  const EMPREINTES = {
    'calculs.json': '36b5bde0d8aaed79f733062a1a1fe00a512a070af1500d8fdcef870e9778bf18', 'enveloppes.json': '3595c295441e6a24b27a13d8152141e0e552b92cfb1ec41fa8cc8399efd6888e', 'fusion-empreinte.txt': 'e5ce83cda99c7fc7b0d8ef4bf92cca9c03f43da6f139dc2a395892055e56b127',
    'documents/avoir-partiel.html': '5875a383f2afb553055b225de7511e3e19ce82de5b40f758d9d356836907dff0', 'documents/avoir-total.html': 'f72a025621964dbace037aab97e1a3c13050dc9b2203bdd9d40e75c4d7910fe8', 'documents/devis-v2.html': 'bf7acbde0180b0d7c3ed815f01adb1b90334370fc8c0a975d4255e1b68124b1b',
    'documents/facture-acompte.html': '58ffd424e69969d1c12f55e11c52f4a0fec0cdbdaaac39edde3d0da736e885c5', 'documents/facture-depannage.html': 'f0b47b88493806bffcc800e8d18ade49be3cc0fe8ddb11ae4828c6f203c19acc', 'documents/facture-solde-apres-acompte.html': '1f79aa3b5020ac157d0ac9a000a4b974514cc5f61703bda1e65ecd8ea2850b45',
    'documents/facture-solde-assujetti.html': '9d0a054b5c27bae3e91d48cb2373c11e8aac2a8d1f72bda6b3daa13b5dc32a13', 'documents/facture-solde-pro.html': 'd869f952d2345d61f3a652c0e3d35db3d7f6b2125cba0fd5f781faf5b9bb1c38',
    'xml/acompte-386.xml': 'e94297d6c4cacaa6a9e4c6dd5c8341961da1a025d0cdac2d6fc5fe448fc8dd21', 'xml/avoir-381-assujetti.xml': 'fdd0cede5a74dc42a28b11577fe07c1ddb25854159f83bc4457bc623ef3686cf', 'xml/avoir-381-partiel.xml': 'da3a8e8f1f56da9ab7cd0e99b53c5973a0680c4f8c0b111149faa6502cbe1918',
    'xml/avoir-381-total.xml': 'da9e6e2e57dabe67d6f6514a02c5397a990fb12a09e55db14ea22af4e9bcb8ba', 'xml/depannage-380-particulier.xml': '4e973cf80cf7053cb9912e2da33d5d1c9bb2e8adf8023746fb88bac178058aa6', 'xml/solde-380-apres-acompte.xml': '213c56cb8840ec34b06892fe57066f959fc8ed16a1486fb0f93af26e77a5d57d',
    'xml/solde-380-assujetti.xml': '7c2152ff7a2dba7d5130e3d1e3319e1f6aeb94818a5762f85c8eda8d9f684fc4', 'xml/solde-380-pro.xml': '6733b781bf6fb5e2be9c45c1dfb94d1b31dd699d697e1ffeb66900b1d0a80290', 'xml/_controles.json': '5a92633bedb3ef9087a915d2259b276d51f4427b5b430c254c61fe157f7609be',
  };
  const diff = Object.entries(EMPREINTES).filter(([f, h]) => { const fp = path.join(RACINE, 'tests', 'golden', f); return !fs.existsSync(fp) || crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex') !== h; }).map(([f]) => f);
  rec(g, 'Références golden des calculs (Z), des documents et XML (Y), des enveloppes (W) et de la fusion (U) : ' + Object.keys(EMPREINTES).length + ' fichiers identiques à ceux de main (aucune régénération sur cette branche)', diff.length === 0, diff.join(', '));
});

/* ============================ AB11 — bibliothèques embarquées ============================ */
await bloc('AB11', async () => {
  const g = G('AB11 bibliothèques');
  const vendor = fs.existsSync(path.join(RACINE, 'vendor')) ? fs.readdirSync(path.join(RACINE, 'vendor')) : [];
  const src = { catalogue: lireApp('next-catalogue.js'), einvoice: lireApp('next-einvoice.js'), addons: lireApp('next-addons.js'), sw: lireApp('sw.js'), index: lireApp('index.html') };
  const trouve = (s, re) => (s.match(re) || [])[1] || '';
  const xl = trouve(src.catalogue, /['"](vendor\/xlsx[^'"]+\.js)['"]/), zp = trouve(src.einvoice, /['"](vendor\/jszip[^'"]+\.js)['"]/), ts = trouve(src.addons, /['"](vendor\/tesseract[^'"]*\.min\.js)['"]/);
  const integ = (s, f) => { const all = [...s.matchAll(/sha384-[A-Za-z0-9+/=]+/g)].map((m) => m[0]); return f && fs.existsSync(path.join(RACINE, f)) && /\.integrity\s*=/.test(s) ? all.includes(sha384(path.join(RACINE, f))) : false; };
  rec(g, 'xlsx chargé depuis vendor/ avec une empreinte sha384 juste', !!xl && integ(src.catalogue, xl), xl || 'pas de vendor/xlsx');
  rec(g, 'jszip chargé depuis vendor/ avec une empreinte sha384 juste', !!zp && integ(src.einvoice, zp), zp || 'pas de vendor/jszip');
  rec(g, 'tesseract.js chargé depuis vendor/ avec une empreinte sha384 juste ; worker, moteur et langues fra+eng dans vendor/', !!ts && integ(src.addons, ts) && /worker/.test(vendor.join(' ')) && /tesseract-core-simd-lstm\.wasm\.js/.test(fs.existsSync(path.join(RACINE, 'vendor', 'tesseract-core')) ? fs.readdirSync(path.join(RACINE, 'vendor', 'tesseract-core')).join(' ') : '') && fs.existsSync(path.join(RACINE, 'vendor', 'tessdata', 'fra.traineddata.gz')) && fs.existsSync(path.join(RACINE, 'vendor', 'tessdata', 'eng.traineddata.gz')), ts || 'pas de vendor/tesseract');
  /* empreintes documentées des six fichiers Tesseract (vendor/LISEZMOI.md) : un fichier changé ou abîmé se voit */
  const lisez = fs.existsSync(path.join(RACINE, 'vendor', 'LISEZMOI.md')) ? fs.readFileSync(path.join(RACINE, 'vendor', 'LISEZMOI.md'), 'utf8') : '';
  const six = ['tesseract-5.1.1.min.js', 'tesseract-worker-5.1.1.min.js', 'tesseract-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core/tesseract-core-lstm.wasm.js', 'tessdata/fra.traineddata.gz', 'tessdata/eng.traineddata.gz'];
  const mauvais = six.filter((f) => { const fp = path.join(RACINE, 'vendor', f); return !fs.existsSync(fp) || !lisez.includes(sha384(fp)); });
  rec(g, 'Les six fichiers Tesseract de vendor/ ont leur empreinte sha384 écrite dans vendor/LISEZMOI.md, et elle est juste', mauvais.length === 0, mauvais.join(', '));
  const cache = [...src.sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  const manque = [xl, zp, ts, ...six.map((f) => 'vendor/' + f)].filter((f) => f && !cache.includes(f));
  rec(g, 'sw.js met en cache hors ligne xlsx, jszip et les six fichiers Tesseract', manque.length === 0, manque.join(', '));
  const cdnDansCode = ['index.html', 'signer.html', 'sw.js', ...fs.readdirSync(RACINE).filter((f) => /^next-.*\.js$/.test(f))].filter((f) => CDN.test(fs.readFileSync(path.join(RACINE, f), 'utf8')));
  rec(g, 'Plus aucune adresse de CDN (jsDelivr, cdnjs, unpkg, tessdata) dans l\'appli', cdnDansCode.length === 0, cdnDansCode.join(', '));
  rec(g, 'Aucune requête vers un CDN pendant toute la suite (y compris Excel, ZIP et lecture de plaque)', cdnHits.length === 0, [...new Set(cdnHits)].slice(0, 5).join(' | '));
});

/* ============================ AB13 — lecture de plaque locale ============================ */
await bloc('AB13', async () => {
  const g = G('AB13 lecture de plaque');
  const INIT = () => { window.__cspv = []; document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(e.violatedDirective + ' ' + (e.blockedURI || ''))); };
  const { p, ctx, errs } = await page({ mobile: false, horloge: REF.horloge, wait: 2500, init: INIT, cspReelle: true }); suivre(ctx);
  const reqs = []; ctx.on('request', (r) => reqs.push(r.url()));
  await p.evaluate(PREP);
  /* image de plaque FIXE (tests/plaque-essai.png : « DAIKIN / MODEL: FTXM25R / S/N: E1234567 / R32 CHARGE 0,76 kg », texte noir sur blanc) : dessinée une fois,
     pas à chaque passage — les polices diffèrent d'une machine à l'autre et changeaient la lecture sur la CI. Mêmes octets partout = même lecture. */
  const png = fs.readFileSync(path.join(RACINE, 'tests', 'plaque-essai.png'));
  await p.evaluate(() => { AB.ferme(); go('nx_scan'); });
  await p.waitForSelector('#nxOcrFile', { state: 'attached', timeout: 10000 });
  const n0 = reqs.length;
  await p.setInputFiles('#nxOcrFile', { name: 'plaque.png', mimeType: 'image/png', buffer: png });
  const t0 = Date.now();
  const r = await essai(p, `(async()=>{ nxRunOCR(); const fin=Date.now()+120000; let prog=''; while(Date.now()<fin){ await AB.attendre(500); prog=(document.getElementById('nxOcrProgress')||{}).textContent||''; if(/terminée|Échec/.test(prog)) break; }
    const found=(document.getElementById('nxOcrFound')||{}).innerText||'', raw=(document.getElementById('nxOcrRaw')||{}).textContent||'';
    const champs={}; document.querySelectorAll('#nxOcrFound > div').forEach(d=>{ const s=d.querySelector('span'), b=d.querySelector('b'); if(s&&b) champs[s.textContent]=b.textContent; });
    return {prog,found,raw:raw.slice(0,200),champs,cspv:__cspv.length}; })()`);
  const duree = Math.round((Date.now() - t0) / 1000);
  const vus = reqs.slice(n0), ext = vus.filter(EXTERNE), vendorReq = vus.filter((u) => /\/vendor\/tesseract/.test(u));
  const c = r.champs || {};
  rec(g, 'Lecture de plaque : terminée en ' + duree + ' s (' + (r.prog || r.erreur || '') + ')', !r.erreur && /terminée/.test(r.prog || ''), j({ prog: r.prog, raw: r.raw }).slice(0, 300));
  rec(g, 'Champs reconnus comme avant : marque Daikin, fluide R32, charge 0,76 kg, modèle FTXM…, n° de série E123…', c.marque === 'Daikin' && c.fluide === 'R32' && String(c.charge) === '0.76' && /^FTXM/.test(c.modele || '') && /^E123/.test(c.serie || ''), j(c).slice(0, 300));
  rec(g, 'Lecture entièrement locale : worker, moteur et langues chargés depuis vendor/, aucune requête externe, 0 violation de la CSP', ext.length === 0 && vendorReq.length >= 3 && r.cspv === 0, j({ externes: ext.slice(0, 3), vendor: vendorReq.map((u) => u.split('/').pop()).slice(0, 8), cspv: r.cspv }).slice(0, 400));
  rec(g, 'Aucune erreur JavaScript pendant la lecture de plaque', errs.length === 0, [...new Set(errs)].slice(0, 6).join(' | '));
  await ctx.close();
});
rec(G('AB11 bibliothèques'), 'Aucune requête vers une adresse extérieure (hors simulations locales) pendant toute la suite', externes.filter((u) => !/data\.geopf\.fr|recherche-entreprises\.api\.gouv\.fr|supabase\.co/.test(u)).length === 0, [...new Set(externes.filter((u) => !/data\.geopf\.fr|recherche-entreprises\.api\.gouv\.fr|supabase\.co/.test(u)))].slice(0, 5).join(' | '));

await closeBrowser();
ecrireResultats('resAB.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
