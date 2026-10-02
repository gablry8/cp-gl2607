/* ============================================================
   ClimPilot Next — next-superpdp.js  (couche additive, 01/10/2026)
   PLATEFORME AGRÉÉE : SUPER PDP, branchée sur ClimPilot.
   - Connexion : tu colles ton client_id / client_secret une fois ; ils
     sont vérifiés puis gardés CHIFFRÉS sur ton serveur (jamais dans l'app).
   - Envoyer une facture ou un avoir : ClimPilot fabrique le fichier
     officiel, le fait CONTRÔLER par la plateforme (format, norme
     européenne, règles françaises) et ne l'envoie que s'il est conforme.
   - Suivi : statut de chaque document (déposé, reçu, approuvé, refusé,
     encaissé…), historique, copie déposée.
   - Factures reçues de tes fournisseurs : liste, téléchargement,
     « approuver » / « refuser ».
   - Annuaire : vérifier qu'un client professionnel peut recevoir.
   - Bac à sable (compte de test) : l'envoi se fait entre les deux
     sociétés fictives de test (vendeur = ta société de test, acheteur =
     l'autre), avec un numéro suffixé -TEST, pour ne rien mélanger.
   Particuliers : pas de facture électronique (e-reporting à partir du
   01/09/2027) ; seuls les clients professionnels avec SIREN partent.
   ============================================================ */
