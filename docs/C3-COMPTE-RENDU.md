# ClimPilot — Mission F, C3 : « article absent de la base de prix, compté 0 € » doit se voir — compte rendu

> Rédigé le 30/10/2026 par Claude (Opus 5.5), exécutant de la mission P3 (= partie C3 de `docs/MISSION-F-C1-C3.md`, sections 5 à 9),
> pour Gabriel Leroy. Branche **`correctif/c3-article-absent`**, créée depuis `release/1.13.0` (`f456f32`). **Commité et poussé le 31/10 par la session principale (tests d'abord : CI rouge, puis correction : CI verte), relu par un second modèle ; rien n'est fusionné ni déployé** ; aucune base Supabase touchée (aucun accès). Décisions de Gabriel du 21/10 appliquées
> (section 8 du dossier : textes validés, confirmation à l'envoi, propagation du renommage, repère dans la liste remis à P4).
> **Environnement de cette nuit : pas de Chromium.** Les suites Playwright n'ont PAS tourné ici ; c'est la CI qui fait foi.
> Ce qui a tourné ici est listé au § 6 (dont un banc auxiliaire jsdom, hors dépôt).
> Certitude : **certain** (lu dans le code ou exécuté ici), **probable** (déduit, ou exécuté dans le banc jsdom et pas dans Chromium), **hypothèse**.

## Ce que tu décides / fais (10 lignes)

1. **Constat nouveau (certain)** : le cas golden « MONO-SPLIT simple (à vérifier à la main) » et le cas « ancien format mono » comptent leur support **0 €** : « Support mural » n'existe pas dans ta base (seulement « standard » et « renforcé »). Montants inchangés, désormais signalés. Décide si on corrige ces 2 cas (régénération golden, ton accord).
2. **Valide les interprétations du § 4** (hypothèses) : pas de question à l'aperçu PDF, mention visible du client sur la ligne à 0 €, définition des « devis concernés », câble de repli, nouveau texte « aucun article ne le remplace ».
3. **Valide le correctif du formulaire de l'ancien format** (§ 3.2, hors liste initiale) : à l'ouverture, il remplaçait SANS RIEN DIRE un article inconnu par le 1er de la liste (ou « Aucun ») → montant changé à l'enregistrement.
4. La session principale commite en **2 temps** (§ 9) : commit 1 = tests seuls (CI attendue **rouge**, suite AC seule) ; commit 2 = le code (CI attendue **verte**, golden Y et Z identiques).
5. **Plus tard, sur une machine avec Chromium et avec ton accord** : ajouter les 3 cas golden C3 (§ 7, contenu exact fourni) puis `node tests/golden/generer.mjs`.
6. **Essai sur la copie d'essai (~15 min, § 8)** : renommer un article local utilisé par un brouillon (« renommer aussi »), en supprimer un, envoyer un devis avec une ligne à 0 €.
7. Version affichée **inchangée (1.13.0)**, cache `climpilot-next-1131-production` : après fusion, F5 sur chaque appareil.
8. Repère dans la liste des devis : **rien fait** (décision 7, remis à P4).
9. Aucun montant d'un devis existant ne change ; aucune donnée ne change de format (`absents` est calculé, jamais enregistré) ; retour arrière = revert du commit 2.
10. Fusion : après CI verte **et** ton accord ; C3 part de `release/1.13.0` → à fusionner après la PR #5 (ou dedans, à ta décision).

## 1. Synthèse

- **Calcul** : un article absent reste à **0 €** (aucun montant ne bouge), mais sa ligne porte « ⚠️ absent de la base de prix — compté 0 €, à corriger » et `compute()` expose `absents` (liste des noms, calculée). Ancien format, clim murale v2, gainable v2 (liaison, câble, réseau), natures « kit ».
- **À l'écran** : bandeau rouge (style de l'alerte « Montant différent ») **dès l'ouverture** du devis et au récapitulatif, ancien et nouveau format, téléphone et PC.
- **Au PDF** : la ligne à 0 € est imprimée **avec la mention** (avant : elle disparaissait du document, certain).
- **À l'envoi** : confirmation « Ce devis contient N article(s) compté(s) 0 € (…). L'envoyer quand même ? » — liste « Envoyer », « Mail au client » (deux formats), « Faire signer en ligne » (deux formats). Refus = rien envoyé, statut inchangé.
- **Base de prix** : renommer / supprimer un article utilisé par des devis non facturés → confirmation qui **liste ces devis** ; « renommer aussi » propage le nouveau nom (montants identiques) ; un devis facturé n'est jamais touché.
- **Assistant** : les noms de repli écrits en dur sont vérifiés dans la base ; s'ils manquent, un article existant de la même catégorie est pris et c'est dit.
- **Tests** : nouvelle suite `tests/suiteAC-articles-absents.mjs` (131 contrôles depuis la relecture du 31/10, C3-T1 à C3-T11). Dans le banc jsdom : **56/56 scénarios de page verts sur le nouveau code, 38 rouges sur l'ancien** (les 18 verts restants sont les témoins et invariants) ; golden calculs (52 cas) et documents (16) **identiques** sur les deux codes.

## 2. Constats sur le code d'origine (`f456f32`)

| # | Constat | Certitude |
|---|---|---|
| 2.1 | `venteOf(nom)` (index.html) rend 0 si le nom n'est pas dans la base ; liaison, câble, alimentation, goulotte, condensats, support, pompe : ligne à 0 €, **sans aucun signal**. Seuls les articles complémentaires (`extras`) étaient marqués « absent du catalogue ». | certain (lu) |
| 2.2 | Les lots **clim murale v2** (`next-mod-split.js`), **gainable v2** (`next-mod-gainable.js` : liaison et câble via `A.LEGACY`) et les natures « kit » (`K.base`) passent par le **même** `compute` d'index.html (`A.LEGACY` = `window.compute`, chaîne complète). Le réseau du gainable avait son propre texte « absent de la base » mais aucune liste. | certain (lu) |
| 2.3 | **PDF** : `printDevis` (ancien) et `catsHTML` (v2) n'impriment que les lignes > 0,005 € → la ligne d'un article absent **disparaît** du devis envoyé. | certain (lu ; banc : 0 mention) |
| 2.4 | **Formulaire de l'ancien format** : les listes (liaison, câble, goulotte, support, pompe, câble d'alimentation) ne contiennent que les noms connus ; à l'ouverture d'un devis dont un nom n'existe plus, le formulaire prend **le 1er choix de la liste** (liaison, câble) ou « Aucun(e) » (support, pompe, goulotte), sans rien dire ; le total du récapitulatif et le devis enregistré ensuite changent. | certain (lu) ; reproduit dans le banc (liaison remplacée par le 1er article « Cuivre », support vidé) |
| 2.5 | Envoi (liste, mail, signature) : aucune question. Base de prix : `savePrix` change le nom, `delPrix` supprime, sans regarder les devis. Assistant : `'Câble 5G1,5'` et `'Liaison 1/4 - 3/8'` écrits en dur (`next-assistant.js`, fonction `nxaOpenDevis`). | certain (lu) |
| 2.6 | **Golden existants** : 3 des 52 cas contiennent déjà un article absent (lignes à 0 € déjà figées) : `b-extras` (« Article inexistant XYZ », voulu), **`d-mono-simple`** (cas « à vérifier à la main ») et **`e-legacy-mono`** : « Support mural » n'existe pas dans la base. Le dossier attendait « aucun absents » sur les golden : ce n'est pas exact pour ces 2 cas. | certain (lignes « Support (Support mural) 0,00 € » de `calculs.json` ; banc) |
| 2.7 | Ce que coûte un article absent non signalé, sur les devis de test de la suite AC (même devis avec les articles existants) : ancien format, 5 postes : **−316,75 € HT** ; clim murale v2, liaison + support : **−92,89 €** ; gainable v2, liaison + câble : **−171,88 €** (Opus avait mesuré −171,87 € sur un gainable comparable). | probable (banc jsdom) |

