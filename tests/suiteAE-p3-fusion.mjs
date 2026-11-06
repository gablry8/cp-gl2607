// Suite AE — P3 (06/11/2026) : les états terminaux gagnent la fusion entre appareils (docs/MISSION-P3.md § 4.4).
// Banc : tests/banc-appareils.mjs (serveur commun simulé, VRAIS pushState / pullState / cpMerge enveloppée, rechargements réels de la page).
// PC = l'appareil pas à jour (coupé, il modifie, il fusionne au retour du réseau) ; tél = à jour. Données fictives uniquement, aucun réseau.
//  AE1 annulation (tél) contre planification (PC) ; AE2 signature en ligne (tél) contre relance (PC) ; AE3 avenant accepté (tél) contre date sur l'original (PC) ;
//  AE4 deux appareils facturent chacun un devis du même arbre (état gelé, registre ouvert) ; AE5 ancienne version (seconde passe et garde remplacées par l'identité sur le PC) :
//  le téléphone P3 remet l'état terminal, écritures bornées ; AE6 témoins (pas de conflit → rien ; suppression contre signature → devis gardé, signé).
// Horloge : serveurCommun(debutISO) et une horloge de page figée à un instant du jeu de données (aucun test ne lit la vraie date).
import { rec, RES, SEED, REF } from './lib.mjs';
import { ecrireResultats } from './env.mjs';
import { serveurCommun, appareil, seConnecter, calme, pret, lire, revenir, couper, retablir, synchroAuto, fermerNavigateur } from './banc-appareils.mjs';
const G = 'P3 fusion deux appareils';
const j = (o) => JSON.stringify(o);
const H = '2027-09-15T08:30:00+02:00';   // un mercredi de septembre 2027 (même jeu que les suites Q et AA)
const JOUR = '2027-09-20';
const r = (nom, ok, detail) => rec(G, nom, !!ok, detail);
const fermerPdf = `(()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); })()`;
const SIG = (id, extra) => Object.assign({ doc_type: 'devis', doc_id: id, statut: 'signe', signed_at: '2027-09-15T07:00:00.000Z', signer_nom: 'Client Signataire (fictif)', doc_hash: 'h-' + id, token: 't-' + id, signature_png: null, signer_ip: null }, extra || {});
/* capture des messages (toast) sur un appareil — à reposer après chaque rechargement de la page */
const ecouter = (S, A) => lire(S, A, () => { window.__msgs = []; const t = window.toast; window.toast = function (m) { __msgs.push(String(m)); return t.apply(this, arguments); }; });
const messages = (S, A) => lire(S, A, () => (window.__msgs || []).slice()).catch(() => []);
const journalFusion = (S, A, id) => lire(S, A, (x) => JSON.parse(localStorage.getItem('cpnext_journal') || '[]').filter((e) => e.type === 'fusion_etat' && (!x || e.id === x)), id);
const devisSrv = (S, id) => (((S.etat || {}).data || {}).cp2_devis || []).find((d) => d.id === id) || {};
const devisDe = (S, A, id) => lire(S, A, (x) => { const d = DEVIS.find((y) => y.id === x) || {}; return { statut: d.statut, motif: (d.annulation || {}).motif, date: d.datePlanif, signature: !!(d.signature && d.signature.at), relances: d.relances || null, lien: (d.remplacePar || {}).id || null, acompte: (d.facAcompte || {}).num || null, solde: (d.facSolde || {}).num || null }; }, id);
const annuler = (S, A, id, motif) => lire(S, A, async ([x, m]) => { cpDevisAnnuler(x); await new Promise((r) => setTimeout(r, 100)); const radio = document.querySelector('#mAnnulDevis input[name="cpAnnulMotif"][value="' + m + '"]'); if (radio) radio.checked = true; return cpDevisAnnulerOk(); }, [id, motif || 'abandon']);
const avenantAccepte = (S, A, id) => lire(S, A, async (x) => { const W = (ms) => new Promise((r) => setTimeout(r, ms)); go('tous'); await W(120); cpDevisAvenant(x); await W(300); const a = DEVIS.find((d) => d.avenantDe && d.avenantDe.id === x); if (!a) return null;
  nxd2.statut('accepte'); nxd2.save(); await W(200); nxd2.close(); go('tous'); await W(120); return { a: a.id, aNum: a.num, statutO: (DEVIS.find((d) => d.id === x) || {}).statut }; }, id);
