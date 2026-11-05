# ClimPilot — Mission P3 : les états terminaux gagnent la fusion entre appareils — dossier de mission

> Rédigé le 05/11/2026 par Claude (session Claude Code, mission P3-DOSSIER) pour Gabriel Leroy. **Documents seulement** : aucune ligne de l'appli ni des tests n'a changé. Branche `docs/mission-p3`, partie de `main` = `2e1214b`.
> Ce dossier dit ce qui doit changer, comment le prouver **avant** de le changer, et ce que tu dois décider. L'exécutant écrit d'abord les tests (rouges sur `main`), puis corrige.
> Numéros de ligne lus sur `main` (`2e1214b`). La demande de fusion #10 (AF1-5, brouillon) ajoute 17 lignes vers la l. 1800 d'`index.html` : après elle, `cpMergeArr` est l. 4047 et `cpMerge` l. 4058 (lu sur `9315a30`). L'exécutant retrouve tout par le nom des fonctions.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project. La copie `claude/ClimPilot-P3-dossier.md` reste à faire.
> Certitude : **certain** (lu dans le code, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. Réponds aux **3 questions du § 5.7** (oui / non suffit).
2. Fusionne d'abord **#10** (AF1-5) : P3 touche les mêmes fonctions (`cpRefusFacture`) et la même suite de tests (AD).
3. D'ici là, rien ne change : ne modifie pas un devis sur un appareil hors ligne ou pas rechargé (consigne d'AF1, § 10 de son compte rendu).
4. Après la fusion de P3 : sur chaque appareil, attends « ✓ synchronisé », puis F5, **le même jour** (cache 1135).
5. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Le défaut, en clair (certain)

Quand deux appareils ont modifié le même devis sans s'être vus, la fusion garde **l'objet entier** de l'appareil qui envoie en dernier, dès qu'il y a changé quoi que ce soit. Un PC pas à jour qui pose une date de planification sur un devis « accepté » chez lui le renvoie « accepté » au serveur, alors que le téléphone l'avait annulé, remplacé par un avenant ou fait signer. Le serveur remplace tout l'état à chaque envoi : la perte arrive sur tous les appareils.

AF1-ter et AF1-quater empêchent la double facture (refus au moment de facturer, réparation au démarrage). Ils n'empêchent pas la perte elle-même : motif d'annulation, signature du client, fiche fluide annulée ou signée, encaissement.

## 2. Lecture du code

### 2.1 Chemin d'une modification (`index.html`)

| Étape | Où | Ce qui se passe | Certitude |
|---|---|---|---|
| Enregistrer | `save` l. 1006-1011 → `markDirty` l. 3983-3984 | clé synchronisée modifiée → « à envoyer », envoi 4 s plus tard | certain |
| Envoyer | `pushState` l. 4107-4140 | `cp_state_push` avec la dernière version connue. Accepté : la base devient ce qui vient de partir. Refusé (un autre appareil a écrit) : **fusion** l. 4131 `cpMerge(base, cpGarderAbsentes(cpLocalData()), R)`, rangée sur l'appareil, base = version du serveur, « à envoyer », rechargement (l. 4135-4136). Après le rechargement, l'envoi repart sans conflit : **le résultat de la fusion devient l'état du serveur** | certain |
| Recevoir | `pullState` l. 4081-4106 | serveur plus récent et rien à envoyer : l'état reçu **remplace** celui de l'appareil (l. 4102), sans fusion. Quelque chose à envoyer : `pushState`, donc fusion | certain |
| Recharger | `cpReload` l. 3995 | rechargement seulement ; l'INIT relance `cpReparerAvenants` (l. 4200) | certain |

Conclusion : la fusion tourne **seulement** sur l'appareil qui avait une modification pas encore envoyée quand le serveur a bougé, c'est-à-dire l'appareil pas à jour. L'appli n'appelle `cpMerge` nulle part ailleurs (les suites de tests l'appellent directement). Certain (recherche dans `index.html` et `next-*.js`).

### 2.2 `cpMergeArr` / `cpMerge` (l. 4030-4047)

- **Précision sur la mission** : la règle n'est pas « champ par champ », elle est **objet par objet**. Ligne 4034 : si l'objet local diffère de la base, il gagne **en entier**. Un seul champ changé ici (date, relance, note) ramène tout l'objet local, statut compris. La suite U le fige (« objet de réglages… local gagne en bloc, pas champ par champ »). Certain.
- Une clé qui n'est pas une liste à identifiants (compteurs `{year, seq}`) : le local gagne en bloc, **même s'il recule** (suite U, « R2, figé »). Certain.
- Supprimé d'un côté, modifié de l'autre : la modification gagne (l. 4035-4036). Certain.
- Sans base (premier passage) : le local gagne. Certain.
- C'est une fonction **pure** (elle ne lit ni n'écrit rien) : la suite U l'exécute dans Node. Toute règle ajoutée doit le rester.

