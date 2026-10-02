/* ============================================================
   ClimPilot Next — next-documents.js  (couche additive, 1.10 — 02/10/2026)
   MENTIONS DES DOCUMENTS ET SAUVEGARDE AVANT LA 1.10.

   - Dénomination « EI » (Code de commerce, art. R526-27) : pour un entrepreneur individuel (micro, EI),
     la dénomination incorpore son nom, suivie de « EI », sur tous les documents (en-tête, pied, XML).
   - Assurance (Code de l'artisanat, art. L132-1) : sur chaque devis et facture, l'assurance professionnelle
     quand elle est OBLIGATOIRE pour ces travaux (décennale pour la pose : à confirmer avec l'assureur),
     l'assureur et la couverture géographique. Contrôle selon la NATURE des travaux, pas selon le SIRET.
   - Médiateur de la consommation (Code de la consommation, L616-1 et R616-1) : coordonnées communiquées
     au client PARTICULIER sur le devis (support du contrat).
   - Nature de l'opération (cadre BT-23) : en mode réel, une vraie facture de chantier ou de dépannage avec
     pièces exige que Gabriel ait choisi S ou M dans Paramètres (elle est figée à l'émission).
   - Intervention à 0 € : refusée (C16). RGPD : paragraphe « Données personnelles » sur le devis.
   - Sauvegarde : au premier lancement de la 1.10, instantané local + invitation à télécharger une
     sauvegarde complète (JSON), affichée tant qu'aucune sauvegarde n'a été téléchargée depuis.
   Sources : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045697814 (R526-27)
             https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047362294 (L132-1 Code de l'artisanat)
             https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032224762 (L616-1)
             https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032808378 (R616-1)
   ============================================================ */
