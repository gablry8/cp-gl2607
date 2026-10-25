# ClimPilot — Mission F : facturation sûre (M3 C1 + M3 C3) — dossier de mission

> Rédigé le 21/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy, à partir des constats C1 et C3 de la relecture M3 (Opus 5.5, `M3-COMPTE-RENDU.md`, dans le Project Claude).
> **Copie dans le dépôt le 25/10/2026** (pour que la mission P3 le trouve sans accès au Project). État au 25/10 : **C1 fait** (branche `correctif/c1-registre-illisible`, contenue dans `release/1.13.0`, compte rendu `docs/C1-COMPTE-RENDU.md`) ; **C3 à faire** (prompt P3), avec les décisions de Gabriel déjà prises (section 8 : 1 textes OK, 2 délai 25 s gardé avec indicateur, 3 refus serveur `ok:false` structuré, 4 démo = même règle, 5 **confirmation** à l'envoi d'un devis avec un article à 0 €, 6 **propagation** du renommage aux devis non facturés, 7 repère dans la liste des devis **remis à P4**).
> **Ce dossier ne contient aucun code.** Il dit ce qui doit changer, comment le prouver **avant** de le changer, et ce que ça change pour toi. L'IA qui l'exécute écrit les tests d'abord, les voit rouges, puis corrige, puis les voit verts, puis la batterie complète verte.
> Certitude : **certain** (lu dans le code ou reproduit par Opus), **probable** (déduit), **hypothèse** (proposition à valider).
> **Rien n'est à faire sur le projet Supabase réel par l'IA.** Les migrations se testent sur PostgreSQL local (tests SQL) puis sur ClimPilot-TEST, et c'est **toi** qui les appliques sur le réel.
> Les numéros de ligne sont ceux du 21/10 : ils ont pu bouger, l'exécutant les retrouve par le nom des fonctions.

---

## 0. Cadre

