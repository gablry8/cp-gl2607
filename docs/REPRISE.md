# ClimPilot — reprise du travail (Cowork ou Codex) — mise à jour du 08/10/2026

Ce fichier suffit pour reprendre le travail sans l'historique des conversations. Le détail est dans
`docs/CORRECTIONS-1.10.md` (ce qui a été fait et pourquoi) et `tests/LISEZMOI.md` (comment tester).

## Où en est-on (05/10/2026)
- Dépôt : https://github.com/gablry8/cp-gl2607 — branche de travail **`claude/quirky-pasteur-ds9m47`**.
- La version **1.10 n'est pas déployée**. La production, c'est `main` : site GitHub Pages et projet Supabase réel, inchangés.
  `main` est à `7deb19188de320c53f088224181bbc92b904b952` et la branche le contient.
- Fait sur la branche :
  - émission des factures côté serveur ;
  - facture électronique (XSD, CEN, BR-FR) ;
  - contrats avec les particuliers ;
  - fiscalité ;
  - documents et sécurité ;
  - listes blanches des fonctions serveur dans la configuration (`ALLOWED_USER_IDS`) ;
  - migration SQL préparée et testée sur PostgreSQL local ;
  - point de départ des trajets retiré du code ;
  - copie dans le presse-papiers fiable ;
  - registre des documents rapide, avec recherche ;
  - facturation réelle démarrée seulement par une décision explicite et datée, anciennes factures « essais » par défaut ; en production, envoi à la plateforme depuis le registre (relecture R1 à R4) ;
  - tests portables et isolés du réseau.
- Tests : `tests/run-all.sh`, environ 460 contrôles, hors réseau. Le dernier rapport complet est remis à part (SHA du commit testé).

