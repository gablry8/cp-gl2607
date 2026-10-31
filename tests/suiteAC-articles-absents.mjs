import { ecrireResultats, out } from './env.mjs';
// Suite AC — articles absents de la base de prix (mission F, partie C3 du dossier docs/MISSION-F-C1-C3.md, 29-30/10/2026).
// Constat (certain) : venteOf() rend 0 € pour un article qui n'est plus dans la base (renommé, supprimé, ancienne sauvegarde,
// nom de repli de l'assistant) et RIEN ne le signale, sauf pour les articles complémentaires. Comportement cible : la ligne reste
// à 0 € (aucun calcul ne change) mais elle le dit, compute() expose « absents » (calculé, jamais enregistré), bandeau rouge,
// confirmation à l'envoi, confirmation listant les devis concernés dans Base de prix (renommage propagé), assistant vérifié.
// Contrôles C3-T1 à C3-T11 du dossier (section 7). Les scénarios exécutés DANS la page sont des chaînes autonomes qui rendent leurs
// verdicts [nom, ok, détail] (même pratique que la suite B, partie B8) ; les contrôles d'affichage (visible, dans l'écran) et la
// restauration d'un fichier (rechargement de la page) sont faits par Playwright, côté Node.
// Golden : AUCUN cas ajouté à tests/golden/cas-calculs.mjs (pas de navigateur pour régénérer calculs.json le 30/10 : la suite Z
// échouerait sur « cas manquant »). C3-T1 à C3-T3 prouvent « mêmes totaux » autrement : le même devis calculé avec les articles
// INEXISTANTS et avec ces mêmes noms présents dans la base à 0 € doit donner les mêmes totaux et les mêmes lignes au millième.
// Horloge figée partout (REF de lib.mjs, HORLOGE des golden) : aucun résultat ne dépend du jour réel.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { page, rec, RES, closeBrowser, REF } from './lib.mjs';
import { pageFigee, fermer } from './golden/page-figee.mjs';
import { CAS, RELEVER, HORLOGE } from './golden/cas-calculs.mjs';
import { SERVEUR } from './serveur-simule.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const G = 'Articles absents (C3)';
const j = (o) => JSON.stringify(o);
/* verdicts rendus par un scénario de page ; un scénario qui plante (ancien code : fonction absente…) = ÉCHEC nommé, jamais ignoré */
function recTous(r, quoi) {
  if (!Array.isArray(r)) { rec(G, quoi + ' : scénario en erreur', false, j(r)); return; }
  r.forEach(([n, ok, d]) => rec(G, n, ok === true, d));
}
const essai = (p, code) => p.evaluate(code).catch((e) => ({ erreur: String(e).slice(0, 400) }));

/* ---------- outils communs, injectés dans chaque page (window.__c3) ---------- */
const AIDE = `(function(){
  if(window.__c3) return true;
  var N={liaison:'Liaison inexistante C3',cable:'Câble inexistant C3',goulotte:'Goulotte inexistante C3',support:'Support inexistant C3',pompe:'Pompe inexistante C3'};
  var cl=function(o){ return JSON.parse(JSON.stringify(o)); };
  /* nouvelle tâche : le cache de calcul (memoCompute, next-mobile.js) reprend l'empreinte de la base de prix à chaque tâche */
  var attendre=function(ms){ return new Promise(function(r){ setTimeout(r,ms||30); }); };
  var MSG=/absent de la base de prix — compté 0 €, à corriger/;
  /* devis à l'ancien format (sans v:2) : mêmes champs que l'ancien formulaire, noms d'articles existants sauf ceux passés */
  function devisAncien(id,noms){ noms=noms||{}; return {id:id,num:'DV-20261020-OLD-'+id.toUpperCase(),cNom:'Client '+id,cTel:'',cMail:'',cType:'Professionnel',cAdr:'',cVille:'',
    type:'Monosplit',statut:'brouillon',date:'2026-10-20',created:1760947200000,nbMach:1,nbSplit:1,machines:[{marque:'D',ref:'X',achat:1234.56,marge:35}],
    splits:[{long:7.5,liaison:noms.liaison||'Liaison 1/4 - 3/8',puiss:2.5,cableInter:noms.cable||'Câble 5G1,5'}],groupCable:'Câble 3G2,5',groupLong:12.3,
    goulottes:[{type:noms.goulotte||'Goulotte 80x60',long:4}],condLong:3,support:noms.support||'Support sol',pompeType:noms.pompe||'Pompe de relevage standard',pompeQte:1,
    taille:'auto',extras:[],heures:6.5,moMode:'heures',rateChoice:'45',rateCustom:45,acces:'0',zone:'0-10 km',mes:'Monosplit',brasure:'Brasure simple',supp:0,tests:'vide',
    tvaRate:10,acompteOn:false,acomptePct:30,notes:''}; }
  /* clim murale au nouveau format (même lot que le cas golden d-mono-simple, support existant par défaut) */
  function devisClim(id,noms){ noms=noms||{}; var d=NXD2.newDevis('split',{}), l=NXD2.newLot('split');
    Object.assign(l.data,{machines:[{marque:'Daikin',ref:'FTXM25',achat:980,marge:35,breaker:'',maxCurrent:7}],
      splits:[{piece:'Séjour',surface:20,typeUI:'Mural',puiss:2.5,liaison:noms.liaison||'Liaison 1/4 - 3/8',long:5,cableInter:noms.cable||'Câble 5G1,5'}],
      groupCable:'Câble 3G2,5',groupLong:6,condLong:4,support:noms.support||'Support mural standard',pompeType:noms.pompe||'Aucune',pompeQte:1,mes:'Monosplit'});
    d.lots=[l]; d.id=id; d.cNom='Client '+id; d.num=NXD2.numFor(d); NXD2.derive(d); return d; }
  /* gainable au nouveau format (même lot que le cas golden a-gainable-rempli) */
  function devisGainable(id,noms){ noms=noms||{}; var d=NXD2.newDevis('gainable',{}), l=NXD2.newLot('gainable');
    Object.assign(l.data,{machines:[{marque:'M',ref:'G1',achat:2400,marge:30,maxCurrent:12,kw:7.1,debit:1200,pression:50}],liaison:noms.liaison||'Liaison 3/8 - 5/8',
      cableInter:noms.cable||'Câble 5G1,5',long:8,groupLong:10,condLong:6,tests:'vide+azote'});
    d.lots=[l]; d.id=id; d.cNom='Client '+id; d.num=NXD2.numFor(d); NXD2.derive(d); return d; }
  /* les mêmes noms, présents dans la base au prix 0 € le temps d'un calcul : la référence « ces postes à 0 € » */
  async function avecPrixZero(noms,fn){
    var ajout=noms.map(function(n,i){ return {id:'c3zero'+i,nom:n,cat:'Divers',unite:'m',achat:0,marge:0,pv:0,src:'local'}; });
    ajout.forEach(function(a){ PRIX.push(a); }); await attendre(); var r;
    try{ r=fn(); } finally{ ajout.forEach(function(a){ var i=PRIX.indexOf(a); if(i>=0) PRIX.splice(i,1); }); }
    await attendre(); return r; }
  var CH=['totalHT','tva','tvaRate','totalTTC','acompte','solde','billTTC','coutReel','matAchat','moAchat','benefice','cotis','benefNet','heures','rate'];
  var m3=function(x){ return typeof x==='number'?Math.round(x*1000)/1000:x; };
  /* écarts au millième entre deux résultats de compute : totaux, puis chaque ligne (libellé, groupe, montant, PU, achat, quantité) */
  function ecarts(a,b){ var e=[]; CH.forEach(function(k){ if(m3(a[k])!==m3(b[k])) e.push(k+' '+a[k]+' / '+b[k]); });
    var la=a.lines||[], lb=b.lines||[]; if(la.length!==lb.length) e.push('lignes '+la.length+' / '+lb.length);
    la.forEach(function(l,i){ var m=lb[i]; if(!m) return; if(l.label!==m.label||l.group!==m.group){ e.push('ligne '+(i+1)+' « '+l.label+' » / « '+m.label+' »'); return; }
      ['ht','pu','achat','qte'].forEach(function(k){ if(m3(l[k])!==m3(m[k])) e.push('ligne '+(i+1)+' '+k+' '+l[k]+' / '+m[k]); }); });
    return e; }
  /* dialogues : confirm() scripté et noté ; brouillons de mail (mailto:) notés au lieu d'être ouverts */
  var D={conf:[],rep:[],mails:[]};
  window.confirm=function(m){ D.conf.push(String(m)); return D.rep.length?D.rep.shift():false; };
  var oc=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){ if(/^mailto:/.test(this.href||'')){ D.mails.push(this.href); return; } return oc.apply(this,arguments); };
  function raz(r){ D.conf.length=0; D.mails.length=0; D.rep=(r||[]).slice(); }
  function lire(id){ return (DEVIS||[]).filter(function(x){ return x&&x.id===id; })[0]; }
  window.__c3={N:N,cl:cl,attendre:attendre,MSG:MSG,devisAncien:devisAncien,devisClim:devisClim,devisGainable:devisGainable,avecPrixZero:avecPrixZero,ecarts:ecarts,D:D,raz:raz,lire:lire};
  return true;
})()`;

