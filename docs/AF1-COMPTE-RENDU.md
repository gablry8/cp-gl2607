# AF1 — « Zéro perte de données » — compte rendu (03/11/2026, complété par AF1-bis le 03/11/2026 au soir)

> Rédigé le 03/11/2026 par Claude (Fable 5.1), exécutant de la mission AF1 (`docs/MISSION-AF-CORRECTIONS.md`, § 2 : D0, D2, D3, D5, D6, suppression d'un devis signé) + deux pertes trouvées le 27/10 (C-N1, A-N5), pour Gabriel Leroy.
> Branche **`correctif/af1-pertes-donnees`**, créée depuis `main` (`1e33a67`, P6+ fusionnée le 03/11). Deux commits : **tests seuls** (CI attendue rouge : suite AD) puis **code + docs** (CI attendue verte). **Rien n'est fusionné ni déployé ; aucune base Supabase touchée.** Demande de fusion en brouillon ([#9](https://github.com/gablry8/cp-gl2607/pull/9)) : c'est Gabriel qui fusionne.
> **AF1-bis (03/11, soir)** : corrections après la relecture indépendante (Opus, 03/11), exception au gel limitée aux 8 points de Gabriel — § 11. Deux commits de plus sur la même branche : **tests d'abord** (`f6ed6a7`, 18 contrôles rouges sur `9fcf2cf`) puis **code** (`22ca108`), puis les documents.
> Certitude : **certain** (lu dans le code et reproduit par un test ici, dans Chromium), **probable** (déduit), **hypothèse** (interprétation à valider).

## Ce que Gabriel décide / fait (10 lignes)

1. **Décisions appliquées (tes avis par défaut d'AF1 + tes 8 décisions d'AF1-bis, à confirmer avant la fusion)** : un devis **signé, accepté ou facturé ne se modifie plus** (« Faire un avenant » / « Dupliquer » ; accord papier = statut « accepté » = verrouillé) ; **AF1-bis** : « Faire un avenant » **refusé** si une facture vivante existe ; quand l'avenant passe en « Accepté », l'original passe **« remplacé par l'avenant n° … »** (sort de la facturation, d'« À commander », de « Planifier » et du carnet ; visible, non supprimable) ; acceptation **refusée** si l'original a été facturé entre-temps ; bouton **« Annuler le devis »** (motif obligatoire : abandon, rétractation 14 jours, erreur de saisie, autre) sur un devis accepté ou signé, refusé tant qu'une facture vivante existe ; une **fiche fluide numérotée ne se supprime pas avant 5 ans** (« Annuler la fiche ») et une **fiche signée est en lecture seule** ; **Paramètres** : question « OK = enregistrer · Annuler = PERDRE les modifications ».
2. **Valide les interprétations du § 4** (AF1) et du **§ 11.4** (AF1-bis : avenant signé en ligne alors que l'original est facturé → signature **gardée en attente**, statut inchangé ; motifs d'annulation ; un devis annulé ne se facture plus, même après coup).
3. **Lis le § 7** (ce qui change à l'écran, corrigé par AF1-bis : bandeau avec trois boutons, états « Remplacé » / « Annulé » dans la liste, PDF ANNULÉ).
4. **Fais l'essai du § 8** (parcours 1 à 6, ≈ 15 min) **et du § 11.6** (parcours 7 et 8, ≈ 6 min) sur la copie d'essai.
5. Après fusion : **F5 sur chaque appareil, le même jour** (cache `climpilot-next-1133-production`, inchangé par AF1-bis). Version affichée inchangée. Ne modifie pas un devis sur un appareil hors ligne ou pas encore rechargé (§ 10).
6. Batterie complète ici : AF1 sur `1f677d4` **COMPLET, RÉUSSI — 1 343 / 0 / 0** ; **AF1-bis : COMPLET, RÉUSSI — 1 363 réussis, 0 échoué, 0 SKIP**, 5 « À TRANCHER » inchangés (2e passage, sur `2fcb96d`, arbre propre ; le 1er passage avait planté sur la suite X sous charge, rejouée seule 8/8 : § 11.5) ; CI GitHub du même code (`1c9abf9`) : **verte** (push, run 60 ; demande de fusion, run 61). Détail § 6 et § 11.5.
7. Golden Y (documents) et Z (calculs) **identiques**, les 5 « À TRANCHER » **inchangés** ; aucun montant, aucune règle fiscale, aucune mention légale, aucun arrondi ne change (AF1-bis compris : le bandeau ANNULÉ n'apparaît que sur un devis annulé, aucun golden n'en a).
8. Données : seulement des **champs ajoutés** — AF1 : `avenantDe`, `detAdr`, `detVille`, `detSiret`, `annulee`, clé locale `cpnext_journal` ; **AF1-bis** : deux valeurs de statut nouvelles (`remplace`, `annule`) et les champs `remplacePar`, `annulation`, `signatureEnAttente` ; rien de retiré ; export CSV du registre fluides : 2 colonnes ajoutées à la fin.
9. Ce qui n'est **pas** fait, volontairement (§ 10, § 11.7, `docs/APRES-PRO-V1.md`) : écran du journal ; rappel « refais la fiche » après l'annulation d'une fiche fluide ; message quand le téléphone d'un devis diffère de la fiche client ; défaut de synchro D1 (P3). **`docs/FILE-DES-MISSIONS.md` n'existe ni sur `main` ni sur cette branche** (il est sur `outillage/claude-code`, PR #8 **encore ouverte, en brouillon**, vérifié sur GitHub le 03/11 au soir **et de nouveau le 04/11** — l'énoncé d'AF1-bis la disait fusionnée, ce n'est pas le cas ; `main` est toujours `1e33a67`) : les lignes à y porter sont prêtes au § 11.8, à coller après la fusion de #8. Créer le fichier ici provoquerait un conflit à la fusion de #8.
10. Retour arrière à tout moment : revert des commits « code » (`a789cbd` pour AF1, `22ca108` pour AF1-bis) ; les tests restent et redeviennent rouges.

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
| **AF1-bis 1** avenant | l'original restait « accepté » et se facturait encore : deux factures possibles (original + avenant), solde de l'avenant sans déduction de l'acompte, « À commander » et « Planifier » comptaient les deux (BLOQUANT, reproduit par la relecture) | pas d'avenant sur un devis qui porte une facture vivante ; avenant accepté → original **« remplacé par l'avenant n° … »** (date gardée, hors facturation / À commander / Planifier / carnet, visible, non supprimable) ; acceptation **refusée** si l'original a été facturé entre-temps (liste, éditeur, ancien formulaire, signature en ligne) | T14 (8) |
| **AF1-bis 2** devis accepté sans issue | un devis accepté ou signé abandonné par le client restait « accepté » pour toujours (CA signé, À commander, Planifier) | **« Annuler le devis »** : motif obligatoire, état « annulé » (motif, date), hors de tout, visible, PDF avec bandeau ANNULÉ, non supprimable, ligne au journal ; refusé tant qu'une facture vivante existe (« fais d'abord un avoir »), possible après un avoir total | T15 (5) |
| **AF1-bis 3** trou dans le verrou | ancien formulaire : « ✍️ Signature », « Faire signer en ligne » et « 💾 Enregistrer le devis » du récapitulatif restaient actifs ; `nxsSendDevis` réécrivait le devis accepté (reproduit : notes modifiées enregistrées) | contrôle du verrou en tête de `nxsSendDevis` (refus, journal) ; `cpVerrouWizard` cache les trois boutons | T16 (3) |
| **AF1-bis 5** question des Paramètres | « OK = Enregistrer / Annuler = Abandonner les modifications » | « **OK = enregistrer · Annuler = PERDRE les modifications** » | T9 (2, PC et téléphone) |
| **AF1-bis 6** apostrophe | `cpDetenteurCoord` trouvait « L'Atelier du Froid » mais pas « L’Atelier du Froid » (’ du clavier iPhone) | ’ et ' normalisées dans cette recherche (`cpNomCle`) | T17 (1) |

