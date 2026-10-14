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
- Raccourcis (`next-raccourcis.js`, 13/10) : menu « Créer » (retour SAV), menu « Outils » (relevé, déclaration des fluides,
  bouteilles ADR), recherche Ctrl K (actions + écrans du menu, crochet `window.nxExtraSearch` dans `next-addons.js`),
  ouverture par l'adresse `index.html?ouvrir=…` et raccourcis de l'icône (`manifest.json` « shortcuts » ; pas sur iPhone).
- `next-objectifs.js` : extensions `nxobjAjouts`, conseils non bloquants dans « Lancer l'entreprise », attestation de capacité,
  coût du km dans « Mes réglages ». Conseils ajoutés le 13/10 : RGE QualiPAC (seulement pour la PAC air/eau aidée) et
  partenaire CEE (PAC air/air et meubles frigorifiques sans RGE) ; détail et sources dans la doc du projet
  `claude/rge-cee-fluides-lancement.md`.
- `index.html` : champ avisGoogle, chargement des 5 modules (rentab, avis, banque, flubilan, raccourcis).
  `sw.js` : `climpilot-next-1126-synchro-sure` (après la recette du 14/10 au soir).
- Relecture indépendante du 12/10 : 2 défauts bloquants (n° de facture trouvé dans une date ou une référence ; virement déjà
  marqué payé à la main qui payait une 2e facture) et 6 importants (débit lu comme crédit, période déjà déclarée, date des chèques
  et espèces, « 0 kg » pour une case vide, seuil du voyant, deux « €/h » contradictoires), plus 9 mineurs : tous corrigés et testés
  (suite P, partie P6b et suivantes ; les cas bloquants échouent sur le code d'avant correction).
- Tests : suite P (`tests/suiteP-ameliorations.mjs`, 138 contrôles), ajoutée à `tests/run-all.sh`.
- Tests : suite Q (`tests/suiteQ-recette.mjs`, 62 contrôles, environ 15 min), ajoutée à `tests/run-all.sh` ;
  `CP_Q_PARTIES=4,5` pour n'en jouer qu'une partie.
- À essayer par Gabriel sur la copie d'essai `ClimPilot-ESSAI-1.12.zip` : Objectifs & feux (rentabilité, retour SAV, liste de
  lancement), Paramètres (lien d'avis), relevé bancaire (fichier CSV de sa banque, sur des factures d'essai), écran Fluides,
  menus « Créer » / « Outils » et recherche Ctrl K.
- Mise en production : fusion de cette branche (elle contient la 1.11) dans `main` par Gabriel, puis F5 sur chaque appareil.

