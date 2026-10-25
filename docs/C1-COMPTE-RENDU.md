# ClimPilot — Mission F, C1 : « déjà facturé depuis un autre appareil » quand le registre ne se lit pas — compte rendu

> Rédigé le 21/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy. Branche **`correctif/c1-registre-illisible`**, créée depuis `refonte/p0-filet` (`ecf7329`, P0 corrigé après M3/M4). Dossier : `MISSION-F-C1-C3.md`, décisions de Gabriel (section 8) appliquées.
> Méthode : **tests d'abord** (rouges sur le code d'avant, preuve conservée), puis correction appli + serveur, puis tests verts, puis batterie complète. Aucun appel à un Supabase réel ni de TEST : PostgreSQL 16 local et serveur simulé seulement. **Rien n'est fusionné, rien n'est appliqué sur un projet Supabase** : la migration attend ton essai sur ClimPilot-TEST, puis ton geste sur le réel.
> Certitude : **certain** (exécuté ici), **probable** (déduit), **hypothèse**.
> **Complété le 24/10/2026 (§ 9)** après tes essais sur la copie : erreur réseau *pendant* l'appel au serveur → « Résultat INCONNU » et non « NON émise » (supabase-js rend `{error, status:0}` sans rejeter la promesse). Commit `d5fab50`, tests d'abord, batterie complète rejouée, rien de fusionné.

## 1. Synthèse (5 lignes)

1. **Appli** (`next-emission.js`, +80/−19 lignes, un seul fichier applicatif) : si le registre des factures ne se lit pas (erreur, ou plus de 25 s), **rien n'est émis**, aucune demande ne part au serveur, message « Impossible de vérifier le registre des factures… Rien n'a été émis ». Avant : l'émission partait (« le serveur décide, comme avant » — et il ne décidait rien). Reproduit puis corrigé (certain).
2. **Serveur** (nouvelle migration `20261021180000_une_facture_par_source.sql`, rejouable, retour arrière fourni) : `cp_emettre_document` refuse de lui-même une **2e facture vivante pour la même source**, un **solde qui ignore l'acompte** vivant, un **acompte après le solde** ; le refus renvoie la facture existante, l'appli la reprend comme si le registre la lui avait montrée. Aucun numéro consommé par un refus. 8 soldes simultanés → un seul accepté (certain, PostgreSQL local).
3. **Mode démonstration** (décision 4 : même règle) : en démo il n'y a **pas** de registre serveur (numéros `TEST-` locaux) — la règle s'appuie donc sur l'état synchronisé : cloud muet → rien ; hors ligne → « Facture NON émise » ; état plus récent sur le serveur pas encore reçu → rien, « cet appareil n'est pas à jour ». Appareil jamais relié au cloud : inchangé. **C'est mon interprétation de « même règle »** (hypothèse à valider, § 4.3).
4. **Tests** : 16 contrôles deux appareils (suite AA) — **11 rouges avant, 16 verts après** ; 16 tests SQL — **10 rouges avant, 16 verts après** ; batterie complète : voir § 5. Golden calculs et documents **identiques** (aucun montant ne bouge).
5. **Reste à faire par toi** : essai sur ClimPilot-TEST (script à coller, verrou par marqueur), protocole 5 bis + registre coupé sur un vrai téléphone, puis migration sur le réel. **Avant la facturation réelle** (REFONTE-PLAN § 9.3). Deux découvertes en passant : la fiche M0 attend en mode démonstration un message qui ne peut pas s'y afficher (§ 6.1), et deux appareils en démo peuvent produire le même numéro `TEST-` (§ 6.2).

## 2. Le constat, reproduit ici avant toute correction (certain)

