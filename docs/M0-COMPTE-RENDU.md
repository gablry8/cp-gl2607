# ClimPilot — M0 : compte rendu (réunion des branches sur `fusion/avant-refonte`)

> Rédigé le 20/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy. Fiche d'accompagnement : `M0-MISE-EN-PRODUCTION.md`.
> Certitude de chaque constat : **certain** (lu dans le code ou exécuté ici), **probable** (déduit), **hypothèse**.
> Rien n'a été touché sur `main`, sur la production, sur le projet Supabase réel ni sur le projet de TEST. Aucun secret lu ni demandé. Aucune branche supprimée, aucune demande de fusion fermée.

## 1. Synthèse (5 lignes)
1. La branche `fusion/avant-refonte` (depuis `main` 1.10.0 `1c91cca`) contient tout : 1.11 → 1.12 → fiabilité → optimisation → planning/agenda, en 5 fusions, plus 4 commits de M0 (correction d'un vrai bug téléphone, correction d'un test, scripts serveur, fiche). Elle est poussée sur GitHub ; la demande de fusion vers `main` est **en brouillon**, c'est toi qui fusionnes.
2. Batterie finale (validateurs CEN + FNFE, tests SQL sur un PostgreSQL jetable local) : **882 réussis, 2 échecs, 0 SKIP**. Les 2 échecs sont dans la suite Q (recette deux appareils, chronométrée), sur des contrôles qui changent d'un passage à l'autre : **probable instabilité de timing sur ma machine (2 cœurs)**, pas une régression — voir § 4. Tout le reste est vert, y compris les suites E et T qui étaient rouges sur `planning-20-10`.
3. **Un vrai bug** trouvé et corrigé (certain) : sur `planning-20-10`, la feuille de style téléphone de `next-mobile.js` n'était plus installée (identifiant `nxmStyle` pris par `next-messages.js`) → le bouton « 🎙️ Assistant » recouvrait « Émettre l'avoir » et d'autres boutons de fenêtres, boutons trop petits au doigt. Corrigé (1 ligne) + test de non-régression.
4. Données et mise à jour vérifiées en simulation (certain) : état 1.10 + 2 devis **ancien format** rouverts par la branche → 14 devis recalculés au centime près, factures/avoir conservés, numérotation `TEST-F-2026-003` sans trou ; mise à jour 1.10 → fusion sur un même navigateur : cache remplacé, données gardées, ouverture hors ligne OK avec les bibliothèques embarquées.
5. Serveur : **1 migration** (`climpilot_busy` + 2 fonctions SQL) et **1 fonction** `agenda`, préparées et éprouvées localement avec verrou TEST et retour arrière ; **rien n'a été appliqué**. L'appli marche sans elles (l'envoi des demi-journées se coupe seul).

## 2. Branches réunies
| Ordre | Branche | Commits propres | Fusion | Batterie après fusion |
|---|---|---|---|---|
| 0 | `main` 1.10.0 (`1c91cca`) | — | — | 484 réussis, 0 échec |
| 1 | `claude/objectifs-feux` (1.11) | 4 | sans conflit | 562 / 0 |
| 2 | `claude/ameliorations-1.12` | 17 | sans conflit | 762 / 0 |
| 3 | `claude/fiabilite-sur-1.12` (inclut `fiabilite-19-10`) | 7 | sans conflit | 804 / 0 |
| 4 | `claude/optimisation-20-10` | 2 | sans conflit | 803 / **1** (suite Q, § 4) |
| 5 | `claude/planning-20-10` | 4 | **conflits `sw.js` + `docs/REPRISE.md`** (ton option A) | 859 / **3** (E, T attendus + 1 Q) |
| 6 | corrections M0 (`dc0446c` nxmStyle, `0bb4b0a` test T) | 2 | — | **882 / 2** (Q seulement) |

Certain : après chaque fusion 1 à 4, l'arbre de la branche est **identique octet pour octet** à la pointe fusionnée (`git diff` vide). Les 4 autres branches anciennes du dépôt (`brfr-controle-local`, `login-password-issue-f7cidd`, `da-atelier`, `refonte-devis-phase1`) sont hors mission et n'ont pas été touchées.

Commentaires de la demande #2 (lus, aucune réponse) : batterie du 12/10 (534/0/0) et « la #3 contient la #2 : fusionner la #3 suffit ». Aucune réserve bloquante.

## 3. Conflits et choix
- **`sw.js`** (option A validée par toi) : stratégie réseau d'optimisation (réseau d'abord, copie servie après 2,5 s si le réseau traîne), **réunion** des deux listes de fichiers (56 + 57 → 59 : `vendor/supabase-js-2.117.3`, `vendor/chart-4.5.0`, `next-planning`, `next-messages`, `next-terrain`), cache `climpilot-next-1131-fusion`. Vérifié (certain) : les 58 fichiers listés existent, aucun script/CSS de `index.html` n'est absent du cache, syntaxe OK, suite A « tous en cache hors ligne » verte.
- **`docs/REPRISE.md`** : les deux paragraphes gardés (optimisation puis planning).
- `index.html` : fusion automatique (zones différentes), `next-store.js`, `next-emission.js`, `next-addons.js` : non touchés par les deux pointes.