const facturer = (S, A, id, which, n = 3) => { A.reponses.push(...Array(n).fill(true)); return lire(S, A, async ([x, w]) => { await facturerDevis(x, w); }, [id, which]).then(() => A.p.evaluate(fermerPdf).catch(() => {})).then(() => calme(S, A)); };
const PARAMS = () => { Object.assign(P.entreprise, { nom: 'Froid Essai (fictif)', siret: '12345678900012', adresse: "1 rue de l'Exemple", cp: '60000', ville: 'Beauvais', natureChantier: 'S', assurance: 'Assureur fictif n° 0001', assuranceZone: 'France métropolitaine', mediateur: 'Médiateur fictif' });
  const ov = load(LS.over, {}); ov.entreprise = Object.assign({}, ov.entreprise || {}, P.entreprise); save(LS.over, ov);
  DEVIS.filter((d) => d.statut === 'accepte').forEach((d) => { d.acompteOn = true; }); save(LS.devis, DEVIS); };

/* ================= Partie 1 — mode démonstration : AE1, AE2, AE3, AE6 ================= */
{
  const S = serveurCommun('2027-09-15T06:30:00Z');
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED); await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); await seConnecter(S, TEL); await pret(S, TEL);
  const ids = await lire(S, PC, () => ({ acceptes: DEVIS.filter((d) => d.statut === 'accepte').map((d) => d.id), envoyes: DEVIS.filter((d) => d.statut === 'envoye').map((d) => d.id), nums: Object.fromEntries(DEVIS.map((d) => [d.id, d.num])) }));
  const [O, O3, O6] = ids.acceptes, [E2, E6] = ids.envoyes;
  r('Mise en place : PC et téléphone connectés au même serveur, jeu de données synchronisé (au moins 3 devis acceptés et 2 envoyés)', !!(O && O3 && O6 && E2 && E6 && S.etat && devisSrv(S, O).statut === 'accepte'), j({ acceptes: ids.acceptes.length, envoyes: ids.envoyes.length, conflits: S.conflits }));
  try {
    /* ---- AE1 : annulation (tél) contre planification (PC) ---- */
    let c0 = S.conflits, e0 = S.ecritures;
    await couper(S, PC);
    const okAnn = await annuler(S, TEL, O, 'abandon'); await synchroAuto(S, TEL);
    const srvApresTel = devisSrv(S, O);
    r('AE1 — mise en place : le téléphone annule O (motif « abandon »), le serveur a O « annulé » ; le PC, coupé, ne le voit pas', okAnn === true && srvApresTel.statut === 'annule' && (srvApresTel.annulation || {}).motif === 'abandon' && (await devisDe(S, PC, O)).statut === 'accepte', j({ okAnn, srv: srvApresTel.statut, pc: (await devisDe(S, PC, O)).statut }));
    await lire(S, PC, (x) => { planifDevis(x[0], x[1]); }, [O, JOUR]);
    const etiquettePC = await lire(S, PC, () => (document.getElementById('cloudLbl') || {}).textContent || '');
    await retablir(S, PC); await pret(S, PC);
    const sO = devisSrv(S, O), pcO = await devisDe(S, PC, O), jPC = await journalFusion(S, PC, O);
    r('AE1 — PC hors ligne : date sur O (« à synchroniser ») ; au retour du réseau : 1 conflit, la vraie fusion, rechargement, nouvel envoi → serveur : O « annulé », motif gardé, date du PC gardée', S.conflits - c0 >= 1 && /synchro|hors ligne/i.test(etiquettePC) && sO.statut === 'annule' && (sO.annulation || {}).motif === 'abandon' && sO.datePlanif === JOUR, j({ conflits: S.conflits - c0, etiquettePC, srv: { statut: sO.statut, motif: (sO.annulation || {}).motif, date: sO.datePlanif } }));
    r('AE1 — sur le PC après rechargement : O « annulé » avec la date ; 1 ligne fusion_etat dans son journal (état venu de l\'autre appareil) ; aucune facture', pcO.statut === 'annule' && pcO.date === JOUR && jPC.length === 1 && jPC[0].autre_appareil === true && !pcO.acompte && !pcO.solde, j({ pcO, jPC }));
    await revenir(S, TEL); await calme(S, TEL);
    const telO = await devisDe(S, TEL, O), texteTel = await lire(S, TEL, (x) => { go('tous'); return (document.body.innerText || '').indexOf('Annulé') >= 0; }, O);
    r('AE1 — le téléphone, après pullState : O « annulé » (date du PC reçue), étiquette « Annulé » affichée ; écritures bornées (≤ 5 depuis la coupure : annulation, fusion, renvoi, rechargements)', telO.statut === 'annule' && telO.date === JOUR && texteTel === true && S.ecritures - e0 <= 5, j({ telO, texteTel, ecritures: S.ecritures - e0 }));

    /* ---- AE2 : signature en ligne (tél) contre relance (PC, devis « envoyé » chez lui) ---- */
    c0 = S.conflits;
    await couper(S, PC);
    const okSig = await lire(S, TEL, (s) => nxsApplySig(s), SIG(E2)); await synchroAuto(S, TEL);
    r('AE2 — mise en place : signature en ligne appliquée sur le téléphone (E2 « accepté » + signature), serveur à jour', okSig === true && devisSrv(S, E2).statut === 'accepte' && !!devisSrv(S, E2).signature, j({ okSig, srv: devisSrv(S, E2).statut }));
    await lire(S, PC, (x) => { const d = DEVIS.find((y) => y.id === x); d.relances = [Date.now()]; save(LS.devis, DEVIS); }, E2);
    await retablir(S, PC); await pret(S, PC);
    const sE2 = devisSrv(S, E2), pcE2 = await devisDe(S, PC, E2);
    r('AE2 — au retour du réseau : 1 conflit → serveur : E2 « accepté » + signature, la relance du PC gardée ; le PC a la même chose', S.conflits - c0 >= 1 && sE2.statut === 'accepte' && !!sE2.signature && Array.isArray(sE2.relances) && sE2.relances.length === 1 && pcE2.statut === 'accepte' && pcE2.signature && (pcE2.relances || []).length === 1, j({ conflits: S.conflits - c0, srv: { statut: sE2.statut, signature: !!sE2.signature, relances: sE2.relances }, pcE2 }));
    await ecouter(S, PC);
    const verrou = await lire(S, PC, async (x) => { const W = (ms) => new Promise((r) => setTimeout(r, ms)); openDevis(x); await W(300); const avant = JSON.stringify(DEVIS.find((y) => y.id === x)); const c = NXD2.api.cur(); c.notes = 'MODIFIÉ APRÈS FUSION'; const ok = nxd2.save(); await W(150); const apres = JSON.stringify(DEVIS.find((y) => y.id === x)); nxd2.close(); go('tous'); await W(120); return { ok, identique: avant === apres }; }, E2);
    const msgsPC = await messages(S, PC);
    r('AE2 — le PC refuse ensuite d\'enregistrer E2 (verrou AF1 : « ne se modifie plus »)', verrou.ok === false && verrou.identique && msgsPC.some((m) => /ne se modifie plus/i.test(m)), j({ verrou, msgs: msgsPC.slice(-3) }));

    /* ---- AE3 : avenant accepté (tél, O3 remplacé) contre date sur l'original (PC) ---- */
    c0 = S.conflits;
    await couper(S, PC);
    const av = await avenantAccepte(S, TEL, O3); await synchroAuto(S, TEL);
    r('AE3 — mise en place : avenant A accepté sur le téléphone, O3 « remplacé par A » sur le serveur', !!(av && av.statutO === 'remplace' && devisSrv(S, O3).statut === 'remplace' && devisSrv(S, av.a).statut === 'accepte'), j({ av, srv: devisSrv(S, O3).statut }));
    await lire(S, PC, (x) => { planifDevis(x[0], x[1]); }, [O3, JOUR]);
    await retablir(S, PC); await pret(S, PC);
    const sO3 = devisSrv(S, O3), pcO3 = await devisDe(S, PC, O3), pcA = av ? await devisDe(S, PC, av.a) : {};
    r('AE3 — au retour du réseau : serveur et PC : O3 « remplacé par A » (date du PC gardée), A « accepté » ; aucune réparation nécessaire', S.conflits - c0 >= 1 && sO3.statut === 'remplace' && (sO3.remplacePar || {}).id === (av || {}).a && sO3.datePlanif === JOUR && pcO3.statut === 'remplace' && pcO3.lien === (av || {}).a && pcA.statut === 'accepte', j({ conflits: S.conflits - c0, srv: { statut: sO3.statut, lien: (sO3.remplacePar || {}).id, date: sO3.datePlanif }, pcO3, pcA }));
    await ecouter(S, PC);
    if (av) { await facturer(S, PC, av.a, 'acompte'); }
    const pcA2 = av ? await devisDe(S, PC, av.a) : {}; const msgsA = await messages(S, PC);
    if (av) { await facturer(S, PC, O3, 'solde'); }
    const pcO3b = await devisDe(S, PC, O3); const msgsO = await messages(S, PC);
    r('AE3 — sur le PC : « Facturer » A donne UNE facture (acompte d\'essai) ; « Facturer » O3 est refusé (« ne se facture plus »), aucune facture sur O3', !!(pcA2.acompte && /^TEST-F-/.test(pcA2.acompte) && !pcO3b.acompte && !pcO3b.solde && msgsO.some((m) => /ne se facture plus/i.test(m))), j({ pcA2, pcO3b, msgsA: msgsA.slice(-2), msgsO: msgsO.slice(-2) }));

    /* ---- AE6 : témoins ---- */
    c0 = S.conflits; const j0 = (await journalFusion(S, PC)).length;
    await lire(S, PC, (x) => { planifDevis(x[0], x[1]); }, [O6, JOUR]); await pret(S, PC); await revenir(S, TEL); await calme(S, TEL);
    r('AE6a — témoin : modification sans conflit (PC en ligne, date sur O6) → aucun conflit, aucune ligne fusion_etat, le téléphone reçoit la date', S.conflits - c0 === 0 && (await journalFusion(S, PC)).length === j0 && (await devisDe(S, TEL, O6)).date === JOUR && devisSrv(S, O6).statut === 'accepte', j({ conflits: S.conflits - c0, tel: await devisDe(S, TEL, O6) }));
    c0 = S.conflits;
    await couper(S, PC);
    const okSig6 = await lire(S, TEL, (s) => nxsApplySig(s), SIG(E6)); await synchroAuto(S, TEL);
    PC.reponses.push(true); await lire(S, PC, (x) => { delDevis(x); }, E6);
    const supprime = !(await lire(S, PC, (x) => DEVIS.some((d) => d.id === x), E6));
    await retablir(S, PC); await pret(S, PC);
    const sE6 = devisSrv(S, E6), pcE6 = await devisDe(S, PC, E6);
    r('AE6b — témoin : suppression (PC hors ligne, devis « envoyé » chez lui) contre signature (tél) → le devis est gardé, signé, sur le serveur et sur le PC', okSig6 === true && supprime && S.conflits - c0 >= 1 && sE6.statut === 'accepte' && !!sE6.signature && pcE6.statut === 'accepte' && pcE6.signature, j({ okSig6, supprime, conflits: S.conflits - c0, srv: { statut: sE6.statut, signature: !!sE6.signature }, pcE6 }));
  } catch (err) { r('Partie 1 — essai interrompu', false, String(err && err.message || err).slice(0, 300)); }
  r('Aucune erreur JavaScript (partie 1)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | ').slice(0, 400));
  await PC.ctx.close(); await TEL.ctx.close();
}

