// Suite U — fusion 3 voies de la synchro (P0, T5 du REFONTE-PLAN, 21/10/2026). Node seul, sans navigateur.
// Les fonctions cpStable / cpSame / cpIdArr / cpMergeArr / cpMerge sont EXTRAITES de index.html au moment du test
// (le code applicatif n'est pas modifié) : si leur texte change, la table de cas ci-dessous dit si le comportement change.
// Un golden master ne juge pas : il fige ce que fait le code AUJOURD'HUI, y compris « l'appareil actuel gagne » (R1 du plan).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url)), RACINE = path.resolve(ICI, '..');
const src = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
function extraire(nom) {
  const i = src.indexOf('\nfunction ' + nom + '('); if (i < 0) throw new Error('fonction introuvable dans index.html : ' + nom);
  // la fonction suivante commence au prochain "\nfunction " ou "\nasync function " ou "\nlet " de premier niveau
  const fin = src.slice(i + 1).search(/\n(?:async function |function |let |const |\/\*|\(function)/);
  return src.slice(i + 1, i + 1 + (fin < 0 ? src.length : fin));
}
/* P3 (06/11/2026) : la seconde passe (cpFusionEtats, états terminaux) est extraite si elle existe — sur l'ancien code, elle manque et les cas P3 sont rouges */
const extraireOpt = (nom) => (src.indexOf('\nfunction ' + nom + '(') < 0 ? '' : extraire(nom));
const code = ['cpStable', 'cpSame', 'cpIdArr', 'cpMergeArr', 'cpMerge'].map(extraire).concat([extraireOpt('cpFusionEtats')]).join('\n');
const { cpMerge, cpMergeArr } = new Function(code + '\nreturn {cpMerge, cpMergeArr, cpSame, cpIdArr};')();
const RES = []; const rec = (g, n, ok, d) => { RES.push({ group: g, name: n, ok: ok ? 'PASS' : 'FAIL', detail: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) }); };
const j = (o) => JSON.stringify(o);
const G = 'Fusion 3 voies';

