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
