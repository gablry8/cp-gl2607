# ClimPilot — P0 « filet de sécurité » : compte rendu (branche `refonte/p0-filet`)

> Rédigé le 21/10/2026 par Claude (Fable 5.1) pour Gabriel Leroy, en autonomie de nuit (mission du 20/10 au soir, partie 2).
> Branche `refonte/p0-filet` créée depuis `fusion/avant-refonte` au hash **`682b9b5`**. **Aucune ligne du code applicatif modifiée** (`index.html`, `next-*.js`, `sw.js`, `supabase/` intacts — vérifié par `git diff --stat 682b9b5 -- index.html next-*.js sw.js supabase/` : vide). `main`, production, bases Supabase : non touchés. Aucun secret.
> Certitude : **certain** (exécuté ici) / **probable** / **hypothèse**.
> **Mise à jour du 21/10 (après la relecture M3 d'Opus)** : ce compte rendu décrit l'état au commit `f5a8410`. Depuis : la suite Q est **bloquante** dans un travail CI unique (ses 2 contrôles connus instables sont marqués `INSTABLE`, non bloquants — M3 C5) ; A1 compte les `data-src` et la suite X vérifie le cache à l'installation (M3 C8) ; `persist-credentials: false`, code de sortie 3 sur SKIP non connu et verdict `PARTIEL` avec `CP_SUITES` (M3 C9) ; les 3 références golden « assujetti » sont `À TRANCHER`, non régénérées (M3 C2). Les chiffres et noms de travaux ci-dessous (« sans suite Q », « tests — … ») sont ceux d'avant cette correction.

## 1. Synthèse (5 lignes)
1. Le filet est en place : **CI GitHub Actions** (batterie complète à chaque push et demande de fusion, sans secret, validateurs CEN/FNFE et PostgreSQL local inclus) et **9 tests de non-régression T1–T9** sous forme de 6 nouvelles suites (U fusion, V numérotation, W enveloppes/démarrage dégradé, X mise à jour hors réseau, Y golden documents + XML, Z golden calculs), toutes vertes ici.
2. **Golden masters générés depuis le code actuel** : 52 devis de référence (montants au centime **et** au millième), 8 aperçus PDF, 8 XML de facture électronique, table de fusion 3 voies (27 cas), comptage des enveloppes, comportement en 404. Ils **figent** ce que l'appli fait aujourd'hui, bon ou mauvais ; chaque suite a été vérifiée capable de détecter un écart (1 centime, 1 millième, 1 caractère).
3. **3 devis à vérifier à la main** demain (mono-split, dépannage, bisplit avec acompte) : détail ligne par ligne dans `tests/golden/calculs-lisible.md` (§ 4).
4. **Suite Q** (recette deux appareils) : non stabilisée en profondeur (un des deux contrôles instables n'est pas compris) ; elle est **isolée, pas masquée** : jouée dans un travail CI séparé, visible, non bloquant, avec la raison écrite dans `tests/run-all.sh` et le workflow ; une fenêtre de timing élargie (1,5 s → 6 s) pour le contrôle « voile ».
5. Batterie locale sur la branche (commit `2c9fb33`, `unshare -n`, validateurs, PostgreSQL local) : **1 008 réussis, 1 échec, 0 SKIP** sans la suite Q ; suite Q seule : **61/62** (« voile » passe désormais, « acompte » reste rouge). L'échec unique est un **vrai petit bug du script Google Agenda le jour du changement d'heure** (§ 6.1). CI GitHub (runner ubuntu-24.04, commit `4b5d1f0`) : **993 réussis, 1 échec (le même script Google), 2 SKIP** (le runner n'autorise pas `unshare -n` : gardes logicielles seules, écrit dans le rapport) ; **suite Q : 62/62 sur le runner**, « acompte » compris — l'instabilité tient donc bien à la machine, pas au code (probable → quasi certain). Un faux échec de l'aperçu (dossier de sortie) corrigé ensuite ; dernier passage (`2ef69b0`) : **1 004 réussis, 1 échec (script Google), 2 SKIP (isolation du noyau) ; suite Q 62/62 à nouveau**. Lisible dans l'onglet Checks du commit. Trois trouvailles à lire : le taux dépannage par défaut (90 €/h), le contrôle « hors ligne » de M0 qui était incomplet, et 5 contrôles de la suite E qui échoueront le 01/01/2027 (R12 confirmé).

## 2. Ce qui a été livré (nouveaux fichiers, sauf mention)
| Fichier | Rôle | Test du plan |
|---|---|---|
| `package.json` | Node ≥ 22.6, Playwright **1.56.1** épinglé, scripts `test`, `test:golden`, `golden:regenerer`, `essai:copie`. **Pas** de numéro de version de l'appli (décision non prise) | P0 |
| `.github/workflows/tests.yml` | 2 travaux : batterie complète **sans Q** (bloquant) + **Q seule** (non bloquant). Rapport et journaux en artefact, résumé dans l'onglet Actions. `unshare -n` si le runner l'autorise, sinon `CP_SANS_NETNS=1` indiqué | CI |
| `tests/golden/cas-calculs.mjs`, `generer.mjs`, `calculs.json`, `calculs-lisible.md`, `tests/suiteZ-golden.mjs` | 52 devis de référence : 12 natures × (défaut + rempli), variantes TVA 10/5,5/mixte, acompte 30 % et 12,5 %, lot en option, 2 lots, marges 0/100, prix à virgule, sans arrondi, zone +60 km, taux custom, forfait/heures, SAV, électricité manuelle, extras ; régime **assujetti** (3 cas) ; **ancien format** sans `v:2` (5 cas, dont assujetti). Sorties figées : HT, TVA, TTC, acompte, solde, coût réel, bénéfice, cotisations, chaque ligne (groupe, libellé, qté, PU, HT, achat), ventilation TVA, options, avertissements, taux de cotisations | **T1** |
| `tests/golden/scenario-documents.mjs`, `generer-documents.mjs`, `documents/*.html` (8), `xml/*.xml` (8), `tests/suiteY-golden-docs.mjs` | HTML normalisé des aperçus PDF (devis v2, facture d'acompte, de solde après acompte, solde pro, dépannage particulier, solde assujetti, avoir total, avoir partiel) et XML CII (386, 380 ×4, 381 ×3, dont assujetti) ; comparaison caractère par caractère | **T2, T3** |
| `tests/suiteV-numerotation.mjs` | formats `DV-AAAAMMJJ-NATURE-XXXXXX`, `L-`, `FF-`, `TEST-F-` ; continuité ; refus de recul du compteur local ; **R2 reproduit** (deux appareils hors ligne → même numéro de location et de fiche fluide), nommé « [R2 — ÉCHEC ATTENDU, CONNU] » : le contrôle **échouera le jour où R2 sera corrigé** et le dira | **T4** |
| `tests/suiteU-fusion.mjs`, `golden/fusion-empreinte.txt` | fusion 3 voies : 27 cas (modifié d'un côté / des deux, supprimé, créé, compteur qui recule, objets de réglages, listes simples, doublon d'id, ordre des champs, champ retiré) en Node pur, fonctions **extraites d'index.html à l'exécution** ; empreinte du code figée | **T5** |
| `tests/suiteW-enveloppes.mjs`, `golden/enveloppes.json`, `golden/page-figee.mjs` | comptage statique des `window.X=function` (go : 14 couches par cette règle, plus le cœur), **44 couches rejouées une à une** (identifiants DOM en doublon, erreurs), **couche en 404** (planning, emission) | **T6, T7** |
| `tests/suiteX-mise-a-jour.mjs` | serveur propre à la suite : version N installée (cache `0000-ancienne`, données) → N+1 publiée → cache remplacé, ancien supprimé, données gardées → **serveur arrêté** → ouverture hors ligne, 58 fichiers servis du cache, navigation | **T8** |
| `tests/lib.mjs` (**modifié**, 3 lignes) | option `CP_HORLOGE=<date>` : horloge figée pour toute la batterie (pas activée par défaut) ; les suites golden figent la leur (2026-10-20 10:00) | **T9** |
| `tests/run-all.sh` (**modifié**) | suites U–Z ajoutées ; `CP_SANS_Q=1` retire la suite Q avec la raison écrite | — |
| `tests/suiteQ-recette.mjs` (**modifié**, 1 ligne) | fenêtre d'observation du voile 1,5 s → 6 s (même attendu) | Q |
| `docs/P0-COMPTE-RENDU.md` | ce document | — |

## 3. Résultats des tests
| Étape | Local (sans Q) | Remarque |
|---|---:|---|
| autotest-isolation | 20/0 | isolation du noyau OUI |
| suites A → T (existantes, sans Q) | 690/0 | même contenu qu'en M0 |
| **U fusion 3 voies** | 27/0 | nouveau |
| **V numérotation** | 8/0 | nouveau, dont 2 contrôles « R2 — échec attendu, connu » qui reproduisent le doublon |
| **W enveloppes / 404** | 64/0 | nouveau, golden `enveloppes.json` |
| **X mise à jour hors réseau** | 7/0 | nouveau, serveur arrêté pour le hors ligne |
| **Y golden documents + XML** | 26/0 | nouveau, 8 HTML + 8 XML |
| **Z golden calculs** | 55/0 | nouveau, 52 devis |
| fn-signature / liste-blanche / superpdp / agenda | 55/0 | fonctions serveur simulées |
| **fn-apps-script** | 11/**1** | « 12 h – 13 h touche les deux demi-journées » : faux le 25/10/2026 (changement d'heure) — § 6.1 |
| sql (PostgreSQL 16 local) | 34/0 | |
| apercu-test | 11/0 | |
| **Total** | **1 008 / 1** | verdict ÉCHEC à cause du seul fn-apps-script |
| suite Q (à part) | 61/1 | « acompte PC / solde téléphone » (§ 5) |

CI GitHub (`.github/workflows/tests.yml`, commit `4b5d1f0`, première exécution complète lisible) :

| Travail | Résultat | Détail |
|---|---|---|
| batterie complète (sans Q) | 993 réussis, 1 échec, 2 SKIP | échec = fn-apps-script (script Google, changement d'heure) ; SKIP = isolation du noyau absente sur le runner (gardes logicielles seules) ; aperçu : faux échec de chemin de sortie, corrigé au commit suivant |
| suite Q (à part, non bloquante) | **62/62** | sur une machine neuve, « acompte » et « voile » passent |

Dernier passage (commit `2ef69b0`) : batterie complète **1 004 / 1 / 2 SKIP** (même échec script Google, aperçu vert), suite Q **62/62**. Dès que le script Google est corrigé (une ligne, branche agenda) ou que la date du test ne tombe plus sur le 25/10, le travail bloquant sera vert. Les rapports de chaque passage sont dans l'onglet **Checks** du commit (« tests — batterie complète », « tests — suite Q ») et en artefact de l'onglet Actions.

## 4. Les 3 devis à vérifier à la main demain (`tests/golden/calculs-lisible.md`, détail ligne par ligne)
Horloge figée au 20/10/2026, régime franchise (TVA 0), paramètres par défaut de l'appli, stockage vide. Pour comparer : Nouveau devis › même nature › mêmes valeurs ; les lignes « Préparation », « Achat », « Provision SAV », « Déplacement », « Frais », « Marge sécurité » sont celles que l'appli ajoute toute seule.

| Devis | Entrées | Total HT | TVA | TTC | Acompte | Solde |
|---|---|---:|---:|---:|---:|---:|
| **Mono-split** (`d-mono-simple`) | 1 machine 980 € achat marge 35 %, liaison 1/4-3/8 5 m, câble 5G1,5, alim. 6 m, condensats 4 m, support mural, MES Monosplit ; 22 lignes, 8,4 h | **2 391,78 €** | 0,00 € | **2 391,78 €** | 0 | 2 391,78 € |
| **Dépannage** (`d-depannage-simple`) | 1 condensateur 120 € achat (vendu 200 €), 1,5 h réparation, recharge 0,6 kg R32, pas de vide/azote ; 10 lignes, 2,5 h | **592,34 €** | 0,00 € | **592,34 €** | 0 | 592,34 € |
| **Bisplit avec acompte** (`b-acompte-30`) | 1 machine 1 180 € marge 35 %, 2 UI (liaisons 6 m + 4 m), goulotte 5 m, support sol, MES Bisplit, mise sous vide ; 28 lignes, 12,34 h | **3 308,22 €** | 0,00 € | **3 308,22 €** | **992,47 €** (30 %) | **2 315,75 €** |

Ce que l'appli calcule et qui mérite ton regard (**listé, rien corrigé**) :
- **Dépannage à 90 €/h** : le taux horaire par défaut du module dépannage (`P.dep.taux`) est 90 €/h, pas les 45 €/h de ton plan. C'est un paramètre, pas un bug ; à confirmer que c'est voulu.
- **Cotisations 23,68 %** sur un profil fiscal vide à la date figée (21,2 + 1,7 + 0,3 + 0,48 d'après `next-taux.js` ; probable, lu) — pas le 13,22 % ACRE de ton plan, parce qu'aucune date de début d'activité n'est renseignée. À vérifier avec ta comptable le jour où le profil sera rempli ; hors périmètre de la refonte.
- **Marge 100 % = marge 0 %** : une machine à marge ≥ 100 % est vendue au prix d'achat (règle `index.html` l. 1396). Surprenant : `b-marge-0` et `b-marge-100` donnent le même total (2 641,08 €). Figé tel quel.
- **Ancien format : centimes non arrondis** : un devis sans `v:2` donne 2 746,775769 € HT et un acompte de 1 385,433606 € ; l'arrondi n'est fait qu'à l'affichage/export (R6 du plan, confirmé). Figé tel quel ; c'est exactement ce que P2b devra traiter.
- Fluide R32 vendu 65,22 €/kg pour 30 €/kg d'achat (article « à vérifier » de la base), signalé par l'appli elle-même dans ses avertissements.

## 5. Suite Q : ce que j'ai fait et pourquoi
- Faits (certain) : 5 passages sur 5 depuis hier 20:14 ont 1 ou 2 échecs sur **deux** contrôles chronométrés (« voile pendant le rechargement », « acompte PC / solde téléphone »), y compris sur les pointes d'origine inchangées, qui passaient 62/62 trois heures plus tôt.
- « Voile » : le test n'accordait que **1,5 s** pour voir le voile ; les données étaient toujours bien conservées (`apresA` vrai) → fenêtre portée à 6 s (même attendu). Probable : suffit.
- « Acompte » : le téléphone reprend bien l'acompte émis sur le PC, puis émet un solde au lieu de s'arrêter ; montant cohérent avec total − acompte (604,45 − 181,34 = 423,11, probable). **Je n'ai pas compris** pourquoi il n'attend pas ; je n'ai donc pas touché à ce contrôle (2 tentatives de lecture, règle d'arrêt). Il reste à comprendre : soit un timing de dialogue, soit un vrai comportement différent de l'attendu → **contrôle manuel 5 bis** de la fiche M0.
- Décision : suite Q **séparée** (`CP_SANS_Q=1`) dans le passage bloquant ; travail CI à part, non bloquant, résultat visible dans le résumé et l'artefact ; raison écrite dans `tests/run-all.sh` et `.github/workflows/tests.yml`. Pas masquée. À stabiliser pour de bon en P3 (attentes sur événements plutôt que délais).

## 6. Trouvailles (certain, exécuté)
0. **Bug réel, mineur, dans `tools/apps-script/ClimPilot-Agenda.gs`** (non corrigé : code livré, hors périmètre de la nuit) : `heure_()` compte les heures depuis minuit **local** ; le jour du passage à l'heure d'hiver (25/10/2026 : nuit de 25 h), 12 h 00 vaut 13 h → un rendez-vous 12 h–13 h n'est compté qu'en après-midi, et tout rendez-vous de ce jour-là est décalé d'une heure dans le classement matin/après-midi. Vu parce que la batterie a tourné le 21/10 (le test place ce rendez-vous à J+4). Le test est donc aussi dépendant de la date : il repassera au vert le 22/10. Correction simple à prévoir (heures lues avec `Utilities.formatDate(d, tz, 'HH:mm')`), à faire sur la branche agenda, pas ici.
1. **R12 confirmé** : avec `CP_HORLOGE=2027-01-05`, la suite E (avoirs) a **5 échecs** sur des « 2026 » écrits en dur (`TEST-AV-2026-001`…) ; suites C et K passent. Donc au 01/01/2027 la batterie rougira sans bug. 21 fichiers de tests contiennent « 2026 » (certains légitimes). Non corrigé cette nuit (hors des nouveaux fichiers) ; à faire avant janvier.
2. **Le contrôle « hors ligne » de M0 avait un trou** : `setOffline` de Playwright coupe le réseau de la page, pas celui du service worker, qui continuait d'aller chercher les fichiers sur mon serveur local. La suite X refait l'essai **serveur arrêté** : l'appli s'ouvre bien depuis le cache (58 fichiers), données en place, bibliothèques embarquées chargées. La conclusion de M0 tient, mais la preuve est seulement d'aujourd'hui.
3. **R7 moins grave que prévu à ce niveau** : rejouer chaque couche une seconde fois ne crée de doublon DOM que pour `next-addons.js` (12 identifiants : `nxNavOverlay`, `nxTaskModal`…) et aucune erreur ailleurs. La profondeur des enveloppes de `go` n'est pas mesurée (impossible sans toucher au code) : le comptage est statique.
4. **R8 figé** : une couche en 404 → l'appli démarre, **aucun message**, clés de synchro en moins (`next-emission.js` absent : 48 au lieu de 51). C'est le défaut n° 1 de la recette du 14/10, documenté maintenant par un test qui dira quand ça change.
5. Golden calculs : aucune valeur **fausse** au sens strict trouvée ; les points de § 4 sont des choix de paramètres ou des règles surprenantes, pas des erreurs de calcul.

## 7. Ce que je n'ai pas pu vérifier
- **`unshare -n` sur le runner GitHub** : si indisponible, la CI tourne avec les gardes logicielles seulement (indiqué dans le rapport). Résultat réel : § 3.
- **La profondeur réelle des enveloppes** (T6) et le **double rendu** de `go` : seul le doublon d'identifiants DOM est mesuré.
- **T2 incomplet** : pas de golden pour la facture de location, le contrat, la fiche Cerfa (scénario de `genxml.mjs` repris tel quel) ; **T3** : la validation XSD/CEN/BR-FR des golden XML passe par la suite F existante (mêmes générateurs), pas par la suite Y.
- **T9** : l'horloge figée globale (`CP_HORLOGE`) n'est pas activée par défaut (le côté Node des suites lit encore la vraie date) ; elle sert aux suites golden et aux essais.
- **Le contrôle « acompte » de la suite Q** (§ 5).
- Aucune règle fiscale ou réglementaire vérifiée ni modifiée.

## 8. Comment s'en servir
- Lancer tout : `npm test` (ou `tests/run-all.sh`) ; golden calculs seuls : `npm run test:golden` (rapport PARTIEL, code 3 : débogage) ; sans la suite Q (débogage local) : `CP_SANS_Q=1 tests/run-all.sh` (PARTIEL aussi).
- Un golden qui échoue = **un comportement a changé**. Lire la différence (le rapport donne la ligne, le montant avant → après, ou la première position du caractère différent), décider, puis seulement si le changement est voulu : `node tests/golden/generer.mjs` (calculs), `node tests/golden/generer-documents.mjs` (documents/XML), `CP_GOLDEN_REGEN=1 node tests/suiteW-enveloppes.mjs` (enveloppes), et commiter les fichiers régénérés **dans le même commit** que le changement.
- Protection de `main` (geste de Gabriel) : GitHub › Settings › Branches › règle sur `main` › « Require status checks » › choisir **« batterie complète »** (le travail ; depuis le 21/10 il inclut la suite Q). Ne pas exiger « rapport — batterie complète » (check-run attaché au commit de fusion temporaire sur une demande de fusion, M3 C9.1).
