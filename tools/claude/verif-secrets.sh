#!/bin/bash
# ClimPilot : contrôle avant commit. Aucun secret ni donnée personnelle dans les lignes AJOUTÉES (dépôt public).
# Usage :
#   bash tools/claude/verif-secrets.sh            lignes ajoutées et indexées (git diff --cached)
#   bash tools/claude/verif-secrets.sh --branche  toute la branche par rapport à origin/main
#   (hook) lit la commande sur l'entrée standard (JSON du hook) et n'agit que sur « git commit »
# Motifs privés (rue, ville, e-mails perso) : variable d'environnement CP_MOTIFS_PRIVES (regex étendues séparées par |),
# posée dans l'environnement Claude Code de Gab, jamais écrite dans le dépôt.
# Faux positif vérifié ligne par ligne : relancer la commande avec CP_SECRETS_OK=1 et le justifier dans le compte rendu.
set -u
mode="${1:-}"
if [ "$mode" = "--hook" ]; then
  entree=$(cat)
  printf '%s' "$entree" | grep -qE 'git[[:space:]]+commit' || exit 0
  printf '%s' "$entree" | grep -q 'CP_SECRETS_OK=1' && exit 0
fi
[ "${CP_SECRETS_OK:-0}" = 1 ] && exit 0
if [ "$mode" = "--branche" ]; then
  diff=$(git diff origin/main...HEAD --unified=0 --no-color)
else
  diff=$(git diff --cached --unified=0 --no-color)
fi
ajouts=$(printf '%s\n' "$diff" | grep -E '^\+' | grep -vE '^\+\+\+ ' || true)
motifs='eyJ[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY|FR76[0-9 ]{10,}|IBAN[[:space:]:]*[A-Z]{2}[0-9]{2}[0-9 ]{8,}|@(gmail|hotmail|outlook|yahoo|icloud|live|orange|free|sfr|laposte|wanadoo)\.|(\+33|0)[67]([ .-]?[0-9]{2}){4}'
[ -n "${CP_MOTIFS_PRIVES:-}" ] && motifs="$motifs|$CP_MOTIFS_PRIVES"
trouve=$(printf '%s\n' "$ajouts" | grep -nEi "$motifs" || true)
if [ -n "$trouve" ]; then
  echo "BLOQUÉ : secret ou donnée personnelle possible dans les lignes ajoutées (dépôt public) :" >&2
  printf '%s\n' "$trouve" | cut -c1-200 >&2
  echo "Remplace par <email>, <tel>, <adresse>… Faux positif vérifié : relance avec CP_SECRETS_OK=1 et justifie-le." >&2
  exit 2
fi
exit 0
