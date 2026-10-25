// Test de la fonction serveur « agenda » (20/10/2026, non déployée) avec une base simulée en mémoire.
// Lancement : node tests/functions/test-agenda.mjs   (Node ≥ 22.6 : --experimental-strip-types est ajouté automatiquement)
import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
if (!process.env.__AG_CHILD) { try { execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, __AG_CHILD: '1' } }); } catch (e) { process.exitCode = 1; } process.exit(); }
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/agenda/index.ts'), 'utf8').replace(/^import .*npm:@supabase.*$/m, '');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-')), 'index.ts'); fs.writeFileSync(tmp, src);
globalThis.__NO_SERVE = true;
const { handle, joursProposes, feries } = await import(tmp);

const OWNER = '00000000-0000-4000-8000-000000000001', CLE = 'cle-de-test-assez-longue-1234', SITE = 'https://www.exemple-site.fr';
const ENV = { owner: OWNER, cle: CLE, origins: [SITE], ferme: '' };
function base(rows = [], panne = false) {
  const T = { busy: rows.map((r) => ({ user_id: OWNER, ...r })), rpc: [] };
  const from = () => { const f = []; let lim = null;
    const run = () => { if (panne) return { data: null, error: { code: 'XX000', message: 'panne' } };
      let r = T.busy.filter((x) => f.every(([op, c, v]) => op === 'eq' ? x[c] === v : op === 'gte' ? x[c] >= v : x[c] <= v));
      r = [...r].sort((a, b) => a.jour < b.jour ? -1 : 1); if (lim) r = r.slice(0, lim);
      return { data: r.map(({ jour, matin, apresmidi }) => ({ jour, matin, apresmidi })), error: null }; };
    const q = { select() { return q; }, eq(c, v) { f.push(['eq', c, v]); return q; }, gte(c, v) { f.push(['gte', c, v]); return q; }, lte(c, v) { f.push(['lte', c, v]); return q; },
      order() { return q; }, limit(n) { lim = n; return q; }, then(ok, ko) { return Promise.resolve(run()).then(ok, ko); } };
    return q; };
  const rpc = async (nom, args) => { T.rpc.push({ nom, args }); if (panne) return { data: null, error: { code: 'XX000' } };
    T.busy = T.busy.filter((x) => !(x.source === args.p_source && x.jour >= args.p_du && x.jour <= args.p_au));
    args.p_jours.forEach((j) => T.busy.push({ user_id: args.p_user, source: args.p_source, ...j })); return { data: args.p_jours.length, error: null }; };
  return { T, db: { from, rpc } };
}
const NOW = new Date('2026-12-21T08:00:00Z'); // lundi 21/12/2026 à Paris
const get = (q, h = {}) => new Request('https://fn.exemple/agenda?' + q, { headers: h });
const post = (o, h = {}) => new Request('https://fn.exemple/agenda', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: typeof o === 'string' ? o : JSON.stringify(o) });
const R = []; const rec = (n, ok, d) => R.push([ok === true ? 'PASS' : 'FAIL', n, ok === true ? '' : JSON.stringify(d)]);

