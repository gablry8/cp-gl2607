import { ecrireResultats, lancerNavigateur, out } from './env.mjs';
// Suite X — mise à jour du cache hors réseau (P0, T8 du REFONTE-PLAN, 21/10/2026).
// Un appareil a la version N installée (service worker, cache « climpilot-next-0000-ancienne », données en place) ; le serveur
// publie N+1 (= l'arbre actuel) ; on vérifie : cache remplacé, ancien supprimé, données gardées, ouverture HORS LIGNE avec
// TOUS les fichiers listés dans sw.js servis depuis le cache (R16 : un fichier oublié = écran blanc hors ligne).
// Serveur propre à la suite (port 8766, même origine avant/après), version N = copie de l'arbre avec sw.js renommé : aucun git requis.
import fs from 'fs'; import path from 'path'; import http from 'http'; import { fileURLToPath } from 'url';
import { SEED, sansBibliothequesCloud } from './lib.mjs';
const ICI = path.dirname(fileURLToPath(import.meta.url)), RACINE = path.resolve(ICI, '..');
const RES = []; const rec = (g, n, ok, d) => RES.push({ group: g, name: n, ok: ok ? 'PASS' : 'FAIL', detail: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
const j = (o) => JSON.stringify(o); const G = 'Mise à jour';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/plain' };

/* version N : copie des fichiers livrés avec un autre nom de cache */
const ANCIEN = out('maj-ancienne'); fs.rmSync(ANCIEN, { recursive: true, force: true }); fs.mkdirSync(path.join(ANCIEN, 'fonts'), { recursive: true }); fs.mkdirSync(path.join(ANCIEN, 'vendor'), { recursive: true });
const swTxt = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
const listeSw = [...swTxt.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
for (const f of listeSw) { const src = path.join(RACINE, f); if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(path.join(ANCIEN, f)), { recursive: true }); fs.copyFileSync(src, path.join(ANCIEN, f)); } } /* S (10/11/2026) : sous-dossiers de vendor/ (lecture de plaque) */
fs.copyFileSync(path.join(RACINE, 'manifest.json'), path.join(ANCIEN, 'manifest.json'));
fs.writeFileSync(path.join(ANCIEN, 'sw.js'), swTxt.replace(/^const C='[^']+';/, "const C='climpilot-next-0000-ancienne';"));
const cacheActuel = (swTxt.match(/^const C='([^']+)';/) || [])[1];
rec(G, `sw.js : nom de cache lu (${cacheActuel}), ${listeSw.length} fichiers listés, tous présents sur le disque`, !!cacheActuel && listeSw.every((f) => fs.existsSync(path.join(RACINE, f))), listeSw.filter((f) => !fs.existsSync(path.join(RACINE, f))));

/* serveur de la suite : racine commutable ; /_installer.html est une page synthétique qui n'enregistre QUE le service worker (étape 0) */
let racine = ANCIEN; const journal = [];
const INSTALLER = '<!doctype html><meta charset="utf-8"><title>installer</title><script>navigator.serviceWorker.register("sw.js");</script>';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); journal.push(u);
  if (u === '/_installer.html') { res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); res.end(INSTALLER); return; }
  const f = path.join(racine, u === '/' ? 'index.html' : u);
  if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('absent'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); /* S : en flux (fichiers de plusieurs Mo de la lecture de plaque) */
});
await new Promise((r) => srv.listen(8766, '127.0.0.1', r));
const URL = 'http://localhost:8766/';

const b = await lancerNavigateur();

