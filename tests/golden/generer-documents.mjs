// Génère (ou régénère) les golden masters DOCUMENTS et XML (P0, T2 et T3) depuis le code ACTUEL :
//   tests/golden/documents/<nom>.html   (HTML normalisé de l'aperçu PDF)   tests/golden/xml/<nom>.xml  (facture électronique CII)
// À lancer seulement après accord de Gabriel sur un changement vu et expliqué : node tests/golden/generer-documents.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { HORLOGE } from './cas-calculs.mjs';
import { SCENARIO, normaliserHTML, normaliserXML } from './scenario-documents.mjs';
import { pageFigee, fermer } from './page-figee.mjs';
import { SEED } from '../lib.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
export async function releverDocuments() {
  const { p, ctx, errs } = await pageFigee({ horloge: HORLOGE });
  await p.evaluate(SEED);
  const r = await p.evaluate(SCENARIO);
  const docs = {}, xml = {};
  for (const [k, v] of Object.entries(r.docs)) docs[k] = normaliserHTML(v);
  for (const [k, v] of Object.entries(r.xml)) xml[k] = v.erreur ? { erreur: v.erreur, num: v.num } : { num: v.num, xml: normaliserXML(v.xml), chk: v.chk };
  await ctx.close();
  return { docs, xml, errs };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { docs, xml, errs } = await releverDocuments(); await fermer();
  fs.mkdirSync(path.join(ICI, 'documents'), { recursive: true }); fs.mkdirSync(path.join(ICI, 'xml'), { recursive: true });
  for (const [k, v] of Object.entries(docs)) fs.writeFileSync(path.join(ICI, 'documents', k + '.html'), v + '\n');
  for (const [k, v] of Object.entries(xml)) fs.writeFileSync(path.join(ICI, 'xml', k + '.xml'), (v.erreur ? 'ERREUR ' + v.erreur : v.xml) + '\n');
  fs.writeFileSync(path.join(ICI, 'xml', '_controles.json'), JSON.stringify(Object.fromEntries(Object.entries(xml).map(([k, v]) => [k, { num: v.num, chk: v.chk || null, erreur: v.erreur || null }])), null, 1));
  const vides = Object.entries(docs).filter(([, v]) => !v || /^ERREUR/.test(v)).map(([k]) => k), xerr = Object.entries(xml).filter(([, v]) => v.erreur).map(([k]) => k);
  console.log(`golden documents : ${Object.keys(docs).length} HTML, ${Object.keys(xml).length} XML ; vides/erreurs HTML : ${JSON.stringify(vides)} ; XML en erreur : ${JSON.stringify(xerr)} ; erreurs JS : ${JSON.stringify(errs)}`);
  process.exit(vides.length || xerr.length || errs.length ? 1 : 0);
}
