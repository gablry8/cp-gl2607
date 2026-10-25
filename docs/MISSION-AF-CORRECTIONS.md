# ClimPilot — Missions AF : corriger ce que l'analyse fonctionnelle a trouvé — dossier (aucun code)

> Rédigé le 25/10/2026 (soir) par Claude (Opus 5.5) pour Gabriel Leroy. **Aucun code ici** : ce qui doit changer, comment le prouver **avant** de le changer, et ce que ça change pour toi.
> Sources : l'analyse fonctionnelle du 25/10 (Opus, banc deux appareils, rangée dans le Project : `claude/ClimPilot-ANALYSE-FONCTIONNELLE-25-10.md`) ; la **localisation dans le code de la 1.13** (`release/1.13.0`, commit `4f6de31`) faite le 25/10 au soir par deux inventaires en lecture seule, recoupés par moi ; et **un défaut nouveau, reproduit** ce soir (D6).
> Les identifiants (D0, M1, C4, T2…) sont ceux de l'analyse. Certitude : **certain** (lu dans le code ou reproduit) · **probable** · **hypothèse**.
> Les failles de **sécurité** ne sont pas ici : elles sont dans la mission S (dossier privé, hors dépôt public).

## 0. Ce que tu décides (10 lignes)

1. **Devis signé ou accepté (D0)** : il devient **non modifiable** ; pour changer quelque chose, « Faire un avenant » (nouveau devis lié) ou « Dupliquer ». Un devis accepté **sans** signature en ligne (accord papier) : verrouillé aussi ? *Mon avis : oui.*
2. **Fiche fluide (D2, D6)** : une fiche numérotée ne se supprime plus avant 5 ans ; une erreur se corrige en la marquant « annulée » (motif), elle reste au registre. Une fiche **signée** ne se modifie plus. *Mon avis : oui aux deux.*
3. **Paramètres (D3)** : garde de sortie « Enregistrer / Abandonner » (*mon avis*) ou enregistrement automatique.
4. **« À commander » (M1)** : un chantier sort de la liste dès que sa **facture de solde** est émise (en plus des cases « commandé » qui existent). OK ?
5. **Bouton « Payée » (M4)** : il demande la **date d'encaissement** (aujourd'hui par défaut, modifiable) et le mode dans une liste. La date à retenir pour un chèque : la réponse de ta comptable (question 5 du mail préparé).
6. **Tableau de bord (M6)** : le mot « CA » disparaît du bloc actuel, remplacé par « Signé », « Facturé », « Encaissé » côte à côte, avec les mêmes définitions qu'Objectifs et le livre des recettes.
7. **Fiche fluide (AF3)** : trois options (§ 8) — A : ClimPilot reproduit fidèlement le Cerfa 15497\*04 avec ta signature d'opérateur ; **B : utiliser l'appli officielle gratuite du ministère** (lancée le 22/04/2026, signature horodatée) et garder le numéro dans ClimPilot ; C : rien. *Mon avis : essaie B sur une vraie intervention avant de décider.*
8. **Mentions des factures (AF4)** : attendent les réponses de ta comptable (mail préparé, questions 1 à 4) ; C6 et C7 peuvent partir sans attendre.
9. **Ordre** (§ 1) : AF1 d'abord (pertes de données), puis S (sécurité), puis AF2, AF5, et AF3/AF4 quand les réponses sont là.
10. Rien de tout ça ne change un montant d'un devis existant (golden calculs identiques).

## 1. Découpage, ordre, qui fait quoi

| Mission | Contenu | Prérequis | Modèle · réflexion | Relecture |
|---|---|---|---|---|
| **AF1 — Zéro perte de données** | D0, D2, D3, D5, **D6**, suppression d'un devis signé | 1.13.0 fusionnée ; C3 fusionnée (mêmes écrans de devis) ; tes décisions 1-3 | Fable 5.1 · élevée | Opus 5.5 (P10) |
| **AF2 — Montants et compta** | M1, M2, M3, M4, M6 | AF1 et S fusionnées ; décisions 4-6 ; réponse comptable n° 5 pour M4 | Opus 5.5 · élevée | Fable 5.1 |
| **AF3 — Fiche fluide conforme** | C1, C2, C3, T12 | AF1 fusionnée (D5, D6 touchent la même fiche) ; décision 7 | Fable 5.1 · élevée | Opus 5.5 |
| **AF4 — Mentions des factures et devis** | C4, C5, C6, C7, C8 | réponses de ta comptable (sauf C6, C7) ; régénération des golden documents **avec ton accord** | Opus 5.5 · élevée | Fable 5.1 |
| **AF5 — Écrans qui font perdre du temps** | T2, T3, T4, T5, T6, T7, T8, K1, K5, K13, A11 | aucun conflit avec AF1-AF4 si lancée seule | Sonnet 5.5 · moyenne | Opus 5.5 · moyenne |
| ailleurs | **D1** (conflit entre appareils) et **D4** (n° de fiche fluide en double) → **P3** (données, tes décisions R1 et R2 du TOPO) ; **T18** (ouverture lente en cave) → **P4** (service worker) ; M5, M7, M8, T1, T9-T11, T13-T17, K2-K12 → `docs/APRES-PRO-V1.md` ou petites tâches de P4 | — | — | — |

