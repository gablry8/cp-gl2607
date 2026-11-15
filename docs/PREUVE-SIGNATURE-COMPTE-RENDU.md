# PREUVE-SIGNATURE — signature : verrouillage complet d'une demande, création comprise (15/11/2026)

Branche `correctif/preuve-signature` (depuis `main` = `93efedd`). Serveur seulement : une migration SQL, ses tests et trois scripts à coller. **Aucun fichier de l'appli n'est modifié.** Rien n'est en ligne : tout est **sur la branche**. Exécutant : Opus 5.5. Complément du 15/11 au soir (accord écrit de Gab) : la création d'une demande est aussi verrouillée (§ 4 et § 5).

## Ce que Gab décide / fait, dans l'ordre
1. **TEST** : coller `tests/supabase-test/7-preuve-signature-TEST.sql` dans le SQL Editor du projet ClimPilot-TEST (nouvelle requête, tout le fichier, Run). Attendu : **9 lignes, toutes « OK »** (liste exacte au § 1).
2. **Essai ≈ 5 min sur la copie d'essai** (base TEST) : envoyer un lien de signature, signer depuis un autre appareil, vérifier que le devis passe « Accepté » et que l'appli applique la signature, puis désactiver un autre lien en attente. Étapes et résultats attendus au § 2.
3. **RÉEL** : coller `tests/supabase-test/7-REEL-preuve-signature.sql` dans le SQL Editor du projet réel. Attendu : les **mêmes 9 lignes « OK »** (§ 3).
4. **Fusion** de la demande de fusion (après la relecture par l'autre modèle, règle 12). Rien à déployer côté appli ni côté fonction.
5. En cas de souci après l'étape 1 ou 3 : `tests/supabase-test/7-preuve-signature-retour-arriere.sql` remet les deux fonctions d'avant (5 « OK », § 7).
6. La fusion seule ne change rien en ligne : seul le collage des scripts (étapes 1 et 3) change le serveur.
7. Le détail du constat n'est **pas** dans ce dépôt public (règle 8) : il est dans le compte rendu complet remis à part, à ranger dans le Project.
8. Décidé par Gab le 15/11 : la règle (b) reste telle quelle (marque « appliquée » faux → vrai quel que soit le statut).

## 1. Script TEST : résultat attendu ligne par ligne
Où : supabase.com › projet **ClimPilot-TEST** › SQL Editor › nouvelle requête › coller **tout** `7-preuve-signature-TEST.sql` › Run.

| # | controle | etat |
|---|---|---|
| 1 | cp_sig_guard : présente, security definer, search_path vide | OK |
| 2 | cp_sig_guard : version PREUVE-SIGNATURE (commentaire) | OK |
| 3 | cp_sig_guard : code identique à la migration (empreinte 9da1de9b…) | OK |
| 4 | déclencheur cp_sig_guard : avant chaque modification, ligne par ligne, actif | OK |
| 5 | cp_sig_guard : jamais appelable par l'API (anon, authenticated, public) | OK |
| 6 | fonction publique « signature » (service_role) : lecture et modification de la table gardées | OK |
| 7 | climpilot_signatures : protection par compte inchangée (active, 3 règles, aucune pour la suppression) | OK |
| 8 | cp_sig_insert : version PREUVE-SIGNATURE (empreinte dd8e9e6a…, security definer, search_path vide, déclencheur actif) | OK |
| 9 | cp_sig_insert : jamais appelable par l'API (anon, authenticated, public) | OK |

Messages d'arrêt possibles (voulus, rien n'est modifié) : « STOP : pas de marqueur climpilot_marqueur_test » (ce n'est pas le projet TEST) ; « STOP : cp_sig_guard n'est ni la version lue le 15/11/2026 ni celle de cette migration » ou la même phrase pour `cp_sig_insert` (une fonction en ligne a changé depuis ma lecture : ne pas insister, me transmettre le message). Le script est rejouable : collé deux fois, mêmes 9 « OK ».

## 2. Essai sur la copie d'essai (≈ 5 min, base TEST, après l'étape 1)
1. PC : ouvrir la copie d'essai (bandeau rouge visible), connecté avec le compte du projet TEST. Attendu : l'appli démarre normalement.
2. Ouvrir un devis d'essai › récapitulatif › « ✍️ Faire signer en ligne » › copier le lien. Attendu : lien créé, le devis passe « Envoyé », aucune erreur (la création passe par le déclencheur modifié).
3. Téléphone (ou autre navigateur) : ouvrir le lien › lire › cocher « Bon pour accord » › signer au doigt › valider. Attendu : la page confirme la signature.
4. PC : aller dans l'écran Assistant (ou revenir sur l'onglet de l'appli). Attendu en moins de 2 min : message « ✍️ Devis … signé par … » ; le devis passe « Accepté » avec la signature dans son PDF.
5. PC : quitter puis revenir sur l'onglet (ou recharger). Attendu : le message de l'étape 4 **ne revient pas** (l'appli a bien pu marquer la signature comme appliquée : c'est l'un des deux gestes permis).
6. PC : sur un **autre** devis, « ✍️ Faire signer en ligne » ; puis Assistant › carte « ✍️ En attente de signature » › « Désactiver » › confirmer. Attendu : « Lien désactivé », le lien disparaît de la liste (deuxième geste permis).
7. Téléphone : ouvrir le lien désactivé. Attendu : « Ce lien n'est plus actif », document non affiché.
8. Facultatif, lecture seule sur TEST (SQL Editor) : `select statut, applique, created_at from public.climpilot_signatures order by created_at desc limit 2;` Attendu : `annule | false | <heure de l'étape 6>` puis `signe | true | <heure de l'étape 2>`.

Si une étape affiche « modification interdite » ou « changement de statut interdit » : noter l'étape et le message, ne pas coller le script RÉEL, me le transmettre.

## 3. Script RÉEL
Où : supabase.com › projet **réel** (pas ClimPilot-TEST) › SQL Editor › nouvelle requête › coller **tout** `7-REEL-preuve-signature.sql` › Run. Attendu : les 9 mêmes lignes « OK » qu'au § 1. Collé par erreur sur TEST, il s'arrête (« STOP : marqueur climpilot_marqueur_test présent ») sans rien modifier. Aucune donnée n'est écrite ni lue ; seul le code des deux fonctions de contrôle change.

## 4. Constat
- **Certain** (audit du 14/11, code lu sur le réel ; relu en lecture seule le 15/11 sur le réel et sur TEST, même empreinte ; reproduit sur PostgreSQL 16 local) : la fonction de contrôle `cp_sig_guard`, qui protège une demande de signature contre les modifications du compte connecté, ne couvrait pas toute la ligne. Le document signé, son empreinte et la signature elle-même étaient déjà protégés. Le détail est dans le compte rendu complet (Project), pas ici (règle 8).
- **Certain** (lu le 15/11, reproduit en local) : à la création d'une demande, le déclencheur `cp_sig_insert` calculait l'empreinte et vidait les colonnes de preuve, mais gardait la date de création et le motif de refus envoyés par le compte. Complément demandé par Gab le 15/11 : le serveur impose désormais les deux.
- **Certain** (lu dans le code) : l'appli connectée n'écrit dans `climpilot_signatures` que de trois façons (`next-signature.js`) : création d'une demande (insertion, ligne 49 : `user_id`, `doc_type`, `doc_id`, `doc_num`, `titre`, `client_nom`, `montant_ttc`, `doc_html` — ni date de création ni motif de refus), annulation d'une demande en attente (`statut` → `annule`, trois appels : nouveau lien, devis remplacé ou annulé, bouton « Désactiver »), et marque « appliquée » (`applique` → vrai) après le relevé d'une signature ou d'un refus. `next-assistant.js` ne fait que lire (export complet). Aucun autre fichier de l'appli n'écrit dans cette table. Aucun test ni script n'insère de demande avec une date de création ou un motif de refus. La fonction publique `signature` écrit avec la clé de service (vu, signer, refuser, copie) et ne crée pas de demande.
- **Certain** (lu le 15/11) : en-tête exact des deux fonctions en ligne (réel et TEST) : `LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''`, propriétaire `postgres`, droits `{postgres=X/postgres,service_role=X/postgres}`, aucun commentaire ; déclencheurs `BEFORE UPDATE … FOR EACH ROW` (`cp_sig_guard`) et `BEFORE INSERT … FOR EACH ROW` (`cp_sig_insert`). Le texte en ligne a des fins de ligne Windows (`\r\n`) : les empreintes sont calculées sans elles (`cp_sig_guard` 01fa989c…, `cp_sig_insert` a761e69f…). Aucun des scripts n'avait encore été collé.

## 5. Test rouge → correction → test vert
- **Test** : `tests/sql/test_preuve_signature.py` (27 tests, PostgreSQL local, marqueur `climpilot-test`). Les colonnes sont lues dans `information_schema` : une colonne ajoutée plus tard est vérifiée d'office. Chaque colonne est essayée par le compte connecté sur une demande **signée, refusée, annulée et en attente** (chaque essai dans une transaction annulée ; la ligne est comparée avant / après), et chaque colonne remplie est essayée « vidée » (test 22). Les deux cas permis, seuls puis combinés avec chaque autre colonne ; une mise à jour sans changement ; la fonction publique (vu, signer, refuser, copie, et toutes les colonnes avec la clé de service, avec ou sans identifiant dans le jeton) ; le passage sans identifiant ; un autre compte ; la suppression ; la **création** (test 23 : date de création passée puis future, motif de refus rempli et colonnes de preuve pré-remplies → date du serveur, motif vide, preuves vidées, empreinte calculée) ; la migration rejouée trois fois ; les empreintes de départ du banc = celles du réel ; le retour arrière des deux fonctions ; les scripts (verrous, nombre de lignes, « À REVOIR » sur une base non migrée, arrêt si une fonction en ligne n'est pas celle attendue).
- **Rouge** :
  - contre `main` (`93efedd`, copie de travail) : **17 échecs, 10 réussis** sur 27. Les 10 réussis le sont par construction (lecture des colonnes et comportements gardés : fonction publique ×2, passage sans identifiant, autre compte, suppression, mise à jour sans changement, cas permis seuls, empreintes de départ du banc) ;
  - contre la branche avant le complément (`9c2dedb`, copie de travail) : **6 échecs, 21 réussis** — création (test 23), migration (12), retour arrière (14), scripts (18, 20, 21) ;
  - historique : la première version (25 puis 26 tests) a été prouvée rouge contre `main` par `git stash` (15 / 10) puis par copie de travail (16 / 10). Une tentative par `git stash` sur des fichiers déjà commités n'était pas valable (rien mis de côté) : écartée et notée dans le journal. Journaux gardés hors dépôt (ils nomment les colonnes).
- **Correction** : `supabase/migrations/20261115120000_preuve_signature.sql`, **même fichier** (choix : la migration n'est appliquée nulle part — lu le 15/11 sur le réel et sur TEST — ni fusionnée ; les deux fonctions sont les deux déclencheurs de la même table pour la même mission ; un seul fichier = un seul script à coller, un seul retour arrière, une seule série de contrôles). Elle remplace seulement les corps des deux fonctions (mêmes en-têtes, un commentaire chacune, droits redits) :
  1. `cp_sig_guard` : pour le compte connecté, la ligne entière est comparée ; seuls passent (a) `en_attente` → `annule` sans autre changement, (b) `applique` faux → vrai sans autre changement, et une mise à jour qui ne change rien. Clé de service et passage sans identifiant : inchangés. Messages : « modification interdite », « changement de statut interdit » (courts, sans donnée du client) ;
  2. `cp_sig_insert` : code précédent + `created_at := now()` et `motif_refus := null`.
- **Pourquoi garder le passage « auth.uid() nul »** (modifications) : seul un rôle qui contourne la protection par compte (administration du SQL Editor, clé de service) peut atteindre une ligne sans identifiant, puisque la règle `sig_update` exige `auth.uid() = user_id` et que le visiteur non connecté n'a plus aucun droit sur la table depuis P6.
- **Vert** : 27 / 27. Tous les tests SQL : **93 / 93** (66 existants + 27), dont `test_p6_droits.py` et `test_migration.py`. Sous `faketime` samedi 14/11/2026, dimanche 15/11/2026 et 05/01/2027 : 93 / 93 à chaque fois.
- **Mutations** (fonction modifiée exprès, puis remise à l'identique) : **9 sur 9 détectées** — cas (a) sans contrôle des autres colonnes, cas (b) idem, mise à jour sans changement refusée, passage sans identifiant retiré, passage de la clé de service retiré, (a) permis depuis tout statut, (b) permis dans les deux sens, création sans date imposée, création sans motif vidé.

## 6. Batterie et CI
- **Batterie complète en session, première version** (contenu de `e133202`, isolation du noyau active) : code 0, **COMPLET, RÉUSSI — 1 638 réussis, 0 échoué, 0 SKIP, 5 « À TRANCHER »** (les 5 mêmes que sur `main`, suite Y, M3 C2, en attente de la comptable). Comparée étape par étape à la CI de `main` (`93efedd`, run 43418172493 : 1 608 / 0 / 2 SKIP connus / 5) : seules `sql` (66 → 92) et `autotest-isolation` (16 + 2 SKIP → 20 + 0 SKIP : isolation du noyau présente en session, absente sur la CI) diffèrent.
- **CI de la première version** (`9c2dedb`, runs 43758686512 et 43758690916, verts au premier essai) : 1 634 / 0 / 2 SKIP connus / 5 « À TRANCHER » sur les deux événements ; seule l'étape `sql` change par rapport à `main` (66 → 92).
- **Complément (création)** : batterie complète en session et CI : voir § 6 bis.

## 6 bis. Complément : batterie et CI
Batterie complète relancée en session sur le code final, et CI (`.github/workflows/tests.yml`, contrôle « batterie complète ») sur la tête finale pour les deux événements. Chaque push annule le run en cours de la même branche : les résultats sont notés dans la description de la demande de fusion [gablry8/cp-gl2607#27](https://github.com/gablry8/cp-gl2607/pull/27) et dans le message à Gab. Attendu : seule l'étape `sql` change par rapport à `main` (66 → 93).

## 7. Retour arrière
`tests/supabase-test/7-preuve-signature-retour-arriere.sql` : remet `cp_sig_guard` **et** `cp_sig_insert` telles qu'elles ont été lues en ligne le 15/11 (mêmes en-têtes, même code, sans commentaire ; empreintes `01fa989c…` et `a761e69f…` vérifiées), sans toucher aux déclencheurs, aux règles, aux droits ni aux données. **5 lignes « OK »** attendues. Rejouable. Prouvé sur le banc (test 14 : retour arrière collé deux fois, empreintes du réel retrouvées, puis migration de nouveau appliquée et vérifiée sur une modification et une création).

## 8. Ce qui n'a pas pu être vérifié, et points ouverts
1. **Décidé (Gab, 15/11)** : la règle (b) reste telle quelle (marque « appliquée » faux → vrai quel que soit le statut). L'appli ne le fait que sur une demande signée ou refusée.
2. **Non vérifié** : PostgreSQL 17 de Supabase (banc local en 16) et l'appli réelle contre les nouvelles fonctions : c'est l'objet des étapes 1 et 2 de l'en-tête.
3. **Non vérifié** : le collage par le SQL Editor (fins de ligne) ; les contrôles comparent le code sans les retours chariot, donc un collage depuis Windows reste « OK ».
4. Le serveur simulé des suites navigateur (`tests/serveur-simule.mjs`) n'imite ni la modification ni la création côté serveur (il ne les imitait pas avant non plus) : hors périmètre (fichier interdit pour cette mission).
5. `tests/LISEZMOI.md` (interdit pour cette mission) n'a pas la ligne du nouveau test ; texte proposé au § 10.
6. Fonction `signature` (P2) : version 4 en ligne sur le réel, **code identique** au fichier du dépôt de l'`import` à la fin (comparaison ligne à ligne le 15/11) ; seul l'en-tête de commentaires disait encore « v3 / non déployé » : corrigé, aucune ligne de code changée, aucun déploiement. Sur TEST : version 1, même logique (lue, comparée à l'œil seulement : **probable**).

## 9. Fichiers (`git diff --stat origin/main...HEAD`)
```
 docs/ESSAIS-SUPABASE-TEST.md                       |  12 +
 docs/PREUVE-SIGNATURE-COMPTE-RENDU.md              | (ce fichier)
 supabase/functions/signature/index.ts              |  13 +-   (commentaires seulement)
 .../migrations/20261115120000_preuve_signature.sql |  80 +++
 tests/sql/test_preuve_signature.py                 | 593 +++++
 tests/supabase-test/7-REEL-preuve-signature.sql    | 159 +++++
 tests/supabase-test/7-preuve-signature-TEST.sql    | 165 +++++
 .../7-preuve-signature-retour-arriere.sql          |  83 +++
```
Aucun fichier de l'appli (`index.html`, `sw.js`, `signer.html`, `next-*.js`, `vendor/`), ni `tests/run-all.sh`, `tests/isolation/`, `tests/*.mjs`, `tests/LISEZMOI.md`, `docs/FILE-DES-MISSIONS.md`, `docs/APRES-PRO-V1.md`, `CLAUDE.md`. Cache (`sw.js`) inchangé : aucun fichier mis en cache n'est modifié. Aucun golden ne change.
**Conflits** : `git merge-tree` contre `origin/correctif/compte` : aucun conflit, aucun fichier en commun. Aucune branche P11-A sur le dépôt distant au 15/11 (`git fetch --prune`).

## 10. Lignes à ajouter (par Gab ou la mission suivante ; fichiers interdits ici)
- `docs/FILE-DES-MISSIONS.md`, tableau « Maintenant », nouvelle ligne :
  `| 9 | **PREUVE-SIGNATURE** : signature, verrouillage complet d'une demande, création comprise (serveur seulement) | `correctif/preuve-signature` | **fait le 15/11** (Opus 5.5) : migration `20261115120000_preuve_signature.sql` (cp_sig_guard + cp_sig_insert), scripts `tests/supabase-test/7-…` (TEST 9 « OK », RÉEL 9 « OK », retour arrière 5 « OK ») ; SQL 93 / 0 (27 nouveaux ; rouge sur main 17 / 10) ; mutations 9 / 9 ; demande de fusion #27 en brouillon ; décision (b) gardée le 15/11 ; `docs/PREUVE-SIGNATURE-COMPTE-RENDU.md` | relecture par l'autre modèle (`relecture-p10`) ; Gab colle 7-…-TEST.sql, essai 5 min, 7-REEL-…sql, fusionne | relecteur puis Gab |`
- `tests/LISEZMOI.md` : « `tests/sql/test_preuve_signature.py` (27 tests, PostgreSQL local) : signature, verrouillage complet d'une demande, création comprise (toutes les colonnes lues dans information_schema, quatre états, deux cas permis, fonction publique inchangée, date de création et motif de refus imposés à la création, retour arrière des deux fonctions, scripts `tests/supabase-test/7-…`). `7-preuve-signature-TEST.sql` (verrou par marqueur, 9 « OK »), `7-REEL-preuve-signature.sql` (refuse le projet TEST, 9 « OK »), `7-preuve-signature-retour-arriere.sql` (5 « OK »). »

## 11. Relecture (règle 12)
Relecture par l'autre modèle (skill `relecture-p10`), en lecture seule, avant toute fusion. Fichiers à joindre :
1. `supabase/migrations/20261115120000_preuve_signature.sql`
2. `tests/sql/test_preuve_signature.py`
3. `tests/supabase-test/7-preuve-signature-TEST.sql`
4. `tests/supabase-test/7-REEL-preuve-signature.sql`
5. `tests/supabase-test/7-preuve-signature-retour-arriere.sql`
6. `docs/PREUVE-SIGNATURE-COMPTE-RENDU.md` (ce fichier)
7. pour le contexte : `next-signature.js` (écrits de l'appli), `supabase/functions/signature/index.ts` (fonction publique), `supabase/migrations/20261002120000_documents_emis.sql` § 6 (versions précédentes des deux fonctions), `tests/sql/01_base_actuelle.sql`, `tests/sql/00_supabase_emul.sql`
8. le compte rendu complet privé (Project `claude/ClimPilot-PREUVE-SIGNATURE-compte-rendu.md`), **hors dépôt**.
