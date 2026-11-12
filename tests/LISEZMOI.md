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
| `CP_SUITES` | liste réduite de suites (débogage) ; le rapport est alors **PARTIEL** (code 3), jamais « COMPLET » | toutes |
| `CP_SANS_Q=1` | retire la suite Q (débogage local seulement ; rapport PARTIEL, code 3). En CI, Q est jouée et bloquante | Q jouée |

Statuts d'un contrôle dans le rapport (M3 C5/C9, 21/10/2026) : `PASS` ; `FAIL` (bloquant) ; `SKIP` (non vérifié, rend le passage INCOMPLET — sauf les 2 SKIP connus de l'autotest d'isolation sans `unshare -n`) ; `INSTABLE` (statut conservé mais **plus utilisé** depuis P0-suite, 24/10/2026 : les deux contrôles de la suite Q qui le portaient sont redevenus bloquants) ; `À TRANCHER` (suite Y : références « assujetti » en attente d'une décision de Gabriel, non bloquantes, listées). `INSTABLE` et `À TRANCHER` ne sont **jamais** comptés comme réussis. Codes de sortie de `run-all.sh` : 0 complet et tout réussi ; 1 échec ; 3 incomplet ou partiel.

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

## Ajouts 05/10/2026 (relecture R1 à R4)
- suiteN-passage-reel.mjs (30 contrôles) :
  - sans démarrage explicite, aucun passage en réel ni import, même avec un SIRET ;
  - démarrage par l'écran : anciennes factures ESSAI- par défaut, import seulement si choisi, `p_min_numero` sans les essais ;
  - chiffre d'affaires, recettes et impayés sans les essais ; date future ; refus sans SIRET ou avec une date passée ;
  - R3 : réponse perdue puis devis modifié ;
  - R4 : année du document au 31/12.
- serveur-simule.mjs : serveur Supabase simulé, partagé par les suites I et N.
- functions/test-superpdp-envoi.mjs (7 contrôles) : en production, envoi depuis le registre (R2).

## Ajouts 21/10/2026 (mission F, C1 — branche `correctif/c1-registre-illisible`)
- suiteAA-registre-illisible.mjs (16 contrôles, banc deux appareils) : registre des factures **illisible** ou **lent** (plus de 25 s)
  → rien n'est émis, aucune demande au serveur, message « impossible de vérifier » ; registre lisible → reprise de la facture émise
  ailleurs, solde = total − acompte ; registre lu **périmé** → refus du serveur, reprise ; hors ligne inchangé ; **mode démonstration**
  (numéros TEST-, pas de registre serveur) : même règle appuyée sur l'état synchronisé (cloud muet → rien ; état plus récent sur le
  serveur pas encore reçu → rien, « pas à jour » ; après synchro → solde TEST = total − acompte).
- banc-appareils.mjs : `S.registreBloque[dev]` (lecture du registre en erreur), `S.registrePendu[dev]` (lecture qui ne revient pas) ;
  règle serveur `regleSource` (identique à la migration) dans le serveur commun ; même règle dans serveur-simule.mjs (suites I, N, R).
- tests/sql/test_une_facture_par_source.py (16 contrôles, vrai PostgreSQL) : migration `20261021180000_une_facture_par_source.sql`
  appliquée deux fois — 2e solde refusé avec la facture existante renvoyée et aucun numéro consommé ; solde qui ignore l'acompte refusé ;
  solde cohérent accepté (±0,011) ; avoir total libère, avoir partiel non ; acompte annulé puis refait ; 2e acompte et acompte après
  solde refusés ; une facture vivante par intervention / location / année de contrat ; autre utilisateur ; rejeu `request_id` ;
  reconstituées hors règle ; 8 soldes simultanés → un seul accepté ; droits ; retour arrière = fonction 1.10.
- tests/supabase-test/4-une-facture-par-source-TEST.sql (verrou par marqueur, 5 « OK ») et 4-une-facture-par-source-retour-arriere.sql.

