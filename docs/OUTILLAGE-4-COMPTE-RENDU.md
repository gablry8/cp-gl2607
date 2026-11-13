# ClimPilot — Mission OUTILLAGE-4 : suite P instable, restes de la relecture d'OUTILLAGE-X, actions GitHub sur Node 24 — compte rendu

> Rédigé le 13/11/2026 par Claude (Opus 5.5), **exécutant** de la mission. Relecture à faire par l'autre modèle (Fable 5.1, skill `relecture-p10`).
> Branche **`outillage/environnement-4`**, partie de `origin/main` = `93efedd`. Demande de fusion **#26, en brouillon**. **Tests et CI seulement** : aucun fichier de l'appli (ni `index.html`, ni `sw.js`, ni `next-*.js`, ni `vendor/`, ni `supabase/`).
> **Pas d'outil Projects dans cette session** : la copie `claude/ClimPilot-OUTILLAGE-4-compte-rendu.md` dans le Project **n'est pas faite**, et `claude/ClimPilot-OUTILLAGE-X-RELECTURE.md` n'a pas été lu (j'ai suivi le résumé du prompt). La mission n'en dépendait pas.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**. Bancs, copies mutées et journaux **hors dépôt** (dossier de travail de la session, effacé avec elle) ; les lignes utiles sont recopiées ici.

## Ce que Gab décide / fait (dans l'ordre)

1. **Cause de l'échec de la suite P** (certain, recalculé au centime) : le test, pas l'appli. Il cherchait le devis « DPS » par `/DPS/` dans le numéro, dont la fin est tirée au hasard ; au run 207, celle du devis « PAC » contenait « DPS ». L'appli avait rendu la bonne valeur (40,78) ; c'est l'attendu du test (127,57) qui était faux (§ 1). Environ 1 passage sur 130.
2. **Corrigé dans le test** (recherche par le code entre tirets) : tirage du run 207 forcé → ancienne suite **rouge** avec la ligne exacte de la CI, nouvelle **verte**. Horloge éliminée (faketime, 8 dates).
3. **Deuxième instabilité trouvée et corrigée** (test seul) : l'écran de démarrage était lu après 2,3 s fixes ; rouge 5 fois sur 9 sous processeur bridé avant, 0 sur 21 maintenant (§ 1.5, § 4.1).
4. **Suite X** : routes de test retirées avant le hors ligne, attente bornée côté Node (150 s). Mutations rouges, arbre normal vert (§ 2). À savoir : le trou décrit par la relecture était déjà masqué par le contrôle d'intégrité ajouté par S.
5. **Actions GitHub en v7** (Node 24), d'après leurs dépôts officiels : plus d'avertissement, mêmes comptes (§ 3).
6. **Local** : P 30 passages, X 30 passages (moitié bridés), faketime 3 dates, batterie complète : voir § 4. **CI** : verte, tableau § 5.
7. **Ton geste** : relecture par **Fable 5.1** (`relecture-p10`), puis fusion de **#26**. Avant ou après COMPTE : **pas de conflit** (§ 6).
8. **Décision** : le seuil « écran Objectifs en moins de 1,5 s » (suite P) dépasse 2 fois sur 15 sous processeur bridé (375 à 517 ms en normal). Je n'y ai pas touché (interdit). Mon avis : le garder tel quel ; mission seulement s'il échoue un jour sur la CI (§ 4.2).
9. **Petit geste possible** : retirer de l'environnement « Climpilot » l'hôte des artefacts ajouté pour cette mission (§ 6.1). `docs/FILE-DES-MISSIONS.md` non touché (interdit) : ligne proposée § 6.1.
10. Rien à faire sur les appareils : aucun fichier de l'appli, pas de F5.

---

## 1. P1 — suite P : « Si tu factures la TVA : achats réels TTC ramenés HT »

