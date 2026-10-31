import { ecrireResultats } from './env.mjs';
// Suite V — numérotation (P0, T4 du REFONTE-PLAN, 21/10/2026) : formats, continuité, refus de recul, et le scénario R2
// « deux appareils hors ligne numérotent une location / une fiche fluide » : ÉCHEC ATTENDU, CONNU, documenté (pas caché) —
// le contrôle reproduit le doublon tel qu'il existe aujourd'hui ; le jour où il ne se reproduit plus, il échoue et dit
// « R2 corrigé ? ». La correction est prévue en P3, pas en P0.
import { page, rec, RES, closeBrowser, seed } from './lib.mjs';
const j = (o) => JSON.stringify(o);
const { p, ctx, errs } = await page({ mobile: false });
p.removeAllListeners('dialog'); p.on('dialog', (d) => d.accept().catch(() => {}));
await seed(p);
const AN = new Date().getFullYear();

/* V1 formats */
{
  const r = await p.evaluate(() => {
    const out = { dv: {}, loc: nextLocNum(), flu: nextFluNum(), test: null, ids: [] };
    NXD2.natures.forEach((n) => { const d = NXD2.newDevis(n.id, {}); d.lots = [NXD2.newLot(n.id)]; d.num = NXD2.numFor(d); out.dv[n.id] = d.num; });
    for (let i = 0; i < 50; i++) out.ids.push(NXD2.numFor({ created: Date.now() }).split('-').pop());
    return out;
  });
  const dvOk = Object.values(r.dv).every((n) => new RegExp('^DV-' + AN + '\\d{4}-[A-Z0-9]+-[A-Za-z0-9]{6}$').test(n));
  rec('Numérotation', 'Devis : DV-AAAAMMJJ-<NATURE>-XXXXXX pour chaque nature', dvOk, j(r.dv));
  rec('Numérotation', 'Devis : 50 identifiants de suite tous différents (pas de collision)', new Set(r.ids).size === 50, j(r.ids.slice(0, 5)));
  rec('Numérotation', 'Location : L-AAAA-NNN ; fiche fluide : FF-AAAA-NNN (compteurs LOCAUX, R2)', new RegExp('^L-' + AN + '-\\d{3}$').test(r.loc) && new RegExp('^FF-' + AN + '-\\d{3}$').test(r.flu), j([r.loc, r.flu]));
}
/* V2 numéros de démonstration TEST-F / TEST-AV : continuité et refus de recul (client) */
{
  const r = await p.evaluate(() => {
    const out = {};
    const d = DEVIS.filter((x) => x.statut === 'accepte' && !x.facSolde && compute(x).totalHT > 0).slice(0, 2);
    d.forEach((x) => { facturerDevis(x.id, 'solde'); const c = document.getElementById('nx-pdf-close'); c && c.click(); });
    out.facs = d.map((x) => x.facSolde && x.facSolde.num);
    // compteur local remis EN ARRIÈRE : le prochain numéro doit quand même suivre le registre
    localStorage.setItem('cp2_testseq', JSON.stringify({ year: new Date().getFullYear(), F: 0, AV: 0 }));
    const e = DEVIS.find((x) => x.statut === 'accepte' && !x.facSolde && compute(x).totalHT > 0);
    facturerDevis(e.id, 'solde'); const c = document.getElementById('nx-pdf-close'); c && c.click();
    out.apresRecul = e.facSolde && e.facSolde.num;
    out.tous = nxFacNumsAll().filter((n) => /^TEST-F-/.test(n)).map((n) => +n.slice(-3)).sort((a, b) => a - b);
    return out;
  });
  const fmt = new RegExp('^TEST-F-' + AN + '-\\d{3}$');
  rec('Numérotation', 'Factures de démonstration : TEST-F-AAAA-NNN, 001 puis 002', r.facs.every((n) => fmt.test(n)) && r.facs.map((n) => +n.slice(-3)).join() === '1,2', j(r.facs));
  rec('Numérotation', 'Compteur local remis en arrière : le numéro suivant repart du registre (003), jamais un doublon', r.apresRecul === 'TEST-F-' + AN + '-003' && r.tous.every((v, i) => v === i + 1), j({ apresRecul: r.apresRecul, serie: r.tous }));
}
/* V3 — R2 : deux appareils hors ligne numérotent une location et une fiche fluide (ÉCHEC ATTENDU, CONNU) */
{
  const r = await p.evaluate(() => {
    const cles = ['cp2_loc', 'cp2_locseq', 'cp2_fluides', 'cp2_fluseq'];
    const lire = () => { const o = {}; cles.forEach((k) => { const v = localStorage.getItem(k); if (v != null) o[k] = JSON.parse(v); }); return o; };
    const ecrire = (o) => cles.forEach((k) => { if (o[k] === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(o[k])); });
    const base = lire();
    // appareil A (hors ligne) : une location, une fiche fluide
    const A = { loc: nextLocNum(), flu: nextFluNum() }; const etatA = lire();
    // appareil B (hors ligne, même point de départ) : pareil
    ecrire(base); const B = { loc: nextLocNum(), flu: nextFluNum() }; const etatB = lire();
    // resynchro : fusion 3 voies telle que l'appli la fait (cpMerge global d'index.html)
    const M = cpMerge(base, etatB, etatA);
    ecrire(base);
    return { A, B, memeNumeroLoc: A.loc === B.loc, memeNumeroFlu: A.flu === B.flu, seqFusionne: { loc: M.cp2_locseq, flu: M.cp2_fluseq } };
  });
  rec('Numérotation', '[R2 — ÉCHEC ATTENDU, CONNU] deux appareils hors ligne : la location reçoit le MÊME numéro des deux côtés (doublon à la resynchro) — comportement actuel reproduit, correction prévue en P3',
    r.memeNumeroLoc === true, j(r) + (r.memeNumeroLoc ? '' : ' — le doublon ne se reproduit plus : R2 corrigé ? mettre à jour T4'));
  rec('Numérotation', '[R2 — ÉCHEC ATTENDU, CONNU] idem pour la fiche fluide (FF-) ; à la fusion, le compteur local gagne (pas de max des deux)',
    r.memeNumeroFlu === true, j(r.seqFusionne));
}
rec('Numérotation', 'Aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
await ctx.close(); await closeBrowser();
ecrireResultats('resV.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
