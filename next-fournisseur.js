/* ============================================================
   ClimPilot Next — next-fournisseur.js  (couche additive, 30/09/2026)
   Demande de prix fournisseur prête à envoyer, pour TOUTES les natures
   de devis (clim, gainable, chambre froide, dépannage, entretien, PAC,
   ballon, froid commercial, adiabatique, MES, dépose, sous-traitance).
   - Bouton « ✉️ Fournisseur » dans l'en-tête du devis.
   - Le mail reprend les caractéristiques techniques utiles au vendeur
     (puissance, régime, dimensions intérieures ET extérieures de la
     chambre, épaisseur des panneaux, porte, groupe, fluide, pièces à
     desservir, liaisons, références machines…) puis la liste du matériel
     du devis avec les quantités (et ta référence fournisseur si connue).
   - Choix des lots, adresse du fournisseur mémorisée, texte modifiable,
     ouverture dans ta messagerie ou copie.
   Pas de prix de vente ni d'infos client dans le mail (juste la ville).
   ============================================================ */
(function(){
  'use strict';
  var FK='cpnext_fourn';
  try{ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(FK)<0) SYNC_KEYS.push(FK); }catch(e){}
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function fq(n){ try{ return fmtQ(n); }catch(e){ return String(Math.round(n*100)/100).replace('.',','); } }
  function lsGet(k,fb){ try{ var v=localStorage.getItem(k); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
  function persist(k,v){ try{ if(typeof save==='function') save(k,v); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function say(m){ try{ toast(m); }catch(e){} }
  function nat(id){ try{ return (NXD2.natures||[]).find(function(n){ return n.id===id; })||{label:id}; }catch(e){ return {label:id}; } }
  function mm(s){ var m=/(\d+)\s*mm/.exec(String(s||'')); return m?num(m[1]):0; }
  function has(v){ return v!=null&&v!==''&&v!==0&&v!=='Aucun'&&v!=='Aucune'; }
  function machines(ms,extra){ return (ms||[]).filter(function(m){ return m&&(m.marque||m.ref); }).map(function(m){ return '  • '+[m.marque,m.ref].filter(Boolean).join(' ')+(extra?extra(m):''); }); }

  /* ---------- caractéristiques techniques par nature ---------- */
  var SPEC={
    split:function(d){ var o=[], sp=(d.splits||[]).filter(function(s){ return num(s.puiss)>0||s.piece; });
      var mc=machines(d.machines); if(mc.length) o.push('Machine(s) envisagée(s) :'); o=o.concat(mc);
      if(sp.length){ o.push('Unités intérieures ('+sp.length+') :'); sp.forEach(function(s){ o.push('  • '+(s.typeUI||'Unité')+' '+(num(s.puiss)?fq(num(s.puiss))+' kW':'')+(s.piece?' — '+s.piece:'')+(num(s.surface)?' ('+fq(num(s.surface))+' m²)':'')); });
        var kw=sp.reduce(function(a,s){ return a+num(s.puiss); },0); if(kw) o.push('Puissance intérieure cumulée : '+fq(kw)+' kW'+(sp.length>1?' (multisplit '+sp.length+' sorties)':''));
        var lg={}; sp.forEach(function(s){ if(s.liaison&&num(s.long)) lg[s.liaison]=(lg[s.liaison]||0)+num(s.long); });
        Object.keys(lg).forEach(function(k){ o.push('Liaison '+k.replace(/^Liaison\s*/,'')+' : '+fq(lg[k])+' m'); }); }
      return o; },
    gainable:function(d){ var o=[], m0=(d.machines||[])[0]||{};
      var mc=machines(d.machines,function(m){ return [num(m.kw)?' — '+fq(num(m.kw))+' kW':'',num(m.debit)?', '+fq(num(m.debit))+' m³/h':'',num(m.pression)?', '+fq(num(m.pression))+' Pa dispo':''].join(''); });
      if(mc.length){ o.push('Machine(s) :'); o=o.concat(mc); } else if(num(m0.kw)) o.push('Puissance : '+fq(num(m0.kw))+' kW');
      if(d.emplacement) o.push('Emplacement du gainable : '+d.emplacement);
      var ps=(d.pieces||[]).filter(function(p){ return p.nom||num(p.bouches); });
      if(ps.length){ o.push('Réseau de soufflage ('+ps.length+' pièce(s)) :'); ps.forEach(function(p){ o.push('  • '+(p.nom||'Pièce')+(num(p.surface)?' '+fq(num(p.surface))+' m²':'')+' : '+(num(p.bouches)||1)+' bouche(s)'+(has(p.grille)?' '+p.grille:'')+(has(p.gaine)?', '+p.gaine+(num(p.long)?' '+fq(num(p.long))+' m/bouche':''):'')); }); }
      var r=d.reprise||{}; if(has(r.grille)||has(r.gaine)) o.push('Reprise : '+[has(r.grille)?r.grille:'',has(r.plenum)?r.plenum:'',has(r.gaine)?r.gaine+(num(r.long)?' '+fq(num(r.long))+' m':''):''].filter(Boolean).join(', ')+(r.filtre?', avec filtre':''));
      if(has(d.plenum)) o.push('Plénum de soufflage : '+d.plenum+(num(d.plenumQte)>1?' × '+num(d.plenumQte):''));
      if(has(d.zoneMat)) o.push('Zonage : '+(d.zoneMat==='plenum'?'plénum motorisé (kit fabricant)':'registres motorisés'));
      return o; },
    chambre:function(d){ var o=[], L=num(d.L), l=num(d.l), h=num(d.h), e=mm(d.ep)/1000;
      o.push('Chambre froide '+(d.temp==='neg'?'NÉGATIVE':'POSITIVE')+(has(d.consigne)?' — consigne '+fq(num(d.consigne))+' °C':''));
      if(d.usage) o.push('Produits stockés : '+d.usage); if(d.entrees) o.push('Entrées de marchandises : '+d.entrees+' kg/jour');
      if(L&&l&&h){ o.push('Dimensions intérieures : '+fq(L)+' × '+fq(l)+' × '+fq(h)+' m (L × l × H) — volume '+fq(Math.round(L*l*h*10)/10)+' m³');
        if(e) o.push('Dimensions extérieures : '+fq(Math.round((L+2*e)*100)/100)+' × '+fq(Math.round((l+2*e)*100)/100)+' × '+fq(Math.round((h+(d.sol==='isole'?2*e:e))*100)/100)+' m'); }
      if(has(d.ep)) o.push('Panneaux : '+d.ep+(mm(d.ep)?' (épaisseur '+mm(d.ep)+' mm)':''));
      o.push('Sol : '+(d.sol==='isole'?'panneaux de sol isolés':'sol existant (sans panneaux de sol)'));
      if(has(d.porte)) o.push('Porte : '+d.porte+(d.porteDim?' — '+d.porteDim:''));
      o.push('Groupe : '+(d.groupeType==='split'?'groupe de condensation + évaporateur':'monobloc')+(num(d.pw)?' — puissance frigorifique du bilan '+fq(num(d.pw))+' W':'')+(has(d.fluide)?' — fluide '+d.fluide:''));
      if(d.groupeType==='split'&&has(d.evap)) o.push('Évaporateur : '+d.evap);
      var mc=machines(d.machines,function(m){ return num(m.pw)?' — '+fq(num(m.pw))+' W':''; }); if(mc.length){ o.push('Référence(s) envisagée(s) :'); o=o.concat(mc); }
      return o; },
    depannage:function(d){ var o=[], e=d.equip||{};
      var eq=[e.type,e.marque,e.modele].filter(Boolean).join(' '); if(eq) o.push('Équipement : '+eq+(e.serie?' — n° de série '+e.serie:''));
      if(e.fluide) o.push('Fluide : '+e.fluide+(num(e.charge)?' — charge '+fq(num(e.charge))+' kg':''));
      var pc=(d.pieces||[]).filter(function(p){ return p.nom&&num(p.qte)>0; }); if(pc.length){ o.push('Pièces recherchées :'); pc.forEach(function(p){ o.push('  • '+p.nom+' × '+fq(num(p.qte))); }); }
      if(num((d.fl||{}).charge)>0) o.push('Fluide à prévoir : '+(d.fl.nom||'')+' — '+fq(num(d.fl.charge))+' kg');
      if(d.cause) o.push('Défaut constaté : '+d.cause);
      return o; },
    entretien:function(d){ var o=[], eq=(d.equips||[]).filter(function(e){ return e.marque||e.modele||e.type; });
      if(eq.length){ o.push('Équipements à entretenir ('+eq.length+') :'); eq.forEach(function(e){ o.push('  • '+[e.type,e.marque,e.modele].filter(Boolean).join(' ')+(e.fluide?' — '+e.fluide+(num(e.charge)?' '+fq(num(e.charge))+' kg':''):'')); }); }
      return o; },
    pac:function(d){ var o=[], mc=machines(d.machines);
      o.push('PAC air-eau '+(d.modele==='split'?'bi-bloc':'monobloc')+' — émetteurs : '+(d.emetteurs||'—')+(has(d.tDepart)?' — départ '+d.tDepart+' °C':''));
      if(num(d.surf)) o.push('Surface chauffée : '+fq(num(d.surf))+' m² (h '+fq(num(d.haut)||2.5)+' m, G '+fq(num(d.G)||1)+', T° de base '+(d.tbase||'—')+' °C)');
      if(d.ecs==='integree') o.push('Eau chaude sanitaire intégrée'+(num(d.occEcs)?' — '+num(d.occEcs)+' occupants':''));
      if(mc.length){ o.push('Machine(s) envisagée(s) :'); o=o.concat(mc); }
      return o; },
    ballon:function(d){ var o=[], mc=machines(d.machines,function(m){ return num(m.litres)?' — '+num(m.litres)+' L':''; });
      o.push('Ballon thermodynamique — implantation : '+(d.impl||'—')+(num(d.occ)?' — '+num(d.occ)+' occupants':''));
      if(mc.length){ o.push('Référence(s) :'); o=o.concat(mc); }
      return o; },
    froidcom:function(d){ var o=[], mc=machines(d.machines);
      o.push((d.nature==='remplacement'?'Remplacement':'Pose neuve')+' — groupe '+(d.groupe==='loge'?'logé':d.groupe==='centrale'?'sur centrale':'déporté'));
      if(mc.length){ o.push('Meuble(s) / équipement(s) :'); o=o.concat(mc); }
      var sp=(d.splits||[]).filter(function(s){ return num(s.puiss)>0||s.liaison; }); sp.forEach(function(s){ o.push('  Liaison '+(s.liaison||'')+(num(s.long)?' '+fq(num(s.long))+' m':'')+(num(s.puiss)?' — '+fq(num(s.puiss))+' kW':'')); });
      return o; }
  };
  function generic(d){ var o=[], mc=machines(d.machines); if(mc.length){ o.push('Matériel envisagé :'); o=o.concat(mc); } return o; }

  function refOf(nom){ try{ var p=window.NXK&&NXK.pr?NXK.pr(nom):null; if(p) return [p.ref,p.four].filter(Boolean).join(' — '); }catch(e){} return ''; }
  function build(d,sel){
    var c=null; try{ c=NXD2.compute(d); }catch(e){}
    var E={}; try{ E=P.entreprise||{}; }catch(e){}
    var parts=[], agg={};
    (d.lots||[]).forEach(function(lot,i){
      if(!sel[i]) return;
      var n=nat(lot.module), dd=lot.data||{}, f=SPEC[lot.module]||generic, sp=[];
      try{ sp=f(dd)||[]; }catch(e){ sp=[]; }
      parts.push('— '+n.label+(lot.titre?' : '+lot.titre:'')+(lot.option?' (en option)':'')+' —'+(sp.length?'\n'+sp.join('\n'):''));
      var cl=c&&((c.lots||[]).concat(c.options||[])).find(function(x){ return x.i===i; });
      (cl&&cl.mat||[]).forEach(function(m){ if(!m||!m.nom||!(num(m.qte)>0)) return; var k=m.nom+'|'+(m.unite||'u'); if(!agg[k]) agg[k]={nom:m.nom,unite:m.unite||'u',qte:0}; agg[k].qte+=num(m.qte); });
    });
    var mat=Object.keys(agg).map(function(k){ return agg[k]; });
    var body='Bonjour,\n\nPour un chantier '+(d.cVille?'à '+d.cVille+' ':'')+'(réf. '+(d.num||'—')+'), pourriez-vous me faire une offre de prix avec disponibilités et délais pour :\n\n'+
      parts.join('\n\n')+
      (mat.length?'\n\nMatériel :\n'+mat.map(function(x){ var r=refOf(x.nom); return '- '+x.nom+' : '+fq(Math.ceil(x.qte*100)/100)+' '+x.unite+(r?' (réf. '+r+')':''); }).join('\n'):'')+
      '\n\nMerci d\'indiquer vos références exactes, le délai de livraison ou d\'enlèvement'+(parts.some(function(p){ return /Chambre froide/.test(p); })?', les plans de montage et le détail des panneaux (dimensions, épaisseur, finition)':'')+'.\n\nBien cordialement,\n\n'+
      [E.nom&&E.nom!=='—'&&/gabriel/i.test(E.nom)?'':'Gabriel Leroy',E.nom&&E.nom!=='—'?E.nom:'',E.tel||'',E.email||E.mail||''].filter(Boolean).join('\n');
    var subj='Demande de prix — '+Array.from(new Set((d.lots||[]).filter(function(l,i){ return sel[i]; }).map(function(l){ return nat(l.module).label; }))).join(' + ')+(d.cVille?' — '+d.cVille:'')+' — '+(d.num||'');
    return {subject:subj,body:body};
  }

  /* ---------- fenêtre ---------- */
  var SEL={};
  function cur(){ try{ return NXD2.api.cur(); }catch(e){ return null; } }
  window.nxfoOpen=function(){
    var d=cur(); if(!d||!(d.lots||[]).length){ say('Ajoute d\'abord un lot au devis'); return; }
    SEL={}; d.lots.forEach(function(l,i){ SEL[i]=!l.option; });
    var ov=document.getElementById('nxfoOv'); if(!ov){ ov=document.createElement('div'); ov.id='nxfoOv'; ov.className='nxd2-ov'; document.body.appendChild(ov); ov.addEventListener('click',function(e){ if(e.target===ov) nxfoClose(); }); }
    var F=lsGet(FK,{last:'',list:[]})||{};
    ov.innerHTML='<div class="nxd2-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="margin:0">✉️ Demande de prix fournisseur</h2><button class="iconbtn" onclick="nxfoClose()">✕</button></div>'+
      '<div class="frm" style="margin-top:10px"><label class="full">Email du fournisseur<input id="nxfoTo" type="email" list="nxfoDL" value="'+esc(F.last||'')+'" placeholder="agence@fournisseur.fr"><datalist id="nxfoDL">'+(F.list||[]).map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist></label></div>'+
      (d.lots.length>1?'<div style="margin:8px 0"><b style="font-size:13px">Lots à inclure</b>'+d.lots.map(function(l,i){ return '<label class="nxd2-chk"><input type="checkbox" '+(SEL[i]?'checked':'')+' onchange="nxfoSel('+i+',this.checked)"> <span>'+esc(nat(l.module).label+(l.titre?' — '+l.titre:'')+(l.option?' (option)':''))+'</span></label>'; }).join('')+'</div>':'')+
      '<label class="full" style="display:block;margin-top:8px">Objet<input id="nxfoSubj" style="width:100%"></label>'+
      '<label class="full" style="display:block;margin-top:8px">Message (modifiable)<textarea id="nxfoBody" rows="16" style="width:100%;font-family:inherit;font-size:13px"></textarea></label>'+
      '<div class="row-actions" style="margin-top:10px;flex-wrap:wrap"><button class="btn-pri" onclick="nxfoSend()">Ouvrir dans ma messagerie</button><button class="btn-ghost" onclick="nxfoCopy()">📋 Copier le texte</button></div>'+
      '<div class="nxd2-hint">Vérifie les caractéristiques avant d\'envoyer : elles viennent de ton devis. Aucun prix de vente n\'est transmis.</div></div>';
    fill();
  };
  function fill(){ var d=cur(); if(!d) return; var m=build(d,SEL); var s=document.getElementById('nxfoSubj'), b=document.getElementById('nxfoBody'); if(s) s.value=m.subject; if(b) b.value=m.body; }
  window.nxfoSel=function(i,v){ SEL[i]=!!v; fill(); };
  window.nxfoClose=function(){ var ov=document.getElementById('nxfoOv'); if(ov) ov.parentNode.removeChild(ov); };
  function remember(to){ if(!to) return; var F=lsGet(FK,{last:'',list:[]})||{}; F.last=to; F.list=[to].concat((F.list||[]).filter(function(x){ return x!==to; })).slice(0,15); persist(FK,F); }
  window.nxfoSend=function(){
    var to=(document.getElementById('nxfoTo')||{}).value||'', s=(document.getElementById('nxfoSubj')||{}).value||'', b=(document.getElementById('nxfoBody')||{}).value||'';
    remember(to.trim());
    try{ buildMail(to.trim(),s,b); }catch(e){ location.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(b); }
  };
  window.nxfoCopy=function(){ var b=(document.getElementById('nxfoBody')||{}).value||''; try{ navigator.clipboard.writeText(b).then(function(){ say('Texte copié'); }); }catch(e){ var t=document.getElementById('nxfoBody'); t.select(); document.execCommand('copy'); say('Texte copié'); } };
  window.nxfoBuild=build;

  /* ---------- bouton dans l'en-tête du devis ---------- */
  function addBtn(){
    var h=document.querySelector('#nxd2Head .row-actions'); if(!h||h.querySelector('.nxfo-btn')) return;
    var b=document.createElement('button'); b.type='button'; b.className='btn-ghost btn-sm nxfo-btn'; b.textContent='✉️ Fournisseur'; b.title='Demande de prix fournisseur pré-remplie'; b.onclick=function(){ nxfoOpen(); };
    var pdf=[].find.call(h.querySelectorAll('button'),function(x){ return /PDF/.test(x.textContent); });
    if(pdf&&pdf.nextSibling) h.insertBefore(b,pdf.nextSibling); else h.appendChild(b);
  }
  function boot(t){
    t=t||0; if(!window.NXD2){ if(t<60) setTimeout(function(){ boot(t+1); },150); return; }
    new MutationObserver(function(){ addBtn(); }).observe(document.body,{childList:true,subtree:true});
    addBtn();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ boot(0); }); else boot(0);
})();
