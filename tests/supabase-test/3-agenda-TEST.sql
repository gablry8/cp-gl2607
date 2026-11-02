-- =====================================================================
-- ClimPilot — AGENDA (demi-journées occupées) : ESSAI sur « ClimPilot-TEST » UNIQUEMENT
-- Préparé en M0 le 20/10/2026. À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › nouvelle requête › Run
--
-- VERROU : le script ne fait rien tant que la table-marqueur public.climpilot_marqueur_test n'existe pas.
-- Ce marqueur n'existe que sur le projet de TEST : tu le crées UNE fois, après avoir vérifié le nom du projet
-- dans l'adresse de la page (ClimPilot-TEST), avec cette seule ligne :
--     create table public.climpilot_marqueur_test (note text);
-- Le projet RÉEL n'a jamais ce marqueur : collé par erreur dans le réel, ce script s'arrête sans rien modifier.
--
-- Contenu : 1) verrou ; 2) la migration supabase/migrations/20261020120000_agenda.sql, telle quelle (rejouable) ;
--           3) vérifications (la requête finale doit afficher 6 lignes « OK »).
-- Retour arrière : tests/supabase-test/3-agenda-retour-arriere.sql
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is null then
    raise exception 'STOP : pas de marqueur climpilot_marqueur_test. Ce n''est PAS le projet de test (ou le marqueur n''est pas encore créé). Rien n''a été modifié.';
  end if;
  if to_regclass('public.climpilot_state') is null then
    raise exception 'STOP : ce projet ne contient pas ClimPilot (climpilot_state absent). Applique d''abord la structure 1.10.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) MIGRATION (copie conforme de supabase/migrations/20261020120000_agenda.sql)
-- ---------------------------------------------------------------------
create table if not exists public.climpilot_busy (
  user_id   uuid not null references auth.users(id) on delete cascade,
  source    text not null check (source in ('climpilot', 'google')),
  jour      date not null,
  matin     boolean not null default false,
  apresmidi boolean not null default false,
  maj       timestamptz not null default now(),
  primary key (user_id, source, jour)
);
alter table public.climpilot_busy enable row level security;
drop policy if exists busy_lecture on public.climpilot_busy;
create policy busy_lecture on public.climpilot_busy for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.climpilot_busy from public, anon, authenticated;
grant select on public.climpilot_busy to authenticated;

create or replace function public.cp_busy_remplacer(p_user uuid, p_source text, p_du date, p_au date, p_jours jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int := 0; j jsonb; v_jour date; v_m boolean; v_a boolean;
begin
  if p_user is null then raise exception 'utilisateur manquant'; end if;
  if p_source is null or p_source not in ('climpilot', 'google') then raise exception 'source inconnue'; end if;
  if p_du is null or p_au is null or p_au < p_du or p_au - p_du > 120 then raise exception 'fenêtre invalide'; end if;
  if p_jours is null or jsonb_typeof(p_jours) <> 'array' or jsonb_array_length(p_jours) > 400 then raise exception 'jours invalides'; end if;
  perform pg_advisory_xact_lock(hashtext('cp_busy:' || p_user::text || ':' || p_source));
  delete from public.climpilot_busy b where b.user_id = p_user and b.source = p_source and b.jour between p_du and p_au;
  for j in select value from jsonb_array_elements(p_jours) loop
    if jsonb_typeof(j) <> 'object' or coalesce(j->>'jour', '') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
    v_jour := (j->>'jour')::date;
    v_m := coalesce(j->>'matin', '') = 'true';
    v_a := coalesce(j->>'apresmidi', '') = 'true';
    if v_jour < p_du or v_jour > p_au or not (v_m or v_a) then continue; end if;
    insert into public.climpilot_busy as b (user_id, source, jour, matin, apresmidi, maj)
    values (p_user, p_source, v_jour, v_m, v_a, now())
    on conflict (user_id, source, jour) do update set matin = b.matin or excluded.matin, apresmidi = b.apresmidi or excluded.apresmidi, maj = now();
    n := n + 1;
  end loop;
  delete from public.climpilot_busy b where b.user_id = p_user and b.jour < current_date - 30;
  return n;
end $function$;
revoke execute on function public.cp_busy_remplacer(uuid, text, date, date, jsonb) from public, anon, authenticated;

create or replace function public.cp_busy_appli(p_du date, p_au date, p_jours jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  return public.cp_busy_remplacer(v_uid, 'climpilot', p_du, p_au, p_jours);
end $function$;
revoke execute on function public.cp_busy_appli(date, date, jsonb) from public, anon;
grant execute on function public.cp_busy_appli(date, date, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3) VÉRIFICATION : 6 lignes « OK » attendues
-- ---------------------------------------------------------------------
select 'table climpilot_busy' as controle, case when to_regclass('public.climpilot_busy') is not null then 'OK' else 'MANQUE' end as etat
union all select 'RLS activée', case when (select relrowsecurity from pg_class where oid = to_regclass('public.climpilot_busy')) then 'OK' else 'NON' end
union all select 'politique busy_lecture', case when exists (select 1 from pg_policies where schemaname='public' and tablename='climpilot_busy' and policyname='busy_lecture') then 'OK' else 'MANQUE' end
union all select 'fonction cp_busy_remplacer', case when to_regprocedure('public.cp_busy_remplacer(uuid,text,date,date,jsonb)') is not null then 'OK' else 'MANQUE' end
union all select 'fonction cp_busy_appli', case when to_regprocedure('public.cp_busy_appli(date,date,jsonb)') is not null then 'OK' else 'MANQUE' end
union all select 'anon ne peut PAS appeler cp_busy_appli', case when not has_function_privilege('anon', 'public.cp_busy_appli(date,date,jsonb)', 'execute') then 'OK' else 'DANGER' end;
