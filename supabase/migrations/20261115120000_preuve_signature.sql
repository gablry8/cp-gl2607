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
-- Ce que fait cette migration (rejouable : create or replace) : remplace le corps de la fonction public.cp_sig_guard
-- (même nom, même en-tête : security definer, search_path vide), la commente, et redit ses droits (fonction de
-- déclencheur : jamais appelable par l'API). Le déclencheur cp_sig_guard (before update, for each row), les règles
-- d'accès, les droits sur la table, le déclencheur d'insertion cp_sig_insert et les données ne sont pas touchés.
-- Retour arrière : tests/supabase-test/7-preuve-signature-retour-arriere.sql (remet la fonction lue sur le réel le 15/11/2026).
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
