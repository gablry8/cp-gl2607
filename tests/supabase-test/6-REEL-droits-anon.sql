-- =====================================================================
-- ClimPilot — P6 : À COLLER SUR LE PROJET RÉEL, APRÈS l'essai sur ClimPilot-TEST (6-droits-anon-TEST.sql, 27 « OK »)
-- Préparé le 31/10/2026. Assemble, sans rien changer : la migration supabase/migrations/20261031120000_droits_anon.sql
-- (telle quelle) + les vérifications communes. Rien de la partie propre au projet TEST.
-- Où : supabase.com › projet RÉEL (pas ClimPilot-TEST) › SQL Editor › nouvelle requête › coller TOUT › Run.
-- Attendu : 19 lignes, TOUTES commençant par « OK ». Une autre valeur, ou un message STOP : n'insiste pas, note ce qui est affiché.
-- Retour arrière : tests/supabase-test/6-droits-anon-retour-arriere.sql.
-- Aucune donnée n'est écrite ni lue : seuls des droits du visiteur non connecté sont retirés. Rejouable.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is not null then
    raise exception 'STOP : marqueur climpilot_marqueur_test présent = projet de TEST. Ce script est pour le projet RÉEL (sur le test : 6-droits-anon-TEST.sql). Rien n''a été modifié.';
  end if;
  if to_regclass('public.climpilot_documents') is null then
    raise exception 'STOP : registre des factures (1.10) absent : ce n''est pas la base ClimPilot attendue. Rien n''a été modifié.';
  end if;
  if to_regprocedure('public.cp_serveur_info()') is null or to_regprocedure('public.cp_version_ok(text)') is null
     or to_regprocedure('public.cp_arr_len(jsonb)') is null or to_regprocedure('public.cp_num_txt(text,integer,integer)') is null
     or to_regprocedure('public.cp_doc_json(public.climpilot_documents)') is null then
    raise exception 'STOP : une des cinq fonctions attendues est absente : ce n''est pas la base ClimPilot attendue. Rien n''a été modifié.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- MIGRATION (copie conforme de supabase/migrations/20261031120000_droits_anon.sql)
