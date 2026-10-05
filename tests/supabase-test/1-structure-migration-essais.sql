-- =====================================================================
-- ClimPilot 1.10 — ESSAIS sur le projet « ClimPilot-TEST » UNIQUEMENT
-- À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › Run
-- VERROU : si ce projet contient déjà ClimPilot (= ton VRAI projet), le script
-- s'arrête ici, sans rien modifier.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_state') is not null then
    raise exception 'STOP : ce projet contient déjà ClimPilot. Ce n''est PAS le projet de test. Rien n''a été modifié.';
  end if;
end $$;
-- PARTIE 1 — structure actuelle (1.9), sans données
-- Banc d'essai : schéma de PRODUCTION actuel (relu en lecture seule le 02/10/2026 via le
-- connecteur Supabase : tables, règles RLS, fonctions et déclencheurs). Sert uniquement à
-- vérifier que la migration s'applique sur l'existant. Les données ne sont pas reprises,
-- ni le déclencheur de blocage des inscriptions (il contient l'adresse de Gabriel).
-- 03/10/2026 : comparé à supabase/schema.sql (copie de lecture venue de main, 665161f) ; ajoutés :
-- la rétention des sauvegardes (cp_state_backup_trg) et le déclencheur d'insertion cp_sig_insert.
-- Non repris (sans lien avec la migration) : pdp_cred_* (coffre Vault) et cp_block_signup.

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
  -- rétention : quotidiennes 45 j (+ 1 par mois gardée 13 mois), autres 120 j
  delete from public.climpilot_backups b
   where b.user_id = old.user_id and b.raison = 'quotidienne' and b.created_at < now() - interval '45 days'
     and b.id not in (select distinct on (date_trunc('month', x.created_at)) x.id from public.climpilot_backups x
                       where x.user_id = old.user_id and x.raison = 'quotidienne' order by date_trunc('month', x.created_at), x.created_at)
     or (b.user_id = old.user_id and b.raison = 'quotidienne' and b.created_at < now() - interval '13 months');
  delete from public.climpilot_backups b
   where b.user_id = old.user_id and b.raison <> 'quotidienne' and b.created_at < now() - interval '120 days';
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
create function public.cp_sig_insert() returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  new.doc_hash := encode(sha256(convert_to(new.doc_html, 'UTF8')), 'hex');
  new.signed_at := null; new.signer_nom := null; new.signature_png := null; new.signer_ip := null;
  new.signer_ua := null; new.consentement := null; new.vu_at := null; new.applique := false;
  if new.expires_at > now() + interval '120 days' then new.expires_at := now() + interval '90 days'; end if;
  return new;
end $function$;
create trigger cp_sig_insert before insert on public.climpilot_signatures for each row execute function public.cp_sig_insert();

-- ajouts pour le projet de TEST (tables de production non reprises par le banc local)
create table public.climpilot_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  kind text, titre text, resume text, dictee text, payload jsonb, statut text, source text, traite_at timestamptz
);
alter table public.climpilot_inbox enable row level security;
create policy inbox_select on public.climpilot_inbox for select using ((select auth.uid()) = user_id);
create policy inbox_insert on public.climpilot_inbox for insert with check ((select auth.uid()) = user_id);
create policy inbox_update on public.climpilot_inbox for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy inbox_delete on public.climpilot_inbox for delete using ((select auth.uid()) = user_id);

-- =====================================================================
-- PARTIE 3 — ESSAIS AUTOMATIQUES (projet de TEST uniquement)
-- Deux utilisateurs fictifs, résultats dans public.zz_resultats.
-- =====================================================================
create table if not exists public.zz_resultats (n serial primary key, phase text, test text, ok boolean, detail text, le timestamptz default now());
grant select, insert on public.zz_resultats to authenticated, anon;
grant usage on sequence public.zz_resultats_n_seq to authenticated, anon;
create or replace function public.zz_ok(p_phase text, p_test text, p_ok boolean, p_detail text default '') returns void
language sql as $f$ insert into public.zz_resultats(phase,test,ok,detail) values (p_phase,p_test,coalesce(p_ok,false),left(coalesce(p_detail,''),400)) $f$;
grant execute on function public.zz_ok(text,text,boolean,text) to authenticated, anon;

-- utilisateurs fictifs
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','essai-a@exemple.invalid','',now(),now(),'{}','{}'),
       ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','essai-b@exemple.invalid','',now(),now(),'{}','{}')
on conflict (id) do nothing;

