# ClimPilot 1.10 — corrections après audit (préparation, NON déployée)

Branche : `claude/quirky-pasteur-ds9m47`. Point de départ : 1.9.1 (`fe99011`, tag local `avant-1.10`).
**Base `main` intégrée le 03/10/2026** : `7deb19188de320c53f088224181bbc92b904b952` (1.5.1 « contrôles cumulables,
arrondis, contrat séparé » et copies de lecture du serveur), fusionnée dans la branche par un commit de fusion.
**Correction** : les comptes rendus du 02/10 disaient « `main` est toujours à `fe99011` ». C'était faux : deux
commits d'autres sessions (`665161f`, `7deb191`) y avaient été ajoutés le 01/10. Ils sont maintenant intégrés.
La production (`main`, site en ligne, base Supabase) n'a **pas** été modifiée.

**États utilisés pour chaque point**
- **prévu** : décidé, pas encore codé ;
- **implémenté** : codé sur la branche ;
- **testé localement** : tests exécutés dans l'environnement de préparation (navigateur Chromium, PostgreSQL 16 local) ;
- **testé sur le service** : testé contre le vrai service concerné (Supabase de test, SUPER PDP) ;
- **à confirmer** : dépend d'une information ou d'une décision de Gabriel, de son comptable ou d'un tiers.

Les tests réussis ne valent **pas** certification : ils prouvent seulement que les cas décrits se comportent comme attendu.

**Résumé** : étapes 0 à 5 implémentées et testées localement ; rien n'est déployé (ni la migration, ni les fonctions `signature`, `assistant`, `superpdp`, ni le site). La section **Livraison**, en fin de document, donne l'état de chaque point, les points à confirmer, l'ordre de déploiement **envisagé** (à confirmer sur un projet de test) et la reprise par Codex.

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
- **Renforcé ensuite (voir 3.6)** : à ta demande, le contrôle se fait maintenant **avant** les travaux, par une fenêtre bloquante à l'ouverture de l'intervention ; le contrôle à la facturation reste comme second filet. La saisie (pièces, temps) reste possible pour préparer le contrat.
- **Limites** :
  - la phrase « le temps est compté sur place, de l'arrivée à la fin de l'intervention » est une valeur par défaut — **à confirmer** selon ta pratique (l'arrêté demande d'indiquer les modalités de décompte) ;
  - « offre valable le jour de son établissement » — **à confirmer**.

### 3.5 Remise de l'exemplaire : « remis » seulement avec une preuve
- **État** : implémenté ; testé localement (suite J, test de la fonction) ; fonction serveur **non déployée**.
- **Papier** : zone « exemplaire client remis le … — signature du client » sur le devis et le contrat d'intervention ; remise **déclarée** avec les pièces remises et l'accusé signé (détail en 3.7).
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

---

## Étape 4 — Fiscalité et cotisations (C4, C5, C6, C21)

Nouvelle couche `next-taux.js` ; retouches ciblées dans `index.html` (helper `cotisPct()`, 11 lectures et le champ des Paramètres), `next-devis2.js` (2 lectures) et `next-regime.js`.

