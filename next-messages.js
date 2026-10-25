/* ============================================================
   ClimPilot Next — next-messages.js  (couche additive, 20/10/2026, branche claude/planning-20-10)
   Messages au client, prêts à envoyer depuis TON téléphone (SMS ou mail) : rien ne part tout seul,
   aucun service payant (un SMS envoyé par le téléphone est compris dans ton forfait ; un service d'envoi
   coûterait ~0,045 € HT par SMS — comparatif SMS Partner, août 2026).
   Quatre messages (choix de Gabriel du 19/10) :
     1. VEILLE      : « je passe demain matin / après-midi » — pour chaque intervention de demain (le vendredi : lundi).
     2. ENTRETIEN   : clients SOUS CONTRAT dont la visite approche (21 jours avant) ou est en retard — proposer la date.
     3. CONFIRMATION: créneau demandé sur le site, confirmé par Gabriel, avec l'acompte à régler (next-terrain.js).
     4. AVIS        : déjà géré par next-avis.js (après paiement) ; rappelé ici dans Ma journée.
   Règles : tous ces messages concernent une prestation demandée ou en cours (pas de prospection : art. L223-8,
   interdiction du démarchage pour la rénovation énergétique) ; un client peut être exclu (« plus de messages »).
   Chaque envoi est noté (clé cpnext_msgs, synchronisée) pour ne jamais envoyer deux fois.
   SMS : compte GSM (160 caractères, ou 70 si un caractère hors GSM comme ç, ê, ô, œ, ’) et prévient si > 1 SMS.
   ============================================================ */
