import { ecrireResultats } from './env.mjs';
// Suite AD — mission AF1 « zéro perte de données » (docs/MISSION-AF-CORRECTIONS.md § 2, 03/11/2026).
//  D0  : un devis signé, accepté ou facturé ne se modifie plus (AF1-T1 à T4), ne se supprime plus (T5) ; « Faire un avenant » (T3).
//  D2  : une fiche fluide numérotée ne va pas à la corbeille avant 5 ans (T6, T8) ; elle se marque « annulée » avec un motif (T7).
//  D3  : Paramètres : quitter l'écran avec des modifications demande « Enregistrer / Abandonner » (T9).
//  D5  : la fiche fluide garde les coordonnées du détenteur ; envoi du lien de signature refusé sans adresse (T10, T11).
//  D6  : rouvrir et enregistrer une fiche fluide ne perd ni la signature du détenteur ni les autres champs (T12, T13).
//  C-N1 : « Lieu / urgence » du contrat d'intervention gardé au clic suivant (trouvé le 27/10).
//  A-N5 : enregistrer un devis ou une intervention ne recopie pas l'adresse du document sur une fiche client existante (27/10).
//  AF1-bis (relecture indépendante du 03/11) : T14 avenant / original (jamais deux devis facturables, original « remplacé par l'avenant »), T15 « Annuler le devis »
//  (motif obligatoire, hors d'« À commander », « Planifier », carnet et CA signé, PDF ANNULÉ), T16 verrou de la signature sur l'ancien formulaire, T17 apostrophe ’ du détenteur,
//  T9 : texte de la question des Paramètres (« OK = enregistrer · Annuler = PERDRE les modifications »).
// Horloge figée sur REF (tests/lib.mjs) : aucun test ne lit la vraie date. Serveur et cloud coupés (lib.mjs). Aucun montant n'est recalculé ici.
import { page, rec, RES, closeBrowser, seed, REF } from './lib.mjs';
const j = (o) => JSON.stringify(o);
const G = { D0: 'AF1 D0 devis verrouillé', D2: 'AF1 D2 fiche fluide : suppression', D3: 'AF1 D3 paramètres', D5: 'AF1 D5 détenteur', D6: 'AF1 D6 fiche rouverte', CN1: 'AF1 C-N1 lieu / urgence', AN5: 'AF1 A-N5 fiche client' };

/* boîtes de dialogue simulées dans la page (confirm / prompt / alert), messages affichés (toast) et aides */
const PREP = `(function(){
  window.__dlg=[]; window.__oui=true; window.__rep=null; window.__msgs=[];
  window.alert=m=>{ __dlg.push('A:'+m); };
  window.confirm=m=>{ __dlg.push('C:'+m); return !!__oui; };
  window.prompt=(m,d)=>{ __dlg.push('P:'+m); return __rep; };
  const _t=window.toast; window.toast=function(m){ __msgs.push(String(m)); try{ return _t.apply(this,arguments); }catch(e){} };
  if(window.nxToast){ const _n=window.nxToast; window.nxToast=function(m,t){ __msgs.push(String(m)); try{ return _n.apply(this,arguments); }catch(e){} }; }
  window.AD={
    reset(){ __dlg.length=0; __msgs.length=0; __oui=true; __rep=null; },
    clone(o){ return o===undefined?null:JSON.parse(JSON.stringify(o)); },
    /* copie enregistrée d'un devis, sans les champs techniques de l'éditeur */
    stored(id){ const d=DEVIS.find(x=>x.id===id); if(!d) return null; const c=JSON.parse(JSON.stringify(d)); delete c.updatedAt; delete c._baseStatut; delete c._statutSet; return c; },
    /* devis v2 complet (clim murale) pour un client du jeu de données */
    v2(extra){ const d=NXD2.newDevis('split',{}); const c=CLIENTS[0];
      Object.assign(d,{cNom:c.nom,cTel:c.tel,cMail:c.mail||'',cType:c.type,cAdr:c.adr,cVille:c.ville}); d.lots[0].titre='Séjour';
      Object.assign(d,extra||{}); d.num=NXD2.numFor(d); NXD2.derive(d); DEVIS.push(d); save(LS.devis,DEVIS); return d; },
    /* devis de l'ANCIEN formulaire (index.html) : créé hors écran, enregistré */
    legacy(extra){ const c=CLIENTS[0]; go('wizard'); newDevis(); const d=cur; cur=null;
      Object.assign(d,{cNom:c.nom,cTel:c.tel,cMail:c.mail||'',cType:c.type,cAdr:c.adr,cVille:c.ville,heures:5,notes:'devis ancien format'},extra||{}); DEVIS.push(d); save(LS.devis,DEVIS); go('dash'); return d; },
    trash(){ return JSON.parse(localStorage.getItem('cpnext_trash')||'[]'); },
    stockFlu(){ return JSON.parse(localStorage.getItem('cp2_fluides')||'[]'); },
    isoAn(delta){ const d=new Date(__REF.horloge); d.setFullYear(d.getFullYear()+delta); return d.toISOString().slice(0,10); },
    modalFlu(){ const m=document.getElementById('mFlu'); return {on:m.classList.contains('on'),
      libres:[...m.querySelectorAll('.bd input:not([type=hidden]),.bd select,.bd textarea')].filter(e=>!e.disabled&&!e.readOnly).map(e=>e.id).slice(0,8),
      boutons:[...m.querySelectorAll('.navbtns button')].filter(b=>b.offsetParent!==null||b.style.display!=='none').map(b=>b.textContent.trim())}; }
  };
})();`;

const { p, ctx, errs } = await page({ mobile: false, horloge: REF.horloge });
await seed(p); await p.evaluate(PREP);

/* ---------------- D0 — AF1-T1 : devis v2 signé → ouvrir, changer, enregistrer : contenu inchangé ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset();
    const d = AD.v2({ statut: 'accepte', signature: { at: __REF.horloge, nom: 'Client Signataire', hash: 'abc123' }, acceptedAt: Date.parse(__REF.horloge) });
    const creation = AD.stored(d.id), totAvant = compute(d).totalTTC;
    openDevis(d.id); await new Promise(r => setTimeout(r, 200));
    /* l'ouverture ne change rien au devis enregistré, sauf figEnv (montant envoyé gardé par next-fiabilite au changement d'écran : existant) */
    const avant = AD.stored(d.id), diffOuverture = Object.keys(Object.assign({}, creation, avant)).filter(k => JSON.stringify(creation[k]) !== JSON.stringify(avant[k]));
    const vue = window._curView, c = NXD2.api.cur();
    const ban = (document.getElementById('nxd2Banner') || {}).textContent || '';
    const libres = document.querySelectorAll('#nxd2Body [data-k]:not(:disabled)').length;
    const boutons = [...document.querySelectorAll('#v-nx_devis2 button')].map(b => b.textContent.trim());
    /* modification par le code (ce qu'une couche, un raccourci ou l'assistant pourrait faire), puis enregistrement */
    c.common.prepH = (Number(c.common.prepH) || 0) + 5; c.notes = 'MODIFIÉ APRÈS SIGNATURE';
    const ok = nxd2.save(); await new Promise(r => setTimeout(r, 100));
    const apres = AD.stored(d.id);
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]');
    return { vue, ban, libres, boutons, ok, diffOuverture, identique: JSON.stringify(avant) === JSON.stringify(apres), tot: compute(DEVIS.find(x => x.id === d.id)).totalTTC === totAvant,
      notes: apres.notes, msgs: __msgs.slice(), journal: journal.filter(x => x.id === d.id).length };
  });
  /* champs ajoutés par des couches existantes à l'ouverture (valeurs par défaut, aucun montant) : figEnv (next-fiabilite) et les défauts électriques (next-addons, nxEnsureQuote) */
  const AJOUTS_CONNUS = ['figEnv', 'elecMode', 'breakerManual', 'breakerQte', 'differential', 'diffQte', 'proximity'];
  rec(G.D0, 'T1 devis signé : l\'ouverture ne change rien au devis enregistré (hors champs par défaut ajoutés par des couches existantes)', r.diffOuverture.every(k => AJOUTS_CONNUS.includes(k)), j(r.diffOuverture));
  rec(G.D0, 'T1 devis signé : enregistrer après modification → contenu enregistré identique au centime', r.identique && r.tot && r.notes !== 'MODIFIÉ APRÈS SIGNATURE', j({ identique: r.identique, tot: r.tot, notes: r.notes }));
  rec(G.D0, 'T1 devis signé : message « ne se modifie plus » affiché, enregistrement refusé', r.ok === false && r.msgs.some(m => /ne se modifie plus/i.test(m)), j(r.msgs));
  rec(G.D0, 'T1 devis signé : bandeau « Devis signé le … » avec « Faire un avenant » et « Dupliquer »', /signé le/i.test(r.ban) && r.boutons.some(b => /avenant/i.test(b)) && r.boutons.some(b => /dupliquer/i.test(b)), j({ ban: r.ban.slice(0, 160), boutons: r.boutons.filter(b => /avenant|dupliquer/i.test(b)) }));
  rec(G.D0, 'T1 devis signé : champs en lecture seule', r.vue === 'nx_devis2' && r.libres === 0, j({ vue: r.vue, libres: r.libres }));
  rec(G.D0, 'T1 devis signé : la tentative est notée au journal', r.journal >= 1, j({ journal: r.journal }));
}

/* ---------------- D0 — AF1-T2 : devis avec acompte facturé (pas de signature) ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset();
    const d = AD.v2({ statut: 'envoye', facAcompte: { num: 'TEST-F-' + __REF.an + '-0901', date: __REF.jour, ttc: 100 } });
    openDevis(d.id); await new Promise(r => setTimeout(r, 200));
    const avant = AD.stored(d.id);
    const c = NXD2.api.cur(); c.lots[0].titre = 'Titre changé après facture'; c.common.prepH = (Number(c.common.prepH) || 0) + 3;
    const ok = nxd2.save(); await new Promise(r => setTimeout(r, 100));
    const apres = AD.stored(d.id), libres = document.querySelectorAll('#nxd2Body [data-k]:not(:disabled)').length;
    return { ok, identique: JSON.stringify(avant) === JSON.stringify(apres), titre: apres.lots[0].titre, libres, msgs: __msgs.slice() };
  });
  rec(G.D0, 'T2 devis avec acompte facturé : enregistrer après modification → contenu identique, refus dit', r.identique && r.ok === false && r.msgs.some(m => /ne se modifie plus/i.test(m)), j(r));
  rec(G.D0, 'T2 devis facturé : champs en lecture seule', r.libres === 0, j({ libres: r.libres }));
}

/* ---------------- D0 — AF1-T3 : « Faire un avenant » ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset();
    const d = AD.v2({ statut: 'accepte', signature: { at: __REF.horloge, nom: 'Client Signataire', hash: 'def456' } });
    go('tous'); await new Promise(r => setTimeout(r, 150));   /* figEnv posé (existant) avant la copie de référence */
    const avant = AD.stored(d.id), n0 = DEVIS.length, tot = compute(d).totalTTC;
    if (typeof window.cpDevisAvenant !== 'function') return { absent: true };
    cpDevisAvenant(d.id); await new Promise(r => setTimeout(r, 250));
    const n = DEVIS.filter(x => x.avenantDe && x.avenantDe.id === d.id)[0];
    const c = NXD2.api.cur();
    return { n0, n1: DEVIS.length, orig: JSON.stringify(avant) === JSON.stringify(AD.stored(d.id)), nouveau: n ? { statut: n.statut, num: n.num, sig: !!n.signature, fac: !!(n.facAcompte || n.facSolde), lien: n.avenantDe, tot: compute(n).totalTTC === tot, memeNum: n.num === d.num } : null,
      ouvert: window._curView === 'nx_devis2' && !!c && !!n && c.id === n.id, ban: (document.getElementById('nxd2Banner') || {}).textContent || '' };
  });
  rec(G.D0, 'T3 avenant : nouveau devis brouillon lié à l\'original (avenantDe), numéro différent, même montant, sans signature ni facture', !r.absent && r.n1 === r.n0 + 1 && r.nouveau && r.nouveau.statut === 'brouillon' && !r.nouveau.sig && !r.nouveau.fac && r.nouveau.lien && r.nouveau.lien.id && r.nouveau.tot && !r.nouveau.memeNum, j(r));
  rec(G.D0, 'T3 avenant : l\'original est identique à l\'octet près', !r.absent && r.orig, j({ orig: r.orig }));
  rec(G.D0, 'T3 avenant : l\'avenant s\'ouvre dans l\'éditeur, modifiable, et dit de quel devis il vient', !r.absent && r.ouvert && /avenant/i.test(r.ban), j({ ouvert: r.ouvert, ban: (r.ban || '').slice(0, 160) }));
}

/* ---------------- D0 — AF1-T4 : devis ACCEPTÉ sans signature (accord papier), ancien formulaire ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset();
    const d = AD.legacy({ statut: 'accepte', acceptedAt: Date.parse(__REF.horloge) });
    const avant = AD.stored(d.id), totAvant = compute(d).totalTTC;
    openDevis(d.id); await new Promise(r => setTimeout(r, 200));
    const vue = window._curView, ban = (document.getElementById('cpVerrouWiz') || {}).textContent || '';
    const libres = [...document.querySelectorAll('#v-wizard .step input,#v-wizard .step select,#v-wizard .step textarea')].filter(e => !e.disabled && e.closest('.step') && !e.closest('#fBloc,#nxd2FHost')).length;
    /* modification par le code (couche, assistant…) puis enregistrement */
    const h = document.getElementById('f_heures'); h.disabled = false; h.value = String((Number(h.value) || 0) + 7);
    document.getElementById('f_notes').disabled = false; document.getElementById('f_notes').value = 'MODIFIÉ APRÈS ACCORD';
    saveDevis(); await new Promise(r => setTimeout(r, 100));
    const apres = AD.stored(d.id);
    return { vue, ban, libres, identique: JSON.stringify(avant) === JSON.stringify(apres), tot: compute(DEVIS.find(x => x.id === d.id)).totalTTC === totAvant, notes: apres.notes, msgs: __msgs.slice() };
  });
  rec(G.D0, 'T4 devis accepté sans signature (ancien formulaire) : enregistrer après modification → contenu identique', !r.absent && r.identique && r.tot && r.notes !== 'MODIFIÉ APRÈS ACCORD' && r.msgs.some(m => /ne se modifie plus/i.test(m)), j(r));
  rec(G.D0, 'T4 devis accepté : bandeau avec « Faire un avenant » et « Dupliquer », champs en lecture seule', !r.absent && r.vue === 'wizard' && /accepté le|signé le/i.test(r.ban) && /avenant/i.test(r.ban) && /dupliquer/i.test(r.ban) && r.libres === 0, j({ vue: r.vue, ban: (r.ban || '').slice(0, 160), libres: r.libres }));
  /* avenant depuis l'ancien formulaire */
  const r2 = await p.evaluate(async () => {
    AD.reset(); const d = DEVIS.find(x => !x.v && x.statut === 'accepte' && !x.signature); if (!d || typeof window.cpDevisAvenant !== 'function') return { absent: true };
    const avant = AD.stored(d.id), n0 = DEVIS.length; cpDevisAvenant(d.id); await new Promise(r => setTimeout(r, 250));
    const n = DEVIS.filter(x => x.avenantDe && x.avenantDe.id === d.id)[0];
    return { n1: DEVIS.length === n0 + 1, orig: JSON.stringify(avant) === JSON.stringify(AD.stored(d.id)), n: n ? { statut: n.statut, num: n.num !== d.num, tot: compute(n).totalTTC === compute(d).totalTTC } : null, ouvert: window._curView === 'wizard' && cur && n && cur.id === n.id };
  });
  rec(G.D0, 'T4 avenant depuis l\'ancien formulaire : nouveau brouillon lié, original intact, ouvert dans le formulaire', !r2.absent && r2.n1 && r2.orig && r2.n && r2.n.statut === 'brouillon' && r2.n.num && r2.n.tot && r2.ouvert, j(r2));
  /* témoin : un devis brouillon se modifie et s'enregistre toujours */
  const r3 = await p.evaluate(async () => {
    AD.reset(); const d = AD.v2({ statut: 'brouillon' }); openDevis(d.id); await new Promise(r => setTimeout(r, 200));
    const c = NXD2.api.cur(); c.notes = 'brouillon modifié'; const ok = nxd2.save(); await new Promise(r => setTimeout(r, 100));
    return { ok, notes: DEVIS.find(x => x.id === d.id).notes, libres: document.querySelectorAll('#nxd2Body [data-k]:not(:disabled)').length > 0 };
  });
  rec(G.D0, 'Témoin : un devis brouillon reste modifiable et s\'enregistre', r3.ok === true && r3.notes === 'brouillon modifié' && r3.libres, j(r3));
}

