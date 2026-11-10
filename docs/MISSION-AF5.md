# ClimPilot — Mission AF5 : écrans qui font perdre du temps (T2 à T8, K1, K5, K13, A11) — dossier de mission

> Rédigé le 10/11/2026 par Claude (session Claude Code, mission AF2-AF5-DOSSIER) pour Gabriel Leroy. **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-af2-af5`, partie de `main` = `6457329`.
> Point de départ : le tableau AF5 de `docs/MISSION-AF-CORRECTIONS.md` (§ 6), écrit le 25/10 sur le code de la 1.13. Depuis, AF1, AF1-5, C3, P6+ et P3 ont été fusionnées. Chaque point est relu ici sur `main`, et reproduit quand c'est possible.
> Numéros de ligne lus sur `main` (`6457329`). S, COMPTE, P11, AF1-B et AF2 passent avant AF5 et les décaleront : l'exécutant retrouve tout par le **nom des fonctions**.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project. La copie `claude/ClimPilot-AF5-dossier.md` reste à faire.
> Rien n'a été exécuté contre Supabase. Les essais du § 1.3 tournent sur la vraie appli (Chromium 141, Playwright 1.56.1, Node 22), serveur local, Supabase bloqué par `tests/lib.mjs`, **horloge de la page figée** (jamais la vraie date), données fictives.
> Certitude : **certain** (lu dans le code, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. **Lis le § 1** : 10 points sur 11 sont toujours vrais (9 reproduits sur `main`, K5 lu). **K13 a changé** : réglé sur téléphone depuis la 1.7.0, il reste sur PC.
2. Deux corrections du résumé du 25/10 : la phrase fausse du code d'accès (K1) est désormais à la mission **COMPTE** ; la cible de **T7** était fausse (la vue « Relances » ne montre que les devis), nouvelle cible au § 2.
3. **K5 est plus large que prévu** : le nom de l'entrepreneur est écrit en dur dans le **mail** et le SMS de signature, et dans le mail fournisseur.
4. Réponds aux **8 questions du § 6** (oui / non suffit).
5. AF5 ne change **aucun montant, aucune règle fiscale, aucun document émis** : golden Y et Z identiques.
6. AF5 se code **après AF2** (fichiers communs) : une seule mission sur le code à la fois.
7. Estimation : 3,5 à 4,5 jours de sessions, en **deux branches** (question 8) : AF5-A (terrain : T2, T3, T4, T6, T8), puis AF5-B (écrans et textes : T5, T7, K1, K5, K13, A11).
8. Après chaque fusion : « ✓ synchronisé », puis F5 sur chaque appareil, **le même jour**.
9. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Où en est chaque point (lecture et essais sur `main`, `6457329`)

### 1.1 Tableau

| # | Constat du 25/10 | Aujourd'hui (fonction, fichier, ligne) | Verdict | Preuve |
|---|---|---|---|---|
| T2 | Contrat créé à l'acceptation d'un devis d'entretien : 1re visite = date « première » du devis, sinon aujourd'hui + 30 jours ; le devis reste « à planifier » et « Urgent » | `syncContracts`, `next-mod-entretien.js` l. 192 ; date l. 206 (`isoPlus(30)`). Le devis reste dans **4** listes « à planifier » : Planning (`renderPlanning`, `index.html` l. 3937), « À faire » (`nxAutoTasks`, `next-addons.js` l. 238, priorité haute), bandeau du tableau de bord (l. 262), Ma journée (`collect`, `next-journee.js` l. 45) | **toujours vrai** | certain, exécuté R-T2 |
| T3 | Le contrat ne recopie pas le mode de conclusion : « Facturer » bloque | création l. 207-211 : aucun champ `conclusion`. « Facturer » le contrat : `nxAvantEmission` (`next-particuliers.js` l. 145) → « Mode de conclusion du contrat à préciser… (art. L221-10) », rien n'est émis, la fenêtre « Contrat avec un particulier » s'ouvre | **toujours vrai** | certain, exécuté R-T3 |
| T4 | Après 14 h, Ma journée passe en mode soir et la carte Tournée disparaît, avec « Terminer » | `render`, `next-journee.js` l. 73 (`h<14`) ; `carteTournee`, `next-terrain.js` l. 120-121 (`mode!=='matin'` → rien). C'est le **seul** accès à « ■ Terminer » (`nxtrTerminer` l. 65). Contournement existant : bouton « Matin » en haut de Ma journée | **toujours vrai** | certain, exécuté R-T4 |
| T5 | Le menu « ＋ Créer » reste ouvert après « Nouveau devis » | écoute du clic de `next-devis2.js` l. 838-852, **en phase de capture** sur `document`, qui arrête la propagation ; la fermeture du menu (`next-addons.js` l. 785) n'est jamais atteinte. Le choix de la nature s'ouvre par-dessus ; le menu réapparaît quand on le ferme | **toujours vrai** | certain, exécuté R-T5 (PC et iPhone 13) |
| T6 | « Préciser / modifier » le contrat d'un devis jamais enregistré → « Document introuvable » | `objet`, `next-particuliers.js` l. 42-50 : ne cherche que dans les devis enregistrés ; `nxPartConclusion` l. 88-89. Le panneau, lui, affiche déjà le devis ouvert (`panneauDevis` l. 243, `objet(…)||cur`). Même défaut pour « Exemplaire papier remis » (`nxPartRemisePapier` l. 119) | **toujours vrai** | certain, exécuté R-T6 |
| T7 | Objectifs › « Relancer N factures » ouvre le livre des recettes ; cible du 25/10 : « ouvrir la vue Relances (elle existe) » | bouton « Ouvrir » → `go('recettes')`, `next-objectifs.js` l. 531. **La vue « Relances » est « Relances devis »** (`next-relance.js` l. 112) : elle ne montre aucune facture. Les factures impayées avec « ✉️ Mail de rappel » et « 💶 » ne sont listées qu'au tableau de bord (« 💸 Paiements & URSSAF › Factures en retard (+30 j) », `index.html` l. 1385-1386), et une par une dans « À faire » | **toujours vrai ; cible à corriger** | certain, exécuté R-T7 |
| T8 | La veille d'une visite : « je vous confirme mon passage » **et** « votre visite approche… vos disponibilités ? » au même client ; `if(mode==='soir'||true)` | `candidatsVeille` l. 68 et `candidatsEntretien` l. 78, `next-messages.js`, sans dédoublonnage ; la visite d'un contrat est un évènement du planning (`planEvents`, `index.html` l. 3913-3914). Condition toujours là (l. 121) | **toujours vrai** | certain, exécuté R-T8 |
| K1 | Paramètres parle de « Notion en direct » ; code d'accès : « tes données restent uniquement sur cet ordinateur » | textes « Notion » : liste au § 2, K1. En version web, les prix sont **embarqués** (`syncNotion`, `index.html` l. 1188-1197 ; l'étiquette du haut dit déjà « Prix embarqués 07/2026 (modifiables) »). La phrase du code d'accès (l. 814) est **reprise par la mission COMPTE** (dossier § 3.8, test AH16) | **toujours vrai** (textes) ; **code d'accès : déplacé vers COMPTE** | certain, exécuté R-K1 |
| K5 | Mails et SMS de signature signés du nom de l'entrepreneur en dur | `mailText` (`next-signature.js` l. 36-40) : le mail de **devis** finit par « Bien cordialement, » et le nom en dur ; `smsText` (l. 41) aussi. Même nom en dur, sous condition, dans le mail fournisseur (`next-fournisseur.js` l. 108). Le modèle à suivre existe : `signature()`, `next-messages.js` l. 28 (Paramètres › « Nom et prénom de l'entrepreneur », sinon nom de l'entreprise, + téléphone) | **toujours vrai, et plus large** | certain, lu |
| K13 | Le bouton flottant « Assistant » recouvre le bas du contenu sur téléphone | téléphone (≤ 860 px) : marge basse de 110 px **depuis la 1.7.0** (`next-mobile.js` l. 89). PC : aucune marge (`.content`, `index.html` l. 52 ; bouton `next-assistant.js` l. 757) | **changé** : réglé sur téléphone (sauf peut-être Objectifs), toujours vrai sur PC | certain, exécuté R-K13 |
| A11 | `money()` n'existe pas dans `next-emission.js` : la carte « Facturation réelle » affiche `1234.56 €` | `carteParams` l. 853 ; l. 856 : variable locale `eur` qui appelle `money` (absente), l'erreur tombe dans son `catch` et rend `toFixed(2)+' €'`. Formateur de l'appli : `eur` global, `index.html` l. 1035 | **toujours vrai** | certain, exécuté R-A11 |

### 1.2 Ce qui a changé depuis la 1.13 (certain, `git log 477a151..6457329` par fichier ; `477a151` = fusion de la 1.13 dans `main`)
- **Aucun commit** sur `next-journee.js`, `next-terrain.js`, `next-objectifs.js`, `next-messages.js`, `next-mod-entretien.js`, `next-fournisseur.js`, `next-mobile.js` (T2, T4, T7, T8, K5 fournisseur, K13).
- `next-particuliers.js` (`a789cbd`, AF1 C-N1) : l'intervention ouverte (`curDep`) suit la fenêtre de conclusion ; le devis ouvert, non (T6 reste).
- `next-devis2.js`, `next-addons.js` (AF1, AF1-bis, AF1-5, C3) et `next-signature.js` (AF1 à AF1-5 ter) : aucune des lignes modifiées ne touche T2, T5 ou K5 (`mailText`, `smsText` inchangés).
- `next-emission.js` (AF1-bis, AF1-ter, P3) : `carteParams` (A11) inchangée.

### 1.3 Journal des essais (10/11/2026, `main` = `6457329`, hors réseau)
Scripts écrits dans le bloc-notes de la session (`repro-af2-af5.mjs`, `repro-k13b.mjs`, `repro-t5.mjs`). Ils sont **hors dépôt et ne sont pas gardés**. Chaque essai est décrit assez précisément pour être refait avec `tests/lib.mjs` (`page`, `REF`, `seed`). Aucune erreur JavaScript.

| Essai | Banc (horloge figée) | Résultat lu | Verdict |
|---|---|---|---|
| R-T2 | PC, REF (mardi 20/10/2026 10 h). Devis « Entretien & contrat » (format contrat, « Première visite prévue » vide), particulier, « signé dans les locaux », accepté ; `nxenSyncContracts()` | contrat créé, prochaine visite **2026-11-19** (REF + 30 jours) ; « Planifier le chantier Client… » dans « À faire » ; « à planifier » dans le bandeau | constaté |
| R-T3 | suite de R-T2, `facturerContrat` | contrat sans `conclusion` ; alerte « Mode de conclusion du contrat à préciser avant toute demande de paiement (Code de la consommation, art. L221-10) » ; 0 facture | constaté |
| R-T4 | iPhone 13, 20/10/2026 **15 h**. Intervention du jour, pointage en cours depuis 1 h | Ma journée en « 🌙 Fin de journée » ; aucun « Terminer » ; après « Matin » : « Terminer » visible | constaté |
| R-T5 | PC et iPhone 13, vrais clics : « ＋ Créer » puis « + Nouveau devis » | menu toujours ouvert (`open` = vrai), le choix de la nature s'affiche par-dessus ; témoin : « + Dépannage » ferme le menu | constaté |
| R-T6 | PC. Devis dépannage, particulier, jamais enregistré ; `nxPartConclusion('devis', id)` | message « Document introuvable » ; aucune fenêtre | constaté |
| R-T7 | PC, REF, début du plan au 01/01/2026, facture TEST impayée depuis 45 jours | « Relancer 1 facture(s) impayée(s) depuis plus de 30 jours (200 €). » ; boutons « Ouvrir » (`go('recettes')`) et « Déjà payées ? Mon relevé » ; vue « Relances » présente dans le menu (devis seulement) | mesuré |
| R-T8 | iPhone 13, REF. Contrat avec visite le 21/10 | veille : « Bonjour, je vous confirme mon passage demain dans la journée (… » ; entretien : « … votre visite approche (vers le 21 octobre). » au **même** client | constaté |
| R-K1 | PC, Paramètres | « base Notion = 75 €/h », « viennent de Notion en direct », « Revenir aux valeurs Notion », « Notion : coût interne technicien », « tes données restent uniquement sur cet ordinateur » | constaté |
| R-K13 | iPhone 13 et PC, jeu `seed`, page défilée jusqu'en bas | iPhone : rien sous le bouton en bas du tableau de bord, des devis, des Paramètres, de Ma journée, des recettes ; **Objectifs** : un texte d'aide encore dessous (« Vide = date de début du p… », mesure à confirmer). PC : « Ouvrir les protections » (dernier bouton du tableau de bord) et un champ des réglages d'Objectifs **sous** le bouton | mesuré |
| R-A11 | PC. Ancienne facture `F-…-001` de 1234,56 €, pas de décision de facturation réelle ; Paramètres | carte : « 1234.56 € » ; `typeof money` = `undefined` ; `eur(1234.56)` = « 1 234,56 € » | constaté |

## 2. Comportement cible, écran par écran

Aucune règle fiscale ou légale nouvelle, aucun montant, aucun document émis ne change (golden Y et Z identiques). Les textes ci-dessous sont proposés ; la relecture peut les ajuster sans changer leur sens.

### T2 — Contrat d'entretien créé à l'acceptation (AF5-A)
- **Date de la 1re visite** :
  - « Première visite prévue » remplie sur le devis : reprise telle quelle (comme aujourd'hui) ;
  - vide (question 1, recommandé) : **aucune date inventée**. Le contrat est créé avec « 1re visite : à fixer » (`prochaineVisite` vide) ;
  - pourquoi pas une question à l'acceptation : un devis accepté par **signature en ligne** est appliqué par la synchro, sans personne devant l'écran (`next-signature.js` l. 205). Une question ne marcherait que pour l'acceptation à la main.
- **« À planifier »** (Planning, « À faire », bandeau du tableau de bord, Ma journée ; téléphone et PC) :
  - un devis qui ne contient **que** des contrats n'y figure plus (même test que `next-mod-entretien.js` l. 189-190 : tous les lots réels sont des contrats) ;
  - un devis contrat + pose y reste (la pose se planifie) ;
  - à la place : « 🤝 Contrat {client} : fixer la 1re visite », qui ouvre le contrat (écran Contrats) ;
  - une fois la date mise : la ligne disparaît ; la visite est au planning, comme toutes les visites de contrat.
- **Ce qui lit `prochaineVisite`** (certain, lu) : compteur des contrats (`index.html` l. 1307), planning (l. 3913), messages, « À faire » (`next-addons.js` l. 243), export d'agenda (l. 512) ignorent déjà un contrat sans date ; l'écran Contrats affiche « — » (l. 3587) ; « Visite faite » ne fait rien (`visiteFaite` l. 3509) ; la fiche du contrat garde le champ vide (l. 3493). La facture du contrat n'en dépend pas (`ctrPeriod` part du début du contrat ; probable).
- **Contrats déjà créés** : inchangés (ils gardent leur date).
- **Hors ligne** : tout est local.
- **Si question 1 = non** : la date « + 30 jours » reste, avec « date à confirmer » sur le contrat et au planning.

### T3 — Mode de conclusion du contrat (AF5-A)
- À la création, le contrat **recopie** la conclusion du devis (mode, date, preuve, urgence, remise de l'exemplaire), si elle existe.
- Contrats créés avant AF5 (question 2) : s'ils n'ont pas de conclusion et ont un devis d'origine (`devisId`), on **lit** celle du devis. Rien n'est réécrit dans les données.
- Le contrôle L221-10 reste celui d'aujourd'hui (`regle`, `next-particuliers.js` l. 63). Un contrat dont le devis était lui-même « à préciser » reste bloqué, avec le même message.
- Probable, à confirmer à la relecture : le contrat d'entretien est conclu par l'acceptation de ce devis, donc son mode de conclusion est celui du devis.

### T4 — « Terminer » après 14 h (AF5-A)
- Ma journée, **tout mode** (matin ou soir), téléphone et PC : si un pointage est en cours, une carte en tête :
  - « ⏱ Pointage en cours — {intervention} depuis {durée} » ;
  - bouton « ■ Terminer » (même fonction `nxtrTerminer`).
- La carte « Tournée du jour » reste réservée au matin.
- **Hors ligne** : le pointage en cours est sur l'appareil (`cpnext_pointage`) ; tout marche sans réseau.

### T5 — Menu « ＋ Créer » (AF5-B)
- Tout bouton du menu le referme, « Nouveau devis » compris.
- Correction dans l'écoute de `next-devis2.js` (fonction d'origine), juste avant d'ouvrir le choix de la nature. Aucune enveloppe nouvelle.
- Téléphone et PC.

### T6 — Contrat d'un devis pas encore enregistré (AF5-A)
- « Préciser / modifier » et « Exemplaire papier remis » ouvrent leur fenêtre sur le **devis ouvert**, comme le panneau l'affiche déjà.
- L'information va sur le devis ouvert ; elle est enregistrée avec lui au clic « Enregistrer ». Quitter sans enregistrer la perd, comme le reste du devis (probable).
- Message « Document introuvable » gardé seulement s'il n'y a ni devis enregistré ni devis ouvert de cet identifiant.

### T7 — « Relancer N factures » (AF5-B, cible corrigée)
- Le bouton devient « Voir les factures » et ouvre le **tableau de bord**, défilé jusqu'à « Factures en retard (+30 j) » : la seule liste qui a « ✉️ Mail de rappel » et « 💶 » (question 3).
- Pas de nouvelle vue : un suivi des relances de factures est une idée gelée (`docs/APRES-PRO-V1.md`, envie n° 11).
- Point de vigilance : les deux comptes (Objectifs : impayés de Statut & régime, avoirs déduits ; tableau de bord : `allImpayes`) devraient donner les mêmes factures ; un test le vérifie (probable).
- Si M3 (AF2) refait le bloc « Paiements & URSSAF » après ta décision de statut, la liste « Factures en retard » doit rester.

### T8 — Messages de la veille (AF5-A)
- Une visite de contrat qui a un message « veille » (demain, ou lundi quand on est vendredi ou samedi) ne reçoit **plus** le message « entretien… votre visite approche… vos disponibilités ? » pour la même date.
- Une visite plus lointaine garde le message « entretien » (suite T, contrat à 10 jours : inchangée).
- `if(mode==='soir'||true)` est écrit comme ce qu'il fait : messages « veille » proposés matin et soir, comportement inchangé (question 4).

### K1 — Textes « Notion » (AF5-B)
Version web (pas de `window.cowork`, cas de tes appareils) : textes « prix embarqués ». Si l'appli tourne un jour dans Cowork (elle y lit Notion), les textes suivent le mode, comme l'étiquette du haut le fait déjà (question 5). **Aucun prix ne change.**

| Où (`index.html`) | Aujourd'hui | Proposé (web) |
|---|---|---|
| l. 309 (devis, matériel) | « Prix lus en direct de la base Notion « 📦 Matériel v2 » (77 articles). » | « Prix du matériel : prix embarqués (07/2026), modifiables dans Base de prix. » |
| l. 782 (Base de prix) | « Source : base Notion « ⚙️ Tarifs automatiques 2026 » en direct — modifie tes prix là-bas… » | « Source : prix embarqués (07/2026), modifiables ici. » |
| l. 795 | « business plan = 45 €/h, base Notion = 75 €/h » | « business plan = 45 €/h, prix embarqués = 75 €/h » |
| l. 796 | « Les tarifs (forfaits, zones, marges…) viennent de Notion en direct. Si tu modifies une valeur ici, elle prime sur Notion jusqu'à « Revenir aux valeurs Notion ». » | « Les tarifs (forfaits, zones, marges…) sont les prix embarqués (07/2026). Si tu modifies une valeur ici, elle prime jusqu'à « Revenir aux prix embarqués ». » |
| l. 825, 2201, 2205 | « ↺ Revenir aux valeurs Notion » ; « Revenir aux valeurs Notion pour tous les tarifs ? » ; « ↺ Tarifs Notion rétablis » | « ↺ Revenir aux prix embarqués » ; « Revenir aux prix embarqués pour tous les tarifs ? » ; « ↺ Prix embarqués rétablis » |
| l. 1250 (titre de Base de prix) | « … synchro Notion. » | « … prix embarqués, modifiables. » |
| l. 2045-2053, 2110-2116 (Base de prix) | étiquette « Notion », « version locale qui remplace le prix Notion », « Les articles Notion se modifient dans Notion », « revenir au prix Notion » | « embarqué », « … le prix embarqué », « Crée une version locale pour modifier cet article », « revenir au prix embarqué » |
| l. 2146-2171 (aides des champs) | « Notion : coût interne technicien », « Notion : visserie + imprévus »… | « Prix embarqués : … » (même suite) |
| l. 814 (code d'accès) | « tes données restent uniquement sur cet ordinateur » | **hors AF5** : mission COMPTE. Si COMPTE n'est pas fusionnée avant AF5, me le dire |

Les commentaires du code (`// Valeurs de secours = copie de la base Notion…`) ne changent pas.