- **Deux branches séparées**, une par constat, chacune depuis `main` (ou depuis `fusion/avant-refonte` si M0 n'est pas encore en production) **avec P0 fusionnée dedans** : sans le filet (golden calculs/documents, suites U à Z, CI), on ne peut pas prouver « montants inchangés ».
  - `correctif/c1-registre-illisible` — appli + serveur.
  - `correctif/c3-article-absent` — appli seule.
  - Pourquoi deux : C1 touche l'émission des factures et une fonction SQL ; C3 touche le moteur de devis et la base de prix. Un problème sur l'une ne doit pas retarder l'autre, et tu valides chacune seule.
- **Ordre** : C1 d'abord (bloquant pour la facturation réelle), C3 ensuite. Les deux **avant** d'activer la facturation réelle (REFONTE-PLAN § 9.3). La mise en production M0 en mode démonstration n'attend pas cette mission (verdict M3).
- **Règles pour l'IA exécutante** :
  1. Tests d'abord : chaque cas de la section 3 (C1) et 6 (C3) est écrit et **rouge** sur le code actuel avant toute correction. Le compte rendu montre le rouge, puis le vert.
  2. **Aucun montant ne change** pour un devis dont tous les articles existent : golden calculs (suite Z) et golden documents (suite Y) identiques au millième, sauf les **nouveaux** cas ajoutés. Les 3 références « À TRANCHER » (M3 C2) restent telles quelles.
  3. Aucune règle fiscale, aucune mention légale, aucun arrondi modifié.
  4. Les textes affichés à l'utilisateur sont ceux de la section 8 une fois validés par Gabriel ; en attendant, ceux proposés ici, marqués « hypothèse ».
  5. Batterie complète verte (suite Q bloquante comprise), CI verte, compte rendu d'une page par branche, puis validation de Gabriel avant toute fusion.
  6. Pas de régénération de golden sans l'écrire noir sur blanc dans le compte rendu, avec le devis et le montant avant → après.
- **Qui** (hypothèse) : C1 à Fable 5.1 (émission et serveur, périmètre M2) ; C3 à Opus 5.5 (il a déjà le banc instrumenté et les 4 cas chiffrés) — ou Fable pour les deux si tu préfères un seul interlocuteur. La relecture croisée (l'autre modèle relit) reste conseillée pour C1.

---

## Partie C1 — « Déjà facturé depuis un autre appareil » : ne jamais émettre sans avoir lu le registre (FAIT, 1.13.0)

### 1. Le constat (certain, reproduit par Opus sur le banc de la suite Q)

- `next-emission.js`, fonction `dejaEmis` (l. 313-334) : avant d'émettre une facture, l'appli lit le registre serveur (`sourcesRegistre()`) pour voir si une facture existe déjà pour ce chantier (acompte, solde, ou facture de la même intervention). Si la lecture **échoue** ou dépasse **25 s**, la fonction renvoie `null` avec le commentaire « le serveur décide, comme avant » — et l'émission part.
- Or le serveur **ne décide rien** sur ce point : `cp_emettre_document` (migration `20261002120000_documents_emis.sql`, l. 163-223) ne refuse qu'une **même demande rejouée** (même `request_id`). Il n'a aucune règle « une seule facture de solde par chantier » ni « un solde doit tenir compte de l'acompte au registre ». Le registre connaît pourtant la source de chaque document : `payload->'src'` = `{k:'devis'|'dep'|'loc'|'ctr', id, w:'acompte'|'solde'|''|annee}`, et un avoir porte dans `payload->'src'->>'w'` le numéro de la facture annulée et dans `payload->'fac'->>'total'` s'il est total.
- Trois cas reproduits (devis 273,00 €, acompte 81,90 € facturé sur le PC, téléphone en ligne mais pas à jour) :

| Cas | Registre | Résultat aujourd'hui |
|---|---|---|
| témoin | lisible | le téléphone s'arrête, reprend l'acompte ; aucune nouvelle facture ✔ |
| acompte émis ailleurs | **illisible** | le téléphone émet **un solde de 273,00 €** (l'acompte n'est pas déduit), sans message |
| solde déjà émis ailleurs | **illisible** | le téléphone émet **un 2e solde** de 273 € |

- Probabilité réelle : faible mais plausible (4G faible en cave ou en chambre froide : la lecture du registre échoue, l'émission passe). Conséquence : un client facturé deux fois, ou 81,90 € de trop. Une facture ne se supprime pas : avoir + explication au client.
- À savoir aussi (probable, long terme) : `rapprocher()` (l. 553) lit le registre du plus ancien au plus récent ; avec le plafond habituel de 1 000 lignes, les factures récentes ne seraient plus vues une fois ce nombre dépassé. `sourcesRegistre()` lit dans l'ordre inverse et n'a pas ce défaut.

### 2. Comportement cible (ce qui doit être vrai après la mission)

**2.1 Côté appli** (`next-emission.js`)
- Si le registre ne se lit pas (erreur ou délai dépassé) : **rien n'est émis**, aucun appel à `cp_emettre_document`, le devis/l'intervention reste tel quel (pas de numéro provisoire laissé), et un message clair s'affiche (hypothèse de texte : « Impossible de vérifier le registre des factures (réseau ?). Rien n'a été émis. Réessaie dans un instant. »).
- Le 2e clic, registre lisible : comportement actuel inchangé (reprise de la facture émise ailleurs avec message, ou émission normale avec solde = total − acompte).
- Hors ligne (`sonde()` « pas de réseau ») : inchangé, « Facture NON émise ».
- Mode démonstration (`TEST-`) : **à vérifier par l'exécutant** si `dejaEmis` est appelé dans ce mode ; si oui, même règle (hypothèse : oui, la démo doit se comporter comme le réel pour que l'essai M0 ait un sens).
- Le délai de 25 s : garder la valeur, mais le message doit apparaître à la fin du délai, pas un écran figé (hypothèse : un indicateur « vérification du registre… » pendant l'attente ; question 8.2).

**2.2 Côté serveur** (`cp_emettre_document`, nouvelle migration rejouable + retour arrière, comme `agenda`)
- Avant d'attribuer un numéro, pour une série `F` : chercher une facture **vivante** du même utilisateur, **même source** (`payload->'src'` : mêmes `k`, `id`, `w`), `origine = 'emis'`. « Vivante » = aucun avoir **total** (`type = 'avoir'`, `payload->'fac'->>'total' = 'true'`) ne porte son numéro dans `payload->'src'->>'w'`. Si elle existe : **refuser** l'émission et **renvoyer la facture existante** dans la réponse, de façon que l'appli puisse la reprendre comme elle le fait déjà quand le registre est lisible (ce n'est **pas** un `deja: true` : la demande n'a pas été servie, le payload de l'appareil n'est pas enregistré — question 8.3 sur la forme exacte : exception avec code, ou `ok:false`).
- Pour un **solde** de devis (`src.k = 'devis'`, `w = 'solde'`) : si un **acompte vivant** existe au registre pour le même devis (`w = 'acompte'`), le payload du solde doit s'y référer (l'exécutant identifie le champ du payload qui porte l'acompte déduit — hypothèse : dans `payload->'fac'` ; si aucun champ ne le porte aujourd'hui, en ajouter un **sans changer le document**, c'est une donnée de contrôle) et le montant du solde doit être cohérent (total − acompte, au centime, règle d'arrondi actuelle). Sinon : refus, acompte renvoyé.
- Pour un **acompte** : refus s'il existe déjà un acompte vivant **ou** un solde vivant pour le même devis (un acompte après le solde facturerait deux fois).
- Interventions (`dep`), locations (`loc`), contrats (`ctr`, `w` = année) : une seule facture vivante par source.
- Les avoirs (`AV`) ne sont pas concernés par la règle ; le rejeu par `request_id` reste identique ; les anciennes factures « reconstituées » (`cp_importer_ancien`) ne sont pas touchées ; la date J±1, la version, la taille : inchangées.
- Droits : `revoke … from public, anon, authenticated` puis `grant … to authenticated` **explicites** (M4 C19 : toujours nommer `public`).
- Rejouable : `create or replace`, et un fichier de retour arrière qui remet la fonction précédente (copie exacte de la version 1.10).

**2.3 En option, même branche C1, si trivial** : `rapprocher()` lit dans le même ordre que `sourcesRegistre()` (du plus récent au plus ancien). Si ce n'est pas une ligne, le laisser pour P3 et l'écrire dans le compte rendu.

### 3. Tests à écrire AVANT la correction (rouges d'abord)

**Banc deux appareils (suite Q, nouvelle partie, ou suite I)** — serveur simulé `tests/banc-appareils.mjs` ; l'exécutant ajoute au banc la possibilité de **rendre le registre illisible** (lecture en erreur) et **lent** (au-delà de 25 s, avec l'horloge Playwright, pas une vraie attente) sans toucher à l'émission.