/* ---------------- D0 — AF1-T5 : suppression d'un devis signé ou accepté refusée ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset(); __oui = true;
    const s = AD.v2({ statut: 'accepte', signature: { at: __REF.horloge, nom: 'Client Signataire', hash: 'ghi789' } });
    const a = AD.v2({ statut: 'accepte' });
    const b = AD.v2({ statut: 'brouillon' });
    go('tous'); await new Promise(r => setTimeout(r, 150));
    delDevis(s.id); delDevis(a.id); delDevis(b.id); await new Promise(r => setTimeout(r, 150));
    const t = AD.trash().map(x => x.item && x.item.id);
    return { sigReste: DEVIS.some(x => x.id === s.id), accReste: DEVIS.some(x => x.id === a.id), brouillonParti: !DEVIS.some(x => x.id === b.id), corbeille: { sig: t.includes(s.id), acc: t.includes(a.id), brouillon: t.includes(b.id) }, msgs: __msgs.slice() };
  });
  rec(G.D0, 'T5 devis signé (non facturé) : suppression refusée, il reste dans la liste et n\'entre pas dans la corbeille', r.sigReste && !r.corbeille.sig && r.msgs.some(m => /signé|accepté/i.test(m) && /supprim/i.test(m)), j(r));
  rec(G.D0, 'T5 devis accepté sans signature : suppression refusée aussi', r.accReste && !r.corbeille.acc, j(r));
  rec(G.D0, 'Témoin : un devis brouillon part toujours à la corbeille', r.brouillonParti && r.corbeille.brouillon, j(r));
}

/* ---------------- D2 — AF1-T6 : fiche fluide signée → suppression refusée ---------------- */
const FICHE = (extra) => `(function(){ const f=Object.assign({id:'fl'+Math.random().toString(36).slice(2,8),num:'FF-'+__REF.an+'-0'+(10+FLU.length),date:__REF.jour,nature:'entretien',client:'Boulangerie Dupré',equipId:'',desc:'Monosplit Daikin FTXM25 — SN 1',fluide:'R32',charge:0.9,ctrl:'ok',qv:0,qrec:0,qreg:0,qrt:0,qru:0,bout:'',obs:'',prg:675,teq:0.61},${JSON.stringify(extra || {})}); FLU.push(f); save('cp2_fluides',FLU); return f.id; })()`;
{
  const r = await p.evaluate(async (mk) => {
    AD.reset(); __oui = true; const id = eval(mk);
    go('fluides'); await new Promise(r => setTimeout(r, 150));
    delFlu(id); await new Promise(r => setTimeout(r, 100));
    return { reste: FLU.some(x => x.id === id), stock: AD.stockFlu().some(x => x.id === id), corbeille: AD.trash().some(x => x.item && x.item.id === id), msgs: __msgs.slice(), dlg: __dlg.slice() };
  }, FICHE({ sigDetenteur: { at: REF.horloge, nom: 'M. Détenteur', hash: 'sig1' } }));
  rec(G.D2, 'T6 fiche signée : suppression refusée (reste en mémoire et dans le stockage, pas dans la corbeille)', r.reste && r.stock && !r.corbeille && r.msgs.some(m => /5 ans/i.test(m)), j(r));
}

/* ---------------- D2 — AF1-T7 : fiche numérotée non signée → « annulée » (motif), toujours au registre et au bilan ---------------- */
{
  const r = await p.evaluate(async (mk) => {
    AD.reset(); const id = eval(mk); const f0 = AD.clone(FLU.find(x => x.id === id));
    if (typeof window.annulerFlu !== 'function') return { absent: true };
    __rep = ''; annulerFlu(id); const sansMotif = !FLU.find(x => x.id === id).annulee;
    __rep = 'Erreur de saisie : mauvais équipement'; annulerFlu(id); await new Promise(r => setTimeout(r, 100));
    const f = FLU.find(x => x.id === id), st = AD.stockFlu().find(x => x.id === id);
    go('fluides'); await new Promise(r => setTimeout(r, 250));
    const sel = document.getElementById('fluYear'); if (sel) { sel.value = __REF.an; renderFluides(); } await new Promise(r => setTimeout(r, 200));
    const row = [...document.querySelectorAll('#fluTable tr')].find(tr => tr.textContent.indexOf(f.num) >= 0);
    const real = window.print; window.print = () => {}; printFicheFlu(id); window.print = real; const html = document.getElementById('devisDoc').innerHTML;
    const bilan = (document.getElementById('nxfb') || {}).textContent || '';
    /* intact pour le reste : mêmes champs qu'avant, seul annulee s'ajoute */
    const f1 = AD.clone(f); delete f1.annulee;
    return { sansMotif, annulee: f.annulee, stock: !!(st && st.annulee), ligne: row ? row.textContent : null, pdf: /ANNULÉE/.test(html) && html.indexOf('mauvais équipement') >= 0, bilan: /annulée/i.test(bilan), intact: JSON.stringify(f0) === JSON.stringify(f1), msgs: __msgs.slice() };
  }, FICHE({}));
  rec(G.D2, 'T7 « Annuler la fiche » : motif obligatoire (sans motif : rien), puis annulee {at, motif} en mémoire et dans le stockage', !r.absent && r.sansMotif && r.annulee && r.annulee.motif === 'Erreur de saisie : mauvais équipement' && r.annulee.at && r.stock, j({ sansMotif: r.sansMotif, annulee: r.annulee, stock: r.stock }));
  rec(G.D2, 'T7 fiche annulée : toujours au registre, ligne avec la mention ANNULÉE, le reste de la fiche intact', !r.absent && !!r.ligne && /ANNULÉE/.test(r.ligne) && r.intact, j({ ligne: (r.ligne || '').slice(0, 160), intact: r.intact }));
  rec(G.D2, 'T7 fiche annulée : PDF imprimable avec la mention ANNULÉE et le motif ; bilan annuel la mentionne', !r.absent && r.pdf && r.bilan, j({ pdf: r.pdf, bilan: r.bilan }));
}

/* ---------------- D2 — AF1-T8 : la corbeille ne reçoit jamais une fiche numérotée de moins de 5 ans ---------------- */
{
  const r = await p.evaluate(async ([mk2, mk6, mk0]) => {
    AD.reset(); __oui = true;
    const id2 = eval(mk2), id6 = eval(mk6), id0 = eval(mk0);
    delFlu(id2); delFlu(id6); delFlu(id0); await new Promise(r => setTimeout(r, 150));
    const t = AD.trash().map(x => x.item && x.item.id);
    return { recenteReste: FLU.some(x => x.id === id2) && !t.includes(id2), ancienneCorbeille: !FLU.some(x => x.id === id6) && t.includes(id6), sansNumCorbeille: !FLU.some(x => x.id === id0) && t.includes(id0), msgs: __msgs.filter(m => /5 ans/.test(m)) };
  }, [FICHE({ date: await p.evaluate(() => AD.isoAn(-2)) }), FICHE({ date: await p.evaluate(() => AD.isoAn(-6)) }), FICHE({ num: '' })]);
  rec(G.D2, 'T8 fiche numérotée d\'il y a 2 ans : refusée (conservation 5 ans), message avec la date de fin de conservation', r.recenteReste && r.msgs.some(m => /jusqu'au|jusqu’au/.test(m)), j(r));
  rec(G.D2, 'T8 fiche numérotée d\'il y a 6 ans : corbeille possible', r.ancienneCorbeille, j(r));
  rec(G.D2, 'T8 fiche sans numéro (jamais enregistrée) : corbeille possible', r.sansNumCorbeille, j(r));
}

/* ---------------- D3 — AF1-T9 : paramètres, garde de sortie « Enregistrer / Abandonner » ---------------- */
async function t9(mobile) {
  const Q = await page({ mobile, horloge: REF.horloge });
  const dlg = []; let accepter = true;
  Q.p.removeAllListeners('dialog'); Q.p.on('dialog', (d) => { dlg.push(d.type() + ':' + d.message()); (accepter ? d.accept() : d.dismiss()).catch(() => {}); });
  const lbl = mobile ? 'téléphone' : 'PC';
  /* a. rien modifié : aucune question */
  await Q.p.evaluate(() => { go('params'); }); await Q.p.waitForTimeout(200);
  await Q.p.evaluate(() => { go('dash'); }); await Q.p.waitForTimeout(200);
  const aucune = dlg.length === 0;
  /* b. taux horaire modifié, départ vers le tableau de bord → question ; « Enregistrer » */
  const avant = await Q.p.evaluate(() => P.defaultRate);
  const nouveau = avant === 45 ? 52 : 45;
  await Q.p.evaluate(() => { go('params'); }); await Q.p.waitForTimeout(200);
  await Q.p.fill('#pg_taux', String(nouveau)); await Q.p.dispatchEvent('#pg_taux', 'change');
  accepter = true; await Q.p.evaluate(() => { go('dash'); }); await Q.p.waitForTimeout(300);
  const q1 = dlg.slice(); const apres = await Q.p.evaluate(() => P.defaultRate);
  await Q.p.reload(); await Q.p.waitForTimeout(2200);
  const recharge = await Q.p.evaluate(() => P.defaultRate);
  rec(G.D3, `T9 (${lbl}) rien modifié : changer d'écran ne pose aucune question`, aucune, j(dlg));
  rec(G.D3, `T9 (${lbl}) taux horaire modifié puis tableau de bord : question « OK = enregistrer · Annuler = PERDRE les modifications »`, q1.length === 1 && /OK\s*=\s*enregistrer/i.test(q1[0]) && /Annuler\s*=\s*PERDRE/.test(q1[0]), j(q1));
  rec(G.D3, `T9 (${lbl}) « Enregistrer » : valeur gardée, encore là après rechargement`, apres === nouveau && recharge === nouveau, j({ avant, apres, recharge }));
  /* c. « Abandonner » : ancienne valeur */
  dlg.length = 0; await Q.p.evaluate(() => { go('params'); }); await Q.p.waitForTimeout(200);
  await Q.p.fill('#pg_taux', String(nouveau + 10)); await Q.p.dispatchEvent('#pg_taux', 'change');
  accepter = false; await Q.p.evaluate(() => { go('dash'); }); await Q.p.waitForTimeout(300);
  const q2 = dlg.slice(); const abandon = await Q.p.evaluate(() => P.defaultRate);
  await Q.p.evaluate(() => { go('params'); }); await Q.p.waitForTimeout(200);
  const champ = await Q.p.evaluate(() => +document.getElementById('pg_taux').value);
  rec(G.D3, `T9 (${lbl}) « Abandonner » : ancienne valeur gardée, le champ revient à la valeur enregistrée`, q2.length === 1 && abandon === nouveau && champ === nouveau, j({ q2, abandon, champ }));
  /* d. enregistrer puis partir : plus de question ; fermeture de l'onglet retenue tant que des modifications existent */
  dlg.length = 0;
  await Q.p.fill('#pg_taux', String(avant)); await Q.p.dispatchEvent('#pg_taux', 'change');
  const retenu = await Q.p.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  await Q.p.evaluate(() => { saveParams(); go('dash'); }); await Q.p.waitForTimeout(200);
  rec(G.D3, `T9 (${lbl}) modifications non enregistrées : la fermeture de l'onglet est retenue ; après « Enregistrer », partir ne demande rien`, retenu && dlg.length === 0, j({ retenu, dlg }));
  if (mobile) {
    const sticky = await Q.p.evaluate(() => { go('params'); const b = document.querySelector('#v-params button[onclick="saveParams()"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { pos: getComputedStyle(b.closest('.row-actions')).position, visible: r.top >= 0 && r.bottom <= window.innerHeight }; });
    rec(G.D3, 'T9 (téléphone) bouton « Enregistrer » collant (fixé en bas), visible sans faire défiler', !!sticky && /sticky|fixed/.test(sticky.pos) && sticky.visible, j(sticky));
  }
  rec(G.D3, `T9 (${lbl}) aucune erreur de page`, Q.errs.length === 0, Q.errs.join(' | '));
  await Q.ctx.close();
}
await t9(false); await t9(true);

/* ---------------- D5 — AF1-T10 : fiche créée depuis une intervention PAS ENCORE enregistrée, client nouveau ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset(); newDep('dep'); await new Promise(r => setTimeout(r, 50));
    Object.assign(curDep, { cNom: 'Client Nouveau Fiche', cType: 'Professionnel', cAdr: '12 Rue Neuve', cVille: '60600 Clermont', cSiren: '123456789', desc: 'Appoint de fluide' }); loadDepForm();
    const dejaClient = CLIENTS.some(c => c.nom === 'Client Nouveau Fiche');
    /* le bouton « 🧪 Fiche fluide » du formulaire d'intervention */
    document.querySelector('#v-depform button[onclick*="openFlu(null"]').click(); await new Promise(r => setTimeout(r, 250));
    const champs = { adr: document.getElementById('fl_detAdr'), ville: document.getElementById('fl_detVille'), siret: document.getElementById('fl_detSiret') };
    const pre = { adr: champs.adr && champs.adr.value, ville: champs.ville && champs.ville.value, siret: champs.siret && champs.siret.value, modifiable: !!(champs.adr && !champs.adr.disabled && !champs.adr.readOnly) };
    document.getElementById('fl_desc').value = 'Monosplit Daikin FTXM25'; document.getElementById('fl_charge').value = '0.9'; document.getElementById('fl_qv').value = '0.2';
    const n0 = FLU.length; saveFlu(false); await new Promise(r => setTimeout(r, 150));
    const f = FLU[FLU.length - 1], cree = FLU.length === n0 + 1;
    const real = window.print; window.print = () => {}; printFicheFlu(f.id); window.print = real; const html = document.getElementById('devisDoc').innerHTML;
    const det = /Détenteur[\s\S]{0,400}?Adresse\s*:\s*([^<]*)/i.exec(html);
    return { dejaClient, pre, cree, fiche: f ? { detAdr: f.detAdr, detVille: f.detVille, detSiret: f.detSiret, client: f.client } : null, adresseImprimee: det ? det[1].trim() : null, siretImprime: html.indexOf('123456789') >= 0 };
  });
  rec(G.D5, 'T10 fiche ouverte depuis l\'intervention non enregistrée : champs adresse / ville / SIRET du détenteur présents, modifiables, pré-remplis depuis l\'intervention', !r.dejaClient && r.pre.modifiable && r.pre.adr === '12 Rue Neuve' && r.pre.ville === '60600 Clermont' && r.pre.siret === '123456789', j(r.pre));
  rec(G.D5, 'T10 la fiche enregistrée garde une copie des coordonnées du détenteur', r.cree && r.fiche && r.fiche.detAdr === '12 Rue Neuve' && r.fiche.detVille === '60600 Clermont' && r.fiche.detSiret === '123456789', j(r.fiche));
  rec(G.D5, 'T10 PDF : l\'adresse du détenteur est celle de l\'intervention (plus « — »)', /12 Rue Neuve/.test(r.adresseImprimee || '') && /60600 Clermont/.test(r.adresseImprimee || '') && r.siretImprime, j({ adresse: r.adresseImprimee, siret: r.siretImprime }));
  /* client existant tapé dans la fiche : coordonnées reprises de la fiche client, modifiables */
  const r2 = await p.evaluate(async () => {
    AD.reset(); closeModal('mFlu'); go('fluides'); openFlu(); await new Promise(r => setTimeout(r, 200));
    const c = document.getElementById('fl_client'); c.value = CLIENTS[0].nom; c.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 100));
    const a = document.getElementById('fl_detAdr'); const auto = a && a.value;
    if (a) a.value = '7 Rue Modifiée'; document.getElementById('fl_desc').value = 'Split'; saveFlu(false); await new Promise(r => setTimeout(r, 150));
    const f = FLU[FLU.length - 1]; closeModal('mFlu');
    return { auto, enregistre: f && f.detAdr, clientInchange: CLIENTS[0].adr };
  });
  rec(G.D5, 'T10 client existant saisi dans la fiche : adresse reprise de la fiche client, modifiable sur la fiche sans toucher la fiche client', r2.auto === '5 Rue de la Gare' && r2.enregistre === '7 Rue Modifiée' && r2.clientInchange === '5 Rue de la Gare', j(r2));
}