### 1.1 Constat (certain : CI lue)
- CI de `main` `93efedd`, run 207 (push, [lien](https://github.com/gablry8/cp-gl2607/actions/runs/43418172493)), **tentative 1** (11 h 34 → 12 h 00 UTC) : 1 607 / **1** / 2 SKIP connus, seul échec la ligne ci-dessus. **Tentative 2** (relance de Gab, 12 h 28 → 12 h 55 UTC) : **verte**, même code.
- Ligne rouge, lue dans l'artefact `rapport-tests-207` de la tentative 1 (`journaux/suiteP-ameliorations.log`) :
  `FAIL  [Améliorations 1.12] Si tu factures la TVA : achats réels TTC ramenés HT — {"parH":40.78,"att":127.57266666666665}`
  Ces valeurs ne figurent ni dans le journal du travail ni dans le check-run « rapport » (la suite sort avec le code 0). L'hôte de stockage des artefacts était refusé par le réseau de la session : je l'ai ajouté à l'environnement, avec ton accord par la fenêtre d'approbation (`productionresultssa15.blob.core.windows.net`, besoin ponctuel ; tu peux le retirer).

### 1.2 Cause (certain)
- **L'appli avait juste, l'attendu du test était faux.** En local, sur le même code, `parH` = **40,78** et l'attendu = **40,78** (sonde hors dépôt). Sur la CI, l'appli a rendu la même valeur, 40,78. C'est l'attendu calculé par le test (127,57) qui était faux.
- Le test retrouve ses devis par une expression **non ancrée** sur le numéro : `DEVIS.find(d=>/DPS/.test(d.num))`. Or le numéro d'un devis est `DV-AAAAMMJJ-<code nature>-<6 caractères tirés au hasard>` (`next-devis2.js` `numFor`, `index.html` `uid()` : `Math.random()` en base 36, majuscules). Si la fin aléatoire d'un devis **placé avant** dans la liste contient « DPS », `find` renvoie ce devis-là.
- **Preuve par le calcul** : sur les 144 paires possibles de devis du jeu de test (régime « assujetti »), **une seule** donne exactement 127,57266666666665 : le devis BAL et le devis **PAC** (1 967,54 € HT, achats 533,40 € HT), alors que le devis DPS attendu fait 152,25 € HT. Au run 207, la fin aléatoire du devis PAC contenait donc « DPS ».
- Même faiblesse dans **26 recherches** de la suite P (codes SPL, GAI, CHF, PAC, BAL, MES, DPS ; `/DEP-/` était déjà à moitié ancré). **Probabilité estimée** (probable, calculée) : environ 91 couples (code cherché, devis placé avant) par passage, chacun avec une chance de 4 / 36³ ≈ 0,0086 % → **≈ 0,8 % des passages de la suite P**, soit environ 1 sur 130. Cela colle avec un premier échec au bout d'environ 200 exécutions de la CI.
- **Éliminé** : l'horloge. Ancienne suite sous `faketime` aux dates « 2026-11-13 12:00 », « 2026-11-13 11:42 » (heure du run 207), « 2026-12-31 23:30 », « 2027-01-01 00:30 », « 2026-11-14 10:00 » (samedi), en UTC : **5 × 138 / 0**. La suite P n'utilise d'ailleurs que des dates écrites en dur (`todayISO` remplacé, `nxrtSynthese('2027-11-12')`). L'ordre des écritures dans `DEVIS` est éliminé aussi : le calcul est fait d'un bloc dans une seule `evaluate`, sans écriture asynchrone entre les lectures. La preuve par le calcul ci-dessus suffit à expliquer l'écart.
- Autres suites : aucune n'a ce motif (`grep` des recherches par code nature dans `tests/*.mjs` : seule la suite P).

### 1.3 Correction (test seul : `tests/suiteP-ameliorations.mjs`)
- Les 26 recherches cherchent le code **entre tirets** : `/-DPS-/.test(d.num)`. La fin aléatoire ne contient pas de tiret, la date ne contient que des chiffres : seul le code de la nature peut correspondre. Aucun contrôle retiré, aucun seuil changé, aucune relance.

### 1.4 Rouge → vert (certain : exécuté ; copies hors dépôt de `93efedd`, seule la suite P change entre « ancienne » et « nouvelle »)
Le tirage aléatoire est **forcé** dans une copie hors dépôt de `tests/lib.mjs` (jeu de test `SEED`, après la création des 12 devis) ; l'appli n'est pas touchée.

| Tirage forcé | Ancienne suite P | Nouvelle suite P |
|---|---|---|
| m1 : la fin du numéro du devis PAC devient `XDPSX1` (cas du run 207) | **ROUGE 131 / 7** — dont la ligne exacte de la CI : `{"parH":40.78,"att":127.57266666666665}` ; les 6 autres sont dans le bloc du relevé bancaire, qui cherche aussi `/DPS/` (sur la CI, ce bloc avait son propre tirage) | **VERT 138 / 0** |
| m2 : fins `GAICHF` (SPL), `BALMES` (GAI), `DPSPAC` (DEP) : collision sur tous les codes cherchés | **ROUGE 125 / 13** | **VERT 138 / 0** |
| aucun (tirage normal) | 138 / 0 | 138 / 0 |

### 1.5 Deuxième instabilité trouvée en cherchant (certain : reproduite) — écran de démarrage
- En faisant tourner l'**ancienne** suite P sous processeur bridé, le contrôle « Adresse avec une valeur inconnue : ignorée (écran de démarrage habituel), paramètre retiré » a échoué **2 fois sur 3** : `{"vue":"nx_journee","search":"","normal":"dash"}` puis `{"vue":"dash","search":"","normal":"nx_journee"}`. Jamais vu sur la CI.
- Cause (certain : code lu) : `next-journee.js` bascule l'accueil sur « Ma journée » **1,4 s après son démarrage**. Ce démarrage attend lui-même jusqu'à 6 s que le menu soit prêt. Le test lisait l'écran **2,3 s fixes** après le chargement : sur une machine lente, il le lisait avant la bascule, une fois pour la référence et pas l'autre. **L'appli n'est pas en cause** : la bascule est voulue.
- Correction (même fichier, bloc « raccourcis ») : le test **attend l'écran** (`waitForFunction`, plafond 15 s ; au-delà, l'écran lu tel quel rend le contrôle rouge), puis garde 1,2 s de marge (un raccourci accepté à tort ouvrirait sa cible après la bascule).
- **Rouge → vert**, processeur bridé : un seul cœur (`taskset -c 0`), partagé avec une boucle qui le consomme en continu ; `cpulimit` n'est pas installé. Ancienne et nouvelle suite en alternance, même machine, Chromium 141.0.7390.37 :

| Suite P | Passages bridés | Rouges (écran de démarrage) |
|---|---|---|
| ancienne (`93efedd`) | 6 en alternance + 3 plus tôt | **3 / 6** (+ 2 / 3 plus tôt, en même temps que des passages de la suite X) — par exemple `{"vue":"nx_journee","search":"","normal":"dash"}` |
| nouvelle | 6 en alternance + 15 des comptes (§ 4.1) | **0 / 6** (138 / 0 chaque fois) **+ 0 / 15** |

- **Non-affaiblissement** (copies hors dépôt de l'appli, servies à la place de l'arbre normal) :

| Mutation de `next-raccourcis.js` | Ancienne suite | Nouvelle suite |
|---|---|---|
| valeur inconnue acceptée (ouvre la cible « adr ») | ROUGE 137 / 1 (`"vue":"fluides"`) | **ROUGE 137 / 1**, même détail |
| paramètre `ouvrir` laissé dans l'adresse | ROUGE 136 / 2 | **ROUGE 136 / 2**, mêmes contrôles |


## 2. P2 — restes de la relecture d'OUTILLAGE-X (suite X et compte rendu)

### 2.1 (a) Routes de test retirées avant le rechargement hors ligne
- Fait : `ctx.unroute` des deux routes de `sansBibliothequesCloud` (`/\/vendor\/supabase-js-/`, `/\/vendor\/chart-/`, mêmes motifs que `tests/lib.mjs`), juste après l'arrêt du serveur et `setOffline`, avant le rechargement. `tests/lib.mjs` n'est pas touché.
- Le contrôle hors ligne exige **en plus** :
  1. que les deux fichiers soient servis par le service worker ;
  2. qu'**aucune requête réseau du service worker n'aboutisse** : serveur arrêté, une réponse ne peut venir que d'une route restée en place. Cette garde voit donc un `unroute` sans effet, si `lib.mjs` change un jour ses motifs ;
  3. qu'**aucune requête ne parte vers Supabase**.
  Les autres requêtes hors de l'appli sont seulement écrites dans le détail : l'appli tente le géocodage `data.geopf.fr` même hors ligne, et le mandataire le refuse.
- **Ce que j'ai mesuré** (certain) :
  - **Les routes répondaient bien au service worker hors ligne.** Variante « nouvelle suite sans `unroute` » : la garde 2 voit `["vendor/chart-4.5.0.umd.js","vendor/supabase-js-2.117.3.umd.js"]` → **rouge**.
  - **Le cache contient les remplaçants de test, pas les vrais fichiers** : 45 et 56 caractères, contre 217 907 et 208 337 octets. Le service worker de N+1 les a mis en cache **à travers ces routes**, à l'installation ou au rechargement en ligne (« réseau d'abord »). Hors ligne, la page reçoit donc ces remplaçants depuis le cache ; le contrôle d'intégrité (SRI) des balises `<script>` les bloque. Résultat : `window.supabase` et `window.Chart` valent `undefined`, la page reste **sans cloud**. Le libellé « bibliothèques embarquées chargées » vaut pour la présence des fichiers, pas pour ces deux bibliothèques, comme avant.
  - **Le trou décrit par la relecture était masqué par le SRI** (ajouté par la mission S) : avec le SRI, le remplaçant que la route donne au service worker est rejeté par le `fetch` du service worker, qui hérite de l'intégrité de la requête de la page (probable pour le mécanisme ; l'effet, lui, est mesuré : `net::ERR_FAILED`). L'ancienne suite était donc **déjà rouge** quand l'un des deux fichiers manquait du cache. Sans le SRI (copie hors dépôt où seuls ces deux attributs `integrity` sont retirés de `index.html`), l'ancienne suite laissait passer un fichier manquant, la nouvelle non.