## Ajouts 24/10/2026 (P0-suite — branche `refonte/p0-suite`, tests et docs seulement)
- **Suite Q, contrôles « acompte » (Q7) et « voile » (Q10) : de nouveau BLOQUANTS** (plus aucun INSTABLE). Q7 : le registre des factures est coupé pour le téléphone
  (`S.registreBloque`) pendant que le PC émet, un rapprochement tardif est FORCÉ puis l'état « pas à jour » est vérifié (deux contrôles « Mise en place »), le registre n'est
  rouvert qu'avant le clic du téléphone ; le PC émet l'acompte de Y seulement APRÈS la reprise de X (la reprise relit tout le registre : constat P0-suite, voir
  `docs/P0-SUITE-COMPTE-RENDU.md` § 2). Q10 : le PC est au repos (ni envoi ni lecture) avant son retour simulé sur la fenêtre (`cpVerifierDistant` l'ignore sinon).
- **Suite T, T5b** (M3 C10) : tournée dont les adresses n'ont aucune coordonnée → « Ma journée » lance `completerGeo`, une fois par adresse, affiche « en cours de calcul »,
  se réaffiche avec les km quand c'est fini (géocodage simulé ralenti à 0,7 s pour observer l'état « en cours »).
- **Faux serveur** (`serveur-simule.mjs`) : `fail.horsService` rend la forme réelle de supabase-js 2.117.3 (réponse RÉSOLUE `{error:{message:'TypeError: Failed to fetch'}, data:null, status:0}`),
  plus une promesse rejetée ; suite I (I3) : deux contrôles de plus (message « serveur injoignable » inchangé, forme de la réponse).
- **Indépendance du jour réel (R12)** : `tests/lib.mjs` exporte `REF` (date de référence figée = celle des suites golden : mardi 20/10/2026 10:00 Paris ; `REF.horloge`, `REF.jour`,
  `REF.an`) et pose `window.__REF` dans chaque page. Une suite dont le résultat dépend du jour fige sa page par `page({horloge:REF.horloge})` et écrit ses attendus avec `REF.an` :
  suites E (avoirs), F (2e bloc), M (M6). **Vérification : `faketime '2027-01-05 10:00:00' bash tests/run-all.sh`** (paquet `faketime`) doit rester vert.
  **Exception admise (OUTILLAGE-2, 05/11/2026)** : les tests SQL de l'agenda (`tests/sql/test_agenda.py`) lisent `current_date` **du serveur PostgreSQL** une fois par test, au lieu d'une date figée : le ménage de `cp_busy_remplacer` se fait sur la date du serveur, et une date figée finirait « passée ». L'esprit de la règle est gardé (le résultat ne dépend plus du jour de la machine qui lance les tests : 66 / 66 sous `faketime` samedi, dimanche et 05/01), la lettre non.
  Les « 2026 » restants dans les suites sont classés dans `docs/P0-SUITE-COMPTE-RENDU.md` § 4 (commentaires datés, barèmes légaux 2026, calendrier, données de test sans lien avec le jour).
- **Chromium récent (Playwright ≥ 1.63, Chromium ≥ 153) dans `unshare -n`** : il ignore `Network.emulateNetworkConditions{offline:false}` et se croit hors ligne, la suite I s'arrête alors à I5.
  Contournement **hors dépôt** utilisé pour ces essais : dans l'espace réseau isolé, une paire `veth` avec adresses privées (10.9.9.1/24 et 10.9.9.2/24) et **sans route** (rien ne peut sortir).
  Conséquence : le contrôle « seule la boucle locale existe » de l'autotest est rouge par construction, et la suite X (hors ligne) doit être rejouée sans veth (8/8). Non corrigé dans `env.mjs`.

