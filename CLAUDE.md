# ClimPilot : règles pour Claude (lues au début de chaque session)

> Dépôt PUBLIC. Ce fichier ne contient ni secret ni donnée personnelle, et ne doit jamais en contenir.
> État courant, file des missions et décisions en attente : `docs/FILE-DES-MISSIONS.md`, à lire juste après ce fichier.
> En cas de contradiction avec un skill, un ancien dossier ou un vieux prompt : ce fichier et `docs/FILE-DES-MISSIONS.md` font foi. Signale la contradiction à Gab.

## 1. Le projet
- **ClimPilot** est la PWA de gestion de Gabriel (« Gab »), futur artisan frigoriste-climaticien. L'ouverture de son entreprise est visée en septembre 2027 (à confirmer).
  - Fonctions : devis par nature de chantier, interventions, contrats d'entretien, planning, fluides, factures émises par le serveur, signature en ligne.
- **Technique** : JavaScript sans framework.
  - Le cœur est `index.html` (≈ 380 Ko).
  - 45 couches `next-*.js` sont chargées en fin de page et enveloppent les fonctions du cœur.
  - `sw.js` gère le cache hors ligne ; `supabase/` contient les migrations et les fonctions ; `tests/` contient la batterie (Playwright, SQL, validateurs de factures électroniques).
- **`main` = production** (GitHub Pages, les appareils de Gab).
  - Supabase RÉEL = ses vraies données.
  - Supabase TEST « ClimPilot-TEST » = les essais. Sa référence est dans le Project, jamais dans ce dépôt.
- **Gab ne sait pas coder.** Il décide, essaie sur la copie d'essai (base TEST), fusionne et déploie lui-même.
- **Statut juridique et régime de TVA : PAS ENCORE DÉCIDÉS** (décision avec sa comptable, prévue en décembre 2026). Ne code aucune règle qui suppose la micro-entreprise, une société ou un régime de TVA, sauf si le dossier de la mission le demande.
- **Documents hors dépôt** : le Project claude.ai « Gabriel Leroy — Froid & Clim », lu avec l'outil Projects (`project_read`, `project_search`, `project_write`).
  - Dossiers : `claude/ClimPilot-*.md` et `claude/PLAN-*.md`.
  - Ceux qui décrivent des failles non corrigées (mission S, détails P6) ne sont **que** là.

## 2. Au début de chaque session
1. Lire :
   - ce fichier ;
   - `docs/FILE-DES-MISSIONS.md` ;
   - `docs/REPRISE.md` (en tête) ;
   - `tests/LISEZMOI.md` ;
   - le dossier de TA mission (`docs/MISSION-*.md` ou le Project).
2. Faire `git fetch --prune origin`. Partir de `main` sauf consigne contraire écrite dans le prompt. Jamais deux branches en parallèle sur les mêmes golden.
3. Vérifier que l'outil Projects répond. S'il manque ou échoue : l'écrire en tête du compte rendu et ne jamais deviner le contenu d'un document. Si la mission en dépend, s'arrêter et le dire.
4. Préparer les tests : `bash ~/climpilot-pg.sh && source ~/.climpilot-env.sh` (voir `docs/ENVIRONNEMENT-CLAUDE-CODE.md`). S'il manque Chromium, PostgreSQL ou les validateurs : le dire tout de suite à Gab, en nommant le réglage manquant. La CI fait foi.

## 3. Règles absolues
Aucune exception, sauf accord ÉCRIT de Gab en tête du prompt de la mission.
1. **Gestes de Gab.** Jamais de push sur `main`, de fusion, de push forcé, de réécriture d'historique publié, de suppression de branche distante, ni de déploiement (Pages, fonctions Supabase, migrations, secrets). Ouvrir une demande de fusion **en brouillon** est permis.
2. **Supabase.** RÉEL : lecture seule, et seulement si la mission le demande. TEST : lecture. Toute écriture se fait par un script SQL avec verrou sur le marqueur `public.climpilot_marqueur_test` (modèle : `tests/supabase-test/4-une-facture-par-source-TEST.sql`), avec son script de retour arrière. C'est Gab qui le colle dans le SQL Editor.
3. **Tests d'abord.** Chaque correction est prouvée ROUGE sur l'ancien code (journal gardé), puis VERTE. Ensuite : batterie complète, puis CI verte sur la branche.
4. **Aucun montant, aucune règle fiscale, aucune mention légale, aucun arrondi ne change.**
   - Les golden des calculs (suite Z) et des documents (suite Y) restent identiques.
   - Les 5 « À TRANCHER » ne se régénèrent pas sans décision écrite de la comptable et de Gab.
   - Une régénération n'a lieu que si le dossier la demande ET que Gab la valide, avec l'avant/après dans le compte rendu.