| Mutation (copies hors dépôt de `93efedd`) | Ancienne suite X | Nouvelle suite X |
|---|---|---|
| supabase-js retiré du cache juste avant la coupure | ROUGE 7 / 1 (`échec (net::ERR_FAILED) vendor/supabase-js-2.117.3.umd.js`) | **ROUGE 7 / 1** (même échec + `bibliothequesNonServies: ["vendor/supabase-js-"]`) |
| Chart.js retiré du cache juste avant la coupure | ROUGE 7 / 1 (`… vendor/chart-4.5.0.umd.js`) | **ROUGE 7 / 1** (+ `["vendor/chart-"]`) |
| supabase-js retiré du cache, **sans SRI** | **VERT 8 / 0 — non détecté** | **ROUGE 7 / 1** |
| Chart.js retiré du cache, **sans SRI** | **VERT 8 / 0 — non détecté** | **ROUGE 7 / 1** |
| nouvelle suite **sans** `unroute` (route restée) | — | **ROUGE 7 / 1** (`reponsesReseauDuServiceWorker` : les 2 fichiers) |
| arbre normal (avec et sans SRI) | 8 / 0 | **8 / 0** |

### 2.2 (b) Attente de la mise à jour bornée côté Node
- Fait : `Promise.race` entre l'attente dans la page et une minuterie Node de **150 s**. La page envoie son état à chaque changement (`console`, préfixe `CPX-MAJ`), et Node garde le dernier. À expiration :
  - les contrôles « Après mise à jour » sont **ROUGES** avec ce dernier état, le nombre de service workers et le nombre de requêtes servies ;
  - les deux contrôles hors ligne sont **ROUGES** (« non exécuté ») ;
  - **plus aucune commande n'est envoyée à la page** ;
  - le navigateur est fermé (fermeture bornée à 20 s ; au-delà, la suite écrit ses résultats et sort avec le code 1).
