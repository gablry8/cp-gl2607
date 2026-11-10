# ClimPilot — Mission AF1-B : factures jamais perdues, appareil restauré, données pas encore envoyées — dossier de mission

> Rédigé le 09/11/2026 par Claude (session Claude Code, mission AF1-B-DOSSIER) pour Gabriel Leroy. **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-af1b`, partie de `main` = `6a89e60` (P3 fusionnée).
> AF1-B a été définie le 27/10 (correctifs de perte de données). C'est une **exception au gel** décidée par Gab (décision 23). Elle se code **après S et COMPTE**, sur la branche `correctif/af1b-factures`. Trois points : **C-N2** (PDF et XML d'une facture émise), **C-N3** (appareil restauré et pas connecté), **T17** (indicateur « pas encore envoyé »).
> Ce dossier dit ce qui doit changer, comment le prouver **avant** de le changer, et ce que tu dois décider. L'exécutant écrit d'abord les tests (rouges sur `main`), puis corrige.
> Numéros de ligne lus sur `main` (`6a89e60`). S et COMPTE passeront avant AF1-B et peuvent les décaler : l'exécutant retrouve tout par le nom des fonctions.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project. La copie `claude/ClimPilot-AF1B-dossier.md` reste à faire.
> Rien n'a été exécuté contre Supabase (RÉEL ou TEST). Les essais du § 2 tournent sur la vraie appli (Chromium 141, Playwright 1.56.1, Node 22) avec le serveur simulé des tests, hors réseau.
> Certitude : **certain** (lu dans le code, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. **Lis le § 2** : les trois défauts sont reproduits sur `main` (7 essais, journal au § 2.4). Une facture peut perdre son PDF et son XML. Un appareil pas connecté sort une facture TEST qui bloque le chantier. Sur téléphone, rien ne dit qu'un pointage n'est pas encore envoyé.
2. Réponds aux **7 questions du § 6** (oui / non suffit). La principale est la question 1 : pour C-N2, option (a) ou (b). **Mon avis : (a)**, en gardant la reprise de (b) pendant la transition.
3. **Contradiction à trancher (question 7)** : `docs/APRES-PRO-V1.md` range encore T17 parmi les idées gelées (n° 10). Ton prompt le met dans AF1-B (décision 23). Confirme.
4. Rien d'urgent en production : la facturation réelle n'y est pas démarrée (`docs/REPRISE.md`, 08/10 ; non vérifié sur le réel). Tant qu'AF1-B n'est pas fusionnée, sur la copie d'essai : ne facture pas depuis un appareil déconnecté, et après une facture, attends « ✓ synchronisé ».
5. Si tu choisis (a) : tu colleras **deux scripts SQL** préparés par la mission (TEST, puis réel), avec un essai entre les deux (≈ 20 min, § 5.5).
6. Après la fusion d'AF1-B : sur chaque appareil, attends « ✓ synchronisé », puis F5, **le même jour**.
7. Estimation : 5 à 6,5 jours de sessions avec (a), 3 à 4 jours avec (b). Je propose **deux branches** (question 2) pour tenir la règle « une semaine au plus ».
8. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Ce qui existe (lecture du code de `main`, `6a89e60`)

### 1.1 Émission d'une facture réelle : deux appels au serveur (`next-emission.js`)

| Étape | Où | Ce qui se passe | Certitude |
|---|---|---|---|
| Essai à blanc | `emettre` l. 256, `aBlanc` l. 155, `SORTES` l. 193-248 | La facture est calculée sur une copie, avec un numéro provisoire `PROVISOIRE-` suivi de 8 caractères tirés au hasard. Rien n'est enregistré. | certain |
| Vérifications | l. 307-313 : `sonde`, `dejaEmis` | Serveur muet, hors ligne ou registre illisible : rien n'est émis (« Facture NON émise »). | certain |
| **Appel 1 : le numéro** | `demanderServeur` l. 450 → `cp_emettre_document` | Le serveur donne le numéro **et** enregistre le contenu de la facture (`payload` : la facture et son modèle de facture électronique, sans le numéro) dans la même transaction. Une même demande (`request_id`) rejouée rend la même facture. Coupure pendant l'appel : « Résultat INCONNU », même demande au prochain clic (`inconnu` l. 436). | certain |
| Fabrication des fichiers | `finir` l. 490-506 | **Après** la réponse : le numéro est posé, le PDF (HTML capturé, `capturer` l. 166) et le XML sont fabriqués, puis rangés **sur l'appareil seulement** (`cpnext_docs_fichiers`, `fichiersPut` l. 102, clé non synchronisée). | certain |
| **Appel 2 : les fichiers** | `deposerFichiers` l. 508-513 → `cp_document_fichiers` | Lancé sans attendre la fin (l. 502). En cas d'échec seulement, la copie locale reçoit la marque `aDeposer` (identifiant du document au serveur). | certain |
| Avoirs | `nxAvoirEmit` l. 516-540 | Même schéma : numéro, puis fichiers (l. 529). | certain |

### 1.2 `aDeposer` et sa reprise
- `deposerEnRetard` (l. 767) redépose chaque fichier marqué `aDeposer`. Elle est appelée à deux moments :
  - à la fin de `rapprocher` (l. 649). Au démarrage, `rapprocher` ne tourne que si l'appareil est connecté, a un SIRET et a démarré la facturation réelle (l. 899) ;
  - au retour du réseau, par l'événement `online` (l. 900).
- `nxEmisDeposer` (l. 766) est appelée avant un envoi à la plateforme (`next-superpdp.js` l. 143). Sans marque `aDeposer`, elle répond « fait » sans rien vérifier.
- Rien ne se voit à l'écran. Le badge du mode (`badge`, l. 843-848) montre le mode, les factures en attente d'émission et les numéros en double. Il ne dit rien des fichiers, et il est dans le pied du menu.
- `rapprocher` lit `fichiers_hash` au serveur (l. 631), mais ne s'en sert pas.
- Certitude : certain (lu).

### 1.3 Réimpression, duplicata, XML
- `reimprimer` (l. 546) cherche, dans l'ordre :
  1. la copie de l'appareil ;
  2. sinon le HTML du serveur ;
  3. sinon le **duplicata reconstitué** (`duplicata` l. 560) : refait à partir des données actuelles, avec la mention « peut différer du document envoyé à l'origine ».
- `nxEmisAssurerFichiers` (l. 110) prend le XML de l'appareil, sinon celui du serveur. Sans l'un ni l'autre, elle répond « non » : plus de XML pour la plateforme.
- Certitude : certain (lu, puis exécuté : R1).

### 1.4 Côté serveur (`supabase/migrations`, lu ; rien n'est exécuté contre le réel)
- **`climpilot_documents`** (`20261002120000_documents_emis.sql` l. 33-55).
  - Colonnes `html` et `xml` : moins de 600 000 caractères chacune (l. 46-47).
  - Colonnes `fichiers_hash` et `fichiers_le`.
  - Numéro unique par série et par année (l. 57).
  - Lecture de ses propres lignes seulement ; aucune écriture directe.
- **`cp_docs_guard`** (l. 90-113) : un document émis ne se modifie ni ne se supprime. Ses fichiers s'écrivent **une seule fois** (l. 104-108).
- **`cp_emettre_document`**, version C1 (`20261021180000_une_facture_par_source.sql` l. 34-131).
  - Contrôles : version de l'appli ; demande rejouée = même facture ; date du jour à ±1 jour ; contenu de 300 000 octets au plus (l. 59).
  - Verrou du compteur.
  - Règle « **une seule facture vivante par source** » : verrou par utilisateur (l. 80) ; refus `deja_facture`, `acompte_ignore` ou `solde_deja_emis`. Un refus ne consomme aucun numéro.
  - Insertion **sans** `html` ni `xml`.
- **`cp_document_fichiers`** (`20261002120000` l. 215-230).
  - Exige un HTML d'au moins 50 caractères.
  - Empreinte = sha256 de HTML + `\n--xml--\n` + XML.
  - Même contenu rejoué : accepté (`deja`). Contenu différent : refusé (42501).
- **Droits** : exécution réservée à `authenticated` (l. 267-272 ; C1 l. 135-136).
- **Test SQL existant** : `tests/sql/test_migration.py` l. 122 (`test_plantage_entre_numero_et_fichiers_puis_reprise`). Le serveur accepte déjà un dépôt tardif. Le « numéro sans fichiers » est donc un état **prévu et toléré** depuis la 1.10.
- Certitude : certain (lu).

### 1.5 Le mode démonstration et sa détection (`next-emission.js`)
- **`mode()`** (l. 94) rend `demo` dès que l'une de ces trois conditions manque :
  - un SIRET (`siretOk`, l. 59) ;
  - une connexion (`cloud`, l. 58 : client Supabase **et** session ouverte) ;
  - une facturation réelle démarrée (`reelDemarre`, l. 88).
- La décision de démarrer est `cp2_facturation`. Elle est synchronisée (l. 41) et comprise dans la sauvegarde.
- **En démonstration et sans connexion**, `emettre` va directement à `finir` avec un numéro `TEST-F-AAAA-NNN` (`numTest` l. 144, compteur local `cp2_testseq`), sans aucune question (l. 298). Le document porte « DOCUMENT DE TEST » (`filigrane` l. 176).
- Un numéro `TEST-` émis **après** le démarrage est classé « essai », hors chiffre d'affaires (`numEssai` l. 91).
- La raison « connecte le cloud » existe déjà (`RAISON.cloud`, l. 84). Mais `mode()` ne rend jamais `bloque` pour une connexion manquante.
- `nextFacNum` (l. 816) et `nxCreateAvoir` (l. 794) suivent `mode()`.
- Certitude : certain (lu, puis exécuté : R3 à R7).

### 1.6 Sauvegarde et restauration (`index.html`)
- **Sauvegarde** : `nxBackupKeys` (l. 2762) prend toutes les clés `cp2_*` et `cpnext_*`, sauf celles de `NX_BK_SKIP` (l. 2761). La sauvegarde JSON contient donc :
  - la décision `cp2_facturation` ;
  - le registre `cp2_docs` ;
  - **les PDF et XML figés de l'appareil** (`cpnext_docs_fichiers`) ;
  - `cp2_testseq` ;
  - les demandes en attente (`cpnext_emission_attente`) ;
  - la base de synchro (`cp2_sync`, `cp2_sync_base`).
- **Restauration** : `importJSON` (l. 2778-2808), dans l'ordre :
  1. confirmation ;
  2. copie de l'état actuel (`cpnext_avant_import`) ;
  3. garde de P3, `cpGardeImport` (l. 4228) : les états terminaux et les encaissements de l'appareil sont gardés ;
  4. écriture de toutes les clés ;
  5. `markDirty` ;
  6. rechargement.
- **Rien ne regarde la connexion ni le mode d'émission.**
- Certitude : certain (lu, puis exécuté : R3).

### 1.7 Synchro et étiquette du cloud (`index.html`)
- **Enregistrer** : `save` (l. 1006-1011) appelle `markDirty` (l. 4006-4007) pour une clé synchronisée.
  - `_cpEcritures` (l. 4005) gagne 1. C'est un compteur **en mémoire** : il repart à zéro à chaque ouverture de l'appli.
  - `cp2_dirty` vaut `'1'` (un drapeau, pas un nombre).
  - Sans session, tout s'arrête là. Avec une session, l'envoi part 4 s plus tard et l'étiquette dit « ☁ à synchroniser… ».
- **Envoyer** : `pushState` (l. 4297-4331).
  - Hors ligne : « ⌛ hors ligne — synchro à la reconnexion » (l. 4300).
  - Envoi accepté : `cp2_dirty` est retiré, sauf si quelque chose a été écrit pendant l'envoi. Étiquette « ✓ synchronisé HH:MM » (l. 4312).
  - Échec : « ⚠ échec synchro — nouvel essai auto », nouvel essai 30 s plus tard (l. 4328-4329).
- **Reprises** : au retour du réseau (l. 4372) et au passage en arrière-plan (l. 4374).
- **Où s'affiche l'étiquette** : `cloudLbl` (l. 4004) écrit seulement dans `#cloudLbl`, au pied du menu latéral (l. 181-184).
  - **Sur téléphone (860 px de large ou moins)**, le menu est un tiroir rangé hors de l'écran (`next-theme.css` l. 155-157). L'étiquette ne se voit qu'en ouvrant le menu.
