-- =====================================================================
-- ClimPilot — PREUVE-SIGNATURE : RETOUR ARRIÈRE de la migration 20261115120000_preuve_signature.sql
-- Préparé le 15/11/2026. À coller dans le SQL Editor du projet concerné (TEST d'abord ; RÉEL seulement si la
-- correction doit être annulée), nouvelle requête, Run.
--
-- Ce qu'il fait : remet la fonction public.cp_sig_guard telle qu'elle a été lue (en lecture seule) sur le projet réel
-- et sur ClimPilot-TEST le 15/11/2026 : même en-tête (security definer, search_path vide), même code, sans commentaire.
-- Seule différence possible : les fins de ligne (le texte en ligne a des fins de ligne Windows, invisibles) ; les
-- vérifications comparent le code sans elles.
-- Ce qu'il ne touche pas : le déclencheur cp_sig_guard, cp_sig_insert, les règles d'accès, les droits, aucune donnée.
-- Rejouable : collé deux fois, la 2e fois ne change rien.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_signatures') is null or to_regprocedure('public.cp_sig_guard()') is null then
    raise exception 'STOP : table climpilot_signatures ou fonction cp_sig_guard absente : ce n''est pas la base ClimPilot attendue. Rien n''a été modifié.';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.cp_sig_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

comment on function public.cp_sig_guard() is null;
revoke all on function public.cp_sig_guard() from public, anon, authenticated;

-- VÉRIFICATION : 3 lignes « OK » attendues
select 'cp_sig_guard : code lu sur le réel le 15/11/2026 (empreinte 01fa989c…)' as controle,
  case when (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.cp_sig_guard()'::regprocedure)
            = '01fa989c59f024f00666b9fb48e2d769' then 'OK' else 'À REVOIR' end as etat
union all select 'cp_sig_guard : en-tête d''avant (security definer, search_path vide, sans commentaire)',
  case when exists (select 1 from pg_proc where oid = 'public.cp_sig_guard()'::regprocedure and prosecdef
                    and proconfig = array['search_path=""'])
        and obj_description('public.cp_sig_guard()'::regprocedure, 'pg_proc') is null then 'OK' else 'À REVOIR' end
union all select 'déclencheur cp_sig_guard toujours en place (avant chaque modification, ligne par ligne, actif)',
  case when exists (select 1 from pg_trigger t where t.tgrelid = 'public.climpilot_signatures'::regclass and t.tgname = 'cp_sig_guard'
                    and t.tgfoid = 'public.cp_sig_guard()'::regprocedure and t.tgtype = 19 and t.tgenabled = 'O') then 'OK' else 'À REVOIR' end;
