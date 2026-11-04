# ClimPilot : file des missions (mise à jour à la fin de chaque mission)

> Départ : 01/11/2026 (mission OUTILLAGE). Une ligne par mission, dans l'ordre. « Qui » : Gab = geste humain ; CC = session Claude Code.
> Les dossiers et prompts détaillés sont dans le Project : `claude/PLAN-27-10.md` § 9 (prompts), `claude/ClimPilot-PROMPTS-26-10.md` (AF2 à AF5), `claude/PLAN-MAITRE-28-10.md` (calendrier).

## Maintenant (semaine du 02/11/2026)
| # | Mission | Branche | État | Prochain geste | Qui |
|---|---|---|---|---|---|
| 1 | Mise en production 1.13.0 (PR #5) | `release/1.13.0` | **faite le 02/11** (`477a151`) ; migration C1 sur le réel faite (5 « OK ») | — | Gab |
| 2 | C3 (P3) : article absent compté 0 € | `correctif/c3-article-absent` | **fusionnée le 03/11** (PR #6, `b9155b6`) | 3 cas golden C3 + 2 cas « Support mural » à corriger plus tard (accord de Gab) | Gab |
| 3 | P6+ : environnement Super PDP, droits du visiteur non connecté | `correctif/p6-env-superpdp` | fait, relu, conditions traitées le 31/10 (`f63fbae`) ; script TEST passé le 03/11 | INTÉGRATION-P6+ (`const C=` 1132), puis fusion ; script `6-REEL-*` ; déploiement de `superpdp` | CC puis Gab |
| 4 | OUTILLAGE : CLAUDE.md, règles bloquantes, cette file | `outillage/claude-code` | **fait le 03/11** : PR #8 en brouillon, CI verte (1238 / 0, comme `main`) ; `main` pas encore protégée sur GitHub | protéger `main` (geste 2), relecture P10 (Fable 5.1), fusion ; voir `docs/OUTILLAGE-COMPTE-RENDU.md` | Gab puis Fable 5.1 puis Gab |
| 5 | AF1+ : zéro perte de données (+ C-N1, A-N5) | `correctif/af1-pertes-donnees` | à lancer après 3 et 4 | réponses de Gab aux décisions 3 à 5 (fiche du 26/10), sinon avis par défaut du dossier | CC |

## Ensuite, jusqu'à « prêt pour le terrain » (contrôle du 01/06/2027)
S (sécurité, dossier dans le Project) → COMPTE (mot de passe, double authentification, appareils) → P11 (export automatique + journal d'erreurs) → AF1-B (factures jamais perdues) → AF2 → AF5 → AF4 (après les réponses de la comptable) → AF3 (après la décision 12) → TVA (après la comptable ET la décision de statut) → RAPPELS (dossier en février, code en mars si retenu). Juin 2027 : Supabase Pro + hébergement hors GitHub Pages (gestes de Gab).

## Plus tard (gelé, voir `docs/APRES-PRO-V1.md`)
PILOTE A à C (plan contre réel, code en mars 2027, `claude/ClimPilot-MISSION-PILOTE.md`) ; refonte R1 à R4 après l'ouverture (dont les écrans « style iPhone », phase R4) ; module clients / machines / fluides ; factures par ClimPilot (Super PDP réel + e-reporting), au plus tôt fin 2027.

## Décisions en attente (à confirmer par Gab)
- C3 : corriger les 2 cas golden « support mural » à 0 € et ajouter les 3 cas golden C3 (régénération avec son accord).
- P6+ : droits par défaut de Supabase pour les futures tables (§ 4 du compte rendu).
- AF1+ : décisions 3 à 5 de la fiche du 26/10. S : décisions 6 à 8. COMPTE : exiger ou non la double authentification côté serveur pour les factures.
- AF4, TVA, M3 C2 (devis accepté en franchise puis facturé après la bascule) : réponses de la comptable. Statut et régime de TVA : décembre 2026.

## Branches
État lu le 03/11/2026 par OUTILLAGE (`git fetch --prune origin`, `git merge-base --is-ancestor <branche> origin/main`), `main` = `b9155b6`. **Aucune branche n'a été supprimée** : c'est un geste de Gab.

**Contenues dans `main` → à supprimer par Gab (contenue dans main)** : 16 branches. Avance sur `main` = 0 commit pour chacune.
| Branche | Tête | Dernier commit |
|---|---|---|
| `release/1.13.0` | `f456f32` | 25/10 — fiche M0 corrigée après relecture, relevé bancaire fictif (PR #5) |
| `correctif/c3-article-absent` | `5c2d470` | 31/10 — C3 relecture P10 : « commandé » et stock suivent un article renommé (PR #6) |
| `correctif/c1-registre-illisible` | `a23d999` | 24/10 — C1 : compte rendu § 9, batterie rejouée |
| `refonte/p0-suite` | `b086db2` | 25/10 — P0-suite : passage final de la batterie |
| `refonte/ci-dates` | `dff6035` | 24/10 — batterie indépendante du jour réel |
| `refonte/p0-filet` | `dc3aef4` | 21/10 — fiche M0 : facturation réelle autorisée sur la copie d'essai |
| `fusion/avant-refonte` | `682b9b5` | 20/10 — M0 : fiche en deux parties (PR #4) |
| `claude/planning-20-10` | `7248643` | 20/10 — nom de cache 1130 accepté par la suite P |
| `claude/optimisation-20-10` | `ab96f34` | 20/10 — bibliothèques embarquées remplacées dans les tests |
| `claude/fiabilite-sur-1.12` | `d125f0c` | 19/10 — fusion de la fiabilité dans la 1.12 |
| `claude/fiabilite-19-10` | `8dd2030` | 19/10 — émission : « résultat inconnu » après une réponse perdue |
| `claude/ameliorations-1.12` | `f650de9` | 14/10 — 1.12 : banc d'essai (PR #3) |
| `claude/objectifs-feux` | `00472de` | 12/10 — 1.11 : suivi lisible sur téléphone (PR #2) |
| `claude/quirky-pasteur-ds9m47` | `217661b` | 08/10 — 1.10.0 en production (PR #1) |
| `da-atelier` | `8eda976` | 29/09 — DA « Atelier » + garde-fous de fiabilité |
| `refonte-devis-phase1` | `6b7ca4f` | 29/09 — devis par nature de chantier : socle + lots |

**Non contenues dans `main` → à décider** :
| Branche | Tête | En avance / en retard sur `main` | Contenu (d'après `git log`) |
|---|---|---|---|
| `correctif/p6-env-superpdp` | `f63fbae` | +3 / −5 | P6+ : bac à sable Super PDP seulement si « sandbox », retrait des droits inutiles du visiteur non connecté. **En cours** (session INTÉGRATION-P6+, PR #7 en brouillon) : ne pas supprimer. |
| `claude/brfr-controle-local` | `d9d39e2` | +1 / −118 | 05/10 — tests (brouillon) : contrôle local des règles françaises BR-FR + cas dépannage payé le jour même (`tests/genxml.mjs`, `tests/validate-einvoice.py`). |
| `claude/login-password-issue-f7cidd` | `ba4570d` | +1 / −144 | 28/08 — connexion : messages d'erreur honnêtes + réinitialisation du mot de passe (`index.html`, `sw.js`) ; très ancienne, à rapprocher de la mission COMPTE. |

## Demandes de fusion
État lu le 03/11/2026 (`gh api repos/gablry8/cp-gl2607/pulls?state=all`).
| # | Branche → `main` | État | Note |
|---|---|---|---|
| 7 | `correctif/p6-env-superpdp` | **ouverte, brouillon** | gérée par INTÉGRATION-P6+ ; CI de `f63fbae` : 1151 réussis / 0 échoué |
| 6 | `correctif/c3-article-absent` | fusionnée le 03/11 (`b9155b6`) | CI de `5c2d470` : 1238 réussis / 0 échoué |
| 5 | `release/1.13.0` | fusionnée le 02/11 (`477a151`) | CI de `477a151` sur `main` : 1107 réussis / 0 échoué |
| 4 | `fusion/avant-refonte` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 3 | `claude/ameliorations-1.12` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 2 | `claude/objectifs-feux` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 1 | `claude/quirky-pasteur-ds9m47` | fusionnée le 08/10 | 1.10.0 |
