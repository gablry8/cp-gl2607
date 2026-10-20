/* ============================================================
   ClimPilot Next — next-rentab.js  (couche additive, 1.12 — 12/10/2026)
   « Ma rentabilité réelle », carte de l'écran Objectifs & feux :

   1. Ce que t'a VRAIMENT rapporté une heure de travail, sur tes chantiers sur devis des 12 derniers mois :
      - indicateur principal : main-d'œuvre facturée HT ÷ (heures réellement passées + heures de SAV notées sur ce
        chantier), comparé à ton taux horaire du plan (même nature : le plan compte heures × taux, sans marge matériel) ;
      - pour information : (prix HT − achats) ÷ ces mêmes heures, matériel et déplacements compris.
      Heures et achats réels = bloc « Réalité terrain » du devis (champs hReel / achatReel, déjà dans l'appli).
      Sans achats réels saisis, ClimPilot prend les achats estimés du devis (et le dit).
      Achats : TTC en franchise de TVA (la TVA payée est un coût), ramenés HT si tu factures la TVA (régime du jour).
      Pas comptés (et signalés) : devis avec avoir ou facture annulée, devis contenant un contrat d'entretien.
      Différent du « Gain réel » du devis (index.html, realStats), qui retire en plus le coût interne. Indicateur de
      gestion, pas une règle.

   2. Les retours SAV / garantie NON facturés (clé cpnext_sav, synchronisée, liste à identifiants) :
      heures, km, pièces, motif. Coût estimé = heures × ton taux du plan + pièces (+ km × ton coût du km s'il est
      renseigné), comparé à la provision SAV facturée dans tes devis (lignes « Provision SAV / garantie »).

   Rien n'est envoyé ailleurs que ta synchronisation habituelle.
   ============================================================ */
