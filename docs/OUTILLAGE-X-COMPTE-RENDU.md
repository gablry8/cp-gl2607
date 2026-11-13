# ClimPilot — Mission OUTILLAGE-X : suite X (mise à jour du cache, puis ouverture hors ligne) fiable sur la CI — compte rendu

> Rédigé le 13/11/2026 par Claude (Opus 5.5), **exécutant** de la mission. Relecture à faire par l'autre modèle (Fable 5.1, skill `relecture-p10`).
> Branche **`outillage/suite-x`**, partie de `origin/main` = `99ddd50`. Demande de fusion **#25, en brouillon**. **Aucun fichier de l'appli** (ni `index.html`, ni `sw.js`, ni `next-*.js`, ni `vendor/`, ni `supabase/`).
> **Pas d'outil Projects dans cette session** : la copie `claude/ClimPilot-OUTILLAGE-X-compte-rendu.md` dans le Project **n'est pas faite** (geste de Gab ou de la prochaine session qui a l'outil). La mission n'en dépendait pas.
> Certitude : **certain** (lu ou exécuté ici), **probable** (déduit), **hypothèse**. Bancs, copies mutées et journaux **hors dépôt** (dossier de travail de la session, effacé avec elle) ; les lignes utiles sont recopiées ici.

## Ce que Gab décide / fait (dans l'ordre)

1. **Cause trouvée** (certain, reproduite à coup sûr) : ni l'appli, ni le mode hors ligne. Le test rouvrait l'appli à heure fixe, parfois **pendant** l'installation de la nouvelle version du service worker ; Playwright reste branché sur le service worker, et alors Chromium ne termine plus jamais la navigation suivante. Même Chromium sans rien de branché (comme ton téléphone) : la page se charge (§ 2.4).
2. **Ce qui change** (test seul, `tests/suiteX-mise-a-jour.mjs`) : le test attend que la mise à jour soit **finie** avant de rouvrir l'appli ; le contrôle hors ligne est **plus sévère** (§ 3). Aucune relance automatique.
3. **Rien n'est affaibli** : les 8 contrôles restent ; mutations (a) et (b) **rouges**. **La (b) passait sur la suite actuelle** (8 / 8 avec un fichier absent du cache) : elle est rouge maintenant (§ 5).
4. **Rouge → vert** : suites non modifiées, même condition : ancienne 1 plantage sur 6 (signature de la CI), nouvelle 0 sur 6 (§ 4).
5. **Local** : 50 passages de suite (25 sur un cœur occupé) **50 × 8 / 0** ; faketime 3 dates 8 / 0 ; batterie complète **1 612 / 0 / 0 SKIP** (§ 6).
6. **CI** : toutes vertes, suite X 8 / 0 en 13 à 15 s, voir le tableau § 7 (tête finale : 3 passages complets des deux événements).
7. **Ton seul geste** : relecture par **Fable 5.1** (`relecture-p10`), puis fusion de **#25**. Avant ou après COMPTE : **pas de conflit** (`git merge-tree`, § 8) ; la nouvelle suite X passe aussi sur l'arbre fusionné avec COMPTE.
8. Rien à faire sur les appareils (aucun fichier de l'appli, pas de F5). `docs/FILE-DES-MISSIONS.md` non touché (interdit ici) : ligne proposée § 8.1.
9. `git diff --stat` : 3 fichiers (le test, un paragraphe du LISEZMOI, ce compte rendu), § 8.

---

## 1. Constat de départ (certain : rapports de CI lus par S, S-bis et COMPTE ; `docs/S-COMPTE-RENDU.md` § 10.5, `docs/COMPTE-COMPTE-RENDU.md` § 5.4 sur `origin/correctif/compte`)
Sur la CI, le rechargement hors ligne de l'étape 3 de la suite X n'atteignait parfois jamais « load » et plantait au bout de 90 s, surtout sur l'événement « demande de fusion » (≈ 1 fois sur 3 à 4). Dernière ligne de diagnostic (CI de `bff78cb`) : `page : {"erreur":"page muette (5 s)"} | service workers : 1 | erreurs : [] | réponses en erreur : [] | requêtes sans réponse (0)`.

## 2. Recherche de la cause

### 2.1 Reproduction locale (certain : exécuté)
- Même machine que la CI pour ce qui compte : Ubuntu 24.04, Node 22, **Playwright 1.56.1 / Chromium 141** (`chromium-1194`), suite lancée **sans** l'isolation du noyau (comme sur le runner, où `unshare -n` est indisponible), avec les variables de `run-all.sh` (`PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`, garde réseau Node).
- Copie instrumentée de la suite **hors dépôt** (port réglable, journal du protocole Playwright `DEBUG=pw:protocol`, états du service worker lus par le domaine CDP `ServiceWorker`). **Reproduit dès le premier passage** quand le journal du protocole ralentit l'ensemble (2 plantages sur 6 ; plus 1 sur 1 avec la seule lecture des états du service worker), avec **exactement** la signature de la CI : page muette, 1 service worker, 0 requête en attente côté page.
- Sans journal du protocole, la course ne s'est pas produite en 24 passages (3 boucles de 8 en parallèle, un cœur chacune ; deux de ces boucles étaient des variantes, sans l'interception Playwright du service worker et sans `setOffline`) : c'est un problème de **moment**, qui dépend de la vitesse de la machine.

### 2.2 Ce que montrent les journaux (certain : lu dans le journal du protocole et les états du service worker)
Chronologie d'un passage planté (temps en ms depuis l'ouverture de la page) :
```
4678  v1 (nouvelle version, cache 1137) : installation commence
5169  --- rechargement 2 de l'étape 2 (réouverture à heure fixe, 2,5 s après le 1er)
5217  v1 installée (en attente d'activation, skipWaiting demandé)
5229  v0 (ancienne version) arrêtée par Chromium pour laisser la place…
5256  …puis RELANCÉE aussitôt pour servir le rechargement en cours
9248  --- caches : ["…0000-ancienne","…1137-production"]   ← l'ancien cache est encore là
9251  --- hors ligne + rechargement
9264  v0 arrêtée, déclarée périmée ; v1 « activating »
10266 v1 activée
      … la navigation lancée à 9251 ne se termine jamais (90 s)
```
- Le rechargement hors ligne part alors que **la mise à jour n'est pas finie** : v1 est installée mais pas activée, l'ancien cache n'est pas supprimé. (Le contrôle « ancien cache supprimé » aurait d'ailleurs été rouge dans ce passage ; le plantage arrive avant l'écriture des résultats.)
- La requête restée en suspens est celle du **service worker** vers `index.html` : la ligne « requêtes sans réponse (0) » du diagnostic de S-bis ne pouvait pas la voir, car Playwright ne signale à la page une requête servie par le service worker qu'au moment de sa réponse (lu dans `playwright-core/lib/server/chromium/crNetworkManager.js`, 1.56.1 : `_onRequestWillBeSent` attend `Fetch.requestPaused`, qui n'arrive jamais pour une requête prise par le service worker ; `_onResponseReceived` ne la publie qu'avec `fromServiceWorker`).
- « Page muette » : les commandes envoyées à la page (évaluation, capture d'écran) ne reçoivent plus de réponse tant que la navigation est en cours (certain : vu dans le protocole ; **probable** : Chromium retient ces commandes pendant une navigation qui change de document).

### 2.3 Pourquoi la nouvelle version reste en attente (probable : mécanisme lu dans la source de Chromium, `content/browser/service_worker/service_worker_registration.cc` et `service_worker_version.cc`, branche principale lue le 13/11/2026 — pas exactement la 141 ; la preuve est l'expérience mesurée avec la 141, § 2.4)
- Une nouvelle version qui appelle `skipWaiting()` n'est activée que quand l'ancienne **n'a plus de travail** (`IsReadyToActivate` → `HasNoWork()`), sinon au bout de **5 minutes** (`kMaxLameDuckTime`). Chromium demande à l'ancienne de s'arrêter « dès que possible » (`TriggerIdleTerminationAsap`).
- Commentaire du code de Chromium : « Basically the service worker won't be terminated if DevTools is attached ». Or **Playwright attache toujours ses outils de développement à chaque service worker** (lu dans `crBrowser.js`, 1.56.1 : `Target.setAutoAttach {autoAttach:true, waitForDebuggerOnStart:true}` ; `_onAttachedToTarget` crée un `CRServiceWorker` pour toute cible `service_worker` ; seul `serviceWorkers:'block'` l'évite, ce qui supprime le service worker).
- Donc : si l'ancienne version est relancée pour servir une page (ici le rechargement à heure fixe), elle n'est plus jamais arrêtée ; v1 reste en attente. **Mesuré : toujours pas activée au bout de 120 s** d'attente sans navigation (2 passages sur 2).

