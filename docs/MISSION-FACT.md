# ClimPilot — Mission FACT : les vraies factures par SUPER PDP dès l'ouverture — dossier de mission

> Rédigé le 11/11/2026 par Claude (session Claude Code, mission FACT-DOSSIER) pour Gab. **Documents seulement** : aucune ligne de l'appli, des tests ni de `supabase/` n'a changé. Branche `docs/mission-fact`, partie de `main` = `6457329`.
> **Décision de Gab du 11/11/2026** : ClimPilot émet les vraies factures dès l'ouverture de l'entreprise, par la plateforme agréée SUPER PDP, si la liste de contrôle du § 4.1 est verte au **01/06/2027** ; sinon un outil de secours pendant quelques semaines (§ 5.8). **Décision COMPTE Q1 du 11/11** : le contrôle `aal2` côté serveur (variante B de `docs/MISSION-COMPTE.md` § 4) se fait dans FACT, avant la première vraie facture.
> Numéros de ligne lus sur `main` (`6457329`). S (en cours) puis COMPTE, P11 et AF1-B modifient `index.html` et `next-emission.js` : l'exécutant retrouve tout par le **nom des fonctions**.
> **Outil Projects absent de cette session** : rien n'a été lu ni écrit dans le Project. La copie `claude/ClimPilot-FACT-dossier.md` reste à faire.
> **Réseau de cette session** : `www.impots.gouv.fr`, `bofip.impots.gouv.fr`, `www.legifrance.gouv.fr` et `www.superpdp.tech` ne répondent pas (hôtes non autorisés, essayé le 11/11/2026). **Aucune page officielle n'a donc été relue** : toute règle fiscale de ce dossier porte « à vérifier », sauf quand une lecture datée existe déjà dans le dépôt (elle est citée avec sa date). Les recherches faites par moteur de recherche (résumés de sites tiers) sont listées en annexe comme **indices non officiels**.
> Rien n'a été exécuté contre Supabase (RÉEL ou TEST). L'état des serveurs du § 1.6 vient du prompt de la mission (lecture seule faite par Claude les 10 et 11/11).
> Certitude : **certain** (lu dans le code ou un document daté, ou exécuté ici), **probable** (déduit), **hypothèse** (proposition à valider).

## Ce que Gab décide / fait

1. Réponds aux **12 questions du § 6.1** (oui / non). La 1re : FACT est-elle une exception au gel ? La file la range encore dans « Plus tard (gelé) » (contradiction, § 6.1).
2. Décembre 2026 : apporte à ta comptable les **11 questions du § 6.2** (caisse, e-reporting, Factur-X, sous-traitance, conservation). FACT-C en dépend.
3. Dès que tu veux, sans code : pose le secret `ALLOWED_USER_IDS` **puis** déploie `superpdp` sur le **réel** (§ 5.6, gestes 1 et 2). Sur TEST, après le script de FACT-0 (gestes 3 à 5).
4. Pour que la prochaine session relise les sources officielles : autorise les 4 hôtes ci-dessus dans les réglages réseau de l'environnement (question 12).
5. Avant le 01/04/2027 : choisis l'outil de secours (§ 5.8), sans t'en servir.
6. Mai 2027 : la **facturation à blanc** (§ 4.3), ≈ 3 h sur la copie d'essai (TEST) et le bac à sable SUPER PDP.
7. Le **01/06/2027** : la liste de contrôle (§ 4.1). Un point rouge → plan de repli (§ 5.8).
8. Le jour de la bascule réelle (après le SIRET) : § 5.7, ≈ 2 h.
9. Cette demande de fusion (documents seulement) se fusionne quand tu veux : rien ne change dans l'appli.

## 1. Ce qui existe (lecture du code de `main`, `6457329`)

### 1.1 Émission d'une facture (`next-emission.js`)

| Étape | Où | Ce qui se passe | Certitude |
|---|---|---|---|
| Gardes | `emettre` l. 256 | Devis remplacé, annulé ou déjà facturé dans sa famille : refus (`cpRefusFacture`). Contrôles des particuliers (`nxAvantEmission`, `next-particuliers.js`). Devis pas « accepté » : confirmation. Devis modifié à l'écran : enregistré d'abord. | certain |
| Essai à blanc | `aBlanc` l. 155 | La fonction d'origine (`facturerDevis`, `factureDep`, `facturerLoc`, `facturerContrat`) est jouée sur une copie avec un numéro `PROVISOIRE-` tiré au hasard. Rien n'est enregistré. | certain |
| Choix du mode | `mode` l. 94 | `demo` s'il manque le SIRET (`siretOk` l. 59), la connexion (`cloud` l. 58) ou le démarrage (`reelDemarre` l. 88). Sinon `reel` si le serveur répond (`sonde` l. 74 → `cp_serveur_info`), `bloque` sinon. | certain |
| Vérification du registre | `dejaEmis` l. 381 | Lecture des sources de `climpilot_documents`. Facture déjà émise ailleurs pour la même source : reprise, rien d'émis. Registre illisible ou plus de 25 s : **rien n'est émis** (C1). | certain |
| Numéro | `demanderServeur` l. 450 → `cp_emettre_document` | Le serveur donne le numéro **et** enregistre le contenu (`payload` : facture et modèle XML) dans la même transaction. Même `request_id` rejoué = même facture. Coupure pendant l'appel : « Résultat INCONNU », même demande au prochain clic (`inconnu` l. 436). Refus C1 (une seule facture vivante par source) : la facture existante est reprise. | certain |
| Fichiers | `finir` l. 490, `capturer` l. 166 | Après la réponse : HTML du PDF capturé, XML fabriqué (`nxEinvXMLOf`), registre local `cp2_docs` (synchronisé), fichiers rangés **sur l'appareil seulement** (`cpnext_docs_fichiers`). | certain |
| Dépôt des fichiers | `deposerFichiers` l. 508 → `cp_document_fichiers` | 2e appel, sans attendre. Échec : marque `aDeposer`, reprise au rapprochement et au retour du réseau. **Trou connu** : une réponse jamais arrivée ne pose pas la marque (AF1-B, défaut C-N2, `docs/MISSION-AF1B.md` § 2.1). | certain |
| Avoirs | `nxAvoirEmit` l. 516 | Même chemin, série `AV`. | certain |
| Réimpression | `reimprimer` l. 546 | Copie de l'appareil, sinon HTML du serveur, sinon « Duplicata reconstitué » (`duplicata` l. 560). | certain |
| Paiements | `evenement` l. 567, `viderEvenements` l. 573 → `cp_document_evenement` | Un `paiement` ou `paiement_annule` part au journal du serveur **seulement pour une facture réelle**, avec la date et la source (`payerFacture`) ou la date et le mode (`payDep`). **Le montant n'y est pas.** | certain |

**Serveur** (`supabase/migrations/`, lu) :
- `climpilot_documents` (`20261002120000_documents_emis.sql` l. 33-55) : numéro unique par série et par année ; `html` et `xml` de moins de 600 000 caractères ; `fichiers_hash`. Un document émis ne se modifie ni ne se supprime ; ses fichiers s'écrivent une seule fois (`cp_docs_guard` l. 90).
- `climpilot_doc_events` (l. 61-71) : ajout seul. Types : `paiement`, `paiement_annule`, `paiement_irregulier`, `regularisation`, `statut_pdp`, `envoi_pdp`, `avoir`, `remise_exemplaire`, `note`. Pas de chaînage des lignes, pas de clôture périodique.
- `cp_emettre_document`, version C1 (`20261021180000_une_facture_par_source.sql` l. 34-131) : version de l'appli, date du jour à ±1 jour, contenu de 300 000 octets au plus, verrou du compteur, règle « une facture vivante par source ». Un refus ne consomme aucun numéro.
- `cp_document_fichiers` (`20261002120000` l. 215-230), `cp_importer_ancien` (l. 249), `cp_document_evenement` (l. 233). Exécution réservée à `authenticated` (l. 271-276).
- Certitude : certain (lu).

### 1.2 Démarrage de la facturation réelle et mode démonstration (`next-emission.js`)

