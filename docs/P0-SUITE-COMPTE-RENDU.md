# ClimPilot — P0-suite : compte rendu (branche `refonte/p0-suite`)

> Rédigé le 24/10/2026 par Claude (Sonnet 5.5) pour Gabriel Leroy. **Tests et documents seulement** : `index.html`, `next-*.js`, `sw.js`, `supabase/`, `.github/` intacts (`git diff --stat origin/refonte/ci-dates..HEAD` ne liste que `tests/` et `docs/`). Rien n'est fusionné, rien n'est déployé, aucun Supabase (réel ni TEST) n'a été appelé : PostgreSQL 16 local et serveur simulé seulement.
> Certitude de chaque constat : **certain** (exécuté ici) / **probable** (déduit) / **hypothèse**.

## En-tête — ce que Gabriel décide / fait

1. **Ordre de fusion** : cette branche part du sommet de `refonte/ci-dates` (= C1 + le correctif des tests du 24/10), pas de `correctif/c1-registre-illisible` : `git log` montrait que ce correctif n'y était **pas** fusionné (c'est un commit de plus par-dessus). Fusionner `refonte/ci-dates` dans C1 d'abord, puis cette branche (elle s'y ajoute sans conflit : elle ne touche que `tests/` et `docs/`).
2. **À décider — R12** (§ 5) : j'ai corrigé les 4 dépendances au jour réel que la mesure a montrées (suites E, F, M, R) et remplacé les années de simples données de test par la date de référence. **Je n'ai pas touché** 49 lignes de code qui contiennent « 2026 » comme **barème ou règle légale de 2026** (suites K, O, P, L) ou fait de calendrier (B) : les lier à la date de référence changerait ce qu'elles vérifient. Dis-moi si tu veux quand même zéro « 2026 » dans le code (je le déconseille pour la suite K).
3. **À savoir** : la parade décrite en C1 § 6.3 **ne suffit pas seule** pour le contrôle « acompte » (§ 2.2) ; j'ai dû aussi changer l'ordre d'émission du scénario (mêmes numéros de facture). Un regard d'Opus (M3) sur ce changement de test est utile.
4. **Hors de mon périmètre, à faire plus tard** : `.github/workflows/tests.yml` (lignes 8-9) dit encore « 2 contrôles instables » ; `tests/env.mjs` ne rend pas Chromium 153 « en ligne » dans l'espace réseau isolé (contournement hors dépôt, § 6).
5. **Documents demandés mais absents du dépôt** : `REFONTE-PLAN.md` (§ 9) et le TOPO du 24/10 — non lus ; j'ai lu `docs/REPRISE.md`, `docs/C1-COMPTE-RENDU.md`, `docs/P0-COMPTE-RENDU.md`, `tests/LISEZMOI.md`.
6. **Gabriel n'a rien à faire côté Supabase ni côté appli** : aucun montant, aucune règle fiscale, aucune mention légale, aucun arrondi ne change (golden calculs Z 55/55 et documents Y 21 + 5 « À TRANCHER » identiques).

## 1. Résumé (5 lignes)

| Tâche | Avant (rouge) | Après (vert) |
|---|---|---|
| 1. Suite Q « acompte » + « voile » bloquants | « acompte » : 2 échecs sur 7 passages de l'ancien code ; avec rapprochement tardif injecté : échec à coup sûr ; « voile » : échec à coup sûr avec un PC occupé injecté | Q **64/64** (62 + 2 contrôles « Mise en place »), plus aucun INSTABLE ; 4 passages parallèles de Q7 : 4/4 |
| 2. T5b : la tournée déclenche `completerGeo` | mutation « jamais appelé » : 2 rouges ; mutation « pas de réaffichage » : 1 rouge | T **25/25** (23 + 2) |
| 3. R12 : plus de dépendance au jour réel | sous `faketime '2027-01-05 10:00:00'` : E 5 rouges, F 1 rouge, M plantée ; à 22 h 30 UTC : R 1 rouge | sous le même faketime, après correction : E 19/19, F 9/9, M 23/23, R 42/42 ; batterie complète verte (4 artefacts de banc rejoués verts, § 5.4) |
| 4. `fail.horsService` = forme réelle | I : 39 verts, 1 rouge (promesse rejetée) | I **40/40**, I3 / I3b disent la même chose |

