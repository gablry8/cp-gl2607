import { ecrireResultats, out } from './env.mjs';
// Suite Y — GOLDEN MASTER des documents (T2 : HTML des aperçus PDF) et des factures électroniques (T3 : XML CII), P0 21/10/2026.
// Rejoue le scénario de tests/golden/scenario-documents.mjs sur le code ACTUEL (horloge figée) et compare, caractère par caractère
// après normalisation (identifiants aléatoires), à tests/golden/documents/*.html et tests/golden/xml/*.xml.
// Un changement voulu (mise en page, mention légale validée par Gabriel) se valide par : node tests/golden/generer-documents.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { releverDocuments } from './golden/generer-documents.mjs';
import { fermer } from './golden/page-figee.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RES = []; const rec = (g, n, ok, d) => RES.push({ group: g, name: n, ok: ok === true ? 'PASS' : ok === false ? 'FAIL' : typeof ok === 'string' ? ok : ok ? 'PASS' : 'FAIL', detail: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
const lire = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\n$/, '') : null);
function premiereDiff(a, b) { const n = Math.min(a.length, b.length); let i = 0; while (i < n && a[i] === b[i]) i++; return { position: i, attendu: a.slice(Math.max(0, i - 60), i + 120), obtenu: b.slice(Math.max(0, i - 60), i + 120) }; }
/* M3 C2 (21/10/2026) — « attendu : à trancher ». Les trois références « assujetti » (facture de solde d'un devis ACCEPTÉ EN FRANCHISE puis
   facturé après la bascule TVA, et les deux XML qui en découlent) ont été figées à 152,25 € TTC : c'est un calcul en franchise resté dans
   le cache de calcul (memoCompute, next-mobile.js), dont next-regime a ensuite retiré la TVA du TTC — pas un comportement voulu, et le
   XML porte 152,26 € (HT et TVA arrondis chacun de leur côté). Le code actuel, exécuté comme dans l'appli, donne 182,70 € (HT + TVA 20 %).
   La RÈGLE (prix TTC accepté, ou HT + TVA) est en attente de la décision de Gabriel avec sa comptable : rien n'est figé ni régénéré.
   Ces trois cas sont enregistrés « À TRANCHER » : listés dans le rapport, jamais comptés comme réussis, non bloquants, qu'ils coïncident
   ou non avec la référence. Dès la décision : régénérer (node tests/golden/generer-documents.mjs) si HT + TVA, sinon mission appli. */
const A_TRANCHER = /assujetti/;
const montants = (t) => { const m = String(t || '').match(/\d[\d ]*,\d{2} €|<ram:(?:TaxBasisTotalAmount|TaxTotalAmount[^>]*|GrandTotalAmount)>[^<]+/g) || []; return m.map((x) => x.replace(/<ram:/, '').replace(/ currencyID="EUR"/, '')).join(' ; '); };
const recGolden = (g, k, nom, ok, detail, ref, obtenu) => { if (!A_TRANCHER.test(k)) return rec(g, `${k} : ${nom}`, ok, detail);
  rec(g, `${k} : ${nom} — À TRANCHER (M3 C2 : règle de prix après bascule TVA en attente de la comptable ; référence figée non validée, ${ok ? 'identique' : 'différente'} ici)`, 'À TRANCHER',
    ref == null ? (ok ? 'identique à la référence figée' : detail) : `référence figée : ${montants(ref)} — code actuel : ${montants(obtenu)}` + (ok ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)))); };
const { docs, xml, errs } = await releverDocuments(); await fermer();
fs.mkdirSync(out('golden'), { recursive: true });
let nd = 0;
for (const [k, v] of Object.entries(docs)) {
  const a = lire(path.join(ICI, 'golden', 'documents', k + '.html'));
  if (a == null) { rec('Golden documents', `${k} : référence absente (régénérer)`, false); continue; }
  const ok = a === v; if (!ok) { if (!A_TRANCHER.test(k)) nd++; fs.writeFileSync(out('golden', 'doc-' + k + '-obtenu.html'), v); }
  recGolden('Golden documents', k, `HTML identique à la référence (${v.length} caractères)`, ok, ok ? '' : premiereDiff(a, v), a, v);
}
for (const [k, v] of Object.entries(xml)) {
  const a = lire(path.join(ICI, 'golden', 'xml', k + '.xml'));
  if (a == null) { rec('Golden XML', `${k} : référence absente (régénérer)`, false); continue; }
  if (v.erreur) { rec('Golden XML', `${k} : génération en erreur`, false, v.erreur); continue; }
  const ok = a === v.xml; if (!ok) { if (!A_TRANCHER.test(k)) nd++; fs.writeFileSync(out('golden', 'xml-' + k + '-obtenu.xml'), v.xml); }
  recGolden('Golden XML', k, `(${v.num}) : XML identique à la référence`, ok, ok ? '' : premiereDiff(a, v.xml), a, v.xml);
  const chkOk = JSON.stringify(v.chk || []) === JSON.stringify((JSON.parse(lire(path.join(ICI, 'golden', 'xml', '_controles.json')) || '{}')[k] || {}).chk || []);
  recGolden('Golden XML', k, `contrôles internes de l'appli (nxEinvChecks) inchangés`, chkOk, v.chk);
}
rec('Golden documents', 'Aucune erreur JavaScript pendant le scénario', errs.length === 0, errs);
const nAT = Object.keys(docs).concat(Object.keys(xml)).filter((k) => A_TRANCHER.test(k)).length;
rec('Golden documents', `Bilan : ${Object.keys(docs).length} documents + ${Object.keys(xml).length} XML comparés, ${nd} différence(s) bloquante(s), ${nAT} référence(s) À TRANCHER (M3 C2)` + (nd ? ' — fichiers obtenus écrits dans ' + out('golden') : ''), nd === 0);
ecrireResultats('resY.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
