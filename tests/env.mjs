// Environnement commun des tests ClimPilot : chemins, Playwright/Chromium, isolation réseau du navigateur.
// Aucun chemin propre à une machine : tout se règle par variables d'environnement (voir tests/LISEZMOI.md).
//   CP_TEST_OUT      dossier des résultats (défaut : <dossier temporaire>/climpilot-tests)
//   PLAYWRIGHT_MODULE chemin de playwright/index.mjs (défaut : module « playwright » local ou global)
//   CHROMIUM_PATH    exécutable Chromium (défaut : celui installé par Playwright)
import fs from 'fs'; import os from 'os'; import path from 'path'; import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url'; import { createRequire } from 'module'; import { execSync } from 'child_process';

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
export const OUT = process.env.CP_TEST_OUT || path.join(os.tmpdir(), 'climpilot-tests');
fs.mkdirSync(OUT, { recursive: true });
export const out = (...p) => path.join(OUT, ...p);
export const URL_LOCALE = 'http://localhost:8765/';

function modulePlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return process.env.PLAYWRIGHT_MODULE;
  try { // module local ou NODE_PATH : on préfère l'entrée ESM (index.mjs) à côté de index.js
    const js = createRequire(RACINE + 'package.json').resolve('playwright'), mjs = path.join(path.dirname(js), 'index.mjs');
    return fs.existsSync(mjs) ? mjs : js;
  } catch (_) { /* pas de node_modules dans le dépôt */ }
  const g = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return path.join(g, 'playwright', 'index.mjs');
}
export const PLAYWRIGHT_CHEMIN = modulePlaywright();
const pw = await import(pathToFileURL(PLAYWRIGHT_CHEMIN).href);
export const chromium = pw.chromium || pw.default.chromium, devices = pw.devices || pw.default.devices;

/* ---------- journal d'isolation (hôte seulement : ni chemin ni paramètres, donc aucune donnée) ---------- */
const SUITE = path.basename(process.argv[1] || 'inconnu');
export function noter(canal, o) {
  try { fs.mkdirSync(out('isolation'), { recursive: true }); fs.appendFileSync(out('isolation', canal + '.jsonl'), JSON.stringify({ suite: SUITE, ...o }) + '\n'); } catch (_) {}
}
export const estLocale = (u) => /^(https?|wss?):\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?\//i.test(u) || /^(data|blob|about|chrome|chrome-extension):/i.test(u);
// hôte seulement ; pour un lien sans réseau (mailto:, tel:…) le schéma seul
const hote = (u) => { try { const x = new URL(u); return x.host || x.protocol; } catch (_) { return String(u).slice(0, 40); } };

/* Mandataire « refus » : tout trafic réseau du navigateur qui n'est pas local passe par lui et reçoit un refus.
   Couvre les pages, le service worker et les WebSockets, y compris vers une adresse IP brute. Chaque tentative
   arrivée jusqu'au réseau est notée (canal navigateur-mandataire). La boucle locale ne passe pas par lui. */
let portMandataire = null;
async function mandataireRefus() {
  if (portMandataire) return portMandataire;
  const srv = http.createServer((req, res) => { // HTTP en clair : réponse 403 reconnaissable (en-tête x-cp-isolation)
    noter('navigateur-mandataire', { methode: req.method, hote: hote(req.url) });
    res.writeHead(403, { 'x-cp-isolation': 'refus', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-cp-isolation' }); res.end('CP_ISOLATION');
  });
  srv.on('connect', (req, sock) => { noter('navigateur-mandataire', { methode: 'CONNECT', hote: String(req.url).slice(0, 80) }); sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); srv.unref();
  portMandataire = srv.address().port; return portMandataire;
}
export async function optionsLancement() {
  const port = await mandataireRefus();
  return {
    // Chromium complet (channel « chromium ») plutôt que le « headless shell », qui refuse par exemple le presse-papiers
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
    args: [`--proxy-server=http://127.0.0.1:${port}`, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      // trafic de fond de Chromium (mises à jour de composants, comptes…) : coupé ; s'il en reste, le mandataire le refuse et le note
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings', '--disable-domain-reliability'],
  };
}
/* Tentatives vues par Playwright (y compris celles qu'une route simule ou interrompt) : canal navigateur-requetes */
export function surveiller(ctx) {
  ctx.on('request', (r) => { const u = r.url(); if (!estLocale(u)) noter('navigateur-requetes', { hote: hote(u), type: r.resourceType(), sw: !!(r.serviceWorker && r.serviceWorker()) }); });
  ctx.on('page', (p) => p.on('websocket', (ws) => { if (!estLocale(ws.url())) noter('navigateur-websocket', { hote: hote(ws.url()) }); }));
  return ctx;
}
export async function lancerNavigateur() {
  const b = await chromium.launch(await optionsLancement());
  const nc = b.newContext.bind(b);
  b.newContext = async (o) => surveiller(await nc(o));
  return b;
}
export function ecrireResultats(nom, RES) { fs.writeFileSync(out(nom), JSON.stringify(RES, null, 1)); }
