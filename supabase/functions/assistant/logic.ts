// ClimPilot — logique pure de l'assistant (testable hors Deno)
// COPIE DE LECTURE de la version déployée (assistant v4) — la version déployée fait foi.

export const MODEL = 'claude-sonnet-5';
// Tarifs Claude Sonnet 5 (USD / million de tokens) — platform.claude.com/docs/en/about-claude/pricing (vérifié 28/09/2026)
export const PRICE = { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 };
// Plafond interne : on compte 1 $ = 1 € (surestime le coût en euros → marge de sécurité)
export const BUDGET_EUR = 4.5;
export const MAX_PER_DAY = 80;

export const AUTO_KINDS = ['note', 'tache', 'machine', 'client', 'article'];
export const ALL_KINDS = ['note', 'tache', 'rdv', 'devis', 'intervention', 'message', 'machine', 'client', 'article', 'autre'];

export function costEur(u: any): number {
  u = u || {};
  const c = ((u.input_tokens || 0) * PRICE.in + (u.output_tokens || 0) * PRICE.out +
    (u.cache_read_input_tokens || 0) * PRICE.cacheRead + (u.cache_creation_input_tokens || 0) * PRICE.cacheWrite) / 1e6;
  return Math.round(c * 1e5) / 1e5;
}

export function trimMessages(msgs: any): any[] {
  if (!Array.isArray(msgs)) return [];
  const out = msgs
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);
  while (out.length && out[0].role !== 'user') out.shift();
  // l'API exige l'alternance user/assistant : on fusionne les doublons consécutifs
  const merged: any[] = [];
  for (const m of out) {
    if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1].content += '\n' + m.content;
    else merged.push(m);
  }
  return merged;
}

export function summarizeState(data: any): any {
  data = data || {};
  const arr = (k: string) => (Array.isArray(data[k]) ? data[k] : []);
  const d = (t: any) => { try { return t ? new Date(t).toISOString().slice(0, 10) : ''; } catch (_) { return ''; } };
  return {
    devis: arr('cp2_devis').slice(-40).map((x: any) => ({ num: x.num, client: x.cNom, ville: x.cVille, type: x.type, statut: x.statut, cree: d(x.created), envoye: d(x.sentAt), planifie: x.datePlanif || '' })),
    interventions: arr('cp2_dep').slice(-25).map((x: any) => ({ date: x.date, client: x.cNom, type: x.itype, statut: x.statut, facture: x.facNum || '' })),
    locations: arr('cp2_loc').slice(-15).map((x: any) => ({ client: x.cNom, debut: x.dateDebut, fin: x.dateFin, statut: x.statut })),
    contrats: arr('cp2_contrats').slice(-20).map((x: any) => ({ client: x.cNom || x.client, type: x.type, prochaineVisite: x.prochaineVisite })),
    taches_ouvertes: arr('cpnext_tasks').filter((t: any) => !t.done).slice(-30).map((t: any) => ({ titre: t.title, echeance: t.due, priorite: t.priority })),
  };
}

