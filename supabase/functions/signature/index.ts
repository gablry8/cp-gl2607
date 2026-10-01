// ClimPilot — Edge Function « signature » (publique, protégée par un jeton aléatoire par document)
// COPIE DE LECTURE de la version déployée (v3, verify_jwt = false) — la version déployée fait foi.
// Actions : lire (affiche le document), signer, refuser.
// Preuve conservée : horodatage serveur, nom saisi, signature manuscrite (image), adresse IP,
// navigateur, empreinte SHA-256 du document calculée à l'envoi, texte de consentement.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

export async function handle(req: Request, db: any): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'methode' }, 405);
  let b: any = {};
  try { b = await req.json(); } catch (_) { return json({ erreur: 'requete' }, 400); }
  const t = String(b.t || '');
  if (!UUID.test(t)) return json({ erreur: 'lien', message: 'Lien invalide.' }, 404);

  const { data: s, error } = await db.from('climpilot_signatures').select('*').eq('token', t).maybeSingle();
  if (error || !s) return json({ erreur: 'lien', message: 'Ce lien de signature est introuvable.' }, 404);
  const expired = new Date(s.expires_at).getTime() < Date.now();

  if (b.action === 'lire') {
    if (s.statut === 'en_attente' && !s.vu_at) await db.from('climpilot_signatures').update({ vu_at: new Date().toISOString() }).eq('token', t);
    return json({
      statut: expired && s.statut === 'en_attente' ? 'expire' : s.statut,
      doc_type: s.doc_type, doc_num: s.doc_num, titre: s.titre, client_nom: s.client_nom, montant_ttc: s.montant_ttc,
      doc_html: s.statut === 'annule' ? '' : s.doc_html, doc_hash: s.doc_hash, expires_at: s.expires_at,
      signed_at: s.signed_at, signer_nom: s.signer_nom, signature_png: s.statut === 'signe' ? s.signature_png : null,
    });
  }

  if (b.action !== 'signer' && b.action !== 'refuser') return json({ erreur: 'action' }, 400);
  if (s.statut !== 'en_attente') return json({ erreur: 'deja', message: s.statut === 'signe' ? 'Ce document a déjà été signé.' : 'Ce lien n’est plus actif.' }, 409);
  if (expired) return json({ erreur: 'expire', message: 'Ce lien a expiré. Demandez un nouveau lien à votre installateur.' }, 410);

  const nom = clean(b.nom, 100);
  if (nom.length < 2) return json({ erreur: 'nom', message: 'Indiquez vos nom et prénom.' }, 400);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || null;
  const ua = (req.headers.get('user-agent') || '').slice(0, 300) || null;
  const now = new Date().toISOString();
  const libelle = s.doc_type === 'fluide' ? 'la fiche d’intervention ' : 'le devis ';

  if (b.action === 'refuser') {
    await db.from('climpilot_signatures').update({ statut: 'refuse', signed_at: now, signer_nom: nom, signer_ip: ip, signer_ua: ua, motif_refus: clean(b.motif, 500) || null }).eq('token', t).eq('statut', 'en_attente');
    await db.from('climpilot_inbox').insert({ user_id: s.user_id, kind: 'note', statut: 'auto', source: 'signature', titre: `${s.client_nom || nom} a décliné ${libelle}${s.doc_num || ''}`, payload: { texte: `Refus en ligne de ${libelle}${s.doc_num || ''} par ${nom}${b.motif ? ' — motif : ' + clean(b.motif, 200) : ''}`, priorite: 'medium', categorie: 'Client' } });
    return json({ ok: true, statut: 'refuse' });
  }

  if (b.accepte !== true) return json({ erreur: 'consentement', message: 'Cochez la case d’acceptation.' }, 400);
  const png = String(b.signature || '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length < 800 || png.length > 300000) return json({ erreur: 'signature', message: 'Signature manquante ou illisible : signez dans le cadre.' }, 400);
  const consentement = `J'ai lu ${libelle}n° ${s.doc_num || ''} et je l'accepte sans réserve — « Bon pour accord ». Empreinte du document : ${s.doc_hash}.`
    + (b.anticipe === true ? ' Le client demande expressément que les travaux commencent avant la fin du délai de rétractation de 14 jours.' : '');
  const { data: up, error: ue } = await db.from('climpilot_signatures').update({ statut: 'signe', signed_at: now, signer_nom: nom, signature_png: png, signer_ip: ip, signer_ua: ua, consentement }).eq('token', t).eq('statut', 'en_attente').select('token');
  if (ue || !up || !up.length) return json({ erreur: 'deja', message: 'Ce document vient déjà d’être traité.' }, 409);
  await db.from('climpilot_inbox').insert({ user_id: s.user_id, kind: 'note', statut: 'auto', source: 'signature', titre: s.doc_type === 'devis' ? `✍️ Devis ${s.doc_num || ''} signé par ${nom} — planifier le chantier` : `✍️ Fiche ${s.doc_num || ''} signée par ${nom}`, payload: { texte: `${s.doc_type === 'devis' ? 'Devis' : 'Fiche'} ${s.doc_num || ''} signé en ligne par ${nom} le ${new Date(now).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`, priorite: 'high', categorie: s.doc_type === 'devis' ? 'Chantier' : 'Client' } });
  return json({ ok: true, statut: 'signe', signed_at: now, doc_hash: s.doc_hash, consentement });
}

if (typeof Deno !== 'undefined' && (Deno as any).serve && !(globalThis as any).__NO_SERVE) {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  Deno.serve((req: Request) => handle(req, db));
}
