# ClimPilot — liste « APRÈS PRO v1 » (les idées de Gabriel, datées : rien n'est perdu)

> Créée le 25/10/2026 (relecture P10) à partir du TOPO du 24/10 (§ 11), de l'analyse fonctionnelle du 25/10 (§ 6) et de l'étude RGE du 25/10 (§ 6).
> **Règle (TOPO § 6)** : aucune de ces idées n'entre dans le code avant le palier « PRO v1 ». Ce n'est pas un refus : c'est l'ordre.
> Les **BUGS** trouvés par l'analyse fonctionnelle ne sont PAS ici : ils sont à corriger avant PRO v1 (`docs/MISSION-AF-CORRECTIONS.md`, « AF » = analyse fonctionnelle).
> On relit cette liste au point de décision de **fin février 2027** et on choisit l'ordre ensemble.
> Colonne « État » : ce qui existe déjà dans le code (certain, d'après les comptes rendus) ; « Prérequis » : ce qui doit être fait avant.

## 1. Idées de Gabriel (28/09 → 24/10/2026)

| Date | Idée | État réel | Prérequis | Quand (proposition) |
|---|---|---|---|---|
| 28/09 | Assistant vocal complet : dicter devis, notes, rappels, réponses clients, rapports d'intervention ; il pose des questions quand un point est flou ; notes et tâches enregistrées seules, le reste validé ; plafond API 5 €/mois | partiel (`next-assistant.js` : notes, tâches, machines) | P2 (moteur de devis isolé) | après P2 |
| 28/09 | Signature en ligne des devis par le client | **fait** (en production depuis 1.10) | — | — |
| 28/09 | Fiche fluide Cerfa remplie toute seule depuis la photo de la plaque, autres Cerfa | partiel (mode guidé, lecture de plaque Tesseract) ; PDF jugé « pas bon » → **traité comme BUG** (corrections C1-C3) | décision « Cerfa fidèle » | bug : avant PRO v1 ; le reste après |
| 29/09 | Devis par nature de chantier (clim, gainable, chambre froide, dépannage, entretien…), multi-lots, main-d'œuvre en heures, fiche de visite technique | **fait** (v2, `next-mod-*`) | choisir le moteur par défaut (P4) | P4 |
| 29/09 | PAC air-eau et ballon thermodynamique en deux modules séparés | non | P2 ; RGE (étude P9) | après PRO v1 |
| 30/09 | Grand catalogue de références de pièces avec leurs fournisseurs | non | tes prix pro | après PRO v1 |
| 30/09 | Tarification dépannage : forfait déplacement normal / urgence, minimum facturé | partiel | — | à vérifier dans l'usage |
| 01/10 | Facture électronique en production (Super PDP), Factur-X PDF/A-3, e-reporting B2C | bac à sable OK ; production impossible sans SIRET | SIRET, mission P6 (règle `env`), mission S | après la création de l'entreprise, **avant le 01/09/2027** |
| 19/10 | Planning : « jamais deux clients en même temps », synchro Google Agenda toutes les 15 min, rappels clients automatiques (veille, entretien à renouveler, demande d'avis), SMS, tournée en 1 clic, pointage du temps réel, alerte matériel à commander, acompte → créneau ferme | partie B de M0 (agenda) prête, non déployée (voulu) ; SMS non | partie B avec le site ; SMS : prix à vérifier | partie B : avec le site ; SMS : après PRO v1 |
| 23/10 | Créer un nouveau client depuis la lecture de plaque ; t éq. CO₂ mise à jour quand tu ajoutes du gaz ; mémoire des machines et de leurs interventions à partir de la plaque ; SIRET et infos entreprise remplis seuls à chaque nouveau client ; envoi des Cerfa à un organisme | non (recherche SIREN existe : `next-siren.js`) | module clients/machines/fluides | **premier module après PRO v1** |
| 24/10 | Module « Aides » (RGE, MaPrimeRénov', CEE), compta, paperasse | non | étude P9 faite le 25/10 ; RGE obtenu | après PRO v1 (détail § 3) |
| M0 | Partie B : migration + fonction `agenda` + site « Réserver » | prête, non déployée (voulu) | mission S (réservation qui n'écrase pas une fiche), hébergement (M4 C8) | avec le site |

## 2. Envies relevées par l'analyse fonctionnelle du 25/10 (ordre proposé par Opus : 1, 2, 3 d'abord)

| # | Envie | Réf. analyse |
|---|---|---|
| 1 | Planning : un chantier sur plusieurs créneaux (demi-journées, jours), conflit vérifié sur chacun | T1 |
| 2 | Compte rendu d'entretien à « Visite faite » (fait, mesures, photos, signature) et historique des visites | T14 |
| 3 | Liaison parc ↔ contrat ↔ fiche fluide (le parc du contrat et l'équipement posé alimentent la fiche) | T9, T10 |
| 4 | PRP et périodicité automatiques sur la fiche fluide | T11 |
| 5 | Majoration soir / samedi / férié proposée d'après la date et l'heure | M5 |
| 6 | Contrôles d'une pose split pré-cochés (réglable) ; temps d'entretien par unité | M7, M8 |
| 7 | Fluides du froid commercial (R404A, R452A, R449A…) dans le catalogue pièces et l'équipement posé | T13 |
| 8 | Livre des recettes par mois / trimestre ; pack comptable dans « Gestion » avec les PDF des factures | T15 |
| 9 | État « facturé / soldé » dans la liste des devis | T16 |
| 10 | Indicateur « hors ligne / à synchroniser » visible sur téléphone | T17 |
| 11 | Suivi des relances de factures (dates, nombre, escalade) | T7 |
| 12 | Contrôle de cohérence volume de chambre / groupe choisi | K8 |
| 13 | Bons de commande par fournisseur, numéro unique par bon | K10 |
| 14 | Rappel « fiche d'intervention » à la mise en service (obligation à vérifier d'abord) | J1 |
| 15 | Signature tactile sur place sans réseau | J1 |
| 16 | Date de début des travaux reprise sur le devis quand elle est connue | C9 |

## 3. Module « Aides » (étude P9 du 25/10, § 6 — rien à coder avant PRO v1)

1. Référentiel daté des aides (une ligne par version de fiche CEE, date d'effet, date de fin, source et date de consultation ; test par date de bascule).
2. Fiche RGE de l'entreprise (qualification, numéro, dates, audits, décennale, attestation de capacité) avec alertes d'échéance.
3. Éligibilité indicative par devis (jamais une promesse), alerte si le RGE est absent ou expiré à la date prévue de signature.
4. Chronologie verrouillée du dossier (visite, offre de l'obligé, dépôt MaPrimeRénov', signature, acompte, travaux, facture, attestation) : alerte bloquante si l'ordre est faux.
5. Mentions automatiques sur devis et facture selon l'aide (RGE, date de visite, performances, ligne « CEE », clause auditeur à partir du 01/03/2027, sous-traitant).
6. Pièces à collecter, rangées par chantier ; 7. dossier « prêt à contrôler » en un clic ; 8. prime = celle de l'offre de l'obligé, saisie, jamais calculée de mémoire ; 9. sous-traitance (rang, RGE des deux, part sous-traitée) ; 10. données personnelles minimales (catégorie de revenus seulement) ; 11. veille : date de dernière vérification de chaque règle.

## 4. Comment une idée sort de cette liste
1. Au point de février (ou plus tôt si PRO v1 est atteint), Gabriel choisit l'ordre.
2. Chaque idée retenue devient un dossier de mission écrit (comportement attendu, tests à écrire d'abord, décisions), validé par Gabriel avant tout code.
3. Une branche par idée, tests d'abord, golden identiques, relecture par l'autre modèle, fusion par Gabriel.
