# Batterie de tests ClimPilot (30/09/2026)

Tests automatiques (Playwright + Chromium) : écrans, boutons, devis de chaque nature, factures,
noms piégés, données abîmées, gros volume, stockage plein, hors réseau, fuseaux horaires,
calculs de dimensionnement, sauvegarde/restauration, brouillons, fiche fluide guidée.

Lancer : servir le dossier du site sur http://localhost:8765 (`python3 -m http.server 8765`),
puis `node tests/suiteA.mjs`, `node tests/suiteB.mjs`, `node tests/suiteC.mjs`.
Les chemins de Chromium/Playwright et de sortie sont ceux de l'environnement de Claude : à adapter.
Pas utilisé par l'application (fichiers ignorés par le service worker).

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