-- ---------- PHASE A : base actuelle (1.9.x), AVANT la migration ----------
do $$
declare r jsonb; v_ok boolean;
begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  execute 'set local role authenticated';
  -- appli 1.9.x : premier envoi de l'état
  begin
    r := public.cp_state_push(p_data=>'{"cp2_devis":[{"id":"d1"}],"cp2_clients":[{"id":"c1"}]}'::jsonb, p_expected=>null, p_force=>false);
    perform public.zz_ok('A','1.9.x : cp_state_push (3 paramètres) accepté avant migration', (r->>'ok')::boolean, r::text);
  exception when others then perform public.zz_ok('A','1.9.x : cp_state_push (3 paramètres) accepté avant migration', false, sqlerrm); end;
  -- écriture directe de l'état (possible aujourd'hui)
  begin
    update public.climpilot_state set data = data || '{"note":"directe"}'::jsonb where user_id = '11111111-1111-4111-8111-111111111111';
    perform public.zz_ok('A','écriture directe de l''état possible avant migration (constat)', true, '');
  exception when others then perform public.zz_ok('A','écriture directe de l''état possible avant migration (constat)', false, sqlerrm); end;
  execute 'reset role';
end $$;

-- PARTIE 2 — migration 1.10 (fichier du dépôt)
-- ============================================================
-- ClimPilot 1.10 — migration « documents émis » (factures, avoirs)
-- ÉTAT : préparée, NON APPLIQUÉE en production.
-- À appliquer d'abord sur un projet Supabase de TEST, puis en production
-- seulement après validation de Gabriel (voir docs/CORRECTIONS-1.10.md).
--
-- 1. Numérotation + enregistrement définitif en UNE transaction
--    (cp_emettre_document) : un numéro n'existe jamais sans sa facture,
--    une même demande (request_id) rejouée renvoie la même facture.
-- 2. Registre figé côté serveur : payload complet, fichiers HTML/XML écrits
--    une seule fois ; ni modification ni suppression (RLS + déclencheurs).
-- 3. Paiements et statuts dans une table d'événements à part (ajout seul).
-- 4. Anciennes factures importées comme « reconstituées » (jamais
--    présentées comme identiques au document envoyé à l'époque).
-- 5. Synchronisation : cp_state_push exige la version de l'appli (>= 1.10)
--    et l'écriture directe de climpilot_state est retirée, pour qu'une
--    ancienne version restée ouverte ne puisse plus rien écraser.
-- 6. Signature en ligne : colonnes de preuve de remise de l'exemplaire.
-- 7. Durcissement : TRUNCATE retiré aux rôles anon / authenticated
--    (TRUNCATE n'est pas soumis aux règles RLS).
-- ============================================================

-- ---------- 1. tables ----------
create table if not exists public.climpilot_seq (
  user_id uuid not null references auth.users(id),
  serie text not null check (serie in ('F','AV')),
  annee int not null check (annee between 2000 and 2100),
  dernier int not null default 0 check (dernier >= 0),
  maj_le timestamptz not null default now(),
  primary key (user_id, serie, annee)
);

create table if not exists public.climpilot_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  serie text not null check (serie in ('F','AV')),
  annee int not null check (annee between 2000 and 2100),
  numero int not null check (numero > 0),
  num text not null,
  type text not null check (type in ('facture','acompte','avoir')),
  origine text not null default 'emis' check (origine in ('emis','reconstitue')),
  date_doc date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text not null,
  html text check (html is null or length(html) < 600000),
  xml text check (xml is null or length(xml) < 600000),
  fichiers_hash text,
  fichiers_le timestamptz,
  client_version text,
  cree_le timestamptz not null default now(),
  unique (user_id, request_id),
  check ((serie = 'AV') = (type = 'avoir'))
);
-- un numéro émis est unique dans sa série et son année (les anciennes factures
-- reconstituées peuvent contenir des doublons historiques : elles sont gardées toutes)
create unique index if not exists climpilot_documents_numero_emis
  on public.climpilot_documents (user_id, serie, annee, numero) where origine = 'emis';
create index if not exists climpilot_documents_user_num on public.climpilot_documents (user_id, num);

create table if not exists public.climpilot_doc_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  document_id uuid not null references public.climpilot_documents(id),
  request_id uuid not null,
  type text not null check (type in ('paiement','paiement_annule','paiement_irregulier','regularisation',
                                     'statut_pdp','envoi_pdp','avoir','remise_exemplaire','note')),
  donnees jsonb not null default '{}'::jsonb check (jsonb_typeof(donnees) = 'object'),
  cree_le timestamptz not null default now(),
  unique (user_id, request_id)
);

alter table public.climpilot_seq enable row level security;
alter table public.climpilot_documents enable row level security;
alter table public.climpilot_doc_events enable row level security;

-- lecture de ses propres lignes seulement ; aucune écriture directe (tout passe par les fonctions)
drop policy if exists docs_select on public.climpilot_documents;
create policy docs_select on public.climpilot_documents for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists events_select on public.climpilot_doc_events;
create policy events_select on public.climpilot_doc_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists seq_select on public.climpilot_seq;
create policy seq_select on public.climpilot_seq for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.climpilot_seq, public.climpilot_documents, public.climpilot_doc_events from anon;
revoke insert, update, delete, truncate, references, trigger on public.climpilot_seq, public.climpilot_documents, public.climpilot_doc_events from authenticated;
grant select on public.climpilot_seq, public.climpilot_documents, public.climpilot_doc_events to authenticated;

