# ClimPilot : environnement des sessions Claude Code dans le cloud

> Créé le 03/11/2026 par la mission OUTILLAGE (dossier du 01/11/2026), complété le 05/11/2026 par OUTILLAGE-2 (faketime au § 2 et au § 3, hook des secrets au § 4). Ce fichier ne contient ni secret ni donnée personnelle.
> À relire si une session annonce qu'il manque Chromium, PostgreSQL ou les validateurs. La CI (`.github/workflows/tests.yml`, contrôle « batterie complète ») fait foi.

## 1. Réglages de l'environnement (gestes de Gab, dans claude.ai/code)
Ouvrir les réglages de l'environnement utilisé pour ClimPilot.

1. **Network access** : `Custom`.
   - Cocher **« Also include default list of common package managers »**.
   - Dans **Allowed domains**, une ligne par domaine (les 2 hôtes de téléchargement de Playwright 1.56.1) :
     ```
     cdn.playwright.dev
     playwright.download.prss.microsoft.com
     ```
   - **Ne pas choisir `Full`** : une session qui lirait une page piégée pourrait envoyer des données n'importe où.
2. **Setup script** : coller le script du § 2 en entier. Il tourne à la création de l'environnement ; son journal est `~/setup-climpilot.log`.
3. **Variables d'environnement** (facultatif) : `CP_MOTIFS_PRIVES=` suivi des motifs privés de Gab (rue, ville, e-mails perso), séparés par `|`.
   - `tools/claude/verif-secrets.sh` les cherche dans les lignes ajoutées, sans qu'ils soient écrits dans le dépôt.
   - **Jamais** de clé ni de mot de passe dans ces variables.

## 2. Script d'installation (champ « Setup script »)

```bash
#!/bin/bash
# ClimPilot : outillage des sessions Claude Code dans le cloud.
# Miroir de .github/workflows/tests.yml (versions épinglées). Durée visée : moins de 5 minutes.
# Journal : ~/setup-climpilot.log ; variables : ~/.climpilot-env.sh (à charger avant la batterie).
set -u
O="$HOME/outils"; LOG="$HOME/setup-climpilot.log"; mkdir -p "$O"; : > "$LOG"

# 1) Playwright 1.56.1 + Chromium 141 (exige cdn.playwright.dev et playwright.download.prss.microsoft.com dans « Allowed domains »)
( npm i -g playwright@1.56.1 \
  && { npx -y playwright@1.56.1 install --with-deps chromium || npx -y playwright@1.56.1 install chromium; } \
  && echo "OK playwright" || echo "ECHEC playwright" ) >>"$LOG" 2>&1 &

# 2) Modules Python des validateurs et des tests SQL
( pip install -q --break-system-packages pytest==9.1.1 "psycopg[binary]==3.3.6" factur-x==7.1 lxml==6.1.3 saxonche==13.0.0 \
  && echo "OK python" || echo "ECHEC python" ) >>"$LOG" 2>&1 &

# 3) Validateurs CEN EN 16931 et FNFE BR-FR (mêmes versions que la CI)
( { [ -d "$O/eInvoicing-EN16931" ] || git clone -q --depth 1 --branch validation-1.3.16 https://github.com/ConnectingEurope/eInvoicing-EN16931 "$O/eInvoicing-EN16931"; } \
  && { [ -d "$O/France_RFE" ] || git clone -q --depth 1 --branch v1.4.0.04 https://github.com/fnfempe/France_RFE "$O/France_RFE"; } \
  && echo "OK validateurs" || echo "ECHEC validateurs" ) >>"$LOG" 2>&1 &

# 4) PostgreSQL 16 local : base créée dans /opt/climpilot-pg (gardée en cache ; /root n'est pas lisible par l'utilisateur postgres), démarrée à chaque session par ~/climpilot-pg.sh
( D=/opt/climpilot-pg; mkdir -p "$D"; chown postgres:postgres "$D"; chmod 755 "$D"
  [ -d "$D/data" ] || runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb -D "$D/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null \
  && echo "OK postgresql" || echo "ECHEC postgresql" ) >>"$LOG" 2>&1 &

wait

# 5) faketime (CLAUDE.md règle 9 : batterie rejouée un samedi, un dimanche et le 05/01 de l'année suivante).
#    APRÈS le « wait » : Playwright --with-deps se sert aussi d'apt, et apt ne tourne qu'une fois à la fois.
{ command -v faketime >/dev/null || apt-get install -y -qq faketime || { apt-get update -qq && apt-get install -y -qq faketime; }; } >>"$LOG" 2>&1
faketime --version >>"$LOG" 2>&1 && echo "OK faketime" >>"$LOG" || echo "ECHEC faketime" >>"$LOG"

cat > "$HOME/climpilot-pg.sh" <<EOF
#!/bin/bash
# Démarre le PostgreSQL local des tests (socket seulement, aucune écoute réseau), comme la CI.
D=/opt/climpilot-pg
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D "\$D/data" -l "\$D/log.txt" -w status >/dev/null 2>&1 \
  || runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D "\$D/data" -l "\$D/log.txt" -w start -o "-p 54329 -k \$D -c listen_addresses= -c cluster_name=climpilot-test"
psql -h "\$D" -p 54329 -U postgres -tAc "show cluster_name"
EOF
chmod +x "$HOME/climpilot-pg.sh"

cat > "$HOME/.climpilot-env.sh" <<EOF
export EN16931_XSLT="$O/eInvoicing-EN16931/cii/xslt/EN16931-CII-validation.xslt"
export BRFR_DIR="$O/France_RFE"
export PGHOST=/opt/climpilot-pg
export PGPORT=54329
export CP_TEST_OUT="\${CP_TEST_OUT:-/tmp/climpilot-tests}"
EOF

# bilan : -o, car les écritures en parallèle collent parfois « OK … » au bout d'une ligne d'apt (« Reading package lists...OK python »)
echo "--- bilan" >>"$LOG"; grep -oE "(OK|ECHEC) (playwright|python|validateurs|postgresql|faketime)" "$LOG"
```

