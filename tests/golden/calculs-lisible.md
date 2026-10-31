# Golden master des calculs — devis « à vérifier à la main »

Généré le 2026-10-21 depuis le commit `86114f8`, horloge figée au 2026-10-20T10:00:00+02:00, régime franchise (TVA 0) sauf mention.
Ce sont les montants que l'appli calcule AUJOURD'HUI (figés, pas jugés). Gabriel les compare à l'appli : Nouveau devis › même nature › mêmes valeurs.

## Bisplit avec acompte 30 % (défaut)

Cas `b-acompte-30` — taux horaire 45 €/h, 12.3375 h, cotisations 23.68 %, franchise de TVA

| Groupe | Ligne | Qté | Unité | PU HT | Total HT | Achat |
|---|---|---:|---|---:|---:|---:|
| Matériel | Machine 1 — M R1 | 1 | u | 1815,38 € | 1815,38 € | 1180,00 € |
| Matériel | Liaison split 1 (Liaison 1/4 - 3/8, 2.5 kW) | 6 | m | 10,00 € | 60,00 € | 39,00 € |
| Matériel | Câble interco. split 1 (Câble 5G1,5) | 6 | m | 2,77 € | 16,62 € | 10,80 € |
| Matériel | Liaison split 2 (Liaison 1/4 - 3/8, 2.5 kW) | 4 | m | 10,00 € | 40,00 € | 26,00 € |
| Matériel | Câble interco. split 2 (Câble 5G1,5) | 4 | m | 2,77 € | 11,08 € | 7,20 € |
| Matériel | Alimentation groupe ext. (Câble 3G2,5) | 8 | m | 2,31 € | 18,46 € | 12,00 € |
| Matériel | Goulotte (Goulotte 80x60) | 5 | m | 9,17 € | 45,83 € | 27,50 € |
| Matériel | Accessoires goulotte | 5 | m | 2,50 € | 12,50 € | 7,50 € |
| Matériel | Évacuation condensats | 6 | m | 1,33 € | 8,00 € | 4,80 € |
| Matériel | Support (Support sol) | 1 | u | 38,46 € | 38,46 € | 25,00 € |
| Matériel | Disjoncteur 16A | 1 | unité | 9,17 € | 9,17 € | 5,50 € |
| Pose & main-d’œuvre | Pose unité(s) extérieure(s) et support | 2 | h | 45,00 € | 90,00 € | 0,00 € |
| Pose & main-d’œuvre | Pose unité(s) intérieure(s) | 3 | h | 45,00 € | 135,00 € | 0,00 € |
| Pose & main-d’œuvre | Liaisons frigorifiques, câble, passage de mur | 3 | h | 45,00 € | 135,00 € | 0,00 € |
| Pose & main-d’œuvre | Pose de goulotte | 0.75 | h | 45,00 € | 33,75 € | 0,00 € |
| Pose & main-d’œuvre | Raccordement électrique | 1 | h | 45,00 € | 45,00 € | 0,00 € |
| Pose & main-d’œuvre | Nettoyage et explications au client | 0.5 | h | 45,00 € | 22,50 € | 0,00 € |
| Mise en service & déplacement | Mise en service | 1 | forfait | 250,00 € | 250,00 € | 0,00 € |
| Mise en service & déplacement | Brasure | 1 | forfait | 30,00 € | 30,00 € | 0,00 € |
| Mise en service & déplacement | Mise sous vide / contrôle | 1 | forfait | 80,00 € | 80,00 € | 0,00 € |
| Frais & divers | Consommables (forfait moyen) | 1 | forfait | 85,00 € | 85,00 € | 51,00 € |
| Pose & main-d’œuvre | Préparation du chantier | 0.5 | h | 45,00 € | 22,50 € | 0,00 € |
| Pose & main-d’œuvre | Achat et enlèvement du matériel | 1 | h | 45,00 € | 45,00 € | 0,00 € |
| Pose & main-d’œuvre | Provision SAV / garantie (5 %) | 0.5875 | h | 45,00 € | 26,44 € | 0,00 € |
| Mise en service & déplacement | Déplacement | 1 | forfait | 35,00 € | 35,00 € | 0,00 € |
| Frais & divers | Frais administratifs devis | 1 | forfait | 20,00 € | 20,00 € | 20,00 € |
| Frais & divers | Frais commande matériel | 1 | forfait | 20,00 € | 20,00 € | 20,00 € |
| Frais & divers | Marge sécurité (5%) | 1 | forfait | 157,53 € | 157,53 € | 0,00 € |

- **Total HT** : 3308,22 € (somme des lignes)
- **TVA** : 0,00 € (0 %, franchise : 0)
- **Total TTC** : 3308,22 €
- **Acompte** : 992,47 € (30.00 % du TTC facturable 3308,22 €)
- **Solde** : 2315,75 € (TTC − acompte)
- Coût réel : 2155,37 € = achats 1723,56 € + main-d'œuvre interne 431,81 € ; bénéfice 1152,85 € ; cotisations 783,39 € ; bénéfice net 369,46 €

## MONO-SPLIT simple (à vérifier à la main) : 1 machine 980 € achat marge 35 %, liaison 5 m, support mural

Cas `d-mono-simple` — taux horaire 45 €/h, 8.4 h, cotisations 23.68 %, franchise de TVA