/* ---------------- D5 — AF1-T11 : adresse du détenteur vide → envoi du lien de signature refusé ---------------- */
{
  const r = await p.evaluate(async (mk) => {
    AD.reset(); const id = eval(mk); window.SESS = { user: { id: 'u1' } };
    nxsSendFlu(id); await new Promise(r => setTimeout(r, 200));
    const modal = !!document.getElementById('nxsModal');
    return { modal, msgs: __msgs.slice() };
  }, FICHE({ client: 'Client Sans Adresse Connue' }));
  rec(G.D5, 'T11 adresse du détenteur vide : envoi refusé, message « Adresse du détenteur manquante », aucun lien préparé', !r.modal && r.msgs.some(m => /Adresse du détenteur manquante/i.test(m)), j(r));
}

/* ---------------- D6 — AF1-T12 : fiche signée → ouvrir → enregistrer : signature gardée (mémoire ET stockage) ; mode guidé coupé ---------------- */
async function d6(guide, tag) {
  await p.evaluate((g) => { localStorage.setItem('cpnext_flu_guide', JSON.stringify(g)); }, guide);
  const r = await p.evaluate(async ([mkS, mkR]) => {
    AD.reset();
    const idS = eval(mkS), idR = eval(mkR);
    /* a. fiche signée : lecture seule, enregistrer ne change rien */
    go('fluides'); openFlu(idS); await new Promise(r => setTimeout(r, 250));
    const modal = AD.modalFlu(), ban = (document.getElementById('cpFluVerrou') || {}).textContent || '';
    const avantS = AD.clone(FLU.find(x => x.id === idS));
    document.getElementById('fl_obs').disabled = false; document.getElementById('fl_obs').value = 'MODIFIÉ APRÈS SIGNATURE';
    saveFlu(false); await new Promise(r => setTimeout(r, 200));
    const memS = FLU.find(x => x.id === idS), stS = AD.stockFlu().find(x => x.id === idS);
    closeModal('mFlu');
    /* b. fiche non signée mais portant un refus, un lien de signature et un repère : ouvrir, changer une observation, enregistrer → tout gardé */
    openFlu(idR); await new Promise(r => setTimeout(r, 250));
    document.getElementById('fl_obs').value = 'Observation ajoutée'; saveFlu(false); await new Promise(r => setTimeout(r, 200));
    const memR = FLU.find(x => x.id === idR), stR = AD.stockFlu().find(x => x.id === idR);
    closeModal('mFlu');
    return { modal, ban, sig: { avant: !!avantS.sigDetenteur, mem: !!(memS && memS.sigDetenteur), stock: !!(stS && stS.sigDetenteur), identique: JSON.stringify(avantS) === JSON.stringify(memS), msgs: __msgs.slice() },
      autres: { obs: memR && memR.obs, refus: !!(memR && memR.refusDetenteur), lien: !!(memR && memR.signLink), repere: memR && memR.repere, stockRefus: !!(stR && stR.refusDetenteur), stockLien: !!(stR && stR.signLink) } };
  }, [FICHE({ sigDetenteur: { at: REF.horloge, nom: 'M. Détenteur', hash: 'sig2', png: null } }), FICHE({ refusDetenteur: { at: REF.horloge, nom: 'M. Refus', motif: 'pas d\'accord' }, signLink: { token: 't-1', at: 1 }, repere: 'cave' })]);
  rec(G.D6, `${tag} fiche signée : signature présente avant, présente après en mémoire ET dans le stockage`, r.sig.avant && r.sig.mem && r.sig.stock, j(r.sig));
  rec(G.D6, `${tag} fiche signée : lecture seule (champs verrouillés, pas de bouton Enregistrer), bandeau « signée », fiche identique après la tentative`, r.modal.on && r.modal.libres.length === 0 && !r.modal.boutons.some(b => /Enregistrer/.test(b)) && /signée/i.test(r.ban) && r.sig.identique, j({ modal: r.modal, ban: r.ban.slice(0, 160), identique: r.sig.identique }));
  rec(G.D6, `${tag} fiche non signée : refus, lien de signature et repère gardés après ouverture + enregistrement (mémoire et stockage)`, r.autres.obs === 'Observation ajoutée' && r.autres.refus && r.autres.lien && r.autres.repere === 'cave' && r.autres.stockRefus && r.autres.stockLien, j(r.autres));
}
await d6(false, 'T12 (contrôle bloquant)');
await d6(true, 'T13 (mode guidé)');

/* ---------------- C-N1 : « Lieu / urgence » du contrat d'intervention gardé au clic suivant ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset(); localStorage.setItem('cpnext_flu_guide', 'true');
    newDep('dep'); await new Promise(r => setTimeout(r, 50));
    Object.assign(curDep, { cNom: 'Mme Urgence Test', cType: 'Particulier', cAdr: '10 Rue de Grenelle', cVille: '75007 Paris', desc: 'Compresseur HS', heures: 2 }); loadDepForm();
    saveDep(); const id = curDep.id; await new Promise(r => setTimeout(r, 100));
    /* réouverture (copie faite par openDep), puis fenêtre « Lieu / urgence » */
    go('dep'); openDep(id); await new Promise(r => setTimeout(r, 150));
    window.__nxPartPorteOff = true; const g = document.getElementById('nxPartPorte'); if (g) g.remove();
    nxPartConclusion('dep', id); await new Promise(r => setTimeout(r, 100));
    document.getElementById('nxpMode').value = 'hors_etablissement'; document.getElementById('nxpDate').value = __REF.jour;
    document.getElementById('nxpUrg').checked = true; document.getElementById('nxpUrgT').value = 'Panne totale, demande expresse du client';
    document.getElementById('nxpOk').click(); await new Promise(r => setTimeout(r, 150));
    const panneau = (document.getElementById('nxPartDep') || {}).textContent || '';
    const enMemoire = AD.clone(curDep.conclusion || null);
    /* le clic suivant : « Enregistrer » */
    saveDep(); await new Promise(r => setTimeout(r, 100));
    const x = DEP.find(o => o.id === id), st = JSON.parse(localStorage.getItem(LS.dep) || '[]').find(o => o.id === id);
    const real = window.print; window.print = () => {}; nxPartContratDep(); window.print = real; const html = document.getElementById('devisDoc').innerHTML;
    const regle = nxPartRegle('dep', id);
    delete window.__nxPartPorteOff;
    return { panneau: panneau.slice(0, 300), enMemoire, apres: x && x.conclusion, stock: st && st.conclusion, contrat: /Urgence/.test(html) && /demande expressément des travaux urgents/.test(html), regle: { ok: regle.ok, motif: regle.motif } };
  });
  rec(G.CN1, 'C-N1 « Lieu / urgence » enregistré puis « Enregistrer » : l\'urgence et le mode restent sur l\'intervention (mémoire et stockage)', !!(r.apres && r.apres.urgence && r.apres.mode === 'hors_etablissement') && !!(r.stock && r.stock.urgence), j({ enMemoire: r.enMemoire, apres: r.apres, stock: r.stock }));
  rec(G.CN1, 'C-N1 le panneau du formulaire montre l\'urgence tout de suite', /urgence/i.test(r.panneau) && !/À préciser/.test(r.panneau), r.panneau);
  rec(G.CN1, 'C-N1 le contrat imprimé porte la mention d\'urgence ; « Facturer » ne redemande rien (règle : urgence)', r.contrat && r.regle.ok && r.regle.motif === 'urgence', j({ contrat: r.contrat, regle: r.regle }));
}

/* ---------------- A-N5 : une fiche client existante garde son adresse (seuls les champs vides sont complétés) ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset(); const c1 = CLIENTS.find(c => c.nom === 'Boulangerie Dupré'), c2 = CLIENTS.find(c => c.nom === "L'Atelier du Froid");
    const ref1 = AD.clone(c1), ref2 = AD.clone(c2);
    /* a. devis v2 de sous-traitance : adresse du chantier ≠ adresse du client (donneur d'ordre) */
    const d = AD.v2({ cAdr: '99 Avenue du Chantier', cVille: '60000 Beauvais', cTel: '06 99 99 99 99', cType: 'Professionnel' });
    openDevis(d.id); await new Promise(r => setTimeout(r, 200)); nxd2.save(); await new Promise(r => setTimeout(r, 100));
    const a = AD.clone(CLIENTS.find(c => c.nom === 'Boulangerie Dupré')), dev = DEVIS.find(x => x.id === d.id);
    /* b. ancien formulaire : même client, autre adresse */
    const l = AD.legacy({ statut: 'brouillon' });
    openDevis(l.id); await new Promise(r => setTimeout(r, 200));
    document.getElementById('f_cNom').value = 'Boulangerie Dupré'; document.getElementById('f_cAdr').value = '3 Impasse du Chantier'; document.getElementById('f_cVille').value = '60100 Creil';
    saveDevis(); await new Promise(r => setTimeout(r, 100));
    const b = AD.clone(CLIENTS.find(c => c.nom === 'Boulangerie Dupré')), lg = DEVIS.find(x => x.id === l.id);
    /* c. intervention : adresse du lieu d'intervention ≠ adresse du client ; un champ vide (mail) se complète */
    newDep('dep'); await new Promise(r => setTimeout(r, 50));
    Object.assign(curDep, { cNom: "L'Atelier du Froid", cType: 'Professionnel', cAdr: '8 Zone Industrielle', cVille: '60200 Compiègne', cMail: 'atelier@exemple.fr', cTel: '03 44 00 00 00' }); loadDepForm(); saveDep(); await new Promise(r => setTimeout(r, 100));
    const c = AD.clone(CLIENTS.find(x => x.nom === "L'Atelier du Froid")), dep = DEP.find(o => o.id === curDep.id);
    /* d. témoin : un client NOUVEAU est créé avec les coordonnées du document */
    newDep('dep'); await new Promise(r => setTimeout(r, 50));
    Object.assign(curDep, { cNom: 'Client Témoin Nouveau', cType: 'Professionnel', cAdr: '12 Rue Neuve', cVille: '60600 Clermont' }); loadDepForm(); saveDep(); await new Promise(r => setTimeout(r, 100));
    const e = AD.clone(CLIENTS.find(x => x.nom === 'Client Témoin Nouveau'));
    return { ref1, a, dev: { adr: dev.cAdr, ville: dev.cVille }, b, lg: { adr: lg.cAdr, ville: lg.cVille }, ref2, c, dep: { adr: dep.cAdr, mail: dep.cMail }, e };
  });
  rec(G.AN5, 'A-N5 devis v2 (sous-traitance) enregistré : la fiche client garde son adresse et son téléphone ; le devis garde l\'adresse du chantier', r.a.adr === r.ref1.adr && r.a.ville === r.ref1.ville && r.a.tel === r.ref1.tel && r.dev.adr === '99 Avenue du Chantier' && r.dev.ville === '60000 Beauvais', j({ client: { adr: r.a.adr, ville: r.a.ville, tel: r.a.tel }, devis: r.dev }));
  rec(G.AN5, 'A-N5 ancien formulaire : même règle', r.b.adr === r.ref1.adr && r.b.ville === r.ref1.ville && r.lg.adr === '3 Impasse du Chantier', j({ client: { adr: r.b.adr, ville: r.b.ville }, devis: r.lg }));
  rec(G.AN5, 'A-N5 intervention enregistrée : adresse du client gardée, champ vide (mail) complété, intervention intacte', r.c.adr === r.ref2.adr && r.c.ville === r.ref2.ville && !r.ref2.mail && r.c.mail === 'atelier@exemple.fr' && r.dep.adr === '8 Zone Industrielle', j({ client: { adr: r.c.adr, ville: r.c.ville, mail: r.c.mail }, dep: r.dep }));
  rec(G.AN5, 'Témoin : un client nouveau est créé avec les coordonnées du document', !!r.e && r.e.adr === '12 Rue Neuve' && r.e.ville === '60600 Clermont', j(r.e));
}

/* ================= AF1-bis (relecture indépendante du 03/11/2026, exception au gel décidée par Gabriel) ================= */
const GB = { AV: 'AF1-bis avenant / original', AN: 'AF1-bis annuler le devis', SG: 'AF1-bis verrou signature (ancien formulaire)' };

