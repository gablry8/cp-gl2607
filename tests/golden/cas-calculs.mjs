// Golden master des calculs (P0, T1 du REFONTE-PLAN, 21/10/2026) — définition des devis de référence.
// Partagé par tests/golden/generer.mjs (écrit tests/golden/calculs.json depuis le code ACTUEL) et tests/suiteZ-golden.mjs (compare).
// Principe : un golden master ne juge pas, il fige. Les montants sont ceux que l'appli calcule aujourd'hui, bons ou mauvais ;
// toute différence future doit être vue, expliquée, puis acceptée (régénération) ou corrigée.
// Tout ce qui est aléatoire ou daté est figé : id des devis et des lots, created, numéro, horloge (2026-10-20 10:00 Paris).

export const HORLOGE = '2026-10-20T10:00:00+02:00';
export const CREATED = Date.parse(HORLOGE);

/* Chaque cas = { id, titre, verifiable (3 cas « à la main » pour Gabriel), construire: code exécuté DANS la page, qui renvoie le devis } */
const C = [];
const cas = (id, titre, construire, extra = {}) => C.push({ id, titre, construire: String(construire), ...extra });

/* ---------- a. une nature, lot par défaut puis exemple rempli (12 natures × 2) ---------- */
const PATCH = {
  split: { type: 'Bisplit', machines: [{ marque: 'M', ref: 'R1', achat: 1180, marge: 35, breaker: '', maxCurrent: 9 }],
    splits: [{ piece: 'Séjour', surface: 25, typeUI: 'Mural', puiss: 2.5, liaison: 'Liaison 1/4 - 3/8', long: 6, cableInter: 'Câble 5G1,5' }, { piece: 'Chambre', surface: 12, typeUI: 'Mural', puiss: 2.5, liaison: 'Liaison 1/4 - 3/8', long: 4, cableInter: 'Câble 5G1,5' }],
    groupLong: 8, goulottes: [{ type: 'Goulotte 80x60', long: 5 }], condLong: 6, support: 'Support sol', mes: 'Bisplit', tests: 'vide' },
  gainable: { machines: [{ marque: 'M', ref: 'G1', achat: 2400, marge: 30, maxCurrent: 12, kw: 7.1, debit: 1200, pression: 50 }], long: 8, groupLong: 10, condLong: 6, tests: 'vide+azote' },
  depannage: { pieces: [{ nom: 'Carte hors base', qte: 1, achat: 180, delai: '48 h' }], mo: [{ l: 'Réparation', h: 2 }], fl: { nom: 'Fluide R32 (au kg)', recup: 0.8, charge: 0.8, recherche: 1, vide: true, azote: true, deshy: true }, maj: 'soir' },
  entretien: { format: 'visite', equips: [{ eqId: '', type: 'clim', marque: 'M', modele: 'X', fluide: 'R32', charge: 1.2, prp: 675, lds: false, herm: false, temps: '' }, { eqId: '', type: 'frc', marque: 'V', modele: 'Y', fluide: 'R449A', charge: 3, prp: 1397, lds: true, herm: false, temps: '' }], degr: 10, consoVisite: 25, usure: { incluses: true, budget: 60 } },
  chambre: { L: 3, l: 2.5, h: 2.2, machines: [{ marque: 'M', ref: 'G1', achat: 1400, marge: 30, maxCurrent: 8, pw: 1800 }], groupLong: 6, tests: '0' },
  pac: { modele: 'monobloc', chaudiere: 'depose', desemb: true, machines: [{ marque: 'M', ref: 'P8', achat: 5200, marge: 30, breaker: '', maxCurrent: 20, kw: 8 }] },
  ballon: { machines: [{ marque: 'M', ref: 'B200', achat: 900, marge: 35, breaker: '', maxCurrent: 10, litres: 200 }], occ: 4 },
  froidcom: { machines: [{ marque: 'V', ref: 'Vitrine 2m', achat: 2200, marge: 30, breaker: '', maxCurrent: 6 }], manut: 1 },
  adia: { machines: [{ marque: 'A', ref: 'Ad1', achat: 3500, marge: 30, breaker: '', maxCurrent: 0 }], heures: 6 },
  mes: { raccords: 2, azote: true, hsup: 1 },
  depose: { equips: [{ type: 'split', marque: 'M', modele: '', fluide: 'R410A', charge: 1.1 }], deee: { on: true, prix: 20 }, bsff: { on: true, prix: 30 } },
  st: { lignes: [{ l: 'Pose', h: 8 }, { l: 'Mise en service', h: 2.5 }], taux: 42 },
};
const NATURES = Object.keys(PATCH);
for (const n of NATURES) {
  cas('a-' + n + '-defaut', 'Nature ' + n + ' : lot par défaut (tel que « Nouveau devis »)', `function(){ const n=${JSON.stringify(n)}; const d=NXD2.newDevis(n,{}); d.lots=[NXD2.newLot(n)]; return d; }`);
  cas('a-' + n + '-rempli', 'Nature ' + n + ' : lot rempli (exemple réaliste)', `function(){ const n=${JSON.stringify(n)}, patch=${JSON.stringify(PATCH[n])}; const d=NXD2.newDevis(n,{}); const l=NXD2.newLot(n, n==='split'?{type:'Bisplit'}:{}); Object.assign(l.data, patch); d.lots=[l]; return d; }`);
}

