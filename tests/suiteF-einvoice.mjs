// Suite F — facture électronique : XML CII EN 16931 (XSD + règles officielles CEN), mention CIBS 2027, carte « prêt »
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import {execSync} from 'child_process';
import fs from 'fs';
/* F1 génération + validation */
execSync('node '+new URL('./genxml.mjs',import.meta.url).pathname,{stdio:'ignore'});
const out=execSync('python3 '+new URL('./validate-einvoice.py',import.meta.url).pathname).toString();
const lines=out.trim().split('\n'); const files=lines.filter(l=>/\.xml /.test(l));
rec('Facture électronique','XML générés ('+files.length+' : factures, acompte, avoirs, franchise et TVA 20 %)',files.length>=8,'');
rec('Facture électronique','Schéma XSD Factur-X / CII : tous valides',files.every(l=>/XSD ok/.test(l)),files.filter(l=>!/XSD ok/.test(l)).join(' | '));
rec('Facture électronique','Règles officielles EN 16931 (CEN) : 0 erreur bloquante',/TOTAL BLOQUANTS 0/.test(out),lines.filter(l=>/fatal/.test(l)).slice(0,4).join(' | '));
/* F2 mention CIBS au 1er janvier 2027 */
{
  const {p,ctx}=await page({mobile:false,init:()=>{ const D=Date; const T=new D('2027-01-05T10:00:00').getTime(); const off=T-D.now(); class FD extends D{ constructor(...a){ if(a.length) super(...a); else super(D.now()+off); } static now(){ return D.now()+off; } } window.Date=FD; }});
  await seed(p);
  const r=await p.evaluate(async()=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); facturerDevis(d.id,'solde'); await new Promise(r=>setTimeout(r,200)); const t=(document.getElementById('nx-pdf-page')||{}).textContent||''; const x=nxEinvXML(d.facSolde.num); return {pdf:/L\. 233-3 du CIBS/.test(t),old:/293 B/.test(t),xml:/L\. 233-3 du CIBS/.test(x),num:d.facSolde.num}; });
  rec('Facture électronique','Au 01/01/2027 : mention « art. L. 233-3 du CIBS » (PDF et XML)',r.pdf&&!r.old&&r.xml,JSON.stringify(r));
  await ctx.close();
}
{
  const {p,ctx}=await page({mobile:false});
  await seed(p);
  const r=await p.evaluate(async()=>{ const d=DEVIS.find(x=>x.statut==='accepte'&&compute(x).totalHT>0); facturerDevis(d.id,'solde'); await new Promise(r=>setTimeout(r,200)); const t=(document.getElementById('nx-pdf-page')||{}).textContent||''; document.getElementById('nx-pdf-close').click(); go('nx_docs'); await new Promise(r=>setTimeout(r,100)); const c=(document.getElementById('nxeiCard')||{}).innerText||'';
    return {pdf293:/293 B/.test(t),card:/Facture électronique/.test(c),manque:/SIRET/.test(c)}; });
  rec('Facture électronique','En 2026 : mention 293 B conservée',r.pdf293);
  rec('Facture électronique','Registre : carte « Facture électronique » avec ce qui manque (SIRET…)',r.card&&r.manque,JSON.stringify(r));
  await ctx.close();
}
await closeBrowser();
fs.writeFileSync('/tmp/claude-0/sp/resF.json',JSON.stringify(RES,null,1));
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