### K5 — Signature des mails et SMS (AF5-B)
- Mail de devis à signer, SMS de signature, mail fournisseur : signés avec Paramètres › « Nom et prénom de l'entrepreneur », sinon le nom de l'entreprise, puis le téléphone, comme `signature()` de `next-messages.js` (question 7).
- Le mail de la **fiche fluide** (« signée par vous et par moi ») est un constat d'**AF3** (C1), pas d'AF5 : seule sa signature finale suit K5, si elle contient le nom en dur.
- **Ne pas toucher** la valeur par défaut du nom de l'entreprise (`index.html` l. 1148) : elle apparaît dans les 8 documents golden (suite Y). La changer est une régénération, donc ton accord.

### K13 — Bouton « Assistant » (AF5-B)
- Sur PC aussi (au-delà de 860 px), une marge basse sous le contenu de chaque écran, pour que le dernier bouton ne soit jamais sous « Assistant » une fois la page défilée jusqu'en bas (question 6).
- Téléphone : la marge de 110 px reste ; vérifier Objectifs (R-K13) et le corriger si la mesure se confirme.
- Correction dans la feuille de style de `next-mobile.js`, sans enveloppe.

### A11 — Montants de la carte « Facturation réelle » (AF5-B)
- Même format que le reste de l'appli : « 1 234,56 € » (formateur global `eur`).
- La variable locale `eur` de `carteParams` (`next-emission.js` l. 856) masque le formateur global : la renommer, puis appeler `eur`. Garder un repli qui journalise s'il manquait (règle 11).