- À savoir (certain : `tests/run-all.sh` ligne 74) : chaque suite y est déjà lancée sous `timeout 1200`. Une suite bloquée était donc tuée au bout de **20 min** (sans résultats écrits, donc « plantage »), pas au délai de 90 min du travail de la CI.

| Mutation | Ancienne suite X | Nouvelle suite X |
|---|---|---|
| la boucle d'attente de la page ne rend jamais la main (état envoyé, fin jamais atteinte) | **bloquée** : aucun résultat écrit au bout de 400 s, arrêtée par le `timeout 400` du banc (code 124) ; dans `run-all.sh`, elle l'aurait été au bout de 20 min, comptée « plantage », sans résultat | **ROUGE 4 / 4 en 154 s**, dernier état connu écrit (`"dernierEtat":{"ms":4097,"caches":["climpilot-next-1137-production"],"fichiers":67,"active":"activated",…}`), navigateur fermé, 0 processus Chromium restant |
| page **figée** (boucle synchrone dans la page) | — | **ROUGE 4 / 4 en 154 s**, dernier état connu écrit, navigateur fermé, 0 processus Chromium restant |

### 2.3 (c) `docs/OUTILLAGE-X-COMPTE-RENDU.md`
Deux phrases seulement :
- titre du § 2.3 : « certain : source de Chromium lue… » devient « **probable** : mécanisme lu dans la source de Chromium… ; la preuve est l'expérience mesurée avec la 141, § 2.4 » ;
- § 3 : « ne teste pas (et ne testait pas) » devient « ne teste pas (et ne testait pas **de façon déterministe**) ».

