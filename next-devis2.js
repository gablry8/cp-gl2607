/* ============================================================
   ClimPilot Next — next-devis2.js
   Devis par nature de chantier : socle commun + modules + lots.
   Couche additive, chargée en dernier. Rien du moteur existant
   n'est modifié : les devis existants (sans « v:2 ») passent
   toujours par l'ancien calcul, au centime près.

   - window.NXD2.register(module) : ajoute une nature de chantier
   - compute(d) : si d.v===2 → calcul par lots, sinon ancien moteur
   - openDevis / printDevis / saveDevis : aiguillés vers l'éditeur
     v2 quand le devis est au nouveau format
   - Choix de la nature au clic sur « Nouveau devis »
   - Numéro avec la nature : DV-AAAAMMJJ-SPL-XXXXXX
   - Protection des champs posés par d'autres écrans (factures,
     signature, relances…) à l'enregistrement, ancien et nouveau
     formulaire.
   ============================================================ */
(function(){
  'use strict';

  var VIEW='nx_devis2', DEFK='cpnext_d2_defaults', DRAFTK='cpnext_d2_draft', FLAGK='cpnext_d2_on';
  /* chaîne de calcul existante : les couches ajoutées plus tard (électricité, TVA mixte) s'empilent par-dessus,
     donc un lot « ancien format » est toujours recalculé via window.compute (chaîne complète, à l'heure de l'appel) */
  var LEGACY=window.compute;
  if(typeof LEGACY!=='function') return;

  /* ---------------- utilitaires ---------------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function clone(o){ return o==null?o:JSON.parse(JSON.stringify(o)); }
  function sum(a,f){ return (a||[]).reduce(function(s,x){ return s+(f?f(x):x); },0); }
  function lsGet(k,fb){ try{ var v=localStorage.getItem(k); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function persist(k,v){ try{ save(k,v); }catch(e){ lsSet(k,v); } }
  function say(m){ try{ toast(m); }catch(e){} }
  function E_(){ try{ return (P&&P.entreprise)||{}; }catch(e){ return {}; } }
  function fq(n){ try{ return fmtQ(n); }catch(e){ return String(r2(n)).replace('.',','); } }
  function money(n){ try{ return eur(n); }catch(e){ return r2(n)+' €'; } }
  function getPath(o,p){ return String(p).split('.').reduce(function(a,k){ return a==null?undefined:a[k]; },o); }
  function setPath(o,p,v){ var ks=String(p).split('.'), x=o; for(var i=0;i<ks.length-1;i++){ if(x[ks[i]]==null) x[ks[i]]=/^\d+$/.test(ks[i+1])?[]:{}; x=x[ks[i]]; } x[ks[ks.length-1]]=v; }
  function ymd(ts){ var d=new Date(ts||Date.now()); return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
  function newId(){ try{ return uid(); }catch(e){ return Math.random().toString(36).slice(2,8).toUpperCase(); } }
  function flagOn(){ try{ return localStorage.getItem(FLAGK)!=='0'; }catch(e){ return true; } }
  function franchise(){ try{ return P.regimeTVA!=='assujetti'; }catch(e){ return true; } }

  /* réglages communs mémorisés (synchronisés entre appareils) */
  var CFG_DEF={kmRate:0.9, hPerDay:6, prepH:0.5, achatH:1, savPct:5};
  function DEFS(){ var d=lsGet(DEFK,{}); if(!d||typeof d!=='object') d={}; if(!d.cfg) d.cfg={}; return d; }
  function CFG(){ var c=DEFS().cfg, o={}; Object.keys(CFG_DEF).forEach(function(k){ o[k]=(c[k]!=null&&c[k]!=='')?num(c[k]):CFG_DEF[k]; }); return o; }
  try{ if(Array.isArray(window.SYNC_KEYS) && window.SYNC_KEYS.indexOf(DEFK)<0) window.SYNC_KEYS.push(DEFK); }catch(e){}

  /* ---------------- registre des natures ---------------- */
  var MODS={};
  var NATURES=[
    {id:'split',    code:'SPL', label:'Clim murale',             sub:'mono, multi, console, cassette', ico:'❄️', phase:1, legacy:'Monosplit'},
    {id:'gainable', code:'GAI', label:'Gainable',                sub:'réseau, plénums, zonage',          ico:'🌀', phase:2, legacy:'Gainable'},
    {id:'depannage',code:'DEP', label:'Dépannage',               sub:'devis de réparation',              ico:'🔧', phase:3, legacy:'Dépannage'},
    {id:'entretien',code:'ENT', label:'Entretien & contrat',     sub:'visite ou contrat annuel',         ico:'🧰', phase:4, legacy:'Maintenance'},
    {id:'chambre',  code:'CHF', label:'Chambre froide',          sub:'panneaux, porte, groupe',          ico:'🧊', phase:5, legacy:'Chambre froide'},
    {id:'pac',      code:'PAC', label:'PAC air-eau',             sub:'hydraulique, émetteurs',           ico:'♨️', phase:6, legacy:'PAC air-eau'},
    {id:'ballon',   code:'BAL', label:'Ballon thermodynamique',  sub:'eau chaude sanitaire',             ico:'🚿', phase:6, legacy:'Ballon thermodynamique'},
    {id:'froidcom', code:'FRC', label:'Froid commercial',        sub:'vitrines, meubles, groupes',       ico:'🛒', phase:6, legacy:null},
    {id:'adia',     code:'ADI', label:'Adiabatique',             sub:'depuis ton étude AdiaPilot',       ico:'💨', phase:6, legacy:'Adiabatique'},
    {id:'mes',      code:'MES', label:'Mise en service seule',   sub:'matériel posé par un autre',      ico:'✅', phase:6, legacy:null},
    {id:'depose',   code:'DPS', label:'Dépose / remplacement',   sub:'récupération fluide, DEEE',        ico:'♻️', phase:6, legacy:null},
    {id:'st',       code:'STR', label:'Sous-traitance',          sub:'pour un donneur d\'ordre',         ico:'🤝', phase:6, legacy:null}
  ];
  function natureOf(id){ return NATURES.filter(function(n){ return n.id===id; })[0]||{id:id,code:'XXX',label:id,ico:'•'}; }
  function legacyMod(type){ var ids=Object.keys(MODS); for(var i=0;i<ids.length;i++){ var m=MODS[ids[i]]; try{ if(m&&m.fromLegacy&&m.isLegacyType&&m.isLegacyType(type)) return ids[i]; }catch(e){} } return null; }
  function register(m){ MODS[m.id]=m; }

  /* ---------------- calcul v2 ---------------- */
  var ZONES=['Aucun','0-10 km','10-20 km','20-30 km','30-40 km','40-50 km','50-60 km','+60 km'];
  function rateOf(d){ return d.rateChoice==='custom'?num(d.rateCustom):(num(d.rateChoice)||num(P.defaultRate)||0); }
  function zonePrice(d){
    var z=d.zone||'Aucun'; if(z==='Aucun') return 0;
    var base50=num((P.zone||{})['+50 km']);
    if(z==='50-60 km') return base50;
    if(z==='+60 km') return base50+CFG().kmRate*Math.max(0,num(d.km)-60);
    return num((P.zone||{})[z]);
  }
  function mkLine(group,label,detail,ht,achat,meta){
    meta=meta||{};
    return {group:group,label:label,detail:detail||'',ht:ht||0,achat:achat||0,
      qte:meta.qte!=null?meta.qte:1,unite:meta.unite||'forfait',pu:meta.pu!=null?meta.pu:(ht||0),mo:!!meta.mo,lot:meta.lot};
  }
  function tvaOfLot(mode,lines,shareHT){
    /* retourne {tva, parts:{taux:base}} pour un lot (+ sa part de frais communs) */
    var ht=sum(lines,function(l){return l.ht;})+shareHT, parts={};
    if(mode==='mixte'){
      var mat=sum(lines.filter(function(l){return l.group==='Matériel';}),function(l){return l.ht;});
      parts['20']=(parts['20']||0)+mat; parts['10']=(parts['10']||0)+(ht-mat);
      return {tva:mat*0.2+(ht-mat)*0.1,parts:parts};
    }
    var r=num(mode); parts[String(r)]=ht; return {tva:ht*r/100,parts:parts};
  }
  function computeV2(d){
    var rate=rateOf(d), cm=d.common||{}, lines=[], mat=[], warnings=[], lots=[], options=[], heures=0;
    (d.lots||[]).forEach(function(lot,i){
      var mod=MODS[lot.module], r;
      try{ r=mod?mod.compute(lot,{d:d,rate:rate,index:i}):null; }catch(e){ r=null; warnings.push('Lot '+(i+1)+' : calcul impossible ('+(e.message||e)+')'); }
      if(!r) r={lines:[mkLine('Frais & divers','Lot « '+natureOf(lot.module).label+' » : module absent sur cet appareil — mets ClimPilot à jour','',0,0)],mat:[],heures:0,detailH:0,warnings:['Lot « '+natureOf(lot.module).label+' » non chiffré sur cet appareil : recharge ClimPilot (mise à jour) avant d\'envoyer ou de facturer'],missing:true};
      r.lines.forEach(function(l){ l.lot=i; });
      var e={i:i,id:lot.id,module:lot.module,label:natureOf(lot.module).label,titre:lot.titre||'',option:!!lot.option,
        ht:sum(r.lines,function(l){return l.ht;}),heures:r.heures||0,detailH:r.detailH||0,lines:r.lines,mat:r.mat||[],
        tvaMode:(lot.tva!=null&&lot.tva!=='')?String(lot.tva):String(P.tva),warnings:r.warnings||[]};
      (e.warnings||[]).forEach(function(w){ warnings.push((d.lots.length>1?'Lot '+(i+1)+' — ':'')+w); });
      if(lot.option){ options.push(e); return; }
      lots.push(e); lines=lines.concat(r.lines); mat=mat.concat(e.mat); heures+=e.heures;
    });
    var common=[], addC=function(g,l,dt,ht,a,m){ common.push(mkLine(g,l,dt,ht,a,m)); };
    /* frais de dossier, de commande, achat du matériel et marge de sécurité : selon la nature (ex. : pas sur une sous-traitance au taux convenu,
       pas d'achat ni de frais de commande sans matériel à acheter). Par défaut (ancien format, clim, gainable…) : comme avant. */
    var feeOf=function(x){ var m=MODS[x.module], f=null; try{ f=m&&m.fees?m.fees((d.lots||[])[x.i]||{}):null; }catch(e){} return Object.assign({admin:true,commande:true,secu:true,achat:true},f||{}); };
    var fz=lots.map(feeOf), anyF=function(k){ return !lots.length||fz.some(function(f){ return f[k]; }); };
    var prepH=num(cm.prepH), achatH=num(cm.achatH), savPct=num(cm.savPct);
    if(achatH>0&&!anyF('achat')){ warnings.push('Achat du matériel ('+fq(achatH)+' h) non compté : aucune pièce à acheter'); achatH=0; }
    if(prepH>0) addC('Pose & main-d’œuvre','Préparation du chantier',fq(prepH)+' h × '+money(rate)+'/h',prepH*rate,0,{qte:prepH,unite:'h',pu:rate,mo:true});
    if(achatH>0) addC('Pose & main-d’œuvre','Achat et enlèvement du matériel',fq(achatH)+' h × '+money(rate)+'/h',achatH*rate,0,{qte:achatH,unite:'h',pu:rate,mo:true});
    heures+=prepH+achatH;
    var savBase=sum(lots,function(x){return x.detailH;})+prepH+achatH;
    if(savPct>0&&savBase>0){ var hs=savBase*savPct/100; addC('Pose & main-d’œuvre','Provision SAV / garantie ('+fq(savPct)+' %)',fq(r2(hs))+' h × '+money(rate)+'/h',hs*rate,0,{qte:hs,unite:'h',pu:rate,mo:true}); heures+=hs; }
    var nD=Math.max(1,Math.round(num(d.nbDepl))||1), zp=zonePrice(d);
    if(zp>0) addC('Mise en service & déplacement','Déplacement',(d.zone||'')+(d.zone==='+60 km'?' ('+fq(num(d.km))+' km)':'')+(nD>1?' × '+nD+' déplacements':''),zp*nD,0,{qte:nD,unite:nD>1?'u':'forfait',pu:zp});
    if(anyF('admin')) addC('Frais & divers','Frais administratifs devis','',P.fraisAdmin,P.fraisAdmin);
    if(anyF('commande')) addC('Frais & divers','Frais commande matériel','',P.fraisCommande,P.fraisCommande);
    var sub0=sum(lots.filter(function(x,k){ return fz[k].secu; }),function(x){ return x.ht; })+sum(common,function(l){return l.ht;});
    if(!lots.length) sub0=sum(common,function(l){return l.ht;});
    if(lots.length&&!anyF('secu')) sub0=0;
    var secu=sub0*((P.marges&&P.marges.securite)||0)/100;
    if(secu>0) addC('Frais & divers','Marge sécurité ('+P.marges.securite+'%)','imprévus',secu,0);
    var all=lines.concat(common);
    var totalHT=sum(all,function(l){return l.ht;});
    var fr=franchise(), tva=0, parts={}, lotsHT=sum(lots,function(x){return x.ht;}), commonHT=sum(common,function(l){return l.ht;});
    lots.forEach(function(x){
      var share=lotsHT>0?commonHT*x.ht/lotsHT:(lots.length?commonHT/lots.length:0);
      x.commonShare=share;
      if(fr){ x.tva=0; return; }
      var t=tvaOfLot(x.tvaMode,x.lines,share); x.tva=t.tva; x.parts=t.parts; tva+=t.tva;
      Object.keys(t.parts).forEach(function(k){ parts[k]=(parts[k]||0)+t.parts[k]; });
    });
    if(!fr&&!lots.length&&commonHT>0){ var tr=num(P.tva); tva+=commonHT*tr/100; parts[String(tr)]=(parts[String(tr)]||0)+commonHT; }
    var secPct=((P.marges&&P.marges.securite)||0)/100;
    options.forEach(function(x){
      x.htBase=x.ht; var lot=(d.lots||[])[x.i], done=false;
      /* = ce que l'option ajoute vraiment au total si le client la coche : on refait le calcul complet avec l'option dedans
         (frais de commande, achat du matériel, SAV, marge de sécurité, déductions « une fois par devis », TVA) */
      if(!d._altCalc&&lot&&!lot.alt){ try{
        var dd=JSON.parse(JSON.stringify(d)); dd._altCalc=true; dd.lots[x.i].option=false; dd.lots=dd.lots.filter(function(l){ return !l.option; });
        var ro=computeV2(dd); x.ht=ro.totalHT-totalHT; x.ttc=ro.totalTTC-(totalHT+tva); x.tva=x.ttc-x.ht; done=true; }catch(e){} }
      if(!done){ var sav=savPct>0?x.detailH*savPct/100*rate:0, sp=feeOf(x).secu?secPct:0;
        x.ht=(x.htBase+sav)*(1+sp); x.tva=fr?0:tvaOfLot(x.tvaMode,x.lines,x.ht-x.htBase).tva; x.ttc=x.ht+x.tva; }
    });
    /* solution alternative (réparer OU remplacer) : son vrai prix = le total du devis si elle remplace l'autre solution */
    options.forEach(function(x){
      var lot=(d.lots||[])[x.i]; if(!lot||!lot.alt||d._altCalc) return;
      try{
        var k=(d.lots||[]).findIndex(function(l){ return l.id===lot.alt; }), dd=JSON.parse(JSON.stringify(d)); dd._altCalc=true;
        dd.lots[x.i].option=false; delete dd.lots[x.i].alt; if(k>=0) dd.lots[k].option=true;
        dd.lots=dd.lots.filter(function(l){ return !l.option; });
        var rr=computeV2(dd); x.alt=true; x.altOf=k; x.altTitre=k>=0?(d.lots[k].titre||('lot '+(k+1))):''; x.altTotalHT=rr.totalHT; x.altTotalTTC=rr.totalTTC;
      }catch(e){}
    });
    (d.lots||[]).forEach(function(l,i){ if(!l.alt) return; var o=(d.lots||[]).find(function(q){ return q.id===l.alt; }); if(!o) return;
      if(!l.option&&!o.option) warnings.push('Les deux solutions (« '+(o.titre||'1')+' » et « '+(l.titre||'2')+' ») sont dans le total : garde-en une seule (« Retenir cette solution »)');
      if(l.option&&o.option) warnings.push('Aucune des deux solutions (« '+(o.titre||'1')+' » / « '+(l.titre||'2')+' ») n\'est dans le total'); });
    var modes=lots.map(function(x){return x.tvaMode;}).filter(function(v,i,a){return a.indexOf(v)===i;});
    var tvaRate=fr?0:(modes.length===1?(modes[0]==='mixte'?'20/10':num(modes[0])):Object.keys(parts).map(function(k){return k.replace('.',',');}).join(' / '));
    var totalTTC=totalHT+tva;
    var costFactor=fr?(1+(Number(P.achatTVA)||0)/100):1;
    var matAchat=sum(all,function(l){return l.achat;})*costFactor;
    var moAchat=heures*(Number(P.coutInterne)||0);
    var coutReel=matAchat+moAchat, benefice=totalHT-coutReel;
    var margePct=totalHT>0?benefice/totalHT*100:0, gainH=heures>0?benefice/heures:0;
    var cotis=totalHT*(Number(P.cotisTaux)||0)/100, benefNet=benefice-cotis, gainHNet=heures>0?benefNet/heures:0;
    /* un contrat d'entretien se facture chaque année depuis l'onglet Contrats : il ne fait pas partie de ce qui se facture sur le devis */
    var ctrLots=lots.filter(function(x){ var l=(d.lots||[])[x.i]; return l&&l.module==='entretien'&&l.data&&!l.data.legacyCopy&&l.data.format==='contrat'; });
    var ctrTTC=sum(ctrLots,function(x){ return (x.ht||0)+(x.commonShare||0)+(x.tva||0); }), billTTC=Math.max(0,totalTTC-ctrTTC);
    var acomptePct=d.acompteOn?num(d.acomptePct):0, acompte=billTTC*acomptePct/100, solde=billTTC-acompte;
    /* montant gardé à l'envoi (next-fiabilite) : le devis a-t-il bougé depuis ? */
    if(d.figEnv&&!d._altCalc&&Math.abs(Math.round(billTTC*100)/100-num(d.figEnv.bill))>0.01) warnings.unshift('Montant différent de celui '+(d.figEnv.statut==='accepte'?'accepté par':'envoyé à')+' ton client : '+money(num(d.figEnv.bill))+' le '+new Date(num(d.figEnv.at)).toLocaleDateString('fr-FR')+', '+money(billTTC)+' maintenant. Renvoie-lui le devis (ou fais-lui valider la nouvelle version) avant de facturer.');
    var mo=sum(all.filter(function(l){return l.mo;}),function(l){return l.ht;});
    var tvaBreak=Object.keys(parts).map(function(k){ return {rate:num(k),base:parts[k],tva:parts[k]*num(k)/100}; }).sort(function(a,b){return b.rate-a.rate;});
    /* TVA de ce qui se facture sur le devis (sans le contrat d'entretien), taux par taux : pour les factures d'acompte et de solde */
    var bp={}; lots.forEach(function(x){ if(ctrLots.indexOf(x)>=0||!x.parts) return; Object.keys(x.parts).forEach(function(k){ bp[k]=(bp[k]||0)+x.parts[k]; }); });
    var billBreak=Object.keys(bp).map(function(k){ return {rate:num(k),base:bp[k],tva:bp[k]*num(k)/100}; }).filter(function(t){ return Math.abs(t.base)>0.005; }).sort(function(a,b){return b.rate-a.rate;});
    return {v:2,lines:all,mat:mat,totalHT:totalHT,tva:tva,tvaRate:tvaRate,tvaBreak:tvaBreak,franchise:fr,totalTTC:totalTTC,
      coutReel:coutReel,matAchat:matAchat,moAchat:moAchat,benefice:benefice,margePct:margePct,gainH:gainH,cotis:cotis,
      benefNet:benefNet,gainHNet:gainHNet,mo:mo,heures:heures,rate:rate,acomptePct:acomptePct,acompte:acompte,solde:solde,billTTC:billTTC,billBreak:billBreak,ctrTTC:ctrTTC,ctrHT:sum(ctrLots,function(x){ return (x.ht||0)+(x.commonShare||0); }),ctrAll:ctrLots.length>0&&ctrLots.length===lots.length,
      lots:lots,common:common,options:options,warnings:warnings,nbDepl:nD,joursEstim:Math.max(1,Math.ceil(heures/(CFG().hPerDay||6)))};
  }
  window.compute=function(d){ return (d&&d.v===2)?computeV2(d):LEGACY(d); };
  window.compute._nxd2=true;

  /* ---------------- dérivés (type, heures, numéro) ---------------- */
  function lotTypeLabel(lot){ var m=MODS[lot.module]; try{ return m&&m.typeLabel?m.typeLabel(lot):natureOf(lot.module).label; }catch(e){ return natureOf(lot.module).label; } }
  function mainCode(d){
    var ms=(d.lots||[]).filter(function(l){return !l.option;}).map(function(l){return l.module;});
    if(!ms.length) ms=(d.lots||[]).map(function(l){return l.module;});
    var u=ms.filter(function(v,i,a){return a.indexOf(v)===i;});
    return u.length>1?'MIX':(u.length?natureOf(u[0]).code:'DV');
  }
  function numFor(d){ return 'DV-'+ymd(d.created)+'-'+mainCode(d)+'-'+newId(); }
  function numLocked(d){ return !!(d.updatedAt||d.sentAt||d.signLink||d.signature||d.facAcompte||d.facSolde||(d.statut&&d.statut!=='brouillon')); }
  function derive(d){
    if(!d||d.v!==2) return d;
    var real=(d.lots||[]).filter(function(l){return !l.option;});
    var labs=real.map(lotTypeLabel).filter(function(v,i,a){return a.indexOf(v)===i;});
    d.type=labs.length?labs.join(' + '):'Devis';
    var c; try{ c=computeV2(d); }catch(e){ c=null; }
    if(c) d.heures=r2(c.heures);
    d.machines=[]; real.forEach(function(l){ ((l.data&&l.data.machines)||[]).forEach(function(m){ if(m&&(m.marque||m.ref||num(m.achat))) d.machines.push({marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:num(m.marge)}); }); });
    if(!numLocked(d)){
      var code=mainCode(d), m=/^DV-(\d{8})-([A-Z]{2,3})-([A-Z0-9]+)$/.exec(d.num||'');
      if(m && m[2]!==code) d.num='DV-'+m[1]+'-'+code+'-'+m[3];
    }
    return d;
  }

  /* ---------------- champs posés par d'autres écrans : jamais écrasés à l'enregistrement ---------------- */
  var OWNED=['facAcompte','facSolde','signature','signLink','relances','datePlanif','matReserve','hReel','achatReel','figEnv'];
  function protect(c){
    try{
      var e=(DEVIS||[]).find(function(x){ return x.id===c.id; }); if(!e) return c;
      OWNED.forEach(function(k){
        if(e[k]==null) return;
        if(k==='relances'){ if(!Array.isArray(c.relances)||c.relances.length<e.relances.length) c.relances=clone(e.relances); return; }
        if(c[k]==null||c[k]==='') c[k]=clone(e[k]);
      });
      if(e.signature && !c.signature) c.signature=clone(e.signature);
      /* contrats déjà créés depuis ce devis (module Entretien) : l'éditeur ne doit jamais les « oublier » */
      if(Array.isArray(e.ctrFaits)){ var cf=Array.isArray(c.ctrFaits)?c.ctrFaits.slice():[]; e.ctrFaits.forEach(function(k){ if(cf.indexOf(k)<0) cf.push(k); }); c.ctrFaits=cf; }
      ['refus','acceptedAt'].forEach(function(k){ if(e[k]!=null&&c[k]==null) c[k]=clone(e[k]); });
      /* un statut posé ailleurs (signature, liste, mail, relance) ne recule jamais, sauf changement fait exprès dans l'éditeur */
      var RK={brouillon:0,verifier:0,pret:0,envoye:1,accepte:2,refuse:2};
      if(c.v===2){
        if(!c._statutSet){
          if(c._baseStatut!==undefined && e.statut!==c._baseStatut) c.statut=e.statut;       /* changé ailleurs depuis l'ouverture */
          else if((RK[e.statut]||0)>(RK[c.statut]||0)) c.statut=e.statut;
        }
      } else if(e.signature && e.statut==='accepte' && c.statut!=='accepte' && c.statut!=='refuse') c.statut='accepte';   /* ancien formulaire : seul le cas « signé en ligne » */
      if(e.sentAt && !c.sentAt) c.sentAt=e.sentAt;
    }catch(err){}
    return c;
  }
  function syncCurFromStore(){
    try{
      if(!cur) return; var e=(DEVIS||[]).find(function(x){ return x.id===cur.id; }); if(!e) return;
      ['facAcompte','facSolde','hReel','achatReel','signature','signLink','sentAt'].forEach(function(k){ if(e[k]!=null) cur[k]=clone(e[k]); });
      if(e.signature && e.statut==='accepte') cur.statut='accepte';
    }catch(err){}
  }
  /* correctif ancien formulaire : facturer depuis le récap puis enregistrer ne perd plus la facture */
  ['facturerDevis','payerFacture'].forEach(function(fn){
    var o=window[fn]; if(typeof o!=='function') return;
    window[fn]=function(){
      try{
        if(fn==='facturerDevis'&&cur&&cur.id===arguments[0]){
          var saved=(DEVIS||[]).some(function(x){ return x.id===cur.id; });
          if(cur.v===2){ if((dirty||!saved)&&!saveV2(true)) return; }
          else if(window._curView==='wizard'){ /* ancien formulaire : on enregistre l'écran tel quel, sans quitter */
            formToDevis(); protect(cur); var i=DEVIS.findIndex(function(x){ return x.id===cur.id; }); var cp=clone(cur);
            if(i>=0) DEVIS[i]=cp; else DEVIS.push(cp); persist(LS.devis,DEVIS);
          }
        }
      }catch(e){}
      var r=o.apply(this,arguments); try{ syncCurFromStore(); if(typeof renderFBloc==='function') renderFBloc(); if(window._curView===VIEW) refreshLive(); }catch(e){} return r; };
  });

  /* ---------------- brouillon local (rien ne se perd si on quitte sans enregistrer) ---------------- */
  var dirty=false, draftT=0;
  function markDirty(){ dirty=true; clearTimeout(draftT); draftT=setTimeout(saveDraft,400); }
  /* un brouillon par devis (les 8 plus récents), pour ne jamais écraser un travail en cours par un autre */
  function drafts(){ var x=lsGet(DRAFTK,{}); if(!x||typeof x!=='object'||Array.isArray(x)) return {}; if(x.cur&&x.id){ var o={}; o[x.id]=x; return o; } return x; }
  function saveDraft(){ try{ if(!(cur&&cur.v===2&&dirty)) return; var m=drafts(); m[cur.id]={id:cur.id,at:Date.now(),cur:cur};
    var ids=Object.keys(m).sort(function(a,b){ return m[b].at-m[a].at; }); ids.slice(8).forEach(function(k){ delete m[k]; }); lsSet(DRAFTK,m); }catch(e){} }
  function getDraft(id){ var m=drafts(); if(id) return m[id]&&m[id].cur&&m[id].cur.v===2?m[id]:null;
    var l=Object.keys(m).map(function(k){ return m[k]; }).filter(function(x){ return x&&x.cur&&x.cur.v===2; }).sort(function(a,b){ return b.at-a.at; }); return l[0]||null; }
  function newDrafts(){ var m=drafts(); return Object.keys(m).map(function(k){ return m[k]; }).filter(function(x){ return x&&x.cur&&x.cur.v===2&&!(DEVIS||[]).some(function(d){ return d.id===x.id; }); }).sort(function(a,b){ return b.at-a.at; }); }
  function dropDraft(id){ try{ var m=drafts(); delete m[id||(cur&&cur.id)]; if(Object.keys(m).length) lsSet(DRAFTK,m); else localStorage.removeItem(DRAFTK); }catch(e){} }

  /* ---------------- création / ouverture ---------------- */
  function defaultsCommon(){ var c=CFG(); return {prepH:c.prepH,achatH:c.achatH,savPct:c.savPct}; }
  /* un devis commencé par une dépose, une mise en service ou une sous-traitance a préparation / achat / SAV à 0 :
     quand on y ajoute un lot qui en demande (clim, chambre…), on les remonte — jamais à la baisse, jamais sur une valeur saisie */
  function mergeCommon(d,modId){
    try{ var m=MODS[modId], t=Object.assign(defaultsCommon(),(m&&m.common)?m.common():{}), c=d.common||(d.common={}), up=[];
      [['prepH','préparation'],['achatH','achat du matériel'],['savPct','provision SAV']].forEach(function(k){ if(!(num(c[k[0]])>0)&&num(t[k[0]])>0){ c[k[0]]=t[k[0]]; up.push(k[1]); } });
      if(up.length) say('Ajouté pour ce lot : '+up.join(', ')+' (récapitulatif)');
      return up; }catch(e){ return []; }
  }
  function newLot(modId,opts){
    var m=MODS[modId]; opts=opts||{};
    var lot={id:newId(),module:modId,titre:opts.titre||'',option:false,tva:String(P.tva),data:m?m.defaults(opts):{},visite:{}};
    lot.exclusions=m&&m.exclusions?m.exclusions(lot):'';
    return lot;
  }
  function newDevisV2(modId,opts){
    opts=opts||{};
    var d={v:2,id:newId(),num:'',created:Date.now(),statut:'brouillon',
      cNom:'',cTel:'',cMail:'',cType:'Particulier',cAdr:'',cVille:'',cSiren:'',
      zone:'0-10 km',km:0,nbDepl:1,rateChoice:String(P.defaultRate),rateCustom:P.defaultRate,
      tvaRate:P.tva,acompteOn:false,acomptePct:P.acomptePctDefaut,estim:false,notes:'',
      common:defaultsCommon(),visite:{date:'',contact:'',notes:''},lots:[]};
    if(modId) d.lots.push(newLot(modId,opts));
    try{ if(modId&&MODS[modId]&&MODS[modId].common) Object.assign(d.common,MODS[modId].common()); }catch(e){}
    try{ if(modId&&MODS[modId]&&MODS[modId].onNewDevis) MODS[modId].onNewDevis(d); }catch(e){}
    if(opts.client) applyClient(d,opts.client);
    d.num=numFor(d);
    return derive(d);
  }
  function applyClient(d,name){
    var c=(CLIENTS||[]).find(function(x){ return (x.nom||'').toLowerCase()===String(name||'').trim().toLowerCase(); });
    d.cNom=name||d.cNom;
    if(!c) return false;
    d.cTel=c.tel||''; d.cMail=c.mail||''; d.cType=c.type||'Particulier'; d.cAdr=c.adr||''; d.cVille=c.ville||''; d.cSiren=c.siren||'';
    if(c.lastZone && (ZONES.indexOf(c.lastZone)>=0||(P.zone&&P.zone[c.lastZone]!=null))) d.zone=c.lastZone;
    return true;
  }

  var TAB='lots', fBlocHome=null;
  function openEditor(d,opt){
    opt=opt||{};
    ensureView();
    cur=d; dirty=!!opt.dirty; TAB=opt.tab||(d.lots&&d.lots.length?'lots':'client');
    go(VIEW);
    render();
    if(opt.banner) showBanner(opt.banner);
    if(dirty) saveDraft();
  }
  function openV2(id){
    var e=(DEVIS||[]).find(function(x){ return x.id===id; }); if(!e) return;
    var d=clone(e), dr=getDraft(id); d._baseStatut=e.statut;
    openEditor(d,{tab:'lots'});
    if(dr && dr.id===id && dr.at>(e.updatedAt||0) && JSON.stringify(dr.cur)!==JSON.stringify(e)){
      showBanner('<b>Modifications non enregistrées</b> du '+new Date(dr.at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' retrouvées. '+
        '<button class="nx-sbtn mar" onclick="nxd2.resumeDraft()">Les reprendre</button> <button class="nx-sbtn" onclick="nxd2.dropDraft()">Les ignorer</button>');
    }
  }

  /* ---------------- enregistrement ---------------- */
  function saveV2(silent){
    if(!cur||cur.v!==2) return false;
    if(!String(cur.cNom||'').trim()&&!confirm('Nom client vide. Enregistrer quand même ?')){ TAB='client'; renderBody(); return false; }
    protect(cur); derive(cur); cur.updatedAt=Date.now(); delete cur._statutSet;
    if(cur.statut==='envoye'&&!cur.sentAt) cur.sentAt=Date.now();
    try{ upsertClient();
      /* la fiche client garde une zone que l'ancien formulaire connaît (sinon il retomberait sur 0-10 km) */
      var cl=(CLIENTS||[]).find(function(x){ return (x.nom||'').toLowerCase()===String(cur.cNom||'').toLowerCase(); });
      if(cl&&cl.lastZone&&!(P.zone&&P.zone[cl.lastZone]!=null)){ cl.lastZone='+50 km'; persist(LS.clients,CLIENTS); }
    }catch(e){}
    var inbox=cur._inboxId; delete cur._inboxId;
    var copy=clone(cur), i=DEVIS.findIndex(function(x){ return x.id===cur.id; });
    delete copy._baseStatut; delete copy._statutSet; cur._baseStatut=cur.statut;
    if(i>=0) DEVIS[i]=copy; else DEVIS.push(copy);
    persist(LS.devis,DEVIS);
    rememberDefaults(cur);
    dirty=false; dropDraft(cur.id);
    try{ updateBadges(); }catch(e){}
    if(inbox && typeof window.nxaInboxValidated==='function'){ try{ window.nxaInboxValidated(inbox); }catch(e){} }
    say('💾 Devis '+cur.num+' enregistré');
    render();
    return true;
  }
  function rememberDefaults(d){
    try{
      var all=DEFS();
      (d.lots||[]).forEach(function(l){ var m=MODS[l.module]; if(m&&m.remember){ var k=m.remember(l); if(k){ all[l.module]=Object.assign(all[l.module]||{},k); } } });
      persist(DEFK,all);
    }catch(e){}
  }

  /* ---------------- aiguillage des fonctions existantes ----------------
     Installé au chargement complet de la page, APRÈS les couches next-addons / next-regime
     (posées au DOMContentLoaded) : un devis au nouveau format ne traverse jamais le code
     de l'ancien formulaire (lecture du DOM, défauts mémorisés par type…). */
  function installDispatch(){
    if(window.saveDevis&&window.saveDevis._nxd2) return;
    var _open=window.openDevis;
    window.openDevis=function(id){
      try{ if(window._curView===VIEW) saveDraft(); }catch(err){}
      var e=(DEVIS||[]).find(function(x){ return x.id===id; });
      if(e&&e.v===2) return openV2(id);
      return _open.apply(this,arguments);
    };
    var _form=window.formToDevis;
    window.formToDevis=function(){ if(cur&&cur.v===2) return; return _form.apply(this,arguments); };
    var _load=window.loadDevisToForm;
    window.loadDevisToForm=function(){ if(cur&&cur.v===2) return; return _load.apply(this,arguments); };
    var _recalc=window.recalc;
    window.recalc=function(){ if(cur&&cur.v===2){ refreshLive(); return; } return _recalc.apply(this,arguments); };
    var _save=window.saveDevis;
    window.saveDevis=function(){
      if(cur&&cur.v===2) return saveV2();
      try{ if(cur) protect(cur); }catch(e){}
      return _save.apply(this,arguments);
    };
    window.saveDevis._nxd2=true;
    var _print=window.printDevis;
    window.printDevis=function(){ if(cur&&cur.v===2) return printV2(cur); return _print.apply(this,arguments); };
    var _fac=window.nxFacturer;   /* « Facturer » depuis la liste : ouvre le récapitulatif du devis v2 */
    if(typeof _fac==='function') window.nxFacturer=function(id){ var e=(DEVIS||[]).find(function(x){ return x.id===id; }); if(e&&e.v===2){ openV2(id); nxd2.tab('recap'); return; } return _fac.apply(this,arguments); };
    var _chk=window.printChecklist;
    if(typeof _chk==='function') window.printChecklist=function(){ if(cur&&cur.v===2) derive(cur); return _chk.apply(this,arguments); };
  }
  var _busy=window.cpBusyForm;
  if(typeof _busy==='function') window.cpBusyForm=function(){ return window._curView===VIEW||_busy.apply(this,arguments); };
  var _go=window.go;
  window.go=function(v){
    var held=false;
    try{
      if(v!==VIEW && window._curView===VIEW){ saveDraft(); if(dirty) say('Modifications gardées en brouillon — rouvre le devis pour les reprendre'); dirty=false; }
      if(v===VIEW && typeof _cpPendingReload!=='undefined' && _cpPendingReload){ held=true; _cpPendingReload=false; }
      if(v==='wizard'){ if(cur&&cur.v===2) cur=null; restoreFBloc(); }
    }catch(e){}
    var r=_go.apply(this,arguments);
    try{ if(held) _cpPendingReload=true; }catch(e){}
    try{ var fab=document.getElementById('nxaFab'); if(fab&&v===VIEW) fab.style.display='none'; }catch(e){}
    return r;
  };
  try{ if(typeof TITLES!=='undefined') TITLES[VIEW]=['Devis','Un devis adapté à la nature du chantier — le calcul se fait tout seul.']; }catch(e){}

  /* ---------------- éditeur ---------------- */
  var CSS=''+
    '#v-nx_devis2{padding-bottom:84px}body:has(#v-nx_devis2.active) #nxaFab{display:none!important}'+
    '.nxd2-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px}'+
    '.nxd2-head h2{font-size:20px;margin:0}.nxd2-head .sub{font-size:12.5px}'+
    '.nxd2-tabs{display:flex;gap:6px;overflow-x:auto;margin:6px 0 12px;padding-bottom:2px}'+
    '.nxd2-tabs button{flex:none;border:1px solid var(--line2,#cfd8e3);background:var(--card,#fff);border-radius:20px;padding:7px 14px;font:inherit;font-size:13.5px;cursor:pointer;color:inherit}'+
    '.nxd2-tabs button.on{background:var(--blue,#121417);border-color:var(--blue,#121417);color:#fff;font-weight:600}'+
    '.nxd2-lot{border:1px solid var(--line2,#cfd8e3);border-radius:12px;margin-bottom:16px;background:var(--card,#fff);overflow:hidden}'+
    '.nxd2-lothd{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;padding:10px 14px;background:var(--blue-soft,#eef3fa);border-bottom:1px solid var(--line2,#cfd8e3)}'+
    '.nxd2-lothd .nat{font-weight:700;color:var(--blue,#121417)}.nxd2-lothd input[type=text]{flex:1;min-width:140px}'+
    '.nxd2-lothd .tot{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums}'+
    '.nxd2-lotbd{padding:12px 14px}'+
    '.nxd2-sec{margin:4px 0 14px}.nxd2-sec>h3{font-size:13.5px;color:var(--blue,#121417);margin:10px 0 8px;text-transform:none}'+
    '.nxd2-row{border:1px solid var(--line,#e3e8ef);border-radius:10px;padding:8px 10px;margin-bottom:8px;position:relative}'+
    '.nxd2-row .del{position:absolute;right:6px;top:6px}'+
    '.nxd2-mo{width:100%;border-collapse:collapse;font-size:13.5px}.nxd2-mo td,.nxd2-mo th{padding:6px 6px;border-bottom:1px solid var(--line,#e3e8ef);text-align:right;vertical-align:middle}'+
    '.nxd2-mo td:first-child,.nxd2-mo th:first-child{text-align:left}.nxd2-mo input{width:74px;text-align:right}'+
    '.nxd2-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--card,#fff);border-top:1px solid var(--line2,#cfd8e3);padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:0 -6px 18px rgba(15,30,60,.08)}'+
    '.nxd2-bar .t{font-variant-numeric:tabular-nums;font-size:13.5px;min-width:0}.nxd2-bar .t b{font-size:16px}'+
    '.nxd2-bar{left:0}@media(min-width:861px){.nxd2-bar{left:268px}}'+
    '.nxd2-warn{border-left:4px solid var(--orange,#d97706);background:var(--orange-soft,#fff7e6);padding:8px 12px;border-radius:8px;margin:6px 0;font-size:13.5px}'+
    '.nxd2-warn.red{border-left-color:var(--red,#c0392b);background:#fdecea}'+
    '.nxd2-ok{border-left:4px solid var(--green,#189a58);background:#eaf7ef;padding:8px 12px;border-radius:8px;margin:6px 0;font-size:13.5px}'+
    '.nxd2-banner{border:1px solid #bcd3ff;background:var(--blue-soft,#eef3fa);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:13.5px;position:relative}'+
    '.nxd2-banner .x{position:absolute;right:8px;top:6px;border:0;background:none;font-size:16px;cursor:pointer}'+
    '.nxd2-ov{position:fixed;inset:0;z-index:9990;background:rgba(10,25,45,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}'+
    '.nxd2-box{background:var(--card,#fff);color:inherit;border-radius:14px;max-width:760px;width:100%;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)}'+
    '.nxd2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:12px 0}'+
    '.nxd2-tile{border:1px solid var(--line2,#cfd8e3);border-radius:12px;padding:12px;text-align:left;background:var(--card,#fff);cursor:pointer;font:inherit;color:inherit;display:grid;gap:2px}'+
    '.nxd2-tile:hover{border-color:var(--blue,#121417)}.nxd2-tile b{font-size:14.5px}.nxd2-tile span{font-size:12.5px;color:var(--muted,#5f6f84)}'+
    '.nxd2-tile .pill{justify-self:start;font-size:11px;border-radius:10px;padding:1px 8px;margin-top:4px;background:var(--blue-soft,#eef3fa);color:var(--blue,#121417)}'+
    '.nxd2-tile.old .pill{background:#f1f3f6;color:var(--muted,#5f6f84)}'+
    '.nxd2-seg{display:inline-flex;border:1px solid var(--line2,#cfd8e3);border-radius:10px;overflow:hidden}'+
    '.nxd2-seg button{border:0;background:none;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer;color:inherit}.nxd2-seg button.on{background:var(--blue,#121417);color:#fff}'+
    '.nxd2-chk,label.nxd2-chk{display:flex!important;flex-direction:row!important;gap:8px;align-items:center;font-size:13.5px;margin:4px 0;text-transform:none!important;letter-spacing:0!important;font-weight:500!important;color:inherit!important}'+
    '.nxd2-chk input{width:18px!important;height:18px;margin:0;flex:none}'+
    '.nxd2-task{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line,#e3e8ef);font-size:13.5px}'+
    '.nxd2-task .l{flex:1 1 200px;min-width:0}.nxd2-task .l input{width:100%}.nxd2-task .v{display:flex;gap:6px;align-items:center;white-space:nowrap;margin-left:auto}'+
    '.nxd2-task .v input{width:72px;text-align:right}.nxd2-task.tot{border-bottom:0;font-weight:700}'+
    '.nxd2-hint{font-size:12.5px;color:var(--muted,#5f6f84);margin:4px 0}';

  function root(){ return document.getElementById('v-'+VIEW); }
  function ensureView(){
    if(!document.getElementById('nxd2Style')){ var st=document.createElement('style'); st.id='nxd2Style'; st.textContent=CSS; document.head.appendChild(st); }
    if(root()) return;
    var dash=document.getElementById('v-dash'), parent=dash?dash.parentNode:document.querySelector('.content'); if(!parent) return;
    var s=document.createElement('section'); s.className='view'; s.id='v-'+VIEW;
    s.innerHTML='<div id="nxd2Banner"></div><div id="nxd2Head"></div><div class="nxd2-tabs" id="nxd2Tabs"></div><div id="nxd2Body"></div><div class="nxd2-bar" id="nxd2Bar"></div>';
    parent.appendChild(s);
    s.addEventListener('input',function(e){ var el=e.target; if(!el.dataset||!el.dataset.k) return; if(el.tagName==='SELECT'||el.type==='checkbox'||el.type==='radio') return; apply(el,false); });
    s.addEventListener('change',function(e){ var el=e.target; if(!el.dataset||!el.dataset.k) return; apply(el,true); });
  }
  function apply(el,isChange){
    if(!cur||cur.v!==2) return;
    var k=el.dataset.k, t=el.dataset.t||'s', v;
    if(t==='b') v=!!el.checked; else if(t==='n') v=num(el.value); else v=el.value;
    var lotEl=el.closest('[data-lot]'), li=lotEl?+lotEl.dataset.lot:-1;
    if(k.indexOf('$.')===0) setPath(cur,k.slice(2),v);
    else if(li>=0&&cur.lots[li]) setPath(cur.lots[li],k,v);
    else return;
    var hook=el.dataset.on;
    if(hook){ try{ HOOKS[hook](li,el,v,isChange); }catch(err){} }
    markDirty();
    if(isChange&&el.dataset.re){ rerender(el.dataset.re,li); }
    refreshLive();
  }
  var HOOKS={
    client:function(li,el,v,chg){ if(!chg) { updHead(); return; } if(applyClient(cur,v)){ say('Client « '+v+' » chargé'); rerender('tab'); } updHead(); },
    zone:function(){ rerender('tab'); }
  };
  function modHook(name,fn){ HOOKS[name]=fn; }
  function rerender(what,li){
    if(what==='tab') return renderBody();
    if(what==='lot'&&li>=0){ var el=document.querySelector('#v-'+VIEW+' [data-lot="'+li+'"] .nxd2-lotbd'); if(el){ el.innerHTML=lotBody(li); return; } }
    if(what.indexOf('#')===0){ var m=MODS[cur.lots[li]&&cur.lots[li].module], box=document.getElementById(what.slice(1)); if(box&&m&&m.renderPart){ box.innerHTML=m.renderPart(what.slice(1),cur.lots[li],li,api); return; } }
    renderBody();
  }
  function render(){
    ensureView(); if(!cur||cur.v!==2) return;
    updHead(); renderTabs(); renderBody(); refreshLive();
  }
  function updHead(){
    var h=document.getElementById('nxd2Head'); if(!h||!cur) return;
    var st=''; try{ st=statusTag(cur.statut); }catch(e){ st=cur.statut; }
    var saved=(DEVIS||[]).some(function(x){ return x.id===cur.id; });
    h.innerHTML='<div class="nxd2-head"><div style="min-width:0"><h2>'+esc(cur.cNom||'Sans nom')+'</h2>'+
      '<div class="sub">Devis n° <b>'+esc(cur.num)+'</b> · '+esc(derive(cur).type)+(saved?'':' · <b>pas encore enregistré</b>')+'</div></div>'+
      '<div class="row-actions" style="flex-wrap:wrap">'+st+
      '<button class="btn-ghost btn-sm" onclick="nxd2.close()">Fermer</button>'+
      '<button class="btn-ghost btn-sm" onclick="printDevis()">📄 PDF</button>'+
      (typeof window.nxSaveCurrentTemplate==='function'?'<button class="btn-ghost btn-sm" onclick="nxSaveCurrentTemplate()" title="Enregistrer ce devis comme modèle réutilisable">⚡ Modèle</button>':'')+
      '<button class="btn-ghost btn-sm" onclick="nxd2.sign()">✍️ Signature</button>'+
      '<button class="btn-dark btn-sm" onclick="nxd2.save()">💾 Enregistrer</button></div></div>';
  }
  function renderTabs(){
    var t=document.getElementById('nxd2Tabs'); if(!t) return;
    var n=(cur.lots||[]).length;
    t.innerHTML=[['client','Client & chantier'],['visite','Visite technique'],['lots','Lots ('+n+')'],['recap','Récapitulatif']]
      .map(function(x){ return '<button type="button" class="'+(TAB===x[0]?'on':'')+'" onclick="nxd2.tab(\''+x[0]+'\')">'+x[1]+'</button>'; }).join('');
  }
  function renderBody(){
    var b=document.getElementById('nxd2Body'); if(!b) return;
    restoreFBloc();   /* toujours avant de réécrire le contenu, sinon le bloc facturation serait détruit */
    b.innerHTML=TAB==='client'?tabClient():TAB==='visite'?tabVisite():TAB==='recap'?tabRecap():tabLots();
    if(TAB==='recap') mountFBloc();
    renderTabs();
  }
  function showBanner(html){
    var b=document.getElementById('nxd2Banner'); if(!b) return;
    if(html&&html.nodeType){ b.innerHTML=''; b.appendChild(html); return; }
    b.innerHTML=html?'<div class="nxd2-banner">'+html+'<button class="x" onclick="this.parentNode.remove()">✕</button></div>':'';
  }

  /* --- briques de formulaire (liées au modèle par data-k) --- */
  function fIn(label,k,v,o){ o=o||{}; var t=o.t||'s';
    return '<label'+(o.full?' class="full"':'')+'>'+label+(o.note?' <span class="note-inline">'+o.note+'</span>':'')+
      '<input'+(t==='n'?' type="number" step="'+(o.step||'any')+'" min="'+(o.min!=null?o.min:0)+'" inputmode="decimal"':'')+(o.list?' list="'+o.list+'"':'')+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+
      ' data-k="'+k+'" data-t="'+t+'"'+(o.on?' data-on="'+o.on+'"':'')+(o.re?' data-re="'+o.re+'"':'')+' value="'+esc(v==null?'':v)+'"></label>'; }
  function fSel(label,k,v,opts,o){ o=o||{};
    var has=opts.some(function(x){ return String(Array.isArray(x)?x[0]:x)===String(v); });
    if(!has&&v!=null&&v!=='') opts=[[v,v+' (actuel)']].concat(opts);
    return '<label'+(o.full?' class="full"':'')+'>'+label+(o.note?' <span class="note-inline">'+o.note+'</span>':'')+'<select data-k="'+k+'" data-t="'+(o.t||'s')+'"'+(o.on?' data-on="'+o.on+'"':'')+(o.re?' data-re="'+o.re+'"':'')+'>'+
      opts.map(function(x){ var val=Array.isArray(x)?x[0]:x, lab=Array.isArray(x)?x[1]:x; return '<option value="'+esc(val)+'"'+(String(val)===String(v)?' selected':'')+'>'+esc(lab)+'</option>'; }).join('')+'</select></label>'; }
  function fChk(label,k,v,o){ o=o||{}; return '<label class="nxd2-chk"><input type="checkbox" data-k="'+k+'" data-t="b"'+(o.on?' data-on="'+o.on+'"':'')+(o.re?' data-re="'+o.re+'"':'')+(v?' checked':'')+'> <span>'+label+'</span></label>'; }
  function fArea(label,k,v,o){ o=o||{}; return '<label class="full">'+label+'<textarea rows="'+(o.rows||3)+'" data-k="'+k+'" data-t="s">'+esc(v||'')+'</textarea></label>'; }
  var api={esc:esc,num:num,r2:r2,fIn:fIn,fSel:fSel,fChk:fChk,fArea:fArea,money:money,fq:fq,clone:clone,sum:sum,mkLine:mkLine,LEGACY:function(o){ if(o&&o.v===2) throw new Error('boucle'); return window.compute(o); },
    DEFS:DEFS,CFG:CFG,markDirty:markDirty,rerender:rerender,refreshLive:refreshLive,hook:modHook,cur:function(){ return cur; },rateOf:rateOf};

  function tabClient(){
    var d=cur, pro=d.cType==='Professionnel';
    var dl='<datalist id="nxd2ClientDL">'+(CLIENTS||[]).map(function(c){ return '<option value="'+esc(c.nom||'')+'">'; }).join('')+'</datalist>';
    var zones=ZONES.slice(); if(d.zone&&zones.indexOf(d.zone)<0) zones.unshift(d.zone);
    var c=computeV2(d);
    return '<div class="card"><h2>👤 Client</h2>'+dl+
      '<div class="nxd2-hint">Tape le nom : si le client existe déjà, ses coordonnées se remplissent toutes seules.</div>'+
      '<div class="frm">'+
        fIn('Nom du client *','$.cNom',d.cNom,{list:'nxd2ClientDL',on:'client'})+
        fIn('Téléphone','$.cTel',d.cTel)+fIn('Email','$.cMail',d.cMail)+
        fSel('Type','$.cType',d.cType,['Particulier','Professionnel'],{re:'tab'})+
        fIn('Adresse du chantier *','$.cAdr',d.cAdr,{full:true})+fIn('Ville','$.cVille',d.cVille)+
        (pro?fIn('SIREN','$.cSiren',d.cSiren,{note:'client pro'}):'')+
      '</div></div>'+
      '<div class="card"><h2>🚐 Déplacements</h2><div class="frm">'+
        fSel('Distance du chantier','$.zone',d.zone,zones.map(function(z){ return [z,z+(z==='Aucun'?'':' — '+money(zonePrice({zone:z,km:d.km})))+(z==='+60 km'?' + '+fq(CFG().kmRate)+' €/km au-delà de 60':'')]; }),{on:'zone'})+
        (d.zone==='+60 km'?fIn('Distance aller (km)','$.km',d.km,{t:'n',step:1}):'')+
        fIn('Nombre de déplacements','$.nbDepl',d.nbDepl||1,{t:'n',step:1,min:1,note:'≈ '+c.joursEstim+' jour(s) de chantier d\'après les heures ('+fq(CFG().hPerDay)+' h/jour)'})+
      '</div>'+
      (d.zone==='Aucun'&&(d.cAdr||d.cVille)?'<div class="nxd2-warn">Déplacement non facturé alors qu\'une adresse de chantier est renseignée.</div>':'')+
      ((d.nbDepl||1)<c.joursEstim?'<div class="nxd2-warn">'+c.joursEstim+' jours de chantier estimés pour '+(d.nbDepl||1)+' déplacement(s) compté(s) — vérifie que tes trajets sont bien facturés.</div>':'')+
      '</div>';
  }
  function tabVisite(){
    var d=cur, v=d.visite||(d.visite={});
    var h='<div class="card"><h2>📋 Visite technique</h2><div class="nxd2-hint">Remplis sur place ou dicte ce que tu vois. Les réponses restent attachées au devis ; « Appliquer au devis » reporte ce qui a un impact direct sur le chiffrage.</div>'+
      '<div class="frm">'+fIn('Date de la visite','$.visite.date',v.date,{ph:'jj/mm/aaaa'})+fIn('Interlocuteur sur place','$.visite.contact',v.contact)+fArea('Notes générales','$.visite.notes',v.notes)+'</div>'+
      '<div class="row-actions" style="margin-top:8px"><button class="btn-ghost btn-sm" onclick="nxd2.printVisite(false)">🖨️ Fiche de visite remplie</button><button class="btn-ghost btn-sm" onclick="nxd2.printVisite(true)">🖨️ Fiche vierge à emporter</button></div></div>';
    (d.lots||[]).forEach(function(lot,i){
      var m=MODS[lot.module], qs=(m&&m.visite)||[];
      h+='<div class="card" data-lot="'+i+'"><h2>'+natureOf(lot.module).ico+' '+esc(natureOf(lot.module).label)+(lot.titre?' — '+esc(lot.titre):'')+'</h2>';
      if(!qs.length){ h+='<div class="nxd2-hint">Pas de questionnaire pour cette nature.</div></div>'; return; }
      h+='<div class="frm">'+qs.map(function(q){
        var val=(lot.visite||{})[q.k], k='visite.'+q.k;
        if(q.t==='sel') return fSel(q.l,k,val==null?'':val,q.o.map(function(o){ return [o,o||'—']; }),{full:q.full});
        if(q.t==='num') return fIn(q.l,k,val,{t:'n'});
        if(q.t==='area') return fArea(q.l,k,val);
        return fIn(q.l,k,val,{full:q.full});
      }).join('')+'</div>'+
      (m.applyVisite?'<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxd2.applyVisite('+i+')">↘ Appliquer au devis</button></div>':'')+'</div>';
    });
    if(!(d.lots||[]).length) h+='<div class="empty">Ajoute d\'abord un lot (onglet « Lots ») pour avoir le questionnaire adapté.</div>';
    return h;
  }
  function lotBody(i){
    var lot=cur.lots[i], m=MODS[lot.module];
    if(!m) return '<div class="nxd2-warn red">Ce lot utilise un module que cet appareil ne connaît pas. Mets ClimPilot à jour (rechargement) avant de le modifier.</div>';
    var fr=franchise();
    var tvaSel=fr?'':'<div class="frm">'+fSel('TVA du lot','tva',lot.tva||String(P.tva),[['20','20 %'],['10','10 %'],['5.5','5,5 %'],['mixte','20 % matériel / 10 % pose']])+'</div>';
    var mh=''; try{ mh=m.render(lot,i,api); }catch(e){ mh='<div class="nxd2-warn red">Affichage de ce lot impossible ('+esc(e&&e.message||e)+'). Tes données sont intactes : enregistre, recharge ClimPilot et préviens-moi si ça continue.</div>'; }
    return mh+
      '<div class="nxd2-sec"><h3>Travaux non compris (imprimé sur le devis)</h3><div class="frm">'+fArea('','exclusions',lot.exclusions,{rows:2})+'</div></div>'+tvaSel;
  }
  function tabLots(){
    var d=cur, h='';
    (d.lots||[]).forEach(function(lot,i){
      var n=natureOf(lot.module);
      h+='<div class="nxd2-lot" data-lot="'+i+'">'+
        '<div class="nxd2-lothd"><span class="nat">'+n.ico+' Lot '+(i+1)+' · '+esc(n.label)+'</span>'+
        '<input type="text" data-k="titre" data-t="s" placeholder="Titre (ex. : étage, véranda…)" value="'+esc(lot.titre||'')+'">'+
        (lot.alt&&lot.option?'<button type="button" class="btn-ghost btn-sm" title="Le client choisit cette solution : elle remplace l\'autre dans le total" onclick="nxd2.pickAlt('+i+')">✔ Retenir cette solution</button>'
          :'<label class="nxd2-chk" style="margin:0"><input type="checkbox" data-k="option" data-t="b"'+(lot.option?' checked':'')+'> option</label>')+
        '<span class="tot" id="nxd2LotTot'+i+'"></span>'+
        '<span class="row-actions">'+
          (i>0?'<button class="iconbtn" title="Monter" onclick="nxd2.moveLot('+i+',-1)">↑</button>':'')+
          (i<d.lots.length-1?'<button class="iconbtn" title="Descendre" onclick="nxd2.moveLot('+i+',1)">↓</button>':'')+
          '<button class="iconbtn" title="Dupliquer" onclick="nxd2.dupLot('+i+')">⧉</button>'+
          '<button class="iconbtn d" title="Supprimer le lot" onclick="nxd2.delLot('+i+')">🗑</button></span></div>'+
        '<div class="nxd2-lotbd">'+lotBody(i)+'</div></div>';
    });
    if(!(d.lots||[]).length) h+='<div class="empty">Aucun lot. Ajoute la première nature de travaux.</div>';
    h+='<button class="btn-pri" onclick="nxd2.addLot()">＋ Ajouter un lot</button>'+
      '<div class="nxd2-hint" style="margin-top:6px">Un lot = une nature de travaux (ex. : gainable à l\'étage + monosplit véranda). Coche « option » pour le chiffrer à part, hors total.</div>';
    return h;
  }

  function historyHours(type){
    var hs=(DEVIS||[]).filter(function(x){ return x.v!==2&&x.type===type&&num(x.heures)>0; }).map(function(x){ return num(x.heures); });
    if(!hs.length) return null;
    return {n:hs.length,avg:sum(hs)/hs.length,min:Math.min.apply(null,hs),max:Math.max.apply(null,hs)};
  }
  api.historyHours=historyHours;

  function tabRecap(){
    var d=cur, c=computeV2(d), cm=d.common||(d.common={}), fr=c.franchise;
    var rates=[]; try{ rates=(P.rates||[45]).filter(function(v,i,a){ return a.indexOf(v)===i; }); }catch(e){ rates=[45]; }
    var h='<div class="card"><h2>🧮 Main-d\'œuvre commune et conditions</h2><div class="frm">'+
      fSel('Taux horaire','$.rateChoice',d.rateChoice,rates.map(function(r){ return [String(r),r+' €/h']; }).concat([['custom','Personnalisé…']]),{re:'tab'})+
      (d.rateChoice==='custom'?fIn('Taux personnalisé (€/h HT)','$.rateCustom',d.rateCustom,{t:'n'}):'')+
      fIn('Préparation du chantier (h)','$.common.prepH',cm.prepH,{t:'n',step:0.25})+
      fIn('Achat / enlèvement du matériel (h)','$.common.achatH',cm.achatH,{t:'n',step:0.25})+
      fIn('Provision SAV (% des heures)','$.common.savPct',cm.savPct,{t:'n',step:1,note:'ton skill : 5 à 10 %'})+
      '</div>'+
      '<div class="frm" style="margin-top:6px">'+fChk('Acompte à la commande','$.acompteOn',d.acompteOn,{re:'tab'})+(d.acompteOn?fIn('Acompte (%)','$.acomptePct',d.acomptePct,{t:'n',step:1}):'')+
      fChk('Estimation indicative (PDF simplifié, non contractuel)','$.estim',d.estim)+fChk('Détailler les heures par tâche sur le PDF','$.pdfDetailMO',d.pdfDetailMO)+'</div>'+
      fArea('Notes internes (non imprimées)','$.notes',d.notes,{rows:2})+
      '<div style="margin-top:8px">Statut : <span class="nxd2-seg">'+['brouillon','envoye','accepte','refuse'].map(function(s){ return '<button type="button" class="'+(d.statut===s?'on':'')+'" onclick="nxd2.statut(\''+s+'\')">'+({brouillon:'Brouillon',envoye:'Envoyé',accepte:'Accepté',refuse:'Refusé'}[s])+'</button>'; }).join('')+'</span></div></div>';
    /* lignes */
    var byLot=function(lines){ return lines.map(function(l){ return '<div class="recap-line"><div class="lbl">'+esc(l.label)+(l.detail?' <span class="sub2">— '+esc(l.detail)+'</span>':'')+'</div><div>'+money(l.ht)+'</div></div>'; }).join(''); };
    h+='<div class="card"><h2>📑 Détail</h2>';
    c.lots.forEach(function(x){ h+='<h3 style="font-size:13.5px;color:var(--blue);margin:12px 0 4px">Lot '+(x.i+1)+' · '+esc(x.label)+(x.titre?' — '+esc(x.titre):'')+' <span style="float:right">'+money(x.ht)+'</span></h3>'+byLot(x.lines); });
    h+='<h3 style="font-size:13.5px;color:var(--blue);margin:12px 0 4px">Commun au devis <span style="float:right">'+money(sum(c.common,function(l){return l.ht;}))+'</span></h3>'+byLot(c.common);
    if(c.options.length){ h+='<h3 style="font-size:13.5px;color:var(--orange,#d97706);margin:12px 0 4px">Options et autres solutions (hors total)</h3>'+c.options.map(function(x){ return '<div class="recap-line"><div class="lbl">Lot '+(x.i+1)+' · '+esc(x.label)+(x.titre?' — '+esc(x.titre):'')+(x.alt?'<div class="sub2">à la place de « '+esc(x.altTitre)+' » : total du devis</div>':'')+'</div><div>'+money(x.alt?x.altTotalHT:x.ht)+' HT</div></div>'; }).join(''); }
    h+='</div>';
    /* totaux */
    h+='<div class="card"><h2>💰 Totaux</h2><div class="recap-line"><div class="lbl">Total HT</div><div><b>'+money(c.totalHT)+'</b></div></div>'+
      (fr?'<div class="recap-line"><div class="lbl">TVA</div><div class="sub2">non applicable — art. 293 B du CGI</div></div><div class="recap-line tot"><div class="lbl">Net à payer</div><div>'+money(c.totalHT)+'</div></div>'
        :c.tvaBreak.map(function(t){ return '<div class="recap-line"><div class="lbl">TVA '+String(t.rate).replace('.',',')+' % sur '+money(t.base)+'</div><div>'+money(t.tva)+'</div></div>'; }).join('')+'<div class="recap-line tot"><div class="lbl">Total TTC</div><div>'+money(c.totalTTC)+'</div></div>')+
      (c.acomptePct>0?'<div class="recap-line"><div class="lbl">Acompte ('+fq(c.acomptePct)+' %)</div><div style="font-weight:700;color:var(--blue)">'+money(c.acompte)+'</div></div><div class="recap-line"><div class="lbl">Solde fin de travaux</div><div>'+money(c.solde)+'</div></div>':'')+'</div>';
    /* santé */
    var low=c.margePct<20, lowH=c.gainH>0&&c.gainH<40;
    h+='<div class="card" id="nxd2Sante"><h2>📈 Santé du devis</h2>'+
      '<div class="recap-line"><div class="lbl">Déboursé sec<div class="sub2">matériel achat '+money(c.matAchat)+(fr?' (TVA d\'achat comprise, non récupérable)':'')+' + MO interne '+money(c.moAchat)+'</div></div><div>'+money(c.coutReel)+'</div></div>'+
      '<div class="recap-line"><div class="lbl">Bénéfice brut estimé</div><div style="color:var(--green);font-weight:700">'+money(c.benefice)+'</div></div>'+
      '<div class="recap-line"><div class="lbl">Marge</div><div style="font-weight:700;color:'+(low?'var(--red)':'var(--green)')+'">'+pct(c.margePct)+'</div></div>'+
      '<div class="recap-line"><div class="lbl">Gain / heure ('+fq(r2(c.heures))+' h)</div><div style="font-weight:700;color:'+(lowH?'var(--red)':'inherit')+'">'+money(c.gainH)+'/h</div></div>'+
      '<div class="recap-line"><div class="lbl">Cotisations micro ('+P.cotisTaux+' %)</div><div style="color:var(--red)">− '+money(c.cotis)+'</div></div>'+
      '<div class="recap-line tot"><div class="lbl">Reste net avant charges fixes</div><div>'+money(c.benefNet)+'</div></div>'+
      alerts(c).join('')+'</div>';
    /* matériel */
    h+='<div class="card"><h2>📦 Matériel à commander</h2>'+(c.mat.length?'<div class="scroll"><table><thead><tr><th class="l">Article</th><th>Qté</th><th>Achat U</th><th>Achat total</th><th>Vente HT</th></tr></thead><tbody>'+
      c.mat.map(function(x){ return '<tr><td class="l">'+esc(x.nom)+'</td><td>'+fq(x.qte)+' '+esc(x.unite)+'</td><td>'+money(x.achatU)+'</td><td>'+money(x.achatU*x.qte)+'</td><td>'+money(x.ht)+'</td></tr>'; }).join('')+'</tbody></table></div>':'<div class="empty">Pas de matériel chiffré.</div>')+'</div>';
    h+='<div class="row-actions" style="margin:6px 0 14px;flex-wrap:wrap"><button class="btn-ghost" onclick="printDevis()">📄 Aperçu / PDF</button><button class="btn-ghost" onclick="nxd2.mail()">✉️ Mail au client</button><button class="btn-pri" onclick="nxd2.sign()">✍️ Faire signer en ligne</button><button class="btn-ghost" onclick="printChecklist()">📋 Checklist départ</button><button class="btn-dark" onclick="nxd2.save()">💾 Enregistrer</button></div>';
    h+='<div id="nxd2FHost"></div>';
    return h;
  }
  /* les alertes rangées par gravité : ce qui fausse le montant d'abord, puis ce qui est compté 0 €, puis le reste */
  var RX_FIX=/compté deux fois|Montant différent|calcul impossible|non chiffré sur cet appareil|deux solutions|Aucune des deux solutions/i,
      RX_ZERO=/non compté|rien de compté|aucun[e]? [^:]*compté|n'est pas comptée|prix d'achat à saisir|absent de la base|0 € compté|coché mais 0 €|prix à saisir/i;
  function alertGroups(c){ var g={fix:[],zero:[],info:[]}, abs=[];
    (c.warnings||[]).forEach(function(w){ var m=/^(?:Lot \d+ — )?Article « (.+) » absent de la base de prix$/.exec(w); if(m){ if(abs.indexOf(m[1])<0) abs.push(m[1]); return; } (RX_FIX.test(w)?g.fix:RX_ZERO.test(w)?g.zero:g.info).push(w); });
    if(abs.length) g.zero.unshift(abs.length>1?abs.length+' articles absents de ta base de prix (comptés 0 €) : '+abs.join(' ; '):'Article « '+abs[0]+' » absent de ta base de prix (compté 0 €)'); if(c.margePct<20) g.fix.push('Marge sous 20 % : ce chantier semble sous-facturé.'); return g; }
  function alerts(c){
    var a=[], d=cur, hist, g=alertGroups(c), ttl=function(t,n){ return '<div style="font-weight:700;font-size:13px;margin:10px 0 2px">'+t+' ('+n+')</div>'; };
    if(g.fix.length) a.push(ttl('🔴 À corriger avant d\'envoyer',g.fix.length)+g.fix.map(function(w){ return '<div class="nxd2-warn red">'+esc(w)+'</div>'; }).join(''));
    if(g.zero.length) a.push(ttl('🟠 Comptés 0 € — à compléter ou à confirmer',g.zero.length)+g.zero.map(function(w){ return '<div class="nxd2-warn">'+esc(w)+'</div>'; }).join(''));
    if(g.info.length) a.push(ttl('À vérifier',g.info.length)+g.info.map(function(w){ return '<div class="nxd2-warn">'+esc(w)+'</div>'; }).join(''));
    if(c.gainH>0&&c.gainH<40) a.push('<div class="nxd2-warn">Gain horaire sous 40 €/h.</div>');
    if(rateOf(d)<num(P.defaultRate)) a.push('<div class="nxd2-warn">Taux horaire ('+money(rateOf(d))+') sous ton taux de référence ('+money(P.defaultRate)+').</div>');
    if((d.zone||'Aucun')==='Aucun') a.push('<div class="nxd2-warn">Déplacement non facturé.</div>');
    else if((c.nbDepl||1)<c.joursEstim) a.push('<div class="nxd2-warn">'+c.joursEstim+' jours de chantier estimés pour '+c.nbDepl+' déplacement(s) facturé(s).</div>');
    if(!num((d.common||{}).savPct)) a.push('<div class="nxd2-warn">SAV non provisionné.</div>');
    if(d.cType==='Professionnel'&&!c.franchise&&c.tvaBreak.some(function(t){ return t.rate<20; })) a.push('<div class="nxd2-warn">Client professionnel avec un taux réduit : vérifie qu\'il s\'applique (locaux d\'habitation uniquement).</div>');
    if(!a.length) a.push('<div class="nxd2-ok">✅ Marge, gain horaire, déplacements et SAV : rien à signaler.</div>');
    return a;
  }
  function refreshLive(){
    if(!cur||cur.v!==2||window._curView!==VIEW) return;
    var c; try{ c=computeV2(cur); }catch(e){ return; }
    var bar=document.getElementById('nxd2Bar');
    if(bar) bar.innerHTML='<div class="t"><b>'+money(c.franchise?c.totalHT:c.totalTTC)+'</b> '+(c.franchise?'net':'TTC')+' · marge <b style="color:'+(c.margePct<20?'var(--red)':'var(--green)')+'">'+pct(c.margePct)+'</b> · '+fq(r2(c.heures))+' h'+
      (c.options.length?' · +'+c.options.length+' option(s)':'')+(dirty?' · <span style="color:var(--orange,#d97706)">non enregistré</span>':'')+
      (function(){ var g=alertGroups(c), n=g.fix.length+g.zero.length; return n?' · <a href="#" style="color:'+(g.fix.length?'var(--red,#c0392b)':'var(--orange,#d97706)')+';font-weight:700" onclick="nxd2.alertes();return false">⚠ '+n+' point'+(n>1?'s':'')+' à régler</a>':''; })()+'</div>'+
      '<button class="btn-dark btn-sm" onclick="nxd2.save()">💾 Enregistrer</button>';
    c.lots.concat(c.options).forEach(function(x){ var el=document.getElementById('nxd2LotTot'+x.i); if(el) el.textContent=x.alt?('total '+money(x.altTotalHT)+' HT si retenue'):(money(x.ht)+' HT'+(x.option?' (option)':'')); });
    (cur.lots||[]).forEach(function(lot,i){ var m=MODS[lot.module]; if(m&&m.live){ try{ m.live(lot,i,api); }catch(e){} } });
  }

  /* facturation (bloc existant, déplacé dans le récap) */
  function mountFBloc(){
    var f=document.getElementById('fBloc'), host=document.getElementById('nxd2FHost'); if(!f||!host) return;
    if(!fBlocHome) fBlocHome={p:f.parentNode,n:f.nextSibling};
    host.appendChild(f); try{ renderFBloc(); }catch(e){}
  }
  function restoreFBloc(){
    var f=document.getElementById('fBloc'); if(!f||!fBlocHome) return;
    if(f.parentNode!==fBlocHome.p){ try{ fBlocHome.p.insertBefore(f,fBlocHome.n&&fBlocHome.n.parentNode===fBlocHome.p?fBlocHome.n:null); }catch(e){ fBlocHome.p.appendChild(f); } }
  }

  /* ---------------- choix de la nature ---------------- */
  function chooser(opt){
    opt=opt||{};
    var old=document.getElementById('nxd2Choose'); if(old) old.remove();
    var nd=newDrafts();
    var ov=document.createElement('div'); ov.className='nxd2-ov'; ov.id='nxd2Choose';
    var tiles=NATURES.map(function(n){
      var ready=!!MODS[n.id];
      if(opt.lot&&!ready) return '<button class="nxd2-tile old" disabled style="opacity:.55"><b>'+n.ico+' '+esc(n.label)+'</b><span>'+esc(n.sub)+'</span><span class="pill">phase '+n.phase+'</span></button>';
      return '<button class="nxd2-tile'+(ready?'':' old')+'" onclick="nxd2.pick(\''+n.id+'\')"><b>'+n.ico+' '+esc(n.label)+'</b><span>'+esc(n.sub)+'</span><span class="pill">'+(ready?'DV-…-'+n.code:(n.legacy?'ancien formulaire pour l\'instant':'arrive en phase '+n.phase))+'</span></button>';
    }).join('');
    ov.innerHTML='<div class="nxd2-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="margin:0;font-size:19px">'+(opt.lot?'Ajouter un lot':'Nouveau devis — quelle nature de chantier ?')+'</h2><button class="iconbtn" onclick="nxd2.closeChooser()">✕</button></div>'+
      (!opt.lot?'<label class="nxd2-chk" style="margin-top:8px"><input type="checkbox" id="nxd2Visit"> Commencer par la visite technique</label>':'')+
      (!opt.lot&&nd.length?'<div class="nxd2-banner" style="margin-top:8px"><b>Devis commencés, pas encore enregistrés :</b>'+nd.map(function(x){ return '<div style="margin-top:6px">'+esc(x.cur.cNom||'sans nom')+' — '+esc(x.cur.type||'')+' <span class="sub2">('+new Date(x.at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+')</span> <button class="nx-sbtn mar" onclick="nxd2.resumeNewDraft(\''+x.id+'\')">Reprendre</button> <button class="nx-sbtn" onclick="nxd2.forgetDraft(\''+x.id+'\')">Jeter</button></div>'; }).join('')+'</div>':'')+
      '<div class="nxd2-grid">'+tiles+'</div>'+
      (!opt.lot?'<div class="nxd2-hint" style="margin-top:10px">Le code de la nature apparaît dans le numéro du devis. Tes anciens devis s\'ouvrent toujours dans l\'ancien formulaire ; il reste disponible ici : <a href="#" onclick="nxd2.legacy();return false">ancien formulaire</a>.</div>':'')+
      '</div>';
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
    ov._opt=opt;
    document.body.appendChild(ov);
  }
  function legacyNew(type,client){
    var ov=document.getElementById('nxd2Choose'); if(ov) ov.remove();
    if(window._curView===VIEW) saveDraft();
    if(cur&&cur.v===2){ cur=null; dirty=false; }
    go('wizard'); newDevis();
    try{
      if(type){ var t=document.getElementById('f_type'); if(t){ t.value=type; onTypeChange(); } }
      if(client){ var n=document.getElementById('f_cNom'); if(n){ n.value=client; autofillClient(); updateWizName(); } }
    }catch(e){}
  }

  /* interception des boutons « Nouveau devis » (le reste de l'appli n'est pas touché) */
  var RX_NEW=/^\s*go\('wizard'\);\s*newDevis\(\);?\s*$/;
  var RX_CLI=/^\s*go\('wizard'\);\s*newDevis\(\);\s*document\.getElementById\('f_cNom'\)\.value='((?:[^'\\]|\\.)*)'/;
  document.addEventListener('click',function(e){
    try{
      if(!flagOn()) return;
      var el=e.target&&e.target.closest?e.target.closest('[onclick],a[data-v="wizard"]'):null; if(!el) return;
      var oc=el.getAttribute('onclick')||'', client=null;
      var isNav=el.matches('#nav a[data-v="wizard"]');
      if(isNav&&cur&&cur.v!==2) return;   /* un devis de l'ancien formulaire est en cours : le lien y ramène, comme avant */
      var m=RX_CLI.exec(oc); if(m) client=m[1].replace(/\\(.)/g,'$1');
      if(!(isNav||RX_NEW.test(oc)||m)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      try{ if(typeof nxCloseNav==='function') nxCloseNav(); }catch(_){}
      chooser({client:client});
    }catch(err){}
  },true);

  /* ---------------- impression v2 ---------------- */
  var NV='#121417', TINT='#f1f3f5';
  var SNOW='<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>';
  function catOf(l){
    if(l.cat&&CATKEYS[l.cat]) return l.cat;
    if(l.group==='Matériel') return /^Machine/.test(l.label)?'equip':'posemat';
    if(l.group==='Pose & main-d’œuvre') return 'mo';
    if(l.group==='Mise en service & déplacement') return l.label==='Déplacement'?'depl':'mes';
    return 'divers';
  }
  var CATS=[['equip','Équipements'],['cf','Chambre : panneaux, porte et finitions'],['pieces','Pièces détachées'],['reseau','Réseau aéraulique — plénums, gaines, grilles'],['regul','Régulation et zonage'],['hydro','Hydraulique et raccordements'],['posemat','Liaisons, câbles, évacuation, supports et accessoires'],['fluide','Fluide frigorigène'],['entr','Entretien des équipements'],['mo','Main-d’œuvre — pose et installation'],['st','Travaux sous-traités'],['mes','Mise en service et contrôles'],['depl','Déplacement'],['divers','Consommables et frais de chantier'],['deduc','Déductions']];
  var CATKEYS={}; CATS.forEach(function(c){ CATKEYS[c[0]]=1; });
  function row(label,ht,o){ o=o||{}; return '<tr'+(o.bg?' style="background:'+o.bg+'"':'')+'><td style="padding:'+(o.head?'9px':'6px')+' 12px;'+(o.head?'font-weight:700;color:'+NV+';border-top:1px solid #dce3ec':'color:#333;font-size:10.5px')+'">'+label+'</td><td style="padding:'+(o.head?'9px':'6px')+' 12px;text-align:right;'+(o.head?'font-weight:700;color:'+NV+';border-top:1px solid #dce3ec':'color:#333;font-size:10.5px')+'">'+(ht==null?'':money(ht))+'</td></tr>'; }
  function lineDetail(l){
    if(l.unite&&l.unite!=='forfait'&&Number(l.qte)>0&&(Number(l.qte)!==1||l.unite==='m')) return fq(r2(l.qte))+' '+l.unite+' × '+money(l.pu)+' HT';
    return '';
  }
  function clientLab(l){ try{ return clientLabel(l); }catch(e){ return l.label; } }
  function catsHTML(lines,d){
    var out='';
    CATS.forEach(function(ct){
      var ls=lines.filter(function(l){ return catOf(l)===ct[0]&&Math.abs(l.ht)>0.005; }); if(!ls.length) return;
      var subT=sum(ls,function(l){return l.ht;}), sub='';
      if(ct[0]==='divers'){
        var isA=function(l){ return l.label==='Frais administratifs devis'; }, isC=function(l){ return l.label==='Frais commande matériel'; }, isS=function(l){ return /^Marge sécurité/.test(l.label); };
        var isFee=function(l){ return isA(l)||isC(l)||isS(l); }, co=ls.filter(function(l){ return !isFee(l)&&/onsommables/i.test(l.label); }), ot=ls.filter(function(l){ return !isFee(l)&&!/onsommables/i.test(l.label); }), fe=ls.filter(isFee);
        if(co.length) sub+=row('Consommables (visserie, colliers, mastic, ruban…)',sum(co,function(l){return l.ht;}));
        sub+=ot.map(function(l){ return row(esc(clientLab(l)),l.ht); }).join('');
        if(fe.length){ var nm=[fe.some(isA)?'dossier':'',fe.some(isC)?'commande':''].filter(Boolean), lb=nm.length?'Frais de '+nm.join(' et de '):'';
          if(fe.some(isS)) lb=lb?lb+', aléas de chantier':'Aléas de chantier'; sub+=row(lb,sum(fe,function(l){return l.ht;})); } }
      else if(ct[0]==='mo'&&!d.pdfDetailMO){
        var h=ls.filter(function(l){ return l.unite==='h'; }), o=ls.filter(function(l){ return l.unite!=='h'; });
        var hh=sum(h,function(l){return num(l.qte);}), hv=sum(h,function(l){return l.ht;});
        var pus=h.map(function(l){ return r2(l.pu); }).filter(function(v,k,a){ return a.indexOf(v)===k; });
        if(h.length) sub+=row((ls.some(function(l){ return l.catLabel; })?'Main-d’œuvre (intervention, préparation et suivi)':'Main-d’œuvre (pose, raccordements, préparation et suivi)')+' <span style="color:#8a93a0">— '+fq(r2(hh))+' h'+(pus.length===1?' × '+money(pus[0])+' HT':'')+'</span>',hv);
        sub+=o.map(function(l){ var dt=lineDetail(l); return row(esc(clientLab(l))+(dt?' <span style="color:#8a93a0">— '+dt+'</span>':''),l.ht); }).join('');
      } else sub=ls.map(function(l){ var dt=l.pdf||lineDetail(l); return row(esc(clientLab(l))+(dt?' <span style="color:#8a93a0">— '+esc(dt)+'</span>':''),l.ht); }).join('');
      var head=ct[1]; for(var q=0;q<ls.length;q++){ if(ls[q].catLabel){ head=ls[q].catLabel; break; } }
      out+=row(head,subT,{head:true,bg:TINT})+sub;
    });
    return out;
  }
  function objetOf(d){
    return (d.lots||[]).filter(function(l){ return !l.option; }).map(function(l){ var m=MODS[l.module]; var s=''; try{ s=m&&m.summary?m.summary(l):natureOf(l.module).label; }catch(e){ s=natureOf(l.module).label; } return (l.titre?l.titre+' : ':'')+s; }).join(' ; ');
  }
  function printV2(d){
    derive(d);
    if((d.lots||[]).some(function(l){ return !MODS[l.module]; })){ say('⚠ Un lot n\'est pas géré sur cet appareil : recharge ClimPilot avant d\'imprimer'); return; }
    var c=computeV2(d), E=E_(), today=new Date().toLocaleDateString('fr-FR'), fr=c.franchise, doc=document.getElementById('devisDoc'); if(!doc) return;
    var top=''; try{ top=docTop(E,NV,SNOW,today); }catch(e){}
    var legal=''; try{ legal=docLegal(E,NV); }catch(e){}
    var valid='3 mois'; try{ valid=devisValidite(E); }catch(e){}
    var clientBox='<div style="border:1px solid #cfd6e0;border-radius:6px;padding:10px 14px;font-size:12px;min-width:230px"><div style="font-size:10px;color:'+NV+';text-transform:uppercase;letter-spacing:.05em;font-weight:700">Client</div><b>'+esc(d.cNom||'—')+'</b><br>'+esc(d.cAdr||'')+'<br>'+esc(d.cVille||'')+'<br>'+esc([d.cTel,d.cMail].filter(Boolean).join(' — '))+(d.cSiren?'<br>SIREN '+esc(d.cSiren):'')+'</div>';
    if(d.estim){
      var rows=c.lots.map(function(x){ return [(c.lots.length>1?'Lot '+(x.i+1)+' — ':'')+x.label+(x.titre?' ('+x.titre+')':''),x.ht]; });
      var com=sum(c.common,function(l){return l.ht;}); if(com>0.005) rows.push(['Déplacement, préparation et frais',com]);
      doc.innerHTML='<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px">'+top+
        '<div style="display:flex;justify-content:space-between;gap:14px;margin:8px 0 12px;flex-wrap:wrap"><div><div style="font-size:20px;font-weight:800;color:'+NV+'">Estimation indicative</div><div style="font-size:11px;color:#555"><b>Objet :</b> '+esc(objetOf(d))+'</div></div>'+clientBox+'</div>'+
        '<div style="background:#fff7e6;border:1px solid #f0dcae;border-radius:8px;padding:10px 13px;font-size:11px;color:#7a5a12;margin-bottom:12px"><b>Document non contractuel.</b> Montant indicatif — il ne vaut pas devis. Un devis détaillé sera établi après visite technique.</div>'+
        '<table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #dce3ec"><thead><tr style="background:'+NV+';color:#fff"><th style="text-align:left;padding:9px 12px">Poste</th><th style="text-align:right;padding:9px 12px">Montant estimé HT</th></tr></thead><tbody>'+rows.map(function(r){ return '<tr><td style="padding:10px 12px;border-top:1px solid #e6ebf2">'+esc(r[0])+'</td><td style="padding:10px 12px;border-top:1px solid #e6ebf2;text-align:right;font-weight:600">'+money(r[1])+'</td></tr>'; }).join('')+'</tbody></table>'+
        totalsHTML(c)+'<div style="margin-top:14px;font-size:9.5px;color:#777;border-top:1px solid #eee;padding-top:8px">'+esc(E.piedNote||'')+'</div>'+legal+'</div>';
      doc.innerHTML=cellsWrap(doc.innerHTML); window.print(); return;
    }
    var body='';
    var single=c.lots.length===1;
    c.lots.forEach(function(x){
      var lot=d.lots[x.i], m=MODS[lot.module], extra='';
      try{ extra=m&&m.pdf?m.pdf(lot,x,api):''; }catch(e){}
      if(!single) body+='<tr style="background:'+NV+'"><td style="padding:9px 12px;color:#fff;font-weight:700">Lot '+(x.i+1)+' — '+esc(x.label)+(x.titre?' : '+esc(x.titre):'')+'</td><td style="padding:9px 12px;color:#fff;font-weight:700;text-align:right">'+money(x.ht)+'</td></tr>';
      if(extra) body+='<tr><td colspan="2" style="padding:8px 12px">'+extra+'</td></tr>';
      body+=catsHTML(x.lines,d);
    });
    var cl=c.common;
    var asMo=function(l){ var o=Object.assign({},l); if(o.label==='Préparation du chantier'||o.label==='Achat et enlèvement du matériel'||/^Provision SAV/.test(o.label)) o.cat='mo'; return o; };
    if(single){
      var x0=c.lots[0], lot0=d.lots[x0.i], m0=MODS[lot0.module], ex0='';
      try{ ex0=m0&&m0.pdf?m0.pdf(lot0,x0,api):''; }catch(e){}
      body=(ex0?'<tr><td colspan="2" style="padding:8px 12px">'+ex0+'</td></tr>':'')+catsHTML(x0.lines.concat(cl.map(asMo)),d);
    } else if(cl.some(function(l){ return l.ht>0.005; })){
      if(!single) body+='<tr style="background:'+NV+'"><td style="padding:9px 12px;color:#fff;font-weight:700">Commun à l\'ensemble des travaux</td><td style="padding:9px 12px;color:#fff;font-weight:700;text-align:right">'+money(sum(cl,function(l){return l.ht;}))+'</td></tr>';
      body+=catsHTML(cl.map(asMo),d);
    }
    var opts='';
    if(c.options.length){
      var allAlt=c.options.every(function(x){ return x.alt; });
      opts='<div style="margin-top:14px"><div style="font-weight:700;color:'+NV+';font-size:12px;margin-bottom:4px">'+(allAlt?'Autre solution proposée, au choix (non comprise dans le total ci-dessus)':'Options et autres solutions proposées (non comprises dans le total ci-dessus)')+'</div><table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #dce3ec">'+
        c.options.map(function(x){ var lot=d.lots[x.i], m=MODS[lot.module], s=''; try{ s=m&&m.summary?m.summary(lot):''; }catch(e){}
          if(x.alt) return '<tr><td style="padding:8px 12px;border-top:1px solid #e6ebf2">☐ '+esc(x.titre||x.label)+(s?' <span style="color:#8a93a0">('+esc(s)+')</span>':'')+'<div style="font-size:9.5px;color:#666">à la place de « '+esc(x.altTitre)+' » — montant total du devis si cette solution est retenue</div></td><td style="padding:8px 12px;border-top:1px solid #e6ebf2;text-align:right;font-weight:600">'+money(x.altTotalHT)+' HT'+(fr?'':' · '+money(x.altTotalTTC)+' TTC')+'</td></tr>';
          return '<tr><td style="padding:8px 12px;border-top:1px solid #e6ebf2">☐ '+esc(x.label)+(x.titre?' — '+esc(x.titre):'')+(s?' <span style="color:#8a93a0">('+esc(s)+')</span>':'')+'</td><td style="padding:8px 12px;border-top:1px solid #e6ebf2;text-align:right;font-weight:600">+ '+money(x.ht)+' HT'+(fr?'':' · '+money(x.ttc)+' TTC')+'</td></tr>'; }).join('')+'</table></div>';
    }
    var excl=(d.lots||[]).filter(function(l){ return !l.option&&String(l.exclusions||'').trim(); }).map(function(l){ return (c.lots.length>1?'<b>'+esc(natureOf(l.module).label)+(l.titre?' — '+esc(l.titre):'')+' :</b> ':'')+esc(l.exclusions); });
    var reduit=!fr&&c.tvaBreak.some(function(t){ return t.rate>0&&t.rate<20; });
    var ctrRegl='contrat d\'entretien facturé chaque année, en début de période';
    var regl=c.ctrAll?ctrRegl:((c.acomptePct>0&&c.acompte>0.005?('acompte de '+money(c.acompte)+' ('+fq(c.acomptePct)+' %) à la commande, solde de '+money(c.solde)+' à la fin des travaux'):'à la fin des travaux')+(c.ctrTTC>0.005?' ; '+ctrRegl:''));
    doc.innerHTML='<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px">'+top+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin:8px 0 14px;flex-wrap:wrap"><div style="font-size:11px;color:#555;line-height:1.5;max-width:360px">'+
      '<div style="font-size:20px;font-weight:800;color:'+NV+'">Devis N° '+esc(d.num)+'</div><div style="margin-top:2px"><b>Objet :</b> '+esc(objetOf(d))+'</div></div>'+clientBox+'</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #dce3ec"><thead><tr style="background:'+NV+';color:#fff"><th style="text-align:left;padding:9px 12px">Prestations et fournitures</th><th style="padding:9px 12px;text-align:right">Montant HT</th></tr></thead><tbody>'+body+'</tbody></table>'+
      (fr?'<div style="margin-top:8px;font-size:10.5px;font-weight:700;color:#333">TVA non applicable — article 293 B du CGI (franchise en base).</div>':'')+
      totalsHTML(c)+opts+
      (excl.length?'<div style="margin-top:14px;font-size:10px;color:#444;line-height:1.6;border:1px solid #e3e8ef;border-radius:6px;padding:10px 13px"><b style="color:'+NV+'">Travaux non compris</b><br>'+excl.join('<br>')+'</div>':'')+
      '<div style="margin-top:12px;font-size:10px;color:#555;line-height:1.7;border:1px solid #e3e8ef;border-radius:6px;padding:11px 13px"><b style="color:'+NV+'">Conditions</b><br>'+
      'Devis gratuit, valable '+esc(valid)+' à compter de sa date d\'émission.<br>Délai d\'exécution des travaux : à convenir ensemble à la commande.<br>Règlement : '+esc(regl)+' — virement, chèque ou espèces.<br>'+
      'Matériel garanti selon la garantie constructeur ; installation réalisée dans les règles de l\'art et couverte par nos assurances (voir bas de page).'+
      (reduit?'<br>Taux réduit de TVA appliqué sous réserve des conditions d\'éligibilité en vigueur (logement achevé depuis plus de deux ans, équipement éligible).':'')+(!fr&&c.tvaBreak.some(function(t){ return t.rate===5.5; })?'<br>TVA à 5,5 % (art. 278-0 bis A du CGI) : le client certifie que le logement est à usage d\'habitation et achevé depuis plus de deux ans ; l\'entreprise certifie que les travaux et équipements remplissent les conditions d\'application de ce taux.':'')+'</div>'+
      '<div style="display:flex;gap:14px;margin-top:14px"><div style="flex:1;border:1px solid #cfd6e0;border-radius:6px;padding:10px 12px"><div style="font-weight:700;color:'+NV+';font-size:11px">Bon pour accord — le client</div><div style="font-size:9.5px;color:#666;margin-top:2px">Date et signature, précédées de la mention « Bon pour accord ».'+(c.options.length?(c.options.every(function(x){ return x.alt; })?' Cochez la solution retenue si ce n\'est pas celle du total.':' Cochez les options ou la solution retenues.'):'')+'</div><div style="height:54px"></div></div>'+
      '<div style="flex:1;border:1px solid #cfd6e0;border-radius:6px;padding:10px 12px"><div style="font-weight:700;color:'+NV+';font-size:11px">L\'entreprise</div><div style="font-size:9.5px;color:#666;margin-top:2px">'+esc(E.nom||'—')+(E.ville?' — '+esc(E.ville):'')+', le '+today+'</div><div style="height:54px"></div></div></div>'+
      '<div style="margin-top:14px;font-size:9.5px;color:#777;border-top:1px solid #eee;padding-top:8px">'+esc(E.piedNote||'')+'</div>'+
      (d.cType!=='Professionnel'&&E.mediateur?'<div style="margin-top:4px;font-size:9.5px;color:#777">Médiation de la consommation : '+esc(E.mediateur)+(E.mediateurSite?' — '+esc(E.mediateurSite):'')+'. En cas de litige non résolu, le client consommateur peut saisir gratuitement ce médiateur.</div>':'')+
      legal+'</div>';
    doc.innerHTML=cellsWrap(doc.innerHTML);
    window.print();
  }
  function cellsWrap(h){
    return String(h).replace(/<(td|th)([^>]*?) style="/g,'<$1$2 style="white-space:normal;').replace(/<(td|th)((?:(?!style=)[^>])*)>/g,'<$1$2 style="white-space:normal">');
  }
  function totalsHTML(c){
    var tr=function(a,b,o){ o=o||{}; return '<tr'+(o.bg?' style="background:'+TINT+'"':'')+'><td style="text-align:right;padding:'+(o.bg?'9px':'6px')+' 8px;'+(o.b?'font-weight:800;color:'+NV:'')+'">'+a+'</td><td style="text-align:right;padding:'+(o.bg?'9px':'6px')+' 8px;'+(o.b?'font-weight:800;color:'+NV:(o.w?'font-weight:700':''))+'">'+b+'</td></tr>'; };
    var h='<div style="display:flex;justify-content:flex-end;margin-top:14px"><table style="border-collapse:collapse;font-size:12px;min-width:280px">'+tr('Total HT',money(c.totalHT),{w:1});
    if(c.franchise) h+=tr('<span style="color:#888">TVA</span>','<span style="color:#888">non applicable (293 B)</span>')+tr('Net à payer',money(c.totalHT),{bg:1,b:1});
    else h+=c.tvaBreak.map(function(t){ return tr('TVA '+String(t.rate).replace('.',',')+' %'+(c.tvaBreak.length>1?' (base '+money(t.base)+')':''),money(t.tva)); }).join('')+tr('Total TTC',money(c.totalTTC),{bg:1,b:1});
    if(c.acomptePct>0&&c.acompte>0.005) h+=tr('Acompte à la commande ('+fq(c.acomptePct)+' %)','<span style="color:'+NV+';font-weight:700">'+money(c.acompte)+'</span>')+tr('Solde à la fin des travaux'+(c.ctrTTC>0.005?' (hors contrat)':''),money(c.solde));
    return h+'</table></div>';
  }
  function printVisite(blank){
    var d=cur; if(!d) return; var E=E_(), doc=document.getElementById('devisDoc'); if(!doc) return;
    var dots='<span style="color:#aaa">………………………………………</span>';
    var sec=function(t){ return '<div style="background:'+NV+';color:#fff;font-weight:700;font-size:11px;padding:6px 10px;margin-top:12px">'+t+'</div>'; };
    var h='<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:16px">📋 FICHE DE VISITE TECHNIQUE</b><span style="font-family:monospace">'+esc(d.num)+'</span></div>'+
      '<div style="font-size:11px;color:#555;margin:4px 0"><b>'+esc(d.cNom||(blank?'Client : ':'—'))+'</b>'+(blank?dots:'')+' — '+esc([d.cAdr,d.cVille].filter(Boolean).join(', '))+(d.cTel?' · '+esc(d.cTel):'')+'</div>'+
      '<div style="font-size:11px">Date : '+(blank||!d.visite.date?dots:esc(d.visite.date))+' &nbsp; Interlocuteur : '+(blank||!d.visite.contact?dots:esc(d.visite.contact))+'</div>';
    (d.lots||[]).forEach(function(lot){
      var m=MODS[lot.module]; h+=sec(esc(natureOf(lot.module).label)+(lot.titre?' — '+esc(lot.titre):''));
      ((m&&m.visite)||[]).forEach(function(q){ var v=(lot.visite||{})[q.k]; h+='<div style="font-size:11px;padding:5px 0;border-bottom:1px solid #eee"><b>'+esc(q.l)+'</b> : '+(blank||v==null||v===''?(q.t==='sel'?q.o.filter(Boolean).map(function(o){ return '☐ '+esc(o); }).join(' &nbsp; '):dots):esc(v))+'</div>'; });
      try{ if(m&&m.visitePrint) h+=m.visitePrint(lot,blank,api); }catch(e){}
    });
    h+=sec('Notes')+'<div style="font-size:11px;min-height:80px;white-space:pre-wrap;padding:6px 0">'+(blank?'':esc(d.visite.notes||''))+'</div></div>';
    doc.innerHTML=cellsWrap(h); window.print();
  }

  /* ---------------- actions ---------------- */
  var nxd2={
    tab:function(t){ TAB=t; renderBody(); refreshLive(); try{ window.scrollTo(0,0); }catch(e){} },
    alertes:function(){ TAB='recap'; renderBody(); refreshLive(); try{ var e=document.getElementById('nxd2Sante'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} },
    save:saveV2,
    close:function(){ go('tous'); },
    newDevis:function(){ chooser({}); },
    closeChooser:function(){ var o=document.getElementById('nxd2Choose'); if(o) o.remove(); },
    pick:function(id){
      var ov=document.getElementById('nxd2Choose'), opt=(ov&&ov._opt)||{}, visit=!!(document.getElementById('nxd2Visit')||{}).checked;
      if(ov) ov.remove();
      if(opt.lot){ if(!MODS[id]) return; cur.lots.push(newLot(id,{type:null})); mergeCommon(cur,id); markDirty(); TAB='lots'; render(); return; }
      if(!MODS[id]){ var n=natureOf(id); return legacyNew(n.legacy,opt.client); }
      if(window._curView===VIEW) saveDraft();
      var d=newDevisV2(id,{client:opt.client});
      openEditor(d,{tab:visit?'visite':(opt.client?'lots':'client'),dirty:true});
    },
    legacy:function(){ var ov=document.getElementById('nxd2Choose'), opt=(ov&&ov._opt)||{}; legacyNew(null,opt.client); },
    addLot:function(){ chooser({lot:true}); },
    delLot:function(i){ if(!cur.lots[i]) return; if(!confirm('Supprimer le lot '+(i+1)+' ('+natureOf(cur.lots[i].module).label+') ?')) return; cur.lots.splice(i,1); markDirty(); render(); },
    dupLot:function(i){ var l=clone(cur.lots[i]); l.id=newId(); l.titre=(l.titre?l.titre+' ':'')+'(copie)'; cur.lots.splice(i+1,0,l); markDirty(); render(); },
    addLotMod:function(mod,asOption,titre){ if(!MODS[mod]) return null; var l=newLot(mod); l.option=!!asOption; if(titre) l.titre=titre; cur.lots.push(l); if(!asOption) mergeCommon(cur,mod); markDirty(); return l; },
    altLot:function(i,titre){ var src=cur.lots[i]; var l=clone(src); if(!l) return; l.id=newId(); l.option=true; l.alt=src.id; l.titre=titre||'Solution alternative'; if(!src.titre) src.titre='Solution 1'; cur.lots.splice(i+1,0,l); markDirty(); render(); say('Solution alternative ajoutée : modifie-la. Si le client la choisit, « Retenir cette solution » la met à la place de l\'autre'); },
    /* le client choisit la solution alternative : elle devient le lot facturé, l'autre passe en solution non retenue (jamais les deux) */
    pickAlt:function(i){ var a=cur.lots[i]; if(!a||!a.alt) return; var k=cur.lots.findIndex(function(l){ return l.id===a.alt; });
      if(k>=0){ var o=cur.lots[k]; o.option=true; o.alt=a.id; }
      a.option=false; delete a.alt; markDirty(); render(); say('Solution retenue : « '+(a.titre||'lot '+(i+1))+' » est maintenant dans le total'+(k>=0?', l\'autre solution est passée hors total':'')); },
    moveLot:function(i,dir){ var j=i+dir; if(j<0||j>=cur.lots.length) return; var t=cur.lots[i]; cur.lots[i]=cur.lots[j]; cur.lots[j]=t; markDirty(); render(); },
    act:function(name,i){ var lot=cur.lots[i], m=lot&&MODS[lot.module]; if(!m||!m.actions||!m.actions[name]) return; var args=[].slice.call(arguments,2); var r=m.actions[name].apply(null,[lot,i,api].concat(args)); markDirty(); if(r!==false) rerender('lot',i); refreshLive(); },
    applyVisite:function(i){ var lot=cur.lots[i], m=lot&&MODS[lot.module]; if(!m||!m.applyVisite) return; var msgs=m.applyVisite(lot,api)||[]; markDirty(); say(msgs.length?('Reporté au devis : '+msgs.join(' · ')):'Rien à reporter automatiquement'); renderBody(); refreshLive(); },
    statut:function(s){ cur.statut=s; cur._statutSet=true; if(s==='envoye'&&!cur.sentAt) cur.sentAt=Date.now(); markDirty(); updHead(); renderBody(); refreshLive(); },
    sign:function(){
      if(typeof window.nxsSendDevis!=='function'){ say('Signature en ligne indisponible'); return; }
      if(!String(cur.cNom||'').trim()){ say('Renseigne le client avant d\'envoyer le devis'); return; }
      protect(cur); derive(cur); cur.updatedAt=Date.now(); delete cur._statutSet;
      var id=cur.id; window.nxsSendDevis();
      try{ var i=DEVIS.findIndex(function(x){ return x.id===id; });
        if(i>=0){ DEVIS[i]=clone(DEVIS[i]); delete DEVIS[i]._baseStatut; delete DEVIS[i]._statutSet; persist(LS.devis,DEVIS); if(cur&&cur.id===id){ cur=clone(DEVIS[i]); cur._baseStatut=cur.statut; } dirty=false; dropDraft(id); rememberDefaults(cur); }
      }catch(e){}
      updHead(); renderBody(); refreshLive();
    },
    mail:function(){ derive(cur); try{ mailDevis(); }catch(e){} updHead(); renderBody(); },
    printVisite:printVisite,
    resumeDraft:function(){ var dr=getDraft(cur&&cur.id); if(!dr) return; cur=dr.cur; dirty=true; showBanner(''); render(); },
    dropDraft:function(){ dropDraft(cur&&cur.id); showBanner(''); },
    forgetDraft:function(id){ dropDraft(id); var o=document.getElementById('nxd2Choose'); var opt=o&&o._opt; if(o){ o.remove(); chooser(opt||{}); } },
    resumeNewDraft:function(id){ if(window._curView===VIEW) saveDraft(); var dr=getDraft(id); var ov=document.getElementById('nxd2Choose'); if(ov) ov.remove(); if(dr) openEditor(dr.cur,{dirty:true}); },
    copyLegacy:function(){
      if(!cur||cur.v===2) return; formToDevis();
      if(!legacyMod(cur.type)) return;
      var src=clone(cur), d=NXD2.fromLegacyDevis(src);
      openEditor(d,{tab:'lots',dirty:true,banner:'Copie de '+esc(src.num)+' au nouveau format, <b>même montant</b> (l\'original n\'est pas modifié). Pense à la préparation, à l\'achat du matériel et à la provision SAV dans le récapitulatif, puis enregistre.'});
    }
  };
  window.nxd2=nxd2;
  /* facturation depuis le devis (acompte / solde / totalité) : hors contrat d'entretien, facturé depuis l'onglet Contrats */
  window.nxBillTotal=function(d,c){ try{ if(!d||d.v!==2) return c?c.totalTTC:0; c=(c&&c.billTTC!=null)?c:computeV2(d); return Math.round(c.billTTC*100)/100; }catch(e){ return c?c.totalTTC:0; } };
  window.nxBillNote=function(d,c){ try{ if(!d||d.v!==2) return ''; c=(c&&c.billTTC!=null)?c:computeV2(d); if(!(c.ctrTTC>0.005)) return '';
      return '🤝 '+(c.ctrAll?'Ce devis est un contrat d\'entretien':'Ce devis contient un contrat d\'entretien')+' ('+money(c.ctrHT)+' HT par an) : il se facture chaque année depuis l\'onglet <a href="#" onclick="go(\'contrats\');return false">Contrats</a>'+(c.ctrAll?', pas ici (une fois le devis accepté, le contrat y est créé tout seul).':' ; ici, seuls les autres travaux sont facturés.'); }catch(e){ return ''; } };
  window.NXD2={register:register,compute:computeV2,natures:NATURES,modules:MODS,newDevis:newDevisV2,newLot:newLot,open:openEditor,derive:derive,numFor:numFor,api:api,
    zonePrice:zonePrice,protect:protect,fromLegacyDevis:function(src){ var d=newDevisV2(null,{}); d.common={prepH:0,achatH:0,savPct:0}; ['cNom','cTel','cMail','cType','cAdr','cVille','cSiren','zone','rateChoice','rateCustom','acompteOn','acomptePct','notes'].forEach(function(k){ if(src[k]!=null) d[k]=src[k]; }); var mid=legacyMod(src.type)||'split'; var lot=newLot(mid); lot.data=MODS[mid].fromLegacy(src); lot.tva=src.tvaMode==='mixte'?'mixte':String(src.tvaRate!=null&&src.tvaRate!==''?src.tvaRate:P.tva); d.lots=[lot]; d.num=numFor(d); return derive(d); }};

  /* assistant : un devis dicté de clim murale s'ouvre au nouveau format */
  var _nxaOpen=window.nxaOpenDevis;
  if(typeof _nxaOpen==='function'){
    window.nxaOpenDevis=function(id){
      var r=_nxaOpen.apply(this,arguments);
      try{
        /* la nature dictée peut être inconnue de l'ancien formulaire (froid commercial, dépose…) : on la reprend de la dictée */
        var pl0=window._nxaLastPayload, pt=(pl0&&pl0.id===id&&pl0.p)?pl0.p.type:null;
        if(flagOn()&&cur&&cur.v!==2&&(legacyMod(cur.type)||legacyMod(pt))){
          var src0=clone(cur); if(!legacyMod(src0.type)) src0.type=pt;
          var inbox=cur._inboxId, ban=document.getElementById('nxaBanner'), d=NXD2.fromLegacyDevis(src0);
          d.common={prepH:CFG().prepH,achatH:CFG().achatH,savPct:CFG().savPct};
          d.lots[0].data.moMode='detail';
          /* champs propres à la nature dictés (ex. : pièces et bouches d'un gainable) */
          try{ var pl=window._nxaLastPayload, lm=MODS[d.lots[0].module]; if(lm&&lm.fromAssistant){ var gm=lm.fromAssistant((pl&&pl.id===id&&pl.p)?(pl.p[d.lots[0].module]||null):null,d.lots[0])||[]; try{ if(lm.onNewDevis) lm.onNewDevis(d); if(lm.common) Object.assign(d.common,lm.common()); }catch(e){} if(gm.length&&ban&&ban.querySelector){ var ul=ban.querySelector('ul'); if(ul) gm.forEach(function(t){ var li=document.createElement('li'); li.textContent=t; ul.appendChild(li); }); } } }catch(e){}
          if(inbox) d._inboxId=inbox;
          cur=null; openEditor(d,{tab:'lots',dirty:true,banner:ban||null});
        }
      }catch(e){}
      return r;
    };
  }

  /* ancien formulaire : bouton « Copier au nouveau format » + réglage dans Paramètres */
  function boot(tries){
    tries=tries||0;
    try{
      ensureView();
      try{ if(window._curView==='dash'&&typeof renderDash==='function') renderDash(); }catch(e){}
      var hdr=document.querySelector('#v-wizard .flexhead .row-actions');
      if(hdr&&!document.getElementById('nxd2Copy')){ var b=document.createElement('button'); b.id='nxd2Copy'; b.className='btn-ghost btn-sm'; b.type='button'; b.textContent='⇢ Nouveau format'; b.title='Copier ce devis dans le nouveau format par nature (l\'original reste intact)'; b.onclick=function(){ nxd2.copyLegacy(); }; hdr.insertBefore(b,hdr.firstChild); }
      var _g=window.go;
      if(!_g._nxd2p){ window.go=function(v){ var r=_g.apply(this,arguments); try{ if(v==='params') paramsCard(); if(v==='wizard'){ var cb=document.getElementById('nxd2Copy'); if(cb) cb.style.display=(flagOn()&&cur&&legacyMod(cur.type))?'':'none'; } }catch(e){} return r; }; window.go._nxd2p=true; }
    }catch(e){ if(tries<20) setTimeout(function(){ boot(tries+1); },200); }
  }
  function paramsCard(){
    var v=document.getElementById('v-params'); if(!v) return;
    var box=document.getElementById('nxd2Params');
    if(!box){ box=document.createElement('div'); box.id='nxd2Params'; box.className='card'; v.insertBefore(box,v.firstChild); }
    var c=CFG();
    box.innerHTML='<h2>🧩 Devis par nature de chantier</h2>'+
      '<label class="nxd2-chk"><input type="checkbox" id="nxd2Flag"'+(flagOn()?' checked':'')+' onchange="nxd2.setFlag(this.checked)"> Proposer le choix de la nature au clic sur « Nouveau devis » (sinon : ancien formulaire)</label>'+
      '<div class="frm" style="margin-top:8px">'+
      '<label>Préparation par devis (h)<input type="number" step="0.25" min="0" value="'+c.prepH+'" onchange="nxd2.setCfg(\'prepH\',this.value)"></label>'+
      '<label>Achat / enlèvement matériel (h)<input type="number" step="0.25" min="0" value="'+c.achatH+'" onchange="nxd2.setCfg(\'achatH\',this.value)"></label>'+
      '<label>Provision SAV (%)<input type="number" step="1" min="0" value="'+c.savPct+'" onchange="nxd2.setCfg(\'savPct\',this.value)"></label>'+
      '<label>Heures facturées par jour<input type="number" step="0.5" min="1" value="'+c.hPerDay+'" onchange="nxd2.setCfg(\'hPerDay\',this.value)"></label>'+
      '<label>Au-delà de 60 km (€/km)<input type="number" step="0.05" min="0" value="'+c.kmRate+'" onchange="nxd2.setCfg(\'kmRate\',this.value)"><span class="note-inline">ajouté au forfait 50-60 km ('+money(num((P.zone||{})['+50 km']))+')</span></label>'+
      '</div><div class="nxd2-hint">Valeurs de départ pour chaque nouveau devis ; tu peux les changer devis par devis dans le récapitulatif.</div>';
  }
  nxd2.setFlag=function(on){ try{ localStorage.setItem(FLAGK,on?'1':'0'); }catch(e){} say(on?'Choix de la nature activé':'Ancien formulaire par défaut'); };
  nxd2.setCfg=function(k,v){ var all=DEFS(); all.cfg[k]=num(v); persist(DEFK,all); say('Réglage enregistré'); };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ installDispatch(); setTimeout(boot,0); });
  else { installDispatch(); setTimeout(boot,0); }
})();