/* ---------- C3-T1, C3-T2, C3-T3 : calcul (page figée) ---------- */
const SC_CALCULS = `(async function(){ var H=window.__c3, N=H.N, R=[];
  var cas=[['C3-T1 ancien format (liaison, câble, goulotte, support, pompe inexistants)',H.devisAncien('c3-t1',{liaison:N.liaison,cable:N.cable,goulotte:N.goulotte,support:N.support,pompe:N.pompe}),[N.liaison,N.cable,N.goulotte,N.support,N.pompe]],
    ['C3-T2 clim murale v2 (liaison + support inexistants)',H.devisClim('c3-t2',{liaison:N.liaison,support:N.support}),[N.liaison,N.support]],
    ['C3-T3 gainable v2 (liaison + câble inexistants)',H.devisGainable('c3-t3',{liaison:N.liaison,cable:N.cable}),[N.liaison,N.cable]]];
  for(var k=0;k<cas.length;k++){ var t=cas[k][0], d=cas[k][1], att=cas[k][2];
    await H.attendre();
    var a=compute(H.cl(d));
    var z=await H.avecPrixZero(att,function(){ return compute(H.cl(d)); });
    var e=H.ecarts(a,z);
    R.push([t+" : mêmes totaux et mêmes lignes au millième qu'avec ces articles à 0 € dans la base (aucun calcul ne change)",e.length===0,JSON.stringify({ecarts:e.slice(0,6),totalHT:a.totalHT,reference:z.totalHT})]);
    R.push([t+' : absents = '+JSON.stringify(att),JSON.stringify(a.absents)===JSON.stringify(att),JSON.stringify(a.absents===undefined?'(champ absent)':a.absents)]);
    var sans=att.filter(function(n){ var l=(a.lines||[]).filter(function(x){ return x.absent===n; })[0]; return !(l&&Math.abs(l.ht)<0.0005&&H.MSG.test(l.detail||'')); });
    R.push([t+" : chaque ligne concernée porte l'avertissement, montant 0 €",sans.length===0,JSON.stringify({sansAvertissement:sans,lignes:(a.lines||[]).filter(function(x){ return x.group==='Matériel'; }).map(function(x){ return [x.label,x.ht,x.detail]; }).slice(0,14)})]);
    R.push([t+" : la référence (mêmes noms à 0 € dans la base) n'a aucun absent",!(z.absents||[]).length,JSON.stringify(z.absents===undefined?'(champ absent)':z.absents)]);
  }
  return R; })()`;

