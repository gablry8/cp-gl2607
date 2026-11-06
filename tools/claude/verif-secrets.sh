#!/bin/bash
# ClimPilot : contrôle des secrets et des données personnelles avant qu'ils deviennent publics (dépôt PUBLIC).
# Usage :
#   bash tools/claude/verif-secrets.sh            lignes ajoutées et indexées (git diff --cached)
#   bash tools/claude/verif-secrets.sh --branche  ce que la branche courante publiera par rapport à origin/main : lignes
#                                                 ajoutées, messages, auteurs et validateurs des commits
#   (hook) --hook : lit le JSON du hook PreToolUse (Bash) sur l'entrée standard et n'agit que si la COMMANDE
#          (tool_input.command, jamais la description) lance « git [options] commit » ou « git [options] push ».
# Motifs privés (rue, ville, e-mails perso) : variable d'environnement CP_MOTIFS_PRIVES (regex étendues séparées par |),
# posée dans l'environnement Claude Code de Gab, jamais écrite dans le dépôt.
# Un signalement nomme l'endroit (fichier et ligne, message du commit…) et le motif, JAMAIS le texte trouvé.
# Faux positif vérifié ligne par ligne : relancer avec CP_SECRETS_OK=1 et le justifier dans le compte rendu.
#   - à la main : CP_SECRETS_OK=1 bash tools/claude/verif-secrets.sh [--branche] ;
#   - hook : CP_SECRETS_OK=1 posé EN TÊTE de la commande git (CP_SECRETS_OK=1 git commit … / CP_SECRETS_OK=1 git push …),
#     rien d'autre. La dérogation ne lève jamais le refus d'un push vers main.
# Le hook est déclaré avec « onFailure: block » (.claude/settings.json, OUTILLAGE-3) : s'il plante ou dépasse son délai,
# la commande est BLOQUÉE. Parade : docs/ENVIRONNEMENT-CLAUDE-CODE.md § 4.
#
# Hook, ce qui est contrôlé :
#   « git commit » (OUTILLAGE-2) : l'index du dépôt visé (git -C <dossier>, ou dernier « cd <dossier> », sinon le dossier
#     courant du hook) ; les fichiers nommés dans un « git add … » de la même commande (le hook tourne AVANT le git add) ;
#     « git add -A / --all / . » : tout le dossier de travail ; « git commit -a / --all » : les fichiers suivis modifiés ;
#     « git commit <fichiers> » : ces fichiers.
#   + (OUTILLAGE-3) l'auteur et le validateur qu'aura le commit (git var, avec -c user.* et GIT_AUTHOR_* de la commande)
#     et le TEXTE du message : -m (répété), -mTEXTE, --message[=], -F fichier, -F - (document en ligne <<EOF,
#     <<<, < fichier, echo / printf / cat … |), -t, -C / -c <commit>, --trailer, --author. Texte lu tel qu'écrit dans la
#     commande ($VAR et $(…) ne sont pas développés : le contrôle du push relit les vrais messages). Source illisible : bloqué.
#   « git push » (OUTILLAGE-3) : le contrôle de --branche pour chaque révision poussée (la branche courante par défaut) ;
#     push vers main refusé (CLAUDE.md règle 3.1), sans dérogation possible ; « git push -n » (essai à blanc) : rien.
#   Dossier impossible à connaître (variable, --git-dir) : bloqué, avec le message « écris le chemin en clair ».
#   Analyse impossible (python3 absent ou en erreur) : mode dégradé, contrôle large du dossier courant.
set -u
mode="${1:-}"

# Motifs « nom|expression régulière étendue », cherchés sans tenir compte de la casse (grep -Ei), comme avant OUTILLAGE-3.
MOTIFS=(
  'jeton JWT (eyJ…)|eyJ[A-Za-z0-9_-]{20,}'
  'clé Anthropic (sk-ant-…)|sk-ant-[A-Za-z0-9_-]+'
  'clé secrète Supabase (sb_secret_…)|sb_secret_[A-Za-z0-9_-]+'
  'clé privée (BEGIN … PRIVATE KEY)|-----BEGIN [A-Z ]*PRIVATE KEY'
  'IBAN français (FR76…)|FR76[0-9 ]{10,}'
  'IBAN|IBAN[[:space:]:]*[A-Z]{2}[0-9]{2}[0-9 ]{8,}'
  'adresse e-mail personnelle (gmail, hotmail, orange, free…)|@(gmail|hotmail|outlook|yahoo|icloud|live|orange|free|sfr|laposte|wanadoo)\.'
  'numéro de téléphone mobile (06, 07, +33 6…)|(\+33|0)[67]([ .-]?[0-9]{2}){4}'
)
[ -n "${CP_MOTIFS_PRIVES:-}" ] && MOTIFS+=("motif privé (CP_MOTIFS_PRIVES, non affiché)|$CP_MOTIFS_PRIVES")

