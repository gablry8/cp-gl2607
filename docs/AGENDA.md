# Agenda ClimPilot ⇄ site ⇄ Google Agenda (préparé le 20/10/2026, rien d'installé)

But (choix de Gabriel du 19/10/2026) : **ne jamais avoir deux clients au même moment**.

```
ClimPilot (planning, demi-journées) ──cp_busy_appli──▶ climpilot_busy (source climpilot)
Google Agenda ──script toutes les 15 min──▶ fonction agenda (POST) ──▶ climpilot_busy (source google)
fonction agenda ?creneaux=1 ──▶ page Réserver du site : seuls les moments libres
fonction agenda ?occupations=1 ──▶ script ──▶ agenda Google « ClimPilot (occupé) »
```

Seules des **dates et deux cases (matin, après-midi)** circulent : aucun nom, aucune adresse, aucun titre d'événement.

## Ce qui change dans ClimPilot (branche `claude/planning-20-10`)
- Chaque intervention du planning a un **moment** : Matin, Après-midi ou Journée. Sans choix : **Journée** (prudent).
  On le change d'un clic sur le petit bouton de la carte au planning, ou dans le devis (carte « Planning »).
- Deux interventions qui se chevauchent le même jour : carte bordée de rouge « ⚠ même moment que … ».
- **Planifier** sur un moment déjà pris (ClimPilot ou Google) : ClimPilot demande confirmation.
- Les moments pris dans Google s'affichent au planning (« 📅 Agenda Google — matin pris »).
- Envoi automatique des demi-journées occupées (60 jours) quand le planning change. Tant que la migration n'est pas
  appliquée, l'envoi se coupe tout seul, sans message d'erreur.
- Limite connue : un chantier de plusieurs jours n'occupe que sa date de début (comme avant). À traiter si besoin.

## Installation, dans l'ordre (TEST d'abord, avec l'accord de Gabriel)
1. **Base** : coller `essai-agenda-TEST.sql` (fourni à part : migration + verrou TEST) dans le SQL Editor du projet
   ClimPilot-TEST, dans une **nouvelle** requête.
2. **Fonction** : déployer `supabase/functions/agenda` sur TEST, `verify_jwt = false`. Secrets :
   - `OWNER_USER_ID` : identifiant du compte de Gabriel sur ce projet ;
   - `AGENDA_CLE` : clé aléatoire d'au moins 24 caractères (générée pour l'occasion, jamais dans le dépôt) ;
   - `SITE_ORIGINS` : adresse(s) du site, séparées par des virgules ;
   - `AGENDA_FERME` (facultatif) : jours fermés, ex. `2027-08-02..2027-08-20,2027-12-24`.
   Vérifier : `GET …/functions/v1/agenda?sante=1` → `{"ok":true}`.
3. **Script Google** : script.google.com > Nouveau projet > coller `tools/apps-script/ClimPilot-Agenda.gs` >
   Paramètres du projet > Propriétés du script : `AGENDA_URL`, `AGENDA_CLE` (et `AGENDAS_LUS` si plusieurs agendas).
   Exécuter **installer** une fois et accepter les autorisations. Un agenda « ClimPilot (occupé) » apparaît.
4. **Site** : `creneauxEndpoint: 'https://<projet>.supabase.co/functions/v1/agenda?creneaux=1'` dans `build.mjs`,
   regénérer. La page Réserver ne propose plus que les moments libres (repli sur le calcul local si la fonction ne répond pas).
5. Essai : planifier un chantier un mardi matin dans ClimPilot → dans les 15 min, « ClimPilot — occupé (matin) »
   dans Google, et le mardi matin grisé sur la page Réserver ; un rendez-vous perso dans Google un jeudi après-midi →
   au planning de ClimPilot et grisé sur le site.

## Repères techniques
- Demi-journées (script Google) : matin 7 h – 12 h 30, après-midi 12 h 30 – 19 h ; le soir ne bloque pas le site.
  Ignorés : événements « Disponible », invitations refusées, événements créés par le script.
- `climpilot_busy` : écriture seulement par `cp_busy_remplacer` (service_role) et `cp_busy_appli` (compte connecté,
  source climpilot) ; fenêtre ≤ 120 jours, envois concurrents l'un après l'autre (verrou), ménage au-delà de 30 jours.
- Tests : `tests/functions/test-agenda.mjs` (fonction), `tests/functions/test-apps-script.mjs` (script, faux Google),
  `tests/sql/test_agenda.py` (PostgreSQL), `tests/suiteS-planning.mjs` (appli).
