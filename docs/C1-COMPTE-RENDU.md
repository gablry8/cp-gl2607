# ClimPilot — Mission F, C1 : « déjà facturé depuis un autre appareil » quand le registre ne se lit pas — compte rendu

> Rédigé le 21/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy. Branche **`correctif/c1-registre-illisible`**, créée depuis `refonte/p0-filet` (`ecf7329`, P0 corrigé après M3/M4). Dossier : `MISSION-F-C1-C3.md`, décisions de Gabriel (section 8) appliquées.
> Méthode : **tests d'abord** (rouges sur le code d'avant, preuve conservée), puis correction appli + serveur, puis tests verts, puis batterie complète. Aucun appel à un Supabase réel ni de TEST : PostgreSQL 16 local et serveur simulé seulement. **Rien n'est fusionné, rien n'est appliqué sur un projet Supabase** : la migration attend ton essai sur ClimPilot-TEST, puis ton geste sur le réel.
> Certitude : **certain** (exécuté ici), **probable** (déduit), **hypothèse**.

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
Premier passage complet (commit `6c15d9f`) : **1 084 réussis, 4 échoués, 0 SKIP, 6 non bloquants** (1 INSTABLE Q, 5 À TRANCHER Y). Les 4 échecs, un par un :
1. `fn-apps-script` — script Google, changement d'heure : connu, indépendant de C1 (vert à partir du 22/10).
2. **Suite R (d)** « Registre du serveur illisible : le serveur décide (comportement 1.12) » — ce test **figeait l'ancien comportement** ; il attend désormais le nouveau (rien d'émis, aucune demande, message). C'est le changement voulu, pas une régression.
3. **Suite R (c)** « Facture annulée par un avoir : une nouvelle facture reste possible » — le test simulait une facture au registre du serveur annulée par un avoir **connu seulement en local** (`facAnnulees`), sans document AV au registre. En mode réel, un avoir passe par `cp_emettre_document` : il est au registre. Le serveur, qui ne connaît que le registre, refusait donc à juste titre. Test corrigé : l'avoir total est aussi au registre simulé. **En passant, la règle serveur compte désormais les avoirs totaux de toute origine** (émis *ou* reconstitués/importés, comme le fait l'appli) — un ancien avoir importé libère bien le chantier (test S4ter ajouté).
4. **Suite X** (plantage : `page.reload` 30 s) et **suite Q partie 5** (« Dépannage » : le premier clic sur le menu « Créer » a dépassé 30 s, avant toute émission) : deux dépassements de délai sans lien avec l'émission, au même moment du passage. Rejoués seuls : voir ci-dessous.

Rejeu après correction des deux tests de la suite R : **suite R 42/42, suite X 8/8** (certain). Suites I, N, AA et Q : rejeu en cours au moment de ce commit, résultat au commit suivant.

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

*Fin du compte rendu C1. Prochaine étape : tes réponses (§ 7.1), ton essai sur TEST (§ 7.2-7.3), puis C3.*