5. **Gel des fonctionnalités** jusqu'au palier « prêt pour le terrain ». Une idée nouvelle va dans `docs/APRES-PRO-V1.md`, datée, pas dans le code. Les seules exceptions sont celles écrites en tête du prompt de la mission (décisions 21 à 23 de Gab).
6. **Une mission = une branche** (`correctif/…`, `docs/…`, `outillage/…`). Une branche vit **une semaine au plus**. Au-delà, il manque une décision : la poser à Gab au lieu d'empiler. Une seule mission qui touche le code de l'appli à la fois.
7. **Aucun secret, aucune donnée personnelle** dans le dépôt ni dans les messages de commit (adresse, e-mail, téléphone, employeur, identifiants, clés, IBAN, SIRET réels).
   - Avant chaque commit : `bash tools/claude/verif-secrets.sh` (le hook le lance aussi quand il est actif). Si le script bloque à tort, vérifier ligne par ligne, relancer avec `CP_SECRETS_OK=1` et le justifier dans le compte rendu. Si le hook plante ou dépasse son délai, la commande est bloquée : vérifier à la main (`bash tools/claude/verif-secrets.sh`, et `--branche` avant un push), puis relancer `CP_SECRETS_OK=1 git commit …` seul dans sa commande et le justifier dans le compte rendu (`docs/ENVIRONNEMENT-CLAUDE-CODE.md` § 4).
   - La clé du projet TEST va seulement dans la copie d'essai (`essai-config.js`).
   - Identifiants Super PDP jamais stockés, jamais de vrai SIRET avant la mise en service, jamais de clé Super PDP réelle sur la copie d'essai.
   - Commits signés avec une adresse `noreply`.