/* ---------- table de cas : base B (dernière version serveur connue), local L (cet appareil), distant R (serveur maintenant) → attendu ---------- */
const o = (id, v) => ({ id, v });
const cas = [
  // tableaux d'objets à id
  ['objet modifié d\'un seul côté (local) : la version locale', { a: [o(1, 'b')] }, { a: [o(1, 'L')] }, { a: [o(1, 'b')] }, { a: [o(1, 'L')] }],
  ['objet modifié d\'un seul côté (distant) : la version distante', { a: [o(1, 'b')] }, { a: [o(1, 'b')] }, { a: [o(1, 'R')] }, { a: [o(1, 'R')] }],
  ['objet modifié des DEUX côtés : l\'appareil actuel gagne (R1, comportement figé, pas jugé)', { a: [o(1, 'b')] }, { a: [o(1, 'L')] }, { a: [o(1, 'R')] }, { a: [o(1, 'L')] }],
  ['objet supprimé ailleurs, non modifié ici : disparaît', { a: [o(1, 'b'), o(2, 'b')] }, { a: [o(1, 'b'), o(2, 'b')] }, { a: [o(2, 'b')] }, { a: [o(2, 'b')] }],
  ['objet supprimé ailleurs MAIS modifié ici : gardé (version locale)', { a: [o(1, 'b'), o(2, 'b')] }, { a: [o(1, 'L'), o(2, 'b')] }, { a: [o(2, 'b')] }, { a: [o(2, 'b'), o(1, 'L')] }],
  ['objet supprimé ici, non modifié ailleurs : disparaît', { a: [o(1, 'b'), o(2, 'b')] }, { a: [o(2, 'b')] }, { a: [o(1, 'b'), o(2, 'b')] }, { a: [o(2, 'b')] }],
  ['objet supprimé ici MAIS modifié ailleurs : gardé (version distante)', { a: [o(1, 'b'), o(2, 'b')] }, { a: [o(2, 'b')] }, { a: [o(1, 'R'), o(2, 'b')] }, { a: [o(1, 'R'), o(2, 'b')] }],
  ['objet créé ici (absent de la base et du distant) : gardé', { a: [] }, { a: [o(9, 'L')] }, { a: [] }, { a: [o(9, 'L')] }],
  ['objet créé ailleurs : reçu', { a: [] }, { a: [] }, { a: [o(9, 'R')] }, { a: [o(9, 'R')] }],
  ['créé des deux côtés avec des id différents : les deux, distant d\'abord', { a: [] }, { a: [o(1, 'L')] }, { a: [o(2, 'R')] }, { a: [o(2, 'R'), o(1, 'L')] }],
  ['créé des deux côtés avec le MÊME id : l\'appareil actuel gagne', { a: [] }, { a: [o(1, 'L')] }, { a: [o(1, 'R')] }, { a: [o(1, 'L')] }],
  ['premier passage (base null), tableaux à id : réunion, local gagne sur conflit', null, { a: [o(1, 'L'), o(3, 'L')] }, { a: [o(1, 'R'), o(2, 'R')] }, { a: [o(1, 'L'), o(2, 'R'), o(3, 'L')] }],
  // clés qui ne sont pas des tableaux d'objets à id : objets, compteurs, chaînes
  ['compteur (nombre) : modifié ici seulement → local', { n: 5 }, { n: 6 }, { n: 5 }, { n: 6 }],
  ['compteur : modifié ailleurs seulement → distant', { n: 5 }, { n: 5 }, { n: 7 }, { n: 7 }],
  ['compteur modifié des deux côtés : local gagne, même s\'il RECULE (R2, figé)', { n: 5 }, { n: 6 }, { n: 7 }, { n: 6 }],
  ['objet de réglages (pas un tableau) modifié des deux côtés : local gagne en bloc, pas champ par champ', { p: { a: 1, b: 1 } }, { p: { a: 2, b: 1 } }, { p: { a: 1, b: 2 } }, { p: { a: 2, b: 1 } }],
  ['clé absente ici, présente ailleurs : reçue', { }, { }, { k: 'R' }, { k: 'R' }],
  ['clé présente ici, absente ailleurs : gardée', { }, { k: 'L' }, { }, { k: 'L' }],
  ['clé connue de la base, absente ici et ailleurs (supprimée partout) : absente', { k: 'b' }, { }, { }, { }],
  ['tableau sans id (liste simple) modifié des deux côtés : local gagne en bloc', { t: [1, 2] }, { t: [1, 2, 3] }, { t: [1, 2, 4] }, { t: [1, 2, 3] }],
  ['tableau à id avec doublon d\'id côté distant : traité comme une liste simple (local gagne)', { a: [o(1, 'b')] }, { a: [o(1, 'L')] }, { a: [o(1, 'R'), o(1, 'R2')] }, { a: [o(1, 'L')] }],
  ['ordre des champs d\'un objet ignoré (cpStable) : pas un conflit', { a: [{ id: 1, x: 1, y: 2 }] }, { a: [{ id: 1, y: 2, x: 1 }] }, { a: [{ id: 1, x: 1, y: 2, z: 3 }] }, { a: [{ id: 1, x: 1, y: 2, z: 3 }] }],
  ['champ retiré ici (absent) alors que la base l\'a à null : compte comme une modification → local gagne (figé)', { a: [{ id: 1, x: null }] }, { a: [{ id: 1 }] }, { a: [{ id: 1, x: null, w: 1 }] }, { a: [{ id: 1 }] }],
];
for (const [nom, B, L, R, attendu] of cas) {
  let out, err = null; try { out = cpMerge(B, JSON.parse(JSON.stringify(L)), JSON.parse(JSON.stringify(R))); } catch (e) { err = String(e); }
  rec(G, nom, !err && JSON.stringify(out) === JSON.stringify(attendu), err || { obtenu: out, attendu });
}
/* ---------- propriétés générales ---------- */
rec(G, 'fusion idempotente : fusionner le résultat avec lui-même ne change rien', (() => { const B = { a: [o(1, 'b')] }, L = { a: [o(1, 'L'), o(2, 'L')] }, R = { a: [o(1, 'R'), o(3, 'R')] }; const M = cpMerge(B, L, R); return JSON.stringify(cpMerge(M, JSON.parse(JSON.stringify(M)), JSON.parse(JSON.stringify(M)))) === JSON.stringify(M); })());
rec(G, 'les entrées ne sont pas modifiées par la fusion', (() => { const B = { a: [o(1, 'b')] }, L = { a: [o(1, 'L')] }, R = { a: [o(1, 'R')] }; const sL = JSON.stringify(L), sR = JSON.stringify(R), sB = JSON.stringify(B); cpMerge(B, L, R); return sL === JSON.stringify(L) && sR === JSON.stringify(R) && sB === JSON.stringify(B); })());
rec(G, 'gros volume : 2 000 objets de chaque côté, fusion en moins de 2 s', (() => { const mk = (p) => Array.from({ length: 2000 }, (_, i) => ({ id: i, v: p + (i % 3) })); const t = Date.now(); const M = cpMerge({ a: mk('b') }, { a: mk('L') }, { a: mk('R') }); return M.a.length === 2000 && Date.now() - t < 2000; })());