/* ---------------- T14 : un avenant et son original ne sont jamais facturables tous les deux ---------------- */
{
  /* a. l'original porte une facture vivante (acompte) : « Faire un avenant » est refusé */
  const ra = await p.evaluate(async () => {
    AD.reset();
    const d = AD.v2({ statut: 'accepte', facAcompte: { num: 'TEST-F-' + __REF.an + '-0801', date: __REF.jour, montant: 100, baseTTC: 300, payeLe: null, mode: '' } });
    const n0 = DEVIS.length; cpDevisAvenant(d.id); await new Promise(r => setTimeout(r, 200));
    return { n0, n1: DEVIS.length, msgs: __msgs.slice(), statut: DEVIS.find(x => x.id === d.id).statut };
  });
  rec(GB.AV, 'T14a original avec une facture vivante : « Faire un avenant » refusé, message « fais d\'abord un avoir … nouveau devis », aucun devis créé', ra.n1 === ra.n0 && ra.msgs.some(m => /avoir/i.test(m) && /nouveau devis/i.test(m)), j(ra));
  /* b. avenant (éditeur v2) passé « Accepté » et enregistré : l'original devient « remplacé par l'avenant », sort de tout, reste visible et non supprimable */
  const rb = await p.evaluate(async () => {
    AD.reset();
    const o = AD.v2({ statut: 'accepte', acceptedAt: Date.parse(__REF.horloge) - 86400000 });
    go('tous'); await new Promise(r => setTimeout(r, 150));
    const accAvant = DEVIS.filter(x => x.statut === 'accepte').length;
    cpDevisAvenant(o.id); await new Promise(r => setTimeout(r, 250));
    const a = DEVIS.find(x => x.avenantDe && x.avenantDe.id === o.id); if (!a) return { absent: true };
    nxd2.statut('accepte'); const ok = nxd2.save(); await new Promise(r => setTimeout(r, 150));
    const O = DEVIS.find(x => x.id === o.id), A = DEVIS.find(x => x.id === a.id), st = JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === o.id) || {};
    renderCommander(); renderPlanning(); renderDash();
    const cmd = /Chantiers signés[^0-9]*(\d+)/.exec((document.getElementById('cmdKpis') || {}).textContent || '');
    const plan = (document.getElementById('planTodo') || {}).textContent || '';
    const carnet = nxobjCarnet(), accApres = DEVIS.filter(x => x.statut === 'accepte').length, carnetAttendu = DEVIS.filter(x => x.statut === 'accepte' && !x.facSolde).length;   /* carnet = acceptés pas encore facturés au solde */
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === o.id && /remplac/.test(x.type || ''));
    /* facturer l'original : refusé ; à l'ouverture : bandeau, pas de bloc facturation, « Dupliquer » seulement */
    AD.reset(); await facturerDevis(o.id, 'solde'); await new Promise(r => setTimeout(r, 300));
    const facMsgs = __msgs.slice(), O2 = DEVIS.find(x => x.id === o.id);
    openDevis(o.id); await new Promise(r => setTimeout(r, 250));
    const fbloc = (document.getElementById('fBloc') || {}).innerHTML || '';
    const ban = (document.getElementById('nxd2Banner') || {}).textContent || '';
    const boutons = [...document.querySelectorAll('#v-nx_devis2 button')].map(b => b.textContent.trim());
    AD.reset(); __oui = true; delDevis(o.id); await new Promise(r => setTimeout(r, 100));
    return { ok, oStatut: O.statut, stStatut: st.statut, oDate: O.acceptedAt === o.acceptedAt, lien: !!(O.remplacePar && O.remplacePar.id === a.id && O.remplacePar.num === a.num), aStatut: A.statut, accAvant, accApres,
      cmd: cmd ? +cmd[1] : null, planO: plan.indexOf(o.num) >= 0, planA: plan.indexOf(a.num) >= 0, carnet: carnet.devis, carnetAttendu, journal: journal.length,
      facMsgs, fac: !!(O2.facSolde || O2.facAcompte), fbloc: fbloc === '', ban: ban.slice(0, 200), avenantBtn: boutons.some(b => /Faire un avenant/.test(b)), dupBtn: boutons.some(b => /Dupliquer/.test(b)), reste: DEVIS.some(x => x.id === o.id), corbeille: AD.trash().some(x => x.item && x.item.id === o.id) };
  });
  rec(GB.AV, 'T14b avenant accepté (éditeur) : l\'original passe « remplacé par l\'avenant n° … » (mémoire et stockage), date d\'acceptation gardée, lien vers l\'avenant', !rb.absent && rb.ok === true && rb.aStatut === 'accepte' && rb.oStatut === 'remplace' && rb.stStatut === 'remplace' && rb.oDate && rb.lien, j(rb));
  rec(GB.AV, 'T14b l\'original sort d\'« À commander », de « Planifier » et du carnet de commandes (un seul chantier signé : l\'avenant)', !rb.absent && rb.accApres === rb.accAvant && rb.cmd === rb.accApres && !rb.planO && rb.planA && rb.carnet === rb.carnetAttendu, j({ accAvant: rb.accAvant, accApres: rb.accApres, cmd: rb.cmd, planO: rb.planO, planA: rb.planA, carnet: rb.carnet, carnetAttendu: rb.carnetAttendu }));
  rec(GB.AV, 'T14b l\'original sort de la facturation : « Facturer » refusé, aucune facture, bloc facturation vide ; ligne au journal', !rb.absent && !rb.fac && rb.facMsgs.some(m => /ne se facture plus/i.test(m)) && rb.fbloc && rb.journal >= 1, j({ fac: rb.fac, facMsgs: rb.facMsgs, fbloc: rb.fbloc, journal: rb.journal }));
  rec(GB.AV, 'T14b l\'original reste visible (bandeau « remplacé par l\'avenant »), « Dupliquer » seulement, non supprimable', !rb.absent && /remplacé par l'avenant/i.test(rb.ban) && !rb.avenantBtn && rb.dupBtn && rb.reste && !rb.corbeille, j({ ban: rb.ban, avenantBtn: rb.avenantBtn, dupBtn: rb.dupBtn, reste: rb.reste, corbeille: rb.corbeille }));
  /* c. l'original a été facturé ENTRE-TEMPS : l'acceptation de l'avenant est refusée (liste, puis éditeur) */
  const rc = await p.evaluate(async () => {
    AD.reset();
    const o = AD.v2({ statut: 'accepte' }); go('tous'); await new Promise(r => setTimeout(r, 150));
    cpDevisAvenant(o.id); await new Promise(r => setTimeout(r, 250));
    const a = DEVIS.find(x => x.avenantDe && x.avenantDe.id === o.id); if (!a) return { absent: true };
    nxd2.close(); go('tous'); await new Promise(r => setTimeout(r, 150));
    const O = DEVIS.find(x => x.id === o.id); O.facAcompte = { num: 'TEST-F-' + __REF.an + '-0802', date: __REF.jour, montant: 50, baseTTC: 300, payeLe: null, mode: '' }; save(LS.devis, DEVIS);
    AD.reset(); nxSetStatut(a.id, 'accepte'); await new Promise(r => setTimeout(r, 100));
    const s1 = DEVIS.find(x => x.id === a.id).statut, m1 = __msgs.slice();
    AD.reset(); openDevis(a.id); await new Promise(r => setTimeout(r, 250)); nxd2.statut('accepte'); nxd2.save(); await new Promise(r => setTimeout(r, 150));
    const s2 = DEVIS.find(x => x.id === a.id).statut, m2 = __msgs.slice();
    nxd2.close();
    return { s1, m1, s2, m2, oStatut: DEVIS.find(x => x.id === o.id).statut };
  });
  rec(GB.AV, 'T14c original facturé entre-temps : « Accepté » depuis la liste refusé (message clair), l\'original reste accepté', !rc.absent && rc.s1 !== 'accepte' && rc.m1.some(m => /facturé entre-temps/i.test(m) && /avoir/i.test(m)) && rc.oStatut === 'accepte', j({ s1: rc.s1, m1: rc.m1, oStatut: rc.oStatut }));
  rec(GB.AV, 'T14c original facturé entre-temps : « Accepté » puis « Enregistrer » dans l\'éditeur refusé aussi', !rc.absent && rc.s2 !== 'accepte' && rc.m2.some(m => /facturé entre-temps/i.test(m)), j({ s2: rc.s2, m2: rc.m2 }));
  /* d. ancien formulaire : avenant passé « Accepté » et enregistré → original remplacé */
  const rd = await p.evaluate(async () => {
    AD.reset(); const o = AD.legacy({ statut: 'accepte', acceptedAt: Date.parse(__REF.horloge) });
    cpDevisAvenant(o.id); await new Promise(r => setTimeout(r, 250));
    const a = DEVIS.find(x => x.avenantDe && x.avenantDe.id === o.id); if (!a || !cur || cur.id !== a.id) return { absent: true };
    document.getElementById('f_statut').value = 'accepte'; saveDevis(); await new Promise(r => setTimeout(r, 150));
    const O = DEVIS.find(x => x.id === o.id); openDevis(o.id); await new Promise(r => setTimeout(r, 250));
    const ban = (document.getElementById('cpVerrouWiz') || {}).textContent || '';
    const fb = (document.getElementById('fBloc') || {}).innerHTML || '';
    return { oStatut: O.statut, lien: !!(O.remplacePar && O.remplacePar.num === a.num), aStatut: DEVIS.find(x => x.id === a.id).statut, ban: ban.slice(0, 200), fb: fb === '' };
  });
  rec(GB.AV, 'T14d ancien formulaire : avenant « Accepté » enregistré → original « remplacé par l\'avenant n° … » (bandeau), bloc facturation vide', !rd.absent && rd.oStatut === 'remplace' && rd.lien && rd.aStatut === 'accepte' && /remplacé par l'avenant/i.test(rd.ban) && rd.fb, j(rd));
}

/* ---------------- T15 : « Annuler le devis » (accepté ou signé), motif obligatoire ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset(); if (typeof window.cpDevisAnnuler !== 'function') return { absent: true };
    const modal = () => document.getElementById('mAnnulDevis');
    const ouvert = () => !!(modal() && modal().classList.contains('on'));
    /* a. facture vivante : refus « fais d'abord un avoir » */
    const f = AD.v2({ statut: 'accepte', facSolde: { num: 'TEST-F-' + __REF.an + '-0803', date: __REF.jour, montant: 200, total: 200, payeLe: null, mode: '' } });
    cpDevisAnnuler(f.id); await new Promise(r => setTimeout(r, 100));
    const a = { statut: DEVIS.find(x => x.id === f.id).statut, msgs: __msgs.slice(), modal: ouvert() };
    /* b. devis signé : bouton présent ; motif obligatoire ; annulé avec motif */
    AD.reset();
    const s = AD.v2({ statut: 'accepte', signature: { at: __REF.horloge, nom: 'Client Signataire', hash: 'ann1' }, acceptedAt: Date.parse(__REF.horloge) });
    openDevis(s.id); await new Promise(r => setTimeout(r, 250));
    const btnV2 = [...document.querySelectorAll('#v-nx_devis2 button')].some(b => /Annuler le devis/.test(b.textContent));
    nxd2.close(); go('tous'); await new Promise(r => setTimeout(r, 150));
    const accAvant = DEVIS.filter(x => x.statut === 'accepte').length;
    cpDevisAnnuler(s.id); await new Promise(r => setTimeout(r, 100));
    const ouvertB = ouvert();
    cpDevisAnnulerOk(); await new Promise(r => setTimeout(r, 100));
    const sansMotif = DEVIS.find(x => x.id === s.id).statut, msgSansMotif = __msgs.slice();
    const radio = modal() && modal().querySelector('input[name="cpAnnulMotif"][value="abandon"]'); if (radio) radio.checked = true;
    cpDevisAnnulerOk(); await new Promise(r => setTimeout(r, 200));
    const S = DEVIS.find(x => x.id === s.id), st = JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === s.id) || {};
    renderDash(); renderCommander(); renderPlanning();
    const plan = (document.getElementById('planTodo') || {}).textContent || '';
    const cmd = /Chantiers signés[^0-9]*(\d+)/.exec((document.getElementById('cmdKpis') || {}).textContent || '');
    const accApres = DEVIS.filter(x => x.statut === 'accepte').length, carnet = nxobjCarnet().devis, carnetAttendu = DEVIS.filter(x => x.statut === 'accepte' && !x.facSolde).length;
    const ca = DEVIS.filter(x => x.statut === 'accepte').reduce((t, d) => t + compute(d).totalHT, 0);
    const kpi = /Acceptés[^0-9]*(\d+)/.exec((document.getElementById('dashKpis') || {}).textContent || '');
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === s.id && /annul/.test(x.type || ''));
    /* réouverture : bandeau ; PDF avec le bandeau ANNULÉ ; suppression refusée */
    openDevis(s.id); await new Promise(r => setTimeout(r, 250));
    const ban = (document.getElementById('nxd2Banner') || {}).textContent || '';
    const real = window.print; window.print = () => {}; printDevis(); window.print = real; const html = document.getElementById('devisDoc').innerHTML;
    const boutons = [...document.querySelectorAll('#v-nx_devis2 button')].map(b => b.textContent.trim());
    nxd2.close();
    AD.reset(); __oui = true; delDevis(s.id); await new Promise(r => setTimeout(r, 100));
    const b = { btnV2, ouvertB, sansMotif, msgSansMotif, statut: S.statut, stStatut: st.statut, annulation: S.annulation, date: S.acceptedAt === s.acceptedAt, sig: !!S.signature, accAvant, accApres, cmd: cmd ? +cmd[1] : null, kpi: kpi ? +kpi[1] : null, planS: plan.indexOf(s.num) >= 0, carnet, carnetAttendu, ca,
      journal: journal.length, ban: ban.slice(0, 200), pdf: /ANNULÉ/.test(html) && /Abandon du client/i.test(html), avenantBtn: boutons.some(x => /Faire un avenant|Annuler le devis/.test(x)), reste: DEVIS.some(x => x.id === s.id), corbeille: AD.trash().some(x => x.item && x.item.id === s.id), msgs: __msgs.slice() };
    /* c. après un avoir TOTAL (plus de facture vivante) : annulation possible ; ancien formulaire : bouton présent */
    AD.reset();
    const av = AD.legacy({ statut: 'accepte', facAnnulees: [{ num: 'TEST-F-' + __REF.an + '-0804', date: __REF.jour, montant: 200, avoir: 'TEST-AV-' + __REF.an + '-0001', annuleeLe: __REF.jour, which: 'solde' }] });
    openDevis(av.id); await new Promise(r => setTimeout(r, 250));
    const btnWiz = /Annuler le devis/.test((document.getElementById('cpVerrouWiz') || {}).textContent || '');
    cpDevisAnnuler(av.id); await new Promise(r => setTimeout(r, 100));
    const r2 = modal() && modal().querySelector('input[name="cpAnnulMotif"][value="erreur"]'); if (r2) r2.checked = true;
    cpDevisAnnulerOk(); await new Promise(r => setTimeout(r, 200));
    const AV = DEVIS.find(x => x.id === av.id);
    const banWiz = (document.getElementById('cpVerrouWiz') || {}).textContent || '';
    const c = { btnWiz, statut: AV.statut, motif: AV.annulation && AV.annulation.motif, banWiz: banWiz.slice(0, 200), vue: window._curView };
    return { a, b, c };
  });
  if (r.absent) r.a = r.b = r.c = {};
  rec(GB.AN, 'T15a devis avec une facture vivante : « Annuler le devis » refusé (« fais d\'abord un avoir »), rien ne change', !r.absent && r.a.statut === 'accepte' && !r.a.modal && r.a.msgs.some(m => /avoir/i.test(m)), j(r.a));
  rec(GB.AN, 'T15b devis signé : bouton « Annuler le devis » dans l\'éditeur ; motif obligatoire (sans motif : rien) ; puis statut « annulé » avec motif et date, signature et date d\'acceptation gardées (mémoire et stockage)', !r.absent && r.b.btnV2 && r.b.ouvertB && r.b.sansMotif === 'accepte' && r.b.statut === 'annule' && r.b.stStatut === 'annule' && !!(r.b.annulation && r.b.annulation.motif === 'abandon' && r.b.annulation.at) && r.b.date && r.b.sig, j({ btnV2: r.b.btnV2, ouvertB: r.b.ouvertB, sansMotif: r.b.sansMotif, statut: r.b.statut, stStatut: r.b.stStatut, annulation: r.b.annulation, date: r.b.date, sig: r.b.sig }));
  rec(GB.AN, 'T15b devis annulé : sort d\'« À commander », de « Planifier », du carnet de commandes et du CA signé (compteur « Acceptés »)', !r.absent && r.b.accApres === r.b.accAvant - 1 && r.b.cmd === r.b.accApres && r.b.kpi === r.b.accApres && !r.b.planS && r.b.carnet === r.b.carnetAttendu, j({ accAvant: r.b.accAvant, accApres: r.b.accApres, cmd: r.b.cmd, kpi: r.b.kpi, planS: r.b.planS, carnet: r.b.carnet, carnetAttendu: r.b.carnetAttendu }));
  rec(GB.AN, 'T15b devis annulé : reste visible (bandeau « annulé »), PDF avec le bandeau ANNULÉ et le motif, non supprimable, ligne au journal, plus d\'avenant ni de nouvelle annulation', !r.absent && /annulé/i.test(r.b.ban) && r.b.pdf && r.b.reste && !r.b.corbeille && r.b.journal >= 1 && !r.b.avenantBtn, j({ ban: r.b.ban, pdf: r.b.pdf, reste: r.b.reste, corbeille: r.b.corbeille, journal: r.b.journal, avenantBtn: r.b.avenantBtn }));
  rec(GB.AN, 'T15c après un avoir total : annulation possible ; ancien formulaire : bouton dans le bandeau, bandeau « annulé » après', !r.absent && r.c.btnWiz && r.c.statut === 'annule' && r.c.motif === 'erreur' && /annulé/i.test(r.c.banWiz), j(r.c));
}

/* ---------------- T16 : ancien formulaire, devis accepté : « ✍️ Signature », « Faire signer en ligne » et « Enregistrer le devis » du récapitulatif cachés ; nxsSendDevis refuse ---------------- */
{
  const r = await p.evaluate(async () => {
    AD.reset(); const d = AD.legacy({ statut: 'accepte', acceptedAt: Date.parse(__REF.horloge) });
    openDevis(d.id); await new Promise(r => setTimeout(r, 250));
    const cache = id => { const b = document.getElementById(id); return b ? getComputedStyle(b).display === 'none' : null; };
    const recap = document.querySelector('#v-wizard .navbtns button[onclick="saveDevis()"]');
    const avant = AD.stored(d.id);
    window.SESS = { user: { id: 'u1' } };
    const n = document.getElementById('f_notes'); n.disabled = false; n.value = 'MODIFIÉ PAR LA SIGNATURE';
    nxsSendDevis(); await new Promise(r => setTimeout(r, 300));
    const apres = AD.stored(d.id);
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === d.id && x.action === 'signature');
    const verrouille = { sigTop: cache('nxsBtnTop'), sigRecap: cache('nxsBtn'), recapSave: recap ? getComputedStyle(recap).display === 'none' : null, identique: JSON.stringify(avant) === JSON.stringify(apres), notes: apres.notes, msgs: __msgs.slice(), journal: journal.length };
    /* témoin : sur un brouillon, les trois boutons reviennent */
    AD.reset(); const b = AD.legacy({ statut: 'brouillon' }); openDevis(b.id); await new Promise(r => setTimeout(r, 250));
    const libre = { sigTop: cache('nxsBtnTop'), sigRecap: cache('nxsBtn'), recapSave: recap ? getComputedStyle(recap).display === 'none' : null };
    return { verrouille, libre };
  });
  rec(GB.SG, 'T16 devis accepté (ancien formulaire) : « ✍️ Signature », « Faire signer en ligne » et « 💾 Enregistrer le devis » du récapitulatif cachés', r.verrouille.sigTop === true && r.verrouille.sigRecap === true && r.verrouille.recapSave === true, j(r.verrouille));
  rec(GB.SG, 'T16 nxsSendDevis sur un devis accepté : refusé en tête (devis identique, message 🔒, ligne au journal, aucun lien préparé)', r.verrouille.identique && r.verrouille.notes !== 'MODIFIÉ PAR LA SIGNATURE' && r.verrouille.msgs.some(m => /🔒|ne se renvoie pas/i.test(m)) && !r.verrouille.msgs.some(m => /Préparation du lien/.test(m)) && r.verrouille.journal >= 1, j(r.verrouille));
  rec(GB.SG, 'Témoin : sur un brouillon, les trois boutons sont de nouveau visibles', r.libre.sigTop === false && r.libre.sigRecap === false && r.libre.recapSave === false, j(r.libre));
}