8. **Failles.** Une faille de sécurité non corrigée ne s'écrit jamais en détail dans le dépôt public. Le détail va dans le Project ; le dépôt reste neutre (« retrait de droits inutiles »).
9. **Les tests ne lisent jamais la vraie date** : utiliser `REF` (`tests/lib.mjs`) ou une horloge figée. Vérifier aussi avec `faketime` un samedi, un dimanche et le 05/01 de l'année suivante.
10. **Cache et version.** Un fichier mis en cache modifié → incrémenter `const C=` dans `sw.js`, **une seule fois par branche**. Le numéro affiché (`VERSION` dans `next-emission.js`, `NX_VERSION` dans `next-addons.js`) : demander à Gab avant de le changer. Les trois restent alignés.
11. **Pas de `catch(e){}` vide** : journaliser. Préférer modifier la fonction d'origine plutôt qu'ajouter une enveloppe (`suiteW-enveloppes` compte les enveloppes ; tout ajout change son golden, à régénérer avec l'accord de Gab).
12. **Relecture.** Chaque mission est relue par l'AUTRE modèle (Opus 5.5 ↔ Fable 5.1) avant toute fusion, avec le skill `relecture-p10`.

## 4. Boucle d'une mission
1. **Reproduire** : écrire le test, le voir ÉCHOUER sur l'ancien code (`git stash push <fichiers de code>`, lancer, `git stash pop`) et garder le journal rouge. Outils :
   - suites `tests/suite*.mjs` ;
   - banc deux appareils `tests/banc-appareils.mjs` ;
   - serveur simulé `tests/serveur-simule.mjs` ;
   - SQL `tests/sql` (PostgreSQL local, marqueur `climpilot-test`) ;
   - fonctions `tests/functions`.
2. **Corriger** dans le moins de fichiers possible, sans aucun fichier hors périmètre (le `git diff --stat` va dans le compte rendu).
3. **Suite visée** : `CP_SUITES=<suite> bash tests/run-all.sh` (le code 3 = passage partiel, c'est normal).
4. **Batterie complète** : `bash tests/run-all.sh`, puis lire `rapport.md`.
   - Ne lire les journaux que pour ce qui n'est pas PASS.
   - Codes de sortie : 0 = complet et réussi ; 1 = échec ; 3 = incomplet.
   - Versions épinglées : Playwright 1.56.1 / Chromium 141 ; PostgreSQL 16 (la production est en 17).
5. **CI** (`.github/workflows/tests.yml`, contrôle « batterie complète ») : lire le rapport avec `gh api repos/gablry8/cp-gl2607/commits/<sha>/check-runs --jq '.check_runs[]|select(.name|startswith("rapport"))|.output.text'`.
6. **Documenter** :
   - `docs/ESSAIS-SUPABASE-TEST.md` si le serveur est concerné ;
   - compte rendu `docs/<MISSION>-COMPTE-RENDU.md` + copie `claude/ClimPilot-<MISSION>-compte-rendu.md` dans le Project.
7. **Clore** : contrôle des secrets, commit en français, push **sur la branche de la mission**, CI verte, demande de fusion en brouillon, mise à jour de `docs/FILE-DES-MISSIONS.md` (ligne de la mission + suivante).

## 5. Compte rendu et message à Gab
- **En tête, 10 lignes maximum** : « ce que Gab décide / fait », dans l'ordre.
- **Puis** : constat → test rouge → correction → test vert → batterie → ce que ça change pour lui → ce qui n'a pas pu être vérifié.
- Chaque constat porte : **certain** (lu ou exécuté), **probable** (déduit) ou **hypothèse**.
- En français, court et franc, sans jargon. Jamais de flatterie, jamais « ça marche » sans preuve.
- Toujours dire où est une chose : **en ligne (main)**, **sur une branche** ou **sur TEST**.
- Pour chaque essai à faire par Gab : des étapes numérotées avec le résultat attendu.
- Un garde-fou qui bloque (nature S/M, médiateur, devis non accepté, registre illisible) est **voulu** : l'expliquer comme tel.
- **Ce qui appartient à Gab, que Claude ne tranche pas** : règles fiscales (sa comptable), durées RGPD, hébergement, fusions, déploiements, dépenses.

## 6. Pièges connus
- 45 couches enveloppent le cœur (`go`, `compute`, `updateBadges`, `renderDash`…). Si une couche est en 404, ses clés `SYNC_KEYS` disparaissent du serveur au prochain envoi.
- **Le serveur remplace tout l'état à chaque envoi** (`cp_state_push`). Une nouvelle donnée synchronisée = une liste d'éléments à `id`, petite. Un objet unique se fusionne en bloc et se perd en cas de conflit entre appareils.
- Pas de fonction d'échappement HTML dans le cœur. `esc` est recopiée dans plusieurs fichiers, en variantes ; `money` et `r2` sont locales à chaque fichier (`money` n'existe pas dans `next-emission.js`).
- Des centaines de `catch(e){}` vides : une erreur peut être muette.
- supabase-js 2.117 **résout** `{error, status:0}` sur une coupure réseau, il ne rejette pas : tester `erreurReseau(r)`.
- Mode démonstration : l'émission ne consulte pas le registre du serveur ; le compteur `TEST-` est local (doublons possibles entre appareils).
- `supabase/schema.sql` n'est pas rejouable : la vérité du serveur est dans `supabase/migrations/` et le projet TEST.
- Service worker « réseau d'abord, 2,5 s » : en réseau fantôme, il faut 5 à 8 s avant l'affichage.
- Chrome 153 (préinstallé sur certaines machines) ignore `emulateNetworkConditions{offline:false}` sous `unshare -n` : utiliser le Chromium 141 de Playwright ou la CI.

## 7. Délégation
- Agents du dépôt : `climpilot-chercheur` (Haiku, lecture seule) et `climpilot-executant` (Sonnet, modifications mécaniques décrites) ; skill `deleguer-aux-agents`.
- Les décisions, la sécurité, les commits et la revue restent dans la session principale.
