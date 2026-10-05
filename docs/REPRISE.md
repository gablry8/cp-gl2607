# ClimPilot — reprise du travail (Cowork ou Codex) — mise à jour du 05/10/2026

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

## Ce qui reste à faire, dans l'ordre

1. ~~Décision « début de la facturation réelle »~~ : **fait le 05/10** (relecture R1). Le mode réel ne démarre que par l'action explicite et datée de Paramètres › Facturation réelle. Les anciennes factures sont des essais par défaut (ESSAI-…). Voir `docs/CORRECTIONS-1.10.md`, « Relecture indépendante du 05/10/2026 ». En production, l'envoi à la plateforme part du registre (R2).
2. **Projet Supabase de test**, distinct du réel — **en partie fait le 05/10** (`docs/ESSAIS-SUPABASE-TEST.md`, 52/52) :
   - ~~appliquer la migration~~ : fait sur « ClimPilot-TEST » (PostgreSQL 17), 36 essais réussis ; migration durcie (droits des fonctions de déclencheur) ;
   - ~~fonction `signature`~~ : déployée sur le projet de test, 14 essais de bout en bout réussis ;
   - reste : `assistant` et `superpdp` (Gabriel doit poser `ALLOWED_USER_IDS` dans le tableau de bord), et l'appli elle-même pointée sur le projet de test ;
   - dérouler l'**ordre de déploiement envisagé** (`docs/CORRECTIONS-1.10.md`, « Ordre de déploiement envisagé ») : synchronisation entre versions, facturation, signature, mise à jour des appareils.
3. **SUPER PDP en bac à sable** : jusqu'ici, la plateforme est seulement simulée.
4. **Appareils réels** (iPhone, appli installée sur l'écran d'accueil) : mise à jour du service worker et impression des PDF.
5. **Points « à confirmer »** (comptable, assureur, médiateur, profil fiscal), **sauvegardes**, **double authentification** : Gabriel (liste dans `docs/CORRECTIONS-1.10.md`).
6. Ensuite seulement, avec l'accord de Gabriel : publication suivant l'ordre de déploiement envisagé.

## À savoir
- La branche `claude/brfr-controle-local` est un brouillon séparé (contrôle local des règles BR-FR), partie de `665161f` et **non fusionné**. La 1.10 couvre déjà les règles BR-FR (suite F). Comparer avant toute reprise de ce brouillon.
- Les identifiants Notion de `index.html` servent aux tarifs dans Cowork : ils ne sont pas secrets, ne pas les retirer.
- L'adresse de départ des trajets ne figure plus dans le code. Elle vient de l'appli (Paramètres) et reste synchronisée par Supabase.
