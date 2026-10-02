// Matrice XML 1.10 : factures FIGÉES (démonstration) de chaque sorte + cas « payée le jour même »
// d'une facture ancienne (non figée) + version bac à sable. Écrit dans /tmp/claude-0/sp/xml2/.
import {page,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';
const OUT='/tmp/claude-0/sp/xml2/'; fs.mkdirSync(OUT,{recursive:true});
const {p,errs}=await page({mobile:false});
p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
await seed(p);
const R=await p.evaluate(async()=>{
  const res={}; const close=()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); };
  Object.assign(P.entreprise,{nom:'Gabriel Leroy',siret:'12345678900012',adresse:"12 rue de l'Hostellerie",cp:'60140',ville:'Bailleval',email:'contact@exemple.fr',rib:'FR76 3000 6000 0112 3456 7890 189'});
  window.askMode=()=>'Virement';
  const X=(k,n,ov)=>{ res[k]=nxEinvXML(n,ov); };
  const pro={nom:'Boulangerie Dupré',siren:'552100554'}; const cl=CLIENTS.find(c=>c.nom===pro.nom); cl.siren=pro.siren; save(LS.clients,CLIENTS);
  const today=todayISO();
  const dep=(id,extra)=>{ const x=Object.assign({id,cNom:pro.nom,cAdr:'5 Rue de la Gare',cVille:'60600 Clermont',cType:'Professionnel',cSiren:pro.siren,date:today,itype:'dep',statut:'brouillon',heures:1.5,pieces:[{label:'Condensateur 35 µF',qty:1,pu:25}],rateChoice:'custom',rateCustom:60},extra||{}); DEP.push(x); curDep=x; try{ loadDepForm(); }catch(e){} factureDep(); close(); return DEP.find(o=>o.id===id); };
  const d1=dep('dA'); X('fige_depannage',d1.facNum);
  const l={id:'L1',num:'LOC-2026-001',cNom:pro.nom,cAdr:'5 Rue de la Gare',cVille:'60600 Clermont',cType:'Professionnel',cSiren:pro.siren,items:[{ref:'Mobile',qte:1,tarif:130}],dateDebut:today,dateFin:today};
  LOC.push(l); facturerLoc('L1'); close(); if(l.fac) X('fige_location',l.fac.num);
  const k={id:'K1',clientNom:pro.nom,type:'Climatisation',prix:290,facs:[]}; CTR.push(k); facturerContrat('K1'); close(); if(k.facs[0]) X('fige_contrat',k.facs[0].num);
  const acc=DEVIS.filter(d=>d.statut==='accepte'&&compute(d).totalHT>0);
  const dv=acc[0]; Object.assign(dv,{cType:'Professionnel',cSiren:pro.siren,cNom:pro.nom,acompteOn:true,acomptePct:30});
  facturerDevis(dv.id,'acompte'); close(); facturerDevis(dv.id,'solde'); close();
  X('fige_acompte',dv.facAcompte.num); X('fige_solde_apres_acompte',dv.facSolde.num);
  const a1=nxCreateAvoir({facNum:dv.facAcompte.num,montant:Math.round(dv.facAcompte.montant*50)/100,motif:'Réduction'}); X('fige_avoir_partiel',a1.av.num);
  const ov={seller:{nom:'Tricatel',siret:'00000000100000',adresse:'1 rue du Test',cp:'75001',ville:'Paris',email:''},buyer:{nom:'Burger Queen (test)',siren:'000000002',adr:'2 rue du Test',ville:'75002 Paris',type:'Professionnel',mail:''},suffix:'-TEST12345'};
  X('bac_a_sable_solde',dv.facSolde.num,ov); X('bac_a_sable_depannage',d1.facNum,ov);
  /* facture ANCIENNE (avant 1.10, non figée) payée le jour de son émission : cadre 2 */
  const y=new Date().getFullYear(); DEP.push({id:'old1',cNom:pro.nom,cAdr:'5 Rue de la Gare',cVille:'60600 Clermont',cType:'Professionnel',cSiren:pro.siren,date:today,itype:'dep',statut:'payee',payeLe:today,modeReg:'CB',facNum:'F-'+y+'-050',facDate:today,heures:1,pieces:[],rateChoice:'custom',rateCustom:80}); save(LS.dep,DEP);
  X('ancienne_payee_jour_meme','F-'+y+'-050');
  /* régime assujetti : taux mixtes 5,5 % + 20 % (facture figée) */
  P.regimeTVA='assujetti'; Object.assign(P.entreprise,{tvaIntra:'FR32123456789'}); P.tva=10;
  const t1=dep('dT10'); X('fige_tva_10',t1.facNum);
  const dv2=acc[1]; Object.assign(dv2,{cType:'Professionnel',cSiren:pro.siren,cNom:pro.nom}); facturerDevis(dv2.id,'solde'); close(); X('fige_tva_20',dv2.facSolde.num);
  return res; });
for(const [k,v] of Object.entries(R)){ if(v) fs.writeFileSync(OUT+k+'.xml',v); console.log(k,v?'ok':'ABSENT'); }
console.log('ERRS',errs.join(' | '));
await closeBrowser();