export function buildSystem(catalog: any, summary: any, now: any): string {
  const cat = catalog || {};
  const jour = now && now.jour ? now.jour : '';
  return `Tu es l'assistant de Gabriel Leroy, frigoriste-climaticien (micro-entreprise « Gabriel Leroy », froid commercial, climatisation, PAC, chambres froides, adiabatique). Tu es intégré à son logiciel ClimPilot. Il te parle en dictée vocale depuis ses chantiers : le texte est souvent abîmé (mots mal transcrits, chiffres déformés, phrases en vrac). Tu joues selon le besoin le collègue du bureau d'études, le dépanneur expérimenté, la comptable ou le manager — mais ici ton travail principal est de TRANSFORMER SA DEMANDE EN ACTIONS ClimPilot.

Nous sommes ${jour} (heure de Paris : ${now && now.heure ? now.heure : '?'}, date ISO ${now && now.date ? now.date : '?'}).

## Règles absolues
1. Tu ne fixes JAMAIS un prix de vente. ClimPilot chiffre lui-même. Un prix d'achat n'est renseigné que si Gabriel l'a dit.
2. Pour les devis et interventions, tu n'utilises QUE les valeurs du CATALOGUE ci-dessous (types, zones, liaisons, goulottes, supports, pompes, articles, pannes). Sinon → notes ou a_verifier.
3. Rien ne part chez un client sans validation : devis, interventions, messages et rendez-vous sont des PROPOSITIONS. Notes, tâches, machines, clients et articles s'enregistrent directement.
4. Toute interprétation incertaine va dans a_verifier en disant ce que tu as compris (ex : « "3,05 kg" compris comme 2,5 + 3,5 kW — à confirmer »).
5. Hypothèse ≠ certitude. N'invente ni client, ni date, ni engagement.

## Quand poser une question (outil poser_question)
- S'il manque l'ESSENTIEL et que tu ne peux pas le déduire : pour qui (client) d'un devis/intervention/message, quoi (type de chantier), ou le contenu d'un message client.
- Une seule fois, questions courtes regroupées (2 max). Propose ton interprétation : « Je comprends un bi-split 2,5 + 3,5 kW, c'est bien ça ? Et c'est pour quel client ? »
- Les détails (longueurs, modèle exact, prix d'achat, heures) ne justifient PAS une question : dépose avec a_verifier.
- Si Gabriel a déjà répondu à une question, ne la repose pas : dépose.

## Décoder la dictée
« groupe 290 » → R290 (propane, A3). R32, R410A, R134a, R449A, R744. « bis pli / bi pli / by split » → Bisplit. « 3,05 kg / 3,5 kilos » dans un devis clim → presque toujours des kW (splits disponibles : ${JSON.stringify(cat.splitPowers || [2.5, 3.5, 5, 7])}). « maison Phoenix » → maison Phénix (ossature légère). « de CLG / c'est du LG » → LG. Nombres isolés incompréhensibles → interprétation la plus probable + a_verifier. Plusieurs demandes dans un message → plusieurs éléments.
Dates relatives : calcule-les à partir d'aujourd'hui (demain, jeudi prochain…). « Matin » sans heure → 09:00, « après-midi » → 14:00.

## Types d'éléments (outil deposer)
- note / tache : {texte, echeance "AAAA-MM-JJ" ou "", heure "HH:MM" ou "", priorite high|medium|low, categorie Administratif|Client|Fournisseur|Chantier|Stock|Entretien|Autre}
- rdv : {date, heure, duree_min, lieu, description} — Gabriel l'ajoutera à son Google Agenda d'un clic.
- devis : {type, client:{nom,tel,mail,type Particulier|Professionnel,adr,ville}, machines:[{marque,ref,achat}], splits:[{puiss,long}], goulottes:[{type,long}], condLong, groupLong, support, pompe, pompeQte, zone, acces 0|moyen|diff, tests 0|vide|azote|etanch, heures, extras:[{nom,qte}], notes} — n'envoie que les champs dont tu es raisonnablement sûr.
- intervention : {itype dep|mes, date, client:{...}, desc (compte rendu propre rédigé pour le client), panne (valeur de depPannes ou absent), heures, zone, pieces:[{nom,qte,achat}], fluide:{nom,charge,recupere}, notes}. Fluide chargé/récupéré → a_verifier « fiche fluide (Cerfa 15497) à remplir ».
- message : {canal mail|sms, destinataire, email, tel, objet, corps}. Vouvoiement, ton de chef d'entreprise artisan, professionnel mais humain et chaleureux, 3 à 6 lignes, signature « Gabriel Leroy ». Jamais d'engagement non dit (mets [à confirmer]).
- machine (bibliothèque de machines, pour les devis) : {marque, ref, achat (prix d'achat HT si dit, sinon 0), marge (en %, défaut 35), puissance_kw, notes}
- client : {nom, tel, mail, type, adr, ville, siren, notes}
- article (base de prix) : {nom, cat (catégorie existante de preference), unite (unité|m|forfait|paire|m²|kg), achat HT, marge en %}
Chaque élément : kind, titre court et clair, resume (ce que tu as compris, 1-2 phrases), a_verifier (liste, peut être vide), payload.
Reprends les coordonnées d'un client connu depuis le catalogue (nom exact).

Dans « reponse », confirme en 1 à 3 phrases courtes, tutoiement amical (c'est Gabriel), ce que tu as fait et ce qui reste à vérifier. Pas de blabla.

## Questions d'information (outil repondre)
Si Gabriel pose une question (« combien de devis envoyés en attente ? », « c'est quoi la liaison pour un 5 kW ? »), réponds brièvement avec le RÉSUMÉ DE SON ACTIVITÉ et tes connaissances métier. Tu n'as pas les montants : ne les invente pas, renvoie vers l'écran concerné de ClimPilot. Pour une analyse poussée (comptable, bilan frigorifique, diagnostic long), conseille l'agent complet dans l'app Claude.

## CATALOGUE ClimPilot (valeurs autorisées)
${JSON.stringify(cat)}

## RÉSUMÉ DE SON ACTIVITÉ
${JSON.stringify(summary || {})}`;
}

export const TOOLS = [
  {
    name: 'deposer',
    description: "Enregistre une ou plusieurs actions dans ClimPilot (notes, tâches, rendez-vous, devis, interventions, messages clients, machines, clients, articles).",
    input_schema: {
      type: 'object',
      properties: {
        reponse: { type: 'string', description: 'Confirmation courte pour Gabriel (1 à 3 phrases).' },
        elements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ALL_KINDS },
              titre: { type: 'string' },
              resume: { type: 'string' },
              a_verifier: { type: 'array', items: { type: 'string' } },
              payload: { type: 'object' },
            },
            required: ['kind', 'titre', 'payload'],
          },
        },
      },
      required: ['reponse', 'elements'],
    },
  },
  {
    name: 'poser_question',
    description: "Pose une question courte à Gabriel quand il manque une information ESSENTIELLE (client, type de chantier, contenu d'un message).",
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
  },
  {
    name: 'repondre',
    description: "Répond à une question d'information sans rien enregistrer.",
    input_schema: { type: 'object', properties: { texte: { type: 'string' } }, required: ['texte'] },
  },
];

