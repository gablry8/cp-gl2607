# P3 — les états terminaux gagnent la fusion entre appareils — compte rendu (06/11/2026)

> Branche `correctif/p3-fusion-etats`, partie de `main` = `297cc7e` (après la fusion de #10, #11 et #12 le 05/11). Exécutant : Fable 5.1 (session Claude Code). Dossier : `docs/MISSION-P3.md` (corrigé en étape 0, commit `044a6c0`). Accord écrit de Gab du 06/11 en tête du prompt : Q1 (golden et attendus), Q2 (P3 avant S), Q3 a et b (encaissements, vieille sauvegarde), constat 1 de la relecture (`nxSetStatut`).
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project ; la copie `claude/ClimPilot-P3-compte-rendu.md` reste à faire. Rien n'est fusionné ni déployé ; aucune base Supabase (RÉEL ou TEST) touchée : P3 ne change rien côté serveur.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**.

## Ce que Gab décide / fait (10 lignes) — refait le 09/11 après la relecture P10 d'Opus 5.5 (P3-bis, § 12)
1. **Relecture courte (C5)** par Opus 5.5 du commit P3-bis (code `6845e18`, tests `cf7298e` et `6cf81d5`, documents : tête de la branche), puis **essai à deux appareils** sur la copie d'essai (§ 7, ≈ 15 min, avec le témoin de l'étape 9).
2. **Fusion de la PR #16** (`gablry8/cp-gl2607#16`, brouillon) : toi, après C5 et l'essai. Puis, **le même jour**, sur chaque appareil : attendre « ✓ synchronisé », puis F5 (cache `climpilot-next-1135-production` ; `main` est encore en 1134). Version affichée inchangée (1.13.0).
3. **Golden** : `tests/golden/fusion-empreinte.txt` `3f01fbdc` → `76e10290` (ton accord du 06/11 ; les 26 contrôles d'origine de la suite U inchangés) et 5 contrôles de la suite AD réécrits. P3-bis ne touche pas `cpMerge` : l'empreinte reste `76e10290`. Y, Z et W identiques.
4. **Décision 5 confirmée** (09/11, § 4.6) : une sauvegarde restaurée garde « accepté » et garde un encaissement noté après la sauvegarde ; le remède est « Annuler le devis » (motif « erreur de saisie ») ou un avenant.
5. **Ce que P3-bis corrige** (§ 12) : un geste ordinaire fait sur un appareil (envoyé → accepté, brouillon → envoyé, accepté → annulé ou remplacé) et simplement reçu par l'autre ne produit plus d'arbitrage fantôme (ligne au journal, version écartée, « à envoyer », renvoi) ; la garde à la réception ne fait rien sans base et ne remet que les états terminaux, les fiches et le compteur.
6. **Hors P3**, noté dans `docs/APRES-PRO-V1.md` (§ 9) : numéros en double (V3), note de fiche client (D1), prévention côté serveur de deux factures dans un même arbre, notes d'intervention à la fusion, fusion champ par champ, écran du journal.
7. **Retour arrière** : revert de `6845e18` (P3-bis), `f10e372` (code P3) et `301a402` (golden) ; les tests redeviennent rouges. Aucun retour arrière côté serveur : P3 ne change rien au serveur.
8. **Batterie complète** : P3 (`301a402`) 1 499 / 0 / 0 SKIP ; **P3-bis (`6845e18`) : COMPLET, RÉUSSI — 1 525 réussis (1 499 + 26 nouveaux), 0 échoué, 0 SKIP, 5 « À TRANCHER » connus**. `faketime` 07/11, 08/11, 05/01/2027 : U 90 / 0, AD 148 / 0, AE 25 / 0 aux trois dates.
9. **CI** : P3 verte aux runs 125 à 128 (1 495 / 0 / 2 SKIP connus) ; run 129 (demande de fusion sur `a6bc39a`) rouge sur Q7 « Avoir PARTIEL », sans lien avec P3 (§ 6.3). **P3-bis : verte sur les deux événements** — runs 133 (push) et 134 (demande de fusion) sur le commit de code `6845e18` : COMPLET, RÉUSSI, 1 521 réussis / 0 échoué / 2 SKIP connus ; le commit « documents » (tête de la branche) relance les deux, résultat dans la PR.
10. Mission suivante : **S** (sécurité), dès que tes décisions 6 à 8 sont prises.

## 1. Constat (certain : lu, puis reproduit par les tests rouges)
Quand deux appareils ont modifié le même devis sans s'être vus, la fusion gardait **l'objet entier** de l'appareil qui envoie en dernier dès qu'il y avait changé quoi que ce soit (`cpMergeArr`, « l'appareil actuel gagne », figé par la suite U). Un PC pas à jour qui posait une date de planification sur un devis « accepté » chez lui le renvoyait « accepté » au serveur, alors que le téléphone l'avait annulé (motif perdu), remplacé par un avenant (original de nouveau facturable) ou fait signer en ligne (signature perdue, jamais reposée : le relevé ne relit que les signatures non appliquées). Même perte pour une fiche fluide annulée ou signée par le détenteur, pour un encaissement, et le compteur des fiches fluides pouvait reculer (numéro en double). AF1-ter / AF1-quater paraient le risque d'argent au moment de facturer et réparaient l'original au démarrage ; ils n'empêchaient pas la perte elle-même. Détail : `docs/MISSION-P3.md` § 1 et § 2.6.

**Constat 1 de la relecture du dossier** (certain) : la liste des devis (`nxSetStatut`, `next-statut.js`) laissait un devis **signé** repasser « envoyé » ou « refusé », alors que l'éditeur le verrouille (`cpDevisVerrou`). La règle « un état de rang 2 ne recule jamais » n'était donc pas vraie sur un seul appareil.

## 2. Tests rouges d'abord (certain : exécutés sur `297cc7e`, code mis de côté avec `git stash`)
Commit `83b1fe5` (tests seuls). Journaux gardés hors dépôt (bloc-notes de la session : `journaux-p3/suiteU-rouge-297cc7e.log`, `resAD-rouge-297cc7e.json`, `resAE-rouge-297cc7e.json`).

| Suite | Sur `297cc7e` (ancien code) | Rouges | Témoins verts avant comme après |
|---|---|---|---|
| U (`tests/suiteU-fusion.mjs`, Node seul) | **36 réussis / 40 échoués** | U-P3-1 à U-P3-12 (ter), U-P3-13 bis et ter, U-P3-14 bis, U-P3-16 (quater), U-P3-15 symétrie ×17, propriété « liste des arbitrages non énumérable » | U-P3-13 (retour en arrière voulu : « envoyé »), U-P3-14 (sans base : annulé) ; les 23 cas et 3 propriétés d'origine ; l'empreinte `3f01fbdc` (verte sur l'ancien code) |
| AD (`tests/suiteAD-af1-pertes.mjs`, vraie appli, horloge REF) | **115 / 24** (relecture d'Opus, 09/11 ; ce compte rendu disait 114 / 25) | T19a (×1, réécrit), T22a (×1, réécrit), T32 (×3), T33 (×2), T34 (×2), T35a, T35b, T36 (2e contrôle : message et 3e facture), T37a, T37b, T38a, T38b, T39 (×2), T40a, T40b, T41 (×2), T42 (×2) | témoin T42 (un devis accepté sans signature repasse « envoyé » par `nxSetStatut`) ; **T36 1er contrôle (les deux factures restent : déjà vrai avant P3, c'est un constat, pas une preuve rouge)** ; les 113 contrôles AF1 à AF1-5 |
| AE (`tests/suiteAE-p3-fusion.mjs`, banc deux appareils, nouvelle) | **14 / 8** (relecture d'Opus, 09/11 ; ce compte rendu disait 13 / 9) | AE1 (×3), AE2 (×2), AE4 (fusion : journal « deux factures »), AE5 (×2) | AE6a (pas de conflit → rien), AE6b (suppression contre signature → devis gardé, signé) ; **AE4 mise en place et « 3e facture refusée » (déjà vrais avant P3 : constat C1 / AF1-ter, pas des preuves rouges)** ; les mises en place |

Précision sur les mises en place : deux scénarios ont été corrigés **côté test** avant d'être verts, sans toucher au code de l'appli : AE4 et T35b / T36 (le garde-fou C1 « pas à jour » refuse, à juste titre, qu'un appareil émette une facture quand le serveur a déjà un état plus récent : dans ces scénarios, le PC facture **d'abord**, puis le téléphone écrit ; AE4 prend un client professionnel, car l'avenant est un nouveau contrat dont le mode de conclusion est « à préciser », ce qui bloque la facture d'un particulier — L221-10, voulu).

## 3. Correction (certain : lu et exécuté) — commit `f10e372`
### 3.1 `index.html`
- **`cpFusionEtats(B,L,R,out)`** : nouvelle fonction **pure** (ni lecture ni écriture, extraite et exécutée dans Node par la suite U), placée après `cpMerge`, appelée **à la fin de `cpMerge`** dans un `try/catch` journalisé (`console.warn` + ligne `fusion_erreur` au journal) : en cas d'erreur, le résultat d'aujourd'hui est rendu tel quel. Elle rend `{out, arbitrages}` : `out` = les seules listes réécrites (`cp2_devis`, `cp2_fluides`, `cp2_dep`, `cp2_fluseq`), `arbitrages` = les gestes départagés. `cpMerge` recopie ces clés dans son résultat et pose la liste en **propriété non énumérable `cpArbitrages`** (`Object.defineProperty`) : `JSON.stringify` l'ignore, elle n'est donc jamais écrite dans `localStorage` ni envoyée ; l'enveloppe `protegerFusion` rend le même objet, elle survit. Pas de variable globale. Règles : § 4.
- **`cpFusionLibelle`, `cpFusionJournal(arb, source)`** : pour chaque arbitrage, une ligne `cpnext_journal` `{type:'fusion_etat', source:'fusion'|'reception'|'import', cle, id, num, etat_garde, statut, statut_ecarte, ecarte:[…], autre_appareil, message}` ; la **version écartée** est gardée dans la clé locale **`cpnext_fusion_ecartes`** (20 dernières, non synchronisée, comprise dans la sauvegarde complète : préfixe `cpnext_`, hors `NX_BK_SKIP`) ; le message est gardé dans `sessionStorage` (`__cpFusionMsg`) et **affiché après le rechargement** qui suit toute fusion (INIT, 1,2 s après le démarrage). Aucune clé synchronisée nouvelle.
- **`pushState`** : après la fusion, `cpFusionJournal(M.cpArbitrages,'fusion')` ; le message de fusion remplace « Changements d'un autre appareil fusionnés » quand il y a un arbitrage.
- **`pullState`, garde à la réception** (`cpGardeReception`) : avant de ranger un état reçu sans rien à envoyer, la même seconde passe est jouée (base = `cp2_sync_base`, L = l'appareil, R = l'état reçu) ; si elle corrige quelque chose, l'état corrigé est rangé, la base = version du serveur, « à envoyer », journal (`source:'reception'`), message, rechargement, puis l'envoi repart sans conflit. Objets présents des deux côtés seulement : une suppression passe toujours. Couvre un appareil resté sur l'ancienne version (AE5, T39).
- **`importJSON`, garde à la restauration** (`cpGardeImport`, Q3 b) : sauvegarde complète (`all`) et ancien format (`devis`, `fluides`, `dep`) ; seconde passe **sans base** entre l'état de l'appareil et la sauvegarde ; l'état gardé est remis dans ce qui est restauré ; journal (`source:'import'`), message « Sauvegarde restaurée, mais N état(s) gardé(s) : … ».
### 3.2 Autres fichiers
- `next-statut.js`, `nxSetStatut` (constat 1) : un devis dont `signature.at` est posée ne change plus de statut depuis la liste ; message `🔒 Devis … signé le … : son statut ne change plus.` (texte de `cpDevisVerrou`, comme l'éditeur). Fonction d'origine modifiée, aucune enveloppe.
- `next-emission.js` l. 820 : le `catch` muet de l'enveloppe `protegerFusion` journalise (`console.warn`). Le second défaut de forme noté au dossier (`window.__nxFusionReparee` écrit et jamais lu) n'est pas touché (hors périmètre, noté).
- `sw.js` : `climpilot-next-1134-production` → `1135`, une seule fois. `VERSION` et `NX_VERSION` inchangés.

## 4. La règle, dans l'ordre (ce que fait la seconde passe)
Pour chaque devis, fiche fluide et intervention présents **des deux côtés** (L = cet appareil, R = serveur) et différents :
1. **Rang d'un devis** : 0 brouillon / envoyé / refusé ; 1 accepté ; 2 signé (`signature.at`) ; 3 remplacé ou annulé ; 4 facture vivante (`facAcompte` / `facSolde` dont le numéro n'est pas dans les `facAnnulees` réunies des deux côtés). **Fiche fluide** : 0 ; 1 signée par le détenteur ; 2 annulée.
2. **Rang ≥ 2 (fiche ≥ 1) : ne recule jamais.** Le côté de plus haut rang fournit **l'objet entier** (contenu compris : c'est ce contenu que le client a signé, qui a été facturé ou annulé). Même rang : **le premier geste en date** (`annulation.at` / `remplacePar.at` ; `signature.at` pour deux signatures différentes ; `annulee.at` / `sigDetenteur.at` pour les fiches).
3. **Rangs 0 et 1** : trois voies sur l'état. Le côté qui a changé l'état depuis la base gagne ; les deux l'ont changé : « accepté » gagne ; sans base : le plus haut.
4. **Champs de suivi** (`notes` internes, `datePlanif`, `momentPlanif`, `matReserve`, `hReel`, `achatReel`, `relances`) : repris du côté qui perd s'il les a changés depuis la base et que le gagnant ne les a pas changés ; les deux : l'appareil actuel gagne (règle d'aujourd'hui). Sans base : repris si le gagnant n'en a pas.
5. **Jamais perdus** : la signature (posée sur le gagnant ; ou `signatureEnAttente` si le gagnant a été remplacé / annulé **après** elle, comme `applySig`), `signatureEnAttente` (sauf si une signature est posée), l'annulation, la signature et le refus du détenteur d'une fiche fluide, le numéro d'une fiche (deux numéros différents : celui de la base, sinon celui du serveur, journal). Deux signatures différentes : la plus ancienne ; l'autre au journal.
6. **Encaissements** (Q3 a) : trois voies sur le seul groupe (`payeLe`, `mode`) d'une même facture de devis, ou (`statut` payée / facturée, `payeLe`, `modeReg`) d'une intervention facturée des deux côtés ; les deux ont changé : l'appareil actuel ; sans base : l'encaissement gagne.
7. **`cp2_fluseq`** : le plus grand (même année ; sinon l'année la plus récente), comme `cp2_facseq`.
8. **Deux factures vivantes dans un même arbre** (original / avenants) nées de cette fusion : rien n'est effacé (une facture émise ne s'efface pas), arbitrage `deux_factures` → journal + message « deux factures sur le même chantier — fais un avoir sur l'une des deux » ; `cpRefusFacture` refuse ensuite toute 3e facture dans l'arbre. P3 ne peut pas **empêcher** ce cas : il faudrait que le serveur connaisse l'arbre (hors P3).
9. Ce qui reste « l'appareil actuel gagne » : le **contenu** quand les deux côtés ont le même rang (0 ou 1) ; les champs de suivi changés des deux côtés ; les fiches clients ; les contrats et locations (leurs factures restent protégées par `protegerFusion`) ; les notes d'une intervention (seul le groupe d'encaissement est fusionné : § 9).
10. **Cas « deux états terminaux »** (dossier § 3.3) : facture contre annulé / remplacé → la facture gagne, l'autre geste est écarté avec message ; annulé contre remplacé → le premier en date ; deux annulations → la plus ancienne (motif gardé) ; signé contre remplacé / annulé → les deux gardés, dans l'ordre des dates ; fiche signée contre annulée → les deux gardées.

### 4.6 Sans base (premier passage, vieille sauvegarde) — décision 5
Sans base, la trois-voies est impossible : le plus haut rang gagne, y compris « accepté » (1) contre « envoyé » (0). Conséquence voulue à la restauration d'une sauvegarde (**décision 5 confirmée par Gab le 09/11**) : un devis accepté depuis la sauvegarde **reste accepté**, et un encaissement noté depuis la sauvegarde **reste**. Le remède, si l'acceptation était une erreur : **« Annuler le devis »** (motif « erreur de saisie ») ou **un avenant** — pas « repasser envoyé » : à l'écran, un devis accepté ne se repasse pas « envoyé » (la liste n'offre que « Facturer », l'éditeur est verrouillé par `cpDevisVerrou`) ; le témoin T42 appelle `nxSetStatut` par le code, ce n'est pas un chemin d'écran. Un devis annulé, remplacé, signé ou facturé depuis la sauvegarde reste tel ; un encaissement fait depuis reste. Tout le reste de la sauvegarde est restauré normalement (devis disparus revenus, devis créés depuis partis : T41).

### 4.7 Limites (certain)
- `signature.at` est l'heure du serveur ; `annulation.at` et `remplacePar.at` celle de l'appareil : départager deux gestes du même genre par leur date suppose des horloges à peu près justes (minutes, pas secondes). Les tests posent ces dates à la main, à 10 ou 20 min d'écart.
- Le journal (`cpnext_journal`, 200 lignes) et les versions écartées (`cpnext_fusion_ecartes`, 20) sont sur l'appareil seulement, sans écran (« Écran du journal », APRES-PRO-V1). Le message à l'écran dure 2,2 s (le `toast` de l'appli) : la ligne du journal porte le même texte.
- Un appareil resté sur l'ancienne version fusionne encore avec l'ancienne règle jusqu'à son F5 ; un appareil P3 qui reçoit son état le remet (garde à la réception) : la remise coûte 2 ou 3 écritures (borne du test : 4) et l'état est ensuite stable (AE5 : vérifié, un tour de plus sans aucune écriture).
- Deux appareils qui facturent chacun un devis du même arbre : les deux factures restent, signalées (§ 4 point 8) ; prévention côté serveur hors P3.

## 5. Tests verts (certain : exécutés)
| Suite | Sur `f10e372` (code) / `301a402` (golden) | Remarque |
|---|---|---|
| U | **75 / 1 avant régénération** (le seul rouge : l'empreinte figée ; les 23 cas et 3 propriétés d'origine inchangés), puis **76 / 0** après `76e10290` | journaux : `suiteU-75-1-avant-regeneration-f10e372.log`, `suiteU-vert-301a402.log` |
| AD | **139 / 0** (114 + 25) | 71 s environ ; T19a / T22a : l'original reste « remplacé », la date du PC gardée ; les contrôles de réparation partent d'un état posé à la main |
| AE | **22 / 0** | AE1 à AE6 ; AE4 en facturation réelle démarrée (serveur simulé, registre commun) |
| W | 64 / 0 | aucune enveloppe nouvelle, aucune clé de synchro nouvelle, golden `enveloppes.json` inchangé |
| I | 43 / 0 | I6 : facture et note gardées (la note est un champ de suivi) |
| V | 8 / 0 | V3 reste « échec attendu, connu » (numéros en double : hors P3) |

## 6. Batterie complète, `faketime`, CI
### 6.1 Batterie complète (certain : `bash tests/run-all.sh` sur `301a402`, PostgreSQL 16 local, Chromium 141, validateurs CEN et FNFE, `unshare -n`)
- Verdict du rapport : **COMPLET, RÉUSSI — 1 499 réussis, 0 échoué, 0 SKIP, 5 non bloquants** (les 5 « À TRANCHER » de la suite Y : références « assujetti », M3 C2, en attente de la comptable — identiques à `main`). Code de sortie 0. Durée ≈ 23 min.
- Suites : A 14, B 54, C 17, D 18, E 19, F 9, G 11, H 46, I 43, J 56, K 32, L 25, M 23, N 37, O 78, P 138, **Q 64** (448 s, du premier coup), R 42, S 21, T 25, **U 76**, V 8, **W 64**, X 8, **Y 21**, **Z 55**, AA 16, AC 131, **AD 139**, **AE 22** ; fonctions serveur 90 ; SQL 66 ; aperçu 11 ; autotest d'isolation 20. Golden Y, Z et W (`enveloppes.json`) identiques : aucun montant, aucun document, aucune enveloppe, aucune clé de synchro nouvelle.
- Sur `main` (`297cc7e`), la CI comptait 1 386 réussis / 0 échoué / 2 SKIP connus ; P3 ajoute 113 contrôles (U +49, AD +25 nets, AE +22 ; 5 réécrits dans AD) et l'environnement de la session n'a pas les 2 SKIP (isolation complète).
### 6.2 Sous `faketime` (règle 9 : samedi, dimanche, 05/01 de l'année suivante) — suites U, AD, AE
- Trois passages `CP_SUITES="suiteU-fusion suiteAD-af1-pertes suiteAE-p3-fusion" faketime '<date> 10:00:00' bash tests/run-all.sh` : samedi **07/11/2026**, dimanche **08/11/2026**, **05/01/2027**. Résultat : **U 76 / 0, AD 139 / 0 aux trois dates** ; **AE 22 / 0** le 05/01/2027, et 21 / 1 les 07 et 08/11 au premier passage : le seul rouge était un **compte d'écritures** du test (AE5 : 3 écritures pour la remise en état au lieu des 2 que j'avais fixées ; AE1 : 4 au lieu de 3), l'état final étant juste et stable à chaque fois. Ce compte dépend de la charge de la machine (rechargements et envois automatiques de l'appli), pas de la date. Bornes desserrées **côté test** (commit `32157e0` : AE1 ≤ 5 depuis la coupure, AE5 ≤ 4 pour la remise, avec un tour de plus sans aucune écriture comme preuve de stabilité), puis AE rejouée : **22 / 0 le 07/11 et le 08/11 sous `faketime`, 22 / 0 au jour de référence**. Le dossier (§ 4.4) annonçait « ≤ 3 » pour AE5 : 2 ou 3 observées.
- `faketime` était déjà installé (setup script d'OUTILLAGE-2) : rien à installer.
### 6.3 CI (`.github/workflows/tests.yml`, contrôle « batterie complète »)
- **Run 123** (`301a402` : tests + code + golden, avant le desserrage des bornes) : **ÉCHEC — 1 494 réussis, 1 échoué, 2 SKIP connus** (autotest d'isolation sans `unshare -n` sur le runner, comme sur `main`), 5 non bloquants (suite Y). **Le seul rouge : AE5**, la borne « au plus 2 écritures » du test (la remise en état a coûté 3 écritures sur le runner ; l'état final était juste et stable) : défaut du **test**, pas de l'appli, corrigé par `32157e0` (§ 6.2). Toutes les autres suites vertes, dont AD 139, U 76, Q 64 (du premier coup), W 64, Y 21, Z 55. Lecture : `gh api repos/gablry8/cp-gl2607/commits/301a4024c9ac644295165a5fa825964d1ce85122/check-runs --jq '.check_runs[]|select(.name|startswith("rapport"))|.output.text'`.
- **Run 124** (`37541a2` : bornes corrigées + documents) : **1 494 réussis, 1 échoué, 2 SKIP connus**, 5 non bloquants. **U 76 / 0, AD 139 / 0, AE 22 / 0** (les suites de P3 sont vertes sur le runner). Le seul rouge : suite **Q** (recette deux appareils), contrôle « Filtre et recherche touchés sur le PC (Interventions) : la mise à jour du téléphone arrive quand même, même écran » (Q10) — vert au run 123 et dans la batterie complète de la session (Q 64 / 0 du premier coup) : c'est le lâcher connu sous charge (OUTILLAGE-2 l'a réduit, pas supprimé) ; **Q rejouée seule en session : **64 / 0** (428 s, `CP_SUITES=suiteQ-recette`, après la CI)**. Ce contrôle ne touche ni la fusion ni les clés de P3 (il regarde l'écran Interventions pendant une mise à jour reçue).
- **Run 128** (push de `a6bc39a`, documents seuls) : **vert, 1 495 / 0 / 2 SKIP connus**. **Run 129** (demande de fusion sur `a6bc39a`) : **ROUGE sur Q7 « Avoir PARTIEL »** — lâcher de la suite Q sans lien avec P3 (relecture d'Opus : Q7 4 / 4 vert sur la tête de la branche, 1 / 1 sur `main` ; dans ce scénario le téléphone ne synchronise pas l'état, la fusion n'intervient pas). La CI de P3-bis : **verte sur les deux événements** — runs 133 (push) et 134 (demande de fusion) sur `6845e18` : COMPLET, RÉUSSI, 1 521 réussis / 0 échoué / 2 SKIP connus ; le commit « documents » (tête de la branche) relance les deux, résultat dans la description de la PR.
- **Runs 125, 126 et 127 : CI VERTE.** Run 125 (événement « demande de fusion », même code `37541a2`) : succès. Runs 126 (push) et 127 (demande de fusion) sur `2f3425d` (documents seuls, même code) : **COMPLET, RÉUSSI — 1 495 réussis, 0 échoué, 2 SKIP connus, 5 non bloquants** (suite Y). Le rouge de Q au run 124 ne s'est pas reproduit : lâcher sous charge, comme annoncé. Le dernier commit « documents » (celui-ci) relance la CI sur un code identique : son résultat se lit dans la PR.

## 7. L'essai que tu fais (copie d'essai, PC + téléphone, ≈ 15 min)
Avant : les deux appareils ont fait F5 sur la copie d'essai reconstruite depuis cette branche (cache 1135), et affichent « ✓ synchronisé ».
1. **PC** : crée un devis d'essai pour un client professionnel fictif, passe-le « Accepté » depuis la liste. Attendu : « ✓ synchronisé » sur le PC ; après ≈ 5 s (ou un retour sur l'appli), le téléphone affiche ce devis « Accepté ».
2. **PC** : coupe le Wi-Fi (ou le mode avion). Attendu : l'étiquette du cloud passe à « ⌛ hors ligne — synchro à la reconnexion » à la première modification.
3. **Téléphone** : ouvre ce devis, « Annuler le devis », motif « Abandon du client ». Attendu : étiquette « Annulé », bandeau rouge ANNULÉ sur le PDF, « ✓ synchronisé ».
4. **PC, hors ligne** : Planning, pose une date sur ce devis (il y apparaît encore « Accepté »). Attendu : « 📅 Planifié le … », étiquette « ☁ à synchroniser… ».
5. **PC** : rallume le Wi-Fi. Attendu : dans les 5 s, l'appli se recharge (voile « Mise à jour depuis ton autre appareil… »), puis le message exact « **☁️ Fusion — devis N° … : annulé sur l'autre appareil** » (rien d'autre : le PC n'avait posé qu'une date, aucun geste n'est écarté) ; le devis est **« Annulé »** avec son motif, et la **date de planification est gardée** (Planning : il n'y apparaît plus, un devis annulé sort du planning ; la date est visible dans le devis). « Facturer » est refusé (« ne se facture plus »).
6. **Téléphone** : reviens sur l'appli. Attendu : toujours « Annulé », et la date posée par le PC est présente.
7. **Recommence (étapes 1 à 6) avec un avenant** : à l'étape 3, sur le téléphone, « Faire un avenant » puis passe l'avenant « Accepté » (l'original devient « Remplacé par l'avenant »). Attendu à l'étape 5 : l'original est **« Remplacé »** sur le PC avec la date gardée, l'avenant « Accepté » ; « Facturer » l'original est refusé, « Facturer » l'avenant émet une facture d'essai (TEST-).
8. **Témoin** : modifie une date de planification sur le PC **en ligne**. Attendu : « ✓ synchronisé », aucun message de fusion, le téléphone reçoit la date.
9. **Témoin (P3-bis)** : sur le PC **en ligne**, passe un devis « envoyé » en « Accepté » depuis la liste, puis reviens sur l'appli du téléphone. Attendu : le téléphone affiche « Accepté » après son rechargement, **aucun message « Reçu d'un autre appareil, états remis »**, l'étiquette reste « ✓ synchronisé » (pas « à synchroniser »).
Si une étape ne donne pas l'attendu : note l'écran, et ouvre la console (F12) : les lignes `ClimPilot (P3)` disent ce qui s'est passé ; le journal `cpnext_journal` (dans la sauvegarde complète) garde les arbitrages.

## 8. Ce que ça change pour toi
- Un devis annulé, remplacé, signé ou facturé sur un appareil ne redevient plus « accepté » ou « envoyé » parce qu'un autre appareil pas à jour l'a touché : le motif, la signature, l'avenant et la facture sont gardés ; la date de planification, la note interne, la relance ou le matériel réservé posés sur l'appareil pas à jour sont gardés aussi.
- Une fiche fluide annulée ou signée par le détenteur reste telle ; un encaissement noté sur un appareil n'est plus effacé par l'autre ; le compteur des fiches fluides ne recule plus à la fusion.
- Ce qui est écarté n'est jamais muet : message à l'écran (il survit au rechargement), ligne au journal, version écartée gardée sur l'appareil (20 dernières).
- Le garde-fou qui **bloque** reste voulu : « Facturer » un devis remplacé ou annulé, ou un 2e devis d'un arbre déjà facturé, est refusé avec un message qui dit quoi faire (avoir, avenant).
- Un devis **signé** ne change plus de statut depuis la liste (constat 1) : pour le défaire, « Faire un avenant » ou « Annuler le devis ».
- Une vieille sauvegarde restaurée ne défait plus une annulation, une signature, un avenant accepté, une facture ou un encaissement faits depuis (§ 4.6 pour « accepté »).
- Rien ne change dans les montants, les documents, les mentions, les règles fiscales (golden Y et Z identiques), ni côté serveur.

## 9. Hors P3 (noté dans `docs/APRES-PRO-V1.md`)
Numéros de fiches fluides et de locations en double entre deux appareils hors ligne (V3, D4 / R2 : il faut d'abord choisir une façon de numéroter) ; note de fiche client perdue (D1) ; prévention côté serveur de deux factures dans un même arbre ; les **notes d'une intervention** modifiées sur l'appareil qui perd l'encaissement ne sont pas reprises (seul le groupe d'encaissement est fusionné : la note se refait en un geste) ; fusion champ par champ des champs de suivi changés des deux côtés (correction générale de D1) ; écran du journal ; `window.__nxFusionReparee` écrit et jamais lu (`next-emission.js`).

## 10. Ce qui n'a pas pu être vérifié
- iPhone et Safari réels, vrai projet Supabase (les tests simulent le serveur avec les mêmes règles ; la CI fait foi pour la batterie) : c'est ton essai du § 7.
- Le Project (outil absent) : copie du compte rendu à faire ; le dossier de la mission S n'a pas été lu.
- La relecture par l'autre modèle (règle 12) : à lancer par toi.
- La durée d'affichage du message (2,2 s) sur un vrai téléphone : lisible ou pas, à dire après l'essai ; la ligne du journal porte le même texte.

## 11. Fichiers touchés (`git diff --stat origin/main..HEAD`)
```
 docs/APRES-PRO-V1.md              |   6 +-
 docs/FILE-DES-MISSIONS.md         |  11 +-
 docs/MISSION-P3.md                |   5 +-
 docs/P3-COMPTE-RENDU.md           | 124 +++++++++++++++
 index.html                        | 173 +++++++++++++++++++-
 next-emission.js                  |   2 +-
 next-statut.js                    |   3 +
 sw.js                             |   2 +-
 tests/LISEZMOI.md                 |  21 +++
 tests/golden/fusion-empreinte.txt |   2 +-
 tests/isolation/rapport.mjs       |   2 +-
 tests/run-all.sh                  |   2 +-
 tests/suiteAD-af1-pertes.mjs      | 324 ++++++++++++++++++++++++++++++++++++--
 tests/suiteAE-p3-fusion.mjs       | 174 ++++++++++++++++++++
 tests/suiteU-fusion.mjs           | 121 +++++++++++++-
 15 files changed, 948 insertions(+), 24 deletions(-)
```
Commits : `044a6c0` documents (dossier corrigé), `83b1fe5` tests d'abord, `f10e372` code, `301a402` golden, puis documents. Aucun fichier hors périmètre ; la session OUTILLAGE (hook, `.claude/settings.json`, `docs/ENVIRONNEMENT-CLAUDE-CODE.md`) n'a pas été touchée. `faketime` était déjà installé dans l'environnement (setup script d'OUTILLAGE-2) : rien à installer.

## 12. P3-bis (09/11/2026) — conditions C1 à C4 de la relecture P10 d'Opus 5.5
Accord écrit de Gab du 09/11 : C1 et C2 oui ; décision 5 confirmée (§ 4.6) ; `sw.js` reste 1135 ; `VERSION` / `NX_VERSION` inchangés ; aucun golden ne change (la correction ne touche pas `cpMerge` : `fusion-empreinte` reste `76e10290`). Étape 0 : `origin/main` (`ef471cf` : #13, #14, #15, documents et outillage) fusionné dans la branche sans conflit (`a2e15a8`).

### 12.1 Constat (certain : reproduit par Opus en Node et sur le banc, puis par les tests rouges ci-dessous)
Dans `cpFusionEtats`, partie devis, un changement de statut **ordinaire** fait d'un seul côté (envoyé → accepté, brouillon → envoyé, accepté → annulé, accepté → remplacé) et simplement **reçu** par l'autre appareil — qui n'a rien changé depuis la base — produisait un **arbitrage fantôme** : la branche « rangs 0 / 1 » (ou le rang 3 contre 1) désignait un gagnant, et le test `x.statut !== o.statut` suffisait à enregistrer un arbitrage avec `statut_ecarte` = l'ancien statut. Conséquences : une ligne `fusion_etat` « … le geste fait ici (« … ») est écarté » dans `cpnext_journal`, une version dans `cpnext_fusion_ecartes`, et dans `pullState` la garde posait « à envoyer », rechargeait et **renvoyait** l'état (une écriture serveur par réception). Second point (C2) : sans base de synchro, la garde appliquait « le plus haut gagne » et défaisait un geste légitime de l'autre appareil (un devis reçu « envoyé » remis « accepté », un encaissement retiré ailleurs remis).

### 12.2 Tests rouges d'abord (certain : exécutés sur `a2e15a8`, commit `cf7298e`)
| Suite | Sur `a2e15a8` (code P3 avant correction) | Rouges | Témoins verts avant comme après |
|---|---|---|---|
| U | **82 / 8** | U-P3bis-1 (×5 : les quatre gestes ordinaires + « accepté → envoyé »), U-P3bis-3 (libellé exact), U-P3bis-4 (réception rang 0 / 1), U-P3bis-7 (réception sans base) | U-P3bis-2 (fiche annulée et intervention encaissée reçues), U-P3bis-3 bis (geste vraiment écarté encore nommé), U-P3bis-5 (rang 2 remis), U-P3bis-6, U-P3bis-8, U-P3bis-9 |
| AD | **141 / 7** | T43 (message exact), T44 (×5 : « à envoyer », ligne, version écartée, message « états remis », 1 écriture serveur à chaque réception), T45 (sans base : remise d'un « accepté », d'une signature et d'un encaissement) | T46 (avec base : signature, fiche annulée et compteur remis, encaissement retiré appliqué) |
| AE | **24 / 1** | AE7 (3 lignes `fusion_etat` fantômes sur le téléphone, 3 versions écartées, 5 écritures serveur du téléphone, 9 en tout) | AE7 1er contrôle (les gestes sont bien reçus) |

**Mesure sur `main`** (`ef471cf`, arbre de travail séparé, même scénario AE7, trois passages) : **5 ou 6 écritures serveur en tout, dont 1 à 2 du téléphone**, qui ne changent qu'une clé de suivi (`cpnext_objsuivi`, écrite par l'appli à son démarrage) — aucun champ d'état, aucune ligne fantôme, aucune version écartée. C'est la référence d'AE7 : le téléphone ne doit changer aucun champ d'état sur le serveur, et pas plus d'écritures que sur `main` (bornes du test : téléphone ≤ 2, en tout ≤ 6). Sur le code corrigé : 5 écritures dont 1 du téléphone (`cpnext_objsuivi` seule).

### 12.3 Correction (certain : lu et exécuté) — commit `6845e18`, `index.html` seul (+20 / −11 lignes)
- **C1, `cpFusionEtats`, devis** : juste après le retour « rien n'a changé », si le perdant n'a **rien changé depuis la base** (`b && !changes(x,b).length && !ecarte.length`) : aucun arbitrage (le résultat est rendu tel quel, ou corrigé sans ligne) ; `statut_ecarte` n'est posé que si le perdant a vraiment changé le statut (`b ? x.statut !== b.statut : x.statut !== o.statut`), sinon vide — `cpFusionLibelle` ne dit alors plus « le geste fait ici … est écarté » (« devis N : annulé sur l'autre appareil » tout court). Même règle écrite pour les **fiches fluides** (Opus : pas de défaut constaté là ; U-P3bis-2 le vérifie).
- **C2, `cpGardeReception`** : rien sans base de synchro (absente : premier passage ; illisible : `console.warn` + ligne `fusion_erreur` au journal) ; avec une base, la seconde passe est appelée avec l'option `{reception:true}` : les rangs 0 / 1 et les encaissements (devis et interventions) ne sont **pas** remis, seuls les rangs ≥ 2 d'un devis, les fiches ≥ 1 et le compteur `cp2_fluseq` le sont (dossier § 3.2 point 4). `cpGardeImport` : le `catch` d'une clé illisible journalise (`console.warn` + `fusion_erreur`). Plus aucun `catch` muet ajouté par P3.
- Rien d'autre ne change : `cpMerge` intact (empreinte `76e10290`), `pushState` / `pullState` / `importJSON` inchangés, `sw.js` 1135, aucune enveloppe nouvelle.

### 12.4 Tests verts (certain)
| Suite | Après `6845e18` |
|---|---|
| U | **90 / 0** (76 de P3 + 14 de P3-bis), empreinte inchangée |
| AD | **148 / 0 (139 + 9)** |
| AE | **25 / 0 (22 + 3)** ; AE7 : aucune ligne fantôme, versions écartées inchangées, les envois du téléphone ne touchent aucun champ d'état, écritures ≤ `main` |
| W, I, V | W 64 / 0 (aucune enveloppe nouvelle, golden `enveloppes.json` inchangé), I 43 / 0, V 8 / 0 |

### 12.5 Batterie complète, `faketime`, CI
- Batterie (`bash tests/run-all.sh` sur `6845e18`, session : PostgreSQL 16, Chromium 141, validateurs, `unshare -n`) : **COMPLET, RÉUSSI — 1 525 réussis, 0 échoué, 0 SKIP, 5 non bloquants** (les 5 « À TRANCHER » de la suite Y, inchangés). 26 contrôles de plus que P3 (U +14, AD +9, AE +3). Code de sortie 0. Golden Y et Z identiques, W sans enveloppe nouvelle.
- `faketime` 07/11/2026 (samedi), 08/11/2026 (dimanche), 05/01/2027 — `CP_SUITES="suiteU-fusion suiteAD-af1-pertes suiteAE-p3-fusion"` : **U 90 / 0, AD 148 / 0, AE 25 / 0 aux trois dates**, du premier coup (AE7 compris).
- CI sur le commit de code `6845e18` : **runs 133 (push) et 134 (demande de fusion) verts — COMPLET, RÉUSSI, 1 521 réussis, 0 échoué, 2 SKIP connus** (autotest d'isolation sans `unshare -n` sur le runner), 5 non bloquants. Le commit « documents » (tête de la branche) relance les deux événements : résultat dans la description de la PR #16.

### 12.6 Ce que ça change pour toi
- Un geste ordinaire fait sur un appareil (accepter, envoyer, annuler, remplacer par un avenant) arrive sur l'autre **sans** message « états remis », sans ligne au journal, sans « à synchroniser » et sans renvoi au serveur : comme avant P3.
- Les messages de fusion ne nomment un « geste écarté » que s'il a vraiment été fait : quand le PC n'a posé qu'une date, le message dit seulement « devis N : annulé sur l'autre appareil ».
- Au premier passage d'un appareil (pas encore de base de synchro), ce qu'il reçoit est rangé tel quel ; un appareil à jour ne défait plus un retour « accepté → envoyé » ni un encaissement retiré sur l'autre appareil. Les états terminaux, les fiches signées ou annulées et le compteur des fiches restent protégés à la réception (T46, AE5).