## 3. Tests à écrire d'abord (rouges sur `main`)

Horloge : `REF` dans les pages, ou une horloge figée (15 h pour T4). Aucun test ne lit la vraie date ; vérifier aussi avec `faketime` un samedi, un dimanche et le 05/01 de l'année suivante (règle 9). T8 se joue un mardi, un vendredi et un samedi (la veille d'un lundi). Journal des rouges gardé.

**Nouvelle suite** : `tests/suiteAK-af5-ecrans.mjs` (proposé : première lettre libre au moment de coder ; AH et AI devraient être prises par COMPTE et AF1-B, AJ par AF2). Inscription dans `tests/run-all.sh` et `tests/isolation/rapport.mjs`. iPhone 13 et PC.

| Test | Départ | Attendu | Sur `main` |
|---|---|---|---|
| T2-1 | devis contrat seul, « Première visite » vide, accepté, `nxenSyncContracts` | contrat « 1re visite : à fixer » (pas de REF + 30 jours) | rouge (R-T2) |
| T2-2 | même devis | absent des 4 listes « à planifier » ; « 🤝 Contrat … : fixer la 1re visite » présent | rouge |
| T2-3 témoins | « Première visite » remplie ; devis contrat + pose ; contrat existant daté | date reprise ; devis à planifier ; date inchangée | vert |
| T2-4 | signature en ligne simulée (`nxsApplySig` comme la suite AD) | même résultat que T2-1 | rouge |
| T3-1 | devis particulier « signé dans les locaux », contrat créé, « Facturer » | une facture (démonstration), aucune alerte | rouge (R-T3) |
| T3-2 | contrat ancien sans conclusion, devis d'origine « locaux » | « Facturer » passe ; données du contrat inchangées | rouge |
| T3-3 témoin | devis « à préciser » | même alerte qu'aujourd'hui | vert |
| T4-1 | 15 h, pointage en cours | carte « Pointage en cours » et « ■ Terminer » ; clic → pointage terminé, heures enregistrées | rouge (R-T4) |
| T4-2 témoin | 15 h, pas de pointage | pas de carte | vert |
| T5-1 | vrais clics « ＋ Créer » › « Nouveau devis », PC et iPhone | menu fermé, choix de la nature ouvert | rouge (R-T5) |
| T5-2 témoin | « + Dépannage » | menu fermé | vert |
| T6-1 | devis jamais enregistré, « Préciser / modifier », « Locaux », enregistrer la fenêtre, puis enregistrer le devis | conclusion présente sur le devis enregistré | rouge (R-T6) |
| T6-2 | même chose avec « Exemplaire papier remis » | remise présente | rouge |
| T7-1 | facture impayée depuis 45 jours, Objectifs, « Voir les factures » | tableau de bord, bloc « Factures en retard (+30 j) » visible à l'écran, la facture y est | rouge (R-T7) |
| T7-2 | jeu avec avoir partiel | mêmes factures dans Objectifs et au tableau de bord | à mesurer |
| T8-1 | contrat avec visite demain (mardi) ; puis lundi vu un vendredi et un samedi | message « veille » seul pour ce client | rouge (R-T8) |
| T8-2 témoins | contrat à 10 jours (suite T) ; mode « matin » et « soir » | message « entretien » gardé ; « veille » proposée dans les deux modes | vert |
| K1-1 | Paramètres, Base de prix, devis (version web) | aucun « Notion » à l'écran ; textes du § 2 ; aucun prix changé | rouge (R-K1) |
| K1-2 (question 5) | `window.cowork` simulé | textes « Notion » | vert |
| K5-1 | « Nom et prénom de l'entrepreneur » = « Prénom Essai » ; mail, SMS de signature, mail fournisseur | signés « Prénom Essai » + téléphone ; aucun nom en dur | rouge |
| K13-1 | PC 1300 px, tableau de bord et Objectifs défilés en bas | rien sous « Assistant » | rouge (R-K13) |
| K13-2 | iPhone 13, 8 écrans | rien sous « Assistant » | rouge sur Objectifs si la mesure se confirme |
| A11-1 | ancienne facture de 1234,56 | « 1 234,56 € » | rouge (R-A11) |
| témoin | toute la suite | aucune erreur JavaScript, aucune clé synchronisée nouvelle | vert |