{ // jours proposés : J+2, sans week-end ni férié
  const j = joursProposes('2026-12-21');
  rec('Créneaux : 10 jours ouvrés à partir de J+2, sans Noël ni jour de l’an', j.length === 10 && j[0] === '2026-12-23' && !j.includes('2026-12-25') && !j.includes('2027-01-01') && j.every((d) => ![0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay())), j);
  const f = feries(2027);
  rec('Fériés 2027 : lundi de Pâques 29/03, Ascension 06/05, Pentecôte 17/05', f.has('2027-03-29') && f.has('2027-05-06') && f.has('2027-05-17'), [...f]);
  const jf = joursProposes('2026-12-21', '2026-12-28..2026-12-31');
  rec('Fermeture déclarée (AGENDA_FERME) : jours retirés', !jf.some((d) => d >= '2026-12-28' && d <= '2026-12-31'), jf);
}
{ // créneaux : ce qui est pris (appli ou Google) n'est pas proposé
  const { db } = base([{ source: 'climpilot', jour: '2026-12-23', matin: true, apresmidi: false }, { source: 'google', jour: '2026-12-23', matin: false, apresmidi: true }, { source: 'google', jour: '2026-12-24', matin: true, apresmidi: false }]);
  const res = await handle(get('creneaux=1', { origin: SITE }), db, ENV, NOW); const b = await res.json();
  const j23 = b.jours.find((x) => x.date === '2026-12-23'), j24 = b.jours.find((x) => x.date === '2026-12-24'), j28 = b.jours.find((x) => x.date === '2026-12-28');
  rec('Créneaux : matin pris dans ClimPilot + après-midi pris dans Google = journée complète', res.status === 200 && b.ok && j23.matin === false && j23.apresmidi === false, b);
  rec('Créneaux : jour à moitié pris, jour libre', j24.matin === false && j24.apresmidi === true && j28.matin && j28.apresmidi, { j24, j28 });
  rec('Créneaux : format attendu par le site, aucune autre donnée', b.jours.every((x) => Object.keys(x).join() === 'date,matin,apresmidi'), b.jours[0]);
  rec('Créneaux : en-tête CORS pour le site, cache court', res.headers.get('access-control-allow-origin') === SITE && /max-age=60/.test(res.headers.get('cache-control')), Object.fromEntries(res.headers));
  const autre = await handle(get('creneaux=1', { origin: 'https://pirate.exemple' }), db, ENV, NOW);
  rec('Créneaux : autre site refusé (403, pas d’en-tête CORS)', autre.status === 403 && !autre.headers.get('access-control-allow-origin'), autre.status);
}
{ // panne de la base : le site sait qu'il doit se rabattre sur son calcul local
  const { db } = base([], true);
  const res = await handle(get('creneaux=1', { origin: SITE }), db, ENV, NOW);
  rec('Créneaux : base en panne → 503 {ok:false} (le site affiche « disponibilités non chargées »)', res.status === 503 && (await res.json()).ok === false, res.status);
  const s = await handle(get('sante=1'), db, ENV, NOW);
  rec('Santé : 503 si la base ne répond pas', s.status === 503, s.status);
}
{ // réglages manquants
  const { db } = base();
  const r1 = await handle(get('creneaux=1'), db, { ...ENV, cle: 'courte' }, NOW), r2 = await handle(get('creneaux=1'), db, { ...ENV, owner: '' }, NOW);
  rec('Réglages incomplets (clé trop courte, propriétaire absent) → 503 config', r1.status === 503 && r2.status === 503 && (await r1.json()).erreur === 'config', [r1.status, r2.status]);
}
{ // script Google : clé obligatoire
  const { T, db } = base();
  const sans = await handle(post({ du: '2026-12-21', au: '2026-12-31', jours: [] }), db, ENV, NOW);
  const fausse = await handle(post({ du: '2026-12-21', au: '2026-12-31', jours: [] }, { 'x-agenda-cle': CLE.replace(/.$/, 'x') }), db, ENV, NOW);
  const occ = await handle(get('occupations=1'), db, ENV, NOW);
  rec('Google : sans clé ou mauvaise clé → 401, rien écrit, occupations refusées', sans.status === 401 && fausse.status === 401 && occ.status === 401 && T.rpc.length === 0, [sans.status, fausse.status, occ.status]);
}
{ // script Google : envoi des demi-journées prises
  const { T, db } = base([{ source: 'google', jour: '2026-12-22', matin: true, apresmidi: true }, { source: 'climpilot', jour: '2026-12-22', matin: true, apresmidi: false }]);
  const res = await handle(post({ du: '2026-12-21', au: '2027-02-18', jours: [{ jour: '2026-12-29', matin: true, apresmidi: false, titre: 'Dentiste' }, { jour: '2026-12-30', matin: false, apresmidi: false }, { jour: '2027-05-01', matin: true }, { jour: 'n’importe quoi', matin: true }] }, { 'x-agenda-cle': CLE }), db, ENV, NOW);
  const b = await res.json(); const g = T.busy.filter((x) => x.source === 'google');
  rec('Google : fenêtre remplacée (ancien 22/12 retiré), seul le 29/12 matin gardé', res.status === 200 && b.ok && g.length === 1 && g[0].jour === '2026-12-29' && g[0].matin === true && g[0].apresmidi === false, { b, g });
  rec('Google : aucun titre d’événement transmis à la base', T.rpc.length === 1 && !JSON.stringify(T.rpc[0].args).includes('Dentiste'), T.rpc[0]);
  rec('Google : les demi-journées de l’appli ne sont pas touchées', T.busy.some((x) => x.source === 'climpilot' && x.jour === '2026-12-22'), T.busy);
  const occ = await handle(get('occupations=1', { 'x-agenda-cle': CLE }), db, ENV, NOW); const o = await occ.json();
  rec('Occupations : seulement celles de l’appli, sans nom', occ.status === 200 && o.jours.length === 1 && o.jours[0].jour === '2026-12-22' && Object.keys(o.jours[0]).join() === 'jour,matin,apresmidi', o);
}
{ // envois invalides
  const { T, db } = base(); const h = { 'x-agenda-cle': CLE };
  const r1 = await handle(post('{pas du json', h), db, ENV, NOW);
  const r2 = await handle(post({ du: '2026-12-21', au: '2027-06-30', jours: [] }, h), db, ENV, NOW);
  const r3 = await handle(post('x'.repeat(50000), h), db, ENV, NOW);
  const r4 = await handle(post({ du: '2025-01-01', au: '2025-02-01', jours: [] }, h), db, ENV, NOW);
  rec('Google : JSON invalide 400, fenêtre > 120 jours 400, trop gros 413, passé lointain 400 ; rien écrit', r1.status === 400 && r2.status === 400 && r3.status === 413 && r4.status === 400 && T.rpc.length === 0, [r1.status, r2.status, r3.status, r4.status]);
}
{ // panne pendant l'écriture
  const { db } = base([], true);
  const r = await handle(post({ du: '2026-12-21', au: '2026-12-31', jours: [{ jour: '2026-12-22', matin: true }] }, { 'x-agenda-cle': CLE }), db, ENV, NOW);
  rec('Google : panne de la base pendant l’envoi → 503 (le script réessaiera au prochain passage)', r.status === 503, r.status);
}
R.forEach((x) => console.log(x[0].padEnd(5), '[Agenda]', x[1], x[2] ? '— ' + x[2] : ''));
if (process.env.CP_TEST_OUT) { fs.mkdirSync(process.env.CP_TEST_OUT, { recursive: true }); fs.writeFileSync(path.join(process.env.CP_TEST_OUT, 'resFn-agenda.json'), JSON.stringify(R.map(([ok, name, detail]) => ({ group: 'Fonction agenda', name, ok, detail })), null, 1)); }
if (R.some((x) => x[0] !== 'PASS')) process.exitCode = 1;