Suite `tests/suiteAD-af1-pertes.mjs` : **57 contrôles** (dont 4 témoins ; **56 au commit « tests d'abord » `ba1da71`**, le contrôle « T1 l'ouverture ne change rien au devis enregistré » ayant été ajouté avec la correction, constat 2.9), **46 rouges sur `main`** (`1e33a67`), **57 verts** sur la branche, dans Chromium, horloge figée (REF). Journal des rouges gardé (§ 5). **AF1-bis** : **74 contrôles** (17 ajoutés — 16 rouges + 1 témoin vert — et 2 contrôles T9 dont l'attendu change, rouges aussi : **18 rouges sur `9fcf2cf`**), 74 verts après (§ 11.3).

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
| 2.10 | **Hors périmètre, observé (suite Q)** : enregistrer un devis sauvegarde **toute** la liste des clients (`upsertClient` → `save(LS.clients)`, avant comme après AF1) ; si un autre appareil vient de changer la fiche de **ce** client (une note), la synchro qui suit a gardé la version du PC et perdu la note du téléphone dans un passage de la suite Q (devis de Dupré ouvert pendant que le téléphone change la note de Dupré). Famille D1 (conflit entre appareils → P3), pas touché ici ; le parcours Q reprend, comme avant, un devis d'un autre client. | probable (vu une fois, non isolé) |
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

Total : **57 contrôles, 46 rouges sur `main`, 57 verts après** (**56 contrôles au commit « tests d'abord » `ba1da71`** ; le 57e, « T1 l'ouverture ne change rien au devis enregistré », a été ajouté avec la correction — résultats bruts gardés dans le dossier de la session : `resAD-rouge-main.json`, `resAD-vert.json` ; en CI, dans l'artefact du commit « tests d'abord », suite AD en échec).

**Un test existant change d'attendu, à cause de la décision 1** : `suiteI-emission.mjs`, I3b « devis modifié à l'écran puis facturé » attendait « modification enregistrée ET facture émise » sur un devis **accepté**. Avec D0, la modification d'un devis accepté n'est plus enregistrée ; la facture doit être émise quand même. Le contrôle devient « modification NON enregistrée (AF1 D0, lecture seule) ET facture émise ». La première batterie l'a trouvé **rouge** (la facture n'était même plus émise : `avantFacture` s'arrêtait sur le refus d'enregistrement) → correction dans `next-devis2.js` (un devis verrouillé se facture d'après sa copie enregistrée) → suite I 40/40.

**Un second test existant change de jeu de données, même cause** : `suiteQ-recette.mjs`, parcours « Devis ouvert pendant une mise à jour » ouvrait un devis **accepté** et tapait un titre de lot : champ désormais désactivé (lecture seule) → le parcours s'interrompait (délai de saisie dépassé) et laissait le PC dans l'éditeur, ce qui faisait aussi échouer le parcours suivant (« Client ajouté puis supprimé »). Le parcours prend maintenant un devis au nouveau format **encore modifiable** (envoyé ou brouillon, non facturé) ; son objet (saisie pendant une mise à jour) est inchangé. `tests/isolation/rapport.mjs` : la suite AD est ajoutée à la liste des étapes du rapport (sinon elle tournait sans figurer dans `rapport.md`).

Deux ajustements de la suite AD après la correction, tous deux dus à mes propres changements, pas à un relâchement : le sélecteur du bouton « 🧪 Fiche fluide » (son `onclick` commence maintenant par `formToDep();`) et la copie de référence de T1/T2/T3 prise **après** l'ouverture (constat 2.9 : des couches existantes ajoutent des champs par défaut à l'ouverture ; T1 vérifie que ce sont **seulement** ceux-là).

