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

-- ---------- 7. durcissement : TRUNCATE ne passe pas par RLS ----------
revoke truncate on all tables in schema public from anon, authenticated;
