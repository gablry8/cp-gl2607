/* ============================================================
   ClimPilot Next — next-mod-split.js
   Module « Clim murale » (mono, bi à quadrisplit, plusieurs monos,
   console, cassette). Le chiffrage réutilise l'ancien moteur tel
   quel (liaisons, câbles, goulottes, électricité, MES…) : mêmes
   données → mêmes montants. En plus : pièces, visite technique,
   main-d'œuvre détaillée tâche par tâche, critères TVA 5,5 %.
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2) return;
  var A=NXD2.api, esc=A.esc, num=A.num;

  var TYPES=['Monosplit','Bisplit','Trisplit','Quadrisplit','Plusieurs monosplits','Multisplit personnalisé','PAC air-air'];
  var UI_TYPES=['Mural','Console','Cassette','Plafonnier'];
  var BREAKERS=['Disjoncteur 16A','Disjoncteur 20A','Disjoncteur 32A'];
  /* temps unitaires de départ (proposés par ClimPilot, à ajuster : ils sont retenus à chaque enregistrement) */
  var UNITS_DEF={ue:2,ui:1.5,liaison:1.5,goul:0.15,pompe:0.5,elec:1,nett:0.5};
  var TASKS=[
    {k:'ue',l:'Pose unité(s) extérieure(s) et support',u:'par groupe',q:function(d){ return (d.machines||[]).length; }},
    {k:'ui',l:'Pose unité(s) intérieure(s)',u:'par unité',q:function(d){ return (d.splits||[]).length; }},
    {k:'liaison',l:'Liaisons frigorifiques, câble, passage de mur',u:'par unité',q:function(d){ return (d.splits||[]).length; }},
    {k:'goul',l:'Pose de goulotte',u:'par mètre',q:function(d){ return A.sum((d.goulottes||[]).filter(function(g){ return g.type&&g.type!=='Aucune'; }),function(g){ return num(g.long); }); }},
    {k:'pompe',l:'Pompe(s) de relevage',u:'par pompe',q:function(d){ return d.pompeType&&d.pompeType!=='Aucune'?Math.max(1,num(d.pompeQte)||1):0; }},
    {k:'elec',l:'Raccordement électrique',u:'par groupe',q:function(d){ return d.elecMode==='none'?0:(d.machines||[]).length; }},
    {k:'nett',l:'Nettoyage et explications au client',u:'par chantier',q:function(){ return 1; }}
  ];
  function savedUnits(){ var s=(A.DEFS().split||{}).units; return s&&typeof s==='object'?s:null; }
  function unitsOf(d){ var u=d.units||{}, o={}; Object.keys(UNITS_DEF).forEach(function(k){ o[k]=(u[k]!=null&&u[k]!=='')?Math.max(0,num(u[k])):UNITS_DEF[k]; }); return o; }
  function taskRows(d){
    var u=unitsOf(d);
    var rows=TASKS.map(function(t){ var q=t.q(d); return {k:t.k,l:t.l,u:t.u,q:q,h1:u[t.k],h:q*u[t.k]}; }).filter(function(r){ return r.q>0; });
    (d.custom||[]).forEach(function(c,j){ var h=Math.max(0,num(c.h)); rows.push({custom:j,l:c.l||'Autre tâche',q:1,h1:h,h:h}); });
    return rows;
  }
  function quoteDefaults(type){ try{ var q=JSON.parse(localStorage.getItem('cpnext_quote_defaults')||'{}'); return q[type]||null; }catch(e){ return null; } }
  var IMPORT=['mes','acces','tests','taille','brasure','support','elecMode','pompeType','pompeQte','groupCable','breakerManual','breakerQte','differential','diffQte','proximity'];
  function mkMachine(){ return {marque:'',ref:'',achat:0,marge:35,breaker:'',maxCurrent:0}; }
  function mkSplit(){ return {piece:'',surface:0,typeUI:'Mural',puiss:3.5,liaison:'Liaison 1/4 - 3/8',long:5,cableInter:'Câble 5G1,5'}; }
  function fit(d){
    var tu=(typeof TYPEUNITS!=='undefined')&&TYPEUNITS[d.type]; if(!tu) return;
    while((d.machines||(d.machines=[])).length<tu[0]) d.machines.push(mkMachine());
    if(d.machines.length>tu[0]) d.machines=d.machines.slice(0,tu[0]);
    while((d.splits||(d.splits=[])).length<tu[1]) d.splits.push(mkSplit());
    if(d.splits.length>tu[1]) d.splits=d.splits.slice(0,tu[1]);
  }
  function defaults(opts){
    opts=opts||{};
    var type=opts.type&&TYPES.indexOf(opts.type)>=0?opts.type:'Monosplit';
    var d={type:type,machines:[mkMachine()],splits:[mkSplit()],groupCable:'Câble 3G2,5',groupLong:0,goulottes:[{type:'Goulotte 80x60',long:0}],
      condLong:0,support:'Aucun',pompeType:'Aucune',pompeQte:1,taille:'auto',extras:[],heures:0,moMode:'detail',
      units:Object.assign({},UNITS_DEF,savedUnits()||{}),custom:[],acces:'0',mes:(P.mes&&P.mes[type]!=null)?type:'Aucune',brasure:'Brasure simple',supp:0,tests:'0',
      elecMode:'auto',breakerManual:'Disjoncteur 20A',breakerQte:1,differential:false,diffQte:1,proximity:false,wifi:false,tva55:{}};
    var q=quoteDefaults(type); if(q) IMPORT.forEach(function(k){ if(q[k]!=null) d[k]=A.clone(q[k]); });
    fit(d);
    return d;
  }
  function fromLegacy(s){
    var d={type:s.type||'Monosplit',
      machines:(s.machines||[]).map(function(m){ return {marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:m.marge!=null?num(m.marge):35,breaker:m.breaker||'',maxCurrent:num(m.maxCurrent)}; }),
      splits:(s.splits||[]).map(function(x){ return {piece:'',surface:0,typeUI:'Mural',puiss:x.puiss,liaison:x.liaison,long:num(x.long),cableInter:x.cableInter||x.cable||'Câble 5G1,5'}; }),
      groupCable:s.groupCable||'Câble 3G2,5',groupLong:num(s.groupLong),goulottes:A.clone(s.goulottes||[]),condLong:num(s.condLong),support:s.support||'Aucun',
      pompeType:s.pompeType||'Aucune',pompeQte:s.pompeQte!=null?s.pompeQte:1,taille:s.taille||'auto',extras:A.clone(s.extras||[]),
      heures:num(s.heures),moMode:s.moMode==='heures'?'heures':'forfait',units:Object.assign({},UNITS_DEF,savedUnits()||{}),custom:[],
      acces:s.acces||'0',mes:s.mes||'Aucune',brasure:s.brasure||'Aucune',supp:num(s.supp),tests:s.tests||'0',
      elecMode:s.elecMode||'auto',breakerManual:s.breakerManual||'Disjoncteur 20A',breakerQte:s.breakerQte!=null?s.breakerQte:1,differential:!!s.differential,diffQte:s.diffQte!=null?s.diffQte:1,proximity:!!s.proximity,wifi:false,tva55:{}};
    return d;
  }

  /* ---------- calcul : l'ancien moteur, sans les frais communs (comptés une seule fois pour le devis) ---------- */
  function compute(lot,ctx){
    var data=lot.data||{}, o=A.clone(data), rate=ctx.rate, warnings=[];
    ['units','custom','tva55','wifi'].forEach(function(k){ delete o[k]; });
    o.zone='Aucun'; o.rateChoice=ctx.d.rateChoice; o.rateCustom=ctx.d.rateCustom; o.acompteOn=false; o.acomptePct=0; o.tvaRate=0; o.estim=false; delete o.tvaMode; delete o.v;
    o.nbMach=(o.machines||[]).length; o.nbSplit=(o.splits||[]).length;
    var mode=data.moMode||'detail', rows=null, heures=0;
    if(mode==='detail'){ rows=taskRows(data); heures=A.sum(rows,function(r){ return r.h; }); o.moMode='heures'; o.heures=heures; }
    else if(mode==='forfait'){ o.moMode='forfait'; o.heures=num(data.heures); heures=num(data.heures); }
    else { o.moMode='heures'; o.heures=num(data.heures); heures=num(data.heures); }
    var c=A.LEGACY(o);
    var lines=c.lines.filter(function(l){ return !(l.group==='Frais & divers'&&(l.label==='Frais administratifs devis'||l.label==='Frais commande matériel'||/^Marge sécurité/.test(l.label))); });
    lines.forEach(function(l){ if(l.group==='Pose & main-d’œuvre'&&(l.label==='Main-d’œuvre'||l.label==='Forfait pose')) l.mo=true; });
    if(mode==='detail'){
      var idx=-1; lines.forEach(function(l,j){ if(idx<0&&l.group==='Pose & main-d’œuvre'&&l.label==='Main-d’œuvre') idx=j; });
      if(idx>=0){
        var tl=rows.filter(function(r){ return r.h>0; }).map(function(r){
          return A.mkLine('Pose & main-d’œuvre',r.l,A.fq(A.r2(r.h))+' h'+(r.custom==null?' ('+A.fq(r.q)+' × '+A.fq(r.h1)+' h '+r.u+')':'')+' × '+A.money(rate)+'/h',r.h*rate,0,{qte:r.h,unite:'h',pu:rate,mo:true});
        });
        lines.splice.apply(lines,[idx,1].concat(tl));
      }
    }
    (data.machines||[]).forEach(function(m,j){ if(!num(m.achat)) warnings.push('Groupe '+(j+1)+(m.marque?' ('+m.marque+')':'')+' : prix d\'achat à saisir'); });
    lines.forEach(function(l){ if(/absent du catalogue/.test(l.detail||'')) warnings.push('Article « '+l.label+' » absent de la base de prix'); });
    if(mode==='forfait'&&!(P.forfait&&P.forfait[data.type])) warnings.push('Pas de forfait pose pour « '+data.type+' » : les heures × taux sont utilisées');
    if(mode!=='detail'&&!heures) warnings.push('Heures estimées à renseigner (gain horaire et planning)');
    if(String(lot.tva)==='5.5'){ var t=data.tva55||{}; if(!(t.rev&&t.classe&&t.pilot&&t.log2&&t.p12)) warnings.push('TVA 5,5 % : tous les critères ne sont pas cochés'); }
    return {lines:lines,mat:c.mat||[],heures:heures,detailH:mode==='forfait'?0:heures,warnings:warnings};
  }

  /* ---------- formulaire ---------- */
  function opts(list,cur){ return list.map(function(x){ return [x,x]; }); }
  function prixNames(cat,unite){ try{ return PRIX.filter(function(p){ return p.cat===cat&&(!unite||p.unite===unite); }).map(function(p){ return p.nom; }); }catch(e){ return []; } }
  function sec(t,body,id){ return '<div class="nxd2-sec"'+(id?' id="'+id+'"':'')+'><h3>'+t+'</h3>'+body+'</div>'; }
  function btn(lbl,act,i,extra,cls){ return '<button type="button" class="'+(cls||'btn-ghost btn-sm')+'" onclick="nxd2.act(\''+act+'\','+i+(extra!=null?','+extra:'')+')">'+lbl+'</button>'; }
  function render(lot,i){
    var d=lot.data, h='';
    h+=sec('Installation','<div class="frm">'+A.fSel('Type d\'installation','data.type',d.type,opts(TYPES),{on:'spType',re:'lot'})+'</div>');
    /* groupes */
    var lib=(typeof MACHLIB!=='undefined'?MACHLIB:[])||[];
    var mh=(d.machines||[]).map(function(m,j){
      return '<div class="nxd2-row">'+(d.machines.length>1?'<span class="del">'+btn('🗑','delMach',i,j,'iconbtn d')+'</span>':'')+
        '<b style="font-size:13px">Groupe '+(j+1)+'</b><div class="frm">'+
        (lib.length?'<label>📚 Bibliothèque<select onchange="nxd2.act(\'lib\','+i+','+j+',this.value)"><option value="">— choisir —</option>'+lib.map(function(x,k){ return '<option value="'+k+'">'+esc((x.marque||'')+' '+(x.ref||''))+' — '+A.money(x.achat)+'</option>'; }).join('')+'</select></label>':'')+
        A.fIn('Marque','data.machines.'+j+'.marque',m.marque)+A.fIn('Référence','data.machines.'+j+'.ref',m.ref)+
        A.fIn('Prix d\'achat HT (€)','data.machines.'+j+'.achat',m.achat,{t:'n',step:0.01})+A.fIn('Marge %','data.machines.'+j+'.marge',m.marge,{t:'n',step:1})+
        A.fIn('Courant max (A)','data.machines.'+j+'.maxCurrent',m.maxCurrent||'',{t:'n',step:0.1,note:'notice → calibre'})+
        '</div><div class="calc" id="nxd2mv'+i+'_'+j+'"></div>'+btn('☆ Mémoriser','mem',i,j)+'</div>';
    }).join('');
    h+=sec('Groupe(s) extérieur(s)',mh+btn('+ Ajouter un groupe','addMach',i));
    /* unités intérieures */
    var liais=prixNames('Cuivre'); var pw=(typeof SPLIT_POWERS!=='undefined'?SPLIT_POWERS:[2.5,3.5,5,7]);
    var cab=(typeof SPLIT_CABLES!=='undefined'?SPLIT_CABLES:['Câble 5G1,5']);
    var sh=(d.splits||[]).map(function(s,j){
      var p='data.splits.'+j+'.';
      return '<div class="nxd2-row">'+(d.splits.length>1?'<span class="del">'+btn('🗑','delSplit',i,j,'iconbtn d')+'</span>':'')+
        '<b style="font-size:13px">Unité '+(j+1)+(s.piece?' — '+esc(s.piece):'')+'</b><div class="frm">'+
        A.fIn('Pièce',p+'piece',s.piece,{ph:'Séjour, chambre 1…'})+A.fIn('Surface (m²)',p+'surface',s.surface||'',{t:'n',step:0.5})+
        A.fSel('Type d\'unité',p+'typeUI',s.typeUI||'Mural',opts(UI_TYPES))+
        A.fSel('Puissance',p+'puiss',s.puiss,pw.map(function(x){ return [x,String(x).replace('.',',')+' kW']; }),{on:'spPuiss',re:'lot',t:'n'})+
        A.fSel('Liaison cuivre',p+'liaison',s.liaison,opts(liais))+A.fIn('Longueur liaison (m)',p+'long',s.long,{t:'n',step:0.5})+
        A.fSel('Câble d\'interconnexion',p+'cableInter',s.cableInter,opts(cab))+'</div></div>';
    }).join('');
    h+=sec('Unités intérieures (une par pièce)','<div class="nxd2-hint">⚠️ La liaison est suggérée selon la puissance : à valider avec la notice constructeur.</div>'+sh+btn('+ Ajouter une unité','addSplit',i));
    /* liaisons, électricité, condensats */
    var gou=prixNames('Goulotte','m'), sup=prixNames('Supports'), pom=prixNames('Pompe');
    var gh=(d.goulottes||[]).map(function(g,j){ return '<div class="frm" style="align-items:end;margin-bottom:6px">'+A.fSel('Goulotte','data.goulottes.'+j+'.type',g.type,opts(['Aucune'].concat(gou)),{re:'#nxd2mo'+i})+A.fIn('Longueur (m)','data.goulottes.'+j+'.long',g.long,{t:'n',step:0.5,re:'#nxd2mo'+i})+'<div>'+(d.goulottes.length>1?btn('🗑 retirer','delGoul',i,j):'')+'</div></div>'; }).join('');
    var em=d.elecMode||'auto';
    h+=sec('Liaisons, électricité, condensats',
      '<div class="frm">'+A.fSel('Câble d\'alimentation du groupe','data.groupCable',d.groupCable,opts(typeof GROUP_CABLES!=='undefined'?GROUP_CABLES:['Câble 3G2,5']))+A.fIn('Longueur alimentation (m)','data.groupLong',d.groupLong,{t:'n',step:0.5})+'</div>'+
      gh+btn('+ Autre taille de goulotte','addGoul',i)+
      '<div class="frm" style="margin-top:8px">'+A.fIn('Évacuation condensats (m)','data.condLong',d.condLong,{t:'n',step:0.5})+A.fSel('Support groupe extérieur','data.support',d.support,opts(['Aucun'].concat(sup)))+
        A.fSel('Pompe de relevage','data.pompeType',d.pompeType,opts(['Aucune'].concat(pom)),{re:'#nxd2mo'+i})+A.fIn('Nombre de pompes','data.pompeQte',d.pompeQte,{t:'n',step:1,min:1,re:'#nxd2mo'+i})+'</div>'+
      '<div class="frm" style="margin-top:8px">'+A.fSel('Protection électrique','data.elecMode',em,[['auto','Automatique (courant max des groupes)'],['manual','Choix manuel'],['none','Non fournie / existante à contrôler']],{re:'lot'})+
        (em==='manual'?A.fSel('Disjoncteur','data.breakerManual',d.breakerManual,opts(BREAKERS))+A.fIn('Quantité','data.breakerQte',d.breakerQte,{t:'n',step:1,min:1}):'')+'</div>'+
      (em!=='none'?A.fChk('Protection différentielle','data.differential',d.differential,{re:'lot'})+(d.differential?'<div class="frm">'+A.fIn('Nombre de différentiels','data.diffQte',d.diffQte,{t:'n',step:1,min:1})+'</div>':'')+A.fChk('Interrupteur de proximité IP65','data.proximity',d.proximity):'')+
      A.fChk('Pilotage connecté (Wi-Fi) prévu','data.wifi',d.wifi)+
      '<div class="nxd2-hint">Le calibre se lit sur la notice constructeur. Avec le courant max du groupe, ClimPilot propose le calibre standard supérieur, à valider.</div>');
    /* MES */
    var mesK=Object.keys(P.mes||{}), brK=Object.keys(P.bras||{});
    h+=sec('Mise en service et contrôles','<div class="frm">'+
      A.fSel('Mise en service','data.mes',d.mes,mesK.map(function(k){ return [k,k==='Aucune'?'Aucune':k+' — '+A.money(P.mes[k])]; }))+
      A.fSel('Brasure','data.brasure',d.brasure,brK.map(function(k){ return [k,k==='Aucune'?'Aucune':k+' — '+A.money(P.bras[k])]; }))+
      A.fSel('Contrôle','data.tests',d.tests,[['0','Aucun'],['vide','Tirage au vide — '+A.money((P.tests||{}).vide)],['azote','Test azote — '+A.money((P.tests||{}).azote)],['etanch','Contrôle d\'étanchéité — '+A.money((P.tests||{}).etanch)]])+
      A.fSel('Accès','data.acces',d.acces,[['0','Normal'],['diff','Difficile (+'+A.money((P.acces||{}).diff)+')']])+
      A.fIn('Suppléments chantier (€ HT)','data.supp',d.supp,{t:'n',step:1})+
      A.fSel('Consommables','data.taille',d.taille||'auto',[['auto','Auto (selon le nombre d\'unités)'],['petit','Petit chantier'],['moyen','Chantier moyen'],['gros','Gros chantier']])+'</div>');
    /* articles */
    var dl='<datalist id="nxd2PrixDL">'+(typeof PRIX!=='undefined'?PRIX:[]).map(function(p){ return '<option value="'+esc(p.nom)+'">'; }).join('')+'</datalist>';
    var xh=(d.extras||[]).map(function(x,j){
      var p=null; try{ p=findPrix(x.nom); }catch(e){}
      var u=0; try{ u=p?venteOf(x.nom,p.marge):0; }catch(e){}
      return '<div class="frm" style="align-items:end;margin-bottom:6px">'+A.fIn('Article','data.extras.'+j+'.nom',x.nom,{list:'nxd2PrixDL',re:'lot'})+A.fIn('Quantité','data.extras.'+j+'.qte',x.qte,{t:'n',step:0.5})+
        '<div class="calc">'+(p?A.money(u)+' / '+esc(p.unite):(x.nom?'⚠️ absent de la base de prix':''))+'</div><div>'+btn('🗑','delExtra',i,j,'iconbtn d')+'</div></div>';
    }).join('');
    h+=sec('Articles complémentaires',dl+(xh||'<div class="nxd2-hint">Aucun article complémentaire.</div>')+btn('+ Ajouter un article','addExtra',i));
    /* MO */
    h+='<div class="nxd2-sec" id="nxd2mo'+i+'">'+moBlock(lot,i)+'</div>';
    /* TVA 5,5 */
    try{ if(P.regimeTVA==='assujetti'){ var t=d.tva55||{};
      h+=sec('TVA à 5,5 % — critères (réforme 2026)','<div class="nxd2-hint">À confirmer sur le texte officiel au premier devis concerné. Sinon : 10 % pose / 20 % matériel en logement de plus de 2 ans, 20 % pour les locaux pro.</div>'+
        A.fChk('PAC air/air réversible (chaud et froid)','data.tva55.rev',t.rev)+A.fChk('Classes énergétiques requises atteintes en chaud et en froid (≤ 12 kW : A++ mono-split, A+ multi-split)','data.tva55.classe',t.classe)+
        A.fChk('Pilotage connecté fourni','data.tva55.pilot',t.pilot)+A.fChk('Logement d\'habitation achevé depuis plus de 2 ans','data.tva55.log2',t.log2)+A.fChk('Fluide et puissance conformes (≤ 12 kW ou seuils saisonniers au-delà)','data.tva55.p12',t.p12));
    } }catch(e){}
    return h;
  }
  function moBlock(lot,i){
    var d=lot.data, mode=d.moMode||'detail', rate=A.rateOf(A.cur()), type=d.type;
    var forf=(P.forfait||{})[type], hist=A.historyHours(type);
    var h='<h3>Main-d\'œuvre du lot</h3><div class="frm">'+A.fSel('Mode de calcul','data.moMode',mode,[['detail','Détail en heures (tâche par tâche)'],['forfait','Forfait pose'+(forf!=null?' — '+A.money(forf):' (aucun pour ce type)')],['heures','Heures globales']],{re:'#nxd2mo'+i})+'</div>';
    if(mode==='detail'){
      var rows=taskRows(d), tot=A.sum(rows,function(r){ return r.h; });
      h+=rows.map(function(r){
          if(r.custom!=null) return '<div class="nxd2-task"><div class="l"><input type="text" placeholder="Autre tâche" data-k="data.custom.'+r.custom+'.l" data-t="s" value="'+esc(r.custom!=null&&(d.custom[r.custom]||{}).l||'')+'"></div>'+
            '<div class="v"><input type="number" step="0.25" min="0" inputmode="decimal" data-k="data.custom.'+r.custom+'.h" data-t="n" data-re="#nxd2mo'+i+'" value="'+r.h1+'"> h '+btn('🗑','delTask',i,r.custom,'iconbtn d')+'</div></div>';
          return '<div class="nxd2-task"><div class="l">'+esc(r.l)+' <span class="sub2">· '+A.fq(A.r2(r.q))+' '+esc(r.u)+'</span></div>'+
            '<div class="v"><input type="number" step="0.05" min="0" inputmode="decimal" data-k="data.units.'+r.k+'" data-t="n" data-re="#nxd2mo'+i+'" value="'+r.h1+'"> h/u = <b>'+A.fq(A.r2(r.h))+' h</b></div></div>';
        }).join('')+
        '<div class="nxd2-task tot"><div class="l">Total du lot</div><div class="v">'+A.fq(A.r2(tot))+' h · '+A.money(tot*rate)+' HT</div></div>'+
        btn('+ Ajouter une tâche','addTask',i)+
        '<div class="nxd2-hint">Préparation, achat du matériel et provision SAV sont comptés une fois pour tout le devis (onglet Récapitulatif). Mise en service, brasure et contrôle restent à tes forfaits ci-dessus.</div>'+
        (savedUnits()?'':'<div class="nxd2-hint">Temps unitaires : <b>valeurs de départ proposées</b>, pas encore les tiennes. Ajuste-les ; ClimPilot les retient à l\'enregistrement.</div>');
      if(forf!=null&&forf>0&&tot*rate<forf*0.85) h+='<div class="nxd2-warn">Le détail donne '+A.money(tot*rate)+', soit moins que ton forfait pose '+esc(type)+' ('+A.money(forf)+'). Vérifie tes temps : ce devis pourrait être sous-facturé.</div>';
    } else {
      h+='<div class="frm">'+A.fIn(mode==='forfait'?'Heures estimées (pour le gain horaire et le planning)':'Heures totales du lot','data.heures',d.heures,{t:'n',step:0.5,re:'#nxd2mo'+i})+'</div>';
      if(mode==='forfait'&&forf!=null) h+='<div class="nxd2-hint">Forfait pose '+esc(type)+' : '+A.money(forf)+(rate>0?' (≈ '+A.fq(A.r2(forf/rate))+' h à '+A.money(rate)+'/h)':'')+'.</div>';
    }
    if(hist) h+='<div class="nxd2-hint">Repère — tes '+hist.n+' devis « '+esc(type)+' » précédents : '+A.fq(A.r2(hist.avg))+' h en moyenne (de '+A.fq(hist.min)+' à '+A.fq(hist.max)+' h).</div>';
    return h;
  }
  function renderPart(id,lot,i){ if(id==='nxd2mo'+i) return moBlock(lot,i); return ''; }
  function live(lot,i){
    (lot.data.machines||[]).forEach(function(m,j){ var el=document.getElementById('nxd2mv'+i+'_'+j); if(el){ var v=0; try{ v=priceVente(num(m.achat),num(m.marge)); }catch(e){} el.textContent='Prix de vente HT : '+A.money(v); } });
  }

  /* ---------- actions ---------- */
  var actions={
    addMach:function(l){ l.data.machines.push(mkMachine()); },
    delMach:function(l,i,a,j){ l.data.machines.splice(j,1); },
    lib:function(l,i,a,j,k){ if(k===''||k==null) return false; var m=(MACHLIB||[])[+k]; if(!m) return false; var cur0=l.data.machines[j]||{}; l.data.machines[j]=Object.assign({},cur0,{marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:m.marge!=null?num(m.marge):35}); try{ toast('Groupe chargé : '+((m.marque||'')+' '+(m.ref||'')).trim()); }catch(e){} },
    mem:function(l,i,a,j){ var m=l.data.machines[j]; if(!m||(!m.marque&&!m.ref)){ try{ toast('Renseigne au moins la marque ou la référence'); }catch(e){} return false; }
      var o={marque:String(m.marque||'').trim(),ref:String(m.ref||'').trim(),achat:num(m.achat),marge:num(m.marge)}; var k=MACHLIB.findIndex(function(x){ return x.marque===o.marque&&x.ref===o.ref; });
      if(k>=0) MACHLIB[k]=o; else MACHLIB.push(o); try{ save(LS.machlib,MACHLIB); toast('☆ Groupe mémorisé'); }catch(e){} },
    addSplit:function(l){ var s=mkSplit(); var last=l.data.splits[l.data.splits.length-1]; if(last){ s.cableInter=last.cableInter; } l.data.splits.push(s); syncType(l.data); },
    delSplit:function(l,i,a,j){ l.data.splits.splice(j,1); syncType(l.data); },
    addGoul:function(l){ l.data.goulottes.push({type:'Goulotte 80x60',long:0}); },
    delGoul:function(l,i,a,j){ l.data.goulottes.splice(j,1); },
    addExtra:function(l){ (l.data.extras||(l.data.extras=[])).push({nom:'',qte:1}); },
    delExtra:function(l,i,a,j){ l.data.extras.splice(j,1); },
    addTask:function(l){ (l.data.custom||(l.data.custom=[])).push({l:'',h:1}); },
    delTask:function(l,i,a,j){ l.data.custom.splice(j,1); }
  };
  function syncType(d){
    var n=d.splits.length, m=d.machines.length;
    if(m===1&&['Monosplit','Bisplit','Trisplit','Quadrisplit'].indexOf(d.type)>=0){
      var t=({1:'Monosplit',2:'Bisplit',3:'Trisplit',4:'Quadrisplit'})[n];
      if(t&&t!==d.type){ if(d.mes===d.type&&P.mes&&P.mes[t]!=null) d.mes=t; d.type=t; }
      else if(!t) d.type='Multisplit personnalisé';
    }
  }
  A.hook('spType',function(li){ var l=A.cur().lots[li]; if(!l) return; fit(l.data); if(P.mes&&P.mes[l.data.type]!=null) l.data.mes=l.data.type; });
  A.hook('spPuiss',function(li,el,v){ var l=A.cur().lots[li]; var m=/splits\.(\d+)\.puiss/.exec(el.dataset.k||''); if(!l||!m) return; try{ l.data.splits[+m[1]].liaison=liaisonForPower(v); }catch(e){} });

  /* ---------- visite technique ---------- */
  var VISITE=[
    {k:'ueEmpl',l:'Emplacement de l\'unité extérieure',t:'sel',o:['','Au sol','En façade (mur)','Toit-terrasse','Balcon','Autre (voir notes)']},
    {k:'ueAcces',l:'Accès / hauteur de travail',t:'sel',o:['','Normal (escabeau)','Échafaudage','Nacelle','Toiture (harnais)']},
    {k:'murs',l:'Murs traversés (nature, épaisseur, Ø de carottage)',t:'txt',full:true},
    {k:'condens',l:'Condensats',t:'sel',o:['','Gravitaire possible partout','Pompe nécessaire','Mixte (voir notes)']},
    {k:'tableau',l:'Tableau électrique : place disponible',t:'sel',o:['','Oui','Non — à prévoir','À vérifier']},
    {k:'diff',l:'Différentiel 30 mA en place',t:'sel',o:['','Oui','Non','À vérifier']},
    {k:'distTab',l:'Distance tableau → unité extérieure (m)',t:'num'},
    {k:'copro',l:'Copropriété / façade protégée',t:'sel',o:['','Non concerné','Autorisation à obtenir par le client','Autorisation obtenue']},
    {k:'bruit',l:'Voisinage, bruit de l\'unité extérieure',t:'txt',full:true},
    {k:'amiante',l:'Bâtiment ancien : repérage amiante avant percements (à vérifier)',t:'sel',o:['','Non concerné','À demander au client','Rapport fourni']},
    {k:'notes',l:'Notes pour ce lot',t:'area'}
  ];
  function applyVisite(lot){
    var v=lot.visite||{}, d=lot.data, msg=[];
    if(num(v.distTab)>0){ d.groupLong=num(v.distTab); msg.push('alimentation '+A.fq(d.groupLong)+' m'); }
    if(/Échafaudage|Nacelle|Toiture/.test(v.ueAcces||'')&&d.acces!=='diff'){ d.acces='diff'; msg.push('accès difficile'); }
    if(v.condens==='Pompe nécessaire'&&(!d.pompeType||d.pompeType==='Aucune')){ var p=(PRIX||[]).filter(function(x){ return x.cat==='Pompe'; })[0]; if(p){ d.pompeType=p.nom; d.pompeQte=Math.max(1,d.pompeQte||1); msg.push('pompe de relevage'); } }
    if(v.diff==='Non'&&!d.differential&&d.elecMode!=='none'){ d.differential=true; msg.push('différentiel'); }
    if(v.ueEmpl==='Au sol'&&(!d.support||d.support==='Aucun')){ var s=(PRIX||[]).filter(function(x){ return x.cat==='Supports'&&/sol|rubber/i.test(x.nom); })[0]; if(s){ d.support=s.nom; msg.push('support : '+s.nom); } }
    if(v.ueEmpl==='En façade (mur)'&&(!d.support||d.support==='Aucun')){ var s2=(PRIX||[]).filter(function(x){ return x.cat==='Supports'&&/mural standard/i.test(x.nom); })[0]; if(s2){ d.support=s2.nom; msg.push('support : '+s2.nom); } }
    return msg;
  }
  function visitePrint(lot,blank){
    var d=lot.data, dots='<span style="color:#aaa">…………</span>';
    var rows=blank?[0,1,2,3].map(function(){ return '<tr>'+'<td>'+dots+'</td>'.repeat(1)+'<td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td><td>'+dots+'</td></tr>'; }).join('')
      :(d.splits||[]).map(function(s){ return '<tr><td>'+esc(s.piece||'—')+'</td><td>'+(s.surface?A.fq(s.surface)+' m²':'')+'</td><td>'+esc(s.typeUI||'')+'</td><td>'+A.fq(s.puiss)+' kW</td><td>'+A.fq(s.long)+' m</td><td></td></tr>'; }).join('');
    return '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px" border="1" cellpadding="5"><tr style="background:#f1f3f5"><th>Pièce</th><th>Surface</th><th>Type d\'unité</th><th>Puissance</th><th>Liaison</th><th>Exposition / remarques</th></tr>'+rows+'</table>';
  }

  /* ---------- PDF ---------- */
  function pdf(lot){
    var d=lot.data, sp=(d.splits||[]).filter(function(s){ return s.piece||num(s.surface); });
    var h='';
    if(sp.length){
      h+='<table style="width:100%;border-collapse:collapse;font-size:10.5px"><tr style="color:#121417"><th style="text-align:left;padding:3px 6px">Pièce</th><th style="text-align:left;padding:3px 6px">Unité intérieure</th><th style="text-align:right;padding:3px 6px">Puissance</th></tr>'+
        (d.splits||[]).map(function(s,j){ return '<tr><td style="text-align:left;padding:3px 6px;border-top:1px solid #eef1f5">'+esc(s.piece||('Unité '+(j+1)))+(num(s.surface)?' ('+A.fq(s.surface)+' m²)':'')+'</td><td style="text-align:left;padding:3px 6px;border-top:1px solid #eef1f5">'+esc(s.typeUI||'Mural')+'</td><td style="padding:3px 6px;border-top:1px solid #eef1f5;text-align:right">'+A.fq(s.puiss)+' kW</td></tr>'; }).join('')+'</table>';
    }
    var ms=(d.machines||[]).filter(function(m){ return m.marque||m.ref; }).map(function(m){ return esc(((m.marque||'')+' '+(m.ref||'')).trim()); });
    if(ms.length||d.wifi) h+='<div style="font-size:10.5px;color:#555;margin-top:4px">'+(ms.length?'Équipements : '+ms.join(', '):'')+(d.wifi?(ms.length?' — ':'')+'pilotage connecté (Wi-Fi) prévu':'')+'</div>';
    return h;
  }
  function summary(lot){
    var d=lot.data, n=(d.splits||[]).length;
    var pieces=(d.splits||[]).map(function(s){ return (s.piece||'')+(s.piece?' ':'')+A.fq(s.puiss)+' kW'; }).join(', ');
    return (d.type||'Clim')+' — '+n+' unité'+(n>1?'s':'')+' intérieure'+(n>1?'s':'')+(pieces?' ('+pieces+')':'')+', '+(d.machines||[]).length+' groupe'+((d.machines||[]).length>1?'s':'')+' extérieur'+((d.machines||[]).length>1?'s':'');
  }
  function exclusions(){ return 'Plâtrerie, peinture et reprises de finition ; création d\'une ligne électrique depuis le tableau si elle n\'est pas chiffrée ci-dessus ; autorisations de copropriété ou d\'urbanisme (à la charge du client).'; }

  NXD2.register({
    id:'split', defaults:defaults, fromLegacy:fromLegacy, compute:compute, render:render, renderPart:renderPart, live:live, actions:actions,
    visite:VISITE, applyVisite:applyVisite, visitePrint:visitePrint, pdf:pdf, summary:summary, exclusions:exclusions,
    typeLabel:function(lot){ return (lot.data&&lot.data.type)||'Clim murale'; },
    isLegacyType:function(t){ return TYPES.indexOf(t)>=0; },
    remember:function(lot){ return {units:unitsOf(lot.data||{})}; },
    _taskRows:taskRows, UNITS_DEF:UNITS_DEF
  });
})();