**Suites existantes** :
- **Ne doivent pas bouger** : T (messages, pointage, tournée), P (menu « Créer », retours SAV), Q (capture du menu « Créer »), J (contrats avec les particuliers), S (planning), W (aucune enveloppe nouvelle), U, V, X, AD, AE, **Y et Z** (aucun montant, aucun document ; les 5 « À TRANCHER » ne bougent pas).
- **Golden** : aucun ne change.

## 4. Découpage, ordre, risques, retour arrière, estimation

### 4.1 Deux branches (question 8)
| Branche | Points | Fichiers de l'appli | Durée (sessions) |
|---|---|---|---|
| `correctif/af5a-terrain` | T2, T3, T4, T6, T8 | `next-mod-entretien.js` (`syncContracts`), `next-addons.js` (`nxAutoTasks`, bandeau), `next-journee.js` (`collect`, carte du pointage), `next-terrain.js`, `next-particuliers.js` (`objet`, conclusion lue sur le devis), `next-messages.js`, `index.html` (`renderPlanning`), `sw.js` | tests 1 ; code 1 ; batterie, `faketime`, CI, compte rendu ½ à 1 → **2 à 2,5 jours** |
| `correctif/af5b-ecrans` | T5, T7, K1, K5, K13, A11 | `next-devis2.js`, `next-objectifs.js`, `index.html` (textes), `next-signature.js`, `next-fournisseur.js`, `next-mobile.js`, `next-emission.js` (`carteParams`), `sw.js` | **1,5 à 2 jours** |

