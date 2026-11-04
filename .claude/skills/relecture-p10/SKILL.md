---
name: relecture-p10
description: Relecture indépendante (P10) d'une branche de mission ClimPilot et de son compte rendu, par l'autre modèle, en lecture seule, avant toute fusion par Gab.
---

# Relecture P10 (lecture seule, aucun commit, aucune correction directe)

Entrées données par Gab : la branche `<nom>` et la mission `<MISSION>` (compte rendu `docs/<MISSION>-COMPTE-RENDU.md`).
Tu n'as pas à être d'accord avec l'exécutant. Tu respectes `CLAUDE.md` (règles absolues).

Vérifie, et pour chaque point écris ce que tu as exécuté :
1. Chaque test annoncé ROUGE l'était vraiment : rejoue-le sur le commit d'avant la correction, dans un dossier à part (`git worktree add`), puis VERT sur la tête.
2. Golden identiques : suites Y et Z, `git diff --stat <base>..HEAD -- tests/golden` vide. Sinon, la régénération est exactement celle annoncée et validée par Gab.
3. « Ce que ça change pour Gab » est exact et complet. Cherche les cas non couverts : hors ligne, deux appareils, données anciennes, iPhone / Safari, noms avec apostrophe, très gros volumes, date d'un autre jour (`faketime`).
4. Aucun code applicatif hors périmètre n'a bougé (`git diff --stat`).
5. Aucun secret ni donnée personnelle ajouté : `bash tools/claude/verif-secrets.sh --branche`.
6. CI verte sur le dernier commit de la branche (check-run « rapport — batterie complète »).
7. Le compte rendu public ne décrit aucune faille non corrigée en détail.

Compte rendu dans le Project (outil Projects, `project_write`) : `claude/ClimPilot-<MISSION>-RELECTURE.md`.
- Verdict en 5 lignes : fusionnable / sous conditions / non.
- Puis les constats numérotés, avec leur gravité (bloquant, à corriger avant fusion, mineur) et leur certitude (certain / probable / hypothèse).
- Les conditions sont écrites de façon que Gab puisse les transmettre telles quelles à l'exécutant.
