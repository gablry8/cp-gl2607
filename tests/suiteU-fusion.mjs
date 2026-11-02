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
const code = ['cpStable', 'cpSame', 'cpIdArr', 'cpMergeArr', 'cpMerge'].map(extraire).join('\n');
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
