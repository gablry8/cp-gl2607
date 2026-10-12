/* ============================================================
   ClimPilot Next — next-banque.js  (couche additive, 1.12 — 12/10/2026, relecture du 12/10 intégrée)
   « Mon relevé bancaire » (Objectifs & feux › Pour la comptable ; boutons dans les rappels impayés et trésorerie) :
   - tu choisis le fichier CSV exporté depuis ta banque. Il est lu SUR TON APPAREIL, jamais enregistré ni envoyé
     (il contient ton numéro de compte). ClimPilot ne garde que les paiements que tu valides, et une EMPREINTE
     (date, montant, libellé, chiffrés en un code) des lignes déjà rapprochées, pour ne jamais les reprendre deux fois
     (clé cpnext_bqvus, synchronisée) ;
   - chaque CRÉDIT est rapproché des factures impayées DU MÊME MONTANT, au centime (montant réellement dû : TTC si tu
     factures la TVA, avoirs déduits). Numéro COMPLET de la facture ou nom du client dans le libellé → « sûr », coché
     d'office ; sinon « à vérifier », à cocher toi-même. Un débit n'est jamais rapproché ;
   - jamais coché d'office, avec une alerte : un crédit dont le montant est déjà au livre des recettes à 7 jours près
     (paiement peut-être déjà marqué à la main), une date dans une période déjà déclarée à l'Urssaf ou déjà envoyée à
     ta comptable, un paiement d'un particulier reçu avant la fin du délai de l'art. L221-10 du Code de la consommation ;
   - un paiement partiel ou groupé (plusieurs factures en un virement) n'est jamais rapproché : à faire à la main ;
   - en validant, chaque facture cochée est marquée payée À LA DATE CHOISIE (date du crédit par défaut, modifiable :
     pour un chèque ou des espèces, la date à retenir est à voir avec ta comptable), par le même chemin que le bouton
     « Payée » : règle L221-10 (next-particuliers), journal des paiements (next-emission) ; un contrat avec un particulier
     « à préciser » est laissé de côté (à faire depuis la facture) ;
   - trésorerie : proposée avec le solde du relevé, jamais cochée d'office si tu en as déjà saisi une, refusée si ta
     saisie est plus récente que le relevé.
   Format reconnu : CSV séparé par « ; », « , » ou tabulation, UTF-8, UTF-16 ou Windows-1252 ; colonnes trouvées par leur
   titre (date d'opération, libellé, montant ou crédit / débit, solde). Une colonne « Montant » (ou « Crédit/Débit »)
   sans aucun montant négatif est REFUSÉE : crédits et débits seraient indiscernables. Sans titres reconnus, ClimPilot
   devine les colonnes seulement s'il n'y a qu'UNE colonne de montants, et signée. Montants ambigus (« 1.234 »,
   « 12,500 ») ignorés et comptés.
   ============================================================ */