### 2.4 Ce qui déclenche le blocage, et ce qui ne le déclenche pas (certain : exécuté sur une course **forcée**)
Pour tester chaque hypothèse de façon répétable, la copie instrumentée **force** la course : le serveur retient un petit fichier de l'installation, le relâche, et la page est rechargée en rafale jusqu'à ce que v1 soit installée. Résultat : **8 blocages sur 8**. Puis, toujours avec la course forcée :

| Variante | Résultat |
|---|---|
| comme la suite (interception Playwright des service workers + `setOffline` + serveur arrêté) | 8 / 8 bloqués |
| **sans** `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` (pas d'interception Playwright côté service worker) | 2 / 2 bloqués (le 3e passage n'a pas eu la course) |
| **sans** `setOffline` (serveur arrêté seulement) | 3 / 3 bloqués |
| serveur **laissé allumé**, `setOffline` | 3 / 3 bloqués |
| **tout en ligne** (ni `setOffline`, ni serveur arrêté) | 3 / 3 bloqués |
| **nouvelle page** dans le même contexte au lieu d'un rechargement (ancienne page ouverte) | 3 / 3 bloqués |
| nouvelle page après **fermeture** de l'ancienne | 3 / 3 bloqués |

**Le mode hors ligne n'y est pour rien** : c'est la navigation qui déclenche l'activation en attente qui ne se termine pas.