- **Indices partiels qui existent** : la tâche « Données non synchronisées » dans la liste des choses à faire (`next-addons.js` l. 245) et une pastille dans le résumé de sécurité (l. 352). Aucun n'est sur chaque écran. Aucun ne donne de nombre.
- **Pointage** (`next-terrain.js` l. 16-17, 63-68) :
  - le pointage en cours reste sur l'appareil (`cpnext_pointage`) ;
  - un pointage terminé va dans `cpnext_pointages` (synchronisée) et ajoute ses heures au réel du chantier.
- Certitude : certain (lu, puis exécuté : R5, R6).

## 2. Les défauts, cas par cas

### 2.1 C-N2 : le PDF et le XML d'une facture émise peuvent être perdus
- **R1 — coupure entre les deux appels, puis appareil perdu** (certain, exécuté).
  - Le réseau tombe au 2e appel. supabase-js rend alors `{error, status:0}` sans rejeter.
  - Le serveur a **F-2026-001** sans HTML ni XML (`fichiers_hash` vide).
  - L'appareil garde les fichiers, marqués `aDeposer`. Le badge dit seulement « ● Facturation réelle (numéros du serveur) ».
  - L'appareil est perdu (copie locale effacée) :
    - `nxEmisAssurerFichiers` répond « non » : **le XML est perdu** ;
    - la réimpression sort un **« Duplicata reconstitué »**.