/* ---------- P3 (06/11/2026) : les états terminaux gagnent la fusion (docs/MISSION-P3.md § 4.2) ----------
   Vraies clés (cp2_devis, cp2_fluides, cp2_dep, cp2_fluseq). PC = cet appareil (L, pas à jour, il fusionne), tél = serveur (R).
   Dates posées à la main, à plusieurs MINUTES d'écart (§ 3.3 : signature.at = heure du serveur, annulation.at / remplacePar.at = heure de l'appareil). */
const G3 = 'Fusion P3 états terminaux';
const K = 'cp2_devis', T0 = Date.parse('2027-03-01T10:00:00Z'), MIN = 60000;
const D = (id, extra) => Object.assign({ id, num: 'DV-' + id, statut: 'accepte', cNom: 'Client Essai (fictif)', cType: 'Professionnel', lots: [{ id: 'l1', titre: 'Séjour', lignes: [{ ref: 'A', q: 1 }] }], notes: '', acceptedAt: T0 - 60 * MIN }, extra || {});
const E = (extra) => Object.assign(D('E', { statut: 'envoye', sentAt: T0 - 120 * MIN }), extra || {});
const ANN = (at, motif) => ({ at, motif: motif || 'abandon', libelle: motif === 'erreur' ? 'Erreur de saisie' : 'Abandon du client', texte: '', statutAvant: 'accepte' });
const SIG = (at, hash) => ({ at: new Date(at).toISOString(), nom: 'Client Signataire', hash: hash || 'h1', token: 't-' + (hash || 'h1'), png: null, ip: null });
const FAC = (num, extra) => Object.assign({ num, date: '2027-03-01', montant: 100, baseTTC: 1000, payeLe: null, mode: '' }, extra || {});
const m = (B, L, R) => cpMerge(B, JSON.parse(JSON.stringify(L)), JSON.parse(JSON.stringify(R)));
const dv = (M, id) => ((M && M[K]) || []).find((x) => x.id === id) || {};
const arbs = (M) => (M && M.cpArbitrages) || [];
const FL = (extra) => Object.assign({ id: 'F1', num: 'FF-2027-001', date: '2027-03-01', nature: 'entretien', client: 'Boulangerie Essai', fluide: 'R32', charge: 0.9, obs: '' }, extra || {});
const DEP = (extra) => Object.assign({ id: 'X1', statut: 'facturee', facNum: 'TEST-F-2027-0002', facDate: '2027-03-01', payeLe: null, modeReg: '', notes: '' }, extra || {});
const P3 = [];   // [nom, B, L, R, verif(M) → true/false, témoin (vert avant comme après)]
P3.push(['U-P3-1 annulé (tél) contre planification (PC) : annulé, motif gardé, date du PC gardée',
  { [K]: [D('O')] }, { [K]: [D('O', { datePlanif: '2027-03-02' })] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] },
  (M) => { const o = dv(M, 'O'); return o.statut === 'annule' && o.annulation && o.annulation.motif === 'abandon' && o.datePlanif === '2027-03-02'; }]);