-- ---------------------------------------------------------------------
-- ============================================================
-- ClimPilot — P6 (31/10/2026) : retrait de droits inutiles au rôle « anon » (visiteur NON connecté)
--
-- Pourquoi : défense en profondeur. L'appli ne lit et n'écrit la base qu'une fois connectée (rôle authenticated) ;
-- la page de signature et le site passent par des fonctions serveur (signature, agenda) qui utilisent la clé de service.
-- Aucun appel légitime ne passe par le rôle anon : les droits que Supabase lui donne par défaut ne servent à rien ici.
-- La protection par compte (RLS) reste en place, inchangée ; cette migration retire seulement des droits en trop.
--
-- Ce que fait cette migration (rejouable ; aucune donnée, aucune table, aucune fonction créée, modifiée ou supprimée) :
--   1. Cinq petites fonctions (cp_serveur_info, cp_version_ok, cp_arr_len, cp_doc_json, cp_num_txt) :
--      revoke execute … from public, anon ; grant execute … to authenticated, service_role (droits explicites,
--      M4 C19 : toujours nommer public). Seule cp_serveur_info est appelée directement par l'appli, après connexion
--      (next-emission.js, sonde) ; les quatre autres ne sont appelées que depuis des fonctions « security definer »
--      (émission, synchronisation, sauvegardes) qui s'exécutent avec les droits de leur propriétaire : le droit
--      d'authenticated est gardé par prudence (aucun changement pour l'appli connectée).
--   2. Tables ClimPilot (seulement celles qui existent : le projet de test n'a pas toutes les tables) :
--      revoke all … from public, anon, ainsi que sur les séquences qui leur appartiennent.
--      Les droits d'authenticated et de service_role ne sont pas touchés.
--   3. Les droits PAR DÉFAUT du schéma public (alter default privileges) ne sont PAS modifiés (réglage de Supabase) :
--      une table ou une fonction créée plus tard par postgres recevra encore des droits pour anon. Chaque nouvelle
--      migration doit donc les retirer elle-même (revoke … from public, anon). Garde automatique pour les migrations
--      du dépôt : tests/sql/test_p6_droits.py (test 14). Une table créée à la main dans le tableau de bord n'est pas couverte.
-- Retour arrière : tests/supabase-test/6-droits-anon-retour-arriere.sql.
-- Essai : tests/supabase-test/6-droits-anon-TEST.sql (projet TEST, verrou marqueur) ; réel : tests/supabase-test/6-REEL-droits-anon.sql.
-- Tests : tests/sql/test_p6_droits.py (PostgreSQL local).
-- ============================================================

-- 1. cinq petites fonctions : plus d'exécution sans connexion
revoke execute on function public.cp_serveur_info() from public, anon;
revoke execute on function public.cp_version_ok(text) from public, anon;
revoke execute on function public.cp_arr_len(jsonb) from public, anon;
revoke execute on function public.cp_doc_json(public.climpilot_documents) from public, anon;
revoke execute on function public.cp_num_txt(text, integer, integer) from public, anon;
grant execute on function public.cp_serveur_info() to authenticated, service_role;
grant execute on function public.cp_version_ok(text) to authenticated, service_role;
grant execute on function public.cp_arr_len(jsonb) to authenticated, service_role;
grant execute on function public.cp_doc_json(public.climpilot_documents) to authenticated, service_role;
grant execute on function public.cp_num_txt(text, integer, integer) to authenticated, service_role;

-- 2. tables ClimPilot et leurs séquences : aucun droit pour le visiteur non connecté
do $$
declare
  t text;
  s regclass;
begin
  foreach t in array array['climpilot_state', 'climpilot_backups', 'climpilot_signatures', 'climpilot_inbox',
                           'climpilot_ai_usage', 'climpilot_catalogue', 'climpilot_pdp', 'climpilot_seq',
                           'climpilot_documents', 'climpilot_doc_events', 'climpilot_busy'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from public, anon', t);
      for s in select sq.oid::regclass from pg_class sq join pg_depend d on d.objid = sq.oid and d.deptype in ('a', 'i')
               where sq.relkind = 'S' and d.refobjid = to_regclass('public.' || t) loop
        execute format('revoke all on sequence %s from public, anon', s);
      end loop;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- VÉRIFICATIONS : 19 lignes attendues, TOUTES commençant par « OK »
-- ---------------------------------------------------------------------
select controle, etat from (
  select 1 as o, 'anon : cp_serveur_info non exécutable sans connexion' as controle,
    case when not has_function_privilege('anon', 'public.cp_serveur_info()', 'execute') then 'OK' else 'À REVOIR' end as etat
  union all select 2, 'anon : cp_version_ok non exécutable sans connexion',
    case when not has_function_privilege('anon', 'public.cp_version_ok(text)', 'execute') then 'OK' else 'À REVOIR' end
  union all select 3, 'anon : cp_arr_len non exécutable sans connexion',
    case when not has_function_privilege('anon', 'public.cp_arr_len(jsonb)', 'execute') then 'OK' else 'À REVOIR' end
  union all select 4, 'anon : cp_doc_json non exécutable sans connexion',
    case when not has_function_privilege('anon', 'public.cp_doc_json(public.climpilot_documents)', 'execute') then 'OK' else 'À REVOIR' end
  union all select 5, 'anon : cp_num_txt non exécutable sans connexion',
    case when not has_function_privilege('anon', 'public.cp_num_txt(text,integer,integer)', 'execute') then 'OK' else 'À REVOIR' end
  union all select 6, 'appli connectée (authenticated) et service (service_role) : les cinq fonctions restent exécutables',
    case when (select bool_and(has_function_privilege(r, f, 'execute'))
               from unnest(array['authenticated', 'service_role']) r,
                    unnest(array['public.cp_serveur_info()', 'public.cp_version_ok(text)', 'public.cp_arr_len(jsonb)',
                                 'public.cp_doc_json(public.climpilot_documents)', 'public.cp_num_txt(text,integer,integer)']) f)
         then 'OK' else 'À REVOIR' end
  union all select 6 + x.i::int, 'anon : aucun droit sur la table ' || x.t,
    case when to_regclass('public.' || x.t) is null then 'OK (table absente)'
         when not exists (select 1 from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
                          where has_table_privilege('anon', to_regclass('public.' || x.t), p)) then 'OK' else 'À REVOIR' end
    from unnest(array['climpilot_state', 'climpilot_backups', 'climpilot_signatures', 'climpilot_inbox', 'climpilot_ai_usage', 'climpilot_catalogue', 'climpilot_pdp', 'climpilot_seq', 'climpilot_documents', 'climpilot_doc_events', 'climpilot_busy']) with ordinality as x(t, i)
  union all select 18, 'anon : aucun droit sur les séquences de ces tables',
    case when not exists (select 1 from pg_class sq join pg_depend d on d.objid = sq.oid and d.deptype in ('a', 'i')
                          cross join unnest(array['usage', 'select', 'update']) p
                          where sq.relkind = 'S' and has_sequence_privilege('anon', sq.oid, p)
                            and d.refobjid in (select to_regclass('public.' || t) from unnest(array['climpilot_state', 'climpilot_backups', 'climpilot_signatures', 'climpilot_inbox', 'climpilot_ai_usage', 'climpilot_catalogue', 'climpilot_pdp', 'climpilot_seq', 'climpilot_documents', 'climpilot_doc_events', 'climpilot_busy']) t))
         then 'OK' else 'À REVOIR' end
  union all select 19, 'appli connectée (authenticated) : lecture gardée sur climpilot_state et climpilot_documents',
    case when has_table_privilege('authenticated', 'public.climpilot_state', 'select')
          and has_table_privilege('authenticated', 'public.climpilot_documents', 'select') then 'OK' else 'À REVOIR' end
) v order by o;