- **R2 — appli fermée ou mise en arrière-plan pendant le 2e appel** (certain, exécuté). **C'est le cas le plus grave.**
  - Le 2e appel ne revient jamais. La copie locale n'a que `html`, `xml`, `at`, `mode` : **pas de marque `aDeposer`**. La marque n'est posée que dans la réponse d'échec (l. 510, 512).
  - Le rapprochement et le retour du réseau ne déposent **rien** (0 appel avant, 0 appel après).
  - `nxEmisDeposer` répond « fait » sans appeler le serveur.
  - Le serveur reste sans fichiers **pour toujours**, même si l'appareil survit.
  - Cas réel probable : le téléphone verrouillé juste après la facture. iOS suspend une PWA en arrière-plan (probable, non vérifié sur un iPhone réel).
- **Taille des fichiers** (certain, mesurée sur les 11 factures du jeu d'essai, une par nature de chantier).
  - Contenu envoyé au 1er appel : ≈ 2,2 Ko. HTML : ≈ 3,8 Ko. XML : ≈ 4,9 Ko.
  - Une facture de vrai chantier, avec plus de lignes : probablement moins de 50 Ko (probable).
  - Limites du serveur : 300 000 octets pour le contenu, 600 000 caractères pour le HTML et pour le XML.
- **En production** : facturation réelle pas démarrée, donc aucune facture réelle concernée aujourd'hui (probable, d'après `docs/REPRISE.md` du 08/10 ; non vérifié sur le réel).

### 2.2 C-N3 : un appareil pas connecté sort une facture TEST
- **R3 — restauration sans connexion** (certain, exécuté).
  - Appareil A, en facturation réelle : il émet F-2026-001, puis fait sa sauvegarde JSON (97 Ko).
  - Appareil B, jamais connecté : il restaure cette sauvegarde.
  - Après le rechargement, B a la décision (démarrée le 20/10), la facture réelle F-2026-001 au registre et le SIRET. Pourtant `nxEmisMode()` = `demo`.
  - « Facturer » sur un autre chantier accepté sort **TEST-F-2026-001**, avec le bandeau « DOCUMENT DE TEST ». La seule question posée a été celle de l'import.
  - Le chantier est **marqué facturé**, et le numéro est classé « essai ».
- **R4 — sans restauration** (certain, exécuté). Un appareil en facturation réelle, déconnecté (session perdue, ou « Déconnexion ») : la facture suivante sort en TEST-F.
- **R7 — et après ?** (certain, exécuté). L'appareil se reconnecte. « Facturer » sur ce chantier répond « Déjà facturé (TEST-F-2026-001) » : **aucune vraie facture ne peut être émise**, et le chantier reste bloqué par un document de test.
- **Sauvegarde d'avant le démarrage**, restaurée sur un appareil neuf pas connecté (certain, lu) : elle ne contient pas la décision. Rien sur l'appareil ne permet alors de savoir que la facturation réelle a démarré (question 4).
- **Hors périmètre, à vérifier par l'exécutant** (hypothèse) : `next-avoir.js` ne traite pas les numéros `TEST-` à part. Un avoir sur une TEST-F, fait en mode réel, partirait au serveur avec un vrai numéro AV.

### 2.3 T17 : rien ne se voit quand des données ne sont pas envoyées
- **R5 — banc deux appareils, téléphone iPhone 13 (390 px), hors ligne** (certain, exécuté).
  - Un pointage est terminé. `cp2_dirty` = `'1'`. Le pointage est sur le téléphone (1) et pas au serveur (0).
  - L'étiquette dit « hors ligne — synchro à la reconnexion », mais **dans le tiroir du menu fermé, hors de l'écran**. On ne la voit qu'en ouvrant le menu. Rien dans la barre du haut, aucun nombre.
  - Si le téléphone est perdu à ce moment, le pointage est perdu. C'est le cas réel rapporté par Gab (non vérifié ici).
- **R6 — envoi en échec** (certain, exécuté). Le réseau est présent mais le serveur ne répond pas.
  - « échec synchro — nouvel essai auto », au même endroit caché.
  - Après la réouverture de l'appli, `_cpEcritures` repart à 2 (écritures du démarrage). Seul reste le drapeau `cp2_dirty` = `'1'` : **le nombre de modifications en attente n'est plus connu**.
- **Ce que compte `_cpEcritures`** (certain, R5 : 13 → 16 pour un seul pointage) : les enregistrements, pas les gestes de l'utilisateur. Un pointage terminé fait 3 écritures.

### 2.4 Journal des essais (09/11/2026, `main` = `6a89e60`, hors réseau)
Scripts écrits dans le bloc-notes de la session (`repro-af1b.mjs`, `repro-af1b-t17.mjs`, `repro-r7.mjs`, `tailles.mjs`), avec leurs journaux JSON. Ils sont **hors dépôt et ne sont pas gardés** : cette mission ne crée qu'un fichier. Chaque essai est décrit ci-dessous assez précisément pour être refait. Ils s'appuient sur `tests/lib.mjs`, `tests/serveur-simule.mjs` et `tests/banc-appareils.mjs`, horloge figée (`REF` ou 15/09/2027). L'exécutant les réécrit en vrais tests (§ 4).

| Essai | Banc | Résultat lu | Verdict |
|---|---|---|---|
| R1 | page PC, serveur simulé, `cp_document_fichiers` → `{error, status:0}` | `F-2026-001` ; serveur : `html` non, `xml` non, `fichiers_hash` vide ; appareil : `aDeposer` = `doc1` ; badge sans mot sur les fichiers ; après perte : XML récupéré = non, « Duplicata reconstitué » = oui | constaté |
| R2 | idem, `cp_document_fichiers` ne répond jamais | copie locale : `html, xml, at, mode` (pas `aDeposer`) ; dépôts avant / après rapprochement + `online` : 0 / 0 ; `nxEmisDeposer` rend « fait » sans appel ; serveur sans HTML | constaté |
| R3 | page A (réel, connecté) puis page B (jamais connectée), vrai `importJSON` | A : `F-2026-001`, sauvegarde 97 307 octets ; B : mode `demo` (démarrée le 20/10, SIRET 14 chiffres, `F-2026-001` au registre) → `TEST-F-2026-001`, chantier marqué facturé, classé « essai » ; seul dialogue : celui de l'import | constaté |
| R4 | page PC réel, puis session retirée | 1re facture `F-2026-001`, 2e `TEST-F-2026-001` | constaté |
| R5 | banc deux appareils, téléphone, `couper` | `cp2_dirty` = 1 ; pointages 1 sur l'appareil / 0 au serveur ; étiquette hors écran (menu fermé), visible menu ouvert ; barre du haut muette | constaté |
| R6 | banc, serveur muet pour le téléphone (réseau présent) | « échec synchro — nouvel essai auto » hors écran ; après réouverture : `_cpEcritures` = 2, `cp2_dirty` = 1 | constaté |
| R7 | page PC réel : TEST-F sans session, puis session rendue et « Facturer » | « Déjà facturé (TEST-F-2026-001) » ; 0 facture au serveur | constaté |
| Tailles | page PC réel, 11 natures | contenu ≤ 2 239 o, HTML ≤ 3 773 car., XML ≤ 4 883 car. | mesuré |