P3.push(['U-P3-2 remplacé par un avenant (tél) contre planification (PC) : O remplacé (lien vers A) avec la date, A accepté (T19a dans Node)',
  { [K]: [D('O')] }, { [K]: [D('O', { datePlanif: '2027-03-02' })] }, { [K]: [D('O', { statut: 'remplace', remplacePar: { id: 'A', num: 'DV-A', at: T0 } }), D('A', { avenantDe: { id: 'O', num: 'DV-O', at: T0 - MIN } })] },
  (M) => { const o = dv(M, 'O'), a = dv(M, 'A'); return o.statut === 'remplace' && o.remplacePar && o.remplacePar.id === 'A' && o.datePlanif === '2027-03-02' && a.statut === 'accepte'; }]);
P3.push(['U-P3-3 signé en ligne (tél) contre relance (PC, devis « envoyé » chez lui) : accepté, signature, relance gardée',
  { [K]: [E()] }, { [K]: [E({ relances: [T0] })] }, { [K]: [E({ statut: 'accepte', signature: SIG(T0 + 5 * MIN), acceptedAt: T0 + 5 * MIN })] },
  (M) => { const e = dv(M, 'E'); return e.statut === 'accepte' && e.signature && e.signature.hash === 'h1' && JSON.stringify(e.relances) === JSON.stringify([T0]); }]);
P3.push(['U-P3-4 accepté sur papier (tél) contre relance (PC) : accepté (seul le tél a changé l\'état), relance gardée',
  { [K]: [E()] }, { [K]: [E({ relances: [T0] })] }, { [K]: [E({ statut: 'accepte', acceptedAt: T0 + 5 * MIN })] },
  (M) => { const e = dv(M, 'E'); return e.statut === 'accepte' && e.acceptedAt === T0 + 5 * MIN && JSON.stringify(e.relances) === JSON.stringify([T0]); }]);
P3.push(['U-P3-5 signé (tél) contre lignes modifiées (PC) : version signée (lignes d\'origine), 1 arbitrage qui nomme « lignes »',
  { [K]: [E()] }, { [K]: [E({ lots: [{ id: 'l1', titre: 'Séjour', lignes: [{ ref: 'A', q: 2 }, { ref: 'B', q: 1 }] }] })] }, { [K]: [E({ statut: 'accepte', signature: SIG(T0 + 5 * MIN), acceptedAt: T0 + 5 * MIN })] },
  (M) => { const e = dv(M, 'E'), a = arbs(M); return e.statut === 'accepte' && !!e.signature && JSON.stringify(e.lots) === JSON.stringify(E().lots) && a.length === 1 && (a[0].ecarte || []).indexOf('lignes') >= 0 && a[0].id === 'E'; }]);
P3.push(['U-P3-6 facturé (tél) contre annulé (PC) : accepté, acompte gardé, pas d\'annulation, 1 arbitrage (annulation non appliquée)',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] }, { [K]: [D('O', { facAcompte: FAC('TEST-F-2027-0001') })] },
  (M) => { const o = dv(M, 'O'), a = arbs(M); return o.statut === 'accepte' && o.facAcompte && o.facAcompte.num === 'TEST-F-2027-0001' && !o.annulation && a.length === 1 && a[0].statut_ecarte === 'annule'; }]);
