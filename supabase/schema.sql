-- ClimPilot — base Supabase : COPIE DE LECTURE (relevée le 01/10/2026 sur le projet en ligne).
-- Sert à la relecture / vérification. La base en ligne fait foi. Aucun secret ici
-- (les clés sont dans les secrets Supabase et le client_secret Super PDP dans Supabase Vault).
-- L'e-mail autorisé à s'inscrire est masqué : <EMAIL_AUTORISE>.

-- ================= TABLES (schéma public, RLS activée sur toutes) =================
-- climpilot_state      : 1 ligne par utilisateur = TOUT l'état de l'appli (jsonb, clés cp2_* / cpnext_*)
--   user_id uuid PK, data jsonb, updated_at timestamptz
-- climpilot_backups    : copies de sécurité de climpilot_state (quotidienne, avant grosse modification, manuelle)
--   id bigint, user_id uuid, created_at timestamptz, raison text, data jsonb, taille int, nb_devis int, nb_clients int, nb_dep int, nb_loc int
-- climpilot_inbox      : propositions de l'assistant IA / notifications (signature) à valider dans l'appli
--   id uuid, user_id uuid, created_at, kind text, titre text, resume text, dictee text, payload jsonb, statut text, source text, traite_at
-- climpilot_ai_usage   : journal des appels à l'API Claude (coût, tokens) pour le plafond mensuel
--   id bigint, user_id uuid, created_at, modele text, in_tok int, out_tok int, cache_read int, cache_write int, cout_eur numeric, resultat text
-- climpilot_signatures : signature en ligne des devis / fiches fluides (jeton = lien unique)
--   token uuid, user_id uuid, created_at, expires_at, doc_type text, doc_id text, doc_num text, titre text, client_nom text,
--   montant_ttc numeric, doc_html text, doc_hash text, statut text, vu_at, signed_at, signer_nom text, signature_png text,
--   signer_ip text, signer_ua text, consentement text, motif_refus text, applique boolean
-- climpilot_catalogue  : catalogues fournisseurs (prévu ; vide)
--   user_id uuid, four text, part int, date text, n int, pub_only boolean, fichier text, rows jsonb, updated_at
-- climpilot_pdp        : connexion à la plateforme agréée Super PDP (le secret est dans Vault, seul son id est ici)
--   user_id uuid PK -> auth.users, client_id text, secret_id uuid, env text, company jsonb, updated_at

-- ================= POLITIQUES RLS =================
-- climpilot_state      : select / insert / update  si auth.uid() = user_id  (pas de delete)
-- climpilot_backups    : select si propriétaire ; insert si propriétaire ET raison in ('manuelle','avant_restauration')
-- climpilot_inbox      : select / insert / update / delete si propriétaire
-- climpilot_ai_usage   : select si propriétaire (écriture : service_role via la fonction assistant)
-- climpilot_signatures : select / update si propriétaire ; insert si propriétaire ET statut = 'en_attente'
-- climpilot_catalogue  : select / insert / update / delete si propriétaire
-- climpilot_pdp        : select si propriétaire (écriture : uniquement via pdp_cred_* en service_role)

-- ================= DÉCLENCHEURS =================
CREATE TRIGGER cp_state_backup BEFORE UPDATE ON public.climpilot_state FOR EACH ROW EXECUTE FUNCTION cp_state_backup_trg();
CREATE TRIGGER cp_block_signup BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION cp_block_signup();
CREATE TRIGGER cp_sig_insert BEFORE INSERT ON public.climpilot_signatures FOR EACH ROW EXECUTE FUNCTION cp_sig_insert();
CREATE TRIGGER cp_sig_guard BEFORE UPDATE ON public.climpilot_signatures FOR EACH ROW EXECUTE FUNCTION cp_sig_guard();

-- ================= FONCTIONS =================
-- Droits d'exécution : cp_state_push → authenticated ; pdp_cred_* / cp_* (security definer) → service_role uniquement ;
-- cp_arr_len → tous (fonction pure).

