# Batterie de tests ClimPilot (30/09/2026)

Tests automatiques (Playwright + Chromium) : écrans, boutons, devis de chaque nature, factures,
noms piégés, données abîmées, gros volume, stockage plein, hors réseau, fuseaux horaires,
calculs de dimensionnement, sauvegarde/restauration, brouillons, fiche fluide guidée.

Lancer : servir le dossier du site sur http://localhost:8765 (`python3 -m http.server 8765`),
puis `node tests/suiteA.mjs`, `node tests/suiteB.mjs`, `node tests/suiteC.mjs`.
Les chemins de Chromium/Playwright et de sortie sont ceux de l'environnement de Claude : à adapter.
Pas utilisé par l'application (fichiers ignorés par le service worker).
