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
for (const f of listeSw) { const src = path.join(RACINE, f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ANCIEN, f)); }
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
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
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
  const ctx0 = await b.newContext({ serviceWorkers: 'allow' }); const p0 = await ctx0.newPage(); const errs0 = []; p0.on('pageerror', (e) => errs0.push(String(e).slice(0, 160)));
  await p0.goto(URL + '_installer.html');
  const cles = await p0.evaluate(async ([re, n]) => { for (let i = 0; i < 120; i++) { const ks = await caches.keys(); const k = ks.find((x) => new RegExp(re).test(x)); if (k) { const c = await caches.open(k); const l = await c.keys(); if (l.length >= n) return l.map((r) => new URL(r.url).pathname).sort(); } await new Promise((r) => setTimeout(r, 250)); } return null; }, [cacheActuel.replace(/[-.]/g, '\\$&'), listeSw.length]);
  const manquants = cles ? [...besoins].filter((f) => !cles.includes(f)) : [...besoins];
  rec(G, `Installation seule (page sans appli) : le cache « ${cacheActuel} » contient tout ce que index.html charge (${besoins.size} fichiers nécessaires, ${cles ? cles.length : 0} en cache)`, !!cles && manquants.length === 0 && errs0.length === 0, j({ manquants, erreurs: errs0, fichiersEnCache: cles ? cles.length : null, requetesServeur: journal.length }));
  await ctx0.close(); racine = ANCIEN; journal.length = 0;
}

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' }); await sansBibliothequesCloud(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await p.route(/supabase/, (r) => r.abort());
const caches = () => p.evaluate(async () => (await caches.keys()).sort());
const attendreCache = (re, n) => p.evaluate(async ([re, n]) => { for (let i = 0; i < 80; i++) { const ks = await caches.keys(); const k = ks.find((x) => new RegExp(re).test(x)); if (k) { const c = await caches.open(k); if ((await c.keys()).length >= n) return { nom: k, fichiers: (await c.keys()).length }; } await new Promise((r) => setTimeout(r, 250)); } return null; }, [re, n]);

/* 1. version N installée, avec des données */
await p.goto(URL + 'index.html'); await p.waitForTimeout(2500); await p.evaluate(SEED);
const c0 = await attendreCache('0000-ancienne', listeSw.length);
const d0 = await p.evaluate(() => ({ devis: DEVIS.length, clients: CLIENTS.length }));
rec(G, 'Version N installée : service worker actif, cache « 0000-ancienne » rempli, 12 devis en place', !!c0 && c0.fichiers >= listeSw.length && d0.devis === 12, j({ c0, d0 }));

/* 2. le serveur publie N+1 ; l'appareil recharge deux fois (comme un F5 puis une réouverture) */
racine = RACINE; journal.length = 0;
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
const c1 = await attendreCache(cacheActuel.replace(/[-.]/g, '\\$&'), listeSw.length); await p.waitForTimeout(1500);
const ks = await caches();
const d1 = await p.evaluate(() => ({ devis: DEVIS.length, clients: CLIENTS.length, sw: !!navigator.serviceWorker.controller, planning: typeof window.nxplSource }));
rec(G, `Après mise à jour : cache « ${cacheActuel} » installé avec les ${listeSw.length} fichiers, ancien cache supprimé`, !!c1 && c1.fichiers >= listeSw.length && ks.length === 1 && ks[0] === cacheActuel, j({ c1, caches: ks }));
rec(G, 'Après mise à jour : données conservées (12 devis, 3 clients), service worker au contrôle', d1.devis === 12 && d1.clients === 3 && d1.sw, j(d1));

/* 3. hors ligne : tout vient du cache */
/* hors ligne POUR DE VRAI : le serveur est arrêté (le service worker a son propre accès réseau, que setOffline ne coupe pas) */
await new Promise((r) => srv.close(r)); await ctx.setOffline(true); journal.length = 0;
const echecs = []; p.on('response', (r) => { if (r.url().startsWith(URL) && r.status() >= 400) echecs.push(r.status() + ' ' + r.url().slice(URL.length)); });
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
const d2 = await p.evaluate(() => ({ devis: typeof DEVIS !== 'undefined' ? DEVIS.length : 'ABSENT', horsLigne: !navigator.onLine, couches: document.querySelectorAll('script[src^="next-"]').length, store: !!(window.nxStore && nxStore.ready), supabase: typeof window.supabase, vue: (document.querySelector('.view.active') || {}).id || null })).catch((e) => ({ erreur: String(e) }));
rec(G, 'Hors ligne après mise à jour (serveur arrêté) : l\'appli s\'ouvre depuis le cache, données là, bibliothèques embarquées chargées, aucune réponse en erreur', d2.devis === 12 && d2.store && d2.horsLigne && echecs.length === 0 && d2.couches >= 44, j({ d2, echecs: echecs.slice(0, 5) }));
const nav = await p.evaluate(async () => { try { go('plan'); await new Promise((r) => setTimeout(r, 300)); const a = (document.querySelector('.view.active') || {}).id; go('dash'); await new Promise((r) => setTimeout(r, 300)); return a + ' → ' + (document.querySelector('.view.active') || {}).id; } catch (e) { return 'ERREUR ' + e; } });
rec(G, 'Hors ligne : changement d\'écran Planning puis Accueil', nav === 'v-plan → v-dash', nav);
rec(G, 'Aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
await b.close();
ecrireResultats('resX.json', RES);
RES.forEach((r) => console.log(r.ok.padEnd(5), '[' + r.group + ']', r.name, r.ok !== 'PASS' ? '— ' + r.detail : ''));
