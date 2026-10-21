# P0 — ce que Gabriel fait demain (10 lignes)

1. Lire `docs/P0-COMPTE-RENDU.md` (10 min) : § 1 synthèse, § 4 les 3 devis, § 5 suite Q, § 6 trouvailles.
2. **Vérifier les 3 devis à la main** (`tests/golden/calculs-lisible.md`) dans l'appli : Nouveau devis › mêmes valeurs → comparer HT / TVA / TTC / acompte / solde ligne par ligne. Un écart = me le dire avec la ligne.
3. Dire si le **taux dépannage 90 €/h** et les **cotisations 23,68 %** (profil vide) sont voulus ; sinon ce sont des paramètres à régler dans l'appli, pas du code.
4. Ouvrir l'onglet **Actions** de `refonte/p0-filet` sur GitHub : regarder le résumé et le Check du dernier commit (travail « batterie complète » ; le check-run « rapport — batterie complète » n'est que le rapport lisible). *(Mis à jour le 21/10 après M3 : un seul travail, suite Q comprise.)*
5. Si c'est vert (hors script Google) : fusionner `refonte/p0-filet` dans… **rien pour l'instant** — elle vient de `fusion/avant-refonte` ; l'ordre reste : M0 en production d'abord (fiche A), puis P0 fusionnée dans `main` après.
6. Activer la **protection de `main`** après la mise en production : Settings › Branches › `main` › Require status checks › **« batterie complète »** (le travail, pas « rapport — batterie complète » qui est attaché au commit de fusion temporaire sur une demande de fusion — M3 C9.1).
7. Faire le **contrôle 5 bis** de la fiche M0 (acompte sur PC, solde sur téléphone **en ligne mais pas à jour** — protocole M3 C4, le mode avion est devenu le 5 ter) sur la copie d'essai. Le point « acompte » de la suite Q est expliqué depuis (M3 C5 : course dans le test, l'appli a raison) ; ce qui reste à éprouver sur un vrai appareil, c'est le cas à risque M3 C1 (registre illisible).
8. Décider pour le **script Google** (bug du jour de changement d'heure) : correction d'une ligne, à mettre sur la branche agenda le jour où la partie B se fait.
9. Décider pour **R12** (« 2026 » en dur dans la suite E) : à corriger avant janvier, petite tâche Sonnet.
10. Donner ton feu vert pour **P1** (outillage) ou demander une relecture Opus (M3) de P0 d'abord — je recommande la relecture, P0 est le filet de tout le reste.