## 6. Batterie complète et CI

**Batterie complète locale** (`bash ~/climpilot-pg.sh && source ~/.climpilot-env.sh`, puis `bash tests/run-all.sh`, isolation du noyau `unshare -n`, PostgreSQL 16 local, validateurs CEN et FNFE, Chromium 141 / Playwright 1.56.1) :

| Passage | Commit | Verdict |
|---|---|---|
| 1er, code corrigé | `a789cbd` (arbre identique) | **ÉCHEC** — 1 283 réussis, 3 échoués : suite I (I3b : devis accepté modifié puis facturé) et suite Q (2 : parcours « devis ouvert pendant une mise à jour » interrompu sur un devis accepté, puis « client ajouté puis supprimé » par ricochet). Causes et corrections au § 5. Suite AD 57/57 mais absente du rapport (liste des étapes de `rapport.mjs`). |
| suite I seule | après correction | 40/40 |
| suite Q seule | 1er ajustement (devis de Dupré) | 63/64 — note du téléphone perdue (constat 2.10) |
| suite Q seule | 2e ajustement (autre client) | 64/64 |
| **final, complet** | **`1f677d4`** (arbre propre) | **COMPLET, RÉUSSI — 1 343 réussis, 0 échoué, 0 SKIP, 5 non bloquants « À TRANCHER » (suite Y, références « assujetti » en attente de la comptable : identiques à avant, jamais comptés comme réussis)**. Suite AD 57/57, suite I 40/40, suite Q 64/64, suite W (enveloppes) 64/64 (aucune enveloppe nouvelle), suite Y 21 + 5 À TRANCHER, suite Z 55/55 (golden calculs identiques), SQL 66/66, aperçu 11/11. Isolation : 0 connexion externe établie. |