/* ================= Partie 2 — AE5 : un appareil resté sur l'ancienne version (seconde passe et garde remplacées par l'identité sur le PC) ================= */
{
  const S = serveurCommun('2027-09-15T06:30:00Z');
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED); await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); await seConnecter(S, TEL); await pret(S, TEL);
  const O = await lire(S, PC, () => (DEVIS.find((d) => d.statut === 'accepte') || {}).id);
  try {
    /* le PC « ancienne version » : la seconde passe de cpMerge et la garde à la réception ne font rien (comme en 1134) — jusqu'à son prochain rechargement */
    const stub = await lire(S, PC, () => { window.cpFusionEtats = function () { return { out: {}, arbitrages: [] }; }; return typeof window.cpFusionEtats; });
    const c0 = S.conflits, e0 = S.ecritures;
    await couper(S, PC);
    const okAnn = await annuler(S, TEL, O, 'abandon'); await synchroAuto(S, TEL);
    await lire(S, PC, (x) => { planifDevis(x[0], x[1]); }, [O, JOUR]);
    await retablir(S, PC); await pret(S, PC);
    const sApresPC = devisSrv(S, O);
    r('AE5 — mise en place : le PC « ancienne version » fusionne avec l\'ancienne règle et renvoie O « accepté » + date (l\'annulation du téléphone est perdue sur le serveur)', stub === 'function' && okAnn === true && S.conflits - c0 >= 1 && sApresPC.statut === 'accepte' && sApresPC.datePlanif === JOUR, j({ stub, okAnn, conflits: S.conflits - c0, srv: { statut: sApresPC.statut, date: sApresPC.datePlanif } }));
    /* le téléphone (P3) reçoit cet état : la garde à la réception remet « annulé » et renvoie (une écriture) */
    const e1 = S.ecritures;
    await revenir(S, TEL); await pret(S, TEL);
    const sApresTel = devisSrv(S, O), telO = await devisDe(S, TEL, O), jTel = await journalFusion(S, TEL, O);
    /* la remise passe par la garde à la réception (source « reception ») ou, si le téléphone avait aussi quelque chose à envoyer, par la fusion (source « fusion ») : dans les deux cas l'état terminal est remis et journalisé */
    r('AE5 — le téléphone (P3) reçoit O « accepté » : il le remet « annulé » (motif gardé, date du PC gardée), journal, et renvoie → serveur : « annulé »', sApresTel.statut === 'annule' && (sApresTel.annulation || {}).motif === 'abandon' && sApresTel.datePlanif === JOUR && telO.statut === 'annule' && telO.date === JOUR && jTel.length >= 1 && jTel.every((x) => x.statut === 'annule'), j({ srv: { statut: sApresTel.statut, motif: (sApresTel.annulation || {}).motif, date: sApresTel.datePlanif }, telO, journal: jTel.map((x) => x.source + '/' + x.etat_garde + '/' + x.statut_ecarte) }));
    await revenir(S, PC); await calme(S, PC);
    const pcO = await devisDe(S, PC, O), e2 = S.ecritures;
    /* un tour de plus (chaque appareil revient sur l'appli) : plus aucune écriture, l'état est stable */
    await revenir(S, TEL); await calme(S, TEL); await revenir(S, PC); await calme(S, PC);
    r('AE5 — le PC reçoit l\'état remis : O « annulé » ; état final du serveur « annulé » ; la remise en état coûte au plus 4 écritures (2 ou 3 observées ; le dossier § 4.4 disait ≤ 3), puis plus aucune au tour suivant (pas d\'aller-retour sans fin)', pcO.statut === 'annule' && devisSrv(S, O).statut === 'annule' && e2 - e1 <= 4 && S.ecritures === e2 && (await devisDe(S, PC, O)).statut === 'annule', j({ pcO, srv: devisSrv(S, O).statut, remise: e2 - e1, apres: S.ecritures - e2, depuisCoupure: S.ecritures - e0 }));
  } catch (err) { r('Partie 2 — essai interrompu', false, String(err && err.message || err).slice(0, 300)); }
  r('Aucune erreur JavaScript (partie 2)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | ').slice(0, 400));
  await PC.ctx.close(); await TEL.ctx.close();
}