-- ---------- 2. protections : un document émis ne se modifie ni ne se supprime ----------
create or replace function public.cp_docs_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un document émis ne se supprime pas (corriger par un avoir).' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.request_id is distinct from old.request_id
     or new.serie is distinct from old.serie or new.annee is distinct from old.annee or new.numero is distinct from old.numero
     or new.num is distinct from old.num or new.type is distinct from old.type or new.origine is distinct from old.origine
     or new.date_doc is distinct from old.date_doc or new.payload is distinct from old.payload
     or new.payload_hash is distinct from old.payload_hash or new.cree_le is distinct from old.cree_le
     or new.client_version is distinct from old.client_version then
    raise exception 'Un document émis ne se modifie pas.' using errcode = '42501';
  end if;
  -- fichiers : écrits une seule fois
  if old.fichiers_hash is not null and (new.fichiers_hash is distinct from old.fichiers_hash
       or new.html is distinct from old.html or new.xml is distinct from old.xml or new.fichiers_le is distinct from old.fichiers_le) then
    raise exception 'Les fichiers émis ne se remplacent pas.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists cp_docs_guard on public.climpilot_documents;
create trigger cp_docs_guard before update or delete on public.climpilot_documents
  for each row execute function public.cp_docs_guard();

create or replace function public.cp_events_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Le journal des événements est en ajout seul.' using errcode = '42501';
end $$;
drop trigger if exists cp_events_guard on public.climpilot_doc_events;
create trigger cp_events_guard before update or delete on public.climpilot_doc_events
  for each row execute function public.cp_events_guard();

create or replace function public.cp_seq_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Compteur non supprimable.' using errcode = '42501'; end if;
  if new.dernier < old.dernier then raise exception 'Un compteur ne recule jamais.' using errcode = '42501'; end if;
  return new;
end $$;
drop trigger if exists cp_seq_guard on public.climpilot_seq;
create trigger cp_seq_guard before update or delete on public.climpilot_seq
  for each row execute function public.cp_seq_guard();

-- ---------- 3. fonctions ----------
create or replace function public.cp_num_txt(p_serie text, p_annee int, p_numero int) returns text
language sql immutable set search_path = '' as $$
  select p_serie || '-' || p_annee::text || '-' ||
         case when p_numero < 1000 then lpad(p_numero::text, 3, '0') else p_numero::text end
$$;

create or replace function public.cp_doc_json(d public.climpilot_documents) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'request_id', d.request_id, 'serie', d.serie, 'annee', d.annee,
    'numero', d.numero, 'num', d.num, 'type', d.type, 'origine', d.origine, 'date_doc', d.date_doc,
    'payload', d.payload, 'payload_hash', d.payload_hash, 'fichiers_hash', d.fichiers_hash, 'cree_le', d.cree_le)
$$;

create or replace function public.cp_version_ok(p_version text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_version ~ '^\d+\.\d+' and
    (split_part(p_version, '.', 1)::int > 1 or
     (split_part(p_version, '.', 1)::int = 1 and split_part(regexp_replace(p_version, '^(\d+\.\d+).*$', '\1'), '.', 2)::int >= 10)), false)
$$;

-- capacités du serveur (l'appli s'en sert pour savoir si le mode réel est possible)
create or replace function public.cp_serveur_info() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('documents', true, 'version', '1.10', 'date_serveur', (now() at time zone 'Europe/Paris')::date)
$$;

