/* ============================================================
   ClimPilot Next — next-einvoice.js  (couche additive, 01/10/2026)
   FACTURE ÉLECTRONIQUE — préparation à la réforme.
   - Chaque facture et chaque avoir peut être produit au format
     électronique structuré CII (UN/CEFACT Cross Industry Invoice D16B),
     profil européen EN 16931 — l'un des formats du « socle » de la réforme
     (UBL, CII, Factur-X ; Factur-X = PDF + ce même XML CII).
     Facture : code 380 ; acompte : 386 ; avoir : 381 + référence à la
     facture d'origine. Franchise de TVA : catégorie E, code
     VATEX-FR-FRANCHISE + mention en clair.
   - Vérifié contre le schéma XSD Factur-X/CII et les règles officielles
     EN 16931 (schematron CEN) — voir tests/suiteF-einvoice.
   - « Prêt pour la réforme » : liste ce qui manque (SIREN, adresse…).
   - Mention de franchise : « art. 293 B du CGI » jusqu'au 31/12/2026, puis
     « art. L. 233-3 du CIBS » (recodification au 01/01/2027 ; les deux sont
     admises jusqu'au 30/06/2028). Bascule automatique sur les PDF et le XML.
   La transmission elle-même passera par une plateforme agréée (obligatoire
   pour émettre à partir du 01/09/2027 pour les micro-entreprises) :
   ClimPilot fournit le fichier, la plateforme le transmet.
   ============================================================ */
