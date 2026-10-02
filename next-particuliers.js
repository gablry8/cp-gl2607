/* ============================================================
   ClimPilot Next — next-particuliers.js  (couche additive, 1.10 — 02/10/2026)
   CONTRATS AVEC LES PARTICULIERS (consommateurs).

   - Deux informations DISTINCTES, saisies par Gabriel (jamais déduites) :
       · le MODE DE CONCLUSION : hors établissement (signé chez le client), à distance,
         dans les locaux de l'entreprise, ou « à préciser » (par défaut) ;
       · l'URGENCE : travaux d'entretien ou de réparation urgents, expressément demandés
         par le client (limités aux pièces et travaux strictement nécessaires).
     Une signature en ligne ne suffit pas à qualifier le contrat « à distance ».
   - Date RÉELLE de conclusion, avec sa preuve (signature en ligne horodatée par le
     serveur, papier signé, accord écrit…) — pas la date du passage en « Accepté ».
   - Paiement (Code de la consommation, art. L221-10, sanction L242-7) : contrat hors
     établissement, hors urgence → aucun paiement avant l'expiration de 7 jours.
     Calcul prudent retenu : le jour de la conclusion n'est pas compté, paiement possible
     à partir de J+8 (à confirmer). Mode « à préciser » → aucune demande de paiement.
     Un paiement reçu malgré tout est enregistré tel quel, marqué irrégulier, avec une
     alerte de régularisation (jamais refusé en silence).
   - Rétractation (L221-5, L221-9, L221-18, L221-20, L221-25, L221-28) : information et
     formulaire imprimés sur le devis papier d'un particulier (hors établissement, à
     distance ou à préciser), avec la demande expresse de commencement anticipé.
   - Dépannage chez un particulier (arrêté du 24/01/2017, dès le premier euro) : contrat
     d'intervention AVANT travaux ; bandeau rouge dès l'ouverture tant qu'il n'est pas
     signé ; facturer sans lui reste possible (obligation de facturer) mais est tracé.
   - Remise de l'exemplaire : « remis » n'est affiché qu'avec une preuve (signature du
     client sur l'accusé de remise papier, ou téléchargement enregistré par le serveur).
   ============================================================ */
