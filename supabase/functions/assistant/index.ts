// ClimPilot — Edge Function « assistant »
// COPIE DE LECTURE de la version déployée (v4, verify_jwt = true) — la version déployée fait foi.
// Reçoit la dictée de Gabriel, interroge Claude, dépose les actions dans climpilot_inbox.
// Sécurité : JWT obligatoire + liste blanche (un seul utilisateur) ; clé API dans les secrets Supabase.
// Budget : plafond mensuel BUDGET_EUR, journal dans climpilot_ai_usage.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL, BUDGET_EUR, MAX_PER_DAY, TOOLS, PLAQUE_TOOL, PLAQUE_SYSTEM, FACTURE_TOOL, FACTURE_SYSTEM, buildSystem, summarizeState, trimMessages, toRows, costEur, monthStartParis } from './logic.ts';

const ALLOWED_USERS = ['925080a9-1eaa-4fcf-9fa9-af6ffb214552']; // Gabriel
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'methode' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // 1. Qui appelle ?
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: ud, error: ue } = await service.auth.getUser(token);
  const user = ud && ud.user;
  if (ue || !user) return json({ erreur: 'non_connecte', message: 'Connecte-toi à ClimPilot.' }, 401);
  if (!ALLOWED_USERS.includes(user.id)) return json({ erreur: 'interdit' }, 403);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ erreur: 'cle_absente', message: "La clé API Claude n'est pas encore installée dans Supabase." });

  let body: any = {};
  try { body = await req.json(); } catch (_) { return json({ erreur: 'requete' }, 400); }

  // Mode « état » : juste le budget du mois (pour l'affichage)
  const since = monthStartParis();
  const { data: us } = await service.from('climpilot_ai_usage').select('cout_eur, created_at').eq('user_id', user.id).gte('created_at', since);
  const spent = (us || []).reduce((s: number, r: any) => s + Number(r.cout_eur || 0), 0);
  const today = new Date(Date.now() - 20 * 3600e3).toISOString();
  const nToday = (us || []).filter((r: any) => r.created_at >= today).length;
  if (body.etat) return json({ type: 'etat', depense_eur: Math.round(spent * 100) / 100, plafond_eur: BUDGET_EUR });

  if (spent >= BUDGET_EUR) return json({ erreur: 'budget', message: `Plafond du mois atteint (${spent.toFixed(2)} € / ${BUDGET_EUR} €). L'assistant reprend le 1er du mois ; en attendant, utilise la note rapide ou l'agent dans l'app Claude.` });
  if (nToday >= MAX_PER_DAY) return json({ erreur: 'quota_jour', message: 'Beaucoup de demandes aujourd’hui — pause de sécurité jusqu’à demain.' });

  // Mode « plaque » : lecture d'une photo de plaque signalétique
  if (body.mode === 'plaque') {
    const img = body.image || {};
    const mt = String(img.media_type || '');
    const data = String(img.data || '');
    if (!/^image\/(jpeg|png|webp)$/.test(mt) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 1000 || data.length > 2_500_000) return json({ erreur: 'image', message: 'Photo illisible ou trop lourde.' }, 400);
    let rp: Response;
    try {
      rp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 800, thinking: { type: 'disabled' }, system: PLAQUE_SYSTEM,
          tools: [PLAQUE_TOOL], tool_choice: { type: 'tool', name: 'lire_plaque' },
          messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mt, data } }, { type: 'text', text: 'Lis cette plaque signalétique.' }] }],
        }),
      });
    } catch (_) { return json({ erreur: 'reseau', message: 'Claude injoignable pour le moment.' }); }
    const op: any = await rp.json().catch(() => ({}));
    const pc = costEur(op.usage);
    await service.from('climpilot_ai_usage').insert({ user_id: user.id, modele: MODEL, cout_eur: pc, in_tok: op.usage?.input_tokens || 0, out_tok: op.usage?.output_tokens || 0, resultat: rp.ok ? 'plaque' : ('erreur ' + rp.status) });
    if (!rp.ok) return json({ erreur: 'api', message: op?.error?.message || ('HTTP ' + rp.status) });
    const tp = (op.content || []).find((c: any) => c.type === 'tool_use');
    return json({ type: 'plaque', champs: (tp && tp.input) || {}, budget: { depense_eur: Math.round((spent + pc) * 100) / 100, plafond_eur: BUDGET_EUR } });
  }

  // Mode « facture » : lecture d'une facture d'achat fournisseur (photo ou PDF) → lignes et prix nets
  if (body.mode === 'facture') {
    const doc = body.doc || {};
    const mt = String(doc.media_type || '');
    const data = String(doc.data || '');
    const isPdf = mt === 'application/pdf';
    if (!(isPdf || /^image\/(jpeg|png|webp)$/.test(mt)) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 1000 || data.length > (isPdf ? 4_500_000 : 2_500_000)) return json({ erreur: 'document', message: 'Photo ou PDF illisible ou trop lourd.' }, 400);
    const block = isPdf ? { type: 'document', source: { type: 'base64', media_type: mt, data } } : { type: 'image', source: { type: 'base64', media_type: mt, data } };
    let rf: Response;
    try {
      rf = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 4000, thinking: { type: 'disabled' }, system: FACTURE_SYSTEM,
          tools: [FACTURE_TOOL], tool_choice: { type: 'tool', name: 'lire_facture' },
          messages: [{ role: 'user', content: [block, { type: 'text', text: 'Lis cette facture fournisseur, ligne par ligne.' }] }],
        }),
      });
    } catch (_) { return json({ erreur: 'reseau', message: 'Claude injoignable pour le moment.' }); }
    const of: any = await rf.json().catch(() => ({}));
    const fc = costEur(of.usage);
    await service.from('climpilot_ai_usage').insert({ user_id: user.id, modele: MODEL, cout_eur: fc, in_tok: of.usage?.input_tokens || 0, out_tok: of.usage?.output_tokens || 0, resultat: rf.ok ? 'facture' : ('erreur ' + rf.status) });
    if (!rf.ok) return json({ erreur: 'api', message: of?.error?.message || ('HTTP ' + rf.status) });
    const tf = (of.content || []).find((c: any) => c.type === 'tool_use');
    return json({ type: 'facture', facture: (tf && tf.input) || {}, budget: { depense_eur: Math.round((spent + fc) * 100) / 100, plafond_eur: BUDGET_EUR } });
  }

  const messages = trimMessages(body.messages);
  if (!messages.length) return json({ erreur: 'vide', message: 'Dis-moi quelque chose 🙂' }, 400);
  const dictee = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' / ');

  // 2. Contexte : catalogue + résumé d'activité
  const { data: st } = await service.from('climpilot_state').select('data').eq('user_id', user.id).maybeSingle();
  const stateData = (st && st.data) || {};
  const system = buildSystem(stateData.cp2_agent_catalog || {}, summarizeState(stateData), body.now || {});

  // 3. Appel Claude (réflexion désactivée pour tenir le budget ; outil obligatoire)
  let r: Response;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        thinking: { type: 'disabled' },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        tool_choice: { type: 'any' },
        messages,
      }),
    });
  } catch (e) {
    return json({ erreur: 'reseau', message: 'Claude injoignable pour le moment — réessaie.' });
  }
  const out: any = await r.json().catch(() => ({}));
  const cost = costEur(out.usage);
  await service.from('climpilot_ai_usage').insert({
    user_id: user.id, modele: MODEL, cout_eur: cost,
    in_tok: out.usage?.input_tokens || 0, out_tok: out.usage?.output_tokens || 0,
    cache_read: out.usage?.cache_read_input_tokens || 0, cache_write: out.usage?.cache_creation_input_tokens || 0,
    resultat: r.ok ? 'ok' : ('erreur ' + r.status),
  });
  if (!r.ok) {
    const msg = out?.error?.message || ('HTTP ' + r.status);
    return json({ erreur: 'api', message: /credit|billing|balance/i.test(msg) ? 'Crédit API épuisé ou plafond Anthropic atteint.' : ('Erreur Claude : ' + msg) });
  }

  const tu = (out.content || []).find((c: any) => c.type === 'tool_use');
  const budget = { depense_eur: Math.round((spent + cost) * 100) / 100, plafond_eur: BUDGET_EUR };
  if (!tu) {
    const txt = (out.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    return json({ type: 'reponse', texte: txt || '…', budget });
  }
  if (tu.name === 'poser_question') return json({ type: 'question', texte: String(tu.input?.question || ''), budget });
  if (tu.name === 'repondre') return json({ type: 'reponse', texte: String(tu.input?.texte || ''), budget });

  // 4. Dépôt dans la boîte de réception
  const rows = toRows(tu.input, user.id, dictee);
  if (!rows.length) return json({ type: 'reponse', texte: String(tu.input?.reponse || "Je n'ai rien trouvé à enregistrer."), budget });
  const { data: ins, error: ie } = await service.from('climpilot_inbox').insert(rows).select('id, kind, statut, titre');
  if (ie) return json({ erreur: 'depot', message: 'Enregistrement impossible : ' + ie.message, budget });
  return json({ type: 'depose', texte: String(tu.input?.reponse || 'C’est noté.'), elements: ins, budget });
});
