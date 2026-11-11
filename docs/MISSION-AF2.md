# ClimPilot — Mission AF2 : montants et compta (M1, M2, M3, M4, M6) — dossier de mission

> Rédigé le 10/11/2026 par Claude (session Claude Code, mission AF2-AF5-DOSSIER) pour Gabriel Leroy. **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-af2-af5`, partie de `main` = `6457329`.
> Point de départ : le résumé AF2 de `docs/MISSION-AF-CORRECTIONS.md` (§ 3), écrit le 25/10 sur le code de la 1.13. Depuis, AF1, AF1-5, C3, P6+ et P3 ont été fusionnées. Chaque constat est relu ici sur `main`, et reproduit quand c'est possible.
> Numéros de ligne lus sur `main` (`6457329`). S, COMPTE, P11 et AF1-B passent avant AF2 et les décaleront : l'exécutant retrouve tout par le **nom des fonctions**.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project (ni le plan du 28/10, ni le mail préparé pour ta comptable). Le changement de cap (EURL à l'IS, TVA au réel) vient du prompt de cette mission. La copie `claude/ClimPilot-AF2-dossier.md` reste à faire.
> Rien n'a été exécuté contre Supabase (RÉEL ou TEST). Les essais du § 1.6 tournent sur la vraie appli (Chromium 141, Playwright 1.56.1, Node 22), serveur local, Supabase bloqué par `tests/lib.mjs`, **horloge de la page figée** (jamais la vraie date).
> Certitude : **certain** (lu dans le code, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. **Lis le § 1** : M1, M2, M3 et M4 sont toujours vrais (reproduits sur `main`). M6 a bougé, et un défaut de plus est prouvé : une fois assujetti à la TVA, le livre des recettes et « ENCAISSÉ » mélangent TTC et HT.
2. **Ton cap a changé** (plan du 28/10, décision en décembre avec ta comptable). M3 (déclaration Urssaf du tableau de bord) et le « net après cotisations » sont des calculs de micro-entreprise. Je propose de les **geler** jusqu'à ta décision (question 1, § 2).
3. Le reste sert quel que soit le statut : M1, M2, M4, et M6 réduit (Signé / Facturé / Encaissé en HT, export exact).
4. Réponds aux **8 questions du § 6** (oui / non suffit).
5. Pour ta comptable (question 5 du mail préparé ; sa réponse n'est pas dans ce dépôt) : quelle date retenir pour un chèque. Elle ne bloque pas le code : la date reste modifiable.
6. AF2 se code **après S, COMPTE, P11 et AF1-B** (ordre de la file), une seule mission sur le code à la fois.
7. Estimation : 4,5 à 5,5 jours de sessions. Je propose **deux branches** (question 8) : AF2-A (M1, M2, M4), puis AF2-B (M6).
8. Après chaque fusion : sur chaque appareil, « ✓ synchronisé », puis F5, **le même jour**.
9. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Où en est chaque constat (lecture et essais sur `main`, `6457329`)

### 1.1 M1 — Le matériel d'un chantier soldé reste « à commander » : **toujours vrai** (certain, exécuté R-M1)

| Sortie | Où | Filtre | Certitude |
|---|---|---|---|
| Écran « À commander » | `renderCommander`, `index.html` l. 1968 | `statut==='accepte'`, puis cases « commandé » par article (`CMD`) et stock | certain |
| Demande de prix fournisseur | `mailDemandePrix`, `index.html` l. 3965 | même filtre | certain |
| Bon de commande PDF et panneau « réservation » | `accepted()`, `next-commande.js` l. 17 ; `resteACommander` l. 19 | même filtre | certain |
| Tâche automatique « N article(s) à commander » | `nxAutoTasks`, `next-addons.js` l. 249 | `statut==='accepte'` et stock (ne regarde même pas les cases « commandé ») | certain |

- Ni la facture de solde, ni le paiement, ni la date ne sont regardés. Seul changement depuis le 25/10 : un original « remplacé par l'avenant » (AF1-bis) n'est plus `accepte`, donc il sort de ces quatre listes (certain, lu).
- La case par chantier « matériel réservé/commandé » (`d.matReserve`, `next-commande.js` l. 76-80) reste un simple pointage : elle ne retire rien (son en-tête le dit, l. 8-11).

### 1.2 M2 — Une intervention faite mais non facturée n'est rappelée nulle part : **toujours vrai** (certain, exécuté R-M2)
- « Ma journée » (`collect`, `next-journee.js` l. 33) lit les interventions **du jour** (`depToday`), les factures impayées de plus de 30 jours, les devis à planifier et à relancer. Rien sur une intervention passée restée en brouillon.
- « À faire » (`nxAutoTasks`, `next-addons.js` l. 235) : aucune tâche sur les interventions (`DEP`).
- Une intervention reste en brouillon sans numéro après un refus d'émission (hors ligne, registre illisible) ou quand on oublie « Facturer ». Un pointage « ▶ Commencer » en crée une, en brouillon (`next-terrain.js` l. 93).

### 1.3 M3 — Le tableau de bord annonce le trimestre suivant pendant le mois d'échéance : **toujours vrai** (certain, exécuté R-M3)
- `urssafNext` (`index.html` l. 3388-3389) choisit le trimestre d'après le **mois civil** ; seul appel : le bloc « 💸 Paiements & URSSAF » du tableau de bord (`renderDash`, l. 1377).
- Il ignore la périodicité choisie dans Objectifs (`declPeriode`), la date de début et les déclarations cochées. Objectifs, lui, calcule les périodes (`periodes`, `next-objectifs.js` l. 393 ; `aFaire` l. 425), testé par la suite O (O15, O20).
- **Mais** c'est un calcul de micro-entreprise (déclaration du chiffre d'affaires à l'Urssaf). Voir le § 2.

### 1.4 M4 — « Payée » met la date du clic : **toujours vrai** (certain, exécuté R-M4)
- `payerFacture` (`index.html` l. 3208-3229 : devis, location, intervention, contrat) et `payDep` (l. 2458) écrivent `todayISO()`. `askMode` (l. 3179) demande le mode en **texte libre** (`prompt`), jamais la date. Depuis le 19/10, « Annuler » n'enregistre rien.
- Seul l'import du relevé bancaire (`payer`, `next-banque.js` l. 272) met la date du crédit, en **remplaçant un instant** `window.todayISO` et `window.askMode`. Il refuse déjà une date future. Sa liste de modes : Virement, Chèque, CB, Espèces (l. 290).
- Deux enveloppes s'appuient sur ce fonctionnement synchrone :
  - `next-emission.js` l. 809-812 : envoie l'évènement « paiement » au journal du serveur avec **la date du clic** (`date:today()`), pas la date d'encaissement ;
  - `next-particuliers.js` (`garderPaiement`, l. 178) : contrôle du délai L221-10 pour un particulier, évalué à la date du jour.
- Les suites E, I, J, K, R et AD appellent `payerFacture` / `payDep` directement (en remplaçant `prompt` ou `askMode`) ; L et T remplacent `askMode` ; P passe par le relevé bancaire ; Q clique le bouton `button[onclick*="payerFacture"]` (l. 217).
- Même défaut, hors livre des recettes : « acompte reçu » d'un créneau (`nxtrAcompteRecu`, `next-terrain.js` l. 114-116) date aussi du clic. Hors AF2 (ce n'est pas une facture).

### 1.5 M6 — Les chiffres appelés « CA » : **changé** (certain, exécuté R-M6 et R-M6b)
Le tableau de bord (`renderDash`, `index.html` l. 1311-1332) affiche aujourd'hui, entre autres :

| Carte | Calcul | Remarque |
|---|---|---|
| « CA {année} HT (devis + interv. + loc.) » | devis `accepte` **créés** dans l'année + interventions non brouillon + locations non réservées | signé et facturé mélangés ; date de création du devis, pas d'acceptation |
| « 💶 ENCAISSÉ {année} » | `allRecettes()` (l. 3360) de l'année | existe déjà (absente du constat du 25/10) |
| « Facturé — en attente » | impayés (`allImpayes`, l. 3371) | c'est ce qui reste dû, pas le facturé |
| « Net après cotis. X % » | Σ `benefNet` des devis acceptés = bénéfice − CA HT × taux de cotisation (`compute`, l. 1499-1501) | calcul de micro (§ 2) ; golden Z le fige (`cotis`, `cotisPct`) |

- Objectifs a ses propres définitions (certain, lu) : **facturé** = Σ HT des factures à leur date, avoirs compris (`realise`, `next-objectifs.js` l. 207, via `nxrgLignesFactures`) ; **encaissé** = Σ HT des encaissements à leur date (`nxrgLignesRecettes`, `next-regime.js` l. 476, montants ventilés HT / TVA).
- « Signé » n'a de définition nulle part. La date d'acceptation (`acceptedAt`) n'est écrite que par la **signature en ligne** (`next-signature.js` l. 205 ; `index.html` l. 1814) : un devis passé « Accepté » à la main n'en a pas (certain, recherche).
- **Défaut prouvé ici (R-M6b), annoncé le 25/10 comme « identique tant que tu es en franchise »** : une fois assujetti, `allRecettes` prend le **TTC** d'une facture de devis et le **HT** d'une intervention. Résultat sur un jeu de 2 encaissements :
  - écran Recettes et export CSV : 327,60 (TTC) et 60 (HT) sous l'en-tête « Montant HT » ;
  - carte « ENCAISSÉ » : 388 €, qui n'est ni le HT (333 €) ni le TTC (393,60 €) ;
  - « Statut & régime » (`nxrgLivre`, `next-regime.js` l. 520) ventile juste : 273 + 54,60 et 60 + 6.
- Deux livres coexistent donc : l'écran **Recettes** (`renderRecettes` l. 3390, `exportCSVRecettes` l. 3411, `printRecettes` l. 3422 : montants bruts) et **Statut & régime** (ventilé). L'impression du registre écrit en dur « micro-entreprise, recettes encaissées » et « TVA non applicable, art. 293 B du CGI » (l. 3428-3433).

### 1.6 Journal des essais (10/11/2026, `main` = `6457329`, hors réseau)
Scripts écrits dans le bloc-notes de la session (`repro-af2-af5.mjs`, `repro-m6-tva.mjs`). Ils sont **hors dépôt et ne sont pas gardés** : cette mission ne crée que deux fichiers. Chaque essai est décrit assez précisément pour être refait. Ils s'appuient sur `tests/lib.mjs` (`page`, `REF`) et, pour R-M6b, sur `BASCULE_ASSUJETTI` (`tests/golden/scenario-documents.mjs`). Aucune erreur JavaScript.

| Essai | Banc (horloge figée) | Résultat lu | Verdict |
|---|---|---|---|
| R-M1 | PC, REF (20/10/2026 10 h). Un bisplit rempli (patch des cas golden), « Accepté », avec une facture de solde | « Machine M R1 » dans l'écran À commander (7 articles, 1 310,30 € à commander), dans la demande de prix, dans le bon de commande ; tâche « article(s) à commander » présente | constaté |
| R-M2 | iPhone 13, REF. Intervention en brouillon datée du 19/10 | absente de Ma journée (matin et soir), de « À faire » et du tableau de bord ; aucun texte « non factur… » | constaté |
| R-M3 | PC, 4 horloges, réglages d'Objectifs par défaut (trimestriel) | 15/04/2027 → « T2 avant le 31/07/2027 » (le T1 est dû le 30/04) ; 02/05/2027 → « T2 » ; 10/01/2027 → « T1 avant le 30/04/2027 » (le T4 2026 est dû le 31/01) ; 31/07/2027 → « T3 » | constaté |
| R-M4 | PC, horloge 02/10/2026. Facture de solde du 25/09, chèque reçu le 29/09, « Payée » | `payeLe` = 2026-10-02 ; une seule question (« Mode de règlement ? »), sans date ; livre : 02/10 | constaté |
| R-M6 | PC, REF. 3 devis de 273 € : signé non facturé, facturé non payé, payé | « CA 2026 HT » 819 € ; « ENCAISSÉ » 273 € ; « Facturé — en attente » 273 € ; « Net après cotis. 23,68 % » 289 € ; pas de carte « Facturé » | mesuré |
| R-M6b | PC, REF, bascule « assujetti » comme les golden. Un devis facturé 327,60 TTC (273 HT) et une intervention de 60 HT, payés | livre de l'écran Recettes : 327,6 et 60 ; CSV « Montant HT » : 327,6 et 60 ; « ENCAISSÉ » 388 € ; Statut & régime : 273 / 54,6 / 327,6 et 60 / 6 / 66 | constaté |

## 2. Ton cap a changé : ce qui sert quel que soit le statut, ce qui en dépend

**Le cap (d'après le prompt de cette mission ; plan du 28/10 non relu ici)** : hypothèse de travail **EURL à l'IS, TVA au réel dès le jour 1**, au lieu de la micro-entreprise. Décision finale en décembre avec ta comptable. Ce dossier **n'écrit aucune règle fiscale ou sociale** : il trie ce qui existe.

| Élément | Où | Dépend du statut ? | Proposition |
|---|---|---|---|
| Matériel d'un chantier soldé (M1) | § 1.1 | non | AF2-A |
| Intervention faite non facturée (M2) | § 1.2 | non | AF2-A |
| Date d'encaissement réelle et mode dans une liste (M4) | § 1.4 | non : suivi des impayés, relances, relevé bancaire, livre | AF2-A. **Quelle date compte pour une déclaration** (chèque : réception ou remise en banque ; TVA éventuelle) : **à vérifier avec ta comptable**, la mission ne la choisit pas |
| « Signé », « Facturé », « Encaissé » côte à côte (M6) | § 1.5 | non : ce sont des chiffres de gestion | AF2-B, en **HT**, avec les définitions qu'Objectifs utilise déjà |
| Livre de l'écran Recettes et son CSV en montants exacts | § 1.5 | la ventilation HT / TVA sert dès qu'il y a de la TVA ; en franchise, rien ne change | AF2-B, en reprenant la ventilation déjà codée de `next-regime.js` (aucune règle nouvelle) |
| Échéance de déclaration Urssaf du tableau de bord (M3) et « À provisionner pour l'URSSAF (T : X encaissés × Y %) » | `index.html` l. 1376-1380, 3388 | **oui** : déclaration du chiffre d'affaires de la micro-entreprise | **gelé** (question 1) |
| « Net après cotis. X % » et « Rappel BP : le net après cotisations doit couvrir… » | l. 1328-1332, 1342 ; `compute` l. 1499-1501 | **oui** : cotisations = pourcentage du chiffre d'affaires, taux de `next-taux.js` (« une seule source pour les taux de la micro-entreprise », sources lues le 02/10/2026 par la mission 1.10, citées dans son en-tête) | **gelé**, inchangé (golden Z le fige) |
| Carte « Cotisations à provisionner » de l'écran Recettes | l. 3401-3403 | **oui** | **gelé** |
| Pied du registre imprimé (« micro-entreprise », « art. 293 B du CGI ») | l. 3428-3433 | **oui** (mention) | hors AF2 : AF4 (C4) ou mission TVA |
| « Pour la comptable » d'Objectifs (déclarations Urssaf, 1re déclaration à 90 jours) | `next-objectifs.js`, suite O | **oui** | hors AF2 : mission TVA, après ta décision |

- Le 25/10, la cible de M6 calculait le « net » sur l'encaissé, avec la mention « *probable, à confirmer sur autoentrepreneur.urssaf.fr* ». Cette règle n'est **pas** relue ici (source non consultée dans cette session) : elle reste **à vérifier**, et de toute façon gelée.
- Si tu restes en micro en décembre : M3 se fait comme prévu le 25/10 (le tableau de bord lit les périodes d'Objectifs, déjà testées), ≈ ½ jour. Si tu passes en EURL : le bloc « Paiements & URSSAF » est à refaire par la mission TVA, pas par AF2.

## 3. Comportement cible, écran par écran

Décisions du 25/10 reprises telles quelles (`docs/MISSION-AF-CORRECTIONS.md` § 0) :
- **décision 4** : « un chantier sort de la liste dès que sa **facture de solde** est émise (en plus des cases « commandé » qui existent) » ;
- **décision 5** : « « Payée » demande la **date d'encaissement** (aujourd'hui par défaut, modifiable) et le mode dans une liste. La date à retenir pour un chèque : la réponse de ta comptable (question 5) » ;
- **décision 6** : « le mot « CA » disparaît du bloc actuel, remplacé par « Signé », « Facturé », « Encaissé » côte à côte, avec les mêmes définitions qu'Objectifs et le livre des recettes ».

Aucun montant d'un devis existant ne change : `compute`, `computeDep`, `computeLoc` ne sont pas touchés (golden Z identiques). Aucun document émis ne change (golden Y identiques).

### 3.1 M1 — « À commander » (AF2-A)
- **Règle** : un chantier entre dans « reste à commander » s'il est **accepté** et **pas soldé**. Soldé = une facture de solde vivante (`facSolde` présente ; un avoir total la retire, `next-avoir.js` l. 97, et le chantier revient). Si tu dis oui à la question 2 : un acompte qui couvre déjà tout le devis compte aussi comme soldé (aujourd'hui, aucune facture de solde n'est alors possible : « Rien à facturer : l'acompte couvre déjà le total », `facturerDevis` l. 3183).
- **Une seule fonction** (proposée dans `index.html`, près de `renderCommander`), appelée par les quatre sorties du § 1.1. Pas de nouvelle enveloppe.
- **Écran « À commander »** (téléphone et PC) : le compteur « Chantiers signés » devient « Chantiers à approvisionner » et compte les mêmes chantiers que la liste. Liste vide : « Aucun chantier en attente de matériel. »
- **Bon de commande, demande de prix, tâche automatique** : mêmes chantiers.
- **Inchangé** : « Planifier le chantier », « Saisir le réel », le carnet, le planning ; les cases « commandé » par article ; la case « réservé/commandé » par chantier (question 3) ; le stock.
- **Hors ligne** : calcul local, aucun réseau.

### 3.2 M2 — « Intervention faite, pas facturée » (AF2-A)
- **Règle** : une intervention en **brouillon** (sans numéro de facture), datée **avant aujourd'hui** (date de l'appareil). Les retours SAV (`cpnext_sav`) ne sont pas des interventions et ne comptent pas.
- **Ma journée** (matin et soir, téléphone et PC) : une ligne « 🧾 N intervention(s) faite(s), pas encore facturée(s) » avec un bouton « Voir ». Une seule : il ouvre l'intervention ; plusieurs : il ouvre la liste des interventions.
- **À faire** (centre d'actions) : une tâche par intervention, « Facturer l'intervention — {client} ({date}) », qui ouvre l'intervention.
- La ligne disparaît dès que l'intervention est facturée, ou supprimée (corbeille).
- **Hors ligne** : calcul local. Une facture refusée hors ligne laisse l'intervention en brouillon : c'est précisément le cas rappelé.

### 3.3 M3 — gelé (question 1)
Aucun code dans AF2. Le constat reste écrit ici, avec ses tests (§ 4.3), prêts pour décembre.

### 3.4 M4 — Fenêtre « Encaissement » (AF2-A)
- **Où** : chaque bouton « 💶 » / « Marquer payée » ouvre la même fenêtre. Cinq endroits (certain, lu) : tableau de bord, factures en retard (l. 1386) ; liste des interventions (l. 2499, seulement vers « payée » : « Repasser en attente » ne change pas) ; locations (l. 3092) ; facturation du devis (bloc près de l. 3257) ; contrats (l. 3593).
- **Contenu** :
  - titre « 💶 Encaissement — facture {n°} » ; rappel « {client} · {montant} · émise le {date} » ;
  - « Date d'encaissement » : champ date, **aujourd'hui** par défaut, **jamais dans le futur** (message « La date d'encaissement ne peut pas être dans le futur. », rien d'enregistré) ;
  - « Mode de règlement » : liste Virement, Chèque, Espèces, Carte bancaire, Autre (question 4) ;
  - aide sous la date : « Date à laquelle tu as reçu le paiement. Pour un chèque, la date à retenir est celle que ta comptable t'a indiquée. » ;
  - boutons « Enregistrer l'encaissement » et « Annuler » (« Annuler » : rien d'enregistré, message actuel « Encaissement non enregistré (annulé) »).
- **Téléphone** : fenêtre pleine largeur, sélecteur de date du téléphone, boutons en bas (comme les fenêtres existantes, `next-mobile.js`). **PC** : même fenêtre, centrée.
- **Hors ligne** : tout est local ; `payeLe` et le mode partent à la synchro comme aujourd'hui (aucune clé nouvelle).
- **Où la date sert ensuite** (certain, lu : tous lisent `payeLe`) : livre des recettes (`allRecettes`), Statut & régime, Objectifs (encaissé par mois, déclarations), tableau de bord, relevé bancaire (`estPayee`), relances, demande d'avis (60 jours après le paiement).
- **Façon de faire (pour garder ce qui marche)** :
  - `payerFacture(kind, id, which)` et `payDep(id)` restent **synchrones** et gagnent un dernier argument facultatif `{date, mode}`. Sans lui : comportement d'aujourd'hui (date du jour, `askMode`). Les suites du § 1.4 et le relevé bancaire continuent de marcher ;
  - la fenêtre appelle ces fonctions avec l'argument ;
  - le contrôle L221-10 (`garderPaiement`, `next-particuliers.js`) s'évalue à **la date d'encaissement choisie**, comme le fait déjà le relevé bancaire ; aucune règle nouvelle ;
  - l'évènement « paiement » envoyé au serveur garde la date du geste et ajoute `payeLe` (question 5) ;
  - aucune enveloppe nouvelle (suite W inchangée) : on modifie les fonctions d'origine.

### 3.5 M6 — Signé, Facturé, Encaissé (AF2-B)
- **Tableau de bord, bloc des cartes** (téléphone : 2 colonnes ; PC : sur une ligne) — à la place de « CA {année} HT (devis + interv. + loc.) » et de « 💶 ENCAISSÉ {année} » :
  - « ✍️ Signé {année} HT » : Σ HT des devis **acceptés** (ni remplacés, ni annulés), à la date d'acceptation (question 6) ;
  - « 🧾 Facturé {année} HT » : la définition d'Objectifs (Σ HT des factures à leur date, avoirs déduits, essais exclus) ;
  - « 💶 Encaissé {année} HT » : la définition d'Objectifs (Σ HT des encaissements à leur date) ;
  - « Facturé — en attente » devient « ⌛ En attente de paiement » (ce qui reste dû, TTC si assujetti, comme aujourd'hui) ;
  - « dont interventions » et « dont locations » : parts du **facturé** ;
  - inchangés : « Devis créés », « Acceptés » (lu par la suite AD), « Marge moyenne devis », « Bénéfice brut », « Net après cotis. X % » (gelé, lu par la suite K), « À vérifier ».
- **Barre de l'objectif annuel** : « {facturé} facturés sur un objectif de {objectif} / an » (question 7). Le rythme mensuel et le rappel BP ne changent pas (le rappel BP est gelé, § 2).
- **Écran Recettes** :
  - la carte « Encaissé {année} » et le tableau lisent les lignes ventilées de `next-regime.js` ; la carte donne le **HT**, comme le tableau de bord et Objectifs ;
  - **en franchise** : affichage et fichier CSV **identiques** à aujourd'hui (HT = TTC, aucune colonne en plus) ;
  - **assujetti** : colonnes « Montant encaissé », « dont TVA », « Montant HT », comme l'export de Statut & régime. Format à faire valider par ta comptable avant ta première facture assujettie (cible du 25/10) ;
  - le pied du registre imprimé ne change pas (§ 2).
- **Hors du bloc, non touchés** : le graphique « Chiffre d'affaires par mois (devis acceptés + dépannages facturés) » et « Top clients (CA accepté HT) », qui disent ce qu'ils comptent. À revoir avec la mission TVA si tu le souhaites.
- **Hors ligne** : calcul local.

## 4. Tests à écrire d'abord (rouges sur `main`)

Horloge : `REF` (`tests/lib.mjs`) dans les pages ; une horloge figée pour les dates particulières. Aucun test ne lit la vraie date. Vérifier aussi avec `faketime` un samedi, un dimanche et le 05/01 de l'année suivante (règle 9). Le journal des rouges est gardé (`git stash push <fichiers de code>`, lancer, `git stash pop`).

**Nouvelle suite** : `tests/suiteAJ-af2-montants.mjs` (proposé). AB = S, AE = P3, AG = P11 ; AH est réclamée **à la fois** par COMPTE et AF1-B (AF1-B prend la suivante, AI). Prendre la première lettre libre au moment de coder. Inscription dans `tests/run-all.sh` (`SUITES_DEFAUT`) et `tests/isolation/rapport.mjs`. Appareils : iPhone 13 et PC.

### 4.1 M1
| Test | Départ | Attendu | Sur `main` |
|---|---|---|---|
| M1-1 | bisplit rempli, accepté, facture de solde | absent des 4 sorties (écran, demande de prix capturée par `buildMail`, bon de commande capturé par `print`, tâche) | rouge (R-M1) |
| M1-2 témoin | accepté sans facture | présent dans les 4 | vert |
| M1-3 témoin | accepté avec acompte seulement | présent | vert |
| M1-4 | solde annulé par un avoir total | présent à nouveau | vert sur `main` (constat), doit le rester |
| M1-5 (question 2) | acompte de 100 % | absent | rouge |
| M1-6 témoin | original remplacé par un avenant accepté | original absent, avenant présent | vert |
| M1-7 témoin | chantier soldé sans date | « Planifier le chantier » inchangé | vert |
| M1-8 | téléphone et PC | compteur « Chantiers à approvisionner » = nombre de chantiers listés | rouge |

### 4.2 M2
| Test | Départ | Attendu | Sur `main` |
|---|---|---|---|
| M2-1 | horloge REF ; intervention en brouillon datée de la veille (comme R-M2) | ligne « 1 intervention faite, pas encore facturée » dans Ma journée (matin et soir) ; tâche dans « À faire » ; « Voir » ouvre l'intervention | rouge (R-M2) |
| M2-2 | puis « Facturer » (démonstration, TEST-F) | ligne et tâche disparues | rouge |
| M2-3 témoins | intervention du jour ; intervention future ; intervention facturée ou payée | aucune ligne | vert |
| M2-4 | 3 interventions passées | « 3 interventions… » ; « Voir » ouvre la liste | rouge |
| M2-5 | iPhone 13 | aucun débordement horizontal (comme O13) | rouge (ligne absente) |

### 4.3 M3 (écrits, **mis de côté** tant que la question 1 est « oui »)
Horloges 15/04, 02/05 (déclaré et non déclaré), 10/01, mode mensuel : le tableau de bord donne la même période et la même échéance qu'Objectifs (`aFaire`). Rouges sur `main` (R-M3).

### 4.4 M4
| Test | Départ | Attendu | Sur `main` |
|---|---|---|---|
| M4-1 | vrai clic sur « 💶 » (PC et iPhone 13) | fenêtre ; date = jour de l'horloge ; liste des modes | rouge |
| M4-2 | horloge 02/10/2026, date 29/09, Chèque | `payeLe` 2026-09-29 ; livre : 29/09 ; Objectifs : dans l'encaissé de septembre (`nxobjRealise('2026-09')`) | rouge (R-M4) |
| M4-3 | date de demain | message, rien d'enregistré | rouge |
| M4-4 | « Annuler » | rien d'enregistré, message actuel | rouge (pas de fenêtre) |
| M4-5 | les 4 sortes (acompte et solde de devis, intervention, location, contrat) | date et mode enregistrés | rouge |
| M4-6 | particulier hors établissement, encaissement daté **avant** la fin du délai L221-10 | le parcours « paiement irrégulier » actuel se déclenche, évalué à la date choisie | rouge |
| M4-7 | évènement « paiement » au serveur simulé | contient `payeLe` (question 5) | rouge |
| M4-8 | hors ligne (`ctx.setOffline(true)`) | fenêtre, `payeLe` gardé, « à synchroniser » | rouge |
| M4-9 témoin | `payerFacture(kind, id, which)` sans argument | comportement d'aujourd'hui | vert |
| M4-10 témoin | relevé bancaire (suite P) | inchangé | vert |

### 4.5 M6
| Test | Départ | Attendu | Sur `main` |
|---|---|---|---|
| M6-1 | jeu fixe, franchise : 3 devis (signé, facturé, payé) + 1 intervention facturée + 1 location | « Signé », « Facturé », « Encaissé » aux valeurs attendues ; plus de mot « CA » dans le bloc des cartes | rouge (R-M6) |
| M6-2 | même jeu | « Facturé » = Σ des mois d'Objectifs ; « Encaissé » idem | rouge |
| M6-3 | jeu de R-M6b, assujetti | « Encaissé » = 333 € (HT) ; écran Recettes et CSV ventilés | rouge (R-M6b) |
| M6-4 témoin | franchise | CSV de l'écran Recettes **octet pour octet** identique à `main` | vert |
| M6-5 témoins | | « Acceptés » (suite AD) et « Net après cotis. » (suite K) présents | vert |
| M6-6 (question 6) | devis accepté à la main | `acceptedAt` posé ; compté dans « Signé » de l'année d'acceptation | rouge |

### 4.6 Suites existantes
- **À adapter (préparation seulement, pas les attendus)** : **Q** (l. 217) clique `button[onclick*="payerFacture"]` et répond « Chèque » à `prompt` ; avec M4, elle cliquera le nouveau bouton et remplira la fenêtre. Attendus inchangés (`payeLe` = 15/09/2027, mode « Chèque », évènement au registre).
- **Ne doivent pas bouger** : E, I, J, K, L, P, R, T, AD (appels directs sans argument : comportement d'aujourd'hui) ; O (Objectifs) ; U, V, AE (aucune fusion touchée) ; W (aucune enveloppe nouvelle ; `renderDash` est modifiée à l'origine) ; X ; **Y et Z** (aucun montant, aucun document). Les 5 « À TRANCHER » ne bougent pas.
- **Golden** : aucun ne change. Si l'un bouge, c'est une erreur de la mission, pas une régénération.

## 5. Découpage, ordre, risques, retour arrière, estimation

### 5.1 Deux branches (question 8)
| Branche | Contenu | Fichiers de l'appli | Durée (sessions) |
|---|---|---|---|
| `correctif/af2a-commande-paiements` | M1, M2, M4 | `index.html` (fonction « soldé », `renderCommander`, `mailDemandePrix`, `payerFacture`, `payDep`, fenêtre, 5 boutons), `next-commande.js`, `next-addons.js` (`nxAutoTasks`), `next-journee.js`, `next-particuliers.js` (`garderPaiement`), `next-emission.js` (évènement), `sw.js` | tests ½ à 1 ; code 1,5 ; batterie, `faketime`, CI, compte rendu 1 → **3 à 3,5 jours** |
| `correctif/af2b-chiffres` | M6 réduit | `index.html` (`renderDash`, `renderRecettes`, `exportCSVRecettes`, `acceptedAt` à l'acceptation si question 6), `sw.js` | **1,5 à 2 jours** |
| (décembre, si micro) | M3 | `index.html`, `next-objectifs.js` | ½ jour |

- **Ton temps** : ≈ 15 min d'essai par branche, la fusion, les F5.
- `const C=` de `sw.js` : une fois par branche. `VERSION` et `NX_VERSION` : te demander.

### 5.2 Ordre
1. S, COMPTE, P11, AF1-B fusionnées (file des missions).
2. AF2-A : tests rouges (journal gardé), code, suite visée, batterie complète, CI verte, relecture par l'autre modèle (`relecture-p10`), ton essai, ta fusion, F5.
3. AF2-B : même chemin.
4. AF5 ensuite (fichiers communs, § 5.4). Rien côté serveur : aucune migration, aucune fonction, aucun secret ; aucune clé synchronisée nouvelle.

### 5.3 Risques et garde-fous
| Risque | Garde-fou | Certitude |
|---|---|---|
| Un appel direct à `payerFacture` (couche, relevé, test) casse | argument facultatif ; sans lui, rien ne change (M4-9 ; suites E, I, J, K, L, P, R, T, AD) | probable, à prouver |
| Le contrôle L221-10 regarde la mauvaise date | M4-6 ; même mécanisme que le relevé bancaire (suite P) | probable |
| Une date d'encaissement fausse saisie | jamais dans le futur ; « Annuler l'encaissement » existe déjà (`annulerEncaissement` l. 3232) | certain (lu) |
| Le tableau de bord ralentit (lignes ventilées recalculées) | Objectifs a déjà le cache d'un affichage (`avecCache`) ; mesure sur 1 800 factures comme O | hypothèse |
| Le CSV en franchise change sans qu'on le voie | M6-4, comparaison octet pour octet | certain (test) |
| Un chantier soldé par erreur disparaît de « À commander » | l'avoir total le remet (M1-4) ; les cases « commandé » ne bougent pas | probable |
| Conflits avec S (échappement, politique de sécurité du navigateur) | AF2 après S ; si S remplace les `onclick` en ligne, les 5 boutons et la suite Q suivront sa façon de faire | hypothèse (dossier de S non lu ici) |

### 5.4 Fichiers communs avec les autres missions (conflits probables)
| Mission | Fichiers communs | Risque |
|---|---|---|
| S | `index.html` et la plupart des `next-*.js` (échappement des gabarits HTML) | **élevé** : AF2 après S, rebase obligatoire |
| COMPTE | `index.html` (Paramètres, connexion), peut-être `next-emission.js` (`demanderServeur`) | faible (fonctions différentes) |
| P11 | `index.html` (`window.onerror`, Paramètres), `next-assistant.js`, `next-fiabilite.js` | faible |
| AF1-B | `next-emission.js` (`mode`, `badge`, `finir`), `index.html` (`cloudLbl`, `markDirty`, `pushState`) | faible à moyen (AF2-A touche l'enveloppe des paiements de `next-emission.js`) |
| AF5 | `next-addons.js` (`nxAutoTasks` : M1, M2 / T2), `next-journee.js` (M2 / T2, T4), `next-particuliers.js` (M4 / T3, T6), `next-emission.js` (M4 / A11) | **moyen** : jamais en même temps ; AF5 après AF2 |

### 5.5 Retour arrière
- Revert du commit « code » de la branche : les tests d'AF2 redeviennent rouges.
- **Données** : aucun champ synchronisé nouveau. M4 écrit `payeLe` et `mode` (existants) ; M6 écrit `acceptedAt` (existant) sur un devis accepté à la main. Une ancienne version les lit sans erreur (certain : champs déjà lus aujourd'hui).
- Rien côté serveur.

### 5.6 L'essai que tu feras (esquisse ; le compte rendu détaillera)
Sur la copie d'essai, avec ton téléphone, ≈ 15 min par branche.
1. AF2-A : facture de solde d'un devis avec du matériel. Attendu : il quitte « À commander ».
2. Une intervention d'essai datée d'hier, en brouillon. Attendu : « 1 intervention faite, pas encore facturée » dans Ma journée.
3. « 💶 » sur une facture : mets la date d'avant-hier, « Chèque ». Attendu : le livre des recettes montre avant-hier.
4. AF2-B : tableau de bord. Attendu : « Signé », « Facturé », « Encaissé » ; plus de « CA » dans les cartes.

## 6. Tes questions (oui / non)

1. **Geler M3 et le « net après cotisations »** jusqu'à ta décision de statut (décembre) ? Ce sont des calculs de micro-entreprise ; ton cap est l'EURL à l'IS.
   - Recommandé : **oui**. Le tableau de bord reste faux sur l'échéance Urssaf d'ici là, mais tu ne factures pas avant septembre 2027.
   - Si non : M3 se fait dans AF2-A (½ jour), et sera peut-être à défaire.
2. **M1 : un acompte qui couvre tout le devis compte comme « soldé »** ?
   - Recommandé : **oui** (sinon ce chantier reste « à commander » pour toujours).
3. **M1 : pas de nouvelle case « matériel reçu »** ? La décision 4 ne la cite pas ; la case « réservé/commandé » par chantier reste un pointage.
   - Recommandé : **oui**. Si tu la veux : une case de plus, ½ jour.
4. **M4 : modes Virement, Chèque, Espèces, Carte bancaire, Autre**, la carte enregistrée « CB » comme aujourd'hui (relevé bancaire, anciennes données) ?
   - Recommandé : **oui**.
5. **M4 : l'évènement « paiement » envoyé au serveur porte aussi la date d'encaissement** (en plus de la date du geste) ?
   - Recommandé : **oui** (aucune migration : c'est un détail de l'évènement).
6. **M6 : « Signé » compté à la date d'acceptation** (signature en ligne ; sinon passage à « Accepté », qui écrira désormais `acceptedAt` ; anciens devis : date de création) ?
   - Recommandé : **oui**. Si non : date de création, comme aujourd'hui.
7. **M6 : la barre de l'objectif annuel suit « Facturé »**, comme Objectifs ?
   - Recommandé : **oui**.
8. **Deux branches** : AF2-A (M1, M2, M4), puis AF2-B (M6) ?
   - Recommandé : **oui** (chacune sous la semaine, relecture comprise).

## 7. Ce qui n'a pas été vérifié
- Le plan du 28/10, le mail préparé pour ta comptable et ses réponses : outil Projects absent.
- Les règles sociales et fiscales (cotisations, date d'un chèque, TVA à l'encaissement) : non relues, aucune n'est tranchée ici.
- Le dossier de la mission S (hors dépôt) : les conflits du § 5.4 sont déduits de son sujet.
- Aucun iPhone réel ; la performance du tableau de bord avec beaucoup de factures (hypothèse du § 5.3).
