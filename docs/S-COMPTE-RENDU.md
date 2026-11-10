# S — sécurité de l'appli — compte rendu (10/11/2026)

> Branche `correctif/s-securite`, partie de `main` = `6a89e60` (après la fusion de P3, PR #16, le 09/11). Exécutant : Fable 5.1 (session Claude Code). Dossier de la mission : **privé** (Project Claude, « ClimPilot — Mission S »), complété le 09/11 par Opus 5.5 et par l'accord écrit de Gab (décisions 1 à 4). Ce compte rendu est **public** : il décrit les corrections sans recopier les textes d'essai ni les chemins d'attaque ligne par ligne ; le détail est dans le Project (`claude/ClimPilot-S-compte-rendu-detail.md`).
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project ; Gab y colle le détail privé remis dans la réponse de la session. Rien n'est fusionné ni déployé ; aucune base Supabase (RÉEL ou TEST) n'a été lue ni écrite : la mission ne touche pas au serveur.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**.

## Ce que Gab décide / fait (10 lignes)
1. **Relecture P10 par Opus 5.5** (skill `relecture-p10`) de la branche `correctif/s-securite` et de ce compte rendu, puis **essai de 20 minutes** sur la copie d'essai (§ 7 : un client « L'Atelier du Froid » sur le PC et le téléphone, un import de tarif, une signature de test, une lecture de plaque).
2. **Fusion de la demande de fusion en brouillon** (numéro dans la réponse de la session) : toi, après la relecture et l'essai. Puis, **le même jour**, sur chaque appareil : attendre « ✓ synchronisé », puis F5 (cache `climpilot-next-1136-production` ; `VERSION` et `NX_VERSION` inchangés, 1.13.0).
3. **Taille** : la lecture de plaque embarquée ajoute **11,7 Mo** au dépôt et au cache hors ligne (six fichiers Tesseract), sous le seuil de 20 Mo que tu avais fixé ; xlsx et jszip ajoutent 1 Mo. Le premier chargement après la mise à jour est plus long ; ensuite tout est en cache.
4. **Rien ne change dans les montants, les mentions et les calculs** : golden Y (documents, XML) et Z (calculs) identiques, aucune régénération ; la suite AB vérifie en plus que les 20 fichiers de référence golden n'ont pas bougé sur la branche.
5. **Ce qui change à l'écran** (§ 5) : sept boutons marchent de nouveau pour un nom avec apostrophe ou guillemet ; la lecture de plaque se fait entièrement sur l'appareil (plus de téléchargement au premier usage, marche hors ligne) ; une réservation du site ne remplace plus une fiche client ; les CSV pour la comptable neutralisent les cellules qui ressemblent à une formule.
6. **Décision à prendre (toi)** : le navigateur vérifie l'empreinte des trois scripts (`xlsx`, `jszip`, `tesseract`) ; il ne peut pas la vérifier pour le worker, les deux moteurs et les deux langues, chargés par le worker. Leur empreinte est écrite dans `vendor/LISEZMOI.md` et contrôlée par la batterie (un fichier changé fait échouer la suite AB). Si tu veux une vérification **dans le téléphone** au chargement, c'est une petite mission à part (§ 8).
7. **Hors mission, noté** dans `docs/APRES-PRO-V1.md` : unifier les 20 copies restantes de la fonction d'échappement (couches non touchées, prévu en P4) ; textes libres des Paramètres (pied de page des devis et factures) affichés tels que tu les tapes.
8. **Retour arrière** : revert du commit « tests + correction » ; aucune donnée ne change de format (un identifiant invalide réparé est journalisé dans `cpnext_journal`, type `id_repare`). Aucun retour arrière côté serveur.
9. **Batterie complète et CI** : voir § 6 (comptes rouge / vert, batterie, `faketime` samedi, dimanche et 05/01, CI sur les deux événements).
10. Mission suivante : **COMPTE** (mot de passe, double authentification, appareils), d'après la file.

