# PREUVE-SIGNATURE — signature : verrouillage complet d'une demande après signature (15/11/2026)

Branche `correctif/preuve-signature` (depuis `main` = `93efedd`). Serveur seulement : une migration SQL, ses tests et trois scripts à coller. **Aucun fichier de l'appli n'est modifié.** Rien n'est en ligne : tout est **sur la branche**. Exécutant : Opus 5.5.

## Ce que Gab décide / fait, dans l'ordre
1. **TEST** : coller `tests/supabase-test/7-preuve-signature-TEST.sql` dans le SQL Editor du projet ClimPilot-TEST (nouvelle requête, tout le fichier, Run). Attendu : **8 lignes, toutes « OK »** (liste exacte au § 1).
2. **Essai ≈ 5 min sur la copie d'essai** (base TEST) : envoyer un lien de signature, signer depuis un autre appareil, vérifier que le devis passe « Accepté » et que l'appli applique la signature, puis désactiver un autre lien en attente. Étapes et résultats attendus au § 2.
3. **RÉEL** : coller `tests/supabase-test/7-REEL-preuve-signature.sql` dans le SQL Editor du projet réel. Attendu : les **mêmes 8 lignes « OK »** (§ 3).
4. **Fusion** de la demande de fusion (après la relecture par l'autre modèle, règle 12). Rien à déployer côté appli ni côté fonction.
5. En cas de souci après l'étape 1 ou 3 : `tests/supabase-test/7-preuve-signature-retour-arriere.sql` remet la fonction d'avant (3 « OK », § 7).
6. La fusion seule ne change rien en ligne : seul le collage des scripts (étapes 1 et 3) change le serveur.
7. Le détail du constat (colonnes, scénario) n'est **pas** dans ce dépôt public (règle 8) : il est dans le compte rendu complet remis à part, à ranger dans le Project.
8. Une précision possible (non faite, à décider) : § 8, point 1.

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
| 8 | déclencheur d'insertion cp_sig_insert inchangé (code lu le 15/11/2026, actif) | OK |

Messages d'arrêt possibles (voulus, rien n'est modifié) : « STOP : pas de marqueur climpilot_marqueur_test » (ce n'est pas le projet TEST) ; « STOP : cp_sig_guard n'est ni la version lue le 15/11/2026 ni celle de cette migration » (la fonction en ligne a changé depuis ma lecture : ne pas insister, me transmettre le message). Le script est rejouable : collé deux fois, mêmes 8 « OK ».

## 2. Essai sur la copie d'essai (≈ 5 min, base TEST, après l'étape 1)
1. PC : ouvrir la copie d'essai (bandeau rouge visible), connecté avec le compte du projet TEST. Attendu : l'appli démarre normalement.
2. Ouvrir un devis d'essai › récapitulatif › « ✍️ Faire signer en ligne » › copier le lien. Attendu : lien créé, le devis passe « Envoyé », aucune erreur.
3. Téléphone (ou autre navigateur) : ouvrir le lien › lire › cocher « Bon pour accord » › signer au doigt › valider. Attendu : la page confirme la signature.
4. PC : aller dans l'écran Assistant (ou revenir sur l'onglet de l'appli). Attendu en moins de 2 min : message « ✍️ Devis … signé par … » ; le devis passe « Accepté » avec la signature dans son PDF.
5. PC : quitter puis revenir sur l'onglet (ou recharger). Attendu : le message de l'étape 4 **ne revient pas** (l'appli a bien pu marquer la signature comme appliquée : c'est l'un des deux gestes permis).
6. PC : sur un **autre** devis, « ✍️ Faire signer en ligne » ; puis Assistant › carte « ✍️ En attente de signature » › « Désactiver » › confirmer. Attendu : « Lien désactivé », le lien disparaît de la liste (deuxième geste permis).
7. Téléphone : ouvrir le lien désactivé. Attendu : « Ce lien n'est plus actif », document non affiché.
8. Facultatif, lecture seule sur TEST (SQL Editor) : `select statut, applique from public.climpilot_signatures order by created_at desc limit 2;` Attendu : `annule | false` puis `signe | true`.

Si une étape affiche « modification interdite » ou « changement de statut interdit » : noter l'étape et le message, ne pas coller le script RÉEL, me le transmettre.

## 3. Script RÉEL
Où : supabase.com › projet **réel** (pas ClimPilot-TEST) › SQL Editor › nouvelle requête › coller **tout** `7-REEL-preuve-signature.sql` › Run. Attendu : les 8 mêmes lignes « OK » qu'au § 1. Collé par erreur sur TEST, il s'arrête (« STOP : marqueur climpilot_marqueur_test présent ») sans rien modifier. Aucune donnée n'est écrite ni lue ; seul le code de la fonction de contrôle change.

## 4. Constat
- **Certain** (audit du 14/11, code lu sur le réel ; relu en lecture seule le 15/11 sur le réel et sur TEST, même empreinte ; reproduit sur PostgreSQL 16 local) : la fonction de contrôle `cp_sig_guard`, qui protège une demande de signature contre les modifications du compte connecté, ne couvrait pas toute la ligne. Le document signé, son empreinte et la signature elle-même étaient déjà protégés. Le détail est dans le compte rendu complet (Project), pas ici (règle 8).
- **Certain** (lu dans le code) : l'appli connectée n'écrit dans `climpilot_signatures` que de trois façons (`next-signature.js`) : création d'une demande (insertion), annulation d'une demande en attente (`statut` → `annule`, trois appels : nouveau lien, devis remplacé ou annulé, bouton « Désactiver »), et marque « appliquée » (`applique` → vrai) après le relevé d'une signature ou d'un refus. `next-assistant.js` ne fait que lire (export complet). Aucun autre fichier de l'appli n'écrit dans cette table. La fonction publique `signature` écrit avec la clé de service (vu, signer, refuser, copie).
- **Certain** (lu le 15/11) : en-tête exact de la fonction en ligne (réel et TEST) : `LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''`, propriétaire `postgres`, droits `{postgres=X/postgres,service_role=X/postgres}`, aucun commentaire, déclencheur `BEFORE UPDATE … FOR EACH ROW`. Le texte en ligne a des fins de ligne Windows (`\r\n`) : les empreintes sont calculées sans elles.

## 5. Test rouge → correction → test vert
- **Test** : `tests/sql/test_preuve_signature.py` (25 tests, PostgreSQL local, marqueur `climpilot-test`). Les colonnes sont lues dans `information_schema` : une colonne ajoutée plus tard est vérifiée d'office. Chaque colonne est essayée par le compte connecté sur une demande **signée, refusée, annulée et en attente** (chaque essai dans une transaction annulée ; la ligne est comparée avant / après). Les deux cas permis, seuls puis combinés avec chaque autre colonne ; une mise à jour sans changement ; la fonction publique (vu, signer, refuser, copie, et toutes les colonnes avec la clé de service, avec ou sans identifiant dans le jeton) ; le passage sans identifiant ; un autre compte ; la suppression ; la migration rejouée trois fois ; l'empreinte de départ du banc = celle du réel ; le retour arrière ; les scripts (verrous, nombre de lignes, « À REVOIR » sur une base non migrée, arrêt si la fonction en ligne n'est pas celle attendue).
- **Rouge sur l'ancien code** (`main` `93efedd`, migration et scripts mis de côté par `git stash`) : **15 échecs, 10 réussis** — les 4 états, les deux cas permis combinés, la migration, le retour arrière et les scripts. Journal gardé hors dépôt (il nomme les colonnes).
- **Correction** : `supabase/migrations/20261115120000_preuve_signature.sql` remplace seulement le corps de `cp_sig_guard` (même en-tête). Pour le compte connecté : la ligne entière est comparée ; seuls passent (a) `en_attente` → `annule` sans autre changement, (b) `applique` faux → vrai sans autre changement, et une mise à jour qui ne change rien. Clé de service et passage sans identifiant : inchangés. Messages : « modification interdite », « changement de statut interdit » (courts, sans donnée du client).
- **Pourquoi garder le passage « auth.uid() nul »** : seul un rôle qui contourne la protection par compte (administration du SQL Editor, clé de service) peut atteindre une ligne sans identifiant, puisque la règle `sig_update` exige `auth.uid() = user_id` et que le visiteur non connecté n'a plus aucun droit sur la table depuis P6.
- **Vert** : 25 / 25. Tous les tests SQL : **91 / 91** (66 existants + 25), dont `test_p6_droits.py` et `test_migration.py`. Sous `faketime` samedi 14/11/2026, dimanche 15/11/2026 et 05/01/2027 : 91 / 91 à chaque fois.
- **Mutations** (fonction modifiée exprès, puis remise à l'identique) : 7 sur 7 détectées — cas (a) sans contrôle des autres colonnes, cas (b) idem, mise à jour sans changement refusée, passage sans identifiant retiré, passage de la clé de service retiré, (a) permis depuis tout statut, (b) permis dans les deux sens.

## 6. Batterie et CI
- Batterie complète (un passage, en session) : _à compléter_.
- CI de la branche : _à compléter_.
- Référence `main` (`93efedd`, CI du 13/11, run 43418172493) : 1 608 réussis / 0 échoué / 2 SKIP connus / 5 « À TRANCHER » ; étape `sql` : 66.

## 7. Retour arrière
`tests/supabase-test/7-preuve-signature-retour-arriere.sql` : remet `cp_sig_guard` telle qu'elle a été lue en ligne le 15/11 (même en-tête, même code, sans commentaire ; empreinte `01fa989c…` vérifiée), sans toucher au déclencheur, aux règles, aux droits ni aux données. 3 lignes « OK » attendues. Rejouable. Prouvé sur le banc (test 14 : retour arrière collé deux fois, empreinte du réel retrouvée, puis migration de nouveau appliquée).

## 8. Ce qui n'a pas pu être vérifié, et points ouverts
1. **À décider (Gab)** : la règle (b) permet `applique` faux → vrai quel que soit le statut, comme demandé. L'appli ne le fait que sur une demande signée ou refusée. Une version plus stricte (b seulement sur `signe` / `refuse`) est possible ; non faite sans ta décision.
2. **Non vérifié** : PostgreSQL 17 de Supabase (banc local en 16) et l'appli réelle contre la nouvelle fonction : c'est l'objet des étapes 1 et 2 de l'en-tête.
3. **Non vérifié** : le collage par le SQL Editor (fins de ligne) ; les contrôles comparent le code sans les retours chariot, donc un collage depuis Windows reste « OK ».
4. Le serveur simulé des suites navigateur (`tests/serveur-simule.mjs`) n'imite pas ce contrôle (il ne l'imitait pas avant non plus) : hors périmètre (fichier interdit pour cette mission).
5. `tests/LISEZMOI.md` (interdit pour cette mission) n'a pas la ligne du nouveau test ; texte proposé au § 10.
6. Fonction `signature` (P2) : version 4 en ligne sur le réel, **code identique** au fichier du dépôt de l'`import` à la fin (comparaison ligne à ligne le 15/11) ; seul l'en-tête de commentaires disait encore « v3 / non déployé » : corrigé, aucune ligne de code changée, aucun déploiement. Sur TEST : version 1, même logique (lue, comparée à l'œil seulement : **probable**).

## 9. Fichiers (`git diff --stat origin/main`)
_à compléter_

## 10. Lignes à ajouter (par Gab ou la mission suivante ; fichiers interdits ici)
- `docs/FILE-DES-MISSIONS.md`, tableau « Maintenant » : _à compléter_
- `tests/LISEZMOI.md` : « `tests/sql/test_preuve_signature.py` (25 tests, PostgreSQL local) : signature, verrouillage complet d'une demande (toutes les colonnes lues dans information_schema, quatre états, deux cas permis, fonction publique inchangée, retour arrière, scripts `tests/supabase-test/7-…`). `7-preuve-signature-TEST.sql` (verrou par marqueur, 8 « OK »), `7-REEL-preuve-signature.sql` (refuse le projet TEST, 8 « OK »), `7-preuve-signature-retour-arriere.sql` (3 « OK »). »

## 11. Relecture (règle 12)
_à compléter_
