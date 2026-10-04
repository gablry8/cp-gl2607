// Batterie de tests ClimPilot — Playwright (Chromium), serveur local :8765
import { devices, lancerNavigateur, URL_LOCALE } from './env.mjs';
export const RES=[];
export function rec(group,name,ok,detail){ RES.push({group,name,ok:ok===true?'PASS':ok===false?'FAIL':ok,detail:detail==null?'':String(detail).slice(0,400)}); }
let browser=null;
export async function getBrowser(){ if(!browser) browser=await lancerNavigateur(); return browser; }
export async function closeBrowser(){ if(browser) await browser.close(); browser=null; }

export async function page(opts={}){
  const b=await getBrowser();
  const ctxOpts=opts.mobile===false?{viewport:{width:1300,height:900},locale:'fr-FR',timezoneId:opts.tz||'Europe/Paris'}:{...devices['iPhone 13'],locale:'fr-FR',timezoneId:opts.tz||'Europe/Paris'};
  const ctx=await b.newContext(ctxOpts);
  const p=await ctx.newPage();
  const errs=[];
  p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  p.on('console',m=>{ if(m.type()==='error' && !/Failed to load resource|ERR_|net::|Not allowed to launch|integrity/.test(m.text())) errs.push('CONSOLE '+m.text().slice(0,200)); });
  p.on('dialog',d=>d.dismiss().catch(()=>{}));
  await p.route(/supabase/, r=>r.abort());
  await p.route(/cdn\.jsdelivr\.net\/npm\/chart/, r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.Chart=function(){return{destroy(){},update(){}}};'}));
  await p.route(/cdnjs|tesseract|unpkg/, r=>r.abort());
  if(opts.offline){ await p.route(/data\.geopf\.fr/, r=>r.abort()); }
  else if(opts.routeFail){ await p.route(/data\.geopf\.fr\/navigation/, r=>r.fulfill({status:503,body:'down'})); geoMock(p,true); }
  else geoMock(p,false);
  /* point de départ des trajets FICTIF (le code n'en contient plus : sans lui, pas de calcul de distance) */
  if(opts.depart!==false) await p.addInitScript(()=>{ try{ if(!localStorage.getItem('cpnext_home')) localStorage.setItem('cpnext_home',JSON.stringify({adr:"1 Rue de l'Exemple 60000 Beauvais",lon:2.0807,lat:49.4295,source:'manuel'})); }catch(e){} });
  if(opts.init) await p.addInitScript(opts.init);
  await p.goto(URL_LOCALE+'index.html');
  await p.waitForTimeout(opts.wait||2200);
  return {p,ctx,errs};
}
function geoMock(p,onlyGeo){
  p.route(/data\.geopf\.fr\/geocodage/, r=>{ const u=new URL(r.request().url()); const q=u.searchParams.get('q')||'';
    const paris=/paris|grenelle/i.test(q);
    const f=paris?{type:'Feature',geometry:{type:'Point',coordinates:[2.3176,48.8566]},properties:{label:"10 Rue de Grenelle 75007 Paris",name:"10 Rue de Grenelle",postcode:'75007',city:'Paris',context:'75, Paris, Île-de-France',type:'housenumber',score:0.9}}
      :{type:'Feature',geometry:{type:'Point',coordinates:[2.47,49.38]},properties:{label:"5 Rue de la Gare 60600 Clermont",name:"5 Rue de la Gare",postcode:'60600',city:'Clermont',context:'60, Oise, Hauts-de-France',type:'housenumber',score:0.9}};
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({type:'FeatureCollection',features:[f]})}); });
  if(!onlyGeo) p.route(/data\.geopf\.fr\/navigation/, r=>{ const u=r.request().url(); const paris=/2\.3176/.test(u);
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(paris?{distance:78.67,duration:81.8}:{distance:5.2,duration:8})}); });
}

/* jeu de données réaliste, injecté dans la page */
export const SEED=`(function(){
  const t=dISO(new Date());
  const c=[{id:'c1',nom:'Boulangerie Dupré',tel:'06 11 22 33 44',mail:'b@d.fr',type:'Professionnel',adr:'5 Rue de la Gare',ville:'60600 Clermont',notes:'Code portail 1234'},
    {id:'c2',nom:"L'Atelier du Froid",tel:'03 44 00 00 00',type:'Professionnel',adr:"2 rue de l'Église",ville:'60100 Creil',notes:'Accès par la cour'},
    {id:'c3',nom:'M. "Jojo" Martin',tel:'',type:'Particulier',adr:'10 Rue de Grenelle',ville:'75007 Paris',notes:''}];
  c.forEach(x=>CLIENTS.push(x)); save(LS.clients,CLIENTS);
  /* 1.10 : pour un particulier, le mode de conclusion doit être précisé avant toute facture (règles testées par la suite J) ;
     ici, le jeu de test est « signé dans les locaux », ce qui laisse la facturation suivre son cours normal */
  const conc=cl=>cl.type==='Particulier'?{conclusion:{mode:'locaux',date:t,preuve:{type:'papier',ref:'jeu de test'},urgence:false}}:{};
  const mk=(mod,cl,st,extra)=>{ const d=NXD2.newDevis(mod,{}); d.lots=[NXD2.newLot(mod)]; Object.assign(d,{cNom:cl.nom,cTel:cl.tel,cAdr:cl.adr,cVille:cl.ville,cType:cl.type,statut:st},conc(cl),extra||{}); d.num=NXD2.numFor(d); NXD2.derive(d); return d; };
  const L=[];
  NXD2.natures.forEach((n,i)=>{ L.push(mk(n.id,c[i%3],['brouillon','envoye','accepte','refuse'][i%4],i%4===2?{datePlanif:t}:{})); });
  L.forEach(d=>DEVIS.push(d)); save(LS.devis,DEVIS);
})();`;

export async function seed(p){ return p.evaluate(SEED); }
