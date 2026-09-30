/* ============================================================
   ClimPilot Next — next-mod-depannage.js  (phase 3)
   Devis de réparation, quand la réparation ne se fait pas tout de
   suite (pièce à commander, montant à faire accepter).
   - diagnostic : équipement, symptôme, constat, mesures, cause avec
     son niveau (certaine / probable / à confirmer) ;
   - pièces (base de prix ou prix d'achat saisi), fluide (récupération,
     recherche de fuite, tirage au vide, recharge), main-d'œuvre au taux
     dépannage, majorations soir / samedi, dimanche / férié (tes réglages) ;
   - une 2e solution (remplacer au lieu de réparer) = lot en option ;
   - le bon d'intervention (onglet Interventions) peut devenir un devis
     de réparation d'un clic ; fiche fluide rappelée dès qu'il y a
     manipulation de fluide.
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2||!window.NXK) return;
  var K=NXK, A=K.A, esc=K.esc, num=K.num, MOD='depannage';
  var CERT=[['certaine','Certaine (mesurée ou constatée)'],['probable','Probable'],['confirmer','À confirmer (démontage, essai)']];
  var CERT_PDF={certaine:'cause certaine',probable:'cause probable',confirmer:'cause à confirmer'};
  var MEAS=[['hp','HP (bar)'],['bp','BP (bar)'],['tAsp','T° aspiration (°C)'],['tLiq','T° liquide (°C)'],['sh','Surchauffe (K)'],['sr','Sous-refroid. (K)'],['intens','Intensité (A)'],['tension','Tension (V)']];
  var UNITS_DEF={recup:0.75,charge:0.5,deshy:0.5};
  function fluids(){ return K.names(function(p){ return /^Fluide /i.test(p.nom); }); }
  function depRate(){ try{ return num(P.dep.taux)||num(P.defaultRate); }catch(e){ return 0; } }
  function defaults(){
    return {equip:{eqId:'',type:'',marque:'',modele:'',serie:'',fluide:'',charge:0},symptome:'',constat:'',mesures:{},cause:'',certitude:'probable',
      pieces:[],mo:[{l:'Réparation : dépose et repose des pièces, essais',h:2}],maj:'0',
      fl:{nom:K.first(fluids(),['Fluide R32 (au kg)']),recup:0,charge:0,recherche:0,vide:false,azote:false,deshy:true},
      diag:{deduire:false,montant:num((P.dep||{}).diag)},conso:true,consoDep:true,garantie:'',delai:'',units:K.initUnits(MOD,UNITS_DEF),custom:[]};
  }
  /* ancien formulaire « Dépannage » : copie à l'identique (même montant) */
  function fromLegacy(s){ var d=defaults(); d.legacyCopy=true; Object.assign(d,K.baseFromLegacy(s)); d.pieces=[]; d.mo=[]; return d; }
  function circuitOpen(d){ return num(d.fl.recup)>0||num(d.fl.charge)>0; }

  /* ---------- calcul ---------- */
  function compute(lot,ctx){
    var d=lot.data||{}, warn=[], rate=ctx.rate;
    if(d.legacyCopy){
      var b=K.base(d,ctx,{type:'Dépannage',mode:d.moMode==='heures'?'heures':'forfait',heures:d.heures,catLabel:'Main-d’œuvre — réparation'});
      K.legacyWarn(b.lines,warn); K.machineWarn(d,warn,'Machine');
      return {lines:b.lines,mat:b.mat,heures:b.heures,detailH:d.moMode==='heures'?b.heures:0,warnings:warn};
    }
    d.fl=d.fl||{}; d.diag=d.diag||{};
    var B=K.builder(warn), marg=num((P.dep||{}).margeP)||40;
    var PC=(d.pieces||[]).filter(function(p){ return p.nom&&num(p.qte)>0; });
    PC.forEach(function(p){ B.add(p.nom,p.qte,'pieces',null,{achat:num(p.achat)>0?num(p.achat):null,marge:K.pr(p.nom)?null:marg,unite:'u',pu:num(p.vente)>0?num(p.vente):null}); });
    var fo=circuitOpen(d);
    /* déshydrateur : pas en double si Gabriel l'a déjà mis dans les pièces */
    var dhManual=PC.some(function(p){ return /d[ée]shydrat/i.test(p.nom); });
    if(fo&&d.fl.deshy&&!dhManual) B.add('Filtre déshydrateur',1,'pieces');
    if(num(d.fl.charge)>0) B.add(d.fl.nom,d.fl.charge,'fluide',(d.fl.nom||'Fluide')+' — recharge');
    var flPiece=PC.filter(function(p){ return /^Fluide /i.test(p.nom); });
    if(flPiece.length&&num(d.fl.charge)>0) warn.push('Fluide compté deux fois ? « '+flPiece[0].nom+' » est dans les pièces ET en recharge ('+A.fq(num(d.fl.charge))+' kg) : garde-le à un seul endroit');
    /* main-d'œuvre */
    var u=K.units(d,UNITS_DEF), mo=[];
    (d.mo||[]).forEach(function(r){ var h=Math.max(0,num(r.h)); if(h>0) mo.push({l:r.l||'Main-d’œuvre',h:h}); });
    if(num(d.fl.recup)>0) mo.push({l:'Récupération du fluide ('+A.fq(num(d.fl.recup))+' kg)',h:u.recup});
    if(num(d.fl.recherche)>0) mo.push({l:'Recherche de fuite',h:num(d.fl.recherche)});
    if(num(d.fl.charge)>0) mo.push({l:'Mise en charge et réglages ('+A.fq(num(d.fl.charge))+' kg)',h:u.charge});
    if(fo&&d.fl.deshy) mo.push({l:'Remplacement du filtre déshydrateur',h:u.deshy});
    (d.custom||[]).forEach(function(c){ var h=Math.max(0,num(c.h)); if(h>0) mo.push({l:c.l||'Autre tâche',h:h}); });
    var heures=A.sum(mo,function(r){ return r.h; }), moHT=0;
    mo.forEach(function(r){ var l=B.raw('Pose & main-d’œuvre',r.l,A.fq(A.r2(r.h))+' h × '+A.money(rate)+'/h',r.h*rate,0,{qte:r.h,unite:'h',pu:rate,mo:true},'mo'); l.catLabel='Main-d’œuvre — réparation'; moHT+=r.h*rate; });
    var pct=d.maj==='soir'?num((P.dep||{}).majSoir):d.maj==='dim'?num((P.dep||{}).majDim):0;
    if(pct>0&&moHT>0){ var lm=B.raw('Pose & main-d’œuvre','Majoration '+(d.maj==='soir'?'soir / samedi':'dimanche / jour férié')+' ('+A.fq(pct)+' %)','',moHT*pct/100,0,{},'mo'); lm.catLabel='Main-d’œuvre — réparation'; }
    if(d.fl.vide&&num((P.tests||{}).vide)>0) B.raw('Mise en service & déplacement','Tirage au vide','',num(P.tests.vide),0,{},'mes');
    if(d.fl.azote&&num((P.tests||{}).azote)>0) B.raw('Mise en service & déplacement','Test azote (mise en pression)','',num(P.tests.azote),0,{},'mes');
    /* plusieurs lots de réparation dans le même devis (2 unités sur le même site) : consommables et déduction du diagnostic une seule fois */
    var before=((ctx.d&&ctx.d.lots)||[]).slice(0,ctx.index||0).filter(function(q){ return q&&q.module===MOD&&!q.option&&q.data&&!q.data.legacyCopy; });
    var consoDone=before.some(function(q){ return q.data.conso; }), diagDone=before.some(function(q){ return q.data.diag&&q.data.diag.deduire&&num(q.data.diag.montant)>0; });
    if(d.conso&&!lot.option&&consoDone) warn.push('Consommables déjà comptés dans un lot de réparation précédent : pas comptés une 2e fois');
    /* consommables : forfait dépannage (colliers, ruban, obus, nettoyant) ; les imprévus sont déjà couverts par la marge de sécurité.
       Anciens devis (sans consoDep) : ancien forfait « petit chantier », pour ne pas changer un devis déjà envoyé. */
    else if(d.conso){ var cv=d.consoDep?num((P.mesOpt||{}).conso):num((P.conso||{}).petit); if(cv>0) B.raw('Frais & divers',d.consoDep?'Consommables':'Consommables (petit chantier)',d.consoDep?'colliers, ruban, obus, nettoyant…':'visserie, colliers, nettoyant…',cv,cv*0.6,{},'divers'); }
    if(d.diag.deduire&&num(d.diag.montant)>0){
      if(!lot.option&&diagDone) warn.push('Diagnostic déjà déduit dans un lot précédent : pas déduit une 2e fois');
      else { var fd=d.fromDep||{}; B.raw('Frais & divers','Diagnostic déjà facturé'+(fd.facNum?' ('+fd.facNum+(fd.date?' du '+new Date(fd.date+'T00:00:00').toLocaleDateString('fr-FR'):'')+')':'')+' — déduit','',-num(d.diag.montant),0,{},'deduc');
        if(!fd.facNum) warn.push('Déduction d\'un diagnostic : aucune facture d\'intervention liée à ce devis — vérifie qu\'il a bien été facturé'); }
    }
    /* contrôles */
    if(!(d.pieces||[]).some(function(p){ return p.nom&&num(p.qte)>0; })&&!heures) warn.push('Rien à chiffrer : ajoute les pièces et/ou la main-d\'œuvre');
    (d.pieces||[]).forEach(function(p){ if(p.nom&&num(p.qte)>0&&!K.pr(p.nom)&&!(num(p.achat)>0)) warn.push('Pièce « '+p.nom+' » : prix d\'achat à saisir'); });
    if(d.certitude==='confirmer') warn.push('Cause « à confirmer » : le devis le dit au client ; prévois le cas où le diagnostic change');
    if(fo) warn.push('Manipulation de fluide : fiche d\'intervention (Cerfa 15497) à remplir le jour de l\'intervention');
    if(num(d.fl.recup)>0&&!num(d.fl.charge)) warn.push('Fluide récupéré sans recharge prévue : vérifie la quantité à recharger');
    /* circuit ouvert : le vide et l'essai d'étanchéité ne sont facturés que s'ils sont cochés */
    var brase=PC.some(function(p){ return /^(compresseur|d[ée]tendeur|filtre d[ée]shydrat|d[ée]shydrat|vanne|[ée]vaporateur|condenseur|voyant|bouteille)/i.test(p.nom)&&!/moteur|ventil|carte|sonde|capteur|bobine|condensat/i.test(p.nom); });
    if((fo||brase)&&(!d.fl.vide||!d.fl.azote)) warn.push('Circuit ouvert'+(brase&&!fo?' (pièce frigorifique remplacée)':'')+' : '+[!d.fl.azote?'essai d\'étanchéité à l\'azote':'',!d.fl.vide?'tirage au vide':''].filter(Boolean).join(' et ')+' non compté'+((!d.fl.vide&&!d.fl.azote)?'s':'')+' — coche-les si tu les fais, sinon ils ne sont pas facturés');
    if(num(d.fl.recherche)>0&&!(num(d.fl.charge)>0)) warn.push('Recherche de fuite sans recharge prévue : pense au fluide à remettre');
    if(brase&&!fo) warn.push('Pièce frigorifique remplacée sans fluide récupéré ni rechargé : renseigne la partie « fluide » (récupération / recharge)');
    K.verifWarn(B,warn);
    return {lines:B.lines,mat:B.mat,heures:heures,detailH:heures,warnings:warn};
  }

  /* ---------- formulaire ---------- */
  function render(lot,i){
    var d=lot.data, h='';
    if(d.legacyCopy){
      return '<div class="nxd2-banner">Copie d\'un ancien devis de dépannage : montants repris tels quels (machines, articles, main-d\'œuvre).<br>'+K.btn('Passer au devis de réparation détaillé','convert',i,null,'btn-pri btn-sm')+'</div>'+
        K.secMachines(d,i,{title:'Machines (ancien devis)',row:'Machine',add:true})+K.secExtras(d,i)+
        K.sec('Main-d\'œuvre','<div class="frm">'+A.fSel('Mode','data.moMode',d.moMode,[['forfait','Forfait (ancien réglage)'],['heures','Heures × taux']],{re:'lot'})+A.fIn('Heures','data.heures',d.heures,{t:'n',step:0.5})+'</div>');
    }
    var e=d.equip||{}, eqs=[]; try{ eqs=(EQUIP||[]).filter(function(x){ var c=String((A.cur()||{}).cNom||'').toLowerCase(); return !c||String(x.client||'').toLowerCase()===c; }); }catch(err){}
    h+=K.sec('Équipement',(eqs.length?'<div class="frm"><label class="full">Parc du client<select onchange="nxd2.act(\'pickEq\','+i+',null,this.value)"><option value="">— choisir un équipement enregistré —</option>'+eqs.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===e.eqId?' selected':'')+'>'+esc([x.type,x.marque,x.modele].filter(Boolean).join(' '))+(x.fluide?' — '+esc(x.fluide):'')+'</option>'; }).join('')+'</select></label></div>':'')+
      '<div class="frm nxk2">'+A.fIn('Type','data.equip.type',e.type,{ph:'split, vitrine, chambre positive…'})+A.fIn('Marque','data.equip.marque',e.marque)+A.fIn('Modèle','data.equip.modele',e.modele)+A.fIn('N° de série','data.equip.serie',e.serie)+
      A.fIn('Fluide','data.equip.fluide',e.fluide,{ph:'R32, R410A…'})+A.fIn('Charge (kg)','data.equip.charge',e.charge||'',{t:'n',step:0.01})+'</div>');
    h+=K.sec('Diagnostic','<div class="frm">'+A.fArea('Symptôme décrit par le client','data.symptome',d.symptome,{rows:2})+A.fArea('Constat','data.constat',d.constat,{rows:2})+'</div>'+
      '<div class="nxk-meas" style="margin-top:8px">'+MEAS.map(function(m){ return A.fIn(m[1],'data.mesures.'+m[0],(d.mesures||{})[m[0]]||'',{t:'n',step:0.1,min:-100}); }).join('')+'</div>'+
      '<div class="frm" style="margin-top:8px">'+A.fArea('Cause','data.cause',d.cause,{rows:2})+A.fSel('Niveau de certitude','data.certitude',d.certitude,CERT)+'</div>'+
      '<div class="nxd2-hint">Hypothèse ≠ certitude : « certaine » seulement si tu l\'as mesurée ou constatée. Le niveau est imprimé sur le devis.</div>');
    var ph=(d.pieces||[]).map(function(p,j){
      var q='data.pieces.'+j+'.', inBase=!!K.pr(p.nom);
      return '<div class="frm nxk2" style="align-items:end;margin-bottom:6px;border-bottom:1px solid var(--line,#e3e8ef);padding-bottom:6px">'+A.fIn('Pièce','data.pieces.'+j+'.nom',p.nom,{list:'nxdpPieceDL',re:'lot',full:true})+
        A.fIn('Quantité',q+'qte',p.qte,{t:'n',step:1})+A.fIn(inBase?'Achat HT (vide = base)':'Prix d\'achat HT (€)',q+'achat',p.achat||'',{t:'n',step:0.01})+
        A.fIn('Vente HT / u (vide = calculée)',q+'vente',p.vente||'',{t:'n',step:0.01})+
        A.fIn('Délai de livraison',q+'delai',p.delai,{ph:'ex. 48 h, 1 semaine'})+'<div class="calc">'+(inBase?esc(K.pInfo(p.nom)):(num(p.achat)?'vente '+A.money((function(){ try{ return priceVente(num(p.achat),num((P.dep||{}).margeP)||40); }catch(err){ return 0; } })())+' (marge pièces dépannage)':'prix à saisir'))+'</div>'+
        '<div>'+K.btn('🗑','delPiece',i,j,'iconbtn d')+'</div></div>';
    }).join('');
    var dl='<datalist id="nxdpPieceDL">'+K.names(function(p){ return p.cat==='Pièces dépannage'||p.cat==='Chambre froide'||p.cat==='Pompe'||/^Fluide /.test(p.nom); }).map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>';
    h+=K.sec('Pièces',dl+(ph||'<div class="nxd2-hint">Aucune pièce.</div>')+K.btn('+ Ajouter une pièce','addPiece',i)+'<div class="nxd2-hint">Une pièce absente de ta base : saisis son prix d\'achat, ta marge « pièces dépannage » ('+A.fq(num((P.dep||{}).margeP))+' %) s\'applique.</div>');
    var f=d.fl||{};
    h+=K.sec('Fluide frigorigène','<div class="frm nxk2">'+A.fSel('Fluide','data.fl.nom',f.nom,K.opts(fluids()))+A.fIn('Récupération (kg)','data.fl.recup',f.recup||'',{t:'n',step:0.01,re:'lot'})+
      A.fIn('Recharge (kg)','data.fl.charge',f.charge||'',{t:'n',step:0.01,re:'lot'})+A.fIn('Recherche de fuite (h)','data.fl.recherche',f.recherche||'',{t:'n',step:0.25})+'</div>'+
      A.fChk('Tirage au vide ('+A.money((P.tests||{}).vide)+')','data.fl.vide',f.vide)+A.fChk('Test azote ('+A.money((P.tests||{}).azote)+')','data.fl.azote',f.azote)+
      (circuitOpen(d)?A.fChk('Remplacer le filtre déshydrateur (circuit ouvert)','data.fl.deshy',f.deshy)+'<div class="row-actions" style="margin-top:6px"><button type="button" class="btn-ghost btn-sm" onclick="nxdpFlu('+i+')">🧪 Préparer la fiche fluide</button></div>':''));
    /* main-d'œuvre */
    var rate=A.rateOf(A.cur()), dep=depRate();
    var mh=(d.mo||[]).map(function(r,j){ return '<div class="nxd2-task"><div class="l"><input type="text" data-k="data.mo.'+j+'.l" data-t="s" value="'+esc(r.l||'')+'"></div><div class="v"><input type="number" step="0.25" min="0" inputmode="decimal" data-k="data.mo.'+j+'.h" data-t="n" value="'+(r.h==null?'':r.h)+'"> h '+K.btn('🗑','delMo',i,j,'iconbtn d')+'</div></div>'; }).join('');
    h+=K.sec('Main-d\'œuvre',mh+K.btn('+ Ajouter une ligne','addMo',i)+
      '<div class="frm nxk2" style="margin-top:8px">'+A.fIn('Récupération (h, forfait)','data.units.recup',K.units(d,UNITS_DEF).recup,{t:'n',step:0.25})+A.fIn('Mise en charge (h)','data.units.charge',K.units(d,UNITS_DEF).charge,{t:'n',step:0.25})+A.fIn('Remplacement déshydrateur (h)','data.units.deshy',K.units(d,UNITS_DEF).deshy,{t:'n',step:0.25})+'</div>'+
      '<div class="frm" style="margin-top:8px">'+A.fSel('Majoration','data.maj',d.maj,[['0','Aucune (heures ouvrées)'],['soir','Soir / samedi (+'+A.fq(num((P.dep||{}).majSoir))+' %)'],['dim','Dimanche / férié (+'+A.fq(num((P.dep||{}).majDim))+' %)']])+'</div>'+
      '<div class="nxd2-hint">Taux du devis : '+A.money(rate)+'/h'+(Math.abs(rate-dep)>0.01?' — ton taux dépannage est '+A.money(dep)+'/h (onglet Client & chantier, « taux horaire »)':' (ton taux dépannage)')+'. Récupération, mise en charge et déshydrateur sont ajoutés tout seuls d\'après la partie fluide.</div>');
    var dg=d.diag||{};
    h+=K.sec('Diagnostic déjà facturé',A.fChk('Déduire le diagnostic si la réparation est acceptée','data.diag.deduire',dg.deduire,{re:'lot'})+(dg.deduire?'<div class="frm">'+A.fIn('Montant à déduire (€ HT)','data.diag.montant',dg.montant,{t:'n',step:1})+'</div>':''));
    h+=K.sec('Conditions','<div class="frm">'+A.fIn('Garantie pièces et main-d\'œuvre (imprimée si remplie)','data.garantie',d.garantie,{full:true,ph:'ex. pièces : garantie fabricant ; main-d\'œuvre : 3 mois'})+'</div>'+A.fChk('Consommables (forfait : '+A.money(d.consoDep?(P.mesOpt||{}).conso:(P.conso||{}).petit)+')','data.conso',d.conso)+
      '<div class="row-actions" style="margin-top:8px"><button type="button" class="btn-ghost btn-sm" onclick="nxd2.altLot('+i+',\'Solution 2 — remplacement\')">＋ Ajouter une 2e solution (en option)</button></div>'+
      '<div class="nxd2-hint">La 2e solution (remplacer au lieu de réparer, par exemple) est chiffrée à part, hors total ; le PDF donne le total du devis si elle est retenue. Si le client la choisit : bouton « Retenir cette solution » sur son lot (elle remplace l\'autre, jamais les deux).</div>');
    return h;
  }
  function live(lot,i){}
  window.nxdpFlu=function(i){ try{ var d=A.cur(), l=d.lots[i].data, e=l.equip||{}; openFlu(null,{client:d.cNom||'',nature:'depannage',equipId:e.eqId||''}); }catch(err){} };
  var actions=K.actions({
    addPiece:function(l){ (l.data.pieces||(l.data.pieces=[])).push({nom:'',qte:1,achat:0,delai:''}); },
    delPiece:function(l,i,api,j){ l.data.pieces.splice(j,1); },
    addMo:function(l){ (l.data.mo||(l.data.mo=[])).push({l:'',h:1}); },
    delMo:function(l,i,api,j){ l.data.mo.splice(j,1); },
    pickEq:function(l,i,api,j,id){ var x=(EQUIP||[]).find(function(q){ return q.id===id; }); if(!x) return false; l.data.equip={eqId:x.id,type:x.type||'',marque:x.marque||'',modele:x.modele||'',serie:x.serie||'',fluide:x.fluide||'',charge:num(x.charge)};
      var fn=K.names(function(p){ return /^Fluide /i.test(p.nom)&&x.fluide&&p.nom.indexOf(x.fluide+' ')>=0; })[0]; if(fn) l.data.fl.nom=fn; },
    convert:function(l){ var d=l.data, nd=defaults();
      nd.pieces=(d.extras||[]).filter(function(x){ return x.nom&&num(x.qte)>0; }).map(function(x){ return {nom:x.nom,qte:num(x.qte),achat:0,delai:''}; })
        .concat((d.machines||[]).filter(function(m){ return m.marque||m.ref||num(m.achat); }).map(function(m){ return {nom:((m.marque||'')+' '+(m.ref||'')).trim()||'Pièce',qte:1,achat:num(m.achat),delai:''}; }));
      if(num(d.heures)>0) nd.mo=[{l:'Réparation',h:num(d.heures)}];
      l.data=nd; }
  });

  /* ---------- visite ---------- */
  var VISITE=[{k:'dispo',l:'Arrêt de l\'équipement possible (quand ?)',t:'txt',full:true},K.VIS.horaires,K.VIS.acces,{k:'nacelle',l:'Moyen d\'accès à prévoir',t:'sel',o:['','Aucun','Échelle / escabeau','Échafaudage','Nacelle (à louer)']},K.VIS.notes];
  function applyVisite(lot){ return []; }

  /* ---------- PDF ---------- */
  function pdf(lot){
    var d=lot.data; if(d.legacyCopy) return '';
    var e=d.equip||{}, out=[], m=d.mesures||{};
    var eq=[e.type,e.marque,e.modele].filter(Boolean).join(' ');
    if(eq||e.fluide) out.push('<b>Équipement</b> : '+esc(eq||'—')+(e.fluide?' ('+esc(e.fluide)+(num(e.charge)?', '+A.fq(num(e.charge))+' kg':'')+')':'')+(e.serie?' — n° '+esc(e.serie):''));
    if(d.symptome) out.push('<b>Symptôme signalé</b> : '+esc(d.symptome));
    if(d.constat) out.push('<b>Constat</b> : '+esc(d.constat));
    var ms=MEAS.filter(function(x){ return m[x[0]]!=null&&m[x[0]]!==''&&m[x[0]]!==0; });
    if(ms.length) out.push('<b>Mesures</b> : '+ms.map(function(x){ return esc(x[1].replace(/ \(.*\)/,''))+' '+A.fq(num(m[x[0]]))+' '+esc((/\((.*)\)/.exec(x[1])||[])[1]||''); }).join(' · '));
    if(d.cause) out.push('<b>Cause</b> ('+(CERT_PDF[d.certitude]||'')+') : '+esc(d.cause));
    var del=(d.pieces||[]).filter(function(p){ return p.delai; }).map(function(p){ return esc(p.nom)+' : '+esc(p.delai); });
    if(del.length) out.push('<b>Délai des pièces</b> : '+del.join(' ; '));
    if(d.garantie) out.push('<b>Garantie</b> : '+esc(d.garantie));
    if(num((d.fl||{}).recup)>0) out.push('Fluide récupéré repris par la filière de traitement, avec bordereau de suivi (BSFF).');
    out.push('<i>Si d\'autres défauts apparaissent pendant la réparation, ils feront l\'objet d\'un nouveau devis.</i>');
    return '<div style="font-size:10.5px;color:#333;line-height:1.55">'+out.join('<br>')+'</div>';
  }
  function summary(lot){
    var d=lot.data, e=d.equip||{};
    if(d.legacyCopy) return 'Dépannage';
    var eq=[e.type,e.marque,e.modele].filter(Boolean).join(' '), c=String(d.cause||'').split(/\n/)[0].slice(0,70);
    return 'Réparation'+(eq?' — '+eq:'')+(c?' : '+c:'');
  }
  function exclusions(){ return 'Toute autre panne ou pièce défectueuse constatée pendant la réparation (nouveau devis) ; moyens d\'accès en hauteur non prévus ci-dessus.'; }

  /* ---------- dictée ---------- */
  function fromAssistant(g,lot){
    var d=defaults(), msg=[]; lot.data=d; lot.exclusions=exclusions();
    if(!g||typeof g!=='object'){ msg.push('diagnostic, pièces et heures à renseigner'); return msg; }
    var e=g.equipement||{}; d.equip={eqId:'',type:String(e.type||''),marque:String(e.marque||''),modele:String(e.modele||''),serie:'',fluide:String(e.fluide||''),charge:num(e.charge)};
    d.symptome=String(g.symptome||''); d.constat=String(g.constat||''); d.cause=String(g.cause||'');
    d.certitude=['certaine','probable','confirmer'].indexOf(g.certitude)>=0?g.certitude:'confirmer';
    if(g.mesures&&typeof g.mesures==='object') MEAS.forEach(function(m){ if(g.mesures[m[0]]!=null) d.mesures[m[0]]=num(g.mesures[m[0]]); });
    if(Array.isArray(g.pieces)) d.pieces=g.pieces.slice(0,20).map(function(p){ return {nom:String(p.nom||'').slice(0,80),qte:Math.max(1,num(p.qte)||1),achat:num(p.achat),delai:String(p.delai||'')}; });
    var f=g.fluide||{}; if(f.nom&&K.pr(f.nom)) d.fl.nom=f.nom; d.fl.recup=num(f.recupere_kg); d.fl.charge=num(f.recharge_kg);
    if(num(g.heures)>0) d.mo=[{l:'Réparation : dépose et repose des pièces, essais',h:num(g.heures)}];
    if(g.majoration==='soir'||g.majoration==='dim') d.maj=g.majoration;
    if(d.pieces.some(function(p){ return !K.pr(p.nom)&&!num(p.achat); })) msg.push('prix d\'achat de pièces à saisir');
    if(!g.cause) msg.push('cause à renseigner');
    return msg;
  }
  var ASSIST={type:'Dépannage',consigne:'Devis de type "Dépannage" (réparation à faire accepter, pas un bon d\'intervention) : ajoute payload.depannage = {equipement:{type, marque, modele, fluide, charge}, symptome, constat, mesures:{hp, bp, tAsp, tLiq, sh, sr, intens, tension}, cause, certitude: "certaine"|"probable"|"confirmer", pieces:[{nom (valeur exacte de la base si elle existe), qte, achat (si dit), delai}], fluide:{nom (article « Fluide … » de la base), recupere_kg, recharge_kg}, heures, majoration: "soir"|"dim"}. "certaine" uniquement si Gabriel a mesuré ou constaté ; sinon "probable" ou "confirmer".'};

  /* ---------- bon d'intervention → devis de réparation ---------- */
  /* Fiabilité (audit du 30/09) : rien n'est facturé deux fois entre l'intervention et le devis de réparation.
     - la fiche ouverte est d'abord enregistrée (une pièce ajoutée sans enregistrer n'est plus perdue) ;
     - intervention déjà facturée : ses pièces ne sont PAS reprises (elles sont sur la facture) ;
     - intervention pas encore facturée : ses pièces passent dans le devis et, si Gabriel l'accepte, sont retirées de l'intervention
       (listées dans ses notes) ; le fluide va dans la partie « fluide » (recharge) et non en pièce ;
     - l'intervention garde le lien vers son devis : un 2e clic rouvre le même devis au lieu d'en créer un autre. */
  function fmtD(iso){ return iso?new Date(iso+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  window.nxdpFromDep=function(id){
    try{
      var open=window._curView==='depform'&&typeof curDep!=='undefined'&&curDep&&curDep.id===id;
      if(open){ try{ window.saveDep(); }catch(e){} }
      var x=(DEP||[]).find(function(q){ return q.id===id; })||(open?curDep:null); if(!x) return;
      var prev=x.devisRep&&(DEVIS||[]).find(function(q){ return q.id===x.devisRep; });
      if(prev&&confirm('Un devis de réparation existe déjà pour cette intervention ('+(prev.num||'')+').\nOK : l\'ouvrir.  Annuler : en préparer un autre.')){ NXD2.open(prev,{tab:'lots'}); return; }
      var d=NXD2.newDevis(MOD,{}), l=d.lots[0].data, info=[];
      ['cNom','cTel','cMail','cType','cAdr','cVille','cSiren'].forEach(function(k){ if(x[k]) d[k]=x[k]; }); if(x.zone) d.zone=x.zone;
      l.constat=x.desc||'';
      var fig=null; try{ fig=x.facNum?computeDep(x):null; }catch(e){}
      l.fromDep={id:x.id,date:x.date||'',facNum:x.facNum||'',mo:fig?Math.round((num(fig.mo))*100)/100:0};
      var ps=(x.pieces||[]).filter(function(p){ return p.nom&&num(p.qte)>0; });
      if(x.facNum){
        if(ps.length) info.push('pièces de l\'intervention non reprises : elles sont déjà sur la facture '+x.facNum);
        if(fig&&num(fig.mo)>0){ l.diag.montant=Math.round(num(fig.mo)*100)/100; info.push('diagnostic facturé ('+x.facNum+', main-d\'œuvre '+A.money(num(fig.mo))+') : à déduire ou non, en bas du lot'); }
      } else if(ps.length){
        ps.forEach(function(p){
          if(/^Fluide /i.test(p.nom)&&K.pr(p.nom)&&!(num(l.fl.charge)>0)){ l.fl.nom=p.nom; l.fl.charge=num(p.qte); return; }
          l.pieces.push({nom:p.nom,qte:num(p.qte),achat:num(p.achat),vente:num(p.vente)>0?num(p.vente):'',delai:''});
        });
        if(confirm('Les pièces de l\'intervention ('+ps.map(function(p){ return p.nom+' ×'+A.fq(num(p.qte)); }).join(', ')+') passent dans le devis de réparation.\nLes retirer de l\'intervention pour qu\'elles ne soient pas facturées deux fois ? (conseillé)')){
          var dd=DEP.find(function(q){ return q.id===x.id; })||x;
          dd.notes=((dd.notes||'')+(dd.notes?'\n':'')+'Pièces reprises dans le devis de réparation '+d.num+' ('+new Date().toLocaleDateString('fr-FR')+') : '+ps.map(function(p){ return p.nom+' ×'+A.fq(num(p.qte))+(num(p.achat)?' (achat '+A.money(num(p.achat))+')':''); }).join(' ; ')).trim();
          dd.pieces=(dd.pieces||[]).filter(function(p){ return !(p.nom&&num(p.qte)>0); });
          if(open){ curDep.pieces=dd.pieces.slice(); curDep.notes=dd.notes; }
          info.push('pièces retirées de l\'intervention (notées dans ses notes)');
        } else info.push('⚠ pièces laissées AUSSI sur l\'intervention : ne les facture qu\'à un seul endroit');
      }
      var dx=DEP.find(function(q){ return q.id===x.id; }); if(dx){ dx.devisRep=d.id; if(open) curDep.devisRep=d.id; try{ save(LS.dep,DEP); }catch(e){} }
      d.fromDep=x.id;
      d.notes='Devis établi après l\'intervention du '+fmtD(x.date)+(x.facNum?' (facture '+x.facNum+')':'')+'.';
      NXD2.derive(d); NXD2.open(d,{tab:'lots',dirty:true,banner:'Devis de réparation préparé depuis l\'intervention du '+fmtD(x.date)+' : complète le diagnostic, la cause et les heures, puis enregistre.'+(info.length?'<br>'+info.map(esc).join('<br>'):'')});
    }catch(e){ try{ toast('Impossible de préparer le devis : '+(e.message||e)); }catch(err){} }
  };
  function hookDepForm(tries){
    tries=tries||0;
    var v=document.getElementById('v-depform'), bar=v&&v.querySelector('.flexhead .row-actions');
    if(!bar){ if(tries<30) setTimeout(function(){ hookDepForm(tries+1); },300); return; }
    if(document.getElementById('nxdpBtn')) return;
    var b=document.createElement('button'); b.id='nxdpBtn'; b.type='button'; b.className='btn-ghost btn-sm'; b.textContent='📝 Devis de réparation';
    b.title='Préparer un devis de réparation à partir de cette intervention'; b.onclick=function(){ if(typeof curDep!=='undefined'&&curDep) window.nxdpFromDep(curDep.id); };
    bar.insertBefore(b,bar.lastElementChild);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ hookDepForm(0); }); else hookDepForm(0);

  NXD2.register({
    id:MOD, defaults:defaults, fromLegacy:fromLegacy, compute:compute, render:render, live:live, actions:actions,
    visite:VISITE, applyVisite:applyVisite, pdf:pdf, summary:summary, exclusions:exclusions,
    typeLabel:function(){ return 'Dépannage'; }, isLegacyType:function(t){ return t==='Dépannage'; },
    remember:K.rememberUnits(UNITS_DEF), fromAssistant:fromAssistant, assistant:ASSIST,
    onNewDevis:function(d){ var r=depRate(); if(r>0){ d.rateChoice='custom'; d.rateCustom=r; } },
    common:function(){ return {prepH:0,achatH:0.5,savPct:0}; },
    /* pas de pièce à acheter (main-d'œuvre, fluide du camion) : ni achat du matériel ni frais de commande */
    fees:function(lot){ var d=(lot&&lot.data)||{}; if(d.legacyCopy) return null; var has=(d.pieces||[]).some(function(p){ return p&&p.nom&&num(p.qte)>0; }); return {commande:has,achat:has}; },
    UNITS_DEF:UNITS_DEF
  });
})();
