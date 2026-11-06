# ClimPilot — Mission OUTILLAGE-3 : hook des secrets (D1, D2, D4) — compte rendu

> Rédigé le 06/11/2026 par Claude (Opus 5.5), **exécutant** de la mission. Relecture à faire par l'autre modèle (Fable 5.1, skill `relecture-p10`).
> Accord écrit de Gab du 06/11/2026, en tête du prompt : D1 oui, D2 oui, D4 oui (D3 et D5 du compte rendu d'OUTILLAGE-2 : déjà faits, rien à faire).
> Branche **`outillage/environnement-3`**, partie de `origin/main` = `297cc7e`. Demande de fusion **#15, en brouillon**. **Aucun code de l'appli ni test de l'appli** (ni `index.html`, ni `next-*.js`, ni `sw.js`, ni `supabase/`, ni `tests/`).
> **Pas d'outil Projects dans cette session** : la copie `claude/ClimPilot-OUTILLAGE-3-compte-rendu.md` dans le Project **n'est pas faite** (geste de Gab ou de la prochaine session qui a l'outil). La mission n'en dépendait pas.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**. Bancs et journaux **hors dépôt** (dossier de travail de la session, effacé avec elle) ; les faux secrets sont construits par le banc, jamais écrits dans le dépôt. Les lignes utiles sont recopiées ici.

## Ce que Gab décide / fait (dans l'ordre)

1. Faire relire la branche par **Fable 5.1** (`relecture-p10`), puis fusionner **#15** si la relecture et la CI sont vertes. Rien à faire sur les appareils (aucun fichier de l'appli, pas de F5).
2. Après la fusion : supprimer la branche `outillage/environnement-3`.
3. **E1 — à confirmer** : trois choix faits sans décision écrite (§ 5). Le principal : un signalement ne recopie plus jamais le texte trouvé, et le contrôle au push lit aussi les messages et les auteurs des commits. **Mon avis : garder.**
4. **E2 — à décider** : 28 anciens commits de `main` (15/07 → 08/10/2026) ont une adresse e-mail personnelle (gmail) comme auteur, 12 comme validateur. Elle est déjà publique ; réécrire l'historique est interdit. Réglage GitHub conseillé, 2 cases à cocher (§ 6.3). **Mon avis : oui.**
5. Pour info : un push vers `main` est maintenant refusé aussi par le hook, y compris `git -C … push origin main` et `git push` lancé depuis `main`, que les règles de permission ne voyaient pas (§ 2.3).
6. Pour info : reprendre la vieille branche `claude/brfr-controle-local` demandera la dérogation au push (données d'essai dans `tests/genxml.mjs`, § 6.4). C'est voulu.

## 0. Ce qui a été fait, en bref

| Sujet | Fichier(s) | Rouge (ancien = `main` `297cc7e`) | Vert (nouveau) |
|---|---|---|---|
| D1 — hook qui plante | `.claude/settings.json`, `docs/ENVIRONNEMENT-CLAUDE-CODE.md` § 4, `CLAUDE.md` (1 phrase, règle 7) | un hook qui plante ou dépasse 30 s laisse passer la commande (doc officielle) ; script absent : code 127, commit non bloqué | `"onFailure": "block"`, plus une garde « script absent » (sinon toutes les commandes Bash seraient bloquées) ; garde essayée en vrai |
| D2 — push | `tools/claude/verif-secrets.sh` | 5 push avec un faux secret sur la branche, 1 push sans `origin/main`, 8 push vers `main` : **tous passent** | **tous bloqués** ; 11 témoins passent |
| D4 — messages de commit | `tools/claude/verif-secrets.sh` | 16 formes de message avec un faux secret, 1 message illisible, 3 auteurs avec une adresse fictive : **tous passent** | **tous bloqués** ; 7 témoins passent |
| Non-régression | — | les 32 cas d'OUTILLAGE-2 | mêmes 32 résultats |

`git diff --stat origin/main...HEAD` : voir § 9.

---

## 1. D1 — le hook qui plante bloque au lieu de laisser passer

### 1.1 Documentation officielle lue (certain)
Page « Hooks reference », https://code.claude.com/docs/en/hooks (l'adresse donnée, docs.claude.com, y redirige), **lue le 06/11/2026**. Claude Code installé ici : 2.1.319.
- Champ `"onFailure"` d'un hook `command` : `"continue"` ou `"block"`, Claude Code 2.1.295 ou plus. Syntaxe : une clé de plus dans l'objet du hook, à côté de `type`, `command`, `timeout`.
- Comptent comme un échec : le hook ne démarre pas (script absent), sort avec un code autre que 0 ou 2, dépasse son délai, ou rend un JSON invalide. Avec `"block"`, un échec fait comme le code 2 : la commande est bloquée.
- Sans ce champ : « a policy hook with a wrong path or a crashing script then lets everything through ».
- Sous Linux, la commande du hook est passée à `sh -c`.
- « Direct edits to hooks in settings files are normally picked up automatically by the file watcher ».

### 1.2 Constat
- **Certain** (lu) : le `.claude/settings.json` de `main` n'a pas `onFailure`. Un plantage ou un délai dépassé laisse donc passer le commit.
- **Certain** (exécuté, § 4.3) : la commande du hook de `main`, lancée par `sh -c` dans un projet **sans** le script, sort en 127 (« ne démarre pas ») pour toute commande : non bloquant d'après la doc, un `git commit` passe sans contrôle.
- **Certain** (déduit de la doc, puis vu en vrai au § 1.4) : poser **seulement** `"onFailure": "block"` aurait un effet de bord grave. Sur une branche sans le script (toutes celles d'avant le 04/11/2026), **toutes** les commandes Bash seraient bloquées, y compris le `git checkout` pour en sortir.

### 1.3 Correction
- `.claude/settings.json` : `"onFailure": "block"` ; `timeout` inchangé (30 s).
- Commande du hook : si `tools/claude/verif-secrets.sh` existe, il est lancé comme avant. Sinon, seule une commande qui contient `git … commit` ou `git … push` est refusée (code 2, avec un message qui dit comment revenir) ; les autres passent.
- Coût mesuré sur le vrai dépôt (**certain**) : 0,01 s (commande sans git) ; 0,04 à 0,09 s (`git status`, `git log`, `git commit`, `git push`).
- Parade documentée : `docs/ENVIRONNEMENT-CLAUDE-CODE.md` § 4 (« Hook qui plante ») et une phrase dans `CLAUDE.md` règle 7. Vérifier à la main (`bash tools/claude/verif-secrets.sh`, `--branche` avant un push), relancer `CP_SECRETS_OK=1 git commit …` seul dans sa commande, le justifier dans le compte rendu. Si même cela est bloqué : s'arrêter et prévenir Gab, ne jamais retirer le hook.
- python3 absent : le script **ne plante pas**, il passe en mode dégradé (déjà le cas depuis OUTILLAGE-2), donc `onFailure` ne joue pas. Amélioré : la dérogation y est maintenant acceptée pour une commande simple. Avant, elle était refusée et un faux positif ne pouvait plus passer du tout.

### 1.4 Rouge → vert
Commande du hook telle qu'écrite dans `.claude/settings.json`, lancée par `sh -c` avec le JSON du hook sur l'entrée standard (**certain**, banc `banc-manuel.sh`) :

| Projet | Commande Bash | Code, commande de `main` | Code, nouvelle commande |
|---|---|---|---|
| sans le script | `ls -la` | 127 (non bloquant : passe) | 0 (passe) |
| sans le script | `git status --short` | 127 (non bloquant : passe) | 0 (passe) |
| sans le script | `git commit -m propre` | 127 (non bloquant : **passe sans contrôle**) | **2 (bloqué)** |
| sans le script | `git push origin outillage/essai` | 127 (non bloquant : **passe sans contrôle**) | **2 (bloqué)** |
| avec le script | les mêmes 4 commandes, dépôt propre | 0 | 0 |

**En vrai, dans cette session** (**certain**) :
- le nouveau réglage a été repris à chaud : le message de la garde est apparu sans redémarrer la session ;
- script mis de côté un instant : `ls -la …` passe ; `git -C <dépôt jetable> commit --allow-empty …` est refusé avec le message de la garde (« tools/claude/verif-secrets.sh introuvable … ») ; script remis (même empreinte md5) ;
- les 3 commits et le push de la branche sont passés par le nouveau hook.

**Non vérifié en vrai** : le blocage d'un vrai plantage ou d'un délai dépassé. J'ai voulu poser un hook d'essai temporaire (un qui sort en 1, un qui dépasse son délai) dans les réglages utilisateur du conteneur ; le contrôle des permissions de la session l'a refusé et je ne l'ai pas contourné. Ce blocage repose donc sur la doc officielle : **probable**.

---

## 2. D2 — contrôle au `git push`

### 2.1 Constat (certain, exécuté sur l'ancien script)
- L'ancien hook ne regardait pas `git push`. Un commit fait autrement (script lancé, autre outil, commit sans le hook) arrivait sur GitHub sans contrôle.
- `bash tools/claude/verif-secrets.sh --branche` sans `origin/main` (dépôt pas encore mis à jour par `git fetch`) sortait en 0 **sans rien contrôler** (`git diff` en erreur, silencieux).
- `--branche` ne lisait ni les messages ni les auteurs des commits, publics eux aussi.
- Push vers `main` : les règles de permission (`git push * main`, `*:main*`…) ne voient ni `git -C dossier push origin main` (la commande ne commence pas par `git push`), ni `git push` lancé depuis la branche `main`. Vu en vrai : `git -C <dépôt jetable> push origin main` est arrivé jusqu'au hook (qui l'a bloqué), alors qu'un `git push -q origin main` de ma commande de préparation a été arrêté par la règle de permission.

### 2.2 Correction (`tools/claude/verif-secrets.sh`)
- `git push`, sous toutes les formes déjà suivies pour `git commit` (`-C`, `cd`, alias, `bash -c`, `eval`) : pour chaque révision poussée (la branche courante si aucune n'est nommée ; refspecs `a:b` ; `--all`, `--tags`), **le même contrôle que `--branche`** : lignes ajoutées depuis `origin/main`, message, auteur et validateur de chaque commit absent de `origin/main`.
- `origin/main` introuvable : bloqué, avec « Lance git fetch origin main » (au push et à la main).
- **Push vers `main` refusé, sans dérogation** : destination `main` ou `refs/heads/main` (`main`, `HEAD:main`, `x:refs/heads/main`), suppression (`:main`, `--delete`), `--all` / `--mirror` / `--branches` (et `push.default=matching`) quand une branche locale `main` existe, `git push` sans branche lancé depuis `main` (ou `push.default=upstream` qui viserait `main`).
- Dérogation pour un faux positif vérifié : `CP_SECRETS_OK=1 git push …`, en tête. Elle ne lève jamais le refus vers `main`.
- `git push -n` (essai à blanc) : rien n'est publié, rien n'est contrôlé.

### 2.3 Réponse à la question « bloquer aussi le push sur main par le hook »
**Fait**, sans fausse alerte sur les témoins du banc (**certain**) : branches `maintenance` et `outillage/main-notes`, étiquette `v1`, `echo git push origin main`, `git log origin/main..HEAD`, `git pull origin main`, `git fetch origin main`. Vu bloqué en vrai : `git -C <dépôt jetable> push origin main`.
Limite (**hypothèse** d'usage rare) : un texte envoyé à un autre programme qui l'exécute (`echo git push origin main | sh`) n'est pas vu. La protection de `main` sur GitHub reste la vraie barrière.

---

## 3. D4 — texte des messages de commit

### 3.1 Constat (certain, exécuté sur l'ancien script)
L'ancien hook ne lisait jamais le message : il retirait même le corps des documents en ligne (`<<'EOF' … EOF`) avant l'analyse. Les 16 formes du banc avec un faux secret (groupe M, M1 à M16, § 4.1) passent, et un message illisible (M17) aussi.

### 3.2 Correction (`tools/claude/verif-secrets.sh`)
- Texte lu, avec **les mêmes motifs** (jeton « eyJ… », clés « sk-ant- » et « sb_secret_ », clé privée, IBAN et FR76, adresses gmail / hotmail / orange…, téléphones mobiles, motifs privés `CP_MOTIFS_PRIVES`) :
  - `-m` (répété, collé `-mTEXTE`, dans un groupe `-am`), `--message=`, `--message TEXTE` et ses abréviations acceptées par git (`--mess=`) ;
  - `-F fichier` (chemin relatif au dossier de `git -C`, comme git), y compris un fichier écrit plus tôt dans la même commande (`cat > f <<'EOF'`, `echo … > f`) ;
  - `-F -` : document en ligne `<<'EOF'`, `<<<`, `< fichier`, `echo` / `printf` / `cat … |` ;
  - `-m "$(cat <<'EOF' … EOF)"` (la forme habituelle de Claude Code) ;
  - `-t` (modèle), `-C` / `-c` (message repris d'un commit), `--trailer`, `--author`.
- Message lu sur la sortie d'une autre commande (`git log … | git commit -F -`) : **bloqué**, avec « écris le message avec -m, -F fichier, ou -F - <<'EOF' ».
- **En plus (trouvé en relisant mon code)** : l'auteur et le validateur qu'aura le commit (`git var`, avec les `-c user.*` et `GIT_AUTHOR_*` de la commande). Sans cela, dans `git commit … && git push`, un auteur avec une adresse personnelle n'était vu ni au commit (pas lu) ni au push (le hook relit la branche **avant** le commit). Cas M18 à M20 du banc.
- Le message de blocage nomme le motif et l'endroit (`[message -m n°2], ligne 1 : adresse e-mail personnelle …`), **jamais le texte trouvé**.
- Dérogation inchangée : `CP_SECRETS_OK=1 git commit …` en tête (elle couvre aussi le message).

### 3.3 Limites
- `$VAR` et `$(commande)` (autre que `cat <<EOF`) ne sont pas développés : le texte est contrôlé tel qu'écrit. Un message tapé dans un éditeur n'est pas lu. Le contrôle au push relit ensuite les **vrais** messages des commits : il rattrape ces cas (**certain**, cas P2 du banc).
- Les messages de `git merge -m` et `git tag -m` ne sont pas lus au commit. Ceux des commits de fusion sont relus au push ; ceux des étiquettes annotées ne le sont pas (**hypothèse** : aucun usage ici).

---

## 4. Bancs rouge → vert (hors dépôt)

Banc jetable, comme OUTILLAGE-2 : dépôt temporaire dans le dossier de travail de la session, avec un dépôt `origin` local, une branche `outillage/essai` et `origin/main`. Faux secrets construits par le banc : jeton « eyJ » + 40 caractères, adresse gmail fictive, faux numéro en 06, faux IBAN FR76, fausse clé « sk-ant- », motif privé **fictif** (variable `CP_MOTIFS_PRIVES` du banc). JSON du hook sur l'entrée standard (`tool_input.command`, `description`, `cwd`) ; codes : **0 = passe, 2 = bloqué**. Ancien = `tools/claude/verif-secrets.sh` de `main` (`297cc7e`) ; nouveau = celui du commit `c486092` (même empreinte md5 que la copie testée ; `752ebd6` sans le contrôle de l'auteur au commit a donné les mêmes résultats sur les 90 cas d'alors). Avant chaque cas, l'état du dépôt est remis à zéro.

### 4.1 Hook (banc `banc.py`, 96 cas)
Groupes : **R** = les 32 cas d'OUTILLAGE-2 (non-régression) ; **M** = messages (D4), index propre : seul le message peut bloquer ; **P** = push (D2), le faux secret est commité **sans** passer par le hook ; **PM** = push vers `main` (D2) ; **H** = python3 absent (D1, mode dégradé), simulé par un faux `python3` qui sort en 127.

| Groupe | Cas | Ancien (main) | Nouveau | Attendu | |
|---|---|---|---|---|---|
| R | T1 témoin : git add propre && git commit | passe (0) | passe (0) | passe (0) | OK |
| R | T2 témoin : propre indexé, git commit | passe (0) | passe (0) | passe (0) | OK |
| R | T3 témoin : -c et -C, propre | passe (0) | passe (0) | passe (0) | OK |
| R | T4 témoin : git commit -a, rien de sale | passe (0) | passe (0) | passe (0) | OK |
| R | T5 témoin : commande anodine | passe (0) | passe (0) | passe (0) | OK |
| R | A1 git -c user.name=x commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | A2 git -C dossier commit (cwd ailleurs) | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | A3 git --no-pager -c … commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B1 git add f && git commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B2 git commit -a | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B3 git commit --all | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B4 git commit -am | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B5 git add -A && git commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B6 git add . ; git commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B7 git add docs/ && git commit (suivi modifié) | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | B8 git commit -m x <fichier suivi> | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | C1 ls, description « git commit » | passe (0) | passe (0) | passe (0) | OK |
| R | C2 texte en ligne contenant git commit | passe (0) | passe (0) | passe (0) | OK |
| R | C3 grep "git commit" (chaîne entre guillemets) | passe (0) | passe (0) | passe (0) | OK |
| R | D1 CP_SECRETS_OK=1 dans le message | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | D2 CP_SECRETS_OK=1 dans la description | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | D3 echo CP_SECRETS_OK=1 && git commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | D4 CP_SECRETS_OK=1 sur le git add seulement | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | D5 CP_SECRETS_OK=1 git commit (voulu) | passe (0) | passe (0) | passe (0) | OK |
| R | D6 git add f && CP_SECRETS_OK=1 git commit (voulu) | passe (0) | passe (0) | passe (0) | OK |
| R | E1 motif privé (fictif) indexé | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | F1 git commit -F - <<'EOF' (apostrophe) | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | F2 git commit -m "$(cat <<'EOF' …)" | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | F3 bash -c "git commit -m x" | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | G1 cd dossier && git commit (cwd ailleurs) | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | G2 git -C "$X" commit (dossier inconnu) | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| R | G3 alias git ci = commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| M | M1 -m avec faux jeton eyJ | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M2 -m répété, le 2e avec une adresse gmail fictive | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M3 -F fichier (faux IBAN FR76) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M4 -F - <<'EOF' (faux numéro 06) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M5 --message= (fausse clé sk-ant) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M6 -m "$(cat <<'EOF' …)" (faux IBAN) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M7 --message <texte> (motif privé fictif) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M8 -am <texte> (faux jeton) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M9 -m<texte> collé (faux jeton) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M10 cat > f <<EOF … && git commit -F f (fichier écrit par la même commande) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M11 echo … \| git commit -F - | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M12 git commit -F - <<< texte | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M13 --mess= (abréviation acceptée par git) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M14 --author avec adresse gmail fictive | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M15 --trailer avec adresse gmail fictive | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M16 git -C dossier commit -m (cwd ailleurs) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M17 message lu sur la sortie d'une autre commande (illisible) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M18 git -c user.email=<adresse gmail fictive> commit | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M19 GIT_AUTHOR_EMAIL=<adresse gmail fictive> git commit | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | M20 adresse gmail fictive dans la configuration, git commit && git push | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| M | TM1 témoin : message propre (mots IBAN, gmail sans adresse) | passe (0) | passe (0) | passe (0) | OK |
| M | TM2 témoin : -F - <<'EOF' propre (apostrophe) | passe (0) | passe (0) | passe (0) | OK |
| M | TM3 témoin : -F fichier propre | passe (0) | passe (0) | passe (0) | OK |
| M | TM4 témoin : dérogation CP_SECRETS_OK=1 en tête (faux jeton dans le message) | passe (0) | passe (0) | passe (0) | OK |
| M | TM5 témoin : git log, description « git commit » | passe (0) | passe (0) | passe (0) | OK |
| M | TM6 témoin : texte cité, pas de commit | passe (0) | passe (0) | passe (0) | OK |
| M | TM7 témoin : -m "$(cat <<'EOF' …)" propre | passe (0) | passe (0) | passe (0) | OK |
| P | P1 push, faux jeton dans un fichier commité | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| P | P2 push, adresse gmail fictive dans un message commité | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| P | P3 push, auteur avec adresse gmail fictive | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| P | P4 git -C dossier push (cwd ailleurs) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| P | P5 cd dossier && git push (sans branche nommée) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| P | P6 git push sans origin/main (base inconnue) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| P | TP1 témoin : push d'une branche propre | passe (0) | passe (0) | passe (0) | OK |
| P | TP2 témoin : dérogation CP_SECRETS_OK=1 git push | passe (0) | passe (0) | passe (0) | OK |
| P | TP3 témoin : git push -n (essai à blanc) | passe (0) | passe (0) | passe (0) | OK |
| P | TP4 témoin : git fetch origin main | passe (0) | passe (0) | passe (0) | OK |
| P | TP5 témoin : git log, description « git push » | passe (0) | passe (0) | passe (0) | OK |
| PM | PM1 git push origin main | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM2 git push origin HEAD:main | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM3 git -C dossier push origin main (hors règles de permission) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM4 git push depuis la branche main | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM5 git push origin x:refs/heads/main | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM6 git push --all origin | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM7 CP_SECRETS_OK=1 git push origin main (pas de dérogation) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | PM8 git push origin :main (suppression) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| PM | TPM1 témoin : push de la branche « maintenance » | passe (0) | passe (0) | passe (0) | OK |
| PM | TPM2 témoin : push de « outillage/main-notes » | passe (0) | passe (0) | passe (0) | OK |
| PM | TPM3 témoin : echo git push origin main | passe (0) | passe (0) | passe (0) | OK |
| PM | TPM4 témoin : git log origin/main..HEAD | passe (0) | passe (0) | passe (0) | OK |
| PM | TPM5 témoin : git push origin v1 (étiquette) | passe (0) | passe (0) | passe (0) | OK |
| PM | TPM6 témoin : git pull origin main | passe (0) | passe (0) | passe (0) | OK |
| H | H1 sans python3 : faux jeton indexé, git commit | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| H | H2 sans python3 : faux jeton dans le message seulement | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| H | H3 sans python3 : push, faux jeton commité | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| H | H4 sans python3 : dérogation simple (CP_SECRETS_OK=1 git commit -m …) | bloqué (2) | **passe (0)** | passe (0) | OK |
| H | H5 sans python3 : dérogation dans une commande composée (refusée) | bloqué (2) | bloqué (2) | bloqué (2) | OK |
| H | H6 sans python3 : push depuis main | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| H | H7 sans python3 ni jq : faux jeton dans le message (texte lu par sed) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| H | H8 sans python3 ni jq : dérogation simple | bloqué (2) | **passe (0)** | passe (0) | OK |
| H | H9 sans python3 ni jq : message en document en ligne (adresse fictive) | passe (0) | **bloqué (2)** | bloqué (2) | OK |
| H | TH1 témoin sans python3 : commit propre | passe (0) | passe (0) | passe (0) | OK |
| H | TH2 témoin sans python3 : commande sans git | passe (0) | passe (0) | passe (0) | OK |
| H | TH3 témoin sans python3 : git status | passe (0) | passe (0) | passe (0) | OK |

**96 cas, 0 écart(s) à l'attendu ; faux secret recopié dans un message du nouveau script : 0 fois.**

### 4.2 Modes manuels (banc `banc-manuel.sh`, 9 cas)

| Mode manuel | Ancien | Nouveau | Attendu | | Secret recopié (nouveau) |
|---|---|---|---|---|---|
| sans option, faux jeton indexé | 2 | 2 | 2 | OK | non |
| sans option, fichier propre indexé | 0 | 0 | 0 | OK | non |
| sans option, CP_SECRETS_OK=1, faux jeton indexé | 0 | 0 | 0 | OK | non |
| --branche, faux jeton commité | 2 | 2 | 2 | OK | non |
| --branche, branche propre | 0 | 0 | 0 | OK | non |
| --branche, adresse fictive dans un MESSAGE commité | 0 | 2 | 2 | OK | non |
| --branche, adresse fictive en AUTEUR du commit | 0 | 2 | 2 | OK | non |
| --branche, origin/main absent | 0 | 2 | 2 | OK | non |
| --branche, CP_SECRETS_OK=1, faux jeton commité | 0 | 0 | 0 | OK | non |

### 4.3 Commande du hook dans `.claude/settings.json` (D1)
Voir le tableau du § 1.4.

### 4.4 En vrai, dans cette session (hook réel de Claude Code)
| Commande | Résultat |
|---|---|
| `git -C <dépôt jetable> commit -m "essai en vrai : <faux jeton eyJ…>"` | **bloqué** : `[message -m n°1], ligne 1 : jeton JWT (eyJ…)` |
| `git -C <dépôt jetable> push origin main` | **bloqué** : « push vers main refusé (CLAUDE.md règle 3.1 …) : main » |
| `git -C <dépôt jetable> commit -q -m "message propre"` (témoin) | passe |
| script mis de côté : `ls -la …` puis `git -C <dépôt jetable> commit --allow-empty …` | `ls` passe ; commit **bloqué** par la garde |
| les 3 commits de cette branche, `git push -u origin outillage/environnement-3` | passés par le nouveau hook, code 0 |

**Lecture.** Rouge → vert : 20 cas de message et d'auteur (M1 à M20), 6 cas de push (P1 à P6), 8 push vers `main` (PM1 à PM8), les cas sans python3 où l'ancien laissait passer (H2, H3, H6, H7, H9) et 3 cas manuels (`--branche` : message, auteur, `origin/main` absent). H4 et H8 sont l'inverse : l'ancien **bloquait** une dérogation simple sans python3, le nouveau l'accepte. Les 32 cas d'OUTILLAGE-2 et tous les témoins donnent le même résultat qu'avant. **Aucun message du nouveau script ne recopie un faux secret** ; ceux de l'ancien le recopiaient (ligne entière).

---

## 5. Choix faits sans décision écrite (E1, à confirmer)
1. **Le texte trouvé n'est plus jamais recopié.** D4 l'exigeait pour les messages ; je l'ai appliqué aussi aux fichiers et au mode manuel. L'ancien script recopiait la ligne entière, secret compris, dans la conversation (donc dans le journal de la session). Effet : pour vérifier, il faut ouvrir le fichier à la ligne indiquée.
2. **`--branche` lit aussi les messages, auteurs et validateurs des commits**, et bloque si `origin/main` manque. Le push est le moment où ils deviennent publics, et c'est ce qui rattrape les limites du contrôle au commit (§ 3.3). Effet possible : si Gab fait un commit sur une branche de mission depuis GitHub avec une adresse personnelle, le push suivant de Claude sur cette branche sera bloqué (dérogation et justification). Le réglage du § 6.3 l'évite.
3. **Détails** : les abréviations d'options de git sont reconnues (`--mess=`) ; une commande qui ne fait qu'afficher du texte (`echo`, `printf`, `grep`, `cat`…) n'est plus prise pour un `git` (évite la fausse alerte sur `echo git push origin main`). Si `CP_MOTIFS_PRIVES` contient une expression régulière fautive, le contrôle bloque au lieu de passer sans rien dire.

---

## 6. Batterie, CI, autres constats

### 6.1 Batterie locale
| Passage | Résultat |
|---|---|
| **Batterie locale** sur `577a101` (tout le code et les tests de la branche ; arbre propre ; `unshare -n`, PostgreSQL 16, Chromium 141), 06/11 à 22 h 37 | **COMPLET, RÉUSSI — 1 404 réussis, 0 échoué, 0 SKIP, 5 « À TRANCHER »** ; suite P 138, Q 64 (433 s), SQL 66, W 64, Y 21 + 5, Z 55, AD 115 |
| CI de `main`, sur `297cc7e` (05/11, référence) | 1 400 réussis, 0 échoué, 2 SKIP connus, 5 « À TRANCHER » |

**Certain** : 1 404 = 1 400 + 4 : ici l'isolation du noyau (`unshare -n`) existe, l'autotest fait 20 contrôles au lieu de 16 + 2 SKIP en CI (même écart qu'OUTILLAGE-2). Toutes les autres suites ont les comptes de la CI de `main`, suite par suite. Le commit suivant (`c486092`) ne change que `tools/claude/verif-secrets.sh`, qu'aucun test ne lit (**certain**, recherche dans `tests/` et `.github/`) ; la CI le rejoue de toute façon (§ 6.2).

### 6.2 CI de la branche
| Passage | Résultat |
|---|---|
| **CI GitHub, run 42303433288**, sur `577a101` (push du 06/11 au soir) | **verte : COMPLET, RÉUSSI — 1 400 réussis, 0 échoué, 2 SKIP (les 2 connus de l'autotest sans `unshare -n`), 5 « À TRANCHER »** |
| CI de `main` sur `297cc7e` (référence) | 1 400 réussis, 0 échoué, 2 SKIP connus, 5 « À TRANCHER » |

**Certain** : comptes identiques **suite par suite** (comparaison des deux rapports). Durée de la suite Q : 421 s (436 s sur `main`).
La CI du dernier commit de la branche (complément `c486092` + ce compte rendu, aucun test ni fichier de l'appli) est notée dans la description de la demande de fusion #15 et dans `docs/FILE-DES-MISSIONS.md`.

**Fusions** : les deux autres demandes ouvertes (#13 et #14, documents) ne touchent ni `docs/FILE-DES-MISSIONS.md` ni aucun fichier de cette branche (**certain**, `git diff --stat`).

### 6.3 Adresse personnelle dans l'historique de `main` (E2)
- **Certain** (lu, sans afficher l'adresse) : dans l'historique de `main`, une seule adresse gmail apparaît : 28 fois comme auteur (27 commits ordinaires, 1 fusion faite sur GitHub) et 12 fois comme validateur, du 15/07/2026 au 08/10/2026. Les autres adresses sont `anthropic.com` (332), `github.com` (24) et `users.noreply.github.com` (10).
- Elle est **déjà publique** (dépôt public). Réécrire l'historique publié est interdit (règle 3.1) : rien à faire dans le dépôt.
- **Probable** : c'est l'adresse du compte GitHub de Gab, utilisée avant que la règle « adresse noreply » existe.
- Geste conseillé (≈ 2 min), pour que les prochains commits et fusions faits sur GitHub ne la portent plus :
  1. github.com → photo de profil → **Settings** → **Emails**.
  2. Cocher **« Keep my email addresses private »**.
  3. Cocher **« Block command line pushes that expose my email »**.
  4. **Attendu** : la page affiche une adresse en `…@users.noreply.github.com`. Les prochaines fusions faites sur GitHub la porteront à la place de l'adresse gmail.

### 6.4 Vieille branche `claude/brfr-controle-local`
**Certain** (nouveau contrôle au push lancé sur toutes les branches distantes non fusionnées) : seule `claude/brfr-controle-local` (1 commit, 05/10/2026) serait bloquée au push : `tests/genxml.mjs`, ligne 7, motifs « IBAN français » et « téléphone mobile ». **Probable** : données d'essai (la ligne cite « rue de l'Exemple » et une adresse en `exemple.fr`). Si cette branche est reprise : vérifier la ligne, puis `CP_SECRETS_OK=1 git push …`, justifié. `claude/login-password-issue-f7cidd` passe.

---

## 7. Ce que ça change pour Gab
- Rien dans l'appli. Rien sur les appareils.
- Un secret ou une donnée personnelle dans un **message** de commit est arrêté avant le commit.
- Au **push**, toute la branche est relue (fichiers, messages, auteurs), quelle que soit la façon dont les commits ont été faits.
- Un push vers `main` par une session Claude est refusé par le hook, même dans les formes que les règles de permission ne voyaient pas.
- Si le contrôle plante, la commande est arrêtée au lieu de passer ; la session sait quoi faire (§ 4 de `docs/ENVIRONNEMENT-CLAUDE-CODE.md`).
- Les messages de blocage ne recopient plus le secret dans la conversation.

## 8. Ce qui n'a pas pu être vérifié
- Le blocage par Claude Code d'un **vrai** plantage ou d'un délai dépassé (§ 1.4) : **probable** (doc officielle), pas essayé en vrai.
- Les « threads » des Projects de Claude Code n'appliquent pas les hooks du dépôt (doc lue par OUTILLAGE, 03/11/2026) : rien ne change pour eux.

## 9. Commits et fichiers
Un commit par sujet ; les bancs rouge / vert sont hors dépôt (faux secrets obligent).

| Commit | Contenu |
|---|---|
| `752ebd6` | D2 et D4 — `tools/claude/verif-secrets.sh` (déjà passé par le nouveau script, via le hook) |
| `577a101` | D1 — `.claude/settings.json`, `docs/ENVIRONNEMENT-CLAUDE-CODE.md` § 4, `CLAUDE.md` (1 phrase) |
| `c486092` | D4, complément — auteur et validateur contrôlés au commit (§ 3.2) |
| (suivant) | ce compte rendu + 1 ligne dans `docs/FILE-DES-MISSIONS.md` (section « Outillage ») |

`git diff --stat origin/main...HEAD` (6 fichiers, tous dans le périmètre ; aucun fichier de l'appli, aucun test) :
```
 .claude/settings.json             |   5 +-
 CLAUDE.md                         |   2 +-
 docs/ENVIRONNEMENT-CLAUDE-CODE.md |  18 +-
 docs/FILE-DES-MISSIONS.md         |   1 +
 docs/OUTILLAGE-3-COMPTE-RENDU.md  | (ce document)
 tools/claude/verif-secrets.sh     | 568 +++++++++++++++++++++++++++++++-------
```
Contrôle des secrets : `bash tools/claude/verif-secrets.sh` avant chaque commit et `--branche` avant chaque push, avec les motifs privés de l'environnement → code 0. Aucun `CP_SECRETS_OK=1` utilisé dans cette mission.

Journaux hors dépôt (dossier de travail de la session, perdus avec elle ; les lignes utiles sont recopiées ci-dessus) : `banc/banc.py`, `banc/banc-manuel.sh`, `banc/run-1.md`, `banc/run-2.md` (détail des messages, ancien et nouveau), `banc/run-manuel.md`, `batterie/rapport.md`, `batterie.console.txt`, `ci-577a101.md`, `ci-main.md`.