/* ---------------- T17 : apostrophe typographique (’, clavier iPhone) dans le nom du détenteur ---------------- */
{
  const r = await p.evaluate(async () => {
    const a = cpDetenteurCoord('L’Atelier du Froid'), b = cpDetenteurCoord("L'Atelier du Froid");
    closeModal('mFlu'); go('fluides'); openFlu(); await new Promise(r => setTimeout(r, 200));
    const c = document.getElementById('fl_client'); c.value = 'L’Atelier du Froid'; c.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 100));
    const champ = (document.getElementById('fl_detAdr') || {}).value; closeModal('mFlu');
    return { a, b, champ };
  });
  rec(G.D5, 'T17 « L’Atelier du Froid » (apostrophe ’) trouve la fiche client comme « L\'Atelier du Froid » : adresse et ville reprises, champ de la fiche pré-rempli', r.a.adr === "2 rue de l'Église" && r.a.ville === '60100 Creil' && r.a.adr === r.b.adr && r.champ === "2 rue de l'Église", j(r));
}

/* ================= AF1-ter (relecture indépendante du 04/11/2026) : T18 signature tardive, T19 famille original + avenants (fusion entre appareils, deux avenants),
   T20 ordre des messages en démonstration, T21 liens de signature désactivés ================= */
const GC = { SIG: 'AF1-ter signature tardive', FAM: 'AF1-ter famille original / avenants', MSG: 'AF1-ter ordre des messages', LNK: 'AF1-ter liens de signature' };
const SIG = (d, extra) => Object.assign({ doc_type: 'devis', doc_id: d.id, statut: 'signe', signed_at: REF.horloge, signer_nom: 'Client Tardif', doc_hash: 'h-' + d.id, token: 't-' + d.id, signature_png: null, signer_ip: null }, extra || {});
/* original accepté → avenant créé et accepté dans l'éditeur v2 → l'original est « remplacé » (prérequis T14b, déjà vérifié) */
const MK = `(async function(){ const o=AD.v2({statut:'accepte',acceptedAt:Date.parse(__REF.horloge)-86400000}); go('tous'); await new Promise(r=>setTimeout(r,120));
  cpDevisAvenant(o.id); await new Promise(r=>setTimeout(r,250)); const a=DEVIS.find(x=>x.avenantDe&&x.avenantDe.id===o.id); if(!a) return null;
  nxd2.statut('accepte'); nxd2.save(); await new Promise(r=>setTimeout(r,150)); nxd2.close(); go('tous'); await new Promise(r=>setTimeout(r,120));
  return {o:o.id,a:a.id,oNum:o.num,aNum:a.num,statutO:(DEVIS.find(x=>x.id===o.id)||{}).statut}; })()`;

/* ---------------- T18 : une signature (ou un refus) en ligne qui arrive APRÈS le remplacement ou l'annulation ne change plus le statut ---------------- */
{
  const r = await p.evaluate(async (args) => {
    const { MK, sig } = args; AD.reset(); if (typeof nxsApplySig !== 'function') return { absent: true };
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    /* a. original remplacé par un avenant accepté, puis le client signe l'ANCIEN lien de l'original */
    const m = await eval(MK); if (!m || m.statutO !== 'remplace') return { prerequis: m && m.statutO };
    const accAvant = DEVIS.filter(x => x.statut === 'accepte').length;
    AD.reset(); const okA = nxsApplySig(Object.assign({}, sig, { doc_id: m.o, doc_hash: 'h-' + m.o, token: 't-' + m.o })); await new Promise(r => setTimeout(r, 100));
    const O = DEVIS.find(x => x.id === m.o), stO = JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === m.o) || {};
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === m.o && x.type === 'signature_ignoree').length;
    const msgsA = __msgs.slice();
    AD.reset(); await facturerDevis(m.o, 'solde'); await new Promise(r => setTimeout(r, 300));
    const ra = { okA, statut: O.statut, stStatut: stO.statut, sig: !!O.signature, attente: !!(O.signatureEnAttente && O.signatureEnAttente.nom === 'Client Tardif'), accAvant, accApres: DEVIS.filter(x => x.statut === 'accepte').length, journal, msgsA, fac: F(m.o), facMsgs: __msgs.slice() };
    /* b. devis annulé (rétractation), puis signature tardive */
    AD.reset(); const n = AD.v2({ statut: 'accepte' }); go('tous'); await new Promise(r => setTimeout(r, 150));
    cpDevisAnnuler(n.id); await new Promise(r => setTimeout(r, 100));
    const radio = document.querySelector('#mAnnulDevis input[name="cpAnnulMotif"][value="retractation"]'); if (radio) radio.checked = true;
    cpDevisAnnulerOk(); await new Promise(r => setTimeout(r, 200));
    if ((DEVIS.find(x => x.id === n.id) || {}).statut !== 'annule') return { prerequis2: (DEVIS.find(x => x.id === n.id) || {}).statut };
    AD.reset(); nxsApplySig(Object.assign({}, sig, { doc_id: n.id, doc_hash: 'h-' + n.id, token: 't-' + n.id })); await new Promise(r => setTimeout(r, 100));
    const N = DEVIS.find(x => x.id === n.id);
    AD.reset(); await facturerDevis(n.id, 'solde'); await new Promise(r => setTimeout(r, 300));
    const rb = { statut: N.statut, annulation: !!(N.annulation && N.annulation.motif === 'retractation'), sig: !!N.signature, attente: !!N.signatureEnAttente, fac: F(n.id) };
    /* c. refus en ligne sur le devis remplacé : rien ne change non plus */
    AD.reset(); nxsApplySig(Object.assign({}, sig, { doc_id: m.o, statut: 'refuse', motif_refus: 'trop tard' })); await new Promise(r => setTimeout(r, 100));
    const O2 = DEVIS.find(x => x.id === m.o);
    return { ra, rb, rc: { statut: O2.statut, refus: !!O2.refus } };
  }, { MK, sig: SIG({ id: 'x' }) });
  if (r.absent || r.prerequis || r.prerequis2) { rec(GC.SIG, 'T18 prérequis (avenant accepté → original remplacé ; annulation)', false, j(r)); r.ra = r.rb = r.rc = {}; }
  rec(GC.SIG, 'T18a original remplacé, signature en ligne tardive : statut « remplacé » inchangé (mémoire et stockage), pas de signature posée, preuve gardée (signatureEnAttente), ligne au journal, message', !!(r.ra.statut === 'remplace' && r.ra.stStatut === 'remplace' && !r.ra.sig && r.ra.attente && r.ra.journal >= 1 && r.ra.msgsA.some(m => /remplacé/i.test(m) && /preuve gardée/i.test(m))), j({ statut: r.ra.statut, stStatut: r.ra.stStatut, sig: r.ra.sig, attente: r.ra.attente, journal: r.ra.journal, msgsA: r.ra.msgsA }));
  rec(GC.SIG, 'T18a l\'original ne redevient pas facturable : « Facturer » refusé, aucune facture, « Chantiers signés » inchangé', !!(!r.ra.fac && r.ra.accApres === r.ra.accAvant && (r.ra.facMsgs || []).some(m => /ne se facture plus/i.test(m))), j({ fac: r.ra.fac, accAvant: r.ra.accAvant, accApres: r.ra.accApres, facMsgs: r.ra.facMsgs }));
  rec(GC.SIG, 'T18b devis annulé, signature en ligne tardive : reste « annulé » (motif gardé), pas de signature posée, preuve gardée, pas facturable', !!(r.rb.statut === 'annule' && r.rb.annulation && !r.rb.sig && r.rb.attente && !r.rb.fac), j(r.rb));
  rec(GC.SIG, 'T18c refus en ligne tardif sur un devis remplacé : rien ne change', !!(r.rc.statut === 'remplace' && !r.rc.refus), j(r.rc));
}

/* ---------------- T19 : jamais deux factures vivantes dans une famille (original + avenants), même après une fusion entre appareils ; deux avenants ---------------- */
{
  const r = await p.evaluate(async (MK) => {
    AD.reset(); if (typeof cpRefusFacture !== 'function' || typeof cpReparerAvenants !== 'function') return { absent: true };
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    const S = id => (DEVIS.find(x => x.id === id) || {}).statut;
    const ST = id => (JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === id) || {}).statut;
    const K = LS.devis;
    /* a. la VRAIE fonction de fusion : base = original accepté (sans avenant) ; cet appareil, pas à jour = original encore accepté + une date de planification ;
          cloud = original remplacé + avenant accepté. « L'appareil actuel gagne » : l'original revient « accepté » à côté de l'avenant accepté. */
    const m = await eval(MK); if (!m || m.statutO !== 'remplace') return { prerequis: m && m.statutO };
    const cloud = JSON.parse(JSON.stringify(DEVIS));
    const base = JSON.parse(JSON.stringify(cloud)).filter(x => x.id !== m.a).map(x => { if (x.id === m.o) { x.statut = 'accepte'; delete x.remplacePar; } return x; });
    const local = JSON.parse(JSON.stringify(base)).map(x => { if (x.id === m.o) x.datePlanif = __REF.jour; return x; });
    const M = cpMerge({ [K]: base }, { [K]: local }, { [K]: cloud })[K];
    const apresFusion = { o: (M.find(x => x.id === m.o) || {}).statut, a: (M.find(x => x.id === m.a) || {}).statut };
    DEVIS.length = 0; M.forEach(x => DEVIS.push(x)); save(K, DEVIS);
    AD.reset(); await facturerDevis(m.o, 'solde'); await new Promise(r => setTimeout(r, 300));
    const a1 = { apresFusion, facO: F(m.o), statutO: S(m.o), stO: ST(m.o), lien: ((DEVIS.find(x => x.id === m.o) || {}).remplacePar || {}).id === m.a, msgs: __msgs.slice() };
    AD.reset(); await facturerDevis(m.a, 'acompte'); await new Promise(r => setTimeout(r, 400));
    const a2 = { facA: F(m.a), msgs: __msgs.slice() };
    /* b. l'original a été facturé sur l'appareil pas à jour (acompte), l'avenant est accepté : l'avenant ne se facture pas */
    AD.reset(); const m2 = await eval(MK); if (!m2) return { absent: true };
    const O2 = DEVIS.find(x => x.id === m2.o); O2.statut = 'accepte'; delete O2.remplacePar; O2.facAcompte = { num: 'TEST-F-' + __REF.an + '-0811', date: __REF.jour, montant: 50, baseTTC: 300, payeLe: null, mode: '' }; save(K, DEVIS);
    AD.reset(); await facturerDevis(m2.a, 'solde'); await new Promise(r => setTimeout(r, 300));
    const b = { facA: F(m2.a), statutO: S(m2.o), statutA: S(m2.a), msgs: __msgs.slice() };
    /* c. deux avenants du même original : le second ne peut pas être accepté tant que le premier l'est ; forcés tous deux « acceptés » (fusion), aucun ne se facture */
    AD.reset(); const m3 = await eval(MK); if (!m3) return { absent: true };
    const O3 = DEVIS.find(x => x.id === m3.o); O3.statut = 'accepte'; delete O3.remplacePar; save(K, DEVIS);   /* comme si cet appareil n'avait pas vu l'avenant accepté */
    cpDevisAvenant(m3.o); await new Promise(r => setTimeout(r, 250)); const b3 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === m3.o && x.id !== m3.a); if (!b3) return { absent: true };
    AD.reset(); nxd2.statut('accepte'); nxd2.save(); await new Promise(r => setTimeout(r, 150)); nxd2.close(); go('tous'); await new Promise(r => setTimeout(r, 120));
    const c1 = { statutB: S(b3.id), msgs: __msgs.slice() };
    AD.reset(); nxSetStatut(b3.id, 'accepte'); await new Promise(r => setTimeout(r, 120));
    const c1b = { statutB: S(b3.id), msgs: __msgs.slice() };
    const B = DEVIS.find(x => x.id === b3.id); B.statut = 'accepte'; save(K, DEVIS);   /* forcé, comme après une fusion */
    AD.reset(); await facturerDevis(m3.a, 'solde'); await new Promise(r => setTimeout(r, 300)); const mA = __msgs.slice();
    AD.reset(); await facturerDevis(b3.id, 'solde'); await new Promise(r => setTimeout(r, 300)); const mB = __msgs.slice();
    const c2 = { facA: F(m3.a), facB: F(b3.id), mA, mB, repare: cpReparerAvenants(), statutO: S(m3.o) };
    /* d. témoin : un avenant accepté dont l'original est remplacé se facture normalement ; réparation au démarrage d'un original revenu « accepté » */
    AD.reset(); const m4 = await eval(MK); if (!m4) return { absent: true };
    AD.reset(); await facturerDevis(m4.a, 'acompte'); await new Promise(r => setTimeout(r, 400));
    const d1 = { facA: F(m4.a), statutO: S(m4.o), msgs: __msgs.slice() };
    AD.reset(); const m5 = await eval(MK); if (!m5) return { absent: true };
    const O5 = DEVIS.find(x => x.id === m5.o); O5.statut = 'accepte'; delete O5.remplacePar; save(K, DEVIS);
    const n5 = cpReparerAvenants();
    const d2 = { n5, statutO: S(m5.o), stO: ST(m5.o), lien: ((DEVIS.find(x => x.id === m5.o) || {}).remplacePar || {}).id === m5.a, journal: JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === m5.o && x.action === 'reparation_demarrage').length, m5 };
    return { a1, a2, b, c1, c1b, c2, d1, d2 };
  }, MK);
  if (r.absent || r.prerequis) { rec(GC.FAM, 'T19 prérequis (fonctions cpRefusFacture / cpReparerAvenants ; avenant accepté → original remplacé)', false, j(r)); r.a1 = r.a2 = r.b = r.c1 = r.c1b = r.c2 = r.d1 = r.d2 = {}; }
  rec(GC.FAM, 'T19a fusion (cpMerge) sur l\'appareil pas à jour : l\'original revient « accepté » à côté de l\'avenant accepté (défaut D1 reproduit)', !!(r.a1.apresFusion && r.a1.apresFusion.o === 'accepte' && r.a1.apresFusion.a === 'accepte'), j(r.a1.apresFusion));
  rec(GC.FAM, 'T19a après la fusion, « Facturer » l\'original : refusé, aucune facture, et l\'original repasse « remplacé » (mémoire et stockage, lien vers l\'avenant)', !!(!r.a1.facO && r.a1.statutO === 'remplace' && r.a1.stO === 'remplace' && r.a1.lien && (r.a1.msgs || []).some(m => /ne se facture plus/i.test(m) && /autre appareil/i.test(m))), j({ facO: r.a1.facO, statutO: r.a1.statutO, stO: r.a1.stO, lien: r.a1.lien, msgs: r.a1.msgs }));
  rec(GC.FAM, 'T19a l\'avenant, lui, se facture (acompte d\'essai)', !!(r.a2.facA === true), j(r.a2));
  rec(GC.FAM, 'T19b original facturé sur l\'appareil pas à jour + avenant accepté : facturer l\'avenant refusé (« jamais deux factures pour le même chantier »), aucune facture', !!(!r.b.facA && (r.b.msgs || []).some(m => /jamais deux factures/i.test(m) && /avoir/i.test(m))), j(r.b));
  rec(GC.FAM, 'T19c deuxième avenant du même original : « Accepté » refusé tant que le premier est accepté (éditeur et liste), message clair', !!(r.c1.statutB !== 'accepte' && (r.c1.msgs || []).some(m => /autre avenant/i.test(m)) && r.c1b.statutB !== 'accepte' && (r.c1b.msgs || []).some(m => /autre avenant/i.test(m))), j({ c1: r.c1, c1b: r.c1b }));
  rec(GC.FAM, 'T19c deux avenants forcés « acceptés » (fusion) : aucun des deux ne se facture (« annule l\'un des deux »), la réparation ne tranche pas', !!(!r.c2.facA && !r.c2.facB && (r.c2.mA || []).some(m => /Deux avenants/i.test(m)) && (r.c2.mB || []).some(m => /Deux avenants/i.test(m)) && r.c2.repare === 0 && r.c2.statutO === 'accepte'), j(r.c2));
  rec(GC.FAM, 'Témoin : un avenant accepté dont l\'original est remplacé se facture normalement', !!(r.d1.facA === true && r.d1.statutO === 'remplace'), j(r.d1));
  rec(GC.FAM, 'T19d réparation au démarrage (cpReparerAvenants) : un original revenu « accepté » sans facture, avenant accepté → « remplacé » (mémoire et stockage), ligne au journal', !!(r.d2.n5 === 1 && r.d2.statutO === 'remplace' && r.d2.stO === 'remplace' && r.d2.lien && r.d2.journal >= 1), j({ n5: r.d2.n5, statutO: r.d2.statutO, stO: r.d2.stO, lien: r.d2.lien, journal: r.d2.journal }));
}