Banc deux appareils (`tests/banc-appareils.mjs`, vrai code de synchro et d'émission, serveur commun simulé), horloge au 15/09/2027, facturation réelle démarrée, téléphone **pas à jour** (état synchronisé coupé pour lui) :

| Cas | Avant la correction (code `ecf7329`) | Après |
|---|---|---|
| T1 — registre illisible, acompte de X émis sur le PC, « Facturer le solde » de X sur le téléphone | **solde F-2027-003 émis**, l'acompte n'est pas déduit, aucun message | rien n'est émis, aucune demande au serveur, message « impossible de vérifier » |
| T2 — registre illisible, solde de Y déjà émis sur le PC | **2e solde F-2027-004 émis** | rien, message |
| T3 — registre illisible, aucune facture ailleurs | émission (le registre n'a pas été lu) | rien, message : on n'émet jamais sans avoir lu le registre |
| T4 — registre qui ne répond pas (plus de 25 s, horloge avancée) | émission à la fin du délai | rien, message à la fin du délai |
| T5 — registre lisible de nouveau | — | « émise depuis un autre appareil », acompte repris, puis solde = total − acompte, **un seul** solde au registre |
| T6 — registre lu **périmé** (le PC émet l'acompte juste après la lecture du téléphone) | solde émis en ignorant l'acompte (rien côté serveur) | le **serveur** refuse, l'acompte est repris, rien d'autre n'est émis |
| T7 — hors ligne | « Facture NON émise » | inchangé |
| T8 — démo, téléphone pas à jour, acompte `TEST-` émis sur le PC | **solde TEST de 273 € émis** (acompte de 81,90 € ignoré) | cloud muet → rien ; état plus récent non reçu → rien, « pas à jour » ; après synchro → solde TEST = total − acompte |

Preuves : `tests/suiteAA-registre-illisible.mjs` ; journaux « avant » conservés dans le dossier de sortie remis à Gabriel (`AA-avant-correction.log`, `SQL-avant-correction.txt`). Côté SQL, sur la fonction 1.10 : 10 tests rouges sur 16 (les 6 verts sont les témoins : solde cohérent accepté, avoir total libère, autre utilisateur, rejeu, reconstituées, droits).

## 3. Ce qui a changé

### 3.1 Appli — `next-emission.js` (seul fichier applicatif touché)
- `dejaEmis()` : registre illisible ou trop lent → renvoie `{illisible:true}` (avant : `null`, qui laissait passer). La lecture en erreur est aussi rattrapée (`.catch`).
- `emettre()` : si `illisible` → `BUSY` relâché, message, rien d'émis. Indicateur d'attente (`attenteVisible`) : un mot à 4 s (« Vérification du registre des factures en cours… ») et à 12 s (« Le registre tarde à répondre… Rien ne sera émis sans réponse »), décision 2 : délai de 25 s conservé.
- `demanderServeur()` : une réponse `ok:false` avec `raison` et `doc` (refus du serveur) n'est plus « réponse vide » : elle est renvoyée comme `{refus}` et traitée par la **même reprise** que le registre (`reprendreAilleurs`, le bloc existant sorti dans une fonction, texte des messages inchangé). La demande en attente (`request_id`) est effacée : le serveur ne l'a pas servie.
- Mode démonstration : `aJour()` lit `climpilot_state.updated_at` (lecture légère, la même que la vérification périodique de l'appli) et la compare à la dernière version reçue (`cp2_sync.lastRemote`) ; hors ligne → `bloque({horsligne})` (« Facture NON émise : pas de réseau ») ; illisible → même message qu'en réel ; plus récent → « Cet appareil n'est pas à jour… Quitte cet écran pour synchroniser… Rien n'a été émis ». Appareil sans cloud : comme avant.
- `rapprocher()` : lit le registre du plus récent au plus ancien (comme `sourcesRegistre()`), puis remet l'ordre — le point « à long terme » de M3 C1 (plafond de 1 000 lignes), option 2.3 du dossier. Une ligne.
- Aucun autre fichier applicatif : `index.html`, `sw.js`, les autres `next-*.js`, `signer.html` sont intacts (vérifié par `git diff`).

### 3.2 Serveur — `supabase/migrations/20261021180000_une_facture_par_source.sql`
- `cp_nombre(text)` : lecture tolérante d'un nombre du payload (null si absent).
- `cp_emettre_document(...)` : **même signature**, même corps qu'en 1.10 (idempotence `request_id`, date J±1, version, numérotation, verrou de `climpilot_seq`), plus la règle **après le verrou** (et un verrou consultatif par utilisateur pour deux dates à cheval sur le 1er janvier) :
  - facture `F` vivante pour la même source (`payload->'src'` : `k`, `id`, `w`) → `{ok:false, raison:'deja_facture', doc}` ;
  - solde de devis alors qu'un acompte vivant existe et que `montant ≠ total − acompte` (±0,011) → `{ok:false, raison:'acompte_ignore', doc: l'acompte}` ; champs manquants → refus aussi ;
  - acompte de devis alors qu'un solde vivant existe → `{ok:false, raison:'solde_deja_emis', doc: le solde}`.
  - « Vivante » = aucun avoir **total** émis (`payload->'fac'->>'total' = 'true'`) ne porte son numéro dans `payload->'src'->>'w'`. Un avoir partiel ne libère pas. Les documents reconstitués, les avoirs et les payloads sans source sont hors règle. Un refus n'écrit rien et ne consomme aucun numéro.
  - Droits explicites : `revoke … from public, anon, authenticated ; grant … to authenticated` (M4 C19).
- Forme du refus (décision 3, à valider sur ce compte rendu) : **réponse structurée `ok:false`**, pas une exception. Raison : l'appli distingue un refus (reprise de la facture existante, sans alarme) d'une panne (« Facture NON émise : serveur indisponible ») ; une exception aurait tout mis dans la seconde case. Effet sur une appli **1.10** (pas à jour) face au nouveau serveur : « Facture NON émise : serveur indisponible (réponse vide) » — rien d'émis, pas de doublon ; message à améliorer seulement en mettant l'appli à jour.
- **Retour arrière** : `tests/supabase-test/4-une-facture-par-source-retour-arriere.sql` remet la fonction 1.10 **mot pour mot** (copiée depuis la migration 1.10 par script, pas retapée), retire `cp_nombre` et le commentaire ; 2 « OK ». Éprouvé sur PostgreSQL local, et par le test S12 (migration → retour → fonction 1.10 accepte de nouveau deux soldes → migration remise).
- **Essai sur ClimPilot-TEST** : `tests/supabase-test/4-une-facture-par-source-TEST.sql` — verrou par marqueur `climpilot_marqueur_test` (sans lui : « STOP », rien modifié — éprouvé sur PostgreSQL local avec `ON_ERROR_STOP`), puis la migration telle quelle, puis 5 contrôles « OK » qui n'écrivent aucune donnée.

### 3.3 Tests et bancs
- `tests/suiteAA-registre-illisible.mjs` (nouvelle, 16 contrôles, dans la batterie et la CI) ; `banc-appareils.mjs` : registre illisible / pendu par appareil, règle serveur `regleSource` (même logique que la migration) ; `serveur-simule.mjs` (suites I, N, R) : même règle.
- `tests/sql/test_une_facture_par_source.py` (16) ; les 34 tests SQL existants restent verts.
- `tests/LISEZMOI.md`, `docs/ESSAIS-SUPABASE-TEST.md` : documentés.

## 4. Ce que ça change pour toi

### 4.1 En facturation réelle
- Réseau trop faible pour lire le registre : ClimPilot **refuse d'émettre** et te le dit (au bout de 25 s au plus, avec un mot à 4 s et à 12 s). Tu réessaies plus tard, ou depuis le PC. Plus strict qu'avant, volontairement : une facture en retard de cinq minutes vaut mieux qu'un doublon ou qu'un solde sans l'acompte (81,90 € de trop dans le cas d'Opus).
- Même si un appareil mal à jour passait quand même, le **serveur** refuse : 2e solde, solde qui ignore l'acompte, 2e acompte, acompte après solde — pour les devis, et une seule facture vivante par intervention, location, année de contrat. Tu vois alors le même message qu'aujourd'hui (« émise depuis un autre appareil… reprise ici »), rien n'est émis.
- Quand tout va bien : **rien ne change** (mêmes numéros, mêmes montants, mêmes documents — golden identiques).
- Un avoir **total** libère toujours le chantier ; un avoir **partiel** non. Comme avant.
- **Une migration à appliquer** sur le réel, après l'essai sur TEST (§ 7). Tant qu'elle n'est pas appliquée, seule la protection côté appli joue (déjà suffisante pour le cas « registre illisible » ; la protection serveur couvre en plus le cas « registre lu périmé », T6).

### 4.2 En mode démonstration (numéros `TEST-`)
- Appareil relié au cloud mais **hors ligne** : « Facture NON émise : pas de réseau » — **avant, un numéro TEST partait quand même**. C'est un changement visible (hypothèse : acceptable, c'est la même règle qu'en réel ; à confirmer).
- Appareil relié au cloud, en ligne, mais **pas à jour** (une modification d'un autre appareil n'est pas encore arrivée) : « Cet appareil n'est pas à jour… quitte cet écran pour synchroniser… ». Sur le PC ouvert au premier plan, la vérification périodique (toutes les 20 s) rend ce cas rare ; sur le téléphone, c'est au retour sur l'appli que la mise à jour arrive — donc : revenir sur l'appli, laisser la synchro finir, réessayer.
- Appareil **jamais** relié au cloud : inchangé.

### 4.3 Ce que « même règle en démo » ne peut pas faire
En démo, deux appareils ne partagent **pas** de registre : l'un ne sait ce que l'autre a facturé que par l'état synchronisé. La règle que j'ai posée (« ne pas émettre sans avoir vérifié qu'on est à jour ») est la plus proche possible de la règle réelle, mais ce n'est pas un registre : si l'autre appareil n'a **pas encore envoyé** son état (il vient de facturer, l'envoi part 4 s après), le premier est « à jour » du point de vue du serveur et émettra. Fenêtre de quelques secondes, en démo seulement. Si tu veux plus, c'est le registre serveur pour les `TEST-` aussi (mission à part, pas dans C1).

## 5. Vérification

- Suite AA : **11 rouges / 16 avant** (code `ecf7329` avec les bancs corrigés), **16 / 16 après**. Suite AA sur le code d'origine avec la règle serveur seule : T1-T4 et T8 restent rouges (l'appli laissait passer, le serveur simulé refusait : l'appli 1.10 affichait alors « Facture NON émise… réponse vide ») — les deux côtés sont nécessaires.
- SQL : **10 rouges / 16 avant**, **16 / 16 après** ; les 34 tests SQL existants (migration 1.10, agenda) : verts.
- Golden calculs (suite Z, 55) et documents (suite Y) : **identiques** ; les 3 références `À TRANCHER` (M3 C2) inchangées.
- Batterie complète (Q comprise, validateurs CEN/FNFE, PostgreSQL local, `unshare -n`) : **voir § 5.1**.
- Mutation de contrôle : `git diff` ne montre qu'un fichier applicatif (`next-emission.js`) ; `sw.js` inchangé (le fichier est déjà dans la liste du cache ; pas de nouveau fichier livré).

### 5.1 Batterie complète sur la branche (Q comprise, CEN/FNFE, PostgreSQL 16 local, `unshare -n`, 0 connexion externe)
Premier passage complet (code du commit `6c15d9f`) : **1 084 réussis, 4 échoués, 0 SKIP, 6 non bloquants** (1 INSTABLE Q, 5 À TRANCHER Y). Les 4 échecs, un par un :
1. `fn-apps-script` — script Google, changement d'heure : connu, indépendant de C1 (vert à partir du 22/10).
2. **Suite R (d)** « Registre du serveur illisible : le serveur décide (comportement 1.12) » — ce test **figeait l'ancien comportement** ; il attend désormais le nouveau (rien d'émis, aucune demande, message). C'est le changement voulu, pas une régression.
3. **Suite R (c)** « Facture annulée par un avoir : une nouvelle facture reste possible » — le test simulait une facture au registre du serveur annulée par un avoir **connu seulement en local** (`facAnnulees`), sans document AV au registre. En mode réel, un avoir passe par `cp_emettre_document` : il est au registre. Le serveur, qui ne connaît que le registre, refusait donc à juste titre. Test corrigé : l'avoir total est aussi au registre simulé. **En passant, la règle serveur compte désormais les avoirs totaux de toute origine** (émis *ou* reconstitués/importés, comme le fait l'appli) — un ancien avoir importé libère bien le chantier (test S4ter ajouté).
4. **Suite X** (plantage : `page.reload` 30 s) et **suite Q partie 5** (« Dépannage » : le premier clic sur le menu « Créer » a dépassé 30 s, avant toute émission) : deux dépassements de délai sans lien avec l'émission, au même moment du passage. Rejoués seuls : voir ci-dessous.

Rejeu après correction des deux tests de la suite R (commit `b6d7eb4`), suites concernées par l'émission + X et Q : **suite R 42/42, X 8/8, I 33/33, N 37/37, AA 16/16, Q 62/62** (le contrôle INSTABLE « acompte » est même passé ce coup-ci), **SQL 51/51** (17 pour C1). Seul rouge restant : le script Google (connu). Les deux dépassements de délai de X et Q5 ne se sont pas reproduits (probable : charge de la machine pendant le premier passage ; à surveiller sur la CI).

**Bilan sur la branche : aucune régression ; 1 seul échec, connu et indépendant (script Google, vert dès le 22/10).**

## 6. Découvertes en passant (non corrigées ici)

1. **Fiche M0, contrôle 5 bis, colonne PROD** (certain, lu dans le code) : en **mode démonstration**, l'émission ne consulte **jamais** le registre serveur (`emettre()` sort avant `sonde()` et `dejaEmis()` quand `mode()==='demo'`). Le message « Une facture d'acompte a été émise… depuis un autre appareil » attendu par la fiche ne peut donc apparaître **que si la facturation réelle est démarrée**. Sur la copie d'essai (base de TEST), le 5 bis n'est probant que si tu y démarres la facturation réelle (numéros `F-` sur la base de TEST, sans aucune clé Super PDP) — ce que la fiche interdit aujourd'hui. Après C1, en démo, le téléphone affiche « pas à jour » ou « impossible de vérifier ». **À trancher** : soit la fiche autorise le démarrage de la facturation réelle sur la copie (TEST) pour le 5 bis, soit elle décrit l'attendu démo. Je ne l'ai pas modifiée (elle est sur `refonte/p0-filet`).
2. **Numéros `TEST-` en double entre deux appareils** (certain, vu dans le passage rouge T8b) : le compteur `cp2_testseq` est local ; deux appareils pas synchronisés ont produit chacun `TEST-F-2027-001`. Sans conséquence réelle (démonstration), mais c'est le risque R2 du plan (compteurs locaux) sur une série de plus ; à ranger en P3 avec `cp2_locseq` / `cp2_fluseq`.
3. Le rapprochement automatique au démarrage (`boot()` → `rapprocher()`) remet les factures du registre dans les devis **avant tout clic** : c'est bien la course décrite par Opus pour le contrôle « acompte » de la suite Q (INSTABLE). La suite AA la neutralise en coupant le registre du téléphone avant que le PC n'émette ; la même parade s'applique pour corriger le test Q7 (P0-suite).

## 7. Ce que tu fais maintenant (dans l'ordre)

1. Lire § 3.2 (forme du refus, décision 3) et § 4.2–4.3 (démo) : valider, ou me dire ce qui change.
2. **ClimPilot-TEST** : vérifier « ClimPilot-TEST » dans l'adresse, créer le marqueur si absent (`create table public.climpilot_marqueur_test (note text);`), coller **tout** `tests/supabase-test/4-une-facture-par-source-TEST.sql` → 5 « OK ». Collé par erreur dans le réel : « STOP », rien modifié (éprouvé ici sur PostgreSQL ; dans le SQL Editor de Supabase, la 1re erreur arrête bien le script : **probable**, non vérifié sur Supabase).
3. Copie d'essai (base de TEST) avec la branche : protocole 5 bis de la fiche M0 **et** le cas registre coupé — sur le téléphone, juste avant de cliquer « Facturer le solde », couper les données mobiles **puis** cliquer (ou bloquer le Wi-Fi) : attendu « Impossible de vérifier le registre des factures… Rien n'a été émis » (hypothèse : protocole non éprouvé sur un vrai appareil ; le délai peut aller jusqu'à 25 s).
4. Si tout est vert : fusion de la branche (après P0 et M0, dans l'ordre que tu as choisi), puis migration sur le **réel** (coller `supabase/migrations/20261021180000_une_facture_par_source.sql`, puis la partie 3 du script TEST pour les 5 « OK »). Retour arrière : `4-une-facture-par-source-retour-arriere.sql`.
5. Ensuite seulement : C3 (`correctif/c3-article-absent`), comme convenu.

## 8. Ce que je n'ai pas pu vérifier

- Rien sur un vrai Supabase (TEST ou réel) : ni la migration, ni le comportement du SQL Editor au `raise exception` du verrou.
- iPhone / Safari réels : le banc est Chromium ; le délai réseau réel ; le rendu des deux indicateurs d'attente sur un vrai écran.
- Le comportement d'une appli **1.10** face au nouveau serveur : déduit du code (« réponse vide »), pas exécuté.
- Aucune règle fiscale ou réglementaire touchée ni vérifiée (hors périmètre).

## 9. Correction du 24/10/2026 — erreur réseau PENDANT l'émission : « Résultat INCONNU », pas « NON émise »

> Après tes essais sur la copie (base TEST) du 24/10 : 5 bis OK ; mode avion + Wi-Fi coupé → « Facture NON émise », rien émis, puis réseau revenu → solde F-2026-004 = 126 − 37,80 = 88,20 €, registre TEST 4 factures, 0 doublon. Commit `d5fab50` sur `correctif/c1-registre-illisible`, **rien n'est fusionné**.

### 9.1 Le défaut (certain, lu dans `vendor/supabase-js-2.117.3.umd.js` puis reproduit)
`demanderServeur()` ne connaissait que deux issues : une promesse **rejetée** (délai 25 s dépassé, ou réseau coupé dans l'ancien banc) → `inconnu()` ; une réponse `{error}` → `bloque()` « Facture NON émise… Rien n'a été facturé ». Or supabase-js 2.117.3 **ne rejette pas** la promesse quand `fetch` échoue (sans `throwOnError`) : il **résout** `{error:{message:'TypeError: Failed to fetch', details:'', hint:'', code:''}, data:null, status:0}`. Le réseau coupé *pendant* l'appel passait donc par `bloque()`, et l'appli affirmait « rien n'a été facturé » alors que la demande a pu arriver au serveur et la facture être enregistrée. Ton essai « mode avion avant le clic » ne pouvait pas le montrer : là, c'est `sonde()` (ou la lecture du registre) qui échoue en premier, et « NON émise » est juste. Le défaut n'apparaît que si la coupure survient entre la lecture du registre et la réponse du serveur.

### 9.2 Ce qui a changé (un seul fichier applicatif, `next-emission.js`, +11 lignes)
- `erreurReseau(r)` : `status === 0`, ou message commençant par `TypeError` / `FetchError` / `AbortError`, ou contenant `Failed to fetch` (Chrome), `Load failed` (Safari), `NetworkError` (Firefox).
- `demanderServeur()` : si `erreurReseau(r)` → `inconnu(r.error)` (« Résultat INCONNU (TypeError: Failed to fetch)… la facture a PEUT-ÊTRE été enregistrée… Réessaie depuis CET appareil… ») et retour `{inconnu:true}` ; la demande **reste en attente** (même `request_id` au prochain clic). Avant ce test, toute autre `{error}` suit le chemin d'avant (`bloque`, migration absente, « ClimPilot doit être mis à jour »).
- Rien d'autre : `sonde()` garde son comportement (une erreur réseau à la sonde = rien n'est parti → « NON émise » reste juste) ; l'avoir (`nxAvoirEmit`) passe par le même `demanderServeur` et gérait déjà `inconnu`. `index.html`, `sw.js` et les autres fichiers sont intacts (`git diff --stat` : 3 fichiers, 47 lignes, tous ajouts).

### 9.3 Tests d'abord (certain)
- `tests/serveur-simule.mjs` : `erreurReseauBib()` = la forme exacte de la bibliothèque ; deux cas : `fail.perdreReponseBib` (le document **est** enregistré, puis la bibliothèque rend `{error, status:0}`) et `fail.reseauCoupeBib` (coupure **avant** l'arrivée : rien d'enregistré, même réponse). L'ancien `fail.perdreReponse` (promesse rejetée) est conservé : il couvre le délai dépassé.
- `tests/suiteI-emission.mjs`, bloc **I4b**, 5 contrôles : message « Résultat INCONNU » et jamais « NON émise » ; rien d'appliqué, demande en attente avec le `request_id` que le serveur a servi ; nouvelle tentative → la **même** facture (F-AAAA-001), un seul document ; coupure avant l'arrivée → INCONNU aussi, puis une seule facture (F-AAAA-002) sous le même `request_id` ; aucune erreur JavaScript.
- **Rouge d'abord** sur `20682d6` : suite I **36 PASS, 2 FAIL** — les deux contrôles de message, avec la preuve dans le détail : « Facture NON émise : serveur injoignable (TypeError: Failed to fetch). Rien n'a été facturé » alors que `docs1:1` (la facture est au registre simulé) et que la nouvelle tentative retrouvait bien F-2026-001. Journal gardé : `avant-I/journaux/suiteI-emission.log` (dossier de sortie remis avec ce compte rendu).
- **Vert après** (`d5fab50`) : **I 38/38**, puis **N 37/37, R 42/42, AA 16/16, Q 62/62** (aucun INSTABLE ce passage).

### 9.4 Batterie complète
Passage complet sur `d5fab50` (Q comprise, validateurs CEN `validation-1.3.16` et FNFE `v1.4.0.04`, PostgreSQL 16 local, `unshare -n`, 0 connexion externe établie) : **1 078 réussis, 3 échoués, 0 SKIP, 6 non bloquants** (1 INSTABLE Q « acompte », connu ; 5 À TRANCHER Y, inchangés — M3 C2). **SQL 51/51** (17 pour C1). Golden calculs (Z, 55) et documents (Y, 21) **identiques** : aucun montant ne bouge. Les 3 échecs, un par un, **aucun lié au changement** :

| Étape | Échec | Cause | Vérification |
|---|---|---|---|
| `autotest-isolation` (1/20) | « seule la boucle locale existe » : `lo v0 v1` | la paire `veth` que j'ai dû ajouter pour Chromium 153 (§ 9.6.1) — par construction | les 19 autres contrôles d'isolation verts ; « connexions externes réellement établies : 0 » |
| `suiteP-ameliorations` (1/138) | « Adresse avec une valeur inconnue… » : vue `nx_journee` au lieu de `dash` | course entre la lecture de la vue de départ (2,3 s) et le basculement automatique vers « Ma journée » (1,4 s après l'amorçage) — un délai de test, pas l'appli ; sans rapport avec l'émission | **rejouée seule : 138/138** |
| `suiteT-terrain` (plantage) | `C.veille.find(…)` indéfini à T3 | **on est samedi** : `joursVeille()` (next-messages.js) ne propose pas « demain » le samedi (il saute au lundi), et le test sème des rendez-vous « demain » sans tenir compte du jour — défaut du test lié à la date (le dossier P0 notait déjà que le côté Node des suites utilise la vraie date). Verte mardi 21/10 ; le sera lundi. Pas d'émission dans cette suite | lecture du code (certain) ; non rejouable aujourd'hui sans fausser la date de Node |

`suiteX-mise-a-jour` avait aussi 1 rouge dans le passage complet (« hors ligne après mise à jour » : `navigator.onLine` resté vrai) : c'est encore la `veth` (Chromium se croit en ligne). **Rejouée seule dans l'espace isolé sans veth : 8/8.** `fn-apps-script` : vert (12/12, le changement d'heure est passé).

Bilan : **aucune régression** ; les 3 rouges sont deux artefacts du banc d'aujourd'hui (version de Chromium) et un test dépendant du jour de la semaine.

### 9.5 Ce que ça change pour toi
- Si le réseau tombe **pendant** le clic « Facturer » (entre la lecture du registre et la réponse) : message « Résultat INCONNU » au lieu de « NON émise ». Tu refais le même clic, **depuis le même appareil** : si la facture était passée, elle est reprise (même numéro, pas de doublon) ; sinon elle est émise. Ne la refais pas depuis un autre appareil (le serveur refuserait de toute façon un doublon de source depuis C1, mais le message serait moins clair).
- Tes essais du 24/10 restent valables : « mode avion avant le clic » donne toujours « NON émise », à juste titre.
- Pour vérifier le nouveau cas sur un vrai téléphone, il faudrait couper le réseau **au moment précis** de l'envoi : difficile à provoquer à la main ; c'est le banc qui le couvre (hypothèse : sur un vrai appareil, le message exact de Safari est « TypeError: Load failed », couvert par `erreurReseau`).

### 9.6 Découvertes en passant (non corrigées, hors C1)
1. **Banc de test et Chromium récent** (certain ici) : la machine d'aujourd'hui a Playwright 1.63 / Chromium 153 (le dépôt fige 1.56.1 / Chromium 141, et Chromium 141 ne se télécharge pas d'ici). Dans l'espace réseau isolé, Chromium 153 **ignore** `Network.emulateNetworkConditions{offline:false}` (`env.mjs`) : `navigator.onLine` reste `false`, l'appli refuse d'émettre (« pas de réseau ») et toute la partie « mode réel » de la batterie plante (suite I s'arrête à I5 sur le code d'origine, sans mon changement). Contournement **hors dépôt** pour ce passage : une paire `veth` sans route dans l'espace isolé (Chromium se croit en ligne ; `curl`/`socket` vers l'extérieur : « Network is unreachable », 0 connexion établie). Conséquence : le contrôle d'isolation « seule la boucle locale existe » est rouge **par construction** (interfaces `lo v0 v1`), les autres contrôles d'isolation et le compte « connexions externes réellement établies : 0 » restent probants. La CI, qui respecte le figeage, n'est pas touchée ; à régler en P0 le jour où la version de Playwright est montée.
2. `fail.horsService` du serveur simulé rejette encore la promesse (`Promise.reject`), ce que la vraie bibliothèque ne fait pas : les suites I3/I3b restent justes (l'échec est pris à la sonde, même issue), mais le banc gagnerait à rendre la forme réelle partout. Non changé ici pour ne pas élargir C1.

### 9.7 Ce que tu fais maintenant
Rien de plus que § 7 : la correction est sur la branche (`d5fab50` + ce compte rendu), **pas fusionnée**. Une nouvelle copie d'essai construite depuis la branche corrigée est dans « Claude outputs » (`ClimPilot-ESSAI-1131-fusion.zip`, même nom de cache : le service worker est « réseau d'abord », la nouvelle `next-emission.js` est servie dès la première ouverture en ligne) ; seul `next-emission.js` change par rapport à ta copie du 21/10. Puis fusion, migration sur le réel, puis C3.

*Fin du compte rendu C1 (complété le 24/10/2026, § 9). Prochaine étape : fusion de la branche quand tu le décides, migration sur le réel, puis C3.*

