// Page ClimPilot à HORLOGE FIGÉE et stockage vide (P0, T9) — commune au générateur et aux suites golden.
// Mêmes gardes que tests/lib.mjs (cloud coupé, bibliothèques embarquées remplacées, aucune requête externe), mais la date
// vue par l'appli est fixe : les numéros, échéances, taux datés et calculs ACRE ne bougent plus d'un jour à l'autre.
import { lancerNavigateur, URL_LOCALE, surveiller } from '../env.mjs';
import { sansBibliothequesCloud } from '../lib.mjs';
let b = null;
export async function pageFigee({ horloge, mobile = false, assujetti = false, init = null, routes404 = [], attendrePret = true } = {}) {
  if (!b) b = await lancerNavigateur();
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1300, height: 900 } });
  await sansBibliothequesCloud(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|integrity/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  p.on('dialog', (d) => d.accept().catch(() => {}));
  await p.route(/supabase/, (r) => r.abort());
  await p.route(/cdnjs|tesseract|unpkg|cdn\.jsdelivr|data\.geopf\.fr|fonts\.googleapis/, (r) => r.abort());
  for (const re of routes404) await p.route(re, (r) => r.fulfill({ status: 404, body: 'absent (test)' }));
  if (horloge) await p.clock.setFixedTime(new Date(horloge));
  if (assujetti) await p.addInitScript(() => { try { localStorage.setItem('cp2_params_over', JSON.stringify({ regimeTVA: 'assujetti', tva: 20 })); } catch (e) {} });
  if (init) await p.addInitScript(init);
  await p.goto(URL_LOCALE + 'index.html');
  if (attendrePret) { await p.waitForFunction(() => window.nxStore && nxStore.ready && typeof window.NXD2 === 'object' && typeof window.compute === 'function', null, { timeout: 30000 }); await p.waitForTimeout(600); }
  return { p, ctx, errs };
}
export async function fermer() { if (b) { await b.close(); b = null; } }