/* ---------- b. variantes sur un bisplit (les champs qui font bouger le total) ---------- */
const BI = `const d=NXD2.newDevis('split',{}); const l=NXD2.newLot('split',{type:'Bisplit'}); Object.assign(l.data, ${JSON.stringify(PATCH.split)}); d.lots=[l];`;
cas('b-acompte-30', 'Bisplit avec acompte 30 % (défaut)', `function(){ ${BI} d.acompteOn=true; d.acomptePct=30; return d; }`, { verifiable: 'acompte' });
cas('b-acompte-12-5', 'Bisplit avec acompte 12,5 % (pourcentage à virgule)', `function(){ ${BI} d.acompteOn=true; d.acomptePct=12.5; return d; }`);
cas('b-tva-10', 'Bisplit, lot à TVA 10 % (sans effet en franchise)', `function(){ ${BI} d.lots[0].tva='10'; return d; }`);
cas('b-tva-5-5', 'Bisplit, lot à TVA 5,5 %', `function(){ ${BI} d.lots[0].tva='5.5'; return d; }`);
cas('b-tva-mixte', 'Bisplit, lot à TVA mixte (matériel 20 %, reste 10 %)', `function(){ ${BI} d.lots[0].tva='mixte'; return d; }`);
cas('b-lot-option', 'Bisplit + lot dépannage EN OPTION (hors total, chiffré à part)', `function(){ ${BI} const o=NXD2.newLot('depannage'); Object.assign(o.data, ${JSON.stringify(PATCH.depannage)}); o.option=true; d.lots.push(o); return d; }`);
cas('b-deux-lots', 'Bisplit + lot entretien (visite) : frais communs répartis au prorata', `function(){ ${BI} const e=NXD2.newLot('entretien'); Object.assign(e.data, ${JSON.stringify(PATCH.entretien)}); d.lots.push(e); return d; }`);
cas('b-marge-0', 'Bisplit, machine à marge 0 % (prix de vente = achat)', `function(){ ${BI} d.lots[0].data.machines[0].marge=0; return d; }`);
cas('b-marge-100', 'Bisplit, machine à marge 100 % (cas limite : vente = achat)', `function(){ ${BI} d.lots[0].data.machines[0].marge=100; return d; }`);
cas('b-achat-virgule', 'Bisplit, prix d\'achat à virgule 1234,56 € et liaison 4,33 m', `function(){ ${BI} d.lots[0].data.machines[0].achat=1234.56; d.lots[0].data.splits[1].long=4.33; return d; }`);
cas('b-sans-arrondi', 'Bisplit sans arrondi interne (rnd=0, comme un devis déjà envoyé)', `function(){ ${BI} d.rnd=0; d.statut='envoye'; return d; }`);
cas('b-zone-plus-60', 'Bisplit, zone +60 km avec 85 km et 2 déplacements', `function(){ ${BI} d.zone='+60 km'; d.km=85; d.nbDepl=2; return d; }`);
cas('b-taux-custom', 'Bisplit, taux horaire personnalisé 52,5 €/h', `function(){ ${BI} d.rateChoice='custom'; d.rateCustom=52.5; return d; }`);
cas('b-mo-forfait', 'Bisplit, main-d\'œuvre au forfait', `function(){ ${BI} d.lots[0].data.moMode='forfait'; return d; }`);
cas('b-mo-heures', 'Bisplit, main-d\'œuvre en heures (7,25 h)', `function(){ ${BI} d.lots[0].data.moMode='heures'; d.lots[0].data.heures=7.25; return d; }`);
cas('b-common-sav', 'Bisplit, préparation 1 h, achat 1,5 h, SAV 8 %', `function(){ ${BI} d.common={prepH:1,achatH:1.5,savPct:8}; return d; }`);
cas('b-elec-manuel', 'Bisplit, électricité manuelle : 2 disjoncteurs 20A + différentiel', `function(){ ${BI} Object.assign(d.lots[0].data,{elecMode:'manual',breakerManual:'Disjoncteur 20A',breakerQte:2,differential:true,diffQte:1,proximity:true}); return d; }`);
cas('b-extras', 'Bisplit + 2 articles de la base en extras (dont un inconnu → 0 € + avertissement)', `function(){ ${BI} d.lots[0].data.extras=[{nom:'Goulotte 80x60',qte:3},{nom:'Article inexistant XYZ',qte:2}]; return d; }`);
/* ---------- c. régime assujetti à la TVA (bascule 2027 : la TVA s'applique) ---------- */
cas('c-assujetti-20', 'ASSUJETTI : bisplit, TVA 20 % appliquée', `function(){ ${BI} return d; }`, { assujetti: true });
cas('c-assujetti-mixte-acompte', 'ASSUJETTI : bisplit TVA mixte + acompte 30 %', `function(){ ${BI} d.lots[0].data; d.lots[0].tva='mixte'; d.acompteOn=true; d.acomptePct=30; return d; }`, { assujetti: true });
cas('c-assujetti-5-5', 'ASSUJETTI : bisplit TVA 5,5 %', `function(){ ${BI} d.lots[0].tva='5.5'; return d; }`, { assujetti: true });
/* ---------- d. dépannage et mono-split « à vérifier à la main » ---------- */
cas('d-mono-simple', 'MONO-SPLIT simple (à vérifier à la main) : 1 machine 980 € achat marge 35 %, liaison 5 m, support mural', `function(){ const d=NXD2.newDevis('split',{}); const l=NXD2.newLot('split'); Object.assign(l.data,{machines:[{marque:'Daikin',ref:'FTXM25',achat:980,marge:35,breaker:'',maxCurrent:7}],splits:[{piece:'Séjour',surface:20,typeUI:'Mural',puiss:2.5,liaison:'Liaison 1/4 - 3/8',long:5,cableInter:'Câble 5G1,5'}],groupLong:6,condLong:4,support:'Support mural',mes:'Monosplit'}); d.lots=[l]; return d; }`, { verifiable: 'mono' });
cas('d-depannage-simple', 'DÉPANNAGE simple (à vérifier à la main) : 1 pièce 120 € achat, 1,5 h, recharge 0,6 kg R32', `function(){ const d=NXD2.newDevis('depannage',{}); const l=NXD2.newLot('depannage'); Object.assign(l.data,{pieces:[{nom:'Condensateur',qte:1,achat:120,delai:''}],mo:[{l:'Réparation',h:1.5}],fl:{nom:'Fluide R32 (au kg)',recup:0,charge:0.6,recherche:0,vide:false,azote:false,deshy:false},maj:'0'}); d.lots=[l]; return d; }`, { verifiable: 'depannage' });
/* ---------- e. ancien format (sans v:2) : moteur compute d'origine via les enveloppes ---------- */
cas('e-legacy-mono', 'ANCIEN FORMAT mono : 1 machine 1234,56 € marge 35, liaison 7,5 m, 6,5 h', `function(){ return {id:'old1',num:'DV-20260915-OLD-000001',cNom:'Client A',cType:'Professionnel',type:'Monosplit',statut:'accepte',date:'2026-09-15',machines:[{marque:'D',ref:'X',achat:1234.56,marge:35}],splits:[{long:7.5,liaison:'Liaison 1/4 - 3/8',puiss:2.5,cableInter:'Câble 5G1,5'}],groupCable:'Câble 3G2,5',groupLong:12.3,heures:6.5,moMode:'heures',tvaRate:10,rateChoice:'45',mes:'Monosplit',support:'Support mural',brasure:'Brasure simple',zone:'0-10 km'}; }`);
cas('e-legacy-multi-acompte', 'ANCIEN FORMAT bisplit, acompte 30 %, TVA 20', `function(){ return {id:'old2',num:'DV-20260920-OLD-000002',cNom:'Client B',cType:'Particulier',type:'Bisplit',statut:'envoye',date:'2026-09-20',machines:[{marque:'M',ref:'MXZ',achat:2100.99,marge:28},{marque:'M',ref:'MSZ',achat:410.1,marge:28}],splits:[{long:4,liaison:'Liaison 1/4 - 1/2',puiss:4.2,cableInter:'Câble 5G1,5'},{long:11.25,liaison:'Liaison 1/4 - 3/8',puiss:2,cableInter:'Câble 5G1,5'}],heures:11,moMode:'heures',tvaRate:20,rateChoice:'45',support:'Support sol',zone:'10-20 km',acompteOn:true,acomptePct:30}; }`);
cas('e-legacy-forfait', 'ANCIEN FORMAT mono au forfait, taux personnalisé 50', `function(){ return {id:'old3',num:'DV-20260901-OLD-000003',cNom:'Client C',type:'Monosplit',statut:'accepte',date:'2026-09-01',machines:[{marque:'D',ref:'Y',achat:800,marge:35}],splits:[{long:3,liaison:'Liaison 1/4 - 3/8',puiss:2,cableInter:'Câble 5G1,5'}],moMode:'forfait',rateChoice:'custom',rateCustom:50,mes:'Monosplit',tests:'vide'}; }`);
cas('e-legacy-mixte', 'ANCIEN FORMAT, TVA mixte (enveloppe next-regime)', `function(){ return {id:'old4',num:'DV-20260905-OLD-000004',cNom:'Client D',type:'Monosplit',statut:'accepte',date:'2026-09-05',machines:[{marque:'D',ref:'Z',achat:1500,marge:35}],splits:[{long:5,liaison:'Liaison 1/4 - 3/8',puiss:2.5,cableInter:'Câble 5G1,5'}],heures:5,moMode:'heures',tvaMode:'mixte',rateChoice:'45',mes:'Monosplit',elecMode:'auto'}; }`);
cas('e-legacy-assujetti', 'ANCIEN FORMAT, régime ASSUJETTI, TVA 10 du devis', `function(){ return {id:'old5',num:'DV-20260910-OLD-000005',cNom:'Client E',type:'Monosplit',statut:'accepte',date:'2026-09-10',machines:[{marque:'D',ref:'W',achat:999.99,marge:35}],splits:[{long:5,liaison:'Liaison 1/4 - 3/8',puiss:2.5,cableInter:'Câble 5G1,5'}],heures:4,moMode:'heures',tvaRate:10,rateChoice:'45',mes:'Monosplit',acompteOn:true,acomptePct:40}; }`, { assujetti: true });