/* ---------- C3-T4 : documents (PDF) — même méthode que la suite Y : HTML de l'aperçu (#nx-pdf-page) après printDevis() ---------- */
const SC_PDF = `(async function(){ var H=window.__c3, N=H.N, R=[];
  var fermerApercu=function(){ var c=document.getElementById('nx-pdf-close'); if(c) c.click(); };
  var verifier=function(t,stocke,att){
    var p=document.getElementById('nx-pdf-page'), txt=p?p.textContent:'', lignes=p?[].slice.call(p.querySelectorAll('tr')):[];
    var c=compute(H.cl(stocke)), e=H.ecarts(compute(H.cl(cur)),c);
    var sans=att.filter(function(n){ var tr=lignes.filter(function(x){ return x.textContent.indexOf(n)>=0&&x.querySelector('[data-absent]'); })[0]; return !(tr&&H.MSG.test(tr.textContent)&&tr.textContent.indexOf(eur(0))>=0); });
    R.push([t+' : la mention apparaît sur chaque ligne concernée, montant 0,00 €',!!p&&sans.length===0,JSON.stringify({sansMention:sans,mentions:p?p.querySelectorAll('[data-absent]').length:null})]);
    R.push([t+' : montants du document = ceux du calcul du devis enregistré (total '+eur(c.totalHT)+')',!!p&&txt.indexOf(eur(c.totalHT))>=0&&e.length===0,JSON.stringify({ecartsApresFormulaire:e.slice(0,6),total:eur(c.totalHT)})]);
  };
  var d1=H.devisAncien('c3-pdf1',{liaison:N.liaison,cable:N.cable,goulotte:N.goulotte,support:N.support,pompe:N.pompe}); DEVIS.push(d1); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-pdf1'); await H.attendre(60); printDevis(); await H.attendre(60);
  verifier('C3-T4 PDF du devis C3-T1 (ancien format)',d1,[N.liaison,N.cable,N.goulotte,N.support,N.pompe]); fermerApercu();
  var d2=H.devisClim('c3-pdf2',{liaison:N.liaison,support:N.support}); NXD2.open(H.cl(d2),{tab:'recap'}); await H.attendre(60); printDevis(); await H.attendre(60);
  verifier('C3-T4 PDF du devis C3-T2 (clim murale v2)',d2,[N.liaison,N.support]); fermerApercu();
  var d3=H.devisGainable('c3-pdf3',{liaison:N.liaison,cable:N.cable}); NXD2.open(H.cl(d3),{tab:'recap'}); await H.attendre(60); printDevis(); await H.attendre(60);
  verifier('C3-T4 PDF du devis C3-T3 (gainable v2)',d3,[N.liaison,N.cable]); fermerApercu();
  go('dash');
  return R; })()`;

/* ---------- C3-T5 : écran (téléphone et PC) ---------- */
const SC_ECRAN_V2 = `(async function(){ var H=window.__c3, N=H.N, R=[];
  var att='2 articles absents de la base de prix, comptés 0 € : '+N.liaison+' ; '+N.support;
  var t=H.devisClim('c3-ecran-t'), d=H.devisClim('c3-ecran',{liaison:N.liaison,support:N.support}); DEVIS.push(t,d); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-ecran-t'); await H.attendre(100);
  R.push(['C3-T5 nouveau format, témoin sans article absent : aucun bandeau',!document.querySelector('#nxd2Abs .nx-absents'),(document.getElementById('nxd2Abs')||{}).textContent]);
  openDevis('c3-ecran'); await H.attendre(100);
  var t0=(document.getElementById('nxd2Abs')||{}).textContent||'';
  R.push(["C3-T5 nouveau format : bandeau dès l'ouverture du devis",t0.indexOf(att)>=0,t0.slice(0,200)]);
  nxd2.tab('recap'); await H.attendre(100);
  var b=document.querySelector('#nxd2Abs .nx-absents'), st=b?getComputedStyle(b):null, t1=b?b.textContent:'';
  R.push(['C3-T5 nouveau format, récapitulatif : bandeau rouge « '+att+' »',!!b&&t1.indexOf(att)>=0&&!!document.getElementById('nxd2Sante'),t1.slice(0,200)]);
  R.push(['C3-T5 bandeau du même style que l\\'alerte « Montant différent » (nxd2-warn red : fond rouge clair)',!!st&&st.backgroundColor==='rgb(253, 236, 234)'&&b.classList.contains('nxd2-warn')&&b.classList.contains('red'),st?st.backgroundColor:'']);
  return R; })()`;
const SC_ECRAN_ANCIEN = `(async function(){ var H=window.__c3, N=H.N, R=[];
  var noms=[N.liaison,N.cable,N.goulotte,N.support,N.pompe], att='5 articles absents de la base de prix, comptés 0 € : '+noms.join(' ; ');
  var t=H.devisAncien('c3-ecran-at'), d=H.devisAncien('c3-ecran-a',{liaison:N.liaison,cable:N.cable,goulotte:N.goulotte,support:N.support,pompe:N.pompe}); DEVIS.push(t,d); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-ecran-at'); await H.attendre(80);
  R.push(['C3-T5 ancien format, témoin sans article absent : aucun bandeau',!document.querySelector('#nxAbsWiz .nx-absents'),(document.getElementById('nxAbsWiz')||{}).textContent||'']);
  openDevis('c3-ecran-a'); await H.attendre(80);
  var t1=(document.getElementById('nxAbsWiz')||{}).textContent||'';
  R.push(["C3-T5 ancien format : bandeau dès l'ouverture du devis",t1.indexOf(att)>=0,t1.slice(0,240)]);
  step(6); await H.attendre(80);
  var t2=(document.getElementById('nxAbsWiz')||{}).textContent||'', det=(document.getElementById('recapDetail')||{}).textContent||'', n=(det.match(/absent de la base de prix — compté 0 €, à corriger/g)||[]).length;
  R.push(['C3-T5 ancien format, récapitulatif : bandeau + mention sur les 5 lignes concernées',t2.indexOf(att)>=0&&n===5,JSON.stringify({mentions:n,bandeau:t2.slice(0,120)})]);
  return R; })()`;

