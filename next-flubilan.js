/* ============================================================
   ClimPilot Next — next-flubilan.js  (couche additive, 1.12 — 12/10/2026)
   « Déclaration annuelle des fluides » (écran Fluides & Cerfa + rappel dans Objectifs & feux).

   Règle (vérifiée le 12/10/2026) :
   - Code de l'environnement, art. R543-100 : chaque année, à l'organisme qui a délivré l'attestation de capacité,
     déclaration de l'année civile précédente, par fluide : quantités acquises, chargées, récupérées, cédées ; stocks au
     1er janvier et au 31 décembre ;
   - arrêté du 21/11/2025 relatif aux attestations de capacité (art. 1er, 5°, applicable au 01/01/2027) : au plus tard le
     31 janvier, pour chaque type de fluide : 1° acquises ; 2° chargées (a équipements neufs, b maintenance) ;
     3° récupérées (a équipements hors d'usage, b maintenance) ; 4° remises à un distributeur ; 5° traitées sous ta
     responsabilité (a recyclées, b régénérées, c détruites) ; 6° cédées à un autre opérateur, distributeur ou producteur ;
     7° stockées au 1er janvier et au 31 décembre, fluides neufs et déchets séparés
     (https://aida.ineris.fr/reglementation/arrete-211125-relatif-a-delivrance-attestations-capacite-operateurs-prevues-a) ;
   - un organisme agréé (Socotec, page « Déclaration annuelle des fluides frigorigènes ») demande une déclaration même si
     aucun fluide n'a été manipulé (« déclaration à zéro ») : pratique d'organisme, affichée comme telle, pas comme un texte ;
   - FAQ de l'AFCE : la charge d'usine d'un équipement pré-chargé n'entre pas dans la déclaration.
   Avant 2027, les rubriques sont celles de l'arrêté du 30/06/2008 (abrogé au 31/12/2026) : signalé à l'écran.

   Ce que ClimPilot calcule depuis tes fiches d'intervention (registre cp2_fluides) :
   - chargées = vierge + recyclé + régénéré ; « équipements neufs » = fiches « mise en service » et « assemblage »,
     le reste = maintenance (HYPOTHÈSE de classement, à confirmer avec ton organisme pour un cas douteux) ;
   - récupérées = destinées au traitement + à la réutilisation ; « hors d'usage » = fiches « démantèlement ».
   Ce que tu saisis (tes factures d'achat et bordereaux) : acquises, remises au distributeur, traitées, cédées, stocks.
   Contrôle indicatif : stock au 31/12 attendu = stock au 1er janvier + acquises + récupérées − chargées − remises
   − régénérées − détruites − cédées (le fluide recyclé par toi reste chez toi).
   Stockage : cpnext_flubilan (synchronisé, un élément par case « AAAA:FLUIDE:case »).
   Rappel dans « À faire » seulement si tu es opérateur (attestation de capacité renseignée, ou fiches / saisies de l'année).
   ============================================================ */
