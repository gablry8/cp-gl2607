-- Banc d'essai : schéma de PRODUCTION actuel (relu en lecture seule le 02/10/2026 via le
-- connecteur Supabase : tables, règles RLS, fonctions et déclencheurs). Sert uniquement à
-- vérifier que la migration s'applique sur l'existant. Les données ne sont pas reprises,
-- ni le déclencheur de blocage des inscriptions (il contient l'adresse de Gabriel).

create table public.climpilot_state (
  user_id uuid primary key references auth.users(id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.climpilot_backups (
  id bigserial primary key,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  raison text not null default 'quotidienne',
  data jsonb not null,
  taille int, nb_devis int, nb_clients int, nb_dep int, nb_loc int
);
create table public.climpilot_signatures (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  doc_type text not null check (doc_type in ('devis','fluide')),
  doc_id text not null, doc_num text, titre text, client_nom text, montant_ttc numeric,
  doc_html text not null check (length(doc_html) < 400000),
  doc_hash text,
  statut text not null default 'en_attente' check (statut in ('en_attente','signe','refuse','annule')),
  vu_at timestamptz, signed_at timestamptz, signer_nom text, signature_png text, signer_ip text, signer_ua text,
  consentement text, motif_refus text, applique boolean not null default false
);
alter table public.climpilot_state enable row level security;
alter table public.climpilot_backups enable row level security;
alter table public.climpilot_signatures enable row level security;
create policy ins on public.climpilot_state for insert with check (auth.uid() = user_id);
create policy sel on public.climpilot_state for select using (auth.uid() = user_id);
create policy upd on public.climpilot_state for update using (auth.uid() = user_id);
create policy backups_insert on public.climpilot_backups for insert with check (((select auth.uid()) = user_id) and (raison = any (array['manuelle','avant_restauration'])));
create policy backups_select on public.climpilot_backups for select using ((select auth.uid()) = user_id);
create policy sig_insert on public.climpilot_signatures for insert with check (((select auth.uid()) = user_id) and (statut = 'en_attente'));
create policy sig_select on public.climpilot_signatures for select using ((select auth.uid()) = user_id);
create policy sig_update on public.climpilot_signatures for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.cp_arr_len(j jsonb) returns integer language sql immutable set search_path to ''
as $function$ select case when jsonb_typeof(j) = 'array' then jsonb_array_length(j) else 0 end $function$;

create function public.cp_backup_row(p_user uuid, p_data jsonb, p_raison text) returns void language sql security definer set search_path to ''
as $function$
  insert into public.climpilot_backups (user_id, raison, data, taille, nb_devis, nb_clients, nb_dep, nb_loc)
  values (p_user, p_raison, p_data, pg_column_size(p_data),
          public.cp_arr_len(p_data->'cp2_devis'), public.cp_arr_len(p_data->'cp2_clients'),
          public.cp_arr_len(p_data->'cp2_dep'), public.cp_arr_len(p_data->'cp2_loc'));
$function$;
revoke all on function public.cp_backup_row(uuid, jsonb, text) from public, anon, authenticated;

create function public.cp_state_backup_trg() returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  o_dev int := public.cp_arr_len(old.data->'cp2_devis');   n_dev int := public.cp_arr_len(new.data->'cp2_devis');
  o_cli int := public.cp_arr_len(old.data->'cp2_clients'); n_cli int := public.cp_arr_len(new.data->'cp2_clients');
  o_dep int := public.cp_arr_len(old.data->'cp2_dep');     n_dep int := public.cp_arr_len(new.data->'cp2_dep');
  o_loc int := public.cp_arr_len(old.data->'cp2_loc');     n_loc int := public.cp_arr_len(new.data->'cp2_loc');
begin
  if old.data is not distinct from new.data then return new; end if;
  if (o_dev - n_dev) >= 2 or (o_cli - n_cli) >= 2 or (o_dep - n_dep) >= 2 or (o_loc - n_loc) >= 2
     or (o_dev > 0 and n_dev = 0) or (o_cli > 0 and n_cli = 0)
     or pg_column_size(new.data) < pg_column_size(old.data) * 0.6 then
    perform public.cp_backup_row(old.user_id, old.data, 'avant_grosse_modification');
  end if;
  if not exists (select 1 from public.climpilot_backups b where b.user_id = old.user_id
                 and b.raison = 'quotidienne' and b.created_at > now() - interval '20 hours') then
    perform public.cp_backup_row(old.user_id, old.data, 'quotidienne');
  end if;
  return new;
end $function$;
revoke all on function public.cp_state_backup_trg() from public, anon, authenticated;
create trigger cp_state_backup before update on public.climpilot_state for each row execute function public.cp_state_backup_trg();

create function public.cp_state_push(p_data jsonb, p_expected timestamp with time zone default null::timestamp with time zone, p_force boolean default false)
returns jsonb language plpgsql set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_cur timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'données invalides'; end if;
  select s.updated_at into v_cur from public.climpilot_state s where s.user_id = v_uid for update;
  if not found then
    insert into public.climpilot_state (user_id, data, updated_at) values (v_uid, p_data, v_now);
    return jsonb_build_object('ok', true, 'updated_at', v_now);
  end if;
  if not p_force and (p_expected is null or v_cur is distinct from p_expected) then
    return jsonb_build_object('ok', false, 'updated_at', v_cur,
      'data', (select s.data from public.climpilot_state s where s.user_id = v_uid));
  end if;
  update public.climpilot_state set data = p_data, updated_at = v_now where user_id = v_uid;
  return jsonb_build_object('ok', true, 'updated_at', v_now);
end $function$;
revoke all on function public.cp_state_push(jsonb, timestamptz, boolean) from anon;

create function public.cp_sig_guard() returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then return new; end if;
  if new.doc_html is distinct from old.doc_html or new.doc_hash is distinct from old.doc_hash
     or new.signed_at is distinct from old.signed_at or new.signer_nom is distinct from old.signer_nom
     or new.signature_png is distinct from old.signature_png or new.signer_ip is distinct from old.signer_ip
     or new.consentement is distinct from old.consentement or new.expires_at is distinct from old.expires_at
     or new.token is distinct from old.token or new.user_id is distinct from old.user_id then
    raise exception 'modification interdite';
  end if;
  if new.statut is distinct from old.statut and not (old.statut = 'en_attente' and new.statut = 'annule') then
    raise exception 'changement de statut interdit';
  end if;
  return new;
end $function$;
create trigger cp_sig_guard before update on public.climpilot_signatures for each row execute function public.cp_sig_guard();