## 3. P3 — avertissement « Node.js 20 is deprecated »
- Constat (certain : annotation du travail de la CI, run 207 tentative 2) : `Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4, actions/setup-python@v5, actions/upload-artifact@v4.` **GitHub les fait déjà tourner sur Node 24.**
- Sources (certain) : les dépôts officiels `github.com/actions/checkout`, `setup-node`, `setup-python` et `upload-artifact`, lus **le 13/11/2026** avec `git` : `action.yml`, `README.md` et `CHANGELOG.md` de chaque version, journal des commits. Les pages « Releases » et l'API de ces dépôts ne sont pas joignables depuis cette session.

| Action | Avant | Après | Node | Changements incompatibles documentés depuis notre version | Effet ici |
|---|---|---|---|---|---|
| checkout | v4 (node20) | **v7** (v7.0.0 du 17/06/2026, v7.0.1) | node24 depuis v5 | v5 : node24, runner ≥ 2.327.1 ; v6 : jeton gardé dans un fichier à part ; v7 : refuse le code d'une fourche sous `pull_request_target` / `workflow_run`, passage en ESM | aucun (`persist-credentials: false`, ni l'un ni l'autre déclencheur) |
| setup-node | v4 (node20) | **v7** (v7.0.0 du 13/07/2026, v7.1.0) | node24 depuis v5 | v5 : cache automatique ; v6 : cache automatique seulement si `packageManager` est `npm` dans `package.json`, `always-auth` retiré ; v7 : jeton `NODE_AUTH_TOKEN` factice retiré | aucun (`package.json` sans `packageManager`, ni `registry-url` ni `always-auth`) ; `package-manager-cache: false` ajouté par prudence (recommandé par la doc pour un travail qui a des droits d'écriture) |
| setup-python | v5 (node20) | **v7** (v7.0.0 du 19/07/2026, v7.1.0) | node24 depuis v6 | v6 : node24 ; v7 : ESM, « aucun changement des entrées, sorties ou du comportement » | aucun |
| upload-artifact | v4 (node20) | **v7** (v7.0.0 du 25/02/2026, v7.0.2) | node24 par défaut depuis v6 | v6 : node24 ; v7 : nouvelle entrée `archive` (vrai par défaut : même zip qu'avant), seule différence de `action.yml` entre v4.6.2 et v7.0.2 | aucun (même nom d'artefact, mêmes chemins) |

- Choix : la **dernière version majeure** de chacune, sortie depuis 4 à 9 mois, avec les changements ci-dessus lus et sans effet ici. Le minimum suffisant (v5 / v5 / v6 / v6) aurait aussi retiré l'avertissement.
- Preuve : sur la CI de cette branche, les étapes `actions/checkout@v7`, `actions/setup-node@v7` et `actions/setup-python@v7` réussissent sur les deux événements ; l'artefact est publié ; mêmes comptes (§ 5).

## 4. Comptes locaux
Exécutés le 13/11/2026 dans cette session, sur la tête `5bdd79f` (tests et CI), même machine, Playwright 1.56.1 / Chromium 141.0.7390.37.

### 4.1 Suites P et X seules, 30 fois chacune (certain)
`CP_SANS_NETNS=1 CP_SUITES=<suite> bash tests/run-all.sh` (mode CI, code 3 = passage partiel par construction), en alternance : un passage normal (4 cœurs), un passage **bridé** (un seul cœur, `taskset -c 0`, partagé avec une boucle qui le consomme en continu).

| Suite | Normal (15) | Bridé (15) | Durée de la suite |
|---|---|---|---|
| P | **15 × 138 / 0** | **13 × 138 / 0, 2 × 137 / 1** : seuil de performance seulement (§ 4.2) | 45–46 s ; bridé 62–67 s |
| X | **15 × 8 / 0** | **15 × 8 / 0** | 14–15 s ; bridé 20–22 s ; mise à jour N+1 finie en 3,8 à 4,0 s (bridé 4,8 à 6,1 s) |

Aucun échec sur « Si tu factures la TVA… » ni sur l'écran de démarrage, en 30 passages.

### 4.2 Seuil de performance de la suite P (non corrigé, interdit par la mission)
- Contrôle « 600 chantiers + 200 retours SAV : écran Objectifs & feux affiché en moins de 1,5 s » (bloc « gros volume ») : rouge **2 fois sur 15 en bridé** (`{"ms":1575}`, `{"ms":1649}`).
- Temps mesurés (certain, `resP.json` de chaque passage) : normal **375 à 517 ms** (marge de 3 à 4 fois) ; bridé **645 à 1 649 ms**.
- Sur la CI, la suite P dure autant qu'en local normal (47 à 51 s contre 45 à 46 s) : la marge y est **probablement** du même ordre. Le temps exact n'y est pas écrit, car un contrôle réussi n'affiche pas son détail. Aucun échec de ce contrôle dans les rapports de CI que j'ai lus.
- **Pas touché** : la mission interdit d'élargir un seuil. C'est une mesure de vitesse de l'appli, pas un défaut du test. Décision pour Gab en tête (ligne 8).

### 4.3 faketime (règle 9 ; mode local par défaut de `run-all.sh`, avec l'isolation du noyau), suites P et X
| Date vue par la machine | Suite P | Suite X |
|---|---|---|
| samedi « 2026-11-14 10:00 » | **138 / 0** (46 s) | **8 / 0** (14 s) |
| dimanche « 2026-11-15 10:00 » | **138 / 0** (45 s) | **8 / 0** (15 s) |
| mardi « 2027-01-05 10:00 » | **138 / 0** (46 s) | **8 / 0** (14 s) |

Plus haut (§ 1.2) : l'ancienne suite P sous `faketime` à 5 autres dates (dont l'heure du run 207, le 31/12 et le 01/01), 5 × 138 / 0.

