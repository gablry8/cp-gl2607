-- Banc d'essai : imitation minimale de Supabase sur un PostgreSQL vierge (tests locaux uniquement).
-- Rôles anon / authenticated / service_role, schéma auth avec auth.uid() et auth.role()
-- lus dans request.jwt.claims (comme PostgREST), droits par défaut de Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', current_user::text) $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
-- FACT-0 (18/11/2026) : coffre minimal, imitation de Supabase Vault (extension supabase_vault 0.3.1, relue en lecture seule
-- le 18/11/2026 sur les deux projets) : mêmes noms et signatures (vault.secrets, vault.decrypted_secrets, vault.create_secret,
-- vault.update_secret) ; droits : service_role seulement, rien pour public, anon, authenticated (le rôle postgres du banc est
-- super-utilisateur). AUCUN CHIFFREMENT : le texte est seulement encodé (base64), pour que les tests voient qu'il n'est pas
-- rangé tel quel. Ajout seulement : rien au-dessus de ce bloc n'a changé.
create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text not null default '',
  secret text not null,
  key_id uuid,
  nonce bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists secrets_name_idx on vault.secrets (name) where name is not null;
create or replace view vault.decrypted_secrets as
  select s.id, s.name, s.description, s.secret, convert_from(decode(s.secret, 'base64'), 'UTF8') as decrypted_secret,
         s.key_id, s.nonce, s.created_at, s.updated_at
  from vault.secrets s;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '',
  new_key_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into vault.secrets (secret, name, description, key_id)
    values (encode(convert_to(new_secret, 'UTF8'), 'base64'), new_name, coalesce(new_description, ''), new_key_id)
    returning id into v_id;
  return v_id;
end $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
  new_description text default null, new_key_id uuid default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  update vault.secrets s set secret = coalesce(encode(convert_to(new_secret, 'UTF8'), 'base64'), s.secret),
    name = coalesce(new_name, s.name), description = coalesce(new_description, s.description),
    key_id = coalesce(new_key_id, s.key_id), updated_at = now()
  where s.id = update_secret.secret_id;
end $$;
revoke all on schema vault from public, anon, authenticated;
revoke all on all tables in schema vault from public, anon, authenticated;
revoke all on all functions in schema vault from public, anon, authenticated;
grant usage on schema vault to service_role;
grant select, delete on vault.secrets, vault.decrypted_secrets to service_role;
grant execute on function vault.create_secret(text, text, text, uuid), vault.update_secret(uuid, text, text, text, uuid) to service_role;
