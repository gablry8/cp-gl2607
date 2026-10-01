import {page,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';
const {p,errs}=await page({mobile:false});
p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept().catch(()=>{}));
await seed(p);
const out=await p.evaluate(()=>{
  Object.assign(P.entreprise,{nom:'Gabriel Leroy — Froid & Climatisation',siret:'12345678900012',adresse:"12 rue de l'Hostellerie",cp:'60140',ville:'Bailleval',email:'contact@exemple.fr',tel:'0600000000',rib:'FR76 3000 6000 0112 3456 7890 189'});
  window.askMode=()=>'Virement';
  const close=()=>{ const c=document.getElementById('nx-pdf-close'); if(c) c.click(); };
  const acc=DEVIS.filter(x=>x.statut==='accepte'&&compute(x).totalHT>0);
  const d1=acc[0]; d1.acompteOn=true; d1.acomptePct=30; facturerDevis(d1.id,'acompte'); close(); facturerDevis(d1.id,'solde'); close();
  const d2=acc[1]; facturerDevis(d2.id,'solde'); close();
  const pro=CLIENTS.find(c=>c.type==='Professionnel'); d2.cSiren='552100554';
  const x={id:'depX',cNom:'M. "Jojo" Martin',cAdr:'10 Rue de Grenelle',cVille:'75007 Paris',cType:'Particulier',date:dISO(new Date()),itype:'dep',statut:'brouillon',heures:2,pieces:[],rateChoice:'custom',rateCustom:90};
  DEP.push(x); curDep=x; try{ loadDepForm(); }catch(e){} factureDep();
  const av1=nxCreateAvoir({facNum:d2.facSolde.num,montant:d2.facSolde.montant,motif:'Erreur sur le montant facturé',liberer:false});
  const av2=nxCreateAvoir({facNum:DEP.find(o=>o.id==='depX').facNum,montant:40,motif:'Geste commercial & <test>'});
  const nums=[d1.facAcompte.num,d1.facSolde.num,d2.facSolde.num,DEP.find(o=>o.id==='depX').facNum,av1.av.num,av2.av.num];
  const res={}; nums.forEach(n=>res[n]={xml:nxEinvXML(n),chk:nxEinvChecks(n)});
  /* régime assujetti TVA 20 % */
  P.regimeTVA='assujetti'; P.tva=20; Object.assign(P.entreprise,{tvaIntra:'FR32123456789'});
  const d3=acc[2]; facturerDevis(d3.id,'solde'); close(); res['TVA_'+d3.facSolde.num]={xml:nxEinvXML(d3.facSolde.num),chk:nxEinvChecks(d3.facSolde.num)};
  const av3=nxCreateAvoir({facNum:d3.facSolde.num,montant:50,motif:'Remise'}); res['TVA_'+av3.av.num]={xml:nxEinvXML(av3.av.num),chk:[]};
  return res; });
for(const [k,v] of Object.entries(out)){ fs.writeFileSync('/tmp/claude-0/sp/xml/'+k+'.xml',v.xml); console.log(k,'checks:',JSON.stringify(v.chk)); }
console.log('ERRS',errs.join('|'));
await closeBrowser();
