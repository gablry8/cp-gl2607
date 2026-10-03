#!/usr/bin/env bash
# Construit l'aperçu isolé de l'appli (mode démonstration, sans cloud) : une page autonome publiable,
# sans service worker, sans bibliothèque Supabase, sans identifiants du projet ni adresse de départ réelle.
# Usage : tools/apercu/build.sh [dossier de sortie]   (défaut : $CP_TEST_OUT/apercu, hors du dépôt)
set -euo pipefail
ICI=$(cd "$(dirname "$0")" && pwd); SRC=$(cd "$ICI/../.." && pwd)
OUT=${1:-${CP_TEST_OUT:-${TMPDIR:-/tmp}/climpilot-tests}/apercu}
case "$OUT" in "$SRC"|"$SRC"/*) [ "$OUT" = "$SRC/tools/apercu/out" ] || { echo "sortie dans le dépôt refusée : $OUT"; exit 2; } ;; esac
rm -rf "$OUT" && mkdir -p "$OUT"
cp "$SRC"/next-*.js "$SRC"/next-*.css "$OUT"/
cp "$ICI/apercu.js" "$OUT/"
python3 - "$SRC/index.html" "$OUT/index.html" <<'PY'
import sys, re
s = open(sys.argv[1], encoding='utf-8').read()
# identifiants du projet relus dans la source pour vérifier ensuite qu'ils ont disparu (jamais écrits ici)
ref = re.search(r"var SUPA_URL='https://([a-z0-9]+)\.supabase\.co'", s)
assert ref, 'SUPA_URL introuvable'
ref = ref.group(1)
s = s.replace('<!DOCTYPE html>\n', '', 1)
s = re.sub(r'^<html[^>]*>\n', '', s, count=1, flags=re.M)
s = s.replace('</head>\n<body>\n', '', 1).replace('</body>\n</html>', '', 1)
s = re.sub(r'<title>[^<]*</title>', '<title>Aperçu ClimPilot 1.10</title>', s, count=1)
# en-tête fourni par la page publiée : pas de <head> ni de meta charset / viewport en double
s = s.replace('<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n', '', 1)
s = s.replace('<link rel="stylesheet" href="next-theme.css">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">\n<link rel="stylesheet" href="next-theme.css">', 1)
# aucune connexion au cloud : la bibliothèque Supabase n'est pas chargée, identifiants du projet retirés
s = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/[^"]*"></script>\n', '', s, count=1)
s = re.sub(r"var SUPA_URL='[^']*';", "var SUPA_URL='';", s, count=1)
s = re.sub(r"var SUPA_KEY='[^']*';", "var SUPA_KEY='';", s, count=1)
s = re.sub(r'<link rel="manifest"[^>]*>\n', '', s, count=1)
s = re.sub(r'<link rel="apple-touch-icon"[^>]*>\n', '', s, count=1)
s = s.replace("if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js');}catch(e){}}", "/* aperçu : pas de service worker */", 1)
s = s.replace('<script src="next-store.js"></script>', '<script src="apercu.js"></script>\n<script src="next-store.js"></script>', 1)
for interdit in ('@supabase', '<body>', '.supabase.co', ref, 'eyJhbGci', 'serviceWorker.register'):
    assert interdit not in s, 'reste dans l’aperçu : ' + ('<référence du projet>' if interdit == ref else interdit)
assert 'apercu.js' in s and s.lstrip().startswith('<title>') and 'fonts.googleapis.com' in s
open(sys.argv[2], 'w', encoding='utf-8').write(s)
PY
# adresse de départ par défaut remplacée par une adresse d'exemple ; l'adresse réelle est lue dans la source
# (jamais écrite dans ce script) et on vérifie qu'il n'en reste aucune trace
python3 - "$OUT/next-adresse.js" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
m = re.search(r"var HOME_DEF=\{adr:'((?:[^'\\]|\\.)*)',lon:[-0-9.]+,lat:[-0-9.]+\};", s)
assert m, 'HOME_DEF introuvable'
adr = m.group(1).replace("\\'", "'")
s = s.replace(m.group(0), "var HOME_DEF={adr:'1 Rue de l\\'Exemple 60000 Beauvais',lon:2.0807,lat:49.4300}; /* aperçu : adresse d\\'exemple */")
mots = [w for w in re.split(r"[\s,]+", adr) if w]
motif = r"[\s,]+".join(re.escape(w).replace("\\'", "\\\\?'") for w in mots)
s = re.sub(motif, "une adresse d'exemple", s, flags=re.I)
for w in mots:
    if len(w) >= 6 and not w.isdigit():
        assert w.lower() not in s.lower(), 'adresse réelle encore présente dans next-adresse.js'
open(p, 'w', encoding='utf-8').write(s)
PY
# polices : pas de fichiers binaires publiés, IBM Plex Sans chargée depuis Google Fonts (autorisé par la page)
python3 - "$OUT/next-da.css" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
n = len(re.findall(r"@font-face\{font-family:'Plex';[^}]*\}", s)); assert n == 4, n
s = re.sub(r"@font-face\{font-family:'Plex';[^}]*\}\n?", "", s)
assert "--da-font:'Plex'," in s
s = s.replace("--da-font:'Plex',", "--da-font:'IBM Plex Sans','Plex',", 1)
assert 'fonts/' not in s
open(p, 'w', encoding='utf-8').write(s)
PY
echo "aperçu construit : $OUT ($(ls "$OUT" | wc -l) fichiers, $(du -sh "$OUT" | cut -f1))"
