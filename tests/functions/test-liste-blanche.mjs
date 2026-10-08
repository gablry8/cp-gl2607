// Test du contrôle d'accès des fonctions serveur « assistant » et « superpdp » (versions préparées 1.10,
// non déployées) : liste blanche lue dans la configuration serveur ALLOWED_USER_IDS, refus si elle manque.
// Aucun appel réseau : base et authentification simulées ; fetch est remplacé par un piège (tout appel est
// compté et fait échouer le test).
// Lancement : node tests/functions/test-liste-blanche.mjs   (Node ≥ 22.6 : --experimental-strip-types est ajouté automatiquement)
import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
if (!process.env.__LB_CHILD) {
  try { execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, __LB_CHILD: '1' } }); }
  catch (e) { process.exit(e.status || 1); }
  process.exit(0);
}
const ICI = path.dirname(fileURLToPath(import.meta.url));
const FN = path.join(ICI, '../../supabase/functions');
globalThis.__NO_SERVE = true;
globalThis.Deno = { env: { get: () => undefined } }; // pas de Deno.serve → la fonction ne démarre pas de serveur
const appelsReseau = [];
globalThis.fetch = async (u) => { appelsReseau.push(String(u)); throw new Error('appel réseau interdit dans ce test'); };

async function charger(nom) { // copie hors du dépôt, sans l'import npm: (non résolu par Node)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-' + nom + '-'));
  for (const f of fs.readdirSync(path.join(FN, nom)).filter((f) => f.endsWith('.ts')))
    fs.writeFileSync(path.join(tmp, f), fs.readFileSync(path.join(FN, nom, f), 'utf8').replace(/^import .*npm:@supabase.*$/m, ''));
  return import(path.join(tmp, 'index.ts'));
}
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function service(userId) {
  const lectures = [];
  const q = { select() { return q; }, eq() { return q; }, gte() { return Promise.resolve({ data: [], error: null }); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
  return { lectures, auth: { getUser: async (t) => (t === 'jeton-valide' && userId ? { data: { user: { id: userId } }, error: null } : { data: { user: null }, error: { message: 'jwt' } }) },
    from: (t) => { lectures.push('from:' + t); return q; }, rpc: (n) => { lectures.push('rpc:' + n); return Promise.resolve({ data: [], error: null }); } };
}
const env = (o) => (k) => o[k];
const req = (jeton, corps, methode = 'POST') =>
  new Request('http://x/', { method: methode, headers: { 'content-type': 'application/json', ...(jeton ? { authorization: 'Bearer ' + jeton } : {}) }, body: methode === 'POST' ? JSON.stringify(corps) : undefined });
const R = []; const rec = (g, n, ok, d) => R.push([ok ? 'PASS' : 'FAIL', g, n, ok ? '' : JSON.stringify(d)]);

// corpsAutorise / attendu : requête d'un utilisateur autorisé et réponse prévue juste après le contrôle d'accès (sans réseau)
const CAS = [
  ['assistant', { messages: [{ role: 'user', content: 'bonjour' }] }, (r) => r.st === 200 && r.j.erreur === 'cle_absente'],
  ['superpdp', { action: 'status' }, (r) => r.st === 200 && r.j.connecte === false], // étape suivante : lecture de la connexion à la plateforme (aucune ici)
];
for (const [nom, corps, attendu] of CAS) {
  const G = nom === 'assistant' ? 'Assistant' : 'SUPER PDP';
  const { handle, listeBlanche } = await charger(nom);
  const appel = async (sv, e, r) => { const rep = await handle(r, sv, e); let j = null; try { j = await rep.clone().json(); } catch (_) {} return { st: rep.status, j }; };
  const avant = appelsReseau.length;
  { const r = await appel(service(A), env({ ALLOWED_USER_IDS: A }), req(null, null, 'GET')); rec(G, 'Méthode autre que POST refusée (405)', r.st === 405, r); }
  { const sv = service(A); const r = await appel(sv, env({ ALLOWED_USER_IDS: A }), req(null, corps)); rec(G, 'Sans jeton : 401, aucune lecture de données', r.st === 401 && r.j.erreur === 'non_connecte' && !sv.lectures.length, r); }
  for (const [lib, cfg] of [['absente', {}], ['vide', { ALLOWED_USER_IDS: '' }], ['sans identifiant valide', { ALLOWED_USER_IDS: ' abc , ,123 ' }]]) {
    const sv = service(A); const r = await appel(sv, env({ ...cfg, ANTHROPIC_API_KEY: 'cle-factice' }), req('jeton-valide', corps));
    rec(G, `Configuration ${lib} : refus 503, aucune lecture de données`, r.st === 503 && r.j.erreur === 'config' && !sv.lectures.length, { r, l: sv.lectures });
  }
  { const sv = service(A); const r = await appel(sv, env({ ALLOWED_USER_IDS: B, ANTHROPIC_API_KEY: 'cle-factice' }), req('jeton-valide', corps));
    rec(G, 'Connecté mais absent de la liste : 403, aucune lecture', r.st === 403 && r.j.erreur === 'interdit' && !sv.lectures.length, r); }
  { const r = await appel(service(A), env({ ALLOWED_USER_IDS: ` ${B} , ${A.toUpperCase()} ` }), req('jeton-valide', corps));
    rec(G, 'Utilisateur de la liste (espaces, majuscules) : autorisé, passe à l’étape suivante', attendu(r), r); }
  rec(G, 'listeBlanche : identifiants valides seulement, en minuscules', JSON.stringify(listeBlanche(`${A}, x ,${B.toUpperCase()},`)) === JSON.stringify([A, B]) && listeBlanche(undefined).length === 0, listeBlanche(`${A}, x ,${B.toUpperCase()},`));
  { const src = fs.readFileSync(path.join(FN, nom, 'index.ts'), 'utf8');
    const uuids = src.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
    rec(G, 'Aucun identifiant écrit en dur dans la fonction', !uuids.length && !/ALLOWED_USERS\s*=\s*\[/.test(src), uuids.length); }
  rec(G, 'Aucun appel réseau', appelsReseau.length === avant, appelsReseau.slice(avant));
}

R.forEach((x) => console.log(x[0].padEnd(5), '[' + x[1] + ']', x[2], x[3] ? '— ' + x[3] : ''));
if (process.env.CP_TEST_OUT) { fs.mkdirSync(process.env.CP_TEST_OUT, { recursive: true }); fs.writeFileSync(path.join(process.env.CP_TEST_OUT, 'resFn-liste-blanche.json'), JSON.stringify(R.map(([ok, group, name, detail]) => ({ group, name, ok, detail })), null, 1)); }
if (R.some((x) => x[0] !== 'PASS')) process.exitCode = 1;
