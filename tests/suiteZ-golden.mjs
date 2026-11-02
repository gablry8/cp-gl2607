import { ecrireResultats } from './env.mjs';
// Suite Z — GOLDEN MASTER des calculs (P0, T1 du REFONTE-PLAN, 21/10/2026).
// Recalcule les 52 devis de référence de tests/golden/cas-calculs.mjs avec le code ACTUEL et compare à tests/golden/calculs.json :
//   - au CENTIME (ce que voit le client : totaux, TVA, acompte, solde, chaque ligne) → une différence = « montant changé » ;
//   - au MILLIÈME (valeur brute) → une différence au millième seulement = « arrondi interne changé » (R6 : à expliquer avant d'accepter) ;
//   - structure : nombre et libellés des lignes, avertissements, options.
// Un changement voulu se valide en régénérant le fichier : node tests/golden/generer.mjs (après accord de Gabriel).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { CAS, HORLOGE } from './golden/cas-calculs.mjs';
import { releverTout } from './golden/generer.mjs';
import { fermer } from './golden/page-figee.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RES = []; const rec = (g, n, ok, d) => RES.push({ group: g, name: n, ok: ok ? 'PASS' : 'FAIL', detail: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
const G = 'Golden calculs';
const attendu = JSON.parse(fs.readFileSync(path.join(ICI, 'golden', 'calculs.json'), 'utf8'));
rec(G, 'Fichier de référence présent, même jeu de cas, même horloge', attendu.horloge === HORLOGE && CAS.every((c) => attendu.cas[c.id]), { commit: attendu.commit, genere: attendu.genere, manquants: CAS.filter((c) => !attendu.cas[c.id]).map((c) => c.id) });

const obtenu = await releverTout(); await fermer();
const c2 = (x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x), c3 = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
const CHAMPS = ['totalHT', 'tva', 'tvaRate', 'totalTTC', 'acompte', 'solde', 'billTTC', 'coutReel', 'matAchat', 'moAchat', 'benefice', 'cotis', 'benefNet', 'heures', 'rate'];
let centime = 0, millieme = 0, structure = 0;
for (const c of CAS) {
  const a = attendu.cas[c.id], o = obtenu[c.id];
  if (!a) continue;
  if (!o || o.erreur) { rec(G, c.titre + ' — calcul impossible', false, o && o.erreur); continue; }
  if (a.erreur) { rec(G, c.titre + ' — la référence est en erreur (régénérer)', false, a.erreur); continue; }
  const diffC = [], diffM = [], diffS = [];
  for (const k of CHAMPS) { if (c2(a[k]) !== c2(o[k])) diffC.push(`${k} ${a[k]} → ${o[k]}`); else if (c3(a[k]) !== c3(o[k])) diffM.push(`${k} ${a[k]} → ${o[k]}`); }
  if (a.lines.length !== o.lines.length) diffS.push(`lignes ${a.lines.length} → ${o.lines.length}`);
  const n = Math.min(a.lines.length, o.lines.length);
  for (let i = 0; i < n; i++) { const x = a.lines[i], y = o.lines[i];
    if (x.label !== y.label || x.group !== y.group) { diffS.push(`ligne ${i + 1} « ${x.label} » → « ${y.label} »`); continue; }
    for (const k of ['ht', 'pu', 'achat', 'qte']) { if (c2(x[k]) !== c2(y[k])) diffC.push(`ligne ${i + 1} ${x.label} ${k} ${x[k]} → ${y[k]}`); else if (c3(x[k]) !== c3(y[k])) diffM.push(`ligne ${i + 1} ${x.label} ${k} ${x[k]} → ${y[k]}`); } }
  if (JSON.stringify(a.tvaBreak.map((b) => [c2(b.rate), c2(b.base), c2(b.tva)])) !== JSON.stringify(o.tvaBreak.map((b) => [c2(b.rate), c2(b.base), c2(b.tva)]))) diffC.push('ventilation TVA ' + JSON.stringify(a.tvaBreak) + ' → ' + JSON.stringify(o.tvaBreak));
  if (JSON.stringify(a.options.map((x) => [x.module, c2(x.ht), c2(x.ttc)])) !== JSON.stringify(o.options.map((x) => [x.module, c2(x.ht), c2(x.ttc)]))) diffC.push('options ' + JSON.stringify(a.options) + ' → ' + JSON.stringify(o.options));
  if (JSON.stringify(a.warnings) !== JSON.stringify(o.warnings)) diffS.push('avertissements ' + JSON.stringify(a.warnings) + ' → ' + JSON.stringify(o.warnings));
  if (a.franchise !== o.franchise) diffS.push('franchise ' + a.franchise + ' → ' + o.franchise);
  if (c2(a.cotisPct) !== c2(o.cotisPct)) diffC.push(`taux de cotisations ${a.cotisPct} → ${o.cotisPct}`);
  centime += diffC.length; millieme += diffM.length; structure += diffS.length;
  rec(G, c.titre + ' — identique au centime', diffC.length === 0, diffC.length ? { montantsChanges: diffC } : `HT ${a.totalHT} TTC ${a.totalTTC}`);
  if (diffM.length) rec(G, c.titre + ' — ARRONDI INTERNE changé (identique au centime, différent au millième : R6, à expliquer)', false, diffM);
  if (diffS.length) rec(G, c.titre + ' — structure changée (lignes / avertissements)', false, diffS);
}
rec(G, 'Aucune erreur JavaScript pendant les calculs', !(obtenu._erreursJS || []).length && !(obtenu._erreursJS_assujetti || []).length, { franchise: obtenu._erreursJS, assujetti: obtenu._erreursJS_assujetti });
rec(G, `Bilan : ${CAS.length} cas, ${centime} montant(s) changé(s), ${millieme} arrondi(s) interne(s) changé(s), ${structure} différence(s) de structure`, centime + millieme + structure === 0, 'un changement voulu se valide par : node tests/golden/generer.mjs');
const OUT = process.env.CP_TEST_OUT || path.join(process.env.TMPDIR || '/tmp', 'climpilot-tests'); fs.mkdirSync(path.join(OUT, 'golden'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'golden', 'calculs-obtenu.json'), JSON.stringify(obtenu, null, 1));
ecrireResultats('resZ.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
