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
| 5 | AF1 + AF1-bis + AF1-ter + AF1-quater : zéro perte de données (+ C-N1, A-N5 ; avenant / original, « Annuler le devis » ; signature tardive, arbre complet des avenants, fusion entre appareils) | `correctif/af1-pertes-donnees` | **fusionnée le 04/11 à 19 h 46** (PR #9, `2e1214b`), Pages déployé, CI de `main` verte ; relectures Opus du 03/11 (AF1), du 04/11 (AF1-bis), du 04/11 soir (AF1-ter) traitées ; relecture courte d'AF1-quater (Opus, 04/11 soir) : **fusionnable**, ses constats mineurs 1 à 3 sont traités ligne 6, les 4 et 5 écrits dans `docs/AF1-COMPTE-RENDU.md` (en-tête point 10, § 10) ; `docs/AF1-COMPTE-RENDU.md` (§ 12 AF1-ter, § 13 AF1-quater) | F5 sur chaque appareil le même jour (cache 1133) ; supprimer la branche | Opus puis Gab |
| 6 | AF1-5 (bandeau 🔒 résiduel dans l'éditeur, vu dans le navigateur de Gab le 04/11 au soir) + AF1-5 bis (constats mineurs 1 à 3 de la relecture d'AF1-quater : file des liens de signature, messages de refus, deux branches) + AF1-5 ter (constats de la relecture d'AF1-5 bis : chaîne en boucle, file des liens en cours d'utilisation, messages, catch vides) | `correctif/af1-bandeau-residuel` | **fusionnée le 05/11** (PR #10, `bb79c9e`) ; faite le 04/11 au soir ; suite AD 115 / 0, cache 1134 ; relectures courtes d'AF1-5 (sur `bd07606`) et d'AF1-5 bis (sur `e75c893`) par Opus : **fusionnables** ; batterie et CI d'AF1-5 ter : `docs/AF1-5-COMPTE-RENDU.md` § 6 ter ; `docs/AF1-5-COMPTE-RENDU.md` | supprimer la branche | Gab |
| 7 | **S : sécurité de l'appli** (dossier privé dans le Project ; accord écrit de Gab du 09/11 : Tesseract gardé et embarqué, origines CSP par défaut, réservation qui complète les champs vides, CSV neutralisés) | `correctif/s-securite` | **fait le 10/11** (Fable 5.1) : suite AB 73 / 0 (rouge sur `main` : 22 / 49) ; batterie 1 591 / 0 ; CI verte sur les deux événements, échappement unique `cpEsc`, 11 boutons sans texte libre, identifiants validés, CSP, `vendor/` (+ 12,7 Mo, dont Tesseract 11,7 Mo), cache 1136 ; `docs/S-COMPTE-RENDU.md` ; demande de fusion **#20** en brouillon. **Relecture P10 faite le 11/11** (Opus 5.5, tête `c99dc00`) : quatre conditions. **S-bis fait le 11/11** (session Claude Code, même branche, § 10 du compte rendu) : C1 (sauvegarde à l'ancien format : identifiants validés dès l'import) et C2 (numéros de facture et d'avoir hors du code de 8 boutons) corrigées ; suite AB 86 / 0 (rouge sur `c99dc00` : 75 / 11) ; batterie 1 612 / 0 ; cache 1137 ; C3 fait (0 identifiant hors règle sur le réel) ; CI : tout vert sauf la suite X (mise à jour du cache), instable sur le runner (§ 10.5) | relecture courte de S-bis par l'autre modèle (5 fichiers), essai de 35 min (§ 7, étapes 1 à 13, dont C4), fusion, F5 sur chaque appareil le même jour ; décisions : empreintes du worker dans l'appli (§ 0 ligne 6), lecteur Excel `xlsx` 0.18.5 (`docs/APRES-PRO-V1.md`), petite mission OUTILLAGE pour la suite X | l'autre modèle puis Gab |
| 8 | **P3 : les états terminaux gagnent la fusion entre appareils** (annulé, remplacé, signé, facturé ; fiches fluides ; encaissements ; compteur des fiches ; garde à la réception et à la restauration ; constat 1 : `nxSetStatut` verrouillé sur un devis signé) | `correctif/p3-fusion-etats` | **fait le 06/11** (Fable 5.1), PR #16 en brouillon ; U 76 / 0 (golden `fusion-empreinte` 3f01fbdc → 76e10290, accord de Gab), AD 139 / 0, AE 22 / 0 (nouvelle suite deux appareils), cache 1135 ; batterie complète 1 499 / 0 en session, CI verte (runs 125 à 127 : 1 495 / 0 / 2 SKIP connus) ; `docs/P3-COMPTE-RENDU.md` ; **relecture P10 d'Opus (09/11) : sous conditions C1 à C4 → P3-bis fait le 09/11** (Fable 5.1 : arbitrage fantôme à la réception d'un geste ordinaire corrigé, garde à la réception limitée aux états terminaux ; U 90 / 0, AD 148 / 0 (139 + 9), AE 25 / 0 (22 + 3), CI verte runs 133 à 136 : 1 521 / 0 / 2 SKIP connus) ; décision 5 confirmée le 09/11 ; **relecture courte C5 d'Opus (09/11, midi) : fusionnable sous conditions C6 (test AE7) et C7 (documents) → P3-ter fait le 09/11** (Fable 5.1, tests et documents seuls, aucun code : AE7 5 / 5, CI du commit final : voir la PR #16) ; `docs/P3-COMPTE-RENDU.md` § 13 | **fusionnée le 09/11** (PR #16, `6a89e60`) ; F5 sur chaque appareil le même jour (cache 1135) ; supprimer la branche | Gab |

## Outillage (aucun code de l'appli : peut avancer à côté de la mission en cours sur le code)
| Mission | Branche | État | Prochain geste | Qui |
|---|---|---|---|---|
| OUTILLAGE-2 : faketime dans l'environnement, tests SQL de l'agenda indépendants de l'horloge, suite Q sans attentes fixes (Q5, Q10), trous du hook des secrets | `outillage/environnement-2` | **fait le 05/11** (Opus 5.5), **PR #12 en brouillon**, CI verte (run 108 : 1 386 / 0 / 2 SKIP connus, comme `main`) ; `docs/OUTILLAGE-2-COMPTE-RENDU.md` | relecture par Fable 5.1 (`relecture-p10`) ; Gab colle le nouveau setup script (§ 2 de `docs/ENVIRONNEMENT-CLAUDE-CODE.md`), décide de D1 à D5 du compte rendu, fusionne | Fable puis Gab |
| OUTILLAGE-3 : hook des secrets — `onFailure: "block"` et garde « script absent » (D1), contrôle de la branche au push et push vers `main` refusé (D2), texte des messages de commit (D4) ; accord écrit de Gab du 06/11 | `outillage/environnement-3` | **fait le 06/11** (Opus 5.5), **PR #15 en brouillon** ; bancs hors dépôt 96 + 9 cas, 0 écart ; batterie et CI : `docs/OUTILLAGE-3-COMPTE-RENDU.md` § 6 | relecture par Fable 5.1 (`relecture-p10`) ; Gab confirme E1, décide E2 (réglage e-mail GitHub, § 6.3), fusionne | Fable puis Gab |

## Ensuite, jusqu'à « prêt pour le terrain » (contrôle du 01/06/2027)
~~S (sécurité, faite le 10/11)~~ → COMPTE (mot de passe, double authentification, appareils) → P11 (export automatique + journal d'erreurs) → AF1-B (factures jamais perdues) → AF2 → AF5 → AF4 (après les réponses de la comptable) → AF3 (après la décision 12) → TVA (après la comptable ET la décision de statut) → RAPPELS (dossier en février, code en mars si retenu). Juin 2027 : Supabase Pro + hébergement hors GitHub Pages (gestes de Gab).


## Plus tard (gelé, voir `docs/APRES-PRO-V1.md`)
PILOTE A à C (plan contre réel, code en mars 2027, `claude/ClimPilot-MISSION-PILOTE.md`) ; refonte R1 à R4 après l'ouverture (dont les écrans « style iPhone », phase R4) ; module clients / machines / fluides ; factures par ClimPilot (Super PDP réel + e-reporting), au plus tôt fin 2027.

## Décisions en attente (à confirmer par Gab)
- C3 : corriger les 2 cas golden « support mural » à 0 € et ajouter les 3 cas golden C3 (régénération avec son accord).
- P6+ : droits par défaut de Supabase pour les futures tables (§ 4 du compte rendu).
- AF1 : décisions 1 à 2 du compte rendu (avis par défaut appliqués ; confirmer avant la fusion de #9). S : décisions 1 à 4 prises le 09/11 ; reste la vérification des empreintes du worker dans l'appli (`docs/S-COMPTE-RENDU.md` § 0 ligne 6). COMPTE : exiger ou non la double authentification côté serveur pour les factures.
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
État lu le 03/11/2026 (`gh api repos/gablry8/cp-gl2607/pulls?state=all`), complété le 04/11 (AF1-ter, AF1-quater, AF1-5), le 06/11 (P3), le 09/11 (P3-bis : #13, #14, #15 fusionnées) le 10/11 (S : #16, #17, #18 fusionnées ; #19 et #20 ouvertes) et le 11/11 (S-bis sur #20).
| # | Branche → `main` | État | Note |
|---|---|---|---|
| 20 | `correctif/s-securite` | **ouverte, brouillon** (10/11) | S : sécurité de l'appli ; `main` (`6457329`) fusionnée dans la branche le 10/11 ; CI de `b5b1fe5` **verte sur les deux événements, première tentative** (runs 42908929178 et 42908940538 : 1 595 / 0 / 2 SKIP connus ; avant, la suite X — test seul — avait planté deux fois sur l'événement « demande de fusion », durcie depuis) ; `docs/S-COMPTE-RENDU.md` § 6.4. **S-bis (11/11)** : tête `9ade006` — push vert à la 2e tentative (run 43087776623 : 1 608 / 0 / 2 SKIP connus) ; demande de fusion (run 43087788972) en échec aux deux tentatives, la seule suite X en cause à la première (probable à la seconde) ; diagnostic ajouté à la suite X ; § 10.5 |
| 19 | `docs/mission-af2-af5` | ouverte, brouillon | dossiers AF2 et AF5 (documents seulement) |
| 18 | `docs/mission-af1b` | fusionnée le 10/11 (`6457329`) | dossier AF1-B (documents seulement) |
| 17 | `docs/mission-compte` | fusionnée le 10/11 (`5299656`) | dossier COMPTE (documents seulement) |
| 16 | `correctif/p3-fusion-etats` | fusionnée le 09/11 (`6a89e60`) | P3 + P3-bis + P3-ter ; CI verte sur les deux événements (runs 133 à 136 : 1 521 / 0 / 2 SKIP connus) ; `docs/P3-COMPTE-RENDU.md` |
| 15 | `outillage/environnement-3` | fusionnée le 09/11 (`ef471cf`) | OUTILLAGE-3 (hook des secrets durci) |
| 14 | `docs/mission-p11` | fusionnée le 09/11 (`84e4243`) | dossier P11 (documents seulement) |
| 13 | `docs/suites-relectures-05-11` | fusionnée le 09/11 (`0fe1e76`) | suites des relectures du 05/11 (documents seulement) |
| 12 | `outillage/environnement-2` | fusionnée le 05/11 (`d61c601`) | OUTILLAGE-2 |
| 11 | `docs/mission-p3` | fusionnée le 05/11 (`297cc7e`) | dossier P3 (documents seulement) |
| 10 | `correctif/af1-bandeau-residuel` | fusionnée le 05/11 (`bb79c9e`) | AF1-5 + AF1-5 bis + AF1-5 ter |
| 9 | `correctif/af1-pertes-donnees` | fusionnée le 04/11 (`2e1214b`) | AF1 + AF1-bis + AF1-ter + AF1-quater ; CI de `9f85e64` : 1 386 réussis / 0 échoué ; fusionnée par Gab avant le verdict de la relecture courte d'AF1-quater |
| 8 | `outillage/claude-code` | fusionnée le 04/11 (`1bd4b0d`) | CI de `4c9c1da` : 1238 réussis / 0 échoué |
| 7 | `correctif/p6-env-superpdp` | fusionnée le 03/11 (`1e33a67`) | CI de `b1560c9` : 1282 réussis / 0 échoué |
| 6 | `correctif/c3-article-absent` | fusionnée le 03/11 (`b9155b6`) | CI de `5c2d470` : 1238 réussis / 0 échoué |
| 5 | `release/1.13.0` | fusionnée le 02/11 (`477a151`) | CI de `477a151` sur `main` : 1107 réussis / 0 échoué |
| 4 | `fusion/avant-refonte` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 3 | `claude/ameliorations-1.12` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 2 | `claude/objectifs-feux` | close, comptée « fusionnée » le 02/11 | contenue dans la 1.13.0 |
| 1 | `claude/quirky-pasteur-ds9m47` | fusionnée le 08/10 | 1.10.0 |