(function(){
  'use strict';
  var KEY='cpnext_sav';
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}

  /* ---------- outils ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isFinite(n)?n:0; }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function e0(n){ try{ return eur0(n); }catch(e){ return Math.round(Number(n)||0).toLocaleString('fr-FR')+' €'; } }
  function e2(n){ try{ return eur(n); }catch(e){ return r2(n).toFixed(2).replace('.',',')+' €'; } }
  function h1(n){ return (Math.round((Number(n)||0)*10)/10).toLocaleString('fr-FR'); }
  function pct(x){ return (x>=0?'+':'−')+Math.round(Math.abs(x)*100)+' %'; }
  function iso(y,m,d){ var x=new Date(y,m,d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return iso(d.getFullYear(),d.getMonth(),d.getDate()); } }
  function okDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')); }
  function fr(s){ return okDate(s)?new Date(s+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function say(m){ try{ toast(m); }catch(e){} }
  function essai(n){ try{ return !!(window.nxNumEssai&&nxNumEssai(n)); }catch(e){ return false; } }
  function devis(){ try{ return typeof DEVIS!=='undefined'&&Array.isArray(DEVIS)?DEVIS:[]; }catch(e){ return []; } }
  function clients(){ try{ return typeof CLIENTS!=='undefined'&&Array.isArray(CLIENTS)?CLIENTS:[]; }catch(e){ return []; } }
  function calc(d){ try{ return (typeof window.compute==='function'?window.compute:compute)(d); }catch(e){ return null; } }
  function assujetti(){ try{ return P.regimeTVA==='assujetti'; }catch(e){ return false; } }
  function cotis(t){ try{ if(window.nxCotisPct) return Number(nxCotisPct(t))||0; }catch(e){} try{ return Number(P.cotisTaux)||0; }catch(e){ return 0; } }
  function taux(){ try{ if(window.nxobjTauxAnnee) return Number(nxobjTauxAnnee())||0; }catch(e){} try{ return Number(P.tauxHoraire)||0; }catch(e){ return 0; } }
  function coutKm(){ try{ return num(window.nxobjEtat&&nxobjEtat().coutKm); }catch(e){ return 0; } }
  /* 12 derniers mois : du lendemain de la même date l'an dernier à aujourd'hui */
  function depuis(t){ return iso(+t.slice(0,4)-1,+t.slice(5,7)-1,+t.slice(8,10)+1); }
  function refresh(){ try{ if(window._curView==='nx_obj'&&window.nxobjRender) nxobjRender(); }catch(e){} }

  /* ---------- retours SAV ---------- */
  var MOTIFS={pose:'Défaut de pose ou de réglage (ma garantie)',fabricant:'Panne sous garantie fabricant',client:'Explication / mauvaise utilisation',geste:'Geste commercial',autre:'Autre'};
  function lire(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ a=[]; }
    return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.id==='string'&&/^[\w.\-]{1,60}$/.test(x.id)&&okDate(x.date); }):[]; }
  function ecrire(a){ try{ save(KEY,a); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(_){} } }
  window.nxrtSav=lire;

  /* ---------- chantiers ---------- */
  function dateDevis(d){ var f=d.facSolde||d.facAcompte; if(f&&okDate(f.date)) return f.date;
    var c=d.created; if(typeof c==='number'&&isFinite(c)){ var x=new Date(c); return iso(x.getFullYear(),x.getMonth(),x.getDate()); }
    return okDate(String(c||'').slice(0,10))?String(c).slice(0,10):''; }
  function provisionSAV(c){ return (c&&Array.isArray(c.lines)?c.lines:[]).filter(function(l){ return /^Provision SAV/.test(String(l&&l.label||'')); }).reduce(function(s,l){ return s+(Number(l.ht)||0); },0); }
  function avoirsSur(){ var r={}; try{ (window.nxAvoirs?nxAvoirs():[]).forEach(function(a){ if(a&&a.facNum) r[a.facNum]=1; }); }catch(e){} return r; }
  function chantiers(since,t){
    var parDevis={}, out=[], sansH=0, avecAvoir=0, tva=1, AV=avoirsSur();
    try{ if(assujetti()) tva=1+num(P.achatTVA)/100; }catch(e){}
    lire().forEach(function(s){ var k=String(s.devis||'').trim(); if(k) parDevis[k]=(parDevis[k]||0)+num(s.heures); });
    devis().forEach(function(d){
      if(!d||d.statut==='refuse') return;
      var fs=[d.facAcompte,d.facSolde].filter(Boolean), date=dateDevis(d);
      if(fs.some(function(f){ return essai(f.num); })) return;            /* devis d'essai : jamais dans tes indicateurs */
      if(since&&(!date||date<since||date>t)) return;                       /* 12 derniers mois */
      var hR=num(d.hReel);
      if(!(hR>0)){ if(d.facSolde) sansH++; return; }
      if(!(d.statut==='accepte'||fs.length)) return;
      /* avoir ou facture annulée : le prix réel n'est plus celui du devis → pas compté (signalé) */
      if(fs.some(function(f){ return AV[f.num]; })||(d.facAnnulees||[]).length){ avecAvoir++; return; }
      var c=calc(d); if(!c) return;
      if(Number(c.ctrHT)>0.005){ avecAvoir++; return; }                     /* contrat d'entretien dans le devis : se facture à part */
      var ht=Number(c.totalHT)||0, mo=Number(c.mo)||0;
      var hasA=d.achatReel!=null&&String(d.achatReel).trim()!==''&&isFinite(Number(String(d.achatReel).replace(',','.')));
      var achatDevis=Number(c.matAchat)||0, achat=hasA?num(d.achatReel)/tva:achatDevis;
      var hP=Number(c.heures)||0, sH=parDevis[String(d.num||'').trim()]||0, hT=hR+sH;
      out.push({id:d.id,num:d.num||'',client:d.cNom||'—',date:date,ht:r2(ht),mo:r2(mo),achat:r2(achat),achatDevis:r2(achatDevis),achatEstime:!hasA,
        hPrev:r2(hP),hReel:r2(hR),hSav:r2(sH),moH:hT>0?r2(mo/hT):0,parH:hT>0?r2((ht-achat)/hT):0,prevH:hP>0?r2((ht-achatDevis)/hP):0});
    });
    return {liste:out.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); }),sansH:sansH,avecAvoir:avecAvoir};
  }

  /* synthèse des 12 derniers mois */
  function synthese(t){
    t=okDate(t)?t:today(); var since=depuis(t), ch=chantiers(since,t), L=ch.liste;
    var S={n:L.length,ht:0,mo:0,achat:0,achatDevis:0,hPrev:0,hReel:0,hSav:0,hMo:0,achatsEstimes:0,depuis:since,sansH:ch.sansH,avecAvoir:ch.avecAvoir,liste:L};
    L.forEach(function(x){ S.ht+=x.ht; S.mo+=x.mo; S.achat+=x.achat; S.achatDevis+=x.achatDevis; S.hPrev+=x.hPrev; S.hReel+=x.hReel; S.hSav+=x.hSav; if(x.mo>0) S.hMo+=x.hReel+x.hSav; if(x.achatEstime) S.achatsEstimes++; });
    var h=S.hReel+S.hSav, c=cotis(t);
    S.heures=r2(h); S.cotisPct=c;
    /* indicateur principal : main-d'œuvre facturée ÷ heures réellement passées, comparée au taux horaire du plan (même nature) */
    S.moH=S.hMo>0?r2(S.mo/S.hMo):0;
    /* tout compris (matériel, déplacements) : pour information, pas comparable au taux horaire */
    S.parH=h>0?r2((S.ht-S.achat)/h):0;
    S.parHNet=h>0?r2((S.ht*(1-c/100)-S.achat)/h):0;
    S.prevH=S.hPrev>0?r2((S.ht-S.achatDevis)/S.hPrev):0;
    S.ecartH=S.hPrev>0?(h-S.hPrev)/S.hPrev:0;
    S.objectif=taux();
    S.manque=S.objectif>S.moH&&S.hMo>0?r2((S.objectif-S.moH)*S.hMo):0;
    S.couleur=!S.n||!S.hMo?'gris':S.moH>=S.objectif?'vert':S.moH>=0.85*S.objectif?'orange':'rouge';
    ['ht','mo','achat','achatDevis','hPrev','hReel','hSav','hMo'].forEach(function(k){ S[k]=r2(S[k]); });
    return S;
  }
  window.nxrtSynthese=synthese;

  function syntheseSav(t){
    t=okDate(t)?t:today(); var since=depuis(t);
    var L=lire().filter(function(x){ return x.date>=since&&x.date<=t; }).sort(function(a,b){ return String(b.date).localeCompare(String(a.date))||String(b.cree||'').localeCompare(String(a.cree||'')); });
    var S={n:L.length,heures:0,km:0,pieces:0,parMotif:{},liste:L,depuis:since};
    L.forEach(function(x){ S.heures+=num(x.heures); S.km+=num(x.km); S.pieces+=num(x.pieces); var m=MOTIFS[x.motif]?x.motif:'autre'; S.parMotif[m]=(S.parMotif[m]||0)+num(x.heures); });
    var tx=taux(), kc=coutKm();
    S.taux=tx; S.coutKm=kc; S.cout=r2(S.heures*tx+S.pieces+(kc>0?S.km*kc:0));
    /* provision SAV facturée : devis dont la facture de solde est dans la période (hors essais) */
    var prov=0, nDev=0;
    devis().forEach(function(d){ var f=d&&d.facSolde; if(!f||!okDate(f.date)||f.date<since||f.date>t||essai(f.num)) return;
      var p=provisionSAV(calc(d)); if(p>0){ prov+=p; nDev++; } });
    S.provision=r2(prov); S.devisAvecProvision=nDev; S.couverture=S.cout>0?prov/S.cout:null;
    S.heures=r2(S.heures); S.km=r2(S.km); S.pieces=r2(S.pieces);
    return S;
  }
  window.nxrtSyntheseSav=syntheseSav;

  /* ---------- actions ---------- */
  function val(id){ var e=document.getElementById(id); return e?String(e.value||'').trim():''; }
  window.nxrtAjouter=function(x){
    var depuisForm=!x;
    if(depuisForm) x={date:val('nxrt_date'),client:val('nxrt_client'),devis:val('nxrt_devis'),heures:val('nxrt_h'),km:val('nxrt_km'),pieces:val('nxrt_pieces'),motif:val('nxrt_motif'),note:val('nxrt_note')};
    var t=today(), e={date:String(x.date||t),client:String(x.client||'').slice(0,120),devis:String(x.devis||'').trim().slice(0,40),
      heures:r2(num(x.heures)),km:r2(num(x.km)),pieces:r2(num(x.pieces)),motif:MOTIFS[x.motif]?x.motif:'autre',note:String(x.note||'').slice(0,300)};
    if(!okDate(e.date)||e.date>t){ say('Date invalide (pas dans le futur)'); return false; }
    if(e.heures<0||e.km<0||e.pieces<0){ say('Valeurs négatives refusées'); return false; }
    if(!(e.heures>0||e.km>0||e.pieces>0)){ say('Indique au moins des heures, des km ou des pièces'); return false; }
    if(e.heures>24){ say('Plus de 24 h pour un retour ? Vérifie la saisie'); return false; }
    /* chantier d'origine : le client se remplit tout seul s'il est vide */
    if(e.devis){ var d=devis().filter(function(q){ return String(q.num||'').trim()===e.devis; })[0]; if(d&&!e.client) e.client=d.cNom||''; }
    var id='sav_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
    var a=lire(); a.push(Object.assign({id:id,cree:new Date().toISOString()},e)); ecrire(a);
    say('Retour SAV noté'+(e.heures?' : '+h1(e.heures)+' h':'')); refresh(); return id;
  };
  window.nxrtSuppr=function(id){
    var a=lire(), x=a.filter(function(q){ return q.id===id; })[0]; if(!x) return false;
    if(!confirm('Supprimer le retour SAV du '+fr(x.date)+(x.client?' ('+x.client+')':'')+' ?')) return false;
    ecrire(a.filter(function(q){ return q.id!==id; })); refresh(); return true;
  };
  window.nxrtDevisChoisi=function(v){ var d=devis().filter(function(q){ return String(q.num||'').trim()===String(v||'').trim(); })[0], c=document.getElementById('nxrt_client');
    if(d&&c&&!c.value) c.value=d.cNom||''; };

  /* ---------- carte ---------- */
  function dot(c){ return '<span class="nxo-dot '+c+'"></span>'; }
  function carte(ctx){
    var t=(ctx&&ctx.t)||today(), S=synthese(t), V=syntheseSav(t), h='';
    h+='<div class="card" id="nxrt"><h2 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>Ma rentabilité réelle</span><span style="font-size:12px;font-weight:600;color:var(--muted,#667085)">12 derniers mois</span></h2>';
    if(!S.n){
      h+='<div class="nxo-big">Pas encore de chantier avec tes heures réelles.</div>'
        +'<div class="nxo-note">À la fin de chaque chantier, ouvre le devis et remplis le bloc « Réalité terrain » : heures réellement passées et achats réels (tickets du grossiste). C’est ce qui dira si tes prix sont bons.'+(S.sansH?' <b>'+S.sansH+' chantier(s) facturé(s) sans heures réelles</b> pour l’instant.':'')+'</div>';
    } else {
      var verdict=S.couleur==='gris'?'Pas de main-d’œuvre facturée sur ces chantiers : comparaison impossible.'
        :S.couleur==='vert'?'Ta main-d’œuvre est payée au moins ton taux du plan : tes heures sont bien estimées.'
        :'Tes heures réelles font tomber ta main-d’œuvre à '+e2(S.moH)+' de l’heure au lieu de '+e2(S.objectif)+' : ≈ <b>'+e0(S.manque)+'</b> de manque à gagner sur ces '+S.n+' chantier(s).'
          +(S.hPrev>0&&S.ecartH>0.05?' Tes heures dépassent l’estimation de '+pct(S.ecartH)+' : ajoute ce temps dans tes prochains devis de ce type, ou monte ton taux.':'');
      h+='<div class="kpis"><div class="kpi '+(S.couleur==='vert'?'':'warn')+'"><div class="lab">Ta main-d’œuvre par heure réelle<span>HT</span></div><div class="val">'+(S.hMo?e2(S.moH):'—')+'</div></div>'
        +'<div class="kpi blue"><div class="lab">Ton taux du plan<span>HT</span></div><div class="val">'+e2(S.objectif)+'</div></div>'
        +'<div class="kpi"><div class="lab">Heures réelles / prévues</div><div class="val">'+(S.hPrev>0?pct(S.ecartH):'—')+'</div></div>'
        +'<div class="kpi"><div class="lab">Tout compris, par heure<span>info</span></div><div class="val">'+e2(S.parH)+'</div></div></div>'
        +'<div class="nxo-big" style="margin-top:8px">'+dot(S.couleur)+' '+verdict+'</div>'
        +'<div class="nxo-scroll"><table class="nxo-t" style="margin-top:8px"><thead><tr><th>Chantier</th><th>Heures</th><th>M.-o. / h</th><th>Tout compris / h</th><th></th></tr></thead><tbody>'
        +S.liste.slice(0,8).map(function(x){ var c=x.mo>0?(x.moH>=S.objectif?'vert':x.moH>=0.85*S.objectif?'orange':'rouge'):'gris';
          return '<tr data-rt="'+esc(x.num)+'"><td style="white-space:normal">'+esc(x.client)+'<div style="font-size:11px;color:var(--muted,#667085)">'+esc(x.num)+' · '+fr(x.date)+' · '+e0(x.ht)+' HT</div></td><td>'+h1(x.hReel)+(x.hSav?' + '+h1(x.hSav)+' SAV':'')+' <span style="color:var(--muted,#667085)">/ '+h1(x.hPrev)+'</span></td><td><b>'+(x.mo>0?e2(x.moH):'—')+'</b></td><td>'+e2(x.parH)+(x.achatEstime?'*':'')+'</td><td>'+dot(c)+'</td></tr>'; }).join('')
        +'</tbody></table></div>'
        +'<div class="nxo-note">Chantiers facturés sur devis, des 12 derniers mois (les dépannages n’ont pas d’heures réelles). <b>M.-o. / h</b> = main-d’œuvre facturée HT (pose, préparation, mise en service, provision SAV) ÷ (heures réelles + heures de SAV notées sur ce chantier) : c’est ce qu’il faut comparer à ton taux du plan. <b>Tout compris / h</b> = (prix HT − achats) ÷ ces mêmes heures, matériel et déplacements compris : pour information ('+e2(S.parHNet)+' après cotisations de '+String(S.cotisPct).replace('.',',')+' %). Différent du « Gain réel » du devis, qui retire en plus ton coût interne (Paramètres).'
        +(S.achatsEstimes?' * achats réels pas saisis : estimation du devis ('+S.achatsEstimes+' chantier(s)).':'')
        +(S.sansH?' '+S.sansH+' chantier(s) facturé(s) sans heures réelles : pas comptés.':'')
        +(S.avecAvoir?' '+S.avecAvoir+' chantier(s) avec avoir, annulation ou contrat d’entretien : pas comptés.':'')+'</div>';
    }
    /* SAV non facturé */
    h+='<h3 style="margin:16px 0 6px;font-size:14px">Retours SAV non facturés</h3>';
    if(V.n){
      var cv=V.couverture, cc=cv==null?'gris':cv>=1?'vert':cv>=0.7?'orange':'rouge';
      h+='<div class="kpis"><div class="kpi"><div class="lab">Retours</div><div class="val">'+V.n+'</div></div>'
        +'<div class="kpi"><div class="lab">Heures</div><div class="val">'+h1(V.heures)+' h</div></div>'
        +'<div class="kpi warn"><div class="lab">Coût estimé</div><div class="val">'+e0(V.cout)+'</div></div>'
        +'<div class="kpi"><div class="lab">Provision SAV facturée</div><div class="val">'+e0(V.provision)+'</div></div></div>'
        +'<div class="nxo-big" style="margin-top:8px">'+dot(cc)+' '+(cv==null?'—':cv>=1?'Ta provision SAV couvre tes retours.':'Ta provision SAV ne couvre que '+Math.round(cv*100)+' % de tes retours : augmente-la dans tes devis (réglage « Provision SAV »).')
        +(V.parMotif.pose?' Dont <b>'+h1(V.parMotif.pose)+' h</b> pour des défauts de pose ou de réglage : c’est la partie que tu peux réduire.':'')+'</div>'
        +'<div style="margin-top:8px">'+V.liste.slice(0,6).map(function(x){
          return '<div class="nxo-c" data-sav="'+esc(x.id)+'"><span class="i">↺</span><div style="flex:1"><div>'+fr(x.date)+' · '+esc(x.client||'—')+(x.devis?' · '+esc(x.devis):'')+'</div><div class="d">'+esc(MOTIFS[x.motif]||MOTIFS.autre)+' — '+h1(x.heures)+' h'+(x.km?' · '+h1(x.km)+' km':'')+(x.pieces?' · pièces '+e2(x.pieces):'')+(x.note?' · '+esc(x.note):'')+'</div></div><button class="btn-ghost btn-sm" onclick="nxrtSuppr(\''+esc(x.id)+'\')" aria-label="Supprimer ce retour">✕</button></div>'; }).join('')+'</div>'
        +'<div class="nxo-note">Coût estimé = heures × ton taux du plan ('+e2(V.taux)+', ce que ces heures t’auraient rapporté facturées) + pièces payées'+(V.coutKm>0?' + km × '+e2(V.coutKm):' (km non chiffrés : renseigne ton coût du km dans « Mes réglages »)')+'. Provision = lignes « Provision SAV / garantie » des devis facturés depuis le '+fr(V.depuis)+' ('+V.devisAvecProvision+' devis).</div>';
    } else h+='<div class="nxo-note" style="margin-top:0">Aucun retour noté. Quand tu reviens chez un client sans pouvoir facturer (garantie, réglage, geste commercial), note-le ici : c’est le seul moyen de savoir ce que te coûte vraiment le SAV.</div>';
    /* formulaire */
    var D=devis().filter(function(d){ return d&&d.num&&(d.statut==='accepte'||d.facSolde); }).slice(-60).reverse();
    var noms={}; clients().forEach(function(c){ if(c&&c.nom) noms[c.nom]=1; });
    h+='<details style="margin-top:10px"'+(V.n?'':' open')+'><summary style="cursor:pointer;font-weight:700">＋ Noter un retour SAV</summary><div class="nxo-form" style="margin-top:10px">'
      +'<label>Date<input id="nxrt_date" type="date" value="'+esc(t)+'" max="'+esc(t)+'"></label>'
      +'<label>Chantier d’origine (devis)<input id="nxrt_devis" list="nxrt_ldevis" placeholder="DV-…" onchange="nxrtDevisChoisi(this.value)"><datalist id="nxrt_ldevis">'+D.map(function(d){ return '<option value="'+esc(d.num)+'">'+esc((d.cNom||'')+' — '+(d.type||''))+'</option>'; }).join('')+'</datalist></label>'
      +'<label>Client<input id="nxrt_client" list="nxrt_lcli"><datalist id="nxrt_lcli">'+Object.keys(noms).slice(0,300).map(function(n){ return '<option value="'+esc(n)+'">'; }).join('')+'</datalist></label>'
      +'<label>Motif<select id="nxrt_motif">'+Object.keys(MOTIFS).map(function(k){ return '<option value="'+k+'">'+esc(MOTIFS[k])+'</option>'; }).join('')+'</select></label>'
      +'<label>Heures passées (trajet compris)<input id="nxrt_h" type="number" inputmode="decimal" step="0.25" min="0"></label>'
      +'<label>Km aller-retour<input id="nxrt_km" type="number" inputmode="decimal" step="1" min="0"></label>'
      +'<label>Pièces non facturées (€ payés)<input id="nxrt_pieces" type="number" inputmode="decimal" step="0.01" min="0"></label>'
      +'<label>Note<input id="nxrt_note" maxlength="300" placeholder="ex. vanne 4 voies remplacée"></label>'
      +'</div><div class="row-actions" style="margin-top:10px"><button class="btn-pri btn-sm" onclick="nxrtAjouter()">Enregistrer le retour</button></div></details>';
    return h+'</div>';
  }
  window.nxrtCarte=carte;

  window.nxobjAjouts=window.nxobjAjouts||[];
  if(!window.nxobjAjouts.some(function(a){ return a&&a.id==='rentab'; })) window.nxobjAjouts.push({id:'rentab',pos:'apres3',carte:carte});
})();
