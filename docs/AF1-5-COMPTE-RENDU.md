# AF1-5 — le bandeau 🔒 d'un devis verrouillé restait affiché sur le devis suivant — compte rendu (04/11/2026, soir)

> Suite d'AF1 (PR #9 fusionnée par Gabriel le 04/11 à 20 h 46, `main` = `2e1214b`). Défaut vu par Claude (Fable 5.1) dans le navigateur de Gabriel pendant l'essai des parcours du compte rendu AF1 sur la copie d'essai AF1-quater ; présent sur `main`. Branche `correctif/af1-bandeau-residuel`, PR #10 (brouillon). Exécutant : Fable 5.1, dans la conversation du Project. Rien n'est fusionné ni déployé ; aucune base Supabase touchée.

## Ce que Gabriel décide / fait (6 lignes)
1. **Lis le constat (§ 1)** : pas de perte de données, mais un piège d'affichage dans l'éditeur de devis.
2. **Relecture P10 courte par Opus** (prompt fourni dans la conversation), puis **essai** (§ 5, 1 min) sur la copie d'essai reconstruite depuis cette branche.
3. **Fusion de #10** : toi, après la relecture. Puis **F5 sur chaque appareil le même jour** (cache `climpilot-next-1134-production`). Version affichée inchangée (1.13.0).
4. Batterie complète et CI : § 6. Golden Y et Z identiques, aucune enveloppe nouvelle (W), aucun montant ni règle touchés.
5. Retour arrière : revert de `ea0f7f1` ; le test T25 reste et redevient rouge.
6. À noter pour la suite (pas dans cette branche) : les parcours 7 et 9 du compte rendu AF1 ont été joués par Claude dans ton navigateur (OK) ; le reste des parcours est en cours (le PC s'est déconnecté en route) — résultat dans la conversation.

## 1. Constat (certain : reproduit deux fois à la main, puis par le test T25)
Dans l'éditeur de devis (`next-devis2.js`), ouvrir un devis **verrouillé** (accepté, signé ou facturé : bandeau 🔒 « il ne se modifie plus »), puis cliquer **« Dupliquer »** dans ce bandeau : le brouillon créé s'ouvre, **mais le bandeau 🔒 de l'original reste affiché au-dessus**, avec ses boutons « Faire un avenant / Dupliquer / Annuler le devis » qui agissent sur l'**original**. Même chose en ouvrant ensuite un brouillon depuis la liste. Les champs du brouillon sont bien modifiables (pas de verrou réel), « ✍️ Signature » et « 💾 Enregistrer » sont présents : **aucune perte de données**. Le piège : Gabriel croit annuler ou amender le brouillon et vise l'original (pour un original facturé, l'annulation est de toute façon refusée ; pour un original accepté sans facture, la fenêtre « Annuler le devis » s'ouvrirait sur lui).

Vu sur la copie d'essai `famous-gingersnap` (code AF1-quater `e6b31b5`, base TEST), donc aussi sur `main` après la fusion de #9. Le défaut date d'AF1 D0 (bandeau 🔒 ajouté le 03/11) : il n'était couvert ni par les tests (T1 à T24 n'enchaînent jamais deux ouvertures de devis différents), ni par les relectures.

## 2. Cause (certain, lu)
`openEditor(d, opt)` posait le devis, appelait `render()` puis, éventuellement, `showBanner(opt.banner)`. `updHead()` pose le bandeau 🔒 **si** le devis ouvert est verrouillé, mais **ne l'enlève jamais** quand il ne l'est pas ; `openV2` pose les bandeaux « avenant du devis n° … » et « brouillon retrouvé ». Rien ne vidait le bandeau entre deux devis.

## 3. Correction (`next-devis2.js`, une ligne ; `sw.js` → 1134)
Dans `openEditor`, `showBanner('')` **avant** `render()` : le bandeau du devis précédent disparaît ; `updHead` repose 🔒 si le nouveau devis est verrouillé, `openV2` repose « avenant » / « brouillon retrouvé », et l'option `opt.banner` est appliquée après `render()` comme avant. `sw.js` : `climpilot-next-1133-production` → `1134` (fichier mis en cache modifié, une seule fois sur la branche). `VERSION` / `NX_VERSION` inchangés (demander à Gabriel avant de les changer).