# Lit un diff unifié sur l'entrée standard (git diff --unified=0, ou blocs « +++ b/<nom> », « @@ -0,0 +1,N @@ », « +ligne »).
# Code 2 et la liste « endroit : motif » si un motif est trouvé dans une ligne AJOUTÉE ; le texte trouvé n'est jamais affiché.
verifier() {
  local lus contenus lieux m nom re res code i=0 trouves="" n
  lus=$(awk '
    function entete(l,   p, o, k, nn) {
      split(l, p, " "); o = substr(p[2], 2); k = index(o, ","); rm = (k ? substr(o, k + 1) + 0 : 1)
      nn = substr(p[3], 2); k = index(nn, ",")
      if (k) { n = substr(nn, 1, k - 1) + 0; ad = substr(nn, k + 1) + 0 } else { n = nn + 0; ad = 1 }
    }
    BEGIN { f = "?"; ad = 0; rm = 0 }
    {
      c = substr($0, 1, 1)
      if (ad > 0 || rm > 0) {
        if (c == "+") { print f ", ligne " n "\t" substr($0, 2); n++; ad--; next }
        if (c == "-") { rm--; next }
        if (c == " ") { n++; ad--; rm--; next }
        if (c == "\\") next
        ad = 0; rm = 0
      }
      if (substr($0, 1, 4) == "+++ ") { f = substr($0, 5); gsub(/^"|"$/, "", f); sub(/^b\//, "", f); next }
      if (substr($0, 1, 3) == "@@ ") { entete($0); next }
      if (c == "+") print f ", ligne ?\t" substr($0, 2)   # ligne « + » hors bloc : contrôlée quand même
    }')
  [ -n "$lus" ] || return 0
  contenus=$(printf '%s\n' "$lus" | cut -f2-)
  lieux=$(printf '%s\n' "$lus" | cut -f1)
  for m in "${MOTIFS[@]}"; do
    i=$((i + 1)); nom=${m%%|*}; re=${m#*|}
    res=$(printf '%s\n' "$contenus" | grep -nEi -e "$re"); code=$?
    if [ "$code" -gt 1 ]; then
      echo "BLOQUÉ : le motif « $nom » est illisible pour grep (expression régulière fautive) : corrige-le." >&2; return 2
    fi
    [ -n "$res" ] && trouves+=$(printf '%s\n' "$res" | cut -d: -f1 | awk -v i="$i" '{ print $1 "\t" i }')$'\n'
  done
  [ -n "$trouves" ] || return 0
  n=$(printf '%s' "$trouves" | grep -c .)
  {
    echo "BLOQUÉ : secret ou donnée personnelle possible (dépôt public). Endroit et motif (le texte trouvé n'est pas recopié) :"
    printf '%s' "$trouves" | sort -t "$(printf '\t')" -k1,1n -k2,2n -u \
      | awk -F '\t' -v noms="$(for m in "${MOTIFS[@]}"; do printf '%s\t' "${m%%|*}"; done)" '
          BEGIN { split(noms, nm, "\t") }
          NR == FNR { l[NR] = $0; next }
          { if (++k <= 40) print "  " l[$1] " : " nm[$2] }' <(printf '%s\n' "$lieux") -
    [ "$n" -gt 40 ] && echo "  … et $((n - 40)) autre(s)."
    echo "Remplace-le par <email>, <tel>, <adresse>… Faux positif vérifié ligne par ligne : CP_SECRETS_OK=1 en tête de la"
    echo "commande (CP_SECRETS_OK=1 git commit …, CP_SECRETS_OK=1 git push …, ou à la main CP_SECRETS_OK=1 bash"
    echo "tools/claude/verif-secrets.sh [--branche]), à justifier dans le compte rendu."
  } >&2
  return 2
}

# Texte (entrée standard) → bloc de diff « +++ b/<nom> » lisible par verifier().
bloc() { awk -v nom="$1" '{ l[NR] = $0 } END { if (NR) { print "+++ b/" nom; print "@@ -0,0 +1," NR " @@"; for (i = 1; i <= NR; i++) print "+" l[i] } }'; }

# Ce que publie le push d'une révision ($2, HEAD par défaut) du dépôt $1 : lignes ajoutées depuis origin/main, messages,
# auteurs et validateurs des commits. À n'appeler qu'après base_branche (origin/main présent).
base_branche() { git -C "$1" rev-parse --verify --quiet 'origin/main^{commit}'; }
contenu_branche() {
  local d=$1 r=${2:-HEAD} base sha
  base=$(base_branche "$d") || return 0
  git -C "$d" -c core.quotepath=off diff --unified=0 --no-color "$base...$r"
  for sha in $(git -C "$d" rev-list "$base..$r"); do
    git -C "$d" log -1 --format=%B "$sha" | bloc "[message du commit ${sha:0:7}]"
    git -C "$d" log -1 --format='%an <%ae>%n%cn <%ce>' "$sha" | bloc "[auteur et validateur du commit ${sha:0:7}]"
  done
}
sans_base() {
  echo "BLOQUÉ : origin/main introuvable dans ${1} : impossible de savoir ce que la branche publiera." >&2
  echo "Lance « git fetch origin main », puis recommence." >&2
}

# Analyse de la commande du hook (python3, bibliothèque standard seulement). Sortie : 1re ligne RIEN | ACCORD | CONTROLE,
# puis, pour CONTROLE : « B<tab><dossier><tab><commit> » (révision poussée, contrôlée comme --branche) et « D<ligne> »
# (lignes de diff à contrôler). Code 3 : commande à bloquer (raison sur la sortie d'erreur).
ANALYSE=$(cat <<'PY'
import fnmatch, json, os, re, shlex, subprocess, sys

def git(d, *args):
    try:
        r = subprocess.run(['git', '-C', d, '-c', 'core.quotepath=off'] + list(args), capture_output=True, timeout=20)
    except Exception as e:
        print('git impossible dans ' + d + ' : ' + str(e), file=sys.stderr); sys.exit(3)
    return r.returncode, r.stdout

def git_texte(d, *args):
    code, out = git(d, *args)
    return out.decode('utf-8', 'replace').strip() if code == 0 else ''

def bloquer(*lignes):
    print('BLOQUÉ : ' + '\n'.join(lignes), file=sys.stderr); sys.exit(3)

def chemin(base, p):
    """Chemin absolu, ou None s'il dépend d'une variable inconnue."""
    if base is None: return None
    p = os.path.expanduser(os.path.expandvars(p))
    if '$' in p or '`' in p: return None
    return os.path.normpath(os.path.join(base, p))

def bloc(nom, texte):
    """Texte → bloc de diff lisible par verifier()."""
    lignes = texte.split('\n')
    if lignes and lignes[-1] == '': lignes.pop()
    if not lignes: return ''
    return '+++ b/' + nom + '\n@@ -0,0 +1,' + str(len(lignes)) + ' @@\n' + ''.join('+' + l + '\n' for l in lignes)

# Documents en ligne (<<EOF … EOF) : le corps est du texte (message de commit…), pas des commandes. Chaque opérateur devient
# « <<__CPDOCn__ » et le corps est gardé à part (CORPS[n]), pour lire un message passé par -F - ou par -m "$(cat <<EOF …)".
HEREDOC = re.compile(r'''(?<!<)<<(?!<)(-?)[ \t]*\\?(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2''')
MARQUE = re.compile(r'__CPDOC(\d+)__')
CORPS = []

def sortir_documents(cmd):
    lignes, sortie, i = cmd.split('\n'), [], 0
    while i < len(lignes):
        ligne = lignes[i]
        ops = list(HEREDOC.finditer(ligne))
        j, corps, complet = i + 1, [], True
        for m in ops:
            fin, tab, texte = m.group(3), m.group(1) == '-', []
            while j < len(lignes) and (lignes[j].lstrip('\t') if tab else lignes[j]) != fin:
                texte.append(lignes[j].lstrip('\t') if tab else lignes[j]); j += 1
            if j >= len(lignes): complet = False; break
            j += 1; corps.append('\n'.join(texte))
        if not ops or not complet:   # sans ligne de fin, ce n'est pas un document en ligne (« grep '<<EOF' f ») : ligne gardée
            sortie.append(ligne); i += 1; continue
        n0 = len(CORPS); CORPS.extend(corps); k = iter(range(n0, n0 + len(corps)))
        sortie.append(HEREDOC.sub(lambda m: ' <<__CPDOC%d__ ' % next(k), ligne)); i = j
    return '\n'.join(sortie)

def resoudre(texte):
    """Texte d'un argument, avec le corps des documents en ligne qu'il cite ($(cat <<EOF …))."""
    texte = texte.replace(' ; ', '\n')
    return MARQUE.sub(lambda m: '\n' + CORPS[int(m.group(1))] + '\n', texte)

SEPARE = set(';&|()')
REDIR = set('<>&')
MOTS_CLES = {'{', '}', '!', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time', 'fi', 'done', 'case', 'esac'}
AFFECT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*=')
TEXTE = {'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'sed', 'awk', 'cat', 'head', 'tail', 'less', 'more', 'man',
         'which', 'type', 'test', '['}  # commandes qui ne lancent pas leurs arguments : « echo git push origin main »

def commandes_simples(cmd):
    """Commandes simples : {'mots', 'redir' [(opérateur, cible)], 'avant' (commande précédente si « | »)}."""
    cmd = sortir_documents(cmd).replace('\\\n', ' ').replace('\n', ' ; ').replace('`', ' ; ')
    lx = shlex.shlex(cmd, posix=True, punctuation_chars=';&|()<>')
    lx.whitespace_split = True; lx.commenters = ''
    jetons = list(lx)  # ValueError si guillemets non fermés
    tout, cour, i = [], {'mots': [], 'redir': [], 'avant': None}, 0
    while i < len(jetons):
        t = jetons[i]
        if t and set(t) <= SEPARE:
            prec = cour if (cour['mots'] or cour['redir']) else None
            if prec: tout.append(prec)
            cour = {'mots': [], 'redir': [], 'avant': prec if t in ('|', '|&') else None}
        elif t and set(t) <= REDIR:
            cour['redir'].append((t, jetons[i + 1] if i + 1 < len(jetons) else '')); i += 1
        elif t.isdigit() and i + 1 < len(jetons) and jetons[i + 1] and set(jetons[i + 1]) <= REDIR:
            pass    # « 2>&1 » : le numéro de flux n'est pas un argument
        else:
            cour['mots'].append(t)
        i += 1
    if cour['mots'] or cour['redir']: tout.append(cour)
    return tout

def utiles(mots):
    """(affectations en tête, reste de la commande)."""
    k = 0
    while k < len(mots) and mots[k] in MOTS_CLES: k += 1
    tete = []
    while k < len(mots) and AFFECT.match(mots[k]): tete.append(mots[k]); k += 1
    return tete, mots[k:]

# Texte qu'une commande lit ou écrit ; None = inconnu.
def lire_fichier(dossier, f, etat):
    p = chemin(dossier, f)
    if p is None: return None
    if p in etat['ecrits']: return etat['ecrits'][p]   # écrit plus tôt dans la même commande
    try:
        with open(p, 'rb') as h: return h.read(1000000).decode('utf-8', 'replace')
    except OSError:
        return ''   # absent : git échouera sans rien enregistrer

def entree_standard(sc, dossier, etat):
    for op, cible in reversed(sc['redir']):
        if op == '<<':
            m = MARQUE.fullmatch(cible)
            return CORPS[int(m.group(1))] if m else None
        if op == '<<<': return resoudre(cible)
        if op == '<': return lire_fichier(dossier, cible, etat)
        if op.startswith('<'): return None
    if sc['avant'] is not None: return sortie_commande(sc['avant'], dossier, etat)
    return ''   # rien sur l'entrée standard : git lira un message vide et s'arrêtera

def sortie_commande(sc, dossier, etat):
    _, reste = utiles(sc['mots'])
    if not reste: return ''
    nom = os.path.basename(reste[0])
    if nom in ('echo', 'printf'):
        return resoudre(' '.join(reste[1:]))
    if nom in ('cat', 'tee'):
        fichiers = [w for w in reste[1:] if not w.startswith('-') or w == '-'] if nom == 'cat' else []
        if not fichiers: return entree_standard(sc, dossier, etat)
        textes = [entree_standard(sc, dossier, etat) if f == '-' else lire_fichier(dossier, f, etat) for f in fichiers]
        return None if None in textes else '\n'.join(textes)
    return None

def noter_ecritures(sc, dossier, etat):
    """Fichiers écrits par la commande (> f, >> f, tee f) : leur texte, pour un « git commit -F f » plus loin."""
    _, reste = utiles(sc['mots'])
    cibles = [(op, c) for op, c in sc['redir'] if op in ('>', '>>', '>|', '&>', '&>>') or (op == '>&' and not c.isdigit() and c != '-')]
    if reste and os.path.basename(reste[0]) == 'tee':
        cibles += [('>>' if ('-a' in reste or '--append' in reste) else '>', w) for w in reste[1:] if not w.startswith('-')]
    if not cibles: return
    texte = sortie_commande(sc, dossier, etat)
    for op, c in cibles:
        p = chemin(dossier, c)
        if p is None: continue
        if op in ('>>', '&>>'):
            avant = lire_fichier(dossier, c, etat)
            etat['ecrits'][p] = None if (avant is None or texte is None) else avant + '\n' + texte
        else:
            etat['ecrits'][p] = texte

GIT_AVEC_ARG = {'-c', '--namespace', '--config-env', '--super-prefix'}
CONNUS = set('status log diff show fetch push pull checkout switch branch merge rebase stash worktree rev-parse config remote tag reset '
             'restore rm mv ls-files ls-remote grep blame cherry-pick revert clone init apply am format-patch describe shortlog reflog gc '
             'clean notes submodule bisect cat-file rev-list for-each-ref symbolic-ref update-ref hash-object show-ref var help version'.split())

def lire_git(mots, i, dossier):
    """mots[i] est « git » : rend (dossier visé, sous-commande, arguments, dossier_inconnu, options -c d'identité)."""
    j, d, inconnu, conf = i + 1, dossier, False, []
    while j < len(mots):
        w = mots[j]
        if w == '-C' and j + 1 < len(mots):
            d = chemin(d, mots[j + 1]) if mots[j + 1] else d; j += 2; continue
        if w in ('--git-dir', '--work-tree'):
            inconnu = True; j += 2; continue
        if w.startswith('--git-dir=') or w.startswith('--work-tree='):
            inconnu = True; j += 1; continue
        if w in GIT_AVEC_ARG and j + 1 < len(mots):
            if w == '-c' and re.match(r'(user|author|committer)\.', mots[j + 1]): conf += ['-c', mots[j + 1]]
            j += 2; continue
        if w.startswith('-'):
            j += 1; continue
        break
    sous = mots[j] if j < len(mots) else ''
    args = mots[j + 1:]
    if sous and sous not in CONNUS and sous not in ('commit', 'add') and d is not None and not inconnu:
        code, val = git(d, 'config', '--get', 'alias.' + sous)  # alias git (« git ci »)
        val = val.decode('utf-8', 'replace').strip() if code == 0 else ''
        if val.startswith('!'):
            if re.search(r'\bcommit\b', val): sous, args = 'commit', ['--all']  # alias shell : contrôle large
            elif re.search(r'\bpush\b', val): sous, args = 'push', []
        elif val:
            try: mots_alias = shlex.split(val)
            except ValueError: mots_alias = val.split()
            if mots_alias and mots_alias[0] in ('commit', 'add', 'push'): sous, args = mots_alias[0], mots_alias[1:] + args
    return d, sous, args, inconnu, conf

def option_longue(w, connues):
    """« --mess=x » → « message » : git accepte tout début non ambigu d'une option longue."""
    nom = w[2:].split('=', 1)[0]
    if nom in connues: return nom
    cand = [o for o in connues if o.startswith(nom)]
    return cand[0] if len(cand) == 1 else nom

COMMIT_LONGUES = ('ahead-behind all allow-empty allow-empty-message amend author branch cleanup date dry-run edit file fixup '
                  'gpg-sign include interactive long message no-post-rewrite no-verify null only patch pathspec-file-nul '
                  'pathspec-from-file porcelain post-rewrite quiet reedit-message reset-author reuse-message short signoff squash '
                  'status template trailer untracked-files verbose verify').split()
COMMIT_ARG = {'message', 'file', 'reuse-message', 'reedit-message', 'template', 'author', 'date', 'cleanup', 'fixup', 'squash',
              'trailer', 'pathspec-from-file'}
SOURCE_LONGUE = {'message': 'm', 'file': 'F', 'template': 'F', 'reuse-message': 'C', 'reedit-message': 'C',
                 'trailer': 'trailer', 'author': 'author'}

def options_commit(args):
    """(tout, chemins, sources du message [(genre, valeur)])."""
    tout, chemins, sources, fin, j = False, [], [], False, 0
    while j < len(args):
        w = args[j]
        if fin or w == '-' or not w.startswith('-'):
            if fin or w != '-': chemins.append(w)
        elif w == '--':
            fin = True
        elif w.startswith('--no-'):
            pass
        elif w.startswith('--'):
            nom = option_longue(w, COMMIT_LONGUES)
            if nom in ('all', 'pathspec-from-file'): tout = True
            val = None
            if '=' in w: val = w.split('=', 1)[1]
            elif nom in COMMIT_ARG and j + 1 < len(args): j += 1; val = args[j]
            if nom in SOURCE_LONGUE and val is not None: sources.append((SOURCE_LONGUE[nom], val))
        else:
            for k, ch in enumerate(w[1:], 1):
                if ch == 'a': tout = True
                if ch in 'mFCct':
                    if k == len(w) - 1:
                        val = args[j + 1] if j + 1 < len(args) else None; j += 1  # argument dans le mot suivant
                    else:
                        val = w[k + 1:]
                    genre = {'m': 'm', 'F': 'F', 't': 'F', 'C': 'C', 'c': 'C'}[ch]
                    if val is not None: sources.append((genre, val))
                    break
                if ch in 'Su': break           # argument facultatif collé
        j += 1
    return tout, chemins, sources

def options_add(args):
    tout, suivis, force, chemins, fin, j = False, False, False, [], False, 0
    while j < len(args):
        w = args[j]
        if fin or not w.startswith('-') or w == '-':
            chemins.append(w)
        elif w == '--':
            fin = True
        elif w.startswith('--'):
            nom = w.split('=', 1)[0]
            if nom in ('--all', '--no-ignore-removal', '--pathspec-from-file'): tout = True
            if nom == '--update': suivis = True
            if nom == '--force': force = True
            if nom in ('--pathspec-from-file', '--chmod') and '=' not in w: j += 1
        else:
            if 'A' in w: tout = True
            if 'u' in w: suivis = True
            if 'f' in w: force = True
        j += 1
    return tout, suivis, force, chemins

PUSH_LONGUES = ('all atomic branches delete dry-run exec follow-tags force force-if-includes force-with-lease ipv4 ipv6 mirror '
                'no-verify porcelain progress prune push-option quiet receive-pack recurse-submodules repo set-upstream signed '
                'tags thin verbose verify').split()
PUSH_ARG = {'repo', 'receive-pack', 'exec', 'push-option'}

def options_push(args):
    p = {'depot': None, 'refspecs': [], 'tout': False, 'tags': False, 'suppr': False, 'essai': False}
    pos, fin, j = [], False, 0
    while j < len(args):
        w = args[j]
        if fin or w == '-' or not w.startswith('-'):
            pos.append(w)
        elif w == '--':
            fin = True
        elif w.startswith('--no-'):
            pass
        elif w.startswith('--'):
            nom = option_longue(w, PUSH_LONGUES)
            if nom in ('all', 'branches', 'mirror'): p['tout'] = True
            if nom in ('tags', 'follow-tags'): p['tags'] = True
            if nom == 'delete': p['suppr'] = True
            if nom == 'dry-run': p['essai'] = True
            if nom == 'repo': p['depot'] = w.split('=', 1)[1] if '=' in w else (args[j + 1] if j + 1 < len(args) else None)
            if nom in PUSH_ARG and '=' not in w: j += 1
        else:
            for k, ch in enumerate(w[1:], 1):
                if ch == 'd': p['suppr'] = True
                if ch == 'n': p['essai'] = True
                if ch == 'o':
                    if k == len(w) - 1: j += 1
                    break
        j += 1
    if pos:
        if p['depot'] is None: p['depot'] = pos[0]
        p['refspecs'] = pos[1:]
    return p

def examiner_push(p):
    """(vers_main, commits poussés). vers_main : texte de la raison, ou ''."""
    d = p['d']
    if git(d, 'rev-parse', '--git-dir')[0] != 0: return '', []   # pas un dépôt : le push échouera de lui-même
    courante = git_texte(d, 'symbolic-ref', '--short', '-q', 'HEAD')
    depot = p['depot'] or git_texte(d, 'config', '--get', 'branch.%s.remote' % courante) or 'origin'
    refspecs, defaut, tout = list(p['refspecs']), False, p['tout']
    if not refspecs and not tout and not p['tags']:
        conf = git_texte(d, 'config', '--get-all', 'remote.%s.push' % depot)
        refspecs = conf.split('\n') if conf else ['HEAD']
        defaut = not conf
    vers_main, sources = '', []
    for r in refspecs:
        r2 = r[1:] if r.startswith('+') else r
        if p['suppr']: src, dst = '', r2
        elif ':' in r2: src, dst = r2.split(':', 1)
        else: src, dst = r2, None
        if '*' in r2:
            tout = True
            if dst and (fnmatch.fnmatch('refs/heads/main', dst) or fnmatch.fnmatch('main', dst)): vers_main = r
            continue
        if dst is None:
            dst = src
            if src == 'HEAD':
                dst = courante
                if defaut:
                    mode = git_texte(d, 'config', '--get', 'push.default') or 'simple'
                    if mode in ('upstream', 'tracking'):
                        dst = git_texte(d, 'config', '--get', 'branch.%s.merge' % courante) or courante
                    elif mode == 'matching':
                        tout = True
        nom = dst[len('refs/heads/'):] if dst.startswith('refs/heads/') else dst
        if nom == 'main': vers_main = r if not defaut else 'git push sans branche, depuis « %s »' % courante
        if src: sources.append(src)
    if tout:
        if git(d, 'show-ref', '--verify', '--quiet', 'refs/heads/main')[0] == 0 and not vers_main:
            vers_main = '--all / --mirror / --branches / push.default=matching (la branche locale main en fait partie)'
        sources += git_texte(d, 'rev-list', '--no-walk', '--branches').split()
    if p['tags']:
        sources += git_texte(d, 'rev-list', '--no-walk', '--tags').split()
    shas = []
    for s in sources:
        sha = git_texte(d, 'rev-parse', '--verify', '--quiet', s + '^{commit}')
        if sha and sha not in shas: shas.append(sha)
    return vers_main, shas

def analyser(cmd, cwd, etat, profondeur=0):
    dossier = cwd
    for sc in commandes_simples(cmd):
        tete, reste = utiles(sc['mots'])
        noter_ecritures(sc, dossier, etat)
        if not reste: continue
        if reste[0] == 'cd':
            cible = [w for w in reste[1:] if w != '--']
            dossier = chemin(dossier, cible[0]) if cible and cible[0] != '-' else (os.path.expanduser('~') if not cible else None)
            continue
        if os.path.basename(reste[0]) in ('bash', 'sh', 'zsh', 'dash') and profondeur < 3:
            for n, w in enumerate(reste[1:], 1):
                if re.fullmatch(r'-[a-z]*c[a-z]*', w) and n + 1 < len(reste):
                    analyser(resoudre(reste[n + 1]), dossier, etat, profondeur + 1); break
        if reste[0] == 'eval' and profondeur < 3:
            analyser(resoudre(' '.join(reste[1:])), dossier, etat, profondeur + 1)
        if os.path.basename(reste[0]) in TEXTE: continue
        g = next((n for n, w in enumerate(reste) if os.path.basename(w) == 'git'), None)
        if g is None: continue
        d, sous, args, inconnu, conf = lire_git(reste, g, dossier)
        if inconnu: d = None
        ok = 'CP_SECRETS_OK=1' in tete
        if sous == 'commit':
            tout, chemins, sources = options_commit(args)
            etat['commits'].append({'d': d, 'ok': ok, 'tout': tout, 'chemins': chemins, 'sources': sources, 'sc': sc,
                                    'dossier': dossier, 'tete': tete, 'conf': conf})
        elif sous == 'add':
            tout, suivis, force, chemins = options_add(args)
            etat['ajouts'].append({'d': d, 'tout': tout, 'suivis': suivis, 'force': force, 'chemins': chemins})
        elif sous == 'push':
            p = options_push(args); p.update({'d': d, 'ok': ok})
            etat['pousses'].append(p)

def textes_message(c, etat):
    """[(endroit, texte)] du message du commit c ; bloque si une source est illisible."""
    sortie, n = [], 0
    for genre, val in c['sources']:
        if genre == 'm':
            n += 1; sortie.append(('[message -m n°%d]' % n, resoudre(val)))
        elif genre == 'F':
            texte = entree_standard(c['sc'], c['dossier'], etat) if val == '-' else lire_fichier(c['d'], val, etat)
            if texte is None:
                bloquer('le contrôle des secrets ne peut pas lire le message de ce commit (-F %s : texte produit par une autre '
                        'commande, ou chemin dans une variable).' % val,
                        'Écris le message avec -m "…", -F <fichier déjà écrit>, ou -F - <<\'EOF\' … EOF.')
            sortie.append(('[message -F %s]' % ('- (entrée standard)' if val == '-' else val), texte))
        elif genre == 'C':
            sortie.append(('[message repris de %s]' % val, git_texte(c['d'], 'log', '-1', '--format=%B', val)))
        else:
            sortie.append(('[--%s du commit]' % genre, resoudre(val)))
    return sortie

def identite(c):
    """Auteur et validateur qu'aura le commit (configuration, -c user.*, GIT_AUTHOR_* en tête), sans la date."""
    env = dict(os.environ)
    for a in c['tete']:
        k, v = a.split('=', 1)
        if k.startswith('GIT_'): env[k] = v
    lignes = []
    for var in ('GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT'):
        try:
            r = subprocess.run(['git', '-C', c['d']] + c['conf'] + ['var', var], capture_output=True, timeout=20, env=env)
        except Exception as e:
            print('git impossible dans ' + c['d'] + ' : ' + str(e), file=sys.stderr); sys.exit(3)
        if r.returncode == 0: lignes.append(re.sub(r' [0-9]+ [+-][0-9]{4}$', '', r.stdout.decode('utf-8', 'replace').strip()))
    return '\n'.join(lignes)

def lignes_diff(d, *args):
    code, out = git(d, 'diff', '--unified=0', '--no-color', *args)
    return out.decode('utf-8', 'replace') if code == 0 else ''

def lignes_non_suivis(d, chemins, force):
    opts = ['ls-files', '-z', '--others'] + ([] if force else ['--exclude-standard']) + ['--'] + chemins
    code, out = git(d, *opts)
    if code != 0: return ''
    morceaux = []
    for f in [x for x in out.decode('utf-8', 'replace').split('\0') if x]:
        try:
            with open(os.path.join(d, f), 'rb') as h: brut = h.read()
        except OSError: continue
        if b'\0' in brut: continue  # binaire : ignoré, comme « Binary files differ » dans un diff
        morceaux.append(bloc(f, brut.decode('utf-8', 'replace')))
    return ''.join(morceaux)

def controle_large(d):
    return lignes_diff(d, '--cached') + lignes_diff(d) + lignes_non_suivis(d, [':/'], False)

def base_ou_bloquer(d):
    if not git_texte(d, 'rev-parse', '--verify', '--quiet', 'origin/main^{commit}'):
        bloquer('origin/main introuvable dans %s : impossible de savoir ce que la branche publiera.' % d,
                'Lance « git fetch origin main », puis recommence.')

def principal():
    entree = json.load(sys.stdin)
    cmd = str((entree.get('tool_input') or {}).get('command') or '')
    cwd = entree.get('cwd') or os.getcwd()
    etat = {'commits': [], 'ajouts': [], 'pousses': [], 'ecrits': {}}
    sortie, branches = [], []
    try:
        analyser(cmd, cwd, etat)
    except ValueError:
        # commande illisible pour l'analyse : contrôle large du dossier courant, sans dérogation
        if re.search(r'\bgit\b', cmd) and re.search(r'\bcommit\b', cmd):
            sortie += [controle_large(cwd), bloc('[texte de la commande]', cmd)]
        if re.search(r'\bgit\b', cmd) and re.search(r'\bpush\b', cmd):
            if git_texte(cwd, 'symbolic-ref', '--short', '-q', 'HEAD') == 'main':
                bloquer('push depuis la branche main, dans une commande illisible pour le contrôle : refusé (CLAUDE.md règle 3.1).')
            base_ou_bloquer(cwd); branches.append((cwd, 'HEAD'))
        if not sortie and not branches: print('RIEN'); return
        etat['commits'] = etat['pousses'] = []
    commits, pousses = etat['commits'], [p for p in etat['pousses'] if not p['essai']]
    if not commits and not pousses and not sortie and not branches: print('RIEN'); return
    a_controler = [c for c in commits if not c['ok']]
    for x in a_controler + (etat['ajouts'] if a_controler else []) + pousses:
        if x['d'] is None:
            bloquer('le contrôle des secrets ne peut pas savoir dans quel dossier ce « git add », « git commit » ou « git push » '
                    'agit (variable, cd -, --git-dir ou --work-tree). Écris le chemin en clair (git -C /chemin/du/depot …).')
    for p in pousses:   # push vers main : refusé, même avec CP_SECRETS_OK=1
        vers_main, shas = examiner_push(p)
        if vers_main:
            bloquer('push vers main refusé (CLAUDE.md règle 3.1 : la fusion et le déploiement sont des gestes de Gab) : ' + vers_main + '.',
                    'Pousse la branche de la mission (git push -u origin <branche>) et ouvre une demande de fusion en brouillon.')
        if not p['ok'] and shas:
            base_ou_bloquer(p['d'])
            branches += [(p['d'], s) for s in shas]
    for c in a_controler:
        if git(c['d'], 'rev-parse', '--git-dir')[0] != 0: continue  # pas un dépôt : le commit échouera de lui-même
        sortie.append(lignes_diff(c['d'], '--cached'))
        if c['tout']: sortie.append(lignes_diff(c['d']))
        if c['chemins']: sortie.append(lignes_diff(c['d'], '--', *c['chemins']))
        for endroit, texte in textes_message(c, etat): sortie.append(bloc(endroit, texte))
        sortie.append(bloc('[auteur et validateur du commit]', identite(c)))
    for a in (etat['ajouts'] if a_controler else []):
        if git(a['d'], 'rev-parse', '--git-dir')[0] != 0: continue
        ch = a['chemins'] or ([':/'] if (a['tout'] or a['suivis']) else [])
        if not ch: continue
        if any('$' in x or '`' in x for x in ch): ch = [':/']  # chemin inconnu : tout le dossier de travail
        sortie.append(lignes_diff(a['d'], '--', *ch))
        if not a['suivis'] or a['tout']: sortie.append(lignes_non_suivis(a['d'], ch, a['force']))
    if not a_controler and not branches and not sortie: print('ACCORD'); return
    print('CONTROLE')
    for d, s in branches: print('B\t' + d + '\t' + s)
    for l in ''.join(sortie).split('\n'): print('D' + l)

principal()
PY
)

# Hook sans analyse (python3 absent ou en erreur) : contrôle large du dossier courant. Dérogation acceptée seulement pour
# une commande simple : « CP_SECRETS_OK=1 git commit … » ou « CP_SECRETS_OK=1 git push … », sans ; & | $ < > ` ni retour à la ligne.
commande_brute() {
  if command -v jq >/dev/null 2>&1; then printf '%s' "$entree" | jq -r '.tool_input.command // empty' 2>/dev/null && return; fi
  printf '%s' "$entree" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(\([^"\\]\|\\.\)*\)".*/\1/p' | head -n 1 \
    | sed -e 's/\\n/\n/g' -e 's/\\t/\t/g' -e 's/\\"/"/g' -e 's/\\\\/\\/g'
}
degrade() {
  echo "verif-secrets : analyse de la commande impossible (code $1) : mode dégradé, contrôle large du dossier courant." >&2
  local c commit=0 pousse=0
  c=$(commande_brute); [ -n "$c" ] || c=$entree
  case "$c" in *commit*) commit=1 ;; esac
  case "$c" in *push*) pousse=1 ;; esac
  [ "$commit$pousse" = 00 ] && return 0
  if [ "$pousse" = 1 ] && [ "$(git symbolic-ref --short -q HEAD)" = main ]; then
    echo "BLOQUÉ : push depuis la branche main refusé (CLAUDE.md règle 3.1)." >&2; return 2
  fi
  case "$c" in *$'\n'*) ;; *)
    if printf '%s\n' "$c" | grep -qE '^[[:space:]]*CP_SECRETS_OK=1 git (commit|push)( [^;&|$<>`]*)?$'; then
      echo "verif-secrets : dérogation CP_SECRETS_OK=1 acceptée (mode dégradé, commande simple)." >&2; return 0
    fi ;;
  esac
  if [ "$pousse" = 1 ] && ! base_branche . >/dev/null; then sans_base "$(pwd)"; return 2; fi
  {
    if [ "$commit" = 1 ]; then
      git -c core.quotepath=off diff --cached --unified=0 --no-color; git -c core.quotepath=off diff --unified=0 --no-color
      printf '%s\n' "$c" | bloc "[texte de la commande]"
    fi
    [ "$pousse" = 1 ] && contenu_branche . HEAD
  } | verifier
}

if [ "$mode" = "--hook" ]; then
  entree=$(cat)
  case "$entree" in *git*) ;; *) exit 0 ;; esac   # aucune commande git : rien à faire (rapide)
  analyse=$(printf '%s' "$entree" | python3 -c "$ANALYSE"); code=$?
  if [ "$code" = 3 ]; then exit 2; fi
  if [ "$code" != 0 ]; then degrade "$code"; exit $?; fi
  case "$(printf '%s\n' "$analyse" | head -n 1)" in
    RIEN|ACCORD) exit 0 ;;
    CONTROLE)
      {
        printf '%s\n' "$analyse" | sed -n 's/^D//p'
        printf '%s\n' "$analyse" | grep '^B' | while IFS=$'\t' read -r _ d r; do contenu_branche "$d" "$r"; done
      } | verifier; exit $? ;;
    *) degrade "réponse inattendue"; exit $? ;;
  esac
fi
[ "${CP_SECRETS_OK:-0}" = 1 ] && exit 0
if [ "$mode" = "--branche" ]; then
  base_branche . >/dev/null || { sans_base "$(pwd)"; exit 2; }
  contenu_branche . HEAD | verifier
else
  git -c core.quotepath=off diff --cached --unified=0 --no-color | verifier
fi
exit $?
