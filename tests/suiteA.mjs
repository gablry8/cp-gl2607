import { ecrireResultats, RACINE } from './env.mjs';
import {page,rec,RES,closeBrowser,seed} from './lib.mjs';
import fs from 'fs';
const ROOT=RACINE;

/* A1. service worker : tous les fichiers précachés existent, et tous les scripts chargés sont précachés */
{
  const sw=fs.readFileSync(ROOT+'sw.js','utf8'), idx=fs.readFileSync(ROOT+'index.html','utf8');
  const list=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]).filter(Boolean);
  const missing=list.filter(f=>!fs.existsSync(ROOT+f));
  rec('Hors ligne','Fichiers du cache présents',missing.length===0,missing.join(', ')||list.length+' fichiers');
  const scripts=[...idx.matchAll(/<script src="([^"h][^"]*)"/g)].map(m=>m[1].split('?')[0]);
  const css=[...idx.matchAll(/<link rel="stylesheet" href="([^"h][^"]*)"/g)].map(m=>m[1]);
  const notCached=scripts.concat(css).filter(f=>!list.includes(f));
  rec('Hors ligne','Scripts/CSS tous en cache hors ligne',notCached.length===0,notCached.join(', '));
}

for(const mobile of [true,false]){
  const G=mobile?'Téléphone':'PC';
  const {p,errs,ctx}=await page({mobile});
  rec(G,'Démarrage sans erreur',errs.length===0,errs.join(' | '));
  await seed(p);
  const views=await p.evaluate(()=>[...new Set([...document.querySelectorAll('[data-v]')].map(a=>a.dataset.v))].concat(['nx_devis2']));
  /* A2 chaque écran s'ouvre, sans débordement horizontal (téléphone) */
  const ov=[], viewErr=[];
  for(const v of views){
    const e0=errs.length;
    const r=await p.evaluate(async v=>{ try{ if(v==='nx_devis2'){ NXD2.open(DEVIS[0],{tab:'client'}); } else go(v); }catch(e){ return 'ERR '+e.message; }
      await new Promise(r=>setTimeout(r,120)); const s=document.querySelector('.view.active');
      const over=document.documentElement.scrollWidth-window.innerWidth;
      let wide=''; if(over>4){ const all=[...s.querySelectorAll('*')]; const w=all.filter(e=>e.getBoundingClientRect().right>window.innerWidth+4&&getComputedStyle(e).position!=='fixed').slice(0,3).map(e=>e.tagName+'.'+String(e.className).slice(0,30)+'#'+e.id); wide=w.join(','); }
      return {id:s&&s.id,over,wide}; },v);
    if(typeof r==='string') viewErr.push(v+': '+r);
    else if(r.over>4) ov.push(v+' (+'+r.over+'px: '+r.wide+')');
    if(errs.length>e0) viewErr.push(v+': '+errs.slice(e0).join(' / '));
  }
  rec(G,'Tous les écrans s\'ouvrent ('+views.length+')',viewErr.length===0,viewErr.join(' | '));
  if(mobile) rec(G,'Pas de page plus large que l\'écran',ov.length===0,ov.join(' | '));
  /* A4 fenêtres : bouton de validation atteignable (pas masqué) */
  const cov=await p.evaluate(async()=>{ const out=[];
    for(const m of document.querySelectorAll('.modal')){ m.classList.add('on'); await new Promise(r=>setTimeout(r,60)); const bx=m.querySelector('.box'); if(bx) bx.scrollTop=1e6; m.scrollTop=1e6; await new Promise(r=>setTimeout(r,30));
      const nb=m.querySelector('.navbtns'); const b=nb&&getComputedStyle(nb).display!=='none'?[...nb.querySelectorAll('button')].pop():null; if(b){ const r=b.getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); if(!(h===b||b.contains(h))) out.push(m.id+' « '+b.textContent.trim()+' » masqué par '+(h?h.tagName+'#'+h.id:'hors écran')); }
      m.classList.remove('on'); } return out; });
  rec(G,'Boutons Enregistrer des fenêtres atteignables',cov.length===0,cov.join(' | '));
  /* A3 clic sur chaque bouton de chaque écran (confirmations refusées → rien n'est supprimé) */
  const clickErr=[], dead=[]; let nClicks=0;
  for(const v of views){
    const n=await p.evaluate(v=>{ try{ if(v==='nx_devis2') NXD2.open(DEVIS[0],{tab:'client'}); else go(v); }catch(e){} const s=document.querySelector('.view.active'); return s?s.querySelectorAll('button,[onclick]').length:0; },v);
    for(let i=0;i<Math.min(n,70);i++){
      const e0=errs.length;
      const info=await p.evaluate(async ([v,i])=>{
        try{ document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on')); document.querySelectorAll('.nxd2-ov,#nxfoOv,.nxs-ov').forEach(o=>o.remove()); const pm=document.getElementById('nx-pdf-modal'); if(pm) pm.style.display='none';
          if(v==='nx_devis2'){ if(window._curView!=='nx_devis2') NXD2.open(DEVIS[0],{tab:'client'}); } else if(window._curView!==v) go(v); }catch(e){}
        const s=document.querySelector('.view.active'); const el=s&&s.querySelectorAll('button,[onclick]')[i]; if(!el) return null;
        const txt=(el.textContent||el.title||'').trim().slice(0,40); const oc=el.getAttribute('onclick')||'';
        if(/delete|suppr|delX|del[A-Z]|reset|wipe|logout|déconn|clear|vider|Import|signOut|restore|restaurer/i.test(oc+txt)) return {skip:true,txt};
        const r=el.getBoundingClientRect(); if(!r.width) return {hidden:true,txt};
        let thrown=''; try{ el.click(); }catch(e){ thrown=e.message; }
        await new Promise(r=>setTimeout(r,60));
        return {txt,oc:oc.slice(0,60),thrown};
      },[v,i]);
      if(!info||info.skip||info.hidden) continue;
      nClicks++;
      if(info.thrown||errs.length>e0) clickErr.push(v+' → « '+info.txt+' » '+(info.thrown||errs.slice(e0).join(' / ')));
      /* le clic a pu changer d'écran : on revient */
    }
  }
  rec(G,'Clic sur '+nClicks+' boutons sans erreur',clickErr.length===0,clickErr.slice(0,12).join(' | '));
  if(mobile){
    /* A5 zones tactiles trop petites (< 32 px) sur les écrans principaux */
    const small=await p.evaluate(async()=>{ const out={}; for(const v of ['dash','tous','plan','clients','dep','fluides','contrats']){ try{ go(v); }catch(e){} await new Promise(r=>setTimeout(r,80));
      document.querySelectorAll('.view.active button,.view.active a[onclick],.view.active .iconbtn').forEach(b=>{ const r=b.getBoundingClientRect(); if(r.width&&r.height&&(r.height<30||r.width<30)){ const k=(b.textContent||b.title||'?').trim().slice(0,14); out[v]=out[v]||new Set(); out[v].add(k+' '+Math.round(r.width)+'×'+Math.round(r.height)); } }); }
      return Object.entries(out).map(([k,s])=>k+': '+[...s].slice(0,5).join(', ')); });
    rec(G,'Petits boutons difficiles au doigt',small.length===0?true:'INFO',small.join(' | '));
  }
  rec(G,'Aucune erreur pendant tout le parcours',errs.length===0,[...new Set(errs)].slice(0,10).join(' | '));
  await ctx.close();
}
await closeBrowser();
ecrireResultats('resA.json',RES);
RES.forEach(r=>console.log(r.ok.padEnd(5),'['+r.group+']',r.name,r.ok!=='PASS'?'— '+r.detail:''));