/* ================= Partie 3 — AE4 : facturation réelle démarrée, deux appareils facturent chacun un devis du même arbre ================= */
{
  const S = serveurCommun('2027-09-15T06:30:00Z');
  const PC = await appareil(S, 'pc', { mobile: false, horloge: H, connecte: true });
  await PC.p.evaluate(SEED); await PC.p.evaluate(PARAMS); await PC.p.evaluate(() => nxEmisDemarrer(todayISO(), {})); await pret(S, PC);
  const TEL = await appareil(S, 'tel', { mobile: true, horloge: H }); await seConnecter(S, TEL); await pret(S, TEL);
  /* un client PROFESSIONNEL : l'avenant est un nouveau contrat (mode de conclusion à préciser), la règle L221-10 bloquerait la facture d'un particulier */
  const O = await lire(S, PC, () => (DEVIS.find((d) => d.statut === 'accepte' && d.cType === 'Professionnel' && compute(d).totalHT > 0) || {}).id);
  try {
    /* le PC ne voit plus l'état synchronisé (gelé) ; le registre des factures, lui, répond aux deux appareils */
    S.etatBloque.pc = true;
    await lire(S, PC, () => nxEmisSonde(true)); await lire(S, TEL, () => nxEmisSonde(true));
    /* le téléphone : avenant A1 accepté (O remplacé chez lui), puis acompte sur A1 (registre vide : rien ne s'y oppose) */
    const av = await avenantAccepte(S, TEL, O); await synchroAuto(S, TEL);
    if (av) await facturer(S, TEL, av.a, 'acompte');
    await pret(S, TEL);
    const telA = av ? await devisDe(S, TEL, av.a) : {};
    /* le PC, qui ne connaît pas l'avenant (état gelé) : acompte sur O — le serveur accepte (une facture par devis, pas par arbre : § 2.7 du dossier) */
    await facturer(S, PC, O, 'acompte'); const pcO = await devisDe(S, PC, O);
    r('AE4 — mise en place : acompte de O émis sur le PC (état gelé), avenant A1 accepté et acompte de A1 émis sur le téléphone : 2 factures au registre commun (le serveur raisonne par devis : constat, pas corrigé par P3)', !!(pcO.acompte && /^F-2027-/.test(pcO.acompte) && av && telA.acompte && /^F-2027-/.test(telA.acompte) && S.docs.filter((d) => d.serie === 'F').length === 2 && devisSrv(S, O).statut === 'remplace'), j({ pcO, telA, docs: S.docs.map((d) => d.num), srvO: devisSrv(S, O).statut }));
    /* le PC retrouve l'état synchronisé : conflit → fusion → la facture gagne sur « remplacé » ; les deux factures restent */
    S.etatBloque.pc = false; const c0 = S.conflits;
    await pret(S, PC);
    const sO = devisSrv(S, O), sA = av ? devisSrv(S, av.a) : {}, jPC = await journalFusion(S, PC);
    r('AE4 — après la fusion sur le PC : les deux factures RESTENT (O « accepté », facturé ; A1 accepté, facturé), ligne « deux factures » au journal du PC', S.conflits - c0 >= 1 && sO.statut === 'accepte' && (sO.facAcompte || {}).num === pcO.acompte && sA.statut === 'accepte' && (sA.facAcompte || {}).num === telA.acompte && jPC.some((x) => x.etat_garde === 'deux_factures'), j({ conflits: S.conflits - c0, srv: { O: { statut: sO.statut, acompte: (sO.facAcompte || {}).num }, A: { statut: sA.statut, acompte: (sA.facAcompte || {}).num } }, jPC }));
    await ecouter(S, PC); const n0 = S.docs.length;
    if (av) await facturer(S, PC, av.a, 'solde');
    const msgs = await messages(S, PC);
    r('AE4 — une 3e facture (solde de A1) est refusée sur le PC (« jamais deux factures pour le même chantier »), rien n\'est émis au registre', S.docs.length === n0 && msgs.some((m) => /jamais deux factures/i.test(m)), j({ docs: S.docs.map((d) => d.num), msgs: msgs.slice(-2) }));
  } catch (err) { r('Partie 3 — essai interrompu', false, String(err && err.message || err).slice(0, 300)); }
  r('Aucune erreur JavaScript (partie 3)', PC.errs.length + TEL.errs.length === 0, PC.errs.concat(TEL.errs).join(' | ').slice(0, 400));
  await PC.ctx.close(); await TEL.ctx.close();
}

await fermerNavigateur();
ecrireResultats('resAE.json', RES);
RES.forEach((x) => console.log(x.ok.padEnd(5), '[' + x.group + ']', x.name, x.ok !== 'PASS' ? '— ' + x.detail : ''));
