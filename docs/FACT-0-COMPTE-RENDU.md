# ClimPilot — Mission FACT-0 : de quoi installer la fonction `superpdp` sur le projet TEST — compte rendu

> Rédigé le 18/11/2026 par Claude (Opus 5.5), **exécutant** de la mission. Relecture à faire par l'autre modèle (Fable 5.1, skill `relecture-p10`).
> Branche **`outillage/fact-pdp-test`**, partie de `origin/main` = `93efedd`. Demande de fusion **en brouillon** : voir § 4.3. **Tests et scripts SQL seulement** : aucun fichier de l'appli, aucune fonction, aucune migration, rien de déployé, **rien écrit sur Supabase** (ni réel ni TEST).
> Dossier de la mission : `docs/MISSION-FACT.md` § 1.5, 1.6, 2.1, 5.1 à 5.4, 5.6.
> **Pas d'outil Projects dans cette session** : la copie `claude/ClimPilot-FACT-0-compte-rendu.md` (avec le relevé détaillé du réel) **n'est pas faite** ; son texte est remis à Gab hors dépôt (message de fin de session). La mission n'en dépendait pas.
> **Lecture en ligne** (connecteur Supabase, requêtes `select` uniquement, le 18/11/2026) : sur TEST et sur le réel, structure, règles et droits seulement ; aucune ligne de données lue, rien lu dans le coffre.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**. Journaux rouge / vert et copies mutées : **hors dépôt** (dossier de travail de la session, effacé avec elle) ; les chiffres utiles sont recopiés ici.

## Ce que Gab décide / fait (dans l'ordre)

1. Relecture par **Fable 5.1** (`relecture-p10`, fichiers § 9), puis fusion de la demande de fusion (en brouillon). Rien à faire sur les appareils.
2. **Geste 3** — Supabase **TEST** › SQL Editor : coller tout `tests/supabase-test/8-pdp-TEST.sql` › Run. Attendu : **15 lignes, toutes « OK »** (liste § 2.1). Un « STOP » ou un « À REVOIR » : s'arrêter, noter l'affichage.
3. **Geste 4a** — TEST › Authentication › Users : copier l'identifiant **du compte de TEST** (pas celui du réel) ; Edge Functions › Secrets : `ALLOWED_USER_IDS` = cet identifiant (§ 2.2).
4. **Geste 4b** — TEST › Edge Functions : déployer `superpdp` (tout `supabase/functions/superpdp/index.ts` de `main`), vérification du jeton activée. Attendu dans la copie d'essai : « 🔌 Connecter SUPER PDP » (§ 2.2, messages possibles et quoi faire).
5. **Geste 5** — copie d'essai › Facture électronique : connecter le **bac à sable** ; attendu « 🧪 Connecté — compte de TEST ». Puis, en lecture seule sur TEST : `select env, company->>'env_brut' as env_brut, updated_at from public.climpilot_pdp;` → `sandbox`, `sandbox` (§ 2.3).
6. Facultatif, quand tu veux : sur le **réel**, `tests/supabase-test/8-REEL-pdp-lecture.sql` (lecture seule) → **15 « OK »** (§ 2.4). Ma lecture du 18/11 n'a trouvé aucun écart avec le dépôt (§ 1.2).
7. Retour arrière sur TEST si besoin : `8-pdp-retour-arriere.sql` (4 « OK ») ; il **refuse** tant qu'une connexion est enregistrée : « Déconnecter » d'abord (§ 6). Garde-fou voulu.
8. Copier le texte remis hors dépôt dans le Project (`claude/ClimPilot-FACT-0-compte-rendu.md`) : l'outil manquait ici.
9. Lignes proposées pour `docs/FILE-DES-MISSIONS.md` et `docs/ESSAIS-SUPABASE-TEST.md` (non touchés, interdit ici) : § 8.
10. Rien à trancher dans cette mission. Une information (§ 1.3) : sur TEST, l'appli connectée garde le droit de **lire sa propre ligne** de la table, comme sur le réel (règle donnée : le réel fait foi pour la copie conforme).

---

## 1. Constat (lecture seule en ligne du 18/11/2026)

