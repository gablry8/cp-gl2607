// Génère (ou régénère) tests/golden/calculs.json depuis le code ACTUEL (P0, T1). À lancer seulement quand un changement de
// montant a été vu, expliqué et ACCEPTÉ par Gabriel : `node tests/golden/generer.mjs` (serveur local sur 8765 requis, comme la
// batterie : `python3 -m http.server 8765 --bind 127.0.0.1` à la racine, ou via tests/run-all.sh avec CP_SUITES vide).
// Écrit aussi tests/golden/calculs-lisible.md : les 3 devis « à vérifier à la main » avec le détail ligne par ligne.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { execSync } from 'child_process';
import { CAS, RELEVER, HORLOGE } from './cas-calculs.mjs';
import { pageFigee, fermer } from './page-figee.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url));
let sha = 'inconnu'; try { sha = execSync('git rev-parse --short HEAD', { cwd: ICI, encoding: 'utf8' }).trim(); } catch (e) {}

export async function releverTout() {
  const res = {};
  for (const assujetti of [false, true]) {
    const liste = CAS.filter((c) => !!c.assujetti === assujetti); if (!liste.length) continue;
    const { p, ctx, errs } = await pageFigee({ horloge: HORLOGE, assujetti });
    if (assujetti) await p.evaluate(() => { if (typeof rebuildP === 'function') rebuildP(); });
    for (const c of liste) {
      try { res[c.id] = await p.evaluate(`(${RELEVER})((${c.construire})(), ${JSON.stringify({ id: c.id })})`); }
      catch (e) { res[c.id] = { erreur: String(e).slice(0, 300) }; }
    }
    res['_erreursJS' + (assujetti ? '_assujetti' : '')] = errs;
    await ctx.close();
  }
  return res;
}
const eur = (x) => (typeof x === 'number' ? x.toFixed(2).replace('.', ',') + ' €' : String(x));
function lisible(res) {
  const L = ['# Golden master des calculs — devis « à vérifier à la main »', '', `Généré le ${new Date().toISOString().slice(0, 10)} depuis le commit \`${sha}\`, horloge figée au ${HORLOGE}, régime franchise (TVA 0) sauf mention.`,
    'Ce sont les montants que l\'appli calcule AUJOURD\'HUI (figés, pas jugés). Gabriel les compare à l\'appli : Nouveau devis › même nature › mêmes valeurs.', ''];
  for (const c of CAS.filter((x) => x.verifiable)) {
    const r = res[c.id]; if (!r || r.erreur) { L.push(`## ${c.titre}`, '', 'ERREUR : ' + (r && r.erreur), ''); continue; }
    L.push(`## ${c.titre}`, '', `Cas \`${c.id}\` — taux horaire ${r.rate} €/h, ${r.heures} h, cotisations ${r.cotisPct} %${r.franchise ? ', franchise de TVA' : ''}`, '', '| Groupe | Ligne | Qté | Unité | PU HT | Total HT | Achat |', '|---|---|---:|---|---:|---:|---:|');
    for (const l of r.lines) L.push(`| ${l.group} | ${l.label} | ${l.qte} | ${l.unite} | ${eur(l.pu)} | ${eur(l.ht)} | ${eur(l.achat)} |`);
    L.push('', `- **Total HT** : ${eur(r.totalHT)} (somme des lignes${r.lines.length ? '' : ' — aucune'})`, `- **TVA** : ${eur(r.tva)} (${r.tvaRate} %${r.franchise ? ', franchise : 0' : ''})`, `- **Total TTC** : ${eur(r.totalTTC)}`,
      `- **Acompte** : ${eur(r.acompte)}${r.acompte ? ' (' + (r.acompte / r.billTTC * 100).toFixed(2) + ' % du TTC facturable ' + eur(r.billTTC) + ')' : ''}`, `- **Solde** : ${eur(r.solde)} (TTC − acompte)`,
      `- Coût réel : ${eur(r.coutReel)} = achats ${eur(r.matAchat)} + main-d'œuvre interne ${eur(r.moAchat)} ; bénéfice ${eur(r.benefice)} ; cotisations ${eur(r.cotis)} ; bénéfice net ${eur(r.benefNet)}`);
    if (r.warnings.length) L.push(`- Avertissements de l'appli : ${r.warnings.join(' | ')}`);
    L.push('');
  }
  return L.join('\n');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const res = await releverTout(); await fermer();
  const n = Object.keys(res).filter((k) => !k.startsWith('_')).length, err = Object.values(res).filter((r) => r && r.erreur).length;
  fs.writeFileSync(path.join(ICI, 'calculs.json'), JSON.stringify({ genere: new Date().toISOString(), commit: sha, horloge: HORLOGE, cas: res }, null, 1));
  fs.writeFileSync(path.join(ICI, 'calculs-lisible.md'), lisible(res));
  console.log(`golden calculs : ${n} cas écrits (${err} en erreur) → tests/golden/calculs.json ; erreurs JS : ${JSON.stringify(res._erreursJS)} / ${JSON.stringify(res._erreursJS_assujetti)}`);
  process.exit(err ? 1 : 0);
}