### 4.4 Arbre fusionné avec COMPTE (résultat de `git merge-tree`, cache 1140, extrait hors dépôt)
- Suite X : **3 × 8 / 0** (mise à jour finie en 3,8 à 3,9 s).
- Suite P (appli de l'arbre fusionné servie à sa place) : **2 × 138 / 0**.

### 4.5 Batterie complète (un passage, mode local avec isolation du noyau)
`bash tests/run-all.sh` sur `5bdd79f` (25 min) : **COMPLET, RÉUSSI — 1 612 réussis / 0 échoué / 0 SKIP**, 5 non bloquants (les 5 « À TRANCHER » de la suite Y, comme sur `main`) ; même total que la batterie d'OUTILLAGE-X. P 138 / 0, Q 64 / 0, W 64 / 0, **X 8 / 0** (mise à jour finie en 3,9 s), Y 21 / 0 (+ 5 non bloquants), Z 55 / 0, AB 86 / 0. Golden Y, Z, W **inchangés** (aucun fichier golden ni de l'appli touché). Rapport : « arbre propre ».


## 5. CI
Rapports lus dans les journaux des travaux et dans le check-run « rapport — batterie complète » (contrôle « batterie complète », `.github/workflows/tests.yml`).

| Tête | Événement | Run | Tentative | Résultat | Total | Suite P | Suite X |
|---|---|---|---|---|---|---|---|
| `5bdd79f` (tests et CI) | push | 212 (43438880947) | 1 | **vert** | 1 608 / 0 / 2 SKIP connus, COMPLET, RÉUSSI | 138 / 0, 50 s | 8 / 0, 14 s |
| `5bdd79f` | demande de fusion #26 | 213 (43438921125) | 1 | **vert** | 1 608 / 0 / 2 SKIP connus | 138 / 0, 51 s | 8 / 0, 14 s |

