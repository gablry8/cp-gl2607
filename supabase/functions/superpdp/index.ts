// ClimPilot — Edge Function « superpdp »
// Pont entre ClimPilot et la plateforme agréée SUPER PDP (API v1.beta).
// - Identifiants OAuth (client_credentials) chiffrés dans Supabase Vault : jamais renvoyés à l'appli.
// - JWT ClimPilot obligatoire + liste blanche (un seul utilisateur).
// - Actions : status, connect, disconnect, validate, send, invoice, events, list, download,
//   directory, test_invoice, set_vat_regime, event.
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = Deno.env.get('SUPERPDP_API') || 'https://api.superpdp.tech';
const ALLOWED_USERS = ['925080a9-1eaa-4fcf-9fa9-af6ffb214552']; // Gabriel
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Cred = { client_id: string; client_secret: string; env?: string };
const TOKENS = new Map<string, { token: string; exp: number }>();

async function fetchToken(c: Cred): Promise<{ token: string; exp: number }> {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: c.client_id, client_secret: c.client_secret });
  const r = await fetch(API + '/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(20000) });
  const t = await r.text();
  let o: any = {}; try { o = JSON.parse(t); } catch (_) { /* */ }
  if (!r.ok || !o.access_token) throw { status: r.status, message: o.error_description || o.message || o.error || ('connexion refusée (HTTP ' + r.status + ')') };
  return { token: o.access_token, exp: Date.now() + (Number(o.expires_in) || 3600) * 1000 - 30000 };
}
async function token(key: string, c: Cred, force = false): Promise<string> {
  const k = key + ':' + c.client_id;
  const hit = TOKENS.get(k);
  if (!force && hit && hit.exp > Date.now()) return hit.token;
  const t = await fetchToken(c); TOKENS.set(k, t); return t.token;
}

/* appel API avec renouvellement automatique du jeton sur 401 */
async function call(key: string, c: Cred, method: string, path: string, opt: { query?: Record<string, unknown>; json?: unknown; raw?: string; rawType?: string; form?: FormData; binary?: boolean } = {}): Promise<{ status: number; data: any; type: string; bytes?: Uint8Array }> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(opt.query || {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const url = API + '/v1.beta/' + path + (q.toString() ? '?' + q : '');
  for (let attempt = 0; attempt < 2; attempt++) {
    const tk = await token(key, c, attempt > 0);
    const headers: Record<string, string> = { Authorization: 'Bearer ' + tk, Accept: 'application/json' };
    let body: BodyInit | undefined;
    if (opt.form) body = opt.form;
    else if (opt.raw !== undefined) { body = opt.raw; headers['Content-Type'] = opt.rawType || 'application/xml'; }
    else if (opt.json !== undefined) { body = JSON.stringify(opt.json); headers['Content-Type'] = 'application/json'; }
    if (opt.binary) delete headers.Accept;
    const r = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(30000) });
    if (r.status === 401 && attempt === 0) continue;
    const type = r.headers.get('content-type') || '';
    if (opt.binary && r.ok) { const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, data: null, type, bytes: b }; }
    const txt = await r.text();
    let data: any = txt; if (/json/.test(type) || /^\s*[\[{]/.test(txt)) { try { data = JSON.parse(txt); } catch (_) { /* */ } }
    return { status: r.status, data, type };
  }
  return { status: 401, data: { message: 'jeton refusé' }, type: '' };
}
function errOf(res: { status: number; data: any }) {
  const d = res.data || {};
  const m = typeof d === 'string' ? d.slice(0, 600) : (d.message || d.error || JSON.stringify(d).slice(0, 600));
  return { erreur: 'api', status: res.status, code: d.code || null, message: m };
}
function b64(u: Uint8Array): string { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }

/* rapport de validation : chaque validateur (XSD, EN 16931, règles françaises) a ses « failures » et « messages » */
function summarizeReport(rep: any) {
  const first = (rep && Array.isArray(rep.data) ? rep.data[0] : rep) || {};
  const errs: any[] = [], warns: any[] = [];
  const isValid = first.is_valid === true || String(first.is_valid) === 'true';
  for (const sr of (first.subreports || [])) {
    const v = String(sr.validator || '');
    const items = ([] as any[]).concat(sr.failures || [], sr.messages || []).map((e: any) => typeof e === 'string' ? { message: e } : { message: e.message || e.raw || '', location: e.location || '' });
    for (const it of items) ((isValid && /WARNING/i.test(v)) ? warns : errs).push({ ...it, validator: v.split('/').pop() });
  }
  if (first.error) errs.push({ message: String(first.error) });
  return { is_valid: isValid, format: first.format || null, profil: first.conformance_level || null, erreurs: errs.slice(0, 40), avertissements: warns.slice(0, 40) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'methode' }, 405);
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: ud, error: ue } = await service.auth.getUser(jwt);
  const user = ud && ud.user;
  if (ue || !user) return json({ erreur: 'non_connecte', message: 'Connecte-toi à ClimPilot (cloud) pour utiliser la plateforme.' }, 401);
  if (!ALLOWED_USERS.includes(user.id)) return json({ erreur: 'interdit' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch (_) { return json({ erreur: 'requete' }, 400); }
  const action = String(body.action || '');

  try {
    /* ---------- connexion ---------- */
    if (action === 'status') {
      const { data } = await service.from('climpilot_pdp').select('client_id, env, company, updated_at').eq('user_id', user.id).maybeSingle();
      if (!data) return json({ connecte: false });
      return json({ connecte: true, env: data.env, company: data.company, client_id: String(data.client_id).slice(0, 6) + '…', depuis: data.updated_at });
    }
    if (action === 'connect') {
      const c: Cred = { client_id: String(body.client_id || '').trim(), client_secret: String(body.client_secret || '').trim() };
      if (c.client_id.length < 4 || c.client_secret.length < 8) return json({ erreur: 'saisie', message: 'Colle le client_id ET le client_secret fournis par SUPER PDP.' }, 400);
      try { await token(user.id, c, true); } catch (e: any) { return json({ erreur: 'identifiants', message: 'SUPER PDP refuse ces identifiants : ' + (e && e.message || 'erreur') }); }
      const me = await call(user.id, c, 'GET', 'companies/me');
      if (me.status >= 300) return json(errOf(me));
      const co = me.data || {};
      const company = { id: co.id, nom: co.formal_name || co.trade_name || '', siren: co.number || '', schema: co.number_scheme || '', env: co.env || '', adresse: co.address || '', cp: co.postcode || '', ville: co.city || '', regime_tva: co.vat_regime || '', tva_debits: !!co.has_vat_on_debits };
      const { error } = await service.rpc('pdp_cred_set', { p_user: user.id, p_client_id: c.client_id, p_secret: c.client_secret, p_env: company.env, p_company: company });
      if (error) return json({ erreur: 'stockage', message: 'Enregistrement des identifiants impossible : ' + error.message });
      return json({ connecte: true, env: company.env, company });
    }
    if (action === 'disconnect') {
      const { error } = await service.rpc('pdp_cred_delete', { p_user: user.id });
      for (const k of TOKENS.keys()) if (k.startsWith(user.id + ':')) TOKENS.delete(k);
      return json(error ? { erreur: 'stockage', message: error.message } : { connecte: false });
    }

    /* ---------- actions qui demandent des identifiants ---------- */
    const { data: cr, error: ce } = await service.rpc('pdp_cred_get', { p_user: user.id });
    const cred: Cred | null = Array.isArray(cr) && cr[0] ? cr[0] : null;
    if (ce || !cred) return json({ erreur: 'non_configure', message: 'Plateforme non connectée : Paramètres → Facture électronique → Connecter SUPER PDP.' });
    const K = user.id;

    if (action === 'validate') {
      const xml = String(body.xml || ''); if (xml.length < 200) return json({ erreur: 'saisie', message: 'Fichier vide' }, 400);
      const fd = new FormData(); fd.append('file', new Blob([xml], { type: 'application/xml' }), String(body.name || 'facture') + '.xml');
      const r = await call(K, cred, 'POST', 'validation_reports', { form: fd });
      if (r.status >= 300) return json(errOf(r));
      return json({ rapport: summarizeReport(r.data) });
    }
    if (action === 'send') {
      const xml = String(body.xml || ''); if (xml.length < 200) return json({ erreur: 'saisie', message: 'Fichier vide' }, 400);
      const r = await call(K, cred, 'POST', 'invoices', { raw: xml, rawType: 'application/xml', query: { external_id: String(body.external_id || '').slice(0, 64), processing_rule: body.processing_rule || undefined } });
      if (r.status >= 300) return json(errOf(r));
      const d = r.data || {};
      return json({ id: d.id, direction: d.direction, processing_rule: d.processing_rule, events: d.events || [], env: cred.env });
    }
    if (action === 'invoice') {
      const r = await call(K, cred, 'GET', 'invoices/' + encodeURIComponent(String(body.id)));
      if (r.status >= 300) return json(errOf(r));
      const d = r.data || {};
      return json({ id: d.id, direction: d.direction, external_id: d.external_id, processing_rule: d.processing_rule, events: d.events || [], en_invoice: body.full ? d.en_invoice : undefined });
    }
    if (action === 'events') {
      const r = await call(K, cred, 'GET', 'invoice_events', { query: { invoice_id: body.id, limit: 100 } });
      return r.status >= 300 ? json(errOf(r)) : json({ events: (r.data && r.data.data) || [] });
    }
    if (action === 'list') {
      const r = await call(K, cred, 'GET', 'invoices', { query: { direction: body.direction, limit: Math.min(100, Number(body.limit) || 50), starting_after_id: body.starting_after_id, order: body.order || undefined } });
      if (r.status >= 300) return json(errOf(r));
      const d = r.data || {};
      const items = (d.data || []).map((x: any) => { const e = x.en_invoice || {}; return { id: x.id, direction: x.direction, external_id: x.external_id, created_at: x.created_at, numero: e.number, date: e.issue_date, type: e.type_code, vendeur: (e.seller || {}).name, acheteur: (e.buyer || {}).name, total: (e.totals || {}).amount_due_for_payment ?? (e.totals || {}).total_with_vat ?? null, events: (x.events || []).map((v: any) => ({ code: v.status_code, texte: v.status_text, at: v.created_at })) }; });
      return json({ items, has_after: !!d.has_after });
    }
    if (action === 'download') {
      const r = await call(K, cred, 'GET', 'invoices/' + encodeURIComponent(String(body.id)) + '/download', { binary: true });
      if (r.status >= 300 || !r.bytes) return json(errOf(r));
      if (r.bytes.length > 6_000_000) return json({ erreur: 'taille', message: 'Fichier trop lourd' });
      return json({ type: r.type, base64: b64(r.bytes) });
    }
    if (action === 'directory') {
      const n = String(body.number || '').replace(/\D/g, ''); if (n.length !== 9 && n.length !== 14) return json({ erreur: 'saisie', message: 'SIREN (9 chiffres) ou SIRET (14 chiffres)' }, 400);
      const [co, en] = await Promise.all([
        call(K, cred, 'GET', 'french_directory/companies', { query: { number: n, limit: 5 } }),
        call(K, cred, 'GET', 'french_directory/entries', { query: { number: n } }),
      ]);
      return json({ entreprises: co.status < 300 ? ((co.data && co.data.data) || []) : [], entrees: en.status < 300 ? ((en.data && en.data.data) || []) : [], erreur_annuaire: en.status >= 300 ? errOf(en).message : null });
    }
    if (action === 'test_invoice') {
      const r = await call(K, cred, 'GET', 'invoices/generate_test_invoice', { query: { format: body.format || 'cii', b2c: body.b2c ? 'true' : undefined } });
      return r.status >= 300 ? json(errOf(r)) : json({ contenu: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) });
    }
    if (action === 'set_vat_regime') {
      const r = await call(K, cred, 'PATCH', 'companies', { json: { vat_regime: body.vat_regime, has_vat_on_debits: !!body.has_vat_on_debits } });
      return r.status >= 300 ? json(errOf(r)) : json({ ok: true, company: r.data });
    }
    if (action === 'event') {
      const code = String(body.status_code || '');
      if (!/^fr:2(0[4-9]|1[0-2])$/.test(code)) return json({ erreur: 'saisie', message: 'Statut non autorisé' }, 400);
      const r = await call(K, cred, 'POST', 'invoice_events', { json: { invoice_id: Number(body.invoice_id), status_code: code, ...(body.reason ? { data: { reason: String(body.reason).slice(0, 300) } } : {}) } });
      return r.status >= 300 ? json(errOf(r)) : json({ ok: true, event: r.data });
    }
    return json({ erreur: 'action', message: 'Action inconnue : ' + action }, 400);
  } catch (e: any) {
    const msg = e && (e.message || e.name) || String(e);
    return json({ erreur: 'reseau', message: /timeout|abort/i.test(msg) ? 'SUPER PDP ne répond pas (délai dépassé) — réessaie dans un instant.' : ('Erreur : ' + msg) });
  }
});