**Expérience décisive** (hors dépôt, `brut.mjs`) : **même Chromium 141, sans Playwright**, piloté par le protocole CDP brut en ne s'attachant **qu'à la page**, comme un vrai appareil où personne n'inspecte le service worker ; même course forcée.

| Chromium 141, course forcée, sans Playwright | Résultat |
|---|---|
| service worker **non attaché**, serveur allumé | **chargé** 3 / 3 (course présente 3 / 3) |
| service worker **non attaché**, serveur **arrêté** (hors ligne) | **chargé** 3 / 3 (course présente 3 / 3) |
| service worker **attaché** (`Target.setAutoAttach`, comme Playwright, même sans `waitForDebuggerOnStart`) | **bloqué** 3 / 3 |

Sans rien d'attaché, Chromium relance l'ancienne version et sert la page ; avec les outils de développement attachés, il active la nouvelle **pendant** la navigation, et celle-ci ne se termine pas.
- **Conclusion (certain pour Chromium 141 sous Linux)** : la cause est l'attachement des outils de développement au service worker par Playwright, combiné à une réouverture qui tombait pendant l'installation. **Pas l'appli** : `sw.js` se comporte normalement sans outils attachés.
- **Hypothèse non vérifiée** : Safari / iPhone (autre moteur) n'est pas testé ici.

