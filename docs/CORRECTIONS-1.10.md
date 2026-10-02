# ClimPilot 1.10 — corrections après audit (préparation, NON déployée)

Branche : `claude/quirky-pasteur-ds9m47`. Point de départ : 1.9.1 (`fe99011`, tag local `avant-1.10`).
La production (`main`, site en ligne, base Supabase) n'a **pas** été modifiée.

**États utilisés pour chaque point**
- **prévu** : décidé, pas encore codé ;
- **implémenté** : codé sur la branche ;
- **testé localement** : tests exécutés dans l'environnement de préparation (navigateur Chromium, PostgreSQL 16 local) ;
- **testé sur le service** : testé contre le vrai service concerné (Supabase de test, SUPER PDP) ;
- **à confirmer** : dépend d'une information ou d'une décision de Gabriel, de son comptable ou d'un tiers.

Les tests réussis ne valent **pas** certification : ils prouvent seulement que les cas décrits se comportent comme attendu.

---

## 0. Erratum de l'audit du 01-02/10/2026

| Constat de l'audit | Erreur | Correction | Source |
|---|---|---|---|
| C1 (facture payée le jour même) | L'audit disait la date d'échéance absente du XML. **Faux** : elle est présente (`DueDateDateTime`). Le rejet BR-FR-CO-09 vient du montant prépayé absent et du net à payer non nul. | Corrigé à l'étape 2, en gardant l'échéance. | Schematron FNFE-MPE 1.4.0.04, règle BR-FR-CO-09 |
| C15 (dépannage) | L'audit parlait d'un devis « au-delà de 150 € ». **Faux** : pour les prestations couvertes par l'arrêté (génie climatique compris), un contrat écrit détaillé est requis **dès le premier euro**, avant les travaux. | Étape 3. | Arrêté du 24/01/2017 (https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000033935513) ; fiche DGCCRF (https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/plomberie-serrurerie-chauffage-choisir-le-bon-professionnel-pour-un-depannage-domicile) |
| C5 (plafond micro) | L'audit laissait entendre que le plafond proratisé s'applique dès l'année de création. **Imprécis** : le régime micro s'applique de droit l'année de création **et** la suivante ; le chiffre d'affaires proratisé sert à apprécier les années d'après. | Étape 4. | BOFiP BOI-BIC-DECLA-10-10-20 (https://bofip.impots.gouv.fr/bofip/1799-PGP.html/identifiant=BOI-BIC-DECLA-10-10-20-20260819) |
| C4 (taux) | L'audit additionnait systématiquement 1,7 % de versement libératoire. **Imprécis** : c'est une option, soumise à conditions, avec un taux selon l'activité (1 % ventes, 1,7 % prestations BIC, 2,2 % BNC). | Étape 4. | impots.gouv.fr, versement libératoire |
| C12 (double envoi) | L'audit affirmait qu'un double envoi impose un avoir. **Non démontré.** | Étape 2 : protection contre le double envoi, sans affirmation sur l'avoir. | — |
| C21 (fourniture et pose) | L'audit disait la règle « non tranchée ». **Incomplet** : le BOFiP traite expressément les entreprises du bâtiment qui fournissent les matériaux principaux. | Étape 4 (analyse). | BOFiP BOI-BIC-DECLA-10-10-20, § 90 |

---

## Étape 0 — Lecture du serveur (lecture seule) et banc de test