P3.push(['U-P3-7 annulé (tél) contre facturé (PC) : même résultat, 1 arbitrage',
  { [K]: [D('O')] }, { [K]: [D('O', { facAcompte: FAC('TEST-F-2027-0001') })] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] },
  (M) => { const o = dv(M, 'O'), a = arbs(M); return o.statut === 'accepte' && o.facAcompte && o.facAcompte.num === 'TEST-F-2027-0001' && !o.annulation && a.length === 1; }]);
P3.push(['U-P3-8 annulé (PC, +10 min) contre remplacé (tél, +20 min) : le premier geste en date gagne → annulé',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0 + 10 * MIN) })] }, { [K]: [D('O', { statut: 'remplace', remplacePar: { id: 'A', num: 'DV-A', at: T0 + 20 * MIN } }), D('A', { avenantDe: { id: 'O', num: 'DV-O', at: T0 } })] },
  (M) => { const o = dv(M, 'O'); return o.statut === 'annule' && o.annulation && o.annulation.at === T0 + 10 * MIN && dv(M, 'A').statut === 'accepte'; }]);
P3.push(['U-P3-8 dates inversées : annulé (PC, +20 min) contre remplacé (tél, +10 min) → remplacé, l\'annulation va au journal',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0 + 20 * MIN) })] }, { [K]: [D('O', { statut: 'remplace', remplacePar: { id: 'A', num: 'DV-A', at: T0 + 10 * MIN } }), D('A', { avenantDe: { id: 'O', num: 'DV-O', at: T0 } })] },
  (M) => { const o = dv(M, 'O'), a = arbs(M); return o.statut === 'remplace' && o.remplacePar && o.remplacePar.id === 'A' && a.length === 1 && a[0].statut_ecarte === 'annule'; }]);
P3.push(['U-P3-9 deux annulations (PC +20 min « erreur », tél +10 min « abandon ») : la plus ancienne, son motif gardé',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0 + 20 * MIN, 'erreur') })] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0 + 10 * MIN, 'abandon') })] },
  (M) => { const o = dv(M, 'O'); return o.statut === 'annule' && o.annulation && o.annulation.motif === 'abandon' && o.annulation.at === T0 + 10 * MIN; }]);
P3.push(['U-P3-10 fiche fluide annulée (tél) contre observation (PC) : fiche du tél entière, observation écartée, 1 arbitrage',
  { cp2_fluides: [FL()] }, { cp2_fluides: [FL({ obs: 'observation du PC' })] }, { cp2_fluides: [FL({ annulee: { at: T0, date: '2027-03-01', motif: 'erreur de saisie' } })] },
  (M) => { const f = (M.cp2_fluides || [])[0] || {}, a = arbs(M); return !!f.annulee && f.obs === '' && a.length === 1 && (a[0].ecarte || []).indexOf('obs') >= 0; }]);
P3.push(['U-P3-10 bis fiche fluide signée par le détenteur puis annulée (tél) contre observation (PC) : signature et annulation gardées',
  { cp2_fluides: [FL()] }, { cp2_fluides: [FL({ obs: 'observation du PC' })] }, { cp2_fluides: [FL({ sigDetenteur: SIG(T0), annulee: { at: T0 + 5 * MIN, date: '2027-03-01', motif: 'erreur' } })] },
  (M) => { const f = (M.cp2_fluides || [])[0] || {}; return !!f.annulee && !!f.sigDetenteur && f.obs === ''; }]);
P3.push(['U-P3-10 ter fiche fluide signée par le détenteur (tél) contre observation (PC) : signature gardée, observation écartée',
  { cp2_fluides: [FL()] }, { cp2_fluides: [FL({ obs: 'observation du PC' })] }, { cp2_fluides: [FL({ sigDetenteur: SIG(T0) })] },
  (M) => { const f = (M.cp2_fluides || [])[0] || {}; return !!f.sigDetenteur && !f.annulee && f.obs === '' && arbs(M).length === 1; }]);