| # | Cas | Attendu après correction | Aujourd'hui |
|---|---|---|---|
| C1-T1 | acompte émis sur le PC ; téléphone pas à jour ; registre **illisible** ; « Facturer le solde » | rien émis (`S.docs` inchangé), aucun appel d'émission au serveur, message « impossible de vérifier… », devis inchangé (pas de `facSolde`, pas de provisoire) | solde de 273 € émis |
| C1-T2 | solde déjà émis sur le PC ; registre illisible ; « Facturer le solde » | rien émis, même message | 2e solde émis |
| C1-T3 | **aucune** facture ailleurs ; registre illisible ; « Facturer » | rien émis, même message (la règle est : on n'émet pas sans avoir lu) | émission |
| C1-T4 | registre **lent** (> 25 s) | identique à T1 : rien émis, message à la fin du délai | émission |
| C1-T5 | après T1, registre redevenu lisible, 2e clic | arrêt avec « émise depuis un autre appareil », reprise de l'acompte, aucune nouvelle facture ; 3e clic : solde = total − acompte, un seul solde | (comportement actuel, doit rester vert) |
| C1-T6 | témoin : registre lisible, tous les cas existants de Q7 et de la suite I | inchangés | verts |
| C1-T7 | hors ligne | « Facture NON émise », rien de plus | vert |
| C1-T8 | mode démonstration, registre illisible | même règle qu'en réel (si `dejaEmis` s'applique en démo ; sinon le test documente que la démo n'est pas concernée) | à constater |

**Tests SQL (`tests/sql`, PostgreSQL local, migration appliquée)**

| # | Cas | Attendu |
|---|---|---|
| C1-S1 | 2 appels `cp_emettre_document` avec deux `request_id` différents, même `src` devis + `w = 'solde'` | 2e appel refusé, réponse contient le document existant (num, id) ; `climpilot_seq` **non incrémenté** par le refus |
| C1-S2 | acompte vivant au registre, puis solde dont le payload ne référence pas l'acompte (ou montant ≠ total − acompte) | refusé, acompte renvoyé |
| C1-S3 | acompte vivant, solde cohérent (référence + montant) | accepté |
| C1-S4 | solde émis, puis avoir **total** sur ce solde, puis nouveau solde | accepté (le chantier est libéré) |
| C1-S5 | solde émis, puis avoir **partiel**, puis nouveau solde | refusé (la facture reste due) |
| C1-S6 | acompte émis, puis acompte à nouveau (autre `request_id`) ; acompte après solde | refusés |
| C1-S7 | `dep`, `loc`, `ctr` (deux années différentes acceptées, même année refusée) | une facture vivante par source |
| C1-S8 | même `request_id` rejoué | `deja: true`, inchangé |
| C1-S9 | `cp_importer_ancien` : deux anciennes factures de même source | acceptées (reconstituées, hors règle) |
| C1-S10 | concurrence : deux soldes simultanés pour le même devis (deux transactions) | un seul accepté, l'autre refusé (verrou sur `climpilot_seq` déjà pris : vérifier qu'il couvre bien ce cas, sinon verrou explicite) |
| C1-S11 | droits : `anon` ne peut pas appeler ; `authenticated` peut | comme aujourd'hui |
| C1-S12 | migration rejouable deux fois ; retour arrière rejoue la version 1.10 ; `test_migration.py` existant vert | — |