/* ---------------- T19e : la réparation tourne bien au DÉMARRAGE (rechargement de la page) ---------------- */
{
  const avant = await p.evaluate(async (MK) => {
    AD.reset(); const m = await eval(MK); if (!m) return null;
    const O = DEVIS.find(x => x.id === m.o); O.statut = 'accepte'; delete O.remplacePar; save(LS.devis, DEVIS);
    return { o: m.o, a: m.a, statut: (JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === m.o) || {}).statut };
  }, MK);
  await p.reload(); await p.waitForTimeout(2500); await p.evaluate(PREP);
  const apres = await p.evaluate((ids) => { const o = DEVIS.find(x => x.id === ids.o) || {}; return { statut: o.statut, lien: (o.remplacePar || {}).id === ids.a, st: (JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === ids.o) || {}).statut }; }, avant || { o: '', a: '' });
  rec(GC.FAM, 'T19e au rechargement de l\'appli : l\'original revenu « accepté » (stockage) repasse « remplacé par l\'avenant » (mémoire et stockage)', !!(!!avant && avant.statut === 'accepte' && apres.statut === 'remplace' && apres.st === 'remplace' && apres.lien), j({ avant, apres }));
}

/* ---------------- T20 : en démonstration, le refus « ne se facture plus » est le PREMIER message (avant « Document de TEST émis sans … ») ---------------- */
{
  const r = await p.evaluate(async (MK) => {
    AD.reset(); const m = await eval(MK); if (!m || m.statutO !== 'remplace') return { prerequis: m && m.statutO };
    /* entreprise sans assurance ni attestation : c'est ce qui déclenche « ⚠ Document de TEST émis sans … » en démonstration */
    const ov = load(LS.over, {}) || {}; const ent0 = ov.entreprise === undefined ? undefined : JSON.parse(JSON.stringify(ov.entreprise)); const ent = Object.assign({}, ov.entreprise || {});
    ['assurance', 'assuranceZone', 'attFluides', 'attOrganisme'].forEach(k => { delete ent[k]; }); ov.entreprise = ent; save(LS.over, ov); rebuildP();
    const assurance = (P.entreprise || {}).assurance || '';
    AD.reset(); await facturerDevis(m.o, 'solde'); await new Promise(r => setTimeout(r, 400));
    const msgs = __msgs.slice();
    /* témoin : sur l'avenant (facturable), l'avertissement de TEST apparaît bien dans cette configuration */
    AD.reset(); await facturerDevis(m.a, 'acompte'); await new Promise(r => setTimeout(r, 500));
    const temoin = __msgs.slice();
    if (ent0 === undefined) delete ov.entreprise; else ov.entreprise = ent0; save(LS.over, ov); rebuildP();
    return { msgs, temoin, assurance, fac: !!((DEVIS.find(x => x.id === m.o) || {}).facSolde) };
  }, MK);
  if (r.prerequis) { rec(GC.MSG, 'T20 prérequis', false, j(r)); r.msgs = r.temoin = []; }
  rec(GC.MSG, 'T20 devis remplacé, « Facturer » en démonstration : le premier message est le refus « ne se facture plus », et aucun « Document de TEST émis » n\'est affiché', !!((r.msgs || []).length >= 1 && /ne se facture plus/i.test(r.msgs[0]) && !(r.msgs || []).some(m => /Document de TEST émis/.test(m)) && !r.fac), j({ msgs: r.msgs, fac: r.fac }));
  rec(GC.MSG, 'Témoin : dans la même configuration, un devis facturable affiche bien l\'avertissement « Document de TEST émis sans … »', !!((r.temoin || []).some(m => /Document de TEST émis/.test(m))), j({ temoin: (r.temoin || []).slice(0, 4) }));
}

/* ---------------- T21 : remplacement ou annulation → les liens de signature en attente du devis sont désactivés (fonction du module signature appelée) ---------------- */
{
  const r = await p.evaluate(async (MK) => {
    AD.reset(); const appels = []; const sauve = window.nxsDesactiverLiens; window.nxsDesactiverLiens = function (t, id, raison) { appels.push({ t, id, raison }); return Promise.resolve(0); };
    try {
      const m = await eval(MK); if (!m) return { absent: true };
      const a = appels.slice();
      const n = AD.v2({ statut: 'accepte' }); go('tous'); await new Promise(r => setTimeout(r, 150));
      cpDevisAnnuler(n.id); await new Promise(r => setTimeout(r, 100));
      const radio = document.querySelector('#mAnnulDevis input[name="cpAnnulMotif"][value="abandon"]'); if (radio) radio.checked = true;
      cpDevisAnnulerOk(); await new Promise(r => setTimeout(r, 200));
      return { fonction: typeof sauve === 'function', remplace: a.some(x => x.t === 'devis' && x.id === m.o && x.raison === 'remplace'), annule: appels.some(x => x.t === 'devis' && x.id === n.id && x.raison === 'annule'), appels };
    } finally { window.nxsDesactiverLiens = sauve; }
  }, MK);
  rec(GC.LNK, 'T21 le module signature expose nxsDesactiverLiens ; il est appelé pour l\'original quand l\'avenant est accepté (raison « remplace ») et pour un devis annulé (raison « annule »)', !!(!r.absent && r.fonction && r.remplace && r.annule), j(r));
}

/* ================= AF1-quater (relecture indépendante du 04/11/2026, soir) : T22 chaîne d'avenants (avenant d'avenant) + fusion entre appareils,
   T23 deuxième avenant signé EN LIGNE, T24 liens de signature mis en attente au démarrage ================= */
const GQ = { ARB: 'AF1-quater arbre des avenants', SIG2: 'AF1-quater 2e avenant signé en ligne', LNK2: 'AF1-quater liens de signature au démarrage' };
/* chaîne O → A1 → A2 : original accepté ; A1 avenant de O, accepté (O remplacé) ; A2 avenant de A1 (le chemin que l'appli conseille), accepté (A1 remplacé) */
const MK3 = `(async function(){ const W=ms=>new Promise(r=>setTimeout(r,ms)); const o=AD.v2({statut:'accepte',acceptedAt:Date.parse(__REF.horloge)-86400000}); go('tous'); await W(120);
  cpDevisAvenant(o.id); await W(250); const a1=DEVIS.find(x=>x.avenantDe&&x.avenantDe.id===o.id); if(!a1) return null;
  nxd2.statut('accepte'); nxd2.save(); await W(150); nxd2.close(); go('tous'); await W(120);
  cpDevisAvenant(a1.id); await W(250); const a2=DEVIS.find(x=>x.avenantDe&&x.avenantDe.id===a1.id); if(!a2) return null;
  nxd2.statut('accepte'); nxd2.save(); await W(150); nxd2.close(); go('tous'); await W(120);
  const S=id=>(DEVIS.find(x=>x.id===id)||{}).statut;
  return {o:o.id,a1:a1.id,a2:a2.id,oNum:o.num,a1Num:a1.num,a2Num:a2.num,st:{o:S(o.id),a1:S(a1.id),a2:S(a2.id)},lienO:((DEVIS.find(x=>x.id===o.id)||{}).remplacePar||{}).id,lienA1:((DEVIS.find(x=>x.id===a1.id)||{}).remplacePar||{}).id}; })()`;

/* ---------------- T22 : chaîne d'avenants O → A1 → A2 ; après une fusion entre appareils, O revient « accepté » : jamais deux factures, réparation ---------------- */
{
  const r = await p.evaluate(async (MK3) => {
    AD.reset(); if (typeof cpRefusFacture !== 'function' || typeof cpReparerAvenants !== 'function') return { absent: true };
    const W = ms => new Promise(r => setTimeout(r, ms));
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    const S = id => (DEVIS.find(x => x.id === id) || {}).statut;
    const ST = id => (JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === id) || {}).statut;
    const L = id => ((DEVIS.find(x => x.id === id) || {}).remplacePar || {}).id;
    const K = LS.devis;
    /* prérequis : la chaîne se construit (O remplacé par A1, A1 remplacé par A2, A2 accepté) */
    const m = await eval(MK3); if (!m || m.st.o !== 'remplace' || m.st.a1 !== 'remplace' || m.st.a2 !== 'accepte' || m.lienO !== m.a1 || m.lienA1 !== m.a2) return { prerequis: m };
    /* a. VRAIE fusion : base = O accepté seul (avant tout avenant) ; cet appareil, pas à jour = O accepté + date de planification ; cloud = la chaîne.
          « L'appareil actuel gagne » : O revient « accepté » à côté de A1 (remplacé) et A2 (accepté) — le cas c2 de la relecture */
    const cloud = JSON.parse(JSON.stringify(DEVIS));
    const base = JSON.parse(JSON.stringify(cloud)).filter(x => x.id !== m.a1 && x.id !== m.a2).map(x => { if (x.id === m.o) { x.statut = 'accepte'; delete x.remplacePar; } return x; });
    const local = JSON.parse(JSON.stringify(base)).map(x => { if (x.id === m.o) x.datePlanif = __REF.jour; return x; });
    const fusion = cpMerge({ [K]: base }, { [K]: local }, { [K]: cloud })[K];
    const poser = () => { DEVIS.length = 0; JSON.parse(JSON.stringify(fusion)).forEach(x => DEVIS.push(x)); save(K, DEVIS); };
    poser();
    const apresFusion = { o: S(m.o), a1: S(m.a1), a2: S(m.a2) };
    /* a1. la réparation (démarrage) remet O « remplacé par A1 » */
    const nRep = cpReparerAvenants();
    const rep = { nRep, statutO: S(m.o), stO: ST(m.o), lienO: L(m.o), statutA1: S(m.a1), statutA2: S(m.a2) };
    /* a2. même état fusionné, sans réparation : « Facturer » O est refusé (et O repasse remplacé) ; « Facturer » A2 émet : UNE seule facture dans l'arbre */
    poser(); AD.reset(); await facturerDevis(m.o, 'solde'); await W(300);
    const facO = { fac: F(m.o), statutO: S(m.o), stO: ST(m.o), lienO: L(m.o), msgs: __msgs.slice() };
    AD.reset(); await facturerDevis(m.a2, 'acompte'); await W(400);
    const facA2 = { fac: F(m.a2), nbFactures: [m.o, m.a1, m.a2].filter(F).length, msgs: __msgs.slice() };
    /* b. O facturé sur l'appareil pas à jour (acompte) + A2 accepté : « Facturer » A2 refusé (le cas c3 de la relecture) */
    AD.reset(); const m2 = await eval(MK3); if (!m2) return { absent: true };
    const O2 = DEVIS.find(x => x.id === m2.o); O2.statut = 'accepte'; delete O2.remplacePar; O2.facAcompte = { num: 'TEST-F-' + __REF.an + '-0812', date: __REF.jour, montant: 50, baseTTC: 300, payeLe: null, mode: '' }; save(K, DEVIS);
    AD.reset(); await facturerDevis(m2.a2, 'solde'); await W(300);
    const b = { facA2: F(m2.a2), msgs: __msgs.slice() };
    /* c. un 2e avenant DIRECT de O (créé pendant que O était accepté) ne passe pas « Accepté » tant que A2 (petit-fils) est accepté ; forcé : aucun des deux ne se facture, pas de réparation */
    AD.reset(); const m3 = await eval(MK3); if (!m3) return { absent: true };
    const O3 = DEVIS.find(x => x.id === m3.o); O3.statut = 'accepte'; delete O3.remplacePar; save(K, DEVIS);   /* comme si cet appareil n'avait pas vu les avenants */
    cpDevisAvenant(m3.o); await W(250); const b1 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === m3.o && x.id !== m3.a1); if (!b1) return { absent: true };
    nxd2.close(); go('tous'); await W(120);
    AD.reset(); nxSetStatut(b1.id, 'accepte'); await W(120);
    const c1 = { statutB1: S(b1.id), msgs: __msgs.slice() };
    const B1 = DEVIS.find(x => x.id === b1.id); B1.statut = 'accepte'; save(K, DEVIS);   /* forcé, comme après une fusion */
    const nRep3 = cpReparerAvenants();
    AD.reset(); await facturerDevis(m3.a2, 'solde'); await W(300); const mA2 = __msgs.slice();
    AD.reset(); await facturerDevis(b1.id, 'solde'); await W(300); const mB1 = __msgs.slice();
    const c2 = { nRep3, facA2: F(m3.a2), facB1: F(b1.id), mA2, mB1 };
    /* d. témoin : la chaîne intacte, A2 se facture normalement ; O et A1 restent remplacés */
    AD.reset(); const m4 = await eval(MK3); if (!m4) return { absent: true };
    AD.reset(); await facturerDevis(m4.a2, 'acompte'); await W(400);
    const d = { facA2: F(m4.a2), statutO: S(m4.o), statutA1: S(m4.a1), msgs: __msgs.slice() };
    return { apresFusion, rep, facO, facA2, b, c1, c2, d, m };
  }, MK3);
  if (r.absent || r.prerequis) { rec(GQ.ARB, 'T22 prérequis (chaîne O → A1 → A2 : O remplacé par A1, A1 remplacé par A2, A2 accepté)', false, j(r)); r.apresFusion = r.rep = r.facO = r.facA2 = r.b = r.c1 = r.c2 = r.d = {}; }
  rec(GQ.ARB, 'T22a fusion (cpMerge) sur l\'appareil pas à jour : O revient « accepté », A1 reste « remplacé », A2 « accepté » (défaut D1 reproduit sur une chaîne)', !!(r.apresFusion.o === 'accepte' && r.apresFusion.a1 === 'remplace' && r.apresFusion.a2 === 'accepte'), j(r.apresFusion));
  rec(GQ.ARB, 'T22a réparation (cpReparerAvenants) : O repasse « remplacé par A1 » (mémoire et stockage), A1 et A2 inchangés', !!(r.rep.nRep === 1 && r.rep.statutO === 'remplace' && r.rep.stO === 'remplace' && r.rep.lienO === (r.m || {}).a1 && r.rep.statutA1 === 'remplace' && r.rep.statutA2 === 'accepte'), j(r.rep));
  rec(GQ.ARB, 'T22a sans réparation, « Facturer » O : refusé (« ne se facture plus »), aucune facture, O repasse « remplacé par A1 »', !!(!r.facO.fac && r.facO.statutO === 'remplace' && r.facO.stO === 'remplace' && r.facO.lienO === (r.m || {}).a1 && (r.facO.msgs || []).some(x => /ne se facture plus/i.test(x) && /autre appareil/i.test(x))), j(r.facO));
  rec(GQ.ARB, 'T22a puis « Facturer » A2 : émis — une seule facture dans tout l\'arbre O / A1 / A2', !!(r.facA2.fac === true && r.facA2.nbFactures === 1), j(r.facA2));
  rec(GQ.ARB, 'T22b O facturé sur l\'appareil pas à jour + A2 accepté : « Facturer » A2 refusé (« jamais deux factures pour le même chantier »)', !!(!r.b.facA2 && (r.b.msgs || []).some(x => /jamais deux factures/i.test(x) && /avoir/i.test(x))), j(r.b));
  rec(GQ.ARB, 'T22c 2e avenant direct de O alors que le petit-fils A2 est accepté : « Accepté » refusé (« autre avenant ») ; forcé : aucun des deux ne se facture (« Deux avenants »), la réparation ne tranche pas', !!(r.c1.statutB1 !== 'accepte' && (r.c1.msgs || []).some(x => /autre avenant/i.test(x)) && r.c2.nRep3 === 0 && !r.c2.facA2 && !r.c2.facB1 && (r.c2.mA2 || []).some(x => /Deux avenants/i.test(x)) && (r.c2.mB1 || []).some(x => /Deux avenants/i.test(x))), j({ c1: r.c1, c2: r.c2 }));
  rec(GQ.ARB, 'Témoin : chaîne intacte, A2 se facture normalement, O et A1 restent « remplacés »', !!(r.d.facA2 === true && r.d.statutO === 'remplace' && r.d.statutA1 === 'remplace'), j(r.d));
}

