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
    const carnet = nxobjCarnet(), accApres = DEVIS.filter(x => x.statut === 'accepte').length;
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
      cmd: cmd ? +cmd[1] : null, planO: plan.indexOf(o.num) >= 0, planA: plan.indexOf(a.num) >= 0, carnet: carnet.devis, journal: journal.length,
      facMsgs, fac: !!(O2.facSolde || O2.facAcompte), fbloc: fbloc === '', ban: ban.slice(0, 200), avenantBtn: boutons.some(b => /Faire un avenant/.test(b)), dupBtn: boutons.some(b => /Dupliquer/.test(b)), reste: DEVIS.some(x => x.id === o.id), corbeille: AD.trash().some(x => x.item && x.item.id === o.id) };
  });
  rec(GB.AV, 'T14b avenant accepté (éditeur) : l\'original passe « remplacé par l\'avenant n° … » (mémoire et stockage), date d\'acceptation gardée, lien vers l\'avenant', !rb.absent && rb.ok === true && rb.aStatut === 'accepte' && rb.oStatut === 'remplace' && rb.stStatut === 'remplace' && rb.oDate && rb.lien, j(rb));
  rec(GB.AV, 'T14b l\'original sort d\'« À commander », de « Planifier » et du carnet de commandes (un seul chantier signé : l\'avenant)', !rb.absent && rb.accApres === rb.accAvant && rb.cmd === rb.accApres && !rb.planO && rb.planA && rb.carnet === rb.accApres, j({ accAvant: rb.accAvant, accApres: rb.accApres, cmd: rb.cmd, planO: rb.planO, planA: rb.planA, carnet: rb.carnet }));
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
    const accApres = DEVIS.filter(x => x.statut === 'accepte').length, carnet = nxobjCarnet().devis;
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
    const b = { btnV2, ouvertB, sansMotif, msgSansMotif, statut: S.statut, stStatut: st.statut, annulation: S.annulation, date: S.acceptedAt === s.acceptedAt, sig: !!S.signature, accAvant, accApres, cmd: cmd ? +cmd[1] : null, kpi: kpi ? +kpi[1] : null, planS: plan.indexOf(s.num) >= 0, carnet, ca,
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
  rec(GB.AN, 'T15b devis annulé : sort d\'« À commander », de « Planifier », du carnet de commandes et du CA signé (compteur « Acceptés »)', !r.absent && r.b.accApres === r.b.accAvant - 1 && r.b.cmd === r.b.accApres && r.b.kpi === r.b.accApres && !r.b.planS && r.b.carnet === r.b.accApres, j({ accAvant: r.b.accAvant, accApres: r.b.accApres, cmd: r.b.cmd, kpi: r.b.kpi, planS: r.b.planS, carnet: r.b.carnet }));
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

rec('AF1', 'Aucune erreur JavaScript pendant la suite', errs.length === 0, errs.join(' | '));
await ctx.close();
await closeBrowser();
ecrireResultats('resAD.json', RES);
RES.forEach((x) => console.log(x.ok.padEnd(5), '[' + x.group + ']', x.name, x.ok !== 'PASS' ? '— ' + x.detail : ''));