Sources (lues le 02/10/2026 ; `bofip.impots.gouv.fr` et `www.impots.gouv.fr` sont bloqués depuis l'environnement de préparation : leurs règles ont été lues **en extraits de recherche**, pas en page complète) :
- taux micro 2026 (21,2 % prestations BIC, 12,3 % ventes, 25,6 % BNC) : https://entreprendre.service-public.gouv.fr/vosdroits/F36232 ; https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-ac-plnr.html
- ACRE : décret n° 2026-69 du 6 février 2026 (taux = 75 % du taux normal pour une création à partir du 01/07/2026) : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053449085 ; durée (fin du 3e trimestre civil suivant le début, demande dans les 60 jours) : https://www.urssaf.fr/accueil/exoneration-acre-createur.html
- versement libératoire (1 % ventes, 1,7 % prestations BIC, 2,2 % BNC ; revenu fiscal de référence N-2 ≤ 27 478 € par part en 2026) : https://www.impots.gouv.fr/professionnel/le-versement-liberatoire
- formation professionnelle (0,3 % artisan, 0,1 % commerçant) : https://entreprendre.service-public.gouv.fr/vosdroits/F23459
- taxe pour frais de chambre de métiers (0,48 % prestations, 0,22 % ventes, hors Alsace-Moselle) : BOFiP BOI-IF-AUT-20 — **à confirmer**
- plafonds micro 2026-2028 (83 600 / 203 100 €) : https://www.impots.gouv.fr/professionnel/questions/pour-rester-micro-entrepreneur-quel-montant-de-chiffre-daffaires-ou-de ; micro de plein droit l'année de création et la suivante, prorata : BOFiP BOI-BIC-DECLA-10-10-20
- franchise de TVA (37 500 / 41 250 € prestations, 85 000 / 93 500 € ventes ; création sans prorata ; année suivante proratisée) : https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-puis-je-etre-redevable-de-la-tva ; https://entreprendre.service-public.gouv.fr/vosdroits/F21746
- logiciel de caisse : BOFiP BOI-TVA-DECLA-30-10-30 : https://bofip.impots.gouv.fr/bofip/10691-PGP.html

### 4.1 Un seul taux, daté, sourcé, avec ses hypothèses (C4)
- **État** : implémenté ; testé localement (suite K) ; profil **à confirmer** par Gabriel.
- **Problème reproduit** (avant) : `P.cotisTaux` = 13,22 % par défaut, libellé « URSSAF 11 % + CFE/CMA 0,52 % + impôt 1,70 % » ; le simulateur utilisait d'autres valeurs (10,6 % ACRE, 0,52 %, 1,7 %) ; 22 lectures dispersées.
- **Correction** :
  - table datée (`nxTauxTables`) et **profil fiscal** dans Paramètres : début d'activité, activité (prestations / mixte + part de ventes), ACRE, versement libératoire, inscription au registre des métiers, CFE, taux manuel. Valeur par défaut de chaque réponse : **à confirmer** ;
  - **une seule fonction** `nxCotisPct(date)` ; `index.html` (`cotisPct()`), `next-devis2.js` et `next-regime.js` l'utilisent ; `P.cotisTaux` n'est plus qu'une valeur de compatibilité, recalculée (aussi quand le profil arrive d'un autre appareil par la synchro) ; le champ des Paramètres est en lecture seule ;
  - provisions au **taux de la date** de chaque encaissement (livre des recettes, synthèse comptable, trimestre URSSAF) : l'ACRE se termine en cours d'année ;
  - chaque taux est affiché avec son **détail** et ses **hypothèses** (ACRE non comptée tant qu'elle n'est pas confirmée ; versement libératoire compté tant que ce n'est pas tranché ; CFE non comprise ; tout le CA en prestations…).
- **Avant / après** (profil par défaut, 02/10/2026) : 13,22 % → **23,68 %** (21,2 + 1,7 + 0,3 + 0,48). Avec l'ACRE pour une création au 15/07/2026 : **18,38 %** jusqu'au 30/06/2027 (15,9 + 2,48), puis 23,68 %.
- **À confirmer** : éligibilité à l'ACRE (publics visés depuis 2026, demande dans les 60 jours) ; option pour le versement libératoire (revenu fiscal de référence) ; inscription au registre des métiers et taux de la taxe CMA ; montant de la CFE.

### 4.2 Plafond du régime micro (C5, corrigé par l'erratum)
- **État** : implémenté ; testé localement.
- **Correction** : plafonds par période (77 700 / 188 700 € jusqu'en 2025 ; **83 600 / 203 100 €** en 2026-2028) ; compteur réel (`nxEtatMicro`) : **micro de plein droit** l'année de création et la suivante, le CA de création étant ajusté au prorata pour apprécier la suite ; ensuite, alerte au dépassement (deux années de suite au-dessus font passer au réel au 1er janvier suivant). Le simulateur de « Statut & régime » utilise ces valeurs et ce message.

### 4.3 Franchise de TVA : compteur réel (C6)
- **État** : implémenté ; testé localement.
- **Correction** (`nxEtatFranchise`, carte « Seuils » dans **Ma journée** et **Statut & régime**) :
  - année de **création** : franchise perdue en cours d'année seulement au-delà du seuil majoré (41 250 €, **sans prorata**) ; le CA de l'année sera comparé l'année suivante au seuil de 37 500 € **proratisé** (ex. création au 01/07/2027 : 18 904 €) ;
  - année **suivante** : franchise perdue depuis le 1er janvier si le CA de création dépasse le seuil proratisé ;
  - années **courantes** : CA de l'an dernier > 37 500 € → perdue depuis le 1er janvier ; CA de l'année > 37 500 € → perdue au 1er janvier suivant ; > 41 250 € → TVA **dès le jour du dépassement** ;
  - assujetti : compteur sans objet.
- **Hypothèses affichées** : CA retenu = le plus élevé entre facturé (avoirs déduits) et encaissé — prudent, **à confirmer** ; tout le CA compté en prestations.
- Le message erroné du simulateur (« la franchise tombe en cours d'année » dès 37 500 €) est corrigé.

### 4.4 Activité mixte : matériel fourni et posé (C21) — analyse, aucune provision modifiée
- **État** : analyse écrite ; réglage disponible mais **non activé** ; **à confirmer** avec le comptable.
- **Ce que dit le BOFiP** (BOI-BIC-DECLA-10-10-20, § 90, lu en extrait) : les entrepreneurs du bâtiment qui fournissent, en plus de la main-d'œuvre, les **matériaux ou matières premières principaux** exercent une **activité mixte** : plafond micro global de 203 100 € dont 83 600 € au plus de prestations ; franchise de TVA si le CA global ne dépasse pas 85 000 € et la part prestations 37 500 €.
- **Ce qui reste à trancher** : (1) un climatiseur fourni et posé est-il un « matériau principal » au sens du texte ? (2) la part « matériel » se déclare-t-elle à l'URSSAF en ventes (12,3 %) ? (3) comment la ventiler facture par facture.
- **Dans l'appli** : par défaut, tout reste compté en prestations (provision la plus prudente, plafonds les plus bas). Le profil permet de choisir « mixte » et une part de ventes ; ce n'est utilisé que si Gabriel le choisit. Le simulateur l'explique.

### 4.5 Logiciel de caisse (bascule vers la TVA)
- **État** : avertissement implémenté ; testé localement ; **à confirmer** avec le comptable.
- **Analyse** (BOI-TVA-DECLA-30-10-30, lu en extrait) : l'obligation d'utiliser un logiciel ou système de caisse **certifié** (art. 286, I-3° bis du CGI) vise les assujettis à la TVA qui enregistrent les règlements de clients particuliers ; les entreprises en **franchise en base** (293 B) en sont **exclues**. ClimPilot enregistre des encaissements et n'est pas certifié.
- **Correction** : avertissement dans la carte « Bascule de régime » et dans la confirmation « Basculer maintenant ». Rien n'est bloqué.

### Tests exécutés pour l'étape 4 (02/10/2026)
- **Suite K** (`tests/suiteK-fiscal.mjs`) : **32/32** — taux selon le profil (défaut, ACRE 25 % et 50 %, fin d'ACRE avec les exemples de l'URSSAF, sans VL, non artisan, manuel, mixte) ; même taux sur devis, intervention, devis v2, tableau de bord, Paramètres, Statut & régime ; provision au taux de chaque date ; plafonds 2025/2026 ; franchise (création, suivante, courante, assujetti) ; CA réel (facture, encaissement, avoir) ; cartes « Seuils » ; avertissement logiciel de caisse ; profil synchronisé.
- **Régression** : A 14/14, B 54/54, C 17/17, D 18/18, E 19/19, F 9/9, G 10/10, H 33/33, I 24/24, J 50/50.
- **Non vérifié** : les taux utilisés par la fonction serveur `assistant` (texte de son prompt) n'ont pas été relus dans cette étape.

---

## Étape 3 bis — Renforcements demandés le 02/10/2026 (particuliers, sauvegarde)

### 3.6 Dépannage chez un particulier : contrôle **avant** le démarrage des travaux
- **État** : implémenté ; testé localement (suite J).
- **Problème** (après l'étape 3) : à l'ouverture, seul un bandeau rouge rappelait le contrat ; le contrôle bloquant n'arrivait qu'à la facturation, donc après les travaux.
- **Correction** (`next-particuliers.js`) : dès qu'une intervention chez un particulier a un client et n'a ni contrat signé ni facture, une **fenêtre bloquante** s'ouvre (à l'ouverture et à l'enregistrement) : imprimer le contrat à faire signer, enregistrer le contrat signé (date + preuve), préciser le lieu / l'urgence, revenir à la liste sans commencer, ou **reporter avec un motif obligatoire**, conservé sur l'intervention et affiché dans le bandeau. Quitter l'écran ferme la fenêtre ; elle revient à l'ouverture suivante tant que rien n'est fait. La facturation garde son contrôle (second filet).
- **Limite** : l'appli ne peut pas empêcher physiquement de commencer un chantier ; elle rend l'oubli impossible sans une décision écrite et tracée.

### 3.7 Remise de l'exemplaire et de ses annexes
- **État** : implémenté ; testé localement (suite J, test de la page de signature).
- **Papier** : la remise est **déclarée** dans une fenêtre (date, pièces remises : contrat ou devis signé, formulaire de rétractation, conditions et annexes) et n'est enregistrée que si l'accusé de remise **signé par le client** est coché ; avertissement si le formulaire de rétractation manque (art. L221-9 et L221-20). Affichage : « déclarée remise le … (pièces) — accusé papier à conserver ». Bouton aussi sur l'intervention dès que le contrat est signé.
- **Électronique** : seul le téléchargement **enregistré par le serveur** est affiché comme remise ; le fichier téléchargé indique les annexes qu'il contient (information et formulaire de rétractation).
- Sans l'un ou l'autre : « Exemplaire client : **non confirmé** ». Une tâche ou une invitation n'est jamais présentée comme une remise.

### 3.8 Sauvegarde des données avant la 1.10
- **État** : implémenté ; testé localement (suite L).
- Au premier lancement de la 1.10 sur un appareil : **copie locale automatique** (« Avant ClimPilot 1.10 », dans l'historique de l'appli) et carte sur le tableau de bord invitant à **télécharger une sauvegarde complète** (fichier JSON, fonction existante `exportJSON`), affichée tant qu'aucune sauvegarde n'a été téléchargée depuis.
- Côté serveur : sauvegarde à vérifier par Gabriel dans le tableau de bord Supabase (Database › Backups) ou par `pg_dump` — **condition de déploiement** (je n'ai ni lu ni copié les données).

---

## Étape 5 — Documents et sécurité (C9, C10, C11, C13, C14, C16, C17, C18, C20, C22)

Nouvelle couche `next-documents.js` ; retouches ciblées dans `index.html` (Paramètres, pieds de page, validité, nature, factures à 0 €), `next-einvoice.js`, `next-avoir.js`, `next-devis2.js`, `next-statut.js`, `next-particuliers.js`, `signer.html`.

Textes relus (Légifrance, 02/10/2026) :
- Code de commerce, art. R526-27 (dénomination « EI ») : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045697814
- Code de l'artisanat, art. L132-1 (assurance sur chaque devis et facture quand elle est obligatoire ; assureur ; couverture géographique ; reprend l'art. 22-2 de la loi 96-603) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047362294
- Code de la consommation, art. L616-1 et R616-1 (coordonnées du médiateur) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032224762 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032808378

### 5.1 Dénomination « EI » (C9)
- **État** : implémenté ; testé localement.
- **Correction** : `nxDenomination(E)` — pour un entrepreneur individuel (statut micro / EI / vide), dénomination suivie de « EI », avec le **nom de l'entrepreneur** ajouté s'il n'y figure pas (nouveau champ Paramètres « Nom et prénom de l'entrepreneur ») ; rien pour une société. Appliquée à l'en-tête et au pied de **tous** les documents (`docTop`/`docLegal`), au nom du vendeur dans le **XML**, au contrat d'intervention.
- **À confirmer** : la dénomination exacte déclarée au registre.

### 5.2 Assurance et médiateur selon les travaux et le client (C10)
- **État** : implémenté ; testé localement.
- **Règle appliquée** (pas seulement « SIRET présent ») :
  - **assurance** : exigée pour les devis et factures de **travaux de pose** (lots autres que dépannage, entretien, mise en service ; ancien devis selon son type), sauf si Gabriel indique que la décennale n'est pas obligatoire ; assureur + n° et couverture géographique ;
  - **médiateur** : exigé sur le **devis** d'un client **particulier** ;
  - **mode réel** : facture non émise / devis non envoyé pour signature tant que la mention manque ; **démonstration** : document de TEST émis avec un avertissement.
- **À confirmer** : l'obligation de décennale pour chaque type de pose (avec l'assureur) ; le médiateur auquel Gabriel adhère (il ne doit pas en indiquer un autre).

### 5.3 Pieds de page et validité (C11, C14)
- **État** : implémenté ; testé localement.
- **Correction** : nouveau « pied de facture et d'avoir » ; le pied de devis (« Devis gratuit… prix indicatifs ») n'est plus imprimé sur les factures ni les avoirs. Une seule durée de validité (Paramètres « Validité du devis ») : une durée différente écrite dans la note de bas de devis est alignée, et les mails l'utilisent. Le texte par défaut ne contient plus « valable 30 jours ».

### 5.4 Nature de l'opération (C13)
- **État** : implémenté ; testé localement ; **à confirmer** avec le comptable.
- **Correction** : réglage « Nature des chantiers fourniture + pose et dépannages avec pièces » : **S** / **M** / **à confirmer** (défaut). Tant que c'est à confirmer, les documents de démonstration utilisent **S** (prestation de services, comme les travaux immobiliers) sur le PDF **et** dans le XML ; en **mode réel**, une telle facture n'est pas émise tant que S ou M n'est pas choisi (la nature est figée à l'émission).

### 5.5 Factures à 0 € (C16)
- **État** : implémenté ; testé localement. Location sans montant, contrat sans prix et intervention à 0 € : aucune facture, aucun numéro.

### 5.6 Mention de franchise selon la date du document (C17)
- **État** : implémenté (étapes 1-2) ; testé localement (suite L, horloge en 2027) : une facture de 2026 réimprimée en 2027 garde « 293 B » et est marquée reconstituée.

### 5.7 RGPD (C18)
- **État** : implémenté (textes) ; **à confirmer** (durées, destinataires).
- Paragraphe « Données personnelles » sur chaque **devis** et sur la **page de signature** (responsable, données, finalité, hébergement UE, durées, droits, CNIL). Brouillon de registre : `docs/RGPD-registre.md` (gestion clients/factures, signature, assistant de dictée — fournisseur Anthropic, transferts hors UE probables à vérifier —, sauvegardes).

### 5.8 Signature électronique simple (C20)
- **État** : documenté ; aucun changement de code. La signature en ligne reste une signature électronique **simple** (valable, sans présomption de fiabilité). Les preuves conservées (horodatage serveur, empreinte, IP, navigateur, consentements, téléchargement de l'exemplaire) aident en cas de litige. Recommandation **à décider** : pour les gros montants, envoyer aussi au client un e-mail de confirmation avec le PDF signé.

### 5.9 Sécurité du compte (C22)
- **État** : vérifié en lecture seule ; **à faire par Gabriel**.
- Conseils de sécurité Supabase lus le 02/10/2026 : un seul avertissement, « Leaked Password Protection Disabled » (protection contre les mots de passe divulgués désactivée). Procédure : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- À faire dans le tableau de bord Supabase : activer la protection des mots de passe divulgués ; activer la double authentification du compte Supabase et, si possible, du compte ClimPilot ; utiliser un mot de passe propre à ClimPilot.

### Tests exécutés pour les étapes 3 bis et 5 (02/10/2026)
- **Suite L** (`tests/suiteL-documents.mjs`) : **25/25** — « EI » (règle, facture, XML, avoir) ; pied de facture et validité unique ; nature S par défaut et M sur réglage (PDF et XML identiques) ; pose détectée selon les lots ; démonstration : document de TEST avec avertissement ; factures à 0 € refusées ; RGPD sur le devis ; médiateur pour un particulier ; nouveaux champs des Paramètres ; sauvegarde au premier lancement ; mode réel : nature à confirmer et assurance manquante bloquent avant toute demande de numéro, devis sans médiateur non envoyé ; en 2027, réimpression d'une facture de 2026 avec sa mention d'origine.
- **Suite J** : **56/56** (dont la fenêtre « avant de commencer », le report tracé, la remise papier déclarée avec ses pièces, les annexes du fichier téléchargé).
- **Défaut trouvé et corrigé par ces tests** : la réimpression d'une ancienne facture reprenait la date du jour pour choisir la mention de franchise (C17) ; la date du document est maintenant gardée pendant toute l'impression.
- **Jeux de données des suites H, I, J (mode réel)** : ils renseignent désormais la nature et l'assurance, faute de quoi la 1.10 refuse la facture.
- **Régression** : voir la section « Livraison ».

---

## Livraison — état de chaque point, points à confirmer, conditions de déploiement

### Tableau d'état (02/10/2026)
Légende : **I** implémenté · **TL** testé localement · **TS** testé sur le service concerné · **AC** à confirmer.

| Point | Sujet | État | Preuve |
|---|---|---|---|
| C7, C8 | Numéro + facture enregistrés ensemble côté serveur, même demande = même facture, pas de facture hors ligne, document figé | I, TL (PostgreSQL 16 + navigateur) ; **TS non fait** (Supabase de test) | SQL 14/14, suite I |
| — | Synchronisation : rien de perdu, doublons gardés et envoi bloqué, deux onglets, ancienne version, restauration | I, TL | suites I, D |
| — | Sauvegarde des données avant la 1.10 (copie locale + invitation au téléchargement) | I, TL ; sauvegarde serveur **à faire par Gabriel** | suite L |
| C1 | Facture payée le jour même (BR-FR-CO-09) | I, TL (XSD + CEN + BR-FR) ; **TS non fait** (SUPER PDP) | suite F, matrice 11 XML |
| C12 | Garde-fous d'envoi SUPER PDP | I, TL (plateforme simulée) ; AC (doublons côté SUPER PDP) | suite H |
| C19 | Date de prestation (BT-72) | I, TL ; avertissement R008 restant pour les chantiers | suite F |
| C2, C3 | Mode de conclusion ≠ urgence, date réelle + preuve, « à préciser » bloquant, 7 jours (J+8) sur tous les parcours, paiement irrégulier tracé | I, TL ; AC (calcul J+8, caution) | suite J |
| C15 | Contrat de dépannage **avant** les travaux (fenêtre bloquante, report tracé) | I, TL ; AC (formulations par défaut) | suite J |
| — | Remise de l'exemplaire et des annexes (papier déclaré avec accusé ; électronique enregistré par le serveur ; preuve non inscriptible par le compte, ni à la création du lien depuis le 03/10) | I, TL ; fonction `signature` **non déployée** | suite J, test de la fonction 10/10, SQL |
| C4 | Taux unique daté et sourcé, profil fiscal, hypothèses | I, TL ; AC (ACRE, VL, CMA, CFE) | suite K |
| C5, C6 | Plafond micro, compteur de franchise | I, TL | suite K |
| C21 | Activité mixte | analyse ; AC (comptable) | — |
| — | Logiciel de caisse (bascule TVA) | avertissement I, TL ; AC | suite K |
| C9 | « EI » | I, TL ; AC (dénomination déclarée) | suite L |
| C10 | Assurance / médiateur selon les travaux et le client | I, TL ; AC (décennale, médiateur) | suite L |
| C11, C14 | Pied de facture distinct, validité unique | I, TL | suite L |
| C13 | Nature S/M, choix exigé en mode réel | I, TL ; AC (comptable) | suite L |
| C16 | Factures à 0 € | I, TL | suite L |
| C17 | Mention de franchise selon la date du document | I, TL | suites F, L |
| C18 | RGPD (devis, page de signature, registre) | I ; AC (durées, destinataires) | suite L |
| C20 | Signature simple | documenté ; AC (e-mail de confirmation) | — |
| C22 | Mots de passe divulgués, double authentification | lu ; **à faire par Gabriel** | conseils Supabase |

### Points à confirmer (par Gabriel, son comptable, son assureur ou un tiers)
1. Calcul du délai de 7 jours (J+8 retenu, prudent) ; chèque de caution de location = « contrepartie » ?
2. Point de départ des 14 jours de rétractation pour un chantier avec fourniture de matériel ; formulaire comparé mot à mot à l'annexe R221-1.
3. Formulations du contrat d'intervention (décompte du temps, validité de l'offre).
4. Profil fiscal : date de début, ACRE (éligibilité et demande dans les 60 jours), versement libératoire, inscription au registre des métiers, taxe CMA, CFE.
5. Activité mixte (matériel fourni et posé) et nature S/M des factures — avec le comptable.
6. Assurance décennale selon les travaux (assureur) ; médiateur auquel tu adhères.
7. Dénomination exacte déclarée (« … EI »).
8. Durées de conservation et destinataires (registre RGPD) ; transferts hors UE de l'assistant.
9. Traitement des doublons par SUPER PDP ; anciennes factures (avant 1.10) envoyées ou non à la plateforme.
10. Valeur de preuve du téléchargement de l'exemplaire ; e-mail de confirmation pour les gros montants.

### Ordre de déploiement envisagé — à confirmer sur un projet Supabase de test
**Rien de cette liste n'est à faire maintenant ; aucune action n'a été faite en production.** Cet ordre est
une hypothèse de travail, à confirmer sur un projet de test **avec les versions correspondantes**. Il remplace
la liste du 02/10, qui se contredisait : elle plaçait la migration avant la publication de l'appli.

0. **Sauvegardes** : une sauvegarde complète (JSON) depuis **chaque** appareil, et une sauvegarde serveur
   récente vérifiée (tableau de bord Supabase › Database › Backups, ou `pg_dump`).
1. **Projet Supabase de test** : y reproduire chaque étape ci-dessous et vérifier, pour chaque couple de versions :
   - **synchronisation** :
     - appli 1.10 / serveur non migré (repli sans `p_client_version`) ;
     - appli 1.10 / serveur migré ;
     - appli 1.9.x / serveur migré (doit être refusée : observer le message affiché et vérifier que les données restent sur l'appareil) ;
     - deux appareils de versions différentes ;
   - **facturation** :
     - 1.10 sans migration → « Facture NON émise », la facture reste en brouillon ;
     - 1.10 avec migration → numéro donné par le serveur, coupure réseau, double clic, avoir ;
   - **signature** : `lire`, `signer`, `refuser` et `copie`, avec la page 1.10 face à la fonction v3, puis face à la fonction 1.10 avant et après la migration ;
   - **mise à jour des appareils** :
     - nouveau cache du service worker (`climpilot-next-154-fusion-192`) ;
     - anciens onglets ouverts ;
     - iPhone avec l'appli installée sur l'écran d'accueil ;
   - **assistant et superpdp** : sans `ALLOWED_USER_IDS`, refus 503 ; avec la variable, accès comme aujourd'hui.
2. **Publier l'appli** : fusion de la branche dans `main` (GitHub Pages), décision et geste de Gabriel.
3. **Mettre à jour tous les appareils** (version 1.10 affichée) et fermer les anciens onglets.
4. **Appliquer la migration** `supabase/migrations/20261002120000_documents_emis.sql` sur le projet réel, avec l'accord de Gabriel.
5. **Déployer la fonction `signature` 1.10**.
   - Pour `assistant` et `superpdp`, **si** les versions préparées doivent être déployées : poser d'abord le secret `ALLOWED_USER_IDS`, puis déployer.
6. **Activer la protection des mots de passe divulgués et la double authentification**, et trancher les points « à confirmer » (au minimum : nature S/M, assurance, médiateur, profil fiscal).

**Pourquoi cet ordre (appli → migration → fonction)** : l'ordre inverse, migration d'abord, couperait la
synchronisation des appareils encore en version inférieure à 1.10.

À l'inverse, la 1.10 sait écrire son état sur un serveur pas encore migré : `cpStatePushRpc` (`next-emission.js`) se replie sur l'ancien appel, testé par la suite I. **Ce repli ne démontre la compatibilité que pour cet appel**, pas pour toute l'appli. Le reste se vérifie au point 1.

#### Ce qui est temporairement indisponible
Ce tableau est tiré de la lecture du code ; il est à confirmer au point 1.

| Période | Effet | Origine dans le code |
|---|---|---|
| Entre 2 et 4 (appli 1.10, serveur non migré) | **Facturation réelle bloquée**. Avec SIRET et cloud, l'appli passe en mode « bloqué » : la facture n'est pas émise et reste en brouillon. Sans SIRET, c'est le mode démonstration (série TEST). | `next-emission.js` : `cp_serveur_info` absente → raison « migration » → `mode()` = `bloque` |
| Entre 2 et 4 | La synchronisation fonctionne, par le repli. | `cpStatePushRpc` |
| Entre 2 et 5 (page 1.10, fonction v3) | **Signature** : l'accord « support durable » n'est pas enregistré. Le client peut télécharger son exemplaire, mais la remise n'est **pas** enregistrée (un message le lui dit). La phrase « commencement anticipé » reste celle de la v3. | `signer.html` (action `copie` refusée par la v3 → téléchargement local) ; fonction v3 |
| Après 4, appareil encore en version < 1.10 | **Synchronisation refusée** : `cp_state_push` exige `p_client_version` ≥ 1.10 et l'écriture directe est retirée. Ce qui est saisi sur cet appareil n'atteint plus le serveur tant qu'il n'est pas mis à jour. | migration, § 5 |
| Entre 4 et 5 | La fonction v3 fonctionne sur la base migrée : elle n'écrit aucune nouvelle colonne. L'accord « support durable » et la remise ne sont toujours pas enregistrés. | lecture de la v3 ; à confirmer |

→ Garder la fenêtre 2 → 4 **courte** (une même séance), à un moment où aucune facture n'est à émettre.

#### Retour arrière : possibilités et limites
- **Appli** : on peut revenir à la version précédente de `main` **tant que la migration n'est pas appliquée**. Après la migration, une appli antérieure à 1.10 ne synchronise plus : revenir en arrière sur l'appli seule n'est donc plus une solution.
- **Migration** : **il n'existe pas de script d'annulation**.
  - Revenir en arrière, c'est restaurer une sauvegarde du serveur, et donc **perdre tout ce qui a été écrit depuis** : état, factures émises, signatures.
  - Les numéros de facture déjà émis ne doivent **jamais** être réutilisés (continuité de la numérotation) : après une restauration, la numérotation doit repartir au-dessus du dernier numéro émis.
  - La migration est donc le **point de non-retour**.
- **Fonction `signature`** : la v3 reste redéployable (copie de lecture dans l'historique de `main`, commit `665161f`).
- **Fonctions `assistant` et `superpdp`** : on peut redéployer les versions actuelles.

### Livraison du 03/10/2026 — fusion de `main`, accès, isolation des tests
- **Fusion de `main` (`7deb191…`)**, sans réécriture d'historique. Quatre conflits ont été résolus :
  - version : la 1.10 garde son numéro ;
  - service worker : liste complète et nouveau cache ;
  - `tests/LISEZMOI.md` : les deux textes sont gardés ;
  - fonction `signature` : la copie v3 de `main` et la 1.10 ont été comparées **ligne à ligne**. La 1.10 reprend toute la logique de la v3. Seules différences : 3 champs de plus pour `lire`, l'action `copie`, l'accord « support durable » (avec repli si la colonne manque) et la phrase « commencement anticipé » complétée.
  - Les changements 1.5.1 de `main` (contrôles cumulables, arrondis au centime, contrat séparé) s'intègrent sans conflit. Toutes les suites ont été relancées après la fusion.
- **Schéma serveur** : `supabase/schema.sql`, venu de `main`, a été comparé à la base de test `tests/sql/01_base_actuelle.sql`, qui a été complétée (rétention des sauvegardes, déclencheur `cp_sig_insert`).
  - **Défaut trouvé** : ce déclencheur laissait le compte de l'entreprise créer un lien de signature avec l'accord « support durable » et la remise **déjà remplis**.
  - **Correction** : la migration remet ces trois colonnes à zéro à la création. Un test SQL le prouve ; il échouait avant la correction.
- **Accès aux fonctions `assistant` et `superpdp`** : l'identifiant de Gabriel n'est plus écrit dans le code.
  - Il servait de **contrôle d'accès** : liste blanche, après la vérification du JWT.
  - La liste est maintenant lue dans le secret serveur `ALLOWED_USER_IDS`. Si elle est absente, vide ou invalide, **tout le monde est refusé** (503). Le contrôle JWT et le refus 403 sont inchangés.
  - Voir `supabase/functions/assistant/.env.example` et le test `tests/functions/test-liste-blanche.mjs` (20 contrôles, sans réseau).
  - Les versions **déployées** gardent leur liste dans le code : il faut poser `ALLOWED_USER_IDS` **avant** de déployer les nouvelles.
  - **Limite** : l'identifiant reste visible dans l'historique public de `main`, et sur `main` tant que la branche n'y est pas fusionnée. L'historique n'a pas été réécrit.
- **Ce qui est secret et ce qui ne l'est pas** :
  - **identifiants**, qui ne donnent aucun accès mais sont des données personnelles : identifiant Supabase de Gabriel, référence du projet, identifiants Notion de `index.html` ;
  - **clés publiques**, faites pour être dans l'appli et protégées par les règles RLS : adresse du projet et clé `anon` (`SUPA_URL`, `SUPA_KEY`) ;
  - **secrets**, qui ne sont **jamais** dans le dépôt et dont aucun n'y a été trouvé : clé `service_role`, `ANTHROPIC_API_KEY`, identifiants SUPER PDP (coffre Vault), mot de passe de la base.
  - `.gitignore` exclut désormais les fichiers `.env*`, sauf les exemples sans valeur.
- **Tests portables et isolés** : `tests/run-all.sh` ; voir `tests/LISEZMOI.md`, qui donne l'installation, les versions, les variables et l'isolation réseau.

#### État des tests
| Catégorie | Contenu |
|---|---|
| **Testé localement (réel)** | Suites A à L dans Chromium sur le code de la branche ; migration sur PostgreSQL 16 local ; garde « base de test locale » ; fonctions `signature`, `assistant` et `superpdp` exécutées par Node ; XML validés par le XSD Factur-X, le schematron CEN 1.3.16 et les règles FNFE 1.4.0.04 ; aperçu ; autotest d'isolation. |
| **Simulé** | Serveur Supabase des suites H, I et J (mêmes règles que le SQL) ; authentification et base des fonctions ; plateforme SUPER PDP ; géocodage et itinéraires ; horloge 2027 ; coupures réseau. |
| **À valider sur le projet de test** | Migration sur PostgreSQL 17 Supabase ; règles RLS réelles ; fonctions sous Deno avec leurs secrets ; ordre de déploiement et indisponibilités ci-dessus ; mise à jour du service worker sur iPhone. |
| **Non exécuté** | SUPER PDP en bac à sable réel ; assistant avec une vraie clé API ; appareils réels ; impression PDF réelle. |

Résultats exacts : `tests/run-all.sh` écrit un rapport (`rapport.md`) avec le commit testé. Le rapport de la
copie propre du commit livré est remis **à part** : un commit ne peut pas contenir son propre identifiant.

#### Points relevés le 03/10 et corrigés le 04/10
1. **Presse-papiers** : une seule fonction `cpCopier()` (`index.html`) remplace les 4 appels. « Copié » ne s'affiche que si la copie a réellement eu lieu ; sinon « Copie impossible ». Un refus ne provoque plus d'erreur non interceptée. Testé par la suite M.
2. **Adresse de départ des calculs de distance** : elle n'est plus écrite dans le code public. Elle vit dans les données de Gabriel, synchronisées entre ses appareils par Supabase (`cpnext_home`). Elle est choisie ainsi :
   - point saisi à la main dans Paramètres › Point de départ des trajets : gardé tel quel ;
   - sinon, l'adresse de l'entreprise (Paramètres › Entreprise), géocodée **une fois**. Le point garde l'adresse qui a servi au calcul et il est **recalculé si l'adresse de l'entreprise change** (déménagement) ;
   - sinon, pas de calcul, avec le message « point de départ des trajets non réglé ».

   Pour Gabriel, rien à faire si l'adresse de l'entreprise est remplie. Elle reste dans l'**historique** Git public : seul un dépôt privé ou une réécriture de l'historique de `main` l'en retirerait, et c'est sa décision.
   Les identifiants Notion de `index.html` sont **gardés** : ils servent aux tarifs dans Cowork et ne sont pas des secrets. Les ville et code postal réels sont retirés des données de test.
3. **Registre des documents** : la recherche (n°, client, type, statut, date), les filtres (année, dont « Toutes les années », et type), le tri, les indicateurs, les contrôles de série et l'export portent sur **tous** les documents. Seul l'affichage est limité : 200 lignes, puis « Afficher plus ».
   Ouverture avec 1 500 devis : 240 à 440 ms (5 mesures), contre 374 à 835 ms avant. Le seuil de la suite B est inchangé.

#### Bloquant avant le passage en facturation réelle (non corrigé, décision de Gabriel)
`importerAnciens()` (`next-emission.js`) est appelée par `rapprocher()` au démarrage dès qu'il y a un **SIRET**, le cloud et un serveur migré. Elle importe **automatiquement** toutes les anciennes factures F- et AV- comme « reconstituées », dans le registre du serveur, où **rien ne se supprime**.

Or ce sont des factures **d'essai**, faites avant que l'entreprise existe.

À faire avant la migration en production : une décision explicite, du type « démarrer la facturation réelle à partir du … », avec le choix, facture par facture, de celles à importer et de celles à classer en essais. Le passage ne doit pas être automatique parce qu'un SIRET a été saisi.

### Reprise par Codex ou Cowork (voir aussi `docs/REPRISE.md`)
1. `git clone --branch claude/quirky-pasteur-ds9m47 https://github.com/gablry8/cp-gl2607`.
2. Installer les outils (`tests/LISEZMOI.md`, « Installation »), démarrer le banc PostgreSQL avec le marqueur, puis : `PGHOST=… PGPORT=… EN16931_XSLT=… BRFR_DIR=… tests/run-all.sh`.
3. Lire `rapport.md` : verdict, échecs, SKIP, non exécutés, isolation.
4. Règles :
   - ne pas modifier `main` ;
   - ne rien déployer ;
   - aucune action sur le projet Supabase réel ;
   - pas de poussée forcée ;
   - aucune donnée client ni secret dans le dépôt.
5. Prochaine étape utile : un **projet Supabase de test**, pour dérouler le point 1 de l'ordre envisagé.

### Aperçu isolé
Une copie de la branche est publiée en page privée claude.ai : mode démonstration, **aucune connexion au cloud** (la bibliothèque Supabase n'y est pas chargée), données fictives à charger par le bouton « Charger des exemples ». Les fenêtres de confirmation du navigateur étant désactivées dans une page publiée, un bandeau d'aperçu les remplace : chaque message ou question s'affiche et va dans un journal ; la réponse (Oui / Non) se règle dans le bandeau. Les données restent dans le navigateur de la personne qui ouvre la page.

Limites de l'aperçu, propres à une page publiée : l'impression (PDF des devis et factures) et les téléchargements (sauvegarde JSON, exports CSV, XML) n'y fonctionnent pas ; l'adresse de départ des calculs de distance est une adresse d'exemple ; la police IBM Plex est chargée depuis Google Fonts. Construction et test reproductibles : `tools/apercu/build.sh` puis `tools/apercu/test-apercu.mjs` (lancés par `tests/run-all.sh`). L'aperçu sert à parcourir les écrans et les contrôles (mode démonstration, série TEST, blocages « contrat avant travaux », mentions), pas à produire de vrais documents. Testé : ouverture sans erreur à 1280 px et 400 px de large, sans défilement horizontal, facture de démonstration TEST-F-2026-001, blocage d'un client particulier « à préciser ».