/* ---------- C3-T6 : envoi d'un devis avec un article absent ---------- */
const SC_ENVOI = `(async function(){ var H=window.__c3, N=H.N, D=H.D, R=[];
  var att="Ce devis contient 2 articles comptés 0 € ("+N.liaison+", "+N.support+"). L'envoyer quand même ?";
  var etat=function(id){ var x=H.lire(id)||{}; return {statut:x.statut,envoyeLe:!!x.sentAt,mails:D.mails.length,questions:D.conf.slice()}; };
  /* a) liste « Tous les devis », bouton « Envoyer » */
  DEVIS.push(H.devisClim('c3-env-a',{liaison:N.liaison,support:N.support})); save(LS.devis,DEVIS); await H.attendre();
  H.raz([false]); nxEnvoyer('c3-env-a'); await H.attendre(); var e=etat('c3-env-a');
  R.push(['C3-T6 liste « Envoyer » : confirmation affichée, texte validé',e.questions.length===1&&e.questions[0]===att,JSON.stringify(e.questions)]);
  R.push(['C3-T6 liste « Envoyer », refus : rien envoyé, statut inchangé',e.statut==='brouillon'&&!e.envoyeLe&&e.mails===0,JSON.stringify(e)]);
  H.raz([true]); nxEnvoyer('c3-env-a'); await H.attendre(); e=etat('c3-env-a');
  R.push(['C3-T6 liste « Envoyer », accepté : comportement actuel (Envoyé, brouillon de mail)',e.questions.length===1&&e.statut==='envoye'&&e.envoyeLe&&e.mails===1,JSON.stringify(e)]);
  /* b) nouveau format : « Mail au client » */
  DEVIS.push(H.devisClim('c3-env-b',{liaison:N.liaison,support:N.support})); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-env-b'); await H.attendre(80);
  H.raz([false]); nxd2.mail(); await H.attendre(); e=etat('c3-env-b');
  R.push(['C3-T6 nouveau format, « Mail au client », refus : question posée, rien envoyé, statut inchangé',e.questions.length===1&&e.questions[0]===att&&e.statut==='brouillon'&&cur.statut==='brouillon'&&e.mails===0,JSON.stringify(e)]);
  H.raz([true]); nxd2.mail(); await H.attendre(); e=etat('c3-env-b');
  R.push(['C3-T6 nouveau format, « Mail au client », accepté : Envoyé + brouillon de mail',e.questions.length===1&&e.statut==='envoye'&&e.mails===1,JSON.stringify(e)]);
  /* c) ancien formulaire : « Mail au client » */
  DEVIS.push(H.devisAncien('c3-env-c',{liaison:N.liaison,support:N.support})); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-env-c'); await H.attendre(80);
  H.raz([false]); mailDevis(); await H.attendre(); e=etat('c3-env-c');
  R.push(['C3-T6 ancien formulaire, « Mail au client », refus : question posée, rien envoyé, statut inchangé',e.questions.length===1&&e.questions[0]===att&&e.statut==='brouillon'&&cur.statut==='brouillon'&&e.mails===0,JSON.stringify(e)]);
  H.raz([true]); mailDevis(); await H.attendre(); e=etat('c3-env-c');
  R.push(['C3-T6 ancien formulaire, « Mail au client », accepté : Envoyé + brouillon de mail',e.questions.length===1&&e.statut==='envoye'&&e.mails===1,JSON.stringify(e)]);
  /* d) nouveau format : « Faire signer en ligne » (l'envoi du lien est remplacé par un compteur) */
  var vrai=window.nxsSendDevis, liens=0; window.nxsSendDevis=function(){ liens++; };
  DEVIS.push(H.devisClim('c3-env-d',{liaison:N.liaison,support:N.support})); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-env-d'); await H.attendre(80);
  H.raz([false]); nxd2.sign(); await H.attendre(); var q1=D.conf.slice(), l1=liens, s1=(H.lire('c3-env-d')||{}).statut;
  H.raz([true]); nxd2.sign(); await H.attendre(); var l2=liens;
  window.nxsSendDevis=vrai;
  R.push(['C3-T6 nouveau format, signature en ligne : refus = aucun lien envoyé ; accepté = envoi comme avant',q1.length===1&&q1[0]===att&&l1===0&&s1==='brouillon'&&l2===1,JSON.stringify({questions:q1,liensApresRefus:l1,liensApresAccord:l2,statut:s1})]);
  /* e) ancien formulaire : signature en ligne (boutons de next-signature.js : vrai chemin, sans cloud le lien échoue après le passage en Envoyé) */
  DEVIS.push(H.devisAncien('c3-env-e',{liaison:N.liaison,support:N.support})); save(LS.devis,DEVIS); await H.attendre();
  openDevis('c3-env-e'); await H.attendre(80);
  H.raz([false]); window.nxsSendDevis(); await H.attendre(120); e=etat('c3-env-e');
  R.push(['C3-T6 ancien formulaire, signature en ligne, refus : question posée, rien envoyé, statut inchangé',e.questions.length===1&&e.questions[0]===att&&e.statut==='brouillon'&&!e.envoyeLe&&cur.statut==='brouillon',JSON.stringify(e)]);
  H.raz([true]); window.nxsSendDevis(); await H.attendre(150); e=etat('c3-env-e');
  R.push(['C3-T6 ancien formulaire, signature en ligne, accepté : comportement actuel (passe en Envoyé)',e.questions.length===1&&e.statut==='envoye'&&e.envoyeLe,JSON.stringify(e)]);
  /* f) témoin : aucun article absent → aucune question, envoi direct */
  DEVIS.push(H.devisClim('c3-env-f')); save(LS.devis,DEVIS); await H.attendre();
  H.raz([]); nxEnvoyer('c3-env-f'); await H.attendre(); e=etat('c3-env-f');
  R.push(['C3-T6 témoin sans article absent : aucune question, envoi direct (inchangé)',e.questions.length===0&&e.statut==='envoye'&&e.mails===1,JSON.stringify(e)]);
  go('dash');
  return R; })()`;