## 1. Constat (certain : lu, puis reproduit par les tests rouges)
Le cœur (`index.html`) n'avait **aucune fonction d'échappement à l'affichage** : les noms de clients, désignations d'articles, catégories, unités, numéros et notes étaient écrits tels quels dans le HTML des écrans et des documents imprimés. Le seul filet (`nxClean`, appliqué au stockage de sept clés) ne neutralise que « `<` suivi d'une lettre » et laisse passer guillemets, apostrophes, barres obliques inverses et `&`. Onze boutons de l'appli recopiaient en plus un **texte libre dans le code de l'évènement** (`onclick`, `onchange`) : un nom avec un guillemet cassait les onze, un nom avec une apostrophe en cassait cinq, et un texte préparé pour cela pouvait s'exécuter. Les 45 couches avaient 30 copies de la fonction d'échappement, dont une incomplète. Trois bibliothèques étaient chargées depuis un CDN sans empreinte (lecture de plaque Tesseract, lecteur Excel, ZIP), la page n'avait **aucune politique de sécurité (CSP)**, une réservation venue du site **remplaçait six champs** d'une fiche client existante même quand le site n'envoyait rien, et les exports CSV ne neutralisaient pas les cellules qui commencent comme une formule.

Chemins d'entrée d'un texte tiers (certain) : réservation du site, assistant (e-mail, dictée), tarif fournisseur ou facture lue par l'IA, facture reçue de la plateforme, sauvegarde restaurée venue d'ailleurs.