CREATE OR REPLACE FUNCTION public.cp_arr_len(j jsonb)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$ select case when jsonb_typeof(j) = 'array' then jsonb_array_length(j) else 0 end $function$;

CREATE OR REPLACE FUNCTION public.cp_backup_row(p_user uuid, p_data jsonb, p_raison text)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  insert into public.climpilot_backups (user_id, raison, data, taille, nb_devis, nb_clients, nb_dep, nb_loc)
  values (p_user, p_raison, p_data, pg_column_size(p_data),
          public.cp_arr_len(p_data->'cp2_devis'), public.cp_arr_len(p_data->'cp2_clients'),
          public.cp_arr_len(p_data->'cp2_dep'), public.cp_arr_len(p_data->'cp2_loc'));
$function$;

CREATE OR REPLACE FUNCTION public.cp_block_signup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if lower(coalesce(new.email, '')) not in ('<EMAIL_AUTORISE>') then
    raise exception 'Inscriptions fermées sur ClimPilot';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.cp_sig_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.cp_sig_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  new.doc_hash := encode(sha256(convert_to(new.doc_html, 'UTF8')), 'hex');
  new.signed_at := null; new.signer_nom := null; new.signature_png := null; new.signer_ip := null;
  new.signer_ua := null; new.consentement := null; new.vu_at := null; new.applique := false;
  if new.expires_at > now() + interval '120 days' then new.expires_at := now() + interval '90 days'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.cp_state_backup_trg()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  o_dev int := public.cp_arr_len(old.data->'cp2_devis');   n_dev int := public.cp_arr_len(new.data->'cp2_devis');
  o_cli int := public.cp_arr_len(old.data->'cp2_clients'); n_cli int := public.cp_arr_len(new.data->'cp2_clients');
  o_dep int := public.cp_arr_len(old.data->'cp2_dep');     n_dep int := public.cp_arr_len(new.data->'cp2_dep');
  o_loc int := public.cp_arr_len(old.data->'cp2_loc');     n_loc int := public.cp_arr_len(new.data->'cp2_loc');
begin
  if old.data is not distinct from new.data then return new; end if;
  -- filet anti-écrasement : grosse perte de données → on garde l'ancienne version
  if (o_dev - n_dev) >= 2 or (o_cli - n_cli) >= 2 or (o_dep - n_dep) >= 2 or (o_loc - n_loc) >= 2
     or (o_dev > 0 and n_dev = 0) or (o_cli > 0 and n_cli = 0)
     or pg_column_size(new.data) < pg_column_size(old.data) * 0.6 then
    perform public.cp_backup_row(old.user_id, old.data, 'avant_grosse_modification');
  end if;
  -- copie quotidienne (au plus une toutes les 20 h)
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

-- Écriture conditionnelle de l'état (synchro multi-appareils) : refuse d'écraser une version plus récente
CREATE OR REPLACE FUNCTION public.cp_state_push(p_data jsonb, p_expected timestamp with time zone DEFAULT NULL::timestamp with time zone, p_force boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $function$
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

-- Super PDP : identifiants (client_secret chiffré dans Supabase Vault) — service_role uniquement
CREATE OR REPLACE FUNCTION public.pdp_cred_set(p_user uuid, p_client_id text, p_secret text, p_env text, p_company jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'vault'
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
end $function$;

CREATE OR REPLACE FUNCTION public.pdp_cred_get(p_user uuid)
 RETURNS TABLE(client_id text, client_secret text, env text) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'vault'
AS $function$
  select p.client_id, s.decrypted_secret, p.env
  from public.climpilot_pdp p join vault.decrypted_secrets s on s.id = p.secret_id
  where p.user_id = p_user;
$function$;

CREATE OR REPLACE FUNCTION public.pdp_cred_delete(p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'vault'
AS $function$
declare v_old uuid;
begin
  select secret_id into v_old from public.climpilot_pdp where user_id = p_user;
  delete from public.climpilot_pdp where user_id = p_user;
  if v_old is not null then delete from vault.secrets where id = v_old; end if;
end $function$;

-- + rls_auto_enable() : déclencheur d'événement qui active la RLS sur toute nouvelle table du schéma public.