/* ---------- C3-T7, C3-T8 : Base de prix (renommer, supprimer) ---------- */
const SC_BASE = `(async function(){ var H=window.__c3, D=H.D, R=[];
  var tot=function(id){ return Math.round(compute(H.cl(H.lire(id))).totalHT*100)/100; };
  var abs=function(id){ var a=compute(H.cl(H.lire(id))).absents; return Array.isArray(a)?a:[]; };
  /* ce que C3 pourrait toucher : statut, factures, champs d'articles, données des lots. (L'enveloppe de calcul de next-addons.js ajoute
     en mémoire les champs électriques par défaut aux devis de l'ancien format quand un écran les recalcule : sans rapport avec C3.) */
  var gele=function(id){ var d=H.lire(id)||{}; return JSON.stringify({statut:d.statut,facSolde:d.facSolde||null,facAcompte:d.facAcompte||null,splits:d.splits,goulottes:d.goulottes,groupCable:d.groupCable,
    support:d.support,pompeType:d.pompeType,extras:d.extras,lots:(d.lots||[]).map(function(l){ return l&&l.data; })}); };
  var fac={num:'TEST-F-2026-090',date:'2026-10-20',montant:100,total:100,payeLe:null,mode:''};
  var cu=load(LS.custom,[]);
  cu.push({id:'c3art1',nom:'Liaison locale C3',cat:'Cuivre',unite:'m',achat:10,marge:35,verif:false,src:'local'},
    {id:'c3art2',nom:'Support local C3',cat:'Supports',unite:'unité',achat:25,marge:35,verif:false,src:'local'},
    {id:'c3art3',nom:'Pompe locale C3',cat:'Pompe',unite:'unité',achat:85,marge:35,verif:false,src:'local'},
    {id:'c3art4',nom:'Article local inutilisé C3',cat:'Divers',unite:'unité',achat:5,marge:35,verif:false,src:'local'});
  save(LS.custom,cu); rebuildPrix();
  var fact=function(d){ d.statut='accepte'; d.facSolde=H.cl(fac); return d; };
  var A=H.devisAncien('c3-b-a',{liaison:'Liaison locale C3'}), B=H.devisClim('c3-b-b',{liaison:'Liaison locale C3'}), F=fact(H.devisAncien('c3-b-f',{liaison:'Liaison locale C3'}));
  var A2=H.devisAncien('c3-b-a2',{support:'Support local C3'}), B2=H.devisClim('c3-b-b2',{support:'Support local C3'}), F2=fact(H.devisAncien('c3-b-f2',{support:'Support local C3'}));
  var A3=H.devisAncien('c3-b-a3',{pompe:'Pompe locale C3'}), B3=H.devisClim('c3-b-b3',{pompe:'Pompe locale C3'}), F3=fact(H.devisAncien('c3-b-f3',{pompe:'Pompe locale C3'}));
  [A,B,F,A2,B2,F2,A3,B3,F3].forEach(function(d){ DEVIS.push(d); }); save(LS.devis,DEVIS); await H.attendre();
  var listeOk=function(q,oui,non){ return oui.every(function(d){ return q.indexOf(d.num)>=0; })&&non.every(function(d){ return q.indexOf(d.num)<0; }); };
  /* C3-T7a : renommer un article local utilisé par 2 devis non facturés et 1 facturé — « renommer aussi » */
  var tA=tot('c3-b-a'), tB=tot('c3-b-b'), gF=gele('c3-b-f');
  editPrix('c3art1'); document.getElementById('mp_nom').value='Liaison locale C3 renommée'; H.raz([true]); savePrix(); await H.attendre();
  var q=D.conf.slice();
  R.push(['C3-T7 renommer : une confirmation liste les 2 devis non facturés, pas le devis facturé',q.length===1&&listeOk(q[0],[A,B],[F])&&/renommer aussi/.test(q[0]),JSON.stringify(q)]);
  R.push(['C3-T7 « renommer aussi » : les 2 devis prennent le nouveau nom, montants identiques au centime, aucun absent',
    (H.lire('c3-b-a').splits[0].liaison==='Liaison locale C3 renommée')&&(H.lire('c3-b-b').lots[0].data.splits[0].liaison==='Liaison locale C3 renommée')&&tot('c3-b-a')===tA&&tot('c3-b-b')===tB&&!abs('c3-b-a').length&&!abs('c3-b-b').length,
    JSON.stringify({avant:[tA,tB],apres:[tot('c3-b-a'),tot('c3-b-b')],absents:[abs('c3-b-a'),abs('c3-b-b')]})]);
  R.push(['C3-T7 « renommer aussi » : le devis facturé n\\'est pas touché, l\\'article est renommé dans la base',gele('c3-b-f')===gF&&!!findPrix('Liaison locale C3 renommée')&&!findPrix('Liaison locale C3'),'']);
  /* C3-T7c : annuler aux deux questions → rien n'est enregistré */
  var gA=gele('c3-b-a'), gB=gele('c3-b-b');
  editPrix('c3art1'); document.getElementById('mp_nom').value='Liaison renommée deux fois C3'; H.raz([false,false]); savePrix(); await H.attendre(); q=D.conf.slice();
  try{ closeModal('mPrix'); }catch(err){ console.warn('C3 : fermeture de la fenêtre', err); }
  R.push(['C3-T7 annuler aux deux questions : rien enregistré (article, devis)',q.length===2&&!!findPrix('Liaison locale C3 renommée')&&!findPrix('Liaison renommée deux fois C3')&&gele('c3-b-a')===gA&&gele('c3-b-b')===gB,JSON.stringify(q.map(function(x){ return x.slice(0,60); }))]);
  /* C3-T7b : « renommer seulement l'article » */
  var tA2=tot('c3-b-a2'), gF2=gele('c3-b-f2');
  editPrix('c3art2'); document.getElementById('mp_nom').value='Support local C3 bis'; H.raz([false,true]); savePrix(); await H.attendre(); q=D.conf.slice();
  R.push(['C3-T7 « renommer seulement l\\'article » : 2e question explicite, les 2 devis gardent l\\'ancien nom et affichent l\\'alerte',
    q.length===2&&listeOk(q[0],[A2,B2],[F2])&&/Renommer seulement l'article/.test(q[1])&&H.lire('c3-b-a2').support==='Support local C3'&&abs('c3-b-a2').indexOf('Support local C3')>=0&&abs('c3-b-b2').indexOf('Support local C3')>=0,
    JSON.stringify({questions:q.map(function(x){ return x.slice(0,90); }),absents:[abs('c3-b-a2'),abs('c3-b-b2')],avant:tA2,apres:tot('c3-b-a2')})]);
  R.push(['C3-T7 « renommer seulement l\\'article » : le devis facturé est intact',gele('c3-b-f2')===gF2,'']);
  /* C3-T8 : supprimer un article utilisé */
  var gA3=gele('c3-b-a3'), gB3=gele('c3-b-b3'), gF3=gele('c3-b-f3');
  H.raz([false]); delPrix('c3art3'); await H.attendre(); q=D.conf.slice();
  R.push(['C3-T8 supprimer : la confirmation liste les devis concernés (pas le facturé) ; annuler = rien',q.length===1&&listeOk(q[0],[A3,B3],[F3])&&/supprimer quand même/.test(q[0])&&!!findPrix('Pompe locale C3')&&gele('c3-b-a3')===gA3&&gele('c3-b-b3')===gB3,JSON.stringify(q)]);
  H.raz([true]); delPrix('c3art3'); await H.attendre();
  R.push(['C3-T8 « supprimer quand même » : article supprimé, alerte sur les 2 devis, facturé intact',!findPrix('Pompe locale C3')&&abs('c3-b-a3').indexOf('Pompe locale C3')>=0&&abs('c3-b-b3').indexOf('Pompe locale C3')>=0&&gele('c3-b-f3')===gF3,JSON.stringify([abs('c3-b-a3'),abs('c3-b-b3')])]);
  H.raz([true]); delPrix('c3art4'); await H.attendre(); q=D.conf.slice();
  R.push(['C3-T8 témoin : article inutilisé, question habituelle « Supprimer cet article ? » (inchangé)',q.length===1&&q[0]==='Supprimer cet article ?'&&!findPrix('Article local inutilisé C3'),JSON.stringify(q)]);
  /* le champ « absents » est calculé, jamais enregistré */
  var brut=localStorage.getItem('cp2_devis')||'';
  R.push(['« absents » est calculé, jamais enregistré (aucune trace dans les devis enregistrés)',brut.length>0&&brut.indexOf('"absents"')<0&&brut.indexOf('"absent"')<0&&(DEVIS||[]).every(function(d){ return !('absents' in d); }),String(brut.length)]);
  return R; })()`;

