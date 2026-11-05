# ClimPilot — Mission OUTILLAGE-2 : faketime, tests SQL de l'agenda, suite Q, hook des secrets — compte rendu

> Rédigé le 05/11/2026 par Claude (Opus 5.5), **exécutant** de la mission. Relecture à faire par l'autre modèle (Fable 5.1, skill `relecture-p10`).
> Branche **`outillage/environnement-2`**, partie de `origin/main` = `2e1214b` (05/11/2026). **Aucun code de l'appli** (ni `index.html`, ni `next-*.js`, ni `sw.js`, ni `supabase/`, ni golden).
> Pas d'outil Projects dans cette session : la copie `claude/ClimPilot-OUTILLAGE-2-compte-rendu.md` dans le Project **n'est pas faite** (geste de Gab ou de la prochaine session qui a l'outil).
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**. Journaux rouge / vert gardés **hors dépôt** (dossier de travail de la session, effacé avec elle) : les lignes utiles sont recopiées ici.

## Ce que Gab décide / fait (dans l'ordre)

1. **Coller le nouveau setup script** : claude.ai/code → réglages de l'environnement ClimPilot → champ « Setup script » → remplacer TOUT par le script du § 2 de `docs/ENVIRONNEMENT-CLAUDE-CODE.md` (étapes au § 1.5 ci-dessous). Changements : l'étape « 5) faketime » et la ligne de bilan (dernière ligne).
2. Faire relire la branche par **Fable 5.1** (`relecture-p10`), puis fusionner la demande de fusion **#12** (brouillon) si la relecture et la CI sont vertes. Rien à faire sur les appareils (aucun fichier de l'appli ne change, pas de F5 nécessaire).
3. **D1 — hook qui plante** : aujourd'hui, si le contrôle des secrets plante ou dépasse 30 s, la commande passe quand même (doc officielle). Ajouter `"onFailure": "block"` dans `.claude/settings.json` ? **Mon avis : oui** (§ 4.6).
4. **D2 — deuxième barrière au `git push`** : relancer le contrôle de toute la branche avant chaque push (voit les commits faits par n'importe quel chemin). **Mon avis : oui**, plus sûr qu'un hook PostToolUse (§ 4.6).
5. **D3 — Q10 « voile »** : accepter la condition « compteur d'écritures inchangé » quand le PC avait déjà une modification en attente (§ 3.4) ? **Mon avis : oui** (même exigence, mesurée autrement dans un cas que l'ancien test ne savait pas traiter).
6. **D4 — messages de commit** : le hook ne lit pas le texte des messages de commit (la règle 7 les vise aussi). Petite mission à prévoir ? **Mon avis : oui.**
7. **D5 — reste de la suite Q** : 60 attentes fixes restent dans Q1 à Q4 et Q6 à Q9 (jamais vues en échec). Les laisser tant qu'elles ne lâchent pas ? **Mon avis : oui.**
8. Après fusion : supprimer la branche `outillage/environnement-2` (geste de Gab).

## 0. Ce qui a été fait, en bref

| Sujet | Fichier(s) | Rouge (ancien) | Vert (nouveau) |
|---|---|---|---|
| 1. faketime absent | `docs/ENVIRONNEMENT-CLAUDE-CODE.md` | `faketime: command not found` (code 127) dans cette session neuve | script de la doc rejoué : 5 « OK » dont `OK faketime`, `faketime: Version 0.9.10` |
| 2. SQL agenda sous faketime | `tests/sql/test_agenda.py` | 3 échecs / 66 sous `faketime 2027-01-05` | 66 / 66 sans faketime, 07/11, 08/11/2026, 05/01/2027 ; et contre un PostgreSQL lui-même truqué |
| 3. Suite Q chronométrée | `tests/suiteQ-recette.mjs` | Q10 rouge 2 fois sur 3 sous charge ; Q5 « Timeout 30000ms » en course provoquée | 5 passages de suite **64 / 64** au repos ; 64 / 64 sous charge (autre batterie en parallèle) et 64 / 64 sous charge forte ; Q5 4 / 4 en course provoquée |
| 4. Hook des secrets | `tools/claude/verif-secrets.sh` | les 4 trous passent (tableau § 4.4) | 32 cas, 0 écart |

