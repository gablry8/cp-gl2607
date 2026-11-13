# COMPTE — mot de passe, double authentification, appareils — compte rendu (12/11/2026, complété par COMPTE-bis le 12/11 et COMPTE-ter le 13/11)

## COMPTE-ter — dernière petite reprise : points T1 à T5 (13/11/2026)

> Même branche `correctif/compte`, partie de `f25406b` (ni rebase, ni push forcé, ni fusion) ; demande de fusion [gablry8/cp-gl2607#24](https://github.com/gablry8/cp-gl2607/pull/24) **toujours en brouillon**. Exécutant : Opus 5.5 (session Claude Code).
> **Outil Projects absent de cette session** : rien lu ni écrit dans le Project ; la mission n'en dépendait pas. **Rien dans `supabase/`, aucune base lue ni écrite, aucun réglage du tableau de bord.** Aucune délégation (cinq points courts, chacun demandant un jugement sur le test).
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**.

### Ce que Gab décide / fait (inchangé, sauf le numéro du cache)
1. #24 reste en **brouillon**. Tes gestes ne changent pas : réglages TEST (§ 7) ; essai § 8.2 avec les **étapes 2 et 16 obligatoires** ; mêmes réglages sur le réel ; fusion.
2. Le jour de la fusion, sur chaque appareil : « ✓ synchronisé », puis F5 — cache **`climpilot-next-1140-production`** (était 1139). `VERSION` / `NX_VERSION` inchangés.
3. Ce que ça change pour toi : « Annuler » (ou quitter les Paramètres) au tout début de l'ajout d'un appareil arrête vraiment tout ; si le retrait d'un essai annulé échoue, tu le lis à l'écran au lieu de rien.

### C.1 Les cinq points (certain : lu et exécuté)
| # | Où | Ce qui change |
|---|---|---|
| T1 | test AH25 | `etatMfa` peut rendre `{ erreur }` : chaque contrôle qui l'utilise exige `!apres.erreur` (et `!pendant.erreur`, `pendant` étant maintenant lu par `etatMfa`, « Continuer » grisé compris). |
| T2 | test AH24 | `recu1.vue === 'params'` et `recu2.vue === 'params'` exigés : la mise à jour est appliquée **sans quitter** les Paramètres. |
| T3 | test AH23 (connexion) | Les deux `.catch(() => {})` de `doLogin` et `cpLoginRecommencer` gardent l'erreur (`eLogin`, `eRecommencer`), exigée absente. Les autres `.catch(() => {})` du banc sont inchangés. |
| T4 | `index.html`, `cpMfaInscrire` | Numéro de tentative (`++_cpMfaTent`, `_cpMfaPrep`, « Continuer » grisé) pris **avant** le premier `await` (`cpAal2`) ; annulée pendant cette lecture → rien (ni code demandé, ni `enroll`). Test AH25 (d) : lecture du niveau retenue par le test, « Annuler » puis sortie des Paramètres, plus un témoin sans annulation. |
| T5 | `index.html`, `cpMfaInscrire` | Réponse d'`enroll` arrivée après l'annulation et retrait en échec : « Le retrait n'a pas abouti : il sera refait au prochain essai. » (dans la carte, ou en message bref hors des Paramètres), au lieu du silence. Test AH25 (e). |

### C.2 Preuves (certain : exécutées le 13/11)
- **Rouge** (tests de `4632d33` sur le code de `f25406b`) : suite AH **97 / 4** ; les 4 = exactement T4 (2) et T5 (2) ; le témoin de T4 et les contrôles resserrés T1 à T3 passent sur le code d'avant (ils ne changent que le test). Journal gardé hors dépôt (bloc-notes de la session).
- **Vert** (`7a6cbfb`) : suite AH **101 / 0**.
- **Mutations** (T1 à T3, deux copies du dépôt hors dépôt ; M1 : `etatMfa` rend `{ erreur }` ; M2 : sortie des Paramètres avant la lecture de la mise à jour ; M3 : « Recommencer » absent et 2e connexion non faite) : nouveaux tests **92 / 9**, les 9 échecs = exactement les contrôles resserrés (T1 : 5, T2 : 2, T3 : 2) ; anciens tests de `f25406b` sous les mêmes mutations : **95 / 0** (les trous que T1 à T3 ferment).
- **Batterie complète** (un passage, arbre propre à `7a6cbfb`) : **COMPLET, RÉUSSI — 1 713 / 0 / 0 SKIP**, 5 « À TRANCHER » inchangés (suite Y). W 64 / 0, X 8 / 0, Y 21 / 0, Z 55 / 0 : **golden Y, Z, W identiques** ; aucune enveloppe ni `catch` vide ajoutés.
- **`faketime`** (règle 9, suite AH, code de `7a6cbfb` ; le rapport nomme `455eca4`, qui n'ajoute que des documents) : samedi « 2026-11-14 10:00 », dimanche « 2026-11-15 10:00 », « 2027-01-05 10:00 » : **101 / 0 aux trois dates** (rapport PARTIEL, code 3, par construction).
- **CI de `7a6cbfb`** (code) : demande de fusion (run 43381340071) **verte** ; push (run 43381333401) : 1 708 / **1** / 2 SKIP connus — suite Q, contrôle « Avoir PARTIEL fait sur le PC : le téléphone pas à jour ne refacture pas le chantier (la facture reste due), il reprend F-2027-001 ». Ce contrôle est vert sur l'autre événement du même commit, vert dans la batterie locale, et il ne passe pas par le code touché (activation de la double authentification) ; la même instabilité de la recette deux appareils a déjà été vue pendant S (`docs/S-COMPTE-RENDU.md`, « Premier passage ») : instabilité, **probable**. Pas relancé (seule une relance de la suite X était permise). `4632d33` (tests d'abord) : runs annulés par le push suivant.
- **CI de la tête finale** : voir la description de #24 (écrite après la fin des runs).

### C.3 Ce qui n'a pas pu être vérifié
- Sur un vrai appareil, la lecture du niveau de T4 est locale et brève (plus longue seulement si la bibliothèque doit d'abord renouveler le jeton) : seul le banc provoque la course, en retenant cette lecture. Rien de neuf à ajouter à ton essai (probable).
- Le détail du contrôle Q en échec sur un événement de la CI de `7a6cbfb` (C.2) : l'artefact de la CI est sur un hôte que le réseau de cette session refuse.

### C.4 Clôture
- **`git diff --stat f25406b` → tête** :
  ```
   docs/COMPTE-COMPTE-RENDU.md | 57 ++++++++++++++++++++++++++++++++++++++---
   docs/FILE-DES-MISSIONS.md   |  6 ++---
   index.html                  | 10 +++++---
   sw.js                       |  2 +-
   tests/LISEZMOI.md           |  4 +++
   tests/suiteAH-compte.mjs    | 90 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++--------
   6 files changed, 147 insertions(+), 22 deletions(-)
  ```
  Aucun fichier dans `supabase/`, `vendor/`, ni dans une couche `next-*.js`.
- **Commits** (`noreply`, en français), poussés sur `correctif/compte` seulement : `4632d33` « tests d'abord » ; `7a6cbfb` « code » (cache 1140) ; `455eca4` « documents 1/2 » ; `f29104c` « tests » (trois `catch` vides de mes nouveaux contrôles remplacés, voir C.2) ; puis « documents 2/2 » (cette section, tête finale).
- **Contrôle des secrets** : `verif-secrets.sh` avant chaque commit, `--branche` avant chaque push : rien signalé, aucune dérogation.
- **Jamais** : push sur `main`, fusion, push forcé, réécriture d'historique, suppression de branche, déploiement, écriture Supabase, réglage du tableau de bord.

---

## COMPTE-bis — conditions C1 à C7 de la relecture P10 (12/11/2026)

> Relecture P10 de COMPTE (ChatGPT GPT-6 Pro, triée par Opus 5.5, 12/11/2026) sur la demande de fusion [gablry8/cp-gl2607#24](https://github.com/gablry8/cp-gl2607/pull/24) (tête `e017bfa`, base `main` = `99ddd50`) : sept conditions, traitées sur la **même branche** `correctif/compte` (ni rebase, ni push forcé, ni fusion). Exécutant : Opus 5.5 (session Claude Code).
> **Outil Projects absent de cette session** (aucun outil `project_read` / `project_write`) : le compte rendu privé détaillé `claude/ClimPilot-COMPTE-BIS-compte-rendu.md` **n'a pas été écrit** ; la consigne de la mission (résumé de la relecture) a servi de référence.
> **Rien de fusionné, rien de déployé, aucune base Supabase lue ni écrite, aucun réglage du tableau de bord, rien dans `supabase/`** (Q1 = non).
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**.

### Ce que Gab décide / fait (10 lignes, état de COMPTE-bis ; seul changement depuis : cache 1140, voir « COMPTE-ter » ci-dessus)
1. **Rien à fusionner aujourd'hui** : #24 reste en **brouillon**, branche `correctif/compte` (tête : § B.6). Relecture courte de COMPTE-bis par l'autre modèle si tu la veux (règle 12).
2. **Sur TEST** (≈ 10 min) : les réglages du tableau de bord du § 7 ; note les valeurs d'avant.
3. **Ton essai** (§ 8.2, copie d'essai sur TEST, PC + iPhone) : l'**étape 2** (mot de passe actuel faux → « Mot de passe actuel incorrect. ») est **obligatoire avant la fusion** ; nouvelle **étape 16** : « Déconnexion » en mode avion après plus d'une heure, puis réseau revenu → l'iPhone **reste déconnecté**.
4. **Puis** les mêmes réglages sur le **réel** (§ 7), la fusion, et **le même jour** sur chaque appareil : « ✓ synchronisé », puis F5 (cache **`climpilot-next-1139-production`** ; `VERSION` et `NX_VERSION` inchangés, Q10).
5. **Ce que COMPTE-bis change pour toi** : « Déconnexion » efface la session de cet appareil, **même hors ligne** ; si l'appli ne peut pas lire le niveau de ta session, elle décide d'après tes appareils de double authentification (code demandé, ou « Vérification impossible : réessaie. ») ; « Annuler » sur le code oublie le nouveau mot de passe en attente ; une activation annulée ou réussie ne laisse **ni QR code ni clé** dans la page ; un retrait qui échoue est **dit à l'écran**.
6. **Rien ne change dans les montants, mentions et calculs** : golden Y, Z et W identiques ; aucune enveloppe nouvelle.
7. Contrôle côté serveur : mission FACT.
8. **Défaut connu, toujours laissé à AF1-B** : « Continuer sans connexion » met l'émission en mode démonstration (§ 3.9) — sans danger tant que la facturation réelle n'a pas démarré.
9. **Comptes** : suite AH **73 / 22** sur `e017bfa` (les 22 échecs = exactement les nouveaux contrôles C1 à C5), **95 / 0** après ; batterie complète **1 707 / 0 / 0 SKIP** (COMPLET, RÉUSSI) ; `faketime` samedi, dimanche, 05/01/2027 : **95 / 0** aux trois dates ; CI de `a870e4e` (code) **verte sur les deux événements, première tentative** (1 703 / 0 / 2 SKIP connus) ; CI de la tête finale : § B.6.
10. **Tes gestes hors code** (inchangés) : copier ce compte rendu dans le Project ; supprimer l'ancienne branche `claude/login-password-issue-f7cidd` (Q11).

### B.1 Les sept conditions, ce que l'appli fait maintenant (certain : lu et exécuté)
| # | Condition | Ce que l'appli fait maintenant |
|---|---|---|
| C1 | Niveau de session illisible : jamais d'entrée sans code | `cpNiveau` / `cpCodeNecessaire` (chemins `doLogin` et `cpCloudReprendre`) : si `getAuthenticatorAssuranceLevel` rend une erreur, lève une exception ou ne rend pas de niveau, la décision se prend sur `session.user.factors` : un facteur TOTP vérifié → 2e étape (`cpLoginEtape2`) ; aucun facteur (liste vide ou absente, comme la bibliothèque) → comme avant ; impossible de savoir → « Vérification impossible : réessaie. », ni `SESS` ni `afterLogin`. Bibliothèque sans `sb.auth.mfa` : comme avant. `cpAal2` (actions de « Mon compte ») demande le code quand le niveau est illisible. |
| C2 | « Déconnexion » efface la session de cet appareil dans tous les cas | `cloudLogout` et `cpLoginRecommencer` passent par `cpSessionFermerIci` : `signOut({ scope: 'local' })` ; si une erreur est rendue et qu'une session reste dans le stockage de la page (clé `sb.auth.storageKey`, et sa variante « -user »), elle est retirée ici, journalisée (`cpAuthJournal`), puis la page se recharge. |
| C3 | Abandonner le code oublie les mots de passe | « Annuler » du bloc du code (`cpCodeFermer(true)`), la sortie des Paramètres, une nouvelle activation et l'événement `SIGNED_OUT` (`cpAuthEvenement`, sans appel à Supabase dans ce rappel) vident `_cpMdpAttente` et ferment le parcours ; `cpCompteOccupe()` redevient faux. Après un bon code, seul le bloc se ferme et l'action reprend (comme avant). |
| C4 | Inscription de la double authentification : annulation et nettoyage | (a) numéro de tentative : une réponse d'`enroll` arrivée après « Annuler », la sortie des Paramètres ou une session fermée retire le facteur créé (`unenroll`) et n'affiche rien ; « Continuer » grisé pendant « Préparation… » ; (b) le nettoyage ne retire que les facteurs non vérifiés créés il y a plus de 15 minutes (`created_at`), plus ceux de cet appareil dont le retrait avait échoué ; une inscription en cours sur l'autre appareil est laissée ; (c) retrait en échec à l'annulation : « Le retrait n'a pas abouti : il sera refait au prochain essai. » à l'écran (et en message bref hors des Paramètres), refait au prochain essai. |
| C5 | Clé TOTP effacée de la page | `cpMfaValider` (réussite) et `cpMfaAnnuler` font le même nettoyage, `cpMfaEffacer` : source de l'image du QR code, texte de la clé, `href` du lien `otpauth://`, champ du code. |
| C6 | Tests plus stricts | `appelsEtat` compte à part les lectures (`climpilot_state`) et les envois (`cp_state_push`) ; AH13 exige 0 lecture **et** 0 envoi avant le bon code, avec `cp2_dirty` présent et une reprise déclenchée (`online`, `focus`, retour sur l'appli, 65 s d'horloge) ; AH13 bis : « Continuer sans connexion » depuis la 2e étape → 0 lecture, 0 envoi pendant l'usage, retour à la 2e étape au lancement suivant ; les deux `catch (e) {}` de la suite gardent leur erreur dans le diagnostic. |
| C7 | Documents publics neutres | `docs/COMPTE-COMPTE-RENDU.md`, `docs/MISSION-COMPTE.md`, `docs/FILE-DES-MISSIONS.md`, l'en-tête de la suite AH et le commentaire du bloc COMPTE d'`index.html` : « contrôle côté serveur : mission FACT ». |

### B.2 Tests d'abord : rouge sur `e017bfa`, puis vert (certain : exécutés le 12/11)
Méthode : tests écrits d'abord (commit « tests d'abord »), joués sur le code d'`e017bfa` dans un arbre de travail séparé (hors dépôt), journal rouge gardé dans le bloc-notes de la session ; puis correction ; puis vert. Rouge final : suite AH **73 réussis / 22 échoués** sur 95 contrôles ; les 22 échecs sont exactement les nouveaux contrôles de C1 à C5 ; les contrôles d'avant restent verts.
| Condition (contrôles) | Sur `e017bfa` (code d'avant, tests définitifs) | Après (`a870e4e`) |
|---|---|---|
| C1 — AH23 (9) | **6 échoués**, 3 réussis (témoin sans facteur, 2 « aucune erreur JavaScript ») | 9 / 0 |
| C2 — AH22 (6) | **5 échoués**, 1 réussi (« aucune erreur JavaScript ») | 6 / 0 |
| C3 — AH24 (4) | **4 échoués** | 4 / 0 |
| C4 — AH25 (7) | **5 échoués**, 2 réussis (retrait refait au prochain essai, aucun facteur restant) | 7 / 0 |
| C5 — AH26 (2) | **2 échoués** | 2 / 0 |
| C6 — AH13, AH13 bis (7) | 7 réussis (contrôles plus stricts : ce code ne lisait ni n'envoyait déjà rien avant le bon code — témoins) | 7 / 0 |
| Contrôles de COMPTE déjà présents (60) | 60 réussis | 60 / 0 |
| **Total suite AH** | **73 réussis / 22 échoués** (95 contrôles) | **95 / 0** |

### B.3 Correction — `index.html` et `sw.js` seulement
Fonctions modifiées **sur place** : `doLogin`, `cloudLogout`, `cpNiveau`, `cpCodeNecessaire`, `cpCompteAfficher` (une condition), `cpCompteOccupe`, `cpCompteQuitter`, `cpMfaDebut`, `cpMfaInscrire`, `cpMfaValider`, `cpMfaAnnuler`, `cpCodeFermer`, `cpAuthEvenement`, `cpCloudReprendre`, `cpLoginRecommencer` ; trois aides nouvelles dans le bloc COMPTE (`cpSessionFermerIci`, `cpMfaEffacer`, `cpMfaRetirerNonVerifie`) ; le bouton « Annuler » du bloc du code appelle `cpCodeFermer(true)`. **Aucune enveloppe nouvelle** (golden W inchangé), **aucun `catch` vide**, aucune clé nouvelle dans le stockage ni dans `SYNC_KEYS` (les facteurs à retirer sont gardés en mémoire seulement). `sw.js` : `C` passe de `1138` à **`1139`** (une fois). `VERSION` / `NX_VERSION` inchangés.
Tests : `tests/faux-auth.mjs` (réponse retardée d'une méthode ; niveau de session en panne ; déconnexion qui charge d'abord la session comme la bibliothèque ; clé `storageKey` exposée) et `tests/suiteAH-compte.mjs` (AH22 à AH26, AH13 et AH13 bis plus stricts).

### B.4 Batterie et horloges (certain)
- **Suites visées** (`CP_SUITES`, code de `a870e4e`, 12/11) : A 14 / 0 (les boutons répondent sans cloud), AB **86 / 0** (règles de S), C 17 / 0 (`cp2_pin` hors des sauvegardes), Q **64 / 64**, X 8 / 0, W **64 / 0 (golden `enveloppes.json` inchangé : aucune enveloppe nouvelle)**, Y **21 / 0 (golden identiques, les 5 « À TRANCHER » inchangés)**, Z **55 / 0 (identiques)**, AA 16 / 0, AE 26 / 0 : **371 réussis / 0 échoué**, rapport PARTIEL (code 3) par construction.
- **Batterie complète** (`bash tests/run-all.sh`, un seul passage, arbre propre à `a870e4e`, 12/11) : **COMPLET, RÉUSSI — 1 707 réussis / 0 échoué / 0 SKIP**, 5 non bloquants « À TRANCHER » (suite Y, les mêmes que sur `main`). C'est le compte de COMPTE (1 676) plus les 31 contrôles ajoutés à la suite AH. AH 95 / 0 (326 s), Q 64 / 0 (461 s), X 8 / 0, SQL et fonctions verts.
- **Indépendance du jour** (règle 9) : suite AH sous `faketime` « 2026-11-14 10:00 » (samedi), « 2026-11-15 10:00 » (dimanche), « 2027-01-05 10:00 » : suite AH **95 / 0 aux trois dates** (rapport PARTIEL, code 3, par construction ; arbre propre à `a870e4e`). La suite ne lit jamais la vraie date (`REF.horloge` pour les pages et le serveur simulé ; les nouveaux contrôles avancent l'horloge de la page, jamais celle de la machine).

### B.5 Ce qui n'a pas pu être vérifié
- **Le vrai Supabase et de vrais appareils** : comme pour COMPTE (§ 12). En particulier, la déconnexion en mode avion sur un vrai iPhone (étape 16 de ton essai) ; ici, le réseau coupé est simulé (vraie bibliothèque supabase-js 2.117.3 embarquée, requêtes refusées) et l'heure de la page avancée pour couvrir le délai de la bibliothèque.
- **C1, niveau « impossible de savoir »** : provoqué par le test (session sans utilisateur) ; la bibliothèque réelle ne le rend pas dans les cas observés (probable).
- **Relecture de COMPTE-bis** par l'autre modèle : pas faite ici (règle 12).
- **Compte rendu privé** dans le Project : pas écrit (outil absent).

### B.6 Clôture
- **`git diff --stat e017bfa` → tête de la branche** (hors ce compte rendu) :
  ```
  docs/FILE-DES-MISSIONS.md |  10 +-
  docs/MISSION-COMPTE.md    |   8 +-
  index.html                | 116 ++++++++++++++------
  sw.js                     |   2 +-
  tests/LISEZMOI.md         |  11 +-
  tests/faux-auth.mjs       |  18 +++-
  tests/suiteAH-compte.mjs  | 267 +++++++++++++++++++++++++++++++++++++++++++---
  ```
  plus `docs/COMPTE-COMPTE-RENDU.md` (cette section, § 7 inchangé, § 8.2 : étape 2 obligatoire et étape 16, deux phrases neutralisées, cache 1139). **Aucun fichier dans `supabase/`, `vendor/`, ni dans une couche `next-*.js`.**
- **Commits** (adresse `noreply`, en français), poussés **sur `correctif/compte` seulement** : `922fb56` « tests d'abord » ; `a870e4e` « code » ; puis le commit « documents » (tête finale). Le commit « tests d'abord » a été complété **avant tout push** (horloge avancée de 95 s dans AH22 avec la vraie bibliothèque) ; aucun historique publié n'a été réécrit.
- **CI** (`.github/workflows/tests.yml`, contrôle « batterie complète ») : `a870e4e` (code) — push (run 43322001351) et demande de fusion (run 43322011099) **verts, première tentative** ; rapport lu : COMPLET, RÉUSSI, **1 703 réussis / 0 échoué / 2 SKIP connus** (isolation du noyau absente sur le runner), 5 non bloquants ; suite X 8 / 0 (pas de plantage, aucune relance). Tête finale (« documents ») : résultat dans la description de la demande de fusion #24 et dans le message de fin de session.
- **Contrôle des secrets** : `bash tools/claude/verif-secrets.sh` avant chaque commit, `--branche` avant chaque push : **rien signalé**, aucune dérogation `CP_SECRETS_OK`. Données des tests : compte `essai@exemple.invalid`, graine TOTP **publique** de la RFC 6238, clients fictifs.
- **Écarts à connaître** : (1) AH22 avec la vraie bibliothèque : l'horloge de la page est avancée de 95 s après le retour du réseau (ajouté après le premier passage rouge, pour couvrir les délais de reprise de la bibliothèque et de l'appli dans la fenêtre d'observation) ; preuve rouge refaite avec la suite définitive : mêmes 73 / 22 ; (2) C1 couvre aussi une réponse **sans niveau** (jeton sans `aal`) : décision par les facteurs, comme pour une erreur ; (3) C3 vaut aussi à la sortie des Paramètres et au début d'une nouvelle activation ; message « Changement du mot de passe abandonné : rien n'a changé. » ; (4) C4 (b) : les facteurs de cet appareil dont le retrait a échoué sont gardés **en mémoire** (pas dans le stockage) et retirés au prochain essai, même s'ils ont moins de 15 minutes — c'est ce qui rend vrai le message « il sera refait au prochain essai » ; après un rechargement, la règle des 15 minutes prend le relais ; (5) C5 vide aussi le champ du code et masque le lien ; (6) les preuves rouges ont tourné dans un arbre de travail séparé, hors dépôt (code d'`e017bfa` + tests définitifs), et la batterie dans un arbre propre à `a870e4e`, pour pouvoir écrire les documents pendant ce temps.
- **Jamais** : push sur `main`, fusion, push forcé, réécriture d'historique publié, suppression de branche, déploiement, écriture Supabase, réglage du tableau de bord.

---

# COMPTE (12/11/2026, avant la relecture P10)

> Branche `correctif/compte`, partie de `main` = `99ddd50` (S fusionnée : `cpIdsValider` présent, cache `climpilot-next-1137-production`). Exécutant : Opus 5.5 (session Claude Code). Dossier : `docs/MISSION-COMPTE.md` ; accord écrit de Gab du 11/11/2026 (Q1 = non ; Q2 à Q11 = oui ; variantes C et D écartées) ; points de la relecture du dossier par Fable 5.1 (10/11) appliqués.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project ; la copie `claude/ClimPilot-COMPTE-compte-rendu.md` reste à faire (Gab ou la prochaine session qui a l'outil).
> **Rien de fusionné, rien de déployé, aucune base Supabase lue ni écrite (RÉEL ou TEST), aucun réglage du tableau de bord touché, rien dans `supabase/`** (Q1 = non). Seule lecture extérieure : la documentation publique de Supabase (outil officiel de recherche), le 12/11.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**.

## Ce que Gab décide / fait (10 lignes, état du 12/11 avant COMPTE-bis : la liste à jour est en tête de la section « COMPTE-bis » ci-dessus)
1. **Fais relire COMPTE par Fable 5.1** (relecture P10, après le 15/11) : demande de fusion **[gablry8/cp-gl2607#24](https://github.com/gablry8/cp-gl2607/pull/24)** en brouillon. Rien n'est fusionné ni déployé.
2. **Sur TEST** (≈ 10 min) : les réglages du tableau de bord du § 7 (12 caractères, mot de passe actuel demandé, pas de code par e-mail, TOTP activé, e-mails de sécurité). Note les valeurs d'avant.
3. **Ton essai** (≈ 30 min, § 8.2, copie d'essai, iPhone + PC) : surtout l'étape 2 (un mot de passe actuel faux doit être refusé : la documentation Supabase se contredit sur le nom du champ, § 3.2) et l'étape 9 (le lien « Ouvrir dans l'application » sur l'iPhone : hypothèse). Renvoie-moi les résultats listés en fin de § 8.2.
4. **Puis** les mêmes réglages sur le **réel**, la fusion, et **le même jour** sur chaque appareil : « ✓ synchronisé », puis F5 (cache `climpilot-next-1138-production` ; `VERSION` et `NX_VERSION` inchangés, Q10).
5. **Ensuite, un jour sans chantier** : active la double authentification **depuis le PC** (elle déconnecte tes autres appareils : règle de Supabase), reconnecte le téléphone avec le code, ajoute un appareil de secours (Q2). Garde la procédure « téléphone perdu » (§ 10).
6. **À savoir dès la fusion** : « Déconnexion » ne ferme plus que l'appareil où tu cliques ; un téléphone ouvert sans réseau ne bloque plus sur l'écran de connexion ; une session fermée ailleurs donne un bandeau, jamais un écran plein.
7. **Rien ne change dans les montants, mentions et calculs** : golden Y et Z identiques, suite W sans enveloppe nouvelle ; aucune ligne dans `supabase/` (Q1 = non ; contrôle côté serveur : mission FACT).
8. **Défaut connu, laissé à AF1-B** : « Continuer sans connexion » met l'émission en mode démonstration (C-N3, § 3.9) — sans danger aujourd'hui, la facturation réelle n'a pas démarré.
9. **Comptes** : suite AH rouge sur `main` 15 / 48, verte 64 / 0 ; batterie complète 1 676 / 0 / 0 SKIP (COMPLET, RÉUSSI) ; CI verte sur les deux événements (`df7f9ff` : 1 672 / 0 / 2 SKIP connus, première tentative ; `bff78cb` : push vert, demande de fusion verte à la 2e tentative après un plantage de la seule suite X, § 5.4) ; essai automatisé de la copie d'essai 15 / 15 (il a trouvé deux défauts, corrigés : § 6).
10. **Tes gestes hors code** : supprimer l'ancienne branche `claude/login-password-issue-f7cidd` (Q11 ; son « mot de passe oublié par e-mail » est noté dans `docs/APRES-PRO-V1.md`) ; copier ce compte rendu dans le Project (`claude/ClimPilot-COMPTE-compte-rendu.md`). Mission suivante d'après la file : P11.

## 1. Constat (certain : lu dans le code de `main` `99ddd50`, puis reproduit par les tests rouges)
- Le dossier décrivait `main` `6a89e60` ; S a ajouté une vingtaine de lignes en tête du cœur. **Tout a été retrouvé par le nom des fonctions** ; décalage uniforme de **+20 à +23 lignes**, rien d'autre n'a bougé dans ces fonctions : `showLogin` 4335 → 4358, `doLogin` 4336 → 4359, `afterLogin` 4366 → 4389, `cloudLogout` 4377 → 4400, `initCloud` 4379 → 4402, `SESS` 996 → 1016, `#loginScreen` 892 → 895, carte du code 813 → 816, `pinHash` 3143 → 3166, `resetIdle` 3146 → 3169, `pinForgot` 3153 → 3176, `pinSet` 3155 → 3178, `cpParamsEcoute` 1264 → 1285, `cpChampFiltre` 4245 → 4268, `cpSaisieEnCours` 4258 → 4281, `markDirty` 4006 → 4029, `#lockScreen` 969 → 972, lien « Déconnexion » 181-184 → 187, `NX_BK_SKIP` 2761 → 2782.
- Les constats du dossier (§ 1) sont toujours vrais sur `main` : aucun écran « Mon compte », aucun appel `updateUser` / `auth.mfa` / `onAuthStateChange` ; « Déconnexion » appelle `signOut()` sans argument (portée `global` : **tous** les appareils, alors que le message dit « sur cet appareil ») ; `SESS` jamais remise à jour ni vidée ; démarrage hors ligne au jeton expiré → écran de connexion bloquant ; texte du code PIN faux (« tes données restent uniquement sur cet ordinateur », « session Windows »).
- **Reproduit ici avec le vrai supabase-js 2.117.3 embarqué** (AH18, jeton expiré, Supabase injoignable) : écran de connexion au bout de **26 s**, 8 requêtes refusées, session toujours dans le stockage — la même mesure que le dossier (≈ 26 s).

## 2. Tests rouges d'abord (certain : exécutés le 12/11 sur le code de `main`)
- `tests/faux-auth.mjs` (nouveau) : faux serveur d'authentification. Les formes de réponse ont été relues dans `vendor/supabase-js-2.117.3.umd.js` (`signOut`, `_signOut`, `_updateUser`, `_reauthenticate`, `_enroll`, `_challenge`, `_verify`, `_challengeAndVerify`, `_unenroll`, `_listFactors`, `_getAuthenticatorAssuranceLevel`, `_refreshSession`, `__loadSession`, `_callRefreshToken`, `_removeSession`, `_emitInitialSession`) : chaque appel **rend** `{data, error}` ; coupure = `AuthRetryableFetchError`, `status: 0` ; `signOut` : `local`/`global` effacent la session et émettent `SIGNED_OUT` même si le serveur ne répond pas, `others` la garde ; `verify` enregistre la nouvelle session et émet `MFA_CHALLENGE_VERIFIED` ; niveau (`aal`) lu en local. À l'inscription d'un facteur, les autres sessions sont révoquées (documentation).
- **Code TOTP calculé par le test** (RFC 6238, HMAC-SHA1, 30 s) à partir de la graine **publique** de l'annexe B de la RFC 6238 ; test du test : les 6 valeurs de l'annexe B à 8 chiffres et T = 59 → 287082. Heure : `REF.horloge` (`tests/lib.mjs`) pour les pages et pour le serveur simulé, jamais la vraie date.
- `tests/banc-appareils.mjs` : l'authentification simulée ne s'active que si la suite la demande (`serveurCommun(…, { auth })`) ; Q, AA et AE gardent l'ancien faux client. Option `exigerJeton` : sans session, les données sont refusées comme pour un visiteur non connecté (droits retirés par P6). Seul autre changement : un message de dialogue est gardé sur 600 caractères au lieu de 300 (la confirmation « autres appareils » est longue).
- `tests/suiteAH-compte.mjs` (nouvelle, lettre AH ; AF1-B prendra AI) : AH1 à AH18 et AH20 du dossier (AH19 retiré : Q1 = non), Q8, banc deux appareils AHB1 à AHB4, deux tests du test (TOTP, QR code). Toutes les pages tournent sous la **vraie** CSP de l'appli (le banc ne l'assouplit pas). Inscrite dans `tests/run-all.sh` et `tests/isolation/rapport.mjs` (`resAH.json`).

**Sur `main` (`99ddd50`) : 15 réussis / 48 échoués** sur les 63 contrôles de la suite (relancée le 12/11 avec la suite **finale** sur `index.html` et `sw.js` de `main` : mêmes 15 / 48 qu'au premier passage). AH21 (ajouté ensuite, § 4) est rouge sur `1eeae01` et vert après. Journaux rouges gardés hors dépôt (bloc-notes de la session).
| Groupe | Sur `main` | Après |
|---|---|---|
| Test du test TOTP (RFC 6238) | vert (témoin) | vert |
| AH1 à AH8 (mot de passe, appareils, « Déconnexion ») | **rouge** : pas de carte ; « Déconnexion » en portée `global` | vert |
| AH9 à AH12, AH11 bis, AH15 (activer, QR code / lien, code faux / juste, facteur fantôme, secours, retrait) | **rouge** (le contrôle « 0 violation de la CSP » est vert sur `main` : rien n'y est affiché) | vert |
| AH13, AH14 (2e étape, démarrage `aal1` + facteur) | **rouge** : la connexion lit l'état sans demander de code | vert |
| AH14 témoins (session `aal2`, `aal2` hors ligne), AH15 « connexion suivante sans code » | vert (témoins) | vert |
| AH16 code PIN | fonctionnement : vert (témoin) ; texte : **rouge** | vert |
| AH17 session fermée pendant l'usage | **rouge** : `SESS` reste posée, pas de bandeau, « échec synchro » ; « rien n'est perdu » : vert (témoin) | vert |
| AH18 vrai supabase-js, jeton expiré, Supabase injoignable | **rouge** : écran de connexion à 26 s, pas de reprise | vert |
| AH20 sans cloud, Q8 « Continuer sans connexion » | **rouge** | vert |
| AHB1 à AHB4 (deux appareils) | **rouge** (sauf « PC toujours connecté », témoin) | vert |
| Test du test QR code | **rouge** (`cpQr` absent) | vert |
| Aucune erreur JavaScript (5 contrôles) | vert | vert |

Deux corrections **du test** faites après ce passage rouge (le code de l'appli n'y est pour rien) : (1) la référence indépendante du QR code est passée de segno 1.6.6 à qrcode 8.2, car segno ajoute toujours un octet nul de plus en mode octets — les deux QR codes sont valides et se décodent (zxing-cpp), mais leurs modules diffèrent ; (2) AH18 : la réponse simulée à `cp_state_push` était `[]`, que l'appli lit comme un conflit (rechargement pendant la lecture du test) ; elle rend maintenant `{ ok: true }`. Le banc garde aussi un message de dialogue sur 600 caractères au lieu de 300.

## 3. Correction (certain : lu et exécuté) — `index.html` et `sw.js` seulement
Code dans `index.html`, en modifiant **sur place** `showLogin`, `doLogin`, `afterLogin`, `cloudLogout`, `initCloud`, `go` (deux lignes) et `cpBusyForm` (une condition de plus, § 6) ; **aucune enveloppe** nouvelle (golden de la suite W inchangé). Aucun `catch(e){}` vide ajouté (les deux qui étaient dans `showLogin` et `cloudLogout` journalisent maintenant). Tout texte venu du serveur passe par `textContent` ou `cpEsc` ; les boutons « Retirer » portent l'identifiant et le nom du facteur dans `data-fid` / `data-nom`, lus par `this.dataset` (règle de S). Rien de ce qui est tapé n'est gardé : seul le nom, le statut HTTP et le code d'une erreur sont écrits en console. Aucune clé nouvelle dans `SYNC_KEYS` ni dans le stockage.

### 3.1 Carte « 👤 Mon compte » (Paramètres, juste avant « Sécurité — code d'accès »)
En tête : « Connecté au cloud : <adresse> », ou « Pas connecté au cloud : [Se connecter] », ou « cloud non chargé : mode local ». Sans réseau : « Pas de réseau : ces réglages demandent une connexion. » et boutons grisés (événements `online` / `offline`). Trois blocs : Mot de passe, Appareils, Double authentification ; plus « Téléphone perdu ? » (procédure courte). Identifiants `acc_…` (hors de la garde des Paramètres). Un mot de passe en cours de frappe compte comme une « saisie en cours » (pas de `data-cp-filtre`, contrairement à la proposition du dossier § 1.7 : voir § 6) ; pendant un parcours (activation, code attendu, résultat affiché depuis moins de 20 s), une mise à jour reçue d'un autre appareil attend le changement d'écran. Sans cloud, chaque bouton répond « Connecte-toi au cloud d'abord. » (AH20).

### 3.2 Changer le mot de passe (Q4, Q5)
Contrôles avant tout appel : mot de passe actuel tapé ; **12 caractères au moins, comptés par caractère** (`Array.from` : un emoji compte pour un) avec le nombre tapé ; confirmation identique ; nouveau ≠ actuel ; réseau. Puis `updateUser({ password, current_password })`. Réponses traduites : réussite (« ✓ Mot de passe changé. Note-le dans ton gestionnaire de mots de passe. » + bouton « Déconnecter aussi mes autres appareils »), `reauthentication_needed` (un seul `reauthenticate()`, champ « Code reçu par e-mail », « Renvoyer un code »), `reauthentication_not_valid`, `same_password`, `weak_password` (raisons traduites), `insufficient_aal` (code de double authentification d'abord, puis même demande), mot de passe actuel faux, limite d'essais, coupure (« Résultat inconnu… c'est le nouveau qui compte »), autre (HTTP n). Champs vidés après chaque réponse ; le nouveau mot de passe en attente d'un code reste **en mémoire seulement**, oublié en quittant les Paramètres.
- **Nom du champ du mot de passe actuel** (certain : lu) : la documentation Supabase se contredit (page « Password security » : `current_password` ; page « Password-based Auth » : `currentPassword`, « supabase-js v2.102.0+ ») ; la bibliothèque embarquée 2.117.3 ne contient **aucun** des deux noms et envoie l'objet **tel quel** au serveur. L'appli envoie donc `current_password`, le nom de l'API du serveur. À confirmer sur TEST (essai, § 8.2 étape 2) : un mot de passe actuel faux doit être refusé.

### 3.3 Appareils (Q6)
« Déconnecter mes autres appareils » : confirmation complète (dossier § 3.3), puis `signOut({ scope: 'others' })` **une seule fois** ; cet appareil reste connecté. Lien « Déconnexion » du menu : `signOut({ scope: 'local' })`, **cet appareil seulement**, comme son message le dit (correction : avant, portée `global`). Message de confirmation complété : « tes autres appareils restent connectés ».

### 3.4 Double authentification (Q2)
- **Activer** : avertissement (application d'authentification, mot de passe ET code à chaque nouvelle connexion, **tes autres appareils seront déconnectés**, prévoir un secours), nom proposé « iPhone », nettoyage des facteurs non vérifiés d'un essai précédent (`listFactors` → `unenroll`), `enroll({ factorType: 'totp', friendlyName, issuer: 'ClimPilot' })`.
- **PC** : **QR code fabriqué dans l'appli** (`cpQr` / `cpQrImage`, ≈ 60 lignes : norme ISO/IEC 18004, mode octets, correction M, masque choisi par pénalité) à partir du lien `otpauth://` rendu par le serveur ; l'image SVG du serveur n'est pas utilisée. L'image est un SVG en `data:` : **la CSP de S n'est pas élargie** (`img-src 'self' data: blob:` la permettait déjà). Vérifié module par module contre une bibliothèque indépendante (3 textes × 8 masques) et décodé par zxing-cpp (§ 4). Dessous : la clé en clair par groupes de 4 et « Copier ».
- **Téléphone** : bouton « Ouvrir dans l'application d'authentification » (lien `otpauth://`), la clé et « Copier », et le conseil « active-la depuis le PC ».
- Code juste (`challengeAndVerify`) → « ✓ Double authentification activée… Ajoute maintenant un moyen de secours » ; `SESS` = la nouvelle session (`aal2`). Code faux → « Code refusé. Vérifie que l'heure du téléphone est réglée automatiquement… » ; défi périmé → nouveau défi sans message. Annuler, ou quitter les Paramètres → le facteur non vérifié est retiré.
- **Appareil de secours** (Q2) : bouton « Ajouter un appareil de secours » une fois la double authentification active (nom proposé « Secours »).
- **Retirer** : un bouton par appareil, confirmation, `unenroll` puis `refreshSession` (le niveau redescend tout de suite). Si la session n'a pas encore donné le code (`aal1`) : bloc « code de double authentification » d'abord, puis l'action.

### 3.5 Connexion et démarrage
- `doLogin` : après le mot de passe, niveau lu **en local** ; `aal1` + facteur vérifié → **2e étape dans le même écran** (code à 6 chiffres, choix de l'appareil s'il y en a plusieurs, « Je n'ai plus mon téléphone », « Recommencer »). **`SESS` n'est posée et l'état n'est lu ni envoyé qu'après le bon code** (AH13 : 0 lecture de `climpilot_state` avant).
- `initCloud` → `cpCloudReprendre` : session `aal2` → comme avant ; session `aal1` + facteur → écran du code ; **erreur réseau** au démarrage (jeton expiré, Supabase injoignable) → **pas d'écran de connexion** (Q7) : étiquette « ⌛ hors ligne — connexion au retour du réseau », nouvel essai à l'événement `online`, toutes les 30 s tant que l'on attend (la bibliothèque garde un échec de renouvellement 60 s : lu dans `_callRefreshToken`), et au renouvellement réussi de la bibliothèque (`TOKEN_REFRESHED`).
- **« Continuer sans connexion »** (Q8) : sur l'écran de connexion, **seulement si l'appareil a déjà synchronisé** (`cp2_sync.lastRemote`), y compris à la 2e étape (téléphone perdu). L'appli s'ouvre sur les données de l'appareil, étiquette « ⏸ synchro en pause — non connecté ».

### 3.6 Session fermée pendant l'usage
`onAuthStateChange` écouté une fois (`initCloud`) : `TOKEN_REFRESHED`, `USER_UPDATED`, `MFA_CHALLENGE_VERIFIED`, `SIGNED_IN` → `SESS` suit (les 9 couches qui lisent `SESS` suivent sans changement) ; `SIGNED_OUT` → `SESS = null`, étiquette « ⚠ déconnecté du cloud », **bandeau non bloquant** : « Ta connexion au cloud a été fermée (mot de passe changé, appareils déconnectés, ou double authentification activée ailleurs). Tes données sont sur cet appareil ; des modifications attendent l'envoi : elles partiront après ta reconnexion. » [Se reconnecter] [Plus tard], placé sous la barre d'état de l'iPhone (zone sûre de l'écran). **Sans nombre** (point 1 de la relecture du dossier : le compteur `_cpEcritures` est en mémoire et repart à zéro ; le compteur fiable viendra avec AF1-B) ; s'il n'y a rien à envoyer : « ce que tu modifies maintenant partira après ta reconnexion ». Jamais d'écran plein au milieu d'un formulaire : l'écran de connexion n'apparaît qu'au clic sur « Se reconnecter » ou au lancement suivant. Rien n'est appelé dans le rappel de la bibliothèque (elle l'attend sous verrou). `afterLogin` peut maintenant servir plusieurs fois (reconnexion) : ses écouteurs ne sont posés qu'une fois.

### 3.7 Code PIN : même fonctionnement, texte honnête
Seul le texte de la carte change (dossier § 3.8, mot pour mot) ; `pinSet`, `pinHash`, `lockApp`, `resetIdle`, `tryUnlock`, `pinForgot`, `pinRemove` inchangés (AH16 témoin vert sur `main` et après).

### 3.8 Ce qui ne change pas
Données synchronisées, `cp_state_push`, fusion (P3), émission, signature, Super PDP ; aucun montant, aucune règle fiscale, aucune mention : golden Y et Z identiques. `VERSION` et `NX_VERSION` inchangés (Q10, 1.13.0). `sw.js` : `C` passe de `1137` à **`1138`** (une fois). Aucune ligne dans `supabase/`.

### 3.9 Défaut connu, laissé tel quel (point 2 de la relecture du dossier)
« Continuer sans connexion » et le bandeau `SIGNED_OUT` laissent `SESS = null` ; `mode()` de `next-emission.js` rend alors « démonstration » (défaut C-N3, qui reste dans AF1-B). **Non corrigé ici. Sans danger aujourd'hui : la facturation réelle n'a pas démarré.** Probable (lu, non exécuté pour l'émission).

## 4. Test vert (certain)
- **Suite AH sur le code corrigé** (`df7f9ff`) : **64 réussis / 0 échoué** (≈ 210 s), sous la CSP réelle.
- **AH21** (ajouté pendant l'essai automatisé, § 6) : une mise à jour reçue de l'autre appareil pendant un parcours « Mon compte ». Rouge sur `1eeae01` (2 rechargements de la page : mot de passe en cours de frappe effacé, activation de la double authentification perdue), vert sur `df7f9ff`.
- **QR code** : identique module par module à qrcode 8.2 (Python, bibliothèque indépendante) pour 3 textes (versions 3, 8 et 11, dont un avec le bloc de version) et les 8 masques ; les QR codes de l'appli (masque choisi par l'appli) ont été décodés par zxing-cpp 3 fois sur 3 avec le texte exact. Hors dépôt : segno 1.6.6, qrcode 8.2, zxing-cpp, installés dans un environnement Python jetable du bloc-notes.

## 5. Batterie, horloges, CI (certain)
### 5.1 Suites visées (`CP_SUITES`, code de `1eeae01`, 12/11)
AH **63 / 0** (la suite d'alors) ; AB **86 / 0** (règles de S : `cpEsc`, aucun texte libre dans un bouton, CSP) ; A 14 / 0 (les nouveaux boutons répondent sans cloud) ; C 17 / 0 (`cp2_pin` hors des sauvegardes) ; H 46 / 0 ; I 43 / 0 ; N 37 / 0 ; Q **64 / 64** ; U 90 / 0 ; V 8 / 0 ; W **64 / 0 (golden `enveloppes.json` inchangé : aucune enveloppe nouvelle)** ; X 8 / 0 ; Y **21 / 0 (golden identiques, les 5 « À TRANCHER » inchangés)** ; Z **55 / 0 (identiques)** ; AA 16 / 0 ; AE 26 / 0 ; fonctions serveur 90 / 0. Total : **845 réussis / 0 échoué**, rapport PARTIEL (code 3) par construction.

### 5.2 Batterie complète (`bash tests/run-all.sh`, tête `df7f9ff`, 12/11, un seul passage)
**COMPLET, RÉUSSI — 1 676 réussis / 0 échoué / 0 SKIP**, 5 non bloquants « À TRANCHER » (suite Y, les mêmes que sur `main`). C'est le compte de S-bis (1 612) plus les 64 contrôles de la suite AH. Q 64 / 64 (438 s), X 8 / 0, AH 64 / 0 (204 s), SQL 66 / 0, aperçu 11 / 0. Le test de construction de la copie d'essai (suite AB, AB10) est vert.

### 5.3 Indépendance du jour (règle 9)
La suite AH ne lit jamais la vraie date (`REF.horloge` pour les pages et le serveur simulé, code TOTP calculé à cette heure-là). Sous `faketime` : « 2026-11-14 10:00 » (samedi), « 2026-11-15 10:00 » (dimanche), « 2027-01-05 10:00 » : suite AH **64 / 0 aux trois dates** (rapport PARTIEL, code 3, par construction). Les autres suites ne sont pas touchées par l'horloge de COMPTE.

### 5.4 CI (`.github/workflows/tests.yml`, contrôle « batterie complète »)
- Tête `1eeae01` (« code »), événement push (run 43241707972) : **vert, première tentative** — COMPLET, RÉUSSI, **1 671 réussis / 0 échoué / 2 SKIP connus** (isolation du noyau absente sur le runner), 5 non bloquants. Q 64 / 64, X 8 / 0 (lus) ; AH 63 / 0 dont AH18 avec le vrai supabase-js (probable : déduit du total, 1 608 de S-bis + 63 ; la ligne d'AH n'a pas été relue dans ce rapport).
- Tête `df7f9ff` (« correction trouvée par l'essai »), **les deux événements, première tentative** : push (run 43248803479) **vert**, COMPLET, RÉUSSI, **1 672 réussis / 0 échoué / 2 SKIP connus** ; demande de fusion #24 (run 43248828794) **vert**, code 0 (COMPLET, RÉUSSI : le contrôle ne passe au vert qu'avec le code 0 ; compte détaillé non relu, le rapport de cet événement est attaché au commit de fusion). La suite X n'a **pas** planté (pas de ligne « DIAGNOSTIC rechargement hors ligne »), aucune relance.
- Tête `bff78cb` (« documents », aucun code changé) : push (run 43255729186) **vert, première tentative** — COMPLET, RÉUSSI, **1 672 / 0 / 2 SKIP connus**. Demande de fusion (run 43255742652), **tentative 1 : ÉCHEC, la seule suite X en cause** (certain : rapport lu) — tout le reste vert, 1 664 réussis / 0 échoué (les 1 672 moins les 8 de X), AH 64 / 0. Ligne recopiée telle quelle du rapport, comme le demande la consigne :
  > `DIAGNOSTIC rechargement hors ligne — page.reload: Timeout 90000ms exceeded. | page : {"erreur":"page muette (5 s)"} | service workers : 1 | erreurs : [] | réponses en erreur : [] | requêtes sans réponse (0) :`
  Lecture (probable) : la page ne répond plus du tout pendant 5 s après le rechargement hors ligne (« page muette »), avec un service worker actif, **aucune** requête en attente et aucune erreur : ce n'est ni une ressource qui manque ni une lenteur réseau, plutôt un rechargement figé côté navigateur ou pilotage du service worker par Playwright — la même instabilité connue depuis S (`docs/S-COMPTE-RENDU.md` § 10.5), sur un commit qui ne touche aucun fichier de l'appli. **Les seuls travaux échoués ont été relancés une fois** (aucun commit vide, aucune suite désactivée) : **tentative 2 verte** (code 0 : COMPLET, RÉUSSI ; suite X passée). Une petite mission OUTILLAGE pour la suite X reste à décider par Gab (déjà proposée en S-bis).
- Tête de ce commit (« documents », CI) : résultat sur la demande de fusion #24 et dans le message de fin de session.

## 6. Essai automatisé de la copie d'essai (certain : exécuté par Claude le 12/11, hors dépôt)
**Méthode.** Copie d'essai construite par `tools/essai/construire-copie-essai.sh` depuis `df7f9ff`, **hors dépôt** (bloc-notes de la session), `essai-config.js` rempli avec l'adresse **fictive** `https://xxxx.supabase.co` et une clé fictive (jamais l'hôte réel, jamais l'hôte TEST) ; la copie servie à la place de l'appli ; Supabase remplacé par le serveur simulé du banc (`tests/faux-auth.mjs`) ; navigateur lancé comme dans la batterie, avec son mandataire « refus » (toute requête vers l'extérieur refusée), mais hors de l'espace réseau isolé du noyau. **PC 1440 × 900** et **iPhone 390 × 844** (Chromium 141 en émulation iPhone 13, zone d'affichage réglée à 844). Script et 15 captures dans le bloc-notes de la session (hors dépôt) ; **je les ai regardées**.

**Résultat : 15 étapes sur 15 conformes**, sur la tête `df7f9ff` :
| Étape (§ 6.4 du dossier) | Résultat |
|---|---|
| 0. La page servie est bien la copie d'essai (bande rouge, adresse fictive) ; PC et iPhone connectés, synchronisés | conforme |
| 1. PC : 11 caractères → « Trop court » | conforme |
| 2. PC : 12 caractères et plus → « ✓ Mot de passe changé » + « Déconnecter aussi mes autres appareils » ; iPhone : bandeau « connexion fermée », pas d'écran plein, données là | conforme |
| 3. iPhone : reconnexion avec le nouveau mot de passe, synchro | conforme |
| 4. PC : QR code affiché sous la CSP, **capture décodée par zxing-cpp = le lien `otpauth://` exact** ; faux code → « Code refusé » ; bon code → « Activée : 1 appareil (« iPhone ») » | conforme |
| 5. iPhone : mot de passe, **puis** écran du code, puis connecté | conforme |
| 6. PC : retrait → « Désactivée » ; iPhone : « Déconnexion » (le PC reste connecté), reconnexion sans code | conforme |
| 7. iPhone : nouveau texte du code PIN ; pose, verrou, déverrouillage, retrait comme avant | conforme |
| 8. iPhone rouvert hors ligne au jeton expiré : l'appli s'ouvre, « hors ligne », pas d'écran de connexion ; réseau revenu : session reprise seule | conforme |
| Q8. iPhone déjà synchronisé : « Continuer sans connexion », appli ouverte en local | conforme |
| Tous les écrans du menu, **32 écrans × 2 appareils** : **0 ligne « Content Security Policy », 0 erreur JavaScript** (sur toute la durée de l'essai) | conforme |

**Ce que l'essai a trouvé, et qui est corrigé dans `df7f9ff`** (certain) :
1. Une **fusion reçue de l'iPhone rechargeait la page du PC** juste après le changement de mot de passe : le message « ✓ Mot de passe changé » disparaissait ; le même rechargement pouvait effacer un mot de passe en cours de frappe ou interrompre une activation (QR code perdu, facteur non vérifié laissé sur le serveur jusqu'au prochain essai). Correction : `cpBusyForm` (modifiée sur place) attend aussi pendant un parcours « Mon compte » ; la carte n'a plus `data-cp-filtre` (un mot de passe tapé est une « saisie en cours », comme dans le reste des Paramètres) — **écart à la proposition du dossier (§ 1.7), choisi pour ne rien effacer** ; test AH21.
2. Le **bandeau « connexion fermée »** passait sous la bande rouge de la copie d'essai, et passerait sous la barre d'état d'un iPhone (appli posée sur l'écran d'accueil, style `black-translucent`) : il se place maintenant sous la zone sûre de l'écran (`env(safe-area-inset-top)`) et sous la bande d'essai.

**À savoir** (certain, vu sur les captures) : sur l'iPhone, l'étiquette « ⌛ hors ligne » est dans le **pied du menu ☰** (comme toutes les étiquettes de synchro) : l'appli s'ouvre normalement, il faut ouvrir le menu pour la voir.

**Ce qu'il reste à Gab** : tout ce qui demande le vrai Supabase ou un vrai appareil (§ 8.2) — en particulier le refus d'un mot de passe actuel faux, l'effet réel sur les sessions, le scan par une vraie application, l'ouverture du lien `otpauth://` par l'iPhone, les e-mails de sécurité, le vrai mode avion.

## 7. Réglages du tableau de bord Supabase (gestes de Gab : TEST d'abord, puis le réel)
Noms relevés dans la documentation Supabase du 12/11 (pages « Password security », « Email Templates », « Auth MFA ») ; **l'écran exact n'a pas été vu** (aucun accès au tableau de bord) : si un nom diffère, note-le, je l'écrirai. Avant de changer quoi que ce soit, **note la valeur d'avant** de chaque réglage (retour arrière).
1. Ouvre le tableau de bord du projet **ClimPilot-TEST**.
2. **Authentication › Sign In / Providers › Email** (la doc envoie sur « Auth Providers › Email ») :
   - a. « Minimum password length » : **12** (Q5). Attendu : le serveur refuse ensuite un mot de passe plus court, même hors de l'appli ; ton mot de passe actuel continue de marcher (la connexion n'est pas bloquée par un ancien mot de passe court).
   - b. « Password requirements » (caractères exigés) : **laisse tel quel** (ta décision ; l'appli traduit le refus si tu l'actives).
   - c. « Require current password when changing password » (ou « Require current password ») : **activé** (Q4).
   - d. « Secure password change » / « Require reauthentication when changing password » : **désactivé** (Q4 : pas de code par e-mail). L'appli sait quand même gérer le code si le serveur le demande.
   - e. « Prevent use of leaked passwords » : réservé au plan Pro, rien à faire.
3. **Authentication › Multi-Factor** (MFA) : « TOTP (App Authenticator) » doit être **activé** (inscription et vérification) ; c'est la valeur par défaut d'après la doc : vérifie seulement.
4. **Authentication › Emails** (page « Email Templates »), rubrique des **notifications de sécurité** (Q9) : active « Password changed », « Verification method added » et « Verification method removed ». Attendu : un e-mail à chaque changement de mot de passe et à chaque appareil de double authentification ajouté ou retiré. (Les autres — adresse e-mail changée, etc. — à ton choix.)
5. **Sessions** (durée maximale, inactivité, une seule session) et **durée du jeton** : **ne touche à rien** (Q3) ; la limite des sessions est réservée au plan Pro (juin 2027) ; le jeton reste à 1 h.
6. Fais l'essai du § 8 sur TEST. Puis **refais les étapes 2 à 5 sur le projet RÉEL**, après l'essai et avant la fusion (ordre du § 9).

## 8. L'essai que tu fais (≈ 30 min, copie d'essai sur TEST, PC + iPhone)
### 8.1 Déjà fait par l'essai automatisé (§ 6) : tu n'as pas besoin de le refaire en détail
Mot de passe trop court, changement réussi, proposition « autres appareils », bandeau sur l'autre appareil, reconnexion, QR code (décodé par une machine), code faux / juste, 2e étape à la connexion, retrait du facteur, « Déconnexion » de cet appareil seulement, texte et fonctionnement du code PIN, démarrage hors ligne au jeton expiré, « Continuer sans connexion », tous les écrans du menu sans erreur ni violation de la CSP. **Mais tout cela avec un faux serveur** : ce qui suit vérifie le vrai Supabase et les vrais appareils.
### 8.2 À faire par toi, sur l'iPhone et le PC
Avant de commencer : réglages du § 7 faits sur **TEST** ; copie d'essai construite depuis cette branche (`bash tools/essai/construire-copie-essai.sh`, `essai-config.js` rempli avec TEST, comme d'habitude) et ouverte sur le PC **et** sur l'iPhone, connectée ; une application d'authentification sur l'iPhone (celle de « Mots de passe » suffit). Note l'heure de chaque étape.
1. **PC** : Paramètres › Mon compte. Attendu : « Connecté au cloud : » suivi de ton adresse.
2. **(Obligatoire avant la fusion — COMPTE-bis.)** **PC** : mot de passe actuel **faux**, nouveau de 12 caractères ou plus (deux fois), « Changer le mot de passe ». Attendu : « Mot de passe actuel incorrect. » — **c'est le point que la machine n'a pas pu vérifier** (réglage Q4 et nom du champ, § 3.2). Si tu vois « ✓ Mot de passe changé » : le serveur n'a pas vérifié l'ancien → dis-le moi (réglage pas pris, ou nom du champ). Si tu vois « Erreur du serveur (HTTP …) : … » : recopie le texte exact.
3. **PC** : mot de passe actuel juste, nouveau de 12 caractères ou plus. Attendu : « ✓ Mot de passe changé… » et le bouton « Déconnecter aussi mes autres appareils ». Note le nouveau mot de passe dans ton gestionnaire. Attendu par e-mail (si l'étape 4 du § 7 est faite) : « Your password was changed ».
4. **iPhone**, sans rien toucher pendant 5 minutes : regarde si un bandeau « Ta connexion au cloud a été fermée » apparaît **déjà** (le changement de mot de passe seul ferme-t-il les autres sessions ? la documentation est vague, risque R10). Note oui / non.
5. **PC** : clique « Déconnecter aussi mes autres appareils » → la confirmation dit « Cet appareil reste connecté » → OK. Attendu : « ✓ Tes autres appareils sont déconnectés (effet complet en 1 heure au plus). » Puis **iPhone** : dans l'heure (ou en rouvrant l'appli plus d'une heure après), bandeau « Ta connexion au cloud a été fermée… » en haut, **pas** d'écran plein ; tes devis et clients toujours là. Note le délai constaté.
6. **iPhone** : « Se reconnecter » → nouveau mot de passe. Attendu : connecté, « ✓ synchronisé ».
7. **PC** : « Activer la double authentification » → lis l'avertissement → « Continuer ». Attendu : un QR code, la clé en groupes de 4, « Copier ». **iPhone** : scanne le QR code avec l'application d'authentification. **PC** : tape d'abord un code **faux** (par exemple 000000). Attendu : « Code refusé. Vérifie que l'heure du téléphone… ». Puis le code affiché par l'iPhone. Attendu : « ✓ Double authentification activée… », état « Activée : 1 appareil (« iPhone ») » ; e-mail « A new verification method was added ».
8. **iPhone** : attendu, un bandeau « connexion fermée » (l'activation déconnecte les autres appareils, règle de Supabase) → « Se reconnecter » → mot de passe → **puis** l'écran « Code de double authentification » → code de l'application. Attendu : connecté, synchro.
9. **iPhone** : Paramètres › Mon compte › « Ajouter un appareil de secours » → « Continuer ». Attendu : pas de QR code, mais le bouton « Ouvrir dans l'application d'authentification ». Touche-le. **Hypothèse à vérifier** : l'iPhone propose d'ajouter le code dans « Mots de passe ». Si rien ne s'ouvre, « Copier » la clé et ajoute-la à la main dans l'application ; dis-moi lequel des deux a marché. Tape le code du nouvel élément → « ✓ « Secours » ajouté ». État : « 2 appareils ».
10. **PC** : « Retirer » à côté de « Secours » puis de « iPhone » (confirmation à chaque fois). Attendu : « Désactivée » ; e-mails « A verification method was removed ». Puis « Déconnexion » (menu) sur le PC et reconnexion : **mot de passe seul**, pas de code.
11. **iPhone** : à l'étape 10, le lien « Déconnexion » du PC ne doit **pas** avoir déconnecté l'iPhone : modifie un client sur l'iPhone. Attendu : « ✓ synchronisé », et la modification arrive sur le PC.
12. **iPhone** : Paramètres › « Sécurité — code d'accès ». Attendu : le nouveau texte (« Il ne protège pas d'un vol… ») ; pose un code 1234, verrouille (recharge la page), déverrouille, puis « Désactiver le code » : comme avant.
13. **iPhone** : mode avion, attends **plus d'une heure**, rouvre la copie d'essai. Attendu : l'appli s'ouvre sur tes données, étiquette « ⌛ hors ligne — connexion au retour du réseau » (dans le menu ☰), **pas** d'écran de connexion. Retire le mode avion. Attendu : en une minute environ, l'étiquette repasse à « ✓ synchronisé », sans rien taper.
14. **PC** : « Déconnexion » → sur l'écran de connexion, « Continuer sans connexion ». Attendu : l'appli s'ouvre, étiquette « ⏸ synchro en pause — non connecté ». Puis Paramètres › Mon compte › « Se connecter ».
15. *(Recommandé, 10 min de plus)* Procédure « téléphone perdu » sur **TEST** avec un **compte d'essai** (pas le tien) : active la double authentification sur ce compte, puis applique le § 10, étape 2 (a, sinon b). Attendu : reconnexion avec le mot de passe seul.
16. *(COMPTE-bis)* **iPhone** : connecté, puis mode avion ; attends **plus d'une heure** ; rouvre la copie d'essai (étiquette « ⌛ hors ligne » dans le menu ☰) ; menu ☰ › « Déconnexion » → OK. Attendu : l'appli se recharge sur l'**écran de connexion**. Retire le mode avion et attends 2 minutes sans rien toucher. Attendu : l'iPhone **reste déconnecté** (écran de connexion, aucune synchro) ; le PC, lui, reste connecté. Puis reconnecte l'iPhone normalement.

Ce que j'ai besoin que tu me renvoies : le résultat des étapes **2** (message exact ; obligatoire avant la fusion), **16** (reste déconnecté : oui / non), **4** (oui / non), **5** (délai), **9** (lien ou copie de la clé), **15**, et le texte de tout message « Erreur du serveur ». Tout le reste : « conforme » suffit.

## 9. Ordre de déploiement (dossier § 6.3, adapté à Q1 = non)
1. ~~S fusionnée, F5 partout~~ (fait).
2. Branche `correctif/compte` : tests rouges (journal gardé), code, suite AH, batterie complète, CI verte — **fait** (§ 4 et § 5) ; **relecture P10 par l'autre modèle (Fable 5.1, après le 15/11)** : à venir.
3. Toi, sur **TEST** : réglages du § 7 ; essai du § 8.2 ; procédure « téléphone perdu » répétée sur TEST avec un compte d'essai (§ 10, étape 2).
4. Mêmes réglages sur le **réel** (§ 7, étapes 2 à 5).
5. Fusion de la demande de fusion ; le même jour, sur chaque appareil : attendre « ✓ synchronisé », puis F5 (cache `climpilot-next-1140-production` depuis COMPTE-ter).
6. **Un jour sans chantier** : activer la double authentification **depuis le PC** ; reconnecter le téléphone avec le code ; ajouter le moyen de secours (Q2).
7. (Q1 = non) Pas de script serveur ni de déploiement de fonction dans COMPTE ; contrôle côté serveur : mission FACT.

## 10. Téléphone perdu : procédure (dossier § 3.7)
Aussi dans l'appli : lien « Je n'ai plus mon téléphone » (2e étape de connexion) et « Téléphone perdu ? » (Mon compte).
1. **Avec un moyen de secours** (2e appareil inscrit, ou clé gardée à part) : connecte-toi avec lui (choisis-le dans la liste de la 2e étape), puis Paramètres › Mon compte : retire l'appareil perdu, « Déconnecter mes autres appareils », change le mot de passe.
2. **Sans moyen de secours** : depuis un ordinateur, tableau de bord Supabase du projet **réel** :
   - a. Authentication › Users › ton compte : cherche une action qui retire les facteurs de double authentification (hypothèse : elle existe dans l'écran du compte ; non trouvée dans la documentation lue) ;
   - b. sinon, SQL Editor (hypothèse à **répéter d'abord sur TEST, avec un compte d'essai**) :
     ```sql
     -- 1) voir ce qui sera retiré
     select f.id, f.friendly_name, f.factor_type, f.status, f.created_at
       from auth.mfa_factors f join auth.users u on u.id = f.user_id
      where u.email = '<ton adresse e-mail>';
     -- 2) retirer
     delete from auth.mfa_factors f using auth.users u
      where u.id = f.user_id and u.email = '<ton adresse e-mail>';
     ```
   - c. reconnecte-toi avec le mot de passe seul ; réactive la double authentification avec le nouveau téléphone.
3. En attendant, sur un appareil déjà synchronisé : « Continuer sans connexion » donne accès aux données qui y sont.
4. Note l'incident dans le registre des violations (`docs/RGPD-registre.md`, « Violations de données ») : le téléphone contenait des données de clients.
5. **Piège** : si ton **compte Supabase** (celui du tableau de bord) a lui aussi une double authentification sur le même téléphone, l'étape 2 devient impossible. Garde un 2e moyen pour les deux.

## 11. Ce que ça change pour toi (visible)
- Paramètres : nouvelle carte « 👤 Mon compte » (mot de passe, appareils, double authentification) ; nouveau texte de la carte du code PIN (le code marche comme avant).
- « Déconnexion » ne ferme plus que l'appareil où tu cliques (avant : tous).
- Téléphone ouvert sans réseau après plus d'une heure : l'appli s'ouvre, étiquette « hors ligne », plus d'écran de connexion bloquant ; la session reprend seule au retour du réseau.
- Session fermée par un autre appareil : un bandeau en haut, jamais un écran plein ; « Se reconnecter » quand tu veux.
- Écran de connexion : « Continuer sans connexion » sur un appareil déjà synchronisé ; 2e étape quand la double authentification est active.
- Tant que tu n'actives pas la double authentification, la connexion reste « mot de passe seul ».

## 12. Ce qui n'a pas pu être vérifié (et pourquoi)
- **Le vrai Supabase (TEST ou réel)** : rien n'a été lu ni écrit. Donc non vérifiés : le code d'erreur exact d'un mot de passe actuel faux et le nom du champ attendu (§ 3.2 : hypothèse `current_password`, la doc se contredit) ; l'effet d'un changement de mot de passe sur les autres sessions (R10) ; le délai réel de la révocation (≤ 1 h d'après la doc) ; l'envoi du code de ré-authentification par e-mail et les limites d'envoi ; les e-mails de sécurité ; les limites d'essais du code ; les noms exacts des écrans du tableau de bord (§ 7). → essai du § 8.2.
- **De vrais appareils** : iPhone et Safari réels (Chromium 141 seulement, en émulation iPhone 13) ; le scan du QR code par une vraie application d'authentification (décodé ici par zxing-cpp, qui lit les QR codes comme un téléphone, mais ce n'est pas un téléphone) ; l'ouverture du lien `otpauth://` par l'iPhone (hypothèse) ; le vrai mode avion (simulé par une coupure du réseau de la page).
- **La vraie bibliothèque** n'est utilisée que dans AH18 (démarrage hors ligne, jeton expiré, puis reprise) ; ailleurs, le faux client imite ses réponses telles que lues dans `vendor/` (certain pour les formes, probable pour l'enchaînement exact des événements). Le renouvellement automatique du jeton (toutes les 30 s dans la bibliothèque) est remplacé, dans le banc, par un renouvellement à la demande du test.
- **La procédure « téléphone perdu »** (§ 10, SQL sur `auth.mfa_factors`) n'a pas été exécutée (aucune base touchée) : à répéter sur TEST (essai, étape 15).
- **L'émission en mode réel avec `SESS` vide** (défaut C-N3, § 3.9) : non rejoué ; reste dans AF1-B.
- **Relecture P10** : pas faite (règle 12 : par l'autre modèle, Fable 5.1, après le 15/11).

## 13. Clôture
- **`git diff --stat`** (`main` `99ddd50` → tête de la branche) — appli et tests : `index.html` 472 lignes (≈ 450 ajoutées : carte, écran de connexion, bloc COMPTE dont ≈ 60 pour le QR code, 6 fonctions modifiées sur place), `sw.js` 1 ligne (cache 1138) ; `tests/faux-auth.mjs` 234 (nouveau), `tests/suiteAH-compte.mjs` 524 (nouvelle), `tests/banc-appareils.mjs` 24, `tests/run-all.sh` 3, `tests/isolation/rapport.mjs` 2. Documents : `docs/COMPTE-COMPTE-RENDU.md` (nouveau), `docs/FILE-DES-MISSIONS.md`, `docs/APRES-PRO-V1.md` (4 lignes datées du 12/11), `tests/LISEZMOI.md`. **Aucun fichier dans `supabase/`, `vendor/`, ni d'autre couche `next-*.js`.**
- **Contrôle des secrets** : `bash tools/claude/verif-secrets.sh` avant chaque commit, `--branche` avant chaque push : **rien signalé** (aucune dérogation `CP_SECRETS_OK`). Données des tests et de l'essai : compte `essai@exemple.invalid`, mots de passe d'essai, graine TOTP **publique** de la RFC 6238, clients « Client … » fictifs, adresse `https://xxxx.supabase.co` fictive ; ni secret ni donnée personnelle.
- **Commits** (adresse `noreply`, messages en français), poussés **sur `correctif/compte` seulement** : `07148c6` « tests d'abord » ; `1eeae01` « code » ; `df7f9ff` « correction trouvée par l'essai automatisé » (avec AH21) ; puis ce commit « documents ». Demande de fusion **[gablry8/cp-gl2607#24](https://github.com/gablry8/cp-gl2607/pull/24)**, en brouillon.
- **Jamais** : push sur `main`, fusion, push forcé, réécriture d'historique, suppression de branche, déploiement, écriture Supabase (RÉEL ou TEST), réglage du tableau de bord.
- **Écarts à connaître** : (1) trois corrections **du test** après le passage rouge (référence du QR code, réponse simulée d'AH18, longueur des messages de dialogue du banc ; § 2) — le compte rouge a été refait avec la suite finale ; (2) **AH21 ajouté pendant l'essai automatisé**, avec sa preuve rouge sur `1eeae01` (§ 4, § 6) ; (3) la carte n'a pas `data-cp-filtre`, contrairement à la proposition du dossier (§ 1.7), pour ne rien effacer pendant une frappe (§ 6) ; (4) les numéros de ligne du dossier avaient bougé de +20 à +23 (§ 1).
- **Relecture P10** : pas faite ici (règle 12) ; à faire par Fable 5.1 après le 15/11 avec le skill `relecture-p10`. Fichiers à relire : `index.html` (bloc « COMPTE », `go`, `cpBusyForm`, écran de connexion, carte « Mon compte », carte du code PIN), `sw.js`, `tests/faux-auth.mjs`, `tests/banc-appareils.mjs`, `tests/suiteAH-compte.mjs`, et ce compte rendu.
- Copie de ce compte rendu dans le Project (`claude/ClimPilot-COMPTE-compte-rendu.md`) : **à faire** (outil Projects absent de cette session).