## 3. Corrections (aucun montant ne change)

### 3.1 Calcul — `index.html` (`compute`) et `next-devis2.js` (`computeV2`)
- `compute` : pour chaque poste dont l'article manque, la ligne garde son montant (0 €), prend le texte « ⚠️ absent de la base de prix — compté 0 €, à corriger » (`CP_ABSENT_TXT`) et une marque `absent: <nom>` ; le résultat expose `absents` (nouveau champ, à la fin, rien d'autre ne bouge). Les **articles complémentaires gardent leur texte d'origine** (« absent du catalogue… ») : les natures clim murale, gainable et « kit » (deux fichiers hors périmètre) le reconnaissent pour leurs alertes, et le golden `b-extras` compare cette alerte (§ 4).
- `computeV2` : `absents` = réunion, dans l'ordre, des lignes marquées de tous les lots **et options**, plus les articles signalés par les natures « kit » (texte « « X » : absent de la base de prix et sans prix d'achat », lu sans toucher `next-mod-kit.js`) ; les lignes « kit » à 0 € reçoivent la marque pour le PDF.
- `next-mod-gainable.js` (réseau) : ligne marquée `absent`, texte harmonisé (« compté 0 € »).
- Les **avertissements existants ne changent pas** (le golden les compare) : la nouvelle information passe par `absents`, pas par `warnings`.