## 4. Tests : rouge sur `main`, vert après (suite AD : 101 → 104 contrôles)
- **T25** (`tests/suiteAD-af1-pertes.mjs`, groupe « AF1-5 bandeau de l'éditeur ») : témoin (devis accepté ouvert → bandeau « il ne se modifie plus » avec son numéro, boutons de statut du Récapitulatif tous grisés) ; **T25a** « Dupliquer » depuis le bandeau → le brouillon s'ouvre sans le bandeau de l'original, ses 4 boutons de statut sont actifs ; **T25b** depuis la liste : un verrouillé puis un brouillon → pas d'héritage du bandeau.
- **Rouge** sur `2e1214b` (`main`, correctif mis de côté avec `git stash`) : **102 réussis, 2 échoués** (T25a, T25b ; témoin vert par construction). Journal gardé hors dépôt (`resAD-af15-rouge-2e1214b-04-11.log`).
- **Vert** sur `ea0f7f1` : **104 réussis, 0 échoué** (67 s). Tous les anciens contrôles AF1 à AF1-quater restent verts.
- Remarque : le 🔒 n'apparaît pas dans le texte du bandeau lu par le test (`textContent`), le test cherche « ne se modifie plus » et le numéro du devis.

## 5. Essai pour Gabriel (≈ 1 min, copie d'essai reconstruite depuis cette branche)
1. Ouvre un devis **facturé** (ou accepté) : **attendu** : bandeau 🔒 avec son numéro.
2. Clique **« Dupliquer »** dans le bandeau. **Attendu** : le brouillon s'ouvre **sans** bandeau 🔒 ; en haut à droite : « ✍️ Signature » et « 💾 Enregistrer » ; « Brouillon » dans l'en-tête.
3. Ferme, ouvre le même devis facturé, puis depuis la liste un brouillon : **attendu** : pas de bandeau 🔒 sur le brouillon.

## 6. Batterie complète et CI
| Passage | Résultat |
|---|---|
| Batterie complète ici, sur `d5911f2` (= code `ea0f7f1` + documents ; arbre propre, Chrome 153 `CP_SANS_NETNS=1`, PostgreSQL 16, validateurs CEN / FNFE) | **COMPLET, RÉUSSI — 1 389 réussis, 0 échoué, 2 SKIP (les 2 connus), 5 À TRANCHER** inchangés. Comparé suite par suite à la batterie AF1-quater : **une seule différence de contenu, la suite AD 101 → 104** (T25) ; suite Q 64 / 64 ; golden **Y 21 + 5** et **Z 55** identiques, **W 64** (aucune enveloppe nouvelle), **U 27**, SQL 66 / 66, fonctions 90 / 90. |
| CI GitHub de `a09573f` (= code `ea0f7f1` + documents) | **verte** sur le push ([run 88](https://github.com/gablry8/cp-gl2607/actions/runs/41897391804)) et sur la demande de fusion #10 ([run 89](https://github.com/gablry8/cp-gl2607/actions/runs/41897401416)) : « COMPLET, RÉUSSI — **1 389 réussis, 0 échoué, 2 SKIP** (les 2 connus), 5 À TRANCHER », chiffres identiques au passage local. Les runs 84-85 (`ea0f7f1`) et 86-87 (`d5911f2`) ont été annulés par les pushs suivants (`cancel-in-progress`, même code) : échec de forme (« code ? ») de leur check « rapport », pas un échec de tests. Le commit qui inscrit ces lignes ne touche que ce document : sa CI relance la même batterie. |

## 7. Fichiers modifiés
`next-devis2.js` (1 ligne), `sw.js` (nom du cache), `tests/suiteAD-af1-pertes.mjs` (+3 contrôles), `docs/AF1-5-COMPTE-RENDU.md`, `docs/FILE-DES-MISSIONS.md`. Aucun fichier de `tests/golden/`. Contrôle des secrets : `tools/claude/verif-secrets.sh` passé sans alerte.

## 8. Ce qui n'a pas pu être vérifié
- iPhone / Safari réels ; l'ancien formulaire (`index.html`, `wizard`) n'a pas ce bandeau (il a le sien, posé par `cpVerrouWizard` qui retire l'ancien bandeau et relève les champs à chaque chargement du formulaire : lu (**certain** pour le code), non joué dans le navigateur).
