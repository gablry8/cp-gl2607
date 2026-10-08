// Test de l'envoi à la plateforme par la fonction serveur « superpdp » (version préparée 1.10, non déployée) — R2 :
// en PRODUCTION, la facture déposée vient du registre figé (climpilot_documents), jamais du XML de l'appareil.
// Aucun réseau : base, authentification et plateforme simulées (fetch remplacé et compté).
// Lancement : node tests/functions/test-superpdp-envoi.mjs   (Node ≥ 22.6)
import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
if (!process.env.__PDP_CHILD) {
  try { execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, __PDP_CHILD: '1' } }); }
  catch (e) { process.exit(e.status || 1); }
  process.exit(0);
}
const FN = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/superpdp');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-superpdp-'));
fs.writeFileSync(path.join(tmp, 'index.ts'), fs.readFileSync(path.join(FN, 'index.ts'), 'utf8').replace(/^import .*npm:@supabase.*$/m, ''));
globalThis.__NO_SERVE = true; globalThis.Deno = { env: { get: () => undefined } };
const postes = [];
globalThis.fetch = async (url, init = {}) => { const u = String(url);
  if (/\/oauth2\/token$/.test(u)) return new Response(JSON.stringify({ access_token: 'jeton', expires_in: 3600 }), { status: 200 });
  if (/\/v1\.beta\/invoices/.test(u) && init.method === 'POST') { postes.push({ url: u, body: String(init.body) }); return new Response(JSON.stringify({ id: 77, direction: 'out', events: [] }), { status: 201 }); }
  throw new Error('appel réseau inattendu : ' + u); };
const { handle } = await import(path.join(tmp, 'index.ts'));

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D1 = '11111111-1111-4111-8111-111111111111', D2 = '22222222-2222-4222-8222-222222222222', D3 = '33333333-3333-4333-8333-333333333333', D4 = '44444444-4444-4444-8444-444444444444';
const XML_REG = '<rsm:CrossIndustryInvoice>' + 'R'.repeat(300) + 'FACTURE DU REGISTRE</rsm:CrossIndustryInvoice>';
const XML_APP = '<rsm:CrossIndustryInvoice>' + 'A'.repeat(300) + 'XML DE L APPAREIL</rsm:CrossIndustryInvoice>';
const DOCS = [
  { id: D1, user_id: A, num: 'F-2026-001', origine: 'emis', xml: XML_REG },
  { id: D2, user_id: B, num: 'F-2026-009', origine: 'emis', xml: XML_REG },        /* document d'un autre compte */
  { id: D3, user_id: A, num: 'F-2025-004', origine: 'reconstitue', xml: null },    /* ancienne facture importée */
  { id: D4, user_id: A, num: 'F-2026-002', origine: 'emis', xml: null },           /* XML pas encore déposé */
];
function service(env) {
  return { auth: { getUser: async () => ({ data: { user: { id: A } }, error: null }) },
    rpc: async (n) => (n === 'pdp_cred_get' ? { data: [{ client_id: 'c', client_secret: 's', env }], error: null } : { data: null, error: null }),
    from: (t) => { const f = []; const q = { select() { return q; }, eq(c, v) { f.push([c, v]); return q; },
      maybeSingle() { const d = t === 'climpilot_documents' ? DOCS.find((x) => f.every(([c, v]) => x[c] === v)) : null; return Promise.resolve({ data: d || null, error: null }); } }; return q; } };
}
const env = (k) => ({ ALLOWED_USER_IDS: A }[k]);
const envoyer = async (e, corps) => { const n0 = postes.length; const rep = await handle(new Request('http://x/', { method: 'POST', headers: { authorization: 'Bearer jeton-valide', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send', ...corps }) }), service(e), env);
  return { st: rep.status, j: await rep.json(), poste: postes.slice(n0) }; };
const R = []; const rec = (n, ok, d) => R.push([ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(d).slice(0, 400)]);

{ const r = await envoyer('production', { document_id: D1, xml: XML_APP, external_id: 'AUTRE-NUM' });
  rec('Production : la facture déposée est celle du registre, pas le XML envoyé par l\'appareil', r.st === 200 && r.poste.length === 1 && /FACTURE DU REGISTRE/.test(r.poste[0].body) && !/XML DE L APPAREIL/.test(r.poste[0].body), r);
  rec('Production : référence = numéro du registre (pas celle fournie par l\'appareil)', r.poste[0] && /external_id=F-2026-001/.test(r.poste[0].url) && !/AUTRE-NUM/.test(r.poste[0].url), r.poste); }
{ const r = await envoyer('production', { xml: XML_APP, external_id: 'F-2026-001' });
  rec('Production sans identifiant de document : refus, rien déposé', r.st === 400 && r.j.erreur === 'registre' && !r.poste.length, r); }
{ const r = await envoyer('production', { document_id: D2 });
  rec('Production : document d\'un autre compte introuvable, rien déposé', r.st === 404 && !r.poste.length, r); }
{ const r = await envoyer('production', { document_id: D3 });
  rec('Production : ancienne facture reconstituée refusée (pas de version figée)', r.st === 409 && r.j.erreur === 'registre' && !r.poste.length, r); }
{ const r = await envoyer('production', { document_id: D4 });
  rec('Production : XML pas encore enregistré → refus clair, rien déposé', r.st === 409 && r.j.erreur === 'fichiers' && !r.poste.length, r); }
{ const r = await envoyer('sandbox', { xml: XML_APP, external_id: 'F-2026-001-TEST1' });
  rec('Bac à sable : XML de test de l\'appareil accepté (comme avant)', r.st === 200 && r.poste.length === 1 && /XML DE L APPAREIL/.test(r.poste[0].body) && /external_id=F-2026-001-TEST1/.test(r.poste[0].url), r); }

R.forEach((x) => console.log(x[0].padEnd(5), '[SUPER PDP envoi]', x[1], x[2] ? '— ' + x[2] : ''));
if (process.env.CP_TEST_OUT) { fs.mkdirSync(process.env.CP_TEST_OUT, { recursive: true }); fs.writeFileSync(path.join(process.env.CP_TEST_OUT, 'resFn-superpdp-envoi.json'), JSON.stringify(R.map(([ok, name, detail]) => ({ group: 'SUPER PDP envoi', name, ok, detail })), null, 1)); }
if (R.some((x) => x[0] !== 'PASS')) process.exitCode = 1;
