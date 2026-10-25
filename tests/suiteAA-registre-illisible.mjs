// Suite AA — C1 (M3, 21/10/2026) : « déjà facturé depuis un autre appareil » quand le REGISTRE du serveur ne se lit pas.
// Constat reproduit par Opus : le garde-fou dejaEmis (next-emission.js) renvoie null si la lecture du registre échoue ou dure plus
// de 25 s, et l'émission part — un téléphone pas à jour émet alors un 2e solde, ou un solde qui ignore l'acompte. Le serveur
// ne l'empêchait pas (cp_emettre_document ne refuse qu'un même request_id rejoué).
// Attendu après correction : AUCUNE émission sans avoir lu le registre (message « impossible de vérifier… »), et le serveur
// refuse de lui-même une 2e facture vivante pour la même source, un solde qui ignore l'acompte, un 2e acompte.
// Banc : tests/banc-appareils.mjs (serveur commun simulé, vrai code de synchro et d'émission). Données fictives uniquement.
import { rec, RES, SEED } from './lib.mjs';
import { ecrireResultats } from './env.mjs';
import { serveurCommun, appareil, seConnecter, calme, pret, lire, revenir, couper, retablir, fermerNavigateur } from './banc-appareils.mjs';
const G = 'Registre illisible (C1)';
const j = (o) => JSON.stringify(o);
const H = '2027-09-15T08:30:00+02:00';
const r = (nom, ok, detail) => rec(G, nom, !!ok, detail);
const fermerPdf = `(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;
const MSG_ILLISIBLE = /impossible de v[ée]rifier le registre/i;
const MSG_REPRISE = /depuis un autre appareil/i;
const MSG_HORSLIGNE = /Facture NON [ée]mise/i;

/* émissions demandées au serveur par un appareil depuis un repère du journal */
const emissions = (S, dev, depuis) => S.journal.slice(depuis).filter((e) => e.dev === dev && e.sorte === 'rpc' && e.nom === 'cp_emettre_document').length;
const derniersDialogues = (A, n = 2) => A.dialogues.slice(-n).map((d) => d.msg.slice(0, 160));
const etatDevis = (S, A, id) => lire(S, A, (x) => { const d = DEVIS.find((y) => y.id === x) || {}; return { acompte: d.facAcompte ? { num: d.facAcompte.num, montant: d.facAcompte.montant } : null, solde: d.facSolde ? { num: d.facSolde.num, montant: d.facSolde.montant } : null, statut: d.statut }; }, id);
const facturer = (S, A, id, which, n = 3) => { A.reponses.push(...Array(n).fill(true)); return lire(S, A, async ([x, w]) => { await facturerDevis(x, w); }, [id, which]).then(() => A.p.evaluate(fermerPdf).catch(() => {})).then(() => calme(S, A)); };
const PARAMS = () => { Object.assign(P.entreprise, { nom: 'Froid Essai (fictif)', siret: '12345678900012', adresse: "1 rue de l'Exemple", cp: '60000', ville: 'Beauvais', natureChantier: 'S', assurance: 'Assureur fictif n° 0001', assuranceZone: 'France métropolitaine', mediateur: 'Médiateur fictif' });
  const ov = load(LS.over, {}); ov.entreprise = Object.assign({}, ov.entreprise || {}, P.entreprise); save(LS.over, ov);
  DEVIS.filter((d) => d.statut === 'accepte').forEach((d) => { d.acompteOn = true; }); save(LS.devis, DEVIS); };

/* ================= Partie 1 — facturation réelle démarrée, registre illisible / lent ================= */
{
  const S = serveurCommun();
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED);
  await PC.p.evaluate(PARAMS); await PC.p.evaluate(() => nxEmisDemarrer(todayISO(), {}));
  await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); await seConnecter(S, TEL); await pret(S, TEL);
  const ids = await lire(S, PC, () => DEVIS.filter((d) => d.statut === 'accepte' && compute(d).totalHT > 0).map((d) => d.id));
  const [X, Y, Z] = ids;
  try {
    /* le téléphone ne reçoit plus l'état synchronisé (pas à jour) et ne lit plus le registre (son rapprochement automatique au
       démarrage lirait sinon les factures du PC — c'est la course décrite par Opus dans Q7) ; le PC, lui, voit tout */
    S.etatBloque.tel = true; S.registreBloque = { tel: true };
    await lire(S, PC, () => nxEmisSonde(true));
    await facturer(S, PC, X, 'acompte'); const aX = (await etatDevis(S, PC, X)).acompte;
    await facturer(S, PC, Y, 'solde'); const sY = (await etatDevis(S, PC, Y)).solde;
    const n0 = S.docs.length;
    r('Mise en place : acompte de X et solde de Y émis sur le PC, téléphone pas à jour', !!aX && !!sY && n0 === 2 && S.docs.map((d) => d.num).join() === 'F-2027-001,F-2027-002', j({ aX, sY, docs: S.docs.map((d) => d.num) }));

    /* C1-T1 : registre ILLISIBLE, acompte émis ailleurs → rien n'est émis */
    let k = S.journal.length;
    await lire(S, TEL, () => nxEmisSonde(true));
    await facturer(S, TEL, X, 'solde');
    let e = await etatDevis(S, TEL, X);
    r('T1 — registre illisible, acompte émis sur le PC : le téléphone n’émet RIEN (aucune demande au serveur), devis inchangé, message « impossible de vérifier »',
      S.docs.length === n0 && emissions(S, 'tel', k) === 0 && e.solde === null && e.acompte === null && TEL.dialogues.some((d) => MSG_ILLISIBLE.test(d.msg)),
      j({ docs: S.docs.map((d) => d.num), emissions: emissions(S, 'tel', k), devis: e, dialogues: derniersDialogues(TEL) }));

    /* C1-T2 : registre illisible, solde déjà émis ailleurs → rien */
    k = S.journal.length; TEL.dialogues.length = 0;
    await facturer(S, TEL, Y, 'solde');
    e = await etatDevis(S, TEL, Y);
    r('T2 — registre illisible, solde déjà émis sur le PC : pas de 2e solde, aucune demande au serveur, message',
      S.docs.length === n0 && emissions(S, 'tel', k) === 0 && e.solde === null && TEL.dialogues.some((d) => MSG_ILLISIBLE.test(d.msg)),
      j({ docs: S.docs.map((d) => d.num), emissions: emissions(S, 'tel', k), devis: e, dialogues: derniersDialogues(TEL) }));

    /* C1-T3 : registre illisible, AUCUNE facture ailleurs → rien non plus (la règle : on n'émet pas sans avoir lu) */
    k = S.journal.length; TEL.dialogues.length = 0;
    await facturer(S, TEL, Z, 'solde');
    e = await etatDevis(S, TEL, Z);
    r('T3 — registre illisible, aucune facture ailleurs : rien n’est émis non plus (on n’émet jamais sans avoir lu le registre)',
      S.docs.length === n0 && emissions(S, 'tel', k) === 0 && e.solde === null && TEL.dialogues.some((d) => MSG_ILLISIBLE.test(d.msg)),
      j({ docs: S.docs.map((d) => d.num), emissions: emissions(S, 'tel', k), devis: e, dialogues: derniersDialogues(TEL) }));
    r('T1-T3 — aucun numéro PROVISOIRE laissé sur les devis du téléphone', !/PROVISOIRE/.test(await lire(S, TEL, () => JSON.stringify(DEVIS.map((d) => [d.facAcompte, d.facSolde])))), '');

    /* C1-T4 : registre LENT (la lecture ne revient pas) → au bout du délai, même refus ; l'horloge de la page est avancée */
    S.registreBloque = {}; S.registrePendu = { tel: true }; k = S.journal.length; TEL.dialogues.length = 0;
    TEL.reponses.push(true, true, true);
    await TEL.p.evaluate((x) => { window.__c1 = facturerDevis(x, 'solde'); }, Z);
    await TEL.p.waitForTimeout(600);
    const avantDelai = { docs: S.docs.length, emissions: emissions(S, 'tel', k) };
    await TEL.p.clock.fastForward(26000);
    await TEL.p.waitForTimeout(400);
    S.registrePendu = {};
    await TEL.p.evaluate(() => window.__c1).catch(() => {}); await TEL.p.evaluate(fermerPdf).catch(() => {}); await calme(S, TEL);
    e = await etatDevis(S, TEL, Z);
    r('T4 — registre lent (plus de 25 s) : rien n’est émis, message à la fin du délai, devis inchangé',
      avantDelai.docs === n0 && S.docs.length === n0 && emissions(S, 'tel', k) === 0 && e.solde === null && TEL.dialogues.some((d) => MSG_ILLISIBLE.test(d.msg)),
      j({ avantDelai, docs: S.docs.map((d) => d.num), emissions: emissions(S, 'tel', k), devis: e, dialogues: derniersDialogues(TEL) }));

    /* C1-T5 : registre lisible de nouveau → reprise de l'acompte avec message, puis solde = total − acompte, un seul solde */
    k = S.journal.length; TEL.dialogues.length = 0;
    await facturer(S, TEL, X, 'solde');
    e = await etatDevis(S, TEL, X);
    r('T5a — registre lisible : « émise depuis un autre appareil », acompte repris, aucune nouvelle facture',
      S.docs.length === n0 && e.acompte && e.acompte.num === aX.num && e.solde === null && TEL.dialogues.some((d) => MSG_REPRISE.test(d.msg)),
      j({ docs: S.docs.map((d) => d.num), devis: e, dialogues: derniersDialogues(TEL) }));
    await facturer(S, TEL, X, 'solde');
    const t5 = await lire(S, TEL, (x) => { const d = DEVIS.find((y) => y.id === x); const c = compute(d), tot = (typeof window.nxBillTotal === 'function') ? nxBillTotal(d, c) : c.totalTTC; return { solde: d.facSolde ? d.facSolde.montant : null, num: d.facSolde ? d.facSolde.num : null, attendu: Math.round((tot - d.facAcompte.montant) * 100) / 100 }; }, X);
    r('T5b — relancé : le solde est émis, montant = total − acompte, un seul solde pour X au registre',
      t5.solde != null && Math.abs(t5.solde - t5.attendu) < 0.011 && S.docs.length === n0 + 1 && S.docs.filter((d) => d.payload.src && d.payload.src.id === X && d.payload.src.w === 'solde').length === 1,
      j({ t5, docs: S.docs.map((d) => d.num) }));

    /* C1-T6 : refus par le SERVEUR — le téléphone croit pouvoir émettre (registre lu AVANT l'émission du PC) : simulé en
       émettant sur le PC un acompte de Z pendant que le registre du téléphone est figé sur une lecture ancienne. Ici : le
       téléphone a lu le registre, puis le PC émet l'acompte de Z, puis le téléphone demande le solde au serveur. */
    k = S.journal.length; TEL.dialogues.length = 0;
    const n1 = S.docs.length;
    /* le registre répond au téléphone avec une copie figée d'AVANT l'acompte : on fige la liste, le PC émet, puis on la relâche au moment de l'émission */
    const fige = S.docs.slice(); const origFrom = S.appel; let premiereLecture = true;
    S.appel = async (dev, sorte, a, b) => { if (premiereLecture && dev === 'tel' && sorte === 'from' && a && a.t === 'climpilot_documents') { premiereLecture = false; const vrai = S.docs; S.docs = fige; try { return await origFrom(dev, sorte, a, b); } finally { S.docs = vrai; } } return origFrom(dev, sorte, a, b); };
    await facturer(S, PC, Z, 'acompte'); const aZ = (await etatDevis(S, PC, Z)).acompte;
    await facturer(S, TEL, Z, 'solde');
    S.appel = origFrom;
    e = await etatDevis(S, TEL, Z);
    r('T6 — le registre lu par le téléphone est périmé : le SERVEUR refuse le solde qui ignore l’acompte, l’acompte est repris, rien d’autre n’est émis',
      !!aZ && S.docs.length === n1 + 1 && e.solde === null && e.acompte && e.acompte.num === aZ.num && TEL.dialogues.some((d) => MSG_REPRISE.test(d.msg)),
      j({ aZ, docs: S.docs.map((d) => d.num), devis: e, dialogues: derniersDialogues(TEL) }));

    /* C1-T7 : hors ligne → « Facture NON émise », rien de plus (inchangé) */
    k = S.journal.length; TEL.dialogues.length = 0; S.etatBloque.tel = false;
    await couper(S, TEL);
    await lire(S, TEL, () => nxEmisSonde(true)); await facturer(S, TEL, Z, 'solde');
    e = await etatDevis(S, TEL, Z);
    await retablir(S, TEL);
    r('T7 — hors ligne : « Facture NON émise », aucune demande, devis inchangé',
      S.docs.length === n1 + 1 && emissions(S, 'tel', k) === 0 && e.solde === null && TEL.dialogues.some((d) => MSG_HORSLIGNE.test(d.msg)),
      j({ docs: S.docs.map((d) => d.num), devis: e, dialogues: derniersDialogues(TEL) }));
  } catch (err) { r('Partie 1 — essai interrompu', false, String(err && err.message || err).slice(0, 300)); }
  r('Aucune erreur JavaScript (partie 1)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | '));
  await PC.ctx.close(); await TEL.ctx.close();
}

/* ================= Partie 2 — mode DÉMONSTRATION (numéros TEST-) : même règle, appuyée sur l'état synchronisé ================= */
/* En démo il n'y a pas de registre serveur : la seule information « déjà facturé ailleurs » est l'état synchronisé. La règle
   devient : ne pas émettre si l'appareil ne peut pas vérifier qu'il est à jour (lecture impossible) ou s'il ne l'est pas. */
{
  const S = serveurCommun();
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED); await PC.p.evaluate(PARAMS); await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); await seConnecter(S, TEL); await pret(S, TEL);
  const ids = await lire(S, PC, () => DEVIS.filter((d) => d.statut === 'accepte' && compute(d).totalHT > 0).map((d) => d.id));
  const X = ids[0];
  try {
    const mode = await lire(S, PC, () => nxEmisMode().mode);
    /* le PC se remet à jour (le téléphone vient d'écrire son état en se connectant), puis le téléphone est coupé de l'état */
    await revenir(S, PC); await pret(S, PC);
    S.etatBloque.tel = true;
    await facturer(S, PC, X, 'acompte'); const aX = (await etatDevis(S, PC, X)).acompte;
    r('Démo — mise en place : mode « demo », acompte TEST émis sur le PC (à jour), téléphone pas à jour', mode === 'demo' && !!aX && /^TEST-F-/.test(aX.num) && S.docs.length === 0, j({ mode, aX, dialoguesPC: derniersDialogues(PC) }));
    /* T8a : l'état ne se lit pas depuis le téléphone → rien n'est émis */
    TEL.dialogues.length = 0;
    await facturer(S, TEL, X, 'solde');
    let e = await etatDevis(S, TEL, X);
    r('T8a — démo, état synchronisé illisible : le téléphone n’émet pas de solde TEST, message « impossible de vérifier »',
      e.solde === null && TEL.dialogues.some((d) => MSG_ILLISIBLE.test(d.msg)), j({ devis: e, dialogues: derniersDialogues(TEL) }));
    /* T8b : l'état se lit mais n'a pas encore été reçu (plus récent sur le serveur) → rien n'est émis, « pas à jour » */
    S.etatBloque.tel = false; TEL.dialogues.length = 0;
    await facturer(S, TEL, X, 'solde');
    e = await etatDevis(S, TEL, X);
    r('T8b — démo, état plus récent sur le serveur pas encore reçu : rien n’est émis, message « pas à jour »',
      e.solde === null && TEL.dialogues.some((d) => /pas (encore )?à jour|synchronis/i.test(d.msg)), j({ devis: e, dialogues: derniersDialogues(TEL) }));
    /* T8c : après synchro, le solde TEST = total − acompte */
    await revenir(S, TEL); await TEL.p.waitForTimeout(800); await calme(S, TEL);
    await facturer(S, TEL, X, 'solde');
    const t8 = await lire(S, TEL, (x) => { const d = DEVIS.find((y) => y.id === x); const c = compute(d), tot = (typeof window.nxBillTotal === 'function') ? nxBillTotal(d, c) : c.totalTTC; return { acompte: d.facAcompte ? d.facAcompte.num : null, solde: d.facSolde ? d.facSolde.montant : null, num: d.facSolde ? d.facSolde.num : null, attendu: d.facAcompte ? Math.round((tot - d.facAcompte.montant) * 100) / 100 : null }; }, X);
    r('T8c — démo, après synchro : acompte connu, solde TEST = total − acompte', t8.acompte === aX.num && t8.solde != null && Math.abs(t8.solde - t8.attendu) < 0.011 && /^TEST-F-/.test(t8.num), j(t8));
  } catch (err) { r('Partie 2 — essai interrompu', false, String(err && err.message || err).slice(0, 300)); }
  r('Aucune erreur JavaScript (partie 2)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | '));
  await PC.ctx.close(); await TEL.ctx.close();
}

await fermerNavigateur();
ecrireResultats('resAA.json', RES);
RES.forEach((x) => console.log(x.ok.padEnd(5), '[' + x.group + ']', x.name, x.ok !== 'PASS' ? '— ' + x.detail : ''));
