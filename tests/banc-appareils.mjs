// Banc d'essai « deux appareils » : un PC (1300 px) et un iPhone 13, branchés sur UN serveur commun simulé côté Node.
// - Le client Supabase de l'appli est remplacé AVANT son chargement (window.supabase.createClient) : l'appli suit son
//   vrai chemin de démarrage (initCloud → getSession → afterLogin → pullState), y compris après ses rechargements de page,
//   et la connexion d'un nouvel appareil passe par le vrai écran de connexion.
// - État synchronisé : même règle que cp_state_push (écriture conditionnelle sur la dernière version connue, sinon refus
//   + renvoi de l'état du serveur → fusion 3 voies par le vrai code de l'appli : pushState / pullState / cpMerge).
// - Registre des factures : mêmes règles que cp_emettre_document & co (tests/serveur-simule.mjs), mais PARTAGÉ :
//   la numérotation est commune aux deux appareils, comme sur le vrai serveur.
// - Coupure réseau par appareil (navigator.onLine + appels refusés), délai réseau réglable, sortie / retour sur l'appli
//   (événement visibilitychange, comme sur un téléphone), dialogues répondus comme un utilisateur.
// Aucune donnée réelle : compte, entreprise et clients fictifs. Aucun accès réseau (le navigateur est isolé).
import fs from 'fs';
import { lancerNavigateur, devices, URL_LOCALE, out } from './env.mjs';
import { sansBibliothequesCloud } from './lib.mjs';

const c = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
/* comme une colonne jsonb de PostgreSQL : l'ordre des clés d'un objet n'est pas gardé (clés triées par longueur, puis
   octet par octet) — l'appli reçoit donc ses objets dans un autre ordre que celui où elle les a écrits */
export function jsonb(v) {
  if (Array.isArray(v)) return v.map(jsonb);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b))).forEach((k) => { o[k] = jsonb(v[k]); }); return o; }
  return v;
}
export const COMPTE = { id: 'u-essai-gab', email: 'essai@exemple.invalid', mdp: 'mot-de-passe-essai' };

/* C1 (M3, 21/10/2026) — même règle que la migration 20261021180000_une_facture_par_source.sql : une seule facture F VIVANTE par
   source (payload.src : k, id, w) ; solde de devis cohérent avec l'acompte vivant (total − acompte ± 0,011) ; pas d'acompte après
   le solde. « Vivante » = aucun avoir total (payload.fac.total === true) ne porte son numéro dans payload.src.w. */
export function regleSource(docs, p) {
  const src = p.p_payload && p.p_payload.src;
  if (p.p_serie !== 'F' || !src || typeof src !== 'object' || !src.k) return null;
  const annulees = new Set(docs.filter((a) => a.serie === 'AV' && a.origine === 'emis' && a.payload && a.payload.fac && a.payload.fac.total === true).map((a) => String((a.payload.src || {}).w || '').split('|')[0]));
  const vivantes = (k, id, w) => docs.filter((d) => d.serie === 'F' && d.origine === 'emis' && d.request_id !== p.p_request_id && d.payload && d.payload.src && d.payload.src.k === k && String(d.payload.src.id || '') === String(id || '') && String(d.payload.src.w || '') === String(w || '') && !annulees.has(d.num));
  const meme = vivantes(src.k, src.id, src.w); if (meme.length) return { raison: 'deja_facture', doc: meme[meme.length - 1] };
  if (src.k === 'devis' && (src.w === 'acompte' || src.w === 'solde')) {
    const autre = vivantes('devis', src.id, src.w === 'solde' ? 'acompte' : 'solde');
    if (autre.length) {
      const ex = autre[autre.length - 1];
      if (src.w === 'acompte') return { raison: 'solde_deja_emis', doc: ex };
      const f = p.p_payload.fac || {}, tot = Number(f.total), m = Number(f.montant), ac = Number((ex.payload.fac || {}).montant);
      if (!isFinite(tot) || !isFinite(m) || !isFinite(ac) || Math.abs((tot - ac) - m) > 0.011) return { raison: 'acompte_ignore', doc: ex };
    }
  }
  return null;
}