## Règles (à respecter sans exception)
1. Travailler **uniquement** sur `claude/quirky-pasteur-ds9m47` (ou une branche dérivée). **Ne jamais** modifier `main`, ni pousser en force, ni réécrire l'historique.
2. **Aucun déploiement** : pas de fusion dans `main` (c'est ce qui publie sur GitHub Pages), pas de migration ni de fonction sur le projet Supabase **réel**. C'est la décision et le geste de Gabriel.
3. **Aucune donnée personnelle ni secret** dans le dépôt : il est **public**. Cela vaut pour les adresses, e-mails, téléphones, identifiants Supabase, IBAN, clés `service_role`, clés API et données clients. Avant chaque commit, chercher : `grep -rnE "eyJ|sk-ant|@gmail|IBAN|FR76" .`, ainsi que la ville et la rue réelles de Gabriel.
4. Tester avant de pousser (`tests/run-all.sh`) et signaler honnêtement : un test non exécuté ou en SKIP n'est **pas** réussi.

## Façon de travailler (demandée par Gabriel)
Confier les tâches simples à des sous-agents moins coûteux. La règle complète est dans `.claude/skills/deleguer-aux-agents/SKILL.md` :
- recherche dans le code → agent `climpilot-chercheur` (modèle haiku) ;
- modification mécanique précisément décrite → agent `climpilot-executant` (modèle sonnet) ;
- décisions, sécurité, droit et fiscalité, conflits, commit et push → session principale ;
- relire tout résultat d'agent avant de l'utiliser.

Dans Cowork, si les sous-agents ne sont pas disponibles, garder le même esprit : faire court, et ne pas relire de longs journaux (lire `rapport.md`).

## Tester
```bash
git clone --branch claude/quirky-pasteur-ds9m47 https://github.com/gablry8/cp-gl2607 && cd cp-gl2607
# outils : voir tests/LISEZMOI.md (Node 22, Playwright 1.56.1, Python 3.11, PostgreSQL 16, validateurs CEN et FNFE)
tests/run-all.sh          # puis lire $CP_TEST_OUT/rapport.md
```
Sans droit `unshare -n` (isolation réseau du noyau), lancer avec `CP_SANS_NETNS=1` : le rapport l'indiquera.

## EN PRODUCTION depuis le 08/10/2026 (accord explicite de Gabriel)
- Sauvegarde serveur avant mise en production : `climpilot_backups` id 13, raison `avant-mise-en-production-1.10` (20 devis, 15 clients).
- Appli **1.10.0** publiée : PR #1 fusionnée par Gabriel (`main` = `1c91cca`), vérifiée en ligne.
- Migration `20261002120000_documents_emis.sql` appliquée sur le projet réel. Gabriel l'a collée dans le SQL Editor, car `apply_migration` est annulé depuis la session. Vérifié : tables, 6 fonctions, colonnes de signature, écriture directe de l'état retirée, 0 document.
- Fonction `signature` v4 (1.10) déployée, `verify_jwt` = false.
- **Pas encore mises à jour** : `assistant` (v4) et `superpdp` (v1). Il faut d'abord que Gabriel pose `ALLOWED_USER_IDS` (et `ANTHROPIC_API_KEY` pour assistant) dans Edge Functions › Secrets.
- Facturation réelle **non démarrée** : mode démonstration, numéros TEST.
- Conseiller de sécurité Supabase :
  - fonctions SECURITY DEFINER appelables par `authenticated` : voulu, elles vérifient `auth.uid()` ;
  - « protection des mots de passe divulgués » désactivée : à voir par Gabriel.

## 1.11 « Objectifs & feux » — branche `claude/objectifs-feux` (11/10/2026, PAS en production)
Partie de `claude/quirky-pasteur-ds9m47` (= 1.10.0 en production). Côté appli seulement : **aucune migration ni fonction serveur**
(le serveur accepte toute clé de synchronisation, `cp_state_push` ne filtre pas).
- `next-objectifs.js` (menu Accueil › « Objectifs & feux ») : plan d'action du 09/10/2026 dans l'appli.
  - Objectif de CA HT mois par mois sur 36 mois, plancher (charges + paie + équipe, cotisations du profil fiscal) ; mêmes formules que `Plan_Objectifs_2027-2030.xlsx` (vérifié par la suite O).
  - « Mes 3 objectifs » : CA de l'année à date, contrats d'entretien (15 / 40 / 70), part du plus gros client (< 70 % puis < 50 %).
  - Feux : lancement (dont la règle ACRE selon la date de fermeture de l'ancienne EI, art. D131-6-1 CSS / circulaire CNAV 2026-12), société, apprenti (art. R6223-22), technicien. Règles de gestion proposées, sauf les règles légales citées.
  - « Combien coûte un salarié ? » : coût ESTIMÉ 2026, prix minimum, heures minimum, coût d'une augmentation.
  - « Pour la comptable » + « Mon suivi » : déclarations Urssaf (échéances officielles, autoentrepreneur.urssaf.fr) et envois à la comptable, cochés et datés ; contrôles avant envoi ; exports ; point du mois en PDF.
  - « À faire maintenant » + pastille du menu + ligne sur le tableau de bord.
  - Stockage : `cpnext_objectifs` (réglages) et `cpnext_objsuivi` (cases et relevés, liste à identifiants → fusion multi-appareils par élément).
- `next-regime.js` : facturier, livre des recettes, synthèse et mail = mêmes règles que le livre des recettes de l'appli (essais exclus, avoirs, factures annulées, remboursements) ; fichiers `DEMONSTRATION_…` tant que la facturation réelle n'a pas démarré.
- `next-addons.js` : libellé de version « Next 1.11.0 » (affichage seulement ; `CP_VERSION` envoyé au serveur reste 1.10.0). `sw.js` : `climpilot-next-1110-objectifs`.
- Relecture indépendante du 11/10 (8 points, tous corrigés et testés, suite O20) : 1re déclaration Urssaf = périodes avant le 90e jour
  regroupées avec la suivante (montant depuis le début) ; 90 jours comptés depuis la date de début du profil fiscal ; « à jour jusqu'au »
  = fin de la plus récente période cochée, tous rythmes confondus (pas de faux retards après un changement mois ↔ trimestre) ;
  bouton « C'est envoyé » dans le rappel ; migration de l'ancien format sans écrasement ; part du plus gros client sur 6 mois glissants.
- Performance : cache le temps d'un affichage (`avecCache`) + `nxrgLignesRecettes/Impayes(…, F)` réutilisent les factures déjà calculées.
- Tests : suite O (`tests/suiteO-objectifs.mjs`, 78 contrôles), dont gros volume (1 800 factures : écran < 1,5 s),
  synchro réelle entre deux appareils (O21 : vrai pushState/pullState/cpMerge sur un serveur commun simulé) et affichage téléphone
  du suivi (O13 : aucun débordement ; échouait avant la correction du 12/10 : 111 et 164 px).
- Essais faits par Claude le 12/10 sur la copie d'essai exacte (PC 1300 px et iPhone 13 simulés) : date d'EI 2026 → ACRE rouge,
  2025 → vert ; trésorerie ; case cochée ; début de plan passé → suivi + 3 rappels + pastille ; point du mois ; export DEMONSTRATION_.
- Batterie complète du 12/10 avec les validateurs CEN et FNFE : 534 réussis, 0 échec, 0 SKIP (SQL non exécuté : aucun changement SQL).
- À essayer par Gabriel sur la copie d'essai `ClimPilot-ESSAI-1.11.zip` (base de TEST) : menu Accueil › Objectifs & feux ;
  date de fermeture de l'EI ; trésorerie ; une case cochée sur le PC puis vue sur le téléphone ; point du mois (PDF) ; pastille du menu.
- Mise en production : fusion de cette branche dans `main` par Gabriel, puis mise à jour de chaque appareil (F5). Rien côté Supabase.

## 1.12 « Améliorations » — branche `claude/ameliorations-1.12` (12/10/2026, PAS en production)
Partie de `claude/objectifs-feux` (1.11, demande de fusion n°2) : elle CONTIENT la 1.11. Côté appli seulement : aucune migration
ni fonction serveur (nouvelles clés de synchronisation acceptées telles quelles par `cp_state_push`).
- `next-rentab.js` (carte d'Objectifs & feux) : main-d'œuvre facturée ÷ heures réelles (bloc « Réalité terrain » du devis +
  heures de SAV liées), comparée au taux du plan ; « tout compris / h » pour information ; retours SAV non facturés
  (`cpnext_sav`) : heures, km, pièces, motif, coût estimé, comparé à la provision SAV facturée.
- `next-avis.js` : demande d'avis Google après paiement (60 jours, une fois par client, `cpnext_avis`), mail ou SMS préparés,
  texte neutre ; lien dans Paramètres › Mon entreprise (`avisGoogle`, https seulement).
- `next-banque.js` : import du relevé bancaire CSV, lu sur l'appareil (ni enregistré ni envoyé). Crédits rapprochés des impayés
  du même montant au centime ; n° de facture COMPLET ou nom du client → « sûr ». Jamais coché d'office : montant déjà au livre
  des recettes à 7 jours près, période déjà déclarée / envoyée, particulier payé avant la fin du délai L221-10. Paiement par le
  même chemin que le bouton « Payée », à la date de la ligne (modifiable). Empreintes des lignes rapprochées (`cpnext_bqvus`).
  Colonne de montants sans aucun négatif → refus. Trésorerie : jamais d'écrasement d'une saisie plus récente.
- `next-flubilan.js` (écran Fluides) : déclaration annuelle à l'organisme agréé, 7 rubriques de l'arrêté du 21/11/2025 (art. 1er,
  5°), avant le 31/01 ; chargées / récupérées calculées depuis les fiches Cerfa, le reste saisi ; contrôle de cohérence du stock ;
  copie (« NON RENSEIGNÉ », jamais 0 par défaut), CSV, impression ; une case = un élément synchronisé (`cpnext_flubilan`) ;
  rappel dans « À faire » seulement si attestation de capacité ou fiches.
- Bouteilles dans le camion (`next-flubilan.js`, écran Fluides, `cpnext_adr`) : seuil ADR 1.1.3.6, kg de fluide inflammable
  (catégorie 2) × 3 + kg non inflammable / litres d'azote (catégorie 3) × 1 ≤ 1 000 points (OPPBTP « quantités limitées » ;
  FDS des fournisseurs, rubrique 14) ; rappel de ce qui reste obligatoire (extincteur 2 kg, formation ADR 1.3, arrimage).
- `next-objectifs.js` : extensions `nxobjAjouts`, conseils non bloquants dans « Lancer l'entreprise », attestation de capacité,
  coût du km dans « Mes réglages ». `index.html` : champ avisGoogle, chargement des 4 modules. `sw.js` : `climpilot-next-1120-ameliorations`.
- Relecture indépendante du 12/10 : 2 défauts bloquants (n° de facture trouvé dans une date ou une référence ; virement déjà
  marqué payé à la main qui payait une 2e facture) et 6 importants (débit lu comme crédit, période déjà déclarée, date des chèques
  et espèces, « 0 kg » pour une case vide, seuil du voyant, deux « €/h » contradictoires), plus 9 mineurs : tous corrigés et testés
  (suite P, partie P6b et suivantes ; les cas bloquants échouent sur le code d'avant correction).
- Tests : suite P (`tests/suiteP-ameliorations.mjs`, 128 contrôles), ajoutée à `tests/run-all.sh`.
- À essayer par Gabriel sur la copie d'essai `ClimPilot-ESSAI-1.12.zip` : Objectifs & feux (rentabilité, retour SAV, liste de
  lancement), Paramètres (lien d'avis), relevé bancaire (fichier CSV de sa banque, sur des factures d'essai), écran Fluides.
- Mise en production : fusion de cette branche (elle contient la 1.11) dans `main` par Gabriel, puis F5 sur chaque appareil.

## Ce qui reste à faire, dans l'ordre (plan du 08/10/2026)

Déjà fait : décision explicite de facturation réelle (R1, 05/10) ; projet Supabase de test, 52/52 ; essais de l'appli sur les appareils de Gabriel du 06 au 08/10, avec un bug trouvé et corrigé (voir `docs/ESSAIS-SUPABASE-TEST.md`) ; corrections issues de ces essais (messages Super PDP, décision annulable, confirmation pour un devis non accepté).

1. **Copie d'essai : revérifier les corrections du 08/10.**
   - Annuler la décision de facturation réelle : le refus est attendu, car des factures réelles existent sur la base de test.
   - Facturer un devis « brouillon » : une question doit être posée.
   - Message Super PDP sur la base de test : « service pas installé ».
   - iPhone, si disponible : écran d'accueil, mise à jour, impression.
2. **Fonctions `superpdp` et `assistant` sur le projet de test.**
   - Gabriel pose `ALLOWED_USER_IDS` (son identifiant de test) dans le tableau de bord.
   - Il saisit lui-même les identifiants **bac à sable** de Super PDP dans la copie d'essai.
   - Ensuite : une facture à un client professionnel fictif (SIREN de test), contrôlée puis déposée dans le bac à sable avec la 1.10, et les statuts relus.
3. **Points à confirmer par Gabriel**, avec sa comptable :
   - nature S ou M ;
   - part du matériel, en ventes ou en services ;
   - profil fiscal ;
   - attestation décennale (mentions d'assurance) ;
   - **adhésion à un médiateur de la consommation** : obligatoire avant le premier devis à un particulier.
4. **Sécurité avant la production** :
   - double authentification sur GitHub et sur Supabase ;
   - sauvegarde des données : export régulier, à définir ;
   - vérifier l'absence de secrets dans le dépôt public.
5. **Déploiement réel**, uniquement par Gabriel et avec son accord, dans l'ordre de `docs/CORRECTIONS-1.10.md` (« Ordre de déploiement envisagé ») :
   - migration sur le projet réel ;
   - fonctions ;
   - fusion dans `main` (GitHub Pages) ;
   - mise à jour de chaque appareil ;
   - vérification avec un faux document avant le vrai SIRET.
6. **Après la mise en service** : premières vraies factures suivies de près (registre, compteur, synchronisation), puis reprise des évolutions de ClimPilot.

## À savoir
- La branche `claude/brfr-controle-local` est un brouillon séparé (contrôle local des règles BR-FR), partie de `665161f` et **non fusionné**. La 1.10 couvre déjà les règles BR-FR (suite F). Comparer avant toute reprise de ce brouillon.
- Les identifiants Notion de `index.html` servent aux tarifs dans Cowork : ils ne sont pas secrets, ne pas les retirer.
- L'adresse de départ des trajets ne figure plus dans le code. Elle vient de l'appli (Paramètres) et reste synchronisée par Supabase.
