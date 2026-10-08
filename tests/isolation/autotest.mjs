// Autotest de l'isolation réseau, lancé en premier par tests/run-all.sh (serveur local :8765 déjà démarré).
// Vérifie que le blocage FONCTIONNE (et pas seulement qu'il est configuré), processus par processus :
//  - contrôle positif : la boucle locale répond (sinon un « blocage » ne prouverait rien) ;
//  - Node, Python, navigateur (page, WebSocket, service worker) : chaque tentative vers Supabase, la plateforme
//    SUPER PDP ou une adresse IP brute échoue ET laisse une trace dans le journal d'isolation ;
//  - couche noyau (si CP_DANS_NETNS=1) : gardes désactivées, une connexion brute échoue encore ;
//  - le service worker de l'appli s'installe et met l'appli en cache : ses tests restent possibles.
// Adresses utilisées : noms inventés sous supabase.co / superpdp.tech et 192.0.2.1 (réseau de documentation
// RFC 5737, jamais attribué) — même sans isolation, aucune vraie machine ne serait contactée.
import fs from 'fs'; import net from 'net'; import dns from 'dns'; import path from 'path'; import { execFileSync, spawnSync } from 'child_process';
import { out, lancerNavigateur, URL_LOCALE, PLAYWRIGHT_CHEMIN } from '../env.mjs';

