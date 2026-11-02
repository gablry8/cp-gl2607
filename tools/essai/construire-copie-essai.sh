#!/usr/bin/env bash
# ClimPilot — construit une COPIE D'ESSAI de l'appli (M0, 20/10/2026), à brancher sur le projet Supabase de TEST, jamais le réel.
#   tools/essai/construire-copie-essai.sh [dossier de sortie]   → <sortie>/ClimPilot-ESSAI-<cache>/ + ClimPilot-ESSAI-<cache>.zip
# Ce que fait la copie, et rien d'autre :
#  - l'adresse et la clé publique (anon) du projet RÉEL sont RETIRÉES de index.html et signer.html ; la copie les lit dans
#    essai-config.js, que Gabriel remplit avec celles du projet ClimPilot-TEST ;
#  - tant que essai-config.js n'est pas rempli, ou s'il pointe vers le projet réel, la copie refuse de démarrer (écran rouge) ;
#  - bandeau rouge « VERSION D'ESSAI » permanent, nom « ClimPilot ESSAI » sur l'écran d'accueil, cache hors ligne à part ;
#  - aucun autre fichier modifié : même code, mêmes calculs que la branche.
set -euo pipefail
ICI=$(cd "$(dirname "$0")" && pwd); RACINE=$(cd "$ICI/../.." && pwd)
SORTIE=${1:-"$RACINE/_essai"}
CACHE=$(sed -n "1s/^const C='climpilot-next-\([^']*\)';.*$/\1/p" "$RACINE/sw.js"); [ -n "$CACHE" ] || { echo "nom de cache illisible dans sw.js"; exit 1; }
NOM="ClimPilot-ESSAI-$CACHE"; D="$SORTIE/$NOM"
HOTE_REEL=$(sed -n "s/^var SUPA_URL='https:\/\/\([^.']*\)\.supabase\.co';$/\1/p" "$RACINE/index.html"); [ -n "$HOTE_REEL" ] || { echo "SUPA_URL introuvable dans index.html"; exit 1; }
rm -rf "$D"; mkdir -p "$D/fonts" "$D/vendor"
cp "$RACINE"/index.html "$RACINE"/signer.html "$RACINE"/sw.js "$RACINE"/manifest.json "$RACINE"/next-*.js "$RACINE"/next-*.css "$RACINE"/icon-192.png "$RACINE"/icon-512.png "$D/"
cp "$RACINE"/fonts/*.woff2 "$D/fonts/"; cp "$RACINE"/vendor/*.js "$RACINE"/vendor/LISEZMOI.md "$D/vendor/"

# 1) index.html : adresse + clé lues dans essai-config.js (chargé en tout premier) ; le script de config pose aussi le bandeau
python3 - "$D" "$HOTE_REEL" <<'EOF'
import sys,re,io
d,hote=sys.argv[1],sys.argv[2]
p=d+'/index.html'; s=io.open(p,encoding='utf-8').read()
n=s.count("var SUPA_URL='https://"+hote+".supabase.co';"); assert n==1, n
s=s.replace("var SUPA_URL='https://"+hote+".supabase.co';","var SUPA_URL=(window.CP_ESSAI&&window.CP_ESSAI.url)||'https://copie-essai-non-configuree.invalid';",1)
s,n=re.subn(r"var SUPA_KEY='[^']+';","var SUPA_KEY=(window.CP_ESSAI&&window.CP_ESSAI.key)||'';",s); assert n==1, n
s,n=re.subn(r'<script src="next-store\.js"></script>','<script src="essai-config.js"></script>\n<script src="next-store.js"></script>',s); assert n==1, n
s,n=re.subn(r'<meta name="apple-mobile-web-app-title" content="ClimPilot">','<meta name="apple-mobile-web-app-title" content="CP ESSAI">',s); assert n==1, n
io.open(p,'w',encoding='utf-8').write(s)
# 2) signer.html : même principe
p=d+'/signer.html'; s=io.open(p,encoding='utf-8').read()
s,n=re.subn(r"var FN='https://"+hote+r"\.supabase\.co/functions/v1/signature';","var FN=((window.CP_ESSAI&&window.CP_ESSAI.url)||'https://copie-essai-non-configuree.invalid')+'/functions/v1/signature';",s); assert n==1, n
s,n=re.subn(r"var KEY='[^']+';","var KEY=(window.CP_ESSAI&&window.CP_ESSAI.key)||'';",s); assert n==1, n
s,n=re.subn(r'<script',r'<script src="essai-config.js"></script>\n<script',s,count=1); assert n==1
io.open(p,'w',encoding='utf-8').write(s)
# 3) sw.js : cache à part + essai-config.js dans la liste hors ligne
p=d+'/sw.js'; s=io.open(p,encoding='utf-8').read()
s,n=re.subn(r"^const C='climpilot-next-([^']*)';",r"const C='climpilot-essai-\1';",s,flags=re.M); assert n==1
s,n=re.subn(r"addAll\(\['\./','\./index\.html',","addAll(['./','./index.html','./essai-config.js',",s); assert n==1
io.open(p,'w',encoding='utf-8').write(s)
# 4) manifest : nom et couleur d'essai
p=d+'/manifest.json'; s=io.open(p,encoding='utf-8').read()
s=s.replace('"name": "ClimPilot Next — GL Froid & Clim"','"name": "ClimPilot ESSAI (base de TEST)"').replace('"short_name": "ClimPilot Next"','"short_name": "CP ESSAI"').replace('"theme_color": "#121417"','"theme_color": "#b03a2e"')
io.open(p,'w',encoding='utf-8').write(s)
EOF

# 5) essai-config.js : à remplir par Gabriel ; verrous + bandeau
cat > "$D/essai-config.js" <<EOF
/* ============================================================================================
   ClimPilot — COPIE D'ESSAI ($NOM). À REMPLIR PAR GABRIEL, une seule fois, avec le Bloc-notes :
     url : l'adresse du projet Supabase ClimPilot-TEST   (Supabase › projet TEST › Settings › API › Project URL)
     key : sa clé publique « anon »                      (même page › Project API keys › anon public)
   JAMAIS celles du projet réel : la copie le vérifie et refuse de démarrer si c'est le cas.
   ============================================================================================ */
