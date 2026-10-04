---
name: deleguer-aux-agents
description: Règle de travail demandée par Gabriel pour ClimPilot — confier les tâches simples à des sous-agents moins coûteux (bon agent, bon modèle) et garder dans la session principale les décisions, la sécurité, les commits et la revue. À appliquer à chaque tâche de plusieurs étapes sur ce dépôt (recherche dans le code, modifications répétitives, mise à jour de docs, vérifications), avant de commencer le travail.
---

# Déléguer aux agents (économiser les jetons)

Gabriel l'a demandé explicitement (04/10/2026) : **quand une tâche est assez simple, la confier à un sous-agent
adapté**, plutôt que de tout faire dans la session principale. Cette consigne vaut autorisation permanente de lancer
des sous-agents sur ce dépôt.

## Quand déléguer
Déléguer si **toutes** ces conditions sont vraies :
- la tâche est **bien délimitée** : on peut écrire le résultat attendu et la façon de le vérifier ;
- elle demande **plus de 3 appels d'outils** (en dessous, la consigne coûte plus cher que la tâche) ;
- elle ne demande **ni décision ni jugement métier** (droit, fiscalité, sécurité, choix produit).

Ne **jamais** déléguer :
- les décisions à prendre avec Gabriel, la conception, l'arbitrage entre deux solutions ;
- la sécurité (secrets, contrôle d'accès, RLS), le droit et la fiscalité (mentions, TVA, délais) ;
- la résolution de conflits git, les commits, les push, toute action sur GitHub, Supabase ou en production ;
- la revue finale d'un changement.

## Quel agent, quel modèle

| Tâche | Agent | Modèle |
|---|---|---|
| Trouver où est quelque chose, lister des usages, lire et résumer des fichiers | `climpilot-chercheur` (sinon `Explore`) | `haiku` |
| Recherche large dans tout le dépôt, plusieurs pistes | `Explore` (2 ou 3 en parallèle, une piste chacun) | `haiku` |
| Modification mécanique décrite précisément : même motif sur plusieurs fichiers, renommage, texte de doc fourni, ajout d'un test sur un modèle existant | `climpilot-executant` (sinon `general-purpose`) | `sonnet` |
| Proposer un plan d'implémentation non trivial | `Plan` | modèle par défaut |
| Faire tourner la batterie de tests | **pas d'agent** : `tests/run-all.sh` en arrière-plan, puis lire seulement `rapport.md` | — |

Si les agents du dépôt (`.claude/agents/`) ne sont pas encore chargés dans la session, utiliser les types intégrés
(`Explore`, `general-purpose`) avec le paramètre `model` (`haiku` ou `sonnet`).

## Comment écrire la consigne
- **Autonome** : l'agent ne voit pas la conversation. Donner le dépôt, les fichiers et numéros de ligne, le contexte utile, le résultat attendu.
- **Bornée** : dire ce qu'il ne doit pas faire (pas de git, pas d'autre fichier, pas de réseau).
- **Vérifiable** : donner la commande de vérification (`node --check`, `grep`, un test précis).
- **Compacte** : demander une réponse courte (liste `fichier:ligne`, extraits de 2 lignes maximum).
- **Données personnelles** : exiger de masquer adresses, e-mails, téléphones, identifiants (UUID), clés et IBAN par `<adresse>`, `<email>`… Le dépôt est **public**.

## Après l'agent
- **Relire** son résultat avant de l'utiliser. Un agent peut se tromper ou ignorer une consigne : le 04/10, un agent `haiku` a recopié une adresse malgré la consigne de masquage.
- Vérifier soi-même les fichiers modifiés (`git diff`), relancer la vérification, puis commiter depuis la session principale.
- Lancer **en parallèle** les tâches indépendantes, en un seul message, et ne jamais confier les mêmes fichiers à deux agents ou à un agent et à soi.
- Lancer en arrière-plan ce qui est long, et continuer pendant ce temps ce qui ne dépend pas du résultat.