(function(){
  'use strict';
  var MAX_OCTETS=5*1024*1024, KEY='cpnext_bqvus', JOURS_DEJA=7;
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}

  /* ---------- outils ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function e2(n){ try{ return eur(n); }catch(e){ return r2(n).toFixed(2).replace('.',',')+' €'; } }
  function iso(y,m,d){ var x=new Date(y,m,d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return iso(d.getFullYear(),d.getMonth(),d.getDate()); } }
  function okDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')); }
  function fr(s){ return okDate(s)?new Date(s+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function say(m){ try{ toast(m); }catch(e){} }
  function sansAccent(s){ return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function normH(s){ return sansAccent(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
  function normT(s){ return sansAccent(s).toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim(); }
  function joursEntre(a,b){ if(!okDate(a)||!okDate(b)) return 0; return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))|0; } return (h>>>0).toString(36); }

  /* ---------- lecture du fichier ---------- */
  function decoder(buf){ var u8=new Uint8Array(buf);
    if(u8.length>=2&&u8[0]===0xFF&&u8[1]===0xFE){ try{ return new TextDecoder('utf-16le').decode(u8.subarray(2)); }catch(e){} }
    if(u8.length>=2&&u8[0]===0xFE&&u8[1]===0xFF){ try{ return new TextDecoder('utf-16be').decode(u8.subarray(2)); }catch(e){} }
    try{ return new TextDecoder('utf-8',{fatal:true}).decode(u8); }catch(e){}
    try{ return new TextDecoder('windows-1252').decode(u8); }catch(e){ return new TextDecoder().decode(u8); } }
  window.nxbqDecoder=decoder;
  function compte(l,sep){ var n=0,q=false; for(var i=0;i<l.length;i++){ var c=l[i]; if(c==='"') q=!q; else if(c===sep&&!q) n++; } return n; }
  function separateur(txt){
    var L=txt.split(/\r\n|\n|\r/).filter(function(l){ return l.trim(); }).slice(0,15), best=';', score=-1;
    [';','\t',','].forEach(function(sep){ var c=L.map(function(l){ return compte(l,sep); }), max=Math.max.apply(null,c.concat([0])); if(max<1) return;
      var sc=c.filter(function(x){ return x===max; }).length*10+max; if(sc>score){ score=sc; best=sep; } });
    return best;
  }
  function parseCSV(txt,sep){
    var rows=[],row=[],f='',q=false,i,c;
    for(i=0;i<txt.length;i++){ c=txt[i];
      if(q){ if(c==='"'){ if(txt[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=c; }
      else if(c==='"') q=true;
      else if(c===sep){ row.push(f); f=''; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&txt[i+1]==='\n') i++; row.push(f); rows.push(row); row=[]; f=''; }
      else f+=c; }
    if(f!==''||row.length){ row.push(f); rows.push(row); }
    return rows.map(function(r){ return r.map(function(x){ return x.trim(); }); }).filter(function(r){ return r.some(function(x){ return x!==''; }); });
  }
  /* « 1 234,56 », « -12,30 », « \u221212,30 », « 1.234,56 », « 1234.56 », « 12,30- », « (12,30) », « +45 € », « 12,30 CR » → nombre.
     Ambigu (un seul séparateur suivi de 3 chiffres : « 1.234 », « 12,500 ») ou illisible → null. */
  function montant(s){
    s=String(s==null?'':s).trim(); if(!s) return null;
    var neg=false;
    s=s.replace(/\u2212/g,'-');
    var suf=/\s*(CR|DB|DR|C|D)$/i.exec(s); if(suf&&/\d/.test(s.slice(0,suf.index))){ if(/^(DB|DR|D)$/i.test(suf[1])) neg=true; s=s.slice(0,suf.index); }
    if(/^\(.*\)$/.test(s)){ neg=!neg; s=s.slice(1,-1); }
    s=s.replace(/[€\s\u00a0\u202f']/g,'').replace(/eur$/i,'');
    if(/-$/.test(s)){ neg=!neg; s=s.slice(0,-1); }
    if(/^[+-]/.test(s)){ if(s[0]==='-') neg=!neg; s=s.slice(1); }
    if(!/^\d[\d.,]*$/.test(s)) return null;
    var lc=s.lastIndexOf(','), ld=s.lastIndexOf('.'), nc=(s.match(/,/g)||[]).length, nd=(s.match(/\./g)||[]).length;
    if(lc>=0&&ld>=0){ if(lc>ld) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,''); }
    else if(lc>=0){ if(nc>1) s=s.replace(/,/g,''); else { if(s.length-lc-1===3) return null; s=s.replace(',','.'); } }
    else if(ld>=0){ if(nd>1) s=s.replace(/\./g,''); else if(s.length-ld-1===3) return null; }
    var n=Number(s); if(!isFinite(n)) return null;
    return r2(neg?-n:n);
  }
  function valide(y,mo,d){ if(y<2000||y>2100||mo<1||mo>12||d<1||d>31) return ''; var x=new Date(y,mo-1,d); if(x.getMonth()!==mo-1||x.getDate()!==d) return ''; return iso(y,mo-1,d); }
  /* « 15/11/2027 », « 15/11/27 », « 15-11-2027 », « 15.11.2027 », « 2027-11-15 » (heure éventuelle ignorée) → ISO ; sinon '' */
  function dateISO(s){ s=String(s==null?'':s).trim(); var m;
    if((m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:$|[T\s])/.exec(s))) return valide(+m[1],+m[2],+m[3]);
    if((m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})(?:$|\s)/.exec(s))){ var y=+m[3]; if(m[3].length===2) y+=2000; return valide(y,+m[2],+m[1]); }
    return ''; }
  window.nxbqMontant=montant; window.nxbqDate=dateISO;

  var COLS={
    date:[/^date ?op/,/^date (d )?operation/,/^date comptable/,/^date$/,/^date/],
    lib:[/^libelle/,/^label$/,/^intitule/,/^description/,/^detail/,/^motif/,/^operation$/,/^nature/],
    mnt:[/^montant/,/^amount/,/^somme/],
    cre:[/^credit/],
    deb:[/^debit/],
    sol:[/^solde/,/balance/]
  };
  function trouverEntete(rows){
    for(var i=0;i<Math.min(rows.length,25);i++){
      var H=rows[i].map(normH), idx={}, pris={};
      ['date','mnt','deb','cre','sol','lib'].forEach(function(k){ idx[k]=-1;
        for(var p=0;p<COLS[k].length&&idx[k]<0;p++) for(var j=0;j<H.length;j++){
          if(pris[j]) continue;
          if(k==='date'&&/valeur|^dateval|^date val/.test(H[j])) continue;
          if(k==='lib'&&/^date|^montant|^solde/.test(H[j])) continue;
          if(k==='mnt'&&/solde|balance/.test(H[j])) continue;
          if(k==='deb'&&/credit/.test(H[j])) continue;   /* « Crédit/Débit » = une seule colonne signée, pas une colonne débit */
          if(COLS[k][p].test(H[j])){ idx[k]=j; pris[j]=1; break; } } });
      if(idx.date>=0&&(idx.mnt>=0||idx.cre>=0)) return {ligne:i,idx:idx,auto:false,titres:rows[i]};
    }
    return null;
  }
  /* sans titres reconnus : une colonne de dates + UNE seule colonne de montants signés (sinon on refuse) */
  function deviner(rows){
    var n=Math.max.apply(null,rows.map(function(r){ return r.length; })), sc=[], j;
    for(j=0;j<n;j++){ var d=0,m=0,neg=0,len=0,tot=0;
      rows.slice(0,300).forEach(function(r){ var v=r[j]; if(v==null||v==='') return; tot++; len+=String(v).length;
        if(dateISO(v)) d++; else { var x=montant(v); if(x!=null){ m++; if(x<0) neg++; } } });
      sc.push({j:j,d:tot?d/tot:0,m:tot?m/tot:0,neg:neg,len:tot?len/tot:0}); }
    var dates=sc.filter(function(s){ return s.d>0.8; }), nums=sc.filter(function(s){ return s.m>0.8; });
    if(!dates.length||nums.length!==1||!nums[0].neg) return null;
    var lib=sc.filter(function(s){ return s.d<0.5&&s.m<0.5; }).sort(function(a,b){ return b.len-a.len; })[0];
    return {ligne:-1,idx:{date:dates[0].j,lib:lib?lib.j:-1,mnt:nums[0].j,cre:-1,deb:-1,sol:-1},auto:true};
  }
  function lignesReleve(rows,map){
    var out=[], ign=0, idx=map.idx, occ={};
    for(var i=Math.max(0,map.ligne+1);i<rows.length;i++){ var r=rows[i], d=dateISO(r[idx.date]), m=null, brut;
      if(idx.mnt>=0){ brut=r[idx.mnt]; m=montant(brut); }
      else { var cs=idx.cre>=0?r[idx.cre]:'', bs=idx.deb>=0?r[idx.deb]:'', c=montant(cs), b=montant(bs); brut=cs||bs;
        /* le crédit garde son signe (un « crédit » négatif = rejet, pas un encaissement) ; le débit est toujours une sortie */
        if(c!=null&&Math.abs(c)>0.004) m=c; else if(b!=null&&Math.abs(b)>0.004) m=-Math.abs(b); else if(c!=null||b!=null) m=0;
        else if(String(cs).trim()||String(bs).trim()) m=null; }
      if(!d||m==null){ var amt=String(brut||'').trim(); if(d||(amt&&/\d/.test(amt))) ign++; continue; }   /* ligne de données illisible : comptée */
      var lib=idx.lib>=0?String(r[idx.lib]||'').replace(/\s+/g,' ').slice(0,200):'';
      var base=d+'|'+r2(m).toFixed(2)+'|'+normH(lib); occ[base]=(occ[base]||0)+1;
      out.push({n:out.length,date:d,lib:lib,montant:m,solde:idx.sol>=0?montant(r[idx.sol]):null,emp:'bq:'+hash(base)+'.'+occ[base]});
    }
    return {lignes:out,ignorees:ign};
  }
  /* solde du compte : même valeur partout (solde à l'export) ou solde après la dernière opération */
  function soldeFinal(L){
    var avec=L.filter(function(x){ return x.solde!=null; }); if(!avec.length) return null;
    var maxD=L.reduce(function(a,x){ return x.date>a?x.date:a; },''), v=avec.map(function(x){ return x.solde; });
    if(v.every(function(x){ return Math.abs(x-v[0])<0.005; })) return {montant:v[0],date:maxD};
    var dern=avec.filter(function(x){ return x.date===maxD; }); if(!dern.length) return null;
    var desc=L.length>1&&L[0].date>L[L.length-1].date;   /* plus récent en haut : la 1re ligne du jour est la dernière opération */
    return {montant:(desc?dern[0]:dern[dern.length-1]).solde,date:maxD};
  }

  /* ---------- lignes déjà rapprochées (empreintes) ---------- */
  function vus(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ a=[]; } return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.id==='string'&&/^bq:[a-z0-9]+\.\d+$/.test(x.id); }):[]; }
  function noterVus(L){ if(!L.length) return; var a=vus(), deja={}; a.forEach(function(x){ deja[x.id]=1; });
    L.forEach(function(x){ if(!deja[x.id]){ a.push(x); deja[x.id]=1; } });
    if(a.length>5000) a=a.slice(a.length-5000);
    try{ save(KEY,a); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(_){} } }

  /* ---------- rapprochement ---------- */
  function factImpayees(){
    var imp=[], lig=[], parNum={};
    try{ imp=typeof window.allImpayes==='function'?window.allImpayes():[]; }catch(e){ imp=[]; }
    try{ lig=typeof window.nxrgLignesImpayes==='function'?window.nxrgLignesImpayes():[]; }catch(e){ lig=[]; }
    lig.forEach(function(l){ parNum[l.num]=l; });
    return imp.filter(function(i){ return i&&i.num; }).map(function(i){ var l=parNum[i.num], du=l?Number(l.ttc):Number(i.montant);
      return {kind:i.kind,id:i.id,which:i.which==null?'':String(i.which),num:i.num,client:i.client||'—',date:i.date||'',du:r2(du)}; })
      .filter(function(x){ return x.du>0.005; });
  }
  function encaissements(){ try{ return typeof window.nxrgLignesRecettes==='function'?window.nxrgLignesRecettes('',''):[]; }catch(e){ return []; } }
  /* numéro de facture COMPLET dans le libellé, en mots entiers (« F-2027-110 », « F2027110 », « F 2027 110 », ou « 2027-110 ») ;
     jamais un morceau de date ou de référence (« REF 20271105 » n'est pas F-2027-110) */
  function numDans(num,lib){
    var L=' '+normT(lib)+' ', P=normT(num).split(' ').filter(Boolean); if(P.length<2) return false;
    for(var k=0;k<=P.length-2;k++){ var sp=P.slice(k).join(' '), cp=P.slice(k).join('');
      if(cp.length<6||!/\d{4}/.test(cp)) continue;
      if(L.indexOf(' '+sp+' ')>=0||L.indexOf(' '+cp+' ')>=0) return true; }
    return false;
  }
  var STOP=['sarl','sas','sasu','eurl','scop','societe','ste','ets','etablissements','monsieur','madame','mademoiselle','mme','mlle','chez','restaurant','boulangerie','boucherie','pharmacie','garage','hotel','cafe','tabac','superette','supermarche','commerce','entreprise','france','sepa','virement','facture','client'];
  function nomDans(client,lib){ var L=' '+normH(lib)+' ';
    return normH(client).split(' ').filter(function(w){ return w.length>=4&&STOP.indexOf(w)<0; }).some(function(w){ return L.indexOf(' '+w+' ')>=0; }); }
  function modeDe(lib){ var L=' '+normH(lib)+' ';
    if(/ (chq|cheque|cheques|remise chq|rem chq) /.test(L)) return 'Chèque';
    if(/ (cb|carte|tpe|sumup) /.test(L)) return 'CB';
    if(/ (esp|especes) /.test(L)) return 'Espèces';
    return 'Virement'; }
  /* règle de paiement des particuliers (next-particuliers) évaluée À LA DATE du paiement */
  function regleA(f,date){
    if(typeof window.nxPartRegle!=='function') return {ok:true};
    var oT=window.todayISO;
    try{ if(okDate(date)) window.todayISO=function(){ return date; }; return window.nxPartRegle(f.kind,f.id)||{ok:true}; }
    catch(e){ return {ok:true}; } finally { window.todayISO=oT; }
  }
  function bloque(f){ var r=regleA(f,''); return (r&&!r.ok&&(r.motif==='a_preciser'||r.motif==='date'))?(r.texte||'Contrat avec un particulier à préciser.'):''; }
  function aJour(){ try{ return window.nxobjAJour?nxobjAJour():{decl:'',envoi:''}; }catch(e){ return {decl:'',envoi:''}; } }

  function rapprocher(L,F,V){
    var dejaVu={}; V.forEach(function(x){ dejaVu[x.id]=x; });
    var credits=L.filter(function(x){ return x.montant>0.004; }), paires=[];
    var res=credits.map(function(c){ return {c:c,cands:[],choix:null,score:null,conf:'aucun',mode:modeDe(c.lib),date:c.date,importe:dejaVu[c.emp]||null}; });
    credits.forEach(function(c,ci){ if(res[ci].importe) return; F.forEach(function(f,fi){ if(Math.abs(f.du-c.montant)>0.005) return;
      var pn=numDans(f.num,c.lib), pc=nomDans(f.client,c.lib), avant=!!(f.date&&c.date<f.date);
      paires.push({ci:ci,fi:fi,s:(pn?2:0)+(pc?1:0)-(avant?0.5:0),pn:pn,pc:pc,avant:avant,ecart:Math.abs(joursEntre(f.date||c.date,c.date))}); }); });
    paires.sort(function(a,b){ return b.s-a.s||a.ecart-b.ecart||a.ci-b.ci; });
    var pc={}, pf={};
    paires.forEach(function(p){ res[p.ci].cands.push(p); });
    paires.forEach(function(p){ if(pc[p.ci]||pf[p.fi]) return; pc[p.ci]=1; pf[p.fi]=1; res[p.ci].choix=p.fi; res[p.ci].score=p.s; });
    res.forEach(function(r,ci){
      if(r.importe){ r.conf='importe'; return; }
      if(r.choix==null){ r.conf=r.cands.length?'pris':'aucun'; return; }
      var p=r.cands.filter(function(x){ return x.fi===r.choix; })[0];
      var rivalIci=r.cands.some(function(x){ return x.fi!==r.choix&&x.s>=r.score; });
      var rivalAilleurs=paires.some(function(x){ return x.fi===r.choix&&x.ci!==ci&&x.s>=r.score; });
      if((p.pn||p.pc)&&!p.avant&&!rivalIci&&!rivalAilleurs) r.conf='sur';
      else if(r.cands.length===1&&!rivalAilleurs&&!p.avant) r.conf='probable';
      else r.conf='choisir';
    });
    return res;
  }
  /* alertes d'une ligne (recalculées à chaque affichage : la date ou la facture peuvent changer) */
  function alertes(r,F,E,AJ){
    var out=[], f=r.choix!=null?F[r.choix]:null;
    r.blocage=f?bloque(f):'';
    var deja=E.filter(function(x){ return Math.abs((Number(x.ttc)||0)-r.c.montant)<=0.005&&Math.abs(joursEntre(x.date,r.c.date))<=JOURS_DEJA; })[0];
    if(deja) out.push('Un encaissement de '+e2(r.c.montant)+' est déjà au livre des recettes le '+fr(deja.date)+' ('+(deja.num||'?')+', '+(deja.client||'—')+') : ce crédit est peut-être ce paiement-là, déjà marqué à la main.');
    if(f&&r.date<f.date) out.push('Date de paiement antérieure à la facture : vérifie que c’est bien ce paiement.');
    if(okDate(AJ.decl)&&r.date<=AJ.decl) out.push('Date dans une période déjà déclarée à l’Urssaf (jusqu’au '+fr(AJ.decl)+') : ce paiement changerait une déclaration faite. Vois avec ta comptable avant de cocher.');
    else if(okDate(AJ.envoi)&&r.date<=AJ.envoi) out.push('Date dans une période déjà envoyée à ta comptable (jusqu’au '+fr(AJ.envoi)+') : préviens-la si tu coches.');
    if(f&&!r.blocage){ var g=regleA(f,r.date); if(g&&!g.ok&&g.motif==='delai') out.push('Particulier : paiement reçu avant la fin du délai de 7 jours ('+(g.texte||'art. L221-10')+'). Coché, il sera enregistré comme IRRÉGULIER.'); }
    if(r.mode==='Chèque'||r.mode==='Espèces') out.push('Chèque ou espèces : la date retenue est celle du crédit sur le compte ; si tu as reçu le paiement avant, mets la date de réception si ta comptable le demande.');
    return out;
  }

  /* analyse complète d'un texte CSV (exposée pour les essais) */
  function analyser(txt){
    txt=String(txt||'').replace(/^\ufeff/,'');
    var sep=separateur(txt), rows=parseCSV(txt,sep);
    if(!rows.length) return {erreur:'Fichier vide.'};
    var map=trouverEntete(rows)||deviner(rows);
    if(!map) return {erreur:'Format non reconnu : ClimPilot ne trouve pas de colonne « date » et « montant » (ou « crédit »). Exporte le relevé en CSV depuis ton espace bancaire, ou envoie à Claude les 3 premières lignes du fichier (sans ton numéro de compte).'};
    var LR=lignesReleve(rows,map), L=LR.lignes;
    if(!L.length) return {erreur:'Aucune opération lisible dans ce fichier (dates ou montants illisibles).'};
    /* une colonne unique de montants doit contenir des sorties (montants négatifs) : sinon crédit et débit sont indiscernables */
    var unique=map.idx.mnt>=0||(map.idx.cre>=0&&map.idx.deb<0);
    if(unique&&!L.some(function(x){ return x.montant<0; }))
      return {erreur:'La colonne des montants ne contient aucune sortie (aucun montant négatif) : ClimPilot ne peut pas distinguer les crédits des débits (colonne « sens » à part ?). Exporte un relevé où les débits sont négatifs, ou avec deux colonnes « Débit » et « Crédit ».'};
    var F=factImpayees(), V=vus(), res=rapprocher(L,F,V), E=encaissements(), AJ=aJour();
    res.forEach(function(r){ r.alertes=alertes(r,F,E,AJ); r.coche=r.conf==='sur'&&!r.blocage&&r.alertes.length===0; });
    var dates=L.map(function(x){ return x.date; }).sort();
    return {sep:sep,auto:map.auto,lignes:L.length,ignorees:LR.ignorees,du:dates[0],au:dates[dates.length-1],credits:res.length,factures:F,res:res,solde:soldeFinal(L)};
  }
  window.nxbqAnalyser=analyser;

  /* ---------- enregistrement ---------- */
  function estPayee(f,date){
    try{
      if(f.kind==='devis'){ var d=(DEVIS||[]).find(function(x){ return x.id===f.id; }), g=d&&(f.which==='acompte'?d.facAcompte:d.facSolde); return !!(g&&g.payeLe===date); }
      if(f.kind==='dep'){ var x=(DEP||[]).find(function(o){ return o.id===f.id; }); return !!(x&&x.statut==='payee'&&x.payeLe===date); }
      if(f.kind==='loc'){ var l=(LOC||[]).find(function(o){ return o.id===f.id; }); return !!(l&&l.fac&&l.fac.payeLe===date); }
      if(f.kind==='ctr'){ var c=(CTR||[]).find(function(o){ return o.id===f.id; }), h=c&&(c.facs||[]).find(function(q){ return String(q.annee)===String(f.which); }); return !!(h&&h.payeLe===date); }
    }catch(e){}
    return false;
  }
  /* marque UNE facture payée à la date donnée, par le chemin normal (bouton « Payée ») ; renvoie '' si c'est fait */
  function payer(f,date,mode){
    if(!okDate(date)||date>today()) return 'date de paiement invalide (pas dans le futur)';
    var cur=factImpayees().filter(function(x){ return x.kind===f.kind&&x.id===f.id&&x.which===f.which&&x.num===f.num; })[0];
    if(!cur) return 'déjà payée ou introuvable';
    if(Math.abs(cur.du-f.du)>0.005) return 'montant changé depuis l’analyse';
    var b=bloque(cur); if(b) return b;
    if(f.kind==='dep'){ var x=(DEP||[]).find(function(o){ return o.id===f.id; }); if(!x||x.statut!=='facturee') return 'intervention pas à l’état « facturée »'; }
    var oT=window.todayISO, oM=window.askMode;
    try{
      window.todayISO=function(){ return date; }; window.askMode=function(){ return mode||'Virement'; };
      if(f.kind==='dep') window.payDep(f.id); else window.payerFacture(f.kind,f.id,f.which);
    }catch(e){ return 'erreur : '+(e&&e.message||e); }
    finally{ window.todayISO=oT; window.askMode=oM; }
    return estPayee(f,date)?'':'pas enregistrée (annulée ?)';
  }
  window.nxbqPayer=payer;

  /* ---------- fenêtre ---------- */
  var ETAT=null, MODES=['Virement','Chèque','CB','Espèces'];
  function fermer(){ var m=document.getElementById('nxbqM'); if(m) m.remove(); ETAT=null; }
  window.nxbqFermer=fermer;
  var CONF={sur:['Sûr','#16794a','#e7f6ee'],probable:['À vérifier','#b45309','#fff3e0'],choisir:['À choisir','#b45309','#fff3e0']};
  function badge(conf){ var c=CONF[conf]; return c?'<span style="font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;color:'+c[1]+';background:'+c[2]+'">'+c[0]+'</span>':''; }
  function nbCoches(){ return ETAT?ETAT.res.filter(function(r){ return r.coche&&r.choix!=null&&!r.blocage; }).length:0; }
  function majAlertes(r){ if(!ETAT) return; r.alertes=alertes(r,ETAT.factures,ETAT.enc,ETAT.aj); if(r.blocage) r.coche=false; }
  function rendre(){
    var m=document.getElementById('nxbqM'); if(!m||!ETAT) return;
    var A=ETAT, F=A.factures, t=today(), avec=A.res.filter(function(r){ return r.cands.length&&!r.importe; }), imp=A.res.filter(function(r){ return r.importe; }), sans=A.res.filter(function(r){ return !r.cands.length&&!r.importe; });
    var opt=function(r){ return '<option value="">— ne pas rapprocher —</option>'+r.cands.map(function(p){ var f=F[p.fi]; return '<option value="'+p.fi+'"'+(p.fi===r.choix?' selected':'')+'>'+esc(f.num+' · '+f.client+' · '+e2(f.du)+(f.date?' · du '+fr(f.date):''))+'</option>'; }).join(''); };
    var h='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0;font-size:16px">Mon relevé bancaire</h2><button class="btn-ghost btn-sm" onclick="nxbqFermer()" aria-label="Fermer">✕</button></div>'
      +'<div style="font-size:12.5px;color:var(--muted,#667085);margin:6px 0 10px;line-height:1.5">'+A.lignes+' opération(s) du '+fr(A.du)+' au '+fr(A.au)+' · '+A.credits+' crédit(s) · '+avec.length+' rapprochement(s) possible(s).'
      +(A.ignorees?' <b style="color:var(--orange,#b45309)">'+A.ignorees+' ligne(s) ignorée(s) : date ou montant illisible ou ambigu.</b>':'')
      +(A.auto?' Colonnes devinées d’après leur contenu : vérifie bien.':'')+' Le fichier n’est ni enregistré ni envoyé.</div>';
    if(!avec.length) h+='<div style="font-size:14px;margin:10px 0">Aucun crédit ne correspond au montant d’une facture impayée.</div>';
    h+=avec.map(function(r){ var i=A.res.indexOf(r);
      return '<div class="nxbq-l" data-i="'+i+'" style="border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:10px;margin:8px 0">'
        +'<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><label style="display:flex;gap:8px;align-items:center;font-weight:700;margin:0;text-transform:none;letter-spacing:0;font-size:14px;color:inherit"><input type="checkbox" '+(r.coche?'checked':'')+(r.choix==null||r.blocage?' disabled':'')+' onchange="nxbqCoche('+i+',this.checked)" style="width:18px;height:18px">+'+esc(e2(r.c.montant))+' crédité le '+fr(r.c.date)+'</label>'+badge(r.choix!=null?r.conf:'')+'</div>'
        +'<div style="font-size:12px;color:var(--muted,#667085);margin:4px 0 6px;word-break:break-word">'+esc(r.c.lib||'(sans libellé)')+'</div>'
        +'<div style="display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))"><select onchange="nxbqFacture('+i+',this.value)" aria-label="Facture">'+opt(r)+'</select>'
        +'<select onchange="nxbqMode('+i+',this.value)" aria-label="Mode de règlement">'+MODES.map(function(x){ return '<option'+(x===r.mode?' selected':'')+'>'+x+'</option>'; }).join('')+'</select>'
        +'<input type="date" value="'+esc(r.date)+'" max="'+esc(t)+'" onchange="nxbqDateLigne('+i+',this.value)" aria-label="Date de paiement retenue"></div>'
        +(r.conf==='pris'&&r.choix==null?'<div style="font-size:12px;color:var(--muted,#667085);margin-top:4px">La facture de ce montant est déjà rapprochée d’un autre crédit.</div>':'')
        +(r.alertes||[]).map(function(a){ return '<div class="nxbq-a" style="font-size:12px;color:var(--orange,#b45309);margin-top:4px">⚠ '+esc(a)+'</div>'; }).join('')
        +(r.blocage?'<div style="font-size:12px;color:var(--red,#b42318);margin-top:4px">'+esc(r.blocage)+' Marque ce paiement depuis la facture.</div>':'')
        +'</div>'; }).join('');
    if(imp.length) h+='<div style="font-size:12.5px;color:var(--muted,#667085);margin-top:8px">'+imp.length+' crédit(s) déjà rapproché(s) lors d’un import précédent : ignoré(s).</div>';
    if(sans.length) h+='<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px;font-weight:600">'+sans.length+' autre(s) crédit(s) sans facture du même montant (pas pris en compte)</summary><div style="font-size:12px;line-height:1.6;margin-top:6px">'
      +sans.slice(0,60).map(function(r){ return fr(r.c.date)+' · +'+esc(e2(r.c.montant))+' · '+esc(r.c.lib.slice(0,80)); }).join('<br>')+'</div><div style="font-size:12px;color:var(--muted,#667085);margin-top:6px">Paiement partiel ou plusieurs factures en un virement : marque-les à la main depuis chaque facture.</div></details>';
    if(A.solde){
      var T=A.treso;
      h+='<div style="border-top:1px solid var(--line,#e5e7eb);margin-top:12px;padding-top:10px">'
        +(T.plusRecente?'<div style="font-size:13px">Trésorerie : ta saisie du '+fr(T.date)+' ('+esc(e2(T.montant))+') est plus récente que ce relevé : pas de mise à jour.</div>'
        :'<label style="display:flex;gap:8px;align-items:center;font-weight:700;margin:0;text-transform:none;letter-spacing:0;font-size:14px;color:inherit"><input type="checkbox" id="nxbqTreso" '+(A.tresoCoche?'checked':'')+' onchange="nxbqTresoCoche(this.checked)" style="width:18px;height:18px">Mettre ma trésorerie à jour</label>'
          +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:13px"><input id="nxbqTresoM" type="number" inputmode="decimal" step="0.01" value="'+esc(A.tresoMontant)+'" onchange="nxbqTresoMontant(this.value)" style="max-width:160px"> € au '+fr(A.solde.date)+'</div>'
          +'<div style="font-size:12px;color:var(--muted,#667085);margin-top:4px">Solde lu dans le relevé.'+(T.montant!=null?' Actuellement : '+esc(e2(T.montant))+(T.date?' (saisie le '+fr(T.date)+')':'')+'.':'')+' Ajoute ta réserve si elle est sur un autre compte.</div>')
        +'</div>';
    }
    var n=nbCoches();
    h+='<div class="row-actions" style="margin-top:14px;justify-content:flex-end"><button class="btn-ghost btn-sm" onclick="nxbqFermer()">Annuler</button><button class="btn-pri btn-sm" id="nxbqOk" onclick="nxbqValider()"'+(n||(A.solde&&A.tresoCoche&&!A.treso.plusRecente)?'':' disabled')+'>'+(n?'Marquer '+n+' facture(s) payée(s)':'Enregistrer')+'</button></div>'
      +'<div style="font-size:11.5px;color:var(--muted,#667085);margin-top:8px;line-height:1.5">Chaque facture cochée est marquée payée à la date de la ligne (date du crédit, modifiable), avec le mode choisi : c’est cette date qui entre au livre des recettes. Seuls les crédits du même montant au centime sont proposés.</div>';
    m.querySelector('.nxbq-p').innerHTML=h;
  }
  function ouvrir(A){
    fermer(); ETAT=A; A.enc=encaissements(); A.aj=aJour();
    var o={}; try{ o=window.nxobjEtat?nxobjEtat():{}; }catch(e){ o={}; }
    var tm=o.tresoMontant!=null&&o.tresoMontant!==''?Number(o.tresoMontant):null, td=okDate(o.tresoDate)?o.tresoDate:'';
    A.treso={montant:tm,date:td,plusRecente:!!(A.solde&&td&&td>A.solde.date)};
    A.tresoCoche=!!(A.solde&&!A.treso.plusRecente&&tm==null); A.tresoMontant=A.solde?A.solde.montant:'';
    var m=document.createElement('div'); m.id='nxbqM';
    m.style.cssText='position:fixed;inset:0;z-index:99995;background:rgba(10,25,45,.45);display:flex;align-items:center;justify-content:center;padding:12px';
    m.innerHTML='<div class="nxbq-p" role="dialog" aria-label="Mon relevé bancaire" style="background:var(--panel,#fff);color:var(--ink,#1b2437);border-radius:14px;max-width:660px;width:100%;max-height:92vh;overflow:auto;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.3)"></div>';
    document.body.appendChild(m); rendre();
  }
  window.nxbqOuvrirTexte=function(txt){ var A=analyser(txt); if(A.erreur){ alert(A.erreur); return A; } ouvrir(A); return A; };
  window.nxbqCoche=function(i,on){ if(!ETAT||!ETAT.res[i]) return; var r=ETAT.res[i]; r.coche=!!on&&r.choix!=null&&!r.blocage; rendre(); };
  window.nxbqMode=function(i,v){ if(!ETAT||!ETAT.res[i]) return; var r=ETAT.res[i]; r.mode=MODES.indexOf(v)>=0?v:'Virement'; majAlertes(r); rendre(); };
  window.nxbqDateLigne=function(i,v){ if(!ETAT||!ETAT.res[i]) return; var r=ETAT.res[i];
    if(!okDate(v)||v>today()){ say('Date invalide (pas dans le futur)'); return rendre(); }
    r.date=v; majAlertes(r); rendre(); };
  window.nxbqFacture=function(i,v){ if(!ETAT||!ETAT.res[i]) return; var r=ETAT.res[i];
    if(v===''){ r.choix=null; r.coche=false; majAlertes(r); return rendre(); }
    var fi=+v; if(!r.cands.some(function(p){ return p.fi===fi; })) return;
    /* une facture ne peut aller qu'à un seul crédit : on la retire de l'autre */
    ETAT.res.forEach(function(o){ if(o!==r&&o.choix===fi){ o.choix=null; o.coche=false; majAlertes(o); } });
    r.choix=fi; if(r.conf==='sur') r.conf='choisir'; majAlertes(r); r.coche=!r.blocage; rendre(); };
  window.nxbqTresoCoche=function(on){ if(ETAT){ ETAT.tresoCoche=!!on&&!ETAT.treso.plusRecente; rendre(); } };
  window.nxbqTresoMontant=function(v){ if(ETAT){ var n=montant(v); if(n==null&&String(v).trim()!==''){ n=Number(String(v).replace(',','.')); if(!isFinite(n)) n=null; } ETAT.tresoMontant=n==null?'':n; } };
  window.nxbqValider=function(){
    if(!ETAT) return null; var A=ETAT, ok=[], ko=[], pris={}, empr=[];
    A.res.forEach(function(r){ if(!r.coche||r.choix==null||r.blocage) return; var f=A.factures[r.choix], k=f.kind+'|'+f.id+'|'+f.which;
      if(pris[k]){ ko.push(f.num+' : déjà rapprochée d’un autre crédit'); return; } pris[k]=1;
      var e=payer(f,r.date,r.mode); if(e) ko.push(f.num+' : '+e); else { ok.push(f.num); empr.push({id:r.c.emp,d:today(),num:f.num}); } });
    noterVus(empr);
    var treso=false;
    if(A.solde&&A.tresoCoche&&!A.treso.plusRecente&&A.tresoMontant!==''&&window.nxobjTreso) treso=!!nxobjTreso(A.tresoMontant,A.solde.date);
    fermer();
    try{ if(typeof updateBadges==='function') updateBadges(); }catch(e){}
    try{ if(window._curView==='nx_obj'&&window.nxobjRender) nxobjRender(); else if(window._curView==='dash'&&typeof renderDash==='function') renderDash(); }catch(e){}
    say((ok.length?ok.length+' paiement(s) enregistré(s) au livre des recettes':'Aucun paiement enregistré')+(treso?' · trésorerie mise à jour':''));
    if(ko.length) alert('Pas enregistré :\n'+ko.join('\n'));
    return {ok:ok,ko:ko,treso:treso};
  };
  window.nxbqChoisir=function(){
    var inp=document.createElement('input'); inp.type='file'; inp.accept='.csv,.txt,text/csv,text/plain'; inp.style.display='none';
    inp.onchange=function(){ var f=inp.files&&inp.files[0]; inp.remove(); if(!f) return;
      if(f.size>MAX_OCTETS){ alert('Fichier trop gros (plus de 5 Mo) : exporte une période plus courte.'); return; }
      var rd=new FileReader(); rd.onload=function(){ try{ window.nxbqOuvrirTexte(decoder(rd.result)); }catch(e){ alert('Lecture impossible : '+(e&&e.message||e)); } };
      rd.onerror=function(){ alert('Lecture du fichier impossible.'); }; rd.readAsArrayBuffer(f); };
    document.body.appendChild(inp); inp.click();
  };

  /* ---------- carte (dans « Pour la comptable ») ---------- */
  function carte(){
    return '<h3 id="nxbq" style="margin:14px 0 6px;font-size:14px">Mon relevé bancaire</h3>'
      +'<div class="nxo-note" style="margin-top:0">Exporte le relevé de ton compte pro en CSV depuis ta banque, puis choisis-le ici. ClimPilot retrouve les factures payées (même montant au centime) et te les fait vérifier une par une. Elles sont ensuite marquées payées à la date du virement, et ClimPilot propose de mettre ta trésorerie à jour. Le fichier est lu sur ton appareil : il n’est ni enregistré ni envoyé.</div>'
      +'<div class="row-actions" style="margin-top:8px"><button class="btn-pri btn-sm" onclick="nxbqChoisir()">Importer mon relevé (CSV)</button></div>';
  }
  window.nxobjAjouts=window.nxobjAjouts||[];
  if(!window.nxobjAjouts.some(function(a){ return a&&a.id==='banque'; })) window.nxobjAjouts.push({id:'banque',pos:'comptable',carte:carte});
})();
