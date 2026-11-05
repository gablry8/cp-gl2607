# ClimPilot : file des missions (mise à jour à la fin de chaque mission)

> Départ : 01/11/2026 (mission OUTILLAGE). Une ligne par mission, dans l'ordre. « Qui » : Gab = geste humain ; CC = session Claude Code.
> Les dossiers et prompts détaillés sont dans le Project : `claude/PLAN-27-10.md` § 9 (prompts), `claude/ClimPilot-PROMPTS-26-10.md` (AF2 à AF5), `claude/PLAN-MAITRE-28-10.md` (calendrier).

## Maintenant (semaine du 02/11/2026)
| # | Mission | Branche | État | Prochain geste | Qui |
|---|---|---|---|---|---|
| 1 | Mise en production 1.13.0 (PR #5) | `release/1.13.0` | **faite le 02/11** (`477a151`) ; migration C1 sur le réel faite (5 « OK ») | — | Gab |
| 2 | C3 (P3) : article absent compté 0 € | `correctif/c3-article-absent` | **fusionnée le 03/11** (PR #6, `b9155b6`) | 3 cas golden C3 + 2 cas « Support mural » à corriger plus tard (accord de Gab) | Gab |
| 3 | P6+ : environnement Super PDP, droits du visiteur non connecté | `correctif/p6-env-superpdp` | **fusionnée le 03/11** (PR #7, `1e33a67`) ; script TEST passé le 03/11 | script `6-REEL-droits-anon.sql` sur le réel (19 « OK ») ; déploiement de la fonction `superpdp` (TEST puis réel) ; supprimer la branche | Gab |
| 4 | OUTILLAGE : CLAUDE.md, règles bloquantes, cette file | `outillage/claude-code` | **fusionnée le 04/11** (PR #8, `1bd4b0d`), relue par Fable 5.1 le 03/11 ; `main` protégée (vérifier que la demande de fusion y est exigée) | trous du contrôle des secrets (hook) dans une prochaine mission OUTILLAGE ; supprimer la branche | Gab |
| 5 | AF1 + AF1-bis + AF1-ter + AF1-quater : zéro perte de données (+ C-N1, A-N5 ; avenant / original, « Annuler le devis » ; signature tardive, arbre complet des avenants, fusion entre appareils) | `correctif/af1-pertes-donnees` | **fusionnée le 04/11 à 19 h 46** (PR #9, `2e1214b`), Pages déployé ; relectures Opus du 03/11 (AF1), du 04/11 (AF1-bis) et du 04/11 soir (AF1-ter) traitées ; relecture courte d'AF1-quater (Opus) lancée le 04/11 au soir, verdict à lire ; `docs/AF1-COMPTE-RENDU.md` (§ 12 AF1-ter, § 13 AF1-quater) | F5 sur chaque appareil le même jour (cache 1133) ; lire le verdict d'Opus sur AF1-quater (si condition : nouvelle branche) ; supprimer la branche | Opus puis Gab |
| 6 | AF1-5 (bandeau 🔒 résiduel dans l'éditeur, vu dans le navigateur de Gab le 04/11 au soir) + AF1-5 bis (constats mineurs 1 à 3 de la relecture d'AF1-quater : file des liens de signature, messages de refus, deux branches) | `correctif/af1-bandeau-residuel` | **fait le 04/11 au soir**, PR #10 en brouillon ; suite AD 111 / 0, batterie 1 396 / 0, CI verte, cache 1134 ; relecture courte d'AF1-5 (Opus, sur `bd07606`) : **fusionnable** ; `docs/AF1-5-COMPTE-RENDU.md` | relecture courte d'AF1-5 bis (Opus, prompt du 04/11 soir), essai (§ 5), fusion, F5 sur chaque appareil le même jour | Opus puis Gab |
| 7 | S : sécurité de l'appli (dossier privé dans le Project) | `correctif/s-securite` | à lancer après la fusion de #10 | décisions 6 à 8 de la fiche du 26/10 | CC (Fable 5.1) |

## Ensuite, jusqu'à « prêt pour le terrain » (contrôle du 01/06/2027)
S (sécurité, dossier dans le Project) → COMPTE (mot de passe, double authentification, appareils) → P11 (export automatique + journal d'erreurs) → AF1-B (factures jamais perdues) → AF2 → AF5 → AF4 (après les réponses de la comptable) → AF3 (après la décision 12) → TVA (après la comptable ET la décision de statut) → RAPPELS (dossier en février, code en mars si retenu). Juin 2027 : Supabase Pro + hébergement hors GitHub Pages (gestes de Gab).

## Plus tard (gelé, voir `docs/APRES-PRO-V1.md`)
PILOTE A à C (plan contre réel, code en mars 2027, `claude/ClimPilot-MISSION-PILOTE.md`) ; refonte R1 à R4 après l'ouverture (dont les écrans « style iPhone », phase R4) ; module clients / machines / fluides ; factures par ClimPilot (Super PDP réel + e-reporting), au plus tôt fin 2027.

## Décisions en attente (à confirmer par Gab)
- C3 : corriger les 2 cas golden « support mural » à 0 € et ajouter les 3 cas golden C3 (régénération avec son accord).
- P6+ : droits par défaut de Supabase pour les futures tables (§ 4 du compte rendu).
- AF1 : décisions 1 à 2 du compte rendu (avis par défaut appliqués ; confirmer avant la fusion de #9). S : décisions 6 à 8. COMPTE : exiger ou non la double authentification côté serveur pour les factures.
- AF4, TVA, M3 C2 (devis accepté en franchise puis facturé après la bascule) : réponses de la comptable. Statut et régime de TVA : décembre 2026.

## Branches
État lu le 03/11/2026 par OUTILLAGE (`git fetch --prune origin`, `git merge-base --is-ancestor <branche> origin/main`), `main` = `b9155b6` ; tableau complété le 04/11 (AF1-ter : P6+ et OUTILLAGE fusionnées, `main` = `1bd4b0d`). **Aucune branche n'a été supprimée** : c'est un geste de Gab.

**Contenues dans `main` → à supprimer par Gab (contenue dans main)** : 18 branches (16 le 03/11, + P6+ et OUTILLAGE le 04/11). Avance sur `main` = 0 commit pour chacune.
| Branche | Tête | Dernier commit |
|---|---|---|
| `correctif/p6-env-superpdp` | `b1560c9` | P6+, fusionnée le 03/11 (PR #7) |
| `outillage/claude-code` | `4c9c1da` | OUTILLAGE, fusionnée le 04/11 (PR #8) |
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
| `claude/brfr-controle-local` | `d9d39e2` | +1 / −118 | 05/10 — tests (brouillon) : contrôle local des règles françaises BR-FR + cas dépannage payé le jour même (`tests/genxml.mjs`, `tests/validate-einvoice.py`). |
| `claude/login-password-issue-f7cidd` | `ba4570d` | +1 / −144 | 28/08 — connexion : messages d'erreur honnêtes + réinitialisation du mot de passe (`index.html`, `sw.js`) ; très ancienne, à rapprocher de la mission COMPTE. |

## Demandes de fusion
État lu le 03/11/2026 (`gh api repos/gablry8/cp-gl2607/pulls?state=all`), complété le 04/11 (AF1-ter, AF1-quater, AF1-5).
| # | Branche → `main` | État | Note |
|---|---|---|---|
| 10 | `correctif/af1-bandeau-residuel` | **ouverte, brouillon** | AF1-5 ; à fusionner après la relecture courte (Opus) et l'essai de Gab |
| 9 | `correctif/af1-pertes-donnees` | fusionnée le 04/11 (`2e1214b`) | AF1 + AF1-bis + AF1-ter + AF1-quater ; CI de `9f85e64` : 1 386 réussis / 0 échoué ; fusionnée par Gab avant le verdict de la relecture courte d'AF1-quater |
| 8 | `outillage/claude-code` | fusionnée le 04/11 (`1bd4b0d`) | CI de `4c9c1da` : 1238 réussis / 0 échoué |
| 7 | `correctif/p6-env-superpdp` | fusionnée le 03/11 (`1e33a67`) | CI de `b1560c9` : 1282 réussis / 0 échoué |
| 6 | `correctif/c3-article-absent` | fusionnée le 03/11 (`b9155b6`) | CI de `5c2d470` : 1238 réussis / 0 échoué |
| 5 | `release/1.13.0` | fusionnée le 02/11 (`477a151`) | CI de `477a151` sur `main` : 1107 réussis / 0 échoué |
| 4 | `fusion/avant-refonte` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 3 | `claude/ameliorations-1.12` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 2 | `claude/objectifs-feux` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 1 | `claude/quirky-pasteur-ds9m47` | fusionnée le 08/10 | 1.10.0 |