### 3.2 Formulaire de l'ancien format — `index.html` (`fillSelects`, `renderSplits`, `renderGoulottes`) — **hors de la liste initiale, nécessaire**
- `cpOptAbsente` : une valeur enregistrée absente de la liste reste **choisie**, avec « (absent de la base de prix) » si elle manque aussi dans la base. Sans cela, C3-T4 (« montants identiques ») et C3-T11 (« montants inchangés à l'ouverture ») sont impossibles pour un devis de l'ancien format : le formulaire changeait le devis lui-même (constat 2.4). Le nouveau format le faisait déjà (`fSel` : « (actuel) »).

### 3.3 Bandeau et confirmation — `next-fiabilite.js` (§ 9 du fichier)
- `nxAbsentsBandeau(a)` : bandeau rouge, classes `nxd2-warn red` (celles de l'alerte « Montant différent » du récapitulatif v2) + mêmes valeurs en style direct. Texte validé : « N article(s) absent(s) de la base de prix, compté(s) 0 € : … ».
- `nxAbsentsOk(d)` : `true` sans article absent ; sinon `confirm("Ce devis contient 1 article compté 0 € (X). L'envoyer quand même ?")` (pluriel : « 2 articles comptés 0 € (X, Y) »).
- Affichage : ancien format `cpAbsentsWizard` (index.html, appelé par `showStep` à l'ouverture et par `recalc` au récapitulatif, élément `#nxAbsWiz` sous l'en-tête) ; nouveau format `#nxd2Abs` (sous l'en-tête de l'éditeur, mis à jour par `refreshLive`, tous onglets). Dans le récapitulatif v2, l'alerte orange « articles absents » n'est plus répétée quand le bandeau est là ; le compteur « ⚠ N points à régler » le compte pour 1.

### 3.4 Envoi
- `mailDevis` (index.html) : question avant le mail ; refus → `return false`. `next-statut.js` : l'enveloppe de `mailDevis` ne passe plus le devis en « Envoyé » quand `r===false` ; `nxEnvoyer` (bouton « Envoyer » de la liste) pose la question avant tout.
- `nxd2.sign` (next-devis2.js) : question **avant** tout (refus : rien enregistré, modifications gardées).
- Signature depuis l'**ancien** formulaire (boutons de `next-signature.js`, hors périmètre) : `guardEnvoiSignature` (next-fiabilite.js) enveloppe `window.nxsSendDevis` pour l'ancien format seulement (le nouveau pose sa question dans `nxd2.sign`, pas de double question). C'est **la seule enveloppe ajoutée** ; `nxsSendDevis` n'est pas dans la liste surveillée par la suite W (vérifié : W1 identique, § 6), et l'origine est hors périmètre.
- Aperçu / PDF : **pas** de question (§ 4) ; la ligne y porte la mention.

### 3.5 Base de prix — `index.html` (`savePrix`, `delPrix`)
- Renommage d'un article local dont l'ancien nom **disparaît** de la base (pas de prix Notion ou embarqué du même nom derrière) et utilisé par des devis concernés : question 1 « OK = renommer aussi dans ces N devis (montants inchangés) / Annuler = autre choix » ; si Annuler, question 2 « Renommer seulement l'article ? … ils afficheront l'alerte… / Annuler = ne rien enregistrer ».
- Suppression : « OK = supprimer quand même (alerte) / Annuler = ne rien supprimer » ; sans devis concerné, la question d'avant (« Supprimer cet article ? »).
- « Devis concerné » = non facturé (ni facture émise, ni facture annulée par avoir), non refusé, dont le **matériel chiffré** utilise l'article. Propagation : remplacement exact du nom dans les champs d'articles (ancien format : `splits`, `goulottes`, `groupCable`, `support`, `pompeType`, `extras` ; nouveau : données des lots) — jamais le client, les notes, le numéro, ni ce qui a été figé à l'envoi.

### 3.6 Assistant — `next-assistant.js` (`nxaOpenDevis`)
- Après le pré-remplissage, chaque liaison et câble d'interconnexion est vérifié dans la base (`repliBase`) : présent → inchangé ; absent → 1er article de la même catégorie (pour le câble : d'abord les câbles d'interconnexion du formulaire), et « J'ai pris « X » parce que « Y » n'existe plus dans ta base » dans le bandeau de l'assistant ; catégorie vide → le nom reste (il sera signalé 0 €) avec « « Y » n'existe plus dans ta base de prix et aucun article « Câble » ne le remplace : compté 0 €, à corriger » (**texte nouveau, à valider**).

### 3.7 Cache — `sw.js`
- `climpilot-next-1130-production` → `climpilot-next-1131-production` (une ligne). `VERSION` et `NX_VERSION` inchangés (1.13.0). Suite P (`/climpilot-next-1[1-9]\d\d/`) : accepte ; suite X lit le nom dans `sw.js` ; outil de copie d'essai : nom dérivé (`ClimPilot-ESSAI-1131-production`). Certain (lu).

## 4. Interprétations à valider (hypothèses)

1. **Aperçu / PDF sans question** : l'aperçu n'envoie rien ; la mention est imprimée sur la ligne. La question est posée sur ce qui envoie ou marque comme envoyé (mail, « Envoyer », signature).
2. **Mention dans le PDF remis au client** (demandée par C3-T4) : si tu envoies quand même, ton client voit « ⚠️ absent de la base de prix — compté 0 €, à corriger » sur la ligne. Voulu (un devis à ligne 0 € ne doit pas partir en silence) ; dis-moi si tu préfères une mention neutre côté client.
3. **Questions par fenêtres natives** (`confirm`, OK / Annuler), comme le reste de l'appli ; le renommage en pose deux.
4. **« Devis concernés »** : refusés exclus ; « facturé » = facture émise ou annulée par avoir ; seuls les devis dont le montant utilise l'article (un nom présent avec une longueur 0 ne compte pas).
5. **Câble de repli** : d'abord un câble d'interconnexion du formulaire (4G1,5, 5G1,5, 5G2,5) présent dans la base, sinon le 1er article « Câble » — le dossier disait « le premier article de la même catégorie », qui serait « Câble 3G1,5 » (3 conducteurs, pas un câble d'interconnexion).
6. **Texte des articles complémentaires** gardé (« absent du catalogue — prix 0, à corriger ») : le changer ferait disparaître l'alerte de `b-extras` dans 2 fichiers hors périmètre et changerait un golden. Le bandeau, la confirmation et le PDF utilisent tous le texte harmonisé.
7. **Limites connues, non traitées** : (a) un article imposé par une nature (ex. « Colliers de serrage (x10) » du gainable, nom écrit dans le module) ne peut pas être renommé dans les devis : après renommage, ces devis affichent l'alerte ; (b) un devis **ouvert** dans l'éditeur pendant un renommage garde l'ancien nom à l'écran (copie de travail) ; (c) l'estimation indicative (PDF en 4 postes) n'a pas de mention par ligne : seuls le bandeau et la question jouent.

## 5. Tests : rouge sur `f456f32`, vert après (suite `tests/suiteAC-articles-absents.mjs`)

Méthode imposée cette nuit : les tests sont écrits **sans pouvoir être exécutés dans Chromium**. Leurs scénarios de page ont été rejoués dans un banc jsdom (§ 6) sur l'ancien et le nouveau code ; la colonne « banc » le dit.

| Test | Rouge sur `f456f32` parce que… | Vert après parce que… | Banc (ancien / nouveau) |
|---|---|---|---|
| C3-T1 (ancien format, 5 postes) | `compute` ne renvoie pas `absents` (« (champ absent) ») ; lignes à 0 € avec le détail « 7.5 m × 0,00 €/m » | `add(…,{absent})` + `CP_ABSENT_TXT` ; `return {…,absents}` | 2 rouges + 2 témoins verts / 4 verts |
| C3-T2 (clim v2) | idem via `A.LEGACY` ; `computeV2` sans `absents` | marque des lignes + agrégation dans `computeV2` | idem |
| C3-T3 (gainable v2) | idem (liaison et câble viennent de l'ancien moteur) | idem | idem |
| C3-T1/2/3 « mêmes totaux au millième qu'avec ces noms à 0 € dans la base » | **vert avant et après** (invariant : rien ne change dans le calcul) | — | vert / vert |
| C3-T4 (PDF ×3) | lignes à 0 € filtrées (`l.ht>0.005`) → aucune mention ; ancien format : en plus, le formulaire remplace les noms → total du document ≠ devis | filtre `||l.absent` + mention ; `cpOptAbsente` | 4 rouges, 2 verts (montants v2) / 6 verts |
| C3-T5 (écran, téléphone + PC) | pas de `#nxd2Abs` ni de `#nxAbsWiz` | bandeau à l'ouverture et au récapitulatif | 5 rouges, 2 témoins verts / 7 verts (+ 4 contrôles Playwright de visibilité, CI seulement) |
| C3-T6 (envoi ×6 chemins) | aucune question : « Envoyé » + mail dès le refus | `nxAbsentsOk` dans `mailDevis`, `nxEnvoyer`, `nxd2.sign`, enveloppe `nxsSendDevis` (ancien), `r===false` dans next-statut | 11 rouges, témoin vert / 12 verts |
| C3-T7 (renommer) | aucune question ; devis non propagés → −121,15 € et −80,77 € sur les 2 brouillons (banc) | `savePrix` + `cpDevisConcernes` + `cpRemplacerNom` | 4 rouges, 2 verts (facturé intact) / 6 verts |
| C3-T8 (supprimer) | question « Supprimer cet article ? » sans liste ; pas d'`absents` | `delPrix` + liste | 2 rouges, témoin vert / 3 verts |
| C3-T9 (assistant) | `nxaRepliBase` n'existe pas ; câble « Câble 5G1,5 » posé alors qu'il n'est plus dans la base | `repliBase` | 4 rouges, mise en place verte / 5 verts |
| C3-T10 (52 golden) | `absents` absent (52 rouges) ; montants identiques | `absents` vide sauf les 3 cas du constat 2.6 | — (réplique Z : 0 écart / 0 écart) |
| C3-T11 (sauvegarde restaurée) | pas de bandeau ; ancien format : le formulaire remplace les noms (total du récapitulatif ≠) | bandeau + `cpOptAbsente` | 3 rouges, 2 verts / 5 verts |
| « absents jamais enregistré » | vert avant et après (témoin) | — | vert / vert |

Total : **129 contrôles** à la CI du 31/10 : sur le commit des tests seuls (`6a7ff18`, code `f456f32`) **29 verts et 100 rouges** (CI certain) ; après correction (`86eaeca`) **129 verts**, batterie complète réussie (1 236 contrôles). La relecture a ajouté 2 contrôles (« commandé » et stock au renommage) : **131**.

## 6. Vérifié ici, et ce qui attend la CI

**Exécuté ici (certain)** :
- `node --check` : `next-fiabilite.js`, `next-statut.js`, `next-devis2.js`, `next-mod-gainable.js`, `next-assistant.js`, `sw.js`, `tests/suiteAC-articles-absents.mjs`, `tests/isolation/rapport.mjs` ; script en ligne d'index.html extrait (1 bloc) : OK ; `bash -n tests/run-all.sh` : OK.
- `node tests/functions/*.mjs` : 5 fichiers, codes 0 — agenda 18, apps-script 12, liste-blanche 20, signature 10, superpdp-envoi 7 : **67 réussis, 0 échec, 0 SKIP**.
- Imports de la suite AC : tous les noms importés existent (paquet Playwright sans navigateur) ; la suite s'exécute jusqu'au lancement de Chromium (absent ici : « Executable doesn't exist »), sans erreur avant.
- Secrets : la recherche du bloc commun (jetons, clés, adresses e-mail, coordonnées bancaires) ne trouve rien dans les lignes ajoutées, ni ville, ni identifiant réel ; seule la clé publique « anon » déjà présente ligne 991 d'index.html ressort, non touchée.

**Banc auxiliaire jsdom (hors dépôt, dossier de travail de la mission ; probable : jsdom n'est pas Chromium — pas de mise en page, IndexedDB simulée)** :
- Réplique de la **suite Z** (mêmes 52 cas, même relevé, même comparaison centime / millième / structure) : ancien code **0 écart**, nouveau code **0 écart** ; `absents` non vide seulement pour `b-extras`, `d-mono-simple`, `e-legacy-mono`.
- Réplique de la **suite Y** (même scénario, même normalisation) : **16/16 identiques** sur l'ancien et le nouveau code (les 3 références « À TRANCHER » comprises).
- **Suite W1** (comptage statique des enveloppes de `go`, `compute`… dans les 44 couches) : **0 différence** avec `enveloppes.json`. **W2** (couche rejouée) pour les 5 couches modifiées : aucun identifiant en double, aucune erreur, ancien et nouveau.
- **Suite AC**, scénarios de page extraits du fichier de la suite tels quels : nouveau code **56/56** ; ancien code **18/56** (les 18 verts = témoins et invariants).

**Attend la CI** : la batterie complète dans Chromium (suite AC entière dont les 4 contrôles de visibilité et la restauration par fichier, suites Y et Z réelles, Q bloquante, X avec le cache 1131, P), les validateurs, le SQL (rien de SQL ne change).

## 7. Les 3 cas golden C3 à ajouter plus tard (machine avec Chromium, ton accord)

Pourquoi pas cette nuit : sans navigateur, `tests/golden/calculs.json` ne peut pas être régénéré ; un cas ajouté à `cas-calculs.mjs` sans référence ferait échouer la suite Z (« cas manquant »). Les montants ci-dessous viennent du banc jsdom (**probable**).
À coller à la fin de la liste des cas de `tests/golden/cas-calculs.mjs` (avant `export const CAS = C;`), puis `node tests/golden/generer.mjs` :

```js
/* ---------- f. C3 (mission F) : articles absents de la base de prix (lignes à 0 €, signalées) ---------- */
cas('f-c3-ancien-absents', 'C3 ANCIEN FORMAT : liaison, câble, goulotte, support et pompe inexistants', `function(){ return {id:'c3old',num:'DV-20261020-OLD-C3',cNom:'Client C3',cType:'Professionnel',type:'Monosplit',statut:'brouillon',date:'2026-10-20',machines:[{marque:'D',ref:'X',achat:1234.56,marge:35}],splits:[{long:7.5,liaison:'Liaison inexistante C3',puiss:2.5,cableInter:'Câble inexistant C3'}],groupCable:'Câble 3G2,5',groupLong:12.3,goulottes:[{type:'Goulotte inexistante C3',long:4}],condLong:3,support:'Support inexistant C3',pompeType:'Pompe inexistante C3',pompeQte:1,heures:6.5,moMode:'heures',rateChoice:'45',mes:'Monosplit',brasure:'Brasure simple',tests:'vide',tvaRate:10,zone:'0-10 km'}; }`);
cas('f-c3-split-absents', 'C3 CLIM MURALE v2 : liaison et support inexistants', `function(){ const d=NXD2.newDevis('split',{}); const l=NXD2.newLot('split'); Object.assign(l.data,{machines:[{marque:'Daikin',ref:'FTXM25',achat:980,marge:35,breaker:'',maxCurrent:7}],splits:[{piece:'Séjour',surface:20,typeUI:'Mural',puiss:2.5,liaison:'Liaison inexistante C3',long:5,cableInter:'Câble 5G1,5'}],groupLong:6,condLong:4,support:'Support inexistant C3',mes:'Monosplit'}); d.lots=[l]; return d; }`);
cas('f-c3-gainable-absents', 'C3 GAINABLE v2 : liaison et câble d\'interconnexion inexistants', `function(){ const d=NXD2.newDevis('gainable',{}); const l=NXD2.newLot('gainable'); Object.assign(l.data,{machines:[{marque:'M',ref:'G1',achat:2400,marge:30,maxCurrent:12,kw:7.1,debit:1200,pression:50}],liaison:'Liaison inexistante C3',cableInter:'Câble inexistant C3',long:8,groupLong:10,condLong:6,tests:'vide+azote'}); d.lots=[l]; return d; }`);
```

| Cas | Total HT attendu (franchise) | Articles absents | Même devis, articles existants |
|---|---|---|---|
| `f-c3-ancien-absents` | 2 744,92 € | 5 (liaison, câble, goulotte, support, pompe) | 3 061,67 € (écart −316,75 €) |
| `f-c3-split-absents` | 2 339,28 € | 2 (liaison, support) | 2 432,17 € (écart −92,89 €) |
| `f-c3-gainable-absents` | 8 584,85 € | 2 (liaison, câble) | 8 756,73 € (écart −171,88 €) |

À savoir : le relevé golden (`RELEVER`) ne contient pas `absents`. Pour que la suite Z surveille aussi ce champ, il faudrait l'ajouter au relevé et à la comparaison de la suite Z, puis régénérer les **55 cas** (montants inchangés, un champ de plus) — à décider avec toi ; la suite AC (C3-T10) le contrôle déjà, cas par cas.

## 8. Ce que ça change pour toi

- Un article qui n'est plus dans ta base **se voit** : bandeau rouge à l'ouverture du devis, mention sur la ligne (écran et PDF), question avant l'envoi. Tu choisis : corriger (base de prix ou devis) ou envoyer quand même.
- Renommer un article dans Base de prix : ClimPilot te liste les devis **non facturés** qui l'utilisent (brouillons, mais aussi envoyés et acceptés ; pas les refusés) et propose de les mettre à jour (montants identiques si tu ne changes pas le prix en même temps). Supprimer : même liste, « supprimer quand même » ou annuler. Les devis facturés ne bougent jamais ; un devis envoyé garde son montant figé à l'envoi.
- « À commander » et le stock sont rangés par nom d'article. Après « renommer aussi » (ajout de la relecture du 31/10) : « commandé » suit le nouveau nom (pas de double commande) ; le stock suit aussi, **sauf** si un devis accepté (par exemple déjà facturé) utilise encore l'ancien nom : il reste alors sous l'ancien nom et le message te le dit — vérifie « À commander ».
- La mention rouge « absent de la base de prix — compté 0 € » **part chez le client** si tu envoies quand même : PDF et document de signature en ligne (décision 2, à valider ; une variante neutre est possible).
- À la première ouverture après la mise à jour, tes anciens devis dont un nom a disparu s'allument en rouge, **y compris facturés et refusés** (la propagation ne les corrige pas, c'est voulu). Pas de repère dans la liste des devis pour les retrouver d'avance (remis à P4).
- Un ancien devis (ou une vieille sauvegarde) avec un nom disparu **garde ce nom** à l'ouverture au lieu d'être modifié en douce.
- Rien ne change pour un devis dont tous les articles existent (golden identiques).
- **Essai proposé sur la copie d'essai** (~15 min) : 1) Base de prix › créer un article local « Liaison test », l'utiliser dans un brouillon clim murale ; noter le total ; 2) renommer l'article → la question liste le brouillon → OK → rouvrir : même total, pas de bandeau ; 3) renommer encore → Annuler puis OK (« seulement l'article ») → rouvrir : bandeau rouge, ligne à 0 € ; 4) « Envoyer » depuis la liste → question → Annuler : toujours « Brouillon » ; 5) Aperçu / PDF : la ligne apparaît avec la mention.

## 9. Ordre de commit recommandé (rouge puis vert, par la CI)

- **Commit 1 — tests seuls** : `tests/suiteAC-articles-absents.mjs` (nouveau), `tests/run-all.sh` (suite ajoutée à `SUITES_DEFAUT`), `tests/isolation/rapport.mjs` (étape `suiteAC-articles-absents` → `resAC.json` : sans elle, le rapport ignorerait la suite), `tests/LISEZMOI.md`. CI attendue : **ÉCHEC, suite AC seule** (≈ 103 rouges, scénarios exécutables, aucune erreur de syntaxe ; le reste de la batterie inchangé).
- **Commit 2 — le code** : `index.html`, `next-devis2.js`, `next-mod-gainable.js`, `next-fiabilite.js`, `next-statut.js`, `next-assistant.js`, `sw.js`, `docs/C3-COMPTE-RENDU.md`. CI attendue : **COMPLET, RÉUSSI** (AC 130/130, Y et Z identiques).

## 10. Ce qui n'a pas pu être vérifié

- Rien dans Chromium cette nuit : toutes les suites Playwright, dont la suite AC, attendent la CI. Le banc jsdom n'a ni mise en page ni vrai service worker.
- iPhone / Safari réels ; l'aspect du bandeau sur un vrai écran.
- Le comportement d'un appareil resté en 1.13.0 (cache 1130) qui reçoit des devis renommés par un appareil à jour : déduit — les noms sont de simples données synchronisées, l'ancien appareil les affiche sans bandeau.
- Aucune règle fiscale ni mention légale touchée ni vérifiée.
