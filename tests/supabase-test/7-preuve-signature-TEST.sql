-- =====================================================================
-- ClimPilot — PREUVE-SIGNATURE (signature : verrouillage complet d'une demande, création comprise) : ESSAI sur « ClimPilot-TEST » UNIQUEMENT
-- Préparé le 15/11/2026. À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › nouvelle requête › coller TOUT › Run
--
-- VERROU : le script ne fait rien tant que la table-marqueur public.climpilot_marqueur_test n'existe pas.
-- Ce marqueur n'existe que sur le projet de TEST (créé une fois, voir tests/supabase-test/4-une-facture-par-source-TEST.sql).
-- Le projet RÉEL n'a jamais ce marqueur : collé par erreur dans le réel, ce script s'arrête sans rien modifier.
--
-- Contenu : 1) verrous ; 2) la migration supabase/migrations/20261115120000_preuve_signature.sql, telle quelle (rejouable) ;
--           3) vérifications.
-- Attendu : 9 lignes, TOUTES « OK ». Une autre valeur, ou un message STOP : n'insiste pas, note ce qui est affiché.
-- Aucune donnée n'est écrite ni lue : seul le code des deux fonctions de contrôle (cp_sig_guard, cp_sig_insert) change. Rejouable.
-- Retour arrière : tests/supabase-test/7-preuve-signature-retour-arriere.sql.
-- Sur le RÉEL (après l'essai) : tests/supabase-test/7-REEL-preuve-signature.sql.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is null then
    raise exception 'STOP : pas de marqueur climpilot_marqueur_test. Ce n''est PAS le projet de test (ou le marqueur n''est pas encore créé). Rien n''a été modifié.';
  end if;
  if to_regclass('public.climpilot_signatures') is null or to_regprocedure('public.cp_sig_guard()') is null
     or to_regprocedure('public.cp_sig_insert()') is null then
    raise exception 'STOP : table climpilot_signatures, fonction cp_sig_guard ou cp_sig_insert absente : ce n''est pas la base ClimPilot attendue. Rien n''a été modifié.';
  end if;
  if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_guard')
     or not exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_insert') then
    raise exception 'STOP : déclencheur cp_sig_guard ou cp_sig_insert absent de climpilot_signatures. Rien n''a été modifié.';
  end if;
  -- chaque fonction en ligne doit être celle lue le 15/11/2026 (le retour arrière la remet à l'identique) ou déjà celle de cette migration
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.cp_sig_guard()'))
     not in ('01fa989c59f024f00666b9fb48e2d769', '9da1de9b7ce06e426e8695ee03cf8de9') then
    raise exception 'STOP : cp_sig_guard n''est ni la version lue le 15/11/2026 ni celle de cette migration. Rien n''a été modifié : note ce message.';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.cp_sig_insert()'))
     not in ('a761e69f5c4d5bc86ac7b1fa64f65bef', 'dd8e9e6a8ab8f37de0861e301f75aaba') then
    raise exception 'STOP : cp_sig_insert n''est ni la version lue le 15/11/2026 ni celle de cette migration. Rien n''a été modifié : note ce message.';
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

-- ---------------------------------------------------------------------
-- VÉRIFICATIONS : 9 lignes attendues, TOUTES « OK »
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
  union all select 8, 'cp_sig_insert : version PREUVE-SIGNATURE (empreinte dd8e9e6a…, security definer, search_path vide, déclencheur actif)',
    case when (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = to_regprocedure('public.cp_sig_insert()'))
              = 'dd8e9e6a8ab8f37de0861e301f75aaba'
          and coalesce(obj_description(to_regprocedure('public.cp_sig_insert()'), 'pg_proc'), '') like 'PREUVE-SIGNATURE (15/11/2026)%'
          and exists (select 1 from pg_proc where oid = to_regprocedure('public.cp_sig_insert()') and prosecdef
                      and proconfig = array['search_path=""'])
          and exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_insert'
                      and t.tgfoid = to_regprocedure('public.cp_sig_insert()') and t.tgtype = 7 and t.tgenabled = 'O') then 'OK' else 'À REVOIR' end
  union all select 9, 'cp_sig_insert : jamais appelable par l''API (anon, authenticated, public)',
    case when not has_function_privilege('anon', 'public.cp_sig_insert()', 'execute')
          and not has_function_privilege('authenticated', 'public.cp_sig_insert()', 'execute')
          and not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                          where p.oid = to_regprocedure('public.cp_sig_insert()') and x.grantee = 0) then 'OK' else 'À REVOIR' end
) v order by o;