### 1.1 Projet TEST (certain)
- Marqueur `public.climpilot_marqueur_test` : **présent**. Registre `climpilot_documents` : présent.
- Table `climpilot_pdp` : **absente**. Fonctions `pdp_cred_set`, `pdp_cred_get`, `pdp_cred_delete` (et toute fonction `pdp…`) : **absentes**. Le constat du dossier (§ 1.6, « probable pour le projet ») est confirmé : **certain**.
- Coffre de Supabase (Vault) : **présent** (extension `supabase_vault` 0.3.1 ; `vault.create_secret`, `vault.update_secret`, `vault.secrets`, `vault.decrypted_secrets`) ; le rôle `postgres` (celui du SQL Editor) peut s'en servir ; le visiteur non connecté et l'appli connectée n'y ont pas accès. Aucune valeur rangée.
- Pas de déclencheur qui active seul la protection par compte sur une nouvelle table (le réel en a un) : le script l'active lui-même.
- Droits par défaut des nouvelles tables et fonctions du schéma `public` : les mêmes que sur le réel (tout pour `anon`, `authenticated`, `service_role`) : le script les retire lui-même.

### 1.2 Projet réel, comparé à `supabase/schema.sql` (certain)
- **Fonctions** : texte complet (`pg_get_functiondef`) relevé ; mêmes corps que `supabase/schema.sql` (prouvé par le test 07 : les trois fonctions du fichier donnent la même empreinte que le réel). Propriétaire `postgres`, `security definer`, `search_path` = `public, vault`, exécution par **`service_role` seulement** (rien pour `public`, `anon`, `authenticated`).
- **Table** : 6 colonnes (`user_id`, `client_id`, `secret_id`, `env`, `company`, `updated_at`), clé `user_id` liée au compte, protection par compte activée, une seule règle (chacun lit sa propre ligne), aucun droit pour le visiteur non connecté, l'appli connectée en lecture seule, `service_role` lit et écrit. `supabase/schema.sql` ne donne qu'un résumé en commentaire (pas les « non nul », le défaut de date ni l'effacement avec le compte) : **pas contradictoire**, moins précis. Le script TEST suit le réel.
- **Écart de droits sur le réel** : **aucun** dans le périmètre lu. Relevé détaillé : compte rendu du Project (à copier, ligne 8).
- Le coffre du réel : même version et mêmes droits que sur TEST.

### 1.3 Une information, pas une décision
La consigne de la mission dit « droits : rien pour public, anon, authenticated ; exécution pour service_role seulement ». Pour les **trois fonctions**, c'est exactement le réel et le script. Pour la **table**, le réel laisse à l'appli connectée la lecture de **sa propre ligne** (règle « lecture si propriétaire » du dossier § 5.3) et rien d'autre d'utile ; le script TEST fait pareil (copie conforme, le réel fait foi). L'appli ne lit pas cette table aujourd'hui (seule la fonction serveur la lit, avec `service_role`) : **certain** (recherche dans tout le code). Si tu préfères que TEST soit plus strict que le réel, c'est une ligne du script à changer ; je ne l'ai pas fait.

## 2. Tes gestes, pas à pas (libellés du tableau de bord Supabase : **hypothèse**, ils changent souvent)

### 2.1 Geste 3 — le script sur TEST (≈ 3 min)
1. supabase.com › projet **ClimPilot-TEST** (vérifie le nom en haut de la page) › **SQL Editor** › nouvelle requête.
2. Ouvre `tests/supabase-test/8-pdp-TEST.sql` sur GitHub (branche `main` après la fusion) › bouton « Raw » › tout copier › coller dans l'éditeur › **Run**.
3. Attendu : un tableau de **15 lignes**, colonne `etat` = **OK** partout, dans cet ordre :

| # | contrôle | attendu |
|---|---|---|
| 1 | coffre de Supabase (Vault) présent et utilisable par le propriétaire des fonctions (postgres) | OK |
| 2 | table climpilot_pdp présente | OK |
| 3 | climpilot_pdp : colonnes conformes au réel | OK |
| 4 | climpilot_pdp : clé user_id, liée au compte (effacée avec lui) | OK |
| 5 | climpilot_pdp : protection par compte activée | OK |
| 6 | climpilot_pdp : une seule règle, chacun lit sa propre ligne (authenticated) | OK |
| 7 | climpilot_pdp : aucun droit pour le visiteur non connecté (anon) ni pour public | OK |
| 8 | climpilot_pdp : appli connectée (authenticated) en lecture seule | OK |
| 9 | climpilot_pdp : service_role lit et écrit | OK |
| 10 | pdp_cred_set : présente, copie conforme du réel | OK |
| 11 | pdp_cred_get : présente, copie conforme du réel | OK |
| 12 | pdp_cred_delete : présente, copie conforme du réel | OK |
| 13 | table et trois fonctions : propriétaire postgres | OK |
| 14 | trois fonctions : aucun droit pour public, anon, authenticated | OK |
| 15 | trois fonctions : exécutables par service_role | OK |

4. **Sinon** :
   - message « STOP : pas de marqueur… » : tu n'es pas sur le projet TEST → ne rien faire d'autre ;
   - « STOP : coffre de Supabase (Vault) absent… » ou « …ne peut pas se servir du coffre… » : rien n'a été créé ; transmets le message ;
   - « STOP : à exécuter avec le rôle postgres… » : l'éditeur n'est pas sur le rôle `postgres` (sélecteur de rôle de l'éditeur, s'il existe) ;
   - une ligne « À REVOIR » : ne pas passer au geste 4, transmets le tableau.
5. Recoller le script plus tard ne change rien (rejouable), même après le geste 5.

### 2.2 Geste 4 — le secret, puis la fonction (≈ 10 min). **Dans cet ordre.**
**4a. Le secret `ALLOWED_USER_IDS`**
1. TEST › **Authentication** › **Users** : repère le compte avec lequel tu te connectes dans la **copie d'essai** (colonne e-mail), ouvre-le, copie son identifiant (« User UID », 36 caractères `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Ce n'est **pas** le même que sur le réel.
2. TEST › **Edge Functions** › **Secrets** › « Add new secret » : nom `ALLOWED_USER_IDS`, valeur = l'identifiant copié (sans espace, sans guillemets) › Save. S'il existe déjà : le modifier.
3. Attendu : `ALLOWED_USER_IDS` dans la liste, valeur masquée.

**4b. La fonction `superpdp`**
1. Sur GitHub, `main` › `supabase/functions/superpdp/index.ts` › « Raw » › tout copier (1re ligne : `// ClimPilot — Edge Function « superpdp »`).
2. TEST › **Edge Functions** › « Deploy a new function » › « Via Editor » ; nom : **`superpdp`** (exactement, en minuscules) ; remplace tout le code d'exemple par le texte copié › « Deploy ».
3. Réglages de la fonction : vérification du jeton (« Verify JWT ») **activée** (valeur par défaut).
4. Attendu : `superpdp` dans la liste, avec la date du jour. Une erreur au déploiement : copier le message, s'arrêter.
5. Contrôle dans la copie d'essai (connecté au cloud avec le compte de TEST) › **⚡ Facture électronique**. Attendu : **« 🔌 Connecter SUPER PDP »** et les champs `client_id` / `client_secret`. Autres affichages :

| Affichage | Cause probable | Quoi faire |
|---|---|---|
| « Le service « superpdp » n'est pas installé sur ton serveur ClimPilot… » | fonction absente ou mal nommée | refaire 4b avec le nom `superpdp` |
| « Accès à la plateforme non configuré sur le serveur (ALLOWED_USER_IDS). » | secret absent ou vide | refaire 4a |
| « interdit » | le secret ne contient pas l'identifiant du compte connecté (souvent : celui du réel) | corriger la valeur (4a) ; si rien ne change, redéployer (4b) |
| « Connecte-toi au cloud ClimPilot… » | pas connecté dans la copie d'essai | se connecter |

### 2.3 Geste 5 — le bac à sable depuis la copie d'essai (≈ 5 min)
1. Copie d'essai (bandeau rouge « VERSION D'ESSAI »), connectée au cloud avec le compte de TEST › **⚡ Facture électronique**.
2. Colle le `client_id` et le `client_secret` de ton compte **bac à sable** SUPER PDP › « Connecter ».
3. Attendu : **« 🧪 Connecté — compte de TEST »**, le nom de la société de test, la ligne « Bac à sable : … ».
   - « Enregistrement des identifiants impossible : … » : le geste 3 manque ou n'avait pas 15 « OK » → le refaire, puis « Connecter » de nouveau.
   - « ✅ Connecté — compte réel », ou une ligne « Type de compte annoncé par la plateforme : « … » » : **STOP**, ne rien envoyer, « Déconnecter », transmets la valeur affichée.
   - un refus de la plateforme (identifiants) : vérifie les deux codes dans ton espace SUPER PDP de test.