/* ---------------- T22e : la réparation d'une chaîne tourne au DÉMARRAGE (rechargement) ---------------- */
{
  const avant = await p.evaluate(async (MK3) => {
    AD.reset(); const m = await eval(MK3); if (!m) return null;
    const O = DEVIS.find(x => x.id === m.o); O.statut = 'accepte'; delete O.remplacePar; save(LS.devis, DEVIS);
    return { o: m.o, a1: m.a1, a2: m.a2, statut: (JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === m.o) || {}).statut };
  }, MK3);
  await p.reload(); await p.waitForTimeout(2500); await p.evaluate(PREP);
  const apres = await p.evaluate((ids) => { const g = id => DEVIS.find(x => x.id === id) || {}; const st = id => (JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === id) || {}).statut;
    return { o: g(ids.o).statut, stO: st(ids.o), lienO: (g(ids.o).remplacePar || {}).id === ids.a1, a1: g(ids.a1).statut, a2: g(ids.a2).statut }; }, avant || { o: '', a1: '', a2: '' });
  rec(GQ.ARB, 'T22e au rechargement : O revenu « accepté » (stockage) au-dessus de la chaîne A1 (remplacé) → A2 (accepté) repasse « remplacé par A1 »', !!(!!avant && avant.statut === 'accepte' && apres.o === 'remplace' && apres.stO === 'remplace' && apres.lienO && apres.a1 === 'remplace' && apres.a2 === 'accepte'), j({ avant, apres }));
}

/* ---------------- T23 : un 2e avenant signé EN LIGNE alors qu'un autre avenant du même devis est déjà accepté : statut inchangé, preuve gardée ---------------- */
{
  const r = await p.evaluate(async (sig) => {
    AD.reset(); if (typeof nxsApplySig !== 'function') return { absent: true };
    const W = ms => new Promise(r => setTimeout(r, ms));
    const S = id => (DEVIS.find(x => x.id === id) || {}).statut;
    /* O accepté ; deux avenants directs créés pendant que O est accepté ; A1 accepté (liste) → O remplacé par A1 ; B1 reste « envoyé » */
    const o = AD.v2({ statut: 'accepte', acceptedAt: Date.parse(__REF.horloge) - 86400000 }); go('tous'); await W(120);
    cpDevisAvenant(o.id); await W(250); const a1 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === o.id); if (!a1) return { absent: true }; nxd2.close(); go('tous'); await W(120);
    cpDevisAvenant(o.id); await W(250); const b1 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === o.id && x.id !== a1.id); if (!b1) return { absent: true }; nxd2.close(); go('tous'); await W(120);
    nxSetStatut(b1.id, 'envoye'); nxSetStatut(a1.id, 'accepte'); await W(150);
    if (S(o.id) !== 'remplace' || S(a1.id) !== 'accepte' || ((DEVIS.find(x => x.id === o.id) || {}).remplacePar || {}).id !== a1.id) return { prerequis: { o: S(o.id), a1: S(a1.id) } };
    /* le client signe EN LIGNE le lien de B1 (envoyé avant que A1 soit accepté) */
    AD.reset(); const ok = nxsApplySig(Object.assign({}, sig, { doc_id: b1.id, doc_hash: 'h-' + b1.id, token: 't-' + b1.id })); await W(150);
    const B = DEVIS.find(x => x.id === b1.id), O = DEVIS.find(x => x.id === o.id), stB = JSON.parse(localStorage.getItem(LS.devis) || '[]').find(x => x.id === b1.id) || {};
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === b1.id && x.type === 'avenant_refuse' && x.motif === 'autre_avenant').length;
    const apresSig = { ok, statutB: B.statut, stStatutB: stB.statut, sigB: !!B.signature, attenteB: !!(B.signatureEnAttente && B.signatureEnAttente.nom === 'Client Tardif'), lienO: (O.remplacePar || {}).id === a1.id, statutA1: S(a1.id), journal, msgs: __msgs.slice() };
    /* ensuite, A1 annulé (erreur de saisie) : B1 peut passer « Accepté », la signature gardée est posée, O pointe vers B1 */
    AD.reset(); cpDevisAnnuler(a1.id); await W(100);
    const radio = document.querySelector('#mAnnulDevis input[name="cpAnnulMotif"][value="erreur"]'); if (radio) radio.checked = true; cpDevisAnnulerOk(); await W(200);
    AD.reset(); nxSetStatut(b1.id, 'accepte'); await W(150);
    const B2 = DEVIS.find(x => x.id === b1.id), O2 = DEVIS.find(x => x.id === o.id);
    const apresAnnul = { statutA1: S(a1.id), statutB: B2.statut, sigB: !!(B2.signature && B2.signature.nom === 'Client Tardif'), attenteB: !!B2.signatureEnAttente, lienO: (O2.remplacePar || {}).id === b1.id, statutO: O2.statut };
    return { apresSig, apresAnnul };
  }, SIG({ id: 'x' }));
  if (r.absent || r.prerequis) { rec(GQ.SIG2, 'T23 prérequis (deux avenants directs ; A1 accepté par la liste → O remplacé)', false, j(r)); r.apresSig = r.apresAnnul = {}; }
  rec(GQ.SIG2, 'T23 B1 signé en ligne alors que A1 est accepté : B1 ne passe pas « accepté » (mémoire et stockage), preuve gardée (signatureEnAttente), O reste « remplacé par A1 », ligne au journal, message', !!(r.apresSig.statutB && r.apresSig.statutB !== 'accepte' && r.apresSig.stStatutB !== 'accepte' && !r.apresSig.sigB && r.apresSig.attenteB && r.apresSig.lienO && r.apresSig.statutA1 === 'accepte' && r.apresSig.journal >= 1 && (r.apresSig.msgs || []).some(x => /autre avenant/i.test(x) && /conservée|gardée/i.test(x))), j(r.apresSig));
  rec(GQ.SIG2, 'T23 après annulation de A1 : B1 passe « Accepté », la signature gardée est posée, O pointe vers B1', !!(r.apresAnnul.statutA1 === 'annule' && r.apresAnnul.statutB === 'accepte' && r.apresAnnul.sigB && !r.apresAnnul.attenteB && r.apresAnnul.lienO && r.apresAnnul.statutO === 'remplace'), j(r.apresAnnul));
}

/* ---------------- T24 : la réparation au démarrage tourne AVANT le module signature : les liens à désactiver sont mis en attente, puis traités ---------------- */
{
  const r = await p.evaluate(async (MK) => {
    AD.reset(); const sauve = window.nxsDesactiverLiens, vider = window.nxsViderLiensEnAttente; const appels = [];
    try {
      const m = await eval(MK); if (!m) return { absent: true };
      const O = DEVIS.find(x => x.id === m.o); O.statut = 'accepte'; delete O.remplacePar; save(LS.devis, DEVIS);
      if (Array.isArray(window.cpLiensADesactiver)) window.cpLiensADesactiver.length = 0;   /* file vidée (le rechargement de T22e y a laissé la demande de son original : sans cloud, rien ne la traite) */
      delete window.nxsDesactiverLiens;   /* comme au démarrage : index.html a tourné, next-signature.js pas encore */
      const n = cpReparerAvenants();
      const file = Array.isArray(window.cpLiensADesactiver) ? window.cpLiensADesactiver.slice() : null;
      window.nxsDesactiverLiens = function (t, id, raison) { appels.push({ t, id, raison }); return Promise.resolve(0); };
      const vides = (typeof vider === 'function') ? vider() : null;
      return { n, file, vides, appels, reste: Array.isArray(window.cpLiensADesactiver) ? window.cpLiensADesactiver.length : null, o: m.o };
    } finally { window.nxsDesactiverLiens = sauve; }
  }, MK);
  rec(GQ.LNK2, 'T24 réparation sans module signature : le lien à désactiver est mis en attente (cpLiensADesactiver), puis nxsViderLiensEnAttente le traite (appel « remplace » pour l\'original), file vidée', !!(!r.absent && r.n === 1 && Array.isArray(r.file) && r.file.some(x => x[0] === 'devis' && x[1] === r.o && x[2] === 'remplace') && r.vides === 1 && r.appels.some(x => x.t === 'devis' && x.id === r.o && x.raison === 'remplace') && r.reste === 0), j(r));
}

