#!/bin/bash
# ClimPilot : contrôle avant commit. Aucun secret ni donnée personnelle dans les lignes AJOUTÉES (dépôt public).
# Usage :
#   bash tools/claude/verif-secrets.sh            lignes ajoutées et indexées (git diff --cached)
#   bash tools/claude/verif-secrets.sh --branche  toute la branche par rapport à origin/main
#   (hook) --hook : lit le JSON du hook PreToolUse (Bash) sur l'entrée standard et n'agit que si la COMMANDE
#          (tool_input.command, jamais la description) lance « git [options] commit ».
# Motifs privés (rue, ville, e-mails perso) : variable d'environnement CP_MOTIFS_PRIVES (regex étendues séparées par |),
# posée dans l'environnement Claude Code de Gab, jamais écrite dans le dépôt.
# Faux positif vérifié ligne par ligne : relancer la commande avec CP_SECRETS_OK=1 et le justifier dans le compte rendu.
#   - à la main : CP_SECRETS_OK=1 bash tools/claude/verif-secrets.sh ;
#   - hook : CP_SECRETS_OK=1 posé EN TÊTE de la commande « git commit » (CP_SECRETS_OK=1 git commit …), rien d'autre.
#
# Hook (OUTILLAGE-2, 05/11/2026), ce qui est contrôlé pour chaque « git [options] commit » de la commande :
#   - l'index du dépôt visé (git -C <dossier>, ou dernier « cd <dossier> » de la commande, sinon le dossier courant du hook) ;
#   - les fichiers nommés dans un « git add … » de la même commande (le hook tourne AVANT le git add) : modifications des
#     fichiers suivis et contenu des fichiers non suivis ; « git add -A / --all / . » : tout le dossier de travail ;
#   - « git commit -a / --all » : toutes les modifications des fichiers suivis ; « git commit <fichiers> » : ces fichiers.
#   Dossier impossible à connaître (variable, --git-dir) : bloqué, avec le message « écris le chemin en clair ».
#   Analyse impossible (python3 absent, guillemets non fermés) : contrôle large du dossier courant, sans CP_SECRETS_OK.
set -u
mode="${1:-}"

# Lit des lignes de diff (ou des lignes « + ») sur l'entrée standard ; code 2 et message si un motif est trouvé.
verifier() {
  local ajouts motifs trouve
  ajouts=$(grep -E '^\+' | grep -vE '^\+\+\+ ' || true)
  motifs='eyJ[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY|FR76[0-9 ]{10,}|IBAN[[:space:]:]*[A-Z]{2}[0-9]{2}[0-9 ]{8,}|@(gmail|hotmail|outlook|yahoo|icloud|live|orange|free|sfr|laposte|wanadoo)\.|(\+33|0)[67]([ .-]?[0-9]{2}){4}'
  [ -n "${CP_MOTIFS_PRIVES:-}" ] && motifs="$motifs|$CP_MOTIFS_PRIVES"
  trouve=$(printf '%s\n' "$ajouts" | grep -nEi "$motifs" || true)
  if [ -n "$trouve" ]; then
    echo "BLOQUÉ : secret ou donnée personnelle possible dans les lignes ajoutées (dépôt public) :" >&2
    printf '%s\n' "$trouve" | cut -c1-200 >&2
    echo "Remplace par <email>, <tel>, <adresse>… Faux positif vérifié : relance avec CP_SECRETS_OK=1 et justifie-le." >&2
    return 2
  fi
  return 0
}