### 2.3 Ce qui est déjà protégé : `protegerFusion` (`next-emission.js` l. 583-621, posée sur `cpMerge` l. 820)

- Devis : `facAcompte` / `facSolde` remis s'ils ont disparu, sauf si un avoir les a annulés (`facAnnulees` réunies des deux côtés).
- Interventions : `facNum`, `facDate`, `facFig`, `facModifs`, `statut`, `payeLe`, `modeReg` remis si **la facture** a disparu.
- Locations : `fac`. Contrats : `facs` réunies. Registre `cp2_docs` et avoirs réunis. Compteurs `cp2_facseq`, `cp2_avseq`, `cp2_testseq` : le plus grand (même année).
- Certain (lu) ; prouvé par la suite I (I6, `tests/suiteI-emission.mjs` l. 207-220).
- **Pas protégé** : `statut`, `remplacePar`, `annulation`, `signature`, `signatureEnAttente`, `acceptedAt` ; les fiches fluides en entier ; l'encaissement d'une facture présente des deux côtés ; les compteurs `cp2_fluseq` et `cp2_locseq`.
- Deux défauts de forme : `catch(e){ return out; }` muet l. 820 ; `window.__nxFusionReparee` est écrit l. 619 et lu nulle part, donc les réparations ne sont pas journalisées. Certain (recherche).

### 2.4 Clés concernées (`SYNC_KEYS` l. 997, plus les clés ajoutées par les couches)

| Clé | Champs d'état | Protégé aujourd'hui |
|---|---|---|
| `cp2_devis` | `statut` (brouillon, envoye, refuse, accepte, remplace, annule), `acceptedAt`, `signature`, `signatureEnAttente`, `remplacePar`, `annulation`, factures | factures : oui ; le reste : non |
| `cp2_dep` (interventions) | `facNum`, `statut` (brouillon, facturee, payee), `payeLe`, `modeReg` | facture perdue : oui ; encaissement : non |
| `cp2_fluides` | `num`, `annulee`, `sigDetenteur`, `refusDetenteur` | non |
| `cp2_fluseq` | compteur FF-AAAA-NNN | non (peut reculer) |
| `cp2_contrats` | `facs` | oui ; aucun état terminal dans le code (pas de résiliation) |
| `cp2_clients` | coordonnées, notes, `lastZone` | non ; aucun état terminal |

### 2.5 Horodatages existants (certain)

- Il n'y a **aucun horodatage général** par objet ou par champ, ni d'identifiant d'appareil. `updatedAt` n'est posé que par l'éditeur v2 (`next-devis2.js` l. 397 et 1041) : ni par la planification, ni par la liste, ni par la signature, ni par l'annulation.
- Chaque état porte sa propre date : `annulation.at`, `remplacePar.at`, `signature.at` (heure du **serveur**), `acceptedAt`, `sentAt`, `annulee.at`, `sigDetenteur.at`, date des factures. Cela suffit pour départager deux gestes du même genre.
- La base `cp2_sync_base` (l. 4051) est le dernier état synchronisé : c'est elle qui dit **quel côté** a changé un champ.

### 2.6 Vérifié en exécutant — certain

Méthode : la vraie `cpMerge` d'`index.html`, extraite comme le fait la suite U, dans un script jetable **hors dépôt**. Notation : PC = pas à jour (il fusionne), tél = à jour.

| Cas | Résultat de la fusion aujourd'hui |
|---|---|
| tél : devis annulé (motif) ; PC : date de planification | « accepté », motif perdu, date gardée |
| tél : signé en ligne ; PC (devis « envoyé » chez lui) : relance | « envoyé », **signature perdue** |
| tél : accepté sur papier ; PC : relance | « envoyé » : le verrou d'AF1 tombe |
| tél : fiche fluide annulée ; PC : observation | annulation perdue |
| tél : fiche fluide signée par le détenteur ; PC : observation | signature du détenteur perdue |
| tél : intervention payée ; PC : note | « facturée », paiement perdu |
| compteur des fiches fluides : PC 6, tél 7 | 6 : la prochaine fiche du PC reprend un numéro du tél |
| PC : devis supprimé (encore « envoyé » chez lui) ; tél : signé | gardé, signé (correct) |
| sans base : annulé sur le serveur ; date de planification ici | « accepté » |

Suites U et AD rejouées ici sur `main` (Chromium 141, PostgreSQL 16) : **U 27 / 0, AD 101 / 0**. T19a et T22a vérifient que le défaut **existe** (« défaut D1 reproduit ») : ils sont verts sur `main`. Certain.

### 2.7 Autres constats