// Transforme la sortie de l'outil « deposer » en lignes de la table climpilot_inbox
export function toRows(input: any, userId: string, dictee: string): any[] {
  const els = input && Array.isArray(input.elements) ? input.elements : [];
  return els.slice(0, 10).filter((e: any) => e && ALL_KINDS.includes(e.kind)).map((e: any) => {
    const payload = e.payload && typeof e.payload === 'object' ? { ...e.payload } : {};
    const av = Array.isArray(e.a_verifier) ? e.a_verifier.filter((x: any) => typeof x === 'string' && x.trim()).slice(0, 10) : [];
    if (av.length) payload.a_verifier = av;
    if (e.kind === 'rdv') payload.gcal = false;
    return {
      user_id: userId,
      kind: e.kind,
      statut: AUTO_KINDS.includes(e.kind) ? 'auto' : 'a_valider',
      titre: String(e.titre || '').slice(0, 200),
      resume: e.resume ? String(e.resume).slice(0, 1000) : null,
      dictee: dictee ? dictee.slice(0, 2000) : null,
      payload,
      source: 'micro',
    };
  });
}

export function monthStartParis(d?: Date): string {
  const now = d || new Date();
  const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(now); // AAAA-MM
  return p.slice(0, 7) + '-01T00:00:00+02:00';
}

// Lecture de plaque signalétique (photo) — sortie structurée, rien n'est inventé
export const PLAQUE_TOOL = {
  name: 'lire_plaque',
  description: "Renvoie les informations lues sur la plaque signalétique d'un équipement frigorifique ou de climatisation.",
  input_schema: {
    type: 'object',
    properties: {
      marque: { type: 'string' }, modele: { type: 'string', description: 'modèle / référence commerciale ou technique' },
      serie: { type: 'string', description: 'numéro de série' }, fluide: { type: 'string', description: 'ex : R32, R410A, R290' },
      charge: { type: 'number', description: 'charge en fluide en kg (convertir les grammes en kg)' },
      prg: { type: 'number', description: 'PRP / GWP indiqué sur la plaque' }, teq: { type: 'number', description: 'tonnes équivalent CO2 indiquées sur la plaque' },
      annee: { type: 'string' }, puissance: { type: 'string', description: 'puissances froid / chaud avec unités' },
      tension: { type: 'string' }, autres: { type: 'string', description: 'autres informations utiles (pressions de service, etc.)' },
      illisible: { type: 'array', items: { type: 'string' }, description: 'champs présents mais illisibles ou incertains' },
    },
  },
};
export const PLAQUE_SYSTEM = "Tu lis des plaques signalétiques d'équipements de froid et de climatisation pour un frigoriste. Recopie UNIQUEMENT ce qui est écrit sur la plaque. Si une valeur est absente, laisse le champ vide ; si elle est présente mais illisible ou incertaine, mets le nom du champ dans « illisible ». N'invente jamais un PRP ou un tonnage absent de la plaque. Charge : convertis en kg (ex : 850 g → 0.85).";

// Lecture de facture d'achat fournisseur (photo ou PDF) — sortie structurée, rien n'est inventé
export const FACTURE_TOOL = {
  name: 'lire_facture',
  description: "Renvoie les lignes d'une facture (ou d'un bon de livraison chiffré) d'un fournisseur de matériel frigorifique, de climatisation ou d'électricité.",
  input_schema: {
    type: 'object',
    properties: {
      fournisseur: { type: 'string', description: 'nom du fournisseur (émetteur de la facture)' },
      numero: { type: 'string' }, date: { type: 'string', description: 'date de la facture AAAA-MM-JJ' },
      lignes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'référence article du fournisseur' },
            designation: { type: 'string' },
            qte: { type: 'number' }, unite: { type: 'string' },
            pu_ht: { type: 'number', description: "prix unitaire NET HT après remise, tel qu'écrit ; sinon total_ht / qte" },
            remise_pct: { type: 'number' }, total_ht: { type: 'number' },
            nature: { type: 'string', enum: ['article', 'port', 'consigne', 'taxe', 'autre'], description: 'port = frais de port ou de livraison ; consigne = bouteille de fluide consignée ; taxe = éco-participation, DEEE…' },
            calcule: { type: 'boolean', description: "true si pu_ht a été calculé (total / quantité) au lieu d'être lu" },
          },
        },
      },
      total_ht: { type: 'number' },
      illisible: { type: 'array', items: { type: 'string' }, description: 'lignes ou champs présents mais illisibles ou incertains' },
    },
  },
};
export const FACTURE_SYSTEM = "Tu lis des factures d'achat de fournisseurs (matériel frigorifique, climatisation, électricité) pour un artisan frigoriste. Recopie UNIQUEMENT ce qui est écrit, ligne par ligne. Prix : prix unitaire NET HT après remise ; si seul le montant de la ligne est lisible, calcule total HT / quantité et mets calcule = true. N'invente jamais une référence, une quantité ou un prix : ce qui est illisible va dans « illisible ». Frais de port, consignes de bouteilles et éco-participations sont des lignes à part (nature).";
