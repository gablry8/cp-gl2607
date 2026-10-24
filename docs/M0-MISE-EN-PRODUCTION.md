# ClimPilot — M0 : fiche de mise en production (branche `fusion/avant-refonte`)

> Rédigée le 20/10/2026, complétée le 21/10 par Claude (Fable 5.1) pour Gabriel Leroy. À lire avec `M0-COMPTE-RENDU.md`.
> Corrigée le 21/10 après les relectures M3 et M4 (Opus 5.5) : hébergement de la copie d'essai (M4 C1) et contrôle 5 bis (M3 C4). Complétée le 21/10 au soir (après C1) : facturation réelle autorisée sur la copie d'essai, base de TEST uniquement, pour que le 5 bis soit probant ; copie 1131-fusion-C1 remise à part (zip + `LISEZ-MOI-ESSAI-C1.txt`).
> Rien ici n'a été fait par l'IA sur le projet réel ni sur le projet de TEST : **chaque étape est ton geste**.
> Les libellés de menus Supabase / GitHub / Netlify sont donnés de mémoire (hypothèse) : si un libellé diffère à l'écran, c'est l'écran qui a raison.
>
> **Ordre** : partie 0 (copie d'essai sur la base de TEST) → partie A (mise en production de l'**appli seule**) → partie B (**plus tard**, au moment de brancher le site : migration + fonction `agenda`). La partie A ne dépend pas de la B : sans la migration, l'envoi des demi-journées occupées se coupe tout seul, sans message (certain, `next-planning.js` l. 108).

---

## Partie 0 — Copie d'essai `ClimPilot-ESSAI-1130-production.zip` (base de TEST, jamais la réelle)

### 0.1 Ce que c'est
La même appli que la branche (mêmes fichiers, mêmes calculs), avec trois différences, et rien d'autre :
1. l'adresse et la clé publique du projet **réel** sont **retirées** de `index.html` et `signer.html` ; la copie les lit dans un petit fichier `essai-config.js` que **tu** remplis avec celles du projet ClimPilot-TEST ;
2. tant que ce fichier n'est pas rempli, ou s'il pointe vers le projet réel, la copie **refuse de démarrer** (écran rouge, aucune connexion nulle part) — vérifié dans Chromium ;
3. bandeau rouge permanent « VERSION D'ESSAI — base de TEST — aucune vraie facture ici », nom « CP ESSAI » sur l'écran d'accueil, cache hors ligne à part.
Fabriquée par `tools/essai/construire-copie-essai.sh` (sur la branche) ; le zip t'est remis à part, il n'est pas dans le dépôt.

