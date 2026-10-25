# ClimPilot — Fusion 1.13.0 (M0 + P0 + C1 + tests du jour) — compte rendu P2

> Rédigé le 25/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy. Branche **`release/1.13.0`**, demande de fusion **#5** `release/1.13.0 → main`, **en brouillon : rien n'est fusionné, rien n'est déployé, aucune base Supabase touchée.**
> Certitude : **certain** (exécuté ici ou lu dans la CI), **probable** (déduit), **hypothèse**.

## Ce que tu décides et fais (10 lignes)

1. **Tu valides la version unique `1.13.0`** (`VERSION`, « Next 1.13.0 » sous le logo, cache `climpilot-next-1130-production`) — décision proposée en M0 § 7, appliquée ici ; dis-moi si tu veux un autre numéro.
2. **Tu valides une seule fusion** (`release/1.13.0 → main`, merge commit) au lieu de trois (#4 puis P0 puis C1) : même contenu, un seul retour arrière. Les PR #2, #3, #4 seront fermées sans fusion après.
3. **Lundi** : copie d'essai `ClimPilot-ESSAI-1130-production.zip` sur Netlify (config TEST déjà remplie), liste A3 **colonne ESSAI** complète (15 contrôles : le 5 bis du 24/10 est acquis, le 5 ter est refait ; ~1 h ; en ESSAI les numéros sont `F-…` et `AV-…` du registre TEST, voir M0 § A3 mis à jour le 25/10 au soir). Un échec = tu notes et tu me le dis, on ne fusionne pas.
4. Activer la **protection de `main`** (Settings › Branches › Add rule › `main` › Require status checks › « batterie complète »).
5. Verrouillage des appareils (M4 C12), adresse `noreply` GitHub (M4 C17). Mot de passe (M4 C4) : l'appli n'a **pas** d'écran pour le changer (vérifié le 25/10) → écran à ajouter à la mission sécurité ; ne rien bricoler dans Supabase d'ici là.
6. **Sauvegarde serveur avant fusion** (SQL Editor du projet **RÉEL**) : coller tout `tests/supabase-test/5-REEL-avant-fusion-1.13.sql` (ajouté le 25/10 : refuse de tourner sur TEST ; `cp_backup_row` ne rend rien, le script affiche ensuite la sauvegarde) → 1re ligne `avant-1.13.0`, noter son `id`.
7. **Fusion** : PR #5 › « Ready for review » › « Merge pull request » (merge commit, pas squash) ; attendre la publication Pages (1-3 min).
8. **Sur chaque appareil** : ouvrir ClimPilot, F5 ; sous le logo : « Next 1.13.0 » (sur le PC ; sur le téléphone ce texte est masqué, voulu : menu ☰ › la ligne « Objectifs & feux » doit exister). Puis liste A3 **colonne PROD** (factures en mode démonstration seulement).
9. **Migration C1 sur le réel** (SQL Editor, projet réel) : coller tout `tests/supabase-test/5-REEL-migration-C1.sql` (= la migration telle quelle + la partie 3 du script TEST, avec un verrou « pas sur TEST » ; vérifié le 25/10 sur PostgreSQL local) → 5 « OK ». Retour arrière : `4-une-facture-par-source-retour-arriere.sql`.
10. Fermer #2, #3, #4 ; supprimer les branches contenues (`claude/*`, `fusion/avant-refonte`, `refonte/p0-filet`, `correctif/c1-*`, `refonte/ci-dates`, `refonte/p0-suite`). Ensuite seulement : C3 depuis `main`.

## 1. Contenu de `release/1.13.0` (certain)

| Couche | Commits | Ce que c'est |
|---|---|---|
| `fusion/avant-refonte` (M0, 20-21/10) | 45 | les 7 branches 1.11/1.12/fiabilité/optimisation/planning réunies ; +7 077 lignes, 54 fichiers |
| `refonte/p0-filet` (P0, 21/10) | 17 + `dc3aef4` récupéré ici (fiche M0 du 21/10 au soir, oubliée par C1) | CI, golden calculs/documents/XML, suites U à Z, aucune ligne applicative |
| `correctif/c1-registre-illisible` (C1, 21 et 24/10) | 5 | `next-emission.js` : rien n'est émis si le registre ne se lit pas ; « Résultat INCONNU » si le réseau tombe pendant l'envoi ; migration « une facture vivante par source » (appliquée sur TEST, **pas sur le réel**) |
| `refonte/ci-dates` (24/10) | 1 | suite T et script Google indépendants du jour réel — première CI verte (#15) |
| **`release/1.13.0`** (25/10) | 2 (`8aa2e75` fusion de P0, `5d012cf` version) | version unique ; test I7 lit `CP_VERSION` ; fiche M0 alignée |

Par rapport à `main` (1.10.0) : **70 commits, 98 fichiers, +21 944 / −189 lignes**. Fichiers applicatifs touchés par P2 elle-même : **3 lignes** (`next-emission.js:39`, `next-addons.js:8`, `sw.js:1`) — `git diff refonte/ci-dates release/1.13.0 --stat` : 6 fichiers (3 applicatifs, 1 test, 2 docs).

## 2. Pourquoi `1130` après `1131` (certain)
Le nom de cache n'est pas comparé numériquement : le service worker supprime tout cache dont le nom diffère du sien. `1130-production` remplace donc bien `1131-fusion` (copies d'essai) comme `1100-production` (production actuelle). La suite P exige `climpilot-next-1[1-9]\d\d` : `1130` passe. L'outil de copie d'essai dérive le nom du zip du cache : `ClimPilot-ESSAI-1130-production`.

## 3. Vérification
- Suites locales sur `5d012cf` : **A 14/14, P 138/138 (nom de cache), X 8/8 (mise à jour hors réseau), V 8/8 ; I 38/38 et N 37/37** (ces deux-là hors espace réseau isolé : Chromium 153 local, artefact connu C1 § 9.6 ; dans `unshare -n` elles plantent à I5/N1 **avant et après** le changement, donc sans rapport).
- I7 (certain) : la version envoyée au serveur par `cpStatePushRpc` est bien `window.CP_VERSION` = `1.13.0`.
- **CI GitHub** : passage #18 sur `ed7a5a8` (23:04 UTC) : **1 100 réussis, 1 échoué** — `suiteR-fiabilite`, contrôle « date affichée » de l'export complet : la page est en Europe/Paris (25/10 après minuit), le runner GitHub en UTC (encore le 24/10) ; le test comparait les deux dates « locales ». **Défaut du test, pas de l'appli** (certain : rejoué ici à 23:06 UTC, rouge avant / 42/42 après la correction `timeZone:'Europe/Paris'`, commit suivant). Même famille que la suite T du 24/10 : c'est le 5e test dépendant de l'horloge réelle trouvé en deux jours (R12) — P0-suite doit figer les 3 restants (E:53, N:30, V:11). Verdict du passage suivant reporté ci-dessous.
- **CI GitHub sur `c648abd` : passages #20 (push) et #21 (PR #5) — COMPLET, RÉUSSI : 1 100 réussis, 0 échoué, 2 SKIP connus, 6 non bloquants (1 INSTABLE Q « acompte », 5 À TRANCHER M3 C2)** (certain).
- Golden calculs (Z) et documents (Y) : identiques (aucun calcul touché ; les 5 « À TRANCHER » M3 C2 restent en attente de ta comptable).
- Secrets : `grep eyJ|sk-ant|@gmail|IBAN|FR76` sur les fichiers modifiés : rien. La clé anon du projet **TEST** est dans le zip de la copie d'essai **seulement** (jamais dans le dépôt).

## 4. Copie d'essai
`Claude outputs/P2-fusion-1.13/ClimPilot-ESSAI-1130-production.zip` + `LISEZ-MOI-ESSAI-1.13.txt`. Construite par `tools/essai/construire-copie-essai.sh` depuis `5d012cf` ; hôte réel retiré, bandeau rouge, cache `climpilot-essai-1130-production` ; `essai-config.js` **déjà rempli** avec l'adresse et la clé publique du projet ClimPilot-TEST (vérifié : le fichier refuse le projet réel). Déploiement : Netlify › Deploys › glisser le zip, F5.

## 5. Retour arrière (après fusion)
1. Appli : GitHub › PR #5 › « Revert » (ou `git revert -m 1 <commit de fusion>` sur `main`) → republie la 1.10.0 `1c91cca` ; F5 sur chaque appareil (le cache `1100-production` reprend).
2. Données : la 1.10 ne connaît pas les 10 clés 1.11/1.12 et les retire du serveur à sa première modification (fiche M0 A4, certain) — d'où la sauvegarde `avant-1.13.0` (et `avant-retour-arriere-1.10` à prendre avant de revenir). Les copies locales des appareils gardent ces clés.
3. Serveur : si la migration C1 a été appliquée, `tests/supabase-test/4-une-facture-par-source-retour-arriere.sql` remet la fonction 1.10 mot pour mot.

## 6. Ce qui n'est pas vérifié
- Aucun vrai appareil (iPhone/Safari) : c'est la liste A3 ESSAI qui le couvre, par toi.
- La protection de `main` : je ne peux pas la lire ni l'activer (droit refusé à la session).
- Le comportement de GitHub Pages après la fusion (publication 1-3 min) : déduit des publications précédentes.
- Aucune règle fiscale ni réglementaire touchée ni vérifiée (hors périmètre).

## 7. P0-suite intégrée (25/10/2026, P1-bis, Opus)
- `refonte/p0-suite` (Sonnet, 24-25/10 : Q « acompte » et « voile » de nouveau bloquants, T5b, faux serveur réaliste, R12) fusionnée dans `release/1.13.0` : commit `4f6de31`. **Tests et docs seulement** (`git diff --stat 044faf8..4f6de31` : 16 fichiers, tous sous `tests/` et `docs/`).
- Un seul conflit, `tests/suiteR-fiabilite.mjs` (contrôle « date affichée » corrigé le même soir des deux côtés) : version P0-suite gardée (date lue dans la page, aucune horloge Node). `docs/REPRISE.md` et `tests/suiteI-emission.mjs` gardent les deux apports (I7 lit `CP_VERSION` ; I3 contrôle la forme réelle de supabase-js).
- La copie d'essai `ClimPilot-ESSAI-1130-production.zip` reste valable : aucun fichier de l'appli n'a changé depuis `5d012cf` (certain, `git diff --stat 5d012cf..HEAD` hors tests/docs/.github : vide).
- Ajouts du 25/10 pour tes gestes : `tests/supabase-test/5-REEL-avant-fusion-1.13.sql` et `5-REEL-migration-C1.sql` (points 6 et 9), joués sur PostgreSQL local (base 1.10 + un état) : sauvegarde `avant-1.13.0` affichée ; 5 « OK », rejouable ; avec le marqueur TEST : « STOP », rien écrit ; retour arrière puis re-migration : OK.
- CI et relecture indépendante : § 8.

## 8. Relecture indépendante (P10, Opus 5.5, 25/10/2026 au soir)
- **Verdict : fusionnable sous conditions** — les conditions sont les gestes déjà listés en tête (points 1 à 10), plus deux : cocher « Keep my email addresses private » dans GitHub **avant** de cliquer « Merge » (sinon le commit de fusion porte ton e-mail) ; après la publication, ouvrir `https://gablry8.github.io/cp-gl2607/vendor/supabase-js-2.117.3.umd.js` (du code doit s'afficher, pas une 404) **avant** de mettre à jour les appareils — le dossier `vendor/` n'a jamais encore été publié par GitHub Pages.
- CI sur `4f6de31` : #25 et #26 **COMPLET, RÉUSSI** (1 107 réussis, 0 échoué, 2 SKIP connus, 5 À TRANCHER) ; mêmes résultats sur les deux commits de documents qui suivent, `7aa340b` (#27, #28) et `331b5db` (#29, #30). Batterie rejouée indépendamment : **1 111 réussis, 0 échoué** (artefacts de banc connus rejoués à part).
- Rejeux « rouge avant / vert après » de la P0-suite : R12 au 05/01/2027 (E, F, M), faux serveur (I), mutation de `completerGeo` (T5b) : **tous conformes**.
- **Contrôle R12 complet** (batterie entière sous `faketime '2027-01-05 10:00:00'`, `4f6de31`, 25/10 au soir) : 994 réussis, 2 échoués (les 2 artefacts connus de la veth : autotest « boucle locale », suite X « hors ligne après mise à jour »), suite Q **sans résultat** (bloquée à la fermeture d'un navigateur de test juste après sa partie 1, délai de 20 min dépassé), sql non joué (pas de PostgreSQL dans ce passage). Rejoués sous le même faketime : **Q 64/64** (483 s, aucune fermeture bloquée), **sql 51/51** (PostgreSQL lui aussi en 2027), autotest 20/20 et **X 8/8 deux fois** sans la veth. Total : **1 111 réussis, 0 échoué, comme à la date réelle** : rien ne dépend de l'année dans l'appli ni dans les tests (certain pour ces deux dates). Deux instabilités **du banc**, pas de l'appli, à traiter en P8 (outillage) : la fermeture d'un contexte de la suite Q s'est bloquée une fois (1 passage sur 2) ; le rechargement hors ligne de la suite X plante parfois en 30 s (« page.reload: Timeout »), **aussi à la date réelle** (1 rejeu sur 4 ce soir). Aucun des passages de la CI qui ont un rapport (#9 à #30) ne montre l'une ou l'autre (vérifié : leurs échecs passés venaient des suites R, T et `fn-apps-script`).
- Code applicatif relu ligne à ligne depuis la relecture M3/M4 (`682b9b5`) : C1 (`next-emission.js`), la version (3 lignes), la migration C1 et son retour arrière (fonction 1.10 remise **mot pour mot**, comparée) : aucun défaut bloquant.
- Corrigé dans les documents : la fiche M0 disait de fusionner **#4** (c'est **#5**) ; « noter l'id » de la sauvegarde était impossible (`cp_backup_row` ne renvoie rien) → scripts `5-REEL-*.sql`.
- Trouvé en passant, **présent depuis la 1.10**, ne bloque pas la fusion : une fiche fluide signée perd la signature du détenteur si on la rouvre et qu'on l'enregistre (reproduit). Correction : mission AF1 (`docs/MISSION-AF-CORRECTIONS.md`, D6). D'ici là : ne pas rouvrir une fiche fluide signée pour l'enregistrer.
- Détail complet : Project Claude, `claude/ClimPilot-FUSION-1.13-RELECTURE.md`.

*Fin du compte rendu P2. Prochaine étape : tes points 1 à 5, puis la fusion.*
