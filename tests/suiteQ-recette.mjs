// Suite Q — recette « deux appareils » (14/10/2026) : ce que Gabriel ferait lui-même avec son PC et son téléphone,
// rejoué sur un serveur commun simulé (tests/banc-appareils.mjs) avec le vrai code de synchro et d'émission.
// Captures et journal des étapes dans <CP_TEST_OUT>/recette/ (rapport de recette). Données fictives uniquement.
import { rec, RES } from './lib.mjs';
import { SEED } from './lib.mjs';
import { ecrireResultats } from './env.mjs';
import { serveurCommun, appareil, seConnecter, calme, pret, lire, quitter, revenir, rouvrir, couper, retablir, synchroAuto, carnet, fermerNavigateur } from './banc-appareils.mjs';
const G = 'Recette deux appareils';
const j = (o) => JSON.stringify(o);
const H = '2027-09-15T08:30:00+02:00'; // un mercredi de septembre 2027, entreprise lancée le 01/07/2027
const K = carnet('recette');
let ETAPE = '';
const r = (nom, ok, detail, captures) => { rec(G, nom, ok, detail); K.etape({ partie: ETAPE, nom, ok: ok === true ? 'PASS' : ok === false ? 'FAIL' : String(ok), detail: detail == null ? '' : String(detail).slice(0, 400), captures: (captures || []).filter(Boolean) }); };
const PARTIES = (process.env.CP_Q_PARTIES || '').split(',').filter(Boolean); // débogage : CP_Q_PARTIES=4,5
const partie = (n) => !PARTIES.length || PARTIES.includes(String(n));
const lireCles = (S, re) => Object.keys((S.etat && S.etat.data) || {}).filter((k) => re.test(k));

/* ================= Q1 — ouverture de l'appli : la synchro attend que toute l'appli soit chargée =================
   Au démarrage, la connexion au cloud partait AVANT le chargement des modules (next-*.js) : leurs données (retours SAV,
   bouteilles, registre des factures…) n'étaient ni reçues ni renvoyées, et un envoi à ce moment-là les retirait du serveur. */
ETAPE = 'Ouverture de l’appli sur un 2e appareil';
if (partie(1)) for (const lat of [5, 60]) { /* 5 ms : réseau rapide et modules lents (premier chargement) */
  const S = serveurCommun(); S.latence.tel = lat;
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED);
  await PC.p.evaluate(() => { nxrtAjouter({ devis: DEVIS[0].num, heures: 1.5, km: 20, pieces: 0, motif: 'pose', date: '2027-09-14' }); nxadrAjouter({ fluide: 'R32', qte: 10, nb: 2 }); });
  await pret(S, PC);
  const avant = lireCles(S, /^cpnext_(sav|adr)$/);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H, connecte: true, attente: 300, modulesLents: lat === 5 ? 250 : 0 });
  await calme(S, TEL); await TEL.p.waitForTimeout(800); await calme(S, TEL);
  const t = await TEL.p.evaluate(() => ({ sav: (load('cpnext_sav', []) || []).length, adr: (load('cpnext_adr', []) || []).length, devis: DEVIS.length }));
  const perdu = S.historique.filter((h) => h.dev === 'tel' && !(h.cles.includes('cpnext_sav') && h.cles.includes('cpnext_adr')));
  r(`Téléphone ouvert (réseau ${lat} ms) : il reçoit les devis, le retour SAV et les bouteilles du PC`, avant.length === 2 && t.devis === 12 && t.sav === 1 && t.adr === 1, j({ avant, tel: t }));
  r(`Téléphone ouvert (réseau ${lat} ms) : aucun envoi au serveur ne retire les données des modules`, perdu.length === 0, j(perdu.map((h) => h.cles.filter((k) => /^cpnext_|^cp2_docs$/.test(k)).length)));
  r(`Aucune erreur JavaScript (ouverture, réseau ${lat} ms)`, PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | '));
  await PC.ctx.close(); await TEL.ctx.close();
}

/* ================= Q2 — un appareil resté sur l'ancienne version (cache) ne retire pas les nouvelles données ================= */
ETAPE = 'Appareil resté sur l’ancienne version';
if (partie(2)) { const S = serveurCommun();
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED); await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H, connecte: true }); await calme(S, TEL);
  /* le téléphone « ne connaît pas » les clés de la 1.12 (ancienne version gardée en cache) */
  await TEL.p.evaluate(() => { ['cpnext_sav', 'cpnext_adr', 'cpnext_avis', 'cpnext_flubilan', 'cpnext_bqvus'].forEach((k) => { const i = SYNC_KEYS.indexOf(k); if (i >= 0) SYNC_KEYS.splice(i, 1); }); });
  /* le PC note un retour SAV, le téléphone récupère puis modifie un client */
  await PC.p.evaluate(() => nxrtAjouter({ devis: DEVIS[0].num, heures: 2, km: 10, pieces: 15, motif: 'garantie', date: '2027-09-15' }));
  await pret(S, PC);
  await revenir(S, TEL);
  await TEL.p.evaluate(() => { CLIENTS[0].notes = 'Portail : sonner deux fois'; save(LS.clients, CLIENTS); });
  await quitter(S, TEL);
  const sav = ((S.etat.data || {}).cpnext_sav || []).length;
  r('Téléphone sur l’ancienne version : sa modification arrive, le retour SAV noté sur le PC reste sur le serveur', sav === 1 && /sonner deux fois/.test(j(S.etat.data.cp2_clients)), j({ sav }));
  await PC.ctx.close(); await TEL.ctx.close();
}