Règles communes (celles du TOPO) : une branche par mission depuis `main`, tests d'abord (rouges sur l'ancien code, prouvés), golden calculs (Z) et documents (Y) **identiques** sauf régénération écrite et validée par toi, batterie complète verte, CI verte, compte rendu avec 10 lignes de décision en tête, **jamais deux missions qui touchent le code de l'appli en même temps**.

---

## 2. AF1 — Zéro perte de données

### D0 — Un devis signé (ou facturé) se modifie sans rien dire
- **Constat (certain)** : rouvrir puis enregistrer un devis signé ou facturé passe par `saveV2` (`next-devis2.js` l. 377-401) ou `saveDevis` (`index.html` l. 1706-1715, enveloppé l. 430-434 de `next-devis2.js`) **sans contrôle**. `protect()` (`next-devis2.js` l. 232-258) remet la signature, les factures et le montant figé (`OWNED` l. 231) et empêche le statut de reculer, **puis le contenu modifié remplace le devis**. Seul verrou existant : le numéro (`numLocked`, l. 213). À l'impression, le bloc « accepté — signé électroniquement » avec l'empreinte est ajouté dès qu'une signature existe (`next-signature.js` l. 219-240), sans comparer le contenu à la copie signée (qui, elle, est au serveur : `doc_html`, l. 44-51). Garde-fous qui existent : montant figé contrôlé à la 1re facturation (`next-fiabilite.js` l. 190-207), suppression refusée s'il y a une facture (l. 74-81, 215), verrou de contenu pour les **interventions** seulement (l. 124-183).
- **Et la suppression** : un devis signé mais pas encore facturé part à la corbeille en un clic (`guardDel` ne regarde que les factures).
- **Comportement cible** (décision 1) : un devis **signé**, **accepté** ou **facturé** s'ouvre en lecture seule, avec un bandeau « Devis signé le … : il ne se modifie plus » et deux boutons : **Faire un avenant** (nouveau devis, numéro suivant, lien `avenantDe` vers l'original, l'original intact) et **Dupliquer**. Toute tentative d'enregistrement d'un devis verrouillé (par une couche, un raccourci, l'assistant) est refusée et notée au journal. Suppression d'un devis signé ou accepté : refusée (comme un devis facturé).
- **Tests d'abord** : AF1-T1 devis signé (signature simulée) → ouvrir, changer une ligne, enregistrer → **contenu inchangé au centime**, message (aujourd'hui : modifié) ; AF1-T2 idem devis avec acompte facturé ; AF1-T3 « Faire un avenant » → nouveau devis lié, original identique ; AF1-T4 devis accepté sans signature (selon décision 1) ; AF1-T5 suppression d'un devis signé refusée ; golden Y/Z identiques.

