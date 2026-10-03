/* Aperçu ClimPilot 1.10 — bandeau de démonstration (n'existe que dans cette copie publiée).
   - Aucune connexion au cloud : la bibliothèque Supabase n'est pas chargée, rien ne sort de la page.
   - Les boîtes de dialogue du navigateur sont désactivées dans une page publiée : elles sont remplacées ici
     par un journal visible ; la réponse aux questions (Oui / Non) se règle dans le bandeau.
   - « Charger des exemples » crée des clients et des devis fictifs. */
(function(){
  'use strict';
  var J=[], REP=true;
  try{ REP=localStorage.getItem('apercu_rep')!=='non'; }catch(e){}
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function note(type,msg,rep){
    J.unshift({t:new Date().toLocaleTimeString('fr-FR'),type:type,msg:String(msg||''),rep:rep});
    if(J.length>60) J.length=60;
    rendre(); bulle(type,msg,rep);
  }
  var tb=null;
  function bulle(type,msg,rep){
    var b=document.getElementById('apBulle'); if(!b) return;
    b.innerHTML='<div class="ap-k">'+(type==='question'?'Question de l’appli':type==='saisie'?'Saisie demandée':'Message de l’appli')+(rep!=null?' — réponse : <b>'+esc(rep)+'</b>':'')+'</div><div class="ap-m">'+esc(msg).replace(/\n/g,'<br>')+'</div>';
    b.hidden=false; clearTimeout(tb); tb=setTimeout(function(){ b.hidden=true; },type==='message'?6000:9000);
  }
  window.alert=function(m){ note('message',m,null); };
  window.confirm=function(m){ note('question',m,REP?'Oui':'Non'); return REP; };
  window.prompt=function(m,d){ var v=d==null?'':String(d); note('saisie',m,v||'(vide)'); return v; };

  function rendre(){
    var n=document.getElementById('apN'); if(n) n.textContent=String(J.length);
    var l=document.getElementById('apJournal'); if(!l||l.hidden) return;
    l.innerHTML=J.length?J.map(function(x){ return '<li><span class="ap-t">'+x.t+'</span> <span class="ap-ty">'+x.type+'</span>'+(x.rep!=null?' <span class="ap-r">→ '+esc(x.rep)+'</span>':'')+'<div>'+esc(x.msg).replace(/\n/g,'<br>')+'</div></li>'; }).join(''):'<li>Aucun message pour l’instant.</li>';
  }
  function exemples(){
    try{
      if((window.DEVIS||[]).length&&!window.confirm('Des données existent déjà dans cet aperçu. Ajouter quand même les exemples ?')) return;
      var t=dISO(new Date());
      Object.assign(P.entreprise,{nom:'Entreprise Exemple',statut:'Micro-entreprise (en création)',nomEntrepreneur:'Prénom Nom',adresse:'1 rue de l’Exemple',cp:'60000',ville:'Beauvais',tel:'06 00 00 00 00',email:'contact@exemple.fr'});
      var c=[{id:'ex1',nom:'Boulangerie Exemple',tel:'06 11 22 33 44',mail:'boulangerie@exemple.fr',type:'Professionnel',adr:'5 rue de la Gare',ville:'60600 Clermont',notes:''},
        {id:'ex2',nom:'Atelier Exemple',tel:'03 44 00 00 00',type:'Professionnel',adr:'2 rue de l’Église',ville:'60100 Creil',notes:''},
        {id:'ex3',nom:'Mme Exemple (particulière)',tel:'06 99 88 77 66',type:'Particulier',adr:'10 rue des Lilas',ville:'60000 Beauvais',notes:'Contrat à préciser : sert à voir le contrôle L221-10'}];
      c.forEach(function(x){ CLIENTS.push(x); }); save(LS.clients,CLIENTS);
      NXD2.natures.forEach(function(n,i){ var cl=c[i%3], d=NXD2.newDevis(n.id,{}); d.lots=[NXD2.newLot(n.id)];
        Object.assign(d,{cNom:cl.nom,cTel:cl.tel,cAdr:cl.adr,cVille:cl.ville,cType:cl.type,statut:['brouillon','envoye','accepte','refuse'][i%4]},i%4===2?{datePlanif:t}:{});
        d.num=NXD2.numFor(d); NXD2.derive(d); DEVIS.push(d); });
      save(LS.devis,DEVIS);
      try{ go('dash'); }catch(e){} note('message','Exemples chargés : 3 clients fictifs et '+NXD2.natures.length+' devis. Les factures émises ici portent des numéros TEST-F-….',null);
    }catch(e){ note('message','Chargement impossible : '+(e&&e.message||e),null); }
  }
  function monter(){
    if(document.getElementById('apBarre')) return;
    var st=document.createElement('style');
    st.textContent=':root{--ap-bg:#fffaf0;--ap-fg:#3b2f12;--ap-bd:#e6c97a;--ap-acc:#9a6700;--ap-chip:#fff3cf}'+
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ap-bg:#2a2414;--ap-fg:#f3e6c4;--ap-bd:#6b5a23;--ap-acc:#f2c14e;--ap-chip:#3a321b}}'+
      ':root[data-theme="dark"]{--ap-bg:#2a2414;--ap-fg:#f3e6c4;--ap-bd:#6b5a23;--ap-acc:#f2c14e;--ap-chip:#3a321b}'+
      '#apBarre{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:var(--ap-bg);color:var(--ap-fg);border-top:2px solid var(--ap-bd);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:8px 16px calc(8px + env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}'+
      '#apBarre b{color:var(--ap-acc)} #apBarre button{font:inherit;border:1px solid var(--ap-bd);background:var(--ap-chip);color:var(--ap-fg);border-radius:6px;padding:4px 10px;cursor:pointer}'+
      '#apBarre button[aria-pressed="true"]{background:var(--ap-acc);color:var(--ap-bg);border-color:var(--ap-acc)} #apBarre button:focus-visible{outline:2px solid var(--ap-acc);outline-offset:2px}'+
      '.ap-grp{display:flex;gap:4px;align-items:center;flex-wrap:wrap}'+
      '#apBulle{position:fixed;right:16px;bottom:64px;max-width:min(460px,calc(100vw - 32px));z-index:2147483001;background:var(--ap-bg);color:var(--ap-fg);border:1px solid var(--ap-bd);border-radius:10px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'+
      '#apBulle .ap-k{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ap-acc);margin-bottom:4px}'+
      '#apJournal{position:fixed;left:16px;right:16px;bottom:64px;max-height:45vh;overflow:auto;z-index:2147483001;background:var(--ap-bg);color:var(--ap-fg);border:1px solid var(--ap-bd);border-radius:10px;margin:0;padding:10px 14px 10px 30px;font:12.5px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'+
      '#apJournal li{margin:0 0 8px} .ap-t{font-variant-numeric:tabular-nums;opacity:.7} .ap-ty{text-transform:uppercase;font-size:10.5px;letter-spacing:.05em;color:var(--ap-acc)} .ap-r{font-weight:600}'+
      '';
    document.head.appendChild(st);
    var b=document.createElement('div'); b.id='apBarre'; b.setAttribute('role','region'); b.setAttribute('aria-label','Aperçu');
    b.innerHTML='<span><b>Aperçu ClimPilot 1.10</b> · démonstration, aucune connexion au cloud, données fictives</span>'+
      '<span class="ap-grp">Réponse aux questions : <button type="button" id="apOui">Oui</button><button type="button" id="apNon">Non</button></span>'+
      '<span class="ap-grp"><button type="button" id="apEx">Charger des exemples</button><button type="button" id="apJ">Journal (<span id="apN">0</span>)</button></span>';
    document.body.appendChild(b);
    var bu=document.createElement('div'); bu.id='apBulle'; bu.hidden=true; bu.setAttribute('role','status'); document.body.appendChild(bu);
    var jl=document.createElement('ol'); jl.id='apJournal'; jl.hidden=true; document.body.appendChild(jl);
    function maj(){ document.getElementById('apOui').setAttribute('aria-pressed',REP?'true':'false'); document.getElementById('apNon').setAttribute('aria-pressed',REP?'false':'true'); }
    document.getElementById('apOui').onclick=function(){ REP=true; try{ localStorage.setItem('apercu_rep','oui'); }catch(e){} maj(); };
    document.getElementById('apNon').onclick=function(){ REP=false; try{ localStorage.setItem('apercu_rep','non'); }catch(e){} maj(); };
    document.getElementById('apEx').onclick=exemples;
    document.getElementById('apJ').onclick=function(){ jl.hidden=!jl.hidden; rendre(); };
    function ajuster(){ var h=b.offsetHeight||56; bu.style.bottom=(h+8)+'px'; jl.style.bottom=(h+8)+'px'; document.body.style.paddingBottom=(h+6)+'px'; }
    window.addEventListener('resize',ajuster); setTimeout(ajuster,0);
    maj(); rendre();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',monter); else monter();
  window.addEventListener('load',monter);
})();
