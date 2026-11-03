# AF1 — « Zéro perte de données » — compte rendu (03/11/2026)

> Rédigé le 03/11/2026 par Claude (Fable 5.1), exécutant de la mission AF1 (`docs/MISSION-AF-CORRECTIONS.md`, § 2 : D0, D2, D3, D5, D6, suppression d'un devis signé) + deux pertes trouvées le 27/10 (C-N1, A-N5), pour Gabriel Leroy.
> Branche **`correctif/af1-pertes-donnees`**, créée depuis `main` (`1e33a67`, P6+ fusionnée le 03/11). Deux commits : **tests seuls** (CI attendue rouge : suite AD) puis **code + docs** (CI attendue verte). **Rien n'est fusionné ni déployé ; aucune base Supabase touchée.** Demande de fusion en brouillon : c'est Gabriel qui fusionne.
> Certitude : **certain** (lu dans le code et reproduit par un test ici, dans Chromium), **probable** (déduit), **hypothèse** (interprétation à valider).

## Ce que Gabriel décide / fait (10 lignes)

1. **Décisions appliquées (tes avis par défaut, à confirmer avant la fusion)** : un devis **signé, accepté ou facturé ne se modifie plus** (deux boutons « Faire un avenant » et « Dupliquer » ; un accord papier = statut « accepté » = verrouillé aussi) ; une **fiche fluide numérotée ne se supprime pas avant 5 ans** (« Annuler la fiche » avec motif à la place) et une **fiche signée est en lecture seule** ; **Paramètres** : question « Enregistrer / Abandonner » en quittant l'écran avec des modifications.
2. **Valide les interprétations du § 4** (hypothèses) : ce qu'emporte un avenant, ce qui reste utilisable sur un devis verrouillé, les fiches fluides annulées exclues des quantités du registre et du bilan, la règle « champs vides seulement » appliquée à **toutes** les coordonnées de la fiche client (pas seulement l'adresse).
3. **Lis le § 7** (ce qui change à l'écran) : ce sont des comportements nouveaux que tu verras tous les jours (bandeau 🔒, bouton 🗑 absent sur les fiches fluides numérotées, question en quittant Paramètres).
4. **Fais l'essai du § 8** sur la copie d'essai (≈ 15 min, 6 parcours numérotés, résultats attendus écrits).
5. Après fusion : **F5 sur chaque appareil** (cache `climpilot-next-1133-production`). Version affichée inchangée.
6. Batterie complète et CI : voir § 6 (mis à jour dans le commit suivant, une fois la batterie finale et la CI terminées).
7. Golden Y (documents) et Z (calculs) **identiques**, les 5 « À TRANCHER » **inchangés** ; aucun montant, aucune règle fiscale, aucune mention légale, aucun arrondi ne change.
8. Données : seulement des **champs ajoutés** (`avenantDe` sur un avenant ; `detAdr`, `detVille`, `detSiret`, `annulee` sur une fiche fluide ; clé locale `cpnext_journal`), rien de retiré ; export CSV du registre fluides : 2 colonnes ajoutées **à la fin**.
9. Ce qui n'est **pas** fait, volontairement (§ 10 et `docs/APRES-PRO-V1.md`, datés 03/11) : un écran pour lire le journal des refus ; « annuler » un devis signé que le client a finalement abandonné (il ne se supprime plus, il reste « accepté ») ; la rétractation d'une fiche fluide signée.
10. Retour arrière à tout moment : revert du commit « code » (les tests restent et redeviennent rouges).

## 1. Synthèse

| Défaut | Avant (constat) | Après (correction) | Tests |
|---|---|---|---|
| **D0** devis signé / accepté / facturé | s'ouvre, se modifie, s'enregistre et se supprime sans rien dire (les deux formulaires) | lecture seule, bandeau « 🔒 Devis … signé le … : il ne se modifie plus » + « Faire un avenant » / « Dupliquer » ; enregistrement refusé et noté au journal, quel que soit le chemin ; suppression refusée | AF1-T1 à T5 (16 contrôles) |
| **D2** fiche fluide | une fiche signée part à la corbeille en un clic ; effacement définitif après 30 jours | une fiche **numérotée** ne va pas à la corbeille avant 5 ans (date de la fiche + 5 ans) ; « Annuler la fiche » (motif obligatoire) : elle reste au registre, imprimable, mention ANNULÉE ; fiche sans numéro ou de plus de 5 ans : corbeille possible | AF1-T6 à T8 (6) |
| **D3** Paramètres | quitter l'écran perd les champs modifiés, sans message | question « Enregistrer / Abandonner » (OK / Annuler) au changement d'écran ; fermeture de l'onglet retenue par le navigateur ; sur téléphone, barre « Enregistrer » fixée en bas | AF1-T9 (13, PC et téléphone) |
| **D5** détenteur de la fiche fluide | adresse cherchée **par le nom** dans les clients à l'impression : « — » si le client n'est pas encore enregistré ; envoi du lien possible quand même | la fiche **garde** adresse, code postal + ville et SIRET du détenteur (reprise de l'intervention ou du devis ouvert, sinon de la fiche client ; champs visibles et modifiables) ; PDF et envoi les utilisent ; envoi **refusé** sans adresse | AF1-T10, T11 (5) |
| **D6** fiche fluide rouverte | `saveFlu` **remplaçait** la fiche par le formulaire : signature du détenteur, refus, lien de signature, repère… perdus (reproduit) | la fiche est **complétée**, jamais remplacée ; une fiche signée (ou annulée) est en lecture seule, enregistrement refusé | AF1-T12, T13 (6, contrôle bloquant et mode guidé) |
| **C-N1** « Lieu / urgence » | la fenêtre écrivait sur l'objet de la liste, pas sur la **copie ouverte** (`curDep`) : « Enregistrer » remettait la copie et effaçait tout | la copie ouverte est mise à jour (fenêtre « Lieu / urgence » et « Exemplaire remis ») ; le contrat imprimé porte l'urgence ; « Facturer » ne redemande rien | C-N1 (3) |
| **A-N5** fiche client | enregistrer un devis ou une intervention **recopiait** toutes les coordonnées du document sur la fiche client (adresse du chantier → adresse du client) | une fiche client existante **garde** ses coordonnées : seuls ses champs **vides** sont complétés ; un client nouveau est créé comme avant ; le document garde l'adresse du chantier | A-N5 (4) |

Suite `tests/suiteAD-af1-pertes.mjs` : **57 contrôles** (dont 4 témoins), **46 rouges sur `main`** (`1e33a67`), **57 verts** sur la branche, dans Chromium, horloge figée (REF). Journal des rouges gardé (§ 5).

## 2. Constats sur le code de `main` (`1e33a67`) — numéros de ligne vérifiés

| # | Constat | Certitude |
|---|---|---|
| 2.1 | **D0** : `saveDevis` (`index.html` l. 1727) et `saveV2` (`next-devis2.js` l. 387) enregistrent sans contrôle ; `protect()` (l. 242) remet signature, factures, statut, puis le contenu modifié remplace le devis. `guardDel` (`next-fiabilite.js` l. 74) ne regarde que les factures : un devis signé non facturé part à la corbeille. L'ancien formulaire n'a aucun verrou (seul le numéro, `numLocked`). | certain (reproduit T1, T2, T4, T5) |
| 2.2 | **D0, chemin oublié** : `avantFacture` (`next-devis2.js` l. 281-288) réécrit le devis de l'ancien formulaire **tel qu'affiché** avant de facturer : une modification à l'écran d'un devis accepté passait dans le devis au moment de « Facturer ». | certain (lu) ; corrigé, pas de test dédié (le formulaire est désormais en lecture seule) |
| 2.3 | **D2** : `nxSoftDelete('flu')` (`next-addons.js` l. 459) remplace `delFlu` : confirmation, corbeille 30 jours, effacement (`nxCleanTrash`). Aucun regard sur le numéro, la date ni la signature. | certain (T6, T8) |
| 2.4 | **D3** : `saveParams` (l. 1972) ne lit les champs qu'au clic ; `go` (l. 1256) ne vérifie rien ; seul `pagehide` (`next-store.js` l. 286) vide le cache de stockage. | certain (T9) |
| 2.5 | **D5** : l'adresse n'est pas stockée sur la fiche ; `printFicheFlu` (`next-cerfa.js` l. 167, version active ; `index.html` l. 3445, version d'origine) cherche le client par son nom (`cl.adr`, `cl.cp`, `cl.ville`) ; `nxsSendFlu` (`next-signature.js` l. 125) envoie quand même. Le code postal `cl.cp` lu par le PDF n'est écrit par personne (`upsertClient` écrit `ville` = « CP Ville »). | certain (T10, T11) |
| 2.6 | **D6** : `saveFlu` (l. 3428) construit `o` depuis le formulaire et fait `FLU[i]=o` ; les enveloppes (`next-cerfa.js` l. 115, `next-flu-guide.js` l. 219) ne remettent que leurs champs. Perdus : `sigDetenteur`, `refusDetenteur`, tout champ posé ailleurs. Reproduit ici en mémoire **et** dans le stockage, en mode bloquant et en mode guidé. | certain (T12, T13) |
| 2.7 | **C-N1** : `nxPartConclusion` (`next-particuliers.js` l. 94-113) : `objet('dep',id)` rend l'élément de `DEP` ; `curDep` (copie faite par `openDep`, `index.html` l. 2138) n'est pas mis à jour ; `saveDep` (l. 2241) fait `DEP[i]=curDep`. Même chose pour la fenêtre « Exemplaire remis » (l. 126-135). Le panneau affichait encore « Contrat : À préciser » juste après l'enregistrement. | certain (C-N1) |
| 2.8 | **A-N5** : `upsertClient` (l. 1724) et le bloc client de `saveDep` (l. 2243-2245) : `CLIENTS[i]={...CLIENTS[i],...o}` écrase type, téléphone, mail, adresse, ville, SIREN (et zone) avec ceux du document. | certain (A-N5) |
| 2.9 | **Hors périmètre, observé** : à l'ouverture d'un devis, `nxEnsureQuote` (`next-addons.js` l. 622) ajoute des champs par défaut (`elecMode`, `breakerManual`, `breakerQte`, `differential`, `diffQte`, `proximity`) **au devis enregistré** (objet partagé), et `next-fiabilite.js` pose `figEnv` (montant envoyé) au changement d'écran. Aucun montant ne change ; ce ne sont pas des pertes. Le test T1 l'admet explicitement (liste `AJOUTS_CONNUS`). | certain (vu par T1) ; rien corrigé |

## 3. Corrections (aucun montant, aucune règle, aucune mention ne change)

### 3.1 D0 — `index.html`, `next-devis2.js`, `next-fiabilite.js`
- `cpDevisVerrou(d)` (index.html, après `upsertClient`) : verrouillé si **facture** (`facAcompte` ou `facSolde` présents), sinon **signature** (`signature.at`), sinon **statut `accepte`**. Lu sur la **copie enregistrée** (`cpDevisVerrouille(id)`), jamais sur le formulaire : passer un brouillon en « accepté » et l'enregistrer reste possible (c'est l'accord papier) ; dès cet enregistrement, il est verrouillé.
- `saveDevis` (ancien formulaire) et `saveV2` (nouveau) refusent **en premier** : message « 🔒 Devis … signé le … : il ne se modifie plus. Fais un avenant ou duplique-le. », ligne au journal (`cpJournal` : clé locale `cpnext_journal`, 200 dernières lignes : `{at, type, action, id, num, motif}`), `false` rendu. Couvre toutes les enveloppes (addons, devis2, assistant, raccourcis) puisqu'elles finissent dans ces deux fonctions. `avantFacture` ne réécrit plus un devis verrouillé. `nxd2.statut`, `nxd2.sign` et la saisie (`apply`) refusent aussi ; aucun brouillon local n'est écrit ni repris pour un devis verrouillé.
- Lecture seule : ancien formulaire `cpVerrouWizard()` (appelé à la fin de `loadDevisToForm`) — champs et boutons des étapes désactivés (`data-cp-verrou`), bouton « Enregistrer » de l'en-tête caché, bandeau `#cpVerrouWiz` ; nouveau formulaire `verrouBody()` (fin de `renderBody`) + en-tête (`updHead`) : boutons « Faire un avenant » / « Dupliquer » à la place de « Signature » / « Enregistrer », bandeau permanent, barre du bas « 🔒 lecture seule ». **Restent utilisables** : onglets, PDF, mail au client, checklist, fiche de visite, et le **bloc facturation** (acompte, solde, « payée » : `#fBloc` / `#nxd2FHost`).
- `cpDevisAvenant(id)` : passe par `dupDevis` (donc par la règle existante de duplication de `next-fiabilite.js` : ni signature, ni factures, ni relances, ni planification, statut brouillon, nouveau numéro, lots renumérotés), puis pose `avenantDe:{id,num,at}`, **retire `conclusion`** (mode et date du contrat à préciser à nouveau), met « Avenant au devis n° … » en tête des notes, ouvre l'avenant. L'original n'est **pas touché** (aucun champ ajouté : T3 le vérifie à l'octet près). `cpDevisDupliquer(id)` : dupliquer **et ouvrir** la copie.
- Suppression : `guardDel` (`next-fiabilite.js`) refuse un devis verrouillé comme un devis facturé (message, ligne au journal) ; `delDevis` d'origine (index.html) a la même règle.

### 3.2 D2 et D6 — `index.html` (fiche fluide), `next-addons.js`, `next-cerfa.js`, `next-flu-guide.js`, `next-flubilan.js`
- `cpFluSupprimable(f)` : vrai si pas de numéro, ou si `todayISO() >= date de la fiche + 5 ans` (`cpFluConservationFin`). `nxSoftDelete('flu')` et `delFlu` refusent sinon : « ⛔ Fiche … : conservation obligatoire 5 ans (jusqu'au …). Elle ne va pas à la corbeille : pour une erreur, « Annuler la fiche » (motif) … ». Dans le registre, le bouton 🗑 n'apparaît que si la fiche est supprimable ; un bouton ⛔ « Annuler la fiche » apparaît sinon.
- `annulerFlu(id)` : motif obligatoire (3 caractères au moins, sinon rien), `annulee:{at,date,motif}` ; la fiche reste au registre (ligne grisée, étiquette ANNULÉE avec le motif en survol), s'imprime avec un bandeau « FICHE ANNULÉE le … — motif : … » (les deux versions de `printFicheFlu`), est **exclue des quantités** du registre (KPI « chargé / récupéré », compteur « dont N annulée(s) ») et du bilan annuel (`next-flubilan.js`, `auto()`), qui l'annonce (« N fiche(s) annulée(s) … non comptée(s) »). Une fiche signée peut être annulée après confirmation (elle reste au registre).
- `cpFluVerrou(f)` : fiche **signée** (`sigDetenteur.at`) ou **annulée** → `cpFluVerrouForm()` à l'ouverture (et 80 ms après, pour les champs ajoutés par les couches Cerfa et guide) : champs désactivés, boutons « Enregistrer » cachés, bandeau `#cpFluVerrou`. `saveFlu` refuse (`false`) ; les deux enveloppes s'arrêtent sur `false` (rien d'autre n'est écrit). Dans le registre : ✏️ devient 🔒 (consulter).
- **D6, le cœur** : `saveFlu` fait `o = Object.assign({}, old, saisie)` — tout champ que le formulaire ne gère pas est gardé (signature, refus, lien, repère, compléments Cerfa, coordonnées du détenteur…). Le numéro reste celui de la fiche.

### 3.3 D3 — `index.html`
- `cpParamsEcoute()` (posé au premier `go('params')`) : un `input` / `change` sur un champ lu par `saveParams` (identifiants `pe_`, `pg_`, `pf_`, `pm_`, `pz_`, `pb_`, `pt_`, `pa_`, `pmg_`, `pd_`, `pp_`, `pms_`) marque l'écran modifié ; les autres cases de l'écran (réglages enregistrés tout de suite par des couches) ne comptent pas. Pendant la reconstruction de l'écran (`renderParams`), les événements sont ignorés (le navigateur émet le « change » d'un champ qui avait le focus quand il est remplacé).
- `go(v)` commence par `cpParamsGarde(v)` : si on quitte Paramètres avec des modifications → `confirm('Paramètres modifiés et non enregistrés. OK = Enregistrer, Annuler = Abandonner les modifications')` ; OK → `saveParams()` ; dans les deux cas on change d'écran. `beforeunload` retient la fermeture de l'onglet tant que des modifications existent (message générique du navigateur). `saveParams` et `renderParams` remettent le drapeau à zéro.
- Téléphone (≤ 860 px) : la ligne « Enregistrer les paramètres / Revenir… » est **fixée en bas** de l'écran (`position:fixed`, place laissée à droite pour le bouton flottant « Assistant ») ; `#v-params` reçoit une marge basse. `position:sticky` ne marchait pas : `.content` est en `overflow-x:hidden` sur téléphone (`next-theme.css` l. 165), ce qui neutralise le collage.

### 3.4 D5 — `index.html`, `next-cerfa.js`, `next-signature.js`
- Trois champs dans la fenêtre fiche fluide : **Adresse du détenteur** (`fl_detAdr`), **Code postal et ville** (`fl_detVille`, convention de l'appli : « 60600 Clermont »), **SIRET** (`fl_detSiret`). Enregistrés sur la fiche (`detAdr`, `detVille`, `detSiret`).
- Pré-remplissage `cpDetenteurCoord(nom)` : l'intervention ouverte (`curDep`, même pas encore enregistrée), puis le devis ouvert (`cur`), puis la fiche client (`adr`, `cp` + `ville`, `siren`). Appelé à l'ouverture d'une nouvelle fiche et quand le nom du client change (`cpFluDetAuto`, ne remplit que les champs vides). Le bouton « 🧪 Fiche fluide » du formulaire d'intervention relit d'abord le formulaire (`formToDep()`), donc l'adresse tapée sert même sans « Enregistrer ». La fiche pré-remplie depuis une intervention dictée (`nxcFromIntervention`) transmet aussi les coordonnées.
- PDF (`next-cerfa.js`, version active, et `index.html`) : adresse et SIRET de la **fiche** ; repli sur la fiche client pour les fiches d'avant (champs absents) ; bandeau ANNULÉE le cas échéant.
- `nxsSendFlu` : refus si l'adresse (fiche, sinon client) est vide : « ⚠ Adresse du détenteur manquante : complète-la sur la fiche avant d'envoyer le lien de signature » ; refus aussi pour une fiche annulée. Le contrôle passe **avant** le contrôle « connecté au cloud ».

### 3.5 C-N1 — `next-particuliers.js`
- Dans les deux fenêtres (« Lieu / urgence » et « Exemplaire remis »), après `enregistrer(kind)` : si `kind==='dep'` et que `curDep` est une autre copie du même objet, `curDep.conclusion` reçoit la copie (même mécanisme que celui qui existait déjà pour `cur`, le devis). Le panneau est ensuite redessiné depuis `curDep` et montre l'urgence tout de suite.

### 3.6 A-N5 — `index.html`
- `cpCompleterClient(o)` remplace les deux copies du même code (`upsertClient`, `saveDep`) : fiche **existante** → seuls les champs vides reçoivent la valeur du document (`type`, `tel`, `mail`, `adr`, `ville`, `siren`) ; `lastZone` (dernière zone utilisée) se met toujours à jour ; le nom n'est pas réécrit (la casse de la fiche est gardée). Client **nouveau** → créé avec les coordonnées du document, comme avant. L'enveloppe de `next-addons.js` (origine du client) est inchangée.

### 3.7 Cache — `sw.js`
- `const C='climpilot-next-1133-production'` (main : 1132). `VERSION` et `NX_VERSION` inchangés.

## 4. Interprétations à valider (hypothèses)

1. **« Facturé »** = `facAcompte` ou `facSolde` présents. Un devis dont la seule facture a été **annulée par un avoir** (plus de `facAcompte`/`facSolde`) n'est pas verrouillé par ce motif (il le reste s'il est signé ou accepté). La suppression était déjà refusée dans ce cas (`guardDel`, factures annulées comprises).
2. **« Accepté »** = statut `accepte`, avec ou sans date (`acceptedAt`). Le bandeau dit « accepté le … » si la date existe, « accepté » sinon.
3. **Avenant** : copie complète (client, lots, montants, notes) en brouillon, nouveau numéro, lien `avenantDe` vers l'original, note « Avenant au devis n° … » en tête, **mode et date de conclusion du contrat retirés** (à préciser à nouveau : c'est un nouveau contrat), signature / factures / relances / planification retirées (règle existante de duplication). L'original ne reçoit **aucun** champ (pas de liste de ses avenants) : c'est ce que demandait le dossier (« l'original intact »).
4. Sur un devis verrouillé **restent possibles** : PDF, mail au client, checklist, fiche de visite, et la facturation (acompte, solde, « payée ») ; **ne sont plus possibles** : changer le statut (donc pas de « refusé » après coup), renvoyer en signature, modifier une ligne. Un devis signé que le client abandonne reste « accepté » : noté dans `APRES-PRO-V1.md`.
5. **Dupliquer** ouvre maintenant la copie (avant : elle restait dans la liste, sans s'ouvrir).
6. **Journal** : clé locale `cpnext_journal` (200 dernières lignes), synchronisée comme les autres clés `cpnext_` ; **aucun écran** ne la montre (idée notée, datée).
7. **Fiche fluide annulée** : exclue des quantités du registre (KPI) et du bilan annuel, listée avec la mention. Choix fait parce qu'une fiche annulée est une erreur de saisie ; aucune fiche existante n'est annulée aujourd'hui, donc aucun chiffre ne change. Si tu préfères qu'elle compte quand même, c'est une ligne à changer (`auto()` et `byF`). Une fiche signée peut être annulée (confirmation) et reste au registre.
8. **Corbeille** : une fiche **sans numéro** reste supprimable (ancienne donnée ou import) ; une fiche numérotée l'est après `date + 5 ans`. Le délai court depuis la **date de l'intervention** inscrite sur la fiche (la notice parle de la signature ; les deux coïncident en pratique).
9. **Code postal du détenteur** : stocké avec la ville dans `detVille` (« 60600 Clermont »), comme partout dans l'appli (`cVille`, `ville`) ; le PDF imprime « adresse CP ville ».
10. **A-N5** appliqué à **toutes** les coordonnées (téléphone, mail, type, SIREN), pas seulement à l'adresse, parce que la même copie-plus-ancienne écrase aussi un téléphone changé sur la fiche client. Conséquence : un téléphone corrigé sur un devis **ne corrige plus** la fiche client ; on corrige la fiche client elle-même (écran Clients).
11. **D3** : question à deux réponses (OK / Annuler) ; pas de troisième choix « rester sur l'écran ». La fermeture de l'onglet n'offre que le message générique du navigateur.

## 5. Tests : rouge sur `main`, vert après (suite `tests/suiteAD-af1-pertes.mjs`)

Lancement : `node tests/suiteAD-af1-pertes.mjs` (serveur local :8765, Chromium), horloge figée sur REF, cloud coupé. Dialogues (`confirm` / `prompt`) et messages (`toast`, `nxToast`) interceptés dans la page.

| Test | Contrôles | Sur `main` (1e33a67) | Après |
|---|---|---|---|
| T1 devis v2 signé : ouvrir, modifier (par le code), enregistrer → identique au centime ; message ; bandeau + 2 boutons ; champs verrouillés ; journal | 6 | 5 rouges (42 champs libres, « 💾 Devis enregistré », notes modifiées) | verts |
| T2 devis avec acompte facturé (non signé) | 2 | rouges | verts |
| T3 « Faire un avenant » : nouveau brouillon lié, même montant, sans signature ni facture ; original identique à l'octet ; ouvert dans l'éditeur | 3 | rouges (`cpDevisAvenant` absent) | verts |
| T4 devis **accepté sans signature**, ancien formulaire : identique ; bandeau ; avenant depuis l'ancien formulaire ; témoin brouillon modifiable | 4 | 3 rouges + témoin vert | verts |
| T5 suppression d'un devis signé, puis accepté : refusée, pas dans la corbeille ; témoin brouillon → corbeille | 3 | 2 rouges + témoin vert | verts |
| T6 fiche signée → suppression refusée (mémoire, stockage, corbeille) | 1 | rouge (dans la corbeille) | vert |
| T7 « Annuler la fiche » : motif obligatoire ; `annulee` en mémoire et stockage ; registre avec ANNULÉE, reste intact ; PDF avec motif ; bilan la mentionne | 3 | rouges (`annulerFlu` absent) | verts |
| T8 fiche d'il y a 2 ans refusée (message « jusqu'au … ») ; fiche d'il y a 6 ans → corbeille ; fiche sans numéro → corbeille | 3 | 1 rouge + 2 témoins verts | verts |
| T9 Paramètres, **PC et téléphone** : rien modifié → aucune question ; taux modifié → question ; OK → valeur gardée après rechargement ; Annuler → ancienne valeur ; fermeture d'onglet retenue ; après Enregistrer plus de question ; bouton fixé en bas (téléphone) | 13 | 9 rouges + 4 verts (témoins, aucune erreur) | verts |
| T10 fiche depuis une intervention **non enregistrée**, client nouveau : champs présents et pré-remplis ; fiche avec les coordonnées ; PDF avec l'adresse ; client existant repris, modifiable sans toucher la fiche client | 4 | rouges (« Adresse : — ») | verts |
| T11 adresse vide → envoi refusé « Adresse du détenteur manquante », aucun lien | 1 | rouge (« Connecte-toi au cloud… ») | vert |
| T12 (bloquant) / T13 (guidé) : fiche signée → ouvrir → enregistrer : signature **avant oui, après oui** (mémoire et stockage) ; lecture seule ; fiche non signée avec refus + lien + repère → tout gardé | 6 | rouges (reproduction du 25/10 confirmée : après = non, en mémoire et dans le stockage) | verts |
| C-N1 : urgence gardée après « Enregistrer » (mémoire et stockage) ; panneau à jour ; contrat avec « Urgence » ; règle « Facturer » = urgence | 3 | rouges (`conclusion` absente, règle « a_preciser ») | verts |
| A-N5 : devis v2, ancien formulaire, intervention ; témoin client nouveau | 4 | 3 rouges + témoin vert | verts |
| Aucune erreur JavaScript | 1 | vert | vert |

Total : **57 contrôles, 46 rouges sur `main`, 57 verts après** (résultats bruts gardés dans le dossier de la session : `resAD-rouge-main.json`, `resAD-vert.json` ; en CI, dans l'artefact du commit « tests d'abord », suite AD en échec).

**Un test existant change d'attendu, à cause de la décision 1** : `suiteI-emission.mjs`, I3b « devis modifié à l'écran puis facturé » attendait « modification enregistrée ET facture émise » sur un devis **accepté**. Avec D0, la modification d'un devis accepté n'est plus enregistrée ; la facture doit être émise quand même. Le contrôle devient « modification NON enregistrée (AF1 D0, lecture seule) ET facture émise ». La première batterie l'a trouvé **rouge** (la facture n'était même plus émise : `avantFacture` s'arrêtait sur le refus d'enregistrement) → correction dans `next-devis2.js` (un devis verrouillé se facture d'après sa copie enregistrée) → suite I 40/40.

Deux ajustements de la suite AD après la correction, tous deux dus à mes propres changements, pas à un relâchement : le sélecteur du bouton « 🧪 Fiche fluide » (son `onclick` commence maintenant par `formToDep();`) et la copie de référence de T1/T2/T3 prise **après** l'ouverture (constat 2.9 : des couches existantes ajoutent des champs par défaut à l'ouverture ; T1 vérifie que ce sont **seulement** ceux-là).

## 6. Batterie complète et CI

*(en cours au moment de ce commit : premier passage complet lancé sur la branche — suites A à P vertes, suite I corrigée (§ 5) ; second passage sur le code final et CI à venir ; ce paragraphe est complété dans le commit suivant)*

## 7. Ce que Gabriel verra changer à l'écran

- **Devis** : un devis accepté, signé ou facturé s'ouvre avec un bandeau jaune 🔒 « Devis … accepté le … : il ne se modifie plus » et deux boutons **Faire un avenant** / **Dupliquer** ; les champs sont gris ; « Enregistrer » et « Signature » disparaissent ; la facturation reste là (récapitulatif). Le statut ne se change plus sur ces devis dans l'éditeur (la liste, elle, ne proposait déjà que « Facturer » pour un devis accepté : rien n'y change). Supprimer un tel devis : message « ⛔ … il ne se supprime pas ».
- **Avenant** : un nouveau devis brouillon, même contenu, numéro suivant, notes commençant par « Avenant au devis n° … », bandeau « ↪ Avenant du devis n° … » ; le mode de conclusion du contrat est à préciser à nouveau.
- **Fluides & Cerfa** : plus de 🗑 sur les fiches numérotées de moins de 5 ans ; un bouton ⛔ « Annuler la fiche » (motif demandé) ; une fiche annulée reste dans la liste, grisée, étiquette rouge ANNULÉE ; son PDF porte le bandeau ; les quantités chargées / récupérées ne la comptent plus (« dont N annulée(s) »). Une fiche signée s'ouvre avec 🔒 : tout est gris, pas de bouton Enregistrer, bandeau « signée par … le … ».
- **Fiche fluide** : trois champs de plus (adresse, code postal et ville, SIRET du détenteur), remplis tout seuls depuis l'intervention ou le devis ouvert, ou la fiche client ; sans adresse, « Faire signer le détenteur » répond « Adresse du détenteur manquante ».
- **Paramètres** : si tu changes une valeur puis cliques ailleurs dans le menu, une question : OK = enregistrer, Annuler = abandonner. Sur téléphone, la barre « Enregistrer » reste collée en bas.
- **Intervention chez un particulier** : après « Lieu / urgence », le panneau affiche tout de suite « urgence demandée par le client » ; « Enregistrer » ne l'efface plus.
- **Clients** : enregistrer un devis ou une intervention ne change plus l'adresse (ni le téléphone, mail, type, SIREN) d'un client existant ; seuls ses champs vides se remplissent.

## 8. Un essai pour Gabriel sur la copie d'essai (≈ 15 min)

Avant : copie d'essai à jour sur la branche (F5), données fictives.

**Parcours 1 — devis accepté (≈ 4 min)**
1. Ouvre un devis au statut « Accepté » (ou passe un brouillon en « Accepté » puis Enregistrer). **Attendu** : à la réouverture, bandeau 🔒 en haut, champs gris, boutons « Faire un avenant » / « Dupliquer » à la place d'« Enregistrer ».
2. Essaie de changer une quantité ou une heure. **Attendu** : impossible (champ gris).
3. Onglet « Récapitulatif » : « Facturer l'acompte » ou « Facturer » est toujours là et fonctionne (ne clique que si tu veux une facture d'essai).
4. Clique « Faire un avenant ». **Attendu** : un nouveau devis brouillon s'ouvre, même contenu, notes « Avenant au devis n° … », modifiable ; dans la liste, l'original est toujours « Accepté », inchangé.
5. Liste des devis → 🗑 sur l'original. **Attendu** : message « ⛔ Devis … accepté … : il ne se supprime pas » ; il reste dans la liste.

**Parcours 2 — fiche fluide (≈ 4 min)**
1. Fluides & Cerfa : sur une fiche numérotée récente, **attendu** : pas de 🗑, un ⛔. Clique ⛔, laisse le motif vide → **attendu** : « Motif obligatoire : fiche non annulée », rien ne change. Recommence avec un motif → **attendu** : ligne grisée « ANNULÉE », compteur « dont 1 annulée », PDF 🖨️ avec le bandeau rouge.
2. Ouvre une fiche signée (s'il y en a une sur la copie d'essai) → **attendu** : bandeau « signée par … », tout gris, pas de bouton Enregistrer. Ferme.
3. Ouvre une fiche non signée, change une observation, Enregistrer → **attendu** : observation gardée, et tout le reste de la fiche aussi (compléments Cerfa, repère).

**Parcours 3 — adresse du détenteur (≈ 2 min)**
1. Interventions → Nouvelle intervention, tape un nom de client **inexistant**, une adresse et une ville, **sans enregistrer**. Clique « 🧪 Fiche fluide ». **Attendu** : les champs « Adresse du détenteur » et « Code postal et ville » sont déjà remplis.
2. Décris l'équipement, Enregistrer + fiche PDF. **Attendu** : cadre « 2 — Détenteur » avec l'adresse (plus de « — »).

**Parcours 4 — Paramètres (≈ 2 min)**
1. Paramètres → change « Taux horaire par défaut » → clique « Tableau de bord » dans le menu. **Attendu** : question « Paramètres modifiés et non enregistrés… ». Annuler → Paramètres → **attendu** : ancienne valeur.
2. Refais-le, OK → **attendu** : « ⚙️ Paramètres enregistrés », nouvelle valeur gardée après F5. Remets la valeur d'origine.
3. Sur le téléphone : Paramètres → **attendu** : la barre « Enregistrer les paramètres » reste visible en bas pendant le défilement.

**Parcours 5 — Lieu / urgence (≈ 2 min)**
1. Interventions → ouvre (✏️) une intervention chez un **particulier** déjà enregistrée → « Lieu / urgence » → coche « Travaux urgents », Enregistrer. **Attendu** : le panneau rouge affiche « — urgence demandée par le client ».
2. Clique « 💾 Enregistrer » puis rouvre l'intervention. **Attendu** : l'urgence est toujours là ; « 🖨 Contrat d'intervention à signer » contient le paragraphe « Urgence ».

**Parcours 6 — fiche client (≈ 1 min)**
1. Nouveau devis pour un client **existant** (tape son nom : ses coordonnées se remplissent), remplace l'adresse par celle d'un chantier, Enregistrer. Écran Clients → sa fiche. **Attendu** : l'adresse de la fiche client est **inchangée** ; le devis garde l'adresse du chantier.

## 9. Fichiers modifiés

`index.html` (D0, D2, D3, D5, D6, A-N5), `next-devis2.js` (D0, éditeur v2, facturation d'un devis verrouillé), `tests/suiteI-emission.mjs` (attendu I3b aligné sur la décision 1), `next-fiabilite.js` (D0, suppression), `next-addons.js` (D2, corbeille), `next-cerfa.js` (D5, D6, PDF), `next-flu-guide.js` (D6), `next-flubilan.js` (D2, bilan), `next-signature.js` (D5, envoi), `next-particuliers.js` (C-N1), `sw.js` (cache 1133), `tests/suiteAD-af1-pertes.mjs` (nouvelle), `tests/run-all.sh`, `tests/LISEZMOI.md`, `docs/AF1-COMPTE-RENDU.md`, `docs/APRES-PRO-V1.md` (3 idées datées 03/11).

## 10. Ce qui n'a pas pu être vérifié

- **iPhone / Safari réels** : rien ici (Chromium émulant un iPhone 13 pour les tests « téléphone »). La barre fixée en bas et la question en quittant Paramètres sont à regarder sur ton téléphone (parcours 4.3).
- **Fermeture réelle de l'onglet** avec des Paramètres modifiés : le test vérifie que le navigateur est prié de retenir la fermeture (`beforeunload` empêché) ; l'affichage de la boîte du navigateur dépend de l'appareil (Safari iOS ne la montre pas toujours).
- **Synchronisation entre appareils** d'un devis verrouillé ou d'une fiche annulée : non testée ici au-delà de la suite Q existante (qui a tourné dans la batterie) ; la règle se lit sur la copie enregistrée, donc une fiche signée sur le téléphone est verrouillée sur le PC dès la synchro (probable).
- **Impression PDF réelle** (rendu du bandeau ANNULÉE et du cadre Détenteur dans la boîte d'impression) : HTML vérifié, pas le PDF.
- **Signature en ligne réelle** d'une fiche fluide (serveur) : le refus sans adresse est testé ; l'envoi réel avec adresse ne change pas (même `createLink`).
- Le **journal** (`cpnext_journal`) n'a pas d'écran : vérifié seulement dans le stockage.