- **Démarrage** : carte « 🧾 Facturation réelle » des Paramètres (`carteParams` l. 853), `demarrer` l. 715. Exige un SIRET de 14 chiffres et une date de début qui n'est pas passée. Les anciennes factures F-/AV- deviennent des **essais** (renommées `ESSAI-…`) sauf celles choisies « importer » (`cp_importer_ancien`, `importerAnciens` l. 675). La décision `cp2_facturation` est synchronisée. Elle s'annule avant la date de début, ou après si aucune facture réelle n'existe (`annulable` l. 731, vérifié sur le serveur). Certain.
- **Démonstration** : numéros `TEST-F-AAAA-NNN` et `TEST-AV-…` (`numTest` l. 144, compteur local `cp2_testseq`), bandeau « DOCUMENT DE TEST » (`filigrane` l. 176). Avec le cloud : même règle « déjà facturé » appuyée sur l'état synchronisé (`aJour` l. 342). Un document `TEST-` ou `ESSAI-` ne part jamais sur la plateforme réelle (`verifierAvantEnvoi`, `next-superpdp.js` l. 160). Certain.
- **Badge** du pied du menu (`badge` l. 843) : mode, factures en attente d'émission, numéros en double. Certain.
- **Trou connu** : un appareil pas connecté sort une facture TEST même après le démarrage (AF1-B, défaut C-N3). Certain (`docs/MISSION-AF1B.md` § 2.2, exécuté le 09/11).

### 1.3 Registre des documents

| Où | Quoi | Synchronisé | Certitude |
|---|---|---|---|
| Serveur `climpilot_documents` | toutes les factures réelles, contenu figé, HTML et XML (si déposés) | — (source de vérité) | certain |
| Appareil `cp2_docs` | registre local (numéro, mode, source, modèle XML) | oui | certain |
| Appareil `cpnext_docs_fichiers` | HTML et XML figés | **non** | certain |
| `rapprocher` l. 627 | au démarrage (connecté, SIRET, démarré) : relit tout le registre du serveur, remet en place une facture disparue d'un chantier, signale les conflits, redépose les fichiers en retard | — | certain |

### 1.4 XML et contrôles (`next-einvoice.js`)

- Format : **XML CII** (UN/CEFACT D16B), profil EN 16931 (`xmlOf` l. 160). Facture 380, acompte 386, avoir 381 avec référence à la facture d'origine. Certain.
- **Une ligne par taux de TVA** (`linesOf` l. 57), pas le détail article par article du devis. Certain. (Déjà noté le 01/10 : `docs/RESUME-VERIFICATION.md` § 8, point 7.)
- Catégories de TVA produites : `S` (taux > 0), `Z` (0 %), `E` + `VATEX-FR-FRANCHISE` (franchise). **Aucune catégorie `AE` (autoliquidation).** Certain.
- Cadre de facturation BT-23 (`m.nature + m.situ`, l. 91-93) : nature B / S / M (réglage des Paramètres, `defaultNature` l. 98), situation 1 normale, 2 déjà payée, 4 définitive après acompte. Date de prestation BT-72 pour une intervention. Certain.
- Vendeur : SIREN (schéma 0002), adresse électronique 0225 = SIREN ; n° de TVA (VA) s'il existe, sinon SIREN (FC). Client sans SIREN : son e-mail (EM). Certain.
- Mention de franchise : « art. 293 B du CGI » jusqu'au 31/12/2026, « art. L. 233-3 du CIBS » à partir du 01/01/2027 (`mention` l. 42, `capturer` pour le PDF). Règle lue le 01/10/2026 (`docs/RESUME-VERIFICATION.md` § 5, R2) ; non relue ici.
- **Pas de Factur-X** (PDF/A-3 avec le XML intégré) : le « PDF » est le HTML capturé, imprimé par le navigateur. Certain.
- `nxEinvChecks` (l. 125, « ce qui manque » : SIRET, adresse, SIREN du client pro) **n'est appelé nulle part avant l'émission** : il sert à la carte du registre (`card` l. 226). Une facture pro sans SIREN ou sans code postal du client peut donc être émise, puis refusée au contrôle de la plateforme. Certain (recherche dans tout le code).
- **Validateurs de la batterie** (`tests/validate-einvoice.py`) : XSD Factur-X (paquet `factur-x` 7.1), schematron CEN EN 16931 (`validation-1.3.16`), règles françaises FNFE-MPE `BR-FR-Flux2` (`v1.4.0.04`). Certain. La version des règles françaises est celle du 03/10/2026 : à comparer avec la version courante (à vérifier).

### 1.5 Envoi et suivi (`next-superpdp.js`, `supabase/functions/superpdp/index.ts`)

- **Appli** : écran « ⚡ Facture électronique » (`renderView` l. 271), connexion par `client_id` / `client_secret` (`nxPdpConnect` l. 218), envoi (`nxPdpSend` l. 107) : contrôle par la plateforme (`validate`), puis dépôt (`send`) seulement si conforme. Statuts officiels `fr:200` à `fr:213` (table `ST`), historique, copie déposée, factures reçues (approuver `fr:205` / refuser `fr:210`, `nxPdpDecide` l. 259), annuaire (`nxPdpLookup` l. 231). Certain.
- **Bac à sable** seulement si la plateforme annonce exactement `sandbox` (P6+). Le bac à sable envoie un **XML fabriqué par l'appareil**, avec les sociétés de test (`testOverrides` l. 76 : SIREN 000000001 et 000000002) et un numéro suffixé `-TEST…`. Certain.
- **Compte réel** : client particulier refusé (« pas de facture électronique »), client pro sans SIREN refusé ; la plateforme reçoit **l'identifiant du document du registre**, et la fonction serveur dépose le XML **du registre** (`send`, `index.ts` l. 146-165 ; relecture R2 du 04/10). Sans XML au registre : refus « pas encore enregistré ». Renvoi bloqué si déjà déposée, permis après un rejet technique `fr:213` (`verifierAvantEnvoi` l. 160). Certain.
- **Rien n'envoie la facture d'un client pro de lui-même** : le dépôt est un bouton (« Envoyer » dans l'écran Avoirs, le bloc facturation du devis, ou l'écran Facture électronique, 15 dernières factures). Aucun compteur « factures pro pas encore déposées ». Certain.
- **Rien n'envoie un statut sur nos propres factures** (par exemple « Encaissée », `fr:212`) : l'action serveur `event` (l. 206) l'accepterait, mais l'appli ne l'appelle que pour les factures reçues. Certain.
- **Fonction serveur** : jeton ClimPilot exigé, puis liste blanche lue dans le secret `ALLOWED_USER_IDS` (vide ou absent : 503 « config », l. 97-98) ; identifiants OAuth gardés dans Supabase Vault par `pdp_cred_set` / `pdp_cred_get` / `pdp_cred_delete` et la table `climpilot_pdp` (`supabase/schema.sql` l. 152-185, **copie de lecture du réel du 01/10, pas une migration**). Actions : `status`, `connect`, `disconnect`, `validate`, `send`, `invoice`, `events`, `list`, `download`, `directory`, `test_invoice`, `set_vat_regime`, `event`. Certain.
- **Aucune action pour l'e-reporting** ni pour inscrire l'entreprise dans l'annuaire (seulement une recherche). Certain.

### 1.6 État des serveurs au 11/11/2026 (prompt de la mission, lecture seule faite par Claude les 10 et 11/11)

- **RÉEL** : `superpdp` = version 1 du 01/10/2026. Il lui manque `e911cfc` (liste blanche lue dans `ALLOWED_USER_IDS` ; la v1 a sa liste écrite dans le code), `e4c9599` (envoi depuis le registre) et `59d74a1` (bac à sable seulement si `sandbox`). Registre : **0 document**. Facturation réelle jamais démarrée.
- **Conséquence lue dans le code** (probable, non exécuté) : avec l'appli de `main` et la v1, un dépôt en compte réel échoue sans danger (« Fichier vide », la v1 attend `body.xml`, l'appli envoie `document_id`). Le bac à sable fonctionne comme le 01/10.
- **TEST** : `superpdp` pas déployée. **Le script qui a construit TEST ne crée ni `climpilot_pdp` ni `pdp_cred_*`** (`tests/supabase-test/1-structure-migration-essais.sql` l. 19 : « Non repris … pdp_cred_* (coffre Vault) »). Certain pour le script ; probable pour le projet (rien n'a été créé à la main d'après les comptes rendus). **Déployer la fonction sur TEST ne suffit donc pas** : il faut d'abord ces objets (FACT-0).
- Bac à sable SUPER PDP : connecté le 01/10 ; 1er contrôle refusé pour BR-FR-08, corrigé en 1.9.1 ; **nouvel envoi d'essai jamais confirmé** (`docs/RESUME-VERIFICATION.md` § 4.4 et § 8, point 1). Certain (document daté).
- Rien de réel ne peut être essayé avant l'immatriculation : la connexion réelle exige le SIRET (`docs/APRES-PRO-V1.md`, ligne du 01/10).

### 1.7 Ce qui est testé, et par quelle suite

