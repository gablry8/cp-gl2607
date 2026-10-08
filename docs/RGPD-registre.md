# Registre des activités de traitement — BROUILLON (ClimPilot 1.10)

> Brouillon préparé le 02/10/2026 à partir du code de ClimPilot et de la configuration Supabase lue en lecture seule.
> Tout ce qui est marqué **à confirmer** doit être vérifié et complété par Gabriel avant usage.
> Ce document ne remplace pas un conseil juridique. Modèle de la CNIL : https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement (modèle de base : https://www.cnil.fr/sites/default/files/atoms/files/registre_rgpd_basique.pdf)

## Responsable du traitement
- Dénomination : **à compléter** (dénomination de l'entreprise, avec « EI » pour un entrepreneur individuel).
- Adresse, SIRET, contact pour les demandes RGPD : **à compléter** (une adresse e-mail dédiée est conseillée).
- Délégué à la protection des données : non obligatoire pour cette activité (**à confirmer**).

## Traitement 1 — Gestion des clients, devis, interventions, factures
| Rubrique | Contenu |
|---|---|
| Finalités | Établir les devis, réaliser et suivre les interventions, facturer, encaisser, relancer, tenir le livre des recettes, émettre les factures électroniques |
| Base légale | Exécution du contrat ; obligations légales (facturation, comptabilité, facture électronique) |
| Personnes concernées | Clients particuliers et contacts des clients professionnels |
| Données | Nom, adresse, téléphone, e-mail, SIREN (professionnels), adresse d'intervention, équipements, contenu des devis et factures, paiements |
| Destinataires | Gabriel ; son comptable (**à confirmer**) ; plateforme de facturation électronique SUPER PDP pour les factures entre professionnels (**à confirmer** selon l'usage réel) |
| Hébergement / sous-traitants | Navigateur de l'appareil ; Supabase (synchronisation, région Union européenne — Irlande, `eu-west-1`) |
| Transferts hors UE | Aucun prévu pour ce traitement (**à confirmer** avec les conditions de Supabase) |
| Durées | Pièces comptables (factures) : 10 ans (Code de commerce, art. L123-22). Devis non signés et prospects : **à confirmer** (la CNIL recommande 3 ans après le dernier contact pour la prospection) |
| Sécurité | Compte unique protégé par mot de passe ; règles d'accès Supabase (RLS) ; factures figées non modifiables côté serveur (migration 1.10, non appliquée) ; **à faire** : protection des mots de passe divulgués et double authentification (voir `docs/CORRECTIONS-1.10.md`, étape 5) |

## Traitement 2 — Signature électronique des devis et fiches
| Rubrique | Contenu |
|---|---|
| Finalités | Recueillir l'accord du client et en conserver la preuve ; remettre l'exemplaire signé |
| Base légale | Exécution du contrat ; intérêt légitime à conserver la preuve |
| Données | Nom saisi, signature manuscrite (image), date et heure, adresse IP, navigateur, empreinte du document, consentements (demande expresse, support durable), date de téléchargement de l'exemplaire |
| Hébergement | Supabase (UE — Irlande) ; page publique `signer.html` |
| Information des personnes | Paragraphe « Données personnelles » sur la page de signature (1.10) |
| Durées | Durée de la relation puis prescription des actions liées au contrat (**à confirmer**, par exemple 5 ans après la fin du contrat ; 10 ans si la preuve accompagne une facture) |

## Traitement 3 — Assistant de dictée (fonction serveur `assistant`)
| Rubrique | Contenu |
|---|---|
| Finalités | Transformer les dictées de Gabriel en notes, tâches, propositions de devis ; lire des plaques signalétiques et des factures d'achat |
| Données | Texte dicté (peut contenir des noms et adresses de clients), résumé de l'activité (noms de clients, villes, statuts), photos de plaques et de factures fournisseurs |
| Destinataire / sous-traitant | Anthropic (API Claude), appelée par la fonction serveur |
| Transferts hors UE | **Probables** (fournisseur établi aux États-Unis) — garanties à vérifier dans les conditions du fournisseur (**à confirmer**) |
| Minimisation | Ne dicter que le nécessaire ; éviter les données sensibles |
| Durées | Journal d'usage (`climpilot_ai_usage`) : coûts et volumes, sans contenu ; boîte de réception (`climpilot_inbox`) : **à confirmer** |

## Traitement 4 — Sauvegardes
| Rubrique | Contenu |
|---|---|
| Finalités | Restaurer les données en cas de perte |
| Données | Copie complète des données de l'appli (fichier JSON téléchargé, copies locales, état synchronisé) |
| Lieu | Appareils de Gabriel ; Supabase (UE) |
| Durées | **À confirmer** (rotation des fichiers téléchargés) |

## Droits des personnes
- Demandes (accès, rectification, effacement, opposition, limitation) : à traiter dans un délai d'un mois.
- Effacement limité par les obligations de conservation (factures).
- Réclamation : CNIL (https://www.cnil.fr).

## Points à confirmer (récapitulatif)
1. Dénomination et contact RGPD du responsable.
2. Destinataires réels (comptable, plateforme de facturation).
3. Durées de conservation des devis non signés, des preuves de signature, de la boîte de réception.
4. Transferts hors UE de l'assistant (garanties du fournisseur).
5. Mesures de sécurité du compte (mots de passe divulgués, double authentification).
