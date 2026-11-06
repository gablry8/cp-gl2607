# ClimPilot — Mission P11 : zéro perte de données (export hors Supabase + journal d'erreurs) — dossier de mission

> Rédigé le 06/11/2026 par Claude (session Claude Code, mission P11-DOSSIER) pour Gabriel Leroy. **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-p11`, partie de `main` = `297cc7e`.
> Ce dossier dit ce qui existe déjà, ce qui manque, comment le prouver **avant** de le changer, et ce que tu dois décider. L'exécutant écrit d'abord les tests (rouges sur `main`), puis corrige.
> Numéros de ligne lus sur `main` (`297cc7e`). La mission P3 (branche `correctif/p3-fusion-etats`, en cours) modifie `pushState` et `pullState` : après elle, les numéros bougent. L'exécutant retrouve tout par le nom des fonctions.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project. Le dossier du 24/10 qui définit P11 n'a pas été relu ; ce dossier suit la définition du prompt de la mission. La copie `claude/ClimPilot-P11-dossier.md` reste à faire.
> **Réseau de cette session** : `supabase.com` et `cnil.fr` ne répondent pas (hôtes non autorisés). La documentation Supabase a été lue par l'outil officiel de recherche dans la documentation Supabase (texte de la page). La CNIL n'a pas été relue : les citations viennent de `docs/RGPD-registre.md` (sources lues le 25/10/2026).
> Certitude : **certain** (lu dans le code ou la documentation, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. Réponds aux **8 questions du § 6** (oui / non suffit).
2. Vérifie en 1 minute, sur le projet Supabase **réel** : Database › Backups. Attendu sur le plan gratuit : aucune sauvegarde (§ 1.4).
3. Dès maintenant, sans attendre P11 : un « ⤓ Export complet » par semaine depuis le PC (Réglages › Sécurité & corbeille), fichier rangé **hors** du PC.
4. P11 se lance **après la fusion de P3** : P3 et P11 touchent `pushState` et `pullState`. Une seule mission sur le code à la fois.
5. Après le code de P11-B : colle le script TEST, fais l'essai (§ 5.6), colle le script réel, fusionne, puis F5 sur chaque appareil **le même jour**.
6. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Le besoin et ce qui existe déjà

**Le besoin.** Aujourd'hui, si la base Supabase est abîmée ou le projet perdu, il ne reste que ce que les appareils ont gardé et les fichiers exportés à la main. Et quand l'appli plante ou qu'un appareil ne synchronise plus, personne ne le sait, sauf en regardant la petite étiquette en haut de l'écran au bon moment.

### 1.1 Export complet hors Supabase : il existe depuis le 19/10 (certain, lu)

| Quoi | Où | Ce qui se passe |
|---|---|---|
| Bouton « ⤓ Export complet (fichier) » | carte « ☁️ Sauvegardes », `renderBackups` (`next-assistant.js` l. 706-719), posée en tête de la vue `nx_tools` (l. 799) | Dans le menu : Réglages › **« Sécurité & corbeille »** (`next-addons.js` l. 751). L'appli appelle cette vue « Outils » dans ses messages (`index.html` l. 1016). |
| L'export | `nxaExportComplet` (`next-assistant.js` l. 661-687) | Fichier `ClimPilot_export_complet_AAAA-MM-JJ.json` : état de l'appareil (`nxExportObjet`, `index.html` l. 2764 ; clés `nxBackupKeys` l. 2762 = toutes les clés `cp2_` et `cpnext_` sauf `NX_BK_SKIP` l. 2761) + `climpilot_documents`, `climpilot_doc_events`, `climpilot_signatures`, lues page par page (`lirePages` l. 644). Une table en erreur : fichier donné quand même, marqué `complet:false`, non compté. |
| La date du dernier export | clé `cpnext_dernier_export` (l. 637-638) | `{at, octets, comptes, incomplet?}`. **Synchronisée** : ajoutée à `SYNC_KEYS` (vérifié en exécutant, § 1.5). Le commentaire dit qu'une tâche planifiée la lit dans `climpilot_state` : hors dépôt, non vérifiable ici (hypothèse). |
| Le rappel | `nxaRappelExport` (l. 689-694), bandeau `#bkbanner` (`index.html` l. 203) | Si le cloud est connecté et que le dernier export complet a plus de 7 jours (ou n'existe pas) : une ligne discrète avec un bouton « ⤓ Export complet ». Branché dans l'enveloppe de `checkBackup` (`next-fiabilite.js` l. 52-58), rappelée après la connexion (l. 59-61) et pendant 30 s au démarrage (l. 268). Même ligne sur le PC et le téléphone. |
| Où le ranger | l. 682 | Seulement un message de quelques secondes **après** l'export : « range-le hors de Supabase (ordinateur, clé USB, Drive) ». |
| Relire le fichier | `importJSON` (`index.html` l. 2778) | Accepte l'export complet et n'en relit que la partie `etat` (l. 2781). Restaure toutes les clés `cp2_` et `cpnext_` du fichier sauf `NX_BK_SKIP` (l. 2790). |
| Tests | suite R, R3 (`tests/suiteR-fiabilite.mjs` l. 138-176) | Fichier daté, contenu, pagination (1 205 événements), table en erreur, rappel au-delà de 7 jours, rien en dessous, « jamais ». |

**Écart avec la demande (certain).** Le prompt parle d'une « clé locale `cpnext_dernier_export` ». Elle existe déjà, et elle est **synchronisée** : un export fait sur le téléphone fait taire le rappel du PC. Ce dossier propose de la garder telle quelle (§ 3.1, question 2).

### 1.2 Copies dans Supabase : `climpilot_backups` (certain, lu ; non vérifié sur le réel)

- Déclencheur `cp_state_backup` avant chaque mise à jour de `climpilot_state` (`supabase/schema.sql` l. 34) → `cp_state_backup_trg` (l. 95-125). Même règle dans `tests/sql/01_base_actuelle.sql`.
  - Copie « quotidienne » au plus une toutes les 20 h, prise à la première synchro qui change l'état.
  - Copie « avant grosse modification » : au moins 2 devis, clients, interventions ou locations en moins, une liste vidée, ou un état réduit de plus de 40 %.
  - Durée : quotidiennes 45 jours, plus une par mois gardée 13 mois ; les autres 120 jours.
