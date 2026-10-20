# ClimPilot — M0 : fiche de mise en production (branche `fusion/avant-refonte`)

> Rédigée le 20/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy. À lire avec `M0-COMPTE-RENDU.md`.
> Rien ici n'a été fait par l'IA sur le projet réel ni sur le projet de TEST : **chaque étape est ton geste**.
> Ordre : TEST d'abord (étapes 1 à 4 sur ClimPilot-TEST + copie d'essai), puis seulement le RÉEL.
> Les libellés de menus Supabase/GitHub sont donnés de mémoire (hypothèse) : si un libellé diffère à l'écran, c'est l'écran qui a raison.

## 0. Ce qui change pour toi, en une ligne chacun
- Appli : 1.11 (Objectifs & feux), 1.12 (rentabilité, SAV, avis, banque, fluides, raccourcis, synchro plus sûre), fiabilité (émission « résultat inconnu », sauvegarde, encaissement, boîte de réception), optimisation (bibliothèques embarquées, ouverture plus rapide sur réseau faible), planning par demi-journée + messages + terrain.
- Serveur : **une** migration (table `climpilot_busy` + 2 fonctions SQL) et **une** fonction serveur `agenda` (pour le site et Google Agenda ; l'appli ne l'appelle pas).
- Si tu ne fais **que** fusionner dans `main` sans toucher au serveur : l'appli marche quand même ; seul l'envoi des demi-journées occupées se coupe tout seul, sans message (certain, lu dans `next-planning.js` l. 108). Tu peux donc faire le serveur plus tard.

## 1. AVANT (10 min)
1. **Appareils synchronisés** : sur le PC puis sur le téléphone, ouvre ClimPilot, attends que l'icône de synchro soit au repos (pas de « modifications en attente »). Si un appareil est hors ligne depuis longtemps, ouvre-le d'abord et laisse-le se synchroniser.
2. **Sauvegarde manuelle ClimPilot** : Outils › **⤓ Sauvegarde** (export complet) → garde le fichier hors du téléphone (PC + clé/cloud).
3. **Sauvegarde serveur** (SQL Editor du projet **RÉEL**, nouvelle requête) :
   ```sql
   select public.cp_backup_row(user_id, data, 'avant-mise-en-production-M0') from public.climpilot_state;
   select id, raison, created_at, nb_devis, nb_clients, nb_dep, nb_loc from public.climpilot_backups order by id desc limit 3;
   ```
   Attendu : une ligne `avant-mise-en-production-M0` datée de maintenant, avec tes nombres de devis/clients. **Note l'`id`** (pour le retour arrière). Cette sauvegarde est gardée 120 jours (règle existante du serveur).
4. **Protection de `main`** (GitHub › Settings › Branches) : pas obligatoire pour cette mise en production, mais c'est le moment de l'activer (fusion interdite si tests rouges) — voir REFONTE-PLAN P0.

## 2. MIGRATION SQL (1 seule) — d'abord sur TEST, puis sur le RÉEL
Fichier source : `supabase/migrations/20261020120000_agenda.sql` (rejouable : coller deux fois ne casse rien).

**Sur ClimPilot-TEST** (une seule fois, la première) : crée le marqueur après avoir vérifié « ClimPilot-TEST » dans l'adresse de la page :
```sql
create table public.climpilot_marqueur_test (note text);
```
puis colle **tout** `tests/supabase-test/3-agenda-TEST.sql` (verrou + migration + 6 contrôles). Attendu : 6 lignes « OK ». Collé par erreur dans le réel, il s'arrête sur « STOP » sans rien modifier (éprouvé sur un PostgreSQL local).

