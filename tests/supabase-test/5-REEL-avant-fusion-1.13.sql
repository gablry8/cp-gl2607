-- =====================================================================
-- ClimPilot 1.13.0 — À COLLER SUR LE PROJET RÉEL, AVANT de fusionner la PR #5 (sauvegarde serveur)
-- Préparé le 25/10/2026 (relecture P10). Assemble, sans rien changer, l'étape A1-3 de docs/M0-MISE-EN-PRODUCTION.md.
-- Où : supabase.com › projet RÉEL (pas ClimPilot-TEST) › SQL Editor › nouvelle requête › coller TOUT › Run.
--
-- Ce que ça fait : 1) refuse de tourner sur le projet de TEST (marqueur climpilot_marqueur_test présent) ;
--                  2) copie l'état synchronisé actuel dans climpilot_backups, raison 'avant-1.13.0' (gardée 120 jours, règle existante) ;
--                  3) affiche les 3 dernières sauvegardes : la 1re ligne doit être 'avant-1.13.0', datée de maintenant. NOTE SON id.
-- Ne modifie AUCUNE fonction, AUCUNE table, AUCUNE donnée existante : une ligne de sauvegarde en plus, c'est tout.
-- =====================================================================
do $$ begin
  if to_regclass('public.climpilot_marqueur_test') is not null then
    raise exception 'STOP : marqueur climpilot_marqueur_test présent = projet de TEST. Ce script est pour le projet RÉEL. Rien n''a été fait.';
  end if;
  if to_regprocedure('public.cp_backup_row(uuid,jsonb,text)') is null then
    raise exception 'STOP : cp_backup_row absente : ce n''est pas la base ClimPilot attendue. Rien n''a été fait.';
  end if;
end $$;

select public.cp_backup_row(user_id, data, 'avant-1.13.0') from public.climpilot_state;

select id, raison, created_at, nb_devis, nb_clients, nb_dep, nb_loc
  from public.climpilot_backups order by id desc limit 3;