/* ---------- C3-T9 : assistant (noms de repli écrits en dur) ---------- */
const SC_ASSISTANT = `(async function(){ var R=[];
  var i=NOTION_PRIX.findIndex(function(p){ return p.nom==='Câble 5G1,5'; }); if(i>=0) NOTION_PRIX.splice(i,1); rebuildPrix(); await new Promise(function(r){ setTimeout(r,30); });
  R.push(['C3-T9 mise en place : « Câble 5G1,5 » ne fait plus partie de la base de prix',!findPrix('Câble 5G1,5'),String(i)]);
  var f=typeof window.nxaRepliBase==='function', w=[], r1=f?nxaRepliBase('Câble 5G1,5','Câble',SPLIT_CABLES,w):null, p1=r1?findPrix(r1):null;
  R.push(["C3-T9 repli : un câble de la base remplace le nom disparu, et c'est dit (texte validé)",f&&!!p1&&p1.cat==='Câble'&&r1!=='Câble 5G1,5'&&w.length===1&&w[0]==="J'ai pris « "+r1+" » parce que « Câble 5G1,5 » n'existe plus dans ta base",JSON.stringify({fonction:f,r1:r1,w:w})]);
  var w2=[], r2=f?nxaRepliBase('Article fantôme C3','Catégorie vide C3',null,w2):null;
  R.push(["C3-T9 repli, catégorie vide : aucun article inventé, le nom reste et c'est dit",f&&r2==='Article fantôme C3'&&w2.length===1&&/compté 0 €/.test(w2[0]),JSON.stringify({r2:r2,w2:w2})]);
  __srv.inbox.push({id:'c3-assist-1',user_id:'u1',created_at:new Date().toISOString(),kind:'devis',statut:'a_valider',source:'agent',titre:'Devis dicté C3',resume:null,dictee:null,
    payload:{type:'Monosplit',client:{nom:'Client dicté C3'},machines:[{marque:'M',ref:'R1',achat:900}],splits:[{puiss:2.5,long:4}]}});
  await nxaRefresh(); nxaOpenDevis('c3-assist-1'); await new Promise(function(r){ setTimeout(r,300); });
  var sp=(cur&&cur.v===2)?((cur.lots[0]||{}).data||{}).splits:(cur&&cur.splits), s=(sp||[])[0]||{}, ban=(document.getElementById('nxaBanner')||{}).textContent||'';
  var c=cur?compute(JSON.parse(JSON.stringify(cur))):{};
  R.push(["C3-T9 devis dicté sans câble : câble pris dans la base (pas « Câble 5G1,5 »), signalé dans le bandeau de l'assistant",!!s.cableInter&&s.cableInter!=='Câble 5G1,5'&&!!findPrix(s.cableInter)&&ban.indexOf("parce que « Câble 5G1,5 » n'existe plus dans ta base")>=0,JSON.stringify({cable:s.cableInter,liaison:s.liaison,bandeau:ban.slice(0,300)})]);
  R.push(['C3-T9 devis dicté : aucun article absent dans le devis pré-rempli',Array.isArray(c.absents)&&!c.absents.length,JSON.stringify(c.absents===undefined?'(champ absent)':c.absents)]);
  go('dash');
  return R; })()`;

/* ---------- C3-T11 : restauration d'une sauvegarde contenant des noms d'articles inconnus ---------- */
const SC_SVG_AVANT = `(async function(){ var H=window.__c3;
  var a=H.devisAncien('c3-svg-anc',{liaison:'Liaison ancienne C3',support:'Support ancien C3'}), v=H.devisClim('c3-svg-v2',{cable:'Câble ancien C3',support:'Support ancien C3'});
  await H.attendre(); return {devis:[a,v],totaux:{anc:compute(H.cl(a)).totalHT,v2:compute(H.cl(v)).totalHT}}; })()`;