Aucune erreur JavaScript dans ces essais.

## 3. La règle proposée

### 3.1 C-N2 : deux options, tu choisis

**Option (a) — les fichiers partent dans le même appel que le numéro**

- **Côté serveur.** Une migration nouvelle, rejouable (`create or replace`) : `supabase/migrations/<date>_emission_avec_fichiers.sql`. Elle ajoute la fonction `cp_emettre_document_complet(p_request_id, p_serie, p_type, p_date, p_payload, p_min_numero, p_client_version, p_marqueur, p_html, p_xml)`. L'ancienne fonction reste telle quelle, pour l'ancienne appli et pour le repli. Ce que fait la nouvelle fonction, dans l'ordre :
  1. **Contrôles d'entrée.**
     - `p_marqueur` a la forme du numéro provisoire de l'appli (`^PROVISOIRE-[A-Z0-9]{8}$`) et figure dans le HTML.
     - Le HTML fait au moins 50 caractères.
     - Le HTML et le XML font moins de 600 000 caractères chacun.
     - Sinon : erreur, **rien n'est écrit, aucun numéro n'est consommé**.
  2. **Appel de `cp_emettre_document` telle quelle** (version, date, demande rejouée, règle « une facture par source », numérotation). Les règles ne sont pas recopiées : elles restent à un seul endroit. L'appel interne se fait avec les droits du propriétaire de la fonction, et `auth.uid()` reste celui de l'appelant (probable, prouvé par E1 et E8).
  3. **Facture neuve** : dans la **même transaction**, le HTML et le XML sont écrits, le marqueur y étant remplacé par le numéro. L'empreinte suit la formule de `cp_document_fichiers`. Si cette écriture échoue, la facture et le numéro sont annulés avec elle.
  4. **Demande déjà servie** :
     - fichiers présents : rendus tels quels ;
     - fichiers absents (document créé par l'ancien chemin) et **même contenu** (même `payload_hash`) : ils sont complétés ;
     - contenu différent (document modifié depuis) : rien n'est écrit, l'appli suit le chemin d'aujourd'hui (`reprendreServeur`, l. 480).
  5. **Refus C1** (`ok:false`) : rendu tel quel, rien n'est écrit.
  6. **Droits** : `revoke … from public, anon, authenticated` ; `grant execute … to authenticated`.
- **Côté appli (`next-emission.js`).**
  - `finir` et `nxAvoirEmit` fabriquent le PDF et le XML **avant** l'appel, à partir de la copie qui porte le numéro provisoire.
  - Après la réponse, l'appli remplace le marqueur par le numéro, comme le serveur. Elle compare son empreinte à `fichiers_hash` (`sha256` existe, l. 57). Si elles diffèrent : journal, et la facture est marquée « à vérifier » (ne doit jamais arriver).
  - Le marqueur des avoirs, aujourd'hui fixe (`PROVISOIRE-AV`), devient tiré au hasard lui aussi.
- **Transition.** Si le serveur répond « fonction absente » (`absente()`, l. 66, code PGRST202), l'appli reprend le chemin d'aujourd'hui en deux appels, corrigé par les points 1 et 2 de l'option (b). L'appli peut donc être publiée avant ou après la migration. Un PGRST202 veut dire que rien n'a été fait au serveur : rejouer la même demande par l'ancienne fonction ne crée pas de doublon.
- **Ce qui ne change pas** :
  - la numérotation, la règle C1, `request_id` ;
  - le délai de 25 s et le « Résultat INCONNU » ;
  - le blocage hors ligne en mode réel ;
  - le mode démonstration ;
  - tous les montants, toutes les mentions.

**Option (b) — reprise garantie et alerte visible, sans migration**
1. **Marque posée avant l'appel.** `finir` et l'avoir rangent la copie locale **avec** `aDeposer` **avant** le 2e appel (ferme le trou de R2). La marque n'est retirée qu'après un dépôt réussi (`depose`).
2. **Reprise.** Elle a lieu à plusieurs moments :
   - au démarrage, dès que l'appareil est connecté (pas seulement si la facturation réelle a démarré) ;
   - au retour du réseau ;
   - après chaque envoi réussi de l'état ;
   - toutes les 2 min tant qu'un fichier attend.

   `nxEmisDeposer` vérifie `depose`, et pas seulement l'absence de `aDeposer`.
3. **Alerte sur chaque écran**, dans la pastille de T17 (ligne rouge) : « 🧾 F-… : PDF pas encore sauvegardé sur le serveur — garde cet appareil et reconnecte-le ». Elle disparaît après le dépôt.
4. **Sur les autres appareils**, le registre du serveur sait qu'un document n'a pas de fichiers (`fichiers_hash` vide, déjà lu par `rapprocher`). Le registre des documents montre « PDF pas encore sur le serveur (émise sur un autre appareil) ».
5. **Envoi à la plateforme** refusé tant que le dépôt n'est pas fait. C'est déjà le cas via `nxEmisDeposer`, une fois le point 1 en place.

**Comparaison**

| | (a) même appel | (b) reprise + alerte |
|---|---|---|
| Garantie | le serveur n'a **jamais** un numéro sans ses fichiers (une transaction, comme « un numéro n'existe jamais sans sa facture » de la 1.10) — certain par construction, à prouver par les tests SQL | la fenêtre se réduit et se voit, mais ne se ferme pas : un téléphone perdu, cassé ou vidé avant le réseau suivant perd le PDF figé et le XML (duplicata reconstitué) — certain |
| Taille de l'appel | + ≈ 9 Ko sur l'appel d'émission (mesuré, § 2.1) ; loin des limites (300 000 / 600 000) ; le 2e appel d'aujourd'hui envoie déjà ces fichiers d'un bloc et passe (essais TEST du 06-08/10) | inchangée |
| Délai | négligeable en 4G (probable) ; sur un réseau très faible, un « Résultat INCONNU » un peu plus fréquent, rejoué sans doublon | inchangé |
| Hors ligne | inchangé : en mode réel, pas de facture sans serveur | inchangé |
| Double facture | aucun risque nouveau : même `request_id`, règle C1 appelée telle quelle | aucun : le dépôt est idempotent (même empreinte) |
| iPhone en arrière-plan | l'appel unique est fait en entier ou pas du tout ; ensuite, rejeu de la même demande | c'est le cas R2 : corrigé par le point 1, mais les fichiers attendent le retour de l'appli au premier plan avec du réseau |
| Migration | oui : 1 fonction, scripts TEST et RÉEL, retour arrière = la retirer | non |
| Coût (C-N2 seul, § 5.4) | ≈ 3 à 4 jours (avec les points 1 à 3 de (b)) | ≈ 1 à 1,5 jour |