**Filet** : suites Y et Z identiques (aucun montant ne bouge) ; batterie complète verte ; CI verte sur la branche.

**Sur ClimPilot-TEST, par Gabriel** (après le vert local) : appliquer la migration avec le marqueur `climpilot_marqueur_test` et le verrou (comme `3-agenda-TEST.sql`), rejouer le protocole 5 bis de la fiche M0 **plus** le cas registre illisible (couper le réseau du téléphone juste après avoir cliqué, ou bloquer le domaine Supabase dans les réglages du téléphone — protocole à écrire par l'exécutant, hypothèse) : attendu « impossible de vérifier… », rien émis.

### 4. Ce que ça change pour toi

- Quand le réseau est trop faible pour lire le registre, ClimPilot **refuse d'émettre** au lieu de tenter sa chance. Tu vois « impossible de vérifier… réessaie » et tu recommences un peu plus tard (ou depuis le PC). C'est volontairement plus strict : **mieux vaut une facture en retard de cinq minutes qu'une facture en double**.
- Même si un appareil mal à jour essayait quand même, le **serveur** refuse un 2e solde, un solde qui ignore l'acompte, ou un 2e acompte : la règle existe aux deux niveaux.
- Rien ne change quand tout fonctionne : mêmes numéros, mêmes montants, mêmes documents, même reprise « émise depuis un autre appareil ».
- Un avoir **total** libère toujours le chantier (tu peux refacturer) ; un avoir **partiel** ne le libère pas (la facture reste due), comme aujourd'hui.
- Une migration SQL à appliquer sur le projet réel (ton geste, après TEST), avec son retour arrière écrit.

---

## Partie C3 — « Article absent de la base : compté 0 € » doit se voir (À FAIRE : prompt P3)

### 5. Le constat (certain, 4 cas chiffrés par Opus sur copie jetable)

- `index.html` l. 1398 : `venteOf(nom)` renvoie **0** si le nom n'est pas dans la base de prix (`findPrix`). Tous les postes « matériel » du moteur passent par là : liaison, câble d'interconnexion, alimentation du groupe, goulotte, condensats, support, pompe de relevage (l. 1407-1428). Les lots split et gainable v2 passent par le **même** moteur ; le lot gainable ne prévient pas non plus pour sa liaison et son câble.
- **Un seul** cas prévient : les « articles complémentaires » (`extras`, l. 1433) : ligne « ⚠️ absent du catalogue — prix 0, à corriger ».
- Comment ça arrive : tu renommes ou supprimes un article local dans Base de prix (`savePrix` l. 1833 garde l'identifiant mais change le nom ; `delPrix` l. 1840 — aucun contrôle des devis qui l'utilisent) ; l'assistant se rabat sur des noms écrits en dur (`'Câble 5G1,5'`, `'Liaison 1/4 - 3/8'`, `next-assistant.js` l. 315 et 318) ; une future version renomme un article de la base intégrée ; une ancienne sauvegarde restaurée avec d'autres noms.
- Mesuré : −149,22 € HT (ancien format, 5 noms), −91,27 € (split v2), −171,87 € (gainable v2), −96,92 € (article local renommé), **sans aucun avertissement**.
- Ce qui protège déjà : un devis **envoyé ou accepté** garde son montant (`figEnv`) et une alerte « Montant différent » apparaît au moment de facturer (`next-fiabilite.js` l. 202). Un **brouillon** n'a aucune protection : il peut partir au client avec une ligne à 0,00 €, et une fois accepté, c'est ce prix qui compte.

### 6. Comportement cible

**6.1 Dans le calcul** (`compute`, et tout chemin v2 qui appelle `venteOf`)
- Pour **chaque** poste dont l'article n'est pas trouvé : le montant reste **0** (aucun changement de calcul), mais la ligne porte le même avertissement que les articles complémentaires (texte actuel : « ⚠️ absent du catalogue — prix 0, à corriger » ; hypothèse : harmoniser en « ⚠️ absent de la base de prix — compté 0 €, à corriger »), et le résultat de `compute` expose la liste des articles absents (un champ nouveau, par exemple `absents: [...]`, **sans** toucher aux champs existants : les golden comparent les sorties existantes).
- Les lignes de liaison et de câble du lot **gainable** (`next-mod-gainable.js`) suivent la même règle.

**6.2 À l'écran**
- Récapitulatif du devis (ancien format et v2) : un bandeau rouge « N article(s) absent(s) de la base de prix, compté(s) 0 € : … », du même style que l'alerte « Montant différent » de `next-fiabilite.js`.
- Avant « Envoyer » (mail/PDF) un devis qui a au moins un article absent : une **confirmation** explicite (hypothèse : « Ce devis contient 1 article compté 0 € (Liaison 1/4 - 3/8). L'envoyer quand même ? ») — décision prise : **confirmation**.
- Liste des devis : repère visuel sur les brouillons concernés — décision prise : **remis à P4**.

**6.3 Dans Base de prix**
- Renommer ou supprimer un article **utilisé par un devis non facturé** (brouillon, envoyé, accepté sans facture) : avant d'enregistrer, une confirmation qui **liste les devis concernés** (numéros), et le choix :
  - renommer : « renommer aussi dans ces N devis » (propagation, **décision prise**) ou « renommer seulement l'article » (les devis afficheront l'alerte) ;
  - supprimer : « supprimer quand même » (les devis afficheront l'alerte) ou annuler.
- Un devis **facturé** n'est jamais touché (ses documents sont figés au registre).

**6.4 Assistant** (`next-assistant.js` l. 315, 318) : les noms de repli écrits en dur sont vérifiés dans la base au moment de l'emploi ; s'ils manquent, prendre le premier article de la même catégorie et le signaler dans la réponse de l'assistant (« j'ai pris X parce que Y n'existe plus dans ta base »).

**6.5 Ce que la mission ne fait pas** : aucun prix n'est inventé, aucun article n'est recréé, aucun montant d'un devis existant ne change (un devis avec un article absent reste à 0 € sur cette ligne : il est **signalé**, pas corrigé à ta place).

### 7. Tests à écrire AVANT la correction (rouges d'abord)

| # | Cas | Attendu après correction | Aujourd'hui |
|---|---|---|---|
| C3-T1 (golden calculs, nouveau cas) | devis ancien format avec liaison, câble, goulotte, support, pompe **inexistants** | mêmes totaux qu'aujourd'hui (lignes à 0), **et** `absents` = les 5 noms, chaque ligne avec l'avertissement | lignes muettes |
| C3-T2 (golden calculs) | devis v2 split, liaison + support inexistants | idem (−91,27 € HT inchangé, 2 absents signalés) | muet |
| C3-T3 (golden calculs) | devis v2 gainable, liaison + câble inexistants | idem (2 absents) | muet |
| C3-T4 (golden documents) | PDF du devis C3-T1 | la mention d'avertissement apparaît sur chaque ligne concernée ; **montants identiques** | aucune mention |
| C3-T5 (suite B ou R, écran) | récapitulatif du devis C3-T2 | bandeau rouge « 2 articles absents… » visible, téléphone et PC | absent |
| C3-T6 (écran) | « Envoyer » un devis avec un article absent | confirmation affichée ; refuser = rien envoyé, statut inchangé ; accepter = comportement actuel | envoi direct |
| C3-T7 (Base de prix) | renommer un article local utilisé par 2 brouillons et 1 devis facturé | confirmation listant les 2 brouillons (pas le facturé) ; « renommer aussi » → les 2 brouillons gardent leur montant au centime ; « seulement l'article » → les 2 brouillons affichent l'alerte, le facturé est intact | renommage silencieux, −96,92 € |
| C3-T8 (Base de prix) | supprimer un article utilisé | confirmation listant les devis ; annuler = rien ; confirmer = alerte sur les devis | suppression silencieuse |
| C3-T9 (assistant, test fonction simulé) | base sans `'Câble 5G1,5'` | repli sur un article de la catégorie + signalement | nom inexistant posé dans le devis |
| C3-T10 (régression) | tous les devis golden existants (55 cas) | **identiques au millième**, aucun `absents` | verts |
| C3-T11 | restauration d'une sauvegarde contenant un nom d'article inconnu | les devis concernés sont signalés à l'ouverture (bandeau), montants inchangés | muet |

**Filet** : suites Y et Z identiques sur les cas existants ; nouveaux cas golden ajoutés **dans le même commit** que la correction, avec leurs montants écrits dans `calculs-lisible.md` ; batterie complète verte ; CI verte.

### 8. Décisions de Gabriel (prises le 21/10/2026)

1. **Textes** des messages : validés tels que proposés.
2. **Délai** avant de déclarer le registre illisible : 25 s gardé, avec un indicateur d'attente.
3. **Forme du refus serveur** : réponse `ok:false` structurée (validée sur le compte rendu C1).
4. **Mode démonstration** : même règle qu'en réel.
5. **Envoi d'un devis avec un article à 0 €** : confirmation, pas de blocage.
6. **Renommage d'un article** : propagation aux devis non facturés.
7. **Repère dans la liste des devis** : remis à P4.

### 9. Validation, retour arrière, effort

- **Validation** : pour chaque branche, un compte rendu d'une page (format M3 : constat → test rouge → correction → test vert → batterie → ce qui change pour toi), puis ton accord, puis fusion dans `main` avec la CI verte. Pour C1 : essai sur ClimPilot-TEST (section 3) avant d'appliquer la migration sur le réel.
- **Retour arrière** : C1 appli = revert du commit ; C1 serveur = fichier de retour arrière qui remet `cp_emettre_document` 1.10 (rejoué sur TEST d'abord) ; C3 = revert du commit (aucune donnée ne change de format : le champ `absents` est calculé, pas stocké).
- **Effort** (hypothèse) : C1 = 1 à 2 sessions (banc + SQL + appli), C3 = 1 à 2 sessions. Essais appareils par toi : 30 min pour C1.
- **Ce que la mission ne vérifie pas** : le comportement sur un vrai iPhone/Safari (le banc est Chromium) ; la valeur réelle du délai réseau sur le terrain ; aucune règle fiscale.