### D2 — Une fiche fluide signée part à la corbeille en un clic
- **Constat (certain)** : `nxSoftDelete('flu')` (`next-addons.js` l. 459-469) remplace la suppression d'origine (`index.html` l. 3374-3376, qui rappelait « conservation obligatoire 5 ans ») : une confirmation, corbeille 30 jours, puis effacement définitif (`nxCleanTrash`). Aucun regard sur la signature. `guardDel` ne couvre ni les fiches fluides, ni les clients, ni le parc.
- **Règle (certain, notice officielle du Cerfa ; § 8)** : la fiche d'intervention se conserve **au moins 5 ans** par l'opérateur et par le détenteur, à compter de sa signature (code de l'environnement, R.543-82).
- **Comportement cible** (décision 2) : une fiche **numérotée** ne se supprime plus avant 5 ans à compter de sa date ; bouton « Annuler la fiche » (motif obligatoire) : elle reste au registre, imprimable avec la mention ANNULÉE. Une fiche jamais enregistrée (brouillon sans numéro) reste supprimable.
- **Tests** : AF1-T6 fiche signée → suppression refusée ; AF1-T7 fiche numérotée non signée → « annulée », toujours au registre et dans le bilan annuel avec la mention ; AF1-T8 la corbeille ne reçoit jamais une fiche numérotée de moins de 5 ans.

### D3 — Paramètres : quitter l'écran sans cliquer « Enregistrer » perd tout, sans message
- **Constat (certain)** : `saveParams` (`index.html` l. 1905-1928) ne lit les champs qu'au clic ; changer d'écran (`go`) ne fait rien et la page est reconstruite depuis les valeurs enregistrées. Aucune garde de sortie, aucun enregistrement automatique (seul `pagehide` vide le cache de stockage, `next-store.js` l. 286). Page de ≈ 19 écrans sur téléphone (analyse).
- **Comportement cible** (décision 3) : garde de sortie : dès qu'un champ a changé, quitter l'écran (menu, retour, fermeture de l'onglet) demande « Enregistrer / Abandonner » ; bouton « Enregistrer » collant en bas de l'écran sur téléphone.
- **Tests** : AF1-T9 modifier le taux horaire, aller au tableau de bord → la question s'affiche ; « Enregistrer » → valeur gardée après rechargement ; « Abandonner » → ancienne valeur ; même chose sur téléphone ; aucun recalcul d'un devis existant (golden Z identiques).

### D5 — Fiche fluide faite avant d'enregistrer l'intervention : « Adresse : — »
- **Constat (certain)** : l'adresse du détenteur n'est **pas stockée** sur la fiche ; à l'impression, `printFicheFlu` (`next-cerfa.js` l. 167-206) cherche le client **par son nom** dans la liste des clients (l. 169) et écrit « — » s'il n'existe pas encore (il n'est créé qu'à l'enregistrement de l'intervention ou du devis : `upsertClient`, `index.html` l. 1703, 2174-2178). Même rendu envoyé pour signature (`next-signature.js` l. 125-136). `upsertClient` n'écrit pas le code postal que le PDF lit (l. 184).
- **Comportement cible** : à sa création, la fiche **garde une copie** des coordonnées du détenteur (nom, adresse, code postal, ville, SIRET) prise dans l'intervention ou le devis ouvert, puis dans la fiche client ; ces champs sont visibles et modifiables dans la fiche ; le PDF les utilise. Envoi du lien de signature **refusé** si l'adresse est vide (« Adresse du détenteur manquante »).
- **Tests** : AF1-T10 fiche créée depuis une intervention pas encore enregistrée, client nouveau → PDF avec l'adresse de l'intervention ; AF1-T11 adresse vide → envoi refusé avec le message.

### D6 — NOUVEAU (reproduit le 25/10) : une fiche fluide signée perd la signature du détenteur dès qu'on la rouvre et qu'on l'enregistre
- **Constat (certain, reproduit)** : `saveFlu` (`index.html` l. 3360-3369) reconstruit la fiche **à partir du formulaire** et remplace l'objet (`FLU[i]=o`) ; les deux couches qui l'enveloppent (`next-cerfa.js` l. 115-132, `next-flu-guide.js` l. 219-233) ne remettent que leurs propres champs. La signature du détenteur (`sigDetenteur`, posée par `next-signature.js` l. 155) et un éventuel refus (`refusDetenteur`) sont **perdus**. Reproduction (banc local, données fictives) : fiche signée → ouvrir → enregistrer sans rien changer → signature présente avant : **oui** ; après, en mémoire : **non** ; dans le stockage : **non**. La perte part ensuite au serveur à la synchro, donc sur tous les appareils. La preuve reste dans la table des signatures du serveur, mais la fiche et son PDF ne montrent plus qu'elle est signée.
- **Comportement cible** : `saveFlu` **complète** l'ancienne fiche au lieu de la remplacer (tout champ qu'il ne gère pas est gardé : signature, refus, lien de signature, repère…) ; et, avec la décision 2, une fiche signée s'ouvre en lecture seule (modifier = nouvelle fiche).
- **Test** : AF1-T12 = la reproduction ci-dessus, en contrôle bloquant (rouge aujourd'hui) ; AF1-T13 même chose en mode guidé.
- **Ce que tu fais en attendant** : ne rouvre pas une fiche fluide signée pour l'enregistrer (consulte-la, imprime-la, mais ne clique pas « Enregistrer »).

---

## 3. AF2 — Montants et compta

### M1 — Le matériel d'un chantier déjà posé et soldé reste « à commander »
- **Constat (certain)** : « chantier signé » = devis au statut `accepte` (`next-commande.js` l. 17), sans regarder la facture de solde, le paiement, les heures pointées ni la date ; il n'y a pas de statut après « accepté ». Seules les cases « commandé » (par **article**) ou le stock retirent une ligne ; la case « réservé » (par chantier) ne retire rien. Même filtre dans `renderCommander` (`index.html` l. 1744), la demande de prix (l. 3632) et la tâche automatique (`next-addons.js` l. 246-250).
- **Comportement cible** (décision 4) : un chantier dont la **facture de solde est émise** sort de « reste à commander », du bon de commande PDF, de la demande de prix et de la tâche automatique ; une case « matériel reçu » par chantier fait la même chose avant le solde.
- **Tests** : chantier soldé absent des quatre sorties ; chantier non soldé présent ; case « reçu » ; aucun montant de devis ne change.

### M2 — Une intervention faite mais non facturée n'est rappelée nulle part
- **Constat (certain)** : après un refus (hors ligne), l'intervention reste en brouillon sans numéro ; aucun écran (Ma journée, centre d'actions, badge, tableau de bord) ne lit les interventions passées non facturées (`next-journee.js` l. 33-55 ne regarde que celles du jour ; `next-addons.js` l. 235-252).
- **Comportement cible** : « N intervention(s) faite(s) non facturée(s) » dans Ma journée et le centre d'actions (date passée, pas de numéro de facture), avec un bouton qui ouvre la liste.
- **Tests** : intervention d'hier en brouillon → rappel visible le lendemain ; facturée → plus de rappel.

### M3 — Déclaration Urssaf : le tableau de bord annonce le trimestre suivant pendant le mois d'échéance
- **Constat (certain)** : `urssafNext` (`index.html` l. 3110-3111) choisit le trimestre d'après le **mois civil** : en avril il annonce « T2 avant le 31/07 » alors que le T1 est dû le 30/04 ; en janvier il annonce le T1 au lieu du T4 de l'année d'avant. Il ignore la périodicité choisie (mensuelle/trimestrielle) et la case « déclaré » d'Objectifs. Objectifs, lui, calcule juste (`next-objectifs.js` l. 393-438) ; la batterie teste Objectifs (suite O), pas ce bloc.
- **Comportement cible** : le bloc du tableau de bord **lit la même source qu'Objectifs** : la plus ancienne période non déclarée, avec son échéance (en retard en rouge), puis la suivante une fois cochée. **Aucune règle nouvelle** : les échéances sont celles déjà codées et testées dans Objectifs.
- **Tests** : horloge au 15/04 (T1 à déclarer avant le 30/04), au 02/05 (T1 en retard si non coché, sinon T2), au 10/01 (T4 de l'année précédente), mode mensuel.

### M4 — « Payée » met la date du clic dans le livre des recettes
- **Constat (certain)** : `payerFacture` (`index.html` l. 2930-2952) et `payDep` (l. 2188-2191) écrivent la date du jour ; `askMode` (l. 2902) demande le mode de règlement en texte libre, jamais la date. Seul l'import de relevé bancaire (`next-banque.js` l. 272-286) met la date du crédit. Un chèque reçu le 29/09 marqué le 02/10 passe au trimestre suivant.
- **Comportement cible** (décision 5) : « Payée » ouvre une petite fenêtre : **date d'encaissement** (aujourd'hui par défaut, modifiable, jamais dans le futur) et **mode** dans une liste (Virement, Chèque, Espèces, Carte, Autre…). Le livre des recettes, la déclaration et Objectifs utilisent cette date.
- **Tests** : paiement daté du trimestre précédent → livre et déclaration de ce trimestre ; date future refusée ; relevé bancaire inchangé (suite P).

### M6 — Trois (en fait quatre) chiffres appelés « CA »
- **Constat (certain)** : tableau de bord : « CA {année} HT » = devis **acceptés** + interventions + locations (`index.html` l. 1294-1372, objectif par défaut l. 1318) et « net après cotisations » calculé dessus ; Objectifs : **facturé** HT (`next-objectifs.js` l. 178-209, `next-regime.js` l. 436-472) ; livre des recettes : **encaissé** (`index.html` l. 3082-3132) ; seuils de franchise : `nxCaAnnee` (`next-taux.js` l. 130-138). En plus : le livre mélange le TTC des factures de devis et le HT des interventions, locations et contrats, alors que l'export s'intitule « Montant HT » — **identique tant que tu es en franchise**, faux une fois assujetti.
- **Comportement cible** (décision 6) : le bloc du tableau de bord affiche « **Signé** », « **Facturé** », « **Encaissé** » côte à côte, mêmes définitions qu'Objectifs et le livre ; le « net » est calculé sur l'encaissé (les cotisations d'un micro-entrepreneur se calculent sur le chiffre d'affaires encaissé : *probable, à confirmer sur autoentrepreneur.urssaf.fr*). L'en-tête de l'export devient exact (« Montant encaissé » + colonnes HT/TVA quand assujetti) — à valider avec ta comptable avant ta première facture assujettie.
- **Tests** : trois chiffres attendus sur un jeu fixe (1 devis accepté non facturé, 1 facturé non payé, 1 payé) ; export en franchise identique à aujourd'hui.

---

## 4. AF3 — Fiche fluide conforme au Cerfa 15497\*04 (C1, C2, C3, T12)

> Le cadre réglementaire et la question « électronique / équivalent » sont détaillés au § 8 (recherche du 25/10). Cette mission attend ta décision 7 : si tu choisis l'option B (appli officielle du ministère), AF3 se réduit aux données de la fiche (C2 et les champs de D5) et au numéro de la fiche officielle ; C1 et C3 ne sont alors pas à faire.

### C1 — Signature de l'opérateur absente
- **Constat (certain)** : cellule opérateur = libellé « Signature de l'opérateur (nom, date) » + nom de l'entreprise, dans une case vide (`next-cerfa.js` l. 199-201) : ni nom et qualité du signataire, ni date, ni signature, ni phrase de certification. Côté détenteur : nom + « signé électroniquement le … » (+ image) si signé en ligne (l. 179). Le mail envoyé au client dit « signée par vous et par moi » (`next-signature.js` l. 38) : faux aujourd'hui.
- **Cible** : bloc opérateur complet (nom, qualité, n° d'attestation de capacité de l'entreprise, date, signature apposée quand tu **valides** la fiche — image dessinée une fois dans Paramètres —, et la phrase de certification du formulaire) ; le mail ne promet que ce qui est vrai.

### C2 — Contenant demandé seulement en récupération
- **Constat (certain)** : le n° de bouteille n'apparaît que si du fluide est récupéré (`next-flu-guide.js` l. 94, contrôle l. 174) ; le PDF l'intitule « Contenant(s) de récupération » (`next-cerfa.js` l. 194) ; aucun champ pour le contenant de **charge** ; le préremplissage depuis ton matériel ne fait rien (l. 104).
- **Cible** : « Identification du ou des contenants » pour toute manipulation (charge et récupération), proposée depuis ton matériel.

### C3 — Cadres 7 à 13 simplifiés
- **Constat (certain)** : cadres 7-8-9 en une ligne (`next-cerfa.js` l. 190), cadre 10 une seule fuite (l. 191), cadre 12 et 13 en texte libre (l. 195-196), « dénomination du fluide chargé si changement » absente (aucun champ).
- **Cible** : chaque cadre comme sur le formulaire : tranches et tableau de périodicité, jusqu'à 3 fuites (localisation, réalisée / à faire), cases des codes UN et déchets, installation de destination (nom, SIRET, adresse), fluide chargé si changement. Deux façons de faire, à choisir par l'exécutant **avec preuve** : redessiner le formulaire en HTML, ou **remplir le PDF officiel** du Cerfa (formulaire public) — la seconde garantit la fidélité.

### T12 — Détecteur introuvable depuis la fiche
- **Constat (certain)** : la liste des détecteurs n'est remplie que depuis « Fluides & Cerfa › Mon matériel fluides » (`next-cerfa.js` l. 74-78, 209-237) ; le mode guidé dit « contrôle sans détecteur indiqué » sans dire où le régler (`next-flu-guide.js` l. 168).
- **Cible** : « + Ajouter un détecteur » depuis la fiche, et un lien vers le réglage dans le message.

**Tests AF3** : un golden « fiche fluide » (aujourd'hui il n'y en a **aucun**) créé **avant** la mission sur le rendu actuel, puis le nouveau rendu comparé cadre par cadre à une liste de contrôle tirée du formulaire officiel ; signature opérateur présente et datée ; contenants pour une charge ; trois fuites ; suite C et mode guidé verts.

---

## 5. AF4 — Mentions des factures et devis

### C4 — Deux mentions de franchise sur le même document (2027)
- **Constat (certain)** : la règle par date existe (`next-einvoice.js` l. 23 et 42 : à partir du 01/01/2027 « art. L. 233-3 du CIBS ») mais les documents HTML ne l'appellent pas : trois remplacements par expression régulière ne reconnaissent que la **forme longue** « art. 293 B du CGI » (`next-einvoice.js` l. 220-223, `next-emission.js` l. 172). La **forme courte** « (293 B) » reste : devis v2 (`next-devis2.js` l. 935), devis du cœur (`index.html` l. 2355, 2430), récapitulatif location (l. 2770), mail à la comptable (`next-regime.js` l. 582), synthèse comptable (l. 555). Les écrans récapitulatifs ne sont jamais traités ; le devis prend la date de l'horloge à l'impression, pas sa propre date. `nxFranchiseMention` (l. 43) existe mais **personne ne l'appelle**.
- **Cible** : **une seule fonction**, appelée par chaque gabarit avec la date du document. Le **texte** à imprimer en 2027 est la réponse de ta comptable (question 2) : la mission ne choisit pas la règle.
- **Golden** : `devis-v2`, factures et XML concernés seront régénérés **avec ton accord**, montants inchangés.

### C5 — Acompte hors établissement : deux conditions de règlement contradictoires
- **Constat (certain)** : `printFactureDevis` écrit « paiement à réception » (`index.html` l. 3043) ; pour un particulier hors établissement, l'émission **ajoute** ensuite le bloc « exigible à partir du … (L221-10) » (`next-emission.js` l. 489) sans retirer la première phrase. Le XML, lui, est cohérent (`next-einvoice.js` l. 188).
- **Cible** : une seule condition sur le document, celle qui s'applique (formulation : réponse comptable, question 4). Golden `facture-acompte` régénéré avec ton accord.

### C6 — « Pas d'escompte » absent des factures de contrat et de location
- **Constat (certain)** : présent dans les factures d'intervention et de devis (`index.html` l. 2307, 3044) et dans le XML ; absent de `printFactureCtr` (l. 3282) **et** de `printFactureLoc` (l. 3076). Les conditions d'escompte font partie des mentions de facture (service-public.fr, fiche F31808 : *probable*, vérification de la page par l'exécutant avant d'écrire).
- **Cible** : même phrase que les autres factures. **Peut partir sans attendre la comptable.**

### C7 — Facture pro sans SIREN après le 01/09/2027, sans alerte
- **Constat (certain)** : le contrôle « SIREN du client professionnel » existe (`next-einvoice.js` l. 121) mais ne s'exécute qu'au téléchargement du XML et à l'envoi Super PDP (`next-superpdp.js` l. 116-118) ; ni l'émission ni l'impression ne le regardent. La carte « Documents » garde au futur « À partir du 1er septembre 2027… » (l. 232) quelle que soit la date.
- **Cible** : à l'émission d'une facture à un professionnel, alerte claire si le SIREN manque (à partir de la date d'obligation : à vérifier par l'exécutant sur une source officielle, impots.gouv / economie.gouv) ; textes de la carte selon la date. **Peut partir sans attendre la comptable.**

### C8 — Facture de solde en une ligne « selon devis »
- **Constat (certain)** : `printFactureDevis` (`index.html` l. 3015-3050) : une ligne « Travaux réalisés selon devis n° … » puis l'acompte déduit ; le détail du devis n'est pas repris.
- **Cible** : réponse de ta comptable (question 3). Si le détail est exigé : reprendre les lignes du devis (désignation, quantité, prix unitaire) et la date de réalisation ; golden `facture-solde-*` régénérés avec ton accord.

---

## 6. AF5 — Écrans qui font perdre du temps (petits correctifs, tests d'abord)

| # | Constat (certain) | Cible |
|---|---|---|
| T2 | Le contrat créé à l'acceptation d'un devis d'entretien prend comme 1re visite la date « première » du devis, sinon **aujourd'hui + 30 jours** (`next-mod-entretien.js` l. 206-212) ; le devis du contrat reste « à planifier » et « Urgent » (`next-addons.js` l. 238) | à l'acceptation, la date de 1re visite est demandée (ou reprise de la date prévue) ; un devis de contrat ne figure plus dans « à planifier » : ce sont ses visites qui sont au planning |
| T3 | Le contrat créé depuis le devis ne recopie pas le **mode de conclusion** (`next-mod-entretien.js` l. 208-211) : « Facturer » le contrat bloque (`next-particuliers.js` l. 59-74) | mode et date de conclusion recopiés du devis ; à défaut, lus sur le devis d'origine |
| T4 | Après 14 h, « Ma journée » passe en mode soir et la carte Tournée disparaît, avec le bouton « Terminer » (`next-journee.js` l. 73, `next-terrain.js` l. 121) | un pointage en cours garde toujours sa carte « Terminer », quel que soit le mode |
| T5 | Le menu « ＋ Créer » reste ouvert après « Nouveau devis » : le clic est intercepté plus tôt (`next-devis2.js` l. 798-812) et n'atteint pas la fermeture (`next-addons.js` l. 783) | le menu se ferme pour tous ses boutons |
| T6 | « Préciser / modifier » le contrat d'un devis jamais enregistré → « Document introuvable » : la recherche ne regarde que les devis enregistrés (`next-particuliers.js` l. 42-50, 88-112) | repli sur le devis ouvert, comme pour les interventions |
| T7 | Objectifs › « Relancer N factures » ouvre le livre des recettes (`next-objectifs.js` l. 531) | ouvre la vue « Relances » (elle existe) |
| T8 | La veille d'une visite : « je vous confirme mon passage » **et** « votre visite approche… vos disponibilités ? » au même client (`next-messages.js` l. 68-85, pas de dédoublonnage) ; `if(mode==='soir'||true)` (l. 121) toujours vrai | une visite planifiée supprime le message « visite approche » ; condition corrigée |
| K1 | Paramètres parle de « Notion en direct », « base Notion = 75 €/h », « Revenir aux valeurs Notion » (`index.html` l. 781-824) alors que l'appli utilise des prix embarqués ; bloc code d'accès : « tes données restent uniquement sur cet ordinateur » (l. 813), faux (synchro) | textes exacts : « Prix embarqués (07/2026) », « Revenir aux prix embarqués », « tes données sont sur tes appareils et synchronisées sur ton espace en ligne » |
| K5 | Mails et SMS de signature signés « Gabriel Leroy » en dur (`next-signature.js` l. 36-41) | signature tirée de Paramètres › Entreprise, comme `next-messages.js` l. 28 |
| K13 | Le bouton flottant « Assistant » recouvre le bas du contenu sur téléphone (TOPO A14) | marge basse réservée sous le contenu de chaque écran |
| A11 (TOPO) | `next-emission.js` l. 850 appelle `money()`, qui n'est pas défini pour ce fichier : l'erreur est avalée et la carte Paramètres › « Facturation réelle » affiche les montants au format `1234.56 €` | même formatage que le reste de l'appli : le formateur global `eur` (`index.html` l. 1031, `1 234,56 €`). Attention : la variable locale de la l. 850 s'appelle aussi `eur` et masque le global, la renommer. Test : la carte affiche `1 234,56 €` pour 1234.56 |

---

## 7. Effets sur les tests (à lire par chaque exécutant)
- `suiteU-fusion` compare une **empreinte du texte** de `cpMergeArr`/`cpMerge` (`tests/golden/fusion-empreinte.txt`) : toute retouche (P3) la fait échouer, à régénérer volontairement.
- `suiteV-numerotation` V3 passe **tant que** le doublon de n° de fiche fluide existe (« échec attendu, connu ») : à inverser avec D4 (P3).
- `suiteW-enveloppes` compte les enveloppes de fonctions (`tests/golden/enveloppes.json`) : une enveloppe nouvelle est détectée ; préférer corriger dans la fonction d'origine.
- `suiteY`/`suiteZ` : C4, C5, C8 changent des documents → régénération **écrite et validée par toi** ; D0, M1-M4, M6 ne doivent rien y changer.
- Aucune suite n'appelle `printFicheFlu` : AF3 commence par créer un golden de la fiche fluide.

## 8. Fiche d'intervention : ce que disent les textes (recherche du 25/10)
Recherche faite le 25/10/2026 sur sources officielles (notice du Cerfa, arrêtés publiés, FAQ du ministère et de Trackdéchets, EUR-Lex). Légifrance était **inaccessible** à l'outil : les articles du code de l'environnement ont été lus dans des copies (marquées « probable »), à relire sur Légifrance avant tout usage juridique. **Rien n'est tranché ici.**

| Question | Ce que disent les textes | Niveau |
|---|---|---|
| Version en vigueur | **Cerfa 15497\*04** (arrêté du 29/05/2024, JO du 05/07/2024), notice 52064\*04 | certain |
| Formulaire obligatoire ? | Arrêté du 29/02/2016, art. 11 : pour les activités de catégorie I à IV, « l'opérateur est tenu d'utiliser le formulaire CERFA n° 15497 » comme fiche d'intervention | certain |
| Forme électronique ? | Notice : « Elle peut être établie sous forme électronique (article R.543-83) » ; R.543-83 : « Les documents, fiches et registres […] peuvent être établis sous forme électronique » | certain (notice) / probable (article) |
| Une fiche faite par **ton logiciel**, même contenu, vaut-elle « le formulaire Cerfa » ? | **aucune source officielle trouvée** ne le dit, dans un sens ou dans l'autre | non trouvé |
| Qui signe | Au-delà de 3 kg de HCFC ou de **5 t éq. CO₂** de HFC/PFC : « signée conjointement par l'opérateur et par le détenteur de l'équipement qui conserve l'original » (R.543-82) ; en dessous, la notice : à remplir par l'opérateur, « pas à signer par le détenteur ». Les cadres 1 à 4 et le cartouche de signature « doivent être systématiquement remplis » | certain (notice) / probable (article) |
| Signature électronique | aucun texte propre à la fiche ; principe général : une signature électronique ne peut pas être écartée au seul motif qu'elle est électronique (règlement eIDAS, art. 25) | probable |
| Conservation | **5 ans au moins**, par l'opérateur **et** par le détenteur, à compter de la signature (R.543-82, notice, FAQ du ministère) | certain |
| Trackdéchets | BSFF (bordereau des déchets de fluides) **obligatoire depuis le 01/01/2023** ; il reprend les **numéros** des fiches d'intervention mais **ne remplace pas** la fiche (« La Fiche d'Intervention n'est pas dématérialisée sur Trackdéchets ») ; API publique documentée (création d'une fiche d'intervention pour la joindre à un BSFF) | certain |
| **Appli officielle** | le ministère a lancé le **22/04/2026** une application gratuite « Fluides Frigorigènes » : fiche d'intervention dématérialisée, signature électronique avec horodatage, lien de signature pour le détenteur absent, rappel des 5 ans ; **usage facultatif** (« n'a pas de caractère obligatoire ») ; **aucune connexion automatique** avec les logiciels de gestion (au 22/04/2026) ; connexion à Trackdéchets annoncée | probable (questions-réponses officielles du lancement) |
| 2027 | nouvelles catégories d'attestation de capacité (A1, A2, B, C, D, E, V) **obligatoires au 01/01/2027** (arrêtés du 21/11/2025), l'arrêté de 2008 étant abrogé au 31/12/2026 — or l'art. 11 renvoie encore aux catégories I à IV de 2008 ; un **projet de décret du 12/06/2026** réécrit R.543-82 (signature « par l'opérateur et par l'exploitant », 5 ans) et retire « , fiches et registres » de R.543-83 ; publication **non trouvée** ; nouvelle version du Cerfa **non trouvée** | certain (arrêtés, projet) / non trouvé (publication) |
| Registres européens | règlement (UE) 2024/573, **art. 7** : registre par équipement tenu par l'exploitant, copies gardées 5 ans par l'entreprise qui intervient | certain |