`git diff --stat origin/main...HEAD` : 6 fichiers, tous dans le périmètre de la mission (`.claude/settings.json` n'a pas eu besoin de changer ; `tests/lib.mjs` non touché) :
```
 docs/ENVIRONNEMENT-CLAUDE-CODE.md |  20 ++-
 docs/FILE-DES-MISSIONS.md         |   5 +
 docs/OUTILLAGE-2-COMPTE-RENDU.md  | (ce document)
 tests/sql/test_agenda.py          |  36 +++--
 tests/suiteQ-recette.mjs          | 151 +++++++++++++++-----
 tools/claude/verif-secrets.sh     | 289 +++++++++++++++++++++++++++++++++++---
```
Contrôle des secrets : `bash tools/claude/verif-secrets.sh --branche` → code 0 (avant chaque push). Aucun `CP_SECRETS_OK=1` utilisé dans cette mission.

---

## 1. faketime dans l'environnement Claude Code

### 1.1 Constat
- **Certain** : dans cette session (environnement neuf, 05/11/2026 10:20), `faketime --version` → `faketime: command not found` (code 127) ; `dpkg -s faketime` → « not installed ». Le journal d'installation `~/setup-climpilot.log` ne connaît que `OK postgresql`, `OK validateurs`, `OK playwright`, `OK python`.
- **Certain**, trouvé en passant : la ligne de bilan du script (`grep -E "^(OK|ECHEC)"`) n'affichait que 3 lignes sur 4 : `OK python` était collé au bout d'une ligne d'apt écrite en même temps (`Reading package lists...OK python`, ligne 68 du journal). Corrigé (`grep -oE`), sinon `OK faketime` aurait pu disparaître de la même façon.
- **Certain** (lu) : le script du § 2 de `docs/ENVIRONNEMENT-CLAUDE-CODE.md` n'installait pas faketime, alors que CLAUDE.md (règle 9) et `tests/LISEZMOI.md` (R12) demandent de rejouer la batterie sous faketime.
- Le dossier de mission parle de « l'annexe 6 » : dans le dépôt, c'est le **§ 2** de `docs/ENVIRONNEMENT-CLAUDE-CODE.md` (celui qui crée `~/climpilot-pg.sh` et `~/.climpilot-env.sh`). C'est lui qui est modifié.

### 1.2 Correction
- § 2 (setup script) : étape **« 5) faketime »**, placée **après** le `wait` : `playwright install --with-deps` se sert aussi d'apt, et deux apt en même temps se bloquent (verrou dpkg). Installe faketime s'il manque (`apt-get install`, puis `apt-get update` et nouvel essai si la liste des paquets est vide), puis écrit `OK faketime` ou `ECHEC faketime` dans le bilan.
- § 2 (dernière ligne) : bilan lu avec `grep -oE "(OK|ECHEC) (playwright|python|validateurs|postgresql|faketime)"`, qui retrouve aussi un « OK … » collé au bout d'une ligne.
- § 3 (vérification au début de chaque session) : `faketime --version` → `faketime: Version 0.9.10`.
- § 3 (fin) : la commande de la règle 9 (samedi, dimanche, 05/01 suivant) et le piège trouvé au sujet 2 : faketime ne truque **pas** l'horloge du PostgreSQL local.
- § 4 : ce que contrôle le hook des secrets (sujet 4).

### 1.3 Vert
- **Certain** (journal `1-faketime-vert.txt`, 05/11 12:04) : faketime retiré (`apt-get remove`) → `faketime: command not found`, code 127 (état rouge reproduit) ; puis le script du § 2, **extrait tel quel de la doc** et lancé : bilan `OK validateurs`, `OK postgresql`, `OK python`, `OK playwright`, **`OK faketime`** (5 lignes, `OK python` compris), code 0, 13 s (outils déjà en cache) ; `faketime --version` → `faketime: Version 0.9.10` ; `faketime '2027-01-05 10:00:00' date -I` → `2027-01-05`.
- `~/.climpilot-env.sh` récrit à l'identique. `~/climpilot-pg.sh` ne diffère que d'une ligne de commentaire (celui de cet environnement venait d'une version du script un peu plus ancienne que la doc : **certain**, sans effet).

### 1.4 Ce qui n'a pas pu être vérifié
- La création d'un environnement **neuf** avec le nouveau script (c'est le geste de Gab, étape 1.5). Ici, le script a été rejoué dans la session existante.
- Le réseau : apt a pu télécharger faketime ici (réglage « default list of common package managers » coché) — **certain pour cet environnement**, non vérifié pour un autre.

### 1.5 Étapes pour Gab (≈ 5 min)
1. Ouvrir claude.ai/code → l'environnement utilisé pour ClimPilot → réglages (« Setup script »).
2. Ouvrir `docs/ENVIRONNEMENT-CLAUDE-CODE.md` sur la branche (ou sur `main` après la fusion), § 2 : copier **tout** le bloc qui commence par `#!/bin/bash` et finit par `grep -oE "(OK|ECHEC) (playwright|python|validateurs|postgresql|faketime)" "$LOG"`.
3. Le coller à la place de l'ancien script, enregistrer. Ne rien changer d'autre (réseau, variables).
4. Ouvrir une **nouvelle** session et lui demander : `faketime --version ; grep -oE "(OK|ECHEC) (playwright|python|validateurs|postgresql|faketime)" ~/setup-climpilot.log`.
   **Attendu** : `faketime: Version 0.9.10`, puis 5 lignes `OK` (playwright, python, validateurs, postgresql, faketime), aucune `ECHEC`.