**Recommandation : (a), en gardant les points 1 à 3 de (b).** Pourquoi ces trois points restent utiles :
- la transition (serveur pas encore migré) ;
- les documents émis avant la migration ;
- un serveur remis à l'ancienne fonction par le retour arrière.

**Pourquoi (a) est la plus sûre** : le serveur refuse de créer un numéro sans ses fichiers. Avec (b), la sûreté dépend de la survie de l'appareil. La taille et le délai, mesurés, ne sont pas un frein. (a) n'ajoute aucun risque de double facture.

### 3.2 C-N3 : pas de facture TEST quand la facturation réelle a démarré
- **Signal.** « La facturation réelle a démarré sur ce compte » est vrai dans l'un de ces deux cas :
  - la décision `cp2_facturation` a une date de début atteinte (`reelDemarre`) ;
  - le registre `cp2_docs` contient un document `mode:'reel'`.

  Ces deux données arrivent avec la synchro **et** avec la sauvegarde (certain, § 1.6).
- **Règle.** Si le signal est vrai et que l'appareil n'est pas connecté (`cloud()` faux), `mode()` rend `bloque`, avec une raison nouvelle (« pas connecté »). Message, sur le modèle de `bloque` (l. 442) :

  > « Facture NON émise : cet appareil n'est pas connecté au cloud. La facturation réelle a démarré sur ce compte : une facture ne peut pas sortir d'un appareil déconnecté. Connecte-toi au cloud, puis refais « Facturer ». Rien n'a été facturé. »

  Le chantier reste « à facturer ».
- **Même règle partout** : avoirs (`nxAvoirEmit`, `nxCreateAvoir`), et défense de `nextFacNum` (qui lève une erreur au lieu de donner un numéro TEST).
- **Badge** : « ● Facturation bloquée : pas connecté », au lieu de « Mode démonstration ».
- **SIRET manquant** alors que le signal est vrai : bloqué aussi (« SIRET manquant »), si tu dis oui à la question 3.
- **Ce qui ne change pas** :
  - sans décision, ou avec une date de début à venir : mode démonstration comme aujourd'hui (ta situation actuelle, la copie d'essai avant son passage en réel) ;
  - appareil connecté : règles d'aujourd'hui.
- **Où** : `mode()` l. 94, `RAISON` l. 84, `badge` l. 843. On modifie la fonction d'origine : aucune enveloppe ajoutée (règle 11, suite W inchangée).
- **Vieille sauvegarde d'avant le démarrage, sur un appareil neuf** : rien ne permet de la détecter (§ 2.2). Si tu dis oui à la question 4, l'appli demande une confirmation avant **tout** document TEST émis par un appareil pas connecté qui a un SIRET.
- **Restauration** : `importJSON` ne change pas. Le blocage se fait au moment d'émettre, pas au moment de restaurer : la restauration reste possible hors ligne, ce qui est voulu.

### 3.3 T17 : une pastille « pas encore envoyé » sur chaque écran
- **Où.** Dans la barre du haut (`.topbar`), visible sur téléphone **sans ouvrir le menu**. Elle est sur chaque écran, et pas dans le tiroir.
- **Quand.** Dès que quelque chose n'est pas au serveur :
  1. des modifications (`cp2_dirty`), **et** l'une de ces conditions : hors ligne, dernier envoi en échec, pas connecté, ou attente de plus de 30 s (pas pendant les 4 s normales d'un envoi : question 6) ;
  2. une facture en attente d'émission (`cpnext_emission_attente`, aujourd'hui visible seulement dans le tiroir) ;
  3. un paiement pas encore inscrit au journal du serveur (`cpnext_events_attente`) ;
  4. le PDF d'une facture pas encore déposé (C-N2).
- **Textes.**

  | Cas | Texte |
  |---|---|
  | hors ligne | « 📴 Hors ligne — 2 modifications pas encore envoyées (seulement sur ce téléphone) » |
  | envoi en échec | « ⚠ Envoi en échec — 2 modifications pas encore envoyées · Réessayer » |
  | pas connecté | « 🔌 Pas connecté — 2 modifications seulement sur cet appareil » |
  | facture (ligne rouge) | « 🧾 F-2027-012 : PDF pas encore sauvegardé sur le serveur » |
- **Le nombre** : les éléments (un devis, un client, un pointage… repérés par leur identifiant) qui diffèrent entre l'appareil et la dernière version synchronisée (`cp2_sync_base`), plus 1 par autre clé modifiée.
  - C'est une fonction pure, `cpNbAttente(base, local)`, placée dans `index.html` près de `cpMerge`, et testée dans Node comme la suite U.
  - Elle survit à la réouverture de l'appli : la base et l'état sont tous les deux sur l'appareil. C'est la différence avec `_cpEcritures`, qui reste en mémoire et sert encore à repérer « écrit pendant l'envoi ».
  - Un pointage terminé compte 2 (le pointage et les heures réelles du chantier). Le détail s'affiche au toucher (question 5).
  - Jamais synchronisé : « jamais envoyé ».
  - Après une restauration, le nombre est approximatif jusqu'à la première synchro, car la base vient de la sauvegarde (probable).
- **Calcul.** Au démarrage, après chaque enregistrement (au plus une fois toutes les 2 s) et à chaque changement de l'étiquette du cloud. Coût à mesurer par l'exécutant : borne proposée, moins de 50 ms pour 2 000 objets.
- **Au toucher** : `pushState(true)`, comme « ⟳ Synchroniser » du menu, avec ses messages d'aujourd'hui.
- **Disparition** : à « ✓ synchronisé » (envoi accepté, rien d'écrit pendant l'envoi), si les files 2 à 4 sont vides.
- **Où dans le code** : `index.html`, en modifiant `cloudLbl`, `markDirty` et `pushState` eux-mêmes (aucune enveloppe : suite W inchangée).
  - Aucune clé synchronisée nouvelle.
  - L'état « dernier envoi en échec » reste en mémoire : au démarrage, l'appli refait un essai et le retrouve.
  - Rien côté serveur.
- **Ce que T17 ne fait pas** : il n'envoie rien de plus ni plus vite, et ne sauve pas les données d'un téléphone perdu. Il **le dit pendant qu'il est encore temps** (retrouver du réseau, ne pas quitter le chantier, ne pas vider le téléphone).