(function(){
  'use strict';
  var MK='cpnext_pdp';
  try{ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(MK)<0) SYNC_KEYS.push(MK); }catch(e){}
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function say(m){ try{ toast(m); }catch(e){} }
  function lsGet(k,fb){ try{ var v=localStorage.getItem(k); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
  function put(k,v){ try{ save(k,v); }catch(e){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } }
  function fr(iso){ try{ return iso?new Date(iso).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'; }catch(e){ return String(iso||''); } }
  function money(n){ try{ return eur(n); }catch(e){ return String(n); } }
  function M(){ var m=lsGet(MK,{}); if(!m||typeof m!=='object'||Array.isArray(m)) m={}; m.docs=m.docs||{}; return m; }
  function saveM(m){ put(MK,m); }
  window.nxPdpMap=M;

  /* ---------- statuts officiels ---------- */
  var ST={
    'api:uploaded':['Déposée','wait'],'api:invalid':['Refusée : non conforme','bad'],'api:validated':['Validée','wait'],'api:sent':['Transmise','wait'],
    'api:rejected':['Rejetée','bad'],'api:received':['Reçue','wait'],'api:acknowledged':['Prise en compte','wait'],'api:accepted':['Acceptée','ok'],
    'fr:200':['Déposée','wait'],'fr:201':['Émise par la plateforme','wait'],'fr:202':['Reçue par la plateforme du client','wait'],'fr:203':['Mise à disposition du client','wait'],
    'fr:204':['Prise en charge par le client','wait'],'fr:205':['Approuvée','ok'],'fr:206':['Approuvée partiellement','warn'],'fr:207':['En litige','bad'],'fr:208':['Suspendue','warn'],
    'fr:209':['Complétée','ok'],'fr:210':['Refusée par le client','bad'],'fr:211':['Paiement transmis','ok'],'fr:212':['Encaissée','ok'],'fr:213':['Rejetée (contrôle technique)','bad']
  };
  function lab(code,txt){ var s=ST[code]; return s?s[0]:(txt||code||'—'); }
  function cls(code){ var s=ST[code]; if(s) return s[1]; if(/rejected|refused|error|invalid/.test(code||'')) return 'bad'; return 'wait'; }
  function lastEv(evs){ evs=(evs||[]).slice().sort(function(a,b){ return String(a.created_at||a.at||'').localeCompare(String(b.created_at||b.at||'')); }); return evs[evs.length-1]||null; }
  var FINAL=/^(fr:205|fr:209|fr:210|fr:212|fr:213|api:invalid|api:rejected)$/;

  /* ---------- appel du serveur ---------- */
  function cloudOk(){ try{ return !!(sb&&SESS&&SESS.user); }catch(e){ return false; } }
  function api(body){
    if(!cloudOk()) return Promise.resolve({erreur:'hors_ligne',message:'Connecte-toi au cloud ClimPilot (identifiant en haut) pour utiliser la plateforme.'});
    return sb.functions.invoke('superpdp',{body:body}).then(function(r){
      if(r&&r.error){ var c=r.error.context; if(c&&typeof c.json==='function') return c.json().catch(function(){ return {erreur:'http',message:r.error.message||'Erreur'}; }); return {erreur:'reseau',message:'Serveur injoignable — vérifie ta connexion.'}; }
      return r.data||{erreur:'vide',message:'Réponse vide'};
    }).catch(function(){ return {erreur:'reseau',message:'Serveur injoignable — vérifie ta connexion.'}; });
  }
  window.nxPdpApi=api;
  var STATUS=null;
  function status(force){ if(STATUS&&!force) return Promise.resolve(STATUS); return api({action:'status'}).then(function(r){ STATUS=r; return r; }); }

  /* ---------- identités de test (bac à sable) ---------- */
  var TEST={'000000001':'Tricatel','000000002':'Burger Queen'};
  function testOverrides(co,num){
    var me=String(co.siren||'000000001'), other=me==='000000001'?'000000002':'000000001';
    return {seller:{nom:co.nom||TEST[me]||'Société de test',siret:me+'00000',adresse:co.adresse||'1 rue du Test',cp:co.cp||'75001',ville:co.ville||'Paris',email:''},
      buyer:{nom:TEST[other]+' (test)',siren:other,adr:'2 rue du Test',ville:'75002 Paris',type:'Professionnel',mail:''},suffix:'-TEST'+String(Date.now()).slice(-5)};
  }

  /* ---------- fenêtre générique ---------- */
  function modal(title,html,buttons){
    var m=document.getElementById('mPdp');
    if(!m){ m=document.createElement('div'); m.className='modal'; m.id='mPdp'; document.body.appendChild(m); }
    m.innerHTML='<div class="box" style="max-width:620px"><div class="hd"><b>'+esc(title)+'</b><button class="iconbtn" onclick="closeModal(\'mPdp\')">✕</button></div><div class="bd" id="mPdpBd">'+html+'</div>'+
      '<div class="navbtns">'+(buttons||'<button class="btn-ghost" onclick="closeModal(\'mPdp\')">Fermer</button>')+'</div></div>';
    m.classList.add('on'); return m;
  }
  function busy(t){ modal('Plateforme agréée','<div class="nxpdp-busy">⏳ '+esc(t)+'</div>',''); }
  function reportHTML(rep){
    var e=rep.erreurs||[], w=rep.avertissements||[];
    return (rep.is_valid?'<div class="nxd2-ok">✅ Fichier conforme'+(rep.profil?' ('+esc(rep.profil)+')':'')+'.</div>':'<div class="nxd2-warn red">⛔ Fichier refusé par le contrôle de la plateforme. À corriger :</div>')+
      (e.length?'<ul class="nxpdp-list">'+e.map(function(x){ return '<li>'+esc(x.message)+(x.location?'<div class="sub2">'+esc(x.location)+'</div>':'')+'</li>'; }).join('')+'</ul>':'')+
      (w.length?'<div class="sub" style="margin-top:6px"><b>Avertissements</b></div><ul class="nxpdp-list">'+w.map(function(x){ return '<li>'+esc(x.message)+'</li>'; }).join('')+'</ul>':'');
  }

  /* ---------- envoi d'une facture / d'un avoir ---------- */
  function docInfo(num){
    var inv=(window.nxInvoices?nxInvoices():[]).find(function(i){ return i.num===num; });
    if(inv) return {num:num,cli:inv.cli||{},montant:inv.montant,label:inv.label,annulee:inv.annulee};
    var av=(window.nxAvoirs?nxAvoirs():[]).find(function(a){ return a.num===num; });
    if(av) return {num:num,cli:av.cli||{},montant:av.montant,label:'Avoir sur '+av.facNum,avoir:true};
    return null;
  }
  function sirenOf(c){ var d=String((c&&c.siren)||'').replace(/\D/g,''); return d.length>=9?d.slice(0,9):''; }
  window.nxPdpSend=function(num,nat){
    var d=docInfo(num); if(!d){ say('Document introuvable'); return; }
    var figee=!!(window.nxEmisModele&&nxEmisModele(num));   /* 1.10 : facture figée à l'émission → nature fixée */
    if(/^[BSM]$/.test(nat||'')&&!figee){ var mm=M(); mm.docs[num]=mm.docs[num]||{envois:[]}; mm.docs[num].nature=nat; saveM(mm); }
    busy('Connexion à la plateforme…');
    status(true).then(function(st){
      if(st.erreur){ modal('Plateforme agréée','<div class="nxd2-warn red">'+esc(st.message||st.erreur)+'</div>'); return; }
      if(!st.connecte){ modal('Plateforme agréée','<p>La plateforme n\'est pas encore connectée.</p>','<button class="btn-ghost" onclick="closeModal(\'mPdp\')">Annuler</button><button class="btn-pri" onclick="closeModal(\'mPdp\');go(\'nx_pdp\')">Connecter SUPER PDP</button>'); return; }
      var sandbox=st.env!=='production', co=st.company||{};
      var pro=String(d.cli.type||'')==='Professionnel', siren=sirenOf(d.cli);
      if(!sandbox&&(!pro||!siren)){
        modal('Envoi par la plateforme','<div class="nxd2-warn">'+(pro?'Ce client professionnel n\'a pas de <b>SIREN</b> dans ClimPilot : ajoute-le sur sa fiche (ou dans le devis), il sert à trouver sa plateforme.':'Client <b>particulier</b> : une facture à un particulier ne passe pas par la plateforme. Envoie-lui le PDF comme d\'habitude.<br><span class="sub2">À partir du 01/09/2027, ses montants seront déclarés automatiquement (« e-reporting »).</span>')+'</div>');
        return;
      }
      return verifierAvantEnvoi(num,sandbox).then(function(stop){
      if(stop){ modal('Envoi impossible — '+num,'<div class="nxd2-warn red">'+stop+'</div>'); return; }
      var ov=sandbox?testOverrides(co,num):null;
      var xml=window.nxEinvXML?nxEinvXML(num,ov):null;
      var cadre=(/<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>([A-Z]\d)</.exec(xml||'')||[])[1]||'';
      if(!xml){ modal('Envoi','<div class="nxd2-warn red">Fichier impossible à fabriquer.</div>'); return; }
      busy('Contrôle du fichier par la plateforme (format, norme européenne, règles françaises)…');
      api({action:'validate',xml:xml,name:num}).then(function(v){
        if(v.erreur){ modal('Contrôle','<div class="nxd2-warn red">'+esc(v.message||v.erreur)+'</div>'); return; }
        var rep=v.rapport||{};
        if(!rep.is_valid){ modal('Contrôle — '+num,reportHTML(rep)+(sandbox?'<div class="sub2" style="margin-top:8px">Bac à sable : envoi entre sociétés de test.</div>':'')); return; }
        modal((sandbox?'TEST — ':'')+'Envoyer '+num,reportHTML(rep)+
          natureSel(num,cadre)+
          '<div class="recap-line" style="margin-top:8px"><div><b>'+esc(sandbox?ov.buyer.nom:(d.cli.nom||'—'))+'</b><div class="sub2">'+esc(d.label)+'</div></div><div><b>'+money(d.montant)+'</b></div></div>'+
          (sandbox?'<div class="nxd2-warn">Compte de <b>test</b> : le document part de ta société de test « '+esc(co.nom||'')+' » vers « '+esc(ov.buyer.nom)+' », numéro '+esc(num+ov.suffix)+'. Rien n\'est envoyé à ton vrai client.</div>':'<div class="nxd2-hint">Le document part au client par le circuit officiel. Une facture envoyée ne se retire pas : en cas d\'erreur, on fait un avoir.</div>'),
          '<button class="btn-ghost" onclick="closeModal(\'mPdp\')">Annuler</button><button class="btn-pri" id="nxpdpGo">'+(sandbox?'Envoyer le test':'Envoyer')+'</button>');
        document.getElementById('nxpdpGo').onclick=function(){
          busy('Envoi…');
          api({action:'send',xml:xml,external_id:(num+(ov&&ov.suffix||'')).slice(0,64)}).then(function(s){
            if(s.erreur){ modal('Envoi refusé','<div class="nxd2-warn red">'+esc(s.message||s.erreur)+(s.status?' <span class="sub2">(HTTP '+s.status+')</span>':'')+'</div>'); return; }
            var m=M(), le=lastEv(s.events);
            m.docs[num]=m.docs[num]||{envois:[]};
            m.docs[num].envois=(m.docs[num].envois||[]).concat([{id:s.id,env:sandbox?'sandbox':'production',at:new Date().toISOString(),ref:num+(ov&&ov.suffix||''),cadre:cadre,code:le?le.status_code:'api:uploaded',texte:le?le.status_text:''}]);
            saveM(m);
            modal('Envoyé','<div class="nxd2-ok">✅ '+esc(num)+' déposé sur la plateforme'+(sandbox?' (test)':'')+'. Statut : <b>'+esc(lab(le?le.status_code:'api:uploaded'))+'</b>.</div><div class="sub2">Le statut se met à jour dans « Facture électronique ».</div>');
            refreshView();
          });
        };
      });
      });
    });
  };
  /* 1.10 — garde-fous avant tout envoi (réponse : texte d'arrêt, ou null pour continuer) */
  var REJET=/^(fr:213|api:invalid|api:rejected)$/;
  function verifierAvantEnvoi(num,sandbox){
    var dbl=window.nxEmisDoublons?nxEmisDoublons():{};
    if(dbl[num]) return Promise.resolve('Le numéro <b>'+esc(num)+'</b> est porté par <b>deux documents différents</b> : envoi bloqué tant que le doublon n\'est pas tranché (registre des documents).');
    var e=window.nxEmisEntree?nxEmisEntree(num):null;
    if(!sandbox){
      if(/^TEST-/.test(num)||(e&&e.mode==='demo')) return Promise.resolve('Document de <b>démonstration</b> (série TEST) : il ne part jamais sur la plateforme réelle.');
      if(!e||e.origine!=='emis'||e.mode!=='reel') return Promise.resolve('Facture émise avant ClimPilot 1.10 (version <b>non figée</b>, reconstituée) : envoi réel bloqué. À voir avec ton comptable avant tout envoi (<i>à confirmer</i>).');
    }
    var prev=((M().docs[num]||{}).envois||[]).filter(function(x){ return sandbox?x.env==='sandbox':x.env==='production'; });
    if(sandbox||!prev.length) return assurer(num);
    /* déjà déposée en production : on relit le dernier statut avant d'autoriser quoi que ce soit */
    var last=prev[prev.length-1];
    busy('Vérification du statut du dépôt précédent…');
    return api({action:'invoice',id:last.id}).then(function(r){
      if(r&&!r.erreur){ var le=lastEv(r.events); if(le){ last.code=le.status_code; last.texte=le.status_text; last.maj=new Date().toISOString(); var mm=M(); mm.docs[num].envois[mm.docs[num].envois.length-1]=last; saveM(mm); } }
      else return 'Impossible de relire le statut du dépôt précédent ('+esc((r&&(r.message||r.erreur))||'réseau')+') : renvoi bloqué par prudence.';
      if(REJET.test(last.code||'')) return assurer(num);
      if(last.code==='fr:210') return 'Facture <b>refusée par le client</b> (fr:210). Ne pas la renvoyer telle quelle : traiter selon le motif du refus (correction, avoir ou échange avec le client — <i>à confirmer avec ton comptable</i>).';
      return 'Cette facture est <b>déjà déposée</b> sur la plateforme (statut : '+esc(lab(last.code,last.texte))+'). Un nouvel envoi créerait un second dépôt : renvoi bloqué. Seul un rejet technique (fr:213) permet de la renvoyer.';
    },function(){ return 'Statut du dépôt précédent illisible : renvoi bloqué par prudence.'; });
  }
  function assurer(num){ return (window.nxEmisAssurerFichiers?nxEmisAssurerFichiers(num):Promise.resolve()).then(function(){ return null; },function(){ return null; }); }
  var SITU={'1':'facture normale','2':'déjà payée','4':'définitive après acompte'};
  function natureSel(num,cadre){
    var n=cadre.charAt(0), s=cadre.charAt(1), T=window.nxEinvNatureTxt||{B:'livraison de biens',S:'prestation de services',M:'livraison de biens et prestation de services'};
    if(window.nxEmisModele&&nxEmisModele(num)) return '<div class="sub2" style="margin-top:8px">Nature de l\'opération : <b>'+esc(T[n]||n)+'</b> (cadre de facturation <b>'+esc(cadre)+'</b> — '+esc(SITU[s]||'')+'). '+
      'Elle est <b>figée à l\'émission</b> : elle fait partie de la facture (PDF et XML) et ne se change plus à l\'envoi. En cas d\'erreur : avoir, puis nouvelle facture.</div>';
    return '<div class="frm" style="margin-top:8px"><label class="full">Nature de l\'opération (cadre de facturation <b>'+esc(cadre)+'</b> — '+esc(SITU[s]||'')+')'+
      '<select onchange="nxPdpSend(\''+esc(num)+'\',this.value)">'+['M','S','B'].map(function(k){ return '<option value="'+k+'"'+(k===n?' selected':'')+'>'+k+' — '+T[k]+'</option>'; }).join('')+'</select></label></div>'+
      '<div class="sub2">Par défaut, la même nature que sur ta facture PDF. Si tu la changes, le fichier est recontrôlé.</div>';
  }
  window.nxPdpLastStatus=function(num){ var d=M().docs[num]; if(!d||!d.envois||!d.envois.length) return null; return d.envois[d.envois.length-1]; };

  /* ---------- statuts : mise à jour ---------- */
  function refreshStatuses(all){
    var m=M(), jobs=[];
    Object.keys(m.docs).forEach(function(n){ (m.docs[n].envois||[]).forEach(function(e){ if(all||!FINAL.test(e.code||'')) jobs.push(e); }); });
    jobs=jobs.slice(-25);
    return jobs.reduce(function(p,e){ return p.then(function(){ return api({action:'invoice',id:e.id}).then(function(r){ if(r&&!r.erreur){ var le=lastEv(r.events); if(le){ e.code=le.status_code; e.texte=le.status_text; e.maj=new Date().toISOString(); e.events=(r.events||[]).map(function(v){ return {code:v.status_code,texte:v.status_text,at:v.created_at}; }); } } }); }); },Promise.resolve())
      .then(function(){ saveM(m); return jobs.length; });
  }
  window.nxPdpRefresh=function(){ var b=document.getElementById('nxpdpRefBtn'); if(b){ b.disabled=true; b.textContent='Mise à jour…'; } refreshStatuses(true).then(function(n){ say(n?n+' statut(s) mis à jour':'Aucun envoi à suivre'); renderView(); }); };
  window.nxPdpHistory=function(num){
    var d=M().docs[num]; if(!d) return;
    modal('Historique — '+num,(d.envois||[]).slice().reverse().map(function(e){ return '<div class="card" style="margin:0 0 8px"><div><b>'+(e.env==='sandbox'?'TEST — ':'')+esc(e.ref||num)+'</b> · envoyé le '+fr(e.at)+'</div>'+
      ((e.events&&e.events.length)?'<ul class="nxpdp-list">'+e.events.map(function(v){ return '<li><span class="nxpdp-st '+cls(v.code)+'">'+esc(lab(v.code,v.texte))+'</span> <span class="sub2">'+fr(v.at)+'</span></li>'; }).join('')+'</ul>':'<div class="sub2">Statut : '+esc(lab(e.code,e.texte))+'</div>')+
      '<button class="btn-ghost btn-sm" onclick="nxPdpDownload('+Number(e.id)+',\''+esc(e.ref||num)+'\')">Copie déposée</button></div>'; }).join(''));
  };
  window.nxPdpDownload=function(id,name){
    say('Téléchargement…');
    api({action:'download',id:id}).then(function(r){
      if(r.erreur){ say('⚠ '+(r.message||r.erreur)); return; }
      var bin=atob(r.base64), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      var ext=/pdf/.test(r.type)?'.pdf':'.xml', a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([u],{type:r.type||'application/octet-stream'})); a.download=String(name||id)+ext; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); },1500);
    });
  };

  /* ---------- connexion ---------- */
  window.nxPdpConnect=function(){
    var id=(document.getElementById('nxpdpId')||{}).value||'', sec=(document.getElementById('nxpdpSec')||{}).value||'';
    var out=document.getElementById('nxpdpConnMsg'); if(out) out.innerHTML='<div class="nxpdp-busy">⏳ Vérification des identifiants auprès de SUPER PDP…</div>';
    api({action:'connect',client_id:id.trim(),client_secret:sec.trim()}).then(function(r){
      if(r.erreur){ if(out) out.innerHTML='<div class="nxd2-warn red">'+esc(r.message||r.erreur)+'</div>'; return; }
      STATUS={connecte:true,env:r.env,company:r.company};
      say('Plateforme connectée'+(r.env==='sandbox'?' (compte de test)':''));
      renderView();
    });
  };
  window.nxPdpDisconnect=function(){ if(!confirm('Déconnecter SUPER PDP ? Tes identifiants seront effacés du serveur. Les documents déjà envoyés restent sur la plateforme.')) return; api({action:'disconnect'}).then(function(){ STATUS={connecte:false}; renderView(); }); };

  /* ---------- annuaire ---------- */
  window.nxPdpLookup=function(){
    var n=((document.getElementById('nxpdpSiren')||{}).value||'').replace(/\D/g,''), out=document.getElementById('nxpdpDirOut');
    if(n.length!==9&&n.length!==14){ out.innerHTML='<div class="nxd2-warn">Tape un SIREN (9 chiffres) ou un SIRET (14).</div>'; return; }
    out.innerHTML='<div class="nxpdp-busy">⏳ Recherche dans l\'annuaire officiel…</div>';
    api({action:'directory',number:n}).then(function(r){
      if(r.erreur){ out.innerHTML='<div class="nxd2-warn red">'+esc(r.message||r.erreur)+'</div>'; return; }
      var co=(r.entreprises||[])[0]||{}, en=r.entrees||[];
      out.innerHTML=(co.formal_name||co.name?'<div><b>'+esc(co.formal_name||co.name)+'</b></div>':'')+
        (en.length?'<div class="nxd2-ok">✅ Peut recevoir des factures électroniques ('+en.length+' adresse(s) dans l\'annuaire).</div>':'<div class="nxd2-warn">Aucune adresse de réception trouvée dans l\'annuaire'+(r.erreur_annuaire?' ('+esc(r.erreur_annuaire)+')':'')+'. Avant le 01/09/2026 ou pour un particulier, c\'est normal.</div>');
    });
  };

  /* ---------- factures reçues ---------- */
  var RECU=null;
  window.nxPdpLoadReceived=function(){
    var box=document.getElementById('nxpdpRecu'); if(box) box.innerHTML='<div class="nxpdp-busy">⏳ Chargement…</div>';
    api({action:'list',direction:'in',limit:50}).then(function(r){ RECU=r; renderReceived(); });
  };
  function renderReceived(){
    var box=document.getElementById('nxpdpRecu'); if(!box) return;
    if(!RECU){ box.innerHTML='<button class="btn-ghost btn-sm" onclick="nxPdpLoadReceived()">Voir les factures reçues</button>'; return; }
    if(RECU.erreur){ box.innerHTML='<div class="nxd2-warn red">'+esc(RECU.message||RECU.erreur)+'</div>'; return; }
    var it=RECU.items||[];
    box.innerHTML=it.length?'<div class="scroll"><table><thead><tr><th class="l">Fournisseur</th><th class="l">N°</th><th class="l">Date</th><th>Montant</th><th class="l">Statut</th><th></th></tr></thead><tbody>'+it.map(function(x){ var le=lastEv(x.events.map(function(v){ return {status_code:v.code,status_text:v.texte,created_at:v.at}; }));
      return '<tr><td class="l"><b>'+esc(x.vendeur||'—')+'</b></td><td class="l">'+esc(x.numero||x.id)+'</td><td class="l">'+esc(x.date||'')+'</td><td>'+(x.total!=null?money(x.total):'—')+'</td><td class="l"><span class="nxpdp-st '+cls(le&&le.status_code)+'">'+esc(le?lab(le.status_code,le.status_text):'—')+'</span></td>'+
        '<td><button class="btn-ghost btn-sm" onclick="nxPdpDownload('+Number(x.id)+',\''+esc(x.numero||x.id)+'\')">Fichier</button> <button class="btn-ghost btn-sm" onclick="nxPdpDecide('+Number(x.id)+',\'fr:205\')">Approuver</button> <button class="btn-ghost btn-sm" onclick="nxPdpDecide('+Number(x.id)+',\'fr:210\')">Refuser</button></td></tr>'; }).join('')+'</tbody></table></div>'
      :'<div class="empty">Aucune facture reçue pour l\'instant.</div>';
  }
  window.nxPdpDecide=function(id,code){
    var reason=''; if(code==='fr:210'){ reason=prompt('Motif du refus (il est transmis au fournisseur) :',''); if(reason==null) return; if(!reason.trim()){ say('Motif obligatoire pour un refus'); return; } }
    else if(!confirm('Approuver cette facture ? Le fournisseur en est informé.')) return;
    api({action:'event',invoice_id:id,status_code:code,reason:reason}).then(function(r){ if(r.erreur){ say('⚠ '+(r.message||r.erreur)); return; } say(code==='fr:205'?'Facture approuvée':'Facture refusée'); nxPdpLoadReceived(); });
  };

  /* ---------- écran « Facture électronique » ---------- */
  function sentRows(){
    var m=M(), rows=[];
    Object.keys(m.docs).forEach(function(n){ var e=(m.docs[n].envois||[]).slice(-1)[0]; if(e) rows.push({num:n,e:e}); });
    return rows.sort(function(a,b){ return String(b.e.at).localeCompare(String(a.e.at)); });
  }
  function renderView(){
    var box=document.getElementById('nxpdp'); if(!box) return;
    if(!cloudOk()){ box.innerHTML=hero()+'<div class="card"><div class="nxd2-warn">Connecte-toi au cloud ClimPilot (bouton en haut) : la plateforme passe par ton serveur sécurisé.</div></div>'; return; }
    box.innerHTML=hero()+'<div class="card"><div class="nxpdp-busy">⏳ Vérification de la connexion…</div></div>';
    status(false).then(function(st){
      if(!document.getElementById('nxpdp')) return;
      var h=hero();
      if(st.erreur){ h+='<div class="card"><div class="nxd2-warn red">'+esc(st.message||st.erreur)+'</div><button class="btn-ghost btn-sm" onclick="nxPdpRender(true)">Réessayer</button></div>'; box.innerHTML=h; return; }
      if(!st.connecte){
        h+='<div class="card"><h2>🔌 Connecter SUPER PDP</h2><div class="sub" style="margin-bottom:8px">Sur ton espace SUPER PDP, crée une « application » (identifiants OAuth) et colle ici les deux codes. Ils sont vérifiés puis gardés <b>chiffrés sur ton serveur</b> : l\'app ne les garde pas.</div>'+
          '<div class="frm"><label class="full">client_id<input id="nxpdpId" autocomplete="off" spellcheck="false"></label><label class="full">client_secret<input id="nxpdpSec" type="password" autocomplete="off" spellcheck="false"></label></div>'+
          '<div class="row-actions" style="margin-top:10px"><button class="btn-pri" onclick="nxPdpConnect()">Connecter</button></div><div id="nxpdpConnMsg"></div>'+
          '<div class="sub2" style="margin-top:8px">Commence avec le compte de <b>test</b> (bac à sable) : gratuit, sans SIREN. Quand ton entreprise existera, tu remplaceras par les identifiants réels.</div></div>';
        box.innerHTML=h; return;
      }
      var co=st.company||{}, sandbox=st.env!=='production', rows=sentRows();
      h+='<div class="card"><div class="nxpdp-head"><div><h2 style="margin:0">'+(sandbox?'🧪 Connecté — compte de TEST':'✅ Connecté — compte réel')+'</h2><div class="sub2">'+esc(co.nom||'')+(co.siren?' · SIREN '+esc(co.siren):'')+' · identifiant '+esc(st.client_id||'')+'</div></div><button class="btn-ghost btn-sm" onclick="nxPdpDisconnect()">Déconnecter</button></div>'+
        (sandbox?'<div class="nxd2-hint" style="margin-top:6px">Bac à sable : tes envois partent entre sociétés fictives (« '+esc(co.nom||'')+' » → l\'autre société de test). Idéal pour t\'entraîner.</div>':'')+'</div>';
      h+='<div class="card"><div class="nxpdp-head"><h2 style="margin:0">📤 Envoyés</h2><button class="btn-ghost btn-sm" id="nxpdpRefBtn" onclick="nxPdpRefresh()">Actualiser les statuts</button></div>'+
        (rows.length?'<div class="scroll"><table><thead><tr><th class="l">Document</th><th class="l">Envoyé</th><th class="l">Statut</th><th></th></tr></thead><tbody>'+rows.map(function(r){ return '<tr><td class="l"><b>'+esc(r.num)+'</b>'+(r.e.env==='sandbox'?' <span class="sub2">test</span>':'')+'</td><td class="l">'+fr(r.e.at)+'</td><td class="l"><span class="nxpdp-st '+cls(r.e.code)+'">'+esc(lab(r.e.code,r.e.texte))+'</span></td><td><button class="btn-ghost btn-sm" onclick="nxPdpHistory(\''+esc(r.num)+'\')">Détail</button></td></tr>'; }).join('')+'</tbody></table></div>'
          :'<div class="empty">Rien d\'envoyé pour l\'instant. Bouton « Envoyer » sur une facture (écran Avoirs, ou bloc facturation du devis).</div>')+'</div>';
      h+='<div class="card"><h2>📤 Envoyer une facture</h2>'+pickList()+'</div>';
      h+='<div class="card"><h2>📥 Factures reçues</h2><div id="nxpdpRecu"></div></div>';
      h+='<div class="card"><h2>🔎 Annuaire officiel</h2><div class="sub" style="margin-bottom:6px">Un client professionnel peut-il recevoir des factures électroniques ?</div><div class="frm"><label>SIREN ou SIRET<input id="nxpdpSiren" inputmode="numeric"></label></div><div class="row-actions" style="margin-top:6px"><button class="btn-ghost btn-sm" onclick="nxPdpLookup()">Chercher</button></div><div id="nxpdpDirOut" style="margin-top:6px"></div></div>';
      box.innerHTML=h; renderReceived();
      /* statuts en cours : mis à jour à l'ouverture */
      if(rows.some(function(r){ return !FINAL.test(r.e.code||''); })&&!renderView._auto){ renderView._auto=true; refreshStatuses(false).then(function(n){ renderView._auto=false; if(n&&window._curView==='nx_pdp') renderViewQuiet(); }); }
    });
  }
  function renderViewQuiet(){ var y=window.scrollY; renderView(); window.scrollTo(0,y); }
  function pickList(){
    var inv=(window.nxInvoices?nxInvoices():[]).filter(function(i){ return !i.annulee; }).slice(0,15), av=(window.nxAvoirs?nxAvoirs():[]).slice(-5).reverse();
    var all=inv.map(function(i){ return {num:i.num,cli:i.cli,m:i.montant,l:i.label}; }).concat(av.map(function(a){ return {num:a.num,cli:a.cli||{},m:a.montant,l:'Avoir sur '+a.facNum}; }));
    if(!all.length) return '<div class="empty">Aucune facture émise.</div>';
    return '<div class="scroll"><table><tbody>'+all.map(function(x){ var s=window.nxPdpLastStatus(x.num); return '<tr><td class="l"><b>'+esc(x.num)+'</b><div class="sub2">'+esc((x.cli.nom||'—')+' · '+x.l)+'</div></td><td>'+money(x.m)+'</td><td class="l">'+(s?'<span class="nxpdp-st '+cls(s.code)+'">'+esc(lab(s.code,s.texte))+'</span>':'')+'</td><td><button class="btn-pri btn-sm" onclick="nxPdpSend(\''+esc(x.num)+'\')">Envoyer</button></td></tr>'; }).join('')+'</tbody></table></div>';
  }
  function hero(){ return '<div class="next-hero"><h2>⚡ Facture électronique — plateforme agréée</h2><p>ClimPilot fabrique le fichier officiel, la plateforme SUPER PDP le contrôle et le transmet. Obligatoire pour tes factures aux professionnels à partir du 01/09/2027.</p></div>'; }
  window.nxPdpRender=function(force){ if(force) STATUS=null; renderView(); };
  function refreshView(){ if(window._curView==='nx_pdp') renderViewQuiet(); }

  /* ---------- boutons « Envoyer » ailleurs dans l'app ---------- */
  function decorate(){
    /* écran Avoirs : à côté de chaque facture / avoir */
    document.querySelectorAll('#nxav table tr').forEach(function(tr){ var b=tr.querySelector('td b'); var t=b&&b.textContent; if(!t||!/^(TEST-)?(F|AV)-\d{4}-\d+$/.test(t)||tr.querySelector('.nxpdp-x')) return;
      var s=window.nxPdpLastStatus(t), td=tr.lastElementChild;
      td.insertAdjacentHTML('beforeend',' <button class="btn-ghost btn-sm nxpdp-x" onclick="nxPdpSend(\''+t+'\')">'+(s?'Renvoyer':'Envoyer')+'</button>'+(s?' <span class="nxpdp-st '+cls(s.code)+'">'+esc(lab(s.code,s.texte))+'</span>':'')); });
    /* bloc facturation du devis */
    var bl=document.querySelector('#fBloc .nxav-inbloc'); if(bl&&!bl.querySelector('.nxpdp-x')){ var d=typeof cur!=='undefined'?cur:null; if(d){ var fs=[d.facAcompte,d.facSolde].filter(Boolean); if(fs.length) bl.insertAdjacentHTML('beforeend','<div style="margin-top:6px"><b>Plateforme</b> : '+fs.map(function(f){ var s=window.nxPdpLastStatus(f.num); return '<button type="button" class="btn-ghost btn-sm nxpdp-x" onclick="nxPdpSend(\''+esc(f.num)+'\')">Envoyer '+esc(f.num)+'</button>'+(s?' <span class="nxpdp-st '+cls(s.code)+'">'+esc(lab(s.code,s.texte))+'</span>':''); }).join(' ')+'</div>'); } }
  }

  var CSS='.nxpdp-busy{padding:14px 4px;font-size:14px}.nxpdp-list{margin:6px 0 0 18px;padding:0;font-size:13px}.nxpdp-list li{margin:4px 0}'+
    '.nxpdp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}'+
    '.nxpdp-st{display:inline-block;font-size:12px;padding:2px 8px;border-radius:999px;background:#eef3fa;color:#1f4e79;white-space:nowrap}.nxpdp-st.ok{background:#eaf7ef;color:#0f6b39}.nxpdp-st.bad{background:#fdecea;color:#b42318}.nxpdp-st.warn{background:#fff7e6;color:#8a5a00}';
  function boot(){
    try{
      if(!document.getElementById('nxpdpStyle')){ var st=document.createElement('style'); st.id='nxpdpStyle'; st.textContent=CSS; document.head.appendChild(st); }
      if(typeof TITLES!=='undefined'&&!TITLES.nx_pdp) TITLES.nx_pdp=['Facture électronique','Plateforme agréée SUPER PDP : envoi, suivi, factures reçues.'];
      var nav=document.getElementById('nav');
      if(nav&&!nav.querySelector('a[data-v="nx_pdp"]')){
        var ref=nav.querySelector('a[data-v="nx_avoirs"]')||nav.querySelector('a[data-v="nx_docs"]');
        var a=document.createElement('a'); a.setAttribute('data-v','nx_pdp'); a.innerHTML='<span class="ico">⚡</span><span class="txt">Facture électronique</span>';
        if(ref&&ref.parentNode) ref.parentNode.insertBefore(a,ref.nextSibling); else nav.appendChild(a);
      }
      if(!document.getElementById('v-nx_pdp')){ var dash=document.getElementById('v-dash'), parent=dash?dash.parentNode:document.querySelector('.content'); if(parent){ var sec=document.createElement('section'); sec.className='view'; sec.id='v-nx_pdp'; sec.innerHTML='<div id="nxpdp"></div>'; parent.appendChild(sec); } }
      var og=window.go; if(typeof og==='function'&&!og._nxpdp){ window.go=function(v){ var r=og.apply(this,arguments); try{ if(v==='nx_pdp') renderView(); }catch(e){} return r; }; window.go._nxpdp=true; }
      new MutationObserver(function(){ decorate(); }).observe(document.body,{childList:true,subtree:true});
    }catch(e){ try{ console.error('nxpdp',e); }catch(_){} }
  }
  window.nxPdpTest={testOverrides:testOverrides,lab:lab,lastEv:lastEv,refreshStatuses:refreshStatuses};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();
