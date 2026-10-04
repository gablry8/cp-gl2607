# Batterie de tests ClimPilot (30/09/2026, mise à jour le 03/10/2026)

Tests automatiques (Playwright + Chromium) : écrans, boutons, devis de chaque nature, factures,
noms piégés, données abîmées, gros volume, stockage plein, hors réseau, fuseaux horaires,
calculs de dimensionnement, sauvegarde/restauration, brouillons, fiche fluide guidée.

Pas utilisé par l'application (fichiers ignorés par le service worker).

## Lancer toute la batterie (03/10/2026)

```bash
tests/run-all.sh
```

Le script lance, **hors réseau** : l'autotest d'isolation, les suites A à L, les tests des fonctions serveur
(`signature`, listes blanches `assistant` et `superpdp`), les tests SQL (si `PGHOST` est fourni) et la
construction + le test de l'aperçu (`tools/apercu`). Il écrit `rapport.md` et `rapport.json` dans
`$CP_TEST_OUT` (par défaut un dossier temporaire daté) : commit testé, versions, résultats étape par étape,
tentatives réseau bloquées. Code de sortie : 0 tout réussi, 1 au moins un échec, 3 incomplet (non exécuté).

**Lecture des résultats** : un test sans résultat écrit = **NON EXÉCUTÉ** ; un plantage = **ÉCHEC** ;
un validateur absent = **SKIP**. Aucun de ces cas n'est compté comme réussi.

### Installation (versions utilisées le 03/10/2026)

| Outil | Version | Installation |
|---|---|---|
| Node.js | 22.22.0 (≥ 22.6 requis) | https://nodejs.org |
| Playwright + Chromium | 1.56.1 (Chromium 141.0.7390.37) | `npm i -g playwright@1.56.1 && npx playwright@1.56.1 install chromium` |
| Python | 3.11.15 | — |
| Modules Python | pytest 9.1.1, psycopg 3.3.6 (+ psycopg-binary), factur-x 7.1, lxml 6.1.3, saxonche 13.0.0 | `pip install pytest==9.1.1 "psycopg[binary]==3.3.6" factur-x==7.1 lxml==6.1.3 saxonche==13.0.0` |
| PostgreSQL | 16.14 (la production Supabase est en 17) | paquet `postgresql-16` |
| Validateur CEN EN 16931 | tag `validation-1.3.16` (b6c9e06) | `git clone --depth 1 --branch validation-1.3.16 https://github.com/ConnectingEurope/eInvoicing-EN16931` |
| Règles françaises FNFE-MPE | tag `v1.4.0.04` (97ba0f3) | `git clone --depth 1 --branch v1.4.0.04 https://github.com/fnfempe/France_RFE` |

### Variables d'environnement

| Variable | Rôle | Si absente |
|---|---|---|
| `CP_TEST_OUT` | dossier des résultats, XML, journaux, rapport | dossier temporaire daté |
| `PLAYWRIGHT_MODULE` | chemin de `playwright/index.mjs` | module local, sinon `npm root -g` |
| `CHROMIUM_PATH` | exécutable Chromium | Chromium complet de Playwright (`channel: 'chromium'`) |
| `EN16931_XSLT` | `<eInvoicing-EN16931>/cii/xslt/EN16931-CII-validation.xslt` | contrôles CEN en SKIP |
| `BRFR_DIR` | dossier `France_RFE` | contrôles BR-FR en SKIP |
| `PGHOST`, `PGPORT` | banc PostgreSQL local (socket) | tests SQL NON EXÉCUTÉS |
| `CP_SANS_NETNS=1` | accepter de tourner sans isolation du noyau | le script s'arrête si `unshare -n` est impossible |
| `CP_SUITES` | liste réduite de suites (débogage) | toutes |

### Banc PostgreSQL local (tests SQL)

```bash
initdb -D <dossier>/data -U postgres --auth=trust
pg_ctl -D <dossier>/data -l <dossier>/log.txt -w start \
  -o "-p 54329 -k <dossier> -c listen_addresses= -c cluster_name=climpilot-test"
PGHOST=<dossier> PGPORT=54329 tests/run-all.sh
```

`listen_addresses=` : aucune écoute réseau, socket Unix seulement. `cluster_name=climpilot-test` est le
**marqueur** exigé par `tests/sql/cible_locale.py` : sans lui, les tests SQL refusent de s'exécuter.