### 3.4 Ce qu'AF1-B ne fait pas
- Pas de sauvegarde automatique hors Supabase : c'est P11. Un export JSON fait après une facture garde déjà son PDF et son XML (§ 1.6), et l'export hebdomadaire de P11-A réduira la fenêtre de C-N2 (b).
- Pas de facture réelle hors ligne.
- Pas de réparation des TEST-F déjà émises : il n'y en a pas en production (probable, § 2.1).
- Pas d'écran du journal.
- Aucun montant, aucune règle fiscale, aucune mention légale, aucun arrondi ne change. Golden Y et Z identiques. Les 5 « À TRANCHER » ne bougent pas.

## 4. Tests à écrire d'abord (rouges sur `main`)

Horloge : `REF` (`tests/lib.mjs`) dans les pages, `serveurCommun(debutISO)` et une horloge figée sur le banc. Aucun test ne lit la vraie date. Vérifier aussi avec `faketime` un samedi, un dimanche et le 05/01 de l'année suivante (règle 9). Le journal des rouges est gardé (`git stash push <fichiers de code>`, lancer, `git stash pop`).

### 4.1 SQL, option (a) : `tests/sql/test_emission_avec_fichiers.py`
PostgreSQL 16 local, marqueur `climpilot-test`. Modèle : `test_une_facture_par_source.py`. Base neuve à chaque test : émulation Supabase, base actuelle, migration 1.10, C1, puis la nouvelle migration, jouée deux fois.

| Test | Attendu | Sur `main` |
|---|---|---|
| E1 émission complète | 1 document ; HTML et XML contiennent le numéro et plus le marqueur ; `fichiers_hash` = la formule de `cp_document_fichiers` ; compteur + 1 | rouge (fonction absente) |
| E2 même `request_id` rejoué | `deja`, même numéro, mêmes fichiers, compteur inchangé | rouge |
| E3 refus C1 (2e solde du même devis) | `ok:false`, `deja_facture` ; rien écrit ; compteur inchangé | rouge |
| E4 marqueur absent du HTML, ou mal formé | erreur ; aucun document ; compteur inchangé (pas de trou dans la série) | rouge |
| E5 HTML de plus de 600 000 caractères | erreur ; aucun numéro consommé | rouge |
| E6 document créé par l'ancien chemin (même `request_id`, sans fichiers) | même contenu : fichiers complétés ; contenu différent : rien écrit | rouge |
| E7 deux émissions simultanées pour la même source | une seule facture (verrou C1) | rouge |
| E8 droits | `public` et `anon` refusés, `authenticated` autorisé | rouge |
| E9 témoin : `cp_emettre_document` et `cp_document_fichiers` inchangées | comportement identique | vert |
| E10 migration rejouable ; retour arrière (retrait de la fonction) | l'ancienne fonction reste intacte | rouge |

**Scripts pour Gab**, sur le modèle de `4-une-facture-par-source-TEST.sql` et `5-REEL-migration-C1.sql`. Prendre le numéro libre au moment de coder (7 au 09/11 ; S peut le prendre avant) :
- `tests/supabase-test/7-emission-avec-fichiers-TEST.sql` :
  - verrou sur `public.climpilot_marqueur_test` ;
  - copie conforme de la migration ;
  - N lignes « OK » qui lisent la définition et les droits ;
  - aucune donnée écrite.
- `tests/supabase-test/7-emission-avec-fichiers-retour-arriere.sql` : `drop function if exists public.cp_emettre_document_complet(...)`.
- `tests/supabase-test/7-REEL-emission-avec-fichiers.sql` : s'arrête si le marqueur est présent ; même contenu et mêmes vérifications.

### 4.2 Suite navigateur : `tests/suiteAH-af1b-factures.mjs`
- **Nom de la suite** : AB = S, AE = P3, AF est évitée (confusion avec les missions), AG = P11. Si COMPTE a pris AH entre-temps, prendre la lettre libre suivante.
- **Inscription** dans `tests/run-all.sh` (`SUITES_DEFAUT`) et `tests/isolation/rapport.mjs`.
- **Appareils** : iPhone 13 et PC.
- **Serveur simulé** : `tests/serveur-simule.mjs` gagne la nouvelle fonction et une option « fonction absente ».

| Test | Départ | Attendu | Sur `main` |
|---|---|---|---|
| N1 (a) émission réelle | serveur simulé | un seul appel (`cp_emettre_document_complet`) ; serveur : HTML et XML avec le numéro ; copie locale = serveur (empreinte) | rouge |
| N2 (a) coupure pendant l'appel unique (`perdreReponseBib`) | | « Résultat INCONNU » ; nouveau clic → même numéro, fichiers présents, un seul document | rouge |
| N3 (a) serveur sans la nouvelle fonction | PGRST202 | chemin en deux appels ; `aDeposer` posé **avant** le 2e appel | rouge |
| N4 (a) avoir | | même chose qu'en N1, marqueur tiré au hasard | rouge |
| N5 = R2 | 2e appel sans réponse, puis « redémarrage » (rapprochement, `online`) | `aDeposer` présent ; fichiers redéposés ; serveur avec HTML | rouge |
| N6 = R1 | 2e appel en erreur réseau | ligne rouge **à l'écran** (rectangle visible, pas dans le tiroir) avec le numéro ; disparaît après le dépôt | rouge |
| N7 | registre d'un autre appareil (serveur : `fichiers_hash` vide) | « PDF pas encore sur le serveur » | rouge |
| N8 = R3 | restauration sans connexion (vrai `importJSON`) | « NON émise … pas connecté » ; aucun numéro TEST ; chantier pas marqué ; badge « bloquée » | rouge |
| N9 = R4 | session retirée | idem | rouge |
| N10 | avoir, `nxCreateAvoir`, `nextFacNum` sans connexion, facturation démarrée | refus ; `nextFacNum` lève une erreur | rouge |
| N11 témoins | pas de décision ; décision à date future ; reconnecté | TEST-F comme aujourd'hui (suite I1 inchangée) ; démonstration ; vraie facture F | vert |
| N12 (question 3) | SIRET vidé, facturation démarrée | bloqué « SIRET manquant » | rouge |
| N13 (question 4) | pas connecté, SIRET, pas de décision | confirmation avant le document TEST ; « Annuler » → rien émis | rouge |
| N14 = R5 | téléphone hors ligne, pointage terminé | pastille **à l'écran**, menu fermé, nombre 2 | rouge |
| N15 = R6 | envoi en échec (`horsService`) | « Envoi en échec », nombre, « Réessayer » relance l'envoi | rouge |
| N16 | réouverture hors ligne | pastille toujours là, même nombre | rouge |
| N17 | pas connecté | « Pas connecté » + nombre | rouge |
| N18 | envoi réussi | la pastille disparaît (« ✓ synchronisé ») | rouge |
| N19 témoins | | aucune clé synchronisée nouvelle ; aucune enveloppe nouvelle ; aucune erreur JavaScript | vert |

### 4.3 Banc deux appareils (`tests/banc-appareils.mjs`)
- **À ajouter au banc** : la nouvelle fonction dans `serveurCommun`, et une coupure « juste après la réponse d'un appel nommé ». Le banc n'a aujourd'hui que `couper` et `retablir`.