P3.push(['U-P3-11 compteur des fiches fluides : PC 6, tél 7 → 7 (le plus grand)',
  { cp2_fluseq: { year: 2027, seq: 5 } }, { cp2_fluseq: { year: 2027, seq: 6 } }, { cp2_fluseq: { year: 2027, seq: 7 } },
  (M) => JSON.stringify(M.cp2_fluseq) === JSON.stringify({ year: 2027, seq: 7 })]);
P3.push(['U-P3-11 bis compteur des fiches fluides : PC 7, tél 6 → 7',
  { cp2_fluseq: { year: 2027, seq: 5 } }, { cp2_fluseq: { year: 2027, seq: 7 } }, { cp2_fluseq: { year: 2027, seq: 6 } },
  (M) => JSON.stringify(M.cp2_fluseq) === JSON.stringify({ year: 2027, seq: 7 })]);
P3.push(['U-P3-12 intervention payée (tél) contre note (PC) : payée, date et mode de règlement gardés, note gardée',
  { cp2_dep: [DEP()] }, { cp2_dep: [DEP({ notes: 'note du PC' })] }, { cp2_dep: [DEP({ statut: 'payee', payeLe: '2027-03-02', modeReg: 'Virement' })] },
  (M) => { const x = (M.cp2_dep || [])[0] || {}; return x.statut === 'payee' && x.payeLe === '2027-03-02' && x.modeReg === 'Virement' && x.notes === 'note du PC' && x.facNum === 'TEST-F-2027-0002'; }]);
P3.push(['U-P3-12 bis facture de devis encaissée (tél) contre note (PC) : encaissement gardé, note gardée',
  { [K]: [D('O', { facSolde: FAC('TEST-F-2027-0003') })] }, { [K]: [D('O', { facSolde: FAC('TEST-F-2027-0003'), notes: 'note du PC' })] }, { [K]: [D('O', { facSolde: FAC('TEST-F-2027-0003', { payeLe: '2027-03-05', mode: 'CB' }) })] },
  (M) => { const o = dv(M, 'O'); return o.facSolde && o.facSolde.payeLe === '2027-03-05' && o.facSolde.mode === 'CB' && o.notes === 'note du PC'; }]);
P3.push(['U-P3-12 ter encaissement retiré ici (PC) alors que le tél n\'a rien changé : retiré (trois voies, le côté qui a changé gagne)',
  { cp2_dep: [DEP({ statut: 'payee', payeLe: '2027-03-02', modeReg: 'Virement' })] }, { cp2_dep: [DEP()] }, { cp2_dep: [DEP({ statut: 'payee', payeLe: '2027-03-02', modeReg: 'Virement', notes: 'note du tél' })] },
  (M) => { const x = (M.cp2_dep || [])[0] || {}; return x.statut === 'facturee' && !x.payeLe; }]);
P3.push(['U-P3-13 témoin : retour en arrière voulu (PC : accepté → envoyé) contre note (tél) : envoyé (seul le PC a changé l\'état)',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'envoye' })] }, { [K]: [D('O', { notes: 'note du tél' })] },
  (M) => dv(M, 'O').statut === 'envoye', true]);
P3.push(['U-P3-13 bis même cas : la note du tél est reprise (champ de suivi)',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'envoye' })] }, { [K]: [D('O', { notes: 'note du tél' })] },
  (M) => dv(M, 'O').statut === 'envoye' && dv(M, 'O').notes === 'note du tél']);
P3.push(['U-P3-13 ter les deux ont changé l\'état (PC : refusé, tél : accepté) : « accepté » gagne, le plus prudent',
  { [K]: [E()] }, { [K]: [E({ statut: 'refuse' })] }, { [K]: [E({ statut: 'accepte', acceptedAt: T0 })] },
  (M) => dv(M, 'E').statut === 'accepte']);