**Sur le RÉEL** (après l'essai sur TEST) : colle `supabase/migrations/20261020120000_agenda.sql` tel quel, puis la vérification :
```sql
select 'table' as c, to_regclass('public.climpilot_busy') is not null as ok
union all select 'cp_busy_appli', to_regprocedure('public.cp_busy_appli(date,date,jsonb)') is not null
union all select 'cp_busy_remplacer', to_regprocedure('public.cp_busy_remplacer(uuid,text,date,date,jsonb)') is not null
union all select 'anon bloqué', not has_function_privilege('anon','public.cp_busy_appli(date,date,jsonb)','execute');
```
Attendu : 4 lignes `true`.

**Retour arrière de la migration** : `tests/supabase-test/3-agenda-retour-arriere.sql` (retire la table et les 2 fonctions, rien d'autre ; 3 contrôles « OK »). Perte : seulement les demi-journées occupées déjà envoyées (dates, aucun nom) — l'appli et le script Google les renvoient.

## 3. FONCTION SERVEUR `agenda` (facultative pour l'appli ; nécessaire pour le site « Réserver » et Google Agenda)
Source : `supabase/functions/agenda/index.ts`. À déployer **sans vérification JWT** (`verify_jwt = false`, comme `signature`).
- Tableau de bord Supabase › Edge Functions › nouvelle fonction `agenda` › coller le fichier › décocher « Verify JWT » (hypothèse sur le libellé) ; ou en ligne de commande depuis le dépôt : `supabase functions deploy agenda --project-ref <réf du projet> --no-verify-jwt`.
- Secrets (Edge Functions › Secrets), **valeurs à toi, jamais dans le dépôt** : `OWNER_USER_ID` (Authentication › Users › ton identifiant), `AGENDA_CLE` (clé aléatoire ≥ 24 caractères, générée pour l'occasion), `SITE_ORIGINS` (adresse(s) du site, séparées par des virgules), `AGENDA_FERME` (facultatif). `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.
- **Test de vie** (navigateur ou curl) : `https://<réf>.supabase.co/functions/v1/agenda?sante=1` → `{"ok":true}` (200). `{"ok":false,"erreur":"config"}` (503) = un secret manque ; `{"ok":false}` (503) = la migration n'est pas appliquée.
- Test public : `…/agenda?creneaux=1` → `{"ok":true,"jours":[…10 jours ouvrés…]}`.
- Ensuite seulement : script Google (`docs/AGENDA.md` étape 3) et site (étape 4).
- **Retour arrière** : supprimer la fonction `agenda` (tableau de bord, ou `supabase functions delete agenda --project-ref <réf>`). L'appli n'en dépend pas.

## 4. FUSION DANS `main` (= publication sur GitHub Pages, sur tous tes appareils)
1. La demande de fusion `fusion/avant-refonte → main` est en **brouillon** : lis `M0-COMPTE-RENDU.md`, puis « Ready for review » et « Merge » (**merge commit**, pas squash, pour garder l'historique des 5 fusions).
2. Attends la publication GitHub Pages (1 à 3 min ; onglet Actions ou Settings › Pages).
3. Sur **chaque** appareil : ouvre ClimPilot, F5 (ou ferme/rouvre l'appli). Le nouveau cache est `climpilot-next-1131-fusion` ; l'ancien (`…-1100-production`) est supprimé automatiquement (vérifié en simulation : données conservées, ouverture hors ligne OK).
4. Les demandes #2 et #3 (1.11, 1.12) : elles sont contenues dans cette fusion ; **c'est toi** qui les fermes après.

## 5. APRÈS — liste de contrôle à la main (téléphone **et** PC)
| # | Contrôle | Attendu |
|---|---|---|
| 1 | Ouverture avec tes données existantes | mêmes clients, devis, factures, locations ; aucun bandeau rouge |
| 2 | Petit texte sous le logo « ClimPilot » (en-tête) | « ClimPilot Next 1.12.0 … » (le numéro n'a pas été aligné, voir compte rendu § version) |
| 3 | Ouvrir un **ancien** devis (d'avant 1.12) | mêmes montants qu'avant, au centime |
| 4 | Créer un devis (nature au choix), l'enregistrer | numéro `DV-…`, totaux cohérents, visible sur l'autre appareil après synchro |
| 5 | Émettre une facture de **TEST** (mode démonstration uniquement, jamais une vraie) | numéro `TEST-F-2026-NNN` qui **suit** le dernier, sans trou ni doublon |
| 6 | Synchro entre deux appareils | modification sur le PC visible sur le téléphone, et inversement ; aucune « modification en attente » qui reste |
| 7 | Mode avion, rouvrir l'appli | elle s'ouvre, les données sont là, l'écran Planning répond |
| 8 | Signature en ligne d'un devis de **test** | lien ouvert sur le téléphone, signature enregistrée |
| 9 | Planning : planifier deux chantiers le même matin | avertissement « même moment » ; après confirmation, carte bordée de rouge |
| 10 | Ma journée : cartes Messages et Tournée | présentes ; sur le téléphone, le bouton « 🎙️ Assistant » ne recouvre **aucun** bouton d'une fenêtre (bug corrigé en M0) |
| 11 | Avoir partiel sur une facture de TEST (téléphone) | bouton « Émettre l'avoir » cliquable, `TEST-AV-…` créé |
| 12 | (si migration appliquée) `select * from public.climpilot_busy` | tes demi-journées planifiées, source `climpilot`, aucun nom |

Si un contrôle échoue : **n'insiste pas**, note ce que tu as vu et passe au retour arrière.

## 6. RETOUR ARRIÈRE (revenir à la 1.10.0)
1. **Appli** : sur GitHub, `git revert -m 1 <commit de fusion>` sur `main` (ou « Revert » sur la demande de fusion), ce qui republie la 1.10.0 (`1c91cca`). Puis F5 sur chaque appareil : le service worker 1.10 (`climpilot-next-1100-production`) reprend la main et supprime le cache 1131.
   - Les données saisies **entre-temps** restent dans l'appli (format commun) ; seules les nouveautés (moment des interventions, messages, pointages) ne sont plus affichées mais **restent stockées**.
2. **Serveur** : la migration peut rester (elle ne gêne pas la 1.10) ; pour l'enlever : `3-agenda-retour-arriere.sql`. La fonction `agenda` peut rester ou être supprimée.
3. **Données** : si et seulement si des données ont été perdues, restaurer la sauvegarde `avant-mise-en-production-M0` : Outils › « Sauvegardes cloud » › bouton « Restaurer » sur l'`id` noté à l'étape 1. **Attention** (R11 du plan) : la restauration écrase l'état serveur ; fais-la depuis un seul appareil, les autres fermés, puis rouvre-les.