### Isolation réseau (aucune connexion à la production)

Bloquer Supabase dans Playwright ne suffit pas. La batterie est isolée par deux couches indépendantes :

1. **Noyau** : `run-all.sh` se relance dans `unshare -n`, un espace réseau qui ne contient que la boucle
   locale. Tous les processus y sont enfermés : navigateur, service worker, WebSockets, Node, Python,
   libpq (PostgreSQL), Saxon. Aucune connexion externe n'y est possible, qu'elle soit prévue ou non.
2. **Gardes qui refusent et comptent** (journaux dans `$CP_TEST_OUT/isolation/`) :
   - Node : `isolation/garde-reseau.mjs`, chargé par `NODE_OPTIONS` (sous-processus compris) ;
   - Python : `isolation/sitecustomize.py`, chargé par `PYTHONPATH` ;
   - navigateur : mandataire « refus » local (toute requête non locale, service worker, WebSocket et
     adresse IP brute compris) + règles de résolution de Chromium ; journal des requêtes vues par Playwright ;
   - PostgreSQL : `sql/cible_locale.py` exige un socket local ou la boucle locale, aucune redirection
     (`PGHOSTADDR`, `PGSERVICE`, `DATABASE_URL`), puis, côté serveur, une connexion locale **et** le
     marqueur `climpilot-test`. `PGHOST` seul ne suffit pas.
3. **Autotest** (`isolation/autotest.mjs`, lancé en premier) : contrôle positif (le serveur local répond),
   puis tentatives volontaires vers `*.supabase.co`, `*.superpdp.tech` et 192.0.2.1 depuis Node, Python, une
   page, un WebSocket et un service worker : chacune doit échouer **et** être notée. Gardes désactivées,
   une connexion brute doit encore échouer (preuve que la couche noyau suffit seule).