(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } }
  function fr(iso){ return iso?new Date(String(iso).slice(0,10)+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function plusJours(iso,n){ var d=new Date(String(iso).slice(0,10)+'T12:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function say(m){ try{ toast(m); }catch(e){} }
  function money(n){ try{ return eur(n); }catch(e){ return (Math.round((Number(n)||0)*100)/100).toFixed(2).replace('.',',')+' €'; } }

  var MODES={hors_etablissement:'Signé chez le client (hors établissement)',distance:'À distance (sans visite juste avant la signature)',locaux:'Dans les locaux de l\'entreprise',a_preciser:'À préciser'};
  var PREUVES={signature_en_ligne:'Signature en ligne (horodatée par le serveur)',papier:'Document papier signé par le client',ecrit:'Accord écrit (courriel, courrier)',autre:'Autre (préciser)'};
  window.nxPartModes=MODES;

  /* ---------- objets concernés ---------- */
  function objet(kind,id){
    try{
      if(kind==='devis') return (DEVIS||[]).find(function(x){ return x.id===id; })||null;
      if(kind==='dep'){ var x=(DEP||[]).find(function(o){ return o.id===id; }); if(x) return x; return (typeof curDep!=='undefined'&&curDep&&curDep.id===id)?curDep:null; }
      if(kind==='loc') return (LOC||[]).find(function(o){ return o.id===id; })||null;
      if(kind==='ctr') return (CTR||[]).find(function(o){ return o.id===id; })||null;
    }catch(e){}
    return null;
  }
  function cleStockage(kind){ return {devis:LS.devis,dep:LS.dep,loc:LS.loc,ctr:'cp2_contrats'}[kind]; }
  function tableau(kind){ return {devis:DEVIS,dep:DEP,loc:LOC,ctr:CTR}[kind]; }
  function enregistrer(kind){ try{ save(cleStockage(kind),tableau(kind)); }catch(e){} }
  function particulier(kind,o){
    if(!o) return false;
    if(kind==='ctr'){ try{ var c=(CLIENTS||[]).find(function(x){ return (x.nom||'').toLowerCase()===(o.clientNom||'').toLowerCase(); })||{}; return c.type!=='Professionnel'; }catch(e){ return true; } }
    return o.cType!=='Professionnel';
  }
  function conclusion(o){ var c=(o&&o.conclusion)||{}; return {mode:MODES[c.mode]?c.mode:'a_preciser',date:c.date||'',preuve:c.preuve||null,urgence:!!c.urgence,urgenceTexte:c.urgenceTexte||'',remise:c.remise||null,anticipe:!!c.anticipe}; }
  window.nxPartConclusionDe=function(kind,id){ return conclusion(objet(kind,id)); };

  /* règle de paiement (L221-10) pour un contrat avec un particulier */
  function regle(kind,o){
    if(!particulier(kind,o)) return {ok:true,motif:'professionnel'};
    var c=conclusion(o);
    if(c.urgence) return {ok:true,motif:'urgence',c:c};
    if(c.mode==='a_preciser') return {ok:false,motif:'a_preciser',c:c,texte:'Mode de conclusion du contrat à préciser avant toute demande de paiement (Code de la consommation, art. L221-10).'};
    if(c.mode==='hors_etablissement'){
      if(!c.date) return {ok:false,motif:'date',c:c,texte:'Date de conclusion du contrat à saisir (contrat signé chez le client).'};
      var des=plusJours(c.date,8);
      return {ok:today()>=des,motif:'delai',des:des,c:c,texte:'Contrat conclu hors établissement le '+fr(c.date)+' : aucun paiement avant l\'expiration du délai de 7 jours (art. L221-10 du Code de la consommation) — paiement possible à partir du '+fr(des)+' (calcul prudent, à confirmer).'};
    }
    return {ok:true,motif:c.mode,c:c};
  }
  window.nxPartRegle=function(kind,id){ return regle(kind,objet(kind,id)); };
  window.nxPartPlusJours=plusJours;

  /* ---------- fenêtre « conclusion du contrat » ---------- */
  function modal(titre,html,actions){
    var m=document.getElementById('nxPartM'); if(m) m.remove();
    m=document.createElement('div'); m.id='nxPartM';
    m.style.cssText='position:fixed;inset:0;z-index:99995;background:rgba(10,25,45,.45);display:flex;align-items:center;justify-content:center;padding:14px';
    m.innerHTML='<div style="background:var(--panel,#fff);color:var(--ink,#1b2437);border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:16px">'+esc(titre)+'</h2><button class="btn-ghost btn-sm" onclick="document.getElementById(\'nxPartM\').remove()">✕</button></div>'+html+
      '<div class="row-actions" style="margin-top:12px;justify-content:flex-end">'+(actions||'')+'</div></div>';
    document.body.appendChild(m); return m;
  }
  window.nxPartConclusion=function(kind,id,ensuite){
    var o=objet(kind,id); if(!o){ say('Document introuvable'); return; }
    var c=conclusion(o), sig=o.signature&&o.signature.at;
    var html='<p class="sub" style="margin:6px 0 10px">Ces informations décident des règles de paiement et de rétractation. ClimPilot ne les devine pas : c\'est toi qui les indiques.</p>'+
      '<label class="full" style="display:block;margin:6px 0">Où le contrat a-t-il été conclu ?<select id="nxpMode" style="width:100%">'+Object.keys(MODES).map(function(k){ return '<option value="'+k+'"'+(k===c.mode?' selected':'')+'>'+esc(MODES[k])+'</option>'; }).join('')+'</select></label>'+
      '<div class="sub2" style="margin-bottom:6px">« Hors établissement » : signé chez le client, ou à distance juste après l\'avoir rencontré chez lui. Une signature en ligne n\'en fait pas, à elle seule, un contrat « à distance ».</div>'+
      '<label class="full" style="display:block;margin:6px 0">Date réelle de conclusion (signature)<input type="date" id="nxpDate" value="'+esc(c.date||(sig?String(new Date(sig).toISOString()).slice(0,10):''))+'" style="width:100%"></label>'+
      '<label class="full" style="display:block;margin:6px 0">Preuve<select id="nxpPreuve" style="width:100%">'+Object.keys(PREUVES).map(function(k){ var sel=(c.preuve&&c.preuve.type===k)||(!c.preuve&&sig&&k==='signature_en_ligne'); return '<option value="'+k+'"'+(sel?' selected':'')+'>'+esc(PREUVES[k])+'</option>'; }).join('')+'</select></label>'+
      '<label class="full" style="display:block;margin:6px 0">Référence de la preuve (facultatif)<input id="nxpRef" value="'+esc((c.preuve&&c.preuve.ref)||(sig?('signature en ligne du '+new Date(sig).toLocaleString('fr-FR')):''))+'" style="width:100%"></label>'+
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0 4px"><input type="checkbox" id="nxpUrg"'+(c.urgence?' checked':'')+'> <span><b>Travaux urgents</b> d\'entretien ou de réparation, <b>expressément demandés</b> par le client (pièces et travaux strictement nécessaires à l\'urgence seulement).</span></label>'+
      '<textarea id="nxpUrgT" rows="2" placeholder="Ce qui était urgent et ce qui a été fait" style="width:100%">'+esc(c.urgenceTexte)+'</textarea>'+
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0 4px"><input type="checkbox" id="nxpAnt"'+(c.anticipe?' checked':'')+'> <span>Le client a <b>demandé expressément</b> (par écrit) que les travaux commencent avant la fin du délai de rétractation (art. L221-25).</span></label>';
    modal('Contrat avec un particulier — '+(o.num||o.facNum||o.cNom||''),html,'<button class="btn-ghost" onclick="document.getElementById(\'nxPartM\').remove()">Annuler</button><button class="btn-pri" id="nxpOk">Enregistrer</button>');
    document.getElementById('nxpOk').onclick=function(){
      var g=function(i){ return (document.getElementById(i)||{}).value||''; };
      var mode=g('nxpMode'), date=g('nxpDate');
      if(mode==='hors_etablissement'&&!date){ alert('Indique la date réelle de signature.'); return; }
      o.conclusion=Object.assign({},o.conclusion||{},{mode:mode,date:date,preuve:{type:g('nxpPreuve'),ref:g('nxpRef').trim()},urgence:!!document.getElementById('nxpUrg').checked,
        urgenceTexte:g('nxpUrgT').trim(),anticipe:!!document.getElementById('nxpAnt').checked,maj:Date.now()});
      enregistrer(kind); try{ if(kind==='devis'&&typeof cur!=='undefined'&&cur&&cur.id===o.id&&cur!==o) cur.conclusion=JSON.parse(JSON.stringify(o.conclusion)); }catch(e){}
      document.getElementById('nxPartM').remove(); say('Contrat : informations enregistrées');
      try{ renderFBloc(); }catch(e){} try{ if(kind==='dep') loadDepForm(); }catch(e){}
      if(typeof ensuite==='function') ensuite();
    };
  };
  /* remise de l'exemplaire papier : seulement si le client a signé l'accusé de remise */
  window.nxPartRemisePapier=function(kind,id){
    var o=objet(kind,id); if(!o) return;
    var d=prompt('Exemplaire papier remis au client et accusé de remise SIGNÉ par lui ?\nDate de la remise (jj/mm/aaaa) :',fr(today())); if(d==null) return;
    var iso=(window.nxToISO?nxToISO(d):'')||today();
    o.conclusion=Object.assign({},o.conclusion||{},{remise:{type:'papier',date:iso,preuve:'accusé de remise signé par le client (papier)',at:Date.now()}});
    enregistrer(kind); try{ renderFBloc(); }catch(e){} try{ if(kind==='dep') loadDepForm(); }catch(e){}
  };

  /* ---------- émission d'une facture (appelé par next-emission avant l'essai à blanc) ---------- */
  window.nxAvantEmission=function(sorte,args){
    var kind=sorte, id=null;
    try{ if(sorte==='devis') id=args[0]; else if(sorte==='loc'||sorte==='ctr') id=args[0]; else if(sorte==='dep'){ try{ formToDep(); }catch(e){} id=curDep&&curDep.id; } }catch(e){}
    var o=sorte==='dep'?(typeof curDep!=='undefined'?curDep:null):objet(kind,id);
    if(!o||!particulier(kind,o)) return {};
    /* déjà facturé : la fonction d'origine affichera son propre message */
    if((sorte==='dep'&&o.facNum)||(sorte==='loc'&&o.fac)||(sorte==='devis'&&(args[1]==='acompte'?o.facAcompte:o.facSolde))) return {};
    var out={};
    /* dépannage chez un particulier : contrat avant travaux (arrêté du 24/01/2017) */
    if(sorte==='dep'&&!(o.contratAvant&&o.contratAvant.date)){
      if(!confirm('⚠ Aucun contrat d\'intervention signé AVANT les travaux n\'est enregistré (dépannage chez un particulier : obligatoire dès le premier euro — arrêté du 24/01/2017).\n\nLa facture reste due : la facturer quand même ?\n(Le manquement sera noté sur l\'intervention.)')) return {stop:true};
      out.marque={contratAvantManquant:{at:Date.now(),date:today()}};
    }
    var r=regle(kind,o);
    if(!r.ok&&(r.motif==='a_preciser'||r.motif==='date')){
      alert(r.texte+'\n\nUne facture est une demande de paiement : précise d\'abord le contrat.');
      window.nxPartConclusion(kind,o.id);
      return {stop:true};
    }
    if(!r.ok&&r.motif==='delai'){ out.echeance=r.des; out.echeanceTexte='Paiement exigible à partir du '+fr(r.des)+' (délai de 7 jours, art. L221-10 du Code de la consommation)'; }
    return out;
  };

  /* ---------- paiements : tous les parcours ---------- */
  /* y a-t-il vraiment une facture à encaisser ? (sinon la fonction d'origine ne fait rien : pas de question inutile) */
  function aEncaisser(kind,o,which){
    if(!o) return false;
    if(kind==='devis'){ var f=which==='acompte'?o.facAcompte:o.facSolde; return !!(f&&!f.payeLe); }
    if(kind==='loc') return !!(o.fac&&!o.fac.payeLe);
    if(kind==='dep') return o.statut==='facturee';
    if(kind==='ctr'){ var g=(o.facs||[]).find(function(x){ return String(x.annee)===String(which); }); return !!(g&&!g.payeLe); }
    return false;
  }
  function garderPaiement(kind,id,orig,self,args,quoi){
    var o=objet(kind,id);
    if(!aEncaisser(kind,o,kind==='dep'?'':args[2])) return orig.apply(self,args);
    var r=regle(kind,o);
    if(r.ok) return orig.apply(self,args);
    var msg=r.texte||'Contrat à préciser';
    if(r.motif==='a_preciser'||r.motif==='date'){
      if(confirm(msg+'\n\nOK = préciser le contrat maintenant (le paiement sera enregistré juste après, selon la règle qui s\'applique).\nAnnuler = autres choix.')){
        var a=Array.prototype.slice.call(args), fn=kind==='dep'&&a.length===1?'payDep':'payerFacture';
        window.nxPartConclusion(kind,id,function(){ var r2=regle(kind,objet(kind,id)); if(r2.motif==='a_preciser'||r2.motif==='date') return; window[fn].apply(null,a); });
        return;
      }
      if(!confirm('Le client a-t-il DÉJÀ payé '+quoi+' ?\n\nOK = oui : le paiement est enregistré tel quel, marqué « à vérifier », avec une alerte.\nAnnuler = non : rien n\'est enregistré.')) return;
    } else if(!confirm('⚠ '+msg+'\n\nUn paiement ne doit pas être demandé ni reçu avant cette date (sanction : art. L242-7).\n\nLe client a-t-il DÉJÀ payé malgré tout ?\nOK = oui : le paiement est enregistré tel quel, marqué IRRÉGULIER, avec une alerte de régularisation.\nAnnuler = non : rien n\'est enregistré.')) return;
    var res=orig.apply(self,args);
    try{ marquerIrregulier(kind,id,args,r); }catch(e){}
    return res;
  }
  function marquerIrregulier(kind,id,args,r){
    var o=objet(kind,id); if(!o) return; var f=null;
    if(kind==='devis') f=args[2]==='acompte'?o.facAcompte:o.facSolde;
    else if(kind==='loc') f=o.fac; else if(kind==='ctr') f=(o.facs||[]).find(function(x){ return String(x.annee)===String(args[2]); }); else if(kind==='dep') f=o;
    var irr=r.motif==='delai';
    var info={at:Date.now(),date:today(),statut:irr?'irregulier':'a_verifier',motif:r.motif,regle:r.texte||'',des:r.des||null};
    if(f){ f.paiementIrregulier=info; enregistrer(kind); }
    var num=kind==='dep'?o.facNum:(f&&f.num);
    try{ if(window.nxEmisEvenement&&num) nxEmisEvenement(num,'paiement_irregulier',info); }catch(e){}
    tache((irr?'Régulariser : paiement reçu avant la fin du délai de 7 jours':'Vérifier : paiement reçu, contrat à préciser')+' — '+(num||o.cNom||''),
      'Contrat avec un particulier. '+(r.texte||'')+' Que faire (remboursement, régularisation) : à voir avec ton conseil — à confirmer.',num||o.id);
    say(irr?'⚠ Paiement enregistré et marqué IRRÉGULIER — tâche de régularisation créée':'⚠ Paiement enregistré, marqué « à vérifier » — tâche créée');
  }
  function tache(titre,detail,ref){
    try{ if(typeof window.nxAddTask==='function'){ nxAddTask({title:titre+' — '+detail,priority:'high',cat:'Client',due:today(),ref:'L221-10-'+ref}); return; } }catch(e){}
    try{ var k='cpnext_tasks', t=JSON.parse(localStorage.getItem(k)||'[]'); if(!Array.isArray(t)) t=[];
      t.push({id:'T-L221-10-'+String(ref).replace(/[^\w-]/g,''),title:titre+' — '+detail,priority:'high',cat:'Client',due:today(),link:'',ref:'L221-10-'+ref,done:false,created:Date.now()}); save(k,t); }catch(e){}
  }

  /* ---------- rétractation sur le devis papier ---------- */
  function blocDevis(d){
    var c=conclusion(d), html='';
    if(!c.urgence&&(c.mode==='hors_etablissement'||c.mode==='a_preciser'))
      html+='<div data-l221-10="1" style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#7a1020;border:1px solid #e5484d;padding:6px 8px;margin-top:10px"><b>Paiement</b> : '+
        (c.mode==='hors_etablissement'?'contrat signé chez le client : ':'si ce contrat est signé chez le client : ')+
        'aucun paiement ni acompte ne peut être exigé ou reçu avant l\'expiration d\'un délai de 7 jours à compter de la signature (art. L221-10 du Code de la consommation)'+
        (c.date?' — soit à partir du '+fr(plusJours(c.date,8)):'')+'. Toute mention « acompte à la commande » s\'entend dans ce délai.</div>';
    if(c.mode!=='locaux'&&typeof window.nxRetractationHTML==='function') html+=window.nxRetractationHTML(d,c.mode);
    html+='<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#222;margin-top:10px;border:1px solid #bbb;padding:8px;line-height:1.5">'+
      (c.mode!=='locaux'?'☐ Je demande expressément que les travaux commencent avant la fin du délai de rétractation de 14 jours, et je reconnais qu\'une fois le contrat entièrement exécuté je n\'aurai plus de droit de rétractation (art. L221-25 et L221-28 du Code de la consommation). Signature : ………………………<br>':'')+
      '<b>Exemplaire client</b> remis en main propre le ………………… — Signature du client (accusé de remise) : ………………………</div>';
    return html;
  }
  function envelopperImpression(){
    var o=window.printDevis; if(typeof o!=='function'||o._nxpart) return;
    var w=function(){
      var real=window.print, fired=false; window.print=function(){ fired=true; };
      try{ o.apply(this,arguments); } finally{ window.print=real; }
      try{ var d=(typeof cur!=='undefined')?cur:null, doc=document.getElementById('devisDoc');
        if(d&&doc&&d.cType!=='Professionnel'&&!doc.querySelector('[data-retractation]')) doc.insertAdjacentHTML('beforeend',blocDevis(d)); }catch(e){}
      if(fired) window.print();
    };
    w._nxpart=true; window.printDevis=w;
  }

  /* ---------- panneau dans la facturation du devis ---------- */
  function panneauDevis(){
    var el=document.getElementById('fBloc'); if(!el||typeof cur==='undefined'||!cur||cur.cType==='Professionnel') return;
    var old=document.getElementById('nxPartBloc'); if(old) old.remove();
    var d=objet('devis',cur.id)||cur, c=conclusion(d), r=regle('devis',d), rem=c.remise;
    var sigRem=d.signature&&d.signature.copieLe; /* écrit seulement par la synchro des signatures (date enregistrée par le serveur) */
    var b=document.createElement('div'); b.id='nxPartBloc'; b.className='warnbox'; b.style.margin='8px 0';
    b.innerHTML='<b>Contrat avec un particulier</b> : '+esc(MODES[c.mode])+(c.date?' — conclu le '+fr(c.date):'')+(c.urgence?' — <b>urgence</b> demandée':'')+
      '<br>'+(r.ok?'<span style="color:#0f6b39">Paiement possible.</span>':'<span style="color:#b42318">'+esc(r.texte||'')+'</span>')+
      '<br>Exemplaire client : '+(rem?'remis le '+fr(rem.date)+' ('+esc(rem.preuve||rem.type)+')':sigRem?'téléchargé par le client le '+fr(sigRem)+' (enregistré par le serveur)':'<b>non confirmé</b>')+
      '<div class="row-actions" style="margin-top:6px"><button type="button" class="btn-ghost btn-sm" onclick="nxPartConclusion(\'devis\',\''+esc(d.id)+'\')">Préciser / modifier</button>'+
      '<button type="button" class="btn-ghost btn-sm" onclick="nxPartRemisePapier(\'devis\',\''+esc(d.id)+'\')">Exemplaire papier remis (accusé signé)</button></div>';
    el.insertBefore(b,el.firstChild);
  }

  /* ---------- dépannage chez un particulier : contrat AVANT travaux ---------- */
  function panneauDep(){
    var v=document.getElementById('v-depform'); if(!v||typeof curDep==='undefined'||!curDep) return;
    var old=document.getElementById('nxPartDep'); if(old) old.remove();
    if(curDep.cType==='Professionnel') return;
    var x=curDep, ca=x.contratAvant, c=conclusion(x);
    var b=document.createElement('div'); b.id='nxPartDep'; b.className='warnbox'; b.style.margin='0 0 12px';
    if(!ca||!ca.date) b.style.cssText+=';border-color:#e5484d;background:#fde8eb;color:#7a1020';
    b.innerHTML=(ca&&ca.date?'✅ <b>Contrat d\'intervention signé avant les travaux</b> le '+fr(ca.date)+' ('+esc(PREUVES[ca.preuve]||ca.preuve||'')+')':
        '🛑 <b>À faire AVANT de commencer</b> : faire signer au client le <b>contrat d\'intervention</b> (dépannage, réparation ou entretien chez un particulier : obligatoire dès le premier euro — arrêté du 24/01/2017).')+
      '<br>Contrat : '+esc(MODES[c.mode])+(c.urgence?' — <b>urgence</b> demandée par le client':'')+(x.contratAvantManquant?'<br><b>Facturé sans contrat préalable enregistré</b> (le '+fr(x.contratAvantManquant.date)+').':'')+
      '<div class="row-actions" style="margin-top:6px;flex-wrap:wrap"><button type="button" class="btn-ghost btn-sm" onclick="nxPartContratDep()">🖨 Contrat d\'intervention à signer</button>'+
      '<button type="button" class="btn-ghost btn-sm" onclick="nxPartContratSigne()">Contrat signé par le client</button>'+
      '<button type="button" class="btn-ghost btn-sm" onclick="nxPartConclusion(\'dep\',\''+esc(x.id)+'\')">Lieu / urgence</button></div>';
    var head=v.querySelector('.flexhead'); if(head&&head.nextSibling) v.insertBefore(b,head.nextSibling); else v.insertBefore(b,v.firstChild);
  }
  window.nxPartContratSigne=function(){
    if(typeof curDep==='undefined'||!curDep) return; try{ formToDep(); }catch(e){}
    var d=prompt('Date de signature du contrat d\'intervention par le client (jj/mm/aaaa) :',fr(today())); if(d==null) return;
    var pv=prompt('Preuve : 1 = papier signé, 2 = signature en ligne, 3 = accord écrit','1'); if(pv==null) return;
    curDep.contratAvant={date:(window.nxToISO?nxToISO(d):'')||today(),preuve:{'1':'papier','2':'signature_en_ligne','3':'ecrit'}[String(pv).trim()]||'papier',at:Date.now()};
    try{ saveDep(); }catch(e){ var i=DEP.findIndex(function(o){ return o.id===curDep.id; }); if(i>=0) DEP[i]=curDep; else DEP.push(curDep); save(LS.dep,DEP); }
    try{ loadDepForm(); }catch(e){} say('Contrat d\'intervention enregistré');
  };
  /* contrat d'intervention (arrêté du 24/01/2017, art. 2 et 4 ; L221-5 si hors établissement) */
  window.nxPartContratDep=function(){
    if(typeof curDep==='undefined'||!curDep) return; try{ formToDep(); }catch(e){}
    var x=curDep, E={}; try{ E=P.entreprise||{}; }catch(e){}
    var c={}; try{ c=computeDep(x); }catch(e){}
    var fr293=(function(){ try{ return P.regimeTVA!=='assujetti'; }catch(e){ return true; } })(), tva=fr293?0:(Number(P.tva)||0);
    var lignes=[]; (c.moRows||[]).forEach(function(r){ lignes.push([r[0],'',r[1]]); });
    if(c.maj) lignes.push(['Majoration ('+(c.majPct||0)+' %)','',c.maj]);
    if(c.depl) lignes.push([c.deplLbl||'Frais de déplacement','',c.depl]);
    if(c.consoV) lignes.push([c.consoLbl||'Consommables','',c.consoV]);
    (c.pieces||[]).forEach(function(p){ lignes.push([p.nom,(Number(p.qte)||0)+' × '+money(Number(p.vente)||0),(Number(p.vente)||0)*(Number(p.qte)||0)]); });
    var ht=Number(c.totalHT)||0, ttc=ht*(1+tva/100), cc=conclusion(x);
    var td='style="border:1px solid #ccc;padding:6px 8px"';
    var html='<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:780px;font-size:12px">'+
      '<div style="display:flex;justify-content:space-between;border-bottom:2px solid #c8102e;padding-bottom:8px;margin-bottom:10px"><div><b style="font-size:16px">'+esc(E.nom||'—')+'</b><br>'+esc([E.adresse,E.cp,E.ville].filter(Boolean).join(' '))+(E.siret?'<br>SIRET : '+esc(E.siret):'')+(E.tel?'<br>Tél : '+esc(E.tel):'')+'</div>'+
      '<div style="text-align:right">Contrat établi le <b>'+fr(today())+'</b></div></div>'+
      '<h2 style="font-size:15px;margin:6px 0">Contrat d\'intervention — dépannage, réparation ou entretien à domicile (avant travaux)</h2>'+
      '<p><b>Client</b> : '+esc(x.cNom||'')+'<br><b>Lieu d\'intervention</b> : '+esc([x.cAdr,x.cVille].filter(Boolean).join(' '))+'</p>'+
      '<p><b>Nature exacte des travaux</b> : '+esc(x.desc||x.panne||'à préciser avant de commencer')+'</p>'+
      '<p><b>Tarifs</b> : taux horaire '+money((Number(c.rate)||0)*(1+tva/100))+' TTC'+(fr293?' (TVA non applicable, art. 293 B du CGI)':'')+' ; temps estimé : '+(Number(c.heures)||0)+' h ; '+
        'le temps est compté sur place, de l\'arrivée à la fin de l\'intervention'+(c.depl?' ; frais de déplacement : '+money(c.depl*(1+tva/100))+' TTC':'')+'.</p>'+
      '<table style="width:100%;border-collapse:collapse;margin:8px 0"><tr><th '+td+'>Prestation / produit</th><th '+td+'>Quantité × prix unitaire</th><th '+td+'>Montant HT</th></tr>'+
        lignes.map(function(l){ return '<tr><td '+td+'>'+esc(l[0])+'</td><td '+td+'>'+esc(l[1])+'</td><td '+td+' align="right">'+money(l[2])+'</td></tr>'; }).join('')+
        '<tr><td '+td+' colspan="2" align="right"><b>Total HT</b></td><td '+td+' align="right"><b>'+money(ht)+'</b></td></tr>'+
        (fr293?'<tr><td '+td+' colspan="3">TVA non applicable, art. 293 B du CGI — <b>Total à payer : '+money(ht)+'</b></td></tr>':'<tr><td '+td+' colspan="2" align="right">TVA '+tva+' %</td><td '+td+' align="right">'+money(ttc-ht)+'</td></tr><tr><td '+td+' colspan="2" align="right"><b>Total TTC</b></td><td '+td+' align="right"><b>'+money(ttc)+'</b></td></tr>')+
      '</table>'+
      '<p>Ce document est <b>gratuit</b>. Offre valable le jour de son établissement. Toute prestation supplémentaire fera l\'objet d\'un nouvel accord écrit avant exécution.</p>'+
      (cc.urgence?'<p><b>Urgence</b> : le client demande expressément des travaux urgents ; seuls les pièces et travaux strictement nécessaires à l\'urgence sont réalisés.</p>':'')+
      (cc.mode!=='locaux'&&!cc.urgence&&typeof window.nxRetractationHTML==='function'?window.nxRetractationHTML({num:'Contrat d\'intervention du '+fr(today())},cc.mode):'')+
      '<div style="display:flex;gap:10px;margin-top:12px"><div style="flex:1;border:1px solid #bbb;padding:8px;min-height:70px">Bon pour accord — date et signature du client :</div><div style="flex:1;border:1px solid #bbb;padding:8px;min-height:70px">Exemplaire client remis le ………… — signature du client :</div></div>'+
      '<div style="font-size:9.5px;color:#666;margin-top:8px">Contenu établi d\'après l\'arrêté du 24 janvier 2017 (art. 2 et 4) relatif à la publicité des prix des prestations de dépannage, de réparation et d\'entretien.</div></div>';
    var el=document.getElementById('devisDoc'); if(!el) return; el.innerHTML=html; window.print();
  };

  /* ---------- branchement ---------- */
  function boot(){
    var pf=window.payerFacture; if(typeof pf==='function'&&!pf._nxpart){ var w1=function(kind,id,which){ var quoi=kind==='devis'?(which==='acompte'?'l\'acompte':'la facture'):'cette facture'; return garderPaiement(kind,id,pf,this,arguments,quoi); }; w1._nxpart=true; w1._nxem=pf._nxem; window.payerFacture=w1; }
    var pd=window.payDep; if(typeof pd==='function'&&!pd._nxpart){ var w2=function(id){ var x=(DEP||[]).find(function(o){ return o.id===id; }); if(x&&x.statut==='payee') return pd.apply(this,arguments); return garderPaiement('dep',id,pd,this,arguments,'l\'intervention'); }; w2._nxpart=true; w2._nxem=pd._nxem; window.payDep=w2; }
    /* relance de paiement par mail : c'est une demande de paiement */
    var mr=window.mailRelancePaiement; if(typeof mr==='function'&&!mr._nxpart){ var w5=function(kind,id){ var r=regle(kind,objet(kind,id));
        if(!r.ok){ alert('Relance non préparée : '+(r.texte||'contrat à préciser')+'\n\nUne relance est une demande de paiement.'); if(r.motif!=='delai') window.nxPartConclusion(kind,id); return; }
        return mr.apply(this,arguments); }; w5._nxpart=true; window.mailRelancePaiement=w5; }
    /* location : le chèque de caution peut être une « contrepartie » (L221-10) — à confirmer */
    var ml=window.mailLoc; if(typeof ml==='function'&&!ml._nxpart){ var w6=function(id){ var r=regle('loc',objet('loc',id));
        if(!r.ok&&!confirm('⚠ '+(r.texte||'Contrat de location à préciser')+'\n\nLe chèque de caution demandé dans ce mail pourrait être considéré comme une « contrepartie » reçue avant la fin du délai (art. L221-10) — point à confirmer.\n\nPréparer le mail quand même ?')) return;
        return ml.apply(this,arguments); }; w6._nxpart=true; window.mailLoc=w6; }
    var rf=window.renderFBloc; if(typeof rf==='function'&&!rf._nxpart){ var w3=function(){ var r=rf.apply(this,arguments); try{ panneauDevis(); }catch(e){} return r; }; w3._nxpart=true; window.renderFBloc=w3; }
    var ld=window.loadDepForm; if(typeof ld==='function'&&!ld._nxpart){ var w4=function(){ var r=ld.apply(this,arguments); try{ panneauDep(); }catch(e){} return r; }; w4._nxpart=true; window.loadDepForm=w4; }
    var tries=0; (function wait(){ if(typeof window.printDevis==='function'&&window.printDevis._nxs){ envelopperImpression(); return; } if(++tries<60) setTimeout(wait,150); else envelopperImpression(); })();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