### Recette « deux appareils » du 14/10/2026 (suite Q)
Banc d'essai `tests/banc-appareils.mjs` : un PC (1300 px) et un iPhone 13 simulés, sur UN serveur commun simulé côté Node
(état : règle de `cp_state_push` ; registre des factures : règles de `cp_emettre_document`, numérotation partagée). Le client
Supabase de l'appli est remplacé avant son chargement : vrai démarrage (`initCloud`), vrai écran de connexion, rechargements
de l'appli compris. Coupure réseau par appareil, retour sur l'appli (`visibilitychange`), réseau lent, modules lents.
Scénarios de `tests/suiteQ-recette.mjs` (captures et `etapes.json` dans `<CP_TEST_OUT>/recette/`, rapport pour Gabriel) :
ouverture d'un 2e appareil, ancienne version restée en cache, connexion d'un nouvel appareil, journée complète (facturation
réelle démarrée, factures depuis les deux appareils, même devis facturé des deux côtés, chèque, relevé bancaire importé sur
les deux, retour SAV, avis, fluides hors ligne, bouteilles, liste de lancement, hors ligne, devis ouvert pendant une mise à
jour, suppression, raccourcis, tous les écrans, contrôle du registre), dépannage préparé sur le PC et facturé sur le téléphone.
Défauts trouvés et corrigés (chaque test échoue sur le code d'avant) :
1. **Synchro partie avant le chargement des modules** (`index.html`, `cpQuandPret`) : à l'ouverture, les données des modules
   (retours SAV, bouteilles, registre des factures…) n'étaient pas reçues, et un envoi à ce moment-là les retirait du serveur.
   La synchro attend maintenant l'événement `nxstoreready`.
2. **Données inconnues retirées du serveur** (`cpGarderAbsentes`, `cpCompleterLocal`) : un appareil resté sur une ancienne
   version (ou qui n'avait pas encore reçu une donnée) renvoyait l'état sans elle. Une donnée présente sur le serveur et absente
   de l'appareil est maintenant renvoyée telle quelle, et rangée dès que l'appareil sait la lire.
3. **Prix en double à chaque nouvel appareil** (`seedPieces`, `seedAdiaArticles`, `nxDedupPrix`) : les articles de départ
   avaient un identifiant tiré au hasard sur chaque appareil (base de test : 84 lignes pour 28 articles). Identifiants fixes
   (`pd_…`, `adia_…`) et nettoyage des copies identiques, au démarrage et à chaque fusion ; un article modifié à la main est gardé.
4. **Même chantier facturé deux fois** (`next-emission.js`, `dejaEmis`) : un appareil pas encore synchronisé émettait une
   2e facture (F-…-003 puis F-…-004) pour un devis ou un dépannage déjà facturé ailleurs. Avant d'émettre, l'appli lit le
   registre du serveur (sélection légère `src:payload->src`, sinon lecture complète) et reprend la facture existante.
5. **Rechargements en chaîne entre deux appareils** (`save` dans `index.html`, `ajouterRegistre`) : une donnée réécrite à
   l'identique, et le registre réécrit avec une nouvelle date à chaque ouverture, déclenchaient une synchro ; l'autre appareil
   tombait en conflit et se rechargeait. Plus de synchro pour une réécriture identique ; une entrée du registre garde sa date.
6. **Raccourci de l'icône perdu** (`next-raccourcis.js`) quand l'appli se recharge juste après l'ouverture (mise à jour reçue
   d'un autre appareil) : la cible est gardée quelques secondes pour l'onglet (`sessionStorage`) et rouverte seulement après
   un rechargement fait par l'appli (`cpReload` pose `__cpRechargeAuto`), jamais après un F5.
Relecture indépendante des corrections (même jour) : 4 défauts importants trouvés, reproduits par un test puis corrigés :
7. **Renvois sans fin entre deux appareils** : le serveur (jsonb) rend les objets avec les clés dans un autre ordre ; le
   catalogue de l'assistant, recalculé à l'identique, passait pour modifié (9 envois et 7 rechargements sans rien toucher,
   test Q6). `save` compare maintenant le contenu sans tenir compte de l'ordre des clés (`cpStable`). Le banc simule cet ordre.
8. **Avoir partiel** : seul un avoir TOTAL (`payload->fac->total`) rend un chantier refacturable depuis un autre appareil.
9. **Solde calculé sans l'acompte émis ailleurs** (et acompte après un solde émis ailleurs) : l'appli reprend l'autre
   facture du devis, s'arrête et demande de relancer ; le solde relancé vaut total − acompte (test Q7).
10. **Fiche ouverte périmée après la reprise** (devis ouvert, fiche d'intervention `curDep`) : recopiée, sinon « Enregistrer »
   effaçait le numéro repris (test Q5).
11. **Reprise d'une facture annulée** (2e relecture) : le rapprochement remettait dans le chantier une facture annulée par un
   avoir total fait sur un autre appareil. Une facture visée par un avoir total du registre n'est plus jamais remise ; après
   une reprise, l'appli vérifie que la facture est bien sur le chantier, sinon elle demande de synchroniser (test Q7).
Garde-fous ajoutés : pas de synchro dans un onglet en lecture seule ; complément de données reporté pendant un formulaire et
limité à un rechargement par minute ; registre lu avec un délai maximum de 25 s et les plus récents d'abord (plafond de
1 000 lignes du serveur) ; clés propres à l'appareil (`NX_BK_SKIP`) jamais renvoyées. À faire plus tard : le rapprochement
au démarrage lit encore le registre du plus ancien au plus récent (au-delà de 1 000 factures, les plus récentes manqueraient).
Reprise du 14/10 au soir (suite Q, parties Q8 et Q9 ; chaque test échoue sur le code d'avant) :
12. **Retour sur « Ma journée » après chaque mise à jour reçue** : le rechargement (seule façon sûre de relire toutes les
   données, voir ci-dessous) ramenait l'appareil sur « Ma journée », en haut. `cpReload` garde pour l'onglet l'écran ouvert et
   sa position (`__cpVue`, jamais un formulaire) ; `next-raccourcis.js` y revient avec le message « Mis à jour depuis ton autre
   appareil » (seulement après un rechargement fait par l'appli ; un F5 repart sur « Ma journée » ; un raccourci passe avant).
13. **Texte tapé effacé par une mise à jour** (Paramètres, fiche client, texte copié depuis une autre appli puis retour) : les
   champs où l'on tape sont suivis (`_cpChamps`, hors recherche) ; tant que l'un d'eux, encore à l'écran, diffère de sa valeur
   d'affichage, la mise à jour ou la fusion attend le prochain changement d'écran (`cpBusyForm`, message « appliquée au
   prochain changement d'écran »). Un enregistrement fait par un geste (bouton, case, champ quitté : `markDirty` dans les
   400 ms) clôt la saisie, pour que les envois ne restent pas bloqués. Rien n'est perdu : les modifications enregistrées
   restent marquées à envoyer et sont fusionnées en changeant d'écran.
14. **PC resté ouvert sans voir les changements du téléphone** : la synchro ne se faisait qu'en sortant de l'appli. Vérification
   légère (`cpVerifierDistant` : `select('updated_at')`, pas les données) quand la fenêtre revient au premier plan et toutes les
   minutes ; les données ne sont lues que si elles ont changé.
Relecture indépendante de ces trois corrections (même soir, suite Q, partie Q10 ; chaque test échoue sur le code d'avant) :
15. **Perte d'une modification faite pendant un envoi** (déjà là avant le 14/10) : un enregistrement fait pendant l'appel au
   serveur était marqué « envoyé » (succès) puis écrasé par la mise à jour suivante, ou écrasé tout de suite par la fusion
   (conflit). `pushState` relit l'appareil au moment de fusionner, et garde « à envoyer » ce qui a été enregistré pendant
   l'appel (`_cpEcritures`), avec un nouvel envoi aussitôt.
16. **État d'avant réenregistré pendant le rechargement** : entre l'écriture des données reçues et le vrai rechargement
   (jusqu'à 1,5 s), un clic pouvait réenregistrer l'état gardé en mémoire. Gel (`cpGeler`) : voile sur l'écran (« Mise à jour
   depuis ton autre appareil… »), plus aucune écriture des données synchronisées (`nxStore.geler`, next-store.js), rien
   marqué à envoyer ; si l'envoi échoue après une fusion, rechargement quand même.
17. **Recherche ou filtre qui bloquait les mises à jour** (`#srch`, `#depFilter`…, champs dont le seul rôle est de
   réafficher) et champ d'une fenêtre fermée : ignorés. Un enregistrement clôt seulement la saisie de son bloc (carte,
   fenêtre, formulaire ; l'écran pour un bouton hors bloc), et seulement s'il a lieu pendant le geste.
18. **Fiche client** rouverte sur le même client ; une seule lecture du serveur à la fois ; envoi automatique seulement s'il
   reste quelque chose à envoyer (`cpEnvoiSiBesoin`).
Deuxième relecture (même soir) :
19. **Appli bloquée sous le voile sur réseau lent** : après une fusion, l'appli renvoyait l'état sous le voile (appel sans
   délai maximum). La fusion est maintenant rangée sur l'appareil avec, pour base, la version du serveur et « à envoyer » ;
   l'appli se recharge tout de suite et l'envoi repart après, sans conflit (suite O, O21 : le redémarrage, simplement compté
   par `cpTestReload`, est rejoué à la main).
20. **Rechargement coupé à 1,5 s** (`nxStoreReload`, next-store.js) : une grosse donnée gardée seulement dans IndexedDB
   (iPhone) pouvait ne pas être écrite alors que la date de synchro l'était. Attente portée à 8 s au plus, sous le voile.
Gardé volontairement : chaque mise à jour reçue recharge l'appli (environ 1 s). L'appliquer sans recharger demanderait de
relire à la main toutes les données gardées en mémoire par une quarantaine de modules ; un oubli renverrait au serveur une
donnée périmée. Le rechargement reste donc, mais on revient au même écran, à la même hauteur, et jamais pendant une saisie.
Pas faisable ici (réseau fermé vers Supabase) : synchro réelle avec la base de test, iPhone réel, Netlify, relevé de sa banque.

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
