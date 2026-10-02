/* ============================================================
   ClimPilot Next — next-avoir.js  (couche additive, 01/10/2026)
   AVOIRS : la seule façon légale de corriger ou d'annuler une facture
   émise (une facture ne se supprime jamais et ne se modifie pas).
   - Avoir total ou partiel sur n'importe quelle facture : chantier
     (acompte / solde), intervention, location, contrat d'entretien.
   - Série AV-AAAA-NNN continue, propre aux avoirs (méthode admise),
     référence obligatoire « Avoir relatif à la facture F-… du … ».
   - Facture pas encore payée : l'avoir diminue (ou annule) ce qui reste dû.
     Facture déjà payée : l'avoir est « à rembourser » jusqu'à ce que tu
     notes le remboursement (date + mode) ; il entre alors au livre des
     recettes en ligne négative, la ligne d'encaissement d'origine reste.
   - Avoir total : option « refaire une facture corrigée » — le chantier /
     l'intervention / la location / l'année de contrat redevient facturable ;
     l'ancienne facture reste au registre, marquée « annulée ».
   - Registre des documents, impayés, recettes et compteur de factures
     tiennent compte des avoirs et des factures annulées.
   ============================================================ */
(function(){
  'use strict';
  var AK='cp2_avoirs', SK='cp2_avseq';
  try{ [AK,SK].forEach(function(k){ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(k)<0) SYNC_KEYS.push(k); }); }catch(e){}
  try{ if(typeof NX_TXT_KEYS!=='undefined'&&NX_TXT_KEYS.indexOf(AK)<0) NX_TXT_KEYS.push(AK); }catch(e){}
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function money(n){ try{ return eur(n); }catch(e){ return r2(n).toFixed(2).replace('.',',')+' €'; } }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } }
  function fr(iso){ return iso?new Date(String(iso).slice(0,10)+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function say(m){ try{ toast(m); }catch(e){} }
  function arr(k){ try{ if(typeof loadArr==='function') return loadArr(k); }catch(e){} try{ var v=JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  function put(k,v){ try{ save(k,v); }catch(e){ localStorage.setItem(k,JSON.stringify(v)); } }
  var AV=arr(AK);
  function avoirs(){ return AV; }
  window.nxAvoirs=avoirs;
  function franchise(){ try{ return P.regimeTVA!=='assujetti'; }catch(e){ return true; } }
  function clientObj(nom){ try{ var n=String(nom||'').toLowerCase(); return (CLIENTS||[]).find(function(c){ return (c.nom||'').toLowerCase()===n; })||{}; }catch(e){ return {}; } }

  /* ---------- toutes les factures émises, sous une seule forme ---------- */
  function depMontant(x){ try{ return r2(computeDep(x).totalHT); }catch(e){ return 0; } }
  function invoices(){
    var out=[];
    function add(o){ if(o&&o.num) out.push(o); }
    try{ (DEVIS||[]).forEach(function(d){
      var cli={nom:d.cNom,adr:d.cAdr,ville:d.cVille,siren:d.cSiren,type:d.cType,mail:d.cMail,tel:d.cTel};
      [['facAcompte','acompte','Acompte chantier'],['facSolde','solde','Chantier']].forEach(function(p){ var f=d[p[0]]; if(f) add({num:f.num,date:f.date,kind:'devis',id:d.id,which:p[1],cli:cli,montant:r2(f.montant),basis:'ttc',payeLe:f.payeLe||null,mode:f.mode||'',label:p[2]+(d.type?' — '+d.type:'')+' (devis '+(d.num||'')+')',tvaR:f.tvaR||null,ref:d.num,f:f}); });
      (d.facAnnulees||[]).forEach(function(f){ add({num:f.num,date:f.date,kind:'devis',id:d.id,which:f.which,cli:cli,montant:r2(f.montant),basis:'ttc',payeLe:f.payeLe||null,mode:f.mode||'',label:(f.which==='acompte'?'Acompte chantier':'Chantier')+(d.type?' — '+d.type:'')+' (devis '+(d.num||'')+')',tvaR:f.tvaR||null,annulee:f.avoir||true,ref:d.num,f:f}); });
    }); }catch(e){}
    try{ (DEP||[]).forEach(function(x){
      var cli={nom:x.cNom,adr:x.cAdr,ville:x.cVille,siren:x.cSiren,type:x.cType,mail:x.cMail,tel:x.cTel}, lab=x.itype==='mes'?'Mise en service':'Dépannage';
      if(x.facNum) add({num:x.facNum,date:x.facDate||x.date,kind:'dep',id:x.id,which:'',cli:cli,montant:depMontant(x),basis:'ht',payeLe:x.statut==='payee'?(x.payeLe||null):null,mode:x.modeReg||'',label:lab+(x.date?' du '+fr(x.date):''),f:x});
      (x.facAnnulees||[]).forEach(function(f){ add({num:f.num,date:f.date,kind:'dep',id:x.id,which:'',cli:cli,montant:r2(f.montant),basis:'ht',payeLe:f.payeLe||null,mode:f.mode||'',label:lab+(x.date?' du '+fr(x.date):''),annulee:f.avoir||true,f:f}); });
    }); }catch(e){}
    try{ (LOC||[]).forEach(function(l){
      var cli={nom:l.cNom,adr:l.cAdr,ville:l.cVille,siren:l.cSiren,type:l.cType,mail:l.cMail,tel:l.cTel};
      if(l.fac) add({num:l.fac.num,date:l.fac.date,kind:'loc',id:l.id,which:'',cli:cli,montant:r2(l.fac.montant),basis:'ht',payeLe:l.fac.payeLe||null,mode:l.fac.mode||'',label:'Location adiabatique'+(l.num?' (contrat '+l.num+')':''),ref:l.num,f:l.fac});
      (l.facAnnulees||[]).forEach(function(f){ add({num:f.num,date:f.date,kind:'loc',id:l.id,which:'',cli:cli,montant:r2(f.montant),basis:'ht',payeLe:f.payeLe||null,mode:f.mode||'',label:'Location adiabatique'+(l.num?' (contrat '+l.num+')':''),annulee:f.avoir||true,ref:l.num,f:f}); });
    }); }catch(e){}
    try{ (CTR||[]).forEach(function(c){
      var cl=clientObj(c.clientNom), cli={nom:c.clientNom,adr:cl.adr,ville:cl.ville,siren:cl.siren,type:cl.type,mail:cl.mail,tel:cl.tel};
      (c.facs||[]).forEach(function(f){ add({num:f.num,date:f.date,kind:'ctr',id:c.id,which:String(f.annee),cli:cli,montant:r2(f.montant),basis:'ht',payeLe:f.payeLe||null,mode:f.mode||'',label:'Contrat d\'entretien '+(c.type||'')+' — '+f.annee,f:f}); });
      (c.facsAnnulees||[]).forEach(function(f){ add({num:f.num,date:f.date,kind:'ctr',id:c.id,which:String(f.annee),cli:cli,montant:r2(f.montant),basis:'ht',payeLe:f.payeLe||null,mode:f.mode||'',label:'Contrat d\'entretien '+(c.type||'')+' — '+f.annee,annulee:f.avoir||true,f:f}); });
    }); }catch(e){}
    out.forEach(function(i){ var a=AV.filter(function(v){ return v.facNum===i.num; }); i.avoirs=a; i.credite=r2(a.reduce(function(s,v){ return s+num(v.montant); },0)); i.reste=r2(i.montant-i.credite); });
    return out.sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||''))||String(b.num).localeCompare(String(a.num)); });
  }
  window.nxInvoices=invoices;

  /* ---------- numéro d'avoir : série continue, jamais réutilisé ---------- */
  function nextAvNum(){
    var y=new Date().getFullYear(), re=new RegExp('^AV-'+y+'-(\\d+)$'), mx=0;
    AV.forEach(function(a){ var m=String(a.num).match(re); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
    var sq={}; try{ sq=JSON.parse(localStorage.getItem(SK)||'{}')||{}; }catch(e){}
    if(sq.year!==y) sq={year:y,seq:0};
    var n=Math.max(mx,Number(sq.seq)||0)+1; sq.seq=n; put(SK,sq);
    return 'AV-'+y+'-'+String(n).padStart(3,'0');
  }

  /* ---------- TVA de l'avoir (assujetti) ---------- */
  function taxOf(av){
    var m=num(av.montant);
    if(av.franchise) return {ht:m,tva:0,ttc:m,parts:[]};
    var rates=(av.tvaR&&av.tvaR.length)?av.tvaR:[{rate:num(av.taux),part:1}];
    if(av.basis==='ttc'){ var ht=0,tv=0,parts=[]; rates.forEach(function(t){ var ttc=m*num(t.part), h=ttc/(1+num(t.rate)/100); ht+=h; tv+=ttc-h; parts.push({rate:num(t.rate),ht:r2(h),tva:r2(ttc-h)}); }); return {ht:r2(ht),tva:r2(tv),ttc:r2(m),parts:parts}; }
    var t=num(rates[0].rate); return {ht:r2(m),tva:r2(m*t/100),ttc:r2(m*(1+t/100)),parts:[{rate:t,ht:r2(m),tva:r2(m*t/100)}]};
  }
  window.nxAvoirTax=taxOf;

  /* ---------- création ---------- */
  function findInv(numF){ return invoices().find(function(i){ return i.num===numF; }); }
  function release(inv,avNum){
    /* l'ancienne facture passe dans « factures annulées » (elle reste au registre), l'élément redevient facturable */
    var snap=function(f,extra){ return Object.assign(JSON.parse(JSON.stringify(f)),{avoir:avNum,annuleeLe:today()},extra||{}); };
    if(inv.kind==='devis'){
      var d=(DEVIS||[]).find(function(x){ return x.id===inv.id; }); if(!d) return false;
      var key=inv.which==='acompte'?'facAcompte':'facSolde'; if(!d[key]) return false;
      d.facAnnulees=(d.facAnnulees||[]).concat([snap(d[key],{which:inv.which})]); delete d[key];
      try{ var c=window.NXD2&&NXD2.api.cur(); if(c&&c.id===d.id){ delete c[key]; c.facAnnulees=JSON.parse(JSON.stringify(d.facAnnulees)); } }catch(e){}
      try{ if(typeof cur!=='undefined'&&cur&&cur.id===d.id&&cur!==d){ delete cur[key]; cur.facAnnulees=JSON.parse(JSON.stringify(d.facAnnulees)); } }catch(e){}
      put(LS.devis,DEVIS); return true;
    }
    if(inv.kind==='dep'){
      var x=(DEP||[]).find(function(o){ return o.id===inv.id; }); if(!x||!x.facNum) return false;
      var f={num:x.facNum,date:x.facDate||x.date,montant:inv.montant,payeLe:x.statut==='payee'?(x.payeLe||null):null,mode:x.modeReg||''};
      x.facAnnulees=(x.facAnnulees||[]).concat([snap(f)]); x.facNum=''; x.facDate=null; x.statut='brouillon'; x.payeLe=null; x.modeReg='';
      try{ if(typeof curDep!=='undefined'&&curDep&&curDep.id===x.id&&curDep!==x){ Object.assign(curDep,{facNum:'',facDate:null,statut:'brouillon',payeLe:null,modeReg:'',facAnnulees:JSON.parse(JSON.stringify(x.facAnnulees))}); } }catch(e){}
      put(LS.dep,DEP); return true;
    }
    if(inv.kind==='loc'){
      var l=(LOC||[]).find(function(o){ return o.id===inv.id; }); if(!l||!l.fac) return false;
      l.facAnnulees=(l.facAnnulees||[]).concat([snap(l.fac)]); delete l.fac;
      try{ if(typeof curLoc!=='undefined'&&curLoc&&curLoc.id===l.id&&curLoc!==l){ delete curLoc.fac; curLoc.facAnnulees=JSON.parse(JSON.stringify(l.facAnnulees)); } }catch(e){}
      put(LS.loc,LOC); return true;
    }
    if(inv.kind==='ctr'){
      var c2=(CTR||[]).find(function(o){ return o.id===inv.id; }); if(!c2) return false;
      var i=(c2.facs||[]).findIndex(function(f){ return f.num===inv.num; }); if(i<0) return false;
      c2.facsAnnulees=(c2.facsAnnulees||[]).concat([snap(c2.facs[i])]); c2.facs.splice(i,1);
      put('cp2_contrats',CTR); return true;
    }
    return false;
  }
  /* 1.10 : préparation (aucun effet) puis enregistrement — le numéro peut ainsi venir du serveur
     AVANT que l'avoir n'existe (next-emission.js) ; sans cette couche, comportement inchangé. */
  function buildAvoir(o,numero){
    var inv=findInv(o.facNum); if(!inv) return {err:'Facture introuvable'};
    if(inv.annulee) return {err:'Cette facture est déjà annulée'};
    var m=r2(o.montant);
    if(!(m>0)) return {err:'Montant de l\'avoir à saisir (plus que 0)'};
    if(m>inv.reste+0.005) return {err:'Montant supérieur à ce qui reste sur la facture ('+money(inv.reste)+')'};
    var total=Math.abs(m-inv.reste)<0.006;
    var av={id:'av'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),num:numero,date:today(),
      facNum:inv.num,facDate:inv.date,kind:inv.kind,refId:inv.id,which:inv.which,label:inv.label,
      cli:JSON.parse(JSON.stringify(inv.cli||{})),montant:m,factMontant:inv.montant,total:total,basis:inv.basis,
      franchise:franchise(),taux:(function(){ try{ return num(P.tva); }catch(e){ return 0; } })(),tvaR:inv.tvaR||null,
      motif:String(o.motif||'').trim(),factPayee:!!inv.payeLe,rembourse:null,libere:false,created:Date.now()};
    if(av.factPayee&&o.rembDate) av.rembourse={date:o.rembDate,mode:o.rembMode||''};
    return {av:av,inv:inv,total:total};
  }
  function commitAvoir(b,o){
    var av=b.av;
    AV.push(av); put(AK,AV);
    if(b.total&&o.liberer){ av.libere=release(b.inv,av.num); put(AK,AV); }
    try{ updateBadges(); }catch(e){}
    return {av:av};
  }
  window.nxAvoirBuild=buildAvoir;
  window.nxAvoirCommit=commitAvoir;
  function createAvoir(o){
    var b=buildAvoir(o,null); if(b.err) return b;
    b.av.num=nextAvNum();                       /* numéro pris seulement si tout est valable, comme avant */
    return commitAvoir(b,o);
  }
  window.nxCreateAvoir=createAvoir;

  /* ---------- PDF ---------- */
  function printAvoir(id){
    var av=AV.find(function(a){ return a.id===id||a.num===id; }); if(!av) return;
    var E={}; try{ E=P.entreprise||{}; }catch(e){}
    var OR='#121417', T=taxOf(av), cli=av.cli||{};
    var lib=av.total?'Annulation de la facture '+av.facNum+' — '+av.label:'Avoir partiel sur la facture '+av.facNum+' — '+av.label;
    var etat=av.factPayee?(av.rembourse?'Montant remboursé le '+fr(av.rembourse.date)+(av.rembourse.mode?' par '+av.rembourse.mode.toLowerCase():'')+'.':'Ce montant vous sera remboursé.')
      :(av.total?'La facture '+av.facNum+' est annulée : elle n\'est plus due.':'Ce montant vient en déduction de la facture '+av.facNum+', qui reste due pour '+money(r2(av.factMontant-AV.filter(function(a){ return a.facNum===av.facNum&&a.created<=av.created; }).reduce(function(s,a){ return s+num(a.montant); },0)))+'.');
    var tva=av.franchise?'<div style="margin-top:10px;font-size:11px;font-weight:700;color:#333">TVA non applicable — article 293 B du CGI</div>'
      :'<table style="border-collapse:collapse;font-size:11px;margin-top:10px">'+T.parts.map(function(p){ return '<tr><td style="padding:4px 10px">TVA '+String(p.rate).replace('.',',')+' % sur '+money(-p.ht)+'</td><td style="padding:4px 10px;text-align:right">'+money(-p.tva)+'</td></tr>'; }).join('')+'</table>';
    var tot=av.franchise?'<tr style="background:#f1f3f5"><td style="text-align:right;padding:8px;font-weight:800">Montant de l\'avoir</td><td style="text-align:right;padding:8px;font-weight:800">'+money(-T.ttc)+'</td></tr>'
      :'<tr><td style="text-align:right;padding:6px 8px">Total HT</td><td style="text-align:right;padding:6px 8px">'+money(-T.ht)+'</td></tr><tr><td style="text-align:right;padding:6px 8px">TVA</td><td style="text-align:right;padding:6px 8px">'+money(-T.tva)+'</td></tr><tr style="background:#f1f3f5"><td style="text-align:right;padding:8px;font-weight:800">Total TTC de l\'avoir</td><td style="text-align:right;padding:8px;font-weight:800">'+money(-T.ttc)+'</td></tr>';
    var nat='Prestation de services'; try{ nat=av.kind==='devis'?'Livraison de biens et prestation de services':'Prestation de services'; }catch(e){}
    var top=''; try{ top=docTop(E,OR,typeof IC_SNOW!=='undefined'?IC_SNOW:'',fr(av.date)); }catch(e){ top='<h2>'+esc(E.nom||'')+'</h2>'; }
    var legal=''; try{ legal=docLegal(E,OR); }catch(e){}
    var ment=''; try{ ment=facMentions(nat,{cSiren:cli.siren,cAdr:cli.adr},E); }catch(e){}
    var doc=document.getElementById('devisDoc'); if(!doc) return;
    doc.innerHTML='<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px">'+top+
      '<div style="display:flex;justify-content:flex-end;margin:6px 0 14px"><div style="border:1px solid #ccc;border-radius:4px;padding:10px 14px;font-size:12px;min-width:240px"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.05em">Client</div><b>'+esc(cli.nom||'—')+'</b><br>'+esc(cli.adr||'')+'<br>'+esc(cli.ville||'')+(cli.siren?'<br>SIREN '+esc(cli.siren):'')+'</div></div>'+
      '<div style="text-align:center;margin-bottom:4px"><span style="font-size:18px;font-weight:800">AVOIR N° '+esc(av.num)+'</span></div>'+
      '<div style="text-align:center;font-size:12px;color:#555;margin-bottom:14px">Avoir relatif à la facture <b>'+esc(av.facNum)+'</b> du '+fr(av.facDate)+'</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:'+OR+';color:#fff"><th style="text-align:left;padding:9px 12px">Désignation</th><th style="padding:9px 12px;text-align:right">Montant</th></tr></thead><tbody>'+
      '<tr><td style="text-align:left;padding:11px 12px;border:1px solid #eee">'+esc(lib)+(av.motif?'<div style="color:#666;margin-top:4px">Motif : '+esc(av.motif)+'</div>':'')+'</td><td style="text-align:right;padding:11px 12px;border:1px solid #eee;font-weight:600">'+money(-(av.franchise?T.ttc:(av.basis==='ttc'?T.ht:num(av.montant))))+'</td></tr></tbody></table>'+
      tva+'<div style="display:flex;justify-content:flex-end;margin-top:14px"><table style="border-collapse:collapse;font-size:12px;min-width:270px">'+tot+'</table></div>'+
      '<div style="margin-top:12px;font-size:11px;color:#333"><b>'+esc(etat)+'</b></div>'+ment+
      '<div style="margin-top:14px;font-size:9.5px;color:#777;border-top:1px solid #eee;padding-top:8px">'+esc(E.piedNote||'')+'</div>'+legal+'</div>';
    window.print();
  }
  window.nxPrintAvoir=printAvoir;

  /* ---------- fenêtre « Nouvel avoir » ---------- */
  var MOTIFS=['Erreur sur le montant facturé','Erreur de client ou de coordonnées','Prestation annulée','Prestation non réalisée en totalité','Geste commercial','Remise accordée après facturation','Autre'];
  function modal(){
    var m=document.getElementById('mAvoir'); if(m) return m;
    m=document.createElement('div'); m.className='modal'; m.id='mAvoir';
    m.innerHTML='<div class="box" style="max-width:560px"><div class="hd"><b>Avoir — corriger une facture</b><button class="iconbtn" onclick="closeModal(\'mAvoir\')">✕</button></div><div class="bd" id="mAvoirBd"></div>'+
      '<div class="navbtns"><button class="btn-ghost" onclick="closeModal(\'mAvoir\')">Annuler</button><button class="btn-pri" onclick="nxavValider()">Émettre l\'avoir</button></div></div>';
    document.body.appendChild(m); return m;
  }
  var CUR=null;
  window.nxavOpen=function(facNum){
    var inv=findInv(facNum); if(!inv){ say('Facture introuvable'); return; }
    if(inv.annulee){ say('Facture déjà annulée par '+inv.annulee); return; }
    if(!(inv.reste>0.005)){ say('Cette facture est déjà entièrement couverte par un avoir'); return; }
    CUR=inv; var m=modal();
    var canFree=(inv.kind!=='devis'||inv.which!=='acompte'||!((DEVIS||[]).find(function(d){ return d.id===inv.id; })||{}).facSolde);
    document.getElementById('mAvoirBd').innerHTML=
      '<div class="recap-line"><div><b>Facture '+esc(inv.num)+'</b> du '+fr(inv.date)+'<div class="sub2">'+esc(inv.cli.nom||'—')+' · '+esc(inv.label)+'</div></div><div><b>'+money(inv.montant)+'</b></div></div>'+
      (inv.credite>0?'<div class="nxd2-hint">Déjà couvert par avoir : '+money(inv.credite)+' — reste '+money(inv.reste)+'</div>':'')+
      '<div class="frm" style="margin-top:10px">'+
        '<label class="full">Type d\'avoir<select id="avType" onchange="nxavSync()"><option value="total">Total : annuler '+(inv.credite>0?'le reste ('+money(inv.reste)+')':'toute la facture')+'</option><option value="partiel">Partiel : un montant</option></select></label>'+
        '<label id="avMontL" style="display:none">Montant de l\'avoir ('+(inv.basis==='ttc'||franchise()?'€':'€ HT')+')<input type="number" id="avMont" step="0.01" min="0" value="'+inv.reste+'"></label>'+
        '<label class="full">Motif<select id="avMotif" onchange="nxavSync()">'+MOTIFS.map(function(x){ return '<option>'+esc(x)+'</option>'; }).join('')+'</select></label>'+
        '<label class="full" id="avAutreL" style="display:none">Précise le motif<input id="avAutre"></label>'+
        (canFree?'<label class="nxd2-chk full" id="avLibL"><input type="checkbox" id="avLib" checked> <span>Refaire ensuite une facture corrigée (l\''+({devis:'chantier',dep:'intervention',loc:'location',ctr:'année de contrat'})[inv.kind]+' redevient facturable ; l\'ancienne facture reste au registre, marquée annulée)</span></label>':'')+
        (inv.payeLe?'<div class="full nxd2-warn">Facture déjà payée le '+fr(inv.payeLe)+' : l\'avoir est à <b>rembourser</b> au client.</div>'+
          '<label class="nxd2-chk full"><input type="checkbox" id="avRembOk" onchange="nxavSync()"> <span>Remboursement déjà fait</span></label>'+
          '<label id="avRembDL" style="display:none">Date du remboursement<input type="date" id="avRembD" value="'+today()+'"></label>'+
          '<label id="avRembML" style="display:none">Mode<select id="avRembM"><option>Virement</option><option>Chèque</option><option>Espèces</option><option>Carte</option></select></label>':'')+
      '</div>'+
      '<div class="nxd2-hint" style="margin-top:10px">Un avoir est un document comptable définitif : il ne se supprime pas. Numéro attribué : série AV- continue.</div><div id="avErr"></div>';
    m.classList.add('on'); nxavSync();
  };
  window.nxavSync=function(){
    var t=(document.getElementById('avType')||{}).value, ml=document.getElementById('avMontL'), lib=document.getElementById('avLibL');
    if(ml) ml.style.display=t==='partiel'?'':'none'; if(lib) lib.style.display=t==='partiel'?'none':'';
    var mo=(document.getElementById('avMotif')||{}).value, al=document.getElementById('avAutreL'); if(al) al.style.display=mo==='Autre'?'':'none';
    var ok=(document.getElementById('avRembOk')||{}).checked; ['avRembDL','avRembML'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=ok?'':'none'; });
  };
  window.nxavValider=function(){
    if(!CUR) return;
    var t=document.getElementById('avType').value, mo=document.getElementById('avMotif').value;
    var motif=mo==='Autre'?((document.getElementById('avAutre')||{}).value||'').trim():mo;
    var err=document.getElementById('avErr');
    if(mo==='Autre'&&!motif){ err.innerHTML='<div class="nxd2-warn red">Précise le motif (il est imprimé sur l\'avoir).</div>'; return; }
    var m=t==='partiel'?num(document.getElementById('avMont').value):CUR.reste;
    var o={facNum:CUR.num,montant:m,motif:motif,liberer:t!=='partiel'&&!!(document.getElementById('avLib')||{}).checked};
    if((document.getElementById('avRembOk')||{}).checked){ o.rembDate=document.getElementById('avRembD').value||today(); o.rembMode=document.getElementById('avRembM').value; }
    if(!confirm('Émettre un avoir de '+money(m)+' sur la facture '+CUR.num+' ?\n\nC\'est définitif (un avoir ne se supprime pas).')) return;
    var fin=function(r){
      if(!r||r.err){ err.innerHTML='<div class="nxd2-warn red">'+esc((r&&r.err)||'Avoir non émis')+'</div>'; return; }
      closeModal('mAvoir'); CUR=null;
      say('Avoir '+r.av.num+' émis'+(r.av.libere?' — tu peux refaire la facture corrigée':''));
      refreshAll(); if(!r.imprime) window.nxPrintAvoir(r.av.id);
    };
    if(typeof window.nxAvoirEmit==='function') Promise.resolve(window.nxAvoirEmit(o)).then(fin,function(e){ fin({err:String(e&&e.message||e)}); });
    else fin(createAvoir(o));
  };
  window.nxavRembourse=function(id){
    var av=AV.find(function(a){ return a.id===id; }); if(!av||av.rembourse) return;
    var d=prompt('Date du remboursement (jj/mm/aaaa)',fr(today())); if(d==null) return;
    var iso=(window.nxToISO?nxToISO(d):'')||today();
    var mode='Virement'; try{ mode=askMode(); }catch(e){}
    av.rembourse={date:iso,mode:mode||''}; put(AK,AV); refreshAll(); say('Remboursement noté — il apparaît au livre des recettes');
  };
  function refreshAll(){ ['renderAvoirs','renderRecettes','renderDash','renderDep','renderLoc','renderContrats','renderFBloc','nxRenderDocs'].forEach(function(f){ try{ if(f==='renderAvoirs'){ if(window._curView==='nx_avoirs') renderAvoirs(); return; } if(typeof window[f]==='function'&&(f==='renderFBloc'||viewOf(f)===window._curView)) window[f](); }catch(e){} }); try{ updateBadges(); }catch(e){} }
  function viewOf(f){ return {renderRecettes:'recettes',renderDash:'dash',renderDep:'dep',renderLoc:'loc',renderContrats:'contrats',nxRenderDocs:'nx_docs'}[f]; }

  /* ---------- vue « Avoirs » ---------- */
  var Q='';
  function renderAvoirs(){
    var box=document.getElementById('nxav'); if(!box) return;
    var inv=invoices(), arem=AV.filter(function(a){ return a.factPayee&&!a.rembourse; });
    var q=Q.toLowerCase(), list=inv.filter(function(i){ return !q||(i.num+' '+(i.cli.nom||'')+' '+i.label).toLowerCase().indexOf(q)>=0; }).slice(0,60);
    var y=String(new Date().getFullYear()), ay=AV.filter(function(a){ return String(a.date).slice(0,4)===y; });
    box.innerHTML='<div class="next-hero"><h2>🧾 Avoirs</h2><p>Une facture émise ne se supprime pas et ne se modifie pas : on la corrige par un <b>avoir</b> (total ou partiel), avec son propre numéro AV-. Pour refaire une facture juste : avoir total, puis nouvelle facture.</p></div>'+
      '<div class="kpis"><div class="kpi blue"><div class="lab">Avoirs '+y+'</div><div class="val">'+ay.length+'</div></div><div class="kpi warn"><div class="lab">Montant '+y+'</div><div class="val">'+money(ay.reduce(function(s,a){ return s+num(a.montant); },0))+'</div></div>'+
      '<div class="kpi '+(arem.length?'bad':'good')+'"><div class="lab">À rembourser</div><div class="val">'+arem.length+(arem.length?' ('+money(arem.reduce(function(s,a){ return s+num(a.montant); },0))+')':'')+'</div></div></div>'+
      (arem.length?'<div class="card"><h2>💸 À rembourser au client</h2>'+arem.map(function(a){ return '<div class="recap-line"><div><b>'+esc(a.num)+'</b> — '+esc(a.cli.nom||'—')+'<div class="sub2">sur facture '+esc(a.facNum)+' payée · '+money(a.montant)+'</div></div><button class="btn-pri btn-sm" onclick="nxavRembourse(\''+a.id+'\')">Remboursé</button></div>'; }).join('')+'</div>':'')+
      '<div class="card"><h2>Avoirs émis</h2>'+(AV.length?'<div class="scroll"><table><thead><tr><th class="l">N°</th><th class="l">Date</th><th class="l">Facture</th><th class="l">Client</th><th>Montant</th><th class="l">État</th><th></th></tr></thead><tbody>'+
        AV.slice().sort(function(a,b){ return String(b.num).localeCompare(String(a.num),undefined,{numeric:true}); }).map(function(a){ return '<tr><td class="l"><b>'+esc(a.num)+'</b></td><td class="l">'+fr(a.date)+'</td><td class="l">'+esc(a.facNum)+'</td><td class="l">'+esc(a.cli.nom||'—')+'</td><td>'+money(a.montant)+'</td><td class="l">'+(a.total?'Annulation':'Partiel')+(a.factPayee?(a.rembourse?' · remboursé':' · <b>à rembourser</b>'):'')+(a.libere?' · refacturable':'')+'</td><td><button class="btn-ghost btn-sm" onclick="nxPrintAvoir(\''+a.id+'\')">PDF</button>'+(typeof window.nxEinvDownload==='function'?' <button class="btn-ghost btn-sm" onclick="nxEinvDownload(\''+a.num+'\')">XML</button>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>':'<div class="empty">Aucun avoir pour l\'instant.</div>')+'</div>'+
      '<div class="card"><h2>Faire un avoir sur une facture</h2><div class="searchbar"><input id="nxavQ" placeholder="🔎 N° de facture, client…" value="'+esc(Q)+'" oninput="nxavSearch(this.value)"></div>'+
        (list.length?'<div class="scroll"><table><thead><tr><th class="l">Facture</th><th class="l">Date</th><th class="l">Client</th><th>Montant</th><th class="l">État</th><th></th></tr></thead><tbody>'+list.map(function(i){
          var st=i.annulee?'Annulée ('+esc(String(i.annulee))+')':i.reste<=0.005?'Couverte par avoir':(i.payeLe?'Payée':'À encaisser')+(i.credite>0?' · avoir '+money(i.credite):'');
          return '<tr><td class="l"><b>'+esc(i.num)+'</b><div class="sub2">'+esc(i.label)+'</div></td><td class="l">'+fr(i.date)+'</td><td class="l">'+esc(i.cli.nom||'—')+'</td><td>'+money(i.montant)+'</td><td class="l">'+st+'</td><td>'+(!i.annulee&&i.reste>0.005?'<button class="btn-ghost btn-sm" onclick="nxavOpen(\''+esc(i.num)+'\')">Faire un avoir</button>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>':'<div class="empty">Aucune facture'+(q?' pour « '+esc(Q)+' »':'')+'.</div>')+'</div>';
  }
  window.renderAvoirs=renderAvoirs;
  window.nxavSearch=function(v){ Q=v; clearTimeout(window.nxavSearch.t); window.nxavSearch.t=setTimeout(function(){ renderAvoirs(); var i=document.getElementById('nxavQ'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } },250); };

  /* ---------- prise en compte partout ---------- */
  function wrapAll(){
    if(typeof window.allImpayes==='function'&&!window.allImpayes._nxav){
      var oi=window.allImpayes;
      window.allImpayes=function(){ var r=oi.apply(this,arguments); try{ r=r.map(function(f){ var c=AV.filter(function(a){ return a.facNum===f.num&&!a.factPayee; }).reduce(function(s,a){ return s+num(a.montant); },0); if(c>0) return Object.assign({},f,{montant:r2(f.montant-c),avoir:c}); return f; }).filter(function(f){ return f.montant>0.005; }); }catch(e){} return r; };
      window.allImpayes._nxav=true;
    }
    if(typeof window.allRecettes==='function'&&!window.allRecettes._nxav){
      var orc=window.allRecettes;
      window.allRecettes=function(){ var r=orc.apply(this,arguments);
        try{
          /* encaissement d'origine des factures annulées (il a bien eu lieu) */
          invoices().filter(function(i){ return i.annulee&&i.payeLe; }).forEach(function(i){ if(!r.some(function(x){ return x.num===i.num; })) r.push({date:i.payeLe,client:i.cli.nom||'—',nature:i.label+' (facture annulée '+i.annulee+')',num:i.num,montant:i.montant,mode:i.mode||''}); });
          /* avoir émis AVANT paiement : le client a payé le montant réduit */
          r=r.map(function(x){ var c=AV.filter(function(a){ return a.facNum===x.num&&!a.factPayee; }).reduce(function(s,a){ return s+num(a.montant); },0); return c>0?Object.assign({},x,{montant:r2(x.montant-c),nature:x.nature+' (avoir déduit)'}):x; }).filter(function(x){ return Math.abs(x.montant)>0.005; });
          /* remboursements : ligne négative à la date du remboursement */
          AV.forEach(function(a){ if(a.factPayee&&a.rembourse) r.push({date:a.rembourse.date,client:a.cli.nom||'—',nature:'Remboursement — avoir '+a.num+' (facture '+a.facNum+')',num:a.num,montant:-r2(a.montant),mode:a.rembourse.mode||''}); });
        }catch(e){}
        return r.sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:0; }); };
      window.allRecettes._nxav=true;
    }
    if(typeof window.renderFBloc==='function'&&!window.renderFBloc._nxav){
      var of=window.renderFBloc;
      window.renderFBloc=function(){ var r=of.apply(this,arguments);
        try{ var el=document.getElementById('fBloc'), d=typeof cur!=='undefined'?cur:null; if(!el||!d) return r;
          var fs=[d.facAcompte,d.facSolde].filter(Boolean); if(!fs.length&&!(d.facAnnulees||[]).length) return r;
          var h='<div class="nxav-inbloc"><b>Corriger une facture</b> : '+fs.map(function(f){ return '<button type="button" class="btn-ghost btn-sm" onclick="nxavOpen(\''+esc(f.num)+'\')">Avoir sur '+esc(f.num)+'</button>'; }).join(' ')+
            ((d.facAnnulees||[]).length?'<div class="sub2" style="margin-top:4px">Factures annulées : '+d.facAnnulees.map(function(f){ return esc(f.num)+' (avoir '+esc(f.avoir)+')'; }).join(', ')+'</div>':'')+'</div>';
          var old=el.querySelector('.nxav-inbloc'); if(old) old.remove(); el.insertAdjacentHTML('beforeend',h); }catch(e){}
        return r; };
      window.renderFBloc._nxav=true;
    }
  }
  /* registre des documents (point d'entrée prévu dans next-addons) */
  window.nxDocsExtra=function(docs){
    try{
      var inv=invoices(), byNum={}; inv.forEach(function(i){ byNum[i.num]=i; });
      docs.forEach(function(d){ if(d.type!=='Facture') return; var i=byNum[d.num]; if(i&&i.credite>0) d.statut=(i.reste<=0.005?'Annulée par avoir':d.statut+' · avoir '+money(i.credite)); });
      inv.filter(function(i){ return i.annulee; }).forEach(function(i){ docs.push({num:i.num,type:'Facture',stype:'Facture annulée',date:i.date||'',client:i.cli.nom||'—',montant:i.montant,statut:'Annulée ('+i.annulee+')',open:"go('nx_avoirs')"}); });
      AV.forEach(function(a){ docs.push({num:a.num,type:'Avoir',stype:a.total?'Avoir (annulation)':'Avoir partiel',date:a.date,client:(a.cli||{}).nom||'—',montant:-num(a.montant),statut:'sur '+a.facNum+(a.factPayee?(a.rembourse?' · remboursé':' · à rembourser'):''),open:"nxPrintAvoir('"+a.id+"')"}); });
    }catch(e){}
    return docs;
  };

  var CSS='.nxav-inbloc{margin-top:10px;padding:8px 10px;border:1px dashed var(--line2,#cfd8e3);border-radius:8px;font-size:13px}.nxav-inbloc .btn-sm{margin:4px 4px 0 0}';
  function boot(){
    try{
      if(!document.getElementById('nxavStyle')){ var st=document.createElement('style'); st.id='nxavStyle'; st.textContent=CSS; document.head.appendChild(st); }
      if(typeof TITLES!=='undefined'&&!TITLES.nx_avoirs) TITLES.nx_avoirs=['Avoirs','Corriger ou annuler une facture émise — série AV- continue.'];
      var nav=document.getElementById('nav');
      if(nav&&!nav.querySelector('a[data-v="nx_avoirs"]')){
        var ref=nav.querySelector('a[data-v="nx_docs"]')||nav.querySelector('a[data-v="recettes"]');
        var a=document.createElement('a'); a.setAttribute('data-v','nx_avoirs'); a.innerHTML='<span class="ico">🧾</span><span class="txt">Avoirs</span><span class="badge" id="nxavBadge" style="display:none">0</span>';
        if(ref&&ref.parentNode) ref.parentNode.insertBefore(a,ref.nextSibling); else nav.appendChild(a);
      }
      if(!document.getElementById('v-nx_avoirs')){
        var dash=document.getElementById('v-dash'), parent=dash?dash.parentNode:document.querySelector('.content');
        if(parent){ var sec=document.createElement('section'); sec.className='view'; sec.id='v-nx_avoirs'; sec.innerHTML='<div id="nxav"></div>'; parent.appendChild(sec); }
      }
      var og=window.go; if(typeof og==='function'&&!og._nxav){ window.go=function(v){ var r=og.apply(this,arguments); try{ if(v==='nx_avoirs') renderAvoirs(); }catch(e){} return r; }; window.go._nxav=true; }
      var ub=window.updateBadges; if(typeof ub==='function'&&!ub._nxav){ window.updateBadges=function(){ var r=ub.apply(this,arguments); try{ var n=AV.filter(function(a){ return a.factPayee&&!a.rembourse; }).length, b=document.getElementById('nxavBadge'); if(b){ b.textContent=n; b.style.display=n?'':'none'; } }catch(e){} return r; }; window.updateBadges._nxav=true; }
      wrapAll();
      try{ updateBadges(); }catch(e){}
    }catch(e){ try{ console.error('nxav',e); }catch(_){} }
  }
  /* données rechargées depuis le cloud / une sauvegarde : relire la liste */
  window.nxavReload=function(){ AV=arr(AK); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