(function(){
  'use strict';
  var KEY='cpnext_msgs';
  try{ if(Array.isArray(window.SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}
  var pad=function(n){ return String(n).padStart(2,'0'); };
  var isoD=function(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  var plus=function(iso,n){ var d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return isoD(d); };
  var auj=function(){ return isoD(new Date()); };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var norm=function(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,80); };
  function say(m,t){ try{ if(window.nxToast) return nxToast(m,t); }catch(e){} try{ toast(m); }catch(e){} }
  function ent(){ try{ return (P&&P.entreprise)||{}; }catch(e){ return {}; } }
  function signature(){ var E=ent(); var n=String(E.nomEntrepreneur||E.nom||'').trim(); return n+(E.tel?' '+E.tel:''); }
  function dateFR(iso,long){ try{ return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',long?{weekday:'long',day:'numeric',month:'long'}:{day:'numeric',month:'long'}); }catch(e){ return iso; } }

  /* ---------- journal des envois et exclusions ---------- */
  function lire(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ a=[]; } return Array.isArray(a)?a:[]; }
  function ecrire(a){ try{ save(KEY,a); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(_){} } }
  function noter(kind,cible,canal){ var a=lire().filter(function(x){ return !(x.kind===kind&&x.cible===cible); }); a.push({kind:kind,cible:cible,canal:canal,le:new Date().toISOString()}); if(a.length>600) a=a.slice(-600); ecrire(a); }
  function envoye(kind,cible){ return lire().find(function(x){ return x.kind===kind&&x.cible===cible; })||null; }
  function exclu(nom){ var n=norm(nom); return !!n&&lire().some(function(x){ return x.kind==='exclu'&&x.cible===n; }); }
  window.nxmsgExclure=function(nom){ var n=norm(nom); if(!n) return; var a=lire(); if(!a.some(function(x){ return x.kind==='exclu'&&x.cible===n; })) a.push({kind:'exclu',cible:n,le:new Date().toISOString()}); ecrire(a); say('Plus de messages pour '+nom,'ok'); rafraichir(); };
  window.nxmsgReinclure=function(nom){ var n=norm(nom); ecrire(lire().filter(function(x){ return !(x.kind==='exclu'&&x.cible===n); })); rafraichir(); };
  window.nxmsgJournal=lire;

  /* ---------- SMS : longueur GSM ---------- */
  var GSM="@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà", EXT="^{}\\[~]|€";
  function smsInfo(t){ t=String(t||''); var gsm=true, n=0;
    for(var i=0;i<t.length;i++){ var c=t[i]; if(GSM.indexOf(c)>=0) n+=1; else if(EXT.indexOf(c)>=0) n+=2; else { gsm=false; break; } }
    if(!gsm){ var u=Array.from(t).length; return {gsm:false,len:u,segments:u<=70?1:Math.ceil(u/67),max:70}; }
    return {gsm:true,len:n,segments:n<=160?1:Math.ceil(n/153),max:160};
  }
  /* version « 1 SMS » : caractères hors GSM remplacés par leur équivalent simple */
  function gsmSafe(t){ return String(t||'').replace(/[’‘]/g,"'").replace(/[“”«»]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/œ/g,'oe').replace(/Œ/g,'OE')
    .replace(/[çĉ]/g,'c').replace(/[âäáãå]/g,'a').replace(/[êë]/g,'e').replace(/[îïí]/g,'i').replace(/[ôõó]/g,'o').replace(/[ûú]/g,'u').replace(/[ÂÄÁ]/g,'A').replace(/[ÊË]/g,'E').replace(/[ÎÏ]/g,'I').replace(/[ÔÕ]/g,'O').replace(/[ÛÚ]/g,'U').replace(/[^\x00-\x7F£¥èéùìòÇØøÅåÆæßÉ¡ÄÖÑÜ§¿äöñüà€]/g,''); }
  window.nxmsgSms=smsInfo; window.nxmsgGsm=gsmSafe;

  /* ---------- contact d'un client (fiche client, sinon dernier devis / intervention) ---------- */
  function contact(nom,ob){
    var n=norm(nom), r={tel:'',mail:''};
    if(ob){ r.tel=String(ob.cTel||''); r.mail=String(ob.cMail||''); }
    try{ (CLIENTS||[]).forEach(function(c){ if(c&&norm(c.nom)===n){ r.tel=r.tel||String(c.tel||''); r.mail=r.mail||String(c.mail||''); } }); }catch(e){}
    try{ (DEVIS||[]).concat(DEP||[]).forEach(function(d){ if(d&&norm(d.cNom)===n){ r.tel=r.tel||String(d.cTel||''); r.mail=r.mail||String(d.cMail||''); } }); }catch(e){}
    r.tel=r.tel.replace(/[^\d+]/g,''); r.mail=r.mail.trim(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.mail)) r.mail='';
    return r;
  }
  function source(k){ try{ return window.nxplSource?nxplSource(k):null; }catch(e){ return null; } }
  function momentTxt(m){ return m==='matin'?'demain matin':m==='apresmidi'?'demain après-midi':'demain dans la journée'; }

  /* ---------- 1. veille ---------- */
  function joursVeille(){ var t=new Date(), j=[plus(isoD(t),1)]; if(t.getDay()===5) j.push(plus(isoD(t),3)); if(t.getDay()===6) j=[plus(isoD(t),2)]; return j; }
  function evenements(iso){ try{ var d=new Date(iso+'T12:00:00'); return window.nxplEvenementsDuJour?nxplEvenementsDuJour(iso):[]; }catch(e){ return []; } }
  function candidatsVeille(){
    var out=[]; joursVeille().forEach(function(iso){ evenements(iso).forEach(function(e){
      var s=source(e.k); if(!s||!s.o) return; var nom=s.o.cNom||s.o.clientNom||''; if(!nom||exclu(nom)) return;
      var c=contact(nom,s.o), m=e.m||'journee', quand=(iso===plus(auj(),1))?momentTxt(m):(dateFR(iso,true).split(' ')[0]+(m==='matin'?' matin':m==='apresmidi'?' après-midi':''));
      var txt='Bonjour, je vous confirme mon passage '+quand+' ('+String(e.lbl||'').replace(/^[^—–-]*[—–-]\s*/,'')+'). Un empêchement ? Répondez à ce message. '+signature();
      out.push({id:'veille:'+e.k+':'+iso,kind:'veille',cible:e.k+':'+iso,nom:nom,jour:iso,tel:c.tel,mail:c.mail,sujet:'Mon passage '+dateFR(iso),txt:txt,deja:envoye('veille',e.k+':'+iso)});
    }); });
    return out;
  }
  /* ---------- 2. entretien (contrats seulement) ---------- */
  function candidatsEntretien(){
    var out=[], t=auj(), lim=plus(t,21), bas=plus(t,-60);
    try{ (CTR||[]).forEach(function(c){ if(!c||c.actif===false||!c.prochaineVisite) return; var v=String(c.prochaineVisite); if(v>lim||v<bas) return;
      var nom=c.clientNom||''; if(!nom||exclu(nom)) return; var ct=contact(nom,null), retard=v<t;
      var txt='Bonjour, dans le cadre de votre contrat d\'entretien '+(c.type||'')+', votre visite '+(retard?'est à programmer':'approche (vers le '+dateFR(v)+')')+'. Quelles sont vos disponibilités ? (1 h à 1 h 30 sur place) '+signature();
      out.push({id:'entretien:'+c.id+':'+v,kind:'entretien',cible:c.id+':'+v,nom:nom,jour:v,retard:retard,tel:ct.tel,mail:ct.mail,sujet:'Entretien '+(c.type||'')+' : planifions votre visite',txt:txt,deja:envoye('entretien',c.id+':'+v)}); }); }catch(e){}
    return out;
  }
  /* ---------- 3. confirmation d'un créneau (interventions créées depuis le site, next-terrain.js) ---------- */
  function candidatsConfirmation(){
    var out=[];
    try{ (DEP||[]).forEach(function(x){ if(!x||!x.site||!x.date||x.statut==='payee') return; var nom=x.cNom||''; if(!nom||exclu(nom)) return;
      var c=contact(nom,x), m=x.moment==='matin'?' matin':x.moment==='apresmidi'?' après-midi':'', ac=x.acompte&&x.acompte.montant;
      var E=ent(), txt='Bonjour, votre créneau du '+dateFR(x.date)+m+' est confirmé ('+(x.site.prestation||x.desc||'intervention')+').'+(ac&&!(x.acompte&&x.acompte.recu)?' Acompte de '+ac+' € à régler avant le rendez-vous'+(E.rib?' par virement (IBAN '+String(E.rib).replace(/\s+/g,'')+')':'')+'.':'')+' Gratuit jusqu\'à 24 h avant. '+signature();
      out.push({id:'confirm:'+x.id,kind:'confirm',cible:x.id,nom:nom,jour:x.date,tel:c.tel,mail:c.mail,sujet:'Votre créneau du '+dateFR(x.date)+' est confirmé',txt:txt,deja:envoye('confirm',x.id)}); }); }catch(e){}
    return out;
  }
  window.nxmsgCandidats=function(){ return {veille:candidatsVeille(),entretien:candidatsEntretien(),confirm:candidatsConfirmation()}; };

  /* ---------- envoi (depuis le téléphone) ---------- */
  function trouver(id){ var C=window.nxmsgCandidats(); return C.veille.concat(C.entretien,C.confirm).find(function(x){ return x.id===id; })||null; }
  function ouvrir(url){ try{ if(window.nxavisOuvrir) return nxavisOuvrir(url); }catch(e){} var a=document.createElement('a'); a.href=url; a.rel='noopener'; a.style.display='none'; document.body.appendChild(a); try{ a.click(); } finally { a.remove(); } }
  window.nxmsgSmsEnvoyer=function(id){ var x=trouver(id); if(!x) return false; if(!x.tel){ say('Pas de téléphone pour '+x.nom,'warn'); return false; }
    var t=gsmSafe(x.txt); ouvrir('sms:'+x.tel+'?&body='+encodeURIComponent(t)); noter(x.kind,x.cible,'sms'); say('SMS prêt pour '+x.nom,'ok'); rafraichir(); return true; };
  window.nxmsgMailEnvoyer=function(id){ var x=trouver(id); if(!x) return false; if(!x.mail){ say('Pas d\'e-mail pour '+x.nom,'warn'); return false; }
    ouvrir('mailto:'+encodeURIComponent(x.mail)+'?subject='+encodeURIComponent(x.sujet)+'&body='+encodeURIComponent(x.txt)); noter(x.kind,x.cible,'mail'); say('Mail prêt pour '+x.nom,'ok'); rafraichir(); return true; };
  window.nxmsgCopier=function(id){ var x=trouver(id); if(!x) return Promise.resolve(false); var p=window.cpCopier?cpCopier(x.txt):Promise.resolve(false);
    return p.then(function(ok){ if(ok){ noter(x.kind,x.cible,'copie'); say('Message copié : colle-le dans WhatsApp ou ta messagerie','ok'); rafraichir(); } else say('Copie impossible','warn'); return ok; }); };
  window.nxmsgFait=function(id){ var x=trouver(id); if(!x) return; noter(x.kind,x.cible,'autre'); rafraichir(); };
  function rafraichir(){ try{ if(window._curView==='nx_journee'&&window.nxjRender) nxjRender(); }catch(e){} }

  /* ---------- carte dans Ma journée ---------- */
  function ligne(x){
    var s=smsInfo(gsmSafe(x.txt)), info=s.segments>1?'<span class="nxm-warn">'+s.segments+' SMS ('+s.len+' car.'+(s.gsm?'':', accents spéciaux')+')</span>':'<span class="nxm-ok">1 SMS</span>';
    return '<div class="nxm-row'+(x.deja?' fait':'')+'" data-msg="'+esc(x.id)+'"><div class="nxm-h"><b>'+esc(x.nom)+'</b> <span class="nxm-k">'+(x.kind==='veille'?'veille':x.kind==='entretien'?(x.retard?'entretien en retard':'entretien à prévoir'):'confirmation')+'</span>'+
      (x.deja?' <span class="nxm-ok">✔ envoyé le '+esc(new Date(x.deja.le).toLocaleDateString('fr-FR'))+(x.deja.canal?' ('+esc(x.deja.canal)+')':'')+'</span>':'')+'</div>'+
      '<div class="nxm-txt">'+esc(x.txt)+'</div>'+
      (x.deja?'':'<div class="nxm-act">'+(x.tel?'<button class="nx-sbtn acc" onclick="nxmsgSmsEnvoyer(\''+esc(x.id)+'\')">💬 SMS</button>':'')+(x.mail?'<button class="nx-sbtn" onclick="nxmsgMailEnvoyer(\''+esc(x.id)+'\')">✉️ Mail</button>':'')+
      '<button class="nx-sbtn" onclick="nxmsgCopier(\''+esc(x.id)+'\')">Copier</button><button class="nx-sbtn" onclick="nxmsgFait(\''+esc(x.id)+'\')" title="Déjà prévenu autrement">Fait</button>'+
      '<button class="nx-sbtn ref" onclick="nxmsgExclure(\''+esc(x.nom).replace(/'/g,'\\\'')+'\')" title="Ce client ne veut plus de messages">✕ Plus de messages</button> '+info+(x.tel||x.mail?'':' <span class="nxm-warn">ni téléphone ni e-mail connu</span>')+'</div>')+'</div>';
  }
  function carte(r,mode){
    var C=window.nxmsgCandidats(), L=[];
    if(mode==='soir'||true) L=L.concat(C.veille);
    L=L.concat(C.confirm,C.entretien);
    var aFaire=L.filter(function(x){ return !x.deja; }), faits=L.filter(function(x){ return x.deja; });
    var avis=0; try{ avis=window.nxavisLien&&nxavisLien()&&window.nxavisCandidats?nxavisCandidats().length:0; }catch(e){}
    if(!aFaire.length&&!faits.length&&!avis) return '';
    var h='<div class="card nxj-card" id="nxMessages"><h2>💬 Messages à envoyer'+(aFaire.length?' <span class="nxm-n">'+aFaire.length+'</span>':'')+'</h2>';
    h+='<div class="nxj-sub" style="margin-bottom:8px">Tu envoies toi-même depuis ton téléphone (SMS compris dans ton forfait). Rien ne part tout seul.</div>';
    h+=aFaire.map(ligne).join('');
    if(avis) h+='<div class="nxm-row"><div class="nxm-h"><b>'+avis+' client'+(avis>1?'s':'')+' payé'+(avis>1?'s':'')+' récemment</b> <span class="nxm-k">avis Google</span></div><div class="nxm-act"><button class="nx-sbtn" onclick="go(\'nx_obj\')">Voir dans Objectifs &amp; feux</button></div></div>';
    if(faits.length) h+='<details class="nxm-faits"><summary>'+faits.length+' déjà envoyé'+(faits.length>1?'s':'')+'</summary>'+faits.map(ligne).join('')+'</details>';
    return h+'</div>';
  }
  var CSS='.nxm-row{padding:9px 0;border-bottom:1px solid var(--line,#edf1f5)}.nxm-row:last-child{border-bottom:0}.nxm-row.fait{opacity:.75}.nxm-h{font-size:14px}.nxm-k{font-size:11px;color:var(--muted,#6b7a90);text-transform:uppercase;letter-spacing:.04em;margin-left:4px}'+
    '.nxm-txt{font-size:13px;background:var(--bg,#f6f8fb);border-radius:8px;padding:7px 9px;margin:6px 0;white-space:pre-wrap}.nxm-act{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px}.nxm-ok{color:#1e7a4c;font-size:12px}.nxm-warn{color:#b05a00;font-size:12px;font-weight:700}'+
    '.nxm-n{display:inline-block;background:#b03a2e;color:#fff;border-radius:10px;padding:0 7px;font-size:12px;margin-left:6px}.nxm-faits{margin-top:8px;font-size:13px}.nxm-faits summary{cursor:pointer;color:var(--muted,#6b7a90)}';
  function boot(n){
    if(typeof window.nxjRender!=='function'||typeof window.nxplSource!=='function'){ if(n<60) setTimeout(function(){ boot(n+1); },250); return; }
    /* M0 20/10/2026 : identifiant propre (nxmStyle était aussi celui de next-mobile.js, qui n'installait plus sa CSS téléphone) */
    if(!document.getElementById('nxmsgStyle')){ var st=document.createElement('style'); st.id='nxmsgStyle'; st.textContent=CSS; document.head.appendChild(st); }
    window.nxjAjouts=window.nxjAjouts||[]; if(!window.nxjAjouts.some(function(a){ return a&&a.id==='messages'; })) window.nxjAjouts.push({id:'messages',pos:40,carte:carte});
    try{ if(window._curView==='nx_journee') nxjRender(); }catch(e){}
  }
  boot(0);
})();
