-- =====================================================================
-- ClimPilot — FACT-0 : LECTURE SEULE sur le projet RÉEL : connexion à la plateforme de facturation (table climpilot_pdp,
-- fonctions pdp_cred_set, pdp_cred_get, pdp_cred_delete). Préparé le 18/11/2026 (docs/MISSION-FACT.md § 5.3).
-- Où : supabase.com › projet RÉEL (pas ClimPilot-TEST) › SQL Editor › nouvelle requête › coller TOUT › Run.
-- Ce qu'il fait : RIEN n'est modifié, aucune donnée n'est lue (ni ligne de la table, ni coffre) : il relit seulement la
-- structure, les règles et les droits, et les compare au relevé du 18/11/2026 (le même que celui du script TEST).
-- La transaction est mise en lecture seule dès la 1re ligne : une écriture serait refusée par la base elle-même.
-- Attendu : 15 lignes, TOUTES « OK » (les mêmes contrôles que tests/supabase-test/8-pdp-TEST.sql).
-- Une ligne « À REVOIR », ou un message STOP : n'insiste pas, note ce qui est affiché et transmets-le.
-- =====================================================================
set transaction read only;
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is not null then
    raise exception 'STOP : marqueur climpilot_marqueur_test présent = projet de TEST. Ce script est pour le projet RÉEL (sur le test : 8-pdp-TEST.sql). Rien n''a été lu ni modifié.';
  end if;
  if to_regclass('public.climpilot_documents') is null then
    raise exception 'STOP : registre des factures (1.10) absent : ce n''est pas la base ClimPilot attendue. Rien n''a été lu ni modifié.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- VÉRIFICATIONS : 15 lignes attendues, TOUTES « OK »