| Scénario | Ce qu'on fait | Attendu | Sur `main` |
|---|---|---|---|
| B1 (a) | le téléphone émet ; réseau coupé juste après la réponse ; téléphone abandonné | le PC voit la facture **avec** ses fichiers ; réimpression sur le PC = version figée, pas de duplicata | rouge (duplicata) |
| B2 (b) ou transition | idem, sur un serveur sans la nouvelle fonction | le PC montre « PDF pas encore sur le serveur » ; le téléphone, au retour du réseau, dépose ; la ligne disparaît des deux côtés | rouge |
| B3 T17 = R5 | téléphone coupé, pointage terminé, puis `retablir` | pastille « 2 » ; puis serveur avec le pointage, pastille partie, PC le reçoit | rouge |
| B4 C-N3 | téléphone restauré, pas connecté, « Facturer » ; puis connexion | refus ; puis vraie facture F, vue par le PC | rouge |

### 4.4 Node : `cpNbAttente`
Des cas dans la suite U, ou un petit test Node à part :
- rien de modifié : 0 ;
- un pointage ajouté : 1 ;
- deux clients modifiés : 2 ;
- un devis supprimé : 1 ;
- une clé objet modifiée : 1 ;
- pas de base : « jamais envoyé ».

L'empreinte figée de la suite U ne porte que sur le texte de `cpMergeArr` et `cpMerge` (`tests/suiteU-fusion.mjs` l. 218-221) : une fonction à part ne la change pas (probable, à vérifier).

### 4.5 Option (a) : les faux serveurs et les compteurs d'appels des suites existantes
Lu dans `tests/` le 09/11 (certain). Avec (a), l'appli appelle `cp_emettre_document_complet`. Deux conséquences pour les suites existantes :
- **Faux serveurs.** Cinq faux serveurs doivent connaître la nouvelle fonction :
  - `tests/serveur-simule.mjs` (suites I, N, R) ;
  - `tests/banc-appareils.mjs` (suites AA, AE, Q) ;
  - le faux serveur de la suite H (l. 12-18) ;
  - celui de la suite J (l. 236-238) ;
  - celui de la suite L (l. 20-22).

  Sinon, ils répondent « rpc inconnue » (ou rien). Ce message n'est pas reconnu comme « fonction absente » (`absente()`, l. 66) : l'appli ne se replierait pas et afficherait « Facture NON émise ».
- **Compteurs d'appels par nom exact.** Plusieurs suites comptent les appels `cp_emettre_document` par leur nom exact :
  - AA l. 21 ;
  - J l. 245 ;
  - L l. 144 ;
  - N l. 57 et 78 ;
  - R l. 212-214 et 233-235.

  Ces compteurs doivent compter les deux noms (`/^cp_emettre_document/`). Sinon, un contrôle « aucune émission » passerait **à tort**, même si l'appli émettait par la nouvelle fonction.
- **Ce qui ne change pas** : les attendus. Seule la préparation des tests change (règle 3). Le compte rendu donnera la liste exacte.

### 4.6 Suites qui ne doivent pas bouger (la batterie le vérifie)
- **I, N, R** (émission). I1 n'a pas de décision de démarrage : il reste vert. Avec (a), seuls les compteurs du § 4.5 sont adaptés.
- **AA** (registre illisible, démonstration à deux appareils), **AD**, **AE**, **Q**, **V**, **X**.
- **U** : son golden ne change pas.
- **W** : aucune enveloppe ajoutée.
- **Y et Z** : aucun montant, aucun document.
- **H** : à adapter si tu dis oui à la question 3. Son test « Document de démonstration (TEST) bloqué en compte réel » (`tests/suiteH-superpdp.mjs` l. 161) fabrique sa facture TEST en **vidant le SIRET** alors que la facturation est démarrée. Avec la question 3, ce chemin serait bloqué : la préparation du test change (fabriquer le document TEST avant le démarrage), pas ce qu'il vérifie.

## 5. Risques, retour arrière, déploiement, estimation

### 5.1 Risques et garde-fous

| Risque | Où | Garde-fou | Certitude |
|---|---|---|---|
| Double facture | (a) | la règle C1 est appelée telle quelle ; même `request_id` ; tests E2, E3, E7, N2 | probable, à prouver |
| Numéro perdu (trou dans la série) | (a) | fichiers refusés = toute la transaction annulée, aucun numéro consommé (E4, E5) ; PostgreSQL annule aussi la mise à jour du compteur | probable, à prouver |
| Fichier stocké qui ne correspond pas à la facture | (a), demande rejouée après une modification | complété seulement si le contenu est le même (E6) ; sinon chemin `reprendreServeur` d'aujourd'hui | probable |
| Marqueur mal remplacé (numéro ailleurs, sous une autre forme) | (a) | aucun QR code ni numéro encodé dans le PDF ou le XML (recherche dans `next-*.js`, certain) ; test « fichiers de (a) identiques octet par octet à ceux d'aujourd'hui pour la même facture » | probable |
| Taille de l'appel | (a) | ≈ 11 Ko mesurés (§ 2.1) ; contrôles du serveur conservés | certain pour le jeu d'essai |
| Un test « aucune émission » qui passe à tort | (a) | les compteurs par nom exact comptent les deux fonctions (§ 4.5) ; la relecture P10 vérifie la liste | certain (lu) |
| Réseau très faible | (a) | un peu plus de « Résultat INCONNU », rejoués sans doublon | probable |
| iPhone en arrière-plan | (a), (b) | (a) : tout ou rien ; (b) : marque posée avant l'appel, reprise au retour | probable (pas d'iPhone réel ici) |
| Appareil bloqué alors qu'il était en démonstration | C-N3 | seulement si la facturation réelle a démarré sur ce compte ; remède : se connecter, ou « Annuler la décision » s'il n'existe aucune facture réelle (`annulable` et `annuler`, l. 731-753) | certain (lu) |
| Horloge de l'appareil fausse | C-N3 | `reelDemarre` compare la date de l'appareil ; le signal « document réel au registre » ne dépend pas de l'horloge | probable |
| Pastille qui s'allume pour rien, ou qui gêne la barre du haut sur un petit téléphone | T17 | délai de 30 s ; essai à l'écran sur iPhone 13 et PC ; ton essai sur ton téléphone | hypothèse |
| Calcul du nombre trop lent | T17 | au plus une fois toutes les 2 s ; borne mesurée par un test | hypothèse |

### 5.2 Retour arrière
- **Appli** : revert du commit « code ». L'appli revient aux deux appels (la nouvelle fonction n'est plus appelée, sans effet), aux TEST-F hors connexion, et à l'étiquette dans le tiroir. Les tests d'AF1-B redeviennent rouges.
- **Serveur (a)** : script de retour arrière (retrait de la fonction). L'appli à jour retombe d'elle-même sur les deux appels (repli PGRST202).
- Les factures déjà émises avec leurs fichiers restent des lignes normales : rien à défaire.
- **Données** : aucune clé synchronisée nouvelle, aucun champ synchronisé nouveau. Seuls `aDeposer` et `depose` changent de moment, dans une clé de l'appareil. Une ancienne version lit tout sans erreur (probable).

