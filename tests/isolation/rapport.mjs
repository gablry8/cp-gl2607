// Rapport de tests/run-all.sh : commit testé, versions, résultats étape par étape, preuves d'isolation.
// Règles : un résultat absent = NON EXÉCUTÉ ; un plantage = ÉCHEC ; un SKIP reste SKIP. Rien n'est compté
// comme réussi sans résultat écrit par le test lui-même. Écrit rapport.md et rapport.json dans CP_TEST_OUT.
// Ne contient que des noms de tests, des comptes et des noms d'hôtes (aucune donnée de l'appli).
import fs from 'fs'; import path from 'path'; import { execFileSync, spawnSync } from 'child_process';
import { OUT, out, RACINE, PLAYWRIGHT_CHEMIN } from '../env.mjs';

const sh = (cmd, args, opts = {}) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim(); } catch (_) { return null; } };
const lire = (f) => { try { return JSON.parse(fs.readFileSync(out(f), 'utf8')); } catch (_) { return null; } };
const lignes = (canal) => { try { return fs.readFileSync(out('isolation', canal + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_) { return []; } };

/* commit et arbre */
const sha = sh('git', ['-C', RACINE, 'rev-parse', 'HEAD']);
const sale = sh('git', ['-C', RACINE, 'status', '--porcelain', '--untracked-files=no']);
const branche = sh('git', ['-C', RACINE, 'rev-parse', '--abbrev-ref', 'HEAD']);

/* versions */
const pyv = sh('python3', ['-c', "import sys,importlib.metadata as m,json;print(json.dumps({'python':sys.version.split()[0],**{k:m.version(k) for k in ['pytest','psycopg','psycopg-binary','factur-x','lxml','saxonche']}}))"]);
let pwv = null; try { pwv = JSON.parse(fs.readFileSync(path.join(path.dirname(PLAYWRIGHT_CHEMIN), 'package.json'), 'utf8')).version; } catch (_) {}
const nav = lire(path.join('isolation', 'versions-navigateur.json')) || {};
const depot = (d) => d && fs.existsSync(d) ? { chemin: d, version: sh('git', ['-C', d, 'describe', '--tags', '--always']), commit: sh('git', ['-C', d, 'rev-parse', 'HEAD']), origine: sh('git', ['-C', d, 'remote', 'get-url', 'origin']) } : null;
const xslt = process.env.EN16931_XSLT;
let pg = null;
if (process.env.PGHOST) {
  const r = spawnSync('python3', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(path.join(RACINE, 'tests', 'sql'))})
import psycopg, json; from cible_locale import parametres, verifier_connexion
with psycopg.connect(**parametres(), connect_timeout=5) as c:
    verifier_connexion(c); print(json.dumps(c.execute("select version(), current_setting('cluster_name')").fetchone()))`], { encoding: 'utf8' });
  pg = r.status === 0 ? JSON.parse(r.stdout) : { erreur: (r.stderr || '').trim().split('\n').pop() };
}
const versions = {
  node: process.version, playwright: pwv, chromium: nav.chromium || null, ...(pyv ? JSON.parse(pyv) : {}),
  postgresql: pg ? (pg.erreur ? pg.erreur : pg[0].split(' on ')[0] + ' (marqueur ' + pg[1] + ')') : null,
  validateur_cen: depot(xslt ? path.resolve(xslt, '../../..') : null), validateur_fnfe: depot(process.env.BRFR_DIR),
};

/* résultats */
const codes = Object.fromEntries((fs.existsSync(out('codes.txt')) ? fs.readFileSync(out('codes.txt'), 'utf8').trim().split('\n').filter(Boolean) : []).map((l) => { const [n, c, d] = l.split(' '); return [n, { code: +c, duree: +d }]; }));
const ETAPES = [
  ['autotest-isolation', 'resIsolation.json'], ['suiteA', 'resA.json'], ['suiteB', 'resB.json'], ['suiteC', 'resC.json'], ['suiteD-memoire', 'resD.json'],
  ['suiteE-avoirs', 'resE.json'], ['suiteF-einvoice', 'resF.json'], ['suiteG-virgule', 'resG.json'], ['suiteH-superpdp', 'resH.json'], ['suiteI-emission', 'resI.json'],
  ['suiteJ-particuliers', 'resJ.json'], ['suiteK-fiscal', 'resK.json'], ['suiteL-documents', 'resL.json'], ['suiteM-adresse-copie', 'resM.json'], ['suiteN-passage-reel', 'resN.json'], ['fn-signature', 'resFn-signature.json'],
  ['fn-liste-blanche', 'resFn-liste-blanche.json'], ['fn-superpdp-envoi', 'resFn-superpdp-envoi.json'], ['sql', 'sql-junit.xml'], ['apercu-test', 'resApercu.json'],
];
const tableau = ETAPES.map(([nom, fichier]) => {
  const c = codes[nom];
  const e = { etape: nom, code: c ? c.code : null, duree_s: c ? c.duree : null, PASS: 0, FAIL: 0, SKIP: 0, autres: 0, statut: '', echecs: [] };
  if (fichier.endsWith('.xml')) {
    const x = fs.existsSync(out(fichier)) ? fs.readFileSync(out(fichier), 'utf8') : null;
    if (!x) { e.statut = c ? 'ÉCHEC (pas de résultat)' : 'NON EXÉCUTÉ'; return e; }
    const a = (k) => +((new RegExp(`<testsuite [^>]*\\b${k}="(\\d+)"`).exec(x) || [])[1] || 0);
    e.SKIP = a('skipped'); e.FAIL = a('failures') + a('errors'); e.PASS = a('tests') - e.SKIP - e.FAIL;
    e.echecs = [...x.matchAll(/<testcase [^>]*name="([^"]+)"[^>]*>\s*<(failure|error)/g)].map((m) => m[1]);
  } else {
    const r = lire(fichier);
    if (!r) { e.statut = c ? 'ÉCHEC (plantage, pas de résultat)' : 'NON EXÉCUTÉ'; return e; }
    for (const t of r) { if (t.ok === 'PASS') e.PASS++; else if (t.ok === 'FAIL') { e.FAIL++; e.echecs.push(t.name); } else if (t.ok === 'SKIP') e.SKIP++; else { e.autres++; e.echecs.push(t.name + ' [' + t.ok + ']'); } }
  }
  e.statut = e.FAIL || e.autres ? 'ÉCHEC' : (c && c.code !== 0) ? 'ÉCHEC (code de sortie ' + c.code + ')' : e.SKIP ? 'RÉUSSI avec SKIP' : 'RÉUSSI';
  if (!e.PASS && !e.FAIL && e.SKIP) e.statut = 'SKIP';
  return e;
});

/* isolation */
const compter = (l, cle) => Object.entries(l.reduce((o, x) => ((o[x[cle]] = (o[x[cle]] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]);
const PROD = ((/var SUPA_URL='https:\/\/([a-z0-9.-]+)'/.exec(fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')) || [])[1]) || '(introuvable)';
const iso = {
  prod_playwright: lignes('navigateur-requetes').filter((x) => x.hote === PROD).length,
  prod_reseau: [...lignes('navigateur-mandataire'), ...lignes('node'), ...lignes('python')].filter((x) => String(x.hote).split(':')[0] === PROD).length,
  noyau: process.env.CP_DANS_NETNS === '1' ? 'OUI (unshare -n)' : 'NON (CP_SANS_NETNS=1 : gardes logicielles seulement)',
  interfaces: fs.existsSync(out('isolation', 'interfaces.txt')) ? fs.readFileSync(out('isolation', 'interfaces.txt'), 'utf8').trim() : 'non relevé',
  tentatives_vues_par_playwright: lignes('navigateur-requetes').length, par_hote_playwright: compter(lignes('navigateur-requetes'), 'hote'),
  websockets: lignes('navigateur-websocket').length,
  refus_mandataire_navigateur: lignes('navigateur-mandataire').length, par_hote_mandataire: compter(lignes('navigateur-mandataire'), 'hote'),
  refus_garde_node: lignes('node').length, par_hote_node: compter(lignes('node'), 'hote'),
  refus_garde_python: lignes('python').length, par_hote_python: compter(lignes('python'), 'hote'),
};
const total = tableau.reduce((t, e) => ({ PASS: t.PASS + e.PASS, FAIL: t.FAIL + e.FAIL + e.autres, SKIP: t.SKIP + e.SKIP }), { PASS: 0, FAIL: 0, SKIP: 0 });
const nonExec = tableau.filter((e) => e.statut === 'NON EXÉCUTÉ').map((e) => e.etape);
const echecs = tableau.filter((e) => /ÉCHEC/.test(e.statut)).map((e) => e.etape);
const verdict = echecs.length ? 'ÉCHEC' : (nonExec.length || total.SKIP) ? 'INCOMPLET (voir non exécutés / SKIP)' : 'COMPLET, TOUT RÉUSSI';
const rapport = { date: new Date().toISOString(), commit: sha, branche, arbre_modifie: !!sale, sortie: OUT, versions, etapes: tableau, total, non_executes: nonExec, echecs, isolation: iso, verdict };
fs.writeFileSync(out('rapport.json'), JSON.stringify(rapport, null, 1));

const md = [];
md.push('# Rapport de tests ClimPilot', '', `- Commit testé : \`${sha}\` (branche ${branche})${sale ? ' — ATTENTION : arbre de travail modifié' : ' — arbre propre'}`, `- Date : ${rapport.date}`, `- Verdict : **${verdict}** — ${total.PASS} réussis, ${total.FAIL} échoués, ${total.SKIP} SKIP${nonExec.length ? ', non exécutés : ' + nonExec.join(', ') : ''}`, '');
md.push('## Versions', '', '| Outil | Version |', '|---|---|');
for (const [k, v] of Object.entries(versions)) md.push(`| ${k} | ${v == null ? 'absent' : typeof v === 'object' ? `${v.version} (${v.commit}) ${v.origine || ''}` : v} |`);
md.push('', '## Résultats', '', '| Étape | Statut | Réussis | Échoués | SKIP | Code | Durée |', '|---|---|---:|---:|---:|---:|---:|');
for (const e of tableau) md.push(`| ${e.etape} | ${e.statut} | ${e.PASS} | ${e.FAIL + e.autres} | ${e.SKIP} | ${e.code ?? '—'} | ${e.duree_s != null ? e.duree_s + ' s' : '—'} |`);
const ech = tableau.filter((e) => e.echecs.length);
if (ech.length) { md.push('', '### Échecs'); for (const e of ech) md.push(`- ${e.etape} : ${e.echecs.join(' ; ')}`); }
const sk = []; for (const [nom, f] of ETAPES) { const r = f.endsWith('.json') && lire(f); if (r) r.filter((t) => t.ok === 'SKIP').forEach((t) => sk.push(`- ${nom} : ${t.name} — ${t.detail}`)); }
if (sk.length) md.push('', '### SKIP (non vérifié, jamais compté comme réussi)', ...sk);
md.push('', '## Isolation réseau', '', `- Isolation du noyau : ${iso.noyau} ; ${iso.interfaces}`,
  `- Tentatives vues par Playwright (y compris celles simulées ou interrompues par les tests) : ${iso.tentatives_vues_par_playwright} — ${iso.par_hote_playwright.slice(0, 12).map(([h, n]) => h + ' ×' + n).join(', ') || 'aucune'}`,
  `- dont vers le projet Supabase RÉEL (hôte lu dans index.html) : ${iso.prod_playwright} tentative(s) vue(s) par Playwright, ${iso.prod_reseau} arrivée(s) au réseau du navigateur${iso.prod_playwright && !iso.prod_reseau ? ' — toutes servies par une simulation ou interrompues par les tests, aucune n\'a quitté le navigateur' : ''}`,
  `- WebSockets non locaux ouverts par les pages : ${iso.websockets}`,
  `- Tentatives arrivées au réseau du navigateur, toutes refusées par le mandataire : ${iso.refus_mandataire_navigateur}`,
  ...[['autotest (volontaires)', (h) => /autotest-isolation|192\.0\.2\.1/.test(h)], ['trafic de fond de Chromium (services Google, pas l\'appli)', (h) => /(^|\.)(google\.com|gvt1\.com|googleapis\.com|gstatic\.com)(:\d+)?$/.test(h) && !/fonts\./.test(h)], ['appli et tests', null]].map(([lib, f], i, all) => {
    const l = iso.par_hote_mandataire.filter(([h]) => (f ? f(h) : !all.slice(0, -1).some(([, g]) => g(h))));
    return `  - ${lib} : ${l.reduce((t, [, n]) => t + n, 0)}${l.length ? ' — ' + l.map(([h, n]) => h + ' ×' + n).join(', ') : ''}`; }),
  `- Refus de la garde Node : ${iso.refus_garde_node} — ${iso.par_hote_node.map(([h, n]) => h + ' ×' + n).join(', ') || 'aucun'}`,
  `- Refus de la garde Python : ${iso.refus_garde_python} — ${iso.par_hote_python.map(([h, n]) => h + ' ×' + n).join(', ') || 'aucun'}`,
  `- Connexions externes réellement établies : ${process.env.CP_DANS_NETNS === '1' ? '0 — aucune interface autre que la boucle locale dans l\'espace réseau des tests (vérifié par l\'autotest, gardes désactivées)' : 'NON PROUVÉ sans isolation du noyau (seules les gardes logicielles ont été actives)'}`,
  '- Les refus de l\'autotest (noms autotest-isolation.*, 192.0.2.1) sont volontaires : ils prouvent que le blocage fonctionne.');
fs.writeFileSync(out('rapport.md'), md.join('\n') + '\n');
console.log('\n' + md.join('\n'));
process.exitCode = echecs.length ? 1 : (nonExec.length ? 3 : 0);