(function(){
  'use strict';
  var KEY='cpnext_flubilan';
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}
  var NEUF=['mes','assemblage'], HU=['demantelement'];
  var CHAMPS=['acq','remis','recy','regen','detr','cede','sN0','sD0','sN1','sD1'];

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isFinite(n)?n:0; }
  function r3(n){ return Math.round((Number(n)||0)*1000)/1000; }
  function kg(n){ return n==null?'—':r3(n).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:3})+' kg'; }
  function iso(y,m,d){ var x=new Date(y,m,d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return iso(d.getFullYear(),d.getMonth(),d.getDate()); } }
  function okDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')); }
  function fr(s){ return okDate(s)?new Date(s+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function joursEntre(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
  function say(m){ try{ toast(m); }catch(e){} }
  function cle(f){ return String(f||'').toUpperCase().replace(/\s+/g,'').replace(/[^A-Z0-9.\-]/g,'').slice(0,20)||'AUTRE'; }
  function fiches(){ try{ return typeof FLU!=='undefined'&&Array.isArray(FLU)?FLU:[]; }catch(e){ return []; } }
  function ent(){ try{ return (P&&P.entreprise)||{}; }catch(e){ return {}; } }
  function okAn(Y){ Y=String(Y); return /^\d{4}$/.test(Y)?Y:''; }

  /* ---------- saisies ---------- */
  /* UNE case = UN élément « AAAA:FLUIDE:case » {v} : deux appareils qui remplissent des cases différentes du même fluide
     ne s'écrasent pas à la synchronisation (fusion élément par élément). « AAAA:FLUIDE:_ » = fluide ajouté à la main,
     « AAAA:_decl » {d} = déclaration faite. Les identifiants sont filtrés à la lecture (nom de fluide sûr). */
  var RX=/^(\d{4}):(_decl|[A-Z0-9.\-]{1,20})(?::(_|acq|remis|recy|regen|detr|cede|sN0|sD0|sN1|sD1))?$/;
  function lire(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ a=[]; } return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.id==='string'&&RX.test(x.id); }):[]; }
  function ecrire(a){ try{ save(KEY,a); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(_){} } }
  function poser(id,val){ var a=lire().filter(function(x){ return x.id!==id; }); if(val) a.push(Object.assign({id:id},val)); ecrire(a); }
  function index(){ var m={}; lire().forEach(function(x){ m[x.id]=x; }); return m; }
  function entree(Y,fl,M){ M=M||index(); var e=null;
    CHAMPS.forEach(function(c){ var x=M[Y+':'+fl+':'+c]; if(x&&x.v!=null&&x.v!==''&&isFinite(Number(x.v))){ e=e||{}; e[c]=Number(x.v); } });
    if(M[Y+':'+fl+':_']) e=e||{}; return e; }
  function declaree(Y){ var x=index()[Y+':_decl']; return x&&okDate(x.d)?x.d:''; }

  /* ---------- calcul ---------- */
  function auto(Y){
    var r={};
    fiches().forEach(function(f){ if(!f||String(f.date||'').slice(0,4)!==String(Y)) return;
      var k=cle(f.fluide), x=r[k]=r[k]||{chN:0,chM:0,recHU:0,recM:0,n:0}, ch=num(f.qv)+num(f.qrec)+num(f.qreg), rc=num(f.qrt)+num(f.qru);
      x.n++; if(NEUF.indexOf(f.nature)>=0) x.chN+=ch; else x.chM+=ch; if(HU.indexOf(f.nature)>=0) x.recHU+=rc; else x.recM+=rc; });
    Object.keys(r).forEach(function(k){ ['chN','chM','recHU','recM'].forEach(function(c){ r[k][c]=r3(r[k][c]); }); });
    return r;
  }
  function valeur(e,c){ return e&&e[c]!=null&&e[c]!==''&&isFinite(Number(e[c]))?r3(Number(e[c])):null; }
  function bilan(Y){
    Y=okAn(Y); if(!Y) return [];
    var A=auto(Y), noms={}, prev=String(+Y-1), M=index();
    Object.keys(A).forEach(function(k){ noms[k]=1; });
    lire().forEach(function(x){ var p=RX.exec(x.id); if(!p||p[2]==='_decl') return;
      if(p[1]===Y) noms[p[2]]=1;
      if(p[1]===prev&&(p[3]==='sN1'||p[3]==='sD1')&&Number(x.v)>0) noms[p[2]]=1; });
    return Object.keys(noms).sort().map(function(fl){
      var e=entree(Y,fl,M)||{}, ep=entree(prev,fl,M), a=A[fl]||{chN:0,chM:0,recHU:0,recM:0,n:0}, b={fluide:fl,fiches:a.n,chN:a.chN,chM:a.chM,recHU:a.recHU,recM:a.recM};
      CHAMPS.forEach(function(c){ b[c]=valeur(e,c); });
      /* stock au 1er janvier : repris du 31 décembre de l'année d'avant s'il n'est pas saisi */
      if(b.sN0==null&&valeur(ep,'sN1')!=null){ b.sN0=valeur(ep,'sN1'); b.reprisN0=true; }
      if(b.sD0==null&&valeur(ep,'sD1')!=null){ b.sD0=valeur(ep,'sD1'); b.reprisD0=true; }
      var z=function(v){ return v==null?0:v; };
      b.charge=r3(b.chN+b.chM); b.recup=r3(b.recHU+b.recM);
      b.theo=r3(z(b.sN0)+z(b.sD0)+z(b.acq)+b.recup-b.charge-z(b.remis)-z(b.regen)-z(b.detr)-z(b.cede));
      b.fin=(b.sN1==null&&b.sD1==null)?null:r3(z(b.sN1)+z(b.sD1));
      b.ecart=b.fin==null?null:r3(b.fin-b.theo);
      b.manque=['acq','remis','cede','sN1','sD1'].filter(function(c){ return b[c]==null; });
      return b;
    });
  }
  window.nxfbBilan=bilan;
  window.nxfbDeclaree=declaree;

  /* ---------- actions ---------- */
  var AN=null;
  function anDefaut(){ var t=today(), y=+t.slice(0,4); return String(+t.slice(5,7)<=2?y-1:y); }
  window.nxfbSet=function(Y,fl,c,v){ Y=okAn(Y); fl=cle(fl); if(!Y||CHAMPS.indexOf(c)<0) return false;
    var s=String(v==null?'':v).trim(), n=s===''?null:num(s);
    if(n!=null&&(n<0||n>100000)){ say('Quantité invalide (kg, positive)'); plus_tard(); return false; }
    poser(Y+':'+fl+':'+c,n==null?null:{v:r3(n)}); plus_tard(); return true; };
  window.nxfbAjouterFluide=function(Y,fl){ Y=okAn(Y); fl=cle(fl); if(!Y||!fl) return false; poser(Y+':'+fl+':_',{}); plus_tard(); return true; };
  window.nxfbDeclarer=function(Y,on){ Y=okAn(Y); if(!Y) return false; poser(Y+':_decl',on?{d:today()}:null); plus_tard();
    say(on?'Déclaration '+Y+' notée le '+fr(today()):'Déclaration '+Y+' décochée'); try{ if(typeof updateBadges==='function') updateBadges(); }catch(e){} return true; };
  window.nxfbAnnee=function(Y){ AN=okAn(Y)||anDefaut(); plus_tard(); };

  var LIB=[['acq','1. Acquises'],['chN','2a. Chargées — équipements neufs'],['chM','2b. Chargées — maintenance'],['recHU','3a. Récupérées — équipements hors d’usage'],['recM','3b. Récupérées — maintenance'],
    ['remis','4. Remises à un distributeur'],['recy','5a. Traitées par toi — recyclées'],['regen','5b. Traitées par toi — régénérées'],['detr','5c. Traitées par toi — détruites'],['cede','6. Cédées (opérateur, distributeur, producteur)'],
    ['sN0','7. Stock au 1er janvier — fluide neuf'],['sD0','7. Stock au 1er janvier — déchets'],['sN1','7. Stock au 31 décembre — fluide neuf'],['sD1','7. Stock au 31 décembre — déchets']];
  function csv(Y){
    var B=bilan(Y), q=function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }, n3=function(v){ return q(v==null?'':r3(v).toFixed(3).replace('.',',')); };
    var L=[['Année','Fluide'].concat(LIB.map(function(x){ return x[1]; })).map(q).join(';')];
    B.forEach(function(b){ L.push([q(Y),q(b.fluide)].concat(LIB.map(function(x){ return n3(b[x[0]]); })).join(';')); });
    if(!B.length) L.push([q(Y),q('Aucun fluide')].concat(LIB.map(function(){ return n3(0); })).join(';'));
    return '\ufeff'+L.join('\r\n');
  }
  window.nxfbCSV=function(Y){ Y=okAn(Y)||AN||anDefaut(); var s=csv(Y);
    try{ var bl=new Blob([s],{type:'text/csv;charset=utf-8'}), a=document.createElement('a'); a.href=URL.createObjectURL(bl); a.download='ClimPilot_declaration_fluides_'+Y+'.csv'; document.body.appendChild(a); a.click(); a.remove(); }catch(e){ say('Export impossible'); }
    return s; };
  /* texte à coller sur le site de l'organisme : une case vide reste « NON RENSEIGNÉ » (jamais 0 par défaut) */
  function texte(Y){ var B=bilan(Y), E=ent(), vides=B.filter(function(b){ return b.manque.length; }).length;
    return 'Déclaration annuelle des fluides frigorigènes — année '+Y+(E.nom?' — '+E.nom:'')+(E.attFluides?' — attestation de capacité n° '+E.attFluides:'')+'\n'
      +(vides?'\nATTENTION : '+vides+' fluide(s) avec des cases NON RENSEIGNÉES — mets 0 dans ClimPilot si c’est zéro, avant d’envoyer.\n':'')
      +(B.length?B.map(function(b){ return '\n'+b.fluide+'\n'+LIB.map(function(x){ return '  '+x[1]+' : '+(b[x[0]]==null?'NON RENSEIGNÉ':kg(b[x[0]])); }).join('\n'); }).join('\n'):'\nAucun fluide acquis, chargé, récupéré, cédé ni stocké (déclaration à zéro).')+'\n';
  }
  window.nxfbTexte=function(Y){ return texte(okAn(Y)||AN||anDefaut()); };
  window.nxfbCopier=function(Y){ var t=texte(okAn(Y)||AN||anDefaut()); var p=(typeof window.cpCopier==='function')?window.cpCopier(t):Promise.resolve(false);
    return p.then(function(ok){ say(ok?'Récapitulatif copié : colle-le sur le site de ton organisme':'Copie impossible sur cet appareil'); return ok; }); };
  window.nxfbImprimer=function(Y){ Y=okAn(Y)||AN||anDefaut(); var B=bilan(Y), E=ent(), doc=document.getElementById('devisDoc'); if(!doc){ say('Aperçu indisponible'); return; }
    var td='padding:5px 8px;border:1px solid #ddd;font-size:11px', th=td+';background:#f3f5f8;text-align:left';
    doc.innerHTML='<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:900px"><div style="font-size:17px;font-weight:800">Déclaration annuelle des fluides frigorigènes — '+esc(Y)+'</div>'
      +'<div style="font-size:11.5px;color:#555;margin:4px 0 12px">'+esc(E.nom||'')+(E.attFluides?' · attestation de capacité n° '+esc(E.attFluides):'')+(E.attOrganisme?' · organisme : '+esc(E.attOrganisme):'')+' · à transmettre au plus tard le 31/01/'+(+Y+1)+' · préparé le '+new Date().toLocaleDateString('fr-FR')+'</div>'
      +'<table style="border-collapse:collapse;width:100%"><thead><tr><th style="'+th+'">Rubrique (kg)</th>'+B.map(function(b){ return '<th style="'+th+'">'+esc(b.fluide)+'</th>'; }).join('')+'</tr></thead><tbody>'
      +LIB.map(function(x){ return '<tr><td style="'+td+'">'+esc(x[1])+'</td>'+B.map(function(b){ return '<td style="'+td+';text-align:right">'+(b[x[0]]==null?'—':esc(r3(b[x[0]]).toLocaleString('fr-FR',{maximumFractionDigits:3})))+'</td>'; }).join('')+'</tr>'; }).join('')
      +'</tbody></table>'+(B.length?'':'<div style="margin-top:10px;font-size:12px">Aucun fluide acquis, chargé, récupéré, cédé ni stocké : déclaration à zéro.</div>')
      +'<div style="margin-top:12px;font-size:9.5px;color:#777">Chargées et récupérées : calculées par ClimPilot depuis les fiches d’intervention (Cerfa 15497) de l’année. Autres rubriques : saisies. Rubriques : arrêté du 21/11/2025, art. 1er, 5° ; Code de l’environnement, art. R543-100.</div></div>';
    window.print(); };

  /* ---------- carte de l'écran Fluides ---------- */
  function champ(Y,b,c){ var v=b[c], repris=(c==='sN0'&&b.reprisN0)||(c==='sD0'&&b.reprisD0);
    return '<input type="number" inputmode="decimal" step="any" min="0" value="'+(v==null||repris?'':esc(v))+'"'+(repris?' placeholder="'+esc(String(v).replace('.',','))+' (repris)"':' placeholder="kg"')+' onchange="nxfbSet(\''+esc(Y)+'\',\''+esc(b.fluide)+'\',\''+c+'\',this.value)" aria-label="'+esc(b.fluide+' '+c)+'" style="width:100%;max-width:130px">'; }
  function ligne(lab,droite){ return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:5px 0;border-top:1px solid var(--line,#e5e7eb);font-size:13px"><span>'+lab+'</span><span style="text-align:right">'+droite+'</span></div>'; }
  function carteFluide(Y,b){
    var auto=function(v){ return '<b>'+kg(v)+'</b> <span style="font-size:11px;color:var(--muted,#667085)">fiches</span>'; };
    var ok=b.ecart!=null&&Math.abs(b.ecart)<=0.05;
    return '<div class="card nxfb-f" data-fluide="'+esc(b.fluide)+'" style="margin:0"><h3 style="margin:0 0 4px;font-size:15px;display:flex;justify-content:space-between"><span>'+esc(b.fluide)+'</span><span style="font-size:12px;font-weight:600;color:var(--muted,#667085)">'+b.fiches+' fiche(s)</span></h3>'
      +ligne('1. Acquises (achats, nets de la tare)',champ(Y,b,'acq'))
      +ligne('2a. Chargées — équipements neufs',auto(b.chN))+ligne('2b. Chargées — maintenance',auto(b.chM))
      +ligne('3a. Récupérées — hors d’usage',auto(b.recHU))+ligne('3b. Récupérées — maintenance',auto(b.recM))
      +ligne('4. Remises à un distributeur',champ(Y,b,'remis'))
      +ligne('5a. Recyclées par toi',champ(Y,b,'recy'))+ligne('5b. Régénérées (sous ta responsabilité)',champ(Y,b,'regen'))+ligne('5c. Détruites (sous ta responsabilité)',champ(Y,b,'detr'))
      +ligne('6. Cédées (opérateur, distributeur…)',champ(Y,b,'cede'))
      +ligne('7. Stock au 1er janvier — neuf',champ(Y,b,'sN0'))+ligne('7. Stock au 1er janvier — déchets',champ(Y,b,'sD0'))
      +ligne('7. Stock au 31 décembre — neuf',champ(Y,b,'sN1'))+ligne('7. Stock au 31 décembre — déchets',champ(Y,b,'sD1'))
      +'<div class="nxfb-ctl" style="margin-top:8px;font-size:12.5px;line-height:1.5;color:'+(b.ecart==null?'var(--muted,#667085)':ok?'var(--green,#16794a)':'var(--orange,#b45309)')+'">'
      +(b.ecart==null?'Contrôle : stock attendu au 31/12 = '+kg(b.theo)+' (saisis ton stock du 31 décembre pour comparer).'
        :ok?'✓ Contrôle : stock au 31/12 cohérent ('+kg(b.fin)+', attendu '+kg(b.theo)+').'
        :'⚠ Écart de '+kg(b.ecart)+' : stock déclaré '+kg(b.fin)+', attendu '+kg(b.theo)+'. À expliquer avant d’envoyer : fiche oubliée, pesée, achat non saisi, fuite d’une bouteille ?')+'</div></div>';
  }
  function carte(){
    var Y=AN||anDefaut(), B=bilan(Y), E=ent(), d=declaree(Y), y0=+today().slice(0,4), ans={};
    /* années proposées : depuis 2027 (début de l'activité et des règles de l'arrêté du 21/11/2025), + celles des fiches */
    for(var y=y0;y>=Math.min(2027,y0);y--) ans[y]=1; ans[Y]=1; fiches().forEach(function(f){ var a=String(f&&f.date||'').slice(0,4); if(/^\d{4}$/.test(a)) ans[a]=1; });
    var manque=B.filter(function(b){ return b.manque.length; }).length;
    var FL=['R32','R410A','R134a','R290','R404A','R448A','R449A','R452A','R454B','R407C','R513A','R744','R1234yf','R600a','R22'];
    return '<div class="card" id="nxfb"><h2>Déclaration annuelle à l’organisme agréé</h2>'
      +'<div class="sub" style="line-height:1.5">Année <b>'+esc(Y)+'</b> → à transmettre <b>au plus tard le 31/01/'+(+Y+1)+'</b> à '+(E.attOrganisme?'<b>'+esc(E.attOrganisme)+'</b>':'l’organisme qui a délivré ton attestation de capacité (renseigne-le dans Paramètres)')+'. Les organismes agréés la demandent même si tu n’as manipulé aucun fluide (« déclaration à zéro ») : confirme avec le tien.'
      +(+Y<2027?' <b>Année avant 2027 : les rubriques exactes sont celles de l’arrêté du 30/06/2008, vérifie avec ton organisme.</b>':'')+'</div>'
      +'<div class="row-actions" style="margin:10px 0;flex-wrap:wrap;align-items:center"><select onchange="nxfbAnnee(this.value)" style="max-width:110px" aria-label="Année">'+Object.keys(ans).sort().reverse().map(function(a){ return '<option'+(String(a)===String(Y)?' selected':'')+'>'+a+'</option>'; }).join('')+'</select>'
      +'<button class="btn-ghost btn-sm" onclick="nxfbCopier()">Copier</button><button class="btn-ghost btn-sm" onclick="nxfbCSV()">Export CSV</button><button class="btn-ghost btn-sm" onclick="nxfbImprimer()">Imprimer / PDF</button>'
      +'<label style="flex-direction:row;display:inline-flex;gap:6px;align-items:center;font-weight:700;margin:0 0 0 auto;text-transform:none;letter-spacing:0;font-size:13px;color:inherit"><input type="checkbox" id="nxfbDecl" '+(d?'checked':'')+' onchange="nxfbDeclarer(\''+esc(Y)+'\',this.checked)" style="width:18px;height:18px">'+(d?'Déclarée le '+fr(d):'Déclarée ?')+'</label></div>'
      +(B.length?'<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">'+B.map(function(b){ return carteFluide(Y,b); }).join('')+'</div>'
        :'<div style="font-size:14px;margin:6px 0">Aucune fiche ni saisie pour '+esc(Y)+' : si tu n’as rien acheté, chargé, récupéré ni stocké, c’est une <b>déclaration à zéro</b>.</div>')
      +(manque?'<div class="sub" style="margin-top:8px;color:var(--orange,#b45309)">'+manque+' fluide(s) avec des cases vides (acquises, remises, cédées ou stock au 31/12) : mets 0 si c’est zéro.</div>':'')
      +'<div class="row-actions" style="margin-top:10px"><select id="nxfbNouv" style="max-width:150px" aria-label="Fluide à ajouter">'+FL.map(function(f){ return '<option>'+f+'</option>'; }).join('')+'</select><button class="btn-ghost btn-sm" onclick="nxfbAjouterFluide(\''+esc(Y)+'\',document.getElementById(\'nxfbNouv\').value)">+ Fluide en stock sans fiche</button></div>'
      +'<div class="sub" style="margin-top:10px;line-height:1.5">Chargées et récupérées : calculées depuis tes fiches de l’année. « Équipements neufs » = fiches « mise en service » et « assemblage » ; « hors d’usage » = fiches « démantèlement » ; le reste = maintenance (classement à confirmer avec ton organisme pour un cas douteux). La charge d’usine d’un équipement pré-chargé n’entre pas dans la déclaration (FAQ de l’AFCE) : sur la fiche, note seulement le complément. Acquises : poids net de fluide (sans la tare des bouteilles), d’après tes factures. Règle : arrêté du 21/11/2025, art. 1er (5°) ; Code de l’environnement, art. R543-100.</div></div>';
  }
  /* réaffichage APRÈS l'événement (change d'un champ) et jamais deux à la fois : remplacer un champ pendant qu'il perd
     le focus déclenchait un 2e affichage imbriqué (erreur vue au parcours de la copie d'essai du 12/10) */
  var EN_COURS=false, PREVU=0;
  function plus_tard(){ clearTimeout(PREVU); PREVU=setTimeout(render,0); }
  /* ---------- bouteilles dans le camion : seuil ADR (vérifié le 12/10/2026) ----------
     ADR 1.1.3.6 (quantités limitées par unité de transport) : produit de catégorie de transport 2 → quantité × 3,
     catégorie 3 → quantité × 1 ; total ≤ 1 000 « points ». Sources : OPPBTP, focus « Transport des marchandises
     dangereuses par route en quantités limitées » (màj 10/06/2020 : 20 bouteilles B50 d'azote ou d'oxygène, ou 9 bouteilles
     de propane de 35 kg) ; canton de Genève, SERMA, oct. 2018 (gaz inflammables « F » en catégorie 2, gaz « A » et « O » en
     catégorie 3). Quantité : gaz liquéfié = kg net de fluide dans la bouteille ; gaz comprimé = capacité en litres.
     FDS des fournisseurs (rubrique 14) : R32 UN 3252, code 2F, catégorie 2 ; R134a UN 3159, code 2A, catégorie 3 ;
     R290 = propane UN 1978, code 2F ; R410A UN 3163, code 2A. Autres fluides classés par inflammabilité (A2L / A3 → 2F,
     A1 → 2A) : à vérifier sur la FDS de la bouteille. Sous le seuil restent obligatoires (OPPBTP) : extincteur 2 kg à
     poudre, formation du conducteur (ADR chapitre 1.3), colis fermés et arrimés, moteur arrêté au chargement, interdiction
     de fumer. Recommandé (FFB) : véhicule aéré, bouteilles debout, pas de bouteille à demeure dans le camion. */
  var KADR='cpnext_adr', SEUIL=1000;
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KADR)<0) SYNC_KEYS.push(KADR); }catch(e){}
  var ADR={ /* clé : [catégorie de transport, unité, libellé] */
    R32:[2,'kg','R32'],R290:[2,'kg','R290 (propane)'],R600A:[2,'kg','R600a (isobutane)'],R454B:[2,'kg','R454B'],R1234YF:[2,'kg','R1234yf'],ACETYLENE:[2,'kg','Acétylène (brasure)'],
    R410A:[3,'kg','R410A'],R134A:[3,'kg','R134a'],R404A:[3,'kg','R404A'],R407C:[3,'kg','R407C'],R448A:[3,'kg','R448A'],R449A:[3,'kg','R449A'],R452A:[3,'kg','R452A'],R513A:[3,'kg','R513A'],R22:[3,'kg','R22'],R744:[3,'kg','R744 (CO₂)'],
    AZOTE:[3,'L','Azote (capacité de la bouteille)'],OXYGENE:[3,'L','Oxygène (capacité de la bouteille)']
  };
  function adrListe(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KADR)||'[]'); }catch(e){ a=[]; }
    return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.id==='string'&&/^adr_[a-z0-9_]{1,40}$/.test(x.id)&&ADR[x.fluide]&&num(x.qte)>0&&num(x.nb)>=1; }):[]; }
  function adrPoints(L){ var t=0; (L||adrListe()).forEach(function(x){ var d=ADR[x.fluide]; if(d) t+=num(x.qte)*Math.round(num(x.nb))*(d[0]===2?3:1); }); return Math.round(t*10)/10; }
  window.nxadrListe=adrListe; window.nxadrPoints=adrPoints;
  window.nxadrAjouter=function(x){
    var depuisForm=!x; if(depuisForm){ var g=function(id){ var e=document.getElementById(id); return e?e.value:''; }; x={fluide:g('nxadrF'),qte:g('nxadrQ'),nb:g('nxadrN'),recup:!!(document.getElementById('nxadrR')||{}).checked}; }
    var f=String(x.fluide||''), q=num(x.qte), n=Math.round(num(x.nb||1));
    if(!ADR[f]){ say('Choisis un fluide ou un gaz'); return false; }
    if(!(q>0)||q>1000){ say('Quantité par bouteille invalide ('+ADR[f][1]+')'); return false; }
    if(!(n>=1)||n>50){ say('Nombre de bouteilles invalide (1 à 50)'); return false; }
    var a=adrListe(); a.push({id:'adr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),fluide:f,qte:Math.round(q*1000)/1000,nb:n,recup:!!x.recup});
    try{ save(KADR,a); }catch(e){ try{ localStorage.setItem(KADR,JSON.stringify(a)); }catch(_){} }
    plus_tard(); return true; };
  window.nxadrSuppr=function(id){ var a=adrListe().filter(function(x){ return x.id!==id; }); try{ save(KADR,a); }catch(e){ try{ localStorage.setItem(KADR,JSON.stringify(a)); }catch(_){} } plus_tard(); return true; };
  function carteADR(){
    var L=adrListe(), P=adrPoints(L), ok=P<=SEUIL;
    return '<div class="card" id="nxadr"><h2>Bouteilles dans le camion (ADR)</h2>'
      +'<div class="sub" style="line-height:1.5">Fluides inflammables (R32, R290, R454B, R1234yf, R600a, acétylène) : kg de fluide × 3. Non inflammables (R410A, R134a, R404A, R407C, R448A, R449A, R452A, R513A, R22, CO₂) : kg × 1. Azote, oxygène : litres de la bouteille × 1. <b>Total ≤ 1 000 points</b> : régime allégé, seules les règles ci-dessous restent obligatoires.</div>'
      +(L.length?'<div style="margin-top:8px">'+L.map(function(x){ var d=ADR[x.fluide];
          return '<div class="nxfb-adr" data-adr="'+esc(x.id)+'" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line,#e5e7eb);font-size:13px"><span>'+esc(x.nb+' × '+d[2]+' — '+String(x.qte).replace('.',',')+' '+d[1]+(x.recup?' (récupération)':''))+'</span><span style="display:flex;gap:8px;align-items:center"><b>'+String(Math.round(num(x.qte)*x.nb*(d[0]===2?3:1)*10)/10).replace('.',',')+' pts</b><button class="btn-ghost btn-sm" onclick="nxadrSuppr(\''+esc(x.id)+'\')" aria-label="Retirer">✕</button></span></div>'; }).join('')+'</div>':'')
      +'<div class="nxadr-v" style="margin:8px 0;font-size:14px;font-weight:700;color:'+(ok?'var(--green,#16794a)':'var(--red,#b42318)')+'">'+(L.length?(ok?'✓ ':'✕ ')+String(P).replace('.',',')+' / 1 000 points'+(ok?' : sous le seuil ADR.':' : AU-DESSUS du seuil — toutes les règles ADR s’appliquent (signalisation orange, document de transport…). Réduis le chargement.'):'Ajoute tes bouteilles habituelles pour vérifier ton chargement.')+'</div>'
      +'<div class="nxo-form" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));align-items:end">'
      +'<label style="display:flex;flex-direction:column;gap:4px;font-size:12px">Fluide / gaz<select id="nxadrF">'+Object.keys(ADR).map(function(k){ return '<option value="'+k+'">'+esc(ADR[k][2])+'</option>'; }).join('')+'</select></label>'
      +'<label style="display:flex;flex-direction:column;gap:4px;font-size:12px">Par bouteille (kg ou L)<input id="nxadrQ" type="number" inputmode="decimal" step="any" min="0" placeholder="ex. 10"></label>'
      +'<label style="display:flex;flex-direction:column;gap:4px;font-size:12px">Nombre<input id="nxadrN" type="number" inputmode="numeric" step="1" min="1" value="1"></label>'
      +'<label style="flex-direction:row;display:flex;gap:6px;align-items:center;font-size:12px"><input id="nxadrR" type="checkbox" style="width:18px;height:18px">Récupération</label>'
      +'<button class="btn-ghost btn-sm" onclick="nxadrAjouter()">+ Ajouter</button></div>'
      +'<div class="sub" style="margin-top:10px;line-height:1.5"><b>Même sous le seuil, obligatoires :</b> extincteur 2 kg à poudre dans le camion ; formation du conducteur au transport de marchandises dangereuses (ADR chapitre 1.3, garde l’attestation) ; bouteilles fermées, chapeau en place, arrimées ; moteur arrêté au chargement ; ne pas fumer. <b>Conseillé :</b> camion aéré (surtout avec du R290 : c’est du propane), bouteilles debout, pas de bouteille laissée à demeure. Quantité : kg de fluide DANS la bouteille (bouteille de récupération comprise), pas son poids total. Vérifie la catégorie sur la fiche de données de sécurité de ta bouteille (rubrique 14, « catégorie de transport » : 2 = × 3, 3 = × 1). Sources : OPPBTP (quantités limitées), fiches de sécurité des fournisseurs.</div></div>';
  }

  function render(){
    if(EN_COURS) return plus_tard();
    var v=document.getElementById('v-fluides'); if(!v) return;
    var w=document.getElementById('nxfbWrap');
    if(!w){ w=document.createElement('div'); w.id='nxfbWrap'; var t=document.getElementById('fluTable'), c=t&&t.closest('.card'); if(c&&c.parentNode===v) c.parentNode.insertBefore(w,c.nextSibling); else v.appendChild(w); }
    EN_COURS=true; try{ w.innerHTML=carte()+carteADR(); }catch(e){ try{ console.error('ClimPilot next-flubilan',e); }catch(_){} } finally { EN_COURS=false; }
  }
  window.nxfbRender=render;

  /* ---------- rappel dans Objectifs & feux ---------- */
  function afaire(ctx){
    var t=(ctx&&ctx.t)||today(), y=+t.slice(0,4), Y=String(y-1), deb=''; try{ deb=window.nxobjDebut?nxobjDebut():''; }catch(e){}
    if(!okDate(deb)) return []; var out=[];
    /* seulement si tu es « opérateur » : attestation de capacité renseignée, ou fiches / saisies pour cette année
       (en sous-traitance sous l'attestation d'un donneur d'ordre, pas de rappel) */
    var concerne=function(an){ if(String(ent().attFluides||'').trim()) return true; if(Object.keys(auto(an)).length) return true;
      return lire().some(function(x){ return x.id.slice(0,5)===an+':'&&x.id!==an+':_decl'; }); };
    if(deb<=Y+'-12-31'&&!declaree(Y)&&concerne(Y)){ var j=joursEntre(t,y+'-01-31');
      out.push({urg:j<0?2:1,txt:'Déclaration annuelle des fluides '+Y+' à ton organisme agréé'+(j<0?' : échéance du 31/01/'+y+' dépassée, fais-la tout de suite.':' : avant le 31/01/'+y+'.'),act:'go',vue:'fluides',btn:'Préparer'}); }
    if(+t.slice(5,7)===12&&deb<=y+'-12-31'&&!declaree(String(y))&&concerne(String(y)))
      out.push({urg:0,txt:'En janvier : déclaration annuelle des fluides '+y+' (avant le 31/01/'+(y+1)+'). Note dès maintenant tes achats de fluide et ton stock au 31/12.',act:'go',vue:'fluides',btn:'Voir'});
    return out;
  }
  window.nxobjAjouts=window.nxobjAjouts||[];
  if(!window.nxobjAjouts.some(function(a){ return a&&a.id==='flubilan'; })) window.nxobjAjouts.push({id:'flubilan',afaire:afaire});

  /* ---------- branchement : la carte suit l'écran Fluides ---------- */
  function boot(){
    try{
      if(typeof window.renderFluides==='function'&&!window.renderFluides._nxfb){
        var orf=window.renderFluides; window.renderFluides=function(){ var r=orf.apply(this,arguments); render(); return r; }; window.renderFluides._nxfb=true;
      }
      if(window._curView==='fluides') render();
    }catch(e){ try{ console.error('ClimPilot next-flubilan init',e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
