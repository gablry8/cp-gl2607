# ClimPilot — Mission COMPTE : mot de passe, double authentification, appareils — dossier de mission

> Rédigé le 09/11/2026 par Claude (session Claude Code, mission COMPTE-DOSSIER) pour Gabriel Leroy. **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-compte`, partie de `main` = `6a89e60`.
> Mission définie le 27/10, exception au gel décidée par Gab (décision 20 de la fiche du 26/10), **limitée à 4 points** : (1) écran « Mon compte » et changement du mot de passe ; (2) « Déconnecter mes autres appareils » ; (3) double authentification par application (TOTP) ; (4) texte honnête du code PIN local. À coder par Fable 5.1 **après la fusion de S**, branche `correctif/compte`.
> Numéros de ligne lus sur `main` (`6a89e60`). La mission S (`correctif/s-securite`, en cours en même temps) modifie `index.html` : l'exécutant retrouve tout par le **nom des fonctions**.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project (ni la fiche du 26/10, ni le dossier de S). La copie `claude/ClimPilot-COMPTE-dossier.md` reste à faire.
> **Documentation Supabase** : lue le 09/11/2026 par l'outil officiel de recherche dans la documentation Supabase (texte des pages) ; `supabase.com` n'a pas été ouvert directement. Liste des pages au § 2.5.
> Certitude : **certain** (lu dans le code ou la documentation, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. Réponds aux **11 questions du § 7** (oui / non suffit). Les 3 qui comptent le plus : Q1 (code exigé par le serveur pour les factures), Q2 (2e moyen de secours), Q3 (durée de session).
2. À savoir dès maintenant (certain) : le lien **« Déconnexion »** déconnecte **tous** tes appareils, pas seulement celui-ci (§ 1.3). Ne t'en sers pas sur le PC si ton téléphone doit rester connecté sur un chantier.
3. À savoir dès maintenant (exécuté, serveur injoignable) : l'appli ouverte **sans réseau** plus d'une heure après sa dernière utilisation en ligne affiche l'écran de connexion, bloquant tant que le réseau ne revient pas (§ 1.4 b). Ouvre-la une fois avec du réseau avant de descendre en cave.
4. COMPTE se lance **après la fusion de S** : même fichier `index.html`, et le QR code dépend de la politique de sécurité du navigateur que pose S (§ 6.1, R8).
5. Après le code : réglages du tableau de bord sur **TEST** (§ 2.4), essai § 6.4, script TEST si Q1 = oui, mêmes réglages sur le **réel**, fusion, F5 sur chaque appareil le même jour.
6. Ancienne branche `claude/login-password-issue-f7cidd` : elle touche la même fonction `doLogin`. Décide de son sort (Q11).
7. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Ce qui existe (lecture du code de `main`)

### 1.1 Connexion (`index.html`)

| Quoi | Où | Ce qui se passe | Certitude |
|---|---|---|---|
| Client Supabase | `initCloud` l. 4379-4386 ; bibliothèque `vendor/supabase-js-2.117.3.umd.js` (l. 17, avec empreinte `integrity`) | `createClient(SUPA_URL, SUPA_KEY)` **sans options** : valeurs par défaut de la bibliothèque, donc session gardée dans le stockage du navigateur, jeton renouvelé automatiquement, flux « implicit » (lu dans la bibliothèque, § 2.1) | certain |
| Écran de connexion | `#loginScreen` l. 892-904 ; `showLogin` l. 4335 | Plein écran (au-dessus de l'appli), e-mail + mot de passe + « Se connecter ». **Aucune autre sortie** : pas de « continuer sans connexion ». Pied : « Mot de passe oublié : réinitialise-le au même endroit » (dans Supabase) | certain |
| Se connecter | `doLogin` l. 4336-4352 | `signInWithPassword` ; messages distincts : identifiants faux, e-mail non confirmé, serveur injoignable, autre erreur (code HTTP + message). Réussite : `SESS = data.session`, écran masqué, `afterLogin()` | certain |
| Après la connexion | `afterLogin` l. 4366-4376 | Affiche l'adresse du compte dans le pied du menu (`#cloudUser`), lit l'état (`pullState`), vérification légère chaque minute et au retour sur la fenêtre, envoi à la reconnexion et à la sortie de l'appli | certain |
| Changer le mot de passe, double authentification, autres appareils | — | **Rien** dans l'appli. Aucun appel à `updateUser`, `reauthenticate`, `auth.mfa` ni `onAuthStateChange` dans `index.html`, les 45 `next-*.js`, `signer.html`, `sw.js` (recherche) | certain |

### 1.2 La session dans l'appli : une variable `SESS`, posée deux fois, jamais remise à jour

- `SESS` est déclarée l. 996. Elle n'est écrite qu'à **deux** endroits : `doLogin` (l. 4348) et `initCloud` (l. 4384). Elle n'est **jamais** mise à jour (renouvellement du jeton) ni remise à `null` (session fermée) : l'appli n'écoute pas `onAuthStateChange`. Certain (recherche de `SESS=`).
- Le jeton lui-même est géré par la bibliothèque, pas par `SESS` : chaque requête prend le jeton courant dans le stockage du navigateur. Si la session a disparu, la bibliothèque envoie la **clé publique du projet** à la place (`_getAccessToken` : `… ?? this.supabaseKey`), donc la requête part comme un **visiteur non connecté**. Certain (lu dans la bibliothèque).
- Le jeton n'est **pas** dans les sauvegardes : `nxBackupKeys` ne prend que les clés `cp2_` et `cpnext_`, et la bibliothèque range la session sous une clé `sb-…-auth-token`. Le service worker ne touche pas les requêtes vers Supabase (autre origine, `sw.js` l. 6). Certain.

### 1.3 Déconnexion : elle ferme **tous** les appareils, contrairement à son message

- Lien « Déconnexion » dans le pied du menu (l. 181-184), sur PC ; sur téléphone, le même pied apparaît dans le menu glissant (`next-theme.css` l. 157 réaffiche `.side .foot`). Probable pour le téléphone (CSS lu, non exécuté).
- `cloudLogout` (l. 4377-4378) : question « Se déconnecter du cloud sur cet appareil ? (les données locales restent) », puis `sb.auth.signOut()` **sans argument**, puis rechargement.
- Dans supabase-js 2.117.3, `signOut()` sans argument vaut `{scope:'global'}` (lu : `async signOut(e={scope:'global'})`, portées permises `global`, `local`, `others`). La documentation le confirme : « the default scope is 'global'. This signs the user out of every device they are currently signed in on ». **Le message dit « sur cet appareil », le geste ferme toutes les sessions.** Certain (code + doc).
- Effet sur les autres appareils : leur jeton d'accès reste valable jusqu'à son expiration (« Access Tokens of revoked sessions remain valid until their expiry time », doc), soit 1 h au plus avec le réglage par défaut ; ensuite leur renouvellement est refusé et la session disparaît (§ 1.4). Certain (doc) ; durée réelle sur ton projet : non vérifiée (réglage du tableau de bord).

### 1.4 Quand la session se termine ou que le jeton expire

