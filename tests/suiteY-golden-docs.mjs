import { ecrireResultats, out } from './env.mjs';
// Suite Y — GOLDEN MASTER des documents (T2 : HTML des aperçus PDF) et des factures électroniques (T3 : XML CII), P0 21/10/2026.
// Rejoue le scénario de tests/golden/scenario-documents.mjs sur le code ACTUEL (horloge figée) et compare, caractère par caractère
// après normalisation (identifiants aléatoires), à tests/golden/documents/*.html et tests/golden/xml/*.xml.
// Un changement voulu (mise en page, mention légale validée par Gabriel) se valide par : node tests/golden/generer-documents.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { releverDocuments } from './golden/generer-documents.mjs';
import { fermer } from './golden/page-figee.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RES = []; const rec = (g, n, ok, d) => RES.push({ group: g, name: n, ok: ok ? 'PASS' : 'FAIL', detail: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
const lire = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\n$/, '') : null);
function premiereDiff(a, b) { const n = Math.min(a.length, b.length); let i = 0; while (i < n && a[i] === b[i]) i++; return { position: i, attendu: a.slice(Math.max(0, i - 60), i + 120), obtenu: b.slice(Math.max(0, i - 60), i + 120) }; }
const { docs, xml, errs } = await releverDocuments(); await fermer();
fs.mkdirSync(out('golden'), { recursive: true });
let nd = 0;
for (const [k, v] of Object.entries(docs)) {
  const a = lire(path.join(ICI, 'golden', 'documents', k + '.html'));
  if (a == null) { rec('Golden documents', `${k} : référence absente (régénérer)`, false); continue; }
  const ok = a === v; if (!ok) { nd++; fs.writeFileSync(out('golden', 'doc-' + k + '-obtenu.html'), v); }
  rec('Golden documents', `${k} : HTML identique à la référence (${v.length} caractères)`, ok, ok ? '' : premiereDiff(a, v));
}
for (const [k, v] of Object.entries(xml)) {
  const a = lire(path.join(ICI, 'golden', 'xml', k + '.xml'));
  if (a == null) { rec('Golden XML', `${k} : référence absente (régénérer)`, false); continue; }
  if (v.erreur) { rec('Golden XML', `${k} : génération en erreur`, false, v.erreur); continue; }
  const ok = a === v.xml; if (!ok) { nd++; fs.writeFileSync(out('golden', 'xml-' + k + '-obtenu.xml'), v.xml); }
  rec('Golden XML', `${k} (${v.num}) : XML identique à la référence`, ok, ok ? '' : premiereDiff(a, v.xml));
  rec('Golden XML', `${k} : contrôles internes de l'appli (nxEinvChecks) inchangés`, JSON.stringify(v.chk || []) === JSON.stringify((JSON.parse(lire(path.join(ICI, 'golden', 'xml', '_controles.json')) || '{}')[k] || {}).chk || []), v.chk);
}
rec('Golden documents', 'Aucune erreur JavaScript pendant le scénario', errs.length === 0, errs);
rec('Golden documents', `Bilan : ${Object.keys(docs).length} documents + ${Object.keys(xml).length} XML comparés, ${nd} différence(s)` + (nd ? ' — fichiers obtenus écrits dans ' + out('golden') : ''), nd === 0);
ecrireResultats('resY.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