-- ---------------------------------------------------------------------
select controle, etat from (
  select 1 as o, 'coffre de Supabase (Vault) présent et utilisable par le propriétaire des fonctions (postgres)' as controle,
    case when coalesce(has_function_privilege('postgres', to_regprocedure('vault.create_secret(text,text,text,uuid)'), 'execute')
                   and has_function_privilege('postgres', to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)'), 'execute')
                   and has_table_privilege('postgres', to_regclass('vault.secrets'), 'delete')
                   and has_table_privilege('postgres', to_regclass('vault.decrypted_secrets'), 'select'), false)
         then 'OK' else 'À REVOIR' end as etat
  union all select 2, 'table climpilot_pdp présente',
    case when to_regclass('public.climpilot_pdp') is not null then 'OK' else 'À REVOIR' end
  union all select 3, 'climpilot_pdp : colonnes conformes au réel',
    case when (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end
                                 || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''), ', ' order by a.attnum)
               from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
               where a.attrelid = to_regclass('public.climpilot_pdp') and a.attnum > 0 and not a.attisdropped)
              = 'user_id uuid not null, client_id text not null, secret_id uuid not null, env text, company jsonb, updated_at timestamp with time zone not null default now()'
         then 'OK' else 'À REVOIR' end
  union all select 4, 'climpilot_pdp : clé user_id, liée au compte (effacée avec lui)',
    case when (select string_agg(pg_get_constraintdef(k.oid), ' | ' order by k.contype desc) from pg_constraint k where k.conrelid = to_regclass('public.climpilot_pdp'))
              = 'PRIMARY KEY (user_id) | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
         then 'OK' else 'À REVOIR' end
  union all select 5, 'climpilot_pdp : protection par compte activée',
    case when coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.climpilot_pdp')), false) then 'OK' else 'À REVOIR' end
  union all select 6, 'climpilot_pdp : une seule règle, chacun lit sa propre ligne (authenticated)',
    case when (select count(*) = 1 and coalesce(bool_and(pp.policyname = 'pdp lecture proprio' and pp.cmd = 'SELECT' and pp.roles = array['authenticated']::name[]
                                                    and pp.permissive = 'PERMISSIVE' and pp.qual = '(auth.uid() = user_id)' and pp.with_check is null), false)
               from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'climpilot_pdp')
              and to_regclass('public.climpilot_pdp') is not null
         then 'OK' else 'À REVOIR' end
  union all select 7, 'climpilot_pdp : aucun droit pour le visiteur non connecté (anon) ni pour public',
    case when to_regclass('public.climpilot_pdp') is not null
          and not exists (select 1 from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
                          where has_table_privilege('anon', to_regclass('public.climpilot_pdp'), p))
          and not exists (select 1 from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                          where c.oid = to_regclass('public.climpilot_pdp') and a.grantee = 0)
         then 'OK' else 'À REVOIR' end
  union all select 8, 'climpilot_pdp : appli connectée (authenticated) en lecture seule',
    case when coalesce(has_table_privilege('authenticated', to_regclass('public.climpilot_pdp'), 'select'), false)
          and not exists (select 1 from unnest(array['insert', 'update', 'delete', 'truncate']) p
                          where coalesce(has_table_privilege('authenticated', to_regclass('public.climpilot_pdp'), p), true))
         then 'OK' else 'À REVOIR' end
  union all select 9, 'climpilot_pdp : service_role lit et écrit',
    case when to_regclass('public.climpilot_pdp') is not null
          and not exists (select 1 from unnest(array['select', 'insert', 'update', 'delete']) p
                          where not has_table_privilege('service_role', to_regclass('public.climpilot_pdp'), p))
         then 'OK' else 'À REVOIR' end
  union all select 10, 'pdp_cred_set : présente, copie conforme du réel',
    case when md5(pg_get_functiondef(to_regprocedure('public.pdp_cred_set(uuid,text,text,text,jsonb)'))) = 'c4dc578e2bf2718bb8fe3a7d022b83b9' then 'OK' else 'À REVOIR' end
  union all select 11, 'pdp_cred_get : présente, copie conforme du réel',
    case when md5(pg_get_functiondef(to_regprocedure('public.pdp_cred_get(uuid)'))) = '7e4e584bd684d85af7c5fe26bec0c47d' then 'OK' else 'À REVOIR' end
  union all select 12, 'pdp_cred_delete : présente, copie conforme du réel',
    case when md5(pg_get_functiondef(to_regprocedure('public.pdp_cred_delete(uuid)'))) = 'e3a97fd402cf201dc24398a732d57c03' then 'OK' else 'À REVOIR' end
  union all select 13, 'table et trois fonctions : propriétaire postgres',
    case when (select count(*) = 3 and bool_and(pg_get_userbyid(f.proowner) = 'postgres') from pg_proc f
               where f.oid in (to_regprocedure('public.pdp_cred_set(uuid,text,text,text,jsonb)'), to_regprocedure('public.pdp_cred_get(uuid)'), to_regprocedure('public.pdp_cred_delete(uuid)')))
          and coalesce((select pg_get_userbyid(c.relowner) = 'postgres' from pg_class c where c.oid = to_regclass('public.climpilot_pdp')), false)
         then 'OK' else 'À REVOIR' end
  union all select 14, 'trois fonctions : aucun droit pour public, anon, authenticated',
    case when (select count(*) = 3 and bool_and(not has_function_privilege('anon', f.oid, 'execute') and not has_function_privilege('authenticated', f.oid, 'execute')
                                                and not exists (select 1 from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a where a.grantee = 0))
               from pg_proc f
               where f.oid in (to_regprocedure('public.pdp_cred_set(uuid,text,text,text,jsonb)'), to_regprocedure('public.pdp_cred_get(uuid)'), to_regprocedure('public.pdp_cred_delete(uuid)')))
         then 'OK' else 'À REVOIR' end
  union all select 15, 'trois fonctions : exécutables par service_role',
    case when (select count(*) = 3 and bool_and(has_function_privilege('service_role', f.oid, 'execute')) from pg_proc f
               where f.oid in (to_regprocedure('public.pdp_cred_set(uuid,text,text,text,jsonb)'), to_regprocedure('public.pdp_cred_get(uuid)'), to_regprocedure('public.pdp_cred_delete(uuid)')))
         then 'OK' else 'À REVOIR' end
) v order by o;
