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
