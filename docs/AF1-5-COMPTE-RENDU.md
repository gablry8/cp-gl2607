# AF1-5 — le bandeau 🔒 d'un devis verrouillé restait affiché sur le devis suivant, et suites de la relecture d'AF1-quater — compte rendu (04/11/2026, soir)

> Suite d'AF1 (PR #9 fusionnée par Gabriel le 04/11 à 19 h 46, heure de Paris — `merged_at` 18:46 UTC ; une première version de ce document disait 20 h 46, lecture faite dans un autre fuseau —, `main` = `2e1214b`). Défaut vu par Claude (Fable 5.1) dans le navigateur de Gabriel pendant l'essai des parcours du compte rendu AF1 sur la copie d'essai AF1-quater ; présent sur `main`. Branche `correctif/af1-bandeau-residuel`, PR #10 (brouillon). Exécutant : Fable 5.1, dans la conversation du Project. Rien n'est fusionné ni déployé ; aucune base Supabase touchée.

> **AF1-5 bis (04/11, 23 h)** : les constats mineurs 1 à 3 de la relecture d'AF1-quater (Opus) sont traités dans la même branche (§ 9), pour ne pas ouvrir une 3e branche en conflit avec celle-ci sur la suite AD. Commits : `6ba943c` (tests d'abord, 5 rouges sur `bd07606`), `6bb5e20` (code), puis documents.

