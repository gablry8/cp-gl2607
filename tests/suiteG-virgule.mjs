import {page,closeBrowser} from './lib.mjs';
const {p,errs}=await page({mobile:true});
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS ':'FAIL ')+n+(x?' — '+x:''));
// devis dépannage: recharge kg
await p.evaluate(()=>{ const d=NXD2.newDevis('depannage',{}); d.lots=[NXD2.newLot('depannage')]; NXD2.open(d,{tab:'lots'}); });
await p.waitForTimeout(300);
const sel='[data-k="data.fl.charge"]';
const t=await p.evaluate(s=>{ const e=document.querySelector(s); return [e.type,e.getAttribute('inputmode')]; },sel); ok('Case kg = texte décimal',t[0]==='text'&&t[1]==='decimal',t.join());
await p.locator(sel).tap(); await p.keyboard.type('1,35'); await p.locator(sel).blur(); await p.waitForTimeout(300);
const v=await p.evaluate(()=>NXD2.api.cur().lots[0].data.fl.charge); ok('1,35 kg lu = 1.35',v===1.35,String(v));
const shown=await p.evaluate(s=>{ const e=document.querySelector(s); return e?Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(e):'gone'; },sel); ok('Affiché avec virgule après recalcul',shown==='1,35',shown);
// chambre consigne ±
await p.evaluate(()=>{ const d=NXD2.newDevis('chambre',{}); d.lots=[NXD2.newLot('chambre')]; NXD2.open(d,{tab:'lots'}); });
await p.waitForTimeout(400);
const cs='[data-k="data.consigne"]';
const hasPm=await p.evaluate(s=>{ const e=document.querySelector(s); return !!(e&&e.nextElementSibling&&e.nextElementSibling.classList.contains('nxdec-pm')); },cs); ok('Consigne : bouton ±',hasPm);
if(hasPm){ await p.locator(cs).fill('18'); await p.locator(cs).locator('xpath=following-sibling::button').tap(); await p.waitForTimeout(400);
  const c=await p.evaluate(()=>NXD2.api.cur().lots[0].data.consigne); ok('± donne −18',c===-18,String(c)); }
// legacy dépannage form
await p.evaluate(()=>{ go('dep'); newDep(); }); await p.waitForTimeout(300);
const leg=await p.evaluate(()=>{ const i=document.querySelector('#v-dep input[inputmode="decimal"]'); if(!i) return 'none'; return i.id||i.className; });
ok('Formulaire intervention : cases décimales',leg!=='none',leg);
// dim te
await p.evaluate(()=>{ go('dim'); nxdm.tab('frigo'); }); await p.waitForTimeout(200);
await p.locator('[data-dm="f.kw"]').fill('7,5'); await p.locator('[data-dm="f.kw"]').blur(); await p.waitForTimeout(300);
const kw=await p.evaluate(()=>JSON.parse(localStorage.getItem('cpnext_dim2')).f.kw); ok('Dimensionnement 7,5 kW',kw===7.5,String(kw));
const te=await p.evaluate(()=>!!document.querySelector('[data-dm="f.te"]').nextElementSibling);
ok('T° évaporation : bouton ±',te);
// invalid
await p.locator('[data-dm="f.kw"]').fill('2 kw'); await p.locator('[data-dm="f.kw"]').blur(); await p.waitForTimeout(200);
ok('Saisie invalide signalée',await p.evaluate(()=>!!document.querySelector('.nxdec-bad')));
// fiche fluide
await p.evaluate(()=>{ go('fluides'); openFlu(); }); await p.waitForTimeout(300);
await p.locator('#fl_charge').fill('0,9'); const fc=await p.evaluate(()=>document.getElementById('fl_charge').value); ok('Fiche fluide charge 0,9 → 0.9',fc==='0.9',fc);
console.log(R.join('\n')); console.log(errs.join('\n'));
await closeBrowser();
