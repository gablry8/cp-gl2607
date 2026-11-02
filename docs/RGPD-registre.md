# Registre des activités de traitement — ClimPilot (version du 25/10/2026)

> Mis à jour le 25/10/2026 à partir du code de la 1.13.0 (relu), de l'audit M4 (C9, C13, C18), de l'inventaire de l'analyse fonctionnelle du 25/10 et d'une recherche de sources officielles faite le 25/10 (liste datée en fin de document). Remplace le brouillon du 02/10/2026.
> **À compléter à la création de l'entreprise** (dénomination, SIRET, contact). Les **durées sont des propositions**, à valider avec la comptable avant usage. Ce document ne remplace pas un conseil juridique.
> Certitude : **certain** (texte officiel lu, ou code lu) · **probable** · **hypothèse** (proposition sans texte) · **non trouvé**.
> Modèle suivi : registre simplifié de la CNIL (https://www.cnil.fr/fr/la-cnil-publie-un-nouveau-modele-de-registre-simplifie).

## Responsable du traitement
- Dénomination : **à compléter à la création** (nom de l'entreprise, avec « EI » pour un entrepreneur individuel), adresse de l'établissement, SIRET.
- Contact pour les demandes sur les données : une adresse e-mail dédiée (conseillé), écrite aussi sur les devis et la page de signature.
- Délégué à la protection des données : non obligatoire pour cette activité (probable : ni suivi à grande échelle, ni données sensibles à grande échelle ; RGPD art. 37, à relire).
- **Pourquoi un registre pour une entreprise sans salarié** (certain, CNIL) : la dérogation « moins de 250 salariés » ne vaut que pour les traitements occasionnels, et la CNIL cite justement « gestion des clients/prospects et des fournisseurs » comme traitement **non occasionnel**, donc à inscrire. Format libre (le modèle simplifié de la CNIL est un tableur ; ce document suit sa liste minimale).

## Traitement 1 — Clients, devis, interventions, contrats, factures, encaissements
| Rubrique | Contenu (lu dans le code de la 1.13.0) |
|---|---|
| Finalités | établir les devis ; planifier et réaliser les interventions ; contrats d'entretien et locations ; facturer, encaisser, relancer ; livre des recettes et comptabilité ; rappels aux clients (veille de rendez-vous, entretien à renouveler) ; demande d'avis ; tarifs et factures d'achat des fournisseurs |
| Base légale | exécution du contrat (art. 6.1.b RGPD) ; obligations légales (facturation, comptabilité, facture électronique : 6.1.c) ; intérêt légitime (6.1.f) pour les rappels et la demande d'avis à un client existant, avec possibilité de refus (l'appli garde « pas pour ce client » et « plus de messages ») |
| Personnes | clients particuliers ; contacts des clients professionnels ; contacts chez les fournisseurs |
| Données | nom ; adresse, téléphone, e-mail ; SIREN (professionnels) ; adresse d'intervention et ses coordonnées géographiques (calcul des distances) ; équipements (marque, modèle, fluide, charge) ; contenu des devis et factures ; paiements (date, mode, montant) ; notes libres ; journal des messages envoyés ; heures pointées par chantier. **Relevé bancaire** : lu sur l'appareil, **jamais enregistré ni envoyé** ; seule une empreinte des lignes déjà rapprochées est gardée (`next-banque.js` l. 3-7) |
| Destinataires | l'entreprise ; sa comptable (exports : livre des recettes, facturier, pack comptable) ; l'administration sur demande (impôts, Urssaf) ; plateforme de facturation électronique SUPER PDP pour les factures entre professionnels, à partir de la facturation réelle (SUPER G SAS, Paris : sous-traitant, hébergement dans l'UE, aucun sous-traitant ultérieur déclaré, factures archivées 10 ans ; ses CGU du site, lues le 25/10) |
| Services tiers appelés par l'appli | **IGN Géoplateforme** (`data.geopf.fr`) : l'**adresse** du client est envoyée pour calculer les distances (devis, planning, « Ma journée ») ; **API Recherche d'entreprises** (`recherche-entreprises.api.gouv.fr`) : le nom ou le SIREN de l'entreprise cliente cherchée. Deux services publics français ; conservation de leurs journaux d'appels : non publiée |
| Sous-traitants (hébergement) | **Supabase** (synchronisation et sauvegardes ; base en Irlande `eu-west-1`, vérifié le 25/10/2026 ; entité contractante Supabase Pte. Ltd., Singapour ; contrat de sous-traitance intégré aux conditions, version du 01/08/2026) ; **GitHub Pages** (publie l'appli et la page de signature : voit l'adresse IP de chaque visiteur et la journalise pour sa sécurité ; aucune autre donnée client ne passe par lui) ; **Netlify** (copies d'essai, données fictives seulement) |
| Transferts hors UE | **possibles, limités** : accès du support de Supabase (équipe mondiale) quand l'entreprise demande de l'aide ou en cas d'incident, et quelques traitements d'exploitation, vers Singapour (Supabase Pte. Ltd.) et les États-Unis (Supabase, Inc.) ; garanties : clauses contractuelles types (module 2) intégrées au contrat de sous-traitance. GitHub (États-Unis) pour l'adresse IP des visiteurs : certifié Data Privacy Framework. Aucun autre connu : SUPER PDP héberge dans l'UE (sa politique, certain) ; IGN et API Recherche d'entreprises sont des services publics français (lieu d'hébergement non publié : probable France) |
| Durées | voir « Durées de conservation » |
| Sécurité | voir « Sécurité (résumé) » plus bas |

## Traitement 2 — Signature électronique des devis et des fiches fluides
| Rubrique | Contenu |
|---|---|
| Finalités | recueillir l'accord du client et en garder la preuve ; signature conjointe de la fiche d'intervention fluides quand elle est exigée ; remise de l'exemplaire signé |
| Base légale | exécution du contrat ; intérêt légitime à conserver la preuve ; obligation légale pour la conservation des contrats électroniques avec un particulier à partir de 120 € (code de la consommation L213-1) et pour la fiche fluide (code de l'environnement, R.543-82) |
| Données | nom saisi, image de la signature, date et heure, adresse IP, navigateur, empreinte du document, consentements (demande expresse, support durable), date de téléchargement de l'exemplaire, motif d'un refus ; copie du document signé (nom, adresse, montants) |
| Hébergement | Supabase (base en Irlande ; transferts limités décrits au traitement 1) ; page publique de signature publiée par GitHub Pages (voit l'IP du visiteur), accès par un lien à jeton unique |
| Durées | voir « Durées de conservation » |

## Traitement 3 — Assistant (dictée, lecture de plaques, factures fournisseurs)
| Rubrique | Contenu |
|---|---|
| Finalités | transformer les dictées en notes, tâches, propositions de devis, de rendez-vous et de messages ; lire une plaque signalétique ; lire une facture fournisseur |
| Données envoyées | le texte dicté (peut contenir des noms et des adresses de clients) ; **à chaque appel**, un résumé de l'activité (ligne « Minimisation ») ; les photos de plaques ; les factures fournisseurs (PDF ou photo) ; le catalogue |
| Destinataire / sous-traitant | **Anthropic Ireland, Limited** (API Claude), appelée par la fonction serveur `assistant` ; contrat de sous-traitance inclus dans les conditions commerciales ; pas d'entraînement sur les données ; suppression sous 30 jours au plus (contenu signalé par leurs contrôles : jusqu'à 2 ans) ; **transfert hors UE** (stockage aux États-Unis, seule zone proposée), encadré par les clauses contractuelles types du DPA |
| Gardé côté entreprise | propositions et notes dans la boîte de réception (`climpilot_inbox`) ; journal des coûts sans contenu (`climpilot_ai_usage` : modèle, jetons, coût) |
| Minimisation | envoyés : noms des clients, villes, statuts et dates des devis, interventions, locations et contrats récents, tâches ouvertes, catalogue ; jamais : téléphones, e-mails, adresses complètes, montants, SIREN |

## Traitement 4 — Sauvegardes, synchronisation, exports
| Rubrique | Contenu |
|---|---|
| Finalités | ne pas perdre de données ; travailler sur plusieurs appareils |
| Données | copie complète des données de l'appli |
| Lieux | les appareils de l'entreprise (stockage du navigateur ; appareils verrouillés) ; Supabase (Irlande) ; les fichiers d'export téléchargés et rangés hors du serveur |
| Durées | sauvegardes serveur : règle existante (45 jours, 13 mois pour une par mois, 120 jours pour les autres) ; exports : voir les durées ci-dessous |
| Effacement d'un client | il disparaît des appareils et de l'état serveur, mais reste jusqu'à 13 mois dans les sauvegardes serveur et dans les anciens exports (à écrire tel quel dans la réponse à une demande d'effacement) |

## Traitement 5 — Fiches d'intervention sur les fluides frigorigènes (obligation légale)
| Rubrique | Contenu |
|---|---|
| Finalités | établir, faire signer et conserver les fiches d'intervention ; bilan annuel des fluides ; déclarations (BSFF via Trackdéchets pour les déchets de fluides) |
| Base légale | obligation légale (code de l'environnement, R.543-82 ; règlement (UE) 2024/573, art. 7) |
| Personnes / données | détenteurs (exploitants) des équipements : nom, adresse, SIRET ; équipement ; quantités de fluide ; signature |
| Durées | **au moins 5 ans** à compter de la signature, par l'entreprise et par le détenteur (certain : notice du Cerfa 15497\*04) |

## Traitement 6 — Demandes et réservations venant du site (quand le site sera en ligne)
| Rubrique | Contenu |
|---|---|
| Finalités | répondre à une demande de devis ou de dépannage ; réserver un créneau |
| Base légale | mesures précontractuelles à la demande de la personne (6.1.b) |
| Données | nom, téléphone, e-mail, adresse, besoin, créneau demandé, empreinte de l'adresse IP (anti-abus), date |
| Destinataires | l'entreprise ; Supabase ; Google Agenda pour les demi-journées occupées **sans nom** (partie B de M0, pas encore déployée) |
| Durées | voir « Durées de conservation » |
| À faire avant la mise en ligne | texte d'information sur le formulaire du site |

## Durées de conservation (propositions, à valider)
Propositions (**à valider avec la comptable**). Chaque ligne dit d'où vient la durée. « Base active » = dans l'appli ; « archive » = gardé à part, seulement pour une obligation ou une preuve. La règle de fond de la CNIL (certain, référentiel « gestion des activités commerciales », délibération 2021-131) : les données du contrat sont gardées pendant la relation, puis en archive « pour un délai raisonnable » s'il y a une obligation légale ou pour se constituer une preuve, « dans la limite du délai de prescription applicable ».

| Donnée | Durée proposée | Fondement | Niveau |
|---|---|---|---|
| Factures, avoirs, livre des recettes (pièces comptables) | **10 ans** à compter de la clôture de l'exercice | code de commerce, art. L123-22 (« conservés pendant dix ans ») ; service-public F10029 | certain |
| Devis signé / contrat avec un **particulier**, à partir de 120 € | jusqu'aux travaux, puis **10 ans** après leur réalisation, avec la preuve de signature ; accès du client sur demande à tout moment | code de la consommation L213-1, D213-1 (120 €), D213-2 (10 ans) ; service-public F10029 | certain |
| Devis signé, PV de réception, fiche de mise en service d'une **installation** (particulier ou professionnel) | **10 ans après la réception** | garantie décennale : 10 ans à compter de la réception (service-public F2958, vérifié le 25/09/2026), assurée par l'entreprise ; preuve en cas de litige (référentiel CNIL 2021-131) | probable (PAC et clim ne sont pas citées : décennale si l'appareil fait corps avec le bâtiment, biennale de 2 ans sinon) |
| Devis signé / contrat avec un **professionnel** (dépannage, entretien) | **5 ans** après la fin des travaux, avec la preuve | prescription de 5 ans (code de commerce L110-4 entre commerçants ; pour un artisan, la règle générale du code civil, art. 2224, donne aussi 5 ans : à relire) ; service-public F10029 (contrats d'une relation commerciale : 5 ans) | probable |
| Devis **refusé, expiré ou annulé**, et sa page de signature (nom, IP) | **1 an** après l'expiration (proposition) | aucun texte (non trouvé : le mot « devis » n'apparaît ni dans le référentiel CNIL ni dans F10029) ; principe « durée nécessaire » (RGPD art. 5.1.e) ; pour comparaison, la CNIL retient 3 ans pour un prospect | hypothèse |
| Fiche d'intervention fluide (et sa signature) | **5 ans** au moins après la signature (proposition : 5 ans, ou plus si un contrat en cours la concerne) | code de l'environnement R.543-82 ; notice du Cerfa 15497\*04 | certain |
| Fiche client sans facture ni devis signé (prospect, demande du site non suivie) | **3 ans** après la collecte ou le dernier contact venant de lui | référentiel CNIL 2021-131 (« prospect non client ») | certain |
| Fiche client avec factures | la durée de la relation, puis seulement ce qui figure sur les factures et contrats (durées ci-dessus) | idem + L123-22 | probable |
| Journal des messages envoyés (rappels, avis) | **1 an** (proposition : il sert à ne pas renvoyer deux fois) | principe de durée nécessaire | hypothèse |
| Empreinte de l'IP d'une demande venue du site (anti-abus) | **6 mois** (proposition) | CNIL : journaux « sur une période glissante comprise entre six mois et un an » (fiche « Tracer les opérations », 2024 ; délibération 2021-122) ; pour les IP suivies contre le piratage, la FAQ de 2019 disait « ne pouvant excéder six mois » | probable |
| Boîte de réception de l'assistant (propositions traitées) | **90 jours** après traitement (proposition) | durée nécessaire | hypothèse |
| Journal des coûts de l'assistant (sans contenu) | **13 mois** (plafond mensuel, comparaison d'une année sur l'autre) | durée nécessaire | hypothèse |
| Sauvegardes serveur | règle actuelle : quotidiennes **45 jours**, une par mois **13 mois**, autres **120 jours** | déjà codé (`supabase/schema.sql` l. 116-123) | certain |
| Exports complets (fichiers hors du serveur) | garder les **4 derniers hebdomadaires** et **1 par mois sur 12 mois**, supprimer les autres (proposition) | durée nécessaire ; la CNIL demande des sauvegardes régulières et à l'écart | hypothèse |

En pratique : **10 ans pour presque tout ce qui est signé ou facturé** ; 5 ans pour le dépannage et l'entretien entre professionnels et pour les fiches fluides ; 1 an pour ce qui n'a pas abouti ; 3 ans pour un contact sans suite.

## Droits des personnes
- Demandes (accès, rectification, effacement, limitation, opposition, portabilité) : réponse **dans un délai d'un mois** (RGPD, art. 12.3), à l'adresse de contact ci-dessus.
- L'effacement est limité par les obligations de conservation (factures, fiches d'intervention fluides).
- Un client effacé disparaît des appareils et de l'état synchronisé, mais reste dans les sauvegardes serveur jusqu'à leur expiration (13 mois au plus) et dans les anciens exports : à écrire tel quel dans la réponse.
- Opposition aux rappels et à la demande d'avis : déjà prévue dans l'appli (« pas pour ce client », « plus de messages »).
- Réclamation possible auprès de la CNIL (https://www.cnil.fr).

## Sécurité (résumé)
Accès par compte et mot de passe ; règles d'accès par compte sur la base de données ; factures figées côté serveur ; sauvegardes serveur automatiques ; appareils verrouillés par code ou empreinte ; sauvegarde hebdomadaire hors du serveur. Les mesures détaillées et leur suivi sont tenus dans la documentation interne (non publiée).

## Violations de données
Tout incident (téléphone perdu, mot de passe volé, envoi à la mauvaise personne) est noté dans un registre interne des violations, **dans tous les cas**. S'il présente un risque pour les personnes : notification à la CNIL dans les meilleurs délais et, si possible, dans les 72 heures ; si le risque est élevé : information des personnes concernées (RGPD, art. 33 et 34).

## Points encore à compléter
1. Dénomination, adresse, SIRET et adresse e-mail de contact : à la création de l'entreprise.
2. Durées de conservation : validation par la comptable.
3. Textes d'information : page de signature (prévu avec les effacements automatiques) et formulaire du site (avant sa mise en ligne).
4. Relecture du registre une fois par an et à chaque nouvel outil (site, agenda, nouveau prestataire).

## Sources (consultées le 25/10/2026)
Textes et autorités
- CNIL, « RGPD : le registre des activités de traitement » : https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement — modèle simplifié : https://www.cnil.fr/fr/la-cnil-publie-un-nouveau-modele-de-registre-simplifie
- CNIL, référentiel « gestion des activités commerciales », délibération n° 2021-131 du 23/09/2021 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045538574
- CNIL, recommandation journalisation, délibération n° 2021-122 du 14/10/2021 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044272396 — fiche « Tracer les opérations » : https://www.cnil.fr/fr/securite-tracer-les-operations — FAQ startups (2019) : https://www.cnil.fr/fr/foire-aux-questions-pour-les-startup
- CNIL, information des personnes : https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence
- CNIL, violations : https://www.cnil.fr/fr/violations-de-donnees-personnelles-les-regles-suivre — téléservice : https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles
- Code de commerce L123-22 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006219327/ — L110-4 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000027725867
- Code de la consommation L213-1 : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221221/ — D213-1 et D213-2 : https://www.legifrance.gouv.fr/codes/id/LEGISCTA000032807206
- Code civil art. 1363-1368 : https://www.legifrance.gouv.fr/codes/id/LEGISCTA000032037829 — décret 2017-1416 : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000035676246 — Cass. 3e civ., 5 mars 2026, n° 24-21.034 : https://www.legifrance.gouv.fr/juri/id/JURITEXT000053764915
- ANSSI, guide de sélection du niveau des signatures : https://cyber.gouv.fr/documents/366/anssi-eidas-guide-niveau-signature.pdf
- Service-public : durées de conservation F10029 : https://entreprendre.service-public.gouv.fr/vosdroits/F10029 — garanties après réception F2958 : https://www.service-public.gouv.fr/particuliers/vosdroits/F2958

Prestataires
- Supabase : DPA (01/08/2026) https://supabase.com/legal/customer-resources/data-processing-addendum — FAQ résidence et transferts (06/10/2026) https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq — sous-traitants (liste du 12/10/2026) https://supabase.com/legal/subprocessors — conditions https://supabase.com/terms
- Anthropic : conditions commerciales https://www.anthropic.com/legal/commercial-terms — DPA https://www.anthropic.com/legal/data-processing-addendum — conservation API https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data — Covered Models https://privacy.claude.com/en/articles/15425996-data-retention-practices-for-covered-models — zones https://platform.claude.com/docs/en/manage-claude/data-residency
- Liste officielle du Data Privacy Framework : https://www.dataprivacyframework.gov/list (Netlify et GitHub : actifs ; Supabase et Anthropic : absents)
- GitHub Pages : https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- IGN Géoplateforme : https://cartes.gouv.fr/cgu/ — API Recherche d'entreprises : https://recherche-entreprises.api.gouv.fr/docs/
- SUPER PDP : https://www.superpdp.tech/legal/16 et https://www.superpdp.tech/legal/11