---

## 2. Tests SQL de l'agenda sous faketime

### 2.1 Constat
- **Certain** (exécuté sur `2e1214b`, journal `2-sql-agenda-rouge.txt`) : `tests/sql` = 66 réussis sans faketime, sous `faketime '2026-11-07 10:00:00'` (samedi) et `'2026-11-08 10:00:00'` (dimanche) ; **63 réussis, 3 échecs** sous `faketime '2027-01-05 10:00:00'` :
  `test_appli_enregistre_ses_demi_journees_et_ignore_le_reste`, `test_remplacement_de_la_fenetre`, `test_service_role_google_et_garde_fous` — les mêmes que la relecture du 05/11.
- **Certain** (lu) : le test prenait les jours dans l'horloge de **Python** (`datetime.date.today()`, truquée par faketime) et les fenêtres dans `current_date` de **PostgreSQL** (serveur démarré avant, par `~/climpilot-pg.sh` : jamais truqué). Sous faketime 2027, « dans 3 jours » tombait hors de la fenêtre « aujourd'hui + 60 jours » du serveur (05/11/2026 → 04/01/2027).
- **Certain** (exécuté, journal `2-sql-agenda-serveur-truque.txt`) : la cause est bien l'écart des deux horloges. Avec un second PostgreSQL **lui-même** lancé sous `faketime '2027-01-05'` (port 54330, marqueur `climpilot-test`, `current_date` = 2027-01-05) et Python à l'heure réelle, l'ancien test échoue aussi (mêmes 3 tests).
- **Certain** (exécuté) : sous faketime 2027-01-05, `test_chacun_ne_voit_que_ses_demi_journees` passait **à vide** (A n'écrivait rien, donc B ne voyait rien).

### 2.2 Pourquoi pas une date figée comme `REF`
`cp_busy_remplacer` (migration agenda, non modifiée) fait son ménage avec `current_date` (« jours passés de plus de 30 jours »). Une date de test figée deviendrait « passée » avec le temps, et ce ménage effacerait les jours du test : bombe à retardement. Figer `current_date` pour une session est impossible ici : la fonction testée a `search_path` vide et appelle `current_date` de `pg_catalog` (**certain**, lu) ; PostgreSQL n'a pas de réglage pour figer l'heure d'une session (**probable**, aucun connu).

### 2.3 Correction (`tests/sql/test_agenda.py`, tests seulement)
- **Une seule date de référence par test**, lue une fois sur le serveur (`select current_date`, l'horloge que lit la fonction testée), d'où sont tirés **tous** les jours **et toutes** les fenêtres passés aux fonctions (`%s::date`). L'horloge de Python n'est plus lue.
- Contrôles inchangés ; deux renforcés : le jour enregistré est vérifié (pas seulement source et demi-journées) ; « chacun ne voit que ses demi-journées » vérifie d'abord que A a bien écrit 1 ligne.
- Nombre de tests inchangé (6 dans ce fichier, 66 dans `tests/sql`).

### 2.4 Vert
- **Certain** (journal `2-sql-agenda-vert.txt`, branche) : `tests/sql` **66 / 66** sans faketime, sous faketime samedi 07/11/2026, dimanche 08/11/2026 et 05/01/2027.
- **Certain** (journal `2-sql-agenda-serveur-truque.txt`) : contre le PostgreSQL truqué au 05/01/2027 : `test_agenda.py` **6 / 6** (Python à l'heure réelle, puis Python sous faketime 07/11/2026 : deux horloges différentes) ; `tests/sql` complet **66 / 66**.

### 2.5 Ce que ça change pour Gab
Rien dans l'appli. La batterie sous faketime (règle 9) ne s'arrête plus sur ces 3 tests.

### 2.6 Non vérifié
Les autres fichiers de `tests/sql` lisaient déjà la date du serveur (`now() at time zone 'Europe/Paris'`) : vérifiés verts sous faketime et contre le serveur truqué, pas modifiés.

---

## 3. Suite Q chronométrée (Q5 et Q10)

### 3.1 Constat Q10 « voile »
- **Certain** (journaux `charge-ancien.txt`) : sur `main` (`2e1214b`), suite Q **au repos** : 64 / 64 (466 s). **Sous charge** (6 boucles actives sur 4 cœurs, parties 5 et 10 seules, 3 passages) : Q10 « voile » **rouge 2 fois sur 3**, toujours la même signature :
  `{"reposAvant":true,"reposApres":true,"voile":false,"pendant":{"dessus":"","stale":true,"dirty":true},"apresA":{"pc":true,"srv":true}}`.
  `stale:true` = le PC avait **déjà** rechargé les nouvelles données quand la fenêtre d'observation a commencé : le voile était passé avant.
- **Certain** (relevé dans la page par le nouveau test, sous charge, 7 passages sur 12) : la mise à jour arrive **avant** le focus simulé par le test (champ `declenchement`) ; au repos, toujours « après le focus ». **Probable** (déduit) : c'est la **vérification de chaque minute** du PC (`verifMinute`, minuterie de 60 s : sur machine lente, le PC est ouvert depuis plus de 40 s de temps réel quand le test avance l'horloge de 21 s) qui la lance, ou la relecture au redémarrage du PC.
- **Certain** : dans ce cas, le PC avait souvent une modification pas encore envoyée au moment du voile (`dirtyAvant:true`), et le réenregistrement fait pendant le voile n'ajoutait rien (`_cpEcritures` 14 → 14, puis 1 → 1). L'ancienne condition « rien à envoyer après » ne pouvait donc pas être vraie, **quel que soit** le comportement de l'appli.
- Aucune donnée perdue dans aucun passage (`apresA` vrai partout) — **certain**.

### 3.2 Constat Q5 « Dépannage : PC et téléphone — essai interrompu »
- **Certain** : vu en CI (run 74, 1re tentative, 04/11) et le 20/10 ; le journal de la CI n'est pas lisible d'ici (artefact). **Pas reproduit** sous simple charge ici (3 passages, Q5 vert).
- **Probable** (cause) : le test agit sur la fiche pendant qu'un rechargement de l'appli est **déjà lancé** (mise à jour reçue juste avant) : la fiche s'ouvre, puis la page se recharge, le bouton « Facturer » disparaît et le clic attend 30 s → `locator.click: Timeout 30000ms exceeded` → « essai interrompu ».
- **Certain** (course **provoquée**, copies hors dépôt, journal `3-q5-course-provoquee.txt`, partie 5 seule) :

| Injection (même ligne ajoutée dans l'ancien et le nouveau test) | Ancien test | Nouveau test |
|---|---|---|
| 1. rechargement du téléphone retardé de 1,5 s après la mise à jour (appareil lent) | essai interrompu : `SyntaxError: "undefined" is not valid JSON` (fiche ouverte avant que le téléphone ait le dépannage) | **4 / 4** |
| 3. rechargement **déjà lancé** au moment où la fiche s'ouvre | essai interrompu : **`locator.click: Timeout 30000ms exceeded`** | **4 / 4** |
| 2. rechargement **forcé pendant l'émission** de la facture | essai interrompu (30 s) | 3 / 4 (facture non émise) |

  La variante 2 est **écartée** : elle force un rechargement que l'appli n'autorise pas (une mise à jour reçue pendant qu'une fiche d'intervention est ouverte est différée, `cpBusyForm` — **certain**, lu). Elle est notée pour être complet.

### 3.3 Correction (`tests/suiteQ-recette.mjs` seulement)
Aides ajoutées en tête : `attendre` (condition dans la page, bornée, tolère un rechargement), `attendreQue` (condition côté banc), `vueAffichee` (écran demandé réellement affiché), `cliquerSurLaFiche` (fiche rouverte tant que le bouton n'est pas visible, clic à 5 s, 30 s au plus en tout ; un clic qui échoue n'a rien déclenché), `factureDuDep` (numéro de facture définitif présent). `auRepos` : 10 s → 25 s (attente sur condition, plus longue seulement si la machine est lente).
- **Q5** : toutes les attentes fixes remplacées : formulaire visible avant la saisie, dépannage enregistré, téléphone qui a **reçu** le dépannage et fini de se recharger avant d'agir, clic « Facturer » par `cliquerSurLaFiche`, attente du numéro `F-…`. « Enregistrer » sur le PC : **sans** rouvrir la fiche (c'est la fiche ouverte qu'on veut vérifier), attente du message « Intervention enregistrée ».
- **Q10 a (voile)** : le voile est relevé **dans la page**, à l'instant où l'appli le pose (observateur armé avant la modification du téléphone, reposé à chaque chargement, résultat gardé dans `sessionStorage` qui survit au rechargement). Mêmes vérifications qu'avant, faites à ce moment-là : écran couvert par le voile, données en mémoire encore anciennes, réenregistrement sans effet ; puis données justes partout après le rechargement. PC envoyé et au repos **avant** la modification du téléphone. Détail ajouté au journal : `declenchement`, `dirtyAvant`, compteur d'écritures.
- **Q10 b à f** : attentes fixes remplacées par l'état attendu (envoi parti, notes arrivées au serveur, rechargement fait avec la bonne note, écran rouvert). La fenêtre fixe de **Q10 e** (1,5 s) est **gardée** : ce contrôle vérifie qu'**aucun** rechargement n'a lieu, on ne peut pas attendre une absence.
- Bilan : appels à `waitForTimeout` 84 → 61 dans le fichier (Q5 : 8 → 0 ; Q10 : 16 → 1, la fenêtre de Q10 e) ; les 60 autres sont dans Q1 à Q4, Q6 à Q9 et une boucle de sondage déjà bornée. Délais maximaux : 5 à 25 s (≤ 30 s). **64 contrôles**, mêmes noms, aucun retiré, aucun marqué INSTABLE.

### 3.4 Une condition changée (D3, à valider)
Q10 a, « l'état d'avant n'est pas réenregistré » :
- **cas d'origine** (PC sans modification en attente au moment du voile) : exigence **inchangée** (`dirty` faux après le réenregistrement), **plus** le compteur d'écritures de l'appli inchangé (renforcement) ;
- **cas « mise à jour arrivée avant le focus » avec une modification du PC en attente** : l'ancienne condition échouait toujours ; la nouvelle exige que le réenregistrement n'ait **rien ajouté** (compteur `_cpEcritures` inchangé : `markDirty` ne compte rien pendant le gel — **certain**, lu dans `index.html`).
Si Gab (ou la relecture) refuse : l'autre voie est de couper la vérification de chaque minute pendant cette étape (le scénario change davantage) ; je ne l'ai pas fait.

### 3.5 Vert
Tous sur le commit `c93ee1f` (le fichier de la suite Q n'a plus changé après), dans un `git worktree` propre (« arbre propre » dans chaque rapport), Chromium 141 / Playwright 1.56.1, `unshare -n`.

| Passage | Conditions | Résultat suite Q | Durée |
|---|---|---|---|
| 1 à 5 (`CP_SUITES=suiteQ-recette`, l'un après l'autre, 11:23 → 12:04) | machine au repos | **64 / 64**, **64 / 64**, **64 / 64**, **64 / 64**, **64 / 64** | 457, 452, 455, 460, 452 s |
| 6 | **sous charge** : une autre batterie (suites W, AD, P, AC) lancée en parallèle, en boucle (2 tours, 434 réussis chacun) | **64 / 64** | 462 s |
| 7 | **charge forte** : 6 boucles actives sur 4 cœurs (la charge qui faisait échouer Q10 sur `main`) | **64 / 64** (Q10 : voile relevé, « après le focus » cette fois) | 517 s |

Avant ces passages complets, Q5 + Q10 seules sous charge forte : 3 passages **11 / 11** avec la version finale (journal `charge-diag3.txt`), dont 1 où la mise à jour est arrivée **avant** le focus — le cas qui faisait échouer l'ancien test — vert grâce au relevé dans la page.
Durée de la suite Q : ≈ 455 s, comme avant (466 s sur `main` au repos ici ; 442 s en CI le 04/11) : les attentes sur condition ne l'allongent pas.

### 3.6 Ce que ça change pour Gab
Rien dans l'appli. La suite Q ne devrait plus rendre la batterie rouge par aléa de temps sur Q5 et Q10 ; un échec de Q5 ou Q10 voudra dire quelque chose.

### 3.7 Non vérifié / remarques
- La cause exacte de l'échec Q5 du run 74 (journal de CI illisible d'ici) : **probable**, pas certain.
- Q1 à Q4 et Q6 à Q9 gardent leurs attentes fixes (jamais vues en échec) : D5.
- **Hypothèse, non creusée (hors périmètre)** : sous charge, le PC avait souvent une modification à envoyer juste après l'ouverture de l'écran « Interventions » (`saleApresVue:true` dans le journal) ; sans effet sur les données.

---

## 4. Hook de contrôle des secrets

### 4.1 Documentation officielle lue
Page « Hooks reference », https://code.claude.com/docs/en/hooks, **lue le 05/11/2026** (Claude Code installé ici : 2.1.318). Points utilisés :
- l'entrée d'un hook PreToolUse pour Bash contient `tool_input.command` **et** `tool_input.description` (d'où le trou (c) : l'ancien script cherchait dans tout le JSON), plus `cwd` ;
- code 2 = commande bloquée, message = sortie d'erreur ; un hook qui **plante, sort avec un autre code ou dépasse son délai ne bloque pas** la commande, sauf `"onFailure": "block"` (Claude Code ≥ 2.1.295) ;
- le hook tourne dans le dossier courant de la session ;
- PostToolUse s'exécute **après** la commande : « the tool already ran », il ne peut pas l'empêcher ;
- le filtre `if` (ex. `Bash(git *)`) est « best-effort » ; la doc conseille les permissions pour une interdiction stricte.

### 4.2 Constat (les 4 trous, **certain**, exécutés sur l'ancien script : tableau § 4.4)
(a) `git -c user.name=x commit` et `git -C dossier commit` non reconnus ; (b) `git add f && git commit` et `git commit -a` : seul l'index est lu, avant le `git add` ; (c) blocage d'une commande anodine dont la **description** contient « git commit » ; (d) `CP_SECRETS_OK=1` accepté n'importe où (message de commit, description, `echo`).

### 4.3 Correction (`tools/claude/verif-secrets.sh`, `.claude/settings.json` inchangé)
En mode `--hook`, le script analyse la **commande** (python3, bibliothèque standard) au lieu de chercher du texte dans le JSON :
- découpe la commande en commandes simples (`&&`, `;`, `|`, lignes, sous-shells), ignore le **texte** (chaînes entre guillemets, corps des documents en ligne `<<EOF`), suit `bash -c "…"` et `eval` ;
- reconnaît `git [options] commit` (`-c`, `-C`, `--no-pager`…, alias git compris) et le dossier visé (`-C`, ou dernier `cd dossier`) ;
- contrôle, pour chaque commit : l'**index** ; les fichiers nommés dans un **`git add`** de la même commande (modifications des fichiers suivis + contenu des non suivis ; `git add -A`, `--all`, `.` = tout le dossier de travail) ; **`git commit -a / --all`** = toutes les modifications des fichiers suivis ; `git commit <fichiers>` = ces fichiers ;
- **`CP_SECRETS_OK=1` n'est reconnu qu'en tête de la commande `git commit`** (`CP_SECRETS_OK=1 git commit …`, comme une vraie variable d'environnement), plus nulle part ailleurs ; la variable posée dans l'environnement du hook n'est plus prise en compte en mode hook ;
- dossier impossible à connaître (chemin dans une variable, `--git-dir`) : **bloqué**, avec le message « Écris le chemin en clair » ;
- commande illisible pour l'analyse (guillemets non fermés) ou python3 absent : contrôle large du dossier courant (index + fichiers suivis modifiés [+ non suivis si python est là]), sans dérogation.
Inchangés : les motifs, les motifs privés `CP_MOTIFS_PRIVES` (lus comme avant), les modes manuels (sans option, `--branche`), le message de blocage.

### 4.4 Rouge → vert (journal `4-hook-rouge-vert.md`)
Banc hors dépôt : deux `git worktree` jetables (`<essai>`, `<propre>`), faux jeton « eyJ » + 30 caractères construit par le banc, **jamais commité** ; motif privé **fictif**. Codes : 0 = la commande passe, 2 = bloquée.

| Cas | Commande (dossier courant = `<essai>` sauf mention) | Ancien script | Nouveau script |
|---|---|---|---|
| T1 témoin : git add propre && git commit | `git add essai-propre.txt && git commit -m essai` | passe (0) | passe (0) |
| T2 témoin : propre indexé, git commit | `git commit -m essai` | passe (0) | passe (0) |
| T3 témoin : -c et -C, propre | `git -C <essai> -c user.name=x commit -m essai` | passe (0) | passe (0) |
| T4 témoin : git commit -a, rien de sale | `git commit -a -m essai` | passe (0) | passe (0) |
| T5 témoin : commande anodine | `ls -la` | passe (0) | passe (0) |
| A1 git -c user.name=x commit | `git -c user.name=x commit -m essai` | passe (0) | **bloqué (2)** |
| A2 git -C dossier commit (cwd ailleurs) | `git -C <essai> commit -m essai` | passe (0) | **bloqué (2)** |
| A3 git --no-pager -c … commit | `git --no-pager -c core.editor=true commit -m essai` | passe (0) | **bloqué (2)** |
| B1 git add f && git commit | `git add essai-secret.txt && git commit -m essai` | passe (0) | **bloqué (2)** |
| B2 git commit -a | `git commit -a -m essai` | passe (0) | **bloqué (2)** |
| B3 git commit --all | `git commit --all -m essai` | passe (0) | **bloqué (2)** |
| B4 git commit -am | `git commit -am essai` | passe (0) | **bloqué (2)** |
| B5 git add -A && git commit | `git add -A && git commit -m essai` | passe (0) | **bloqué (2)** |
| B6 git add . ; git commit | `git add . ; git commit -m essai` | passe (0) | **bloqué (2)** |
| B7 git add docs/ && git commit (suivi modifié) | `git add docs/ && git commit -m essai` | passe (0) | **bloqué (2)** |
| B8 git commit -m x <fichier suivi> | `git commit -m essai docs/APRES-PRO-V1.md` | passe (0) | **bloqué (2)** |
| C1 ls, description « git commit » | `ls -la` | **bloqué (2)** | passe (0) |
| C2 texte en ligne contenant git commit | `cat <<'EOF' ⏎ note : git commit plus tard ⏎ EOF` | **bloqué (2)** | passe (0) |
| C3 grep "git commit" (chaîne entre guillemets) | `grep -rn "git commit" docs \| head -1` | **bloqué (2)** | passe (0) |
| D1 CP_SECRETS_OK=1 dans le message | `git commit -m "voir CP_SECRETS_OK=1 dans la doc"` | passe (0) | **bloqué (2)** |
| D2 CP_SECRETS_OK=1 dans la description | `git commit -m essai` | passe (0) | **bloqué (2)** |
| D3 echo CP_SECRETS_OK=1 && git commit | `echo CP_SECRETS_OK=1 && git commit -m essai` | passe (0) | **bloqué (2)** |
| D4 CP_SECRETS_OK=1 sur le git add seulement | `CP_SECRETS_OK=1 git add essai-secret.txt && git commit -m essai` | passe (0) | **bloqué (2)** |
| D5 CP_SECRETS_OK=1 git commit (voulu) | `CP_SECRETS_OK=1 git commit -m essai` | passe (0) | passe (0) |
| D6 git add f && CP_SECRETS_OK=1 git commit (voulu) | `git add essai-secret.txt && CP_SECRETS_OK=1 git commit -m essai` | passe (0) | passe (0) |
| E1 motif privé (fictif) indexé | `git commit -m essai` | **bloqué (2)** | **bloqué (2)** |
| F1 git commit -F - <<'EOF' (message avec apostrophe) | `git commit -F - <<'EOF' ⏎ l'agenda : essai ⏎ EOF` | **bloqué (2)** | **bloqué (2)** |
| F2 git commit -m "$(cat <<'EOF' …)" | `git commit -m "$(cat <<'EOF' ⏎ l'essai du hook ⏎ EOF ⏎ )"` | **bloqué (2)** | **bloqué (2)** |
| F3 bash -c "git commit -m x" | `bash -c "git commit -m essai"` | **bloqué (2)** | **bloqué (2)** |
| G1 cd dossier && git commit (cwd ailleurs) | `cd <essai> && git commit -m essai` | passe (0) | **bloqué (2)** |
| G2 git -C "$X" commit (dossier inconnu) | `git -C "$X" commit -m essai` | passe (0) | **bloqué (2)** |
| G3 alias git ci = commit | `git ci -m essai` | passe (0) | **bloqué (2)** |

**32 cas, 0 écart à l'attendu.** Lecture : T = témoins (fichier propre : passe toujours) ; A, B, D1 à D4, G = un secret aurait été commité avec l'ancien script, bloqué par le nouveau ; C = l'ancien bloquait **à tort** une commande sans commit (un secret était indexé, la commande ne committait rien), le nouveau la laisse passer ; D5, D6 = dérogation voulue (en tête de la commande `git commit`), gardée ; E1 = motif privé fictif (`CP_MOTIFS_PRIVES`) : bloqué par les deux ; F = formes déjà prises par l'ancien script : toujours bloquées. Modes manuels (sans option, `--branche`, `CP_SECRETS_OK=1` à la main) : mêmes codes avant et après (2 / 0 / 0 avec un secret indexé, 0 avec un fichier propre). Banc rejoué sur le contenu exact du commit `6fa666d` (même empreinte md5 que la copie testée).

### 4.5 Ce que ça change pour Gab / Claude
- Un commit qui ajoute un secret est bloqué quelle que soit la forme de la commande ci-dessus.
- Une commande sans commit n'est plus bloquée parce que sa description parle de commit.
- Faux positif vérifié : `CP_SECRETS_OK=1 git commit …` (en tête), à justifier dans le compte rendu.
- Coût : moins de 0,2 s par commande avec « git » (mesuré : ≈ 0,12 à 0,15 s, création de l'entrée JSON du banc comprise), presque rien pour les autres (sortie immédiate si la commande ne contient pas « git »).

### 4.6 Limites et propositions (décisions de Gab, rien n'est posé)
- Le hook ne voit pas un commit fait **autrement** (script lancé `bash fichier.sh`, outil autre que Bash, alias du shell). C'est pourquoi `bash tools/claude/verif-secrets.sh --branche` reste obligatoire avant le push (CLAUDE.md § 4.7).
- **D1 — `"onFailure": "block"`** sur le hook (`.claude/settings.json`) : un hook qui plante ou dépasse 30 s bloquerait au lieu de laisser passer (doc officielle). Risque : si le script était cassé, **toutes** les commandes Bash seraient bloquées (Claude pourrait encore corriger le fichier avec l'outil d'édition). Mon avis : oui.
- **D2 — barrière au push** (recommandé) : un second hook PreToolUse sur `git push` qui lance `--branche` (toute la branche contre `origin/main`). Il voit les commits faits par **n'importe quel** chemin, au moment où les données deviendraient publiques, et peut **empêcher** le push. Mon avis : oui.
- **D3 bis — PostToolUse** (proposé, moins sûr) : après chaque commande, contrôler les nouveaux commits et prévenir Claude. D'après la doc, il ne peut **rien empêcher** (« the tool already ran ») : un commit fautif resterait dans l'historique local jusqu'à correction. Utile seulement en plus de D2.
- **D4** : le texte des messages de commit (`-m`, `-F`) n'est pas contrôlé (la règle 7 vise aussi les messages). Ajout simple dans le même script, à décider.

---

## 5. Batterie complète et CI
| Passage | Résultat |
|---|---|
| **CI GitHub, run 108**, sur `0c341da` (tout le code et les tests de la branche ; push du 05/11 12:05) | **verte : COMPLET, RÉUSSI — 1 386 réussis, 0 échoué, 2 SKIP (les 2 connus de l'autotest sans `unshare -n`), 5 « À TRANCHER »** |
| CI de `main`, run 83, sur `2e1214b` (04/11, référence) | 1 386 réussis, 0 échoué, 2 SKIP connus, 5 « À TRANCHER » |
| Batterie locale n° 1 sur `0c341da` (arbre propre, `unshare -n`, PostgreSQL 16.15, Chromium 141) | **ÉCHEC — 1 384 réussis, 6 échoués, 0 SKIP, 5 « À TRANCHER »**. Les 6 échecs sont **tous dans la suite P** (P6, rapprochement bancaire : « Nom du client seul dans le libellé : sûr (L’Atelier du Froid) » obtenu « probable », puis 5 contrôles qui en découlent). Toutes les autres suites : mêmes comptes que la CI (Q 64, SQL 66, Y 21 + 5, Z 55, W 64, U 27, AD 101). |
| Suite P seule, 3 fois sur `main` (`2e1214b`) et 3 fois sur `0c341da`, en alternance (12:47 → 12:54) | **138 / 138 les 6 fois** |
| Batterie locale n° 2 sur `0c341da` | **COMPLET, RÉUSSI — 1 390 réussis, 0 échoué, 0 SKIP, 5 « À TRANCHER »** (13:16) ; suite P 138, Q 64 (458 s), SQL 66 ; toutes les suites aux comptes de la CI. 1 390 = 1 386 + 4 : ici l'isolation du noyau (`unshare -n`) existe, l'autotest fait 20 contrôles au lieu de 16 + 2 SKIP en CI. |

**Comptes** : CI de la branche = CI de `main`, **suite par suite**, aux mêmes chiffres (P 138, Q 64, R 42, SQL 66, Y 21 + 5, Z 55, W 64…) : aucun compte ne bouge, comme attendu (seuls des tests et des outils changent, et `tests/sql/test_agenda.py` garde ses 6 tests). Durée de la suite Q en CI : 421 s (442 s sur `main`).
**Échecs de la suite P en local** : la suite P, `tests/lib.mjs`, `tests/env.mjs`, `index.html`, `next-*.js` et `sw.js` sont **identiques** sur cette branche et sur `main` (**certain**, `git diff` vide) : la branche ne peut pas les causer. Suite P seule : 138 / 138 six fois, sur les deux codes ; CI : 138 / 138. **Probable** : aléa de la suite P, qui ne fige pas son horloge (elle lit la vraie date) et n'est jouée qu'une fois dans la batterie ; jamais noté dans les comptes rendus avant (recherche faite). Non creusé (hors périmètre : suite autre que Q et SQL) ; à surveiller, et à traiter dans une mission d'outillage s'il revient.

**Fusions** : deux autres demandes de fusion sont ouvertes (#10 AF1-5, code de l'appli ; #11 dossier P3, documents). Seul fichier en commun avec cette branche : `docs/FILE-DES-MISSIONS.md` ; la ligne d'OUTILLAGE-2 y est placée dans une section à part pour cette raison. Fusion d'essai (`git merge-tree`) : **sans conflit** avec #10, avec #11, et avec #10 puis #11. La file des missions de `main` ne connaît pas encore #10 et #11 et dit #9 « ouverte » alors qu'elle est fusionnée : c'est corrigé dans la branche de #10 (pas ici, hors périmètre).

## 6. Commits de la branche
Un commit par sujet, dans l'ordre où chaque sujet a été prouvé (le test d'abord : pour les sujets 2 et 3, le commit EST le test ; pour le sujet 4, le banc rouge / vert est hors dépôt, faux jeton oblige) :
| Commit | Contenu |
|---|---|
| `3779991` | sujet 2 — `tests/sql/test_agenda.py` |
| `6fa666d` | sujet 4 — `tools/claude/verif-secrets.sh` (fait passer par le nouveau hook lui-même, comme les commits suivants) |
| `c93ee1f` | sujet 3 — `tests/suiteQ-recette.mjs` |
| `0c341da` | sujet 1 — `docs/ENVIRONNEMENT-CLAUDE-CODE.md` |
| (suivant) | ce compte rendu + `docs/FILE-DES-MISSIONS.md` (documents seulement) |

Journaux hors dépôt cités (dossier de travail de la session, perdus avec elle ; les lignes utiles sont recopiées ci-dessus) : `1-faketime-rouge.txt`, `1-faketime-vert.txt`, `2-sql-agenda-rouge.txt`, `2-sql-agenda-vert.txt`, `2-sql-agenda-serveur-truque.txt`, `charge-ancien.txt`, `3-q5-course-provoquee.txt`, `charge-diag*.txt`, `3-q-cinq-passages.txt`, `3-q-sous-charge.txt`, `3-q-charge-forte.txt`, `4-hook-rouge-vert.md`, `5-batterie-complete*.console.txt`, `5-suiteP-seule.txt`.
