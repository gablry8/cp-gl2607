import {page,closeBrowser} from './lib.mjs';
import { ecrireResultats } from './env.mjs';
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
await p.evaluate(()=>{ newDep('dep'); }); await p.waitForTimeout(300);
const leg=await p.evaluate(()=>{ const n=document.querySelectorAll('input[type="number"]').length; const i=document.querySelector('.view.active input[inputmode="decimal"]'); return n?'reste '+n+' cases nombre':(i?(i.id||i.className):'none'); });
ok('Formulaire intervention : cases décimales',leg!=='none',leg);
// dim te
await p.evaluate(()=>{ go('dim'); nxdm.tab('frigo'); }); await p.waitForTimeout(200);
await p.locator('[data-dm="f.kw"]').fill('7,5'); await p.locator('[data-dm="f.kw"]').blur(); await p.waitForTimeout(300);
const kw=await p.evaluate(()=>JSON.parse(localStorage.getItem('cpnext_dim2')).f.kw); ok('Dimensionnement 7,5 kW',kw===7.5,String(kw));
const te=await p.evaluate(()=>!!document.querySelector('[data-dm="f.te"]').nextElementSibling);
ok('T° évaporation : bouton ±',te);
// invalid
const bad=await p.evaluate(async()=>{ let m=''; const ot=window.toast; window.toast=x=>{ m+=x; }; const k=document.querySelector('[data-dm="f.kw"]'); k.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(k,'2 kw'); k.blur(); await new Promise(r=>setTimeout(r,50)); window.toast=ot; return m; });
ok('Saisie invalide signalée',/n'est pas un nombre/.test(bad),bad);
// fiche fluide
await p.evaluate(()=>{ go('fluides'); openFlu(); }); await p.waitForTimeout(300);
await p.locator('#fl_charge').fill('0,9'); const fc=await p.evaluate(()=>document.getElementById('fl_charge').value); ok('Fiche fluide charge 0,9 → 0.9',fc==='0.9',fc);
ok('Aucune erreur dans la page pendant la suite',!errs.length,errs.slice(0,4).join(' | '));
console.log(R.join('\n')); console.log(errs.join('\n'));
await closeBrowser();
ecrireResultats('resG.json',R.map(l=>{ const m=/^(PASS|FAIL) (.*?)(?: — (.*))?$/s.exec(l); return {group:'Virgule',name:m[2],ok:m[1],detail:m[3]||''}; }));
