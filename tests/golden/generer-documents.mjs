// Génère (ou régénère) les golden masters DOCUMENTS et XML (P0, T2 et T3) depuis le code ACTUEL :
//   tests/golden/documents/<nom>.html   (HTML normalisé de l'aperçu PDF)   tests/golden/xml/<nom>.xml  (facture électronique CII)
// À lancer seulement après accord de Gabriel sur un changement vu et expliqué : node tests/golden/generer-documents.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { HORLOGE } from './cas-calculs.mjs';
import { SCENARIO, BASCULE_ASSUJETTI, SCENARIO_ASSUJETTI, normaliserHTML, normaliserXML } from './scenario-documents.mjs';
import { pageFigee, fermer } from './page-figee.mjs';
import { SEED } from '../lib.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
export async function releverDocuments() {
  const { p, ctx, errs } = await pageFigee({ horloge: HORLOGE });
  await p.evaluate(SEED);
  const r = await p.evaluate(SCENARIO);
  /* M3 C2 : le cache de calcul (memoCompute) doit être installé AVANT la bascule, sinon le résultat dépend de la vitesse de la machine ;
     la bascule et la facturation assujettie sont ensuite deux actions séparées (p.evaluate), comme deux clics dans l'appli */
  await p.waitForFunction(() => typeof window.compute === 'function' && window.compute._nxm === true, null, { timeout: 5000 }).catch(() => {});
  const bascule = await p.evaluate(BASCULE_ASSUJETTI);
  if (!bascule.memo) errs.push('memoCompute non installé avant la bascule (référence assujetti non reproductible)');
  const r2 = await p.evaluate(SCENARIO_ASSUJETTI);
  const docs = {}, xml = {};
  for (const [k, v] of Object.entries({ ...r.docs, ...r2.docs })) docs[k] = normaliserHTML(v);
  for (const [k, v] of Object.entries({ ...r.xml, ...r2.xml })) xml[k] = v.erreur ? { erreur: v.erreur, num: v.num } : { num: v.num, xml: normaliserXML(v.xml), chk: v.chk };
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
