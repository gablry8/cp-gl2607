# P6+ — SUPER PDP (environnement) et retrait de droits inutiles au visiteur non connecté — compte rendu (31/10/2026)

Branche `correctif/p6-env-superpdp` (depuis `release/1.13.0` = f456f32). Rien n'est déployé, rien n'est écrit sur Supabase.
**`next-superpdp.js` est modifié (fichier mis en cache par `sw.js`) : le nom du cache `const C=` doit changer à l'intégration
(volontairement pas fait ici : la mission P3 le change en parallèle).**

## Ce que Gabriel décide / fait (10 lignes)
1. Rien à faire sur le code : relu et commité en deux temps par la session principale le 31/10 (tests seuls, puis code + migration + scripts + docs) ; `const C=` de `sw.js` change à l'intégration avec P3.
2. Attendre la CI : la suite H (6 nouveaux contrôles H3) n'a pas pu tourner ici (pas de Chromium) ; tout le reste a tourné (§ 7).
3. Supabase TEST › SQL Editor : coller tout `tests/supabase-test/6-droits-anon-TEST.sql` → 27 lignes, toutes « OK » (« OK (table absente) » est normal). Sinon : STOP, noter l'affichage.
4. Avec la copie d'essai branchée sur TEST : se connecter, synchroniser, émettre une facture d'essai, faire une sauvegarde, ouvrir un lien de signature sans être connecté → tout doit marcher comme avant.
5. Supabase RÉEL (après 3 et 4, et après la fusion 1.13.0) : coller tout `tests/supabase-test/6-REEL-droits-anon.sql` → 19 lignes, toutes « OK ».
6. Fonction `superpdp` (TEST puis réel) : poser d'abord le secret `ALLOWED_USER_IDS`, puis déployer la version du dépôt (procédure § 6).
7. Après le déploiement : écran « Facture électronique » → « Connecté — compte de TEST » attendu pour ton compte bac à sable ; s'il affiche « compte réel » avec « Type de compte annoncé par la plateforme : « … » », t'arrêter et transmettre la valeur affichée. (Vérifié en lecture seule le 31/10 : ton compte enregistré sur le projet réel vaut bien `sandbox`, il reste donc en bac à sable.)
8. Te déconnecter puis reconnecter SUPER PDP une fois : la valeur brute de l'environnement est alors enregistrée (contrôle SQL § 6).
9. Retour arrière à tout moment : `tests/supabase-test/6-droits-anon-retour-arriere.sql` (droits) ; redéployer la version précédente de `superpdp` (fonction).
10. À trancher plus tard (non fait, volontairement) : changer ou non les droits par défaut de Supabase pour les futures tables (§ 4) ; d'ici là, chaque migration retire elle-même les droits du visiteur (garde automatique, test 14).

## 1. Constat M4 C7 — environnement SUPER PDP reconnu par égalité exacte (certain)
- **Constat** (lu dans le code, certain) : la fonction `superpdp` (envoi) et l'appli (`next-superpdp.js`, envoi et écran) choisissaient
  la **production** seulement si l'environnement annoncé par la plateforme valait exactement `production` ; toute autre valeur
  (majuscules, espace, vide, absente, valeur inconnue) passait en **bac à sable** : XML fabriqué par l'appareil accepté, contrôles du
  registre sautés côté serveur ; identités de test, pas de contrôle SIREN / particulier côté appli. Le défaut va dans le mauvais sens
  (en cas de doute, il faut les contrôles les plus stricts). La valeur réelle renvoyée par SUPER PDP n'est pas connue ici (hypothèse :
  `sandbox` / `production`, d'après le code existant).
