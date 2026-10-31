-- =====================================================================
-- ClimPilot — AGENDA : RETOUR ARRIÈRE de la migration 20261020120000_agenda.sql
-- Préparé en M0 le 20/10/2026. À coller dans le SQL Editor du projet concerné (TEST d'abord, RÉEL seulement si
-- la mise en production doit être annulée), nouvelle requête, Run.
--
-- Ce qu'il retire : la table climpilot_busy (dates + cases matin/après-midi, AUCUNE donnée client) et les deux fonctions.
-- Ce qu'il ne touche pas : climpilot_state, climpilot_documents, climpilot_seq, sauvegardes, signatures — rien d'autre.
-- Perte à l'annulation : seulement les demi-journées occupées déjà envoyées (l'appli et le script Google les renverront).
-- Sans la table, l'appli coupe l'envoi toute seule, sans message d'erreur (docs/AGENDA.md).
-- Ce script est rejouable (if exists) : collé deux fois, la 2e fois ne fait rien.
-- =====================================================================
drop function if exists public.cp_busy_appli(date, date, jsonb);
drop function if exists public.cp_busy_remplacer(uuid, text, date, date, jsonb);
drop table if exists public.climpilot_busy;

-- VÉRIFICATION : 3 lignes « OK » attendues
select 'table climpilot_busy retirée' as controle, case when to_regclass('public.climpilot_busy') is null then 'OK' else 'ENCORE LÀ' end as etat
union all select 'fonction cp_busy_remplacer retirée', case when to_regprocedure('public.cp_busy_remplacer(uuid,text,date,date,jsonb)') is null then 'OK' else 'ENCORE LÀ' end
union all select 'fonction cp_busy_appli retirée', case when to_regprocedure('public.cp_busy_appli(date,date,jsonb)') is null then 'OK' else 'ENCORE LÀ' end;