/* ================= Q3 — connexion d'un nouvel appareil par l'écran de connexion : pas de doublons dans les prix ================= */
ETAPE = 'Connexion d’un nouvel appareil';
if (partie(3)) { const S = serveurCommun();
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED); await pret(S, PC);
  const nPC = await PC.p.evaluate(() => load(LS.custom, []).length);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H });
  const c0 = await K.capture(TEL, 'ecran-connexion');
  await seConnecter(S, TEL); await TEL.p.waitForTimeout(600); await calme(S, TEL);
  await revenir(S, PC);
  const doublons = (L) => { const v = {}; let n = 0; (L || []).forEach((x) => { const k = (x.cat || '') + '|' + (x.nom || ''); if (v[k]) n++; v[k] = 1; }); return n; };
  const tel = await TEL.p.evaluate(() => load(LS.custom, [])), pc = await PC.p.evaluate(() => load(LS.custom, []));
  const srv = (S.etat.data || {}).cp2_prix_custom || [];
  const c1 = await K.capture(TEL, 'apres-connexion');
  r('Nouvel appareil connecté : ses articles de départ ne s’ajoutent pas en double à la base de prix (serveur, PC, téléphone)',
    doublons(srv) === 0 && doublons(tel) === 0 && doublons(pc) === 0 && srv.length === nPC, j({ avant: nPC, serveur: srv.length, doublons: [doublons(srv), doublons(pc), doublons(tel)] }), [c0, c1]);
  /* base de prix déjà en triple (constatée sur la base de TEST le 14/10/2026 : 84 lignes, 28 articles) : remise en ordre */
  await PC.p.evaluate(() => { const L = load(LS.custom, []); const copie = (x) => Object.assign({}, x, { id: x.id + 'b' }), copie2 = (x) => Object.assign({}, x, { id: x.id + 'c' });
    const avecPerso = L.concat([{ id: 'perso1', nom: 'Article modifié à la main', cat: 'Divers', unite: 'unité', achat: 12, marge: 30, verif: false, src: 'local' }]);
    save(LS.custom, avecPerso.concat(L.map(copie), L.map(copie2), [{ id: 'perso2', nom: 'Article modifié à la main', cat: 'Divers', unite: 'unité', achat: 15, marge: 30, verif: false, src: 'local' }])); });
  await pret(S, PC);
  await rouvrir(S, PC); await synchroAuto(S, PC); await revenir(S, TEL); await rouvrir(S, TEL); await synchroAuto(S, TEL); await revenir(S, PC);
  const pc2 = await PC.p.evaluate(() => load(LS.custom, [])), tel2 = await TEL.p.evaluate(() => load(LS.custom, [])), srv2 = (S.etat.data || {}).cp2_prix_custom || [];
  const perso = (L) => L.filter((x) => x.nom === 'Article modifié à la main').map((x) => x.achat).sort().join('/');
  r('Base de prix déjà en double : les copies identiques sont retirées partout, un article modifié différemment est gardé',
    srv2.length === nPC + 2 && doublons(srv2.filter((x) => x.nom !== 'Article modifié à la main')) === 0 && perso(srv2) === '12/15' && pc2.length === srv2.length && tel2.length === srv2.length,
    j({ serveur: srv2.length, pc: pc2.length, tel: tel2.length, attendu: nPC + 2, perso: perso(srv2) }));
  r('Aucune erreur JavaScript (connexion d’un nouvel appareil)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | '));
  await PC.ctx.close(); await TEL.ctx.close();
}
/* PC dont la base de prix vient de l'ancienne version (identifiants tirés au hasard, un article de départ modifié à la main) */
if (partie(3)) { const S = serveurCommun();
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED);
  await PC.p.evaluate(() => { const L = load(LS.custom, []).map((x, i) => /^(pd|adia)_/.test(x.id) ? Object.assign({}, x, { id: 'ANC' + String(i).padStart(3, '0') }) : x);
    const c = L.find((x) => x.nom === 'Condensateur de démarrage'); c.achat = 24; save(LS.custom, L); });
  await pret(S, PC);
  const nPC = await PC.p.evaluate(() => load(LS.custom, []).length);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H });
  await seConnecter(S, TEL); await TEL.p.waitForTimeout(600); await calme(S, TEL); await synchroAuto(S, TEL); await revenir(S, PC);
  const srv = (S.etat.data || {}).cp2_prix_custom || [], tel = await TEL.p.evaluate(() => load(LS.custom, []));
  const cond = srv.filter((x) => x.nom === 'Condensateur de démarrage');
  r('Ancienne base de prix (identifiants au hasard, un prix modifié) + nouvel appareil : aucun doublon, le prix modifié est gardé',
    srv.length === nPC && tel.length === nPC && cond.length === 1 && cond[0].achat === 24, j({ avant: nPC, serveur: srv.length, tel: tel.length, condensateur: cond.map((x) => x.achat) }));
  r('Aucune erreur JavaScript (connexion, prix)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | '));
  await PC.ctx.close(); await TEL.ctx.close();
}

/* ================= Q4 — une journée de travail avec le PC et le téléphone =================
   Paramètres et facturation réelle démarrée sur le PC ; factures depuis les deux appareils ; même devis facturé des deux
   côtés sans synchro entre-temps ; paiement sur le téléphone. Numéros donnés par le serveur commun. */