Le rapport distingue : tentatives vues par Playwright (dont celles que les tests simulent), tentatives
arrivées au réseau du navigateur (toutes refusées), refus des gardes Node et Python, et connexions
externes **réellement établies** (0 : aucune interface externe dans l'espace réseau des tests).
Le service worker n'est **pas** bloqué : il s'installe et ses tests restent possibles (vérifié par l'autotest).
Chromium tente aussi de joindre des services Google (mises à jour de composants) : refusé et classé à part.
Dans l'espace réseau isolé, Chromium se croit **hors ligne** (aucune interface externe) et l'appli refuse alors,
à juste titre, d'émettre en mode réel. `env.mjs` rétablit l'état « en ligne » par le protocole DevTools
(`Network.emulateNetworkConditions`), comme un appareil connecté dont le serveur est simulé : le réseau reste
coupé, et une vraie coupure se simule toujours par `ctx.setOffline(true)`.
Le rapport compte à part les tentatives vers le projet Supabase **réel** (par exemple la page de signature, dont
l'adresse de fonction est écrite en dur) : elles sont servies par une simulation du test et n'atteignent jamais le réseau.

### Ce qui est réel, simulé ou non couvert

| | Réel dans les tests | Simulé | Non couvert ici |
|---|---|---|---|
| Appli | code de la branche servi localement, Chromium | horloge (2027), réseau coupé, presse-papiers | iPhone et Safari réels, impression PDF |
| Serveur Supabase | migration sur PostgreSQL 16 local | serveur des suites H, I, J (mêmes règles que le SQL), authentification des fonctions | projet Supabase (PostgreSQL 17, RLS, Deno, Auth) |
| Fonctions serveur | code TypeScript exécuté par Node | base et authentification | exécution Deno, secrets réels |
| SUPER PDP | — | plateforme simulée (suite H) | bac à sable réel |
| Facture électronique | XSD Factur-X, schematron CEN, règles BR-FR | — | réception par une plateforme |
| Adresses | — | géocodage et itinéraires (suites A, B) | API IGN réelle |

## Ajouts 01/10/2026
- suiteD-memoire.mjs : grande mémoire (IndexedDB), migration, secours, fusion
- suiteE-avoirs.mjs : avoirs (total/partiel, refacturation, remboursements, séries)
- suiteF-einvoice.mjs + genxml.mjs + validate-einvoice.py : XML CII EN 16931, validés contre le XSD Factur-X
  (pip : factur-x, saxonche, lxml) et le schematron officiel CEN
  (git clone https://github.com/ConnectingEurope/eInvoicing-EN16931 ; variable EN16931_XSLT)
- suiteG-virgule.mjs : saisie des nombres à virgule
- suiteH-superpdp.mjs : plateforme agréée Super PDP (serveur simulé) — connexion, contrôle, envoi test,
  statuts, factures reçues, annuaire, compte réel, cadre de facturation BT-23

## Ajouts 02/10/2026 (1.10 — préparation, non déployée)
- suiteI-emission.mjs : émission sécurisée (série TEST en démonstration, numéro du serveur en mode réel,
  facture non émise si serveur ou migration absents, réponse perdue puis nouvelle tentative, double clic,
  avoir, rapprochement, doublons, fusion PC/téléphone, restauration, version envoyée à la synchro,
  deux onglets, ancienne version qui écrit). Le serveur y est SIMULÉ avec les mêmes règles que le SQL.
- tests/sql/ : la migration supabase/migrations/20261002120000_documents_emis.sql testée sur un VRAI
  PostgreSQL (16) avec l'authentification Supabase imitée (00_supabase_emul.sql) et le schéma de production
  relu le 02/10/2026 (01_base_actuelle.sql). Lancer : PGHOST=<socket> PGPORT=<port> pytest tests/sql
  (pip : psycopg[binary], pytest). Concurrence, nouvelle tentative, plantage, écrasement, suppression,
  autre utilisateur, ancienne version : voir test_migration.py.
- Les suites A à H attendent désormais la série de démonstration TEST-F / TEST-AV (pas de cloud dans les tests).
- suiteJ-particuliers.mjs : contrats avec les particuliers (mode de conclusion et urgence distincts,
  « à préciser » bloquant, délai de 7 jours L221-10 sur facture / XML / PDF / encaissement / bascule
  « payée » / relance, paiement irrégulier tracé, rétractation selon le mode, contrat de dépannage avant
  travaux, remise de l'exemplaire, page de signature).
- functions/test-signature.mjs : fonction serveur « signature » (copie 1.10 non déployée) testée avec
  une base simulée : node tests/functions/test-signature.mjs (Node ≥ 22.6).
- Depuis l'étape 3, le jeu de données (lib.mjs SEED) indique « signé dans les locaux » pour le client
  particulier, afin que les autres suites testent la facturation sans le contrôle L221-10.
- suiteK-fiscal.mjs : taux unique (next-taux.js) selon le profil fiscal et la date (ACRE, versement
  libératoire, CFP, CMA, mixte), même taux sur tous les écrans, plafonds micro, franchise de TVA
  (année de création, suivante, courante), avertissement logiciel de caisse.
- suiteL-documents.mjs : dénomination « EI », pied de facture ≠ pied de devis, validité unique, nature S/M,
  assurance et médiateur selon les travaux et le client (blocage en mode réel), factures à 0 €, RGPD,
  sauvegarde au premier lancement de la 1.10, mention de franchise selon la date du document (horloge 2027).

## Ajouts 03/10/2026 (livraison vérifiable)
- run-all.sh, env.mjs, isolation/ : batterie portable et isolée du réseau (voir plus haut).
- functions/test-liste-blanche.mjs : listes blanches des fonctions `assistant` et `superpdp` lues dans la
  configuration serveur `ALLOWED_USER_IDS` ; refus si elle manque (20 contrôles, sans réseau).
- sql/test_cible_locale.py : garde « base de test locale » (14 contrôles) ; sql/test_migration.py : preuve de
  remise non inscriptible à la création du lien (déclencheur cp_sig_insert de la production, complété).
- 01_base_actuelle.sql comparé à supabase/schema.sql (copie de lecture venue de main) et complété.
- tools/apercu/ : construction (`build.sh`) et test (`test-apercu.mjs`) de l'aperçu isolé.

## Ajouts 04/10/2026
- suiteM-adresse-copie.mjs (23 contrôles) :
  - point de départ des trajets absent du code : adresse de l'entreprise géocodée une fois, recalcul après un déménagement, point saisi à la main jamais écrasé, message si rien n'est réglé ;
  - presse-papiers : « Copié » seulement après une vraie copie, et aucune erreur non interceptée en cas de refus ;
  - registre : affichage par 200, recherche et filtres sur tous les documents, compteurs, vitesse (médiane de 5 mesures).
- lib.mjs pose un point de départ **fictif** dans chaque page de test (`depart:false` pour s'en passer).