Batterie complète (Q, CEN, FNFE, PostgreSQL 16, `unshare -n`) : **1 111 réussis, 0 échoué, 0 SKIP**, 5 « À TRANCHER » inchangés (suite Y) — à la date réelle et sous `faketime '2027-01-05 10:00:00'` (artefacts de banc rejoués, § 5.4 et § 6).

## 2. Tâche 1 — suite Q, contrôles « acompte » (Q7) et « voile » (Q10)

### 2.1 Constat
- **« Acompte »** (certain, mesuré). Le contrôle dépend de l'instant où le rapprochement de démarrage du téléphone (`next-emission.js`, `boot()` → `rapprocher()`, 2,5 s après chaque chargement) relit le registre. Sur 4 passages de l'ancien code, 3 issues : lecture **entre l'avoir et l'acompte du PC** → le téléphone connaît la facture de X mais pas l'acompte de Y → vert ; lecture **avant la facture de X** → la reprise de X relit tout le registre et ramène aussi l'acompte de Y → le téléphone facture un solde de 423,11 € qui tient compte de l'acompte (181,34 €) → rouge ; lecture **après l'acompte** → idem. Sur 7 passages de l'ancien code ici : 5 verts, 2 INSTABLE. **L'appli a raison dans les trois cas** (confirme M3 C5) : c'est le test qui supposait un état du téléphone qu'il ne contrôlait pas.
- **La parade de C1 § 6.3 seule ne suffit pas** (certain, mesuré). Coupée pendant que le PC émet, puis rouverte avant les clics du téléphone, le contrôle devient rouge **à chaque fois** : la reprise de la facture X par le téléphone (`reprendreAilleurs` → `rapprocher`) relit **tout** le registre et ramène l'acompte de Y avant le clic sur Y. Le PC doit donc émettre l'acompte de Y **après** la reprise de X.
- **« Voile »** (certain pour le mécanisme, **probable** pour la cause des échecs d'origine). `cpVerifierDistant` (`index.html`) ignore le retour sur la fenêtre tant que le PC envoie ou lit (`_cpPushing`, `_cpPulling`) : si le PC n'est pas au repos, aucune relecture, aucun voile dans la fenêtre de 6 s (les données finissent justes, comme l'avait vu Opus). Non reproduit naturellement ici (2 passages sous charge ×4 : verts) ; reproduit par injection.

### 2.2 Test rouge (preuves conservées dans le dossier de sortie)
- Ancien Q7 + `nxEmisRapprocher()` du téléphone forcé après l'acompte du PC : `INSTABLE … tY.solde = F-2027-003, 423,11 €`.
- Ancien Q10 + PC rendu « occupé » (`_cpPulling = true`) : `INSTABLE … {"voile":false, "pendant":{"dessus":"","dirty":true}, "apresA":{"pc":true,"srv":true}}`.
- Q7 avec la parade seule : `FAIL … tY.solde = F-2027-003`.

### 2.3 Correction (`tests/suiteQ-recette.mjs` seulement)
- Q7 : registre coupé pour le téléphone (`S7.registreBloque`) pendant que le PC émet ; rapprochement tardif **forcé** puis état « pas à jour » **vérifié** (2 contrôles « Mise en place », bloquants) ; registre rouvert juste avant le clic du téléphone ; le PC émet l'acompte de Y après la reprise de X (numéros inchangés : `F-…-001`, `AV-…-001`, `F-…-002`).
- Q10 : le PC est au repos (`auRepos` : ni envoi, ni lecture, magasin prêt, pas de voile) avant son retour simulé sur la fenêtre, puis de nouveau avant l'événement « focus ».
- `rInstable` supprimé ; commentaires de `tests/run-all.sh` et `tests/LISEZMOI.md` alignés (le statut `INSTABLE` reste géré par `rapport.mjs`, inutilisé).

### 2.4 Test vert
- Q7 nouveau : **4/4** passages parallèles verts ; **mutation** (parade retirée) : les 2 « Mise en place » et « acompte » rouges → la protection se voit si elle disparaît.
- Q10 nouveau : vert, y compris avec le même PC « occupé » injecté (attente du repos).
- Suite Q dans la batterie : **64/64**.

## 3. Tâche 2 — M3 C10 : T5b, la tournée déclenche réellement `completerGeo`

- **Constat** (certain) : T5 calcule d'avance les coordonnées de ses deux adresses ; le recalcul par `completerGeo` n'était jamais attendu. (En passant : le jeu a une 3e étape, le client de Paris, dont le calcul est déclenché par T5 sans être vérifié.)
- **Contrôle ajouté** (`tests/suiteT-terrain.mjs`, T5b, 2 contrôles) : deux adresses sans coordonnée ; « Ma journée » (matin) lance le calcul **une fois par adresse**, affiche « (adresses en cours de calcul) » (géocodage simulé ralenti à 0,7 s pour l'observer), puis se réaffiche seule avec « ≈ N km aller-retour » ; aucun calcul répété, une requête de géocodage par adresse.
- **Rouge** : sur une copie de l'appli (jamais committée) — `completerGeo` jamais appelé : 2 rouges ; réaffichage retiré après le calcul : rouge sur le 2e contrôle. **Vert** : code réel, T 25/25.

## 4. Tâche 4 — `fail.horsService` rend la forme réelle de supabase-js

- **Constat** (certain, C1 § 9.6.2) : `Promise.reject(new Error('Failed to fetch'))`, forme que supabase-js 2.117.3 ne produit pas.
- **Rouge** : un contrôle de forme ajouté en I3 → 39 verts, 1 rouge (`{"resolue":false,"rejet":"Failed to fetch"}`) sur l'ancien faux serveur. **Correction** : `Promise.resolve(erreurReseauBib())` = `{error:{message:'TypeError: Failed to fetch',…}, data:null, status:0}`. **Vert** : I **40/40**.
- **« Disent la même chose »** : un 2e contrôle ajouté vérifie le message (« Facture NON émise : serveur injoignable ») et le mode (bloqué, raison « serveur ») ; vert avant **et** après. Seul le texte interne `detail` passe de « Failed to fetch » à « TypeError: Failed to fetch ». I3b : mêmes résultats (F-…-001 puis F-…-002, aucun PROVISOIRE).

## 5. Tâche 3 — R12 : la batterie ne dépend plus du jour réel

### 5.1 Constat — mesure avant toute correction (certain)
Batterie complète sur le code d'avant (`dff6035` + tâches 1, 2, 4), sous `faketime '2027-01-05 10:00:00'` (sans Q) : **963 réussis, 8 échoués** (autotest d'isolation 1, suite E 5, suite F 1, suite X 1) **et la suite M plantée** (sans résultat). Trois dépendances au jour réel :

| Suite | Rouge au 05/01/2027 | Cause |
|---|---|---|
| E avoirs | 5 contrôles | séries `TEST-AV-2026-…` : l'année en cours était écrite « 2026 » |
| F (2e bloc) | 1 contrôle | « En 2026 : mention 293 B » : vrai seulement en 2026 |
| M (M6) | **plantage** (bouton « Afficher plus » introuvable) | le registre n'affiche qu'une année (la plus récente) ; les devis semés (62 jours en arrière) couvrent 2026 et 2027 → bouton absent |

Une quatrième, d'**heure du jour** et non de date, trouvée par hasard (mon passage de référence de 23 h 02 UTC l'a fait échouer) puis confirmée : **suite R**, « Clé synchronisée cpnext_dernier_export… date affichée » — rouge à 22 h 30 UTC (minuit passé à Paris), verte à 10 h 00 UTC : la date attendue venait de Node (fuseau de la machine, UTC), la date affichée de la page (Europe/Paris).

Les autres rouges de ce passage ne viennent pas de la date : l'autotest d'isolation et la suite X (artefacts du banc, § 6) ; les 2 SKIP étaient les validateurs CEN / FNFE, absents ce jour-là.

### 5.2 Correction
- `tests/lib.mjs` : **`REF`**, la date de référence figée de la batterie — celle des suites golden (mardi 20/10/2026 10:00 Paris) : `REF.horloge`, `REF.jour`, `REF.an` ; et `window.__REF` dans chaque page.
- Suites **E, F (2e bloc), M (M6)** : page figée par `page({horloge:REF.horloge})`, attendus écrits avec `REF.an`. Suite **R** : la date attendue est lue dans la page. Suite **T** : `HORLOGE_T = REF.horloge` (même valeur).
- Suites **C, H, I, J, R** : années de **données de test** (« 2026 » dans des dates, numéros, horodatages) remplacées par `REF.an` / `__REF.an`. Délégué à deux agents `climpilot-executant`, **relu par moi** (`git diff`) ; vérifié par rejeu avant/après : mêmes PASS (C 17, H 40, I 40, J 56, R 42), mêmes détails au bruit aléatoire près (identifiants, horodatages, emojis temporisés).

### 5.3 Ce qui reste « 2026 » dans `tests/suite*.mjs` (hors `golden/`, exclu par la consigne) — 117 lignes avant, **87** après
| Classe | Lignes | Décision |
|---|---|---|
| Commentaires datés (date de rédaction, « M3 C5 21/10/2026 »…) | 38 | à garder (historique) |
| **Barèmes et règles légales de l'année 2026** : ACRE, plafonds micro 83 600 / 203 100 €, franchise TVA 37 500 €, EI fermée en 2026 (suite K 27 lignes, suite O 7) | 34 | **à garder** : le chiffre légal dépend de l'année, pas de la date du jour ; les lier à `REF` changerait ce que le test vérifie (règle 2) |
| Dates propres à une suite : « plus de 12 mois » avant le 12/11/2027, fiches fluides 2026 → 2027 (suite P 9), réimpression en 2027 d'une facture de 2026 (suite L 2) | 11 | à garder : ancrées sur la date locale de la suite, pas sur la date du jour |
| Fait de calendrier : semaine du changement d'heure du 25/10/2026, formats de saisie (« 5/10/26 », suite B 4) | 4 | à garder |

### 5.4 Vert
Batterie complète sur l'arbre final (`b24ca72`, Q, CEN, FNFE, PostgreSQL 16, `unshare -n`) sous `faketime '2027-01-05 10:00:00'` (le rapport affiche bien la date 2027-01-05) : **1 099 réussis, 4 échoués, 0 SKIP**, 5 « À TRANCHER ». Les 4 échecs, un par un, **aucun lié au code ni aux tests corrigés** :
- `autotest-isolation` (1/20) : « seule la boucle locale existe » — la `veth` du contournement (§ 6), par construction ; rejoué sans veth sous faketime : **20/20**.
- `sql` (3/51, `test_agenda.py`) : mon serveur PostgreSQL tournait à l'heure **réelle** (24/10/2026) alors que Python était en 2027 ; PostgreSQL relancé lui aussi sous faketime, mêmes tests : **51/51**.
- `suiteX-mise-a-jour` (plantage, `page.reload` 30 s) : même symptôme que C1 § 5.1 (navigateur dans l'espace avec veth) ; rejouée sans veth sous faketime : **8/8**.
Suites corrigées : E 19/19, F 9/9 (validateurs CEN et FNFE exécutés), M 23/23, R 42/42, Q 64/64. Totaux corrigés des artefacts : **1 111 réussis, 0 échoué** — identiques à la batterie à la date réelle.

## 6. Batterie complète

Passage à la date réelle (24/10/2026, commit `787f120`) : **1 109 réussis, 2 échoués, 0 SKIP**, 5 « À TRANCHER » (suite Y, inchangés — M3 C2). Les 2 échecs sont les artefacts de la `veth` ci-dessous (autotest 1/20, suite X 1/8) ; rejoués dans l'espace isolé sans veth : **autotest 20/20, X 8/8** → **1 111 réussis, 0 échoué**. Après les deux dernières retouches (`b24ca72`) : suites I 40/40, N 37/37, R 42/42, T 25/25 rejouées, puis la batterie complète sous faketime (§ 5.4) ; **passage final à la date réelle (25/10/2026 00 h UTC) sur le commit `c8fc241`, arbre propre : 1 109 réussis, 2 échoués (les mêmes 2 artefacts de veth, rejoués sans veth sur ce commit : autotest 20/20, X 8/8), 0 SKIP, 5 « À TRANCHER »** — soit 1 111 réussis, 0 échoué.

| Étape | Résultat |
|---|---|
| Golden calculs (Z) / documents (Y) | **55/55** et **21 + 5 « À TRANCHER »** — identiques : aucun montant ne bouge |
| Suites A à P, R à X, AA | toutes vertes (Q 64, T 25, I 40, E 19, J 56, K 32, L 25, M 23, N 37, O 78, P 138) |
| Fonctions serveur (signature, listes blanches, superpdp, agenda, script Google) | 10 + 20 + 7 + 18 + 12, vertes |
| SQL (PostgreSQL 16 local, marqueur `climpilot-test`) | **51/51** |
| Aperçu isolé | 11/11 |
| Validateurs | CEN `validation-1.3.16` et FNFE `v1.4.0.04` exécutés (suite F 9/9, 0 SKIP) |
| Isolation réseau | 0 connexion externe établie ; 3 tentatives vers l'adresse du Supabase réel vues par Playwright (page de signature, adresse écrite en dur), toutes servies par une simulation du test, 0 arrivée au réseau du navigateur |

**Banc de test (certain, déjà vu en C1 § 9.6.1)** : la machine d'aujourd'hui a Playwright 1.63 / Chromium 153 (le dépôt fige 1.56.1). Dans `unshare -n`, Chromium 153 ignore `Network.emulateNetworkConditions{offline:false}` et se croit hors ligne : la suite I s'arrête à I5 (vu ici avant contournement). Contournement **hors dépôt** : une paire `veth` avec adresses privées (10.9.9.1/24, 10.9.9.2/24) **sans route** (rien ne peut sortir ; « connexions externes réellement établies : 0 ») ; effet de bord : « seule la boucle locale existe » (autotest) et la suite X (hors ligne) sont rouges **par construction** ; rejouées dans l'espace isolé sans veth (`bash tests/run-all.sh` normal) : **autotest 20/20, X 8/8**.

## 7. Ce que ça change pour toi
- Les deux contrôles de la recette « deux appareils » qui pouvaient échouer sans raison **redeviennent bloquants** : un rouge de Q7 ou Q10 est désormais un vrai signal, plus un « INSTABLE » à ignorer.
- La batterie reste verte au 1er janvier 2027 et à toute heure de la journée (essais : 05/01/2027 10:00 ; 24/10/2026 22:30 UTC pour la suite R). Commande de contrôle : `faketime '2027-01-05 10:00:00' bash tests/run-all.sh` (paquet `faketime`).
- Rien ne change dans l'appli ni pour tes appareils.

## 8. Ce qui n'a pas pu être vérifié
- **`REFONTE-PLAN.md` § 9 et le TOPO du 24/10** : absents du dépôt (non lus).
- **La cause réelle des échecs d'origine de « voile »** sur la machine d'Opus : non reproduite naturellement ici ; reproduite par injection (« probable »).
- **Attente de 8 s** avant de considérer le rapprochement de démarrage du téléphone passé (`apresRapprochementDeDemarrage`) : fondée sur le délai de 2,5 s du code et vérifiée par le contrôle « Mise en place », qui échoue bruyamment si elle est insuffisante (hypothèse : suffisante sur une machine plus lente).
- **Autres dates sous faketime** : seules 2027-01-05 10:00 (batterie complète) et 2026-10-24 22:30 UTC (suite R) ont été essayées ; un samedi, un changement d'heure, un 29 février : non.
- **CI GitHub** : non rejouée (le push déclenche le workflow, résultat dans l'onglet Checks).
- **Secrets** : la recherche habituelle (jetons, clés, IBAN, adresses mail personnelles — le motif de `docs/REPRISE.md`, règle 3) sur tout le diff et sur les documents ne trouve rien ; la **ville et la rue réelles** de Gabriel ne me sont pas connues, donc non cherchées (à faire par lui ou par une session qui les connaît).

## 9. Rejouer
```bash
git checkout refonte/p0-suite
# batterie complète (voir tests/LISEZMOI.md pour les variables CEN/FNFE/PGHOST)
CP_TEST_OUT=<dossier hors dépôt> bash tests/run-all.sh        # puis lire <dossier>/rapport.md
faketime '2027-01-05 10:00:00' env CP_TEST_OUT=<autre dossier> bash tests/run-all.sh   # contrôle R12
```
Commits : `5435f66` (tâche 4), `9456dc4` (tâche 1), `1b15767` (tâche 2), `787f120` + `b24ca72` (tâche 3), puis ce compte rendu.