**a) Session fermée par le serveur, appli ouverte** (déconnexion d'un autre appareil, et demain : mot de passe changé, double authentification activée ailleurs).
1. La bibliothèque tente de renouveler le jeton (vérification toutes les 30 s, renouvellement à partir de 90 s avant l'expiration : `M = 30 000 ms`, seuil de 3 vérifications dans `_autoRefreshTokenTick`). Le serveur refuse : erreur **non réessayable**. Tant que le jeton d'accès est encore valable, la session est gardée ; dès qu'il a expiré, la bibliothèque **efface** la session du stockage et émet `SIGNED_OUT` (`_callRefreshToken`, `_removeSession`). Certain (lu).
2. L'appli n'écoute pas cet événement : `SESS` reste posée, l'étiquette ne change pas tout de suite. Certain.
3. Les requêtes suivantes partent comme visiteur non connecté (§ 1.2). `pullState` : lecture de l'état refusée (droits retirés au visiteur par P6) ou vide (si P6 n'est pas passée sur le réel) ; vide + données locales → `pushState` ; `cp_state_push` est refusée au visiteur (`20261002120000_documents_emis.sql` l. 305-306) → « ⚠ échec synchro — nouvel essai auto », toutes les 30 s, sans fin. **Rien n'est écrasé sur le serveur.** Probable (lu, non exécuté).
4. Les modifications faites ensuite restent marquées « à envoyer » (`markDirty` l. 4006 pose `cp2_dirty` même sans session) : elles partiront après une reconnexion. Certain (lu).
5. Au prochain lancement : `initCloud` ne trouve pas de session → écran de connexion. Certain (lu).

En clair : aujourd'hui, une session fermée ne se voit pas ; l'appareil affiche « échec synchro » jusqu'au prochain lancement, puis l'écran de connexion.

**b) Démarrage sans réseau, jeton expiré** (téléphone resté plus d'une heure sans servir, ouvert en cave).
- `initCloud` appelle `getSession()`. Le jeton est expiré : la bibliothèque tente de le renouveler, réessaie pendant **30 s au plus** (erreur réseau réessayable), garde la session dans le stockage (elle n'est pas effacée), mais **rend `session: null`** avec une erreur réseau (`__loadSession`). `initCloud` ignore l'erreur et affiche l'écran de connexion. Certain (lu).
- **Exécuté ici** (script jetable hors dépôt ; appli de `6a89e60`, **vrai** supabase-js 2.117.3 embarqué ; Playwright 1.56.1, Chromium 141 ; session factice au jeton expiré ; toutes les requêtes vers Supabase refusées) : l'écran de connexion apparaît après **≈ 26 s** (une mesure), étiquette « non connecté », session **toujours** dans le stockage, 8 requêtes refusées. Même essai avec un jeton encore valable : pas d'écran de connexion. Certain pour un serveur injoignable ; probable pour le mode avion (non essayé).
- Conséquence : l'écran de connexion couvre toute l'appli et la connexion demande le réseau. **Les données de l'appareil sont là, mais inaccessibles** jusqu'au retour du réseau. Avec la double authentification, ce serait pareil, avec un code en plus. Certain (lu + exécuté).
- Avec un jeton encore valable et sans réseau, l'appli s'ouvre normalement (exécuté) et la session survit aux échecs de renouvellement réseau (erreur réessayable : session gardée). Certain.

**c) Durée d'une session.** Par défaut, une session Supabase dure indéfiniment ; le jeton d'accès dure 1 h et se renouvelle. Limiter la durée (« time-box », inactivité, une seule session) est réservé au plan **Pro** (doc « User sessions » : « This feature is only available on Pro Plans and up »). Sur le plan gratuit, une session ne se termine donc que par un geste (déconnexion, changement de mot de passe « selon la configuration », double authentification activée) ou une anomalie de renouvellement. Certain (doc).

### 1.5 Les couches qui lisent la session : 9 sur 45

Recherche de `SESS` dans les 45 `next-*.js` (comptés) :

| Couche | Usage | Certitude |
|---|---|---|
| `next-addons.js` l. 358 | pastille « Sauvegarde » (connecté ou non) | certain |
| `next-assistant.js` l. 38, 628 | « connecté ? » ; `SESS.user.id` pour écrire une copie dans `climpilot_backups` | certain |
| `next-catalogue.js` l. 82, `next-cerfa.js` l. 258, `next-planning.js` l. 19, `next-superpdp.js` l. 48 | « connecté ? » (`sb && SESS && SESS.user`) | certain |
| `next-emission.js` l. 58, 345 | « connecté ? » ; `SESS.user.id` pour lire la date de l'état | certain |
| `next-fiabilite.js` l. 51 | « connecté ? » (`!!SESS`) | certain |
| `next-signature.js` l. 22, 49 | « connecté ? » ; `SESS.user.id` pour créer un lien de signature | certain |

- **Aucune couche n'appelle `sb.auth`.** Toutes suivent la variable globale `SESS`. Si COMPTE la tient à jour (nouveau jeton, session fermée), les 9 couches suivent sans changement. Certain (recherche).
- Avec `SESS = null`, chaque couche se comporte comme « pas connecté » ; par exemple l'émission en mode réel répond « connecte le cloud (Paramètres) » (`next-emission.js` l. 75 et 84). Probable (lu, non exécuté).

### 1.6 Le code PIN local (carte « 🔐 Sécurité — code d'accès »)

| Quoi | Où | Ce qui se passe | Certitude |
|---|---|---|---|
| Carte | `#v-params` l. 813-826 | Texte : « Le code protège l'appli des regards (PC prêté, écran ouvert au dépôt). […] ce n'est **pas** un chiffrement — tes données restent uniquement sur cet ordinateur, la vraie protection c'est la sauvegarde JSON régulière + le verrouillage de ta session Windows. » | certain |
| Code | `pinSet` l. 3155, `pinHash` l. 3143 | 4 à 8 chiffres ; gardé sous une forme transformée dans `cp2_pin`, sur **cet appareil** seulement (absente de `SYNC_KEYS` l. 997, exclue des sauvegardes par `NX_BK_SKIP` l. 2761, ce que vérifie la suite C) | certain |
| Verrouillage | `resetIdle` / `lockApp` l. 3146-3149 ; au démarrage l. 4396 | après 10 min sans geste, et à chaque ouverture ; écran `#lockScreen` (l. 969) au-dessus de tout, y compris de l'écran de connexion | certain |
| « Code oublié ? » | `pinForgot` l. 3153 | taper `EFFACER` retire le code, sans autre preuve ; les données restent | certain |

**Ce qui est faux ou incomplet dans le texte actuel** (certain) :
- « tes données restent uniquement sur cet ordinateur » : faux depuis la synchronisation (elles sont aussi sur le serveur et sur tes autres appareils) ;
- « session Windows » : l'appli sert aussi sur iPhone ;
- il ne dit pas que le code ne vaut que sur cet appareil, que « Code oublié ? » le retire sans preuve, ni que la connexion au cloud reste ouverte derrière le code.

### 1.7 Autres constats utiles à l'exécutant

- **Garde des Paramètres** (`cpParamsEcoute` l. 1264) : seuls les champs dont l'identifiant commence par `pe_`, `pg_`, `pf_`, `pm_`, `pz_`, `pb_`, `pt_`, `pa_`, `pmg_`, `pd_`, `pp_`, `pms_` déclenchent « Paramètres modifiés et non enregistrés ». Les champs de « Mon compte » doivent prendre un autre préfixe (proposé : `acc_`). Certain.
- **Saisie en cours** (`cpSaisieEnCours` l. 4258, `cpChampFiltre` l. 4245) : un champ tapé et différent de sa valeur d'affichage retient les mises à jour reçues jusqu'au changement d'écran. La carte « Mon compte » ne contient rien à enregistrer dans l'état : lui poser `data-cp-filtre` (comme l'écran de connexion). Certain (lu) ; choix proposé.
- **Suite A** (`tests/suiteA.mjs` l. 50-62) clique jusqu'à 70 boutons de chaque écran, Paramètres compris, sans cloud (bibliothèque remplacée), en sautant ceux dont le texte contient « déconn », « logout », « signOut »… Les nouveaux boutons (« Changer le mot de passe », « Activer ») doivent répondre sans erreur quand le cloud est absent. Certain.
- **Connexion avec un mot de passe que le serveur juge faible** : la bibliothèque rend quand même la session, avec un champ `weakPassword` (`signInWithPassword` lu). Relever la longueur minimale dans le tableau de bord **ne bloque donc pas** la connexion avec l'ancien mot de passe. Certain (lu) ; conforme à la doc « Password security » (FAQ).
- **Ancienne branche** `claude/login-password-issue-f7cidd` (`ba4570d`, 28/08, +1 / −144 sur `main`) : messages d'erreur de connexion, « Mot de passe oublié ? » par e-mail, diagnostic. Elle réécrit `doLogin` et `showLogin`. Le « mot de passe oublié par e-mail » est **hors des 4 points** de COMPTE. Certain (lu : `git show`).

## 2. Ce que supabase-js 2.117.3 embarqué offre réellement, et le tableau de bord

### 2.1 Méthode

Le fichier `vendor/supabase-js-2.117.3.umd.js` (minifié, 10 lignes) a été chargé dans Node 22 par un script jetable **hors dépôt**, avec un client factice (adresse locale, aucun réseau). Le texte de chaque méthode a été relu (`toString()`). Rien d'une autre version ni de la documentation n'a servi pour ce § 2.2. Certain (exécuté).

Options par défaut lues dans le fichier : `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: true`, `flowType: 'implicit'`, `lockAcquireTimeout: 5000`, `experimental: {}`.

### 2.2 Les appels

Forme commune (certain, lu) : chaque appel **rend** `{data, error}` et ne rejette pas. Erreur du serveur = `AuthApiError` avec `status` (HTTP) et `code` (lu dans le corps de la réponse : `code`, ou `error_code` pour une ancienne version d'API). Coupure réseau = `AuthRetryableFetchError`, `status: 0` (même piège que pour les requêtes de données, CLAUDE.md § 6). `weak_password` = `AuthWeakPasswordError` avec `reasons`. `session_not_found` = `AuthSessionMissingError`.

| Appel | Requête envoyée | Réponse utile | Notes (certain, lu) |
|---|---|---|---|
| `auth.updateUser({password, nonce?, current_password?})` | `PUT /user` avec le jeton de la session | `{data:{user}}` ; émet `USER_UPDATED` | Le corps envoyé est **l'objet passé, tel quel** : `nonce` et `current_password` partent s'ils sont fournis. Sans session : `AuthSessionMissingError` |
| `auth.reauthenticate()` | `GET /reauthenticate` | `{data:{user:null, session:null}, error}` | Demande au serveur d'envoyer un code (doc : par e-mail ou SMS) |
| `auth.signOut({scope})` | `POST /logout?scope=…` | `{error}` | Défaut **`global`**. `local` et `global` effacent la session de cet appareil et émettent `SIGNED_OUT` ; **`others` garde la session de cet appareil** et n'émet rien. Erreurs 401, 403, 404 ignorées |
| `auth.mfa.enroll({factorType:'totp', friendlyName, issuer})` | `POST /factors` | `{data:{id, type, friendly_name, totp:{qr_code, secret, uri}}}` | Le QR code arrive en SVG, déjà préfixé par la bibliothèque : `data:image/svg+xml;utf-8,…` (à poser dans une balise `<img>`) |
| `auth.mfa.challenge({factorId})` | `POST /factors/{id}/challenge` | `{data:{id, …}}` | id du défi, à passer à `verify` |
| `auth.mfa.verify({factorId, challengeId, code})` | `POST /factors/{id}/verify` | nouvelle session (jetons) **enregistrée** ; émet `MFA_CHALLENGE_VERIFIED` | Sert à l'inscription **et** à la connexion |
| `auth.mfa.challengeAndVerify({factorId, code})` | les deux | idem | raccourci |
| `auth.mfa.unenroll({factorId})` | `DELETE /factors/{id}` | `{data, error}` | |
| `auth.mfa.listFactors()` | passe par `getUser()` → **réseau** | `{data:{all, totp, phone, webauthn, recovery_code}}` | `totp` = facteurs **vérifiés** seulement ; `all` = tous, y compris non vérifiés |
| `auth.mfa.getAuthenticatorAssuranceLevel()` | **aucune requête** sans argument (lit le jeton et `session.user.factors` en local) | `{data:{currentLevel, nextLevel, currentAuthenticationMethods}}` | Marche hors ligne si le jeton est valable. Avec un jeton en argument, appelle `getUser` (réseau) |
| `auth.onAuthStateChange(cb)` | — | événements `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, `MFA_CHALLENGE_VERIFIED` | |
| `auth.refreshSession()` | `POST /token?grant_type=refresh_token` | nouvelle session | à appeler après un retrait de facteur (doc, § 2.3) |
| `auth.mfa.recoveryCodes.*` (`generate`, `verify`…) | `/factors/recovery-codes…` | — | **Expérimental, désactivé par défaut** : lève une erreur sauf si le client est créé avec `auth:{experimental:{recoveryCodes:true}}` (§ 2.6) |
| `auth.admin.mfa.deleteFactor` | — | — | Réservé à une clé de service : **jamais** dans le navigateur |

### 2.3 Ce que dit la documentation (pages lues le 09/11/2026)

- **TOTP** : « TOTP MFA API is free to use and is enabled on all Supabase projects by default. » Code valable 30 s, avec une tolérance d'un intervalle de décalage d'horloge. Certain (doc).
- **Inscription** : « Upon verifying a factor, all other sessions are logged out and the current session's authenticator level is promoted to `aal2`. » → **activer la double authentification déconnecte tes autres appareils.** Certain (doc).
- **Retrait** : un facteur ne se retire qu'avec une session `aal2` ; le niveau ne redescend qu'au renouvellement suivant, ou tout de suite avec `refreshSession()`. Certain (doc).
- **Niveaux** : `aal1` = mot de passe seul ; `aal2` = mot de passe + code. Inscrit dans le jeton (`aal`) ; un jeton sans `aal` vaut `aal1`. `currentLevel aal1` + `nextLevel aal2` = un facteur existe mais le code n'a pas été donné dans cette session. Certain (doc).
- **Côté serveur** : la documentation recommande d'appliquer aussi les règles de double authentification dans la base et les API (§ 4). Contrôle côté serveur : mission FACT (décision Q1 du 11/11/2026). Certain (doc).
- **Nombre de facteurs** : jusqu'à 10 par compte (« users can enroll multiple factors, with an upper limit of 10 »). Certain (doc).
- **Changement de mot de passe** (page « Password security ») :
  - option « Require reauthentication when changing password » : sans connexion récente (session créée il y a moins de 24 h), un code (`nonce`) est envoyé et doit accompagner le nouveau mot de passe ; il se demande par `reauthenticate()` ;
  - option « Require current password when changing password » : `updateUser({current_password, password})` ;
  - longueur minimale et caractères exigés réglables ; « Anything less than 8 characters is not recommended » ;
  - protection contre les mots de passe divulgués : « available on the Pro Plan and above ».
  Certain (doc). Le modèle d'e-mail « reauthentication » contient un code à 6 chiffres (page des modèles d'e-mail, développement local) : probable pour le projet hébergé.
- **Sessions** : par défaut sans fin, jeton de 1 h ; limitation réservée au plan Pro ; une session se termine aussi quand « the user changes their password or performs a security sensitive action » (« depending on configuration » : la page ne dit pas **quelles** sessions ; à vérifier sur TEST : hypothèse).
- **Codes d'erreur** (référence des erreurs Auth) : `reauthentication_needed`, `reauthentication_not_valid`, `same_password`, `weak_password`, `insufficient_aal`, `mfa_verification_failed` (« wrong TOTP code »), `mfa_challenge_expired`, `mfa_totp_enroll_not_enabled`, `mfa_totp_verify_not_enabled`, `mfa_factor_not_found`, `too_many_enrolled_mfa_factors`, `over_request_rate_limit`, `session_not_found`, `refresh_token_not_found`. Le code renvoyé quand le mot de passe actuel manque ou est faux n'a **pas** été trouvé dans la référence (hypothèse : à relever sur TEST). La bibliothèque ne liste aucun de ces codes (elle les transmet) : l'appli lit `error.code`. Certain (doc + lu).

### 2.4 Réglages du tableau de bord (à faire sur TEST, puis sur le réel)

| Réglage (nom dans la doc) | Valeur par défaut d'après la doc | Proposé | Plan |
|---|---|---|---|
| MFA › TOTP : inscription et vérification | activées | **activées** (vérifier) | gratuit |
| Email › longueur minimale du mot de passe | non lue | **12** (Q5) | gratuit |
| Email › caractères exigés | non lue | inchangé (ta décision) | gratuit |
| « Require current password when changing password » | non lue | **oui** (Q4) | gratuit (hypothèse) |
| « Require reauthentication when changing password » (« secure password change ») | non lue | **non** (Q4) : un code par e-mail ; l'envoi d'e-mails du serveur par défaut est limité (hypothèse, non lu) | gratuit (hypothèse) |
| Protection des mots de passe divulgués | — | impossible avant le plan Pro (déjà noté dans `docs/REPRISE.md`) | Pro |
| Sessions : durée max., inactivité, une seule session | sans limite | impossible avant le plan Pro ; à décider en juin 2027 (Q3) | Pro |
| Durée du jeton d'accès (JWT) | 1 h ; la doc déconseille plus d'1 h et moins de 5 min | **1 h, inchangée** (Q3) | gratuit |
| Notifications de sécurité par e-mail (mot de passe changé, facteur ajouté / retiré) | désactivées tant qu'on ne les active pas (doc, développement local) | **oui** si le tableau de bord les propose (Q9 ; hypothèse) | non lu |

Les noms exacts des menus du tableau de bord n'ont pas été vérifiés (doc seulement). L'exécutant les relève sur TEST et les écrit dans le compte rendu.

### 2.5 Pages de la documentation lues (09/11/2026, outil officiel de recherche)

`guides/auth/auth-mfa` ; `guides/auth/auth-mfa/totp` ; `reference/javascript/auth-mfa` ; `reference/javascript/auth-mfa-enroll` ; `guides/auth/password-security` ; `reference/javascript/auth-updateuser` ; `guides/auth/signout` ; `reference/javascript/auth-signout` ; `guides/auth/sessions` ; `guides/auth/jwt-fields` ; `guides/platform/multi-factor-authentication` (compte Supabase, pas l'appli) ; `guides/local-development/customizing-email-templates` ; référence des codes d'erreur Auth.

### 2.6 Contradiction à signaler : les codes de récupération

- La documentation (« Auth MFA », référence JavaScript) : « **Recovery codes are not supported** but users can enroll multiple factors ». La page sur le compte Supabase : « Supabase does not return recovery codes. Instead, we recommend that you register a backup TOTP factor ». Certain (doc).
- Mais supabase-js 2.117.3 contient une API `auth.mfa.recoveryCodes` (générer, vérifier, régénérer, retirer), **expérimentale et désactivée par défaut**. Certain (lu).
- Le serveur hébergé l'accepte-t-il ? Non vérifié. Hypothèse : non, ou pas de façon stable. **Proposition : ne pas l'utiliser** ; le secours passe par un 2e facteur (§ 3.7, Q2). Le prompt de la mission disait « pas de codes de récupération natifs » : c'est exact pour la documentation, pas tout à fait pour la bibliothèque.

## 3. Comportement cible, écran par écran

Principes : rien de ce qui est tapé (mot de passe, code) n'est gardé, ni dans le stockage, ni dans `cpnext_journal`, ni dans un message, ni en console. **Aucune clé nouvelle** dans `SYNC_KEYS` ni dans le stockage. Les noms de facteurs viennent du serveur et s'affichent échappés (fonction d'échappement retenue par S). Code dans `index.html`, en modifiant `doLogin`, `initCloud`, `afterLogin`, `cloudLogout` sur place : **aucune enveloppe** nouvelle (règle 11, suite W).

### 3.1 Carte « 👤 Mon compte » dans Paramètres

- Place : dans `#v-params`, juste **avant** « 🔐 Sécurité — code d'accès » (même bordure). Identifiants `acc_…`, `data-cp-filtre` sur la carte (§ 1.7).
- En tête : « Connecté au cloud : <adresse du compte> » ; ou « Pas connecté au cloud : [Se connecter] ». Hors ligne : « Pas de réseau : ces réglages demandent une connexion. » et boutons grisés.
- Trois blocs : **Mot de passe**, **Appareils**, **Double authentification**.
- Sans cloud (pas de bibliothèque, pas de session) : chaque bouton répond « Connecte-toi au cloud d'abord » sans erreur (suite A).

### 3.2 Changer le mot de passe

Champs : « Mot de passe actuel » (`autocomplete="current-password"`), « Nouveau mot de passe », « Confirme-le » (`autocomplete="new-password"`). Bouton « Changer le mot de passe ».

1. Contrôles **avant** tout appel :
   - moins de 12 caractères (comptés par caractère, `Array.from`) → « Trop court : 12 caractères au moins (tu en as tapé N). Une phrase de 3 ou 4 mots fait l'affaire. »
   - les deux différents → « Les deux nouveaux mots de passe ne sont pas identiques. »
   - nouveau = actuel → « C'est déjà ton mot de passe : choisis-en un autre. »
   - hors ligne → « Pas de réseau : rien n'a changé. Réessaie quand le réseau revient. »
2. Appel `updateUser({password, current_password})` (si Q4 = oui ; sinon `{password}`).
3. Réponses :

| Réponse | Message | Ensuite |
|---|---|---|
| réussite | « ✓ Mot de passe changé. Note-le dans ton gestionnaire de mots de passe. » | proposition du § 3.3 : « Fermer les autres connexions ? » |
| `reauthentication_needed` | « Supabase demande une vérification : un code à 6 chiffres vient d'être envoyé à ton adresse e-mail. » | `reauthenticate()` une fois ; champ « Code reçu par e-mail » ; `updateUser({password, nonce})` |
| `reauthentication_not_valid` | « Code faux ou expiré. [Renvoyer un code] » | |
| `same_password` | comme au point 1 | |
| `weak_password` | « Supabase refuse ce mot de passe : » + raisons traduites (trop court, caractères manquants, déjà divulgué) ; raison inconnue : texte brut | |
| `insufficient_aal` | « Donne d'abord ton code de double authentification. » | écran du code (§ 3.5), puis nouvel essai |
| mot de passe actuel faux (code exact à relever sur TEST) | « Mot de passe actuel incorrect. » | |
| `over_request_rate_limit` ou HTTP 429 | « Trop d'essais : attends quelques minutes. » | |
| coupure (`status: 0`) | « Résultat inconnu : le serveur n'a pas répondu. Si ton ancien mot de passe ne marche plus à la prochaine connexion, c'est le nouveau qui compte. » | |
| autre | « Erreur du serveur (HTTP n) : message » | |

4. Tous les champs sont vidés après chaque réponse.

### 3.3 « Déconnecter mes autres appareils » (et la déconnexion de cet appareil)

- Bouton dans le bloc **Appareils**, et proposé après un changement de mot de passe.
- Confirmation : « Déconnecter tous tes autres appareils (téléphone, autres ordinateurs, autres navigateurs) ? Ils gardent leurs données, mais devront se reconnecter (mot de passe, et code si la double authentification est active). Ce qu'ils n'ont pas encore envoyé partira après leur reconnexion. Effet complet en 1 heure au plus. Cet appareil reste connecté. »
- Annuler → aucun appel. OK → `signOut({scope:'others'})` **une fois**. Réussite : « ✓ Tes autres appareils sont déconnectés (effet complet en 1 heure au plus). » Erreur réseau : « Pas de réponse du serveur : réessaie. »
- Honnêteté : ajouter sous le bouton « Cela coupe l'accès au serveur, pas les données déjà présentes sur un appareil perdu : pour elles, compte sur le verrouillage du téléphone lui-même. »
- **Lien « Déconnexion » du menu** (Q6) : `signOut({scope:'local'})`, ce que son message promet déjà (« sur cet appareil »). Aujourd'hui `global` (§ 1.3).

### 3.4 Double authentification : activer, ajouter un appareil de secours, retirer

**État** (lu en local, sans réseau : `session.user.factors` et `getAuthenticatorAssuranceLevel()`) : « Désactivée » ou « Activée : 1 appareil (« iPhone ») » ; hors ligne : « (dernière information connue) ».

**Activer** (bouton « Activer la double authentification ») :
1. Avant : « Il te faut une application d'authentification sur ton téléphone (celle intégrée à l'iPhone dans Mots de passe, Google Authenticator, 1Password…). Une fois activée, chaque nouvelle connexion demandera ton mot de passe **et** le code à 6 chiffres de l'application. En validant, **tes autres appareils seront déconnectés** (règle de Supabase) : ils devront se reconnecter avec le code. Prévois un moyen de secours (bloc ci-dessous). » [Continuer] [Annuler]
2. Nom de l'appareil (« iPhone » proposé) → nettoyage des facteurs **non vérifiés** laissés par un essai précédent (`listFactors().data.all`, statut non vérifié → `unenroll`) → `enroll({factorType:'totp', friendlyName, issuer:'ClimPilot'})`.
3. Écran :
   - **PC** : QR code (`<img>` avec la valeur rendue), « Scanne ce code avec l'application de ton téléphone » ; dessous, la clé en clair par groupes de 4 avec « Copier » (« si le scan ne marche pas »).
   - **Téléphone** : un téléphone ne peut pas scanner son propre écran. Bouton « Ouvrir dans l'application d'authentification » (lien `uri`, `otpauth://…`) + clé à copier. Que l'iPhone ouvre ce lien dans son gestionnaire de codes : hypothèse, à vérifier à l'essai. **Conseil écrit : activer depuis le PC.**
   - Champ « Code à 6 chiffres affiché par l'application » + [Valider] [Annuler].
4. Valider → `challengeAndVerify`. Réponses :
   - réussite → « ✓ Double authentification activée. Tes autres appareils devront se reconnecter avec le code. Ajoute maintenant un moyen de secours. » ; `SESS` = nouvelle session ;
   - `mfa_verification_failed` → « Code refusé. Vérifie que l'heure du téléphone est réglée automatiquement, puis tape le code affiché **maintenant**. » ;
   - `mfa_challenge_expired` → nouveau défi, sans message ;
   - `mfa_totp_enroll_not_enabled` / `mfa_totp_verify_not_enabled` → « La double authentification est désactivée dans le tableau de bord Supabase. » ;
   - `too_many_enrolled_mfa_factors` → « 10 appareils au plus : retires-en un. »
5. Annuler ou quitter l'écran → `unenroll` du facteur non vérifié (sinon il reste sur le serveur).

**Ajouter un appareil de secours** (si Q2 = oui) : même parcours, autre nom (« Secours »). Faut-il déjà une session `aal2` pour ajouter un 2e facteur ? Hypothèse : oui ; si `insufficient_aal`, écran du code d'abord.

**Retirer** (un bouton par appareil) : confirmation « Retirer « iPhone » ? S'il est le seul, la connexion ne demandera plus de code. » → `unenroll`, puis `refreshSession()` (le niveau redescend tout de suite, doc). Si la session n'est pas `aal2` : écran du code d'abord.

### 3.5 Connexion et démarrage quand la double authentification est active

**Connexion** (`doLogin`) :
1. `signInWithPassword` comme aujourd'hui.
2. `getAuthenticatorAssuranceLevel()` : `currentLevel aal1` et `nextLevel aal2` → **2e étape dans le même écran** : « Code de double authentification (6 chiffres, dans ton application) », [Valider], lien « Je n'ai plus mon téléphone » (texte du § 3.7). Plusieurs appareils : liste pour choisir (le premier par défaut).
3. **`afterLogin()` n'est appelé qu'après le bon code** : aucune lecture ni envoi de l'état avant.
4. Code faux → « Code refusé » ; trop d'essais → message de limite. Le compteur d'essais est celui du serveur (hypothèse : non lu).

**Démarrage** (`initCloud`) :
- session `aal2` en mémoire → comme aujourd'hui, sans réseau pour le savoir ;
- session `aal1` + facteur vérifié (appli fermée pendant la saisie du code) → écran du code ;
- `getSession()` rend une **erreur réseau** (`status: 0`, cas § 1.4 b) → **pas** d'écran de connexion : étiquette « ⌛ hors ligne — connexion au retour du réseau », nouvel essai à l'événement `online` (Q7).

### 3.6 Session fermée pendant l'usage

- Écouter `onAuthStateChange` une seule fois dans `initCloud` :
  - `TOKEN_REFRESHED`, `USER_UPDATED`, `MFA_CHALLENGE_VERIFIED`, `SIGNED_IN` → `SESS` = la session reçue ;
  - `SIGNED_OUT` → `SESS = null`, étiquette « ⚠ déconnecté du cloud », **bandeau non bloquant** : « Ta connexion au cloud a été fermée (mot de passe changé, appareils déconnectés, ou double authentification activée ailleurs). Tes données sont sur cet appareil ; N modification(s) attendent l'envoi. [Se reconnecter] ».
- **Jamais** d'écran plein au milieu d'un formulaire : l'écran de connexion n'apparaît qu'au clic sur « Se reconnecter » ou au lancement suivant.
- Après reconnexion : `afterLogin()` ; `cp2_dirty` est toujours là, l'envoi part et la fusion de P3 s'applique.
- **« Continuer sans connexion »** sur l'écran de connexion (Q8) : seulement sur un appareil qui a **déjà** synchronisé (`cp2_sync.lastRemote` présent). Sur un appareil neuf, un état local fusionné « sans base » gagnerait en bloc pour les clés qui ne sont pas des listes, réglages compris (`docs/MISSION-P3.md` § 2.2) : le bouton n'y apparaît pas. Probable (déduit).

### 3.7 Téléphone perdu : procédure de secours

Écrite dans l'appli (lien « Je n'ai plus mon téléphone ») et dans le compte rendu de COMPTE.

1. **Avec un moyen de secours** (2e appareil inscrit, ou clé gardée à part) : te connecter avec lui, puis Paramètres › Mon compte : retirer l'appareil perdu, « Déconnecter mes autres appareils », changer le mot de passe.
2. **Sans moyen de secours** : depuis un ordinateur, ouvrir le tableau de bord Supabase du projet **réel** :
   - a. Authentication › Users › ton compte : chercher une action qui retire les facteurs (hypothèse : elle existe dans l'écran du compte ; **non trouvée dans la documentation lue**) ;
   - b. sinon, SQL Editor (hypothèse à **répéter d'abord sur TEST**, avec un compte d'essai) :
     ```sql
     -- 1) voir ce qui sera retiré
     select f.id, f.friendly_name, f.factor_type, f.status, f.created_at
       from auth.mfa_factors f join auth.users u on u.id = f.user_id
      where u.email = '<ton adresse e-mail>';
     -- 2) retirer
     delete from auth.mfa_factors f using auth.users u
      where u.id = f.user_id and u.email = '<ton adresse e-mail>';
     ```
   - c. te reconnecter avec le mot de passe seul ; réactiver la double authentification avec le nouveau téléphone.
3. Après une perte : noter l'incident dans le registre des violations (`docs/RGPD-registre.md`, « Violations de données ») : le téléphone contenait des données de clients.
4. **Piège** : si ton **compte Supabase** (celui du tableau de bord, distinct du compte de l'appli) a lui aussi une double authentification sur le même téléphone, le point 2 devient impossible. La doc du compte Supabase : « we will not be able to restore access to your account if you lose all your two-factor authentication credentials ». Garde un 2e moyen pour les deux.

**Faut-il un 2e facteur de secours ?** (Q2) La documentation le recommande (pas de codes de récupération, jusqu'à 10 facteurs). Options : vieux téléphone rangé à la maison ; gestionnaire de mots de passe du PC ; clé imprimée rangée à part. Chacune est un 2e endroit où la clé existe. Proposé : oui. Décision : toi.

### 3.8 Code PIN : même fonctionnement, texte honnête

Rien ne change dans `pinSet`, `pinHash`, `lockApp`, `resetIdle`, `tryUnlock`, `pinForgot`, `pinRemove` (4 à 8 chiffres, 10 min, `EFFACER`, `cp2_pin` hors synchro et hors sauvegardes). Seul le texte de la carte change. Proposition :

> 🔐 Ce code cache l'appli aux regards : écran resté ouvert, PC prêté, téléphone posé sur le chantier. **Il ne protège pas d'un vol** : ce n'est pas un chiffrement, il ne vaut que sur cet appareil, et « Code oublié ? » le retire sans autre preuve (tes données ne sont jamais perdues). La connexion au cloud reste ouverte derrière lui. Contre un vol ou une perte : le verrouillage de l'appareil lui-même (code ou Face ID du téléphone, session de l'ordinateur), puis, depuis un autre appareil, « Déconnecter mes autres appareils » et un nouveau mot de passe (Mon compte).

La ligne « État : … · verrouillage auto après 10 min d'inactivité » reste.

### 3.9 Ce qui ne change pas

- Données synchronisées, `cp_state_push`, fusion (P3), émission, signature en ligne, Super PDP (sauf Q1).
- Aucun montant, aucune règle fiscale, aucune mention légale : suites Y et Z identiques.
- L'écran de connexion garde ses messages actuels ; le « mot de passe oublié par e-mail » n'est **pas** dans COMPTE.

## 4. `aal2` côté serveur : ce que ça demanderait (sans trancher)

### 4.1 Le point de départ

Une règle serveur rend le code nécessaire pour les actions choisies, quel que soit le chemin utilisé (documentation, § 2.3). Contrôle côté serveur : mission FACT (décision Q1 du 11/11/2026). Certain (doc).

### 4.2 Les variantes

| Variante | Ce que le serveur exige | À l'usage | Avantages | Inconvénients |
|---|---|---|---|---|
| A — rien | rien de plus | code à chaque **nouvelle connexion**, demandé par l'appli | aucune migration ; aucun risque de blocage côté serveur | contrôle côté serveur : mission FACT |
| B — `aal2` pour l'émission et Super PDP, **seulement si un facteur vérifié existe** (modèle « opted-in » de la doc) | `aal2` dans `cp_emettre_document`, `cp_importer_ancien`, `cp_document_fichiers`, et dans la fonction `superpdp` | comme A dans la pratique : l'appli demande le code à la connexion, la session reste `aal2` à chaque renouvellement (probable), donc une facture émise sur le téléphone **ne redemande pas** le code ; seule une session restée en `aal1` le redemande | factures et envois à la plateforme hors d'atteinte du mot de passe seul ; facteur retiré (procédure § 3.7) → la règle se relâche d'elle-même | migration sur une fonction déjà longue (copie de la version C1) ; une nouvelle erreur à reconnaître dans l'appli ; déploiement de `superpdp` (geste de Gab) |
| C — code **récent** pour chaque émission | `aal2` **et** un code donné il y a moins de N minutes (horodatage `amr` du jeton, doc) | le code est redemandé avant une facture si le dernier date de plus de N minutes | le plus strict pour les factures | sur le chantier : téléphone sorti à chaque facture ; N à choisir ; plus de cas à tester |
| D — `aal2` pour **tout** | règles « restrictives » sur toutes les tables ClimPilot + contrôle dans `cp_state_push` et les autres fonctions | un appareil resté en `aal1` ne synchronise plus | le mot de passe seul ne donne plus rien | la plus grosse migration ; risque de « échec synchro » à expliquer ; hors des 4 points (actions sensibles seulement) |

### 4.3 Ce que B demanderait (si Q1 = oui)

**Serveur** — migration rejouable `supabase/migrations/<date>_aal2_emission.sql` :

```sql
-- esquisse (proposition, pas un script à coller)
create or replace function public.cp_aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                      where f.user_id = (select auth.uid()) and f.status = 'verified')
$$;
revoke all on function public.cp_aal_ok() from public, anon;
grant execute on function public.cp_aal_ok() to authenticated;
```

- Dans `cp_emettre_document` (copie **exacte** de la version C1 de `20261021180000_une_facture_par_source.sql`), juste après « non connecté » et **avant** toute lecture du registre : `if not public.cp_aal_ok() then raise exception 'aal2 requis : double authentification à faire' using errcode = '42501'; end if;`. Même ligne dans `cp_importer_ancien` et `cp_document_fichiers`. Commentaire de fonction mis à jour (contrôle des scripts).
- Les fonctions sont `security definer` : une règle d'accès (RLS) ne s'y applique pas, d'où le contrôle **dans** la fonction. Certain (principe PostgreSQL ; même raisonnement que C1).
- Le propriétaire des fonctions peut-il lire `auth.mfa_factors` sur le projet hébergé ? Hypothèse : oui ; **le script TEST le vérifie** avant tout.
- Fonction `superpdp` (`supabase/functions/superpdp/index.ts`, `handle`) : après `service.auth.getUser(jwt)` (qui valide le jeton auprès du serveur), lire `aal` dans le jeton ; si `user.factors` contient un facteur vérifié et que `aal` ≠ `aal2` → 403 `{erreur:'aal2', message:'Double authentification requise : reconnecte-toi avec ton code.'}`. L'appli transmet déjà telle quelle une réponse `{erreur, message}` du service (`nxPdpApi`, `next-superpdp.js` l. 49-61).
- **Retour arrière** `tests/supabase-test/<n>-aal2-retour-arriere.sql` : remet les trois fonctions dans leur version d'avant (copies conformes), retire `cp_aal_ok`. Rejouable.
- **Script TEST** `tests/supabase-test/<n>-aal2-TEST.sql` (numéro libre au moment du code ; modèle `4-une-facture-par-source-TEST.sql`) : verrou sur `public.climpilot_marqueur_test` ; la migration telle quelle ; contrôles : fonctions présentes, commentaires, droits (`anon` refusé), puis **dans une transaction annulée** (`begin; … rollback;`), en rôle `authenticated` avec un jeton simulé (`request.jwt.claims`) : `cp_aal_ok()` = vrai sans facteur ; faux en `aal1` pour le compte d'essai qui a un facteur vérifié ; vrai en `aal2`. **Aucune donnée écrite.** Préalable : avoir activé la double authentification sur la copie d'essai (TEST).
- **Script réel** `tests/supabase-test/<n>-REEL-aal2.sql` (modèle `6-REEL-droits-anon.sql` : s'arrête si le marqueur de TEST est présent).

**Appli** : reconnaître l'erreur (`42501` + « aal2 requis ») dans `demanderServeur` (`next-emission.js`) et dans `nxPdpApi` (`next-superpdp.js`) → écran du code (§ 3.5) → **même demande** (`request_id` inchangé : l'émission reste idempotente). Rien n'est numéroté avant le contrôle.

**Ordre sur le réel** : la règle arrive **après** l'appli qui sait demander le code, sinon une facture refusée afficherait un message brut. Ordre proposé : script TEST et essai ; fusion de l'appli, F5 partout ; double authentification activée et vérifiée ; **puis** script réel et déploiement de `superpdp`.

### 4.4 Ce que ça change pour toi (B)

- Tant que la double authentification n'est pas activée : rien.
- Activée : le code est demandé à chaque nouvelle connexion sur chaque appareil (comme en A). Les factures partent ensuite sans nouveau code, tant que la session dure (sans limite sur le plan gratuit, § 1.4 c).
- Si une session est restée en `aal1` (cas rare : appli fermée pendant la saisie du code), la facture est refusée par le serveur **sans numéro consommé**, l'appli demande le code, puis émet.
- Téléphone perdu sans secours : la procédure du § 3.7 relâche la règle (plus de facteur vérifié → `aal1` accepté).

## 5. Tests à écrire d'abord (rouges sur `main`)

### 5.1 Faux client Supabase : les réponses de supabase-js 2.117.3

Le faux client de `tests/banc-appareils.mjs` (`FAUX_CLIENT`) n'a aujourd'hui que `getSession`, `signInWithPassword`, `signOut` (sans portée) et un `onAuthStateChange` muet. Proposé : un module commun `tests/faux-auth.mjs`, utilisé par le banc et par la nouvelle suite, qui imite **exactement** les formes du § 2.2.

| Appel | Réponses simulées |
|---|---|
| `updateUser` | `{data:{user}, error:null}` + `USER_UPDATED` ; `{data:{user:null}, error:{name:'AuthApiError', status, code}}` pour `reauthentication_needed`, `reauthentication_not_valid`, `same_password`, `insufficient_aal`, `over_request_rate_limit` ; `{…, error:{name:'AuthWeakPasswordError', code:'weak_password', reasons:[…]}}` ; coupure : `{…, error:{name:'AuthRetryableFetchError', status:0}}` **rendue**, pas rejetée |
| `reauthenticate` | `{data:{user:null, session:null}, error:null}` ; le serveur simulé garde le code « envoyé » (lisible par le test) |
| `signOut({scope})` | note la portée ; `local` / `global` : session effacée + `SIGNED_OUT` ; `others` : session gardée, aucun événement ; les sessions des autres appareils sont marquées révoquées |
| `mfa.enroll` | `{data:{id, type:'totp', friendly_name, totp:{qr_code:'data:image/svg+xml;utf-8,<svg…>', secret, uri:'otpauth://totp/…'}}}` ; facteur « non vérifié » côté serveur simulé |
| `mfa.challenge` / `verify` / `challengeAndVerify` | défi à durée limitée ; code vérifié par le calcul du § 5.2 ; réussite : session `aal2` enregistrée + `MFA_CHALLENGE_VERIFIED` ; à l'inscription, **sessions des autres appareils révoquées** (doc) ; échec : `code:'mfa_verification_failed'` ; défi périmé : `mfa_challenge_expired` |
| `mfa.unenroll` | refus `insufficient_aal` si la session est `aal1` et le facteur vérifié ; sinon facteur retiré |
| `mfa.listFactors` | passe par le « réseau » simulé (échoue hors ligne) ; `totp` = vérifiés seulement |
| `mfa.getAuthenticatorAssuranceLevel` | **local** (aucun appel au serveur simulé) |
| `getSession` | session, ou `{data:{session:null}, error:{name:'AuthRetryableFetchError', status:0}}` pour le démarrage hors ligne au jeton expiré |
| renouvellement | crochet du test (`S.renouveler(dev)`) : session révoquée → session effacée + `SIGNED_OUT` sur cet appareil |

Le compte d'essai reste fictif (`COMPTE` du banc : adresse en `.invalid`). Les suites Q, AA et AE, qui utilisent le banc, doivent rester vertes.

### 5.2 Le code TOTP des tests

- Calcul RFC 6238 (HMAC-SHA1, pas de 30 s, 6 chiffres) dans Node, à partir d'un **secret de test public** : la graine de l'annexe B de la RFC 6238 (`12345678901234567890` en ASCII, soit `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` en base32). Ce n'est pas un secret réel.
- **Test du test** (à garder dans la suite) : les 6 valeurs de l'annexe B à 8 chiffres (T = 59 → 94287082, 1111111109 → 07081804, 1111111111 → 14050471, 1234567890 → 89005924, 2000000000 → 69279037, 20000000000 → 65353130), et à 6 chiffres T = 59 → 287082. **Exécuté ici** (script jetable, Node 22) : 6 / 6 conformes. Certain.
- Heure : **`REF.horloge`** (`tests/lib.mjs`) pour la page (`page({horloge:REF.horloge})`) **et** pour le serveur simulé, qui calcule le code attendu au même instant, avec ± 1 intervalle (comme Supabase, doc). Jamais `Date.now()` de la machine (règle 9). Vérifier aussi sous `faketime` un samedi, un dimanche et le 05/01 de l'année suivante : le résultat ne doit pas bouger.

### 5.3 Suite navigateur `tests/suiteAH-compte.mjs`

Lettre : AB réservée à S, AC à AE prises, AF évitée, AG retenue par P11 → **AH**. Inscription dans `tests/run-all.sh` (`SUITES_DEFAUT`) et `tests/isolation/rapport.mjs` (`resAH.json`), comme la suite AE.

| Test | Situation | Attendu | Sur `main` |
|---|---|---|---|
| AH1 | nouveau mot de passe de 11 caractères ; puis 12 | refus avec le nombre tapé, **aucun** appel `updateUser` ; 12 accepté | rouge (pas d'écran) |
| AH2 | confirmation différente ; nouveau = actuel | refus, aucun appel | rouge |
| AH3 | changement réussi | 1 appel, corps attendu (Q4) ; champs vidés ; message ; proposition « autres appareils » ; le mot de passe absent de `localStorage`, `sessionStorage`, `cpnext_journal`, des messages et de la console | rouge |
| AH4 | `reauthentication_needed` | 1 appel `reauthenticate` ; champ du code ; code faux → `reauthentication_not_valid`, message ; code juste → `updateUser` avec `nonce`, réussite | rouge |
| AH5 | `weak_password` (raisons), `same_password`, limite d'essais, coupure (`status: 0`) | messages du § 3.2, dont « Résultat inconnu » | rouge |
| AH6 | hors ligne | boutons grisés, message, aucun appel | rouge |
| AH7 | « Déconnecter mes autres appareils » : Annuler, puis OK | Annuler → aucun appel ; OK → `signOut({scope:'others'})` une fois ; cet appareil reste connecté et un envoi d'état passe encore | rouge |
| AH8 | lien « Déconnexion » (si Q6 = oui) | `signOut({scope:'local'})` | rouge (portée `global` aujourd'hui) |
| AH9 | « Activer » sur PC (1300 px) puis sur iPhone 13 | `enroll` avec `factorType:'totp'` ; PC : image dont la source commence par `data:image/svg+xml` + clé en clair ; téléphone : lien `otpauth://` + clé + « Copier » | rouge |
| AH10 | code faux | `mfa_verification_failed` → message ; facteur non vérifié ; niveau `aal1` | rouge |
| AH11 | code juste (§ 5.2) | « Activée » ; `currentLevel` `aal2` ; message « autres appareils » ; `SESS` = nouvelle session | rouge |
| AH12 | Annuler l'inscription ; nouvel essai | facteur non vérifié retiré ; au 2e essai, aucun facteur fantôme | rouge |
| AH13 | connexion, double authentification active | après le mot de passe : écran du code, **aucune** lecture de `climpilot_state` ; code faux : refus ; code juste : synchro | rouge |
| AH14 | démarrage : session `aal2` ; session `aal1` + facteur ; `aal2` hors ligne | pas d'écran ; écran du code ; pas d'écran et aucun appel au serveur pour le niveau | rouge (2e cas) ; témoins sinon |
| AH15 | retirer le facteur | confirmation ; `unenroll` ; `refreshSession` ; « Désactivée » ; connexion suivante sans code | rouge |
| AH16 | **PIN** : 3 chiffres, 4 à 8, verrou à 10 min (horloge), « Code oublié ? » + `EFFACER` ; texte | fonctionnement identique à `main` ; nouveau texte présent (« ne protège pas d'un vol », « cet appareil ») ; ancienne phrase « restent uniquement sur cet ordinateur » absente | fonctionnement : vert (témoin) ; texte : rouge |
| AH17 | `SIGNED_OUT` émis pendant l'usage (formulaire ouvert) | `SESS = null` ; bandeau avec le nombre de modifications ; **pas** d'écran plein ; `cp2_dirty` gardé ; reconnexion → envoi | rouge |
| AH18 | démarrage, jeton expiré, Supabase injoignable, avec le **vrai** supabase-js embarqué (comme le § 1.4 b) | pas d'écran de connexion (Q7) ; étiquette « hors ligne » ; nouvel essai à `online` | rouge (exécuté ici : écran à ≈ 26 s) |
| AH19 | (si Q1 = oui) émission refusée « aal2 requis » | écran du code ; même `request_id` ; une seule facture | rouge |
| AH20 | sans cloud (bibliothèque remplacée, comme la suite A) | chaque bouton de « Mon compte » répond sans erreur | rouge |

Toutes les pages : `page({horloge:REF.horloge})` ; PC = `page({mobile:false, horloge:REF.horloge})`.

### 5.4 Banc deux appareils (dans la même suite, comme AE)

| Scénario | Ce qu'on fait | Attendu |
|---|---|---|
| AHB1 | PC et téléphone connectés, synchronisés ; le téléphone modifie un devis hors ligne ; le PC : « Déconnecter mes autres appareils » ; le téléphone revient en ligne, renouvellement | PC toujours connecté et synchronisé ; téléphone : bandeau, modification gardée ; reconnexion → envoyée, rien de perdu |
| AHB2 | PC active la double authentification | session du téléphone révoquée ; reconnexion du téléphone : mot de passe puis code ; synchro |
| AHB3 | PC change le mot de passe et ferme les autres connexions | ancien mot de passe refusé sur le téléphone, nouveau accepté |
| AHB4 | téléphone hors ligne pendant la révocation, puis rouvert hors ligne | aucun écran de connexion tant qu'il est hors ligne ; au retour du réseau : bandeau, reconnexion, rien de perdu |

### 5.5 SQL et fonctions (seulement si Q1 = oui)

- `tests/sql/00_supabase_emul.sql` gagne `auth.jwt()` (lu dans `request.jwt.claims`, comme `auth.uid()`) et une table minimale `auth.mfa_factors (id, user_id, status, factor_type)`.
- `tests/sql/test_aal2.py` (PostgreSQL 16 local, marqueur `climpilot-test`) : migration appliquée deux fois ; sans facteur, `aal1` → émission acceptée (comme aujourd'hui) ; facteur vérifié + `aal1` → refus, code `42501`, **aucun numéro consommé** (`climpilot_seq` inchangé) ; `aal2` → acceptée ; facteur non vérifié + `aal1` → acceptée ; refus puis même `request_id` en `aal2` → une facture ; mêmes cas pour `cp_importer_ancien` et `cp_document_fichiers` ; `anon` refusé ; `test_p6_14` reste vert ; retour arrière = texte de la version C1 ; règle C1 inchangée (tests de `test_une_facture_par_source.py` verts).
- `tests/functions/` : `superpdp` avec un faux `getUser` qui rend des facteurs et un jeton `aal1` / `aal2` → 403 `aal2` / accepté ; sans facteur → accepté ; liste blanche inchangée (`test-liste-blanche.mjs`).

### 5.6 Suites qui ne doivent pas bouger (la batterie le vérifie)

A (boutons des Paramètres), C (`cp2_pin` hors sauvegarde), H (Super PDP, faux client propre), I et N (émission), Q, AA, AE (banc deux appareils), U (fusion), W (aucune enveloppe), Y et Z (montants et documents). Cache : `const C=` de `sw.js` incrémenté **une fois**, au numéro qui suit celui de S.

## 6. Risques, retour arrière, déploiement, estimation

### 6.1 Risques

| # | Risque | Garde-fou | Reste |
|---|---|---|---|
| R1 | **Verrouillé hors de ton compte** (téléphone perdu, pas de secours) | 2e facteur (Q2) ; procédure § 3.7 répétée sur TEST ; variante B qui se relâche quand le facteur est retiré ; « Continuer sans connexion » (Q8) pour garder l'accès aux données de l'appareil | si le compte Supabase lui-même est bloqué (§ 3.7, point 4) |
| R2 | **Session fermée ou jeton expiré en plein chantier** | § 1.4 : aujourd'hui, écran bloquant au démarrage hors ligne (exécuté). Cible : erreur réseau = hors ligne (Q7), bandeau non bloquant (§ 3.6) | COMPTE ajoute des fermetures de session (activation du code, autres appareils) : à prévoir **avant** de partir sur un chantier |
| R3 | **Appareil de secours** mal rangé | il contient la clé : même protection que le téléphone (verrouillage de l'appareil) | ta décision du lieu |
| R4 | Code refusé : heure du téléphone fausse | tolérance d'un intervalle (doc) ; message « heure automatique » | — |
| R5 | Code de ré-authentification par e-mail non reçu | Q4 : mot de passe actuel plutôt que code par e-mail | hypothèse sur les limites d'e-mails |
| R6 | Mot de passe ou code laissé dans le stockage, un message, la console | AH3 le vérifie | — |
| R7 | Facteurs non vérifiés accumulés (10 au plus) | nettoyage avant chaque inscription, AH12 | — |
| R8 | **S et COMPTE** : la politique de sécurité du navigateur (CSP) de S doit permettre les images `data:` (QR code) ; l'échappement des noms de facteurs suit la fonction retenue par S | COMPTE après la fusion de S ; AH9 échoue si le QR ne s'affiche pas | dossier de S non lu (Project) |
| R9 | Ancienne branche `claude/login-password-issue-f7cidd` fusionnée par erreur | elle réécrit `doLogin` : Q11 | — |
| R10 | Le serveur termine d'autres sessions au changement de mot de passe (doc vague) | le bouton « autres appareils » reste utile, sans effet de bord | à constater sur TEST |

### 6.2 Retour arrière

- **Appli** : revert du ou des commits de COMPTE. L'ancienne version se connecte en `aal1` (mot de passe seul) même si un facteur existe : elle ne demande pas le code et marche comme aujourd'hui, **sauf** si la règle serveur B est en place (émission refusée avec un message brut). Probable (lu : l'ancienne `doLogin` ne lit pas le niveau).
- **Facteur TOTP déjà inscrit** : il reste sur Supabase après un revert. Avant le revert, le retirer dans Mon compte ; après, par la procédure du § 3.7 (point 2). Sans règle serveur, le laisser est sans effet pour l'ancienne version.
- **Règle serveur (B)** : `…-aal2-retour-arriere.sql` **d'abord**, puis revert de l'appli, puis redéploiement de l'ancienne `superpdp` (geste de Gab).
- **Mot de passe changé** : il reste changé (rien à défaire).
- **Réglages du tableau de bord** : se remettent à la main (noter les valeurs d'avant dans le compte rendu).
- Dans le code : chaque appel d'authentification dans un `try/catch` qui journalise en console (règle 11) ; en cas d'erreur, l'appli continue en local.

### 6.3 Ordre de déploiement

1. S fusionnée, F5 partout.
2. Branche `correctif/compte` : tests rouges (journal gardé), code, suite AH, batterie complète, CI verte, relecture P10 par l'autre modèle.
3. Toi, sur **TEST** : réglages du § 2.4 ; essai § 6.4 ; si Q1 = oui, script TEST (lignes « OK ») et procédure de secours répétée avec un compte d'essai.
4. Mêmes réglages sur le **réel**.
5. Fusion ; le même jour : « ✓ synchronisé » puis F5 sur chaque appareil.
6. Activer la double authentification **depuis le PC**, un jour sans chantier ; reconnecter le téléphone avec le code ; ajouter le moyen de secours (Q2).
7. Si Q1 = oui : script réel, puis déploiement de `superpdp`.

### 6.4 L'essai que tu feras (esquisse ; le compte rendu le détaillera)

Sur la copie d'essai (TEST), PC + iPhone, ≈ 30 min.
1. PC : Paramètres › Mon compte › nouveau mot de passe de 11 caractères. Attendu : « Trop court ».
2. Mot de passe de 12 caractères ou plus. Attendu : « ✓ Mot de passe changé » et la proposition « autres appareils ». Accepte. Attendu : sur l'iPhone, dans l'heure, bandeau « connexion fermée » ; tes données toujours là.
3. iPhone : reconnecte-toi avec le nouveau mot de passe. Attendu : synchro.
4. PC : « Activer la double authentification », scanne avec l'iPhone, tape un **faux** code. Attendu : « Code refusé ». Puis le bon code. Attendu : « Activée ».
5. iPhone : reconnecte-toi. Attendu : mot de passe, **puis** le code.
6. PC : retire le facteur. Attendu : « Désactivée » ; la connexion suivante ne demande plus de code.
7. Paramètres › Sécurité — code d'accès. Attendu : le nouveau texte ; le code marche comme avant.
8. Mode avion sur l'iPhone, attends plus d'une heure, rouvre l'appli. Attendu (si Q7 = oui) : l'appli s'ouvre, étiquette « hors ligne », pas d'écran de connexion.

### 6.5 Estimation honnête

- **Appli** : `index.html` (carte « Mon compte », changement du mot de passe, autres appareils, inscription / retrait TOTP, 2e étape de connexion, écoute des événements de session, démarrage hors ligne, texte du PIN) : **≈ 250 à 400 lignes** (estimation) ; `sw.js` : cache, une fois. `VERSION` et `NX_VERSION` : inchangés sauf avis contraire (Q10).
- **Tests** : `tests/faux-auth.mjs` (≈ 150 à 200 lignes) ; suite AH ≈ 20 tests, ≈ 70 contrôles ; banc ≈ 4 scénarios, ≈ 15 contrôles ; inscription dans `run-all.sh` et `rapport.mjs`.
- **Si Q1 = oui** : migration, retour arrière, scripts TEST et réel ; `superpdp` (≈ 10 lignes) ; `00_supabase_emul.sql` ; `test_aal2.py` (≈ 12 tests) ; tests de fonction (≈ 8 contrôles) ; `next-emission.js` et `next-superpdp.js` (reconnaître l'erreur).
- **Documents** : compte rendu, `docs/ESSAIS-SUPABASE-TEST.md`, `tests/LISEZMOI.md`, `docs/FILE-DES-MISSIONS.md`, `docs/APRES-PRO-V1.md` (mot de passe oublié par e-mail, variantes C et D si écartées).
- **Durée** : 2,5 à 3 jours de sessions sans Q1 (tests 1 ; code 1 ; batterie, CI, compte rendu ½ ; relecture ½) ; **+ 1 à 1,5 jour** avec Q1. La branche vit moins d'une semaine. **Ton temps** : réglages ≈ 10 min par projet, essai ≈ 30 min, script TEST ≈ 5 min si Q1, activation sur le réel ≈ 10 min.

## 7. Tes questions (oui / non)

1. **Code exigé par le serveur pour les factures et Super PDP** (variante B du § 4, seulement quand la double authentification est active) ? Ta décision : ce dossier ne tranche pas. Oui = variante B dans COMPTE, +1 à 1,5 jour, une migration et un déploiement. Non = variante A ; contrôle côté serveur : mission FACT.
2. **2e moyen de secours** (2e appareil inscrit, ou clé rangée à part) ? Recommandé : oui (la documentation le recommande ; pas de codes de récupération).
3. **Durée de session** : garder la durée par défaut (jeton de 1 h, sessions sans limite, seul choix possible sur le plan gratuit) et décider d'une limite au passage au plan Pro (juin 2027) ? Recommandé : oui.
4. **Mot de passe actuel demandé** pour le changer (réglage « Require current password »), **sans** code par e-mail (« Require reauthentication ») ? Recommandé : oui. L'appli gère quand même le code par e-mail si le serveur le demande.
5. **12 caractères minimum aussi dans le tableau de bord Supabase** (le serveur refuse alors un mot de passe plus court, même hors de l'appli) ? Recommandé : oui. Ton mot de passe actuel continue de marcher (§ 1.7).
6. **« Déconnexion » ne déconnecte que cet appareil**, comme son message le dit (portée `local`) ? Recommandé : oui (c'est une correction : aujourd'hui elle ferme tous les appareils).
7. **Démarrage sans réseau** : ne plus afficher l'écran de connexion bloquant quand le jeton a seulement expiré (traiter comme « hors ligne ») ? Recommandé : oui (correction du § 1.4 b, exécuté).
8. **« Continuer sans connexion »** sur l'écran de connexion, seulement sur un appareil qui a déjà synchronisé (données de l'appareil, synchro en pause) ? Recommandé : oui : sans lui, une connexion impossible (pas de réseau, téléphone de la double authentification perdu) bloque aussi l'accès aux données déjà présentes sur l'appareil. Exception au gel à confirmer par écrit.
9. **Notifications de sécurité par e-mail** (mot de passe changé, appareil ajouté ou retiré), si le tableau de bord les propose ? Recommandé : oui.
10. **Numéro affiché** (`VERSION`, `NX_VERSION`) inchangé pour COMPTE ? Recommandé : oui (comme P3).
11. **Ancienne branche `claude/login-password-issue-f7cidd`** : la supprimer (geste de toi), son « mot de passe oublié par e-mail » étant noté pour après PRO v1 ? Recommandé : oui.

**Hors COMPTE, notés** : mot de passe oublié par e-mail ; variantes C et D du § 4 ; durée de session au plan Pro ; protection des mots de passe divulgués (plan Pro) ; limites d'envoi d'e-mails du serveur (non lues).