window.CP_ESSAI={
  url:'REMPLACER https://xxxxxxxxxxxxxxxxxxxx.supabase.co',
  key:'REMPLACER clé anon du projet TEST'
};
(function(){
  var c=window.CP_ESSAI, pb=null;
  if(!c||!c.url||!c.key||/REMPLACER/.test(c.url)||/REMPLACER/.test(c.key)) pb='essai-config.js n\'est pas rempli (adresse et clé anon du projet ClimPilot-TEST).';
  else if(/$HOTE_REEL/.test(c.url)||/$HOTE_REEL/.test(c.key)) pb='essai-config.js pointe vers le projet RÉEL : interdit pour une copie d\'essai.';
  else if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url)) pb='essai-config.js : adresse attendue de la forme https://xxxx.supabase.co (sans barre finale).';
  if(pb){ window.CP_ESSAI={url:'https://copie-essai-non-configuree.invalid',key:'copie-essai-non-configuree'}; }
  function poser(){
    var b=document.createElement('div'); b.id='cpEssaiBandeau';
    b.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#b03a2e;color:#fff;font:600 13px/1.3 system-ui,sans-serif;text-align:center;padding:6px 10px;box-shadow:0 2px 6px rgba(0,0,0,.3)';
    b.textContent=pb?('COPIE D\'ESSAI BLOQUÉE — '+pb):('VERSION D\'ESSAI — base de TEST — aucune vraie facture ici');
    document.body.appendChild(b); document.body.style.paddingTop='30px';
    if(pb){ var v=document.createElement('div'); v.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#fff;color:#b03a2e;font:16px/1.5 system-ui,sans-serif;padding:60px 24px;text-align:center';
      v.innerHTML='<h2>Copie d\'essai non utilisable</h2><p>'+pb.replace(/</g,'&lt;')+'</p><p>Corrige le fichier <b>essai-config.js</b> puis recharge la page. Rien ne s\'est connecté nulle part.</p>'; document.body.appendChild(v); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',poser); else poser();
})();
EOF

# 6) vérifications : plus aucune trace du projet réel ; syntaxe ; liste du cache complète
# (l'hôte réel n'apparaît plus qu'une fois : dans le VERROU de essai-config.js, qui interdit de l'utiliser)
if grep -r "$HOTE_REEL" "$D" | grep -v "essai-config.js:.*pointe vers le projet RÉEL" | grep -q .; then echo "ÉCHEC : l'hôte réel subsiste dans la copie :"; grep -r "$HOTE_REEL" "$D" | grep -v "pointe vers le projet RÉEL"; exit 1; fi
[ "$(grep -c "$HOTE_REEL" "$D/essai-config.js")" = 1 ] || { echo "ÉCHEC : verrou de essai-config.js"; exit 1; }
node --check "$D/sw.js" && node --check "$D/essai-config.js"
for f in $(grep -o -E 'src="[^"]+\.js"' "$D/index.html" | sed 's/src="//;s/"//' | sort -u); do grep -q "'./$f'" "$D/sw.js" || { echo "ÉCHEC : $f absent de sw.js"; exit 1; }; done
( cd "$SORTIE" && rm -f "$NOM.zip" && zip -qr "$NOM.zip" "$NOM" )
echo "OK : $SORTIE/$NOM.zip ($(du -h "$SORTIE/$NOM.zip" | cut -f1)) — hôte réel retiré, $(ls "$D" | wc -l) entrées, cache climpilot-essai-$CACHE"
