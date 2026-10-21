# P0 — ce que Gabriel fait demain (10 lignes)

1. Lire `docs/P0-COMPTE-RENDU.md` (10 min) : § 1 synthèse, § 4 les 3 devis, § 5 suite Q, § 6 trouvailles.
2. **Vérifier les 3 devis à la main** (`tests/golden/calculs-lisible.md`) dans l'appli : Nouveau devis › mêmes valeurs → comparer HT / TVA / TTC / acompte / solde ligne par ligne. Un écart = me le dire avec la ligne.
3. Dire si le **taux dépannage 90 €/h** et les **cotisations 23,68 %** (profil vide) sont voulus ; sinon ce sont des paramètres à régler dans l'appli, pas du code.
4. Ouvrir l'onglet **Actions** de `refonte/p0-filet` sur GitHub : regarder le résumé et les deux Checks du dernier commit (« tests — batterie complète », « tests — suite Q »).
5. Si c'est vert (hors script Google) : fusionner `refonte/p0-filet` dans… **rien pour l'instant** — elle vient de `fusion/avant-refonte` ; l'ordre reste : M0 en production d'abord (fiche A), puis P0 fusionnée dans `main` après.
6. Activer la **protection de `main`** après la mise en production : Settings › Branches › `main` › Require status checks › **« tests — batterie complète (sans suite Q) »** (pas le Q).
7. Faire le **contrôle 5 bis** de la fiche M0 (acompte sur PC, solde sur téléphone hors ligne) sur la copie d'essai : c'est le seul point de la suite Q non expliqué.
8. Décider pour le **script Google** (bug du jour de changement d'heure) : correction d'une ligne, à mettre sur la branche agenda le jour où la partie B se fait.
9. Décider pour **R12** (« 2026 » en dur dans la suite E) : à corriger avant janvier, petite tâche Sonnet.
10. Donner ton feu vert pour **P1** (outillage) ou demander une relecture Opus (M3) de P0 d'abord — je recommande la relecture, P0 est le filet de tout le reste.