4. Contrôle en **lecture seule**, TEST › SQL Editor :
   `select env, company->>'env_brut' as env_brut, updated_at from public.climpilot_pdp;`
   Attendu : **1 ligne**, `sandbox`, `sandbox`, la date et l'heure de l'étape 2. Autre valeur : STOP, transmettre. (Point L3 de la liste du 01/06/2027, `docs/MISSION-FACT.md` § 4.1.)
5. Ta copie d'essai doit contenir le `next-superpdp.js` de `main` (règle « bac à sable seulement si `sandbox` », P6+, 03/11/2026). Si elle a été construite avant, la faire reconstruire (`tools/essai/construire-copie-essai.sh`) : **probable** que le résultat attendu soit le même, la plateforme annonçant `sandbox`.

### 2.4 Facultatif — lecture seule sur le réel (≈ 2 min)
supabase.com › projet **réel** › SQL Editor › coller tout `tests/supabase-test/8-REEL-pdp-lecture.sql` › Run. Attendu : **15 lignes « OK »**, les mêmes que § 2.1. Le script se met en lecture seule dès sa 1re ligne (une écriture serait refusée par la base) et s'arrête (« STOP ») s'il voit le marqueur de TEST. Il ne lit ni ligne de la table ni coffre.

## 3. Tests : rouge, puis vert