const FN_SVG_APRES = `(async function(T){ var H=window.__c3, R=[];
  var a=H.lire('c3-svg-anc'), v=H.lire('c3-svg-v2');
  R.push(['C3-T11 sauvegarde restaurée : les 2 devis sont là, avec leurs noms d\\'origine',!!a&&!!v&&a.splits[0].liaison==='Liaison ancienne C3'&&v.lots[0].data.splits[0].cableInter==='Câble ancien C3',JSON.stringify({a:!!a,v:!!v})]);
  if(!a||!v) return R;
  await H.attendre();
  var ca=compute(H.cl(a)), cv=compute(H.cl(v));
  R.push(['C3-T11 montants inchangés après restauration (au centime)',Math.abs(ca.totalHT-T.anc)<0.005&&Math.abs(cv.totalHT-T.v2)<0.005,JSON.stringify({attendu:T,obtenu:{anc:ca.totalHT,v2:cv.totalHT}})]);
  R.push(['C3-T11 absents = les noms inconnus de chaque devis',JSON.stringify(ca.absents)===JSON.stringify(['Liaison ancienne C3','Support ancien C3'])&&JSON.stringify(cv.absents)===JSON.stringify(['Câble ancien C3','Support ancien C3']),JSON.stringify([ca.absents,cv.absents])]);
  openDevis('c3-svg-anc'); await H.attendre(80);
  var b1=(document.getElementById('nxAbsWiz')||{}).textContent||'';
  step(6); await H.attendre(80);
  var c6=compute(H.cl(cur));
  R.push(["C3-T11 ancien format : bandeau à l'ouverture ; le formulaire garde les noms inconnus (montant inchangé au récapitulatif)",b1.indexOf('2 articles absents de la base de prix, comptés 0 € : Liaison ancienne C3 ; Support ancien C3')>=0&&cur.splits[0].liaison==='Liaison ancienne C3'&&cur.support==='Support ancien C3'&&Math.abs(c6.totalHT-T.anc)<0.005,JSON.stringify({bandeau:b1.slice(0,160),liaison:cur.splits[0].liaison,support:cur.support,total:c6.totalHT})]);
  openDevis('c3-svg-v2'); await H.attendre(100);
  var b2=(document.getElementById('nxd2Abs')||{}).textContent||'';
  R.push(["C3-T11 nouveau format : bandeau à l'ouverture",b2.indexOf('2 articles absents de la base de prix, comptés 0 € : Câble ancien C3 ; Support ancien C3')>=0,b2.slice(0,160)]);
  go('dash');
  return R; })`;

/* ========== exécution ========== */