const fermerPdf = `(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;
async function ouvrirDevis(A, id) {
  await A.p.evaluate((x) => openDevis(x), id); await A.p.waitForTimeout(250);
  const t = A.p.locator('button:visible').filter({ hasText: /^\s*Récapitulatif\s*$/ }).first(); if (await t.count()) { await t.click(); await A.p.waitForTimeout(250); }
}
async function fermerDevis(A) { const f = A.p.locator('button:visible').filter({ hasText: /^\s*Fermer\s*$/ }).first(); if (await f.count()) { await f.click(); await A.p.waitForTimeout(250); } }
async function facturerSolde(S, A, id, nom) {
  await ouvrirDevis(A, id);
  const b = A.p.locator('button[onclick*="facturerDevis"][onclick*="solde"]:visible').first();
  const vu = (await b.count()) > 0;
  let cap = null;
  if (vu) { await b.click(); await A.p.waitForTimeout(400); await calme(S, A); await A.p.evaluate(fermerPdf); await A.p.waitForTimeout(200); cap = await K.capture(A, nom, '#nxd2Recap, .fbloc, #fBloc'); }
  const num = await A.p.evaluate((x) => { const d = DEVIS.find((y) => y.id === x); return d && d.facSolde ? d.facSolde.num : null; }, id);
  await fermerDevis(A);
  return { bouton: vu, num, cap };
}
if (partie(4)) {
ETAPE = 'Facturation depuis les deux appareils';
const S4 = serveurCommun();
const PC4 = await appareil(S4, 'pc', { mobile: false, horloge: H, connecte: true });
await PC4.p.evaluate(SEED);
await PC4.p.evaluate(() => { save('cpnext_objectifs', Object.assign(load('cpnext_objectifs', {}), { debut: '2027-07-01' })); go('params'); });
await PC4.p.waitForTimeout(300);
for (const [sel, v] of [['#pe_nom', 'Froid Essai (entreprise fictive)'], ['#pe_siret', '12345678900012'], ['#pe_adr', "1 rue de l'Exemple"], ['#pe_cp', '60000'], ['#pe_ville', 'Beauvais'],
  ['#pe_assur', 'Assureur fictif n° 0001'], ['#pe_assurzone', 'France métropolitaine'], ['#pe_medi', 'Médiateur fictif'], ['#pe_medisite', 'https://mediateur.exemple.invalid'], ['#pe_avis', 'https://g.page/r/EXEMPLE-fictif/review']]) {
  if (await PC4.p.locator(sel).count()) await PC4.p.fill(sel, v);
}
if (await PC4.p.locator('#pe_nature').count()) await PC4.p.selectOption('#pe_nature', 'S').catch(() => {});
await PC4.p.click('button[onclick="saveParams()"]'); await PC4.p.waitForTimeout(300);
await PC4.p.evaluate(() => go('params')); await PC4.p.waitForTimeout(300);
await PC4.p.fill('#nxReelDebut', await PC4.p.evaluate(() => todayISO())).catch(() => {});
PC4.reponses.push(true);
await PC4.p.click('#nxReelCard button:has-text("Démarrer")').catch(() => PC4.p.evaluate(() => nxEmisDemarrerUI()));
await PC4.p.waitForTimeout(400);
const capReel = await K.capture(PC4, 'facturation-reelle-demarree', '#nxReelCard');
await pret(S4, PC4);
const TEL4 = await appareil(S4, 'tel', { mobile: true, horloge: H });
await seConnecter(S4, TEL4); await TEL4.p.waitForTimeout(500); await calme(S4, TEL4);
const modes = await Promise.all([PC4, TEL4].map((A) => A.p.evaluate(async () => { await nxEmisSonde(true); return nxEmisMode(); })));
r('Facturation réelle démarrée sur le PC : le téléphone connecté est aussi en facturation réelle (numéros du serveur)', modes.every((m) => m.mode === 'reel' && m.demarre), j(modes), [capReel]);
const ids = await PC4.p.evaluate(() => DEVIS.filter((d) => d.statut === 'accepte' && compute(d).totalHT > 0).map((d) => d.id));
/* A sur le PC, B sur le téléphone */
const fA = await facturerSolde(S4, PC4, ids[0], 'facture-pc');
await pret(S4, PC4);
await revenir(S4, TEL4);
const fB = await facturerSolde(S4, TEL4, ids[1], 'facture-telephone');
await quitter(S4, TEL4); await revenir(S4, PC4);
const vus = await Promise.all([PC4, TEL4].map((A) => A.p.evaluate((L) => L.map((id) => { const d = DEVIS.find((x) => x.id === id); return d && d.facSolde ? d.facSolde.num : null; }), [ids[0], ids[1]])));
r('Facture sur le PC puis facture sur le téléphone : F-2027-001 puis F-2027-002, chacune visible sur les deux appareils',
  fA.num === 'F-2027-001' && fB.num === 'F-2027-002' && vus.every((v) => v[0] === 'F-2027-001' && v[1] === 'F-2027-002'), j({ fA: fA.num, fB: fB.num, boutons: [fA.bouton, fB.bouton], vus }), [fA.cap, fB.cap]);
/* C : le téléphone facture, le PC (resté ouvert, pas resynchronisé) facture le même devis */
await synchroAuto(S4, PC4); await revenir(S4, PC4); await synchroAuto(S4, TEL4); /* plus rien en attente sur les deux appareils */
const ecrPC = S4.journal.filter((x) => x.dev === 'pc').length;
S4.etatBloque.pc = true; /* le PC ne reçoit pas la synchro entre-temps (cas le plus défavorable) */
const fC1 = await facturerSolde(S4, TEL4, ids[2], 'meme-devis-telephone');
await quitter(S4, TEL4);
PC4.reponses.push(true, true);
const fC2 = await facturerSolde(S4, PC4, ids[2], 'meme-devis-pc');
S4.etatBloque.pc = false;
const pcAParle = S4.journal.filter((x) => x.dev === 'pc').slice(ecrPC).map((x) => x.nom);
const docsC = S4.docs.filter((d) => d.payload && d.payload.src && d.payload.src.id === ids[2]).map((d) => d.num);
r('Même devis facturé sur le téléphone puis sur le PC resté ouvert : une seule facture au registre du serveur, la même sur les deux appareils',
  docsC.length === 1 && fC1.num === docsC[0] && fC2.num === docsC[0], j({ tel: fC1.num, pc: fC2.num, boutonPC: fC2.bouton, serveur: docsC, appelsPC: pcAParle, dialogues: PC4.dialogues.slice(-2).map((d) => d.msg.slice(0, 120)) }), [fC1.cap, fC2.cap]);


/* ---- paiement noté sur le téléphone (chèque reçu sur le chantier) ---- */
ETAPE = 'Paiements';
try {
await pret(S4, PC4); await pret(S4, TEL4);
await revenir(S4, TEL4);
await ouvrirDevis(TEL4, ids[0]);
TEL4.reponses.push('Chèque');
const bPay = TEL4.p.locator('button[onclick*="payerFacture"]:visible').first();
const payVu = (await bPay.count()) > 0; if (payVu) { await bPay.click(); await TEL4.p.waitForTimeout(400); }
const capPay = await K.capture(TEL4, 'paiement-cheque', '#nxd2Recap, .fbloc, #fBloc');
await fermerDevis(TEL4); await quitter(S4, TEL4); await revenir(S4, PC4);
const payPC = await PC4.p.evaluate((x) => { const d = DEVIS.find((y) => y.id === x); return d && d.facSolde ? { le: d.facSolde.payeLe || null, mode: d.facSolde.mode || '' } : null; }, ids[0]);
const evPay = S4.events.filter((e) => /pai/i.test(e.type)).length;
r('Chèque noté « payé » sur le téléphone : la facture F-2027-001 est payée sur le PC (date, mode) et le paiement est inscrit au registre', payVu && payPC && payPC.le === '2027-09-15' && /ch/i.test(payPC.mode) && evPay >= 1, j({ payPC, evenements: S4.events.map((e) => e.type) }), [capPay]);

/* ---- relevé bancaire importé sur le PC, puis le même relevé sur le téléphone ---- */
} catch (e) { r('Paiements — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Relevé bancaire';
try {
await pret(S4, PC4); await pret(S4, TEL4);
const fB2 = await PC4.p.evaluate((x) => { const d = DEVIS.find((y) => y.id === x); return { num: d.facSolde.num, montant: d.facSolde.montant, client: d.cNom }; }, ids[1]);
const eur = (n) => n.toFixed(2).replace('.', ',');
const CSV = 'Date;Libellé;Débit;Crédit;Solde\n15/09/2027;VIR SEPA ' + fB2.client.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ') + ' ' + fB2.num + ';;' + eur(fB2.montant) + ';8 000,00\n14/09/2027;CB GROSSISTE FROID;250,00;;7 395,55\n';
async function importerReleve(S, A, nom) {
  await A.p.evaluate(() => go('nx_obj')); await A.p.waitForTimeout(300);
  const [fc] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.evaluate(() => nxbqChoisir())]);
  await fc.setFiles({ name: 'releve.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') }); await A.p.waitForTimeout(500);
  const m = await A.p.evaluate(() => { const M = document.getElementById('nxbqM'); return M ? { lignes: M.querySelectorAll('.nxbq-l').length, coches: [...M.querySelectorAll('.nxbq-l input[type=checkbox]')].filter((c) => c.checked).length, texte: M.innerText.slice(0, 600) } : null; });
  const cap = await K.capture(A, nom, '#nxbqM .nxbq-p');
  const ok = A.p.locator('#nxbqOk:enabled'); if (await ok.count()) { await ok.click(); await A.p.waitForTimeout(400); }
  await A.p.evaluate(() => { const M = document.getElementById('nxbqM'); if (M && typeof nxbqFermer === 'function') nxbqFermer(); });
  return { m, cap };
}
const rel1 = await importerReleve(S4, PC4, 'releve-pc');
const payeB = await PC4.p.evaluate((x) => (DEVIS.find((y) => y.id === x).facSolde || {}).payeLe || null, ids[1]);
await pret(S4, PC4);
r('Relevé importé sur le PC : le virement est reconnu (n° de facture complet), coché d’office, la facture F-2027-002 passe payée au 15/09', rel1.m && rel1.m.coches === 1 && payeB === '2027-09-15', j({ fenetre: rel1.m && { l: rel1.m.lignes, c: rel1.m.coches }, payeB, dialogues: PC4.dialogues.slice(-2).map((d) => d.msg.slice(0, 160)) }), [rel1.cap]);
await revenir(S4, TEL4);
const nEv0 = S4.events.length;
const rel2 = await importerReleve(S4, TEL4, 'releve-telephone');
await quitter(S4, TEL4);
const payeB2 = await TEL4.p.evaluate((x) => (DEVIS.find((y) => y.id === x).facSolde || {}).payeLe || null, ids[1]);
r('Le même relevé importé ensuite sur le téléphone : rien n’est coché, aucun 2e paiement', rel2.m && rel2.m.coches === 0 && payeB2 === '2027-09-15' && S4.events.length === nEv0, j({ fenetre: rel2.m && { l: rel2.m.lignes, c: rel2.m.coches }, payeB2, nouveauxEvenements: S4.events.length - nEv0 }), [rel2.cap]);

/* ---- retour SAV noté sur le téléphone depuis le menu « Créer », supprimé ensuite sur le PC ---- */
} catch (e) { r('Relevé bancaire — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Retour SAV';
try {
await pret(S4, PC4); await pret(S4, TEL4);
const numA = await TEL4.p.evaluate((x) => DEVIS.find((y) => y.id === x).num, ids[0]);
await TEL4.p.evaluate(() => { go('dash'); const d = document.getElementById('nxCreateMenu'); if (d) d.open = true; }); await TEL4.p.waitForTimeout(200);
const capMenu = await K.capture(TEL4, 'menu-creer', '.nx-create-panel');
await TEL4.p.click('.nx-create-panel [data-nxrc="sav"]'); await TEL4.p.waitForTimeout(500);
await TEL4.p.fill('#nxrt_devis', numA); await TEL4.p.locator('#nxrt_devis').dispatchEvent('change');
await TEL4.p.fill('#nxrt_h', '1.5'); await TEL4.p.fill('#nxrt_km', '24'); await TEL4.p.selectOption('#nxrt_motif', 'pose');
await TEL4.p.locator('#nxrt button.btn-pri').click(); await TEL4.p.waitForTimeout(300);
const capSav = await K.capture(TEL4, 'retour-sav-telephone', '#nxrt');
await quitter(S4, TEL4); await revenir(S4, PC4);
const savPC = await PC4.p.evaluate(() => { go('nx_obj'); return { n: nxrtSav().length, carte: ((document.getElementById('nxrt') || {}).innerText || '').slice(0, 300) }; });
const capSavPC = await K.capture(PC4, 'retour-sav-sur-pc', '#nxrt');
r('Retour SAV noté sur le téléphone (menu « Créer ») : visible sur le PC dans « Ma rentabilité réelle »', savPC.n === 1, j(savPC), [capMenu, capSav, capSavPC]);
PC4.reponses.push(true);
const bSup = PC4.p.locator('#nxrt [onclick*="nxrtSuppr"]').first(); if (await bSup.count()) { await PC4.p.evaluate(() => { const d = document.querySelector('#nxrt details'); if (d) d.open = true; }); await bSup.click({ force: true }); await PC4.p.waitForTimeout(300); }
await pret(S4, PC4); await revenir(S4, TEL4);
const savTel = await TEL4.p.evaluate(() => nxrtSav().length);
r('Retour SAV supprimé sur le PC : il disparaît aussi du téléphone', savTel === 0, j({ savTel }));

/* ---- demande d'avis : faite depuis le téléphone, plus proposée sur le PC ---- */
} catch (e) { r('Retour SAV — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Demande d’avis';
try {
await pret(S4, PC4); await pret(S4, TEL4);
const avTel = await TEL4.p.evaluate(() => { go('nx_obj'); return nxavisCandidats().map((x) => x.client); });
const capAvis = await K.capture(TEL4, 'carte-avis', '#nxavis');
await TEL4.p.evaluate(() => { window.__liens = []; window.nxavisOuvrir = (u) => __liens.push(u); });
/* le client fictif n'a ni mail ni téléphone : bouton « Copier » (message à coller dans sa messagerie) */
const bCop = TEL4.p.locator('#nxavis [onclick*="nxavisCopier"]').first(); const mailVu = (await bCop.count()) > 0; if (mailVu) { await bCop.click(); await TEL4.p.waitForTimeout(400); }
const lienMail = await TEL4.p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
await quitter(S4, TEL4); await revenir(S4, PC4);
const avPC = await PC4.p.evaluate(() => nxavisCandidats().map((x) => x.client));
r('Demande d’avis faite depuis le téléphone (message copié avec le lien Google) : le client n’est plus proposé sur le PC',
  avTel.length >= 1 && mailVu && /g\.page/.test(decodeURIComponent(lienMail)) && avPC.length === avTel.length - 1, j({ tel: avTel, pc: avPC, lien: lienMail.slice(0, 80) }), [capAvis]);

/* ---- déclaration des fluides : une case sur chaque appareil, l'un hors ligne ---- */
} catch (e) { r('Demande d’avis — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Fluides et bouteilles';
try {
await pret(S4, PC4); await pret(S4, TEL4);
await TEL4.p.evaluate(() => { FLU.push({ id: 'fx1', num: 'FF-2027-001', date: '2027-09-10', nature: 'mes', fluide: 'R32', client: 'Client fictif', desc: 'Split', charge: 1.2, ctrl: 'na', qv: 0.4, qrec: 0, qreg: 0, qrt: 0, qru: 0 }); save('cp2_fluides', FLU); });
await quitter(S4, TEL4); await revenir(S4, PC4);
await PC4.p.evaluate(() => go('fluides')); await PC4.p.waitForTimeout(400);
await couper(S4, TEL4);
await TEL4.p.evaluate(() => go('fluides')); await TEL4.p.waitForTimeout(400);
const champ = async (A, lab, v) => { const l = A.p.locator('#nxfb input[aria-label="' + lab + '"]').first(); await l.scrollIntoViewIfNeeded(); await l.fill(v); await l.dispatchEvent('change'); await A.p.waitForTimeout(250); };
await champ(PC4, 'R32 acq', '5');
await pret(S4, PC4);
await champ(TEL4, 'R32 remis', '1');
const capFluTel = await K.capture(TEL4, 'fluides-hors-ligne', '#nxfb');
await retablir(S4, TEL4); await synchroAuto(S4, TEL4); await revenir(S4, PC4);
const flu = await Promise.all([PC4, TEL4].map((A) => A.p.evaluate(() => { const b = nxfbBilan('2027').find((x) => x.fluide === 'R32') || {}; return { acq: b.acq, remis: b.remis, chN: b.chN }; })));
await lire(S4, PC4, () => go('fluides')); await PC4.p.waitForTimeout(400);
const capFluPC = await K.capture(PC4, 'fluides-pc', '#nxfb');
r('Déclaration des fluides : « acquises » saisie sur le PC, « remises » sur le téléphone hors ligne → les deux valeurs gardées partout, la charge de la fiche du téléphone comptée',
  flu.every((f) => f.acq === 5 && f.remis === 1 && f.chN === 0.4), j(flu), [capFluTel, capFluPC]);
/* ---- bouteilles dans le camion, saisies sur le téléphone ---- */
await TEL4.p.evaluate(() => go('fluides')); await TEL4.p.waitForTimeout(400);
await TEL4.p.locator('#nxadrF').scrollIntoViewIfNeeded(); await TEL4.p.selectOption('#nxadrF', 'R32'); await TEL4.p.fill('#nxadrQ', '10'); await TEL4.p.fill('#nxadrN', '2');
await TEL4.p.locator('#nxadr button.btn-ghost:has-text("Ajouter")').click(); await TEL4.p.waitForTimeout(250);
await TEL4.p.selectOption('#nxadrF', 'R290'); await TEL4.p.fill('#nxadrQ', '5'); await TEL4.p.fill('#nxadrN', '1');
await TEL4.p.locator('#nxadr button.btn-ghost:has-text("Ajouter")').click(); await TEL4.p.waitForTimeout(250);
const capAdr = await K.capture(TEL4, 'bouteilles', '#nxadr');
await quitter(S4, TEL4); await revenir(S4, PC4);
const pts = await Promise.all([PC4, TEL4].map((A) => A.p.evaluate(() => nxadrPoints())));
r('Bouteilles saisies sur le téléphone (2 × 10 kg de R32, 1 × 5 kg de R290) : 75 points sur les deux appareils (3 × 25)', pts.every((x) => x === 75), j(pts), [capAdr]);

/* ---- liste « Lancer l'entreprise » : une case cochée sur chaque appareil sans synchro entre les deux ---- */
} catch (e) { r('Fluides et bouteilles — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Liste de lancement';
try {
await pret(S4, PC4); await pret(S4, TEL4);
await PC4.p.evaluate(() => go('nx_obj')); await TEL4.p.evaluate(() => go('nx_obj')); await PC4.p.waitForTimeout(300);
const cocher = async (A, cle) => { const l = A.p.locator('input[onchange*="nxobjCheck(\'' + cle + '\'"]').first(); if (await l.count()) { await l.scrollIntoViewIfNeeded(); await l.check(); await A.p.waitForTimeout(200); return true; } return false; };
const c1 = await cocher(PC4, 'assurances'), c2 = await cocher(TEL4, 'deuxfa');
await quitter(S4, PC4); await quitter(S4, TEL4); await revenir(S4, PC4); await revenir(S4, TEL4);
const chk = await Promise.all([PC4, TEL4].map((A) => A.p.evaluate(() => { const o = nxobjEtat(); return { assurances: !!(o.checks || {}).assurances, deuxfa: !!(o.checks || {}).deuxfa }; })));
await lire(S4, TEL4, () => go('nx_obj')); await TEL4.p.waitForTimeout(400);
const capLanc = await K.capture(TEL4, 'liste-lancement', '#nxobj .nxo-feu[data-feu="lancement"]');
r('Liste de lancement : « assurances » cochée sur le PC et « double authentification » sur le téléphone, sans synchro entre-temps → les deux cochées partout',
  c1 && c2 && chk.every((x) => x.assurances && x.deuxfa), j({ c1, c2, chk }), [capLanc]);

/* ---- hors ligne : le téléphone travaille sans réseau pendant que le PC modifie un client ---- */
} catch (e) { r('Liste de lancement — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Hors ligne puis retour du réseau';
try {
await pret(S4, PC4); await pret(S4, TEL4);
await couper(S4, TEL4);
await TEL4.p.evaluate(() => { go('nx_obj'); nxrtAjouter({ devis: DEVIS.find((d) => d.facSolde && d.facSolde.num === 'F-2027-002').num, heures: 0.5, km: 12, pieces: 0, motif: 'reglage', date: todayISO() }); });
const etatHL = await TEL4.p.evaluate(() => ({ lbl: (document.getElementById('cloudLbl') || {}).textContent || '', dirty: !!localStorage.getItem('cp2_dirty') }));
await PC4.p.evaluate(() => { const c = CLIENTS.find((x) => /Atelier/.test(x.nom)); c.tel = '03 44 11 22 33'; save(LS.clients, CLIENTS); });
await quitter(S4, PC4);
await retablir(S4, TEL4); await synchroAuto(S4, TEL4); await revenir(S4, PC4); await revenir(S4, TEL4);
const hl = await Promise.all([PC4, TEL4].map((A) => A.p.evaluate(() => ({ sav: nxrtSav().length, tel: (CLIENTS.find((x) => /Atelier/.test(x.nom)) || {}).tel }))));
r('Téléphone hors ligne : il garde la modification et l’envoie au retour du réseau ; la modification faite entre-temps sur le PC est gardée aussi',
  etatHL.dirty && hl.every((x) => x.sav === 1 && x.tel === '03 44 11 22 33'), j({ pendant: etatHL, apres: hl }));

/* ---- devis ouvert sur le PC pendant qu'une mise à jour arrive du téléphone ---- */
} catch (e) { r('Hors ligne puis retour du réseau — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Devis ouvert pendant une mise à jour';
try {
await pret(S4, PC4); await pret(S4, TEL4);
const idE = ids[3] || ids[ids.length - 1];
await PC4.p.evaluate((x) => openDevis(x), idE); await PC4.p.waitForTimeout(300);
const titre = PC4.p.locator('input[placeholder^="Titre"]:visible').first();
const titreVu = (await titre.count()) > 0; if (titreVu) { await titre.fill('Salle de réunion (saisi sur le PC)'); await titre.dispatchEvent('input'); await titre.dispatchEvent('change'); }
await TEL4.p.evaluate(() => { const c = CLIENTS.find((x) => /Dupr/.test(x.nom)); c.notes = 'Code portail 4321 (changé)'; save(LS.clients, CLIENTS); });
await quitter(S4, TEL4);
const nCharg = PC4.chargements;
await revenir(S4, PC4);
const pendant = await PC4.p.evaluate(() => ({ vue: _curView, lbl: (document.getElementById('cloudLbl') || {}).textContent || '' }));
const rechPendant = PC4.chargements - nCharg;
const capForm = await K.capture(PC4, 'devis-ouvert-mise-a-jour-en-attente');
const enregistrer = PC4.p.locator('button:visible').filter({ hasText: /Enregistrer/ }).first(); if (await enregistrer.count()) { await enregistrer.click(); await PC4.p.waitForTimeout(300); }
await fermerDevis(PC4); await lire(S4, PC4, () => { if (_curView === 'nx_devis2') go('dash'); }); await PC4.p.waitForTimeout(300); await calme(S4, PC4); await pret(S4, PC4);
const apres = await lire(S4, PC4, (x) => ({ titre: JSON.stringify((DEVIS.find((d) => d.id === x) || {}).lots || []).indexOf('Salle de réunion') >= 0, notes: (CLIENTS.find((c) => /Dupr/.test(c.nom)) || {}).notes }), idE);
await revenir(S4, TEL4);
const telVoit = await TEL4.p.evaluate((x) => JSON.stringify((DEVIS.find((d) => d.id === x) || {}).lots || []).indexOf('Salle de réunion') >= 0, idE);
r('Devis ouvert sur le PC quand une mise à jour arrive : rien n’est rechargé pendant la saisie ; en sortant, la saisie ET la modification du téléphone sont gardées',
  titreVu && pendant.vue === 'nx_devis2' && rechPendant === 0 && apres.titre && /4321/.test(apres.notes || '') && telVoit, j({ pendant, rechPendant, apres, telVoit }), [capForm]);

/* ---- suppression d'un client sur le PC ---- */
} catch (e) { r('Devis ouvert pendant une mise à jour — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Suppression';
try {
await pret(S4, PC4); await pret(S4, TEL4);
await PC4.p.evaluate(() => { CLIENTS.push({ id: 'cx9', nom: 'Client créé par erreur', tel: '', type: 'Professionnel', adr: '', ville: '', notes: '' }); save(LS.clients, CLIENTS); });
await quitter(S4, PC4); await revenir(S4, TEL4);
const vuTel = await TEL4.p.evaluate(() => CLIENTS.some((c) => c.id === 'cx9'));
const diag = { serveur: ((S4.etat.data || {}).cp2_clients || []).some((c) => c.id === 'cx9'), pcLocal: await PC4.p.evaluate(() => load(LS.clients, []).some((c) => c.id === 'cx9')),
  tel: await TEL4.p.evaluate(() => ({ vue: _curView, lbl: (document.getElementById('cloudLbl') || {}).textContent || '', last: (load('cp2_sync', {}) || {}).lastRemote, dirty: !!localStorage.getItem('cp2_dirty'), stock: load(LS.clients, []).some((c) => c.id === 'cx9') })), srvTs: S4.etat.updated_at };
await PC4.p.evaluate(() => { const i = CLIENTS.findIndex((c) => c.id === 'cx9'); CLIENTS.splice(i, 1); save(LS.clients, CLIENTS); });
await quitter(S4, PC4); await revenir(S4, TEL4);
const resteTel = await TEL4.p.evaluate(() => CLIENTS.some((c) => c.id === 'cx9'));
r('Client ajouté puis supprimé sur le PC : il apparaît puis disparaît du téléphone', vuTel && !resteTel, j({ vuTel, resteTel, diag }));

/* ---- raccourcis ---- */
} catch (e) { r('Suppression — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Raccourcis';
try {
await pret(S4, PC4); await pret(S4, TEL4);
let resK = [];
for (let essai = 0; essai < 2 && !resK.length; essai++) {
  await lire(S4, PC4, () => go('dash')); await calme(S4, PC4);
  await PC4.p.keyboard.press('Control+k'); await PC4.p.keyboard.type('fluides'); await PC4.p.waitForTimeout(400);
  resK = await lire(S4, PC4, () => [...document.querySelectorAll('#nxSearchResults [data-nx-search] b')].map((b) => b.textContent));
}
const capK = await K.capture(PC4, 'recherche-ctrl-k');
await PC4.p.keyboard.press('Escape').catch(() => {});
/* ouverture par le raccourci, puis rechargement juste après (comme quand une mise à jour d'un autre appareil arrive à
   l'ouverture sur un réseau lent) : le bon écran doit rester */
await TEL4.p.goto(new URL('index.html?ouvrir=adr', TEL4.p.url()).href); await TEL4.p.waitForTimeout(2200); await calme(S4, TEL4);
const vue1 = await lire(S4, TEL4, () => _curView);
await TEL4.p.reload(); await TEL4.p.waitForTimeout(2200); await calme(S4, TEL4);
const ouv = await lire(S4, TEL4, () => ({ vue: _curView, adr: !!document.getElementById('nxadr'), adresse: location.search })); ouv.avantRechargement = vue1;
r('Raccourcis : Ctrl K « fluides » sur le PC propose la déclaration et l’écran ; le raccourci « Bouteilles » ouvre le bon écran sur le téléphone, même si l’appli se recharge juste après (mise à jour reçue)',
  resK.some((t) => /Déclaration annuelle des fluides/.test(t)) && vue1 === 'fluides' && ouv.vue === 'fluides' && ouv.adr && ouv.adresse === '', j({ resK: resK.slice(0, 5), ouv }), [capK]);

/* ---- tour de tous les écrans, sur les deux appareils ---- */
} catch (e) { r('Raccourcis — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Tous les écrans';
try {
await pret(S4, PC4); await pret(S4, TEL4);
const tour = [];
for (const A of [PC4, TEL4]) {
  await pret(S4, A);
  const vues = await A.p.evaluate(() => [...document.querySelectorAll('#nav a[data-v]')].map((a) => a.getAttribute('data-v')));
  const pb = []; const n0 = A.errs.length;
  const empreinte = () => A.p.evaluate(() => { const o = {}; SYNC_KEYS.forEach((k) => { const v = localStorage.getItem(k); o[k] = v == null ? '' : v.length + ':' + v.slice(-40); }); return o; }).catch(() => ({}));
  let e0 = await empreinte(); const ecritures = [];
  const r0 = A.recharges.length;
  for (const v of vues) { await lire(S4, A, (x) => { try { go(x); } catch (e) { console.error('go ' + x + ' ' + e.message); } }, v); await A.p.waitForTimeout(150);
    const e1 = await empreinte(); const ch = Object.keys(e1).filter((k) => e1[k] !== e0[k]); if (ch.length) ecritures.push(v + ':' + ch.join('+')); e0 = e1;
    const o = await lire(S4, A, () => ({ w: document.documentElement.scrollWidth, iw: innerWidth, vue: window._curView }));
    if (o.w > o.iw + 1 || o.vue !== v) pb.push({ v, ...o }); }
  tour.push({ dev: A.dev, ecrans: vues.length, pb, erreurs: A.errs.slice(n0), ecritures, rechargements: A.recharges.slice(r0).map((x) => x.pourquoi.slice(0, 90)) });
}
await pret(S4, TEL4);
for (const v of ['nx_journee', 'dash', 'nx_obj', 'fluides']) { await lire(S4, TEL4, (x) => go(x), v); await TEL4.p.waitForTimeout(300); K.etape({ partie: ETAPE, nom: 'Écran ' + v + ' (téléphone)', ok: 'INFO', detail: '', captures: [await K.capture(TEL4, 'ecran-' + v)] }); }
r('Tous les écrans du menu ouverts un par un, sur le PC et le téléphone : aucune erreur, rien qui dépasse sur le côté', tour.every((t) => t.ecrans >= 30 && !t.pb.length && !t.erreurs.length), j(tour));

/* ---- contrôle du serveur, comme le ferait la lecture SQL de vérification ---- */
} catch (e) { r('Tous les écrans — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
ETAPE = 'Contrôle du serveur';
try {
await pret(S4, PC4); await pret(S4, TEL4);
const F = S4.docs.filter((d) => d.serie === 'F' && d.annee === 2027).map((d) => d.numero).sort((a, b) => a - b);
const suite = F.every((n, i) => n === i + 1);
const parSource = {}; S4.docs.forEach((d) => { const k = j((d.payload || {}).src); parSource[k] = (parSource[k] || 0) + 1; });
const provisoire = j(S4.etat.data).indexOf('PROVISOIRE') >= 0;
const regPC = await PC4.p.evaluate(() => load('cp2_docs', []).filter((e) => e.mode === 'reel').map((e) => e.num).sort());
r('Serveur : factures F-2027-001 à ' + String(F.length).padStart(3, '0') + ' sans trou ni doublon, une seule par chantier, aucun numéro PROVISOIRE, registre complet sur le PC',
  suite && Object.values(parSource).every((n) => n === 1) && !provisoire && regPC.length === F.length, j({ F, parSource: Object.values(parSource), provisoire, regPC, ecritures: S4.ecritures, conflits: S4.conflits }));
K.etape({ partie: 'Journal', nom: 'Rechargements de l’appli après une synchro', ok: 'INFO', detail: j({ pc: PC4.recharges.length, tel: TEL4.recharges.length }), captures: [] });
if (process.env.CP_Q_DEBUG) console.log('RECHARGES', j({ pc: PC4.recharges, tel: TEL4.recharges }));
r('Aucune erreur JavaScript pendant toute la journée (PC et téléphone)', PC4.errs.length + TEL4.errs.length === 0, PC4.errs.concat(TEL4.errs).join(' | '));
} catch (e) { r('Contrôle du serveur — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
await PC4.ctx.close(); await TEL4.ctx.close();
}

/* ================= Q5 — dépannage préparé sur le PC, facturé sur le téléphone, puis « Facturer » cliqué sur le PC pas à jour ================= */
if (partie(5)) {
ETAPE = 'Dépannage : PC et téléphone';
const S5 = serveurCommun();
const PC5 = await appareil(S5, 'pc', { mobile: false, horloge: H, connecte: true });
await PC5.p.evaluate(SEED);
await PC5.p.evaluate(() => { Object.assign(P.entreprise, { nom: 'Froid Essai (fictif)', siret: '12345678900012', adresse: "1 rue de l'Exemple", cp: '60000', ville: 'Beauvais', natureChantier: 'S', assurance: 'Assureur fictif n° 0001', assuranceZone: 'France métropolitaine', mediateur: 'Médiateur fictif' });
  const ov = load(LS.over, {}); ov.entreprise = Object.assign({}, ov.entreprise || {}, P.entreprise); save(LS.over, ov); nxEmisDemarrer(todayISO(), {}); });
await pret(S5, PC5);
const TEL5 = await appareil(S5, 'tel', { mobile: true, horloge: H }); await seConnecter(S5, TEL5); await pret(S5, TEL5);
try {
  /* 1. préparé au bureau sur le PC (menu « Créer › Dépannage »), enregistré */
  await PC5.p.evaluate(() => { go('dash'); const d = document.getElementById('nxCreateMenu'); if (d) d.open = true; });
  await PC5.p.locator('.nx-create-panel button[onclick*="newDep(\'dep\')"]').first().click(); await PC5.p.waitForTimeout(400);
  await PC5.p.fill('#dp_cNom', 'Boulangerie Dupré'); await PC5.p.selectOption('#dp_cType', 'Professionnel').catch(() => {});
  await PC5.p.fill('#dp_cAdr', "1 rue de l'Exemple"); await PC5.p.fill('#dp_cVille', '60000 Beauvais');
  await PC5.p.fill('#dp_desc', 'Vitrine positive en défaut HP : condenseur encrassé, nettoyage et contrôle.');
  const capDep = await K.capture(PC5, 'depannage-prepare-pc');
  await PC5.p.locator('button[onclick="saveDep()"]:visible').first().click(); await PC5.p.waitForTimeout(300);
  const idDep = await lire(S5, PC5, () => (DEP[DEP.length - 1] || {}).id);
  await lire(S5, PC5, () => go('dep')); await pret(S5, PC5); await revenir(S5, TEL5);
  /* 2. facturé sur place depuis le téléphone ; le PC, resté ouvert au bureau, ne reçoit plus la synchro */
  S5.etatBloque.pc = true;
  await lire(S5, TEL5, (x) => openDep(x), idDep); await TEL5.p.waitForTimeout(400);
  TEL5.reponses.push(true, true);
  await TEL5.p.locator('button[onclick="factureDep()"]:visible').first().click(); await TEL5.p.waitForTimeout(500); await calme(S5, TEL5);
  await TEL5.p.evaluate(() => { const c = document.getElementById('nx-pdf-close'); if (c) c.click(); }).catch(() => {});
  const depTel = await lire(S5, TEL5, (x) => { const d = DEP.find((y) => y.id === x); return d ? { num: d.facNum, statut: d.statut } : null; }, idDep);
  const capDep2 = await K.capture(TEL5, 'depannage-facture-telephone');
  r('Dépannage préparé sur le PC, facturé sur le téléphone : numéro du serveur F-2027-001', depTel && depTel.num === 'F-2027-001' && depTel.statut === 'facturee', j({ depTel }), [capDep, capDep2]);
  await lire(S5, TEL5, () => go('dep')); await quitter(S5, TEL5);
  /* 3. le PC, resté ouvert sans recevoir la synchro, a encore le brouillon : « Facturer » ne crée pas de 2e facture */
  await lire(S5, PC5, (x) => openDep(x), idDep); await PC5.p.waitForTimeout(400);
  PC5.reponses.push(true, true);
  await PC5.p.locator('button[onclick="factureDep()"]:visible').first().click(); await PC5.p.waitForTimeout(600); await calme(S5, PC5);
  const depPC = await lire(S5, PC5, (x) => { const d = DEP.find((y) => y.id === x); return d ? { num: d.facNum, statut: d.statut } : null; }, idDep);
  /* la fiche ouverte doit montrer la facture reprise : « Enregistrer » ne doit pas effacer le numéro */
  const fiche = await lire(S5, PC5, () => ({ num: (typeof curDep !== 'undefined' && curDep) ? curDep.facNum : null }));
  await PC5.p.locator('button[onclick="saveDep()"]:visible').first().click().catch(() => {}); await PC5.p.waitForTimeout(300);
  const apresEnr = await lire(S5, PC5, (x) => { const d = DEP.find((y) => y.id === x); return d ? d.facNum : null; }, idDep);
  await lire(S5, PC5, () => go('dep')); await PC5.p.waitForTimeout(400);
  const capDep3 = await K.capture(PC5, 'depannage-pc-pas-a-jour');
  S5.etatBloque.pc = false;
  const docsDep = S5.docs.filter((d) => d.payload && d.payload.src && d.payload.src.k === 'dep').map((d) => d.num);
  r('« Facturer » cliqué ensuite sur le PC pas à jour : aucune 2e facture, le PC reprend F-2027-001',
    docsDep.length === 1 && depPC && depPC.num === 'F-2027-001', j({ docsDep, depPC, dialogues: PC5.dialogues.slice(-1).map((d) => d.msg.slice(0, 140)) }), [capDep3]);
  r('La fiche ouverte sur le PC affiche la facture reprise ; « Enregistrer » garde le numéro F-2027-001', fiche.num === 'F-2027-001' && apresEnr === 'F-2027-001', j({ fiche, apresEnr }));
} catch (e) { r('Dépannage : PC et téléphone — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
r('Aucune erreur JavaScript (dépannage)', PC5.errs.length + TEL5.errs.length === 0, PC5.errs.concat(TEL5.errs).join(' | '));
await PC5.ctx.close(); await TEL5.ctx.close();
}

/* ================= Q6 — appli rouverte plusieurs fois sans rien modifier : aucun envoi au serveur =================
   Le serveur (colonne jsonb) rend les objets avec les clés dans un autre ordre : une donnée recalculée à l'identique
   (catalogue de l'assistant…) ne doit pas passer pour une modification, sinon les deux appareils se renvoient l'état sans fin. */
if (partie(6)) {
ETAPE = 'Ouvertures sans modification';
const S6 = serveurCommun();
const PC6 = await appareil(S6, 'pc', { mobile: false, horloge: H, connecte: true });
await PC6.p.evaluate(SEED); await pret(S6, PC6);
const TEL6 = await appareil(S6, 'tel', { mobile: true, horloge: H }); await seConnecter(S6, TEL6); await pret(S6, TEL6);
/* mise au calme : les deux appareils se rouvrent et se synchronisent jusqu'à ce qu'un tour complet n'envoie plus rien */
let tours6 = 0;
for (; tours6 < 4; tours6++) { const e = S6.ecritures; await rouvrir(S6, PC6); await pret(S6, PC6); await rouvrir(S6, TEL6); await pret(S6, TEL6); await revenir(S6, PC6); await revenir(S6, TEL6); await PC6.p.waitForTimeout(800); if (S6.ecritures === e) break; }
const e0 = S6.ecritures, r0 = PC6.recharges.length + TEL6.recharges.length, T6 = Date.now(), j6 = S6.journal.length;
for (let i = 0; i < 2; i++) { await rouvrir(S6, TEL6); await pret(S6, TEL6); await rouvrir(S6, PC6); await pret(S6, PC6); await revenir(S6, TEL6); await revenir(S6, PC6); }
r('PC et téléphone rouverts deux fois chacun sans aucune modification : aucun envoi au serveur, aucun rechargement provoqué',
  S6.ecritures === e0 && PC6.recharges.length + TEL6.recharges.length === r0, j({ envois: S6.ecritures - e0, toursMiseAuCalme: tours6, rechargements: PC6.recharges.length + TEL6.recharges.length - r0, pourquoi: PC6.recharges.map((x) => 'pc@' + (x.t - T6)).concat(TEL6.recharges.map((x) => 'tel@' + (x.t - T6))), journal: S6.journal.slice(j6).map((x) => x.dev + ':' + x.nom + '@' + (x.t - T6)).filter((x) => /push|state/.test(x)).slice(0, 30), manquantes: await TEL6.p.evaluate(() => cpManquantes((JSON.parse(localStorage.getItem('cp2_sync_base') || '{}')))).catch(() => 'x') }));
r('Aucune erreur JavaScript (ouvertures)', PC6.errs.length + TEL6.errs.length === 0, PC6.errs.concat(TEL6.errs).join(' | '));
await PC6.ctx.close(); await TEL6.ctx.close();
}

/* ================= Q7 — avoir partiel et acompte émis sur le PC, téléphone pas à jour ================= */
if (partie(7)) {
ETAPE = 'Avoir partiel et acompte';
const S7 = serveurCommun();
const PC7 = await appareil(S7, 'pc', { mobile: false, horloge: H, connecte: true });
await PC7.p.evaluate(SEED);
await PC7.p.evaluate(() => { Object.assign(P.entreprise, { nom: 'Froid Essai (fictif)', siret: '12345678900012', adresse: "1 rue de l'Exemple", cp: '60000', ville: 'Beauvais', natureChantier: 'S', assurance: 'Assureur fictif n° 0001', assuranceZone: 'France métropolitaine', mediateur: 'Médiateur fictif' });
  const ov = load(LS.over, {}); ov.entreprise = Object.assign({}, ov.entreprise || {}, P.entreprise); save(LS.over, ov); nxEmisDemarrer(todayISO(), {});
  DEVIS.filter((d) => d.statut === 'accepte').forEach((d) => { d.acompteOn = true; }); save(LS.devis, DEVIS); });
await pret(S7, PC7);
const TEL7 = await appareil(S7, 'tel', { mobile: true, horloge: H }); await seConnecter(S7, TEL7); await pret(S7, TEL7);
const ids7 = await lire(S7, PC7, () => DEVIS.filter((d) => d.statut === 'accepte' && compute(d).totalHT > 0).map((d) => d.id));
try {
  /* 1. le téléphone ne reçoit plus la synchro ; le PC facture le devis X puis fait un avoir PARTIEL dessus */
  S7.etatBloque.tel = true;
  PC7.reponses.push(true, true, true);
  const fX = await lire(S7, PC7, async (x) => { await nxEmisSonde(true); await facturerDevis(x, 'solde'); const d = DEVIS.find((y) => y.id === x); return d.facSolde && d.facSolde.num; }, ids7[0]);
  await PC7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, PC7);
  const av = await lire(S7, PC7, async (n) => { const r = await nxAvoirEmit({ facNum: n, montant: 20, motif: 'Geste commercial' }); return r && (r.err || (r.av && r.av.num) || r.num || JSON.stringify(r).slice(0, 80)); }, fX);
  await PC7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, PC7);
  /* 2. le PC facture aussi l'ACOMPTE du devis Y */
  const aY = await lire(S7, PC7, async (x) => { await facturerDevis(x, 'acompte'); const d = DEVIS.find((y) => y.id === x); return d.facAcompte ? { num: d.facAcompte.num, montant: d.facAcompte.montant } : null; }, ids7[1]);
  await PC7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, PC7);
  const n0 = S7.docs.length;
  /* 3. le téléphone pas à jour : « Facturer » sur X (avoir partiel ailleurs) puis « Facturer le solde » de Y (acompte ailleurs) */
  TEL7.reponses.push(true, true, true, true);
  const tX = await lire(S7, TEL7, async (x) => { await nxEmisSonde(true); await facturerDevis(x, 'solde'); const d = DEVIS.find((y) => y.id === x); return d.facSolde && d.facSolde.num; }, ids7[0]);
  await TEL7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, TEL7);
  const nApresX = S7.docs.length;
  const tY = await lire(S7, TEL7, async (x) => { await facturerDevis(x, 'solde'); const d = DEVIS.find((y) => y.id === x); return { solde: d.facSolde ? { num: d.facSolde.num, montant: d.facSolde.montant } : null, acompte: d.facAcompte ? d.facAcompte.num : null }; }, ids7[1]);
  await TEL7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, TEL7);
  const nApresY = S7.docs.length;
  r('Avoir PARTIEL fait sur le PC : le téléphone pas à jour ne refacture pas le chantier (la facture reste due), il reprend ' + fX,
    !!fX && /^AV-/.test(String(av)) && nApresX === n0 && tX === fX, j({ fX, avoir: av, tX, docs: S7.docs.map((d) => d.num) }));
  r('Acompte facturé sur le PC : le téléphone pas à jour ne facture pas un solde qui l’ignore ; il reprend l’acompte et s’arrête',
    !!aY && nApresY === nApresX && tY.solde === null && tY.acompte === aY.num, j({ acompte: aY, tY, docs: S7.docs.map((d) => d.num), dialogues: TEL7.dialogues.slice(-1).map((d) => d.msg.slice(0, 160)) }));
  /* 4. relancé ensuite : le solde tient compte de l'acompte */
  TEL7.reponses.push(true, true);
  const tY2 = await lire(S7, TEL7, async (x) => { await facturerDevis(x, 'solde'); const d = DEVIS.find((y) => y.id === x); const c = compute(d), tot = (typeof window.nxBillTotal === 'function') ? nxBillTotal(d, c) : c.totalTTC; return { solde: d.facSolde ? d.facSolde.montant : null, attendu: Math.round((tot - d.facAcompte.montant) * 100) / 100 }; }, ids7[1]);
  await TEL7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, TEL7);
  r('Relancé ensuite sur le téléphone : la facture de solde est émise, montant = total − acompte', tY2.solde != null && Math.abs(tY2.solde - tY2.attendu) < 0.011, j(tY2));
  /* 5. devis Z : acompte F-a émis sur le PC, ANNULÉ par un avoir total (chantier libéré), acompte refait F-b ; le téléphone
     pas à jour clique « Facturer l'acompte » : il doit reprendre F-b (pas l'acompte annulé), sans 3e facture */
  const z = ids7[2];
  PC7.reponses.push(true, true, true, true);
  const zA = await lire(S7, PC7, async (x) => { await facturerDevis(x, 'acompte'); const d = DEVIS.find((y) => y.id === x); return d.facAcompte ? { num: d.facAcompte.num, montant: d.facAcompte.montant } : null; }, z);
  await PC7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, PC7);
  const zAv = await lire(S7, PC7, async (o) => { const r = await nxAvoirEmit({ facNum: o.num, montant: o.montant, motif: 'Erreur sur le montant facturé', liberer: true }); return r && (r.err || (r.av && r.av.num) || r.num || ''); }, zA);
  await PC7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, PC7);
  const zB = await lire(S7, PC7, async (x) => { await facturerDevis(x, 'acompte'); const d = DEVIS.find((y) => y.id === x); return d.facAcompte ? d.facAcompte.num : null; }, z);
  await PC7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, PC7);
  const nZ = S7.docs.length;
  TEL7.reponses.push(true, true);
  const tZ = await lire(S7, TEL7, async (x) => { await facturerDevis(x, 'acompte'); const d = DEVIS.find((y) => y.id === x); return d.facAcompte ? d.facAcompte.num : null; }, z);
  await TEL7.p.evaluate(fermerPdf).catch(() => {}); await calme(S7, TEL7);
  r('Acompte annulé par un avoir total puis refait sur le PC : le téléphone pas à jour reprend le NOUVEL acompte, pas l’acompte annulé, sans 3e facture',
    !!zA && /^AV-/.test(String(zAv)) && !!zB && zB !== zA.num && tZ === zB && S7.docs.length === nZ, j({ acompteAnnule: zA && zA.num, avoir: zAv, nouvelAcompte: zB, tel: tZ, docs: S7.docs.map((d) => d.num), dialogue: TEL7.dialogues.slice(-1).map((d) => d.msg.slice(0, 160)) }));
} catch (e) { r('Avoir partiel et acompte — essai interrompu', false, String(e && e.message || e).slice(0, 300)); }
S7.etatBloque.tel = false;
r('Aucune erreur JavaScript (avoir, acompte)', PC7.errs.length + TEL7.errs.length === 0, PC7.errs.concat(TEL7.errs).join(' | '));
await PC7.ctx.close(); await TEL7.ctx.close();
}

K.ecrire();
await fermerNavigateur();
ecrireResultats('resQ.json', RES);
RES.forEach((x) => console.log(x.ok.padEnd(5), '[' + x.group + ']', x.name, x.ok !== 'PASS' ? '— ' + x.detail : ''));
