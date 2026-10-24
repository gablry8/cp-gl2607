# ClimPilot — Fusion 1.13.0 (M0 + P0 + C1 + tests du jour) — compte rendu P2

> Rédigé le 25/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy. Branche **`release/1.13.0`**, demande de fusion **#5** `release/1.13.0 → main`, **en brouillon : rien n'est fusionné, rien n'est déployé, aucune base Supabase touchée.**
> Certitude : **certain** (exécuté ici ou lu dans la CI), **probable** (déduit), **hypothèse**.

## Ce que tu décides et fais (10 lignes)

1. **Tu valides la version unique `1.13.0`** (`VERSION`, « Next 1.13.0 » sous le logo, cache `climpilot-next-1130-production`) — décision proposée en M0 § 7, appliquée ici ; dis-moi si tu veux un autre numéro.
2. **Tu valides une seule fusion** (`release/1.13.0 → main`, merge commit) au lieu de trois (#4 puis P0 puis C1) : même contenu, un seul retour arrière. Les PR #2, #3, #4 seront fermées sans fusion après.
3. **Lundi** : copie d'essai `ClimPilot-ESSAI-1130-production.zip` sur Netlify (config TEST déjà remplie), liste A3 **colonne ESSAI** complète (14 contrôles, ~1 h). Un échec = tu notes et tu me le dis, on ne fusionne pas.
4. Activer la **protection de `main`** (Settings › Branches › Add rule › `main` › Require status checks › « batterie complète »).
5. Mot de passe ClimPilot unique et long + verrouillage des appareils (M4 C4/C12), adresse `noreply` GitHub (M4 C17).
6. **Sauvegarde serveur avant fusion** (SQL Editor du projet **RÉEL**) : `select public.cp_backup_row(user_id, data, 'avant-1.13.0') from public.climpilot_state;` → noter l'`id`.
7. **Fusion** : PR #5 › « Ready for review » › « Merge pull request » (merge commit, pas squash) ; attendre la publication Pages (1-3 min).
8. **Sur chaque appareil** : ouvrir ClimPilot, F5 ; sous le logo : « Next 1.13.0 ». Puis liste A3 **colonne PROD** (factures en mode démonstration seulement).
9. **Migration C1 sur le réel** (SQL Editor, projet réel) : coller `supabase/migrations/20261021180000_une_facture_par_source.sql`, puis la **partie 3** de `tests/supabase-test/4-une-facture-par-source-TEST.sql` → 5 « OK ». Retour arrière : `4-une-facture-par-source-retour-arriere.sql`.
10. Fermer #2, #3, #4 ; supprimer les branches contenues (`claude/*`, `fusion/avant-refonte`, `refonte/p0-filet`, `correctif/c1-*`, `refonte/ci-dates`). Ensuite seulement : C3 depuis `main`.

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
- **CI GitHub sur `5d012cf` : passage #17 en cours au moment de ce commit — verdict reporté ici dès réception**.
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

*Fin du compte rendu P2. Prochaine étape : tes points 1 à 5, puis la fusion.*