| Groupe | Ligne | Qté | Unité | PU HT | Total HT | Achat |
|---|---|---:|---|---:|---:|---:|
| Matériel | Machine 1 — Daikin FTXM25 | 1 | u | 1507,69 € | 1507,69 € | 980,00 € |
| Matériel | Liaison split 1 (Liaison 1/4 - 3/8, 2.5 kW) | 5 | m | 10,00 € | 50,00 € | 32,50 € |
| Matériel | Câble interco. split 1 (Câble 5G1,5) | 5 | m | 2,77 € | 13,85 € | 9,00 € |
| Matériel | Alimentation groupe ext. (Câble 3G2,5) | 6 | m | 2,31 € | 13,85 € | 9,00 € |
| Matériel | Évacuation condensats | 4 | m | 1,33 € | 5,33 € | 3,20 € |
| Matériel | Support (Support mural) | 1 | u | 0,00 € | 0,00 € | 0,00 € |
| Matériel | Disjoncteur 16A | 1 | unité | 9,17 € | 9,17 € | 5,50 € |
| Pose & main-d’œuvre | Pose unité(s) extérieure(s) et support | 2 | h | 45,00 € | 90,00 € | 0,00 € |
| Pose & main-d’œuvre | Pose unité(s) intérieure(s) | 1.5 | h | 45,00 € | 67,50 € | 0,00 € |
| Pose & main-d’œuvre | Liaisons frigorifiques, câble, passage de mur | 1.5 | h | 45,00 € | 67,50 € | 0,00 € |
| Pose & main-d’œuvre | Raccordement électrique | 1 | h | 45,00 € | 45,00 € | 0,00 € |
| Pose & main-d’œuvre | Nettoyage et explications au client | 0.5 | h | 45,00 € | 22,50 € | 0,00 € |
| Mise en service & déplacement | Mise en service | 1 | forfait | 150,00 € | 150,00 € | 0,00 € |
| Mise en service & déplacement | Brasure | 1 | forfait | 30,00 € | 30,00 € | 0,00 € |
| Frais & divers | Consommables (forfait petit) | 1 | forfait | 45,00 € | 45,00 € | 27,00 € |
| Pose & main-d’œuvre | Préparation du chantier | 0.5 | h | 45,00 € | 22,50 € | 0,00 € |
| Pose & main-d’œuvre | Achat et enlèvement du matériel | 1 | h | 45,00 € | 45,00 € | 0,00 € |
| Pose & main-d’œuvre | Provision SAV / garantie (5 %) | 0.4 | h | 45,00 € | 18,00 € | 0,00 € |
| Mise en service & déplacement | Déplacement | 1 | forfait | 35,00 € | 35,00 € | 0,00 € |
| Frais & divers | Frais administratifs devis | 1 | forfait | 20,00 € | 20,00 € | 20,00 € |
| Frais & divers | Frais commande matériel | 1 | forfait | 20,00 € | 20,00 € | 20,00 € |
| Frais & divers | Marge sécurité (5%) | 1 | forfait | 113,89 € | 113,89 € | 0,00 € |

- **Total HT** : 2391,78 € (somme des lignes)
- **TVA** : 0,00 € (0 %, franchise : 0)
- **Total TTC** : 2391,78 €
- **Acompte** : 0,00 €
- **Solde** : 2391,78 € (TTC − acompte)
- Coût réel : 1621,44 € = achats 1327,44 € + main-d'œuvre interne 294,00 € ; bénéfice 770,34 € ; cotisations 566,37 € ; bénéfice net 203,97 €
- Avertissements de l'appli : Aucun contrôle compté (tirage au vide, test azote ou étanchéité)

## DÉPANNAGE simple (à vérifier à la main) : 1 pièce 120 € achat, 1,5 h, recharge 0,6 kg R32

Cas `d-depannage-simple` — taux horaire 90 €/h, 2.5 h, cotisations 23.68 %, franchise de TVA

| Groupe | Ligne | Qté | Unité | PU HT | Total HT | Achat |
|---|---|---:|---|---:|---:|---:|
| Matériel | Condensateur | 1 | u | 200,00 € | 200,00 € | 120,00 € |
| Matériel | Fluide R32 (au kg) — recharge | 0.6 | kg | 65,22 € | 39,13 € | 18,00 € |
| Pose & main-d’œuvre | Réparation | 1.5 | h | 90,00 € | 135,00 € | 0,00 € |
| Pose & main-d’œuvre | Mise en charge et réglages (0,6 kg) | 0.5 | h | 90,00 € | 45,00 € | 0,00 € |
| Frais & divers | Consommables | 1 | forfait | 25,00 € | 25,00 € | 15,00 € |
| Pose & main-d’œuvre | Achat et enlèvement du matériel | 0.5 | h | 90,00 € | 45,00 € | 0,00 € |
| Mise en service & déplacement | Déplacement | 1 | forfait | 35,00 € | 35,00 € | 0,00 € |
| Frais & divers | Frais administratifs devis | 1 | forfait | 20,00 € | 20,00 € | 20,00 € |
| Frais & divers | Frais commande matériel | 1 | forfait | 20,00 € | 20,00 € | 20,00 € |
| Frais & divers | Marge sécurité (5%) | 1 | forfait | 28,21 € | 28,21 € | 0,00 € |

- **Total HT** : 592,34 € (somme des lignes)
- **TVA** : 0,00 € (0 %, franchise : 0)
- **Total TTC** : 592,34 €
- **Acompte** : 0,00 €
- **Solde** : 592,34 € (TTC − acompte)
- Coût réel : 319,10 € = achats 231,60 € + main-d'œuvre interne 87,50 € ; bénéfice 273,24 € ; cotisations 140,27 € ; bénéfice net 132,97 €
- Avertissements de l'appli : Manipulation de fluide : fiche d'intervention (Cerfa 15497) à remplir le jour de l'intervention | Circuit ouvert : essai d'étanchéité à l'azote et tirage au vide non comptés — coche-les si tu les fais, sinon ils ne sont pas facturés | 1 article(s) au prix « à vérifier » : remplace-les par tes prix pro dans la base de prix