Piège déjà rencontré : sans `-E UTF8`, PostgreSQL crée une base SQL_ASCII, et le garde des tests refuse la cible (`cluster_name = b'climpilot-test'`).

## 3. Vérification au début de chaque session (étape A de la mission OUTILLAGE)
1. Démarrer PostgreSQL et charger les variables :
   ```bash
   bash ~/climpilot-pg.sh && source ~/.climpilot-env.sh
   ```
   Attendu : la dernière ligne affiche `climpilot-test`. Si `~/climpilot-pg.sh` ou `~/.climpilot-env.sh` manque, le setup script n'a pas tourné : le dire à Gab et rejouer le script du § 2 dans la session.
2. Vérifier les outils :
   - `npx playwright@1.56.1 --version` → `Version 1.56.1` ;
   - Chromium 141 de Playwright présent : `ls -d "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"/chromium-1194` (l'environnement cloud pose `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` ; sans cette variable, Playwright range ses navigateurs dans `~/.cache/ms-playwright`) ;
   - `python3 -c "import saxonche, facturx, psycopg, lxml, pytest"` → aucune erreur ;
   - `ls "$EN16931_XSLT" "$BRFR_DIR"` → les deux existent ;
   - `unshare -n true` → aucune erreur. Sinon, lancer la batterie avec `CP_SANS_NETNS=1`, comme la CI ;
   - `faketime --version` → `faketime: Version 0.9.10` (Ubuntu 24.04). Sinon : `apt-get install -y faketime`, et dire à Gab que le setup script du § 2 n'est pas à jour (ligne « 5) faketime »).
3. Batterie complète : `bash tests/run-all.sh`, puis lire `rapport.md` (dossier `CP_TEST_OUT`). Comparer avec le rapport de la CI du même commit :
   ```bash
   gh api repos/gablry8/cp-gl2607/commits/<sha>/check-runs --jq '.check_runs[]|select(.name|startswith("rapport"))|.output.text'
   ```
4. S'il manque Chromium : le message de Playwright nomme l'hôte refusé (exemple lu le 01/11 : `request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"`). C'est le réglage « Allowed domains » du § 1 qui manque.

Chrome 153, préinstallé sur certaines machines, ignore `emulateNetworkConditions{offline:false}` sous `unshare -n` : ne pas s'en servir pour conclure ; Chromium 141 de Playwright ou la CI.

Indépendance du jour (CLAUDE.md règle 9), ajouté le 05/11/2026 (OUTILLAGE-2) :
```bash
for d in "2026-11-07 10:00:00" "2026-11-08 10:00:00" "2027-01-05 10:00:00"; do faketime "$d" bash tests/run-all.sh; done   # samedi, dimanche, 05/01 suivant
```
Adapter les dates à l'année en cours. `faketime` truque l'horloge des programmes qu'il lance (Node, Python, Chromium), **pas** celle du PostgreSQL local, démarré avant par `~/climpilot-pg.sh` : un test SQL ne doit jamais mélanger la date de Python et `current_date` du serveur (piège corrigé dans `tests/sql/test_agenda.py`, OUTILLAGE-2).

## 4. Bon à savoir dans une session cloud
- `gh pr list` et `gh pr view` échouent (`HTTP 403: GitHub GraphQL is not available from Claude Code sessions`, lu le 03/11). Utiliser l'API REST : `gh api 'repos/gablry8/cp-gl2607/pulls?state=all&per_page=30'`.
- Hook des secrets (`tools/claude/verif-secrets.sh --hook`, revu par OUTILLAGE-2 le 05/11/2026) : il lit la **commande** (jamais sa description) et agit sur tout « git [options] commit » (`-c`, `-C dossier`, `cd dossier &&`, alias). Il contrôle l'index, plus les fichiers nommés dans un `git add` de la même commande, plus tout le dossier de travail pour `git add -A` / `git add .` / `git commit -a`. Dérogation (faux positif vérifié ligne par ligne) : `CP_SECRETS_OK=1 git commit …`, **en tête** de la commande `git commit`, et la justifier dans le compte rendu. S'il ne peut pas savoir dans quel dossier on committe (chemin dans une variable), il bloque : écrire le chemin en clair. Le hook ne voit pas les commits faits autrement (script lancé, autre outil) : `bash tools/claude/verif-secrets.sh --branche` reste obligatoire avant le push.
- Les règles bloquantes et le hook du dépôt (`.claude/settings.json`) s'appliquent dans une session cloud à un seul dépôt. Ils ne s'appliquent **pas** dans les « threads » des Projects de Claude Code (doc officielle, page « Settings files and precedence », § « Settings in cloud sessions », lue le 03/11/2026). La vraie barrière reste la protection de `main` sur GitHub.
