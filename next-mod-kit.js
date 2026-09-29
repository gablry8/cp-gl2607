/* ============================================================
   ClimPilot Next — next-mod-kit.js
   Boîte à outils commune aux modules de devis (phases 3 à 6) :
   - articles ajoutés à la base de prix une seule fois, « à vérifier » ;
   - lignes chiffrées depuis la base (achat, marge, prix de vente) ;
   - main-d'œuvre tâche par tâche (temps de départ proposés, retenus
     à l'enregistrement) ;
   - reprise de la chaîne de calcul existante (machines, liaisons,
     électricité, mise en service, consommables, articles) ;
   - sections de formulaire standard (machines, périphériques,
     mise en service, articles, main-d'œuvre).
   Aucun prix inventé : un article sans prix d'achat est signalé.
   ============================================================ */
(function(){
  'use strict';
  if(!window.NXD2) return;
  var A=NXD2.api, esc=A.esc, num=A.num, K={A:A,esc:esc,num:num};

  /* ---------- base de prix ---------- */
  K.pr=function(nom){ try{ return findPrix(nom)||null; }catch(e){ return null; } };
  K.names=function(f){ try{ return (PRIX||[]).filter(f).map(function(p){ return p.nom; }); }catch(e){ return []; } };
  K.cat=function(c,re){ return K.names(function(p){ return p.cat===c&&(!re||re.test(p.nom)); }); };
  K.slug=function(s){ return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); };
  K.first=function(list,pref){ for(var i=0;i<(pref||[]).length;i++){ if(list.indexOf(pref[i])>=0) return pref[i]; } return list[0]||''; };
  /* list : [nom, catégorie, unité, achat HT, source] ; ajoutés une seule fois (repère synchronisé), jamais par-dessus un article existant */
  K.seed=function(mod,ver,list,date){
    try{
      var g=(A.DEFS()||{})[mod]; if(g&&num(g.seeded)>=ver) return 0;
      var customs=load(LS.custom,[]), have={}, n=0;
      (PRIX||[]).forEach(function(p){ have[p.nom]=1; }); customs.forEach(function(p){ have[p.nom]=1; });
      (list||[]).forEach(function(s){ if(have[s[0]]) return;
        customs.push({id:mod+'_'+K.slug(s[0]),nom:s[0],cat:s[1],unite:s[2],achat:s[3],marge:35,verif:true,src:'local',web:(s[4]||'')+(date?' — relevé le '+date:'')}); n++; });
      if(n){ save(LS.custom,customs); try{ rebuildPrix(); }catch(e){} }
      var all=A.DEFS(); all[mod]=Object.assign(all[mod]||{},{seeded:ver}); save('cpnext_d2_defaults',all);
      return n;
    }catch(e){ return 0; }
  };
  K.seededOk=function(mod,ver){ var g=(A.DEFS()||{})[mod]; return !!(g&&num(g.seeded)>=ver); };

  /* ---------- lignes ---------- */
  K.unit=function(u){ return u==='unité'?'u':(u||'u'); };
  /* constructeur de lignes : B.add(nom, qté, catégorie, libellé, options) depuis la base ; B.raw(...) pour une ligne libre */
  K.builder=function(warn){
    var B={lines:[],mat:[],verif:{}};
    B.add=function(nom,q,cat,label,o){
      o=o||{}; q=Math.max(0,num(q)); if(!nom||nom==='Aucun'||nom==='Aucune'||q<=0) return null;
      var p=K.pr(nom), grp=o.group||'Matériel', l;
      if(!p){
        if(o.achat!=null&&num(o.achat)>0){   /* pièce hors base : prix d'achat saisi dans le devis */
          var v=o.pu!=null&&num(o.pu)>0?num(o.pu):(function(){ try{ return priceVente(num(o.achat),o.marge!=null?num(o.marge):35); }catch(e){ return num(o.achat); } })();
          l=A.mkLine(grp,label||nom,A.fq(A.r2(q))+' '+K.unit(o.unite)+' × '+A.money(v),v*q,num(o.achat)*q,{qte:q,unite:K.unit(o.unite),pu:v});
          l.cat=cat; B.lines.push(l); B.mat.push({nom:nom,qte:q,unite:o.unite||'u',achatU:num(o.achat),venteU:v,ht:v*q}); return l;
        }
        l=A.mkLine(grp,label||nom,'⚠️ absent de la base de prix — prix 0, à corriger',0,0,{qte:q,unite:'u',pu:0}); l.cat=cat; B.lines.push(l);
        warn.push('« '+nom+' » : absent de la base de prix et sans prix d\'achat'); return l;
      }
      var achat=o.achat!=null&&num(o.achat)>0?num(o.achat):num(p.achat), u=0;
      if(o.pu!=null&&num(o.pu)>0) u=num(o.pu);
      else if(o.achat!=null&&num(o.achat)>0){ try{ u=priceVente(achat,o.marge!=null?num(o.marge):(p.marge!=null?p.marge:35)); }catch(e){ u=achat; } }
      else { try{ u=o.marge!=null?priceVente(num(p.achat),num(o.marge)):venteOf(nom,p.marge); }catch(e){} }
      if(!achat&&p.pv==null&&!(o.pu!=null&&num(o.pu)>0)) warn.push('« '+nom+' » : prix d\'achat à saisir dans la base de prix');
      if(p.verif) B.verif[nom]=1;
      var un=K.unit(p.unite);
      l=A.mkLine(grp,label||nom,A.fq(A.r2(q))+' '+un+' × '+A.money(u),u*q,achat*q,{qte:q,unite:un,pu:u});
      l.cat=cat; B.lines.push(l); B.mat.push({nom:nom,qte:q,unite:p.unite,achatU:achat,venteU:u,ht:u*q}); return l;
    };
    B.raw=function(group,label,detail,ht,achat,meta,cat){ var l=A.mkLine(group,label,detail,ht,achat,meta); if(cat) l.cat=cat; B.lines.push(l); return l; };
    return B;
  };
  K.verifWarn=function(B,warn){ var n=Object.keys(B.verif).length; if(n) warn.push(n+' article(s) au prix « à vérifier » : remplace-les par tes prix pro dans la base de prix'); };

  /* ---------- main-d'œuvre ---------- */
  K.savedUnits=function(mod){ var s=(A.DEFS()[mod]||{}).units; return s&&typeof s==='object'?s:null; };
  K.units=function(d,DEF){ var u=d.units||{}, o={}; Object.keys(DEF).forEach(function(k){ o[k]=(u[k]!=null&&u[k]!=='')?Math.max(0,num(u[k])):DEF[k]; }); return o; };
  K.initUnits=function(mod,DEF){ return Object.assign({},DEF,K.savedUnits(mod)||{}); };
  /* TASKS : [{k, l, u, q(d)}] → lignes { l, q, h1, h } ; + tâches libres (d.custom) */
  K.taskRows=function(d,TASKS,DEF){
    var u=K.units(d,DEF);
    var rows=TASKS.map(function(t){ var q=0; try{ q=num(t.q(d)); }catch(e){} return {k:t.k,l:t.l,u:t.u,q:q,h1:u[t.k],h:q*u[t.k]}; }).filter(function(r){ return r.q>0; });
    (d.custom||[]).forEach(function(c,j){ var h=Math.max(0,num(c.h)); rows.push({custom:j,l:c.l||'Autre tâche',q:1,h1:h,h:h}); });
    return rows;
  };
  K.taskLines=function(rows,rate,catLabel){
    return rows.filter(function(r){ return r.h>0; }).map(function(r){
      var l=A.mkLine('Pose & main-d’œuvre',r.l,A.fq(A.r2(r.h))+' h'+(r.custom==null?' ('+A.fq(r.q)+' × '+A.fq(r.h1)+' h '+r.u+')':'')+' × '+A.money(rate)+'/h',r.h*rate,0,{qte:r.h,unite:'h',pu:rate,mo:true});
      if(catLabel) l.catLabel=catLabel; return l;
    });
  };
  /* bloc « main-d'œuvre » du formulaire. cfg : {id, TASKS, DEF, forfait (clé P.forfait), hist (type), label, rate(lot)} */
  K.moBlock=function(lot,i,cfg){
    var d=lot.data, mode=d.moMode||'detail', rate=cfg.rate?cfg.rate(lot):A.rateOf(A.cur()), pid=cfg.id+i;
    var forf=cfg.forfait?(P.forfait||{})[cfg.forfait]:null, hist=cfg.hist?A.historyHours(cfg.hist):null;
    var modes=[['detail','Détail en heures (tâche par tâche)']];
    if(cfg.forfait&&forf!=null) modes.push(['forfait','Forfait pose — '+A.money(forf)]);
    modes.push(['heures','Heures globales']);
    var h='<h3>'+(cfg.title||'Main-d\'œuvre du lot')+'</h3><div class="frm">'+A.fSel('Mode de calcul','data.moMode',mode,modes,{re:'#'+pid})+'</div>';
    if(mode==='detail'){
      var rows=K.taskRows(d,cfg.TASKS,cfg.DEF), tot=A.sum(rows,function(r){ return r.h; });
      h+=rows.map(function(r){
        if(r.custom!=null) return '<div class="nxd2-task"><div class="l"><input type="text" placeholder="Autre tâche" data-k="data.custom.'+r.custom+'.l" data-t="s" value="'+esc((d.custom[r.custom]||{}).l||'')+'"></div>'+
          '<div class="v"><input type="number" step="0.25" min="0" inputmode="decimal" data-k="data.custom.'+r.custom+'.h" data-t="n" data-re="#'+pid+'" value="'+r.h1+'"> h '+K.btn('🗑','delTask',i,r.custom,'iconbtn d')+'</div></div>';
        return '<div class="nxd2-task"><div class="l">'+esc(r.l)+' <span class="sub2">· '+A.fq(A.r2(r.q))+' '+esc(r.u)+'</span></div>'+
          '<div class="v"><input type="number" step="0.05" min="0" inputmode="decimal" data-k="data.units.'+r.k+'" data-t="n" data-re="#'+pid+'" value="'+r.h1+'"> h/u = <b>'+A.fq(A.r2(r.h))+' h</b></div></div>';
      }).join('')+
      '<div class="nxd2-task tot"><div class="l">Total du lot</div><div class="v">'+A.fq(A.r2(tot))+' h · '+A.money(tot*rate)+' HT</div></div>'+
      K.btn('+ Ajouter une tâche','addTask',i)+
      (cfg.note?'<div class="nxd2-hint">'+cfg.note+'</div>':'')+
      (K.savedUnits(cfg.mod)?'':'<div class="nxd2-hint">Temps unitaires : <b>valeurs de départ proposées</b>, pas encore les tiennes. Ajuste-les ; ClimPilot les retient à l\'enregistrement.</div>');
      if(forf!=null&&forf>0&&tot*rate<forf*0.85) h+='<div class="nxd2-warn">Le détail donne '+A.money(tot*rate)+', soit moins que ton forfait pose ('+A.money(forf)+'). Vérifie tes temps : ce devis pourrait être sous-facturé.</div>';
    } else {
      h+='<div class="frm">'+A.fIn(mode==='forfait'?'Heures estimées (pour le gain horaire et le planning)':'Heures totales du lot','data.heures',d.heures,{t:'n',step:0.5,re:'#'+pid})+'</div>';
      if(mode==='forfait'&&forf!=null) h+='<div class="nxd2-hint">Forfait pose : '+A.money(forf)+(rate>0?' (≈ '+A.fq(A.r2(forf/rate))+' h à '+A.money(rate)+'/h)':'')+'.</div>';
    }
    if(hist) h+='<div class="nxd2-hint">Repère — tes '+hist.n+' devis « '+esc(cfg.hist)+' » précédents : '+A.fq(A.r2(hist.avg))+' h en moyenne (de '+A.fq(hist.min)+' à '+A.fq(hist.max)+' h).</div>';
    return h;
  };

  /* ---------- chaîne de calcul existante (machines, liaisons, électricité, MES, consommables, articles) ---------- */
  var BASE_KEYS=['machines','splits','groupCable','groupLong','goulottes','condLong','support','pompeType','pompeQte','extras','acces','supp','mes','brasure','tests','taille',
    'elecMode','breakerManual','breakerQte','differential','diffQte','proximity'];
  K.BASE_KEYS=BASE_KEYS;
  K.baseFromLegacy=function(s){ var o={}; BASE_KEYS.forEach(function(k){ if(s[k]!==undefined) o[k]=A.clone(s[k]); }); o.heures=num(s.heures); o.moMode=s.moMode==='heures'?'heures':'forfait'; return o; };
  /* cfg : {type, rows (tâches ou null), mode, heures, machineLabel, catLabel, noElec} */
  K.base=function(data,ctx,cfg){
    var o={type:cfg.type,machines:(data.machines||[]).map(function(m){ return {marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:num(m.marge),breaker:m.breaker||'',maxCurrent:num(m.maxCurrent)}; }),
      splits:A.clone(data.splits||[]),groupCable:data.groupCable,groupLong:num(data.groupLong),goulottes:A.clone(data.goulottes||[]),condLong:num(data.condLong),
      support:data.support||'Aucun',pompeType:data.pompeType||'Aucune',pompeQte:data.pompeQte,extras:A.clone(data.extras||[]),acces:data.acces||'0',supp:num(data.supp),
      mes:data.mes||'Aucune',brasure:data.brasure||'Aucune',tests:data.tests||'0',taille:data.taille||'auto',
      elecMode:cfg.noElec?'none':(data.elecMode||'none'),breakerManual:data.breakerManual,breakerQte:data.breakerQte,differential:!!data.differential,diffQte:data.diffQte,proximity:!!data.proximity,
      zone:'Aucun',rateChoice:ctx.d.rateChoice,rateCustom:ctx.d.rateCustom,acompteOn:false,acomptePct:0,tvaRate:0,estim:false};
    o.nbMach=o.machines.length; o.nbSplit=o.splits.length;
    var mode=cfg.mode||'detail', heures=0;
    if(mode==='detail'){ heures=A.sum(cfg.rows||[],function(r){ return r.h; }); o.moMode='heures'; o.heures=heures; }
    else if(mode==='forfait'){ o.moMode='forfait'; o.heures=num(cfg.heures); heures=num(cfg.heures); }
    else { o.moMode='heures'; o.heures=num(cfg.heures); heures=num(cfg.heures); }
    var c=A.LEGACY(o), rate=ctx.rate;
    var lines=c.lines.filter(function(l){ return !(l.group==='Frais & divers'&&(l.label==='Frais administratifs devis'||l.label==='Frais commande matériel'||/^Marge sécurité/.test(l.label))); });
    lines.forEach(function(l){
      if(l.group==='Pose & main-d’œuvre'&&(l.label==='Main-d’œuvre'||l.label==='Forfait pose')){ l.mo=true; if(cfg.catLabel) l.catLabel=cfg.catLabel; }
      if(cfg.machineLabel&&l.group==='Matériel'&&/^Machine\s*\d+/.test(l.label)) l.pdf=cfg.machineLabel;
    });
    if(mode==='detail'){
      var idx=-1; lines.forEach(function(l,j){ if(idx<0&&l.group==='Pose & main-d’œuvre'&&l.label==='Main-d’œuvre') idx=j; });
      if(idx>=0) lines.splice.apply(lines,[idx,1].concat(K.taskLines(cfg.rows||[],rate,cfg.catLabel)));
    }
    return {lines:lines,mat:c.mat||[],heures:heures};
  };
  K.insertAfterMat=function(lines,extra){ var at=0; lines.forEach(function(l,j){ if(l.group==='Matériel') at=j+1; }); lines.splice.apply(lines,[at,0].concat(extra)); return lines; };
  K.machineWarn=function(d,warn,label){ (d.machines||[]).forEach(function(m,j){ if(!num(m.achat)) warn.push((label||'Équipement')+((d.machines.length>1)?' '+(j+1):'')+(m.marque?' ('+m.marque+')':'')+' : prix d\'achat à saisir'); }); };
  K.legacyWarn=function(lines,warn){ lines.forEach(function(l){ if(/absent du catalogue/.test(l.detail||'')) warn.push('Article « '+l.label+' » absent de la base de prix'); }); };

  /* ---------- formulaire ---------- */
  K.sec=function(t,body,id){ return '<div class="nxd2-sec"'+(id?' id="'+id+'"':'')+'><h3>'+t+'</h3>'+body+'</div>'; };
  K.btn=function(lbl,act,i,extra,cls){ return '<button type="button" class="'+(cls||'btn-ghost btn-sm')+'" onclick="nxd2.act(\''+act+'\','+i+(extra!=null?','+extra:'')+')">'+lbl+'</button>'; };
  K.opts=function(list){ return list.map(function(x){ return Array.isArray(x)?x:[x,x]; }); };
  K.none=function(list,lbl){ return [['Aucun',lbl||'Aucun']].concat(K.opts(list)); };
  K.pInfo=function(nom){ var p=K.pr(nom); if(!p) return nom&&nom!=='Aucun'?'⚠️ absent de la base':''; var u=0; try{ u=venteOf(nom,p.marge); }catch(e){} return (num(p.achat)?A.money(u)+' / '+esc(K.unit(p.unite)):'prix d\'achat à saisir')+(p.verif?' · à vérifier':''); };
  K.mkMachine=function(extra){ return Object.assign({marque:'',ref:'',achat:0,marge:35,maxCurrent:0},extra||{}); };
  /* machines : cfg {title, row, fields:[[label,key,opts]], add:bool, pick:[noms de la base pour préremplir]} */
  K.secMachines=function(d,i,cfg){
    cfg=cfg||{}; var lib=(typeof MACHLIB!=='undefined'?MACHLIB:[])||[];
    var mh=(d.machines||[]).map(function(m,j){
      var p='data.machines.'+j+'.';
      return '<div class="nxd2-row">'+((cfg.add&&d.machines.length>1)?'<span class="del">'+K.btn('🗑','delMach',i,j,'iconbtn d')+'</span>':'')+
        '<b style="font-size:13px">'+esc(cfg.row||'Équipement')+(d.machines.length>1?' '+(j+1):'')+'</b><div class="frm nxk2">'+
        (lib.length?'<label class="full">📚 Bibliothèque<select onchange="nxd2.act(\'lib\','+i+','+j+',this.value)"><option value="">— choisir —</option>'+lib.map(function(x,q){ return '<option value="'+q+'">'+esc((x.marque||'')+' '+(x.ref||''))+' — '+A.money(x.achat)+'</option>'; }).join('')+'</select></label>':'')+
        ((cfg.pick&&cfg.pick.length)?'<label class="full">Depuis la base de prix<select onchange="nxd2.act(\'pickBase\','+i+','+j+',this.value)"><option value="">— choisir —</option>'+cfg.pick.map(function(n){ var pp=K.pr(n); return '<option value="'+esc(n)+'">'+esc(n)+(pp?' — '+A.money(pp.achat)+' HT':'')+'</option>'; }).join('')+'</select></label>':'')+
        A.fIn('Marque / type',p+'marque',m.marque)+A.fIn('Référence',p+'ref',m.ref)+
        A.fIn('Prix d\'achat HT (€)',p+'achat',m.achat,{t:'n',step:0.01})+A.fIn('Marge %',p+'marge',m.marge,{t:'n',step:1})+
        (cfg.fields||[]).map(function(f){ return A.fIn(f[0],p+f[1],m[f[1]]==null||m[f[1]]===0?'':m[f[1]],Object.assign({t:'n'},f[2]||{})); }).join('')+
        (cfg.current===false?'':A.fIn('Courant max (A)',p+'maxCurrent',m.maxCurrent||'',{t:'n',step:0.1,note:'notice → calibre'}))+
        '</div><div class="calc" id="nxd2mv'+i+'_'+j+'"></div>'+K.btn('☆ Mémoriser','mem',i,j)+'</div>';
    }).join('');
    return K.sec(cfg.title||'Équipement',mh+(cfg.add?K.btn('+ Ajouter','addMach',i):''));
  };
  K.liveMachines=function(lot,i){ (lot.data.machines||[]).forEach(function(m,j){ var el=document.getElementById('nxd2mv'+i+'_'+j); if(el){ var v=0; try{ v=priceVente(num(m.achat),num(m.marge)); }catch(e){} el.textContent='Prix de vente HT : '+A.money(v); } }); };
  /* périphériques : PER = [{k, l, nom, q, u, cat, on, note}] ; état dans d.per[k] = {on, q} */
  K.perState=function(d,x){ var s=(d.per||{})[x.k]; return {on:s?!!s.on:!!x.on,q:s&&s.q!=null&&s.q!==''?num(s.q):num(x.q==null?1:x.q)}; };
  K.initPer=function(PER){ var o={}; PER.forEach(function(x){ o[x.k]={on:!!x.on,q:x.q==null?1:x.q}; }); return o; };
  K.secPer=function(d,i,PER,title,hint){
    var rows=PER.map(function(x){
      var s=K.perState(d,x), nom=typeof x.nom==='function'?x.nom(d):x.nom;
      return '<div class="nxk-per"><label class="nxd2-chk" style="margin:0"><input type="checkbox" data-k="data.per.'+x.k+'.on" data-t="b" data-re="lot"'+(s.on?' checked':'')+'> <span>'+esc(x.l)+'</span></label>'+
        (s.on?'<span class="q"><input type="number" step="'+(x.step||1)+'" min="0" inputmode="decimal" data-k="data.per.'+x.k+'.q" data-t="n" value="'+s.q+'"> '+esc(x.u||'u')+'</span><span class="sub2">'+esc(K.pInfo(nom))+'</span>':'')+
        (x.note&&s.on?'<div class="sub2" style="flex-basis:100%">'+esc(x.note)+'</div>':'')+'</div>';
    }).join('');
    return K.sec(title||'Périphériques et fournitures',(hint?'<div class="nxd2-hint">'+hint+'</div>':'')+rows);
  };
  K.perLines=function(B,d,PER){ PER.forEach(function(x){ var s=K.perState(d,x); if(!s.on) return; var nom=typeof x.nom==='function'?x.nom(d):x.nom; B.add(nom,s.q,x.cat||'posemat',x.label||null); }); };
  K.secMes=function(d,opt){
    opt=opt||{}; var mesK=Object.keys(P.mes||{}), brK=Object.keys(P.bras||{});
    return K.sec(opt.title||'Mise en service et contrôles','<div class="frm">'+
      A.fSel('Mise en service','data.mes',d.mes,mesK.map(function(x){ return [x,x==='Aucune'?'Aucune':x+' — '+A.money(P.mes[x])]; }))+
      (opt.brasure===false?'':A.fSel('Brasure','data.brasure',d.brasure,brK.map(function(x){ return [x,x==='Aucune'?'Aucune':x+' — '+A.money(P.bras[x])]; })))+
      (opt.tests===false?'':A.fSel('Contrôle','data.tests',d.tests,[['0','Aucun'],['vide','Tirage au vide — '+A.money((P.tests||{}).vide)],['azote','Test azote — '+A.money((P.tests||{}).azote)],['etanch','Contrôle d\'étanchéité — '+A.money((P.tests||{}).etanch)]]))+
      A.fSel('Accès','data.acces',d.acces,[['0','Normal'],['diff','Difficile (+'+A.money((P.acces||{}).diff)+')']])+
      A.fIn('Suppléments chantier (€ HT)','data.supp',d.supp,{t:'n',step:1})+
      A.fSel('Consommables','data.taille',d.taille||'petit',[['petit','Petit chantier'],['moyen','Chantier moyen'],['gros','Gros chantier']])+'</div>');
  };
  K.secExtras=function(d,i){
    var dl='<datalist id="nxd2PrixDL">'+K.names(function(){ return true; }).map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>';
    var xh=(d.extras||[]).map(function(x,j){
      return '<div class="frm" style="align-items:end;margin-bottom:6px">'+A.fIn('Article','data.extras.'+j+'.nom',x.nom,{list:'nxd2PrixDL',re:'lot'})+A.fIn('Quantité','data.extras.'+j+'.qte',x.qte,{t:'n',step:0.5})+
        '<div class="calc">'+esc(K.pInfo(x.nom))+'</div><div>'+K.btn('🗑','delExtra',i,j,'iconbtn d')+'</div></div>';
    }).join('');
    return K.sec('Articles complémentaires',dl+(xh||'<div class="nxd2-hint">Aucun article complémentaire.</div>')+K.btn('+ Ajouter un article','addExtra',i));
  };
  K.secElec=function(d){
    var em=d.elecMode||'auto', gc=(typeof GROUP_CABLES!=='undefined'?GROUP_CABLES:['Câble 3G2,5']);
    return K.sec('Électricité','<div class="frm">'+A.fSel('Câble d\'alimentation','data.groupCable',d.groupCable,K.opts(gc))+A.fIn('Longueur (m)','data.groupLong',d.groupLong,{t:'n',step:0.5})+
      A.fSel('Protection électrique','data.elecMode',em,[['auto','Automatique (courant max)'],['manual','Choix manuel'],['none','Non fournie / existante à contrôler']],{re:'lot'})+
      (em==='manual'?A.fSel('Disjoncteur','data.breakerManual',d.breakerManual,K.opts(['Disjoncteur 16A','Disjoncteur 20A','Disjoncteur 32A']))+A.fIn('Quantité','data.breakerQte',d.breakerQte,{t:'n',step:1,min:1}):'')+'</div>'+
      (em!=='none'?A.fChk('Protection différentielle','data.differential',d.differential,{re:'lot'})+(d.differential?'<div class="frm">'+A.fIn('Nombre de différentiels','data.diffQte',d.diffQte,{t:'n',step:1,min:1})+'</div>':'')+A.fChk('Interrupteur de proximité IP65','data.proximity',d.proximity):'')+
      '<div class="nxd2-hint">Calibre et section à valider avec la notice constructeur.</div>');
  };
  K.secLiaison=function(d){
    var liais=K.cat('Cuivre'), cab=(typeof SPLIT_CABLES!=='undefined'?SPLIT_CABLES:['Câble 5G1,5']), s=(d.splits||[])[0]||{};
    return K.sec('Liaisons frigorifiques','<div class="frm">'+A.fSel('Liaison cuivre','data.splits.0.liaison',s.liaison||'',[['','Aucune']].concat(K.opts(liais)))+A.fIn('Longueur (m)','data.splits.0.long',s.long,{t:'n',step:0.5})+
      A.fSel('Câble d\'interconnexion','data.splits.0.cableInter',s.cableInter||'',[['','Aucun']].concat(K.opts(cab)))+'</div>');
  };
  /* actions communes */
  K.actions=function(extra){
    var a={
      lib:function(l,i,api,j,k){ if(k===''||k==null) return false; var m=(MACHLIB||[])[+k]; if(!m) return false; var c0=l.data.machines[j]||{}; l.data.machines[j]=Object.assign({},c0,{marque:m.marque||'',ref:m.ref||'',achat:num(m.achat),marge:m.marge!=null?num(m.marge):35}); try{ toast('Chargé : '+((m.marque||'')+' '+(m.ref||'')).trim()); }catch(e){} },
      pickBase:function(l,i,api,j,k){ if(!k) return false; var p=K.pr(k); if(!p) return false; var c0=l.data.machines[j]||{}; l.data.machines[j]=Object.assign({},c0,{marque:p.cat||'',ref:p.nom,achat:num(p.achat),marge:p.marge!=null?num(p.marge):35}); },
      mem:function(l,i,api,j){ var m=l.data.machines[j]; if(!m||(!m.marque&&!m.ref)){ try{ toast('Renseigne au moins la marque ou la référence'); }catch(e){} return false; }
        var o={marque:String(m.marque||'').trim(),ref:String(m.ref||'').trim(),achat:num(m.achat),marge:num(m.marge)}; var k=MACHLIB.findIndex(function(x){ return x.marque===o.marque&&x.ref===o.ref; });
        if(k>=0) MACHLIB[k]=o; else MACHLIB.push(o); try{ save(LS.machlib,MACHLIB); toast('☆ Mémorisé dans la bibliothèque'); }catch(e){} },
      addMach:function(l){ (l.data.machines||(l.data.machines=[])).push(K.mkMachine()); },
      delMach:function(l,i,api,j){ l.data.machines.splice(j,1); },
      addExtra:function(l){ (l.data.extras||(l.data.extras=[])).push({nom:'',qte:1}); },
      delExtra:function(l,i,api,j){ l.data.extras.splice(j,1); },
      addTask:function(l){ (l.data.custom||(l.data.custom=[])).push({l:'',h:1}); },
      delTask:function(l,i,api,j){ l.data.custom.splice(j,1); }
    };
    return Object.assign(a,extra||{});
  };
  /* visite : questions communes */
  K.VIS={
    acces:{k:'acces',l:'Accès / hauteur de travail',t:'sel',o:['','Normal (escabeau)','Échafaudage','Nacelle','Toiture (harnais)']},
    tableau:{k:'tableau',l:'Tableau électrique : place disponible',t:'sel',o:['','Oui','Non — à prévoir','À vérifier']},
    diff:{k:'diff',l:'Différentiel 30 mA en place',t:'sel',o:['','Oui','Non','À vérifier']},
    distTab:{k:'distTab',l:'Distance tableau → équipement (m)',t:'num'},
    amiante:{k:'amiante',l:'Amiante : bâtiment ancien, repérage avant travaux (percements) — à vérifier',t:'sel',o:['','Non concerné','À demander au client','Rapport fourni']},
    horaires:{k:'horaires',l:'Horaires d\'intervention possibles (commerce, activité)',t:'txt',full:true},
    notes:{k:'notes',l:'Notes pour ce lot',t:'area'}
  };
  K.applyCommon=function(v,d,msg){
    if(num(v.distTab)>0&&d.groupLong!=null){ d.groupLong=num(v.distTab); msg.push('alimentation '+A.fq(d.groupLong)+' m'); }
    if(/Échafaudage|Nacelle|Toiture/.test(v.acces||'')&&d.acces!=='diff'){ d.acces='diff'; msg.push('accès difficile'); }
    if(v.diff==='Non'&&!d.differential&&d.elecMode&&d.elecMode!=='none'){ d.differential=true; msg.push('différentiel'); }
  };
  /* copie d'un ancien devis : chaîne de calcul d'origine, même montant */
  K.legacyCompute=function(d,ctx,type,label){ var warn=[], b=K.base(d,ctx,{type:type,mode:d.moMode==='heures'?'heures':'forfait',heures:d.heures,catLabel:label}); K.legacyWarn(b.lines,warn); K.machineWarn(d,warn,'Machine'); return {lines:b.lines,mat:b.mat,heures:b.heures,detailH:d.moMode==='heures'?b.heures:0,warnings:warn}; };
  K.legacyRender=function(d,i,what,convert){ return '<div class="nxd2-banner">Copie d\'un ancien devis '+esc(what)+' : montants repris tels quels (machines, articles, main-d\'œuvre).'+(convert?'<br>'+K.btn('Passer au format détaillé','convert',i,null,'btn-pri btn-sm'):'')+'</div>'+
    K.secMachines(d,i,{title:'Machines',add:true})+K.secExtras(d,i)+K.secMes(d)+
    K.sec('Main-d\'œuvre','<div class="frm">'+A.fSel('Mode','data.moMode',d.moMode,[['forfait','Forfait (ancien réglage)'],['heures','Heures × taux']],{re:'lot'})+A.fIn('Heures','data.heures',d.heures,{t:'n',step:0.5})+'</div>'); };
  K.rememberUnits=function(DEF){ return function(lot){ return {units:K.units(lot.data||{},DEF)}; }; };
  K.pctEq=function(a,b){ return Math.abs(a-b)<0.005; };
  /* style commun : champs deux par ligne au téléphone */
  (function(){ if(document.getElementById('nxkStyle')) return; var st=document.createElement('style'); st.id='nxkStyle';
    st.textContent='.frm.nxk2>label{align-self:end;min-width:0}@media(min-width:861px){.frm.nxk2{grid-template-columns:repeat(4,minmax(0,1fr))}.frm.nxk2 .full{grid-column:span 2}}'+
      '@media(max-width:860px){.frm.nxk2{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}}'+
      '.nxk-per{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:7px 0;border-bottom:1px solid var(--line,#e3e8ef)}.nxk-per .q input{width:74px;text-align:right}.nxk-per .sub2{font-size:12px}'+
      '.nxk-meas{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px}@media(max-width:860px){.nxk-meas{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    (document.head||document.documentElement).appendChild(st); })();
  window.NXK=K;
})();