const R = []; const rec = (name, ok, detail) => R.push({ group: 'Isolation', name, ok: ok === true ? 'PASS' : ok === false ? 'FAIL' : ok, detail: detail == null ? '' : String(detail).slice(0, 400) });
const lignes = (canal) => { try { return fs.readFileSync(out('isolation', canal + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_) { return []; } };
const SUPA = 'autotest-isolation.supabase.co', PDP = 'autotest-isolation.superpdp.tech', IP = '192.0.2.1';
const NETNS = process.env.CP_DANS_NETNS === '1';
const echec = (p) => p.then(() => false, (e) => String(e && (e.cause?.message || e.message) || e));

/* 1. interfaces visibles */
// /proc/self/net/dev reflète l'espace réseau du processus (/sys/class/net, lui, peut montrer celui de la machine)
const ifs = fs.readFileSync('/proc/self/net/dev', 'utf8').split('\n').slice(2).map((l) => l.split(':')[0].trim()).filter(Boolean).sort();
rec('Couche noyau : seule la boucle locale existe (unshare -n)', NETNS ? (ifs.length === 1 && ifs[0] === 'lo') : 'SKIP', NETNS ? ifs.join(' ') : 'isolation noyau absente (CP_SANS_NETNS=1) — seules les gardes logicielles s\'appliquent');

/* 2. Node */
rec('Node : garde chargée (NODE_OPTIONS)', globalThis.__CP_GARDE_NODE === true, process.env.NODE_OPTIONS || '');
{ const r = await fetch(URL_LOCALE + 'index.html').then((x) => x.status, (e) => String(e)); rec('Node : contrôle positif, le serveur local répond', r === 200, r); }
{ const n0 = lignes('node').length;
  const a = await echec(fetch(`https://${SUPA}/rest/v1/climpilot_state`));
  const b = await echec(fetch(`https://${PDP}/v1.beta/invoices`));
  const c = await new Promise((ok) => { const s = net.connect(443, IP); s.on('connect', () => { s.destroy(); ok(false); }); s.on('error', (e) => ok(e.message)); });
  const d = await new Promise((ok) => dns.lookup(SUPA, (e) => ok(e ? e.message : false)));
  const tous = [a, b, c, d].every((x) => x && /CP_ISOLATION/.test(x));
  const n1 = lignes('node').length;
  rec('Node : Supabase, SUPER PDP, IP brute et DNS refusés par la garde', tous, JSON.stringify([a, b, c, d]));
  rec('Node : chaque tentative est notée (journal node.jsonl)', n1 - n0 >= 4, `${n1 - n0} ligne(s)`); }

/* 3. Python */
{ const n0 = lignes('python').length;
  const code = `
import socket, urllib.request, os
print('garde', os.environ.get('CP_GARDE_PYTHON_ACTIVE'))
print('local', urllib.request.urlopen('${URL_LOCALE}index.html', timeout=5).status)
for cible in [('${SUPA}', 443), ('${PDP}', 443), ('${IP}', 443)]:
    try:
        socket.create_connection(cible, timeout=5); print('OUVERT', cible)
    except Exception as e:
        print('refus', 'CP_ISOLATION' in str(e))
`;
  const r = spawnSync('python3', ['-c', code], { encoding: 'utf8', env: process.env });
  const o = r.stdout || '';
  rec('Python : garde chargée (sitecustomize)', /garde 1/.test(o), o + r.stderr);
  rec('Python : contrôle positif, le serveur local répond', /local 200/.test(o), o);
  rec('Python : Supabase, SUPER PDP et IP brute refusés par la garde', (o.match(/refus True/g) || []).length === 3 && !/OUVERT/.test(o), o);
  rec('Python : chaque tentative est notée (journal python.jsonl)', lignes('python').length - n0 >= 3, `${lignes('python').length - n0} ligne(s)`); }

/* 4. couche noyau seule : gardes désactivées */
if (NETNS) {
  const envSans = { ...process.env, NODE_OPTIONS: '', CP_GARDE_RESEAU: '0', PYTHONPATH: '' };
  const n = spawnSync(process.execPath, ['-e', `const s=require('net').connect(443,'${IP}');s.setTimeout(4000,()=>{console.log('delai');process.exit(0)});s.on('connect',()=>{console.log('OUVERT');process.exit(0)});s.on('error',e=>{console.log(e.code);process.exit(0)})`], { encoding: 'utf8', env: envSans });
  const p = spawnSync('python3', ['-c', `import socket\ntry:\n    socket.create_connection(('${IP}',443),timeout=4); print('OUVERT')\nexcept OSError as e: print(type(e).__name__, e.errno)`], { encoding: 'utf8', env: envSans });
  const dnsN = spawnSync(process.execPath, ['-e', `require('dns').lookup('${SUPA}',e=>console.log(e?e.code:'RESOLU'))`], { encoding: 'utf8', env: envSans });
  rec('Couche noyau : sans aucune garde, Node ne peut pas sortir', /ENETUNREACH|EHOSTUNREACH|ECONNREFUSED/.test(n.stdout) && !/OUVERT/.test(n.stdout), n.stdout + n.stderr);
  rec('Couche noyau : sans aucune garde, Python ne peut pas sortir', /OSError|Unreachable|Refused/.test(p.stdout) && !/OUVERT/.test(p.stdout), p.stdout + p.stderr);
  rec('Couche noyau : sans aucune garde, aucun nom ne se résout', !/RESOLU/.test(dnsN.stdout), dnsN.stdout + dnsN.stderr);
} else rec('Couche noyau : connexions brutes sans garde', 'SKIP', 'non tenté hors espace réseau isolé');

/* 5. navigateur */
const b = await lancerNavigateur(); const VERSION_CHROMIUM = b.version();
rec('Navigateur : Chromium ' + VERSION_CHROMIUM + ' lancé avec le mandataire « refus »', true, PLAYWRIGHT_CHEMIN);
{ const m0 = lignes('navigateur-mandataire').length, q0 = lignes('navigateur-requetes').length;
  const ctx = await b.newContext(); const p = await ctx.newPage();
  const rep = await p.goto(URL_LOCALE + 'tests/isolation/autotest.html');
  rec('Navigateur : contrôle positif, page locale chargée', rep && rep.status() === 200, rep && rep.status());
  const r = await p.evaluate(async ({ SUPA, PDP, IP }) => {
    // refus = la requête échoue, ou c'est le mandataire « refus » qui répond (HTTP en clair : 403 + x-cp-isolation)
    const essai = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.status === 403 && r.headers.get('x-cp-isolation') === 'refus' ? 'refus' : 'OUVERT ' + r.status), () => 'refus');
    const ws = (u) => new Promise((ok) => { const s = new WebSocket(u); const t = setTimeout(() => ok('delai'), 8000); s.onopen = () => { clearTimeout(t); ok('OUVERT'); }; s.onerror = () => { clearTimeout(t); ok('refus'); }; });
    const o = { supa: await essai(`https://${SUPA}/rest/v1/x`), pdp: await essai(`https://${PDP}/v1.beta/x`), ip: await essai(`https://${IP}/`), ipHttp: await essai(`http://${IP}/`), ws: await ws(`wss://${SUPA}/realtime/v1/websocket`) };
    const reg = await navigator.serviceWorker.register('sw-autotest.js'); await navigator.serviceWorker.ready;
    const sw = reg.active || reg.waiting || reg.installing;
    o.sw = await new Promise((ok) => { navigator.serviceWorker.addEventListener('message', (e) => ok(e.data), { once: true }); sw.postMessage({ url: `https://${SUPA}/rest/v1/depuis-le-sw` }); setTimeout(() => ok('delai'), 10000); });
    await reg.unregister(); return o;
  }, { SUPA, PDP, IP });
  rec('Navigateur : fetch vers Supabase, SUPER PDP, IP brute (https et http) refusés', ['supa', 'pdp', 'ip', 'ipHttp'].every((k) => r[k] === 'refus'), JSON.stringify(r));
  rec('Navigateur : WebSocket (wss) vers Supabase refusé', r.ws === 'refus', r.ws);
  rec('Navigateur : requête partie d\'un service worker refusée', r.sw && r.sw.ok === false, JSON.stringify(r.sw));
  await p.waitForTimeout(300);
  const m = lignes('navigateur-mandataire').slice(m0), hotes = m.map((x) => x.hote);
  rec('Navigateur : tentatives arrivées au réseau, notées puis refusées par le mandataire', [SUPA + ':443', PDP + ':443', IP + ':443'].every((h) => hotes.includes(h)) && hotes.some((h) => h.startsWith(IP) && !h.endsWith(':443')), [...new Set(hotes)].join(', '));
  rec('Navigateur : tentatives vues par Playwright (journal navigateur-requetes)', lignes('navigateur-requetes').length - q0 >= 4, `${lignes('navigateur-requetes').length - q0} ligne(s), dont service worker : ${lignes('navigateur-requetes').slice(q0).filter((x) => x.sw).length}`);
  await ctx.close(); }