**Fait** (02/10/2026, connecteur Supabase, requêtes de catalogue uniquement, **aucune donnée client lue**) :
- **7 tables, toutes avec RLS** : `climpilot_state`, `climpilot_backups`, `climpilot_inbox`, `climpilot_signatures`, `climpilot_catalogue`, `climpilot_pdp`, `climpilot_ai_usage`. Règles « propriétaire seulement ».
- **Fonctions** : `cp_state_push` (écriture conditionnelle), `cp_state_backup_trg` (sauvegardes), `cp_backup_row`, `cp_sig_guard` et `cp_sig_insert` (signature), `cp_block_signup` (inscriptions fermées), `pdp_cred_*` (secret SUPER PDP dans Vault). Les fonctions sensibles ne sont pas exécutables par `anon` ni `authenticated`.
- **Fonctions serveur (Edge Functions)** : `assistant` (JWT + liste blanche), `signature` (publique, jeton par document) et `superpdp` (JWT + liste blanche).
- **Points relevés** :
  1. `climpilot_state` accepte aussi une écriture **directe** par le compte, pas seulement via `cp_state_push`. Il était donc impossible d'empêcher une ancienne version d'écrire. → Corrigé dans la migration (étape 1).
  2. `TRUNCATE` est accordé à `anon` et `authenticated` sur toutes les tables (réglage par défaut). `TRUNCATE` n'est pas soumis à RLS. L'API REST ne l'expose pas, mais c'est retiré par précaution dans la migration.
  3. La seule alerte du conseiller de sécurité Supabase : **protection contre les mots de passe divulgués désactivée** (https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). À activer par Gabriel (étape 5).
  4. La fonction `assistant` envoie à l'API Claude la dictée et un **résumé de l'activité** (noms et villes des clients, devis, interventions). C'est à inscrire au registre RGPD (étape 5).
  5. La fonction `signature` enregistre déjà la demande de commencement anticipé dans le consentement. Elle ne garde **aucune preuve de remise** de l'exemplaire au client (étape 3).
- **Non accessible** : la configuration Auth (double authentification, délais de session), le détail des sauvegardes gérées par Supabase et les secrets (non demandés).

**Banc de test** : PostgreSQL 16.14 local. `tests/sql/00_supabase_emul.sql` imite les rôles et `auth.uid()` de Supabase. `tests/sql/01_base_actuelle.sql` reconstitue le schéma de production relu, sans données ni adresse e-mail. La production tourne en PostgreSQL 17 : **différence de version à garder en tête** ; l'essai sur un projet Supabase de test reste obligatoire.

---

## Étape 1 — Émission sécurisée, documents figés, synchronisation

### 1.1 Numéro attribué et facture enregistrée ensemble, côté serveur (C8)
- **État** : implémenté ; testé localement (PostgreSQL 16 et navigateur) ; **non testé sur Supabase**.
- **Problème reproduit** (avant) : deux appareils hors ligne donnaient chacun `F-2026-006` (simulation de la fusion avec le code de la 1.9.1).
- **Fichiers** :
  - `supabase/migrations/20261002120000_documents_emis.sql` (**non appliquée**) ;
  - `next-emission.js` (nouveau) ;
  - `next-avoir.js` : préparation et enregistrement de l'avoir séparés ;
  - `next-store.js` : écritures suspendues pour l'essai à blanc ;
  - `index.html` : deux lignes (chargement de la couche et version envoyée à la synchro) ;
  - `sw.js` : cache.
