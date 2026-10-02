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
