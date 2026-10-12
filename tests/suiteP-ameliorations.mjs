// Suite P — améliorations 1.12 : rentabilité réelle et SAV (next-rentab.js), demande d'avis (next-avis.js),
// relevé bancaire (next-banque.js), déclaration annuelle des fluides (next-flubilan.js), liste « Lancer l'entreprise »
// (next-objectifs.js). Données fictives uniquement.
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import { ecrireResultats, out } from './env.mjs';
const G='Améliorations 1.12';
const j=o=>JSON.stringify(o);
const proche=(a,b,t)=>Math.abs((Number(a)||0)-(Number(b)||0))<=(t==null?0.011:t);

/* date figée au 12/11/2027 (mois 5 d'un plan démarré le 01/07/2027) ; captures des fichiers et des liens ouverts */
const PREP=(jour)=>`(function(){
  window.todayISO=()=>'${jour||'2027-11-12'}';
  save('cpnext_objectifs',{debut:'2027-07-01'});
  window.__blobs=[]; URL.createObjectURL=b=>{ __blobs.push(b); return 'blob:capture-'+__blobs.length; };
  window.__noms=[]; const oc=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(this.download){ __noms.push(this.download); return; } return oc.apply(this,arguments); };
  window.__liens=[]; window.nxavisOuvrir=u=>__liens.push(u);
})();`;
const lireFichiers=`(async()=>{ const r=[]; for(const b of __blobs) r.push(await b.text()); __blobs.length=0; return r; })()`;
async function preparer(opts,jour){
  const {p,ctx,errs}=await page(Object.assign({mobile:false},opts||{}));
  await seed(p); await p.evaluate(PREP(jour));
  return {p,ctx,errs};
}