export const CAS = C;

/* ---------- relevé d'un devis dans la page : ce qui est figé ---------- */
export const RELEVER = `function(d, cas){
  const fix=(d)=>{ if(d.v===2){ d.id='golden-'+cas.id; d.created=${CREATED}; d.num='DV-20261020-GOLDEN-'+cas.id; (d.lots||[]).forEach((l,i)=>{ l.id='lot-'+cas.id+'-'+i; }); if(typeof NXD2.derive==='function') NXD2.derive(d); } return d; };
  fix(d);
  const c=compute(JSON.parse(JSON.stringify(d)));
  const r6=(x)=>(typeof x==='number'&&isFinite(x))?Math.round(x*1e6)/1e6:x;
  const ligne=(l)=>({group:l.group,label:l.label,ht:r6(l.ht),achat:r6(l.achat),qte:r6(l.qte),unite:l.unite,pu:r6(l.pu),lot:l.lot==null?undefined:l.lot});
  const out={ totalHT:r6(c.totalHT), tva:r6(c.tva), tvaRate:r6(c.tvaRate), totalTTC:r6(c.totalTTC), acompte:r6(c.acompte), solde:r6(c.solde), billTTC:r6(c.billTTC),
    coutReel:r6(c.coutReel), matAchat:r6(c.matAchat), moAchat:r6(c.moAchat), benefice:r6(c.benefice), margePct:r6(c.margePct), cotis:r6(c.cotis), benefNet:r6(c.benefNet), heures:r6(c.heures), rate:r6(c.rate), franchise:!!c.franchise,
    tvaBreak:(c.tvaBreak||[]).map(b=>({rate:r6(b.rate),base:r6(b.base),tva:r6(b.tva)})), lines:(c.lines||[]).map(ligne),
    lots:(c.lots||[]).map(l=>({module:l.module,ht:r6(l.ht),tva:r6(l.tva),heures:r6(l.heures),commonShare:r6(l.commonShare)})),
    options:(c.options||[]).map(o=>({module:o.module,ht:r6(o.ht),tva:r6(o.tva),ttc:r6(o.ttc)})), warnings:(c.warnings||[]).map(String), cotisPct:r6(window.nxCotisPct?nxCotisPct():null) };
  return out;
}`;
