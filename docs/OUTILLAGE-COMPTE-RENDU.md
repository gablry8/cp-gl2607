# Mission OUTILLAGE : compte rendu (03/11/2026)

> Exécutant : Claude Code (Opus 5.5). Dossier : `MISSION-OUTILLAGE-01-11.md` (copie jointe du dossier du Project, mise à jour du 03/11 en tête).
> **Outil Projects absent de cette session** : le dossier a été lu dans la copie jointe ; la copie de ce compte rendu dans le Project (`claude/ClimPilot-OUTILLAGE-compte-rendu.md`) est à faire par une autre session.
> Où c'est : **sur une branche**, `outillage/claude-code`, demande de fusion **#8 en brouillon**. Rien en ligne, rien sur TEST, rien sur Supabase.
> Certitude : **certain** (lu ou exécuté), **probable** (déduit), **hypothèse**.

## Ce que Gab décide / fait, dans l'ordre
1. **Protéger `main` sur GitHub** (geste 2, § 1.1 du dossier) : elle ne l'est **pas** aujourd'hui (certain : `gh api …/branches/main` → `"protected": false`, aucune règle, lu le 03/11). C'est la seule vraie barrière.
2. Relire `CLAUDE.md` (5 min) sur la branche `outillage/claude-code`.
3. Faire relire la branche par Fable 5.1 avec le skill `relecture-p10` (règle 12), puis fusionner la demande #8 (la passer en « prête » d'abord).
4. Lancer les prochaines sessions **avec le dépôt choisi dès la création de la session**. Cette session-ci a démarré sans dépôt (ajouté en cours) : les règles bloquantes du dépôt **ne s'y sont pas appliquées** (§ 4.3, certain).
5. Dans la session suivante : taper `/context` → `CLAUDE.md` doit apparaître ; puis demander `git push --dry-run origin HEAD:main` → doit être **refusé**. S'il passe, les règles ne sont pas chargées (point 4).
6. Environnement : **rien à régler**. Chromium 141, PostgreSQL 16 et les validateurs sont présents (§ 1). `CP_MOTIFS_PRIVES` est déjà posée.
7. Connecteur Supabase (§ 1.3 du dossier) : vérifier dans claude.ai que les outils d'écriture sont bloqués et `execute_sql` en « approbation demandée » (non vérifiable d'ici, § 7).
8. S'il le souhaite : supprimer les **16 branches contenues dans `main`** (liste dans `docs/FILE-DES-MISSIONS.md`).
9. Décider du sort de 2 vieilles branches non fusionnées : `claude/brfr-controle-local` (05/10) et `claude/login-password-issue-f7cidd` (28/08).
10. Décider s'il faut corriger les 2 trous du contrôle des secrets en mode hook (§ 4.4) dans une prochaine mission OUTILLAGE ; en attendant, la règle 7 (script lancé à la main avant chaque commit) et `verif-secrets.sh --branche` avant le push les couvrent.

