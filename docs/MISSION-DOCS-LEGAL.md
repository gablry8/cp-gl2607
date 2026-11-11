# ClimPilot — Mission DOCS-LEGAL : les documents de ClimPilot face aux textes officiels — dossier (documents seulement)

> Rédigé le 11/11/2026 par Claude (session Claude Code, mission DOCS-LEGAL) pour Gab, à sa demande du 11/11/2026 : « que tous les documents soient 100 % légaux, vérifie ». **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-docs-legal`, partie de `main` = `6457329`.
> **Ce que ce dossier promet** : un contrôle document par document contre les textes officiels lisibles le 11/11/2026, avec la source et sa date, et la liste de ce qu'un professionnel doit valider. **Il n'écrit nulle part « 100 % légal »** : personne ne peut le garantir sans la validation de l'expert-comptable et du juriste de la chambre de métiers (§ 6).
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project (ni le plan du 28/10, ni la recherche fluides du 25/10, ni le dossier FACT, ni le mail préparé pour la comptable). La copie `claude/ClimPilot-DOCS-LEGAL-dossier.md` reste à faire.
> **Sources** : lues le 11/11/2026 depuis la session. Le réseau de l'environnement a été ouvert ce jour-là, avec ton accord, à 10 sites officiels. **Légifrance et economie.gouv.fr ont répondu « 403 » (refus du site)**, le site des formulaires Cerfa a coupé la connexion, urssaf.fr n'a pas répondu : **aucun article de code n'a donc été relu sur Légifrance**. Les articles cités viennent des fiches service-public et BOFiP qui les citent ; leur texte exact reste « à vérifier » (§ 7). Liste des sources et de leurs dates : § 8.
> **Code** : relu sur `main` (`6457329`) par nom de fonction (quatre relevés en lecture seule, puis les citations clés revérifiées une à une dans le code). Les numéros de ligne bougeront avec S, COMPTE, P11, AF1-B, AF2 : retrouver tout par le **nom des fonctions**. Rien n'a été exécuté (pas de rendu d'impression) ; rien contre Supabase.
> Certitude : **certain** (lu dans le code, ou lu dans la source officielle citée), **probable** (déduit), **hypothèse**. Verdicts : **conforme** · **non conforme** · **à faire valider** (le texte laisse un doute, ou n'a pas pu être lu).

## Ce que Gab décide / fait

1. **Personne ne peut écrire « 100 % légal »** : ce dossier dit ce qui est conforme, ce qui manque, et ce qu'un pro doit valider. Envoie le **§ 6.1 à ta comptable** et le **§ 6.2 au juriste de la CMA** (prêts à copier).
2. **9 points bloquants avant ton premier client** (§ 4.1). Les plus lourds : information **RGE** absente des devis de PAC/clim à un particulier (contrat **nul**, selon service-public) ; **attestation décennale** jamais jointe ; **contrat hors établissement** incomplet ; **aucune attestation d'entretien** des PAC/clim ; **fiche fluides** (décision 7, toujours ouverte).
3. **Tes gestes, sans code** : adhérer à un médiateur, obtenir l'attestation décennale, décider RGE ou non, noter ton numéro RNE. Puis remplir Paramètres.
4. **Mention de franchise 2027** : ClimPilot écrira « art. L. 233-3 du CIBS » ; impots.gouv.fr écrit tantôt **L. 233-3**, tantôt **L. 223-3**. « art. 293 B du CGI » reste admis jusqu'au **30/06/2028** (BOFiP). Ma proposition : garder 293 B jusqu'à la réponse de ta comptable (§ 6.1, question C1).
5. **Décide** (§ 4.4) : une nouvelle mission **DOCS-A** (devis et contrats, sans lien avec le statut) et, si tu l'acceptes malgré le gel, **DOCS-B** (attestation d'entretien, fonction nouvelle : exception écrite de ta part, règle 5).
6. Le reste s'accroche aux missions existantes : **AF3** (fiche fluides), **AF4** (factures), **TVA** et **FACT** (après ta décision de statut en décembre, § 5).
7. Chaque correction : test rouge d'abord, puis golden documents (suite Y) régénérés **avec ton accord** ; aucun montant ne change (golden Z identiques).
8. Les sites Légifrance et economie.gouv.fr n'ont pas pu être lus : les articles cités sont à relire (§ 7) avant toute correction.
9. Cette demande de fusion (un seul fichier, documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Inventaire : tout ce que ClimPilot imprime, envoie ou fait signer (sur `main`, `6457329`)

| # | Document | Fonction (fichier) | Pour qui | Où il part |
|---|---|---|---|---|
| D1 | Devis « nouveau format » | `printV2` via `window.printDevis` (`next-devis2.js`) ; blocs ajoutés par `next-signature.js`, `next-particuliers.js`, `next-documents.js` | client particulier ou pro | PDF imprimé ; page de signature |
| D2 | Devis « ancien formulaire » | `printDevis` (`index.html`) | idem | idem |
| D3 | Estimation indicative | `printV2` / `printDevis` avec `d.estim` | idem | PDF |
| D4 | Contrat d'entretien | **pas de document à part** : lot « entretien » imprimé dans le devis (`pdf()`, `next-mod-entretien.js`) ; l'objet contrat est créé par `syncContracts` | idem | dans le devis |
| D5 | Contrat d'intervention avant dépannage chez un particulier | `nxPartContratDep` (`next-particuliers.js`) | particulier | PDF à faire signer |
| D6 | Fiche de visite technique | `printVisite` (`next-devis2.js`) | interne | papier |
| D7 | Checklist départ chantier | `printChecklist` (`index.html`, enveloppe `next-devis2.js`) | interne | papier |
| D8 | Contrat de location (rafraîchisseurs adiabatiques) | `printContrat` (`index.html`) | client | PDF |
| D9 | PV de **mise en service** (pas de PV de réception) | `printPV` (`index.html`) | client | PDF |
| F1 | Facture d'intervention / dépannage / mise en service | `printFacture` (`index.html`) | client | PDF + XML |
| F2 | Facture d'acompte et facture de solde d'un devis | `printFactureDevis` (`index.html`), `facturerDevis` | client | PDF + XML |
| F3 | Facture de location | `printFactureLoc` (`index.html`) | client | PDF + XML |
| F4 | Facture de contrat d'entretien | `printFactureCtr` (`index.html`) | client | PDF + XML |
| F5 | Avoir | `printAvoir` (`next-avoir.js`) | client | PDF + XML |
| F6 | Ajouts à l'émission (filigrane démo, « exigible à partir du… », remplacement CIBS, duplicata) | `capturer`, `finir` (`next-emission.js`) ; `fixMention` (`next-einvoice.js`) ; `nxrgFixDoc` si assujetti (`next-regime.js`) | — | sur F1 à F5 |
| F7 | XML de facture (CII, EN 16931) | `next-einvoice.js` | plateforme | fichier XML, ZIP annuel |
| R1 | Fiche d'intervention fluides | `window.printFicheFlu` (`next-cerfa.js`, remplace celle de `index.html`) | détenteur | PDF ; page de signature |
| R2 | Déclaration annuelle des fluides (bilan) | `next-flubilan.js` | organisme agréé | PDF, CSV, texte |
| R3 | Registre fluides CSV | `exportCSVFlu` (`index.html`) | archive | CSV |
| S1 | Page de signature et exemplaire signé | `signer.html` + fonction serveur `signature` | signataire | page web, fichier HTML |
| M1 | Mail et SMS de signature | `mailText`, `smsText` (`next-signature.js`) | client | messagerie de Gab |
| M2 | Mail de devis, relance de devis, demande de prix, confirmation de location | `mailDevis`, `mailRelance`, `mailDemandePrix`, `mailLoc` (`index.html`) ; `next-statut.js` | client, fournisseur | messagerie |
| M3 | Messages veille de RDV, entretien, confirmation de créneau | `next-messages.js` | client | SMS ou mail |
| M4 | Demande d'avis | `next-avis.js` | client | SMS ou mail |
| M5 | Mail fournisseur (demande de prix chantier) | `next-fournisseur.js` | fournisseur | messagerie |
| M6 | Bon de commande fournisseur | `nxBonCommande` (`next-commande.js`) | fournisseur, interne | PDF (« non contractuel ») |
| X1 | Livre des recettes (écran, CSV, impression) | `exportCSVRecettes`, `printRecettes` (`index.html`) | comptable | CSV, PDF |
| X2 | Pack comptable : livre, facturier, synthèse, mail | `nxrgLivre`, `nxrgFacturier`, `nxrgSynthese`, `nxrgMailComptable` (`next-regime.js`) | comptable | CSV, PDF, mail |
| X3 | Exports devis et dépannages | `exportCSV`, `exportCSVDep` (`index.html`) | gestion | CSV |

Absents (certain, recherche dans tout le dépôt hors `tests/`) : **conditions générales de vente** (aucun texte) ; **attestation d'entretien** des PAC/clim de 4 à 70 kW (aucune occurrence de « attestation d'entretien », « R224 », « 4 kW », « 70 kW ») ; **PV de réception** des travaux ; **FEC** ; mention « autoliquidation » imprimée ; mention « RCS » ou « RNE ».

**Blocs communs** (certain, lus) :
- En-tête `docTop` (`index.html`) : nom, activité, adresse, téléphone, e-mail, « À {ville}, le {date} », « Page 1/1 ». Aucun SIREN/SIRET ni assurance dans l'en-tête.
- Pied `docLegal` (`index.html`) : nom (suffixe « EI » ajouté par `next-documents.js` si le statut est individuel ou vide), statut, capital, code NAF, adresse, téléphone, e-mail, « SIRET : … », « N° TVA : … », « Assurance pro : <assureur + n° contrat, texte libre> — couverture : <zone> », « Attestation de capacité fluides frigorigènes n° … », « RIB : … ». **Chaque ligne n'apparaît que si le champ est rempli dans Paramètres.**
- Mentions de facture `facMentions` (`index.html`) : « Nature de l'opération : … », « N° SIREN du client : … » (si saisi), « Adresse de livraison / de réalisation : … » (si différente), « Option pour le paiement de la taxe d'après les débits. » (si `E.tvaDebits` : **aucun réglage ne le permet**, certain).
- Champs de Paramètres présents : statut, nom de l'entrepreneur, capital, NAF, SIRET, TVA intracom., RIB, attestation fluides et organisme, médiateur (nom, site), assurance (assureur + contrat, couverture), notes de bas de devis et de facture, nature des chantiers (S / M / à confirmer), « assurance décennale obligatoire pour mes travaux de pose », régime TVA. **Absents** : RCS / RNE, SIREN seul (seul le SIRET), label RGE.

## 2. Les tableaux, document par document

Colonnes : **Règle** · **Texte officiel** (source du § 8, toutes lues le 11/11/2026 ; « art. » = article cité par cette source, texte non relu sur Légifrance) · **ClimPilot aujourd'hui** (texte exact, fonction) · **Verdict** · **Statut ?** (dépend du statut juridique ou du régime de TVA) · **Mission**.

### 2.1 Devis (D1, D2) — travaux et dépannage chez un particulier ou un pro

Le devis préalable est **obligatoire** pour le « génie climatique » (S3, arrêté du 24/01/2017 ; S2). Amende jusqu'à 3 000 € (EI) ou 15 000 € (société) sans devis (S2, S3).

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Date de rédaction | S2, S3 (arrêté 24/01/2017) | « À {ville}, le {date} » = **date d'impression** (`const today=new Date()`, `printDevis`, `printV2`), pas une date gardée dans le devis. Une réimpression change la date ; la validité « à compter de sa date d'émission » glisse avec | **non conforme** (probable : la date imprimée doit être celle du devis) | non | DOCS-A |
| Nom et adresse de l'entreprise ; « EI » ; SIREN | S2 ; S1 (« Entrepreneur individuel ou EI », Siren) ; code de commerce R526-27 cité par S1 | `docTop` + `docLegal` ; « EI » ajouté ; **SIRET** (le SIREN en est les 9 premiers chiffres), seulement s'il est saisi | **conforme** si Paramètres rempli ; SIRET au lieu de SIREN : **à faire valider** | oui (société : dénomination, forme, capital) | DOCS-A (contrôle « Paramètres incomplets » qui bloque) |
| Numéro RNE (artisan) | S13 (CGV : « numéro d'inscription au RCS ou au RNE ») ; S14 ; code de l'artisanat R132-1 cité par S2 | **absent** (aucun champ) | **non conforme** (probable) | non | DOCS-A |
| Nom du client ; lieu d'exécution | S2, S3 (« Lieu d'exécution de l'opération ») | client : nom, adresse, ville ; SIREN client (`printV2` seulement). **Aucune adresse de chantier distincte** | **non conforme** quand le chantier n'est pas au domicile du client | non | DOCS-A |
| Nature exacte de l'intervention ; décompte détaillé (quantité, prix unitaire, unité) | S2, S3 | libellé par ligne ; « qté unité × pu HT » sauf forfaits ; consommables en **une ligne** ; main-d'œuvre agrégée si `pdfDetailMO` est faux | **à faire valider** (une ligne « consommables » et une main-d'œuvre agrégée suffisent-elles ?) | non | DOCS-A |
| Taux horaire de main-d'œuvre **TTC** ; modalités de décompte du temps ; frais de déplacement | S2 (« Taux horaire de main-d'œuvre TTC », « Modalités de décompte du temps estimé ») ; S3 | taux **HT** dans le libellé, seulement s'il y a un seul taux ; décompte du temps : **absent** ; déplacement : présent. (Le contrat d'intervention D5, lui, a le taux TTC et « le temps est compté sur place, de l'arrivée à la fin de l'intervention ») | **non conforme** sur D1/D2 pour un dépannage ou un entretien | non | DOCS-A |
| Somme HT et TTC avec taux de TVA | S2, S3 | « Total HT », lignes « TVA x % », « Total TTC » ; en franchise : « TVA non applicable (293 B) » puis « Net à payer » | **conforme** | oui | — |
| Durée de validité ; gratuit ou payant | S2, S3 | « Devis gratuit, valable <3 mois par défaut> à compter de sa date d'émission. » | **conforme** (sous réserve de la date, ligne 1) | non | — |
| Assurance obligatoire : assureur, couverture géographique | S1 (« références de son contrat d'assurance professionnelle, les coordonnées de l'assureur … couverture géographique ») ; code de l'artisanat L132-1 | « Assurance pro : <texte libre> — couverture : <zone> » si saisi ; sinon un message à l'écran seulement (`next-documents.js`), **l'impression n'est pas bloquée** | **à faire valider** (le texte libre contient-il les coordonnées de l'assureur ?) ; pas de blocage : **non conforme** si vide | non | DOCS-A |
| Attestation d'assurance **décennale** jointe au devis | S15 (« doit être jointe aux devis et à la facture ») ; S2 (code des assurances L243-2, A243-3) ; S2 : obligatoire pour la pose de PAC et de clim « sur un chantier de construction ou de rénovation » | **jamais jointe** ; le mot « décennale » n'est **jamais imprimé** ; seule phrase : « installation … couverte par nos assurances (voir bas de page) » | **non conforme** dès qu'il y a de la pose | non | geste de Gab + DOCS-A |
| Pièces remplacées : informer le client qu'il peut les garder | S3 (« Le professionnel doit informer le client qu'il peut, s'il le souhaite, conserver les pièces … remplacés ») | **absent** (D1, D2, D5) | **non conforme** pour un dépannage | non | DOCS-A |
| Enlèvement et gestion des déchets, et leur coût | S2 (« Modalités d'enlèvement et de gestion des déchets générés par les travaux ainsi que les coûts associés ») ; texte de loi non cité par S2 | **absent** | **non conforme** (probable) ; texte à identifier | non | DOCS-A |
| Médiateur de la consommation (nom, adresse, site), avant le contrat | S5 (code de la consommation L616-1, R616-1, L111-1 ; amende 3 000 € EI) | « Médiation de la consommation : <nom> — <site>. En cas de litige non résolu, le client consommateur peut saisir gratuitement ce médiateur. » si le client n'est pas « Professionnel » **et** si le médiateur est saisi ; **adresse postale absente** ; pas de blocage | **conforme** si saisi, sauf l'adresse : **non conforme** ; sans médiateur : **non conforme** | non | geste de Gab + DOCS-A |
| Délai ou date d'exécution | S4, S13 (information précontractuelle) | « Délai d'exécution des travaux : à convenir ensemble à la commande. » | **à faire valider** (« à convenir » n'est ni une date ni un délai) | non | DOCS-A |
| Garanties légales (conformité, vices cachés ; pour des travaux : parfait achèvement, biennale, décennale) | S13 (CGV aux particuliers : « Informations liées aux garanties légales ») ; S4 | « Matériel garanti selon la garantie constructeur ; installation réalisée dans les règles de l'art… » ; garanties légales **absentes** | **non conforme** (probable) ; la phrase « garantie constructeur » seule peut laisser croire qu'il n'y a pas de garantie légale : **à faire valider** | non | DOCS-A |
| Acompte ou arrhes | S3 (« Si rien n'est indiqué, la somme versée sera considérée comme étant des arrhes ») | « acompte de X (Y %) à la commande, solde de Z à la fin des travaux » ; le mot « arrhes » n'existe nulle part | **conforme** (le mot « acompte » est écrit) | non | — |
| « Bon pour accord », signature, date | S3 (mention « bon pour travaux » ou « bon pour accord ») | « Date et signature, précédées de la mention « Bon pour accord ». » ; « L'entreprise » : cadre de signature **vide** | **conforme** côté client ; signature de l'entreprise : voir S1 (§ 2.10) | non | — |
| Franchise en base : mention | S6 (« TVA non applicable - article 293 B du CGI » sur chaque facture) ; S25-S27 (CIBS, § 2.12) | « TVA non applicable — article 293 B du CGI (franchise en base). » **et** « non applicable (293 B) » dans les totaux ; à partir de 2027, seule la forme longue passe à « art. L. 233-3 du CIBS » (constat C4) | **à faire valider** (C4) | **oui** | AF4 |
| Taux réduit 5,5 % ou 10 % : certification du client sur le devis ou la facture | S8 ; S21 (« le preneur certifie sur le devis ou la facture » ; sans elle, **taux normal de plein droit**) ; S22 (modèles de mention) | `printV2` 5,5 % : « TVA à 5,5 % (art. 278-0 bis A du CGI) : le client certifie que le logement est à usage d'habitation et achevé depuis plus de deux ans ; l'entreprise certifie que… » ; 10 % : « Taux réduit de TVA appliqué sous réserve des conditions d'éligibilité en vigueur… » (**pas de certification**) ; `printDevis` (ancien) : **rien** | **non conforme** : il manque, par rapport au modèle S22, « pas d'immeuble neuf », « pas plus de 10 % de surface » et, pour 5,5 %, « nature de travaux de rénovation énergétique » ; la phrase doit être celle **du client** | **oui** (assujetti seulement) | TVA |
| Information sur le label RGE (détenu ou non, conséquences sur les aides) | S16 (« Avant la signature du contrat, … s'il détient ou non un label RGE … S'il ne le détient pas, … conséquences … Ces informations doivent figurer dans le contrat » ; « Tout contrat conclu avec un consommateur en violation de cette règle est nul ») ; S4 (code de la consommation L224-114) | **absent** (« RGE » seulement dans des aides à l'écran : « ne les promets pas au client ») | **non conforme** pour une PAC ou une clim réversible chez un particulier (probable : S8 classe les PAC air/air parmi les équipements à énergie renouvelable) ; champ exact : **à faire valider** | non | DOCS-A |
| Démarchage pour des aides publiques | S4 (L224-114 ; loi du 30/06/2025) | aucune aide promise (aides seulement à l'écran) | **conforme** | non | — |
| Données personnelles (RGPD) | S31 (liste des informations) | bloc « Données personnelles » (`next-documents.js`) : responsable, finalités, base légale, durée (« pièces comptables : 10 ans »), droits d'accès, rectification, effacement, opposition, réclamation CNIL. **Absents** : destinataires (hébergeur, comptable, plateforme), transferts hors UE (possibles, registre RGPD), limitation et portabilité | **à corriger** (non conforme sur 3 points de la liste CNIL) | non | DOCS-A |
| Conditions générales de vente | S13 (obligatoires avant le contrat avec un particulier ; sur demande d'un pro) | **aucune** | **à faire valider** (le devis et ses blocs peuvent-ils tenir lieu de CGV ?) | non | DOCS-A |
| Pagination | S12 (« numéro … sur toutes les pages … séquence n/N ») pour la facture | « Page 1/1 » écrit en dur, même si le document fait 2 pages | **à corriger** (surtout pour les factures, § 2.6) | non | DOCS-A |

### 2.2 Contrat conclu hors établissement ou à distance avec un particulier (blocs ajoutés à D1, D2, D5)

Ce que le code fait déjà (certain, `next-particuliers.js`, `next-signature.js`) : le mode de conclusion (`hors_etablissement`, `distance`, `locaux`, `a_preciser` par défaut) ; à l'impression, pour un client non « Professionnel » : bloc « Paiement » L221-10, information et **formulaire de rétractation**, case de demande d'exécution anticipée (L221-25, L221-28), « Exemplaire client remis en main propre le … » ; à l'écran : remise de l'exemplaire papier (L221-9), prolongation de 12 mois (L221-20), urgence ; blocage des encaissements avant 7 jours (`garderPaiement`), texte « Paiement exigible à partir du … » sur la facture.

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Information précontractuelle complète : identité (adresse, mail, téléphone), caractéristiques, prix TTC, date ou délai d'exécution, rétractation et formulaire type, garanties légales ou commerciales, **disponibilité des pièces détachées**, médiateur ; « Le contrat n'est pas valable s'il ne mentionne pas toutes ces informations » | S4 (L221-5 à L221-7, L221-9 ; sanctions L242-1 à L242-9) | délai « à convenir » ; garanties légales absentes ; pièces détachées absentes ; médiateur seulement s'il est saisi | **non conforme** (probable) | non | DOCS-A |
| Exemplaire daté, signé **par les deux parties**, sur papier ou, avec accord, sur support durable | S4 | papier : cadre « L'entreprise » vide à signer à la main ; **en ligne : seul le client signe** ; accord « support durable » recueilli (case facultative) | **à faire valider** (la signature de l'entreprise manque sur l'exemplaire signé en ligne) | non | DOCS-A |
| Aucun paiement avant 7 jours (sauf réparations urgentes demandées) | S4 (L221-10, sanction L242-7) | bloc « aucun paiement ni acompte ne peut être exigé ou reçu avant l'expiration d'un délai de 7 jours… » ; encaissement bloqué ; facture « exigible à partir du … » | **conforme** (sous réserve de C5, § 2.6) | non | AF4 (C5) |
| **Aucune prestation avant 7 jours** (sauf urgence) | S4 : « Il lui est également interdit d'effectuer une prestation de service avant l'expiration de ce délai » | **rien** n'empêche de planifier ni de réaliser les travaux avant J+7 (la case « exécution anticipée » vise les 14 jours de rétractation) | **à faire valider** (S4 l'écrit ; l'article L221-10 n'a pas été relu) ; si confirmé : **non conforme** | non | DOCS-A |
| Rétractation 14 jours ; formulaire type | S4 (L221-18 à L221-28) | « Vous disposez d'un délai de 14 jours à compter de la signature du présent devis… » ; formulaire « Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous : devis n° … » | **à faire valider** : point de départ (S4 : « à compter du lendemain … de la conclusion du contrat pour les prestations de services », et de la **réception du bien** pour une vente) ; contrat **mixte** (fourniture d'une PAC + pose) ; conformité au modèle de formulaire en annexe du code (non relu) | non | DOCS-A |
| Exécution anticipée : demande expresse sur support durable | S4 | case imprimée « ☐ Je demande expressément… (art. L221-25 et L221-28) » ; case en ligne `anti` | **conforme** (probable) | non | — |
| Rétractation « en un clic » pour un contrat conclu en ligne (depuis le 19/06/2026) | S13 (« À compter du 19 juin 2026, les professionnels concluant des contrats à distance via une interface en ligne devront proposer une fonctionnalité permettant au consommateur d'exercer son droit de rétractation directement en ligne ») | `signer.html` permet de **signer** en ligne, **pas de se rétracter** en ligne | **à faire valider** (la page de signature est-elle une « interface en ligne » au sens du texte ?) ; si oui : **non conforme** | non | DOCS-A |
| Démarchage téléphonique : consentement préalable (depuis le 11/08/2026) ; prospection interdite en rénovation énergétique | S4 (L223-1, L223-8) | ClimPilot n'appelle personne ; messages limités aux prestations en cours (commentaire de `next-messages.js`) | **conforme** (hors champ de l'appli) | non | — |

### 2.3 Contrat d'intervention avant dépannage (D5, `nxPartContratDep`)

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Contenu du devis de dépannage (date, entreprise, client, lieu, nature, décompte, taux horaire TTC, décompte du temps, déplacement, validité, gratuit) | S2, S3 (arrêté du 24/01/2017) | « Contrat établi le … », « Lieu d'intervention », « Nature exacte des travaux », tableau, « taux horaire X TTC », « le temps est compté sur place, de l'arrivée à la fin de l'intervention », « frais de déplacement », « Ce document est gratuit. Offre valable le jour de son établissement. » | **conforme** | non | — |
| Pièces remplacées conservables | S3 | absent | **non conforme** | non | DOCS-A |
| Assurance, médiateur, RGPD, SIREN, EI | S1, S5 | **pas de `docLegal`** : ni assurance, ni médiateur, ni RGPD (en-tête : dénomination EI, adresse, SIRET, téléphone) | **non conforme** (assurance, médiateur) | non | DOCS-A |
| Rétractation (hors urgence, hors locaux) | S4 | bloc et formulaire si mode ≠ locaux et pas d'urgence ; mention « Urgence : le client demande expressément… » | **conforme** (probable) | non | — |

### 2.4 Contrat d'entretien (D4 : lot « entretien » du devis)

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Durée, reconduction, résiliation, prix, révision, contenu des visites | S13 (information précontractuelle) | « Durée : N mois à compter de la signature[, reconduit tacitement par périodes identiques] », « Révision du prix : Prix révisable à chaque date anniversaire, avec information préalable », « Résiliation : Par lettre recommandée ou courriel, au plus tard un mois avant l'échéance », « Contenu de chaque visite » | **conforme** (probable) | non | — |
| Information annuelle de non-reconduction : **au plus tôt 3 mois et au plus tard 1 mois avant la date limite** pour demander la non-reconduction ; dans un **encadré apparent** avec cette date limite ; sinon résiliation immédiate et gratuite | S18 (code de la consommation L215-1 à L215-5) | imprimé : « … nous vous informerons par écrit, au plus tôt trois mois et au plus tard un mois **avant la fin de chaque période** … » ; tâche créée **2 mois avant la fin** ; **aucun modèle de lettre** | **non conforme** : le repère n'est pas la fin de la période mais la **date limite de résiliation** (ici un mois avant l'échéance, donc la fenêtre va de 4 à 2 mois avant l'échéance) ; pas d'encadré ni de date limite | non | DOCS-A |
| Résiliation en ligne d'un contrat conclu par voie électronique | rappel S18 (L215-1-1 cité par service-public, texte non relu) | contrat signé en ligne (`signer.html`), aucune résiliation en ligne | **à faire valider** | non | DOCS-A |
| Attestation d'entretien des systèmes thermodynamiques de 4 à 70 kW (tous les deux ans ; « remise d'une attestation d'entretien détaillée, avec le résultat de l'évaluation énergétique et environnementale … et la fourniture de conseils ») | S28 (code de l'environnement R224-44 à R224-44-5 ; arrêté du 24/07/2020 relatif à l'entretien des systèmes thermodynamiques, annexe) ; S29 | **aucune attestation** ; la visite d'entretien ne produit aucun document | **non conforme** (certain : absente) ; contenu exact de l'attestation : **à vérifier** (annexe de l'arrêté non relue) | non | DOCS-B (fonction nouvelle) |
| Contrôle d'étanchéité, fréquence | règlement (UE) 2024/573 art. 5, cité par S30 | tableau « Contrôle d'étanchéité » calculé (`leak()`) | **à faire valider** (non relu ici) | non | AF3 |

### 2.5 PV de mise en service (D9) et réception des travaux

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Réception des travaux : point de départ de la décennale (« le lendemain de la signature du procès-verbal de réception ») | S15 | **pas de PV de réception** ; le PV de **mise en service** porte « Le client — « bon pour réception », date et signature », sans zone de réserves ni date de réception | **à faire valider** (le PV de mise en service vaut-il réception sans réserves ?) ; **à corriger** : ajouter réserves, date de réception, levée des réserves | non | DOCS-A |
| Garanties qui démarrent (parfait achèvement, biennale, décennale) | S15 ; code civil 1792 et suivants cités par S2 | absentes | **à corriger** (information utile ; obligation d'écrit non trouvée) | non | DOCS-A |

### 2.6 Factures (F1 à F4) et ajouts à l'émission (F6)

Mentions obligatoires : S1 (code de commerce L441-9 ; CGI annexe II art. 242 nonies A ; vérifié le 11/08/2026). Pour un particulier, la « note » est obligatoire au-delà de 25 € TTC (S12, S2).

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Date d'émission ; numéro unique, chronologique, continu | S1, S12 (séries distinctes admises si justifiées) | date dans l'en-tête ; « FACTURE N° F-AAAA-NNN » (série annuelle donnée par le serveur en mode réel) ; « TEST-F-… » en démonstration ; anciennes factures renommées « ESSAI-… » | **conforme** (probable) ; séries TEST et ESSAI : **à faire valider** | non | — |
| **Date de la prestation** (ou du versement de l'acompte) | S1 | F1 : « … du <date> » (date du jour si la date d'intervention est vide) ; F3, F4 : période ; **F2 (acompte, solde) : absente** | **non conforme** sur F2 ; F1 si la date est vide | non | AF4 |
| Identité du vendeur : nom + « EI », adresse, SIREN ; société : dénomination, forme, capital, siège | S1 ; R526-27 | `docTop` + `docLegal` (SIRET) | **conforme** si Paramètres rempli ; SIRET au lieu de SIREN : **à faire valider** | **oui** | DOCS-A (blocage si vide) |
| RNE (artisan) | S13, S14 | absent | **à faire valider** (obligatoire sur la facture ? S1 ne le cite pas) | non | DOCS-A |
| Identité du client, adresse ; SIREN du client pro (01/09/2027 pour une micro ou PME) ; adresse de livraison si différente (01/09/2027) | S1 | nom, adresse ; « N° SIREN du client : … » si saisi, **sans alerte s'il manque** (C7) ; adresse de livraison si saisie | **conforme** si saisi ; **non conforme** sans alerte (C7) | non | AF4 (C7) |
| N° TVA du vendeur (et du client pro redevable) | S1 (sauf ≤ 150 € HT) | « N° TVA : … » si saisi ; TVA du client : **absente** | **non conforme** pour un client pro redevable, une fois assujetti | **oui** | TVA |
| **Décompte détaillé** : quantité, dénomination, prix unitaire HT, taux de TVA | S1 ; S2 (note : « Décompte détaillé de chaque prestation ») | F1 : colonnes « Désignation / Montant » (quantité et prix seulement dans le libellé des pièces) ; **F2 : une ligne « Travaux réalisés selon devis n° … »** (C8) ; F3, F4 : une ligne | **non conforme** | non | AF4 (C8) |
| Total HT et TTC à payer | S1 ; S2 | franchise : **« Net à payer » seulement** ; assujetti : « Total HT », « TVA », « Net à payer TTC » (`nxrgFixDoc`) | franchise : **à faire valider** (« Net à payer » suffit-il quand HT = TTC ?) | **oui** | AF4 |
| Date à laquelle le règlement doit intervenir | S1 ; S11 | « paiement à réception de facture » (F4 : « paiement à réception ») ; XML : échéance = date de facture | **à faire valider** (« à réception » vaut-il date d'échéance ?) | non | AF4 |
| Conditions d'escompte (« Escompte pour paiement anticipé : néant » en l'absence) | S1 | F1, F2 : « Pas d'escompte pour paiement anticipé. » ; **F3, F4 : absent** (C6) ; XML : note AAB | F1, F2 **conforme** ; F3, F4 **non conforme** | non | AF4 (C6) |
| Taux des pénalités de retard (au moins 3 fois le taux d'intérêt légal entre pros) | S1 ; S11 (« ne peuvent pas être inférieures à 3 fois le taux de l'intérêt légal ») | « Pénalités de retard : 3 fois le taux d'intérêt légal. » sur F1 à F4 | **conforme** | non | — |
| Indemnité forfaitaire de 40 € (client pro) | S1 ; S11 (« doit être mentionnée … sur les factures ») | F1, F2, F3 : si le client est « Professionnel » ; **F4 : jamais** (la fonction ne reçoit pas le type de client) | F4 **non conforme** | non | AF4 (C6 élargi) |
| Une seule condition de paiement (hors établissement) | S4 | « paiement à réception de facture » **et** « Paiement exigible à partir du … (L221-10) » (C5) | **non conforme** (C5) | non | AF4 (C5) |
| Assurance professionnelle (artisan) | S1 (code de l'artisanat L132-1, R132-1) | « Assurance pro : … » si saisi | **conforme** si saisi | non | DOCS-A (blocage) |
| Attestation décennale jointe à la facture | S15 | jamais | **non conforme** (pose) | non | geste de Gab + DOCS-A |
| Franchise en base | S6 ; S20, S25-S27 (§ 2.12) | « TVA non applicable — article 293 B du CGI » ; à partir du 01/01/2027 : « TVA non applicable — art. L. 233-3 du CIBS » | **à faire valider** (C4, numéro d'article) | **oui** | AF4 (C4) |
| « Auto-liquidation » (sous-traitance BTP pour une entreprise assujettie) | S7 ; S23 (CGI ann. II art. 242 nonies A, I-13° : mention « Autoliquidation ») ; S1 | **jamais imprimé** ; message à l'écran : « ClimPilot n'imprime pas encore ce cas » (`next-mod-autres.js`) ; en franchise, la mention 293 B suffit (S7) | **non conforme** si Gab est assujetti et sous-traite | **oui** | TVA |
| Taux réduit : certification sur la facture si elle n'est pas sur le devis ; part de chaque taux distincte | S21, S22 (modèle « Par le règlement de la présente facture, le client certifie… ») | aucune mention de certification ; ventilation par taux en assujetti (`nxrgFixDoc`) | **non conforme** (certification) | **oui** | TVA |
| Nature de l'opération (biens / services / les deux) — 01/09/2027 | S1 | « Nature de l'opération : <…>. » ; émission réelle refusée tant que la nature des chantiers n'est pas choisie (`next-documents.js`) | **conforme** | non | — |
| « Option pour le paiement de la taxe d'après les débits » si option — 01/09/2027 | S1 ; S23 (aujourd'hui « conseillée », pas obligatoire) ; S10 | texte prévu, **aucun réglage** pour l'activer | **non conforme** si Gab opte pour les débits | **oui** | TVA |
| Garantie légale de conformité (2 ans) sur la facture d'un particulier, pour certaines catégories de biens (dont « appareils électroménagers », « appareils dotés d'un moteur électrique … destinés au bricolage ou au jardinage ») | S1 (décret 2021-609) | absent | **à faire valider** (une clim ou une PAC est-elle dans ces catégories ?) | non | AF4 |
| Pagination n/N sur chaque page | S12 | « Page 1/1 » en dur | **à corriger** | non | AF4 |
| Note pour un particulier (> 25 €) en deux exemplaires, conservée 2 ans | S2 | la facture tient lieu de note ; PDF conservé | **conforme** (probable) | non | — |
| Conservation 10 ans | S17 (code de commerce L123-22) | factures figées côté serveur ; exports | **conforme** (probable ; durée de vie du serveur et des exports : registre RGPD) | non | — |

### 2.7 Avoir (F5)

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Numéro propre, référence de la facture d'origine | S1, S12 | « AVOIR N° AV-AAAA-NNN » ; « Avoir relatif à la facture <n°> du <date> » ; montants négatifs | **conforme** (probable ; série AV à faire valider) | non | — |
| Mentions de la facture (identités, nature, franchise) | S1 | identités ; « TVA non applicable — article 293 B du CGI » ; **nature forcée** à « Livraison de biens et prestation de services » pour un avoir de devis (`printAvoir`), même si la facture d'origine dit « Prestation de services » ; pas d'adresse de livraison | **non conforme** (nature incohérente avec la facture) | non | AF4 |

### 2.8 XML de facture électronique (F7)

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Émission électronique B2B à partir du **01/09/2027** (micro et PME), réception dès le 01/09/2026, « y compris celles bénéficiant de la franchise en base » ; e-reporting B2C pour les assujettis | S9 (CGI 289 bis, 290, 290 A) | XML CII EN 16931 (validé par la suite F : XSD, CEN, BR-FR) ; envoi par Super PDP prévu | **conforme** sur le format (tests) ; plateforme réelle : **non démarrée** | e-reporting : **oui** | FACT |
| Nouvelles mentions dans le XML : SIREN client (BT-47), adresse de livraison (BT-70 à 80), nature, option débits | S1 | SIREN client si saisi ; nature en note et dans le cadre BT-23 ; **adresse de livraison absente** ; **option débits absente** ; TVA de l'acheteur (BT-48) absente ; autoliquidation (code AE) absente | **non conforme** sur livraison et débits | partiel | AF4 / FACT |
| Mention de franchise (BT-120/121) | S20, S25-S27 | « TVA non applicable, art. 293 B du CGI » puis « … art. L. 233-3 du CIBS » ; code VATEX-FR-FRANCHISE | **à faire valider** (C4) | **oui** | AF4 |

### 2.9 Fiche d'intervention fluides (R1), bilan (R2), registre (R3) — mise à jour du § 8 de `docs/MISSION-AF-CORRECTIONS.md`

Ce qui a changé depuis le 25/10 (sources du 11/11/2026) :
- **Version** : service-public liste toujours le **Cerfa 15497\*04** (S19, vérifié le 01/07/2024). Aucune version plus récente trouvée. Le site des formulaires n'a pas pu être lu (notice non relue).
- **Le ministère** (S30, mis à jour le **04/11/2026**) : « remplir une fiche d'intervention (Cerfa 15497) et renseigner l'application Trackdéchets lorsque l'intervention donne lieu à la récupération de déchets de fluides » ; « Le contenu des fiches d'intervention fera l'objet d'évolutions réglementaires à venir » (règlement (UE) 2024/573, art. 5) ; l'application « Fluides Frigorigènes » (présentée le 22/04/2026) « n'a pas de caractère obligatoire », et une **API vers Trackdéchets** génère les bordereaux. Le § 8 du 25/10 disait « aucune connexion » : c'est vrai pour les logiciels de gestion, pas pour Trackdéchets.
- **Projet de décret du 12/06/2026** (réécriture de R543-82) : publication **non vérifiée** (Légifrance illisible).
- **Attestation de capacité** : nouveau modèle au **01/01/2027** (annexe 4 de l'arrêté du 21/11/2025, S2) ; attestations délivrées après le 12/03/2024 valables jusqu'au 12/03/2029 (S2).
- **Décision 7** (A : reproduire le Cerfa ; B : appli du ministère ; C : rien) : **toujours ouverte**.

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Fiche pour chaque manipulation, Cerfa 15497 | S30 ; S19 ; R543-82 cité par S30 (non relu) | « FICHE D'INTERVENTION — … équivalent électronique du formulaire Cerfa n° 15497\*04 (art. R.543-82 du code de l'environnement) » ; cadres 1 à 14 | **à faire valider** (aucune source ne dit qu'une fiche de logiciel « vaut » le Cerfa, § 8 du 25/10) | non | AF3 (décision 7) |
| Signature de l'opérateur | notice du Cerfa (25/10, non relue ce jour) | « Signature de l'opérateur (nom, date) : » + nom de l'entreprise, **sans signature ni date** (C1) | **non conforme** | non | AF3 |
| Contenants (charge et récupération) | idem | « Contenant(s) de récupération » seulement (C2) | **non conforme** | non | AF3 |
| Cadres détaillés (fuites, codes UN, destination, fluide changé) | idem | cadres présents mais simplifiés (une seule fuite ; « ⚠ à compléter ») (C3) | **non conforme** (probable) | non | AF3 |
| N° d'attestation de capacité ; catégorie (2027) | S2 | « N° d'attestation de capacité : … » ; organisme et **catégorie non imprimés** | **à faire valider** (nouvelles catégories au 01/01/2027) | non | AF3 |
| Conservation 5 ans | S30 ; notice (25/10) | « Document à conserver 5 ans par l'opérateur et par le détenteur » ; suppression refusée avant 5 ans | **conforme** | non | — |
| Mail qui accompagne la fiche | — | « La réglementation impose qu'elle soit signée par vous et par moi » (`mailText`) : faux sous les seuils (signature conjointe au-delà de 5 t éq. CO₂, § 8 du 25/10) et l'opérateur ne signe pas (C1) | **non conforme** | non | AF3 |
| BSFF / Trackdéchets | S30 (« obligatoire pour tracer la gestion des déchets dangereux ») | champ « N° de BSFF / Trackdéchets » ; aucun bordereau produit | **conforme** (le bordereau se fait dans Trackdéchets : geste de Gab) | non | — |
| Déclaration annuelle des fluides | S2 (« déclaration au plus tard le 31 décembre de l'année civile précédente » — sic, S2) ; S30 (« déclarer auprès de l'ADEME ») ; arrêté du 21/11/2025 cité par le code (non relu) | « à transmettre au plus tard le 31/01/<année+1> » à l'organisme agréé | **à faire valider** (destinataire et date : S2 et S30 ne disent pas la même chose que le code) | non | AF3 |
| Équipement acheté par le client et posé par un autre (mise en service seule) : contrat d'assemblage Cerfa 15498 | S30 (distributeurs : « contrat passé avec un opérateur attesté », Cerfa 15498) | aucune mention | **à faire valider** | non | AF3 |
| Registre CSV | règlement (UE) 2024/573 art. 7 (S30 : registre tenu par l'exploitant) | pas de SIRET, PRP, t éq. CO₂, détecteur, BSFF | **confort** | non | AF3 |

### 2.10 Page de signature, exemplaire signé, valeur de la signature (S1)

Ce que l'appli garde comme preuve (certain, `supabase/functions/signature`, migration `20261002120000_documents_emis.sql`, `next-signature.js`) : le HTML exact du document, son **empreinte SHA-256 calculée par le serveur à l'envoi**, figés par un déclencheur ; à la signature : heure du serveur, nom saisi, image de la signature, **adresse IP** (en-tête `x-forwarded-for`), **navigateur**, texte du consentement **reconstruit par le serveur** (pas le texte affiché), accord « support durable », date de téléchargement de l'exemplaire. Le lien expire après 90 jours. La copie gardée **dans l'appli** n'a ni le navigateur ni le texte du consentement (seulement sur le serveur).

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Valeur d'une signature électronique (code civil 1366, 1367, cités par `signer.html`) | non relu (Légifrance) ; § 7 | « Signature électronique (articles 1366 et 1367 du Code civil). Sont enregistrés … la date et l'heure, le nom saisi, l'adresse IP, le navigateur utilisé et l'empreinte numérique du document » | **à faire valider** (signature simple : suffit-elle pour un devis, un contrat hors établissement, une fiche fluides ?) | non | juriste (§ 6.2) |
| Exemplaire du consommateur sur support durable | S4 | case « j'accepte de recevoir mon exemplaire … sur support durable : un fichier à télécharger » ; fichier `Exemplaire-<n°>.html` avec signature, empreinte, consentement, rétractation | **à faire valider** (un fichier HTML téléchargé est-il un « support durable » ?) | non | juriste |
| Signature des deux parties | S4 | l'entreprise ne signe pas en ligne | **à faire valider** (§ 2.2) | non | DOCS-A |
| Information RGPD du signataire | S31 | « Responsable du traitement : l'entreprise … (ses coordonnées figurent sur le document) » ; durée : « le temps de la relation commerciale puis la durée de prescription » ; hébergement Supabase Irlande ; droits ; CNIL. **Absents** : contact direct, durée chiffrée, transferts hors UE (registre RGPD : « possibles, limités »), GitHub Pages (adresse IP) | **à corriger** | non | DOCS-A |
| Rétractation en ligne | S13 | absente | **à faire valider** (§ 2.2) | non | DOCS-A |

### 2.11 Mails, SMS, bon de commande (M1 à M6)

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Identité de l'expéditeur | S13 (coordonnées du professionnel) | `next-messages.js`, `next-avis.js` : nom et téléphone de Paramètres ; **nom écrit en dur** dans `mailText`, `smsText` et le mail fournisseur (K5) | **à corriger** (K5) | non | AF5 (K5) |
| Mention de TVA dans un mail de devis | S6 | « … HT — TVA non applicable, art. 293 B du CGI » écrit en dur (`mailDevis`, `next-statut.js`, `mailLoc`) ; remplacée si assujetti (`next-regime.js`, à revérifier à l'exécution) | **à faire valider** | **oui** | TVA |
| Démarchage, prospection | S4 (L223-1, L223-8) | messages limités aux prestations demandées ou en cours ; exclusion « plus de messages » dans l'appli | **conforme** (probable) | non | — |
| Moyen de s'opposer dans chaque message (demande d'avis, rappel d'entretien) | règle de la prospection par SMS ou mail (code des postes et communications électroniques, **non relu**) | aucun « STOP » ni désinscription dans le texte | **à faire valider** (une demande d'avis est-elle de la prospection ?) | non | DOCS-A |
| Relance de devis | — | aucune pénalité, aucune menace | **conforme** | non | — |
| Confirmation de créneau (site) : « Acompte de X € à régler avant le rendez-vous », « Gratuit jusqu'à 24 h avant » | S4, S13 (contrat à distance : rétractation, information) | texte court, sans information de rétractation | **à faire valider** (le site n'est pas en ligne) | non | plus tard (site) |
| Bon de commande fournisseur | entre pros | « Document interne de commande, non contractuel » | **conforme** (hors champ) | non | — |

### 2.12 Franchise en base : la mention exacte selon la date du document (constat C4)

| Date du document | Ce que disent les sources | Ce que ClimPilot imprime | Verdict |
|---|---|---|---|
| jusqu'au 31/12/2026 | S6, S1 : « TVA non applicable, art. 293 B du code général des impôts » | « TVA non applicable — article 293 B du CGI » (+ « (293 B) » dans les totaux) | **conforme** (probable : tiret au lieu de virgule, forme courte en plus) |
| du 01/01/2027 au 30/06/2028 | S20 (BOFiP, 07/10/2026) : TVA recodifiée dans le CIBS au 01/01/2027 ; « s'agissant des mentions juridiques devant figurer sur les factures elles-mêmes, **les renvois au code général des impôts seront possibles jusqu'au 30 juin 2028** » ; numéro de l'article CIBS : S25 (modifiée le 14/10/2026) « article **L.233-3** du CIBS » ; S26 (modifiée le 14/10/2026) et S27 (21/05/2026) « article **L. 223-3** du CIBS » ; S25 cite aussi « 293 D … / art. L.223-13 », S27 « 293 C (article L. 223-18 du CIBS) » | à partir du 01/01/2027, la forme longue devient « art. L. 233-3 du CIBS » (`next-emission.js`, `next-einvoice.js`) ; la forme courte « (293 B) » reste | **à faire valider** : les pages officielles se contredisent, et les articles voisins (L. 223-13, L. 223-18) laissent penser que **L. 223-3** est le bon numéro (hypothèse). « 293 B du CGI » reste sûr jusqu'au 30/06/2028 |
| après le 30/06/2028 | S20 : les renvois au CGI ne sont plus admis | — | réponse de la comptable avant cette date |

Proposition (hypothèse, à trancher par Gab et sa comptable) : **ne pas basculer au 01/01/2027** ; garder « TVA non applicable, art. 293 B du CGI » (une seule forme, la longue) jusqu'à confirmation du numéro CIBS, puis basculer avant le 30/06/2028. Rien ne change dans les golden documents (datés du 20/10/2026) ; les tests F et L qui attendent « L. 233-3 » au 01/01/2027 changent.

### 2.13 Exports pour la comptable (X1 à X3) et logiciel de caisse

| Règle | Texte officiel | ClimPilot aujourd'hui | Verdict | Statut ? | Mission |
|---|---|---|---|---|---|
| Livre des recettes (micro) | rappel S2 (régime micro) ; non relu en détail | impression « … — micro-entreprise, recettes encaissées » et « TVA non applicable, art. 293 B du CGI » **en dur** ; CSV « Montant HT » qui mélange TTC et HT une fois assujetti (AF2, M6) | **à corriger** selon le statut | **oui** | AF2 / TVA |
| Facturier, synthèse, mail à la comptable | — | « Document de travail généré par ClimPilot — ne remplace pas une comptabilité » | **conforme** (document de travail) | non | — |
| FEC (fichier des écritures comptables) | non relu | **absent** : ClimPilot n'est pas un logiciel de comptabilité | **à faire valider** (la comptable tient-elle la comptabilité ?) | **oui** (réel, société) | TVA / comptable |
| Logiciel de caisse sécurisé (assujetti qui enregistre les paiements de particuliers) | S24 (BOFiP, 25/03/2026 : CGI 286, I-3° bis ; « n'est pas soumis … les assujettis … bénéficiant du régime de la franchise en base » ; un logiciel de gestion qui suit les encaissements de particuliers « doit être sécurisé ») | avertissement à la bascule : « ClimPilot n'est pas certifié : solution à voir avec ton comptable avant la bascule » | **conforme** en franchise ; **non conforme** si assujetti sans solution | **oui** | FACT (dossier non trouvé dans le dépôt ni lisible dans le Project) |

### 2.14 Documents internes (D6, D7) et estimation (D3)

- Fiche de visite, checklist : documents internes, aucun montant, aucune mention exigée (**conforme**, hors champ).
- Estimation : « Document non contractuel. Montant indicatif — il ne vaut pas devis. Un devis détaillé sera établi après visite technique. » **Conforme** tant qu'un vrai devis suit avant les travaux (S3). Les blocs rétractation et RGPD s'y ajoutent aussi (inoffensif, **confort**).

## 3. Ce que le code fait déjà bien (certain, lu)

- Dénomination « EI » ajoutée selon le statut (`next-documents.js`).
- Médiateur, assurance, nature de l'opération : contrôlés à l'écran, et l'**émission réelle d'une facture** est refusée si la nature des chantiers n'est pas choisie ou si l'assurance manque pour une pose (`next-documents.js`).
- Contrat avec un particulier : mode de conclusion, formulaire de rétractation, exécution anticipée, accusé de remise, blocage des encaissements avant 7 jours (`next-particuliers.js`).
- Reconduction tacite : clause et tâche de rappel (fenêtre à corriger, § 2.4).
- Signature en ligne : document figé, empreinte, consentements séparés, exemplaire téléchargeable, information RGPD.
- Facture : pénalités, escompte (F1, F2), 40 € (pros), nature, SIREN client, adresse de livraison ; XML EN 16931 validé.
- Fiche fluides : conservation 5 ans, fiche annulée au lieu de supprimée, avertissements du mode guidé.

## 4. Non-conformités classées, avec la mission, les tests à écrire d'abord et les golden qui bougeraient

Règles communes (CLAUDE.md § 3 et § 4) : un test **rouge** sur `main` avant tout code (journal gardé), puis vert ; batterie complète ; CI verte. **Aucun montant ne change** : golden Z identiques. Toute mention ajoutée ou modifiée sur un devis, une facture ou un avoir fait bouger les golden documents (suite Y) : **régénération avec ton accord écrit**, avant/après dans le compte rendu. Les 5 « À TRANCHER » de la suite Y ne se régénèrent pas sans décision de la comptable et de toi.

### 4.1 Bloquant avant le premier client

| # | Non-conformité | Certitude | Mission | Test rouge d'abord | Golden qui bougeraient |
|---|---|---|---|---|---|
| B1 | **RGE** : pas d'information « label détenu ou non, conséquences sur les aides » sur les devis et contrats de PAC / clim réversible à un particulier ; contrat **nul** selon S16 | absence : certain ; champ d'application : à faire valider | DOCS-A | suite L : devis v2 « split » pour un particulier → le texte RGE est présent ; témoin : client pro → absent | `devis-v2.html` |
| B2 | **Décennale** : mot jamais imprimé, attestation jamais jointe (devis et factures de pose) | certain | geste de Gab + DOCS-A | suite L : devis et facture de pose avec `decennale=oui` → mention « Assurance décennale : <assureur>, couverture <zone> » et rappel « attestation jointe » ; sans assureur → impression **bloquée** (comme la facture réelle aujourd'hui) | `devis-v2.html`, factures de pose |
| B3 | **Contrat hors établissement** : délai « à convenir », garanties légales et pièces détachées absentes ; entreprise non signataire en ligne ; travaux possibles avant J+7 (S4) ; rétractation en ligne (S13) | absences : certain ; portée : à faire valider (juriste) | DOCS-A | suite J : devis particulier hors établissement → délai, garanties, pièces détachées présents ; planification avant J+7 sans urgence → refusée (si le juriste confirme) | `devis-v2.html` (client du golden : à vérifier) |
| B4 | **Médiateur** : impression non bloquée s'il manque ; absent du contrat de dépannage (D5) et de la location (D8) ; adresse postale absente | certain | geste de Gab + DOCS-A | suite J : D5 imprimé → médiateur présent ; Paramètres sans médiateur → devis à un particulier **non imprimé**, message clair | `devis-v2.html` (si l'adresse est ajoutée) |
| B5 | **Facture** : date de réalisation absente (acompte, solde) ; décompte détaillé absent (C8) ; « Total HT » absent en franchise | certain | AF4 (C8 + date) | suite L ou Y : facture de solde → lignes du devis (désignation, quantité, PU HT) et date de réalisation | `facture-acompte`, `facture-solde-*`, `facture-depannage`, XML `solde-380-*` |
| B6 | **Fiche fluides** : signature opérateur, contenants, cadres ; mail qui promet une double signature | certain | AF3 (décision 7) | golden « fiche fluide » à créer d'abord (il n'y en a aucun), puis cadres comparés au Cerfa | nouveau golden |
| B7 | **Attestation d'entretien** des PAC / clim de 4 à 70 kW : aucune (S28) | certain | DOCS-B (fonction nouvelle : exception écrite de Gab, règle 5) ; ou geste manuel de Gab sur papier en attendant | nouvelle suite : visite d'entretien terminée → attestation imprimable avec les rubriques de l'annexe de l'arrêté du 24/07/2020 (**à relire d'abord**) | nouveau golden |
| B8 | **Taux réduits** (si assujetti) : certification du client incomplète (5,5 %) ou absente (10 %, devis ancien format, factures) → taux normal de plein droit (S21) | certain | TVA | suite K ou L : devis 5,5 % et 10 % assujetti → mention du modèle S22 complète ; facture sans certification au devis → mention S22 « Par le règlement de la présente facture… » | `facture-solde-assujetti`, `solde-380-assujetti.xml`, `avoir-381-assujetti.xml` ; « À TRANCHER » concernés |
| B9 | **Franchise 2027** : numéro d'article CIBS contradictoire (L. 233-3 / L. 223-3) | certain (contradiction lue) | AF4 (C4) | suites F et L : document daté du 05/01/2027 → la mention retenue par la comptable | aucun golden Y (datés 2026) ; attendus des suites F et L |

### 4.2 À corriger (avant le premier client si possible, sinon avant le 01/09/2027)

| # | Non-conformité | Mission | Test rouge d'abord | Golden |
|---|---|---|---|---|
| C-a | Lieu d'exécution distinct du domicile absent du devis | DOCS-A | suite L : chantier à une autre adresse → « Lieu d'exécution : … » | `devis-v2.html` |
| C-b | Taux horaire TTC et décompte du temps absents des devis D1/D2 de dépannage et d'entretien | DOCS-A | suite L : devis dépannage → « taux horaire X TTC », « le temps est compté… » | `devis-v2.html` |
| C-c | Pièces remplacées : information absente (D1, D2, D5) | DOCS-A | suite J : D5 et devis dépannage → phrase présente | `devis-v2.html` |
| C-d | Déchets : modalités et coût absents (texte à identifier) | DOCS-A | suite L | `devis-v2.html` |
| C-e | Date du devis = date d'impression | DOCS-A | suite L : devis créé le J, imprimé à J+10 (horloge figée) → date J | `devis-v2.html` (si sa date de création diffère de REF) |
| C-f | Garanties légales absentes ; « garantie constructeur » seule | DOCS-A | suite L | `devis-v2.html` |
| C-g | Pas de CGV | DOCS-A (selon le juriste) | — | — |
| C-h | RNE absent partout | DOCS-A | suite L : Paramètres avec RNE → « RNE … » dans `docLegal` | tous les golden documents |
| C-i | Escompte absent (location, contrat) ; 40 € jamais sur la facture de contrat d'un pro (C6) | AF4 | suite L : F3, F4 pro → les deux phrases | aucun (F3, F4 sans golden aujourd'hui) |
| C-j | L215-1 : fenêtre mal calée, pas d'encadré ni de date limite | DOCS-A | suite S ou O : contrat 12 mois, résiliation 1 mois avant → tâche entre 4 et 2 mois avant l'échéance ; texte imprimé corrigé | `devis-v2.html` si le golden a un lot entretien (à vérifier) |
| C-k | Pas de PV de réception (réserves, date, levée) ; « bon pour réception » sur le PV de mise en service | DOCS-A | suite L | — |
| C-l | RGPD : destinataires, transferts, limitation, portabilité (devis) ; contact, durée chiffrée, transferts (`signer.html`) | DOCS-A | suite L ; banc de la page de signature | `devis-v2.html` |
| C-m | Avoir : nature forcée « biens et services » | AF4 | suite E : avoir d'une facture « Prestation de services » → même nature | `avoir-total.html`, `avoir-partiel.html` (selon le jeu) |
| C-n | 01/09/2027 : alerte SIREN (C7) ; option débits sans réglage ; XML sans adresse de livraison ni TVA de l'acheteur | AF4 / FACT | suites F, I | XML `solde-380-pro.xml` |
| C-o | Deux conditions de paiement contradictoires (C5) | AF4 | suite J | `facture-acompte.html` si particulier hors établissement |
| C-p | Location à un particulier : ni rétractation ni médiateur | DOCS-A | suite J | — |
| C-q | « Page 1/1 » en dur | AF4 | suite L : facture de 2 pages | tous |
| C-r | Mail fluides : « signée par vous et par moi » | AF3 | suite C | — |
| C-s | Livre des recettes : « micro-entreprise » et « 293 B » en dur | TVA (après décembre) | suite K | — |
| C-t | Mails : « 293 B » en dur | TVA | suite K | — |
| C-u | Garantie légale de conformité sur la facture (si la clim est dans les catégories) | AF4 (selon la comptable) | suite L | factures |

### 4.3 Confort
- Registre CSV fluides plus complet (SIRET, PRP, t éq. CO₂, BSFF) — AF3.
- Moyen de s'opposer écrit dans la demande d'avis et les rappels — DOCS-A (selon le juriste).
- Estimation sans blocs de rétractation et RGPD — DOCS-A.
- Cerfa 15498 pour une mise en service d'un équipement acheté par le client — AF3 (selon la réponse).
- Catégorie d'attestation de capacité (2027) sur la fiche — AF3.

### 4.4 Proposition de découpage (hypothèse, à décider par Gab)
| Mission | Contenu | Quand | Fichiers probables | Golden |
|---|---|---|---|---|
| **DOCS-A** (nouvelle, sans lien avec le statut) | B1, B2 (texte), B3, B4, C-a à C-h, C-j à C-l, C-p, confort | après les réponses du juriste (§ 6.2) ; **une seule mission sur le code à la fois** (après AF2, AF5, ou entre les deux selon la file) | `next-devis2.js`, `index.html` (`printDevis`, `docLegal`, `printPV`, `printContrat`), `next-documents.js`, `next-particuliers.js`, `next-signature.js`, `signer.html`, `next-mod-entretien.js`, `sw.js` | `devis-v2.html` et, pour le RNE, tous |
| **DOCS-B** (nouvelle, **fonction nouvelle** : gel des fonctionnalités, exception écrite de Gab) | B7 attestation d'entretien | avant le premier contrat d'entretien | nouveau fichier ou `next-mod-entretien.js` | nouveau golden |
| AF3 | B6, C-r, fluides | après la décision 7 | `next-cerfa.js`, `next-flu-guide.js`, `next-signature.js` | nouveau golden fiche fluide |
| AF4 | B5, B9, C-i, C-m, C-n, C-o, C-q, C-u | après les réponses de la comptable (§ 6.1) | `index.html` (factures), `next-avoir.js`, `next-einvoice.js`, `next-emission.js` | factures, avoirs, XML |
| TVA | B8, C-s, C-t, autoliquidation, N° TVA client, débits | après la décision de statut (décembre) | `next-regime.js`, `next-mod-autres.js`, `index.html` | `*-assujetti*`, « À TRANCHER » |
| FACT | e-reporting, logiciel de caisse, plateforme réelle | fin 2027 au plus tôt (file des missions) | — | — |

Estimation (hypothèse) : DOCS-A 3 à 4 jours de sessions ; DOCS-B 1,5 à 2 jours. Ton temps : un essai d'impression par document (≈ 20 min par mission), la fusion, les F5.

## 5. Ce qui dépend du statut choisi en décembre

| Si … | Ce qui change sur les documents | Mission |
|---|---|---|
| **Franchise en base** (EI ou société, tant que le chiffre d'affaires reste sous les seuils, S6) | mention de franchise sur chaque facture et devis (§ 2.12) ; pas de N° TVA ; pas de logiciel de caisse (S24) ; facture électronique B2B quand même au 01/09/2027 (S9) | AF4 (C4) |
| **Assujetti à la TVA** (cap actuel, selon le dossier AF2 : EURL à l'IS, TVA au réel) | N° TVA du vendeur sur toutes les factures (sauf ≤ 150 € HT) et celui du client pro ; taux par ligne et totaux par taux ; **certification des taux réduits** (S21, S22) ; « Autoliquidation » en sous-traitance BTP (S7, S23) ; option pour les débits si choisie (S1, S10, S23) ; **logiciel de caisse sécurisé** pour les paiements de particuliers (S24) ; **e-reporting** des ventes aux particuliers (S9) ; plus de « 293 B » nulle part (mails, livre) | TVA, FACT |
| **Micro-entreprise** | livre des recettes (`printRecettes`) tel quel ; « micro-entreprise » vrai | — |
| **Société** (EURL, SASU) | dénomination sociale, **forme juridique et capital**, adresse du siège (S1) ; « EI » disparaît (déjà géré par le statut, `next-documents.js`) ; RCS ou RNE selon l'activité (S13, S14) ; facture « Siret en cours d'attribution » si en cours d'immatriculation (S1) ; FEC à voir avec la comptable | DOCS-A, TVA |
| **Entreprise individuelle (EI) au réel** | « EI » obligatoire (S1) ; le reste selon le régime de TVA | — |

Ce qui **ne dépend pas** du statut : RGE, décennale, médiateur, contrat hors établissement, rétractation, L215-1, attestation d'entretien, fiche fluides, RGPD, pièces remplacées, déchets, lieu d'exécution, date du devis, décompte détaillé et date de réalisation sur la facture.

## 6. À faire valider par un professionnel (prêt à envoyer)

Copie le texte de chaque sous-section dans un mail. Joins si possible un devis, une facture d'acompte, une facture de solde, un avoir, un contrat de dépannage, un PV et une fiche fluides imprimés depuis la copie d'essai (données fictives).

### 6.1 Pour l'expert-comptable

> Bonjour,
> Je prépare mon logiciel de gestion (devis, factures) avant l'ouverture de mon entreprise de froid et climatisation. Pourriez-vous me confirmer les points suivants, document par document ? Je joins des exemples imprimés.
>
> **Factures (dépannage, acompte, solde, location, contrat d'entretien) et avoirs**
> - C1. Mention de franchise à partir du 01/01/2027 : faut-il écrire « TVA non applicable, art. 293 B du CGI » (admis jusqu'au 30/06/2028 selon le BOFiP BOI-RES-TVA-000253) ou un article du CIBS ? Les pages d'impots.gouv.fr citent tantôt L. 233-3, tantôt L. 223-3 : lequel est le bon ?
> - C2. Sur une facture en franchise, « Net à payer » suffit-il, ou faut-il « Total HT » et « Total TTC » ?
> - C3. La facture de solde d'un devis doit-elle reprendre chaque ligne du devis (désignation, quantité, prix unitaire HT) et la date de fin des travaux ? Et la facture d'acompte, la date de versement ?
> - C4. « Paiement à réception de facture » vaut-il « date à laquelle le règlement doit intervenir » ?
> - C5. Particulier hors établissement : la facture doit-elle porter seulement « exigible à partir du <date> (L221-10) », sans « paiement à réception » ?
> - C6. Le SIRET imprimé suffit-il pour la mention « numéro SIREN » ? Faut-il aussi le numéro RNE sur les factures ?
> - C7. Les séries de numéros « TEST- » (démonstration) et « ESSAI- » (anciennes factures d'essai) et la série « AV- » des avoirs sont-elles acceptables ?
> - C8. Une climatisation ou une PAC vendue à un particulier entre-t-elle dans les catégories qui imposent la mention de la garantie légale de conformité sur la facture (décret 2021-609) ?
> - C9. Un avoir doit-il reprendre exactement la « nature de l'opération » de la facture qu'il annule ?
>
> **Si je suis assujetti à la TVA (selon notre décision de décembre)**
> - C10. Taux réduits : je propose d'imprimer sur le devis et, à défaut, sur la facture, les modèles de mention du BOFiP (BOI-LETTRE-000280). La pose d'une climatisation est-elle à 10 % pour la main-d'œuvre seulement (matériel à 20 %) ? L'entretien d'une clim chez un particulier : 10 % ? Une PAC air/air éligible : 5,5 % sur quoi exactement ?
> - C11. Sous-traitance pour une entreprise du BTP : mention « Autoliquidation » ; autre chose ?
> - C12. Dois-je opter pour la TVA d'après les débits ? Si oui, la mention est-elle obligatoire dès le 01/09/2027 ?
> - C13. Logiciel de caisse sécurisé : comment enregistrer les paiements des particuliers (mon logiciel n'est pas certifié) ?
> - C14. Faut-il un FEC, ou tenez-vous la comptabilité à partir de mes exports (livre des recettes, facturier) ?
> - C15. E-reporting des ventes aux particuliers : quelle plateforme, à partir de quand ?
>
> **Conservation**
> - C16. Durées de conservation proposées dans mon registre RGPD (10 ans pour factures et devis signés, 5 ans pour les fiches fluides) : d'accord ?
>
> Merci.

### 6.2 Pour le juriste de la chambre de métiers

> Bonjour,
> Je serai artisan frigoriste-climaticien (pose et entretien de climatisations et de pompes à chaleur air/air, dépannage) chez des particuliers et des professionnels. Mon logiciel imprime mes devis, contrats et procès-verbaux, et permet la signature en ligne. Pourriez-vous vérifier les points suivants ? Je joins des exemples.
>
> **Devis de travaux et de dépannage**
> - J1. Mentions de l'arrêté du 24/01/2017 : mon devis imprime la date (aujourd'hui celle d'impression : à corriger), l'adresse du client mais pas toujours le lieu du chantier, un taux horaire HT, pas les modalités de décompte du temps, ni l'information sur la conservation des pièces remplacées. Que faut-il exactement ?
> - J2. Faut-il indiquer sur le devis les modalités et le coût d'enlèvement des déchets ? Quel texte ?
> - J3. Assurance : quelles mentions exactes (assureur, contrat, couverture) ? L'attestation décennale doit-elle être jointe à chaque devis et facture de pose d'une clim ou d'une PAC ? Pour un simple dépannage ?
> - J4. Numéro RNE : obligatoire sur devis, factures et contrats ?
> - J5. Label RGE : si je ne suis pas RGE, dois-je écrire sur chaque devis de PAC ou de clim réversible pour un particulier que je ne le suis pas et les conséquences sur les aides (L224-114) ? Quel texte type ?
> - J6. Garanties : « Matériel garanti selon la garantie constructeur » suffit-il, ou faut-il rappeler les garanties légales (conformité, vices cachés, parfait achèvement, biennale, décennale) ?
> - J7. Dois-je avoir des conditions générales de vente, ou mon devis et ses mentions suffisent-ils pour un particulier ?
> - J8. Le médiateur : nom, adresse postale et site sur le devis ; faut-il aussi les mettre sur la facture ?
>
> **Contrats avec un particulier hors établissement (chez lui) ou à distance (devis envoyé par mail, signé en ligne)**
> - J9. Est-il interdit de faire les travaux (non urgents) avant 7 jours après la signature, même si le client demande l'exécution anticipée ? (service-public, fiche « Démarchage à domicile », l'écrit)
> - J10. « Délai d'exécution : à convenir ensemble à la commande » est-il acceptable ?
> - J11. Faut-il indiquer la disponibilité des pièces détachées ?
> - J12. Le délai de rétractation de 14 jours : pour une PAC fournie et posée, part-il de la signature ou de la livraison du matériel ? Mon formulaire de rétractation est-il conforme au modèle ?
> - J13. Signature en ligne : seul le client signe ; l'entreprise doit-elle aussi signer l'exemplaire ? Un fichier HTML téléchargé par le client est-il un « support durable » ? Ma signature électronique simple (nom, image, date et heure du serveur, adresse IP, navigateur, empreinte SHA-256 du document) suffit-elle comme preuve ?
> - J14. Depuis le 19/06/2026 (« un clic pour se rétracter ») : ma page de signature en ligne m'oblige-t-elle à proposer la rétractation en ligne ?
>
> **Contrat d'entretien**
> - J15. Reconduction tacite (L215-1) : je comprends que l'information doit partir entre 3 mois et 1 mois avant la **date limite de résiliation** (et non avant l'échéance), dans un encadré avec cette date. Exact ? Faut-il une résiliation en ligne si le contrat est signé en ligne ?
> - J16. Attestation d'entretien des PAC et clim de 4 à 70 kW (arrêté du 24/07/2020) : quel contenu exact, dans quel délai, sur papier ou électronique ?
>
> **Réception et procès-verbaux**
> - J17. Mon « PV de mise en service » signé « bon pour réception » vaut-il réception des travaux ? Faut-il un PV de réception avec réserves pour faire partir la décennale ?
>
> **Fluides frigorigènes**
> - J18. Une fiche d'intervention produite par mon logiciel, reprenant tous les cadres du Cerfa 15497\*04, est-elle valable, ou faut-il le formulaire officiel ou l'application du ministère ? (question aussi pour la DREAL ou mon organisme d'attestation de capacité)
> - J19. Quand le client a acheté lui-même son équipement préchargé, dois-je signer un contrat Cerfa 15498 ?
>
> **Données personnelles et messages**
> - J20. Mes textes d'information (devis, page de signature) : manque-t-il quelque chose (destinataires, transferts hors UE, contact) ?
> - J21. La demande d'avis Google et le rappel d'entretien envoyés par SMS à un client doivent-ils contenir un moyen de s'opposer (« STOP ») ?
>
> Merci.

### 6.3 Pour la DREAL ou l'organisme d'attestation de capacité (fluides)
J18 et J19 ci-dessus ; et : « Ma déclaration annuelle des fluides : à vous au plus tard le 31/01, ou à l'ADEME ? »

## 7. Ce qui n'a pas pu être vérifié

- **Légifrance** (réponse 403) : aucun article relu. À relire avant toute correction : code de commerce L441-9, R526-27 ; CGI 289, 293 B, 279-0 bis, 278-0 bis A, 283-2 nonies, annexe II 242 nonies A ; CIBS (numéro de l'article de franchise) ; code de la consommation L111-1, L215-1 à L215-5, L221-5 à L221-28 (et l'annexe : modèle de formulaire de rétractation), L223-1, L223-8, L224-114, L616-1, R616-1 ; code de l'artisanat L132-1, R132-1 ; code des assurances L243-2, A243-3 ; code civil 1366, 1367, 1792 et suivants ; code de l'environnement R224-44 à R224-44-5, R543-82, R543-83, R543-99 et suivants ; arrêtés du 24/01/2017, du 24/07/2020 (entretien des systèmes thermodynamiques, annexe), du 29/02/2016, du 21/11/2025 ; décret 2021-609 ; texte sur la gestion des déchets dans les devis ; ordonnance 2025-1247.
- **economie.gouv.fr (DGCCRF)** (403) : fiches « démarchage téléphonique », « mentions d'une facture » non lues.
- **formulaires.service-public.gouv.fr** (connexion coupée) : notice 52064\*04 du Cerfa 15497 non relue ; version du Cerfa vue seulement sur service-public (vérifiée le 01/07/2024).
- **urssaf.fr** (pas de réponse) ; **CNIL** : pages sur la prospection par SMS non lues (J21).
- **BOFiP** : les commentaires des nouvelles mentions de la facture électronique n'ont pas été trouvés (la page des mentions générales date du 18/10/2013, S32) ; elles viennent de service-public (S1).
- Le projet de décret du 12/06/2026 sur la fiche fluides : publication non vérifiée.
- **Project** : plan du 28/10, recherche fluides du 25/10, dossier FACT, mail préparé pour la comptable et ses réponses : non lus.
- **Code** : rien n'a été exécuté (aucun rendu d'impression) ; l'ordre des enveloppes (`nxrgFixDoc` et remplacement CIBS, blocs ajoutés à l'estimation) est déduit de la lecture. Les jeux des golden (`devis-v2.html` a-t-il un lot entretien, un particulier hors établissement ?) sont à regarder par l'exécutant.
- Aucune règle n'a été tranchée ici : chaque correction attend la réponse citée (§ 6) ou une source officielle relue par l'exécutant.

## 8. Sources (toutes consultées le 11/11/2026)

| # | Source | Date affichée par la source |
|---|---|---|
| S1 | service-public, « Mentions obligatoires sur une facture » — https://entreprendre.service-public.gouv.fr/vosdroits/F31808 | vérifié le 11/08/2026 |
| S2 | service-public, « Climaticien » — https://entreprendre.service-public.gouv.fr/vosdroits/F39053 | vérifié le 21/02/2026 |
| S3 | service-public, « Devis obligatoire : activités concernées » — https://entreprendre.service-public.gouv.fr/vosdroits/F31144 | vérifié le 09/09/2022 |
| S4 | service-public, « Démarchage à domicile : règles à respecter » — https://entreprendre.service-public.gouv.fr/vosdroits/F23224 | vérifié le 11/08/2026 |
| S5 | service-public, « Médiation des litiges de la consommation » — https://entreprendre.service-public.gouv.fr/vosdroits/F33338 | vérifié le 16/10/2026 |
| S6 | service-public, « Franchise en base de TVA » — https://entreprendre.service-public.gouv.fr/vosdroits/F21746 | vérifié le 01/01/2026 |
| S7 | service-public, « Autoliquidation de la TVA en cas de sous-traitance dans le BTP » — https://entreprendre.service-public.gouv.fr/vosdroits/F31983 | vérifié le 23/09/2026 |
| S8 | service-public, « Taux de TVA pour les travaux de rénovation d'un logement » — https://entreprendre.service-public.gouv.fr/vosdroits/F23568 | vérifié le 21/02/2026 |
| S9 | service-public, « Comment se mettre en conformité avec l'obligation de facturation électronique ? » — https://entreprendre.service-public.gouv.fr/vosdroits/F39785 | vérifié le 07/08/2026 |
| S10 | service-public, « Quelles sont les dates d'exigibilité en matière de TVA ? » — https://entreprendre.service-public.gouv.fr/vosdroits/F31412 | vérifié le 25/09/2026 |
| S11 | service-public, « Délais de paiement entre professionnels et pénalités de retard » — https://entreprendre.service-public.gouv.fr/vosdroits/F23211 | vérifié le 07/08/2026 |
| S12 | service-public, « Tout savoir sur la facturation » — https://entreprendre.service-public.gouv.fr/vosdroits/F23208 | vérifié le 07/08/2026 |
| S13 | service-public, « Conditions générales de vente (CGV) » — https://entreprendre.service-public.gouv.fr/vosdroits/F33527 | vérifié le 01/07/2026 |
| S14 | service-public, « Documents commerciaux d'une entreprise individuelle » — https://entreprendre.service-public.gouv.fr/vosdroits/F37370 | vérifié le 08/12/2025 |
| S15 | service-public, « Garantie décennale des constructeurs » — https://entreprendre.service-public.gouv.fr/vosdroits/F2034 | vérifié le 10/04/2026 |
| S16 | service-public, « Obtenir le label RGE » — https://entreprendre.service-public.gouv.fr/vosdroits/F32251 | vérifié le 09/06/2026 |
| S17 | service-public, « Quels sont les délais de conservation des documents pour les entreprises ? » — https://entreprendre.service-public.gouv.fr/vosdroits/F10029 | vérifié le 01/07/2024 |
| S18 | service-public, « Peut-on résilier un contrat de prestation de services à tacite reconduction ? » — https://www.service-public.gouv.fr/particuliers/vosdroits/F33991 | vérifié le 20/03/2026 |
| S19 | service-public, Cerfa 15497\*04 — https://entreprendre.service-public.gouv.fr/vosdroits/R43122 | vérifié le 01/07/2024 |
| S20 | BOFiP, BOI-RES-TVA-000253 (dispositions transitoires de la recodification de la TVA dans le CIBS) — https://bofip.impots.gouv.fr/bofip/14901-PGP.html/identifiant=BOI-RES-TVA-000253-20261007 | publié le 07/10/2026 |
| S21 | BOFiP, BOI-TVA-LIQ-30-20-90-40 (taux réduits, modalités d'application) — https://bofip.impots.gouv.fr/bofip/1742-PGP.html | publié le 09/09/2026 |
| S22 | BOFiP, BOI-LETTRE-000280 (modèles de mention valant certification) — https://bofip.impots.gouv.fr/bofip/14834-PGP.html | publié le 09/09/2026 |
| S23 | BOFiP, BOI-TVA-DECLA-30-20-20-30 (mentions spécifiques : autoliquidation, débits) — https://bofip.impots.gouv.fr/bofip/1531-PGP.html | publié le 08/01/2025 |
| S24 | BOFiP, BOI-TVA-DECLA-30-10-30 (logiciels de caisse) — https://bofip.impots.gouv.fr/bofip/10691-PGP.html | publié le 25/03/2026 |
| S25 | impots.gouv.fr, « En tant que micro-entrepreneur, puis-je être redevable de la TVA ? » — https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-puis-je-etre-redevable-de-la-tva | modifié le 14/10/2026 |
| S26 | impots.gouv.fr, « Je suis micro-entrepreneur … Ai-je des obligations déclaratives en matière de TVA ? » — https://www.impots.gouv.fr/professionnel/questions/je-suis-micro-entrepreneur-ou-la-tete-dune-micro-entreprise-ai-je-des | modifié le 14/10/2026 |
| S27 | impots.gouv.fr, « Les régimes d'imposition à la TVA » — https://www.impots.gouv.fr/professionnel/les-regimes-dimposition-la-tva | modifié le 21/05/2026 |
| S28 | ecologie.gouv.fr, « Entretien et inspection des systèmes de chauffage et de climatisation » — https://www.ecologie.gouv.fr/politiques-publiques/entretien-inspection-systemes-chauffage-climatisation | mis à jour le 14/12/2022 |
| S29 | ecologie.gouv.fr, FAQ « Chaudières et systèmes thermodynamiques » (PDF) — https://www.ecologie.gouv.fr/sites/default/files/documents/FAQ%20Inspection%20entretien%20chauffage%20et%20clim.pdf | non datée dans le texte lu |
| S30 | ecologie.gouv.fr, « Substances à impact climatique, fluides frigorigènes » — https://www.ecologie.gouv.fr/politiques-publiques/substances-impact-climatique-fluides-frigorigenes | mis à jour le 04/11/2026 |
| S31 | CNIL, « Conformité RGPD : information des personnes et transparence » — https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence | mis à jour le 26/07/2019 |
| S32 | BOFiP, BOI-TVA-DECLA-30-20-20-10 (mentions obligatoires générales) — https://bofip.impots.gouv.fr/bofip/140-PGP.html | publié le 18/10/2013 (antérieur à la réforme) |