## 2. Tests rouges d'abord (certain : exécutés sur le code de `main` `6a89e60` avec la suite finale)
Nouvelle suite **`tests/suiteAB-securite.mjs`** (AB1 à AB13 du dossier, 71 contrôles), inscrite dans `tests/run-all.sh` (`SUITES_DEFAUT`) et `tests/isolation/rapport.mjs` (`resAB.json`). Horloge figée sur `REF` ; cloud coupé ; jeu de textes du dossier utilisé tel quel (des noms d'essai, ni secret ni donnée personnelle). Journaux rouges gardés **hors dépôt** (bloc-notes de la session), détail dans le Project.

| Contrôle | Sur `main` (ancien code) | Après correction |
|---|---|---|
| AB1 noms de clients (13 écrans + 8 fiches 360 + éditeur, survol, 490 clics, 7 boutons par nom) | **rouge** : écrans en erreur, textes exécutés au survol et au clic, 5 boutons cassés par un guillemet, 2 par une apostrophe (« Nouveau contrat », « Plus de messages ») | vert |
| AB2 articles (import de tarif simulé, base de prix, filtres, devis, à commander, bon de commande) | **rouge** : filtre de catégorie exécutable et cassé par une apostrophe, texte exécuté, stock non enregistré | vert |
| AB3 réservation du site (8 demandes) | **rouge** (texte exécuté, un nom affiché différemment) | vert |
| AB4 assistant (clients, machines, articles créés automatiquement) | **rouge** (texte exécuté sur la base de prix et dans l'éditeur) | vert |
| AB5 facture reçue (plateforme simulée), bouton « Fichier » | **rouge** : 3 lignes sur 8 n'appellent pas le bon numéro, texte exécuté | vert |
| AB6 sauvegarde restaurée (identifiants invalides, textes) | **rouge** : identifiants non réparés, texte exécuté au clic | vert |
| AB7 réservation au nom d'un client existant | **rouge** : fiche en double (espaces, majuscules), téléphone et e-mail remplacés | vert |
| AB8 exemplaire signé téléchargé | **rouge** : le script du document s'exécute à l'ouverture du fichier ; image de signature extérieure acceptée | vert |
| AB9 CSV (recettes, livre, facturier, registre, devis, dépannages) | **rouge** : cellule formule intacte dans les six exports ; l'avoir négatif était déjà juste | vert |
| AB10 CSP (balise, copie d'essai, 33 écrans × 2 appareils, fonctions) | **rouge** : aucune balise, ZIP et Excel dépendants du CDN | vert |
| AB11 bibliothèques embarquées | **rouge** : rien dans `vendor/`, adresses de CDN dans trois couches, requête CDN pendant la suite | vert |
| AB12 golden (20 empreintes + rendu des noms avec apostrophe et guillemets) | vert | vert |
| AB13 lecture de plaque locale | **rouge** : « Module OCR indisponible » (CDN coupé) | vert : marque, modèle, série, fluide, charge lus en local |

Compte sur `main` : **22 réussis / 49 échoués** (dont les témoins voulus verts : création des jeux de données, golden, rendu des noms). Un détail : AB3, AB4, AB6, AB8 et AB10, que le dossier ne promettait pas rouges, le sont aussi (texte exécuté, identifiants, script de l'exemplaire, balise CSP absente).

## 3. Correction (certain : lu et exécuté)
### 3.1 Une seule fonction d'échappement (S2) — `index.html`, couches
- `window.cpEsc` (cinq caractères : `& < > " '`) définie en tête du cœur. Le cœur l'utilise pour **tous les champs métier affichés** : liste et fiche clients, contrats et garanties, locations, base de prix (nom, catégorie, unité), sélecteurs et récapitulatif du devis, listes de devis, à commander (par article et par chantier), tableau de bord, interventions, fluides, planning, livre des recettes, bloc factures, adiabatique, listes déroulantes (clients, articles, machines, pièces), et tous les documents imprimés (en-tête et pied, devis, factures de chantier, d'intervention, de location, de contrat, contrat de location, fiche fluide, PV, checklist, livre des recettes, bon de commande). Les quatre copies ajoutées par AF1 et les variantes partielles (attributs échappés sur `"` seulement, `cpOptAbsente`, `txtRow`) sont remplacées. Le texte visible ne change pas (vérifié par AB12 et les golden Y).
- Couches : les copies locales de `esc` délèguent à `cpEsc` dans les douze couches touchées (`next-superpdp`, `messages`, `catalogue`, `siren` — qui n'échappait pas l'apostrophe —, `signature`, `cerfa`, `terrain`, `assistant`, `einvoice`, `addons` (`nxEsc`), `commande`, `relance`) ; `next-commande.js` (désignation, unité, fournisseur, nom du chantier, numéro) et `next-relance.js` (nom, numéro, téléphone) échappent désormais ce qu'ils affichent.

### 3.2 Plus aucun texte libre dans un attribut d'évènement (S1)
Les onze boutons du dossier portent le texte dans un attribut `data-*` et le code lit `this.dataset.…` : stock d'un article (à commander), filtre de catégorie (base de prix), cellule client des contrats, « Proposer un contrat » (garanties), « Nouveau devis », « + Contrat », « + Équipement » (fiche 360), « Fichier » (factures reçues), « Plus de messages » (Ma journée), « Nouveau contrat » (fiche 360, couche contrats), retrait d'un tarif fournisseur. La couche devis v2, qui lisait le nom du client **dans le code du bouton** « Nouveau devis » pour ouvrir le choix de la nature, lit maintenant `data-nom` (le choix de la nature reçoit le nom exact).

**Identifiants validés au chargement** : `^[A-Za-z0-9_-]{1,64}$`. `loadArr` (les sept listes) et `rebuildPrix` (articles locaux) remplacent un identifiant hors règle — sauvegarde restaurée, synchro, ancienne donnée — par un identifiant **dérivé du texte** (toujours le même pour le même texte : deux appareils restent d'accord), et journalisent (`cpnext_journal`, type `id_repare` ; `console.warn`). Les identifiants de lots d'un devis aussi.

### 3.3 Nettoyage à l'entrée des flux tiers (S3)
`window.cpTexteSain(texte, max)` : caractères de contrôle retirés (tabulation, retour à la ligne et retour chariot gardés), longueur bornée si demandée. Appliquée à la réservation du site (300 caractères, comme avant), à l'assistant (`cleanDeep`, en plus du retrait de `<` et `>`), à l'import de tarif et à la facture lue par l'IA (référence 120, désignation 300, unité 40, famille et marque 120), et à une sauvegarde restaurée (toute la sauvegarde, sans borne de longueur : rien n'est tronqué). Rien d'autre : le rempart reste l'échappement à l'affichage.

### 3.4 Exemplaire signé et image de signature (S4) — `signer.html`, `next-signature.js`, `next-cerfa.js`
- Le fichier téléchargé par le client porte sa propre balise CSP (`default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:`) : un script présent dans le texte du devis ne s'exécute pas à l'ouverture (AB8). Le cadre d'affichage sur la page de signature était déjà sans script (`sandbox`).
- Une image de signature n'est affichée (page, exemplaire, PDF du devis, fiche Cerfa) que si c'est un **PNG embarqué** (`data:image/png;base64,…`) : `cpImagePng` dans le cœur, `pngOk` dans la page de signature.

### 3.5 Bibliothèques embarquées (S5, décision 1 de Gab) — `vendor/`, `sw.js`, trois couches
- `vendor/xlsx-0.18.5.full.min.js` et `vendor/jszip-3.10.1.min.js` (mêmes versions qu'avant, copiées depuis npm), chargées avec `integrity` (sha384) par `next-catalogue.js` et `next-einvoice.js`.
- Lecture de plaque : `vendor/tesseract-5.1.1.min.js` (empreinte vérifiée par le navigateur), `vendor/tesseract-worker-5.1.1.min.js`, `vendor/tesseract-core/` (moteur WASM, variante SIMD et repli sans SIMD, choisie par le worker comme avant) et `vendor/tessdata/` (langues `fra` et `eng`, modèles `4.0.0_best_int`, ceux que la version en ligne téléchargeait). Les chemins passés au moteur sont absolus (le worker est créé depuis un blob). Les messages d'erreur ne parlent plus de connexion internet.
- Empreintes sha384 des dix fichiers de `vendor/` dans `vendor/LISEZMOI.md`, avec les licences (Apache-2.0, MIT). La suite AB échoue si l'un des six fichiers Tesseract change.
- `sw.js` : les dix fichiers sont en cache hors ligne ; `C` passe de `climpilot-next-1135-production` à **`1136`** (une seule fois). Plus aucune adresse de CDN dans l'appli (vérifié par AB11).
- Copie d'essai (`tools/essai/construire-copie-essai.sh`) : copie désormais tout `vendor/` (sous-dossiers compris) et vérifie que chaque fichier listé par `sw.js` existe. Aperçu (`tools/apercu/build.sh`) : retire la balise CSP (l'aperçu est publié dans une autre page, sans cloud, polices Google) ; son test reste vert.

### 3.6 Politique de sécurité (S6) — `index.html`, `signer.html`
Balise `<meta http-equiv="Content-Security-Policy">` placée avant le premier script, variante « Tesseract gardé » du dossier : `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co https://data.geopf.fr https://recherche-entreprises.api.gouv.fr; worker-src 'self' blob:; manifest-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'`. `'unsafe-inline'` reste nécessaire à l'étape 1 (le cœur s'exécute en ligne, 700 attributs `on*`) ; il disparaîtra en P4. `https://*.supabase.co` couvre le projet réel comme la copie d'essai (jamais l'adresse exacte du projet : la construction de la copie d'essai reste verte). Page de signature : `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src https://*.supabase.co; frame-src 'self'; base-uri 'none'; form-action 'none'` (le cadre `srcdoc` et l'image de signature dessinée passent : 0 violation en AB8). AB10 : 0 violation sur 33 écrans, téléphone et PC, et pendant les adresses, le SIREN, le PDF, la signature, le ZIP et l'import Excel ; AB13 : 0 violation pendant la lecture de plaque.

### 3.7 Réservation du site (S7, décision 3) — `next-terrain.js`
Une demande du site ne remplace plus une fiche existante : rapprochement par nom **sans tenir compte des majuscules ni des espaces en trop** ; seuls les champs vides (téléphone, e-mail, adresse, commune, type) sont complétés ; une valeur différente est **notée dans la fiche** (« Réservation du site (date) — différences à vérifier : téléphone : le site indique « … », ta fiche indique « … » »), jamais appliquée. Un client inconnu est créé comme avant. Le type « professionnel » n'est reconnu que si le profil commence par « pro » (plus « propriétaire »). Le `catch` vide est journalisé et signalé à l'écran.

### 3.8 Exports CSV (S8, décision 4) — `index.html` (4 exports), `next-regime.js`, `next-addons.js`
`window.cpCsvTexte` : une cellule de texte qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot reçoit une apostrophe en tête ; une cellule qui est un nombre (dont un montant négatif, par exemple un avoir) reste un nombre. Appliquée aux six exports : devis, dépannages, livre des recettes (écran), registre des fluides, registre des documents (couche), livre des recettes et facturier (couche régime, les montants passent par `num` et ne sont pas touchés).

### 3.9 Tests et outils (hors appli)
- `tests/lib.mjs` et `tests/golden/page-figee.mjs` : les routes qui coupaient « tout nom contenant tesseract » ne coupent plus que les hôtes de CDN (sinon les fichiers locaux de `vendor/` étaient coupés aussi).
- **Suite X** (certain) : sa copie « version N » des fichiers listés par `sw.js` ne créait pas les sous-dossiers (`vendor/tesseract-core/`, `vendor/tessdata/`) : création du dossier avant la copie ; rien d'autre ne change (8 / 0 comme avant).
- **`eval` et la CSP** (certain, trouvé par les suites visées) : la CSP interdit `eval`, l'appli n'en a pas besoin, mais une dizaine de suites écrites avant S exécutent leur code de fin de scénario **dans la page** par `eval(c)` (I, J, K, L, N, R, AD). Plutôt que d'affaiblir la CSP de l'appli, `tests/lib.mjs` sert aux tests une page dont la balise porte `'unsafe-eval'` **en plus** (tout le reste de la politique est gardé, route posée au niveau du contexte : service worker compris). La suite AB demande la page **telle quelle** (`cspReelle:true`) et vérifie qu'elle porte bien la CSP du dépôt, `eval` interdit. Les suites golden (Y, Z, W, AC, `page-figee.mjs`) tournent elles aussi sous la CSP réelle. Piège appris (certain) : pendant la partie **synchrone** d'un appel de l'inspecteur (`page.evaluate`), Chromium autorise `eval` quelle que soit la CSP ; la politique de la page s'applique après un `await` — c'est pourquoi les anciennes suites tombaient (leur `eval(c)` suit un `await`) et pourquoi la sonde de la suite AB fait un `await` avant d'essayer.

## 4. Test vert (certain)
Suite AB sur la tête de la branche : **71 réussis / 0 échoué** (139 s). Détail des contrôles dans `tests/LISEZMOI.md` (ajouts du 10/11/2026).

## 5. Ce que ça change pour Gab (visible)
- **Sept boutons réparés** pour les noms avec apostrophe ou guillemet (« L'Atelier du Froid », « Dupont " Fils ») : cellule client du tableau des contrats, « Proposer un contrat », « Nouveau devis » (le choix de la nature reçoit le bon client), « + Contrat », « + Équipement », « Nouveau contrat », « Plus de messages » ; plus le filtre de catégorie et le stock d'un article dont le nom contient une apostrophe ou un guillemet.
- **Lecture de plaque locale** : plus aucun téléchargement au premier usage, ça marche hors ligne (cave, chambre froide), et la photo ne quitte toujours pas l'appareil. Première ouverture après la mise à jour : 12 Mo de plus à mettre en cache.
- **Réservation du site** : ta fiche client n'est plus écrasée ; les différences sont notées dans ses notes, à toi de trancher.
- **CSV pour la comptable** : une cellule qui ressemble à une formule est précédée d'une apostrophe (Excel l'affiche comme du texte) ; les montants ne changent pas.
- **Rien d'autre à l'œil** : mêmes textes, mêmes documents, mêmes montants. Les adresses extérieures que l'appli joint restent les mêmes (Supabase, adresses IGN, SIREN) ; une page piégée ne peut plus charger un script ailleurs ni envoyer des données ailleurs (CSP).

## 6. Batterie, horloges, CI
- Suites visées (AB, A, Y, Z, W, Q, I, V, H) : voir § 6.1.
- Batterie complète (`bash tests/run-all.sh`) : voir § 6.2.
- `faketime` 07/11/2026 (samedi), 08/11/2026 (dimanche), 05/01/2027 : suites U, AD, AE, AB : voir § 6.3.
- CI (`.github/workflows/tests.yml`, contrôle « batterie complète ») sur les deux événements (push et demande de fusion) : voir § 6.4.

### 6.1 Suites visées (certain : `CP_SUITES`, tête de la branche, 10/11)
| Suite | Résultat | Note |
|---|---|---|
| A (écrans, boutons) | 14 / 0 | |
| H (Super PDP, serveur simulé) | 46 / 0 | |
| Q (recette deux appareils) | 64 / 0 | 438 s, bloquante |
| V (numérotation) | 8 / 0 | |
| W (enveloppes) | 64 / 0 | **golden `enveloppes.json` inchangé : aucune enveloppe nouvelle** |
| Y (golden documents et XML) | 21 / 0 | **identiques** ; les 5 « À TRANCHER » (assujetti) inchangés, comme sur `main` |
| Z (golden calculs) | 55 / 0 | **identiques au millième** |
| AB (sécurité) | 71 / 0 | puis 2 contrôles ajoutés (CSP réelle dans la page testée), verts après correction de la sonde `eval` (voir § 3.9) |
| I (émission) | plantage au premier passage | `eval(c)` du test refusé par la CSP (§ 3.9) ; corrigé dans `tests/lib.mjs`, rejoué dans la batterie complète (§ 6.2) |

### 6.2 Batterie complète (`bash tests/run-all.sh`, tête de la branche, 10/11)
- **Premier passage** (certain) : **1 588 réussis / 3 échoués / 0 SKIP**, 5 non bloquants « À TRANCHER » (suite Y, comme sur `main`). Les 3 échecs : 2 = la sonde `eval` de la suite AB elle-même (elle essayait `eval` dans la partie synchrone d'un appel de l'inspecteur, que Chromium autorise toujours : défaut du test, corrigé, § 3.9) ; 1 = suite Q, contrôle « Avoir PARTIEL fait sur le PC : le téléphone pas à jour ne refacture pas le chantier » (le téléphone a émis une 2e facture au lieu de reprendre la 1re) — **passé 64 / 64 au passage visé juste avant, même code** : instabilité de la recette deux appareils (course entre les deux appareils), sans lien visible avec S (probable). Suites I, J, K, L, N, R, AD : vertes avec la page servie aux tests (§ 3.9).
- **Second passage** (après la correction de la sonde, certain) : **1 591 réussis / 0 échoué / 0 SKIP**, 5 non bloquants « À TRANCHER » (suite Y, comme sur `main`), Q 64 / 64 (l'instabilité du premier passage ne s'est pas reproduite). La suite **X** (mise à jour du cache hors ligne) a planté dans les deux passages pour un défaut du **test** : elle copie les fichiers listés par `sw.js` dans un dossier plat et ne créait pas les sous-dossiers de `vendor/` (moteur et langues de la lecture de plaque). Copie corrigée (création du dossier), X rejouée seule : **8 / 0**, comme sur `main`. La CI rejoue la batterie entière sur la branche (§ 6.4).

### 6.3 Indépendance du jour (règle 9, certain)
`faketime` « 2026-11-07 10:00 » (samedi), « 2026-11-08 10:00 » (dimanche), « 2027-01-05 10:00 » (05/01 de l'année suivante), suites U, AD, AE, AB : **U 90 / 0, AD 148 / 0, AE 26 / 0, AB 73 / 0** aux trois dates (rapport PARTIEL, code 3, par construction : suites écartées par `CP_SUITES`). La suite AB ne lit jamais la vraie date (horloge figée `REF`, `__REF` dans la page).

### 6.4 CI
(à compléter à la fin de la session)

## 7. Essai de Gab (≈ 20 minutes, sur la copie d'essai, base TEST)
1. **Client avec apostrophe, PC** : ouvrir Clients › « L'Atelier du Froid » (il est dans le jeu d'essai) › « Nouveau devis » → attendu : la fenêtre « Nouveau devis — quelle nature de chantier ? » s'ouvre ; choisir une nature → le devis porte le client « L'Atelier du Froid ». Retour à la fiche › « + Contrat » → le champ client est pré-rempli avec le nom exact ; « + Équipement » → idem ; « Nouveau contrat » → idem.
2. **Même client, téléphone** : ouvrir « Ma journée » (le soir, avec un chantier accepté pour demain au nom de ce client et un téléphone sur la fiche) › bouton « ✕ Plus de messages » de sa ligne → attendu : la ligne disparaît, message « Plus de messages pour L'Atelier du Froid ». Contrats › cliquer le nom du client dans le tableau → la fiche 360 s'ouvre.
3. **Import de tarif** : Base de prix › « Importer un tarif fournisseur » › un fichier Excel ou CSV de ton fournisseur → attendu : les colonnes reconnues, l'import réussi **sans connexion internet** (coupe le wifi avant pour le vérifier) ; aucun message « connexion internet nécessaire ».
4. **Signature de test** : envoyer un lien de signature sur un devis d'essai, signer depuis le téléphone, télécharger l'exemplaire → attendu : le fichier s'ouvre, montre le devis et la preuve de signature avec l'image de ta signature.
5. **Lecture de plaque** : Scanner › photo d'une plaque signalétique → attendu : « Chargement du moteur OCR… » puis « Lecture : … % » puis les champs reconnus, **sans connexion** au premier usage après la mise à jour (le moteur vient du cache de l'appli).
6. **Export** : Suivi fiscal › « Livre des recettes (CSV) » → ouvrir dans Excel → attendu : les montants sont des nombres, un nom de client qui commencerait par « = » serait affiché comme du texte.
7. **Navigateur** : F12 › Console sur l'écran d'accueil, le planning et un PDF → attendu : aucune ligne « Content Security Policy » en rouge (une telle ligne nommerait une fonction bloquée : me la copier).