**Conséquence pour la décision 7 (trois options, à toi de choisir)** :
- **A. ClimPilot reproduit fidèlement le Cerfa \*04** (au mieux en remplissant le PDF officiel), avec ta signature d'opérateur. Reste une incertitude : aucun texte ne dit qu'une fiche sortie d'un logiciel vaut le formulaire → à demander par écrit (DREAL ou organisme qui délivrera ton attestation de capacité).
- **B. Faire les fiches dans l'appli officielle du ministère** et garder dans ClimPilot le numéro de la fiche, le lien vers l'intervention et le bilan annuel. Conforme par construction, signature horodatée ; mais **double saisie** (pas de connexion).
- **C. Garder la fiche actuelle** : non conforme au formulaire (constats C1 à C3) — déconseillé.
- **Mon avis (hypothèse)** : essaie **B** sur une vraie intervention chez WOLF ou en essai ; si la double saisie est supportable, AF3 se réduit à garder des données justes dans ClimPilot (D5, D6, C2) ; sinon, A. Et dans les deux cas, D5/D6 (AF1) restent à corriger.
- Sources principales (consultées le 25/10/2026) : notice 52064\*04 (formulaires.service-public.gouv.fr), arrêtés du 29/02/2016, 29/05/2024, 26/07/2022 et 21/11/2025 (copies AIDA/INERIS), FAQ fluides du ministère (MAJ 02/2024), questions-réponses du lancement de l'appli (ecologie.gouv.fr, 22/04/2026), FAQ et documentation développeurs de Trackdéchets, règlement (UE) 2024/573 et eIDAS (EUR-Lex), projet de décret du 12/06/2026 (consultations publiques du ministère). Liste complète des adresses : Project Claude, `claude/ClimPilot-AF-recherche-fiche-fluide-25-10.md`.

## 9. Ce qui n'a pas été vérifié
- Les constats sont lus dans le code (certain) ; seuls D6 et les constats de l'analyse ont été **exécutés**. Les autres seront prouvés par les tests rouges de chaque mission.
- Aucun iPhone réel ; aucune règle fiscale ou sociale tranchée ici (les textes à imprimer viennent de ta comptable ou d'une source officielle citée par l'exécutant).