### 3.1 Le test (`tests/sql/test_pdp_identifiants.py`, PostgreSQL 16 local, marqueur `climpilot-test`) — 31 contrôles pytest
Base neuve à chaque test : Supabase imité **avec un coffre minimal** + base actuelle + toutes les migrations du dépôt.
- Verrous du script TEST : sans marqueur → STOP, rien créé (01) ; coffre absent → STOP, rien créé (02) ; autre rôle que `postgres` → STOP, rien créé (03).
- Script joué deux fois : 15 « OK » à chaque fois, aucune ligne écrite, coffre inchangé, la 2e fois ne change rien (photo du catalogue identique) (04) ; rejoué après une connexion : la ligne et la valeur restent (05).
- Copie conforme : colonnes, clés, protection par compte, règle, propriétaire, empreintes des trois fonctions et droits = relevé du réel du 18/11 (06) ; les trois fonctions de `supabase/schema.sql` = relevé du réel (07).
- Droits : `anon` et `authenticated` ne peuvent appeler aucune des trois fonctions (refus de la base), `service_role` oui (08) ; table : chacun lit sa propre ligne, aucune écriture hors `service_role`, rien pour le visiteur, coffre inaccessible à l'appli (09).
- Enregistrer / relire / remplacer / effacer un identifiant (valeurs fictives) : la table ne garde que la référence du coffre ; une 2e connexion garde la même place dans le coffre ; effacer retire la ligne **et** la valeur ; l'autre compte n'est pas touché (10).
- Retour arrière : refus si la table n'est pas vide, rien retiré (11) ; table vide → 4 « OK », rejouable, puis réinstallation possible (12) ; sans marqueur → STOP (13).
- Script du réel : 15 « OK », rien modifié, lecture seule effective (une écriture ajoutée à la suite est refusée par la base) (14) ; marqueur présent → STOP (15) ; mêmes contrôles, mot pour mot, que le script TEST (16).
- Les contrôles savent dire « À REVOIR » : base sans les objets → 14 « À REVOIR » (le coffre, lui, « OK ») (17) ; 13 dégâts un par un (fonction absente, droit donné à `authenticated` ou `public`, droit retiré à `service_role`, écriture donnée à l'appli, lecture donnée au visiteur, protection retirée, 2e règle, colonne changée, lien au compte retiré, corps de fonction changé, coffre absent) → chacun allume exactement sa ligne (18).
- Garde P6 : après le script, aucun droit pour le visiteur non connecté sur aucun objet de `public` (19).
- `tests/sql/00_supabase_emul.sql` : **ajout seulement** (44 lignes en fin de fichier, 0 retirée) : coffre imité, mêmes noms et signatures que Supabase, droits `service_role` seulement, **aucun chiffrement** (texte encodé, pour voir qu'il n'est pas rangé tel quel).

### 3.2 Rouge sur `main` (certain, journal hors dépôt)
- Scripts absents, imitation de `main` (sans coffre) : **31 échecs / 31**.
- Scripts absents, imitation avec le coffre : **30 échecs, 1 réussi** (le 07, qui compare `supabase/schema.sql` au réel : il ne dépend pas des scripts).

### 3.3 Vert (certain)
- `pytest tests/sql/test_pdp_identifiants.py` : **31 / 31**.
- Mutations des scripts (copies hors dépôt, restaurées) : chaque verrou neutralisé (`if false`) fait échouer **exactement son test** (marqueur TEST → 01, rôle → 03, coffre → 02, marqueur du retour → 13, refus « pas vide » → 11, marqueur du réel → 15) ; retirer une ligne de droits (fonction laissée ouverte, écriture laissée à l'appli, table ouverte au visiteur, protection retirée) → 25 échecs ; retirer « lecture seule » du script du réel → 1 échec (14). Retirer un `grant … to service_role` ne change rien (les droits par défaut de Supabase le donnent déjà) : ligne gardée par prudence.

## 4. Batterie, faketime, CI

### 4.1 Tests SQL complets (certain)
`pytest tests/sql` : **97 / 97** (66 existants + 31 nouveaux), dont `test_p6_14` et `test_p6_15` verts. `faketime` sur `tests/sql` : samedi 21/11/2026 **97 / 97**, dimanche 22/11/2026 **97 / 97**, 05/01/2027 **97 / 97**. Aucun nouveau test ne lit une date.

### 4.2 Batterie complète (un passage)
**En cours** au moment de ce commit (résultat ajouté au commit suivant).

### 4.3 CI et demande de fusion
Demande de fusion **en brouillon** : [gablry8/cp-gl2607#28](https://github.com/gablry8/cp-gl2607/pull/28). CI des deux événements (push, demande de fusion) : **en cours** au moment de ce commit (résultat ajouté au commit suivant).

## 5. Fichiers et branches ouvertes

### 5.1 `git diff --stat origin/main` (tests et scripts, commit `159e9fa` ; plus ce compte rendu)
```
 tests/sql/00_supabase_emul.sql               |  44 +++
 tests/sql/test_pdp_identifiants.py           | 468 +++++++++++++++++++++++++++
 tests/supabase-test/8-REEL-pdp-lecture.sql   |  90 ++++++
 tests/supabase-test/8-pdp-TEST.sql           | 197 +++++++++++
 tests/supabase-test/8-pdp-retour-arriere.sql |  48 +++
 5 files changed, 847 insertions(+)
```
Aucune ligne retirée. Aucun fichier de la liste interdite (appli, `sw.js`, `supabase/`, `tests/run-all.sh`, `tests/*.mjs`, `tests/LISEZMOI.md`, `.github/`, `CLAUDE.md`, file des missions, essais TEST…). Numéro 8 : libre sur toutes les branches au moment du push (le 7 est pris par PREUVE-SIGNATURE).

### 5.2 Conflits avec les branches ouvertes (certain)
`git merge-tree --write-tree HEAD <branche>` (tête `159e9fa`) : **aucun conflit** avec `origin/correctif/compte`, `origin/outillage/environnement-4` et `origin/correctif/preuve-signature`. Tests SQL rejoués sur chacun des trois arbres fusionnés : COMPTE **97 / 97**, ENVIRONNEMENT-4 **97 / 97**, PREUVE-SIGNATURE **124 / 124** (97 + ses 27). Le nouveau test ne bouge pas quand une autre branche ajoute une migration.

## 6. Retour arrière
- **TEST** : `tests/supabase-test/8-pdp-retour-arriere.sql` (verrou par marqueur) retire les trois fonctions et la table, **seulement si la table est vide** ; sinon STOP (la valeur rangée dans le coffre resterait sans rien pour la retrouver). Pour vider : copie d'essai › Facture électronique › « Déconnecter » (efface la ligne et la valeur du coffre). Attendu : 4 « OK » ; rejouable. La fonction `superpdp` déployée et le secret se retirent dans Edge Functions (gestes à l'inverse du § 2.2).
- **Réel** : rien à retirer (rien n'y est installé ; le script du réel ne fait que lire).
- **Dépôt** : fusionner ou non cette branche ne change rien à l'appli.

## 7. Ce qui n'a pas pu être vérifié
- Le script sur le **vrai** projet TEST (PostgreSQL 17, rôles réels) : seulement sur PostgreSQL 16 local avec un coffre imité. **Probable** qu'il passe : mêmes signatures du coffre, mêmes droits par défaut, empreintes des fonctions identiques entre le réel (17) et le banc (16) — lu et exécuté. Ton geste 3 le dira.
- Le verrou « le rôle postgres ne peut pas se servir du coffre » : sur le banc, `postgres` est super-utilisateur, ce cas ne se provoque pas (lu sur TEST et le réel : `postgres` peut s'en servir).
- Le déploiement de `superpdp` sur TEST, le secret et la connexion au bac à sable : tes gestes 4 et 5 (aucun déploiement ni écriture en ligne de ma part).
- La valeur exacte de `env` annoncée par SUPER PDP : le contrôle du geste 5.4 la donne.

## 8. Lignes à ajouter (fichiers non touchés, interdit ici)

**`docs/FILE-DES-MISSIONS.md`**, tableau « Outillage » :
| FACT-0 : de quoi installer la fonction `superpdp` sur TEST (table `climpilot_pdp`, trois fonctions, retour arrière, lecture du réel) | `outillage/fact-pdp-test` | **fait le 18/11** (Opus 5.5), demande de fusion en brouillon ; tests SQL 97 / 0 (31 nouveaux, rouges sur `main` 31 / 31) ; batterie et CI : `docs/FACT-0-COMPTE-RENDU.md` § 4 | relecture par Fable 5.1 (`relecture-p10`) ; fusion ; gestes 3 à 5 (§ 2 du compte rendu) | Fable puis Gab |

**`docs/ESSAIS-SUPABASE-TEST.md`**, section « Pas encore essayé » :
- **FACT-0 (18/11/2026)** : script `tests/supabase-test/8-pdp-TEST.sql` à coller (verrou par marqueur, coffre vérifié avant tout, 15 « OK ») ; retour arrière `8-pdp-retour-arriere.sql` (refusé tant qu'une connexion est enregistrée) ; lecture du réel `8-REEL-pdp-lecture.sql` (lecture seule, 15 « OK »). Lecture seule du 18/11 : sur TEST, table et trois fonctions absentes, coffre présent ; sur le réel, conformes au dépôt. Vérifié hors ligne seulement (PostgreSQL 16 local, coffre imité, 31 tests). Ensuite : secret `ALLOWED_USER_IDS`, fonction `superpdp` sur TEST, bac à sable reconnecté (`docs/FACT-0-COMPTE-RENDU.md` § 2).

## 9. Relecture (règle 12) : fichiers à relire
1. `tests/supabase-test/8-pdp-TEST.sql`
2. `tests/supabase-test/8-pdp-retour-arriere.sql`
3. `tests/supabase-test/8-REEL-pdp-lecture.sql`
4. `tests/sql/test_pdp_identifiants.py`
5. `tests/sql/00_supabase_emul.sql` (bloc ajouté en fin de fichier)
6. ce compte rendu (et la copie du Project, quand elle sera faite)
