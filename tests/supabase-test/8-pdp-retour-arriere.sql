-- =====================================================================
-- ClimPilot — FACT-0 : RETOUR ARRIÈRE de tests/supabase-test/8-pdp-TEST.sql, sur « ClimPilot-TEST » UNIQUEMENT.
-- Préparé le 18/11/2026. À coller dans : supabase.com › projet ClimPilot-TEST › SQL Editor › nouvelle requête › Run.
--
-- VERROU : comme le script 8-pdp-TEST.sql, il ne fait rien sans la table-marqueur public.climpilot_marqueur_test
-- (projet de TEST seulement). Sur le réel, ces objets existaient avant FACT-0 : ce script ne doit jamais y tourner.
--
-- Ce qu'il fait : retire les trois fonctions pdp_cred_set, pdp_cred_get, pdp_cred_delete et la table climpilot_pdp,
-- SEULEMENT si la table est vide. Si une connexion à la plateforme y est enregistrée, il s'arrête (STOP) sans rien
-- retirer : sa valeur secrète resterait sinon dans le coffre, sans plus rien pour la retrouver ni l'effacer.
-- Dans ce cas : copie d'essai › Facture électronique › « Déconnecter » (efface la ligne ET la valeur du coffre), puis
-- recolle ce script.
-- Ce qu'il ne touche pas : le coffre lui-même, les autres tables, aucune donnée.
-- Attendu : 4 lignes « OK ». Rejouable : collé deux fois, la 2e fois affiche les mêmes 4 lignes « OK ».
-- Pour réinstaller ensuite : recoller 8-pdp-TEST.sql.
-- =====================================================================
do $$
declare n bigint;
begin
  if to_regclass('public.climpilot_marqueur_test') is null then
    raise exception 'STOP : pas de marqueur climpilot_marqueur_test. Ce n''est PAS le projet de test. Rien n''a été modifié.';
  end if;
  if to_regclass('public.climpilot_pdp') is not null then
    execute 'select count(*) from public.climpilot_pdp' into n;
    if n > 0 then
      raise exception 'STOP : climpilot_pdp n''est pas vide (% ligne(s)) : une connexion à la plateforme y est enregistrée. Déconnecte-la d''abord dans la copie d''essai (Facture électronique › Déconnecter), puis recolle ce script. Rien n''a été modifié.', n;
    end if;
  end if;
end $$;

drop function if exists public.pdp_cred_set(uuid, text, text, text, jsonb);
drop function if exists public.pdp_cred_get(uuid);
drop function if exists public.pdp_cred_delete(uuid);
drop table if exists public.climpilot_pdp;

-- ---------------------------------------------------------------------
-- VÉRIFICATIONS : 4 lignes attendues, TOUTES « OK »
-- ---------------------------------------------------------------------
select controle, etat from (
  select 1 as o, 'pdp_cred_set retirée' as controle,
    case when to_regprocedure('public.pdp_cred_set(uuid,text,text,text,jsonb)') is null then 'OK' else 'À REVOIR' end as etat
  union all select 2, 'pdp_cred_get retirée',
    case when to_regprocedure('public.pdp_cred_get(uuid)') is null then 'OK' else 'À REVOIR' end
  union all select 3, 'pdp_cred_delete retirée',
    case when to_regprocedure('public.pdp_cred_delete(uuid)') is null then 'OK' else 'À REVOIR' end
  union all select 4, 'table climpilot_pdp retirée',
    case when to_regclass('public.climpilot_pdp') is null then 'OK' else 'À REVOIR' end
) v order by o;
