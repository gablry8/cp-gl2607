-- =====================================================================
-- ClimPilot — P6 : RETOUR ARRIÈRE de la migration 20261031120000_droits_anon.sql (retrait de droits inutiles à « anon »)
-- Préparé le 31/10/2026. À coller dans le SQL Editor du projet concerné (TEST d'abord ; RÉEL seulement si la
-- correction doit être annulée), nouvelle requête, Run.
--
-- Ce qu'il fait : rend au rôle anon (visiteur non connecté) les droits que Supabase lui donne par défaut, tels qu'ils
-- étaient avant P6 d'après le dépôt :
--   - les cinq petites fonctions redeviennent exécutables sans connexion (cp_serveur_info : par public, comme après 1.10 ;
--     les quatre autres : par public et anon) ;
--   - climpilot_state : lecture seulement (l'écriture directe est fermée depuis 1.10, elle reste fermée) ;
--   - climpilot_backups, climpilot_signatures, climpilot_inbox, climpilot_catalogue, climpilot_ai_usage, climpilot_pdp
--     (celles qui existent) : droits par défaut de Supabase sauf TRUNCATE (retiré en 1.10), et leurs séquences.
-- Ce qu'il ne touche pas : climpilot_seq, climpilot_documents, climpilot_doc_events, climpilot_busy (fermées à anon depuis
-- 1.10 et l'agenda), les droits d'authenticated et de service_role, la protection par compte (RLS), aucune donnée.
-- Attention : sur certaines tables, ce retour peut rendre un peu plus que l'état exact d'avant (droits par défaut de Supabase) ;
-- la protection par compte (RLS) bloque de toute façon le visiteur non connecté.
-- Rejouable : collé deux fois, la 2e fois ne change rien.
-- =====================================================================
grant execute on function public.cp_serveur_info() to public;
grant execute on function public.cp_version_ok(text) to public, anon;
grant execute on function public.cp_arr_len(jsonb) to public, anon;
grant execute on function public.cp_doc_json(public.climpilot_documents) to public, anon;
grant execute on function public.cp_num_txt(text, integer, integer) to public, anon;

do $$
declare
  t text;
  s regclass;
begin
  if to_regclass('public.climpilot_state') is not null then
    grant select, references, trigger on table public.climpilot_state to anon;
  end if;
  foreach t in array array['climpilot_backups', 'climpilot_signatures', 'climpilot_inbox', 'climpilot_catalogue',
                           'climpilot_ai_usage', 'climpilot_pdp'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete, references, trigger on table public.%I to anon', t);
      for s in select sq.oid::regclass from pg_class sq join pg_depend d on d.objid = sq.oid and d.deptype in ('a', 'i')
               where sq.relkind = 'S' and d.refobjid = to_regclass('public.' || t) loop
        execute format('grant usage, select, update on sequence %s to anon', s);
      end loop;
    end if;
  end loop;
end $$;

-- VÉRIFICATION : 2 lignes « OK » attendues
select 'anon peut de nouveau exécuter les cinq petites fonctions' as controle,
  case when has_function_privilege('anon', 'public.cp_serveur_info()', 'execute')
        and has_function_privilege('anon', 'public.cp_version_ok(text)', 'execute')
        and has_function_privilege('anon', 'public.cp_arr_len(jsonb)', 'execute')
        and has_function_privilege('anon', 'public.cp_doc_json(public.climpilot_documents)', 'execute')
        and has_function_privilege('anon', 'public.cp_num_txt(text,integer,integer)', 'execute') then 'OK' else 'À REVOIR' end as etat
union all select 'anon a de nouveau la lecture de climpilot_state (bloquée par la protection par compte)',
  case when has_table_privilege('anon', 'public.climpilot_state', 'select') then 'OK' else 'À REVOIR' end;