# Analyse de la commande du hook (python3, bibliothèque standard seulement). Sortie : 1re ligne RIEN | ACCORD | CONTROLE,
# puis, pour CONTROLE, les lignes à contrôler (préfixe « + »). Code 3 : commande à bloquer (raison sur la sortie d'erreur).
ANALYSE=$(cat <<'PY'
import json, os, re, shlex, subprocess, sys

def git(d, *args):
    try:
        r = subprocess.run(['git', '-C', d] + list(args), capture_output=True, timeout=20)
    except Exception as e:
        print('git impossible dans ' + d + ' : ' + str(e), file=sys.stderr); sys.exit(3)
    return r.returncode, r.stdout

def chemin(base, p):
    """Dossier absolu, ou None s'il dépend d'une variable inconnue."""
    if base is None: return None
    p = os.path.expanduser(os.path.expandvars(p))
    if '$' in p or '`' in p: return None
    return os.path.normpath(os.path.join(base, p))

HEREDOC = re.compile(r'''(?<!<)<<(?!<)(-?)[ \t]*\\?(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2''')
def sans_corps_heredoc(cmd):
    """Retire le corps des documents en ligne (<<EOF … EOF) : du texte, pas des commandes (message de commit…)."""
    sortie, attente = [], []
    for ligne in cmd.split('\n'):
        if attente:
            fin, tab = attente[0]
            if (ligne.lstrip('\t') if tab else ligne) == fin: attente.pop(0)
            continue
        sortie.append(ligne)
        for m in HEREDOC.finditer(ligne): attente.append((m.group(3), m.group(1) == '-'))
    return '\n'.join(sortie)

SEPARE = set(';&|()')
REDIR = set('<>&')
MOTS_CLES = {'{', '}', '!', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time', 'fi', 'done', 'case', 'esac'}
AFFECT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*=')

def commandes_simples(cmd):
    cmd = sans_corps_heredoc(cmd).replace('\\\n', ' ').replace('\n', ' ; ').replace('`', ' ; ')
    lx = shlex.shlex(cmd, posix=True, punctuation_chars=';&|()<>')
    lx.whitespace_split = True; lx.commenters = ''
    jetons = list(lx)  # ValueError si guillemets non fermés
    cour, tout = [], []
    i = 0
    while i < len(jetons):
        t = jetons[i]
        if t and set(t) <= SEPARE:
            if cour: tout.append(cour); cour = []
        elif t and set(t) <= REDIR:
            i += 1  # redirection : la cible n'est pas un argument
        elif t.isdigit() and i + 1 < len(jetons) and jetons[i + 1] and set(jetons[i + 1]) <= REDIR:
            pass    # « 2>&1 » : le numéro de flux n'est pas un argument
        else:
            cour.append(t)
        i += 1
    if cour: tout.append(cour)
    return tout

GIT_AVEC_ARG = {'-c', '--namespace', '--config-env', '--super-prefix'}
CONNUS = set('status log diff show fetch push pull checkout switch branch merge rebase stash worktree rev-parse config remote tag reset '
             'restore rm mv ls-files ls-remote grep blame cherry-pick revert clone init apply am format-patch describe shortlog reflog gc '
             'clean notes submodule bisect cat-file rev-list for-each-ref symbolic-ref update-ref hash-object show-ref var help version'.split())

def lire_git(mots, i, dossier):
    """mots[i] est « git » : rend (dossier visé, sous-commande, arguments, dossier_inconnu)."""
    j, d, inconnu = i + 1, dossier, False
    while j < len(mots):
        w = mots[j]
        if w == '-C' and j + 1 < len(mots):
            d = chemin(d, mots[j + 1]) if mots[j + 1] else d; j += 2; continue
        if w in ('--git-dir', '--work-tree'):
            inconnu = True; j += 2; continue
        if w.startswith('--git-dir=') or w.startswith('--work-tree='):
            inconnu = True; j += 1; continue
        if w in GIT_AVEC_ARG and j + 1 < len(mots):
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
        elif val:
            try: mots_alias = shlex.split(val)
            except ValueError: mots_alias = val.split()
            if mots_alias and mots_alias[0] in ('commit', 'add'): sous, args = mots_alias[0], mots_alias[1:] + args
    return d, sous, args, inconnu

def options_commit(args):
    tout, chemins, fin, j = False, [], False, 0
    long_arg = {'--message', '--file', '--reuse-message', '--reedit-message', '--template', '--author', '--date', '--cleanup',
                '--fixup', '--squash', '--trailer', '--pathspec-from-file'}
    while j < len(args):
        w = args[j]
        if fin or w == '-' or not w.startswith('-'):
            if fin or w != '-': chemins.append(w)
        elif w == '--':
            fin = True
        elif w.startswith('--'):
            nom = w.split('=', 1)[0]
            if nom in ('--all', '--pathspec-from-file'): tout = True
            if nom in long_arg and '=' not in w: j += 1
        else:
            for k, ch in enumerate(w[1:], 1):
                if ch == 'a': tout = True
                if ch in 'mFCct':
                    if k == len(w) - 1: j += 1  # argument dans le mot suivant
                    break
                if ch in 'Su': break           # argument facultatif collé
        j += 1
    return tout, chemins

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

def analyser(cmd, cwd, commits, ajouts, profondeur=0):
    dossier = cwd
    for mots in commandes_simples(cmd):
        k = 0
        while k < len(mots) and mots[k] in MOTS_CLES: k += 1
        tete = []
        while k < len(mots) and AFFECT.match(mots[k]): tete.append(mots[k]); k += 1
        reste = mots[k:]
        if not reste: continue
        if reste[0] == 'cd':
            cible = [w for w in reste[1:] if w != '--']
            dossier = chemin(dossier, cible[0]) if cible and cible[0] != '-' else (os.path.expanduser('~') if not cible else None)
            continue
        if os.path.basename(reste[0]) in ('bash', 'sh', 'zsh', 'dash') and profondeur < 3:
            for n, w in enumerate(reste[1:], 1):
                if re.fullmatch(r'-[a-z]*c[a-z]*', w) and n + 1 < len(reste):
                    analyser(reste[n + 1], dossier, commits, ajouts, profondeur + 1); break
        if reste[0] == 'eval' and profondeur < 3:
            analyser(' '.join(reste[1:]), dossier, commits, ajouts, profondeur + 1)
        g = next((n for n, w in enumerate(reste) if os.path.basename(w) == 'git'), None)
        if g is None: continue
        d, sous, args, inconnu = lire_git(reste, g, dossier)
        if inconnu: d = None
        if sous == 'commit':
            tout, chemins = options_commit(args)
            commits.append({'d': d, 'ok': 'CP_SECRETS_OK=1' in tete, 'tout': tout, 'chemins': chemins})
        elif sous == 'add':
            tout, suivis, force, chemins = options_add(args)
            ajouts.append({'d': d, 'tout': tout, 'suivis': suivis, 'force': force, 'chemins': chemins})

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
        morceaux.append('+++ b/' + f + '\n' + ''.join('+' + l + '\n' for l in brut.decode('utf-8', 'replace').split('\n')))
    return ''.join(morceaux)

def controle_large(d):
    return lignes_diff(d, '--cached') + lignes_diff(d) + lignes_non_suivis(d, [':/'], False)

def principal():
    entree = json.load(sys.stdin)
    cmd = str((entree.get('tool_input') or {}).get('command') or '')
    cwd = entree.get('cwd') or os.getcwd()
    commits, ajouts = [], []
    try:
        analyser(cmd, cwd, commits, ajouts)
    except ValueError:
        # commande illisible pour l'analyse : si elle peut lancer un commit, contrôle large, sans dérogation
        if re.search(r'\bgit\b', cmd) and re.search(r'\bcommit\b', cmd):
            print('CONTROLE'); print(controle_large(cwd)); return
        print('RIEN'); return
    if not commits: print('RIEN'); return
    a_controler = [c for c in commits if not c['ok']]
    if not a_controler: print('ACCORD'); return
    for x in a_controler + ajouts:
        if x['d'] is None:
            print('BLOQUÉ : le contrôle des secrets ne peut pas savoir dans quel dossier ce « git add » ou « git commit » agit '
                  '(variable, cd -, --git-dir ou --work-tree). Écris le chemin en clair (git -C /chemin/du/depot commit …).', file=sys.stderr)
            sys.exit(3)
    sortie = []
    for c in a_controler:
        if git(c['d'], 'rev-parse', '--git-dir')[0] != 0: continue  # pas un dépôt : le commit échouera de lui-même
        sortie.append(lignes_diff(c['d'], '--cached'))
        if c['tout']: sortie.append(lignes_diff(c['d']))
        if c['chemins']: sortie.append(lignes_diff(c['d'], '--', *c['chemins']))
    for a in ajouts:
        if git(a['d'], 'rev-parse', '--git-dir')[0] != 0: continue
        ch = a['chemins'] or ([':/'] if (a['tout'] or a['suivis']) else [])
        if not ch: continue
        if any('$' in x or '`' in x for x in ch): ch = [':/']  # chemin inconnu : tout le dossier de travail
        sortie.append(lignes_diff(a['d'], '--', *ch))
        if not a['suivis'] or a['tout']: sortie.append(lignes_non_suivis(a['d'], ch, a['force']))
    print('CONTROLE'); print(''.join(sortie))

principal()
PY
)

if [ "$mode" = "--hook" ]; then
  entree=$(cat)
  case "$entree" in *git*) ;; *) exit 0 ;; esac   # aucune commande git : rien à faire (rapide)
  analyse=$(printf '%s' "$entree" | python3 -c "$ANALYSE"); code=$?
  if [ "$code" = 3 ]; then exit 2; fi
  if [ "$code" != 0 ]; then
    # python3 absent ou en erreur : contrôle large (index + fichiers suivis modifiés) dès qu'un commit est possible
    echo "verif-secrets : analyse de la commande impossible (code $code) : contrôle large du dossier courant, sans CP_SECRETS_OK." >&2
    printf '%s' "$entree" | grep -q 'commit' || exit 0
    { git diff --cached --unified=0 --no-color; git diff --unified=0 --no-color; } | verifier; exit $?
  fi
  case "$(printf '%s\n' "$analyse" | head -n 1)" in
    RIEN|ACCORD) exit 0 ;;
    CONTROLE) printf '%s\n' "$analyse" | tail -n +2 | verifier; exit $? ;;
    *) echo "verif-secrets : réponse inattendue de l'analyse : contrôle large." >&2
       { git diff --cached --unified=0 --no-color; git diff --unified=0 --no-color; } | verifier; exit $? ;;
  esac
fi
[ "${CP_SECRETS_OK:-0}" = 1 ] && exit 0
if [ "$mode" = "--branche" ]; then
  git diff origin/main...HEAD --unified=0 --no-color | verifier
else
  git diff --cached --unified=0 --no-color | verifier
fi
exit $?
