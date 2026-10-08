// Vérifie l'aperçu construit par build.sh : chargement sans cloud, bandeau, exemples, facture de TEST,
// particulier bloqué, aucune requête externe hors polices, pas de défilement horizontal à 400 px.
// Usage : node tools/apercu/test-apercu.mjs [dossier de l'aperçu]   (défaut : $CP_TEST_OUT/apercu)
import fs from 'fs'; import http from 'http'; import path from 'path';
import { OUT, out, lancerNavigateur, estLocale } from '../../tests/env.mjs';

const DIR = process.argv[2] || path.join(OUT, 'apercu');
const body = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
/* même enveloppe que la publication : doctype + head minimal + contenu dans body (fichier hors de l'aperçu publié) */
const ENVELOPPE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + body + '</body></html>';
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8' };
const srv = http.createServer((q, r) => {
  const f = decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/^\/+/, '');
  if (f === '_test.html') { r.writeHead(200, { 'content-type': TYPES['.html'] }); return r.end(ENVELOPPE); }
  const p = path.join(DIR, path.basename(f));
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://localhost:${srv.address().port}/`;

const R = []; const rec = (name, ok, detail) => R.push({ group: 'Aperçu', name, ok: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail).slice(0, 400) });
const b = await lancerNavigateur();
for (const vp of [{ width: 1300, height: 900 }, { width: 400, height: 820 }]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris' }); const p = await ctx.newPage(); const errs = [], ext = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('request', (r) => { const u = r.url(); if (!estLocale(u)) ext.push(new URL(u).host); });
  await p.route(/cdn\.jsdelivr\.net\/npm\/chart/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=function(){return{destroy(){},update(){}}};' }));
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto(BASE + '_test.html'); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => { const o = {};
    o.barre = !!document.getElementById('apBarre'); o.sb = typeof window.supabase; o.mode = (window.nxEmisMode && nxEmisMode().mode) || '?';
    document.getElementById('apEx').click(); await new Promise((r) => setTimeout(r, 400));
    o.devis = DEVIS.length; o.clients = CLIENTS.length;
    const d = DEVIS.find((x) => x.statut === 'accepte' && x.cType === 'Professionnel' && compute(x).totalHT > 0);
    await facturerDevis(d.id, 'solde'); await new Promise((r) => setTimeout(r, 300)); o.num = d.facSolde && d.facSolde.num;
    const c = document.getElementById('nx-pdf-close'); if (c) c.click();
    const part = DEVIS.find((x) => x.statut === 'accepte' && x.cType === 'Particulier' && compute(x).totalHT > 0);
    if (part) { await facturerDevis(part.id, 'solde'); await new Promise((r) => setTimeout(r, 200)); o.partBloque = !part.facSolde && !!document.getElementById('nxPartM'); const m = document.getElementById('nxPartM'); if (m) m.remove(); }
    o.hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
    return o; });
  const W = vp.width + ' px';
  rec(`${W} : bandeau d'aperçu présent, aucune bibliothèque Supabase, mode démonstration`, r.barre && r.sb === 'undefined' && r.mode === 'demo', JSON.stringify(r));
  rec(`${W} : exemples chargés, facture de démonstration numérotée TEST`, r.devis > 0 && r.clients > 0 && /^TEST-/.test(r.num || ''), JSON.stringify(r));
  rec(`${W} : facture d'un particulier sans mode de conclusion bloquée`, r.partBloque === true, JSON.stringify(r));
  rec(`${W} : aucune erreur dans la page`, !errs.length, errs.join(' | '));
  rec(`${W} : requêtes externes limitées aux polices et au graphique (simulé)`, ext.every((h) => /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/.test(h)), [...new Set(ext)].join(', '));
  if (vp.width === 400) rec(`${W} : pas de défilement horizontal`, !r.hscroll, JSON.stringify(r));
  await ctx.close();
}
await b.close(); srv.close();
fs.writeFileSync(out('resApercu.json'), JSON.stringify(R, null, 1));
R.forEach((x) => console.log(x.ok.padEnd(5), '[Aperçu]', x.name, x.ok === 'PASS' ? '' : '— ' + x.detail));
if (R.some((x) => x.ok !== 'PASS')) process.exitCode = 1;
