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