/* ---------------- serveur commun ---------------- */
export function serveurCommun(debutISO) {
  const S = { etat: null, etatBloque: {}, n: 0, docs: [], seq: {}, events: [], coupe: {}, latence: {}, journal: [], enCours: {}, ecritures: 0, conflits: 0, historique: [] };
  const t0 = Date.parse(debutISO || '2027-09-15T06:30:00Z');
  const horodatage = () => new Date(t0 + ++S.n * 1000).toISOString();
  const pub = (d) => ({ id: d.id, request_id: d.request_id, serie: d.serie, annee: d.annee, numero: d.numero, num: d.num, type: d.type, origine: d.origine,
    date_doc: d.date_doc, payload: c(d.payload), payload_hash: 'h' + d.id, fichiers_hash: d.fichiers_hash || null, cree_le: d.cree_le });
  function rpc(dev, nom, p) {
    if (nom === 'cp_serveur_info') return { data: { documents: true, version: '1.10' } };
    if (nom === 'cp_state_push') {
      const ts = horodatage();
      if (S.etat && !p.p_force && p.p_expected !== S.etat.updated_at) { S.conflits++; return { data: { ok: false, updated_at: S.etat.updated_at, data: c(S.etat.data) } }; }
      S.etat = { data: jsonb(c(p.p_data)), updated_at: ts }; S.ecritures++;
      S.historique.push({ dev, ts, cles: Object.keys(p.p_data || {}).sort() });
      return { data: { ok: true, updated_at: ts } };
    }
    if (nom === 'cp_emettre_document') {
      if (!/^1\.(1\d|[2-9]\d)/.test(p.p_client_version || '')) return { error: { message: 'ClimPilot doit être mis à jour' } };
      const ex = S.docs.find((d) => d.request_id === p.p_request_id); if (ex) return { data: { ok: true, deja: true, doc: pub(ex) } };
      const refus = regleSource(S.docs, p); if (refus) return { data: { ok: false, raison: refus.raison, doc: pub(refus.doc) } };
      const an = +String(p.p_date).slice(0, 4), k = p.p_serie + '|' + an;
      const mx = Math.max(S.seq[k] || 0, ...S.docs.filter((d) => d.serie === p.p_serie && d.annee === an).map((d) => d.numero), p.p_min_numero || 0) + 1; S.seq[k] = mx;
      const d = { id: 'doc' + (S.docs.length + 1), request_id: p.p_request_id, serie: p.p_serie, annee: an, numero: mx, num: p.p_serie + '-' + an + '-' + String(mx).padStart(3, '0'),
        type: p.p_type, origine: 'emis', date_doc: p.p_date, payload: c(p.p_payload), cree_le: horodatage(), dev };
      S.docs.push(d); return { data: { ok: true, deja: false, doc: pub(d) } };
    }
    if (nom === 'cp_document_fichiers') {
      const d = S.docs.find((x) => x.id === p.p_id); if (!d) return { error: { message: 'introuvable' } };
      const h = String((p.p_html || '').length + (p.p_xml || '').length);
      if (d.fichiers_hash && d.fichiers_hash !== h) return { error: { message: 'déjà enregistrés' } };
      d.html = p.p_html; d.xml = p.p_xml; d.fichiers_hash = h; return { data: { ok: true } };
    }
    if (nom === 'cp_document_evenement') { if (!S.events.some((e) => e.rid === p.p_request_id)) S.events.push({ rid: p.p_request_id, doc: p.p_document_id, type: p.p_type, donnees: c(p.p_donnees) }); return { data: { ok: true } }; }
    if (nom === 'cp_importer_ancien') {
      const ex = S.docs.find((d) => d.request_id === p.p_request_id); if (ex) return { data: { ok: true, deja: true, doc: pub(ex) } };
      const m = /^(F|AV)-(\d{4})-(\d+)$/.exec(p.p_num || ''); if (!m) return { error: { message: 'numéro invalide' } };
      const d = { id: 'doc' + (S.docs.length + 1), request_id: p.p_request_id, serie: m[1], annee: +m[2], numero: +m[3], num: p.p_num, type: p.p_type, origine: 'reconstitue', date_doc: p.p_date, payload: c(p.p_payload), cree_le: horodatage() };
      S.docs.push(d); return { data: { ok: true, deja: false, doc: pub(d) } };
    }
    return { data: null };
  }
  function from(q) {
    const un = q.mode === 'maybeSingle' || q.mode === 'single';
    /* comme PostgREST : select('updated_at') ne rend que la date (vérification légère de l'appli), sinon données + date */
    if (q.t === 'climpilot_state') { if (q.sel === 'updated_at') S.verifs = (S.verifs || 0) + 1;
      return { data: un ? (S.etat ? (q.sel === 'updated_at' ? { updated_at: S.etat.updated_at } : { data: c(S.etat.data), updated_at: S.etat.updated_at }) : null) : [] }; }
    if (q.t === 'climpilot_documents') {
      let L = S.docs.slice(); (q.eq || []).forEach(([k, v]) => { L = L.filter((d) => String(d[k]) === String(v)); });
      if (q.lim) L = L.slice(0, q.lim);
      if (un) { const d = L[0]; return { data: d ? { html: d.html || null, xml: d.xml || null } : null }; }
      /* sélection d'un champ JSON (PostgREST : « alias:colonne->clé ») */
      const chemins = [...String(q.sel || '').matchAll(/(\w+):payload((?:->\w+)+)/g)];
      if (chemins.length) return { data: L.map((d) => { const o = pub(d); delete o.payload; chemins.forEach((m) => { let v = d.payload; m[2].split('->').filter(Boolean).forEach((k) => { v = v == null ? undefined : v[k]; }); o[m[1]] = v === undefined ? null : c(v); }); return o; }) };
      return { data: L.map(pub) };
    }
    return { data: un ? null : [] };
  }
  /* point d'entrée appelé par les pages (exposeFunction) */
  S.appel = async (dev, sorte, a, b) => {
    S.enCours[dev] = (S.enCours[dev] || 0) + 1;
    try {
      await new Promise((r) => setTimeout(r, S.latence[dev] == null ? 40 : S.latence[dev])); // un appel réseau n'est jamais instantané
      S.journal.push({ dev, sorte, nom: sorte === 'rpc' ? a : a && a.t, t: Date.now() });
      if (S.coupe[dev]) return { rejet: 'Failed to fetch' };
      /* état synchronisé momentanément injoignable pour cet appareil (le registre des factures, lui, répond) */
      if (S.etatBloque && S.etatBloque[dev] && ((sorte === 'rpc' && a === 'cp_state_push') || (sorte === 'from' && a && a.t === 'climpilot_state'))) return { rejet: 'Failed to fetch' };
      /* C1 (M3, 21/10/2026) : registre des factures ILLISIBLE pour cet appareil (lecture en erreur), le reste répond ;
         ou registre PENDU : la lecture ne revient pas tant que S.registrePendu[dev] est vrai (délai dépassé côté appli) */
      if (sorte === 'from' && a && a.t === 'climpilot_documents') {
        if (S.registreBloque && S.registreBloque[dev]) return { rejet: 'Failed to fetch' };
        while (S.registrePendu && S.registrePendu[dev]) await new Promise((r) => setTimeout(r, 50));
      }
      if (sorte === 'login') return a && a.email === COMPTE.email && a.password === COMPTE.mdp ? { ok: true } : { ok: false };
      return sorte === 'rpc' ? rpc(dev, a, b || {}) : from(a || {});
    } finally { S.enCours[dev]--; }
  };
  return S;
}

