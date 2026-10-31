# Essais de la 1.10 sur un projet Supabase de test — 05/10/2026

**Projet utilisé** : « ClimPilot-TEST », un projet Supabase gratuit, séparé du projet réel et hébergé dans la même région (eu-west-1), avec PostgreSQL 17.

- Le **projet réel n'a pas été modifié**, ce qui a été vérifié après les essais (aucune table 1.10, aucune table d'essai).
- **Version testée** : branche `claude/quirky-pasteur-ds9m47`, commit `fbab38d`.
- **Migration** : celle du dépôt, plus le durcissement décrit plus bas.

## Comment les essais ont été faits
- Les modifications de base étaient refusées depuis la session Claude, et le réseau ne laissait pas joindre le projet. Gabriel a donc collé lui-même deux scripts dans le SQL Editor du projet de test :
  - `tests/supabase-test/1-structure-migration-essais.sql` ;
  - `tests/supabase-test/2-signature-de-bout-en-bout.sql` (la clé et l'adresse du projet y sont remplacées par des repères).
- Les résultats ont ensuite été relus par la session Claude, en lecture seule.
- Chaque script s'arrête de lui-même s'il est collé dans le projet réel. Ce verrou a été testé.
- La fonction `signature` 1.10 a été déployée **sur le projet de test seulement**. Elle y a été appelée par la base elle-même, avec l'extension `http`.

## Résultats : 52 réussis sur 52

| Phase | Ce qui est vérifié | Résultat |
|---|---|---|
| A — base 1.9 avant migration | l'appli 1.9 synchronise par `cp_state_push` à 3 paramètres ; l'écriture directe de l'état est possible (constat) | 2/2 |
| B — après migration (PostgreSQL 17 Supabase, rôles réels) | voir le détail ci-dessous | 34/34 |
| C — fonction `signature` 1.10 de bout en bout | voir le détail ci-dessous | 14/14 |

**Phase B — synchronisation**
- Une appli 1.9 est refusée avec le message « ClimPilot doit être mis à jour ».
- L'appli 1.10 est acceptée.
- Si la version envoyée est périmée, un conflit est renvoyé et rien n'est écrasé.
- L'écriture directe de l'état est refusée (42501).

**Phase B — numérotation**
- Les factures suivent la série F-AAAA-001, 002…, et les avoirs ont leur propre série AV.
- Une même demande rejouée renvoie la même facture, avec son contenu d'origine.
- Sont refusés : une date hors de la journée, un appel sans version, un type incohérent.
- Après l'import (choisi) d'une ancienne F-…-006, la facture suivante est 007.

**Phase B — registre figé**
- Les fichiers ne s'écrivent qu'une fois.
- Les paiements sont enregistrés une seule fois.
- Une insertion directe ou un TRUNCATE est refusé.
- Une facture ne peut être ni modifiée ni supprimée, même par l'administrateur, qui contourne pourtant RLS.
- Le compteur ne recule jamais, et le journal des événements fonctionne en ajout seul.

**Phase B — cloisonnement et signature**
- Un autre compte ne voit ni ne touche rien, et un visiteur anonyme ne peut rien faire.
- Lien de signature : la preuve de remise ne peut pas être inscrite d'avance ni falsifiée, mais l'annulation reste possible.

**Phase C — fonction `signature` 1.10**
- Lecture du document ; copie refusée tant qu'il n'est pas signé.
- Signature avec accord « support durable » et commencement anticipé. Le consentement est complet, et la base enregistre le statut, l'accord, l'horodatage et l'empreinte.
- Une deuxième signature est refusée.
- L'exemplaire du client est rendu (document, signature, consentement). Le premier téléchargement est daté, et le compteur passe à 2.
- ClimPilot est prévenu : une note « signé » et une seule note « téléchargé ».
- Refus avec motif.
- Les liens expirés (410), inconnus ou mal formés (404) sont refusés.

## Constat, corrigé dans la migration
Le conseiller de sécurité de Supabase signalait, sur le projet de test, des fonctions de déclencheur `SECURITY DEFINER` exécutables par `anon` et `authenticated` (`cp_sig_guard`, `cp_sig_insert`). En production, elles sont déjà réservées à `postgres` et `service_role`. La migration retire maintenant explicitement ce droit à `public`, `anon` et `authenticated` pour les cinq fonctions de déclencheur, par sécurité.
- Tests SQL locaux après ce changement : **28/28**.
- Script 1 rejoué en local : **36/36**.

## Essais de l'appli sur les appareils de Gabriel (06 au 08/10/2026)
Copie d'essai de la 1.10 (bandeau rouge « VERSION D'ESSAI », hébergée à part) branchée sur le projet de test, faux SIRET.
- Connexion et synchronisation avec le serveur migré : OK.
- Mode démonstration : facture TEST-F-2026-001 : OK.
- Passage en facturation réelle par décision explicite : OK. La facture est bloquée tant que la nature S/M n'est pas choisie (garde-fou voulu).
- Facture réelle : **F-2026-001** numérotée par le serveur, fichiers déposés : OK (vérifié dans `climpilot_documents` et `climpilot_seq`).
- Double clic : une seule **F-2026-002**, compteur à 2 : OK.
- Envoi d'un devis à un particulier sans médiateur renseigné : bloqué (garde-fou voulu).
- **Coupure réseau pendant la facturation d'un devis OUVERT à l'écran : bug trouvé.** Le serveur restait propre (aucun numéro consommé), mais le numéro interne `PROVISOIRE-…` de l'essai à blanc restait affiché sur le devis. Un clic sur « Enregistrer » l'aurait enregistré comme une vraie facture, ce qui aurait bloqué la facturation ensuite.
  - Cause : la couche `next-devis2.js` recopie la facture dans le devis ouvert pendant l'essai à blanc.
  - Corrigé : l'essai remet le devis ouvert dans son état d'avant. Un devis modifié à l'écran est enregistré avant l'essai à blanc, pas pendant (sinon la facture n'était pas émise).
  - Test ajouté (suite I, I3b), qui échouait avant la correction (4 échecs). Batterie complète après la correction : tout réussi.
- Après la correction : coupure réseau puis retour du réseau, F-2026-003 à 005 émises, suite continue, aucune trace de PROVISOIRE dans l'état synchronisé : OK.
- Synchronisation entre deux appareils (PC et téléphone) : un devis créé sur un appareil, puis facturé (F-2026-006), est retrouvé sur le serveur : OK.
- Signature en ligne d'un devis depuis le téléphone : statut « signé », horodatage et empreinte enregistrés, devis passé « accepté », note « signé » dans ClimPilot : OK. Le client d'essai n'a pas coché l'accord « support durable » et n'a pas téléchargé son exemplaire : en réel, il faut alors lui remettre un exemplaire papier (bouton « Exemplaire papier remis »).
- Une facture (F-2026-002) a pu être émise sur un devis encore au statut « brouillon ». **Corrigé** : confirmation demandée pour un devis non accepté (brouillon, envoyé, refusé…).
- Message « Serveur injoignable » trompeur quand la fonction `superpdp` n'est pas installée. **Corrigé** : messages distincts (service pas installé, pas de réseau, erreur HTTP), avec une mention spéciale pour un document de démonstration.
- Décision de facturation réelle définitive même sans aucune facture. **Corrigé** : elle s'annule avant la date de début, ou après si aucune facture réelle n'existe (vérifié sur l'appareil et sur le serveur). Les anciennes factures renommées ESSAI-… reprennent leur numéro.

## Lecture de la base de test le 14/10/2026 (lecture seule)
- Base de prix synchronisée : **84 lignes pour 28 articles** (3 copies), créées par les appareils et navigateurs successifs.
  Cause : identifiant tiré au hasard pour les articles de départ. Corrigé en 1.12 (recette du 14/10) : la base est remise en
  ordre automatiquement à la prochaine ouverture de la copie d'essai. La base réelle n'a pas de doublon (56 lignes, 0 doublon).

## Recette « deux appareils » simulée (14/10/2026, sans le PC de Gabriel)
Un PC et un iPhone simulés sur un serveur commun qui suit les règles du vrai (suite Q, `tests/banc-appareils.mjs`). Le
réseau de la session ne joint pas Supabase : la synchro réelle avec la base de test reste à refaire par Gabriel. 20 défauts
trouvés et corrigés (liste dans `docs/REPRISE.md`, « Recette deux appareils »), dont, le soir : retour au même écran après
une mise à jour reçue, texte tapé jamais effacé par une mise à jour, PC resté ouvert mis à jour sans y toucher, et une
perte de données qui existait déjà (modification faite pendant un envoi).

## Audit de fiabilité du 18/10/2026 — constats et corrections (branche `claude/fiabilite-19-10`, non déployée)
Audit en lecture seule du code de `main` et du projet réel (métadonnées seulement, aucune donnée client lue).
Chaque correction a d'abord un test qui échoue sur l'ancien code (suite R), puis la batterie complète.

**1. Boîte de réception (`next-assistant.js`)**
- Constat : une seule requête prenait les 200 lignes les **plus anciennes** (à valider et traitées de la semaine mêlées).
  Avec 500 lignes (300 traitées, 200 à valider), l'ancien code n'affichait **aucune** des nouvelles demandes, badge à 0.
  Une ligne du site (`source='site'`) n'affichait pas `payload.champs` et n'avait pas de bouton « Traité ». Une ligne
  dont `a_verifier` n'est pas une liste faisait planter toute la liste.
- Correction : trois lectures (à valider : 100 plus récentes + nombre exact pour le badge ; « auto » à importer ;
  traités : 25 derniers), carte dédiée aux demandes du site (champs avec libellés, « À rappeler avant le … » en
  rouge si dépassé, « ACTIVITÉ BLOQUÉE », liens `tel:` et `mailto:` à schéma fixe et valeur encodée, « Traité »,
  « Écarter », « Copier »), garde `Array.isArray`. Tout le texte du visiteur est échappé.
- Tests : suite R (R1, 17 contrôles), dont un texte piégé (`" onmouseover=…`, `<img onerror>`, `javascript:`) : affiché
  tel quel, rien d'exécuté. Échouait sur l'ancien code (15 échecs sur 17).
- Batterie complète : 501 réussis, 0 échec, 0 SKIP (le message du commit indique 484 : le rapport ne comptait pas
  encore la suite R, corrigé dans `tests/isolation/rapport.mjs`).

**2. Encaissement annulé (`index.html`, `next-emission.js`, `next-particuliers.js`, `next-avoir.js`)**
- Constat : « Annuler » sur la question du mode de règlement enregistrait quand même l'encaissement (« Virement »),
  sans moyen de l'annuler pour un devis, une location ou un contrat. En mode réel, un « paiement » partait aussi au
  journal du serveur, même sans encaissement (et un second clic en envoyait un deuxième).
- Correction : `askMode()` renvoie `null` sur « Annuler » et rien n'est enregistré (factures, interventions,
  remboursement d'avoir) ; bouton ↺ « Annuler l'encaissement » (devis, location, contrat) qui remet la facture
  « en attente » et garde une trace (`encaissementsAnnules` : date payée, mode, date d'annulation) ; pour une
  intervention, la bascule existante garde la même trace. Le journal du serveur ne reçoit `paiement` /
  `paiement_annule` que si l'encaissement a vraiment changé. Un paiement « irrégulier » n'est plus marqué si rien
  n'a été encaissé.
- Tests : suite R (R2 + R2b, 10 contrôles), échouaient sur l'ancien code (8 échecs). Batterie complète : 511 réussis,
  0 échec, 0 SKIP.

**3. Sauvegarde hors Supabase (`next-assistant.js`, `next-fiabilite.js`, `index.html`)**
- Constat : l'appli annonçait « une copie de secours part aussi chaque semaine sur ton Google Drive ». Sur le Drive,
  un seul fichier (28/09, 44 Ko) alors que l'état pèse 215 Ko : la copie par la tâche planifiée ne marche pas (le JSON
  devrait être recopié mot pour mot). Le rappel « sauvegarde jamais faite » était masqué dès que le cloud est connecté.
  `climpilot_backups` ne copie que l'état, dans le même projet Supabase, sans le registre des factures ni les signatures ;
  l'offre gratuite ne permet pas de télécharger les sauvegardes de la base.
- Correction : texte honnête (copies du serveur « dans Supabase ») ; bouton **Export complet** : un fichier JSON daté
  `ClimPilot_export_complet_AAAA-MM-JJ.json` = état de l'appareil + `climpilot_documents` + `climpilot_doc_events` +
  `climpilot_signatures`, lus page par page (100 ou 1 000 lignes par page, tri sur la clé primaire). Si une table
  échoue, le fichier est quand même donné, marqué `complet:false`, et l'export n'est pas compté. Le fichier se relit
  avec « Importer » (partie `etat`). Ligne « Dernière copie hors Supabase : … » et rappel discret dans le bandeau du
  tableau de bord au-delà de 7 jours.
- Clé **synchronisée** `cpnext_dernier_export` (dans `climpilot_state.data`, lisible par une tâche planifiée) :
  `{ "at": "<ISO du dernier export COMPLET>", "octets": <taille du fichier>, "comptes": {"documents":n,"evenements":n,"signatures":n},
  "incomplet": {"at":"<ISO>","erreurs":n} }` (`incomplet` seulement après un essai raté ; il ne change pas `at`).
  Lecture SQL : `select data->'cpnext_dernier_export'->>'at' from public.climpilot_state;`
- Tests : suite R (R3, 10 contrôles, dont 1 205 événements sur 2 pages et une table en erreur). Batterie complète :
  521 réussis, 0 échec, 0 SKIP. La tâche planifiée Drive n'a pas été modifiée.

**4. Émission : réponse perdue et autre appareil (`next-emission.js`, partie appli seulement, aucun changement SQL)**
- Constat : après 25 s sans réponse (ou une coupure pendant l'envoi), l'appli affichait « Facture NON émise… Rien n'a
  été facturé », alors que le serveur avait peut-être enregistré la facture. La demande en attente ne vit que sur
  l'appareil : refacturer depuis un autre appareil donnait un second numéro pour le même devis (reproduit par le test :
  F-2026-003 émise alors que F-2026-002 existait déjà pour ce devis).
- Correction : message « Résultat INCONNU… réessaie depuis CET appareil (même demande, sans doublon), pas depuis un autre
  appareil » ; avant toute émission en mode réel, lecture de `climpilot_documents` (filtre `payload->src`) : une facture
  déjà émise pour la même source (devis + acompte/solde, intervention, location, année de contrat) est reprise et remise
  en place, sans nouveau numéro. Exceptions : la demande en attente de CET appareil (même request_id) et une facture
  annulée par un avoir total (`facAnnulees`). Registre illisible : rien n'est émis (« NON émise »).
- Limite : la vérification se fait côté appli ; deux appareils qui émettent à la même seconde pour le même devis ne
  sont pas arrêtés par le serveur (il faudrait une règle SQL, non faite ici).
- Tests : suite R (R4, 5 contrôles), 3 échecs sur l'ancien code. Batterie complète : 526 réussis, 0 échec, 0 SKIP.

## Pas encore essayé
- **C1 — une seule facture vivante par source (21/10/2026, branche `correctif/c1-registre-illisible`)** : migration
  `supabase/migrations/20261021180000_une_facture_par_source.sql` (script `tests/supabase-test/4-une-facture-par-source-TEST.sql` à
  coller, verrou par marqueur, 5 « OK » ; retour arrière `4-une-facture-par-source-retour-arriere.sql`). Vérifiée hors ligne seulement :
  PostgreSQL 16 local (16 tests, dont 8 soldes simultanés) et banc deux appareils (16 contrôles). Lève la limite notée plus haut
  (« deux appareils qui émettent à la même seconde pour le même devis ne sont pas arrêtés par le serveur ») : le serveur refuse
  désormais une 2e facture vivante pour la même source, un solde qui ignore l'acompte, un acompte après le solde.
- **Agenda (20/10/2026)** : migration `20261020120000_agenda.sql` (script `essai-agenda-TEST.sql` à coller), fonction
  `agenda`, script Google Agenda. Vérifié hors ligne seulement : PGlite (droits, remplacement, garde-fous), fonction et
  script avec base et Google simulés. Le 20/10, la base de test ne contient aucune table `climpilot_busy`.
- **Fonctions `superpdp` et `assistant`** sur le projet de test. Il faut que Gabriel pose la configuration `ALLOWED_USER_IDS` et `ANTHROPIC_API_KEY` dans le tableau de bord, car la session ne peut pas le faire. En attendant, leur comportement est couvert par les tests locaux (`fn-liste-blanche`, `fn-superpdp-envoi`).
- Avec la copie d'essai : iPhone (écran d'accueil, mise à jour, impression des PDF).
- **SUPER PDP** en bac à sable avec la 1.10.

## Nettoyage
Une petite fonction `essai-outil` (« ok ») est restée sur le projet de test : elle a servi à vérifier que le déploiement était possible. Le projet de test peut être supprimé ou mis en pause à tout moment depuis le tableau de bord. L'offre gratuite met de toute façon en pause un projet inactif.