-- ÉMISSION : numéro + enregistrement définitif dans la même transaction, idempotente par request_id
create or replace function public.cp_emettre_document(
  p_request_id uuid, p_serie text, p_type text, p_date date, p_payload jsonb,
  p_min_numero int default 0, p_client_version text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.climpilot_documents;
  v_an int; v_last int; v_max int; v_num int;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  if v_uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  if not public.cp_version_ok(p_client_version) then
    raise exception 'ClimPilot doit être mis à jour (version 1.10 ou plus récente).' using errcode = 'P0001';
  end if;
  if p_request_id is null then raise exception 'request_id manquant'; end if;
  -- demande déjà traitée (double clic, nouvelle tentative, réponse perdue) : même document
  select * into v_doc from public.climpilot_documents where user_id = v_uid and request_id = p_request_id;
  if found then return jsonb_build_object('ok', true, 'deja', true, 'doc', public.cp_doc_json(v_doc)); end if;

  if p_serie not in ('F','AV') then raise exception 'série inconnue'; end if;
  if p_type not in ('facture','acompte','avoir') or ((p_serie = 'AV') <> (p_type = 'avoir')) then raise exception 'type incohérent'; end if;
  if p_date is null or p_date < v_jour - 1 or p_date > v_jour + 1 then
    raise exception 'date du document hors de la journée en cours (horloge de l''appareil ?)';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 300000 then
    raise exception 'contenu du document invalide';
  end if;
  if coalesce(p_min_numero, 0) < 0 then raise exception 'numéro minimal invalide'; end if;

  v_an := extract(year from p_date)::int;
  insert into public.climpilot_seq (user_id, serie, annee, dernier) values (v_uid, p_serie, v_an, 0)
    on conflict (user_id, serie, annee) do nothing;
  select s.dernier into v_last from public.climpilot_seq s
    where s.user_id = v_uid and s.serie = p_serie and s.annee = v_an for update;
  -- après le verrou : la même demande a pu être servie entre-temps
  select * into v_doc from public.climpilot_documents where user_id = v_uid and request_id = p_request_id;
  if found then return jsonb_build_object('ok', true, 'deja', true, 'doc', public.cp_doc_json(v_doc)); end if;

  select coalesce(max(d.numero), 0) into v_max from public.climpilot_documents d
    where d.user_id = v_uid and d.serie = p_serie and d.annee = v_an;
  v_num := greatest(v_last, v_max, coalesce(p_min_numero, 0)) + 1;
  update public.climpilot_seq set dernier = v_num, maj_le = now()
    where user_id = v_uid and serie = p_serie and annee = v_an;
  insert into public.climpilot_documents (user_id, request_id, serie, annee, numero, num, type, origine, date_doc,
      payload, payload_hash, client_version)
    values (v_uid, p_request_id, p_serie, v_an, v_num, public.cp_num_txt(p_serie, v_an, v_num), p_type, 'emis', p_date,
      p_payload, encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex'), p_client_version)
    returning * into v_doc;
  return jsonb_build_object('ok', true, 'deja', false, 'doc', public.cp_doc_json(v_doc));
end $$;

-- FICHIERS ÉMIS (PDF en HTML + XML) : écrits une seule fois ; même contenu rejoué = accepté
create or replace function public.cp_document_fichiers(p_id uuid, p_html text, p_xml text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_doc public.climpilot_documents; v_h text;
begin
  if v_uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  select * into v_doc from public.climpilot_documents where id = p_id and user_id = v_uid for update;
  if not found then raise exception 'document introuvable' using errcode = '42501'; end if;
  if p_html is null or length(p_html) < 50 then raise exception 'fichier PDF (HTML) manquant'; end if;
  v_h := encode(sha256(convert_to(coalesce(p_html, '') || E'\n--xml--\n' || coalesce(p_xml, ''), 'UTF8')), 'hex');
  if v_doc.fichiers_hash is not null then
    if v_doc.fichiers_hash = v_h then return jsonb_build_object('ok', true, 'deja', true, 'fichiers_hash', v_h); end if;
    raise exception 'Les fichiers de ce document sont déjà enregistrés (contenu différent).' using errcode = '42501';
  end if;
  update public.climpilot_documents set html = p_html, xml = p_xml, fichiers_hash = v_h, fichiers_le = now() where id = p_id;
  return jsonb_build_object('ok', true, 'deja', false, 'fichiers_hash', v_h);
end $$;

-- ÉVÉNEMENTS (paiement, statut de la plateforme…) : ajout seul, idempotent par request_id
create or replace function public.cp_document_evenement(p_request_id uuid, p_document_id uuid, p_type text, p_donnees jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id bigint;
begin
  if v_uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  if not exists (select 1 from public.climpilot_documents where id = p_document_id and user_id = v_uid) then
    raise exception 'document introuvable' using errcode = '42501';
  end if;
  select id into v_id from public.climpilot_doc_events where user_id = v_uid and request_id = p_request_id;
  if found then return jsonb_build_object('ok', true, 'deja', true, 'id', v_id); end if;
  insert into public.climpilot_doc_events (user_id, document_id, request_id, type, donnees)
    values (v_uid, p_document_id, p_request_id, p_type, coalesce(p_donnees, '{}'::jsonb)) returning id into v_id;
  return jsonb_build_object('ok', true, 'deja', false, 'id', v_id);
end $$;

-- ANCIENNES FACTURES (émises avant la 1.10) : importées comme « reconstituées », sans toucher au compteur
create or replace function public.cp_importer_ancien(p_request_id uuid, p_serie text, p_type text, p_num text, p_date date, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_doc public.climpilot_documents; v_m text[];
begin
  if v_uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  select * into v_doc from public.climpilot_documents where user_id = v_uid and request_id = p_request_id;
  if found then return jsonb_build_object('ok', true, 'deja', true, 'doc', public.cp_doc_json(v_doc)); end if;
  v_m := regexp_match(coalesce(p_num, ''), '^(F|AV)-(\d{4})-(\d+)$');
  if v_m is null or v_m[1] <> p_serie then raise exception 'numéro ancien non reconnu : %', p_num; end if;
  if p_type not in ('facture','acompte','avoir') or ((p_serie = 'AV') <> (p_type = 'avoir')) then raise exception 'type incohérent'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'contenu invalide'; end if;
  insert into public.climpilot_documents (user_id, request_id, serie, annee, numero, num, type, origine, date_doc, payload, payload_hash)
    values (v_uid, p_request_id, p_serie, v_m[2]::int, v_m[3]::int, p_num, p_type, 'reconstitue', coalesce(p_date, current_date),
            p_payload, encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex'))
    returning * into v_doc;
  return jsonb_build_object('ok', true, 'deja', false, 'doc', public.cp_doc_json(v_doc));
end $$;

revoke all on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) from public, anon;
revoke all on function public.cp_document_fichiers(uuid, text, text) from public, anon;
revoke all on function public.cp_document_evenement(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.cp_importer_ancien(uuid, text, text, text, date, jsonb) from public, anon;
grant execute on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) to authenticated;
grant execute on function public.cp_document_fichiers(uuid, text, text) to authenticated;
grant execute on function public.cp_document_evenement(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.cp_importer_ancien(uuid, text, text, text, date, jsonb) to authenticated;
revoke all on function public.cp_serveur_info() from anon;
grant execute on function public.cp_serveur_info() to authenticated;

-- ---------- 5. synchronisation : version minimale, plus d'écriture directe ----------
drop function if exists public.cp_state_push(jsonb, timestamptz, boolean);
create or replace function public.cp_state_push(p_data jsonb, p_expected timestamptz default null,
  p_force boolean default false, p_client_version text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cur timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if not public.cp_version_ok(p_client_version) then
    raise exception 'ClimPilot doit être mis à jour (version 1.10 ou plus récente) avant de synchroniser.' using errcode = 'P0001';
  end if;
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
end $$;
revoke all on function public.cp_state_push(jsonb, timestamptz, boolean, text) from public, anon;
grant execute on function public.cp_state_push(jsonb, timestamptz, boolean, text) to authenticated;
-- l'état ne s'écrit plus que par cp_state_push (lecture directe conservée)
drop policy if exists ins on public.climpilot_state;
drop policy if exists upd on public.climpilot_state;
revoke insert, update, delete, truncate on public.climpilot_state from anon, authenticated;

-- ---------- 6. signature en ligne : preuve de remise de l'exemplaire ----------
alter table public.climpilot_signatures add column if not exists support_durable_accord boolean;
alter table public.climpilot_signatures add column if not exists copie_le timestamptz;
alter table public.climpilot_signatures add column if not exists copie_nb int not null default 0;
-- la preuve de remise ne peut être écrite que par la fonction serveur « signature » (rôle service),
-- jamais par le compte de l'entreprise : même garde que pour la signature elle-même
create or replace function public.cp_sig_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then return new; end if;
  if new.doc_html is distinct from old.doc_html or new.doc_hash is distinct from old.doc_hash
     or new.signed_at is distinct from old.signed_at or new.signer_nom is distinct from old.signer_nom
     or new.signature_png is distinct from old.signature_png or new.signer_ip is distinct from old.signer_ip
     or new.consentement is distinct from old.consentement or new.expires_at is distinct from old.expires_at
     or new.token is distinct from old.token or new.user_id is distinct from old.user_id
     or new.support_durable_accord is distinct from old.support_durable_accord
     or new.copie_le is distinct from old.copie_le or new.copie_nb is distinct from old.copie_nb then
    raise exception 'modification interdite';
  end if;
  if new.statut is distinct from old.statut and not (old.statut = 'en_attente' and new.statut = 'annule') then
    raise exception 'changement de statut interdit';
  end if;
  return new;
end $$;
-- à la création du lien, le compte ne peut pas non plus inscrire d'avance l'accord ni une remise :
-- déclencheur d'insertion de la production (copie dans supabase/schema.sql) + les trois nouvelles colonnes
create or replace function public.cp_sig_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.doc_hash := encode(sha256(convert_to(new.doc_html, 'UTF8')), 'hex');
  new.signed_at := null; new.signer_nom := null; new.signature_png := null; new.signer_ip := null;
  new.signer_ua := null; new.consentement := null; new.vu_at := null; new.applique := false;
  new.support_durable_accord := null; new.copie_le := null; new.copie_nb := 0;
  if new.expires_at > now() + interval '120 days' then new.expires_at := now() + interval '90 days'; end if;
  return new;
end $$;

-- fonctions de déclencheur : jamais appelables directement par l'API (alerte du conseiller Supabase
-- relevée sur le projet de test le 05/10/2026 ; déjà le cas en production, rappelé ici par sécurité)
revoke all on function public.cp_sig_guard() from public, anon, authenticated;
revoke all on function public.cp_sig_insert() from public, anon, authenticated;
revoke all on function public.cp_docs_guard() from public, anon, authenticated;
revoke all on function public.cp_events_guard() from public, anon, authenticated;
revoke all on function public.cp_seq_guard() from public, anon, authenticated;

-- ---------- 7. durcissement : TRUNCATE ne passe pas par RLS ----------
revoke truncate on all tables in schema public from anon, authenticated;

-- ---------- PHASE B : APRÈS la migration 1.10 ----------
do $$
declare
  r jsonb; r2 jsonb; t text;
  ua uuid := '11111111-1111-4111-8111-111111111111';
  ub uuid := '22222222-2222-4222-8222-222222222222';
  j date := (now() at time zone 'Europe/Paris')::date;
  y text := extract(year from (now() at time zone 'Europe/Paris'))::int::text;
  v_doc uuid; v_ts timestamptz; n int;
  rid1 uuid := gen_random_uuid(); rid2 uuid := gen_random_uuid(); rid3 uuid := gen_random_uuid();
  V text := '1.10.0-beta';
  H text := repeat('<p>facture figée</p>', 10);
begin
  -- ===== utilisateur A =====
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  execute 'set local role authenticated';

  begin r := public.cp_serveur_info();
    perform public.zz_ok('B','cp_serveur_info : documents = true, date de Paris', (r->>'documents')::boolean and (r->>'date_serveur')::date = j, r::text);
  exception when others then perform public.zz_ok('B','cp_serveur_info', false, sqlerrm); end;

  -- synchro : ancienne appli refusée, 1.10 acceptée
  begin r := public.cp_state_push(p_data=>'{"x":1}'::jsonb, p_expected=>null, p_force=>false);
    perform public.zz_ok('B','appli 1.9.x (sans version) refusée par cp_state_push', false, 'ACCEPTÉE : '||r::text);
  exception when others then perform public.zz_ok('B','appli 1.9.x (sans version) refusée par cp_state_push, message clair', sqlerrm ilike '%mis à jour%', sqlerrm); end;
  begin r := public.cp_state_push(p_data=>'{"x":1}'::jsonb, p_expected=>null, p_force=>false, p_client_version=>'1.9.1');
    perform public.zz_ok('B','version 1.9.1 refusée', false, 'ACCEPTÉE : '||r::text);
  exception when others then perform public.zz_ok('B','version 1.9.1 refusée', true, sqlerrm); end;
  begin select s.updated_at into v_ts from public.climpilot_state s where s.user_id = ua;
    r := public.cp_state_push(p_data=>'{"cp2_devis":[{"id":"d1"}],"cp2_clients":[{"id":"c1"}],"v":110}'::jsonb, p_expected=>v_ts, p_force=>false, p_client_version=>V);
    perform public.zz_ok('B','appli 1.10 : synchro acceptée', (r->>'ok')::boolean, r::text);
    r := public.cp_state_push(p_data=>'{"cp2_devis":[],"v":111}'::jsonb, p_expected=>v_ts, p_force=>false, p_client_version=>V);
    perform public.zz_ok('B','appli 1.10 : version périmée → conflit renvoyé, rien écrasé', (r->>'ok')::boolean = false and r ? 'data', left(r::text,200));
  exception when others then perform public.zz_ok('B','appli 1.10 : synchro', false, sqlerrm); end;
  begin perform public.zz_ok('B','comparaison de versions (1.9.9 non, 1.10 oui, 1.10.0-beta oui, 2.0 oui, vide non)',
      not public.cp_version_ok('1.9.9') and public.cp_version_ok('1.10') and public.cp_version_ok('1.10.0-beta') and public.cp_version_ok('2.0')
      and not coalesce(public.cp_version_ok(null),false) and not public.cp_version_ok('abc'), '');
  exception when others then perform public.zz_ok('B','comparaison de versions', false, sqlerrm); end;
  begin update public.climpilot_state set data = '{}'::jsonb where user_id = ua;
    perform public.zz_ok('B','écriture directe de l''état refusée', false, 'ACCEPTÉE');
  exception when others then perform public.zz_ok('B','écriture directe de l''état refusée', sqlstate = '42501', sqlstate||' '||sqlerrm); end;

  -- émission des factures
  begin r := public.cp_emettre_document(rid1,'F','facture',j,'{"essai":1}'::jsonb,0,V); v_doc := (r->'doc'->>'id')::uuid;
    perform public.zz_ok('B','1re facture = F-'||y||'-001', r->'doc'->>'num' = 'F-'||y||'-001' and (r->>'deja')::boolean = false, r->'doc'->>'num');
    r2 := public.cp_emettre_document(rid1,'F','facture',j,'{"essai":"autre contenu"}'::jsonb,0,V);
    perform public.zz_ok('B','même demande rejouée (double clic / réponse perdue) → même facture, contenu d''origine', (r2->>'deja')::boolean and r2->'doc'->>'id' = v_doc::text and r2->'doc'->'payload'->>'essai' = '1', r2->'doc'->>'num');
    r := public.cp_emettre_document(rid2,'F','facture',j,'{"essai":2}'::jsonb,0,V);
    perform public.zz_ok('B','2e facture = F-'||y||'-002', r->'doc'->>'num' = 'F-'||y||'-002', r->'doc'->>'num');
  exception when others then perform public.zz_ok('B','émission des factures', false, sqlerrm); end;
  begin r := public.cp_emettre_document(gen_random_uuid(),'F','facture',j-5,'{}'::jsonb,0,V);
    perform public.zz_ok('B','date hors de la journée refusée', false, 'ACCEPTÉE '||(r->'doc'->>'num'));
  exception when others then perform public.zz_ok('B','date hors de la journée refusée', sqlerrm ilike '%journée%', sqlerrm); end;
  begin r := public.cp_emettre_document(gen_random_uuid(),'F','facture',j,'{}'::jsonb,0,null);
    perform public.zz_ok('B','émission sans version refusée', false, 'ACCEPTÉE '||(r->'doc'->>'num'));
  exception when others then perform public.zz_ok('B','émission sans version refusée', true, sqlerrm); end;
  begin r := public.cp_emettre_document(gen_random_uuid(),'F','avoir',j,'{}'::jsonb,0,V);
    perform public.zz_ok('B','type incohérent (série F, avoir) refusé', false, 'ACCEPTÉ');
  exception when others then perform public.zz_ok('B','type incohérent (série F, avoir) refusé', true, sqlerrm); end;
  begin r := public.cp_emettre_document(gen_random_uuid(),'AV','avoir',j,'{"av":1}'::jsonb,0,V);
    perform public.zz_ok('B','1er avoir = AV-'||y||'-001 (série séparée)', r->'doc'->>'num' = 'AV-'||y||'-001', r->'doc'->>'num');
  exception when others then perform public.zz_ok('B','avoir', false, sqlerrm); end;

  -- fichiers figés et événements
  begin r := public.cp_document_fichiers(v_doc, H, '<xml/>');
    r2 := public.cp_document_fichiers(v_doc, H, '<xml/>');
    perform public.zz_ok('B','fichiers déposés une fois ; même contenu rejoué accepté', (r->>'deja')::boolean = false and (r2->>'deja')::boolean, '');
  exception when others then perform public.zz_ok('B','fichiers déposés', false, sqlerrm); end;
  begin r := public.cp_document_fichiers(v_doc, H||'<p>modifié</p>', '<xml/>');
    perform public.zz_ok('B','fichiers différents refusés (pas de remplacement)', false, 'ACCEPTÉ');
  exception when others then perform public.zz_ok('B','fichiers différents refusés (pas de remplacement)', true, sqlerrm); end;
  begin r := public.cp_document_evenement(rid3, v_doc, 'paiement', '{"mode":"virement"}'::jsonb);
    r2 := public.cp_document_evenement(rid3, v_doc, 'paiement', '{"mode":"virement"}'::jsonb);
    perform public.zz_ok('B','paiement enregistré une seule fois (rejoué = même événement)', (r->>'deja')::boolean = false and (r2->>'deja')::boolean and r->>'id' = r2->>'id', '');
  exception when others then perform public.zz_ok('B','événement paiement', false, sqlerrm); end;
  begin insert into public.climpilot_documents (user_id, request_id, serie, annee, numero, num, type, date_doc, payload, payload_hash)
      values (ua, gen_random_uuid(), 'F', y::int, 99, 'F-'||y||'-099', 'facture', j, '{}', 'x');
    perform public.zz_ok('B','insertion directe d''une facture refusée', false, 'ACCEPTÉE');
  exception when others then perform public.zz_ok('B','insertion directe d''une facture refusée', sqlstate = '42501', sqlstate||' '||sqlerrm); end;
  begin truncate public.climpilot_documents;
    perform public.zz_ok('B','TRUNCATE refusé', false, 'ACCEPTÉ');
  exception when others then perform public.zz_ok('B','TRUNCATE refusé', sqlstate = '42501', sqlstate||' '||sqlerrm); end;

  -- ancienne facture importée (choix explicite) puis numérotation
  begin r := public.cp_importer_ancien(gen_random_uuid(),'F','facture','F-'||y||'-006', j, '{"reconstitue":true}'::jsonb);
    perform public.zz_ok('B','ancienne facture importée « reconstituée »', r->'doc'->>'origine' = 'reconstitue', r->'doc'->>'num');
    r := public.cp_emettre_document(gen_random_uuid(),'F','facture',j,'{"essai":3}'::jsonb,0,V);
    perform public.zz_ok('B','après import de F-'||y||'-006 : la suivante est F-'||y||'-007 (continuité, constat)', r->'doc'->>'num' = 'F-'||y||'-007', r->'doc'->>'num');
  exception when others then perform public.zz_ok('B','import ancien', false, sqlerrm); end;

  -- ===== utilisateur B : cloisonnement =====
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  begin select count(*) into n from public.climpilot_documents;
    perform public.zz_ok('B','utilisateur B ne voit aucune facture de A', n = 0, n::text);
    r := public.cp_emettre_document(gen_random_uuid(),'F','facture',j,'{"b":1}'::jsonb,0,V);
    perform public.zz_ok('B','utilisateur B : sa propre série commence à 001', r->'doc'->>'num' = 'F-'||y||'-001', r->'doc'->>'num');
  exception when others then perform public.zz_ok('B','cloisonnement B', false, sqlerrm); end;
  begin r := public.cp_document_fichiers(v_doc, H, '<xml/>');
    perform public.zz_ok('B','B ne peut pas toucher aux fichiers de A', false, 'ACCEPTÉ');
  exception when others then perform public.zz_ok('B','B ne peut pas toucher aux fichiers de A', true, sqlerrm); end;
  begin r := public.cp_document_evenement(gen_random_uuid(), v_doc, 'paiement', '{}'::jsonb);
    perform public.zz_ok('B','B ne peut pas ajouter un paiement sur une facture de A', false, 'ACCEPTÉ');
  exception when others then perform public.zz_ok('B','B ne peut pas ajouter un paiement sur une facture de A', true, sqlerrm); end;
  execute 'reset role';

  -- ===== rôle « postgres » (contourne RLS) : les déclencheurs protègent quand même =====
  begin update public.climpilot_documents set payload = '{"triche":1}' where id = v_doc;
    perform public.zz_ok('B','facture émise non modifiable, même par l''administrateur', false, 'MODIFIÉE');
  exception when others then perform public.zz_ok('B','facture émise non modifiable, même par l''administrateur', true, sqlerrm); end;
  begin delete from public.climpilot_documents where id = v_doc;
    perform public.zz_ok('B','facture émise non supprimable, même par l''administrateur', false, 'SUPPRIMÉE');
  exception when others then perform public.zz_ok('B','facture émise non supprimable, même par l''administrateur', true, sqlerrm); end;
  begin update public.climpilot_seq set dernier = 0 where user_id = ua and serie = 'F';
    perform public.zz_ok('B','compteur qui ne recule jamais', false, 'RECULÉ');
  exception when others then perform public.zz_ok('B','compteur qui ne recule jamais', true, sqlerrm); end;
  begin update public.climpilot_doc_events set donnees = '{}' where document_id = v_doc;
    perform public.zz_ok('B','journal des paiements en ajout seul', false, 'MODIFIÉ');
  exception when others then perform public.zz_ok('B','journal des paiements en ajout seul', true, sqlerrm); end;

  -- ===== visiteur anonyme =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  begin r := public.cp_emettre_document(gen_random_uuid(),'F','facture',j,'{}'::jsonb,0,V);
    perform public.zz_ok('B','visiteur anonyme : émission impossible', false, 'ACCEPTÉE');
  exception when others then perform public.zz_ok('B','visiteur anonyme : émission impossible', true, sqlerrm); end;
  begin select count(*) into n from public.climpilot_documents;
    perform public.zz_ok('B','visiteur anonyme : registre illisible', n = 0, n::text);
  exception when others then perform public.zz_ok('B','visiteur anonyme : registre illisible', true, sqlerrm); end;
  execute 'reset role';

  -- ===== signature en ligne : preuve de remise protégée =====
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  execute 'set local role authenticated';
  begin insert into public.climpilot_signatures (doc_type, doc_id, doc_num, doc_html, support_durable_accord, copie_nb, copie_le)
      values ('devis','d1','DV-ESSAI','<p>devis</p>', true, 5, now()) returning token::text into t;
    select count(*) into n from public.climpilot_signatures where token = t::uuid and support_durable_accord is null and copie_nb = 0 and copie_le is null;
    perform public.zz_ok('B','lien de signature : remise et accord ne peuvent pas être inscrits d''avance', n = 1, '');
    begin update public.climpilot_signatures set copie_nb = 3 where token = t::uuid;
      perform public.zz_ok('B','remise de l''exemplaire non falsifiable par le compte', false, 'MODIFIÉE');
    exception when others then perform public.zz_ok('B','remise de l''exemplaire non falsifiable par le compte', sqlerrm ilike '%interdite%', sqlerrm); end;
    update public.climpilot_signatures set statut = 'annule' where token = t::uuid;
    perform public.zz_ok('B','annulation d''un lien en attente toujours possible', true, '');
  exception when others then perform public.zz_ok('B','signature', false, sqlerrm); end;
  execute 'reset role';
end $$;

-- résumé
select phase, count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echoues from public.zz_resultats group by phase order by phase;