**CI GitHub** (`.github/workflows/tests.yml`, « batterie complète ») :
- `1f677d4` (dernier commit de code et de tests) : **verte** sur le push ([run 56](https://github.com/gablry8/cp-gl2607/actions/runs/41673860449)) et sur la demande de fusion ([run 57](https://github.com/gablry8/cp-gl2607/actions/runs/41673875613)).
- Les CI des commits précédents de la branche (`ba1da71` tests seuls, `a789cbd`, `0da97c9`) ont été **annulées** par les pushs suivants (`concurrency: cancel-in-progress` du dépôt) : la preuve « rouge d'abord » est donc **locale** (§ 5 : 46 contrôles rouges sur `main` dans Chromium, résultats bruts gardés dans le dossier de la session), pas une CI rouge archivée. Pour la rejouer : `git checkout ba1da71 -- tests/suiteAD-af1-pertes.mjs` sur `main`, puis `node tests/suiteAD-af1-pertes.mjs`.

## 7. Ce que Gabriel verra changer à l'écran

- **Devis** : un devis accepté, signé ou facturé s'ouvre avec un bandeau jaune 🔒 « Devis … accepté le … : il ne se modifie plus » et trois boutons **Faire un avenant** / **Dupliquer** / **Annuler le devis** (AF1-bis) ; les champs sont gris ; « Enregistrer » et « Signature » disparaissent **en haut et dans le récapitulatif** (« 💾 Enregistrer le devis », « ✍️ Faire signer en ligne » : AF1-bis) ; la facturation reste là (récapitulatif). Le statut ne se change plus sur ces devis dans l'éditeur (la liste, elle, ne proposait déjà que « Facturer » pour un devis accepté : rien n'y change). Il ne passe plus « Refusé » et ne se supprime pas (message « ⛔ … il ne se supprime pas ») : la seule issue est **« Annuler le devis »** (AF1-bis) — motif obligatoire (abandon du client, rétractation dans les 14 jours, erreur de saisie, autre), refusé tant qu'une facture vivante existe (« fais d'abord un avoir »). Un devis annulé reste dans « Tous les devis » avec l'étiquette grise **Annulé**, s'ouvre en lecture seule (bandeau « annulé le … (motif) », bouton **Dupliquer** seulement), son PDF porte un bandeau rouge **DEVIS ANNULÉ le … — Motif : …**, il ne compte plus dans « Acceptés », le CA signé, « À commander », « Planifier » ni le carnet de commandes, et ne se facture plus.
- **Avenant** : « Faire un avenant » est **refusé** si une facture (acompte ou solde) est émise sur le devis : « Une facture est déjà émise sur ce devis : fais d'abord un avoir, ou facture le supplément sur un nouveau devis » (AF1-bis). Sinon : un nouveau devis brouillon, même contenu, **numéro de duplication** (`DV-AAAAMMJJ-xxxx`, celui que donne « Dupliquer » — pas un « numéro suivant »), notes commençant par « Avenant au devis n° … », bandeau « ↪ Avenant du devis n° … » ; le mode de conclusion du contrat est à préciser à nouveau. **Quand l'avenant passe en « Accepté »** (éditeur, ancien formulaire, bouton « Accepté » de la liste, signature en ligne), l'original passe automatiquement **« Remplacé »** (étiquette grise ; bandeau « remplacé par l'avenant n° … » ; date d'acceptation gardée) : il sort de la facturation, d'« À commander », de « Planifier » et du carnet de commandes, reste visible et non supprimable (« Dupliquer » seulement). Si l'original a été **facturé entre-temps** (autre appareil, ou depuis la liste), l'acceptation de l'avenant est **refusée** : « Le devis d'origine … a été facturé entre-temps : l'avenant … ne peut pas être accepté. Fais d'abord un avoir … ». Il n'existe donc jamais une facture vivante à la fois sur l'original et sur son avenant.
- **Dupliquer** ouvre la copie dans l'éditeur (avant AF1, elle restait dans la liste sans s'ouvrir) ; la copie n'est jamais un avenant, ni remplacée, ni annulée (champs retirés à la duplication).
- **Fluides & Cerfa** : plus de 🗑 sur les fiches numérotées de moins de 5 ans ; un bouton ⛔ « Annuler la fiche » (motif demandé) ; une fiche annulée reste dans la liste, grisée, étiquette rouge ANNULÉE ; son PDF porte le bandeau ; les quantités chargées / récupérées ne la comptent plus (« dont N annulée(s) »). Une fiche signée s'ouvre avec 🔒 : tout est gris, pas de bouton Enregistrer, bandeau « signée par … le … ».
- **Fiche fluide** : trois champs de plus (adresse, code postal et ville, SIRET du détenteur), remplis tout seuls depuis l'intervention ou le devis ouvert, ou la fiche client ; sans adresse, « Faire signer le détenteur » répond « Adresse du détenteur manquante ».
- **Paramètres** : si tu changes une valeur puis cliques ailleurs dans le menu, une question : « **OK = enregistrer · Annuler = PERDRE les modifications** » (texte corrigé par AF1-bis). Sur téléphone, la barre « Enregistrer » reste collée en bas.
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

AF1 : `index.html` (D0, D2, D3, D5, D6, A-N5), `next-devis2.js` (D0, éditeur v2, facturation d'un devis verrouillé), `tests/suiteI-emission.mjs` (attendu I3b aligné sur la décision 1), `tests/suiteQ-recette.mjs` (parcours « devis ouvert pendant une mise à jour » sur un devis modifiable), `tests/isolation/rapport.mjs` (suite AD dans le rapport), `next-fiabilite.js` (D0, suppression), `next-addons.js` (D2, corbeille), `next-cerfa.js` (D5, D6, PDF), `next-flu-guide.js` (D6), `next-flubilan.js` (D2, bilan), `next-signature.js` (D5, envoi), `next-particuliers.js` (C-N1), `sw.js` (cache 1133), `tests/suiteAD-af1-pertes.mjs` (nouvelle), `tests/run-all.sh`, `tests/LISEZMOI.md`, `docs/AF1-COMPTE-RENDU.md`, `docs/APRES-PRO-V1.md` (3 idées datées 03/11).

AF1-bis (`git diff --stat 9fcf2cf 22ca108`, code et tests : 8 fichiers, +135 / −28 ; puis les documents) : `index.html` (verrou : états « remplacé » / « annulé » ; `cpFactureVivante`, `cpAvenantOriginal`, `cpAvenantAcceptable`, `cpAvenantAccepte`, `cpVerrouBoutons`, `cpDevisAnnuler`, `cpDevisAnnulerOk`, `cpDevisBandeauPdf` ; `cpDevisAvenant` refusé si facture ; `cpVerrouWizard` cache les boutons de signature et d'enregistrement du récapitulatif ; `saveDevis` ; `facturerDevis` ; PDF ; `cpNomCle` / `cpDetenteurCoord` ; texte de `cpParamsGarde` ; `statusTag` ; CSS des étiquettes), `next-devis2.js` (`saveV2`, `nxd2.statut`, en-tête et bandeau, PDF v2, `OWNED`), `next-statut.js` (`nxSetStatut`, libellés), `next-signature.js` (`nxsSendDevis`, `applySig`), `next-emission.js` (refus de facturer un devis remplacé ou annulé), `next-fiabilite.js` (`RESET` de la duplication), `next-addons.js` (libellés du registre des documents), `tests/suiteAD-af1-pertes.mjs` (T14 à T17, T9), `tests/suiteI-emission.mjs` (I3d), `tests/LISEZMOI.md`, `docs/AF1-COMPTE-RENDU.md`, `docs/APRES-PRO-V1.md`. `sw.js` inchangé (1133, déjà incrémenté sur cette branche).

## 10. Ce qui n'a pas pu être vérifié

- **iPhone / Safari réels** : rien ici (Chromium émulant un iPhone 13 pour les tests « téléphone »). La barre fixée en bas et la question en quittant Paramètres sont à regarder sur ton téléphone (parcours 4.3).
- **Fermeture réelle de l'onglet** avec des Paramètres modifiés : le test vérifie que le navigateur est prié de retenir la fermeture (`beforeunload` empêché) ; l'affichage de la boîte du navigateur dépend de l'appareil (Safari iOS ne la montre pas toujours).
- **Synchronisation entre appareils** d'un devis verrouillé, remplacé ou annulé, ou d'une fiche annulée : non testée ici au-delà de la suite Q existante (qui a tourné dans la batterie) ; la règle se lit sur la copie enregistrée, donc une fiche signée sur le téléphone est verrouillée sur le PC dès la synchro (probable). **Le verrou n'existe que sur l'appareil** qui a la copie à jour : après la fusion, **F5 sur tous les appareils le même jour**, et **ne pas modifier un devis sur un appareil hors ligne** ou pas encore rechargé ; **une version modifiée sur un appareil pas à jour peut gagner à la fusion** (défaut de synchro connu, constat 2.10, famille D1 → P3 ; noté dans `docs/APRES-PRO-V1.md`).
- **Impression PDF réelle** (rendu du bandeau ANNULÉE et du cadre Détenteur dans la boîte d'impression) : HTML vérifié, pas le PDF.
- **Signature en ligne réelle** d'une fiche fluide (serveur) : le refus sans adresse est testé ; l'envoi réel avec adresse ne change pas (même `createLink`).
- Le **journal** (`cpnext_journal`) n'a pas d'écran : vérifié seulement dans le stockage.

## 11. AF1-bis — corrections après relecture (03/11/2026, soir)

Relecture indépendante (Opus, 03/11) de la branche à `9fcf2cf`. Gabriel a décidé une **exception au gel limitée à 8 points** ; le point 4 est un test, les points 7 et 8 des documents. Règles d'AF1 inchangées : tests d'abord (rouges sur `9fcf2cf`, puis verts), golden Y et Z identiques, 5 « À TRANCHER » inchangés, aucun montant ne change, `sw.js` reste à 1133, aucun secret, rien sur Supabase, `git merge origin/main` d'abord (déjà à jour : `main` = `1e33a67`).

### 11.1 Constats de la relecture (vérifiés ici)

| # | Constat | Certitude |
|---|---|---|
| R1 **BLOQUANT** | Après « Faire un avenant », l'original restait « accepté » : une facture sur l'original **et** une sur l'avenant, même montant ; solde de l'avenant sans déduction de l'acompte de l'original ; « À commander » (`next-commande.js`, `renderCommander`) et « Planifier » (`nxAutoTasks`, `renderPlanning`) comptaient les deux. | certain (T14b rouge : `accApres = accAvant + 1`, `fac:true`) |
| R2 | Un devis accepté n'avait plus aucune issue : ni « Refusé », ni suppression (AF1), ni annulation. | certain (noté en AF1 § 4.4, idée dans APRES-PRO-V1) |
| R3 | Ancien formulaire, devis accepté : `cpVerrouWizard` ne cachait que le « Enregistrer » de l'en-tête ; « ✍️ Signature » (`#nxsBtnTop`), « ✍️ Faire signer en ligne » (`#nxsBtn`) et « 💾 Enregistrer le devis » du récapitulatif restaient actifs ; `nxsSendDevis` (`next-signature.js`) faisait `formToDevis()` puis `DEVIS[i]=cur` sans refus ni journal. | certain (T16 rouge : `identique:false`, notes modifiées enregistrées) |
| R4 | I3b (suite I) avait été inversé sans remplacer le cas qui existe encore : devis **envoyé** dans le stockage, passé « Accepté » à l'écran sans enregistrer, puis modifié → « Facturer » doit enregistrer avant d'émettre. | certain (I3d écrit : **vert d'emblée**, `avantFacture` enregistrait déjà ce cas) |
| R5 | Question des Paramètres : « Abandonner » ne disait pas clairement que les modifications sont perdues. | certain |
| R6 | `cpDetenteurCoord` comparait les noms en minuscules sans normaliser l'apostrophe : « L’Atelier du Froid » (’ du clavier iPhone) ne trouvait pas la fiche « L'Atelier du Froid ». | certain (T17 rouge : `adr:""`) |
| R7, R8 | Compte rendu (§ 7 : bouton du récapitulatif, issue d'un devis accepté, effets de l'avenant, « Dupliquer » ouvre la copie, numéro de l'avenant = numéro de duplication) et § 10 (verrou local, F5 le même jour, défaut de synchro) ; `docs/FILE-DES-MISSIONS.md`. | — |

### 11.2 Règles décidées par Gabriel et code

- **Avenant (R1)** — `index.html` : `cpFactureVivante(d)` (= `facAcompte` ou `facSolde` présents ; une facture annulée par avoir n'est pas vivante). a) `cpDevisAvenant` refuse si l'original porte une facture vivante : « ⛔ Une facture est déjà émise sur ce devis (…) : fais d'abord un avoir, ou facture le supplément sur un nouveau devis. » (journal `avenant_refuse`). b) `cpAvenantAccepte(avenant)` : l'original passe `statut:'remplace'`, `remplacePar:{id,num,at}`, `acceptedAt` **gardé** ; journal `devis_remplace` ; appelé après chaque enregistrement d'un avenant « accepté » (`saveDevis`, `saveV2`), après le bouton « Accepté » de la liste (`nxSetStatut`) et après une signature en ligne (`applySig`). Tout ce qui compte les chantiers signés lit `statut==='accepte'` (facturation `renderFBloc`, `renderCommander`, `nxBonCommande`, `renderPlanning`, `nxAutoTasks`, `nxobjCarnet`, tableau de bord, activité, journée, planning) : l'original en sort de lui-même ; `cpDevisVerrou` le verrouille (texte « remplacé par l'avenant n° … ») donc il ne se modifie pas et ne se supprime pas ; `facturerDevis` et `next-emission.js` refusent de le facturer (« il ne se facture plus »), `nxSetStatut` refuse de changer son statut. c) `cpAvenantAcceptable(avenant)` : si l'original a une facture vivante, l'acceptation est refusée **avant** tout enregistrement — `nxd2.statut('accepte')`, `saveV2`, `saveDevis`, `nxSetStatut` : « ⛔ Le devis d'origine … a été facturé entre-temps : l'avenant … ne peut pas être accepté. Fais d'abord un avoir sur cette facture (ou facture le supplément sur un nouveau devis). » ; signature en ligne : la preuve est **gardée** dans `signatureEnAttente`, le statut n'avance pas, message clair ; dès que l'avenant est accepté (après l'avoir), `cpAvenantAccepte` pose la signature.
- **« Annuler le devis » (R2)** — `cpDevisAnnuler(id)` : refus si facture vivante (« ⛔ Une facture est émise sur ce devis (…) : fais d'abord un avoir, puis annule le devis. », journal), sinon fenêtre `#mAnnulDevis` (4 motifs à cocher, précision libre obligatoire pour « Autre ») ; `cpDevisAnnulerOk()` : sans motif → « Motif obligatoire : devis non annulé », rien ne change ; sinon `statut:'annule'`, `annulation:{at,motif,libelle,texte,statutAvant}`, journal `devis_annule`, message. Même mécanique que l'original remplacé pour sortir de tout ; `cpDevisBandeauPdf` ajoute le bandeau rouge « DEVIS ANNULÉ le … — Motif : … » dans les PDF des deux formulaires (vide pour tout autre état : golden Y identiques). Le bouton apparaît dans le bandeau 🔒 d'un devis accepté, signé ou facturé (facturé : le clic répond « fais d'abord un avoir »).
- **Verrou de l'ancien formulaire (R3)** — `nxsSendDevis` : contrôle `cpDevisVerrouille(cur.id)` en tête, refus « 🔒 Devis … : il ne se renvoie pas en signature (fais un avenant). », journal `devis_verrouille / signature` ; `cpVerrouWizard` cache `#nxsBtnTop`, `#nxsBtn` et le « 💾 Enregistrer le devis » du récapitulatif (`.navbtns`), et les remet sur un devis modifiable.
- **Suite I (R4)** — I3d ajouté ; **vert d'emblée** (la couche `avantFacture` de `next-devis2.js` enregistre déjà un devis non verrouillé avant la facture ; le statut à l'écran fait foi, pas de question « pas accepté »).
- **Paramètres (R5)** — texte : « Paramètres modifiés et non enregistrés. OK = enregistrer · Annuler = PERDRE les modifications » ; T9 attend ce texte (PC et téléphone).
- **Apostrophe (R6)** — `cpNomCle(s)` : minuscules, espaces retirés aux bouts, `’ ‘ ʼ \` ´` → `'` ; utilisée pour le nom cherché, l'intervention ouverte, le devis ouvert et la fiche client. Seule cette recherche change (les autres comparaisons de noms sont hors périmètre).
- **Duplication** — `next-fiabilite.js` (`RESET`) retire aussi `avenantDe`, `remplacePar`, `annulation`, `signatureEnAttente` : une copie n'est jamais l'avenant d'un autre devis (sinon l'accepter aurait « remplacé » l'original), ni remplacée, ni annulée. `cpDevisAvenant` pose `avenantDe` après la duplication, comme avant.
- Libellés « Remplacé » / « Annulé » : `statusTag` (index.html), `next-statut.js`, registre des documents (`next-addons.js`) ; étiquette grise (CSS `.tag.remplace, .tag.annule`).

### 11.3 Tests : rouges sur `9fcf2cf`, verts sur `22ca108` (suite AD : 56 → 74 contrôles ; suite I : 40 → 43)

| Test | Contrôles | Sur `9fcf2cf` | Après |
|---|---|---|---|
| T14a original avec facture vivante → « Faire un avenant » refusé | 1 | rouge (avenant créé) | vert |
| T14b avenant accepté dans l'éditeur → original « remplacé » (mémoire, stockage, date gardée, lien) ; hors À commander / Planifier / carnet ; facturation refusée, bloc vide, journal ; visible, « Dupliquer » seulement, non supprimable | 4 | 4 rouges | verts |
| T14c original facturé entre-temps → « Accepté » refusé depuis la liste, puis depuis l'éditeur | 2 | 2 rouges | verts |
| T14d ancien formulaire : avenant accepté → original remplacé, bandeau, bloc facturation vide | 1 | rouge | vert |
| T15a facture vivante → « Annuler le devis » refusé ; T15b devis signé : bouton présent, motif obligatoire, annulé (motif, date, signature gardée) ; hors de tout ; visible, PDF ANNULÉ, journal, non supprimable ; T15c après avoir total : possible, ancien formulaire | 5 | 5 rouges (`cpDevisAnnuler` absent) | verts |
| T16 boutons cachés ; `nxsSendDevis` refusé ; témoin brouillon | 3 | 2 rouges + témoin vert | verts |
| T17 apostrophe ’ | 1 | rouge | vert |
| T9 texte de la question (PC, téléphone) | 2 | 2 rouges (ancien texte) | verts |
| I3d (suite I) | 3 | **verts d'emblée** | verts |

Journal des rouges : `resAD-bis-rouge-9fcf2cf.log` dans le dossier de la session (18 FAIL, 56 PASS : 16 contrôles nouveaux rouges, 2 contrôles T9 à l'attendu changé rouges, 1 témoin nouveau vert). Un ajustement de test après la correction, dû au test : T14b et T15b comparaient le carnet de commandes au nombre de devis acceptés, alors que le carnet ne compte que les acceptés **pas encore facturés au solde** (règle existante de `next-objectifs.js`) ; l'attendu est maintenant calculé avec cette règle.

### 11.4 Interprétations à valider (hypothèses AF1-bis)

1. **Signature en ligne d'un avenant dont l'original a été facturé entre-temps** : la preuve de signature est gardée (`signatureEnAttente`), le statut n'avance pas, message « fais d'abord un avoir, puis passe l'avenant en « Accepté » (la signature est conservée) » ; l'acceptation manuelle après l'avoir pose la signature et la date. Alternative possible : accepter quand même et bloquer seulement la facturation — non retenue, parce que la règle c) dit « l'acceptation est refusée ».
2. **Motifs d'annulation** : 4 choix (abandon du client, rétractation dans les 14 jours, erreur de saisie, autre + précision obligatoire) ; le motif et la date sont imprimés sur le PDF (bandeau) et notés au journal. La rétractation ne déclenche rien de plus (pas de calcul de délai).
3. **Un devis annulé ou remplacé ne se facture plus**, même si l'on force (« Facturer » depuis une couche) ; ses factures **annulées par avoir** restent au registre des factures (inchangé) mais le bloc facturation du devis est vide.
4. **Avenant d'un devis remplacé ou annulé** : refusé (« fais l'avenant depuis l'avenant » / « duplique-le »).
5. **Original déjà annulé** quand l'avenant est accepté : il reste « annulé » (pas « remplacé »).
6. **Statut d'un devis remplacé ou annulé** : ne change plus jamais (ni « Rouvrir » ni « Refusé »). Pour reprendre un devis annulé par erreur : « Dupliquer ».
7. **Deux avenants du même original** (tous deux créés pendant que l'original était encore « accepté » ; impossible ensuite, « Faire un avenant » étant refusé sur un devis remplacé) : le second avenant accepté remplace aussi l'original (`remplacePar` pointe vers lui) ; le premier avenant reste « accepté » et facturable. C'est à Gabriel de l'annuler (« Annuler le devis », motif « erreur de saisie »). Cas non testé, non rencontré (hypothèse, relecture du 04/11).

### 11.5 Batterie complète et CI (AF1-bis)

Même environnement qu'AF1 (§ 6 : `unshare -n`, PostgreSQL 16 local, validateurs CEN et FNFE, Chromium 141 / Playwright 1.56.1).

| Passage | Commit | Verdict |
|---|---|---|
| 1er, complet | `22ca108` (arbre : documents en cours d'écriture) | **ÉCHEC** — 1 355 réussis, 0 échoué, 0 SKIP, 5 « À TRANCHER » inchangés ; **suite X (mise à jour) plantée sans résultat** : `page.reload` hors ligne > 30 s (`suiteX-mise-a-jour.mjs` l. 84, service worker « réseau d'abord, 2,5 s » sous charge, juste après la suite W de 124 s). Toutes les autres étapes vertes : suite AD 74/74, suite I 43/43, suite Q 64/64, suite W 64/64 (aucune enveloppe nouvelle), suite Y 21 + 5 À TRANCHER, suite Z 55/55, SQL 66/66, aperçu 11/11. |
| suite X seule | `22ca108` | **8/8** en 15 s (cache 1133, 58 fichiers, hors ligne OK) : le plantage n'est pas lié au code (`sw.js` et la liste des fichiers n'ont pas changé ; les fichiers modifiés sont servis depuis le cache). |
| **2e, complet** | **`2fcb96d`** (arbre propre : code `22ca108` + documents) | **COMPLET, RÉUSSI — 1 363 réussis, 0 échoué, 0 SKIP, 5 non bloquants « À TRANCHER »** (suite Y, références « assujetti » en attente de la comptable : identiques à avant, jamais comptés comme réussis). Suite AD 74/74, suite I 43/43, suite Q 64/64 (466 s), suite W 64/64, suite X 8/8, suite Y 21 + 5 À TRANCHER, suite Z 55/55 (golden calculs identiques), SQL 66/66, aperçu 11/11. Isolation : 0 connexion externe établie. 1 343 (AF1) + 17 (suite AD : 57 → 74) + 3 (suite I : 40 → 43) = 1 363. |

**CI GitHub** (`.github/workflows/tests.yml`, « batterie complète ») : `1c9abf9` (code `22ca108` + documents) **verte** sur le push ([run 60](https://github.com/gablry8/cp-gl2607/actions/runs/41720779943), 21 min) et sur la demande de fusion #9 ([run 61](https://github.com/gablry8/cp-gl2607/actions/runs/41720785457)). La CI du commit « tests d'abord » `f6ed6a7` n'a pas tourné à part (poussé en même temps que le code) : la preuve « rouge d'abord » est locale (§ 11.3, journal gardé) ; pour la rejouer : `git checkout f6ed6a7 -- tests/suiteAD-af1-pertes.mjs` sur `9fcf2cf`, puis `node tests/suiteAD-af1-pertes.mjs`. Le commit qui inscrit ces lignes ne touche que ce document : sa CI relance la même batterie.

### 11.6 Deux parcours de plus pour l'essai de Gabriel (≈ 6 min, copie d'essai)

**Parcours 7 — avenant (≈ 4 min)**
1. Ouvre un devis « Accepté » sans facture, clique **Faire un avenant**. **Attendu** : l'avenant s'ouvre (brouillon). Dans « Tous les devis », l'original est toujours « Accepté ».
2. Dans l'avenant, passe le statut à « Accepté » puis **Enregistrer**. **Attendu** : message « Devis … remplacé par l'avenant … », l'original porte l'étiquette grise **Remplacé** ; « À commander » et « Planifier » ne comptent plus que l'avenant ; ouvre l'original : bandeau « remplacé par l'avenant n° … », pas de bloc facturation, bouton **Dupliquer** seul.
3. Sur un devis « Accepté » **facturé** (acompte d'essai) : **Faire un avenant**. **Attendu** : « ⛔ Une facture est déjà émise sur ce devis : fais d'abord un avoir, ou facture le supplément sur un nouveau devis. »

**Parcours 8 — annuler un devis (≈ 2 min)**
1. Ouvre un devis « Accepté » sans facture : **Annuler le devis**, laisse le motif vide, valide. **Attendu** : « Motif obligatoire : devis non annulé », rien ne change.
2. Coche « Abandon du client », valide. **Attendu** : étiquette **Annulé** dans la liste, compteur « Acceptés » du tableau de bord diminué de 1, bandeau « annulé le … (Abandon du client) », PDF avec le bandeau rouge **DEVIS ANNULÉ**. 🗑 → « il ne se supprime pas ».
3. Sur un devis facturé : **Annuler le devis**. **Attendu** : « fais d'abord un avoir, puis annule le devis ».

### 11.7 Hors périmètre, noté dans `docs/APRES-PRO-V1.md` (03/11)

Écran du journal ; rappel « refais la fiche » après l'annulation d'une fiche fluide ; message quand le téléphone d'un devis diffère de la fiche client ; défaut de synchro D1 (P3).

### 11.9 Relecture du 04/11 (seconde session AF1-bis) : tout rejoué ici, rien de nouveau dans le code

Le code et les tests d'AF1-bis (`f6ed6a7`, `22ca108`) ont été relus point par point contre les 8 règles de Gabriel : rien à corriger. Les commits du 04/11 ne touchent que ce document. `git merge origin/main` : rien à intégrer (`main` = `1e33a67`, déjà contenue).

| Vérification | Résultat |
|---|---|
| Preuve « rouge d'abord » rejouée : arbre `9fcf2cf` + tests de `f6ed6a7` (`tests/suiteAD-af1-pertes.mjs`, `tests/suiteI-emission.mjs`), `CP_SUITES="suiteAD-af1-pertes suiteI-emission"` | suite AD **56 réussis / 18 échoués** (T9 ×2, T14 ×8, T15 ×5, T16 ×2, T17 ×1 : exactement le § 11.3) ; suite I **43/43** (I3d vert d'emblée, comme écrit) ; journal `resAD-bis-rouge-9fcf2cf-04-11.log` gardé dans le dossier de la session |
| Batterie complète locale sur `e01a905` (arbre propre ; même environnement qu'au § 6 : `unshare -n`, PostgreSQL 16.15, validateurs CEN `validation-1.3.16` et FNFE `v1.4.0.04`, Chromium 141 / Playwright 1.56.1) | **1 362 réussis, 1 échoué, 0 SKIP, 5 « À TRANCHER » inchangés** ; suite AD 74/74, suite I 43/43, suite W 64/64, suite X 8/8, suite Y 21 + 5, suite Z 55/55 (golden identiques), SQL 66/66, aperçu 11/11 ; 0 connexion externe. Le seul échec : suite Q, contrôle Q10 « voile pendant le rechargement qui suit une mise à jour » — `voile:false`, données finales justes (`apresA: pc:true, srv:true`) : le voile n'est pas apparu dans la fenêtre de 6 s, cas de temps déjà décrit dans le test (P0, 21/10 : « sur une machine chargée le voile arrivait après la fenêtre ; les données étaient bien conservées »). Aucune donnée perdue. |
| Suite Q rejouée seule sur le même arbre | en cours au moment de ce commit : résultat porté au commit suivant |
| CI GitHub de `18da052` (document seul, 03/11 au soir) | push ([run 62](https://github.com/gablry8/cp-gl2607/actions/runs/41724889387)) **verte** ; demande de fusion ([run 63](https://github.com/gablry8/cp-gl2607/actions/runs/41724900568)) **rouge sans qu'aucun test ait tourné** : `npm i -g playwright` coupé par un délai d'attente du registre npm (`EIDLETIMEOUT`, 5 min), incident de l'infrastructure. Relancé le 04/11 (2e tentative), puis annulé automatiquement par le run 65 (même groupe de concurrence, même code). |
| CI GitHub des commits « document seul » du 04/11 | en cours au moment de ce commit : résultat porté au commit suivant |

Le défaut constaté par la relecture sur l'énoncé : **PR #8 n'est pas fusionnée** (§ 11.8), donc `docs/FILE-DES-MISSIONS.md` reste à coller par Gabriel après #8.

### 11.8 `docs/FILE-DES-MISSIONS.md` — à coller par Gabriel après la fusion de PR #8

Le fichier n'existe **que** sur `outillage/claude-code` (PR #8, **ouverte, brouillon** au moment d'AF1-bis **et encore le 04/11** d'après GitHub — `main` est à `1e33a67`, PR #7 ; l'énoncé du 04/11 disait #8 fusionnée : non). Le créer ici produirait un conflit d'ajout à la fusion de #8. Lignes prêtes :

| # | Mission | Branche | État | Prochain geste | Qui |
|---|---|---|---|---|---|
| 3 | P6+ : environnement Super PDP, droits du visiteur non connecté | `correctif/p6-env-superpdp` | **fusionnée le 03/11** (PR #7, `1e33a67`) ; branche contenue dans `main` | script `6-REEL-*` ; déploiement de `superpdp` ; supprimer la branche | Gab |
| 4 | OUTILLAGE : CLAUDE.md, règles bloquantes, cette file | `outillage/claude-code` | PR #8 (fusion à confirmer par Gab : encore ouverte le 04/11) ; `main` protégée | relecture P10, fusion | Gab |
| 5 | AF1 + AF1-bis : zéro perte de données (+ C-N1, A-N5 ; avenant / original, « Annuler le devis ») | `correctif/af1-pertes-donnees` | **fait le 03/11**, PR #9 en brouillon, batterie et CI vertes (`docs/AF1-COMPTE-RENDU.md`) | décisions 1 à 2 du compte rendu, essai § 8 et § 11.6, relecture, fusion | Gab |

Demandes de fusion : 7 fusionnée le 03/11 (`1e33a67`) ; 8 ouverte (brouillon, encore le 04/11) ; 9 ouverte (brouillon, AF1 + AF1-bis). Branches : `correctif/p6-env-superpdp` et `correctif/c3-article-absent` contenues dans `main`.