(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function say(m){ try{ toast(m); }catch(e){} }
  function E(){ try{ return P.entreprise||{}; }catch(e){ return {}; } }
  function modeReel(){ try{ return window.nxEmisMode&&nxEmisMode().mode!=='demo'; }catch(e){ return false; } }

  /* ---------- dénomination « EI » ---------- */
  function estIndividuel(e){ var st=String((e||{}).statut||''); if(/\b(SASU?|SARL|EURL|SAS|SA|SNC|SCOP|SELARL)\b/i.test(st)) return false; return /micro|auto|individuel|\bEI\b/i.test(st)||!st; }
  function denomination(e){
    e=e||{}; var nom=String(e.nom||'').trim(); if(!nom||!estIndividuel(e)) return nom;
    if(/(\bEI\b|entrepreneur individuel)\s*$/i.test(nom)) return nom;
    var pers=String(e.nomEntrepreneur||'').trim(), contient=pers&&nom.toLowerCase().indexOf(pers.toLowerCase())>=0;
    return (pers&&!contient?nom+' — '+pers:nom)+' EI';
  }
  window.nxDenomination=denomination; window.nxEstIndividuel=estIndividuel;
  function envelopperEnTetes(){
    ['docTop','docLegal'].forEach(function(fn){ var o=window[fn]; if(typeof o!=='function'||o._nxdoc) return;
      var w=function(e){ var a=Array.prototype.slice.call(arguments); try{ if(e&&typeof e==='object') a[0]=Object.assign({},e,{nom:denomination(e)}); }catch(_){} return o.apply(this,a); };
      w._nxdoc=true; window[fn]=w; });
  }

  /* ---------- nature des travaux ---------- */
  var SANS_POSE=['depannage','entretien','mes'];
  function estPose(d){
    if(!d) return false;
    if(d.v===2&&Array.isArray(d.lots)&&d.lots.length) return d.lots.some(function(l){ return l&&!l.option&&SANS_POSE.indexOf(l.module)<0; });
    return !/d[ée]pannage|maintenance|entretien|mise en service/i.test(String(d.type||''));
  }
  window.nxEstPose=estPose;
  function assuranceManque(e){ var m=[]; if(!String(e.assurance||'').trim()) m.push('l\'assurance professionnelle (assureur et n° de contrat)'); if(!String(e.assuranceZone||'').trim()) m.push('sa couverture géographique'); return m; }
  function assuranceRequise(e,pose){ return pose&&e.decennale!=='non'; }
  function mentionsManquantes(kind,o){
    var e=E(), out=[];
    if(kind==='devis'||kind==='facture-devis'){
      if(assuranceRequise(e,estPose(o))){ var a=assuranceManque(e); if(a.length) out.push({k:'assurance',t:'Assurance : '+a.join(' et ')+' — à indiquer sur chaque devis et facture quand l\'assurance est obligatoire pour ces travaux (Code de l\'artisanat, art. L132-1 ; décennale pour la pose : '+(e.decennale==='oui'?'confirmée':'à confirmer avec ton assureur')+').'}); }
    }
    if(kind==='devis'&&o&&o.cType!=='Professionnel'&&!String(e.mediateur||'').trim())
      out.push({k:'mediateur',t:'Médiateur de la consommation : coordonnées à communiquer au client particulier (Code de la consommation, art. L616-1 et R616-1) — renseigne le médiateur auquel tu as adhéré (Paramètres).'});
    return out;
  }
  window.nxMentionsManquantes=mentionsManquantes;

  /* ---------- contrôles avant émission (en chaîne avec next-particuliers) ---------- */
  function controle(sorte,args){
    var e=E(), reel=modeReel(), o=null;
    try{ if(sorte==='devis') o=(DEVIS||[]).find(function(x){ return x.id===args[0]; }); else if(sorte==='dep'){ try{ formToDep(); }catch(_){} o=curDep; } }catch(_){}
    if(!o) return {};
    if(sorte==='dep'&&o.facNum) return {};
    if(sorte==='devis'&&(args[1]==='acompte'?o.facAcompte:o.facSolde)) return {};
    /* intervention à 0 € */
    if(sorte==='dep'){ var t=0; try{ t=computeDep(o).totalHT; }catch(_){} if(!(t>0.005)){ alert('Rien à facturer : le montant de l\'intervention est nul.'); return {stop:true}; } }
    /* nature de l'opération figée dans la facture électronique */
    var nat=sorte==='devis'||(sorte==='dep'&&o.pieces&&o.pieces.length);
    if(reel&&nat&&e.natureChantier!=='S'&&e.natureChantier!=='M'){
      alert('Facture NON émise : choisis d\'abord dans Paramètres la nature de l\'opération pour les chantiers « fourniture + pose » et les dépannages avec pièces (S = prestation de services, M = biens et services distincts).\n\nElle est inscrite dans la facture électronique et ne pourra plus changer après l\'émission. À trancher avec ton comptable.');
      return {stop:true};
    }
    /* assurance selon les travaux */
    if(sorte==='devis'){ var mq=mentionsManquantes('facture-devis',o);
      if(mq.length){ if(reel){ alert('Facture NON émise :\n\n'+mq.map(function(x){ return '• '+x.t; }).join('\n')+'\n\nRenseigne-la dans Paramètres, puis recommence.'); return {stop:true}; }
        say('⚠ Document de TEST émis sans : '+mq.map(function(x){ return x.t; }).join(' ')+' En mode réel, la facture serait refusée.'); } }
    return {};
  }
  function chainer(){
    var prev=window.nxAvantEmission; if(prev&&prev._nxdoc) return;
    var w=function(sorte,args){ var r=controle(sorte,args)||{}; if(r.stop) return r; var p=(typeof prev==='function'?prev(sorte,args):{})||{}; return Object.assign({},r,p); };
    w._nxdoc=true; window.nxAvantEmission=w;
  }

  /* ---------- devis : mentions, RGPD ---------- */
  function rgpd(e){
    return '<div data-rgpd="1" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#666;margin-top:8px;line-height:1.45"><b>Données personnelles</b> : '+esc(denomination(e)||'l\'entreprise')+
      ' utilise vos coordonnées et les informations de ce devis pour l\'établir, l\'exécuter et le facturer (exécution du contrat, obligations légales). Elles sont conservées pendant la relation commerciale puis archivées pendant les durées légales (pièces comptables : 10 ans). '+
      'Vous pouvez y accéder, les faire rectifier ou effacer, ou vous opposer à leur traitement'+(e.email?' en écrivant à '+esc(e.email):' en contactant l\'entreprise')+'. Réclamation possible auprès de la CNIL (www.cnil.fr).</div>';
  }
  function envelopperDevis(){
    var o=window.printDevis; if(typeof o!=='function'||o._nxdoc) return;
    var w=function(){
      var real=window.print, fired=false; window.print=function(){ fired=true; };
      try{ o.apply(this,arguments); } finally{ window.print=real; }
      try{ var doc=document.getElementById('devisDoc'), d=(typeof cur!=='undefined')?cur:null, e=E();
        if(doc&&!doc.querySelector('[data-rgpd]')) doc.insertAdjacentHTML('beforeend',rgpd(e));
        var mq=mentionsManquantes('devis',d); if(mq.length) say('⚠ Devis incomplet : '+mq.map(function(x){ return x.k==='assurance'?'assurance':'médiateur'; }).join(' + ')+' manquant(s) — voir Paramètres'); }catch(_){}
      if(fired) window.print();
    };
    w._nxdoc=true; window.printDevis=w;
  }
  function envelopperEnvoi(){
    var o=window.nxsSendDevis; if(typeof o!=='function'||o._nxdoc) return;
    var w=function(){
      try{ if(typeof cur!=='undefined'&&cur){ try{ formToDevis(); }catch(_){} var mq=mentionsManquantes('devis',cur);
        if(mq.length&&modeReel()){ alert('Devis NON envoyé : mention obligatoire manquante.\n\n'+mq.map(function(x){ return '• '+x.t; }).join('\n')); return; } } }catch(_){}
      return o.apply(this,arguments);
    };
    w._nxdoc=true; window.nxsSendDevis=w;
  }

  /* ---------- sauvegarde avant la 1.10 ---------- */
  var KB='cpnext_avant110';
  function etatSauvegarde(){ var o=null; try{ o=JSON.parse(localStorage.getItem(KB)||'null'); }catch(e){} return o; }
  function premiereFois(){
    var o=etatSauvegarde(); if(o&&o.at) return o;
    o={at:Date.now()}; try{ if(typeof window.nxSnapshot==='function'){ window.nxSnapshot('Avant ClimPilot 1.10'); o.snap=true; } }catch(e){}
    try{ localStorage.setItem(KB,JSON.stringify(o)); }catch(e){}
    return o;
  }
  function derniereSauvegarde(){ try{ return load(LS.lastbk,null); }catch(e){ return null; } }
  function carteSauvegarde(){
    var o=etatSauvegarde(); if(!o) return; var last=derniereSauvegarde(), host=document.getElementById('v-dash');
    var old=document.getElementById('nxAvant110'); if(old) old.remove();
    if(!host||(last&&last>=o.at)) return;
    var b=document.createElement('div'); b.id='nxAvant110'; b.className='warnbox'; b.style.margin='0 0 12px';
    b.innerHTML='<div style="min-width:0;flex:1">💾 <b>ClimPilot 1.10 : télécharge une sauvegarde complète de tes données</b> (fichier à garder hors de l\'appli).'+
      (o.snap?' Une copie locale a déjà été faite automatiquement sur cet appareil le '+new Date(o.at).toLocaleString('fr-FR')+'.':'')+
      ' Dernière sauvegarde téléchargée : '+(last?new Date(last).toLocaleString('fr-FR'):'<b>aucune</b>')+'.'+
      '<div class="row-actions" style="margin-top:6px"><button class="btn-pri btn-sm" onclick="exportJSON();setTimeout(function(){ try{ nxAvant110(); }catch(e){} },300)">Télécharger la sauvegarde (JSON)</button></div></div>';
    host.insertBefore(b,host.firstChild);
  }
  window.nxAvant110=carteSauvegarde;

  /* ---------- branchement ---------- */
  function boot(){
    envelopperEnTetes(); chainer(); premiereFois();
    var g=window.go; if(typeof g==='function'&&!g._nxdoc){ var w=function(v){ var r=g.apply(this,arguments); if(v==='dash') setTimeout(carteSauvegarde,0); return r; }; w._nxdoc=true; window.go=w; }
    setTimeout(carteSauvegarde,300);
    var tries=0; (function wait(){ if(typeof window.printDevis==='function'&&window.printDevis._nxpart){ envelopperDevis(); } else if(++tries<60) return setTimeout(wait,150); else envelopperDevis();
      envelopperEnvoi(); })();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