/* ================= AF1-5 (essai dans le navigateur du 04/11/2026, soir) : T25 le bandeau 🔒 d'un devis verrouillé ne doit pas rester affiché
   quand l'éditeur passe à un autre devis non verrouillé (« Dupliquer » depuis le bandeau, ou ouverture d'un brouillon depuis la liste) ================= */
{
  const r = await p.evaluate(async () => {
    AD.reset(); const W = ms => new Promise(r => setTimeout(r, ms));
    const ban = () => { const b = document.getElementById('nxd2Banner'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; };
    /* boutons de statut (onglet Récapitulatif) : {total, actifs} */
    const libres = async () => { nxd2.tab('recap'); await W(250); const bs = [...document.querySelectorAll('#v-nx_devis2 .nxd2-seg button')].filter(b => b.offsetParent !== null); return { total: bs.length, actifs: bs.filter(b => !b.disabled).length }; };
    /* un devis accepté (verrouillé) ouvert dans l'éditeur v2 : bandeau 🔒 attendu */
    const o = AD.v2({ statut: 'accepte', acceptedAt: Date.parse(__REF.horloge) - 86400000 }); go('tous'); await W(120);
    openDevis(o.id); await W(500);
    const banO = ban(), libresO = await libres();
    /* a. « Dupliquer » depuis le bandeau : le brouillon s'ouvre, le bandeau de l'original ne doit plus être là */
    const n0 = DEVIS.length; cpDevisDupliquer(o.id); await W(600);
    const dup = DEVIS[DEVIS.length - 1];
    const a = { cree: DEVIS.length === n0 + 1 && dup.id !== o.id, cur: (typeof cur !== 'undefined' && cur) ? cur.id : null, statut: dup.statut, bandeau: ban(), libres: await libres() };
    /* b. depuis la liste : ouvrir un verrouillé, puis un brouillon */
    nxd2.close(); go('tous'); await W(150); openDevis(o.id); await W(400); const banO2 = ban();
    nxd2.close(); go('tous'); await W(150); openDevis(dup.id); await W(500);
    const b = { cur: (typeof cur !== 'undefined' && cur) ? cur.id : null, bandeau: ban(), libres: await libres(), banO2 };
    nxd2.close(); go('tous'); await W(100);
    return { o: o.id, oNum: o.num, banO, libresO, dup: dup.id, a, b };
  });
  rec('AF1-5 bandeau de l\'éditeur', 'Témoin : un devis accepté ouvert dans l\'éditeur porte le bandeau « il ne se modifie plus » et ses boutons de statut sont grisés', !!(/ne se modifie plus/.test(r.banO) && r.banO.includes(r.oNum) && r.libresO.total >= 4 && r.libresO.actifs === 0), j({ banO: r.banO, libresO: r.libresO }));
  rec('AF1-5 bandeau de l\'éditeur', 'T25a « Dupliquer » depuis le bandeau d\'un devis verrouillé : le brouillon s\'ouvre SANS le bandeau 🔒 de l\'original, ses boutons de statut sont actifs', !!(r.a.cree && r.a.cur === r.dup && r.a.statut === 'brouillon' && !/ne se modifie plus/.test(r.a.bandeau) && !r.a.bandeau.includes(r.oNum) && r.a.libres.total >= 4 && r.a.libres.actifs === r.a.libres.total), j(r.a));
  rec('AF1-5 bandeau de l\'éditeur', 'T25b depuis la liste : un verrouillé puis un brouillon → le brouillon n\'hérite pas du bandeau 🔒', !!(/ne se modifie plus/.test(r.b.banO2) && r.b.cur === r.dup && !/ne se modifie plus/.test(r.b.bandeau) && !r.b.bandeau.includes(r.oNum) && r.b.libres.total >= 4 && r.b.libres.actifs === r.b.libres.total), j(r.b));
}

/* ================= AF1-5 bis (constats mineurs de la relecture d'AF1-quater, 04/11/2026 soir) : T26 messages de refus (original déjà facturé ;
   chaîne à plusieurs ancêtres revenus « acceptés »), T27 deux branches acceptées (pas de réécriture de « remplacé par »), T28 file des liens gardée en cas d'erreur ================= */
const GQ2 = { MSG: 'AF1-5 messages de refus', BR: 'AF1-5 deux branches', LNK: 'AF1-5 file des liens' };
{
  const r = await p.evaluate(async (MK3) => {
    AD.reset(); if (typeof cpRefusFacture !== 'function') return { absent: true };
    const W = ms => new Promise(r => setTimeout(r, ms));
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    const S = id => (DEVIS.find(x => x.id === id) || {}).statut;
    const L = id => ((DEVIS.find(x => x.id === id) || {}).remplacePar || {}).id;
    const K = LS.devis;
    /* a. O porte un acompte (appareil pas à jour) et A2 est accepté : « Facturer » le solde de O doit dire « avoir ou annule l'avenant », pas « remplacé … facture l'avenant » */
    const m = await eval(MK3); if (!m || m.st.a2 !== 'accepte') return { prerequis: m };
    const O = DEVIS.find(x => x.id === m.o); O.statut = 'accepte'; delete O.remplacePar; O.facAcompte = { num: 'TEST-F-' + __REF.an + '-0813', date: __REF.jour, montant: 50, baseTTC: 300, payeLe: null, mode: '' }; save(K, DEVIS);
    AD.reset(); await facturerDevis(m.o, 'solde'); await W(300);
    const a = { facSolde: !!(DEVIS.find(x => x.id === m.o) || {}).facSolde, statutO: S(m.o), lienO: L(m.o), msgs: __msgs.slice() };
    AD.reset(); await facturerDevis(m.a2, 'solde'); await W(300);
    const a2 = { fac: F(m.a2), msgs: __msgs.slice() };
    /* b. chaîne O → A1 → A2 → A3 ; O, A1 et A2 revenus « acceptés » : le refus de O nomme A3 (le dernier accepté) et répare O vers A1 ; puis A3 se facture seul */
    AD.reset(); const m2 = await eval(MK3); if (!m2) return { absent: true };
    go('tous'); await W(120); cpDevisAvenant(m2.a2); await W(250); const a3 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === m2.a2); if (!a3) return { absent: true };
    nxd2.statut('accepte'); nxd2.save(); await W(150); nxd2.close(); go('tous'); await W(120);
    [m2.o, m2.a1, m2.a2].forEach(id => { const x = DEVIS.find(y => y.id === id); x.statut = 'accepte'; delete x.remplacePar; }); save(K, DEVIS);
    AD.reset(); await facturerDevis(m2.o, 'solde'); await W(300);
    const b = { facO: F(m2.o), statutO: S(m2.o), lienO: L(m2.o), nommeA3: __msgs.some(x => x.includes(a3.num)), nommeA1Seul: __msgs.some(x => /Facture l'avenant\.?$/.test(x.trim()) && !x.includes(a3.num)), msgs: __msgs.slice() };
    AD.reset(); await facturerDevis(a3.id, 'acompte'); await W(400);
    const b2 = { facA3: F(a3.id), nbFactures: [m2.o, m2.a1, m2.a2, a3.id].filter(F).length, statutA1: S(m2.a1), statutA2: S(m2.a2), lienA1: L(m2.a1) === m2.a2, lienA2: L(m2.a2) === a3.id };
    return { a, a2, b, b2, m, m2, a3: a3.id };
  }, MK3);
  if (r.absent || r.prerequis) { rec(GQ2.MSG, 'T26 prérequis (chaîne O → A1 → A2)', false, j(r)); r.a = r.a2 = r.b = r.b2 = {}; }
  rec(GQ2.MSG, 'T26a original déjà facturé (acompte) + avenant accepté ailleurs : « Facturer » le solde de l\'original refusé avec « avoir … ou annule l\'avenant », sans dire « remplacé … facture l\'avenant », original inchangé', !!(!r.a.facSolde && r.a.statutO === 'accepte' && !r.a.lienO && (r.a.msgs || []).some(x => /avoir/i.test(x) && /annule l'avenant/i.test(x)) && !(r.a.msgs || []).some(x => /ne se facture plus/i.test(x))), j(r.a));
  rec(GQ2.MSG, 'Témoin : dans ce cas, « Facturer » l\'avenant reste refusé (« jamais deux factures … avoir »)', !!(!r.a2.fac && (r.a2.msgs || []).some(x => /jamais deux factures/i.test(x))), j(r.a2));
  rec(GQ2.MSG, 'T26b chaîne O → A1 → A2 → A3 avec O, A1, A2 revenus « acceptés » : le refus de O nomme A3 (le dernier accepté) et répare O vers A1', !!(!r.b.facO && r.b.statutO === 'remplace' && r.b.lienO === (r.m2 || {}).a1 && r.b.nommeA3), j({ statutO: r.b.statutO, lienOk: r.b.lienO === (r.m2 || {}).a1, nommeA3: r.b.nommeA3, msgs: r.b.msgs }));
  rec(GQ2.MSG, 'T26b puis « Facturer » A3 : émis, une seule facture dans l\'arbre, A1 et A2 réparés vers leur avenant direct', !!(r.b2.facA3 === true && r.b2.nbFactures === 1 && r.b2.statutA1 === 'remplace' && r.b2.statutA2 === 'remplace' && r.b2.lienA1 && r.b2.lienA2), j(r.b2));
}

/* ---------------- T27 : deux branches acceptées (B1 direct de O, A2 petit-fils) : « Facturer » O refuse SANS réécrire « remplacé par » ---------------- */
{
  const r = await p.evaluate(async (MK3) => {
    AD.reset(); const W = ms => new Promise(r => setTimeout(r, ms));
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    const S = id => (DEVIS.find(x => x.id === id) || {}).statut;
    const L = id => ((DEVIS.find(x => x.id === id) || {}).remplacePar || {}).id;
    const K = LS.devis;
    const m = await eval(MK3); if (!m) return { absent: true };
    const O = DEVIS.find(x => x.id === m.o); O.statut = 'accepte'; delete O.remplacePar; save(K, DEVIS);
    go('tous'); await W(120); cpDevisAvenant(m.o); await W(250); const b1 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === m.o && x.id !== m.a1); if (!b1) return { absent: true };
    nxd2.close(); go('tous'); await W(120);
    const B1 = DEVIS.find(x => x.id === b1.id); B1.statut = 'accepte'; save(K, DEVIS);   /* forcé, comme après une fusion */
    AD.reset(); await facturerDevis(m.o, 'solde'); await W(300);
    const apres = { facO: F(m.o), statutO: S(m.o), lienO: L(m.o), msgs: __msgs.slice(), nomme: __msgs.some(x => x.includes(b1.num) && x.includes(m.a2Num)) };
    /* B1 annulé ensuite : « Facturer » O répare alors vers A1 et nomme A2 */
    cpDevisAnnuler(b1.id); await W(100); const radio = document.querySelector('#mAnnulDevis input[name="cpAnnulMotif"][value="erreur"]'); if (radio) radio.checked = true; cpDevisAnnulerOk(); await W(200);
    AD.reset(); await facturerDevis(m.o, 'solde'); await W(300);
    const apres2 = { facO: F(m.o), statutO: S(m.o), lienO: L(m.o), nommeA2: __msgs.some(x => x.includes(m.a2Num)), msgs: __msgs.slice() };
    return { apres, apres2, m, b1: b1.id };
  }, MK3);
  if (r.absent) { rec(GQ2.BR, 'T27 prérequis', false, j(r)); r.apres = r.apres2 = {}; }
  rec(GQ2.BR, 'T27 deux branches acceptées (B1 direct, A2 petit-fils) : « Facturer » O refusé (« Deux avenants … » nommant les deux), O reste « accepté », « remplacé par » non réécrit', !!(!r.apres.facO && r.apres.statutO === 'accepte' && !r.apres.lienO && (r.apres.msgs || []).some(x => /Deux avenants/i.test(x)) && r.apres.nomme), j(r.apres));
  rec(GQ2.BR, 'T27 après l\'annulation de B1 : « Facturer » O répare vers A1 et dit de facturer A2', !!(!r.apres2.facO && r.apres2.statutO === 'remplace' && r.apres2.lienO === (r.m || {}).a1 && r.apres2.nommeA2), j(r.apres2));
}

/* ---------------- T28 : une demande de désactivation de lien n'est retirée de la file qu'après une réponse sans erreur ---------------- */
{
  const r = await p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)); const sauve = window.nxsDesactiverLiens, vider = window.nxsViderLiensEnAttente; if (typeof vider !== 'function') return { absent: true };
    try {
      window.cpLiensADesactiver = [['devis', 'X-ERREUR', 'remplace']];
      window.nxsDesactiverLiens = function () { return Promise.resolve(-1); };   /* -1 = le cloud n'a pas répondu / a répondu en erreur */
      const n1 = vider(); await W(50); const apresErreur = (window.cpLiensADesactiver || []).map(a => a[1]);
      window.nxsDesactiverLiens = function () { return Promise.resolve(2); };
      const n2 = vider(); await W(50); const apresOk = (window.cpLiensADesactiver || []).map(a => a[1]);
      window.nxsDesactiverLiens = function () { return Promise.reject(new Error('réseau')); };
      window.cpLiensADesactiver.push(['devis', 'X-REJET', 'annule']); const n3 = vider(); await W(50); const apresRejet = (window.cpLiensADesactiver || []).map(a => a[1]);
      window.cpLiensADesactiver.length = 0;
      return { n1, apresErreur, n2, apresOk, n3, apresRejet };
    } finally { window.nxsDesactiverLiens = sauve; }
  });
  rec(GQ2.LNK, 'T28 la demande reste en file après une réponse en erreur (-1) ou un rejet, et n\'en sort qu\'après une réponse sans erreur', !!(!r.absent && r.n1 === 1 && JSON.stringify(r.apresErreur) === '["X-ERREUR"]' && r.n2 === 1 && JSON.stringify(r.apresOk) === '[]' && r.n3 === 1 && JSON.stringify(r.apresRejet) === '["X-REJET"]'), j(r));
}

/* ================= AF1-5 ter (relecture d'AF1-5 bis, Opus, 05/11/2026) : T29 chaîne d'avenants en boucle (données abîmées) → refus net, pas de plantage ;
   T30 la file des liens couvre aussi les demandes faites en cours d'utilisation ; T31 messages avec deux branches (original facturé ; avenant du milieu) ================= */
const GQ3 = { CYC: 'AF1-5 chaîne en boucle', LNK: 'AF1-5 file des liens (en cours d\'utilisation)', MSG: 'AF1-5 messages deux branches' };
{
  const r = await p.evaluate(async () => {
    AD.reset(); const W = ms => new Promise(r => setTimeout(r, ms)); const K = LS.devis;
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    /* données abîmées : X avenant de Z, Z avenant de Y, Y avenant de X ; Y et Z acceptés */
    const X = AD.v2({ statut: 'accepte' }), Y = AD.v2({ statut: 'accepte' }), Z = AD.v2({ statut: 'accepte' });
    X.avenantDe = { id: Z.id, num: Z.num }; Z.avenantDe = { id: Y.id, num: Y.num }; Y.avenantDe = { id: X.id, num: X.num }; save(K, DEVIS);
    let refus = null, erreur = null; try { refus = cpRefusFacture(X); } catch (e) { erreur = String(e && e.message || e); }
    AD.reset(); let erreur2 = null; try { await facturerDevis(X.id, 'solde'); } catch (e) { erreur2 = String(e && e.message || e); } await W(300);
    const journal = JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter(x => x.id === X.id && x.motif === 'chaine_abimee').length;
    /* nettoyage : ces trois devis abîmés ne doivent pas gêner la suite */
    [X, Y, Z].forEach(d => { const i = DEVIS.findIndex(x => x.id === d.id); if (i >= 0) DEVIS.splice(i, 1); }); save(K, DEVIS);
    return { refus, erreur, erreur2, fac: F(X.id), msgs: __msgs.slice(), journal };
  });
  rec(GQ3.CYC, 'T29 chaîne d\'avenants en boucle (X → Z → Y → X, Y et Z acceptés) : « Facturer » X refusé avec un message clair (chaîne abîmée, à vérifier), aucun plantage, aucune facture, ligne au journal', !!(!r.erreur && !r.erreur2 && typeof r.refus === 'string' && /abîmée/i.test(r.refus) && !r.fac && (r.msgs || []).some(x => /abîmée/i.test(x)) && r.journal >= 1), j(r));
}

/* ---------------- T30 : cpDesactiverLiens (en cours d'utilisation) remet la demande en file quand le cloud n'a pas répondu sans erreur ---------------- */
{
  const r = await p.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)); const sauve = window.nxsDesactiverLiens; if (typeof cpDesactiverLiens !== 'function') return { absent: true };
    try {
      window.cpLiensADesactiver = [];
      window.nxsDesactiverLiens = function () { return Promise.resolve(-1); }; cpDesactiverLiens('devis', 'X-RT-ERREUR', 'annule'); await W(50);
      const apresErreur = window.cpLiensADesactiver.map(a => a[1]);
      window.nxsDesactiverLiens = function () { return Promise.reject(new Error('réseau')); }; cpDesactiverLiens('devis', 'X-RT-REJET', 'remplace'); await W(50);
      const apresRejet = window.cpLiensADesactiver.map(a => a[1]);
      window.nxsDesactiverLiens = function () { return Promise.resolve(0); }; cpDesactiverLiens('devis', 'X-RT-OK', 'annule'); await W(50);
      const apresOk = window.cpLiensADesactiver.map(a => a[1]);
      cpDesactiverLiens('devis', 'X-RT-ERREUR', 'annule'); await W(50);   /* pas de doublon dans la file */
      const sansDoublon = window.cpLiensADesactiver.filter(a => a[1] === 'X-RT-ERREUR').length;
      window.cpLiensADesactiver.length = 0;
      return { apresErreur, apresRejet, apresOk, sansDoublon };
    } finally { window.nxsDesactiverLiens = sauve; }
  });
  rec(GQ3.LNK, 'T30 demande faite en cours d\'utilisation : mise en file sur -1 et sur un rejet, pas sur une réponse ≥ 0, sans doublon', !!(!r.absent && JSON.stringify(r.apresErreur) === '["X-RT-ERREUR"]' && JSON.stringify(r.apresRejet) === '["X-RT-ERREUR","X-RT-REJET"]' && JSON.stringify(r.apresOk) === '["X-RT-ERREUR","X-RT-REJET"]' && r.sansDoublon === 1), j(r));
}

/* ---------------- T31 : messages avec deux branches acceptées ---------------- */
{
  const r = await p.evaluate(async (MK3) => {
    AD.reset(); const W = ms => new Promise(r => setTimeout(r, ms)); const K = LS.devis;
    const F = id => { const d = DEVIS.find(x => x.id === id); return !!(d && (d.facSolde || d.facAcompte)); };
    const S = id => (DEVIS.find(x => x.id === id) || {}).statut;
    /* a. O porte un acompte, deux branches acceptées (B1 direct, A2 petit-fils) : le refus nomme les deux avenants */
    const m = await eval(MK3); if (!m) return { absent: true };
    const O = DEVIS.find(x => x.id === m.o); O.statut = 'accepte'; delete O.remplacePar; save(K, DEVIS);
    go('tous'); await W(120); cpDevisAvenant(m.o); await W(250); const b1 = DEVIS.find(x => x.avenantDe && x.avenantDe.id === m.o && x.id !== m.a1); if (!b1) return { absent: true };
    nxd2.close(); go('tous'); await W(120);
    const B1 = DEVIS.find(x => x.id === b1.id); B1.statut = 'accepte'; O.facAcompte = { num: 'TEST-F-' + __REF.an + '-0814', date: __REF.jour, montant: 50, baseTTC: 300, payeLe: null, mode: '' }; save(K, DEVIS);
    AD.reset(); await facturerDevis(m.o, 'solde'); await W(300);
    const a = { facSolde: !!O.facSolde, statutO: S(m.o), msgs: __msgs.slice(), nommeLesDeux: __msgs.some(x => x.includes(m.a2Num) && x.includes(b1.num) && /avoir/i.test(x)) };
    /* b. A1 revenu « accepté » entre O (remplacé) et deux branches acceptées (A2 et B1) : « Facturer » A1 → « Deux avenants » nommant A2 et B1, A1 inchangé */
    delete O.facAcompte; O.statut = 'remplace'; O.remplacePar = { id: m.a1, num: m.a1Num, at: Date.now() };
    const A1 = DEVIS.find(x => x.id === m.a1); A1.statut = 'accepte'; delete A1.remplacePar; save(K, DEVIS);
    AD.reset(); await facturerDevis(m.a1, 'solde'); await W(300);
    const b = { fac: F(m.a1), statutA1: S(m.a1), lienA1: !!(DEVIS.find(x => x.id === m.a1) || {}).remplacePar, msgs: __msgs.slice(), deuxAvenants: __msgs.some(x => /Deux avenants/i.test(x) && x.includes(m.a2Num) && x.includes(b1.num)), factureAvenant: __msgs.some(x => /Facture l'avenant/i.test(x)) };
    return { a, b };
  }, MK3);
  if (r.absent) { rec(GQ3.MSG, 'T31 prérequis', false, j(r)); r.a = r.b = {}; }
  rec(GQ3.MSG, 'T31a original facturé + deux branches acceptées : le refus nomme les deux avenants (avoir ou annulation), aucune facture', !!(!r.a.facSolde && r.a.statutO === 'accepte' && r.a.nommeLesDeux), j(r.a));
  rec(GQ3.MSG, 'T31b avenant du milieu revenu « accepté » sous deux branches : « Deux avenants » nommant A2 et B1, pas « Facture l\'avenant », rien n\'est réécrit', !!(!r.b.fac && r.b.statutA1 === 'accepte' && !r.b.lienA1 && r.b.deuxAvenants && !r.b.factureAvenant), j(r.b));
}

rec('AF1', 'Aucune erreur JavaScript pendant la suite', errs.length === 0, errs.join(' | '));
await ctx.close();
await closeBrowser();
ecrireResultats('resAD.json', RES);
RES.forEach((x) => console.log(x.ok.padEnd(5), '[' + x.group + ']', x.name, x.ok !== 'PASS' ? '— ' + x.detail : ''));
