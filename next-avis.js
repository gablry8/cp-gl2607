/* ============================================================
   ClimPilot Next — next-avis.js  (couche additive, 1.12 — 12/10/2026)
   « Demander un avis » (carte de l'écran Objectifs & feux) :
   - après un chantier PAYÉ (encaissement des 60 derniers jours), ClimPilot propose de demander un avis Google
     au client, avec un mail ou un SMS déjà écrits et le lien de ta fiche (Paramètres › Mon entreprise › avisGoogle) ;
   - une seule demande par client : « demandé » ou « pas pour ce client » est gardé (clé cpnext_avis,
     synchronisée, liste à identifiants) ;
   - rien n'est envoyé automatiquement : c'est toi qui envoies depuis ta messagerie. Le texte ne propose
     ni cadeau ni contrepartie.
   ============================================================ */
(function(){
  'use strict';
  var KEY='cpnext_avis', JOURS=60;
  try{ if(Array.isArray(SYNC_KEYS)&&SYNC_KEYS.indexOf(KEY)<0) SYNC_KEYS.push(KEY); }catch(e){}

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function iso(y,m,d){ var x=new Date(y,m,d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  function today(){ try{ return todayISO(); }catch(e){ var d=new Date(); return iso(d.getFullYear(),d.getMonth(),d.getDate()); } }
  function okDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')); }
  function fr(s){ return okDate(s)?new Date(s+'T00:00:00').toLocaleDateString('fr-FR'):'—'; }
  function say(m){ try{ toast(m); }catch(e){} }
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,80); }
  function ent(){ try{ return (P&&P.entreprise)||{}; }catch(e){ return {}; } }
  function liste(nom){ try{
      var v=nom==='CLIENTS'?(typeof CLIENTS!=='undefined'?CLIENTS:null):nom==='DEVIS'?(typeof DEVIS!=='undefined'?DEVIS:null):nom==='DEP'?(typeof DEP!=='undefined'?DEP:null):null;
      return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  function refresh(){ try{ if(window._curView==='nx_obj'&&window.nxobjRender) nxobjRender(); }catch(e){} }

  /* lien de la fiche : https seulement */
  function lien(){ var u=String(ent().avisGoogle||'').trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u)?u:''; }
  window.nxavisLien=lien;

  function marks(){ var a=[]; try{ a=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ a=[]; } return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.id==='string'; }):[]; }
  function marquer(id,etat){ var a=marks().filter(function(x){ return x.id!==id; }); a.push({id:id,d:today(),etat:etat});
    try{ save(KEY,a); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(_){} } }
  window.nxavisMarques=marks;

  /* clients payés dans les 60 derniers jours, pas encore sollicités, le plus récent d'abord */
  function candidats(t){
    t=okDate(t)?t:today(); var since=iso(+t.slice(0,4),+t.slice(5,7)-1,+t.slice(8,10)-JOURS), rec=[];
    try{ rec=window.nxobjRecettes?nxobjRecettes(since,t):(window.nxrgLignesRecettes?nxrgLignesRecettes(since,t):[]); }catch(e){ rec=[]; }
    var deja={}; marks().forEach(function(x){ deja[x.id]=1; });
    var g={};
    rec.forEach(function(r){ var n=norm(r.client); if(!n||r.client==='—') return; var id='cli:'+n; if(deja[id]) return;
      var x=g[id]=g[id]||{id:id,client:r.client,date:'',total:0}; x.total+=Number(r.ttc!=null?r.ttc:r.ht)||0; if(String(r.date)>x.date) x.date=String(r.date); });
    return Object.keys(g).map(function(k){ return g[k]; }).filter(function(x){ return x.total>0.005; }).sort(function(a,b){ return b.date.localeCompare(a.date); });
  }
  window.nxavisCandidats=candidats;

  /* coordonnées : fiche client, sinon le dernier devis / intervention de ce client */
  function contact(nom){
    var n=norm(nom), r={mail:'',tel:''};
    liste('CLIENTS').forEach(function(c){ if(c&&norm(c.nom)===n){ r.mail=r.mail||String(c.mail||''); r.tel=r.tel||String(c.tel||''); } });
    liste('DEVIS').concat(liste('DEP')).forEach(function(d){ if(d&&norm(d.cNom)===n){ r.mail=r.mail||String(d.cMail||''); r.tel=r.tel||String(d.cTel||''); } });
    r.mail=r.mail.trim(); r.tel=r.tel.replace(/[^\d+]/g,'');
    return r;
  }
  function message(nom){
    var E=ent(), sig=String(E.nomEntrepreneur||E.nom||'').trim();
    /* texte neutre : on demande un avis, pas un avis positif (pas de sollicitation sélective) */
    return 'Bonjour'+(nom?' '+nom:'')+',\n\nMerci encore pour votre confiance. Votre avis sur mon intervention, déposé sur Google, m’aiderait beaucoup (une minute suffit) :\n'+lien()+'\n\nBonne journée,\n'+sig+(E.tel?'\n'+E.tel:'');
  }
  window.nxavisMessage=message;
  var SUJET='Votre avis sur mon intervention';

  /* ouverture de l'appli mail / SMS du téléphone (remplaçable pour les essais) */
  window.nxavisOuvrir=function(url){ var a=document.createElement('a'); a.href=url; a.rel='noopener'; a.style.display='none'; document.body.appendChild(a); try{ a.click(); } finally { a.remove(); } };
  function cand(id){ return candidats(today()).filter(function(x){ return x.id===id; })[0]; }
  window.nxavisMail=function(id){ var x=cand(id); if(!x||!lien()) return false; var c=contact(x.client);
    window.nxavisOuvrir('mailto:'+encodeURIComponent(c.mail)+'?subject='+encodeURIComponent(SUJET)+'&body='+encodeURIComponent(message(x.client)));
    marquer(id,'demande'); say('Avis demandé à '+x.client); refresh(); return true; };
  window.nxavisSms=function(id){ var x=cand(id); if(!x||!lien()) return false; var c=contact(x.client);
    if(!c.tel){ say('Pas de téléphone pour ce client : utilise le mail ou « Copier »'); return false; }
    window.nxavisOuvrir('sms:'+c.tel+'?&body='+encodeURIComponent(message(x.client)));
    marquer(id,'demande'); say('Avis demandé à '+x.client); refresh(); return true; };
  window.nxavisCopier=function(id){ var x=cand(id); if(!x||!lien()) return false; var m=message(x.client);
    var p=(typeof window.cpCopier==='function')?window.cpCopier(m):Promise.resolve(false);
    return p.then(function(ok){ if(ok){ marquer(id,'demande'); say('Message copié : colle-le dans WhatsApp ou ta messagerie'); refresh(); } else say('Copie impossible sur cet appareil'); return ok; }); };
  window.nxavisFait=function(id){ marquer(id,'demande'); refresh(); };
  window.nxavisNon=function(id){ marquer(id,'non'); refresh(); };

  function carte(ctx){
    if(!ctx||ctx.m<1) return '';
    var C=candidats(ctx.t); if(!C.length) return '';
    var L=lien(), h='<div class="card" id="nxavis"><h2>Demander un avis</h2>';
    if(!L){ var saisi=String(ent().avisGoogle||'').trim();
      return h+'<div class="nxo-big">'+C.length+' client(s) payé(s) ces '+JOURS+' derniers jours.</div><div class="nxo-note">'
        +(saisi?'Le lien saisi dans Paramètres n’est pas valide : il doit commencer par <b>https://</b> (copie-le tel quel depuis ta fiche Google).':'Colle d’abord le lien « laisser un avis » de ta fiche Google dans Paramètres › Mon entreprise : ClimPilot préparera le mail ou le SMS.')
        +'</div><div class="row-actions" style="margin-top:8px"><button class="btn-ghost btn-sm" onclick="go(\'params\')">Ouvrir Paramètres</button></div></div>'; }
    h+=C.slice(0,5).map(function(x){ var c=contact(x.client), id=esc(x.id);
      return '<div class="nxo-c" data-avis="'+id+'"><span class="i">★</span><div style="flex:1"><div><b>'+esc(x.client)+'</b></div><div class="d">Payé le '+fr(x.date)+'</div></div>'
        +'<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'
        +(c.mail?'<button class="btn-ghost btn-sm" onclick="nxavisMail(\''+id+'\')">✉️ Mail</button>':'')
        +(c.tel?'<button class="btn-ghost btn-sm" onclick="nxavisSms(\''+id+'\')">💬 SMS</button>':'')
        +'<button class="btn-ghost btn-sm" onclick="nxavisCopier(\''+id+'\')">Copier</button>'
        +'<button class="btn-ghost btn-sm" onclick="nxavisNon(\''+id+'\')" title="Ne pas demander à ce client">✕</button></span></div>'; }).join('');
    return h+'<div class="nxo-note">Une demande par client, juste après le paiement. Le texte ne promet rien en échange. Tu envoies toi-même depuis ta messagerie.</div></div>';
  }
  function afaire(ctx){ if(!ctx||ctx.m<1||!lien()) return []; var n=candidats(ctx.t).length;
    return n?[{urg:0,txt:n+' client(s) payé(s) récemment : demande-leur un avis Google (mail ou SMS prêts).',act:'appel',fn:'nxobjVoir',arg:'nxavis',btn:'Voir'}]:[]; }

  window.nxobjAjouts=window.nxobjAjouts||[];
  if(!window.nxobjAjouts.some(function(a){ return a&&a.id==='avis'; })) window.nxobjAjouts.push({id:'avis',pos:'apresFeux',carte:carte,afaire:afaire});
})();
