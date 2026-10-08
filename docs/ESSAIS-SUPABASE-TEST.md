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
- À regarder : une facture (F-2026-002) a pu être émise sur un devis encore au statut « brouillon ».
- Message « Serveur injoignable » trompeur quand on envoie un document TEST- vers la plateforme alors que la fonction `superpdp` n'est pas installée : à améliorer.

## Pas encore essayé
- **Fonctions `superpdp` et `assistant`** sur le projet de test. Il faut que Gabriel pose la configuration `ALLOWED_USER_IDS` et `ANTHROPIC_API_KEY` dans le tableau de bord, car la session ne peut pas le faire. En attendant, leur comportement est couvert par les tests locaux (`fn-liste-blanche`, `fn-superpdp-envoi`).
- Avec la copie d'essai : iPhone (écran d'accueil, mise à jour, impression des PDF).
- **SUPER PDP** en bac à sable avec la 1.10.

## Nettoyage
Une petite fonction `essai-outil` (« ok ») est restée sur le projet de test : elle a servi à vérifier que le déploiement était possible. Le projet de test peut être supprimé ou mis en pause à tout moment depuis le tableau de bord. L'offre gratuite met de toute façon en pause un projet inactif.