- Ton temps : ≈ 15 min d'essai par branche, la fusion, les F5.
- `const C=` de `sw.js` : une fois par branche. `VERSION` et `NX_VERSION` : te demander.
- Une seule branche est possible (3,5 à 4,5 jours), mais elle frôle la semaine avec la relecture et ton essai.

### 4.2 Ordre
1. S, COMPTE, P11, AF1-B, AF2 fusionnées.
2. AF5-A, puis AF5-B : tests rouges (journal gardé), code, suite visée, batterie complète, CI verte, relecture par l'autre modèle, ton essai, ta fusion, F5.
3. Rien côté serveur : aucune migration, aucune fonction, aucun secret, aucune clé synchronisée nouvelle.

### 4.3 Fichiers communs avec les autres missions (conflits probables)
| Mission | Fichiers communs | Risque |
|---|---|---|
| S (échappement, politique de sécurité du navigateur, bibliothèques embarquées) | gabarits HTML de `next-addons.js`, `next-journee.js`, `next-terrain.js`, `next-messages.js`, `next-objectifs.js`, `next-particuliers.js`, `index.html`. T5 repère « Nouveau devis » par le **texte de son `onclick`** (`RX_NEW`, `next-devis2.js` l. 837) : si S remplace les `onclick` en ligne, T5 suit sa façon de faire | **élevé** (hypothèse : dossier de S non lu ici) |
| COMPTE | `index.html`, carte du code d'accès (K1, l. 814) | **certain** pour la phrase du code d'accès : elle est à COMPTE |
| P11 | `index.html` (Paramètres), `next-assistant.js` (même fichier que le bouton « Assistant », pas la même partie) | faible |
| AF1-B | `next-emission.js` (A11 : `carteParams` ; AF1-B : `mode`, `badge`, `finir`) | faible |
| AF2 | `next-addons.js` (`nxAutoTasks` : M1, M2 / T2), `next-journee.js` (M2 / T2, T4), `next-particuliers.js` (M4 / T3, T6), `next-emission.js` (M4 / A11), `index.html` (tableau de bord) | **moyen** : jamais en même temps, AF5 après AF2 |