## 4. Résultats de tests : écarts expliqués
Référence : `planning-20-10` seul = 862 réussis + 2 échecs (+ suite E plantée sans compter).
Final = **882 réussis + 2 échecs**. Compte exact : 862 + 19 (suite E qui tourne à nouveau) + 1 (suite A « petits boutons » passé d'INFO à PASS) + 1 (T5 tournée) + 1 (T9 nouveau test) − 2 (suite Q) = 882. Certain.

| Suite | Planning seul | Final | Explication |
|---|---|---|---|
| E avoirs | plantée (0) | 19/0 | bug `nxmStyle` corrigé (certain) |
| A | 13 + 1 INFO | 14/0 | même cause : `next-mobile.js` pose `.iconbtn{min-width:38px}` sur téléphone ; sans sa CSS, les ✏️ faisaient 29 px (probable, cohérent avec la correction) |
| T terrain | 21/1 | 23/0 | test T5 corrigé (§ 5) + T9 ajouté |
| **Q recette deux appareils** | 62/0 | **60/2** | voir ci-dessous |

**Suite Q** (certain sur les faits, probable sur la cause) : 3 passages de fusion sur 3 ont eu 1 ou 2 échecs, à chaque fois sur un contrôle **différent** (« acompte facturé sur le PC / téléphone pas à jour » ×2, « Dépannage PC + téléphone — essai interrompu : délai dépassé », « voile pendant le rechargement »), alors que les **mêmes arbres** (pointes `optimisation` et `planning`, identiques octet pour octet) ont passé 62/62 à 18:44 et 19:01. `REPRISE.md` (20/10, Fable) notait déjà : « la suite Q a échoué 1 fois sur 62 à chaque passage, jamais au même contrôle, machine lente ». Cause probable : contrôles chronométrés (`calme()`, délais de 30 s) sur une machine à 2 cœurs. **Ce que j'ai vérifié sur le cas « acompte »** : le téléphone a bien repris l'acompte du PC (`F-2027-002`) avant d'émettre un solde `F-2027-003` ; le test attendait qu'il s'arrête après la reprise, il a enchaîné. Je n'ai **pas** pu prouver que le montant du solde tenait compte de l'acompte (le journal ne donne pas le total du devis) : **à contrôler à la main** (fiche § 5, contrôle 5 bis ci-dessous). **2 relances de Q seule, à vide, sur l'arbre final : 61/62 (« voile ») puis 60/62 (« acompte » + « voile »). Puis, pour trancher, Q seule sur les deux pointes d'origine (`optimisation-20-10` et `planning-20-10`, arbres inchangés) dans les mêmes conditions : 61/62 et 61/62, échec « acompte » toutes les deux — alors que ces mêmes arbres avaient passé 62/62 à 18:44 et 19:01.** Conclusion (probable) : le résultat de ces deux contrôles dépend de l'heure ou de la charge de la machine, pas du code fusionné ; ce n'est **pas** une régression de M0. Détail du contrôle « voile » : le test n'accorde que 1,5 s pour voir apparaître le voile de rechargement ; dans tous les échecs, la partie « données » (`apresA`) était vraie des deux côtés : l'intervention du téléphone était bien conservée partout. Détail du contrôle « acompte » : acompte PC 181,34 € puis solde téléphone 423,11 € ; si l'acompte est de 30 %, le total TTC est 604,45 € et 604,45 − 181,34 = 423,11 : **cohérent avec un solde qui tient compte de l'acompte** (probable, pas prouvé : le journal ne donne pas le total).
→ Contrôle manuel à ajouter : sur le téléphone **hors ligne**, facturer le solde d'un devis dont l'acompte vient d'être facturé sur le PC ; attendu : message « déjà facturé depuis un autre appareil », reprise de l'acompte, et solde = total − acompte.

## 5. Corrections faites en M0 (commits séparés, nommés)
1. `dc0446c` — **`next-messages.js`** : identifiant de style `nxmStyle` → `nxmsgStyle` (1 ligne) + test T9 (les deux feuilles présentes). Avant : E échoue 3/3 ; après : E 19/19, A sans INFO.
2. `0bb4b0a` — **`tests/suiteT-terrain.mjs`** (T5 tournée) : le test écrivait les coordonnées directement dans `cpnext_geo` après le démarrage ; `next-adresse.js` lit son cache **en mémoire** au chargement et ne les voyait pas (km = 0, échec 3/3 ici). Le test appelle maintenant `nxadDistance(adresse)` (géocodage simulé par `lib.mjs`), **exactement le chemin de l'appli** (`completerGeo` → `nxadDistance`). Preuve que l'appli calcule bien les km en vrai : c'est ce chemin qui a produit km > 0 ; valeurs attendues inchangées (ordre matin → journée → après-midi, km > 0, itinéraire avec `origin` et `waypoints`). Avant/après : `km:0` → `km>0`, 21/1 → 22/0 (+ T9).
3. `7f936a7` — `tests/supabase-test/3-agenda-TEST.sql` (verrou par marqueur + migration + 6 contrôles) et `3-agenda-retour-arriere.sql` (3 contrôles). Éprouvés sur PostgreSQL 16 local : verrou = STOP sans marqueur ; migration rejouable ; retour arrière rejouable ; autres tables intactes.
4. `a024f92` — `docs/M0-MISE-EN-PRODUCTION.md`.

## 6. Doublons d'identifiants entre `next-*.js` (listés, **non corrigés**)
| id | Fichiers | Risque |
|---|---|---|
| `nxmStyle` | `next-mobile.js`, `next-messages.js` | **corrigé** (§ 5.1) |
| `nxd2PrixDL` | `next-mod-gainable.js:384`, `next-mod-kit.js:229`, `next-mod-split.js:169` | **probable** collision : une `<datalist>` de suggestions d'articles par lot ; avec plusieurs lots dans un devis, `list="nxd2PrixDL"` pointe sur la première, et les listes diffèrent (gainable / kit / split) → suggestions du mauvais lot. Pas vérifié à l'exécution ; n'affecte pas les montants |
| `nxd2mv{i}_{j}` | les 3 mêmes modules | faible : id unique par lot et machine, même motif partagé |
Tous les autres `<style id>` sont uniques (15 vérifiés) ; aucune collision entre `next-*.js` et `index.html` (687 ids, contrôle par recherche de texte, pas à l'exécution).

## 7. Numéro de version : où il sert, ce que le serveur contrôle, proposition
| Endroit | Valeur sur la branche | Sert à |
|---|---|---|
| `next-emission.js` l. 39 `VERSION` → `window.CP_VERSION` | **`1.10.0`** (jamais monté depuis) | envoyé au serveur à chaque émission (`p_client_version` de `cp_emettre_document`) et à chaque synchro (`cp_state_push`) ; **écrit dans le registre** de chaque facture/avoir (`payload.app`) |
| `next-addons.js` l. 8 `NX_VERSION` | `Next 1.12.0 — rentabilité…` | texte sous le logo, mode d'emploi, autotest |
| `sw.js` l. 1 | `climpilot-next-1131-fusion` | cache hors ligne (à changer à chaque livraison) |
| `manifest.json` | aucune version | — |
Serveur (certain, `cp_version_ok` dans la migration 1.10) : il **refuse** toute version < 1.10 et accepte tout ≥ 1.10 ; donc `1.13.0` passe, et `1.10.0` aussi (c'est pourquoi rien ne casse aujourd'hui). Conséquence actuelle : les factures émises par la 1.12 sont enregistrées « app 1.10.0 » sur le serveur — pas faux fiscalement, mais trompeur pour retrouver quelle version a émis quoi.
**Proposition (à valider, rien fait)** : à la prochaine livraison, un seul numéro `1.13.0` aux trois endroits (`VERSION='1.13.0'`, `NX_VERSION='Next 1.13.0 — …'`, cache `climpilot-next-1130-…`), puis en P0 un fichier `VERSION` unique lu par les trois (REFONTE-PLAN). Les documents déjà émis gardent leur `app` d'origine (registre figé).

## 8. Risques restants (ce qui peut mal tourner en vrai)
| # | Risque | Gravité | Certitude |
|---|---|---|---|
| 1 | Suite Q instable (2 contrôles chronométrés) : un défaut réel de synchro « deux appareils » pourrait se cacher derrière un échec mis sur le compte du timing | IMPORTANT | probable que ce soit le timing (les pointes d’origine, inchangées, échouent maintenant de la même façon) → contrôle manuel 5 bis de la fiche avant mise en production ; à fiabiliser en P0 (T9 horloge figée) |
| 2 | `nxd2PrixDL` : suggestions d'articles du mauvais lot sur un devis multi-lots | MINEUR (pas de montant touché) | probable |
| 3 | Version `1.10.0` envoyée au serveur par une appli 1.12 : traçabilité, pas de blocage | MINEUR | certain |
| 4 | Migration `agenda` non appliquée au moment de la fusion : fonctionnalité agenda muette, sans message | MINEUR | certain (voulu par le code) |
| 5 | Mise à jour du service worker : un appareil qui ne fait pas F5 garde l'ancien cache jusqu'au prochain chargement réseau | MINEUR | certain (comportement standard) |
| 6 | Risques déjà connus du plan (R1 « local gagne », R2 compteurs locaux, R4 `p_min_numero`) : **inchangés** par M0 | — | certain |

## 9. Ce que je n'ai pas pu vérifier
- **Rien sur un vrai projet Supabase** (ni TEST ni réel) : la migration, la fonction `agenda`, la synchro réelle entre tes appareils et la signature en ligne n'ont été essayées qu'en simulation. C'est à toi (fiche).
- **Aucun export 1.9.x** disponible dans le dépôt : la mise à jour sur données anciennes a été faite sur un état **1.10** + deux devis construits à l'ancien format (sans `v:2`, moteur `compute` d'origine), pas sur un vrai export 1.9.
- Le contrôle manuel du cas « acompte PC / solde téléphone » (§ 4).
- Les tests ne couvrent pas de valeur attendue au centime (R5 du plan) : « recalculé au centime près » ici signifie **identique avant/après** sur 14 devis, pas « juste ».
- `nxd2PrixDL` : non reproduit à l'écran.
- Incident de ma part : une de mes commandes a tué le serveur local de la **première** batterie « après 1.12 » (résultats écartés, batterie **relancée** proprement : 762/0). Les chiffres du tableau § 2 sont ceux des passages complets et non perturbés.
- Aucune règle fiscale ou réglementaire n'a été vérifiée ni modifiée (hors périmètre M0).

## 10. Ce qui reste à toi
Lire cette page, faire les essais de la fiche sur TEST (dont le contrôle « acompte/solde » § 4), appliquer migration et fonction sur TEST puis sur le réel, fusionner la demande en brouillon, F5 sur chaque appareil, fermer #2 et #3, activer la protection de `main`. Ensuite : figer les nouveautés et lancer P0 (REFONTE-PLAN).
