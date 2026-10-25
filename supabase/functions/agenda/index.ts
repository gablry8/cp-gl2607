// ClimPilot — Edge Function « agenda » (20/10/2026, PRÉPARÉE, NON DÉPLOYÉE ; verify_jwt = false)
// Objectif : ne jamais avoir deux clients au même moment. Aucune donnée client ne passe ici :
// seulement des dates et deux cases (matin, après-midi).
//
//   GET  ?creneaux=1     public (site) : les 10 prochains jours ouvrés à partir de J+2, avec matin / après-midi libres.
//                        Réponse : {"ok":true,"jours":[{"date":"AAAA-MM-JJ","matin":true,"apresmidi":false}]}
//   POST                 script Google Agenda (en-tête x-agenda-cle) : {"du","au","jours":[{"jour","matin","apresmidi"}]}
//                        remplace les demi-journées « google » de la fenêtre.
//   GET  ?occupations=1  script Google Agenda (x-agenda-cle) : demi-journées prises dans ClimPilot (60 jours),
//                        pour les recopier dans l'agenda « ClimPilot » de Google.
//   GET  ?sante=1        état : 200 si la base répond et que les réglages sont là, 503 sinon.
// Secrets : OWNER_USER_ID, AGENDA_CLE (au moins 24 caractères), SITE_ORIGINS (adresses du site, séparées par des virgules),
//           AGENDA_FERME (facultatif : jours fermés « AAAA-MM-JJ » ou « AAAA-MM-JJ..AAAA-MM-JJ », séparés par des virgules).
import { createClient } from 'npm:@supabase/supabase-js@2';

