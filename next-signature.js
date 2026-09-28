/* ============================================================
   ClimPilot Next — next-signature.js  (couche additive)
   SIGNATURE EN LIGNE des devis (et des fiches d'intervention fluides).
   1. « ✍️ Faire signer en ligne » : fige le document tel qu'imprimé (même
      rendu que le PDF), l'envoie au serveur (empreinte SHA-256 calculée
      côté serveur), crée un lien unique signer.html#t=… à envoyer par
      mail ou SMS. Le devis passe en « Envoyé ».
   2. Le client lit, coche « Bon pour accord », signe au doigt.
   3. ClimPilot relève les signatures : devis → « Accepté » + signature
      ajoutée au PDF ; refus → « Refusé ». Une tâche est créée.
   Chargé après next-assistant.js.
   ============================================================ */
(function(){
  'use strict';
  var TABLE='climpilot_signatures';
  var BASE=(function(){ try{ var u=new URL('signer.html', location.href); return u.href.split('#')[0].split('?')[0]; }catch(e){ return 'https://gablry8.github.io/cp-gl2607/signer.html'; } })();
  if(!/^https:\/\//.test(BASE)) BASE='https://gablry8.github.io/cp-gl2607/signer.html';
  var PENDING=[];

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function toastX(m,t){ try{ if(window.nxToast) return window.nxToast(m,t); }catch(e){} try{ toast(m); }catch(e){} }
  function cloudOk(){ try{ return !!(sb && SESS && SESS.user); }catch(e){ return false; } }
  function fmt(ts){ try{ return new Date(ts).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}); }catch(e){ return ''; } }

  /* rendu du document sans ouvrir l'aperçu (on neutralise window.print le temps de la génération) */
  function capture(fn){
    var real=window.print, html='';
    window.print=function(){};
    try{ fn(); html=(document.getElementById('devisDoc')||{}).innerHTML||''; }
    finally{ window.print=real; }
    return html;
  }
  window.nxsCapture = capture;

  function civ(nom){ nom=String(nom||'').trim(); return /^(m\.|mme|mr|monsieur|madame|mlle)\b/i.test(nom) ? nom.replace(/^mme\.?\s*/i,'Madame ').replace(/^(m\.|mr\.?)\s*/i,'Monsieur ') : ''; }
  function mailText(o){
    var c=civ(o.client), bj='Bonjour'+(c?' '+c:'')+',';
    if(o.type==='fluide') return bj+'\n\nSuite à mon intervention, voici la fiche d\'intervention n° '+o.num+' relative aux fluides frigorigènes de votre installation. La réglementation impose qu\'elle soit signée par vous et par moi, et conservée 5 ans.\n\nVous pouvez la consulter et la signer en ligne, depuis votre téléphone ou votre ordinateur :\n'+o.url+'\n\nMerci d\'avance, et n\'hésitez pas si vous avez une question.\n\nBien cordialement,\nGabriel Leroy';
    return bj+'\n\nComme convenu, voici votre devis n° '+o.num+(o.titre?' ('+o.titre+')':'')+'. Vous pouvez le consulter et, s\'il vous convient, le signer en ligne depuis votre téléphone ou votre ordinateur :\n'+o.url+'\n\nJe reste à votre disposition pour toute question ou ajustement.\n\nBien cordialement,\nGabriel Leroy';
  }
  function smsText(o){ return 'Bonjour, voici '+(o.type==='fluide'?'la fiche d\'intervention n° ':'votre devis n° ')+o.num+' à consulter et signer en ligne : '+o.url+' — Gabriel Leroy'; }

  /* --------- création d'un lien --------- */
  function createLink(o){
    if(!cloudOk()) return Promise.resolve({error:{message:'Connecte-toi au cloud pour envoyer un lien de signature.'}});
    if(!o.html || o.html.length<50) return Promise.resolve({error:{message:'Document vide.'}});
    /* un nouveau lien remplace les liens encore en attente pour ce document */
    return sb.from(TABLE).update({statut:'annule'}).eq('doc_id',o.docId).eq('doc_type',o.type).eq('statut','en_attente').then(function(){
      return sb.from(TABLE).insert({user_id:SESS.user.id,doc_type:o.type,doc_id:o.docId,doc_num:o.num,titre:o.titre||null,client_nom:o.client||null,montant_ttc:o.montant!=null?Math.round(o.montant*100)/100:null,doc_html:o.html}).select('token,doc_hash,expires_at').single();
    });
  }

  function showShare(o){
    var old=document.getElementById('nxsModal'); if(old) old.remove();
    var m=document.createElement('div'); m.id='nxsModal'; m.className='nxs-ov';
    var mail='mailto:'+encodeURIComponent(o.email||'')+'?subject='+encodeURIComponent((o.type==='fluide'?'Fiche d\'intervention n° ':'Votre devis n° ')+o.num+' — signature en ligne')+'&body='+encodeURIComponent(mailText(o));
    var sms='sms:'+encodeURIComponent((o.tel||'').replace(/\s/g,''))+(/iPhone|iPad|Mac/.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(smsText(o));
    m.innerHTML='<div class="nxs-box"><div class="nxs-hd"><b>✍️ Lien de signature prêt</b><button class="iconbtn" onclick="document.getElementById(\'nxsModal\').remove()">✕</button></div>'+
      '<p class="nxs-sub">'+esc(o.type==='fluide'?'Fiche':'Devis')+' <b>'+esc(o.num)+'</b> — '+esc(o.client||'')+'. Le document est figé tel quel : si tu le modifies, renvoie un nouveau lien (l\'ancien sera désactivé).</p>'+
      '<input class="nxs-url" readonly value="'+esc(o.url)+'" onclick="this.select()">'+
      '<div class="nxs-act">'+
        '<a class="nx-sbtn mar" href="'+esc(mail)+'">✉ Envoyer par mail</a>'+
        '<a class="nx-sbtn mar" href="'+esc(sms)+'">💬 SMS</a>'+
        '<button class="nx-sbtn" id="nxsCopy">Copier le lien</button>'+
        '<a class="nx-sbtn" href="'+esc(o.url)+'" target="_blank" rel="noopener">Voir la page client</a></div>'+
      '<p class="nxs-sub" style="margin-top:10px">Valable 90 jours. Tu seras prévenu ici dès que le client signe ou décline.</p></div>';
    document.body.appendChild(m);
    document.getElementById('nxsCopy').onclick=function(){ try{ navigator.clipboard.writeText(o.url); toastX('📋 Lien copié','ok'); }catch(e){ toastX('Copie impossible','warn'); } };
  }

  /* Contrat conclu à distance avec un particulier : information sur le droit de rétractation (14 jours)
     + formulaire type (Code de la consommation, art. L221-5 et annexe de l'art. R221-1). Source : service-public.fr F10485 */
  function retractation(d){
    var E=(P&&P.entreprise)||{}, pro=[E.nom,[E.adresse,E.cp,E.ville].filter(Boolean).join(' '),E.email].filter(Boolean).join(' — ');
    var st='font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#222;line-height:1.45';
    return '<div data-retractation="1" style="'+st+';margin-top:16px;border-top:2px solid #1f4e79;padding-top:8px;page-break-before:auto">'+
      '<b style="font-size:11px">Information sur le droit de rétractation (client particulier — contrat conclu à distance)</b><br>'+
      'Vous disposez d\'un délai de <b>14 jours</b> à compter de la signature du présent devis pour vous rétracter, sans avoir à justifier de motif ni à payer de pénalité. '+
      'Pour l\'exercer, notifiez votre décision par une déclaration dénuée d\'ambiguïté (courrier ou e-mail) à : '+esc(pro||'l\'entreprise')+', ou utilisez le formulaire ci-dessous. '+
      'Si vous demandez expressément que les travaux commencent avant la fin de ce délai, vous devrez, en cas de rétractation, payer un montant proportionnel aux travaux déjà réalisés ; '+
      'une prestation entièrement exécutée avant la fin du délai avec votre accord exprès ne peut plus faire l\'objet d\'une rétractation. '+
      'Les travaux de réparation urgents que vous avez expressément demandés sont exclus du droit de rétractation, dans la limite des pièces et travaux strictement nécessaires.'+
      '<div style="margin-top:8px;border:1px dashed #888;padding:8px"><b>Formulaire de rétractation</b> (à compléter et renvoyer uniquement si vous souhaitez vous rétracter)<br>'+
      'À l\'attention de '+esc(pro||'l\'entreprise')+' :<br>Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous : devis n° '+esc(d.num||'')+'<br>'+
      'Signé le : ………………… &nbsp; Nom du consommateur : ………………………………<br>Adresse du consommateur : ……………………………………………………………<br>'+
      'Signature du consommateur (uniquement en cas de notification sur papier) : ………………… &nbsp; Date : …………………</div></div>';
  }

  /* --------- devis --------- */
  window.nxsSendDevis = function(){
    try{
      if(typeof cur==='undefined' || !cur){ toastX('Ouvre d\'abord un devis','warn'); return; }
      formToDevis();
      if(!String(cur.cNom||'').trim()){ toastX('Renseigne le client avant d\'envoyer le devis','warn'); return; }
      var c=compute(cur);
      var html=capture(function(){ window.printDevis(); });
      /* le devis passe en « Envoyé » et est enregistré, sans quitter le formulaire */
      if(cur.statut==='brouillon'||cur.statut==='verifier'||cur.statut==='pret'||!cur.statut){ cur.statut='envoye'; }
      if(!cur.sentAt) cur.sentAt=Date.now();
      try{ upsertClient(); }catch(e){}
      var i=DEVIS.findIndex(function(d){ return d.id===cur.id; }); if(i>=0) DEVIS[i]=cur; else DEVIS.push(cur);
      save(LS.devis,DEVIS); try{ updateBadges(); }catch(e){}
      var st=document.getElementById('f_statut'); if(st) st.value=cur.statut;
      try{ document.getElementById('wizStatus').innerHTML=statusTag(cur.statut); }catch(e){}
      if(cur.cType!=='Professionnel') html+=retractation(cur);
      var o={type:'devis',docId:cur.id,num:cur.num,client:cur.cNom,titre:cur.type+(cur.cVille?' — '+cur.cVille:''),montant:c.totalTTC,html:html,email:cur.cMail,tel:cur.cTel};
      toastX('Préparation du lien…');
      createLink(o).then(function(r){
        if(!r || r.error || !r.data){ toastX('⚠ '+((r&&r.error&&r.error.message)||'Lien impossible'),'warn'); return; }
        cur.signLink={token:r.data.token,at:Date.now(),hash:r.data.doc_hash};
        var j=DEVIS.findIndex(function(d){ return d.id===cur.id; }); if(j>=0){ DEVIS[j].signLink=cur.signLink; save(LS.devis,DEVIS); }
        o.url=BASE+'#t='+r.data.token; showShare(o); refresh();
      });
    }catch(e){ toastX('⚠ '+(e.message||e),'warn'); }
  };

  /* --------- fiche fluide (signature du détenteur) --------- */
  window.nxsSendFlu = function(id){
    try{
      var f=(FLU||[]).find(function(x){ return x.id===id; }); if(!f){ toastX('Enregistre d\'abord la fiche','warn'); return; }
      var html=capture(function(){ window.printFicheFlu(id); });
      var cl=(CLIENTS||[]).find(function(c){ return (c.nom||'').toLowerCase()===(f.client||'').toLowerCase(); })||{};
      var o={type:'fluide',docId:f.id,num:f.num,client:f.client,titre:'Intervention du '+new Date((f.date||'')+'T12:00:00').toLocaleDateString('fr-FR')+' — '+(f.fluide||''),montant:null,html:html,email:cl.mail,tel:cl.tel};
      createLink(o).then(function(r){
        if(!r || r.error || !r.data){ toastX('⚠ '+((r&&r.error&&r.error.message)||'Lien impossible'),'warn'); return; }
        o.url=BASE+'#t='+r.data.token; showShare(o); refresh();
      });
    }catch(e){ toastX('⚠ '+(e.message||e),'warn'); }
  };

  /* --------- relevé des signatures --------- */
  function applySig(s){
    var sig={at:s.signed_at,nom:s.signer_nom,hash:s.doc_hash,png:s.signature_png||null,token:s.token,ip:s.signer_ip||null};
    if(s.doc_type==='devis'){
      var d=(DEVIS||[]).find(function(x){ return x.id===s.doc_id; }); if(!d) return false;
      if(s.statut==='signe'){ d.statut='accepte'; d.signature=sig; d.acceptedAt=Date.parse(s.signed_at)||Date.now(); }
      else if(s.statut==='refuse'){ d.statut='refuse'; d.refus={at:s.signed_at,nom:s.signer_nom,motif:s.motif_refus||''}; }
      save(LS.devis,DEVIS);
      try{ if(typeof cur!=='undefined'&&cur&&cur.id===d.id){ cur.statut=d.statut; cur.signature=d.signature; cur.refus=d.refus; } }catch(e){}
      try{ updateBadges(); }catch(e){}
      return true;
    }
    if(s.doc_type==='fluide'){
      var f=(FLU||[]).find(function(x){ return x.id===s.doc_id; }); if(!f) return false;
      if(s.statut==='signe') f.sigDetenteur=sig; else f.refusDetenteur={at:s.signed_at,nom:s.signer_nom,motif:s.motif_refus||''};
      save('cp2_fluides',FLU); return true;
    }
    return false;
  }
  function refresh(){
    if(!cloudOk()) return Promise.resolve();
    return sb.from(TABLE).select('token,doc_type,doc_id,doc_num,client_nom,statut,created_at,vu_at,signed_at,signer_nom,signature_png,signer_ip,doc_hash,motif_refus,applique,expires_at')
      .in('statut',['en_attente','signe','refuse']).order('created_at',{ascending:false}).limit(100)
      .then(function(r){
        if(!r || r.error) return;
        var rows=r.data||[], done=[];
        rows.filter(function(s){ return (s.statut==='signe'||s.statut==='refuse') && !s.applique; }).forEach(function(s){
          if(applySig(s)){ done.push(s.token);
            toastX(s.statut==='signe'?('✍️ '+(s.doc_type==='devis'?'Devis ':'Fiche ')+(s.doc_num||'')+' signé par '+s.signer_nom):('Devis '+(s.doc_num||'')+' décliné par '+s.signer_nom),s.statut==='signe'?'ok':'warn'); }
        });
        PENDING=rows.filter(function(s){ return s.statut==='en_attente' && Date.parse(s.expires_at)>Date.now(); });
        render();
        if(done.length) return sb.from(TABLE).update({applique:true}).in('token',done);
      }).catch(function(){});
  }
  window.nxsRefresh = refresh;
  window.nxsPendingList = function(){ return PENDING.slice(); };

  window.nxsCancel = function(token){
    if(!confirm('Désactiver ce lien de signature ?')) return;
    sb.from(TABLE).update({statut:'annule'}).eq('token',token).then(function(){ toastX('Lien désactivé'); refresh(); });
  };
  window.nxsShare = function(token){
    var s=PENDING.find(function(x){ return x.token===token; }); if(!s) return;
    var d=s.doc_type==='devis'?(DEVIS||[]).find(function(x){ return x.id===s.doc_id; }):null;
    var cl=(CLIENTS||[]).find(function(c){ return (c.nom||'').toLowerCase()===(s.client_nom||'').toLowerCase(); })||{};
    showShare({type:s.doc_type,num:s.doc_num,client:s.client_nom,titre:d?d.type:'',email:(d&&d.cMail)||cl.mail,tel:(d&&d.cTel)||cl.tel,url:BASE+'#t='+s.token});
  };

  function render(){
    var host=document.getElementById('nxsPending'); if(!host) return;
    if(!PENDING.length){ host.innerHTML=''; return; }
    host.innerHTML='<div class="card"><h2>✍️ En attente de signature</h2>'+PENDING.map(function(s){
      return '<div class="recap-line"><div style="min-width:0"><b>'+esc((s.doc_type==='devis'?'Devis ':'Fiche ')+(s.doc_num||''))+'</b> — '+esc(s.client_nom||'')+
        '<div class="sub2">envoyé le '+esc(fmt(s.created_at))+' · '+(s.vu_at?'👁 ouvert le '+esc(fmt(s.vu_at)):'pas encore ouvert')+'</div></div>'+
        '<div class="row-actions"><button class="nx-sbtn" onclick="nxsShare(\''+s.token+'\')">Renvoyer</button><button class="nx-sbtn ref" onclick="nxsCancel(\''+s.token+'\')">Désactiver</button></div></div>';
    }).join('')+'</div>';
  }

  /* --------- la signature apparaît sur le PDF du devis --------- */
  function sigBlock(sig, label){
    return '<div style="margin-top:14px;border:1.5px solid #1e7a4c;border-radius:8px;padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#16263a;page-break-inside:avoid">'+
      '<b style="color:#1e7a4c">✔ '+label+' — signé électroniquement</b><br>Par <b>'+esc(sig.nom)+'</b> le '+esc(new Date(sig.at).toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short'}))+
      (sig.png?'<br><img src="'+esc(sig.png)+'" alt="signature" style="height:60px;margin:6px 0">':'')+
      '<br><span style="color:#5f6f84">Mention : « Bon pour accord ». Empreinte SHA-256 du document signé : '+esc(sig.hash||'')+' — signature électronique (art. 1366-1367 C. civ.), preuve conservée par ClimPilot (horodatage, IP, navigateur).</span></div>';
  }
  window.nxsSigBlock = sigBlock;
  function wrapPrintDevis(){
    if(typeof window.printDevis!=='function' || window.printDevis._nxs) return;
    var orig=window.printDevis;
    var w=function(){
      var real=window.print, fired=false;
      window.print=function(){ fired=true; };
      try{ orig.apply(this,arguments); } finally{ window.print=real; }
      try{
        var d=(typeof cur!=='undefined')?cur:null, doc=document.getElementById('devisDoc');
        if(d && d.signature && doc) doc.insertAdjacentHTML('beforeend', sigBlock(d.signature,'Devis n° '+(d.num||'')+' accepté'));
      }catch(e){}
      if(fired) window.print();
    };
    w._nxs=true; window.printDevis=w;
  }

  var CSS='.nxs-ov{position:fixed;inset:0;z-index:99990;background:rgba(10,25,45,.45);display:flex;align-items:center;justify-content:center;padding:16px}'+
    '.nxs-box{background:#fff;border-radius:14px;max-width:520px;width:100%;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)}'+
    '.nxs-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.nxs-sub{font-size:12.5px;color:var(--muted,#5f6f84);margin:4px 0}'+
    '.nxs-url{width:100%;box-sizing:border-box;padding:10px;border:2px solid var(--line2,#cfd8e3);border-radius:10px;font:inherit;font-size:13px;margin:8px 0}'+
    '.nxs-act{display:flex;flex-wrap:wrap;gap:8px}.nxs-act a{text-decoration:none;display:inline-flex;align-items:center}';

  function boot(tries){
    tries=tries||0;
    if(typeof window.printDevis!=='function' || !document.getElementById('v-wizard')){ if(tries<40) setTimeout(function(){ boot(tries+1); },150); return; }
    try{
      if(!document.getElementById('nxsStyle')){ var st=document.createElement('style'); st.id='nxsStyle'; st.textContent=CSS; document.head.appendChild(st); }
      /* bouton dans le récapitulatif du devis et dans l'en-tête */
      var mailBtn=document.querySelector('#v-wizard button[onclick="mailDevis()"]');
      if(mailBtn && !document.getElementById('nxsBtn')){ var b=document.createElement('button'); b.id='nxsBtn'; b.className='btn-pri'; b.type='button'; b.textContent='✍️ Faire signer en ligne'; b.onclick=function(){ window.nxsSendDevis(); }; mailBtn.parentNode.insertBefore(b, mailBtn.nextSibling); }
      var hdr=document.querySelector('#v-wizard .flexhead .row-actions');
      if(hdr && !document.getElementById('nxsBtnTop')){ var b2=document.createElement('button'); b2.id='nxsBtnTop'; b2.className='btn-ghost btn-sm'; b2.type='button'; b2.textContent='✍️ Signature'; b2.onclick=function(){ window.nxsSendDevis(); }; hdr.insertBefore(b2, hdr.lastElementChild); }
      /* suivi dans l'écran Assistant */
      var ass=document.getElementById('v-nx_assist');
      if(ass && !document.getElementById('nxsPending')){ var p=document.createElement('div'); p.id='nxsPending'; ass.appendChild(p); }
      wrapPrintDevis();
      var _go=window.go;
      window.go=function(v){ var r=_go.apply(this,arguments); try{ if(v==='nx_assist'||v==='tous'||v==='dash') refresh(); }catch(e){} return r; };
      var w=0, iv=setInterval(function(){ w++; if(cloudOk()||w>30){ clearInterval(iv); refresh(); } },1000);
      setInterval(function(){ if(document.visibilityState==='visible') refresh(); }, 120000);
      document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') refresh(); });
    }catch(e){ try{ console.error('ClimPilot next-signature', e); }catch(_){} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,0); });
  else setTimeout(boot,0);
})();
