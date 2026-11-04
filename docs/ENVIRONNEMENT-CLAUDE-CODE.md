# ClimPilot : environnement des sessions Claude Code dans le cloud

> Créé le 03/11/2026 par la mission OUTILLAGE (dossier du 01/11/2026). Ce fichier ne contient ni secret ni donnée personnelle.
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

echo "--- bilan" >>"$LOG"; grep -E "^(OK|ECHEC)" "$LOG"
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
   - `unshare -n true` → aucune erreur. Sinon, lancer la batterie avec `CP_SANS_NETNS=1`, comme la CI.
3. Batterie complète : `bash tests/run-all.sh`, puis lire `rapport.md` (dossier `CP_TEST_OUT`). Comparer avec le rapport de la CI du même commit :
   ```bash
   gh api repos/gablry8/cp-gl2607/commits/<sha>/check-runs --jq '.check_runs[]|select(.name|startswith("rapport"))|.output.text'
   ```
4. S'il manque Chromium : le message de Playwright nomme l'hôte refusé (exemple lu le 01/11 : `request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"`). C'est le réglage « Allowed domains » du § 1 qui manque.

Chrome 153, préinstallé sur certaines machines, ignore `emulateNetworkConditions{offline:false}` sous `unshare -n` : ne pas s'en servir pour conclure ; Chromium 141 de Playwright ou la CI.

## 4. Bon à savoir dans une session cloud
- `gh pr list` et `gh pr view` échouent (`HTTP 403: GitHub GraphQL is not available from Claude Code sessions`, lu le 03/11). Utiliser l'API REST : `gh api 'repos/gablry8/cp-gl2607/pulls?state=all&per_page=30'`.
- Les règles bloquantes et le hook du dépôt (`.claude/settings.json`) s'appliquent dans une session cloud à un seul dépôt. Ils ne s'appliquent **pas** dans les « threads » des Projects de Claude Code (doc officielle, page « Settings files and precedence », § « Settings in cloud sessions », lue le 03/11/2026). La vraie barrière reste la protection de `main` sur GitHub.
