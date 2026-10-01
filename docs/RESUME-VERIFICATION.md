# ClimPilot — dossier de vérification (pour une IA relectrice)

> Rédigé le 01/10/2026 par Claude (l'IA qui a développé ClimPilot avec Gabriel), version de l'appli **1.9.1**.
> À donner tel quel à une autre IA chargée de **vérifier** le système. Rien de ce qui suit n'est un ordre de modifier :
> on attend un **compte rendu**, pas des corrections directes.

---

## 0. Ta mission (IA relectrice)

Tu es chargée d'un **audit indépendant** de ClimPilot, le logiciel de gestion de Gabriel Leroy, futur artisan frigoriste-climaticien.
Objectif : trouver ce qui est **faux, risqué, non conforme ou fragile**. Tu n'as pas à me féliciter.

Règles :
1. **Ne jamais inventer** un chiffre, une règle fiscale, sociale ou réglementaire. Toute affirmation réglementaire doit citer une **source officielle récente** (impots.gouv.fr, bofip.impots.gouv.fr, urssaf.fr, service-public.fr, economie.gouv.fr, legifrance.gouv.fr, FNFE-MPE, AFNOR, documentation Super PDP). Si tu n'as pas pu vérifier : écris « non vérifié ».
2. Distinguer **certitude / probable / hypothèse** pour chaque constat.
3. Distinguer CA / marge / charges / bénéfice, et HT / TVA / TTC.
4. Être concret : Gabriel est un artisan de terrain, pas un service informatique. Chaque constat doit dire **ce qui peut mal tourner en vrai** (une facture refusée, une amende, une donnée perdue…).
5. Ne pas demander ni manipuler de secret (clés, mots de passe). Aucun n'est fourni ici.
6. Tu peux lire le code source (lien ci-dessous). Tu n'as pas accès aux données de Gabriel ni au serveur.

Format de réponse attendu : **voir la section 10** (à respecter, il sera réintégré automatiquement).

---

## 1. Contexte

- **Gabriel Leroy**, apprenti BTS FED option B (froid & climatisation) en 2e année (2026-2027), alternance chez WOLF ENERGY (Oise, 60).
- Projet : créer sa **micro-entreprise** à la fin de ses études (franchise en base de TVA au départ), évolution possible en EURL/SASU. **L'entreprise n'existe pas encore : pas de SIRET.**
- Activité : installation clim mono/multisplit/gainable, PAC air-air et air-eau, ballon thermodynamique, froid commercial (chambres froides, vitrines, groupes), dépannage, mise en service, maintenance et contrats d'entretien, location de rafraîchisseurs adiabatiques. Clients particuliers **et** professionnels. Au début : sous-traitance pour son patron actuel.
- Hypothèses du business plan utilisées dans l'appli (Paramètres, modifiables) :
  - taux horaire 45 € HT, 6 h facturées/jour, 5 j/semaine, 47 semaines/an ;
  - déplacements ≈ 11 000 €/an ;
  - cotisations : année 1 (ACRE) 11 % + CFE/CMA 0,52 % + versement libératoire 1,70 % = **13,22 %** ; année 2+ : 22 % + 0,52 + 1,70 = **24,22 %** ;
  - charges fixes 14 950 €/an, crédit camion 600 €/mois, trésorerie de départ 22 000 €.

---

## 2. Accès

- **Application en ligne** : https://gablry8.github.io/cp-gl2607/ (application web installable sur téléphone, en français ; un compte est nécessaire pour la partie serveur, les inscriptions sont fermées).
- **Code source** : https://github.com/gablry8/cp-gl2607
  - `index.html` : cœur historique (≈ 360 Ko, tout l'écran principal et les calculs d'origine).
  - `next-*.js` : couches ajoutées (une par fonction, voir section 4).
  - `supabase/` : **copies de lecture** du serveur — `schema.sql` (tables, règles d'accès, fonctions), `functions/assistant`, `functions/signature`, `functions/superpdp` (la version déployée fait foi).
  - `tests/` : batterie de tests automatiques (section 7).
  - `docs/RESUME-VERIFICATION.md` : ce document.

---

## 3. Architecture

**Côté appareil (téléphone / PC / iPad)**
- Site statique hébergé sur GitHub Pages, installable (PWA, `manifest.json`, `sw.js` = cache hors ligne, version de cache `climpilot-next-143-cadre`).
- Démarrage : `next-store.js` (chargé en premier) lit la base **IndexedDB** en mémoire, puis exécute dans l'ordre les scripts de l'appli (marqués `type="text/x-climpilot"`). Les lectures/écritures `localStorage` de l'appli sont redirigées vers la mémoire + IndexedDB, avec copie dans localStorage tant qu'il y a de la place. Fusion au démarrage par numéro d'ordre. Si IndexedDB ne répond pas et que des données n'existent que là : écran « rouvre l'appli » (l'appli ne démarre jamais avec des données manquantes).
- Les ajouts sont des **couches** : chaque `next-*.js` enveloppe des fonctions existantes (`go`, `compute`, `printDevis`, `renderList`…) au lieu de modifier le cœur. Principe : un devis ancien format (sans `v:2`) est recalculé au centime près par l'ancien moteur.
- Données principales (clés synchronisées) : `cp2_devis`, `cp2_clients`, `cp2_prix_custom`, `cp2_params_over`, `cp2_dep` (interventions), `cp2_loc` (locations), `cp2_contrats`, `cp2_fluides`, `cp2_equip`, `cp2_stock`, `cp2_cmd`, `cp2_machlib`, séquences de numéros (`cp2_facseq`, `cp2_locseq`, `cp2_fluseq`), plus des clés `cpnext_*` (tâches, avoirs, suivi plateforme `cpnext_pdp`…).

**Côté serveur (Supabase, région eu-west-1 — Irlande)**
- Authentification Supabase ; **inscriptions bloquées** par un déclencheur (seul l'e-mail de Gabriel est accepté). Les fonctions serveur ont en plus une **liste blanche** d'identifiant utilisateur.
- `climpilot_state` : tout l'état de l'appli dans **un seul document JSON** par utilisateur. Synchro par `cp_state_push` = écriture conditionnelle (refuse d'écraser une version plus récente) ; en cas de conflit, l'appli fait une **fusion « 3 voies » par identifiant** (base = dernière version synchronisée). Envoi 4 s après la dernière modification.
- **Sauvegardes serveur automatiques** (déclencheur sur chaque mise à jour) : copie quotidienne (≤ 1 / 20 h, gardée 45 jours + 1 par mois pendant 13 mois) et copie « avant grosse modification » si l'envoi fait disparaître ≥ 2 devis/clients/interventions/locations, vide une liste, ou réduit la taille de plus de 40 % (gardée 120 jours). Historique local supplémentaire (10 versions) sur chaque appareil + corbeille.
- **Fonctions serveur (Edge Functions, Deno)** :
  - `assistant` (connexion obligatoire) : dictée → appel à l'API Claude (modèle `claude-sonnet-5`) → propositions déposées dans `climpilot_inbox`. Plafond **4,50 €/mois** (1 $ compté 1 €) et 80 appels/jour. Lit aussi une photo de plaque signalétique ou une facture d'achat (sortie structurée, « rien n'est inventé »).
  - `signature` (publique, protégée par un jeton aléatoire par document, expiration ramenée à 90 jours si plus de 120 jours demandés) : signature en ligne des devis et fiches fluides.
  - `superpdp` (connexion obligatoire) : pont avec la plateforme agréée **Super PDP** (section 4.4).
- Secrets : clé API Claude dans les secrets Supabase ; **client_secret Super PDP chiffré dans Supabase Vault**, jamais renvoyé à l'appli ni stocké sur le téléphone.

---

## 4. Fonctions (par domaine)

### 4.1 Devis
- Devis **par nature de chantier** (`next-devis2.js` + modules) : clim murale (mono à quadri, console, cassette) `next-mod-split.js` ; gainable pièce par pièce (plénums, grilles, registres, régulation) `next-mod-gainable.js` ; chambre froide positive/négative (panneaux calculés, groupe, sécurités INRS) `next-mod-chambre.js` ; réparation `next-mod-depannage.js` ; entretien ponctuel/contrat `next-mod-entretien.js` ; froid commercial, PAC air-eau, ballon thermodynamique, adiabatique, mise en service seule, dépose/remplacement, sous-traitance `next-mod-autres.js`.
- Multi-lots (lots en option), main-d'œuvre tâche par tâche en heures, marge par défaut 35 % sur les nouvelles catégories, articles manquants ajoutés à la base avec un prix relevé sur internet marqué « à vérifier ». Aucun prix de vente fixé par l'IA.
- Numéro : `DV-AAAAMMJJ-<NATURE>-XXXXXX`. Statuts : brouillon → envoyé → accepté / refusé ; relances (`next-relance.js`, seuil 7 jours).
- PDF : mentions (validité 3 mois par défaut, délai d'exécution, devis gratuit, « bon pour accord », franchise TVA), TVA 5,5 % PAC avec critères (logement > 2 ans), mode « estimation » non contractuel.
- Demande de prix fournisseur prête à envoyer (`next-fournisseur.js`), bon de commande et réservation de matériel (`next-commande.js`).

### 4.2 Interventions, entretien, locations
- Bons d'intervention / dépannages (forfaits déplacement normal / urgence, minimum facturé, majorations soir-samedi / dimanche-férié), conversion en devis de réparation.
- Contrats d'entretien (fréquence de contrôle d'étanchéité d'après le règlement (UE) 2024/573, clause et rappel article L215-1 du Code de la consommation pour la reconduction tacite des particuliers).
- Locations de rafraîchisseurs adiabatiques (contrats, factures), outil adiabatique.

### 4.3 Factures, avoirs, comptabilité
- Factures : acompte / solde de chantier, intervention, location, année de contrat. Série `F-AAAA-NNN`. Mentions : pénalités 3 × taux d'intérêt légal, indemnité forfaitaire 40 € (pros), pas d'escompte, nature de l'opération, SIREN du client (pro) ; franchise : « TVA non applicable, art. 293 B du CGI » jusqu'au 31/12/2026, puis « art. L. 233-3 du CIBS » à partir du 01/01/2027 (bascule automatique).
- **Avoirs** (`next-avoir.js`) : total ou partiel, série `AV-AAAA-NNN`, référence à la facture d'origine, remboursement suivi, refacturation possible ; une facture émise ne se supprime ni ne se modifie.
- Registre des documents, impayés, livre des recettes (date d'encaissement), facturier, pack comptable CSV, ventilation par activité.
- « Statut & régime » (`next-regime.js`) : comparateur micro / micro + TVA / EURL / SASU, bascule de régime datée, alertes plafonds.

### 4.4 Facture électronique (réforme 2026-2027)
- `next-einvoice.js` produit pour chaque facture/avoir un **XML CII (UN/CEFACT D16B), profil EN 16931** : type 380 (facture), 386 (acompte), 381 (avoir + référence). Franchise : catégorie TVA **E**, code `VATEX-FR-FRANCHISE`, taux 0, mention en clair ; SIREN des parties en identifiant légal (schéma 0002) ; vendeur sans n° de TVA → SIREN en identifiant fiscal « FC ». Adresses électroniques des parties : SIREN en schéma **0225** (sinon e-mail). Notes PMD / PMT / AAB. Cadre de facturation **BT-23** (règle française BR-FR-08) : nature **M** (devis fourniture + pose, dépannage avec pièces), **S** (le reste) ou **B**, et situation **1** (normale), **2** (déjà payée), **4** (définitive après acompte) ; modifiable à l'envoi.
- `next-superpdp.js` + fonction `superpdp` : connexion OAuth2 (client_credentials) à **Super PDP** (API v1.beta), contrôle du fichier par la plateforme (format, EN 16931, règles françaises) **avant** envoi, envoi, suivi des statuts (fr:200 à fr:213), historique, copie déposée, **factures fournisseurs reçues** (approuver fr:205 / refuser fr:210 avec motif), annuaire officiel (SIREN/SIRET joignable ?).
- **Bac à sable** : vendeur et acheteur remplacés par les sociétés de test Super PDP (SIREN 000000001 / 000000002), numéro suffixé `-TEST`. En compte réel : factures aux **particuliers refusées** (pas de facture électronique B2C ; e-reporting à venir), client pro sans SIREN refusé.
- État au 01/10/2026 : compte bac à sable **connecté** ; un premier contrôle a été refusé pour BR-FR-08 (cadre absent) → corrigé en 1.9.1, **nouvel envoi test à confirmer**. Rien n'a encore été envoyé en réel.

### 4.5 Fluides frigorigènes
- Fiche d'intervention conforme au **Cerfa 15497*04** (14 cadres), mode guidé (seules les questions utiles), mémoire des références machines (fluide, charge, PRP), lecture de plaque par photo (IA si activée, sinon OCR local), signature en ligne du détenteur, BSFF / Trackdéchets rappelés.

### 4.6 Outils terrain
- Dimensionnement automatique (`next-dim.js`) : gaines de gainable (Q = P / (0,34 × ΔT), vitesse ≤ 4 m/s, 3 m/s en chambre), tuyaux d'eau (≤ 1 m/s, ≤ 20 mmCE/m, Darcy-Colebrook), liaisons frigorifiques (propriétés CoolProp ; mélanges en approché). Présenté comme **pré-dimensionnement** : la notice fabricant prime.
- Adresses (Base Adresse Nationale), distance et temps de route depuis le domicile (itinéraire IGN, sinon vol d'oiseau × 1,3 « estimé »), zone de déplacement automatique, planning lisible sur téléphone.
- Recherche d'entreprise par nom/SIRET (API publique recherche-entreprises).
- « Ma journée », « À faire », cockpit, modèles de devis, mode d'emploi, scanner photo.
- Assistant IA (`next-assistant.js`) : notes/tâches/machines/clients/articles enregistrés directement ; devis, interventions, messages, rendez-vous **à valider** par Gabriel ; l'IA n'utilise que le catalogue publié par l'appli.
- Signature en ligne (`next-signature.js` + `signer.html`) : document figé, empreinte SHA-256 côté serveur, nom + signature manuscrite + IP + navigateur + consentement horodatés ; option « travaux avant la fin du délai de rétractation de 14 jours ».
- Confort téléphone (`next-mobile.js`), aperçu PDF fiable (`next-pdf.js`), garde-fous (`next-fiabilite.js` : jamais « undefined » / « NaN » dans les champs et PDF), virgule acceptée dans les nombres, icônes sobres.

---

## 5. Règles réglementaires et fiscales intégrées (À VÉRIFIER EN PRIORITÉ)

| # | Règle telle qu'implémentée | Où | Vérifiée par Claude le |
|---|---|---|---|
| R1 | Calendrier réforme : réception des factures électroniques obligatoire pour toutes les entreprises au 01/09/2026 ; émission obligatoire pour les micro-entreprises au 01/09/2027 ; transmission via plateforme agréée | einvoice, superpdp | 01/10/2026 |
| R2 | Mention de franchise : 293 B du CGI jusqu'au 31/12/2026, art. L. 233-3 du CIBS à partir du 01/01/2027 (les deux admises jusqu'au 30/06/2028) | PDF + XML | 01/10/2026 |
| R3 | Franchise dans le XML : catégorie E + VATEX-FR-FRANCHISE + taux 0 | XML | 01/10/2026 (schematron CEN OK) |
| R4 | Cadre de facturation BT-23 : devis fourniture + pose = **M (mixte)**, dépannage avec pièces = M, autres = S ; 2 = déjà payée, 4 = définitive après acompte. **Doute** : une clim fournie et posée est-elle M ou S (travaux immobiliers = prestation de services ?) | XML | 01/10/2026, **non tranché** |
| R5 | Nouvelles mentions obligatoires des factures (SIREN client, nature de l'opération, adresse de livraison si différente, option TVA sur les débits) | PDF | 07/2026 |
| R6 | Factures aux particuliers : pas de facture électronique, e-reporting des transactions B2C à partir du 01/09/2027 — **non implémenté** | — | 01/10/2026 |
| R7 | Seuils micro : plafond CA 77 700 € (prestations), franchise TVA 37 500 € / seuil majoré 41 250 € | next-regime | 07/2026 |
| R8 | **Incohérence connue** : Paramètres utilisent 11 % (ACRE) / 22 % (taux URSSAF), `next-regime.js` utilise 10,6 % / 21,2 % (micro BIC prestations) | Paramètres vs régime | à trancher |
| R9 | TVA 5,5 % PAC air-air / air-eau / chauffe-eau thermodynamique dans les logements de plus de 2 ans, sous critères (loi de finances 2026 + arrêté du 13/07/2026 pour l'air-air) | devis | 29/09/2026 |
| R10 | Contrôle d'étanchéité (règlement UE 2024/573) : HFC : ≥ 5 t éq. CO₂ → 12 mois, ≥ 50 t → 6 mois (délais doublés avec détection permanente des fuites), ≥ 500 t → 6 mois avec détection obligatoire ; seuil 10 t pour un équipement hermétique ; HFO : 1 / 10 / 100 kg → 12 / 6 / 3 mois | entretien | 29/09/2026 |
| R11 | Cerfa 15497*04 : conservation 5 ans par l'opérateur ET le détenteur, forme électronique admise, deux signatures | fluides | 09/2026 |
| R12 | Reconduction tacite d'un contrat avec un particulier : information 3 à 1 mois avant l'échéance (art. L215-1 Code de la consommation) | entretien | 29/09/2026 |
| R13 | Délai de rétractation de 14 jours (contrat hors établissement avec un particulier) + demande expresse pour commencer avant | signature | 09/2026 |
| R14 | BSFF via Trackdéchets obligatoire depuis le 01/01/2023 ; MaPrimeRénov' = installateur RGE | modules | 29/09/2026 |
| R15 | Pénalités de retard 3 × taux légal et indemnité forfaitaire 40 € (professionnels) ; paiement « à réception » | factures | 07/2026 |
| R16 | Signature électronique « simple » (nom + tracé + consentement + empreinte + IP/horodatage) jugée suffisante pour un devis | signature | 09/2026, **à confirmer** |

---

## 6. Sécurité (état actuel)

- Toutes les tables ont la RLS activée, règles « propriétaire uniquement » ; écritures sensibles uniquement côté serveur.
- Inscriptions fermées (déclencheur) + liste blanche dans chaque fonction serveur.
- Fonction `signature` publique **par conception** (le client n'a pas de compte) : jeton UUID aléatoire, expiration, statut figé une fois signé (déclencheur `cp_sig_guard`), empreinte calculée par la base.
- Super PDP : secret dans Vault, fonctions d'accès réservées au rôle serveur, jeton OAuth gardé en mémoire de la fonction, renouvelé sur erreur 401.
- Alerte Supabase ouverte : **protection contre les mots de passe divulgués désactivée** (HaveIBeenPwned).
- Points à juger : en-têtes CORS `*` sur les fonctions ; adresse IP du signataire conservée (RGPD : information et durée de conservation ?) ; données clients stockées en JSON sur Supabase (registre RGPD, durée de conservation, hébergeur) ; un seul compte = pas de séparation des rôles.

---

## 7. Tests

Batterie Playwright (Chromium) sur serveur local, services externes **simulés** (Supabase, géographie, Super PDP) :

| Suite | Contenu | Résultat 01/10/2026 |
|---|---|---|
| A | écrans, navigation, boutons | 14/14 |
| B | devis de chaque nature, factures, données piégées, gros volume, hors réseau, fuseaux horaires | 54/54 |
| C | dimensionnement, sauvegarde/restauration, fiche fluide guidée | 17/17 |
| D | grande mémoire IndexedDB (migration, secours, fusion) | 18/18 |
| E | avoirs | 19/19 |
| F | XML facture électronique : schéma XSD Factur-X/CII + règles officielles EN 16931 (schematron CEN) → 0 erreur bloquante | 6/6 |
| G | nombres à virgule | 10/10 |
| H | Super PDP (connexion, contrôle, envoi test, statuts, reçues, annuaire, compte réel, cadre BT-23) | 27/27 |

**Limite importante** : aucun test automatique contre le vrai Supabase ni le vrai Super PDP. Les **règles françaises (BR-FR)** ne sont vérifiées que par le contrôle de Super PDP (bac à sable), pas en local.

---

## 8. Limites connues et points ouverts

1. Envoi test Super PDP après la correction BR-FR-08 : **pas encore confirmé** ; d'autres règles BR-FR peuvent sortir.
2. Pas de SIRET (entreprise non créée) → aucun envoi réel possible ; passage en production à faire par Gabriel lui-même (nouveaux identifiants).
3. **E-reporting B2C** (particuliers) et e-reporting des encaissements : non faits.
4. Seul le XML CII est produit, **pas de Factur-X** (PDF/A-3 avec XML intégré).
5. Statuts Super PDP mis à jour à l'ouverture de l'écran (pas de notification push/webhook).
6. Factures fournisseurs reçues : consultées/approuvées, **pas importées** dans les achats ni la compta.
7. Facture XML : une ligne par taux de TVA (montant global), pas le détail article par article du devis.
8. Avoir : cadre BT-23 situation « 1 » repris par défaut.
9. Encaissements des interventions/locations/contrats stockés HT ; TVA déductible des achats non suivie (laissée au comptable).
10. Catalogue fournisseurs : sur l'appareil uniquement (pas synchronisé).
11. Incohérence de taux URSSAF (R8).
12. Prix « relevés sur internet » à remplacer par les prix pro de Gabriel.
13. Dimensionnement = pré-dimensionnement (mélanges de fluides en approché).

---

## 9. Ce que je te demande de vérifier (par priorité)

**P1 — conformité qui peut coûter de l'argent ou bloquer la facturation**
- R1 à R6 et R15 : calendrier, mentions obligatoires, franchise (293 B → L. 233-3 CIBS et sa date), cadre de facturation BT-23 (en particulier **M ou S pour une clim fournie et posée**, et le code d'un avoir), traitement des particuliers.
- Le XML (`next-einvoice.js`) : manque-t-il une donnée obligatoire du socle français (BR-FR-xx) ? Le contrôle de schéma EN 16931 est bon, mais les règles françaises ne sont contrôlées que par la plateforme.
- R7 / R8 : seuils et taux micro **en vigueur pour 2026 et 2027** (sources URSSAF / impots.gouv), et quel taux retenir.

**P2 — sécurité et données**
- Risque de perte de données : synchro (fusion 3 voies), sauvegardes serveur, démarrage IndexedDB.
- Sécurité des fonctions serveur (`supabase/functions/*`), règles RLS (`supabase/schema.sql`), signature publique, RGPD.

**P3 — métier**
- R9 à R14 : TVA 5,5 %, F-gas, Cerfa, L215-1, rétractation, BSFF, RGE.
- Bon sens des calculs de devis et de dimensionnement (formules de la section 4.6).

**P4 — utilisabilité**
- Ce qui serait déroutant pour un artisan seul sur chantier, sur téléphone.

---

## 10. Format du compte rendu attendu (à respecter)

Réponds en français, avec exactement ces parties :

```
# Compte rendu de vérification ClimPilot — <date>

## Synthèse (5 lignes maximum)

## Constats
Pour chaque constat, un bloc :
### C<n> — <titre court>
- Gravité : BLOQUANT | IMPORTANT | MINEUR | À CONFIRMER
- Domaine : conformité | sécurité | données | calcul | métier | ergonomie
- Référence : R<n> ou fichier/fonction concerné(e)
- Constat : ce qui est faux ou risqué
- Preuve / source : lien officiel + date de consultation (ou « non vérifié »)
- Certitude : certain | probable | hypothèse
- Conséquence concrète pour Gabriel
- Correction proposée

## Règles confirmées
Liste des R<n> que tu as vérifiées et trouvées correctes, avec la source.

## Questions à poser à Gabriel ou à son comptable

## Ce que tu n'as pas pu vérifier
```
