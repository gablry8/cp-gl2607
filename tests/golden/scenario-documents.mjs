// Scénario commun des golden masters DOCUMENTS (T2 : HTML des PDF) et XML (T3 : factures électroniques CII), P0 21/10/2026.
// Repris de tests/genxml.mjs (mêmes documents), exécuté sur une page à horloge figée et stockage vide, données du jeu SEED de lib.mjs.
// Ids aléatoires (uid) neutralisés par normalisation ; dates et numéros déterministes grâce à l'horloge figée.
export const SCENARIO = `(function(){
  Object.assign(P.entreprise,{nom:'Gabriel Leroy — Froid & Climatisation',siret:'12345678900012',adresse:"1 rue de l'Exemple",cp:'60000',ville:'Beauvais',email:'contact@exemple.fr',tel:'0600000000',iban:'FR7630006000011234567890189',bic:'AGRIFRPP',mediateur:'Médiateur de test, 1 rue de la Paix 75001 Paris'});
  window.askMode=()=>'Virement';
  const html=()=>{ const e=document.getElementById('nx-pdf-page'); return e?e.innerHTML:''; };
  const close=()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); };
  const docs={};
  const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0);
  /* devis v2 imprimé */
  openDevis(acc[0].id); printDevis(); docs['devis-v2']=html(); close(); go('dash');
  /* acompte + solde */
  const d1=acc[0]; d1.acompteOn=true; d1.acomptePct=30; facturerDevis(d1.id,'acompte'); docs['facture-acompte']=html(); close(); facturerDevis(d1.id,'solde'); docs['facture-solde-apres-acompte']=html(); close();
  const d2=acc[1]; d2.cSiren='552100554'; facturerDevis(d2.id,'solde'); docs['facture-solde-pro']=html(); close();
  /* dépannage particulier (contrat signé avant travaux, hors établissement) */
  const j10=dISO(new Date(Date.now()-10*86400000));
  const x={id:'depX',cNom:'M. "Jojo" Martin',cAdr:'10 Rue de Grenelle',cVille:'75007 Paris',cType:'Particulier',date:dISO(new Date()),itype:'dep',statut:'brouillon',heures:2,pieces:[],rateChoice:'custom',rateCustom:60,
    conclusion:{mode:'hors_etablissement',date:j10,preuve:{type:'papier',ref:'jeu de test'}},contratAvant:{date:j10,preuve:'papier'}};
  DEP.push(x); curDep=x; try{ loadDepForm(); }catch(e){} factureDep(); docs['facture-depannage']=html(); close();
  /* avoirs : total (libère la facture) et partiel */
  const av1=nxCreateAvoir({facNum:d2.facSolde.num,montant:d2.facSolde.montant,motif:'Erreur sur le montant facturé',liberer:false});
  const av2=nxCreateAvoir({facNum:DEP.find(o=>o.id==='depX').facNum,montant:40,motif:'Geste commercial & <test>'});
  try{ nxPrintAvoir(av1.av.id); docs['avoir-total']=html(); close(); }catch(e){ docs['avoir-total']='ERREUR '+e; }
  try{ nxPrintAvoir(av2.av.id); docs['avoir-partiel']=html(); close(); }catch(e){ docs['avoir-partiel']='ERREUR '+e; }
  const nums={ 'acompte-386':d1.facAcompte.num, 'solde-380-apres-acompte':d1.facSolde.num, 'solde-380-pro':d2.facSolde.num, 'depannage-380-particulier':DEP.find(o=>o.id==='depX').facNum, 'avoir-381-total':av1.av.num, 'avoir-381-partiel':av2.av.num };
  const xml={}; Object.keys(nums).forEach(k=>{ try{ xml[k]={num:nums[k],xml:nxEinvXML(nums[k]),chk:nxEinvChecks(nums[k])}; }catch(e){ xml[k]={num:nums[k],erreur:String(e)}; } });
  /* régime assujetti TVA 20 % (bascule 2027) */
  P.regimeTVA='assujetti'; P.tva=20; Object.assign(P.entreprise,{tvaIntra:'FR32123456789'});
  const d3=acc[2]; facturerDevis(d3.id,'solde'); docs['facture-solde-assujetti']=html(); close();
  xml['solde-380-assujetti']={num:d3.facSolde.num,xml:nxEinvXML(d3.facSolde.num),chk:nxEinvChecks(d3.facSolde.num)};
  const av3=nxCreateAvoir({facNum:d3.facSolde.num,montant:50,motif:'Remise'}); xml['avoir-381-assujetti']={num:av3.av.num,xml:nxEinvXML(av3.av.num),chk:[]};
  return {docs,xml};
})()`;

/* normalisation : identifiants aléatoires (uid 6 caractères A-Z0-9, UUID), espaces ; les dates et numéros sont déjà fixes */
export function normaliserHTML(h) {
  return String(h)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\b(DV-\d{8}-[A-Z0-9]+-)[A-Z0-9]{6}\b/g, '$1<ID>')
    .replace(/(data-id|data-k|data-devis|id)="[^"]*"/g, '$1="<ID>"')
    .replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}
export function normaliserXML(x) {
  return String(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>').replace(/\b(DV-\d{8}-[A-Z0-9]+-)[A-Z0-9]{6}\b/g, '$1<ID>').replace(/\r/g, '').trim();
}
