#!/usr/bin/env bash
# Lance toute la batterie ClimPilot HORS RÉSEAU et écrit un rapport (rapport.md / rapport.json).
#
#   tests/run-all.sh
#
# Isolation (voir tests/LISEZMOI.md, « Isolation réseau ») :
#  1. noyau : le script se relance dans un espace réseau neuf (unshare -n) où seule la boucle locale existe ;
#     tous les processus (navigateur, service worker, WebSockets, Node, Python, libpq) y sont enfermés.
#     Sans unshare (droits insuffisants), il s'arrête, sauf avec CP_SANS_NETNS=1 (le rapport le signale).
#  2. gardes comptées : Node (NODE_OPTIONS --import), Python (sitecustomize), navigateur (mandataire « refus »
#     + règles de résolution), PostgreSQL (tests/sql/cible_locale.py : banc local marqué climpilot-test).
#
# Variables : CP_TEST_OUT (sortie, défaut : dossier temporaire daté), CHROMIUM_PATH, PLAYWRIGHT_MODULE,
#   EN16931_XSLT et BRFR_DIR (validateurs, facultatifs : sinon SKIP), PGHOST et PGPORT (tests SQL,
#   facultatifs : sinon NON EXÉCUTÉ), CP_SUITES (liste réduite de suites, pour le débogage).
set -u
ICI=$(cd "$(dirname "$0")" && pwd); RACINE=$(cd "$ICI/.." && pwd)
export CP_TEST_OUT=${CP_TEST_OUT:-${TMPDIR:-/tmp}/climpilot-tests-$(date +%Y%m%d-%H%M%S)}

if [ "${CP_DANS_NETNS:-}" != 1 ] && [ "${CP_SANS_NETNS:-0}" != 1 ]; then
  if unshare -n true 2>/dev/null; then
    exec unshare -n env CP_DANS_NETNS=1 bash "$0" "$@"
  fi
  echo "unshare -n indisponible : impossible d'isoler le réseau au niveau du noyau."
  echo "Relancer avec CP_SANS_NETNS=1 pour n'utiliser que les gardes logicielles (le rapport l'indiquera)."
  exit 2
fi

mkdir -p "$CP_TEST_OUT/isolation" "$CP_TEST_OUT/journaux"
if [ "${CP_DANS_NETNS:-}" = 1 ]; then
  python3 "$ICI/isolation/boucle_locale.py" > "$CP_TEST_OUT/isolation/interfaces.txt" || { echo "boucle locale non activée"; exit 2; }
fi
# aucun mandataire hérité : rien ne doit pouvoir sortir par un autre chemin
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy NO_PROXY no_proxy
export CP_GARDE_RESEAU=1 PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1
export NODE_OPTIONS="--import $ICI/isolation/garde-reseau.mjs${NODE_OPTIONS:+ $NODE_OPTIONS}"
export PYTHONPATH="$ICI/isolation${PYTHONPATH:+:$PYTHONPATH}"
cd "$RACINE"

python3 -m http.server 8765 --bind 127.0.0.1 --directory "$RACINE" > "$CP_TEST_OUT/journaux/serveur-8765.log" 2>&1 &
SERVEUR=$!
trap 'kill $SERVEUR 2>/dev/null' EXIT
for _ in $(seq 50); do python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8765/index.html',timeout=1)" 2>/dev/null && break; sleep 0.2; done

: > "$CP_TEST_OUT/codes.txt"
etape() { # etape <nom> <commande…> : journal dans journaux/<nom>.log, code de sortie dans codes.txt
  local nom=$1; shift
  printf '%-22s ' "$nom"
  local debut=$SECONDS
  "$@" > "$CP_TEST_OUT/journaux/$nom.log" 2>&1
  local code=$?
  echo "$nom $code $((SECONDS-debut))" >> "$CP_TEST_OUT/codes.txt"
  echo "code $code ($((SECONDS-debut)) s) — PASS $(grep -c '^PASS' "$CP_TEST_OUT/journaux/$nom.log"), autres $(grep -cE '^(FAIL|SKIP)' "$CP_TEST_OUT/journaux/$nom.log")"
}

etape autotest-isolation node "$ICI/isolation/autotest.mjs"
for s in ${CP_SUITES:-suiteA suiteB suiteC suiteD-memoire suiteE-avoirs suiteF-einvoice suiteG-virgule suiteH-superpdp suiteI-emission suiteJ-particuliers suiteK-fiscal suiteL-documents suiteM-adresse-copie}; do
  etape "$s" timeout 1200 node "$ICI/$s.mjs"
done
etape fn-signature node "$ICI/functions/test-signature.mjs"
etape fn-liste-blanche node "$ICI/functions/test-liste-blanche.mjs"
if [ -n "${PGHOST:-}" ]; then
  etape sql python3 -m pytest -q -p no:cacheprovider --junitxml="$CP_TEST_OUT/sql-junit.xml" "$ICI/sql"
else
  echo "sql                    NON EXÉCUTÉ (PGHOST absent)"
fi
etape apercu-construction bash "$RACINE/tools/apercu/build.sh" "$CP_TEST_OUT/apercu"
etape apercu-test node "$RACINE/tools/apercu/test-apercu.mjs" "$CP_TEST_OUT/apercu"

kill $SERVEUR 2>/dev/null
node "$ICI/isolation/rapport.mjs"