P3.push(['U-P3-14 témoin sans base : annulé (PC) contre accepté + date (serveur) : annulé',
  null, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] }, { [K]: [D('O', { datePlanif: '2027-03-02' })] },
  (M) => dv(M, 'O').statut === 'annule', true]);
P3.push(['U-P3-14 bis sans base, côtés échangés : accepté + date ici, annulé sur le serveur → annulé, date gardée',
  null, { [K]: [D('O', { datePlanif: '2027-03-02' })] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] },
  (M) => dv(M, 'O').statut === 'annule' && dv(M, 'O').datePlanif === '2027-03-02']);
P3.push(['U-P3-16 annulé (PC, +20 min) contre signé APRÈS (tél, +30 min) : annulé, la signature va dans signatureEnAttente (comme applySig)',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0 + 20 * MIN) })] }, { [K]: [D('O', { signature: SIG(T0 + 30 * MIN), acceptedAt: T0 + 30 * MIN })] },
  (M) => { const o = dv(M, 'O'); return o.statut === 'annule' && !o.signature && o.signatureEnAttente && o.signatureEnAttente.hash === 'h1'; }]);
P3.push(['U-P3-16 bis annulé (PC, +20 min) contre signé AVANT (tél, +10 min) : annulé, la signature reste posée',
  { [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0 + 20 * MIN) })] }, { [K]: [D('O', { signature: SIG(T0 + 10 * MIN), acceptedAt: T0 + 10 * MIN })] },
  (M) => { const o = dv(M, 'O'); return o.statut === 'annule' && o.signature && o.signature.hash === 'h1' && !o.signatureEnAttente; }]);
P3.push(['U-P3-16 ter signé (PC) contre « refusé » posé à la main (tél) : la signature gagne, 1 arbitrage',
  { [K]: [E()] }, { [K]: [E({ statut: 'accepte', signature: SIG(T0), acceptedAt: T0 })] }, { [K]: [E({ statut: 'refuse' })] },
  (M) => { const e = dv(M, 'E'); return e.statut === 'accepte' && !!e.signature && arbs(M).length === 1; }]);
P3.push(['U-P3-16 quater deux signatures différentes (PC +10 min, tél +20 min) : la plus ancienne, l\'autre au journal',
  { [K]: [E()] }, { [K]: [E({ statut: 'accepte', signature: SIG(T0 + 10 * MIN, 'hPC'), acceptedAt: T0 + 10 * MIN })] }, { [K]: [E({ statut: 'accepte', signature: SIG(T0 + 20 * MIN, 'hTel'), acceptedAt: T0 + 20 * MIN })] },
  (M) => { const e = dv(M, 'E'), a = arbs(M); return e.signature && e.signature.hash === 'hPC' && a.length === 1 && (a[0].ecarte || []).indexOf('signature') >= 0; }]);