- **Correction** : bac à sable **seulement** si `env === 'sandbox'` (exactement) ; toute autre valeur = production avec tous les
  contrôles du registre.
  - `supabase/functions/superpdp/index.ts` : fonction `bacASable(env)` ; l'envoi passe par le registre si `!bacASable(cred.env)` ;
    à la connexion, la valeur brute est enregistrée (`company.env_brut`, `null` si absente ; colonne `env` = texte reçu, rien n'est deviné).
  - `next-superpdp.js` : `sandbox = st.env === 'sandbox'` (envoi et écran) ; l'historique des envois garde `env` (`sandbox`/`production`)
    **et** `env_brut` (valeur reçue) ; « déjà déposée » compte tout envoi non-bac-à-sable ; l'écran affiche une ligne d'avertissement
    quand la valeur annoncée n'est ni `production` ni `sandbox` (diagnostic, pas une fonctionnalité).
- **Tests rouges puis verts** :
  - `tests/functions/test-superpdp-envoi.mjs` (exécuté ici) : 23 contrôles ajoutés. Rouge avant : 7 PASS / 23 FAIL (pour
    `Production`, `PRODUCTION`, ` production`, vide, absent, `null`, `prod`, `live`, `Sandbox`, `sandbox ` le serveur déposait le XML
    de l'appareil ; `env_brut` absent à la connexion). Vert après : 30 PASS / 0 FAIL.
  - `tests/suiteH-superpdp.mjs`, bloc H3 (6 contrôles, **non exécuté ici**) : environnement `Production`. Rouge avant parce que
    `sandbox=st.env!=='production'` (anciennes lignes 115 et 285) mettait ce compte en bac à sable : écran « compte de TEST », facture
    particulier non refusée, XML de test (`000000002`, suffixe `-TEST`) envoyé au lieu de l'identifiant du registre, historique sans
    `env_brut`. Vert après parce que `sandbox=st.env==='sandbox'` donne le chemin « compte réel » de H2, et l'entrée d'historique porte
    `env:'production', env_brut:'Production'`. La préparation `setup()` traite désormais tout environnement autre que `sandbox` comme
    le réel (H1 `sandbox` et H2 `production` inchangés).

## 2. Constat M4 C19 / S-5 — cinq petites fonctions exécutables sans connexion (certain)
- **Constat** : `cp_serveur_info`, `cp_version_ok`, `cp_arr_len`, `cp_doc_json`, `cp_num_txt` restaient exécutables par le visiteur non
  connecté (droit par défaut `public` jamais retiré). Risque faible (version, calculs), mais inutile.
- **Qui les appelle** (vérifié dans le code, certain) : l'appli appelle seulement `cp_serveur_info`, **après connexion**
  (`next-emission.js:78`, dans `sonde`, qui renvoie « cloud » sans appel si personne n'est connecté, l. 75). Les quatre autres ne sont
  appelées que par des fonctions `security definer` (émission, import, synchronisation, sauvegarde), qui s'exécutent avec les droits de
  leur propriétaire. Aucun appel par la page de signature, le site, les fonctions serveur. **Aucun appel légitime sans connexion.**
- **Correction** (migration `supabase/migrations/20261031120000_droits_anon.sql`) : `revoke execute … from public, anon` puis
  `grant execute … to authenticated, service_role` (garde l'appli connectée telle quelle, par prudence).

## 3. Constat S-6 — droits laissés au visiteur non connecté sur des tables (certain)
- **Constat** : des tables ClimPilot gardaient les droits que Supabase donne par défaut au rôle `anon` ; la protection par compte (RLS)
  les bloquait déjà. Retrait = défense en profondeur.
- **Vérifications** (certain) : toutes les lectures/écritures de tables de l'appli exigent une session (`SESS.user` : `index.html`,
  `next-assistant.js`, `next-signature.js`, `next-catalogue.js`, `next-emission.js`, `next-planning.js`) ; la page de signature appelle
  la fonction serveur `signature`, qui lit la base avec la **clé de service** (`supabase/functions/signature/index.ts:108`) ; idem
  `agenda`, `assistant`, `superpdp`. **Aucun appel légitime ne passe par `anon`.**
- **Correction** (même migration) : pour chaque table ClimPilot **qui existe** (le projet de test n'a pas toutes les tables),
  `revoke all … from public, anon`, et sur les séquences qui leur appartiennent. `authenticated` et `service_role` intacts (prouvé).
- **Effet de bord utile** (probable) : si une session expire sans être renouvelée, une lecture renvoie maintenant « droit refusé » au lieu
  d'une liste vide ; l'appli le traite comme une erreur (`pullState`, `index.html:3778`) au lieu de croire le cloud vide.

## 4. Droits par défaut (`alter default privileges`) — non modifiés (décision à prendre)
Réglage de Supabase : toute table, séquence ou fonction **créée plus tard** par `postgres` dans `public` recevra encore des droits pour
`anon`. Doute sur l'effet côté Supabase (tableau de bord, outils) → pas touché. Conséquence : chaque nouvelle migration doit retirer
elle-même ces droits (`revoke … from public, anon`, règle déjà suivie depuis M4 C19). Garde automatique : `test_p6_14` applique **toutes**
les migrations du dépôt et échoue si un objet de `public` reste accessible au visiteur. Non couvert : une table créée à la main dans le
tableau de bord.

## 5. Constat S-8 — script d'essai n° 1 et projet TEST (certain)
- **Constat** : `tests/supabase-test/1-structure-migration-essais.sql` créait `zz_resultats` et `zz_ok` accessibles sans connexion.
- **Correction, sans changer ce qu'il teste** : `zz_resultats` sans aucun droit pour `public`, `anon`, `authenticated`, protection par
  compte activée ; `zz_ok` en `security definer` ; le droit d'exécuter `zz_ok` n'est donné à `anon`/`authenticated` que le temps des
  essais et retiré en fin de script (une seule transaction). Prouvé : mêmes 36 contrôles (A : 2, B : 34), tous réussis, avant et après.
- **Projet TEST** (hors migration, script TEST seulement) : fonctions de déclencheur, `zz_ok`, `zz_resultats` et la table-marqueur
  alignées (plus aucun droit pour `public`, `anon`, `authenticated`). Les déclencheurs fonctionnent toujours (le droit n'est pas
  vérifié au déclenchement) ; `zz_ok` reste utilisable par l'administrateur (script 2).

## 6. Fonction `superpdp` : déploiement et vérification (geste de Gabriel)
Procédure de `docs/CORRECTIONS-1.10.md` (Livraison, point 5) et `docs/ESSAIS-SUPABASE-TEST.md` ; **TEST d'abord**, puis le réel.
1. Edge Functions › **Secrets** : poser `ALLOWED_USER_IDS` = ton identifiant (Authentication › Users), **avant** tout déploiement
   (sinon la nouvelle version refuse tout le monde : 503 « config »).
2. Edge Functions › `superpdp` › nouvelle version (libellés : hypothèse) : coller **tout** `supabase/functions/superpdp/index.ts` (version fusionnée) ›
   Deploy, vérification JWT **activée** (la fonction exige d'être connecté) ; ou `supabase functions deploy superpdp --project-ref <réf>`.
3. Vérifier : écran « Facture électronique » → « Connecté — compte de TEST » pour le compte bac à sable ; envoi d'essai « TEST — Envoyer »,
   numéro suffixé `-TEST`, comme avant ; Edge Functions › `superpdp` › Logs sans erreur.
4. Déconnecter / reconnecter SUPER PDP une fois, puis SQL Editor :
   `select env, company->>'env_brut' as env_brut, updated_at from public.climpilot_pdp;` → `sandbox` et `sandbox` pour le compte de test.
   Une autre valeur : ne pas envoyer, transmettre la valeur.
5. Retour arrière : redéployer la version précédente (celle de `release/1.13.0`, identique sauf la règle d'environnement).

## 7. Ce qui a été vérifié ici / ce qui attend la CI
- PostgreSQL 16 local (`cluster_name=climpilot-test`) : `pytest tests/sql` → **66 passed** (51 existants + 15 nouveaux). Avant la
  correction : nouveaux tests 12 FAIL / 2 PASS (les deux qui passent vérifient que l'appli connectée marche, avant comme après).
- Verrous éprouvés : script RÉEL avec marqueur → « STOP », rien modifié ; script TEST sans marqueur → « STOP », rien modifié.
- Lignes de contrôle : 19 « OK » (RÉEL), 27 « OK » (TEST) ; et sur une base sans migration elles affichent bien « À REVOIR » (test 15).
- Fonctions serveur (`node tests/functions/*.mjs`) : 5 fichiers verts (agenda 18, apps-script 12, liste-blanche 20, signature 10,
  superpdp-envoi 30). `node --check` sur les .js/.mjs modifiés ; `node --experimental-strip-types --check` sur `index.ts`.
- **Attend la CI** : suite H (dont H3) et toute la batterie Playwright (pas de Chromium ici).

## 8. Ce que ça change pour Gabriel
- Compte bac à sable annoncé `sandbox` : rien ne change. Toute autre valeur : traité comme compte réel (plus strict), avec un message.
- Base : le visiteur non connecté n'a plus aucun droit sur les tables et fonctions ClimPilot ; l'appli connectée, la page de signature,
  le site et les fonctions serveur ne changent pas.

## 9. Ce qui n'a pas pu être vérifié
- La valeur exacte de `env` renvoyée par SUPER PDP (hypothèse : `sandbox` / `production`) : vérifiée au point 6.4.
- L'état exact des droits sur les projets Supabase et le propriétaire des fonctions : les lignes « OK » des scripts le diront ; un
  « À REVOIR » peut venir d'un droit donné par un autre rôle que `postgres` (hypothèse) → s'arrêter et transmettre.
- Le comportement de la suite H3 dans un vrai navigateur (CI).