## 8. Ce qui n'a pas pu être vérifié, et ce qui reste
- **Certain, non vérifiable ici** : iPhone et Safari réels (la CSP et le worker blob sont testés sur Chromium 141 seulement) ; le projet Supabase réel ; le site vitrine et la fonction `site-demande` (hors dépôt).
- **Empreinte des fichiers chargés par le worker** (worker, moteurs, langues) : le navigateur ne la vérifie pas ; elle est contrôlée par la batterie et documentée. Une vérification au chargement dans l'appli (lecture du fichier, SHA-384, comparaison) est possible : petite mission si tu la veux (§ 0, ligne 6).
- **Textes libres des Paramètres** (pied de page des devis et factures, note de bas de devis) : affichés tels que tu les tapes, comme avant ; ils ne viennent pas d'un tiers. Noté dans `docs/APRES-PRO-V1.md`.
- **Copies restantes de la fonction d'échappement** : 20 couches non touchées par la mission gardent leur copie complète (cinq caractères) ; à unifier en P4 (noté).
- **`'unsafe-inline'`** dans la CSP : inévitable à l'étape 1 ; la suppression des `onclick` est le chantier P4.
- Les fichiers Tesseract viennent de npm (`tesseract.js` 5.1.1, `tesseract.js-core` 5.1.1, `@tesseract.js-data/fra` et `eng` 1.0.0), les mêmes que ceux que jsDelivr servait pour `tesseract.js@5` ; jsDelivr et tessdata.projectnaptha.com n'étaient pas joignables depuis la session (réseau fermé), la comparaison octet par octet avec le CDN n'a donc pas été faite (probable : identiques, mêmes paquets).

