import { ecrireResultats, URL_LOCALE } from './env.mjs';
// Suite W — ordre de chargement et enveloppes (P0, T6 + T7 du REFONTE-PLAN, 21/10/2026).
//  W1 : nombre d'enveloppes de go / compute / recalc / updateBadges… (comptage statique des `window.X=function` dans next-*.js),
//       figé dans tests/golden/enveloppes.json (R7 : 17+ enveloppes de go).
//  W2 : chaque couche next-*.js exécutée UNE SECONDE FOIS (comme un script rejoué) : l'appli doit rester saine — ce qui double
//       (identifiants DOM en doublon, erreurs) est FIGÉ et nommé « [R7 — connu] », pas caché.
//  W3 : démarrage dégradé — une couche en 404 : l'appli démarre ? un message ? combien de clés de synchro manquent ? (R8, figé).
// Rien n'est jugé : un golden master compare. La régénération (CP_GOLDEN_REGEN=1) se fait après accord de Gabriel.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { page, rec, RES, closeBrowser } from './lib.mjs';
import { pageFigee, fermer } from './golden/page-figee.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url)), RACINE = path.resolve(ICI, '..');
const j = (o) => JSON.stringify(o);
const G = 'Enveloppes';
const FICHIER = path.join(ICI, 'golden', 'enveloppes.json');
const golden = fs.existsSync(FICHIER) ? JSON.parse(fs.readFileSync(FICHIER, 'utf8')) : null;
const regen = !golden || process.env.CP_GOLDEN_REGEN === '1';
const nouveau = { statique: {}, doubleExecution: {}, couche404: {} };

/* ---------- W1 : comptage statique ---------- */
const FONCTIONS = ['go', 'compute', 'recalc', 'updateBadges', 'renderDash', 'showStep', 'formToDevis', 'loadDevisToForm', 'saveDevis', 'migrate', 'renderPlanning', 'openFlu', 'saveFlu', 'nextFacNum', 'renderList', 'printDevis', 'openDevis'];
const couches = [...fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8').matchAll(/type="text\/x-climpilot"[^>]*src="(next-[a-z0-9-]+\.js)"/g)].map((m) => m[1]);
const sources = Object.fromEntries(couches.map((f) => [f, fs.readFileSync(path.join(RACINE, f), 'utf8')]));
for (const fn of FONCTIONS) {
  const re = new RegExp('window\\.' + fn + '\\s*=\\s*function', 'g');
  nouveau.statique[fn] = couches.filter((f) => re.test(sources[f]) || (re.lastIndex = 0, false)).map((f) => f.replace(/^next-|\.js$/g, ''));
}
rec(G, `${couches.length} couches chargées dans l'ordre par next-store.js`, couches.length >= 36, couches.join(' '));
if (!regen) for (const fn of FONCTIONS) rec(G, `enveloppes de ${fn} : ${nouveau.statique[fn].length} (figé : ${(golden.statique[fn] || []).length})`, j(nouveau.statique[fn]) === j(golden.statique[fn]), { attendu: golden.statique[fn], obtenu: nouveau.statique[fn] });

/* ---------- W2 : exécution double de chaque couche ---------- */
for (const f of couches) {
  const { p, ctx, errs } = await page({ mobile: false, wait: 1500 });
  p.removeAllListeners('dialog'); p.on('dialog', (d) => d.accept().catch(() => {}));
  const r = await p.evaluate(async ([f, URL]) => {
    const doublons = () => { const vus = {}, d = []; document.querySelectorAll('[id]').forEach((e) => { if (vus[e.id] && d.indexOf(e.id) < 0) d.push(e.id); vus[e.id] = 1; }); return d; };
    go('dash'); await new Promise((z) => setTimeout(z, 150)); const avant = doublons();
    const txt = await (await fetch(URL + f)).text();
    const s = document.createElement('script'); s.textContent = txt; document.head.appendChild(s); /* rejoué comme un script classique */
    await new Promise((z) => setTimeout(z, 300));
    try { go('params'); } catch (e) {} await new Promise((z) => setTimeout(z, 150)); try { go('dash'); } catch (e) {} await new Promise((z) => setTimeout(z, 300));
    const apres = doublons().filter((x) => avant.indexOf(x) < 0);
    return { doublonsId: apres.slice(0, 12), vue: (document.querySelector('.view.active') || {}).id || null };
  }, [f, URL_LOCALE]).catch((e) => ({ erreur: String(e).slice(0, 160) }));
  const e = errs.map((x) => x.slice(0, 120)).slice(0, 3);
  nouveau.doubleExecution[f] = { doublonsId: r.doublonsId || [], erreurs: e, erreurTest: r.erreur || null };
  await ctx.close();
}
if (!regen) {
  for (const f of couches) {
    const a = golden.doubleExecution[f], o = nouveau.doubleExecution[f];
    const sain = o && !o.doublonsId.length && !o.erreurs.length && !o.erreurTest;
    const nom = sain ? `${f} rejoué : rien ne double, aucune erreur` : `[R7 — connu] ${f} rejoué : ${o.doublonsId.length} identifiant(s) en doublon, ${o.erreurs.length} erreur(s) (figé, correction prévue en P4)`;
    rec(G, nom, !!a && j(a) === j(o), { attendu: a, obtenu: o });
  }
}

/* ---------- W3 : une couche en 404 (page dédiée, route posée avant le chargement) ---------- */
for (const f of ['next-planning.js', 'next-emission.js']) {
  const { p, ctx, errs } = await pageFigee({ routes404: [new RegExp(f.replace('.', '\\.') + '$')], attendrePret: false });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => ({ demarre: typeof DEVIS !== 'undefined' && !!(window.nxStore && nxStore.ready), cles: Array.isArray(window.SYNC_KEYS) ? SYNC_KEYS.length : null,
    message: (document.body.innerText.match(/.{0,40}(manquant|introuvable|404|impossible de charger|couche).{0,40}/i) || [null])[0],
    vue: (document.querySelector('.view.active') || {}).id || null })).catch((e) => ({ erreur: String(e).slice(0, 160) }));
  nouveau.couche404[f] = { ...r, erreurs: errs.map((x) => x.slice(0, 120)).slice(0, 3) };
  await ctx.close();
}
await fermer();
if (!regen) for (const f of Object.keys(nouveau.couche404)) {
  const a = golden.couche404[f], o = nouveau.couche404[f];
  rec(G, `[R8 — connu] ${f} en 404 : l'appli ${o.demarre ? 'démarre' : 'NE DÉMARRE PAS'}, ${o.message ? 'message : « ' + o.message + ' »' : 'AUCUN message'}, ${o.cles} clés de synchro (figé)`, !!a && j(a) === j(o), { attendu: a, obtenu: o });
}
if (regen) { fs.mkdirSync(path.dirname(FICHIER), { recursive: true }); fs.writeFileSync(FICHIER, JSON.stringify(nouveau, null, 1)); rec(G, 'Golden enveloppes.json (ré)généré depuis le code actuel — relancer la suite pour comparer', true, FICHIER); }
await closeBrowser();
ecrireResultats('resW.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