### 0.2 Configurer (5 min, une fois)
1. Le zip se dépose tel quel sur Netlify (0.3). Pour vérifier ou modifier la configuration : décompresse-le → `essai-config.js`.
2. Ouvre `essai-config.js` avec le Bloc-notes. Remplace les deux textes `REMPLACER …` par :
   - `url` : Supabase › projet **ClimPilot-TEST** › Settings › API › **Project URL** (forme `https://xxxx.supabase.co`, sans barre à la fin) ;
   - `key` : même page › Project API keys › **anon public** (c'est la clé *publique*, pas la `service_role`).
   Enregistre. Vérifie dans l'adresse de la page Supabase que tu es bien sur le projet **TEST**.
3. Le projet TEST doit être **actif** (Supabase met en pause les projets gratuits inutilisés : tableau de bord › Restore) et avoir la structure 1.10 (c'est le cas depuis le 05/10, `docs/ESSAIS-SUPABASE-TEST.md`).

### 0.3 Mettre en ligne (obligatoire : ouverte depuis un simple fichier, la copie démarre mais **sans cloud** — vérifié ; le téléphone a besoin d'une adresse https)
Je ne sais pas où les copies 1.11/1.12 avaient été hébergées (pas dans le dépôt). **Une seule façon** :
- **Netlify**, comme pour les copies 1.11 et 1.12 : ton site d'essai › **Deploys** › glisse le **zip** tel quel (fichiers à la racine du zip, sans le dézipper), puis F5 sur l'adresse du site (méthode de `ClimPilot_Essais/LISEZ-MOI-ESSAI.txt`). Sans site d'essai : `app.netlify.com/drop` avec le dossier décompressé.

**Jamais sous `gablry8.github.io`** (ni un nouveau dépôt GitHub Pages `climpilot-essai`, ni un sous-dossier de `cp-gl2607`). Raison (M4 C1, certain sur un PC) : tous les sites `https://gablry8.github.io/…` ont la **même origine web** que la vraie appli, donc le même stockage du navigateur (même base IndexedDB `climpilot-store`, mêmes clés `cp2_*`) et les mêmes caches hors ligne. La copie afficherait tes **vraies données** et les enverrait sur la base de TEST, ce que tu ferais dans la copie reviendrait dans la vraie appli (qui le synchroniserait **en production**), et chaque service worker effacerait le cache de l'autre (la vraie appli ne s'ouvrirait plus hors ligne). Le script de construction ne change ni le nom de la base ni les clés : seule une **autre origine** (Netlify) sépare les deux.
Si une copie a déjà été publiée sous `gablry8.github.io` : ne l'ouvre plus et dis-le-moi ; on vérifie d'abord, en lecture seule, l'état de la production.

### 0.4 Ouvrir
- **PC** : Chrome/Edge → l'adresse https de la copie → le bandeau rouge doit être visible → connexion avec **ton compte du projet TEST** (pas celui du réel ; si le même e-mail existe sur les deux, le mot de passe est celui du TEST). Si tu vois « COPIE D'ESSAI BLOQUÉE », relis 0.2.
- **Téléphone** : Safari (iPhone) ou Chrome (Android) → même adresse → Partager › **Sur l'écran d'accueil** → une icône « CP ESSAI », séparée de la vraie. Les deux ne se mélangent pas **parce que** l'adresse Netlify est une autre origine web que `gablry8.github.io` (certain sur PC ; probable sur téléphone, selon que l'icône d'accueil partage ou non le stockage du navigateur — M4 C1). Sous `gablry8.github.io`, elles se mélangeraient (0.3).
- **Données d'essai réalistes** : sur la vraie appli, Outils › **⤓ Sauvegarde** ; sur la copie (PC), **⤒ Importer** (bouton en haut) → le fichier. La copie synchronise ensuite ces données sur le projet TEST, puis le téléphone-essai les reçoit. **Facturation réelle sur la copie : autorisée, base de TEST uniquement** (décision du 21/10, après C1) : en mode démonstration (numéros `TEST-F-…`) l'appli ne consulte **jamais** le registre serveur — le contrôle 5 bis ne prouve rien dans ce mode (certain, lu dans `next-emission.js`). Pour que l'essai soit probant : Paramètres › Entreprise › un **SIRET fictif** de 14 chiffres (par ex. `12345678900012`) si la copie n'en a pas, puis Paramètres › carte « Facturation réelle » › **Démarrer** (date du jour). Les `F-…` émis vont dans le registre de la base **TEST**, jamais dans le réel. **Interdit, sans exception : aucune clé Super PDP réelle sur la copie** (ni dans Paramètres, ni ailleurs) ; la copie reste en bac à sable Super PDP ou sans Super PDP.
- **Fin de l'essai** : supprime l'icône sur le téléphone et le site hébergé ; la base TEST peut garder les données ou être vidée (Outils de la copie, ou SQL `delete from public.climpilot_state;` sur le projet TEST seulement).

---

## Partie A — Mise en production de l'appli seule

### A1. AVANT (10 min)
1. **Appareils synchronisés** : PC puis téléphone, ouvre ClimPilot, attends que la synchro soit au repos (pas de « modifications en attente »). Un appareil resté hors ligne longtemps : l'ouvrir d'abord et le laisser se synchroniser.
2. **Sauvegarde manuelle** : Outils › **⤓ Sauvegarde** → fichier gardé hors du téléphone (PC + clé/cloud).
3. **Sauvegarde serveur** (SQL Editor du projet **RÉEL**, nouvelle requête) :
   ```sql
   select public.cp_backup_row(user_id, data, 'avant-mise-en-production-M0') from public.climpilot_state;
   select id, raison, created_at, nb_devis, nb_clients, nb_dep, nb_loc from public.climpilot_backups order by id desc limit 3;
   ```
   Attendu : une ligne `avant-mise-en-production-M0` datée de maintenant. **Note l'`id`.** Gardée 120 jours (règle existante).
4. **Liste de contrôle A3, colonne ESSAI** : faite et verte sur la copie d'essai. Sinon, on ne passe pas à A2.
5. Facultatif mais conseillé : protection de `main` (GitHub › Settings › Branches › « Require status checks » › le travail **« batterie complète »**, pas « rapport — … » : fusion interdite si tests rouges) — REFONTE-PLAN P0, M3 C9.

### A2. FUSION dans `main` (= publication GitHub Pages, sur tous tes appareils)
1. Demande de fusion **#4** `fusion/avant-refonte → main` (brouillon) : « Ready for review » puis « Merge » en **merge commit** (pas squash, pour garder l'historique des 5 fusions). Note le numéro du commit de fusion (pour le retour arrière).
2. Attends la publication GitHub Pages (1 à 3 min ; onglet Actions ou Settings › Pages).
3. Sur **chaque** appareil : ouvrir ClimPilot, F5 (ou fermer/rouvrir). Nouveau cache `climpilot-next-1130-production`, l'ancien `…-1100-production` supprimé automatiquement (vérifié en simulation : données conservées, ouverture hors ligne OK).
4. #2 et #3 (1.11, 1.12) sont contenues dans #4 : c'est **toi** qui les fermes ensuite.

### A3. LISTE DE CONTRÔLE — la même, deux fois : **ESSAI** (copie, base de TEST, avant A2) puis **PROD** (vraie appli, après A2)
Sur l'ESSAI : les « données existantes » sont celles importées (0.4) et le compte est celui du TEST ; la facturation réelle y est démarrée (base TEST, 0.4) pour les contrôles 5 bis et 5 ter. En PROD : factures et avoirs **uniquement en mode démonstration** (`TEST-…`), jamais une vraie ; 5 bis « sans objet » en PROD. Si un contrôle échoue : **n'insiste pas**, note ce que tu as vu ; en ESSAI → on corrige avant A2 ; en PROD → A4.

| # | Contrôle (téléphone **et** PC) | Attendu | ESSAI | PROD |
|---|---|---|:-:|:-:|
| 1 | Ouverture avec les données existantes | mêmes clients, devis, factures, locations ; aucun bandeau rouge d'erreur (en ESSAI, seul le bandeau « VERSION D'ESSAI ») | ☐ | ☐ |
| 2 | Petit texte sous le logo « ClimPilot » (en-tête) | « ClimPilot Next 1.13.0 … » (version unique depuis la 1.13.0 : `VERSION`, `NX_VERSION`, cache `1130` alignés — P2 du 25/10) | ☐ | ☐ |
| 3 | Ouvrir un **ancien** devis (d'avant 1.12) | mêmes montants qu'avant, au centime | ☐ | ☐ |
| 4 | Créer un devis (nature au choix), l'enregistrer | numéro `DV-…`, totaux cohérents, visible sur l'autre appareil après synchro | ☐ | ☐ |
| 5 | Émettre une facture de **TEST** (mode démonstration) | `TEST-F-2026-NNN` qui **suit** le dernier, sans trou ni doublon | ☐ | ☐ |
| 5 bis | **Acompte sur le PC, solde sur le téléphone « en ligne mais pas à jour »** (protocole M3 C4 ; **hypothèse** : non éprouvé sur un vrai appareil). **Préalable** : facturation réelle **démarrée** (sur l'ESSAI : copie, base de TEST, SIRET fictif, voir 0.4 ; en PROD : ce contrôle ne se fait **pas** tant que la facturation réelle n'est pas démarrée, le registre n'étant pas consulté en démonstration — en PROD, cocher « sans objet »). Dans l'ordre : ① sur le téléphone, ouvre le devis et **commence à taper une note sans valider** (les mises à jour reçues attendent alors le prochain changement d'écran) ; ② sur le PC, facture l'**acompte** du même devis ; ③ attends **1 minute** ; ④ sur le téléphone, clique « Facturer le solde » | au ④ : message « Une facture d'acompte a été émise… depuis un autre appareil… Rien n'a été émis », **aucune** nouvelle facture. Au **2e clic** : solde = total − acompte, un seul `F-` de solde (dans le registre de la base TEST). Si le téléphone émet un solde au ④ (ou un solde sans l'acompte déduit) : **arrête l'essai et note les numéros** — c'est le cas à risque M3 C1 (contrôle demandé par le compte rendu § 4) | ☐ | ☐ |
| 5 ter | **Téléphone en mode avion**, « Facturer le solde » d'un devis, puis remets le réseau et attends la synchro | « Facture NON émise », rien de plus ; après le retour du réseau, **aucune** facture n'a été émise par le téléphone. Ce cas ne teste **que** le hors ligne : il ne parcourt pas le chemin « en ligne mais pas à jour » du 5 bis (M3 C4) | ☐ | ☐ |
| 6 | Synchro entre deux appareils | modification sur le PC visible sur le téléphone, et inversement ; aucune « modification en attente » qui reste | ☐ | ☐ |
| 7 | Mode avion, rouvrir l'appli | elle s'ouvre, les données sont là, l'écran Planning répond | ☐ | ☐ |
| 8 | Signature en ligne d'un devis de test (ESSAI : la fonction `signature` 1.10 est déployée sur TEST depuis le 05/10) | lien ouvert sur le téléphone, signature enregistrée | ☐ | ☐ |
| 9 | Planning : planifier deux chantiers le même matin | avertissement « même moment » ; après confirmation, carte bordée de rouge | ☐ | ☐ |
| 10 | Ma journée : cartes Messages et Tournée | présentes ; sur le téléphone, le bouton « 🎙️ Assistant » ne recouvre **aucun** bouton d'une fenêtre (bug corrigé en M0) | ☐ | ☐ |
| 11 | Avoir partiel sur une facture de TEST (téléphone) | bouton « Émettre l'avoir » cliquable, `TEST-AV-…` créé | ☐ | ☐ |
| 12 | Objectifs & feux, suivi Urssaf/comptable : cocher une déclaration | la coche est visible sur l'autre appareil après synchro (clés 1.11/1.12 synchronisées) | ☐ | ☐ |
| 13 | Retour SAV, demande d'avis, relevé bancaire (CSV d'essai), bilan fluides | écrans qui s'ouvrent et enregistrent, sans bandeau rouge | ☐ | ☐ |
| 14 | Recherche Ctrl K / menus Créer et Outils (PC) | actions et écrans trouvés | ☐ | — |

### A4. RETOUR ARRIÈRE (revenir à la 1.10.0) — et ce qui arrive aux données 1.11/1.12
**Ce que j'ai lu et exécuté (certain)** :
- La 1.10 n'envoie au serveur que les clés qu'elle connaît (41 clés). La branche en synchronise **51** : les 10 nouvelles sont `cpnext_objectifs`, `cpnext_objsuivi` (objectifs, déclarations cochées), `cpnext_sav`, `cpnext_avis`, `cpnext_bqvus` (relevé bancaire), `cpnext_flubilan`, `cpnext_adr`, `cpnext_msgs`, `cpnext_pointages`, `cpnext_dernier_export`.
- Le serveur **remplace** l'état entier à chaque envoi (`cp_state_push` : `update … set data = p_data`). Donc **oui : au premier envoi réussi d'un appareil repassé en 1.10, les 10 clés disparaissent de la copie serveur.** Prouvé en simulation : la 1.10 a envoyé 8 clés sans `cpnext_objectifs` ni une clé inconnue, alors que la branche renvoie les deux (`cpGarderAbsentes` : « jamais retirées du serveur »).
- Cet envoi n'a lieu que si l'appareil **modifie quelque chose** (sinon il ne pousse pas) : c'est donc probable dès la première saisie.
- Les **copies locales** ne sont pas touchées : la 1.10 n'efface pas les clés qu'elle ne connaît pas (certain pour la synchro, probable pour le reste de l'appli : aucun nettoyage trouvé). Elles ne sont plus **affichées**, mais restent dans l'appareil et **remontent** au serveur dès que l'appareil repasse en 1.12 (les clés sont alors de nouveau synchronisées).
- Les champs ajoutés **dans** un devis ou une intervention (moment du planning, heures pointées, matériel réservé, acompte du site) restent dans les objets : la 1.10 modifie les devis sur place sans enlever les champs qu'elle ne connaît pas (certain pour `formToDevis`, probable pour les autres écrans).
- Les sauvegardes serveur automatiques (quotidiennes) contiennent l'état **entier**, 1.12 comprise ; la sauvegarde `avant-mise-en-production-M0` de A1, elle, est **d'avant** : elle ne contient aucune donnée 1.12.

**Donc, avant de revenir en arrière, une sauvegarde serveur de plus** (SQL Editor, projet réel) :
```sql
select public.cp_backup_row(user_id, data, 'avant-retour-arriere-1.10') from public.climpilot_state;
```
puis :
1. **Appli** : sur GitHub, « Revert » sur la demande #4 (ou `git revert -m 1 <commit de fusion>` sur `main`) → republie la 1.10.0 (`1c91cca`). F5 sur chaque appareil : le service worker 1.10 reprend la main et supprime le cache 1130.
2. Les données saisies entre-temps restent ; les écrans 1.11/1.12 disparaissent, leurs données restent dans chaque appareil et dans la sauvegarde `avant-retour-arriere-1.10` (120 jours). Au retour en 1.12 plus tard, elles reviennent d'elles-mêmes depuis les appareils ; sinon, restaure cette sauvegarde (Outils › « Sauvegardes cloud » › Restaurer — depuis un seul appareil, les autres fermés, puis rouvre-les : la restauration écrase l'état serveur, R11 du plan).
3. **Données perdues ?** Seulement si quelque chose a été cassé : restaure `avant-mise-en-production-M0` (A1) de la même façon ; tu perds alors ce qui a été saisi depuis.
4. Serveur : rien à faire pour la partie A (aucune migration n'a été appliquée).
5. **Parade M3 C11** (probable) : un appareil qui **revient en version récente avec des modifications pas encore envoyées** fusionne avec une base serveur qui n'a plus les 10 clés : sa copie locale, peut-être ancienne, peut l'emporter sur la version plus récente du serveur. Donc, sur chaque appareil qui revient (après un retour arrière **ou** après être resté longtemps fermé) : **ouvre l'appli et laisse la synchro finir avant de saisir quoi que ce soit** (attendre qu'il n'y ait plus de « modifications en attente »). Même règle qu'en A1-1. Rappel (certain) : tout appareil resté en 1.10 après la mise en production retire aussi les 10 clés du serveur à sa 1re modification — d'où le F5 sur **chaque** appareil en A2-3.

---

## Partie B — PLUS TARD : migration + fonction `agenda` (au moment de brancher le site « Réserver » et Google Agenda)
Tu as décidé de **ne pas** la déployer maintenant. L'appli fonctionne sans ; le jour venu, dans cet ordre, **TEST d'abord**.

### B1. Migration SQL (une seule : table `climpilot_busy` + 2 fonctions ; aucune donnée client, seulement des dates et deux cases)
Source : `supabase/migrations/20261020120000_agenda.sql` (rejouable).
- **Sur ClimPilot-TEST** (la première fois) : vérifie « ClimPilot-TEST » dans l'adresse, crée le marqueur :
  ```sql
  create table public.climpilot_marqueur_test (note text);
  ```
  puis colle **tout** `tests/supabase-test/3-agenda-TEST.sql` (verrou + migration + 6 contrôles). Attendu : 6 lignes « OK ». Collé par erreur dans le réel : « STOP », rien modifié (éprouvé sur PostgreSQL local).
- **Sur le RÉEL** (après l'essai) : colle `supabase/migrations/20261020120000_agenda.sql`, puis :
  ```sql
  select 'table' as c, to_regclass('public.climpilot_busy') is not null as ok
  union all select 'cp_busy_appli', to_regprocedure('public.cp_busy_appli(date,date,jsonb)') is not null
  union all select 'cp_busy_remplacer', to_regprocedure('public.cp_busy_remplacer(uuid,text,date,date,jsonb)') is not null
  union all select 'anon bloqué', not has_function_privilege('anon','public.cp_busy_appli(date,date,jsonb)','execute');
  ```
  Attendu : 4 lignes `true`. Dès lors, l'appli envoie ses demi-journées occupées toute seule.
- **Retour arrière** : `tests/supabase-test/3-agenda-retour-arriere.sql` (table + 2 fonctions, rien d'autre ; 3 « OK »). Perte : les demi-journées déjà envoyées (dates, aucun nom), renvoyées ensuite par l'appli.

### B2. Fonction serveur `agenda` (pour le site et le script Google ; l'appli ne l'appelle pas)
Source : `supabase/functions/agenda/index.ts`, à déployer **sans vérification JWT** (comme `signature`).
- Tableau de bord › Edge Functions › nouvelle fonction `agenda` › coller le fichier › décocher « Verify JWT » (hypothèse sur le libellé) ; ou `supabase functions deploy agenda --project-ref <réf> --no-verify-jwt`.
- Secrets (Edge Functions › Secrets), **valeurs à toi, jamais dans le dépôt** : `OWNER_USER_ID` (Authentication › Users › ton identifiant), `AGENDA_CLE` (aléatoire, ≥ 24 caractères), `SITE_ORIGINS` (adresses du site, virgules), `AGENDA_FERME` (facultatif). `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.
- **Test de vie** : `https://<réf>.supabase.co/functions/v1/agenda?sante=1` → `{"ok":true}`. `{"ok":false,"erreur":"config"}` = un secret manque ; `{"ok":false}` (503) = migration B1 absente.
- Test public : `…/agenda?creneaux=1` → `{"ok":true,"jours":[…]}`.
- Ensuite : script Google puis site (`docs/AGENDA.md`, étapes 3 et 4).
- **Retour arrière** : supprimer la fonction `agenda`. L'appli n'en dépend pas.

### B3. Contrôle après B1 (réel)
`select jour, matin, apresmidi, source from public.climpilot_busy order by jour;` → tes demi-journées planifiées, source `climpilot`, **aucun nom**.