type Env = { owner?: string; cle?: string; origins?: string[]; ferme?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 40000;

const pad = (n: number) => String(n).padStart(2, '0');
const isoUTC = (d: Date) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoUTC(d); };
// date du jour à Paris (la fonction tourne en UTC)
export const parisToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// Jours fériés : fixes + lundi de Pâques, Ascension, lundi de Pentecôte (mêmes règles que le site)
export function feries(y: number): Set<string> {
  const s = new Set(['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map((md) => y + '-' + md));
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = y + '-' + pad(mo) + '-' + pad(da);
  [1, 39, 50].forEach((n) => s.add(addDays(paques, n)));
  return s;
}
export function fermes(txt = ''): Set<string> {
  const s = new Set<string>();
  for (const part of String(txt).split(',').map((x) => x.trim()).filter(Boolean)) {
    const [a, b] = part.split('..');
    if (!ISO.test(a) || (b && !ISO.test(b))) continue;
    let x = a; let guard = 0;
    while (x <= (b || a) && guard++ < 400) { s.add(x); x = addDays(x, 1); }
  }
  return s;
}
// les 10 jours ouvrés proposés (à partir de J+2, comme le site)
export function joursProposes(today: string, ferme = '', n = 10): string[] {
  const off = new Set<string>([...feries(+today.slice(0, 4)), ...feries(+today.slice(0, 4) + 1), ...fermes(ferme)]);
  const out: string[] = []; let x = addDays(today, 2); let guard = 0;
  while (out.length < n && guard++ < 120) {
    const wd = new Date(x + 'T12:00:00Z').getUTCDay();
    if (wd !== 0 && wd !== 6 && !off.has(x)) out.push(x);
    x = addDays(x, 1);
  }
  return out;
}
// comparaison en temps constant (la clé ne se devine pas caractère par caractère)
function memeCle(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function handle(req: Request, db: any, env: Env, now = new Date()): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get('origin') || '';
  const permis = (env.origins || []).includes(origin);
  const cors: Record<string, string> = permis ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
  const json = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...extra } });
  const configOk = !!(env.owner && UUID.test(env.owner) && env.cle && env.cle.length >= 24);
  const log = (o: Record<string, unknown>) => { try { console.log(JSON.stringify({ fn: 'agenda', ...o })); } catch (_) { /* rien */ } };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
  if (!configOk) { log({ erreur: 'config' }); return json({ ok: false, erreur: 'config' }, 503); }
  const today = parisToday(now);

  if (req.method === 'GET' && url.searchParams.get('sante') === '1') {
    const { error } = await db.from('climpilot_busy').select('jour').eq('user_id', env.owner).limit(1);
    return json({ ok: !error }, error ? 503 : 200);
  }

  if (req.method === 'GET' && url.searchParams.get('creneaux') === '1') {
    if (origin && !permis) return json({ ok: false, erreur: 'origine' }, 403);
    const jours = joursProposes(today, env.ferme);
    const { data, error } = await db.from('climpilot_busy').select('jour,matin,apresmidi')
      .eq('user_id', env.owner).gte('jour', jours[0]).lte('jour', jours[jours.length - 1]);
    if (error) { log({ erreur: 'lecture', code: error.code || '' }); return json({ ok: false }, 503); }
    const pris = new Map<string, { m: boolean; a: boolean }>();
    for (const r of data || []) { const p = pris.get(r.jour) || { m: false, a: false }; p.m = p.m || !!r.matin; p.a = p.a || !!r.apresmidi; pris.set(r.jour, p); }
    return json({ ok: true, jours: jours.map((d) => ({ date: d, matin: !pris.get(d)?.m, apresmidi: !pris.get(d)?.a })) }, 200, { 'Cache-Control': 'public, max-age=60' });
  }

  // tout le reste est réservé au script Google Agenda
  if (!memeCle(req.headers.get('x-agenda-cle') || '', env.cle!)) { log({ erreur: 'cle' }); return json({ ok: false, erreur: 'cle' }, 401); }

  if (req.method === 'GET' && url.searchParams.get('occupations') === '1') {
    const { data, error } = await db.from('climpilot_busy').select('jour,matin,apresmidi')
      .eq('user_id', env.owner).eq('source', 'climpilot').gte('jour', today).lte('jour', addDays(today, 60)).order('jour');
    if (error) { log({ erreur: 'lecture', code: error.code || '' }); return json({ ok: false }, 503); }
    return json({ ok: true, jours: (data || []).map((r: any) => ({ jour: r.jour, matin: !!r.matin, apresmidi: !!r.apresmidi })) });
  }

  if (req.method === 'POST') {
    const txt = await req.text();
    if (txt.length > MAX_BYTES) return json({ ok: false, erreur: 'taille' }, 413);
    let b: any = null; try { b = JSON.parse(txt); } catch (_) { /* invalide */ }
    if (!b || typeof b !== 'object' || !ISO.test(b.du) || !ISO.test(b.au) || !Array.isArray(b.jours)) return json({ ok: false, erreur: 'format' }, 400);
    if (b.au < b.du || b.au > addDays(b.du, 120) || b.du < addDays(today, -31) || b.jours.length > 400) return json({ ok: false, erreur: 'fenetre' }, 400);
    const jours = b.jours.filter((x: any) => x && ISO.test(x.jour) && x.jour >= b.du && x.jour <= b.au)
      .map((x: any) => ({ jour: x.jour, matin: x.matin === true, apresmidi: x.apresmidi === true })).filter((x: any) => x.matin || x.apresmidi);
    const { data, error } = await db.rpc('cp_busy_remplacer', { p_user: env.owner, p_source: 'google', p_du: b.du, p_au: b.au, p_jours: jours });
    if (error) { log({ erreur: 'ecriture', code: error.code || '' }); return json({ ok: false }, 503); }
    log({ ok: 'google', n: jours.length });
    return json({ ok: true, n: typeof data === 'number' ? data : jours.length });
  }
  return json({ ok: false, erreur: 'methode' }, 405);
}

if (typeof Deno !== 'undefined' && (Deno as any).serve && !(globalThis as any).__NO_SERVE) {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const env: Env = {
    owner: Deno.env.get('OWNER_USER_ID') || '', cle: Deno.env.get('AGENDA_CLE') || '', ferme: Deno.env.get('AGENDA_FERME') || '',
    origins: (Deno.env.get('SITE_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
  Deno.serve((req: Request) => handle(req, db, env));
}