- Mêmes comptes que `main` (run 207 : 1 607 + 1 échec = 1 608 contrôles). Les 5 non bloquants sont les 5 « À TRANCHER » de la suite Y ; les 2 SKIP connus viennent de l'isolation du noyau, absente sur le runner.
- Étapes `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7` réussies ; artefact publié par `actions/upload-artifact@v7`. **Plus aucune annotation « Node.js 20 is deprecated »** (annotations des deux travaux : aucune).
- Durée d'une exécution : ≈ 27 min, comme avant.

**Tête finale** (le commit qui ajoute ce compte rendu) : trois passages complets des deux événements (tentative 1 au push, puis deux relances complètes). Leur tableau (numéro, résultat, comptes) est dans la description de la demande de fusion #26 et dans le message de fin de session : il ne peut pas figurer dans le commit qu'il vérifie.


## 6. Fichiers, conflits, clôture
- **`git diff --stat origin/main...HEAD`** (certain, tête finale) :
```
.github/workflows/tests.yml      |  14 ++--
docs/OUTILLAGE-4-COMPTE-RENDU.md | 210 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
docs/OUTILLAGE-X-COMPTE-RENDU.md |   4 +-
tests/LISEZMOI.md                |   5 ++
tests/suiteP-ameliorations.mjs   |  40 +++++++-----
tests/suiteX-mise-a-jour.mjs     |  73 +++++++++++++++------
6 files changed, 303 insertions(+), 43 deletions(-)
```
  Rien d'autre : ni `index.html`, ni `sw.js`, ni `next-*.js`, ni `vendor/`, ni `supabase/`, ni `tests/run-all.sh`, ni `tests/lib.mjs`, ni `tests/env.mjs`, ni `docs/FILE-DES-MISSIONS.md`.
  - Dans `tests/LISEZMOI.md`, seul le paragraphe existant de la suite X est complété, sur place, pas en fin de fichier. **La suite P n'a pas de paragraphe** dans ce fichier : rien n'y est écrit pour elle, l'explication est en tête de `tests/suiteP-ameliorations.mjs` et ici.
  - Dans `docs/OUTILLAGE-X-COMPTE-RENDU.md`, seules les deux phrases du § 2.3 ci-dessus changent.