(function(){
  'use strict';
  var CIBS_DATE='2027-01-01';
  function x(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function a2(n){ return r2(n).toFixed(2); }
  /* taux de TVA : « 20 » pour un taux entier, « 5.50 » sinon (règle française BR-FR-16 : liste fermée de chaînes) */
  function rt(n){ n=r2(n); return n===Math.round(n)?String(Math.round(n)):n.toFixed(2); }
  function d8(iso){ return String(iso||'').slice(0,10).replace(/-/g,''); }
  function today(){ try{ return todayISO(); }catch(e){ return new Date().toISOString().slice(0,10); } }
  function E(){ try{ return P.entreprise||{}; }catch(e){ return {}; } }
  function franchise(){ try{ return P.regimeTVA!=='assujetti'; }catch(e){ return true; } }
  /* régime À LA DATE du document : une facture émise en franchise reste en franchise même après une bascule */
  function franchiseAt(dateIso){
    var cur=franchise(), b=null; try{ b=(JSON.parse(localStorage.getItem('cpnext_regime')||'{}')||{}).bascule; }catch(e){}
    if(!b||!b.appliedOn) return cur;
    var on=String(b.appliedOn).slice(0,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(on)) return cur;
    return String(dateIso||'')<on?true:cur;
  }
  function mention(dateIso){ return String(dateIso||today())>=CIBS_DATE?'TVA non applicable, art. L. 233-3 du CIBS':'TVA non applicable, art. 293 B du CGI'; }
  window.nxFranchiseMention=mention;
  function siren(s){ var d=String(s||'').replace(/\D/g,''); return d.length>=9?d.slice(0,9):''; }
  function splitVille(v){ var m=/^\s*(\d{5})\s+(.+)$/.exec(String(v||'')); return m?{cp:m[1],ville:m[2].trim()}:{cp:'',ville:String(v||'').trim()}; }
  function iban(s){ var m=String(s||'').replace(/\s/g,'').toUpperCase().match(/FR\d{2}[0-9A-Z]{23}/); return m?m[0]:''; }

  /* ---------- données d'un document (facture ou avoir) ---------- */
  function docOf(n){
    var inv=(window.nxInvoices?nxInvoices():[]).find(function(i){ return i.num===n; });
    if(inv) return {kind:'facture',inv:inv};
    var av=(window.nxAvoirs?nxAvoirs():[]).find(function(a){ return a.num===n; });
    if(av) return {kind:'avoir',av:av};
    return null;
  }
  /* lignes : une par taux de TVA (montants HT), cohérentes au centime avec la facture */
  function linesOf(montant,basis,tvaR,fr,label){
    if(fr) return [{label:label,ht:r2(montant),rate:0,cat:'E'}];
    var rates=(tvaR&&tvaR.length)?tvaR:[{rate:num((function(){ try{ return P.tva; }catch(e){ return 20; } })()),part:1}];
    var out=[];
    rates.forEach(function(t,i){ var share=montant*num(t.part); var ht=basis==='ttc'?share/(1+num(t.rate)/100):share; out.push({label:label+(rates.length>1?' — part TVA '+String(t.rate).replace('.',',')+' %':''),ht:r2(ht),rate:num(t.rate),cat:num(t.rate)>0?'S':'Z'}); });
    return out;
  }
  function model(n){
    var D=docOf(n); if(!D) return null;
    var e=E(), fr=franchise(), m;
    if(D.kind==='facture'){
      var i=D.inv, f=i.f||{}, type='380', prepaid=0, label=i.label;
      fr=f.tvaR?false:franchiseAt(i.date);
      if(i.kind==='devis'&&i.which==='acompte') type='386';
      var total=i.montant;
      if(i.kind==='devis'&&i.which==='solde'){
        var d=(DEVIS||[]).find(function(o){ return o.id===i.id; })||{};
        if(d.facAcompte&&f.total!=null){ total=num(f.total); prepaid=num(d.facAcompte.montant); }
      }
      m={id:i.num,type:type,date:i.date,cli:i.cli||{},lines:linesOf(total,i.basis,f.tvaR,fr,label),prepaid:prepaid,franchise:fr,ref:null,payeLe:i.payeLe,label:label,kind:i.kind};
    } else {
      var a=D.av;
      m={id:a.num,type:'381',date:a.date,cli:a.cli||{},lines:linesOf(num(a.montant),a.basis,a.tvaR,a.franchise,(a.total?'Annulation de la facture ':'Avoir sur la facture ')+a.facNum+(a.motif?' — '+a.motif:'')),prepaid:0,franchise:a.franchise,ref:{id:a.facNum,date:a.facDate},payeLe:null,label:a.label,kind:a.kind};
    }
    var taxes={}; m.lines.forEach(function(l){ var k=l.cat+'|'+l.rate; (taxes[k]=taxes[k]||{cat:l.cat,rate:l.rate,base:0}).base+=l.ht; });
    m.taxes=Object.keys(taxes).map(function(k){ var t=taxes[k]; t.base=r2(t.base); t.tva=r2(t.base*t.rate/100); return t; });
    m.lineTotal=r2(m.lines.reduce(function(s,l){ return s+l.ht; },0));
    m.taxTotal=r2(m.taxes.reduce(function(s,t){ return s+t.tva; },0));
    m.grand=r2(m.lineTotal+m.taxTotal);
    m.due=r2(m.grand-m.prepaid);
    m.seller=e;
    return m;
  }

  /* ---------- ce qui manque pour une facture électronique complète ---------- */
  function checks(m){
    var w=[], e=m?m.seller:E();
    if(!siren(e.siret)) w.push('Ton SIRET (Paramètres → entreprise) : obligatoire pour identifier le vendeur');
    if(!e.nom||e.nom==='—') w.push('Le nom de ton entreprise (Paramètres)');
    if(!e.adresse||!e.cp||!e.ville) w.push('Ton adresse complète : rue, code postal, ville (Paramètres)');
    if(!franchise()&&!e.tvaIntra) w.push('Ton n° de TVA intracommunautaire (tu es assujetti à la TVA)');
    if(m){
      var c=m.cli||{}, sv=splitVille(c.ville);
      if(!c.nom) w.push('Nom du client');
      if(!c.adr||!sv.cp) w.push('Adresse du client avec code postal (« 60600 Clermont » dans la case Ville)');
      if(String(c.type||'')==='Professionnel'&&!siren(c.siren)) w.push('SIREN du client professionnel (obligatoire en B2B à partir du 01/09/2027)');
    }
    return w;
  }
  window.nxEinvChecks=function(n){ return checks(n?model(n):null); };

  /* ---------- XML CII EN 16931 ---------- */
  function party(tag,p,isSeller){
    var sv=isSeller?{cp:p.cp||'',ville:p.ville||''}:splitVille(p.ville), adr=isSeller?p.adresse:p.adr, s=siren(isSeller?p.siret:p.siren);
    var o='<ram:'+tag+'><ram:Name>'+x((isSeller?p.nom:p.nom)||'—')+'</ram:Name>';
    if(s) o+='<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">'+s+'</ram:ID></ram:SpecifiedLegalOrganization>';
    o+='<ram:PostalTradeAddress>'+(sv.cp?'<ram:PostcodeCode>'+x(sv.cp)+'</ram:PostcodeCode>':'')+(adr?'<ram:LineOne>'+x(adr)+'</ram:LineOne>':'')+(sv.ville?'<ram:CityName>'+x(sv.ville)+'</ram:CityName>':'')+'<ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>';
    /* adresse électronique de facturation (BT-34 / BT-49) : le SIREN dans l'annuaire officiel (schéma 0225) ;
       pour un particulier sans SIREN, son e-mail (schéma EM) */
    var mail=isSeller?p.email:p.mail;
    if(s) o+='<ram:URIUniversalCommunication><ram:URIID schemeID="0225">'+s+'</ram:URIID></ram:URIUniversalCommunication>';
    else if(mail) o+='<ram:URIUniversalCommunication><ram:URIID schemeID="EM">'+x(mail)+'</ram:URIID></ram:URIUniversalCommunication>';
    /* identifiant fiscal du vendeur (BT-31 n° TVA si tu en as un ; sinon BT-32 = SIREN, référence de ton statut fiscal en franchise) */
    if(isSeller){ var tv=String(p.tvaIntra||'').replace(/\s/g,'');
      if(tv) o+='<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">'+x(tv)+'</ram:ID></ram:SpecifiedTaxRegistration>';
      else if(s) o+='<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">'+s+'</ram:ID></ram:SpecifiedTaxRegistration>'; }
    return o+'</ram:'+tag+'>';
  }
  function taxXML(t,m,line){
    var exempt=t.cat==='E';
    if(line) return '<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>'+t.cat+'</ram:CategoryCode><ram:RateApplicablePercent>'+rt(exempt?0:t.rate)+'</ram:RateApplicablePercent></ram:ApplicableTradeTax>';
    return '<ram:ApplicableTradeTax><ram:CalculatedAmount>'+a2(t.tva)+'</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>'+(exempt?'<ram:ExemptionReason>'+x(mention(m.date))+'</ram:ExemptionReason>':'')+
      '<ram:BasisAmount>'+a2(t.base)+'</ram:BasisAmount><ram:CategoryCode>'+t.cat+'</ram:CategoryCode>'+(exempt?'<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>':'')+'<ram:RateApplicablePercent>'+rt(exempt?0:t.rate)+'</ram:RateApplicablePercent>'+'</ram:ApplicableTradeTax>';
  }
  /* ov (facultatif) : identités de remplacement pour un envoi de TEST sur le bac à sable de la plateforme
     { seller:{nom,siret,adresse,cp,ville,email}, buyer:{nom,siren,adr,ville,type}, suffix:'-T1' } */
  function xml(n,ov){
    var m=model(n); if(!m) return null;
    if(ov){ if(ov.seller) m.seller=Object.assign({},m.seller,ov.seller); if(ov.buyer) m.cli=Object.assign({},m.cli,ov.buyer); if(ov.suffix){ m.id=m.id+ov.suffix; if(m.ref) m.ref=Object.assign({},m.ref,{id:m.ref.id+ov.suffix}); } }
    var e=m.seller, pro=String((m.cli||{}).type||'')==='Professionnel';
    var notes=[];
    if(m.franchise) notes.push(['',mention(m.date)]);
    notes.push(['PMD','Pénalités de retard : 3 fois le taux d\'intérêt légal.']);
    notes.push(['PMT',pro?'Indemnité forfaitaire pour frais de recouvrement : 40 €.':'Indemnité forfaitaire pour frais de recouvrement (clients professionnels) : 40 €.']);
    notes.push(['AAB','Pas d\'escompte pour paiement anticipé.']);
    notes.push(['','Nature de l\'opération : '+(m.kind==='devis'?'livraison de biens et prestation de services':'prestation de services')+'.']);
    var h='<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">'+
      '<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>'+
      '<rsm:ExchangedDocument><ram:ID>'+x(m.id)+'</ram:ID><ram:TypeCode>'+m.type+'</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">'+d8(m.date)+'</udt:DateTimeString></ram:IssueDateTime>'+
      notes.map(function(t){ return '<ram:IncludedNote><ram:Content>'+x(t[1])+'</ram:Content>'+(t[0]?'<ram:SubjectCode>'+t[0]+'</ram:SubjectCode>':'')+'</ram:IncludedNote>'; }).join('')+'</rsm:ExchangedDocument>'+
      '<rsm:SupplyChainTradeTransaction>'+
      m.lines.map(function(l,i){ return '<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>'+(i+1)+'</ram:LineID></ram:AssociatedDocumentLineDocument>'+
        '<ram:SpecifiedTradeProduct><ram:Name>'+x(l.label)+'</ram:Name></ram:SpecifiedTradeProduct>'+
        '<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>'+a2(l.ht)+'</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>'+
        '<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>'+
        '<ram:SpecifiedLineTradeSettlement>'+taxXML(l,m,true)+'<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>'+a2(l.ht)+'</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>'+
        '</ram:IncludedSupplyChainTradeLineItem>'; }).join('')+
      '<ram:ApplicableHeaderTradeAgreement>'+party('SellerTradeParty',e,true)+party('BuyerTradeParty',m.cli||{},false)+'</ram:ApplicableHeaderTradeAgreement>'+
      '<ram:ApplicableHeaderTradeDelivery/>'+
      '<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>'+
      (m.type!=='381'&&iban(e.rib)?'<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>30</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>'+iban(e.rib)+'</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>':'')+
      m.taxes.map(function(t){ return taxXML(t,m,false); }).join('')+
      (m.due>0&&m.type!=='381'?'<ram:SpecifiedTradePaymentTerms><ram:Description>Paiement à réception de facture</ram:Description><ram:DueDateDateTime><udt:DateTimeString format="102">'+d8(m.date)+'</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>':'')+
      '<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>'+a2(m.lineTotal)+'</ram:LineTotalAmount><ram:TaxBasisTotalAmount>'+a2(m.lineTotal)+'</ram:TaxBasisTotalAmount>'+
        '<ram:TaxTotalAmount currencyID="EUR">'+a2(m.taxTotal)+'</ram:TaxTotalAmount><ram:GrandTotalAmount>'+a2(m.grand)+'</ram:GrandTotalAmount>'+(m.prepaid>0?'<ram:TotalPrepaidAmount>'+a2(m.prepaid)+'</ram:TotalPrepaidAmount>':'')+'<ram:DuePayableAmount>'+a2(m.due)+'</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>'+
      (m.ref?'<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>'+x(m.ref.id)+'</ram:IssuerAssignedID>'+(m.ref.date?'<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">'+d8(m.ref.date)+'</qdt:DateTimeString></ram:FormattedIssueDateTime>':'')+'</ram:InvoiceReferencedDocument>':'')+
      '</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>';
    return h;
  }
  window.nxEinvXML=xml;
  window.nxEinvModel=model;

  function dl(name,content,type){ var b=new Blob([content],{type:type||'application/xml'}); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(e){} },2000); }
  window.nxEinvDownload=function(n){
    var s=xml(n); if(!s){ try{ toast('Document introuvable'); }catch(e){} return; }
    var w=checks(model(n)); dl(n+'.xml',s);
    try{ toast(w.length?'⚠ XML '+n+' téléchargé — à compléter : '+w[0]+(w.length>1?' (+'+(w.length-1)+')':''):'📄 Facture électronique '+n+'.xml téléchargée'); }catch(e){}
  };
  /* export groupé (ZIP) des factures et avoirs d'une année */
  var ZIP='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  function loadZip(){ return new Promise(function(res,rej){ if(window.JSZip) return res(window.JSZip); var s=document.createElement('script'); s.src=ZIP; s.onload=function(){ window.JSZip?res(window.JSZip):rej(new Error('zip')); }; s.onerror=function(){ rej(new Error('Pas de connexion pour préparer le ZIP')); }; document.head.appendChild(s); }); }
  window.nxEinvExportYear=function(y){
    y=String(y||new Date().getFullYear());
    var nums=(window.nxInvoices?nxInvoices():[]).filter(function(i){ return String(i.date||'').slice(0,4)===y; }).map(function(i){ return i.num; })
      .concat((window.nxAvoirs?nxAvoirs():[]).filter(function(a){ return String(a.date||'').slice(0,4)===y; }).map(function(a){ return a.num; }));
    if(!nums.length){ try{ toast('Aucune facture ni avoir en '+y); }catch(e){} return Promise.resolve(0); }
    return loadZip().then(function(Z){ var z=new Z(); nums.forEach(function(n){ var s=xml(n); if(s) z.file(n+'.xml',s); }); return z.generateAsync({type:'blob'}); })
      .then(function(b){ var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ClimPilot_factures_electroniques_'+y+'.zip'; document.body.appendChild(a); a.click(); try{ toast(nums.length+' documents exportés ('+y+')'); }catch(e){} return nums.length; })
      .catch(function(err){ try{ toast('⚠ '+err.message+' — télécharge-les un par un depuis « Avoirs »'); }catch(e){} return 0; });
  };

  /* ---------- mention de franchise : bascule automatique au 01/01/2027 ---------- */
  function fixMention(){ if(today()<CIBS_DATE) return; var d=document.getElementById('devisDoc'); if(!d) return;
    var h=d.innerHTML, n=h.replace(/(art(?:icle|\.)\s*)293\s*B\s*du\s*CGI/gi,'art. L. 233-3 du CIBS'); if(n!==h) d.innerHTML=n; }
  function wrapPrint(){ var o=window.print; if(typeof o!=='function'||o._nxei) return; var w=function(){ try{ fixMention(); }catch(e){} return o.apply(this,arguments); }; w._nxei=true; window.print=w; }
  function wrapMail(){ var o=window.buildMail; if(typeof o!=='function'||o._nxei) return; var w=function(to,s,b){ try{ if(today()>=CIBS_DATE) b=String(b||'').replace(/(art(?:icle|\.)\s*)293\s*B\s*du\s*CGI/gi,'art. L. 233-3 du CIBS'); }catch(e){} return o.call(this,to,s,b); }; w._nxei=true; window.buildMail=w; }

  /* ---------- carte « Facture électronique » dans le registre des documents ---------- */
  function card(){
    var v=document.getElementById('nxDocs'); if(!v) return;
    var old=document.getElementById('nxeiCard'); if(old) old.remove();
    var w=checks(null), y=String(new Date().getFullYear());
    var c=document.createElement('div'); c.className='card'; c.id='nxeiCard';
    c.innerHTML='<h2>⚡ Facture électronique</h2>'+
      '<div class="sub" style="margin-bottom:8px">Chaque facture et chaque avoir existe aussi au format électronique officiel (XML CII, norme européenne EN 16931). À partir du <b>1er septembre 2027</b>, tes factures aux professionnels devront passer par une <b>plateforme agréée</b> : tu lui donneras ces fichiers (ou elle les récupérera).</div>'+
      (w.length?'<div class="warnbox">À compléter pour être prêt : <ul style="margin:4px 0 0 18px;padding:0">'+w.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')+'</ul></div>':'<div class="warnbox" style="background:var(--green-soft);border-color:#b7e3c6;color:#0f6b39">✅ Tes informations vendeur sont complètes.</div>')+
      '<div class="row-actions" style="margin-top:8px;flex-wrap:wrap"><button class="btn-ghost btn-sm" onclick="nxEinvExportYear(\''+y+'\')">⬇ Tous les XML '+y+' (ZIP)</button><button class="btn-ghost btn-sm" onclick="go(\'nx_avoirs\')">XML d\'une facture précise</button></div>'+
      '<div class="sub2" style="margin-top:6px">Mention de franchise : « '+esc(mention())+' »'+(today()<CIBS_DATE?' — passe toute seule à « art. L. 233-3 du CIBS » le 01/01/2027.':'.')+'</div>';
    v.insertBefore(c,v.children[1]||null);
  }
  function boot(){
    wrapPrint(); wrapMail();
    var og=window.go; if(typeof og==='function'&&!og._nxei){ window.go=function(v){ var r=og.apply(this,arguments); try{ if(v==='nx_docs') card(); }catch(e){} return r; }; window.go._nxei=true; }
    if(typeof window.nxRenderDocs==='function'&&!window.nxRenderDocs._nxei){ var o=window.nxRenderDocs; window.nxRenderDocs=function(){ var r=o.apply(this,arguments); try{ card(); }catch(e){} return r; }; window.nxRenderDocs._nxei=true; }
    /* bouton XML à côté de chaque facture dans l'écran Avoirs */
    if(typeof window.renderAvoirs==='function'&&!window.renderAvoirs._nxei){ var ra=window.renderAvoirs; window.renderAvoirs=function(){ var r=ra.apply(this,arguments); try{
      document.querySelectorAll('#nxav table tr').forEach(function(tr){ var b=tr.querySelector('td b'); var t=b&&b.textContent; if(!t||!/^F-\d{4}-\d+$/.test(t)||tr.querySelector('.nxei-x')) return; var td=tr.lastElementChild; td.insertAdjacentHTML('beforeend',' <button class="btn-ghost btn-sm nxei-x" onclick="nxEinvDownload(\''+t+'\')">XML</button>'); }); }catch(e){} return r; }; window.renderAvoirs._nxei=true; }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
