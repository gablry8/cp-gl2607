/* ============================================================
   ClimPilot Next — next-catalogue.js  (catalogue fournisseurs, v1 — 30/09/2026)
   - Importer le fichier de prix d'un fournisseur (Excel ou CSV, tel que
     téléchargé sur son espace pro : Téréva, Cedeo, Rexel, GFF…) ;
     colonnes reconnues toutes seules (référence, désignation, prix net,
     prix public, remise, unité, EAN, famille, marque), corrigeables.
   - Chercher une référence ou une désignation, voir le prix de chaque
     fournisseur (le moins cher en premier).
   - Quand tu tapes une pièce dans une intervention ou un devis, les
     références du catalogue sont proposées ; à la 1re utilisation l'article
     entre dans ta base de prix (synchronisée), avec fournisseur et référence.
   - Nouveau tarif importé : les articles de ta base venant de ce fournisseur
     reprennent le nouveau prix d'achat (ancien prix gardé dans l'historique).
   Le catalogue reste sur l'appareil où il est importé (IndexedDB) : trop gros
   pour la synchro. Rien n'est inventé : pas de prix, pas de catalogue.
   ============================================================ */
(function(){
  'use strict';
  var DBN='climpilot-catalogue', ST='art', IMP='imports', db=null, CAT=null, SUG={}, MAXROWS=60000;
  var XLSX_URL='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var LISTS={pieceDL:1,extraDL:1,nxdpPieceDL:1,nxd2PrixDL:1};
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function money(n){ try{ return eur(n); }catch(e){ return r2(n).toFixed(2)+' €'; } }
  function toastX(m){ try{ toast(m); }catch(e){} }
  function today(){ try{ return todayISO(); }catch(e){ return new Date().toISOString().slice(0,10); } }
  function fmtD(iso){ return iso?new Date(iso+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function slug(s){ return norm(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,60); }

  /* ---------------- stockage (IndexedDB) ---------------- */
  function idb(){
    return new Promise(function(res,rej){
      if(db) return res(db);
      if(!window.indexedDB) return rej(new Error('stockage du navigateur indisponible'));
      var r=indexedDB.open(DBN,1);
      r.onupgradeneeded=function(){ var d=r.result; if(!d.objectStoreNames.contains(ST)){ var s=d.createObjectStore(ST,{keyPath:'k'}); s.createIndex('four','four'); } if(!d.objectStoreNames.contains(IMP)) d.createObjectStore(IMP,{keyPath:'four'}); };
      r.onsuccess=function(){ db=r.result; res(db); }; r.onerror=function(){ rej(r.error); };
    });
  }
  function reqP(q){ return new Promise(function(res,rej){ q.onsuccess=function(){ res(q.result); }; q.onerror=function(){ rej(q.error); }; }); }
  function txDone(t){ return new Promise(function(res,rej){ t.oncomplete=function(){ res(); }; t.onerror=t.onabort=function(){ rej(t.error||new Error('écriture impossible')); }; }); }
  function all(){ if(CAT) return Promise.resolve(CAT); return idb().then(function(d){ return reqP(d.transaction(ST).objectStore(ST).getAll()); }).then(function(a){ CAT=a||[]; return CAT; }); }
  function imports(){ return idb().then(function(d){ return reqP(d.transaction(IMP).objectStore(IMP).getAll()); }); }
  function removeFour(four){
    return idb().then(function(d){
      var t=d.transaction([ST,IMP],'readwrite'), s=t.objectStore(ST), ix=s.index('four');
      ix.openCursor(IDBKeyRange.only(four)).onsuccess=function(e){ var c=e.target.result; if(c){ c.delete(); c.continue(); } };
      t.objectStore(IMP).delete(four); return txDone(t);
    }).then(function(){ CAT=null; });
  }
  function saveImport(four,rows,info){
    return idb().then(function(d){
      var t=d.transaction([ST,IMP],'readwrite'), s=t.objectStore(ST), ix=s.index('four');
      /* un nouveau tarif remplace l'ancien tarif du même fournisseur */
      return new Promise(function(res,rej){
        ix.openCursor(IDBKeyRange.only(four)).onsuccess=function(e){ var c=e.target.result; if(c){ c.delete(); c.continue(); return; }
          rows.forEach(function(r){ s.put(r); }); t.objectStore(IMP).put(info); };
        t.oncomplete=function(){ CAT=null; res(); }; t.onerror=t.onabort=function(){ rej(t.error||new Error('écriture impossible')); };
      });
    });
  }

  function putInfo(info){ return idb().then(function(d){ var t=d.transaction(IMP,'readwrite'); t.objectStore(IMP).put(info); return txDone(t); }); }
  /* lignes ajoutées une par une (facture d'achat) : on complète le tarif du fournisseur sans le remplacer */
  function mergeRows(four,rows,extra){
    return imports().then(function(a){
      var info=a.find(function(i){ return i.four===four; })||{four:four,n:0,date:today(),fichier:'factures d\'achat',pubOnly:false};
      return idb().then(function(d){
        var t=d.transaction([ST,IMP],'readwrite'), s=t.objectStore(ST);
        rows.forEach(function(r){ s.put(r); });
        return txDone(t);
      }).then(function(){ CAT=null; return all(); }).then(function(allr){
        info.n=allr.filter(function(x){ return x.four===four; }).length; info.at=Date.now(); delete info.upd; Object.assign(info,extra||{});
        return putInfo(info);
      });
    });
  }

  /* ---------------- synchro entre appareils (table climpilot_catalogue) ---------------- */
  var TBL='climpilot_catalogue', PART=4000, lastPull=0, pulling=null;
  function cloud(){ try{ return (typeof sb!=='undefined'&&sb&&typeof SESS!=='undefined'&&SESS&&SESS.user)?sb:null; }catch(e){ return null; } }
  function pack(r){ return [r.ref,r.lib,r.prix,r.pub,r.unite,r.ean,r.fam,r.marque,r.pubOnly?1:0,r.date]; }
  function unpack(four,a){ var r={four:four,ref:String(a[0]||''),lib:String(a[1]||a[0]||''),prix:Number(a[2])||0,pub:a[3]==null?null:Number(a[3]),unite:a[4]||'unité',ean:a[5]||'',fam:a[6]||'',marque:a[7]||'',pubOnly:!!a[8],date:a[9]||''};
    r.k=four+'|'+(r.ref||r.lib); r.s=norm([r.lib,r.ref,r.marque,r.fam,r.ean].join(' ')); return r; }
  function pushFour(four){
    var c=cloud(); if(!c) return Promise.resolve(false);
    return Promise.all([all(),imports()]).then(function(v){
      var rows=v[0].filter(function(x){ return x.four===four; }), info=v[1].find(function(i){ return i.four===four; })||{four:four,date:today()};
      var now=new Date().toISOString(), parts=[];
      for(var i=0;i<Math.max(1,Math.ceil(rows.length/PART));i++) parts.push({four:four,part:i,date:info.date||today(),n:rows.length,pub_only:!!info.pubOnly,fichier:info.fichier||'',rows:rows.slice(i*PART,(i+1)*PART).map(pack),updated_at:now});
      return c.from(TBL).delete().eq('four',four).then(function(r){ if(r&&r.error) throw new Error(r.error.message);
        var ch=Promise.resolve(); parts.forEach(function(p){ ch=ch.then(function(){ return c.from(TBL).insert(p).then(function(r2){ if(r2&&r2.error) throw new Error(r2.error.message); }); }); });
        return ch; }).then(function(){ info.upd=now; return putInfo(info); }).then(function(){ return true; });
    }).catch(function(e){ try{ console.warn('catalogue : envoi cloud impossible',e); }catch(err){} return false; });
  }
  function removeRemote(four){ var c=cloud(); if(!c) return Promise.resolve(false); return c.from(TBL).delete().eq('four',four).then(function(r){ return !(r&&r.error); }).catch(function(){ return false; }); }
  /* au démarrage (et à l'ouverture de la base de prix) : récupère les tarifs importés sur un autre appareil */
  function pull(force){
    var c=cloud(); if(!c) return Promise.resolve(0);
    if(pulling) return pulling; if(!force&&Date.now()-lastPull<60000) return Promise.resolve(0);
    lastPull=Date.now();
    pulling=c.from(TBL).select('four,part,date,n,pub_only,fichier,updated_at').eq('part',0).then(function(r){
      if(!r||r.error||!Array.isArray(r.data)) return 0;
      var remote={}; r.data.forEach(function(x){ remote[x.four]=x; });
      return imports().then(function(loc){
        var lm={}, jobs=[], n=0; loc.forEach(function(i){ lm[i.four]=i; });
        Object.keys(remote).forEach(function(four){
          var rr=remote[four], li=lm[four], rAt=Date.parse(rr.updated_at)||0;
          var newer=!li||(li.upd?(Date.parse(li.upd)||0)<rAt:(li.at||0)<rAt);
          if(li&&!li.upd&&(li.at||0)>=rAt){ jobs.push(function(){ return pushFour(four); }); return; }   /* import local plus récent, jamais envoyé */
          if(!newer) return;
          jobs.push(function(){ return c.from(TBL).select('part,rows').eq('four',four).order('part').then(function(pr){
            if(!pr||pr.error||!Array.isArray(pr.data)) return;
            var rows=[]; pr.data.sort(function(a,b){ return a.part-b.part; }).forEach(function(p){ (p.rows||[]).forEach(function(a){ rows.push(unpack(four,a)); }); });
            return saveImport(four,rows,{four:four,n:rows.length,date:rr.date||'',fichier:rr.fichier||'',pubOnly:!!rr.pub_only,upd:rr.updated_at,at:rAt}).then(function(){ n++; });
          }); });
        });
        loc.forEach(function(li){
          if(remote[li.four]) return;
          if(li.upd) jobs.push(function(){ return removeFour(li.four); });   /* retiré sur un autre appareil */
          else jobs.push(function(){ return pushFour(li.four); });           /* importé avant la synchro : on l'envoie */
        });
        var ch=Promise.resolve(); jobs.forEach(function(j){ ch=ch.then(j).catch(function(){}); });
        return ch.then(function(){ return n; });
      });
    }).catch(function(){ return 0; }).then(function(n){ pulling=null; if(n){ try{ renderStats(); }catch(e){} } return n; });
    return pulling;
  }
  window.nxcatPull=pull; window.nxcatPush=pushFour;

  /* ---------------- lecture des fichiers ---------------- */
  function decode(buf){ try{ return new TextDecoder('utf-8',{fatal:true}).decode(buf); }catch(e){ try{ return new TextDecoder('windows-1252').decode(buf); }catch(e2){ return new TextDecoder().decode(buf); } } }
  function parseCSV(txt){
    txt=String(txt).replace(/^\uFEFF/,'');
    var first=txt.split(/\r?\n/)[0]||'', cnt=function(ch){ return first.split(ch).length-1; };
    var sep=[';',',','\t','|'].sort(function(a,b){ return cnt(b)-cnt(a); })[0];
    var rows=[], row=[], cell='', q=false;
    for(var i=0;i<txt.length;i++){
      var c=txt[i];
      if(q){ if(c==='"'){ if(txt[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; continue; }
      if(c==='"') q=true;
      else if(c===sep){ row.push(cell); cell=''; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&txt[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=''; if(rows.length>MAXROWS+20) break; }
      else cell+=c;
    }
    if(cell!==''||row.length){ row.push(cell); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(x){ return String(x).trim()!==''; }); });
  }
  function loadXLSX(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=XLSX_URL; s.onload=function(){ window.XLSX?res(window.XLSX):rej(new Error('lecteur Excel indisponible')); }; s.onerror=function(){ rej(new Error('lecteur Excel non chargé (connexion internet nécessaire pour un fichier Excel ; un CSV marche hors ligne)')); }; document.head.appendChild(s); });
  }
  function readFile(file){
    return file.arrayBuffer().then(function(buf){
      var n=String(file.name||'').toLowerCase();
      if(/\.(xlsx|xlsm|xls|ods)$/.test(n)) return loadXLSX().then(function(X){
        var wb=X.read(new Uint8Array(buf),{type:'array'});
        var names=wb.SheetNames||[], pick=names.filter(function(s){ return /commerce|tarif|prix|article/i.test(s); })[0];
        if(!pick){ var best=0; names.forEach(function(s){ var ref=wb.Sheets[s]['!ref']; var nr=ref?X.utils.decode_range(ref).e.r:0; if(nr>best){ best=nr; pick=s; } }); }
        return X.utils.sheet_to_json(wb.Sheets[pick||names[0]],{header:1,raw:true,defval:''});
      });
      return parseCSV(decode(buf));
    });
  }

  /* ---------------- colonnes ---------------- */
  var ROLES=[
    ['ref','Référence',/^(r[ée]f(\.|[ée]rence)?( ?(fournisseur|commerciale|article|produit|frs|fab))?|refciale|code ?(article|produit)?|article|sku)$/],
    ['lib','Désignation',/(d[ée]signation|libell|description|intitul|nom du produit|produit)/],
    ['net','Prix net HT',/(prix ?net|^net|votre prix|vos prix|prix remis|prix client|tarif net|pnet|prix achat|prix d.achat)/],
    ['pub','Prix public / tarif HT',/(prix public|^tarif|ppc|prix catalogue|prix de base|prix brut|prix ?ht|^prix$)/],
    ['rem','Remise %',/(remise|^rem\.?$|discount)/],
    ['unite','Unité',/^(ub|unit[ée]|u\.?v\.?|conditionnement|cdt)$/],
    ['ean','EAN',/(ean|gtin)/],
    ['fam','Famille',/(famille|^fam1$|^mkt1$|cat[ée]gorie|gamme)/],
    ['marque','Marque',/(marque|fabricant)/]
  ];
  function detect(rows){
    var h=0, best=-1;
    for(var i=0;i<Math.min(15,rows.length);i++){ var sc=0; rows[i].forEach(function(c){ var t=norm(c); ROLES.forEach(function(R){ if(t&&R[2].test(t)) sc++; }); }); if(sc>best){ best=sc; h=i; } }
    var head=(rows[h]||[]).map(function(c){ return String(c==null?'':c).trim(); }), map={};
    ROLES.forEach(function(R){ var j=head.findIndex(function(c,k){ return R[2].test(norm(c))&&!Object.keys(map).some(function(x){ return map[x]===k; }); }); if(j>=0) map[R[0]]=j; });
    return {h:h,head:head,map:map};
  }
  function numFr(v){
    if(typeof v==='number') return v;
    var s=String(v==null?'':v).replace(/[€\s\u00a0\u202f]/g,'');
    if(!s) return NaN;
    if(/,\d{1,4}$/.test(s)) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,'');
    var n=parseFloat(s); return isFinite(n)?n:NaN;
  }
  function buildRows(rows,det,four,gRem){
    var m=det.map, out=[], skipped=0, seen={}, pubOnly=m.net==null&&m.rem==null&&!(gRem>0), dt=today();
    rows.slice(det.h+1).forEach(function(r){
      var g=function(k){ return m[k]==null?'':r[m[k]]; };
      var ref=String(g('ref')).trim(), lib=String(g('lib')).trim();
      if(!ref&&!lib){ skipped++; return; }
      var net=numFr(g('net')), pub=numFr(g('pub')), rem=numFr(g('rem')), prix=NaN, po=false;
      if(isFinite(net)&&net>0) prix=net;
      else if(isFinite(pub)&&pub>0){ var rr=isFinite(rem)&&rem>0?(rem>1?rem:rem*100):(gRem>0?gRem:0); prix=pub*(1-rr/100); po=!(rr>0); }
      if(!(prix>0)){ skipped++; return; }
      var k=four+'|'+(ref||lib); if(seen[k]){ skipped++; return; } seen[k]=1;
      out.push({k:k,four:four,ref:ref,lib:lib||ref,prix:r2(prix),pub:isFinite(pub)&&pub>0?r2(pub):null,unite:String(g('unite')).trim()||'unité',ean:String(g('ean')).trim(),fam:String(g('fam')).trim(),marque:String(g('marque')).trim(),date:dt,pubOnly:po,s:norm([lib,ref,g('marque'),g('fam'),g('ean')].join(' '))});
    });
    pubOnly=out.length>0&&out.every(function(x){ return x.pubOnly; });
    return {rows:out.slice(0,MAXROWS),skipped:skipped,trunc:out.length>MAXROWS,pubOnly:pubOnly};
  }

  /* ---------------- recherche ---------------- */
  function search(q,lim){
    var t=norm(q).split(' ').filter(Boolean); if(!t.length) return Promise.resolve([]);
    var qr=norm(q).replace(/\s/g,'');
    return all().then(function(a){
      var r=a.filter(function(e){ return t.every(function(x){ return e.s.indexOf(x)>=0; }); });
      r.sort(function(x,y){ var ax=norm(x.ref).replace(/\s/g,'')===qr?0:1, ay=norm(y.ref).replace(/\s/g,'')===qr?0:1; return ax-ay||String(x.lib).localeCompare(String(y.lib))||x.prix-y.prix; });
      return r.slice(0,lim||40);
    });
  }
  function nomFor(e){ return (String(e.lib||e.ref).slice(0,90)+(e.ref&&e.lib&&e.lib!==e.ref?' — réf '+e.ref:'')).trim(); }
  function guessCat(e){ var s=norm(e.lib+' '+e.fam);
    if(/cuivre|tube cu|couronne/.test(s)) return 'Cuivre'; if(/cable|\bcâble/.test(s)) return 'Câble'; if(/goulotte/.test(s)) return 'Goulotte';
    if(/pompe|relevage/.test(s)) return 'Pompe'; if(/condensat/.test(s)) return 'Condensats'; if(/support|console|silent/.test(s)) return 'Supports';
    return 'Pièces dépannage'; }
  function margeFor(cat){ try{ if(cat==='Pièces dépannage') return Number(P.dep.margeP)||40; var m=P.marges&&P.marges[cat]; return m!=null?Number(m):35; }catch(e){ return 35; } }
  /* l'article du catalogue entre dans la base de prix (synchronisée) : c'est lui que les devis et interventions utilisent */
  function promote(e,webTxt){
    var customs=load(LS.custom,[]), nom=nomFor(e);
    var ex=customs.find(function(p){ return (p.catFour===e.four&&p.catRef&&p.catRef===e.ref)||p.nom===nom; });
    var cat=ex&&ex.cat?ex.cat:guessCat(e);
    var o={nom:ex?ex.nom:nom,cat:cat,unite:e.unite||'unité',achat:r2(e.prix),marge:ex&&ex.marge!=null?ex.marge:margeFor(cat),verif:!!e.pubOnly,src:'local',catFour:e.four,catRef:e.ref,ean:e.ean||'',
      web:webTxt||('Tarif '+e.four+' importé le '+fmtD(e.date)+(e.pubOnly?' — prix public (pas ton prix net) : à vérifier':''))};
    if(ex){ if(r2(ex.achat)!==o.achat) (ex.hist=ex.hist||[]).push({date:today(),achat:ex.achat,four:ex.catFour||''}); Object.assign(ex,o); }
    else customs.push(Object.assign({id:'cat_'+slug(e.four+'_'+(e.ref||e.lib))},o));
    save(LS.custom,customs); try{ rebuildPrix(); }catch(err){}
    return o.nom;
  }
  window.nxcatPromote=promote;
  /* nouveau tarif : les articles de ta base qui viennent de ce fournisseur suivent le nouveau prix */
  function refreshBase(four,rows){
    var by={}; rows.forEach(function(r){ if(r.ref) by[r.ref]=r; });
    var customs=load(LS.custom,[]), n=0;
    customs.forEach(function(p){ if(p.catFour!==four||!p.catRef||!by[p.catRef]) return; var r=by[p.catRef];
      if(r2(p.achat)!==r.prix){ (p.hist=p.hist||[]).push({date:today(),achat:p.achat,four:four}); p.achat=r.prix; p.verif=!!r.pubOnly; p.web='Tarif '+four+' importé le '+fmtD(r.date)+(r.pubOnly?' — prix public : à vérifier':''); n++; } });
    if(n){ save(LS.custom,customs); try{ rebuildPrix(); }catch(e){} }
    return n;
  }

  /* ---------------- suggestions dans les champs « pièce / article » ---------------- */
  var tmr=null;
  function suggest(inp){
    var id=inp.getAttribute('list'), dl=id&&document.getElementById(id), v=inp.value;
    if(!dl) return;
    Array.prototype.slice.call(dl.querySelectorAll('option.nxcat')).forEach(function(o){ o.remove(); });
    if(String(v).trim().length<3) return;
    search(v,8).then(function(r){
      var have={}; try{ (PRIX||[]).forEach(function(p){ have[p.nom]=1; }); }catch(e){}
      r.forEach(function(e){ var n=nomFor(e); SUG[n]=e; if(have[n]) return; var o=document.createElement('option'); o.className='nxcat'; o.value=n; o.label=e.four+' — '+money(e.prix)+' HT'; dl.appendChild(o); });
    }).catch(function(){});
  }
  function pick(inp){ var v=inp.value, e=SUG[v]; if(!e) return; try{ if(!findPrix(v)) promote(e); }catch(err){} }
  document.addEventListener('input',function(ev){ var t=ev.target; if(!t||t.tagName!=='INPUT'||!LISTS[t.getAttribute('list')]) return; pick(t); clearTimeout(tmr); tmr=setTimeout(function(){ suggest(t); },150); },true);
  document.addEventListener('change',function(ev){ var t=ev.target; if(t&&t.tagName==='INPUT'&&LISTS[t.getAttribute('list')]) pick(t); },true);

  /* ---------------- écran « Base de prix » : carte Catalogue ---------------- */
  function card(){
    var v=document.getElementById('v-prix'); if(!v) return null;
    var c=document.getElementById('nxCatCard'); if(c) return c;
    c=document.createElement('div'); c.className='card'; c.id='nxCatCard';
    c.innerHTML='<h2>📚 Catalogue fournisseurs</h2>'+
      '<div class="sub" style="margin-bottom:8px">Importe le fichier de prix d\'un fournisseur (Excel ou CSV, téléchargé sur ton espace pro). Ses références sont ensuite proposées quand tu tapes une pièce dans une intervention ou un devis ; à la 1re utilisation, l\'article entre dans ta base de prix avec son fournisseur et sa référence.</div>'+
      '<div class="row-actions" style="margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn-pri btn-sm" type="button" onclick="nxcatImport()">⤒ Importer un tarif fournisseur</button><button class="btn-ghost btn-sm" type="button" onclick="nxcatFacture()">📷 Facture d\'achat → prix à jour</button></div>'+
      '<div id="nxCatStats" class="sub"></div>'+
      '<input id="nxCatQ" type="search" autocomplete="off" placeholder="Chercher une référence ou une désignation (ex. : AE4440, détendeur, contacteur 25 A)" style="width:100%;margin-top:8px" oninput="nxcatFind(this.value)">'+
      '<div id="nxCatRes" style="margin-top:8px"></div>'+
      '<div class="sub" style="margin-top:8px">Un tarif importé sur un appareil arrive tout seul sur les autres (connectés au cloud) à leur ouverture.</div>';
    var cats=document.getElementById('prixCats'); v.insertBefore(c,cats||null);
    return c;
  }
  function renderStats(){
    var el=document.getElementById('nxCatStats'); if(!el) return;
    imports().then(function(a){
      el.innerHTML=a.length?a.sort(function(x,y){ return String(x.four).localeCompare(String(y.four)); }).map(function(i){ return '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line,#e3e8ef);padding:5px 0"><span><b>'+esc(i.four)+'</b> — '+(i.n||0).toLocaleString('fr-FR')+' références · tarif importé le '+fmtD(i.date)+(i.pubOnly?' · <span style="color:var(--orange,#d97706)">prix publics, pas tes prix nets</span>':'')+(i.fichier?' · '+esc(i.fichier):'')+(i.upd?' · ☁️ synchronisé':(cloud()?' · <span style="color:var(--orange,#d97706)">pas encore envoyé</span>':''))+'</span><button class="iconbtn d" type="button" title="Retirer ce tarif" onclick="nxcatRemove(\''+esc(String(i.four).replace(/'/g,"\\'"))+'\')">🗑</button></div>'; }).join('')
        :'Aucun tarif importé pour l\'instant.';
    }).catch(function(e){ el.textContent='Catalogue indisponible sur ce navigateur ('+(e.message||e)+').'; });
  }
  window.nxcatFind=function(q){
    var el=document.getElementById('nxCatRes'); if(!el) return;
    if(String(q||'').trim().length<2){ el.innerHTML=''; return; }
    search(q,40).then(function(r){
      if(!r.length){ el.innerHTML='<div class="sub">Rien trouvé.</div>'; return; }
      var best={}; r.forEach(function(e){ var k=norm(e.ref)||norm(e.lib); if(best[k]==null||e.prix<best[k]) best[k]=e.prix; });
      el.innerHTML=r.map(function(e,i){ var k=norm(e.ref)||norm(e.lib), cheap=r.filter(function(x){ return (norm(x.ref)||norm(x.lib))===k; }).length>1&&e.prix===best[k];
          return '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line,#e3e8ef);padding:8px 0">'+
            '<div style="min-width:0"><div style="font-weight:600">'+esc(e.lib)+'</div><div class="sub">'+(e.ref?'réf. '+esc(e.ref)+' · ':'')+esc(e.four)+(e.marque?' · '+esc(e.marque):'')+'</div></div>'+
            '<div style="text-align:right;white-space:nowrap"><b>'+money(e.prix)+'</b> HT'+(e.unite&&e.unite!=='unité'&&e.unite!=='U'?' / '+esc(e.unite):'')+
            (cheap?'<div><span class="tag payee" style="font-size:9.5px">le moins cher</span></div>':'')+(e.pubOnly?'<div><span class="tag verifier" style="font-size:9.5px">prix public</span></div>':'')+
            '<div><button class="btn-ghost btn-sm" type="button" style="margin-top:4px" onclick="nxcatAdd('+i+')">＋ Ma base</button></div></div></div>'; }).join('');
      window._nxcatLast=r;
    }).catch(function(e){ el.textContent='Recherche impossible : '+(e.message||e); });
  };
  window.nxcatAdd=function(i){ var e=(window._nxcatLast||[])[i]; if(!e) return; var n=promote(e); toastX('« '+n+' » ajouté à ta base de prix'); try{ renderPrix(); }catch(err){} };
  window.nxcatRemove=function(four){ if(!confirm('Retirer le tarif « '+four+' » du catalogue, sur tous tes appareils ? (les articles déjà passés dans ta base de prix restent)')) return; removeFour(four).then(function(){ return removeRemote(four); }).then(function(){ renderStats(); toastX('Tarif retiré'); }).catch(function(e){ toastX('⚠ '+(e.message||e)); }); };

  /* ---------------- fenêtre d'import ---------------- */
  var IMPST=null;
  function modal(html){
    var m=document.getElementById('nxCatModal');
    if(!m){ m=document.createElement('div'); m.id='nxCatModal'; m.style.cssText='position:fixed;inset:0;background:rgba(15,20,30,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto'; document.body.appendChild(m); }
    m.innerHTML='<div style="background:var(--card,#fff);color:var(--ink,#121417);border-radius:12px;max-width:760px;width:100%;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+html+'</div>';
    m.style.display='flex'; return m;
  }
  window.nxcatClose=function(){ var m=document.getElementById('nxCatModal'); if(m) m.style.display='none'; IMPST=null; };
  window.nxcatImport=function(){
    imports().catch(function(){ return []; }).then(function(a){
      modal('<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">⤒ Importer un tarif fournisseur</h2><button class="iconbtn" type="button" onclick="nxcatClose()">✕</button></div>'+
        '<div class="frm" style="margin-top:10px"><label>Fournisseur<input id="nxci_four" list="nxci_fourDL" placeholder="ex. : Téréva, Cedeo, GFF"><datalist id="nxci_fourDL">'+a.map(function(i){ return '<option value="'+esc(i.four)+'">'; }).join('')+'</datalist></label>'+
        '<label>Fichier (Excel ou CSV)<input id="nxci_file" type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt" onchange="nxcatRead()"></label></div>'+
        '<div id="nxci_body" class="sub" style="margin-top:8px">Choisis le fichier téléchargé sur l\'espace pro du fournisseur. Un nouveau tarif du même fournisseur remplace l\'ancien.</div>');
    });
  };
  window.nxcatRead=function(){
    var f=(document.getElementById('nxci_file').files||[])[0], body=document.getElementById('nxci_body'); if(!f) return;
    body.innerHTML='Lecture du fichier…';
    readFile(f).then(function(rows){
      if(!rows||rows.length<2){ body.innerHTML='⚠ Fichier vide ou illisible.'; return; }
      IMPST={rows:rows,det:detect(rows),fichier:f.name}; mapUI();
    }).catch(function(e){ body.innerHTML='⚠ '+esc(e.message||e); });
  };
  function mapUI(){
    var s=IMPST, body=document.getElementById('nxci_body'); if(!s||!body) return;
    var opts=function(role){ return '<option value="">—</option>'+s.det.head.map(function(h,j){ return '<option value="'+j+'"'+(s.det.map[role]===j?' selected':'')+'>'+esc(h||('colonne '+(j+1)))+'</option>'; }).join(''); };
    var prev=s.rows.slice(s.det.h+1,s.det.h+6);
    body.innerHTML='<div style="color:inherit"><b>Colonnes reconnues</b> — corrige si besoin :</div>'+
      '<div class="frm" style="margin-top:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">'+ROLES.map(function(R){ return '<label>'+R[1]+'<select data-role="'+R[0]+'" onchange="nxcatMap(this)">'+opts(R[0])+'</select></label>'; }).join('')+
      '<label>Remise générale (%) <input id="nxci_rem" type="number" step="0.5" min="0" max="90" placeholder="si pas de prix net"><span class="note-inline">seulement quand le fichier n\'a que le prix public</span></label></div>'+
      '<div class="scroll" style="margin-top:8px"><table><thead><tr>'+s.det.head.map(function(h){ return '<th class="l">'+esc(h)+'</th>'; }).join('')+'</tr></thead><tbody>'+prev.map(function(r){ return '<tr>'+s.det.head.map(function(h,j){ return '<td class="l">'+esc(r[j])+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table></div>'+
      '<div class="sub" style="margin-top:6px">'+Math.max(0,s.rows.length-s.det.h-1).toLocaleString('fr-FR')+' lignes dans le fichier.</div>'+
      '<div class="row-actions" style="margin-top:10px"><button class="btn-pri" type="button" onclick="nxcatDoImport()">Importer</button><button class="btn-ghost" type="button" onclick="nxcatClose()">Annuler</button></div><div id="nxci_msg" style="margin-top:8px"></div>';
  }
  window.nxcatMap=function(sel){ if(!IMPST) return; var r=sel.getAttribute('data-role'); if(sel.value==='') delete IMPST.det.map[r]; else IMPST.det.map[r]=Number(sel.value); };
  window.nxcatDoImport=function(){
    var s=IMPST, msg=document.getElementById('nxci_msg'); if(!s) return;
    var four=String((document.getElementById('nxci_four')||{}).value||'').trim();
    if(!four){ msg.innerHTML='⚠ Indique le nom du fournisseur.'; return; }
    if(s.det.map.ref==null&&s.det.map.lib==null){ msg.innerHTML='⚠ Choisis au moins la colonne « Référence » ou « Désignation ».'; return; }
    if(s.det.map.net==null&&s.det.map.pub==null){ msg.innerHTML='⚠ Choisis la colonne du prix (net ou public).'; return; }
    var g=Number((document.getElementById('nxci_rem')||{}).value)||0;
    var b=buildRows(s.rows,s.det,four,g);
    if(!b.rows.length){ msg.innerHTML='⚠ Aucune ligne avec un prix : vérifie les colonnes.'; return; }
    msg.innerHTML='Import en cours…';
    saveImport(four,b.rows,{four:four,n:b.rows.length,date:today(),fichier:s.fichier,pubOnly:b.pubOnly,at:Date.now()}).then(function(){
      var up=refreshBase(four,b.rows);
      pushFour(four).then(function(ok){ var m2=document.getElementById('nxci_cloud'); if(m2) m2.textContent=ok?'☁️ Envoyé sur tes autres appareils (ils le récupèrent à l\'ouverture).':(cloud()?'⚠ Envoi sur tes autres appareils impossible pour l\'instant : ClimPilot réessaiera.':''); renderStats(); });
      msg.innerHTML='✅ '+b.rows.length.toLocaleString('fr-FR')+' références importées'+(b.skipped?' ('+b.skipped+' lignes ignorées : sans prix ou en double)':'')+(b.trunc?' — limité à '+MAXROWS.toLocaleString('fr-FR')+' lignes : filtre le fichier par familles':'')+
        (up?'<br>'+up+' article(s) de ta base de prix mis à jour avec le nouveau prix d\'achat (ancien prix gardé dans l\'historique).':'')+
        (b.pubOnly?'<br><span style="color:var(--orange,#d97706)">⚠ Prix publics : sans prix net ni remise, ce ne sont pas tes prix d\'achat — les articles utilisés seront marqués « à vérifier ».</span>':'')+
        '<div id="nxci_cloud" class="sub" style="margin-top:6px"></div><div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" type="button" onclick="nxcatClose()">Fermer</button></div>';
      renderStats(); try{ renderPrix(); }catch(e){}
      window._nxcatLastImport={n:b.rows.length,skipped:b.skipped,updated:up,pubOnly:b.pubOnly};
    }).catch(function(e){ msg.innerHTML='⚠ Import impossible : '+esc(e.message||e); });
  };

  /* ---------------- facture d'achat (photo ou PDF) → prix d'achat à jour ---------------- */
  var FAC=null;
  function b64(buf){ var s='', b=new Uint8Array(buf), CH=0x8000; for(var i=0;i<b.length;i+=CH) s+=String.fromCharCode.apply(null,b.subarray(i,i+CH)); return btoa(s); }
  function resizeImg(file,max){
    return new Promise(function(res,rej){
      var img=new Image(), url=URL.createObjectURL(file);
      img.onload=function(){ var k=Math.min(1,max/Math.max(img.width,img.height)); var c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.85).split(',')[1]); };
      img.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('image illisible')); };
      img.src=url;
    });
  }
  window.nxcatFacture=function(){
    imports().catch(function(){ return []; }).then(function(a){
      modal('<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">📷 Facture d\'achat → prix à jour</h2><button class="iconbtn" type="button" onclick="nxcatClose()">✕</button></div>'+
        '<div class="sub" style="margin:8px 0">Photo de la facture (ou le PDF reçu par mail) : l\'IA lit chaque ligne, tu vérifies, et les prix d\'achat de ta base se mettent à jour. Coût : environ 1 à 2 centimes par facture, compté dans ton plafond IA du mois.</div>'+
        '<datalist id="nxcf_fourDL">'+a.map(function(i){ return '<option value="'+esc(i.four)+'">'; }).join('')+'</datalist>'+
        '<label style="display:block">Photo ou PDF<input id="nxcf_file" type="file" accept="image/*,application/pdf" onchange="nxcatFactRead()" style="display:block;margin-top:4px"></label>'+
        '<div id="nxcf_body" style="margin-top:10px"></div>');
    });
  };
  window.nxcatFactRead=function(){
    var f=(document.getElementById('nxcf_file').files||[])[0], body=document.getElementById('nxcf_body'); if(!f||!body) return;
    var c=cloud(); if(!c){ body.innerHTML='⚠ Connecte-toi au cloud (en haut de ClimPilot) : la lecture passe par ton assistant IA.'; return; }
    var pdf=/pdf/i.test(f.type||'')||/\.pdf$/i.test(f.name||'');
    body.innerHTML='🤖 Lecture de la facture… (10 à 30 secondes)';
    (pdf?f.arrayBuffer().then(function(buf){ var d=b64(buf); if(d.length>4500000) throw new Error('PDF trop lourd (3 Mo maximum) : envoie seulement la page utile ou une photo'); return {media_type:'application/pdf',data:d}; })
        :resizeImg(f,2000).then(function(d){ return {media_type:'image/jpeg',data:d}; }))
    .then(function(doc){ return c.functions.invoke('assistant',{body:{mode:'facture',doc:doc}}); })
    .then(function(r){ if(r&&r.error){ var ctx=r.error.context; if(ctx&&typeof ctx.json==='function') return ctx.json().catch(function(){ return {erreur:'http',message:r.error.message}; }); return {erreur:'reseau',message:'Assistant injoignable — vérifie ta connexion.'}; } return (r&&r.data)||{erreur:'vide',message:'Réponse vide'}; })
    .then(function(res){
      if(!res||res.type!=='facture'){ body.innerHTML='⚠ '+esc(res&&res.erreur==='cle_absente'?'IA non activée : la clé API n\'est pas installée.':(res&&res.message)||'Lecture impossible.'); return; }
      FAC={f:res.facture||{},budget:res.budget}; factUI();
    }).catch(function(e){ body.innerHTML='⚠ '+esc(e.message||e); });
  };
  function baseMatch(four,l){
    var customs=[]; try{ customs=load(LS.custom,[]); }catch(e){}
    var ref=String(l.ref||'').trim(), lib=norm(l.designation||'');
    return customs.find(function(p){ return ref&&p.catRef===ref&&p.catFour===four; })||customs.find(function(p){ return ref&&p.catRef===ref; })||
      customs.find(function(p){ return lib&&norm(p.nom)===lib; })||null;
  }
  function factUI(){
    var f=FAC.f, L=Array.isArray(f.lignes)?f.lignes:[], body=document.getElementById('nxcf_body'); if(!body) return;
    var four=String(f.fournisseur||'').trim(), tot=0;
    L.forEach(function(l){ var q=Number(l.qte)||0, pu=Number(l.pu_ht)||0; tot+=q&&pu?q*pu:(Number(l.total_ht)||0); });
    var ecart=Number(f.total_ht)>0&&Math.abs(tot-Number(f.total_ht))>1;
    body.innerHTML='<div class="frm" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">'+
      '<label>Fournisseur<input id="nxcf_four" list="nxcf_fourDL" value="'+esc(four)+'"></label><label>Facture n°<input id="nxcf_num" value="'+esc(f.numero||'')+'"></label><label>Date<input id="nxcf_date" type="date" value="'+esc(/^\d{4}-\d{2}-\d{2}$/.test(f.date||'')?f.date:today())+'"></label></div>'+
      (L.length?'':'<div class="warnbox" style="margin-top:8px">Aucune ligne lue : refais une photo plus nette, bien à plat.</div>')+
      L.map(function(l,i){
        var art=(l.nature||'article')==='article', pu=Number(l.pu_ht)||0, m=art?baseMatch(four,l):null;
        var st=!art?'<span class="sub">'+esc({port:'frais de port',consigne:'consigne',taxe:'taxe / éco-participation'}[l.nature]||'autre')+' — non repris</span>'
          :m?(Math.abs((Number(m.achat)||0)-pu)>0.005?'<span style="color:var(--orange,#d97706)">ta base : '+money(m.achat)+' → '+money(pu)+'</span>':'<span class="sub">ta base : prix inchangé</span>')
          :'<span class="sub">nouvel article</span>';
        return '<div style="display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line,#e3e8ef);padding:7px 0">'+
          '<input type="checkbox" data-nxcf="'+i+'"'+(art&&pu>0?' checked':'')+' style="width:auto">'+
          '<div style="min-width:0;flex:1"><div style="font-weight:600">'+esc(l.designation||l.ref||'—')+'</div><div class="sub">'+(l.ref?'réf. '+esc(l.ref)+' · ':'')+esc(String(l.qte==null?'':l.qte))+' '+esc(l.unite||'')+(l.remise_pct?' · remise '+esc(l.remise_pct)+' %':'')+(l.calcule?' · prix calculé (total ÷ quantité)':'')+'</div><div>'+st+'</div></div>'+
          '<label style="width:110px;flex:none">PU net HT<input type="number" step="0.01" min="0" data-nxcfpu="'+i+'" value="'+(pu||'')+'"></label></div>';
      }).join('')+
      (ecart?'<div class="warnbox" style="margin-top:8px">⚠ Les lignes font '+money(tot)+' HT, la facture annonce '+money(f.total_ht)+' HT : une ligne est peut-être mal lue. Compare avec la facture.</div>':'')+
      ((f.illisible||[]).length?'<div class="warnbox" style="margin-top:8px">Illisible / incertain : '+esc(f.illisible.join(' ; '))+'</div>':'')+
      '<div class="warnbox" style="margin-top:8px">⚠️ Vérifie chaque prix avec la facture : l\'IA lit, elle ne certifie pas.</div>'+
      '<div class="row-actions" style="margin-top:10px"><button class="btn-pri" type="button" onclick="nxcatFactApply()">Mettre à jour mes prix</button><button class="btn-ghost" type="button" onclick="nxcatClose()">Annuler</button></div>'+
      '<div id="nxcf_msg" style="margin-top:8px"></div>'+(FAC.budget?'<div class="sub" style="margin-top:4px">IA ce mois : '+String(FAC.budget.depense_eur).replace('.',',')+' € / '+String(FAC.budget.plafond_eur).replace('.',',')+' €</div>':'');
  }
  window.nxcatFactApply=function(){
    var f=FAC&&FAC.f, msg=document.getElementById('nxcf_msg'); if(!f) return;
    var four=String((document.getElementById('nxcf_four')||{}).value||'').trim(), num=String((document.getElementById('nxcf_num')||{}).value||'').trim(), dt=String((document.getElementById('nxcf_date')||{}).value||'')||today();
    if(!four){ msg.innerHTML='⚠ Indique le fournisseur.'; return; }
    var L=f.lignes||[], rows=[], up=0, cr=0;
    Array.prototype.slice.call(document.querySelectorAll('[data-nxcf]')).forEach(function(cb){
      if(!cb.checked) return; var i=Number(cb.getAttribute('data-nxcf')), l=L[i]; if(!l) return;
      var pu=numFr((document.querySelector('[data-nxcfpu="'+i+'"]')||{}).value); if(!(pu>0)) return;
      var e={four:four,ref:String(l.ref||'').trim(),lib:String(l.designation||l.ref||'').trim(),prix:r2(pu),pub:null,unite:l.unite||'unité',ean:'',fam:'',marque:'',pubOnly:false,date:dt};
      if(!e.lib&&!e.ref) return;
      e.k=four+'|'+(e.ref||e.lib); e.s=norm([e.lib,e.ref].join(' ')); rows.push(e);
      var m=baseMatch(four,l);
      if(m&&(!e.ref||!m.catRef||m.catRef===e.ref)){ var cs=load(LS.custom,[]), p=cs.find(function(x){ return x.id===m.id; });
        if(p){ if(r2(p.achat)!==e.prix) (p.hist=p.hist||[]).push({date:today(),achat:p.achat,four:p.catFour||''}); p.achat=e.prix; p.verif=false; p.catFour=four; if(e.ref) p.catRef=e.ref; p.web='Facture '+four+(num?' n° '+num:'')+' du '+fmtD(dt); save(LS.custom,cs); try{ rebuildPrix(); }catch(err){} } up++; }
      else { var exists=load(LS.custom,[]).some(function(x){ return x.nom===nomFor(e)||(x.catFour===four&&e.ref&&x.catRef===e.ref); }); promote(e,'Facture '+four+(num?' n° '+num:'')+' du '+fmtD(dt)); exists?up++:cr++; }
    });
    if(!rows.length){ msg.innerHTML='⚠ Aucune ligne cochée avec un prix.'; return; }
    msg.innerHTML='Enregistrement…';
    mergeRows(four,rows).then(function(){ return pushFour(four); }).then(function(ok){
      msg.innerHTML='✅ '+(up?up+' prix mis à jour dans ta base':'')+(up&&cr?', ':'')+(cr?cr+' article(s) ajouté(s)':'')+' — ancien prix gardé dans l\'historique.'+(ok?' ☁️ Aussi sur tes autres appareils.':'')+
        '<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" type="button" onclick="nxcatClose()">Fermer</button></div>';
      renderStats(); try{ renderPrix(); }catch(e){}
      window._nxcatLastFact={up:up,cr:cr,n:rows.length};
    }).catch(function(e){ msg.innerHTML='⚠ '+esc(e.message||e); });
  };

  /* test / assistant : import direct depuis des lignes déjà lues */
  window.nxcatImportRows=function(four,rows,gRem){ var det=detect(rows), b=buildRows(rows,det,four,gRem||0); return saveImport(four,b.rows,{four:four,n:b.rows.length,date:today(),fichier:'',pubOnly:b.pubOnly,at:Date.now()}).then(function(){ return pushFour(four); }).then(function(pushed){ return {n:b.rows.length,skipped:b.skipped,updated:refreshBase(four,b.rows),pubOnly:b.pubOnly,map:det.map,pushed:pushed}; }); };
  window.nxcatSearch=search; window.nxcatParseCSV=parseCSV; window.nxcatNumFr=numFr; window.nxcatReadFile=readFile; window.nxcatDetect=detect;

  function hook(tries){
    tries=tries||0;
    var rp=window.renderPrix;
    if(typeof rp!=='function'){ if(tries<30) setTimeout(function(){ hook(tries+1); },300); return; }
    if(!rp._nxcat){ var w=function(){ var r=rp.apply(this,arguments); try{ card(); renderStats(); pull(false); }catch(e){} return r; }; w._nxcat=true; window.renderPrix=w; }
    /* la session cloud arrive un peu après le démarrage : on récupère alors les tarifs des autres appareils */
    var k=0, iv=setInterval(function(){ k++; if(cloud()){ clearInterval(iv); pull(true); } else if(k>40) clearInterval(iv); },1500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ hook(0); }); else hook(0);
})();