### 4.4 Risques et garde-fous
| Risque | Garde-fou | Certitude |
|---|---|---|
| Un contrat « 1re visite à fixer » oublié | rappel dans les 4 listes « à planifier » (T2-2) | probable |
| Un écran qui lit `prochaineVisite` vide plante | lecture du code (compteur, planning, messages, « À faire » l'ignorent déjà) ; T2-1 sans erreur JavaScript | probable, à prouver |
| La conclusion d'un devis appliquée à tort à un contrat | seulement pour un contrat issu de ce devis (`devisId`) ; T3-3 | probable |
| Le menu se referme alors qu'un autre bouton l'attendait ouvert | tous les boutons le ferment déjà, sauf « Nouveau devis » (R-T5) | certain |
| Un texte « Notion » oublié | K1-1 cherche « Notion » dans le texte visible des écrans | certain (test) |
| K5 change un document golden | seuls les mails et SMS changent ; la valeur par défaut du nom reste | certain (lu) |

### 4.5 Retour arrière
- Revert du commit « code » : tout redevient comme sur `main` ; les tests d'AF5 redeviennent rouges.
- **Données** : T2 crée des contrats sans `prochaineVisite`. Après un revert, ils restent sans date **et sans rappel** : avant de revenir en arrière, fixer leur date (la liste « à fixer » les montre). T3 n'écrit rien (lecture). Aucun autre champ nouveau.
- Rien côté serveur.

### 4.6 L'essai que tu feras (esquisse ; le compte rendu détaillera)
Sur la copie d'essai, téléphone et PC, ≈ 15 min par branche.
1. AF5-A : accepte un devis d'entretien sans date de 1re visite. Attendu : « 🤝 Contrat … : fixer la 1re visite », et plus de « Planifier le chantier » pour ce devis.
2. Facture ce contrat (particulier « signé dans les locaux »). Attendu : pas d'alerte « à préciser ».
3. Après 14 h, commence un pointage, puis ouvre Ma journée. Attendu : « ■ Terminer » en tête.
4. AF5-B : « ＋ Créer » › « Nouveau devis », ferme le choix de nature. Attendu : le menu est fermé.
5. Paramètres : plus aucun « Notion ». Envoie-toi un lien de signature : le mail est signé avec ton nom des Paramètres.

## 5. Ce qu'AF5 ne fait pas
- Pas de vue « Relances factures », pas de suivi des relances (idée gelée n° 11).
- Pas de compte rendu de visite d'entretien (idée gelée n° 2).
- Pas de changement du nom de l'entreprise par défaut (golden Y).
- Rien sur la fiche fluide (AF3) ni sur les mentions des factures (AF4).

## 6. Tes questions (oui / non)

1. **T2 : sans « Première visite prévue » sur le devis, contrat créé « 1re visite : à fixer »** (aucune date inventée), avec un rappel dans « à planifier » ?
   - Recommandé : **oui**.
   - Si non : « + 30 jours » gardé, affiché « date à confirmer ».
2. **T3 : les contrats déjà créés lisent le mode de conclusion de leur devis d'origine**, sans réécrire les données ?
   - Recommandé : **oui**.
3. **T7 : « Voir les factures » ouvre le tableau de bord sur « Factures en retard (+30 j) »** (la vue « Relances » ne montre que les devis) ?
   - Recommandé : **oui**. Si non : « À faire », filtré sur les paiements.
4. **T8 : messages « veille » toujours proposés matin et soir** (comportement d'aujourd'hui) ?
   - Recommandé : **oui**.
5. **K1 : les textes suivent le mode** (« prix embarqués » en version web, « Notion » dans Cowork), comme l'étiquette du haut ?
   - Recommandé : **oui**. Si non : « prix embarqués » partout.
6. **K13 : marge basse aussi sur PC** ?
   - Recommandé : **oui**.
7. **K5 : signature = « Nom et prénom de l'entrepreneur » des Paramètres** (sinon nom de l'entreprise) + téléphone, pour les mails et SMS de signature et le mail fournisseur ?
   - Recommandé : **oui**.
8. **Deux branches** : AF5-A (terrain), puis AF5-B (écrans et textes) ?
   - Recommandé : **oui**.

## 7. Ce qui n'a pas été vérifié
- Le dossier de la mission S (hors dépôt) : les conflits du § 4.3 sont déduits de son sujet.
- Aucun iPhone réel ; la mesure de K13 sur Objectifs (téléphone) est à confirmer.
- Le mode Cowork (`window.cowork`) n'a pas été lancé.
- Le texte exact des messages proposés pourra être ajusté à la relecture, sans en changer le sens.
