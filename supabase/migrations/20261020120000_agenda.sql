-- ClimPilot — agenda : demi-journées occupées (20/10/2026, PRÉPARÉ, NON APPLIQUÉ)
-- But : ne jamais avoir deux clients au même moment.
--  - l'appli envoie ses demi-journées prises (source « climpilot ») ;
--  - le script Google Agenda envoie celles de l'agenda de Gabriel (source « google ») via la fonction « agenda » ;
--  - le site ne propose que les demi-journées libres (fonction « agenda », ?creneaux=1).
-- Aucune donnée client ici : seulement une date et deux cases (matin, après-midi).

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
-- écriture uniquement par les fonctions ci-dessous (pas d'insert / update / delete directs)
revoke all on public.climpilot_busy from public, anon, authenticated;
grant select on public.climpilot_busy to authenticated;

-- Remplace TOUTES les demi-journées d'une source sur la fenêtre [p_du, p_au] (au plus 120 jours, 400 lignes).
-- Appelée par la fonction « agenda » (service_role) pour Google, et par cp_busy_appli pour l'appli.
create or replace function public.cp_busy_remplacer(p_user uuid, p_source text, p_du date, p_au date, p_jours jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int := 0; j jsonb; v_jour date; v_m boolean; v_a boolean;
begin
  if p_user is null then raise exception 'utilisateur manquant'; end if;
  if p_source is null or p_source not in ('climpilot', 'google') then raise exception 'source inconnue'; end if;
  if p_du is null or p_au is null or p_au < p_du or p_au - p_du > 120 then raise exception 'fenêtre invalide'; end if;
  if p_jours is null or jsonb_typeof(p_jours) <> 'array' or jsonb_array_length(p_jours) > 400 then raise exception 'jours invalides'; end if;
  -- deux envois en même temps pour la même source : l'un après l'autre
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
  -- ménage : les jours passés de plus de 30 jours ne servent plus
  delete from public.climpilot_busy b where b.user_id = p_user and b.jour < current_date - 30;
  return n;
end $function$;
revoke execute on function public.cp_busy_remplacer(uuid, text, date, date, jsonb) from public, anon, authenticated;

-- Version de l'appli : utilisateur connecté, source « climpilot » seulement
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