- **Une signature perdue par la fusion n'est jamais reposée** : le relevé ne relit que les signatures non appliquées (`next-signature.js` l. 241) et marque les autres comme appliquées (l. 248). La preuve reste dans la table `climpilot_signatures` du serveur, mais le devis ne la montre plus. Certain (lu).
- **Restaurer une sauvegarde** (`importJSON` l. 2773) marque tout « à envoyer ». Si le serveur n'a pas bougé, l'envoi passe **sans fusion** et remplace l'état du serveur. Une règle dans `cpMerge` ne couvre pas ce chemin. Certain (lu).
- Le serveur refuse une 2e facture vivante **par devis**, pas par arbre d'avenants (migration `20261021180000_une_facture_par_source.sql` l. 79-97 : source = devis, id, acompte/solde). Deux appareils peuvent donc facturer deux devis du même arbre. Certain (lu).
- Journal `cpnext_journal` (`cpJournal` l. 1762) : 200 lignes, sur l'appareil seulement (absent de `SYNC_KEYS`), sans écran ; il est compris dans la sauvegarde complète (`nxBackupKeys` l. 2745). Certain.
- Note de fiche client perdue (D1, constat 2.10 d'AF1) : `cpCompleterClient` (l. 1745-1747) réécrit `lastZone` à chaque enregistrement de devis ; la fiche client change sur le PC et gagne en entier. Probable (cause non isolée).
- Numéros de fiche fluide en double (D4, risque R2 du TOPO) : déjà figé par la suite V (V3, « échec attendu, connu »). P3 n'y touche pas (§ 5.7, hors périmètre).

## 3. La règle proposée

### 3.1 Principe

**Le résultat d'une fusion doit être celui qu'on aurait eu si les deux gestes avaient été faits sur un seul appareil.** Les règles d'un seul appareil existent déjà (AF1-bis, AF1-ter, AF1-quater). P3 les applique au moment de fusionner, au lieu de laisser gagner l'appareil qui envoie en dernier.

### 3.2 Mécanique

1. La fusion objet par objet d'aujourd'hui ne change pas.
2. Une **seconde passe** relit le résultat : nouvelle fonction **pure** dans `index.html`, appelée à la fin de `cpMerge`, testée par la suite U. Elle regarde chaque devis, fiche fluide et intervention présent des deux côtés.
   - a. **Rang** de chaque côté.
     - Devis : 0 = brouillon, envoyé ou refusé ; 1 = accepté ; 2 = signé ; 3 = remplacé ou annulé ; 4 = facture vivante. Les factures annulées par un avoir sont réunies des deux côtés avant de compter.
     - Fiche fluide : 0 = normale ; 1 = signée par le détenteur ; 2 = annulée. Signée et annulée peuvent coexister.
   - b. **Rang 2 ou plus (fiche : 1 ou plus) : ne recule jamais.** Aucun geste de l'appli ne défait ces états ; seul un avoir défait une facture, et il passe par `facAnnulees`. Le côté de plus haut rang fournit **l'objet entier**, contenu compris : c'est ce contenu-là que le client a signé, qui a été facturé ou qui a été annulé.
   - c. **Rangs 0 et 1** (états réversibles : un devis accepté peut repasser « envoyé » depuis la liste) : fusion à trois voies. Le côté qui a changé l'état depuis la base gagne. Si les deux l'ont changé, « accepté » gagne : c'est le plus prudent (verrouillé, rien ne se perd). Sans base, le plus haut gagne.
   - d. Du côté qui perd, on reprend les **champs de suivi** qu'il a changés depuis la base : notes internes (non imprimées, `next-devis2.js` l. 725), date et moment de planification, matériel réservé, heures et achats réels, relances. Pour ces champs, rien ne change : l'appareil actuel gagne.
   - e. **Ne disparaissent jamais**, quel que soit le gagnant :
     - la signature. Si le gagnant est remplacé ou annulé et que la signature est plus récente que ce geste, elle va dans `signatureEnAttente`, comme le fait `applySig` (`next-signature.js` l. 171-173) ;
     - `signatureEnAttente`, sauf si une signature est posée (elle y a été promue, l. 1809) ;
     - la facture vivante (déjà assurée par `protegerFusion`) ;
     - l'annulation d'une fiche fluide et la signature du détenteur ;
     - le numéro d'une fiche fluide : il ne change jamais une fois donné.
   - f. Compteur `cp2_fluseq` : le plus grand des deux (même règle que `cp2_facseq`).
   - g. Encaissements, seulement si tu le décides (question 3) : trois voies sur ce groupe seul. Pour un devis : `payeLe` et `mode` de chaque facture. Pour une intervention : statut payée ou facturée, `payeLe`, `modeReg`.
3. La fonction **rend** la liste de ses arbitrages, sans rien écrire elle-même (elle reste pure). Ensuite `pushState` écrit dans `cpnext_journal` (`type:'fusion_etat'`) chaque geste fait sur cet appareil qui a été écarté, et affiche un message.
4. **Garde à la réception** (`pullState` l. 4102). Avant de ranger l'état reçu, on remet les états de rang 2 ou plus présents sur l'appareil mais absents de l'état reçu : ligne au journal, puis « à envoyer ». Cela ne vaut que pour les objets présents des deux côtés, donc une suppression passe toujours. La garde couvre un appareil resté sur l'ancienne version (§ 5.2).

### 3.3 Quand deux états terminaux se rencontrent

| Côté A | Côté B | Sur un seul appareil aujourd'hui | Résultat de la fusion |
|---|---|---|---|
| facture vivante | annulé | annuler est refusé tant qu'une facture vivante existe (`cpDevisAnnuler` l. 1855, `cpDevisAnnulerOk` l. 1872) ; facturer un devis annulé est refusé (`cpRefusFacture` l. 1818) | **la facture gagne** : devis « accepté », facturé. L'annulation est écartée : journal + « annulation non appliquée : facturé sur l'autre appareil — fais un avoir puis annule » |
| facture vivante | remplacé | marquer remplacé un devis facturé est refusé (`cpMarquerRemplace` l. 1802) | **la facture gagne**. L'avenant accepté reste accepté et ne se facture pas (`cpRefusFacture` : « jamais deux factures », T19b) |
| annulé | remplacé | le premier geste gagne : « déjà remplacé, rien à annuler » (l. 1858), et `cpMarquerRemplace` refuse un devis annulé | **le premier en date** (`annulation.at` / `remplacePar.at`) gagne, l'autre va au journal. L'avenant accepté reste accepté et facturable, comme sur un seul appareil |
| annulé | annulé | — | l'annulation la plus ancienne (son motif est gardé) ; l'autre au journal |
| remplacé par A1 | remplacé par B1 | impossible (un seul avenant accepté) | le plus ancien. Les deux avenants restent bloqués à la facturation (« Deux avenants… », AF1-ter) |
| signé | remplacé ou annulé | signature puis annulation : la signature reste ; signature après : `signatureEnAttente` | les deux sont gardés, dans l'ordre des dates |
| signé | « refusé » posé à la main | — | la signature gagne, journal (hypothèse) |
| deux signatures différentes | — | impossible (un lien valable à la fois) | la plus ancienne ; l'autre au journal |
| fiche signée | fiche annulée | annuler une fiche signée est permis (`annulerFlu` l. 3631) | les deux sont gardées |
| numéro de fiche A | numéro de fiche B | impossible | celui de la base, sinon celui du serveur ; journal |

### 3.4 Ce qui reste « l'appareil actuel gagne », et pourquoi

- **Le contenu** d'un devis ou d'une fiche quand les deux côtés ont **le même rang** (lignes, prix, remise, TVA, client, observations). Le mélanger champ par champ fabriquerait un document que personne n'a vu, avec un total que personne n'a validé (règle 4). Pour un devis accepté, le contenu est déjà verrouillé (AF1) : le conflit ne peut venir que d'un brouillon ou d'un devis envoyé.
- **Les champs de suivi** (notes internes, planification, matériel réservé, heures réelles, relances). Ils ne portent ni argent ni preuve ; une perte se voit et se refait en un geste. Les fusionner champ par champ serait la correction générale de D1 ; elle changerait aussi des cas figés de la suite U (« champ retiré ici… »). C'est une mission à part, si tu la veux.
- **Les fiches clients** (D1, note du téléphone) : aucun état terminal. Hors P3 (ligne du 03/11 de `docs/APRES-PRO-V1.md`).
- **Les contrats et les locations** : leurs factures sont déjà couvertes ; ils n'ont aucun état terminal.

### 3.5 Les cas, avant et après (PC = pas à jour, il fusionne ; tél = à jour)

| # | Situation | Aujourd'hui | Après P3 (attendu) |
|---|---|---|---|
| 1 | **T19a** — tél : avenant accepté, original remplacé ; PC : date de planification sur l'original | original « accepté » + avenant « accepté » ; la double facture est bloquée au moment de facturer (AF1-ter). Certain (T19a) | original « remplacé » (lien vers l'avenant), **avec** la date du PC ; avenant accepté ; rien à réparer |
| 2 | **T22a** — chaîne O → A1 → A2 ; PC : date de planification sur O | O « accepté », A1 « remplacé », A2 « accepté ». Certain (T22a) | O « remplacé par A1 », A1 « remplacé », A2 « accepté » |
| 3 | tél : « Annuler le devis » (motif) ; PC : date de planification | « accepté », motif perdu. Certain (exécuté) | « annulé », motif gardé, date gardée |
| 4 | tél : signé en ligne ; PC (devis « envoyé » chez lui) : relance | « envoyé », signature perdue et jamais reposée. Certain (exécuté) | « accepté », signature, relance gardée |
| 5 | tél : accepté sur papier ; PC : relance | « envoyé », verrou perdu. Certain (exécuté) | « accepté » (seul le tél a changé l'état) |
| 6 | tél : signé en ligne ; PC : lignes du devis modifiées | « envoyé » avec les lignes du PC, signature perdue. Probable | version **signée** (lignes d'origine) ; les lignes du PC sont écartées, journal + message « fais un avenant » |
| 7 | **Deux appareils facturent chacun un devis du même arbre** — PC (état gelé, registre ouvert) : acompte de O ; tél : acompte de A1 (O remplacé chez lui) | les deux factures sont émises (le serveur raisonne par devis, § 2.7) ; O revient « accepté ». Probable | les deux factures **restent** (une facture émise ne s'efface pas). O est « accepté, facturé » (la facture gagne sur « remplacé »). Journal + message « deux factures sur le même chantier : fais un avoir sur l'une ». Aucune autre facture possible dans l'arbre (`cpRefusFacture`). P3 ne peut pas **empêcher** ce cas : il faudrait que le serveur connaisse l'arbre (hors P3) |
| 8 | **Avenant accepté sur le tél (O remplacé) pendant que O est annulé sur le PC** | le résultat dépend de l'appareil qui fusionne : sur le PC, O « annulé ». Probable | pour O, le premier geste en date gagne, l'autre va au journal. L'avenant reste accepté et facturable. Message « l'original a été annulé (ou remplacé) sur l'autre appareil » |
| 9 | tél : facturé ; PC : annulé | « annulé » **et** facturé, incohérent (`protegerFusion` remet la facture). Certain (lu) | « accepté, facturé » ; annulation écartée, message |
| 10 | tél : annulé ; PC : facturé | « accepté, facturé » ; l'annulation est perdue sans un mot. Certain (lu) | même résultat, avec journal + message |
| 11 | tél : fiche fluide annulée ou signée ; PC : observation modifiée | annulation ou signature du détenteur perdue. Certain (exécuté) | fiche du tél entière ; l'observation du PC est écartée (journal) |
| 12 | tél : intervention payée ; PC : note | « facturée », paiement perdu. Certain (exécuté) | « payée », si tu réponds oui à la question 3 |
| 13 | compteur des fiches fluides : PC 6, tél 7 | 6 : numéro en double à la fiche suivante. Certain (exécuté) | 7 |
| 14 | PC : devis supprimé (encore « envoyé » chez lui) ; tél : signé | gardé, signé. Certain (exécuté) | inchangé (témoin) |
| 15 | un appareil resté sur l'ancienne version fusionne et renvoie « accepté » | tous les appareils le reçoivent. Certain (lu) | un appareil P3 qui le reçoit remet l'état terminal et le renvoie (garde à la réception) |

## 4. Tests à écrire d'abord (rouges sur `main`)

### 4.1 Suite U : ce qui change dans le golden, et pourquoi il faut ton accord

- `tests/golden/fusion-empreinte.txt` contient `3f01fbdc`. C'est une somme calculée sur le **texte** de `cpMergeArr` et de `cpMerge` (`tests/suiteU-fusion.mjs` l. 57-62). P3 ajoute à `cpMerge` l'appel de la seconde passe : le texte change, donc la valeur change (une ligne). Le contrôle « texte de cpMergeArr / cpMerge… (empreinte figée) » est rouge jusqu'à la régénération.
- Les 23 cas de la table et les 3 propriétés ne doivent pas changer de résultat. Ils utilisent des clés neutres (`a`, `n`, `p`, `k`, `t`) que la seconde passe ne regarde pas. Probable : à prouver en jouant la suite U sur le code de P3, **avant** de régénérer.
- `tests/suiteU-fusion.mjs` l. 14 : ajouter la nouvelle fonction à la liste des fonctions extraites (sinon `ReferenceError`).
- **Pourquoi ton accord écrit (règle 4 de CLAUDE.md)** : ce golden fige volontairement « l'appareil actuel gagne » (R1 du plan). Le régénérer change une règle figée. Le compte rendu donnera l'avant (`3f01fbdc`), l'après, et la preuve que les 26 autres contrôles de la suite U n'ont pas bougé.
- **Attendus changés** (même accord). Dans la suite AD, le contrôle « défaut D1 reproduit » de **T19a** et celui de **T22a** deviennent « l'original reste remplacé ». Leurs contrôles suivants (réparation, « Facturer » refusé avec « autre appareil ») partiront d'un état **posé à la main**, comme T19d, puisque la fusion ne le produira plus. Cela fait 5 contrôles réécrits (probable : T19a ×2, T22a ×3, à confirmer en jouant AD sur le code de P3). Les réparations d'AF1-ter et AF1-quater restent utiles : anciennes versions, vieilles sauvegardes.

### 4.2 Suite U : cas nouveaux (Node, rouges sur `main` sauf les témoins)

Chaque cas : base B, local L, distant R, puis l'attendu. Clé `cp2_devis` sauf mention.

| Nom | B | L | R | Attendu |
|---|---|---|---|---|
| U-P3-1 annulé contre planification | O accepté | O accepté + date | O annulé + motif | O annulé, motif, date |
| U-P3-2 remplacé contre planification (T19a dans Node) | O accepté | O accepté + date | O remplacé (A) + A accepté | O remplacé (A), date ; A accepté |
| U-P3-3 signé contre relance | E envoyé | E + relance | E accepté + signature | accepté, signature, relance |
| U-P3-4 accepté sur papier contre relance | E envoyé | E + relance | E accepté | accepté |
| U-P3-5 signé contre lignes modifiées | E envoyé | E, lignes changées | E signé | lignes de R ; 1 arbitrage rendu (« lignes ») |
| U-P3-6 facturé (R) contre annulé (L) | O accepté | O annulé | O + acompte | accepté, acompte, pas d'annulation ; 1 arbitrage |
| U-P3-7 annulé (R) contre facturé (L) | O accepté | O + acompte | O annulé | idem |
| U-P3-8 annulé (L, t=10) contre remplacé (R, t=20), puis dates inversées | O accepté | O annulé | O remplacé | annulé ; puis remplacé |
| U-P3-9 deux annulations | O accepté | annulé t=20 | annulé t=10 | motif de t=10 |
| U-P3-10 `cp2_fluides` : fiche annulée, puis signée, contre observation | F | F + observation | F annulée (puis signée) | F de R entière ; 1 arbitrage |
| U-P3-11 `cp2_fluseq` | 5 | 6 | 7 | 7 (et 7 contre 6 → 7) |
| U-P3-12 `cp2_dep` payée contre note (si question 3 = oui) | facturée | facturée + note | payée | payée, note |
| U-P3-13 témoin, retour en arrière voulu | O accepté | O envoyé | O accepté + note | envoyé (seul L a changé l'état), note |
| U-P3-14 sans base | — | O annulé | O accepté + date | annulé |
| U-P3-15 symétrie | cas 1 à 11 avec L et R échangés | | | même état (rang ≥ 2) |

On garde les propriétés existantes (idempotence, entrées non modifiées, 2 000 objets en moins de 2 s), en y ajoutant une variante avec des devis.

### 4.3 Suite AD (navigateur, vraie appli, horloge REF) : après #10, à la suite de T31

| Test | État de départ | Attendu |
|---|---|---|
| T32 annulation contre planification | vraie `cpMerge` (avec `protegerFusion`), puis rangement et rechargement | « Annulé », motif, bandeau ANNULÉ ; « Facturer » refusé ; 1 ligne `fusion_etat` ; message |
| T33 signature en ligne (`nxsApplySig`) contre relance | fusion | « Accepté », signature ; le verrou AF1 refuse ensuite d'enregistrer |
| T34 signé contre lignes modifiées | fusion | version signée ; le journal nomme « lignes » ; message « fais un avenant » |
| T35 facture contre annulation, dans les deux sens | fusion | facture gardée, « accepté » ; message « annulation non appliquée » |
| T36 deux factures dans l'arbre | O et A1 facturés de chaque côté | les deux factures restent ; message ; une 3e facture est refusée |
| T37 avenant accepté contre original annulé | fusion, dates dans les deux ordres | premier en date ; l'avenant se facture ; message |
| T38 fiche fluide annulée ou signée contre observation | fusion | fiche en lecture seule ; signature du détenteur présente ; journal |
| T39 garde à la réception | `pullState` reçoit O revenu « accepté » (ancienne version) | O reste « annulé », « à synchroniser », journal |
| T40 encaissement (si question 3 = oui) | fusion | payée |
| T41 vieille sauvegarde (si question 3 = oui) | `importJSON` d'un état sans l'annulation | annulation gardée, journal |

Plus les réécritures de T19a et T22a (§ 4.1). Tous rouges sur `main` sauf les témoins, et le journal du rouge est gardé.

### 4.4 Banc deux appareils : nouvelle suite `tests/suiteAE-p3-fusion.mjs`

Elle s'appuie sur `tests/banc-appareils.mjs` : serveur commun simulé, vrais `pushState` et `pullState`. Le préfixe AE est libre (AB est réservé à la mission S). Il faut l'inscrire dans `tests/run-all.sh` (`SUITES_DEFAUT`) et dans `tests/isolation/rapport.mjs` (`resAE.json`), comme la suite AC.

**AE1 — PC pas à jour, téléphone à jour, vrai envoi au serveur simulé**
1. PC et téléphone connectés (`seConnecter`) ; un devis O « Accepté » synchronisé (`calme`).
2. `couper(PC)` : le PC ne voit plus rien.
3. Téléphone : « Annuler le devis » O, motif « abandon » ; `synchroAuto` → le serveur a O annulé.
4. PC, hors ligne (O « accepté » chez lui) : Planning, une date sur O (`planifDevis`) → « à synchroniser ».
5. `retablir(PC)` : l'envoi est refusé (conflit), la fusion passe par le vrai code, rechargement, nouvel envoi.
6. Attendu :
   - `S.conflits` = 1 ;
   - état du serveur : O « annulé », motif gardé, date du PC gardée ;
   - étiquette « Annulé » sur le téléphone après `pullState`, et sur le PC après rechargement ;
   - 1 ligne `fusion_etat` dans le journal du PC ; aucune facture.

Rouge sur `main` : le serveur a O « accepté », motif perdu.

**Autres scénarios**

| Scénario | Ce qu'on fait | Attendu |
|---|---|---|
| AE2 | tél : signature en ligne (`nxsApplySig`) ; PC hors ligne : relance | serveur : accepté + signature ; le PC refuse ensuite d'enregistrer O |
| AE3 | tél : avenant accepté ; PC : date sur l'original | serveur : O remplacé, A accepté ; « Facturer » A sur le PC donne 1 facture ; « Facturer » O est refusé |
| AE4 | PC avec `S.etatBloque` (état gelé, registre ouvert) facture O ; tél facture A1 | 2 factures au registre commun (constat) ; message sur l'appareil qui fusionne ; une 3e facture est refusée |
| AE5 | ancienne version : sur le PC, la seconde passe et la garde remplacées par l'identité (comme en 1134) | le PC renvoie O « accepté » ; le téléphone (P3) le reçoit, remet « annulé » et renvoie ; état final du serveur : annulé ; écritures bornées (≤ 3) |
| AE6 | témoins | pas de conflit → rien ne change ; suppression contre signature → devis gardé |

Horloge : `serveurCommun(debutISO)` et `REF`. Vérifier aussi avec `faketime` un samedi, un dimanche et le 05/01 de l'année suivante (règle 9).

### 4.5 Suites qui ne doivent pas bouger (la batterie le vérifie)

- I (I6 : facture et note gardées ; probable, car la note est un champ de suivi).
- V : V3 reste « échec attendu, connu ». Le compteur fusionné passe au plus grand, mais V3 ne le contrôle pas.
- O et P : clés non concernées.
- Q : recette deux appareils.
- W : aucune enveloppe ajoutée, aucune clé de synchro nouvelle.
- Y et Z : aucun montant, aucun document.

## 5. Risques, garde-fous, estimation, décisions

### 5.1 Une modification locale légitime peut être écartée

- **Laquelle.** Sur un appareil pas à jour :
  - une modification du **contenu** d'un devis (ou d'une fiche) qui a été, ailleurs, signé, accepté, remplacé, annulé ou facturé entre-temps ;
  - une annulation faite sur un devis facturé ailleurs ;
  - un « refusé » posé à la main sur un devis signé en ligne ;
  - un retour « accepté → envoyé » fait des deux côtés.
- **Ce n'est pas une perte muette.** L'appareil qui fusionne écrit une ligne dans `cpnext_journal` : `{type:'fusion_etat', cle, id, num, etat_garde, ecarte:[noms des champs], autre_appareil:true}`. Il affiche aussi un message. C'est bien l'appareil où le geste écarté a été fait.
- **Proposé en plus** (petit, sans écran) : la version écartée est gardée sur l'appareil, dans une clé locale `cpnext_fusion_ecartes` (les 20 dernières, non synchronisée, comprise dans la sauvegarde complète). Elle permet de la rattraper.
- **Limites** (certain) : le journal n'est pas synchronisé, il garde 200 lignes et n'a pas d'écran (« Écran du journal » dans `APRES-PRO-V1.md`).

### 5.2 Un appareil resté sur l'ancienne version (cache 1134 après #10, ou plus ancien)

- Tant qu'il n'a pas fait F5, il fusionne avec l'ancienne règle et peut encore renvoyer un état terminal perdu.
- Sans la garde à la réception, un appareil P3 qui n'a rien à envoyer **range tel quel** ce qu'il reçoit (l. 4102) : la perte passerait. Avec la garde (§ 3.2, point 4), il remet l'état et le renvoie.
- Un aller-retour reste possible, mais chaque nouvel aller demande une nouvelle modification du même objet sur l'appareil ancien. Il s'arrête au F5. Testé par AE5.
- Un appareil ancien qui reçoit l'état P3 le range tel quel, sans incompatibilité : ce sont les mêmes champs qu'AF1-bis, sans aucun champ synchronisé nouveau. Probable.

### 5.3 Ordre de déploiement

1. #10 fusionnée, F5 partout (cache 1134).
2. P3 sur sa branche :
   - tests rouges (journal gardé) ;
   - code ;
   - suite visée, puis batterie complète, puis CI verte ;
   - relecture par l'autre modèle (`relecture-p10`).
3. Ton essai sur la copie d'essai avec **deux appareils** (§ 5.6).
4. La fusion, faite par toi.
5. Le même jour, sur chaque appareil : attendre « ✓ synchronisé », puis F5 (cache 1135).

Rien à faire côté serveur : `cp_state_push` range n'importe quel état et ne filtre pas les clés (`docs/REPRISE.md`, section 1.11). Pas de migration, pas de fonction, pas de secret.

### 5.4 Retour arrière

- Revert du commit « code » et du commit du golden : la fusion redevient « l'appareil actuel gagne », et les tests de P3 redeviennent rouges.
- Les données écrites par P3 sont des champs qui existent déjà (statut, annulation, signature…). L'ancienne version les lit sans erreur, car ce sont ceux d'AF1-bis (certain). La clé locale `cpnext_fusion_ecartes` serait simplement ignorée.
- Aucun retour arrière à faire côté serveur.
- Garde-fou dans le code : la seconde passe est entourée d'un `try/catch` qui journalise (règle 11). En cas d'erreur, elle rend le résultat d'aujourd'hui : jamais pire qu'avant.

### 5.5 Estimation honnête

- **Fichiers de l'appli** :
  - `index.html` : nouvelle fonction pure (≈ 80 à 120 lignes près de `cpMerge`), un appel dans `cpMerge`, le journal dans `pushState`, la garde dans `pullState` ;
  - `sw.js` : 1134 → 1135, une seule fois ;
  - `next-emission.js` : rien, sauf peut-être journaliser le `catch` muet de la l. 820 ;
  - `VERSION` et `NX_VERSION` : inchangés, sauf avis contraire de ta part.
- **Tests** :
  - `suiteU-fusion.mjs` : +15 cas, et la liste des fonctions extraites ;
  - `golden/fusion-empreinte.txt` : 1 ligne, avec ton accord ;
  - `suiteAD-af1-pertes.mjs` : ≈ +12 contrôles, 5 réécrits ;
  - nouvelle `suiteAE-p3-fusion.mjs` : ≈ 6 scénarios, ≈ 20 contrôles ;
  - `run-all.sh` et `isolation/rapport.mjs` : inscription de la suite AE ;
  - en tout, ≈ 47 contrôles nouveaux.
- **Documents** : compte rendu, `FILE-DES-MISSIONS.md`, `APRES-PRO-V1.md`, `tests/LISEZMOI.md`.
- **Durée** : 3 jours de sessions (tests d'abord : 1 ; code : 1 ; batterie, CI et compte rendu : ½ ; relecture et suites : ½ à 1). La branche vit moins d'une semaine. Ton temps : ≈ 15 min d'essai, la fusion et les F5.

### 5.6 L'essai que tu feras (esquisse ; le compte rendu de P3 la détaillera)

Sur la copie d'essai, avec un PC et un téléphone, ≈ 15 min.

1. Sur le PC : crée un devis d'essai « Accepté ». Attendu : « ✓ synchronisé » sur les deux appareils.
2. Coupe le Wi-Fi du PC.
3. Sur le téléphone : « Annuler le devis », motif « abandon ». Attendu : étiquette « Annulé ».
4. Sur le PC, hors ligne : Planning, mets une date à ce devis.
5. Rallume le Wi-Fi du PC. Attendu : un message de fusion, puis « Annulé » sur les deux appareils, motif gardé.
6. Recommence avec un avenant accepté sur le téléphone. Attendu : l'original est « Remplacé » sur les deux appareils.

### 5.7 Tes 3 questions (avant de lancer P3)

1. **Golden et attendus (règle 4).** Acceptes-tu que P3 change la valeur figée de la fusion (une ligne : `tests/golden/fusion-empreinte.txt`) et l'attendu de 5 contrôles de la suite AD, qui vérifient aujourd'hui que le défaut existe ?
   - Recommandé : oui.
   - Si non : P3 se ferait dans `next-emission.js`, sans toucher au golden. Mais la règle dépendrait alors d'un module chargé après coup.
2. **Ordre.** P3 avant ou après la mission S (sécurité) ? Une seule mission touche le code à la fois.
   - Recommandé : S d'abord si tes décisions 6 à 8 sont prises (S est prête et prévue juste après #10).
   - Sinon P3 d'abord : elle n'attend aucune autre décision que celles-ci.
3. **Périmètre.** P3 corrige-t-elle aussi :
   - (a) les **encaissements** perdus à la fusion (un paiement noté sur le téléphone, effacé par le PC : cas 12) ;
   - (b) une **vieille sauvegarde restaurée** qui effacerait des signatures ou des annulations faites depuis ?
   - Recommandé : oui aux deux (+½ jour).
   - Si non : P3 s'en tient aux états terminaux, et ces deux pertes restent notées dans `APRES-PRO-V1.md`.

**Hors P3, notés** : numéros de fiches fluides et de locations en double (D4 / R2, suite V3 : il faut d'abord choisir une façon de numéroter) ; note de fiche client (D1) ; prévention côté serveur des deux factures dans un même arbre ; `catch` muet de `next-emission.js` l. 820 si P3 ne le reprend pas.
