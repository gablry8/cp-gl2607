-- ============================================================
-- ClimPilot — PREUVE-SIGNATURE (15/11/2026) : signature, verrouillage complet d'une demande de signature
--
-- Règle (déclencheur cp_sig_guard, avant chaque modification de public.climpilot_signatures) :
--   - compte connecté (rôle authenticated, l'appli) : toute modification d'une demande est refusée, SAUF
--       (a) statut 'en_attente' → 'annule', aucune autre colonne changée
--           (nouveau lien, devis remplacé ou annulé, bouton « Désactiver » : next-signature.js) ;
--       (b) applique false → true, aucune autre colonne changée
--           (l'appli a pris en compte la signature ou le refus : next-signature.js, relevé des signatures).
--     Une mise à jour qui ne change rien est acceptée (geste répété sur un autre appareil).
--     Toutes les colonnes sont couvertes, y compris celles ajoutées plus tard (comparaison de la ligne entière).
--   - fonction publique « signature » (clé de service, service_role) : droits inchangés (vu, signer, refuser, copie).
--   - auth.uid() nul : passage inchangé. Seul un rôle qui contourne la protection par compte (administration du
--     SQL Editor, clé de service) atteint une ligne sans identifiant : la règle sig_update exige auth.uid() = user_id
--     et le visiteur non connecté n'a plus aucun droit sur la table depuis la migration 20261031120000_droits_anon.sql.
-- Messages d'erreur : courts, sans donnée du client (« modification interdite », « changement de statut interdit »).
--
-- Règle (déclencheur cp_sig_insert, avant chaque création d'une demande) : comme avant, le serveur calcule l'empreinte
-- du document et vide les colonnes de preuve ; en plus, il impose la date de création (now()) et un motif de refus vide,
-- quoi que le compte envoie. L'appli n'envoie ni l'une ni l'autre (next-signature.js, création d'un lien).
--
-- Ce que fait cette migration (rejouable : create or replace) :
--   1. remplace le corps de public.cp_sig_guard ;
--   2. remplace le corps de public.cp_sig_insert (code précédent + date de création et motif de refus imposés) ;
--   pour chacune : même nom, même en-tête (security definer, search_path vide), un commentaire, et ses droits redits
--   (fonction de déclencheur : jamais appelable par l'API). Les déclencheurs cp_sig_guard (before update) et
--   cp_sig_insert (before insert), les règles d'accès, les droits sur la table et les données ne sont pas touchés.
-- Retour arrière : tests/supabase-test/7-preuve-signature-retour-arriere.sql (remet les deux fonctions lues sur le réel le 15/11/2026).
-- Essai : tests/supabase-test/7-preuve-signature-TEST.sql (projet TEST, verrou marqueur) ; réel : 7-REEL-preuve-signature.sql.
-- Tests : tests/sql/test_preuve_signature.py (PostgreSQL local).
-- ============================================================

create or replace function public.cp_sig_guard() returns trigger
language plpgsql security definer set search_path to '' as $$
declare
  v public.climpilot_signatures;
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then return new; end if;
  if new is not distinct from old then return new; end if;
  -- (a) annuler une demande en attente : seul le statut change
  if old.statut = 'en_attente' and new.statut = 'annule' then
    v := old;
    v.statut := new.statut;
    if v is not distinct from new then return new; end if;
  end if;
  -- (b) signature ou refus pris en compte par l'appli : seule la marque « appliquée » passe de faux à vrai
  if old.applique is false and new.applique is true then
    v := old;
    v.applique := new.applique;
    if v is not distinct from new then return new; end if;
  end if;
  if new.statut is distinct from old.statut then
    raise exception 'changement de statut interdit';
  end if;
  raise exception 'modification interdite';
end $$;

comment on function public.cp_sig_guard() is
  'PREUVE-SIGNATURE (15/11/2026) : demande de signature verrouillée pour le compte connecté, sauf annulation d''une demande en attente et marque « appliquée ».';

-- fonction de déclencheur : jamais appelable directement par l'API (comme avant)
revoke all on function public.cp_sig_guard() from public, anon, authenticated;

-- 2. création d'une demande : code précédent (migration 20261002120000) + date de création et motif de refus imposés
create or replace function public.cp_sig_insert() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  new.doc_hash := encode(sha256(convert_to(new.doc_html, 'UTF8')), 'hex');
  new.signed_at := null; new.signer_nom := null; new.signature_png := null; new.signer_ip := null;
  new.signer_ua := null; new.consentement := null; new.vu_at := null; new.applique := false;
  new.support_durable_accord := null; new.copie_le := null; new.copie_nb := 0;
  new.created_at := now(); new.motif_refus := null;
  if new.expires_at > now() + interval '120 days' then new.expires_at := now() + interval '90 days'; end if;
  return new;
end $$;

comment on function public.cp_sig_insert() is
  'PREUVE-SIGNATURE (15/11/2026) : à la création d''une demande, empreinte calculée, colonnes de preuve vidées, date de création et motif de refus imposés.';

revoke all on function public.cp_sig_insert() from public, anon, authenticated;
