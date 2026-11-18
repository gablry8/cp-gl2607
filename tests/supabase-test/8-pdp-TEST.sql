-- =====================================================================
-- ClimPilot — FACT-0 : connexion à la plateforme de facturation (table climpilot_pdp + fonctions pdp_cred_set,
-- pdp_cred_get, pdp_cred_delete) : à installer sur « ClimPilot-TEST » UNIQUEMENT.
-- Préparé le 18/11/2026 (mission FACT-0, docs/MISSION-FACT.md § 2.1 et § 5.3).
-- À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › nouvelle requête › coller TOUT › Run
--
-- VERROU : le script ne fait rien tant que la table-marqueur public.climpilot_marqueur_test n'existe pas.
-- Ce marqueur n'existe que sur le projet de TEST (créé une fois, voir tests/supabase-test/4-une-facture-par-source-TEST.sql).
-- Le projet RÉEL n'a jamais ce marqueur : collé par erreur dans le réel, ce script s'arrête sans rien modifier.
--
-- Pourquoi : la fonction serveur superpdp range la connexion à la plateforme dans la table climpilot_pdp et la valeur
-- secrète dans le coffre de Supabase (Vault), par ces trois fonctions. Le réel les a ; le projet TEST ne les a pas
-- (le script 1 ne les reprend pas) : déployer superpdp sur TEST sans ce script ne suffirait pas.
-- Contenu : 1) verrous : marqueur, base ClimPilot, rôle postgres, coffre présent et utilisable ;
--           2) la table (créée si absente), sa protection par compte et ses droits, comme sur le réel ;
--           3) les trois fonctions, copie conforme du réel (relu en lecture seule le 18/11/2026 ; identiques à
--              supabase/schema.sql), exécutables par service_role seulement ;
--           4) vérifications : 15 lignes, TOUTES « OK ».
-- Aucune donnée n'est écrite, aucune valeur n'est posée ni lue dans le coffre. Rejouable : collé deux fois, la 2e fois
-- ne change rien (une connexion déjà enregistrée reste en place).
-- Une ligne qui n'est pas « OK », ou un message STOP : n'insiste pas, note ce qui est affiché.
-- Retour arrière : tests/supabase-test/8-pdp-retour-arriere.sql. Sur le RÉEL : rien à installer ; lecture seule :
-- tests/supabase-test/8-REEL-pdp-lecture.sql.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is null then
    raise exception 'STOP : pas de marqueur climpilot_marqueur_test. Ce n''est PAS le projet de test (ou le marqueur n''est pas encore créé). Rien n''a été modifié.';
  end if;
  if to_regclass('public.climpilot_documents') is null then
    raise exception 'STOP : registre des factures (1.10) absent : ce n''est pas la base ClimPilot attendue. Rien n''a été modifié.';
  end if;
  if current_user <> 'postgres' then
    raise exception 'STOP : à exécuter avec le rôle postgres (celui du SQL Editor, propriétaire de ces fonctions sur le réel) ; rôle actuel : %. Rien n''a été modifié.', current_user;
  end if;
  if to_regnamespace('vault') is null
     or to_regprocedure('vault.create_secret(text,text,text,uuid)') is null
     or to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)') is null
     or to_regclass('vault.secrets') is null or to_regclass('vault.decrypted_secrets') is null then
    raise exception 'STOP : coffre de Supabase (Vault) absent ou incomplet sur ce projet (Database › Extensions › supabase_vault). Rien n''a été modifié.';
  end if;
  if not (has_function_privilege('vault.create_secret(text,text,text,uuid)', 'execute')
          and has_function_privilege('vault.update_secret(uuid,text,text,text,uuid)', 'execute')
          and has_table_privilege('vault.secrets', 'delete')
          and has_table_privilege('vault.decrypted_secrets', 'select')) then
    raise exception 'STOP : le rôle postgres ne peut pas se servir du coffre (Vault) sur ce projet. Rien n''a été modifié.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) TABLE climpilot_pdp (relevé du réel du 18/11/2026 : colonnes, clé, lien au compte, protection par compte, droits)
-- ---------------------------------------------------------------------
create table if not exists public.climpilot_pdp (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  client_id text not null,
  secret_id uuid not null,
  env text,
  company jsonb,
  updated_at timestamptz not null default now()
);
alter table public.climpilot_pdp enable row level security;
drop policy if exists "pdp lecture proprio" on public.climpilot_pdp;
create policy "pdp lecture proprio" on public.climpilot_pdp for select to authenticated using (auth.uid() = user_id);
-- Droits comme sur le réel : rien pour public ni pour le visiteur non connecté ; l'appli connectée lit sa propre ligne
-- (règle ci-dessus) et n'écrit pas ; l'écriture passe par les fonctions ci-dessous, appelées par la fonction serveur.
revoke all on table public.climpilot_pdp from public, anon;
revoke insert, update, delete, truncate on table public.climpilot_pdp from authenticated;
grant select on table public.climpilot_pdp to authenticated;
grant all on table public.climpilot_pdp to service_role;

-- ---------------------------------------------------------------------
-- 3) FONCTIONS (copie conforme du réel : texte de pg_get_functiondef relevé le 18/11/2026)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pdp_cred_set(p_user uuid, p_client_id text, p_secret text, p_env text, p_company jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_old uuid; v_new uuid;
begin
  select secret_id into v_old from public.climpilot_pdp where user_id = p_user;
  if v_old is not null then
    perform vault.update_secret(v_old, p_secret, 'superpdp_' || p_user::text, 'Super PDP client_secret ClimPilot');
    v_new := v_old;
  else
    v_new := vault.create_secret(p_secret, 'superpdp_' || p_user::text || '_' || extract(epoch from now())::bigint, 'Super PDP client_secret ClimPilot');
  end if;
  insert into public.climpilot_pdp(user_id, client_id, secret_id, env, company, updated_at)
  values (p_user, p_client_id, v_new, p_env, p_company, now())
  on conflict (user_id) do update set client_id = excluded.client_id, secret_id = excluded.secret_id, env = excluded.env, company = excluded.company, updated_at = now();
end $function$
;

CREATE OR REPLACE FUNCTION public.pdp_cred_get(p_user uuid)
 RETURNS TABLE(client_id text, client_secret text, env text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select p.client_id, s.decrypted_secret, p.env
  from public.climpilot_pdp p join vault.decrypted_secrets s on s.id = p.secret_id
  where p.user_id = p_user;
$function$
;

CREATE OR REPLACE FUNCTION public.pdp_cred_delete(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_old uuid;
begin
  select secret_id into v_old from public.climpilot_pdp where user_id = p_user;
  delete from public.climpilot_pdp where user_id = p_user;
  if v_old is not null then delete from vault.secrets where id = v_old; end if;
end $function$
;

-- Exécution : service_role seulement (la fonction serveur superpdp) ; rien pour public, anon, authenticated (comme le réel).
revoke all on function public.pdp_cred_set(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.pdp_cred_get(uuid) from public, anon, authenticated;
revoke all on function public.pdp_cred_delete(uuid) from public, anon, authenticated;
grant execute on function public.pdp_cred_set(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.pdp_cred_get(uuid) to service_role;
grant execute on function public.pdp_cred_delete(uuid) to service_role;

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