const temoins = [];
for (const [nom, B, L, R, verif, temoin] of P3) {
  let M, err = null; try { M = m(B, L, R); } catch (e) { err = String(e); }
  let ok = false; try { ok = !err && verif(M) === true; } catch (e) { err = String(e); }
  rec(G3, nom, ok, err || { obtenu: M, arbitrages: arbs(M) }); if (temoin) temoins.push(nom);
}
/* U-P3-15 symétrie : cas 1 à 11 (et 12) avec L et R échangés → même état (rang ≥ 2), ou même règle (rangs 0 / 1, encaissement) */
const SYM = P3.filter(([nom]) => /^U-P3-(1|2|3|4|5|6|7|8|9|10|11|12) /.test(nom) || /^U-P3-(10|11|12) (bis|ter)/.test(nom));
for (const [nom, B, L, R, verif] of SYM) {
  const etat = (M) => ({ devis: (M[K] || []).map((d) => [d.id, d.statut, !!d.signature, !!(d.facAcompte || d.facSolde), (d.annulation || {}).motif || '', (d.remplacePar || {}).id || '']), fl: (M.cp2_fluides || []).map((f) => [f.id, !!f.annulee, !!f.sigDetenteur]), dep: (M.cp2_dep || []).map((x) => [x.id, x.statut, x.payeLe]), seq: M.cp2_fluseq });
  let a, b, err = null; try { a = etat(m(B, L, R)); b = etat(m(B, R, L)); } catch (e) { err = String(e); }
  rec(G3, 'U-P3-15 symétrie — ' + nom.split(' : ')[0] + ' : L et R échangés → même état', !err && JSON.stringify(a) === JSON.stringify(b), err || { LR: a, RL: b });
}
/* propriétés gardées, avec des devis */
rec(G3, 'fusion idempotente avec des devis : fusionner le résultat avec lui-même ne change rien (et ne rend aucun arbitrage)', (() => { const B = { [K]: [D('O'), E()] }, L = { [K]: [D('O', { datePlanif: '2027-03-02' }), E({ relances: [T0] })] }, R = { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) }), E({ statut: 'accepte', signature: SIG(T0 + 5 * MIN), acceptedAt: T0 + 5 * MIN })] }; const M = m(B, L, R); const M2 = m(M, M, M); return JSON.stringify(M2) === JSON.stringify(M) && arbs(M2).length === 0; })());
rec(G3, 'les entrées ne sont pas modifiées par la seconde passe', (() => { const B = { [K]: [D('O')] }, L = { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] }, R = { [K]: [D('O', { facAcompte: FAC('TEST-F-2027-0001') })] }; const sB = JSON.stringify(B), sL = JSON.stringify(L), sR = JSON.stringify(R); cpMerge(B, L, R); return sB === JSON.stringify(B) && sL === JSON.stringify(L) && sR === JSON.stringify(R); })());
rec(G3, 'la liste des arbitrages n\'est ni énumérable ni sérialisée (jamais écrite dans localStorage ni envoyée)', (() => { const M = m({ [K]: [D('O')] }, { [K]: [D('O', { statut: 'annule', annulation: ANN(T0) })] }, { [K]: [D('O', { facAcompte: FAC('TEST-F-2027-0001') })] }); return arbs(M).length === 1 && Object.keys(M).indexOf('cpArbitrages') < 0 && JSON.stringify(M).indexOf('cpArbitrages') < 0; })());
rec(G3, 'témoins (verts avant comme après) : ' + temoins.length + ' cas', temoins.length === 2, temoins.join(' | '));

rec(G, 'texte de cpMergeArr / cpMerge extrait d\'index.html (empreinte figée, à mettre à jour si le comportement change volontairement)', (() => {
  const crypto = globalThis.crypto; const h = [...new Uint8Array(0)]; void h;
  const texte = extraire('cpMergeArr') + extraire('cpMerge'); let s = 0; for (const c of texte) s = (s * 31 + c.charCodeAt(0)) >>> 0; const empreinte = s.toString(16);
  const attendue = fs.existsSync(path.join(ICI, 'golden', 'fusion-empreinte.txt')) ? fs.readFileSync(path.join(ICI, 'golden', 'fusion-empreinte.txt'), 'utf8').trim() : null;
  if (!attendue) { fs.mkdirSync(path.join(ICI, 'golden'), { recursive: true }); fs.writeFileSync(path.join(ICI, 'golden', 'fusion-empreinte.txt'), empreinte + '\n'); return true; }
  return attendue === empreinte; })(), 'si ce contrôle échoue : le code de fusion a changé ; vérifier la table de cas puis regénérer tests/golden/fusion-empreinte.txt');

const OUT = process.env.CP_TEST_OUT || path.join(process.env.TMPDIR || '/tmp', 'climpilot-tests'); fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'resU.json'), JSON.stringify(RES, null, 1));
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
process.exit(RES.some((r) => r.ok !== 'PASS') ? 1 : 0);