/* 1. C3-T1 à C3-T4 : page FIGÉE (même mécanisme que les golden : horloge, stockage vide, aucune requête externe) */
{
  const { p, ctx, errs } = await pageFigee({ horloge: HORLOGE });
  await p.evaluate(AIDE);
  recTous(await essai(p, SC_CALCULS), 'C3-T1 à C3-T3');
  recTous(await essai(p, SC_PDF), 'C3-T4');
  rec(G, 'C3-T1 à C3-T4 : aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 2. C3-T10 : les 52 devis golden — montants identiques au millième ; « absents » vide, SAUF les 3 cas qui contiennent déjà un article
      absent (constat du 30/10 : « Support mural » n'existe pas dans la base — seuls « Support mural standard / renforcé » existent ;
      « Article inexistant XYZ » est voulu). Ces 3 lignes étaient déjà à 0 € : seul le signalement est nouveau. */
{
  const attendu = JSON.parse(fs.readFileSync(path.join(ICI, 'golden', 'calculs.json'), 'utf8'));
  const CONNUS = { 'b-extras': ['Article inexistant XYZ'], 'd-mono-simple': ['Support mural'], 'e-legacy-mono': ['Support mural'] };
  const CH = ['totalHT', 'tva', 'tvaRate', 'totalTTC', 'acompte', 'solde', 'billTTC', 'coutReel', 'matAchat', 'moAchat', 'benefice', 'cotis', 'benefNet', 'heures', 'rate'];
  const c3 = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
  const errsT10 = []; let nDiff = 0, nAbs = 0;
  for (const assujetti of [false, true]) {
    const liste = CAS.filter((c) => !!c.assujetti === assujetti); if (!liste.length) continue;
    const { p, ctx, errs } = await pageFigee({ horloge: HORLOGE, assujetti });
    if (assujetti) await p.evaluate(() => { if (typeof rebuildP === 'function') rebuildP(); });
    for (const c of liste) {
      const r = await essai(p, `(function(){ const d=(${c.construire})(); const o=(${RELEVER})(d, ${j({ id: c.id })}); const a=compute(JSON.parse(JSON.stringify(d))).absents; return {o:o,absents:a===undefined?'(champ absent)':a}; })()`);
      const a = attendu.cas[c.id], o = r && r.o, diff = [];
      if (!a || !o) diff.push('calcul impossible ou référence absente : ' + j(r).slice(0, 200));
      else {
        for (const k of CH) if (c3(a[k]) !== c3(o[k])) diff.push(`${k} ${a[k]} → ${o[k]}`);
        if (a.lines.length !== o.lines.length) diff.push(`lignes ${a.lines.length} → ${o.lines.length}`);
        a.lines.forEach((x, i) => { const y = o.lines[i]; if (!y) return; if (x.label !== y.label) diff.push(`ligne ${i + 1} « ${x.label} » → « ${y.label} »`); for (const k of ['ht', 'pu', 'achat', 'qte']) if (c3(x[k]) !== c3(y[k])) diff.push(`ligne ${i + 1} ${k} ${x[k]} → ${y[k]}`); });
        if (j(a.warnings) !== j(o.warnings)) diff.push('avertissements ' + j(a.warnings) + ' → ' + j(o.warnings));
      }
      const absAtt = CONNUS[c.id] || [], absOk = r && j(r.absents) === j(absAtt);
      if (diff.length) nDiff++; if (!absOk) nAbs++;
      rec(G, `C3-T10 ${c.titre} : identique au millième, absents = ${j(absAtt)}`, diff.length === 0 && absOk, j(diff.length ? { ecarts: diff.slice(0, 6), absents: r && r.absents } : { absents: r && r.absents }));
    }
    errsT10.push(...errs); await ctx.close();
  }
  rec(G, `C3-T10 bilan : ${CAS.length} cas golden, ${nDiff} avec un montant ou une ligne changés au millième, ${nAbs} avec une liste « absents » inattendue`, nDiff === 0 && nAbs === 0, 'cas connus avec un article absent : ' + j(CONNUS));
  rec(G, 'C3-T10 : aucune erreur JavaScript pendant les calculs', errsT10.length === 0, errsT10.join(' | '));
}
await fermer();

/* 3. C3-T5 : bandeau visible, téléphone et PC */
for (const mobile of [true, false]) {
  const quoi = mobile ? 'téléphone' : 'PC';
  const { p, ctx, errs } = await page({ mobile, horloge: REF.horloge });
  await p.evaluate(AIDE);
  const dansEcran = async (sel) => { const l = p.locator(sel).first(); const vis = await l.isVisible().catch(() => false); const bb = vis ? await l.boundingBox({ timeout: 3000 }).catch(() => null) : null; const vw = p.viewportSize().width;
    return { vis, ok: vis && !!bb && bb.x >= 0 && bb.x + bb.width <= vw + 1 && bb.height > 0, bb, vw }; };
  const r1 = await essai(p, SC_ECRAN_V2); recTous(Array.isArray(r1) ? r1.map(([n, ok, d]) => [n + ' (' + quoi + ')', ok, d]) : r1, 'C3-T5 nouveau format (' + quoi + ')');
  const v1 = await dansEcran('#nxd2Abs .nx-absents');
  rec(G, `C3-T5 nouveau format (${quoi}) : bandeau visible, entièrement dans l'écran`, v1.ok, j(v1));
  const r2 = await essai(p, SC_ECRAN_ANCIEN); recTous(Array.isArray(r2) ? r2.map(([n, ok, d]) => [n + ' (' + quoi + ')', ok, d]) : r2, 'C3-T5 ancien format (' + quoi + ')');
  const v2 = await dansEcran('#nxAbsWiz .nx-absents');
  rec(G, `C3-T5 ancien format (${quoi}) : bandeau visible, entièrement dans l'écran`, v2.ok, j(v2));
  rec(G, `C3-T5 (${quoi}) : aucune erreur JavaScript`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 4. C3-T6 : confirmation à l'envoi (liste, mail nouveau et ancien format, signature en ligne nouveau et ancien format) */
{
  const { p, ctx, errs } = await page({ mobile: false, horloge: REF.horloge });
  p.removeAllListeners('dialog'); p.on('dialog', (d) => d.dismiss().catch(() => {}));   /* les vraies questions passent par window.confirm, scripté */
  await p.evaluate(AIDE);
  recTous(await essai(p, SC_ENVOI), 'C3-T6');
  rec(G, 'C3-T6 : aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 5. C3-T7, C3-T8 : Base de prix */
{
  const { p, ctx, errs } = await page({ mobile: false, horloge: REF.horloge });
  await p.evaluate(AIDE);
  recTous(await essai(p, SC_BASE), 'C3-T7 et C3-T8');
  rec(G, 'C3-T7 et C3-T8 : aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 6. C3-T9 : assistant — boîte de réception simulée (serveur simulé, aucune connexion réelle), comme la suite R */
{
  const { p, ctx, errs } = await page({ mobile: false, horloge: REF.horloge });
  await p.evaluate(SERVEUR);
  await p.evaluate(() => { window.SESS = { user: { id: 'u1', email: 'test@test' } }; });
  await p.evaluate(AIDE);
  recTous(await essai(p, SC_ASSISTANT), 'C3-T9');
  rec(G, 'C3-T9 : aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 7. C3-T11 : sauvegarde (Outils › Restaurer = importJSON) contenant des noms d'articles inconnus, restaurée sur un autre appareil */
{
  const a = await page({ mobile: false, horloge: REF.horloge });
  await a.p.evaluate(AIDE);
  const av = await essai(a.p, SC_SVG_AVANT);
  await a.ctx.close();
  if (!av || !Array.isArray(av.devis)) rec(G, 'C3-T11 préparation de la sauvegarde', false, j(av));
  else {
    const fichier = out('c3-sauvegarde-noms-inconnus.json');
    fs.writeFileSync(fichier, j({ exported: Date.parse(REF.horloge), compte: { devis: av.devis.length }, all: { cp2_devis: av.devis } }));
    const { p, ctx, errs } = await page({ mobile: false, horloge: REF.horloge });
    await p.evaluate(() => { window.confirm = () => true; const i = document.createElement('input'); i.type = 'file'; i.id = 'c3Restaurer'; i.onchange = function () { importJSON(this); }; document.body.appendChild(i); });
    await p.setInputFiles('#c3Restaurer', fichier);
    /* sauvegarde complète (« all ») : l'appli enregistre puis se recharge (nxStoreReload) — on attend l'appli rechargée avec les devis */
    await p.waitForTimeout(2500);
    /* le rechargement (location.reload après l'écriture) peut tomber pendant l'attente : contexte détruit → on réessaie (3 fois au plus) */
    let pret = 'non vérifié';
    for (let k = 0; k < 3 && pret !== true; k++) {
      await p.waitForLoadState('load').catch((e) => { pret = String(e).slice(0, 200); });
      pret = await p.waitForFunction(() => window.nxStore && nxStore.ready && typeof DEVIS !== 'undefined' && DEVIS.some((d) => d && d.id === 'c3-svg-anc'), null, { timeout: 15000 }).then(() => true).catch((e) => String(e).slice(0, 200));
    }
    rec(G, 'C3-T11 restauration par « Importer » (sauvegarde complète), appli rechargée', pret === true, String(pret));
    if (pret === true) {
      await p.waitForTimeout(800);
      await p.evaluate(AIDE);
      recTous(await essai(p, '(' + FN_SVG_APRES + ')(' + j(av.totaux) + ')'), 'C3-T11');
    }
    rec(G, 'C3-T11 : aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

await closeBrowser();
ecrireResultats('resAC.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