/* ---------------- faux client Supabase, posé avant le chargement de l'appli ---------------- */
function FAUX_CLIENT(arg) {
  const [DEV, U] = arg;
  const CLE = '__essai_session';
  const session = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; } };
  const appel = (s, a, b) => window.__srvCommun(DEV, s, a, b).then((r) => { if (r && r.rejet) throw new TypeError(r.rejet); return r; });
  function Q(t) { this.q = { t, eq: [], lim: null, sel: '*' }; }
  Q.prototype.select = function (x) { if (typeof x === 'string') this.q.sel = x; return this; };
  ['order', 'or', 'in', 'gte', 'lte', 'lt', 'gt', 'is', 'neq', 'range', 'update', 'insert', 'upsert', 'delete', 'match', 'filter', 'not', 'like', 'ilike'].forEach((m) => { Q.prototype[m] = function () { return this; }; });
  Q.prototype.eq = function (k, v) { this.q.eq.push([k, v]); return this; };
  Q.prototype.limit = function (n) { this.q.lim = n; return this; };
  Q.prototype.maybeSingle = function () { return appel('from', Object.assign({}, this.q, { mode: 'maybeSingle' })); };
  Q.prototype.single = function () { return appel('from', Object.assign({}, this.q, { mode: 'single' })); };
  Q.prototype.then = function (ok, ko) { return appel('from', Object.assign({}, this.q, { mode: 'list' })).then(ok, ko); };
  const client = {
    rpc: (n, p) => appel('rpc', n, p), from: (t) => new Q(t),
    auth: {
      getSession: () => Promise.resolve({ data: { session: session() } }),
      signInWithPassword: ({ email, password }) => appel('login', { email, password }).then((r) => {
        if (!r.ok) return { data: {}, error: { message: 'Invalid login credentials', status: 400 } };
        const s = { access_token: 'jeton-essai', user: { id: U.id, email: U.email } }; localStorage.setItem(CLE, JSON.stringify(s)); return { data: { session: s }, error: null };
      }, (e) => ({ data: {}, error: { message: 'Failed to fetch', status: 0 } })),
      signOut: () => { localStorage.removeItem(CLE); return Promise.resolve({}); },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  let fixe = client;
  try { Object.defineProperty(window, 'supabase', { configurable: true, get() { return { createClient: () => fixe }; }, set() {} }); } catch (e) {}
  /* visibilité contrôlable (sortie / retour sur l'appli) */
  try {
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get() { return window.__vis || 'visible'; } });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return (window.__vis || 'visible') !== 'visible'; } });
  } catch (e) {}
  /* l'appli se recharge après une fusion (nxStoreReload) : repère pour attendre la fin du rechargement */
  try { let f = null; Object.defineProperty(window, 'nxStoreReload', { configurable: true, get() { return f; }, set(g) { f = typeof g === 'function' ? function () { window.__rechargeEnCours = true; try { console.info('__RECHARGE__ ' + String(new Error().stack).split('\n').slice(2, 6).map((x) => x.trim().replace(/https?:\/\/[^/]+\//, '')).join(' < ')); } catch (e) {} return g.apply(this, arguments); } : g; } }); } catch (e) {}
  try { if (!localStorage.getItem('cpnext_home')) localStorage.setItem('cpnext_home', JSON.stringify({ adr: "1 Rue de l'Exemple 60000 Beauvais", lon: 2.0807, lat: 49.4295, source: 'manuel' })); } catch (e) {}
}

/* ---------------- un appareil ---------------- */
let NAV = null;
export async function fermerNavigateur() { if (NAV) { const n = await NAV; NAV = null; await n.close(); } }
export async function appareil(S, dev, opts = {}) {
  if (!NAV) NAV = lancerNavigateur();
  const navigateur = await NAV;
  const mobile = opts.mobile !== false;
  const ctx = await navigateur.newContext(mobile ? { ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Europe/Paris' }
    : { viewport: { width: 1300, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await sansBibliothequesCloud(ctx);
  const p = await ctx.newPage();
  const A = { dev, p, ctx, mobile, errs: [], dialogues: [], reponses: [], chargements: 0, derniereNav: 0, recharges: [] };
  p.on('pageerror', (e) => A.errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (/^__RECHARGE__/.test(m.text())) { A.recharges.push({ t: Date.now(), pourquoi: m.text().slice(13, 400) }); return; } });
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|Not allowed to launch|integrity/.test(m.text())) A.errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  p.on('load', () => { A.chargements++; });
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) A.derniereNav = Date.now(); });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: URL_LOCALE.replace(/\/$/, '') }); } catch (e) {}
  /* dialogues : réponse prévue (file d'attente) sinon OK / valeur proposée — comme un utilisateur qui valide */
  p.on('dialog', (d) => { const r = A.reponses.length ? A.reponses.shift() : null; A.dialogues.push({ type: d.type(), msg: d.message().slice(0, 300) });
    if (r === false) d.dismiss().catch(() => {}); else d.accept(d.type() === 'prompt' ? (r == null ? d.defaultValue() : String(r)) : undefined).catch(() => {}); });
  await p.route(/supabase/, (r) => r.abort());
  await p.route(/cdn\.jsdelivr\.net\/npm\/chart|\/vendor\/chart-/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=function(){return{destroy(){},update(){}}};' }));
  await p.route(/cdnjs|tesseract|unpkg/, (r) => r.abort());
  await p.route(/data\.geopf\.fr/, (r) => r.abort());
  /* modules lents (téléphone au premier chargement, réseau mobile) : chaque next-*.js arrive après un délai */
  if (opts.modulesLents) await p.route(/\/next-[a-z0-9-]+\.(js|css)(\?|$)/, async (r) => { await new Promise((x) => setTimeout(x, opts.modulesLents)); await r.continue(); });
  await p.exposeFunction('__srvCommun', (d, s, a, b2) => S.appel(d, s, a, b2));
  await p.addInitScript(FAUX_CLIENT, [dev, { id: COMPTE.id, email: COMPTE.email }]);
  if (opts.connecte) await p.addInitScript((u) => { if (!sessionStorage.getItem('__essai_deja')) { sessionStorage.setItem('__essai_deja', '1'); localStorage.setItem('__essai_session', JSON.stringify({ access_token: 'jeton-essai', user: u })); } }, { id: COMPTE.id, email: COMPTE.email });
  /* vérification de chaque minute (appareil resté ouvert) : coupée par défaut pour que les rechargements tombent aux moments
     voulus par l'essai ; { verifMinute: true } pour l'essayer (suite Q, parties 9 et 10) */
  if (!opts.verifMinute) await p.addInitScript(() => { window.__cpSansVerifMinute = true; });
  if (opts.horloge) await p.clock.install({ time: new Date(opts.horloge) });
  await p.goto(URL_LOCALE + 'index.html' + (opts.adresse || ''));
  if (opts.horloge) await p.clock.resume();
  await p.waitForTimeout(opts.attente || 2200);
  return A;
}
/* connexion par le vrai écran de connexion */
export async function seConnecter(S, A, mdp) {
  await A.p.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 });
  await A.p.fill('#logEmail', COMPTE.email); await A.p.fill('#logPass', mdp || COMPTE.mdp);
  await A.p.evaluate(() => doLogin());
  await A.p.waitForTimeout(300); await calme(S, A);
}

/* attendre que l'appareil ait fini de parler au serveur (synchro, émission) et d'éventuels rechargements */
export async function calme(S, A, max = 10000, opts = {}) {
  const fin = Date.now() + max; let tranquille = 0;
  while (Date.now() < fin) {
    let occupe = (S.enCours[A.dev] || 0) > 0;
    if (!occupe) occupe = Date.now() - (A.derniereNav || 0) < 900;
    if (!occupe) occupe = await A.p.evaluate(() => { try { return !!window.__rechargeEnCours || document.readyState !== 'complete' || !!_cpPushing || !(window.nxStore && nxStore.ready); } catch (e) { return true; } }).catch(() => true);
    /* envoi automatique en attente (4 s après une modification) : fait tout de suite, comme si les 4 s étaient passées,
       pour qu'aucun rechargement ne tombe plus tard au milieu de l'action suivante */
    if (!occupe && !opts.garderEnAttente && !S.coupe[A.dev] && !(S.etatBloque && S.etatBloque[A.dev])) occupe = await A.p.evaluate(() => { try { if (!localStorage.getItem('cp2_dirty') || !window.SESS || !navigator.onLine || _cpPendingReload) return false; clearTimeout(_pushT); pushState(); return true; } catch (e) { return false; } }).catch(() => false);
    tranquille = occupe ? 0 : tranquille + 1;
    if (tranquille >= 4) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}
/* avant une action : la synchro automatique en attente (envoi 4 s après une modification) est faite tout de suite, avec
   l'éventuel rechargement de l'appli qui suit une fusion — l'action ne tombe donc jamais au milieu d'un rechargement */
export async function pret(S, A) {
  for (let i = 0; i < 3; i++) {
    await calme(S, A);
    const sale = await A.p.evaluate(async () => { if (!localStorage.getItem('cp2_dirty') || !window.SESS || !navigator.onLine) return false; clearTimeout(_pushT); await pushState(); return true; }).catch(() => true);
    await A.p.waitForTimeout(sale ? 300 : 50); await calme(S, A);
    if (!sale) return;
  }
}
/* lecture tolérante à un rechargement de l'appli (relue après le rechargement) */
export async function lire(S, A, f, arg) {
  for (let i = 0; ; i++) {
    try { return await A.p.evaluate(f, arg); }
    catch (e) { if (i >= 3 || !/context was destroyed|is not defined|navigation/i.test(String(e && e.message))) throw e; await A.p.waitForTimeout(400); await calme(S, A); }
  }
}
/* sortir de l'appli (onglet caché / téléphone verrouillé) puis y revenir : vrais déclencheurs de la synchro */
/* un rechargement de l'appli peut tomber au milieu de l'action (mise à jour reçue) : l'action est rejouée une fois
   l'appareil calme (après un rechargement, l'appli repart « visible ») */
async function surPage(S, A, f) { for (let i = 0; ; i++) { try { return await A.p.evaluate(f); } catch (e) { if (i >= 3 || !/context was destroyed|navigation/i.test(String(e && e.message))) throw e; await A.p.waitForTimeout(400); await calme(S, A); } } }
export async function quitter(S, A) { await surPage(S, A, () => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }); await calme(S, A); }
export async function revenir(S, A) { await surPage(S, A, () => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await A.p.waitForTimeout(100); await calme(S, A); }
/* fermer puis rouvrir l'appli (rechargement complet, la session reste) */
export async function rouvrir(S, A) { await A.p.reload(); await A.p.waitForTimeout(1800); await calme(S, A); }
/* coupure réseau de l'appareil : navigator.onLine (événements offline/online) + appels au serveur refusés */
export async function couper(S, A) { S.coupe[A.dev] = true; await A.ctx.setOffline(true); }
export async function retablir(S, A) { S.coupe[A.dev] = false; await A.ctx.setOffline(false); await A.p.waitForTimeout(200); await calme(S, A); }
/* attente de la synchro automatique (envoi 4 s après une modification) */
export async function synchroAuto(S, A) { await A.p.waitForTimeout(4600); await calme(S, A); }

/* ---------------- captures + journal des étapes (pour le rapport de recette) ---------------- */
export function carnet(dossier) {
  const dir = out(dossier); fs.mkdirSync(dir, { recursive: true });
  const C = { dir, etapes: [], n: 0 };
  C.capture = async (A, nom, sel) => {
    const f = String(++C.n).padStart(3, '0') + '-' + A.dev + '-' + nom.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.png';
    try {
      if (sel) { const l = A.p.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 3000 }); await l.screenshot({ path: dir + '/' + f, timeout: 5000 }); }
      else await A.p.screenshot({ path: dir + '/' + f });
      return f;
    } catch (e) { return null; }
  };
  C.etape = (o) => { C.etapes.push(o); };
  C.ecrire = () => fs.writeFileSync(dir + '/etapes.json', JSON.stringify(C.etapes, null, 1));
  return C;
}