/* 0. M3 C8 (21/10/2026) : le cache rempli par l'INSTALLATION (sw.js, addAll) contient-il tout ce que index.html charge ?
   Avant ce contrôle, un fichier oublié dans sw.js passait la suite (mutation : ./next-terrain.js retiré, X 7/7) : la page ouverte en ligne
   le faisait entrer dans le cache par le gestionnaire fetch avant le passage hors ligne. Ici, la page synthétique /_installer.html
   n'enregistre que le service worker et ne charge rien d'autre : ce qui est dans le cache à la fin de l'installation vient d'addAll seul.
   Besoins lus dans index.html (scripts src ET data-src, feuilles de style, manifeste, icône) et dans les CSS (polices url()). */
{
  racine = RACINE;
  const idx = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const besoins = new Set(['/', '/index.html']);
  for (const m of idx.matchAll(/<script[^>]*\s(?:src|data-src)="([^"h][^"]*)"/g)) besoins.add('/' + m[1].split('?')[0]);
  for (const m of idx.matchAll(/<link rel="(?:stylesheet|manifest|apple-touch-icon)" href="([^"h][^"]*)"/g)) besoins.add('/' + m[1]);
  for (const css of [...besoins].filter((f) => f.endsWith('.css'))) { const t = fs.existsSync(path.join(RACINE, css)) ? fs.readFileSync(path.join(RACINE, css), 'utf8') : ''; for (const m of t.matchAll(/url\(\s*['"]?(?!data:|https?:)([^'")]+)['"]?\s*\)/g)) besoins.add('/' + m[1].replace(/^\.?\//, '')); }
  const ctx0 = await b.newContext({ serviceWorkers: 'allow' }); const p0 = await ctx0.newPage(); p0.setDefaultTimeout(90000); p0.setDefaultNavigationTimeout(90000); const errs0 = []; p0.on('pageerror', (e) => errs0.push(String(e).slice(0, 160)));
  await p0.goto(URL + '_installer.html');
  const cles = await p0.evaluate(async ([re, n]) => { for (let i = 0; i < 120; i++) { const ks = await caches.keys(); const k = ks.find((x) => new RegExp(re).test(x)); if (k) { const c = await caches.open(k); const l = await c.keys(); if (l.length >= n) return l.map((r) => new URL(r.url).pathname).sort(); } await new Promise((r) => setTimeout(r, 250)); } return null; }, [cacheActuel.replace(/[-.]/g, '\\$&'), listeSw.length]);
  const manquants = cles ? [...besoins].filter((f) => !cles.includes(f)) : [...besoins];
  rec(G, `Installation seule (page sans appli) : le cache « ${cacheActuel} » contient tout ce que index.html charge (${besoins.size} fichiers nécessaires, ${cles ? cles.length : 0} en cache)`, !!cles && manquants.length === 0 && errs0.length === 0, j({ manquants, erreurs: errs0, fichiersEnCache: cles ? cles.length : null, requetesServeur: journal.length }));
  await ctx0.close(); racine = ANCIEN; journal.length = 0;
}

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' }); await sansBibliothequesCloud(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
/* S (10/11/2026) : le cache à installer a grossi de 12,7 Mo (lecture de plaque) ; sur un runner lent, un chargement de page pendant l'installation dépassait les 30 s par défaut */
p.setDefaultTimeout(90000); p.setDefaultNavigationTimeout(90000);
await p.route(/supabase/, (r) => r.abort());
const caches = () => p.evaluate(async () => (await caches.keys()).sort());
const attendreCache = (re, n) => p.evaluate(async ([re, n]) => { for (let i = 0; i < 80; i++) { const ks = await caches.keys(); const k = ks.find((x) => new RegExp(re).test(x)); if (k) { const c = await caches.open(k); if ((await c.keys()).length >= n) return { nom: k, fichiers: (await c.keys()).length }; } await new Promise((r) => setTimeout(r, 250)); } return null; }, [re, n]);

/* 1. version N installée, avec des données */
await p.goto(URL + 'index.html'); await p.waitForTimeout(2500); await p.evaluate(SEED);
const c0 = await attendreCache('0000-ancienne', listeSw.length);
const d0 = await p.evaluate(() => ({ devis: DEVIS.length, clients: CLIENTS.length }));
rec(G, 'Version N installée : service worker actif, cache « 0000-ancienne » rempli, 12 devis en place', !!c0 && c0.fichiers >= listeSw.length && d0.devis === 12, j({ c0, d0 }));

/* 2. le serveur publie N+1 ; l'appareil recharge (F5) : le navigateur découvre N+1 et l'installe ; puis l'appli est rouverte.
   OUTILLAGE-X (13/11/2026) : on attend que la mise à jour soit FINIE (N+1 activée, ancien cache supprimé) AVANT de rouvrir l'appli.
   Avant, la réouverture partait à heure fixe (2,5 s) et tombait parfois pendant l'installation de N+1 (12,7 Mo) : c'est la cause du
   rechargement hors ligne figé de la CI (docs/OUTILLAGE-X-COMPTE-RENDU.md). Playwright attache ses outils de développement à chaque
   service worker ; Chromium ne termine alors plus l'ancienne version de lui-même : N+1 reste « en attente » (plus de 120 s mesurées),
   puis la navigation suivante déclenche son activation et ne se termine jamais. Sur un appareil réel (rien d'attaché au service worker),
   la même course se termine normalement (vérifié hors dépôt avec le même Chromium 141).
   Si la mise à jour ne finit pas en 120 s, les contrôles sont ROUGES avec l'état du service worker, sans navigation (elle figerait). */
racine = RACINE; journal.length = 0;
await p.reload({ waitUntil: 'load' });
const maj = await p.evaluate(async ([C, n]) => {
  const etat = async () => {
    const r = await navigator.serviceWorker.getRegistration(); const ks = (await caches.keys()).sort();
    return { caches: ks, fichiers: ks.includes(C) ? (await (await caches.open(C)).keys()).length : 0, active: r && r.active ? r.active.state : null, enAttente: !!(r && r.waiting), enInstallation: !!(r && r.installing) };
  };
  const t0 = Date.now(); let e = null;
  while (Date.now() - t0 < 120000) {
    e = await etat();
    if (e.caches.length === 1 && e.caches[0] === C && e.fichiers >= n && e.active === 'activated' && !e.enAttente && !e.enInstallation) return { finie: true, ms: Date.now() - t0, ...e };
    await new Promise((r) => setTimeout(r, 250));
  }
  return { finie: false, ms: Date.now() - t0, ...e };
}, [cacheActuel, listeSw.length]);
console.log('INFO mise à jour N+1 ' + (maj.finie ? 'finie' : 'NON FINIE') + ' en ' + maj.ms + ' ms (' + j(maj) + ')');
if (maj.finie) { await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500); }
const c1 = maj.finie ? await attendreCache(cacheActuel.replace(/[-.]/g, '\\$&'), listeSw.length) : null;
const ks = await caches();
const d1 = await p.evaluate(() => ({ devis: DEVIS.length, clients: CLIENTS.length, sw: !!navigator.serviceWorker.controller, planning: typeof window.nxplSource }));
rec(G, `Après mise à jour : cache « ${cacheActuel} » installé avec les ${listeSw.length} fichiers, ancien cache supprimé`, maj.finie && !!c1 && c1.fichiers >= listeSw.length && ks.length === 1 && ks[0] === cacheActuel, j({ c1, caches: ks, maj }));
rec(G, 'Après mise à jour : données conservées (12 devis, 3 clients), service worker au contrôle', d1.devis === 12 && d1.clients === 3 && d1.sw, j(d1));

/* 3. hors ligne : tout vient du cache */
const NOM_HL = 'Hors ligne après mise à jour (serveur arrêté) : l\'appli s\'ouvre depuis le cache, données là, bibliothèques embarquées chargées, chaque fichier demandé servi par le service worker, aucun en échec ni en erreur';
const NOM_NAV = 'Hors ligne : changement d\'écran Planning puis Accueil';
if (!maj.finie) {
  rec(G, NOM_HL, false, 'non exécuté : la mise à jour N+1 ne s\'est pas terminée (contrôle « Après mise à jour » ci-dessus) ; une navigation figerait la page');
  rec(G, NOM_NAV, false, 'non exécuté : même raison');
} else {
  /* hors ligne POUR DE VRAI : le serveur est arrêté (le service worker a son propre accès réseau, que setOffline ne coupe pas) */
  await new Promise((r) => srv.close(r)); await ctx.setOffline(true); journal.length = 0;
  /* OUTILLAGE-X : « tous les fichiers servis depuis le cache » est vérifié requête par requête : chaque réponse de l'origine de l'appli vient du
     service worker, aucune n'est en erreur (≥ 400) NI EN ÉCHEC, et chaque script de la page a sa réponse. Avant, un fichier listé dans sw.js mais
     absent du cache au moment du hors ligne échouait sans statut HTTP et la suite passait (mutation b, compte rendu OUTILLAGE-X). */
  const chemin = (u) => u.slice(URL.length).split('?')[0];
  const echecs = [], horsSW = [], servis = new Set();
  p.on('response', (r) => { if (!r.url().startsWith(URL)) return; if (r.status() >= 400) echecs.push(r.status() + ' ' + chemin(r.url())); else if (!r.fromServiceWorker()) horsSW.push(chemin(r.url())); else servis.add(chemin(r.url())); });
  p.on('requestfailed', (r) => { if (r.url().startsWith(URL)) echecs.push('échec (' + ((r.failure() || {}).errorText || '?') + ') ' + chemin(r.url())); });
  /* S-bis (11/11/2026), complété par OUTILLAGE-X : si ce rechargement ne finit pas, la suite écrit l'état de la page, celui de la mise à jour et les requêtes
     en suspens vues par le CONTEXTE (celles du service worker comprises : la page ne voit pas une requête que le service worker n'a pas encore servie). */
  const enCours = new Map(); ctx.on('request', (r) => enCours.set(r, (r.serviceWorker() ? 'SW ' : '') + chemin(r.url()))); const finie = (r) => enCours.delete(r); ctx.on('requestfinished', finie); ctx.on('requestfailed', finie);
  try { await p.reload({ waitUntil: 'load' }); } catch (e) {
    const etat = await Promise.race([p.evaluate(() => ({ etat: document.readyState, devis: typeof DEVIS !== 'undefined' ? DEVIS.length : 'ABSENT', sw: !!navigator.serviceWorker.controller, scripts: document.scripts.length, vue: (document.querySelector('.view.active') || {}).id || null })).catch((x) => ({ erreur: String(x).slice(0, 120) })), new Promise((r) => setTimeout(() => r({ erreur: 'page muette (5 s)' }), 5000))]);
    console.log('DIAGNOSTIC rechargement hors ligne — ' + String(e.message).split('\n')[0] + ' | page : ' + j(etat) + ' | mise à jour avant la coupure : ' + j(maj) + ' | service workers : ' + ctx.serviceWorkers().length + ' | erreurs : ' + j(errs.slice(0, 3)) + ' | réponses en erreur ou en échec : ' + j(echecs.slice(0, 5)) + ' | requêtes sans réponse (' + enCours.size + ') : ' + [...enCours.values()].slice(0, 15).join(', '));
    throw e;
  }
  await p.waitForTimeout(3000);
  const d2 = await p.evaluate(() => ({ devis: typeof DEVIS !== 'undefined' ? DEVIS.length : 'ABSENT', horsLigne: !navigator.onLine, couches: document.querySelectorAll('script[src^="next-"]').length, store: !!(window.nxStore && nxStore.ready), supabase: typeof window.supabase, vue: (document.querySelector('.view.active') || {}).id || null,
    scripts: [...document.scripts].map((s) => s.src).filter((u) => u && u.startsWith(location.origin + '/')).map((u) => u.slice(location.origin.length + 1).split('?')[0]) })).catch((e) => ({ erreur: String(e) }));
  const sansReponse = (d2.scripts || []).filter((f) => !servis.has(f));
  rec(G, NOM_HL, d2.devis === 12 && d2.store && d2.horsLigne && d2.couches >= 44 && servis.has('index.html') && echecs.length === 0 && horsSW.length === 0 && sansReponse.length === 0,
    j({ d2: { ...d2, scripts: (d2.scripts || []).length }, servisParLeServiceWorker: servis.size, echecs: echecs.slice(0, 5), horsServiceWorker: horsSW.slice(0, 5), scriptsSansReponse: sansReponse.slice(0, 5) }));
  const nav = await p.evaluate(async () => { try { go('plan'); await new Promise((r) => setTimeout(r, 300)); const a = (document.querySelector('.view.active') || {}).id; go('dash'); await new Promise((r) => setTimeout(r, 300)); return a + ' → ' + (document.querySelector('.view.active') || {}).id; } catch (e) { return 'ERREUR ' + e; } });
  rec(G, NOM_NAV, nav === 'v-plan → v-dash', nav);
}
if (srv.listening) { srv.closeAllConnections(); srv.close(); } /* mise à jour inachevée : le serveur n'a pas été arrêté à l'étape 3 */
rec(G, 'Aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
await b.close();
ecrireResultats('resX.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
