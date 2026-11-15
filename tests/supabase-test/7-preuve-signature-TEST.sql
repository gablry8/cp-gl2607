-- =====================================================================
-- ClimPilot — PREUVE-SIGNATURE (signature : verrouillage complet d'une demande) : ESSAI sur « ClimPilot-TEST » UNIQUEMENT
-- Préparé le 15/11/2026. À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › nouvelle requête › coller TOUT › Run
--
-- VERROU : le script ne fait rien tant que la table-marqueur public.climpilot_marqueur_test n'existe pas.
-- Ce marqueur n'existe que sur le projet de TEST (créé une fois, voir tests/supabase-test/4-une-facture-par-source-TEST.sql).
-- Le projet RÉEL n'a jamais ce marqueur : collé par erreur dans le réel, ce script s'arrête sans rien modifier.
--
-- Contenu : 1) verrous ; 2) la migration supabase/migrations/20261115120000_preuve_signature.sql, telle quelle (rejouable) ;
--           3) vérifications.
-- Attendu : 8 lignes, TOUTES « OK ». Une autre valeur, ou un message STOP : n'insiste pas, note ce qui est affiché.
-- Aucune donnée n'est écrite ni lue : seul le code de la fonction de contrôle cp_sig_guard change. Rejouable.
-- Retour arrière : tests/supabase-test/7-preuve-signature-retour-arriere.sql.
-- Sur le RÉEL (après l'essai) : tests/supabase-test/7-REEL-preuve-signature.sql.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is null then
    raise exception 'STOP : pas de marqueur climpilot_marqueur_test. Ce n''est PAS le projet de test (ou le marqueur n''est pas encore créé). Rien n''a été modifié.';
  end if;
  if to_regclass('public.climpilot_signatures') is null or to_regprocedure('public.cp_sig_guard()') is null then
    raise exception 'STOP : table climpilot_signatures ou fonction cp_sig_guard absente : ce n''est pas la base ClimPilot attendue. Rien n''a été modifié.';
  end if;
  if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_guard') then
    raise exception 'STOP : déclencheur cp_sig_guard absent de climpilot_signatures. Rien n''a été modifié.';
  end if;
  -- la fonction en ligne doit être celle lue le 15/11/2026 (le retour arrière la remet à l'identique) ou déjà celle de cette migration
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.cp_sig_guard()'))
     not in ('01fa989c59f024f00666b9fb48e2d769', '9da1de9b7ce06e426e8695ee03cf8de9') then
    raise exception 'STOP : cp_sig_guard n''est ni la version lue le 15/11/2026 ni celle de cette migration. Rien n''a été modifié : note ce message.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- MIGRATION (copie conforme de supabase/migrations/20261115120000_preuve_signature.sql)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- VÉRIFICATIONS : 8 lignes attendues, TOUTES « OK »
-- ---------------------------------------------------------------------
select controle, etat from (
  select 1 as o, 'cp_sig_guard : présente, security definer, search_path vide' as controle,
    case when exists (select 1 from pg_proc where oid = to_regprocedure('public.cp_sig_guard()') and prosecdef
                      and proconfig = array['search_path=""']) then 'OK' else 'À REVOIR' end as etat
  union all select 2, 'cp_sig_guard : version PREUVE-SIGNATURE (commentaire)',
    case when coalesce(obj_description(to_regprocedure('public.cp_sig_guard()'), 'pg_proc'), '') like 'PREUVE-SIGNATURE (15/11/2026)%'
         then 'OK' else 'À REVOIR' end
  union all select 3, 'cp_sig_guard : code identique à la migration (empreinte 9da1de9b…)',
    case when (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.cp_sig_guard()'))
              = '9da1de9b7ce06e426e8695ee03cf8de9' then 'OK' else 'À REVOIR' end
  union all select 4, 'déclencheur cp_sig_guard : avant chaque modification, ligne par ligne, actif',
    case when exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_guard'
                      and t.tgfoid = to_regprocedure('public.cp_sig_guard()') and t.tgtype = 19 and t.tgenabled = 'O') then 'OK' else 'À REVOIR' end
  union all select 5, 'cp_sig_guard : jamais appelable par l''API (anon, authenticated, public)',
    case when not has_function_privilege('anon', 'public.cp_sig_guard()', 'execute')
          and not has_function_privilege('authenticated', 'public.cp_sig_guard()', 'execute')
          and not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                          where p.oid = to_regprocedure('public.cp_sig_guard()') and x.grantee = 0) then 'OK' else 'À REVOIR' end
  union all select 6, 'fonction publique « signature » (service_role) : lecture et modification de la table gardées',
    case when has_table_privilege('service_role', 'public.climpilot_signatures', 'select')
          and has_table_privilege('service_role', 'public.climpilot_signatures', 'update') then 'OK' else 'À REVOIR' end
  union all select 7, 'climpilot_signatures : protection par compte inchangée (active, 3 règles, aucune pour la suppression)',
    case when (select relrowsecurity from pg_class where oid = 'public.climpilot_signatures'::regclass)
          and (select string_agg(policyname::text || ':' || cmd::text, ',' order by policyname) from pg_policies
               where schemaname = 'public' and tablename = 'climpilot_signatures') = 'sig_insert:INSERT,sig_select:SELECT,sig_update:UPDATE'
         then 'OK' else 'À REVOIR' end
  union all select 8, 'déclencheur d''insertion cp_sig_insert inchangé (code lu le 15/11/2026, actif)',
    case when (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.cp_sig_insert()'))
              = 'a761e69f5c4d5bc86ac7b1fa64f65bef'
          and exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_insert'
                      and t.tgfoid = to_regprocedure('public.cp_sig_insert()') and t.tgtype = 7 and t.tgenabled = 'O') then 'OK' else 'À REVOIR' end
) v order by o;