/* ================= P1 — chargement, synchro, cache hors ligne ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(async()=>{
    const sw=await (await fetch('./sw.js')).text();
    go('nx_obj'); const h=(document.getElementById('nxobj')||{}).innerText||'';
    return {fns:['nxrtSynthese','nxrtSyntheseSav','nxrtAjouter','nxavisCandidats','nxavisMail','nxbqAnalyser','nxbqValider','nxbqChoisir','nxfbBilan','nxfbCSV','nxobjTreso','nxobjTauxAnnee'].filter(f=>typeof window[f]!=='function'),
      sync:['cpnext_sav','cpnext_avis','cpnext_flubilan','cpnext_bqvus','cpnext_objectifs','cpnext_objsuivi'].filter(k=>SYNC_KEYS.indexOf(k)<0),
      cache:['next-rentab.js','next-avis.js','next-banque.js','next-flubilan.js'].filter(f=>sw.indexOf('./'+f)<0), cle:/const C='climpilot-next-1120/.test(sw),
      ajouts:(window.nxobjAjouts||[]).map(a=>a.id).sort().join(','),
      blocs:['Ma rentabilité réelle','Retours SAV non facturés','Mon relevé bancaire'].filter(x=>h.indexOf(x)<0)}; });
  rec(G,'Les 4 modules 1.12 sont chargés (fonctions présentes)',r.fns.length===0,j(r));
  rec(G,'Nouvelles données synchronisées entre appareils (SAV, avis, bilan fluides, relevés déjà rapprochés)',r.sync.length===0,j(r));
  rec(G,'Les 4 fichiers sont dans le cache hors ligne, nom de cache changé (1.12)',r.cache.length===0&&r.cle,j(r));
  rec(G,'Les modules s’inscrivent une seule fois dans « Objectifs & feux »',r.ajouts==='avis,banque,flubilan,rentab',r.ajouts);
  rec(G,'Écran Objectifs & feux : cartes « Ma rentabilité réelle », « Retours SAV » et « Mon relevé bancaire »',r.blocs.length===0,j(r));
  rec(G,'Aucune erreur JavaScript au chargement (PC)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P2 — taux horaire réel ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{
    const A=DEVIS.filter(d=>d.statut==='accepte'), g=DEVIS.find(d=>/GAI/.test(d.num)), ref=DEVIS.find(d=>d.statut==='refuse'&&compute(d).totalHT>0);
    const a=A.find(d=>/BAL/.test(d.num)), b=A.find(d=>/DPS/.test(d.num));
    g.statut='accepte';
    a.hReel='10'; a.achatReel='150'; a.facSolde={num:'F-2027-101',date:'2027-10-02',montant:604,payeLe:'2027-10-05',mode:'Virement'};
    b.hReel='3'; b.achatReel=''; b.facSolde={num:'F-2027-102',date:'2027-09-15',montant:152};      /* achats non saisis → estimation */
    g.hReel='25'; g.achatReel='2600'; g.facSolde={num:'F-2026-050',date:'2026-10-01',montant:4861}; /* plus de 12 mois → pas compté */
    ref.hReel='4';                                                                                   /* refusé → pas compté */
    save(LS.devis,DEVIS);
    const ca=compute(a), cb=compute(b), ht=ca.totalHT+cb.totalHT, ach=150+cb.matAchat, h=13;
    const S=nxrtSynthese('2027-11-12');
    const hMo=(ca.mo>0?10:0)+(cb.mo>0?3:0), attMo=(ca.mo+cb.mo)/hMo;
    const att=(ht-ach)/h, cot=nxCotisPct('2027-11-12'), attNet=(ht*(1-cot/100)-ach)/h, prev=(ht-ca.matAchat-cb.matAchat)/(ca.heures+cb.heures);
    /* retour SAV lié au devis a : ses heures comptent dans le € / h */
    const id=nxrtAjouter({date:'2027-10-20',devis:a.num,heures:'2',motif:'pose'});
    const S2=nxrtSynthese('2027-11-12'), att2=(ht-ach)/(h+2);
    go('nx_obj'); const c=document.getElementById('nxrt'), txt=c?c.innerText:'';
    return {n:S.n,parH:S.parH,att,parHNet:S.parHNet,attNet,prevH:S.prevH,prev,estim:S.achatsEstimes,obj:S.objectif,coul:S.couleur,manque:S.manque,moH:S.moH,attMo,hMo,attManque:Math.max(0,55-attMo)*hMo,lab:/Ta main-d’œuvre par heure réelle/.test(c?c.textContent:''),
      ecart:S.ecartH,attEcart:(h-(ca.heures+cb.heures))/(ca.heures+cb.heures),parH2:S2.parH,att2,hSav:S2.hSav,id:!!id,clientAuto:(nxrtSav()[0]||{}).client,
      carte:!!c,ligneA:!!(c&&c.querySelector('tr[data-rt="'+a.num+'"]')),ligneG:!!(c&&c.querySelector('tr[data-rt="'+g.num+'"]')),
      val:txt.indexOf(eur(S2.parH))>=0,etoile:/\*/.test(txt)}; });
  rec(G,'€ / h réel = (prix HT − achats) ÷ heures réelles, sur les chantiers des 12 derniers mois seulement',r.n===2&&proche(r.parH,r.att,0.011),j(r));
  rec(G,'Achats réels saisis pris tels quels ; sinon estimation du devis, signalée (*)',r.estim===1&&r.etoile,j(r));
  rec(G,'Devis refusé et chantier de plus de 12 mois ignorés',r.n===2&&r.ligneA&&!r.ligneG,j(r));
  rec(G,'€ / h après cotisations du profil fiscal',proche(r.parHNet,r.attNet,0.011),j(r));
  rec(G,'Indicateur principal : main-d’œuvre facturée ÷ heures réelles, comparée au taux du plan (55 € année 1)',r.obj===55&&r.hMo>0&&proche(r.moH,r.attMo,0.011)&&r.lab,j(r));
  rec(G,'Couleur et manque à gagner calculés sur la main-d’œuvre (pas sur la marge matériel)',r.coul===(r.attMo>=55?'vert':r.attMo>=46.75?'orange':'rouge')&&proche(r.manque,r.attManque,0.05),j(r));
  rec(G,'Écart heures réelles / prévues calculé sur les mêmes chantiers',proche(r.ecart,r.attEcart,0.0001),j(r));
  rec(G,'Un retour SAV lié au chantier ajoute ses heures au calcul (€ / h baisse)',r.id&&r.hSav===2&&proche(r.parH2,r.att2,0.011),j(r));
  rec(G,'Retour SAV lié à un devis : client repris du devis',r.clientAuto==='Boulangerie Dupré',r.clientAuto);
  rec(G,'Carte affichée avec la valeur et la ligne du chantier',r.carte&&r.val,j(r));
  /* avoir, facture annulée : chantier pas compté (signalé) ; « sans heures réelles » compté sur 12 mois seulement */
  const r3=await p.evaluate(()=>{ const n0=nxrtSynthese('2027-11-12');
    const s=DEVIS.find(d=>/SPL/.test(d.num)), m=DEVIS.find(d=>/MES/.test(d.num)), ch=DEVIS.find(d=>/CHF/.test(d.num));
    s.statut='accepte'; s.hReel='5'; s.facSolde={num:'F-2027-103',date:'2027-10-10',montant:779};
    m.statut='accepte'; m.facSolde={num:'F-2026-104',date:'2026-06-01',montant:347};                 /* sans heures, il y a plus de 12 mois */
    ch.statut='accepte'; ch.facSolde={num:'F-2027-105',date:'2027-10-01',montant:5573};              /* sans heures, dans les 12 mois */
    save(LS.devis,DEVIS); const AV=nxAvoirs(); AV.push({id:'pa1',num:'AV-2027-001',facNum:'F-2027-103',date:'2027-10-12',montant:100,motif:'Geste',cli:{nom:s.cNom}}); save('cp2_avoirs',AV);
    const n1=nxrtSynthese('2027-11-12'); go('nx_obj'); const txt=(document.getElementById('nxrt')||{}).innerText||'';
    return {n0:n0.n,n1:n1.n,avoir:n1.avecAvoir,sansH0:n0.sansH,sansH1:n1.sansH,txt:/avec avoir/.test(txt)}; });
  rec(G,'Chantier avec avoir : pas compté, et signalé',r3.n1===r3.n0&&r3.avoir===1&&r3.txt,j(r3));
  rec(G,'« Chantiers facturés sans heures réelles » comptés sur les 12 derniers mois seulement',r3.sansH1===r3.sansH0+1,j(r3));

  /* assujetti à la TVA : achats réels (TTC payés) ramenés HT */
  const r2=await p.evaluate(()=>{ const a=DEVIS.find(d=>/BAL/.test(d.num)), b=DEVIS.find(d=>/DPS/.test(d.num)); const o={reg:P.regimeTVA,at:P.achatTVA};
    P.regimeTVA='assujetti'; P.achatTVA=20; const ca=compute(a), cb=compute(b), S=nxrtSynthese('2027-11-12');
    const att=(ca.totalHT+cb.totalHT-150/1.2-cb.matAchat)/(10+2+3); P.regimeTVA=o.reg; P.achatTVA=o.at; return {parH:S.parH,att}; });
  rec(G,'Si tu factures la TVA : achats réels TTC ramenés HT',proche(r2.parH,r2.att,0.011),j(r2));
  rec(G,'Aucune erreur JavaScript (rentabilité)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P3 — retours SAV non facturés ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{ window.confirm=()=>true;
    const n0=nxrtSav().length, ko=[nxrtAjouter({date:'2027-11-20',heures:'1'}),nxrtAjouter({date:'2027-11-01'}),nxrtAjouter({date:'2027-11-01',heures:'-1'}),nxrtAjouter({date:'2027-11-01',heures:'30'})];
    const g=DEVIS.find(d=>/GAI/.test(d.num)); g.statut='accepte'; g.facSolde={num:'F-2027-110',date:'2027-10-10',montant:4861}; save(LS.devis,DEVIS);
    const prov=compute(g).lines.filter(l=>/^Provision SAV/.test(l.label)).reduce((s,l)=>s+l.ht,0);
    nxrtAjouter({date:'2027-10-15',client:'Supérette Test',heures:'1,5',km:'40',pieces:'35',motif:'pose',note:'raccord repris'});
    nxrtAjouter({date:'2027-11-02',client:'Boucherie Test',heures:'0.5',km:'10',motif:'fabricant'});
    nxrtAjouter({date:'2026-09-01',client:'Ancien',heures:'3',motif:'geste'});                                   /* hors 12 mois */
    const V=nxrtSyntheseSav('2027-11-12');
    nxobjSet('coutKm','0,5'); const V2=nxrtSyntheseSav('2027-11-12');
    go('nx_obj'); const txt=(document.getElementById('nxrt')||{}).innerText||'';
    const id=nxrtSav().find(x=>x.client==='Boucherie Test').id; const del=nxrtSuppr(id), apres=nxrtSav().length;
    return {n0,ko,n:V.n,h:V.heures,km:V.km,pieces:V.pieces,cout:V.cout,att:2*55+35,cout2:V2.cout,att2:2*55+35+50*0.5,prov:V.provision,attProv:prov,couv:V.couverture,pose:V.parMotif.pose,
      txt:/ne couvre que|couvre tes retours/.test(txt)&&/défauts de pose/.test(txt),del,apres}; });
  rec(G,'Retour SAV refusé : date future, rien à noter, valeur négative, plus de 24 h',r.ko.every(x=>x===false)&&r.n0===0,j(r.ko));
  rec(G,'Totaux SAV des 12 derniers mois (heures, km, pièces), virgule acceptée',r.n===2&&proche(r.h,2)&&proche(r.km,50)&&proche(r.pieces,35),j(r));
  rec(G,'Coût estimé = heures × taux du plan + pièces ; + km × coût du km une fois renseigné',proche(r.cout,r.att)&&proche(r.cout2,r.att2),j(r));
  rec(G,'Provision SAV facturée = lignes « Provision SAV » des devis facturés dans la période',r.prov>0&&proche(r.prov,r.attProv,0.011)&&proche(r.couv,r.attProv/r.att,0.0001),j(r));
  rec(G,'Verdict de couverture et part des défauts de pose affichés',r.txt&&proche(r.pose,1.5),j(r));
  rec(G,'Suppression d’un retour (après confirmation)',r.del===true&&r.apres===2,j(r));

  /* synchro : deux retours notés sur deux appareils sont gardés ; une suppression sur un appareil se propage */
  const m=await p.evaluate(()=>{ const x={id:'sav_a',date:'2027-10-01',heures:1}, y={id:'sav_b',date:'2027-10-02',heures:2}, z={id:'sav_c',date:'2027-10-03',heures:3};
    const deux=cpMerge({cpnext_sav:[x]},{cpnext_sav:[x,y]},{cpnext_sav:[x,z]}).cpnext_sav.map(o=>o.id).sort().join(',');
    const sup=cpMerge({cpnext_sav:[x,y]},{cpnext_sav:[y]},{cpnext_sav:[x,y]}).cpnext_sav.map(o=>o.id).join(',');
    return {deux,sup}; });
  rec(G,'Synchro : retours SAV notés sur deux appareils gardés tous les deux, suppression propagée',m.deux==='sav_a,sav_b,sav_c'&&m.sup==='sav_b',j(m));
  rec(G,'Aucune erreur JavaScript (SAV)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P4 — demander un avis ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{
    const a=DEVIS.find(d=>/BAL/.test(d.num)), b=DEVIS.find(d=>/DPS/.test(d.num)), s=DEVIS.find(d=>/SPL/.test(d.num));
    a.facSolde={num:'F-2027-120',date:'2027-10-20',montant:604,payeLe:'2027-11-01',mode:'Virement'};
    s.statut='accepte'; s.facSolde={num:'F-2027-121',date:'2027-10-25',montant:779,payeLe:'2027-11-03',mode:'Chèque'};       /* même client : une seule demande */
    b.facSolde={num:'F-2027-122',date:'2027-08-01',montant:152,payeLe:'2027-08-10',mode:'Virement'};                         /* plus de 60 jours */
    save(LS.devis,DEVIS);
    go('nx_obj'); const sans=document.getElementById('nxavis'), sansTxt=sans?sans.innerText:'', sansBtn=!!(sans&&sans.querySelector('[onclick^="nxavMail"]'));
    /* le lien se saisit dans Paramètres › Mon entreprise */
    go('params'); const champ=document.getElementById('pe_avis'); if(champ){ champ.value='https://g.page/r/EXEMPLE-fictif/review'; } saveParams();
    const lienP=P.entreprise.avisGoogle;
    const C=nxavisCandidats('2027-11-12');
    go('nx_obj'); const carte=document.getElementById('nxavis'), btnMail=!!(carte&&carte.querySelector('[onclick^="nxavisMail"]')), btnSms=!!(carte&&carte.querySelector('[onclick^="nxavisSms"]'));
    const id=(C[0]||{}).id, m=nxavisMessage('Boulangerie Dupré');
    nxavisMail(id); const apres=nxavisCandidats('2027-11-12').length, mk=nxavisMarques();
    return {sansTxt:/Paramètres/.test(sansTxt),sansBtn,champ:!!champ,lienP,n:C.length,cli:C.map(x=>x.client),btnMail,btnSms,lien:__liens[0]||'',m,apres,mk};
  });
  rec(G,'Sans lien de fiche Google : la carte dit où le coller, aucun bouton d’envoi',r.sansTxt&&!r.sansBtn,j(r));
  rec(G,'Lien d’avis saisi et gardé dans Paramètres › Mon entreprise',r.champ&&r.lienP==='https://g.page/r/EXEMPLE-fictif/review',j(r));
  rec(G,'Clients payés depuis moins de 60 jours, une seule ligne par client',r.n===1&&r.cli[0]==='Boulangerie Dupré',j(r.cli));
  rec(G,'Boutons mail et SMS quand le client a une adresse et un téléphone',r.btnMail&&r.btnSms,j(r));
  rec(G,'Mail prêt : adresse du client, objet, texte neutre avec le lien (ni contrepartie, ni « si vous êtes satisfait »)',/^mailto:b%40d\.fr\?subject=/.test(r.lien)&&decodeURIComponent(r.lien).indexOf('https://g.page/r/EXEMPLE-fictif/review')>0&&/Boulangerie Dupré/.test(r.m)&&!/cadeau|réduction|remise|offert/i.test(r.m)&&!/satisfait/i.test(r.m),r.lien);
  rec(G,'Une fois demandé, le client ne revient plus dans la liste (date gardée)',r.apres===0&&r.mk.length===1&&r.mk[0].etat==='demande'&&r.mk[0].d==='2027-11-12',j(r.mk));

  const r2=await p.evaluate(()=>{
    const res={};
    P.entreprise.avisGoogle='http://exemple.fr/avis'; res.http=nxavisLien();
    localStorage.setItem('cpnext_avis','[]'); go('nx_obj'); res.httpMsg=/doit commencer par/.test((document.getElementById('nxavis')||{}).innerText||'');
    P.entreprise.avisGoogle='javascript:alert(1)'; res.js=nxavisLien();
    P.entreprise.avisGoogle='https://g.page/r/EXEMPLE-fictif/review';
    localStorage.setItem('cpnext_avis','[]');
    __liens.length=0; const id=nxavisCandidats('2027-11-12')[0].id; nxavisSms(id); res.sms=__liens[0]||'';
    localStorage.setItem('cpnext_avis','[]'); nxavisNon(id); res.non=nxavisCandidats('2027-11-12').length; res.etat=nxavisMarques()[0].etat;
    /* avant le lancement : pas de carte */
    save('cpnext_objectifs',{debut:'2028-01-01'}); localStorage.setItem('cpnext_avis','[]'); go('nx_obj'); res.avant=!!document.getElementById('nxavis');
    save('cpnext_objectifs',{debut:'2027-07-01'});
    return res; });
  rec(G,'Lien refusé s’il n’est pas en https (http, javascript:), avec une explication dans la carte',r2.http===''&&r2.js===''&&r2.httpMsg===true,j(r2));
  rec(G,'SMS prêt avec le numéro du client (chiffres seulement) et le texte',/^sms:0611223344\?&body=/.test(r2.sms),r2.sms);
  rec(G,'« Pas pour ce client » : retiré de la liste',r2.non===0&&r2.etat==='non',j(r2));
  rec(G,'Avant le lancement de l’activité : pas de carte « Demander un avis »',r2.avant===false,j(r2));
  rec(G,'Aucune erreur JavaScript (avis)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P5 — lecture des relevés bancaires ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{
    const M=[['1 234,56',1234.56],['-12,30',-12.3],['1.234,56',1234.56],['1234.56',1234.56],['12,30-',-12.3],['(12,30)',-12.3],['+45 €',45],['1,234.50',1234.5],['1\u00a0234,56',1234.56],['abc',null],['',null],['12a',null],['1.234',null],['12,500',null],['−12,30',-12.3],['12,30 CR',12.3],['12,30 DB',-12.3]];
    const D=[['15/11/2027','2027-11-15'],['15/11/27','2027-11-15'],['2027-11-15','2027-11-15'],['2027-11-15 10:00:00','2027-11-15'],['15.11.2027','2027-11-15'],['15-11-2027','2027-11-15'],['31/02/2027',''],['foo',''],['2027-13-01','']];
    const mOk=M.filter(x=>nxbqMontant(x[0])!==x[1]).map(x=>x[0]+' → '+nxbqMontant(x[0])), dOk=D.filter(x=>nxbqDate(x[0])!==x[1]).map(x=>x[0]+' → '+nxbqDate(x[0]));
    /* format A : titres dateOp / label / amount / accountbalance, « ; », guillemets, solde identique partout */
    const A='\ufeff"dateOp";"dateVal";"label";"category";"categoryParent";"supplierFound";"amount";"comment";"accountNum";"accountLabel";"accountbalance"\n'
      +'"2027-11-05";"2027-11-05";"VIR SEPA CLIENT ""TEST""";"Virements reçus";"";"";"1 200,00";"";"XXXX";"Compte pro";"8 456,78"\n'
      +'"2027-11-03";"2027-11-03";"PRLV URSSAF";"Impôts";"";"";"-312,00";"";"XXXX";"Compte pro";"8 456,78"\n';
    const a=nxbqAnalyser(A);
    /* format B : lignes d'en-tête du compte avant les titres, Date;Libellé;Débit;Crédit;Solde, plus récent en haut */
    const B='Compte courant professionnel\nPériode du 01/11/2027 au 10/11/2027\n\nDate;Libellé;Débit euros;Crédit euros;Solde\n10/11/2027;REMISE CHEQUE;;450,00;5 450,00\n10/11/2027;CB STATION;62,10;;5 000,00\n08/11/2027;VIR RECU DUPONT;;300,00;5 062,10\n';
    const b=nxbqAnalyser(B);
    /* format C : virgules, point décimal */
    const C='Date,Description,Amount,Balance\n2027-11-04,"Transfer, client X",250.50,1000.00\n2027-11-06,Card,-20.00,980.00\n';
    const c=nxbqAnalyser(C);
    /* format D : sans titres, une colonne de montants signés → colonnes devinées */
    const Dd='05/11/2027;VIR CLIENT A;1200,00\n06/11/2027;CB GRAND FROID;-89,90\n07/11/2027;VIR CLIENT B;300,00\n';
    const d=nxbqAnalyser(Dd);
    /* format E : sans titres, deux colonnes de montants sans signe → refus (débit/crédit indiscernables) */
    const e=nxbqAnalyser('05/11/2027;VIR CLIENT A;1200,00;0\n06/11/2027;CB;0;89,90\n');
    const f=nxbqAnalyser('bonjour\nceci n’est pas un relevé\n');
    /* colonne « Montant » sans aucun montant négatif : refus (débits et crédits indiscernables) */
    const g=nxbqAnalyser('Date;Libellé;Montant;Sens\n05/11/2027;VIR CLIENT;450,00;C\n06/11/2027;PRLV URSSAF;312,00;D\n');
    /* colonne unique « Crédit/Débit » : le signe compte (−450 = sortie, pas un encaissement) */
    const hh=nxbqAnalyser('Date;Libellé;Crédit/Débit\n05/11/2027;BERNARD REMBOURSEMENT;-450,00\n06/11/2027;VIR X;100,00\n');
    /* colonne Crédit négative (rejet de virement) à côté d'une colonne Débit : pas un encaissement */
    const k=nxbqAnalyser('Date;Libellé;Débit;Crédit\n05/11/2027;REJET VIR;;-450,00\n06/11/2027;VIR Y;;100,00\n07/11/2027;CB;20,00;\n');
    /* montant ambigu : ligne ignorée et comptée */
    const l=nxbqAnalyser('Date;Libellé;Montant\n05/11/2027;VIR A;1.234\n06/11/2027;VIR B;100,00\n07/11/2027;CB;-5,00\n');
    return {mOk,dOk,
      a:{n:a.lignes,cred:a.credits,m:a.res&&a.res.map(x=>x.c.montant),lib:a.res&&a.res[0].c.lib,solde:a.solde},
      b:{n:b.lignes,cred:b.credits,m:b.res&&b.res.map(x=>x.c.montant),solde:b.solde,du:b.du,au:b.au},
      c:{n:c.lignes,cred:c.credits,m:c.res&&c.res.map(x=>x.c.montant),lib:c.res&&c.res[0].c.lib,solde:c.solde},
      d:{n:d.lignes,cred:d.credits,auto:d.auto,m:d.res&&d.res.map(x=>x.c.montant)},e:e.erreur||'',f:f.erreur||'',g:g.erreur||'',hh:hh.res?hh.res.map(x=>x.c.montant):hh.erreur,k:k.res?k.res.map(x=>x.c.montant):k.erreur,l:{n:l.lignes,ign:l.ignorees}}; });
  rec(G,'Montants lus : virgule ou point, espaces, signe devant ou derrière (−, CR/DB), parenthèses, € ; « 1.234 » ou « 12,500 » ambigus refusés',r.mOk.length===0,j(r.mOk));
  rec(G,'Dates lues (jj/mm/aaaa, jj/mm/aa, ISO, points, tirets) ; dates impossibles refusées',r.dOk.length===0,j(r.dOk));
  rec(G,'Relevé à titres dateOp / label / amount : crédits seuls, guillemets doublés, solde du compte',r.a.n===2&&r.a.cred===1&&r.a.m[0]===1200&&r.a.lib==='VIR SEPA CLIENT "TEST"'&&r.a.solde&&r.a.solde.montant===8456.78&&r.a.solde.date==='2027-11-05',j(r.a));
  rec(G,'Relevé Date;Libellé;Débit;Crédit;Solde avec lignes d’en-tête : solde après la dernière opération',r.b.n===3&&r.b.cred===2&&j(r.b.m)==='[450,300]'&&r.b.solde&&r.b.solde.montant===5450&&r.b.solde.date==='2027-11-10',j(r.b));
  rec(G,'Relevé séparé par des virgules, point décimal, virgule dans un libellé entre guillemets',r.c.n===2&&r.c.cred===1&&r.c.m[0]===250.5&&r.c.lib==='Transfer, client X'&&r.c.solde.montant===980,j(r.c));
  rec(G,'Sans titres, une colonne de montants signés : colonnes devinées (et signalé)',r.d.n===3&&r.d.cred===2&&r.d.auto===true,j(r.d));
  rec(G,'Sans titres, débit et crédit indiscernables : refus plutôt qu’une erreur',/Format non reconnu/.test(r.e),r.e);
  rec(G,'Fichier qui n’est pas un relevé : message clair',/Format non reconnu|Aucune opération/.test(r.f),r.f);
  rec(G,'Colonne « Montant » sans aucun montant négatif : refus (crédits et débits indiscernables)',/aucune sortie/.test(r.g),r.g);
  rec(G,'Colonne unique « Crédit/Débit » : un montant négatif est une sortie, jamais un encaissement',j(r.hh)==='[100]',j(r.hh));
  rec(G,'Crédit négatif (rejet) à côté d’une colonne Débit : pas un encaissement',j(r.k)==='[100]',j(r.k));
  rec(G,'Montant ambigu : ligne ignorée et comptée (affichée dans la fenêtre)',r.l.n===2&&r.l.ign===1,j(r.l));
  const u16=await p.evaluate(()=>{ const t='Date;Libellé;Montant\n05/11/2027;VIR CAFÉ;10,00\n'; const b=new Uint8Array(2+t.length*2); b[0]=0xFF; b[1]=0xFE; for(let i=0;i<t.length;i++){ const c=t.charCodeAt(i); b[2+2*i]=c&255; b[3+2*i]=c>>8; } return nxbqDecoder(b.buffer); });
  rec(G,'Fichier en UTF-16 (avec marque d’ordre) lu correctement',/^Date;Libellé;Montant\n05\/11\/2027;VIR CAFÉ;10,00/.test(u16),u16);
  /* encodage Windows-1252 (banques françaises) : « Libellé » et « é » bien lus */
  const enc=await p.evaluate(()=>{ return new Promise(res=>{ const bytes=new Uint8Array([0x44,0x61,0x74,0x65,0x3b,0x4c,0x69,0x62,0x65,0x6c,0x6c,0xe9,0x3b,0x43,0x72,0xe9,0x64,0x69,0x74,0x0a,0x30,0x35,0x2f,0x31,0x31,0x2f,0x32,0x30,0x32,0x37,0x3b,0x56,0x49,0x52,0x20,0x43,0x41,0x46,0xc9,0x3b,0x31,0x30,0x2c,0x30,0x30,0x0a]);
    const orig=window.nxbqOuvrirTexte; window.nxbqOuvrirTexte=t=>{ window.nxbqOuvrirTexte=orig; res(t); };
    const io=HTMLInputElement.prototype.click; HTMLInputElement.prototype.click=function(){ HTMLInputElement.prototype.click=io; const dt=new DataTransfer(); dt.items.add(new File([bytes],'releve.csv',{type:'text/csv'})); this.files=dt.files; this.dispatchEvent(new Event('change')); };
    nxbqChoisir(); }); });
  rec(G,'Fichier choisi lu sur l’appareil, encodage Windows-1252 reconnu (accents)',/Libellé;Crédit/.test(enc)&&/VIR CAFÉ/.test(enc),enc);
  rec(G,'Aucune erreur JavaScript (lecture des relevés)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P6 — rapprochement et paiements ================= */
{ const {p,ctx,errs}=await preparer();
  const prep=await p.evaluate(()=>{
    const a=DEVIS.find(d=>/BAL/.test(d.num)), b=DEVIS.find(d=>/DPS/.test(d.num)), jo=DEVIS.find(d=>/DEP-/.test(d.num)), g=DEVIS.find(d=>/GAI/.test(d.num)), pac=DEVIS.find(d=>/PAC/.test(d.num));
    a.facSolde={num:'F-2027-201',date:'2027-10-20',montant:1500,payeLe:null,mode:''};                       /* Boulangerie Dupré, pro */
    b.facAcompte={num:'F-2027-202',date:'2027-10-25',montant:450,payeLe:null,mode:''};                      /* L'Atelier du Froid, pro */
    jo.conclusion=null; jo.facSolde={num:'F-2027-206',date:'2027-11-01',montant:820,payeLe:null,mode:''};  /* particulier, contrat à préciser */
    g.statut='accepte'; g.facSolde={num:'F-2027-207',date:'2027-09-01',montant:999,payeLe:'2027-09-10',mode:'Virement'}; /* déjà payée */
    pac.statut='accepte'; pac.cNom='Mme Petit'; pac.cType='Particulier'; pac.conclusion={mode:'hors_etablissement',date:'2027-11-08',preuve:{type:'papier',ref:'test'},urgence:false};
    pac.facSolde={num:'F-2027-208',date:'2027-11-08',montant:640,payeLe:null,mode:''};                     /* particulier, signé chez lui le 08/11 */
    save(LS.devis,DEVIS);
    DEP.push({id:'p_dep',cNom:'Garage Lemoine',cType:'Professionnel',date:'2027-11-02',statut:'facturee',facNum:'F-2027-203',facDate:'2027-11-02',itype:'dep',mode:'temps',heures:2,pieces:[]}); save(LS.dep,DEP);
    const depTTC=Math.round(computeDep(DEP[DEP.length-1]).totalHT*100)/100;
    CLIENTS.push({id:'c_sup',nom:'Supérette Test',type:'Professionnel',tel:'',mail:''},{id:'c_cmp',nom:'Camping Les Pins',type:'Professionnel',tel:'',mail:''}); save(LS.clients,CLIENTS);
    CTR.push({id:'p_ctr',clientNom:'Supérette Test',type:'clim',prix:300,visites:1,actif:true,facs:[{annee:2027,num:'F-2027-204',date:'2027-11-01',montant:300}]}); save('cp2_contrats',CTR);
    LOC.push({id:'p_loc',num:'LOC-1',cNom:'Camping Les Pins',cType:'Professionnel',statut:'retour',fac:{num:'F-2027-205',date:'2027-11-03',montant:300}}); save(LS.loc,LOC);
    return {depTTC,depFR:String(depTTC.toFixed(2)).replace('.',',')}; });
  const csv='dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance\n'
    +'2027-11-10;2027-11-10;VIR MME PETIT;;;;640,00;;X;Pro;"9 999,99"\n'
    +'2027-11-09;2027-11-09;VIR SEPA BOULANGERIE DUPRE FACT F-2027-201;;;;1500,00;;X;Pro;"9 999,99"\n'
    +'2027-11-09;2027-11-09;VIR DUPRE BIS;;;;1500,00;;X;Pro;"9 999,99"\n'
    +'2027-11-08;2027-11-08;PRLV URSSAF;;;;-1500,00;;X;Pro;"9 999,99"\n'
    +'2027-11-07;2027-11-07;VIR M DURAND;;;;300,00;;X;Pro;"9 999,99"\n'
    +'2027-11-06;2027-11-06;VIR L ATELIER DU FROID;;;;450,00;;X;Pro;"9 999,99"\n'
    +'2027-11-06;2027-11-06;VIR SUPERETTE TEST;;;;300,00;;X;Pro;"9 999,99"\n'
    +'2027-11-05;2027-11-05;REMISE CHEQUE 1234567;;;;'+prep.depFR+';;X;Pro;"9 999,99"\n'
    +'2027-11-04;2027-11-04;VIR MARTIN;;;;820,00;;X;Pro;"9 999,99"\n'
    +'2027-11-03;2027-11-03;VIR CLIENT;;;;999,00;;X;Pro;"9 999,99"\n'
    +'2027-11-02;2027-11-02;VIR BOULANGERIE DUPRE;;;;1499,99;;X;Pro;"9 999,99"\n';
  const r=await p.evaluate((csv)=>{
    const A=nxbqAnalyser(csv), F=A.factures, by=lib=>A.res.find(x=>x.c.lib===lib), fac=x=>x&&x.choix!=null?F[x.choix].num:null;
    const L=['VIR SEPA BOULANGERIE DUPRE FACT F-2027-201','VIR DUPRE BIS','VIR M DURAND','VIR L ATELIER DU FROID','VIR SUPERETTE TEST','REMISE CHEQUE 1234567','VIR MARTIN','VIR CLIENT','VIR BOULANGERIE DUPRE','VIR MME PETIT'];
    const v={}; L.forEach(l=>{ const x=by(l); v[l]=x?{f:fac(x),conf:x.conf,coche:x.coche,bloc:!!x.blocage,mode:x.mode,al:(x.alertes||[]).join(' ')}:null; });
    return {credits:A.credits,v,impayees:F.map(f=>f.num).sort()}; },csv);
  const V=r.v;
  rec(G,'Débits jamais rapprochés ; seuls les crédits sont lus',r.credits===10,j(r));
  rec(G,'N° de facture + nom dans le libellé : « sûr », coché d’office',V['VIR SEPA BOULANGERIE DUPRE FACT F-2027-201'].f==='F-2027-201'&&V['VIR SEPA BOULANGERIE DUPRE FACT F-2027-201'].conf==='sur'&&V['VIR SEPA BOULANGERIE DUPRE FACT F-2027-201'].coche===true,j(V));
  rec(G,'Nom du client seul dans le libellé : « sûr » (L’Atelier du Froid)',V['VIR L ATELIER DU FROID'].f==='F-2027-202'&&V['VIR L ATELIER DU FROID'].conf==='sur',j(V['VIR L ATELIER DU FROID']));
  rec(G,'Deux factures du même montant : le nom départage (Supérette → contrat), l’autre crédit reste « à choisir », pas coché',V['VIR SUPERETTE TEST'].f==='F-2027-204'&&V['VIR SUPERETTE TEST'].conf==='sur'&&V['VIR M DURAND'].f==='F-2027-205'&&V['VIR M DURAND'].conf==='choisir'&&V['VIR M DURAND'].coche===false,j([V['VIR SUPERETTE TEST'],V['VIR M DURAND']]));
  rec(G,'Seule facture de ce montant mais rien dans le libellé : « à vérifier », pas cochée ; chèque reconnu',V['REMISE CHEQUE 1234567'].f==='F-2027-203'&&V['REMISE CHEQUE 1234567'].conf==='probable'&&V['REMISE CHEQUE 1234567'].coche===false&&V['REMISE CHEQUE 1234567'].mode==='Chèque',j(V['REMISE CHEQUE 1234567']));
  rec(G,'Deuxième crédit du même montant : la facture n’est pas prise deux fois',V['VIR DUPRE BIS'].f===null&&V['VIR DUPRE BIS'].conf==='pris',j(V['VIR DUPRE BIS']));
  rec(G,'Facture déjà payée et montant à 1 centime près : jamais proposés',V['VIR CLIENT'].f===null&&V['VIR BOULANGERIE DUPRE'].f===null&&r.impayees.indexOf('F-2027-207')<0,j([V['VIR CLIENT'],V['VIR BOULANGERIE DUPRE']]));
  rec(G,'Particulier au contrat « à préciser » (L221-10) : bloqué, pas coché',V['VIR MARTIN'].f==='F-2027-206'&&V['VIR MARTIN'].bloc===true&&V['VIR MARTIN'].coche===false,j(V['VIR MARTIN']));
  rec(G,'Particulier payé avant la fin du délai de 7 jours : signalé dès l’analyse (« irrégulier »), pas coché d’office',V['VIR MME PETIT'].f==='F-2027-208'&&V['VIR MME PETIT'].coche===false&&/IRRÉGULIER/.test(V['VIR MME PETIT'].al),j(V['VIR MME PETIT']));

  /* validation dans la fenêtre : le « à vérifier » coché à la main ; le particulier signé chez lui le 08/11 et payé le 10/11
     (avant la fin du délai de 7 jours) passe par le contrôle L221-10 : refusé si tu réponds non */
  const v=await p.evaluate((csv)=>{
    const oT=window.todayISO, oM=window.askMode;
    nxbqOuvrirTexte(csv); const m=document.getElementById('nxbqM'), cases=[...m.querySelectorAll('.nxbq-l input[type=checkbox]')];
    const coches0=cases.filter(c=>c.checked).length, desact=cases.filter(c=>c.disabled).length;
    const ligne=re=>+[...document.querySelectorAll('#nxbqM .nxbq-l')].find(x=>re.test(x.innerText)).dataset.i;
    nxbqCoche(ligne(/REMISE CHEQUE/),true); nxbqCoche(ligne(/VIR MME PETIT/),true);
    const bouton=document.getElementById('nxbqOk').innerText;
    window.confirm=()=>false;                                              /* « le client a-t-il déjà payé ? » → non */
    const R=nxbqValider();
    const a=DEVIS.find(d=>/BAL/.test(d.num)), b=DEVIS.find(d=>/DPS/.test(d.num)), pac=DEVIS.find(d=>/PAC/.test(d.num)), jo=DEVIS.find(d=>/DEP-/.test(d.num));
    const dep=DEP.find(x=>x.id==='p_dep'), ctr=CTR.find(x=>x.id==='p_ctr'), loc=LOC.find(x=>x.id==='p_loc');
    const livre=allRecettes().filter(x=>/^F-2027-20[1-68]$/.test(x.num)).map(x=>x.num+'@'+x.date+'@'+x.mode).sort();
    const o=nxobjEtat();
    return {coches0,desact,bouton,ok:R.ok.slice().sort(),ko:R.ko,treso:R.treso,
      a:[a.facSolde.payeLe,a.facSolde.mode],b:[b.facAcompte.payeLe,b.facAcompte.mode],dep:[dep.statut,dep.payeLe,dep.modeReg],ctr:[ctr.facs[0].payeLe,ctr.facs[0].mode],
      loc:loc.fac.payeLe||null,pac:pac.facSolde.payeLe||null,jo:jo.facSolde.payeLe||null,livre,
      tresoM:o.tresoMontant,tresoD:o.tresoDate,restaure:window.todayISO===oT&&window.askMode===oM&&todayISO()==='2027-11-12',ferme:!document.getElementById('nxbqM')}; },csv);
  rec(G,'Fenêtre : les « sûrs » sans alerte cochés d’office (3), le particulier bloqué non cochable',v.coches0===3&&v.desact>=1,j(v));
  rec(G,'Bouton « Marquer N facture(s) payée(s) » à jour',/Marquer 5 facture/.test(v.bouton),v.bouton);
  rec(G,'Factures cochées marquées payées À LA DATE DU CRÉDIT, avec le mode (devis, acompte, intervention, contrat)',j(v.a)===j(['2027-11-09','Virement'])&&j(v.b)===j(['2027-11-06','Virement'])&&j(v.dep)===j(['payee','2027-11-05','Chèque'])&&j(v.ctr)===j(['2027-11-06','Virement']),j(v));
  rec(G,'Elles entrent au livre des recettes à ces dates (déclaration Urssaf)',j(v.livre)===j(['F-2027-201@2027-11-09@Virement','F-2027-202@2027-11-06@Virement','F-2027-203@2027-11-05@Chèque','F-2027-204@2027-11-06@Virement']),j(v.livre));
  rec(G,'Non cochées, bloquées ou refusées : rien d’enregistré (location « à choisir », particuliers)',v.loc===null&&v.jo===null&&v.pac===null,j(v));
  rec(G,'Particulier payé avant la fin du délai : même contrôle L221-10 que le bouton « Payée » (réponse non → pas enregistré, signalé)',v.ko.length===1&&/F-2027-208/.test(v.ko[0]),j(v.ko));
  rec(G,'Trésorerie mise à jour avec le solde du relevé, datée du relevé',v.treso===true&&proche(v.tresoM,9999.99)&&v.tresoD==='2027-11-10',j(v));
  rec(G,'Après l’import : date du jour et choix du mode de règlement remis comme avant, fenêtre fermée',v.restaure&&v.ferme,j(v));

  /* même relevé importé une 2e fois : plus rien à rapprocher pour les factures payées */
  const reA=await p.evaluate((csv)=>{ const A=nxbqAnalyser(csv); return {f:A.res.filter(x=>x.choix!=null).map(x=>A.factures[x.choix].num).sort(),imp:A.res.filter(x=>x.conf==='importe').length,emp:JSON.parse(localStorage.getItem('cpnext_bqvus')||'[]').length}; },csv), re=reA.f;
  rec(G,'Le même relevé importé deux fois ne paie rien deux fois',re.indexOf('F-2027-201')<0&&re.indexOf('F-2027-203')<0&&re.indexOf('F-2027-204')<0,j(re));
  rec(G,'Lignes déjà rapprochées reconnues à l’import suivant (empreintes gardées, synchronisées)',reA.imp===4&&reA.emp===4,j(reA));

  /* « oui, il a déjà payé » : enregistré par le même chemin, marqué irrégulier */
  const irr=await p.evaluate((csv)=>{ window.confirm=()=>true; nxbqOuvrirTexte(csv); nxbqTresoCoche(false);
    nxbqCoche(+[...document.querySelectorAll('#nxbqM .nxbq-l')].find(x=>/VIR MME PETIT/.test(x.innerText)).dataset.i,true); const R=nxbqValider(); const pac=DEVIS.find(d=>/PAC/.test(d.num));
    return {ok:R.ok,payeLe:pac.facSolde.payeLe,irr:pac.facSolde.paiementIrregulier&&pac.facSolde.paiementIrregulier.statut}; },csv);
  rec(G,'Réponse « oui » au contrôle L221-10 : paiement enregistré à la date du crédit et marqué irrégulier (comme le bouton)',irr.ok.indexOf('F-2027-208')>=0&&irr.payeLe==='2027-11-10'&&irr.irr==='irregulier',j(irr));

  /* garde-fous de l'enregistrement */
  const g=await p.evaluate(()=>{ const f={kind:'loc',id:'p_loc',which:'',num:'F-2027-205',du:300};
    const fut=nxbqPayer(f,'2027-12-01','Virement'), mauvais=nxbqPayer(Object.assign({},f,{du:299}),'2027-11-07','Virement'), dejaDep=nxbqPayer({kind:'dep',id:'p_dep',which:'',num:'F-2027-203',du:1},'2027-11-07','Virement');
    const depApres=DEP.find(x=>x.id==='p_dep').statut;
    return {fut,mauvais,dejaDep,depApres}; });
  rec(G,'Garde-fous : date dans le futur, montant changé, facture déjà payée → rien n’est fait (une intervention payée ne repasse pas « à payer »)',/date/.test(g.fut)&&/montant/.test(g.mauvais)&&/déjà payée/.test(g.dejaDep)&&g.depApres==='payee',j(g));

  /* boutons d'accès dans « À faire maintenant » */
  const b2=await p.evaluate(()=>{ const o=nxobjEtat(); o.tresoMontant=null; o.tresoDate=''; save('cpnext_objectifs',o); go('nx_obj'); const af=document.getElementById('nxo_afaire'); return /Depuis mon relevé/.test(af?af.innerText:''); });
  rec(G,'Sans trésorerie à jour, le rappel propose « Depuis mon relevé »',b2===true,'');
  rec(G,'Aucune erreur JavaScript (rapprochement)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P6b — cas trouvés par la relecture indépendante (12/10) ================= */
{ const {p,ctx,errs}=await preparer();
  const prep=await p.evaluate(()=>{
    CLIENTS.push({id:'c_du',nom:'Durand Pro',type:'Professionnel'},{id:'c_le',nom:'Lefebvre Pro',type:'Professionnel'},{id:'c_ma',nom:'Plomberie Martin',type:'Professionnel'},{id:'c_ze',nom:'Zeta Services',type:'Professionnel'}); save(LS.clients,CLIENTS);
    CTR.push({id:'r_c1',clientNom:'Durand Pro',type:'clim',prix:150,visites:1,actif:true,facs:[{annee:2027,num:'F-2027-110',date:'2027-10-01',montant:150}]});
    CTR.push({id:'r_c2',clientNom:'Lefebvre Pro',type:'clim',prix:150,visites:1,actif:true,facs:[{annee:2027,num:'F-2027-112',date:'2027-10-01',montant:150}]});
    CTR.push({id:'r_c3',clientNom:'Zeta Services',type:'clim',prix:75,visites:1,actif:true,facs:[{annee:2027,num:'F-2027-123',date:'2027-10-01',montant:75}]});
    save('cp2_contrats',CTR);
    /* deux interventions identiques : la 1re marquée payée À LA MAIN le 05/11, la 2e impayée */
    DEP.push({id:'r_d1',cNom:'Plomberie Martin',cType:'Professionnel',date:'2027-11-01',statut:'payee',payeLe:'2027-11-05',modeReg:'Virement',facNum:'F-2027-130',facDate:'2027-11-01',itype:'dep',mode:'temps',heures:1,pieces:[]});
    DEP.push({id:'r_d2',cNom:'Plomberie Martin',cType:'Professionnel',date:'2027-11-03',statut:'facturee',facNum:'F-2027-131',facDate:'2027-11-03',itype:'dep',mode:'temps',heures:1,pieces:[]});
    save(LS.dep,DEP);
    /* facture payée fin septembre, alors que le 3e trimestre est déjà déclaré */
    const s=DEVIS.find(d=>/SPL/.test(d.num)); s.statut='accepte'; s.facSolde={num:'F-2027-140',date:'2027-09-20',montant:779}; save(LS.devis,DEVIS);
    nxobjDecl('2027-T3',true);
    const x=Math.round(computeDep(DEP.find(o=>o.id==='r_d2')).totalHT*100)/100;
    return {x:x.toFixed(2).replace('.',',')}; });
  const csv='Date;Libellé;Montant;Solde\n'
    +'05/11/2027;VIR SEPA LEFEBVRE REF 20271105;150,00;1 000,00\n'
    +'06/11/2027;VIR INST 05/11/2027 123456;75,00;1 075,00\n'
    +'05/11/2027;VIR SEPA MARTIN;'+prep.x+';900,00\n'
    +'28/09/2027;VIR BOULANGERIE DUPRE;779,00;500,00\n'
    +'09/11/2027;CB ACHAT;-50,00;1 025,00\n';
  const r=await p.evaluate((csv)=>{ const A=nxbqAnalyser(csv), F=A.factures, by=re=>A.res.find(x=>re.test(x.c.lib)), fac=x=>x&&x.choix!=null?F[x.choix].num:null;
    const L=by(/LEFEBVRE/), Z=by(/VIR INST/), M=by(/MARTIN/), D=by(/DUPRE/);
    return {lef:[fac(L),L.conf,L.coche],zeta:[fac(Z),Z.conf,Z.coche],mar:[fac(M),M.coche,(M.alertes||[]).join(' ')],dup:[fac(D),D.coche,(D.alertes||[]).join(' ')]}; },csv);
  rec(G,'Relecture n°1 : une référence ou une date dans le libellé n’est jamais prise pour un n° de facture (Lefebvre ≠ facture de Durand)',r.lef[0]==='F-2027-112'&&r.lef[1]==='sur'&&r.zeta[0]==='F-2027-123'&&r.zeta[1]!=='sur'&&r.zeta[2]===false,j(r));
  rec(G,'Relecture n°2 : même montant déjà au livre des recettes à 7 jours près (payé à la main) → alerte, pas coché',r.mar[0]==='F-2027-131'&&r.mar[1]===false&&/déjà au livre des recettes/.test(r.mar[2]),j(r.mar));
  rec(G,'Relecture n°4 : paiement daté dans un trimestre déjà déclaré à l’Urssaf → alerte, pas coché',r.dup[0]==='F-2027-140'&&r.dup[1]===false&&/déjà déclarée/.test(r.dup[2]),j(r.dup));
  /* date de paiement modifiable (chèque, espèces) ; trésorerie : saisie plus récente que le relevé jamais écrasée */
  const v=await p.evaluate((csv)=>{ nxobjTreso(4321,'2027-11-10');
    nxbqOuvrirTexte(csv); const i=+[...document.querySelectorAll('#nxbqM .nxbq-l')].find(x=>/VIR INST/.test(x.innerText)).dataset.i;
    nxbqDateLigne(i,'2027-11-20'); const dFut=document.querySelector('#nxbqM .nxbq-l[data-i="'+i+'"] input[type=date]').value;
    nxbqDateLigne(i,'2027-11-08'); nxbqCoche(i,true);
    const tresoTxt=document.getElementById('nxbqM').innerText;
    const R=nxbqValider(); const c=CTR.find(o=>o.id==='r_c3').facs[0], o=nxobjEtat();
    return {dFut,ok:R.ok,payeLe:c.payeLe,treso:R.treso,tm:o.tresoMontant,td:o.tresoDate,plusRecente:/plus récente que ce relevé/.test(tresoTxt)}; },csv);
  rec(G,'Date de paiement modifiable ligne par ligne (jamais dans le futur) : la facture prend la date choisie',v.dFut==='2027-11-06'&&j(v.ok.slice().sort())==='["F-2027-112","F-2027-123"]'&&v.payeLe==='2027-11-08',j(v));
  rec(G,'Trésorerie saisie plus récente que le relevé : pas d’écrasement (et dit pourquoi)',v.plusRecente&&v.treso===false&&v.tm===4321&&v.td==='2027-11-10',j(v));
  const t2=await p.evaluate((csv)=>{ nxobjTreso(4321,'2027-10-01'); nxbqOuvrirTexte(csv); const c=document.getElementById('nxbqTreso'); const coche=!!(c&&c.checked); nxbqFermer(); return coche; },csv);
  rec(G,'Trésorerie déjà saisie (plus ancienne) : mise à jour proposée mais pas cochée d’office (réserve sur un autre compte ?)',t2===false,'');
  rec(G,'Aucune erreur JavaScript (cas de la relecture)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P7 — déclaration annuelle des fluides ================= */
{ const {p,ctx,errs}=await preparer({},'2028-01-10');
  const r=await p.evaluate(()=>{
    const F=(o)=>Object.assign({id:'f'+Math.random().toString(36).slice(2,8),num:'FF',client:'Client',equipId:'',desc:'Split',charge:1,ctrl:'na',qv:0,qrec:0,qreg:0,qrt:0,qru:0,bout:'',obs:''},o);
    FLU.push(F({date:'2027-08-01',nature:'mes',fluide:'R32',qv:0.5}));
    FLU.push(F({date:'2027-09-01',nature:'entretien',fluide:'R32',qv:0.2,qrec:0.1,qru:0.4}));
    FLU.push(F({date:'2027-10-01',nature:'depannage',fluide:'r 32',qv:0.25}));                 /* même fluide, écrit autrement */
    FLU.push(F({date:'2027-10-05',nature:'demantelement',fluide:'R410A',qrt:1.2}));
    FLU.push(F({date:'2027-11-05',nature:'depannage',fluide:'R410A',qv:0.8}));
    FLU.push(F({date:'2027-12-01',nature:'assemblage',fluide:'R410A',qreg:0.3}));
    FLU.push(F({date:'2026-12-20',nature:'mes',fluide:'R32',qv:5}));                           /* autre année */
    save('cp2_fluides',FLU);
    /* stock fin 2026 → repris au 1er janvier 2027 */
    nxfbSet('2026','R32','sN1','1,5'); nxfbSet('2026','R32','sD1','0.2');
    nxfbSet('2027','R32','acq','10'); nxfbSet('2027','R32','remis','0.4'); nxfbSet('2027','R32','cede','0'); nxfbSet('2027','R32','sN1','10.5'); nxfbSet('2027','R32','sD1','0.1');
    nxfbAjouterFluide('2027','R290'); nxfbSet('2027','R290','sN1','2');
    const neg=nxfbSet('2027','R32','detr','-1'), gros=nxfbSet('2027','R32','detr','200000');
    const B=nxfbBilan('2027'), b=B.find(x=>x.fluide==='R32'), c=B.find(x=>x.fluide==='R410A'), z=B.find(x=>x.fluide==='R290');
    const theo=1.5+0.2+10+0.4-(0.5+0.3+0.25)-0.4;
    return {fl:B.map(x=>x.fluide),b:{chN:b.chN,chM:b.chM,recHU:b.recHU,recM:b.recM,sN0:b.sN0,sD0:b.sD0,repris:b.reprisN0&&b.reprisD0,theo:b.theo,fin:b.fin,ecart:b.ecart,detr:b.detr,fiches:b.fiches},attTheo:Math.round(theo*1000)/1000,
      c:{chN:c.chN,chM:c.chM,recHU:c.recHU,recM:c.recM,manque:c.manque},z:{sN1:z.sN1,manque:z.manque},neg,gros,
      v2026:nxfbBilan('2026').find(x=>x.fluide==='R32').chN};
  });
  rec(G,'Fluides de l’année : ceux des fiches + saisis, noms harmonisés (« r 32 » = R32)',j(r.fl)===j(['R290','R32','R410A'])&&r.b.fiches===3,j(r));
  rec(G,'2. Chargées : « mise en service » et « assemblage » = équipements neufs, le reste = maintenance',proche(r.b.chN,0.5,0.0005)&&proche(r.b.chM,0.55,0.0005)&&proche(r.c.chN,0.3,0.0005)&&proche(r.c.chM,0.8,0.0005),j([r.b,r.c]));
  rec(G,'3. Récupérées : « démantèlement » = hors d’usage, le reste = maintenance',proche(r.c.recHU,1.2,0.0005)&&proche(r.b.recM,0.4,0.0005)&&r.b.recHU===0,j([r.b,r.c]));
  rec(G,'Seules les fiches de l’année comptent (fiche 2026 à part)',proche(r.v2026,5,0.0005),r.v2026);
  rec(G,'7. Stock au 1er janvier repris du 31 décembre de l’année d’avant',proche(r.b.sN0,1.5,0.0005)&&proche(r.b.sD0,0.2,0.0005)&&r.b.repris===true,j(r.b));
  rec(G,'Contrôle : stock attendu au 31/12 = début + acquises + récupérées − chargées − remises − traitées − cédées',proche(r.b.theo,r.attTheo,0.0005)&&proche(r.b.ecart,10.6-r.attTheo,0.0005),j({theo:r.b.theo,att:r.attTheo,ecart:r.b.ecart}));
  rec(G,'Cases à remplir signalées (acquises, remises, cédées, stocks)',r.c.manque.join(',')==='acq,remis,cede,sN1,sD1'&&r.z.manque.join(',')==='acq,remis,cede,sD1',j([r.c.manque,r.z.manque]));
  rec(G,'Quantités négatives ou absurdes refusées',r.neg===false&&r.gros===false&&r.b.detr==null,j(r));

  const x=await p.evaluate(async()=>{
    const s=nxfbCSV('2027'); const fichiers=[]; for(const b of __blobs) fichiers.push(await b.text()); __blobs.length=0;
    const zero=nxfbTexte('2025');
    go('fluides'); const c=document.getElementById('nxfb'), t=c?c.innerText:'';
    return {entete:s.split('\r\n')[0],r32:s.split('\r\n').find(l=>/"R32"/.test(l))||'',nom:__noms[__noms.length-1],fich:fichiers.length,zero,
      carte:!!c,dans:!!(c&&c.closest('#v-fluides')),ech:/au plus tard le 31\/01\/2028/.test(t),fl:c?[...c.querySelectorAll('.nxfb-f')].map(e=>e.dataset.fluide).join(','):'',ecartAff:/Écart de/.test(t)}; });
  rec(G,'Export CSV : les 7 rubriques de l’arrêté dans l’ordre, kg à 3 décimales avec virgule',/"1\. Acquises";"2a\. Chargées — équipements neufs";"2b\. Chargées — maintenance";"3a\. Récupérées — équipements hors d’usage";"3b\. Récupérées — maintenance";"4\. Remises à un distributeur";"5a\./.test(x.entete)&&/"6\. Cédées/.test(x.entete)&&/"7\. Stock au 31 décembre — déchets"$/.test(x.entete)&&/"R32";"10,000";"0,500";"0,550"/.test(x.r32),j({e:x.entete,l:x.r32}));
  rec(G,'Fichier nommé ClimPilot_declaration_fluides_2027.csv',x.nom==='ClimPilot_declaration_fluides_2027.csv'&&x.fich===1,x.nom);
  rec(G,'Année sans rien : « déclaration à zéro » rappelée',/déclaration à zéro/.test(x.zero),x.zero.slice(0,200));
  rec(G,'Écran Fluides : carte de la déclaration, échéance du 31/01/2028 en janvier, une fiche par fluide, écart signalé',x.carte&&x.dans&&x.ech&&x.fl==='R290,R32,R410A'&&x.ecartAff,j(x));

  /* rappel dans « À faire maintenant » */
  const a=await p.evaluate(()=>{ const f=()=>nxobjAFaire().filter(x=>/fluides/.test(x.txt)).map(x=>x.urg+'|'+x.vue);
    const jan=f(); nxfbDeclarer('2027',true); const fait=f(), d=nxfbDeclaree('2027'); nxfbDeclarer('2027',false);
    window.todayISO=()=>'2028-02-05'; const retard=f();
    window.todayISO=()=>'2027-12-05'; const dec=f();
    window.todayISO=()=>'2027-11-12'; const avant=nxobjAFaire().filter(x=>/fluides 2026/.test(x.txt)).length;
    return {jan,fait,d,retard,dec,avant}; });
  rec(G,'Rappel en janvier (avant le 31), disparaît une fois la déclaration cochée (datée)',j(a.jan)===j(['1|fluides'])&&a.fait.length===0&&a.d==='2028-01-10',j(a));
  rec(G,'Après le 31/01 sans déclaration : rappel urgent',j(a.retard)===j(['2|fluides']),j(a.retard));
  rec(G,'En décembre : rappel de préparation (pas urgent) ; rien pour une année sans activité',j(a.dec)===j(['0|fluides'])&&a.avant===0,j(a));
  const y=await p.evaluate(()=>{ window.todayISO=()=>'2028-01-10'; const t=nxfbTexte('2027');
    const m=cpMerge({cpnext_flubilan:[]},{cpnext_flubilan:[{id:'2027:R32:acq',v:1}]},{cpnext_flubilan:[{id:'2027:R32:sN1',v:2}]}).cpnext_flubilan.map(x=>x.id).sort().join(',');
    const raw=JSON.parse(localStorage.getItem('cpnext_flubilan')||'[]'); raw.push({id:"2027:X');alert(1);//:acq",v:1}); localStorage.setItem('cpnext_flubilan',JSON.stringify(raw));
    const fl=nxfbBilan('2027').map(b=>b.fluide).join(',');
    go('fluides'); const h=document.getElementById('nxfb').innerHTML, ans=[...document.querySelectorAll('#nxfb select[aria-label="Année"] option')].map(o=>o.value);
    window.todayISO=()=>'2029-01-10'; const sans=nxobjAFaire().filter(x=>/fluides 2028/.test(x.txt)).length; P.entreprise.attFluides='CAP-FICTIF'; const avec=nxobjAFaire().filter(x=>/fluides 2028/.test(x.txt)).length; P.entreprise.attFluides=''; window.todayISO=()=>'2028-01-10';
    return {nr:/R410A[\s\S]*1\. Acquises : NON RENSEIGNÉ/.test(t)&&/ATTENTION/.test(t),m,fl,alerte:/alert\(1\)/.test(h),ans,sans,avec}; });
  rec(G,'Texte à copier : une case vide reste « NON RENSEIGNÉ » (jamais 0 kg), avec un avertissement',y.nr,'');
  rec(G,'Synchro : deux cases du même fluide remplies sur deux appareils sont gardées toutes les deux',y.m==='2027:R32:acq,2027:R32:sN1',y.m);
  rec(G,'Identifiant piégé dans les données synchronisées : ignoré (rien d’injecté)',y.fl==='R290,R32,R410A'&&!y.alerte,j(y));
  rec(G,'Années proposées à partir de 2027 (+ celles des fiches)',y.ans[0]==='2028'&&y.ans.indexOf('2027')>=0&&y.ans.every(a=>+a>=2026),j(y.ans));
  rec(G,'Rappel seulement si tu es opérateur (attestation de capacité ou fiches) : rien en sous-traitance pure',y.sans===0&&y.avec===1,j(y));
  /* saisie au doigt dans une case (vrai champ, puis on touche ailleurs) : pas d'affichage imbriqué (parcours du 12/10) */
  await p.evaluate(()=>{ window.todayISO=()=>'2028-01-10'; go('fluides'); });
  const ch=p.locator('#nxfb .nxfb-f[data-fluide="R410A"] input').first(); await ch.scrollIntoViewIfNeeded(); await ch.fill('3'); await ch.dispatchEvent('change'); await p.waitForTimeout(150);
  await p.locator('#nxfb h2').click(); await p.waitForTimeout(150);
  const saisie=await p.evaluate(()=>({acq:nxfbBilan('2027').find(b=>b.fluide==='R410A').acq,carte:!!document.querySelector('#nxfb .nxfb-f[data-fluide="R410A"]')}));
  rec(G,'Saisie dans une case du bilan (comme au doigt) : enregistrée, carte réaffichée, sans erreur',saisie.acq===3&&saisie.carte&&errs.length===0,j(saisie)+' '+errs.join(' | '));
  rec(G,'Aucune erreur JavaScript (fluides)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P8 — liste « Lancer l'entreprise » : bloquants et conseils ================= */
{ const {p,ctx,errs}=await preparer({},'2027-03-01');
  const r=await p.evaluate(()=>{
    const cl=()=>nxobjFeux().lancement;
    const L0=cl(), cons=L0.conditions.filter(c=>c.conseil).map(c=>c.key), bloq=L0.conditions.filter(c=>!c.conseil).map(c=>c.key||c.label.slice(0,20));
    ['urssaf','assurances','decennaleActivites','aptitude','wolf','comptable','banque','deuxfa'].forEach(k=>nxobjCheck(k,true));
    const o=nxobjEtat(); o.eiFermeture='2024-05-01'; save('cpnext_objectifs',o);
    nxobjSet('tresoMontant','60000'); nxFiscalSet('debut','2027-07-01');
    P.entreprise.mediateur='Médiateur fictif';
    const L1=cl(); go('nx_obj'); const carte=document.querySelector('#nxobj .nxo-feu[data-feu="lancement"]'), txt=carte?carte.textContent:'';
    const dash=(()=>{ go('dash'); const e=document.getElementById('nxobjDash'); return e?e.innerText:''; })();
    /* une fois lancée (août 2027), l'attestation de capacité devient un point bloquant */
    window.todayISO=()=>'2027-08-01'; nxobjSet('tresoMontant','60000');
    const L2=cl(), cap2=L2.conditions.find(c=>c.key==='capacite'); P.entreprise.attFluides='CAP-FICTIF-001'; const L3=cl(); P.entreprise.attFluides='';
    return {cons,bloq,c1:L1.couleur,v1:L1.verdict,conseilsNonCoches:L1.conditions.filter(c=>c.conseil&&c.ok!==true).length,sep:/Conseillé — ne bloque pas le feu \(0 \/ 6\)/.test(txt),dash,nb:L1.conditions.filter(c=>!c.conseil).length,
      c2:L2.couleur,cap2:cap2?{ok:cap2.ok,conseil:!!cap2.conseil}:null,c3:L3.couleur}; });
  rec(G,'6 conseils qui ne bloquent pas : attestation de capacité (avant le SIRET), nom INPI, fiche Google, prévoyance, transport des bouteilles, facture électronique',j(r.cons)===j(['capacite','nomInpi','ficheGoogle','prevoyance','transportFluides','pdp']),j(r.cons));
  rec(G,'Nouveaux points bloquants : activités sur la décennale, double authentification',r.bloq.indexOf('decennaleActivites')>=0&&r.bloq.indexOf('deuxfa')>=0&&r.bloq.indexOf('capacite')<0,j(r.bloq));
  rec(G,'Avant la création : feu vert sans l’attestation de capacité (elle se demande avec le SIRET), conseils non cochés',r.c1==='vert'&&r.conseilsNonCoches===6&&/Tout est prêt/.test(r.v1),j(r));
  rec(G,'Une fois lancée : attestation de capacité de l’entreprise bloquante (orange sans, vert avec)',r.cap2&&r.cap2.conseil===false&&r.cap2.ok===null&&r.c2==='orange'&&r.c3==='vert',j(r));
  rec(G,'Carte : conseils séparés avec leur compteur',r.sep,'');
  rec(G,'Tableau de bord : « points prêts » comptés sans les conseils',new RegExp(r.nb+' / '+r.nb+' points prêts').test(r.dash),r.dash);
  rec(G,'Aucune erreur JavaScript (lancement)',errs.length===0,errs.join(' | '));

  /* un module qui plante n'empêche pas l'écran de s'afficher ; boutons de modules filtrés */
  const k=await p.evaluate(()=>{ const ce=console.error; console.error=()=>{};
    window.nxobjAjouts.push({id:'casse',pos:'apres3',carte:()=>{ throw new Error('boum'); },afaire:()=>{ throw new Error('boum'); }});
    window.nxobjAjouts.push({id:'piege',afaire:()=>[{urg:1,txt:'piège go',act:'go',vue:'x\');alert(1);//'},{urg:1,txt:'piège appel',act:'appel',fn:'alert',arg:'1'},{urg:1,txt:'piège arg',act:'appel',fn:'nxobjVoir',arg:"a');alert('1"}]});
    go('nx_obj'); const h=document.getElementById('nxobj').innerHTML, t=document.getElementById('nxobj').innerText;
    window.nxobjAjouts=window.nxobjAjouts.filter(a=>a.id!=='casse'&&a.id!=='piege'); console.error=ce;
    return {ok:/Mes feux/.test(t)&&/Ma rentabilité réelle/.test(t),piege:/alert/.test(h),lignes:/piège go/.test(t)}; });
  rec(G,'Un module en erreur n’empêche pas l’écran de s’afficher',k.ok,j(k));
  rec(G,'Boutons des modules filtrés (écran, nom de fonction, argument) : rien d’injecté',k.lignes&&!k.piege,j(k));
  await ctx.close();
}

/* ================= P9 — téléphone ================= */
{ const {p,ctx,errs}=await page({}); await seed(p); await p.evaluate(PREP());
  await p.evaluate(()=>{ const a=DEVIS.find(d=>/BAL/.test(d.num)); a.hReel='10'; a.achatReel='150'; a.facSolde={num:'F-2027-101',date:'2027-10-02',montant:604}; save(LS.devis,DEVIS);
    nxrtAjouter({date:'2027-10-20',devis:a.num,heures:'2',km:'30',pieces:'12',motif:'pose',note:'une note assez longue pour voir si elle passe à la ligne correctement'}); });
  const r=await p.evaluate(()=>{ go('nx_obj'); const c=document.getElementById('nxrt'); if(c) c.scrollIntoView();
    const sc=[...document.querySelectorAll('#nxrt .nxo-scroll')].map(e=>e.scrollWidth-e.clientWidth);
    return {w:document.documentElement.scrollWidth,iw:innerWidth,carte:!!c,sc}; });
  await p.screenshot({path:out('suiteP-rentabilite-telephone.png')});
  rec(G,'Téléphone : écran Objectifs sans débordement horizontal avec la carte rentabilité',r.carte&&r.w<=r.iw+1,j(r));
  const m=await p.evaluate(()=>{ const a=DEVIS.find(d=>/DPS/.test(d.num)); a.facAcompte={num:'F-2027-202',date:'2027-10-25',montant:450}; save(LS.devis,DEVIS);
    nxbqOuvrirTexte('Date;Libellé;Crédit;Débit;Solde\n06/11/2027;VIR L ATELIER DU FROID POUR LA FACTURE ACOMPTE CHANTIER;450,00;;1 000,00\n07/11/2027;VIR TRES LONG LIBELLE SANS ESPACE AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA;99,00;;1 099,00\n');
    const pnl=document.querySelector('#nxbqM .nxbq-p'), ok=document.getElementById('nxbqOk'), b=ok?ok.getBoundingClientRect():null;
    return {d:pnl?pnl.scrollWidth-pnl.clientWidth:-1,bouton:!!b&&b.right<=innerWidth}; });
  await p.screenshot({path:out('suiteP-releve-telephone.png')});
  rec(G,'Téléphone : fenêtre du relevé bancaire sans débordement, bouton de validation visible',m.d>=0&&m.d<=1&&m.bouton,j(m));
  const f=await p.evaluate(()=>{ nxbqFermer(); window.todayISO=()=>'2028-01-10'; FLU.push({id:'fx',num:'FF-1',date:'2027-08-01',nature:'mes',fluide:'R32',client:'C',desc:'S',charge:1,ctrl:'na',qv:0.5,qrec:0,qreg:0,qrt:0,qru:0}); save('cp2_fluides',FLU);
    go('fluides'); const c=document.getElementById('nxfb'); if(c) c.scrollIntoView(); return {carte:!!c,w:document.documentElement.scrollWidth,iw:innerWidth}; });
  await p.screenshot({path:out('suiteP-fluides-telephone.png')});
  rec(G,'Téléphone : carte de la déclaration des fluides sans débordement',f.carte&&f.w<=f.iw+1,j(f));
  rec(G,'Aucune erreur JavaScript (téléphone)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

/* ================= P10 — gros volume ================= */
{ const {p,ctx,errs}=await preparer();
  const r=await p.evaluate(()=>{
    const base=DEVIS.find(d=>/BAL/.test(d.num));
    for(let i=0;i<600;i++){ const d=JSON.parse(JSON.stringify(base)); d.id='perf'+i; d.num='DV-PERF-'+i; d.statut='accepte'; d.hReel=String(6+i%5); d.achatReel=String(100+i);
      d.facSolde={num:'F-2027-'+String(1000+i),date:'2027-'+String(1+i%10).padStart(2,'0')+'-15',montant:604,payeLe:'2027-'+String(1+i%10).padStart(2,'0')+'-20',mode:'Virement'}; DEVIS.push(d); }
    save(LS.devis,DEVIS);
    const a=[]; for(let i=0;i<200;i++) a.push({id:'sav_p'+i,date:'2027-'+String(1+i%10).padStart(2,'0')+'-10',devis:'DV-PERF-'+i,heures:1,km:10,pieces:5,motif:'pose'}); save('cpnext_sav',a);
    const t0=performance.now(); go('nx_obj'); const ms=performance.now()-t0; const S=nxrtSynthese('2027-11-12');
    return {ms:Math.round(ms),n:S.n}; });
  rec(G,'600 chantiers + 200 retours SAV : écran Objectifs & feux affiché en moins de 1,5 s',r.ms<1500&&r.n===600,j(r));
  rec(G,'Aucune erreur JavaScript (gros volume)',errs.length===0,errs.join(' | '));
  await ctx.close();
}

await closeBrowser();
ecrireResultats('resP.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