- **Principe** :
  - `cp_emettre_document` attribue le numéro et enregistre la facture figée **dans la même transaction**, avec un verrou sur le compteur et des contraintes d'unicité ;
  - une même demande (`request_id`) rejouée renvoie **la même** facture (double clic, coupure, réponse perdue) ;
  - côté appli, la fonction de facturation d'origine est d'abord jouée **à blanc** sur une copie (rien n'est enregistré), puis le résultat est appliqué avec le numéro du serveur. Les calculs existants ne sont pas modifiés.
- **Sans serveur, pas de facture réelle** :
  - cloud connecté + SIRET, mais serveur injoignable, hors ligne ou migration absente : la facture **n'est pas émise**, le chantier reste « à facturer », la demande est gardée pour être reprise à l'identique ;
  - sans cloud ou sans SIRET : **mode démonstration**, série séparée `TEST-F-AAAA-NNN` / `TEST-AV-AAAA-NNN`, PDF marqué « DOCUMENT DE TEST », envoi en production impossible ;
  - un appel direct à l'ancien compteur local est refusé en mode réel.
- **Avant / après** :

| Cas | 1.9.1 | 1.10 (testé localement) |
|---|---|---|
| Deux appareils hors ligne | deux `F-2026-006` | pas de facture hors ligne en mode réel ; numéros uniques et continus sous 25 émissions simultanées (PostgreSQL) |
| Double clic ou nouvelle tentative | — | une seule facture (10 appels simultanés avec la même demande → 1 document) |
| Réponse perdue | — | rien d'appliqué, demande gardée ; la nouvelle tentative retrouve la même facture |
| Serveur ou migration absents | — | facture non émise, message explicite, aucun numéro local |

- **Limites** :
  - le comportement réel de Supabase (PostgREST, JWT, PostgreSQL 17) n'est **pas** encore testé ;
  - l'émission demande le réseau : sur un chantier sans réseau, le bon d'intervention et l'encaissement s'enregistrent, la facture s'émet au retour du réseau (décision de Gabriel) ;
  - la date du document doit être celle du jour (± 1 jour, contrôlée par le serveur).

### 1.2 Document figé complet, protégé côté serveur
- **État** : implémenté ; testé localement.
- **Contenu figé** à l'émission (`payload`) :
  - les données de facturation telles qu'émises (objet facture) ;
  - les coordonnées du vendeur et du client, les lignes, les montants, les taux, les dates, la nature et le cadre (modèle du XML) ;
  - ensuite le **HTML du PDF** et le **XML**, produits à partir de cette même version et déposés une seule fois (`cp_document_fichiers`).
- **Utilisation** : réimpressions et envoi à la plateforme repartent de ces fichiers (testé : changer le nom de l'entreprise après l'émission ne modifie pas la réimpression). La nature de l'opération est désormais figée à l'émission ; un changement à l'envoi est refusé et expliqué.
- **Protections serveur** (testées sur PostgreSQL 16) :
  - lecture de ses seules lignes ; aucune écriture directe ;
  - déclencheurs interdisant modification et suppression, **y compris** pour un rôle qui contourne RLS ;
  - fichiers écrits une seule fois ; compteur qui ne recule jamais ;
  - autre utilisateur : ne voit rien, ne peut rien toucher ;
  - `TRUNCATE` refusé.
- **Paiements et statuts** : table d'événements à part, en ajout seul ; l'original n'est jamais réécrit (testé).
- **Anciennes factures** (avant 1.10) : importées comme « **reconstituées** », jamais présentées comme identiques au document envoyé. Leur réimpression porte la mention « Duplicata reconstitué… peut différer du document envoyé à l'origine ».
- **Limites** :
  - les fichiers figés sont aussi gardés sur l'appareil, en une seule entrée qui grossit avec le nombre de factures (à surveiller au-delà de quelques centaines) ;
  - une facture émise en démonstration n'existe que sur l'appareil.

### 1.3 Synchronisation : aucune facture émise perdue (C7)
- **État** : implémenté ; testé localement.
- **Problème reproduit** (avant) : le PC émet la facture de solde, le téléphone hors ligne modifie le même devis → après fusion, la facture disparaît.
- **Correction** :
  - la fusion (`cpMerge`, enveloppée) remet toujours en place un champ de facture émise présent d'un côté ;
  - les factures annulées, les registres et les avoirs sont fusionnés par union, les compteurs par maximum ;
  - au démarrage, en mode réel, un **rapprochement** avec le registre du serveur remet en place une facture disparue de l'appareil, sans jamais renuméroter.
- **Avant / après (testé)** :
  - conflit PC/téléphone : facture **et** note du téléphone conservées ;
  - restauration d'une vieille sauvegarde puis synchro : facture conservée ;
  - facture supprimée de l'appareil : remise en place depuis le serveur.
- **Doublons historiques** : deux documents au même numéro sont conservés avec leurs identifiants et signalés (bandeau ; l'envoi sera bloqué à l'étape 2).
- **Limite** : la fusion garde, pour le reste du devis, la règle actuelle (« l'appareil en cours l'emporte » si les deux ont modifié).

### 1.4 Deux onglets, ancienne version encore ouverte
- **État** : implémenté ; testé localement (deux onglets réels dans Chromium).
- **Deux onglets** : le nouvel onglet démarre en **lecture seule**, avec un voile explicatif ; rien n'y est enregistré. « Utiliser cet onglet » met l'autre en lecture seule puis recharge celui-ci.
- **Ancienne version** :
  - si une autre version écrit dans le stockage, l'onglet actif passe en lecture seule ;
  - côté serveur (migration), `cp_state_push` exige la version ≥ 1.10 et l'écriture directe de l'état est retirée (testé sur PostgreSQL : l'ancienne appli est refusée) ;
  - tant que la migration n'est pas appliquée, la 1.10 se replie sur l'ancien appel (testé).
- **Limite** : un onglet d'une ancienne version peut continuer à travailler **sur l'appareil** jusqu'à son rechargement. Ses factures, émises avec l'ancien compteur, seraient ensuite importées comme « reconstituées » et signalées.

### Tests exécutés pour l'étape 1 (02/10/2026)
- `tests/sql/test_migration.py` sur PostgreSQL 16.14 : **13/13**. Contrôle négatif : sans verrou ni index unique, le test de concurrence **échoue** (doublons détectés), il est donc probant.
- `tests/suiteI-emission.mjs` (navigateur, serveur simulé avec les mêmes règles) : **24/24**.
- Suites existantes, adaptées à la série de démonstration TEST : A 14/14, B 54/54, C 17/17, D 18/18, E 19/19, F 6/6, G 10/10, H 27/27.
- **Non exécuté** : essai sur un projet Supabase de test (condition de déploiement).

---

## Étape 2 — Facture électronique (C1, C12, C19)

### 2.1 Facture déjà payée à l'émission (C1)
- **État** : implémenté ; testé localement (validateurs officiels) ; **non testé** sur le bac à sable SUPER PDP.
- **Problème reproduit** (avant) : cadre B2/S2/M2 avec un net à payer égal au total et aucun montant déjà payé → `BR-FR-CO-09_BT-23-1` et `BR-FR-CO-09_BT-23-2` (bloquants). La date d'échéance, elle, était bien présente (voir l'erratum).
- **Correction** (`next-einvoice.js`) : en situation « 2 », montant déjà payé (BT-113) = total TTC, net à payer (BT-115) = 0, et **date d'échéance (BT-9) conservée** et égale à la date de paiement, avec la mention « Facture acquittée le … ». BR-FR-CO-07 autorise une échéance antérieure à la facture dans ce cadre.
- **Avant / après** : avant, 2 erreurs bloquantes ; après, 0 (XSD + CEN + BR-FR).
- **À savoir** : avec les factures figées (étape 1), le XML est celui de l'émission. Une facture émise puis payée garde le cadre « 1 » ; le paiement est un événement à part (statut « encaissée » sur la plateforme). Le cadre « 2 » ne concerne que les factures déjà payées au moment de l'émission (cas des anciennes factures recalculées).

### 2.2 XML produit depuis la version figée ; date de prestation (C19)
- **État** : implémenté ; testé localement.
- **XML et envoi** :
  - le XML est généré à partir du modèle figé à l'émission (`nxEinvXMLOf`) ;
  - en compte réel, c'est **le fichier émis** qui part sur la plateforme (récupéré sur le serveur s'il manque sur l'appareil) ;
  - le bac à sable reprend la même version, avec les identités de test.
- **BT-72** : la date de l'intervention est transmise pour un dépannage (`ActualDeliverySupplyChainEvent`).
- **Limite** : pour les chantiers, locations et contrats, aucune date de prestation fiable n'est connue. Le bloc livraison reste vide, ce qui donne un simple **avertissement** `PEPPOL-EN16931-R008` sur 7 des 11 documents de la matrice (aucune erreur).

### 2.3 Garde-fous d'envoi SUPER PDP (C12)
- **État** : implémenté ; testé localement (plateforme simulée) ; **non testé** sur SUPER PDP.
- **Problème reproduit** (avant) : le bouton « Renvoyer » renvoyait une facture déjà déposée sans rien vérifier.
- **Correction** (`next-superpdp.js`, `verifierAvantEnvoi`) :
  - **numéro porté par deux documents** : envoi bloqué ;
  - **document de démonstration** (série TEST) : jamais sur la plateforme réelle ;
  - **facture d'avant la 1.10** (non figée, reconstituée) : envoi réel bloqué, *à confirmer* avec le comptable ;
  - **déjà déposée en réel** : le dernier statut est **relu sur la plateforme** avant toute décision ;
    - renvoi permis seulement après un rejet technique (`fr:213`, `api:invalid`, `api:rejected`) ;
    - `fr:210` (refusée par le client) : pas de renvoi, message « traiter selon le motif — à confirmer » ;
    - autre statut : renvoi bloqué ;
    - statut illisible : renvoi bloqué par prudence ;
  - la nature de l'opération (cadre BT-23) est figée à l'émission ; un changement à l'envoi est refusé et expliqué.
- **Ce qui n'est pas affirmé** : rien n'affirme qu'un double dépôt imposerait un avoir. Le traitement des doublons par SUPER PDP (même `external_id`) reste **à confirmer** auprès de SUPER PDP (documentation non accessible depuis l'environnement de préparation).