### 5.3 Ordre de déploiement
1. **S**, puis **COMPTE**, fusionnées. Puis P11 si la file garde cet ordre (`docs/FILE-DES-MISSIONS.md` : S → COMPTE → P11 → AF1-B ; ton prompt dit « après S et COMPTE »).
2. **AF1-B sur sa branche** :
   - tests rouges, avec le journal gardé ;
   - code ;
   - suite visée, puis batterie complète, puis CI verte ;
   - relecture par l'autre modèle (`relecture-p10`).
3. **Si (a)** :
   1. tu colles le script **TEST** (ClimPilot-TEST, verrou du marqueur) : N lignes « OK » ;
   2. ton essai sur la copie d'essai reconstruite depuis la branche (§ 5.5) ;
   3. tu colles le script **RÉEL** : N lignes « OK ».
4. **La fusion**, faite par toi.
5. Le même jour, sur chaque appareil : attendre « ✓ synchronisé », puis F5 (cache : le numéro suivant au moment de coder ; `main` est en 1135 ; S et COMPTE passent avant).

L'ordre entre la migration et la fusion n'est pas critique : l'appli se replie si la fonction manque. **Recommandé : migration d'abord**, pour que la protection soit active dès le F5.

### 5.4 Estimation honnête

| Partie | Fichiers | Durée (sessions) |
|---|---|---|
| C-N3 | `next-emission.js` (`mode`, `RAISON`, `badge`, messages) ; tests N8 à N13, B4 ; adaptation de H (question 3) | ½ jour |
| T17 | `index.html` (`cpNbAttente`, pastille, `cloudLbl` / `markDirty` / `pushState` modifiés, CSS) ; tests N14 à N19, B3, Node | 1 à 1,5 jour |
| C-N2 (b) seule | `next-emission.js` (`finir`, avoir, reprise, alerte, registre) ; tests N5 à N7, B2 | 1 à 1,5 jour |
| C-N2 (a) en plus de (b) 1 à 3 | migration, 3 scripts SQL, `test_emission_avec_fichiers.py` ; fichiers fabriqués avant l'appel pour les 4 sortes de factures et l'avoir ; repli ; 5 faux serveurs et les compteurs d'appels de 5 suites adaptés (§ 4.5) ; tests N1 à N4, B1 | + 2 à 2,5 jours |
| Batterie, `faketime`, CI, compte rendu, suites de relecture | | 1 jour |
| **Total** | | **avec (a) : 5 à 6,5 jours ; avec (b) : 3 à 4 jours** |

- **Avec (a), une seule branche dépasserait la semaine.** D'où la question 2 : **AF1-B1** (C-N3, T17, (b) 1 à 5 ; sans migration ; ≈ 3 à 4 jours), puis **AF1-B2** (option (a) ; migration ; ≈ 2,5 jours).
- **Ton temps** : 2 scripts à coller (si (a)), ≈ 20 min d'essai par branche, la fusion et les F5.

### 5.5 L'essai que tu feras (esquisse ; le compte rendu d'AF1-B le détaillera)
Sur la copie d'essai (base TEST), avec un PC et un téléphone, ≈ 20 min.
1. **Téléphone** : coupe le Wi-Fi et les données. Sur une intervention du jour, « ▶ Commencer » puis « ■ Terminer ».
   - Attendu : en haut de l'écran, sans ouvrir le menu, « 📴 Hors ligne — 2 modifications pas encore envoyées ».
2. Rallume le réseau.
   - Attendu : « ✓ synchronisé » dans le menu ; la pastille disparaît ; le PC montre le pointage après sa synchro.
3. **Téléphone** : menu › « Déconnexion ». Puis « Facturer » un chantier accepté.
   - Attendu : « Facture NON émise … pas connecté ». Aucun numéro TEST. Le chantier reste « à facturer ».
4. Reconnecte-toi, puis refais « Facturer ».
   - Attendu : une vraie facture F-… du serveur de test.
5. **Si (a)** : sur le PC, ouvre le registre des documents et réimprime cette facture.
   - Attendu : la version figée, pas de « Duplicata reconstitué ».
   - Dans ClimPilot-TEST (lecture seule) : la ligne de `climpilot_documents` a `fichiers_hash` rempli.
6. **Si (b)** : « Facturer » sur le téléphone, puis coupe le réseau tout de suite (avant la fin).
   - Attendu : ligne rouge « PDF pas encore sauvegardé » sur le téléphone ; elle disparaît quand le réseau revient.

## 6. Tes questions (oui / non)

1. **C-N2 : option (a)** (les fichiers partent avec le numéro ; une migration, deux scripts à coller) **plutôt que (b) seule** (reprise et alerte, sans migration) ?
   - Recommandé : **oui**, en gardant les points 1 à 3 de (b) pour la transition.
   - Si non : (b) seule ; un téléphone perdu avant le réseau suivant perd encore le PDF figé et le XML.
2. **Deux branches** : d'abord AF1-B1 (C-N3, T17, (b) ; sans migration), puis AF1-B2 (option (a)) ?
   - Recommandé : **oui** (chaque branche reste sous la semaine ; T17 et C-N3 arrivent plus tôt).
   - Si non : une seule branche, de 5 à 6,5 jours.
3. **C-N3 : bloquer aussi quand le SIRET manque** alors que la facturation réelle a démarré (au lieu de repasser en démonstration) ?
   - Recommandé : **oui**. Une seule préparation de test change (suite H, § 4.6).
4. **C-N3 : demander une confirmation avant tout document TEST** émis par un appareil pas connecté qui a un SIRET ? C'est le seul moyen de repérer une vieille sauvegarde d'avant le démarrage, restaurée sur un appareil neuf.
   - Recommandé : **oui**. Une question de plus, seulement dans ce cas rare.
5. **T17 : le nombre compte les éléments** (un pointage terminé = 2 : le pointage et les heures du chantier), avec le détail au toucher ?
   - Recommandé : **oui**.
   - Si non : un nombre d'enregistrements gardé sur l'appareil (plus simple, moins parlant).
6. **T17 : pastille cachée pendant les 30 premières secondes** d'un envoi normal (elle ne s'allume que hors ligne, en échec, pas connecté, ou au-delà de 30 s) ?
   - Recommandé : **oui** (sinon elle clignote à chaque enregistrement).
7. **T17 fait bien partie de l'exception au gel (décision 23)** ? `docs/APRES-PRO-V1.md` le range encore dans les idées gelées (tableau « Envies », n° 10).
   - Si oui : AF1-B le retire de cette liste, avec la date.