## 1. Environnement et batterie (étape A)
- Setup script de l'environnement : **a tourné** (certain : `~/setup-climpilot.log` du 03/11, bilan `OK postgresql`, `OK validateurs`, `OK python`, `OK playwright`). Le téléchargement de Chromium depuis `cdn.playwright.dev` a réussi : les 2 domaines du § 1.2 sont donc autorisés (certain).
- `bash ~/climpilot-pg.sh` → `climpilot-test` ; `source ~/.climpilot-env.sh` : OK (certain).
- `npx playwright@1.56.1 --version` → `Version 1.56.1` ; Chromium 141 de Playwright présent (certain).
  - **Écart avec le dossier** : il n'est pas dans `~/.cache/ms-playwright` mais dans `/opt/pw-browsers/chromium-1194`, car l'environnement pose `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (certain). La vérification de `docs/ENVIRONNEMENT-CLAUDE-CODE.md` en tient compte.
- `python3 -c "import saxonche, facturx, psycopg, lxml, pytest"` : OK ; `$EN16931_XSLT` et `$BRFR_DIR` existent ; `unshare -n true` : OK (certain).
- `~/climpilot-pg.sh` n'a pas la ligne de commentaire de l'annexe 6 : le script collé dans l'environnement est une variante très proche, sans effet (probable).
- **Batterie complète** sur `main` = `b9155b6`, `bash tests/run-all.sh` (isolation du noyau active, `unshare -n`) : code 0, **COMPLET, RÉUSSI — 1242 réussis, 0 échoué, 0 SKIP**, 5 non bloquants « À TRANCHER » (suite Y), arbre propre, 22 min (certain).
- **CI du même commit** (« rapport — batterie complète ») : **1238 réussis, 0 échoué, 2 SKIP connus** (isolation du noyau absente en CI), 5 non bloquants « À TRANCHER » (suite Y, M3 C2) (certain).
- **Comparaison** étape par étape : 35 étapes sur 36 ont exactement les mêmes comptes. Seul écart, attendu : `autotest-isolation`, 20 réussis en local contre 16 réussis + 2 SKIP en CI. En local, la couche noyau existe : ses 4 contrôles (boucle locale seule ; Node, Python et noms de domaine bloqués sans garde) passent, là où la CI note les 2 SKIP connus (certain).

## 2. État des lieux (étape B)
- `main` = `b9155b6` (fusion de C3, 03/11), parent `477a151` (fusion de la 1.13.0, 02/11). `VERSION='1.13.0'`, `NX_VERSION='Next 1.13.0 — …'`, `const C='climpilot-next-1131-production'` : alignés (certain).
- 20 branches distantes avant cette mission : `main`, 16 contenues dans `main` (« à supprimer par Gab »), 3 non contenues (« à décider », dont P6+ en cours). `outillage/claude-code` s'y ajoute. Tableau complet : `docs/FILE-DES-MISSIONS.md` (certain). **Aucune branche supprimée.**
- Demandes de fusion : #7 (P6+) ouverte en brouillon, gérée par INTÉGRATION-P6+ ; #6 (C3) et #5 (1.13.0) fusionnées. **Aucune demande ouverte par cette mission pour C3 ou P6+** (consigne du 03/11).
- CI des têtes :
  - C3 `5c2d470` : **1238 / 0** (certain). Le chiffre de 1236 annoncé correspond à `86eaeca`, le commit d'avant les conditions de relecture (CI lue : 1236 / 0) ; `5c2d470` en a ajouté 2 (certain).
  - P6+ `f63fbae` : **1151 / 0**, comme annoncé (certain).
- `gh pr list` échoue dans une session cloud (`HTTP 403: GitHub GraphQL is not available from Claude Code sessions`) : l'état des demandes a été lu par l'API REST (certain). Noté dans `docs/ENVIRONNEMENT-CLAUDE-CODE.md`.

## 3. `CLAUDE.md` (étape C)
- Contenu de l'annexe 1 **mot pour mot** (comparaison octet par octet avec l'annexe : identique) (certain).
- **Aucune adaptation** : chaque fait vérifiable a été contrôlé dans le dépôt et s'est révélé exact (certain) :
  - `index.html` = 391 468 octets (≈ 380 Ko) ; 45 fichiers `next-*.js`, tous chargés par `index.html` ;
  - fichiers cités présents : `docs/REPRISE.md`, `docs/APRES-PRO-V1.md`, `docs/ESSAIS-SUPABASE-TEST.md`, `tests/LISEZMOI.md`, `tests/supabase-test/4-une-facture-par-source-TEST.sql`, `tests/banc-appareils.mjs`, `tests/serveur-simule.mjs`, `tests/sql`, `tests/functions`, `supabase/schema.sql`, `supabase/migrations/`, `.github/workflows/tests.yml` (contrôle « batterie complète ») ;
  - `REF` dans `tests/lib.mjs` ; `vendor/supabase-js-2.117.3` ; pas de `money` dans `next-emission.js` ; `erreurReseau` dans `next-emission.js` ; délai de 2 500 ms dans `sw.js` ;
  - agents `climpilot-chercheur` (haiku) et `climpilot-executant` (sonnet), skill `deleguer-aux-agents`.
- § 1 et § 2 point 3 (outil Projects) gardés tels quels, comme demandé le 03/11.
- `verif-secrets.sh` passé sur `CLAUDE.md` indexé, avec les motifs privés de l'environnement : code 0 (certain).

## 4. Règles bloquantes et contrôle des secrets (étape D)
### 4.1 Pages lues (03/11/2026)
- https://code.claude.com/docs/en/permissions (syntaxe `Tool(specifier)`, joker `*`, forme `:*`, ordre deny → ask → allow, règles MCP sans parenthèses, refus d'un outil entier, limites des règles Bash).
- https://code.claude.com/docs/en/hooks (structure `PreToolUse` / `matcher` / `command`, entrée JSON, code 2 = appel bloqué avec le message d'erreur, `${CLAUDE_PROJECT_DIR}` entre guillemets, dossier courant du hook).
- https://code.claude.com/docs/en/settings (fichier partagé `.claude/settings.json`, rechargement en cours de session, « Settings in cloud sessions »).

### 4.2 Ce que contient `.claude/settings.json`
- `permissions.deny` : push vers `main` (4 formes), push forcé (`--force*`, `-f`, `+<refspec>`), suppression (`--delete`, `-d`, `:<branche>`), et, dans le même esprit, `--prune` et `--mirror` (ajouts : ils suppriment ou écrasent des branches distantes) ; `gh pr merge`, `gh repo delete`, `gh api` en `DELETE` / `PUT` (4 écritures chacun), `gh release` ; `supabase db push`, `functions deploy`, `secrets`, `link` (aussi précédés de `npx`, ajout) ; les 11 outils d'écriture du connecteur Supabase ; `SearchPlugins` et `SuggestPluginInstall`.
- `permissions.ask` : `mcp__Supabase__execute_sql`.
- `hooks.PreToolUse` sur `Bash` : `bash "${CLAUDE_PROJECT_DIR}/tools/claude/verif-secrets.sh" --hook` (30 s au plus). Rien dans `env`.
- **Correction faite pendant les essais** : la règle `Bash(git push * :*)` ne bloquait pas `git push origin :<branche>` (certain, essai ci-dessous). Une règle qui finit par `:*` est lue comme l'ancienne écriture du joker final (doc « permissions ») : le deux-points disparaît. Écrite `Bash(git push * :**)`, elle bloque (certain).

### 4.3 Où les règles s'appliquent (constat important)
- Cette session a démarré dans `/home/user`, **sans dépôt** ; le dépôt a été ajouté en cours de route. Le fichier `.claude/settings.json` posé à la racine du clone (et dans le dossier à part) **n'a eu aucun effet** : `git push --dry-run --force …` et `git push --dry-run origin HEAD:main` sont passés (certain, 4 essais, sans effet car `--dry-run`). Contre-essai : session revenue dans le clone, échafaudage retiré, seul le fichier du clone en place → `git push --dry-run origin HEAD:main` passe encore (certain).
- Le même fichier copié dans le dossier de départ de la session (`/home/user/.claude/settings.json`, échafaudage hors dépôt) a été pris en compte **immédiatement** ; il a été gardé pendant la livraison pour protéger la session, puis retiré à la fin (certain).
- Conséquence : une session lancée avec le dépôt choisi dès sa création démarre dans le clone et lit ses règles (doc « Settings in cloud sessions », probable). Une session lancée sans dépôt, comme celle-ci, ne les lit pas (certain pour celle-ci). Les « threads » des Projects ne les lisent jamais (doc).

### 4.4 Preuves rouge / vert (dossier à part `git worktree add`, rien commité, dossier supprimé)
| Essai | Attendu | Obtenu |
|---|---|---|
| Faux jeton `eyJ` + 30 caractères, indexé, `verif-secrets.sh` | code 2, « BLOQUÉ » | code 2, « BLOQUÉ » (certain) |
| Fichier propre indexé | code 0 | code 0 (certain) |
| `--hook`, commande sans `git commit` (jeton pourtant indexé) | code 0 sans rien lire | code 0 (certain) |
| `--hook`, `git commit` avec le jeton indexé | code 2 | code 2 (certain) |
| Motif privé fictif via `CP_MOTIFS_PRIVES` | « BLOQUÉ » | « BLOQUÉ » (certain) |
| `git push --dry-run --force origin outillage/claude-code` | refusé | **refusé** (certain) |
| `git push --dry-run origin HEAD:main` | refusé | **refusé** (certain) |
| `gh pr merge --help` | refusé | **refusé** (certain) |
| `gh repo delete --help` | refusé | **refusé** (certain) |
| En plus : `-f`, `+HEAD:…`, `--delete`, `:<branche>`, `gh release --help`, `gh api --help -X DELETE …`, `SearchPlugins` | refusés | **refusés** (certain) |
| Témoin : `git push --dry-run -u origin HEAD:refs/heads/outillage/claude-code` | permis | permis (certain) |
| Outils du connecteur Supabase interdits | retirés de la session | `create_branch`, `delete_branch`, `merge_branch`, `rebase_branch`, `reset_branch` retirés dès le chargement (certain) ; les 6 autres n'étaient déjà pas proposés à la session (réglage du connecteur, probable) |
| **Hook** : vrai `git commit -m …` avec le faux jeton indexé | commit refusé | **refusé**, message « BLOQUÉ » renvoyé à Claude (certain) |

**Deux trous du hook** (script de l'annexe 2 gardé tel quel, à décider par Gab, point 10) :
1. `git -c user.name=… commit` (ou `git -C <dossier> commit`) n'est pas reconnu : le motif cherche `git` suivi directement de `commit`. Premier essai fait sous cette forme : **le commit est passé** (certain). Il a été défait aussitôt (`git reset --soft`, dossier à part, jamais poussé).
2. `git add <fichier> && git commit …` dans la même commande : le hook tourne **avant** le `git add`, il ne voit pas le fichier. Prouvé avec `git commit --dry-run` (rien commité) : passé (certain). Même chose, probablement, pour `git commit -a`.

Parade en place : `CLAUDE.md` (règle 7) demande de lancer le script avant chaque commit, et `verif-secrets.sh --branche` avant chaque push relit toute la branche.

## 5. Skill et documents (étapes E et F)
- `.claude/skills/relecture-p10/SKILL.md` : annexe 4 mot pour mot (certain).
- `docs/FILE-DES-MISSIONS.md` : annexe 5, sections « Branches » et « Demandes de fusion » remplies par l'étape B, ligne 4 (OUTILLAGE) mise à jour (certain).
- `docs/ENVIRONNEMENT-CLAUDE-CODE.md` : réglages du § 1.2, script de l'annexe 6 en entier (identique, vérifié par `diff`), vérification de l'étape A, phrase sur Chrome 153 (certain). Ajouts : emplacement réel de Chromium (`PLAYWRIGHT_BROWSERS_PATH`) et `gh pr list` indisponible.

## 6. Livraison (étape G)
- `bash tools/claude/verif-secrets.sh` avant chacun des 3 commits, puis `--branche` avant chaque push, avec les motifs privés de l'environnement → code 0 (certain).
- `git diff --stat origin/main...HEAD` → **les 7 fichiers du § 2 et rien d'autre** : `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/relecture-p10/SKILL.md`, `tools/claude/verif-secrets.sh` (exécutable), `docs/FILE-DES-MISSIONS.md`, `docs/ENVIRONNEMENT-CLAUDE-CODE.md`, `docs/OUTILLAGE-COMPTE-RENDU.md` (certain).
- Commits (adresse `noreply`) : (1) `cfec487` outillage, (2) `2847a18` docs, (3) ce compte rendu + ligne 4 de la file des missions (certain).
- CI de `2847a18` (« rapport — batterie complète ») : **COMPLET, RÉUSSI — 1238 réussis, 0 échoué, 2 SKIP connus**, 5 non bloquants ; **mêmes comptes que `main`, étape par étape** (certain). La CI du 3e commit (documents seulement) est relancée à son push.
- Demande de fusion **#8 en brouillon** vers `main` : https://github.com/gablry8/cp-gl2607/pull/8 (certain). Rien fusionné, rien supprimé, aucun push forcé, rien sur `main`.
- Échafaudage de la session retiré à la fin : `/home/user/.claude/settings.json` et `/home/user/tools/claude/` (hors dépôt), copies non suivies dans le clone (certain).

## 7. Ce qui n'a pas pu être vérifié
- La règle `ask` sur `mcp__Supabase__execute_sql` : l'essayer aurait demandé un accès à Supabase, interdit par la mission (non vérifié).
- Les réglages du connecteur Supabase et l'application GitHub de Claude (§ 1.3 et § 1.1) : hors de portée de la session (non vérifié).
- Le chargement des règles dans une session lancée **avec** le dépôt : probable d'après la doc, à confirmer par Gab (point 5).
- Les règles Bash ne sont pas une barrière : la doc le dit, une commande écrite autrement (`git -C . push`, `bash -c '…'`) leur échappe. La barrière est la protection de `main` (point 1).
- `gh api -X PATCH` (modifier les réglages du dépôt) et `POST …/merges` ne sont pas interdits : l'annexe 3 ne les demande pas, la protection de `main` les couvre (probable).