### Tests exécutés pour l'étape 2 (02/10/2026)
- **Matrice de 11 XML** (`tests/genxml2.mjs`) : factures figées de chaque sorte (dépannage, location, contrat, acompte, solde après acompte, avoir partiel, TVA 10 % et 20 %), versions bac à sable, ancienne facture payée le jour même. Résultat : **0 erreur bloquante** avec :
  - le XSD Factur-X EN16931 (bibliothèque `factur-x` 7.1) ;
  - le schematron **CEN EN 16931** 1.3.16 (https://github.com/ConnectingEurope/eInvoicing-EN16931, commit `b6c9e06`, moteur Saxon-HE 13.0.0) ;
  - le schematron **FNFE-MPE BR-FR** 1.4.0.04 (https://github.com/fnfempe/France_RFE, commit `97ba0f3` du 05/09/2026).
- **Suite F** : 9/9 (dont le contrôle BR-FR-CO-09 et la date BT-72). **Suite H** : 33/33 (dont 6 nouveaux garde-fous).
- **Ce qui distingue les niveaux** :
  - validation **locale** = ces trois validateurs ;
  - **bac à sable SUPER PDP** : non testé depuis cet environnement (pas d'identifiants, pas d'accès réseau à la plateforme) ;
  - **plateforme réelle** : non testée (pas de SIRET).
- **Régression complète** : A 14/14, B 53/54, C 17/17, D 18/18, E 19/19, F 9/9, G 10/10, H 33/33, I 24/24, SQL 13/13.
  - Le contrôle B en échec est le test de **volume** (temps d'affichage de moins de 0,8 s avec 1 500 devis). Mesuré côte à côte, il varie autant en 1.9.1 qu'en 1.10 (registre des documents : 346 à 880 ms en 1.9.1, 399 à 1 053 ms en 1.10 ; moyennes d'environ 630 et 585 ms) : test instable dans cet environnement, pas de régression constatée.

---

## Étape 3 — Contrats avec les particuliers (C2, C3, C15)

Nouvelle couche `next-particuliers.js` (chargée après `next-emission.js`), plus des retouches ciblées dans `next-emission.js` (crochet `nxAvantEmission`), `next-signature.js`, `signer.html` et la fonction serveur `signature` (copie préparée, **non déployée**).

Textes relus pour cette étape (Légifrance, 02/10/2026) :
- art. L221-10 (aucun paiement avant 7 jours, contrat hors établissement, et ses exceptions) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226864
- art. L242-7 (sanction : 2 ans et 150 000 €) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000034072627
- art. L221-9 (exemplaire daté, papier signé ou, avec l'accord du client, autre support durable, avec le formulaire de rétractation) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563126
- art. L221-18 (délai de 14 jours) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226842
- art. L221-20 (délai prolongé de 12 mois si l'information manque) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563199
- art. L221-25 (demande expresse de commencement anticipé, sur papier ou support durable hors établissement, et reconnaissance de la perte du droit après exécution complète) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179
- art. L221-28 (exceptions au droit de rétractation, dont 8° : réparations urgentes demandées par le client) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563170
- chapitre L221-1 à L221-29 (définitions « à distance » et « hors établissement ») : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221319/
- arrêté du 24/01/2017 (dépannage, réparation, entretien) : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000033935513 — art. 2 (information préalable) : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000033959889 — art. 4 (contrat détaillé avant travaux) : https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000033935526

### 3.1 Mode de conclusion et urgence : deux informations distinctes, saisies par Gabriel
- **État** : implémenté ; testé localement (suite J).
- **Problème reproduit** (avant) : l'appli ne savait pas où le contrat était signé. Le texte de rétractation n'existait que pour le devis envoyé en ligne, toujours intitulé « contrat conclu à distance ». La date retenue était celle du passage en « Accepté ».
- **Correction** :
  - chaque devis, intervention, location ou contrat d'un particulier porte un objet `conclusion` : **mode** (signé chez le client / à distance / dans les locaux / **à préciser**, valeur par défaut), **date réelle** de signature, **preuve** (signature en ligne, papier signé, accord écrit, autre + référence), **urgence** (case à part, avec ce qui était urgent), **demande expresse** de commencement anticipé, **remise** de l'exemplaire ;
  - fenêtre « Contrat avec un particulier » (bouton « Préciser / modifier » dans la facturation du devis, « Lieu / urgence » sur l'intervention) ;
  - signature en ligne : la **date** (jour à Paris de l'horodatage du serveur) et la **preuve** sont remplies automatiquement ; le **mode n'est jamais deviné** (une signature en ligne après une visite chez le client reste un contrat hors établissement) ; une conclusion déjà saisie n'est pas écrasée.
- **Client professionnel** : aucun de ces contrôles.

### 3.2 Aucun paiement avant 7 jours (L221-10), sur tous les parcours
- **État** : implémenté ; testé localement (suite J) ; calcul du délai **à confirmer**.
- **Problème reproduit** (avant) : un devis signé chez le client le jour J pouvait recevoir une facture d'acompte payable « à la commande » et un encaissement le jour même, sans avertissement.
- **Règle appliquée** :
  - « **à préciser** » → aucune demande de paiement : pas de facture (la fenêtre s'ouvre), pas de relance ;
  - **hors établissement, sans urgence** → paiement possible à partir de **J+8** (le jour de la signature n'est pas compté : lecture prudente de « avant l'expiration d'un délai de sept jours à compter de la conclusion ») ;
  - urgence expressément demandée, contrat dans les locaux, à distance, client professionnel → pas de délai (L221-10 ne vise que le hors établissement, et exclut les réparations urgentes).
- **Parcours couverts** :

  | Parcours | Comportement |
  |---|---|
  | Facture (devis acompte/solde, intervention, location, contrat) | crochet `nxAvantEmission` **avant** toute demande de numéro : arrêt si « à préciser », sinon date d'exigibilité J+8 |
  | Version figée | `fac.exigibleLe` dans le document enregistré sur le serveur ; échéance du XML (BT-9) = J+8 avec le texte « Paiement exigible à partir du … (art. L221-10) » ; même mention imprimée sur le PDF figé |
  | Encaissement (`payerFacture`) et bascule « payée » d'une intervention (`payDep`) | avertissement (L221-10, L242-7) ; « non » = rien n'est enregistré |
  | Relance de paiement par mail | bloquée tant que le délai court ou que le contrat est « à préciser » |
  | Devis papier | encadré « aucun paiement ni acompte avant 7 jours » (et la date J+8 si la signature est connue) |
  | Mail de location (chèque de caution) | avertissement : la caution pourrait être une « contrepartie » — **à confirmer** |

- **Paiement reçu malgré tout** : il est enregistré tel quel (date, mode), jamais refusé en silence, avec :
  - un indicateur `paiementIrregulier` (« irrégulier » si le délai courait, « à vérifier » si le contrat était à préciser) ;
  - un événement `paiement_irregulier` dans le registre du serveur (déjà prévu par la migration) ;
  - une tâche prioritaire « Régulariser / Vérifier » dans « À faire ». Que faire ensuite (remboursement…) est **à voir avec un conseil** : l'appli ne le décide pas.
- **Anciennes factures** (avant 1.10) d'un particulier : elles sont « à préciser » ; l'encaissement propose d'abord de préciser le contrat, sinon il est enregistré « à vérifier ».
- **Limites** :
  - le calcul J+8 est prudent ; un jour plus tôt pourrait être permis selon la lecture du texte — **à confirmer** ;
  - la caution de location (chèque non encaissé) : **à confirmer** ;
  - un contrat d'entretien pluriannuel est contrôlé par rapport à sa date de conclusion (le délai ne concerne en pratique que la première facture).

### 3.3 Information sur la rétractation selon le mode
- **État** : implémenté ; testé localement (suite J).
- **Correction** :
  - le texte de `next-signature.js` est exposé (`nxRetractationHTML(d, mode)`) et intitulé selon le mode : « hors établissement », « à distance », ou « à distance ou hors établissement » tant que c'est à préciser ; rien pour un contrat conclu dans les locaux ;
  - il est imprimé sur le **devis papier** d'un particulier (et donc aussi dans le devis envoyé en ligne, qui en est la capture) avec le formulaire de rétractation, sans doublon ;
  - case de **demande expresse** de commencement anticipé, avec la **reconnaissance** qu'après exécution complète il n'y a plus de droit de rétractation (L221-25, L221-28) — sur le papier, sur la page de signature et dans le consentement enregistré par le serveur ;
  - pour un contrat signé chez le client : rappel qu'aucun paiement n'est dû avant 7 jours.
- **Limites** :
  - pour un chantier avec **fourniture de matériel**, le point de départ du délai de 14 jours (signature ou réception des biens) dépend de la qualification du contrat — **à confirmer** ; le texte actuel parle de la signature ;
  - le formulaire reprend le modèle de l'annexe à l'article R221-1 ; sa formulation exacte n'a pas été recomparée mot à mot dans cette étape — **à confirmer**.

### 3.4 Dépannage chez un particulier : contrat écrit **avant** les travaux, dès le premier euro (C15)
- **État** : implémenté ; testé localement (suite J).
- **Correction** :
  - à l'ouverture d'une intervention d'un particulier, **bandeau rouge** « À faire AVANT de commencer » tant qu'aucun contrat n'est enregistré ;
  - bouton **« Contrat d'intervention à signer »** : document imprimé à partir des données de l'intervention, contenant ce que demandent les art. 2 et 4 de l'arrêté : date, entreprise (nom, adresse, SIRET, téléphone), client et lieu d'intervention, nature exacte des travaux, taux horaire TTC et mode de décompte du temps, frais de déplacement, décompte détaillé (quantité × prix unitaire), totaux HT/TTC et TVA (ou mention de franchise), gratuité du document, durée de validité, zones « bon pour accord » et « exemplaire remis » ; texte de rétractation si signé chez le client hors urgence ;
  - bouton **« Contrat signé par le client »** : date + type de preuve enregistrés (`contratAvant`) ; le bandeau passe au vert ;
  - facturer **sans** contrat préalable reste possible (la prestation faite doit être facturée), mais demande une confirmation et laisse une **trace** (`contratAvantManquant`) visible sur l'intervention.
- **Écart avec le plan** : le plan prévoyait de verrouiller la saisie des travaux tant que le contrat n'est pas signé. Je ne l'ai pas fait : la saisie sert aussi à préparer le contrat (pièces, temps estimé) et le verrou empêcherait de facturer un travail déjà fait. Le contrôle est donc un avertissement fort + une trace. **À confirmer** si tu préfères un blocage.
- **Limites** :
  - la phrase « le temps est compté sur place, de l'arrivée à la fin de l'intervention » est une valeur par défaut — **à confirmer** selon ta pratique (l'arrêté demande d'indiquer les modalités de décompte) ;
  - « offre valable le jour de son établissement » — **à confirmer**.

### 3.5 Remise de l'exemplaire : « remis » seulement avec une preuve
- **État** : implémenté ; testé localement (suite J, test de la fonction) ; fonction serveur **non déployée**.
- **Papier** : zone « exemplaire client remis le … — signature du client » sur le devis et le contrat d'intervention ; bouton « Exemplaire papier remis (accusé signé) ».
- **Électronique** :
  - page de signature : case facultative « j'accepte de recevoir mon exemplaire sur support durable » ; après signature, bouton **« Télécharger mon exemplaire »** (document + preuve de signature dans un fichier autonome) ;
  - fonction `signature` (copie dans `supabase/functions/signature/index.ts`, établie à partir de la version 3 déployée, lue en lecture seule) : nouvelle action `copie` qui enregistre la date du premier téléchargement et le nombre de téléchargements, et dépose une note dans la boîte de Gabriel ; si la migration n'est pas appliquée, la signature fonctionne comme avant (repli testé) ;
  - l'appli relit `copie_le` lors de la synchro des signatures (repli sans ces colonnes si la migration manque) et affiche « téléchargé par le client le … (enregistré par le serveur) ».
- **Sans preuve**, l'appli affiche « Exemplaire client : **non confirmé** ».
- **Limite** : un téléchargement prouve que le fichier a été récupéré, pas qu'il a été conservé ; la valeur de cette preuve est **à confirmer**.

### Tests exécutés pour l'étape 3 (02/10/2026)
- **Suite J** (`tests/suiteJ-particuliers.mjs`) : **50/50** — « à préciser » bloquant ; J+8 sur la facture, le PDF figé, le XML et le document du serveur ; frontière J+7 / J+8 ; urgence, locaux, distance, professionnel sans délai ; encaissement et bascule « payée » (« non » = rien, « oui » = irrégulier + tâche) ; relance bloquée puis permise ; rétractation selon le mode sans doublon ; contrat de dépannage (mentions des art. 2 et 4) ; remise papier et électronique ; date de conclusion depuis la signature en ligne (fuseau de Paris) ; mode réel : aucun appel au serveur si « à préciser » ; page de signature (case, téléchargement, remise enregistrée).
- **Fonction `signature`** (`tests/functions/test-signature.mjs`, Node 22, base simulée) : **10/10**.
- **Régression** : A 14/14, B 54/54, C 17/17, D 18/18, E 19/19, F 9/9, G 10/10, H 33/33, I 24/24.
  - Les jeux de données des suites B, C, E, H, I et `genxml.mjs` précisent désormais le mode de conclusion de leurs clients particuliers (« dans les locaux », ou dépannage signé il y a 10 jours) : sans cela, la 1.10 refuse — à juste titre — leurs factures.
- **Non testé** : la fonction déployée sur Supabase, la page de signature contre le vrai serveur.
