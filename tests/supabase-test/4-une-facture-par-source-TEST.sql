-- =====================================================================
-- ClimPilot — C1 (une seule facture vivante par source) : ESSAI sur « ClimPilot-TEST » UNIQUEMENT
-- Préparé le 21/10/2026 (mission F, C1). À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › nouvelle requête › Run
--
-- VERROU : le script ne fait rien tant que la table-marqueur public.climpilot_marqueur_test n'existe pas.
-- Ce marqueur n'existe que sur le projet de TEST : tu le crées UNE fois, après avoir vérifié le nom du projet
-- dans l'adresse de la page (ClimPilot-TEST), avec cette seule ligne :
--     create table public.climpilot_marqueur_test (note text);
-- Le projet RÉEL n'a jamais ce marqueur : collé par erreur dans le réel, ce script s'arrête sans rien modifier.
--
-- Contenu : 1) verrou ; 2) la migration supabase/migrations/20261021180000_une_facture_par_source.sql, telle quelle (rejouable) ;
--           3) vérifications (la requête finale doit afficher 5 lignes « OK »). Aucune donnée n'est écrite : les contrôles
--           n'appellent pas la fonction (ils lisent sa définition et ses droits).
-- Retour arrière : tests/supabase-test/4-une-facture-par-source-retour-arriere.sql
-- Sur le RÉEL (après l'essai) : coller directement supabase/migrations/20261021180000_une_facture_par_source.sql, puis la partie 3).
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is null then
    raise exception 'STOP : pas de marqueur climpilot_marqueur_test. Ce n''est PAS le projet de test (ou le marqueur n''est pas encore créé). Rien n''a été modifié.';
  end if;
  if to_regprocedure('public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)') is null then
    raise exception 'STOP : cp_emettre_document (1.10) absente : applique d''abord la migration 20261002120000_documents_emis.sql.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) MIGRATION (copie conforme de supabase/migrations/20261021180000_une_facture_par_source.sql)
-- ---------------------------------------------------------------------
-- ============================================================
-- ClimPilot — C1 (M3, 21/10/2026) : UNE SEULE FACTURE VIVANTE PAR SOURCE dans cp_emettre_document
--
-- Constat (relecture M3 d'Opus, reproduit) : quand le registre des factures ne se lit pas depuis un appareil, l'appli
-- laissait partir l'émission ; le serveur n'avait aucune règle « une seule facture de solde par chantier » : un téléphone
-- pas à jour pouvait émettre un 2e solde, ou un solde qui ignorait l'acompte. L'appli refuse désormais d'émettre sans avoir
-- lu le registre (next-emission.js) ET le serveur refuse de lui-même, ici, une 2e facture vivante pour la même source.
--
-- Ce que fait cette migration (rejouable : create or replace) :
--   1. cp_nombre(text) : lecture tolérante d'un nombre du payload (null si absent ou illisible).
--   2. cp_emettre_document(…) : même signature, même comportement qu'en 1.10 (idempotence par request_id, date J±1,
--      version, numérotation) + la règle, appliquée APRÈS le verrou de numérotation :
--      - une facture F vivante existe déjà pour la même source (k, id, w)        → ok:false, raison 'deja_facture', doc = elle ;
--      - solde de devis alors qu'un acompte vivant existe et que le montant du solde ≠ total − acompte (±0,011)
--                                                                                → ok:false, raison 'acompte_ignore', doc = l'acompte ;
--      - acompte de devis alors qu'un solde vivant existe                        → ok:false, raison 'solde_deja_emis', doc = le solde.
--      « Vivante » = aucun avoir TOTAL (émis ou reconstitué/importé) ne porte son numéro. Un avoir partiel ne libère pas. Les factures
--      « reconstituées » (anciennes, importées) ne comptent pas comme vivantes. Les avoirs (série AV) et les payloads sans source ne sont pas concernés.
--      Un refus ne consomme aucun numéro et n'écrit rien.
--   3. Droits explicites : revoke … from public, anon, authenticated ; grant … to authenticated (M4 C19 : toujours nommer public).
-- Retour arrière : tests/supabase-test/4-une-facture-par-source-retour-arriere.sql (remet la fonction 1.10 telle quelle).
-- Tests : tests/sql/test_une_facture_par_source.py (PostgreSQL local), tests/suiteAA-registre-illisible.mjs (banc deux appareils).
-- À appliquer sur ClimPilot-TEST d'abord (tests/supabase-test/4-une-facture-par-source-TEST.sql), puis sur le réel : geste de Gabriel.
-- ============================================================

create or replace function public.cp_nombre(p text) returns numeric
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^-?\d+(\.\d+)?$' then return null; end if;
  return p::numeric;
end $$;
revoke all on function public.cp_nombre(text) from public, anon, authenticated;

create or replace function public.cp_emettre_document(
  p_request_id uuid, p_serie text, p_type text, p_date date, p_payload jsonb,
  p_min_numero int default 0, p_client_version text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.climpilot_documents;
  v_an int; v_last int; v_max int; v_num int;
  v_ex public.climpilot_documents; v_k text; v_id text; v_w text; v_total numeric; v_montant numeric; v_acompte numeric;
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

  -- C1 (M3, 21/10/2026) — UNE SEULE FACTURE VIVANTE PAR SOURCE (série F seulement ; les avoirs ne sont pas concernés).
  -- Source = payload->'src' : {k: devis|dep|loc|ctr, id, w: acompte|solde|''|année}. Une facture est « vivante » tant
  -- qu'aucun avoir TOTAL (type avoir, émis ou reconstitué, payload->'fac'->>'total' = 'true') ne porte son numéro dans payload->'src'->>'w'.
  -- Refus = ok:false + raison + la facture existante (l'appli la reprend, comme quand le registre la lui montre) ; aucun numéro consommé.
  -- Verrou consultatif par utilisateur : deux demandes simultanées pour la même source ne passent pas toutes les deux
  -- (le verrou de climpilot_seq est par année : deux dates à cheval sur le 1er janvier ne le partageraient pas).
  if p_serie = 'F' and jsonb_typeof(p_payload->'src') = 'object' and coalesce(p_payload->'src'->>'k', '') <> '' then
    perform pg_advisory_xact_lock(hashtext('cp_emettre_document|' || v_uid::text));
    v_k := p_payload->'src'->>'k'; v_id := coalesce(p_payload->'src'->>'id', ''); v_w := coalesce(p_payload->'src'->>'w', '');
    select d.* into v_ex from public.climpilot_documents d
      where d.user_id = v_uid and d.serie = 'F' and d.origine = 'emis' and d.request_id <> p_request_id
        and d.payload->'src'->>'k' = v_k and coalesce(d.payload->'src'->>'id', '') = v_id and coalesce(d.payload->'src'->>'w', '') = v_w
        and not exists (select 1 from public.climpilot_documents a
                          where a.user_id = v_uid and a.serie = 'AV'
                            and a.payload->'fac'->>'total' = 'true'
                            and split_part(coalesce(a.payload->'src'->>'w', ''), '|', 1) = d.num)
      order by d.cree_le desc limit 1;
    if found then
      return jsonb_build_object('ok', false, 'raison', 'deja_facture', 'doc', public.cp_doc_json(v_ex));
    end if;
    if v_k = 'devis' and v_w in ('acompte', 'solde') then
      -- l'autre facture vivante du même devis (acompte si on demande un solde, solde si on demande un acompte)
      select d.* into v_ex from public.climpilot_documents d
        where d.user_id = v_uid and d.serie = 'F' and d.origine = 'emis' and d.request_id <> p_request_id
          and d.payload->'src'->>'k' = 'devis' and coalesce(d.payload->'src'->>'id', '') = v_id
          and coalesce(d.payload->'src'->>'w', '') = case when v_w = 'solde' then 'acompte' else 'solde' end
          and not exists (select 1 from public.climpilot_documents a
                            where a.user_id = v_uid and a.serie = 'AV'
                              and a.payload->'fac'->>'total' = 'true'
                              and split_part(coalesce(a.payload->'src'->>'w', ''), '|', 1) = d.num)
        order by d.cree_le desc limit 1;
      if found then
        if v_w = 'acompte' then
          -- un acompte après le solde facturerait deux fois la même somme
          return jsonb_build_object('ok', false, 'raison', 'solde_deja_emis', 'doc', public.cp_doc_json(v_ex));
        end if;
        -- un solde doit déduire l'acompte vivant : montant du solde = total − acompte (au centime, arrondi de l'appareil toléré)
        v_total := public.cp_nombre(p_payload->'fac'->>'total');
        v_montant := public.cp_nombre(p_payload->'fac'->>'montant');
        v_acompte := public.cp_nombre(v_ex.payload->'fac'->>'montant');
        if v_total is null or v_montant is null or v_acompte is null or abs((v_total - v_acompte) - v_montant) > 0.011 then
          return jsonb_build_object('ok', false, 'raison', 'acompte_ignore', 'doc', public.cp_doc_json(v_ex));
        end if;
      end if;
    end if;
  end if;

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

comment on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) is
  'C1 (21/10/2026) : une seule facture vivante par source (payload->src) ; solde cohérent avec l''acompte vivant ; refus = ok:false + raison + document existant.';
revoke all on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) from public, anon, authenticated;
grant execute on function public.cp_emettre_document(uuid, text, text, date, jsonb, int, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3) VÉRIFICATIONS : 5 lignes « OK » attendues
-- ---------------------------------------------------------------------
select 'cp_nombre présente' as controle, case when to_regprocedure('public.cp_nombre(text)') is not null then 'OK' else 'ABSENTE' end as etat
union all select 'cp_emettre_document présente', case when to_regprocedure('public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)') is not null then 'OK' else 'ABSENTE' end
union all select 'cp_emettre_document : version C1 (commentaire)', case when coalesce(obj_description(to_regprocedure('public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)'),'pg_proc'),'') like 'C1 (21/10/2026)%' then 'OK' else 'PAS C1' end
union all select 'cp_emettre_document : règle « une facture vivante par source » dans le code', case when pg_get_functiondef(to_regprocedure('public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)')) like '%deja_facture%' and pg_get_functiondef(to_regprocedure('public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)')) like '%acompte_ignore%' then 'OK' else 'RÈGLE ABSENTE' end
union all select 'droits : anon bloqué, authenticated autorisé', case when not has_function_privilege('anon','public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)','execute') and has_function_privilege('authenticated','public.cp_emettre_document(uuid,text,text,date,jsonb,int,text)','execute') and not has_function_privilege('anon','public.cp_nombre(text)','execute') then 'OK' else 'À REVOIR' end;