| Sujet | Suite | Réel / simulé | Certitude |
|---|---|---|---|
| XML : XSD + CEN (jeu historique) et matrice 1.10 de 11 XML (intervention, location, contrat, acompte, solde après acompte, avoir partiel, TVA 10 % et 20 %, bac à sable, payée le jour même) + BR-FR | F (`suiteF-einvoice.mjs`, `genxml.mjs`, `genxml2.mjs`, `validate-einvoice.py`) | validateurs officiels réels, sans plateforme | certain |
| Écran et envoi SUPER PDP (bac à sable, compte réel, environnement inattendu, renvoi, refus, annuaire, factures reçues, messages d'erreur) | H (46 lignes `rec(`) | plateforme **simulée** | certain |
| Émission (TEST, numéro du serveur, serveur absent, réponse perdue, double clic, avoir, doublons, deux onglets) | I | serveur simulé, mêmes règles que le SQL | certain |
| Démarrage de la facturation réelle | N | serveur simulé | certain |
| Réponse perdue et autre appareil | R (R4) | serveur simulé | certain |
| Registre illisible, deux appareils | AA, AE (AE4) | banc deux appareils | certain |
| Fonction `superpdp` : liste blanche, envoi depuis le registre, règle du bac à sable | `tests/functions/test-liste-blanche.mjs` (20), `test-superpdp-envoi.mjs` (30) | Node, base et plateforme simulées | certain |
| Migrations 1.10, C1, droits | `tests/sql/test_migration.py` (14 tests), `test_une_facture_par_source.py` (17), `test_p6_droits.py` (15) | PostgreSQL 16 local | certain |
| **Non couvert** | taux 5,5 % et mixte dans la matrice, avoir total en XML, autoliquidation, e-reporting, Factur-X, `aal2`, la vraie plateforme (bac à sable ou réel), Deno réel, le chemin « registre → plateforme » contre la vraie plateforme | — | certain |

## 2. Ce qu'il manque pour une vraie facture, point par point

| # | Manque | Certitude | Où / mission |
|---|---|---|---|
| M1 | `superpdp` du dépôt pas déployée (réel en v1, TEST rien) | certain (prompt) | gestes de Gab, § 5.6 |
| M2 | TEST n'a pas `climpilot_pdp` ni `pdp_cred_*` | certain (script 1), probable (projet) | FACT-0 |
| M3 | `aal2` côté serveur (variante B) | certain (absent du code) | FACT-A |
| M4 | Fichiers figés pouvant manquer au registre ; facture TEST hors connexion | certain (exécuté le 09/11) | **AF1-B, prérequis** |
| M5 | E-reporting (ventes aux particuliers, paiements) : rien dans le code | certain | FACT-C, après la comptable |
| M6 | Format remis au client : XML CII seul, une ligne par taux ; ni Factur-X ni détail | certain (code) ; exigence à vérifier | FACT-C si exigé |
| M7 | Inscription de l'entreprise dans l'annuaire : rien dans l'appli | certain (code) ; démarche à vérifier | geste de Gab chez SUPER PDP |
| M8 | Sous-traitance avec TVA autoliquidée : non imprimée, pas de catégorie `AE` | certain | FACT-C, après la mission TVA |
| M9 | Conservation 10 ans hors Supabase | probable (dépend de P11) | P11 + § 2.8 |
| M10 | Dépôt des factures pro : manuel, rien ne rappelle les oubliés ; aucun statut « Encaissée » envoyé | certain | FACT-B |
| M11 | Contrôle avant émission d'une facture pro (SIREN, adresse) : absent | certain | FACT-B |
| M12 | Le chemin « registre → plateforme » n'a jamais été essayé contre la vraie plateforme | certain | FACT-A (question 4) |
| M13 | Messages faux ou périmés dans l'appli | certain | FACT-B |
| M14 | Logiciel de caisse : sortie à choisir | à vérifier | § 3, la comptable |

### 2.1 Déploiement de `superpdp` (M1, M2)

- **Ordre obligatoire** : le secret `ALLOWED_USER_IDS` **avant** la nouvelle version. Sans lui, la fonction refuse tout le monde (503 « config », `index.ts` l. 97-98). Certain.
- **Réel** : rien d'autre à préparer (`climpilot_pdp` et `pdp_cred_*` existent, `supabase/schema.sql`). La connexion bac à sable déjà enregistrée reste (même table). La valeur brute `env_brut` n'apparaît qu'à la prochaine connexion (`docs/P6-ENV-COMPTE-RENDU.md` § 6). Certain (lu).
- **TEST** : d'abord un script qui crée `climpilot_pdp` et les trois fonctions `pdp_cred_*` (copie conforme de `supabase/schema.sql` l. 152-185), avec `revoke … from public, anon, authenticated` et exécution pour `service_role` seulement. Le coffre Vault (`vault.create_secret`) existe sur un projet Supabase hébergé (probable) : **le script le vérifie avant tout**. Puis le secret, puis la fonction.
- **Peut se faire tôt** : déployer la version du dépôt sur le réel ne change rien pour l'appli d'aujourd'hui (compte bac à sable : même comportement ; compte réel : impossible sans SIRET). Probable (lu). Recommandé dès maintenant (§ 5.6) : la v1 a encore sa liste écrite dans le code.

### 2.2 `aal2` côté serveur (M3) — variante B, décidée le 11/11

Reprise de `docs/MISSION-COMPTE.md` § 4.3, à faire **dans FACT-A**, après COMPTE (qui apporte l'écran du code) et après AF1-B (qui peut ajouter `cp_emettre_document_complet`).

- **Règle** : si le compte a un facteur de double authentification **vérifié**, le serveur exige une session `aal2` pour : `cp_emettre_document`, `cp_importer_ancien`, `cp_document_fichiers`, `cp_emettre_document_complet` (si AF1-B a choisi l'option (a)), et la fonction `superpdp`. Sans facteur vérifié : comme aujourd'hui (la règle se relâche d'elle-même si le facteur est retiré, procédure de secours de COMPTE § 3.7).
- **Serveur** : migration rejouable `supabase/migrations/<date>_aal2_emission.sql` : fonction `cp_aal_ok()` (esquisse dans COMPTE § 4.3) ; dans chaque fonction ci-dessus, **copie exacte de sa dernière version** (au moment du code) avec la ligne `if not public.cp_aal_ok() then raise exception 'aal2 requis : double authentification à faire' using errcode = '42501'; end if;` juste après « non connecté », **avant** toute lecture du registre et tout numéro.
- **Fonction `superpdp`** (`handle`, après la liste blanche) : lire `aal` dans le jeton validé ; facteur vérifié et `aal` ≠ `aal2` → 403 `{erreur:'aal2', message:'Double authentification requise : reconnecte-toi avec ton code.'}`.
- **Appli** : reconnaître l'erreur dans `demanderServeur` (`next-emission.js`) et dans `api` (`next-superpdp.js` l. 49) → écran du code de COMPTE → **même demande** (`request_id` inchangé). Rien n'est numéroté avant le contrôle.
- Hypothèse à vérifier par le script TEST avant tout : le propriétaire des fonctions peut lire `auth.mfa_factors` sur le projet hébergé (COMPTE § 4.3).
- **Ordre sur le réel** : appli qui sait demander le code (fusionnée, F5 partout), double authentification activée et vérifiée, **puis** script réel et redéploiement de `superpdp` (COMPTE § 4.3).
- Question 6 : faut-il aussi la règle sur `cp_document_evenement` (journal des paiements) ?

### 2.3 Fichiers figés et appareil pas connecté (M4) : AF1-B est un prérequis

En compte réel, la plateforme reçoit le XML **du registre** (§ 1.5). Si les fichiers n'y sont pas (défaut C-N2, R2 : appli fermée pendant le 2e appel), l'envoi est refusé « pas encore enregistré » **pour toujours** sur les autres appareils. Et un appareil pas connecté sort une facture TEST qui bloque le chantier (C-N3). **Aucune vraie facture avant la fusion d'AF1-B.** Certain (lu ; défauts exécutés le 09/11).

### 2.4 E-reporting (M5)

- **Dans le code (certain)** : rien. Seulement deux textes : « À partir du 01/09/2027, ses montants seront déclarés automatiquement (« e-reporting ») » (`nxPdpSend`, `next-superpdp.js` l. 119) et la liste de lancement (`next-objectifs.js` l. 276). **Le premier est faux aujourd'hui** : rien ne déclare quoi que ce soit (M13).
- **Données déjà présentes** (certain) : type de client par facture (`cType` : Particulier / Professionnel) ; montants par taux (`tvaR` des factures, `taxes` du modèle figé, `payload.model` au registre du serveur) ; encaissements avec date et mode (`allRecettes`, `index.html` l. 3360, complété par les remboursements d'avoirs, `next-avoir.js` l. 283-295). **Manquent** : le montant dans les paiements du journal du serveur (§ 1.1) ; toute trace de ce qui a été transmis.
- **Règles** (ventes aux particuliers, données de paiement des prestations de services, fréquence, franchise en base concernée ou non, date de départ) : **à vérifier** sur impots.gouv.fr (pages non joignables ici). Lecture précédente dans le dépôt : « e-reporting des transactions B2C à partir du 01/09/2027 » (`docs/RESUME-VERIFICATION.md` § 5, R6, vérifiée le 01/10/2026, page non notée). Les résumés de sites tiers de l'annexe vont dans le même sens : indices, pas sources.
- **Côté SUPER PDP** : endpoint d'e-reporting inconnu (documentation non lue) : **hypothèse**.
- **Ce qui dépend d'une décision** : le contenu (TVA collectée ou non) dépend du régime de TVA, pas encore décidé (CLAUDE.md § 1). FACT-C ne se code qu'après la décision de décembre et la lecture des spécifications officielles.

### 2.5 Format remis au client (M6)

- **Client pro, en réel** : le XML CII du registre part par la plateforme (certain, code). Le client reçoit ce que sa propre plateforme en fait (hypothèse).
- **Client particulier** : le PDF (impression du HTML figé), remis comme aujourd'hui (certain, code).
- **Ce que SUPER PDP attend** : documentation non lue (hôte bloqué). Ce que le dépôt sait (certain, document daté) : le 01/10/2026, le bac à sable a **contrôlé** un XML CII envoyé en `application/xml` à `POST /v1.beta/invoices` (refus BR-FR-08, corrigé ensuite). Que le dépôt réel du CII seul soit accepté : probable, à confirmer par le premier envoi d'essai (§ 4.3). Factur-X, UBL, CII acceptés : indice de sites tiers (annexe).
- **À vérifier avec la comptable** (§ 6.2) : un XML à **une ligne par taux** satisfait-il la mention obligatoire de désignation des produits et services ? Faut-il remettre au client pro un PDF en plus, ou un Factur-X ?

### 2.6 Annuaire et réception (M7)

- L'appli **cherche** un client dans l'annuaire (`directory`). Elle n'**inscrit** pas l'entreprise : c'est la plateforme choisie qui le fait, à l'ouverture du compte de production (hypothèse : documentation non lue). Geste de Gab chez SUPER PDP, après le SIRET (§ 5.7).
- La réception est déjà dans l'appli (factures reçues, approuver / refuser ; suite H). La date à partir de laquelle toute entreprise doit pouvoir recevoir : lue le 01/10/2026 (« 01/09/2026 », `docs/RESUME-VERIFICATION.md` R1) ; à vérifier. Conséquence probable : le compte SUPER PDP de production doit exister **dès la création** de l'entreprise, même sans facture à émettre.
- Message périmé (M13) : « Aucune adresse de réception trouvée … Avant le 01/09/2026 ou pour un particulier, c'est normal » (`nxPdpLookup`).

### 2.7 Sous-traitance avec TVA autoliquidée (M8)

- `next-mod-autres.js` l. 428, devis « Sous-traitance » en régime assujetti : « ClimPilot n'imprime pas encore ce cas : ne l'envoie pas tel quel, adapte la TVA et la mention ». En franchise, la mention de franchise est déjà mise (l. 434). Certain.
- Rien ne **bloque** l'émission d'une telle facture avec TVA : c'est un avertissement dans l'éditeur. Le XML n'a pas de catégorie `AE`. Certain.
- La règle (art. 283-2 nonies du CGI, cité dans l'appli avec le BOFiP BOI-TVA-DECLA-10-10-20 § 531 à 536) : **à vérifier**, non relue ici.
- **Lien** : mission TVA (après la comptable et le statut, `docs/FILE-DES-MISSIONS.md`). Proposition : FACT-C l'imprime (PDF : hors taxe + mention ; XML : `AE`, `VATEX-FR-AE`, à vérifier) si Gab est assujetti et fait de la sous-traitance ; sinon FACT-B **bloque** l'émission réelle d'un devis « Sous-traitance » en régime assujetti, avec le même message (garde-fou voulu). Question 9.

### 2.8 Conservation 10 ans hors Supabase (M9, lien avec P11)

- Durée : « Factures, avoirs, livre des recettes : **10 ans** à compter de la clôture de l'exercice — code de commerce, art. L123-22 » (`docs/RGPD-registre.md`, lu le 25/10/2026, niveau « certain »). La durée fiscale et la **forme** à conserver (forme d'origine : XML ? PDF ?) : à vérifier (comptable, § 6.2).
- Aujourd'hui (certain) : l'« Export complet » (`nxaExportComplet`, `next-assistant.js`) lit `climpilot_documents` avec `select('*')`, donc **HTML et XML compris**, plus les événements. Un fichier JSON, à la main. Le plan gratuit de Supabase n'a aucune sauvegarde (`docs/MISSION-P11.md` § 1.4, lu le 06/11).
- Manque (certain) : une procédure de reprise du registre (P11, manque 3) ; des fichiers lisibles sans ClimPilot (un PDF et un XML par facture). Proposition : P11-A garde l'export hebdomadaire ; FACT-B ajoute, dans l'export, un ZIP « une facture = un PDF + un XML » par année (le ZIP des XML existe déjà : `nxEinvExportYear`, `next-einvoice.js`). Question 10.
- La plateforme garde aussi une copie déposée (`download`) : durée chez SUPER PDP à vérifier (contrat).

### 2.9 Dépôt des factures pro et statut « Encaissée » (M10, M11)

- Une facture pro émise en réel n'est déposée que si Gab clique « Envoyer ». Proposition FACT-B : après l'émission réelle d'une facture pro, proposer « Déposer maintenant » ; ligne « N facture(s) pro pas encore déposée(s) » dans « À faire » et sur le tableau de bord. Question 5.
- Avant l'émission réelle d'une facture pro : contrôle bloquant de `nxEinvChecks` (SIREN du client, adresse avec code postal), message clair, rien d'émis. Sans lui, la facture figée part au contrôle de la plateforme, est refusée, et ne se corrige que par un avoir. Question 5.
- Statut « Encaissée » (`fr:212`) envoyé à la plateforme quand Gab marque une facture pro déposée « Payée » : **seulement si la règle l'exige** (données de paiement des prestations de services : à vérifier, § 6.2). Question 7.

### 2.10 Le chemin « registre → plateforme » jamais essayé pour de vrai (M12)

- En bac à sable, la fonction prend **le XML de l'appareil** (identités de test), pas celui du registre (`index.ts` l. 152). Le chemin de production (identifiant → XML du registre → dépôt) n'est vérifié que par des tests simulés (H, `test-superpdp-envoi.mjs`). Le premier essai réel serait la **première vraie facture**. Certain.
- Proposition FACT-A : en bac à sable, si l'appli fournit `document_id`, la fonction dépose **le XML du registre** (mêmes contrôles qu'en production : document à soi, `origine = 'emis'`, XML présent). Sur la copie d'essai, avec le SIRET de test `00000000100000` (SIREN de la société de test 000000001) et un client pro de test (SIREN 000000002), le XML du registre porte déjà les identités de test : le chemin de production entier s'essaie dans le bac à sable. Question 4. Les règles du bac à sable (identités acceptées) : à vérifier.

### 2.11 Messages faux ou périmés (M13) — certain

| Où | Texte | Problème |
|---|---|---|
| `next-superpdp.js` l. 119 (`nxPdpSend`) | « À partir du 01/09/2027, ses montants seront déclarés automatiquement (« e-reporting ») » | rien ne le fait |
| `next-superpdp.js` (`nxPdpLookup`) | « Avant le 01/09/2026 ou pour un particulier, c'est normal » | date passée |
| `next-superpdp.js` l. 3-18 (en-tête) | « Particuliers : pas de facture électronique (e-reporting à partir du 01/09/2027) » | commentaire, à aligner |
| `supabase/functions/superpdp/index.ts` l. 6-7 | « 1.10, PRÉPARÉ, NON DÉPLOYÉ » | à mettre à jour au déploiement |
| `next-regime.js` l. 221 et l. 240 | « en franchise en base (293 B) tu n'es pas concerné » (logiciel de caisse) | lu sur une version ancienne du BOFiP (§ 3.1) ; **ne pas changer** avant la comptable |

## 3. Logiciel de caisse (art. 286, I, 3° bis du CGI)

### 3.1 Ce que dit le texte : à relire, rien n'a été lu ici

- Pages à relire (non joignables le 11/11/2026) : **BOFiP BOI-TVA-DECLA-30-10-30, version du 25/03/2026** (date donnée par ton prompt ; un résumé de moteur de recherche donne la même date, annexe), **§ 10, 25, 35, 37, 40 et 375** ; l'article 286 du CGI et l'**article 1770 duodecies** (montant de l'amende) sur Légifrance. **Tout le contenu de ces paragraphes est à vérifier.**
- Ce que l'appli croit aujourd'hui (certain, code) : « en franchise en base (293 B) tu n'es pas concerné ; une fois assujetti, enregistrer ici les paiements de clients particuliers impose un logiciel ou système de caisse certifié » (`next-regime.js` l. 221). Source : extrait de BOI-TVA-DECLA-30-10-30 lu le 02/10/2026 (`docs/CORRECTIONS-1.10.md` § 4.5), version non notée.
- **Contradiction possible** (hypothèse) : un résumé de moteur de recherche sur la version 2026 ne permet pas de confirmer l'exclusion de la franchise en base (annexe). À trancher par la comptable sur le texte de la version du 25/03/2026. Rien ne change dans l'appli d'ici là.
- Le statut et le régime de TVA ne sont pas décidés : **ce dossier ne tranche pas**.

### 3.2 Les fonctions de ClimPilot qui enregistrent un règlement d'un client (certain, lu)

| Fonction | Fichier | Ce qu'elle enregistre | Où ça va |
|---|---|---|---|
| `payerFacture(kind,id,which)` | `index.html` l. 3208 | facture de devis (acompte / solde), location, intervention, contrat : `payeLe` = date du jour, `mode` | état synchronisé (`cp2_devis`, `cp2_loc`, `cp2_dep`, `cp2_contrats`), **modifiable** |
| `payDep(id)` | `index.html` l. 2458 | intervention : bascule payée ↔ facturée, `payeLe`, `modeReg` ; trace de l'annulation | état synchronisé |
| `askMode()` | `index.html` l. 3179 | mode de règlement **en texte libre** (Virement / Chèque / Espèces / CB proposés) | — |
| `annulerEncaissement` | `index.html` l. 3232 | retire le paiement, garde une trace (`nxTraceEncaissement` l. 3182) | état synchronisé |
| Enveloppes de `payerFacture` / `payDep` | `next-particuliers.js` (`garderPaiement` l. 178, `marquerIrregulier` l. 197) | délai L221-10 du Code de la consommation ; paiement « irrégulier » tracé | état + journal (`paiement_irregulier`) |
| Enveloppes de `payerFacture` / `annulerEncaissement` / `payDep` | `next-emission.js` `envelopper` l. 779 (l. 809-812) | **journal des paiements** du serveur : `paiement` / `paiement_annule`, facture réelle seulement, **sans montant** | `climpilot_doc_events` (ajout seul) |
| `nxbqPayer` (relevé bancaire) | `next-banque.js` `payer` l. 272 | paiement à la date de la ligne du relevé, par `payerFacture` / `payDep` | idem |
| `nxavRembourse` | `next-avoir.js` l. 244 | remboursement d'un avoir (date, mode) : ligne négative au livre | état synchronisé, **pas au journal** |
| `allRecettes`, `renderRecettes`, `exportCSVRecettes` | `index.html` l. 3360, 3390, 3411 ; `next-avoir.js` l. 283 ; `next-regime.js` `nxrgLivreLignes` l. 476 | **livre des recettes** : calculé à chaque affichage depuis l'état (pas une table figée) | lecture |

À retenir (certain) : la date et le mode d'un paiement vivent dans l'**état synchronisé**, qui se réécrit à chaque envoi ; le seul enregistrement inaltérable est le journal des paiements, sans montant, et seulement pour les factures réelles.

### 3.3 Les trois sorties, et ce que chacune changerait dans l'appli (sans trancher)

Les trois sorties sont celles nommées dans ton prompt ; leurs conditions exactes sont **à relire** dans les paragraphes du § 3.1.

| Sortie | Ce que l'appli devrait faire (probable) | Fonctions touchées | Coût (hypothèse) |
|---|---|---|---|
| **A. Tolérance « tous les paiements par un établissement de crédit »** | Pour un client particulier : plus d'« Espèces » ; mode choisi dans une liste fermée, plus en texte libre ; peut-être plus de chèque (un chèque compte-t-il ? à vérifier) ; le relevé bancaire devient la façon normale d'enregistrer ; refus d'un paiement « en main propre ». | `askMode`, `payerFacture`, `payDep`, `nxavRembourse`, `next-banque.js` (`MODES`), textes d'aide ; suites P (banque), R (R2), J | ≈ 1 à 2 jours |
| **B. Séparer les encaissements des particuliers** | ClimPilot n'enregistre plus le règlement d'un particulier : il est saisi ailleurs (outil certifié, ou la comptable depuis la banque). L'appli garde la facture ; le livre des recettes des particuliers vient d'un import. Le délai L221-10 et les relances doivent lire cette nouvelle source. | `payerFacture`, `payDep` (cas Particulier), `allRecettes`, `next-regime.js`, `next-objectifs.js` (Urssaf), `next-banque.js`, `next-particuliers.js`, relances | ≈ 3 à 5 jours, et un outil de plus pour toi |
| **C. Certification** | ClimPilot certifié par un organisme accrédité : journal des paiements complet et chaîné (montant, mode, date, numéro), totaux perpétuels, clôtures périodiques, archives signées, piste d'audit, conservation ; les paiements ne vivent plus dans l'état modifiable. | `next-emission.js`, migrations (journal, clôtures), `index.html` (paiements), exports | plusieurs semaines **et** une dépense de certification (hors de portée avant 2027 : hypothèse) |

Ce que ClimPilot a déjà pour C (certain) : registre des factures en ajout seul, numérotation par le serveur, journal des paiements en ajout seul. Ce qui manque (certain) : montant au journal, chaînage, clôtures, remboursements au journal, paiements hors état modifiable.

## 4. La liste de contrôle du 01/06/2027 et la facturation à blanc

### 4.1 Liste de contrôle (oui / non, vérifiable)

| # | Point | Comment le vérifier |
|---|---|---|
| L1 | `superpdp` du dépôt déployée sur TEST et sur le réel | Edge Functions › `superpdp` › version et date ; Logs sans erreur |
| L2 | Secret `ALLOWED_USER_IDS` posé sur les deux projets | écran « Facture électronique » sans « non configuré » |
| L3 | Bac à sable connecté sur TEST : `env` = `sandbox`, `env_brut` = `sandbox` | requête de lecture du § 6 de `docs/P6-ENV-COMPTE-RENDU.md`, sur TEST |
| L4 | `aal2` : scripts TEST et réel tous « OK » ; essai « session sans code → refus sans numéro consommé » fait sur TEST | lignes « OK » ; compte rendu de FACT-A |
| L5 | AF1-B fusionnée (fichiers jamais perdus, pas de TEST hors connexion) | `docs/FILE-DES-MISSIONS.md` |
| L6 | COMPTE fusionnée ; double authentification active sur ton compte réel, avec un moyen de secours | Paramètres › Mon compte |
| L7 | P11 fusionnée ; un export complet de moins de 7 jours rangé hors du PC | Paramètres ; le fichier |
| L8 | Facturation à blanc : **tous** les cas du § 4.3 verts, journal daté | compte rendu de la recette |
| L9 | Batterie complète verte sur `main` (dont la matrice XML : XSD + CEN + BR-FR) | rapport de la CI |
| L10 | Réponses écrites de la comptable aux questions du § 6.2, datées | document de la comptable |
| L11 | Logiciel de caisse : sortie choisie par la comptable ; si elle change l'appli, faite et testée | réponse C1 ; compte rendu |
| L12 | E-reporting : transmis par ClimPilot et essayé en bac à sable, **ou** procédure de secours écrite et essayée (si tu l'acceptes, question 8) | compte rendu de FACT-C |
| L13 | Sous-traitance : imprimée correctement, **ou** bloquée en régime assujetti (question 9) | suite de FACT-B ou FACT-C |
| L14 | Messages faux du § 2.11 corrigés | suite de FACT-B |
| L15 | Factures pro : proposition de dépôt et rappel des oubliées en place (si question 5 = oui) | suite de FACT-B |
| L16 | Outil de secours choisi (nom, coût, procédure écrite), pas encore utilisé | ta note |
| L17 | Procédure du jour J (§ 5.7) relue ; tu sais où créer les identifiants SUPER PDP de production | ta note |
| L18 | Restauration d'un export complet essayée sur la copie d'essai : factures et XML retrouvés, réimpression = version figée | cas W19 |

**Vert** = les 18 réponses sont « oui ». Les points qui exigent le SIRET (compte SUPER PDP de production, annuaire, premier dépôt réel) ne sont pas dans la liste : ils sont au § 5.7.

### 4.2 Facturation à blanc : préparation (sur TEST et le bac à sable, jamais sur le réel)

1. Copie d'essai reconstruite depuis `main` (après FACT-B), branchée sur ClimPilot-TEST ; un PC et un iPhone.
2. Paramètres › Entreprise : SIRET de test `00000000100000` (SIREN de la société de test 000000001), adresse fictive.
3. Facturation réelle sur TEST : probablement déjà démarrée (essais du 06-08/10 : F-2026-001 à 006, `docs/ESSAIS-SUPABASE-TEST.md`). Sinon, la démarrer sur la copie d'essai. Les nouvelles factures suivent la série.
4. Facture électronique : compte **bac à sable** connecté (sur TEST : après FACT-0 et le déploiement).
5. Clients fictifs : un pro (SIREN de test 000000002, adresse avec code postal), un particulier (devis signé dans les locaux), un donneur d'ordre (sous-traitance).
6. Double authentification active sur le compte de la copie d'essai (COMPTE).
7. Deux passes si le régime n'est pas tranché : franchise, puis assujetti (Paramètres › Statut & régime, sur TEST seulement).
8. Pour chaque cas : noter la date, l'heure, le numéro et le résultat. À la fin, lecture seule dans le SQL Editor de **TEST** :
   - `select num, type, origine, date_doc, fichiers_hash is not null as fichiers from public.climpilot_documents order by cree_le desc limit 40;`
   - `select type, count(*) from public.climpilot_doc_events group by type;`

### 4.3 Les cas

| Cas | Ce qu'on fait | Ce qu'on vérifie | Vert si |
|---|---|---|---|
| W1 Acompte (pro) | devis accepté, acompte 30 %, « Facturer l'acompte » | numéro F- du serveur ; registre : type `acompte`, fichiers présents ; contrôle de la plateforme conforme ; dépôt (bac à sable, chemin du registre si question 4) ; statut « Déposée » puis suivant | tout observé, aucun message d'erreur |
| W2 Solde (pro) | même devis, « Facturer le solde » | solde = total − acompte au centime ; XML : déjà payé = acompte, cadre `…4` ; 2e solde refusé par le serveur | idem |
| W3 Payée le jour même (pro) | intervention payée sur place, facturée le même jour | cadre `…2`, net à payer 0, échéance = date de paiement | idem |
| W4 Avoir partiel | avoir de 50 % sur l'acompte | numéro AV- ; XML 381 avec la référence ; dépôt | idem |
| W5 Avoir total | avoir total sur une facture | facture annulée ; chantier de nouveau facturable ; une seule facture vivante | idem |
| W6 Particulier | facture d'un devis signé dans les locaux | facture émise, PDF remis ; « Envoyer » refusé avec l'explication (texte corrigé) ; présent dans l'e-reporting (FACT-C) | idem |
| W7 Pro, autres sortes | une intervention (date de prestation), une location, un contrat d'entretien | chaque sorte émise, contrôlée conforme, déposée | idem |
| W8 Sous-traitance | devis « Sous-traitance » pour le donneur d'ordre | franchise : mention de franchise ; assujetti : autoliquidation correcte (FACT-C) **ou** blocage voulu (FACT-B) | conforme à la question 9 |
| W9 Chaque taux | franchise (catégorie E, mention L. 233-3 du CIBS en 2027), 5,5 %, 10 %, 20 %, mixte 5,5 + 20 | totaux du XML = PDF au centime ; contrôle de la plateforme conforme pour chacun | 0 écart |
| W10 Hors ligne puis réseau | mode avion → « Facturer » ; réseau → même clic ; puis couper le réseau **juste après** un clic | 1) « NON émise : pas de réseau », chantier « à facturer » ; 2) facture émise ; 3) « Résultat INCONNU », nouveau clic sur le même appareil → **même numéro**, un seul document ; fichiers au registre (AF1-B) | idem |
| W11 Deux appareils | PC et iPhone facturent le même devis à quelques secondes | une seule facture ; l'autre appareil la reprend ; réimpression sur l'autre appareil = version figée | idem |
| W12 Refus au contrôle | client pro sans SIREN, puis sans code postal | émission réelle **refusée avant** le numéro (FACT-B) ; aucune facture figée fausse | idem |
| W13 Refus de la plateforme | rejet technique `fr:213`, refus du client `fr:210` (si le bac à sable permet de les provoquer, hypothèse) | `fr:213` : renvoi permis ; `fr:210` : renvoi bloqué, « avoir » proposé | observé, sinon noté « couvert par la suite H seulement » |
| W14 Double authentification | session ouverte sans le code (appli fermée pendant la saisie du code) → « Facturer » | refus du serveur, **aucun numéro consommé** ; code demandé ; même demande → facture | idem |
| W15 Paiement | « 💶 Payée » sur une facture pro déposée | livre des recettes ; journal `paiement` ; statut « Encaissée » transmis (si question 7 = oui) | idem |
| W16 Relevé bancaire | CSV fictif avec le montant d'une facture | rapprochée « sûr », payée à la date de la ligne | idem |
| W17 Factures reçues | bac à sable : liste des factures reçues | liste, téléchargement, approuver | idem |
| W18 Annuaire | recherche du SIREN 000000002 | « Peut recevoir » | idem |
| W19 Export et reprise | Export complet, puis restauration dans un autre navigateur | fichier avec chaque facture (HTML et XML) ; réimpression = version figée, pas de « Duplicata reconstitué » | idem |

### 4.4 Critère « vert » de la facturation à blanc
- Les 19 cas sont verts, dans les deux passes si le régime n'est pas tranché.
- Registre de TEST : autant de documents que de numéros notés ; numéros continus par série ; `fichiers` = vrai partout.
- Aucune erreur JavaScript visible ; aucun numéro `TEST-` après le démarrage.
- Un cas non vert : il devient un test rouge dans une branche de correction, puis on rejoue le cas.

## 5. Tests, scripts, branches, déploiement

### 5.1 Découpage en branches (une semaine au plus chacune)

| Branche | Contenu | Prérequis | Durée (sessions) |
|---|---|---|---|
| **FACT-0** `outillage/fact-pdp-test` | Scripts SQL pour TEST (`climpilot_pdp`, `pdp_cred_*`), retour arrière, script de lecture du réel, test SQL. **Aucun code de l'appli** : peut avancer à côté de la mission en cours. | — | ½ à 1 jour |
| **FACT-A** `correctif/fact-aal2` | `aal2` (migration, 3 scripts, fonction `superpdp`, appli : reconnaître l'erreur) ; bac à sable « depuis le registre » (question 4). | COMPTE et AF1-B fusionnées | 3 à 4 jours |
| **FACT-B** `correctif/fact-usage` | Contrôle avant émission d'une facture pro ; proposition de dépôt et rappel ; messages corrigés ; blocage de la sous-traitance assujettie (question 9) ; ZIP PDF + XML (question 10) ; matrice XML étendue (5,5 %, mixte, avoir total) ; scénario automatisé de la facturation à blanc sur le banc. | FACT-A | 2,5 à 3,5 jours |
| **FACT-C** (une ou deux branches) | E-reporting ; statut « Encaissée » ; autoliquidation ; Factur-X ou XML détaillé si exigés ; sortie « caisse » si elle touche l'appli. **Dossier complémentaire d'abord**, après lecture des sources officielles. | réponses de la comptable, mission TVA, hôtes autorisés | dossier ½ jour ; code 4 à 8 jours (hypothèse forte) |

### 5.2 Tests à écrire d'abord (rouges sur `main`)

Horloge `REF` (`tests/lib.mjs`) ou figée ; aucun test ne lit la vraie date ; `faketime` un samedi, un dimanche et le 05/01/2028 (règle 9). Journal des rouges gardé (`git stash push <fichiers de code>`). Nom de la nouvelle suite navigateur : la lettre libre au moment du code (AB = S, AG = P11, AH = COMPTE, la suivante pour AF1-B ; éviter AF).

**FACT-0**
- `tests/sql/test_pdp_identifiants.py` (PostgreSQL 16 local, marqueur `climpilot-test`) : `00_supabase_emul.sql` gagne un coffre Vault minimal (`vault.create_secret`, `vault.update_secret`, `vault.decrypted_secrets`, `vault.secrets`) ; script TEST joué deux fois (rejouable) ; sans marqueur → STOP, rien créé ; table et 3 fonctions présentes ; `anon` et `authenticated` n'ont aucun droit, `service_role` exécute ; enregistrer / relire / effacer un identifiant ; retour arrière ; `test_p6_14` reste vert. **Rouge sur `main`** : scripts absents.

**FACT-A**
- `tests/sql/test_aal2.py` : la liste de `docs/MISSION-COMPTE.md` § 5.5 (sans facteur → accepté ; facteur vérifié + `aal1` → refus `42501`, **compteur inchangé** ; `aal2` → accepté ; facteur non vérifié → accepté ; refus puis même `request_id` en `aal2` → une seule facture ; mêmes cas pour `cp_importer_ancien`, `cp_document_fichiers`, `cp_emettre_document_complet` si présente) ; règle C1 inchangée ; retour arrière = textes d'avant. `00_supabase_emul.sql` gagne `auth.jwt()` et `auth.mfa_factors`.
- `tests/functions/test-superpdp-envoi.mjs` : facteur vérifié + jeton `aal1` → 403 `aal2` ; `aal2` → accepté ; sans facteur → accepté ; liste blanche vérifiée **avant** ; bac à sable + `document_id` → XML du registre déposé, document d'un autre compte refusé (question 4).
- Suite navigateur FACT : erreur `aal2` à l'émission → écran du code → même `request_id`, un seul numéro ; erreur `aal2` à l'envoi → message ; serveur simulé (`tests/serveur-simule.mjs`) et banc (`tests/banc-appareils.mjs`) : option « session sans code ».

**FACT-B**
- Suite navigateur FACT : facture pro sans SIREN ou sans code postal en réel → refus avant tout appel au serveur ; facture pro émise → « Déposer maintenant » proposé ; rappel « N facture(s) pro pas encore déposée(s) » ; textes corrigés ; devis « Sous-traitance » en assujetti → refus (si question 9 = oui) ; ZIP d'une année : un PDF et un XML par facture (si question 10 = oui).
- `tests/genxml2.mjs` + suite F : 5,5 %, mixte 5,5 + 20, avoir total ; XSD + CEN + BR-FR à 0 bloquant. Les 11 XML existants restent identiques.
- Banc deux appareils : scénario W10-W11 automatisé (coupure juste après un appel nommé, demandé aussi par AF1-B § 4.3).

### 5.3 Scripts SQL (numéro libre au moment du code ; 7 au 11/11, AF1-B et COMPTE peuvent prendre les suivants)

| Script | Où | Contenu | Résultat attendu |
|---|---|---|---|
| `<n>-pdp-TEST.sql` | TEST | verrou sur `public.climpilot_marqueur_test` ; vérifie Vault ; `create table if not exists climpilot_pdp` + RLS (lecture si propriétaire) ; `pdp_cred_*` (copie conforme de `supabase/schema.sql`) ; droits ; aucune donnée écrite | N lignes « OK » |
| `<n>-pdp-retour-arriere.sql` | TEST | retire les 3 fonctions et la table **si elle est vide** (sinon STOP) | « OK » |
| `<n>-REEL-pdp-lecture.sql` | réel | s'arrête si le marqueur de TEST est présent ; **lecture seule** : table, fonctions, droits (`anon` aucun) | lignes « OK » |
| `<n+1>-aal2-TEST.sql`, `<n+1>-REEL-aal2.sql`, `<n+1>-aal2-retour-arriere.sql` | TEST, réel | `docs/MISSION-COMPTE.md` § 4.3 : migration telle quelle ; contrôles dans une transaction annulée ; aucune donnée écrite | lignes « OK » |

C'est toi qui les colles dans le SQL Editor (CLAUDE.md règle 2).

### 5.4 Suites qui ne doivent pas bouger (la batterie le vérifie)
F (11 XML existants identiques), H, I, N, R, AA, AD, AE, Q, U (golden inchangé), W (**aucune enveloppe ajoutée** : FACT modifie les fonctions d'origine, règle 11), X, Y et Z (aucun montant, aucune mention, aucun arrondi). Les 5 « À TRANCHER » ne bougent pas. Cache `const C=` de `sw.js` : une fois par branche qui touche un fichier en cache.

### 5.5 Ordre et calendrier proposés

| Quand | Quoi | Qui |
|---|---|---|
| dès maintenant | secret + `superpdp` du dépôt sur le **réel** (gestes 1-2) | Gab |
| novembre-décembre 2026 | FACT-0 (à côté de S) ; puis script TEST, secret, `superpdp` sur TEST, bac à sable reconnecté (gestes 3-5) | CC puis Gab |
| décembre 2026 | réponses de la comptable (§ 6.2), statut et régime | Gab |
| après COMPTE et AF1-B (cible : mars 2027) | FACT-A ; scripts `aal2` TEST puis réel | CC puis Gab |
| cible : avril 2027 | FACT-B ; dossier FACT-C (sources relues) | CC |
| après la mission TVA (cible : mai 2027) | FACT-C | CC |
| mai 2027 | facturation à blanc complète (§ 4.3) | Gab |
| 01/06/2027 | liste de contrôle (§ 4.1) | Gab |
| après le SIRET | jour de la bascule (§ 5.7) | Gab |

Toujours une seule mission sur le code de l'appli à la fois (règle 6). FACT-0 n'en est pas une (tests et scripts seulement).

### 5.6 Gestes de Gab, pas à pas

**Réel, dès maintenant (≈ 15 min)**
1. Supabase RÉEL › Authentication › Users : copie ton identifiant. Edge Functions › **Secrets** : `ALLOWED_USER_IDS` = cet identifiant. Attendu : le secret apparaît dans la liste (sa valeur est masquée).
2. Edge Functions › `superpdp` : déployer **tout** `supabase/functions/superpdp/index.ts` de `main`, vérification du jeton **activée** (procédure : `docs/P6-ENV-COMPTE-RENDU.md` § 6 ; libellés du tableau de bord : hypothèse). Attendu : dans l'appli, écran « Facture électronique » → « 🧪 Connecté — compte de TEST » ; Logs sans erreur. Si « non configuré » ou 503 : le secret manque. Retour arrière : redéployer la version précédente.

**TEST, après la fusion de FACT-0 (≈ 20 min)**
3. Supabase TEST › SQL Editor : coller tout `<n>-pdp-TEST.sql`. Attendu : toutes les lignes « OK ». Sinon : STOP, noter l'affichage.
4. TEST : secret `ALLOWED_USER_IDS` (ton identifiant **sur TEST**), puis déploiement de `superpdp` comme au geste 2.
5. Copie d'essai : Facture électronique › connecter le **bac à sable** (`client_id` / `client_secret` de test). Attendu : « 🧪 Connecté — compte de TEST ». Lecture seule sur TEST : `select env, company->>'env_brut' as env_brut from public.climpilot_pdp;` → `sandbox`, `sandbox`.

**Après FACT-A (≈ 30 min)** : double authentification active sur TEST (COMPTE) ; script `aal2` TEST ; essai W14 ; fusion ; F5 partout ; double authentification active sur le réel ; script `aal2` réel ; redéploiement de `superpdp`.

**Mai 2027** : la facturation à blanc (§ 4.2, 4.3), ≈ 3 h.

### 5.7 Le jour de la bascule réelle (après le SIRET, ≈ 2 h)

Avant : liste du 01/06 verte ; compte bancaire professionnel ; réponses de la comptable appliquées.
1. **SUPER PDP** : créer le compte de production de l'entreprise, choisir SUPER PDP comme plateforme de réception (inscription à l'annuaire : démarche à vérifier dans leur espace), créer l'application OAuth. Attendu : `client_id` et `client_secret` de production.
2. **ClimPilot**, Paramètres › Entreprise : vrai SIRET, raison sociale, adresse, IBAN, n° de TVA si assujetti. Attendu : la carte « Facture électronique » du registre n'affiche plus rien à compléter.
3. Facture électronique : « Déconnecter » le bac à sable, connecter la production. Attendu : « ✅ Connecté — compte réel », aucun avertissement de type de compte. Lecture seule sur le **réel** : `select env, company->>'env_brut' from public.climpilot_pdp;` → `production`, `production`. Autre valeur : STOP, transmettre.
4. Annuaire : chercher ton propre SIREN. Attendu : « Peut recevoir ».
5. Paramètres › Facturation réelle : « Démarrer » à la date du jour ; anciennes factures = essais. Attendu : badge « ● Facturation réelle ».
6. Première facture à un client pro : émettre, contrôler, déposer. Attendu : numéro `F-AAAA-001` ; statut « Déposée » puis « Émise par la plateforme ». Lecture seule sur le réel : 1 ligne dans `climpilot_documents`, fichiers présents.
7. Première facture à un particulier : PDF remis ; e-reporting selon FACT-C.
8. Le soir : Export complet, rangé hors du PC ; F5 sur chaque appareil.

### 5.8 Plan de repli si un point est rouge au 01/06/2027

- **Décision** : le 01/06, toi, sur la liste. Un point rouge parmi L1-L9, L11, L13-L15 ou L18 : **outil de secours pour toutes les factures** ; L12 seul rouge : ClimPilot émet, e-reporting par la procédure de secours (si la comptable l'accepte, question 8).
- **Outil de secours** (à choisir avant le 01/04, dépense : ta décision) : une solution qui émet par une plateforme agréée (le portail de SUPER PDP s'il en a un : hypothèse), avec sa propre numérotation et un export. Tu y fais les factures et les encaissements ; ClimPilot garde devis, planning, interventions, fluides **en démonstration** (numéros TEST, aucun mélange).
- **Retour à ClimPilot** quand la liste est verte : « Démarrer la facturation réelle ». Le démarrage sait importer d'anciennes factures `F-AAAA-NNN` au registre et continuer la série (`importerAnciens`, `p_min_numero`), mais **seulement à ce format** ; deux séries la même année (secours puis ClimPilot) : question de la comptable (C9).
- Durée visée : quelques semaines (ta décision du 11/11).

### 5.9 Risques

| Risque | Garde-fou | Certitude |
|---|---|---|
| Le premier dépôt réel échoue (chemin jamais essayé) | question 4 (chemin du registre en bac à sable) ; jour J sur une petite facture | probable |
| Règles fiscales mal comprises (e-reporting, caisse, Factur-X) | aucune règle codée sans source relue et réponse écrite de la comptable ; FACT-C après | certain (méthode) |
| Retard des missions avant FACT (S, COMPTE, P11, AF1-B, TVA…) | FACT-0 et les gestes 1-5 tout de suite ; calendrier du § 5.5 ; repli | probable |
| Compte bloqué par la double authentification | procédure de secours de COMPTE ; la règle se relâche quand le facteur est retiré | certain (COMPTE § 4.4) |
| Documentation SUPER PDP différente du code (champs `env`, statuts, e-reporting) | relecture en FACT-C ; essais W1-W19 | hypothèse |
| Facture pro figée fausse (SIREN, adresse) | contrôle avant émission (FACT-B) | certain (manque lu) |
| Perte du registre (plan gratuit sans sauvegarde) | P11 ; export hebdomadaire ; plan Pro en juin 2027 (ta décision) | certain |

### 5.10 Estimation honnête

- **Code** : FACT-0 ½ à 1 jour ; FACT-A 3 à 4 ; FACT-B 2,5 à 3,5 ; FACT-C 4 à 8 (incertain : dépend de la documentation SUPER PDP et des règles) ; plus les relectures P10 et les corrections, ≈ 1 jour par branche. **Total ≈ 14 à 21 jours de sessions.**
- **Ton temps** : ≈ 15 min (réel), 20 min (TEST), 30 min (après FACT-A), 3 h (facturation à blanc), 2 h (jour J), plus les rendez-vous avec la comptable.
- **Probabilité d'être vert au 01/06** (hypothèse) : bonne pour L1-L9 si FACT-A et FACT-B passent avant avril ; **incertaine pour L11 et L12** (réponses de la comptable, e-reporting). D'où le repli prévu.

## 6. Questions

### 6.1 Pour Gab (oui / non)

1. **FACT est une exception au gel** (ta décision du 11/11) ? `docs/FILE-DES-MISSIONS.md` la range dans « Plus tard (gelé) : factures par ClimPilot (Super PDP réel + e-reporting), au plus tôt fin 2027 », et `docs/APRES-PRO-V1.md` dans les idées de l'après PRO v1. Si oui : la mission qui met la file à jour l'y retire, avec la date.
2. **Découpage FACT-0 / A / B / C** (§ 5.1) ? Recommandé : oui.
3. **FACT-A après AF1-B** (les fonctions à copier pour `aal2` sont alors les dernières) ? Recommandé : oui.
4. **Bac à sable « depuis le registre »** (§ 2.10) : le chemin de production s'essaie avant la première vraie facture ? Recommandé : oui.
5. **Facture pro** : contrôle bloquant avant l'émission (SIREN, adresse), proposition « Déposer maintenant » et rappel des factures pro pas déposées ? Recommandé : oui.
6. **`aal2` aussi pour le journal des paiements** (`cp_document_evenement`) ? Recommandé : non (la décision COMPTE Q1 vise l'émission et SUPER PDP ; les paiements restent modifiables dans l'état de toute façon).
7. **Statut « Encaissée » envoyé à la plateforme** au paiement d'une facture pro déposée, **si** la comptable confirme l'obligation ? Recommandé : oui, sous cette condition.
8. **E-reporting par une procédure de secours** (saisie manuelle chez la plateforme, si elle existe) acceptée les premières semaines, si FACT-C n'est pas prête au 01/06 ? Ta décision (et celle de la comptable).
9. **Sous-traitance en régime assujetti bloquée** à l'émission réelle tant que ClimPilot ne l'imprime pas ? Recommandé : oui (garde-fou voulu).
10. **ZIP « un PDF + un XML par facture »** pour la conservation hors Supabase ? Recommandé : oui.
11. **Numéro affiché** (`VERSION`, `NX_VERSION`) inchangé pour chaque branche FACT ? Recommandé : oui.
12. **Autoriser les hôtes** `www.impots.gouv.fr`, `bofip.impots.gouv.fr`, `www.legifrance.gouv.fr`, `www.superpdp.tech` (et le site de documentation de SUPER PDP) dans le réseau de l'environnement, pour relire les sources avant FACT-C ? Recommandé : oui.

### 6.2 Pour ta comptable (décembre 2026)

1. **Logiciel de caisse** : avec le statut et le régime choisis, Gab est-il concerné (BOFiP BOI-TVA-DECLA-30-10-30 du 25/03/2026, § 10, 25, 35, 37, 40, 375 ; amende de l'art. 1770 duodecies) ? Si oui, quelle sortie : A (tous les paiements par un établissement de crédit), B (séparer les encaissements des particuliers) ou C (certification) ? Le chèque compte-t-il pour A ?
2. **E-reporting** : concerné (y compris en franchise) ? date de départ, fréquence, contenu (ventes aux particuliers, paiements des prestations) ? par SUPER PDP ?
3. **Statut « encaissée »** obligatoire pour les prestations facturées à des professionnels ?
4. **Format** : le XML CII seul suffit-il, ou faut-il un Factur-X ? Faut-il remettre aussi un PDF au client pro ?
5. **Détail des lignes** : un XML à une ligne par taux de TVA respecte-t-il la mention obligatoire de désignation ?
6. **Nature de l'opération** (cadre BT-23) d'une clim fournie et posée : services (S) ou mixte (M) ? (doute ouvert depuis le 01/10, `docs/RESUME-VERIFICATION.md` R4)
7. **Sous-traitance** : mention exacte de l'autoliquidation, et cas de la franchise en base.
8. **Conservation** : durée (10 ans, code de commerce L123-22) et **forme** à conserver (XML d'origine, PDF) ; un export JSON + PDF + XML rangé hors du serveur suffit-il ?
9. **Outil de secours** : deux séries de numéros la même année (secours puis ClimPilot) sont-elles acceptables ? Comment reprendre ?
10. **Facture rejetée par la plateforme** (rejet technique) : est-elle émise ? Se renvoie-t-elle corrigée sous le même numéro, ou faut-il un avoir ?
11. **Date d'un encaissement** par chèque ou espèces : date de réception ou date du crédit en banque ? (question déjà posée par `next-banque.js`)

## Annexe — recherches faites le 11/11/2026 (indices non officiels, à ne pas citer comme règles)

Les pages officielles n'ont pas pu être ouvertes (hôtes bloqués). Trois recherches par moteur de recherche ont donné des **résumés de sites tiers**. Rien de ce qui suit n'est utilisé comme règle dans ce dossier.
- Logiciel de caisse : le résumé situe la version courante de BOI-TVA-DECLA-30-10-30 au 25/03/2026 et ne permet pas de dire si la franchise en base en est exclue. Liens : [bofip.impots.gouv.fr — BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/bofip/10691-PGP.html), [CCI France — systèmes de caisse sécurisés](https://www.landes.cci.fr/wp-content/uploads/2020/11/systemes_de_caisse_securises-cci_france.pdf), [Weblex — FAQ logiciel de caisse](https://www.weblex.fr/sites/default/files/images/docs/FAQ%20logiciel%20de%20caisse.pdf).
- Calendrier et e-reporting : sites d'éditeurs indiquant le 01/09/2027 pour l'émission et l'e-reporting des PME et micro-entreprises ; aucun résultat d'impots.gouv.fr. Liens : [Sage — micro-entrepreneur](https://www.sage.com/fr-fr/dematerialisation/facture-electronique/micro-entrepreneur/), [Propulse by CA — e-reporting](https://propulsebyca.fr/comptabilite/facture/electronique/e-reporting), [Indy — report](https://www.indy.fr/guide/tenue-comptable/facture-electronique/report/).
- SUPER PDP : comparateurs indiquant Factur-X, UBL et CII, un bac à sable et l'e-reporting ; documentation officielle non trouvée. Liens : [comparepdp.com — Super PDP](https://comparepdp.com/articles/super-pdp), [comparateur-efacturation.fr — superpdp](https://comparateur-efacturation.fr/plateforme/superpdp).