- **Conflit avec COMPTE** (certain) : `git merge-tree --write-tree origin/correctif/compte HEAD` → **code 0, aucun fichier en conflit**, contre `037f339` (tête de `correctif/compte` lue le 13/11 vers 16 h UTC). Les deux branches touchent `tests/LISEZMOI.md`, à des endroits différents ; l'ordre de fusion est libre. Les suites P et X sont identiques dans l'arbre fusionné (§ 4.4).
- **Secrets** : `bash tools/claude/verif-secrets.sh` avant chaque commit : rien ; `--branche` avant chaque push : rien (code 0). Aucune dérogation `CP_SECRETS_OK`.
- Commits `Claude <noreply@anthropic.com>`, poussés sur **`outillage/environnement-4` seulement**. Aucun push sur `main`, aucune fusion, aucun push forcé, aucune réécriture d'historique, aucune suppression de branche, aucun déploiement, aucune écriture Supabase.

### 6.1 Écarts à connaître
1. **Environnement de la session modifié** (avec ton accord, par la fenêtre d'approbation) : l'hôte `productionresultssa15.blob.core.windows.net` est ajouté aux hôtes autorisés de l'environnement « Climpilot », pour lire l'artefact du run 207. Besoin ponctuel : tu peux le retirer (réglages de l'environnement, accès réseau).
2. **`docs/FILE-DES-MISSIONS.md` non mis à jour** : interdit par le prompt (conflit avec COMPTE). Ligne proposée pour la section « Outillage », à ajouter après la fusion de COMPTE : `| OUTILLAGE-4 : suite P stable (recherche des devis ancrée, écran attendu), suite X hors ligne sans route de test et bornée côté Node, actions GitHub en v7 | outillage/environnement-4 | fait le 13/11 (Opus 5.5), PR #26 en brouillon ; docs/OUTILLAGE-4-COMPTE-RENDU.md | relecture par Fable 5.1 (relecture-p10), fusion | Fable puis Gab |`.
3. **Deux corrections de plus que le prompt** : l'écran de démarrage (§ 1.5, même nature : attendre un état au lieu d'un délai, dans le fichier permis) ; dans la suite X, la garde « aucune réponse du réseau du service worker », qui seule rend visible une route restée en place (§ 2.1).
4. **Nom de branche** : la consigne de la session proposait une autre branche (`claude/…`) ; j'ai suivi le prompt de la mission (`outillage/environnement-4`).
5. **Processeur « bridé »** : `cpulimit` n'est pas installé ; le bridage se fait avec `taskset -c 0` et une boucle qui occupe le même cœur en continu (la suite n'a donc qu'environ la moitié d'un cœur), comme pour OUTILLAGE-X.


## 7. Ce qui n'a pas pu être vérifié
- **Valeur exacte de la fin aléatoire au run 207** : non lue (le numéro des devis n'est pas écrit dans le journal). Que le devis PAC ait contenu « DPS » est **certain par le calcul** (paire unique sur 144 qui redonne 127,57266666666665), pas par une lecture.
- **Probabilité d'environ 0,8 % par passage** : **probable**, calculée sur le nombre de recherches et l'ordre des devis. Une collision ne change pas toujours un résultat, donc c'est plutôt un plafond.
- **Écran de démarrage** : instabilité reproduite seulement sous processeur bridé, en local, jamais vue sur la CI. Rien ne prouve qu'elle aurait frappé sur le runner.
- **Suite X, mécanisme du rejet par le SRI** : l'effet est mesuré (`net::ERR_FAILED` quand le fichier manque du cache, avec la route encore là). Le mécanisme précis (le `fetch` du service worker hérite de l'intégrité de la requête de la page) est **probable**, lu dans le code de `sw.js`, pas dans celui de Chromium.
- **Actions v7** : les pages « Releases » et l'API des dépôts `actions/*` ne sont pas joignables d'ici (refus du réseau et du périmètre GitHub de la session). Les notes viennent des fichiers du dépôt (README, CHANGELOG, `action.yml`, journal) lus par `git`. Le comportement est vérifié par la CI de cette branche.
- **Safari / iPhone** : pas concerné par ces changements de tests, pas testé.
- **Copie dans le Project** : pas d'outil Projects dans cette session (voir l'en-tête).