### 2.5 Documentation de Playwright (certain : lue dans le paquet installé, `playwright-core/types/types.d.ts` 1.56.1 ; `playwright.dev` n'est pas joignable depuis cette session)
- `browserContext.setOffline(offline)` : « Whether to emulate network being offline for the browser context » — rien sur les service workers ; dans le code (`crServiceWorker.js`), l'émulation n'est appliquée au service worker qu'avec `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` (d'où l'arrêt du serveur dans la suite, gardé).
- `page.route` / `browserContext.route` : « will not intercept requests intercepted by Service Worker. See https://github.com/microsoft/playwright/issues/1090 … We recommend disabling Service Workers when using request interception » — impossible ici, la suite teste justement le service worker.
- `request.serviceWorker()` : « Requests originated in a Service Worker do not have a request.frame() » — d'où le diagnostic lu au niveau du **contexte**.
- `page.reload` : aucune mention des service workers. Recherche web : aucun ticket Playwright trouvé pour ce blocage précis.

## 3. Correction (test seul : `tests/suiteX-mise-a-jour.mjs`)
- **Étape 2** : après le F5 qui fait découvrir la version N+1, la suite **attend que la mise à jour soit finie** — nouvelle version activée, aucune version en attente ou en installation, seul le cache `climpilot-next-1137-production` présent et rempli — puis rouvre l'appli (2e rechargement). Avant : réouverture à heure fixe (2,5 s), qui tombait dans la fenêtre d'installation (l'installation commence ≈ 2 s après le F5 et dure de 0,5 à plusieurs secondes : 12,7 Mo). Plafond 120 s ; au-delà, les contrôles « après mise à jour » et hors ligne sont **ROUGES** avec l'état du service worker, **sans** navigation (elle figerait). La durée est écrite dans le journal (`INFO mise à jour N+1 finie en … ms`).
- **Étape 3, contrôle hors ligne renforcé** : chaque réponse de l'origine de l'appli doit venir du service worker, aucune requête ne doit être **en échec** (avant : seuls les statuts ≥ 400 comptaient) et chaque script de la page doit avoir sa réponse. C'est ce qui rend la mutation (b) rouge.
- **Diagnostic** gardé et complété : requêtes en suspens lues au niveau du **contexte** (celles du service worker comprises, marquées `SW`) et état de la mise à jour juste avant la coupure.
- **Pistes évaluées et écartées** (certain : § 2.4) : nouvelle page au lieu d'un rechargement (bloque aussi ; le rechargement est gardé) ; autre façon de couper le réseau (le hors ligne n'est pas en cause) ; attendre « domcontentloaded » (la navigation ne s'engage même pas) ; attendre l'activation **après** la course (n'arrive pas en 120 s) ; **aucune relance automatique** ajoutée.
- `.github/workflows/tests.yml` : **non touché** (la cause n'y est pas).
- Ce que la suite **ne teste pas** (et ne testait pas de façon déterministe) : un F5 **pendant** l'installation. Playwright ne peut pas le tester sans ce blocage ; l'expérience hors dépôt du § 2.4 montre que Chromium sans outils attachés le gère.

## 4. Rouge sur l'ancienne suite, vert sur la nouvelle (certain : exécuté ; copies **hors dépôt**, `git archive` de `99ddd50` et de `ddbb3c7`)

### 4.1 Suites non modifiées, même condition
En local, sans aide, la course est rare (la machine de la session est plus rapide que le runner). La seule condition qui la rend fréquente **sans toucher aux suites** est le journal du protocole de Playwright (`DEBUG=pw:protocol` : chaque message écrit, pilotage ralenti). Même machine, même commande, en alternance :

| Suite | Passages | Plantés (rechargement hors ligne figé) | Mise à jour finie en |
|---|---|---|---|
| ancienne (`main` `99ddd50`) | 6 | **1** — ligne recopiée telle quelle : `DIAGNOSTIC rechargement hors ligne — page.reload: Timeout 90000ms exceeded. \| page : {"erreur":"page muette (5 s)"} \| service workers : 1 \| erreurs : [] \| réponses en erreur : [] \| requêtes sans réponse (0) :` (la signature de la CI) | — |
| nouvelle (`ddbb3c7`) | 6 | **0** (8 / 0 chaque fois) | 3,8 à 4,2 s |

Chronologie du passage rouge (journal du protocole) : la nouvelle version commence son installation à 46,65 s ; la réouverture à heure fixe part à 47,07 s, **pendant** l'installation ; l'ancien service worker est arrêté (47,46 s) puis relancé ; à la coupure (51,18 s) les deux caches sont encore là ; le rechargement hors ligne fige. C'est le mécanisme du § 2.

### 4.2 Autres conditions défavorables (nouvelle suite toujours verte)
- Installation de N+1 ralentie par le serveur (retard de 0 à 2,7 s par pas de 0,3 s sur le plus gros fichier) : ancienne 10 / 10 sans plantage (la fenêtre de course est étroite), **nouvelle 10 / 10**, mise à jour finie en 4,2 à 6,9 s.
- Processeur de la page ralenti ×6 (`Emulation.setCPUThrottlingRate`), 2 cœurs : ancienne 5 / 5 sans plantage, **nouvelle 9 / 9** (4 + 5), mise à jour finie en 4,8 à 7,3 s.
- Course **forcée** (§ 2.4) : l'ancienne logique fige 8 fois sur 8 ; la nouvelle ne peut pas la produire, puisqu'elle ne navigue pas pendant l'installation.

## 5. Preuve de non-affaiblissement : mutations (certain : exécuté ; copies **hors dépôt** de l'arbre, `git archive` de `99ddd50`)
Les 8 contrôles restent, mêmes libellés sauf celui du hors ligne, complété (« … chaque fichier demandé servi par le service worker, aucun en échec ni en erreur »).

| Mutation | Suite actuelle (`main`) | Nouvelle suite |
|---|---|---|
| (a) `./next-terrain.js` retiré de la liste de `sw.js` | **ROUGE** 7 / 1 — « Installation seule … manquants : /next-terrain.js » | **ROUGE** 7 / 1 — même contrôle, même détail |
| (b) `next-terrain.js` listé mais **retiré du cache** juste avant la coupure | **VERT 8 / 0 — non détectée** | **ROUGE** 7 / 1 — hors ligne : `échec (net::ERR_FAILED) next-terrain.js`, script sans réponse : `next-terrain.js` |

Journaux gardés hors dépôt (`rouge-actuelle-a.log`, `rouge-actuelle-b.log`, `rouge-nouvelle-a.log`, `rouge-nouvelle-b.log`). Arbre non muté, nouvelle suite : 8 / 0, 55 fichiers servis par le service worker, 0 échec, 47 scripts tous servis.

## 6. Comptes locaux (certain : exécutés le 13/11/2026 dans cette session, nouvelle suite = `ddbb3c7`)
- **50 passages de suite** de la suite X par `tests/run-all.sh` en **mode CI** (`CP_SANS_NETNS=1 CP_SUITES=suiteX-mise-a-jour`), en alternance :
  - 25 passages normaux (4 cœurs) : **25 × 8 / 0**, 0 plantage ; suite X en 14 à 16 s ; mise à jour N+1 finie en 3,8 à 5,3 s ;
  - 25 passages **bridés** (un seul cœur, `taskset -c 0`, partagé avec une boucle qui le consomme en continu) : **25 × 8 / 0**, 0 plantage ; suite X en 22 à 27 s ; mise à jour finie en 4,8 à 7,1 s.
  - Code de `run-all.sh` : 3 à chaque fois (passage PARTIEL par construction avec `CP_SUITES`).
- **faketime** (règle 9 ; mode local par défaut de `run-all.sh`, avec isolation du noyau), suite X : samedi « 2026-11-14 10:00 » **8 / 0** ; dimanche « 2026-11-15 10:00 » **8 / 0** ; « 2027-01-05 10:00 » **8 / 0** (date vue par la machine contrôlée : samedi, dimanche, mardi).
- Plus haut (§ 4) : 25 passages de la nouvelle suite sous conditions défavorables (installation ralentie 10, processeur ×6 : 9, journal du protocole 6), 0 plantage.
- **Batterie complète** (`bash tests/run-all.sh`, mode local avec isolation du noyau, un passage, 26 min) : **COMPLET, RÉUSSI — 1 612 réussis / 0 échoué / 0 SKIP**, 5 non bloquants (les 5 « À TRANCHER » de la suite Y, comme sur `main`) ; même total que la batterie de S-bis. Q 64 / 0, W 64 / 0, **X 8 / 0 (15 s, mise à jour finie en 3,8 s)**, Y 21 / 0 (+ 5 non bloquants), Z 55 / 0, AB 86 / 0. Golden Y, Z, W **inchangés** (aucun fichier golden ni de l'appli touché). Le rapport dit « arbre de travail modifié » : seul ce compte rendu changeait pendant le passage (le code des tests est celui de `ddbb3c7`, certain : `git diff --stat ddbb3c7 HEAD` ne liste que ce fichier).

## 7. CI (`.github/workflows/tests.yml`, contrôle « batterie complète » ; rapports lus avec `gh api …/check-runs`)
| Tête | Événement | Run | Tentative | Résultat | Total | Suite X |
|---|---|---|---|---|---|---|
| `ddbb3c7` (test) | push | 193 (43384818727) | 1 | **vert** | 1 608 / 0 / 2 SKIP connus, COMPLET, RÉUSSI | 8 / 0, 13 s |
| `ddbb3c7` | demande de fusion #25 | 194 (43384851736) | 1 | **vert** | 1 608 / 0 / 2 SKIP connus | 8 / 0, 14 s |
| `ddbb3c7` | push | 193 | 2 (relance complète) | **vert** | 1 608 / 0 / 2 SKIP connus | 8 / 0, 15 s |
| `ddbb3c7` | demande de fusion #25 | 194 | 2 (relance complète) | **vert** | 1 608 / 0 / 2 SKIP connus | 8 / 0, 14 s |
| `03d1599` (brouillon du compte rendu) | push | 201 (43391729847) | 1 | **vert** | 1 608 / 0 / 2 SKIP connus | 8 / 0, 14 s |
| `03d1599` | demande de fusion #25 | 202 (43391737229) | 1 | **vert** | 1 608 / 0 / 2 SKIP connus | 8 / 0, 13 s |

Durée de chaque exécution : ≈ 27 min. Les 5 non bloquants sont les 5 « À TRANCHER » de la suite Y, comme sur `main` ; les 2 SKIP connus sont ceux de l'isolation du noyau, absente sur le runner. Aucun plantage de la suite X, aucune ligne `DIAGNOSTIC`, **aucune relance pour cause d'échec** : les relances ci-dessus sont des relances complètes volontaires. Pas de 3e tentative sur `ddbb3c7` : un nouveau push annule toute exécution en cours du même groupe (`cancel-in-progress`).

**Tête finale (le commit qui ajoute ce paragraphe)** : trois passages complets des deux événements (tentative 1 au push, puis deux relances complètes). Leur tableau (numéro, durée de X, résultat) est dans la description de la demande de fusion #25 et dans le message de fin de session : il ne peut pas figurer dans le commit qu'il vérifie.

## 8. Fichiers, conflits, clôture
- **`git diff --stat origin/main...HEAD`** (certain) : `tests/suiteX-mise-a-jour.mjs` (≈ 57 lignes ajoutées, 20 retirées : étapes 2 et 3 seulement), `tests/LISEZMOI.md` (le seul paragraphe « suiteX-mise-a-jour.mjs (diagnostic seul) », réécrit sur place, pas de section ajoutée en fin de fichier), `docs/OUTILLAGE-X-COMPTE-RENDU.md` (nouveau). **Rien d'autre** : ni `index.html`, ni `sw.js`, ni `next-*.js`, ni `vendor/`, ni `supabase/`, ni `tests/run-all.sh`, ni `tests/env.mjs`, ni `.github/workflows/tests.yml`, ni `docs/FILE-DES-MISSIONS.md`. Le compte exact est en tête de la demande de fusion #25 (onglet « Files changed »).
- **Conflit avec COMPTE** (certain) : `git merge-tree --write-tree origin/correctif/compte HEAD` → code 0, aucun fichier en conflit, contre `7b55a2a` (tête de `correctif/compte` lue le 13/11 à 08 h 15 UTC). Les deux branches touchent `tests/LISEZMOI.md`, à des endroits différents. L'ordre de fusion est donc libre. **Arbre fusionné** (résultat de ce `merge-tree`, COMPTE + OUTILLAGE-X, cache `1140` de COMPTE, extrait hors dépôt) : nouvelle suite X **3 / 3 à 8 / 0** (mise à jour finie en 3,8 à 4,4 s).
- **Secrets** : `bash tools/claude/verif-secrets.sh` avant chaque commit : rien ; `--branche` avant chaque push : rien (code 0). Aucune dérogation `CP_SECRETS_OK`.
- Commits signés `Claude <noreply@anthropic.com>`, poussés sur **`outillage/suite-x` seulement**. Aucun push sur `main`, aucune fusion, aucun push forcé, aucune réécriture d'historique, aucune suppression de branche, aucun déploiement, aucune écriture Supabase.

### 8.1 Écarts à connaître
1. **`docs/FILE-DES-MISSIONS.md` non mis à jour** : il est interdit par le prompt de la mission (conflit avec COMPTE). Ligne proposée pour la section « Outillage », à ajouter après la fusion de COMPTE : `| OUTILLAGE-X : suite X fiable sur la CI (cause : réouverture pendant l'installation du service worker, outils de développement attachés ; test seul) | outillage/suite-x | fait le 13/11 (Opus 5.5), PR #25 en brouillon ; docs/OUTILLAGE-X-COMPTE-RENDU.md | relecture par Fable 5.1 (relecture-p10), fusion | Fable puis Gab |`.
2. **Brouillon du compte rendu poussé avant la fin de la batterie** (`03d1599`) : le contrôle automatique de la session exigeait que le fichier soit commité et poussé. Aucun fichier de test ni de code dans ce commit.
3. **Processeur « bridé »** : `cpulimit` n'est pas installé ; bridage fait avec `taskset -c 0` plus une boucle qui occupe le même cœur en continu (la suite n'a donc qu'environ la moitié d'un cœur).
4. **Nom de branche** : la consigne de la session proposait une autre branche (`claude/…`) ; j'ai suivi le prompt de la mission (`outillage/suite-x`).

### 8.2 Ce qui n'a pas pu être vérifié
- **Safari / iPhone** : pas testé (moteur différent). La conclusion « l'appli n'est pas en cause » vaut pour Chromium 141 sous Linux (§ 2.4).
- **Source de Chromium** : lue sur la branche principale du 13/11/2026, pas exactement la 141 ; le comportement, lui, a été **mesuré** avec la 141 (§ 2.3, § 2.4).
- **Pourquoi** Chromium ne termine pas la navigation dans ce cas précis (au-delà de « activation pendant la navigation, outils de développement attachés ») : non cherché plus loin, ce serait un défaut de Chromium à signaler à ses auteurs, sans effet sur l'appli.
- **Documentation en ligne de Playwright** (`playwright.dev`) : hôte non autorisé dans cette session ; documentation lue dans le paquet installé (même version).