## Ajouts 30/10/2026 (mission F, C3 — branche `correctif/c3-article-absent`, compte rendu `docs/C3-COMPTE-RENDU.md`)
- suiteAC-articles-absents.mjs (≈ 130 contrôles ; le préfixe AB est réservé à la mission S) : un article absent de la base de prix (renommé,
  supprimé, ancienne sauvegarde, nom de repli de l'assistant) reste compté 0 € — **aucun calcul ne change** — mais il est **signalé** :
  - C3-T1 à C3-T3 (page figée des golden) : ancien format, clim murale v2, gainable v2 ; mêmes totaux et mêmes lignes au millième que le
    même devis avec ces noms présents dans la base à 0 € ; `absents` = la liste attendue ; avertissement sur chaque ligne ;
  - C3-T4 : PDF (HTML de l'aperçu, comme la suite Y) : mention sur chaque ligne concernée, montants = ceux du calcul ;
  - C3-T5 : bandeau rouge (style « Montant différent ») à l'ouverture et au récapitulatif, téléphone et PC, ancien et nouveau format ;
  - C3-T6 : confirmation avant l'envoi (liste « Envoyer », mail, signature en ligne ; refus = rien envoyé, statut inchangé) ;
  - C3-T7, C3-T8 : Base de prix — renommer (propagation aux devis non facturés, ou « seulement l'article »), supprimer ; devis facturés intacts ;
  - C3-T9 : assistant — noms de repli vérifiés dans la base ; C3-T10 : les 52 cas golden, montants identiques au millième, `absents` vide
    sauf 3 cas qui contenaient déjà un article absent (« Support mural », « Article inexistant XYZ ») ; C3-T11 : sauvegarde restaurée.
  Les scénarios de page sont des chaînes autonomes (`AIDE`, `SC_…`) qui rendent leurs verdicts : la suite n'ajoute **aucun cas** à
  `tests/golden/cas-calculs.mjs` (les 3 cas golden C3 sont à ajouter sur une machine avec Chromium, voir le compte rendu § 7).
- `tests/isolation/rapport.mjs` : étape `suiteAC-articles-absents` → `resAC.json` (sans elle, la suite serait ignorée par le rapport).

## Ajouts 31/10/2026 (P6+ — branche `correctif/p6-env-superpdp`)
- **`tests/sql/test_p6_droits.py`** (15 tests, PostgreSQL local) : retrait des droits inutiles du visiteur non connecté (`anon`) —
  cinq petites fonctions, tables ClimPilot et leurs séquences ; appli connectée et `service_role` inchangés ; rejouable, tables
  absentes tolérées ; retour arrière ; scripts TEST / RÉEL (copie conforme de la migration, verrous éprouvés, lignes « OK », et
  « À REVOIR » sur une base non migrée) ; script d'essai n° 1 (mêmes 36 contrôles, plus rien d'ouvert au visiteur).
  **Garde** (`test_p6_14`) : la base de test applique **toutes** les migrations de `supabase/migrations` (ordre des noms) ; aucun
  objet du schéma `public` ne doit rester accessible à `anon`. Une nouvelle migration qui oublie `revoke … from public, anon` le fait échouer.
- `tests/supabase-test/6-droits-anon-TEST.sql` (verrou par marqueur, 27 « OK »), `6-REEL-droits-anon.sql` (refuse le projet TEST,
  19 « OK »), `6-droits-anon-retour-arriere.sql` (2 « OK »).
- `tests/functions/test-superpdp-envoi.mjs` : 30 contrôles (bac à sable seulement si `env === 'sandbox'`, valeur brute enregistrée à la
  connexion) ; suite H, bloc H3 (environnement inattendu → compte réel).

## Ajouts 03/11/2026 (mission AF1 — zéro perte de données)
- suiteAD-af1-pertes.mjs : AF1-T1 à T13 du dossier `docs/MISSION-AF-CORRECTIONS.md` (§ 2) + C-N1 + A-N5 : devis signé, accepté ou
  facturé en lecture seule (enregistrement refusé, « Faire un avenant », suppression refusée) ; fiche fluide numérotée jamais à la
  corbeille avant 5 ans, « annulée » avec motif ; garde « Enregistrer / Abandonner » des Paramètres ; coordonnées du détenteur gardées
  sur la fiche fluide et envoi du lien refusé sans adresse ; fiche fluide rouverte puis enregistrée sans perte (signature, refus, lien) ;
  « Lieu / urgence » du contrat d'intervention gardé au clic suivant ; fiche client existante jamais écrasée par l'adresse d'un document.
  Horloge figée sur REF. Rouge sur le code d'avant (46 contrôles), verte après la correction.
- AF1-bis (relecture indépendante du 03/11, exception au gel décidée par Gabriel) : 17 contrôles ajoutés à la suite AD (74 en tout) et 2 contrôles T9 à l'attendu changé — T14 avenant / original
  (pas d'avenant sur un devis facturé ; avenant accepté → original « remplacé par l'avenant », hors facturation, « À commander », « Planifier » et carnet ;
  acceptation refusée si l'original a été facturé entre-temps), T15 « Annuler le devis » (motif obligatoire, refusé tant qu'une facture vivante existe,
  PDF ANNULÉ, non supprimable, journal), T16 verrou de la signature sur l'ancien formulaire (boutons cachés, `nxsSendDevis` refusé), T17 apostrophe ’ du
  détenteur, T9 texte de la question des Paramètres. Rouges sur `9fcf2cf`, verts après. Suite I : cas I3d (devis « envoyé » passé « Accepté » à l'écran
  sans enregistrer, puis modifié → « Facturer » enregistre d'abord), vert d'emblée.

## Ajouts 06/11/2026 (mission P3 — branche `correctif/p3-fusion-etats`, compte rendu `docs/P3-COMPTE-RENDU.md`)
- **suiteU-fusion.mjs** : la seconde passe `cpFusionEtats` (états terminaux) est extraite d'`index.html` avec `cpMerge` ; cas **U-P3-1 à U-P3-16** sur les vraies clés
  (`cp2_devis`, `cp2_fluides`, `cp2_dep`, `cp2_fluseq`) : annulé / remplacé / signé / facturé contre planification, relance ou lignes modifiées ; deux gestes terminaux
  (premier en date) ; fiche fluide annulée ou signée contre observation ; compteur des fiches au plus grand ; encaissements à trois voies ; témoins (retour en arrière voulu,
  sans base) ; **U-P3-15** symétrie (L et R échangés → même état) ; propriétés : idempotence avec des devis, entrées intactes, liste des arbitrages non énumérable ni sérialisée.
  **Golden `tests/golden/fusion-empreinte.txt` régénéré** (3f01fbdc → 76e10290) avec l'accord écrit de Gabriel du 06/11 : les 23 cas et 3 propriétés d'origine sont inchangés.
- **suiteAD-af1-pertes.mjs** : **T32 à T41** (faux cloud EN PAGE : vrais `pushState` / `pullState`, vraie `cpMerge` enveloppée, rechargement compté) — annulation, signature
  en ligne, signé contre lignes, facture contre annulation (deux sens), deux factures dans l'arbre, avenant contre annulation (dates dans les deux ordres, posées à la main),
  fiches fluides, **garde à la réception** (T39), encaissements (T40), **vieille sauvegarde restaurée** (T41, `importJSON`) ; **T42** : `nxSetStatut` refuse un changement de
  statut sur un devis signé (constat 1). **T19a et T22a réécrits** : la fusion ne reproduit plus le défaut D1 (l'original reste « remplacé ») ; les contrôles de réparation
  partent d'un état posé à la main. Rouges sur `297cc7e` (24 ; le 1er contrôle de T36 est un témoin), verts après.
- **suiteAE-p3-fusion.mjs** (nouvelle, 22 contrôles, banc deux appareils `banc-appareils.mjs`) : AE1 annulation contre planification par la vraie synchro (conflit, fusion,
  rechargement, nouvel envoi, réception sur le téléphone) ; AE2 signature en ligne contre relance (le PC refuse ensuite d'enregistrer) ; AE3 avenant accepté contre date sur
  l'original (une seule facture dans l'arbre) ; AE6 témoins ; AE5 **ancienne version** (seconde passe et garde remplacées par l'identité sur le PC) : le téléphone P3 remet
  l'état, écritures bornées (2 ou 3 observées, borne du test 4) puis plus aucune au tour suivant ; AE4 **facturation réelle démarrée**, deux appareils facturent chacun un devis du même arbre (état gelé, registre ouvert) :
  les deux factures restent, message « deux factures », une 3e est refusée. Inscrite dans `run-all.sh` (`SUITES_DEFAUT`) et `isolation/rapport.mjs` (`resAE.json`).
- Pièges rencontrés en écrivant ces tests (côté test, pas côté appli) : en mode démonstration connecté, un appareil **n'émet pas** de facture si le serveur a un état plus
  récent que le sien (garde-fou C1 « pas à jour ») : dans un scénario « le PC facture pendant que le téléphone annule », le PC doit facturer **avant** que l'état du téléphone
  n'arrive au serveur ; un avenant est un nouveau contrat au mode de conclusion « à préciser » : pour un **particulier**, la facture est bloquée (L221-10, voulu), d'où un
  client professionnel dans AE4. Dates qui départagent deux gestes : posées à la main, à 10 ou 20 minutes d'écart (horloge figée dans la page).
- **P3-bis (09/11/2026, relecture P10 d'Opus 5.5)** : suite U, cas **U-P3bis-1 à 9** (un geste ordinaire reçu de l'autre appareil n'est pas un arbitrage ; libellé exact sans « geste fait
  ici » ; option `{reception:true}` de `cpFusionEtats` : rangs ≥ 2, fiches ≥ 1 et compteur seulement, rien sans base ; `cpFusionLibelle` extraite d'`index.html` comme `cpFusionEtats`) ;
  suite AD **T43 à T46** (message exact ; réception d'un geste ordinaire sans « à envoyer », sans ligne, sans version écartée, sans écriture serveur ; garde sans base inactive ; garde avec base :
  signature, fiche annulée et compteur remis, encaissement retiré appliqué) ; suite AE **AE7** (témoin deux appareils : trois gestes ordinaires du PC en ligne, le téléphone au repos ne journalise
  rien et n'affiche aucun message « états remis » ; revu en **P3-ter** : chaque écriture serveur est attribuée à l'appareil qui la fait en enveloppant `S.appel`, et chaque écriture du téléphone
  ne change que `figEnv` dans `cp2_devis` ou `cpnext_objsuivi`, ou rien — comme sur `main` (1 à 3 écritures du téléphone, borne large 4) ; plus de borne sur le total, qui varie avec la charge).
  Rouges sur `a2e15a8` : U 82 / 8, AD 141 / 7, AE 24 / 1 ; verts après.

## Ajouts 10/11/2026 (mission S — sécurité de l'appli, branche `correctif/s-securite`, compte rendu `docs/S-COMPTE-RENDU.md`)
- **suiteAB-securite.mjs** (71 contrôles, horloge figée REF, cloud coupé) : un jeu de huit textes d'essai (noms avec apostrophe, guillemet, et textes
  préparés pour s'exécuter : ni secret ni donnée personnelle) passe par chaque porte d'entrée d'un texte tiers, et rien ne doit s'exécuter.
  - AB1 noms de clients : 13 écrans + 8 fiches 360 + éditeur ouverts et survolés, ≈ 490 clics, texte affiché à l'identique, sept boutons qui portent le
    nom (cellule des contrats, « Proposer un contrat », « Nouveau devis » = choix de la nature avec ce client, « + Contrat », « + Équipement », « Nouveau contrat »,
    « Plus de messages ») vérifiés pour un nom avec apostrophe et un nom avec guillemet ;
  - AB2 articles : import de tarif simulé (`nxcatParseCSV` + `nxcatImportRows` + `nxcatPromote`), catégories créées par l'assistant, base de prix, filtres
    de catégorie, devis (articles et récapitulatif), à commander (stock enregistré pour le bon article), bon de commande PDF ;
  - AB3 réservation du site (8 demandes, `nxtrPlanifierSite` avec `nxaSiteLigne` simulé) ; AB4 assistant (`nxaApply.client/machine/article`) ;
  - AB5 facture reçue (plateforme simulée comme en suite H, 8 numéros) : « Fichier » appelé avec le numéro exact ; AB6 sauvegarde restaurée (`importJSON`,
    rechargement) : identifiants invalides réparés et journalisés (`cpnext_journal`, `id_repare`), textes affichés sans exécution ;
  - AB7 réservation au nom d'un client existant (nom écrit autrement : espaces, majuscules) : aucune fiche en double, rien d'effacé, différences notées ;
  - AB8 page de signature (`signer.html`, serveur simulé par une route) : exemplaire téléchargé capturé, rouvert dans une page : aucun script exécuté, CSP du
    fichier, signature PNG embarquée seulement, 0 violation de la CSP sur la page ;
  - AB9 six exports CSV (recettes, livre, facturier, registre des documents, devis, dépannages) : cellule « formule » neutralisée, montant négatif intact ;
  - AB10 CSP : balises de `index.html` et `signer.html`, copie d'essai construite (`tools/essai`) avec la CSP, 33 écrans × 2 appareils avec écoute de
    `securitypolicyviolation` (0), fonctions sous la CSP (adresses, SIREN, PDF, signature, ZIP, import Excel avec un classeur construit par le vendor xlsx) ;
  - AB11 bibliothèques : xlsx, jszip, tesseract chargés depuis `vendor/` avec une empreinte sha384 juste, les six fichiers Tesseract listés avec leur empreinte
    dans `vendor/LISEZMOI.md`, tous dans `sw.js`, plus aucune adresse de CDN dans l'appli, aucune requête CDN ni extérieure pendant la suite ;
  - AB12 golden : empreintes sha256 des 20 fichiers de référence (Y, Z, W, U) figées dans la suite (une régénération se fait en changeant ces valeurs, en
    conscience) ; rendu imprimé de « M. "Jojo" Martin » et « L'Atelier du Froid » à l'identique ;
  - AB13 lecture de plaque : image de plaque **fixe** (`tests/plaque-essai.png`, texte noir sur blanc dessiné une fois : la police du système changeait la lecture
    d'une machine à l'autre), `#nxOcrFile` rempli, `nxRunOCR()` : champs marque / modèle / série / fluide / charge, requêtes vers `vendor/` seulement, 0 violation de la CSP.
  Rouge sur `main` (`6a89e60`) : 21 / 50 ; vert après : 71 / 0. Journaux rouges hors dépôt (règle 8).
- `tests/lib.mjs` et `tests/golden/page-figee.mjs` : la route qui coupait tout nom contenant « tesseract » ne coupe plus que les hôtes de CDN
  (`cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `tessdata.projectnaptha.com`) : les fichiers de `vendor/` se chargent en local.
- `tests/lib.mjs`, `cspPourLesTests` : la CSP de l'appli interdit `eval` ; les suites écrites avant S exécutent leur code de fin de scénario dans la page par `eval(c)`
  (I, J, K, L, N, R, AD). `page()` sert donc `index.html` avec `'unsafe-eval'` en plus dans `script-src` (tout le reste gardé, route de contexte : service worker compris) ;
  `page({cspReelle:true})` sert la page telle quelle (suite AB, qui vérifie que la CSP réelle est bien là et qu'`eval` est refusé). `page-figee.mjs` (Y, Z, W, AC) sert la page telle quelle.
- `tests/isolation/rapport.mjs` : étape `suiteAB-securite` → `resAB.json`. `tools/apercu/build.sh` retire la balise CSP de l'aperçu (publié dans une autre page).

## Ajouts 11/11/2026 (S-bis — conditions C1 et C2 de la relecture P10 de S, même branche, `docs/S-COMPTE-RENDU.md` § 10)
- **suiteAB-securite.mjs** : 13 contrôles de plus (86 au total), chacun dans sa propre page.
  - AB5 bis : huit numéros de facture et huit numéros d'avoir d'essai (apostrophe, guillemet, barre oblique inverse, textes préparés pour s'exécuter, un numéro
    régulier en témoin) posés sur 8 devis facturés, 8 avoirs (`cp2_avoirs`, `nxavReload`) et 8 envois (`cpnext_pdp`), plateforme simulée comme en AB5. Chaque bouton
    qui porte un numéro est cliqué avec sa fonction remplacée par un espion : « Faire un avoir », « XML », « Avoir sur … » et « Envoyer … » (bloc facturation du devis),
    « Détail », « Envoyer » (écran Facture électronique), « Copie déposée » (historique), choix de la nature (fenêtre d'envoi, XML simulé). Attendu : la fonction reçoit
    le numéro exact, rien ne s'exécute à l'ouverture, au survol ni au clic.
  - AB6 bis : sauvegarde à l'**ancien format** (sans clé `all`, appliquée sans rechargement) avec des identifiants hors règle dans les sept listes et un article :
    identifiants réparés en mémoire et dans le stockage, journalisés (`id_repare`), identifiant valide gardé, 7 écrans ouverts, survolés et cliqués, la ligne du
    client ouvre toujours sa fiche.
  Rouge sur `c99dc00` : 75 / 11 (les 73 contrôles de S verts, 11 des 13 nouveaux rouges, 2 témoins verts) ; vert après : 86 / 0. Journal rouge hors dépôt.
- **suiteX-mise-a-jour.mjs** (diagnostic seul) : sur la CI, le rechargement hors ligne de l'étape 3 n'atteint parfois jamais « load » (plantage au bout de 90 s ; jamais reproduit en local,
  même sans isolation du noyau ni sur un seul cœur occupé). Dans ce cas la suite écrit une ligne `DIAGNOSTIC rechargement hors ligne — …` (état de la page, service workers,
  requêtes sans réponse) avant de planter comme avant : `run-all.sh` la recopie dans le rapport. Rien d'autre ne change ; la cause reste à trouver (mission OUTILLAGE).
- `tests/suiteX-mise-a-jour.mjs` : la copie « version N » crée les sous-dossiers listés par `sw.js` (`vendor/tesseract-core/`, `vendor/tessdata/`) avant de copier ; 8 / 8 comme avant.

## Ajouts 12/11/2026 (mission COMPTE — mot de passe, double authentification, appareils, branche `correctif/compte`, compte rendu `docs/COMPTE-COMPTE-RENDU.md`)
- **faux-auth.mjs** (nouveau) : faux serveur d'authentification Supabase, réponses aux formes de supabase-js 2.117.3 embarqué (relues dans `vendor/`) : `updateUser`, `reauthenticate`,
  `signOut` et ses portées (`local`, `global`, `others`), `mfa.enroll / challenge / verify / challengeAndVerify / unenroll / listFactors`, `getAuthenticatorAssuranceLevel` **local**,
  `refreshSession`, `onAuthStateChange` (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED). Chaque appel REND `{data, error}` ;
  coupure = `AuthRetryableFetchError`, status 0. Sessions par appareil (révocation : autres appareils, activation de la double authentification), facteurs TOTP, défis,
  code de ré-authentification « envoyé » lisible par le test, erreurs injectables (`S.auth.injecter`). Code TOTP **calculé par le test** (RFC 6238) depuis la graine
  publique de l'annexe B de la RFC 6238 ; heure du serveur simulé = `REF.horloge` (+ décalage réglé par le test), jamais la vraie date.
- **banc-appareils.mjs** : `serveurCommun(debut, { auth: {…} })` active l'authentification simulée (sinon l'ancien faux client, inchangé pour Q, AA et AE) ;
  `S.auth.exigerJeton = true` : sans session, l'état et le registre sont refusés comme pour un visiteur non connecté ; message de dialogue gardé sur 600 caractères.
- **suiteAH-compte.mjs** (64 contrôles à COMPTE, 95 depuis COMPTE-bis ; ≈ 210 puis ≈ 340 s ; sous la CSP réelle) : test du test TOTP ; carte « Mon compte » : AH1 (12 caractères comptés par caractère), AH2, AH3 (corps
  `{current_password, password}`, champs vidés, mot de passe absent du stockage, du journal, des messages, de l'écran et de la console), AH4 (code par e-mail), AH5 (réponses du
  serveur), AH6 (hors ligne), AH7 (« Déconnecter mes autres appareils » : portée `others`, une fois), AH8 (« Déconnexion » : portée `local`), AH9 (PC : QR code fabriqué dans
  l'appli ; iPhone : lien `otpauth://`), AH10 à AH12 (code faux, juste, facteur fantôme), AH11 bis (appareil de secours), AH13 (2e étape de connexion, aucune lecture de l'état
  avant le code), AH14 (démarrage), AH15 (retrait), Q8 (« Continuer sans connexion »), AH16 (code PIN : témoin + texte), AH17 (session fermée pendant l'usage : bandeau sans
  nombre, formulaire gardé), AH18 (**vrai** supabase-js, jeton expiré, Supabase injoignable : pas d'écran de connexion, reprise au retour du réseau, ≈ 90 s), AH20 (sans cloud) ;
  banc deux appareils AHB1 à AHB4 et AH21 (mise à jour reçue pendant un parcours « Mon compte » : pas de rechargement, rien d'effacé) ; test du test du QR code (`cpQr`) : identique module par module à qrcode 8.2 (Python) pour 3 textes × 8 masques (segno 1.6.6 ajoute
  toujours un octet nul de plus en mode octets : écartée comme référence). Inscrite dans `run-all.sh` et `isolation/rapport.mjs` (`resAH.json`).
  Rouge sur `main` (`99ddd50`) : 15 / 48 sur les 63 premiers contrôles (témoins verts : TOTP, PIN, CSP, démarrage aal2…) ; AH21 rouge sur `1eeae01` ; vert après : 64 / 0. Journaux rouges hors dépôt.
  **COMPTE-bis (12/11/2026, conditions C1 à C7 de la relecture P10)** : AH22 (« Déconnexion » hors ligne au jeton expiré : session de cet appareil effacée, l'appareil
  reste déconnecté au retour du réseau ; sur le banc ET avec le **vrai** supabase-js, horloge de la page avancée de 95 s), AH23 (niveau de session illisible — erreur ou
  exception — : décision par `session.user.factors`, 2e étape, 0 lecture et 0 envoi, dans `doLogin` et au démarrage ; témoin sans facteur), AH24 (« Annuler » du code et
  `SIGNED_OUT` : mot de passe en attente oublié, mise à jour reçue appliquée sans quitter les Paramètres), AH25 (réponse d'`enroll` après « Annuler » ou la sortie des
  Paramètres : facteur retiré, rien d'affiché ; « Continuer » grisé ; nettoyage limité aux facteurs non vérifiés de plus de 15 minutes ; retrait en échec dit à l'écran),
  AH26 (clé TOTP absente de `document.documentElement.outerHTML` après une activation réussie ou annulée), AH13 et AH13 bis plus stricts (lectures et envois de l'état
  comptés à part, reprise déclenchée ; « Continuer sans connexion » depuis la 2e étape). `faux-auth.mjs` : `S.auth.retards[méthode]` (réponse retardée), panne du niveau
  de session (`localStorage.__essai_aal_panne` = `erreur` | `exception`), `signOut` qui charge d'abord la session comme la bibliothèque, `storageKey`.
  Rouge sur `e017bfa` : 73 réussis / 22 échoués sur 95 contrôles (les 22 = exactement les nouveaux contrôles de C1 à C5 ; ceux de C6 sont des témoins verts) ; vert après : 95 / 0 (≈ 340 s). Journaux rouges hors dépôt.