## 9. Clôture : contrôle des secrets, commits, demande de fusion
- `bash tools/claude/verif-secrets.sh` (index) et `--branche` (avant le push) : **un faux positif, vérifié ligne par ligne** — dans `vendor/tesseract-core/tesseract-core-lstm.wasm.js` et `tesseract-core-simd-lstm.wasm.js` (ligne 14, la ligne unique du fichier minifié), le moteur WASM est embarqué en base64 (`data:application/octet-stream;base64,…`) et cette suite d'octets contient une fois la séquence `eyJ` suivie de caractères base64, ce que le contrôle lit comme un jeton JWT. Ce sont les fichiers publiés par npm (`tesseract.js-core` 5.1.1), reproduits à l'octet (empreintes sha384 dans `vendor/LISEZMOI.md`) : rien à masquer, rien à modifier. Dérogation `CP_SECRETS_OK=1` posée en tête de la commande `git commit` et de la commande `git push`, comme le prévoit `docs/ENVIRONNEMENT-CLAUDE-CODE.md` § 4.
- Les numéros de téléphone des jeux de données de la suite AB sont fictifs et écrits en « 03 44 … » / « 09 70 … » pour ne pas ressembler à un mobile ; les adresses e-mail sont en `exemple.org`.
- Deux commits poussés ensemble sur `correctif/s-securite` (règle 8 : jamais les tests rouges seuls) : « tests + correction », puis « documents ». Demande de fusion **en brouillon** vers `main`, description = les dix lignes du § 0 et les comptes de la CI, sans détail de faille.