## Ce que Gabriel décide / fait (6 lignes)
1. **Lis le constat (§ 1)** : pas de perte de données, mais un piège d'affichage dans l'éditeur de devis. **Et le § 9** : trois petites corrections issues de la relecture d'AF1-quater (messages de refus plus justes, pas de « remplacé par » choisi au hasard, file des liens de signature fiable).
2. **Relecture P10 courte par Opus** (prompt fourni dans la conversation), puis **essai** (§ 5, 1 min) sur la copie d'essai reconstruite depuis cette branche.
3. **Fusion de #10** : toi, après la relecture. Puis **F5 sur chaque appareil le même jour** (cache `climpilot-next-1134-production`). Version affichée inchangée (1.13.0).
4. Batterie complète et CI : § 6. Golden Y et Z identiques, aucune enveloppe nouvelle (W), aucun montant ni règle touchés.
5. Retour arrière : revert de `ea0f7f1` (bandeau) et de `6bb5e20` (§ 9) ; les tests T25 à T28 restent et redeviennent rouges.
6. À noter pour la suite (pas dans cette branche) : les parcours 7 et 9 du compte rendu AF1 ont été joués par Claude dans ton navigateur (OK) ; le reste des parcours est en cours (le PC s'est déconnecté en route) — résultat dans la conversation.

## 1. Constat (certain : reproduit deux fois à la main, puis par le test T25)
Dans l'éditeur de devis (`next-devis2.js`), ouvrir un devis **verrouillé** (accepté, signé ou facturé : bandeau 🔒 « il ne se modifie plus »), puis cliquer **« Dupliquer »** dans ce bandeau : le brouillon créé s'ouvre, **mais le bandeau 🔒 de l'original reste affiché au-dessus**, avec ses boutons « Faire un avenant / Dupliquer / Annuler le devis » qui agissent sur l'**original**. Même chose en ouvrant ensuite un brouillon depuis la liste. Les champs du brouillon sont bien modifiables (pas de verrou réel), « ✍️ Signature » et « 💾 Enregistrer » sont présents : **aucune perte de données**. Le piège : Gabriel croit annuler ou amender le brouillon et vise l'original (pour un original facturé, l'annulation est de toute façon refusée ; pour un original accepté sans facture, la fenêtre « Annuler le devis » s'ouvrirait sur lui).

Vu sur la copie d'essai (Netlify, code AF1-quater `e6b31b5`, base TEST), donc aussi sur `main` après la fusion de #9. Le défaut date d'AF1 D0 (bandeau 🔒 ajouté le 03/11) : il n'était couvert ni par les tests (aucun contrôle de T1 à T24 ne lisait le bandeau après l'ouverture d'un second devis — le témoin de T4 ouvre bien un brouillon après les devis verrouillés de T1 à T3, sans regarder le bandeau), ni par les relectures.

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
4. Le sens inverse (protège contre un effacement en trop) : ferme, ouvre un brouillon, puis le devis facturé : **attendu** : le bandeau 🔒 **revient**, avec son numéro.

## 6. Batterie complète et CI
| Passage | Résultat |
|---|---|
| Batterie complète ici, sur `d5911f2` (= code `ea0f7f1` + documents ; arbre propre, Chrome 153 `CP_SANS_NETNS=1`, PostgreSQL 16, validateurs CEN / FNFE) | **COMPLET, RÉUSSI — 1 389 réussis, 0 échoué, 2 SKIP (les 2 connus), 5 À TRANCHER** inchangés. Comparé suite par suite à la batterie AF1-quater : **une seule différence de contenu, la suite AD 101 → 104** (T25) ; suite Q 64 / 64 ; golden **Y 21 + 5** et **Z 55** identiques, **W 64** (aucune enveloppe nouvelle), **U 27**, SQL 66 / 66, fonctions 90 / 90. |
| CI GitHub de `a09573f` (= code `ea0f7f1` + documents) | **verte** sur le push ([run 88](https://github.com/gablry8/cp-gl2607/actions/runs/41897391804)) et sur la demande de fusion #10 ([run 89](https://github.com/gablry8/cp-gl2607/actions/runs/41897401416)) : « COMPLET, RÉUSSI — **1 389 réussis, 0 échoué, 2 SKIP** (les 2 connus), 5 À TRANCHER », chiffres identiques au passage local. Les runs 84-85 (`ea0f7f1`) et 86-87 (`d5911f2`) ont été annulés par les pushs suivants (`cancel-in-progress`, même code) : échec de forme (« code ? ») de leur check « rapport », pas un échec de tests. Le commit qui inscrit ces lignes ne touche que ce document : sa CI relance la même batterie. |

## 7. Fichiers modifiés
`next-devis2.js` (1 ligne), `sw.js` (nom du cache), `tests/suiteAD-af1-pertes.mjs` (+3 contrôles), `docs/AF1-5-COMPTE-RENDU.md`, `docs/FILE-DES-MISSIONS.md`. Aucun fichier de `tests/golden/`. Contrôle des secrets : `tools/claude/verif-secrets.sh` passé sans alerte.

## 8. Ce qui n'a pas pu être vérifié
- iPhone / Safari réels ; l'ancien formulaire (`index.html`, `wizard`) n'a pas ce bandeau (il a le sien, posé par `cpVerrouWizard` qui retire l'ancien bandeau et relève les champs à chaque chargement du formulaire : lu (**certain** pour le code), non joué dans le navigateur).

## 8 bis. Relecture P10 courte d'AF1-5 (Opus, 04/11 soir, sur `bd07606` — avant AF1-5 bis)
Verdict : **fusionnable**, rien de bloquant ; défaut reproduit par vrais clics sur `main`, disparu sur la tête ; 11 appelants qui passent `opt.banner` vérifiés (bandeau posé après `render()`), bandeau de l'assistant, copie d'un ancien devis, bloc facturation et bandeaux des modules sans effet de bord ; golden, périmètre, secrets (motifs privés actifs), CI : conformes. Quatre points mineurs de documents, corrigés dans ce commit : heure de fusion de #9 (19 h 46 Paris, pas 20 h 46), phrase du § 1 sur T1 à T24, nom de la copie d'essai retiré du dépôt public (décision prise par Claude, réversible : Gabriel peut préférer le garder), étape 4 du § 5 (le bandeau revient). Facultatif, non fait : T25 par vrais clics et avec les cas « avenant » / « brouillon retrouvé » (verts dans l'essai de la relecture, déjà sur `main`). Copie de la relecture : `claude/ClimPilot-AF1-5-RELECTURE.md` (Project). **AF1-5 bis (§ 9) n'était pas encore sur la branche : sa relecture courte reste à faire** (prompt remis à Gabriel le 04/11 au soir).

## 9. AF1-5 bis — constats mineurs de la relecture d'AF1-quater (Opus, 04/11 soir), traités ici
Relecture copiée dans le Project : `claude/ClimPilot-AF1-quater-RELECTURE.md`. Verdict : « fusionnable, et déjà fusionné » (PR #9), CI de `main` verte, aucun trou bloquant ; six constats mineurs. Les constats 4 (nuance « jamais deux factures ») et 5 (avenant du milieu supprimé) sont écrits dans `docs/AF1-COMPTE-RENDU.md` (en-tête point 10, § 10) ; le 6 (file des missions) était déjà corrigé dans cette branche. Les constats 1 à 3 touchent le code :

| # | Constat (certain, reproduit par la relecture puis par un test ici) | Correction | Test |
|---|---|---|---|
| 1 | Une demande de désactivation de lien de signature pouvait se perdre : la file était vidée **avant** la réponse du cloud, et la phrase du § 13.2.5 (« la réparation la remet en file après un rechargement ») était fausse | `next-signature.js` : `desactiverLiens` rend **-1** sans cloud, sur erreur du serveur ou coupure (sinon le nombre de liens désactivés) ; `viderLiensEnAttente` ne retire une demande de la file qu'après une réponse ≥ 0, la remet sinon (sans doublon) ; § 13.2.5 corrigé | T28 (rouge : la file se vidait même sur -1 et sur un rejet) |
| 2a | Original qui porte déjà une facture (appareil pas à jour) + avenant accepté ailleurs : « Facturer » le solde disait « remplacé … facture l'avenant » alors que l'original restait « Accepté » (il ne peut pas être marqué remplacé : facture vivante) ; puis l'avenant était refusé à son tour → Gabriel tournait en rond | `cpRefusFacture` : message « ⛔ Devis … porte déjà une facture (n°) et son avenant n° … est accepté : fais d'abord un avoir sur cette facture (puis facture l'avenant), ou annule l'avenant. » ; journal `facture_et_avenant` | T26a (rouge) + témoin |
| 2b | Chaîne O → A1 → A2 → A3 avec O, A1, A2 revenus « acceptés » : le refus de O nommait A1 (premier descendant accepté trouvé) au lieu du dernier accepté | `cpRefusFacture` vise la **feuille** acceptée (descendant accepté sans descendant accepté) : répare vers l'avenant direct (A1), dit de facturer A3 « (le dernier accepté) » | T26b (rouge) ; puis A3 se facture seul, A1 et A2 réparés |
| 3 | Deux branches acceptées (B1 direct de O, A2 petit-fils) : « Facturer » O réécrivait « remplacé par » vers la première branche trouvée, alors que la réparation au démarrage ne tranche pas | Deux feuilles acceptées sur des branches différentes → refus « Deux avenants du devis … sont acceptés (B1 et A2) : annule l'un des deux avant de facturer », **rien n'est réécrit** ; après l'annulation de B1, « Facturer » O répare vers A1 et nomme A2 | T27 ×2 (rouge) |

Tests : **rouge** sur `bd07606` (code AF1-5 sans ces corrections) : **105 réussis, 6 échoués** (T26a, T26b, T27 ×2, T28, et « aucune erreur JavaScript » à cause du rejet non attrapé de T28 — voulu) ; journal gardé hors dépôt (`resAD-af15b-rouge-bd07606-04-11.log`). **Vert** sur `6bb5e20` : **111 réussis, 0 échoué** (76 s). Fichiers : `index.html` (bloc « descendant accepté » de `cpRefusFacture`), `next-signature.js` (`desactiverLiens`, `viderLiensEnAttente`), suite AD (+7 contrôles), `docs/AF1-COMPTE-RENDU.md` (§ 13.2.5, § 13.4.1, en-tête point 10, § 10), ce document. Aucun golden, `sw.js` déjà à 1134 sur la branche.

Batterie complète et CI après ces corrections : § 6 bis.

### 6 bis. Batterie complète et CI (AF1-5 bis)
| Passage | Résultat |
|---|---|
| Batterie complète ici, sur `387a30d` (= code `6bb5e20` + documents ; arbre propre, même environnement qu'au § 6) | **COMPLET, RÉUSSI — 1 396 réussis, 0 échoué, 2 SKIP (les 2 connus), 5 À TRANCHER** inchangés. Comparé suite par suite au passage AF1-5 (§ 6) : **une seule différence, la suite AD 104 → 111** (T26 à T28) ; suite Q 64 / 64 ; golden Y 21 + 5 et Z 55 identiques, W 64 (aucune enveloppe nouvelle), U 27, SQL 66 / 66, fonctions 90 / 90. |
| CI GitHub de `387a30d` (= code `6bb5e20` + documents) | **verte** sur le push ([run 94](https://github.com/gablry8/cp-gl2607/actions/runs/41908851988)) et sur la demande de fusion #10 ([run 95](https://github.com/gablry8/cp-gl2607/actions/runs/41908864940)) : « COMPLET, RÉUSSI — **1 396 réussis, 0 échoué, 2 SKIP** (les 2 connus), 5 À TRANCHER », chiffres identiques au passage local. Les runs 92-93 (`6bb5e20`) ont été annulés par le push des documents (`cancel-in-progress`, même code). Le commit qui inscrit ces lignes ne touche que ce document : sa CI relance la même batterie. |
