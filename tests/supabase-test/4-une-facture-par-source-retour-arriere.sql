-- =====================================================================
-- ClimPilot — C1 : RETOUR ARRIÈRE de la migration 20261021180000_une_facture_par_source.sql
-- À coller dans le SQL Editor du projet concerné (TEST d'abord ; RÉEL seulement si la correction doit être annulée), Run.
-- Ce qu'il fait : remet cp_emettre_document EXACTEMENT dans sa version 1.10 (copie de 20261002120000_documents_emis.sql),
-- retire cp_nombre et le commentaire. Rien d'autre : aucune table, aucune donnée, aucun document touché.
-- Conséquence : le serveur n'empêche plus une 2e facture pour la même source (l'appli, elle, garde son propre contrôle).
-- Rejouable.
-- =====================================================================
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

comment on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) is null;
revoke all on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) from public, anon, authenticated;
grant execute on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) to authenticated;
drop function if exists public.cp_nombre(text);

-- VÉRIFICATION : 2 lignes « OK » attendues
select 'cp_nombre retirée' as controle, case when to_regprocedure('public.cp_nombre(text)') is null then 'OK' else 'ENCORE LÀ' end as etat
union all select 'cp_emettre_document version 1.10 (sans commentaire C1)', case when obj_description(to_regprocedure('public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)'),'pg_proc') is null then 'OK' else 'ENCORE C1' end;