/* 6. le service worker de l'appli fonctionne hors réseau (ses tests restent possibles) */
{ const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.route(/supabase|cdn\.|cdnjs|unpkg|tesseract|fonts\.|geopf/, (r) => r.abort());
  await p.goto(URL_LOCALE + 'index.html');
  const r = await p.evaluate(async () => { const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((ok) => setTimeout(() => ok(null), 15000))]);
    if (!reg) return { actif: false }; await new Promise((ok) => setTimeout(ok, 1500));
    const ks = await caches.keys(); const c = ks.length ? await caches.open(ks[0]) : null; const n = c ? (await c.keys()).length : 0; return { actif: !!reg.active, caches: ks, n }; });
  rec('Service worker de l\'appli : installé et cache rempli depuis le serveur local', r.actif && r.n >= 40, JSON.stringify(r));
  await ctx.close(); }
await b.close();

fs.writeFileSync(out('resIsolation.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(out('isolation', 'versions-navigateur.json'), JSON.stringify({ playwright: PLAYWRIGHT_CHEMIN, chromium: VERSION_CHROMIUM }));
R.forEach((x) => console.log(x.ok.padEnd(5), '[Isolation]', x.name, x.ok === 'PASS' ? '' : '— ' + x.detail));
if (R.some((x) => x.ok === 'FAIL')) process.exitCode = 1;