- Contenu : l'état synchronisé seulement. Ni le registre des factures, ni les signatures. **Même base** que les données.
- L'appli liste les 60 dernières et permet « Restaurer » (`renderBackups`). Son texte (`TXT_COPIES`, l. 702-704) est exact au vu du déclencheur.
- `supabase/schema.sql` est une copie de lecture du 01/10 (non rejouable) : la base réelle fait foi.

### 1.3 Ce que l'export complet ne contient pas (certain, lu)

- Tables absentes du fichier : `climpilot_seq` (compteurs de numérotation), `climpilot_backups`, `climpilot_inbox`, `climpilot_ai_usage`, `climpilot_busy` (agenda), `climpilot_catalogue`, `climpilot_pdp` (son secret est dans Vault : il n'a pas à sortir), et les comptes de connexion.
- **Aucune procédure écrite** ne dit comment remettre le registre des factures et les signatures sur un nouveau projet à partir du fichier. L'appli ne relit que la partie `etat`.
- Probable : les compteurs se reconstituent depuis le registre (plus grand numéro par série et par année). À écrire et à tester (question 8).

### 1.4 Les sauvegardes de Supabase lui-même : le plan gratuit n'en a pas (vérifié le 06/11/2026)

Source : documentation officielle Supabase, page « Database Backups » (`https://supabase.com/docs/guides/platform/backups`), texte lu en entier le 06/11/2026 par l'outil de recherche de la documentation Supabase. La page des tarifs n'a pas été lue (site bloqué par le réseau de la session).

- « We automatically back up all **Pro, Team, and Enterprise** Plan projects on a daily basis. » Le plan gratuit n'est pas dans la liste. **Certain** (texte lu).
- « Pro Plan projects can access the last 7 days of daily backups. »
- « We recommend that free tier plan projects regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups. »
- La restauration à la seconde près (PITR) est une option payante : « Pro, Team and Enterprise Plan projects can enable PITR as an add-on. » Une fois activée, il n'y a plus de sauvegarde quotidienne.
- « When you delete a project, we permanently remove all associated data, including any backups stored in S3. »
- Page « Project Pausing » (même outil, même jour) : « Supabase pauses Free Plan projects that show low activity over a 7-day period. » Le projet se restaure « for up to 90 days after it was paused ». Les projets payants ne sont pas mis en pause.
- Attention : un résumé de recherche web lu le même jour affirmait l'inverse (« Free inclus »). C'est le texte de la page officielle qui fait foi. Le point 2 de « Ce que Gab fait » le confirme en 1 minute.

**Conséquence (probable).** Si la base réelle est abîmée ou le projet supprimé, il reste :
- les données de chaque appareil (stockage du navigateur) ;
- les exports complets téléchargés.

Les copies `climpilot_backups` disparaissent avec la base. Le registre des factures et les signatures n'existent hors Supabase **que** dans les exports complets.

**Lire l'état des sauvegardes Supabase depuis l'appli : non.** L'API de gestion (`/v1/projects/{ref}/database/backups`, doc lue) exige un jeton d'accès personnel du compte Supabase. Ce jeton donne la main sur tout le compte : il ne doit jamais être dans le navigateur. Certain (doc) ; refus = recommandation.

### 1.5 Erreurs et journal aujourd'hui

- **`window.onerror`** (`index.html` l. 986-989) : bandeau rouge 30 s « ⚠ Erreur app : … fais une capture de ce bandeau et envoie-la à Claude ». Rien n'est gardé. Son propre `catch` est vide.
  - **Exécuté ici** (script jetable hors dépôt, Chromium 141 de Playwright, `297cc7e`) : une erreur non interceptée affiche le bandeau avec le message brut. Ce message **contient le texte lu** : « Unexpected token 'D', "Dupont Jean" is not valid JSON ». Aucune clé du stockage ne change. Certain.
  - Même constat sous Node 22 (même moteur) : l'erreur de `JSON.parse` recopie le début du texte reçu. Un message d'erreur peut donc contenir une donnée de client. Certain (exécuté).
- **Promesses rejetées** : aucune écoute `unhandledrejection` (recherche dans `index.html`, les `next-*.js` et `sw.js`). Exécuté : rien ne s'affiche, rien n'est gardé. Certain.
- **`cpJournal`** (`index.html` l. 1762), clé `cpnext_journal` :
  - 200 lignes, sur l'appareil seulement (absente de `SYNC_KEYS` : vérifié en exécutant), sans écran ;
  - comprise dans la sauvegarde de l'appareil et dans l'export complet (pas dans `NX_BK_SKIP`) ;
  - elle ne note que les refus voulus d'AF1 (devis verrouillé, avenant, facture refusée, annulation) : aucune erreur, aucune synchro ;
  - **elle contient des données personnelles** : le nom du signataire (`next-signature.js` l. 182, `nom:s.signer_nom`) et le motif d'annulation tapé (`index.html` l. 1892, `texte`). Elle ne doit pas partir au serveur telle quelle. Certain (lu).
- **`catch` vides** : 689 occurrences du motif `catch(x){}` (espaces permis) dans `index.html`, les 45 `next-*.js` et `sw.js`. Les plus nombreux : `next-emission.js` 62, `next-devis2.js` 51, `next-fiabilite.js` 35, `index.html` 32. Certain (compté par `grep`).
- **`erreurReseau`** (`next-emission.js` l. 70-73) : locale au module d'émission. Elle reconnaît la réponse de supabase-js 2.117 sur une coupure (`status:0`, « Failed to fetch »…). La synchro du cœur ne l'utilise pas : `pushState` et `pullState` font `if(error)throw error`, donc une coupure arrive bien dans leur `catch`. Certain (lu).
- **Stockage plein** : `nxStorageFail` (l. 1014) affiche un bandeau rouge et garde `window._nxSaveFail` en mémoire seulement. **Donnée illisible** : copie `…_corrompu_…` et `nxFlag` (l. 1018), en mémoire seulement. Rien n'est remonté. Certain.
- **Appareil** : aucun identifiant d'appareil dans l'appli (recherche). `cp2_sync` ne garde que `lastRemote`, la date **du serveur** de la dernière version connue (`cpSetBase` l. 4068) ; elle peut venir d'un autre appareil. La dernière synchro réussie de **cet** appareil n'est écrite que dans l'étiquette (l. 4139), perdue au rechargement. `cp2_dirty` vaut `'1'`, sans date (l. 4000) : impossible de savoir depuis quand des modifications attendent. Certain.
- « Santé du devis » et « Santé de l'intervention » existent déjà (rentabilité : `index.html` l. 1727 et 2439, `next-devis2.js` l. 742). La page de P11 doit porter un autre nom : « **Santé de l'appli** » (proposé).

### 1.6 Où la synchro échoue sans trace (`index.html`, lu sur `297cc7e`)

| # | Où | Ce qui arrive | Certitude |
|---|---|---|---|
| 1 | `pullState`, `catch` l. 4121 | Toute erreur de lecture (coupure, session expirée, droits, panne du serveur) → étiquette « ⚠ cloud injoignable — mode local ». L'erreur est jetée, rien n'est gardé. | certain |
| 2 | `pushState`, `catch` l. 4154-4155 | Étiquette « ⚠ échec synchro — nouvel essai auto ». Message seulement après un clic sur « Synchroniser ». Nouvel essai toutes les 30 s, sans fin. Rien n'est gardé. | certain |
| 3 | idem, appareil sur une version trop ancienne | `cp_state_push` refuse (« ClimPilot doit être mis à jour… », code P0001, `supabase/migrations/20261002120000_documents_emis.sql` l. 289-291). L'appareil réessaie toutes les 30 s avec « échec synchro ». Personne ne lui dit de faire F5. | probable (lu, non exécuté) |
| 4 | `cpVerifierDistant`, l. 4187 et l. 4190 | Erreur ignorée (`if(error…)return`, `catch` vide). Normal pour une vérification légère, mais une panne longue ne se voit pas. | certain |
| 5 | `markDirty` l. 4000, `cpEnvoiSiBesoin` l. 4004, `cpGarderAbsentes` l. 4034, `cpSetBase` l. 4068 | `catch` vides. Si l'écriture de `cp2_dirty` ou de `cp2_sync_base` échoue (stockage plein), la modification peut ne jamais partir, ou la fusion suivante partir d'une base périmée. | probable |
| 6 | `initCloud`, l. 4206 | Bibliothèque supabase-js non chargée → « ⚠ cloud non chargé — mode local ». Rien n'est gardé. | certain |
| 7 | `pullState` et `pushState`, retours muets | Autre onglet ouvert (`__cpLectureSeule`) ou rechargement en cours (`__cpGel`) : voulu. | certain |
| 8 | `pushState`, l. 4127 | Hors ligne : étiquette « ⌛ hors ligne », voulu. | certain |

**En clair.** Des modifications peuvent attendre des jours sur un appareil (téléphone dans la camionnette, appareil resté sur une ancienne version). Le seul signe est une étiquette en haut de cet écran-là. Aucun autre appareil ne le voit.

## 2. Ce qui manque

| # | Manque | Certitude |
|---|---|---|
| 1 | Une **proposition** d'export à l'ouverture **sur le PC**. Le bandeau existe sur tous les appareils, discret, sans « Plus tard », et ne dit pas où ranger le fichier. | certain |
| 2 | Dans **Paramètres** (vue `v-params`, `index.html` l. 793) : rien sur les sauvegardes. Rien ne dit que le plan gratuit n'a **aucune** sauvegarde Supabase. | certain |
| 3 | Une procédure de reprise après la perte du projet (§ 1.3). | certain |
| 4 | Une trace gardée des erreurs (JS, promesses rejetées, synchro, stockage). | certain (exécuté pour les deux premières) |
| 5 | Une vue des appareils : dernière synchro réussie, modifications en attente depuis quand, version. Le serveur ne le sait pas : `climpilot_state` n'a qu'une ligne par utilisateur et une date. | certain |
| 6 | Un message clair pour un appareil bloqué par sa version (§ 1.6, cas 3). | probable |
| 7 | Un nettoyage des messages d'erreur avant tout envoi : ils peuvent contenir des données de clients (§ 1.5). | certain |

## 3. La règle proposée

### 3.0 Découpage (question 1)

- **P11-A — export et Paramètres** : appli seulement, aucun changement serveur. ≈ 1 jour.
- **P11-B — journal d'erreurs et page Santé** : une migration + l'appli. ≈ 2,5 à 3 jours.
- Deux branches, l'une après l'autre. Une branche vit une semaine au plus, et une seule mission touche le code à la fois (règle 6).

### 3.1 Export hebdomadaire proposé à l'ouverture (P11-A)

- **Quand** : à l'ouverture (tableau de bord), quand les quatre conditions sont réunies :
  - le cloud est connecté ;
  - une première lecture a réussi (sinon l'export serait incomplet) ;
  - l'appareil est un ordinateur ;
  - `cpnext_dernier_export.at` a plus de 7 jours, ou n'existe pas.
- **Ordinateur** : pointeur fin (`matchMedia('(pointer: fine)')`) et largeur d'au moins 900 px. Hypothèse : règle simple, à vérifier sur ton PC et ton iPhone. On ne lit pas l'identité complète du navigateur.
- **Forme** : une carte en tête du tableau de bord, **pas une fenêtre** qui bloque l'écran (une fenêtre bloquerait aussi les suites de tests qui simulent un PC).
  - « 💾 Ta dernière copie hors Supabase date de N jours. [⤓ Télécharger l'export complet] [Plus tard] » ; « aucune » si jamais fait.
  - Dessous : « Range le fichier ClimPilot_export_complet_AAAA-MM-JJ.json <endroit de la question 5>, pas seulement dans Téléchargements. »
- **« Plus tard »** : la carte revient le lendemain. Clé locale `cpnext_export_reporte` (date du jour), non synchronisée, ajoutée à `NX_BK_SKIP`.
- **Après un export complet réussi** : la carte disparaît. Le message de fin redit où ranger le fichier et reste affiché jusqu'à « Compris » (aujourd'hui, il disparaît en quelques secondes).
- **Téléphone** : rien de nouveau. La ligne discrète d'aujourd'hui reste (R3 inchangé).
- **`cpnext_dernier_export` reste synchronisée et inchangée** (format, sens). Un fichier exporté sur n'importe quel appareil est une copie hors Supabase. Changer la clé casserait R3 et la lecture par la tâche planifiée, si elle existe. Si tu veux que seul un export **du PC** compte : question 2.
- **Branchement** : dans l'enveloppe existante de `checkBackup` (`next-fiabilite.js` l. 54-58), qui appelle déjà `nxaRappelExport`. La carte est construite dans `next-assistant.js`, à côté. Aucune enveloppe nouvelle (règle 11, suite W).

### 3.2 « Sauvegardes » dans Paramètres, en lecture seule (P11-A)

Un bloc dans `v-params` (`index.html` l. 793), rempli par `next-assistant.js`, qui lit déjà `climpilot_backups`. Trois lignes, **aucun bouton « Restaurer »** (il reste dans Sécurité & corbeille) :

1. **Supabase (l'hébergeur)** : « Plan gratuit : Supabase ne fait **aucune** sauvegarde de ta base. Avec le plan Pro (prévu en juin 2027) : 7 jours de sauvegardes quotidiennes, visibles dans le tableau de bord Supabase (Database › Backups). »
   - Texte fixe : l'appli ne peut pas lire le plan (§ 1.4). Une petite mission le changera au passage au plan Pro (question 3).
2. **Copies ClimPilot dans Supabase** : « Dernière copie quotidienne le … ; n copies. Elles sont dans la même base : elles ne protègent ni d'une suppression du projet, ni le registre des factures. »
   - Lecture : `climpilot_backups`, colonnes `created_at` et `raison` (permis par la règle d'accès `backups_select`).
   - Alerte si la dernière copie quotidienne a plus de 48 h alors que cet appareil a synchronisé dans les dernières 24 h (le déclencheur ne tournerait plus). Seuil : hypothèse.
3. **Copie hors Supabase** : « Dernier export complet le … (N jours) », avec un lien vers le bouton d'export.

Hors ligne ou pas connecté : lignes 1 et 3 seulement ; ligne 2 « indisponible ».

### 3.3 Journal d'erreurs : ce qui est noté (P11-B)

| Type | D'où | Code |
|---|---|---|
| `js` | `window.onerror` (`index.html` l. 986), **modifiée**, pas enveloppée | nom de l'erreur (`TypeError`…) |
| `promesse` | nouvelle écoute `unhandledrejection`, posée juste à côté | nom de l'erreur |
| `synchro` | `catch` de `pullState` (l. 4121), de `pushState` (l. 4154), d'`initCloud` (l. 4206) ; `cpVerifierDistant` seulement après 3 échecs de suite | `reseau`, `version`, `session`, `droits` ou `serveur`, par une petite fonction de classement du cœur (même règle qu'`erreurReseau`, qui ne bouge pas) |
| `stockage` | `nxStorageFail` (l. 1014), `nxFlag` (l. 1018) | nom de l'erreur ou `corrompu`, + nom de la clé (ex. `cp2_devis`) |

**Pas noté** : hors ligne ; conflit de synchro (ce n'est pas une erreur) ; refus voulus d'AF1 (ils restent dans `cpnext_journal`) ; erreurs de l'envoi au journal lui-même (pas de boucle) ; échecs d'émission des factures (déjà dits à l'écran ; hors P11).

**Chaque ligne contient** :
- l'identifiant de l'appareil (tiré au hasard) et un libellé grossier (« ordinateur · Chrome · Windows ») ;
- la version (`CP_VERSION`) et le nom du cache du service worker ;
- l'écran (`window._curView`) ;
- le type, le code, et la source (`fichier:ligne:colonne`, sans adresse) ;
- le message **nettoyé** (300 caractères au plus) et le nombre de répétitions ;
- la date, à l'heure du **serveur**.

**Jamais** : contenu d'un devis, d'un client ou d'une fiche ; pile d'appels complète ; adresse de la page ; identité complète du navigateur ; `cpnext_journal`.

**Nettoyage** (fonction pure du cœur, testée seule) :
1. tout texte entre guillemets (`"` `'` `«»` `` ` ``) → `"…"` : c'est là que le moteur recopie la donnée (§ 1.5) ;
2. adresses e-mail → `[e-mail]` ; suites de 5 chiffres ou plus (téléphone, SIRET, numéro de compte, code) → `[nombre]` ; identifiants UUID → `[id]` ;
3. adresses web : le nom du fichier seulement (ni domaine, ni paramètres : un lien de signature porte un jeton) ;
4. coupé à 300 caractères.

Côté serveur, en plus : longueurs bornées et e-mails remplacés (deuxième barrière). Hypothèse : la liste couvre les cas vus ; un message d'un genre imprévu reste possible (§ 5.2).

**File d'attente sur l'appareil** :
- `cpnext_erreurs_file` : 50 lignes au plus. Même type, code, source et message dans l'heure → nombre + 1. Au plus 50 erreurs nouvelles par appareil et par jour (au-delà, comptées, pas gardées).
- Envoi : après une synchro réussie, au plus une fois toutes les 10 minutes, 20 lignes par appel, par la fonction serveur `cp_sante_noter`. Envoi réussi → lignes retirées de la file.
- Fonction absente (migration pas encore passée, `PGRST202`) : la file reste, plus d'essai pendant la session, l'appli marche comme avant.
- L'envoi n'écrit rien dans l'état synchronisé et n'appelle jamais `markDirty`.

### 3.4 Serveur : tables, règles d'accès, plafond (P11-B)

**Fichiers** :
- `supabase/migrations/<date>_sante.sql` (rejouable) ;
- `tests/supabase-test/7-sante-TEST.sql` (verrou sur `public.climpilot_marqueur_test`, modèle `4-une-facture-par-source-TEST.sql`) ;
- `tests/supabase-test/7-sante-retour-arriere.sql` ;
- `tests/supabase-test/7-REEL-sante.sql` (modèle `6-REEL-droits-anon.sql` : s'arrête si le marqueur de TEST est présent).

**Deux tables** : `climpilot_errors` (le journal) et `climpilot_appareils` (une ligne par appareil). La seconde est nécessaire pour « dernière synchro par appareil » : `climpilot_state` n'a qu'une ligne par utilisateur (question 4).

Esquisse (proposition, pas un script à coller) :

```sql
create table if not exists public.climpilot_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  appareil uuid not null,
  type text not null check (type in ('js','promesse','synchro','stockage')),
  code text check (char_length(code) <= 40),
  source text check (char_length(source) <= 80),
  ecran text check (char_length(ecran) <= 40),
  version text check (char_length(version) <= 20),
  cache text check (char_length(cache) <= 60),
  message text check (char_length(message) <= 300),
  nb int not null default 1 check (nb between 1 and 10000)
);
create index if not exists climpilot_errors_user_date on public.climpilot_errors (user_id, created_at desc);

create table if not exists public.climpilot_appareils (
  user_id uuid not null references auth.users(id) on delete cascade,
  appareil uuid not null,
  libelle text check (char_length(libelle) <= 40),
  version text check (char_length(version) <= 20),
  cache text check (char_length(cache) <= 60),
  derniere_synchro timestamptz,   -- heure du SERVEUR, à l'appel qui suit une synchro réussie
  non_envoye_depuis timestamptz,  -- heure de l'appareil, ramenée à now() si elle est dans le futur
  vu_le timestamptz not null default now(),
  primary key (user_id, appareil)
);
```

**Règles d'accès (RLS)**, activées sur les deux tables :
- lecture : seulement ses propres lignes ;
- suppression : seulement ses propres lignes (« Vider le journal », « Oublier cet appareil ») ;
- **aucune** règle ni aucun droit d'ajout ou de modification directs : tout passe par la fonction ;
- droits : `revoke all … from public, anon` (le test `test_p6_14` de `tests/sql/test_p6_droits.py` échoue si une migration l'oublie) ; `grant select, delete … to authenticated`.

**Fonction `cp_sante_noter(p_appareil, p_libelle, p_version, p_cache, p_synchro_ok, p_non_envoye_depuis, p_erreurs)`**, `security definer`, `search_path` vide, même modèle que `cp_state_push` et `cp_emettre_document` :
1. refus si l'utilisateur n'est pas connecté ;
2. verrou par utilisateur (`pg_advisory_xact_lock`) : un appel à la fois, donc un plafond exact même avec deux appareils ;
3. appareils : ajout ou mise à jour de la ligne. Refus d'un 21e appareil. `derniere_synchro = now()` si `p_synchro_ok` ;
4. erreurs : 20 par appel au plus. **Plafond : 200 lignes par jour et par utilisateur**, compté depuis minuit heure de Paris. Les premières passent dans la limite, les autres sont refusées et comptées. Textes coupés, e-mails remplacés, date = `now()` ;
5. purge : erreurs de plus de 90 jours (hypothèse, question 7) ; appareils sans signe depuis 90 jours ;
6. rend `{ok, acceptees, refusees, restant_jour}` ;
7. droits : `revoke all … from public, anon, authenticated` ; `grant execute … to authenticated`.

Pourquoi une fonction plutôt qu'un ajout direct : la date et le compte sont fixés par le serveur, et le plafond ne se contourne pas.

**Volume au plus** (calcul sur nos propres bornes) : 200 lignes × 90 jours = 18 000 lignes par utilisateur ; chaque ligne fait moins de 1 Ko au vu des bornes, donc moins de 18 Mo. L'occupation réelle dans PostgreSQL n'a pas été mesurée.

### 3.5 Page « Santé de l'appli » (P11-B)

Une carte dans Outils (vue `nx_tools`), sous « ☁️ Sauvegardes », posée par le même branchement (`next-assistant.js` l. 799) : aucune enveloppe nouvelle.

1. **Cet appareil** (local, marche hors ligne) : nom court, version, cache ; dernière synchro réussie ; « modifications pas envoyées depuis … » ; erreurs en attente d'envoi.
2. **Appareils** (serveur) : pour chacun, libellé, version, dernière synchro.
   - **Orange** si la dernière synchro a plus de 24 h.
   - **Rouge** si des modifications attendent depuis plus de 24 h.
   - « Pas à jour : F5 » si la version diffère de celle de l'appareil qui regarde.
3. **Dernières erreurs** (serveur, les 50 dernières) : date, appareil, type, code, écran, version, message, ×nombre. Tout le texte est échappé.
4. Boutons « Vider le journal » et « Oublier cet appareil ».

Ailleurs que dans la page :
- question 6 : une ligne rouge dans le bandeau du tableau de bord quand **cet** appareil a des modifications non envoyées depuis plus de 24 h ;
- cas 3 du § 1.6 : l'étiquette devient « ⚠ ClimPilot doit être mis à jour : recharge la page (F5) » au lieu de « échec synchro ».

### 3.6 Clés locales et synchronisation

| Clé | Contenu | Synchronisée | Dans la sauvegarde et l'export |
|---|---|---|---|
| `cpnext_dernier_export` (existe) | inchangé | oui (déjà) | oui (inchangé) |
| `cpnext_export_reporte` (P11-A) | date du « Plus tard » | non | non (`NX_BK_SKIP`) |
| `cpnext_appareil` (P11-B) | `{id, cree, libelle}` | non | **non** : sinon, importer la sauvegarde d'un autre appareil recopierait son identifiant (`importJSON` restaure toutes les clés `cpnext_`, l. 2790) |
| `cpnext_sante` (P11-B) | `{derniereSynchroOk, nonEnvoyeDepuis, dernierEnvoi, echecsVerif}` | non | non |
| `cpnext_erreurs_file` (P11-B) | 50 lignes au plus | non | non |
| `cpnext_journal` (existe) | inchangé | non | oui (inchangé) |

- **Rien de nouveau dans l'état synchronisé** : aucune clé ajoutée à `SYNC_KEYS`. Rappel : le serveur remplace tout l'état à chaque envoi ; ici, aucune donnée nouvelle n'y entre.
- Les tables `climpilot_errors` et `climpilot_appareils` sont **à part** : `cp_state_push` ne les touche pas, et elles ne touchent pas `climpilot_state` (ni donc les copies `climpilot_backups`).
- `NX_BK_SKIP` (l. 2761) gagne 4 noms. Il sert aussi à `cpGarderAbsentes` (l. 4034) : sans effet ici, ces clés n'étant pas synchronisées.

### 3.7 Ce que P11 ne fait pas

- Les 689 `catch` vides ne sont pas repris un par un. Seuls ceux de la synchro (§ 1.6, cas 4 et 5) journalisent (règle 11).
- Pas d'export sans clic : un navigateur n'écrit pas un fichier sans un geste. La copie Drive par tâche planifiée ne marchait pas (`docs/ESSAIS-SUPABASE-TEST.md`, audit du 18/10, point 3).
- Pas de lecture des sauvegardes Supabase par l'API de gestion (jeton du compte, § 1.4).
- Pas de `db dump` : outil en ligne de commande qui demande le mot de passe de la base, pas un outil de l'appli.
- Échecs d'émission des factures : hors P11.

## 4. Tests à écrire d'abord (rouges sur `main`)

### 4.1 Suite navigateur `tests/suiteAG-p11-sante.mjs` (horloge `REF`)

- **Nom** : AB est réservé à la mission S ; AE est retenu par P3 (`docs/MISSION-P3.md` § 4.4) ; AF est évité (confusion avec les missions AF1 à AF5).
- **Inscription** : `tests/run-all.sh` (`SUITES_DEFAUT`) et `tests/isolation/rapport.mjs`, comme la suite AD.
- **Serveur simulé** : `tests/serveur-simule.mjs` gagne `cp_sante_noter` et les deux tables, avec les mêmes règles que le SQL (plafond, 20 appareils, 90 jours).
- **Pages** : `page({mobile:false, horloge:REF.horloge})` pour le PC (1300 px) ; `page({horloge:REF.horloge})` pour l'iPhone 13 (valeur par défaut de `tests/lib.mjs`).

**P11-A**

| Test | Situation | Attendu | Sur `main` |
|---|---|---|---|
| AG1 | PC connecté, dernier export à REF − 8 j | carte « 8 jours », bouton, phrase « où ranger » ; clic → `ClimPilot_export_complet_<REF.jour>.json` ; `at` = REF ; carte disparue | rouge (pas de carte) |
| AG2 | REF − 6 j ; jamais exporté ; « Plus tard » | rien ; carte « aucune » ; rien au rechargement le même jour, carte à REF + 1 j | rouge |
| AG3 | iPhone 13 | pas de carte ; ligne discrète présente (R3 inchangé) | vert (témoin) |
| AG4 | PC pas connecté | pas de carte | vert (témoin) |
| AG5 | Paramètres | « plan gratuit », « aucune sauvegarde », date de la dernière copie quotidienne (simulée), date du dernier export ; aucun bouton « Restaurer » dans ce bloc ; hors ligne : ligne 2 « indisponible » | rouge |
| AG6 | copie quotidienne vieille de 49 h, synchro il y a 1 h | alerte | rouge |

**P11-B**

| Test | Situation | Attendu | Sur `main` |
|---|---|---|---|
| AG10 | erreur non interceptée (script ajouté à la page, comme au § 1.5) | 1 ligne `js` avec source, écran, version ; bandeau rouge toujours là. Messages piégés : `JSON.parse('Dupont Jean')`, e-mail fictif, téléphone, lien avec `?token=` → aucun de ces textes dans la file ni dans l'envoi | rouge |
| AG11 | promesse rejetée | 1 ligne `promesse` | rouge |
| AG12 | synchro : serveur hors service (`fail.horsService`, forme réelle de supabase-js) ; refus « doit être mis à jour » (P0001) ; refus de droits (42501) | `synchro/reseau` ; `synchro/version` + étiquette « F5 » ; `synchro/droits` | rouge |
| AG13 | 10 fois la même erreur ; 80 erreurs différentes | 1 ligne `nb=10` ; 50 gardées | rouge |
| AG14 | envoi après une synchro réussie ; puis fonction absente (`PGRST202`) | 1 appel `cp_sante_noter` (20 lignes au plus), file vidée ; fonction absente : file gardée, pas de nouvel essai, aucune erreur notée pour cet échec, appli normale ; aucun envoi d'état en plus, `cp2_dirty` inchangé | rouge |
| AG15 | page Santé | appareils et erreurs du serveur simulé ; appareil à REF − 25 h → alerte ; message `<img src=x onerror=…>` affiché en texte, rien exécuté ; « Vider le journal » | rouge |
| AG16 | `cp2_dirty` posé à REF − 25 h | alerte rouge (page, et bandeau si question 6 = oui) | rouge |
| AG17 | importer la sauvegarde d'un autre appareil ; export complet | `cpnext_appareil` inchangé ; l'export ne contient ni `cpnext_appareil`, ni `cpnext_sante`, ni `cpnext_erreurs_file` | rouge |
| AG18 | état envoyé par `cp_state_push` (simulé) | aucune des nouvelles clés | vert (témoin) |

Règle 9 : rejouer avec `faketime` un samedi, un dimanche et le 05/01 de l'année suivante (minuit de Paris pour le plafond et pour les 7 jours).

### 4.2 Banc deux appareils (`tests/banc-appareils.mjs`)

Ajouter au serveur commun (`serveurCommun`) : `S.erreurs`, `S.appareils`, l'appel `cp_sante_noter` (mêmes règles) et la lecture des deux tables.

| Scénario | Ce qu'on fait | Attendu |
|---|---|---|
| AGB1 | PC et téléphone connectés (`seConnecter`), synchro (`calme`) | 2 appareils distincts au serveur ; la page Santé du PC liste le téléphone |
| AGB2 | `couper(téléphone)`, erreur provoquée sur le téléphone, `retablir` | erreur en file, puis envoyée ; visible sur le PC |
| AGB3 | dernière synchro du téléphone mise à REF − 25 h dans `S.appareils` | alerte sur le PC |
| AGB4 | envoi au journal pendant qu'un autre appareil écrit l'état | `S.conflits` inchangé ; état du serveur identique |
| AGB5 | `rouvrir` ; deux appareils | même identifiant après réouverture ; identifiants différents entre appareils |

### 4.3 SQL `tests/sql/test_sante.py` (PostgreSQL 16 local, marqueur `climpilot-test`)

Base neuve à chaque test (`00_supabase_emul.sql` + `01_base_actuelle.sql` + migrations), migration appliquée deux fois. Rouge sur `main` : la migration n'existe pas.

| Test | Attendu |
|---|---|
| S1 | migration rejouable |
| S2 | A ne voit ni ne supprime les lignes de B (deux tables) |
| S3 | `anon` : aucun droit ; `test_p6_14` reste vert |
| S4 | `authenticated` : ajout et modification directs refusés (42501) |
| S5 | 200 lignes acceptées, la 201e refusée ; le compte rendu de la fonction est exact |
| S6 | des lignes d'hier (posées en superutilisateur) ne comptent pas : minuit heure de Paris |
| S7 | 8 connexions simultanées × 30 lignes → exactement 200 |
| S8 | textes coupés ; type inconnu refusé ; plus de 20 lignes par appel refusées ou coupées |
| S9 | e-mail remplacé côté serveur |
| S10 | purge à 90 jours (erreurs et appareils) |
| S11 | 21e appareil refusé |
| S12 | `derniere_synchro` = heure du serveur ; `non_envoye_depuis` dans le futur ramené à `now()` |
| S13 | `climpilot_state` inchangé (`updated_at`) ; aucune copie `climpilot_backups` créée |
| S14 | retour arrière : tables et fonction supprimées ; migration réappliquable ensuite |

### 4.4 Suites qui ne doivent pas bouger (la batterie le vérifie)

- **R** (R3 : export et rappel discret).
- **U** : `cpMerge` n'est pas touchée.
- **W** : aucune enveloppe nouvelle. Les 17 fonctions comptées (`tests/suiteW-enveloppes.mjs` l. 21) ne comprennent ni `pushState`, ni `pullState`, ni `checkBackup`, mais la règle 11 vaut quand même.
- **Y et Z** : aucun montant, aucun document.
- **I** (émission), **Q** (recette deux appareils), **AD** et **AE** (P3) ; `test_p6_droits.py`.

## 5. Risques, RGPD, retour arrière, déploiement, estimation

### 5.1 Ordre avec les autres missions

- **P3 d'abord.** P3 ajoute un journal de fusion dans `pushState` et une garde dans `pullState` (`docs/MISSION-P3.md` § 3.2, points 3 et 4). P11-B touche les mêmes fonctions.
- **P11-A** ne touche pas la synchro : elle peut passer avant ou après P3, mais jamais en même temps (une mission sur le code à la fois).
- **File** : S → COMPTE → P11. La mission S peut changer des droits sur les tables ; son dossier est dans le Project (non lu ici). Au lancement de P11, l'exécutant vérifie que la migration suit les règles de S.
- **Cache** : `const C=` de `sw.js` incrémenté une fois par branche (1134 aujourd'hui ; 1135 attendu après P3). `VERSION` et `NX_VERSION` : te demander.

### 5.2 Risques et garde-fous

| Risque | Garde-fou | Reste |
|---|---|---|
| Une donnée de client dans un message | nettoyage testé (§ 3.3, AG10), bornes côté serveur, purge à 90 jours, « Vider le journal » | un message d'un genre imprévu (probable, faible) |
| Une boucle : erreur dans l'envoi → envoi… | indicateur « envoi en cours » ; erreurs de `cp_sante_noter` jamais notées ; 50 par jour par appareil ; 200 par jour au serveur | — |
| Migration absente, projet en pause | l'appli marche comme avant ; file bornée | les erreurs ne remontent qu'après |
| Reconnaître un appareil (pistage) | libellé grossier seulement ; identifiant tiré au hasard, effaçable | — |
| Le fichier d'export contient toutes les données des clients, en clair | l'endroit où le ranger est ta décision (question 5). Le registre RGPD propose de garder 4 exports hebdomadaires et 1 par mois sur 12 mois (hypothèse, `docs/RGPD-registre.md` l. 91) | une clé USB perdue = une fuite |
| Tu n'ouvres jamais le PC | la ligne discrète reste sur le téléphone ; la clé reste synchronisée (question 2) | — |
| Suites qui simulent un PC gênées par la carte | carte, pas fenêtre bloquante | probable, à prouver par la batterie |

Le bandeau rouge de `window.onerror` reste tel quel : rien de visible n'est retiré.

### 5.3 RGPD

- **Ce qui est stocké** sur Supabase (Irlande, `eu-west-1`, registre du 25/10) :
  - l'identifiant de ton compte, un identifiant d'appareil tiré au hasard, un libellé grossier ;
  - la version, l'écran, le type et le code d'erreur, `fichier:ligne`, le message nettoyé, les dates.
- Ce sont tes données d'utilisateur de l'appli, sous un identifiant aléatoire. **Aucune donnée de client** : c'est le but du nettoyage, prouvé par AG10.
- **Durée** : 90 jours (hypothèse ; c'est **ta** décision, question 7), avec purge automatique par la fonction serveur. Appareils : 90 jours sans signe.
- **CNIL** : `cnil.fr` n'a pas pu être ouvert depuis cette session. `docs/RGPD-registre.md` (sources lues le 25/10/2026) cite :
  - la recommandation de la CNIL sur la journalisation (délibération n° 2021-122 du 14/10/2021) ;
  - la fiche « Tracer les opérations » : journaux « sur une période glissante comprise entre six mois et un an ».
  Ces journaux-là servent à la **sécurité**. Le journal de P11 sert au **dépannage** : ce dossier ne lui applique pas cette règle et n'en cite aucune autre.
- Le compte rendu de P11-B ajoute une ligne au registre RGPD (« Journal d'erreurs de l'appli : 90 jours, hypothèse ») : à toi de la valider.
- L'export complet rangé hors Supabase est une copie de plus des données des clients : la ligne « Exports complets » du registre la couvre déjà (hypothèse de durée).

### 5.4 Retour arrière

- **P11-A** : revert du commit. Aucune donnée serveur. `cpnext_export_reporte` est ignorée par l'ancienne version.
- **P11-B, appli** : revert. L'ancienne version ignore les clés locales. Elles entreraient alors dans la sauvegarde de l'appareil : sans danger, car une version qui ne les lit pas n'en fait rien.
- **P11-B, serveur** : `7-sante-retour-arriere.sql` supprime `cp_sante_noter`, `climpilot_errors` et `climpilot_appareils`. Seul le journal d'erreurs est perdu ; rien d'autre n'est touché (S13, S14).
- **Dans le code** : l'envoi et la page sont entourés d'un `try/catch` qui écrit en console (règle 11). En cas d'erreur, l'appli continue comme aujourd'hui.

### 5.5 Ordre de déploiement (P11-B)

1. P3 fusionnée, F5 partout.
2. Branche P11-B :
   - tests rouges (journal gardé) ;
   - code ;
   - suite visée, puis batterie complète, puis CI verte ;
   - relecture par l'autre modèle (`relecture-p10`).
3. Tu colles `7-sante-TEST.sql` dans ClimPilot-TEST. Attendu : toutes les lignes « OK » (nombre exact donné par le script).
4. Essai sur la copie d'essai (§ 5.6).
5. Tu colles `7-REEL-sante.sql` sur le réel. Sans risque avant la fusion : les tables restent vides tant que l'appli ne s'en sert pas.
6. Fusion, puis le même jour : « ✓ synchronisé », puis F5 sur chaque appareil.

L'ordre inverse de 5 et 6 marche aussi (l'appli garde sa file tant que la fonction manque), mais les erreurs ne remontent qu'après le point 5.

### 5.6 L'essai que tu feras (esquisse ; le compte rendu la détaillera)

**P11-A** (PC et iPhone, ≈ 5 min, copie d'essai) :
1. Ouvre l'appli sur le PC. Attendu : si ton dernier export a plus de 7 jours, une carte « 💾 … » en haut du tableau de bord.
2. Clique « Télécharger l'export complet ». Attendu : un fichier `ClimPilot_export_complet_<date>.json` ; la carte disparaît ; le message dit où le ranger.
3. Ouvre Paramètres. Attendu : un bloc « Sauvegardes » avec « plan gratuit : aucune sauvegarde Supabase », la date de la dernière copie quotidienne, la date de ton export.
4. Ouvre l'appli sur l'iPhone. Attendu : pas de carte.

**P11-B** (PC et iPhone, ≈ 10 min) :
1. Sur le PC : Outils › Santé de l'appli. Attendu : les deux appareils, avec la dernière synchro de chacun.
2. Coupe le Wi-Fi de l'iPhone, modifie une note d'un devis d'essai, rallume après 2 minutes. Attendu : la dernière synchro de l'iPhone se met à jour sur le PC.
3. Provoquer une erreur : à préciser par le compte rendu (proposé : un bouton « Erreur d'essai » visible seulement sur la copie d'essai). Attendu : elle apparaît dans la page Santé du PC, sans aucun nom de client.

### 5.7 Estimation honnête

**P11-A**
- Appli : `next-assistant.js` (carte, bloc Paramètres), `next-fiabilite.js` (un appel dans l'enveloppe existante), `index.html` (un emplacement dans `v-params`, un nom dans `NX_BK_SKIP`), `sw.js` (cache).
- Tests : AG1 à AG6, ≈ 15 contrôles.
- Durée : ≈ 1 jour de sessions. Ton temps : ≈ 5 min d'essai, la fusion, les F5.

**P11-B**
- Appli :
  - `index.html` : `window.onerror` modifiée, écoute `unhandledrejection`, classement, nettoyage, file, envoi, identifiant d'appareil, 4 `catch` de la synchro, étiquette « F5 », 3 noms dans `NX_BK_SKIP` (estimation : 120 à 180 lignes) ;
  - `next-assistant.js` : page Santé ;
  - `sw.js` : cache.
- Serveur : la migration et 3 scripts (TEST, réel, retour arrière).
- Tests :
  - `suiteAG` : ≈ 30 contrôles ; banc : ≈ 12 ; `test_sante.py` : 14 tests ;
  - simulation dans `serveur-simule.mjs` et `banc-appareils.mjs` ;
  - inscription dans `run-all.sh` et `isolation/rapport.mjs`.
- Documents : compte rendu, `docs/ESSAIS-SUPABASE-TEST.md`, `docs/RGPD-registre.md`, `tests/LISEZMOI.md`, `docs/FILE-DES-MISSIONS.md`.
- Durée : 2,5 à 3 jours de sessions (tests 1 ; code 1 ; SQL et scripts ½ ; batterie, CI et compte rendu ½ ; relecture ½). Ton temps : ≈ 10 min de scripts, ≈ 15 min d'essai, la fusion, les F5.

## 6. Tes questions (oui / non)

1. **Découpage.** P11-A (export et Paramètres, sans serveur) puis P11-B (journal et Santé, avec migration), sur deux branches ? Recommandé : oui.
2. **Clé synchronisée.** Garder `cpnext_dernier_export` synchronisée : un export fait sur n'importe quel appareil compte, et le PC ne redemande pas ? Recommandé : oui. Si non : clé propre au PC ; la tâche planifiée qui lit `climpilot_state` ne la verrait plus.
3. **Texte fixe** dans Paramètres, « plan gratuit : aucune sauvegarde Supabase », à changer par une petite mission quand tu passes au plan Pro (juin 2027) ? Recommandé : oui.
4. **Table des appareils.** Une seconde petite table, `climpilot_appareils` (une ligne par appareil), pour « dernière synchro par appareil » ? Recommandé : oui. Sans elle, la page Santé ne voit que l'appareil où elle est ouverte.
5. **Où ranger.** Le rappel dit « range-le sur une clé USB ou un disque à part, pas seulement dans Téléchargements » ? Oui / non (si non, dis l'endroit à écrire).
6. **Alerte au tableau de bord.** « Modifications non envoyées depuis plus de 24 h » aussi dans le bandeau du tableau de bord, pas seulement dans la page Santé ? Recommandé : oui.
7. **Durée du journal.** 90 jours ? Oui / non (si non, la durée). C'est ta décision (RGPD).
8. **Procédure de reprise.** Écrire dans P11 (documents seulement, ≈ ½ jour) « projet Supabase perdu : comment repartir des exports complets » ? Recommandé : oui. Aujourd'hui, personne ne sait remettre le registre des factures à partir du fichier.

**Hors P11, notés** : échecs d'émission des factures au journal ; les 689 `catch` vides ; la tâche planifiée qui lirait `cpnext_dernier_export` (hors dépôt, à vérifier par toi) ; la vérification par l'API de gestion de Supabase (refusée : jeton du compte).
